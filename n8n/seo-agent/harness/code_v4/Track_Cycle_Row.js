// the website's seo_cycles row as Track Cycle Plan built it, exact columns (upserted by site_id; a Data Table save maps every input field)
const COLS = ["site_id", "domain", "anchor_at", "tz", "cycle_weekday", "local_time", "monthly_day", "next_due_at", "next_preview_at", "current_key", "status", "skip_jobs", "last_cycle_at", "last_monthly_key", "adopted", "updated_at"];
const r = $('Track Cycle Plan').first().json.row || {};
return [{ json: Object.fromEntries(COLS.map(c => [c, r[c]])) }];