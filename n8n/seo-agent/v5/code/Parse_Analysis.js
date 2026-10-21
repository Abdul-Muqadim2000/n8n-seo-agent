/*__PAGE_TYPE__*/
/*__COVERAGE__*/
/*__FIT_GATE__*/
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
// v4.4 page types (hub pages longer, case studies and local pages shorter). C8 (2026-10-22): these bands used to be a build patch that the
// G33 re-read of this file silently dropped, so hub / case-study / local pages fell back to the service band; they live here now.
const isHub = /pillar|hub/.test(pt) || Number(prev.ladder_rung) === 4, isShort = /case stud|local/.test(pt);
const lo = isHub ? 1800 : isShort ? 800 : isGuide ? 1200 : 900, hi = isHub ? 3500 : isShort ? 1800 : isGuide ? 3000 : 2400;
const rec = Number(analysis.recommended_word_count) || 1400;
analysis.recommended_word_count = Math.min(hi, Math.max(lo, Math.round(rec / 100) * 100));
// ---- C8 (2026-10-22, scorecard 2026-10-17 §3.3): the length is a BAND read off the ranking pages of the kind being written ----
// The target used to be one figure from the competitor analysis inside the page-type clamp, whatever kind of page that figure came from
// (exec 42 measured a service page against a certification course and a list). The leaders give the range of the ranking pages of the
// same kind. Here: the word counts of the pages this run read that are of the kind being written (CVG.kindOf, the same rule as the
// coverage target), median and interquartile range, kept inside the page-type band; with fewer than 3 such pages, the page-type band,
// and the band says so. The target the brief plans to is the median; Content QA judges the draft against `low` / `high`.
const LEN_MIN_PAGES = 3;
const r100 = (n) => Math.round(n / 100) * 100;
const fmtN = (n) => Number(n).toLocaleString('en-US');
const lenKind = CVG.kindFor(PT.of(prev.page_type));
const LEN_KIND_NAME = { service: ['service page', 'service pages'], guide: ['guide or article', 'guides or articles'] };
const lenListOk = lenKind === 'guide' && /\b(?:best|top|companies|firms|agencies|providers|vendors|tools|alternatives|list)\b/i.test(String(prev.keyword || ''));
const lenPages = (prev.competitors || []).filter(c => c && Number(c.word_count) >= 150)
  .map(c => ({ c, kind: CVG.kindOf(c, prev.keyword) }))
  .filter(x => x.kind === lenKind || (lenListOk && x.kind === 'list'))
  .map(x => ({ domain: String(x.c.domain || ''), url: String(x.c.url || ''), rank: Number(x.c.rank) || null, words: Math.round(Number(x.c.word_count)), kind: x.kind }));
const lenQ = (sorted, q) => { const at = (sorted.length - 1) * q; const a = Math.floor(at), b = Math.ceil(at); return sorted[a] + (sorted[b] - sorted[a]) * (at - a); };
const length_band = (() => {
  const kindName = LEN_KIND_NAME[lenKind] || LEN_KIND_NAME.service;
  const typeBand = { low: lo, high: hi };
  const typeText = fmtN(lo) + '-' + fmtN(hi) + ' words';
  if (lenPages.length < LEN_MIN_PAGES) {
    const target = analysis.recommended_word_count;
    return { ok: false, source: 'page_type', low: lo, high: hi, median: null, p25: null, p75: null, target_word_count: target, sample: lenPages.length,
      kind: lenKind, page_type_band: typeBand, clamped: false, pages: lenPages,
      basis: (lenPages.length ? 'only ' + lenPages.length + ' of the pages ranking for this run ' + (lenPages.length === 1 ? 'is a ' + kindName[0] : 'are ' + kindName[1]) : 'none of the pages ranking for this run that could be read is a ' + kindName[0])
        + ' (' + LEN_MIN_PAGES + ' are needed for a range), so the usual length for this kind of page is used: ' + typeText };
  }
  const w = lenPages.map(p => p.words).sort((a, b) => a - b);
  const median = Math.round(lenQ(w, 0.5)), p25 = Math.round(lenQ(w, 0.25)), p75 = Math.round(lenQ(w, 0.75));
  let low = Math.min(hi, Math.max(lo, r100(p25))), high = Math.min(hi, Math.max(lo, r100(p75)));
  // a band narrower than 200 words (the ranking pages agree closely, or all sit outside the page-type band) is widened inside the clamp
  if (high - low < 200) { const mid = Math.min(hi, Math.max(lo, r100(median))); low = Math.max(lo, mid - 100); high = Math.min(hi, low + 200); low = Math.max(lo, high - 200); }
  const target = Math.min(high, Math.max(low, r100(median)));
  const clamped = low !== r100(p25) || high !== r100(p75);
  return { ok: true, source: 'ranking_pages', low, high, median, p25, p75, target_word_count: target, sample: lenPages.length, kind: lenKind, page_type_band: typeBand, clamped,
    pages: lenPages.sort((a, b) => (a.rank || 99) - (b.rank || 99)).slice(0, 10),
    basis: 'pages ranking for this run ' + fmtN(low) + '-' + fmtN(high) + ' words (' + lenPages.length + ' ' + kindName[1] + ', middle half ' + fmtN(p25) + '-' + fmtN(p75) + ', median ' + fmtN(median) + ')'
      + (clamped ? '; kept inside the usual ' + typeText + ' for this kind of page' : '') };
})();
analysis.recommended_word_count = length_band.target_word_count;
analysis.length_band = length_band;

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
const KIND_NAME = { service: 'service page', guide: 'guide or article', list: 'list of companies', other: 'course, job or directory page', unknown: 'page of unclear kind' };
const bestCov = covTerms.length ? CVG.best(prev.competitors || [], covTerms, { kind: pageKind, keyword: prev.keyword }) : null;
// D5 / RV-9 (2026-10-21, pre-launch run exec 42): the page to beat for the service page "ai consultant" was usaii.org's certification
// course, and its headings ("Program Fee: US $894 (All Inclusive)", "Alumni Speak", "Program Eligibility") became subtopics the brief bent
// its outline to cover and the quality check refused the page over. The only real Dubai service page in the results (bell-integration.com)
// had answered a CAPTCHA. Subtopics now come only from a page of the kind being written; when none was readable, the comparison is said to
// be impossible (with the pages that could not be read), and a stand-in page sets at most the term target, never the subtopics.
const blockedPages = (prev.failed_pages || []).filter(f => f && f.url).map(f => String(f.url).replace(/^https?:\/\/(?:www\.)?/i, '').replace(/[\/?#].*$/, '') + ' (' + String(f.reason || 'not read').toLowerCase().replace(/\.$/, '') + ')');
const otherNote = (b) => (b && (b.other_pages || []).length) ? (b.other_pages.length + ' course, job or directory page(s) left out (' + b.other_pages.slice(0, 3).join(', ') + ')') : '';
const sameKind = !!(bestCov && !bestCov.none && bestCov.type_match !== false);
const coverage_unavailable = bestCov && bestCov.none
  ? 'no page to beat: none of the ' + bestCov.pages_compared + ' competitor page(s) read is a ' + KIND_NAME[pageKind] + ' or a guide (' + Object.entries(bestCov.kinds || {}).map(([k, n]) => n + ' ' + (KIND_NAME[k] || k)).join(', ') + ')'
    + (blockedPages.length ? '; these results could not be read: ' + blockedPages.slice(0, 4).join(', ') : '') + '. The comparison with a competitor page was not possible in this run, so no subtopics are asked of the page.'
  : '';
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
  // A-16: the page's own brand and every other result's brand are left out of its subtopics (the fit gate's labels, CVG.namesBrand)
  // D5: subtopics only from a page of the kind being written (a stand-in sets the term target and nothing else)
  subtopics: sameKind ? CVG.subtopics((prev.competitors || []).find(c => c && c.url === bestCov.url) || null, 12, { labels: fitLabels, keyword: prev.keyword, brands: (prev.competitors || []).map(c => c && (c.domain || c.url)).filter(Boolean) }) : [],
  subtopics_basis: sameKind ? '' : 'no ' + KIND_NAME[pageKind] + ' among the pages read' + (blockedPages.length ? ' (not read: ' + blockedPages.slice(0, 3).join(', ') + ')' : '') + ', so no subtopics are taken from another kind of page',
  basis: 'the ' + bestCov.pages_compared + ' competitor page(s) read for this keyword: ' + (bestCov.domain || 'the best page')
    + (bestCov.rank ? ' (position ' + bestCov.rank + ')' : '') + ' uses ' + bestCov.terms_used + ' of the ' + bestCov.terms_total
    + ' terms they share (' + bestCov.coverage_pct + '%), against an average of ' + bestCov.average_pct + '% (a term counts once it appears)'
    + (bestCov.type_match ? '; it is the best ' + KIND_NAME[pageKind] + ' among them, the kind of page being written (' + bestCov.same_kind_pages + ' of that kind read)'
      : '; no ' + KIND_NAME[pageKind] + ' could be read among them' + (blockedPages.length ? ' (not read: ' + blockedPages.slice(0, 3).join(', ') + ')' : '')
        + ', so the comparison with a page of the same kind was not possible: the best page that is not a list, a course, a job or a directory page sets the term target only, and no subtopics are taken from it')
    + (otherNote(bestCov) ? '; ' + otherNote(bestCov) : '')
    + (bestCov.official_skipped ? '; ' + bestCov.official_skipped + ' government / regulator page(s) left out of the choice (a source to cite, not a page to beat)' : '')
} : null;
// the subtopic block is kept apart, so Brief Context can drop the topics the verdict said to leave out before the brief reads it
const coverage_digest_base = coverage_target ? 'TARGET: use at least ' + coverage_target.target_pct + '% of the shared terms above, each at least once (the best ' + (coverage_target.type_match ? KIND_NAME[pageKind] : 'page') + ' in the results, '
  + (coverage_target.best.domain || 'the leader') + (coverage_target.best.rank ? ' at position ' + coverage_target.best.rank : '') + ', uses '
  + coverage_target.best.coverage_pct + '%; the average of the pages read is ' + coverage_target.average_pct + '%). Its depth: '
  + (coverage_target.best.word_count ? coverage_target.best.word_count + ' useful words' : 'length unknown') + ' in ' + (coverage_target.best.sections || 0) + ' sections.'
  + (coverage_target.type_match === false ? ' It is not a ' + KIND_NAME[pageKind] + ': do not follow its structure or its offer.' : '')
  : (coverage_unavailable ? 'No competitor page of this kind could be read, so there is no coverage target from a page to beat: plan the coverage from the keyword data and the questions above.' : '');
const subtopicBlock = (subs) => (subs && subs.length) ? '\nSUBTOPICS THAT PAGE COVERS (cover each one, in our own structure and words; do not copy its headings):\n- ' + subs.join('\n- ') : '';
const coverage_digest = coverage_digest_base + subtopicBlock(coverage_target ? coverage_target.subtopics : []);

return [{
  json: {
    ...prev,
    competitor_digest: undefined,
    competitor_analysis: analysis,
    length_band,
    coverage_target,
    coverage_unavailable,
    coverage_digest_base,
    coverage_digest
  }
}];