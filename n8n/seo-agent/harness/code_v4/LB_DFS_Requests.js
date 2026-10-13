// Competitors' broken backlinks (DataForSEO Backlinks, monthly, not in free-only checks, ≈ $0.02 a competitor): sites that link to a
// competitor page that is now gone (4xx / 5xx) — the link they lost is an opening for ours ("broken link building").
// L6 (2026-10-13): and their most-linked pages (`backlinks/domain_pages`, monthly, ≈ $0.02 a competitor) — what kind of page earns
// links in this market, and how many referring domains each one holds. Every request says which kind it is: the parsers filter on it.
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.due && (p.due.broken || p.due.assets));
const out = [];
for (const p of plans) for (const c of p.competitors.slice(0, 3)) {
  if (p.due.broken) out.push({ json: { site_id: p.site_id, kind: 'broken', competitor: c, endpoint: 'https://api.dataforseo.com/v3/backlinks/backlinks/live',
    body: [{ target: c, mode: 'as_is', filters: [['is_broken', '=', true], 'and', ['dofollow', '=', true]], order_by: ['domain_from_rank,desc'], limit: 40, include_subdomains: true }] } });
  if (p.due.assets) out.push({ json: { site_id: p.site_id, kind: 'pages', competitor: c, endpoint: 'https://api.dataforseo.com/v3/backlinks/domain_pages/live',
    body: [{ target: c, limit: 25, order_by: ['referring_domains,desc'], filters: [['referring_domains', '>', 2]], include_subdomains: true }] } });
}
return out.length ? out : [{ json: { skip: true } }];
