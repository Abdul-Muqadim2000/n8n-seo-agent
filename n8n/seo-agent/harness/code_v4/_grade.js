// harness shim (written by build_v4.py section 159): the grade kit, { fn, args } -> { r } ('__SRC__' in args is the source kit's tier / figures)
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
  // ---- FU-SV (2026-10-29, page-quality BEFORE run K7): a search-engine redirect is never a source ----
  // One run's facts search answered 16 of its 19 results as Google redirects (https://google.com/goto?url=CAES..., an opaque token, domain
  // "google.com", rated a high-authority source because it is Google), and all five citations of the delivered page pointed there.
  // `isRedirect` knows the redirect forms (Google /url, /goto, /aclk, /imgres, the Vertex AI grounding redirect, Google News article
  // tokens, Bing /ck/a); `unwrap` returns the real target when the redirect carries it (?q=https://..., ?url=https%3A..., Bing's
  // u=a1<base64>), else ''. `clean` unwraps a redirect that carries its target, so every caller that cleans a link gets the real page; an
  // opaque redirect is returned as it is, and the caller drops the link and keeps its words (`unredirect`). `tier` rates an opaque one weak.
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:url|goto|aclk|search\/url|imgres)(?=[?\/#]|$)|vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/|news\.google\.com\/(?:rss\/)?(?:articles|read)\/|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const isRedirect = (u) => REDIR.test(String(u == null ? '' : u).trim());
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const b64 = (t) => { let bits = 0, val = 0, out = ''; for (const ch of String(t).replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')) {
    const i = B64.indexOf(ch); if (i < 0) return ''; val = ((val << 6) | i) & 0xffffff; bits += 6; if (bits >= 8) { bits -= 8; out += String.fromCharCode((val >> bits) & 255); } } return out; };
  const dec = (v) => { let x = String(v || ''); for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(x); i++) { try { x = decodeURIComponent(x); } catch (e) { break; } } return x; };
  const param = (s, names) => { const q = s.indexOf('?'); if (q < 0) return ''; const qs = s.slice(q + 1).replace(/#.*$/, '');
    for (const n of names) for (const p of qs.split('&')) { const e = p.indexOf('='); if (e > 0 && p.slice(0, e).toLowerCase() === n) return p.slice(e + 1); } return ''; };
  const unwrap = (u, depth) => {
    const s = String(u == null ? '' : u).trim(); if (!isRedirect(s)) return s;
    let t = '';
    if (/bing\.com\/ck\/a/i.test(s)) { const v = dec(param(s, ['u'])); t = /^a1/.test(v) ? b64(v.slice(2)) : v; }
    else if (!/vertexaisearch|news\.google|\/aclk/i.test(s)) t = dec(param(s, /\/imgres/i.test(s) ? ['imgrefurl'] : ['url', 'q', 'u']));
    t = String(t || '').trim();
    if (!/^https?:\/\/[^\s\/?#]+\.[^\s]*$/i.test(t) || /[\s<>"]/.test(t)) return '';
    return isRedirect(t) ? ((depth || 0) < 2 ? unwrap(t, (depth || 0) + 1) : '') : t;
  };
  const clean = (u) => {
    let s = String(u == null ? '' : u).trim();
    if (isRedirect(s)) { const t = unwrap(s); if (!t) return s; s = t; }
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
  const tier = (u0) => {
    const u = isRedirect(u0) ? unwrap(u0) : u0;   // FU-SV: a redirect is rated as its target; an opaque one has no host we can rate
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
  // FU-SV: every link of a text (Markdown links and images, HTML anchors, autolinks, bare URLs) that is a search-engine redirect becomes
  // its real target when the redirect carries it; an opaque one loses its link and keeps its words, so the attribution stays readable.
  const unredirect = (text) => {
    const resolved = [], dropped = [];
    const fix = (u) => { const t = unwrap(u); if (t) { const c = clean(t); resolved.push({ from: u, to: c }); return c; } dropped.push(u); return ''; };
    let t = String(text == null ? '' : text);
    if (!/google\.|vertexaisearch|bing\.com/i.test(t)) return { text: t, resolved, dropped };
    t = t.replace(/(!?)\[([^\[\]]*)\]\((https?:\/\/[^)\s]+)((?:\s+"[^"]*")?)\)/g, (m, bang, a, u, ttl) => { if (!isRedirect(u)) return m; const r = fix(u); return r ? bang + '[' + a + '](' + r + ttl + ')' : (bang ? '' : a); });
    t = t.replace(/<a\b([^>]*?)\bhref=(["'])(https?:\/\/[^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi, (m, pre, q, u0, post, inner) => { const u = u0.replace(/&amp;/g, '&'); if (!isRedirect(u)) return m; const r = fix(u); return r ? '<a' + pre + 'href=' + q + r.replace(/&/g, '&amp;') + q + post + '>' + inner + '</a>' : inner; });
    t = t.replace(/<(https?:\/\/[^>\s]+)>/g, (m, u) => { if (!isRedirect(u)) return m; const r = fix(u); return r ? '<' + r + '>' : ''; });
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s)<>\]"']+)/g, (m, pre, u) => { if (!isRedirect(u)) return m; return pre + fix(u); });
    if (dropped.length) t = t.replace(/[ \t]*\([ \t]*\)/g, '');
    return { text: t, resolved, dropped };
  };
  return { TRACK, clean, key, host, tier, TIERS, strong, figures, valueOf, valueSet, hasFigure, spelled, cutShort, FIG_RE, isRedirect, unwrap, unredirect };
})();
// ---- grade kit (W0-C, page-quality programme 2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 3, 2.6, 2.9; REVIEW_CODE H3 / L1 / L5;
// REVIEW_EVIDENCE H2 / H3 / M1; inlined through the GRADE marker into Content QA, Page Candidates, Apply Second Read and the Finalize
// workflow's Finalize Verdict). Production page run 3299 ("ms 365 erp") was graded 92 and its final version 100 "Ready to publish" while the
// client's expert reviewer gave it 63: the grade counted structure, term coverage, readability, specificity, filler words and LENGTH, and
// nothing a reviewer takes points off for (figures resting on an agency blog and a tracker, one label for two different lists, a keyword our
// own verdict scored 42, a page the website already had). The only part that moved 92 -> 100 was length.
//
// The interim grade, deterministic and free, on ONE scale out of 100 (a subset of the Wave 2 rubric, so nothing is thrown away):
//   structure 20       today's structure checks scaled; -3 per repetition cluster (one statement made 3+ times across sections, up to
//                      -8); -2 per label used for two different lists (up to -4); a statement made 4+ times caps structure at 50%;
//                      W06-A: -2 per IDEA restated 4+ times in 3+ places (the near-duplicate check below, up to -4), never below half
//   removed sections   W06-A: when the run's deletions (verdict exclusions) or its edits took 2+ sections or 20%+ of the words out of the
//                      page, coverage and fit are capped at 40% of their parts (the page no longer covers what its search asks), with why
//   coverage 15        today's term coverage, scaled
//   readability 10     today's readability, scaled
//   specificity 10     today's specificity
//   clean language 10  today's filler-phrase check
//   sources 15         share of the cited sentences and figures resting on an official body, a research house, major press or vendor
//                      documentation; -1/3 of the part per market, adoption, cost or compliance figure whose only source is weak; such a
//                      compliance figure caps sources at 8 of 15. Nothing to source (no figure, no citation) is "not checked" at 12 of
//                      15 (4/5): never full marks, so deleting a citation never pays (WAVE0_REVIEW M2). A sentence resting only on a weak
//                      source with no market / cost / compliance figure counts half a strong one (none while such a figure rests only
//                      on a weak source), and while nothing on the page is an
//                      unsourced or weak-only figure the part never falls below "not checked": citing a vendor or agency page is never
//                      worse than citing nothing. The digits of a phone number, opening hours, a postcode / PO box or a street, office
//                      or floor number are contact details, never a figure to source (WAVE0_REVIEW H1)
//   fit 20             half for the verdict (>= 50 full, 30-49 two fifths, < 30 none, no score full and "not checked"), half for no open
//                      duplicate page. A verdict under 50 caps fit at 40%, also after "Write it anyway"; an open duplicate caps it at 30%.
//                      The shapes of the results page are recorded (serp_shapes, Parse Analysis), no points yet
//   length 0           advice only (Google says not to aim at a word count)
// Every cap is a SHARE of its part, so a page-type weighting (Wave 2) cannot break it. Any open blocker -> total <= 59; shown as "95+" from 95.
// READY needs no blocker AND every part at or above half its maximum. Exceptions, so a page we should write is never held back:
//   * fit is waived after an explicit acknowledgement ("Write it anyway") and for pages a search score says nothing about (a page of the
//     client's keyword ladder, a case study, an AI answer page, a refresh): shown as the client's or the plan's choice, the cap kept;
//   * for runs the system started by itself (cadence, ladder, tracker), the fit floor is only recorded (shadow, owner decision D17).
// A failed floor is ADVICE in this wave: the page is "Needs work: <part>" (delivery status `needs_work`), never "Ready to publish", and
// nothing stops the client from approving and publishing it. A blocker is still the only thing that makes a page "not ready".
// The guide that ranks (production exec 949, owner priority) passes every floor: harness/scenarios_w0c.js.
// Regex and token code only (the n8n Code sandbox has no URL constructor and no-ops Object.defineProperty). No literal dash, curly quote
// or ellipsis character in this file: they are built with String.fromCharCode.
const GR = (() => {
  const VERSION = 'w0c-1';
  const S = (v) => String(v == null ? '' : v);
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const r1 = (x) => Math.round(x * 10) / 10;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const CH = (...c) => String.fromCharCode(...c);
  const RE_DASH = new RegExp('\\s*[' + CH(0x2014, 0x2013) + ']\\s*', 'g'), RE_DQ = new RegExp('[' + CH(0x201C, 0x201D) + ']', 'g'), RE_SQ = new RegExp('[' + CH(0x2018, 0x2019) + ']', 'g'), RE_ELL = new RegExp(CH(0x2026), 'g');
  const clean = (s) => S(s).replace(RE_DASH, ': ').replace(RE_DQ, '"').replace(RE_SQ, "'").replace(RE_ELL, '...').replace(/:\s*:/g, ':').trim();
  const MAX = { structure: 20, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 15, fit: 20, length: 0 };
  const DIMS = ['structure', 'coverage', 'readability', 'specificity', 'clean_language', 'sources', 'fit'];
  const LABEL = { structure: 'structure', coverage: 'topic coverage', readability: 'readability', specificity: 'specificity', clean_language: 'plain language', sources: 'sources', fit: 'fit with the search' };
  // caps as shares of their part (REVIEW_EVIDENCE M1): verdict under 50 -> fit 40%; open duplicate -> fit 30%; a statement made 4+ times ->
  // structure 50%; a weak-only compliance figure -> sources 8 of 15
  const SHARE = { fit_verdict: 0.4, fit_duplicate: 0.3, structure_repeat: 0.5, sources_compliance: 8 / 15, weak_figure: 1 / 3, verdict_partial: 0.4, sources_none: 0.8, weak_cite: 0.5, removed: 0.4 };
  const CFG = { sim: 0.6, min_words: 4, cluster: 3, cluster_cap: 4, blocker_cap: 59, verdict_bar: 50, display_top: 95, floor: 0.5, review_share: 0.25,
    idea: { size: 4, places: 3, shared: 3, overlap: 0.6, dice: 0.3, min_words: 3, df_share: 0.08, df_min: 6, points: 2, max_points: 4 },   // W06-A: the idea check
    removed: { sections: 2, share: 0.2 } };   // W06-A: deletions that cap coverage and fit
  const STOP = new Set(('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them '
    + 'than then into over under more most can will does do not but any all one two also very just only such been being has have had was were each per may must should would '
    + 'could other some many much here there where while if so as up out own same both few no nor too yes use used using get gets make makes made need needs '
    + 'first second third new well like via within without across between before after because usually often typically').split(' '));
  const NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const stem = (w) => { let x = w; if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|ly|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const plain = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = (t, keep) => S(t).toLowerCase().replace(RE_SQ, '').replace(/'/g, '').split(keep ? /[^\p{L}\p{N}&_]+/u : /[^\p{L}\p{N}&]+/u).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const HEAD = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const BYLINE = /^[*_]+\s*(?:written by|by|reviewed by|updated)\b/i;   // the italic byline line, never a sentence that starts "By 2027, ..."
  const SKIP_SECTION = /\babout the author\b|^author\b|\bsources\b|\breferences\b|\bfurther reading\b/i;
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const SOCIAL = /(^|\.)(linkedin\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|whatsapp\.com|calendly\.com)$/;
  const maxOf = (m) => { const o = { ...MAX }; for (const k of DIMS) if (m && Number.isFinite(Number(m[k])) && Number(m[k]) >= 0) o[k] = Number(m[k]); return o; };

  // ---------- the page as sections, paragraphs, sentences, list items and table rows (head lines, byline, images, author box left out) ----------
  const units = (md0) => {
    const out = []; let section = 0, heading = '', skip = false, para = 0, qa = false;
    const lines = S(md0).replace(/\r/g, '').split('\n');
    let listId = 0, inList = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) { para++; continue; }   // a blank line between two items does not end a list (a numbered list written "1.", blank, "1.")
      if (HEAD.test(l)) continue;
      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { if (h[1].length >= 2) { section++; heading = plain(h[2]); skip = SKIP_SECTION.test(heading); } para++; inList = false; out.push({ kind: 'heading', section, heading, text: plain(h[2]), level: h[1].length, line: i }); continue; }
      if (skip) continue;
      if (/^!\[/.test(l) || /^```/.test(l) || BYLINE.test(l)) continue;
      if (/^\|/.test(l)) { inList = false; if (/^\|?\s*:?-{2,}/.test(l)) continue; out.push({ kind: 'row', section, heading, para, text: l, line: i }); continue; }
      const li = l.match(/^(?:>\s*)?(?:[-*+]|\d{1,3}[.)])\s+(.*)$/);
      if (li) { if (!inList) { listId++; inList = true; } out.push({ kind: 'li', list: listId, section, heading, para, text: li[1], line: i }); continue; }
      inList = false;
      const body = l.replace(/^>\s*/, '');
      qa = /^\**\s*quick answer\b/i.test(body);
      for (const s of body.split(/(?<=[.!?]["')*_]*)\s+(?=[A-Z0-9"'(*\[])/)) if (s.trim()) out.push({ kind: 'sentence', section, heading, para, text: s.trim(), qa, line: i });
    }
    return out;
  };

  // ---------- 1. repetition: one statement made again and again ----------
  // Statements (sentences and list items under an H2 / H3, not the introduction, the Quick answer, questions, images or review notes) are
  // reduced to their content words: the keyword's and the brand's words are taken out (they are on every line of a good page) and a name
  // of several capitalised words is ONE word ("Accredited Service Provider", "Supply Chain Management"), since a product name alone says
  // nothing about WHICH point a sentence makes (without that, every sentence naming the same two products was one "cluster" on the guide
  // that ranks). Two statements in different sections with a Dice overlap of CFG.sim or more say the same thing; linked statements form a
  // cluster; a cluster of 3+ statements across 2+ sections is one point made three times. Calibrated on production pages 3299 / 3336 and
  // the guide that ranks (exec 949): none of the three has such a cluster, the pairs each page makes twice stay pairs, and one statement
  // restated in six sections is found (harness/scenarios_w0c.js). Deliberately conservative: a paraphrase is the Wave 2 judge's work.
  const repetition = (md, ctx) => {
    const c = ctx || {};
    const drop = new Set(toks([c.keyword].concat(c.brand_names || []).join(' ')).map(stem));
    const U = units(md).filter(u => (u.kind === 'sentence' || u.kind === 'li') && !u.qa && u.section > 0 && !/^\[(?:Image|Confirm|Owner)\b/i.test(u.text) && !/\?["')*_]*$/.test(u.text.trim()));
    const entity = (t) => plain(t).replace(/\b(?:The|A|An|This|That|These|Your|Our)\s+(?=[A-Z])/g, '').replace(/\b[A-Z][\w&]*(?:\s+[A-Z][\w&]*)+/g, (m) => m.replace(/\s+/g, '_'));
    const items = [];
    for (const u of U) { const set = [...new Set(toks(entity(u.text), true).map(stem).filter(w => !drop.has(w)))]; if (set.length >= CFG.min_words) items.push({ ...u, set: new Set(set), n: set.length }); }
    const parent = items.map((x, i) => i); const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const near = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; if (a.section === b.section) continue;
      let inter = 0; for (const w of a.set) if (b.set.has(w)) inter++;
      const sim = 2 * inter / (a.n + b.n);
      if (c.debug && sim >= 0.4) near.push({ sim: Math.round(sim * 100) / 100, a: plain(a.text).slice(0, 110), b: plain(b.text).slice(0, 110) });
      if (sim >= CFG.sim) { const x = find(i), y = find(j); if (x !== y) parent[x] = y; } }
    const groups = new Map();
    items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
    const clusters = [...groups.values()].filter(g => g.length >= CFG.cluster && new Set(g.map(x => x.section)).size >= 2)
      .map(g => ({ size: g.length, sections_n: new Set(g.map(x => x.section)).size, sections: [...new Set(g.map(x => x.heading))].slice(0, 8),
        sample: plain(g[0].text).slice(0, 160), members: g.slice(0, 8).map(x => plain(x.text).slice(0, 140)) })).sort((a, b) => b.size - a.size);
    return { clusters, count: clusters.length, worst: clusters.length ? clusters[0].size : 0, compared: items.length, ...(c.debug ? { near: near.sort((x, y) => y.sim - x.sim).slice(0, 25) } : {}) };
  };

  // ---------- 1b. W06-A: one IDEA restated (the near-duplicate check) ----------
  // The blind judges of the wave 0.5 re-check (WAVE05.md) took structure points off three pages for an idea restated 4 to 6 times
  // ("NetSuite for groups with subsidiaries across countries on one SaaS platform", "a gap-fit analysis before a fixed scope") that the
  // statement check above never saw: the restatements are worded differently, in a list, a table row, a takeaway and a closing rule, so no
  // two of them reach its Dice 0.6. Here every sentence, list item and table row (the Quick answer included, questions and links left out)
  // is reduced to its rarer content words: the keyword's and the brand's words and every word on more than 8% of the units (the page's
  // vocabulary, such as a product name) are taken out, and a name of several capitalised words is one word. Two units in different places
  // that share 3+ such words, 60% of the shorter one and a Dice of 0.3, say the same thing. A unit with near copies in 3+ places, 4+ units
  // in all, is one idea restated (the copies are taken by the most connected unit first, so one long chain is never one idea). Calibrated on
  // the 16 AFTER / W05 pages of the page-quality run and the guide that ranks (exec 949): it finds the ideas the judges named on two of the
  // three pages (K3, K4; K6's "launch narrow" is restated in a heading and with too few shared words), nothing on the guide that ranks, and
  // a repeated deadline, a repeated product rule and a repeated method on three AFTER pages. Deterministic and conservative: a paraphrase
  // with no shared words is the Wave 2 judge's work.
  const ideas = (md, ctx) => {
    const c = ctx || {}; const I = CFG.idea;
    const strip = (t) => plain(S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/\]\([^)]*\)?/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\[/g, ' ')).replace(/^quick answer:?\s*/i, '');
    const entity = (t) => strip(t).replace(/\b(?:The|A|An|This|That|These|Your|Our)\s+(?=[A-Z])/g, '').replace(/\b[A-Z][\w&]*(?:\s+[A-Z][\w&]*)+/g, (m) => m.replace(/\s+/g, '_'));
    const drop = new Set(toks([c.keyword].concat(c.brand_names || []).join(' ')).map(stem));
    const U = units(md).filter(u => (u.kind === 'sentence' || u.kind === 'li' || u.kind === 'row') && !/^\[(?:Image|Confirm|Owner)\b/i.test(u.text)
      && !(u.kind === 'li' && /^\s*\[[^\]]*\]\(#[^)]*\)\s*$/.test(u.text)) && !/\?["')*_]*$/.test(u.text.trim()));
    const items = U.map(u => ({ text: u.text, place: u.qa ? 'qa' : 's' + u.section, set: new Set(toks(entity(u.text), true).map(stem).filter(w => !drop.has(w))) }));
    const df = new Map(); for (const it of items) for (const w of it.set) df.set(w, (df.get(w) || 0) + 1);
    const cap = Math.max(I.df_min, Math.ceil(items.length * I.df_share));
    for (const it of items) { it.set = new Set([...it.set].filter(w => df.get(w) <= cap)); it.n = it.set.size; }
    const cand = items.map((it, i) => ({ ...it, i })).filter(it => it.n >= I.min_words);
    const nb = new Map(cand.map(it => [it.i, []]));
    for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) {
      const x = cand[a], y = cand[b]; if (x.place === y.place) continue;
      let inter = 0; for (const w of x.set) if (y.set.has(w)) inter++;
      if (inter < I.shared || inter / Math.min(x.n, y.n) < I.overlap || 2 * inter / (x.n + y.n) < I.dice) continue;
      nb.get(x.i).push(y.i); nb.get(y.i).push(x.i); }
    const used = new Set(); const found = [];
    for (const it of cand.slice().sort((a, b) => nb.get(b.i).length - nb.get(a.i).length || a.i - b.i)) {
      if (used.has(it.i)) continue;
      const mem = [it.i].concat(nb.get(it.i).filter(j => !used.has(j)));
      const places = new Set(mem.map(j => items[j].place));
      if (mem.length >= I.size && places.size >= I.places) { mem.forEach(j => used.add(j));
        found.push({ size: mem.length, places: places.size, sample: strip(it.text).slice(0, 160), members: mem.slice(0, 8).map(j => strip(items[j].text).slice(0, 140)) }); }
    }
    found.sort((a, b) => b.size - a.size);
    return { ideas: found, count: found.length, worst: found.length ? found[0].size : 0, compared: cand.length };
  };

  // ---------- 2. one label for two different lists ("five questions" before two lists, then "use the five questions") ----------
  const listLabels = (md) => {
    const U = units(md); const LBL = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+([a-z]{3,})\b/i;
    const norm = (m) => (NUMW[m[1].toLowerCase()] || Number(m[1])) + ' ' + stem(m[2].toLowerCase());
    const leads = new Map();
    for (let i = 0; i < U.length; i++) {
      const u = U[i]; if (u.kind !== 'li') continue; if (i > 0 && U[i - 1].kind === 'li' && U[i - 1].list === u.list) continue;   // the first item of a list
      const lead = i > 0 && (U[i - 1].kind === 'sentence' || U[i - 1].kind === 'heading') ? U[i - 1] : null;   // the line right before it
      const m = lead ? plain(lead.text).match(LBL) : null; if (!m) continue;
      const k = norm(m); if (!leads.has(k)) leads.set(k, { lists: new Set(), text: plain(lead.text).slice(0, 120) }); leads.get(k).lists.add(u.list); }
    const collisions = [...leads.entries()].filter(([, v]) => v.lists.size >= 2).map(([label, v]) => ({ label, lists: v.lists.size, lead: v.text }));
    return { collisions, count: collisions.length };
  };

  // ---------- 3. sources: what the cited sentences and the figures rest on ----------
  // A unit is a sentence, list item or table row that cites an outside page, names its source ("according to ..."), or carries a figure.
  // Strong: it links an official body, a research house, major press or vendor documentation (`opts.tier` = Content QA's SRC.tier: anything
  // but 'weak'), or names an official body or one of those houses; a figure with no link of its own takes its paragraph's citation. A figure
  // the business states about itself (on file: `own_text`), a year, or a standard's or a law's number is not a sourcing question. The
  // client's own pages and social profiles are not citations.
  const OFFICIAL = /\b(?:ministry|authority|federal|government|central bank|commission|council|agency|department|bureau|regulator|parliament|court|statistics|census|united nations|world bank|oecd|imf|european union|eurostat)\b/i;
  const ATTR = /\b(?:according to|as reported by|reported by|research (?:by|from)|(?:a|the) (?:study|survey|report|analysis) (?:by|from))\s+((?:the\s+)?[A-Z][\w&.'-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w&.'-]*){0,5})/;
  const ATTR_FIG = /\b(?:data from|figures from)\s+((?:the\s+)?[A-Z][\w&.'-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w&.'-]*){0,5})|\b((?:the\s+)?[A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})(?:'s)?\s+(?:found|finds|reports?|reported|estimates?|estimated|states?|stated|counts?|counted)\b/;
  const FIG_TOPIC = /\bmarket|\bshare\b|\bindustr|\brevenue|\bvalued?\b|\bworth\b|\bcagr\b|\bgrow|\bsize\b|\bforecast|\bspend|\bcompan(?:y|ies)\b|\bbusinesses\b|\borgani[sz]ations?\b|\bfirms?\b|\benterprises?\b|\bcustomers?\b|\busers?\b|\bclients?\b|\bsmes?\b|\badopt|\buse[sd]?\b|\busing\b|\bdeploy|\bimplement|\bcost|\bprice|\bpricing|\bfees?\b|\bbudget|\bsav(?:e|es|ed|ing|ings)\b|\broi\b|\binvest|\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  const COMPLIANCE = /\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  const STD = /\b(?:ISO|IEC|EN|BS|SOC|PCI|IAS|IFRS|ASC|Article|Section|Law|Decree|No\.?|Resolution|Circular|Decision)\s?(?:\/IEC)?$/i;
  // H1 (WAVE0_REVIEW 2026-10-30): where a page states how to reach the business, its digits are contact details. BEFORE run K6 (the page
  // both judges rated best) had one source unit, the last four digits of the phone number in its call to action, and graded sources 0 of 15:
  // "Needs work: sources" on a guide that cites nothing it needs to. Every Local page carries a NAP block (v4.4), so every one would have.
  // The spans below are phone numbers (an international prefix, or a phone word before a run of 7+ digits with separators or a leading 0),
  // opening hours (0900-1800), a PO box / postcode / ZIP, and a street, office, suite, floor or building number. A figure inside one is
  // not a sourcing question ("P.O. Box 123456" is cut into two sentences at "P.O.", so a capital "Box" with its number counts alone, as does a
  // number in the local form 0X XXX XXXX). Each match must hold enough digits to be what it says (a phone 7+), so "call 1,200 customers" stays a figure.
  const NAP_RES = [
    [/(?:\+|\b00)\d{1,4}[\s.\-]?(?:\(\d{1,4}\)[\s.\-]?)?(?:\d{1,5}[\s.\-]?){1,5}\d{1,5}\b/g, 8],
    [/\b(?:tel|telephone|phone|call(?:\s+us)?|mobile|whatsapp|fax|toll[\s\-]?free|landline|hotline)\b[^\n.]{0,30}?(?:\(\d{1,5}\)\s?|\b0)\d[\d\s.\-]{4,}\d/gi, 7],
    [/\b(?:tel|telephone|phone|call(?:\s+us)?|mobile|whatsapp|fax|toll[\s\-]?free|landline|hotline)\b[^\n.]{0,30}?\b\d{2,5}(?:[\s.\-]\d{2,5}){1,4}\b/gi, 7],
    [/\(\+?\d{1,5}\)\s?\d[\d\s.\-]{4,}\d/g, 7],
    [/\b0\d{1,3}[\s.\-]\d{3,4}[\s.\-]?\d{3,4}\b/g, 8],
    [/\bBox\s*[:#]?\s*\d[\d\-]{1,10}/g, 3],
    [/\b(?:open(?:ing)?|hours|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b[^\n.]{0,40}?\b(?:[01]\d|2[0-3])[:.]?[0-5]\d\s*(?:-|to|until|till)\s*(?:[01]\d|2[0-3])[:.]?[0-5]\d\b/gi, 6],
    [/\b0\d[:.]?[0-5]\d\s*(?:-|to|until|till)\s*(?:[01]\d|2[0-3])[:.]?[0-5]\d\b/gi, 6],
    [/\b(?:p\.?\s?o\.?\s?box|post\s?box|postcode|post(?:al)?\s?code|zip(?:\s?code)?|pin\s?code)\s*[:#.]?\s*[A-Z]{0,2}\d[\d\s\-]{1,10}/gi, 2],
    [/,\s*[A-Z]{2}\s\d{5}(?:-\d{4})?\b/g, 5],
    [/\b(?:Office|Suite|Unit|Floor|Level|Building|Bldg|Tower|Villa|Shop|Flat|Apartment|Apt|Room|Plot|Block|Warehouse|Street|Road|Avenue)\s*(?:No\.?|Number|#)?\s*\d{1,6}[A-Za-z]?\b(?![,.]\d)/g, 1],
    [/\b\d{1,6}[A-Za-z]?,?\s+(?:[A-Z][\w'\-]*\s+){0,4}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Highway|Hwy|Square)(?=[\s,.;]|$)/g, 1]
  ];
  const napSpans = (t) => { const out = []; const s = S(t);
    for (const [re, minDigits] of NAP_RES) for (const m of s.matchAll(re)) if ((m[0].match(/\d/g) || []).length >= minDigits) out.push([m.index, m.index + m[0].length]);
    return out; };
  const strongName = (name, tier) => { const n = S(name).replace(/^the\s+/i, '').replace(/[.,;:]+$/, '').trim(); if (!n) return false; if (OFFICIAL.test(n)) return true;
    if (typeof tier !== 'function') return false; const sq = n.toLowerCase().replace(/'s$/, '').replace(/[^a-z0-9]+/g, ''); return sq.length >= 2 && tier('https://' + sq + '.com/') !== 'weak'; };
  const sources = (md, ctx, opts) => {
    const c = ctx || {}; const o = opts || {}; const M = maxOf(o.max); const tier = typeof o.tier === 'function' ? o.tier : null; const figs = typeof o.figures === 'function' ? o.figures : null;
    const d = S(c.domain).toLowerCase().replace(/^www\./, ''); const own = (h) => !!d && (h === d || h.endsWith('.' + d));
    const ownText = S(c.own_text).toLowerCase();
    const U = units(md).filter(u => u.kind !== 'heading' && !u.qa);
    const linkTier = (u) => { const h = hostOf(u); if (!h || own(h) || SOCIAL.test(h)) return null; return tier ? tier(u) : 'weak'; };
    const linksOf = (t) => [...S(t).matchAll(/\[([^\[\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map(m => ({ url: m[2], tier: linkTier(m[2]) })).filter(x => x.tier);
    const paraLinks = new Map(); for (const u of U) { const k = u.section + ':' + u.para; const ls = linksOf(u.text); if (ls.length) paraLinks.set(k, (paraLinks.get(k) || []).concat(ls)); }
    // H1: the client's own phone and address on file (own_text: Content QA adds the profile's and the site model's NAP) are theirs in any
    // spelling: the run of digits a figure sits in (spaces, dots, dashes and brackets between them) equals one on file, or the two share
    // their last 7 digits (a number written with and without its country code or trunk 0)
    const ownRuns = [...S(c.own_text).matchAll(/\+?\d[\d\s.()\-]{2,}\d/g)].map(m => m[0].replace(/\D+/g, '')).filter(x => x.length >= 4);
    const runAt = (p, x) => { let a = x.index, b = x.index + S(x.raw).length; while (a > 0 && /[\d\s.()+\-]/.test(p[a - 1])) a--; while (b < p.length && /[\d\s.()\-]/.test(p[b])) b++; return p.slice(a, b).replace(/\D+/g, ''); };
    const ownNum = (p, x) => { if (!ownRuns.length) return false; const dg = runAt(p, x); return dg.length >= 4 && ownRuns.some(o => o === dg || (o.length >= 7 && dg.length >= 7 && o.slice(-7) === dg.slice(-7))); };
    const figureIn = (p) => { if (!figs) return null; const nap = napSpans(p);
      const f = (figs(p) || []).filter(x => x && !x.year && !STD.test(p.slice(Math.max(0, x.index - 16), x.index).trim())
        && !nap.some(([a, b]) => x.index >= a && x.index < b));
      const left = f.filter(x => !(ownText && ownText.includes(S(x.raw).toLowerCase())) && !ownNum(p, x)); return left.length ? left[0] : null; };
    const list = []; let strong = 0, weakOnly = 0, weakCompliance = 0, weakCited = 0, unsourced = 0;
    for (const u of U) {
      const text = plain(u.text); if (!text) continue;
      const links = linksOf(u.text); const fig = figureIn(text);
      const am = text.match(ATTR) || (fig ? text.match(ATTR_FIG) : null); const named = am ? S(am[1] || am[2]) : '';
      if (!links.length && !fig && !named) continue;
      const ls = links.length ? links : (fig ? paraLinks.get(u.section + ':' + u.para) || [] : []);
      const isStrong = ls.some(x => x.tier !== 'weak') || (!!named && strongName(named, tier));
      const onlyWeak = !isStrong && ls.length > 0 && ls.every(x => x.tier === 'weak');
      const unit = { text: text.slice(0, 200), strong: isStrong, figure: fig ? S(fig.raw) : '', named: named.slice(0, 80), weak_only: false, compliance: false };
      if (fig && onlyWeak && FIG_TOPIC.test(text)) { unit.weak_only = true; weakOnly++; if (COMPLIANCE.test(text)) { unit.compliance = true; weakCompliance++; } }
      // M2: a sentence that rests on a weak source (no market / cost / compliance figure of its own) is cited, only not by an authority: half a
      // strong one. A figure resting on nothing at all is unsourced: no credit.
      else if (!isStrong && (ls.length || named)) { unit.weak_cite = true; weakCited++; }
      else if (!isStrong && fig) { unit.unsourced = true; unsourced++; }
      if (isStrong) strong++;
      list.push(unit);
    }
    const n = list.length; const none = M.sources * SHARE.sources_none;
    if (!n) return { units: 0, strong: 0, share: null, weak_only: 0, weak_compliance: 0, weak_cited: 0, unsourced: 0, points: r1(none), capped: false, not_checked: true,
      note: 'Sources not checked: the page cites no outside page and states no figure that needs one (4 of 5 of the part: citing an official body, a research house, major press or vendor documentation earns the rest)', list: [] };
    const share = strong / n;
    // the half credit holds while no market, cost or compliance figure rests only on a weak source: on a page that leans on weak sources for
    // its figures (3336, the expert's 63), its other weak citations are the same problem and earn nothing (PLAN 5.2 pin 2 stays <= 72)
    const half = weakOnly ? 0 : SHARE.weak_cite;
    let pts = clamp(M.sources * (strong + half * weakCited) / n - M.sources * SHARE.weak_figure * weakOnly, 0, M.sources); let capped = false; let floored = false;
    // M2: citing only weak pages is never worse than citing nothing, while no figure on the page is unsourced or weak-only (those cost the share)
    if (!weakOnly && !unsourced && pts < none) { pts = none; floored = true; }
    if (weakCompliance && pts > M.sources * SHARE.sources_compliance) { pts = M.sources * SHARE.sources_compliance; capped = true; }
    return { units: n, strong, share: Math.round(share * 100), weak_only: weakOnly, weak_compliance: weakCompliance, weak_cited: weakCited, unsourced, points: r1(pts), capped, floored,
      note: strong + ' of the ' + n + ' cited sentences and figures rest on an official body, a research house, major press or vendor documentation'
        + (weakCited ? '; ' + weakCited + ' cite' + (weakCited === 1 ? 's' : '') + ' a page with no independent authority (' + (half ? 'half credit' : 'no credit while a figure rests only on such a page') + (floored ? ', and never less than citing nothing' : '') + ')' : '')
        + (unsourced ? '; ' + unsourced + ' figure' + (unsourced === 1 ? ' has' : 's have') + ' no source' : '')
        + (weakOnly ? '; ' + weakOnly + ' market, cost or compliance figure' + (weakOnly === 1 ? ' rests' : 's rest') + ' only on a source with no independent authority' : ''),
      list: list.filter(x => !x.strong).slice(0, 8) };
  };

  // ---------- 4. fit with the search: the verdict, and the page the website already has ----------
  // fitOf(prev): from a content run's Parse Brief item (verdict_score, verdict_acknowledged, hold_exempt / the page's own fields) or from the
  // Finalize brief (prc.gating: score, verdict, verdict_acknowledged). A withheld or missing score is null: "not checked", full points.
  const fitOf = (prev) => {
    const p = prev || {}; const g = ((p.prc || {}).gating) || {};
    const withheld = p.score_withheld === true || g.score_withheld === true || /^NOT_CHECKED$/i.test(S(p.verdict || g.verdict));
    const score = withheld ? null : (num(p.verdict_score) != null ? num(p.verdict_score) : num(g.score));
    const ack = p.verdict_acknowledged === true || g.verdict_acknowledged === true || !!(p.hold_ack && typeof p.hold_ack === 'object');
    const ex0 = S(p.hold_exempt).match(/score:\s*([^;]+)/);
    const ladder = !!S(p.ladder_id) && p.ladder_rung != null && p.ladder_rung !== '';
    const caseStudy = !!S(p.case_id) || S(p.page_role) === 'case_study' || /case stud/i.test(S(p.page_type));
    const aiPage = !!(p.ai_target && typeof p.ai_target === 'object' && S(p.ai_target.question));
    const refresh = !!S(p.existing_page_url);
    const exempt = ex0 ? ex0[1].trim() : caseStudy ? 'a case study: its keyword is the case name' : aiPage ? 'a page written to be cited in AI answers'
      : refresh ? 'a refresh of a page your website already has' : ladder ? 'a page of your keyword ladder: the ladder checked its main keyword when it was planned' : '';
    const automatic = /^(cadence|ladder|tracker|casestudy|audit):/i.test(S(p.client_ip));
    return { verdict_score: score, withheld, acknowledged: ack, exempt, automatic };
  };
  const fit = (f0, dup, max) => {
    const f = f0 || {}; const sc = num(f.verdict_score); const D = dup || {}; const M = Number.isFinite(Number(max)) ? Number(max) : MAX.fit; const half = M / 2;
    const vp = sc == null || sc >= CFG.verdict_bar ? half : sc >= 30 ? half * SHARE.verdict_partial : 0;
    const dp = D.open || D.differs ? 0 : half;
    let pts = vp + dp; const caps = [];
    if (sc != null && sc < CFG.verdict_bar && pts > M * SHARE.fit_verdict) { pts = M * SHARE.fit_verdict; caps.push({ dim: 'fit', share: SHARE.fit_verdict, why: 'our verdict scored this search ' + sc + ' out of 100, under ' + CFG.verdict_bar }); }
    if ((D.open || D.differs) && pts > M * SHARE.fit_duplicate) { pts = M * SHARE.fit_duplicate; caps.push({ dim: 'fit', share: SHARE.fit_duplicate, why: D.open ? 'your website already has a page for this search' : 'published beside the page your website has for this search' }); }
    const band = sc == null ? 'not_checked' : sc >= CFG.verdict_bar ? 'full' : sc >= 30 ? 'partial' : 'none';
    const note = sc == null ? 'Fit not checked: ' + (f.withheld ? 'the verdict could not score this search' : 'no verdict score was kept with this page') + ', so fit takes its full points'
      : 'Our verdict scored this search ' + sc + ' out of 100' + (sc < CFG.verdict_bar ? (f.acknowledged ? ', and you chose to write it anyway' : f.exempt ? ' (' + f.exempt + ')' : '') : '');
    return { points: r1(pts), verdict_points: r1(vp), duplicate_points: r1(dp), band, caps, note };
  };

  // ---------- 4b. W06-A: what the run took out of the page ----------
  // rm: { sections, words, words_before, h2_before, h2_removed, h2_now, headings } (EXC.removedOf on the page run's state, plus the page's
  // H2 count now). Sections the edits lost count too (the H2s of the first draft that are neither on the page nor deleted on purpose).
  // Two sections or a fifth of the words taken out cap coverage and fit at 40% of their parts: on the live K1 page (W05 run) six core
  // sections went and the grade still read fit 20 of 20, "Ready".
  const removedCap = (rm, max) => {
    const R = rm && typeof rm === 'object' ? rm : null; if (!R) return null; const M = maxOf(max);
    const excl = Math.max(0, Number(R.sections) || 0);
    const byEdits = Number(R.h2_before) > 0 && R.h2_now != null && Number.isFinite(Number(R.h2_now)) ? Math.max(0, Number(R.h2_before) - (Number(R.h2_removed) || 0) - Number(R.h2_now)) : 0;
    const share = Number(R.words_before) > 0 && Number(R.words) > 0 ? Number(R.words) / Number(R.words_before) : 0;
    const n = excl + byEdits;
    if (n < CFG.removed.sections && share < CFG.removed.share) return null;
    const pct = Math.round(share * 100);
    const why = (excl ? excl + ' section' + (excl === 1 ? ' was' : 's were') + ' taken out as a topic the verdict said to leave out' : '')
      + (excl && byEdits ? ', and ' : '') + (byEdits ? byEdits + ' section' + (byEdits === 1 ? ' was' : 's were') + ' lost in editing' : '') + (pct ? ' (' + pct + '% of the words)' : '');
    return { limit: { coverage: M.coverage * SHARE.removed, fit: M.fit * SHARE.removed }, why: clean(why),
      note: clean('Coverage and fit are limited to ' + Math.round(SHARE.removed * 100) + '% of their points: ' + why + ', so the page no longer covers what its search asks. Write the missing sections back, or start a new page run'),
      record: { sections: excl, by_edits: byEdits, words: Number(R.words) || 0, share_pct: pct, headings: (Array.isArray(R.headings) ? R.headings : []).slice(0, 8), capped: true } }; };

  // ---------- 5. the page-local grade (Content QA) ----------
  // parts: what Content QA already measures, as fractions or on their old scales: structure_frac (0-1), coverage_ratio (0-1),
  // readability_pts (of 15), specificity_pts (of 10), clean_pts (of 10). ctx: keyword, brand_names, domain, own_text, prev (the brief item).
  // opts: tier / figures (Content QA's SRC kit), max (a page-type weighting; the default is MAX).
  const local = (parts, md, ctx, opts) => {
    const P = parts || {}; const c = ctx || {}; const o = opts || {}; const M = maxOf(o.max);
    const rep = repetition(md, c); const lab = listLabels(md); const src = sources(md, c, { ...o, max: M }); const F = fitOf(c.prev || {}); const fi = fit(F, null, M.fit);
    const caps = fi.caps.slice();
    let structure = clamp(M.structure * clamp(Number(P.structure_frac) || 0, 0, 1) - Math.min(8, 3 * rep.count) * M.structure / 20 - Math.min(4, 2 * lab.count) * M.structure / 20, 0, M.structure);
    if (rep.worst >= CFG.cluster_cap && structure > M.structure * SHARE.structure_repeat) { structure = M.structure * SHARE.structure_repeat; caps.push({ dim: 'structure', share: SHARE.structure_repeat, why: 'one statement is made ' + rep.worst + ' times' }); }
    // W06-A: an idea restated 4+ times that the statement check did not already count costs 2 points of structure (up to 4), never below
    // half the part, so it alone never turns a page into "Needs work"
    const idw = ideas(md, c); const seenRep = new Set(rep.clusters.flatMap(x => x.members || []).map(x => S(x).slice(0, 60)));
    const idNew = idw.ideas.filter(x => !x.members.some(m => seenRep.has(S(m).slice(0, 60))));
    let ideaCut = 0;
    if (idNew.length) { const want = Math.min(CFG.idea.max_points, CFG.idea.points * idNew.length) * M.structure / 20; const room = Math.max(0, structure - M.structure * CFG.floor);
      ideaCut = Math.min(want, room); structure -= ideaCut; }
    const RM = removedCap(c.removed, M);
    if (src.capped) caps.push({ dim: 'sources', share: SHARE.sources_compliance, why: 'a compliance figure rests only on a source with no independent authority' });
    const raw = { structure, coverage: M.coverage * clamp(Number(P.coverage_ratio) || 0, 0, 1), readability: M.readability * clamp((Number(P.readability_pts) || 0) / 15, 0, 1),
      specificity: M.specificity * clamp((Number(P.specificity_pts) || 0) / 10, 0, 1), clean_language: M.clean_language * clamp((Number(P.clean_pts) || 0) / 10, 0, 1), sources: src.points, fit: fi.points, length: 0 };
    if (RM) for (const k of ['coverage', 'fit']) if (raw[k] > RM.limit[k]) { raw[k] = RM.limit[k]; caps.push({ dim: k, share: SHARE.removed, why: RM.why }); }
    const breakdown = {}; for (const k of Object.keys(raw)) breakdown[k] = Math.round(raw[k]);
    const notes = [fi.note, src.note, 'Length is advice only: it carries no points'];
    if (rep.count) notes.push(rep.count + ' statement' + (rep.count === 1 ? ' is' : 's are') + ' made three or more times: ' + rep.clusters.slice(0, 3).map(x => '"' + x.sample + '" (' + x.size + ' times)').join('; '));
    if (idNew.length) notes.push(idNew.length + ' idea' + (idNew.length === 1 ? ' is' : 's are') + ' restated four or more times in different places' + (ideaCut ? ' (' + r1(ideaCut) + ' point' + (r1(ideaCut) === 1 ? '' : 's') + ' off structure)' : '') + ': '
      + idNew.slice(0, 2).map(x => '"' + x.sample.slice(0, 110) + '" (' + x.size + ' times)').join('; ') + '. Say it once where the reader decides, and point back to it');
    if (RM) notes.push(RM.note);
    if (lab.count) notes.push('The same label introduces two different lists: ' + lab.collisions.map(x => '"' + x.lead + '"').join(', '));
    return { version: VERSION, score: DIMS.reduce((s, k) => s + breakdown[k], 0), of: 100, breakdown, max: M, caps,
      items: { repetition: { count: rep.count, worst: rep.worst, clusters: rep.clusters.slice(0, 5) }, list_labels: lab.collisions,
        ideas: { count: idNew.length, points_off: r1(ideaCut), ideas: idNew.slice(0, 4) }, ...(RM ? { removed: RM.record } : {}),
        sources: { units: src.units, strong: src.strong, share: src.share, weak_only: src.weak_only, weak_compliance: src.weak_compliance, weak_cited: src.weak_cited, unsourced: src.unsourced, not_checked: !!src.not_checked, weak: src.list },
        fit: { verdict_score: F.verdict_score, band: fi.band, acknowledged: F.acknowledged, exempt: F.exempt, automatic: F.automatic, verdict_points: fi.verdict_points, duplicate_points: fi.duplicate_points } },
      notes: notes.map(clean) };
  };

  // ---------- 6. the delivered grade: blockers, the duplicate page, the floors (Page Candidates, Finalize Verdict, Apply Second Read) ----------
  // grade0: the grade object those nodes build (score / breakdown from Content QA's content_score / score_breakdown; `w0c` = Content QA's
  // grade_detail). blocking: the delivered blocking items ({ code }). o.decision: the client's duplicate-page decision (W0-B, D2).
  // A grade without `w0c` (a check from before this kit) is returned as it was, with its display.
  // W05-A (wave 0.5, 2026-10-30, BEFORE_AFTER.md): what the blind second read found that is not a factual error (an uncited contrast, a
  // figure that wants a source, a vague market figure, a law with no link, a statistics note, a repeated point) is ADVICE: it never caps
  // the total at 59 (only a blocker does), it takes points off the part it is about. Each advice item the client is shown costs 3 points
  // (high) or 1.5 (medium) of its part, at most a quarter of the part, and never below half the part: advice alone never turns a page into
  // "Needs work" (the floors judge what Content QA measured). Only an enforced read counts (shadow mode, the system's own runs and the
  // client's keyword ladder, records it and changes nothing: the guide that ranks, a ladder page, is never marked down by it).
  // o.review: the read's record (content_qa.critic_reread: { mode, status, advice: [{ severity, kind }] }); the deduction is kept on the
  // grade (review.advice) so a later cap of the same grade applies it once, from the parts before it (pre_review).
  const REVIEW_DIM = { fact: 'sources', source: 'sources', claim: 'sources', local: 'sources', repetition: 'structure', structure: 'structure', link: 'structure',
    depth: 'specificity', intent: 'fit', style: 'clean_language' };
  const REVIEW_PTS = { high: 3, medium: 1.5 };
  const reviewCut = (rv, b, M) => {
    const R = rv || {}; if (R.mode !== 'enforce' || (R.status && R.status !== 'checked')) return null;
    const items = (Array.isArray(R.advice) ? R.advice : []).filter(a => a && REVIEW_DIM[S(a.kind)] && REVIEW_PTS[S(a.severity)]).map(a => ({ kind: S(a.kind), severity: S(a.severity) }));
    if (!items.length) return null;
    const want = {}; for (const a of items) { const k = REVIEW_DIM[a.kind]; want[k] = (want[k] || 0) + REVIEW_PTS[a.severity]; }
    const cut = {}; let total = 0;
    for (const k of Object.keys(want)) { if (!M[k]) continue; const room = Math.max(0, (Number(b[k]) || 0) - M[k] * CFG.floor);
      const c = Math.floor(Math.min(want[k], M[k] * CFG.review_share, room)); if (c > 0) { cut[k] = c; total += c; } }
    const parts = Object.keys(cut).map(k => LABEL[k] + ' -' + cut[k]);
    return { mode: 'enforce', status: 'checked', advice: items, cut, total,
      note: clean('A second read of the page found ' + items.length + ' thing' + (items.length === 1 ? '' : 's') + ' to improve before publishing' + (total ? ': ' + total + ' point' + (total === 1 ? '' : 's') + ' off (' + parts.join(', ') + ')' : ', already reflected in the parts')) }; };
  const cap = (grade0, blocking, o0) => {
    const g = { ...(grade0 || {}) }; const o = o0 || {}; const W = g.w0c || o.w0c || null;
    if (!W || !g.breakdown || g.score == null) return { ...g, display: display(g.score) };
    const M = maxOf(W.max); const b = { ...(g.pre_review && typeof g.pre_review === 'object' ? g.pre_review : g.breakdown) }; const caps = (W.caps || []).slice(); const F = (W.items || {}).fit || {};
    const codes = (blocking || []).map(x => S(x && x.code)).filter(Boolean);
    const dupOpen = codes.includes('duplicate_page'); const differs = !!(o.decision && o.decision.choice === 'differs');
    if (dupOpen || differs) { const fi = fit(F, { open: dupOpen, differs }, M.fit); for (const x of fi.caps) if (!caps.some(y => y.dim === x.dim && y.share === x.share)) caps.push(x); b.fit = Math.round(fi.points); }
    // W06-A: sections the run took out of the page cap coverage and fit (from the page run's state here, or the check's own record)
    const RMc = o.removed ? removedCap(o.removed, M) : null;
    const RMrec = RMc ? RMc.record : (g.removed && g.removed.capped ? g.removed : ((W.items || {}).removed && (W.items || {}).removed.capped ? W.items.removed : null));
    if (RMc) for (const k of ['coverage', 'fit']) { const lim = Math.round(RMc.limit[k]); if ((Number(b[k]) || 0) > lim) { b[k] = lim; if (!caps.some(y => y.dim === k && y.share === SHARE.removed)) caps.push({ dim: k, share: SHARE.removed, why: RMc.why }); } }
    // W05-A: the second read's advice, off its parts (from the parts before it, so it is applied once)
    const pre = { ...b }; const rv = reviewCut(o.review !== undefined ? o.review : (g.review && Array.isArray(g.review.advice) ? g.review : null), b, M);
    if (rv) for (const k of Object.keys(rv.cut)) b[k] = (Number(b[k]) || 0) - rv.cut[k];
    let total = DIMS.reduce((s, k) => s + (Number(b[k]) || 0), 0);
    if (codes.length && total > CFG.blocker_cap) { total = CFG.blocker_cap; caps.push({ dim: 'total', to: CFG.blocker_cap, why: codes.length + ' point' + (codes.length === 1 ? '' : 's') + ' still stop' + (codes.length === 1 ? 's' : '') + ' this page' }); }
    const failing = [], waived = [], shadow = [];
    for (const k of DIMS) {
      if (!M[k] || (Number(b[k]) || 0) >= M[k] * CFG.floor) continue;
      if (k === 'fit' && !dupOpen && !differs && !RMrec && (F.acknowledged || F.exempt)) { waived.push({ dim: k, why: F.acknowledged ? 'your choice: low search demand (you chose to write it anyway)' : 'chosen by your plan: ' + F.exempt }); continue; }
      if (k === 'fit' && !dupOpen && !differs && !RMrec && F.automatic) { shadow.push({ dim: k, why: 'started automatically: recorded, not applied yet' }); continue; }
      failing.push({ dim: k, label: LABEL[k], points: Number(b[k]) || 0, max: M[k], fix: clean(FIX[k](RMrec ? { ...W, items: { ...(W.items || {}), removed: RMrec } } : W)) });
    }
    const score = Math.round(total);
    const R0 = { ...g }; delete R0.review; delete R0.pre_review;
    return { ...R0, ...(rv ? { review: rv, pre_review: pre } : {}), ...(RMrec ? { removed: RMrec } : {}), score, display: display(score), breakdown: b, max: M, scale: VERSION, caps,
      floors: { ok: failing.length === 0, failing, waived, shadow, rule: 'Ready needs no open blocker and every part at or above half its points' },
      ready: codes.length === 0 && failing.length === 0 };
  };
  const FIX = {
    structure: (W) => { const r = ((W.items || {}).repetition || {}); const l = (W.items || {}).list_labels || []; const id = ((W.items || {}).ideas || {});
      return r.count ? 'Say each point once: "' + S((r.clusters || [])[0] && r.clusters[0].sample).slice(0, 90) + '" is made ' + r.worst + ' times'
        : l.length ? 'Give each list its own label: "' + S(l[0].lead).slice(0, 90) + '" introduces two lists'
          : id.count ? 'Say each idea once: "' + S((id.ideas || [])[0] && id.ideas[0].sample).slice(0, 90) + '" is restated ' + ((id.ideas || [])[0] || {}).size + ' times' : 'Give the page its headings, Quick answer, table and links back'; },
    coverage: (W) => (((W.items || {}).removed || {}).capped ? 'Write back the sections this run took out (' + S((((W.items || {}).removed || {}).headings || []).slice(0, 3).join('; ')).slice(0, 160) + '), or start a new page run' : 'Cover the topics the pages that rank cover (the missing terms are in the advice)'),
    readability: () => 'Use shorter sentences and plainer words',
    specificity: () => 'Add concrete examples, steps or decision rules in place of general statements',
    clean_language: () => 'Rewrite the filler phrases listed in the advice in plain, specific words',
    sources: (W) => { const s = ((W.items || {}).sources || {}); return 'Cite an official body, a research house, major press or vendor documentation'
      + ((s.weak || []).length ? ' for "' + S(s.weak[0].text).slice(0, 90) + '"' + (s.weak.length > 1 ? ' and ' + (s.weak.length - 1) + ' more' : '') : ''); },
    fit: (W) => { const f = ((W.items || {}).fit || {}); if (((W.items || {}).removed || {}).capped) return 'The page lost the sections that answer its search: write them back, or start a new page run'; return f.verdict_score != null && f.verdict_score < CFG.verdict_bar ? 'Our verdict scored this search ' + f.verdict_score + ' out of 100: improve a page your website already has, or choose "Write it anyway" to keep this one' : 'Publish this text as an update of the page your website has for this search'; }
  };
  // the delivered status: a page with no blocker that fails a floor is "Needs work: <parts>", never "Ready to publish". It stays publishable
  // (nothing stops the client): the status and label change, the items say what to improve, and a not-ready page is left as it is.
  const deliver = (del0, grade) => {
    const del = { ...(del0 || {}) }; const fl = (grade || {}).floors || null;
    if (!fl || fl.ok || del.status === 'not_ready') return del;
    const parts = fl.failing.map(x => x.label);
    return { ...del, status: 'needs_work', label: clean('Needs work: ' + parts.join(', ')),
      needs_work: fl.failing.map(x => ({ code: 'needs_work', dim: x.dim, text: clean(x.label.charAt(0).toUpperCase() + x.label.slice(1) + ' scored ' + x.points + ' of ' + x.max + ', under half its points'), action: x.fix })),
      next_step: clean('Nothing stops you publishing this page, but ' + (parts.length === 1 ? 'one part is' : parts.length + ' parts are') + ' under half marks (' + parts.join(', ') + '). '
        + fl.failing.map(x => x.fix.replace(/[.\s]+$/, '')).join('. ') + '. Change it in the editor and make the final version, or approve it as it is.') };
  };
  const display = (n) => n == null || n === '' || !Number.isFinite(Number(n)) ? '' : Math.round(Number(n)) >= CFG.display_top ? CFG.display_top + '+' : String(Math.round(Number(n)));
  const basis = 'structure 20 (a statement made three or more times and one label for two lists cost points), topic coverage 15, readability 10, specificity 10, plain language 10, sources 15, fit with the search 20; length is advice only';
  return { VERSION, MAX, DIMS, LABEL, SHARE, CFG, REVIEW_DIM, REVIEW_PTS, reviewCut, units, repetition, ideas, listLabels, sources, fitOf, fit, removedCap, local, cap, deliver, display, basis };
})();
return $input.all().map(i => { const j = i.json || {}; const a = (j.args || []).map(x => x === '__SRC__' ? { tier: SRC.tier, figures: SRC.figures } : (x && typeof x === 'object' && x.__src__ ? { ...x, tier: SRC.tier, figures: SRC.figures, __src__: undefined } : x)); return { json: { r: GR[j.fn].apply(null, a) } }; });
