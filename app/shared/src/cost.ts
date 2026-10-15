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

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** What the engine reserves for one estimate key (Claude + search data). */
export const keyCost = (key: CostKey): number => round(COST_TABLE[key].ai + COST_TABLE[key].dfs);

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

/** The app's pre-flight figure for one run: the engine's own calibrated defaults, summed over the runs this request starts. */
export function estimateRunCost(mode: ModeId, v: Values = {}): number {
  return round(costKeys(mode, v).reduce((total, key) => total + keyCost(key), 0));
}

/** The same request priced the way the engine splits it, for a breakdown the customer can read. */
export function estimateRunCostParts(mode: ModeId, v: Values = {}): { ai: number; dfs: number; usd: number; keys: CostKey[] } {
  const keys = costKeys(mode, v);
  const ai = round(keys.reduce((t, k) => t + COST_TABLE[k].ai, 0));
  const dfs = round(keys.reduce((t, k) => t + COST_TABLE[k].dfs, 0));
  return { ai, dfs, usd: round(ai + dfs), keys };
}

/** What `MODES[mode].costUsd` says, so the mode list and this table can never disagree. */
export const modeCostUsd = (mode: ModeId): number => estimateRunCost(mode, {});

// ---------------------------------------------------------------------------------------------------------------------------
// Which figure to show, and whose it is
// ---------------------------------------------------------------------------------------------------------------------------

/** Where a cost figure came from. `measured` and `engine` are the engine's; `app` is this table, which is only ever an estimate. */
export type CostSource = 'measured' | 'engine' | 'app';

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
  if (actual != null)
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
        ? `The engine’s own estimate for this run (${String(r.engineCostBasis).slice(0, 300)}).`
        : 'The engine’s own estimate for this run, from what runs of this kind have recently cost.',
    };
  const app = typeof r.estimatedCostUsd === 'number' && Number.isFinite(r.estimatedCostUsd) ? r.estimatedCostUsd : estimateRunCost(r.mode, r.input ?? {});
  return { usd: app, source: 'app', estimated: true, basis: APP_ESTIMATE_BASIS };
}

export const APP_ESTIMATE_BASIS =
  'An estimate from what runs of this kind recently cost. The engine replaces it with its own figure as soon as the run starts, and with what the run really spent when it finishes.';

/** The short label beside a figure, so an estimate is never mistaken for a bill. */
export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  measured: 'actual',
  engine: 'estimated by the engine',
  app: 'estimated',
};
