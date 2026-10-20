// Cycle Dispatcher: the NEW seo_cycles rows of this sweep (a website adopted: exact columns, upsert by site_id). A row that already exists is
// never written whole from this sweep's snapshot - *Cycle State Updates* writes only the fields the sweep changed (F-ENG 2026-10-20), so an
// app PATCH of the weekday made while the sweep ran is never put back. Nothing in a plan-only or dry run.
const COLS = __CYCLES_COLS__;
const rows = ($('Cycle Plan').first().json.cycle_rows || []).filter(r => r && r.created === true);
return rows.length ? rows.map(r => ({ json: Object.fromEntries(COLS.map(c => [c, r[c]])) })) : [{ json: { skip: true } }];
