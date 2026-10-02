// New registration dates to store (seo_cache, upsert by key; exact columns).
const rows = $input.first().json.rows || [];
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];