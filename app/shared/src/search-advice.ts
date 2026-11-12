import { fitGate, fitOwnLabels, fitTokens, type FitContext, type FitResult } from './fit-gate';

// F-10 (prod review 2026-10-31 / 2026-11-12): the Recommendations page told a client to "Move 'otherbrand com' into the top 3" (another
// company's address, 264 impressions) and to push its own brand name up, because the Search Console lists it reads had no gate at all.
// Every keyword the page advises on now passes the same fit gate the cadence, the ladder and the research use (the engine's kit,
// fit-gate.generated.js), plus two checks the kit cannot make without a results page:
// - a search for one website by its address ("zylo com", "zylo.com", "www zylo"): people want that site, not a page of yours;
// - the website's own brand names as the client typed them ("Northwind Trading"): people already looking for you. A brand name counts by
//   its distinctive part only (the gate's own rule for domain labels), so "ERP Experts" never refuses "erp experts dubai".

export interface SearchAdviceSite {
  /** the website's domain (its own label is the gate's "own brand") */
  domain: string;
  /** the client's own brand names */
  brandNames?: readonly string[];
  /** declared competitors (domains) */
  competitors?: readonly string[];
  /** what the client said it sells ("What do you sell?") */
  services?: readonly string[];
  /** the keywords the client chose: ladder heads and their pages */
  chosen?: readonly string[];
}

const S = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const low = (v: unknown) => S(v).toLowerCase();

// "zylo com", "zylo com pk", "zylo co uk" ("net" is left out: "asp net" is a subject, not an address)
const ADDRESS_TAIL = /(?:^|\s)(?:com|org|biz|info)(?:\s[a-z]{2})?$|(?:^|\s)co\s[a-z]{2}$/;
// "zylo.com", "www.zylo.ae/pricing" (a top-level domain people type; "node.js" and "asp.net" are subjects, not addresses)
const HOST_TOKEN = /(?:^|\s)(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|io|ai|co|ae|sa|pk|qa|om|kw|bh|eg|in|uk|us|de|fr|biz|info)(?:\/\S*)?(?=\s|$)/;

/** a search for one website by its address: the label typed, or '' */
export function addressSearchLabel(query: string): string {
  const q = low(query);
  if (!q) return '';
  const host = q.match(HOST_TOKEN);
  if (host) return host[0].trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[./]/)[0];
  if (/^www(\s|\.|$)/.test(q)) return q.replace(/^www[\s.]*/, '').split(/[\s.]/)[0] || 'www';
  const tail = q.match(ADDRESS_TAIL);
  if (tail) {
    const rest = q.slice(0, tail.index).trim();
    const words = rest.split(' ').filter(Boolean);
    if (words.length >= 1 && words.length <= 2) return words.join('');
  }
  return '';
}

const STOP = new Set(['the', 'a', 'an', 'al', 'el', 'my', 'our']);

/** the distinctive labels of the client's brand names, judged against one keyword's words (the gate's own rule) */
function brandLabels(brandNames: readonly string[], toks: string[], protect: string[]): string[] {
  const out = new Set<string>();
  for (const b of brandNames) {
    const words = fitTokens(b).filter((w) => !STOP.has(w));
    if (!words.length) continue;
    for (const cand of [words.join(''), words[0]]) for (const l of fitOwnLabels(`${cand}.example`, toks, protect)) out.add(l);
  }
  return [...out];
}

/** The fit context of a website's advice: its own domain, competitors, what it sells and the keywords it chose (protected, and its topics). */
export function searchAdviceContext(site: SearchAdviceSite): FitContext {
  const services = [...new Set((site.services ?? []).map(S).filter(Boolean))];
  const chosen = [...new Set((site.chosen ?? []).map(S).filter(Boolean))];
  const topics = [...new Set([...chosen, ...services])];
  return {
    own_domain: low(site.domain),
    competitors: [...new Set((site.competitors ?? []).map(low).filter((d) => d && d !== low(site.domain)))].slice(0, 8),
    services,
    protect: topics,
    topics: topics.length ? topics : null,
    topic_label: 'what this website sells and the keywords you chose',
  };
}

/**
 * Is this a search the website should be advised to work on? The shared fit gate, the address search and the client's brand names.
 * Returns the gate's shape: { ok: true } or { ok: false, reason, detail }.
 */
export function searchAdviceFit(query: string, site: SearchAdviceSite, ctx: FitContext = searchAdviceContext(site)): FitResult {
  const q = low(query);
  const label = addressSearchLabel(q);
  if (label) {
    const own = low(site.domain).replace(/^www\./, '').split('.')[0];
    return label === own || (own.length >= 4 && label.includes(own))
      ? { ok: false, reason: 'own brand', detail: `people looking for your own website by its address (${S(query)})` }
      : { ok: false, reason: 'navigational', detail: `people looking for one website by its address (${S(query)}), not for what you sell` };
  }
  const toks = fitTokens(q);
  const squashed = toks.join('');
  const protect = (ctx.protect ?? []).flatMap((p) => fitTokens(p));
  for (const l of brandLabels(site.brandNames ?? [], toks, protect))
    if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: `people already looking for you by name (${l})` };
  return fitGate(query, ctx);
}

/** One gate for a whole list: the predicate, and what it refused (with the reason) for anyone who wants to say so. */
export function searchAdviceGate(site: SearchAdviceSite): { ok: (query: string) => boolean; refused: Map<string, FitResult> } {
  const ctx = searchAdviceContext(site);
  const seen = new Map<string, FitResult>();
  const refused = new Map<string, FitResult>();
  return {
    refused,
    ok: (query: string) => {
      const k = low(query);
      let r = seen.get(k);
      if (!r) {
        r = searchAdviceFit(query, site, ctx);
        seen.set(k, r);
        if (!r.ok) refused.set(k, r);
      }
      return r.ok;
    },
  };
}
