// Originality kit (FIX_PLAN G5, 2026-10-13; inlined through the marker /*__SHINGLE__*/).
// The 2026-10-11 review scored originality C5 at 1/10: nothing ever compared the draft with the pages it was written from. Semrush does it
// with Copyleaks, and the convention is a threshold of 10-15% overlap. This kit measures it the way a similarity checker does -- with
// word shingles -- against the texts the run already fetched, so it costs nothing and calls nothing.
//   SHG.N                        the shingle length: 8 words. Eight words in the same order is a quotation, not a coincidence;
//                                shorter windows flag ordinary phrasing ("the first step is to make sure the").
//   SHG.words(text)              the comparable words of a text (markdown, links, HTML and URLs removed, lower case)
//   SHG.shingles(text)           every 8-word window, in order
//   SHG.compare(draft, source)   share of the DRAFT's shingles that the source also carries -- "how much of my page is this page's text"
//                                -> { overlap_pct, matched, total, passages: [{ words, text }] } with the longest runs quoted
//   SHG.common(sets, min)        the shingles several sources share: ordinary phrasing of the subject, reported separately so a figure is
//                                never read as copying from one page
const SHG = (() => {
  const N = 8;
  const S = (v) => String(v == null ? '' : v);
  const norm = (t) => S(t)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (t) => { const s = norm(t); return s ? s.split(' ') : []; };
  const shingles = (t, n) => { const w = words(t); const k = Number(n) || N; const out = [];
    for (let i = 0; i + k <= w.length; i++) out.push(w.slice(i, i + k).join(' '));
    return out; };
  const setOf = (t, n) => new Set(shingles(t, n));
  // The draft's shingles are computed once by the caller and reused for every source.
  const compare = (draftShingles, sourceText, opts) => {
    const o = opts || {};
    const list = Array.isArray(draftShingles) ? draftShingles : shingles(draftShingles, o.n);
    const src = o.sourceSet instanceof Set ? o.sourceSet : setOf(sourceText, o.n);
    const total = list.length;
    if (!total || !src.size) return { overlap_pct: 0, matched: 0, total, passages: [], longest_words: 0 };
    const hit = list.map(s => src.has(s));
    const matched = hit.filter(Boolean).length;
    // consecutive matching windows are one copied passage: a run of r windows is r + N - 1 words
    const k = Number(o.n) || N; const runs = []; let start = -1;
    for (let i = 0; i <= hit.length; i++) {
      if (i < hit.length && hit[i]) { if (start < 0) start = i; continue; }
      if (start >= 0) { runs.push({ from: start, to: i - 1, words: (i - 1 - start) + k }); start = -1; }
    }
    runs.sort((a, b) => b.words - a.words);
    const passages = runs.slice(0, Number(o.passages) || 3).map(r => {
      const text = list[r.from].split(' ').concat(list.slice(r.from + 1, r.to + 1).map(s => s.split(' ')[k - 1])).join(' ');
      return { words: r.words, text: text.length > 160 ? text.slice(0, 157) + '...' : text };
    });
    return { overlap_pct: Math.round((matched / total) * 1000) / 10, matched, total, passages, longest_words: runs.length ? runs[0].words : 0 };
  };
  const common = (sets, min) => {
    const count = new Map();
    for (const s of (Array.isArray(sets) ? sets : [])) for (const sh of s) count.set(sh, (count.get(sh) || 0) + 1);
    const m = Number(min) || 3; const out = new Set();
    for (const [sh, c] of count) if (c >= m) out.add(sh);
    return out;
  };
  return { N, words, shingles, setOf, compare, common, norm };
})();
