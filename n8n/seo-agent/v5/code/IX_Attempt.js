// Index coverage (fix wave 3, R2): the ATTEMPT row of this website's run, written as soon as the run guard let the run in and BEFORE the
// sitemap rounds, Search Analytics or anything else that can fail. It is an unfinished-run row (`sitemaps_json` `{ reservation: true,
// attempt: true, chain_id }`, nothing inspected, no figures: the app never reads a reservation row as a reading) at this run's site_id +
// run_at; Index Reservation replaces it with the planned inspections and Index Run Rows with the final row. A run that dies before its
// reservation used to leave no row, so the website looked untouched and every one of the day's 30 watches started it again (each one a
// failed execution and an alert); now Index Plan counts it, and after IX.CFG.gave_up_after unfinished runs the website waits for tomorrow.
// The note is plain words for the client (FIX_CONTRACT decision 12; R5).
const S = (v) => String(v == null ? '' : v).trim();
let p = {}; try { p = $('Index Plan').first().json || {}; } catch (e) { p = {}; }
if (!p.site_id || p.nothing_to_do || p.dispatch) return [{ json: { skip: true, reason: 'no website part in this run' } }];
const at = S(p.run_at) || new Date().toISOString();
return [{ json: { site_id: S(p.site_id), domain: S(p.domain), run_at: at, request_id: S(p.request_id),
  known: 0, indexed: 0, not_indexed: 0, excluded: 0, unknown: 0, errors: 0, new_pages: 0, new_indexed: 0, inspected: 0, reused: 0, fetched: 0,
  quota_cap: Number(p.cap) || 0, backlog_left: 0, by_cause_json: '{}', by_action_json: '{}', dropped_json: '[]', freeze: false, freeze_reason: '',
  note: 'Today\'s check started at ' + at.slice(11, 16) + ' UTC and had not finished when this row was written; the figures are from the last check.',
  sitemaps_json: JSON.stringify({ reservation: true, attempt: true, chain_id: S(p.chain_id) }) } }];
