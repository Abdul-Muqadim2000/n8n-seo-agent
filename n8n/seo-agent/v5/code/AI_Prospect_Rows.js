// Sites AI cites become link / PR prospects (type ai_source) in seo_link_prospects, next to the Backlink Monitor's prospects; statuses are kept.
const rows = $('AI Metrics').all().flatMap(i => i.json.prospect_rows || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
