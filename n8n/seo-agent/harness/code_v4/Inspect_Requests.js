// URL Inspection (Search Console) for the ladder pages: is each planned/written page indexed? Only on connected properties, max 20 per site.
const sites = $('Resolve Properties').all().map(i => i.json);
const out = [];
sites.forEach((s, idx) => { if (!s.gsc_connected) return;
  // only pages that exist on the site (published, or existing before the ladder); planned and written-but-unpublished pages are not live yet (live finding 2026-10-02)
  (s.ladder_pages || []).filter(p => p.page_exists || p.status === 'published').slice(0, (s.config || {}).max_inspections || 20).forEach(p => out.push({ json: { site_idx: idx, site_id: s.site_id, keyword: p.keyword, rung: p.rung, status: p.status, inspect_url: p.url, body: { inspectionUrl: p.url, siteUrl: s.gsc_property, languageCode: 'en-US' } } })); });
return out.length ? out : [{ json: { skip: true, reason: 'no ladder pages to inspect on a connected property' } }];
