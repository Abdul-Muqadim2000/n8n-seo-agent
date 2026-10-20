// ---- the stored style guide (G31, 2026-10-13, system review FIX_PLAN.md; criterion CAD C17) ----
// Nothing stored how the customer writes: the brand's written form ("Tech&", never "Tech and" or "techand"), the spelling variant, the
// words they do not want used and the tone. The guide now lives on the site's business profile row (seo_profiles.style_*), so every run
// that already loads the profile carries it — no new read, no new API call — and ST turns it into three things:
//   ST.from(row, defaults)  the guide, with the spelling variant falling back to the market the page targets
//   ST.block(guide)         the HOUSE STYLE paragraph the brief, copywriter and editor prompts print
//   ST.check(markdown, g)   the mechanical checks: `errors` (the brand's own name written wrongly — a real quality finding) and
//                           `notes` (advice: spelling variant, words to avoid, tone signals) that never fail a page on their own
// Every check is mechanical and quiet: it counts exact matches, quotes what it found, and says nothing when the guide is empty.
const ST = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const list = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => S(x)).filter(Boolean);
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const VARIANTS = ['British English', 'American English'];
  // British / American pairs that are unambiguous. Pairs where the two spellings mean different things in British English
  // (licence / license, practise / practice) or where both are correct (programme / program for software, enquiry / inquiry,
  // judgement / judgment, grey / gray) are deliberately left out: a style check must not invent an error.
  const PAIRS = [
    ['organise', 'organize'], ['organised', 'organized'], ['organising', 'organizing'], ['organisation', 'organization'], ['organisations', 'organizations'],
    ['optimise', 'optimize'], ['optimised', 'optimized'], ['optimising', 'optimizing'], ['optimisation', 'optimization'],
    ['analyse', 'analyze'], ['analysed', 'analyzed'], ['analysing', 'analyzing'],
    ['recognise', 'recognize'], ['recognised', 'recognized'], ['specialise', 'specialize'], ['specialised', 'specialized'],
    ['prioritise', 'prioritize'], ['prioritised', 'prioritized'], ['customise', 'customize'], ['customised', 'customized'],
    ['standardise', 'standardize'], ['standardised', 'standardized'], ['centralise', 'centralize'], ['centralised', 'centralized'],
    ['summarise', 'summarize'], ['summarised', 'summarized'], ['utilise', 'utilize'], ['realise', 'realize'],
    ['minimise', 'minimize'], ['maximise', 'maximize'], ['digitise', 'digitize'], ['digitised', 'digitized'], ['digitisation', 'digitization'],
    ['colour', 'color'], ['colours', 'colors'], ['behaviour', 'behavior'], ['behaviours', 'behaviors'],
    ['favour', 'favor'], ['favourite', 'favorite'], ['labour', 'labor'], ['honour', 'honor'],
    ['centre', 'center'], ['centres', 'centers'], ['metre', 'meter'], ['metres', 'meters'], ['theatre', 'theater'], ['fibre', 'fiber'],
    ['defence', 'defense'], ['offence', 'offense'], ['catalogue', 'catalog'], ['catalogues', 'catalogs'], ['dialogue', 'dialog'],
    ['fulfil', 'fulfill'], ['fulfilment', 'fulfillment'], ['enrolment', 'enrollment'], ['instalment', 'installment'], ['skilful', 'skillful'],
    ['travelling', 'traveling'], ['cancelled', 'canceled'], ['cancelling', 'canceling'], ['modelling', 'modeling'], ['labelled', 'labeled'], ['labelling', 'labeling']
  ];

  // Wrong written forms of a brand, derived from the one correct form: the "&" spelled out ("Tech and"), the same words run
  // together ("Techand") and hyphenated ("Tech-and"). The customer can add more (style_brand_wrong).
  function wrongForms(form, extra) {
    const f = S(form);
    const out = [];
    const add = (v) => { const x = S(v); if (x && x.toLowerCase() !== f.toLowerCase() && !out.some(y => y.toLowerCase() === x.toLowerCase())) out.push(x); };
    if (f) {
      const words = f.replace(/&/g, ' and ').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
      if (words.length) { add(words.join(' ')); add(words.join('')); add(words.join('-')); }
    }
    for (const e of list(extra)) add(e);
    return out.slice(0, 16);
  }

  function from(row, o = {}) {
    const r = row || {};
    const brand_form = S(r.style_brand_form) || S(o.brand_form);
    const raw = S(r.style_spelling);
    const spelling = /brit|en.?gb|\bgb\b|\buk\b/i.test(raw) ? 'British English' : /amer|en.?us|\bus\b/i.test(raw) ? 'American English' : '';
    const avoid = list(r.style_avoid).slice(0, 40);
    const tone = S(r.style_tone);
    const notes = S(r.style_notes);
    const g = { on_file: !!(brand_form || spelling || avoid.length || tone || notes), brand_form, brand_wrong: list(r.style_brand_wrong).slice(0, 12),
      spelling, spelling_effective: spelling || S(o.spelling), spelling_source: spelling ? 'the style guide' : (S(o.spelling) ? 'the market this page targets' : ''),
      avoid, tone, tone_effective: tone || S(o.tone), notes };
    g.wrong_forms = wrongForms(brand_form, g.brand_wrong);
    g.prompt_block = block(g);
    return g;
  }

  // the paragraph the writing prompts print (empty when nothing is on file, so no prompt gains a meaningless line)
  function block(g) {
    const x = g || {};
    if (!x.on_file) return '';
    const parts = [];
    if (x.brand_form) parts.push('Write the business name exactly as "' + x.brand_form + '" everywhere, including headings, the title and the meta description'
      + ((x.wrong_forms || []).length ? ' — never ' + x.wrong_forms.map(w => '"' + w + '"').join(' or ') : '') + '.');
    if (x.spelling_effective) parts.push('Use ' + x.spelling_effective + ' spelling throughout (' + (x.spelling_source || 'house style') + ').');
    if ((x.avoid || []).length) parts.push('Never use these words or phrases: ' + x.avoid.map(w => '"' + w + '"').join(', ') + '.');
    if (x.tone) parts.push('Tone: ' + x.tone + '.');
    if (x.notes) parts.push(x.notes);
    return 'HOUSE STYLE (the customer\'s own style guide — follow it exactly)\n' + parts.map(p => '- ' + p).join('\n');
  }

  // what we scan: the prose, without code blocks, the meta lines, link targets, bare URLs and HTML tags, so a brand name inside a
  // slug or a URL is never read as prose
  const scrub = (md) => String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):.*$/gim, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]*>/g, ' ');
  const hits = (text, term) => {
    const t = S(term);
    if (!t) return [];
    const re = new RegExp('(?<![A-Za-z0-9])' + esc(t).replace(/\s+/g, '[\\s\\u00a0]+') + '(?![A-Za-z0-9])', 'gi');
    const out = []; let m;
    while ((m = re.exec(text))) out.push({ text: m[0], at: m.index });
    return out;
  };

  function check(md, guide) {
    const g = guide || {};
    const text = scrub(md);
    const res = { on_file: !!g.on_file, brand: [], spelling: { variant: g.spelling_effective || '', checked: false, wrong: [], count: 0 },
      avoid: [], tone: { exclamations: 0 }, errors: [], notes: [] };
    if (!g.on_file) return res;

    // 1. the brand's own name: the one hard check. A run-together form ("techand") is never prose, so every case counts; a spaced
    //    form ("Tech and") counts only where it reads as a name (capitalised), so "tech and finance teams" is not an error.
    if (g.brand_form) {
      const byForm = new Map();
      for (const w of (g.wrong_forms || [])) {
        const spaced = /\s/.test(w);
        for (const h of hits(text, w)) {
          if (spaced && !/^[A-Z]/.test(h.text)) continue;
          const k = h.text;
          byForm.set(k, (byForm.get(k) || 0) + 1);
        }
      }
      for (const h of hits(text, g.brand_form)) if (h.text !== g.brand_form) byForm.set(h.text, (byForm.get(h.text) || 0) + 1);
      res.brand = [...byForm.entries()].map(([found, count]) => ({ found, count })).sort((a, b) => b.count - a.count);
      const total = res.brand.reduce((s, x) => s + x.count, 0);
      if (total) res.errors.push('Brand name: ' + res.brand.map(b => '"' + b.found + '" (' + b.count + ')').join(', ')
        + ' — this business writes its name "' + g.brand_form + '". Correct every one.');
    }

    // 2. the spelling variant (advice)
    if (g.spelling_effective) {
      const gb = /brit/i.test(g.spelling_effective);
      const us = /amer/i.test(g.spelling_effective);
      if (gb || us) {
        res.spelling.checked = true;
        for (const [b, a] of PAIRS) {
          const wrong = gb ? a : b, right = gb ? b : a;
          const n = hits(text, wrong).length;
          if (n) res.spelling.wrong.push({ found: wrong, wanted: right, count: n });
        }
        res.spelling.wrong.sort((x, y) => y.count - x.count);
        res.spelling.count = res.spelling.wrong.reduce((s, x) => s + x.count, 0);
        if (res.spelling.count) res.notes.push('Spelling: ' + res.spelling.count + ' word(s) use ' + (gb ? 'American' : 'British') + ' spelling ('
          + res.spelling.wrong.slice(0, 5).map(w => '"' + w.found + '" -> "' + w.wanted + '"').join(', ') + ') where the style guide says ' + g.spelling_effective + '.');
      }
    }

    // 3. the words the customer does not want used (advice)
    for (const w of (g.avoid || [])) { const n = hits(text, w).length; if (n) res.avoid.push({ word: w, count: n }); }
    res.avoid.sort((a, b) => b.count - a.count);
    if (res.avoid.length) res.notes.push('Words to avoid: ' + res.avoid.slice(0, 8).map(a => '"' + a.word + '" (' + a.count + ')').join(', ')
      + ' — the style guide asks for these not to be used.');

    // 4. tone, mechanically: exclamation marks are the one signal that can be counted without judging the writing
    res.tone.exclamations = (text.match(/!/g) || []).length;
    if (g.tone && res.tone.exclamations) res.notes.push('Tone: ' + res.tone.exclamations + ' exclamation mark(s) in the page; the style guide asks for "' + g.tone + '".');
    return res;
  }

  return { from, block, check, wrongForms, scrub, VARIANTS, PAIRS };
})();
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
// ---- anchor kit (D9, 2026-10-11; inlined through the __ANCHOR__ marker): the words a link to one of our own pages is written with.
// Live, "Guides in this series" linked to "Facts erp" and "Erp software dubai" — a raw keyword string with one capital letter (exec 365).
// anchorText() uses the page's own title when we have one, else title-cases the keyword and keeps acronyms: a token that is already
// all-caps and at most 4 letters is left alone, a known acronym (erp, uae, vat, crm, …) is upper-cased, mixed-case names keep their shape,
// and the small joining words stay lower-case unless they start the anchor. Regex only (no URL constructor in the n8n Code sandbox).
const ACRONYMS = new Set(['erp', 'uae', 'vat', 'crm', 'seo', 'sem', 'ppc', 'api', 'ai', 'bi', 'hr', 'it', 'ui', 'ux', 'qa', 'b2b', 'b2c', 'd2c', 'ksa', 'gcc', 'eu', 'uk', 'us', 'usa', 'uae', 'pos', 'edi', 'gst', 'trn', 'asp', 'sme', 'smb', 'cms', 'roi', 'kpi', 'sla', 'ocr', 'cfo', 'ceo', 'cto', 'coo', 'cio', 'rfp', 'rfq', 'kyc', 'aml', 'iso', 'xml', 'json', 'csv', 'pdf', 'url', 'sap', 'wps', 'fta', 'llm', 'rpa', 'mrp', 'scm', 'plm', 'eam', 'etl', 'pim', 'epm', 'ocr', 'vpn', 'sso', 'mfa', 'cpa', 'cfa', 'ifrs', 'gaap', 'nda', 'tco', 'sku', 'erp']);
const ANCHOR_MIXED = { saas: 'SaaS', paas: 'PaaS', iaas: 'IaaS', ecommerce: 'eCommerce', zatca: 'ZATCA', peppol: 'Peppol', emaratax: 'EmaraTax', iphone: 'iPhone', ipad: 'iPad', javascript: 'JavaScript', wordpress: 'WordPress', youtube: 'YouTube', linkedin: 'LinkedIn', chatgpt: 'ChatGPT', openai: 'OpenAI', netsuite: 'NetSuite', quickbooks: 'QuickBooks', powerbi: 'PowerBI' };
const ANCHOR_SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'in', 'on', 'to', 'at', 'by', 'or', 'vs', 'via', 'with', 'from', 'into', 'per']);
function titleCaseKeyword(s) {
  const words = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.map((w, i) => {
    const bare = w.replace(/[^A-Za-z0-9&]/g, '');
    if (!bare) return w;
    if (bare === bare.toUpperCase() && bare.length <= 4 && /[A-Z]/.test(bare)) return w;   // already an acronym, e.g. "ERP"
    const low = bare.toLowerCase();
    const sub = (rep) => w.replace(bare, rep);
    if (ACRONYMS.has(low)) return sub(low.toUpperCase());
    if (ANCHOR_MIXED[low]) return sub(ANCHOR_MIXED[low]);
    if (i > 0 && ANCHOR_SMALL.has(low)) return sub(low);
    if (bare !== low && /[A-Z]/.test(bare.slice(1))) return w;   // a name the caller already cased ("McKinsey", "eInvoicing")
    return sub(low.charAt(0).toUpperCase() + low.slice(1));
  }).join(' ');
}
// a page = { title?, keyword?, url } -> the words to link it with (never an empty string, never a bare URL path in lower case)
function anchorText(p) {
  const o = p && typeof p === 'object' ? p : { keyword: p };
  const t = String(o.title || '').trim();
  if (t) return t.replace(/\s*\|\s*[^|]{1,40}$/, '').trim() || t;   // "ERP Software UAE | Tech&" -> "ERP Software UAE"
  const kw = String(o.keyword || '').trim();
  if (kw) return titleCaseKeyword(kw);
  const path = String(o.url || '').replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '').split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
  return titleCaseKeyword(path) || String(o.url || '');
}
// ---- the one site model (G19, 2026-10-12; see SITE_MODEL_SPEC.md; the builders inline this file where a node asks for the SITE_MODEL kit) ----
// Every workflow reads the same facts about a site through SM: the canonical host, the business name / logo / NAP (seo_profiles ->
// the homepage Organization / LocalBusiness schema -> Google Business Profile -> the fields the web app sent), the services and nav
// pages, the page inventory (seo_pages), the business facts, the call to action, the brand names, the competitors and the
// accreditation status. SM.from() builds the model, SM.toRow() writes it back to the seo_sites columns.
const SM = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const normHost = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const bare = (v) => normHost(v).replace(/^www\./, '');
  const hostOf = (u) => normHost((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const siteIdFor = (d) => 'site_' + bare(d).replace(/[^a-z0-9]+/g, '-');
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => S(x)).filter(Boolean);
  const uniq = (a) => [...new Set(a)];
  const jparse = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };
  const STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
  const tokensOf = (s) => S(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // one-letter parts ("e" of "e invoicing") and stop words never decide a page match: with them "e invoicing uae penalties" would
  // score 3 of 4 against /uae-e-invoicing-fta-rules/ and claim the FTA page (the S26 false-match pair).
  const termsOf = (s) => uniq(tokensOf(s).filter(t => t.length > 1 && !STOP.has(t)));
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, ''); return p || '/'; };
  const strip = (s) => S(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---- the homepage HTML: canonical host, Organization / LocalBusiness schema, nav pages ----
  const ldNodes = (html) => {
    const out = []; const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    const push = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(push); return; } out.push(o); if (Array.isArray(o['@graph'])) o['@graph'].forEach(push); };
    while ((m = re.exec(S(html)))) push(jparse(m[1], null));
    return out;
  };
  const ORG_TYPE = /(organization|corporation|localbusiness|professionalservice|store|ngo|educationalorganization|governmentorganization|onlinebusiness|softwarecompany|company|consultant|accountingservice)/i;
  const typesOf = (o) => [].concat((o && o['@type']) || []).map(t => S(t).toLowerCase());
  const orgFromHtml = (html) => {
    const nodes = ldNodes(html).filter(o => typesOf(o).some(t => ORG_TYPE.test(t)));
    const node = nodes.find(o => typesOf(o).some(t => /localbusiness|professionalservice|store/.test(t))) || nodes[0];
    if (!node) return null;
    const logo = typeof node.logo === 'string' ? node.logo : ((node.logo || {}).url || '');
    return { name: S(node.name), type: typesOf(node).join('/'), telephone: S(node.telephone), email: S(node.email), logo: S(logo),
      sameAs: listOf(node.sameAs), address: (node.address && typeof node.address === 'object') ? node.address : null };
  };
  const navFromHtml = (html, host) => {
    const h = S(html); const zones = [];
    for (const re of [/<nav\b[\s\S]*?<\/nav>/gi, /<header\b[\s\S]*?<\/header>/gi]) { const f = h.match(re); if (f) zones.push(...f); }
    const out = []; const seen = new Set();
    for (const zone of zones) {
      for (const a of (zone.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [])) {
        const href = S((a.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1]);
        if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
        const abs = /^https?:\/\//i.test(href) ? href : (href.charAt(0) === '/' ? 'https://' + host + href : '');
        if (!abs || bare(hostOf(abs)) !== bare(host)) continue;
        const p = pathOf(abs); if (p === '/' || seen.has(p)) continue;
        seen.add(p); out.push({ url: abs, title: strip(a).slice(0, 80), path: p });
        if (out.length >= 12) return out;
      }
    }
    return out;
  };

  // ---- precedence: seo_profiles -> homepage schema -> Google Business Profile -> what the app sent ----
  const pick = (sources, read) => { for (const s of sources) { const v = S(read(s.value) || ''); if (v) return { value: v, source: s.name }; } return { value: '', source: '' }; };

  const from = (siteRow, extras) => {
    const row = (siteRow && typeof siteRow === 'object') ? siteRow : {};
    const x = (extras && typeof extras === 'object') ? extras : {};
    const req = x.request || {};
    const prof = x.profile || {};
    const gbp = x.gbp || {};
    const html = S(x.html || (x.home || {}).html);
    const domain = bare(row.domain || x.domain || req.domain || (x.home || {}).url || '');
    const site_id = S(row.site_id) || S(x.site_id) || (domain ? siteIdFor(domain) : '');
    const org = x.homepage_org || (html ? orgFromHtml(html) : null) || null;

    // canonical host: this run's probe, else the homepage's own canonical tag, else where the homepage request landed, else the stored
    // value, else the bare domain. A canonical tag on another domain is ignored.
    const canonTag = (S(html).match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
    const canonHost = hostOf((canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const landed = hostOf(x.final_url || (x.home || {}).url || '');
    const fromProbe = normHost(x.canonical_host || (x.probe || {}).canonical_host || '');
    // the site's own live URLs (ladder pages, published pages, sitemap) are evidence too: the host most of them use
    const voted = (() => { const c = {}; for (const u of (x.seen_hosts || [])) { const h = normHost(u.indexOf('/') >= 0 ? hostOf(u) || u : u); if (h && bare(h) === domain) c[h] = (c[h] || 0) + 1; }
      return Object.keys(c).sort((a, b) => c[b] - c[a] || a.length - b.length)[0] || ''; })();
    const candidates = [[fromProbe, 'probe'], [bare(canonHost) === domain ? canonHost : '', 'canonical tag'], [bare(landed) === domain ? landed : '', 'redirect'], [voted, 'live urls'], [normHost(row.canonical_host), 'stored'], [domain, 'domain']];
    const hit = candidates.find(c => c[0]) || [domain, 'domain'];
    const canonical_host = hit[0], host_source = hit[1];

    const SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: org || {} }, { name: 'gbp', value: gbp }, { name: 'app', value: req }, { name: 'stored', value: { business_name: row.business_name, logo_url: row.logo_url } }];
    const nameHit = pick(SRC, (s) => s.business_name || s.name || s.title);
    const logoHit = pick(SRC, (s) => s.logo_url || s.logo || s.photo_url);
    const addr = (org && org.address && typeof org.address === 'object') ? org.address : {};
    const NAP_SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: { street_address: addr.streetAddress, city: addr.addressLocality, region: addr.addressRegion, postal_code: addr.postalCode, country_code: addr.addressCountry, phone: (org || {}).telephone, public_email: (org || {}).email } },
      { name: 'gbp', value: { street_address: gbp.address, city: gbp.city, phone: gbp.phone } }, { name: 'app', value: req }];
    const street = pick(NAP_SRC, (s) => s.street_address), phone = pick(NAP_SRC, (s) => s.phone);
    const nap = { business_name: nameHit.value, street_address: street.value, city: pick(NAP_SRC, (s) => s.city).value, region: pick(NAP_SRC, (s) => s.region).value,
      postal_code: pick(NAP_SRC, (s) => s.postal_code).value, country_code: pick(NAP_SRC, (s) => s.country_code || s.country).value,
      phone: phone.value, public_email: pick(NAP_SRC, (s) => s.public_email || s.email).value, price_range: S(prof.price_range), source: street.source || phone.source || '' };
    const stored = jparse(row.nap_json, null);
    if (stored && !nap.street_address && !nap.phone) { Object.assign(nap, stored); nap.source = S(stored.source) || 'stored'; }

    // P2-2 (2026-10-12): the Site Describer answers with `products_or_services` — reading only `services` left services_json empty on every
    // site, so the brief's facts said `services: []` although the describer had found nine.
    const desc0 = x.description || {};
    // keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.2 / §14.1): what the client SAID they sell ("What do you sell?" on Track my site,
    // seo_sites.declared_services) comes first and is never dropped by what a crawl read; it is kept apart as well, so SM.toRow writes it back
    // unchanged and the weekly Site Tracker can never overwrite it
    const declListOf = (v) => { if (Array.isArray(v)) return v; const j = jparse(v, null); return Array.isArray(j) ? j : listOf(v); };
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, declared_services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
      model_updated_at: updated_at, sources: { profile: !!prof.site_id || !!prof.business_name, homepage_schema: !!org, gbp: !!(gbp.name || gbp.phone), app: !!(req.business_facts || req.cta || req.business_name), html: !!html } };
  };

  // every URL the agent emits for a site goes through here: https, the canonical host, no double slash
  const siteUrl = (model, path) => {
    const p = S(path);
    if (/^https?:\/\//i.test(p)) return p;
    const host = normHost((model || {}).canonical_host || (model || {}).domain || '');
    const tail = p ? ('/' + p).replace(/\/{2,}/g, '/') : '/';
    return 'https://' + host + tail;
  };
  const apiTarget = (model) => bare((model || {}).domain || (model || {}).canonical_host || '');   // DataForSEO and the other APIs keep the bare domain
  const name = (model) => S((model || {}).business_name) || bare((model || {}).domain || '');
  const nap = (model) => ((model || {}).nap && typeof model.nap === 'object') ? model.nap : { business_name: '', street_address: '', city: '', region: '', postal_code: '', country_code: '', phone: '', public_email: '', price_range: '', source: '' };
  const services = (model) => Array.isArray((model || {}).services) ? model.services : [];
  const pages = (model) => Array.isArray((model || {}).pages) ? model.pages : [];
  const facts = (model) => {
    const t = S((model || {}).business_facts) + ' ' + S(((model || {}).nap || {}).price_range);
    return { business_facts: S((model || {}).business_facts), cta: S((model || {}).cta), accreditation: S((model || {}).accreditation),
      pricing: /(aed|usd|\$|€|£|price|pricing|cost|fee|per month|per user|from \d)/i.test(t),
      timeline: /(\d+\s*(day|week|month|year)|timeline|go.?live|turnaround|within \d)/i.test(t) };
  };
  // a page of the inventory answers a keyword when it already gets impressions for it, or when at least 75% of the keyword's
  // meaningful words are in its slug or title (D11; keep it even while the inventory is empty).
  const MATCH_MIN = 0.75;
  // R35 (2026-10-16, re-rating 2026-10-15): the words were compared literally, so "d365 finance dubai" did not match a page titled
  // "Dynamics 365 Finance & Operations UAE" and the report told the owner that page "does not target" the search. Three rules, applied
  // to BOTH sides before anything is compared: the product's own short names are written out (d365 = dynamics 365, f&o = finance and
  // operations), a word is compared on a light stem (invoice / invoices / invoicing), and an emirate in the SEARCH is covered by a page
  // about the UAE ("emirate ⊂ uae" — never the other way round: a Dubai page does not answer every UAE search).
  const SYN = [[/\bd\s?365\b/g, 'dynamics 365'], [/\bdynamics365\b/g, 'dynamics 365'], [/\bf\s?&\s?o\b|\bfno\b/g, 'finance operations'], [/\bunited arab emirates\b/g, 'uae'],
    [/\babu dhabi\b/g, 'abudhabi'], [/\bras al khaimah\b/g, 'rasalkhaimah'], [/\bumm al quwain\b/g, 'ummalquwain'], [/\bal ain\b/g, 'alain']];
  const EMIRATES = new Set(['dubai', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rasalkhaimah', 'rak', 'ummalquwain', 'alain']);
  const norm = (s) => { let t = S(s).toLowerCase().replace(/&amp;/g, '&'); for (const [re, to] of SYN) t = t.replace(re, to); return t; };
  const stem = (t) => t.length >= 5 ? t.replace(/(ings?|ed|es|(?<!s)s)$/, '').replace(/e$/, '') : t;   // business = businesses, invoice = invoicing
  const matchTerms = (s) => uniq(termsOf(norm(s)).map(stem));
  // a keyword term is covered by a page's terms: the same stem, or an emirate in the search against a page about the UAE
  const covers = (set, t) => set.includes(t) || (EMIRATES.has(t) && (set.includes('uae') || set.includes('emirat')));
  const shareIn = (want, set) => want.length ? want.filter(t => covers(set, t)).length / want.length : 0;
  // R56: a listing page (the blog / insights index, a category, a tag) gets impressions for every article it lists; when a dedicated
  // page matches the same search by its own slug or title, the dedicated page is the one that answers it
  const LISTING = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;
  const isListing = (u) => { const p = pathOf(u).replace(/[?#].*$/, ''); return LISTING.test(p); };
  const untitled = (model) => pages(model).filter(p => !S(p.title) && !S(p.h1));
  const matchPage = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url)))) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    if (qHit && best) return { ...best, listing: listingOf(qHit, best) };
    return qHit || best;
  };
  // A-22 (2026-10-17): how well ONE page of the inventory targets a search by its own words (slug or title / H1, the matchPage rule), so a
  // caller that already knows the page Google ranks can ask whether another page targets the search more closely - never to replace it
  const pageScore = (page, keyword) => { const p = page || {}; const want = matchTerms(keyword); if (!want.length || !S(p.url)) return null;
    return Math.round(Math.max(shareIn(want, matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''))), shareIn(want, matchTerms(S(p.title) + ' ' + S(p.h1)))) * 100) / 100; };
  // R35: how much of a search a page's OWN title / H1 holds (null when the page's title was never read) - the only evidence that may call
  // a page "about something else"
  // the words of a spoken / long-tail search that say nothing about the subject ("which ... can help ... in the uae")
  const FILLER = new Set(['which', 'what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'help', 'helps', 'best', 'top', 'near', 'me', 'is', 'are', 'do', 'does', 'should', 'will', 'would', 'get', 'need', 'i', 'we', 'you']);
  const titleShare = (page, keyword) => { const p = page || {}; if (!S(p.title) && !S(p.h1)) return null;
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem)); if (!want.length) return null; const set = matchTerms(S(p.title) + ' ' + S(p.h1));
    return { share: Math.round(shareIn(want, set) * 100) / 100, have: want.filter(t => covers(set, t)).length, of: want.length, missing: want.filter(t => !covers(set, t)) }; };
  // R34: the pages whose title was never read, so a caller can say what it judged on the address alone instead of reading nothing silently
  const titleGap = (model) => { const all = pages(model); const u = untitled(model);
    return { pages: all.length, untitled: u.length, urls: u.slice(0, 12).map(p => p.url),
      note: u.length ? u.length + ' of the ' + all.length + ' pages of the site have no title on file yet (the weekly site check reads them a batch at a time), so they were judged by their address only' : '' }; };
  // R55: a URL of the site as the site serves it (canonical host); another site's URL is returned as it is
  const canonUrl = (model, u) => { const h = hostOf(u); if (!h || bare(h) !== bare((model || {}).domain || (model || {}).canonical_host || '')) return S(u); return siteUrl(model, pathOf(u)); };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q; } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at', 'declared_services'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at),
      declared_services: JSON.stringify(Array.isArray(m.declared_services) ? m.declared_services : []) };
  };
  // B4-1 / B4-2 (2026-10-15, benchmark area 4): the measurement columns belong to the row, so the kit emits them — a Data Table
  // node auto-maps every field it is given, and a row that is short of a column is as wrong as one that carries a stray field.
  // The model itself measures nothing: these are the defaults the Site Tracker's own judgement is written over
  // (v5/code/Page_Inventory_Site.js), and `''` for decay_state means "never measured", never "steady".
  const num0 = (v) => (Number(v) || 0);
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString(),
    clicks: num0(p.clicks), impressions: num0(p.impressions), position: num0(p.position), prev_clicks: num0(p.prev_clicks), yoy_clicks: num0(p.yoy_clicks),
    decay_state: S(p.decay_state), decay_pct: num0(p.decay_pct), decay_lost: num0(p.decay_lost), decay_kind: S(p.decay_kind),
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at) }));
  // ---- C-7 (re-rating 2026-10-17): ONE page state per keyword, read by the Rank Tracker AND the Site Tracker (and so by the cadence) ----
  // In one morning the Rank Tracker said of "ai consulting" "…/ai-copilot-advisory-uae already answers this search - refresh that page"
  // while the Site Tracker said "fix the four drafts that failed the quality check and run them again", and of "it consulting dubai"
  // "write the main page" while the Site Tracker and the cadence said "written today, failed QA, fix it". The order of evidence is one:
  // a LIVE page of the site that answers the search wins (refresh it; a draft written for the search is retired, never a second page);
  // then a written draft (publish it); then a draft that failed its quality check (fix it and run it again); then a run that wrote nothing.
  // in: { keyword, covered_url, written, not_ready, reasons (array or '; ' text), started } -> { state, text } (text: the parenthesis a list uses)
  const pageStep = (o) => {
    const c = o || {}, kw = S(c.keyword), why = (Array.isArray(c.reasons) ? c.reasons : S(c.reasons).split(/;\s+/)).map(S).filter(Boolean).slice(0, 2).join('; ').slice(0, 220);
    if (S(c.covered_url)) return { state: 'covered', text: S(c.covered_url) + ' already answers this search — refresh that page, do not publish a second one'
      + (c.not_ready || c.written ? '; the draft written for "' + kw + '" is not needed (use its text to refresh that page)' : '') };
    if (c.written) return { state: 'written', text: 'already written — publish it' };
    if (c.not_ready) return { state: 'not_ready', text: 'written, but the draft did not pass the quality check' + (why ? ' (' + why + ')' : '') + ' — fix it and run it again; do not publish it as it is' };
    if (c.started) return { state: 'started', text: 'a page run was started for it but no page was written — it is written again' };
    return { state: 'planned', text: '' };
  };
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
})();
// Coverage kit (FIX_PLAN G33, 2026-10-13; inlined through the marker /*__COVERAGE__*/).
// The 2026-10-11 review scored "brief covers the SERP" C1 at 6: the brief carried a term model and the content score gave 25 points for
// using it, but nothing said how much of it the pages that already rank use. Surfer's own study (n = 100) measured the best articles at
// 0.74 term coverage against a results-page average of 0.44, so an average is the wrong bar: the target is the BEST competitor's coverage.
//   CVG.termRe(term)            one matcher for every coverage figure we print (singular / plural, hyphen or space, a filler word between
//                               the words). Content QA's flexRe is this function, so the draft and the competitor pages are measured alike.
//   CVG.coverageOf(text, terms) how many of the shared terms one page uses -> { found, total, pct, used, missing }
//   CVG.best(pages, terms, want) the page that uses most of them (a tie goes to the better Google position); with want = { kind, keyword }
//                               only among the pages of the kind being written (R44: a service page is never measured against a guide
//                               for agencies or a listicle of other companies) — `kind` / `type_match` say which pool it came from
//   CVG.kindOf(page)            'list' | 'guide' | 'service', from the URL path, the title and the byline; CVG.kindFor(pageType) ours
//   CVG.target(pct)             the coverage to aim for: the best competitor's, kept inside 60-90% (a weak results page must not lower
//                               the bar, and a term-stuffed one must not force stuffing). It is a target read off competitor pages, not
//                               a promise about rankings.
//   CVG.subtopics(page)         the best competitor's own H2 / H3 headings, cleaned, as the subtopics to cover — never a promotion, a
//                               heading with no text under it, or a list page's entries naming other companies (R44)
//   CVG.subtopicGap(subs, ctx)  per subtopic: has its own section, covered in the text, or missing
//   CVG.plainOf / readability / readBand   B3-4: readability measured one way, and the band read off the competitor pages
// Regex only: the n8n Code sandbox has no URL constructor.
const CVG = (() => {
  const S = (v) => String(v == null ? '' : v);
  const esc = (s) => S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const termRe = (phrase, flags) => new RegExp('\\b' + S(phrase).toLowerCase().split(/[\s-]+/).filter(Boolean)
    .map(w => esc(w.replace(/(?:ies|es|s)$/, '')) + '(?:ies|es|s)?').join('[\\s-]+(?:(?:the|a|an|of|for|in|to|and)\\s+)?') + '\\b', flags);
  const nameOf = (t) => S(t && typeof t === 'object' ? (t.term || t.phrase) : t).toLowerCase().trim();
  const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : null);
  const coverageOf = (text, terms) => {
    const t = S(text); const list = (Array.isArray(terms) ? terms : []).map(nameOf).filter(Boolean);
    const used = list.filter(term => { try { return termRe(term, 'i').test(t); } catch (e) { return false; } });
    return { found: used.length, total: list.length, pct: pct(used.length, list.length), used, missing: list.filter(x => !used.includes(x)) };
  };
  // R44 (2026-10-16, re-rating 2026-10-15): what kind of page a result is. Live (exec 616) the page to beat for a SERVICE page was
  // vendasta.com's blog guide for marketing agencies on selling AI consulting, and for the ladder verdict of exec 610 a "Best AI Consulting
  // Companies in Dubai" listicle whose numbered entries (Accenture, IBM, G42 …) became "subtopics to cover". A result is a 'list' (a ranked
  // list of companies / tools), a 'guide' (blog, article, glossary, news) or a 'service' page (a provider selling the thing), read from its
  // URL path, its title and its byline — signals the competitor read already carries.
  const LIST_RE = /\b(?:top|best)\b[^|]{0,60}?\b(?:companies|firms|agencies|providers|vendors|consultants|consultancies|partners|tools|platforms|software|apps|services|solutions)\b|\brankings?\b|\btop[\s-]?\d+\b/i;
  const SERVICE_PATH = /\/(?:services?|solutions?|offerings?|what-we-do|capabilities|industries)\//i;
  const GUIDE_PATH = /\/(?:blogs?|insights?|resources|articles?|news|guides?|glossary|learn|academy|wiki|knowledge|library|posts?)\//i;
  const GUIDE_TITLE = /\b(?:what is|what are|how to|how do|guide|explained|definition|versus|vs\.?|everything you need|tips|ways to|checklist)\b|\?/i;
  const SERVICE_WORDS = /\b(?:services?|solutions?|consult\w*|agency|company|firm|partner|software|platform|pricing|hire)\b/i;
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '') || '/';
  const kindOf = (p) => {
    const title = S(p && p.title), path = pathOf(p && p.url), slug = path.replace(/[\/_-]+/g, ' ');
    if (LIST_RE.test(title) || LIST_RE.test(slug)) return 'list';
    if (SERVICE_PATH.test(path)) return 'service';
    if (GUIDE_PATH.test(path) || GUIDE_TITLE.test(title)) return 'guide';
    const sep = title.split(/\s+[|–—-]\s+/);   // "AI Consulting Services | ATI Lab", "AI Consulting Services in Dubai - Kinetic Consulting"
    if (sep.length >= 2 && sep[sep.length - 1].split(/\s+/).length <= 4 && SERVICE_WORDS.test(sep.slice(0, -1).join(' '))) return 'service';
    if (p && p.has_author && p.has_date) return 'guide';
    return 'service';
  };
  // the kind of page being written, from the page type (PT.of options): a service / product / landing / local page sells; the rest explain
  const kindFor = (pageType) => (/blog|guide|article|pillar|hub|case stud|post/i.test(S(pageType)) ? 'guide' : 'service');
  // a list is a fair benchmark only for a guide whose search itself asks for a list ("best erp companies in dubai")
  const LIST_SEARCH = /\b(?:best|top|companies|firms|agencies|providers|vendors|tools|alternatives|list)\b/i;
  const OFFICIAL = /(^|\.)(gov|govt|gob|gouv|mil)(\.[a-z]{2,3})?$|(^|\.)(gov|govt|gob|gouv)\.[a-z]{2,3}(\.[a-z]{2})?$/;   // a government / official host
  const best = (pages, terms, want) => {
    const scored = (Array.isArray(pages) ? pages : []).filter(p => p && S(p.content_full || p.content || p.text))
      .map(p => ({ page: p, kind: kindOf(p), cov: coverageOf(p.content_full || p.content || p.text, terms) }));
    if (!scored.length) return null;
    const order = (a, b) => (b.cov.pct || 0) - (a.cov.pct || 0) || (Number(a.page.rank) || 99) - (Number(b.page.rank) || 99);
    // R44: the page to beat is the best page OF THE KIND being written; with none read, the best page that is not a list (a list is
    // never the bar for a service page), and only then any page — and the answer says which of the three it was.
    const k = want && want.kind ? want.kind : null;
    const lists = !!(k === 'guide' && want && LIST_SEARCH.test(S(want.keyword)));
    // A-7 (2026-10-17, re-rating exec 760): a vendor's page was measured against mof.gov.ae, "the best service page" because it was the only
    // result read as a service page. A government / regulator page is a source to cite, never the page a business has to beat: it is
    // left out of the choice whenever any other page was read (and the answer counts it), and stands in only when nothing else did.
    const isOfficial = (x) => OFFICIAL.test(S(x.page.domain || x.page.url).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, ''));
    const official = scored.filter(isOfficial);
    const cands = official.length < scored.length ? scored.filter(x => !isOfficial(x)) : scored;
    const same = k ? cands.filter(x => x.kind === k || (lists && x.kind === 'list')) : cands;
    const notList = cands.filter(x => x.kind !== 'list');
    const pool = same.length ? same : (notList.length ? notList : cands);
    const w = pool.slice().sort(order)[0];
    return { domain: S(w.page.domain), url: S(w.page.url), rank: Number(w.page.rank) || null, coverage_pct: w.cov.pct, terms_used: w.cov.found,
      terms_total: w.cov.total, word_count: Number(w.page.word_count) || null, sections: (w.page.headings || []).length, kind: w.kind,
      type_match: k ? same.length > 0 : null, same_kind_pages: k ? same.length : null, official_skipped: cands === scored ? 0 : official.length,
      average_pct: Math.round(scored.reduce((s, x) => s + (x.cov.pct || 0), 0) / scored.length), pages_compared: scored.length };
  };
  const MIN_TARGET = 60, MAX_TARGET = 90;
  const target = (bestPct) => { const p = Number(bestPct); if (!(p > 0)) return null; return Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round(p))); };
  const STOP = new Set('the and for with your our how what why when which who whom whose where are can does did should would from into about above below than that this these those you they them their there here all any each few more most other some such not only own same too very per via etc best top near out off its it is was were be been being have has had having will shall may might must do done use used using get gets'.split(' '));
  const toks = (t) => S(t).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const clean = (h) => S(h).replace(/^H\d:\s*/i, '').replace(/^#+\s*/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
  const JUNK = /^(conclusion|summary|introduction|overview|about us|contact|contact us|faq|faqs|frequently asked questions|related (posts|articles|reading)|share this|table of contents|references|sources|get started|book a demo|request a demo|free trial|sign up|subscribe|recent posts|categories|tags|author|comments?)\b/i;
  // R44: a heading is a subtopic only when it is a topic. Live, vendasta.com's banner "Acquire and serve 10x more clients with AI-powered
  // software" (an H2 with no text under it, straight above "What is AI Consulting?") reached the editor as a subtopic to add, and the draft
  // grew a section "Serving more clients with AI-powered software". Left out now: promotion / call-to-action headings, a heading with no
  // text under it before the next heading of the same or a higher level (a heading followed by its own sub-headings is a parent and stays),
  // and on a list page the numbered entries (each one another company: "2. Accenture AI & Analytics") and their detail blocks.
  const PROMO = /\b(?:\d+x\b|acquire and serve|get in touch|contact us|call us|book (?:a|an|your)|schedule (?:a|an|your)|request (?:a|an|your)|free (?:trial|demo|consultation|quote|assessment)|sign up|start your|ready to|why choose|promote your|subscribe|download (?:the|our|your)|join (?:us|our)|talk to (?:us|our|an?)|let'?s talk|trusted by|partner with us|explore (?:the|our|related)|learn more|read more|see how (?:we|our)|try (?:it|for free))\b/i;
  const ENTRY_DETAIL = /^(?:key (?:highlights|features|services)|services|contact information|location|founded|headquarters|pricing|rating|website|pros|cons|why we picked it)\b/i;
  const levelOf = (h) => { const m = S(h).match(/^H(\d)\s*:/i); return m ? Number(m[1]) : 2; };
  const bodyUnder = (content, text) => {   // the words between this heading's line and the next heading line, or null when the line is not found
    const lines = S(content).split('\n'); const want = text.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (!/^#{1,6}\s/.test(lines[i]) || clean(lines[i]).toLowerCase() !== want) continue;
      let words = 0, j = i + 1; for (; j < lines.length && !/^#{1,6}\s/.test(lines[j]); j++) words += lines[j].split(/\s+/).filter(Boolean).length;
      return j >= lines.length && !words ? null : words;   // the text ends right after it: cut short, not a banner
    }
    return null;
  };
  // A-16 (2026-10-17, re-rating 2026-10-17): a heading that NAMES A COMPANY is that company talking about itself, never a subtopic. Live
  // (exec 771) the page to beat was agncompu.com and its own headings "IT Consultancy Company in Dubai - AGN IT Services LLC" and "Why AGN
  // IT Services LLC Is Best IT Consultancy Company in Dubai" were required of our draft and became a refusal reason. A heading is the
  // page's brand talking when it carries: the page's own domain label, or an acronym that label starts with ("AGN" of agncompu.com) —
  // labels by the fit gate's own rule (fitLabels, passed in as opts.labels where the fit gate is inlined; the same rule otherwise); the
  // brand segment of the page's own title ("… - AGN IT Services LLC"); any name in opts.brands (the other results' domains, the declared
  // competitors); a legal-entity suffix (LLC, FZE, DMCC, Ltd …); or a "why X is the best" line.
  const LEGAL = /\b(?:llc|l\.l\.c\.?|fze|fzco|fz-?llc|dmcc|ltd\.?|limited|inc\.?|gmbh|plc|pvt\.?|wll|w\.l\.l\.?|s\.a\.r\.l\.?|pte)(?=$|[^a-z])/i;
  const SELF_PROMO = /\bwhy\b.{0,60}?\b(?:is|are)\s+(?:the\s+)?(?:best|leading|top|no\.?\s?1|number one|#1)\b|\bwhy (?:choose|hire|work with|pick)\b/i;
  const GENERIC_BRAND = new Set('it ai erp crm the and for of in services service solutions solution systems system software consulting consultancy consultants company companies group technologies technology tech digital global international llc ltd inc fze dmcc limited uae dubai abu dhabi sharjah gcc middle east best top cloud data partner partners agency'.split(' '));
  const hostLabel = (u) => { const h = S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(?:www|m|app|en|ar)\./, ''); const first = h.split('.')[0] || ''; return first.replace(/[^a-z0-9]/g, ''); };
  const labelsDefault = (dom) => { const l = hostLabel(dom); return l.length >= 4 && !GENERIC_BRAND.has(l) ? [l] : []; };
  const brandMarks = (page, opts) => {
    const o = opts || {}; const labelsOf = typeof o.labels === 'function' ? o.labels : labelsDefault;
    const labels = new Set(); const words = new Set();
    const addDom = (d) => { try { (labelsOf(d) || []).forEach(l => l && labels.add(String(l).toLowerCase())); } catch (e) { labelsDefault(d).forEach(l => labels.add(l)); } };
    if (page && (page.domain || page.url)) addDom(page.domain || S(page.url));
    for (const b of (Array.isArray(o.brands) ? o.brands : [])) { const x = S(b).trim(); if (!x) continue;
      if (/\.[a-z]{2,}(?:$|\/)/i.test(x) && !/\s/.test(x)) addDom(x);
      else x.toLowerCase().split(/[^a-z0-9&]+/).filter(w => w.length >= 3 && !GENERIC_BRAND.has(w)).forEach(w => words.add(w)); }
    // the brand segment of the page's own title: the last part after a separator, when it is short and is not the topic itself
    const segs = S(page && page.title).split(/\s+[|–—-]\s+/).map(x => x.trim()).filter(Boolean);
    if (segs.length >= 2) { const last = segs[segs.length - 1]; if (last.split(/\s+/).length <= 5)
      last.toLowerCase().split(/[^a-z0-9&]+/).filter(w => w.length >= 3 && !GENERIC_BRAND.has(w)).forEach(w => words.add(w)); }
    return { labels: [...labels], words: [...words] };
  };
  const namesBrand = (heading, page, opts, marks) => {
    const h = clean(heading); if (!h) return null;
    if (LEGAL.test(h)) return 'names a company (legal-entity suffix)';
    if (SELF_PROMO.test(h)) return 'a company promoting itself';
    const M = marks || brandMarks(page, opts);
    const raw = h.split(/[^A-Za-z0-9&]+/).filter(Boolean); const low = raw.map(w => w.toLowerCase());
    for (const l of M.labels) {
      if (low.includes(l)) return 'names ' + l;
      const acr = raw.find(w => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w) && !GENERIC_BRAND.has(w.toLowerCase()) && l.startsWith(w.toLowerCase()));
      if (acr) return 'names ' + acr + ' (' + l + ')';
    }
    const w = low.find(x => M.words.includes(x)); if (w) return 'names ' + w;
    return null;
  };
  const subtopics = (page, limit, opts) => {
    const out = []; const seen = new Set();
    const hs = (page && page.headings) || []; const list = page ? kindOf(page) === 'list' : false;
    const content = S(page && (page.content_full || page.content || page.text));
    const marks = brandMarks(page, opts);
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      const text = clean(h); const key = text.toLowerCase();
      if (!text || text.length < 8 || text.length > 90 || JUNK.test(text) || seen.has(key)) continue;
      if (toks(text).length < 2) continue;
      if (PROMO.test(text)) continue;
      if (namesBrand(text, page, opts, marks)) continue;   // A-16: the competitor's own name is never our subtopic
      if (list && (/^\d+[.)]\s/.test(text) || ENTRY_DETAIL.test(text))) continue;
      const parent = i + 1 < hs.length && levelOf(hs[i + 1]) > levelOf(h);
      const words = parent ? null : bodyUnder(content, text);
      if (words === 0) continue;   // a banner: nothing under it before the next heading of its own level
      seen.add(key); out.push(text);
      if (out.length >= (limit || 12)) break;
    }
    return out;
  };
  // A subtopic counts as covered when most of its meaningful words are in one of the draft's headings ("its own section") or in the body
  // ("covered in the text"). Nothing else: a heading we cannot find in the draft at all is the gap the writer has to close.
  const subtopicGap = (subs, ctx) => {
    const heads = (((ctx || {}).headings) || []).map(h => clean(h).toLowerCase());
    const body = S((ctx || {}).text).toLowerCase();
    return (Array.isArray(subs) ? subs : []).map(sub => {
      const T = toks(sub); if (!T.length) return { subtopic: sub, state: 'section' };
      const share = (hay) => T.filter(w => hay.includes(w)).length / T.length;
      if (heads.some(h => share(h) >= 0.6)) return { subtopic: sub, state: 'section' };
      if (share(body) >= 0.8) return { subtopic: sub, state: 'text' };
      return { subtopic: sub, state: 'missing' };
    });
  };
  // ---- B3-4 (2026-10-16, benchmark area 3): readability measured one way, on the draft and on the pages that rank ----
  // The band used to be a constant — Flesch 40+ with sentences of 22 words or fewer scored 15 of 15 on every topic — while Ahrefs' own
  // data puts the mean reading ease at 69.7 for food and 49.6 for engineering, and Semrush derives its target from the top-10 pages. So
  // the band is now read off the competitor pages this run already holds (Analyze Competitor Pages), measured exactly as the draft is:
  //   CVG.plainOf(md)         the text as Content QA reads its own draft (meta lines and table rows out, links to their anchor text,
  //                           emphasis marks out, whitespace collapsed) — one normalisation for both sides of the comparison
  //   CVG.readability(plain)  Flesch reading ease (approximate syllables), sentences of 3+ words, the average sentence, long sentences
  //   CVG.readBand(pages)     the median Flesch of the pages with READ_MIN_WORDS+ words, and the band around it (BAND_HARDER points
  //                           harder, BAND_EASIER points easier); fewer than READ_MIN_PAGES such pages is "not enough pages", never a
  //                           band. The band's lower edge is kept inside 20-60: a results page written for specialists does not
  //                           license unreadable copy, and a very plain one does not force a technical page into children's prose.
  const plainOf = (md) => S(md).replace(/^(?:Title|Meta Description|Slug|Primary Keyword|Secondary Keywords|URL Source|Markdown Content|Published Time):.*$/gm, '')
    .replace(/\|[^\n]*\|/g, '').replace(/\[([^\[\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>]+/g, '').replace(/\s+/g, ' ').trim();
  const nWords = (t) => S(t).split(/\s+/).filter(Boolean).length;
  const syl = (w) => { w = S(w).toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1; const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };
  const readability = (plain) => {
    const t = S(plain);
    const sentences = t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => nWords(s) >= 3);
    const sent_words = sentences.map(nWords);
    const words = t.split(/\s+/).filter(Boolean);
    const syllables = words.reduce((s, w) => s + syl(w), 0);
    const flesch = words.length && sentences.length ? +(206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)).toFixed(1) : null;
    const avg = sent_words.length ? +(sent_words.reduce((a, b) => a + b, 0) / sent_words.length).toFixed(1) : 0;
    return { flesch, avg_sentence_words: avg, long_sentences: sent_words.filter(n => n > 28).length, sentences, sent_words, words: words.length, syllables };
  };
  const READ_MIN_WORDS = 150, READ_MIN_PAGES = 3, BAND_HARDER = 10, BAND_EASIER = 15, BAND_FLOOR = 20, BAND_CEIL = 60;
  const quant = (sorted, q) => { if (!sorted.length) return null; const at = (sorted.length - 1) * q; const lo = Math.floor(at), hi = Math.ceil(at); return +(sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)).toFixed(1); };
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const readBand = (pages) => {
    const all = (Array.isArray(pages) ? pages : []).filter(p => p && S(p.content_full || p.content || p.text));
    const measured = all.map(p => { const r = readability(plainOf(p.content_full || p.content || p.text));
      return { domain: S(p.domain) || hostOf(p.url), url: S(p.url), rank: Number(p.rank) || null, words: r.words, flesch: r.flesch }; })
      .filter(x => x.words >= READ_MIN_WORDS && x.flesch != null);
    if (measured.length < READ_MIN_PAGES) return { ok: false, pages_read: all.length, pages_measured: measured.length, pages: measured,
      reason: (all.length ? measured.length + ' of the ' + all.length + ' competitor pages read have ' + READ_MIN_WORDS + '+ words' : 'no competitor page text was read in this run') + ' (' + READ_MIN_PAGES + ' are needed for a band)' };
    const fl = measured.map(x => x.flesch).sort((a, b) => a - b);
    const median = quant(fl, 0.5);
    const low = Math.min(BAND_CEIL, Math.max(BAND_FLOOR, Math.round(median - BAND_HARDER)));
    const high = Math.max(low, Math.round(median + BAND_EASIER));
    return { ok: true, median, low, high, p25: quant(fl, 0.25), p75: quant(fl, 0.75), clamped: low !== Math.round(median - BAND_HARDER),
      pages_read: all.length, pages_measured: measured.length, pages: measured.sort((a, b) => (a.rank || 99) - (b.rank || 99)).slice(0, 10) };
  };
  return { termRe, coverageOf, best, target, subtopics, subtopicGap, namesBrand, brandMarks, pct, toks, clean, kindOf, kindFor, MIN_TARGET, MAX_TARGET,
    plainOf, readability, readBand, READ_MIN_WORDS, READ_MIN_PAGES, BAND_HARDER, BAND_EASIER, BAND_FLOOR, BAND_CEIL };
})();
// ---- placeholder kit (A-13, 2026-10-17; inlined through the PLACEHOLDERS marker) ----
// ONE answer to "what in this page is still a bracket somebody has to fill in or confirm?", shared by Content QA (the count, the gate,
// the reasons), the app's article view and its delivery rule (app/shared/src/placeholders.ts carries the same two patterns, and the
// build asserts they are byte-identical). Live (exec 771) the delivered body said "a fixed [Price band: typical Assess & Envision fee in
// AED]" while QA reported `placeholder_count 0`, `open_brackets []`: the pattern counted a bracket only when it held no colon, and the
// colon form was assumed to be one of OUR review notes — but a writer invents its own labels. Now:
//   * a bracket that is a Markdown link or image (`[text](url)`, `![alt](src)`), a checkbox (`[ ]`, `[x]`), a footnote (`[^1]`) or a
//     number (`[1]`) is not a gap;
//   * a review note is one of the CLOSED list of labels the prompts and QA themselves emit — `[Confirm: …]`, `[Owner: …]`,
//     `[Author insight: …]`, `[Image: …]` — and is reported as a note;
//   * every other bracket that starts with a letter is a placeholder, whatever its case or punctuation: `[Price]`, `[name, role]`,
//     `[date]`, `[Price band: typical … fee in AED]`, `[Insert client logo]`.
// Regex only (the n8n Code sandbox has no URL constructor).
const PH = (() => {
  const BRACKET_SRC = "(?<![!\\\\])\\[([A-Za-z][^\\[\\]\\n]{0,399})\\](?![(:])";
  const NOTE_SRC = "^(?:confirm|owner|author insight|image)\\s*:";
  const bracketRe = () => new RegExp(BRACKET_SRC, 'g');
  const NOTE_RE = new RegExp(NOTE_SRC, 'i');
  // one pass over the text: { placeholders: [{token, count}], notes: [{token, count}], placeholder_count, note_count, items: [...] }
  const scan = (text) => {
    const t = String(text == null ? '' : text);
    const ph = new Map(), nt = new Map();
    for (const m of t.matchAll(bracketRe())) {
      const inner = m[1].trim(); if (!inner) continue;
      if (/^x$/i.test(inner)) continue;   // a ticked checkbox
      const tok = '[' + m[1] + ']';
      const into = NOTE_RE.test(inner) ? nt : ph;
      into.set(tok, (into.get(tok) || 0) + 1);
    }
    const list = (mp) => [...mp.entries()].map(x => ({ token: x[0], count: x[1] })).sort((a, b) => b.count - a.count);
    const placeholders = list(ph), notes = list(nt);
    return { placeholders, notes, placeholder_count: placeholders.reduce((s, x) => s + x.count, 0), note_count: notes.reduce((s, x) => s + x.count, 0),
      items: placeholders.map(p => ({ ...p, kind: 'placeholder' })).concat(notes.map(n => ({ ...n, kind: 'review_note' }))) };
  };
  return { BRACKET_SRC, NOTE_SRC, bracketRe, NOTE_RE, scan };
})();
// ---- claims kit (D14, 2026-10-11; inlined by build_monitors.py): statements about the business that only the owner can vouch for. With no
// facts on file the Reply Reader's suggested answer invented "we're not directly accredited by the Ministry, but we work with accredited
// providers" (live 2026-10-11). A sentence that claims an accreditation, certification, partnership, licence, registration, approval, award,
// membership, founding year, location, age, size, client count, percentage or price is kept only when the facts on file carry the same word
// stem (or the same number); otherwise it is wrapped in [Owner: confirm — …] and the answer needs the owner. One list for every draft
// (CL.CLAIM_RE; L2 reuses it for the outreach sequences). Regex only, no model.
const CL = (() => {
  const CLAIM_RE = /\b(?:accredit\w*|certif\w*|iso[ -]?\d{4,5}|partner\w*|authori[sz]ed|licen[cs]ed|registered|approved|award\w*|member(?:s|ship)? of|founded|since \d{4}|headquarter\w*|based in|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|companies|countries|employees|staff|users|installations?|implementations?)|\d[\d,.]*\s?%|(?:aed|usd|eur|gbp|sar|inr|\$|€|£)\s?\d[\d,.]*|\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?)|pric(?:e|es|ed|ing)|fees?|free of charge|no charge|discount\w*)\b/gi;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%$€£]+/g, ' ').replace(/\s+/g, ' ').trim();
  // the piece of a claim that the facts must carry: its number, else the first word's stem (7 letters: "accredited" → "accredi", "authorised" / "authorized" → "authori")
  const keyOf = (m) => { const x = norm(m); const num = x.match(/\d[\d,.]*/); if (num) return num[0].replace(/[,.]+$/, '');
    const w = x.split(' ')[0]; const st = w.replace(/(ations?|ation|ings?|ed|es|s|ship|ships)$/, ''); return (st.length >= 5 ? st : w).slice(0, 7); };
  // L2 (2026-10-11): a claim is only ours when the sentence speaks about us -- "the date it was approved" on their own list says nothing
  // about our business. The outreach draft gate passes { ours: true, brand }, so a sentence about the prospect's page is left alone; the
  // Reply Reader checks every sentence (its whole answer is about us).
  const OURS_RE = /\b(we|we.?re|we.?ve|our|ours|us|i|i.?m|i.?ve|my)\b/i;
  // text: a draft; facts: what we know (any string); opts.skip: a string that is never a claim (the signature); opts.ours / opts.brand:
  // see above. Returns the text with every unsupported claim sentence wrapped and the list of what was wrapped.
  function check(text, facts, opts = {}) {
    const t = String(text || ''); if (!t.trim()) return { text: t, flags: [] };
    const F = norm(facts); const body = opts.skip ? t.split(String(opts.skip)).join(' ') : t;
    const flags = []; let out = t;
    for (const s0 of body.split(/(?<=[.!?])\s+|\n+/)) { const s = s0.trim(); if (s.length < 4 || /^\[[^\]]*\]$/.test(s)) continue;
      if (opts.ours && !(OURS_RE.test(s) || (opts.brand && s.toLowerCase().includes(String(opts.brand).toLowerCase())))) continue;
      let plain = s.replace(/\[[^\]]*\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');   // a word in a URL is not a claim (our own slug says "accredited-service-providers")
      if (opts.ours) plain = plain.replace(/["\u201c\u201d][^"\u201c\u201d]{3,200}["\u201c\u201d]/g, ' ');   // L2: words inside quotation marks are THEIR words (a pitch quotes their page title), never our claim
      const bad = [...plain.matchAll(CLAIM_RE)].map(m => m[0]).filter(m => { const k = keyOf(m); return k && !F.includes(k); });
      if (!bad.length) continue;
      flags.push({ claim: bad[0], sentence: s.slice(0, 200) });
      if (out.includes(s)) out = out.replace(s, '[Owner: confirm — ' + s + ']'); }
    return { text: out, flags };
  }
  // ---- A-15 (2026-10-17, re-rating 2026-10-17): what a written PAGE says about the business's own terms and scope ----
  // Live (exec 771, business facts and profile empty) the page told buyers "We charge for advice and delivery. Licences sit on a separate
  // line of the quote, you can buy them through any channel …", "Some can, but Tech& does not [manage a complete office IT setup]" and
  // "Tech& does not handle company formation" — none of it on any of the site's 33 pages, and the quality check listed none of it.
  // CL.business(text, corpus, opts) reads every sentence that speaks about the business (we / our / us, or one of its names in
  // opts.names) and holds three kinds of statement against `corpus` (the business facts, the profile, the site model and the site's own
  // pages this run read):
  //   * its commercial terms — what it charges, quotes, bills, licenses, guarantees, refunds, discounts, how it contracts or resells;
  //   * its scope — what it does NOT do, NEVER or ONLY does ("Tech& does not handle company formation");
  //   * its credentials — accreditation, certification, partnership, awards, founding year, a count of years / clients / staff.
  // A statement is supported when ONE sentence of the corpus carries its trigger (the same number, the trigger's stem; for a scope
  // statement, a negation) and at least half of its own content words. Anything else is returned as unsupported, with the sentence; the
  // caller marks it [Confirm: …] for the owner. Sentences already holding a bracket are left alone (a note is never nested).
  // The subject must be the business: "we …", "<name> …", "our <team / prices / quotes …>" — "configuration does not meet your needs" and
  // "you can act on it with another partner" say nothing about it. Questions (a buyer's checklist) are never claims.
  const BIZ_TERMS = /\b(?:charg(?:e|es|ed|ing)|quot(?:e|es|ed|ing)|bill(?:s|ed|ing)?|invoice (?:you|clients|customers)|pricing|priced|fixed[- ]price|flat[- ](?:fee|rate)|fees?|retainers?|contracts?|lock[- ]?in|refund\w*|money[- ]back|guarantee[sd]?|warrant(?:y|ies)|discount\w*|commissions?|mark-?ups?|resell(?:er|ers|s|ing)?|sells?|payment terms|free of charge|at no (?:extra )?cost|no (?:hidden )?(?:fees|charges|costs))\b/i;
  const BIZ_CRED = /\b(?:accredit\w*|certified|certifications?|iso[ -]?\d{4,5}|(?:gold|silver|solutions|certified|official|premier|authori[sz]ed|preferred|cloud solution) partner(?:s|ship)?|partner of the year|award\w*|member(?:s|ship)? of|founded|since (?:19|20)\d\d|headquarter\w*|offices? in|\d[\d,.]*\+? ?(?:years?|yrs|clients?|customers?|projects?|employees|staff|consultants|engineers|implementations?))\b/i;
  const BIZ_ADVICE = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\s+(?:need|have to|recommend|suggest|advise|expect|know|mean|matter|depend|apply|require you|replace|guarantee you)\b/i;   // advice to the reader, not a statement of our scope
  const OURS_PAGE = /\b(?:[Ww]e|[Ww]e['’](?:re|ve|ll|d)|[Oo]ur|[Oo]urs|us)\b/;
  const escR = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const STOPW = new Set('the a an and or of for to in on with by at from as is are was were be been it its this that these those you your they them their there here can could will would should may might must do does did not no never only also just than then so such some any all each other more most very into over under about through which who whom what when where why how our we us ours has have had'.split(' '));
  const stem = (w) => { let x = String(w).toLowerCase().replace(/licens/g, 'licenc'); if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const words = (s, drop) => norm(s).split(' ').filter(w => w.length > 2 && !STOPW.has(w) && !(drop || []).includes(w)).map(stem);
  function business(text, corpus, opts = {}) {
    const t = String(text || ''); const out = { flags: [], checked: 0 };
    if (!t.trim()) return out;
    const names = (opts.names || []).map(n => String(n || '').trim()).filter(n => n.length >= 3);
    const nameWords = [...new Set(names.flatMap(n => norm(n).split(' ')).filter(Boolean))];
    const SUBJ = '(?:\\b[Ww]e|\\b[Oo]ur (?:team|consultants|engineers|people|firm|company|prices|fees|quotes|contracts|recommendations)' + names.map(n => '|' + (/^\w/.test(n) ? '\\b' : '') + escR(n)).join('') + ')';
    const SCOPE = new RegExp(SUBJ + '\\s+(?:(?:do|does|did|will|would|can|could)(?:\\s+not|n[\'’]t)\\b|(?:never|only)\\b)|(?:\\b[Ww]e[\'’]re|\\b[Ww]e are' + names.map(n => '|' + escR(n) + ' is').join('') + ')\\s+not\\s+an?\\b');
    const SUBJ_RE = new RegExp(SUBJ);
    const NEG_ANY = /\b(?:do|does|did|will|would|can|could)(?:\s+not|n['’]t)\b|\b(?:never|only)\b|\bnot an?\b/i;
    const cs = String(corpus || '').split(/(?<=[.!?])\s+|\n+/).map(s => ({ n: norm(s), w: new Set(words(s, nameWords)), neg: NEG_ANY.test(s) })).filter(x => x.n.length > 3);
    const lines = t.split('\n'); let prevLine = '';
    for (const line of lines) {
      const L = line.trim();
      if (!L || /^#{1,6}\s/.test(L) || /^\|/.test(L) || /^(?:Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(L)) { if (L) prevLine = L.replace(/^#+\s*/, ''); continue; }
      const sents = L.replace(/\*\*/g, '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
      for (let i = 0; i < sents.length; i++) {
        const s = sents[i].trim().replace(/^[-*]\s+/, '');
        if (s.length < 6 || /\?\s*$/.test(s) || /[\[\]]/.test(s.replace(/\[[^\[\]]*\]\([^)]*\)/g, ''))) continue;
        const plain = s.replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '');
        if (!(OURS_PAGE.test(plain) || SUBJ_RE.test(plain))) continue;
        let kind = null, trig = null, m;
        if ((m = plain.match(SCOPE)) && !BIZ_ADVICE.test(plain) && !/\b(?:what|whether|if)\s+$/i.test(plain.slice(0, m.index))) { kind = 'scope'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_TERMS))) { kind = 'terms'; trig = m[0]; }
        else if (SUBJ_RE.test(plain) && (m = plain.match(BIZ_CRED))) { kind = 'credential'; trig = m[0]; }
        if (!kind) continue;
        out.checked++;
        // an elliptical sentence ("Some can, but Tech& does not.") is read with the sentence or heading before it
        let W = words(plain, nameWords);
        if (W.length < 2) W = [...new Set(W.concat(words(i > 0 ? sents[i - 1] : prevLine, nameWords)))];
        const key = kind === 'credential' ? keyOf(trig) : stem((norm(trig).split(' ').filter(w => !STOPW.has(w) && !nameWords.includes(w))[0]) || norm(trig));
        const supported = cs.some(c => {
          if (kind === 'scope' ? !c.neg : !(key && c.n.includes(key))) return false;
          if (kind === 'credential' && /\d/.test(key)) return true;   // the same number on the site's own pages: "20+ Years"
          const hit = W.filter(w => c.w.has(w)).length; return W.length ? hit / W.length >= 0.5 : false;
        });
        if (!supported) out.flags.push({ kind, trigger: trig, sentence: s.slice(0, 300) });
      }
      prevLine = L;
    }
    return out;
  }
  return { CLAIM_RE, keyOf, check, business };
})();
// ---- verdict exclusions kit (A-18, 2026-10-17; inlined through the EXCLUSIONS marker and prepended to Parse Verdict) ----
// What the verdict said this page must NOT cover reaches the brief, the writer and the quality check. Live (exec 771) the verdict's
// own `what_must_change[3]` said "Skip the consultancy-licence and start-an-IT-company questions, which don't match buyer intent", and
// the delivered page carried the H2 "How Much Is a Consultancy Licence in Dubai?": the strategy brief prompt only ever printed the
// verdict's reasons, never its changes, so the instruction reached nobody and nothing checked it.
//   EXC.fromVerdict(changes, skips)  the topics to leave out: the verdict's structured `topics_to_skip`, plus every "skip / avoid /
//                                    leave out / do not cover …" phrase in its free-text changes (the fallback for older answers)
//   EXC.match(text, ex, keyword)     does a heading (or an outline section) cover that topic? every content word of the topic must be in it;
//                                    a one-word topic that is also a word of the page's own keyword never matches (it would match everything)
//   EXC.check(headings, list, kw)    [{ heading, topic }] for every heading that covers an excluded topic
//   EXC.prune(outline, list, kw)     the brief's outline without those sections, and the ones dropped
// Regex only (the n8n Code sandbox has no URL constructor).
const EXC = (() => {
  const S = (v) => String(v == null ? '' : v);
  const STOP = new Set('the a an and or of for to in on with by at from about any all each every their your our its it is are be this that these those how what which why when who much many do does can should would will questions question topics topic sections section queries query searches search angles angle content pages page posts post details detail things thing buyer buyers intent people readers reader'.split(' '));
  const norm = (w) => { let x = S(w).toLowerCase().replace(/licens/g, 'licenc');
    if (x.length > 5) x = x.replace(/(?:ings|ing|ies|es|ed|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const toks = (t) => S(t).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(norm);
  const SKIP_RE = /\b(?:skip|avoid|leave out|drop|exclude|omit|ignore|steer clear of|stay away from|do not (?:cover|answer|target|include)|don['’]t (?:cover|answer|target|include)|no need to (?:cover|answer))\s+(?:the\s+|any\s+|all\s+)?([^.;:!?]+?)(?=\s*,\s*(?:which|as|because|since|they|these|it|that)\b|\s+(?:which|because|since|as they|as these)\b|[.;:!?]|$)/gi;
  const TAIL_RE = /\s+(?:questions?|topics?|sections?|queries|query|searches|angles?|content|pages?|posts?|subjects?|keywords?)\s*$/i;
  const fromText = (line) => {
    const out = [];
    for (const m of S(line).matchAll(SKIP_RE)) {
      const phrase = S(m[1]).replace(TAIL_RE, '').trim();
      for (const part0 of phrase.split(/\s*(?:,|;|\band\b|\bor\b|&|\/)\s*/i)) {
        const part = part0.replace(/[-_]+/g, ' ').replace(TAIL_RE, '').trim();
        if (toks(part).length) out.push(part);
      }
    }
    return out;
  };
  const fromVerdict = (changes, skips) => {
    const seen = new Set(); const out = [];
    const add = (topic, source) => { const k = toks(topic).join(' '); if (!k || seen.has(k)) return; seen.add(k); out.push({ topic: S(topic).trim(), source }); };
    (Array.isArray(skips) ? skips : []).forEach(t => add(S(t).replace(/[-_]+/g, ' '), 'verdict'));
    (Array.isArray(changes) ? changes : []).forEach(c => fromText(c).forEach(t => add(t, 'verdict_changes')));
    return out.slice(0, 12);
  };
  const match = (text, ex, keyword) => {
    const T = toks(ex && ex.topic != null ? ex.topic : ex); if (!T.length) return false;
    const kw = new Set(toks(keyword));
    if (T.length === 1 && kw.has(T[0])) return false;
    const H = new Set(toks(text));
    return T.every(w => H.has(w));
  };
  const check = (headings, list, keyword) => {
    const out = [];
    for (const h of (Array.isArray(headings) ? headings : [])) {
      const text = S(h).replace(/^#+\s*/, '').replace(/[*_`]+/g, '').trim(); if (!text) continue;
      const ex = (Array.isArray(list) ? list : []).find(e => match(text, e, keyword));
      if (ex) out.push({ heading: text, topic: S(ex.topic != null ? ex.topic : ex) });
    }
    return out;
  };
  const prune = (outline, list, keyword) => {
    const kept = [], dropped = [];
    for (const sec of (Array.isArray(outline) ? outline : [])) {
      const ex = (Array.isArray(list) ? list : []).find(e => match(S(sec && sec.h2), e, keyword));
      if (ex) dropped.push({ h2: S(sec.h2), topic: S(ex.topic) }); else kept.push(sec);
    }
    return { kept, dropped };
  };
  return { fromVerdict, fromText, match, check, prune, toks };
})();
// ---- fit gate (2026-10-11, FIX_PLAN D4 / D8): ONE rule for keywords that no page of this website should target. Inlined by the build
// (the FIT_GATE placeholder) into Analyze Keywords (full report: keyword gap, easy wins, opportunities), Rank Keywords (discovery), Ladder Pool /
// Ladder Plan (ladder rungs and the main keyword), Relevance Chunks (the brands the AI screen is told about) and Brief Context (the hub
// page's cluster list); a copy goes to harness/code_v4/_fit_gate.js as a shim (S34). fitGate(keyword, ctx) -> { ok: true } or
// { ok: false, reason, detail } with reason one of:
//   'own brand'    — the keyword names the website itself (its domain label, 4+ letters);
//   'navigational' — DataForSEO Labs says the intent is navigational (ctx.intent);
//   'government'   — the keyword is a public body or an identity document and nothing else (FTA, EmaraTax, MoHRE, GDRFA, ICP, RTA, DEWA,
//                    ZATCA, GOSI, "ministry …", "… authority", Emirates ID, UAE Pass, visa / labour card status …), or a body with a portal /
//                    status word ("fta portal", "emirates id status"), or, with its results page in hand (ctx.serp), 3+ of the top 5 results
//                    are on government hosts (.gov / .gov.xx / .gouv.xx / u.ae …);
//   'portal'       — a login / portal / password / status check / renewal / verification / application task: people want the owner's own site;
//   'off topic'    — with topics on file (ctx.topics, R13): under a quarter of the keyword's own words have anything to do with what the
//                    site sells ("character ai", "mofa attestation dubai", "mh enterprises uae");
//   'too broad'    — with topics on file: nothing but generic or place words is left of it ("ai", "google ai", "microsoft ai");
//   'other brand'  — one of its words is the label of a declared competitor (cleartax.com ↔ "cleartax"), of a domain on the results page
//                    (facts.ae ↔ "facts"), or a brand name AI uses for another company (seo_cache ai_brands: name -> domain); with the
//                    keyword's own results page in hand also when one domain whose label is in the keyword holds 3+ of the top 5.
// Bounds, so that legitimate keywords survive:
//   * a public body with a topic word is a topic, not a destination: "zatca e invoicing", "fta vat registration", "mohre wps" are kept — only
//     the body alone (plus country words) or with a portal / status word is refused;
//   * a portal word with a content / buying word is kept ("best erp software with mobile login", "emaratax registration guide"); a plain
//     category noun is not enough ("erp software login" is still a login);
//   * a results-page or AI-named brand with a partner-type word ("sap implementation dubai", "microsoft dynamics 365 partner uae") or a
//     comparison word ("facts erp vs odoo") is kept; a declared competitor is kept only when compared ("cleartax vs zoho"); a results-page
//     label (often a dictionary word) counts only where a product name sits — first, or right before a category word ("facts erp", not
//     "erp facts and figures guide");
//   * a domain label shorter than 4 letters, a word of the keyword being researched (ctx.protect: head term / seeds / services) or a generic
//     word (erp, software, tax …) never counts as a brand; "www", "m", "app" prefixes are dropped before the label is taken.
// Relevance to the website's services is NOT judged here. ctx.relevance (FIX_PLAN G19) is the hook: a function (keyword) -> { ok, reason,
// detail } called last, so the first version of G19 plugs in without touching the callers.
const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
// B-3 (2026-10-17, re-rating 2026-10-17, exec 767): the same refusal WITHOUT a body's name. "mofa attestation dubai" was refused but "uae document
// attestation" and "mofa document attestation" were offered as keyword-gap targets under a High finding: attesting, legalising or notarising a
// person's document is a public service whatever words surround it. A keyword whose own words are such a service word plus document / service
// words is refused as 'government'; "attestation software" or "document attestation management system" keep a product word and stay.
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
// B-3: a person looking for work is not a buyer ("finance jobs in uae", "finance manager jobs in uae" were offered as easy wins). A job word with no
// product word ("recruitment software", "hr jobs portal system") is refused as 'job search'.
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
// B-3: words common enough in English that, lifted out of a longer service NAME, they say nothing about the topic: "intelligent" out of
// "Intelligent Document Processing" let "intelligent software solutions" (another company's name) through; "management" out of "Supply Chain
// Management" let "top facilities management companies uae" through; "commerce" out of "Dynamics 365 Commerce" let "commercial companies law
// uae" through. Such a word counts as on topic only when the keyword carries the whole name, or at least two of its words (fitTopic).
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
// F-KW (2026-10-20, finding 8): letters and digits of EVERY script, not a-z only. An Arabic keyword ("برنامج محاسبة في الإمارات") was
// no tokens at all, so a ladder the client chose in Arabic was set aside as `empty` and every Arabic item key was ''. NFKC folds
// full-width and compatibility forms, toLowerCase (never the locale form) folds case; marks (\p{M}) stay inside their word.
const FIT_SPLIT = /[^\p{L}\p{M}\p{N}.]+/u, FIT_SPLIT_WORDS = /[^\p{L}\p{M}\p{N}]+/u;
const fitLow = (s) => String(s || '').normalize('NFKC').toLowerCase();
const fitTokens = (s) => fitLow(s).replace(/[’']/g, '').split(FIT_SPLIT).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// F-KW (2026-10-20, finding 5): a label is the website's own BRAND only when it is distinctive. A label that splits entirely into category,
// generic or place words, or into the words of the keyword or of what the client protected (its ladder heads, its services), describes what
// the site sells ("erp-software.ae", "crmexperts.ae", "accountingsoftware.ae", "interiordesign-dubai.com"); it is not a name, and a keyword
// built from those words is the client's own subject. "techand" does not split ("tech" + the stop word "and" is not allowed), so "techand crm"
// stays the site's own brand. The label itself is never part of its own vocabulary, so "crmexperts reviews" (one word) is still the brand.
const FIT_CATEGORY = new Set(['expert', 'experts', 'specialist', 'specialists', 'consultant', 'advisor', 'advisors', 'advisory', 'agency', 'agencies', 'design', 'designs', 'designer', 'designers',
  'interior', 'interiors', 'outsourcing', 'marketing', 'seo', 'legal', 'law', 'lawyer', 'lawyers', 'clinic', 'clinics', 'dental', 'medical', 'health', 'care', 'realty', 'property', 'properties', 'homes',
  'travel', 'tours', 'logistics', 'cargo', 'shipping', 'trading', 'auto', 'autos', 'cars', 'motors', 'insurance', 'printing', 'events', 'cleaning', 'maintenance', 'security', 'training', 'courses',
  'implementation', 'integration', 'migration', 'support', 'hosting', 'it', 'hr', 'audit', 'auditing', 'bookkeeping', 'consult', 'advice', 'pros', 'works', 'labs', 'studio', 'studios',
  'center', 'centre', 'source', 'point', 'zone', 'link', 'links', 'line', 'now', 'hq', 'co', 'inc', 'llc', 'ltd', 'fz', 'fzco', 'fze', 'dmcc']);
const fitWordBreak = (label, vocab) => { const n = label.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
  for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 30); j < i; j++) if (ok[j] && vocab.has(label.slice(j, i))) { ok[i] = true; break; }
  return ok[n]; };
const fitOwnLabels = (domain, toks, protect) => fitLabels(domain, []).filter(l => {
  const words = [...FIT_GENERIC, ...FIT_GEO, ...FIT_CATEGORY, ...(toks || []), ...(protect || [])].map(w => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(w => w.length >= 2 && w !== l && !FIT_STOP.has(w));
  const vocab = new Set(); for (const w of words) { vocab.add(w); vocab.add(w + 's'); if (w.length > 3 && w.endsWith('s')) vocab.add(w.slice(0, -1)); }
  vocab.delete(l);
  return !fitWordBreak(l, vocab); });
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
// ---- R13 (2026-10-13, re-rating §3.11): TOPIC DISTANCE, the same 25% bar the outreach gate uses (OK.OFF_TOPIC in _outreach_kit.js) ----
// The full report's §4a offered "ai" (165,000/mo), "character ai" (110,000), "google ai", "humanize ai", "meta ai", "blackbox ai",
// "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id status with passport
// number", under a High finding telling the owner to build pages for them: the gate only ever refused classes somebody had listed
// (navigational, a declared competitor, a results-page label), so a brand or a subject nobody listed walked straight through. fitTopic()
// measures what share of a keyword's OWN distinctive words the site's topics carry. Place names and generic category words are neutral —
// they count for neither side, so "best erp software dubai" is judged on "erp" — and a keyword left with nothing but generic or place
// words ("ai", "google ai", "microsoft ai") is too broad for any page of this site to win.
const FIT_TOPIC_BAR = 0.25;
// B-3: category words too wide to stand for what a site sells on their own: "dubai business tax" and "uae businesses" were judged "a category you
// sell (business) in your market" because the site's services name "Dynamics 365 Business Central". They never count for a head term.
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).normalize('NFKC').toLowerCase()
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = fitLow(t).split(FIT_SPLIT_WORDS).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
    return { dist: [...new Set(w.filter(x => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] }; })
  .filter(p => p.dist.length).map(p => ({ ...p, prose: p.dist.length > 6 }));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !/^\d+$/.test(t));   // F-KW: a year or a number ("2026") is neutral, like a place
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !/^\d+$/.test(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    return { ok: false, reason: 'too broad', detail: 'only category or place words, so it says nothing about ' + label + ' ("' + String(keyword || '').trim() + '")', share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * hits.length / own.length) / 100;
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label, share };
}
// ---- F-KW (2026-10-20, findings 1 and 2): POSITIVE topic evidence, for the decisions that write on their own ----
// fitTopic answers "may we refuse it?" and, with fewer than 12 topic words on file, refuses nothing ("no evidence, no refusal"). That is the
// right rule for a refusal and the wrong one for writing a page on our own: a site that lists two services passed every keyword. fitEvidence
// answers "is there evidence it is the client's subject?": `in` = at least the topic bar of the keyword's own words is in the topics given (any
// number of topic words); `out` = with 12+ topic words on file the keyword misses the bar (a refusal); `unknown` = too little on file to say,
// which a caller must treat as NOT in topic (a suggestion at most) and say so in plain words.
function fitEvidence(keyword, topics, ctx) {
  const T = fitTopicWords(topics);
  if (!T.size) return { verdict: 'unknown', share: null, words: 0, detail: 'nothing is on file about what this website sells or the keywords you chose, so whether it is on topic cannot be judged' };
  const t = fitTopic(keyword, topics, { ...(ctx || {}), topic_min_words: 1 });
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail };
  if (T.size >= 12) return { verdict: 'out', share: t.share == null ? null : t.share, words: T.size, detail: t.detail };
  return { verdict: 'unknown', share: t.share == null ? null : t.share, words: T.size, detail: 'not enough information to judge whether it is on topic: only ' + T.size + ' topic word' + (T.size === 1 ? '' : 's') + ' on file, and too few of them are in this keyword' };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  const kw = String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  // 1. the website itself
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  for (const l of fitOwnLabels(ctx.own_domain, toks, protect)) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 3. a public body or an identity document: "ministry of finance", "federal tax authority" (no content / buying word), "fta", "emaratax uae",
  //    "emirates id status" (the body alone, or with a portal / status word); "zatca e invoicing" and "fta vat registration" are topics and stay
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: 'a public body, not a topic (' + String(govWord[1] || govWord[0]).trim() + ')' };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter(t => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: 'a public body or an identity document, not a topic (' + body + ')' };
    // R60 (2026-10-16, re-rating 2026-10-15): "mofa attestation dubai" and "how to check emirates id status with passport number" walked
    // through because one more word ("attestation", "passport") or a content word ("how to") made them look like a topic. A word that only
    // names what the public body does FOR A PERSON (attest a document, issue a passport or visa, renew a card, collect a fine, book an
    // appointment) adds no topic: the searcher still wants the body's own service, whatever "how to" is in front of it. "fta vat registration"
    // and "zatca e invoicing" keep a business topic word of their own, so they stay.
    if (rest.every(t => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: 'a service a public body provides to a person, not a topic for this website (' + body + ': ' + rest.join(' ') + ')' };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) ? fitTopicWords(ctx.topics) : null;
  const sells = (re) => !!topicT && [...topicT].some(w => re.test(w));
  // 3b. a document service a public body provides to a person, without the body's name ("uae document attestation"): refused unless the
  //     site's own topics say it sells that service (an attestation agency keeps it)
  const docSvc = toks.filter(t => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(t => !FIT_GEO.has(t) && !FIT_DOC_SERVICE.test(t) && !FIT_GOV_SERVICE.test(t) && !FIT_GOV_NAMES.test(' ' + t + ' ')
      && !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t));
    if (!restD.length) return { ok: false, reason: 'government', detail: 'a document service public bodies (a ministry, an embassy, a notary) provide to a person (' + docSvc.join(' ') + '), not a topic for this website' };
  }
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 4b. a person looking for work (B-3): no product word in it, and the site's topics are not recruitment
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return { ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' };
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !protect.includes(t));
    if (!nt.length || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  else if (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) {
    const t = fitTopic(kw, ctx.topics, ctx); if (!t.ok) return { ok: false, reason: t.reason, detail: t.detail };
  }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- R16 (2026-10-13, system review FIX_PLAN §3.11): the same gate, run over a row somebody stored BEFORE the gate existed ----
// The gate stops a new keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of lad_mv40b6s9h5a8 still held
// "facts erp" (facts.ae, a competing UAE ERP vendor) as a planned page, so the Rank Tracker's report of 2026-10-12 listed it and the
// Content Cadence would have written it. `fitStored` is `fitGate` plus the one rule a stored row needs: a rung whose page is already
// written or published is never dropped — that page is live work, it keeps being tracked, and it is flagged instead of hidden.
// Returns { ok, live, flagged, reason, detail, note }: ok false = leave it out of what is written and reported; `note` is the sentence
// a report or the repair script prints, so the reason always travels with the decision.
const fitStoredLive = (row) => { const r = row || {}; const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
const fitStored = (row, ctx) => {
  const r = row || {}; const kw = String(r.keyword || '').trim();
  const live = fitStoredLive(r) || (ctx || {}).written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx || {});
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = '"' + kw + '" is not a search this website should target: ' + g.detail + ' (' + g.reason + ')';
  // F-KW (2026-10-20, finding 10): plain sentences, and no claim about WHEN the row was planned: a row written after the gate existed (its
  // results page changed, a competitor was declared later) is set aside by the same rule, and "planned before this rule existed" was false for it
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. Its page is already written, so it stays tracked; decide whether to keep it.' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. It is set aside, so no page is written for it.' };
};
// ---- B-G1 / B-G2 / B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the READ path, written once ----
// R16 put `fitStored` on two read paths — the Rank Tracker and the Content Cadence — and wrote the loop around it twice. Three more
// readers of the same stored rungs were written afterwards without it, and every one of them ACTS on what it reads: *AI Plan* (the AI
// Visibility Tracker and the AI Pulse) turns a stored rung into a question asked of ChatGPT and then scores the site against the answer;
// *Growth Plan* turns it into a "question to win" and then into a page the Content Cadence writes; *Site Plan* buys it a live rank check
// every week and prints it in the weekly report. Three copies of one loop are three chances to drift, and the drift IS this defect — so
// the loop lives here, once, and every reader calls it. FITR.rungs() never throws a refusal away: `set_aside` carries the row, the reason
// and the sentence to print, because a list that is shorter because a gate ran has to say so (INVARIANTS rule 1).
const FITR = {
  // The context a stored row is judged in. Deliberately the shape R16's two callers build by hand: the site's own domain, the
  // competitors it declared, the brand names AI uses for other companies, and — PROTECTED, so the ladder's own subject can never look
  // like somebody's brand — the ladder head terms, the site's services and its own tracked keywords. Topics are optional: with none on
  // file the topic bar judges nothing (fitTopic's own "no evidence, no refusal" rule).
  ctx(o) {
    o = o || {};
    const own = fitHost(o.own_domain || o.domain || '');
    const protect = [...new Set([...(o.heads || []), ...(o.services || []), ...(o.keywords || []), ...(o.protect || [])]
      .map(x => String(x || '').trim()).filter(Boolean))];
    return { own_domain: own, brands: o.brands || {}, intent: o.intent || '',
      competitors: [...new Set((o.competitors || []).map(fitHost).filter(d => d && d !== own))],
      serp_domains: (o.serp_domains || []).map(fitHost).filter(Boolean), protect,
      topics: o.topics && (Array.isArray(o.topics) ? o.topics.length : String(o.topics).trim()) ? o.topics : null,
      topic_label: o.topic_label || 'what this website sells' };
  },
  // Every stored row, gated once. Returns { keep, set_aside, dropped, flagged, refused_keywords }:
  //   keep      — what the caller may act on (a row whose page is already written stays: that page is live work);
  //   set_aside — one record per refusal, with `reason`, `detail`, `note` (the sentence to print), `written` and `dropped`.
  // opts: { keyword: row -> the keyword (default row.keyword), live: row -> true when the row must be kept and only flagged,
  //         serpFor: (keyword, row) -> [domains in rank order] for the results-page rules, where: a label naming this read path }.
  rungs(rows, ctx, opts) {
    const o = opts || {}; const C = ctx || {};
    const kwOf = typeof o.keyword === 'function' ? o.keyword : ((r) => (r || {}).keyword);
    const liveOf = typeof o.live === 'function' ? o.live : null;
    const serpFor = typeof o.serpFor === 'function' ? o.serpFor : null;
    const keep = []; const set_aside = [];
    for (const r0 of (rows || [])) {
      const r = (r0 && typeof r0 === 'object') ? r0 : {};
      const kw = String(kwOf(r0) || '').trim();
      if (!kw) { keep.push(r0); continue; }   // a row with no keyword is not this gate's business (the caller's own emptiness rules apply)
      const serp = serpFor ? (serpFor(kw, r0) || []).map(fitHost).filter(Boolean) : [];
      let c = C;
      if (serp.length) c = { ...c, serp, serp_domains: [...new Set([...(C.serp_domains || []), ...serp])] };
      if (liveOf && liveOf(r0)) c = { ...c, written: true };
      const g = fitStored({ ...r, keyword: kw }, c);
      if (g.ok) keep.push(r0);
      if (!g.flagged) continue;
      set_aside.push({ keyword: kw, reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok,
        where: String(o.where || ''), ladder_id: r.ladder_id || '', head_keyword: r.head_keyword || '', rung: Number(r.rung) || 0,
        page_no: Number(r.page_no) || 0, status: r.status || '', target_url: r.target_url || '', prompt_id: r.prompt_id || '' });
    }
    return { keep, set_aside, dropped: set_aside.filter(x => x.dropped), flagged: set_aside.filter(x => !x.dropped),
      refused_keywords: set_aside.filter(x => x.dropped).map(x => x.keyword) };
  },
  // The sentence a human reads. INVARIANTS rule 1: a list that is shorter because a gate ran says so, with the reason, every time.
  // `what` finishes "so they are not …" ("asked of the AI engines", "tracked", "written as a page").
  line(set_aside, what) {
    const a = (set_aside || []).filter(x => x && x.dropped);
    if (!a.length) return '';
    return a.length + ' stored keyword' + (a.length === 1 ? ' was' : 's were') + ' set aside, so ' + (a.length === 1 ? 'it is' : 'they are')
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" (' + (x.detail || x.reason) + ')').join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. A page that is already written is kept and only flagged.';
  }
};
// Deterministic quality gate for the generated page. v5 adds: banned-phrase (AI cliché) detection, readability (Flesch),
// term coverage against the competitor term model / brief, specificity, section-length checks, the editor's critique,
// and a 0-100 CONTENT SCORE. Schema is generated here (page-type aware), never by the model.
const prev = $('Parse Brief').first().json;
const inItem = $input.first().json;
const rawOut = inItem.output;
let md = (typeof rawOut === 'string' ? rawOut : JSON.stringify(rawOut || '')).trim();
const round = ($runIndex || 0) + 1;
const critique = round === 1 ? (inItem.critique || null) : null;
let lastCritique = null; try { lastCritique = $('Parse Critique').first().json.critique || null; } catch (e) {}
const fixes = [];
const warnings = [];
const brief = prev.content_brief || {};
const kw = String(prev.keyword || '').toLowerCase();
const domain = prev.domain || '';
// D15 (system review 2026-10-11): every URL we emit uses the site model's canonical host (SITE_MODEL_SPEC.md §6) -- the bare domain
// 308-redirects on a www site. With no model (an older run) or another site's domain, the bare domain keeps today's behaviour.
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const siteUrlOf = (dom, path) => SM.siteUrl(SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(dom) ? SITE_MODEL : { domain: dom }, path);
const today = new Date().toISOString().slice(0, 10);

const plain = (s) => String(s || '').replace(/\[([^\[\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>]+/g, '').replace(/\s+/g, ' ').trim();
const countWords = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. Strip any schema/script the model added
const before0 = md;
md = md.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/```(?:json|html)?\s*\{[\s\S]*?"@context"[\s\S]*?```/gi, '').trim();
if (md !== before0) fixes.push('Removed model-written schema/script blocks (schema is generated by the QA step)');

// 2. The word "placeholder" must never appear
const before1 = md;
md = md.replace(/\s*\((placeholders?|placeholder for [^)]*)\)/gi, '').replace(/\b(indicative\s+)?price placeholders?\b/gi, 'prices').replace(/\bplaceholders?\b/gi, 'details');
if (md !== before1) fixes.push('Removed the word "placeholder" from text');

// 2b. The source text this run really read, keyed by URL (B3-1, 2026-10-15, benchmark area 3). This used to be built in §9b only, which left
//     the money mask below reading a NARROWER corpus than the figure check forty lines later: the mask knew only `prev.facts`, so an amount
//     printed in a page the run fetched was destroyed while a percentage in the very same sentence of the very same source was kept. Both
//     checks now read the same map. It is built here because the mask runs first and rewrites `md` irreversibly.
const srcText = new Map();
const ownFacts = String(prev.business || '') + ' ' + String(prev.business_facts || '') + ' ' + String(prev.case_facts_text || '');   // the client's own numbers vouch for themselves
// A-19 / A-15 (2026-10-17, re-rating 2026-10-17): what the business says about itself, from every place this run read it — the facts
// and description it gave, the business profile (author, reviewer, NAP), the site model (business facts, accreditation, services) and
// the text of its own pages this run fetched (homepage, the page on this topic, a related page). Live (exec 771) round 1 flagged "20+
// years" as an unverified statistic although the homepage says "20+ Years" and `client_pages` carried it: the check read only
// `business_facts` + `case_facts_text`, both empty. The same corpus decides whether a statement about the business's own terms is
// on file (§9d) and which figures need no external source (§9, §9b).
const OWN_TEXT = (() => {
  const SMx = SITE_MODEL || (prev.site_model && typeof prev.site_model === 'object' ? prev.site_model : null) || {};
  const vals = (o) => (o && typeof o === 'object') ? Object.values(o).map(v => (v && typeof v === 'object') ? vals(v) : String(v == null ? '' : v)).join(' ') : String(o || '');
  return [prev.business, prev.business_facts, prev.case_facts_text, SMx.business_facts, SMx.accreditation, vals(SMx.services), vals(SMx.nap),
    vals(prev.site_profile), vals(prev.author), vals(prev.reviewer), ...(prev.client_pages || []).map(p => p && p.text), prev.existing_page_text,
    prev.existing_page_facts_text, vals(prev.client_signals)].filter(Boolean).map(String).join('\n');
})();
const ownLower = OWN_TEXT.toLowerCase().replace(/\s+/g, ' ');
const addSrc = (u, t) => { const k = SRC.key(u); if (!k || !String(t || '').trim()) return; srcText.set(k, ((srcText.get(k) || '') + ' ' + String(t)).slice(0, 12000)); };
(prev.facts || []).forEach(f => addSrc(f && f.url, [f && f.text, f && f.claim, f && f.title].filter(Boolean).join(' ')));
(brief.evidence_plan || []).forEach(e => addSrc(e && e.source_url, e && e.fact));
(prev.competitors || []).forEach(c => addSrc(c && c.url, [c && c.content_full, c && c.content, c && c.snippet].filter(Boolean).join(' ')));
// B3-8 (2026-10-16, benchmark area 3 / area 4): a REFRESH re-reads the sources the live page cites (*Refresh Source Plan* -> *Fetch
// Refresh Sources* -> *Refresh Sources*, in front of this node). A page rewritten on top of its live version used to keep every figure
// it carried with its old citation unchecked: §9b looks a figure up only in a source the run read, and the run never read the live
// page's own sources, so "the source was never fetched" let them all through. The re-read text is the whole page as it reads today
// (cut only at FRESH_CAP characters, and then said so), so a figure missing from it is missing from the source, not from an excerpt.
let RS = null; try { RS = ($('Refresh Sources').first().json || {}).refresh_sources || null; } catch (e) { RS = null; }
const FRESH_CAP = 40000;
const freshRead = new Map();   // key -> { cut } for every source re-read whole on this refresh
// The whole page supersedes any snippet of it the run held, and an ellipsis or a "Read more" link inside a page read whole is page
// furniture, not a cut: it is neutralised, so R37's "not in the excerpt" is said only when FRESH_CAP really cut the text (then " …").
if (RS && RS.refresh) (RS.sources || []).filter(s => s && s.ok && String(s.text || '').trim()).forEach(s => { const k = SRC.key(s.url); if (!k) return;
  const whole = String(s.text).replace(/\.{3}|…|\bread more\b/gi, ' ');
  const cut = !!s.cut || whole.length > FRESH_CAP;
  srcText.set(k, whole.slice(0, FRESH_CAP) + (cut ? ' …' : '')); freshRead.set(k, { cut }); });
// the sources a sentence itself cites, and whether one of them states this amount (same rule as §9b: the figure is looked up only in the
// pages that sentence links to, never in the whole run's reading).
// A link target is full of full stops (`…/cabinet-decision-106.pdf`), and a sentence finder that splits on "." splits inside it — which
// cuts the citation off the very sentence that needs it. Boundaries are therefore taken on a shadow copy with every link TARGET blanked,
// and the text is then read back out of the original at those same offsets, so the link survives whole.
const linkRe = () => /\]\((https?:\/\/[^)\s]+)\)/g;
const shadowOf = (t) => String(t).replace(linkRe(), (m) => '](' + ' '.repeat(Math.max(0, m.length - 3)) + ')');
const amountInCitedSource = (amt, sent) => { const f = SRC.valueOf(String(amt).trim()); if (!f) return null;
  for (const m of String(sent).matchAll(linkRe())) { const t = srcText.get(SRC.key(m[1])); if (t && SRC.hasFigure(f, t)) return SRC.host(m[1]); }
  return null; };

// 3. Prices become [Price] unless the user gave prices (business facts / description). v4.9 (live 2026-10-02 and 2026-10-08): an amount the
//    verified facts state stays as written (official fines and thresholds, with their source link); an unsourced amount that is not about the
//    business's own prices (a revenue threshold, a fine, a market figure, or anything in millions) becomes [Confirm: AED 50m], so the reviewer
//    sees the figure to check instead of a misleading "[Price]m"; every other amount is an invented price and becomes [Price].
const userText = String(prev.business || '') + ' ' + String(prev.business_facts || '') + ' ' + String(prev.case_facts_text || '');   // case-study facts (v4.4) are the client's own numbers
const userGavePrices = /\d/.test(userText) && /(\$|£|€|₹|\b(aed|sar|pkr|inr|usd|gbp|eur|zar|brl|mxn|rs)\b)/i.test(userText);
// B3-2 (2026-10-15): what the mask took out, with the sentence it took it from. [Price] carries no value, so until now the owner was told
// only that "a [Price] is somewhere in the copy" and could never confirm or reject the number that had been removed.
const masked_amounts = [], flagged_amounts = [], sourced_amounts = [];
if (!userGavePrices) {
  const sym = { GBP: '£', USD: '\\$', CAD: '\\$', AUD: '\\$', NZD: '\\$', SGD: '\\$', PKR: '(?:Rs\\.?|PKR)', INR: '(?:Rs\\.?|₹|INR)', AED: '(?:AED|Dh)', SAR: '(?:SAR|SR)', EUR: '€', ZAR: 'R', BRL: 'R\\$', MXN: '\\$' }[prev.currency] || '[£$€]';
  const unit = '(?:\\s?(?:k|K|m|M|bn|BN|million|Million|billion|Billion|thousand))?\\b';
  const priceRe = new RegExp(sym + '\\s?\\d[\\d.,]*' + unit + '(\\s?(–|-|to)\\s?' + sym + '?\\s?\\d[\\d.,]*' + unit + ')?', 'g');
  const factsText = ((prev.facts || []).map(f => String((f && (f.claim || f.text)) || '')).join(' \n ') + ' ' + userText).replace(/(\d),(?=\d{3}\b)/g, '$1');
  const numsOf = (amt) => (String(amt).replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) || []);
  const verified = (amt) => { const n = numsOf(amt); return n.length > 0 && n.every(x => new RegExp(sym + '\\s?' + x.replace('.', '\\.') + '(?![\\d])', 'i').test(factsText)); };
  const PRICE_WORDS = /\b(price[sd]?|pricing|cost[s]?|fees?|quotes?|packages?|plans?|investment|budget|starting|subscriptions?|rates?|charge[sd]?|pay|paid|per (user|seat|hour|day|project))\b/i;
  const OTHER_WORDS = /\b(revenue|turnover|threshold|fines?|penalt(y|ies)|tax|vat|levy|duty|salary|salaries|wages?|market|funding|raised|valuation|gdp|economy|exports?|imports?|sales of)\b/i;
  // B3-2 (2026-10-15, benchmark area 3): a statutory amount is never OUR price, so a price VERB must not decide it. Live, the delivered
  // "uae e invoicing penalties" page said the penalty "costs [Price] per month" and its comparison table's Fine column read "[Price] per
  // month" 43 times -- because the guard was `(big || OTHER_WORDS) && !PRICE_WORDS`, and "costs" is a PRICE_WORD. [Price] destroys the
  // number; [Confirm: AED 5,000] keeps it in front of the reviewer, which is the whole point of the marker. These subjects always win.
  const STATUTORY_WORDS = /\b(fines?|fined|penalt(y|ies)|penalised|penalized|threshold|levy|levies|duty|duties|violations?|non-?compliance|sanctions?|administrative penalt(y|ies))\b/i;
  const mdShadow = shadowOf(md);   // B3-1: the link targets blanked, so a full stop inside a URL cannot end a sentence
  const sentenceAt = (text, at, len) => { const g = text.length === mdShadow.length ? mdShadow : text;
    let a = at, b = at + len; while (a > 0 && !/[.!?\n|]/.test(g[a - 1])) a--; while (b < g.length && !/[.!?\n|]/.test(g[b])) b++; return text.slice(a, b); };
  // R11 (2026-10-13, re-rating §3.11): a passage the draft itself declares illustrative or hypothetical keeps its figures. Live, the mask
  // turned a worked example into "40 fee-earners at an average rate of [Price] per hour" and "billings of [Price] a week (40 × 22.5 ×
  // [Price])" two lines under "All figures are illustrative assumptions for a hypothetical firm", so the arithmetic of the whole example
  // was destroyed and the page shipped with 11 × [Price]. The guard is unchanged everywhere else: an unsourced amount the draft states as
  // a real price still becomes [Price], and an unsourced threshold or fine still becomes [Confirm: …].
  const ILLUSTRATIVE_RE = /\b(illustrative|illustration only|hypothetical|worked example|for example only|example figures|sample figures|not benchmarks|assumptions for a)\b/i;
  const illustrativeZones = (() => {
    const out = []; const starts = [0]; const re = /^#{1,6} .*$/gm; let h;
    while ((h = re.exec(md))) if (h.index > 0) starts.push(h.index);
    for (let i = 0; i < starts.length; i++) { const a = starts[i], b = i + 1 < starts.length ? starts[i + 1] : md.length; if (ILLUSTRATIVE_RE.test(md.slice(a, b))) out.push([a, b]); }
    return out;
  })();
  const inIllustrative = (at) => illustrativeZones.some(z => at >= z[0] && at < z[1]);
  let masked = 0, flagged = 0, kept = 0, illustrative = 0, sourced = 0;
  md = md.replace(priceRe, (amt, _r, _s, at, whole) => {
    if (inIllustrative(at)) { illustrative++; return amt; }
    if (verified(amt)) { kept++; return amt; }
    const sent = sentenceAt(whole, at, amt.length);
    // B3-1: the amount is in a page THIS SENTENCE cites and the run really read — the same test §9b applies to every other figure.
    const host = amountInCitedSource(amt, sent);
    if (host) { sourced++; sourced_amounts.push({ amount: amt.trim(), source: host }); return amt; }
    const big = /(m|M|bn|BN|million|Million|billion|Billion)\b\s*$/.test(amt);
    const context = plain(sent).trim().slice(0, 110);
    if (STATUTORY_WORDS.test(sent) || ((big || OTHER_WORDS.test(sent)) && !PRICE_WORDS.test(sent))) {   // B3-2: a fine is never our price
      flagged++; flagged_amounts.push({ amount: amt.trim(), context }); return '[Confirm: ' + amt.trim() + ']';
    }
    masked++; masked_amounts.push({ amount: amt.trim(), context }); return '[Price]';
  });
  if (masked) fixes.push(`Replaced ${masked} invented price(s) with [Price]`);
  if (flagged) fixes.push(`Marked ${flagged} unsourced amount(s) (thresholds, fines, market figures) as [Confirm: …] for review`);
  if (kept) fixes.push(`Kept ${kept} amount(s) stated in the verified facts`);
  if (sourced) fixes.push(`Kept ${sourced} amount(s) that the source cited in the same sentence states (${[...new Set(sourced_amounts.map(a => a.source))].slice(0, 4).join(', ')})`);
  if (illustrative) fixes.push(`Kept ${illustrative} amount(s) inside a passage the draft labels illustrative or hypothetical (a worked example has to keep its arithmetic)`);
}

// 4. Meta lines — and nothing else may sit between them and the H1 (models sometimes add "production notes")
const metaOf = (label) => { const m = md.match(new RegExp('^' + label + ':\\s*(.+)$', 'im')); return m ? m[1].trim() : ''; };
const metaTitle = metaOf('Title'), metaDesc = metaOf('Meta Description');
// R15 (2026-10-13, re-rating §3.11): a ladder page keeps the URL its ladder row planned. Live, the row said
// `…/service-industry-erp-software/` (the ladder's link map, the siblings' up-links and the Rank Tracker all use it) while the page was
// delivered as `service-industry-erp-software-uae`, so publishing it would have left every stored link pointing at a URL that never exists.
const ladderPlannedUrl = (prev.ladder_id && String(prev.ladder_target_url || '').trim()) ? String(prev.ladder_target_url).trim() : '';
const ladderSlug = ladderPlannedUrl ? (ladderPlannedUrl.replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop() || '') : '';
const slugWritten = metaOf('Slug');
const slug = ladderSlug || slugWritten;
if (ladderSlug && slugWritten && slugWritten.replace(/^\/|\/$/g, '') !== ladderSlug) fixes.push('Kept the URL the keyword ladder planned (/' + ladderSlug + '/) instead of the slug the draft suggested (' + slugWritten + '): the ladder\'s link map, the other pages\' links and the rank tracking all use the planned URL');
{
  const h1At = md.search(/^# .+$/m);
  if (h1At > 0) {
    const head = md.slice(0, h1At);
    const metaLines = head.split('\n').filter(l => /^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(l.trim()));
    const other = head.split('\n').filter(l => l.trim() && !/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):/i.test(l.trim()));
    if (other.length) { md = metaLines.join('\n') + '\n\n' + md.slice(h1At); fixes.push('Removed ' + other.length + ' line(s) of notes that sat between the meta lines and the H1'); }
  }
}

// 4b. A-17 (2026-10-17, re-rating 2026-10-17): the blocks an editing round may never take out. Live (exec 771) round 1 had a 63-word
//     Quick answer right under the introduction; the single editor call — told to CUT 946 words and to cut "restatements of the quick
//     answer" — removed the block itself, and round 2 refused the page for "Quick answer block missing". Every round after the first is
//     compared with the draft the editor was given (*Needs Revision?* holds it): a Quick answer that was there and is gone is put back
//     where it stood (after the introduction), and a source link whose anchor words the editor kept word for word but unlinked is linked
//     again (only a source of the evidence plan or the run's facts, or an official host, and never one the link check found dead). The
//     author box is not in the draft at all (the blog package adds it after this gate), so no edit can remove it.
const protected_restored = [];
if (round > 1) {
  let PRV = null; try { PRV = $('Needs Revision?').first().json || null; } catch (e) { PRV = null; }
  const prevMd = PRV && typeof PRV.output === 'string' ? PRV.output : '';
  const QA_LINE = /^\**\s*Quick answer:?\**\s*(.+)$/im;
  const prevQA = prevMd ? prevMd.match(QA_LINE) : null;
  if (prevQA && !QA_LINE.test(md)) {
    const lines = md.split('\n'); const h1i = lines.findIndex(l => /^# /.test(l));
    if (h1i >= 0) {
      let i = h1i + 1; while (i < lines.length && (!lines[i].trim() || /^!\[/.test(lines[i].trim()))) i++;   // blank lines and the hero image
      let j = i; while (j < lines.length && lines[j].trim() && !/^#/.test(lines[j])) j++;   // the introduction paragraph
      const at = (i < lines.length && !/^#/.test(lines[i])) ? j : h1i + 1;
      lines.splice(at, 0, '', prevQA[0].trim(), '');
      md = lines.join('\n').replace(/\n{3,}/g, '\n\n');
      const qw = countWords(plain(prevQA[1]));
      protected_restored.push({ block: 'quick_answer', words: qw });
      fixes.push('Restored the Quick answer block (' + qw + ' words) the editor removed: it is a protected block, and no editing round may take it out');
    }
  }
  if (prevMd) {
    const evid = new Set(((brief.evidence_plan || []).map(e => SRC.key(e && e.source_url))).concat((prev.facts || []).map(f => SRC.key(f && f.url))).filter(Boolean));
    const deadPrev = new Set((((PRV.content_qa || {}).link_check || {}).dead || []).map(x => SRC.key(x && x.url)).filter(Boolean));
    const OFFICIAL = /(^|\.)(gov|edu|int|mil)(\.|$)|\.gov\.[a-z]{2}$|(^|\.)(u\.ae|europa\.eu|who\.int|oecd\.org|worldbank\.org|imf\.org)$/i;
    const relinked = [];
    for (const m of prevMd.matchAll(/\[([^\[\]]{3,120})\]\((https?:\/\/[^)\s]+)\)/g)) {
      const anchor = m[1], url = m[2]; const k = SRC.key(url); const host = SRC.host(url);
      if (!k || deadPrev.has(k) || (domain && (host === domain || host.endsWith('.' + domain)))) continue;
      if (!(evid.has(k) || OFFICIAL.test(host))) continue;
      if (md.includes('](' + url + ')')) continue;
      // the first place the anchor words stand in the body, outside a heading and outside any other link
      const re = new RegExp('(^|[^\\[\\w])(' + escRe(anchor) + ')(?![\\w\\]])', 'g'); let hit = null, mm;
      while ((mm = re.exec(md))) { const at = mm.index + mm[1].length; const lineStart = md.lastIndexOf('\n', at) + 1;
        if (/^(#|Title:|Meta Description:|Slug:)/.test(md.slice(lineStart, lineStart + 18))) continue;
        const before = md.slice(Math.max(0, at - 200), at); if (/\[[^\]]*$/.test(before)) continue; hit = at; break; }
      if (hit == null) continue;
      md = md.slice(0, hit) + '[' + anchor + '](' + url + ')' + md.slice(hit + anchor.length); relinked.push(url);
    }
    if (relinked.length) { protected_restored.push({ block: 'source_links', urls: relinked });
      fixes.push('Re-linked ' + relinked.length + ' source citation(s) the editor unlinked while keeping their words: ' + relinked.slice(0, 4).join(', ')); }
  }
}

// 5. Internal links: only real pages on the user's site; external links kept (they are citations)
// 2026-10-11 (FIX_PLAN D9): a page the ladder has only planned is not a link target — the live hub linked twice each to three pages that
// did not exist (exec 365). (FIX_PLAN G4): every link loses its tracking parameters (utm_*, srsltid, gclid, fbclid), and a weak source
// (vendor or agency blog, listicle, unknown site) may be cited once — the live page cited trangotech.com three times.
const allowed = new Set();
const normUrl = (u) => String(u || '').trim().replace(/\/$/, '').toLowerCase().replace(/^(https?:\/\/)www\./, '$1');   // host-agnostic: a crawl reports www. while the canonical may be bare (D15)
(prev.internal_link_candidates || []).filter(c => c && !c.planned).forEach(c => allowed.add(normUrl(c.url)));
(prev.site_urls || []).forEach(u => allowed.add(normUrl(u)));
const plannedTargets = new Set([...(prev.planned_link_targets || []), ...(prev.hub_pages || []).filter(p => p && p.planned)].map(l => normUrl(l && l.url)).filter(Boolean));
plannedTargets.forEach(u => allowed.delete(u));
if (prev.existing_page && prev.existing_page.url) allowed.add(normUrl(prev.existing_page.url));
if (domain) allowed.add(normUrl(siteUrlOf(domain, '/')));
const removedLinks = [], plannedLinks = [], weakRepeats = []; const externalUrls = []; const weakSeen = new Map();
let internalLinks = 0, externalLinks = 0, cleanedLinks = 0;
md = md.replace(/\[([^\[\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
  let u = SRC.clean(url.trim()); if (u !== url.trim()) cleanedLinks++;
  const isRelative = u.startsWith('/');
  if (isRelative) u = domain ? siteUrlOf(domain, u) : u;
  const host = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[\/?#]/)[0].toLowerCase();
  const internal = !!domain && (host === domain || host.endsWith('.' + domain));
  if (internal || isRelative) { if (allowed.size && allowed.has(normUrl(u))) { internalLinks++; return '[' + text + '](' + u + ')'; }
    (plannedTargets.has(normUrl(u)) ? plannedLinks : removedLinks).push(u); return text; }
  const tier = SRC.tier(u);
  if (tier === 'weak') { const n = (weakSeen.get(host) || 0) + 1; weakSeen.set(host, n); if (n > 1) { weakRepeats.push(host); return text; } }
  externalLinks++; externalUrls.push({ anchor: text, url: u, host, tier }); return '[' + text + '](' + u + ')';
});
if (removedLinks.length) fixes.push(`Removed ${removedLinks.length} link(s) to pages that do not exist on ${domain || 'the site'}: ` + removedLinks.slice(0, 4).join(', '));
if (plannedLinks.length) fixes.push(`Removed ${plannedLinks.length} link(s) to pages that are planned but not published yet: ` + [...new Set(plannedLinks)].slice(0, 4).join(', ') + ' — they are listed in the package as links to add once they are live');
if (cleanedLinks) fixes.push(`Stripped tracking parameters (utm_*, srsltid, gclid, fbclid) from ${cleanedLinks} link(s)`);
if (weakRepeats.length) fixes.push(`Unlinked ${weakRepeats.length} repeat citation(s) of a source with no independent authority (one per domain): ` + [...new Set(weakRepeats)].join(', '));
// citations must point at sources the brief allowed (evidence plan) or at least be real-looking hosts
const allowedSources = new Set(((brief.evidence_plan || []).map(e => String(e.source_url || '').toLowerCase())).concat((prev.facts || []).map(f => String(f.url || '').toLowerCase())));
const TRUSTED = /(^|\.)(gov|edu|int|mil)(\.|$)|\.gov\.[a-z]{2}$|(^|\.)(microsoft|odoo|sap|oracle|netsuite|google|zoho|sage|xero|quickbooks|intuit|salesforce|hubspot|shopify|stripe|who|oecd|worldbank|imf|un|europa)\.(com|org|eu|int)$/i;
const unknownSources = externalUrls.filter(e => !TRUSTED.test(e.host) && allowedSources.size && ![...allowedSources].some(s => s && (e.url.toLowerCase().startsWith(s) || s.startsWith(e.url.toLowerCase()))));
// A-14 (2026-10-17): named by URL, not by host, and said for what it is — whether each one ANSWERS is measured by *Outbound Link Check*
// right after this node (in a content run), which names every dead one; this warning is about what the run never read
if (unknownSources.length > 2) warnings.push('External links to sources not in the evidence plan: ' + unknownSources.slice(0, 3).map(e => e.url).join(', ') + (unknownSources.length > 3 ? ' and ' + (unknownSources.length - 3) + ' more' : '')
  + ' — this run never read those pages, so what each sentence cites them for is unchecked: cite the evidence plan\'s source instead, or keep only a page that states the claim');
const trusted_sources = externalUrls.filter(e => TRUSTED.test(e.host)).map(e => e.host);

// 6. FAQs
const faqs = []; let cur = null, inAnswer = false;
for (const raw of md.split('\n')) {
  const l = raw.trim(); let m;
  if ((m = l.match(/^\**Q\d+[:.]\**\s*(.+)$/))) { cur = { q: m[1].replace(/\*+$/, '').trim(), a: '' }; faqs.push(cur); inAnswer = false; continue; }
  if ((m = l.match(/^\**A\d+[:.]\**\s*(.*)$/)) && cur) { cur.a = m[1]; inAnswer = true; continue; }
  if (inAnswer && l && !l.startsWith('#')) { cur.a += ' ' + l; continue; }
  if (!l || l.startsWith('#')) inAnswer = false;
}
const validFaqs = faqs.filter(f => f.q && f.a && countWords(f.a) >= 15);

// 7. Sections
const withoutMeta = md.replace(/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):.*$/gm, '');
const faqStart = withoutMeta.search(/^## (Frequently Asked Questions|FAQs?)/im);
const afterFaq = faqStart >= 0 ? withoutMeta.slice(faqStart + 5).search(/^## /m) : -1;
const faqPart = faqStart >= 0 ? withoutMeta.slice(faqStart, afterFaq >= 0 ? faqStart + 5 + afterFaq : undefined) : '';
const mainPart = withoutMeta.replace(faqPart, '');
const totalWords = countWords(withoutMeta), mainWords = countWords(mainPart), faqWords = countWords(faqPart);
const h1 = (md.match(/^# .+$/m) || [''])[0];
const h2s = md.match(/^## .+$/gm) || [];
const faqHeadings = h2s.filter(h => /faq|frequently asked/i.test(h)).length;
const lastH2 = h2s[h2s.length - 1] || '';
// 2026-10-11 (FIX_PLAN G2): Google stopped showing FAQ rich results on 2026-05-07, so no FAQ block is required or scored any more. What AI
// answers still quote is a question used as a heading with a short, direct answer under it — that is what is counted and scored instead.
const headingTexts = (md.match(/^#{2,4} .+$/gm) || []).map(h => plain(h.replace(/^#+\s*/, '')));
const questionHeadings = headingTexts.filter(h => /\?\s*$/.test(h) || /^(how|what|which|why|when|where|who|is|are|can|does|do|should|will)\b/i.test(h)).length;
const answeredQuestions = questionHeadings + validFaqs.length;
const qaMatch = withoutMeta.match(/^\**\s*Quick answer:?\**\s*(.+)$/im);
const answerWords = qaMatch ? countWords(plain(qaMatch[1])) : 0;
// per-section word counts vs the outline
const sections = []; { const parts = mainPart.split(/^## /m).slice(1); for (const p of parts) { const nl = p.indexOf('\n'); sections.push({ h2: plain(p.slice(0, nl)), words: countWords(p.slice(nl + 1)) }); } }
const outline = brief.outline || [];
const thinSections = sections.filter(s => { const o = outline.find(x => x.h2 && plain(x.h2).toLowerCase() === s.h2.toLowerCase()); const target = o ? Number(o.target_words) || 0 : 0; return target >= 150 && s.words < target * 0.6; }).map(s => s.h2 + ' (' + s.words + ' words)');

// 8. Keyword checks — natural variants count ("erp systems in the uae", "ERP system in UAE", hyphens)
// 2026-10-13 (FIX_PLAN G33): the same matcher now lives in the coverage kit (CVG.termRe), so a term counted on this draft is counted
// the same way on the competitor pages the target comes from — identical expression, one place to change it.
const flexRe = CVG.termRe;
const kwRe = kw ? flexRe(kw, 'gi') : null;
const kwCount = kwRe ? (withoutMeta.match(kwRe) || []).length : 0;
const density = totalWords ? +(kwCount / totalWords * 100).toFixed(2) : 0;
const first100 = plain(mainPart.replace(/^#.*$/gm, '')).split(/\s+/).slice(0, 100).join(' ').toLowerCase();

// 9. Unverified statistics: numbers outside brackets, tables and cited sentences
const bodyPlain = plain(withoutMeta.replace(/\|[^\n]*\|/g, ''));
const citedSentences = new Set();
withoutMeta.split(/(?<=[.!?])\s+/).forEach(s => { if (/\]\(https?:\/\//.test(s)) citedSentences.add(plain(s)); });
const noBrackets = withoutMeta.replace(/\[[^\]]*\]\([^)]*\)/g, ' CITED ').replace(/\[[^\]]*\]/g, '').replace(/\|[^\n]*\|/g, '');
const statHits = new Set();
for (const s of noBrackets.split(/(?<=[.!?])\s+/)) {
  if (/CITED/.test(s)) continue;
  for (const m of s.matchAll(/\b\d[\d,.]*\s?%/g)) statHits.add(m[0].trim());
  for (const m of s.matchAll(/\b(over|more than|up to|nearly|around|approximately|about)\s+\d[\d,.]*\+?(\s?%|\s+\w+)?/gi)) statHits.add(m[0].trim());
  for (const m of s.matchAll(/\b\d[\d,.]*\+\s+(years?|clients?|customers?|projects?|users?|students?|universities|schools|companies|installations?|reviews?|countries|awards?)\b/gi)) statHits.add(m[0].trim());
}
const clientNums = (String(prev.business_facts || '') + ' ' + String(prev.case_facts_text || '')).toLowerCase();   // numbers the client gave (facts, case studies) need no external source
// A-19: a figure the business itself states — on its own pages, in its profile or its facts (OWN_TEXT, §2b) — needs no external source
const ownStat = (s) => { const x = s.toLowerCase().replace(/^(over|more than|up to|nearly|around|approximately|about)\s+/, '').replace(/\s+/g, ' ').trim();
  if (clientNums.includes(x)) return true;
  const re = new RegExp('(^|[^0-9.,])' + escRe(x).replace(/\\\+\s*/, '\\+\\s*').replace(/ /g, '\\s*') + '(?![0-9])', 'i');   // "20+ Years" = "20+ years" = "20 + years"; "5 years" is not in "25 years"
  return re.test(ownLower); };
const stats_own = [...statHits].filter(s => !/^(19|20)\d\d/.test(s) && ownStat(s));
const stats = [...statHits].filter(s => !/^(19|20)\d\d/.test(s)).filter(s => !ownStat(s)).slice(0, 8);

// 9b. Claim check (FIX_PLAN G4, 2026-10-11): a figure in a sentence that cites a source must be IN that source. The only source text we have
//     is the text the writer was shown — the fact snippets from the live search, the brief's evidence plan and the competitor pages we read —
//     so a figure that is not there was not read anywhere: it is marked [Confirm: …] in the copy and listed in the report. Formatting does not
//     matter (separators, "m" / "million", "AED 50m" vs "AED 50 million"); small bare numbers ("3 steps") are never treated as claims; a figure
//     the client's own facts carry needs no external source; a sentence whose sources we never read is left alone (nothing to check against).
// (`srcText` / `ownFacts` are built in §2b, above the money mask, so both checks read the same source corpus — B3-1.)
const unverified_figures = [];
// B3-8: the check is one function, so the live page a refresh starts from is checked by exactly the rule the draft is
const citedFigureCheck = (text, limit) => {
  const pad = (x) => ' '.repeat(x.length);
  // a full stop between two digits is a decimal point, not the end of a sentence ("23.5%" must stay whole)
  const isBreak = (t, i) => { const c = t[i]; if (c === '\n' || c === '|' || c === '!' || c === '?') return true; if (c !== '.') return false; return !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')); };
  const bounds = (t, at, len) => { let a = at, b = at + len; while (a > 0 && !isBreak(t, a - 1)) a--; while (b < t.length && !isBreak(t, b)) b++; return [a, b]; };
  const seen = new Set(); const found = []; let checked = 0;
  for (const m of [...String(text).matchAll(/\[[^\[\]]+\]\((https?:\/\/[^)\s]+)\)/g)]) {
    const [a, b] = bounds(text, m.index, m[0].length); const id = a + ':' + b; if (seen.has(id)) continue; seen.add(id);
    const sent = text.slice(a, b);
    const urls = [...sent.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(x => x[1]);
    const texts = urls.map(u => srcText.get(SRC.key(u)) || '').filter(Boolean);
    if (!texts.length) continue;   // the source was never fetched: nothing to look the figure up in
    const body = sent.replace(/\[[^\[\]]*\]\([^)]*\)/g, pad).replace(/\[[^\[\]]*\]/g, pad);   // anchors, URLs and existing [Confirm: …] / [Price] markers are not claims
    // R37 (2026-10-16): "does not carry" is said only of a source text the run read whole; a figure missing from a search snippet that
    // was cut short ("…", "Read more") is "not in the excerpt the run read" — still held for review, but never blamed on the source.
    // (B3-8: a source a refresh re-read whole carries no cut marker unless FRESH_CAP cut it — see §2b.)
    for (const f of SRC.figures(body)) {
      checked++;
      if (texts.some(t => SRC.hasFigure(f, t))) continue;
      if (SRC.hasFigure(f, ownFacts) || clientNums.includes(String(f.raw).toLowerCase()) || SRC.hasFigure(f, OWN_TEXT)) continue;   // A-19: the business's own pages vouch for its own figures
      found.push({ figure: f.raw, sources: [...new Set(urls.map(u => SRC.host(u)))], reason: texts.some(t => SRC.cutShort(t)) ? 'not_in_excerpt' : 'absent',
        start: a + f.index, end: a + f.index + f.length, raw: f.raw, context: plain(sent).slice(0, 160),
        refreshed: urls.some(u => freshRead.has(SRC.key(u))) });
      if (found.length >= limit) break;
    }
    if (found.length >= limit) break;
  }
  return { found, checked };
};
{
  const r9b = citedFigureCheck(md, 12);
  const marks = r9b.found.map(x => ({ start: x.start, end: x.end, raw: x.raw }));
  r9b.found.forEach(x => unverified_figures.push({ figure: x.figure, sources: x.sources, reason: x.reason, ...(x.refreshed ? { refreshed_source: true } : {}) }));
  marks.sort((x, y) => y.start - x.start);
  for (const t of marks) md = md.slice(0, t.start) + '[Confirm: ' + t.raw + ']' + md.slice(t.end);
  if (marks.length) fixes.push(`Marked ${marks.length} figure(s) that the cited source does not carry, or that the excerpt of it the run read does not show, as [Confirm: …] for review`);
}
// 9c. B3-8: on a refresh, the LIVE page is checked against its own cited sources as they read today — by the same rule (§9b), report
//     only: the live copy is not ours to mark, the draft above is. What the owner is told: which figures the page has been showing that
//     its own sources no longer state, and whether the refreshed draft still repeats them (then they are marked [Confirm: …] above).
let refresh_check = null;
if (RS && RS.refresh) {
  const srcs = Array.isArray(RS.sources) ? RS.sources : [];
  const okS = srcs.filter(s => s && s.ok), failS = srcs.filter(s => s && !s.ok);
  const live = RS.live_read && String(RS.live_markdown || '').trim() ? citedFigureCheck(String(RS.live_markdown), 20) : null;
  const liveBad = live ? live.found.filter(x => x.refreshed) : [];
  const draftFigs = new Set(unverified_figures.map(f => String(f.figure)));
  refresh_check = {
    refresh: true, page_url: String(RS.page_url || ''), live_read: !!RS.live_read,
    sources_cited: Number(RS.cited) || srcs.length, sources_read: okS.length,
    sources_failed: failS.map(s => ({ url: String(s.url || ''), reason: String(s.error || 'could not be read') })).slice(0, 8),
    live_figures_checked: live ? live.checked : 0,
    live_figures_unverified: liveBad.map(x => ({ figure: x.figure, sources: x.sources, reason: x.reason, context: x.context, still_in_draft: draftFigs.has(String(x.figure)) })).slice(0, 12),
    draft_figures_on_refreshed_sources: unverified_figures.filter(f => f.refreshed_source).length,
    basis: !RS.live_read ? 'the live page could not be read in this run, so its cited sources are unknown and nothing was re-checked'
      : !srcs.length ? 'the live page cites no external source next to a figure, so there was nothing to re-check'
        : 'the live page\'s ' + srcs.length + ' cited source(s) next to a figure were re-read today (' + okS.length + ' read' + (failS.length ? ', ' + failS.length + ' could not be read and were not checked' : '') + '); every figure of a sentence citing one was looked up in that source\'s text as it reads now, by the same rule as the draft'
  };
}
// 9d. A-15 (2026-10-17, re-rating 2026-10-17): what the page says about the business's OWN terms, scope and credentials must be on file.
//     Live (exec 771, no business facts, no profile) the page promised "We charge for advice and delivery. Licences sit on a separate line
//     of the quote …", "Some can, but Tech& does not" and "Tech& does not handle company formation" — on none of the site's pages — and
//     the quality check named none of them. CL.business holds every such sentence against OWN_TEXT (§2b); one nothing on file supports is
//     marked [Confirm: …] in the copy and listed, and the editor must take it out or the owner must confirm it.
const bizNames = [...new Set([(prev.site_profile || {}).business_name, SITE_MODEL ? SM.name(SITE_MODEL) : '', ...((SITE_MODEL && Array.isArray(SITE_MODEL.brand_names)) ? SITE_MODEL.brand_names : []),
  (prev.site_description || {}).business_name, domain ? String(domain).split('.')[0] : ''].map(x => String(x || '').trim()).filter(x => x.length >= 3))];
const business_claims = [];
{
  const BC = CL.business(md, OWN_TEXT, { names: bizNames });
  for (const f of BC.flags.slice(0, 8)) {
    const at = md.indexOf(f.sentence); const marked = at >= 0 && business_claims.filter(x => x.marked).length < 6;
    if (marked) md = md.slice(0, at) + '[Confirm: ' + f.sentence + ']' + md.slice(at + f.sentence.length);
    business_claims.push({ kind: f.kind, trigger: f.trigger, sentence: f.sentence, marked });
  }
  if (business_claims.some(x => x.marked)) fixes.push('Marked ' + business_claims.filter(x => x.marked).length + ' statement(s) about the business that nothing on file supports as [Confirm: …] for the owner');
}

// 10. Banned phrases (AI clichés and filler)
const BANNED = ["in today's fast-paced world", 'in the ever-evolving', 'ever-evolving landscape', 'delve', 'dive into', 'unlock', 'unleash', 'seamless', 'seamlessly', 'robust', 'leverage', 'cutting-edge', 'game-changer', 'game-changing', 'revolutioni', 'elevate your', 'empower', 'navigate the complexities', 'look no further', "it's important to note", 'it is important to note', 'at the end of the day', 'in conclusion', 'comprehensive solution', 'tailored solutions', 'harness the power', "whether you're a", 'a testament to', 'crucial', 'paramount', 'realm', 'tapestry', 'embark', 'foster', 'streamline', 'synergy', 'holistic', 'best-in-class', 'world-class', 'state-of-the-art', 'top-notch', 'one-stop shop', 'in this article', 'in this guide, we', 'without further ado', 'unparalleled', 'transformative', 'in the digital age', 'stay ahead of the curve', 'the bottom line is', 'when it comes to', 'a wide range of'];
const lower = bodyPlain.toLowerCase();
const banned_found = BANNED.map(p => ({ phrase: p, count: (lower.match(new RegExp(escRe(p), 'g')) || []).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
const bannedCount = banned_found.reduce((s, x) => s + x.count, 0);

// 11. Readability (Flesch reading ease, approximate syllables), sentence length, passive voice
// B3-4 (2026-10-16): one formula, in the coverage kit, for the draft and for the competitor pages the band is read from (CVG.readability)
const RD = CVG.readability(bodyPlain);
const sentences = RD.sentences;
const avgSentence = RD.avg_sentence_words;
const longSentences = RD.long_sentences;
const wordsArr = bodyPlain.split(/\s+/).filter(Boolean);
const flesch = RD.flesch;
const passive = sentences.filter(s => /\b(is|are|was|were|been|being|be)\s+(\w+ed|built|made|done|seen|known|given|taken|chosen|written)\b/i.test(s)).length;
const passive_pct = sentences.length ? Math.round(passive / sentences.length * 100) : 0;
// 11b. B3-4: the band the draft is scored against comes from the pages that rank for this search (the same pool the coverage target
//      reads), measured exactly as the draft is. It is ADVICE, never a refusal: it moves the 15 readability points and is reported with
//      its basis, but it adds nothing to `warnings`. With too few competitor pages to measure, today's fixed band applies — and says so.
let readPool = [];
try { readPool = ($('Analyze Competitor Pages').first().json || {}).competitors || []; } catch (e) { readPool = []; }
if (!readPool.length) readPool = prev.competitors || [];
const RBAND = CVG.readBand(readPool);
const read_position = flesch == null || !RBAND.ok ? null : (flesch < RBAND.low ? 'harder' : (flesch > RBAND.high ? 'easier' : 'in_band'));
const read_band_line = !RBAND.ok ? ''
  : 'the ' + RBAND.pages_measured + ' competitor pages read score Flesch ' + RBAND.p25 + '-' + RBAND.p75 + ' (median ' + RBAND.median + '); the band is ' + RBAND.low + '-' + RBAND.high
    + (RBAND.clamped ? ' (its lower edge kept inside ' + CVG.BAND_FLOOR + '-' + CVG.BAND_CEIL + ')' : '');
const read_basis = RBAND.ok
  ? 'scored against the pages that rank for this search, measured the same way as the draft: ' + read_band_line + ', from ' + CVG.BAND_HARDER + ' points harder to ' + CVG.BAND_EASIER + ' points easier than their median'
  : 'no band from the pages that rank (' + RBAND.reason + '), so the fixed band is used: Flesch 40+ with sentences of 22 words or fewer scores full marks';
const read_note = flesch == null || !RBAND.ok ? ''
  : read_position === 'harder' ? 'Readability: Flesch ' + flesch + ' is harder to read than the pages that rank (' + read_band_line + ') — shorter sentences and plainer words would bring it into the band. Advice, not a blocker.'
    : read_position === 'easier' ? 'Readability: Flesch ' + flesch + ' is plainer than the pages that rank (' + read_band_line + ') — easy reading is good for readers; check the page still carries the technical precision its search expects. Advice, not a blocker.'
      : '';

// 12. Term coverage (brief terms first, else the competitor term model)
const termList = (brief.terms_to_use || []).map(t => ({ term: String(t.term || t).toLowerCase(), min: Number(t.min_count) || 1 }))
  .concat((prev.term_model || []).slice(0, 25).map(t => ({ term: t.term, min: 1 })))
  .filter((t, i, a) => t.term && a.findIndex(x => x.term === t.term) === i).slice(0, 30);
// R43 (2026-10-16, re-rating 2026-10-15): the draft is measured exactly as the page it is compared with — a term counts once it APPEARS
// (CVG.coverageOf, the measure the benchmark below and Parse Analysis use). Live (exec 616) the draft was scored on "count reaches the
// brief's min_count" and the competitor on presence, and the two were printed side by side as one quantity: "covers 60% … against a
// target of 90%" for a draft that uses all 20 terms (the competitor uses 18). The editor's length cut had pushed counts under the brief's
// thresholds (strategy 11 -> 7 against 8), which alone flipped a passing round into a refusal. The brief's counts are still reported —
// "strategy used 7 times (the brief asked for 8)" — as information, never as a term to "work in".
const termCoverage = termList.map(t => ({ term: t.term, target: t.min, found: (bodyPlain.match(flexRe(t.term, 'gi')) || []).length }))
  .map(t => ({ ...t, ok: t.found > 0, present: t.found > 0, below_brief: t.found > 0 && t.found < t.target }));
const coverage = termCoverage.length ? termCoverage.filter(t => t.present).length / termCoverage.length : 1;
const missingTerms = termCoverage.filter(t => !t.present).slice(0, 10).map(t => t.term);
const belowBrief = termCoverage.filter(t => t.below_brief).map(t => ({ term: t.term, found: t.found, target: t.target }));
const counts_note = belowBrief.length ? 'Used fewer times than the brief suggested (the page still uses each one; coverage counts a term once it appears): '
  + belowBrief.slice(0, 8).map(t => t.term + ' used ' + t.found + ' time' + (t.found === 1 ? '' : 's') + ' (the brief asked for ' + t.target + ')').join(', ') : '';

// 12b. Coverage against the BEST competitor (FIX_PLAN G33, 2026-10-13)
// The score used to give 25 points for the share of the term list the page uses, with 100% as the silent bar and no statement of what the
// pages that already rank cover. *Parse Analysis* picked the page to beat (the highest term coverage of the pages read); here that same
// page is measured on exactly this list, so draft and benchmark are comparable, and the target is its coverage kept inside 60-90%
// (CVG.target: a weak results page must not lower the bar, a term-stuffed one must not force stuffing). Everything is reported with its
// basis — it is a target read off competitor pages, not a promise about rankings.
const covPlan = prev.coverage_target && typeof prev.coverage_target === 'object' ? prev.coverage_target : null;
let benchText = '';
if (covPlan && covPlan.best) {
  let pool = [];
  try { pool = ($('Analyze Competitor Pages').first().json || {}).competitors || []; } catch (e) { pool = prev.competitors || []; }
  if (!pool.length) pool = prev.competitors || [];
  const hit = pool.find(c => c && (c.url === covPlan.best.url || (covPlan.best.domain && c.domain === covPlan.best.domain)));
  benchText = String((hit && (hit.content_full || hit.content)) || '');
}
const benchCov = benchText ? CVG.coverageOf(benchText, termList) : null;
const bestPct = benchCov && benchCov.pct != null ? benchCov.pct : (covPlan && covPlan.best ? covPlan.best.coverage_pct : null);
const coverage_target_pct = CVG.target(bestPct);
const coverage_pct = Math.round(coverage * 100);
const coverage_ratio = coverage_target_pct ? Math.min(1, coverage / (coverage_target_pct / 100)) : coverage;
// A-16 (2026-10-17): a subtopic that names a company — the page to beat's own brand, another result's, a legal-entity name, a "why X
// is the best" line — is that company talking about itself and is never required of our draft. Parse Analysis already leaves them out
// (CVG.subtopics with the fit gate's labels); a plan stored before that, or built by another caller, is filtered here by the same rule.
let subPool = []; try { subPool = ($('Analyze Competitor Pages').first().json || {}).competitors || []; } catch (e) { subPool = []; }
if (!subPool.length) subPool = prev.competitors || [];
const subBest = covPlan && covPlan.best ? (subPool.find(c => c && (c.url === covPlan.best.url || (covPlan.best.domain && c.domain === covPlan.best.domain))) || { domain: covPlan.best.domain, url: covPlan.best.url }) : null;
const subOpts = { labels: fitLabels, brands: subPool.map(c => c && (c.domain || c.url)).filter(Boolean).concat((SITE_MODEL && Array.isArray(SITE_MODEL.competitors)) ? SITE_MODEL.competitors : []) };
const subtopics_dropped = [];
const subtopicsKept = (covPlan && Array.isArray(covPlan.subtopics) ? covPlan.subtopics : []).filter(s => { const why = CVG.namesBrand(s, subBest, subOpts); if (why) subtopics_dropped.push({ subtopic: s, reason: why }); return !why; });
const missingSubtopics = subtopicsKept.length
  ? CVG.subtopicGap(subtopicsKept, { headings: h2s.concat(md.match(/^###\s+.+$/gm) || []), text: bodyPlain }).filter(x => x.state === 'missing').map(x => x.subtopic)
  : [];
const termsFound = termCoverage.filter(t => t.present).length;
const benchUsed = benchCov ? benchCov.found : (covPlan && covPlan.best && covPlan.best.terms_used != null ? covPlan.best.terms_used : null);
const benchOf = benchCov ? benchCov.total : (covPlan ? covPlan.terms_total ?? null : null);
const coverage_report = {
  pct: coverage_pct, terms_found: termsFound, terms_total: termCoverage.length, measure: 'presence',
  best_competitor_terms_used: benchUsed, best_competitor_terms_total: benchOf, below_brief: belowBrief, counts_note,
  target_pct: coverage_target_pct, best_competitor_pct: bestPct == null ? null : bestPct,
  best_competitor: covPlan && covPlan.best ? { domain: covPlan.best.domain || '', url: covPlan.best.url || '', rank: covPlan.best.rank ?? null, word_count: covPlan.best.word_count ?? null, sections: covPlan.best.sections ?? null } : null,
  average_competitor_pct: covPlan ? (covPlan.average_pct ?? null) : null,
  measured_on: benchCov ? 'this page\'s own term list, on both the draft and that competitor page' : (covPlan ? 'the draft on its term list; the competitor figure comes from the brief\'s shared-term list' : 'the draft only'),
  missing_terms: missingTerms, subtopics_total: subtopicsKept.length, subtopics_dropped,   // A-16: the headings left out because they name a company
  subtopics_missing: missingSubtopics, pages_compared: covPlan ? (covPlan.pages_compared ?? null) : null,
  basis: coverage_target_pct
    ? 'uses ' + termsFound + ' of the ' + termCoverage.length + ' terms the top pages share (' + coverage_pct + '%; a term counts once it appears), against a target of ' + coverage_target_pct + '% taken from '
      + ((covPlan.best.domain || 'the best page') + (covPlan.best.rank ? ' (position ' + covPlan.best.rank + ')' : '')) + ', which covers ' + bestPct + '%'
      + (benchCov ? ' — on the same list and the same measure it uses ' + benchCov.found + ' of the ' + benchCov.total : ' on the shared-term list of the brief')
      + (covPlan.average_pct != null ? ' (average of the ' + (covPlan.pages_compared || 0) + ' pages read: ' + covPlan.average_pct + '%)' : '')
    : 'uses ' + termsFound + ' of the ' + termCoverage.length + ' terms the top pages share (' + coverage_pct + '%; a term counts once it appears); no competitor page could be read, so there is no target to compare with'
};
// the comparison in one sentence, on one measure, for the reason the owner reads
const coverage_compare = coverage_target_pct
  ? 'it uses ' + termsFound + ' of the ' + termCoverage.length + ' terms the top pages share (' + coverage_pct + '%), against a target of ' + coverage_target_pct + '% — '
    + ((covPlan.best.domain || 'the best page') + (benchCov ? ' uses ' + benchCov.found + ' of the ' + benchCov.total + ' (' + bestPct + '%) on the same list' : ' covers ' + bestPct + '%'))
    + '; a term counts once it appears'
  : '';

// 13. Specificity: numbers, examples, steps, decision rules per 100 words
const specHits = (bodyPlain.match(/\b\d[\d,.%]*\b/g) || []).length + (lower.match(/\b(for example|for instance|such as|e\.g\.|step \d|case study|in practice|choose .* if|rule of thumb)\b/g) || []).length;
const specificity = wordsArr.length ? +(specHits / wordsArr.length * 100).toFixed(2) : 0;
// snippet targets answered?
const snippetTargets = brief.snippet_targets || [];
const unansweredSnippets = snippetTargets.filter(t => t.question && !new RegExp('^#{2,3}\\s*' + escRe(plain(t.question).replace(/\?$/, '')), 'im').test(md)).map(t => t.question).slice(0, 4);

// 14. Warnings
const target = brief.target_word_count || 800;
if (mainWords < target * 0.8) warnings.push(`Main content is short: ${mainWords} words vs target ${target}`);
if (mainWords > target * 1.25) warnings.push(`Main content is too long: ${mainWords} words vs target ${target} — cut repetition and secondary detail, do not add anything`);
if (thinSections.length) warnings.push('Sections far below their target length: ' + thinSections.slice(0, 4).join('; '));
if (!metaTitle) warnings.push('Meta title line missing');
else { if (metaTitle.length > 60) warnings.push(`Meta title is ${metaTitle.length} characters (max 60)`); if (metaTitle.length < 30) warnings.push(`Meta title is only ${metaTitle.length} characters (aim for 50-60)`); if (kw && !flexRe(kw, 'i').test(metaTitle)) warnings.push('Primary keyword missing from the meta title'); }
if (!metaDesc) warnings.push('Meta description line missing');
else { if (metaDesc.length > 155) warnings.push(`Meta description is ${metaDesc.length} characters (max 155)`); if (metaDesc.length < 70) warnings.push(`Meta description is only ${metaDesc.length} characters (aim for 120-155)`); }
if (slug && !/^\/?[a-z0-9]+(-[a-z0-9]+)*\/?$/.test(slug)) warnings.push('Slug should be lowercase words joined by hyphens');
if (!h1) warnings.push('H1 missing'); else if (kw && !flexRe(kw, 'i').test(h1)) warnings.push('Primary keyword missing from H1');
if (kw && !flexRe(kw, 'i').test(first100)) warnings.push('Primary keyword not in the first 100 words');
if (kwCount < 3) warnings.push(`Primary keyword used only ${kwCount} time(s)`);
if (density > 2) warnings.push(`Keyword density is high (${density}%) — risk of keyword stuffing`);
if (h2s.length < 4) warnings.push(`Only ${h2s.length} H2 sections (brief expects ${outline.length || 'more'})`);
if (!qaMatch) warnings.push('Quick answer block missing (a 40-70 word direct answer right after the introduction)');
else if (answerWords < 35 || answerWords > 90) warnings.push(`Quick answer is ${answerWords} words (aim for 40-70)`);
if (answeredQuestions < 3) warnings.push(`Only ${answeredQuestions} question(s) answered as a heading (aim for 3+ question-style headings with a direct 40-60 word answer under each — that is what AI answers quote)`);
if (faqHeadings > 1) warnings.push('Duplicate FAQ sections found');
if (/faq|frequently asked/i.test(lastH2)) warnings.push('The call to action should be the last section');
if (!/\|.*\|/.test(md)) warnings.push('Comparison table missing');
// v4.12: an AI answer target — the answer sits where an assistant reads first, and every search the assistants run before answering has a section
const AT = prev.ai_target && prev.ai_target.question ? prev.ai_target : null;
let ai_ready = null;
// B3-6 (2026-10-16, benchmark area 3): does the page answer its own question early, and are its headings the questions readers ask?
// Both used to be measured only inside the AI-target branch below, so a page with no `ai_target` — most pages — was never checked for
// it (Surfer made answering up front half of its AI Search Score on 2026-10-01). They are measured on every draft now. The limit is
// the Quick answer within ANSWER_FIRST_MAX words after the H1: 60 for an AI answer target (assistants read the first ~200 characters),
// 120 for every other page (the copywriter writes a short introduction first, and the reader still meets the answer on the first screen).
const h1At = withoutMeta.search(/^# .+$/m); const qaAt = qaMatch ? withoutMeta.indexOf(qaMatch[0]) : -1;
const before = h1At >= 0 && qaAt > h1At ? countWords(plain(withoutMeta.slice(h1At, qaAt).replace(/^# .+$/m, ''))) : null;
const heads = (md.match(/^#{2,3} .+$/gm) || []).map(h => plain(h.replace(/^#+\s*/, '')).toLowerCase());
const qHeads = heads.filter(h => /\?\s*$/.test(h) || /^(how|what|which|why|when|where|who|is|are|can|does|do|should)\b/.test(h)).length;
const ANSWER_FIRST_MAX = AT ? 60 : 120;
const intent = { words_before_answer: before, answer_limit_words: ANSWER_FIRST_MAX, answer_first: before == null ? null : before <= ANSWER_FIRST_MAX,
  question_headings: qHeads, quick_answer_words: answerWords, ai_target: !!AT,
  basis: qaMatch ? 'the words between the H1 and the Quick answer, and the H2 / H3 headings phrased as questions, counted in the draft itself'
    : 'no Quick answer line in the draft, so where the answer sits could not be measured (the missing block is its own warning)' };
if (!AT && before != null && before > ANSWER_FIRST_MAX) warnings.push('Answer first: the Quick answer comes after ' + before + ' words of introduction — move it up so the page answers its own question within the first ' + ANSWER_FIRST_MAX + ' words under the H1');
if (!AT && qHeads < 2 && answeredQuestions >= 3) warnings.push('Phrase at least 2 H2 / H3 headings as the questions readers ask (' + qHeads + ' now; the FAQ answers count elsewhere, but a question heading with its answer right under it is what search and AI answers quote)');
if (AT) {
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', '2024', '2025', '2026', '2027', 'list', 'official']);
  const tk = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOPW.has(w));
  const fan = (AT.fanout || []).filter(Boolean);
  const covered = fan.filter(f => { const T = tk(f); if (!T.length) return true; return heads.some(h => T.filter(w => h.includes(w)).length / T.length >= 0.5); });
  ai_ready = { quick_answer_words: answerWords, words_before_answer: before, question_headings: qHeads, fanout_total: fan.length, fanout_covered: covered.length, missing: fan.filter(f => !covered.includes(f)) };
  if (before != null && before > 60) warnings.push('AI target: move the Quick answer right under the H1 (' + before + ' words come first; assistants read the first ~200 characters)');
  if (fan.length && covered.length < Math.ceil(fan.length / 2)) warnings.push('AI target: give these searches the assistants run their own question-style H2: ' + ai_ready.missing.slice(0, 4).map(f => '"' + f + '"').join(', '));
  if (qHeads < 2) warnings.push('AI target: phrase at least 2 H2s as the questions buyers ask');
}
// B-11 (F-B, 2026-10-17, exec 745): "should not be treated as an automatic guarantee" and "does not by itself guarantee compliance" DENY a
// guarantee; only a sentence that makes one is a claim to verify
const __guar = String(md || '').split(/(?<=[.!?])\s+|\n+/).filter(x => /guarantee/i.test(x) && !/\b(no|not|never|nor|neither|without|cannot|can't|won't|isn't|doesn't|don't)\b[^.!?]{0,60}guarantee/i.test(x));
if (__guar.length && !prev.business) warnings.push('Contains a guarantee claim — please verify: "' + __guar[0].trim().replace(/^\[Confirm:\s*/, '').replace(/\]$/, '').slice(0, 120) + '"');   // A-15: quoted without the [Confirm: …] §9d may have put round it
if (business_claims.length) warnings.push('Statements about ' + (bizNames[0] || 'the business') + '\'s own terms, scope or credentials that nothing on file supports (business facts, profile, its own pages; now marked [Confirm: …]): '
  + business_claims.slice(0, 4).map(b => '"' + b.sentence.slice(0, 160) + '"').join('; ') + ' — remove each one, or the owner confirms it in the business facts');
// A-18 (2026-10-17): a section about a topic the verdict said to leave out. Live (exec 771) the verdict said "Skip the consultancy-licence
// and start-an-IT-company questions, which don't match buyer intent" and the page carried "How Much Is a Consultancy Licence in Dubai?".
const verdict_exclusions = Array.isArray(prev.verdict_exclusions) ? prev.verdict_exclusions : EXC.fromVerdict(prev.verdict_changes, []);
const excluded_sections = EXC.check(md.match(/^#{2,3} .+$/gm) || [], verdict_exclusions, prev.keyword || '');
if (excluded_sections.length) warnings.push('Sections about a topic the verdict said to leave out: ' + excluded_sections.slice(0, 4).map(x => '"' + x.heading + '" (the verdict: skip ' + x.topic + ')').join('; ')
  + ' — remove each section; the page stays on what its buyers search for');
if (stats.length) warnings.push('Unverified statistics that need a linked source or a [Statistic] marker: ' + stats.join('; '));
const figAbsent = unverified_figures.filter(f => f.reason !== 'not_in_excerpt'), figExcerpt = unverified_figures.filter(f => f.reason === 'not_in_excerpt');
if (figAbsent.length) warnings.push('Figures the cited source does not carry (now marked [Confirm: …]): ' + figAbsent.slice(0, 5).map(f => '"' + f.figure + '" (' + f.sources.join(', ') + ')').join('; ') + ' — quote the source\'s own number or cite the page that states it');
if (figExcerpt.length) warnings.push('Figures not in the excerpt of the cited source the run read (the excerpt was cut short, so the page itself may state them; now marked [Confirm: …]): ' + figExcerpt.slice(0, 5).map(f => '"' + f.figure + '" (' + f.sources.join(', ') + ')').join('; ') + ' — check the figure on the source page, or cite the page that states it');
if (weakRepeats.length) warnings.push('A source with no independent authority was cited more than once (' + [...new Set(weakRepeats)].join(', ') + '): the repeats were unlinked — cite an official, standards, research or major-press source instead');
if ((prev.internal_link_candidates || []).length > 1 && internalLinks === 0) warnings.push('No internal links to existing pages on the site');
if (bannedCount) warnings.push('Filler / AI-cliché phrases to rewrite (' + bannedCount + '): ' + banned_found.slice(0, 8).map(b => '"' + b.phrase + '"' + (b.count > 1 ? ' x' + b.count : '')).join(', '));
if (flesch != null && flesch < 30 && !RBAND.ok) warnings.push(`Hard to read (Flesch ${flesch}, average sentence ${avgSentence} words) — shorten sentences and use plainer words`);
if (longSentences > Math.max(3, sentences.length * 0.12)) warnings.push(`${longSentences} sentences longer than 28 words — split them`);
if (passive_pct > 25) warnings.push(`Passive voice in about ${passive_pct}% of sentences — rewrite in active voice`);
if (termCoverage.length >= 8 && coverage_target_pct && coverage_pct < coverage_target_pct)
  warnings.push('Topic coverage ' + coverage_pct + '% against a target of ' + coverage_target_pct + '% (' + (coverage_report.best_competitor ? (coverage_report.best_competitor.domain || 'the best page') + ' covers ' + coverage_report.best_competitor_pct + '%' : 'the best page in the results') + ') — both counted the same way, a term counts once it appears; these terms do not appear at all, work them in where they belong: ' + missingTerms.join(', '));
else if (termCoverage.length >= 8 && !coverage_target_pct && coverage < 0.6) warnings.push('Topic coverage is thin — competitors cover these terms and this page does not: ' + missingTerms.join(', '));
if (missingSubtopics.length) warnings.push('Subtopics the best competitor page covers and this draft does not: ' + missingSubtopics.slice(0, 4).map(x => '"' + x + '"').join(', ') + ' — add each one where it belongs (our own heading and words, never theirs), or the page is thinner than the one it has to beat');
if (wordsArr.length > 400 && specificity < 0.6) warnings.push(`Too generic (${specificity} specifics per 100 words) — add concrete examples, numbers with sources, steps or decision rules`);
if (unansweredSnippets.length) warnings.push('Snippet questions from the brief that have no matching heading: ' + unansweredSnippets.join(' | '));
if (critique && Array.isArray(critique.problems)) critique.problems.filter(p => /high|medium/i.test(p.severity || '')).slice(0, 8).forEach(p => warnings.push('Editor review: ' + [p.location ? '"' + String(p.location).slice(0, 80) + '"' : '', p.issue, p.fix ? 'Fix: ' + p.fix : ''].filter(Boolean).join(' — ')));

// 14b. Placeholders (FIX_PLAN D10, 2026-10-12): the live page of execution 365 held 30 × [Price], 20 × [Timeline], [Office address] and
//      [Phone number] and still passed at 91 — nobody could publish it. A page may carry a few bracketed gaps for the owner to fill; more
//      than PH_MAX means the brief asked for figures the business never gave, and the editor has to rewrite those passages without them.
//      Counted exactly as the web app highlights them (an upper-case word in square brackets): link text is not a placeholder, and a note
//      with a colon ([Confirm: AED 50m], [Owner: confirm — …], [Author insight: …], [Image: …]) is a review note, not a gap in the copy.
// R45 (2026-10-16, re-rating 2026-10-15): live (exec 616) the delivered body carried "*Checklist reviewed by [name, role], [date].*" and
//      "[Confirm: edition year and sample size]" while QA reported `placeholder_count: 0` and named neither: the pattern counted only a
//      bracket that starts with an UPPER-case letter, and the writer's own [Confirm: …] notes were counted (on the copy before §9b) but never
//      named to anyone. Every bracket a person has to fill is counted now, whatever its case; the writer's review notes are listed by name;
//      QA's own [Confirm: <figure>] marks are named once, by the figure warning, and never again here.
// A-13 (2026-10-17, re-rating 2026-10-17): live (exec 771) the delivered body said "a fixed [Price band: typical Assess & Envision fee in
//      AED]" while this node reported `placeholder_count 0`, `placeholders_in_body []`, `open_brackets []`: the pattern refused a colon,
//      on the assumption that a colon bracket is one of our own review notes — but the writer invents its own labels. One detector now
//      (v5/code/_placeholders.js, PH.scan; the app's article view and its delivery rule read the same two patterns from
//      app/shared/src/placeholders.ts, asserted identical by the build): a review note is one of the closed list Confirm / Owner /
//      Author insight / Image, and every other bracket that starts with a letter is a placeholder, whatever it holds.
const PH_MAX = 5;
const finalBody = md.replace(/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):.*$/gm, '');   // the copy AFTER §9b's and §9d's marks
const phScan = PH.scan(finalBody);
const placeholders = phScan.placeholders;
const placeholder_count = phScan.placeholder_count;
const review_notes = phScan.notes.filter(n => !/^\[Image\b/i.test(n.token)).reduce((k, n) => k + n.count, 0) + (finalBody.match(/\[Statistic\b[^\]]*\]/gi) || []).length;   // as before: Confirm / Owner / Author insight notes and [Statistic] (a placeholder too); the image plan is not a note
const qaOwnMarks = new Set(unverified_figures.map(f => '[Confirm: ' + f.figure + ']').concat(flagged_amounts.map(a => '[Confirm: ' + a.amount + ']'))
  .concat(business_claims.filter(b => b.marked).map(b => '[Confirm: ' + b.sentence + ']')));
const writer_notes = phScan.notes.filter(n => /^\[(?:Confirm|Owner)\b/i.test(n.token) && !qaOwnMarks.has(n.token));
const open_brackets = placeholders.map(p => ({ ...p, kind: 'placeholder' })).concat(writer_notes.map(n => ({ ...n, kind: 'review_note' })));
if (placeholder_count > PH_MAX) warnings.push(`Too many placeholders to publish (${placeholder_count}, at most ${PH_MAX} allowed): ` + placeholders.slice(0, 6).map(p => p.token + (p.count > 1 ? ' x' + p.count : '')).join(', ')
  + ' — rewrite those passages so they do not need the missing figure (what drives the cost, what the stages are, what to ask the vendor), and keep a placeholder only where the owner must fill one value in');

// 15. Content score (0-100)
// FIX_PLAN G2: an FAQ block is no longer one of the checks (no FAQ rich results since 2026-05-07); question headings answered directly are.
const structuralChecks = [!!metaTitle && metaTitle.length <= 60, !!metaDesc && metaDesc.length <= 155, !!h1, h2s.length >= 4, !!qaMatch, answeredQuestions >= 3, /\|.*\|/.test(md), !/faq|frequently asked/i.test(lastH2), internalLinks > 0 || (prev.internal_link_candidates || []).filter(c => c && !c.planned).length <= 1, kwCount >= 3 && density <= 2];
const structure_pts = 25 * structuralChecks.filter(Boolean).length / structuralChecks.length;
// FIX_PLAN G33: the 25 coverage points are measured against the best competitor's coverage (clamped 60-90%), not against a silent 100%.
// With no competitor page read, coverage_ratio is the plain share, exactly as before.
const coverage_pts = 25 * coverage_ratio;
// B3-4: against the band the pages that rank set (in the band or plainer: 15; up to 10 points harder than its lower edge: 10; else 4);
// with no band, today's fixed one (B2B copy normally scores 30-55)
const readability_pts = flesch == null ? 10 : RBAND.ok ? (flesch >= RBAND.low ? 15 : (flesch >= RBAND.low - 10 ? 10 : 4))
  : (flesch >= 40 && avgSentence <= 22 ? 15 : (flesch >= 30 && avgSentence <= 26 ? 10 : 4));
const specificity_pts = 10 * Math.min(1, specificity / 0.8);
const banned_pts = Math.max(0, 10 - 2 * bannedCount);
const length_pts = 15 * (1 - Math.min(1, Math.abs(mainWords - target) / target));
const content_score = Math.round(structure_pts + coverage_pts + readability_pts + specificity_pts + banned_pts + length_pts);

// 16. Schema (deterministic, page-type aware). v4.4: the author as a Person (from the business profile), the expert reviewer, LocalBusiness
//     for local pages, VideoObject for pages with a video, an ItemList of the cluster pages for hub pages. Unknown values stay [placeholders].
// 2026-10-12 (FIX_PLAN D10): the name, logo and NAP come from the site model (G19: the business profile, then the homepage Organization /
// LocalBusiness schema, then the Google Business Profile), not from the profile alone. The live page carried "[Your Business Name]",
// "[Office address]" and "[Phone number]" although techand.ai's homepage states Tech&, the DAFZA address and the phone number (exec 365).
// The merged profile travels on (`site_profile` below), so the package's NAP block and author box use the same values.
let MODEL = null;
try { MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
if (!MODEL && prev.site_model && typeof prev.site_model === 'object') MODEL = prev.site_model;
const MNAP = MODEL ? SM.nap(MODEL) : null;
const P0 = prev.site_profile || {}; const PA0 = P0.address || {};
const P = MNAP ? { ...P0, business_name: String(P0.business_name || SM.name(MODEL) || '').trim(), logo_url: P0.logo_url || MODEL.logo_url || '',
  phone: P0.phone || MNAP.phone || '', public_email: P0.public_email || MNAP.public_email || '', price_range: P0.price_range || MNAP.price_range || '',
  address: { street: PA0.street || MNAP.street_address || '', city: PA0.city || MNAP.city || '', region: PA0.region || MNAP.region || '',
    postal_code: PA0.postal_code || MNAP.postal_code || '', country_code: PA0.country_code || MNAP.country_code || '' } } : P0;
const PA = P.address || {}; const AU = prev.author || null; const RV = prev.reviewer || null; const role = prev.page_role || 'standard';
const nap_source = MNAP ? (P0.street_address || PA0.street || P0.phone ? 'profile' : (MNAP.source || '')) : (PA0.street || P0.phone ? 'profile' : '');
const bizName = String(P.business_name || ((prev.site_description && prev.site_description.business_name) ? prev.site_description.business_name : '')).trim();
const biz = bizName || '[Your Business Name]';
const pageUrl = (prev.existing_page && prev.existing_page.url) || (domain ? siteUrlOf(domain, String(slug || '').replace(/^\/|\/$/g, '')) : '[Page URL]');
const h1Text = plain(h1.replace(/^#\s*/, '')) || metaTitle;
const home = domain ? siteUrlOf(domain, '/') : '[Website URL]';
const slugId = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const org = { '@type': 'Organization', ...(domain ? { '@id': home + '#organization' } : {}), name: biz, url: home, ...(P.logo_url ? { logo: P.logo_url } : {}) };
const blocks = [];
const pt = String(prev.page_type || '').toLowerCase();
const articleLike = /blog|guide|article|pillar|hub|case stud/.test(pt);
// P2-6 (2026-10-12, Phase 2 live check §3): the author box *Blog Package* attaches carries its own bracketed fields — the delivered page of
// run 442 held 11 of them ([Author Name] x3, [Author Page URL] x2, [Job title] x2, [name], the bio, the credentials, [LinkedIn profile]) while
// QA reported `placeholder_count: 0`, so a page nobody could publish as-is looked clean. They are counted here exactly as the package writes
// them (same `article_like` rule) and reported as `profile_placeholders`: they are the owner's missing business profile, not a writing
// problem, so they never force an editor round — but the page does not pass while they are there.
const pkgArticleLike = prev.article_like != null ? !!prev.article_like : articleLike;
const PROFILE_PH = [];
if (pkgArticleLike) {
  if (!AU) PROFILE_PH.push({ token: '[Author Name]', count: 3, where: 'byline, author box, author image alt' }, { token: '[Author Page URL]', count: 2, where: 'byline and author-box link' },
    { token: '[Job title]', count: 2, where: 'byline, author box' }, { token: '[name]', count: 1, where: 'author image file name' },
    { token: '[Two-sentence bio: what the author does and for whom]', count: 1, where: 'author box' }, { token: '[Credentials and years of experience]', count: 1, where: 'author box' },
    { token: '[LinkedIn profile]', count: 1, where: 'author box' });
  else if (!String(AU.bio || '').trim()) PROFILE_PH.push({ token: '[Two-sentence bio: what the author does and for whom]', count: 1, where: 'author box' });
}
const profile_placeholders = PROFILE_PH.reduce((n, x) => n + x.count, 0);
const authorRef = AU ? { '@type': 'Person', ...(domain ? { '@id': home + '#author-' + slugId(AU.name) } : {}), name: AU.name, ...(AU.url ? { url: AU.url } : {}) } : { '@type': 'Person', name: '[Author Name]', url: '[Author Page URL]' };
if (articleLike) {
  blocks.push({ type: 'Article', json: { '@context': 'https://schema.org', '@type': 'Article', headline: h1Text, description: plain(metaDesc), author: authorRef, publisher: org, datePublished: today, dateModified: today, mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl }, keywords: [prev.keyword, ...(brief.secondary_keywords || []).slice(0, 5)].filter(Boolean).join(', '), ...(role === 'case_study' ? { articleSection: 'Case study' } : {}) } });
  const person = AU ? { '@context': 'https://schema.org', ...authorRef, ...(AU.job_title ? { jobTitle: AU.job_title } : {}), ...((AU.bio || AU.credentials) ? { description: [AU.bio, AU.credentials && !String(AU.bio || '').includes(AU.credentials) ? AU.credentials : ''].filter(Boolean).join(' ').slice(0, 600) } : {}),
      ...(AU.image_url ? { image: AU.image_url } : {}), ...((AU.same_as || []).length ? { sameAs: AU.same_as } : {}), ...((AU.knows_about || []).length ? { knowsAbout: AU.knows_about } : {}), worksFor: domain ? { '@id': home + '#organization', name: biz } : { '@type': 'Organization', name: biz } }
    : { '@context': 'https://schema.org', '@type': 'Person', name: '[Author Name]', jobTitle: '[Job title]', description: '[Two-sentence bio with credentials]', url: '[Author Page URL]', sameAs: ['[LinkedIn profile URL]'], worksFor: { '@type': 'Organization', name: biz } };
  blocks.push({ type: 'Person', note: AU ? 'The author (business profile). Link the byline to the author page.' : 'No business profile on file: fill in the author, or set up the profile once (form "Set up my business profile" / API mode profile) so every page carries it.', json: person });
  if (RV) blocks.push({ type: 'WebPage', note: 'Expert review (reviewedBy / lastReviewed).', json: { '@context': 'https://schema.org', '@type': 'WebPage', '@id': pageUrl, url: pageUrl, name: h1Text, reviewedBy: { '@type': 'Person', name: RV.name, ...(RV.job_title ? { jobTitle: RV.job_title } : {}), ...(RV.url ? { url: RV.url } : {}) }, lastReviewed: today } });
} else if (pt.includes('product')) {
  blocks.push({ type: 'Product', json: { '@context': 'https://schema.org', '@type': 'Product', name: h1Text, description: plain(metaDesc), brand: { '@type': 'Brand', name: biz }, url: pageUrl, offers: { '@type': 'Offer', priceCurrency: prev.currency || 'USD', price: '[Price as a number]', availability: 'https://schema.org/InStock', url: pageUrl } } });
} else if (role === 'local') {
  const area = String(prev.local_area || '').trim() || '[City]';
  const LBT = [[/account|tax|bookkeep|audit/i, 'AccountingService'], [/legal|law|notar/i, 'LegalService'], [/financ|insur|bank/i, 'FinancialService'], [/medic|clinic|dental|health|doctor/i, 'MedicalBusiness'], [/restaurant|caf|food/i, 'FoodEstablishment'], [/store|shop|retail/i, 'Store'], [/home|plumb|electric|clean|repair|construct/i, 'HomeAndConstructionBusiness'], [/real estate|property/i, 'RealEstateAgent'], [/.+/, 'ProfessionalService']];
  const lbType = P.business_type ? (LBT.find(x => x[0].test(P.business_type)) || [, 'LocalBusiness'])[1] : 'LocalBusiness';
  const hoursOk = /^((Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su))*\s+\d{2}:\d{2}-\d{2}:\d{2}[;,]?\s*)+$/.test(String(P.opening_hours || '').trim());
  const lbId = domain ? home + '#business' : undefined;
  blocks.push({ type: lbType, note: 'Local business details from the business profile' + (P.phone && PA.street ? '.' : ': fill in every [bracketed] value; name, address and phone must match the Google Business Profile exactly.'), json: { '@context': 'https://schema.org', '@type': lbType, ...(lbId ? { '@id': lbId } : {}), name: biz, url: home,
    telephone: P.phone || '[Phone]', ...(P.public_email ? { email: P.public_email } : {}), address: { '@type': 'PostalAddress', streetAddress: PA.street || '[Street address]', addressLocality: PA.city || area, ...(PA.region ? { addressRegion: PA.region } : {}), ...(PA.postal_code ? { postalCode: PA.postal_code } : {}), addressCountry: PA.country_code || prev.country_iso || '[Country code]' },
    areaServed: [area, ...(P.service_areas || []).filter(a => a.toLowerCase() !== area.toLowerCase())].slice(0, 12).map(a => ({ '@type': 'Place', name: a })), ...(hoursOk ? { openingHours: String(P.opening_hours).trim().split(/[;,]\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su))/) } : {}),
    ...(P.price_range ? { priceRange: P.price_range } : {}), ...(P.logo_url ? { logo: P.logo_url, image: P.logo_url } : {}), ...(P.map_url ? { hasMap: P.map_url } : {}) } });
  blocks.push({ type: 'Service', json: { '@context': 'https://schema.org', '@type': 'Service', name: h1Text, serviceType: prev.keyword, description: plain(metaDesc), provider: lbId ? { '@id': lbId, name: biz } : org, areaServed: { '@type': 'Place', name: area }, url: pageUrl } });
} else {
  blocks.push({ type: 'Service', json: { '@context': 'https://schema.org', '@type': 'Service', name: h1Text, serviceType: prev.keyword, description: plain(metaDesc), provider: org, areaServed: prev.country || '[Country]', url: pageUrl } });
}
const V = prev.video || null;
if (V && V.url) {
  const ytWatch = V.provider === 'youtube' && V.id ? 'https://www.youtube.com/watch?v=' + V.id : V.url;
  const clips = (V.chapters || []).map((c, i, a) => ({ '@type': 'Clip', name: c.name, startOffset: c.start_seconds, ...(a[i + 1] ? { endOffset: a[i + 1].start_seconds } : (V.duration_seconds ? { endOffset: V.duration_seconds } : {})), url: V.provider === 'youtube' ? ytWatch + '&t=' + c.start_seconds + 's' : V.url + '#t=' + c.start_seconds }));
  blocks.push({ type: 'VideoObject', note: (V.missing || []).filter(m => m !== 'transcript').length ? 'Fill in: ' + V.missing.filter(m => m !== 'transcript').join(', ') + ' (YouTube Studio shows them).' : 'Video details read from the video page.', json: { '@context': 'https://schema.org', '@type': 'VideoObject', name: V.title || h1Text, description: String(V.description || plain(metaDesc)).slice(0, 2000),
    thumbnailUrl: V.thumbnail_url ? [V.thumbnail_url] : ['[Thumbnail URL]'], uploadDate: V.upload_date || '[Upload date, YYYY-MM-DD]', ...(V.duration_iso ? { duration: V.duration_iso } : {}), ...(V.embed_url ? { embedUrl: V.embed_url } : {}), ...(V.provider === 'file' ? { contentUrl: V.url } : {}), ...(clips.length ? { hasPart: clips } : {}) } });
}
// FIX_PLAN D9: only the cluster pages that are live are listed and linked; the planned ones go into the package as links to add later.
const HPall = (prev.hub_pages || []).filter(p => p && p.url);
const HP = HPall.filter(p => !p.planned);
// P2-3 (2026-10-12): the links to add once a planned page is live are promised on the canonical host, like every other URL we emit (D15)
const ownUrlQA = (u) => { const raw = String(u || '').trim(); const h = raw.match(/^https?:\/\/([^\/?#]+)/i); const host = h ? SM.helpers.bare(h[1]) : '';
  return (raw && domain && host === SM.helpers.bare(domain)) ? siteUrlOf(domain, raw.replace(/^https?:\/\/[^\/?#]*/i, '') || '/') : raw; };
const HPplanned = HPall.filter(p => p.planned).map(p => ({ ...p, url: ownUrlQA(p.url) }));
// R15 (2026-10-13, re-rating §3.11): the ladder's own planned pages are links to add once they are live, exactly like a hub's planned
// cluster pages. Live, `meta.links_to_add_when_published` came back `[]` although the app had sent two `planned: true` ladder links
// (the main page and one sibling) — the only list that carried them was the hub list, which a rung page never has.
// `planned_link_targets` is what *Collect Site URLs* decided is not live yet (D9); only when the run never computed it (an older body) do
// the ladder links the caller sent stand in, and then only the ones it marked planned — a page the site already has is a link, not a to-do.
const plannedLadderQA = Array.isArray(prev.planned_link_targets) ? prev.planned_link_targets : (prev.ladder_links || []).filter(l => l && l.planned === true);
const plannedLinksQA = [...HPplanned.map(p => ({ keyword: p.keyword || '', url: p.url, role: p.role || p.ladder || 'cluster' })),
  ...plannedLadderQA.filter(l => l && l.url)
    .map(l => ({ keyword: l.keyword || l.about || '', url: ownUrlQA(l.url), role: l.role || l.ladder || 'ladder' }))]
  .filter((l, i, a) => l.url && a.findIndex(x => String(x.url).replace(/\/$/, '') === String(l.url).replace(/\/$/, '')) === i)
  .filter(l => String(l.url).replace(/\/$/, '') !== String(pageUrl).replace(/\/$/, ''));
if (role === 'hub' && HP.length) blocks.push({ type: 'ItemList', note: 'The cluster pages this hub links to (live pages only).', json: { '@context': 'https://schema.org', '@type': 'ItemList', name: h1Text + ': guides in this series', itemListElement: HP.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: anchorText(p), url: p.url })) } });
blocks.push({ type: 'BreadcrumbList', json: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: home }, { '@type': 'ListItem', position: 2, name: h1Text, item: pageUrl }] } });
// FIX_PLAN G2: no FAQPage block any more — Google stopped showing FAQ rich results on 2026-05-07 and no other engine reads the markup.
// Every URL in the schema is cleaned of tracking parameters, like the links in the copy (FIX_PLAN G4).
const cleanUrls = (x) => Array.isArray(x) ? x.map(cleanUrls) : (x && typeof x === 'object') ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, cleanUrls(v)])) : (typeof x === 'string' && /^https?:\/\//i.test(x) ? SRC.clean(x) : x);
blocks.forEach(b => { if (b && b.json) b.json = cleanUrls(b.json); });
// E-E-A-T notes for the report (not QA warnings: they never trigger an editor round)
const eeat_notes = [];
if (pkgArticleLike && profile_placeholders) eeat_notes.push(profile_placeholders + ' bracketed field(s) in the byline, the author box and the Person schema still need your details (' + PROFILE_PH.map(x => x.token).join(', ') + '): the page cannot be published as it is. Set up the business profile once (author name, title, credentials, bio, profile links) and every page carries them.');
if (AU && !AU.has_author_page) eeat_notes.push('The author has no profile page URL: an author page on the site (bio, credentials, articles) strengthens attribution.');
if (AU && !(AU.same_as || []).length) eeat_notes.push('Add the author\'s LinkedIn or other public profiles (sameAs) to the business profile.');
const insightPrompts = (md.match(/\[Author insight:[^\]]*\]/gi) || []).length;
if (insightPrompts) eeat_notes.push(insightPrompts + ' [Author insight: ...] line(s) for the author to complete with first-hand experience before publishing.');
// B3-8: what the refresh found on the live page (a note for the report, never an editor round: the draft is what the gate judges)
if (refresh_check && refresh_check.live_figures_unverified.length) { const lf = refresh_check.live_figures_unverified;
  eeat_notes.push('Refresh: the live page shows ' + lf.length + ' figure(s) its own cited source no longer states as it reads today: ' + lf.slice(0, 4).map(x => '"' + x.figure + '" (' + x.sources.join(', ') + ')').join('; ')
    + (lf.some(x => x.still_in_draft) ? ' — the refreshed draft still carries ' + lf.filter(x => x.still_in_draft).length + ' of them, marked [Confirm: …]: quote the source\'s current figure or drop the claim' : ' — the refreshed draft no longer repeats them') + '.'); }
if (refresh_check && refresh_check.sources_failed.length) eeat_notes.push('Refresh: ' + refresh_check.sources_failed.length + ' source(s) the live page cites could not be re-read today, so the figures citing them were not re-checked: ' + refresh_check.sources_failed.slice(0, 3).map(x => x.url).join(', ') + '.');
if (role === 'local' && !(P.phone && PA.street)) eeat_notes.push('Local page without a full address and phone on file: fill in the business profile so the NAP block and LocalBusiness schema are complete.');
if (V && (V.missing || []).length) eeat_notes.push('Video: missing ' + V.missing.join(', ') + (V.missing.includes('transcript') ? ' (paste the transcript from YouTube Studio → Subtitles)' : '') + '.');
if (role === 'hub' && HPplanned.length) eeat_notes.push(HPplanned.length + ' cluster page(s) are planned and not live yet: this page links to none of them. They are listed in the package as "links to add when published" — add the link once each one is live.');
fixes.push('Generated ' + blocks.map(b => b.type).join(' + ') + ' schema');

// G31 (2026-10-13): the customer's stored style guide, checked mechanically (v5/code/_style_guide.js). The brand's own name written
// wrongly is a real quality finding and goes into `warnings`, so the editor corrects it and the page does not pass as it is. The
// spelling variant, the words to avoid and the tone are advice: they are reported beside the page and never make it "not ready".
const style_guide = prev.style_guide || null;
const style = ST.check(md, style_guide);
for (const e of style.errors) warnings.push(e);
const style_notes = [...style.notes];

// FIX_PLAN D10: a page nobody can publish never passes — more than PH_MAX placeholders, or more than 25% over the brief's target (which is
// itself clamped to the competitor analysis' recommendation, or to the verdict's own target, in Parse Brief).
const too_many_placeholders = placeholder_count > PH_MAX;
const too_long = mainWords > target * 1.25;
// R22's editor half (2026-10-14, the second re-rating): being over length was only ever one warning among up to twenty, and the page
// that was delivered still ran 2,648 words against its own 1,800 target (+47%) after TWO editor rounds. The cut is now an instruction of
// its own — how many words to take out and which sections carry them (the ones furthest over their own outline target, else the longest) —
// printed at the top of what the editor is asked to do. (The rung's missing target itself is R22's other half, in Ladder Plan.)
const over_words = Math.max(0, mainWords - target);
const over_pct = target ? Math.round(100 * over_words / target) : 0;
const fat_sections = sections.map(sec => { const o = outline.find(x => x.h2 && plain(x.h2).toLowerCase() === sec.h2.toLowerCase());
    const t = o ? Number(o.target_words) || 0 : 0; return { h2: sec.h2, words: sec.words, target: t, over: t ? sec.words - t : 0 }; })
  .sort((a, b) => (b.over - a.over) || (b.words - a.words)).slice(0, 3).filter(x => x.over > 0 || !x.target);
const atRiskTerms = termCoverage.filter(t => t.found > 0 && t.found <= 2).map(t => t.term).slice(0, 15);
const length_instruction = (target && mainWords > target * 1.1)
  ? 'CUT ' + over_words + ' words: the main content is ' + mainWords + ' words against a target of ' + target + ' (+' + over_pct + '%). '
    + (fat_sections.length ? 'The longest sections are ' + fat_sections.map(x => '"' + x.h2 + '" (' + x.words + ' words' + (x.target ? ' against ' + x.target : '') + ')').join(', ') + '. ' : '')
    + 'Cut repetition, restatements and secondary detail; keep every section, every verified fact, every source and every link. Do not add a single word, and do not stop above ' + Math.round(target * 1.1) + ' words.'
    // A-17: the cut once took the Quick answer itself (exec 771) — the protected blocks are named in the instruction, not left to inference
    + ' PROTECTED, never cut: the **Quick answer:** line right after the introduction (' + (answerWords || '40-70') + ' words), every source link and the call to action.'
    // R43: a correct cut must not fail the coverage check by taking a term off the page — the ones used only once or twice are named
    + (atRiskTerms.length ? ' Keep at least one use of each of these terms (each appears only once or twice, and the topic coverage counts them): ' + atRiskTerms.join(', ') + '.' : '')
  : '';
// R25 (2026-10-14, the second re-rating): "Microsoft's highest APIM SLA ([Statistic]) applies to Premium deployments" went out in the
// delivered body. `placeholder_count: 1` counted it, but the reasons the owner reads listed only the 11 brackets of the empty business
// profile, so nobody was ever told that a figure in the text is a placeholder. Every body placeholder that is still there is named,
// whether or not the count is over PH_MAX (the delivery gate itself is unchanged: PH_MAX still decides what cannot be published).
const placeholder_list = placeholders.slice(0, 6).map(p => p.token + (p.count > 1 ? ' x' + p.count : '')).join(', ');
// B3-2 (2026-10-15): name the amounts the mask removed. "[Price] x43" tells the owner nothing they can act on; the number it replaced,
// with the sentence it came from, is a question they can answer in one reading.
const removed_note = !masked_amounts.length ? ''
  : ' The amount(s) removed: ' + masked_amounts.slice(0, 4).map(a => '"' + a.amount + '" in "' + a.context + '"').join('; ')
    + (masked_amounts.length > 4 ? ' and ' + (masked_amounts.length - 4) + ' more' : '')
    + ' — nothing on file and no source cited in that sentence states them, so give us the figure or let the sentence drop it.';
// R45: a bracket that is not a masked figure ("[name, role]", "[date]") is called what it is, and the writer's notes to confirm are named
const FIGURE_MASK = /^\[(?:Price|Statistic|Number|Amount|Figure|Percentage|Timeline)\]$/i;
const allMasks = placeholders.every(p => FIGURE_MASK.test(p.token));
const writer_note = writer_notes.length ? ' The writer also left ' + writer_notes.reduce((n, x) => n + x.count, 0) + ' note(s) for you to confirm: '
  + writer_notes.slice(0, 4).map(x => x.token + (x.count > 1 ? ' x' + x.count : '')).join(', ') + '.' : '';
const ph_base = (!placeholder_count ? (removed_note ? removed_note.trim() : '')
  : (too_many_placeholders ? placeholder_count + ' placeholder(s) left in the copy (at most ' + PH_MAX + ' can be published): ' + placeholder_list
    : allMasks ? placeholder_count + ' masked figure(s) still in the text: ' + placeholder_list + ' — fill each one in, or rewrite the sentence so it does not need the figure, before you publish'
      : placeholder_count + ' bracket(s) left in the text for you to fill in: ' + placeholder_list + ' — fill each one in before you publish') + removed_note).trim();
const placeholder_note = !writer_note ? ph_base : !ph_base ? writer_note.trim() : ph_base + (/[.!?]$/.test(ph_base) ? '' : '.') + writer_note;
// P2-6: `passed_copy` judges the text and decides the editor round; `passed` judges the page the owner receives, so the author box's
// bracketed fields keep it false — the honest answer to "can I publish this as it is?".
const passed_copy = warnings.length === 0 && content_score >= 80 && Math.abs(mainWords - target) <= target * 0.25 && !too_many_placeholders && !too_long;
const passed = passed_copy && profile_placeholders === 0;
// v4.6: the editor pass (a full rewrite) runs only when it can still improve the page. It is skipped when the draft already scores 90+, the editorial
// review rates it 85+ with no high-severity problem, the length is on target and the only open notes are style notes (passive voice, long
// sentences, medium review remarks). Every SEO check (meta, H1 / keyword, quick answer, question headings, table, CTA, links, sources, figures, coverage,
// specificity, fillers, readability, snippet questions) still forces the editor pass; open style notes stay in the report.
const STYLE_ONLY = /^(Passive voice in about|\d+ sentences longer than 28 words|Editor review: )/;
const crit = critique || lastCritique || {};
const highProblem = (crit.problems || []).some(p => /high|critical/i.test(p.severity || ''));
const editor_needed = !passed_copy && !(content_score >= 90 && crit.score != null && Number(crit.score) >= 85 && !highProblem && !too_many_placeholders && !too_long && Math.abs(mainWords - target) <= target * 0.25 && warnings.every(w => STYLE_ONLY.test(w)));
if (!passed_copy && !editor_needed && round === 1) fixes.push('Editor pass skipped: the draft met every SEO check (score ' + content_score + ', review ' + crit.score + '); the style notes below are left for a final read');
// R11 (2026-10-13, re-rating §3.11): when the rounds run out with the gate still failing, the page is DELIVERED AS A DRAFT and labelled as
// one. Live (exec 521) round 1 failed on 6 placeholders, the editor ran, round 2 came back with 12 (11 × [Price], 1 × [Number]) and 40%
// coverage against a target of 68 — and because `qa_max_rounds: 2` was reached the page went out with nothing in the callback, the e-mail or
// meta.json saying the quality check had failed. The counts below are this round's, so the delivery can only ever carry the LAST round's.
const max_rounds = Math.max(1, Math.round(Number(prev.qa_max_rounds) || 2));
const rounds_left = Math.max(0, max_rounds - round);
const not_ready = !passed && !rounds_left;   // no round left to fix it: a draft, not a publishable page
// R46 (2026-10-16): QA round N follows N - 1 editor calls (round 1 reads the copywriter's draft). Live (exec 616) the note said "The editor
// had 2 round(s)" after ONE editor call and the cost ledger priced a second; both now read `editor_rounds`.
const editor_rounds = Math.max(0, round - 1);
const not_ready_reasons = !not_ready ? [] : [
  placeholder_note,   // R25: named whenever any body placeholder is left, not only above PH_MAX
  profile_placeholders ? profile_placeholders + ' bracketed field(s) in the byline, the author box and the Person schema still need your details' : '',
  too_long ? 'the main content is ' + mainWords + ' words against a target of ' + target : '',
  (!too_long && Math.abs(mainWords - target) > target * 0.25) ? 'the main content is ' + mainWords + ' words against a target of ' + target : '',
  (coverage_target_pct && coverage_pct < coverage_target_pct) ? coverage_compare : '',   // R43: one measure, both figures, the basis named
  content_score < 80 ? 'the content score is ' + content_score + ' of 100 (80 is the bar)' : '',
  ...warnings.filter(w => !/^Too many placeholders|^Main content is too long/.test(w)).slice(0, 4)
].filter(Boolean);
const quality_label = passed ? 'passed the quality check'
  : not_ready ? 'did not pass the quality check — not ready to publish'
    : 'needs another editing round before it can be published';
const quality = { passed, publishable: passed, not_ready, round, max_rounds, rounds_left, label: quality_label, reasons: not_ready_reasons,
  placeholder_note, placeholders_in_body: placeholders.map(p => p.token),   // R25: the owner is told about a masked figure even on a page that is otherwise ready
  placeholder_count, placeholders_total: placeholder_count + profile_placeholders, placeholder_max: PH_MAX, coverage_pct, coverage_target_pct, content_score,
  editor_rounds, open_brackets,   // R46 / R45
  note: not_ready ? (editor_rounds ? 'The editor had ' + editor_rounds + ' round' + (editor_rounds === 1 ? '' : 's') : 'No editing round was left (the quality check allows ' + max_rounds + ' round' + (max_rounds === 1 ? '' : 's') + ')')
    + ' and the page still fails the checks above: it is delivered as a draft to finish by hand, not as a page to publish as it is.' : '' };
const site_profile_out = (P && Object.keys(P).some(k => k === 'address' ? Object.values(P.address || {}).some(Boolean) : String(P[k] || '').trim())) ? P : (prev.site_profile || null);
return [{ json: { ...prev, output: md, qa_round: round, editor_rounds, meta: { title: metaTitle, description: metaDesc, slug }, schema_blocks: blocks, critique: critique || lastCritique || null, site_profile: site_profile_out,
  content_qa: { ai_ready, round, editor_rounds, passed, editor_needed, content_score, quality, publishable: passed, not_ready, quality_label, not_ready_reasons, max_rounds, rounds_left, score_breakdown: { structure: Math.round(structure_pts), coverage: Math.round(coverage_pts), readability: Math.round(readability_pts), specificity: Math.round(specificity_pts), clean_language: Math.round(banned_pts), length: Math.round(length_pts) },
    total_words: totalWords, main_content_words: mainWords, faq_words: faqWords, target_word_count: target, sections, placeholders, placeholder_count, placeholder_max: PH_MAX, review_notes, writer_notes, open_brackets, business_name: bizName, nap_source,
    placeholder_note, length_instruction, over_words, over_pct, longest_sections: fat_sections,   // R25 / R22: the masked figures by name, and the cut the editor is asked to make
    masked_amounts, flagged_amounts, sourced_amounts,   // B3-1 / B3-2: what the money mask removed, what it left for review, and what a cited source vouched for
    outbound_links: externalUrls.map(e => ({ url: e.url, anchor: e.anchor, host: e.host, tier: e.tier })),   // A-14: every outbound link, for Outbound Link Check
    business_claims, business_names: bizNames, unverified_statistics_own: stats_own,   // A-15 / A-19
    verdict_exclusions, excluded_sections, protected_restored,   // A-18 / A-17
    passed_copy, profile_placeholders, profile_placeholder_fields: PROFILE_PH, placeholders_total: placeholder_count + profile_placeholders,
    keyword_mentions: kwCount, keyword_density_pct: density, h2_count: h2s.length, faq_count: validFaqs.length, question_headings: questionHeadings, answered_questions: answeredQuestions, internal_links: internalLinks, external_links: externalLinks, sources_cited: externalUrls.slice(0, 15),
    source_quality: externalUrls.reduce((m, e) => ({ ...m, [e.tier]: (m[e.tier] || 0) + 1 }), {}), weak_sources_unlinked: [...new Set(weakRepeats)], links_to_add_when_published: plannedLinksQA.map(p => ({ keyword: p.keyword || '', url: p.url, role: p.role, anchor: anchorText(p) })),
    answer_block_words: answerWords, meta_title_length: metaTitle.length, meta_description_length: metaDesc.length, unverified_statistics: stats, unverified_figures,
    trusted_sources, banned_phrases: banned_found, readability: { flesch, avg_sentence_words: avgSentence, long_sentences: longSentences, passive_pct, position: read_position, basis: read_basis, band_line: read_band_line, note: read_note,
      band: RBAND.ok ? { low: RBAND.low, high: RBAND.high, median: RBAND.median, p25: RBAND.p25, p75: RBAND.p75, pages_measured: RBAND.pages_measured, pages: RBAND.pages, clamped: RBAND.clamped } : null,
      band_source: RBAND.ok ? 'competitor_pages' : 'fixed', advice_only: true },   // B3-4: the band and its basis; advice, never in `warnings`
    intent, refresh_check,   // B3-6 (every draft) / B3-8 (a refresh: the live page against its re-read sources)
    term_coverage: termCoverage, coverage_pct, coverage: coverage_report, coverage_target_pct, missing_terms: missingTerms, missing_subtopics: missingSubtopics, specificity_per_100_words: specificity,
    critic_score: (critique || lastCritique || {}).score ?? null, critic_verdict: (critique || lastCritique || {}).verdict || null,
    schema_types: blocks.map(b => b.type), eeat_notes, style, style_notes, style_guide: style_guide && style_guide.on_file ? style_guide : null, page_role: role, auto_fixes: fixes, warnings } } }];
