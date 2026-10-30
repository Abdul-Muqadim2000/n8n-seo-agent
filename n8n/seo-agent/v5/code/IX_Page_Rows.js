// Index coverage: the seo_index_pages rows that changed in this run, exact columns (the upsert maps every input field). Unchanged rows are not
// written again.
const rows = $('Index Diagnose').all().map(i => i.json).filter(x => x && x.site_id).flatMap(x => x.upserts || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no page changed' } }];
