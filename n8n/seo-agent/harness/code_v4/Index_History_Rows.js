// Index coverage: one seo_index_history row per page whose state or cause changed in this run (insert only; exact columns). Read from Index
// Diagnose, because the upsert before it answers with the rows it wrote.
const rows = $('Index Diagnose').all().map(i => i.json).filter(x => x && x.site_id).flatMap(x => x.history || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no state changed' } }];
