// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

const prev = $('Brief Context').first().json;   // Parse Verdict + business profile, proof, page role, hub pages, video (v4.4)
const brief = parseAgentJson($input.first().json.output);

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

// 3. the coverage target is the best competitor's, measured in Parse Analysis (FIX_PLAN G33, 2026-10-13): it is written into the brief
//    here rather than taken from the model's answer, so Content QA judges the page against a number nobody could talk away. The target
//    is what that one page covers (clamped 60-90%), not an average, and it is a target read off competitor pages -- not a promise.
const covT = prev.coverage_target && typeof prev.coverage_target === 'object' ? prev.coverage_target : null;
if (covT && covT.target_pct) {
  brief.coverage_target = { target_pct: covT.target_pct, best_competitor: covT.best || null, average_pct: covT.average_pct ?? null,
    terms_total: covT.terms_total ?? null, subtopics: covT.subtopics || [], basis: covT.basis || '' };
  const have = new Set((brief.terms_to_use || []).map(t => String((t && t.term) || t || '').toLowerCase().trim()).filter(Boolean));
  const want = Math.ceil((covT.terms_total || 0) * covT.target_pct / 100);
  if (have.size < want) {   // the writer cannot reach the target with a shorter list than the target itself needs
    const add = (covT.terms || []).filter(t => !have.has(String(t).toLowerCase())).slice(0, Math.min(10, want - have.size));
    if (add.length) { brief.terms_to_use = [...(brief.terms_to_use || []), ...add.map(t => ({ term: t, min_count: 1 }))];
      adjustments.push('Added ' + add.length + ' shared term(s) to terms_to_use: the coverage target of ' + covT.target_pct + '% needs at least ' + want + ' of the ' + covT.terms_total + ' terms'); }
  }
  const missing = (covT.subtopics || []).filter(s => !(brief.outline || []).some(o => {
    const h = String((o && (o.h2 + ' ' + (o.key_points || []).join(' '))) || '').toLowerCase();
    const T = String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3);
    return T.length ? T.filter(w => h.includes(w)).length / T.length >= 0.6 : true; }));
  if (missing.length) { brief.coverage_target.subtopics_not_in_outline = missing.slice(0, 8);
    adjustments.push(missing.length + ' subtopic(s) of the best competitor page are not in the outline: ' + missing.slice(0, 4).join('; ')); }
}

// 4. R15 (2026-10-13, re-rating §3.11): a ladder page keeps the URL its ladder row planned. Live, the row said
//    `…/service-industry-erp-software/` while the page was delivered as `service-industry-erp-software-uae`: the ladder's link map, the
//    sibling pages' up-links and the Rank Tracker's weekly check all use the row, so publishing at the suggested URL would have left
//    every one of them pointing at a URL that never exists.
const ladderUrlPB = String(prev.ladder_target_url || '').trim();
if (prev.ladder_id && ladderUrlPB) {
  const slugPB = ladderUrlPB.replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop() || '';
  const asked = String(brief.slug || '').replace(/^\/|\/$/g, '');
  if (slugPB && slugPB !== asked) { adjustments.push('Slug "' + (asked || 'unset') + '" -> "' + slugPB + '": the keyword ladder planned this page at ' + ladderUrlPB + ', and its link map, the other rung pages and the rank tracking all use that URL'); brief.slug = slugPB; }
}

// Word count check
const totalWords = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);

return [{
  json: {
    ...prev,
    content_brief: brief,
    brief_outline_words: totalWords,
    brief_adjustments: adjustments
  }
}];