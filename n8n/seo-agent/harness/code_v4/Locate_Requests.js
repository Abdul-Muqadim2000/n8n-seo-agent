// Find the linking page for referrers known only by domain (v4.10): GA4 usually reports just the referring site (browsers send the origin),
// the Search Console "Top linking sites" table and the Common Crawl graph have no URLs. A `site:<referrer> "<your domain>"` web search through
// the stack's SearXNG finds the page (live 2026-10-08: GA4 said peppol.org; the search found peppol.org/members/full-members-list/, which the
// link check confirmed as a followed link). The most valuable referrers first: visits, then authority; 6 per site on full runs, 3 on light runs.
const merged = $('Link Merge').all().map(i => i.json).filter(m => !m.skip);
const out = [];
for (const m of merged) {
  const want = m.entries.filter(e => e.kind === 'web' && !e.from_url && !(e.prev && e.prev.from_url) && e.sources.some(s => ['ga4', 'gsc', 'cc', 'import', 'bing'].includes(s)))
    .sort((a, b) => (b.visits - a.visits) || ((b.authority || 0) - (a.authority || 0)) || ((a.cc_rank || 9e9) - (b.cc_rank || 9e9))).slice(0, m.mode === 'full' ? 6 : 3);
  for (const e of want) out.push({ json: { site_id: m.site_id, domain: m.domain, ref_domain: e.ref_domain, url: 'http://searxng:8080/search?format=json&q=' + encodeURIComponent('site:' + e.ref_domain + ' "' + m.domain + '"') } });
}
return out.length ? out : [{ json: { skip: true } }];
