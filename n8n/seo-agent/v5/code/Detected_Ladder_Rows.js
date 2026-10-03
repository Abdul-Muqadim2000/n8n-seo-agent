// The ladder rows of the pages found live (seo_ladders, update by ladder_id + keyword: status published, target_url = the live URL, page_exists true).
const rows = $('Detect Published').all().flatMap(i => (i.json && Array.isArray(i.json.ladder_rows)) ? i.json.ladder_rows : []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
