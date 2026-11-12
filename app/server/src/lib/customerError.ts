/**
 * credits (app/docs/CREDITS.md): a customer never reads what the work costs us at the providers, nor which provider it is. Engine
 * refusals can say exactly that, `_run_guard.js` `account_low`: "The search-data account is too low for this run ($0.42 left; ...)",
 * the spend guard's "AI budget of $15 per day reached", a provider's own error text. Such a text is replaced by one plain sentence
 * wherever a customer reads a run's error (the app, API v1 / MCP, webhooks, exports); the raw text stays in the database for the
 * platform admin panel.
 */
export const CAPACITY_ERROR = 'This analysis could not start right now because of a temporary capacity limit. It was not charged. Please try again later.';

/** a dollar amount, a USD figure, or a provider / provider account named */
const PROVIDER_TEXT = /\$\s?\d|\d\s?\$|\bUSD\b|data\s?for\s?seo|\bclaude\b|anthropic|search[- ]data account/i;

export const namesProviderCost = (text: string | null | undefined): boolean => !!text && PROVIDER_TEXT.test(text);

/**
 * Prod review 2026-11-12 (S2-08): a run the engine's failure watcher closed (services/engineFailures.ts) carried the node's name, the raw
 * model or n8n error, the execution id and "the operator can open that execution in n8n" into the client's runs list. A client reads
 * what happened, that it was not charged and what to do; the technical text stays in the database for the platform admin panel (and is
 * sent to platform admins as `errorDetail`).
 */
export const ENGINE_STOPPED_ERROR =
  'This run stopped because of a problem on our side, so nothing was delivered. No credits are charged for it. Start it again; if it stops again, contact us and we will look into it.';
export const ENGINE_NO_RESULT_ERROR =
  'No result arrived from the SEO engine in time, so nothing was delivered. No credits are charged for it. Start it again.';
/** the technical tail the watcher appends: "(n8n execution 13196)", "(n8n execution 6569, crashed)" */
const EXEC_SUFFIX = /\s*\((?:n8n\s+)?execution\b[^)]*\)/gi;
/** our workflow tool, an instruction meant for us, a node name, a raw model / parser / runtime / network error */
const TECHNICAL = /\bn8n\b|\bthe operator\b|\bexecution\s+\d+|^the seo engine stopped with an error|\bmodel output\b|\boutput parser\b|\bparser\b|\b(TypeError|ReferenceError|SyntaxError|RangeError)\b|\bECONN[A-Z]+\b|\bETIMEDOUT\b|\bEAI_AGAIN\b|\bcannot read propert|\bstack trace\b|\bnode "/i;

/** does this run error carry technical text a client must not read? */
export const isTechnicalError = (text: string | null | undefined): boolean => !!text && TECHNICAL.test(text.replace(EXEC_SUFFIX, ''));

/** words meant for us, not the client: our tool's name as a prefix, the instruction to the operator */
const FOR_US = [/^n8n\s*:\s*/i, /\s*Start it again; if it repeats, the operator can open that execution in n8n\.?/gi, /,?\s*or check its execution in n8n\.?/gi];

/** a run's error as a customer reads it: a provider or a dollar amount reads as a capacity limit, technical text as one plain sentence */
export function customerError(text: string | null | undefined): string | null {
  if (text == null) return null;
  if (namesProviderCost(text)) return CAPACITY_ERROR;
  // review N3: a plain reason behind our tool's name ("n8n: crawl timed out") stays readable; only what is left decides
  const plain = FOR_US.reduce((t, re) => t.replace(re, ''), text.replace(EXEC_SUFFIX, '')).trim();
  if (!plain) return ENGINE_STOPPED_ERROR;
  if (/^no result arrived from the seo engine in time/i.test(plain)) return ENGINE_NO_RESULT_ERROR;
  if (TECHNICAL.test(plain)) return ENGINE_STOPPED_ERROR;
  return plain;
}
