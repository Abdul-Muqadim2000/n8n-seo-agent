import { estimateRunCost as est, estimateRunMinutes, keyCost as kc, MONITOR_COSTS, type CostKey, type ModeId } from '@seo/shared';
import { creditsLabel, quoteLabel } from './credits';
import { engineCal } from './engine-cal';

// R100: every figure follows the engine's own calibration when the app could read it (lib/engine-cal.ts), the shipped table otherwise
const keyCost = (k: CostKey) => kc(k, engineCal());
const estimateRunCost = (m: ModeId, v: Record<string, unknown> = {}) => est(m, v, engineCal());

/**
 * D-2 (re-rating 2026-10-17): the price and the time of one run, for every screen that names a mode, the tools cards, the
 * onboarding launch step, the queue, computed exactly as the tool form and the server's credit check compute them. `MODES[].costUsd` is the
 * shipped table and `MODES[].etaMinutes` the bare base time; neither may be shown as a run's price or duration.
 */
export const runCost = (mode: ModeId, values: Record<string, unknown> = {}): number => estimateRunCost(mode, values);
export const runMinutes = (mode: ModeId, values: Record<string, unknown> = {}): number => estimateRunMinutes(mode, values);

/**
 * Prices shown inside sentences, all read from the shared cost table (`@seo/shared` cost.ts, which follows the engine's own
 * calibration) so one run shows one figure on every screen, in credits. Never type a price literal into a component (R99, CONVENTIONS.md).
 */
// credits (app/docs/CREDITS.md): every sentence names the price in credits, an analysis at its quote, a monthly figure as is
const quote = (n: number) => quoteLabel(n);
const perMonth = (n: number) => creditsLabel(n);

export const PRICES = {
  /** one written page (a content run) */
  page: () => quote(keyCost('content')),
  /** a keyword report without the page */
  report: () => quote(keyCost('report')),
  /** one keyword check (difficulty for your site) */
  check: () => quote(keyCost('assess')),
  /** the ladder plan alone (research and feasibility) */
  plan: () => quote(keyCost('ladder')),
  /** plan + the first page: the cheapest way to start a ladder */
  ladderStart: () => quote(estimateRunCost('ladder', { pagesNow: 1 })),
  /** keyword research on its own (no follow-up report) */
  research: () => quote(estimateRunCost('discover', { receiveReport: false })),
  /** the follow-ups keyword discovery can start */
  followTechnical: () => quote(keyCost('site_audit') + keyCost('crawl')),
  followFull: () => quote(keyCost('full')),
  /** the standalone audit forms */
  auditTechnical: () => quote(estimateRunCost('audit', { reportType: 'site_audit' })),
  auditFull: () => quote(estimateRunCost('audit', { reportType: 'full' })),
  /** the full backlink check (the monthly run) */
  backlinksFull: () => quote(keyCost('backlinks')),
  /** the Link Builder over a month */
  linkBuilderMonthly: () => perMonth(MONITOR_COSTS.linkBuilderMonthly),
  /** the extra credits of writing `n` pages now */
  pages: (n: number) => quote(n * keyCost('content')),
};
