import { eq, sql } from 'drizzle-orm';
import { COST_TABLE, costKeys, creditsFor, estOf, ledgerBreakdown, n8nSiteId, type CostCertainty, type CostKey, type ModeId } from '@seo/shared';
import { db, schema } from '../../db';
import { rows as n8nRows } from '../../n8n/client';
import { cachedCalibration } from '../engineCost';
import { callbackCostCountsForRun, SCHEDULED_STAGES } from '../runs';
import { addCreditEntry } from './credits';
import { settingsRow } from './settings';
import { execRows, tsv } from './sqlRows';

// ---------------------------------------------------------------------------------------------------------------------------------
// What every operation cost us, one row per settled cost unit (`cost_events`), and the credits it used.
//
// Sources, in the order they are trusted:
//   1. engine   — a settled row of the engine's own run ledger (n8n Data Table `seo_run_ledger`, status `done`): Claude (`ai_usd`) and
//                 DataForSEO (`dfs_usd`) as the run settled them, with how much of it was estimated. One event per execution id.
//   2. app      — an app run the ledger does not cover (the ledger could not be read, or no row of it can be tied to the run an hour
//                 after it finished): the run's settled `actual_cost_usd`, split as below.
//   3. keyword_check — the app's keyword checks (the engine reported their cost on the answer; its `assess` rows keyed `app:<company>`
//                 are left out of 1., so each check is counted once).
//
// Which app run an engine row belongs to. `runs.request_id` is the id of the engine's API front door (SEOagentAPIentry,
// n8n/seo-agent/build_api.py `request_id = $execution.id`), NOT the execution that does the work and writes the ledger row (the main
// workflow, a monitor, a spawned ladder page — each its own execution id). What ties them is the callbacks: every callback names the
// execution that built it (`execution_id`; monitors also `run_ledger.run_id`, v5/code/_ledger_cb.js) and carries the run's
// `request_id`, so a report stored on a run maps that execution id to the run. Only callbacks whose spend counts for the run
// (`callbackCostCountsForRun`: never a schedule's report that reuses an old run's request id) are used. `runs.request_id` itself is
// kept as a second key for an engine that writes its ledger row under the front door's id.
//
// Attribution of an engine row, in order: its execution id maps to an app run (above) → that run's company, website and person (origin
// app); its key is `parent:<execution id>` (an on-demand monitor started by a run) → whatever the parent resolves to; its key is
// `app:<company id>` → that company, when the company existed by then; else its `domain` (or the `site_…` id in an internal key such as
// `cadence:site_x`) is a website verified BEFORE the row settled, of a company created before it → that company (origin schedule);
// else unattributed (org null). A cost made unattributed by its company's deletion (`detached_from`) is never attributed again.
//
// No double count: an engine event and an app event never stand for the same run. Rows stored before their run could be tied are
// linked on every sync (back-fill). Before an app run is counted from its own figure, an unlinked engine event keyed `app:<company>`
// that started within the run's window (2 minutes before it to 5 minutes after it finished) is linked to it instead — the engine's
// figure is preferred. When an engine row is tied to a run that already has an app event, the app event is deleted and the credits it
// used are given back (`reprice:` entry, dated at the original event) before the engine event debits its own. A row the engine settles
// again with a different figure (new `settled_at`) updates its event, and the credit difference is written as its own entry
// (`cost:<key>:<settled_at>`).
//
// Splitting an app run's settled cost: by the run_ledger of the callbacks that counted for it (the same callbacks `actual_cost_usd` was
// summed from) when they add up to it; else, when the run reported search data only (`actual_cost_partial`), all of it is DataForSEO and
// the Claude part is 'not reported'; else it is split by the engine's cost table for that mode (the share of Claude in what the mode
// reserves) and marked 'estimated' — never presented as measured.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface LedgerRow {
  run_id?: unknown;
  key?: unknown;
  mode?: unknown;
  status?: unknown;
  settled_usd?: unknown;
  ai_usd?: unknown;
  dfs_usd?: unknown;
  measured_usd?: unknown;
  estimated_usd?: unknown;
  domain?: unknown;
  created_at?: unknown;
  settled_at?: unknown;
  dfs_balance?: unknown;
  dfs_balance_end?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const date = (...vs: unknown[]): Date | null => {
  for (const v of vs) {
    if (!v) continue;
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Attribution {
  orgId: string | null;
  siteId: string | null;
  userId: string | null;
  runId: string | null;
  origin: 'app' | 'schedule';
}

export interface RunRef {
  id: string;
  orgId: string;
  siteId: string | null;
  userId: string | null;
}

export interface Lookups {
  /** app runs by an engine execution id (from their callbacks) or by their own request id */
  runsByExec: Map<string, RunRef>;
  /** verified websites by domain and by the engine's site id (`site_…`), with when they were verified */
  sitesByDomain: Map<string, { id: string; orgId: string; verifiedAt: Date }>;
  sitesByEngineId: Map<string, { id: string; orgId: string; verifiedAt: Date }>;
  /** every company, with when it was created */
  orgs: Map<string, Date>;
  /** attribution of engine rows already stored (for `parent:` rows whose parent is not in this read) */
  stored: Map<string, Attribution>;
}

const NONE: Attribution = { orgId: null, siteId: null, userId: null, runId: null, origin: 'schedule' };
const fromRun = (r: RunRef): Attribution => ({ orgId: r.orgId, siteId: r.siteId, userId: r.userId, runId: r.id, origin: 'app' });

/** when the row's money was spent (its settle), for the "existed / verified by then" rules */
export const occurredOf = (row: LedgerRow): Date => date(row.settled_at, row.updatedAt, row.created_at, row.createdAt) ?? new Date();

/** Who caused one engine ledger row (see the header). `batch` = the other rows of this read, by execution id. */
export function attributeLedgerRow(row: LedgerRow, lk: Lookups, batch: Map<string, LedgerRow> = new Map(), depth = 0): Attribution {
  const runId = str(row.run_id);
  const key = str(row.key);
  const at = occurredOf(row);
  const run = runId ? lk.runsByExec.get(runId) : undefined;
  if (run) return fromRun(run);
  const parent = key.startsWith('parent:') ? key.slice(7) : '';
  if (parent && depth < 5) {
    const pr = lk.runsByExec.get(parent);
    if (pr) return fromRun(pr);
    const inBatch = batch.get(parent);
    if (inBatch) {
      const a = attributeLedgerRow(inBatch, lk, batch, depth + 1);
      if (a.orgId) return a;
    }
    const st = lk.stored.get(parent);
    if (st?.orgId) return st;
  }
  const existed = (orgId: string) => {
    const c = lk.orgs.get(orgId);
    return !!c && at.getTime() >= c.getTime();
  };
  const app = key.match(/^app:([0-9a-f-]{36})$/i);
  if (app && UUID.test(app[1]) && existed(app[1].toLowerCase())) return { ...NONE, orgId: app[1].toLowerCase(), origin: 'app' };
  const domain = str(row.domain).toLowerCase().replace(/^www\./, '');
  const sid = key.match(/(site_[a-z0-9-]+)/i)?.[1]?.toLowerCase();
  const site = (domain && lk.sitesByDomain.get(domain)) || (sid ? lk.sitesByEngineId.get(sid) : undefined);
  // a website verified after the money was spent did not cause it (its domain may have had another owner then)
  if (site && at.getTime() >= site.verifiedAt.getTime() && existed(site.orgId)) return { orgId: site.orgId, siteId: site.id, userId: null, runId: null, origin: 'schedule' };
  return NONE;
}

/** the money of one engine row: Claude, the part of it that is an estimate, DataForSEO, and how sure the total is */
export function engineCost(row: LedgerRow): { claudeUsd: number; claudeEstimatedUsd: number; dataforseoUsd: number; certainty: CostCertainty } {
  const aiReported = num(row.ai_usd);
  const claude = Math.max(0, aiReported ?? num(row.settled_usd) ?? 0);
  const dfs = Math.max(0, num(row.dfs_usd) ?? 0);
  const total = claude + dfs;
  const est = num(row.estimated_usd);
  const measured = num(row.measured_usd);
  // a row settled before the engine split its money (2026-10-13, G23: no ai_usd, measured_usd or estimated_usd) carries the per-mode
  // reservation in settled_usd: every cent of it is an estimate
  if (aiReported == null && est == null && measured == null)
    return { claudeUsd: r6(claude), claudeEstimatedUsd: r6(claude), dataforseoUsd: r6(dfs), certainty: total > 0 ? 'estimated' : 'measured' };
  const e = Math.max(0, est ?? 0);
  const m = Math.max(0, measured ?? 0);
  // `estimated_usd` covers both providers; the engine estimates Claude far more often than DataForSEO (only a crawl's quote), so the
  // estimated part is laid on Claude first, never beyond it
  const claudeEst = Math.min(claude, e);
  const certainty: CostCertainty = total <= 0 ? 'measured' : e <= 1e-9 ? 'measured' : m <= 1e-9 ? 'estimated' : 'partly estimated';
  return { claudeUsd: r6(claude), claudeEstimatedUsd: r6(claudeEst), dataforseoUsd: r6(dfs), certainty };
}

/** the engine's own rows of the app's keyword checks (counted from keyword_checks instead) */
export const isAppKeywordCheckRow = (row: LedgerRow) => str(row.mode) === 'assess' && /^app:/i.test(str(row.key));


/** The Claude / DataForSEO split of an app run's settled cost (see the header for the rule). */
export function splitAppRun(
  run: { mode: string; input: Record<string, unknown>; actualCostUsd: number; actualCostPartial: boolean; actualCostEstimated: boolean },
  reports: { stage: string; payload: Record<string, unknown> }[],
): { claudeUsd: number; claudeEstimatedUsd: number; dataforseoUsd: number; certainty: CostCertainty } {
  const total = Math.max(0, run.actualCostUsd);
  let claude = 0;
  let claudeEst = 0;
  let dfs = 0;
  let any = false;
  const states = new Set<string>();
  for (const r of reports) {
    if (!callbackCostCountsForRun(r.stage, r.payload)) continue;
    const p = r.payload ?? {};
    const direct = num(p.cost_usd);
    const b = ledgerBreakdown(p.run_ledger, direct);
    if (b.total == null) continue;
    any = true;
    dfs += b.data.usd ?? 0;
    claude += b.model.usd ?? 0;
    const l = (p.run_ledger ?? {}) as Record<string, unknown>;
    const aiCost = (l.ai_cost ?? {}) as Record<string, unknown>;
    if (b.model.state === 'estimated') claudeEst += b.model.usd ?? 0;
    else if (b.model.state === 'partly estimated') claudeEst += num(aiCost.estimated_usd) ?? 0;
    states.add(b.model.state);
    states.add(b.data.state);
  }
  if (any && Math.abs(claude + dfs - total) <= Math.max(0.0005, total * 0.001)) {
    const certainty: CostCertainty = states.has('not reported')
      ? 'not reported'
      : states.has('partly estimated') || (states.has('estimated') && states.has('measured'))
        ? 'partly estimated'
        : states.has('estimated')
          ? 'estimated'
          : 'measured';
    return { claudeUsd: r6(claude), claudeEstimatedUsd: r6(Math.min(claude, claudeEst)), dataforseoUsd: r6(dfs), certainty };
  }
  if (run.actualCostPartial) return { claudeUsd: 0, claudeEstimatedUsd: 0, dataforseoUsd: r6(total), certainty: 'not reported' };
  // no usable split: the share of Claude in what this mode reserves (the engine's own figures when read, else the shipped table)
  let ai = 0;
  let data = 0;
  try {
    const cal = cachedCalibration();
    for (const k of costKeys(run.mode as ModeId, run.input ?? {})) {
      if (!(k in COST_TABLE)) continue;
      ai += estOf('ai', k as CostKey, cal).usd;
      data += estOf('dfs', k as CostKey, cal).usd;
    }
  } catch {
    /* an unknown mode: no ratio */
  }
  const share = ai + data > 0 ? ai / (ai + data) : 0;
  const c = r6(total * share);
  return { claudeUsd: c, claudeEstimatedUsd: c, dataforseoUsd: r6(total - c), certainty: 'estimated' };
}

/** A keyword check's cost: the engine's answer is DataForSEO plus one Haiku call at list price (Assess_Response.js), so the Claude
 *  part is that call (an estimate, as the engine itself labels it) and the rest DataForSEO. A check whose answer carried no cost is
 *  held at the app's estimate: wholly estimated. */
export const KEYWORD_CHECK_CLAUDE_USD = 0.0033;
export function splitKeywordCheck(costUsd: number, reported: boolean): { claudeUsd: number; claudeEstimatedUsd: number; dataforseoUsd: number; certainty: CostCertainty } {
  const total = Math.max(0, costUsd);
  const c = Math.min(total, KEYWORD_CHECK_CLAUDE_USD);
  return { claudeUsd: r6(c), claudeEstimatedUsd: r6(c), dataforseoUsd: r6(total - c), certainty: reported ? (total - c > 0 ? 'partly estimated' : 'estimated') : 'estimated' };
}

// ---------------------------------------------------------------------------------------------------------------------------------

export interface SyncResult {
  ok: boolean;
  ledgerReadable: boolean;
  ledgerRows: number;
  engineEvents: number;
  appEvents: number;
  keywordEvents: number;
  superseded: number;
  debits: number;
  note: string;
}

export interface SyncOptions {
  /** replaces the n8n read (tests); `since` = the settled_at the read starts at (null = everything); throw to simulate an unreachable engine */
  readLedger?: (since: string | null) => Promise<LedgerRow[]>;
  /** re-read the whole ledger, not only what settled since the last read (manual "sync now" with ?full=1; also once a day) */
  full?: boolean;
  /** an app run is written from its own figure once it finished this long ago and no engine row can be tied to it (ledger readable) */
  appGraceMinutes?: number;
}

const INCREMENTAL_MAX = 50_000;
const FULL_MAX = 200_000;
const READ_TIMEOUT_MS = 120_000;
const DAY_MS = 86_400_000;

/** the engine's settled rows; `since` reads only what settled from then on (sorted by settled_at), null reads them all */
async function readEngineLedger(since: string | null): Promise<LedgerRow[]> {
  const filters: { columnName: string; condition: 'eq' | 'gte'; value: string }[] = [{ columnName: 'status', condition: 'eq', value: 'done' }];
  if (since) filters.push({ columnName: 'settled_at', condition: 'gte', value: since });
  return Promise.race([
    n8nRows<LedgerRow>('runLedger', { filters, sortBy: since ? 'settled_at:asc' : 'created_at:asc', max: since ? INCREMENTAL_MAX : FULL_MAX, fresh: true }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timed out')), READ_TIMEOUT_MS).unref?.()),
  ]);
}

let running: Promise<SyncResult> | null = null;

/** One sync; a second call while one is going waits for it (and the advisory lock makes concurrent servers safe too). */
export function syncCosts(opts: SyncOptions = {}): Promise<SyncResult> {
  if (running) return running;
  running = doSync(opts).finally(() => {
    running = null;
  });
  return running;
}

/** the callbacks whose spend counts for their run (never a schedule's report that reuses an old run's request id), as SQL */
const countsForRun = sql`r.run_id is not null and r.stage not in (${sql.join(SCHEDULED_STAGES.map((s) => sql`${s}`), sql`, `)}) and coalesce(r.payload->>'on_demand', '') <> 'false'`;

async function doSync(opts: SyncOptions): Promise<SyncResult> {
  const grace = opts.appGraceMinutes ?? 60;
  const st0 = await settingsRow();
  const full = !!opts.full || !st0.ledgerFullAt || Date.now() - st0.ledgerFullAt.getTime() > DAY_MS || !st0.ledgerWatermark;
  const since = full ? null : new Date(new Date(st0.ledgerWatermark!).getTime() - DAY_MS).toISOString();
  let ledger: LedgerRow[] = [];
  let readable = true;
  let note = '';
  try {
    ledger = (await (opts.readLedger ?? readEngineLedger)(since)).filter((r) => str(r.run_id) && str(r.status) === 'done');
    note = `Read ${ledger.length} settled rows of the engine's run ledger (${full ? 'full read' : `settled since ${since}`}).`;
  } catch (err) {
    readable = false;
    note = `The engine's run ledger could not be read (${String((err as Error)?.message ?? err).slice(0, 120)}), so costs come from the app's own runs and keyword checks only; schedule costs are missing until it can be read.`;
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('alaventra.admin_cost_sync'))`);
    const res = { engineEvents: 0, appEvents: 0, keywordEvents: 0, superseded: 0, debits: 0 };
    const s = await settingsRow(tx);

    // ---- lookups ----
    const sites = await tx.select({ id: schema.sites.id, orgId: schema.sites.orgId, domain: schema.sites.domain, verifiedAt: schema.sites.verifiedAt }).from(schema.sites);
    const verified = sites.filter((x) => x.verifiedAt);
    const sitesByDomain = new Map(verified.map((x) => [x.domain.toLowerCase().replace(/^www\./, ''), { id: x.id, orgId: x.orgId, verifiedAt: x.verifiedAt! }]));
    const sitesByEngineId = new Map(verified.map((x) => [n8nSiteId(x.domain), { id: x.id, orgId: x.orgId, verifiedAt: x.verifiedAt! }]));
    const orgs = new Map((await tx.select({ id: schema.organizations.id, createdAt: schema.organizations.createdAt }).from(schema.organizations)).map((o) => [o.id, o.createdAt]));

    type Stored = Attribution & { eventKey: string; settledAt: string; total: number; detached: boolean; occurredAt: Date };
    const storedRows = await execRows<{ engine_run_id: string; event_key: string; org_id: string | null; site_id: string | null; user_id: string | null; run_id: string | null; origin: string; engine_settled_at: string; total: number; detached_from: string | null; occurred_at: string }>(
      tx,
      sql`select engine_run_id, event_key, org_id, site_id, user_id, run_id, origin, engine_settled_at, (claude_usd + dataforseo_usd)::float as total, detached_from, occurred_at
          from ${schema.costEvents} where engine_run_id is not null`,
    );
    const stored = new Map<string, Stored>(
      storedRows.map((r) => [
        r.engine_run_id,
        { orgId: r.org_id, siteId: r.site_id, userId: r.user_id, runId: r.run_id, origin: r.origin === 'app' ? 'app' : 'schedule', eventKey: r.event_key, settledAt: r.engine_settled_at, total: Number(r.total), detached: r.detached_from != null, occurredAt: new Date(r.occurred_at) },
      ]),
    );

    // engine execution ids → app runs: what the callbacks name (execution_id, run_ledger.run_id), then the runs' own request ids. Asked
    // for the ids of this read AND of the stored events not yet tied to a run (the back-fill).
    const ids = [
      ...new Set(
        [
          ...ledger.flatMap((r) => [str(r.run_id), str(r.key).startsWith('parent:') ? str(r.key).slice(7) : '']),
          ...storedRows.filter((r) => !r.run_id && r.detached_from == null).map((r) => r.engine_run_id),
        ].filter(Boolean),
      ),
    ];
    const runsByExec = new Map<string, RunRef>();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = sql.join(ids.slice(i, i + 500).map((c) => sql`${c}`), sql`, `);
      const viaCallbacks = await execRows<{ exec: string; id: string; org_id: string; site_id: string | null; user_id: string | null }>(
        tx,
        sql`select distinct x.exec, ru.id, ru.org_id, ru.site_id, ru.user_id from (
              select r.run_id, r.payload->>'execution_id' as exec from ${schema.reports} r where ${countsForRun} and r.payload->>'execution_id' in (${chunk})
              union select r.run_id, r.payload->'run_ledger'->>'run_id' as exec from ${schema.reports} r where ${countsForRun} and r.payload->'run_ledger'->>'run_id' in (${chunk})
            ) x join ${schema.runs} ru on ru.id = x.run_id`,
      );
      for (const r of viaCallbacks) if (!runsByExec.has(r.exec)) runsByExec.set(r.exec, { id: r.id, orgId: r.org_id, siteId: r.site_id, userId: r.user_id });
      const viaRequest = await execRows<{ id: string; org_id: string; site_id: string | null; user_id: string | null; request_id: string }>(
        tx,
        sql`select id, org_id, site_id, user_id, request_id from ${schema.runs} where request_id in (${chunk}) order by created_at asc`,
      );
      for (const r of viaRequest) if (!runsByExec.has(r.request_id)) runsByExec.set(r.request_id, { id: r.id, orgId: r.org_id, siteId: r.site_id, userId: r.user_id });
    }
    const lk: Lookups = { runsByExec, sitesByDomain, sitesByEngineId, orgs, stored };
    const batch = new Map(ledger.map((r) => [str(r.run_id), r]));

    const debitedSoFar = async (eventKey: string) => {
      const [d] = await execRows<{ c: number; n: number }>(
        tx,
        sql`select coalesce(-sum(credits), 0)::float as c, count(*)::int as n from ${schema.creditLedger} where ref_key = ${'cost:' + eventKey} or ref_key like ${'cost:' + eventKey + ':%'}`,
      );
      return { credits: Number(d?.c ?? 0), entries: Number(d?.n ?? 0) };
    };
    const relink = async (engineRunId: string, prev: Stored, a: Attribution) => {
      await tx
        .update(schema.costEvents)
        .set({ orgId: a.orgId, siteId: a.siteId, userId: a.userId, runId: a.runId, origin: a.origin, syncedAt: new Date() })
        .where(eq(schema.costEvents.engineRunId, engineRunId));
      stored.set(engineRunId, { ...prev, ...a });
    };

    // ---- 1. engine rows: new ones stored, stored ones linked to their run or re-priced when settled again ----
    for (const row of ledger) {
      if (isAppKeywordCheckRow(row)) continue;
      const engineRunId = str(row.run_id);
      const a = attributeLedgerRow(row, lk, batch);
      const c = engineCost(row);
      const settledAt = str(row.settled_at);
      const prev = stored.get(engineRunId);
      if (prev) {
        if (prev.detached) continue; // its company was deleted: it stays unattributed
        // tied to a run now (its callback arrived after the first read), or to a company for the first time
        if ((!prev.runId && a.runId && (!prev.orgId || prev.orgId === a.orgId)) || (!prev.orgId && a.orgId)) await relink(engineRunId, prev, a);
        const total = r6(c.claudeUsd + c.dataforseoUsd);
        if (settledAt && settledAt > prev.settledAt && Math.abs(total - prev.total) > 1e-6) {
          // settled again with a different figure: the event follows it, and the credits already used are corrected by the difference
          await tx.update(schema.costEvents).set({ ...c, engineSettledAt: settledAt, occurredAt: occurredOf(row), syncedAt: new Date() }).where(eq(schema.costEvents.engineRunId, engineRunId));
          const now = stored.get(engineRunId)!;
          stored.set(engineRunId, { ...now, settledAt, total });
          const done = await debitedSoFar(prev.eventKey);
          if (now.orgId && done.entries > 0) {
            const delta = Math.round((creditsFor(total, s) - done.credits) * 100) / 100;
            if (delta !== 0)
              await addCreditEntry(tx, {
                orgId: now.orgId,
                kind: 'usage',
                credits: -delta,
                note: `Re-priced: the engine settled this ${str(row.mode).replace(/_/g, ' ') || 'run'} again`,
                ref: { runId: now.runId, engineRunId, mode: str(row.mode) || null, domain: str(row.domain) || null, creditValueUsd: s.creditValueUsd },
                refKey: `cost:${prev.eventKey}:${settledAt}`,
                at: occurredOf(row),
              });
          }
        }
        continue;
      }
      const ins = await tx
        .insert(schema.costEvents)
        .values({
          eventKey: `engine:${engineRunId}`,
          source: 'engine',
          engineRunId,
          runId: a.runId,
          orgId: a.orgId,
          siteId: a.siteId,
          userId: a.userId,
          domain: str(row.domain).toLowerCase(),
          mode: str(row.mode),
          origin: a.origin,
          engineKey: str(row.key).slice(0, 200),
          ...c,
          balanceBefore: Math.max(0, num(row.dfs_balance) ?? 0),
          balanceAfter: Math.max(0, num(row.dfs_balance_end) ?? 0),
          startedAt: date(row.created_at, row.createdAt),
          occurredAt: occurredOf(row),
          engineSettledAt: settledAt,
        })
        .onConflictDoNothing()
        .returning({ id: schema.costEvents.id });
      if (ins.length) {
        res.engineEvents++;
        stored.set(engineRunId, { ...a, eventKey: `engine:${engineRunId}`, settledAt, total: r6(c.claudeUsd + c.dataforseoUsd), detached: false, occurredAt: occurredOf(row) });
      }
    }

    // ---- 1b. back-fill: stored events not in this read whose run is known now ----
    for (const [engineRunId, prev] of stored) {
      if (prev.runId || prev.detached) continue;
      const run = runsByExec.get(engineRunId);
      if (run && (!prev.orgId || prev.orgId === run.orgId)) await relink(engineRunId, prev, fromRun(run));
    }

    // ---- 2. app runs the ledger does not cover ----
    const candidates = await execRows<{
      id: string; org_id: string; site_id: string | null; user_id: string | null; mode: string; input: Record<string, unknown>;
      actual_cost_usd: number; actual_cost_partial: boolean; actual_cost_estimated: boolean; completed_at: string | null; created_at: string; domain: string | null;
    }>(
      tx,
      sql`select r.id, r.org_id, r.site_id, r.user_id, r.mode, r.input, r.actual_cost_usd, r.actual_cost_partial, r.actual_cost_estimated,
            r.completed_at, r.created_at, s.domain
          from ${schema.runs} r left join ${schema.sites} s on s.id = r.site_id
          where r.actual_cost_usd is not null and r.status in ('completed', 'failed')
            and not exists (select 1 from ${schema.costEvents} e where e.run_id = r.id)
            ${readable ? sql`and coalesce(r.completed_at, r.created_at) < ${tsv(new Date(Date.now() - grace * 60_000))}` : sql``}
          order by r.created_at asc
          limit 2000`,
    );
    for (const r of candidates) {
      // the engine's figure is preferred: an engine row of this company that no callback tied to any run, started in this run's window
      const runStart = date(r.created_at)!;
      const runEnd = date(r.completed_at, r.created_at)!;
      const [orphan] = await execRows<{ engine_run_id: string }>(
        tx,
        sql`select engine_run_id from ${schema.costEvents}
            where source = 'engine' and run_id is null and detached_from is null and engine_key = ${'app:' + r.org_id}
              and coalesce(started_at, occurred_at) >= ${tsv(new Date(runStart.getTime() - 2 * 60_000))}
              and coalesce(started_at, occurred_at) <= ${tsv(new Date(runEnd.getTime() + 5 * 60_000))}
            order by coalesce(started_at, occurred_at) asc limit 1`,
      );
      if (orphan) {
        const prev = stored.get(orphan.engine_run_id);
        if (prev) await relink(orphan.engine_run_id, prev, { orgId: r.org_id, siteId: r.site_id, userId: r.user_id, runId: r.id, origin: 'app' });
        continue;
      }
      const reports = await tx.select({ stage: schema.reports.stage, payload: schema.reports.payload }).from(schema.reports).where(eq(schema.reports.runId, r.id));
      const c = splitAppRun(
        { mode: r.mode, input: r.input ?? {}, actualCostUsd: Number(r.actual_cost_usd), actualCostPartial: !!r.actual_cost_partial, actualCostEstimated: !!r.actual_cost_estimated },
        reports,
      );
      const ins = await tx
        .insert(schema.costEvents)
        .values({
          eventKey: `run:${r.id}`,
          source: 'app',
          runId: r.id,
          orgId: r.org_id,
          siteId: r.site_id,
          userId: r.user_id,
          domain: r.domain ?? '',
          mode: r.mode,
          origin: 'app',
          ...c,
          startedAt: runStart,
          occurredAt: runEnd,
        })
        .onConflictDoNothing()
        .returning({ id: schema.costEvents.id });
      if (ins.length) res.appEvents++;
    }

    // ---- 3. an engine figure replaces an app one for the same run (never both) ----
    const replaced = await execRows<{ id: string; event_key: string; org_id: string | null; occurred_at: string }>(
      tx,
      sql`select a.id, a.event_key, a.org_id, a.occurred_at from ${schema.costEvents} a
          where a.source = 'app' and a.run_id is not null
            and exists (select 1 from ${schema.costEvents} e where e.source = 'engine' and e.run_id = a.run_id)`,
    );
    for (const r of replaced) {
      const done = await debitedSoFar(r.event_key);
      if (r.org_id && done.credits !== 0)
        await addCreditEntry(tx, {
          orgId: r.org_id,
          kind: 'usage',
          credits: done.credits,
          note: "Re-priced: the engine's own figure replaced the app's for this run",
          ref: { runId: null, engineRunId: null, mode: null, domain: null },
          refKey: `reprice:${r.event_key}`,
          at: date(r.occurred_at) ?? undefined,
        });
      await tx.delete(schema.costEvents).where(eq(schema.costEvents.id, r.id));
      res.superseded++;
    }

    // ---- 4. keyword checks ----
    const checks = await execRows<{ id: string; org_id: string; site_id: string | null; user_id: string | null; cost_usd: number; created_at: string; reported: boolean; domain: string | null }>(
      tx,
      sql`select k.id, k.org_id, k.site_id, k.user_id, k.cost_usd, k.created_at, (k.result ? 'cost_usd') as reported, s.domain
          from ${schema.keywordChecks} k left join ${schema.sites} s on s.id = k.site_id
          where k.status = 'done' and not exists (select 1 from ${schema.costEvents} e where e.event_key = 'kc:' || k.id::text)
          limit 5000`,
    );
    for (const k of checks) {
      const c = splitKeywordCheck(Number(k.cost_usd), !!k.reported);
      const ins = await tx
        .insert(schema.costEvents)
        .values({
          eventKey: `kc:${k.id}`,
          source: 'keyword_check',
          orgId: k.org_id,
          siteId: k.site_id,
          userId: k.user_id,
          domain: k.domain ?? '',
          mode: 'keyword_check',
          origin: 'app',
          ...c,
          startedAt: date(k.created_at),
          occurredAt: date(k.created_at) ?? new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: schema.costEvents.id });
      if (ins.length) res.keywordEvents++;
    }

    // ---- 5. credits: one usage debit per event of a company, once; from the deploy of credits on, never for money spent before the
    //      company existed; an event too small to round to 0.01 credit is not looked at again and again ----
    const minCost = (0.005 * s.creditValueUsd) / s.markup;
    const toDebit = await execRows<{ event_key: string; org_id: string; run_id: string | null; engine_run_id: string | null; mode: string; domain: string; total: number; occurred_at: string }>(
      tx,
      sql`select e.event_key, e.org_id, e.run_id, e.engine_run_id, e.mode, e.domain, (e.claude_usd + e.dataforseo_usd)::float as total, e.occurred_at
          from ${schema.costEvents} e join ${schema.organizations} o on o.id = e.org_id
          where (e.claude_usd + e.dataforseo_usd) >= ${minCost} and e.occurred_at >= ${tsv(s.creditsSince)} and e.occurred_at >= o.created_at
            and not exists (select 1 from ${schema.creditLedger} c where c.ref_key = 'cost:' || e.event_key)`,
    );
    for (const e of toDebit) {
      const credits = creditsFor(Number(e.total), s);
      if (credits <= 0) continue;
      const row = await addCreditEntry(tx, {
        orgId: e.org_id,
        kind: 'usage',
        credits: -credits,
        note: e.mode ? `Used by ${e.mode.replace(/_/g, ' ')}${e.domain ? ` · ${e.domain}` : ''}` : 'Used',
        ref: { runId: e.run_id, engineRunId: e.engine_run_id, mode: e.mode || null, domain: e.domain || null, creditValueUsd: s.creditValueUsd },
        refKey: `cost:${e.event_key}`,
        at: date(e.occurred_at) ?? undefined,
      });
      if (row) res.debits++;
    }

    // ---- sync state: the newest settled_at read becomes the next read's watermark ----
    let watermark = s.ledgerWatermark ?? '';
    for (const r of ledger) {
      const v = str(r.settled_at);
      if (v && !Number.isNaN(Date.parse(v)) && v > watermark) watermark = v;
    }
    const total = await execRows<{ n: number }>(tx, sql`select count(*)::int as n from ${schema.costEvents} where source = 'engine'`);
    await tx
      .update(schema.platformSettings)
      .set({
        ledgerSyncedAt: new Date(),
        ledgerSyncOk: readable,
        ledgerSyncNote: note.slice(0, 500),
        ledgerRows: Number(total[0]?.n ?? 0),
        ...(readable && watermark ? { ledgerWatermark: watermark } : {}),
        ...(readable && full ? { ledgerFullAt: new Date() } : {}),
      })
      .where(eq(schema.platformSettings.id, 1));
    return res;
  });
  return { ok: true, ledgerReadable: readable, ledgerRows: ledger.length, note, ...result };
}


/** The cost sync timer (every 10 minutes, first a minute after start). ADMIN_COST_SYNC=false stops it. */
export function startCostSync(log: { warn: (o: object, m: string) => void; info: (o: object, m: string) => void }): () => void {
  const tick = () =>
    syncCosts()
      .then((r) => (r.engineEvents || r.appEvents || r.keywordEvents) && log.info({ ...r, note: undefined }, 'admin cost sync'))
      .catch((err) => log.warn({ err: String(err) }, 'admin cost sync failed'));
  const first = setTimeout(() => void tick(), 60_000);
  const every = setInterval(() => void tick(), 10 * 60_000);
  first.unref?.();
  every.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
