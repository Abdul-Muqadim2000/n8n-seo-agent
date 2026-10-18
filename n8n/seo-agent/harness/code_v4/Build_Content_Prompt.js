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
let __articlesInPrompt = 0;   // B-18: up to 8 articles are fetched for the byline check; only the first two go into the reviewer's prompt
picked.forEach((p, i) => {
  if (!p || !p.url) return;
  if (p.kind === 'article' && ++__articlesInPrompt > 2) return;
  const f = fetched[i] || {};
  const text = strip(f.html || f.body || f.data || '');
  if (text.length < 200) return;
  const alts = altsOf(f.html || f.body || f.data || '');
  parts.push('=== ' + String(p.kind || 'page').toUpperCase() + ': ' + p.url + ' ===\n' + text.slice(0, 2500) + (alts.length ? '\nImages on the page (alt text): ' + alts.map(t => '[image: ' + t + ']').join(' ') : ''));
});
// B-10 (re-rating 2026-10-17): the sections a reader looks for when judging pricing / timelines, from deeper in the pages read and from
// the crawl's headings of the pages not read
const SECT_RE = /\b(pric(?:e|es|ing)|costs?|fees?|budget|quote|timelines?|duration|how long|engagement models?)\b/i;
const sectText = (html) => { const out = []; const h = String(html || ''); const re = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi; let m; const marks = [];
  while ((m = re.exec(h))) marks.push({ at: m.index, end: re.lastIndex, title: strip(m[2]) });
  marks.forEach((k, j) => { if (!SECT_RE.test(k.title) || out.length >= 4) return; const body = strip(h.slice(k.end, j + 1 < marks.length ? marks[j + 1].at : k.end + 6000)).slice(0, 450);
    out.push({ heading: k.title.slice(0, 120), text: body }); });
  return out; };
const readSections = [];
picked.forEach((p, i) => { if (!p || !p.url) return; const f = fetched[i] || {}; const ss = sectText(f.html || f.body || f.data || ''); if (ss.length) readSections.push({ url: p.url, sections: ss }); });
const readUrls = new Set(picked.map(p => p && p.url).filter(Boolean));
const crawlAns10 = (() => { try { return $('Get Crawled Pages Answers').first().json || {}; } catch (e) { return {}; } })();
const crawlUnread10 = !!(crawlAns10.__dfs && crawlAns10.__dfs.unavailable);   // the in-200 gate said the crawl could not be read: no outline, and the prompt says so
const crawlItems10 = crawlUnread10 ? [] : (crawlAns10.tasks?.[0]?.result?.[0]?.items || []);
const outline = crawlItems10.filter(p => p && p.url && !readUrls.has(p.url) && Number(p.status_code) === 200 && !/\/(insights|blog|news|articles?|guides?)\//i.test(p.url))
  .map(p => { const ht = (p.meta || {}).htags || {}; return { url: p.url, headings: [...(ht.h2 || []), ...(ht.h3 || [])].map(x => String(x).trim()).filter(x => SECT_RE.test(x)).slice(0, 4) }; })
  .filter(x => x.headings.length).slice(0, 12);
const extra10 = (readSections.length ? '\n\n=== SECTIONS FURTHER DOWN THE PAGES ABOVE (price, cost, timeline; each page above is cut at 2,500 characters) ===\n'
    + readSections.map(r => r.url + '\n' + r.sections.map(s => '## ' + s.heading + ': ' + s.text).join('\n')).join('\n\n') : '')
  + (outline.length ? '\n\n=== OTHER PAGES OF THIS SITE WITH SUCH SECTIONS (their headings, from the crawl; not read above) ===\n'
    + outline.map(o => o.url + ': ' + o.headings.map(x => '"' + x + '"').join(', ')).join('\n') : '')
  + (crawlUnread10 ? '\n\n=== OTHER PAGES OF THIS SITE: the crawl could not be read, so whether other pages carry price or timeline sections is not known ===' : '');
const room10 = Math.min(extra10.length, 4500);
const ours = parts.join('\n\n').slice(0, 22000 - room10) + extra10.slice(0, room10);
const content_sections = { read: readSections.map(r => ({ url: r.url, headings: r.sections.map(s => s.heading), figures: r.sections.some(s => /(?:AED|USD|EUR|GBP|SAR|\$|€|£)\s?\d|\d[\d,.]*\s?(?:AED|USD|dirhams?)/i.test(s.text)) })), outline, outline_unavailable: crawlUnread10 };
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
    content_sections,   // B-10: what the run knows about price / timeline sections, for Parse Content Review's check
    content_prompt_our: content_skip ? 'NO_CONTENT' : ours,
    content_prompt_comp: comp || 'NO_COMPETITOR_CONTENT'
  }
}];