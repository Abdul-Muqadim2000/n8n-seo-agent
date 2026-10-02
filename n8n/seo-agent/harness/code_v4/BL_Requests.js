// Backlink requests per site (DataForSEO Backlinks API, $0.024 per request + $0.000036 per row, measured 2026-10-02). Every run: summary,
// links lost since the last check, new links since the last check. Full runs add: links pointing to broken pages (reclaim), the referring
// domains (to see which prospects linked), 12 months of history, unlinked brand mentions (Content Analysis) and, once, the competitors.
const API = 'https://api.dataforseo.com/v3/';
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
const add = (p, kind, endpoint, body) => out.push({ json: { site_id: p.site_id, domain: p.domain, kind, endpoint: API + endpoint, body: [body] } });
const ymd = (d) => d.toISOString().slice(0, 10);
for (const p of plans) {
  const t = p.domain;
  add(p, 'summary', 'backlinks/summary/live', { target: t, include_subdomains: true, internal_list_limit: 10, backlinks_status_type: 'live' });
  add(p, 'lost', 'backlinks/backlinks/live', { target: t, mode: 'as_is', backlinks_status_type: 'lost', filters: ['last_seen', '>', p.since], order_by: ['domain_from_rank,desc'], limit: 100 });
  add(p, 'new', 'backlinks/backlinks/live', { target: t, mode: 'one_per_domain', backlinks_status_type: 'live', filters: ['first_seen', '>', p.since], order_by: ['domain_from_rank,desc'], limit: 100 });
  if (p.mode !== 'full') continue;
  add(p, 'broken', 'backlinks/backlinks/live', { target: t, mode: 'as_is', filters: ['is_broken', '=', true], order_by: ['domain_from_rank,desc'], limit: 50 });
  add(p, 'refdomains', 'backlinks/referring_domains/live', { target: t, backlinks_status_type: 'live', order_by: ['rank,desc'], limit: 500 });
  add(p, 'timeseries', 'backlinks/timeseries_summary/live', { target: t, date_from: ymd(new Date(Date.now() - 365 * 864e5)), date_to: ymd(new Date()), group_range: 'month' });
  for (const b of p.brand_names) add(p, 'mentions', 'content_analysis/search/live', { keyword: b, search_mode: 'as_is', limit: 50 });
  if (p.need_competitors) add(p, 'competitors', 'dataforseo_labs/google/competitors_domain/live', { target: t, location_code: p.location_code, language_code: p.language_code, limit: 10, exclude_top_domains: true });
}
return out.length ? out : [{ json: { skip: true } }];
