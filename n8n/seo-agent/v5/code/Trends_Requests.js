// Google Trends (through DataForSEO) for the head terms: ladder heads first, then the site's own keywords; one keyword per request,
// past 12 months, interest graph + related queries (top / rising). Max 4 per site; $0.011 per request (measured 2026-10-02).
// v4.6: a 12-month curve hardly moves in a week; a keyword fetched in the last 25 days is taken from seo_trends (the report and the Content
// Cadence still see it) instead of being bought again.
const sites = $('Resolve Properties').all().map(i => i.json);
const stored = (() => { try { return $('Load Trends (Site)').all().map(i => i.json).filter(r => r && r.keyword && r.site_id && !r.error); } catch (e) { return []; } })();
const fresh = (sid, kw) => stored.filter(r => r.site_id === sid && String(r.keyword).toLowerCase() === kw && (Date.now() - new Date(r.checked_at).getTime()) / 864e5 < 25).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
const out = []; const cached = [];
sites.forEach((s, idx) => {
  const cfg = s.config || {};
  const kws = [...new Set([...(s.ladder_heads || []), ...(s.keywords || [])].map(k => String(k).toLowerCase().trim()).filter(Boolean))].slice(0, cfg.max_trend_keywords || 4);
  for (const kw of kws) { const f = fresh(s.site_id, kw); if (f) { cached.push({ site_idx: idx, site_id: s.site_id, keyword: kw, row: f }); continue; } out.push({ json: { site_idx: idx, site_id: s.site_id, keyword: kw, endpoint: 'https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live',
    body: [{ keywords: [kw], ...(Number(s.location_code) > 0 ? { location_code: Number(s.location_code) } : {}), type: 'web', time_range: 'past_12_months', item_types: ['google_trends_graph', 'google_trends_queries_list'] }] } }); }
});
if (out.length) out[0].json.cached_trends = cached;
return out.length ? out : [{ json: { skip: true, reason: cached.length ? 'all trends fetched in the last 25 days (taken from seo_trends)' : 'no keywords for a trend check', cached_trends: cached } }];
