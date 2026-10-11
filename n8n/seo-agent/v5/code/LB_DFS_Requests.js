// Competitors' broken backlinks (DataForSEO Backlinks, monthly, not in free-only checks, ≈ $0.02 a competitor): sites that link to a
// competitor page that is now gone (4xx / 5xx) — the link they lost is an opening for ours ("broken link building").
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.due && p.due.broken);
const out = [];
for (const p of plans) for (const c of p.competitors.slice(0, 3)) out.push({ json: { site_id: p.site_id, competitor: c, endpoint: 'https://api.dataforseo.com/v3/backlinks/backlinks/live',
  body: [{ target: c, mode: 'as_is', filters: [['is_broken', '=', true], 'and', ['dofollow', '=', true]], order_by: ['domain_from_rank,desc'], limit: 40, include_subdomains: true }] } });
return out.length ? out : [{ json: { skip: true } }];
