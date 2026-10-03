// The seo_content_log rows of the pages found live (upsert by site_id + keyword; exactly the table columns, as "I published a page" writes them).
const rows = $('Detect Published').all().flatMap(i => (i.json && Array.isArray(i.json.log_rows)) ? i.json.log_rows : []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
