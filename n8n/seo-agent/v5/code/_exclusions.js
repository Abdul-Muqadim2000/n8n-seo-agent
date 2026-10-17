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
