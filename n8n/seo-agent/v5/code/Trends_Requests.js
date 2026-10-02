// Google Trends (through DataForSEO) for the head terms: ladder heads first, then the site's own keywords; one keyword per request,
// past 12 months, interest graph + related queries (top / rising). Max 4 per site; $0.011 per request (measured 2026-10-02).
const sites = $('Resolve Properties').all().map(i => i.json);
const out = [];
sites.forEach((s, idx) => {
  const cfg = s.config || {};
  const kws = [...new Set([...(s.ladder_heads || []), ...(s.keywords || [])].map(k => String(k).toLowerCase().trim()).filter(Boolean))].slice(0, cfg.max_trend_keywords || 4);
  for (const kw of kws) out.push({ json: { site_idx: idx, site_id: s.site_id, keyword: kw, endpoint: 'https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live',
    body: [{ keywords: [kw], ...(Number(s.location_code) > 0 ? { location_code: Number(s.location_code) } : {}), type: 'web', time_range: 'past_12_months', item_types: ['google_trends_graph', 'google_trends_queries_list'] }] } });
});
return out.length ? out : [{ json: { skip: true, reason: 'no keywords for a trend check' } }];
