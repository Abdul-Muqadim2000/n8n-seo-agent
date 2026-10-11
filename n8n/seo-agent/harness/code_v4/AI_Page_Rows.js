// Key pages checked this week (seo_ai_pages, upsert by site + url) (exact columns)
const COLS = ["site_id", "domain", "url", "kind", "checked_at", "status", "score", "checks_json", "issues", "words_raw", "title", "updated_on", "bing_crawled_at", "bing_status", "submitted_at", "submitted_via", "cited_by", "questions"];
const rows = $('Growth Metrics').all().flatMap(i => i.json.page_rows || []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];