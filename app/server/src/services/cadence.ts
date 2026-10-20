import {
  AUTO_SOURCES,
  cycleNorm,
  DEFAULT_AUTOPILOT_LEVEL,
  fitEvidence,
  fitGate,
  fitLearnedBrands,
  fitOwnLabels,
  fitStored,
  fitTokens,
  LADDER_SITE_ROW,
  type AiTargetRow,
  type AutopilotLevel,
  type ChosenBy,
  type ContentLogRow,
  type FitContext,
  type LadderMode,
  type LadderRow,
  type LadderSettingsRow,
  type PlanType,
  type QueryRow,
  type QueueItem,
  type RankHistoryRow,
  type SitePageRow,
  type SkipRow,
  type TopicSource,
  type TrendRow,
} from '@seo/shared';

// The app's mirror of the Content Cadence (n8n/seo-agent/v5/code/Cadence_Plan.js, the source of truth): what one cycle of a website
// writes on its own, what waits for the client's OK, what is refused and why. Pure functions, rule for rule the engine's, so the
// Pipeline ("This week", the ladder cards, Needs you, Coming up) never promises a page the engine would not write. Both suites run
// every case of the shared fixture n8n/seo-agent/harness/fixtures/cadence_levels.json (server/test/cadenceLevels.test.ts here,
// harness KF2 there): a disagreement is a defect on one side.
//
// The rules (SCHEDULING_KEYWORDS_PLAN.md §5.1 / §5.5 / §5.7, the contract app/shared/src/cycles.ts):
// - per ladder (seo_ladder_settings; no row = the website's default mode, else Auto; status active; priority by oldest start date):
//   only Auto ladders with status active / queued that are not won are written; the max_active highest-priority ones that still
//   have planned pages are active, the others wait (queued). Inside a ladder by rung, then page number; a Direct plan writes the
//   main page (rung 4) first; the main page waits until half of its supporting pages are published, or its keyword ranks 1-30.
// - R-K1: a ladder is written only when the client chose its keyword (`chosen_by` client_typed / client_picked / empty = legacy or
//   API); a `system_announced` ladder only at level 3; any other ladder waits for an OK.
// - R-K2: at levels 1 and 2 nothing at all is written until the website has a client-chosen ladder (any status but archived):
//   `waitingForKeyword`. Level 3 needs no ladder.
// - R-K3: what else runs on its own depends on the level (AUTO_SOURCES): 1 ladder pages only; 2 also refreshes of EXISTING pages
//   in topic (decay, striking distance with a page, AI refresh); 3 also new topics. Everything else is a suggestion with its price.
// - R-K4: the fit gate (shared/src/fit-gate.ts, the engine's kit) runs on every non-ladder candidate, at every level; a refusal is
//   listed with its reason and is never suggested. A stored rung the gate refuses is set aside; a ladder whose main keyword is set
//   aside (R87) is paused.
// - `pages_per_week` bounds everything automatic, 0 = nothing; at level 3 the AI page of the week comes on top.
// - R-K7, one cycle one budget: pages a ladder start wrote in the cycle, and pages an earlier run of this cycle's cadence started,
//   count against `pages_per_week`.
// - skips (seo_skips): `skip` (always, or this cycle) -> not written, not suggested; `approve` (this cycle) -> written within the
//   budget, after the ladder pages and before the level's own automatic items. An approval is the client's own choice, so it is written
//   even while the website waits for its first keyword (E4, 2026-10-19); skips still win, the budget and the pile-up guard still apply.
// - pile-up guard: max_waiting or more pages written and not published -> nothing is written (`pausedReason: 'pileup'`).
// - D11, one search one page: a candidate a live page already answers is a refresh (ladder) or left out (anything else).

export const CADENCE = {
  maxPerWeek: 3,
  skipRecentDays: 90,
  strikingMinImpressions: 30,
  strikingMin: 4,
  strikingMax: 20,
  maxActive: 2,
  maxWaiting: 3,
  waitingDays: 120,
  gateHeadPosition: 30,
  wonChecks: 4,
  wonPosition: 3,
  suggestions: 5,
  /** v4.16 (B4-3): refreshes of decaying pages offered in one week, and the days a page is left to settle after any refresh */
  decayPerWeek: 2,
  decayRefreshDays: 60,
  /** R-K7: outside a cycle, the pages started in the last 6 days count as this week's */
  cycleWindowDays: 6,
  inFlightHours: 2,
  /** F-KW: a ladder planned longer ago than this waits for a fresh keyword check before its first page (cycles.ts QUEUED_RECHECK_DAYS) */
  recheckDays: 60,
  cycleDays: 7,
  /** the n8n cadence reports 4 as `upcoming`; the app shows a few more */
  upcoming: 4,
  later: 8,
  /** the engine's shipped price of a content run (Claude $0.80 + DataForSEO $0.04) when no calibration is known */
  defaultPageUsd: 0.84,
} as const;

const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'] as const;
export type SettingsStatus = (typeof STATUSES)[number];
const LEVELS: AutopilotLevel[] = [1, 2, 3];
/** '' = a ladder started before `chosen_by` existed, or through the public API (the caller is the client) */
const CLIENT_CHOSEN = new Set(['', 'client_typed', 'client_picked']);

const norm = cycleNorm;
const lc = (v: unknown) => String(v == null ? '' : v).toLowerCase().trim();
const num = (v: unknown) => Number(v) || 0;
const ms = (iso: unknown) => {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : 0;
};
const normD = (x: unknown) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
const jparse = <T>(v: unknown, d: T): T => {
  if (v && typeof v === 'object') return v as T;
  try {
    const o = JSON.parse(String(v ?? '') || 'null');
    return o == null ? d : (o as T);
  } catch {
    return d;
  }
};
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : String(v ?? '').split(/[\n,;|]+/)).map((x) => x.trim()).filter(Boolean);
/** n8n's posInt: a whole number >= 1 (capped), else the default ('' and null are "not set") */
export const posInt = (v: unknown, d: number, max: number) => {
  const x = Number(v);
  return v !== '' && v != null && Number.isFinite(x) && x >= 1 ? Math.min(max, Math.floor(x)) : d;
};
/** the website's autopilot level as the engine reads it from the '_site' row: empty or invalid = 2 */
export const levelOf = (row: Pick<LadderSettingsRow, 'autopilot_level'> | null | undefined): AutopilotLevel => {
  const n = Number(row?.autopilot_level);
  return (LEVELS as number[]).includes(n) ? (n as AutopilotLevel) : DEFAULT_AUTOPILOT_LEVEL;
};

// ---- D11: does a live page of the website already answer this search? (SM.matchPage in v5/code/_site_model.js, rule for rule) ----
const PAGE_STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
const S = (v: unknown) => String(v == null ? '' : v).trim();
const tokensOf = (s: unknown) => S(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
const termsOf = (s: unknown) => [...new Set(tokensOf(s).filter((t) => t.length > 1 && !PAGE_STOP.has(t)))];
const SYN: [RegExp, string][] = [
  [/\bd\s?365\b/g, 'dynamics 365'], [/\bdynamics365\b/g, 'dynamics 365'], [/\bf\s?&\s?o\b|\bfno\b/g, 'finance operations'], [/\bunited arab emirates\b/g, 'uae'],
  [/\babu dhabi\b/g, 'abudhabi'], [/\bras al khaimah\b/g, 'rasalkhaimah'], [/\bumm al quwain\b/g, 'ummalquwain'], [/\bal ain\b/g, 'alain'],
];
const EMIRATES = new Set(['dubai', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rasalkhaimah', 'rak', 'ummalquwain', 'alain']);
const synNorm = (s: unknown) => {
  let t = S(s).toLowerCase().replace(/&amp;/g, '&');
  for (const [re, to] of SYN) t = t.replace(re, to);
  return t;
};
const stem = (t: string) => (t.length >= 5 ? t.replace(/(ings?|ed|es|(?<!s)s)$/, '').replace(/e$/, '') : t);
const matchTerms = (s: unknown) => [...new Set(termsOf(synNorm(s)).map(stem))];
const covers = (set: string[], t: string) => set.includes(t) || (EMIRATES.has(t) && (set.includes('uae') || set.includes('emirat')));
const shareIn = (want: string[], set: string[]) => (want.length ? want.filter((t) => covers(set, t)).length / want.length : 0);
const hostOf = (u: unknown) => S(u).toLowerCase().match(/^https?:\/\/([^/?#]+)/i)?.[1]?.replace(/:\d+$/, '').replace(/^www\./, '') ?? '';
const pathOf = (u: unknown) => S(u).replace(/^https?:\/\/[^/]*/i, '') || '/';
const LISTING = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;
const isListing = (u: unknown) => LISTING.test(pathOf(u).replace(/[?#].*$/, ''));
export const PAGE_MATCH_MIN = 0.75;
export interface PageMatch { url: string; title: string; matchedBy: 'query' | 'slug' | 'title'; score: number }
const queriesOf = (p: SitePageRow): Array<{ query?: unknown; keyword?: unknown; impressions?: unknown }> => {
  const x = jparse<unknown>((p as unknown as { queries?: unknown }).queries ?? p.queries_json, []);
  return Array.isArray(x) ? x : [];
};
/** The page that already answers `keyword`, or null: impressions for the exact query first (a dedicated page before a listing), then 75% of its words in the slug or title. */
export function matchPage(pages: SitePageRow[], keyword: string, prefer?: string): PageMatch | null {
  const want = matchTerms(keyword);
  if (!want.length || !pages.length) return null;
  const key = tokensOf(keyword).join(' ');
  const keyU = (u: string) => hostOf(u) + pathOf(u).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  const isPref = (u: string) => !!prefer && keyU(u) === keyU(prefer);
  const byQuery: { url: string; title: string; impressions: number }[] = [];
  for (const p of pages) {
    if (!p?.url) continue;
    const q = queriesOf(p).find((x) => tokensOf(typeof x === 'object' && x ? x.query || x.keyword : x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
    if (q) byQuery.push({ url: p.url, title: p.title || '', impressions: Number(q.impressions) || 0 });
  }
  byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
  const qHit = byQuery[0] ?? null;
  if (qHit && !isListing(qHit.url)) return { url: qHit.url, title: qHit.title, matchedBy: 'query', score: 1 };
  let best: PageMatch | null = null;
  for (const p of pages) {
    if (!p?.url || (qHit && isListing(p.url))) continue;
    const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
    const title = matchTerms(`${p.title || ''} ${p.h1 || ''}`);
    const inSlug = shareIn(want, slug);
    const inTitle = shareIn(want, title);
    const score = Math.max(inSlug, inTitle);
    if (score + 1e-9 >= PAGE_MATCH_MIN && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url))))
      best = { url: p.url, title: p.title || '', matchedBy: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100 };
  }
  if (best) return best;
  return qHit ? { url: qHit.url, title: qHit.title, matchedBy: 'query', score: 1 } : null;
}

// ---- the results page the Rank Tracker stored for a keyword (RS.prevReading + RS.serpHosts in v5/code/_rank_serp.js) ----
type RankLike = RankHistoryRow & { snapshot_json?: unknown; competitors_json?: unknown };
const bareHost = (v: unknown) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
export function serpHosts(row: RankLike, depth = 10): string[] {
  const snap = jparse<{ unavailable?: boolean; top?: { p?: unknown; u?: unknown }[] } | null>(row.snapshot_json, null);
  const top = (snap && !snap.unavailable && Array.isArray(snap.top) ? snap.top : [])
    .map((e) => ({ p: Number(e?.p) || 0, h: hostOf(S(e?.u)) }))
    .filter((e) => e.p > 0 && e.h)
    .sort((a, b) => a.p - b.p);
  if (top.length) return top.filter((e) => e.p <= depth).map((e) => e.h);
  const c = jparse<{ above?: { p?: unknown; d?: unknown }[] } | null>(row.competitors_json, null);
  return (c && Array.isArray(c.above) ? c.above : [])
    .map((x) => ({ p: Number(x?.p) || 0, h: bareHost(S(x?.d)) }))
    .filter((e) => e.p > 0 && e.p <= depth && e.h)
    .sort((a, b) => a.p - b.p)
    .map((e) => e.h);
}
export function prevReading(rows: RankLike[], o: { keyword: string; domain: string; before: string; withSnapshot?: boolean }): RankLike | null {
  const kwKey = (k: unknown) => S(k).toLowerCase().replace(/\s+/g, ' ').trim();
  const kw = kwKey(o.keyword), dom = bareHost(o.domain);
  return (
    rows
      .filter(
        (h) =>
          h &&
          S(h.device || 'desktop') !== 'mobile' &&
          kwKey(h.keyword) === kw &&
          (!dom || bareHost(h.domain) === dom) &&
          S(h.checked_at) &&
          S(h.checked_at) < o.before &&
          String(h.position) !== '' &&
          h.position != null &&
          Number(h.position) >= 0 &&
          (!o.withSnapshot || !!jparse(h.snapshot_json, null) || !!jparse(h.competitors_json, null)),
      )
      .sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))[0] ?? null
  );
}

// ---- WAITING.waiting (v5/code/_waiting.js): the pages written and not published ----
const WAITS = new Set(['written', 'not_ready']);
const LADDER_WRITTEN = new Set(['writing', 'written', 'not_ready']);
export function waitingOf(log: ContentLogRow[], ladders: LadderRow[], now: number, days: number = CADENCE.waitingDays) {
  const fresh = (t: unknown) => {
    const v = ms(t);
    return v > 0 && now - v < days * 864e5;
  };
  const publishedKw = new Set(log.filter((l) => S(l.published_url)).map((l) => norm(l.keyword)));
  const writtenOf = (k: string) =>
    log.filter((r) => norm(r.keyword) === k && (WAITS.has(r.status) || r.status === 'published' || S(r.published_url))).sort((a, b) => S(b.started_at).localeCompare(S(a.started_at)))[0] ?? null;
  const fixOf = (l: ContentLogRow | null) => (l && l.status === 'not_ready' ? { needsFix: true, reasons: S(l.qa_reasons).split(/;\s+/).filter(Boolean).slice(0, 3) } : { needsFix: false, reasons: [] as string[] });
  const map = new Map<string, { keyword: string; writtenAt: string; needsFix: boolean; reasons: string[] }>();
  for (const l of log) {
    if (!WAITS.has(l.status) || !fresh(l.started_at)) continue;
    const k = norm(l.keyword);
    if (!k || map.has(k)) continue;
    map.set(k, { keyword: l.keyword, writtenAt: S(l.started_at), ...fixOf(l) });
  }
  for (const l of ladders) {
    if (!LADDER_WRITTEN.has(l.status)) continue;
    const k = norm(l.keyword);
    if (!k || map.has(k) || publishedKw.has(k)) continue;
    const lg = writtenOf(k);
    if (!lg) continue; // R1: no written log row = the page was never written
    const at = S(lg.started_at || l.start_date);
    if (!fresh(at)) continue;
    map.set(k, { keyword: l.keyword, writtenAt: at, ...fixOf(lg) });
  }
  const list = [...map.values()].sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
  return { list, keys: new Set(map.keys()) };
}

const isTop = (l: LadderRow) => Number(l.rung) === 4;
const byRung = (a: LadderRow, b: LadderRow) => num(a.rung) - num(b.rung) || num(a.page_no) - num(b.page_no);

/** How the cadence is asked: the Cycle Dispatcher's run of one cycle (`cycle`, its preview), an on-demand run, or the old batch. */
export interface CadenceTrigger {
  kind: 'batch' | 'cycle' | 'on_demand';
  /** cyc:<site_id>:<YYYY-MM-DD> */
  cycleKey?: string;
  /** the cycle's due time (ISO): R-K7's budget starts there */
  scheduledFor?: string;
  /** the 48-hour "Coming up" plan: plans exactly what the cycle would write */
  preview?: boolean;
  /** on demand only: write despite the pile-up guard (never in a preview) */
  force?: boolean;
  /** on demand only: the caller's own pages a week */
  pages?: number;
}

/** F-KW: the line a ladder waiting for its fresh keyword check carries (the engine's RECHECK_WHY, word for word) */
export const RECHECK_WHY = `checking this keyword again before writing: it was planned more than ${CADENCE.recheckDays} days ago`;

export interface CadenceInput {
  domain: string;
  /** the engine's site id (site_<domain>), for rows keyed by site_id */
  siteId?: string;
  /** seo_cadence pages per week (0, or the cadence `off`: nothing automatic); null = the website has no cadence row (an on-demand run then writes 1) */
  pagesPerWeek: number | null;
  /** seo_sites.status: a paused website's cycle writes nothing */
  siteStatus?: string;
  ladders: LadderRow[];
  queries: QueryRow[];
  trends: TrendRow[];
  logs: ContentLogRow[];
  settings: LadderSettingsRow[];
  /** the website's rank checks (every rung; the main keywords decide won / the gate, every reading feeds the fit gate) */
  history: RankHistoryRow[];
  /** the AI growth loop's targets (queued ones are candidates) and the AI pages a month (0 = none, or AI visibility / growth off) */
  aiTargets?: AiTargetRow[];
  aiPagesPerMonth?: number;
  /** the website's page inventory (seo_pages) */
  pages?: SitePageRow[];
  /** what the website sells (the site model: what the client declared and what the weekly crawl read) */
  services?: string[];
  /** F-KW: what the CLIENT said they sell ("What do you sell?"), kept apart: only these (and the client's ladders) make a keyword "in topic" at levels 1-2 */
  declaredServices?: string[];
  /** F-KW: the website's main menu pages (seo_sites.nav_pages_json): never rewritten on their own, like the homepage */
  navPages?: { url: string; title?: string }[];
  /** F-KW (R-K7): the content_cadence jobs of earlier cycles (seo_cycle_jobs): when the previous cadence ran */
  cycleJobs?: { site_id?: string; job?: string; cycle_key?: string; due_at?: string; started_at?: string }[];
  /** the competitors it declared (domains) */
  competitors?: string[];
  /** seo_cache ai_brands:<site_id> rows, or the map they hold */
  aiBrands?: Record<string, string> | unknown[];
  /** the client's decisions on the "Coming up" plan (seo_skips) */
  skips?: SkipRow[];
  /** the engine's price of one page (a content run), USD */
  estPageUsd?: number;
}

/** The website's defaults as the engine reads them from the '_site' row. `opportunities` is reported only: it decides nothing. */
export interface CadenceSiteConfig {
  mode: LadderMode;
  opportunities: LadderMode;
  maxActive: number;
  maxWaiting: number;
  level: AutopilotLevel;
}

export function cadenceSiteConfig(settings: LadderSettingsRow[]): CadenceSiteConfig {
  const r = settings.find((x) => String(x.ladder_id) === LADDER_SITE_ROW);
  return {
    mode: lc(r?.mode) === 'manual' ? 'manual' : 'auto',
    opportunities: lc(r?.opportunities) === 'manual' ? 'manual' : 'auto',
    maxActive: posInt(r?.max_active, CADENCE.maxActive, 20),
    maxWaiting: posInt(r?.max_waiting, CADENCE.maxWaiting, 100),
    level: levelOf(r),
  };
}

export interface CadenceLadder {
  id: string;
  head: string;
  mode: LadderMode;
  status: SettingsStatus;
  planType: PlanType | '';
  /** settings priority (>= 1), null when not set */
  priority: number | null;
  start: string;
  /** who chose its keyword ('' = legacy / API, read as the client) */
  chosenBy: ChosenBy | '';
  /** the main keyword's latest valid check (0 = not in the top 50), null before the first one */
  headPosition: number | null;
  won: boolean;
  supporting: number;
  published: number;
  gateOpen: boolean;
  /** the gated main page is all that is left to write */
  mainWaiting: boolean;
  /** pages still to write, in writing order (the gated main page included) */
  remaining: QueueItem[];
  /** pages that may be written now (remaining without the gated main page) */
  eligible: QueueItem[];
  /** what the coming run does with it ('not_chosen': an Auto ladder whose keyword the client did not choose, its pages wait for an OK) */
  role: 'active' | 'queued' | 'manual' | 'not_chosen' | 'paused' | 'won' | 'done';
  /** R87: '' or why the ladder is paused, its main keyword is set aside */
  headSetAside: string;
}

/** A candidate as the plan carries it: the shared queue item plus what the engine knows about it. */
export interface CadenceItem extends QueueItem {
  itemKey: string;
  /** true: written in the cycle unless skipped; false: written only after an approval */
  auto: boolean;
  approved?: boolean;
  estUsd: number;
  inTopic?: boolean;
  chosenBy?: ChosenBy | '';
  /** F-KW: the next page of a ladder planned more than 60 days ago, waiting for its fresh keyword check */
  recheck?: boolean;
  /** F-KW: an existing page that is the homepage or a main menu page (never rewritten on its own) */
  mainPage?: boolean;
}

export interface CadenceRefusal { keyword: string; source: TopicSource; reason: string; detail: string; note: string; targetId?: string }
export interface CadenceSetAside { ladderId: string; keyword: string; source: TopicSource; reason: string; detail: string; note: string; written: boolean; dropped: boolean }

export interface CadencePlan {
  config: CadenceSiteConfig;
  level: AutopilotLevel;
  trigger: CadenceTrigger['kind'];
  /** R-K2: levels 1 and 2 with no client-chosen ladder: nothing is written */
  waitingForKeyword: boolean;
  /** the pages the run writes, in order (the AI page of the week last) */
  picks: CadenceItem[];
  /** every candidate in order (ladder pages, approved items, the level's automatic items), each keyword once */
  candidates: CadenceItem[];
  /** what waits for the client's OK, with its price (max 5, AI first) */
  suggestions: CadenceItem[];
  /** the next page of every Manual (and every not-chosen Auto) ladder, waiting for the client's OK */
  awaitingApproval: CadenceItem[];
  /** a preview only (`trigger.preview`; its `picks` are empty, it starts nothing): what the cycle would write (auto) and the ladder
   * pages waiting for an OK (not auto) */
  items: CadenceItem[];
  /** R-K4: candidates the fit gate refused (never written, never suggested) */
  refused: CadenceRefusal[];
  /** every gate decision: refused candidates and stored rungs set aside (a written one only flagged) */
  setAside: CadenceSetAside[];
  /** item keys the client skipped */
  skipped: { itemKey: string; keyword: string; source: TopicSource; scope: 'always' | 'cycle' }[];
  /** what the client approved for this cycle */
  approvedItems: { keyword: string; source: TopicSource; itemKey: string }[];
  /** approvals not written this cycle, with the reason */
  approvedNotWritten: { keyword: string; source: TopicSource | ''; reason: 'pileup' | 'budget' | 'covered_by_live_page' | 'ambiguous'; detail?: string }[];
  /** R-K7: this cycle's budget (ladder starts count from `ladderStartWindow`) */
  budget: { pagesPerWeek: number; spent: number; room: number; windowStart: string; ladderStartWindow: string; spentKeywords: { keyword: string; how: string }[] };
  /** F-KW: ladders planned more than 60 days ago, never written, that wait for the app's fresh keyword check (rechecked_at) */
  recheckLadders: { ladderId: string; head: string; plannedAt: string; reason: string }[];
  ladders: CadenceLadder[];
  queued: string[];
  won: string[];
  /** ladders whose gated main page is all that is left */
  waitingForSupport: string[];
  pausedReason: '' | 'pileup' | 'site_paused';
  /** distinct keywords written and not published (the pile-up count) */
  waitingPublish: number;
  waitingKeywords: string[];
  /** R111: of those, the drafts whose last quality round failed */
  needsFix: string[];
  /** D11: candidates a live page of the website already answers */
  coveredByLivePages: Array<{ keyword: string; source: QueueItem['source']; url: string }>;
  /** the AI pages of the month */
  aiPages: { perMonth: number; usedThisMonth: number; thisWeek: boolean; onTop: boolean };
  /** the sentence the engine reports when it writes nothing ('' when it writes) */
  reason: string;
  estPageUsd: number;
}

type Cand = CadenceItem & { targetId?: string; head?: string };

const EMPTY_BUDGET = (pages: number, from: number) => ({ pagesPerWeek: pages, spent: 0, room: pages, windowStart: new Date(from).toISOString(), ladderStartWindow: new Date(from).toISOString(), spentKeywords: [] });
const urlKey = (u: unknown) => S(u).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const MAIN_WHY = '; it is your homepage or a main menu page, so it is only suggested and never rewritten on its own';

/** The Content Cadence's plan for one website at `now` (Cadence_Plan.js for one site). */
export function planCadence(input: CadenceInput, now: number, trigger: CadenceTrigger = { kind: 'cycle' }): CadencePlan {
  const cfg = cadenceSiteConfig(input.settings);
  const level = cfg.level;
  const isCycle = trigger.kind === 'cycle';
  const scoped = trigger.kind !== 'batch';
  const onDemand = trigger.kind === 'on_demand';
  // F-KW: ANY preview is a preview (with or without a cycle), and a preview never forces past the pile-up guard
  const preview = trigger.preview === true;
  const force = onDemand && !preview && trigger.force === true;
  const cycleKey = isCycle ? S(trigger.cycleKey) : '';
  const schedT = isCycle ? ms(trigger.scheduledFor) : 0;
  const windowStart = isCycle && schedT ? schedT : now - CADENCE.cycleWindowDays * 864e5;
  // F-KW: the clock the plan is judged at. A preview runs 48 h before its cycle and shows what the cycle will write THEN: every time
  // window (the AI month, an AI page this week, recent keywords, the decay and refresh windows, the pile-up window, in-flight runs)
  // is read at the cycle's due time; a real run reads the wall clock
  const at = preview && schedT ? schedT : now;
  const atIso = new Date(at).toISOString();
  const estPageUsd = input.estPageUsd && input.estPageUsd > 0 ? Math.round(input.estPageUsd * 10000) / 10000 : CADENCE.defaultPageUsd;
  const siteId = input.siteId || 'site_' + normD(input.domain).replace(/[^a-z0-9]+/g, '-');
  const domain = normD(input.domain);
  // pages a week: the cadence row (0-3; `off` = 0); an on-demand caller may name its own number; no row = 1 on demand, else 0
  const pagesRaw = onDemand && trigger.pages != null ? trigger.pages : input.pagesPerWeek == null ? (onDemand ? 1 : 0) : input.pagesPerWeek;
  const pages = Math.min(CADENCE.maxPerWeek, Math.max(0, Math.floor(Number(pagesRaw) || 0)));
  const nowIso = atIso;
  const base = (over: Partial<CadencePlan>): CadencePlan => ({
    config: cfg, level, trigger: trigger.kind, waitingForKeyword: false, picks: [], candidates: [], suggestions: [], awaitingApproval: [], items: [], refused: [], setAside: [], skipped: [], approvedItems: [], approvedNotWritten: [], recheckLadders: [],
    budget: EMPTY_BUDGET(pages, windowStart), ladders: [], queued: [], won: [], waitingForSupport: [], pausedReason: '', waitingPublish: 0, waitingKeywords: [], needsFix: [], coveredByLivePages: [],
    aiPages: { perMonth: Math.max(0, Math.floor(Number(input.aiPagesPerMonth ?? 0))), usedThisMonth: 0, thisWeek: false, onTop: level === 3 }, reason: '', estPageUsd, ...over,
  });
  // a paused website: the batch leaves it out; a cycle run of it writes nothing and says why
  if (lc(input.siteStatus || 'active') === 'paused' && !onDemand)
    return base({ pausedReason: isCycle ? 'site_paused' : '', reason: isCycle ? 'the website is paused, so its next cycle writes nothing' : '', budget: EMPTY_BUDGET(0, windowStart) });
  // pages_per_week bounds everything automatic: the batch skips a website set to 0; a run for this one website still reports its status
  if (!pages && !scoped) return base({ budget: EMPTY_BUDGET(0, windowStart) });

  const aiQuota = Math.max(0, Math.floor(Number(input.aiPagesPerMonth ?? 0)));
  const slog = input.logs.filter((l) => l && l.keyword && (!l.domain || normD(l.domain) === domain));
  const recent = new Set(slog.filter((l) => l.status === 'published' || at - ms(l.started_at) < CADENCE.skipRecentDays * 864e5).map((l) => norm(l.keyword)));
  const publishedKw = new Set(slog.filter((l) => l.published_url).map((l) => norm(l.keyword)));
  const lrows = input.ladders.filter((l) => l && l.ladder_id && l.keyword).sort(byRung);
  const ladderKw = new Set(lrows.map((l) => norm(l.keyword)));
  for (const l of lrows) if (LADDER_WRITTEN.has(l.status) || l.status === 'published') recent.add(norm(l.keyword));

  // ---- the fit gate's context: the website's own domain, its competitors, the brand names AI uses for other companies, and,
  // protected, the ladder heads and the services ----
  // the site model's services (SM.from): what the client declared first, then what the crawl read
  const declared = [...new Set((input.declaredServices ?? []).map((s) => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30);
  const services = [...new Set([...declared, ...(input.services ?? [])].map((s) => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30);
  const brands = Array.isArray(input.aiBrands) ? fitLearnedBrands((input.aiBrands as unknown[]).filter((r) => S((r as { key?: unknown })?.key) === 'ai_brands:' + siteId)) : input.aiBrands ?? {};
  const fitCtx: FitContext = {
    own_domain: domain,
    brands,
    competitors: [...new Set((input.competitors ?? []).map((c) => bareHost(c)).filter((d) => d && d !== domain))].slice(0, 8),
    protect: [...new Set([...lrows.map((l) => S(l.head_keyword)), ...services].filter(Boolean))],
  };
  const allRanks = (input.history ?? []).filter((r) => r && r.ladder_id && r.keyword) as RankLike[];
  const headRanks = allRanks.filter((r) => Number(r.rung) === 4 || String(r.rung ?? '') === '' || r.rung == null);
  const serpFor = (kw: string): string[] => {
    const h = prevReading(allRanks, { keyword: kw, domain, before: nowIso, withSnapshot: true });
    return h && at - ms(h.checked_at) <= 60 * 864e5 ? serpHosts(h, 10) : [];
  };
  const ladderDoms = new Map<string, Set<string>>();
  for (const l of lrows) {
    const d0 = ladderDoms.get(l.ladder_id) ?? new Set<string>();
    for (const h of serpFor(l.keyword)) d0.add(h);
    ladderDoms.set(l.ladder_id, d0);
  }
  const fitOf = new Map<LadderRow, ReturnType<typeof fitStored>>();
  const setAside: CadenceSetAside[] = [];
  for (const l of lrows) {
    const serp = serpFor(l.keyword);
    const g = fitStored(l as unknown as Record<string, unknown>, { ...fitCtx, serp, serp_domains: [...new Set([...serp, ...(ladderDoms.get(l.ladder_id) ?? [])])].filter((h) => normD(h) !== domain) });
    fitOf.set(l, g);
    if (g.flagged) setAside.push({ ladderId: l.ladder_id, keyword: l.keyword, source: 'ladder', reason: g.reason, detail: g.detail, note: g.note, written: g.live, dropped: !g.ok });
  }
  const fitOk = (l: LadderRow) => fitOf.get(l)?.ok ?? true;
  // R-K4: the gate every non-ladder candidate passes; topics = the ladders' heads and kept rungs, and the services
  const topics = [...new Set([...lrows.map((l) => S(l.head_keyword)), ...lrows.filter(fitOk).map((l) => S(l.keyword)), ...services].filter(Boolean))];
  const gateCtx: FitContext = { ...fitCtx, topics: topics.length ? topics : null, topic_label: 'what this website sells and the keywords you chose' };
  const refused: CadenceRefusal[] = [];
  const gateOf = (kw: string) => {
    const serp = serpFor(kw);
    return fitGate(kw, { ...gateCtx, serp, serp_domains: serp.filter((h) => normD(h) !== domain) });
  };
  const refuse = (o: Cand, g: { reason?: string; detail?: string }) => {
    const note = `"${o.keyword}" (${o.source}) is not a search this website should target: ${g.detail} (${g.reason}), so it is not written and not suggested`;
    setAside.push({ ladderId: '', keyword: o.keyword, source: o.source, reason: String(g.reason), detail: String(g.detail), note, written: false, dropped: true });
    refused.push({ keyword: o.keyword, source: o.source, reason: String(g.reason), detail: String(g.detail), note, ...(o.targetId ? { targetId: o.targetId } : {}) });
  };
  const settingOf = new Map(input.settings.filter((r) => r.ladder_id && String(r.ladder_id) !== LADDER_SITE_ROW).map((r) => [String(r.ladder_id), r]));
  // ---- F-KW: who chose each ladder. Its settings row says it; when that is empty (a settings save that failed), the ladder's OWN rows
  // say it (the ladder run writes chosen_by on every row first). Empty on both = a ladder from before the column, read as the client's. ----
  const chooserOf = (id: string): ChosenBy | '' => {
    const sv = lc(settingOf.get(String(id))?.chosen_by);
    if (sv) return sv as ChosenBy;
    return (lrows.filter((l) => String(l.ladder_id) === String(id)).map((l) => lc((l as LadderRow & { chosen_by?: unknown }).chosen_by)).find(Boolean) ?? '') as ChosenBy | '';
  };
  const statusOfL = (id: string): SettingsStatus => {
    const st0 = settingOf.get(String(id));
    return st0 && (STATUSES as readonly string[]).includes(lc(st0.status)) ? (lc(st0.status) as SettingsStatus) : 'active';
  };
  const ladderIds = [...new Set(lrows.map((l) => String(l.ladder_id)))];
  const clientIds = new Set(ladderIds.filter((id) => CLIENT_CHOSEN.has(chooserOf(id)) && statusOfL(id) !== 'archived'));
  const okIds = new Set(ladderIds.filter((id) => {
    const c = chooserOf(id);
    return CLIENT_CHOSEN.has(c) || (c === 'system_announced' && level === 3);
  }));
  // the ladders whose subject may make a page "in topic": chosen, and not paused or archived
  const liveTopic = (id: string) => !['paused', 'archived'].includes(statusOfL(id));
  const ladderTopics = (ids: Set<string>) =>
    lrows.filter((l) => ids.has(String(l.ladder_id)) && liveTopic(String(l.ladder_id))).flatMap((l) => [S(l.head_keyword), ...(isTop(l) || fitOk(l) ? [S(l.keyword)] : [])]);
  const cleanT = (a: string[]) => [...new Set(a.map((x) => S(x)).filter(Boolean))];
  // "in topic" = what the CLIENT chose (their ladders and their declared services); level 3 also what the site sells (the crawl)
  const chosenTopics = cleanT([...ladderTopics(clientIds), ...declared]);
  const fullTopics = cleanT([...chosenTopics, ...ladderTopics(okIds), ...services]);
  const evidenceTopics = level === 3 ? fullTopics : chosenTopics;
  const evidenceOf = (kw: string) => fitEvidence(kw, evidenceTopics, { topic_label: level === 3 ? 'what this website sells and the keywords you chose' : 'the keywords and services you chose' });
  // F-KW: the website's root and its main menu pages are never rewritten on their own, at any level (a suggestion at most)
  const navKeys = new Set((input.navPages ?? []).slice(0, 12).map((p) => urlKey(p?.url)).filter(Boolean));
  const mainPage = (u: unknown) => {
    const k = urlKey(u);
    return !!k && (!/\//.test(k) || navKeys.has(k));
  };
  const markTopic = (o: Cand): Cand => {
    o.inTopic = evidenceOf(o.keyword).verdict === 'in';
    o.mainPage = !!o.existingPageUrl && mainPage(o.existingPageUrl);
    if (o.mainPage) o.why += MAIN_WHY;
    return o;
  };

  // ---- skips and approvals (seo_skips) ----
  const mySkips = (input.skips ?? []).filter((r) => r && r.item_key && r.decision && (!r.site_id || r.site_id === siteId));
  const skipAlways = new Set(mySkips.filter((r) => lc(r.decision) === 'skip' && lc(r.scope) === 'always').map((r) => cycleNorm(r.item_key)));
  const skipCycle = new Set(cycleKey ? mySkips.filter((r) => lc(r.decision) === 'skip' && lc(r.scope) !== 'always' && S(r.cycle_key) === cycleKey).map((r) => cycleNorm(r.item_key)) : []);
  const approveRows = cycleKey ? mySkips.filter((r) => lc(r.decision) === 'approve' && S(r.cycle_key) === cycleKey) : [];
  // F-KW: an approval is for ONE item: the row's source / ladder when the app recorded them; an older keyword-only row only when one item alone has the keyword
  const rowFits = (r: SkipRow, o: Cand) =>
    cycleNorm(r.item_key) === cycleNorm(o.keyword) && (!S(r.source) || lc(r.source) === lc(o.source)) && (!S(r.ladder_id) || S(r.ladder_id) === S(o.ladder?.id));
  const skipped: CadencePlan['skipped'] = [];
  const isSkipped = (kw: string) => skipAlways.has(cycleNorm(kw)) || skipCycle.has(cycleNorm(kw));
  const noteSkip = (kw: string, source: TopicSource) => {
    const k = cycleNorm(kw);
    if (!skipped.some((x) => x.itemKey === k)) skipped.push({ itemKey: k, keyword: kw, source, scope: skipAlways.has(k) ? 'always' : 'cycle' });
  };

  const open = (l: LadderRow) => S(l.status || 'planned') === 'planned' && !recent.has(norm(l.keyword)) && fitOk(l);
  const groups = new Map<string, LadderRow[]>();
  for (const l of lrows) groups.set(l.ladder_id, [...(groups.get(l.ladder_id) ?? []), l]);
  const info = [...groups.entries()]
    .map(([id, rows]) => {
      const st = settingOf.get(String(id)) ?? null;
      const top = rows.find(isTop) ?? null;
      const head = top?.keyword || rows[0].head_keyword || '';
      const mode: LadderMode = st && (lc(st.mode) === 'auto' || lc(st.mode) === 'manual') ? (lc(st.mode) as LadderMode) : cfg.mode;
      const status: SettingsStatus = st && (STATUSES as readonly string[]).includes(lc(st.status)) ? (lc(st.status) as SettingsStatus) : 'active';
      const planType: PlanType | '' = st && ['direct', 'short', 'full'].includes(lc(st.plan_type)) ? (lc(st.plan_type) as PlanType) : '';
      const prio = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
      const start = rows.map((r) => S(r.start_date)).filter(Boolean).sort()[0] || S(st?.created_at);
      const chosenBy = chooserOf(id);
      const chosenOk = okIds.has(String(id));
      const hist = headRanks
        .filter((h) => String(h.ladder_id) === String(id) && norm(h.keyword) === norm(head) && String(h.position) !== '' && h.position != null && Number.isFinite(Number(h.position)) && Number(h.position) >= 0)
        .sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)));
      const headPosition = hist.length ? Number(hist[0].position) : null;
      const lastN = hist.slice(0, CADENCE.wonChecks);
      const won = lastN.length >= CADENCE.wonChecks && lastN.every((h) => Number(h.position) >= 1 && Number(h.position) <= CADENCE.wonPosition);
      const support = rows.filter((r) => !isTop(r));
      const published = support.filter((r) => r.status === 'published' || publishedKw.has(norm(r.keyword))).length;
      const gateOpen = planType === 'direct' || !support.length || published * 2 >= support.length || (headPosition != null && headPosition >= 1 && headPosition <= CADENCE.gateHeadPosition);
      const ordered = planType === 'direct' ? [...rows.filter(isTop), ...rows.filter((r) => !isTop(r))] : rows;
      // R87: a ladder whose main keyword is set aside (its row says so, or the gate refuses it now) is paused
      const hf = top ? fitOf.get(top) : undefined;
      const headSetAside = top && S(top.status) === 'set_aside' ? S((top as LadderRow & { status_note?: string }).status_note) || 'its main keyword was set aside' : top && hf && hf.flagged && !hf.ok ? `${hf.detail} (${hf.reason})` : '';
      const remaining = headSetAside ? [] : ordered.filter(open);
      const eligible = remaining.filter((r) => !isTop(r) || gateOpen);
      const mainWaiting = !headSetAside && !gateOpen && remaining.some(isTop) && !eligible.length;
      // F-KW (plan §5.6): a ladder planned more than 60 days ago that never had a page written waits for the app's fresh keyword check
      // (`rechecked_at` on its settings row, no older than the plan and itself within 60 days); a check that fell pauses it instead
      const plannedAt = Date.parse(start);
      const everWritten =
        rows.some((r) => LADDER_WRITTEN.has(S(r.status)) || (S(r.status) === 'published' && !(r.page_exists === true || String(r.page_exists) === 'true'))) ||
        slog.some((l) => S(l.ladder_id) === String(id) || rows.some((r) => norm(r.keyword) === norm(l.keyword)));
      const recheckedT = Date.parse(S((st as (LadderSettingsRow & { rechecked_at?: unknown }) | null)?.rechecked_at));
      const recheckDue =
        !headSetAside &&
        Number.isFinite(plannedAt) &&
        at - plannedAt > CADENCE.recheckDays * 864e5 &&
        !everWritten &&
        !(Number.isFinite(recheckedT) && recheckedT >= plannedAt && at - recheckedT <= CADENCE.recheckDays * 864e5);
      return { id, rows, top, head, mode, status, planType, prio, start, chosenBy, chosenOk, headPosition, won, wonChecks: lastN.length, supporting: support.length, published, gateOpen, mainWaiting, remaining, eligible, headSetAside, recheckDue };
    })
    .sort((a, b) => a.prio - b.prio || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  type Info = (typeof info)[number];
  // R-K2
  const clientLadders = info.filter((x) => clientIds.has(String(x.id)));
  const waitingForKeyword = level < 3 && !clientLadders.length;
  const writable = info.filter((x) => (x.status === 'active' || x.status === 'queued') && !x.won);
  const autoL = writable.filter((x) => x.mode === 'auto' && x.remaining.length && x.chosenOk);
  const active = autoL.slice(0, cfg.maxActive);
  const queued = autoL.slice(cfg.maxActive);
  const manualL = writable.filter((x) => x.mode === 'manual');
  const unchosenL = writable.filter((x) => x.mode === 'auto' && !x.chosenOk);

  const ladderCand = (x: Info, l: LadderRow): Cand => {
    const rung = num(l.rung);
    return {
      keyword: l.keyword,
      source: 'ladder',
      why: `Keyword ladder "${l.head_keyword || ''}", ${rung === 4 ? 'the main page' : `rung ${rung}`}: the next planned page towards the main keyword`,
      pageType: l.page_type || 'Service Page',
      existingPageUrl: l.page_exists === true || String(l.page_exists) === 'true' ? l.target_url || '' : '',
      ladder: { id: l.ladder_id, rung, head: l.head_keyword || '', pageNo: num(l.page_no) },
      itemKey: cycleNorm(l.keyword),
      auto: true,
      estUsd: estPageUsd,
      chosenBy: x.chosenBy,
    };
  };
  const cands: Cand[] = [];
  // F-KW: an active ladder waiting for its fresh check keeps its place (the next ladder does not jump the queue) and writes nothing
  const recheckL = active.filter((x) => x.recheckDue);
  for (const x of active)
    for (const l of x.recheckDue ? [] : x.eligible) {
      if (isSkipped(l.keyword)) {
        noteSkip(l.keyword, 'ladder');
        continue;
      }
      cands.push(ladderCand(x, l));
    }

  // ---- opportunities: refreshes of pages losing traffic, striking distance, rising searches ----
  const opps: Cand[] = [];
  const pageKey = (u: unknown) => S(u).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const invRows = (input.pages ?? []).filter((p) => p && p.url && (!p.site_id || p.site_id === siteId));
  const decayRows = invRows.filter((r) => S(r.decay_state) === 'decaying');
  const touchedRecently = new Set(slog.filter((l) => l.existing_page_url && at - ms(l.started_at) < CADENCE.decayRefreshDays * 864e5).map((l) => pageKey(l.existing_page_url)));
  const topQueryRow = (r: SitePageRow) => {
    let best: { query: string; impressions: number } | null = null;
    for (const q of queriesOf(r)) {
      const k = S((q as { query?: unknown }).query);
      if (!k) continue;
      if (!best || (Number(q.impressions) || 0) > best.impressions) best = { query: k, impressions: Number(q.impressions) || 0 };
    }
    return best;
  };
  const decayCands = decayRows
    .map((r) => ({ row: r, q: topQueryRow(r), lost: num(r.decay_lost) }))
    .filter((x) => x.q && !touchedRecently.has(pageKey(x.row.url)) && !recent.has(norm(x.q.query)) && !ladderKw.has(norm(x.q.query)))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, CADENCE.decayPerWeek);
  const item = (o: Omit<Cand, 'itemKey' | 'auto' | 'estUsd' | 'ladder'> & { ladder?: QueueItem['ladder'] }): Cand => ({ ladder: null, ...o, itemKey: cycleNorm(o.keyword), auto: false, estUsd: estPageUsd });
  for (const x of decayCands)
    opps.push(
      item({
        keyword: x.q!.query,
        source: 'decay',
        pageType: 'Guide',
        existingPageUrl: x.row.url,
        decayLost: x.lost,
        why: `This page is losing traffic: ${x.lost} clicks lost in 28 days (${num(x.row.prev_clicks)} to ${num(x.row.clicks)})${S(x.row.decay_kind) === 'clickthrough' ? ', and it is still shown as often, so the title and description come first' : ''}. It is refreshed, not written again.`,
      }),
    );
  const sq = input.queries.filter((q) => q && q.query && (!q.domain || normD(q.domain) === domain));
  const latest = sq.reduce((m, q) => (S(q.period_end) > m ? S(q.period_end) : m), '');
  // F-KW: a brand query names the site's DISTINCTIVE label (fitOwnLabels): on an exact-match domain the client's own subject is not a brand query
  const protectT = [...new Set((fitCtx.protect ?? []).flatMap((x) => fitTokens(x)))];
  const brandQuery = (q: string) => {
    const t = fitTokens(q);
    const sq0 = t.join('');
    return fitOwnLabels(domain, t, protectT).some((l) => t.includes(l) || sq0.includes(l));
  };
  const strikes = sq
    .filter(
      (q) =>
        S(q.period_end) === latest &&
        Number(q.position) >= CADENCE.strikingMin &&
        Number(q.position) <= CADENCE.strikingMax &&
        Number(q.impressions) >= CADENCE.strikingMinImpressions &&
        !brandQuery(q.query) &&
        !recent.has(norm(q.query)) &&
        !ladderKw.has(norm(q.query)),
    )
    .sort((a, b) => Number(b.impressions) - Number(a.impressions));
  const decayUrls = new Set(decayCands.map((x) => pageKey(x.row.url)));
  for (const q of strikes) {
    if (q.page && decayUrls.has(pageKey(q.page))) continue;
    opps.push(
      item({
        keyword: q.query,
        source: 'striking',
        pageType: q.page && !/\/(blog|news|insights|articles)\//i.test(q.page) ? 'Service Page' : 'Guide',
        existingPageUrl: q.page || '',
        why: `Ranks #${Math.round(Number(q.position))} with ${q.impressions} impressions in 28 days (Search Console): one push from the top 3`,
      }),
    );
  }
  const rising = input.trends.filter((t) => t && t.direction === 'rising' && t.rising && (!t.domain || normD(t.domain) === domain));
  const latestT = rising.reduce((m, t) => (S(t.checked_at) > m ? S(t.checked_at) : m), '');
  for (const t of rising.filter((x) => S(x.checked_at) === latestT))
    for (const rq of S(t.rising)
      .split(',')
      .map((x) => x.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase())
      .filter(Boolean)) {
      if (recent.has(norm(rq)) || ladderKw.has(norm(rq)) || cands.some((c) => norm(c.keyword) === norm(rq)) || opps.some((c) => norm(c.keyword) === norm(rq))) continue;
      opps.push(item({ keyword: rq, source: 'trend', pageType: 'Guide', existingPageUrl: '', why: `Rising related search for "${t.keyword}" (Google Trends, ${t.change_pct > 0 ? '+' : ''}${t.change_pct}% against the 12-month average)` }));
    }
  // R-K3 / F-KW: what runs on its own at this level. Every automatic item needs positive topic evidence (against what the client chose; at
  // level 3 also what the site sells), level 2 also an existing page, and never the homepage or a main menu page
  const autoFor = (o: Cand) => (AUTO_SOURCES[level] as readonly string[]).includes(o.source) && o.inTopic === true && !o.mainPage && (level === 3 || !!o.existingPageUrl);
  const okOpps: Cand[] = [];
  for (const o of opps) {
    const g = gateOf(o.keyword);
    if (!g.ok) {
      refuse(o, g);
      continue;
    }
    if (isSkipped(o.keyword)) {
      noteSkip(o.keyword, o.source);
      continue;
    }
    okOpps.push(markTopic(o));
  }

  // ---- the AI page (v4.12): the most valuable queued AI target the gate lets through, within the month's allowance, one a week ----
  const isAi = (l: { source?: string }) => l.source === 'ai_answer' || l.source === 'ai_refresh';
  const aiUsed = slog.filter((l) => isAi(l) && S(l.started_at).slice(0, 7) === atIso.slice(0, 7)).length;
  const aiThisWeek = slog.some((l) => isAi(l) && at - ms(l.started_at) < 6 * 864e5);
  const refreshedRecently = new Set(slog.filter((l) => l.existing_page_url && at - ms(l.started_at) < 60 * 864e5).map((l) => pageKey(l.existing_page_url)));
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'list', 'guide']);
  const headWords = new Set(lrows.flatMap((l) => norm(l.head_keyword).split(' ')).filter(Boolean));
  const kwTok = (k: string) => [...new Set(norm(k).replace(/\b(e)\b/g, ' ').split(' ').filter((w) => w.length > 2 && !STOPW.has(w) && !headWords.has(w)))];
  const sameSearch = (a: string, b: string) => {
    const A = kwTok(a), B = new Set(kwTok(b));
    return A.length > 0 && B.size > 0 && A.filter((w) => B.has(w)).length / A.length >= 0.6;
  };
  const ladderFor = (t: AiTargetRow) => lrows.find((l) => sameSearch(t.keyword, l.keyword) || sameSearch(l.keyword, t.keyword)) ?? null;
  const aiTargetOf = (t: AiTargetRow): NonNullable<QueueItem['aiTarget']> => ({
    targetId: t.target_id,
    question: t.question,
    kind: t.kind === 'refresh' ? 'refresh' : 'answer',
    fanout: S(t.fanout).split(' | ').filter(Boolean),
    sources: jparse<unknown[]>(t.sources_json, []).filter((x) => x && typeof x === 'object').map((x) => ({ url: S((x as { u?: unknown; url?: unknown }).u ?? (x as { url?: unknown }).url), title: S((x as { t?: unknown; title?: unknown }).t ?? (x as { title?: unknown }).title) })).filter((x) => x.url),
    competitors: S(t.competitors).split(', ').filter(Boolean),
  });
  const aiTargets = (input.aiTargets ?? []).filter((t) => t && t.target_id && t.status === 'queued' && (!t.site_id || t.site_id === siteId));
  const aiQueue: Cand[] = [];
  for (const t of aiTargets
    .filter((t) => t.keyword && !(t.kind !== 'refresh' && ladderFor(t)) && (t.kind === 'refresh' ? !!t.page_url && !refreshedRecently.has(pageKey(t.page_url)) : !recent.has(norm(t.keyword)) && !ladderKw.has(norm(t.keyword))))
    .sort((a, b) => num(b.value) - num(a.value))) {
    const o = item({
      keyword: t.keyword,
      source: t.kind === 'refresh' ? 'ai_refresh' : 'ai_answer',
      pageType: t.kind === 'refresh' ? 'Service Page' : t.page_type || 'Guide',
      existingPageUrl: t.kind === 'refresh' ? t.page_url : '',
      targetId: t.target_id,
      why: `AI answers "${t.question}" without you${t.competitors ? ` (it names ${S(t.competitors).split(', ').slice(0, 3).join(', ')})` : ''}${t.kind === 'refresh' ? `: refresh ${t.page_url}` : ': a new answer page'}`,
      aiTarget: aiTargetOf(t),
    });
    const g = gateOf(o.keyword);
    if (!g.ok) {
      refuse(o, g);
      continue;
    }
    if (isSkipped(o.keyword)) {
      noteSkip(o.keyword, o.source);
      continue;
    }
    aiQueue.push(markTopic(o));
  }
  // F-KW: the client's own subject first (stable: by value inside each group)
  aiQueue.sort((a, b) => (b.inTopic === true ? 1 : 0) - (a.inTopic === true ? 1 : 0));
  const aiDue = aiQuota > aiUsed && !aiThisWeek;
  const aiCand0 = aiQueue[0] ?? null;
  const aiAuto2 = level === 2 && aiCand0 && aiDue && aiCand0.source === 'ai_refresh' && !!aiCand0.existingPageUrl && aiCand0.inTopic === true && !aiCand0.mainPage ? aiCand0 : null;
  const autoOpps = [...okOpps.filter(autoFor), ...(aiAuto2 ? [aiAuto2] : [])];
  // the level-3 AI page needs evidence too
  const aiTop3 = level === 3 && aiCand0 && aiCand0.inTopic === true && !aiCand0.mainPage ? aiCand0 : null;
  const needOk = [...okOpps.filter((o) => !autoFor(o)), ...aiQueue.filter((o) => o !== aiAuto2 && o !== aiTop3)];
  // while the website waits for its first keyword the level's automatic items are shown as suggestions, so they may be approved too
  const approvable = [...needOk, ...(waitingForKeyword ? autoOpps : []), ...[...manualL, ...unchosenL].flatMap((x) => x.eligible.filter((l) => !isSkipped(l.keyword)).map((l) => ladderCand(x, l)))];
  const approvedSeen = new Set<string>();
  const approvalAmbiguous: { itemKey: string; keyword: string; sources: string[] }[] = [];
  // the approval row that names this item (source / ladder), or a keyword-only row when no other item shares the keyword
  const approvalFor = (o: Cand) => {
    const k = cycleNorm(o.keyword);
    const rows0 = approveRows.filter((r) => cycleNorm(r.item_key) === k);
    if (!rows0.length) return false;
    if (rows0.some((r) => S(r.source) && rowFits(r, o))) return true;
    if (!rows0.some((r) => !S(r.source) && rowFits(r, o))) return false;
    const same = approvable.filter((x) => cycleNorm(x.keyword) === k);
    const kinds = new Set(same.map((x) => `${lc(x.source)}|${S(x.ladder?.id)}|${S(x.existingPageUrl)}`));
    if (kinds.size > 1) {
      if (!approvalAmbiguous.some((a) => a.itemKey === k)) approvalAmbiguous.push({ itemKey: k, keyword: o.keyword, sources: same.map((x) => x.source) });
      return false;
    }
    return true;
  };
  const approved = approvable
    .filter((o) => {
      const k = cycleNorm(o.keyword);
      if (approvedSeen.has(k) || !approvalFor(o)) return false;
      approvedSeen.add(k);
      return true;
    })
    .map((o) => ({ ...o, approved: true, auto: false, why: `${o.why}; approved by you for this cycle` }));
  cands.push(...approved, ...autoOpps.filter((o) => !approvedSeen.has(cycleNorm(o.keyword))).map((o) => ({ ...o, auto: true })));

  // ---- D11: one search, one page ----
  const covered: CadencePlan['coveredByLivePages'] = [];
  const coverOf = (x: Cand) => (x.existingPageUrl || !invRows.length ? null : matchPage(invRows, x.keyword));
  const seen = new Set<string>();
  const uniq = cands.filter((x) => {
    const k = norm(x.keyword);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    const c = coverOf(x);
    if (!c) return true;
    covered.push({ keyword: x.keyword, source: x.source, url: c.url });
    if (x.source !== 'ladder') return false;
    x.existingPageUrl = c.url;
    x.why += `. ${c.url} already answers this search, so it is refreshed, not written again`;
    return true;
  });

  // ---- the pile-up guard ----
  const W = waitingOf(slog, lrows, at, CADENCE.waitingDays);
  const pileup = W.keys.size >= cfg.maxWaiting;
  const pausedReason: CadencePlan['pausedReason'] = pileup && !force ? 'pileup' : '';

  // ---- R-K7: one cycle, one budget ----
  const inWin = (t: unknown) => {
    const v = ms(t);
    return v > 0 && v >= windowStart;
  };
  const inFlight = (t: unknown) => {
    const v = ms(t);
    return v > 0 && at - v < CADENCE.inFlightHours * 36e5;
  };
  // F-KW: a page a LADDER START wrote counts against the first cadence run after it, wherever in the cycle it happened: inside a cycle every
  // start since the previous cycle's cadence ran (seo_cycle_jobs started_at, else its due time, else this due time minus 7 days)
  const jobTime = (r: { due_at?: string; started_at?: string }) => S(r.due_at || r.started_at);
  const prevJob =
    isCycle && schedT
      ? (input.cycleJobs ?? [])
          .filter((r) => r && (!r.site_id || r.site_id === siteId) && S(r.job) === 'content_cadence' && S(r.cycle_key) !== cycleKey && Number.isFinite(Date.parse(jobTime(r))) && Date.parse(jobTime(r)) < schedT)
          .sort((a, b) => jobTime(b).localeCompare(jobTime(a)))[0] ?? null
      : null;
  const prevRan = prevJob ? Date.parse(S(prevJob.started_at)) || Date.parse(S(prevJob.due_at)) : NaN;
  const startWindow = isCycle && schedT ? Math.min(schedT, Number.isFinite(prevRan) ? prevRan : schedT - CADENCE.cycleDays * 864e5) : windowStart;
  const inStartWin = (t: unknown) => {
    const v = Date.parse(S(t));
    return Number.isFinite(v) && v >= startWindow && v <= at;
  };
  const EXISTS = new Set(['written', 'not_ready', 'published']);
  const spentKeys = new Map<string, string>();
  const spend = (kw: string, how: string) => {
    const k = norm(kw);
    if (k && !spentKeys.has(k)) spentKeys.set(k, how);
  };
  for (const l of slog) {
    const own = /^cad_/.test(S(l.request_id));
    if (own ? !inWin(l.started_at) : !inStartWin(l.started_at)) continue; // this cycle's cadence from its due time; ladder starts since the last cadence run
    if (!own && S(l.source) !== 'ladder') continue; // the app's "Write it" is a page the client asked for on top
    const st = S(l.status);
    if (EXISTS.has(st) || S(l.published_url) || (st === 'started' && inFlight(l.started_at))) spend(l.keyword, own ? "this cycle's cadence" : 'ladder start');
  }
  for (const l of lrows)
    if (LADDER_WRITTEN.has(l.status) && inStartWin(l.start_date) && inFlight(l.start_date) && !/^cad_/.test(S((l as LadderRow & { request_id?: string }).request_id)) && !slog.some((g) => norm(g.keyword) === norm(l.keyword) && inStartWin(g.started_at)))
      spend(l.keyword, 'ladder start (being written)');
  const spent = spentKeys.size;
  const room = Math.max(0, pages - spent);
  const budget = { pagesPerWeek: pages, spent, room, windowStart: new Date(windowStart).toISOString(), ladderStartWindow: new Date(startWindow).toISOString(), spentKeywords: [...spentKeys.entries()].slice(0, 10).map(([keyword, how]) => ({ keyword, how })) };
  // R-K2 stops what the system would choose before the first keyword, never what the client approved for this cycle
  const blocked = !!pausedReason || waitingForKeyword;
  const pickable = pausedReason ? [] : waitingForKeyword ? uniq.filter((x) => x.approved) : uniq;
  const picks: Cand[] = pickable.slice(0, room);
  // a ladder page that answers a queued AI question is written for it (one search, one page)
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    if (p.source !== 'ladder' || p.aiTarget) continue;
    const t = aiTargets.find((x) => x.kind !== 'refresh' && (sameSearch(x.keyword, p.keyword) || sameSearch(p.keyword, x.keyword)));
    if (t) picks[i] = { ...p, aiTarget: aiTargetOf(t), targetId: t.target_id, why: `${p.why}. Written to answer "${t.question}" in AI answers` };
  }
  const aiCand = aiCand0 && !picks.some((x) => norm(x.keyword) === norm(aiCand0.keyword)) ? aiCand0 : null;
  const aiPick = level === 3 && pages > 0 && aiCand && aiCand === aiTop3 && aiDue && !blocked ? { ...aiCand, auto: true } : null;
  if (aiPick) picks.push(aiPick);

  // ---- suggestions: every needs-OK candidate the gate let through, not skipped, not written now (max 5, AI first) ----
  const pickedK = new Set(picks.map((p) => norm(p.keyword)));
  const sugSeen = new Set<string>();
  const sugPool = [...(aiCand && aiDue && aiCand !== aiAuto2 && !(aiPick && norm(aiPick.keyword) === norm(aiCand.keyword)) ? [aiCand] : []), ...needOk.filter((o) => !isAi(o)), ...autoOpps.filter((o) => !pickedK.has(norm(o.keyword)) && blocked)];
  const suggestions = sugPool
    .filter((o) => {
      const k = norm(o.keyword);
      if (!k || sugSeen.has(k) || pickedK.has(k) || approvedSeen.has(k)) return false;
      sugSeen.add(k);
      const c = coverOf(o);
      if (c) {
        if (!covered.some((x) => norm(x.keyword) === k)) covered.push({ keyword: o.keyword, source: o.source, url: c.url });
        return false;
      }
      return true;
    })
    .slice(0, CADENCE.suggestions)
    .map((o) => ({ ...o, auto: false }));
  const awaitOf = (x: Info, why: string): Cand | null => {
    const l = x.eligible.find((r) => !isSkipped(r.keyword) && !approvedSeen.has(cycleNorm(r.keyword)));
    if (!l) return null;
    const c = ladderCand(x, l);
    return { ...c, auto: false, why: why || `The next page of your ladder "${x.head}": it waits for your OK` };
  };
  const awaitingApproval = [
    ...manualL.map((x) => awaitOf(x, '')),
    ...unchosenL.map((x) =>
      awaitOf(x, x.chosenBy === 'system_announced' ? 'A keyword we announced: its pages are written on their own only at full autopilot (level 3)' : `A ladder whose keyword you did not choose: its pages wait for your OK`),
    ),
    ...recheckL.map((x) => {
      const a = awaitOf(x, RECHECK_WHY);
      return a ? { ...a, recheck: true } : null;
    }),
  ].filter((x): x is Cand => !!x);
  const recheckLadders = recheckL.map((x) => ({ ladderId: x.id, head: x.head, plannedAt: x.start, reason: RECHECK_WHY }));
  const pickedNow = new Set(picks.map((p) => norm(p.keyword)));
  // an approval not written this cycle, with the reason: the pile-up guard, the budget, or a live page already answering its search
  const approvedNotWritten: CadencePlan['approvedNotWritten'] = [
    ...approved
      .filter((o) => !pickedNow.has(norm(o.keyword)))
      .map((o) => ({ keyword: o.keyword, source: o.source as TopicSource | '', reason: (pausedReason || (covered.some((c) => norm(c.keyword) === norm(o.keyword)) ? 'covered_by_live_page' : 'budget')) as 'pileup' | 'budget' | 'covered_by_live_page' })),
    ...approvalAmbiguous.map((a) => ({
      keyword: a.keyword,
      source: '' as const,
      reason: 'ambiguous' as const,
      detail: `your approval names only the keyword, and ${a.sources.length} different pages share it (${a.sources.join(', ')}): approve the one you want again`,
    })),
  ];
  const reason = waitingForKeyword
    ? `waiting for your first keyword: choose the keyword you want to be found for${picks.length ? '; until then only what you approved is written' : ', nothing is written until you do'}${suggestions.length ? ` (${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} wait for your OK)` : ''}`
    : pausedReason
      ? `${W.keys.size} written pages are waiting to be published (limit ${cfg.maxWaiting}): nothing new is written until they are`
      : !pages
        ? 'no pages a week are set for this website, so nothing is written at any autopilot level'
        : !picks.length && !room && spent
          ? `this cycle's ${pages} page${pages === 1 ? '' : 's'} a week ${spent === 1 ? 'is' : 'are'} already used`
          : !picks.length
            ? 'nothing to write automatically this week'
            : '';
  const activeIds = new Set(active.map((x) => x.id));
  const queuedIds = new Set(queued.map((x) => x.id));
  const unchosenIds = new Set(unchosenL.map((x) => x.id));
  const toQueue = (x: Info, l: LadderRow): QueueItem => {
    const c = ladderCand(x, l);
    return { keyword: c.keyword, source: c.source, why: c.why, pageType: c.pageType, existingPageUrl: c.existingPageUrl, ladder: c.ladder };
  };
  const ladders: CadenceLadder[] = info.map((x) => ({
    id: x.id,
    head: x.head,
    mode: x.mode,
    status: x.status,
    planType: x.planType,
    priority: Number.isFinite(x.prio) ? x.prio : null,
    start: x.start,
    chosenBy: x.chosenBy,
    headPosition: x.headPosition,
    won: x.won || x.status === 'won',
    supporting: x.supporting,
    published: x.published,
    gateOpen: x.gateOpen,
    mainWaiting: x.mainWaiting,
    remaining: x.remaining.map((l) => toQueue(x, l)),
    eligible: x.eligible.map((l) => toQueue(x, l)),
    role:
      x.won || x.status === 'won'
        ? 'won'
        : !['active', 'queued'].includes(x.status) || x.headSetAside
          ? 'paused'
          : x.mode === 'manual'
            ? 'manual'
            : unchosenIds.has(x.id)
              ? 'not_chosen'
              : activeIds.has(x.id)
                ? 'active'
                : queuedIds.has(x.id)
                  ? 'queued'
                  : 'done',
    headSetAside: x.headSetAside,
  }));
  const clean = (c: Cand): CadenceItem => {
    const { targetId: _t, head: _h, ...rest } = c;
    return rest;
  };
  const items = preview ? [...picks.map((p) => ({ ...clean(p), auto: true })), ...awaitingApproval.map((a) => ({ ...clean(a), auto: false }))] : [];
  return {
    config: cfg,
    level,
    trigger: trigger.kind,
    waitingForKeyword,
    // a preview starts nothing: what the cycle would write is in `items`
    picks: preview ? [] : picks.map(clean),
    candidates: uniq.map(clean),
    suggestions: suggestions.map(clean),
    awaitingApproval: awaitingApproval.map(clean),
    items,
    refused,
    setAside,
    skipped,
    approvedItems: approved.map((o) => ({ keyword: o.keyword, source: o.source, itemKey: cycleNorm(o.keyword) })),
    approvedNotWritten,
    budget,
    recheckLadders,
    ladders,
    queued: queued.map((x) => x.id),
    won: info.filter((x) => x.won || x.status === 'won').map((x) => x.id),
    waitingForSupport: info.filter((x) => x.mainWaiting && (x.status === 'active' || x.status === 'queued') && !x.won).map((x) => x.id),
    pausedReason,
    waitingPublish: W.keys.size,
    waitingKeywords: W.list.map((w) => w.keyword),
    needsFix: W.list.filter((w) => w.needsFix).map((w) => w.keyword),
    coveredByLivePages: covered,
    aiPages: { perMonth: aiQuota, usedThisMonth: aiUsed, thisWeek: !!aiPick, onTop: level === 3 },
    reason,
    estPageUsd,
  };
}

export interface CadenceWeek extends CadencePlan {
  /** the cycle (UTC ISO), '' for a plan at `now` */
  at: string;
  /** the cycle's key, when the website's cycle is known */
  cycleKey: string;
}

/**
 * The coming cycles, one after the other: each cycle's picks are logged as written (content log 'written' at the cycle, as the
 * real runs do), so later cycles move on, and stop once the pile-up guard holds. Nothing is assumed to get published or to rank.
 * Without cycles, one plan at `now` shows what would be written. `runs` are the cycles' due times; `keys` their cycle keys.
 */
export function simulateCadence(input: CadenceInput, runs: string[], now = Date.now(), keys: string[] = []): CadenceWeek[] {
  if (!runs.length) return [{ ...planCadence(input, now, { kind: 'cycle' }), at: '', cycleKey: '' }];
  const logs = [...input.logs];
  const weeks: CadenceWeek[] = [];
  runs.forEach((at, i) => {
    const t = Date.parse(at);
    const cycleKey = keys[i] ?? '';
    const plan = planCadence({ ...input, logs }, Number.isFinite(t) ? t : now, { kind: 'cycle', cycleKey, scheduledFor: at });
    weeks.push({ ...plan, at, cycleKey });
    for (const p of plan.picks)
      logs.push({
        keyword: p.keyword,
        status: 'written',
        started_at: at,
        published_url: '',
        published_at: '',
        domain: input.domain,
        ladder_id: p.ladder?.id ?? '',
        source: p.source,
        existing_page_url: p.existingPageUrl || '',
        request_id: 'cad_simulated',
      } as ContentLogRow);
  });
  return weeks;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The engine's tables, read as the cadence reads them (the fixture's rows, and the rows the Pipeline loads from n8n)
// ---------------------------------------------------------------------------------------------------------------------------------

/** One website's seo_sites row as the cadence reads it (the site model's services and competitors). */
export interface CadenceSiteRow {
  site_id?: string;
  domain: string;
  status?: string;
  services_json?: string;
  declared_services?: string;
  competitors?: string;
  /** F-KW: the website's main menu pages ([{url, title}]) */
  nav_pages_json?: string;
}

/** What the client said they sell: the app's own list first, then the engine row's declared_services (SM.from's declListOf). */
export function declaredServicesOf(site: CadenceSiteRow | null | undefined, extra: string[] = []): string[] {
  const v = site?.declared_services;
  const j = jparse<unknown>(v, null);
  const list = Array.isArray(v) ? (v as unknown[]).map(String) : Array.isArray(j) ? j.map(String) : listOf(v);
  return [...new Set([...extra, ...list].map((s) => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30);
}

/** The website's main menu pages as the engine stored them (seo_sites.nav_pages_json), at most 12. */
export function navPagesOf(site: CadenceSiteRow | null | undefined): { url: string; title: string }[] {
  const j = jparse<unknown>(site?.nav_pages_json, []);
  return (Array.isArray(j) ? j : [])
    .map((p) => ({ url: S((p as { url?: unknown })?.url), title: S((p as { title?: unknown })?.title) }))
    .filter((p) => p.url)
    .slice(0, 12);
}
export interface CadenceMonitorsRow {
  site_id?: string;
  domain?: string;
  ai_visibility?: unknown;
  ai_growth?: unknown;
  ai_pages_month?: unknown;
  competitors?: unknown;
}

const on = (v: unknown) => !(v === false || /^(false|0|no|off)$/i.test(String(v == null ? '' : v)));
/** The AI pages a month, as the engine reads them from seo_monitors: 0 when AI visibility or AI growth is off; empty = 2 (max 8). */
export function aiQuotaOf(m: CadenceMonitorsRow | null | undefined): number {
  const r = m ?? {};
  if (!on(r.ai_visibility) || !on(r.ai_growth)) return 0;
  return r.ai_pages_month === '' || r.ai_pages_month == null || !Number.isFinite(Number(r.ai_pages_month)) ? 2 : Math.min(8, Math.max(0, Math.round(Number(r.ai_pages_month))));
}

/** The site model's services (SM.from): what the client declared first, then what the crawl read; plus the app's own list. */
export function servicesOf(site: CadenceSiteRow | null | undefined, extra: string[] = []): string[] {
  const declared = (() => {
    const v = site?.declared_services;
    const j = jparse<unknown>(v, null);
    return Array.isArray(j) ? j.map(String) : listOf(v);
  })();
  const crawled = jparse<unknown>(site?.services_json, []);
  return [...new Set([...extra, ...declared, ...(Array.isArray(crawled) ? crawled.map(String) : [])].map((s) => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30);
}

export function competitorsOf(site: CadenceSiteRow | null | undefined, monitors: CadenceMonitorsRow | null | undefined, extra: string[] = []): string[] {
  const own = normD(site?.domain);
  return [...new Set([...listOf(monitors?.competitors), ...extra, ...listOf(site?.competitors)].map(bareHost).filter((d) => d && d !== own))].slice(0, 8);
}

/** The engine tables of one website (the fixture's `tables`) as the mirror's input. */
export interface CadenceTables {
  sites?: CadenceSiteRow[];
  cadence?: { site_id?: string; domain?: string; pages_per_week?: unknown; status?: string }[];
  ladders?: LadderRow[];
  ladder_settings?: LadderSettingsRow[];
  content_log?: ContentLogRow[];
  query_history?: QueryRow[];
  trends?: TrendRow[];
  pages?: SitePageRow[];
  ai_targets?: AiTargetRow[];
  skips?: SkipRow[];
  monitors?: CadenceMonitorsRow[];
  ranks?: RankHistoryRow[];
  ai_brands?: unknown[];
  /** F-KW: seo_cycle_jobs (the content_cadence jobs of earlier cycles) */
  cycle_jobs?: { site_id?: string; job?: string; cycle_key?: string; due_at?: string; started_at?: string }[];
}

/** One website's input from the engine's own rows: pages a week from seo_cadence (`off` = 0), the AI quota from seo_monitors. */
export function cadenceInputFromTables(t: CadenceTables, o: { siteId?: string; domain?: string; estPageUsd?: number; services?: string[]; competitors?: string[] } = {}): CadenceInput {
  const site = (t.sites ?? []).find((s) => (o.siteId && s.site_id === o.siteId) || (o.domain && normD(s.domain) === normD(o.domain))) ?? (t.sites ?? [])[0] ?? { domain: o.domain ?? '' };
  const domain = normD(site.domain || o.domain);
  const siteId = site.site_id || o.siteId || 'site_' + domain.replace(/[^a-z0-9]+/g, '-');
  const mine = <T extends { site_id?: string; domain?: string }>(rows: T[] | undefined) => (rows ?? []).filter((r) => r && (r.site_id === siteId || normD(r.domain) === domain));
  const cad = mine(t.cadence)[0];
  const pages = cad ? (lc(cad.status || 'active') === 'off' ? 0 : Number(cad.pages_per_week) || 0) : null;
  const mon = mine(t.monitors)[0] ?? null;
  return {
    domain,
    siteId,
    siteStatus: S(site.status) || 'active',
    pagesPerWeek: pages,
    ladders: (t.ladders ?? []).filter((l) => normD(l.domain) === domain),
    queries: t.query_history ?? [],
    trends: t.trends ?? [],
    logs: t.content_log ?? [],
    settings: (t.ladder_settings ?? []).filter((r) => r.site_id === siteId || normD(r.domain) === domain),
    history: t.ranks ?? [],
    aiTargets: t.ai_targets ?? [],
    aiPagesPerMonth: aiQuotaOf(mon),
    pages: t.pages ?? [],
    services: servicesOf(site, o.services ?? []),
    declaredServices: declaredServicesOf(site, o.services ?? []),
    navPages: navPagesOf(site),
    competitors: competitorsOf(site, mon, o.competitors ?? []),
    aiBrands: t.ai_brands ?? [],
    skips: t.skips ?? [],
    cycleJobs: (t.cycle_jobs ?? []).filter((r) => r && (!r.site_id || r.site_id === siteId)),
    estPageUsd: o.estPageUsd,
  };
}

/** The Manual Run input of the engine (the fixture's `trigger`) as the mirror's trigger. */
export function triggerOf(t: Record<string, unknown> | null | undefined): CadenceTrigger {
  const x = t ?? {};
  const isCycle = lc(x.trigger) === 'cycle';
  // F-KW: ANY `preview: true` is a preview (with or without a cycle), and writes nothing
  const preview = x.preview === true || lc(x.preview) === 'true' || (isCycle && lc(x.job) === 'preview');
  if (isCycle) return { kind: 'cycle', cycleKey: S(x.cycle_key), scheduledFor: S(x.scheduled_for), preview };
  if (S(x.domain) || S(x.site_id))
    return { kind: 'on_demand', preview, force: !preview && (x.force === true || lc(x.force) === 'true'), ...(x.pages != null && x.pages !== '' ? { pages: Number(x.pages) } : {}) };
  return { kind: 'batch', preview };
}

/**
 * The forecast's question (shared/src/autopilot.ts `writing`, plan §5.4): does a ladder the client chose (or, at level 3, one we
 * announced) still have a page to write in Auto mode? Levels 1 and 2 write nothing else on their own. Pure.
 */
export function chosenLadderWriting(ladders: LadderRow[], settings: LadderSettingsRow[], level: AutopilotLevel): boolean {
  const cfg = cadenceSiteConfig(settings);
  const settingOf = new Map(settings.filter((r) => r.ladder_id && String(r.ladder_id) !== LADDER_SITE_ROW).map((r) => [String(r.ladder_id), r]));
  const planned = new Set(ladders.filter((l) => l && l.ladder_id && l.keyword && S(l.status || 'planned') === 'planned').map((l) => l.ladder_id));
  for (const id of planned) {
    const st = settingOf.get(String(id));
    const mode = st && (lc(st.mode) === 'auto' || lc(st.mode) === 'manual') ? lc(st.mode) : cfg.mode;
    const status = st && (STATUSES as readonly string[]).includes(lc(st.status)) ? lc(st.status) : 'active';
    // F-KW: the settings row names the chooser, else the ladder's own rows (the ladder run writes chosen_by on them first)
    const chosen = lc(st?.chosen_by) || (ladders.filter((l) => l && l.ladder_id === id).map((l) => lc(l.chosen_by)).find(Boolean) ?? '');
    if (mode === 'auto' && (status === 'active' || status === 'queued') && (CLIENT_CHOSEN.has(chosen) || (chosen === 'system_announced' && level === 3))) return true;
  }
  return false;
}
