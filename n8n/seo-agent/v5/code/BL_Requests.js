// Backlink requests per site (DataForSEO Backlinks API, $0.024 per request + $0.000036 per row, measured 2026-10-02). Every run: summary,
// links lost since the last check, new links since the last check. Full runs add: links pointing to broken pages (reclaim), the referring
// domains (to see which prospects linked), 12 months of history, unlinked brand mentions (Content Analysis) and, once, the competitors.
// v4.10: full runs also read one link per referring domain with its details (placement on the page, inserted later or there from the start,
// the linking page's own rankings = indexed and visited), the anchor texts, the site's most-linked pages, and each competitor's new links
// since the last full run (a site that just linked to a competitor is the warmest prospect).
const API = 'https://api.dataforseo.com/v3/';
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
const add = (p, kind, endpoint, body, extra = {}) => out.push({ json: { site_id: p.site_id, domain: p.domain, kind, endpoint: API + endpoint, body: [body], ...extra } });
const ymd = (d) => d.toISOString().slice(0, 10);
for (const p of plans) {
  if (p.free_only) continue;   // v4.10: free sources only
  const t = p.domain;
  add(p, 'summary', 'backlinks/summary/live', { target: t, include_subdomains: true, internal_list_limit: 10, backlinks_status_type: 'live' });
  add(p, 'lost', 'backlinks/backlinks/live', { target: t, mode: 'as_is', backlinks_status_type: 'lost', filters: ['last_seen', '>', p.since], order_by: ['domain_from_rank,desc'], limit: 100 });
  add(p, 'new', 'backlinks/backlinks/live', { target: t, mode: 'one_per_domain', backlinks_status_type: 'live', filters: ['first_seen', '>', p.since], order_by: ['domain_from_rank,desc'], limit: 100 });
  if (p.mode !== 'full') continue;
  add(p, 'broken', 'backlinks/backlinks/live', { target: t, mode: 'as_is', filters: ['is_broken', '=', true], order_by: ['domain_from_rank,desc'], limit: 50 });
  add(p, 'refdomains', 'backlinks/referring_domains/live', { target: t, backlinks_status_type: 'live', order_by: ['rank,desc'], limit: 1000 });
  add(p, 'links', 'backlinks/backlinks/live', { target: t, mode: 'one_per_domain', backlinks_status_type: 'live', order_by: ['domain_from_rank,desc'], limit: 500 });
  add(p, 'anchors', 'backlinks/anchors/live', { target: t, backlinks_status_type: 'live', order_by: ['referring_domains,desc'], limit: 50 });
  add(p, 'pages', 'backlinks/domain_pages/live', { target: t, backlinks_status_type: 'live', order_by: ['page_summary.referring_domains,desc'], limit: 50 });
  const haveHistory = (p.stored_timeseries || []).length >= 6;   // stored months are kept; only the last 2 months are fetched again (v4.6)
  add(p, 'timeseries', 'backlinks/timeseries_summary/live', { target: t, date_from: ymd(new Date(Date.now() - (haveHistory ? 62 : 365) * 864e5)), date_to: ymd(new Date()), group_range: 'month' });
  for (const b of p.brand_names) add(p, 'mentions', 'content_analysis/search/live', { keyword: b, search_mode: 'as_is', limit: 50 });
  if (p.need_competitors) add(p, 'competitors', 'dataforseo_labs/google/competitors_domain/live', { target: t, location_code: p.location_code, language_code: p.language_code, limit: 10, exclude_top_domains: true });
  for (const c of p.competitors) add(p, 'comp_new', 'backlinks/backlinks/live', { target: c, mode: 'one_per_domain', backlinks_status_type: 'live', filters: [['first_seen', '>', p.since_full], 'and', ['dofollow', '=', true]], order_by: ['domain_from_rank,desc'], limit: 30 }, { competitor: c });
}
return out.length ? out : [{ json: { skip: true } }];
