// After the answer: a newly measured reach goes to seo_cache ('reach:<site_id>', 30 days) for the ladder and discovery (exact columns),
// and (KW-SERP, 2026-10-21) a fresh results-page reading ('serp:<keyword>|<location>|<language>|<device>', today) for every other path.
const a = $('Assess Result').first().json;
const rows = [a.cache_row, a.serp_cache_row].filter(Boolean);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];