// Cycle Dispatcher: RECORD, then start (the catch-up's rule, R94). The job's seo_cycle_jobs row is written as `starting` BEFORE its run is
// started, with this execution's claim in run_id (`dsp:<execution id>`), so a restart, a second sweep or the Instance Started door can
// never start the same job twice: once this row exists the plan reads it as in flight and looks for its run. *Confirm Cycle Claim* reads it
// back after the save; when two sweeps raced, the claim on the row says which one starts the job. Exact seo_cycle_jobs columns.
const s = $input.first().json || {};
const now = new Date().toISOString();
return [{ json: { key: s.key, site_id: s.site_id, cycle_key: s.cycle_key, job: s.job, workflow_id: s.workflow_id, status: 'starting', attempts: Number(s.attempts) || 1,
  run_id: 'dsp:' + String($execution.id), ledger_key: s.ledger_key, monthly: !!s.monthly, reason: ('starting: ' + String(s.why || '')).slice(0, 600),
  due_at: s.due_at, started_at: now, finished_at: '', updated_at: now } }];
