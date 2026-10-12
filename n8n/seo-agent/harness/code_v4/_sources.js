// harness shim (written by build_v4.py section 32): the source kit - { url?, text?, figure?, source? } -> clean / tier / figures / hasFigure
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
  // the magnitude is part of the figure: "AED 50 million" in the source does not vouch for "AED 50bn" in the draft
  const valueSet = (text) => { const s = new Set(); for (const f of figures(text)) s.add(f.v); return s; };
  const hasFigure = (f, text) => !!f && valueSet(text).has(f.v);
  return { TRACK, clean, key, host, tier, TIERS, strong, figures, valueOf, valueSet, hasFigure, FIG_RE };
})();
return $input.all().map(i => { const j = i.json || {}; return { json: { url: j.url == null ? null : SRC.clean(j.url), host: j.url ? SRC.host(j.url) : '', tier: j.url ? SRC.tier(j.url) : '', figures: SRC.figures(j.text || ''), found: (j.figure != null && j.source != null) ? SRC.hasFigure(SRC.valueOf(j.figure), j.source) : null } }; });
