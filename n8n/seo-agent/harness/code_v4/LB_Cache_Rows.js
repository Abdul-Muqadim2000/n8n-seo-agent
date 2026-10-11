// When the monthly searches last ran (seo_cache linkbld:<site>) (exact columns)
const COLS = ["key", "kind", "site_id", "value", "updated_at"];
const rows = $('LB Rows').all().flatMap(i => i.json.cache_rows || []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];