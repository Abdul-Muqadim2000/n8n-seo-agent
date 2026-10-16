// ---- source kit (G4, 2026-10-11; inlined through the __SOURCES__ marker): what a citation is worth, what a figure says, and clean links.
// The 2026-10-11 review found a page that cited one vendor blog (trangotech.com) three times and kept Google's `?srsltid=` on a Statista
// link, with no check that the numbers in the copy are the numbers the source actually carries (RESULTS.md §2.4, exec 365).
//   SRC.clean(url)      strips the tracking parameters (utm_*, srsltid, gclid, fbclid …) from any link, in the copy and in the schema.
//   SRC.tier(url)       primary (government, standards, official statistics) > research > press > vendor documentation > weak.
//                       A vendor's blog or "resources" post is weak, like any unknown site; at most one citation per weak domain.
//   SRC.figures(text)   every figure with its position: percentages, currency amounts, magnitudes (k / m / bn), years, counts >= 1,000.
//                       Small bare numbers ("3 steps", "8 phases") are not claims and are never checked.
//   SRC.hasFigure(f, t) the same figure in the source text, in any format: separators, "m" / "million", "AED 50m" / "AED 50 million".
// Regex only: the n8n Code sandbox has no URL constructor.
const SRC = (() => {
  const TRACK = /^(?:utm_[a-z0-9_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|ttclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|hsa_[a-z0-9_]*|s_kwcid|vero_id|oly_enc_id|cmpid|mkt_tok|spm|scid|ref_src|pk_campaign|pk_kwd|piwik_campaign|at_medium|at_campaign)$/i;
  const host = (u) => { const m = String(u == null ? '' : u).trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const clean = (u) => {
    const s = String(u == null ? '' : u).trim();
    if (!s || s.indexOf('?') < 0) return s;
    const h = s.indexOf('#'); const frag = h >= 0 ? s.slice(h) : ''; const noFrag = h >= 0 ? s.slice(0, h) : s;
    const q = noFrag.indexOf('?'); if (q < 0) return noFrag + frag;
    const kept = noFrag.slice(q + 1).split('&').filter(p => p && !TRACK.test(p.split('=')[0]));
    return noFrag.slice(0, q) + (kept.length ? '?' + kept.join('&') : '') + frag;
  };
  const key = (u) => clean(String(u == null ? '' : u)).toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
  const PRIMARY = /(^|\.)(gov|edu|mil|int)$|(^|\.)(gov|edu|ac|mil)\.[a-z]{2,3}$|(^|\.)(europa\.eu|who\.int|oecd\.org|worldbank\.org|imf\.org|un\.org|unctad\.org|ilo\.org|wto\.org|iso\.org|w3\.org|ietf\.org|oasis-open\.org|gs1\.org|peppol\.eu|peppol\.org|openpeppol\.org|etsi\.org|cen\.eu|bis\.org|eurostat\.eu|u\.ae)$/i;
  const RESEARCH = /(^|\.)(statista\.com|gartner\.com|forrester\.com|idc\.com|mckinsey\.com|deloitte\.com|pwc\.com|kpmg\.com|ey\.com|accenture\.com|bcg\.com|bain\.com|hbr\.org|ibisworld\.com|grandviewresearch\.com|marketsandmarkets\.com|mordorintelligence\.com|nielsen\.com|pewresearch\.org|cbinsights\.com|statcounter\.com|similarweb\.com)$/i;
  const PRESS = /(^|\.)(reuters\.com|bloomberg\.com|bbc\.com|bbc\.co\.uk|nytimes\.com|wsj\.com|ft\.com|economist\.com|apnews\.com|cnbc\.com|theguardian\.com|forbes\.com|techcrunch\.com|zdnet\.com|arstechnica\.com|theregister\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|arabianbusiness\.com|zawya\.com|bizjournals\.com)$/i;
  const VENDOR = /(^|\.)(microsoft\.com|oracle\.com|sap\.com|odoo\.com|zoho\.com|salesforce\.com|netsuite\.com|sage\.com|xero\.com|intuit\.com|quickbooks\.intuit\.com|google\.com|adobe\.com|aws\.amazon\.com|amazon\.com|ibm\.com|stripe\.com|shopify\.com|hubspot\.com|atlassian\.com|cloudflare\.com|mozilla\.org|developer\.mozilla\.org)$/i;
  const BLOGGY = /\/(?:blog|blogs|insights|resources|articles|news|post|posts|guides?)(?:\/|$)/i;
  const tier = (u) => {
    const h = host(u); if (!h) return 'weak';
    if (PRIMARY.test(h)) return 'primary';
    if (RESEARCH.test(h)) return 'research';
    if (PRESS.test(h)) return 'press';
    if (VENDOR.test(h)) return BLOGGY.test(String(u || '')) ? 'weak' : 'vendor';   // a vendor's own documentation is usable; its blog is not
    return 'weak';
  };
  const TIERS = { primary: 'official or standards body', research: 'research house', press: 'major press', vendor: 'vendor documentation', weak: 'no independent authority (vendor or agency blog, listicle, unknown site)' };
  const strong = (u) => tier(u) !== 'weak';
  // ---- figures ----
  const MAG = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, bn: 1e9, b: 1e9, billion: 1e9, tn: 1e12, trillion: 1e12 };
  const CUR = '(?:AED|USD|SAR|QAR|KWD|BHD|OMR|EGP|PKR|INR|EUR|GBP|ZAR|Dhs?|SR|Rs\\.?|\\$|€|£|₹)';
  const NUM = '\\d[\\d,]*(?:\\.\\d+)?';
  const UNITS = '(?:thousand|trillion|million|billion|mn|bn|tn|k|m|b)';   // longest first: "1,802 million" must not match as "1,802 m"
  const UNIT = '(?:\\s?' + UNITS + '\\b)?';
  const FIG_RE = new RegExp('(' + [
    CUR + '\\s?' + NUM + UNIT,                                     // AED 50m, $1.2 billion
    NUM + '\\s?' + UNITS + '\\b\\s?' + CUR,                        // 50 million AED
    NUM + '\\s?(?:%|percent\\b|per cent\\b|percentage points?\\b)',  // 23%, 1.74 percent
    NUM + '\\s?' + UNITS + '\\b',                                  // 2.4 million
    '(?:19|20)\\d{2}(?![\\d-])',                                    // a year, not part of a longer number or a date range code
    '\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?',                             // 1,234 / 12,345.6
    '\\d{4,}(?:\\.\\d+)?'                                           // 25000
  ].join('|') + ')', 'gi');
  const valueOf = (raw) => {
    const s = String(raw == null ? '' : raw).trim().replace(/[.,;:]+$/, '');
    if (!s) return null;
    const low = s.toLowerCase();
    const digits = (low.match(new RegExp(NUM)) || [''])[0];
    const n = Number(digits.replace(/,/g, ''));
    if (!digits || !Number.isFinite(n)) return null;
    const mm = low.match(/\d\s*(k|mn|m|bn|b|tn)\b/) || low.match(/\b(thousand|million|billion|trillion)s?\b/);
    const mag = mm ? MAG[mm[1]] : 0;
    const pct = /%|percent|per cent/.test(low);
    return { raw: s, n, v: mag ? n * mag : n, pct, year: !mag && !pct && /^(?:19|20)\d{2}$/.test(digits) };
  };
  // every figure with where it sits, so the caller can bracket it in place
  // `raw` is the figure without its trailing punctuation, and `length` matches it, so a caller can replace it in place without eating the full stop
  const figures = (text) => { const out = []; for (const m of String(text == null ? '' : text).matchAll(FIG_RE)) { const f = valueOf(m[0]); if (f) out.push({ ...f, index: m.index, length: f.raw.length }); } return out; };
  // ---- R37 (2026-10-16, re-rating 2026-10-15): the SOURCE side reads numbers written in words, and a snippet cut before its unit ----
  // Live (exec 616) McKinsey's snippet read "Forty percent of respondents … report scaling AI agents, up from 27 ... Read more". The draft
  // quoted it exactly ("40% … up from 27%") and both figures were masked as "not carried": the matcher knew only digits, and the snippet
  // was cut before "percent". `spelled()` rewrites number words into digits ("Forty percent" -> "40 percent", "fifty million dirhams" ->
  // "50 million dirhams", "a third" -> "33.3 percent") on the text a figure is LOOKED UP in — never on the draft, whose figure positions the
  // caller brackets in place. `cutPct()` accepts a bare number that sits right where the snippet was cut ("27 ..." / "27…" / the end of
  // the text) only for a percentage, and only when the same excerpt states a percentage within the 240 characters before it: the number
  // itself must be there, and the unit it lost is the one the sentence was using. Nothing else is loosened: a number the excerpt does not
  // carry is still not carried, and a bare number in a COMPLETE sentence ("up from 27 respondents.") still vouches for nothing.
  const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const NW = '(?:' + Object.keys(TENS).concat(Object.keys(ONES).sort((a, b) => b.length - a.length)).join('|') + '|hundred)';
  const NW_RUN = new RegExp('\\b' + NW + '(?:(?:[\\s-]+|\\s+and\\s+)' + NW + ')*\\b', 'gi');
  const FRACTIONS = [[/\b(?:a|one)[\s-]+half\b|\bhalf\s+of\b/gi, '50 percent'], [/\btwo[\s-]+thirds\b/gi, '66.7 percent'], [/\b(?:a|one)[\s-]+third\b/gi, '33.3 percent'],
    [/\bthree[\s-]+quarters\b/gi, '75 percent'], [/\b(?:a|one)[\s-]+quarter\b/gi, '25 percent']];
  const spelled = (text) => {
    let t = String(text == null ? '' : text);
    for (const fr of FRACTIONS) t = t.replace(fr[0], fr[1]);
    return t.replace(NW_RUN, (run) => {
      let cur = 0, any = false;
      for (const w of run.toLowerCase().split(/[\s-]+/)) {
        if (w === 'and') continue;
        if (w === 'hundred') { cur = (cur || 1) * 100; any = true; continue; }
        const v = ONES[w] != null ? ONES[w] : TENS[w]; if (v == null) return run; cur += v; any = true;
      }
      return any ? String(cur) : run;
    });
  };
  // a fraction is stated to one decimal ("a third" = 33.3%) and quoted rounded ("33%"): both are the source's figure
  const ROUNDED = { 33.3: 33, 66.7: 67 };
  const valueSetOf = (t) => { const s = new Set(); for (const f of figures(t)) { s.add(f.v); if (f.pct && ROUNDED[f.v] != null) s.add(ROUNDED[f.v]); } return s; };
  const PCT_NEAR = /%|\bper\s?cent\b|\bpercent(?:age)?\b/i;
  const cutPct = (f, t) => {
    if (!f || !f.pct || f.year) return false;
    const n = String(f.n).replace(/[.]/g, '\\.');
    const re = new RegExp('(^|[^\\d.,$€£₹])' + n + '\\s*(?:\\.{3}|…|$)', 'g');
    for (const m of t.matchAll(re)) { const at = m.index + m[1].length; if (PCT_NEAR.test(t.slice(Math.max(0, at - 240), at))) return true; }
    return false;
  };
  // the magnitude is part of the figure: "AED 50 million" in the source does not vouch for "AED 50bn" in the draft
  const valueSet = (text) => valueSetOf(spelled(text));
  const hasFigure = (f, text) => { if (!f) return false; const t = spelled(text); return valueSetOf(t).has(f.v) || cutPct(f, t); };
  // an excerpt the run read was cut short (a search snippet: "…", "...", "Read more"): a figure missing from it is "not in the excerpt
  // the run read", never "the source does not carry it" — the page itself was never read in full.
  const cutShort = (text) => /\.{3}|…|\bread more\b/i.test(String(text == null ? '' : text));
  return { TRACK, clean, key, host, tier, TIERS, strong, figures, valueOf, valueSet, hasFigure, spelled, cutShort, FIG_RE };
})();
// B3-8 (2026-10-16, benchmark area 3 row B3-8, with area 4's refresh path): a refresh re-checks the facts.
// The cadence's decay path (and every run that improves a live page through `existing_page_url`) rewrites a page on top of its live
// version. Content QA's figure check (§9b) looks a figure up only in a source the run READ, and the run never read the sources the live
// page itself cites — so every figure the page carried over with its old citation went through unchecked ("the source was never
// fetched: nothing to look the figure up in"). C3 at 10 asks for every claim to be re-checked at refresh.
// This node finds the external sources the live page cites NEXT TO A FIGURE (a link with no figure in its sentence vouches for nothing
// the check could test) and hands them to *Fetch Refresh Sources* (Jina Reader, the reader the competitor pages use). Not a refresh, or
// the live page was not read, or it cites nothing next to a figure: one `{ skip: true }` item, so the IF routes around the fetch.
const CONFIG = { max_sources: 8 };
const prev = $('Parse Brief').first().json || {};
const S = (v) => String(v == null ? '' : v);
const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
const domain = bare(prev.domain);
const exp = (prev.existing_page && prev.existing_page.url) ? S(prev.existing_page.url) : S(prev.existing_page_url);
const skip = (reason, extra) => [{ json: { skip: true, url: '', refresh: !!exp, page_url: exp, reason, ...(extra || {}) } }];
if (!exp) return skip('not a refresh: no live page is being improved in this run');

// the live page's own Jina answer (links kept) — the request list and the reads are aligned by position, as Collect Client Pages reads them
let reqs = [], reads = [];
try { reqs = $('Client Page Requests').all().map(i => i.json || {}); } catch (e) { reqs = []; }
try { reads = $('Read Client Pages').all().map(i => i.json || {}); } catch (e) { reads = []; }
const keyOf = (u) => SRC.key(u);
let idx = reqs.findIndex(r => r && r.kind === 'existing' && keyOf(r.url) === keyOf(exp));
if (idx < 0) idx = reqs.findIndex(r => r && r.kind === 'existing');
const raw = idx >= 0 && reads[idx] && !reads[idx].error ? S(reads[idx].page_text || reads[idx].data) : '';
if (raw.replace(/\s+/g, ' ').trim().length < 200) return skip('the live page could not be read in this run, so its cited sources are unknown', { live_read: false });

// external links that sit in a sentence carrying a figure (the same sentence rule as §9b: a full stop between digits is a decimal point)
const isBreak = (t, i) => { const c = t[i]; if (c === '\n' || c === '|' || c === '!' || c === '?') return true; if (c !== '.') return false; return !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')); };
const bounds = (t, at, len) => { let a = at, b = at + len; while (a > 0 && !isBreak(t, a - 1)) a--; while (b < t.length && !isBreak(t, b)) b++; return [a, b]; };
const SOCIAL = /(^|\.)(linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|wa\.me|whatsapp\.com|t\.me|pinterest\.com)$/i;
const seen = new Set(); const picked = []; let cited = 0;
for (const m of raw.matchAll(/(!?)\[[^\[\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
  if (m[1]) continue;   // an image is not a citation
  const url = SRC.clean(m[2]); const h = SRC.host(url);
  if (!h || (domain && (h === domain || h.endsWith('.' + domain))) || SOCIAL.test(h)) continue;
  const [a, b] = bounds(raw, m.index, m[0].length);
  const body = raw.slice(a, b).replace(/\[[^\[\]]*\]\([^)]*\)/g, (x) => ' '.repeat(x.length));
  if (!SRC.figures(body).some(f => !f.year)) continue;   // nothing in this sentence the check could test
  const k = keyOf(url); if (!k || seen.has(k)) continue; seen.add(k); cited++;
  if (picked.length < CONFIG.max_sources) picked.push({ url, host: h, tier: SRC.tier(url) });
}
if (!picked.length) return skip('the live page cites no external source next to a figure', { live_read: true, cited: 0 });
return picked.map((p, i) => ({ json: { skip: false, url: p.url, host: p.host, tier: p.tier, index: i, refresh: true, page_url: exp, live_read: true, cited } }));
