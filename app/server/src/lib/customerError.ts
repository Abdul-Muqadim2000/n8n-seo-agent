/**
 * credits (app/docs/CREDITS.md): a customer never reads what the work costs us at the providers, nor which provider it is. Engine
 * refusals can say exactly that — `_run_guard.js` `account_low`: "The search-data account is too low for this run ($0.42 left; …)",
 * the spend guard's "AI budget of $15 per day reached", a provider's own error text. Such a text is replaced by one plain sentence
 * wherever a customer reads a run's error (the app, API v1 / MCP, webhooks, exports); the raw text stays in the database for the
 * platform admin panel.
 */
export const CAPACITY_ERROR = 'This analysis could not start right now because of a temporary capacity limit. It was not charged. Please try again later.';

/** a dollar amount, a USD figure, or a provider / provider account named */
const PROVIDER_TEXT = /\$\s?\d|\d\s?\$|\bUSD\b|data\s?for\s?seo|\bclaude\b|anthropic|search[- ]data account/i;

export const namesProviderCost = (text: string | null | undefined): boolean => !!text && PROVIDER_TEXT.test(text);

/** a run's error as a customer reads it: unchanged, unless it names a dollar amount or a provider */
export function customerError(text: string | null | undefined): string | null {
  if (text == null) return null;
  return namesProviderCost(text) ? CAPACITY_ERROR : text;
}
