import { creditRate, DEFAULT_PLATFORM_SETTINGS, formatCredits } from '@seo/shared';
import { engineCreditRate } from './engine-cal';

/**
 * Credits (app/docs/CREDITS.md): customers never see what a run costs us at the providers, every price, forecast and figure on a
 * customer screen is in credits. The cost figures the app computes (the shared cost table, the engine's calibration, the schedules'
 * breakdown) are turned into credits here, with the company's credit rate (credits per unit of cost, from GET /costs via
 * `useEngineCal`), the platform default until it arrives. Never render `formatUsd` of a cost on a customer screen (CONVENTIONS.md).
 */
const DEFAULT_RATE = creditRate(DEFAULT_PLATFORM_SETTINGS);
const rate = () => engineCreditRate() ?? DEFAULT_RATE;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** credits for a cost figure (exact, 2 decimals): forecasts, breakdowns, usage */
export const toCredits = (cost: number | null | undefined): number => (cost != null && Number.isFinite(cost) && cost > 0 ? r2(cost * rate()) : 0);

/** the whole credits an analysis is quoted at, the server's own rounding (services/billing.ts `quoteCredits`): never 0 for paid work */
export const quoteCredits = (cost: number | null | undefined): number => {
  const c = toCredits(cost);
  return c > 0 ? Math.max(1, Math.ceil(c - 1e-9)) : 0;
};

/** "12 credits" for an analysis about to start (its quote) */
export const quoteLabel = (cost: number | null | undefined): string => formatCredits(quoteCredits(cost));

/** "51 credits" for a forecast / monthly figure / anything that is not a quote */
export const creditsLabel = (cost: number | null | undefined, opts?: Parameters<typeof formatCredits>[1]): string => formatCredits(toCredits(cost), opts);

export { formatCredits };
