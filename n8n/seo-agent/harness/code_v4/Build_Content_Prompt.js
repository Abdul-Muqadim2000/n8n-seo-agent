const base = $('Analyze PageSpeed').first().json;
const strip = (s) => String(s || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const picked = $('Pick Key Pages').all().map(i => i.json);
const fetched = $('Fetch Page HTML').all().map(i => i.json);

const parts = [];
picked.forEach((p, i) => {
  if (!p || !p.url) return;
  const f = fetched[i] || {};
  const text = strip(f.html || f.body || f.data || '');
  if (text.length < 200) return;
  parts.push('=== ' + String(p.kind || 'page').toUpperCase() + ': ' + p.url + ' ===\n' + text.slice(0, 2500));
});
const ours = parts.join('\n\n').slice(0, 22000);
const content_skip = ours.length < 800;

const homes = $('Competitor Homes').all().map(i => i.json);
const reads = $input.all().map(i => i.json);
const comp = homes.map((h, i) => h.skip ? '' : '=== COMPETITOR: ' + h.domain + ' ===\n' +
  String((reads[i] || {}).page_text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
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