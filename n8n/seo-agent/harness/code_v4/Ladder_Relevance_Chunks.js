// Splits the top candidates into chunks of 80 for the AI relevance pass (the agent runs once per item).
const d = $input.first().json;
const c = (d.research || {}).candidates || [];
const size = 80, chunks = [];
for (let i = 0; i < c.length; i += size) chunks.push(c.slice(i, i + size));
if (!chunks.length) chunks.push([]);
const sd = d.site_description || {};
// 2026-10-11 (FIX_PLAN D8): the AI screen is told which names are other companies' brands — the ladder pool's list (other_brands), else the
// labels of the declared competitors and of the auto-detected rivals (discovery: research.competitor_domains)
const brandLabel = (dom) => String(dom || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const brandDomains = [...new Set([...(d.competitors || []), ...((d.research || {}).competitor_domains || []), ...((d.competitors_summary || []).map(c => c.domain))].map(brandLabel).filter(x => x && x !== brandLabel(d.domain)))];
const other_brands = String(d.other_brands || '') || brandDomains.map(x => x.split('.')[0] + ' (' + x + ')').slice(0, 40).join(', ');
const ctx = {
  business: d.business || sd.business_description || 'unknown', audience: d.audience || (sd.target_audience || []).join(', ') || 'unknown',
  services: [...(d.services || []), ...(sd.products_or_services || [])].filter(Boolean).slice(0, 12).join(', ') || 'unknown',
  country: d.country, goal: d.goal || 'leads', domain: d.domain || '', other_brands: other_brands || 'none known'
};
return chunks.map((ch, i) => ({ json: { ...ctx, chunk_index: i + 1, chunk_total: chunks.length, chunk_size: ch.length,
  keywords_chunk: ch.map((k, j) => ({ n: j + 1, keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent })),
  keywords_text: ch.map((k, j) => `${j + 1}. ${k.keyword} (searches/mo ${k.volume}, difficulty ${k.kd ?? '?'}, ${k.intent})`).join('\n') } }));
