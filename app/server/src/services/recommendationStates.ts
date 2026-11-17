// Where each recommendation stands (CR17-H, client report 2026-11-17 Q4). The list itself is computed from the website's data on every read
// (recommendations.ts); this service remembers what happened to each item in `recommendation_states` and decides it with the checks we
// already run: the daily index check, the step checks on the website, the audit finding re-check, the AI target status, our link check,
// the content log. An item is "resolved" only when one of them confirms it (with the date and what it saw); an item its source stops
// reporting that no check confirms is "expired", never resolved. The Recommendations page, the Overview and the Pipeline read the same
// states (`todoRecommendations`), so a dismissed or resolved item leaves all three at once.
//
// THE ADAPTER (for the packages that own a source): a verifier per check kind,
//   type RecVerifier = (item: { rec: Recommendation; present: boolean }, ctx: RecVerifyContext) => RecVerdict | Promise<RecVerdict>
// registered with `registerRecVerifier(kind, fn)`. `rec` is the item as computed now (present) or as last shown (gone from its source);
// the verdict is { outcome: open | in_progress | waiting | failed | resolved | dismissed | unknown, evidence?, at? } (shared
// recommendation-rules.ts). Today's verifiers below use what each source already exposes; a package with a better reading replaces its kind.
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import {
  DISMISS_REASONS,
  RESOLVED_SHOWN_DAYS,
  TODO_STATES,
  dismissReasonLabel,
  nextRecState,
  normKeyword,
  pageKey,
  recRuleFor,
  type IndexPageRow,
  type RecCheckKind,
  type RecStateRow,
  type RecVerdict,
  type Recommendation,
  type RecommendationBoard,
  type RecommendationState,
  type SiteTask,
} from '@seo/shared';
import { db, schema } from '../db';
import type { OrgRow, RecommendationStateRow, SiteRow } from '../db/schema';
import { badRequest, notFound } from '../lib/errors';
import type { SiteAccess } from '../auth/access';
import { audit } from './audit';
import type { SiteBundle } from './recommendations';
import { aiTargetVerifier, indexVerifier, linkVerifier, pitchesVerifier } from './recommendationVerifiers';

export interface RecVerifyContext {
  site: Pick<SiteRow, 'id' | 'domain'> & Partial<Pick<SiteRow, 'country'>>;
  x: SiteBundle;
  /** the website's steps (undefined: they could not be read; a step-backed item is then "unknown", never resolved) */
  tasks?: readonly SiteTask[];
  /** the daily index check's page rows by page key, read once per request and only when an index item needs them */
  indexPages: () => Promise<Map<string, IndexPageRow>>;
  now: string;
}
export interface RecItem {
  rec: Recommendation;
  /** the source reports it this time */
  present: boolean;
}
export type RecVerifier = (item: RecItem, ctx: RecVerifyContext) => RecVerdict | Promise<RecVerdict>;

const UNKNOWN: RecVerdict = { outcome: 'unknown' };
const day = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
};
const tailOf = (id: string, n: number) => id.split(':').slice(n).join(':');

/** a step on the website: its own check decides (done, done and waiting for Google, skipped, checked by you and still not done) */
function siteTaskVerdict(taskKey: string, ctx: RecVerifyContext): RecVerdict {
  if (!ctx.tasks) return UNKNOWN;
  const t = ctx.tasks.find((x) => x.key === taskKey);
  if (!t) return UNKNOWN;
  if (t.state === 'skipped') return { outcome: 'dismissed', evidence: 'Skipped on your website steps.', at: t.skipped?.at };
  if (t.state === 'done') {
    const msg = t.lastCheck?.message || 'Done on your website.';
    return t.waitingForGoogle ? { outcome: 'waiting', evidence: msg, at: t.lastCheck?.at } : { outcome: 'resolved', evidence: msg, at: t.doneAt ?? t.lastCheck?.at };
  }
  if (t.lastCheck && !t.lastCheck.ok && t.lastCheck.by === 'you') return { outcome: 'failed', evidence: `We checked on ${day(t.lastCheck.at)}: ${t.lastCheck.message}`, at: t.lastCheck.at };
  return { outcome: 'open' };
}

const VERIFIERS: Record<RecCheckKind, RecVerifier> = {
  site_task: () => UNKNOWN, // every step-backed item goes through siteTaskVerdict (by its taskKey) before the kind is asked
  // CR17 integration: Index coverage's own reading (package C: moved = done, Search Console's validation = waiting / failed)
  index: indexVerifier,
  // the audit finding: fixed in a newer audit, no longer seen by our live check, or a re-check you asked for
  finding: ({ rec }, ctx) => {
    const key = rec.id.slice('tech:'.length);
    const f = ctx.x.technical.findings.find((x) => x.key === key);
    const latest = ctx.x.technical.audits[ctx.x.technical.audits.length - 1];
    if (!f) return latest && rec.firstSeenAt && latest.auditedAt > rec.firstSeenAt ? { outcome: 'resolved', evidence: `The audit of ${day(latest.auditedAt)} no longer finds it.`, at: latest.auditedAt } : UNKNOWN;
    if (f.status === 'fixed') return { outcome: 'resolved', evidence: `Fixed: the audit of ${latest ? day(latest.auditedAt) : 'this month'} no longer finds it.`, at: latest?.auditedAt };
    if (f.status === 'no_longer_seen') return { outcome: 'resolved', evidence: 'Our live check of the pages no longer finds it.' };
    if (f.recheck?.state === 'fixed') return { outcome: 'resolved', evidence: `Checked again on ${day(f.recheck.checkedAt)}: fixed. ${f.recheck.note}`.trim(), at: f.recheck.checkedAt };
    if (f.recheck?.state === 'requested') return { outcome: 'in_progress', evidence: `You asked us to check it again on ${day(f.recheck.requestedAt)}; we read the pages overnight.`, at: f.recheck.requestedAt };
    if (f.recheck?.state === 'still_open') return { outcome: 'failed', evidence: `Checked again on ${day(f.recheck.checkedAt)}: still there. ${f.recheck.note}`.trim(), at: f.recheck.checkedAt };
    return { outcome: 'open' };
  },
  // CR17 integration: the stored target overtaken by a live answering page, else the shared question resolver (package G)
  ai_target: aiTargetVerifier,
  // CR17 integration: our own link check finds the link again (package E's rule: never an index's word)
  link: linkVerifier,
  // the content log: published, or the draft finished
  content: ({ rec }, ctx) => {
    const kw = tailOf(rec.id, 2);
    const item = ctx.x.content.items.find((c) => normKeyword(c.keyword) === normKeyword(kw));
    if (!item) return UNKNOWN;
    if (rec.id.startsWith('content:publish:') && (item.status === 'published' || item.publishedUrl))
      return { outcome: 'resolved', evidence: item.publishedUrl ? `Published at ${item.publishedUrl}` : 'Published.', at: item.publishedAt || undefined };
    if (rec.id.startsWith('content:fix:') && item.status !== 'not_ready') return { outcome: 'resolved', evidence: item.publishedUrl ? `Finished and published at ${item.publishedUrl}` : 'The draft is finished.', at: item.publishedAt || undefined };
    return { outcome: 'open' };
  },
  // the keyword ladder: the next rung written
  ladder: ({ rec }, ctx) => {
    if (!rec.id.startsWith('rank:next:')) return UNKNOWN;
    const l = ctx.x.rankings.ladders.find((x) => x.ladderId === tailOf(rec.id, 2));
    if (!l) return UNKNOWN;
    return l.rungs.some((r) => r.status === 'planned') ? UNKNOWN : { outcome: 'resolved', evidence: `Every rung of "${l.headKeyword}" is written.` };
  },
  // the next Search Console reading of the search
  search: ({ rec }, ctx) => {
    const q = tailOf(rec.id, rec.id.startsWith('engine:') ? 3 : 2);
    const period = ctx.x.search.periods[0];
    const row = ctx.x.search.queries.find((x) => x.periodEnd === period && normKeyword(x.query) === normKeyword(q));
    if (!row) return UNKNOWN;
    if (rec.id.startsWith('search:striking:') && row.position > 0 && row.position <= 3) return { outcome: 'resolved', evidence: `In the top 3 now (position ${row.position.toFixed(1)} in Search Console, week of ${period}).` };
    if (rec.id.startsWith('search:ctr:') && row.ctr >= 0.05) return { outcome: 'resolved', evidence: `${Math.round(row.ctr * 1000) / 10}% of searchers click it now (Search Console, week of ${period}).` };
    if (rec.id.startsWith('search:drop:') && row.prevClicks > 0 && row.clicks >= row.prevClicks * 0.8) return { outcome: 'resolved', evidence: `The clicks came back: ${row.clicks} this period (Search Console, week of ${period}).` };
    return UNKNOWN;
  },
  rank: () => UNKNOWN,
  connection: () => UNKNOWN,
  pitches: pitchesVerifier,   // CR17 integration: the one link status model's numbers (package E)
  schedule: () => UNKNOWN,
};

/** Package adapters: replace the verifier of one check kind (e.g. Index coverage's own page reading, the Link Builder's won-link rule). */
export function registerRecVerifier(kind: RecCheckKind, fn: RecVerifier): void {
  VERIFIERS[kind] = fn;
}

/**
 * What the checks say about one item. A step on the website answers by its own check; a family computed from the current state (setup,
 * pitches, the autopilot's first runs) is done when it is no longer produced; every other family asks its verifier. While present, a page
 * run started for its keyword in the last day makes it "in progress".
 */
export async function verdictFor(item: RecItem, ctx: RecVerifyContext): Promise<RecVerdict> {
  const { rec, present } = item;
  if (rec.taskKey) return siteTaskVerdict(rec.taskKey, ctx);
  const rule = recRuleFor(rec.id);
  if (!present && rule?.absentMeansDone) return { outcome: 'resolved', evidence: rule.absentMeansDone };
  const kind = rule?.check?.kind;
  const v = kind ? await VERIFIERS[kind](item, ctx) : UNKNOWN;
  if (present && (v.outcome === 'open' || v.outcome === 'unknown')) {
    const kw = String(rec.action?.prefill?.keyword ?? '');
    const writing = kw && ctx.x.content.items.some((c) => c.status === 'started' && normKeyword(c.keyword) === normKeyword(kw) && Date.now() - Date.parse(c.startedAt) < 864e5);
    if (writing) return { outcome: 'in_progress', evidence: `The page for "${kw}" is being written.` };
  }
  return v;
}

// ------------------------------------------------------------------------------------------------------------------- storage

const iso = (d: Date | string | null | undefined): string => (d ? new Date(d).toISOString() : '');
const pureOf = (r: RecommendationStateRow): RecStateRow => ({
  recKey: r.recKey,
  issueKey: r.issueKey,
  state: r.state,
  firstSeenAt: iso(r.firstSeenAt),
  lastSeenAt: iso(r.lastSeenAt),
  stateAt: iso(r.stateAt),
  evidence: r.evidence,
  dismissedReason: r.dismissedReason,
});
/** what is kept of an item to list it after its source drops it */
const snapshotOf = (r: Recommendation): Record<string, unknown> => {
  const { state: _s, stateAt: _a, stateEvidence: _e, firstSeenAt: _f, dismissed: _d, ...rest } = r;
  return rest as unknown as Record<string, unknown>;
};
const recOf = (row: RecommendationStateRow): Recommendation => ({ ...(row.snapshot as unknown as Recommendation), id: row.recKey });
/** lastSeenAt is refreshed at most this often for an unchanged item (a read is not a write) */
const SEEN_EVERY_MS = 6 * 3600e3;

/**
 * Bring the stored states up to date with this read: every item present now, and every stored item that is not settled yet (open, in
 * progress, failed, waiting for Google) and went missing. Writes only what changed. Returns the rows by key.
 */
export async function syncRecommendationStates(org: Pick<OrgRow, 'id'>, ctx: RecVerifyContext, recs: readonly Recommendation[]): Promise<Map<string, RecommendationStateRow>> {
  const now = new Date(ctx.now);
  const stored = await db.select().from(schema.recommendationStates).where(eq(schema.recommendationStates.siteId, ctx.site.id));
  const byKey = new Map(stored.map((r) => [r.recKey, r]));
  const present = new Set(recs.map((r) => r.id));
  for (const rec of recs) {
    const row = byKey.get(rec.id);
    const verdict = await verdictFor({ rec: { ...rec, firstSeenAt: row ? iso(row.firstSeenAt) : ctx.now }, present: true }, ctx).catch(() => UNKNOWN);
    const next = nextRecState(row ? pureOf(row) : null, { present: true, verdict, now: ctx.now });
    if (!row) {
      const [ins] = await db
        .insert(schema.recommendationStates)
        .values({ orgId: org.id, siteId: ctx.site.id, recKey: rec.id, issueKey: rec.issueKey ?? rec.id, state: next.state, snapshot: snapshotOf(rec), evidence: next.evidence, firstSeenAt: now, lastSeenAt: now, stateAt: new Date(next.stateAt) })
        .onConflictDoNothing()
        .returning();
      if (ins) byKey.set(rec.id, ins);
      continue;
    }
    const changed = next.state !== row.state || next.evidence !== row.evidence || next.stateAt !== iso(row.stateAt);
    const stale = now.getTime() - new Date(row.lastSeenAt).getTime() > SEEN_EVERY_MS || String((row.snapshot as { title?: unknown }).title ?? '') !== rec.title;
    if (!changed && !stale) continue;
    const set = { state: next.state, evidence: next.evidence, stateAt: new Date(next.stateAt), lastSeenAt: now, snapshot: snapshotOf(rec), issueKey: rec.issueKey ?? row.issueKey, updatedAt: now };
    await db.update(schema.recommendationStates).set(set).where(eq(schema.recommendationStates.id, row.id));
    byKey.set(rec.id, { ...row, ...set });
  }
  for (const row of stored) {
    if (present.has(row.recKey) || !['open', 'in_progress', 'failed', 'waiting_for_google'].includes(row.state)) continue;
    const verdict = await verdictFor({ rec: { ...recOf(row), firstSeenAt: iso(row.firstSeenAt) }, present: false }, ctx).catch(() => UNKNOWN);
    const next = nextRecState(pureOf(row), { present: false, verdict, now: ctx.now });
    if (next.state === row.state && next.evidence === row.evidence) continue;
    const set = { state: next.state, evidence: next.evidence, stateAt: new Date(next.stateAt), updatedAt: now };
    await db.update(schema.recommendationStates).set(set).where(eq(schema.recommendationStates.id, row.id));
    byKey.set(row.recKey, { ...row, ...set });
  }
  return byKey;
}

/** The item with its state, the date and the line that set it. */
export function decorate(rec: Recommendation, row: RecommendationStateRow | undefined): Recommendation {
  if (!row) return rec;
  return {
    ...rec,
    state: row.state,
    stateAt: iso(row.stateAt),
    ...(row.evidence ? { stateEvidence: row.evidence } : {}),
    firstSeenAt: iso(row.firstSeenAt),
    ...(row.state === 'dismissed' ? { dismissed: { reason: dismissReasonLabel(row.dismissedReason), note: row.dismissedNote, at: iso(row.stateAt) } } : {}),
  };
}

/** The four tabs from the computed list (queue order) and the stored rows. Pure. */
export function boardOf(recs: readonly Recommendation[], rows: ReadonlyMap<string, RecommendationStateRow>, now = Date.now()): RecommendationBoard {
  const recent = (r: RecommendationStateRow) => now - new Date(r.stateAt).getTime() <= RESOLVED_SHOWN_DAYS * 864e5;
  const present = new Set(recs.map((r) => r.id));
  const shown = recs.map((r) => decorate(r, rows.get(r.id)));
  const gone = [...rows.values()].filter((r) => !present.has(r.recKey));
  const goneIn = (st: RecommendationState) => gone.filter((r) => r.state === st).sort((a, b) => new Date(b.stateAt).getTime() - new Date(a.stateAt).getTime()).map((r) => decorate(recOf(r), r));
  return {
    todo: shown.filter((r) => !r.state || TODO_STATES.has(r.state)),
    waiting: [...shown.filter((r) => r.state === 'waiting_for_google'), ...goneIn('waiting_for_google')],
    resolved: [...shown.filter((r) => r.state === 'resolved'), ...goneIn('resolved').filter((r) => recent(rows.get(r.id)!))],
    expired: goneIn('expired').filter((r) => recent(rows.get(r.id)!)),
    dismissed: [...shown.filter((r) => r.state === 'dismissed'), ...goneIn('dismissed')],
    dismissReasons: DISMISS_REASONS.map((r) => ({ ...r })),
  };
}

// ------------------------------------------------------------------------------------------------------------------- reads used by the screens

let indexReader: (domain: string) => Promise<IndexPageRow[]> = async (domain) => (await import('./indexing')).indexPageRows(domain, [], 2000);
/** tests and Index coverage (package C) may hand their own reader of the daily index check's page rows */
export function setIndexPageReader(fn: (domain: string) => Promise<IndexPageRow[]>): void {
  indexReader = fn;
}

/** The context the verifiers read, built from what the caller already loaded. */
export function verifyContext(site: Pick<SiteRow, 'id' | 'domain'>, x: SiteBundle, tasks: readonly SiteTask[] | undefined, now = new Date()): RecVerifyContext {
  let pages: Promise<Map<string, IndexPageRow>> | null = null;
  return {
    site,
    x,
    tasks,
    now: now.toISOString(),
    indexPages: () =>
      (pages ??= indexReader(site.domain)
        .then((rows) => new Map(rows.map((r) => [pageKey(String(r.url)), r] as const)))
        .catch(() => new Map<string, IndexPageRow>())),
  };
}

/** The whole board for one website (the Recommendations page). */
export async function recommendationBoard(org: Pick<OrgRow, 'id'>, site: SiteRow, x: SiteBundle, tasks: readonly SiteTask[] | undefined, recs: readonly Recommendation[]): Promise<RecommendationBoard> {
  const rows = await syncRecommendationStates(org, verifyContext(site, x, tasks), recs);
  return boardOf(recs, rows);
}

/** The to-do list (Overview, Pipeline, the plain GET): what is not waiting, resolved or dismissed. A storage failure keeps the list as computed. */
export async function todoRecommendations(org: Pick<OrgRow, 'id'>, site: SiteRow, x: SiteBundle, tasks: readonly SiteTask[] | undefined, recs: readonly Recommendation[]): Promise<Recommendation[]> {
  try {
    return (await recommendationBoard(org, site, x, tasks, recs)).todo;
  } catch {
    return [...recs];
  }
}

// ------------------------------------------------------------------------------------------------------------------- the client's buttons

const keyOf = (body: unknown) => String((body as Record<string, unknown> | null)?.key ?? '').trim().slice(0, 600);

async function rowFor(siteId: string, key: string): Promise<RecommendationStateRow> {
  if (!key) throw badRequest('Which recommendation? (key is missing)');
  const [row] = await db.select().from(schema.recommendationStates).where(and(eq(schema.recommendationStates.siteId, siteId), eq(schema.recommendationStates.recKey, key))).limit(1);
  if (!row) throw notFound('This recommendation is not on the list for this website any more.');
  return row;
}

/** "Not relevant": dismissed with a reason (and a line for "another reason"); a step on the website is skipped with it. Members and above. */
export async function dismissRecommendation(a: SiteAccess, req: FastifyRequest, body: unknown): Promise<Recommendation> {
  const key = keyOf(body);
  const b = (body ?? {}) as Record<string, unknown>;
  const reason = String(b.reason ?? '');
  const note = String(b.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!DISMISS_REASONS.some((r) => r.id === reason)) throw badRequest(`Choose a reason: ${DISMISS_REASONS.map((r) => r.id).join(', ')}.`);
  if (reason === 'other' && !note) throw badRequest('Say in a few words why it does not apply.');
  const row = await rowFor(a.site.id, key);
  const now = new Date();
  const set = { state: 'dismissed' as const, stateAt: now, evidence: `Dismissed: ${dismissReasonLabel(reason)}${note ? `. ${note}` : ''}`, dismissedReason: reason, dismissedNote: note, byUser: a.user.id, updatedAt: now };
  await db.update(schema.recommendationStates).set(set).where(eq(schema.recommendationStates.id, row.id));
  const taskKey = String((row.snapshot as { taskKey?: unknown }).taskKey ?? '');
  if (taskKey) await import('./siteTasks').then((m) => m.skipSiteTask(a, req, { key: taskKey }, true)).catch(() => undefined);
  await audit(req, a.org.id, { action: 'recommendation.dismissed', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { recommendation: key, reason, note } });
  return decorate(recOf(row), { ...row, ...set });
}

/** Bring a dismissed item back (it is open again, and its step on the website too). */
export async function restoreRecommendation(a: SiteAccess, req: FastifyRequest, body: unknown): Promise<Recommendation> {
  const key = keyOf(body);
  const row = await rowFor(a.site.id, key);
  if (row.state !== 'dismissed') throw badRequest('This recommendation is not dismissed.');
  const now = new Date();
  const set = { state: 'open' as const, stateAt: now, evidence: 'Brought back by you.', dismissedReason: '', dismissedNote: '', byUser: a.user.id, updatedAt: now };
  await db.update(schema.recommendationStates).set(set).where(eq(schema.recommendationStates.id, row.id));
  const taskKey = String((row.snapshot as { taskKey?: unknown }).taskKey ?? '');
  if (taskKey) await import('./siteTasks').then((m) => m.skipSiteTask(a, req, { key: taskKey }, false)).catch(() => undefined);
  await audit(req, a.org.id, { action: 'recommendation.restored', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { recommendation: key } });
  return decorate(recOf(row), { ...row, ...set });
}

/**
 * "Check now": the item's own check, at once. A step on the website runs its check (as on the Pipeline); an audit finding asks the daily
 * page watch to read it again tonight; any other family reads our newest data again (the index check, the link check, the content log).
 * Answers the item as it stands after the check.
 */
export async function checkRecommendation(a: SiteAccess, req: FastifyRequest, body: unknown): Promise<Recommendation> {
  const key = keyOf(body);
  const row = await rowFor(a.site.id, key);
  const snap = recOf(row);
  if (snap.taskKey) await import('./siteTasks').then((m) => m.checkSiteTask(a, req, { key: snap.taskKey }));
  const { loadBundle, recommend } = await import('./recommendations');
  const x = await loadBundle(a.org, a.site);
  if (key.startsWith('tech:') && x.technical.selectedAuditId && !snap.taskKey) {
    const { requestRecheck } = await import('./pageWatch');
    await requestRecheck(a.site.domain, x.technical.selectedAuditId, key.slice('tech:'.length)).catch(() => undefined);
  }
  const tasks = a.site.verifiedAt ? await import('./siteTasks').then((m) => m.siteTasksOf(a.org, a.site, req.log)).catch(() => undefined) : undefined;
  const recs = recommend(a.site, x, tasks);
  const board = await recommendationBoard(a.org, a.site, x, tasks, recs);
  const all = [...board.todo, ...board.waiting, ...board.resolved, ...board.expired, ...board.dismissed];
  const found = all.find((r) => r.id === key);
  await audit(req, a.org.id, { action: 'recommendation.checked', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { recommendation: key, state: found?.state ?? '' } });
  if (!found) throw notFound('This recommendation is not on the list for this website any more.');
  return found;
}
