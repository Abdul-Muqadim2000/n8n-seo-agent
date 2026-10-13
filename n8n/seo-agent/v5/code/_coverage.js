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
