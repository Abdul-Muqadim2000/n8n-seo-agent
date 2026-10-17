/*__EXCLUSIONS__*/
// ---- the brief is held to what the data supports (D10, 2026-10-12; inlined into the v3 node *Parse Brief* by build_v4.py section 35) ----
// Execution 365 asked for 3,100 words although the competitor analysis had recommended (and clamped) far fewer and the verdict had asked
// for "a service page of about 2,100 words", and it built the page on cost and timeline although the business had given neither — so the
// copy came back with 30 x [Price] and 20 x [Timeline] and nobody could publish it.
const adjustments = [];
// 1. length: the verdict's own target wins when it named one, else the competitor analysis' recommended count (already clamped there)
const recWords = Number((prev.competitor_analysis || {}).recommended_word_count) || 0;
const verdictWords = (() => {
  for (const t of (prev.verdict_changes || [])) {
    const m = String(t || '').match(/\b(?:of|about|around|roughly|approximately|target|aim for|at least|up to)\s+(\d[\d,]{2,5})[\s-]*words?\b/i);
    if (m) { const n = Number(String(m[1]).replace(/,/g, '')); if (n >= 300 && n <= 6000) return n; }
  }
  return 0;
})();
const askedWords = Number(brief.target_word_count) || 0;
// P2-7 (2026-10-12, Phase 2 live check §3): a `force_content` run (the app's "Write now", a page the Content Cadence or the ladder spawns)
// never runs *Parse Analysis* and has no verdict of its own, so neither target above exists — run 442 wrote 3,864 words for a page the
// ladder verdict had set at 2,100. The ladder row stores that number (seo_ladders.target_words) and the run carries it as `ladder_words`.
const ladderWords = (() => { const n = Number(prev.ladder_words) || 0; return (n >= 300 && n <= 6000) ? n : 0; })();
const baseWords = verdictWords || recWords || ladderWords || 0;
if (baseWords) {
  const lo = Math.round(baseWords * 0.9), hi = Math.round(baseWords * 1.1);
  const clamped = Math.min(hi, Math.max(lo, askedWords || baseWords));
  if (clamped !== askedWords) {
    adjustments.push('Target length ' + (askedWords || 'unset') + ' -> ' + clamped + ' words (' + (verdictWords ? 'the verdict asked for about ' + verdictWords : recWords ? 'the competitor analysis recommends ' + recWords : 'the keyword ladder\'s own target is ' + ladderWords) + ', within 10%)');
    brief.target_word_count = clamped;
    // the writer follows the outline, so the sections move with the target
    const sum = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);
    if (Array.isArray(brief.outline) && sum > 0 && Math.abs(clamped - sum) > sum * 0.02) {
      const f = clamped / sum;
      brief.outline = brief.outline.map(sec => (Number(sec.target_words) ? { ...sec, target_words: Math.max(80, Math.round(Number(sec.target_words) * f / 10) * 10) } : sec));
      adjustments.push('Section targets scaled to the new length (' + sum + ' -> ' + brief.outline.reduce((s, sec) => s + (Number(sec.target_words) || 0), 0) + ' words)');
    }
  }
}
// 2. angle: cost or timeline only when such facts exist (Brief Context measured that from the site model and the client's own facts)
if (prev.pricing_facts !== undefined || prev.timeline_facts !== undefined) {
  const needPrice = !prev.pricing_facts, needTime = !prev.timeline_facts;
  const PRICE_RE = /\b(price|prices|priced|pricing|cost|costs|costing|how much|budget|fees?|aed|usd|dirhams?|per (?:user|seat|month|licence|license))\b|[$£€]/i;
  const TIME_RE = /\b(timeline|timelines|how long|duration|lead time|turnaround|go.?live date|time to (?:go.?live|implement|deploy|rank)|implementation time|\d+[- ](?:week|month)s?)\b/i;
  const offends = (t) => (needPrice && PRICE_RE.test(String(t || ''))) || (needTime && TIME_RE.test(String(t || '')));
  const missing = needPrice && needTime ? 'price or timeline facts' : needPrice ? 'price facts' : 'timeline facts';
  if ((needPrice || needTime) && offends(brief.unique_angle)) {
    const alt = (brief.information_gain || []).find(x => !offends(x)) || (brief.gaps_to_cover || []).find(x => !offends(x)) || '';
    adjustments.push('Angle dropped (no ' + missing + ' on file): "' + String(brief.unique_angle || '').slice(0, 120) + '"');
    brief.unique_angle = String(alt || ('What the facts on file prove about ' + (prev.keyword || 'this topic') + ', without figures the business has not given'));
  }
  if (needPrice || needTime) {
    const ig = (brief.information_gain || []).filter(x => !offends(x));
    if (ig.length !== (brief.information_gain || []).length) { adjustments.push('Removed ' + ((brief.information_gain || []).length - ig.length) + ' information-gain promise(s) that only a ' + missing.replace(' facts', '') + ' could keep'); brief.information_gain = ig; }
    const CT = (brief.comparison_table && typeof brief.comparison_table === 'object') ? brief.comparison_table : null;
    if (CT) {
      const cols = (CT.columns || []).filter(c => !offends(c));
      if (cols.length !== (CT.columns || []).length) { adjustments.push('Removed ' + ((CT.columns || []).length - cols.length) + ' comparison-table column(s) that only a ' + missing.replace(' facts', '') + ' could fill'); CT.columns = cols; }
      if (offends(CT.rows_hint)) { CT.rows_hint = 'criteria the reader can check for themselves (what each option covers, who it suits, what it needs from them) — no price or timeline figures'; adjustments.push('Comparison-table rows no longer ask for figures the business has not given'); }
    }
  }
}
// 3. A-18 (2026-10-17, re-rating 2026-10-17): a section about a topic the verdict said to leave out is taken out of the outline, so the
//    writer is never asked for it. Live (exec 771) the verdict said "Skip the consultancy-licence and start-an-IT-company questions" and
//    the page carried "How Much Is a Consultancy Licence in Dubai?" (the brief never saw the instruction). EXC is the verdict-exclusions
//    kit; Content QA checks the finished draft by the same rule.
{
  const EXL = Array.isArray(prev.verdict_exclusions) ? prev.verdict_exclusions : EXC.fromVerdict(prev.verdict_changes, []);
  if (EXL.length) {
    const pr = EXC.prune(brief.outline, EXL, prev.keyword || '');
    if (pr.dropped.length) { brief.outline = pr.kept; adjustments.push('Outline section(s) the verdict said to leave out were removed: ' + pr.dropped.map(d => '"' + d.h2 + '" (skip ' + d.topic + ')').join('; ')); }
    if (Array.isArray(brief.snippet_targets)) {
      const SNIP = brief.snippet_targets.filter(t => !EXL.some(e => EXC.match(String((t && t.question) || ''), e, prev.keyword || '')));
      if (SNIP.length !== brief.snippet_targets.length) { adjustments.push('Removed ' + (brief.snippet_targets.length - SNIP.length) + ' snippet question(s) about a topic the verdict said to leave out'); brief.snippet_targets = SNIP; }
    }
  }
}
