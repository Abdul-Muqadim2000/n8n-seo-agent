import type { PlanType } from './data';
import { keywordsOverlap } from './ladders';
import { normKeyword } from './pipeline-notices';

// Choosing the main keyword of a new keyword ladder (PIPELINE_FEATURE_SPEC.md §5): the words for "difficulty for your site" and the
// plan types (the same words as n8n's v5/code/_reach.js), the keyword check's answer as the app shows it, and the recommended
// keywords taken from the website's latest keyword strategy (discovery) report. Pure functions: the server builds the lists, the web
// shows them and "Choose for me" picks with the same rule.

export type DifficultyForYou = 'easy' | 'reachable' | 'hard' | 'very_hard' | 'not_realistic';
/** a plan type, or 'none' when the keyword is not realistic for the website (no ladder) */
export type PlanChoice = PlanType | 'none';

export const DIFFICULTY_WORD: Record<DifficultyForYou, string> = { easy: 'Easy', reachable: 'Reachable', hard: 'Hard', very_hard: 'Very hard', not_realistic: 'Not realistic' };
/** n8n's REACH_DIFF_LABEL */
export const DIFFICULTY_LABEL: Record<DifficultyForYou, string> = {
  easy: 'Easy for your site',
  reachable: 'Reachable for your site',
  hard: 'Hard for your site',
  very_hard: 'Very hard for your site',
  not_realistic: 'Not realistic for your site',
};
/** what each difficulty means, in one sentence */
export const DIFFICULTY_HINT: Record<DifficultyForYou, string> = {
  easy: 'Your website already wins searches this hard (or ranks top 20 for it).',
  reachable: 'A little harder than what your website wins today: a few supporting pages first.',
  hard: 'Clearly harder than what your website wins today: it takes a full ladder of easier pages.',
  very_hard: 'Far beyond what your website wins today: a long climb; an easier keyword first is usually better.',
  not_realistic: 'People searching this look for one particular company or website, or the check advised against it.',
};
/** n8n's REACH_PLAN_LABEL */
export const PLAN_CHOICE_LABEL: Record<PlanChoice, string> = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
/** the order of the pages, in plain words (§5.5) */
export const PLAN_ORDER_TEXT: Record<PlanType, string> = {
  direct: 'The main page first, then 2-3 supporting pages that link to it.',
  short: '3-5 supporting pages first, then the main page once half of them are live.',
  full: 'Rung by rung from the easiest pages (up to about 12 of them), the main page last.',
};

export const KEYWORD_CHECK = {
  /** reserved per check in the budget (the SEO engine reports ~$0.02 with a stored reach, ~$0.05 without) */
  estimateUsd: 0.05,
  perCompanyPerDay: 30,
  /** the same website, keyword and country checked within this many days: the stored answer, free */
  cacheDays: 7,
  /** the HTTP call to n8n (it takes 5-20 s) */
  timeoutMs: 45_000,
} as const;

/** recommendations older than this are shown with a "find fresh keywords" warning; auto-start ignores them */
export const RECOMMENDATIONS_MAX_AGE_DAYS = 90;

const DIFFS: readonly DifficultyForYou[] = ['easy', 'reachable', 'hard', 'very_hard', 'not_realistic'];
export const asDifficulty = (v: unknown): DifficultyForYou | null => (typeof v === 'string' && (DIFFS as readonly string[]).includes(v) ? (v as DifficultyForYou) : null);
export const asPlanChoice = (v: unknown): PlanChoice | null => (v === 'direct' || v === 'short' || v === 'full' || v === 'none' ? v : null);
/** easy or reachable: what "Choose for me" and auto-start may pick */
export const isWithinReach = (d: DifficultyForYou | null | undefined) => d === 'easy' || d === 'reachable';

/** "Easy for your site · Direct plan · 2-4 months" (n8n's reachLabel) */
export function forYouLabel(difficulty: DifficultyForYou | null, plan: PlanChoice | null, months: string, stretch = false): string {
  if (!difficulty) return '';
  if (!plan || plan === 'none') return DIFFICULTY_LABEL[difficulty];
  return [DIFFICULTY_LABEL[difficulty], PLAN_CHOICE_LABEL[plan] + (stretch ? ' (stretch)' : ''), months ? `${months} months` : ''].filter(Boolean).join(' · ');
}

const num = (v: unknown): number | null => (v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// ---------- the keyword check's answer ----------

/** One keyword checked for the website (the SEO engine's answer, POST /webhook/seo-keyword-assess). */
export interface KeywordAssessment {
  keyword: string;
  country: string;
  /** searches a month */
  volume: number | null;
  /** keyword difficulty 0-100 (DataForSEO) */
  kd: number | null;
  intent: string | null;
  cpc: number | null;
  /** the website's Google position for it now, null when not ranking */
  position: number | null;
  positionUrl: string | null;
  /** the difficulty the website already wins (§5.3) */
  reach: number | null;
  difficultyForYou: DifficultyForYou | null;
  planType: PlanChoice | null;
  /** "4-8", '' when there is no plan */
  months: string;
  stretch: boolean;
  /** topic fit with the business: 0 off-topic, 1 related, 2 core, null when the topic check failed */
  fit: 0 | 1 | 2 | null;
  /** people searching it look for one particular website or brand */
  navigational: boolean;
  /** easier or on-topic keywords instead (only when not realistic or off-topic) */
  alternatives: string[];
  label: string;
  warnings: string[];
}

/** The engine's snake_case answer as the app's assessment (tolerant: missing fields are null / empty). */
export function toAssessment(raw: Record<string, unknown>): KeywordAssessment {
  const difficultyForYou = asDifficulty(raw.difficulty_for_you);
  const planType = asPlanChoice(raw.plan_type);
  const months = str(raw.months);
  const stretch = raw.stretch === true;
  const fitN = num(raw.fit);
  const pos = num(raw.position);
  return {
    keyword: str(raw.keyword),
    country: str(raw.country),
    volume: num(raw.volume),
    kd: num(raw.kd),
    intent: str(raw.intent) || null,
    cpc: num(raw.cpc),
    position: pos != null && pos > 0 ? pos : null,
    positionUrl: str(raw.position_url) || null,
    reach: num(raw.reach),
    difficultyForYou,
    planType,
    months: planType === 'none' ? '' : months,
    stretch,
    fit: fitN === 0 || fitN === 1 || fitN === 2 ? fitN : null,
    navigational: raw.navigational === true,
    alternatives: [...new Set(strs(raw.alternatives).map((a) => a.toLowerCase()))].slice(0, 5),
    label: str(raw.label) || forYouLabel(difficultyForYou, planType, months, stretch),
    warnings: strs(raw.warnings).slice(0, 5),
  };
}

/** A keyword check of a website, as stored by the app (POST …/keywords/assess). */
export interface KeywordCheck {
  id: string;
  siteId: string | null;
  keyword: string;
  country: string;
  result: KeywordAssessment;
  costUsd: number;
  createdAt: string;
  /** the stored answer of a check of the last 7 days: nothing was charged */
  cached: boolean;
}

// ---------- recommended keywords (the latest keyword strategy report) ----------

export type RecommendedSource = 'start_with' | 'priority' | 'quick_win' | 'content_plan';

export interface RecommendedKeyword {
  keyword: string;
  volume: number | null;
  kd: number | null;
  intent: string;
  pageType: string;
  /** why it fits the goal (the discovery's own words), '' when it has none */
  why: string;
  difficultyForYou: DifficultyForYou | null;
  planType: PlanChoice | null;
  months: string;
  label: string;
  source: RecommendedSource;
  /** the website's keyword ladders that already cover this search (main or page keyword; one search, one page) */
  overlaps: { ladderId: string; head: string; keyword: string }[];
}

export interface RecommendedKeywords {
  /** the keyword strategy report the list comes from; null when the website has none */
  reportId: string | null;
  receivedAt: string | null;
  ageDays: number | null;
  /** older than 90 days: better find fresh keywords */
  stale: boolean;
  /** the website's reach when the report measured it (labels are relative to it) */
  reach: number | null;
  /** the market the research was done for (a country of the form list), null when unknown */
  country: string | null;
  /** best first: within reach, then the discovery's own order; overlapping ones last */
  keywords: RecommendedKeyword[];
}

export interface LadderKeywords {
  id: string;
  head: string;
  /** every page keyword of the ladder */
  keywords: string[];
}

/** The ladders that cover a keyword already: its main keyword or one of its pages is the same search (75%+ the same words). */
export function ladderOverlapsOf(keyword: string, ladders: LadderKeywords[]): RecommendedKeyword['overlaps'] {
  const out: RecommendedKeyword['overlaps'] = [];
  for (const l of ladders) {
    const hit = [l.head, ...l.keywords].find((k) => k && (normKeyword(k) === normKeyword(keyword) || keywordsOverlap(k, keyword)));
    if (hit) out.push({ ladderId: l.id, head: l.head, keyword: hit });
  }
  return out;
}

const DIFF_RANK: Record<string, number> = { easy: 0, reachable: 1, unknown: 2, hard: 3, very_hard: 4, not_realistic: 5 };
const SOURCE_RANK: Record<RecommendedSource, number> = { start_with: 0, priority: 1, quick_win: 2, content_plan: 3 };

/**
 * The keywords of a keyword_strategy callback as ladder candidates: the discovery's pick (start_with), its priority keywords, quick
 * wins and the main keywords of the Now / Next topics; one per search, best first (easy, reachable, not rated, hard, very hard, not
 * realistic; then the discovery's order); those that overlap a ladder go last, marked.
 */
export function recommendedFromStrategy(payload: Record<string, unknown>, ladders: LadderKeywords[], max = 12): RecommendedKeyword[] {
  const items: (RecommendedKeyword & { i: number })[] = [];
  const seen = new Set<string>();
  const add = (k: Record<string, unknown>, source: RecommendedSource, keyword = str(k.keyword), why = str(k.why)) => {
    const kw = keyword.trim().toLowerCase().replace(/\s+/g, ' ');
    const key = normKeyword(kw);
    if (!key || kw.length < 2 || kw.length > 100 || seen.has(key)) return;
    seen.add(key);
    const difficultyForYou = asDifficulty(k.difficulty_for_you);
    const planType = asPlanChoice(k.plan_type);
    const months = planType === 'none' ? '' : str(k.months);
    items.push({
      keyword: kw,
      volume: num(k.volume ?? k.total_volume),
      kd: num(k.kd ?? k.primary_kd),
      intent: str(k.intent),
      pageType: str(k.page_type),
      why: why.replace(/(\d+\.\d{3,})/g, (m) => Number(m).toFixed(2)),
      difficultyForYou,
      planType,
      months,
      label: str(k.label) || forYouLabel(difficultyForYou, planType, months),
      source,
      overlaps: ladderOverlapsOf(kw, ladders),
      i: items.length,
    });
  };
  const start = obj(payload.start_with);
  if (start.keyword) add(start, 'start_with');
  for (const k of Array.isArray(payload.priority) ? payload.priority : []) add(obj(k), 'priority');
  for (const k of Array.isArray(payload.quick_wins) ? payload.quick_wins : []) add(obj(k), 'quick_win');
  for (const c of Array.isArray(payload.content_plan) ? payload.content_plan : []) {
    const t = obj(c);
    const tier = str(t.tier).toLowerCase();
    if (tier && tier !== 'now' && tier !== 'next') continue;
    const n = num(t.keyword_count);
    add(t, 'content_plan', str(t.primary_keyword), [str(t.topic) && `Topic “${str(t.topic)}”`, n ? `${n} related searches on one page` : ''].filter(Boolean).join(': '));
  }
  return items
    .sort(
      (a, b) =>
        Number(a.overlaps.length > 0) - Number(b.overlaps.length > 0) ||
        DIFF_RANK[a.difficultyForYou ?? 'unknown'] - DIFF_RANK[b.difficultyForYou ?? 'unknown'] ||
        SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
        a.i - b.i,
    )
    .slice(0, max)
    .map(({ i: _i, ...k }) => k);
}

/** "Choose for me": the first card that is easy or reachable for the website and that no ladder covers yet; null when none is. */
export function chooseForMe<T extends Pick<RecommendedKeyword, 'difficultyForYou' | 'overlaps'>>(list: readonly T[]): T | null {
  return list.find((k) => isWithinReach(k.difficultyForYou) && !k.overlaps.length) ?? null;
}
