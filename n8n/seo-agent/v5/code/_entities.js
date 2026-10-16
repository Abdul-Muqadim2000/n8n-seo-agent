// R62 (2026-10-16, re-rating 2026-10-15): ONE HTML entity decoder — named, decimal AND hex (&#x27; is what React / Next.js emit for an apostrophe) —
// read in a single pass, so "&amp;#x27;" is the text "&#x27;" and never a double decode. The link kit's `ent` (v5/code/_link_kit.js) carries the same
// function body; the Build Content Prompt and Analyze HTML nodes inline this file. Everything between the two markers is the expression.
/*__ENT_BEGIN__*/(() => {
  const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
  return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
    if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
    const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
  });
})()/*__ENT_END__*/
