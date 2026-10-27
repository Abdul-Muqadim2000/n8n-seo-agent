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

  // H2 (2026-10-27, R1 §3.5): one field held two names. novaand-demo.com stored "Nova& (legal name: Novaand systems LLC)", the prompts were told
  // to write that exact text everywhere, so the title and every heading carried "(legal name: ...)", and the brand check then flagged
  // "Novaand" inside the legal name the business itself wrote. The brand (the name customers know, used in titles, headings and prose)
  // and the legal name (only where a legal statement needs it) are two values now: `style_legal_name` on the profile row, and a stored
  // value written the old way is read as the two ("X (legal name: Y)", "X (Y LLC)", "X, legal name: Y").
  const LEGAL_SUFFIX = /\b(?:llc|l\.l\.c\.|ltd|limited|inc|incorporated|gmbh|plc|fz-?llc|fze|fzco|pjsc|psc|wll|w\.l\.l\.|s\.?a\.?r?\.?l?|bv|b\.v\.|pty|pvt|private limited|co\.?)\.?$/i;
  function splitBrand(v) {
    const t = S(v); if (!t) return { display: '', legal: '' };
    let m = t.match(/^(.+?)\s*[(\[,;-]\s*(?:legal(?:ly)?(?: name)?|registered(?: name| as)?|company name|trading as|t\/a)\s*[:=-]?\s*([^)\]]+?)\s*[)\]]?\s*$/i);
    if (m && S(m[1]) && S(m[2])) return { display: S(m[1]), legal: S(m[2]) };
    m = t.match(/^(.+?)\s*\(\s*([^()]{3,120}?)\s*\)\s*$/);
    if (m && LEGAL_SUFFIX.test(S(m[2]))) return { display: S(m[1]), legal: S(m[2]) };
    return { display: t, legal: '' };
  }
  // a wrong form that is really another field written into this one ("Spelling: British English") is not a brand form
  const FIELD_LEAK = /^(?:spelling|tone|avoid|words to avoid|notes?|other rules|brand(?: name)?|legal(?: name)?|style)\s*:/i;

  function from(row, o = {}) {
    const r = row || {};
    const split = splitBrand(S(r.style_brand_form) || S(o.brand_form));
    const brand_form = split.display;
    const legal_name = S(r.style_legal_name) || split.legal;
    const raw = S(r.style_spelling);
    const spelling = /brit|en.?gb|\bgb\b|\buk\b/i.test(raw) ? 'British English' : /amer|en.?us|\bus\b/i.test(raw) ? 'American English' : '';
    const avoid = list(r.style_avoid).slice(0, 40);
    const tone = S(r.style_tone);
    const notes = S(r.style_notes);
    const g = { on_file: !!(brand_form || spelling || avoid.length || tone || notes), brand_form, legal_name,
      brand_wrong: list(r.style_brand_wrong).filter(x => !FIELD_LEAK.test(x) && x.toLowerCase() !== legal_name.toLowerCase()).slice(0, 12),
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
    if (x.brand_form && x.legal_name) parts.push('The registered legal name is "' + x.legal_name + '". Use it only where a legal statement needs it (for example the company\'s legal details or terms), never in the title, a heading, the meta description or ordinary sentences, and never in brackets after "' + x.brand_form + '".');
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

  // the text with the legal name (and a "(legal name: ...)" note) blanked out: a wrong form found INSIDE the business's own legal name
  // ("Novaand" in "Novaand systems LLC") is not a misspelling of the brand
  const maskLegal = (text, g) => { let t = String(text || '').replace(/\(\s*(?:legal(?:ly)?(?: name)?|registered(?: name| as)?)\s*[:=-]?[^)]*\)/gi, (m) => ' '.repeat(m.length));
    const ln = S((g || {}).legal_name); if (ln) t = t.replace(new RegExp(esc(ln).replace(/\s+/g, '[\\s\\u00a0]+'), 'gi'), (m) => ' '.repeat(m.length));
    return t; };
  function check(md, guide) {
    const g = guide || {};
    const text = maskLegal(scrub(md), g);
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
      // H2: the legal name in the title, a heading or the meta description (advice: it belongs in legal statements only)
      const legalIn = String(md || '').split('\n').filter(l => /^(?:#{1,6}\s|Title:|Meta Description:)/i.test(l.trim()) && ((g.legal_name && l.toLowerCase().includes(g.legal_name.toLowerCase())) || /\(\s*legal(?: name)?\s*:/i.test(l)));
      res.legal_in_headings = legalIn.length;
      if (legalIn.length) res.notes.push('Legal name: ' + legalIn.length + ' title / heading line(s) carry the legal name' + (g.legal_name ? ' "' + g.legal_name + '"' : '') + '; write "' + g.brand_form + '" there and keep the legal name for legal statements.');
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

  return { from, block, check, wrongForms, scrub, splitBrand, maskLegal, VARIANTS, PAIRS };
})();
