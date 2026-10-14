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
  // the magnitude is part of the figure: "AED 50 million" in the source does not vouch for "AED 50bn" in the draft
  const valueSet = (text) => { const s = new Set(); for (const f of figures(text)) s.add(f.v); return s; };
  const hasFigure = (f, text) => !!f && valueSet(text).has(f.v);
  return { TRACK, clean, key, host, tier, TIERS, strong, figures, valueOf, valueSet, hasFigure, FIG_RE };
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
    const services = uniq([...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
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
      nap, services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
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
  const matchPage = (model, keyword) => {
    const want = termsOf(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) return { url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 };
    }
    let best = null;
    for (const p of inv) {
      const slug = termsOf(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = termsOf(S(p.title) + ' ' + S(p.h1));
      const inSlug = want.filter(t => slug.includes(t)).length / want.length;
      const inTitle = want.filter(t => title.includes(t)).length / want.length;
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score)) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    return best;
  };
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
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at) };
  };
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString() }));
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
})();
// Coverage kit (FIX_PLAN G33, 2026-10-13; inlined through the marker /*__COVERAGE__*/).
// The 2026-10-11 review scored "brief covers the SERP" C1 at 6: the brief carried a term model and the content score gave 25 points for
// using it, but nothing said how much of it the pages that already rank use. Surfer's own study (n = 100) measured the best articles at
// 0.74 term coverage against a results-page average of 0.44, so an average is the wrong bar: the target is the BEST competitor's coverage.
//   CVG.termRe(term)            one matcher for every coverage figure we print (singular / plural, hyphen or space, a filler word between
//                               the words). Content QA's flexRe is this function, so the draft and the competitor pages are measured alike.
//   CVG.coverageOf(text, terms) how many of the shared terms one page uses -> { found, total, pct, used, missing }
//   CVG.best(pages, terms)      the page that uses most of them (a tie goes to the better Google position)
//   CVG.target(pct)             the coverage to aim for: the best competitor's, kept inside 60-90% (a weak results page must not lower
//                               the bar, and a term-stuffed one must not force stuffing). It is a target read off competitor pages, not
//                               a promise about rankings.
//   CVG.subtopics(page)         the best competitor's own H2 / H3 headings, cleaned, as the subtopics to cover
//   CVG.subtopicGap(subs, ctx)  per subtopic: has its own section, covered in the text, or missing
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
  const best = (pages, terms) => {
    const scored = (Array.isArray(pages) ? pages : []).filter(p => p && S(p.content_full || p.content || p.text))
      .map(p => ({ page: p, cov: coverageOf(p.content_full || p.content || p.text, terms) }));
    if (!scored.length) return null;
    scored.sort((a, b) => (b.cov.pct || 0) - (a.cov.pct || 0) || (Number(a.page.rank) || 99) - (Number(b.page.rank) || 99));
    const w = scored[0];
    return { domain: S(w.page.domain), url: S(w.page.url), rank: Number(w.page.rank) || null, coverage_pct: w.cov.pct, terms_used: w.cov.found,
      terms_total: w.cov.total, word_count: Number(w.page.word_count) || null, sections: (w.page.headings || []).length,
      average_pct: Math.round(scored.reduce((s, x) => s + (x.cov.pct || 0), 0) / scored.length), pages_compared: scored.length };
  };
  const MIN_TARGET = 60, MAX_TARGET = 90;
  const target = (bestPct) => { const p = Number(bestPct); if (!(p > 0)) return null; return Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round(p))); };
  const STOP = new Set('the and for with your our how what why when which who whom whose where are can does did should would from into about above below than that this these those you they them their there here all any each few more most other some such not only own same too very per via etc best top near out off its it is was were be been being have has had having will shall may might must do done use used using get gets'.split(' '));
  const toks = (t) => S(t).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const clean = (h) => S(h).replace(/^H\d:\s*/i, '').replace(/^#+\s*/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
  const JUNK = /^(conclusion|summary|introduction|overview|about us|contact|contact us|faq|faqs|frequently asked questions|related (posts|articles|reading)|share this|table of contents|references|sources|get started|book a demo|request a demo|free trial|sign up|subscribe|recent posts|categories|tags|author|comments?)\b/i;
  const subtopics = (page, limit) => {
    const out = []; const seen = new Set();
    for (const h of ((page && page.headings) || [])) {
      const text = clean(h); const key = text.toLowerCase();
      if (!text || text.length < 8 || text.length > 90 || JUNK.test(text) || seen.has(key)) continue;
      if (toks(text).length < 2) continue;
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
  return { termRe, coverageOf, best, target, subtopics, subtopicGap, pct, toks, clean, MIN_TARGET, MAX_TARGET };
})();
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

// 3. Prices become [Price] unless the user gave prices (business facts / description). v4.9 (live 2026-10-02 and 2026-10-08): an amount the
//    verified facts state stays as written (official fines and thresholds, with their source link); an unsourced amount that is not about the
//    business's own prices (a revenue threshold, a fine, a market figure, or anything in millions) becomes [Confirm: AED 50m], so the reviewer
//    sees the figure to check instead of a misleading "[Price]m"; every other amount is an invented price and becomes [Price].
const userText = String(prev.business || '') + ' ' + String(prev.business_facts || '') + ' ' + String(prev.case_facts_text || '');   // case-study facts (v4.4) are the client's own numbers
const userGavePrices = /\d/.test(userText) && /(\$|£|€|₹|\b(aed|sar|pkr|inr|usd|gbp|eur|zar|brl|mxn|rs)\b)/i.test(userText);
if (!userGavePrices) {
  const sym = { GBP: '£', USD: '\\$', CAD: '\\$', AUD: '\\$', NZD: '\\$', SGD: '\\$', PKR: '(?:Rs\\.?|PKR)', INR: '(?:Rs\\.?|₹|INR)', AED: '(?:AED|Dh)', SAR: '(?:SAR|SR)', EUR: '€', ZAR: 'R', BRL: 'R\\$', MXN: '\\$' }[prev.currency] || '[£$€]';
  const unit = '(?:\\s?(?:k|K|m|M|bn|BN|million|Million|billion|Billion|thousand))?\\b';
  const priceRe = new RegExp(sym + '\\s?\\d[\\d.,]*' + unit + '(\\s?(–|-|to)\\s?' + sym + '?\\s?\\d[\\d.,]*' + unit + ')?', 'g');
  const factsText = ((prev.facts || []).map(f => String((f && (f.claim || f.text)) || '')).join(' \n ') + ' ' + userText).replace(/(\d),(?=\d{3}\b)/g, '$1');
  const numsOf = (amt) => (String(amt).replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) || []);
  const verified = (amt) => { const n = numsOf(amt); return n.length > 0 && n.every(x => new RegExp(sym + '\\s?' + x.replace('.', '\\.') + '(?![\\d])', 'i').test(factsText)); };
  const PRICE_WORDS = /\b(price[sd]?|pricing|cost[s]?|fees?|quotes?|packages?|plans?|investment|budget|starting|subscriptions?|rates?|charge[sd]?|pay|paid|per (user|seat|hour|day|project))\b/i;
  const OTHER_WORDS = /\b(revenue|turnover|threshold|fines?|penalt(y|ies)|tax|vat|levy|duty|salary|salaries|wages?|market|funding|raised|valuation|gdp|economy|exports?|imports?|sales of)\b/i;
  const sentenceAt = (text, at, len) => { let a = at, b = at + len; while (a > 0 && !/[.!?\n|]/.test(text[a - 1])) a--; while (b < text.length && !/[.!?\n|]/.test(text[b])) b++; return text.slice(a, b); };
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
  let masked = 0, flagged = 0, kept = 0, illustrative = 0;
  md = md.replace(priceRe, (amt, _r, _s, at, whole) => {
    if (inIllustrative(at)) { illustrative++; return amt; }
    if (verified(amt)) { kept++; return amt; }
    const sent = sentenceAt(whole, at, amt.length);
    const big = /(m|M|bn|BN|million|Million|billion|Billion)\b\s*$/.test(amt);
    if ((big || OTHER_WORDS.test(sent)) && !PRICE_WORDS.test(sent)) { flagged++; return '[Confirm: ' + amt.trim() + ']'; }   // a price sentence keeps the guard
    masked++; return '[Price]';
  });
  if (masked) fixes.push(`Replaced ${masked} invented price(s) with [Price]`);
  if (flagged) fixes.push(`Marked ${flagged} unsourced amount(s) (thresholds, fines, market figures) as [Confirm: …] for review`);
  if (kept) fixes.push(`Kept ${kept} amount(s) stated in the verified facts`);
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
if (unknownSources.length > 2) warnings.push('External links to sources not in the evidence plan: ' + unknownSources.slice(0, 3).map(e => e.host).join(', ') + ' — verify each one');
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
const stats = [...statHits].filter(s => !/^(19|20)\d\d/.test(s)).filter(s => !clientNums.includes(s.toLowerCase().replace(/^(over|more than|up to|nearly|around|approximately|about)\s+/, ''))).slice(0, 8);

// 9b. Claim check (FIX_PLAN G4, 2026-10-11): a figure in a sentence that cites a source must be IN that source. The only source text we have
//     is the text the writer was shown — the fact snippets from the live search, the brief's evidence plan and the competitor pages we read —
//     so a figure that is not there was not read anywhere: it is marked [Confirm: …] in the copy and listed in the report. Formatting does not
//     matter (separators, "m" / "million", "AED 50m" vs "AED 50 million"); small bare numbers ("3 steps") are never treated as claims; a figure
//     the client's own facts carry needs no external source; a sentence whose sources we never read is left alone (nothing to check against).
const srcText = new Map();
const ownFacts = String(prev.business || '') + ' ' + String(prev.business_facts || '') + ' ' + String(prev.case_facts_text || '');   // the client's own numbers vouch for themselves
const addSrc = (u, t) => { const k = SRC.key(u); if (!k || !String(t || '').trim()) return; srcText.set(k, ((srcText.get(k) || '') + ' ' + String(t)).slice(0, 12000)); };
(prev.facts || []).forEach(f => addSrc(f && f.url, [f && f.text, f && f.claim, f && f.title].filter(Boolean).join(' ')));
(brief.evidence_plan || []).forEach(e => addSrc(e && e.source_url, e && e.fact));
(prev.competitors || []).forEach(c => addSrc(c && c.url, [c && c.content_full, c && c.content, c && c.snippet].filter(Boolean).join(' ')));
const unverified_figures = [];
{
  const pad = (x) => ' '.repeat(x.length);
  // a full stop between two digits is a decimal point, not the end of a sentence ("23.5%" must stay whole)
  const isBreak = (t, i) => { const c = t[i]; if (c === '\n' || c === '|' || c === '!' || c === '?') return true; if (c !== '.') return false; return !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')); };
  const bounds = (text, at, len) => { let a = at, b = at + len; while (a > 0 && !isBreak(text, a - 1)) a--; while (b < text.length && !isBreak(text, b)) b++; return [a, b]; };
  const seen = new Set(); const marks = [];
  for (const m of [...md.matchAll(/\[[^\[\]]+\]\((https?:\/\/[^)\s]+)\)/g)]) {
    const [a, b] = bounds(md, m.index, m[0].length); const id = a + ':' + b; if (seen.has(id)) continue; seen.add(id);
    const sent = md.slice(a, b);
    const urls = [...sent.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(x => x[1]);
    const texts = urls.map(u => srcText.get(SRC.key(u)) || '').filter(Boolean);
    if (!texts.length) continue;   // the source was never fetched: nothing to look the figure up in
    const body = sent.replace(/\[[^\[\]]*\]\([^)]*\)/g, pad).replace(/\[[^\[\]]*\]/g, pad);   // anchors, URLs and existing [Confirm: …] / [Price] markers are not claims
    for (const f of SRC.figures(body)) {
      if (texts.some(t => SRC.hasFigure(f, t))) continue;
      if (SRC.hasFigure(f, ownFacts) || clientNums.includes(String(f.raw).toLowerCase())) continue;
      unverified_figures.push({ figure: f.raw, sources: [...new Set(urls.map(u => SRC.host(u)))] });
      marks.push({ start: a + f.index, end: a + f.index + f.length, raw: f.raw });
      if (marks.length >= 12) break;
    }
    if (marks.length >= 12) break;
  }
  marks.sort((x, y) => y.start - x.start);
  for (const t of marks) md = md.slice(0, t.start) + '[Confirm: ' + t.raw + ']' + md.slice(t.end);
  if (marks.length) fixes.push(`Marked ${marks.length} figure(s) that the cited source does not carry as [Confirm: …] for review`);
}

// 10. Banned phrases (AI clichés and filler)
const BANNED = ["in today's fast-paced world", 'in the ever-evolving', 'ever-evolving landscape', 'delve', 'dive into', 'unlock', 'unleash', 'seamless', 'seamlessly', 'robust', 'leverage', 'cutting-edge', 'game-changer', 'game-changing', 'revolutioni', 'elevate your', 'empower', 'navigate the complexities', 'look no further', "it's important to note", 'it is important to note', 'at the end of the day', 'in conclusion', 'comprehensive solution', 'tailored solutions', 'harness the power', "whether you're a", 'a testament to', 'crucial', 'paramount', 'realm', 'tapestry', 'embark', 'foster', 'streamline', 'synergy', 'holistic', 'best-in-class', 'world-class', 'state-of-the-art', 'top-notch', 'one-stop shop', 'in this article', 'in this guide, we', 'without further ado', 'unparalleled', 'transformative', 'in the digital age', 'stay ahead of the curve', 'the bottom line is', 'when it comes to', 'a wide range of'];
const lower = bodyPlain.toLowerCase();
const banned_found = BANNED.map(p => ({ phrase: p, count: (lower.match(new RegExp(escRe(p), 'g')) || []).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
const bannedCount = banned_found.reduce((s, x) => s + x.count, 0);

// 11. Readability (Flesch reading ease, approximate syllables), sentence length, passive voice
const sentences = bodyPlain.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => countWords(s) >= 3);
const sentWords = sentences.map(countWords);
const avgSentence = sentWords.length ? +(sentWords.reduce((a, b) => a + b, 0) / sentWords.length).toFixed(1) : 0;
const longSentences = sentWords.filter(n => n > 28).length;
const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1; const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };
const wordsArr = bodyPlain.split(/\s+/).filter(Boolean);
const syllables = wordsArr.reduce((s, w) => s + syl(w), 0);
const flesch = wordsArr.length && sentences.length ? +(206.835 - 1.015 * (wordsArr.length / sentences.length) - 84.6 * (syllables / wordsArr.length)).toFixed(1) : null;
const passive = sentences.filter(s => /\b(is|are|was|were|been|being|be)\s+(\w+ed|built|made|done|seen|known|given|taken|chosen|written)\b/i.test(s)).length;
const passive_pct = sentences.length ? Math.round(passive / sentences.length * 100) : 0;

// 12. Term coverage (brief terms first, else the competitor term model)
const termList = (brief.terms_to_use || []).map(t => ({ term: String(t.term || t).toLowerCase(), min: Number(t.min_count) || 1 }))
  .concat((prev.term_model || []).slice(0, 25).map(t => ({ term: t.term, min: 1 })))
  .filter((t, i, a) => t.term && a.findIndex(x => x.term === t.term) === i).slice(0, 30);
const termCoverage = termList.map(t => ({ term: t.term, target: t.min, found: (bodyPlain.match(flexRe(t.term, 'gi')) || []).length })).map(t => ({ ...t, ok: t.found >= t.target }));
const coverage = termCoverage.length ? termCoverage.filter(t => t.ok).length / termCoverage.length : 1;
const missingTerms = termCoverage.filter(t => !t.ok).slice(0, 10).map(t => t.term);

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
const missingSubtopics = covPlan && Array.isArray(covPlan.subtopics) && covPlan.subtopics.length
  ? CVG.subtopicGap(covPlan.subtopics, { headings: h2s.concat(md.match(/^###\s+.+$/gm) || []), text: bodyPlain }).filter(x => x.state === 'missing').map(x => x.subtopic)
  : [];
const coverage_report = {
  pct: coverage_pct, terms_found: termCoverage.filter(t => t.ok).length, terms_total: termCoverage.length,
  target_pct: coverage_target_pct, best_competitor_pct: bestPct == null ? null : bestPct,
  best_competitor: covPlan && covPlan.best ? { domain: covPlan.best.domain || '', url: covPlan.best.url || '', rank: covPlan.best.rank ?? null, word_count: covPlan.best.word_count ?? null, sections: covPlan.best.sections ?? null } : null,
  average_competitor_pct: covPlan ? (covPlan.average_pct ?? null) : null,
  measured_on: benchCov ? 'this page\'s own term list, on both the draft and that competitor page' : (covPlan ? 'the draft on its term list; the competitor figure comes from the brief\'s shared-term list' : 'the draft only'),
  missing_terms: missingTerms, subtopics_total: covPlan && covPlan.subtopics ? covPlan.subtopics.length : 0,
  subtopics_missing: missingSubtopics, pages_compared: covPlan ? (covPlan.pages_compared ?? null) : null,
  basis: coverage_target_pct
    ? coverage_pct + '% of the ' + termCoverage.length + ' terms the top pages share, against a target of ' + coverage_target_pct + '% taken from '
      + ((covPlan.best.domain || 'the best page') + (covPlan.best.rank ? ' (position ' + covPlan.best.rank + ')' : '')) + ', which covers ' + bestPct + '%'
      + (covPlan.average_pct != null ? ' (average of the ' + (covPlan.pages_compared || 0) + ' pages read: ' + covPlan.average_pct + '%)' : '')
    : coverage_pct + '% of the ' + termCoverage.length + ' terms the top pages share; no competitor page could be read, so there is no target to compare with'
};

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
if (AT) {
  const h1At = withoutMeta.search(/^# .+$/m); const qaAt = qaMatch ? withoutMeta.indexOf(qaMatch[0]) : -1;
  const before = h1At >= 0 && qaAt > h1At ? countWords(plain(withoutMeta.slice(h1At, qaAt).replace(/^# .+$/m, ''))) : null;
  const heads = (md.match(/^#{2,3} .+$/gm) || []).map(h => plain(h.replace(/^#+\s*/, '')).toLowerCase());
  const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best', '2024', '2025', '2026', '2027', 'list', 'official']);
  const tk = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOPW.has(w));
  const fan = (AT.fanout || []).filter(Boolean);
  const covered = fan.filter(f => { const T = tk(f); if (!T.length) return true; return heads.some(h => T.filter(w => h.includes(w)).length / T.length >= 0.5); });
  const qHeads = heads.filter(h => /\?\s*$/.test(h) || /^(how|what|which|why|when|where|who|is|are|can|does|do|should)\b/.test(h)).length;
  ai_ready = { quick_answer_words: answerWords, words_before_answer: before, question_headings: qHeads, fanout_total: fan.length, fanout_covered: covered.length, missing: fan.filter(f => !covered.includes(f)) };
  if (before != null && before > 60) warnings.push('AI target: move the Quick answer right under the H1 (' + before + ' words come first; assistants read the first ~200 characters)');
  if (fan.length && covered.length < Math.ceil(fan.length / 2)) warnings.push('AI target: give these searches the assistants run their own question-style H2: ' + ai_ready.missing.slice(0, 4).map(f => '"' + f + '"').join(', '));
  if (qHeads < 2) warnings.push('AI target: phrase at least 2 H2s as the questions buyers ask');
}
if (/guarantee/i.test(md) && !prev.business) warnings.push('Contains a guarantee claim — please verify');
if (stats.length) warnings.push('Unverified statistics that need a linked source or a [Statistic] marker: ' + stats.join('; '));
if (unverified_figures.length) warnings.push('Figures the cited source does not carry (now marked [Confirm: …]): ' + unverified_figures.slice(0, 5).map(f => '"' + f.figure + '" (' + f.sources.join(', ') + ')').join('; ') + ' — quote the source\'s own number or cite the page that states it');
if (weakRepeats.length) warnings.push('A source with no independent authority was cited more than once (' + [...new Set(weakRepeats)].join(', ') + '): the repeats were unlinked — cite an official, standards, research or major-press source instead');
if ((prev.internal_link_candidates || []).length > 1 && internalLinks === 0) warnings.push('No internal links to existing pages on the site');
if (bannedCount) warnings.push('Filler / AI-cliché phrases to rewrite (' + bannedCount + '): ' + banned_found.slice(0, 8).map(b => '"' + b.phrase + '"' + (b.count > 1 ? ' x' + b.count : '')).join(', '));
if (flesch != null && flesch < 30) warnings.push(`Hard to read (Flesch ${flesch}, average sentence ${avgSentence} words) — shorten sentences and use plainer words`);
if (longSentences > Math.max(3, sentences.length * 0.12)) warnings.push(`${longSentences} sentences longer than 28 words — split them`);
if (passive_pct > 25) warnings.push(`Passive voice in about ${passive_pct}% of sentences — rewrite in active voice`);
if (termCoverage.length >= 8 && coverage_target_pct && coverage_pct < coverage_target_pct)
  warnings.push('Topic coverage ' + coverage_pct + '% against a target of ' + coverage_target_pct + '% (' + (coverage_report.best_competitor ? (coverage_report.best_competitor.domain || 'the best page') + ' covers ' + coverage_report.best_competitor_pct + '%' : 'the best page in the results') + ') — work these terms in where they belong: ' + missingTerms.join(', '));
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
const PH_MAX = 5;
const PH_RE = /\[[A-Z][A-Za-z0-9 &/'’.,()-]{1,48}\]/g;
const phText = withoutMeta.replace(/\[([^\[\]]+)\]\([^)\s]*\)/g, '$1');   // [anchor](url) and the table of contents are links, not placeholders
const phCounts = new Map();
for (const t of (phText.match(PH_RE) || [])) phCounts.set(t, (phCounts.get(t) || 0) + 1);
const placeholders = [...phCounts.entries()].map(x => ({ token: x[0], count: x[1] })).sort((a, b) => b.count - a.count);
const placeholder_count = placeholders.reduce((s, x) => s + x.count, 0);
const review_notes = (withoutMeta.match(/\[(?:Confirm|Owner|Author insight|Statistic)\b[^\]]*\]/gi) || []).length;
if (placeholder_count > PH_MAX) warnings.push(`Too many placeholders to publish (${placeholder_count}, at most ${PH_MAX} allowed): ` + placeholders.slice(0, 6).map(p => p.token + (p.count > 1 ? ' x' + p.count : '')).join(', ')
  + ' — rewrite those passages so they do not need the missing figure (what drives the cost, what the stages are, what to ask the vendor), and keep a placeholder only where the owner must fill one value in');

// 15. Content score (0-100)
// FIX_PLAN G2: an FAQ block is no longer one of the checks (no FAQ rich results since 2026-05-07); question headings answered directly are.
const structuralChecks = [!!metaTitle && metaTitle.length <= 60, !!metaDesc && metaDesc.length <= 155, !!h1, h2s.length >= 4, !!qaMatch, answeredQuestions >= 3, /\|.*\|/.test(md), !/faq|frequently asked/i.test(lastH2), internalLinks > 0 || (prev.internal_link_candidates || []).filter(c => c && !c.planned).length <= 1, kwCount >= 3 && density <= 2];
const structure_pts = 25 * structuralChecks.filter(Boolean).length / structuralChecks.length;
// FIX_PLAN G33: the 25 coverage points are measured against the best competitor's coverage (clamped 60-90%), not against a silent 100%.
// With no competitor page read, coverage_ratio is the plain share, exactly as before.
const coverage_pts = 25 * coverage_ratio;
const readability_pts = flesch == null ? 10 : (flesch >= 40 && avgSentence <= 22 ? 15 : (flesch >= 30 && avgSentence <= 26 ? 10 : 4));   // B2B copy normally scores 30-55
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
const length_instruction = (target && mainWords > target * 1.1)
  ? 'CUT ' + over_words + ' words: the main content is ' + mainWords + ' words against a target of ' + target + ' (+' + over_pct + '%). '
    + (fat_sections.length ? 'The longest sections are ' + fat_sections.map(x => '"' + x.h2 + '" (' + x.words + ' words' + (x.target ? ' against ' + x.target : '') + ')').join(', ') + '. ' : '')
    + 'Cut repetition, restatements and secondary detail; keep every section, every verified fact, every source and every link. Do not add a single word, and do not stop above ' + Math.round(target * 1.1) + ' words.'
  : '';
// R25 (2026-10-14, the second re-rating): "Microsoft's highest APIM SLA ([Statistic]) applies to Premium deployments" went out in the
// delivered body. `placeholder_count: 1` counted it, but the reasons the owner reads listed only the 11 brackets of the empty business
// profile, so nobody was ever told that a figure in the text is a placeholder. Every body placeholder that is still there is named,
// whether or not the count is over PH_MAX (the delivery gate itself is unchanged: PH_MAX still decides what cannot be published).
const placeholder_list = placeholders.slice(0, 4).map(p => p.token + (p.count > 1 ? ' x' + p.count : '')).join(', ');
const placeholder_note = !placeholder_count ? ''
  : too_many_placeholders ? placeholder_count + ' placeholder(s) left in the copy (at most ' + PH_MAX + ' can be published): ' + placeholder_list
    : placeholder_count + ' masked figure(s) still in the text: ' + placeholder_list + ' — fill each one in, or rewrite the sentence so it does not need the figure, before you publish';
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
const not_ready_reasons = !not_ready ? [] : [
  placeholder_note,   // R25: named whenever any body placeholder is left, not only above PH_MAX
  profile_placeholders ? profile_placeholders + ' bracketed field(s) in the byline, the author box and the Person schema still need your details' : '',
  too_long ? 'the main content is ' + mainWords + ' words against a target of ' + target : '',
  (!too_long && Math.abs(mainWords - target) > target * 0.25) ? 'the main content is ' + mainWords + ' words against a target of ' + target : '',
  (coverage_target_pct && coverage_pct < coverage_target_pct) ? 'it covers ' + coverage_pct + '% of the terms the best-ranking page covers, against a target of ' + coverage_target_pct + '%' : '',
  content_score < 80 ? 'the content score is ' + content_score + ' of 100 (80 is the bar)' : '',
  ...warnings.filter(w => !/^Too many placeholders|^Main content is too long/.test(w)).slice(0, 4)
].filter(Boolean);
const quality_label = passed ? 'passed the quality check'
  : not_ready ? 'did not pass the quality check — not ready to publish'
    : 'needs another editing round before it can be published';
const quality = { passed, publishable: passed, not_ready, round, max_rounds, rounds_left, label: quality_label, reasons: not_ready_reasons,
  placeholder_note, placeholders_in_body: placeholders.map(p => p.token),   // R25: the owner is told about a masked figure even on a page that is otherwise ready
  placeholder_count, placeholders_total: placeholder_count + profile_placeholders, placeholder_max: PH_MAX, coverage_pct, coverage_target_pct, content_score,
  note: not_ready ? 'The editor had ' + max_rounds + ' round(s) and the page still fails the checks above: it is delivered as a draft to finish by hand, not as a page to publish as it is.' : '' };
const site_profile_out = (P && Object.keys(P).some(k => k === 'address' ? Object.values(P.address || {}).some(Boolean) : String(P[k] || '').trim())) ? P : (prev.site_profile || null);
return [{ json: { ...prev, output: md, qa_round: round, meta: { title: metaTitle, description: metaDesc, slug }, schema_blocks: blocks, critique: critique || lastCritique || null, site_profile: site_profile_out,
  content_qa: { ai_ready, round, passed, editor_needed, content_score, quality, publishable: passed, not_ready, quality_label, not_ready_reasons, max_rounds, rounds_left, score_breakdown: { structure: Math.round(structure_pts), coverage: Math.round(coverage_pts), readability: Math.round(readability_pts), specificity: Math.round(specificity_pts), clean_language: Math.round(banned_pts), length: Math.round(length_pts) },
    total_words: totalWords, main_content_words: mainWords, faq_words: faqWords, target_word_count: target, sections, placeholders, placeholder_count, placeholder_max: PH_MAX, review_notes, business_name: bizName, nap_source,
    placeholder_note, length_instruction, over_words, over_pct, longest_sections: fat_sections,   // R25 / R22: the masked figures by name, and the cut the editor is asked to make
    passed_copy, profile_placeholders, profile_placeholder_fields: PROFILE_PH, placeholders_total: placeholder_count + profile_placeholders,
    keyword_mentions: kwCount, keyword_density_pct: density, h2_count: h2s.length, faq_count: validFaqs.length, question_headings: questionHeadings, answered_questions: answeredQuestions, internal_links: internalLinks, external_links: externalLinks, sources_cited: externalUrls.slice(0, 15),
    source_quality: externalUrls.reduce((m, e) => ({ ...m, [e.tier]: (m[e.tier] || 0) + 1 }), {}), weak_sources_unlinked: [...new Set(weakRepeats)], links_to_add_when_published: plannedLinksQA.map(p => ({ keyword: p.keyword || '', url: p.url, role: p.role, anchor: anchorText(p) })),
    answer_block_words: answerWords, meta_title_length: metaTitle.length, meta_description_length: metaDesc.length, unverified_statistics: stats, unverified_figures,
    trusted_sources, banned_phrases: banned_found, readability: { flesch, avg_sentence_words: avgSentence, long_sentences: longSentences, passive_pct }, term_coverage: termCoverage, coverage_pct, coverage: coverage_report, coverage_target_pct, missing_terms: missingTerms, missing_subtopics: missingSubtopics, specificity_per_100_words: specificity,
    critic_score: (critique || lastCritique || {}).score ?? null, critic_verdict: (critique || lastCritique || {}).verdict || null,
    schema_types: blocks.map(b => b.type), eeat_notes, style, style_notes, style_guide: style_guide && style_guide.on_file ? style_guide : null, page_role: role, auto_fixes: fixes, warnings } } }];
