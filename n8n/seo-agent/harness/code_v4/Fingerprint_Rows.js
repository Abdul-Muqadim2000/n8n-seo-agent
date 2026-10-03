// The sitemap fingerprints to store (seo_cache, upsert by key; exact columns), for started and skipped sites alike.
const rows = $('Audit Schedule Plan').all().map(i => i.json.cache_row).filter(Boolean);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];