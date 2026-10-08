// News that names the business (v4.10, GDELT DOC 2.0 API, free; one request every 5 seconds, so *Fetch News* runs one at a time with a 5.5 s
// pause): articles from the past week (light runs) or 3 months (full runs) in 65 languages. Each article is checked later by fetching it —
// a mention without a link is an outreach prospect, one with a link joins the ledger. The query is the business name when it is distinctive,
// else the domain (a short label like "techand" matches other companies).
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const p of plans) {
  const q = '"' + String(p.brand_query).replace(/"/g, '') + '"';
  out.push({ json: { site_id: p.site_id, domain: p.domain, kind: 'gdelt', url: 'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&maxrecords=' + (p.mode === 'full' ? 75 : 25) + '&timespan=' + (p.mode === 'full' ? '3months' : '8days') + '&query=' + encodeURIComponent(q) } });
}
return out.length ? out : [{ json: { skip: true } }];
