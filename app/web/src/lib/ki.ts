// KI web (2026-11-08, docs/keyword-intel-2026-11-08/DESIGN.md §6, CONTRACTS.md §7): what the Competitors and Keyword research pages read
// from the server, made tolerant of the exact answer shape (A1 builds the routes in parallel: rows may come as `rows` or under the kind's
// name, JSON columns as strings or already parsed, keys snake or camel), and the pure rules the pages use (filters, plain-language
// headlines, the questions list, the choose-up-to-5 check, the 409 words, which tools are offered). No fetch here: hooks are in queries.ts.

import {
  isKiRunMode,
  KI_CLASSES,
  KI_MAX_COMPETITORS,
  KI_SCORED_CLASSES,
  KI_STAGE_WEIGHT,
  KI_VERDICT_IDS,
  kiBasisLabel,
  kiGateWords,
  kiModeOf,
  kiQuestionText,
  kiVerdict,
  MODES,
  type KiBasis,
  type KiClass,
  type KiCompetitorProfile,
  type KiCompStatus,
  type KiEvidence,
  type KiGapStatus,
  type KiGapType,
  type KiMode,
  type KiPlanAction,
  type KiRunMode,
  type KiRunStatus,
  type KiSectionStateRow,
  type KiSource,
  type KiStage,
  type KiVerdict,
  type ModeId,
} from '@seo/shared';
import { ApiRequestError } from './api';
import { fmtDate } from './utils';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean => v === true || v === 1 || /^(true|1|yes)$/i.test(str(v));
/** a JSON column: a string from the table, or already parsed by the server */
export function kiJson<T>(v: unknown, fallback: T): T {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
/** a field by its snake name, or its camel twin */
const pick = (o: Obj, snake: string): unknown => (snake in o ? o[snake] : o[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())]);
const listOf = (raw: unknown, ...keys: string[]): Obj[] => {
  if (Array.isArray(raw)) return raw.filter(isObj);
  if (!isObj(raw)) return [];
  for (const k of keys) if (Array.isArray(raw[k])) return (raw[k] as unknown[]).filter(isObj);
  return [];
};

// ------------------------------------------------------------------------------------------------------------------------------
// GET .../ki: the website's mode, whether this person sees the pages, the latest runs and the credit prices
// ------------------------------------------------------------------------------------------------------------------------------

export interface KiRunInfo {
  kind: KiRunMode;
  status: KiRunStatus;
  reason: string;
  startedAt: string | null;
  finishedAt: string | null;
  sections: KiSectionStateRow[];
  market: string;
  /** the run's counts ({keywords, clusters, go, months, hard, gated, striking, competitors, ...}) */
  counts: Record<string, number>;
}
/** The plan's actions (CONTRACTS §4 `plan`), at most 10, whatever key style they arrive in. */
export function planOf(v: unknown): KiPlanAction[] {
  return (Array.isArray(v) ? v : [])
    .filter(isObj)
    .slice(0, 10)
    .map((a) => ({ action_id: str(pick(a, 'action_id') || a.id), kind: str(a.kind) as KiPlanAction['kind'], title: str(a.title), why: str(a.why), target: str(a.target), credits: num(a.credits) ?? 0, gap_id: str(pick(a, 'gap_id')) || undefined, cluster_id: str(pick(a, 'cluster_id')) || undefined }))
    .filter((a) => a.action_id && a.title);
}

export interface KiOverview {
  mode: KiMode;
  visible: boolean;
  killed: boolean;
  maxCompetitors: number;
  market: string;
  lastRuns: Partial<Record<KiRunMode, KiRunInfo>>;
  /** credits a default run is quoted at (null: use the app's own estimate) */
  credits: { competitors: number | null; research: number | null };
  /** the Start button of a plan action works (the start route answers 501 until W2; the server says so here, default no) */
  planStart: boolean;
  /** the hero counts (A1 `KiSummary`), null before any run or when not visible */
  summary: KiSummaryCounts | null;
  /** the plan when the server sends it with the overview (else the latest research report carries it) */
  plan: KiPlanAction[];
}
/** A1_ROUTES `KiSummary`, read loosely */
export interface KiSummaryCounts {
  market: string;
  competitors: { total: number; chosen: number; watch: number; candidates: number; listings: number; platforms: number; confirmed: boolean };
  keywords: { total: number; byVerdict: Partial<Record<KiVerdict, number>>; headsByVerdict: Partial<Record<KiVerdict, number>> | null; striking: number; quickWins: number; questions: number; clusters: number };
  gaps: { open: number; byType: Partial<Record<KiGapType, number>> };
  fetchedAt: string | null;
}
const numMap = (v: unknown): Record<string, number> => (isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x) ?? 0])) : {});
function summaryOf(v: unknown): KiSummaryCounts | null {
  if (!isObj(v)) return null;
  const c = isObj(v.competitors) ? v.competitors : {};
  const k = isObj(v.keywords) ? v.keywords : {};
  const g = isObj(v.gaps) ? v.gaps : {};
  const n = (o: Obj, key: string) => num(o[key]) ?? 0;
  return {
    market: str(v.market),
    competitors: { total: n(c, 'total'), chosen: n(c, 'chosen'), watch: n(c, 'watch'), candidates: n(c, 'candidates'), listings: n(c, 'listings'), platforms: n(c, 'platforms'), confirmed: bool(c.confirmed) },
    keywords: { total: n(k, 'total'), byVerdict: numMap(k.byVerdict ?? k.by_verdict), headsByVerdict: isObj(k.headsByVerdict) ? numMap(k.headsByVerdict) : null, striking: n(k, 'striking'), quickWins: n(k, 'quickWins'), questions: n(k, 'questions'), clusters: n(k, 'clusters') },
    gaps: { open: n(g, 'open'), byType: numMap(g.byType ?? g.by_type) },
    fetchedAt: str(v.fetchedAt ?? v.fetched_at) || null,
  };
}

function runOf(o: Obj, kindHint?: string): KiRunInfo | null {
  const kind = str(pick(o, 'kind') || kindHint);
  const k = kind === 'research' ? 'keyword_research' : kind;
  if (!isKiRunMode(k)) return null;
  const sections = kiJson<unknown[]>(pick(o, 'sections') ?? pick(o, 'sections_json'), []).filter(isObj).map((s) => ({ key: str(s.key), state: str(s.state || 'ok') as KiSectionStateRow['state'], reason: str(s.reason), rows: num(s.rows) ?? 0 }));
  // A1: `missingSections` names the parts that could not be read (kept when the sections list does not say so itself)
  for (const m of Array.isArray(pick(o, 'missing_sections')) ? (pick(o, 'missing_sections') as unknown[]).map(str) : [])
    if (m && !sections.some((x) => x.key === m)) sections.push({ key: m, state: 'missing', reason: '', rows: 0 });
  return {
    kind: k,
    status: (str(pick(o, 'status')) || 'ok') as KiRunStatus,
    reason: str(pick(o, 'reason')),
    startedAt: str(pick(o, 'started_at')) || null,
    finishedAt: str(pick(o, 'finished_at')) || null,
    sections,
    market: str(pick(o, 'market')),
    counts: Object.fromEntries(Object.entries(kiJson<Obj>(pick(o, 'counts') ?? pick(o, 'counts_json') ?? pick(o, 'summary'), {})).map(([k, v]) => [k, num(v)]).filter((e): e is [string, number] => e[1] != null)),
  };
}

export function kiOverviewOf(raw: unknown): KiOverview {
  const o = isObj(raw) ? raw : {};
  const lastRuns: KiOverview['lastRuns'] = {};
  const lr = pick(o, 'last_runs');
  if (Array.isArray(lr)) for (const r of lr.filter(isObj)) { const x = runOf(r); if (x && !lastRuns[x.kind]) lastRuns[x.kind] = x; }
  else if (isObj(lr)) for (const [k, r] of Object.entries(lr)) { if (isObj(r)) { const x = runOf(r, k); if (x) lastRuns[x.kind] = x; } }
  const c = isObj(o.credits) ? o.credits : {};
  return {
    mode: kiModeOf(o.mode),
    visible: bool(o.visible),
    killed: bool(o.killed),
    maxCompetitors: Math.min(KI_MAX_COMPETITORS, Math.max(1, num(pick(o, 'max_competitors')) ?? KI_MAX_COMPETITORS)),
    market: str(o.market) || str(isObj(o.summary) ? o.summary.market : '') || Object.values(lastRuns)[0]?.market || '',
    lastRuns,
    credits: { competitors: num(c.competitors), research: num(c.research ?? c.keyword_research) },
    planStart: bool(pick(o, 'plan_start')),
    summary: summaryOf(o.summary),
    plan: planOf(o.plan),
  };
}

// ------------------------------------------------------------------------------------------------------------------------------
// competitors
// ------------------------------------------------------------------------------------------------------------------------------

export interface KiComp {
  domain: string;
  cls: KiClass;
  classConfidence: number | null;
  scored: boolean;
  score: number | null;
  scoreLow: number | null;
  scoreHigh: number | null;
  serpShare: number | null;
  aiShare: number | null;
  sizeTag: string;
  seedsSeen: number | null;
  seedsTotal: number | null;
  reasons: string[];
  evidence: KiEvidence[];
  declared: boolean;
  status: KiCompStatus;
  statusBy: string;
  firstSeen: string;
  lastSeen: string;
  profile: KiCompetitorProfile | null;
  needsReview: boolean;
}

export function kiCompOf(o: Obj): KiComp {
  const cls = str(pick(o, 'class') || pick(o, 'cls')) as KiClass;
  const conf = num(pick(o, 'class_confidence'));
  return {
    domain: str(pick(o, 'comp_domain') || pick(o, 'domain')),
    cls: cls in KI_CLASSES ? cls : 'adjacent',
    classConfidence: conf,
    scored: pick(o, 'scored') == null ? KI_SCORED_CLASSES.includes(cls) : bool(pick(o, 'scored')),
    score: num(pick(o, 'score')),
    scoreLow: num(pick(o, 'score_low')),
    scoreHigh: num(pick(o, 'score_high')),
    serpShare: num(pick(o, 'serp_share')),
    aiShare: num(pick(o, 'ai_share')),
    sizeTag: str(pick(o, 'size_tag')) || 'unknown',
    seedsSeen: num(pick(o, 'seeds_seen')),
    seedsTotal: num(pick(o, 'seeds_total')),
    reasons: kiJson<unknown[]>(pick(o, 'reasons') ?? pick(o, 'reasons_json'), []).map(str).filter(Boolean),
    evidence: kiJson<unknown[]>(pick(o, 'evidence') ?? pick(o, 'evidence_json'), []).filter(isObj).map((e) => ({ seed: str(e.seed), position: num(e.position) ?? 0, url: str(e.url) })),
    declared: bool(pick(o, 'declared')),
    status: (str(pick(o, 'status')) || 'candidate') as KiCompStatus,
    statusBy: str(pick(o, 'status_by')),
    firstSeen: str(pick(o, 'first_seen')),
    lastSeen: str(pick(o, 'last_seen')),
    profile: kiJson<KiCompetitorProfile | null>(pick(o, 'profile') ?? pick(o, 'profile_json'), null),
    needsReview: conf != null && conf < 0.6 && str(pick(o, 'class_basis')) === 'llm',
  };
}

export interface KiCompetitors {
  rows: KiComp[];
  updatedAt: string | null;
}
export function kiCompetitorsOf(raw: unknown): KiCompetitors {
  const rows = listOf(raw, 'rows', 'competitors', 'items').map(kiCompOf).filter((r) => r.domain);
  const o = isObj(raw) ? raw : {};
  return { rows, updatedAt: str(pick(o, 'updated_at')) || rows.map((r) => r.lastSeen).sort().at(-1) || null };
}

/** The competitor set split the way the page shows it: chosen, the rest to watch or pick from, and the sites that are not companies. */
export function kiSplit(rows: readonly KiComp[]) {
  const scored = rows.filter((r) => KI_SCORED_CLASSES.includes(r.cls) && r.status !== 'dismissed');
  const byScore = (a: KiComp, b: KiComp) => (b.score ?? -1) - (a.score ?? -1) || a.domain.localeCompare(b.domain);
  return {
    chosen: scored.filter((r) => r.status === 'chosen').sort(byScore),
    others: scored.filter((r) => r.status !== 'chosen').sort(byScore),
    dismissed: rows.filter((r) => r.status === 'dismissed'),
    /** directories and "best X" lists: places to be listed on */
    listings: rows.filter((r) => r.cls === 'directory' || r.cls === 'publisher_list').sort(byScore),
    /** platforms, software makers, media: the formats that win these searches, not rivals */
    formats: rows.filter((r) => r.cls === 'platform' || r.cls === 'principal' || r.cls === 'media'),
  };
}

/** Whether a status change may be sent: choosing beyond the cap is refused here first (the server refuses it too, with a 409). */
export function kiChooseCheck(rows: readonly KiComp[], domain: string, next: KiCompStatus, max: number): string | null {
  if (next !== 'chosen') return null;
  const already = rows.filter((r) => r.status === 'chosen' && r.domain !== domain).length;
  return already >= max ? kiMaxText(max) : null;
}
export const kiMaxText = (max: number) => `You can follow up to ${max} competitors. Move one to your watchlist first, then choose this one.`;

/** The rows with one competitor's status changed (the optimistic update of the page, undone if the server says no). */
export const kiWithStatus = (rows: readonly KiComp[], domain: string, status: KiCompStatus): KiComp[] =>
  rows.map((r) => (r.domain === domain ? { ...r, status, statusBy: 'user' } : r));

/** What a refused change says: a 409 is the cap (or a change the engine did not keep), in words a client can act on. */
export function kiPatchErrorText(e: unknown, max: number): string {
  if (e instanceof ApiRequestError) {
    if (e.status === 409) return /max|limit|chosen|up to/i.test(e.message) || e.code === 'ki_max_competitors' ? kiMaxText(max) : 'Someone changed this list a moment ago. We reloaded it: please try again.';
    if (e.status === 403) return 'You can look at this list, but changing it takes the member role.';
    return e.message;
  }
  return 'The change was not saved. Please try again.';
}

/** One sentence that answers "who do I compete with" first (the page's hero). */
export function kiCompetitorsHeadline(rows: readonly KiComp[], ownShare: number | null): string {
  const s = kiSplit(rows);
  const main = (s.chosen.length ? s.chosen : s.others).slice(0, 3).map((r) => r.domain);
  if (!main.length) return 'We found no company that keeps showing up next to you for your services yet.';
  const names = main.length === 1 ? main[0] : `${main.slice(0, -1).join(', ')} and ${main.at(-1)}`;
  const lead = s.chosen.length ? `You follow ${main.length === 1 ? 'one main competitor' : `${main.length} main competitors`}: ${names}.` : `Your ${main.length === 1 ? 'main competitor is' : `${main.length} main competitors are`} ${names}.`;
  return ownShare == null ? lead : `${lead} You show up for ${pctText(ownShare)} of the searches for your services.`;
}

export const pctText = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? '-' : `${Math.round((v > 1 ? v : v * 100) * 10) / 10}%`.replace('.0%', '%'));

// ------------------------------------------------------------------------------------------------------------------------------
// keywords
// ------------------------------------------------------------------------------------------------------------------------------

export interface KiKw {
  key: string;
  keyword: string;
  sources: { source: KiSource; fetched_at: string; detail?: string }[];
  volume: number | null;
  volumeBasis: KiBasis | null;
  volumeSource: string;
  cpc: number | null;
  kd: number | null;
  gscImpressions: number | null;
  gscPosition: number | null;
  gscPage: string;
  stage: KiStage | null;
  stageEvidence: string;
  needsReview: boolean;
  gate: 'pass' | 'fail';
  /** why it is "Not for you", always in plain words (the server's words, else ours from the code; never the engine's detail) */
  gateReason: string;
  factors: { fit: number | null; demand: number | null; win: number | null; value: number | null; gap: number | null; stageW: number | null };
  score: number | null;
  scoreLow: number | null;
  scoreHigh: number | null;
  lowConfidence: boolean;
  verdict: KiVerdict;
  clusterId: string;
  isHead: boolean;
  clusterSize: number | null;
  clusterDemand: number | null;
  pageAction: string;
  pageUrl: string;
  cannibal: boolean;
  competitors: { domain: string; position: number; url: string }[];
  striking: boolean;
  fetchedAt: string;
  brand: boolean;
  /** A1 marks the questions among the searches (null: the server did not say, we read the words) */
  question: boolean | null;
}

/** A1 sends Search Console figures as one nested object `gsc: {impressions, clicks, position, page}` */
const gscOf = (o: Obj): Obj => (isObj(o.gsc) ? o.gsc : {});

export function kiKwOf(o: Obj): KiKw {
  const stage = str(pick(o, 'stage')) as KiStage;
  const gate = str(pick(o, 'gate')) === 'fail' ? 'fail' : 'pass';
  // FX-A (review UX H1): A1 sends the factors nested (`factors: {fit, demand, win, value, gap}`); a stored row has them at the top level
  const fo = isObj(o.factors) ? o.factors : {};
  const factor = (k: string) => num(fo[k] ?? pick(o, k));
  const win = factor('win');
  const verdictRaw = str(pick(o, 'verdict')) as KiVerdict;
  const ev = pick(o, 'stage_evidence') ?? pick(o, 'stage_evidence_json');
  const evParsed = kiJson<unknown>(ev, '');
  const cannibal = kiJson<unknown>(pick(o, 'cannibal') ?? pick(o, 'cannibal_json'), null);
  return {
    key: str(pick(o, 'kw_key') || pick(o, 'keyword')),
    keyword: str(pick(o, 'keyword')),
    sources: kiJson<unknown[]>(pick(o, 'sources') ?? pick(o, 'sources_json'), []).filter(isObj).map((s) => ({ source: str(s.source) as KiSource, fetched_at: str(s.fetched_at ?? s.fetchedAt), detail: s.detail == null ? undefined : str(s.detail) })),
    volume: num(pick(o, 'volume')),
    volumeBasis: (str(pick(o, 'volume_basis')) || null) as KiBasis | null,
    volumeSource: str(pick(o, 'volume_source')),
    cpc: num(pick(o, 'cpc')),
    kd: num(pick(o, 'kd')),
    gscImpressions: num(pick(o, 'gsc_impressions') ?? gscOf(o).impressions),
    gscPosition: num(pick(o, 'gsc_position') ?? gscOf(o).position),
    gscPage: str(pick(o, 'gsc_page') ?? gscOf(o).page),
    stage: stage in KI_STAGE_WEIGHT ? stage : null,
    stageEvidence: typeof evParsed === 'string' ? evParsed : isObj(evParsed) ? str(evParsed.text ?? evParsed.summary ?? '') : Array.isArray(evParsed) ? evParsed.map(str).join(' ') : '',
    needsReview: bool(pick(o, 'needs_review')),
    gate,
    gateReason: gate === 'fail' ? kiGateWords(pick(o, 'gate_reason'), pick(o, 'gate_code')) : '',
    factors: { fit: factor('fit'), demand: factor('demand'), win, value: factor('value'), gap: factor('gap'), stageW: stage in KI_STAGE_WEIGHT ? KI_STAGE_WEIGHT[stage] : null },
    score: num(pick(o, 'score')),
    scoreLow: num(pick(o, 'score_low')),
    scoreHigh: num(pick(o, 'score_high')),
    lowConfidence: bool(pick(o, 'low_confidence')),
    // FX-L: `unknown` (Not judged yet) is a stored verdict too; a gated row is always "Not for you"
    verdict: gate === 'fail' ? 'gated' : (KI_VERDICT_IDS as readonly string[]).includes(verdictRaw) && verdictRaw !== 'gated' ? verdictRaw : kiVerdict({ gate, win }),
    clusterId: str(pick(o, 'cluster_id')),
    isHead: bool(pick(o, 'is_head')),
    clusterSize: num(pick(o, 'cluster_size')),
    clusterDemand: num(pick(o, 'cluster_demand')),
    pageAction: str(pick(o, 'page_action')),
    pageUrl: str(pick(o, 'page_url')),
    cannibal: Array.isArray(cannibal) ? cannibal.length > 1 : !!cannibal,
    competitors: kiJson<unknown[]>(pick(o, 'competitors') ?? pick(o, 'competitors_json'), []).filter(isObj).map((c) => ({ domain: str(c.domain), position: num(c.position) ?? 0, url: str(c.url) })),
    striking: bool(pick(o, 'striking')),
    fetchedAt: str(pick(o, 'fetched_at') || pick(o, 'updated_at')),
    brand: bool(pick(o, 'brand')),
    question: pick(o, 'question') == null ? null : bool(pick(o, 'question')),
  };
}

export interface KiKeywords {
  rows: KiKw[];
  total: number;
  page: number;
  pageSize: number;
  pages: number | null;
  plan: KiPlanAction[];
  questions: { key: string; question: string; sources: KiSource[] }[] | null;
}
export function kiKeywordsOf(raw: unknown): KiKeywords {
  const o = isObj(raw) ? raw : {};
  const rows = listOf(raw, 'rows', 'keywords', 'items').map(kiKwOf).filter((r) => r.keyword);
  const qs = Array.isArray(o.questions) ? (o.questions as unknown[]).filter(isObj).map((q) => ({ key: str(q.kw_key ?? q.key ?? q.question), question: str(q.question ?? q.keyword), sources: (Array.isArray(q.sources) ? q.sources : []).map(str) as KiSource[] })) : null;
  return {
    rows,
    total: num(o.total) ?? rows.length,
    page: num(o.page) ?? 1,
    pageSize: num(pick(o, 'page_size')) ?? (rows.length || 50),
    pages: num(o.pages),
    plan: planOf(o.plan),
    questions: qs,
  };
}

/** The filters of the Keyword research page (sent to the server, which pages the table; the same rules hold the shown page). */
export interface KiKwFilter {
  stage: '' | KiStage;
  verdict: '' | KiVerdict;
  source: '' | KiSource;
  cluster: string;
  minVolume: string;
  gapType: '' | KiGapType;
  brand: '' | 'brand' | 'non_brand';
  /** only the searches just off page one (the "See all" of that section) */
  striking: boolean;
  sort: 'score' | 'volume' | 'keyword';
  page: number;
}
export const KI_KW_FILTER_EMPTY: KiKwFilter = { stage: '', verdict: '', source: '', cluster: '', minVolume: '', gapType: '', brand: '', striking: false, sort: 'score', page: 1 };
export const KI_PAGE_SIZE = 50;
/** review UX N9 (pass 2): a phone gets 20 search cards a page, not 50 */
export const KI_PAGE_SIZE_PHONE = 20;

/** The query string the keywords route takes (CONTRACTS.md §7); empty filters are left out. */
export function kiKwParams(f: KiKwFilter, pageSize: number = KI_PAGE_SIZE): Record<string, string> {
  // A1_ROUTES: a '-' in front sorts descending (best score and most searched first; names A to Z)
  const p: Record<string, string> = { sort: f.sort === 'keyword' ? 'keyword' : `-${f.sort}`, page: String(f.page), page_size: String(pageSize) };
  if (f.stage) p.stage = f.stage;
  if (f.verdict) p.verdict = f.verdict;
  if (f.source) p.source = f.source;
  if (f.cluster) p.cluster = f.cluster;
  if (f.minVolume) p.min_volume = f.minVolume;
  if (f.brand) p.brand = f.brand;
  // FX-A (review UX H2): filtered on the server like every other filter, so the count, the pager and the empty state agree
  if (f.gapType) p.gap_type = f.gapType;
  if (f.striking) p.striking = '1';
  return p;
}
export const kiActiveFilters = (f: KiKwFilter): number => (['stage', 'verdict', 'source', 'cluster', 'minVolume', 'gapType', 'brand', 'striking'] as const).filter((k) => !!f[k]).length;

/** The groups (one head each), by score; members counted from the rows or the stored group size. */
export function kiClustersOf(rows: readonly KiKw[]) {
  const members = new Map<string, number>();
  for (const r of rows) if (r.clusterId) members.set(r.clusterId, (members.get(r.clusterId) ?? 0) + 1);
  return rows
    .filter((r) => r.isHead || !r.clusterId)
    .map((r) => ({ head: r, members: Math.max(r.clusterSize ?? 0, members.get(r.clusterId) ?? 1) }))
    .sort((a, b) => (b.head.score ?? -1) - (a.head.score ?? -1) || a.head.keyword.localeCompare(b.head.keyword));
}

/**
 * Searches you already show up for just off the first page. FX-A (review CONSISTENCY M2): ONE definition, the engine's (shared KI_STRIKING),
 * read from the row's `striking` flag only (no second rule here), on searches that fit the business (the server's kiQuickWin).
 */
export const kiStrikingOf = (rows: readonly KiKw[]) =>
  rows.filter((r) => r.striking && r.gate === 'pass').sort((a, b) => (b.gscImpressions ?? 0) - (a.gscImpressions ?? 0)).slice(0, 30);

const QUESTION = /^(how|what|why|which|who|when|where|is|are|can|do|does|should|will)\b|\?$/i;
/** Buyer questions: the server's list when it sends one, else the questions among the rows (people also ask, autocomplete, your searches). */
export function kiQuestionsOf(rows: readonly KiKw[], explicit: KiKeywords['questions']): { key: string; question: string; sources: KiSource[] }[] {
  // review UX L3: a question reads as one (first letter upper case, a question mark), as the AI panel will store it
  if (explicit?.length) return explicit.slice(0, 30).map((q) => ({ ...q, question: kiQuestionText(q.question) }));
  return rows
    .filter((r) => r.gate === 'pass' && (r.question ?? (QUESTION.test(r.keyword.trim()) && r.sources.some((s) => s.source === 'paa' || s.source === 'autocomplete' || s.source === 'gsc' || s.source === 'forum'))))
    .slice(0, 30)
    .map((r) => ({ key: r.key, question: kiQuestionText(r.keyword), sources: [...new Set(r.sources.map((s) => s.source))] }));
}

// ------------------------------------------------------------------------------------------------------------------------------
// gaps
// ------------------------------------------------------------------------------------------------------------------------------

export interface KiGap {
  id: string;
  type: KiGapType;
  keyword: string;
  kwKey: string;
  competitors: string[];
  clientPosition: number | null;
  sampleNote: string;
  action: string;
  target: string;
  credits: number | null;
  status: KiGapStatus;
}
export function kiGapsOf(raw: unknown): KiGap[] {
  return listOf(raw, 'rows', 'gaps', 'items').map((o) => ({
    id: str(pick(o, 'gap_id') || pick(o, 'id')),
    type: str(pick(o, 'type')) as KiGapType,
    keyword: str(pick(o, 'keyword')),
    kwKey: str(pick(o, 'kw_key') || pick(o, 'keyword')).toLowerCase(),
    competitors: kiJson<unknown[]>(pick(o, 'competitor_domains') ?? pick(o, 'competitor_domains_json'), []).map(str).filter(Boolean),
    clientPosition: num(pick(o, 'client_position')),
    sampleNote: str(pick(o, 'sample_note')),
    action: str(pick(o, 'action')),
    target: str(pick(o, 'action_target')),
    credits: num(pick(o, 'credits')),
    status: (str(pick(o, 'status')) || 'open') as KiGapStatus,
  })).filter((g) => g.id);
}
export function kiGapTypesByKey(gaps: readonly KiGap[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const g of gaps) if (g.kwKey) m.set(g.kwKey, [...(m.get(g.kwKey) ?? []), g.type]);
  return m;
}

/** The gap types in the client's words, and what to do about each. */
export const KI_GAP_LABELS: Record<KiGapType, { label: string; what: string }> = {
  missing: { label: 'Competitors rank, you are missing', what: 'Two or more of your competitors are on page one and you are not in the first 100 results.' },
  untapped: { label: 'One competitor ranks, you are missing', what: 'One of your competitors is on page one and you are not in the first 100 results.' },
  weak: { label: 'You rank low', what: 'You are in the results but below page one, and a competitor is on page one.' },
  striking: { label: 'Just off page one', what: 'You are close to page one. A better page can move you up.' },
  strong: { label: 'You lead: keep it', what: 'You are ahead here. Keep the page fresh so it stays that way.' },
  topic: { label: 'A topic you do not cover', what: 'Competitors have pages on this topic and you have none.' },
  page_type: { label: 'A kind of page you do not have', what: 'Competitors have a page of this kind for the service (prices, comparison, city, industry, case study) and you do not.' },
  ai_answer: { label: 'Named in AI answers, you are not', what: 'AI answers name a competitor for this and not you.' },
  listing: { label: 'A list or directory to join', what: 'A directory or ranking list shows your competitors and not you.' },
  backlink: { label: 'Websites that link to them, not you', what: 'Websites that link to your competitors and could link to you.' },
};
export const KI_GAP_ACTION_LABELS: Record<string, string> = {
  new_page: 'Write a new page',
  refresh: 'Improve your page',
  list: 'Get listed',
  pitch: 'Ask to be added',
  link: 'Ask for a link',
  defend: 'Keep it fresh',
  ladder: 'Plan a keyword ladder',
  write: 'Write the page',
};

// ------------------------------------------------------------------------------------------------------------------------------
// words and labels
// ------------------------------------------------------------------------------------------------------------------------------

/** "measured, 2 Nov 2026" / "estimate from Google Ads, 2 Nov 2026": every number says how it was found and when. */
export function kiBasisLine(basis: unknown, source?: unknown, at?: string | null): string {
  const b = kiBasisLabel(basis, source);
  const d = at ? fmtDate(at) : '';
  return d && d !== '-' ? `${b}, ${d}` : b;
}

/** "AE-en" (the engine's market key) as the country's name; a name already in words stays as it is. */
export function kiMarketName(m: string | null | undefined): string {
  const v = String(m ?? '').trim();
  const iso = /^([A-Z]{2})(?:-[a-z]{2,3})?$/.exec(v)?.[1];
  if (!iso) return v;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) ?? v;
  } catch {
    return v;
  }
}

/** A section of a run in the client's words (the engine's keys never reach a screen). */
const SECTION_WORDS: Record<string, string> = {
  serp: 'Google results for your services',
  serps: 'Google results for your services',
  results: 'Google results for your services',
  overlap: 'the comparison of the searches you and others rank for',
  ai: 'the AI answers',
  classify: 'sorting the websites by type',
  profiles: 'the competitor profiles',
  profile: 'the competitor profiles',
  discover: 'collecting searches',
  sources: 'collecting searches',
  enrich: 'search volumes',
  volume: 'search volumes',
  cluster: 'grouping the searches',
  clusters: 'grouping the searches',
  gaps: 'the gaps against your competitors',
  questions: 'buyer questions',
  plan: 'the plan',
  gsc: 'your Search Console searches',
  backlinks: 'the websites that link to your competitors',
};
export const kiSectionWords = (key: string): string => SECTION_WORDS[key.toLowerCase()] ?? SECTION_WORDS[key.toLowerCase().replace(/_.*/, '')] ?? 'one part of the reading';

/** A partial run in calm words (null when nothing is missing). */
export function kiPartialNote(run: KiRunInfo | undefined): string | null {
  if (!run) return null;
  const miss = run.sections.filter((s) => s.state === 'missing' || s.state === 'partial');
  if (!miss.length && run.status !== 'partial') return null;
  const parts = [...new Set(miss.map((s) => kiSectionWords(s.key)))];
  // review UX L8: "search volumes and your Search Console searches", "a, b and c"
  const what = parts.length ? kiAnd(parts) : 'part of the reading';
  return `We could not read ${what} this time. Everything else is shown, and the next run tries again. You were only charged for what was read.`;
}
/** "a", "a and b", "a, b and c" */
export const kiAnd = (parts: readonly string[]): string => (parts.length <= 1 ? parts[0] ?? '' : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

/**
 * FX-A (review UX H3): the last run did not deliver (refused at the start, or failed). A calm note with what happened, what to do, and never
 * the first-run empty state (the owner would only run the same refused run again). `market` is the country the website is measured in.
 */
export interface KiStopNote {
  title: string;
  text: string;
  /** the one action that fixes it */
  action: { label: string; to: 'settings' | 'run' | 'credits' } | null;
}
export function kiStopNote(run: KiRunInfo | undefined, ctx: { siteCountry?: string | null } = {}): KiStopNote | null {
  if (!run || (run.status !== 'refused' && run.status !== 'failed')) return null;
  const why = run.reason.trim().toLowerCase();
  if (kiOutOfCredits(run)) return null;   // said by its own note, with "Open Credits"
  if (why === 'market_mismatch' || /market|country/.test(why)) {
    const country = (ctx.siteCountry || kiMarketName(run.market) || '').trim();
    return {
      title: 'The last run did not start: it asked for another country',
      // review UX N5 (pass 2): the fix first; changing the website's own country is the secondary link
      text: `This analysis runs for your website's country, ${country || 'its main country'}. Run it again for ${country || 'that country'}. Nothing was charged.`,
      action: { label: country ? `Run it for ${country}` : 'Run it again', to: 'run' },
    };
  }
  if (why === 'killed' || /paus/.test(why)) return { title: 'The last run did not start: paused for maintenance', text: 'New runs are paused for a short while. Please try again later. Nothing was charged.', action: null };
  if (why === 'ki_off' || why === 'not_available_yet') return { title: 'The last run did not start', text: 'This analysis is not switched on for this website yet. Nothing was charged.', action: null };
  if (run.status === 'refused') return { title: 'The last run did not start', text: 'Something stopped it before it began. Nothing was charged. You can run it again.', action: { label: 'Run it again', to: 'run' } };
  return { title: 'The last run could not finish', text: 'Nothing was charged for it. What you see below is from the run before it, if there was one. You can run it again.', action: { label: 'Run it again', to: 'run' } };
}

/** The last run is recent (under 7 days): the paid re-run is not the page's main button (review UX M3). */
export function kiRecentRun(run: KiRunInfo | undefined, now = Date.now()): boolean {
  const at = Date.parse(run?.finishedAt ?? run?.startedAt ?? '');
  return Number.isFinite(at) && now - at < 7 * 864e5 && (run?.status === 'ok' || run?.status === 'partial');
}
/** "Updated today" / "Updated 3 days ago" */
export function kiUpdatedWords(run: KiRunInfo | undefined, now = Date.now()): string | null {
  const at = Date.parse(run?.finishedAt ?? run?.startedAt ?? '');
  if (!Number.isFinite(at)) return null;
  const days = Math.floor((now - at) / 864e5);
  return days <= 0 ? 'Updated today' : days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`;
}

/**
 * FX-A (review UX H4): every next step can be done now. Until the plan's own Start ships, a step opens the EXISTING tool or page with the
 * search filled in: write a page, improve a page, plan a keyword ladder, get listed (Link building's listings), get named (AI visibility),
 * ask for links (Link building). Null when nothing fits (the row then shows no button, never a dead one).
 */
export type KiActionLink =
  | { label: string; kind: 'tool'; mode: 'keyword'; prefill: Record<string, unknown> }
  | { label: string; kind: 'ladder'; keyword: string }
  | { label: string; kind: 'page'; page: 'links' | 'ai' | 'backlinks'; hash?: string };
export function kiActionLink(kind: string, o: { keyword?: string | null; target?: string | null; domain?: string | null }): KiActionLink | null {
  const target = str(o.target).trim();
  const isUrl = /^https?:\/\//i.test(target) || (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(target));
  const keyword = (str(o.keyword).trim() || (!isUrl ? target : '')).slice(0, 120);
  // a page of this website only (the keyword form refuses any other host); hosts compared without www, no URL constructor needed
  const host = (/^(?:https?:\/\/)?([^/?#]+)/i.exec(target)?.[1] ?? '').toLowerCase().replace(/^www\./, '');
  const ownUrl = isUrl && o.domain && host === String(o.domain).toLowerCase().replace(/^www\./, '') ? (/^https?:/i.test(target) ? target : `https://${target}`) : '';
  switch (kind) {
    case 'new_page':
    case 'write':
      return keyword ? { label: 'Write this page', kind: 'tool', mode: 'keyword', prefill: { keyword } } : null;
    case 'refresh':
    case 'defend':
      return keyword || ownUrl ? { label: kind === 'defend' ? 'Refresh this page' : 'Improve this page', kind: 'tool', mode: 'keyword', prefill: { ...(keyword ? { keyword } : {}), ...(ownUrl ? { existingPageUrl: ownUrl } : {}) } } : null;
    case 'ladder':
      return keyword ? { label: 'Plan the ladder', kind: 'ladder', keyword } : null;
    case 'list':
      return { label: 'How to get listed', kind: 'page', page: 'links', hash: 'listings' };
    case 'pitch':
      return { label: 'How to get named', kind: 'page', page: 'ai' };
    case 'link':
      return { label: 'Find websites to ask', kind: 'page', page: 'links' };
    default:
      return null;
  }
}

/** The last run stopped because the company had no credits left. */
export const kiOutOfCredits = (run: KiRunInfo | undefined) => !!run && /credit|balance|budget/i.test(run.reason) && run.status !== 'ok';

/** A KI tool is offered only for a website whose KI pages this person may see (W0's `hidden` flag stays for every other screen). */
export const kiModeOffered = (mode: ModeId, kiVisible: boolean): boolean => !MODES[mode].hidden || (isKiRunMode(mode) && kiVisible);

/** What each factor of the score means, in one line (shown on hover or tap). */
export const KI_FACTOR_WORDS = {
  fit: 'Fits what you sell',
  stageW: 'Ready to buy',
  demand: 'People searching it',
  win: 'Your chance to rank',
  value: 'Worth of a visitor',
  gap: 'Proof it sells (competitors rank)',
} as const;
/** One factor (0 to 1) as a word (review UX H1: "Fits what you sell: high"). */
export const kiFactorLevel = (v: number): string => (v >= 0.67 ? 'high' : v >= 0.34 ? 'medium' : 'low');

/** "43, likely 35 to 51" */
export function kiScoreText(score: number | null, low: number | null, high: number | null): string {
  if (score == null) return '-';
  const s = Math.round(score);
  return low != null && high != null && Math.round(low) !== Math.round(high) ? `${s}, likely ${Math.round(low)} to ${Math.round(high)}` : String(s);
}

/** The CSV the server builds for a list, with the filter set on the page (same-origin GET with the session cookie). */
export function kiCsvUrl(orgId: string, siteId: string, kind: 'competitors' | 'keywords' | 'gaps', params: Record<string, string> = {}): string {
  const q = new URLSearchParams(Object.entries(params).filter(([k, v]) => v !== '' && k !== 'page' && k !== 'page_size'));
  const s = q.toString();
  return `/api/orgs/${orgId}/sites/${siteId}/ki/${kind}.csv${s ? `?${s}` : ''}`;
}

/** Whether the Start button of a plan action or gap can work yet (the start route answers 501 until the pipeline step ships). */
export const kiStartSoon = (e: unknown) => e instanceof ApiRequestError && (e.status === 501 || e.status === 404);
