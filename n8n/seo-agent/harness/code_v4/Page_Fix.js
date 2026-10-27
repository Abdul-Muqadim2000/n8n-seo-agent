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
  const OTHER_HEAD_STRONG = /\b(?:member directory|post a job|program(?:me)? fees?|course fees?|tuition|admissions?|get certified|apply now)\b/i;   // one such heading names the page's own offer
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
    const sig = [OTHER_TITLE.test(title) ? 'title' : '', (hs.length >= 2 || hs.some(h => OTHER_HEAD_STRONG.test(h))) ? 'headings' : '', (OTHER_PATH.test(path) && !GUIDE_PATH.test(path)) ? 'path' : ''].filter(Boolean);
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
  const isPromo = (h, kind) => { const t = clean(h); if (/\b(?:versus|vs\.?|compared (?:to|with))\s/i.test(t) && !FEE_LABEL.test(t)) return false; return PROMO.test(t) || FEE_LABEL.test(t) || (kind === 'other' && (PROMO_OFFER.test(t) || FREE_CAPS.test(t))); };
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
// ---- PF: the page pipeline's one contract, its one score and its fixes (H1, 2026-10-27; inlined through the PAGE_FIX marker) ----
// docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md: the four production page runs (949, 2195, 2552, 2575) all came out "not ready
// to publish". One full-page Editor pass with no safety net made 3 of the 4 pages worse (two cut off, one regressed on keyword, coverage,
// claims and links), the Brief, the Copywriter, the Critic, the Editor and the quality check each held a different length / bracket /
// claim rule, every warning blocked, and the PDF printed the Critic's grade of the FIRST draft. R2_MARKET_RESEARCH.md: no leading tool
// blocks on SEO metrics; facts, trust and legal problems are what block. This kit is the one place those rules live:
//   PF.contract(prev)          the contract every writer prompt prints (length as a band, no brackets, the claim rule, page-type targets)
//   PF.split / PF.join         a page as its head (meta lines) + sections (s0 = H1 and introduction, s1.. = each H2); lossless
//   PF.fix(md, ctx)            the deterministic fixes, run before every quality check (no model, cannot invent anything)
//   PF.classify(qa, md, ctx)   BLOCKING (facts, trust, legal, a cut page) vs ADVISORY (length, coverage, structure, style)
//   PF.score / PF.better       ONE comparison for every candidate draft: hard blockers, then soft blockers, then advisory distance
//   PF.plan(md, cls, qa, ctx)  the section-targeted edit job: only the sections with a problem, each with its own problem list
//   PF.parseSections / merge   the editor's answer (one block per section) merged into the page, every other byte kept
//   PF.neutralize(md, cls)     the system's own neutral rewrite of whatever a fact would be needed for (delete / unlink / neutral CTA)
//   PF.deliver(...)            ready | ready_with_questions | not_ready, in plain customer words, with the client questions
// Pure: no clock, no network, no n8n globals, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const PF = (() => {
  const S = (v) => String(v == null ? '' : v);
  const EDIT_MAX = 3;           // section-targeted editing rounds at most; the loop stops earlier as soon as a round improves nothing
  const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const words = (t) => S(t).split(/\s+/).filter(Boolean).length;
  const plain = (s) => S(s).replace(/\[([^\[\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]+/g, '').replace(/\s+/g, ' ').trim();
  const escRe = (s) => S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // customer wording: no em / en dashes, curly quotes or the ellipsis character in anything this kit writes (owner rule, 2026-10-19)
  const clean = (s) => S(s).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/:\s*:/g, ':').trim();
  const STOP = new Set('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them than then into over under more most can will does do not but any all one two also very just only such been being has have had was were'.split(' '));
  const toks = (t) => S(t).toLowerCase().split(/[^\p{L}\p{N}&]+/u).filter(w => w.length > 2 && !STOP.has(w));
  const overlap = (a, b) => { const A = [...new Set(toks(a))]; if (!A.length) return 0; const B = new Set(toks(b)); return A.filter(w => B.has(w)).length / A.length; };
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const keyOf = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);
  const titleCase = (k) => S(k).split(/\s+/).filter(Boolean).map((w, i) => i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : /^[a-z]{2,4}$/.test(w) && /^(erp|crm|ai|uae|ksa|gcc|vat|seo|sap|hr|it|b2b|saas|api|ms|iot|ml|pdf|faq)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const QUESTION_KW = /^(is|are|can|does|do|what|which|how|why|when|where|who|should|will)\b/i;

  // ---------- 1. the contract ----------
  const PT_TARGETS = {
    guide: { h2: [5, 9], text: '5 to 9 H2 sections, at least 3 headings phrased as the questions readers ask with a 40-60 word answer right under each, a comparison table where options are compared, the call to action last' },
    service: { h2: [4, 8], text: '4 to 8 H2 sections: what the service covers, who it suits, how to decide, how to start; at least 2 question headings; the call to action last' },
    local: { h2: [4, 7], text: '4 to 7 H2 sections; the address, phone and service area only as the business profile gives them; the call to action last' },
    case_study: { h2: [4, 7], text: 'challenge, approach, result and what the reader can learn, every fact from the case study on file; nothing added' },
    other: { h2: [4, 9], text: '4 to 9 H2 sections, at least 3 question headings answered directly, the call to action last' }
  };
  const kindOf = (pageType, role) => { const t = S(pageType).toLowerCase(); if (S(role) === 'local') return 'local'; if (S(role) === 'case_study' || /case stud/.test(t)) return 'case_study';
    if (/service|landing|product|solution/.test(t)) return 'service'; if (/guide|blog|article|pillar|hub|how/.test(t)) return 'guide'; return 'other'; };
  const bandOf = (p) => { const LB = ((p || {}).competitor_analysis || {}).length_band || (p || {}).length_band || null;
    return LB && (LB.ok || LB.source === 'page_type') && Number(LB.low) > 0 && Number(LB.high) >= Number(LB.low)
      ? { low: Number(LB.low), high: Number(LB.high), source: LB.ok ? 'ranking_pages' : 'page_type', basis: clean(LB.basis) } : null; };
  const contract = (prev) => {
    const p = prev || {};
    const band = bandOf(p);
    const kind = kindOf(p.page_type, p.page_role);
    const biz = S((p.site_profile || {}).business_name || (p.site_description || {}).business_name || p.business_name || 'the business').trim() || 'the business';
    const length_text = band
      ? 'LENGTH: judged as a band, ' + band.low + '-' + band.high + ' words of main content' + (band.basis ? ' (' + band.basis + ')' : '') + '. Anywhere inside the band is right: aim for the brief\'s target word count, never pad to reach a number and never cut a complete answer to hit one. Length is advice, never a reason to refuse the page.'
      : 'LENGTH: aim for the brief\'s target word count; the check accepts anything from 80% to 125% of it. Never pad and never cut a complete answer to hit a number. Length is advice, never a reason to refuse the page.';
    const rules = [
      'THE PAGE CONTRACT (the brief, the writer, the reviewer, the editor and the quality check all apply these same rules)',
      length_text,
      'BRACKETS: none in the page. Never write a placeholder, a [Confirm: ...], an [Author insight: ...] or any other square-bracket note in the text (Markdown links and [Image: ...] lines are fine). When a fact is missing, write the sentence so it does not need it. A question for ' + biz + ' goes in the brief\'s questions_for_client list, never into the page.',
      'CLAIMS: say what ' + biz + ' does, offers, has done, holds or guarantees only when the business facts, the author profile, the case studies or its own pages state it. Write methods, steps and checklists as advice to the reader ("a sound migration starts with an inventory of ..."), never as "we do" or "our process". The call to action invites the reader to get in touch the way the facts say; it never promises a deliverable, a timeline, a price or a result that is not on file.',
      'NEVER: invented testimonials, reviews, quotes, client names, results, guarantees, certifications, team details or numbers about the business. A figure about the world is quoted exactly as a cited source states it, and the source is a page this run read.',
      'PAGE TYPE (' + (S(p.page_type) || kind) + '): ' + PT_TARGETS[kind].text + '.',
      'WHAT BLOCKS PUBLISHING: an unsupported statement about the business, a figure its source does not state, a bracket in the text, a dead link, a wrong brand name, copied text, a fake testimonial or guarantee, a page cut off before its end. Everything else (length, term coverage, headings, tables, readability) is advice.'
    ];
    return { version: 1, band, kind, h2_range: PT_TARGETS[kind].h2, business: biz, length_text, text: rules.join('\n') };
  };

  // ---------- 2. the page as sections ----------
  const split = (md) => {
    const src = S(md); const lines = src.split('\n'); const starts = []; let off = 0;
    for (const l of lines) { starts.push(off); off += l.length + 1; }
    let i = 0; while (i < lines.length && (META.test(lines[i].trim()) || !lines[i].trim())) i++;
    const headEnd = i < lines.length ? starts[i] : src.length;
    const cuts = [headEnd]; let fence = false;
    for (let k = i; k < lines.length; k++) {
      if (/^\s*(```|~~~)/.test(lines[k])) { fence = !fence; continue; }
      if (!fence && /^## /.test(lines[k]) && starts[k] !== cuts[cuts.length - 1]) cuts.push(starts[k]);
    }
    const parts = [];
    for (let c = 0; c < cuts.length; c++) { const a = cuts[c], b = c + 1 < cuts.length ? cuts[c + 1] : src.length; const text = src.slice(a, b);
      parts.push({ id: 's' + c, start: a, end: b, heading: c === 0 ? plain((text.match(/^# .*$/m) || [''])[0].replace(/^#\s*/, '')) : plain(text.split('\n')[0].replace(/^#+\s*/, '')), text }); }
    return { head: src.slice(0, headEnd), parts };
  };
  const join = (sp) => sp.head + sp.parts.map(p => p.text).join('');
  const partAt = (sp, at) => { const hl = sp.head.length; if (at < hl) return null; return sp.parts.find(p => at >= p.start && at < p.end) || sp.parts[sp.parts.length - 1] || null; };
  const isCta = (sp, part) => !!part && part === sp.parts[sp.parts.length - 1] && part.id !== 's0';

  // ---------- 3. sentences: find, remove, keep the page well formed ----------
  // link targets are shadowed so a full stop inside a URL never ends a sentence (the same trick as Content QA §3)
  const shadow = (t) => S(t).replace(/\]\(([^)\s]+)\)/g, (m) => '](' + 'x'.repeat(Math.max(0, m.length - 3)) + ')');
  const isEnd = (g, i) => { const c = g[i]; if (c === '\n' || c === '|') return true; if (c === '!' || c === '?') return true;
    if (c === '.') return !(/\d/.test(g[i - 1] || '') && /\d/.test(g[i + 1] || '')) && (i + 1 >= g.length || /[\s)*_"']/.test(g[i + 1])); return false; };
  const span = (md, at, len) => {
    const g = shadow(md); let a = at, b = at + len;
    while (a > 0 && !isEnd(g, a - 1)) a--;
    while (a < at && /[ \t]/.test(md[a])) a++;
    while (b < g.length && !isEnd(g, b)) b++;
    if (b < g.length && /[.!?]/.test(g[b])) { b++; while (b < g.length && /[)*_"']/.test(g[b])) b++; }
    while (b < g.length && /[ \t]/.test(md[b])) b++;
    return [a, b];
  };
  const LIST_ONLY = /^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*(?:\*\*|__)?\s*(?:\*\*|__)?\s*$/;
  const tidy = (md) => {
    let out = S(md).split('\n').filter((l, i, a) => !(l.trim() && LIST_ONLY.test(l) && !/^\s*$/.test(l))).join('\n');
    // a heading (H2-H4) left with nothing under it before the next heading of its level or higher is removed with its section
    const lines = out.split('\n'); const keep = new Array(lines.length).fill(true);
    for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{2,4})\s/); if (!m) continue; const lvl = m[1].length; let j = i + 1, body = false;
      for (; j < lines.length; j++) { const h = lines[j].match(/^(#{1,6})\s/); if (h && h[1].length <= lvl) break; if (h) { body = true; break; } if (lines[j].trim() && !/^\[Image:/i.test(lines[j].trim())) { body = true; break; } }
      if (!body) keep[i] = false; }
    out = lines.filter((l, i) => keep[i]).join('\n');
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');
  };
  // remove what sits at [at, at+len): a whole sentence in prose, a table row (never the header row), only the text in a heading
  const removeAt = (md, at, len) => {
    const src = S(md); const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at + len); if (le < 0) le = src.length;
    const line = src.slice(ls, le);
    if (/^#{1,6}\s/.test(line) || META.test(line.trim())) return src.slice(0, at) + src.slice(at + len);
    if (/^\s*\|/.test(line)) {
      const next = src.slice(le + 1, (src.indexOf('\n', le + 1) + 1 || src.length + 1) - 1);
      if (/^\s*\|?\s*:?-{2,}/.test(next)) return src.slice(0, at) + src.slice(at + len);   // a header cell: the token only
      return src.slice(0, ls) + src.slice(Math.min(src.length, le + 1));
    }
    const [a, b] = span(src, at, len);
    return src.slice(0, a) + src.slice(b);
  };
  const removeText = (md, text) => { const t = S(text); if (!t) return { md, done: false }; const at = S(md).indexOf(t); if (at < 0) return { md, done: false }; return { md: removeAt(md, at, t.length), done: true }; };
  // the sentence that holds a link to the business's own site keeps its link as a neutral next step; any other sentence goes
  const ownLinkIn = (sentence, domain) => { const d = S(domain).toLowerCase().replace(/^www\./, ''); if (!d) return null;
    for (const m of S(sentence).matchAll(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) { const h = hostOf(m[2]); if (h === d || h.endsWith('.' + d)) return { anchor: m[1], url: m[2] }; } return null; };
  const neutralSentence = (md, sentence, domain, rewrite) => {
    const src = S(md); const wrapped = '[Confirm: ' + sentence + ']';
    let at = src.indexOf(wrapped), len = wrapped.length; if (at < 0) { at = src.indexOf(sentence); len = S(sentence).length; }
    if (at < 0) return { md: src, done: false, how: '' };
    const link = ownLinkIn(sentence, domain);
    if (link) { const line = 'Next step: [' + link.anchor.replace(/^\s+|\s+$/g, '') + '](' + link.url + ').'; return { md: src.slice(0, at) + line + src.slice(at + len), done: true, how: 'cta', text: line }; }
    // H2's neutral wording (CL.neutral): a method in the business's voice kept as advice to the reader; a stance or a client fact goes
    const rw = rewrite || {}; const nt = S(rw.neutral).trim();
    if (rw.action === 'reword' && nt && !/\[/.test(nt)) { return { md: src.slice(0, at) + nt + src.slice(at + len), done: true, how: 'reworded', text: nt }; }
    return { md: removeAt(src, at, len), done: true, how: 'removed' };
  };

  // ---------- 4. brackets ----------
  const BRACKET = () => /(?<![!\\])\[(\p{L}[^\[\]\n]{0,399})\](?![(:])/gu;
  const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g;
  const MASK = /^(?:Price|Statistic|Number|Amount|Figure|Percentage|Timeline|Date)$/i;
  const NOT_GAP = /^(?:sic!?|x| |emphasis (?:added|mine|ours)|(?:last )?(?:updated|revised|edited|reviewed|published)\b[^\]]*\d{4}|(?:19|20)\d\d)$/i;
  const bracketsIn = (md) => { const t = S(md).replace(CODE, (m) => ' '.repeat(m.length)); const out = [];
    for (const m of t.matchAll(BRACKET())) { const inner = m[1].trim(); if (!inner || /^image\s*:/i.test(inner) || NOT_GAP.test(inner)) continue; out.push({ token: m[0], inner, at: m.index }); }
    return out; };
  const questionFor = (inner, biz) => {
    const x = S(inner).replace(/^(?:author insight|confirm|owner)\s*:\s*/i, '').replace(/\s+/g, ' ').trim().replace(/[.;:,]+$/, '');
    if (/^author insight/i.test(inner)) return { kind: 'experience', question: 'From your own work: ' + x.charAt(0).toLowerCase() + x.slice(1) + '? One real example in a sentence or two is enough.' };
    if (/^case stud/i.test(x) || /case study/i.test(x)) return { kind: 'proof', question: 'Is there a client result you are happy to publish (with or without the client\'s name)? ' + x.replace(/^case study\s*:\s*/i, '') };
    if (/partner|certif|accredit|designation|award|iso\s?\d/i.test(x)) return { kind: 'credential', question: 'Please confirm for ' + biz + ': ' + x.charAt(0).toLowerCase() + x.slice(1) + '.' };
    if (/^date$/i.test(x)) return { kind: 'detail', question: '' };
    if (MASK.test(x) || /\b(price|fee|cost|rate|budget)\b/i.test(x)) return { kind: 'price', question: 'Do you want prices on this page? If so, give us the figure you are happy to publish.' };
    if (/\b(duration|timeline|weeks?|months?|how long)\b/i.test(x)) return { kind: 'timeline', question: 'Is there a typical timeline you are happy to publish? ' + x };
    return { kind: 'detail', question: 'Please give us this detail for the page: ' + x.charAt(0).toLowerCase() + x.slice(1) + '.' };
  };
  // a writer's [Confirm: ...] about a third party's product is research, not a client question
  const aboutBusiness = (inner, names) => { const t = S(inner).toLowerCase(); if (/\b(we|our|us|your business|the business|the client)\b/.test(t)) return true; return (names || []).some(n => n && t.includes(S(n).toLowerCase())); };

  // ---------- 5. the deterministic fixes (before every quality check) ----------
  // the keyword as the page itself writes its words ("Microsoft", "ERP"), the first word capitalised
  const caseLike = (kw, md) => S(kw).split(/\s+/).filter(Boolean).map((w, i) => {
    const forms = new Map(); for (const m of S(md).matchAll(new RegExp('(?<![\\p{L}\\p{N}])' + escRe(w) + '(?![\\p{L}\\p{N}])', 'giu'))) forms.set(m[0], (forms.get(m[0]) || 0) + 1);
    const best = [...forms.entries()].filter(([f]) => f !== f.toLowerCase()).sort((a, b) => b[1] - a[1])[0];
    const f = best ? best[0] : w; return i === 0 ? f.charAt(0).toUpperCase() + f.slice(1) : f; }).join(' ');
  const unmark = (md, marks, figures) => { let out = S(md);
    for (const s of (marks || [])) if (s) out = out.split('[Confirm: ' + s + ']').join(s);
    for (const f of (figures || [])) if (f) out = out.split('[Confirm: ' + f + ']').join(f);
    return out; };
  const fix = (md0, ctx) => {
    const c = ctx || {}; let md = S(md0); const fixes = [], removed = [];
    const kw = S(c.keyword).trim();
    const kwRe = !kw ? null : c.termRe ? c.termRe(kw, 'i') : new RegExp(escRe(kw).replace(/ /g, '[\\s-]+'), 'i');
    // a. the quality check's own [Confirm: ...] marks of an earlier round are taken off (the next check judges the words themselves); a
    //    writer's own [Confirm: ...] note is not one of them and goes with the brackets below
    const before = md;
    md = unmark(md, c.qa_marks, c.qa_figure_marks);
    if (md !== before) fixes.push('Took the review marks of the last check off the text (the next check reads the words themselves)');
    // b. brackets: none in the page. Each one goes, with the sentence that needs it; what only the client knows becomes a question
    const names = c.names || [];
    for (let guard = 0; guard < 60; guard++) {
      const bs = bracketsIn(md); if (!bs.length) break; const b = bs[0];
      const q = questionFor(b.inner, c.business || 'your business');
      const research = /^(confirm|owner)\s*:/i.test(b.inner) && !aboutBusiness(b.inner, names);
      const ls = md.lastIndexOf('\n', b.at - 1) + 1; let le = md.indexOf('\n', b.at); if (le < 0) le = md.length;
      const line = md.slice(ls, le);
      const alone = line.replace(b.token, '').replace(/^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*/, '').replace(/[*_\s.:;,]+/g, '') === '';
      const sentence = plain(md.slice(...span(md, b.at, b.token.length)));
      md = alone ? md.slice(0, ls) + md.slice(Math.min(md.length, le + 1)) : removeAt(md, b.at, b.token.length);
      removed.push({ token: b.token, sentence: alone ? '' : sentence, kind: research ? 'research' : q.kind, question: research || MASK.test(b.inner) && !/price/i.test(b.inner) ? '' : q.question, research: research ? b.inner.replace(/^(confirm|owner)\s*:\s*/i, '') : '' });
    }
    if (removed.length) fixes.push('Took ' + removed.length + ' bracket(s) out of the text with the words that needed them (' + removed.slice(0, 3).map(r => r.token.slice(0, 60)).join(', ') + (removed.length > 3 ? ' and ' + (removed.length - 3) + ' more' : '') + '): a page carries no brackets; what only you know is asked as a question instead');
    // c. meta lines
    const metaRe = (l) => new RegExp('^(' + l + '):[ \\t]*(.*)$', 'im');
    const tm = md.match(metaRe('Title')); let title = tm ? tm[2].trim() : '';
    const KW = kw ? (QUESTION_KW.test(kw) ? caseLike(kw, md) : titleCase(caseLike(kw, md))) : '';
    if (title && kwRe && !kwRe.test(title)) { const t2 = KW + ': ' + title; title = t2.length <= 60 ? t2 : KW + (c.business && (KW.length + 3 + S(c.business).length) <= 60 ? ' | ' + c.business : '');
      md = md.replace(metaRe('Title'), 'Title: ' + title); fixes.push('Put the keyword at the start of the meta title'); }
    if (title.length > 60) { const parts = title.split(/\s+[|\-:]\s+/); let t2 = parts[0]; for (const p of parts.slice(1)) { if ((t2 + ' | ' + p).length <= 60) t2 += ' | ' + p; else break; }
      if (t2.length > 60 || (kwRe && !kwRe.test(t2))) { t2 = title.slice(0, 60).replace(/\s+\S*$/, '').replace(/[\s|:,;&-]+$/, ''); }
      if (t2 && t2.length <= 60 && (!kwRe || kwRe.test(t2))) { md = md.replace(metaRe('Title'), 'Title: ' + t2); fixes.push('Shortened the meta title to ' + t2.length + ' characters'); title = t2; } }
    const dm = md.match(metaRe('Meta Description')); const desc = dm ? dm[2].trim() : '';
    if (desc.length > 155) { let d2 = desc.slice(0, 155); const lastStop = Math.max(d2.lastIndexOf('. '), d2.endsWith('.') ? d2.length - 1 : -1);
      d2 = lastStop >= 100 ? d2.slice(0, lastStop + 1) : d2.replace(/\s+\S*$/, '').replace(/[\s,;:&-]+$/, '') + '.';
      md = md.replace(metaRe('Meta Description'), 'Meta Description: ' + d2); fixes.push('Shortened the meta description to ' + d2.length + ' characters'); }
    const sm = md.match(metaRe('Slug'));
    if (sm && !c.planned_slug) { const s0 = sm[2].trim(); const s1 = s0.toLowerCase().replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (s1 && s1 !== s0.replace(/^\/+|\/+$/g, '')) { md = md.replace(metaRe('Slug'), 'Slug: ' + s1); fixes.push('Wrote the slug as lowercase words joined by hyphens (' + s1 + ')'); } }
    // d. the keyword in the H1 and, for a question keyword, as the first words of the introduction
    const h1m = md.match(/^# (.+)$/m);
    if (h1m && kwRe && !kwRe.test(h1m[1])) {
      const q = QUESTION_KW.test(kw); const h = q ? KW.replace(/\?*$/, '?') : (KW + ': ' + h1m[1]).length <= 90 ? KW + ': ' + h1m[1] : '';
      if (h) { md = md.replace(/^# .+$/m, '# ' + h); fixes.push('Put the keyword in the H1'); }
    }
    {
      const sp = split(md); const s0 = sp.parts[0];
      if (s0 && kwRe && QUESTION_KW.test(kw)) { const body = s0.text.replace(/^# .*$/m, ''); const first = plain(body).split(/\s+/).slice(0, 100).join(' ');
        if (!kwRe.test(first)) { const lines = s0.text.split('\n'); const pi = lines.findIndex((l, i) => i > 0 && l.trim() && !/^(#|!\[|\[Image|\*\*\s*Quick answer)/i.test(l.trim()));
          if (pi > 0) { lines[pi] = KW.replace(/\?*$/, '?') + ' ' + lines[pi].trim(); s0.text = lines.join('\n'); md = join(sp); fixes.push('Opened the introduction with the question the page answers, so the keyword is in its first 100 words'); } } }
    }
    // e. the Quick answer within the first 120 words under the H1 (60 for an AI answer target)
    {
      const limit = c.ai_target ? 60 : 120; const sp = split(md); const s0 = sp.parts[0];
      if (s0) { const lines = s0.text.split('\n'); const qi = lines.findIndex(l => /^\**\s*Quick answer:?\**/i.test(l.trim()));
        if (qi > 0) { const beforeQ = plain(lines.slice(1, qi).filter(l => !/^#/.test(l)).join(' ')); const n = words(beforeQ);
          if (n > limit) { const qa = lines.splice(qi, 1)[0]; let pi = lines.findIndex((l, i) => i > 0 && l.trim() && !/^(#|!\[|\[Image)/i.test(l.trim())); let pe = pi; while (pe >= 0 && pe < lines.length && lines[pe].trim()) pe++;
            if (pi > 0) { lines.splice(pe, 0, '', qa, ''); s0.text = lines.join('\n'); md = join(sp); fixes.push('Moved the Quick answer up to right after the first paragraph (it came after ' + n + ' words)'); } } } }
    }
    // f. a snippet question from the brief becomes the heading it already nearly is
    for (const st of (c.snippet_targets || [])) { const qn = plain(st && st.question).replace(/\?*$/, '?'); if (!qn || qn.length < 8) continue;
      if (new RegExp('^#{2,3}\\s*' + escRe(qn.replace(/\?$/, '')), 'im').test(md)) continue;
      const heads = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(m => ({ lvl: m[1], text: m[2], at: m.index, full: m[0] }));
      const best = heads.map(h => ({ h, s: Math.min(overlap(qn, h.text), overlap(h.text, qn)) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)[0];
      if (best && plain(best.h.text).replace(/\?$/, '').toLowerCase() !== qn.replace(/\?$/, '').toLowerCase()) { md = md.slice(0, best.h.at) + best.h.lvl + ' ' + qn + md.slice(best.h.at + best.h.full.length); fixes.push('Phrased the heading "' + plain(best.h.text) + '" as the question the brief targets: "' + qn + '"'); } }
    // g. internal links: none in the page, and a live page of the site whose name the text already uses: link the first mention
    if (c.domain && Array.isArray(c.internal_links) && c.internal_links.length) {
      const own = [...md.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].filter(m => m[1].startsWith('/') || hostOf(m[1]) === S(c.domain).replace(/^www\./, '') || hostOf(m[1]).endsWith('.' + S(c.domain).replace(/^www\./, ''))).length;
      if (!own) { let added = 0; const sp = split(md);
        for (const l of c.internal_links) { if (added >= 2) break; const anchor = S(l && (l.anchor || l.title)).trim(); const url = S(l && l.url).trim(); if (!anchor || anchor.length < 6 || !/^https?:\/\//.test(url)) continue;
          for (const p of sp.parts.slice(1)) { const re = new RegExp('(^|[^\\[\\w])(' + escRe(anchor) + ')(?![\\w\\]])', 'i'); const lines = p.text.split('\n'); let hit = false;
            for (let i = 1; i < lines.length && !hit; i++) { if (/^(#|\||!\[)/.test(lines[i].trim()) || /\[[^\]]*$/.test(lines[i])) continue; const m = lines[i].match(re);
              if (m && !/\]\(/.test(lines[i].slice(m.index, m.index + m[0].length + 3))) { lines[i] = lines[i].slice(0, m.index + m[1].length) + '[' + m[2] + '](' + url + ')' + lines[i].slice(m.index + m[0].length); hit = true; } }
            if (hit) { p.text = lines.join('\n'); added++; break; } } }
        if (added) { md = join(sp); fixes.push('Linked ' + added + ' mention(s) of the site\'s own live pages'); } }
    }
    // h0. H2: the legal name is not the brand: a "(legal name: ...)" note after the brand goes everywhere, and the legal name itself never
    //     stands in the title, the meta description or a heading (the display name does)
    { const before0 = md; md = md.replace(/\s*\(\s*(?:legal(?:ly)?(?: name)?|registered(?: name| as)?)\s*[:=-]?[^)\n]*\)/gi, '');
      if (c.legal_name && c.brand) md = md.replace(/^(Title:|Meta Description:|#{1,6} ).*$/gim, (line) => line.split(c.legal_name).join(S(c.brand)));
      if (md !== before0) fixes.push('Wrote the business name as "' + S(c.brand) + '" where the legal name or a "(legal name: ...)" note stood in the title, a heading or a sentence'); }
    // h. the brand as the business writes it: a wrong form outside the stored name (and outside a legal name) is corrected
    if (c.brand && (c.wrong_forms || []).length) { const brand = S(c.brand).replace(/\s*\([^)]*\)\s*$/, '').trim(); const keep = [...(c.keep_forms || []), S(c.brand)].filter(Boolean);
      let n = 0; const masked = []; let t = md; keep.sort((a, b) => b.length - a.length).forEach((k, i) => { t = t.split(k).join('\u0000' + i + '\u0000'); masked.push(k); });
      for (const w of c.wrong_forms) { if (!w || w.length < 3) continue; const re = new RegExp('(^|[^\\p{L}\\p{N}@./-])(' + escRe(w) + ')(?![\\p{L}\\p{N}@-]|\\.[a-z])', 'giu');
        t = t.replace(re, (m0, pre) => { n++; return pre + brand; }); }
      t = t.replace(/\u0000(\d+)\u0000/g, (m0, i) => masked[Number(i)]);
      if (n) { md = t; fixes.push('Wrote the business name as "' + brand + '" in ' + n + ' place(s)'); } }
    return { md: tidy(md), fixes, removed };
  };

  // ---------- 6. blocking vs advisory ----------
  const brandHits = (md, ctx) => { const c = ctx || {}; if (!c.brand || !(c.wrong_forms || []).length) return 0; let t = S(md);
    [S(c.brand), ...(c.keep_forms || [])].filter(Boolean).sort((a, b) => b.length - a.length).forEach(k => { t = t.split(k).join(' '); });
    t = t.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ').replace(/\S+@\S+/g, ' ');
    let n = 0; for (const w of c.wrong_forms) { if (!w || w.length < 3) continue; n += (t.match(new RegExp('(^|[^\\p{L}\\p{N}.@/-])' + escRe(w) + '(?![\\p{L}\\p{N}@-]|\\.[a-z])', 'giu')) || []).length; } return n; };
  // a testimonial: a quoted sentence with a person's attribution that nothing on file carries (FTC rule on fake reviews, 2024)
  const testimonials = (md, own) => { const out = []; const O = S(own).toLowerCase();
    for (const m of S(md).matchAll(/(?:^>\s*)?["\u201C]([^"\u201D\n]{25,400})["\u201D]\s*(?:[-\u2013\u2014,]\s*|\n>?\s*[-\u2013\u2014]\s*)([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,3})(?:,\s*([^\n]{2,80}))?/gmu)) {
      const quote = m[1].trim(); if (O && O.includes(quote.toLowerCase().slice(0, 60))) continue; out.push({ quote: quote.slice(0, 200), who: m[2], text: m[0] }); }
    return out; };
  const W = (s) => clean(S(s));
  const classify = (qa0, md, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const blocking = [], advisory = [];
    const B = (code, text, tier, extra) => blocking.push({ code, text: W(text), tier, ...(extra || {}) });
    const A = (code, text, w) => advisory.push({ code, text: W(text), w: Number(w) || 0 });
    // hard: the system cannot make these go away by itself
    if (qa.cut_off) B('cut_off', 'The page stops before its end, so it cannot be published as it is', 'hard', { weight: 10 });
    const orig = qa.originality || {};
    if (orig.passed === false) { const f = (orig.failing || orig.worst || {}); B('copied', 'Part of the text repeats another page word for word' + (f.source ? ' (' + f.source + (f.overlap_pct != null ? ', ' + f.overlap_pct + '%' : '') + ')' : ''), 'hard'); }
    const dup = Array.isArray(orig.duplicate_targets) ? orig.duplicate_targets : [];
    if (dup.length) B('duplicate_page', 'This website already has a page for the same search: ' + dup.map(x => x.url).slice(0, 2).join(', ') + '. Publish this text as an update of that page, or tell us how the new page differs', 'hard', { urls: dup.map(x => x.url) });
    const brandWarn = (qa.warnings || []).find(w => /^Brand name:/.test(S(w)));
    const bh = brandWarn ? (c.brand ? brandHits(md, c) : 1) : 0;
    if (bh) B('brand', 'The business name is written in a form you do not use (' + bh + ' place' + (bh === 1 ? '' : 's') + ')', 'hard');
    if (Number(qa.profile_placeholders) > 0) B('author_profile', 'The author box needs the author\'s details (name, job title, short bio): add them once to the business profile', 'hard');
    // soft: facts and trust. The system rewrites or removes each one itself before delivery (PF.neutralize)
    const promises = (qa.business_promises || []).concat(qa.business_claims || []).filter(p => p && p.sentence);
    for (const p of promises) B('claim', 'A statement about the business that nothing on file supports: "' + plain(p.sentence).slice(0, 160) + '"', 'soft', { sentence: p.sentence, kind: p.kind || '', rewrite: p.rewrite || null });
    for (const f of (qa.unverified_figures || [])) B('figure', 'A figure its cited source does not state: "' + S(f.figure) + '"' + ((f.sources || []).length ? ' (' + f.sources.join(', ') + ')' : ''), 'soft', { figure: S(f.figure) });
    for (const a of (qa.flagged_amounts || [])) B('figure', 'An amount no source on file states: "' + S(a.amount) + '"', 'soft', { figure: S(a.amount) });
    for (const s of (qa.unverified_statistics || [])) B('statistic', 'A number with no source: "' + S(s) + '"', 'soft', { stat: S(s) });
    const marks = new Set(promises.map(p => '[Confirm: ' + p.sentence + ']').concat((qa.unverified_figures || []).map(f => '[Confirm: ' + f.figure + ']')).concat((qa.flagged_amounts || []).map(a => '[Confirm: ' + a.amount + ']')));
    for (const b of bracketsIn(md)) { if (marks.has(b.token)) continue; B('bracket', 'A bracket left in the text: ' + b.token.slice(0, 120), 'soft', { token: b.token }); }
    for (const x of ((qa.link_check || {}).dead || [])) B('dead_link', 'A link to a missing page: ' + S(x.url), 'soft', { url: S(x.url) });
    for (const x of (qa.excluded_sections || [])) B('off_topic', 'A section about a topic the verdict said to leave out: "' + S(x.heading).replace(/^#+\s*/, '') + '"', 'soft', { heading: S(x.heading) });
    const guar = (qa.warnings || []).find(w => /^Contains a guarantee claim/.test(S(w)));
    if (guar) { const m = S(guar).match(/"([^"]{5,200})"/); B('guarantee', 'A guarantee nothing on file states' + (m ? ': "' + m[1] + '"' : ''), 'soft', { quote: m ? m[1] : '' }); }
    for (const t of testimonials(md, c.own_text)) B('testimonial', 'A testimonial nothing on file carries: "' + t.quote.slice(0, 100) + '" (' + t.who + ')', 'soft', { text: t.text });
    // advisory: never blocks, weighted by how far the page is from its target
    const words0 = Number(qa.main_content_words) || 0; const LB = qa.length_band || null;
    const low = LB ? Number(LB.low) : Math.round((Number(qa.target_word_count) || 0) * 0.8), high = LB ? Number(LB.high) : Math.round((Number(qa.target_word_count) || 0) * 1.25);
    if (low && words0 < low) A('length', 'The main content is ' + words0 + ' words, under the ' + low + '-' + high + ' band of the pages that rank', 4 * (low - words0) / low);
    if (high && words0 > high) A('length', 'The main content is ' + words0 + ' words, over the ' + low + '-' + high + ' band of the pages that rank', 4 * (words0 - high) / high);
    const cp = Number(qa.coverage_pct), ct = Number(qa.coverage_target_pct);
    if (ct && cp < ct) A('coverage', 'Topic coverage ' + cp + '% against ' + ct + '% for the best page that ranks (terms missing: ' + (qa.missing_terms || []).slice(0, 6).join(', ') + ')', (ct - cp) / 10);
    if ((qa.missing_subtopics || []).length) A('subtopics', 'Subtopics the best page covers and this one does not: ' + qa.missing_subtopics.slice(0, 4).join('; '), Math.min(1, 0.25 * qa.missing_subtopics.length));
    const warn = (re) => (qa.warnings || []).filter(w => re.test(S(w)));
    const ADV = [[/^Primary keyword missing from the meta title/, 'kw_title', 0.5], [/^Primary keyword missing from H1/, 'kw_h1', 0.5], [/^Primary keyword not in the first 100 words/, 'kw_first100', 0.5],
      [/^Primary keyword used only/, 'kw_count', 0.25], [/^Keyword density is high/, 'kw_density', 0.5], [/^Meta title/, 'meta_title', 0.25], [/^Meta description/, 'meta_desc', 0.25], [/^Slug should/, 'slug', 0.25],
      [/^H1 missing/, 'h1', 1], [/^Only \d+ H2 sections/, 'h2', 0.5], [/^Quick answer block missing/, 'quick_answer', 1], [/^Quick answer is/, 'quick_answer_len', 0.25], [/^Answer first|^AI target: move the Quick answer/, 'answer_first', 0.5],
      [/^Only \d+ question\(s\) answered|^Phrase at least 2|^AI target: phrase/, 'question_headings', 0.5], [/^Snippet questions/, 'snippets', 0.5], [/^AI target: give these searches/, 'fanout', 0.5],
      [/^Comparison table missing/, 'table', 0.25], [/^The call to action should be the last/, 'cta_last', 0.5], [/^Sections far below/, 'thin', 0.25], [/^No internal links/, 'internal_links', 0.5],
      [/^Filler/, 'filler', 0.25], [/^Hard to read|sentences longer than|^Passive voice/, 'style', 0.1], [/^Too generic/, 'generic', 0.25], [/^External links to sources not in the evidence plan/, 'sources', 0.25],
      [/^A source with no independent authority/, 'weak_source', 0.25], [/^Topic coverage is thin/, 'coverage', 1], [/^Originality: \d+% of this draft also appears/, 'overlap_note', 0.1], [/^Too many placeholders/, 'placeholders', 0]];
    for (const [re, code, w] of ADV) for (const x of warn(re)) A(code, S(x).replace(/\s*\(the band of[^)]*\)\)?/, ''), w);
    const hard = blocking.filter(b => b.tier === 'hard').reduce((s, b) => s + (b.weight || 1), 0);
    const soft = blocking.filter(b => b.tier === 'soft').length;
    const adv = +advisory.reduce((s, a) => s + a.w, 0).toFixed(3);
    return { blocking, advisory, hard, soft, adv, words: words0, band: low ? { low, high } : null };
  };
  const score = (cls) => ({ hard: cls.hard, soft: cls.soft, adv: cls.adv });
  // what an edit may never lose, whatever else it fixes (R1 rec. 1): the call to action, the Quick answer, the sections, the length floor
  const protect = (md, qa, ctx) => { const sp = split(md); const last = sp.parts[sp.parts.length - 1]; const c = ctx || {};
    const d = S(c.domain).replace(/^www\./, '');
    const ctaLink = !!last && last.id !== 's0' && (/\]\((\/|https?:\/\/)/.test(last.text) && (!d || [...last.text.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].some(m => m[1].startsWith('/') || hostOf(m[1]) === d || hostOf(m[1]).endsWith('.' + d))));
    return { cta: ctaLink, quick_answer: /^\**\s*Quick answer:?\**/im.test(md), h2: sp.parts.length - 1, words: Number((qa || {}).main_content_words) || words(md) }; };
  const lostProtected = (a, b, band) => { const out = [];
    if (b.cta && !a.cta) out.push('the call to action'); if (b.quick_answer && !a.quick_answer) out.push('the Quick answer');
    if (b.h2 >= 3 && b.h2 - a.h2 >= 2) out.push((b.h2 - a.h2) + ' sections');
    if (band && band.low && b.words >= band.low * 0.9 && a.words < band.low * 0.75) out.push('a third of its length');
    return out; };
  // ONE comparison: is candidate `a` strictly better than `b`? A lost protected property makes it worse, whatever else it fixed
  const better = (a, b) => { if (!b) return { better: true, why: 'the first draft' };
    const lost = lostProtected(a.protect || {}, b.protect || {}, (a.cls || {}).band || (b.cls || {}).band);
    if (lost.length) return { better: false, why: 'it lost ' + lost.join(', ') };
    const x = a.score, y = b.score;
    if (x.hard !== y.hard) return { better: x.hard < y.hard, why: x.hard < y.hard ? 'fewer problems the system cannot fix itself (' + x.hard + ' against ' + y.hard + ')' : 'more problems the system cannot fix itself (' + x.hard + ' against ' + y.hard + ')' };
    if (x.soft !== y.soft) return { better: x.soft < y.soft, why: (x.soft < y.soft ? 'fewer' : 'more') + ' unsupported statements, figures, brackets or links (' + x.soft + ' against ' + y.soft + ')' };
    if (x.adv < y.adv - 0.05) return { better: true, why: 'closer to the targets of the pages that rank (' + x.adv + ' against ' + y.adv + ')' };
    return { better: false, why: x.adv > y.adv + 0.05 ? 'further from the targets of the pages that rank (' + x.adv + ' against ' + y.adv + ')' : 'no better than the draft it was given' }; };

  // ---------- 7. the section-targeted edit job ----------
  const plan = (md, cls, qa0, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const sp = split(md); const jobs = new Map();
    const add = (part, problem, weight) => { if (!part) return; const j = jobs.get(part.id) || { id: part.id, heading: part.heading, text: part.text, problems: [], weight: 0 }; const p = W(problem); if (!j.problems.includes(p)) { j.problems.push(p); j.weight += weight || 1; } jobs.set(part.id, j); };
    const at = (needle) => { const i = S(md).indexOf(S(needle)); return i < 0 ? null : partAt(sp, i); };
    const related = (text) => { const ranked = sp.parts.slice(1).filter(p => !isCta(sp, p)).map(p => ({ p, s: overlap(text, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s); return ranked.length ? ranked[0].p : sp.parts[0]; };
    for (const b of cls.blocking) {
      if (b.code === 'claim') { const rw = b.rewrite || {}; add(at(b.sentence), 'Rewrite as advice to the reader or as a neutral fact about the topic, or delete it (nothing on file says the business does this; never "we do" or "our process"): "' + plain(b.sentence).slice(0, 220) + '"'
        + (rw.action === 'reword' && rw.neutral ? '. A neutral wording that works: "' + plain(rw.neutral).slice(0, 220) + '"' : rw.action === 'delete' ? '. It adds nothing the reader can use: delete it' : ''), 3); }
      else if (b.code === 'figure') add(at(b.figure), 'The figure "' + b.figure + '" is not in the source the sentence cites: quote the number one of the SOURCES YOU MAY CITE states, with that link, or rewrite the sentence without the number', 2);
      else if (b.code === 'statistic') add(at(b.stat), 'The number "' + b.stat + '" has no source: cite one of the SOURCES YOU MAY CITE that states it, or rewrite the sentence without it', 2);
      else if (b.code === 'guarantee' && b.quote) add(at(b.quote.slice(0, 40)), 'Remove the guarantee or reword it so it promises nothing: "' + b.quote + '"', 2);
      else if (b.code === 'testimonial') add(at(b.text), 'Remove this testimonial: nothing on file says a client said it', 3);
      else if (b.code === 'copied') { const ps = ((qa.originality || {}).failing || {}).passages || []; for (const p of ps.slice(0, 3)) add(at(S(p.text).slice(0, 60)) || related(p.text), 'This passage repeats another page word for word; rewrite it in our own words, order and examples: "' + S(p.text).slice(0, 160) + '"', 3); }
    }
    const advCodes = new Set(cls.advisory.map(a => a.code));
    // length: cut from the sections furthest over their outline target, or expand the thinnest, with a number for each
    const LB = cls.band; const w0 = cls.words; const outline = c.outline || [];
    const target = (h) => { const o = outline.find(x => x && plain(x.h2).toLowerCase() === S(h).toLowerCase()); return o ? Number(o.target_words) || 0 : 0; };
    const body = sp.parts.slice(1).filter(p => !isCta(sp, p)).map(p => ({ p, words: words(plain(p.text)), target: target(p.heading) }));
    let length_note = '';
    if (LB && w0 > LB.high) { let need = w0 - LB.high; length_note = 'The page is ' + w0 + ' words, ' + need + ' over the ' + LB.low + '-' + LB.high + ' band: the sections below carry the cut.';
      for (const x of body.sort((a, b) => ((b.words - b.target) - (a.words - a.target)) || (b.words - a.words))) { if (need <= 0) break; const cut = Math.min(need, Math.max(40, Math.round(x.words * 0.35)));
        add(x.p, 'Cut about ' + cut + ' words (this section has ' + x.words + '): take out repetition and secondary detail; keep every fact with its source, every link and every heading', 1); need -= cut; } }
    else if (LB && w0 < LB.low) { let need = LB.low - w0; length_note = 'The page is ' + w0 + ' words, ' + need + ' under the ' + LB.low + '-' + LB.high + ' band: the sections below carry the extra depth.';
      for (const x of body.sort((a, b) => (a.words - (a.target || a.words)) - (b.words - (b.target || b.words)) || a.words - b.words)) { if (need <= 0) break; const more = Math.min(need, Math.max(60, Math.round((x.target || x.words) * 0.5)));
        add(x.p, 'Add about ' + more + ' words of specific, useful detail (an example, a step, a decision rule, a trade-off); never filler and never a fact that is not on file or in the sources', 1); need -= more; } }
    if (advCodes.has('coverage')) { const by = new Map(); for (const t of (qa.missing_terms || []).slice(0, 10)) { const p = related(t); const l = by.get(p.id) || { p, terms: [] }; l.terms.push(t); by.set(p.id, l); }
      for (const l of by.values()) add(l.p, 'Work these terms in where they belong, with substance around them: ' + l.terms.slice(0, 4).join(', '), 0.5); }
    if (advCodes.has('subtopics') && Number(qa.coverage_pct) < Number(qa.coverage_target_pct || 0)) for (const s of (qa.missing_subtopics || []).slice(0, 3)) add(related(s), 'Give this subtopic a paragraph or an H3 inside this section, in our own words: "' + s + '"', 0.5);
    const unanswered = (() => { const w = (qa.warnings || []).find(x => /^Snippet questions/.test(S(x))); return w ? S(w).replace(/^[^:]+:\s*/, '').split(' | ').map(x => x.trim()).filter(Boolean) : []; })();
    for (const q of unanswered.slice(0, 3)) add(related(q), 'Add an H3 "' + q + '" with a 40-60 word direct answer right under it', 0.75);
    const s0 = sp.parts[0];
    if (advCodes.has('quick_answer')) add(s0, 'Add a line starting with **Quick answer:** right after the introduction: 40-70 words that answer the page\'s question directly, no brackets', 1);
    if (advCodes.has('quick_answer_len')) add(s0, 'Bring the **Quick answer:** line to 40-70 words', 0.5);
    if (advCodes.has('kw_first100')) add(s0, 'Use the exact phrase "' + S(c.keyword) + '" once in the first two sentences of the introduction, naturally', 0.5);
    if (advCodes.has('question_headings')) { const flat = body.filter(x => !QUESTION_KW.test(x.p.heading)).slice(0, 2); for (const x of flat) add(x.p, 'Phrase this section\'s heading as the question a reader asks, and answer it in the 40-60 words right under it', 0.5); }
    if (advCodes.has('table') && body.length) { const p = related('compare comparison options versus choose which fits'); add(p, 'Add a small Markdown comparison table of what the reader can check for themselves (what each option covers, who it suits); no price or timeline column unless the facts state them', 0.25); }
    const filler = (qa.banned_phrases || []).map(b => b.phrase); for (const f of filler.slice(0, 6)) { const p = at(f); if (p) add(p, 'Rewrite the sentence with "' + f + '" in plain, specific words', 0.25); }
    // the Critic's review of the first draft: its high and medium problems for the sections already being edited, and its high ones anywhere
    const crit = (c.critique && Array.isArray(c.critique.problems)) ? c.critique.problems : [];
    for (const p of crit) { if (!p || !/high|medium/i.test(S(p.severity))) continue; const fixText = S(p.fix);
      if (/\b(placeholder|bracket|\[to confirm|confirm at|flagged for confirmation)\b/i.test(fixText + ' ' + S(p.issue))) continue;   // the contract: no brackets
      const part = p.location ? at(plain(S(p.location)).slice(0, 40)) || (overlap(p.location, md) > 0.6 ? related(p.location) : null) : null;
      if (!part || (!jobs.has(part.id) && !/high/i.test(S(p.severity)))) continue;
      add(part, 'Reviewer: ' + S(p.issue).replace(/[.;:]+$/, '') + (fixText ? '. Suggested fix: ' + fixText : '') + ' (apply it as advice to the reader; add no claim about the business and no number that is not in the sources)', /high/i.test(S(p.severity)) ? 0.75 : 0.25); }
    const sections = [...jobs.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const MAXS = 7; const chosen = sections.length > MAXS ? sections.slice().sort((a, b) => b.weight - a.weight).slice(0, MAXS).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))) : sections;
    return { sections: chosen.map(j => ({ id: j.id, heading: j.heading, text: j.text, problems: j.problems.slice(0, 12), cta: isCta(sp, sp.parts.find(p => p.id === j.id)) })),
      left_out: sections.length - chosen.length, length_note, page_words: w0, band: LB };
  };

  // ---------- 8. the editor's answer, merged back ----------
  const parseSections = (answer) => { const t = S(answer).replace(/\r/g, ''); const out = new Map(); const open = [];
    const re = /^=== SECTION (s\d+) ===[ \t]*\n([\s\S]*?)\n=== END \1 ===[ \t]*$/gm; let m;
    while ((m = re.exec(t))) out.set(m[1], m[2].replace(/^\n+|\s+$/g, ''));
    for (const s of t.matchAll(/^=== SECTION (s\d+) ===/gm)) if (!out.has(s[1])) open.push(s[1]);
    return { blocks: out, unfinished: open, marked: /^=== SECTION s\d+ ===/m.test(t) }; };
  // the external links the edit may use: the ones already in the page, the evidence plan, the run's facts, the verified sources
  const merge = (base, job, answer, opts) => {
    const o = opts || {}; const sp = split(base); const P = parseSections(answer); const log = { replaced: [], kept: [], unlinked: [], unfinished: P.unfinished.slice() };
    const allowed = new Set([...(o.allowed_urls || []), ...[...S(base).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1])].map(keyOf));
    const d = S(o.domain).replace(/^www\./, '');
    for (const j of (job.sections || [])) {
      const part = sp.parts.find(p => p.id === j.id); if (!part) continue;
      let t = P.blocks.has(j.id) ? P.blocks.get(j.id) : null;
      if (t == null || !t.trim() || P.unfinished.includes(j.id)) { log.kept.push(j.id); continue; }
      if (j.id === 's0') { if (!/^# /m.test(t)) { const h1 = (part.text.match(/^# .*$/m) || [''])[0]; if (h1) t = h1 + '\n\n' + t; } }
      else if (!/^## /.test(t)) t = part.text.split('\n')[0] + '\n\n' + t;
      // guessed URLs never survive: an external link that is neither in the page already nor in the sources of this run is unlinked
      t = t.replace(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m0, a, u) => { const h = hostOf(u); if ((d && (h === d || h.endsWith('.' + d))) || allowed.has(keyOf(u))) return m0; log.unlinked.push(u); return a; });
      const trail = (part.text.match(/\s*$/) || [''])[0] || '\n\n';
      part.text = t.replace(/\s+$/, '') + (trail.includes('\n\n') ? trail : '\n\n');
      log.replaced.push(j.id);
    }
    // the page's last line keeps its ending whitespace exactly as before
    const out = join(sp);
    return { md: /\n$/.test(S(base)) || !out.endsWith('\n\n') ? out : out.replace(/\n+$/, ''), log, marked: P.marked };
  };

  // ---------- 9. the system's own neutral rewrite ----------
  const unlinkDead = (md, dead, suggestions) => { let out = S(md); const done = [];
    for (const x of (dead || [])) { const u = S(x.url); if (!u) continue; const sug = S((suggestions || {})[u] || x.suggestion || '');
      const re = new RegExp('\\[([^\\[\\]]+)\\]\\(' + escRe(u) + '\\)', 'g'); let n = 0;
      out = out.replace(re, (m0, a) => { n++; return sug && /^https?:\/\//.test(sug) ? '[' + a + '](' + sug + ')' : a; });
      if (n) done.push({ url: u, replaced_with: sug && /^https?:\/\//.test(sug) ? sug : '', count: n }); }
    return { md: out, done }; };
  const deleteSection = (md, heading) => { const sp = split(md); const h = plain(S(heading).replace(/^#+\s*/, '')).toLowerCase();
    let hit = false; sp.parts = sp.parts.filter(p => { if (p.id !== 's0' && p.heading.toLowerCase() === h) { hit = true; return false; } return true; });
    if (!hit) { const re = new RegExp('^(#{3,4})\\s+' + escRe(S(heading).replace(/^#+\s*/, '').trim()) + '\\s*$', 'm'); const src = S(md); const m = src.match(re);
      if (m) { const lvl = m[1].length; const a = m.index; const rest = src.slice(a + m[0].length); const nx = rest.search(new RegExp('^#{1,' + lvl + '}\\s', 'm')); const b = nx < 0 ? src.length : a + m[0].length + nx; return { md: src.slice(0, a) + src.slice(b), done: true }; }
      return { md, done: false }; }
    return { md: join(sp), done: true }; };
  const neutralize = (md0, cls, ctx) => {
    const c = ctx || {}; let md = S(md0); const removed = [];
    const take = (b, r) => { if (r.done) removed.push({ code: b.code, sentence: b.sentence || b.figure || b.stat || b.token || b.heading || b.url || b.quote || '', kind: b.kind || '', how: r.how || 'removed', text: r.text || '', rewrite: b.rewrite || null }); return r.md; };
    for (const b of cls.blocking.filter(x => x.tier === 'soft')) {
      if (b.code === 'claim') md = take(b, neutralSentence(md, b.sentence, c.domain, b.rewrite));
      else if (b.code === 'figure') { const tok = '[Confirm: ' + b.figure + ']'; const i = md.indexOf(tok) >= 0 ? md.indexOf(tok) : md.indexOf(b.figure); if (i >= 0) md = take(b, { md: removeAt(md, i, md.indexOf(tok) >= 0 ? tok.length : b.figure.length), done: true }); }
      else if (b.code === 'statistic') { const i = md.indexOf(b.stat); if (i >= 0) md = take(b, { md: removeAt(md, i, b.stat.length), done: true }); }
      else if (b.code === 'bracket') { const i = md.indexOf(b.token); if (i >= 0) md = take(b, { md: removeAt(md, i, b.token.length), done: true }); }
      else if (b.code === 'dead_link') { const r = unlinkDead(md, [{ url: b.url }], {}); md = take(b, { md: r.md, done: r.done.length > 0, how: 'unlinked' }); }
      else if (b.code === 'off_topic') md = take(b, deleteSection(md, b.heading));
      else if (b.code === 'guarantee' && b.quote) { const i = md.indexOf(b.quote.slice(0, 60)); if (i >= 0) md = take(b, { md: removeAt(md, i, Math.min(60, b.quote.length)), done: true }); }
      else if (b.code === 'testimonial') { const r = removeText(md, b.text); md = take(b, r); }
    }
    // [Price] and other masks the quality check left go with their sentence too
    for (let g = 0; g < 40; g++) { const bs = bracketsIn(md); if (!bs.length) break; const b = bs[0]; md = removeAt(md, b.at, b.token.length); removed.push({ code: 'bracket', sentence: b.token, how: 'removed' }); }
    return { md: tidy(md), removed };
  };

  // ---------- 10. the client questions and the delivered status ----------
  // Owner decision (2026-10-28): EVERY statement about the business that nothing on file supports becomes a client question, with the
  // original specific sentence, the neutral wording the page carries until the client answers, and the choices yes (keep the specific
  // sentence) / edit (the client's own wording) / remove. Every other question that would genuinely strengthen the page (proof, numbers,
  // experience, credentials) is asked too. No limit: ranked by impact. Nothing blocks: an unanswered question leaves the page as it is.
  // Each question names the business-fact key its answer fills, so the answer is stored once and a later page never asks it again
  // (`stored` = the keys already on file), and is prefilled from the client's own pages or stored facts when they say something close.
  const CATEGORY = { proof: 'proof', experience: 'experience', credential: 'credential', deliverable: 'service', process: 'service', scope: 'service', terms: 'service',
    timeline: 'timeline', pricing: 'pricing', price: 'pricing', guarantee: 'guarantee', detail: 'detail', other: 'detail' };
  const IMPACT = { proof: 0.9, experience: 0.85, credential: 0.8, guarantee: 0.75, service: 0.7, pricing: 0.55, timeline: 0.55, detail: 0.45 };
  const slug = (t, n) => toks(plain(t)).filter(w => !/^\d+$/.test(w)).slice(0, n || 6).join('_').replace(/[^\p{L}\p{N}_&]+/gu, '').slice(0, 60) || 'item';
  const factKey = (category, text) => category + '.' + slug(text);
  // the closest thing the client's own pages or stored facts already say: a sentence sharing at least half of the question's key words
  const prefillOf = (text, docs) => { let best = null;
    for (const d of (docs || [])) { const body = S(d && d.text); if (!body.trim()) continue;
      for (const sent of body.split(/(?<=[.!?])\s+|\n+/)) { const t = plain(sent); if (t.length < 15 || t.length > 320) continue; const sc = Math.max(overlap(text, t), overlap(t, text));
        if (sc >= 0.5 && (!best || sc > best.score)) best = { prefill: t, source: S(d.source), score: +sc.toFixed(2) }; } }
    return best; };
  // the sentence in the delivered page that took the specific one's place (the editor's neutral rewrite), else none (left out)
  const neutralIn = (finalMd, sentence) => { let best = null;
    for (const sent of S(finalMd).split(/(?<=[.!?])\s+|\n+/)) { const t = plain(sent); if (t.length < 15 || /^#/.test(sent.trim())) continue; const sc = Math.min(overlap(sentence, t), overlap(t, sentence) + 0.2);
      if (sc >= 0.45 && (!best || sc > best.score)) best = { text: t, score: sc }; }
    return best ? best.text : ''; };
  const questions = (o) => {
    const x = o || {}; const biz = S(x.business || 'your business'); const stored = new Set((x.stored || []).map(S));
    const out = []; const seen = new Set();
    const push = (q) => { const k = q.fact_key + '|' + S(q.original || q.question).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
      if (seen.has(k) || seen.has(q.fact_key + '|') || stored.has(q.fact_key)) return; seen.add(k); out.push(q); };
    for (const c of (x.claims || [])) { if (!c || !c.sentence) continue; const kind = S(c.kind || 'process'); const cat = CATEGORY[kind] || 'service';
      const rw = c.rewrite || {};
      const original = clean(plain(c.sentence)); const neutral = c.neutral != null ? clean(c.neutral) : neutralIn(x.final_md, c.sentence);
      const pre = rw.suggestion ? { prefill: clean(plain(rw.suggestion)), source: 'your website or business facts' } : prefillOf(original, x.docs);
      push({ kind, category: cat, fact_key: factKey(cat, original), source: 'claim', blocks: false, action: rw.action || '', needs_client_fact: rw.needs_client_fact !== false,
        question: clean(rw.question ? rw.question : 'Is this true for ' + biz + '? "' + original + '"'),
        why: 'Nothing on file says it, so the page does not claim it' + (neutral ? ': it says "' + neutral.slice(0, 200) + '" instead' : ': it leaves it out') + '. Say yes and the specific sentence goes back in, and later pages can say it too.',
        original, neutral, in_page: neutral ? (c.how === 'cta' ? 'cta' : 'neutral') : 'left_out', section: S(c.section || ''),
        choices: ['yes', 'edit', 'remove'], answer_type: 'choice', prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '',
        impact: Math.min(1, (IMPACT[cat] || 0.6) + (c.where === 's0' || c.cta ? 0.05 : 0)) }); }
    for (const q of (x.brief || [])) { const t = clean(S(q).trim()); if (!t) continue; const cat = /result|case|client|outcome|project/i.test(t) ? 'proof' : /partner|certif|accredit|award|iso\b/i.test(t) ? 'credential' : /price|fee|cost/i.test(t) ? 'pricing' : /how long|week|month|timeline/i.test(t) ? 'timeline' : /experience|example|seen|lesson/i.test(t) ? 'experience' : 'detail';
      const pre = prefillOf(t, x.docs);
      push({ kind: cat, category: cat, fact_key: factKey(cat, t), source: 'brief', blocks: false, question: t, why: 'The brief found that this would make the page more convincing; the page is complete without it.',
        original: '', neutral: '', in_page: 'left_out', section: '', choices: ['answer', 'skip'], answer_type: 'text', prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '', impact: IMPACT[cat] || 0.5 }); }
    for (const r of (x.brackets || [])) { if (!r || !r.question) continue; const cat = CATEGORY[r.kind] || 'detail'; const pre = prefillOf(r.question, x.docs);
      push({ kind: r.kind || 'detail', category: cat, fact_key: factKey(cat, S(r.token || r.question).replace(/^\[|\]$/g, '').replace(/^(author insight|confirm|owner)\s*:\s*/i, '')), source: 'bracket', blocks: false,
        question: clean(r.question), why: 'The writer needed this and nothing on file has it, so the page was written without it.',
        original: r.sentence ? clean(r.sentence) : '', neutral: '', in_page: 'left_out', section: '', choices: ['answer', 'skip'], answer_type: 'text',
        prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '', impact: IMPACT[cat] || 0.45 }); }
    out.sort((a, b) => b.impact - a.impact);
    return out.map((q, i) => ({ id: 'q' + (i + 1), rank: i + 1, use_for_future_pages: true, ...q, impact: +q.impact.toFixed(2) }));
  };
  const ACTION = {
    cut_off: 'start the page again (the complete draft could not be kept)',
    copied: 'rewrite the passages it repeats in your own words',
    duplicate_page: 'publish it as an update of your existing page for this search, or tell us how the new page differs',
    brand: 'write the business name the way you write it where the check found another form',
    author_profile: 'add the author\'s name, job title and a short bio to the business profile once',
    claim: 'delete the statement or confirm it in your business facts', figure: 'take out the figure or cite the page that states it',
    statistic: 'take out the number or cite the page that states it', bracket: 'fill in or delete the bracket', dead_link: 'replace or remove the link',
    off_topic: 'delete the section', guarantee: 'delete the guarantee', testimonial: 'delete the testimonial'
  };
  const deliver = (cls, opts) => {
    const o = opts || {};
    const blocking = cls.blocking.map(b => ({ code: b.code, text: b.text, action: ACTION[b.code] || '' }));
    const status = blocking.length ? 'not_ready' : (o.questions || []).length ? 'ready_with_questions' : 'ready';
    const label = status === 'ready' ? 'Ready to publish'
      : status === 'ready_with_questions' ? 'Ready to publish. A few answers from you would make it stronger'
        : 'Not ready to publish yet: ' + clean(blocking[0].text).replace(/^./, (x) => x.toLowerCase());
    const acts = [...new Set(blocking.map(b => b.action).filter(Boolean))];
    const next_step = status !== 'not_ready' ? '' : clean('Finish this draft by hand: ' + acts.join('; ') + '. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.');
    return { status, label, blocking, advisory: cls.advisory.map(a => ({ code: a.code, text: a.text })), next_step };
  };
  // what is still on the page of the blocking items after a deletion pass (a light re-check: a deletion can only take things away)
  const residual = (cls, md) => { const t = S(md); const left = cls.blocking.filter(b => {
      if (b.tier === 'hard') return b.code !== 'brand';
      if (b.code === 'claim') return t.includes(S(b.sentence));
      if (b.code === 'figure') return t.includes('[Confirm: ' + b.figure + ']');
      if (b.code === 'statistic') return t.includes(S(b.stat));
      if (b.code === 'bracket') return bracketsIn(t).some(x => x.token === b.token);
      if (b.code === 'dead_link') return t.includes('](' + b.url + ')');
      if (b.code === 'off_topic') return new RegExp('^#{2,4}\\s+' + escRe(S(b.heading).replace(/^#+\s*/, '').trim()) + '\\s*$', 'm').test(t);
      if (b.code === 'guarantee') return !!b.quote && t.includes(b.quote.slice(0, 60));
      if (b.code === 'testimonial') return t.includes(S(b.text));
      return true; });
    const brand = cls.blocking.find(b => b.code === 'brand');
    return { ...cls, blocking: brand ? left.concat([brand]) : left, soft: left.filter(b => b.tier === 'soft').length }; };
  // everything a node needs to know about this run to apply the fixes, from the brief item (Parse Brief)
  const ctxOf = (prev, opts) => { const p = prev || {}; const b = p.content_brief || {}; const sg = p.style_guide || {}; const o = opts || {};
    // H2 (2026-10-27): the style guide holds the display name (`brand_form`) and the legal name (`legal_name`) apart; a row stored the old
    // way ("Nova& (legal name: Novaand systems LLC)") is read as the two here too
    const form = S(sg.brand_form).trim(); const legal = S(sg.legal_name).trim() || (form.match(/\(\s*legal(?: name)?\s*[:=-]?\s*([^)]+)\)/i) || [])[1] || '';
    const short = form.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const names = [...new Set([(p.site_profile || {}).business_name, (p.site_description || {}).business_name, short, S(p.domain).split('.')[0]].map(x => S(x).trim()).filter(x => x.length >= 3))];
    const live = new Set((p.internal_link_candidates || []).filter(x => x && !x.planned).map(x => keyOf(x.url)));
    const links = (b.internal_link_suggestions || []).filter(l => l && live.has(keyOf(l.url))).map(l => ({ url: S(l.url), anchor: S(l.anchor) }))
      .concat((p.internal_link_candidates || []).filter(x => x && !x.planned && x.title).map(x => ({ url: S(x.url), anchor: S(x.title).split(/\s+[|\-]\s+/)[0] })));
    return { keyword: S(p.keyword), domain: S(p.domain).toLowerCase().replace(/^www\./, ''), business: short || names[0] || S(p.domain) || 'your business', names,
      brand: short || form, wrong_forms: (sg.wrong_forms || []).map(S).filter(w => w.length >= 3 && w.length <= 40 && !/:/.test(w)), keep_forms: [legal.trim(), form !== short ? form : ''].filter(Boolean), legal_name: legal.trim(),
      planned_slug: !!(p.ladder_id && S(p.ladder_target_url).trim()), ai_target: !!(p.ai_target && p.ai_target.question), snippet_targets: b.snippet_targets || [], outline: b.outline || [],
      internal_links: links, own_text: S(o.own_text || [p.business_facts, p.case_facts_text, p.proof_context].filter(Boolean).join(' ')), termRe: o.termRe || null,
      critique: o.critique || null, qa_marks: o.qa_marks || [], qa_figure_marks: o.qa_figure_marks || [] }; };
  return { EDIT_MAX, contract, bandOf, kindOf, split, join, span, removeAt, removeText, tidy, neutralSentence, bracketsIn, questionFor, fix, unmark, caseLike, brandHits, testimonials,
    classify, score, protect, better, plan, parseSections, merge, unlinkDead, deleteSection, neutralize, questions, deliver, residual, ctxOf, ACTION, prefillOf, neutralIn, factKey, clean, words, plain, hostOf, keyOf, overlap };
})();
// H1 (2026-10-27, docs/content-quality-2026-10-27/R1 §6 rec. 2): the deterministic fixes, in front of EVERY quality check. Code only, no
// model, so it cannot invent anything and costs nothing: the keyword in the meta title, the H1 and (for a question keyword) the first
// words of the introduction; the meta title and description inside their lengths; the slug's form; the Quick answer moved up to the first
// screen; a snippet question from the brief as the heading it nearly is; the first mention of a live page of the site linked; the brand
// as the business writes it; and no bracket left in the page (the sentence that needed it goes, and what only the client knows becomes a
// question for them, never a [Confirm: ...] in the text). It reads the draft of this round: the Copywriter's (from *Refresh Sources*), an
// edit merged by *Edit Check (Editor)*, or the final version *Page Candidates* hands back for its last check.
const inItem = $input.first().json || {};
const prev = $('Parse Brief').first().json || {};
const state = inItem.page_fix && typeof inItem.page_fix === 'object' ? inItem.page_fix : null;
const raw = typeof inItem.output === 'string' ? inItem.output : JSON.stringify(inItem.output || '');
const ctx = PF.ctxOf(prev, { termRe: CVG.termRe, qa_marks: state ? state.qa_marks || [] : [], qa_figure_marks: state ? state.qa_figure_marks || [] : [] });
const F = PF.fix(raw, ctx);
const page_fix_applied = { came_from: state ? (state.came_from || 'edit') : 'copywriter', fixes: F.fixes, removed: F.removed, words_before: PF.words(raw), words_after: PF.words(F.md) };
return [{ json: { ...inItem, output: F.md, page_fix_applied } }];
