import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import {
  AUTOPILOT_LEVELS,
  CARRY_APPROVAL_DAYS,
  SKIPS_COLUMNS,
  cycleDateOf,
  engineRowIsDomain,
  itemKey as itemKeyOf,
  n8nSiteId,
  PAGE_IN_FLIGHT_HOURS,
  roleAtLeast,
  skipKey,
  type AutopilotLevel,
  type ComingUpDecisionResult,
  type ComingUpItem,
  type ComingUpItemResult,
  type ComingUpNotWritten,
  type ComingUpOutcome,
  type ComingUpOutcomePage,
  type ComingUpView,
  type CycleJobRow,
  type CycleRow,
  type CyclePreview,
  type ContentLogRow,
  type CyclePreviewItem,
  type Role,
  type SkipRow,
  type TopicSource,
} from '@seo/shared';
import { db, schema } from '../db';
import type { CyclePreviewRow, OrgRow, SiteRow, UserRow } from '../db/schema';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { deleteRows, ensureTable, rows as n8nRows, siteRows, upsertRow } from '../n8n/client';
import { wholeCreditsOfUsd as creditsOfUsd } from './admin/settings';
import { billingContacts } from './invoices';
import { baseUrlFor, senderFor } from './portalMail';
import { contentCycleNote, loadCycleRows, localDayName, siteCycleView, siteTimezone } from './cycles';
import { assertEngineSiteIsOurs, foreignEngineDomain } from './engineSite';

// The weekly "Coming up" plan (SCHEDULING_KEYWORDS_PLAN.md §5.7, §14.4, §14.6): 48 hours before each cycle the engine plans exactly what
// that cycle would write and posts it (callback stage `cycle_preview`, nothing written). The app keeps the latest plan of each cycle
// (`cycle_previews`), shows it with the client's decisions, e-mails it once, and writes each decision to the engine's `seo_skips` (the
// real cycle's cadence honours them: a skipped item is not written, an approved needs-OK item is written within the pages a week).
// Decisions: owners, admins and members (viewers cannot); Skip for any item, Approve only for an item that waits for an OK (an
// automatic item is written anyway), and only for this cycle (the engine reads approvals per cycle). An approval clears an "always
// skip" of the same item, so the client's newest word wins. Every decision is in the company's audit log.

const S = (v: unknown) => String(v == null ? '' : v).trim();
const SOURCES: TopicSource[] = ['ladder', 'decay', 'striking', 'trend', 'ai_answer', 'ai_refresh'];
const asSource = (v: unknown): TopicSource => (SOURCES.includes(S(v) as TopicSource) ? (S(v) as TopicSource) : 'ladder');
const asLevel = (v: unknown): AutopilotLevel => (Number(v) === 1 || Number(v) === 3 ? (Number(v) as AutopilotLevel) : 2);

/** The preview body is the engine's: read every field defensively (an older engine may leave some out). */
export function previewOf(body: Record<string, unknown>): CyclePreview {
  const recheckIds = new Set(
    (Array.isArray(body.recheck_ladders) ? body.recheck_ladders : []).map((x) => (x && typeof x === 'object' ? S((x as Record<string, unknown>).ladder_id) : S(x))).filter(Boolean),
  );
  const list = (v: unknown): CyclePreviewItem[] =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !!S((x as Record<string, unknown>).keyword))
      .map((x) => ({
        item_key: S(x.item_key) || itemKeyOf(S(x.keyword)),
        keyword: S(x.keyword),
        source: asSource(x.source),
        page_type: S(x.page_type),
        existing_page_url: S(x.existing_page_url),
        ladder_id: S(x.ladder_id),
        rung: Number(x.rung) || 0,
        why: S(x.why),
        auto: x.auto === true,
        est_usd: Number(x.est_usd) > 0 ? Number(x.est_usd) : 0,
        ai_target: x.ai_target && typeof x.ai_target === 'object' ? (x.ai_target as CyclePreviewItem['ai_target']) : null,
        // the engine marks the item, or lists its ladder in recheck_ladders (its preview items do not carry the flag)
        recheck: x.recheck === true || recheckIds.has(S(x.ladder_id)),
        // P1: held until the author profile and the business facts are on file
        ...(x.held === 'profile' ? { held: 'profile' as const } : {}),
        ...(x.approved === true ? { approved: true } : {}),
        // an approval would not reach this suggestion (the engine says so; an older engine never marks it)
        ...(x.not_approvable === true ? { not_approvable: true } : {}),
        // written on top of the pages a week (an older engine does not mark it: its reason says so)
        ...(x.on_top === true || /on top of your pages a week/i.test(S(x.why)) ? { on_top: true } : {}),
      }));
  const recheck_ladders = (Array.isArray(body.recheck_ladders) ? body.recheck_ladders : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !!S((x as Record<string, unknown>).ladder_id))
    .map((x) => ({ ladder_id: S(x.ladder_id), head: S(x.head), planned_at: S(x.planned_at), reason: S(x.reason) }));
  const b = body.budget && typeof body.budget === 'object' ? (body.budget as Record<string, unknown>) : null;
  const pr = S(body.paused_reason);
  return {
    stage: 'cycle_preview',
    site_id: S(body.site_id),
    domain: S(body.domain),
    cycle_key: S(body.cycle_key),
    scheduled_for: S(body.scheduled_for),
    level: asLevel(body.level),
    pages_per_week: Number(body.pages_per_week) || 0,
    waiting_for_keyword: body.waiting_for_keyword === true,
    paused_reason: pr === 'pileup' || pr === 'site_paused' ? pr : '',
    items: list(body.items),
    suggestions: list(body.suggestions),
    cycle_date: S(body.cycle_date) || cycleDateOf(S(body.cycle_key)),
    reason: S(body.reason),
    refused: (Array.isArray(body.refused) ? body.refused : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({ keyword: S(x.keyword), source: S(x.source), reason: S(x.reason), detail: S(x.detail) })),
    recheck_ladders,
    waiting_for_profile: body.waiting_for_profile === true,
    readiness: body.readiness && typeof body.readiness === 'object'
      ? { ready: (body.readiness as Record<string, unknown>).ready === true, missing: (Array.isArray((body.readiness as Record<string, unknown>).missing) ? ((body.readiness as Record<string, unknown>).missing as unknown[]) : []).map(String), missing_text: S((body.readiness as Record<string, unknown>).missing_text) }
      : null,
    approved_not_written: (Array.isArray(body.approved_not_written) ? body.approved_not_written : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !!S((x as Record<string, unknown>).keyword))
      .map((x) => ({ keyword: S(x.keyword), source: S(x.source), reason: S(x.reason), detail: S(x.detail) })),
    ...(b
      ? {
          budget: {
            pages_per_week: Number(b.pages_per_week) || 0,
            spent: Number(b.spent) || 0,
            room: Number(b.room) || 0,
            window_start: S(b.window_start),
            ladder_start_window: S(b.ladder_start_window),
          },
        }
      : {}),
  };
}

/** Words about our own machinery that never reach a customer (cycles.ts has the same rule for job reasons). */
const INTERNAL = /execution|ledger|seo_|n8n|workflow|run guard|skip_jobs|target_id|ait_/i;

/** The engine's plain cause as the middle of a sentence: no internal words, no dashes or ellipses, no closing full stop. */
export function plainDetail(v: unknown): string {
  let t = S(v).replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\u2026/g, '').replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.;:,\s]+$/, '');
  if (!t || INTERNAL.test(t)) return '';
  if (t.length > 240) t = t.slice(0, 239).replace(/\s+\S*$/, '');
  // "The question left ..." reads as "...was not used: the question left ...", but "AI" or "UAE" keep their capitals
  return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/** Why an approval is not written this cycle, in the customer's words (the engine's reason codes and details never reach the page). */
export function notWrittenMessage(x: { keyword: string; reason: string; detail?: string }, ctx: { pagesPerWeek?: number } = {}): ComingUpNotWritten {
  const q = `"${x.keyword}"`;
  switch (x.reason) {
    case 'ambiguous': {
      const n = Number((S(x.detail).match(/(\d+) different pages/) ?? [])[1]) || 2;
      return { keyword: x.keyword, reason: 'ambiguous', message: `Your OK for ${q} was not used: ${n} different pages share this search, so we did not know which one you meant. Approve the one you want again.` };
    }
    case 'pileup':
      return { keyword: x.keyword, reason: 'pileup', message: `Your OK for ${q} waits: pages we already wrote are waiting to be published. Publish them and it is written in a later cycle once you approve it again.` };
    case 'covered_by_live_page':
      return { keyword: x.keyword, reason: 'covered_by_live_page', message: `${q} is not written: a page of your website already answers this search.` };
    case 'budget':
      // APPROVALS FIRST (owner 2026-11-16): it is carried to the next plan by itself (carryApprovals), ahead of the automatic pages
      if (ctx.pagesPerWeek === 0) return { keyword: x.keyword, reason: 'budget', message: `${q} is not written: no pages a week are set for this website. Set them in the website's settings to have pages written.` };
      return { keyword: x.keyword, reason: 'budget', message: `${q} did not fit in this cycle: this week's pages were already used. We bring it back in your next plan by itself and write it there before the automatic pages, as long as it is still a page we would write.` };
    case 'same_page': {
      // client report 2026-11-16 b: the page this approval would change already has another change this week (another page of the plan, or a
      // run of the last 7 days), and a page is changed once a week
      const where = /^https?:\/\//i.test(S(x.detail)) ? ` (${S(x.detail).replace(/^https?:\/\/[^/]+/i, '') || '/'})` : '';
      return { keyword: x.keyword, reason: 'same_page', message: `${q} waits: the page of your website it would change${where} already has another change this week, and we change a page only once a week. We bring it back in your next plan by itself, as long as it is still a page we would write.` };
    }
    case 'profile':
      return { keyword: x.keyword, reason: 'profile', message: `Your OK for ${q} waits: no page is written until your author profile and business facts are on file (Website settings).` };
    case 'no_longer_offered': {
      // I3 (2026-11-10): the item stopped being a candidate before the run (e.g. its question left the AI panel); the engine says why
      const why = plainDetail(x.detail);
      return { keyword: x.keyword, reason: 'no_longer_offered', message: `Your OK for ${q} was not used: ${why || 'this page was no longer offered when the run started'}. Use Write it now if you still want this page.` };
    }
    default:
      return { keyword: x.keyword, reason: 'other', message: `${q} is not written in this cycle.` };
  }
}

/**
 * Whether a plan may be kept (pure): a cycle key of this website, a valid due time (a plan without one would sort first for ever and
 * could never close), and, when the plan names a domain, this website's domain (two domains can share one engine site id).
 */
export function previewRefusal(site: Pick<SiteRow, 'domain'>, body: Record<string, unknown>): string | null {
  const cycleKey = S(body.cycle_key);
  if (!/^cyc:.+:\d{4}-\d{2}-\d{2}$/.test(cycleKey)) return 'no cycle key';
  if (!cycleKey.startsWith(`cyc:${n8nSiteId(site.domain)}:`)) return 'the cycle key is not this website\'s';
  if (S(body.domain) && !engineRowIsDomain(body.domain, site.domain)) return 'the plan names another domain';
  const t = Date.parse(S(body.scheduled_for));
  if (!Number.isFinite(t) || t <= 0) return 'no valid scheduled_for';
  return null;
}

/** Keeps the latest plan of each cycle of the website (a re-made preview replaces the earlier one). null when it is refused (previewRefusal). */
export async function storePreview(org: OrgRow, site: SiteRow, body: Record<string, unknown>, reportId: string | null): Promise<CyclePreviewRow | null> {
  if (previewRefusal(site, body)) return null;
  const cycleKey = S(body.cycle_key);
  const values = { orgId: org.id, siteId: site.id, cycleKey, scheduledFor: new Date(Date.parse(S(body.scheduled_for))), body, reportId, receivedAt: new Date() };
  const [row] = await db
    .insert(schema.cyclePreviews)
    .values(values)
    // review 2026-11-16: a re-made or re-delivered plan of the same cycle keeps its FIRST arrival time: an approval is "carried" only when it is older
    // than the plan was first offered, and the pages since the plan are counted from then
    .onConflictDoUpdate({ target: [schema.cyclePreviews.siteId, schema.cyclePreviews.cycleKey], set: { body, reportId, scheduledFor: values.scheduledFor } })
    .returning();
  return row ?? null;
}

/** The website's latest plan (the cycle due next, or the newest one received). */
export async function latestPreview(siteId: string): Promise<CyclePreviewRow | null> {
  // NULLS LAST: a plan stored before due times were required has none, and must never pin "Coming up" ahead of the real next cycle
  return (await db.query.cyclePreviews.findFirst({ where: eq(schema.cyclePreviews.siteId, siteId), orderBy: [sql`${schema.cyclePreviews.scheduledFor} desc nulls last`, desc(schema.cyclePreviews.receivedAt)] })) ?? null;
}

const decisionOf = (skips: SkipRow[], siteId: string, cycleKey: string, key: string, planAt = Infinity): ComingUpItem['decision'] => {
  const mine = skips
    .filter((r) => S(r.site_id) === siteId && itemKeyOf(S(r.item_key)) === key && (S(r.scope) === 'always' || S(r.cycle_key) === cycleKey))
    .sort((a, b) => S(b.created_at).localeCompare(S(a.created_at)));
  // the engine's rule: a skip beats an approval, whatever the order
  const r = mine.find((x) => S(x.decision) === 'skip') ?? mine[0];
  if (!r) return null;
  const approve = S(r.decision) === 'approve';
  // an approval older than the plan itself was carried to it (carryApprovals keeps the first approval time): nobody can approve a plan before it arrives
  const carried = approve && S(r.scope) !== 'always' && Date.parse(S(r.created_at)) < planAt;
  return { decision: approve ? 'approve' : 'skip', scope: S(r.scope) === 'always' ? 'always' : 'cycle', by: S(r.by), at: S(r.created_at), ...(carried ? { carried: true } : {}) };
};

/**
 * APPROVALS FIRST (owner 2026-11-16, pure; the engine's order in Cadence_Plan.js): where each page of an upcoming plan stands in this week's pages.
 * The client's approvals take the pages a week first, the earliest approval first, then the automatic pages in the plan's order; a page written on
 * top of the pages a week, a skipped one and one held for the profile take none. An approval past the pages is `over` (carried to the next plan);
 * an automatic page past them is `moved`. An item still waiting for an OK says what approving it would move (`approveMoves`) or that it would wait
 * (`approveOver`). The run can still hold a page for a reason the plan cannot know (a page changed twice in a week); its report then says why.
 */
export function planSlots(o: { items: ComingUpItem[]; suggestions: ComingUpItem[]; room: number; onTop: ReadonlySet<string>; noApprove?: ReadonlySet<string> }): { items: ComingUpItem[]; suggestions: ComingUpItem[] } {
  const room = Math.max(0, Math.floor(Number(o.room) || 0));
  const all = [...o.items, ...o.suggestions.filter((s) => !o.items.some((i) => i.itemKey === s.itemKey))];
  // an approval the engine would not reach (a suggestion marked not approvable) takes no page: the run ignores it
  const counts = (i: ComingUpItem) => !i.held && i.decision?.decision !== 'skip' && !o.onTop.has(i.itemKey) && !(i.decision?.decision === 'approve' && !i.auto && o.noApprove?.has(i.itemKey));
  const approved = all.filter((i) => counts(i) && i.decision?.decision === 'approve').sort((a, b) => S(a.decision?.at).localeCompare(S(b.decision?.at)));
  const autos = o.items.filter((i) => counts(i) && i.auto && i.decision?.decision !== 'approve');
  const slot = new Map<string, ComingUpItem['slot']>();
  approved.forEach((i, n) => slot.set(i.itemKey, n < room ? 'this_week' : 'over'));
  autos.forEach((i, n) => slot.set(i.itemKey, approved.length + n < room ? 'this_week' : 'moved'));
  const next = room - approved.length - 1;
  const mark = (i: ComingUpItem): ComingUpItem => {
    const s = slot.get(i.itemKey);
    if (s) return { ...i, slot: s };
    if (!i.canApprove || i.held || i.decision) return i;
    if (approved.length >= room) return { ...i, approveOver: true };
    const moved = next >= 0 && next < autos.length ? autos[next] : null;
    return moved ? { ...i, approveMoves: moved.keyword } : i;
  };
  return { items: o.items.map(mark), suggestions: o.suggestions.map(mark) };
}

/** I3: what the app knows of the plan's run: its writing job, the cycle being worked on, the run's content report and its pages' reports. */
export interface PlanRun {
  /** the cycle's content_cadence job row (seo_cycle_jobs), if the engine has one */
  job: Pick<CycleJobRow, 'status' | 'finished_at'> | null;
  /** seo_cycles.current_key */
  currentKey: string;
  /** the app's content_cadence report of the same cycle_key */
  report: { payload: Record<string, unknown>; receivedAt: Date } | null;
  /** the reports of the pages that run started (by their request id) */
  pageReports: { id: string; requestId: string | null; status: string; receivedAt: Date }[];
  nextPreviewAt: string | null;
  nextDueAt: string | null;
}

/** After this long with no word of the run, its plan is treated as done (nothing says what it wrote). */
const RUN_SILENT_MS = 24 * 3_600_000;

/** I3 (pure): where a plan's run stands. Not due: upcoming. Due: done once its writing job finished, its report came, or a later cycle began. */
export function planPhase(o: { due: number; now: number; cycleKey: string; run?: Pick<PlanRun, 'job' | 'currentKey' | 'report'> | null }): 'upcoming' | 'running' | 'done' {
  if (!Number.isFinite(o.due) || o.due > o.now) return 'upcoming';
  const st = S(o.run?.job?.status);
  if (['done', 'skipped', 'gave_up'].includes(st)) return 'done';
  if (o.run?.report) return 'done';
  const cur = S(o.run?.currentKey);
  if (cur && cur !== o.cycleKey && cycleDateOf(cur) > cycleDateOf(o.cycleKey)) return 'done';
  return o.now - o.due > RUN_SILENT_MS ? 'done' : 'running';
}

const arrOf = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
const isoOf = (v: unknown): string | null => {
  const t = v instanceof Date ? v.getTime() : Date.parse(S(v));
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null;
};

/** I3 (pure): what a finished run wrote, from its own content report (pages, pause) and the reports its pages sent since. */
export function runOutcome(run: Pick<PlanRun, 'job' | 'report' | 'pageReports'> | null | undefined, now: number = Date.now()): ComingUpOutcome {
  const p = run?.report?.payload ?? null;
  if (!p) return { known: false, at: isoOf(run?.job?.finished_at), pages: [], pausedReason: '', waitingPublish: 0, note: '' };
  const startedAt = isoOf(run?.report?.receivedAt);
  const pages: ComingUpOutcomePage[] = arrOf(p.pages)
    .filter((x) => S(x.keyword))
    .map((x) => {
      const reqId = S(x.request_id);
      const mine = (run?.pageReports ?? []).filter((r) => reqId && S(r.requestId) === reqId).sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
      const done = mine.find((r) => S(r.status) !== 'failed' && S(r.status) !== 'progress');
      // S1-05: a page with no report PAGE_IN_FLIGHT_HOURS after its run started did not finish (cancelled at its time limit, or cut off)
      const startT = Date.parse(S(run?.report?.receivedAt instanceof Date ? run.report.receivedAt.toISOString() : run?.report?.receivedAt));
      const failed = !done && (mine.find((r) => S(r.status) === 'failed') || (Number.isFinite(startT) && now - startT >= PAGE_IN_FLIGHT_HOURS * 3600_000));
      return {
        keyword: S(x.keyword),
        source: asSource(x.source),
        approved: x.approved === true,
        state: done ? ('written' as const) : failed ? ('failed' as const) : ('started' as const),
        at: done ? isoOf(done.receivedAt) : startedAt,
        reportId: done ? done.id : null,
      };
    });
  const pr = S(p.paused_reason);
  const key = S(p.cycle_key);
  const note = pages.length ? '' : S(contentCycleNote(p)[key]?.content_cadence).replace(/^Wrote nothing:\s*/, '');
  return { known: true, at: startedAt ?? isoOf(run?.job?.finished_at), pages, pausedReason: pr === 'pileup' || pr === 'site_paused' ? pr : '', waitingPublish: Number(p.waiting_publish) || 0, note };
}

/** client report 2026-11-16 b: the content-log fields Coming up reads to follow a page after the run (who wrote it, whether it is live) */
export type PlanLogRow = Pick<ContentLogRow, 'keyword' | 'status' | 'published_url' | 'published_at' | 'started_at' | 'request_id'>;
/** client report 2026-11-16 b: the website's pages, for following a plan's pages after its run */
export interface PlanPages {
  logs: readonly PlanLogRow[];
  /** the app's report of a page run (its request id), when it arrived */
  reportOf: (requestId: string) => string | null;
}

const tOf = (v: unknown): number => Date.parse(S(v));
/**
 * Live: published, or a published address dated on or after the row's start. The engine keeps one content-log row per search and keeps the old
 * address when the page is written again, so a page rewritten and not yet republished is NOT live (review H1; the engine's _waiting.js agrees).
 */
const isLive = (l: PlanLogRow | null | undefined): boolean =>
  !!l && (S(l.status) === 'published' || (!!S(l.published_url) && Number.isFinite(tOf(l.published_at)) && tOf(l.published_at) >= tOf(l.started_at)));
const hasPage = (l: PlanLogRow): boolean => isLive(l) || ['written', 'not_ready'].includes(S(l.status));
const newestFirst = (a: PlanLogRow, b: PlanLogRow): number => Number(isLive(b)) - Number(isLive(a)) || S(b.started_at).localeCompare(S(a.started_at));
/** where a page is live and since when, and whether its draft needs a fix ({} for a written page that waits to be published) */
const pageState = (l: PlanLogRow | null | undefined): { publishedUrl?: string; publishedAt?: string | null; needsFix?: boolean } =>
  !l ? {} : isLive(l) ? { publishedUrl: S(l.published_url), publishedAt: isoOf(l.published_at) } : S(l.status) === 'not_ready' ? { needsFix: true } : {};
/** who had a page written, from its run's request id: a person in the app or the form (the engine's execution id, or app-...), else a system run */
export const byOfRequest = (id: string): 'you' | 'later' => (/^\d+$|^app-/.test(S(id)) ? 'you' : 'later');

/**
 * (pure) the content-log row of one page of the plan: the run's own row (its request id), else the newest live or written row of the same search
 * that is this plan's (started since the plan was offered, or its page report arrived since: a row written again keeps its first start date)
 */
export function planPageLog(logs: readonly PlanLogRow[], keyword: string, requestId = '', sinceMs = -Infinity, reportOf?: (id: string) => string | null): PlanLogRow | null {
  const rid = S(requestId);
  if (rid) {
    const own = logs.find((l) => S(l.request_id) === rid);
    if (own) return own;
  }
  const k = itemKeyOf(keyword);
  const fresh = (l: PlanLogRow) => tOf(l.started_at) >= sinceMs || !!reportOf?.(S(l.request_id));
  return logs.filter((l) => itemKeyOf(S(l.keyword)) === k && hasPage(l) && fresh(l)).sort(newestFirst)[0] ?? null;
}

/**
 * (pure) client report 2026-11-16 b (devaicon.com): a page for an approved item that the run did not write, written for the same search after the
 * plan was offered: written or published (live first), or still being written. A row counts when it started since the plan was offered or its
 * page report arrived since (the app reopens an existing row and keeps its start date: review M2). The plan's own runs are not one (`exclude`:
 * their request ids; review M3). A failed or held row wrote nothing; a `started` row older than PAGE_IN_FLIGHT_HOURS never finished.
 */
export function laterPage(pages: PlanPages, keyword: string, sinceMs: number, now: number = Date.now(), exclude: ReadonlySet<string> = new Set()): { state: 'written' | 'started'; log: PlanLogRow } | null {
  const k = itemKeyOf(keyword);
  if (!k || !Number.isFinite(sinceMs)) return null;
  const rows = pages.logs.filter((l) => itemKeyOf(S(l.keyword)) === k && !exclude.has(S(l.request_id)) && (tOf(l.started_at) >= sinceMs || !!pages.reportOf(S(l.request_id))));
  const done = rows.filter(hasPage).sort(newestFirst)[0];
  if (done) return { state: 'written', log: done };
  const going = rows.filter((l) => S(l.status) === 'started' && now - tOf(l.started_at) < PAGE_IN_FLIGHT_HOURS * 3600_000).sort((a, b) => S(b.started_at).localeCompare(S(a.started_at)))[0];
  return going ? { state: 'started', log: going } : null;
}

/**
 * (pure) client report 2026-11-16 b: an approved item's result followed past its run. The run did not write it (or its page failed) and the same
 * search was written since the plan was offered: that page (`by: 'you'` when a person started it, `later` for a system run). A page the run
 * wrote: where it is live, or that its draft needs a fix. Anything else as it was.
 */
export function followResult(r: ComingUpItemResult | null, keyword: string, pages: PlanPages | null | undefined, sinceMs: number, requestId = '', now: number = Date.now(), exclude: ReadonlySet<string> = new Set()): ComingUpItemResult | null {
  if (!r || !pages) return r;
  if (r.state === 'not_written' || r.state === 'failed') {
    const lp = laterPage(pages, keyword, sinceMs, now, exclude);
    if (!lp) return r;
    const rid = S(lp.log.request_id);
    return { state: lp.state, at: isoOf(lp.log.started_at), reportId: pages.reportOf(rid), message: '', by: byOfRequest(rid), ...(lp.state === 'written' ? pageState(lp.log) : {}) };
  }
  return { ...r, by: r.by ?? 'run', ...(r.state === 'written' ? pageState(planPageLog(pages.logs, keyword, requestId, sinceMs, pages.reportOf)) : {}) };
}

/**
 * I3 (pure): what became of one approved item once its run is done. Written / started / failed from the run's pages; not written with the
 * reason the run gave (its content report), else the plan's own, else the pile-up the run reported, else no reason at all (none invented).
 */
export function approvedResult(o: { keyword: string; outcome: ComingUpOutcome; reported: CyclePreview['approved_not_written']; planned: CyclePreview['approved_not_written'] }): ComingUpItemResult | null {
  if (!o.outcome.known) return null;
  const k = itemKeyOf(o.keyword);
  const page = o.outcome.pages.find((x) => itemKeyOf(x.keyword) === k);
  if (page)
    return {
      state: page.state,
      at: page.at,
      reportId: page.reportId,
      message: page.state === 'failed' ? 'Started in that run, but the page could not be finished. Use Write it now to try again.' : '',
    };
  const why = (o.reported ?? []).find((x) => itemKeyOf(x.keyword) === k) ?? (o.planned ?? []).find((x) => itemKeyOf(x.keyword) === k);
  if (why) return { state: 'not_written', at: null, reportId: null, message: notWrittenMessage({ keyword: o.keyword, reason: why.reason, detail: why.detail }).message };
  if (o.outcome.pausedReason === 'pileup') return { state: 'not_written', at: null, reportId: null, message: notWrittenMessage({ keyword: o.keyword, reason: 'pileup' }).message };
  return { state: 'not_written', at: null, reportId: null, message: 'Not written in that run.' };
}

/** The view of one plan (pure): items in credits, each with the client's decision on it. */
export function comingUpView(o: { site: Pick<SiteRow, 'id' | 'domain'>; preview: CyclePreviewRow | null; skips: SkipRow[]; role: Role; now: number; credits: (usd: number) => number; run?: PlanRun | null; pages?: PlanPages | null }): ComingUpView {
  const canDecide = roleAtLeast(o.role, 'member');
  const next = { nextPreviewAt: futureIso(o.run?.nextPreviewAt, o.now), nextDueAt: futureIso(o.run?.nextDueAt, o.now) };
  if (!o.preview)
    return { available: false, cycleKey: '', cycleDate: '', scheduledFor: null, receivedAt: null, level: 2, pagesPerWeek: 0, waitingForKeyword: false, pausedReason: '', reason: '', items: [], suggestions: [], refused: [], autoCredits: 0, canDecide, closed: false, phase: 'upcoming', outcome: null, ...next, approvedNotWritten: [], recheckLadders: [], budget: null, waitingForProfile: false, missingText: '' };
  const p = previewOf(o.preview.body);
  const siteId = n8nSiteId(o.site.domain);
  const due = o.preview.scheduledFor?.getTime() ?? Date.parse(p.scheduled_for);
  const closed = Number.isFinite(due) && due <= o.now;
  const phase = planPhase({ due, now: o.now, cycleKey: p.cycle_key, run: o.run });
  const outcome0 = phase === 'done' ? runOutcome(o.run, o.now) : null;
  // client report 2026-11-16 b: the plan's pages are followed past the run (whether each one is live now, and an approval the client wrote since)
  const since = o.preview.receivedAt.getTime();
  const runReq = new Map(arrOf(o.run?.report?.payload.pages).map((x) => [itemKeyOf(S(x.keyword)), S(x.request_id)] as const));
  const runIds = new Set([...runReq.values()].filter(Boolean));
  const outcome =
    outcome0 && o.pages
      ? { ...outcome0, pages: outcome0.pages.map((pg) => (pg.state === 'written' ? { ...pg, ...pageState(planPageLog(o.pages!.logs, pg.keyword, runReq.get(itemKeyOf(pg.keyword)) ?? '', since, o.pages!.reportOf)) } : pg)) }
      : outcome0;
  // the run's own word on approvals it did not write (its content report); an older engine sends none
  const reported = o.run?.report ? previewOf({ approved_not_written: o.run.report.payload.approved_not_written }).approved_not_written : [];
  const toItem = (x: CyclePreviewItem): ComingUpItem => {
    const t = x.ai_target as (Record<string, unknown> & { question?: unknown }) | null | undefined;
    return {
      itemKey: x.item_key,
      keyword: x.keyword,
      source: x.source,
      pageType: x.page_type,
      existingPageUrl: x.existing_page_url,
      ladderId: x.ladder_id,
      rung: x.rung,
      why: x.why,
      auto: x.auto,
      credits: o.credits(x.est_usd),
      aiTarget: t && S(t.question)
        ? {
            targetId: S(t.target_id),
            question: S(t.question),
            kind: S(t.kind) === 'refresh' ? 'refresh' : 'answer',
            fanout: Array.isArray(t.fanout) ? t.fanout.map(String) : [],
            sources: (Array.isArray(t.sources) ? t.sources : []).map((s) => (s && typeof s === 'object' ? { url: S((s as Record<string, unknown>).u ?? (s as Record<string, unknown>).url), title: S((s as Record<string, unknown>).t ?? (s as Record<string, unknown>).title) } : { url: S(s), title: '' })).filter((s) => s.url),
            competitors: Array.isArray(t.competitors) ? t.competitors.map(String) : [],
          }
        : null,
      decision: decisionOf(o.skips, siteId, p.cycle_key, x.item_key, o.preview!.receivedAt.getTime()),
      canSkip: canDecide && !closed,
      // a page waiting for its fresh keyword check is not approvable: the check decides first
      canApprove: canDecide && !closed && !x.auto && !x.recheck && !x.not_approvable,
      recheck: x.recheck === true,
      held: x.held === 'profile',
    };
  };
  const withResult = (i: ComingUpItem): ComingUpItem =>
    outcome && i.decision?.decision === 'approve'
      ? { ...i, result: followResult(approvedResult({ keyword: i.keyword, outcome, reported, planned: p.approved_not_written }), i.keyword, o.pages, since, runReq.get(itemKeyOf(i.keyword)) ?? '', o.now, runIds) }
      : i;
  const items0 = p.items.map(toItem).map(withResult);
  const suggestions0 = p.suggestions.map(toItem).map(withResult);
  // APPROVALS FIRST: before the run, each page says whether it uses this week's pages (not while nothing is written: pile-up, profile, paused)
  // the pages written on top of the pages a week: marked by the engine; a plan stored before the mark keeps its level-3 AI page (the last AI pick)
  // out of the count when the plan says the AI page of the week is on top
  const onTop = new Set([...p.items, ...p.suggestions].filter((x) => x.on_top).map((x) => x.item_key));
  const aiPages = o.preview.body.ai_pages && typeof o.preview.body.ai_pages === 'object' ? (o.preview.body.ai_pages as Record<string, unknown>) : null;
  if (!onTop.size && aiPages?.this_week === true && aiPages?.on_top === true) {
    const lastAi = [...p.items].reverse().find((x) => x.auto && (x.source === 'ai_answer' || x.source === 'ai_refresh'));
    if (lastAi) onTop.add(lastAi.item_key);
  }
  const slotted =
    phase === 'upcoming' && !closed && !p.paused_reason && p.waiting_for_profile !== true && p.pages_per_week > 0
      ? planSlots({ items: items0, suggestions: suggestions0, room: p.budget ? p.budget.room : p.pages_per_week, onTop, noApprove: new Set(p.suggestions.filter((x) => x.not_approvable).map((x) => x.item_key)) })
      : { items: items0, suggestions: suggestions0 };
  const items = slotted.items;
  const suggestions = slotted.suggestions;
  // done: each approved row carries its own result; the list keeps only what no row of the plan shows
  const rowKeys = new Set([...items, ...suggestions].filter((i) => i.result).map((i) => i.itemKey));
  const notWritten = outcome ? [...(reported ?? []), ...(p.approved_not_written ?? [])].filter((x, n, all) => !rowKeys.has(itemKeyOf(x.keyword)) && all.findIndex((y) => itemKeyOf(y.keyword) === itemKeyOf(x.keyword)) === n) : (p.approved_not_written ?? []);
  return {
    available: true,
    cycleKey: p.cycle_key,
    cycleDate: p.cycle_date ?? '',
    scheduledFor: Number.isFinite(due) ? new Date(due).toISOString() : null,
    receivedAt: o.preview.receivedAt.toISOString(),
    level: p.level,
    pagesPerWeek: p.pages_per_week,
    waitingForKeyword: p.waiting_for_keyword,
    pausedReason: p.paused_reason as ComingUpView['pausedReason'],
    reason: p.reason ?? '',
    items,
    suggestions,
    refused: (p.refused ?? []).map((r) => ({ keyword: r.keyword, source: r.source, reason: r.reason, detail: r.detail })),
    // P1: a page held for the author profile and the business facts uses no credits in this cycle
    autoCredits: items.filter((i) => i.auto && !i.held && i.decision?.decision !== 'skip' && i.slot !== 'moved').reduce((t, i) => t + i.credits, 0),
    canDecide,
    closed,
    phase,
    outcome,
    ...next,
    approvedNotWritten: notWritten.map((x) => notWrittenMessage(x, { pagesPerWeek: p.pages_per_week })),
    recheckLadders: (p.recheck_ladders ?? []).map((r) => ({ ladderId: r.ladder_id, head: r.head, plannedAt: r.planned_at })),
    budget: p.budget ? { pagesPerWeek: p.budget.pages_per_week, spent: p.budget.spent, room: p.budget.room, ladderStartWindow: p.budget.ladder_start_window || null } : null,
    waitingForProfile: p.waiting_for_profile === true,
    missingText: S(p.readiness?.missing_text),
  };
}

/** An instant still to come, as ISO (a stale "next" time from the engine row is not shown). */
const futureIso = (v: unknown, now: number): string | null => {
  const t = Date.parse(S(v));
  return Number.isFinite(t) && t > now ? new Date(t).toISOString() : null;
};

/** The client's decisions in seo_skips (keyed by site id, no domain column): none when the engine holds the site id for another domain. */
export async function skipsOf(site: Pick<SiteRow, 'domain'>, fresh = false): Promise<SkipRow[]> {
  if (await foreignEngineDomain(site, { fresh }).catch(() => null)) return [];
  return n8nRows<SkipRow>('skips', { filters: [{ columnName: 'site_id', condition: 'eq', value: n8nSiteId(site.domain) }], max: 2000, fresh }).catch(() => []);
}

/** GET .../coming-up */
export async function loadComingUp(site: SiteRow, role: Role, now = Date.now()): Promise<ComingUpView> {
  const [preview, skips, cyc] = await Promise.all([
    latestPreview(site.id),
    skipsOf(site),
    loadCycleRows(site).catch(() => ({ row: null as CycleRow | null, jobs: [] as CycleJobRow[] })),
  ]);
  const [run, pages] = await Promise.all([planRun(site, preview, cyc, role, now).catch(() => null), planPages(site, preview, now).catch(() => null)]);
  return comingUpView({ site, preview, skips, role, now, credits: creditsOfUsd, run, pages });
}

/**
 * client report 2026-11-16 b: the website's pages since the plan was offered, so a finished plan follows its pages (live or not) and an approval the
 * client wrote meanwhile with "Write it now". Read only once the plan is due; a failed read follows nothing (the plan shows as before).
 */
async function planPages(site: SiteRow, preview: CyclePreviewRow | null, now: number): Promise<PlanPages | null> {
  if (!preview) return null;
  const due = preview.scheduledFor?.getTime() ?? Date.parse(S(preview.body.scheduled_for));
  if (!Number.isFinite(due) || due > now) return null;
  const [logs, reps] = await Promise.all([
    siteRows<ContentLogRow>('contentLog', site.domain, { sortBy: 'started_at:desc', max: 1000 }),
    db
      .select({ id: schema.reports.id, requestId: schema.reports.requestId, status: schema.reports.status, receivedAt: schema.reports.receivedAt })
      .from(schema.reports)
      .where(and(eq(schema.reports.orgId, site.orgId), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'content'), gte(schema.reports.receivedAt, preview.receivedAt)))
      .orderBy(desc(schema.reports.receivedAt))
      .limit(200),
  ]);
  const by = new Map<string, string>();
  for (const r of reps) if (r.requestId && !by.has(r.requestId) && S(r.status) !== 'failed' && S(r.status) !== 'progress') by.set(r.requestId, r.id);
  return { logs, reportOf: (id) => by.get(S(id)) ?? null };
}

/**
 * I3: what the app knows of the plan's run. Its job row and the cycle row come from the engine (already read for the cycle view); once the
 * run is due, its content report (same cycle_key) and the reports of the pages it started come from the app's own reports.
 */
async function planRun(site: SiteRow, preview: CyclePreviewRow | null, cyc: { row: CycleRow | null; jobs: CycleJobRow[] }, role: Role, now: number): Promise<PlanRun> {
  const cv = siteCycleView(site, cyc.row, cyc.jobs, now, role);
  const base: PlanRun = { job: null, currentKey: S(cyc.row?.current_key), report: null, pageReports: [], nextPreviewAt: cv.nextPreviewAt, nextDueAt: cv.nextDueAt };
  if (!preview) return base;
  const cycleKey = preview.cycleKey;
  const due = preview.scheduledFor?.getTime() ?? Date.parse(S(preview.body.scheduled_for));
  base.job = cyc.jobs.find((j) => S(j.cycle_key) === cycleKey && S(j.job) === 'content_cadence') ?? null;
  if (!Number.isFinite(due) || due > now) return base;
  const reps = await db
    .select({ payload: schema.reports.payload, receivedAt: schema.reports.receivedAt })
    .from(schema.reports)
    .where(and(eq(schema.reports.orgId, site.orgId), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'content_cadence'), sql`${schema.reports.payload}->>'cycle_key' = ${cycleKey}`))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(5);
  // the note that lists the pages, else the newest word of the run
  base.report = reps.find((r) => Array.isArray(r.payload.pages) && (r.payload.pages as unknown[]).length) ?? reps[0] ?? null;
  const ids = arrOf(base.report?.payload.pages).map((x) => S(x.request_id)).filter(Boolean);
  if (ids.length)
    base.pageReports = await db
      .select({ id: schema.reports.id, requestId: schema.reports.requestId, status: schema.reports.status, receivedAt: schema.reports.receivedAt })
      .from(schema.reports)
      .where(and(eq(schema.reports.orgId, site.orgId), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'content'), inArray(schema.reports.requestId, ids.slice(0, 20))));
  return base;
}

export interface ComingUpDecisionInput {
  itemKey: string;
  decision: 'skip' | 'approve';
  scope: 'cycle' | 'always';
}

/** The seo_skips row a decision writes, after checking it against the plan (pure). */
export function decisionRow(o: { site: Pick<SiteRow, 'domain'>; preview: CyclePreviewRow | null; input: ComingUpDecisionInput; by: string; now: number }): { row: SkipRow; item: CyclePreviewItem; preview: CyclePreview } {
  if (!o.preview) throw notFound('There is no "Coming up" plan for this website yet');
  const p = previewOf(o.preview.body);
  const due = o.preview.scheduledFor?.getTime() ?? Date.parse(p.scheduled_for);
  if (Number.isFinite(due) && due <= o.now) throw new HttpError(409, 'This cycle has already started, so its plan can no longer be changed. Decide on the next plan when it arrives.', 'cycle_started');
  const key = itemKeyOf(o.input.itemKey);
  const item = [...p.items, ...p.suggestions].find((x) => x.item_key === key);
  if (!item) throw badRequest('That item is not in the coming plan', { itemKey: 'Not in the plan' });
  if (o.input.decision === 'approve' && item.auto) throw badRequest('This page is written on its own in this cycle already. Skip it if you do not want it.', { decision: 'Already automatic' });
  if (o.input.decision === 'approve' && item.not_approvable) throw badRequest('This page waits for a later week on its own, so it cannot be approved for this one. Use Write it now if you want it sooner.', { decision: 'Not approvable this week' });
  if (o.input.decision === 'approve' && o.input.scope === 'always') throw badRequest('An approval counts for one cycle. Approve it again in a later plan, or choose a keyword for it.', { scope: 'Approvals are for this cycle' });
  const siteId = n8nSiteId(o.site.domain);
  const row: SkipRow = {
    key: skipKey(siteId, o.input.scope, p.cycle_key, key),
    site_id: siteId,
    cycle_key: o.input.scope === 'always' ? '' : p.cycle_key,
    item_key: key,
    decision: o.input.decision,
    scope: o.input.scope,
    by: o.by.slice(0, 200),
    created_at: new Date(o.now).toISOString(),
    // F-KW: an approval names its item (source and ladder), so it never approves another page that shares the keyword; a skip is for the keyword
    source: o.input.decision === 'approve' ? item.source : '',
    ladder_id: o.input.decision === 'approve' ? item.ladder_id : '',
  };
  return { row, item, preview: p };
}

/** POST .../coming-up/decisions: writes the decision to the engine's seo_skips (one row per key; a new decision replaces the old). */
export async function decideComingUp(site: SiteRow, user: Pick<UserRow, 'email'>, role: Role, input: ComingUpDecisionInput, now = Date.now()): Promise<ComingUpDecisionResult> {
  const preview = await latestPreview(site.id);
  const { row, preview: p } = decisionRow({ site, preview, input, by: user.email, now });
  // seo_skips carries no domain: written only when the engine's site id is this website's
  await assertEngineSiteIsOurs(site);
  await ensureTable('skips', SKIPS_COLUMNS);
  await upsertRow('skips', [{ columnName: 'key', condition: 'eq', value: row.key }], row as unknown as Record<string, unknown>);
  // the client's newest word wins: an approval for this cycle clears an "always skip" of the same item (the engine lets a skip win)
  if (row.decision === 'approve') await deleteRows('skips', [{ columnName: 'key', condition: 'eq', value: skipKey(row.site_id, 'always', p.cycle_key, row.item_key) }]);
  const view = comingUpView({ site, preview, skips: await skipsOf(site, true), role, now, credits: creditsOfUsd });
  const item = [...view.items, ...view.suggestions].find((x) => x.itemKey === row.item_key)!;
  return { item, key: row.key };
}

// ---------------- the weekly e-mail (D15) ----------------

/** The e-mail of one plan (pure): plain words, the price in credits, what is automatic and what waits for an OK. */
export function comingUpMail(o: { site: Pick<SiteRow, 'domain' | 'timezone'>; view: ComingUpView; url: string }): { subject: string; title: string; lines: string[]; details: { label: string; value: string }[] } {
  const v = o.view;
  const day = v.scheduledFor ? localDayName(siteTimezone(o.site), v.scheduledFor) : '';
  const autos = v.items.filter((i) => i.auto && i.slot !== 'moved' && i.decision?.decision !== 'skip' && !i.decision?.carried);
  const moved = v.items.filter((i) => i.auto && i.slot === 'moved');
  const all = [...v.items, ...v.suggestions.filter((s) => !v.items.some((i) => i.itemKey === s.itemKey))];
  const carried = all.filter((i) => i.decision?.decision === 'approve' && i.decision.carried);
  const waits = [...v.items.filter((i) => !i.auto), ...v.suggestions].filter((i) => !i.decision);
  const level = AUTOPILOT_LEVELS.find((l) => l.level === v.level);
  const lines: string[] = [];
  if (v.waitingForKeyword) lines.push('We write nothing for this website until you choose the keyword you want to be found for. Choose it in the app and its first page is written in the next cycle.');
  else if (v.pausedReason === 'pileup') lines.push('Nothing new is written this week: pages we already wrote are waiting for you to publish them. Publish them and the next cycle continues.');
  else if (v.pausedReason === 'site_paused') lines.push('The website is paused, so this cycle writes nothing. Resume it in the app to continue.');
  if (autos.length) lines.push(`Written on their own${day ? ` on ${day}` : ''}: ${autos.map((i) => `"${i.keyword}" (about ${i.credits} credits)`).join(', ')}. Skip any of them in the app if you do not want it.`);
  if (carried.length) lines.push(`Carried over from your last plan, and written first${carried.some((i) => i.slot === 'over') ? ' as far as this week\'s pages allow' : ''}: ${carried.map((i) => `"${i.keyword}"`).join(', ')}. You approved ${carried.length === 1 ? 'it' : 'them'} before and ${carried.length === 1 ? 'it' : 'they'} did not fit then. Skip ${carried.length === 1 ? 'it' : 'any of them'} in the app if you no longer want ${carried.length === 1 ? 'it' : 'them'}.`);
  if (moved.length) lines.push(`Moved to next week because your approved pages come first: ${moved.map((i) => `"${i.keyword}"`).join(', ')}.`);
  if (waits.length) lines.push(`Waiting for your OK: ${waits.slice(0, 6).map((i) => `"${i.keyword}" (about ${i.credits} credits)`).join(', ')}${waits.length > 6 ? ` and ${waits.length - 6} more` : ''}. Approve the ones you want: approved pages are written first, within your pages a week, and one that does not fit moves to your next plan by itself.`);
  if (!autos.length && !waits.length && !carried.length && !v.waitingForKeyword && !v.pausedReason) lines.push('Nothing is planned to be written this week. Your checks and reports run as usual.');
  lines.push(`Your autopilot level: ${level ? `${v.level}, ${level.label.toLowerCase()}` : v.level}. You can change it in the website's settings at any time.`);
  return {
    subject: `Coming up${day ? ` on ${day}` : ' this week'} for ${o.site.domain}`,
    title: `Coming up${day ? ` on ${day}` : ' this week'}`,
    lines,
    details: [
      { label: 'Website', value: o.site.domain },
      { label: 'Written on their own', value: `${autos.length} (about ${v.autoCredits} credits)` },
      ...(carried.length ? [{ label: 'Carried over and written first', value: String(carried.length) }] : []),
      { label: 'Waiting for your OK', value: String(waits.length) },
    ],
  };
}

type Log = { info: (o: object, m: string) => void; error: (o: object, m: string) => void };

/** Sends the plan's e-mail once (cycle_previews.emailed_at is claimed first, so two callbacks of one cycle send one e-mail). */
export async function emailComingUp(org: OrgRow, site: SiteRow, preview: CyclePreviewRow, log: Log, now = Date.now()): Promise<boolean> {
  const view = comingUpView({ site, preview, skips: await skipsOf(site), role: 'owner', now, credits: creditsOfUsd });
  if (!view.available || view.closed) return false;
  const [claimed] = await db
    .update(schema.cyclePreviews)
    .set({ emailedAt: new Date(now) })
    .where(and(eq(schema.cyclePreviews.id, preview.id), eq(schema.cyclePreviews.siteId, site.id), isNull(schema.cyclePreviews.emailedAt)))
    .returning({ id: schema.cyclePreviews.id });
  if (!claimed) return false;
  const to = await billingContacts(org.id);
  if (!to.length) return false;
  const base = await baseUrlFor(org);
  const url = `${base}/o/${org.id}/sites/${site.id}/pipeline`;
  const m = comingUpMail({ site, view, url });
  const sender = await senderFor(org);
  let sent = false;
  for (const addr of to)
    sent = (await sendMail({ to: addr, subject: m.subject, title: m.title, lines: m.lines, details: m.details, action: { label: 'Open the plan', url }, sender, footer: `You receive this e-mail once a week because you manage ${site.domain} in ${sender.brandName}.` }, log).catch(() => false)) || sent;
  return sent;
}

/** The reasons an approval moves to the next plan by itself: the pages a week were used, or its page already had a change that week. */
const CARRY_REASONS = new Set(['budget', 'same_page']);

/**
 * APPROVALS FIRST (owner 2026-11-16, pure): the approvals the previous run reported not written for the pages a week or the one-change-a-week rule,
 * re-filed for the new plan, so the client never has to approve the same page twice. Each new row keeps the FIRST approval's time and author
 * (the engine writes the earliest approval first, so a carried page comes before the approvals given since) and is written only when:
 * the new plan offers the same item (same search, source and ladder) for an OK; the client has decided nothing on it in the new cycle and has
 * not skipped it for good; and the first approval is younger than CARRY_APPROVAL_DAYS (after that it is the client's to give again).
 */
export function carriedApprovals(o: { siteId: string; prevCycleKey: string; reported: CyclePreview['approved_not_written']; skips: SkipRow[]; next: CyclePreview; now: number }): SkipRow[] {
  const out: SkipRow[] = [];
  // no pages a week: an approval could never be written, so nothing is carried (the plan says why)
  if (!(o.next.pages_per_week > 0)) return out;
  const offered = [...o.next.items, ...o.next.suggestions];
  const mine = o.skips.filter((r) => S(r.site_id) === o.siteId);
  for (const x of o.reported ?? []) {
    if (!CARRY_REASONS.has(S(x.reason))) continue;
    const key = itemKeyOf(x.keyword);
    const first = mine
      .filter((r) => S(r.decision) === 'approve' && S(r.scope) !== 'always' && S(r.cycle_key) === o.prevCycleKey && itemKeyOf(S(r.item_key)) === key && (!S(x.source) || !S(r.source) || S(r.source) === S(x.source)))
      .sort((a, b) => S(a.created_at).localeCompare(S(b.created_at)))[0];
    if (!first) continue;
    const t = Date.parse(S(first.created_at));
    if (!Number.isFinite(t) || o.now - t > CARRY_APPROVAL_DAYS * 864e5) continue;
    const item = offered.find((i) => i.item_key === key && (!S(first.source) || S(i.source) === S(first.source)) && (!S(first.ladder_id) || S(i.ladder_id) === S(first.ladder_id)));
    // written on its own in the new plan already (nothing to approve), waiting for its keyword check first, or out of an approval's reach
    if (item && (item.auto || item.recheck || item.not_approvable)) continue;
    // not among the plan's items or its five suggestions: the engine still honours an approval of an item it would offer, so it is carried by the
    // first approval's own item (it needs its source; the run reports it with its reason when it is no longer offered, and that is never carried)
    if (!item && !S(first.source)) continue;
    if (mine.some((r) => itemKeyOf(S(r.item_key)) === key && (S(r.scope) === 'always' ? S(r.decision) === 'skip' : S(r.cycle_key) === o.next.cycle_key))) continue;
    if (out.some((r) => r.item_key === key)) continue;
    out.push({
      key: skipKey(o.siteId, 'cycle', o.next.cycle_key, key),
      site_id: o.siteId,
      cycle_key: o.next.cycle_key,
      item_key: key,
      decision: 'approve',
      scope: 'cycle',
      by: S(first.by).slice(0, 200),
      created_at: S(first.created_at),
      source: item ? item.source : S(first.source),
      ladder_id: item ? item.ladder_id : S(first.ladder_id),
    });
  }
  return out;
}

/**
 * The previous cycle's word on the approvals it did not write: the newest content_cadence reports of the newest cycle before `cycleKey`
 * (their approved_not_written lists, merged).
 */
async function previousNotWritten(site: SiteRow, cycleKey: string): Promise<{ prevCycleKey: string; reported: CyclePreview['approved_not_written'] }> {
  const reps = await db
    .select({ payload: schema.reports.payload })
    .from(schema.reports)
    .where(and(eq(schema.reports.orgId, site.orgId), eq(schema.reports.siteId, site.id), eq(schema.reports.stage, 'content_cadence')))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(20);
  const day = cycleDateOf(cycleKey);
  const prior = reps.map((r) => S(r.payload.cycle_key)).filter((k) => k && k !== cycleKey && cycleDateOf(k) && cycleDateOf(k) < day);
  const prevCycleKey = prior.sort((a, b) => cycleDateOf(b).localeCompare(cycleDateOf(a)))[0] ?? '';
  if (!prevCycleKey) return { prevCycleKey: '', reported: [] };
  const reported = reps.filter((r) => S(r.payload.cycle_key) === prevCycleKey).flatMap((r) => previewOf({ approved_not_written: r.payload.approved_not_written }).approved_not_written ?? []);
  return { prevCycleKey, reported };
}

/** Writes the carried approvals of a plan that just arrived (carriedApprovals). Never throws: a failure leaves the plan as the engine sent it. */
export async function carryApprovals(site: SiteRow, row: CyclePreviewRow, log: Log, now = Date.now()): Promise<number> {
  try {
    const next = previewOf(row.body);
    if (!next.cycle_key) return 0;
    const { prevCycleKey, reported } = await previousNotWritten(site, next.cycle_key);
    if (!prevCycleKey || !(reported ?? []).some((x) => CARRY_REASONS.has(S(x.reason)))) return 0;
    if (await foreignEngineDomain(site, { fresh: true }).catch(() => 'unknown')) return 0;
    const rows = carriedApprovals({ siteId: n8nSiteId(site.domain), prevCycleKey, reported, skips: await skipsOf(site, true), next, now });
    if (!rows.length) return 0;
    await ensureTable('skips', SKIPS_COLUMNS);
    for (const r of rows) await upsertRow('skips', [{ columnName: 'key', condition: 'eq', value: r.key }], r as unknown as Record<string, unknown>);
    log.info({ site: site.domain, cycleKey: next.cycle_key, from: prevCycleKey, carried: rows.map((r) => r.item_key) }, '"Coming up": approvals carried to the new plan');
    return rows.length;
  } catch (e) {
    log.error({ site: site.domain, err: String((e as Error)?.message ?? e) }, '"Coming up": approvals could not be carried to the new plan');
    return 0;
  }
}

/** A plan just arrived: keep it, carry the approvals the last run could not fit, and e-mail it (the first plan of a cycle only). */
export async function onPreview(org: OrgRow, site: SiteRow, body: Record<string, unknown>, reportId: string, log: Log): Promise<void> {
  const refused = previewRefusal(site, body);
  if (refused) {
    log.error({ site: site.domain, cycleKey: S(body.cycle_key), reportId, why: refused }, '"Coming up" plan not kept');
    return;
  }
  const row = await storePreview(org, site, body, reportId);
  if (row) await carryApprovals(site, row, log);
  if (row && !row.emailedAt) await emailComingUp(org, site, row, log);
}
