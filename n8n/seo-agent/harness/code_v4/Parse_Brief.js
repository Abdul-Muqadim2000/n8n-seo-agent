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

// ---- verdict exclusions kit (A-18, 2026-10-17; inlined through the EXCLUSIONS marker and prepended to Parse Verdict) ----
// What the verdict said this page must NOT cover reaches the brief, the writer and the quality check. Live (exec 771) the verdict's
// own `what_must_change[3]` said "Skip the consultancy-licence and start-an-IT-company questions, which don't match buyer intent", and
// the delivered page carried the H2 "How Much Is a Consultancy Licence in Dubai?": the strategy brief prompt only ever printed the
// verdict's reasons, never its changes, so the instruction reached nobody and nothing checked it.
//   EXC.fromVerdict(changes, skips)  the topics to leave out: the verdict's structured `topics_to_skip`, plus every "skip / avoid /
//                                    leave out / do not cover …" phrase in its free-text changes (the fallback for older answers)
//   EXC.match(text, ex, keyword)     does a heading (or an outline section) cover that topic? every content word of the topic must be in it;
//                                    a one-word topic that is also a word of the page's own keyword never matches (it would match everything)
//   EXC.check(headings, list, kw)    [{ heading, topic }] for every heading that covers an excluded topic
//   EXC.prune(outline, list, kw)     the brief's outline without those sections, and the ones dropped
// Regex only (the n8n Code sandbox has no URL constructor).
const EXC = (() => {
  const S = (v) => String(v == null ? '' : v);
  const STOP = new Set('the a an and or of for to in on with by at from about any all each every their your our its it is are be this that these those how what which why when who much many do does can should would will questions question topics topic sections section queries query searches search angles angle content pages page posts post details detail things thing buyer buyers intent people readers reader'.split(' '));
  const norm = (w) => { let x = S(w).toLowerCase().replace(/licens/g, 'licenc');
    if (x.length > 5) x = x.replace(/(?:ings|ing|ies|es|ed|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const toks = (t) => S(t).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(norm);
  const SKIP_RE = /\b(?:skip|avoid|leave out|drop|exclude|omit|ignore|steer clear of|stay away from|do not (?:cover|answer|target|include)|don['’]t (?:cover|answer|target|include)|no need to (?:cover|answer))\s+(?:the\s+|any\s+|all\s+)?([^.;:!?]+?)(?=\s*,\s*(?:which|as|because|since|they|these|it|that)\b|\s+(?:which|because|since|as they|as these)\b|[.;:!?]|$)/gi;
  const TAIL_RE = /\s+(?:questions?|topics?|sections?|queries|query|searches|angles?|content|pages?|posts?|subjects?|keywords?)\s*$/i;
  const fromText = (line) => {
    const out = [];
    for (const m of S(line).matchAll(SKIP_RE)) {
      const phrase = S(m[1]).replace(TAIL_RE, '').trim();
      for (const part0 of phrase.split(/\s*(?:,|;|\band\b|\bor\b|&|\/)\s*/i)) {
        const part = part0.replace(/[-_]+/g, ' ').replace(TAIL_RE, '').trim();
        if (toks(part).length) out.push(part);
      }
    }
    return out;
  };
  const fromVerdict = (changes, skips) => {
    const seen = new Set(); const out = [];
    const add = (topic, source) => { const k = toks(topic).join(' '); if (!k || seen.has(k)) return; seen.add(k); out.push({ topic: S(topic).trim(), source }); };
    (Array.isArray(skips) ? skips : []).forEach(t => add(S(t).replace(/[-_]+/g, ' '), 'verdict'));
    (Array.isArray(changes) ? changes : []).forEach(c => fromText(c).forEach(t => add(t, 'verdict_changes')));
    return out.slice(0, 12);
  };
  const match = (text, ex, keyword) => {
    const T = toks(ex && ex.topic != null ? ex.topic : ex); if (!T.length) return false;
    const kw = new Set(toks(keyword));
    if (T.length === 1 && kw.has(T[0])) return false;
    const H = new Set(toks(text));
    return T.every(w => H.has(w));
  };
  const check = (headings, list, keyword) => {
    const out = [];
    for (const h of (Array.isArray(headings) ? headings : [])) {
      const text = S(h).replace(/^#+\s*/, '').replace(/[*_`]+/g, '').trim(); if (!text) continue;
      const ex = (Array.isArray(list) ? list : []).find(e => match(text, e, keyword));
      if (ex) out.push({ heading: text, topic: S(ex.topic != null ? ex.topic : ex) });
    }
    return out;
  };
  const prune = (outline, list, keyword) => {
    const kept = [], dropped = [];
    for (const sec of (Array.isArray(outline) ? outline : [])) {
      const ex = (Array.isArray(list) ? list : []).find(e => match(S(sec && sec.h2), e, keyword));
      if (ex) dropped.push({ h2: S(sec.h2), topic: S(ex.topic) }); else kept.push(sec);
    }
    return { kept, dropped };
  };
  return { fromVerdict, fromText, match, check, prune, toks };
})();
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

// 5. M1 (2026-10-21, pre-launch run exec 42): a ladder's top page took the keywords of the rung pages planned under it as its own
//    secondary keywords ("ai consulting", "ai consultant dubai", "ai consulting firm"): four pages for one search. A keyword another
//    page of the same ladder (or a hub's cluster page) is written for is taken off the list here, before the copywriter reads it.
const siblingKwPB = new Set([...(prev.ladder_links || []).map(l => l && (l.keyword || l.about)), ...(prev.planned_link_targets || []).map(l => l && (l.keyword || l.about)), ...(prev.hub_pages || []).map(h => h && h.keyword)]
  .map(x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(x => x && x !== String(prev.keyword || '').toLowerCase().trim()));
if (siblingKwPB.size && Array.isArray(brief.secondary_keywords)) { const offPB = brief.secondary_keywords.filter(k => siblingKwPB.has(String(k || '').toLowerCase().replace(/\s+/g, ' ').trim()));
  if (offPB.length) { brief.secondary_keywords = brief.secondary_keywords.filter(k => !offPB.includes(k)); adjustments.push('Took ' + offPB.length + ' keyword(s) off the secondary keywords because another page of this ladder is written for each: ' + offPB.join(', ')); } }

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