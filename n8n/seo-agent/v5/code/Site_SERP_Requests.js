// Live Google check (DataForSEO SERP, top 50, ~$0.015 each) for the site's own tracked keywords. Ladder keywords are checked by the
// Rank Tracker workflow and only read here; keywords without a market (location) are skipped. Max 20 per site.
const sites = $('Resolve Properties').all().map(i => i.json);
const out = [];
sites.forEach((s, idx) => {
  if (!(Number(s.location_code) > 0)) return;
  (s.tracked || []).filter(t => t.source === 'site').slice(0, (s.config || {}).max_serp_checks || 20).forEach(t => out.push({ json: { site_idx: idx, site_id: s.site_id, domain: s.domain, keyword: t.keyword,
    endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: [{ keyword: t.keyword, location_code: Number(s.location_code), language_code: s.language_code || 'en', depth: 50 }] } }));
});
return out.length ? out : [{ json: { skip: true, reason: 'no site keywords to check live' } }];
