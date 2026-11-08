// KI app API (A1, 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §7, fixes/A1_ROUTES.md): the response shapes of the keyword-intelligence
// routes and the pure readers behind them (row -> view, filter / sort / page, brand split, CSV lines). The server reads the engine's four KI tables
// (shared/src/ki.ts row types) and answers with these camelCase views; the web pages (A2) code against them. Nothing here reads the network.

import {
  KI_CLASSES,
  KI_GAP_STATUSES,
  KI_GAP_TYPES,
  KI_SIZE_LABELS,
  KI_SOURCE_LABELS,
  KI_STAGES,
  KI_VERDICTS,
  KI_VERDICT_IDS,
  KI_VERDICT_TONE,
  kiBasisLabel,
  kiGateCodeOf,
  kiGateWords,
  kiSourceWords as kiSourceWordsOf,
  type KiGateCode,
  kiVerdict,
  type KiBasis,
  type KiClass,
  type KiCompetitorProfile,
  type KiCompetitorRow,
  type KiCompStatus,
  type KiEvidence,
  type KiGapAction,
  type KiGapRow,
  type KiGapStatus,
  type KiGapType,
  type KiIntent,
  type KiKeywordRow,
  type KiMode,
  type KiPageAction,
  type KiRunMode,
  type KiRunRow,
  type KiRunStatus,
  type KiSectionStateRow,
  type KiSizeTag,
  type KiSource,
  type KiStage,
  type KiTone,
  type KiVerdict,
  KI_STAGE_IDS,
  KI_SOURCES,
} from './ki';
import { csvCell } from './identity';

// ---------------------------------------------------------------------------------------------------------------------------
// the guides the KI asks point to (A2 writes their content in guides.ts; the ids are agreed here)
// ---------------------------------------------------------------------------------------------------------------------------

export const KI_GUIDE_IDS = {
  chooseCompetitors: 'ki-choose-competitors',
  readResearch: 'ki-read-keyword-research',
  verdicts: 'ki-verdicts',
} as const;
export type KiGuideId = (typeof KI_GUIDE_IDS)[keyof typeof KI_GUIDE_IDS];

/** Recommendation ids the server builds for an On website (services/ki.ts kiRecommendations) and the guide each one opens. */
export const KI_RECOMMENDATION_GUIDES: Record<string, KiGuideId> = {
  'ki:competitors': KI_GUIDE_IDS.chooseCompetitors,
  'ki:quick-wins': KI_GUIDE_IDS.readResearch,
};
/** The Needs-you items (kind `ki`) and their guides. */
export const KI_NEEDS_YOU_GUIDES: Record<string, KiGuideId> = {
  'ki:competitors': KI_GUIDE_IDS.chooseCompetitors,
  'ki:quick-wins': KI_GUIDE_IDS.readResearch,
};

// ---------------------------------------------------------------------------------------------------------------------------
// limits
// ---------------------------------------------------------------------------------------------------------------------------

/** Page sizes of the keyword and gap lists: default 50, never above 200 (owner's performance rule, 2026-11-08). */
export const KI_PAGE_SIZE = { default: 50, max: 200 } as const;
/** At most this many questions approved into the AI panel in one request. */
export const KI_APPROVE_MAX = 30;
/** The status a person may give a competitor (CONTRACTS §5) and a gap. */
export const KI_COMP_USER_STATUSES = ['chosen', 'watch', 'dismissed'] as const;
export type KiCompUserStatus = (typeof KI_COMP_USER_STATUSES)[number];
export const KI_GAP_USER_STATUSES = KI_GAP_STATUSES;

// ---------------------------------------------------------------------------------------------------------------------------
// response shapes (camelCase, as every app route answers)
// ---------------------------------------------------------------------------------------------------------------------------

export interface KiRunView {
  runId: string;
  kind: KiRunMode;
  market: string;
  mode: Exclude<KiMode, 'off'>;
  status: KiRunStatus;
  /** the engine's reason code (refused / failed / partial), '' when none */
  reason: string;
  startedAt: string;
  finishedAt: string | null;
  sections: KiSectionStateRow[];
  /** sections that could not be read (state `missing` or `partial`): what a partial run says honestly */
  missingSections: string[];
  counts: Record<string, number>;
}

export interface KiSummary {
  market: string | null;
  competitors: { total: number; chosen: number; watch: number; candidates: number; dismissed: number; listings: number; platforms: number;
    /** the person chose or dismissed at least one: the set is confirmed */
    confirmed: boolean };
  keywords: { total: number; byVerdict: Record<KiVerdict, number>;
    /** FX-A (review UX L11 / M8): the topics (heads) by verdict, so the hero counts topics over every row, not the 200 read */
    headsByVerdict: Record<KiVerdict, number>;
    byStage: Partial<Record<KiStage, number>>; striking: number; quickWins: number;
    questions: number; clusters: number; needsReview: number; brand: number };
  gaps: { open: number; byType: Partial<Record<KiGapType, number>> };
  /** newest fetched_at / updated_at over the rows */
  fetchedAt: string | null;
}

/** GET /api/orgs/:orgId/sites/:siteId/ki: one request per page view (the hero's counts included). */
export interface KiOverview {
  /** what this person is shown: a platform admin the stored mode; anyone else `on` or `off` (a Trial reads as Off) */
  mode: KiMode;
  /** On, or Trial and a platform admin, and not paused by the kill switch */
  visible: boolean;
  /** the kill switch is on (every KI read behaves as Off; the pages say "paused"): sent to platform admins and on an On website */
  killed?: boolean;
  /** platform admins may switch the mode (PATCH .../ki/mode) */
  canSwitch: boolean;
  /** this person may start a run and change statuses (member or above, website visible) */
  canAct: boolean;
  maxCompetitors: number;
  /** credits a run is quoted at, before it starts */
  credits: { competitors: number; research: number };
  /** the newest run of each kind first; [] when not visible */
  lastRuns: KiRunView[];
  /** null when not visible */
  summary: KiSummary | null;
}

export interface KiCompetitorView {
  compDomain: string;
  market: string;
  class: KiClass;
  classLabel: string;
  classBasis: KiCompetitorRow['class_basis'];
  classConfidence: number | null;
  scored: boolean;
  score: number | null;
  scoreLow: number | null;
  scoreHigh: number | null;
  serpShare: number | null;
  topicSim: number | null;
  geoMatch: number | null;
  aiShare: number | null;
  sizeTag: KiSizeTag;
  sizeLabel: string;
  seedsSeen: number | null;
  seedsTotal: number | null;
  reasons: string[];
  evidence: KiEvidence[];
  declared: boolean;
  status: KiCompStatus;
  statusBy: KiCompetitorRow['status_by'];
  firstSeen: string;
  lastSeen: string;
  misses: number;
  profile: KiCompetitorProfile | null;
  /** the row's last update (the engine's updated_at) */
  fetchedAt: string;
  /** `rule` / `page` / `declared` / `user` = measured on the results pages; `llm` = a model's reading (none is used today) */
  basis: KiBasis;
  basisLabel: string;
}

export interface KiCompetitorsResponse {
  market: string | null;
  maxCompetitors: number;
  chosen: number;
  /** chosen first, then by score; listings and platforms are rows with their class (filter on `class`) */
  items: KiCompetitorView[];
}

export interface KiKeywordView {
  keyword: string;
  kwKey: string;
  market: string;
  sources: { source: KiSource; label: string; fetchedAt: string }[];
  sourceCount: number;
  volume: number | null;
  volumeBasis: KiBasis | null;
  volumeBasisLabel: string;
  volumeSource: string | null;
  cpc: number | null;
  kd: number | null;
  gsc: { impressions: number | null; clicks: number | null; position: number | null; page: string | null } | null;
  intent: KiIntent | null;
  stage: KiStage | null;
  stageLabel: string | null;
  needsReview: boolean;
  gate: 'pass' | 'fail';
  /** why it is "Not for you", in plain words (FX-A: never the engine's sentence or detail) */
  gateReason: string | null;
  /** the reason's code (ki_parity.json gate_reasons), null when not known */
  gateCode: KiGateCode | null;
  verdict: KiVerdict;
  verdictLabel: string;
  verdictTone: KiTone;
  score: number | null;
  scoreLow: number | null;
  scoreHigh: number | null;
  lowConfidence: boolean;
  factors: { fit: number | null; demand: number | null; win: number | null; value: number | null; gap: number | null };
  clusterId: string | null;
  isHead: boolean;
  clusterSize: number | null;
  clusterDemand: number | null;
  pageAction: KiPageAction | null;
  pageUrl: string | null;
  competitors: { domain: string; position: number; url: string }[];
  striking: boolean;
  /** names the website's brand (its brand names or its domain's name) */
  brand: boolean;
  /** a buyer question (can be approved into the AI question panel) */
  question: boolean;
  serpReadAt: string | null;
  fetchedAt: string;
  /** only with `include=serp`: the top 10 results read */
  top10?: { url: string; host: string; type: string; pos: number }[];
}

/** The gap types a keyword row can carry (the others are about pages, lists, AI answers and links, not one search). */
export const KI_KEYWORD_GAP_TYPES = ['missing', 'untapped', 'weak', 'striking', 'strong'] as const;
export type KiKeywordGapType = (typeof KI_KEYWORD_GAP_TYPES)[number];
/** The key a gap row and a keyword row share: the keyword, lower case, punctuation and spaces folded (the engine stores both normalised). */
export const kiGapKeyOf = (keyword: unknown): string =>
  String(keyword ?? '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();

export type KiKeywordSort = 'score' | 'volume' | 'keyword' | 'position' | 'demand' | 'kd' | 'fetched';
export const KI_KEYWORD_SORTS: readonly KiKeywordSort[] = ['score', 'volume', 'keyword', 'position', 'demand', 'kd', 'fetched'];

export interface KiKeywordQuery {
  /** FX-A (review UX H2): a keyword gap type, filtered on the server against the current gap rows, so counts, pager and empty state agree */
  gapType?: KiKeywordGapType;
  stage?: KiStage;
  verdict?: KiVerdict;
  source?: KiSource;
  cluster?: string;
  minVolume?: number;
  brand?: 'brand' | 'non_brand';
  q?: string;
  striking?: boolean;
  heads?: boolean;
  questions?: boolean;
  market?: string;
  /** a sort key, `-` in front = descending (default `-score`) */
  sort: string;
  page: number;
  pageSize: number;
  includeSerp: boolean;
}

export interface KiKeywordsResponse {
  market: string | null;
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  sort: string;
  items: KiKeywordView[];
  /** counts over every row of the market (before the filters), for the filter chips */
  facets: { verdict: Record<KiVerdict, number>; stage: Partial<Record<KiStage, number>>; source: Partial<Record<KiSource, number>> };
}

export interface KiGapView {
  gapId: string;
  market: string;
  type: KiGapType;
  keyword: string | null;
  clusterId: string | null;
  competitorDomains: string[];
  clientPosition: number | null;
  evidence: unknown;
  sampleNote: string | null;
  action: KiGapAction;
  actionTarget: string | null;
  credits: number | null;
  status: KiGapStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KiGapsResponse {
  market: string | null;
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  items: KiGapView[];
  byType: Partial<Record<KiGapType, number>>;
  byStatus: Partial<Record<KiGapStatus, number>>;
}

export interface KiQuestionsApproveResult {
  added: { kwKey: string; question: string }[];
  skipped: { kwKey: string; reason: 'not_found' | 'not_a_question' | 'gated' | 'already_on_panel' | 'panel_full' | 'duplicate' }[];
  /** the panel's size (questions asked each week) and how many of the owner's own are on it after this */
  panelSize: number;
  ownOnPanel: number;
}

// ---------------------------------------------------------------------------------------------------------------------------
// readers
// ---------------------------------------------------------------------------------------------------------------------------

const S = (v: unknown): string => (v == null ? '' : String(v).trim());
const N = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const B = (v: unknown): boolean => v === true || /^(true|1|yes)$/i.test(S(v));
/** A JSON column (string) or an already parsed value; a broken one reads as `fallback`. */
export function kiJson<T>(v: unknown, fallback: T): T {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v as T;
  try {
    const p = JSON.parse(v) as unknown;
    return (p ?? fallback) as T;
  } catch {
    return fallback;
  }
}
const arrOf = <T>(v: unknown): T[] => {
  const a = kiJson<unknown>(v, []);
  return Array.isArray(a) ? (a as T[]) : [];
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (allowed.includes(S(v) as T) ? (S(v) as T) : dflt);

const COMP_STATUSES: readonly KiCompStatus[] = ['candidate', 'chosen', 'watch', 'dismissed'];
const CLASS_IDS = Object.keys(KI_CLASSES) as KiClass[];
const SIZE_IDS = Object.keys(KI_SIZE_LABELS) as KiSizeTag[];

export function kiCompetitorView(r: KiCompetitorRow): KiCompetitorView {
  const cls = pick(r.class, CLASS_IDS, 'direct');
  const size = pick(r.size_tag, SIZE_IDS, 'unknown');
  const classBasis = pick(r.class_basis, ['rule', 'page', 'llm', 'declared', 'user'] as const, 'rule');
  const basis: KiBasis = classBasis === 'llm' ? 'inferred' : 'measured';
  return {
    compDomain: S(r.comp_domain).toLowerCase(),
    market: S(r.market),
    class: cls,
    classLabel: KI_CLASSES[cls],
    classBasis,
    classConfidence: N(r.class_confidence),
    scored: B(r.scored),
    score: N(r.score),
    scoreLow: N(r.score_low),
    scoreHigh: N(r.score_high),
    serpShare: N(r.serp_share),
    topicSim: N(r.topic_sim),
    geoMatch: N(r.geo_match),
    aiShare: N(r.ai_share),
    sizeTag: size,
    sizeLabel: KI_SIZE_LABELS[size],
    seedsSeen: N(r.seeds_seen),
    seedsTotal: N(r.seeds_total),
    reasons: arrOf<unknown>(r.reasons_json).map((x) => S(x)).filter(Boolean),
    evidence: arrOf<KiEvidence>(r.evidence_json).slice(0, 20),
    declared: B(r.declared),
    status: pick(r.status, COMP_STATUSES, 'candidate'),
    statusBy: pick(r.status_by, ['auto', 'user', 'declared'] as const, 'auto'),
    firstSeen: S(r.first_seen),
    lastSeen: S(r.last_seen),
    misses: N(r.misses) ?? 0,
    profile: kiJson<KiCompetitorProfile | null>(r.profile_json, null),
    fetchedAt: S(r.updated_at) || S(r.last_seen),
    basis,
    basisLabel: kiBasisLabel(basis),
  };
}

const COMP_STATUS_RANK: Record<KiCompStatus, number> = { chosen: 0, watch: 1, candidate: 2, dismissed: 3 };
export const kiCompetitorOrder = (a: KiCompetitorView, b: KiCompetitorView): number =>
  COMP_STATUS_RANK[a.status] - COMP_STATUS_RANK[b.status] || (b.score ?? -1) - (a.score ?? -1) || a.compDomain.localeCompare(b.compDomain);

const QUESTION_RE = /^(how|what|which|who|why|when|where|is|are|can|does|do|should|will|best way|cost of)\b|\?\s*$/i;
/** A buyer question (People also ask, a forum thread, or a keyword phrased as a question). */
export function kiIsQuestion(keyword: string, sources: readonly string[] = []): boolean {
  const k = S(keyword);
  if (k.length < 10) return false;
  return QUESTION_RE.test(k) || (sources.includes('paa') && /\s/.test(k));
}
/** The question as the AI panel stores it: first letter upper case, one question mark. */
export function kiQuestionText(keyword: string): string {
  const k = S(keyword).replace(/\s+/g, ' ').replace(/\?+\s*$/, '');
  return k ? k.charAt(0).toUpperCase() + k.slice(1) + '?' : '';
}

/** The website's brand words: its brand names and its domain's name (at least 4 letters), lower case, spaces removed. */
export function kiBrandTokens(domain: string, brandNames: readonly string[] | null | undefined = []): string[] {
  const label = S(domain).toLowerCase().replace(/^www\./, '').split('.')[0] ?? '';
  const out = new Set<string>();
  for (const b of [label, ...(brandNames ?? [])]) {
    const t = S(b).toLowerCase().replace(/[^a-z0-9À-￿]+/g, '');
    if (t.length >= 4) out.add(t);
  }
  return [...out];
}
export function kiIsBrand(keyword: string, tokens: readonly string[]): boolean {
  if (!tokens.length) return false;
  const k = S(keyword).toLowerCase().replace(/[^a-z0-9À-￿]+/g, '');
  return tokens.some((t) => k.includes(t));
}

export function kiKeywordView(r: KiKeywordRow, brandTokens: readonly string[], includeSerp = false): KiKeywordView {
  const stage = KI_STAGE_IDS.includes(S(r.stage) as KiStage) ? (S(r.stage) as KiStage) : null;
  const sources = arrOf<{ source?: unknown; fetched_at?: unknown }>(r.sources_json)
    .map((x) => ({ source: S(x?.source) as KiSource, fetchedAt: S(x?.fetched_at) }))
    .filter((x) => (KI_SOURCES as readonly string[]).includes(x.source))
    .map((x) => ({ ...x, label: KI_SOURCE_LABELS[x.source] }));
  const gate = S(r.gate) === 'fail' ? 'fail' : 'pass';
  // the stored verdict, unless the row's gate says otherwise (a failed gate is always "Not for you"); an unknown word is read from Win
  const stored = S(r.verdict) as KiVerdict;
  const verdict: KiVerdict = gate === 'fail' ? 'gated' : KI_VERDICT_IDS.includes(stored) && stored !== 'gated' ? stored : kiVerdict({ gate, win: N(r.win) });
  const volumeBasis = (['measured', 'provider_estimate', 'modelled', 'inferred'] as const).includes(S(r.volume_basis) as KiBasis) ? (S(r.volume_basis) as KiBasis) : null;
  const gscAny = r.gsc_impressions != null || r.gsc_clicks != null || r.gsc_position != null || !!S(r.gsc_page);
  const keyword = S(r.keyword);
  const v: KiKeywordView = {
    keyword,
    kwKey: S(r.kw_key),
    market: S(r.market),
    sources,
    sourceCount: N(r.source_count) ?? sources.length,
    volume: N(r.volume),
    volumeBasis,
    volumeBasisLabel: volumeBasis ? kiBasisLabel(volumeBasis, r.volume_source) : 'not available',
    volumeSource: S(r.volume_source) || null,
    cpc: N(r.cpc),
    kd: N(r.kd),
    gsc: gscAny ? { impressions: N(r.gsc_impressions), clicks: N(r.gsc_clicks), position: N(r.gsc_position), page: S(r.gsc_page) || null } : null,
    intent: (['commercial', 'transactional', 'informational', 'navigational'] as const).includes(S(r.intent) as KiIntent) ? (S(r.intent) as KiIntent) : null,
    stage,
    stageLabel: stage ? KI_STAGES[stage] : null,
    needsReview: B(r.needs_review),
    gate,
    // FX-L: gate_reason holds the code, gate_detail the engine's sentence (never shown; read only to find a code on an older row)
    gateReason: gate === 'fail' ? kiGateWords(r.gate_detail, r.gate_reason) : null,
    gateCode: gate === 'fail' ? kiGateCodeOf(r.gate_detail, r.gate_reason) : null,
    verdict,
    verdictLabel: KI_VERDICTS[verdict],
    verdictTone: KI_VERDICT_TONE[verdict],
    score: N(r.score),
    scoreLow: N(r.score_low),
    scoreHigh: N(r.score_high),
    lowConfidence: B(r.low_confidence),
    factors: { fit: N(r.fit), demand: N(r.demand), win: N(r.win), value: N(r.value), gap: N(r.gap) },
    clusterId: S(r.cluster_id) || null,
    isHead: B(r.is_head),
    clusterSize: N(r.cluster_size),
    clusterDemand: N(r.cluster_demand),
    pageAction: (['new', 'refresh', 'list', 'none'] as const).includes(S(r.page_action) as KiPageAction) ? (S(r.page_action) as KiPageAction) : null,
    pageUrl: S(r.page_url) || null,
    competitors: arrOf<{ domain?: unknown; position?: unknown; url?: unknown }>(r.competitors_json).map((c) => ({ domain: S(c?.domain), position: N(c?.position) ?? 0, url: S(c?.url) })).filter((c) => c.domain),
    striking: B(r.striking),
    brand: kiIsBrand(keyword, brandTokens),
    question: kiIsQuestion(keyword, sources.map((x) => x.source)),
    serpReadAt: S(r.serp_read_at) || null,
    fetchedAt: S(r.fetched_at) || S(r.updated_at),
  };
  if (includeSerp) v.top10 = arrOf<{ url?: unknown; host?: unknown; type?: unknown; pos?: unknown }>(r.top10_json).map((t) => ({ url: S(t?.url), host: S(t?.host), type: S(t?.type), pos: N(t?.pos) ?? 0 }));
  return v;
}

export function kiGapView(r: KiGapRow): KiGapView {
  return {
    gapId: S(r.gap_id),
    market: S(r.market),
    type: pick(r.type, KI_GAP_TYPES, 'missing'),
    keyword: S(r.keyword) || null,
    clusterId: S(r.cluster_id) || null,
    competitorDomains: arrOf<unknown>(r.competitor_domains_json).map((d) => S(d)).filter(Boolean),
    clientPosition: N(r.client_position),
    evidence: kiJson<unknown>(r.evidence_json, null),
    sampleNote: S(r.sample_note) || null,
    action: pick(r.action, ['new_page', 'refresh', 'list', 'pitch', 'link', 'defend'] as const, 'new_page'),
    actionTarget: S(r.action_target) || null,
    credits: N(r.credits),
    status: pick(r.status, KI_GAP_STATUSES, 'open'),
    createdAt: S(r.created_at),
    updatedAt: S(r.updated_at),
  };
}

export function kiRunView(r: KiRunRow): KiRunView {
  const sections = arrOf<Partial<KiSectionStateRow>>(r.sections_json).map((s) => ({
    key: S(s?.key),
    state: pick(s?.state, ['ok', 'partial', 'missing', 'skipped'] as const, 'missing'),
    reason: S(s?.reason),
    rows: N(s?.rows) ?? 0,
  }));
  const counts = kiJson<Record<string, unknown>>(r.counts_json, {});
  return {
    runId: S(r.run_id),
    kind: S(r.kind) === 'keyword_research' ? 'keyword_research' : 'competitors',
    market: S(r.market),
    mode: S(r.mode) === 'on' ? 'on' : 'trial',
    status: pick(r.status, ['ok', 'partial', 'failed', 'refused'] as const, 'failed'),
    reason: S(r.reason),
    startedAt: S(r.started_at),
    finishedAt: S(r.finished_at) || null,
    sections,
    missingSections: sections.filter((s) => s.state === 'missing' || s.state === 'partial').map((s) => s.key),
    counts: Object.fromEntries(Object.entries(counts && typeof counts === 'object' ? counts : {}).map(([k, v]) => [k, Number(v)]).filter(([, v]) => Number.isFinite(v as number))) as Record<string, number>,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the keyword query (parsed from the URL, then applied server side)
// ---------------------------------------------------------------------------------------------------------------------------

const MARKET_RE = /^[A-Z]{2}-[a-z]{2,3}$/;
export const kiMarketOf = (v: unknown): string | undefined => (MARKET_RE.test(S(v)) ? S(v) : undefined);

/** The keyword list's query from the URL; anything unknown is left out (never an error), the page size bounded at 200. */
export function kiKeywordQueryOf(q: Record<string, unknown>): KiKeywordQuery {
  const one = (k: string) => (Array.isArray(q[k]) ? (q[k] as unknown[])[0] : q[k]);
  const stage = S(one('stage'));
  const verdict = S(one('verdict'));
  const source = S(one('source'));
  const brand = S(one('brand'));
  const gapType = S(one('gap_type'));
  const sortRaw = S(one('sort')) || '-score';
  const sortKey = sortRaw.replace(/^-/, '') as KiKeywordSort;
  const minVolume = N(one('min_volume'));
  const bool = (k: string) => (/^(1|true|yes)$/i.test(S(one(k))) ? true : undefined);
  const page = Math.max(1, Math.floor(N(one('page')) ?? 1));
  const size = Math.floor(N(one('page_size')) ?? KI_PAGE_SIZE.default);
  return {
    ...((KI_KEYWORD_GAP_TYPES as readonly string[]).includes(gapType) ? { gapType: gapType as KiKeywordGapType } : {}),
    ...(KI_STAGE_IDS.includes(stage as KiStage) ? { stage: stage as KiStage } : {}),
    ...(KI_VERDICT_IDS.includes(verdict as KiVerdict) ? { verdict: verdict as KiVerdict } : {}),
    ...((KI_SOURCES as readonly string[]).includes(source) ? { source: source as KiSource } : {}),
    ...(S(one('cluster')) && S(one('cluster')).length <= 120 ? { cluster: S(one('cluster')) } : {}),
    ...(minVolume != null && minVolume > 0 ? { minVolume } : {}),
    ...(brand === 'brand' || brand === 'non_brand' ? { brand } : {}),
    ...(S(one('q')) ? { q: S(one('q')).slice(0, 120).toLowerCase() } : {}),
    ...(bool('striking') ? { striking: true } : {}),
    ...(bool('heads') ? { heads: true } : {}),
    ...(bool('questions') ? { questions: true } : {}),
    ...(kiMarketOf(one('market')) ? { market: kiMarketOf(one('market')) } : {}),
    sort: KI_KEYWORD_SORTS.includes(sortKey) ? sortRaw : '-score',
    page,
    pageSize: Math.min(KI_PAGE_SIZE.max, Math.max(1, size || KI_PAGE_SIZE.default)),
    includeSerp: S(one('include')) === 'serp',
  };
}

export function kiKeywordMatches(
  v: KiKeywordView,
  q: Omit<KiKeywordQuery, 'sort' | 'page' | 'pageSize' | 'includeSerp'>,
  gapTypes: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): boolean {
  if (q.gapType && !gapTypes.get(kiGapKeyOf(v.keyword))?.has(q.gapType)) return false;
  if (q.stage && v.stage !== q.stage) return false;
  if (q.verdict && v.verdict !== q.verdict) return false;
  if (q.source && !v.sources.some((s) => s.source === q.source)) return false;
  if (q.cluster && v.clusterId !== q.cluster) return false;
  if (q.minVolume != null && !((v.volume ?? -1) >= q.minVolume)) return false;
  if (q.brand === 'brand' && !v.brand) return false;
  if (q.brand === 'non_brand' && v.brand) return false;
  if (q.q && !v.keyword.toLowerCase().includes(q.q)) return false;
  // striking distance is a quick win: a search that is not for this business is never one (the same rule as kiQuickWin)
  if (q.striking && !kiQuickWin(v)) return false;
  if (q.heads && !v.isHead) return false;
  if (q.questions && !v.question) return false;
  return true;
}

/** The comparator of a sort key; missing numbers always last (whatever the direction), then by keyword for a stable order. */
export function kiKeywordComparator(sort: string): (a: KiKeywordView, b: KiKeywordView) => number {
  const desc = sort.startsWith('-');
  const key = sort.replace(/^-/, '') as KiKeywordSort;
  const val = (v: KiKeywordView): number | string | null =>
    key === 'score' ? v.score : key === 'volume' ? v.volume : key === 'position' ? (v.gsc?.position ?? null) : key === 'demand' ? v.clusterDemand ?? v.factors.demand
      : key === 'kd' ? v.kd : key === 'fetched' ? v.fetchedAt || null : v.keyword.toLowerCase();
  return (a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return a.keyword.localeCompare(b.keyword);
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (desc ? -c : c) || a.keyword.localeCompare(b.keyword);
  };
}

export function kiPage<T>(items: readonly T[], page: number, pageSize: number): { items: T[]; total: number; page: number; pageSize: number; pages: number } {
  const size = Math.min(KI_PAGE_SIZE.max, Math.max(1, Math.floor(pageSize) || KI_PAGE_SIZE.default));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, pageSize: size, pages };
}

/**
 * A quick win IS a search in striking distance (KI_STRIKING, set by the engine on the row) that fits the business. FX-A (review CONSISTENCY M2):
 * one definition, so the recommendation's count, the hero's "Just off page one" and the section it opens all count the same rows.
 */
export function kiQuickWin(v: Pick<KiKeywordView, 'gate' | 'striking'>): boolean {
  return v.gate === 'pass' && v.striking;
}
/** The gap types of each keyword (current gap rows only), by kiGapKeyOf. */
export function kiGapTypesIndex(gaps: readonly Pick<KiGapView, 'keyword' | 'type'>[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const g of gaps) {
    if (!g.keyword || !(KI_KEYWORD_GAP_TYPES as readonly string[]).includes(g.type)) continue;
    const k = kiGapKeyOf(g.keyword);
    const set = m.get(k) ?? new Set<string>();
    set.add(g.type);
    m.set(k, set);
  }
  return m;
}

export function kiSummaryOf(market: string | null, comps: readonly KiCompetitorView[], kws: readonly KiKeywordView[], gaps: readonly KiGapView[]): KiSummary {
  const byVerdict = Object.fromEntries(KI_VERDICT_IDS.map((v) => [v, 0])) as Record<KiVerdict, number>;
  const headsByVerdict = Object.fromEntries(KI_VERDICT_IDS.map((v) => [v, 0])) as Record<KiVerdict, number>;
  const byStage: Partial<Record<KiStage, number>> = {};
  let striking = 0, quick = 0, questions = 0, review = 0, brand = 0;
  const clusters = new Set<string>();
  let newest = '';
  for (const k of kws) {
    byVerdict[k.verdict]++;
    if (k.isHead || !k.clusterId) headsByVerdict[k.verdict]++;
    if (k.stage) byStage[k.stage] = (byStage[k.stage] ?? 0) + 1;
    if (kiQuickWin(k)) {
      striking++;
      quick++;
    }
    if (k.question && k.gate === 'pass') questions++;
    if (k.needsReview) review++;
    if (k.brand) brand++;
    if (k.clusterId) clusters.add(k.clusterId);
    if (k.fetchedAt > newest) newest = k.fetchedAt;
  }
  const isComp = (c: KiCompetitorView) => c.class === 'direct' || c.class === 'adjacent';
  for (const c of comps) if (c.fetchedAt > newest) newest = c.fetchedAt;
  const byType: Partial<Record<KiGapType, number>> = {};
  let open = 0;
  for (const g of gaps) {
    if (g.updatedAt > newest) newest = g.updatedAt;
    if (g.status !== 'open') continue;
    open++;
    byType[g.type] = (byType[g.type] ?? 0) + 1;
  }
  return {
    market,
    competitors: {
      total: comps.filter(isComp).length,
      chosen: comps.filter((c) => c.status === 'chosen').length,
      watch: comps.filter((c) => c.status === 'watch').length,
      candidates: comps.filter((c) => isComp(c) && c.status === 'candidate').length,
      dismissed: comps.filter((c) => c.status === 'dismissed').length,
      listings: comps.filter((c) => c.class === 'directory' || c.class === 'publisher_list').length,
      platforms: comps.filter((c) => c.class === 'platform').length,
      confirmed: comps.some((c) => c.statusBy === 'user'),
    },
    keywords: { total: kws.length, byVerdict, headsByVerdict, byStage, striking, quickWins: quick, questions, clusters: clusters.size, needsReview: review, brand },
    gaps: { open, byType },
    fetchedAt: newest || null,
  };
}

export function kiFacetsOf(kws: readonly KiKeywordView[]): KiKeywordsResponse['facets'] {
  const verdict = Object.fromEntries(KI_VERDICT_IDS.map((v) => [v, 0])) as Record<KiVerdict, number>;
  const stage: Partial<Record<KiStage, number>> = {};
  const source: Partial<Record<KiSource, number>> = {};
  for (const k of kws) {
    verdict[k.verdict]++;
    if (k.stage) stage[k.stage] = (stage[k.stage] ?? 0) + 1;
    for (const s of k.sources) source[s.source] = (source[s.source] ?? 0) + 1;
  }
  return { verdict, stage, source };
}

// ---------------------------------------------------------------------------------------------------------------------------
// CSV (every cell through csvCell: quoted, a leading = + - @ neutralised; the basis and the date beside every number)
// ---------------------------------------------------------------------------------------------------------------------------

export const kiCsvLine = (cells: readonly unknown[]): string => cells.map(csvCell).join(',') + '\r\n';

/**
 * FX-A (review UX M11): the CSVs speak the page's words. Each file has a STABLE machine column order (the `*_CSV_COLUMNS` keys, for teams that
 * load it into a warehouse: new columns are only ever added at the end) and a header row in plain words (`*_CSV_HEADERS`, same order); the
 * values are the words the page shows (verdict, buyer stage, what to do, how we know), never engine codes. Documented in app/API.md.
 */
const PAGE_ACTION_WORDS: Record<string, string> = { new: 'Write a new page', refresh: 'Improve your page', list: 'Get on the lists that rank', none: 'No page needed' };
const yes = (b: boolean | null | undefined) => (b ? 'yes' : 'no');

export const KI_KEYWORD_CSV_COLUMNS = [
  'keyword', 'market', 'verdict', 'score', 'score_low', 'score_high', 'low_confidence', 'stage', 'intent', 'volume', 'volume_basis', 'volume_source', 'cpc', 'kd',
  'gsc_impressions', 'gsc_clicks', 'gsc_position', 'gsc_page', 'striking', 'brand', 'question', 'cluster_id', 'is_head', 'cluster_size', 'page_action', 'page_url',
  'sources', 'gate', 'gate_reason', 'competitors', 'serp_read_at', 'fetched_at',
] as const;
export const KI_KEYWORD_CSV_HEADERS: Record<(typeof KI_KEYWORD_CSV_COLUMNS)[number], string> = {
  keyword: 'Search', market: 'Market', verdict: 'For you', score: 'Score', score_low: 'Score likely from', score_high: 'Score likely to', low_confidence: 'Wide range',
  stage: 'Buyer stage', intent: 'What the searcher wants', volume: 'Searches a month', volume_basis: 'How we know the searches', volume_source: 'Searches from', cpc: 'Cost per click in ads',
  kd: 'How hard to rank (0 to 100)', gsc_impressions: 'Times you were seen (28 days)', gsc_clicks: 'Clicks to you (28 days)', gsc_position: 'Your place in Google', gsc_page: 'Your page shown',
  striking: 'Just off page one', brand: 'Has your name', question: 'Buyer question', cluster_id: 'Topic id', is_head: 'Main search of its topic', cluster_size: 'Searches in its topic',
  page_action: 'What to do', page_url: 'Page to improve', sources: 'Where from', gate: 'Fits what you sell', gate_reason: 'Why not', competitors: 'Competitors in the results',
  serp_read_at: 'Google results read on', fetched_at: 'Updated on',
};
const INTENT_WORDS: Record<string, string> = { commercial: 'Comparing options', transactional: 'Ready to buy', informational: 'Learning', navigational: 'Looking for one website' };
export const kiKeywordCsvRow = (v: KiKeywordView): string =>
  kiCsvLine([
    v.keyword, v.market, v.verdictLabel, v.score, v.scoreLow, v.scoreHigh, yes(v.lowConfidence), v.stageLabel ?? '', v.intent ? INTENT_WORDS[v.intent] ?? '' : '', v.volume, v.volumeBasisLabel,
    v.volumeSource ? kiSourceWordsOf(v.volumeSource) : '', v.cpc, v.kd,
    v.gsc?.impressions, v.gsc?.clicks, v.gsc?.position, v.gsc?.page ?? '', yes(v.striking), yes(v.brand), yes(v.question), v.clusterId ?? '', yes(v.isHead), v.clusterSize,
    v.pageAction ? PAGE_ACTION_WORDS[v.pageAction] ?? '' : '', v.pageUrl ?? '',
    v.sources.map((s) => s.label).join('; '), v.gate === 'fail' ? 'no' : 'yes', v.gate === 'fail' ? (v.gateReason ?? '') : '',
    v.competitors.map((c) => `${c.domain} #${c.position}`).join('; '), v.serpReadAt ?? '', v.fetchedAt,
  ]);

const CLASS_BASIS_WORDS: Record<string, string> = { rule: 'Google results', page: 'Their website', llm: 'Our reading', declared: 'You added it', user: 'You decided' };
const COMP_STATUS_WORDS: Record<string, string> = { candidate: 'Suggested', chosen: 'You follow', watch: 'Watchlist', dismissed: 'Not a competitor' };
const STATUS_BY_WORDS: Record<string, string> = { auto: 'Us', user: 'You', declared: 'You added it' };
export const KI_COMPETITOR_CSV_COLUMNS = [
  'domain', 'market', 'class', 'class_basis', 'status', 'status_by', 'score', 'score_low', 'score_high', 'serp_share', 'topic_similarity', 'geo_match', 'ai_share', 'size',
  'seeds_seen', 'seeds_total', 'reasons', 'basis', 'first_seen', 'last_seen', 'fetched_at',
] as const;
export const KI_COMPETITOR_CSV_HEADERS: Record<(typeof KI_COMPETITOR_CSV_COLUMNS)[number], string> = {
  domain: 'Website', market: 'Market', class: 'What it is', class_basis: 'Sorted by', status: 'On your list as', status_by: 'Decided by', score: 'How much they compete (0 to 100)',
  score_low: 'Likely from', score_high: 'Likely to', serp_share: 'Share of clicks on your searches', topic_similarity: 'Sells what you sell (0 to 1)', geo_match: 'Same area as you (0 to 1)',
  ai_share: 'Share of AI answers', size: 'Size', seeds_seen: 'Your searches it shows up for', seeds_total: 'Your searches read', reasons: 'Why', basis: 'How we know',
  first_seen: 'First seen', last_seen: 'Last seen', fetched_at: 'Updated on',
};
export const kiCompetitorCsvRow = (c: KiCompetitorView): string =>
  kiCsvLine([
    c.compDomain, c.market, c.classLabel, CLASS_BASIS_WORDS[c.classBasis] ?? '', COMP_STATUS_WORDS[c.status] ?? '', STATUS_BY_WORDS[c.statusBy] ?? '', c.score, c.scoreLow, c.scoreHigh, c.serpShare,
    c.topicSim, c.geoMatch, c.aiShare, c.sizeLabel, c.seedsSeen, c.seedsTotal, c.reasons.join('; '), c.basisLabel, c.firstSeen, c.lastSeen, c.fetchedAt,
  ]);

const GAP_TYPE_WORDS: Record<KiGapType, string> = {
  missing: 'Competitors rank, you are missing', untapped: 'One competitor ranks, you are missing', weak: 'You rank low', striking: 'Just off page one', strong: 'You lead: keep it',
  topic: 'A topic you do not cover', page_type: 'A kind of page you do not have', ai_answer: 'Named in AI answers, you are not', listing: 'A list or directory to join',
  backlink: 'Websites that link to them, not you',
};
const GAP_ACTION_WORDS: Record<string, string> = { new_page: 'Write a new page', refresh: 'Improve your page', list: 'Get listed', pitch: 'Ask to be added', link: 'Ask for a link', defend: 'Keep it fresh' };
const GAP_STATUS_WORDS: Record<string, string> = { open: 'Open', started: 'Started', dismissed: 'Not for us', done: 'Done' };
/** How each kind of gap is known (review UX M11: it was "measured" for every row). */
const GAP_BASIS: Record<KiGapType, KiBasis> = {
  missing: 'provider_estimate', untapped: 'provider_estimate', weak: 'provider_estimate', striking: 'measured', strong: 'measured', topic: 'measured', page_type: 'measured',
  ai_answer: 'measured', listing: 'measured', backlink: 'provider_estimate',
};
export const KI_GAP_CSV_COLUMNS = ['gap_id', 'market', 'type', 'keyword', 'competitors', 'your_position', 'action', 'action_target', 'credits', 'status', 'note', 'basis', 'created_at', 'updated_at'] as const;
export const KI_GAP_CSV_HEADERS: Record<(typeof KI_GAP_CSV_COLUMNS)[number], string> = {
  gap_id: 'Gap id', market: 'Market', type: 'Kind of gap', keyword: 'Search', competitors: 'Competitors', your_position: 'Your place', action: 'What to do', action_target: 'Where',
  credits: 'About this many credits', status: 'Status', note: 'Note', basis: 'How we know', created_at: 'Found on', updated_at: 'Updated on',
};
export const kiGapCsvRow = (g: KiGapView): string =>
  kiCsvLine([
    g.gapId, g.market, GAP_TYPE_WORDS[g.type] ?? '', g.keyword ?? '', g.competitorDomains.join('; '), g.clientPosition, GAP_ACTION_WORDS[g.action] ?? '', g.actionTarget ?? '', g.credits,
    GAP_STATUS_WORDS[g.status] ?? '', g.sampleNote ?? '', kiBasisLabel(GAP_BASIS[g.type] ?? 'measured', 'our keyword data'), g.createdAt, g.updatedAt,
  ]);
/** The plain-words header row of one CSV, in its stable column order. */
export const kiCsvHeader = <K extends string>(cols: readonly K[], words: Record<K, string>): string[] => cols.map((c) => words[c] ?? c);

export const kiCsvFileName = (kind: 'competitors' | 'keywords' | 'gaps', domain: string, at = new Date()): string =>
  `${kind}-${S(domain).replace(/[^a-z0-9.-]+/gi, '_')}-${at.toISOString().slice(0, 10)}.csv`;
