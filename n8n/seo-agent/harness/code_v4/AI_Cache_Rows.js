// The brand names AI uses for competitors, learned this run (seo_cache key ai_brands:<site>, upsert by key; exact columns).
const rows = $('AI Metrics').all().flatMap(i => i.json.cache_rows || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
