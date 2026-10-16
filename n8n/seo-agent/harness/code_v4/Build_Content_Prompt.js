const base = $('Analyze PageSpeed').first().json;
const entDecode = (() => {
  const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
  return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
    if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
    const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
  });
})();   // R62: named + decimal + hex entities, one pass (v5/code/_entities.js)
const strip = (s) => entDecode(String(s || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// R76: the alt text of the images (a partner badge, a client logo, a certification mark is usually an image) was thrown away with the tags, so the review said "no badges" over a badge
const altsOf = (html) => { const seen = new Set(); const out = []; for (const m of String(html || '').matchAll(/<img\b[^>]*>/gi)) { const am = m[0].match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i); const t = am ? entDecode(am[1] ?? am[2] ?? '').replace(/\s+/g, ' ').trim() : ''; if (t.length < 3 || t.length > 100) continue; const k = t.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(t); if (out.length >= 20) break; } return out; };

const picked = $('Pick Key Pages').all().map(i => i.json);
const fetched = $('Fetch Page HTML').all().map(i => i.json);

const parts = [];
picked.forEach((p, i) => {
  if (!p || !p.url) return;
  const f = fetched[i] || {};
  const text = strip(f.html || f.body || f.data || '');
  if (text.length < 200) return;
  const alts = altsOf(f.html || f.body || f.data || '');
  parts.push('=== ' + String(p.kind || 'page').toUpperCase() + ': ' + p.url + ' ===\n' + text.slice(0, 2500) + (alts.length ? '\nImages on the page (alt text): ' + alts.map(t => '[image: ' + t + ']').join(' ') : ''));
});
const ours = parts.join('\n\n').slice(0, 22000);
const content_skip = ours.length < 800;

const homes = $('Competitor Homes').all().map(i => i.json);
const reads = $input.all().map(i => i.json);
const comp = homes.map((h, i) => h.skip ? '' : '=== COMPETITOR: ' + h.domain + ' ===\n' +
  String((reads[i] || {}).page_text || '')
    .replace(/!\[([^\]]{3,100})\]\([^)]*\)/g, ' [image: $1] ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ').slice(0, 3000)).filter(t => t.length > 300).join('\n\n');

return [{
  json: {
    ...base,
    content_skip,
    content_pages_read: parts.length,
    content_prompt_our: content_skip ? 'NO_CONTENT' : ours,
    content_prompt_comp: comp || 'NO_COMPETITOR_CONTENT'
  }
}];