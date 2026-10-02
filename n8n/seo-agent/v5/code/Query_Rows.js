// Rows for the Data Table "seo_query_history": every tracked keyword plus the top 100 queries of the period, per site.
const rows = $('Site Metrics').all().flatMap(i => (i.json.query_rows || []).map(r => ({ json: r })));
return rows.length ? rows : [{ json: { skip: true } }];
