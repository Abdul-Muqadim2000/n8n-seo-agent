// One seo_ai_daily row per site and day (upsert by site + date; exact columns). The weekly AI visibility run adds them to its figures.
const rows = $('Pulse Metrics').all().map(i => i.json.daily_row).filter(r => r && r.samples > 0);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];