// ---- the page type, as one of the options the form offers (D10, 2026-10-12; the builders inline this file where a node asks for the PAGE_TYPE kit) ----
// The verdict and the keyword screen answer in free text: the live page of execution 365 was planned as "Service Page (ERP implementation
// UAE) with built-in vendor-neutral comparison, cost and compliance sections". That sentence then travelled as the page type into the brief
// (which read it as a guide and set 3,100 words), into the schema and into meta.json. PT.of() maps any such text to one of the fixed options
// and PT.notes() keeps the sentence itself, so nothing the verdict said is lost — it reaches the brief as page_notes instead.
const PT = (() => {
  const TYPES = ['Service Page', 'Product Page', 'Blog Post', 'Landing Page', 'Guide', 'Pillar Page', 'Local Page', 'Case Study'];
  // first match wins by POSITION in the text, not by rule order: "Service Page (…) with built-in vendor-neutral comparison" is a service
  // page that also compares, not a comparison guide.
  const RULES = [[/case stud/i, 'Case Study'], [/\bpillar\b|\bhub\b|topic cluster/i, 'Pillar Page'], [/\blocal\b|city page|area page/i, 'Local Page'],
    [/\bproducts?\b|e-?commerce|\bshop\b|\bstore\b|catalou?g/i, 'Product Page'], [/landing|lead capture|campaign page|squeeze/i, 'Landing Page'],
    [/\bblogs?\b|\bnews\b|\barticles?\b|\bposts?\b/i, 'Blog Post'],
    [/\bguides?\b|how.?to|tutorial|comparison|compare|versus|\bvs\b|\bfaqs?\b|resource|checklist|listicle|round.?up|explainer|glossary/i, 'Guide'],
    [/\bservices?\b|solution|category|collection|offering/i, 'Service Page']];
  const of = (v, dflt) => {
    const t = String(v == null ? '' : v).trim();
    const fallback = TYPES.find(x => x.toLowerCase() === String(dflt || '').trim().toLowerCase()) || 'Service Page';
    if (!t) return fallback;
    const exact = TYPES.find(x => x.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    let best = null;
    for (const r of RULES) { const i = t.search(r[0]); if (i >= 0 && (!best || i < best.i)) best = { i: i, type: r[1] }; }
    return best ? best.type : fallback;
  };
  // the free text, kept for the brief; empty when it says nothing beyond the type itself (the form's own wording included)
  const SAME = ['pillar / hub page', 'pillar/hub page', 'hub page', 'local page (city or area)', 'case study page'];
  const notes = (v, type) => {
    const t = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (!t) return '';
    const bare = t.replace(/[.\s]+$/, '').toLowerCase();
    if (bare === String(type || '').toLowerCase() || TYPES.some(x => x.toLowerCase() === bare) || SAME.indexOf(bare) >= 0) return '';
    return t.slice(0, 300);
  };
  return { of: of, notes: notes, TYPES: TYPES };
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
  const subtopics = (page, limit) => {
    const out = []; const seen = new Set();
    const hs = (page && page.headings) || []; const list = page ? kindOf(page) === 'list' : false;
    const content = S(page && (page.content_full || page.content || page.text));
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      const text = clean(h); const key = text.toLowerCase();
      if (!text || text.length < 8 || text.length > 90 || JUNK.test(text) || seen.has(key)) continue;
      if (toks(text).length < 2) continue;
      if (PROMO.test(text)) continue;
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
  return { termRe, coverageOf, best, target, subtopics, subtopicGap, pct, toks, clean, kindOf, kindFor, MIN_TARGET, MAX_TARGET,
    plainOf, readability, readBand, READ_MIN_WORDS, READ_MIN_PAGES, BAND_HARDER, BAND_EASIER, BAND_FLOOR, BAND_CEIL };
})();
// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Collect Facts').first().json;
const analysis = parseAgentJson($input.first().json.output);
// Length discipline: commercial pages convert better short; guides may run longer. Never above 3,000 words.
// 2026-10-12 (FIX_PLAN D10): the page type can arrive as a whole sentence ("Service Page (…) with built-in comparison, cost and compliance
// sections"), which picked the band by accident; the fixed option decides it.
const pt = PT.of(prev.page_type).toLowerCase();
const isGuide = /blog|guide|article/.test(pt);
const lo = isGuide ? 1200 : 900, hi = isGuide ? 3000 : 2400;
const rec = Number(analysis.recommended_word_count) || 1400;
analysis.recommended_word_count = Math.min(hi, Math.max(lo, Math.round(rec / 100) * 100));

// ---- the coverage target: the BEST competitor, not the average (FIX_PLAN G33, 2026-10-13) ----
// Until now the brief carried the shared terms and the content score gave 25 points for using them, with no statement of how much of that
// topic the pages that already rank actually cover. Surfer measured the best articles at 0.74 coverage against a results-page average of
// 0.44 (n = 100), so the page to beat is the best one: its term coverage becomes the target, its own headings become the subtopics to
// cover, and its length and section count say how deep it goes. It is read off competitor pages -- a target, never a promise about rank.
// R44 (2026-10-16, re-rating 2026-10-15): the page to beat is chosen among the results of the KIND being written. Live (exec 616) a
// service page was measured against vendasta.com's blog guide for marketing agencies, and the ladder verdict of exec 610 against a
// "Best AI Consulting Companies in Dubai" listicle whose entries (Accenture, IBM, G42 …) became subtopics to cover. The kind comes from
// the page type (PT.of) and each result's URL, title and byline (CVG.kindOf); with no page of that kind read, the best page that is not a
// list stands in, and the target says so (`type_match: false`). The market (country) of the results is the search's own already.
const covTerms = (prev.term_model || []).slice(0, 25);
const pageKind = CVG.kindFor(PT.of(prev.page_type));
const KIND_NAME = { service: 'service page', guide: 'guide or article', list: 'list of companies' };
const bestCov = covTerms.length ? CVG.best(prev.competitors || [], covTerms, { kind: pageKind, keyword: prev.keyword }) : null;
const coverage_target = bestCov && bestCov.coverage_pct != null ? {
  terms_total: bestCov.terms_total,
  terms: covTerms.map(t => t.term),
  best: { domain: bestCov.domain, url: bestCov.url, rank: bestCov.rank, coverage_pct: bestCov.coverage_pct, terms_used: bestCov.terms_used,
    word_count: bestCov.word_count, sections: bestCov.sections, kind: bestCov.kind },
  page_kind: pageKind, type_match: bestCov.type_match,
  measure: 'presence',   // R43: a term counts once it appears — Content QA measures the draft by the same rule
  average_pct: bestCov.average_pct,
  pages_compared: bestCov.pages_compared,
  target_pct: CVG.target(bestCov.coverage_pct),
  subtopics: CVG.subtopics((prev.competitors || []).find(c => c && c.url === bestCov.url) || null, 12),
  basis: 'the ' + bestCov.pages_compared + ' competitor page(s) read for this keyword: ' + (bestCov.domain || 'the best page')
    + (bestCov.rank ? ' (position ' + bestCov.rank + ')' : '') + ' uses ' + bestCov.terms_used + ' of the ' + bestCov.terms_total
    + ' terms they share (' + bestCov.coverage_pct + '%), against an average of ' + bestCov.average_pct + '% (a term counts once it appears)'
    + (bestCov.type_match ? '; it is the best ' + KIND_NAME[pageKind] + ' among them, the kind of page being written (' + bestCov.same_kind_pages + ' of that kind read)'
      : '; no ' + KIND_NAME[pageKind] + ' was among the pages read, so the best ' + (bestCov.kind === 'list' ? 'page' : 'page that is not a list of companies') + ' stands in')
    + (bestCov.official_skipped ? '; ' + bestCov.official_skipped + ' government / regulator page(s) left out of the choice (a source to cite, not a page to beat)' : '')
} : null;
const coverage_digest = coverage_target ? 'TARGET: use at least ' + coverage_target.target_pct + '% of the shared terms above, each at least once (the best ' + (coverage_target.type_match ? KIND_NAME[pageKind] : 'page') + ' in the results, '
  + (coverage_target.best.domain || 'the leader') + (coverage_target.best.rank ? ' at position ' + coverage_target.best.rank : '') + ', uses '
  + coverage_target.best.coverage_pct + '%; the average of the pages read is ' + coverage_target.average_pct + '%). Its depth: '
  + (coverage_target.best.word_count ? coverage_target.best.word_count + ' useful words' : 'length unknown') + ' in ' + (coverage_target.best.sections || 0) + ' sections.'
  + (coverage_target.subtopics.length ? '\nSUBTOPICS THAT PAGE COVERS (cover each one, in our own structure and words — do not copy its headings):\n- ' + coverage_target.subtopics.join('\n- ') : '')
  : '';

return [{
  json: {
    ...prev,
    competitor_digest: undefined,
    competitor_analysis: analysis,
    coverage_target,
    coverage_digest
  }
}];