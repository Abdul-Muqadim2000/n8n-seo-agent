import { estimateRunCost as est, formatUsd, keyCost as kc, MONITOR_COSTS, type CostKey, type ModeId } from '@seo/shared';
import { engineCal } from './engine-cal';

// R100: every figure follows the engine's own calibration when the app could read it (lib/engine-cal.ts), the shipped table otherwise
const keyCost = (k: CostKey) => kc(k, engineCal());
const estimateRunCost = (m: ModeId, v: Record<string, unknown> = {}) => est(m, v, engineCal());

/**
 * Prices shown inside sentences, all read from the shared cost table (`@seo/shared` cost.ts, which follows the engine's own
 * calibration) so one run shows one figure on every screen. Never type a "$0.00" literal into a component (R99, CONVENTIONS.md).
 */
const usd = (n: number) => formatUsd(n);

export const PRICES = {
  /** one written page (a content run) */
  page: () => usd(keyCost('content')),
  /** a keyword report without the page */
  report: () => usd(keyCost('report')),
  /** one keyword check (difficulty for your site) */
  check: () => usd(keyCost('assess')),
  /** the ladder plan alone (research and feasibility) */
  plan: () => usd(keyCost('ladder')),
  /** plan + the first page: the cheapest way to start a ladder */
  ladderStart: () => usd(estimateRunCost('ladder', { pagesNow: 1 })),
  /** keyword research on its own (no follow-up report) */
  research: () => usd(estimateRunCost('discover', { receiveReport: false })),
  /** the follow-ups keyword discovery can start */
  followTechnical: () => usd(keyCost('site_audit') + keyCost('crawl')),
  followFull: () => usd(keyCost('full')),
  /** the standalone audit forms */
  auditTechnical: () => usd(estimateRunCost('audit', { reportType: 'site_audit' })),
  auditFull: () => usd(estimateRunCost('audit', { reportType: 'full' })),
  /** the full backlink check (the monthly run) */
  backlinksFull: () => usd(keyCost('backlinks')),
  /** the Link Builder over a month */
  linkBuilderMonthly: () => usd(MONITOR_COSTS.linkBuilderMonthly),
  /** extra cost of writing `n` pages now */
  pages: (n: number) => usd(n * keyCost('content')),
};
