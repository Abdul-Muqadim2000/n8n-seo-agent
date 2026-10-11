// What each won link did for its page (seo_link_impact, upsert by site + linking site + page) (exact columns)
const COLS = ["site_id", "domain", "ref_domain", "from_url", "target_url", "t0", "weeks", "base_position", "base_clicks", "position", "clicks", "page_change", "control_change", "control_spread", "effect", "verdict", "note", "keyword", "updated_at"];
const rows = $('LB Rows').all().flatMap(i => i.json.impact_rows || []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];