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
//   CVG.kindOf(page, keyword)   'list' | 'other' | 'guide' | 'service' | 'unknown', from the URL path, the title (without the keyword's own
//                               words), the headings and the byline; CVG.kindFor(pageType) ours. 'other' (D5) is a course, certification,
//                               job, marketplace or directory page: never the page to beat, never a stand-in
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
  // D5 / RV-9 (2026-10-21, pre-launch run exec 42): a page that offers something OTHER than the thing being sold is never a competitor
  // of a service page. Live, the page to beat for the service page "ai consultant" was usaii.org's certification course "Certified
  // Artificial Intelligence Consultant | CAIC(TM)": its title matched `consult\w*`, which is the target keyword itself, so it was read as
  // a service page, and the client was told to add "Program Fee: US $894 (All Inclusive)", "Alumni Speak" and "Program Eligibility".
  // The kind 'other' is a course, a certification, a training programme, a job, career or salary page, a freelance marketplace or a
  // member directory, read from the title, the URL path and the page's own headings.
  const OTHER_TITLE = /\b(?:certified|certifications?|certificates?|courses?|bootcamps?|diplomas?|degrees?|masterclass|syllabus|curriculum|tuition|salary|salaries|jobs?|vacanc\w*|careers?|freelancers?|freelance|associations?|directory|membership|marketplace)\b|\bprogram(?:me)?s?\b(?!\s+management)|\bhow (?:to|do i|can i) become\b|\bfor hire\b/i;
  // CT-FIX (review item 4, 2026-10-22): one word in a title is not enough. "Microsoft Certified Dynamics 365 Partner", "Active Directory &
  // Azure Migration Services", "Shopify Development & Marketplace Integration", "ERP Implementation | Programme Delivery", "Salesforce
  // Consulting Partner | Careers at scale" and a Golden Visa page with two "Eligibility" headings are real competitors. A page is
  // 'other' on TWO signals (title, URL path, headings); a title word that only ever names a course, a job or a salary (STRONG) is two.
  const OTHER_STRONG = /\b(?:courses?|bootcamps?|diplomas?|degrees?|masterclass|syllabus|tuition|salary|salaries|jobs?|vacanc\w*|freelancers?|freelance)\b|\bhow (?:to|do i|can i) become\b|\bfor hire\b/i;
  const OTHER_KW = /\b(?:training|trainings|course|courses|certif\w*|bootcamps?|diplomas?|degrees?|jobs?|careers?|salar\w*|academy|workshops?)\b/i;   // a client that sells the course itself
  const OTHER_PATH = /\/(?:[a-z-]*certif[a-z-]*|[a-z-]*courses?|bootcamps?|training(?:-[a-z-]+)?|programs?|programmes?|jobs?|careers?|vacancies|salar[a-z-]*|hire|freelancers?|directory|members?)(?:\/|$)/i;
  const OTHER_HEADINGS = /\b(?:program(?:me)? fees?|course fees?|tuition|eligibility|eligible|curriculum|syllabus|enrol\w*|enroll\w*|admissions?|alumni|study[- ]?(?:books?|kits?|materials?)|get certified|salary|job (?:description|openings)|apply now|member directory|get listed|post a job)\b/i;
  // The words of the keyword itself are never the evidence: "Consultant" in "Certified AI Consultant" says what the page is about, not
  // that it sells the service. An offer noun of the keyword ("services", "agency", "software") still counts: a title carrying it offers it.
  const OFFER_NOUN = /^(?:services?|solutions?|software|platforms?|agency|agencies|company|companies|firms?|pricing|partners?)$/i;
  const kwStrip = (text, keyword) => {
    const ks = S(keyword).toLowerCase().split(/[^a-z0-9&]+/).filter(w => w.length >= 2 && !OFFER_NOUN.test(w));
    if (!ks.length) return S(text);
    return S(text).split(/(\s+)/).filter(w => { const x = w.toLowerCase().replace(/[^a-z0-9&]+/g, ''); return !x || !ks.some(k => x === k || x === k + 's' || x === k + 'es'); })
      .join('').replace(/\s+/g, ' ').trim();
  };
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '') || '/';
  // why a page is 'other' ('title' | 'headings' | 'path'), or '' when it is not. A search for the course itself ("ai consultant
  // certification") is not refused for being one: when the keyword carries such a word, nothing is 'other'.
  const otherWhy = (p, keyword) => {
    if (OTHER_TITLE.test(S(keyword)) || OTHER_KW.test(S(keyword))) return '';
    const title = kwStrip(S(p && p.title), keyword), path = pathOf(p && p.url).toLowerCase();
    if (OTHER_STRONG.test(title)) return 'title';
    const hs = ((p && p.headings) || []).map(h => S(h).replace(/^H\d:\s*/i, '')).filter(h => OTHER_HEADINGS.test(h));
    const sig = [OTHER_TITLE.test(title) ? 'title' : '', hs.length >= 2 ? 'headings' : '', (OTHER_PATH.test(path) && !GUIDE_PATH.test(path)) ? 'path' : ''].filter(Boolean);
    return sig.length >= 2 ? sig.join(' + ') : '';
  };
  // R44 kinds plus D5: 'list' | 'other' | 'service' | 'guide' | 'unknown'. A page nothing says sells the service is 'unknown' now, not
  // 'service' (iaaic.org's directory homepage was a "service page" by that default): it can stand in for the term target, never be the
  // page of the kind being written.
  const kindOf = (p, keyword) => {
    const title = S(p && p.title), path = pathOf(p && p.url), slug = path.replace(/[\/_-]+/g, ' ');
    const kw = keyword != null ? keyword : '';
    if (LIST_RE.test(title) || LIST_RE.test(slug)) return 'list';
    if (otherWhy(p, kw)) return 'other';
    if (SERVICE_PATH.test(path)) return 'service';
    if (GUIDE_PATH.test(path) || GUIDE_TITLE.test(title)) return 'guide';
    const sep = title.split(/\s+[|–—-]\s+/);   // "AI Consulting Services | ATI Lab", "AI Consulting Services in Dubai - Kinetic Consulting"
    if (sep.length >= 2 && sep[sep.length - 1].split(/\s+/).length <= 4 && SERVICE_WORDS.test(kwStrip(sep.slice(0, -1).join(' '), kw))) return 'service';
    if (p && p.has_author && p.has_date) return 'guide';
    // CT-FIX (review item 3): "AI Consultant in Dubai | Kinetic", "Hire an AI Consultant in Dubai" and "AI Consulting Services Dubai" were
    // 'unknown', so a service page had no page of its kind to beat. A page that is no list, no guide and no course whose title offers the
    // thing (an offer word) or names the search itself (every keyword word, any ending) is a service page.
    if (SERVICE_WORDS.test(kwStrip(title, kw))) return 'service';
    const kws = S(kw).toLowerCase().split(/[^a-z0-9&]+/).filter(w => w.length >= 2 && !STOP.has(w));
    const tl = title.toLowerCase();
    if (kws.length && kws.every(w => new RegExp('\\b' + w.slice(0, Math.max(2, Math.min(w.length, 7))).replace(/[^a-z0-9&]/g, '')).test(tl))) return 'service';
    return 'unknown';
  };
  // the kind of page being written, from the page type (PT.of options): a service / product / landing / local page sells; the rest explain
  const kindFor = (pageType) => (/blog|guide|article|pillar|hub|case stud|post/i.test(S(pageType)) ? 'guide' : 'service');
  // a list is a fair benchmark only for a guide whose search itself asks for a list ("best erp companies in dubai")
  const LIST_SEARCH = /\b(?:best|top|companies|firms|agencies|providers|vendors|tools|alternatives|list)\b/i;
  const OFFICIAL = /(^|\.)(gov|govt|gob|gouv|mil)(\.[a-z]{2,3})?$|(^|\.)(gov|govt|gob|gouv)\.[a-z]{2,3}(\.[a-z]{2})?$/;   // a government / official host
  const best = (pages, terms, want) => {
    const kwW = want && want.keyword != null ? want.keyword : '';
    const scored = (Array.isArray(pages) ? pages : []).filter(p => p && S(p.content_full || p.content || p.text))
      .map(p => ({ page: p, kind: kindOf(p, kwW), cov: coverageOf(p.content_full || p.content || p.text, terms) }));
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
    // D5 (2026-10-21): a course, certification, job, marketplace or directory page ('other') never stands in, and when only such pages
    // and lists were read there is no page to beat at all: `none` says so, with what was read, instead of measuring against a wrong page.
    const same = k ? cands.filter(x => x.kind === k || (lists && x.kind === 'list')) : cands.filter(x => x.kind !== 'other');
    const notList = cands.filter(x => x.kind !== 'list' && x.kind !== 'other');
    const kinds = scored.reduce((m, x) => { m[x.kind] = (m[x.kind] || 0) + 1; return m; }, {});
    const other_pages = scored.filter(x => x.kind === 'other').map(x => S(x.page.domain) || pathOf(x.page.url));
    const average_pct = Math.round(scored.reduce((s, x) => s + (x.cov.pct || 0), 0) / scored.length);
    const official_skipped = cands === scored ? 0 : official.length;
    const pool = same.length ? same : notList;
    if (!pool.length) return { none: true, domain: '', url: '', rank: null, coverage_pct: null, terms_used: null, terms_total: (Array.isArray(terms) ? terms.length : 0),
      word_count: null, sections: 0, kind: null, type_match: k ? false : null, same_kind_pages: k ? 0 : null, official_skipped, kinds, other_pages, average_pct, pages_compared: scored.length };
    const w = pool.slice().sort(order)[0];
    return { domain: S(w.page.domain), url: S(w.page.url), rank: Number(w.page.rank) || null, coverage_pct: w.cov.pct, terms_used: w.cov.found,
      terms_total: w.cov.total, word_count: Number(w.page.word_count) || null, sections: (w.page.headings || []).length, kind: w.kind,
      type_match: k ? same.length > 0 : null, same_kind_pages: k ? same.length : null, official_skipped, kinds, other_pages,
      average_pct, pages_compared: scored.length };
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
  // D5 (2026-10-21): a course's sales headings are never a topic either: a fee or a price with an amount, a discount, "FREE", alumni,
  // eligibility, a curriculum, enrolment, study kits, "Ready for your Next Step?" (exec 42's usaii.org headings).
  const PROMO_OFFER = /(?:\bUS\s?\$|\$\s?\d|\b(?:aed|usd|eur|gbp|sar|inr)\s?\d|\d\s?(?:aed|usd|eur|gbp|sar)\b)|\b(?:program(?:me)?s? fees?|course fees?|tuition|fees?\s*:|prices?\s*:|discounts?|speedster|worth up to|alumni|eligib\w*|curriculum|syllabus|enrol\w*|enroll\w*|admissions?|scholarships?|study[- ]?(?:books?|kits?|materials?)|ready for (?:your|the) next|resource cent(?:er|re)|e-?learning)\b/i;
  const FREE_CAPS = /\bFREE\b/;
  // CT-FIX (review item 5): "Eligibility for small business relief", "Volume discounts for multi-year licences", "Projects under $50k: what
  // to expect", "Curriculum design for internal AI training", "FREE trial versus paid pilot" are topics on a page of our kind. A course's
  // sales words count only when the page to beat is a course / job / directory page (kind 'other'); a heading that IS a fee or an amount
  // ("Fee: US $894", "Program Fee: US $894 (All Inclusive)", "AED 4,500") is never a topic.
  const FEE_LABEL = /^(?:(?:program(?:me)?|course|registration|application|exam|joining)\s+)?(?:fees?|prices?|pricing|costs?|tuition)\s*:|^\W*(?:US\s?)?(?:\$|aed|usd|eur|gbp|sar|inr)\s?\d[\d,.]*\s*[a-z]{0,3}\W*(?:\([^)]*\))?\s*$/i;
  const isPromo = (h, kind) => { const t = clean(h); return PROMO.test(t) || FEE_LABEL.test(t) || (kind === 'other' && (PROMO_OFFER.test(t) || FREE_CAPS.test(t))); };
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
    const hs = (page && page.headings) || []; const list = page ? kindOf(page, opts && opts.keyword) === 'list' : false;
    const content = S(page && (page.content_full || page.content || page.text));
    const marks = brandMarks(page, opts);
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      const text = clean(h); const key = text.toLowerCase();
      if (!text || text.length < 8 || text.length > 90 || JUNK.test(text) || seen.has(key)) continue;
      if (toks(text).length < 2) continue;
      if (isPromo(text, list ? 'list' : kindOf(page, opts && opts.keyword))) continue;
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
  return { termRe, coverageOf, best, target, subtopics, subtopicGap, namesBrand, brandMarks, pct, toks, clean, kindOf, kindFor, otherWhy, kwStrip, isPromo, MIN_TARGET, MAX_TARGET,
    plainOf, readability, readBand, READ_MIN_WORDS, READ_MIN_PAGES, BAND_HARDER, BAND_EASIER, BAND_FLOOR, BAND_CEIL };
})();
