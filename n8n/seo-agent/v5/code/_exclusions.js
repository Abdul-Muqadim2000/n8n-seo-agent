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
  const famSet = (family) => { const f = new Set(); for (const s of (Array.isArray(family) ? family : [family])) for (const w of terms(s).req) f.add(w); return f; };
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
    return T.req.every(w => H.has(w)) ? 'words' : '';
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
