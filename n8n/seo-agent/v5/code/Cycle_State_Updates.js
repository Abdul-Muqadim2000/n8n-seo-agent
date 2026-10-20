// Cycle Dispatcher (F-ENG 2026-10-20): the seo_cycles rows that exist and this sweep changed - a cycle opened (current_key, last_cycle_at,
// last_monthly_key), the next due time and the preview 48 h before it, a zone or domain filled in - written as an UPDATE by site_id of only
// those fields (+ updated_at). The app writes the same row (PATCH .../cycle {weekday}); writing every column from the snapshot this sweep
// read would put back a weekday the owner changed while it ran. cycle_weekday is written only when the sweep itself changed it.
// Reads the plan explicitly - the node before this one saved Data Table rows and outputs those.
const COLS = new Set(__CYCLES_COLS__);
const rows = ($('Cycle Plan').first().json.cycle_rows || []).filter(r => r && r.created !== true && Array.isArray(r.changed) && r.changed.length);
const out = rows.map(r => { const f = [...new Set(['site_id', ...r.changed.filter(c => COLS.has(c) && c !== 'site_id'), 'updated_at'])]; return { json: Object.fromEntries(f.map(c => [c, r[c]])) }; });
return out.length ? out : [{ json: { skip: true } }];
