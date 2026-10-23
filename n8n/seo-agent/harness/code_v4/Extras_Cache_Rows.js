// W2-E3: the results pages the fan-out check read now (seo_cache `serp:`, exact columns), so every path of this site reads them for nothing today.
const rows = $('AI Extras').all().flatMap(i => (i.json || {}).cache_rows || []);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];