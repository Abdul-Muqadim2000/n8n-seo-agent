import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import {
  aiRankAddressCheck,
  aiRankAddressNeed,
  aiRankPageNames,
  aiRankReportOf,
  aiRankSettingsOf,
  type AiRankActionRow,
  bingSourceText,
  type BingCheck,
  cleanDomain,
  deriveSiteTasks,
  indexImprovementsOf,
  indexMergePairs,
  indexMergeVerdict,
  isSiteRoot,
  type SiteTaskPairCheck,
  mergePairsOf,
  type ContentLogRow,
  type LadderRow,
  googleStillSees,
  indexingCauseOfKey,
  indexingCauseReadings,
  indexingLinksReading,
  indexingPageFixed,
  indexSitemapState,
  indexSitemapSubmitOn,
  INDEX_TASK_KINDS,
  INDEXING_LINKS_MAX_PAIRS,
  linkPairsOf,
  pageLinksTo,
  challengePage,
  INDEXING_CHECK_MAX_URLS,
  INDEXING_FETCHES_PAGES,
  INDEXING_NEEDS_SITEMAP,
  INDEXING_SITEMAP_KEY,
  INDEX_SITE_FIX_CAUSES,
  indexingSitemapReading,
  indexingSitemapDatesReading,
  sitemapDateEntries,
  sitemapDatesGood,
  sitemapDatesLine,
  indexRunOf,
  isSitemapIndex,
  n8nSiteId,
  robotsBlocked,
  robotsFileState,
  type IndexingPageVerdict,
  safeJson,
  samePageUrl,
  sitemapLocs,
  siteTaskPayload,
  type AiGrowthRow,
  type IndexPageRow,
  type IndexRunRow,
  type MonitorsRow,
  type AiVisibilityRow,
  type SiteTask,
  type SiteTaskCheck,
  type SiteTaskCheckBy,
  type SiteTaskInputs,
  type SiteTaskKind,
  type StoredSiteTask,
} from '@seo/shared';
import { requireVerified, type SiteAccess } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, SiteRow, SiteTaskRow } from '../db/schema';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { rows as n8nRows, siteRows, updateRows, upsertRow } from '../n8n/client';
import { audit } from './audit';
import { fetchPublicOnce, fetchPublicText, publicHttpsHost } from './verify';
import { checkBingAccess } from './bingCheck';

/** what this module logs through: a request's or the app's logger, or the callback's delivery log */
type Log = { warn: (o: object, msg: string) => void };

// Steps on your website (app/docs/SITE_TASKS.md, 2026-10-28). The rule for what a step is and whether it is done lives in
// shared/src/site-tasks.ts; this module feeds it the engine's readings and the stored rows, runs each step's own check on the client's
// website, stores what the app saw, and keeps checking every day so a client on autopilot who never presses a button still sees "Done"
// once the change is made, and sees it reopened if it is undone.

const DAY = 864e5;
/** websites being read right now (the client's check and the daily job never read one website at the same time) */
const inFlight = new Set<string>();
/** a daily check that misses a done step looks again this much later; only the second miss reopens it */
const MISS_RECHECK_MS = 60 * 60 * 1000;
/** one check may take this long at most (a website that trickles its answer must not hold the daily job) */
const CHECK_DEADLINE_MS = 45_000;

// ---------------------------------------------------------------- the engine's readings (three small reads, not the whole dashboard)

type P = Record<string, unknown>;
const arrOf = (v: unknown): P[] => (Array.isArray(v) ? (v as P[]) : []);
const s = (v: unknown) => (v == null ? '' : String(v));

/**
 * The latest AI growth run (the IndexNow key and whether the file was found), the newest AI visibility run that read crawler access,
 * and the latest FULL backlink report (the weekly light watch does not look for broken pages, so its silence would read as "fixed").
 */
/** LADDER PACKAGE (review H5): the old address of a ladder main page that moved, once the page is live there (pure; tested) */
export function ladderMovesOf(rows: readonly (Pick<LadderRow, 'status' | 'target_why' | 'target_url' | 'updatedAt'> & { keyword?: string })[]): { url: string; to: string; at: string }[] {
  const out: { url: string; to: string; at: string }[] = [];
  const key = (u: string) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  for (const r of rows) {
    const m = String(r.target_why ?? '').match(/^moved from (https?:\/\/[^\s:]+(?::\d+)?[^\s:]*):/);
    if (String(r.status ?? '') !== 'published' || !m || !r.target_url) continue;
    // prod 2026-11-10: never ask a client to redirect their home page (a main page planned as an update of it is a page of its own)
    if (isSiteRoot(m[1])) continue;
    // re-review N1: never a redirect from an address another ladder page holds (it may be a live rung page)
    if (rows.some((o) => o !== r && key(String(o.target_url ?? '')) === key(m[1]) && String(o.status ?? '') !== 'merged')) continue;
    out.push({ url: m[1], to: String(r.target_url), at: String(r.updatedAt ?? '') });
  }
  return out;
}

export async function engineReadings(org: Pick<OrgRow, 'id'>, site: Pick<SiteRow, 'id' | 'domain'>): Promise<SiteTaskInputs> {
  const d = site.domain;
  const [growth, vis, full, indexing, merges, air] = await Promise.all([
    siteRows<AiGrowthRow>('aiGrowth', d, { sortBy: 'checked_at:desc', max: 1 }).catch(() => [] as AiGrowthRow[]),
    siteRows<AiVisibilityRow>('aiVisibility', d, { sortBy: 'checked_at:desc', max: 10 }).catch(() => [] as AiVisibilityRow[]),
    db.query.reports.findFirst({
      where: and(eq(schema.reports.orgId, org.id), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'backlinks'), sql`${schema.reports.payload}->>'mode' = 'full'`),
      orderBy: desc(schema.reports.receivedAt),
      columns: { payload: true, receivedAt: true },
    }),
    indexingReading(d),
    // 2026-11-05: improvements the client confirmed at another address than the page they update (null: not read, a stored step stands)
    Promise.all([
      siteRows<ContentLogRow>('contentLog', d, { extra: [{ columnName: 'status', condition: 'eq', value: 'published' }], max: 1000 }),
      // LADDER PACKAGE (review H5, 2026-11-10): a ladder's main page moved off an address that did not rank (a blog address, a "-2" copy) asks
      // the client to redirect the old address once the main page is live: its row's target_why says "moved from <old>" and it is published
      siteRows<LadderRow>('ladders', d, { max: 2000 }).catch(() => [] as LadderRow[]),   // every row: a moved main page never asks to redirect another ladder page's address
    ])
      .then(([xs, ls]) => ({ pairs: indexMergePairs([...indexImprovementsOf(xs), ...ladderMovesOf(ls)]) }))
      .catch(() => null),
    aiRankReading(org, site),
  ]);
  const g = growth[0];
  const inx = g ? ((safeJson<P>(s(g.submitted_json), {}).indexnow ?? {}) as P) : {};
  const keyUrl = s(inx.key_url);
  const key = (keyUrl.match(/\/([a-f0-9]{32})\.txt$/) || [])[1] || '';
  const accessRow = vis.find((v) => s((v as unknown as P).access_json).length > 2);
  const acc = accessRow ? safeJson<P>(s((accessRow as unknown as P).access_json), {}) : null;
  const rp = (full?.payload ?? null) as P | null;
  return {
    domain: cleanDomain(d),
    indexnow: g && key ? { keyUrl, key, verified: inx.verified === true || inx.verified === 'true', checkedAt: s(g.checked_at) } : null,
    access: acc
      ? {
          checkedAt: s(acc.checked_at) || s((accessRow as unknown as P).checked_at),
          bots: arrOf(acc.bots).map((b) => ({
            bot: s(b.bot),
            owner: s(b.owner),
            group: s(b.group) === 'training' ? ('training' as const) : ('answer' as const),
            // the stored row says `allowed` (AI_Metrics.js); the crawler node's own output `allowed_root`
            allowed: (b.allowed_root ?? b.allowed) === true || (b.allowed_root ?? b.allowed) === 'true',
            rule: s(b.rule),
            blockedPaths: Array.isArray(b.blocked_paths) ? b.blocked_paths.map(String) : [],
          })),
        }
      : null,
    reclaim: rp && full
      ? { receivedAt: full.receivedAt.toISOString(), items: arrOf(rp.reclaim).map((r) => ({ brokenUrl: s(r.broken_url), redirectTo: s(r.redirect_to), links: Number(r.links) || 0, domains: Array.isArray(r.domains) ? r.domains.map(String) : [] })) }
      : null,
    indexing,
    merges,
    aiRank: air.aiRank,
    aiExport: air.aiExport,
  };
}

/**
 * AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §6.7): a website in AI ranking's `on` mode gets the plan's human steps (the newest
 * ai_growth report's `ai_rank.steps`, each action's status from the engine's own table) and the monthly ask for the two AI reports (this
 * month's uploads, read from the app's own upload table). Off, the trial, an engine from before AI ranking or a failed read: both null, so
 * nothing is shown and a stored step keeps its last state.
 */
async function aiRankReading(org: Pick<OrgRow, 'id'>, site: Pick<SiteRow, 'id' | 'domain'>): Promise<Pick<SiteTaskInputs, 'aiRank' | 'aiExport'>> {
  const none = { aiRank: null, aiExport: null };
  try {
    const mons = await siteRows<MonitorsRow>('monitors', site.domain, { max: 5 });
    if (aiRankSettingsOf(mons[0] as unknown as P).mode !== 'on') return none;
    const month = new Date().toISOString().slice(0, 7);
    const lastOf = (source: string) =>
      siteRows<P>('aiImports', site.domain, { extra: [{ columnName: 'source', condition: 'eq', value: source }], sortBy: 'imported_at:desc', max: 1 })
        .then((xs) => s(xs[0]?.imported_at).slice(0, 7) === month)
        .catch(() => false);
    const [report, actions, bing, gsc] = await Promise.all([
      db.query.reports.findFirst({
        where: and(eq(schema.reports.orgId, org.id), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'ai_growth')),
        orderBy: desc(schema.reports.receivedAt),
        columns: { payload: true, receivedAt: true },
      }),
      siteRows<AiRankActionRow>('aiRankActions', site.domain, { sortBy: 'updated_at:desc', max: 300 }).catch(() => [] as AiRankActionRow[]),
      lastOf('bing_ai'),
      lastOf('gsc_ai'),
    ]);
    const r = aiRankReportOf(report?.payload);
    const statusOf: Record<string, string> = {};
    for (const a of actions) if (s(a.action_id) && !(s(a.action_id) in statusOf)) statusOf[s(a.action_id)] = s(a.status);
    const at = r?.checkedAt || report?.receivedAt.toISOString() || new Date().toISOString();
    return { aiRank: { checkedAt: at, steps: r?.steps ?? [], statusOf }, aiExport: { month, bing, gsc, checkedAt: new Date().toISOString() } };
  } catch {
    return none;
  }
}

/** A6: the most rows one cause's read takes (sorted by impressions, so the pages a step lists are the right ones); a read that hits it is
 *  marked incomplete and never concludes "none any more" or "all fixed". One n8n page per cause. */
const INDEXING_CAUSE_READ_MAX = 200;
/** A15: the whole index reading must fit in this (the Pipeline, the Overview and Recommendations wait on it); late = no reading */
const INDEXING_READ_DEADLINE_MS = 8_000;

/**
 * Index coverage (2026-10-29, fix wave 1): the engine's daily index check, as the steps need it. Small bounded reads by the engine's site
 * id (the table is keyed by it; rows of another domain that shares the id are dropped): the newest runs (5), then ONE read per site-fix
 * cause the newest run that read the website counted (by `by_cause_json`), each sorted by impressions and capped (A6). The whole reading
 * has a deadline (A15). A failure or a late answer is null: a step already stored keeps its last state, and the other steps still read.
 */
async function indexingReading(domain: string): Promise<SiteTaskInputs['indexing']> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), INDEXING_READ_DEADLINE_MS);
  });
  try {
    return await Promise.race([readIndexing(domain).catch(() => null), late]);
  } finally {
    clearTimeout(timer);
  }
}

async function readIndexing(domain: string): Promise<SiteTaskInputs['indexing']> {
  const sid = n8nSiteId(domain);
  const mine = <T extends { domain?: string }>(xs: T[]) => xs.filter((r) => !r.domain || cleanDomain(r.domain) === cleanDomain(domain));
  const bySite = { columnName: 'site_id', condition: 'eq' as const, value: sid };
  const runs = mine(await n8nRows<IndexRunRow>('indexRuns', { filters: [bySite], sortBy: 'run_at:desc', max: 5 }));
  // the newest run that read the website (a run that could not read Search Console says nothing about any page)
  const good = runs.map(indexRunOf).find((r) => r.runAt && !r.failed && !r.reservation);
  if (!good) return null;
  const counted = INDEX_SITE_FIX_CAUSES.filter((c) => (good.byCause[c] ?? 0) > 0);
  // a run with no cause counts at all (an older row) is not trusted to say "none": every cause is read then
  const causes = Object.keys(good.byCause).length ? counted : [...INDEX_SITE_FIX_CAUSES];
  // N-app-2: a cause's read takes only the rows a step is about: `site_fix` (to fix) and `wait` (fixed on the site, waiting for Google),
  // never the pages of that cause left out on purpose, which could fill the capped read and hide every page to fix. The `wait` read is
  // skipped when the run counted no page waiting at all.
  const actions: ('site_fix' | 'wait')[] = Object.keys(good.byAction).length && !(good.byAction.wait > 0) ? ['site_fix'] : ['site_fix', 'wait'];
  const plan = causes.flatMap((c) => actions.map((a) => ({ c, a })));
  // wave 2 (DESIGN_WAVE2 §3.2): the pages that need a link (one read, skipped when the run counted none) and the sitemap switch
  const wantLinks = !Object.keys(good.byAction).length || (good.byAction.links ?? 0) > 0;
  const [reads, linkRows, monitors] = await Promise.all([
    Promise.all(
      plan.map(({ c, a }) =>
        n8nRows<IndexPageRow>('indexPages', {
          filters: [bySite, { columnName: 'cause', condition: 'eq', value: c }, { columnName: 'action', condition: 'eq', value: a }],
          sortBy: 'impressions_28d:desc',
          max: INDEXING_CAUSE_READ_MAX,
        }),
      ),
    ),
    wantLinks
      ? n8nRows<IndexPageRow>('indexPages', { filters: [bySite, { columnName: 'action', condition: 'eq', value: 'links' }], sortBy: 'impressions_28d:desc', max: INDEXING_CAUSE_READ_MAX })
      : Promise.resolve([] as IndexPageRow[]),
    siteRows<MonitorsRow>('monitors', domain, { max: 5 }).catch(() => [] as MonitorsRow[]),
  ]);
  // a read that hit the cap makes its cause incomplete: never "none any more" or "all fixed" from it (A6)
  const capped = new Set(plan.filter((_, i) => reads[i].length >= INDEXING_CAUSE_READ_MAX).map((x) => x.c));
  const submitOn = indexSitemapSubmitOn(monitors[0]?.index_sitemap_submit);
  const smState = indexSitemapState(runs.map(indexRunOf), submitOn);
  return {
    runAt: good.runAt,
    causes: indexingCauseReadings(mine(reads.flat()), { capped, read: causes }),
    sitemap: indexingSitemapReading(runs),
    // wave 3 (DESIGN_WAVE3 §3.3): the newest run's sitemap date counts
    sitemapDates: indexingSitemapDatesReading(runs),
    links: indexingLinksReading(mine(linkRows), { runAt: good.runAt, capped: linkRows.length >= INDEXING_CAUSE_READ_MAX }),
    // wave 2 review W1: only when the engine says it WILL submit on its next run is the client not asked to (Full access alone is not
    // enough: the kill switch, no readable sitemap or a sitemap outside the property stop it); otherwise the step says why
    sitemapAuto: submitOn && smState.willSubmit,
    sitemapBlocked: submitOn ? smState.blocked : '',
  };
}

/** two payloads alike whatever their key order (Postgres jsonb stores keys in its own order) */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as P).sort().map((k) => [k, canon((v as P)[k])])) : v;
const samePayload = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// ---------------------------------------------------------------- stored rows

async function rowsOf(siteId: string): Promise<SiteTaskRow[]> {
  return db.select().from(schema.siteTasks).where(eq(schema.siteTasks.siteId, siteId));
}

async function storedOf(rows: SiteTaskRow[]): Promise<StoredSiteTask[]> {
  const ids = [...new Set(rows.map((r) => r.skippedBy).filter((x): x is string => !!x))];
  const names = ids.length ? new Map((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids))).map((u) => [u.id, u.name])) : new Map<string, string>();
  return rows.map((r) => ({
    key: r.taskKey,
    kind: r.kind,
    payload: r.payload ?? {},
    lastCheck: r.lastCheck ?? null,
    doneAt: r.doneAt?.toISOString() ?? null,
    skippedAt: r.skippedAt?.toISOString() ?? null,
    skippedBy: r.skippedBy ? (names.get(r.skippedBy) ?? 'a former member') : r.skippedAt ? 'someone' : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

interface TaskState {
  inputs: SiteTaskInputs;
  rows: SiteTaskRow[];
  stored: StoredSiteTask[];
  tasks: SiteTask[];
}

async function stateOf(org: Pick<OrgRow, 'id'>, site: Pick<SiteRow, 'id' | 'domain'>): Promise<TaskState> {
  const [inputs, rows] = await Promise.all([engineReadings(org, site), rowsOf(site.id)]);
  const stored = await storedOf(rows);
  return { inputs, rows, stored, tasks: deriveSiteTasks(inputs, stored) };
}

/**
 * Keeps a row for every step the website has (so the daily check can read it even when nobody opens the app) and refreshes a to-do
 * step's values when the engine's reading changed them (another crawler blocked). Never touches a done or skipped step's values: they
 * say what was fixed. New rows are checked in the background at once.
 */
async function materialize(org: OrgRow, site: SiteRow, st: TaskState, log?: Log): Promise<void> {
  if (!site.verifiedAt) return;
  const byKey = new Map(st.rows.map((r) => [r.taskKey, r]));
  const created: string[] = [];
  for (const t of st.tasks) {
    const p = siteTaskPayload(st.inputs, st.stored, t.key);
    const row = byKey.get(t.key);
    // N-app-4: the engine's index reading that decided an indexing step is kept on the row, so a late, failed or missing index read (the
    // 8 s deadline, an n8n error, days without a good run) leaves the step in its last known state instead of falling back to "to do".
    // `last_check_at` is not touched: it schedules the app's own daily check, which still runs.
    const keep = engineIndexReading(t, row);
    if (!p) {
      if (row && keep) await db.update(schema.siteTasks).set({ lastCheck: keep, ...(keep.ok ? { doneAt: whenOf(keep.at) } : {}), updatedAt: new Date() }).where(eq(schema.siteTasks.id, row.id));
      continue;
    }
    if (!row) {
      const ins = await db
        .insert(schema.siteTasks)
        .values({ orgId: org.id, siteId: site.id, taskKey: t.key, kind: p.kind, payload: p.payload, ...(keep ? { lastCheck: keep, ...(keep.ok ? { doneAt: whenOf(keep.at) } : {}) } : {}) })
        .onConflictDoNothing()
        .returning({ id: schema.siteTasks.id });
      if (ins.length) created.push(t.key);
      continue;
    }
    const set: Partial<typeof schema.siteTasks.$inferInsert> = {};
    if (t.state === 'todo' && !samePayload(row.payload, p.payload)) set.payload = p.payload;
    if (keep) {
      set.lastCheck = keep;
      if (keep.ok) set.doneAt = whenOf(keep.at);
    }
    if (Object.keys(set).length) await db.update(schema.siteTasks).set({ ...set, updatedAt: new Date() }).where(eq(schema.siteTasks.id, row.id));
  }
  if (created.length) void checkSiteNow(site.id, log).catch((err) => log?.warn({ err: String(err), site: site.id }, 'site task first check failed'));
}

/** The engine's index reading that decided an indexing step, when the row does not hold it yet (null: nothing to keep). Only a reading
 *  newer than the row's own, so an older engine reading never overwrites a newer check of the client's or of the app. */
const whenOf = (iso: string): Date => (Number.isFinite(Date.parse(iso)) ? new Date(iso) : new Date());
function engineIndexReading(t: SiteTask, row: SiteTaskRow | undefined): SiteTaskCheck | null {
  const c = t.lastCheck;
  if (!c || c.by !== 'index') return null;
  // wave 2: the links step keeps only the engine's "none left" (its "not checked yet" is about pairs our own check has not opened)
  if (t.kind !== 'indexing' && !(t.kind === 'index_links' && c.ok)) return null;
  const had = row?.lastCheck ?? null;
  if (had && (had.at > c.at || (had.at === c.at && had.ok === c.ok && had.by === c.by && had.message === c.message))) return null;
  return c;
}

/** The website's steps, for the Pipeline, Recommendations, the Overview and the tasks endpoint. */
export async function siteTasksOf(org: OrgRow, site: SiteRow, log?: Log): Promise<SiteTask[]> {
  const st = await stateOf(org, site);
  await materialize(org, site, st, log).catch((err) => log?.warn({ err: String(err), site: site.id }, 'site tasks could not be stored'));
  return st.tasks;
}

// ---------------------------------------------------------------- the checks (the client's own website only)

export interface CheckOutcome {
  ok: boolean;
  message: string;
  /** false: the website did not answer at all (a daily check does not record that as "not done") */
  reached: boolean;
  /** with reached false: the website answered, but not in a way that tells (a firewall, a sitemap read in part): nothing is recorded */
  unsure?: boolean;
  /** with reached false: only the engine's reading can decide this step (Search Console's own list of sitemaps) */
  engineOnly?: boolean;
  /** with reached false (N-app-7): every page we opened is fixed, but the step lists more than we open; the engine's daily reading decides
   *  the rest, so nothing is recorded (never a "done" for pages nobody checked, never a miss that reopens a step) */
  partial?: boolean;
  /** with reached false (R1): our fetch finds the step fixed, but Google read its pages again after a fix we saw and still sees the
   *  problem (the engine's `fix_failed_at`): only Google's next reading can close it, so nothing is recorded (never a daily "done") */
  googleSees?: boolean;
  /** with reached false (RC-3, AIR): the step is checked on an address the client gives, and none was given: the client is asked for it */
  needsAddress?: boolean;
  /** prod 2026-11-10 (`index_merge`): each pair's own result, stored with the reading (the Content page says "Moved" for the done ones) */
  pairs?: SiteTaskPairCheck[];
}

const hostOf = (url: string) => cleanDomain(url.match(/^https?:\/\/([^/?#:]+)/i)?.[1] ?? '');
const onSite = (url: string, domain: string) => hostOf(url) === cleanDomain(domain);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const shortPath = (url: string) => url.replace(/^https?:\/\/[^/]+/i, '') || '/';

async function checkIndexnow(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const keyUrl = str(payload.keyUrl);
  const m = keyUrl.match(/^https:\/\/([^/]+)\/([a-f0-9]{32})\.txt$/);
  if (!m || !onSite(keyUrl, domain)) return { ok: false, reached: true, message: 'The file address is not on your website, so there is nothing we can check yet.' };
  const r = await fetchPublicText(keyUrl, 4096).catch(() => null);
  if (!r) return { ok: false, reached: false, message: `We could not open ${keyUrl} (no answer from the website).` };
  if (r.status === 200 && r.text.trim() === m[2]) return { ok: true, reached: true, message: 'The file is in place and holds the key.' };
  if (r.status === 200) return { ok: false, reached: true, message: 'The address answers, but the file does not contain only the key.' };
  return { ok: false, reached: true, message: `The address answers ${r.status}: the file is not there yet.` };
}

async function checkCrawlers(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const bots = (Array.isArray(payload.bots) ? (payload.bots as Record<string, unknown>[]) : []).map((b) => ({ bot: str(b.bot), paths: Array.isArray(b.paths) ? b.paths.map(String) : ['/'] })).filter((b) => b.bot);
  if (!bots.length) return { ok: true, reached: true, message: 'No AI search crawler is listed as blocked.' };
  const url = `https://${cleanDomain(domain)}/robots.txt`;
  const r = await fetchPublicText(url, 512 * 1024).catch(() => null);
  if (!r) return { ok: false, reached: false, message: `We could not open ${url} (no answer from the website).` };
  // the engine's rules (v5/code/AI_Access.js): a server error means "do not crawl"; a missing file or an HTML page blocks nothing
  if (r.status >= 500) return { ok: false, reached: true, message: `robots.txt answers ${r.status}. Crawlers read a server error as "do not crawl anything", so make it answer 200 (or 404 when you have no rules).` };
  const found = r.status >= 200 && r.status < 300 && !/<html/i.test(r.text.slice(0, 500));
  const blocked = found ? bots.flatMap((b) => robotsBlocked(r.text, [b.bot], b.paths)) : [];
  if (!blocked.length) return { ok: true, reached: true, message: found ? 'robots.txt lets every AI search crawler read your pages.' : 'There is no robots.txt rule left that blocks the AI search crawlers.' };
  const first = blocked.slice(0, 3).map((b) => `${b.bot} from ${b.path} (${b.rule})`).join('; ');
  return { ok: false, reached: true, message: `robots.txt still blocks ${first}${blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}.` };
}

async function checkRedirect(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const broken = str(payload.brokenUrl).replace(/^http:\/\//i, 'https://');
  if (!/^https:\/\//i.test(broken) || !onSite(broken, domain)) return { ok: false, reached: true, message: 'The old address is not on your website, so there is nothing we can check.' };
  const first = await fetchPublicOnce(broken).catch(() => null);
  if (!first) return { ok: false, reached: false, message: `We could not open ${broken} (no answer from the website).` };
  if (first.status >= 200 && first.status < 300) return { ok: true, reached: true, message: 'The old address opens a page again.' };
  if (first.status >= 300 && first.status < 400 && first.location) {
    const to = first.location;
    if (first.status === 302 || first.status === 303 || first.status === 307)
      return { ok: false, reached: true, message: `It redirects to ${shortPath(to)}, but with a temporary ${first.status}. Change it to a permanent 301 and check again.` };
    const end = await fetchPublicText(to, 64 * 1024).catch(() => null);
    if (!end) return { ok: false, reached: false, message: `It redirects permanently to ${to}, which did not answer.` };
    if (!onSite(end.finalUrl, domain)) return { ok: false, reached: true, message: `It redirects to another website (${hostOf(end.finalUrl)}). The links only keep their value on a page of ${cleanDomain(domain)}.` };
    if (end.status !== 200) return { ok: false, reached: true, message: `It redirects permanently to ${shortPath(end.finalUrl)}, but that page answers ${end.status}.` };
    return { ok: true, reached: true, message: `It redirects permanently to ${shortPath(end.finalUrl)}, which opens.` };
  }
  return { ok: false, reached: true, message: `The old address still answers ${first.status}.` };
}

/**
 * 2026-11-05: each old address and its improved version are one page again (indexMergeVerdict: the old one redirects permanently to the
 * new one, or the new one is gone / redirects back). Only addresses on the client's own host are opened; nothing that did not answer is
 * concluded.
 */
async function checkMerge(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const pairs = mergePairsOf(payload).filter((x) => onSite(x.from, domain) && onSite(x.to, domain));
  if (!pairs.length) return { ok: false, reached: true, message: 'None of these addresses is on your website, so there is nothing we can check.' };
  const out = await Promise.all(
    pairs.map(async (x) => {
      let from = x.from.replace(/^http:\/\//i, 'https://');
      const to = x.to.replace(/^http:\/\//i, 'https://');
      // the stored form of the old address can differ from the live one (www or not, a trailing slash): a redirect that only moves to
      // ANOTHER FORM OF THE SAME PAGE is followed first (up to 3 hops), never read as the step's redirect
      let first = await fetchPublicOnce(from).catch(() => null);
      for (let hop = 0; hop < 3 && first && first.status >= 300 && first.status < 400 && first.location && samePageUrl(first.location, from) && first.location !== from && onSite(first.location, domain); hop++) {
        from = first.location;
        first = await fetchPublicOnce(from).catch(() => null);
      }
      const moved = !!first && first.status >= 300 && first.status < 400 && !!first.location;
      const end = moved ? await fetchPublicText(first!.location!, 64 * 1024).catch(() => null) : null;
      let other = first && first.status >= 200 && first.status < 300 ? await fetchPublicOnce(to).catch(() => null) : null;
      // the same for the improved version's own address (its redirect back to the old page is what counts, not a host or slash move)
      for (let hop = 0; hop < 3 && other && other.status >= 300 && other.status < 400 && other.location && samePageUrl(other.location, to) && onSite(other.location, domain); hop++)
        other = await fetchPublicOnce(other.location).catch(() => null);
      return indexMergeVerdict({ from, to }, first, end ? { status: end.status, finalUrl: end.finalUrl } : null, other);
    }),
  );
  // the stored pair (not the form we followed it to), with what we found: a pair that did not answer is not done
  const each: SiteTaskPairCheck[] = pairs.map((x, i) => ({ from: x.from, to: x.to, done: out[i].done }));
  const open = out.filter((v) => !v.done);
  if (open.some((v) => !v.reached) && !open.some((v) => v.reached)) return { ok: false, reached: false, message: open.map((v) => v.message).join(' ') };
  if (!open.length) return { ok: true, reached: true, message: out.map((v) => v.message).join(' '), pairs: each };
  return { ok: false, reached: true, message: open.map((v) => v.message).join(' '), pairs: each };
}

/** A website's sitemap addresses and whether the whole tree was read (FIX_CONTRACT decision 2, A1). */
export interface SitemapRead {
  urls: Set<string>;
  /** every sitemap listed (robots.txt `Sitemap:` lines, /sitemap.xml, the children of an index) was an XML list we read in full */
  complete: boolean;
  /** wave 3 (DESIGN_WAVE3 §3.3): the addresses read, how many carry a `<lastmod>` and how many distinct days (each address counted once) */
  dates: { urls: number; withLastmod: number; distinct: number };
}
/** caps of one read (the whole check must fit inside 45 s; nothing but the addresses is kept, A27) */
const SITEMAP_ROOTS = 5;
const SITEMAP_CHILDREN = 12;
const SITEMAP_URLS = 50_000;
const SITEMAP_BYTES = 4 * 1024 * 1024;
/** A27: one sitemap download per website per check round (the daily job checks every sitemap step of a website from one read) */
const SITEMAP_CACHE_MS = 30 * 60_000;
const sitemapCache = new Map<string, { at: number; read: Promise<SitemapRead | null> }>();

/** The website's sitemap, from the cache of this check round unless `fresh` (a person's "check now" reads it again). */
export function sitemapOf(domain: string, opts: { fresh?: boolean } = {}): Promise<SitemapRead | null> {
  const d = cleanDomain(domain);
  const now = Date.now();
  for (const [k, v] of sitemapCache) if (now - v.at > SITEMAP_CACHE_MS) sitemapCache.delete(k);
  const hit = sitemapCache.get(d);
  if (hit && !opts.fresh) return hit.read;
  const read = readSitemap(d).catch(() => null);
  sitemapCache.set(d, { at: now, read });
  while (sitemapCache.size > 50) sitemapCache.delete(sitemapCache.keys().next().value as string);
  return read;
}
/** For tests: forget the cached sitemaps. */
export const forgetSitemaps = () => sitemapCache.clear();

/**
 * Reads robots.txt `Sitemap:` lines and /sitemap.xml, follows an index one level, and says whether the tree was read in full: a listed
 * sitemap that fails, answers an HTML page, is cut at the size cap, is compressed, lives on another host, or one more child than the cap
 * makes it partial. null: no sitemap at all could be read.
 */
async function readSitemap(d: string): Promise<SitemapRead | null> {
  const robots = await fetchPublicText(`https://${d}/robots.txt`, 256 * 1024, 4, { headers: true }).catch(() => null);
  // N-app-11: an answer that ended on another website (a redirect off the host) is not this website's robots.txt
  const robotsState = robots && onSite(robots.finalUrl, d) ? robotsFileState(robots.status, robots.text, String(robots.headers?.['content-type'] ?? '')) : 'unreadable';
  const listed = robots && robotsState === 'rules' ? [...robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1].replace(/^http:\/\//i, 'https://')) : [];
  const onSiteListed = [...new Set(listed.filter((u) => onSite(u, d)))];
  // N-app-3: the list of sitemaps is known only from a robots.txt read as rules, or one that is not there (404 / 410); a robots.txt that
  // answered a firewall, a login, a web page, a server error or nothing may name sitemaps we never saw, so /sitemap.xml alone is partial
  let complete = (robotsState === 'rules' || robotsState === 'none') && onSiteListed.length === listed.length && onSiteListed.length <= SITEMAP_ROOTS;
  const fallback = `https://${d}/sitemap.xml`;
  const roots = [...new Set([...onSiteListed.slice(0, SITEMAP_ROOTS), fallback])];
  const out = new Set<string>();
  // wave 3: each address's lastmod day ('' = none), counted once per address; only days are kept, never the bodies
  const days = new Map<string, string>();
  let read = false;
  const take = async (urls: string[], level: number): Promise<string[]> => {
    const answers = await Promise.all(urls.map((u) => fetchPublicText(u, SITEMAP_BYTES, 4, { headers: true }).catch(() => null)));
    const children: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const r = answers[i];
      const u = urls[i];
      // /sitemap.xml is only a guess when robots.txt names other sitemaps: its 404 then says nothing
      const guess = level === 0 && u === fallback && !onSiteListed.includes(fallback);
      const xml = r?.text ?? '';
      const isXml = /<(urlset|sitemapindex)\b/i.test(xml.slice(0, 5000));
      // N-app-10: a guessed /sitemap.xml that is not there (404 / 410) or answers a web page (an app shell's 200) is no sitemap at all
      if (r && guess && (r.status === 404 || r.status === 410 || (r.status === 200 && !isXml && !r.truncated))) continue;
      // N-app-11: a sitemap that redirected to another website is not this website's list
      if (r && !onSite(r.finalUrl || u, d)) {
        complete = false;
        continue;
      }
      if (!r || r.status !== 200 || r.truncated || /\.gz$/i.test(u) || !isXml) {
        complete = false;
        continue;
      }
      read = true;
      const locs = sitemapLocs(xml).map((x) => x.replace(/^http:\/\//i, 'https://'));
      if (isSitemapIndex(xml)) {
        // an index of indexes is not followed further, and a child on another host is not read
        if (level >= 1) complete = false;
        else
          for (const c of locs) {
            if (onSite(c, d)) children.push(c);
            else complete = false;
          }
        continue;
      }
      for (const x of locs) {
        if (out.size >= SITEMAP_URLS) {
          complete = false;
          break;
        }
        out.add(x);
      }
      for (const e of sitemapDateEntries(xml)) {
        if (days.size >= SITEMAP_URLS) break;
        const k = e.loc.replace(/^http:\/\//i, 'https://');
        if (!days.get(k)) days.set(k, e.day);
      }
    }
    return children;
  };
  const children = [...new Set(await take(roots, 0))];
  if (children.length > SITEMAP_CHILDREN) complete = false;
  // the children a few at a time (bodies are dropped once their addresses are read)
  const kids = children.slice(0, SITEMAP_CHILDREN);
  for (let i = 0; i < kids.length; i += 4) await take(kids.slice(i, i + 4), 1);
  const dated = [...days.values()].filter(Boolean);
  return read ? { urls: out, complete, dates: { urls: days.size, withLastmod: dated.length, distinct: new Set(dated).size } } : null;
}

/**
 * wave 3 (DESIGN_WAVE3 §3.3): the app's own check of `indexing:sitemap_dates`. Done when at least 90% of the addresses carry a date and the
 * dates differ (a sitemap under 10 addresses may share one day). No sitemap read: the website did not answer, nothing is recorded. A tree
 * read only in part that looks done is "could not tell" (the engine's next reading decides); one that still lacks dates is a miss.
 */
async function checkSitemapDates(domain: string, opts: { fresh?: boolean }): Promise<CheckOutcome> {
  const sm = await sitemapOf(domain, opts);
  if (!sm) return { ok: false, reached: false, message: `We could not read a sitemap at https://${cleanDomain(domain)}/sitemap.xml or in your robots.txt.` };
  const d = sm.dates;
  if (!d.urls) return { ok: false, reached: false, unsure: true, message: 'Your sitemap lists no page we could read, so we could not tell.' };
  const line = sitemapDatesLine(d);
  if (!sitemapDatesGood(d)) return { ok: false, reached: true, message: `${line} We tick this off once at least 9 in 10 pages carry a date and the dates differ.` };
  if (!sm.complete) return { ok: false, reached: false, unsure: true, message: `${line} Part of your sitemap did not open for us, so the daily index check confirms the rest.` };
  return { ok: true, reached: true, message: line };
}

/**
 * Index coverage (2026-10-29, fix wave 1): the app's own check of one indexing step. Opens at most 10 of its pages on the website's own
 * host (the safe fetcher, https, public addresses, size cap; the headers for X-Robots-Tag and the content type), reads the sitemap once
 * where the cause needs it (and only trusts its silence when the whole tree was read, A1) and robots.txt for a robots block. A page counts
 * as fixed only on the exact positive signal for its cause (FIX_CONTRACT decision 3, `indexingPageFixed`); a firewall, a challenge page,
 * a page on another website or a sitemap read in part is "could not tell", which records nothing. A page that did not answer at all means
 * the website did not answer: nothing is recorded either (the SITE_TASKS.md rule).
 */
async function checkIndexing(domain: string, payload: Record<string, unknown>, opts: { fresh?: boolean } = {}): Promise<CheckOutcome> {
  if (str(payload.cause) === 'sitemap')
    return { ok: false, reached: false, engineOnly: true, message: 'Search Console\'s list of your sitemaps is read by the daily index check, so this step is ticked off the day after you submit the sitemap or fix its errors.' };
  if (str(payload.cause) === 'sitemap_dates') return checkSitemapDates(domain, opts);
  const cause = indexingCauseOfKey(`indexing:${str(payload.cause)}`);
  const urls = (Array.isArray(payload.urls) ? payload.urls : []).map(String).map((u) => u.replace(/^http:\/\//i, 'https://')).filter((u) => /^https:\/\//i.test(u) && onSite(u, domain)).slice(0, INDEXING_CHECK_MAX_URLS);
  if (!cause) return { ok: false, reached: true, message: 'This step names no problem we know, so there is nothing we can check.' };
  // N-app-7: how many pages the step lists in all (its `total`, at least the addresses it carries); our check opens at most 10 of them
  const listedTotal = Math.max(Number(payload.total) || 0, (Array.isArray(payload.urls) ? payload.urls : []).length, urls.length);
  if (!urls.length) return { ok: false, reached: false, unsure: true, message: 'None of the listed pages is on your website, so there is nothing we can open; the daily index check reads them.' };
  // the sitemap and the pages are read at the same time (one check must fit inside 45 s)
  const sitemapRead = INDEXING_NEEDS_SITEMAP.has(cause) ? sitemapOf(domain, opts) : Promise.resolve(null);
  const pagesRead = INDEXING_FETCHES_PAGES.has(cause) ? fetchAllPages(urls) : Promise.resolve(null);
  const [sitemap, answers] = await Promise.all([sitemapRead, pagesRead]);
  // listed: yes; not listed: only from a complete read; otherwise we cannot tell (A1)
  const inSitemap = (u: string): boolean | null => (!sitemap ? null : [...sitemap.urls].some((x) => samePageUrl(x, u)) ? true : sitemap.complete ? false : null);
  if (cause === 'robots_blocked') {
    const url = `https://${cleanDomain(domain)}/robots.txt`;
    const r = await fetchPublicText(url, 512 * 1024, 4, { headers: true }).catch(() => null);
    if (!r) return { ok: false, reached: false, message: `We could not open ${url} (no answer from the website).` };
    // N-app-11: robots.txt that redirected to another website is not the file Google reads for this one
    if (!onSite(r.finalUrl, domain)) return { ok: false, reached: false, unsure: true, message: `robots.txt sent us on to another website (${hostOf(r.finalUrl)}), so we could not read the rules Google gets.` };
    const state = robotsFileState(r.status, r.text, String(r.headers?.['content-type'] ?? ''));
    // A16: a robots.txt that answers a login, a firewall, a rate limit or an HTML page tells us nothing about what Google is served
    if (state === 'unreadable') return { ok: false, reached: false, unsure: true, message: `robots.txt answered ${r.status}${r.status === 200 ? ' with a web page instead of the file' : ''}, so we could not read the rules Google gets.` };
    if (state === 'server_error') return { ok: false, reached: true, message: `robots.txt answers ${r.status}. Google reads a server error as "do not crawl anything".` };
    const blocked = state === 'rules' ? robotsBlocked(r.text, ['Googlebot'], urls.map(shortPath)) : [];
    if (!blocked.length && state === 'rules' && listedTotal > urls.length) return partialOutcome(urls.length, listedTotal, `robots.txt lets Google read the first ${urls.length} pages of ${listedTotal}.`);
    if (!blocked.length) return { ok: true, reached: true, message: state === 'none' ? 'There is no robots.txt rule left that blocks Google (the file answers 404).' : `robots.txt lets Google read ${urls.length === 1 ? 'the page' : `all ${urls.length} pages we checked`}.` };
    return { ok: false, reached: true, message: `robots.txt still blocks Google from ${blocked.slice(0, 3).map((x) => `${x.path} (${x.rule})`).join('; ')}${blocked.length > 3 ? ` and ${blocked.length - 3} more` : ''}.` };
  }
  const results: IndexingPageVerdict[] = [];
  if (answers) {
    const silent = urls.filter((_, i) => !answers[i]);
    if (silent.length) return { ok: false, reached: false, message: `We could not open ${silent[0]}${silent.length > 1 ? ` and ${silent.length - 1} more` : ''} (no answer from the website).` };
    // wave 2: a page with a title of its own is fixed only when it names itself (its absence from the sitemap is never the fix)
    const ownTitle = new Set((Array.isArray(payload.ownTitle) ? payload.ownTitle : []).map(String).map((u) => u.replace(/^http:\/\//i, 'https://')));
    urls.forEach((u, i) => results.push(indexingPageFixed(cause, answers[i]!, inSitemap(u), { ownTitle: ownTitle.has(u) })));
  } else {
    if (!sitemap) return { ok: false, reached: false, unsure: true, message: `We could not read a sitemap at https://${cleanDomain(domain)}/sitemap.xml or in your robots.txt.` };
    for (const u of urls) results.push(indexingPageFixed(cause, { url: u, status: 200, finalUrl: u, redirectStatus: 0, text: '' }, inSitemap(u)));
  }
  const left = results.filter((r) => !r.fixed && !r.unknown);
  const unsure = results.filter((r) => r.unknown);
  const of = listedTotal > urls.length ? ` (we opened ${urls.length} of the ${listedTotal} pages)` : '';
  if (left.length) return { ok: false, reached: true, message: `${left.length} of ${urls.length} still to fix${of}: ${left.slice(0, 3).map((r) => r.why).join(' ')}${left.length > 3 ? ` And ${left.length - 3} more.` : ''}` };
  if (unsure.length) return { ok: false, reached: false, unsure: true, message: `We could not tell for ${unsure.length} of ${urls.length}: ${unsure[0].why}` };
  // N-app-7: the step is done only when every page it lists was checked; otherwise it says how far we got and stays as it is
  if (listedTotal > urls.length) return partialOutcome(urls.length, listedTotal, `The first ${urls.length} pages of ${listedTotal} are fixed.`);
  return { ok: true, reached: true, message: urls.length === 1 ? results[0].why : `All ${urls.length} pages are fixed.` };
}

/**
 * wave 2 (DESIGN_WAVE2 §3.2): the links step's own check. Opens each page the client was asked to add a link on (own host, the safe
 * fetcher, at most 10, four at a time) and looks for an `<a href>` to the page it should link to. Done when every listed link is there;
 * otherwise it says how many it found. A page that did not answer at all records nothing (the website did not answer); a firewall, a
 * challenge page or a page that went to another website is "could not tell".
 */
async function checkLinks(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const https = (u: string) => u.replace(/^http:\/\//i, 'https://');
  const pairs = linkPairsOf(payload)
    .map((x) => ({ target: https(x.target), source: https(x.source) }))
    .filter((x) => onSite(x.target, domain) && onSite(x.source, domain))
    .slice(0, INDEXING_LINKS_MAX_PAIRS);
  if (!pairs.length) return { ok: false, reached: false, unsure: true, message: 'This step lists no link on your website we can check; the daily index check reads it.' };
  const sources = [...new Set(pairs.map((x) => x.source))];
  const answers = await fetchAllPages(sources);
  const silent = sources.filter((_, i) => !answers[i]);
  if (silent.length) return { ok: false, reached: false, message: `We could not open ${silent[0]}${silent.length > 1 ? ` and ${silent.length - 1} more` : ''} (no answer from the website).` };
  const bySource = new Map(sources.map((u, i) => [u, answers[i]!]));
  const missing: string[] = [];
  const unsure: string[] = [];
  let found = 0;
  for (const x of pairs) {
    const a = bySource.get(x.source)!;
    const from = shortPath(x.source);
    const to = shortPath(x.target);
    if (a.status === 401 || a.status === 403 || a.status === 429 || (a.status === 503 && (!a.text || challengePage(a))) || challengePage(a)) {
      unsure.push(`${from} answered ${a.status} to us (often a firewall that lets Google in but not other visitors), so we could not tell.`);
      continue;
    }
    if (!onSite(a.finalUrl || x.source, domain)) {
      unsure.push(`${from} sent us on to another website, so we could not read it.`);
      continue;
    }
    if (a.status !== 200) {
      missing.push(`${from} answers ${a.status}, so the link to ${to} is not there.`);
      continue;
    }
    if (pageLinksTo(a.text, a.finalUrl || x.source, x.target)) found++;
    else missing.push(`${from} has no link to ${to} yet.`);
  }
  const n = pairs.length;
  if (missing.length)
    return { ok: false, reached: true, message: `${found} of ${n} link${n === 1 ? '' : 's'} found. ${missing.slice(0, 3).join(' ')}${missing.length > 3 ? ` And ${missing.length - 3} more.` : ''}` };
  if (unsure.length) return { ok: false, reached: false, unsure: true, message: `We could not tell for ${unsure.length} of ${n}: ${unsure[0]}` };
  return { ok: true, reached: true, message: n === 1 ? `${shortPath(pairs[0].source)} links to ${shortPath(pairs[0].target)}.` : `All ${n} links are in place.` };
}

/**
 * R1: a step whose pages Google read again after a fix we saw and still sees with the problem (a noindex, a block or an error sent only
 * to Google's crawler) is never closed by our own fetch. A check that finds it fixed records nothing; one that finds the problem is kept
 * as it is (it is still to do either way).
 */
function googleStillSeesOutcome(payload: Record<string, unknown>, out: CheckOutcome): CheckOutcome {
  const n = googleStillSees(payload);
  if (!n || !(out.ok || out.partial)) return out;
  return {
    ok: false,
    reached: false,
    googleSees: true,
    message: `Your website looks fixed to us, but Google read ${n === 1 ? 'a page' : `${n} pages`} of this step again after the change we saw and still sees the problem, so this step stays open until Google reads ${n === 1 ? 'it' : 'them'} without it. Your website may show Google something different from what a browser sees; the guide shows how to see a page the way Google gets it.`,
  };
}

/** N-app-7: we checked only part of a step's pages and every one of them is fixed. */
function partialOutcome(checked: number, total: number, lead: string): CheckOutcome {
  return {
    ok: false,
    reached: false,
    partial: true,
    message: `${lead} We opened ${checked} of ${total}; the daily index check reads the other ${total - checked} with Google and ticks this step off when none of them still has the problem.`,
  };
}

/** The pages of a step, four at a time (ten pages at 10 s each must fit inside the 45 s cap of one check); a page with no answer is null. */
async function fetchAllPages(urls: string[]): Promise<(Awaited<ReturnType<typeof fetchIndexPage>>)[]> {
  const answers: Awaited<ReturnType<typeof fetchIndexPage>>[] = new Array(urls.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (next < urls.length) {
        const i = next++;
        answers[i] = await fetchIndexPage(urls[i]);
      }
    }),
  );
  return answers;
}

/** One page of an indexing step, read the way the check needs it (status after redirects, the first hop's status, X-Robots-Tag, type). */
async function fetchIndexPage(url: string): Promise<{ url: string; status: number; finalUrl: string; redirectStatus: number; text: string; xRobotsTag?: string | string[]; contentType: string } | null> {
  const r = await fetchPublicText(url, 512 * 1024, 4, { headers: true }).catch(() => null);
  if (!r) return null;
  return { url, status: r.status, finalUrl: r.finalUrl, redirectStatus: r.firstStatus ?? 0, text: r.text, xRobotsTag: r.headers?.['x-robots-tag'], contentType: String(r.headers?.['content-type'] ?? '') };
}

/** The one check of a step's kind. An exhaustive switch: a kind added without its check does not compile (it used to fall through to the
 *  redirect check). */
function checkOf(domain: string, kind: SiteTaskKind, payload: Record<string, unknown>, opts: { fresh?: boolean }): Promise<CheckOutcome> {
  switch (kind) {
    case 'indexnow':
      return checkIndexnow(domain, payload);
    case 'ai_crawlers':
      return checkCrawlers(domain, payload);
    case 'redirect':
      return checkRedirect(domain, payload);
    case 'indexing':
      return checkIndexing(domain, payload, opts).then((out) => googleStillSeesOutcome(payload, out));
    case 'index_links':
      return checkLinks(domain, payload);
    case 'index_merge':
      return checkMerge(domain, payload);
    // AIR: the engine's weekly run checks an AI-ranking step itself (it reads the page, the listing, the robots.txt rule); our check says so.
    // RC-3 (review C): a step done somewhere only the client knows (an article, a post, a video, a profile) is checked on the address the
    // client pastes on it: we open it and look for the business. Without an address a required one asks for it.
    case 'ai_rank': {
      // client reports 2026-11-11 (devaicon.com): L03 (Bing Webmaster) is asked of Bing right away, the same check as the Backlinks page's
      // "Check Bing now", instead of "the weekly check confirms this step" (409)
      if (String(payload.lever ?? '') === 'L03') return checkBingStep(domain);
      const need = aiRankAddressNeed(String(payload.lever ?? ''));
      if (need && s(payload.clientUrl)) return checkAiRankAddress(domain, payload);
      if (need === 'required') return Promise.resolve({ ok: false, reached: false, needsAddress: true, message: AI_RANK_ADDRESS_ASK });
      return Promise.resolve({ ok: false, reached: false, engineOnly: true, message: 'The weekly AI ranking check confirms this step. It runs once a week and ticks it off once it finds it done.' });
    }
    case 'ai_export':
      return checkAiExport(domain);
    default: {
      const never: never = kind;
      // a row of a kind this build does not know (written by a newer one): nothing is read and nothing recorded
      return Promise.resolve({ ok: false, reached: false, message: `Unknown step ${String(never)}.` });
    }
  }
}

/** L03: the outcome of the live Bing check (free; nothing stored but the step's own reading; the key is never logged), in the Backlinks
 *  page's Bing card words. Bing not set up on this server: the weekly check still decides (409). Bing not answering: nothing changes. */
export function bingStepOutcome(live: BingCheck): CheckOutcome {
  const text = bingSourceText(null, live, live.shareWith).text;
  if (!live.configured) return { ok: false, reached: false, engineOnly: true, message: `${text} The weekly AI ranking check confirms this step.` };
  return { ok: live.inAccount && live.verified, reached: true, message: text };
}

/** Swappable for tests (the Bing check itself is tested in bingCheck.test.ts). */
export const bingStep = { check: (domain: string): Promise<BingCheck> => checkBingAccess(domain) };

async function checkBingStep(domain: string): Promise<CheckOutcome> {
  try {
    return bingStepOutcome(await bingStep.check(domain));
  } catch (err) {
    return { ok: false, reached: false, unsure: true, message: s((err as Error)?.message) || 'Bing did not answer just now. Try again in a minute.' };
  }
}

const AI_RANK_ADDRESS_ASK = 'Paste the address of the page where it is live, then press check now again. We open it and look for your business.';

/** RC-3: the address a client gave on an AI ranking step, opened with the safe fetcher; done when the page names the business (L17: the
 *  Wikidata item lists the website itself). A page that does not answer, or a firewall, records nothing; one that answers without the
 *  business is a miss (the daily check's two-miss rule then applies to a step that was done). */
async function checkAiRankAddress(domain: string, payload: Record<string, unknown>): Promise<CheckOutcome> {
  const lever = s(payload.lever);
  const v = aiRankAddressCheck(s(payload.clientUrl), lever);
  if ('error' in v || !publicHttpsHost(v.url)) return { ok: false, reached: false, needsAddress: true, message: 'error' in v ? v.error : 'That address is not a public website.' };
  const url = v.url;
  const r = await fetchPublicText(url, 1024 * 1024).catch(() => null);
  if (!r) return { ok: false, reached: false, message: `We could not open ${url} (no answer).` };
  if (r.status === 401 || r.status === 403 || r.status === 429 || challengePage(r))
    return { ok: false, reached: false, unsure: true, message: `${url} answered ${r.status} to us (often a firewall or a sign-in page), so we could not read it.` };
  if (r.status !== 200) return { ok: false, reached: true, message: `${url} answers ${r.status}, so we could not find your business on it.` };
  const names = lever === 'L17' ? [] : (Array.isArray(payload.names) ? payload.names : []).map(String);
  if (aiRankPageNames(r.text, domain, names)) return { ok: true, reached: true, message: lever === 'L17' ? `Your Wikidata item lists ${cleanDomain(domain)}.` : `${url} names your business.` };
  return {
    ok: false,
    reached: true,
    message: lever === 'L17' ? `The Wikidata item does not list ${cleanDomain(domain)} as its website yet.` : `${url} does not name your business yet (we looked for ${[cleanDomain(domain), ...names.filter((n) => n.length >= 3)].slice(0, 4).join(', ')}).`,
  };
}

/** The business names our check looks for on a page the client gives: the brand names on file and the company name. */
const businessNames = (a: SiteAccess): string[] => [...new Set([...(a.site.brandNames ?? []), a.org.name].map((x) => s(x).trim()).filter((x) => x.length >= 3))].slice(0, 8);

/** AIRF.urlKey (v5/code/_ai_rank_flags.js): no scheme, no www., lower-case host, no query or fragment, no trailing slash, at most 300 */
export function aiRankUrlKey(url: string): string {
  const m = s(url).match(/^https?:\/\/([^/?#]+)([^?#]*)/i);
  if (!m) return '';
  const host = m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '').replace(/\.$/, '');
  return (host + m[2].replace(/\/+$/, '')).slice(0, 300);
}

/**
 * RC-3: a passing check is handed to the engine's own verification input (best effort, never failing the request). ARL.verify (L11-L15,
 * L17) reads `client_url` on the stored seo_ai_rank_actions row (AI Rank Plan spreads the row into the action) and then looks the address
 * up in the source graph, whose stored seo_ai_rank_sources rows keep `names_client`. So: (1) the action row gets `client_url`; that column
 * is added on the engine side (AI_RANK_ACTIONS_COLS, kept on upsert; FX-C.md), and until it exists the write fails and is only logged;
 * (2) the page becomes a source row named by the client's page (source_from 'client'), keyed site_id + url_key.
 */
async function handAddressToEngine(domain: string, payload: Record<string, unknown>, out: CheckOutcome, log?: Log): Promise<void> {
  const id = s(payload.actionId);
  const url = s(payload.clientUrl);
  if (!out.ok || !url) return;
  const at = new Date().toISOString();
  const siteId = n8nSiteId(domain);
  if (id)
    await updateRows('aiRankActions', [{ columnName: 'action_id', condition: 'eq', value: id }], { client_url: url, updated_at: at }).catch((err) =>
      log?.warn({ err: String(err), actionId: id }, 'AI ranking address not stored on the action (the engine may not have the client_url column yet)'),
    );
  const key = aiRankUrlKey(url);
  const host = key.split('/')[0] ?? '';
  await upsertRow('aiRankSources', [{ columnName: 'site_id', condition: 'eq', value: siteId }, { columnName: 'url_key', condition: 'eq', value: key }], {
    site_id: siteId,
    domain: cleanDomain(domain),
    url_key: key,
    url,
    host,
    names_client: true,
    first_seen: at,
    last_seen: at,
    checked_at: at,
    source_from: 'client',
  }).catch((err) => log?.warn({ err: String(err), key }, 'AI ranking address not stored as a source'));
}

/** AIR: this month's two AI report uploads (the app's own upload table, read fresh). */
async function checkAiExport(domain: string): Promise<CheckOutcome> {
  const month = new Date().toISOString().slice(0, 7);
  const has = async (source: string) =>
    s((await siteRows<P>('aiImports', domain, { extra: [{ columnName: 'source', condition: 'eq', value: source }], sortBy: 'imported_at:desc', max: 1, fresh: true }))[0]?.imported_at).slice(0, 7) === month;
  try {
    const [bing, gsc] = await Promise.all([has('bing_ai'), has('gsc_ai')]);
    const missing = [bing ? '' : 'Bing', gsc ? '' : 'Search Console'].filter(Boolean);
    return missing.length
      ? { ok: false, reached: true, message: `This month's ${missing.join(' and ')} upload ${missing.length === 1 ? 'is' : 'are'} not here yet. Upload it on the AI visibility page.` }
      : { ok: true, reached: true, message: "Both of this month's AI reports are uploaded." };
  } catch {
    return { ok: false, reached: false, message: 'The uploads could not be read just now.' };
  }
}

/** `fresh`: a person pressed "check now", so the website's sitemap is read again rather than taken from this round's cache. */
export function runSiteTaskCheck(domain: string, kind: SiteTaskKind, payload: Record<string, unknown>, opts: { fresh?: boolean } = {}): Promise<CheckOutcome> {
  const run = checkOf(domain, kind, payload, opts);
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<CheckOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reached: false, message: `${cleanDomain(domain)} took too long to answer.` }), CHECK_DEADLINE_MS);
  });
  return Promise.race([run, late]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------- writing a reading

async function recordCheck(row: Pick<SiteTaskRow, 'id'>, out: CheckOutcome, by: SiteTaskCheckBy, who?: string): Promise<void> {
  const now = new Date();
  const check: SiteTaskCheck = { at: now.toISOString(), ok: out.ok, message: out.message, by, ...(who ? { who } : {}), ...(out.pairs ? { pairs: out.pairs } : {}) };
  await db
    .update(schema.siteTasks)
    // `done_at` keeps its stored value on a miss (never a stale copy read before the check started)
    .set({ lastCheck: check, lastCheckAt: now, doneAt: out.ok ? now : sql`${schema.siteTasks.doneAt}`, missAt: null, updatedAt: now })
    .where(eq(schema.siteTasks.id, row.id));
}

/** The client's "I've done it, check now": runs the step's check on their website, stores it, writes the audit log, answers the step. */
export async function checkSiteTask(a: SiteAccess, req: FastifyRequest, body: unknown): Promise<SiteTask> {
  requireVerified(a.site);
  const key = str((body as Record<string, unknown> | null)?.key).slice(0, 600);
  const st = await stateOf(a.org, a.site);
  const task = st.tasks.find((t) => t.key === key);
  if (!task) throw notFound('This step is not on the list for this website any more.');
  if (task.state === 'skipped') throw badRequest('This step is skipped. Bring it back first, then check it.');
  const p = siteTaskPayload(st.inputs, st.stored, key);
  if (!p) throw notFound('This step is not on the list for this website any more.');
  // RC-3: an AI ranking step checked on an address: the one pasted now (checked by the safe fetcher's rules first), else the one stored
  if (p.kind === 'ai_rank') {
    const need = aiRankAddressNeed(str(p.payload.lever));
    const given = str((body as Record<string, unknown> | null)?.clientUrl).slice(0, 700);
    if (need && given) {
      const v = aiRankAddressCheck(given, str(p.payload.lever));
      if ('error' in v) throw badRequest(v.error);
      if (!publicHttpsHost(v.url)) throw badRequest('That address is not a public website.');
      p.payload = { ...p.payload, clientUrl: v.url, names: businessNames(a) };
    } else if (need && str(p.payload.clientUrl)) p.payload = { ...p.payload, names: businessNames(a) };
    else if (need === 'required') throw badRequest(AI_RANK_ADDRESS_ASK);
  }
  let row = st.rows.find((r) => r.taskKey === key);
  if (!row) {
    [row] = await db
      .insert(schema.siteTasks)
      .values({ orgId: a.org.id, siteId: a.site.id, taskKey: key, kind: p.kind, payload: p.payload })
      .onConflictDoUpdate({ target: [schema.siteTasks.siteId, schema.siteTasks.taskKey], set: { payload: p.payload, updatedAt: new Date() } })
      .returning();
  } else if (task.state === 'todo' || (p.kind === 'ai_rank' && str(p.payload.clientUrl) !== str(row.payload?.clientUrl))) {
    await db.update(schema.siteTasks).set({ payload: p.payload }).where(eq(schema.siteTasks.id, row.id));
  }
  // one reader of a website at a time: the daily job never writes an older reading over this one
  for (let i = 0; inFlight.has(a.site.id) && i < 100; i++) await new Promise((r) => setTimeout(r, 100));
  inFlight.add(a.site.id);
  let out: CheckOutcome;
  try {
    out = await runSiteTaskCheck(a.site.domain, p.kind, p.payload, { fresh: true });
  } finally {
    inFlight.delete(a.site.id);
  }
  // the website did not answer at all: nothing is recorded (one bad minute must never reopen a done step), the person is asked to retry
  if (!out.reached && out.needsAddress) throw badRequest(out.message);
  if (!out.reached && out.engineOnly) throw new HttpError(409, out.message, 'engine_reads_it');
  if (!out.reached && out.googleSees) throw new HttpError(409, out.message, 'google_still_sees');
  if (!out.reached && out.partial) throw new HttpError(409, out.message, 'site_partial');
  if (!out.reached && out.unsure) throw new HttpError(409, `We could not confirm it just now, so nothing changed. ${out.message}`, 'site_unsure');
  if (!out.reached) throw new HttpError(503, `Your website did not answer just now, so nothing changed. Try again in a minute. (${out.message})`, 'site_unreachable');
  await recordCheck(row, out, 'you', a.user.name || a.user.email);
  if (p.kind === 'ai_rank') await handAddressToEngine(a.site.domain, p.payload, out, req.log);
  await audit(req, a.org.id, {
    action: 'site_task.checked',
    outcome: out.ok ? 'success' : 'failure',
    target: { type: 'site', id: a.site.id, label: a.site.domain },
    details: { step: key, done: out.ok, result: out.message.slice(0, 300) },
  });
  const after = deriveSiteTasks(st.inputs, await storedOf(await rowsOf(a.site.id)));
  return after.find((t) => t.key === key)!;
}

/** Skip a step ("not for us") or bring it back. Members and above; written to the audit log. */
export async function skipSiteTask(a: SiteAccess, req: FastifyRequest, body: unknown, skip: boolean): Promise<SiteTask> {
  requireVerified(a.site);
  const key = str((body as Record<string, unknown> | null)?.key).slice(0, 600);
  const st = await stateOf(a.org, a.site);
  const task = st.tasks.find((t) => t.key === key);
  if (!task) throw notFound('This step is not on the list for this website any more.');
  const p = siteTaskPayload(st.inputs, st.stored, key);
  const now = new Date();
  const set = skip ? { skippedAt: now, skippedBy: a.user.id, updatedAt: now } : { skippedAt: null, skippedBy: null, updatedAt: now };
  await db
    .insert(schema.siteTasks)
    .values({ orgId: a.org.id, siteId: a.site.id, taskKey: key, kind: task.kind, payload: p?.payload ?? {}, ...set })
    .onConflictDoUpdate({ target: [schema.siteTasks.siteId, schema.siteTasks.taskKey], set });
  await audit(req, a.org.id, { action: skip ? 'site_task.skipped' : 'site_task.restored', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { step: key } });
  const after = deriveSiteTasks(st.inputs, await storedOf(await rowsOf(a.site.id)));
  return after.find((t) => t.key === key)!;
}

/** The old AI-page button (POST …/ai/indexnow/check, kept for open tabs): the same check, now stored like "check now". */
export async function checkIndexnowStep(a: SiteAccess, req: FastifyRequest): Promise<{ verified: boolean; keyUrl: string; message: string } | null> {
  const st = await stateOf(a.org, a.site);
  if (!st.tasks.some((t) => t.key === 'indexnow' && t.state !== 'skipped')) return null;
  const t = await checkSiteTask(a, req, { key: 'indexnow' });
  return { verified: t.state === 'done', keyUrl: str(siteTaskPayload(st.inputs, st.stored, 'indexnow')?.payload.keyUrl), message: t.lastCheck?.message ?? '' };
}

// ---------------------------------------------------------------- the daily check (SITE_TASK_JOBS)

/**
 * One daily reading of a stored step. A website that does not answer leaves the step as it was. A done step that is missing is looked at
 * again an hour later and reopened only on the second miss, so one bad minute of the client's hosting never raises a false alarm.
 */
async function dailyCheck(row: SiteTaskRow, domain: string): Promise<void> {
  const out = await runSiteTaskCheck(domain, row.kind, row.payload ?? {});
  const now = new Date();
  if (!out.reached) {
    await db.update(schema.siteTasks).set({ lastCheckAt: now }).where(eq(schema.siteTasks.id, row.id));
    return;
  }
  // no reading of ours yet: the engine may already call it done, so a first miss is looked at twice like a done step's
  const wasDone = row.lastCheck ? row.lastCheck.ok : true;
  if (!out.ok && wasDone && !row.missAt) {
    // first miss: due again in an hour (the tick picks rows whose last check is older than a day)
    await db.update(schema.siteTasks).set({ missAt: now, lastCheckAt: new Date(now.getTime() - DAY + MISS_RECHECK_MS) }).where(eq(schema.siteTasks.id, row.id));
    return;
  }
  await recordCheck(row, out, 'daily');
}

/** Checks one website's stored steps now (after they are first stored). */
async function checkSiteNow(siteId: string, log?: Log): Promise<void> {
  if (inFlight.has(siteId)) return;
  inFlight.add(siteId);
  try {
    const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) });
    if (!site?.verifiedAt) return;
    for (const row of await db.select().from(schema.siteTasks).where(and(eq(schema.siteTasks.siteId, siteId), isNull(schema.siteTasks.skippedAt), isNull(schema.siteTasks.lastCheckAt))))
      await dailyCheck(row, site.domain).catch((err) => log?.warn({ err: String(err), task: row.taskKey }, 'site task check failed'));
  } finally {
    inFlight.delete(siteId);
  }
}

const synced = new Map<string, number>();

/**
 * The background job (index.ts, every 30 minutes; SITE_TASK_JOBS=false stops it): (1) stores the steps of websites nobody opened in the
 * last day, from the engine's data, so autopilot clients are covered too (a few websites a tick); (2) checks every stored step whose last
 * reading is older than a day (at most 60 a tick, one website at a time).
 */
let ticking = false;

export async function siteTaskTick(log: Log, opts: { sites?: number; checks?: number } = {}): Promise<{ synced: number; checked: number }> {
  // a tick still running (slow websites) is not joined by the next one
  if (ticking) return { synced: 0, checked: 0 };
  ticking = true;
  try {
    return await tick(log, opts);
  } finally {
    ticking = false;
  }
}

async function tick(log: Log, opts: { sites?: number; checks?: number }): Promise<{ synced: number; checked: number }> {
  const now = Date.now();
  let syncedN = 0;
  const sites = await db
    .select({ site: schema.sites, org: schema.organizations })
    .from(schema.sites)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.sites.orgId))
    .where(and(isNotNull(schema.sites.verifiedAt), eq(schema.sites.trackingStatus, 'active')));
  // the websites read longest ago first, so every tracked website gets its turn however many there are
  const order = sites.filter((x) => now - (synced.get(x.site.id) ?? 0) > DAY).sort((a, b) => (synced.get(a.site.id) ?? 0) - (synced.get(b.site.id) ?? 0));
  for (const { site, org } of order.slice(0, opts.sites ?? 5)) {
    synced.set(site.id, now);
    try {
      const st = await stateOf(org, site);
      await materialize(org, site, st, log);
      syncedN++;
    } catch (err) {
      log.warn({ err: String(err), site: site.id }, 'site tasks could not be read');
    }
  }
  // Index coverage (2026-10-29, A27): the tick's budget stays fair both ways. Indexing steps (each opens up to ten pages) have a third of
  // the budget of their own, so they are checked even when 60 other steps are due; the other kinds take the rest (and whatever the
  // indexing steps leave), so a website with many indexing steps never starves the IndexNow, crawler and redirect checks either.
  const budget = opts.checks ?? 60;
  const dueOf = (kinds: 'others' | 'indexing', limit: number) =>
    limit <= 0
      ? Promise.resolve([] as { row: SiteTaskRow; domain: string; siteId: string }[])
      : db
          .select({ row: schema.siteTasks, domain: schema.sites.domain, siteId: schema.sites.id })
          .from(schema.siteTasks)
          .innerJoin(schema.sites, eq(schema.sites.id, schema.siteTasks.siteId))
          .where(
            and(
              isNull(schema.siteTasks.skippedAt),
              isNotNull(schema.sites.verifiedAt),
              // a paused website is not read every day (its steps keep their last state)
              eq(schema.sites.trackingStatus, 'active'),
              or(isNull(schema.siteTasks.lastCheckAt), lt(schema.siteTasks.lastCheckAt, new Date(now - DAY))),
              // wave 2: the links step is fed by the daily index check too, so it shares the indexing third
              kinds === 'indexing' ? inArray(schema.siteTasks.kind, [...INDEX_TASK_KINDS]) : notInArray(schema.siteTasks.kind, [...INDEX_TASK_KINDS]),
            ),
          )
          .orderBy(sql`${schema.siteTasks.lastCheckAt} asc nulls first`, asc(schema.siteTasks.createdAt))
          .limit(limit);
  const indexing = await dueOf('indexing', Math.ceil(budget / 3));
  const others = await dueOf('others', budget - indexing.length);
  const due = [...others, ...indexing];
  let checked = 0;
  for (const d of due) {
    if (inFlight.has(d.siteId)) continue;
    inFlight.add(d.siteId);
    try {
      await dailyCheck(d.row, d.domain);
      checked++;
    } catch (err) {
      log.warn({ err: String(err), task: d.row.taskKey }, 'site task daily check failed');
    } finally {
      inFlight.delete(d.siteId);
    }
  }
  return { synced: syncedN, checked };
}

/** A callback that brings new engine readings (AI growth, AI visibility, backlinks): store the website's steps from them. */
export const SITE_TASK_STAGES: ReadonlySet<string> = new Set(['ai_growth', 'ai_visibility', 'backlinks', 'index_coverage']);
export async function afterSiteTaskCallback(org: OrgRow, site: SiteRow, log?: Log): Promise<void> {
  synced.set(site.id, Date.now());
  const st = await stateOf(org, site);
  await materialize(org, site, st, log);
}
