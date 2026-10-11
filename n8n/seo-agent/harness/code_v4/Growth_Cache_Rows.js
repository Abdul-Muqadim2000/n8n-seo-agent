// The site's IndexNow key (seo_cache indexnow:<site_id>) (exact columns)
const COLS = ["key", "kind", "site_id", "value", "updated_at"];
const rows = $('Growth Metrics').all().flatMap(i => i.json.cache_rows || []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];