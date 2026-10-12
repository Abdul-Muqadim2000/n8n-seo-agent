// D11: the seo_pages rows of this run — exactly the table's columns, only the pages that are new or whose title / source / lastmod / queries
// changed (the upsert keys are site_id + url). The insert gets exactly the columns: a Data Table node auto-maps every field it is given.
const rows = $('Page Inventory (Site)').all().flatMap(i => (i.json.rows || []).map(r => ({ json: r })));
return rows.length ? rows : [{ json: { skip: true } }];
