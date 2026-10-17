/*__PAGE_TYPE__*/
/*__COVERAGE__*/
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