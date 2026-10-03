// After the answer: a newly measured reach goes to seo_cache ('reach:<site_id>', 30 days) for the ladder and discovery (exact columns).
const r = $('Assess Result').first().json.cache_row;
return [{ json: r || { skip: true } }];