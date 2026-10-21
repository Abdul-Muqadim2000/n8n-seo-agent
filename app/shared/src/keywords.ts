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
  /**
   * KW-APP D6 (2026-10-21, live run): the same website, keyword and country checked within this many hours, by the same engine rules and
   * with the same website context (services, brand names, competitors, ladder keywords): the stored answer, free. It was 7 days with no
   * rules check, and served the morning's "fit 2, Easy" for "ai consultant" after the engine had learned it is a job search (fit 0).
   */
  cacheHours: 6,
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

// ---------- time to rank (FIX_PLAN G3, 2026-10-11; n8n's REACH_BASE_RATE / REACH_CHANCE in v5/code/_reach.js, keep both the same) ----------

/** The 2025 Ahrefs study behind "months, not weeks": 1.74% of new pages reach Google's top 10 within a year, 40.8% of those within a month. */
export const REACH_BASE_RATE = { year: 2025, source: 'Ahrefs', top10WithinYearPct: 1.74, ofThoseWithinMonthPct: 40.8, url: 'https://ahrefs.com/blog/how-long-does-it-take-to-rank/' } as const;

/** 'unmeasured' (R49, 2026-10-16): the website's reach rests on no measured ranking, so no band is shown (n8n's reachMeasured). */
export type ChanceBand = 'good' | 'fair' | 'low' | 'slim' | 'none' | 'unmeasured';
/** The estimated chance of reaching the top 10 within the plan's months: a band per plan type (stretch = a very hard keyword on a full ladder). */
export interface PlanChance {
  band: ChanceBand;
  range: readonly [number, number];
}
/** Judgement calls relative to the base rate (a keyword within the website's reach is far from a random new page). UNCALIBRATED until the
 *  system has measured its own ladders (G17): every label says so. The same values live in n8n's _reach.js. */
export const PLAN_CHANCE: Record<PlanType | 'stretch' | 'none', PlanChance> = {
  direct: { band: 'good', range: [50, 70] },
  short: { band: 'fair', range: [30, 50] },
  full: { band: 'low', range: [15, 30] },
  stretch: { band: 'slim', range: [5, 15] },
  none: { band: 'none', range: [0, 0] },
};
export const CHANCE_NOTE = 'an uncalibrated estimate until this system has measured its own ladders';

/**
 * R49 (2026-10-16, the third re-rating): the band was read off the plan type alone, so a website whose reach is only the size tier for
 * "0 keywords in Google's top 10" was shown "good (50-70%)". The table applies only when the reach rests on a measured ranking, the
 * same rule as n8n's reachMeasured(): the site's top-10 keywords (percentile, or any at all), a reach measured on the topic, or the site
 * already ranking 1-20 for the keyword.
 */
export const UNMEASURED_CHANCE: PlanChance = { band: 'unmeasured', range: [0, 0] };
export const UNMEASURED_LABEL = 'no estimated chance (no measured ranking to judge it by)';
export function reachMeasured(info: { method?: unknown; sample?: unknown; top10?: unknown; used?: unknown } | null | undefined, position?: number | null): boolean {
  const p = num(position);
  if (p != null && p >= 1 && p <= 20) return true;
  const i = info ?? {};
  if (i.used === true || str(i.method) === 'percentile') return true;
  return (num(i.top10) ?? 0) > 0 || (num(i.sample) ?? 0) > 0;
}

/** The chance band of a plan ('none' / null = no ladder; `measured: false` = no band, the reach rests on no measured ranking). */
export function planChance(plan: PlanChoice | null | undefined, stretch = false, measured = true): PlanChance {
  if (!plan || plan === 'none') return PLAN_CHANCE.none;
  if (!measured) return UNMEASURED_CHANCE;
  return PLAN_CHANCE[stretch ? 'stretch' : plan];
}

/** "estimated chance good (50-70%, uncalibrated)" (n8n's reachChance().label); '' for no ladder */
export function chanceLabel(plan: PlanChoice | null | undefined, stretch = false, measured = true): string {
  const c = planChance(plan, stretch, measured);
  if (c.band === 'none') return '';
  if (c.band === 'unmeasured') return UNMEASURED_LABEL;
  return `estimated chance ${c.band} (${c.range[0]}-${c.range[1]}%, uncalibrated)`;
}

/** The base rate in one sentence (n8n's reachBaseRateText). */
export function baseRateText(): string {
  return `Base rate (${REACH_BASE_RATE.source}, ${REACH_BASE_RATE.year}): only ${REACH_BASE_RATE.top10WithinYearPct}% of new pages reach Google's top 10 within a year, and ${REACH_BASE_RATE.ofThoseWithinMonthPct}% of those do so within a month. The rest take months.`;
}

/** The sentence under a plan's month range (n8n's reachChanceText): the band, that it is uncalibrated, and the base rate it is judged against. */
export function chanceText(plan: PlanChoice | null | undefined, months: string, stretch = false, measured = true): string {
  const c = planChance(plan, stretch, measured);
  if (c.band === 'none' || !months) return '';
  if (c.band === 'unmeasured')
    return `No estimated chance: the reach this plan is judged against rests on no measured ranking (the search data shows none of your keywords in Google's top 10), so a band would only restate the plan. The only measured figure is the base rate. ${baseRateText()}`;
  return `Estimated chance of reaching the top 10 within ${months} months: ${c.band} (${c.range[0]}-${c.range[1]}%): ${CHANCE_NOTE}. ${baseRateText()}`;
}

/** The engine's `chance` object as the app's band (tolerant: unknown shapes fall back to the plan type's band). */
export function toChance(raw: unknown, plan: PlanChoice | null | undefined, stretch = false): PlanChance {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (o && o.band === 'unmeasured') return UNMEASURED_CHANCE;
  const band = o && typeof o.band === 'string' && ['good', 'fair', 'low', 'slim', 'none'].includes(o.band) ? (o.band as ChanceBand) : null;
  const r = o && Array.isArray(o.range) && o.range.length === 2 && o.range.every((x) => Number.isFinite(Number(x))) ? ([Number(o.range[0]), Number(o.range[1])] as const) : null;
  return band && r ? { band, range: r } : planChance(plan, stretch);
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
  /** KW-APP (2026-10-21, live run D15): the page of the website the check matched to this search, with how it matched; null when none */
  existingPage?: ExistingPageMatch | null;
  /** KW-APP: how Google's results page was read: `readToday` when an earlier reading of today was reused (no new purchase) */
  reading?: { readToday: boolean; note: string; checkedAt: string } | null;
}

/** The website's own page a check (or a plan) matched to a search: the evidence the client can open. */
export interface ExistingPageMatch {
  url: string;
  title: string;
  /** how it was matched: 'title', 'address', 'search console', 'the same keyword' ... (the engine's words) */
  matchedBy: string;
  /** the engine's status of that page ('live', 'not_ready', 'gone' ...), '' when unknown */
  status: string;
  /** the page belongs to one of the website's keyword ladders */
  ladder: boolean;
  /** the engine's evidence line when it sends one, '' when not */
  evidence: string;
}

/** The engine's `existing` block (Keyword Check) as the match the client sees; null without a page address. */
export function toExistingPage(raw: unknown): ExistingPageMatch | null {
  const e = obj(raw);
  const url = str(e.page_url) || str(e.url);
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    title: str(e.page_title) || str(e.title),
    matchedBy: str(e.matched_by) || str(e.how),
    status: str(e.page_status),
    ladder: !!str(e.ladder_id),
    evidence: str(e.evidence) || str(e.existing_evidence),
  };
}

const MATCHED_BY: Record<string, string> = { title: 'its title', address: 'its address', url: 'its address', 'search console': 'Search Console data', 'the same keyword': 'the same keyword' };
/** The lines that say what a check matched and how it read Google, in the customer's words ('' parts left out). */
export function checkEvidenceLines(r: Pick<KeywordAssessment, 'existingPage' | 'reading'>): string[] {
  const out: string[] = [];
  const p = r.existingPage;
  if (p) {
    const how = MATCHED_BY[p.matchedBy.toLowerCase()] ?? (p.matchedBy ? p.matchedBy : '');
    const title = p.title ? ` ("${p.title}")` : '';
    const gone = /gone|404|not found|missing/i.test(p.status) ? ' That address no longer answers, so it is not a page to improve.' : p.status && p.status !== 'live' ? ` Its status: ${p.status.replace(/_/g, ' ')}.` : '';
    out.push(
      (p.ladder ? `One of your keyword ladders already holds this search; its page: ${p.url}${title}.` : `Matched to your page ${p.url}${title}${how ? `, by ${how}` : ''}.`) +
        (p.evidence ? ` ${p.evidence.charAt(0).toUpperCase()}${p.evidence.slice(1)}${/[.!?]$/.test(p.evidence) ? '' : '.'}` : '') +
        gone,
    );
  }
  if (r.reading?.readToday) out.push(`Google's results page ${r.reading.note || 'was read earlier today'}: that reading was used again, at no extra cost.`);
  return out;
}

/**
 * R3 (2026-10-13, the re-rating run): a topic check that could not be read has to show in the label, not only in `warnings`, live, the
 * Keyword Check shipped `fit: null` for "business central partner uae" and the app displayed "Reachable for your site" as if the topic
 * had been checked. The engine already appends this note; the app adds it when an older engine did not.
 */
export const FIT_UNKNOWN_NOTE = 'topic check unavailable';
const fitLabel = (label: string, fit: number | null) =>
  (!label || fit === 0 || fit === 1 || fit === 2 || label.includes(FIT_UNKNOWN_NOTE) ? label : `${label} \u00b7 ${FIT_UNKNOWN_NOTE}`);

/** The engine's results-page reading (serp block): null when the page was not read. */
function readingOf(raw: unknown): KeywordAssessment['reading'] {
  const s = obj(raw);
  if (s.read !== true) return null;
  return { readToday: s.read_today === true, note: str(s.read_note).trim(), checkedAt: str(s.checked_at) };
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
    label: fitLabel(str(raw.label) || forYouLabel(difficultyForYou, planType, months, stretch), fitN),
    warnings: strs(raw.warnings).slice(0, 5),
    existingPage: toExistingPage(raw.existing),
    reading: readingOf(raw.serp),
  };
}

/** A keyword check of a website, as stored by the app (POST .../keywords/assess). */
export interface KeywordCheck {
  id: string;
  siteId: string | null;
  keyword: string;
  country: string;
  result: KeywordAssessment;
  /** credits (app/docs/CREDITS.md): what this check used (0 for a stored answer shown again) */
  credits: number;
  createdAt: string;
  /** the stored answer of a check of the last few hours (same engine rules, same website context): nothing was charged */
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
  /** is it one of the services the client listed: 'in', 'out', or 'unknown' (too little on file, or a report from before 2026-10-20) */
  serviceFit?: ServiceFit;
  /** a short line for the card in the customer's words ('' when there is nothing to say) */
  note?: string;
  /** KW-APP D3 (2026-10-21): the engine read it as a job or training search (few buyers); it keeps the engine's last place and its note */
  career?: boolean;
}

export type ServiceFit = 'in' | 'unknown' | 'out';

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
  /** the research's own order (start-with pick first), the client's services first; job searches and overlapping ones last */
  keywords: RecommendedKeyword[];
  /** keyword-first (SCHEDULING_KEYWORDS_PLAN.md §5.2, the onboarding poll): research running now, fresh research on file, or none
   * (GET .../keywords/recommended always sets it) */
  status?: 'none' | 'running' | 'ready';
  /** when the running research started, null when none is running */
  startedAt?: string | null;
  /** the running research run, null when none is running */
  runId?: string | null;
  /** the website's one free research at setup is still available (POST .../research/start is free) */
  freeResearch?: boolean;
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

const FIT_RANK: Record<ServiceFit, number> = { in: 0, unknown: 1, out: 2 };
/** the card's line for a keyword that is not one of the client's services (F-REH, 2026-10-20) */
export const SERVICE_OUT_NOTE = 'Not one of the services you listed';
const asServiceFit = (v: unknown): ServiceFit => (v === 'in' || v === 'out' ? v : 'unknown');
/** the card's line for a job or training search when the engine sent no detail of its own */
export const CAREER_NOTE = 'Mostly people looking for work or training, not buyers';
/** the engine's words when it demotes a job or training search (v5/code: "mostly looking for work or training") */
const CAREER_WHY = /looking for work or training/i;
/** KW-APP D3: the engine's career flag (an object with its detail, or true), or its words in `why` when the flag did not travel */
function careerOf(k: Record<string, unknown>, why: string): { career: boolean; note: string } {
  const c = k.career;
  const detail = c && typeof c === 'object' ? str((c as Record<string, unknown>).detail).trim() : '';
  if (detail) return { career: true, note: detail.charAt(0).toUpperCase() + detail.slice(1) };
  if (c === true || CAREER_WHY.test(why)) {
    const m = /(?:^|; )([^;]*looking for work or training[^;]*)/i.exec(why);
    const line = m ? m[1].trim() : '';
    return { career: true, note: line ? line.charAt(0).toUpperCase() + line.slice(1) : CAREER_NOTE };
  }
  return { career: false, note: '' };
}

/**
 * The keywords of a keyword_strategy callback as ladder candidates: the discovery's pick (start_with), its priority keywords, quick
 * wins and the main keywords of the Now / Next topics; one per search, in the discovery's order (the client's services first); job or
 * training searches and those that overlap a ladder go last, marked.
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
    const serviceFit = asServiceFit(k.service_fit);
    const career = careerOf(k, why);
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
      serviceFit,
      note: career.career ? career.note : serviceFit === 'out' ? SERVICE_OUT_NOTE : '',
      career: career.career,
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
    add(t, 'content_plan', str(t.primary_keyword), [str(t.topic) && `Topic "${str(t.topic)}"`, n ? `${n} related searches on one page` : ''].filter(Boolean).join(': '));
  }
  // F-REH (2026-10-20, real-credit rehearsal): what the client sells comes first (service_fit: in, not judged, out).
  // KW-APP D3 (2026-10-21, live run): the app used to re-rank by difficulty too, which moved the engine's start-with pick to card #5 and a
  // job search the engine had put last to card #3 with no note. The engine's order is the research's judgement: keep it. The app only moves
  // a search a ladder already holds to the end (picking it would start a second ladder for one search; only the app knows the ladders), and
  // keeps a job or training search after everything else, as the engine does.
  return items
    .sort(
      (a, b) =>
        Number(a.overlaps.length > 0) - Number(b.overlaps.length > 0) ||
        Number(a.career === true) - Number(b.career === true) ||
        FIT_RANK[a.serviceFit ?? 'unknown'] - FIT_RANK[b.serviceFit ?? 'unknown'] ||
        a.i - b.i,
    )
    .slice(0, max)
    .map(({ i: _i, ...k }) => k);
}

/** "Choose for me": the first card that is easy or reachable for the website, that no ladder covers yet and that is not outside the
 *  services the client listed (rehearsal 2026-10-20: keyword-first never chooses a topic the client does not sell); null when none is. */
export function chooseForMe<T extends Pick<RecommendedKeyword, 'difficultyForYou' | 'overlaps'> & { serviceFit?: RecommendedKeyword['serviceFit']; career?: boolean }>(list: readonly T[]): T | null {
  return list.find((k) => isWithinReach(k.difficultyForYou) && !k.overlaps.length && k.serviceFit !== 'out' && k.career !== true) ?? null;
}
