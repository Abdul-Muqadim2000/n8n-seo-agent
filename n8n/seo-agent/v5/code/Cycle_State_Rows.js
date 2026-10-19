// Cycle Dispatcher: the seo_cycles rows this sweep changed (exact columns; upsert by site_id) - a cycle opened (current_key, last_cycle_at,
// last_monthly_key), the next due time and the preview 48 h before it, or a website adopted. Nothing in a plan-only or dry run.
const COLS = __CYCLES_COLS__;
const rows = $('Cycle Plan').first().json.cycle_rows || [];
return rows.length ? rows.map(r => ({ json: Object.fromEntries(COLS.map(c => [c, r[c]])) })) : [{ json: { skip: true } }];
