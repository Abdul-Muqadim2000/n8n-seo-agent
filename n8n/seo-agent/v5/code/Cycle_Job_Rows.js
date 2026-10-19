// Cycle Dispatcher: the seo_cycle_jobs rows this sweep changed (exact columns; upsert by key) - outcomes read off the ledger (done,
// refused, failed, gave up), jobs skipped with their reason, jobs of a replaced cycle set aside, and the cycle markers (`<cycle_key>:cycle`).
// The starts are NOT here: each start writes its own row just before it starts (Cycle Record Row). Reads the plan explicitly - the node
// before this one saved Data Table rows and outputs those.
const COLS = __CYCLE_JOBS_COLS__;
const rows = $('Cycle Plan').first().json.job_rows || [];
return rows.length ? rows.map(r => ({ json: Object.fromEntries(COLS.map(c => [c, r[c]])) })) : [{ json: { skip: true } }];
