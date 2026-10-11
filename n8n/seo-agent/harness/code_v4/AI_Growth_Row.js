// One seo_ai_growth row per site and run (exact columns)
const COLS = ["site_id", "domain", "run_id", "checked_at", "submitted", "submitted_json", "indexnow", "pages_checked", "avg_score", "pages_json", "targets_json", "earned_json", "entity_json", "actions_json", "alerts", "cost_usd"];
const rows = $('Growth Metrics').all().flatMap(i => i.json.growth_row ? [i.json.growth_row] : []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];