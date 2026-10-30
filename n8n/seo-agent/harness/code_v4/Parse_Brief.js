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
//                                    leave out / do not cover ..." phrase in its free-text changes (the fallback for older answers)
//   EXC.match(text, ex, family)      does a heading (or an outline section) cover that topic? (rules below). `family` is the page's keyword
//                                    (a string, as before) or a list of strings: the keyword, the brief's primary and secondary keywords,
//                                    the site's main services (EXC.familyOf)
//   EXC.check(headings, list, kw)    [{ heading, topic }] for every heading that covers an excluded topic
//   EXC.prune(outline, list, kw)     the brief's outline without those sections, and the ones dropped
//   EXC.decide(md, list, family)     W06-A: which matched sections may really be deleted, and which are kept with the reason (the budget below)
//   EXC.guard(md, flagged, list, f)  W06-A: the same decision for a list of flagged headings a quality check handed over (Page Candidates)
//   EXC.removedOf(state)             W06-A: what a page run's deletions took out (sections, words), for the grade
// W06-A (page-quality wave 0.6, 2026-10-30, docs/page-quality-2026-10-29/WAVE05.md 3.1): live (W05 run, K1 "ms 365 erp") the verdict said to
// skip "Dynamics GP and SL"; tokens under 3 characters were dropped, so the topic became the single word "dynamic", which is not a word of
// the keyword, and nine headings matched it. Page Candidates deleted six core sections (2,407 words -> 1,023) and the grade still said 79
// "Ready". Now:
//   * a short token is kept when it is meaningful: an acronym written in capitals in the topic (GP, SL, AI, ML, UK) or a token with a digit;
//     such a token only matches the same acronym in capitals in the heading ("Is it ..." never matches "IT");
//   * a topic that lost a token to the length filter (a lowercase "ai" or "ml") matches on its FULL phrase or not at all;
//   * a one-token topic that is a word of the page's keyword family or the site's main services never matches, not even as a phrase;
//     a topic made only of such words matches on its full phrase only;
//   * the full phrase of a topic in a heading is always a match (and the strongest signal).
// And the deletion budget (EXC.decide): a section whose heading names the topic's full phrase, or whose text names the topic's own words
// (those outside the keyword family) at least twice, is a section about it ("a second signal"). Without such a signal at most ONE matched
// section is deleted, and only when it holds no more than 20% of the page's words; the others are kept and reported. Deletions never take
// more than 40% of the page's words in all. Every decision is recorded (removed / kept, with the reason) in the run's evidence.
// Regex only (the n8n Code sandbox has no URL constructor).
const EXC = (() => {
  const S = (v) => String(v == null ? '' : v);
  const STOP = new Set('the a an and or of for to in on with by at from about any all each every their your our its it is are be this that these those how what which why when who much many do does can should would will questions question topics topic sections section queries query searches search angles angle content pages page posts post details detail things thing buyer buyers intent people readers reader'.split(' '));
  // two-letter words that carry no topic (the rest of the short words a topic loses make it a phrase-only topic)
  const SHORT_STOP = new Set('of to in on by at it is be do vs as if so no up an or we us my me am go oh ok'.split(' '));
  const norm = (w) => { let x = S(w).toLowerCase().replace(/licens/g, 'licenc');
    if (x.length > 5) x = x.replace(/(?:ings|ing|ies|es|ed|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const toks = (t) => S(t).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(norm);
  // the topic's words with the meaningful short ones (acronyms in capitals, tokens with a digit: "#gp", "#sl"), how many short words it
  // lost, and its normalised phrase
  const raw = (t) => S(t).replace(/[’']/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const isAcr = (w) => w.length === 2 && (/^[A-Z][A-Z0-9]$/.test(w) || /^[0-9][A-Z]$/.test(w) || /^[A-Z][0-9]$/.test(w));
  const phraseOf = (t) => S(t).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^\s*the\s+/, '').trim();
  const terms = (t) => { const req = [], seen = new Set(); let lost = 0;
    for (const w of raw(t)) {
      const lw = w.toLowerCase();
      if (w.length >= 3) { if (STOP.has(lw)) continue; const n = norm(lw); if (!seen.has(n)) { seen.add(n); req.push(n); } continue; }
      if (isAcr(w)) { const n = '#' + lw; if (!seen.has(n)) { seen.add(n); req.push(n); } continue; }
      if (w.length === 2 && !SHORT_STOP.has(lw) && /[a-z]/i.test(w)) lost++;
    }
    return { req, lost, phrase: phraseOf(t) }; };
  // a heading's words: every content word, plus the acronyms it writes in capitals
  const textSet = (t) => { const set = new Set(toks(t)); for (const w of raw(t)) if (isAcr(w)) set.add('#' + w.toLowerCase()); return set; };
  const phraseIn = (text, phrase) => !!phrase && (' ' + phraseOf(text) + ' ').includes(' ' + phrase + ' ');
  // the page's keyword family: the keyword, or a list of strings (keywords, the site's services)
  // W06 integration (2026-10-30): a two-letter word of the family counts as its acronym whatever its case (the keyword "ai consultant" is
  // typed in lowercase, the topic "AI consultant certification" keeps "#ai"). Such an acronym is the page's own context, not the topic's
  // signal: it is never required in the text (an address or a heading may spell it out: "artificial-intelligence-certifications"), as
  // the length filter never required it before W06-A (EQA4, exec 42). The topic's own acronyms (GP, SL) are still required, in capitals.
  const famSet = (family) => { const f = new Set(); for (const s of (Array.isArray(family) ? family : [family])) {
    for (const w of terms(s).req) f.add(w);
    for (const w of raw(s)) { const lw = w.toLowerCase(); if (w.length === 2 && /^[a-z]{2}$/.test(lw) && !SHORT_STOP.has(lw)) f.add('#' + lw); } } return f; };
  const familyOf = (prev, siteModel) => { const p = prev || {}; const b = p.content_brief || {}; const m = siteModel || p.site_model || {};
    const sec = Array.isArray(b.secondary_keywords) ? b.secondary_keywords : [];
    const sv = Array.isArray(m.services) ? m.services : [];
    return [p.keyword, b.primary_keyword].concat(sec, sv).map(x => S(x && typeof x === 'object' ? (x.name || x.title || '') : x)).filter(x => x.trim()).slice(0, 40); };
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
    const add = (topic, source) => { const T = terms(topic); const k = T.req.length ? T.req.join(' ') + (T.lost ? '|' + T.phrase : '') : ''; if (!k || seen.has(k)) return; seen.add(k); out.push({ topic: S(topic).trim(), source }); };
    (Array.isArray(skips) ? skips : []).forEach(t => add(S(t).replace(/[-_]+/g, ' '), 'verdict'));
    (Array.isArray(changes) ? changes : []).forEach(c => fromText(c).forEach(t => add(t, 'verdict_changes')));
    return out.slice(0, 12);
  };
  const topicOf = (ex) => S(ex && typeof ex === 'object' && ex.topic != null ? ex.topic : ex);
  // how a text covers a topic: 'phrase' (the full phrase is in it), 'words' (every word of the topic is in it), or '' (no match)
  const how = (text, ex, family) => {
    const T = terms(topicOf(ex)); if (!T.req.length) return '';
    const fam = famSet(family);
    const own = T.req.filter(w => !fam.has(w));
    if (T.req.length === 1 && !own.length) return '';   // one shared word of the keyword family: never, not even as a phrase
    if (phraseIn(text, T.phrase)) return 'phrase';
    if (T.lost || !own.length) return '';               // lost a short word, or only family words: the full phrase or nothing
    const H = textSet(text);
    return T.req.every(w => H.has(w) || (w[0] === '#' && fam.has(w))) ? 'words' : '';
  };
  const match = (text, ex, family) => !!how(text, ex, family);
  const check = (headings, list, keyword) => {
    const out = [];
    for (const h of (Array.isArray(headings) ? headings : [])) {
      const text = S(h).replace(/^#+\s*/, '').replace(/[*_`]+/g, '').trim(); if (!text) continue;
      const ex = (Array.isArray(list) ? list : []).find(e => match(text, e, keyword));
      if (ex) out.push({ heading: text, topic: topicOf(ex) });
    }
    return out;
  };
  const prune = (outline, list, keyword) => {
    const kept = [], dropped = [];
    for (const sec of (Array.isArray(outline) ? outline : [])) {
      const ex = (Array.isArray(list) ? list : []).find(e => match(S(sec && sec.h2), e, keyword));
      if (ex) dropped.push({ h2: S(sec.h2), topic: topicOf(ex) }); else kept.push(sec);
    }
    return { kept, dropped };
  };
  // ---------- W06-A: the deletion budget ----------
  const BUDGET = { weak_sections: 1, weak_share: 0.2, total_share: 0.4, named: 2 };
  const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const wordsIn = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_`>|]+/g, ' ').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
  const cleanH = (h) => S(h).replace(/^#+\s*/, '').replace(/[*_`]+/g, '').trim();
  // the page's H2 / H3 sections with their own text (an H2 holds its H3s) and the page's words (meta lines and headings left out)
  const sectionsOf = (md) => {
    const lines = S(md).replace(/\r/g, '').split('\n'); const heads = []; let fence = false;
    lines.forEach((l, i) => { if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; } const m = !fence && l.match(/^(#{2,3})\s+(.+?)\s*$/); if (m) heads.push({ i, level: m[1].length, heading: cleanH(m[2]) }); });
    const secs = heads.map((h, k) => { let end = lines.length; for (let j = k + 1; j < heads.length; j++) if (heads[j].level <= h.level) { end = heads[j].i; break; }
      const body = lines.slice(h.i + 1, end).filter(l => !/^#{1,6}\s/.test(l)).join('\n'); return { ...h, end, body, words: wordsIn(body) }; });
    const total = lines.filter(l => l.trim() && !META.test(l.trim()) && !/^#{1,6}\s/.test(l)).reduce((s, l) => s + wordsIn(l), 0);
    return { secs, total };
  };
  // does the section's own text name the topic? at least two of its sentences carry every word of the topic outside the keyword family
  // (its full phrase, for a topic that lost a short word)
  const namedIn = (body, ex, family) => { const T = terms(topicOf(ex)); const fam = famSet(family); const own = T.req.filter(w => !fam.has(w)); if (!own.length) return false;
    const sents = S(body).split(/(?<=[.!?])\s+|\n+/).filter(x => x.trim());
    const n = sents.filter(x => T.lost ? phraseIn(x, T.phrase) : (() => { const H = textSet(x); return own.every(w => H.has(w)); })()).length;
    return n >= BUDGET.named; };
  const decide = (md, list, family, opts) => {
    const o = opts || {}; const L = Array.isArray(list) ? list : []; const only = Array.isArray(o.only) ? new Set(o.only.map(h => cleanH(h).toLowerCase())) : null;
    const { secs, total } = sectionsOf(md);
    const hits = [];
    for (const s of secs) {
      if (only && !only.has(s.heading.toLowerCase())) continue;
      let ex = null, hw = '';
      for (const e of L) { const h = how(s.heading, e, family); if (h === 'phrase') { ex = e; hw = h; break; } if (h && !ex) { ex = e; hw = h; } }
      if (!ex) continue;
      const signal = hw === 'phrase' ? 'the heading names the topic' : namedIn(s.body, ex, family) ? 'the section names the topic' : '';
      hits.push({ s, topic: topicOf(ex), signal });
    }
    const remove = [], keep = []; const gone = []; let removed = 0;
    const inside = (s) => gone.some(g => s.i > g.i && s.i < g.end);
    const pct = (w) => total ? Math.round(100 * w / total) : 0;
    const take = (h, why) => { remove.push({ heading: h.s.heading, topic: h.topic, level: h.s.level, words: h.s.words, share_pct: pct(h.s.words), signal: h.signal || why }); gone.push(h.s); removed += h.s.words; };
    const sorted = hits.slice().sort((a, b) => a.s.level - b.s.level || a.s.i - b.s.i);
    for (const h of sorted.filter(x => x.signal)) {
      if (inside(h.s)) continue;
      if (total && removed + h.s.words > total * BUDGET.total_share) { keep.push({ heading: h.s.heading, topic: h.topic, words: h.s.words, why: 'deleting it would take more than ' + Math.round(BUDGET.total_share * 100) + '% of the page' }); continue; }
      take(h, '');
    }
    const weak = sorted.filter(x => !x.signal && !inside(x.s));
    if (weak.length > BUDGET.weak_sections) for (const h of weak) keep.push({ heading: h.s.heading, topic: h.topic, words: h.s.words,
      why: weak.length + ' sections share words with "' + h.topic + '" and none of them names it: one topic cannot be that much of the page, so none is deleted' });
    else for (const h of weak) {
      if (total && h.s.words > total * BUDGET.weak_share) { keep.push({ heading: h.s.heading, topic: h.topic, words: h.s.words, why: 'it holds ' + pct(h.s.words) + '% of the page and does not name the topic, so it is not deleted' }); continue; }
      if (total && removed + h.s.words > total * BUDGET.total_share) { keep.push({ heading: h.s.heading, topic: h.topic, words: h.s.words, why: 'deleting it would take more than ' + Math.round(BUDGET.total_share * 100) + '% of the page' }); continue; }
      take(h, 'one short section that shares the topic\'s words');
    }
    return { remove, keep, words_total: total, words_removed: removed };
  };
  // a quality check handed over flagged headings (Content QA's excluded_sections): decided again here on the page as it is now, so a list
  // from an older check (or a matcher that went too far) can never delete more than the budget allows
  const guard = (md, flagged, list, family) => {
    const F = (Array.isArray(flagged) ? flagged : []).map(x => cleanH(x && typeof x === 'object' ? x.heading : x)).filter(Boolean);
    if (!F.length) return { remove: [], keep: [], words_total: 0, words_removed: 0 };
    const d = decide(md, list, family, { only: F });
    const named = new Set(d.remove.concat(d.keep).map(x => x.heading.toLowerCase()));
    for (const h of F) if (!named.has(h.toLowerCase())) d.keep.push({ heading: h, topic: '', words: 0, why: 'on a closer reading it is not about a topic the verdict said to leave out' });
    return d;
  };
  // what a page run's deletions took out, from its Page Candidates state (structured since W06-A, else read off its fix notes)
  const removedOf = (state) => {
    const st = state && typeof state === 'object' ? state : {}; const by = new Map();
    for (const r of (Array.isArray(st.exclusions_removed) ? st.exclusions_removed : [])) if (r && r.heading) by.set(cleanH(r.heading).toLowerCase(), { heading: cleanH(r.heading), words: Number(r.words) || 0, level: Number(r.level) || 2, topic: S(r.topic) });
    for (const f of (Array.isArray(st.fixes) ? st.fixes : [])) { const m = S(f).match(/removed the section "(.+)" \(a topic the verdict said to leave out/); if (m && !by.has(cleanH(m[1]).toLowerCase())) by.set(cleanH(m[1]).toLowerCase(), { heading: cleanH(m[1]), words: 0, level: 0, topic: '' }); }
    const list = [...by.values()]; const words = list.reduce((s, x) => s + x.words, 0);
    const first = st.first && typeof st.first === 'object' ? st.first : null;
    return { sections: list.length, words, words_before: first ? Number(first.words) || 0 : 0, h2_before: first ? Number(first.h2) || 0 : 0, h2_removed: list.filter(x => x.level === 2).length, headings: list.map(x => x.heading).slice(0, 12) };
  };
  return { fromVerdict, fromText, match, how, check, prune, toks, terms, familyOf, decide, guard, removedOf, sectionsOf, BUDGET };
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
// C8 (2026-10-22): when the ranking pages of the same kind gave a band (Parse Analysis `length_band`), the brief may plan anywhere inside
// it; outside, it is brought back to the band's median. The verdict's own number still wins, and a band from too few pages (ok: false)
// keeps the old rule (within 10% of the recommended figure).
const LB = (prev.competitor_analysis || {}).length_band || prev.length_band || null;
const useBand = !verdictWords && !!(LB && LB.ok && Number(LB.low) > 0 && Number(LB.high) >= Number(LB.low));
if (baseWords) {
  const lo = useBand ? Number(LB.low) : Math.round(baseWords * 0.9), hi = useBand ? Number(LB.high) : Math.round(baseWords * 1.1);
  const clamped = useBand ? ((askedWords >= lo && askedWords <= hi) ? askedWords : Number(LB.target_word_count) || baseWords) : Math.min(hi, Math.max(lo, askedWords || baseWords));
  if (clamped !== askedWords) {
    adjustments.push('Target length ' + (askedWords || 'unset') + ' -> ' + clamped + ' words (' + (verdictWords ? 'the verdict asked for about ' + verdictWords + ', within 10%' : useBand ? 'the ' + String(LB.basis || 'ranking pages of the same kind') : recWords ? 'the competitor analysis recommends ' + recWords + ', within 10%' : 'the keyword ladder\'s own target is ' + ladderWords + ', within 10%') + ')');
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

// 4b. W06-B (2026-10-30, docs/page-quality-2026-10-29/WAVE05.md 3.3, K1 "ms 365 erp"): after "Write it anyway" on the page the website
//     already has for the search, the Strategy Brief gave the separate new page that page's own slug (ms-365-erp-uae), so the delivered
//     page's suggested address was the very page the client chose to leave as it is: publishing it there would overwrite a page that
//     already earns its place. A NEW page (no page to rewrite, no address the client or a ladder named) never takes the address of a page
//     the website has: the page left alone, the sitemap, the link candidates. Its slug moves to the keyword's own, else a free variant.
(() => {
  const pathK = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '');
  if ((prev.existing_page && prev.existing_page.url) || String(prev.existing_page_url || '').trim() || (prev.ladder_id && String(prev.ladder_target_url || '').trim())) return;
  const asked = pathK(brief.slug);
  if (!asked) return;
  const ign = pathK((prev.existing_page_ignored || {}).url);
  const taken = new Set([ign, ...(prev.site_urls || []).map(pathK), ...(prev.internal_link_candidates || []).map(c => pathK(c && c.url))].filter(Boolean));
  if (!taken.has(asked)) return;
  const slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const type = String(prev.page_type || '').toLowerCase();
  const word = /blog|guide|article|pillar|hub/.test(type) ? 'guide' : /compar/.test(type) ? 'comparison' : /service/.test(type) ? 'services' : 'page';
  const cut = asked.lastIndexOf('/'), dir = cut >= 0 ? asked.slice(0, cut + 1) : '', base = asked.slice(cut + 1), kwS = slugify(prev.keyword);
  const next = [kwS, base + '-' + word, kwS && kwS + '-' + word, base + '-2', base + '-3', base + '-4'].filter(Boolean).map(c => dir + c).find(c => c !== asked && !taken.has(c));
  if (!next) return;
  adjustments.push('Slug "' + asked + '" -> "' + next + '": your website already has a page at /' + asked + (ign === asked ? ' (the page you chose to leave as it is)' : '')
    + ', so this separate new page gets an address of its own and the existing page is not overwritten');
  brief.slug = next;
})();

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