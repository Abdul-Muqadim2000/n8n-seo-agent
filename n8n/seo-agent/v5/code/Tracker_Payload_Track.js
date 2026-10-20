// What the Site Tracker receives through its "Manual Run" trigger: run this one site now (first report in a few minutes).
// F-REH (2026-10-20, real-credit rehearsal): THIS run's own execution id as `parent_run_id`, exactly as Monitor Start does for the monitors (R77).
// The Site Tracker's ledger row then names it (key `parent:<id>`, Monitor_Ledger_Row.js) and its run guard does not count this "Track my site"
// run - still `reserved` while it hands over - as another analysis in flight. Without it the rehearsal's first Site Tracker run read "3 other
// run(s) in flight (keyword, track, ladder)" and was refused `too_many_open`; nobody retried it.
const r = $('Site Row (Track)').first().json; let saved = {}; try { saved = ($('Save Site (Track)').first() || {}).json || {}; } catch (e) {}
return [{ json: { site_id: r.site_id, domain: r.domain, on_demand: true, request_id: r.request_id || '', stored: !saved.error, store_error: saved.error ? String((saved.error.message || saved.error.description || saved.error)).slice(0, 200) : null,
  parent_run_id: String($execution.id) } }];
