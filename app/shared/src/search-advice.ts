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

// Address searches (review S2, 2026-11-12): only a short search that is plainly an address, with a label that is a name (the gate's label
// rule: 4+ letters, not a generic, category or place word, not a word of what the client sells):
// - the whole search is a host: "zylo.com", "www.zylo.ae/pricing", "devassistant.ai" ("socket.io developers", "zoho.in pricing" and
//   "gen.ai course" are searches about a product; "invoice.ai" has no name in it);
// - a name followed by com / net / org, or by "co" and a country ("zylo com", "zylo com pk", "zylo co uk"); org only after one word
//   ("non profit org" is a subject); "info", "io" and "ai" never ("vat info", "generative ai");
// - "www" and one name ("www zylo").
const CC = 'uk|ae|in|za|nz|au|pk|sa|qa|om|kw|bh|eg|jp|sg|my';
const HOST_ONLY = new RegExp(`^(?:https?://)?(?:www\\.)?([a-z0-9-]+)\\.(?:com|net|org|io|ai|co|ae|sa|pk|qa|om|kw|bh|eg|in|uk|us|de|fr)(?:\\.(?:${CC}))?(?:/\\S*)?$`);
const NAME_TAIL = new RegExp(`^(\\S+(?:\\s\\S+)?)\\s(com|net|org|co)(?:\\s(${CC}))?$`);

/** the label of a search for one website by its address ('' when the search is not one). `protect`: words of what the client sells. */
export function addressSearchLabel(query: string, protect: readonly string[] = [], ownLabel = ''): string {
  let q = low(query);
  if (!q) return '';
  const www = /^www(\s|\.)/.test(q) && !/^www\.[a-z0-9-]+\.[a-z]/.test(q) ? (q = q.replace(/^www[\s.]+/, ''), true) : false;
  let label = '';
  const host = q.match(HOST_ONLY);
  if (host) label = host[1];
  else {
    const t = q.match(NAME_TAIL);
    if (t) {
      const words = t[1].split(' ');
      const tld = t[2];
      if ((tld === 'co' && t[3]) || (tld !== 'co' && (tld !== 'org' || words.length === 1))) label = words.join('');
    } else if (www && /^[a-z0-9-]+$/.test(q)) label = q;
  }
  if (!label) return '';
  if (ownLabel && ownLabel.length >= 4 && label.startsWith(ownLabel)) return label;
  return label.replace(/-/g, '').length >= 4 && fitOwnLabels(`${label}.example`, [], [...protect]).length ? label : '';
}

const STOP = new Set(['the', 'a', 'an', 'al', 'el', 'my', 'our', 'and', 'of', '&']);
/** everyday words a business name is often built from: alone they never stand for the client's brand ("Prime", "Blue", "Apex") */
const COMMON_NAME_WORDS = new Set([
  'blue', 'red', 'green', 'black', 'white', 'gold', 'golden', 'silver', 'prime', 'apex', 'alpha', 'beta', 'delta', 'omega', 'dynamics', 'dynamic',
  'smart', 'global', 'digital', 'united', 'first', 'best', 'star', 'stars', 'sun', 'sky', 'ocean', 'royal', 'national', 'modern', 'future', 'next',
  'bright', 'true', 'open', 'quick', 'fast', 'cloud', 'data', 'soft', 'info', 'tech', 'net', 'link', 'core', 'peak', 'summit', 'vision', 'nova',
  'pro', 'max', 'plus', 'one', 'square', 'circle', 'bridge', 'pioneer', 'elite', 'premier', 'master', 'express', 'direct', 'simple', 'clear',
  'fusion', 'matrix', 'vertex', 'zenith', 'orbit', 'nexus', 'quantum', 'infinity', 'horizon', 'atlas', 'titan', 'eagle', 'falcon', 'lion',
  'tiger', 'arrow', 'rock', 'stone', 'pearl', 'crystal', 'diamond', 'phoenix', 'unity', 'trust', 'value', 'smartway', 'mega', 'micro',
]);

/**
 * The client's brand name a search names, or '' (review S1, 2026-11-12). Whole words only, never a piece of another word:
 * - the whole name ("northwind trading reviews");
 * - the name written as one word, 6+ letters and a name (the gate's label rule), as a word or the start of one ("zentrovakey" for "Zentrova");
 * - its distinctive words together ("blue ocean" of "Blue Ocean Consulting"); when one distinctive word is left and it is not an everyday
 *   word, that word leading the search ("kestrel erp" for "Kestrel Labs"). "blue prism", "amazon prime", "oracle apex", "data alphabet"
 *   and "dynamics 365 partner" never match "Blue Ocean", "Prime Systems", "Apex", "Alpha Data" or "Dynamics Square".
 */
export function brandNamed(toks: readonly string[], brandNames: readonly string[], protect: readonly string[]): string {
  const text = ` ${toks.join(' ')} `;
  // a word that is a name: 4+ letters, not a word of what the client sells, and not a generic, category or place word of the gate. The
  // gate never counts a label as its own vocabulary, so the word is judged doubled ("labslabs" breaks into "labs" + "labs": a category word)
  const named = (w: string) => w.length >= 4 && !protect.includes(w) && fitOwnLabels(`${w}${w}.example`, [], [...protect]).length > 0;
  for (const b of brandNames) {
    const words = fitTokens(b).filter((w) => !STOP.has(w));
    const dist = words.filter(named);
    // a name made only of what the client sells or of generic words ("ERP Experts") is its subject, never its brand
    if (!dist.length) continue;
    if (toks.join(' ') === words.join(' ') || (words.length >= 2 && text.includes(` ${words.join(' ')} `))) return S(b);
    const joined = words.join('');
    if (joined.length >= 6 && toks.some((t) => t === joined || t.startsWith(joined))) return S(b);
    if (dist.length >= 2 && text.includes(` ${dist.join(' ')} `)) return S(b);
    if (dist.length === 1 && !COMMON_NAME_WORDS.has(dist[0]) && toks[0] === dist[0]) return S(b);
  }
  return '';
}

/**
 * The fit context of a website's advice: its own domain, competitors, and what it sells with the keywords it chose (protected words).
 * Review S4 (2026-11-12): no topic bar. These are searches the website already earns impressions for or the engine chose for it; F-10 is
 * about addresses and brands, and the stored services can be short or cut (F-07), so "off topic" / "too broad" would hide core searches.
 */
export function searchAdviceContext(site: SearchAdviceSite): FitContext {
  const services = [...new Set((site.services ?? []).map(S).filter(Boolean))];
  const chosen = [...new Set((site.chosen ?? []).map(S).filter(Boolean))];
  return {
    own_domain: low(site.domain),
    competitors: [...new Set((site.competitors ?? []).map(low).filter((d) => d && d !== low(site.domain)))].slice(0, 8),
    services,
    protect: [...new Set([...chosen, ...services])],
    topics: null,
  };
}

/**
 * Is this a search the website should be advised to work on? The shared fit gate, the address search and the client's brand names.
 * Returns the gate's shape: { ok: true } or { ok: false, reason, detail }.
 */
export function searchAdviceFit(query: string, site: SearchAdviceSite, ctx: FitContext = searchAdviceContext(site)): FitResult {
  const q = low(query);
  const protect = (ctx.protect ?? []).flatMap((p) => fitTokens(p));
  const own = low(site.domain).replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '');
  const label = addressSearchLabel(q, protect, own);
  if (label)
    return own.length >= 4 && label.startsWith(own)
      ? { ok: false, reason: 'own brand', detail: `people looking for your own website by its address (${S(query)})` }
      : { ok: false, reason: 'navigational', detail: `people looking for one website by its address (${S(query)}), not for what you sell` };
  const brand = brandNamed(fitTokens(q), site.brandNames ?? [], protect);
  if (brand) return { ok: false, reason: 'own brand', detail: `people already looking for you by name (${brand})` };
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
