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
const covTerms = (prev.term_model || []).slice(0, 25);
const bestCov = covTerms.length ? CVG.best(prev.competitors || [], covTerms) : null;
const coverage_target = bestCov && bestCov.coverage_pct != null ? {
  terms_total: bestCov.terms_total,
  terms: covTerms.map(t => t.term),
  best: { domain: bestCov.domain, url: bestCov.url, rank: bestCov.rank, coverage_pct: bestCov.coverage_pct, terms_used: bestCov.terms_used,
    word_count: bestCov.word_count, sections: bestCov.sections },
  average_pct: bestCov.average_pct,
  pages_compared: bestCov.pages_compared,
  target_pct: CVG.target(bestCov.coverage_pct),
  subtopics: CVG.subtopics((prev.competitors || []).find(c => c && c.url === bestCov.url) || null, 12),
  basis: 'the ' + bestCov.pages_compared + ' competitor page(s) read for this keyword: ' + (bestCov.domain || 'the best page')
    + (bestCov.rank ? ' (position ' + bestCov.rank + ')' : '') + ' uses ' + bestCov.terms_used + ' of the ' + bestCov.terms_total
    + ' terms they share (' + bestCov.coverage_pct + '%), against an average of ' + bestCov.average_pct + '%'
} : null;
const coverage_digest = coverage_target ? 'TARGET: use at least ' + coverage_target.target_pct + '% of the shared terms above (the best page in the results, '
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