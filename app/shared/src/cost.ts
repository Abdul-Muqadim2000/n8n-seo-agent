import type { ModeId } from './constants';

/**
 * B-R3 / B-B1 (benchmark programme 2026-10-15, area 13 §3.1 and §5(b) B1): **one** cost table, not two.
 *
 * The app used to carry its own per-mode prices in two places — `MODES[mode].costUsd` in `constants.ts` and the arithmetic in
 * `estimate.ts` — both dated *"HANDOVER.md §4, live runs of 2026-10-02"*. The engine recalibrated its own table on 2026-10-13 from
 * measured runs and made it self-correcting; by 2026-10-14 the app's copy was **1.3x to 2.5x above** what a run really costs
 * (`docs/system-review-2026-10-14/BENCHMARKS_2026-10-14.md`, area 13 §3.1: a one-page ladder shown as $1.80 cost $0.726). Over-stating
 * is the safe direction for a bill and the wrong direction for a guard: two customer-facing runs were refused at *"$5.74 of $6"* on
 * figures that were wrong.
 *
 * So this file is a **mirror of the engine's shipped defaults** (`n8n/seo-agent/v5/code/_cost_cal.js`, `EST` / `DFS_EST` /
 * `keysFor`), copied value for value with the engine's own measured figures in the comments. Two rules follow from that, and both
 * matter more than the numbers:
 *
 *   1. **This table is a pre-flight fallback and says so.** It is what the app can show *before* the engine has answered. Every
 *      figure it produces is labelled `source: 'app'` and reads "estimate" in the UI.
 *   2. **It defers to the engine the moment the engine speaks.** `runCostEstimate()` prefers, in order: what the run actually cost
 *      (`run_ledger`, settled), then the engine's own calibrated reservation (`run_cost_estimate_usd`), and only then this table.
 *      The engine's figure is self-correcting — it moves toward what each mode really costs and is never allowed below what the mode
 *      cost in its last runs — so the app must never argue with it.
 *
 * Nothing here pads, rounds up or holds anything back of its own: a number this file invents that the engine would not reserve is a
 * bug, because the customer would be refused a run the engine would have accepted.
 *
 * When the engine's table changes, change this one in the same pass. `cost.test.ts` holds the shape; the values themselves can only
 * be kept honest by reading `_cost_cal.js`.
 */

/** The estimate keys the engine prices a request against (`_cost_cal.js` `EST` / `DFS_EST`). */
export type CostKey =
  | 'content'
  | 'report'
  | 'verdict'
  | 'discover'
  | 'ladder'
  | 'full'
  | 'site_audit'
  | 'crawl'
  | 'describe'
  | 'ai_visibility'
  | 'backlinks'
  | 'track'
  | 'published'
  | 'checkin'
  | 'profile'
  | 'case_study'
  | 'assess';

/**
 * One row per estimate key: `ai` is the Claude money, `dfs` the search-data money, and the engine reserves their sum.
 * `measured` is what that key actually cost in the run named in `basis` — kept beside the reservation so nobody has to open the
 * engine to see how conservative a figure is. Mirrored from `_cost_cal.js` (recalibrated 2026-10-13, unchanged on 2026-10-15).
 */
export interface CostRow {
  ai: number;
  dfs: number;
  measured: number;
  basis: string;
}

export const COST_TABLE: Record<CostKey, CostRow> = {
  content: { ai: 0.8, dfs: 0.04, measured: 0.609, basis: 'a written page, exec 521 ($0.438 of it the three streaming Opus nodes)' },
  report: { ai: 0.16, dfs: 0.04, measured: 0.127, basis: 'a keyword report, exec 519' },
  verdict: { ai: 0.16, dfs: 0.04, measured: 0.13, basis: 'a keyword verdict, exec 486' },
  discover: { ai: 0.24, dfs: 0.34, measured: 0.42, basis: 'keyword discovery, exec 518' },
  ladder: { ai: 0.18, dfs: 0.21, measured: 0.279, basis: 'a ladder plan, exec 495 ($0.231) plus the 24 results pages B2-4 reads to group the rungs, at $0.002 each (each page it writes reserves its own run)' },
  full: { ai: 0.08, dfs: 0.55, measured: 0.458, basis: 'the full SEO report, exec 523' },
  site_audit: { ai: 0, dfs: 0, measured: 0, basis: 'a technical audit calls no model (execs 497 / 513)' },
  crawl: { ai: 0, dfs: 0.09, measured: 0.032, basis: 'the crawl of a technical audit; $0.09 is the provider’s quote, $0.032 the pages really crawled (exec 588)' },
  describe: { ai: 0.03, dfs: 0, measured: 0.012, basis: 'reading a homepage, exec 485' },
  ai_visibility: { ai: 0.14, dfs: 0.95, measured: 0.89, basis: 'an AI visibility check, exec 526' },
  backlinks: { ai: 0.06, dfs: 0.5, measured: 0.373, basis: 'a full backlink check, execs 528 / 529' },
  // these start the work that costs; what they spawn reserves its own run, so the run itself reserves nothing
  track: { ai: 0, dfs: 0, measured: 0, basis: 'setting tracking up; the weekly reports are their own runs' },
  published: { ai: 0, dfs: 0, measured: 0, basis: 'a publish check reads your own page' },
  checkin: { ai: 0, dfs: 0, measured: 0, basis: 'a check-in records what you type' },
  profile: { ai: 0, dfs: 0, measured: 0, basis: 'saving the business profile' },
  case_study: { ai: 0, dfs: 0, measured: 0, basis: 'the intake itself; the page it writes reserves a content run' },
  assess: { ai: 0, dfs: 0.034, measured: 0.0254, basis: 'one keyword check, execs 487-489' },
};

const round = (n: number): number => Math.round(n * 10000) / 10000;

// ---------------------------------------------------------------------------------------------------------------------------
// R100: what the engine will actually reserve — its rolling figures (`seo_cache` rows of kind `cost`), ported from `_cost_cal.js`
// ---------------------------------------------------------------------------------------------------------------------------

/** One stored rolling figure (`seo_cache` key `cost:<ai|dfs>:<estimate key>`), as `_cost_cal.js` `readCal` reads it. */
export interface CalStat {
  n: number;
  mean: number;
  max: number;
  recent: number[];
}
export interface EngineCalibration {
  ai: Partial<Record<CostKey, CalStat>>;
  dfs: Partial<Record<CostKey, CalStat>>;
}
export type CostKind = 'ai' | 'dfs';

/** The two constants of `_cost_cal.js` that decide what a reservation is; they must match it. */
const HEADROOM = 1.25; // the engine reserves a quarter more than the rolling figure
const CAP = 5; // and never more than five times the shipped default
const finite = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The stored `cost:*` rows of `seo_cache` as one calibration. Rows are `{ key, value }` with `value` a JSON string. Anything that does
 * not parse, or is not a `cost:ai:` / `cost:dfs:` row for an estimate key this table knows, is ignored — the engine also keeps model
 * factors in the same kind and they are none of the app's business.
 */
export function parseCalibration(rows: ReadonlyArray<{ key?: unknown; value?: unknown }>): EngineCalibration {
  const cal: EngineCalibration = { ai: {}, dfs: {} };
  for (const row of rows ?? []) {
    const m = String(row?.key ?? '').match(/^cost:(ai|dfs):(.+)$/);
    if (!m || !(m[2] in COST_TABLE)) continue;
    let v: Record<string, unknown> = {};
    try {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (parsed && typeof parsed === 'object') v = parsed as Record<string, unknown>;
    } catch {
      continue;
    }
    cal[m[1] as CostKind][m[2] as CostKey] = {
      n: finite(v.n),
      mean: finite(v.mean),
      max: finite(v.max),
      recent: Array.isArray(v.recent) ? v.recent.map(finite) : [],
    };
  }
  return cal;
}

/**
 * What the engine reserves for ONE estimate key and kind — `_cost_cal.js` `estOf`, same formula: the shipped default until the key has
 * history; then the rolling mean x 1.25 (never above five times the default), and never below the most the key recently cost.
 */
export function estOf(kind: CostKind, key: CostKey, cal?: EngineCalibration | null): { usd: number; calibrated: boolean } {
  const def = COST_TABLE[key][kind];
  const st = cal?.[kind]?.[key];
  if (!st || !st.n) return { usd: def, calibrated: false };
  const recentMax = Math.max(st.max, ...st.recent);
  const rolling = round(st.mean * HEADROOM);
  const capped = def > 0 ? Math.min(rolling, def * CAP) : rolling;
  return { usd: round(Math.max(capped, recentMax)), calibrated: true };
}

/** What the engine reserves for one estimate key (Claude + search data): its calibrated figure when `cal` is given, else the shipped default. */
export const keyCost = (key: CostKey, cal?: EngineCalibration | null): number => round(estOf('ai', key, cal).usd + estOf('dfs', key, cal).usd);

type Values = Record<string, unknown>;
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** pages written straight away by a ladder run (the form allows 1-3) */
const pagesNow = (v: Values): number => Math.min(3, Math.max(1, num(v.pagesNow, 1)));

/**
 * Which estimate keys one request uses — the app's half of the engine's `keysFor`, written against the app's own form values
 * instead of the engine's payload flags. A key listed here is a run the engine will reserve for, whether it runs inside this
 * execution or is spawned as its own.
 */
export function costKeys(mode: ModeId, v: Values = {}): CostKey[] {
  switch (mode) {
    case 'verdict':
      return ['verdict'];
    case 'keyword':
      // "Write a page" writes one; without it the run stops at the keyword report
      return v.receiveContent === false ? ['report'] : ['content'];
    case 'ladder': {
      // the plan, then one content run per page the owner asked for now (the engine reserves each spawn separately)
      const keys: CostKey[] = ['ladder'];
      for (let i = 0; i < pagesNow(v); i++) keys.push('content');
      return keys;
    }
    case 'audit':
      return v.reportType === 'full' ? ['full'] : ['site_audit', 'crawl'];
    case 'discover': {
      // the strategy, then the follow-ups it starts: a keyword report on the best keyword, a page, an audit
      const keys: CostKey[] = ['discover'];
      if (v.receiveReport !== false) keys.push('report');
      if (v.receiveContent === true) keys.push('content');
      if (v.fullReport === true) keys.push('full');
      else if (v.siteAudit === true) keys.push('site_audit', 'crawl');
      return keys;
    }
    case 'backlinks':
      return v.freeOnly === true ? [] : ['backlinks'];   // v4.10: the free sources cost nothing
    case 'case_study':
      // the intake reserves nothing; the case-study page it writes is a content run (the engine holds the same room for it)
      return ['case_study', 'content'];
    default:
      return [mode as CostKey];
  }
}

/**
 * The app's pre-flight figure for one run, summed over the runs this request starts. With `cal` (the engine's own rolling figures, R100)
 * it is what the engine will reserve; without it, the shipped defaults — the fallback, and what `MODES[].costUsd` shows.
 */
export function estimateRunCost(mode: ModeId, v: Values = {}, cal?: EngineCalibration | null): number {
  const keys = costKeys(mode, v);
  return round(keys.reduce((total, key) => total + keyCost(key, cal), 0) + crawlExtra(mode, v, keys, cal));
}

/**
 * B-9 (re-rating 2026-10-17): the crawl row is ONE 200-page crawl without JavaScript, whatever the audit asked for. Exec 739 asked for a
 * JavaScript crawl ($0.36 quoted for 200 pages, 4x a plain one) and was shown $0.11. DataForSEO charges per crawled page, so an audit's
 * crawl scales with the pages it may crawl and x4 with JavaScript — the engine's `CC.crawlFactor` (`_cost_cal.js`), constant for constant.
 */
export const CRAWL_BASE_PAGES = 200;
export const CRAWL_JS_MULT = 4;
export function crawlFactor(pages?: unknown, js?: unknown): number {
  const n = typeof pages === 'number' && Number.isFinite(pages) && pages > 0 ? pages : CRAWL_BASE_PAGES;
  return Math.round((n / CRAWL_BASE_PAGES) * (js === true ? CRAWL_JS_MULT : 1) * 10000) / 10000;
}
/** What scaling the crawl adds to an audit's search-data figure (0 for every other mode, and for a 200-page plain crawl). */
function crawlExtra(mode: ModeId, v: Values, keys: CostKey[], cal?: EngineCalibration | null): number {
  if (mode !== 'audit') return 0;
  const f = crawlFactor(v.crawlPages, v.crawlJs);
  if (f === 1) return 0;
  let extra = 0;
  if (keys.includes('crawl')) extra += estOf('dfs', 'crawl', cal).usd * (f - 1);
  if (keys.includes('full')) extra += COST_TABLE.crawl.dfs * (f - 1);
  return extra;
}

/** The same request priced the way the engine splits it, for a breakdown the customer can read. */
export function estimateRunCostParts(mode: ModeId, v: Values = {}, cal?: EngineCalibration | null): { ai: number; dfs: number; usd: number; keys: CostKey[] } {
  const keys = costKeys(mode, v);
  const ai = round(keys.reduce((t, k) => t + estOf('ai', k, cal).usd, 0));
  const dfs = round(keys.reduce((t, k) => t + estOf('dfs', k, cal).usd, 0) + crawlExtra(mode, v, keys, cal));
  return { ai, dfs, usd: round(ai + dfs), keys };
}

/** What `MODES[mode].costUsd` says, so the mode list and this table can never disagree. */
export const modeCostUsd = (mode: ModeId, cal?: EngineCalibration | null): number => estimateRunCost(mode, {}, cal);

// ---------------------------------------------------------------------------------------------------------------------------
// Which figure to show, and whose it is
// ---------------------------------------------------------------------------------------------------------------------------

/** Where a cost figure came from. `measured` and `engine` are the engine's; `app` is this table, which is only ever an estimate. */
export type CostSource = 'measured' | 'partial' | 'engine' | 'app';

export interface CostFigure {
  usd: number;
  source: CostSource;
  /** true unless the engine settled the run against what it really spent */
  estimated: boolean;
  /** one sentence a person can read, naming what the figure is and where it came from */
  basis: string;
}

export interface RunCostInput {
  mode: ModeId;
  input?: Values | null;
  /** what the app reserved before the run (this table) */
  estimatedCostUsd?: number | null;
  /** what the engine settled the run at, from `run_ledger` on the callback */
  actualCostUsd?: number | null;
  /** the engine's own calibrated reservation, `run_cost_estimate_usd` on the callback */
  engineCostEstimateUsd?: number | null;
  engineCostBasis?: string | null;
  /** true when part of the settled figure is the engine's own character-based estimate (streaming Claude calls report no usage) */
  actualCostEstimated?: boolean | null;
  /** R102 / R115: the settled figure has no model-call part (the run did not report its model calls): it is not the run's whole cost */
  actualCostPartial?: boolean | null;
}

/**
 * The one figure to show for a run, and whose it is.
 *
 * Order, and the reason for it: **what it cost** beats **what the engine reserved** beats **what we guessed**. The app's own table is
 * the last resort and is never allowed to override a number the engine has published, because the engine's is calibrated on measured
 * runs and ours is a mirror of its defaults.
 */
export function runCostEstimate(r: RunCostInput): CostFigure {
  const actual = typeof r.actualCostUsd === 'number' && Number.isFinite(r.actualCostUsd) && r.actualCostUsd > 0 ? r.actualCostUsd : null;
  const engineWhole = typeof r.engineCostEstimateUsd === 'number' && Number.isFinite(r.engineCostEstimateUsd) && r.engineCostEstimateUsd >= 0 ? r.engineCostEstimateUsd : null;
  // a figure without the model calls is never "actual": when the engine published its own whole-run estimate and it is higher, that is the
  // better statement of what the run cost; otherwise show the search-data figure and say plainly what is missing
  if (actual != null && r.actualCostPartial && !(engineWhole != null && engineWhole > actual))
    return { usd: actual, source: 'partial', estimated: true, basis: PARTIAL_BASIS };
  if (actual != null && !r.actualCostPartial)
    return {
      usd: actual,
      source: 'measured',
      estimated: !!r.actualCostEstimated,
      basis: r.actualCostEstimated
        ? 'What this run reported spending. Part of it is the engine’s own estimate: the model calls that stream report no token usage, so they are priced from the text instead.'
        : 'What this run reported spending, from the search-data tasks it paid for and the model calls it made.',
    };
  const engine = typeof r.engineCostEstimateUsd === 'number' && Number.isFinite(r.engineCostEstimateUsd) && r.engineCostEstimateUsd >= 0 ? r.engineCostEstimateUsd : null;
  if (engine != null)
    return {
      usd: engine,
      source: 'engine',
      estimated: true,
      basis: r.engineCostBasis
        ? `The engine’s own estimate for this run (${String(r.engineCostBasis).slice(0, 300)}).${r.actualCostPartial ? ' The run reported search-data costs only, which is less than this.' : ''}`
        : `The engine’s own estimate for this run, from what runs of this kind have recently cost.${r.actualCostPartial ? ' The run reported search-data costs only, which is less than this.' : ''}`,
    };
  const app = typeof r.estimatedCostUsd === 'number' && Number.isFinite(r.estimatedCostUsd) ? r.estimatedCostUsd : estimateRunCost(r.mode, r.input ?? {});
  return { usd: app, source: 'app', estimated: true, basis: APP_ESTIMATE_BASIS };
}

/**
 * What one run counts for against the budget and in the usage page: what it reported spending, then the engine's calibrated figure,
 * then ours — except that a figure with no model-call part (R102 / R115) never counts for less than the best whole-run estimate,
 * because the budget would then hold a number the run is known to exceed. `spend.ts` holds the same rule in SQL.
 */
export function countedRunCost(r: { actual: number | null; partial?: boolean | null; engine: number | null; own: number }): number {
  const whole = r.engine ?? r.own;
  if (r.actual == null) return whole;
  return r.partial ? Math.max(r.actual, whole) : r.actual;
}

/** One part of a run's cost as a report card states it: the amount (null = not reported) and whose figure it is. */
export interface LedgerPart {
  usd: number | null;
  /** 'measured' | 'estimated' | 'partly estimated' | 'not reported' */
  state: 'measured' | 'estimated' | 'partly estimated' | 'not reported';
  note: string;
}
export interface LedgerBreakdown {
  data: LedgerPart;
  model: LedgerPart;
  /** search data plus model calls when both are known; the search-data figure alone is `partial` */
  total: number | null;
  partial: boolean;
}

const fnum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * R114: what a report's "Run ledger" card says — search data AND model calls, the total, and whose each figure is. A ledger with no
 * model-call figure (`ai_usd` absent) says "not reported" rather than showing a total that looks complete; `ai_usd: 0` is a real $0.
 * A crawl's price is a provider quote (`dataforseo_estimated_usd`): the search-data line then reads "partly estimated".
 */
export function ledgerBreakdown(ledger: unknown, extraCost?: number | null): LedgerBreakdown {
  const l = rec(ledger);
  const dfs = fnum(l.dataforseo_usd) ?? (extraCost != null ? extraCost : null);
  const dfsEst = fnum(l.dataforseo_estimated_usd) ?? 0;
  const aiCost = rec(l.ai_cost);
  const ai = fnum(l.ai_usd) ?? fnum(aiCost.usd);
  const aiEstFlag = l.ai_cost_estimated === true || aiCost.estimated === true;
  const aiEst = fnum(aiCost.estimated_usd);
  const aiMeasured = fnum(aiCost.measured_usd);

  const data: LedgerPart =
    dfs == null
      ? { usd: null, state: 'not reported', note: 'This run did not report its search-data cost.' }
      : dfsEst > 0
        ? { usd: dfs, state: dfsEst >= dfs ? 'estimated' : 'partly estimated', note: `$${dfsEst.toFixed(4)} of it is the provider’s quote for a crawl, not the pages really crawled.` }
        : { usd: dfs, state: 'measured', note: 'What the search-data provider charged for the tasks this run paid for.' };

  let model: LedgerPart;
  if (ai == null) model = { usd: null, state: 'not reported', note: 'This run did not report its model calls, so the total is search data only.' };
  else if (ai === 0) model = { usd: 0, state: 'measured', note: 'This run made no paid model call.' };
  else if (aiEstFlag && (aiMeasured ?? 0) > 0 && (aiEst ?? 0) > 0) model = { usd: ai, state: 'partly estimated', note: `$${aiMeasured!.toFixed(4)} measured from reported usage, $${aiEst!.toFixed(4)} estimated (model calls that stream report no usage).` };
  else if (aiEstFlag) model = { usd: ai, state: 'estimated', note: 'Priced from the text: model calls that stream report no token usage.' };
  else model = { usd: ai, state: 'measured', note: 'Priced from the token usage the model calls reported.' };

  const partial = ai == null;
  const total = dfs == null && ai == null ? null : (dfs ?? 0) + (ai ?? 0);
  return { data, model, total, partial };
}

/** R100: the pre-run prices the app shows and the budget holds, and where they came from. */
export interface CostTableInfo {
  /** 'engine' = the engine's own rolling figures, read from its store; 'table' = n8n could not be read, the shipped defaults are used */
  source: 'engine' | 'table';
  /** when the engine's figures were read (ISO), or null for the shipped table */
  asOf: string | null;
  /** one sentence a person can read */
  basis: string;
  calibration: EngineCalibration;
}

export const PARTIAL_BASIS =
  'Search data only — this run did not report its model calls, so what it really cost is higher than this figure.';

export const APP_ESTIMATE_BASIS =
  'An estimate from what runs of this kind recently cost. The engine replaces it with its own figure as soon as the run starts, and with what the run really spent when it finishes.';

/** The short label beside a figure, so an estimate is never mistaken for a bill. */
export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  measured: 'actual',
  partial: 'search data only',
  engine: 'estimated by the engine',
  app: 'estimated',
};
