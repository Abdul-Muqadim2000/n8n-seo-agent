// Cycle Dispatcher: RECORD, then start (the catch-up's rule, R94). The job's seo_cycle_jobs row is written as `starting` BEFORE its run is
// started, with this sweep's claim in run_id, so a restart, a second sweep or the Instance Started door never starts the same job twice:
// once this row exists the plan reads it as in flight and looks for its run. Exact seo_cycle_jobs columns.
// F-ENG (2026-10-20), the claim made strong. Two sweeps could plan from one snapshot and both start the job, because a read-back after the
// save only catches writes that overlap. Now: (1) *Read Claim (Cycle)* reads the row just before this node, and the claim is written only
// when the row is still what the plan saw (CYC.claimFree: same status, claim and write time; no row when the plan saw none) - a row another
// sweep recorded after this plan backs this one off; (2) the claim is a token nobody else can write (CYC.claimToken: this execution, the
// moment, a random part); (3) after the save the claim is held a moment and read back (*Confirm Cycle Claim*): the last writer starts.
/*__CATCHUP__*/
/*__CYCLE__*/
const s = $('Loop Cycle Starts').first().json || {};
const now = new Date().toISOString();
const free = CYC.claimFree(s.expect || null, $('Read Claim (Cycle)').all().map(i => i.json || {}));   // the row as it is now, read just before
if (!free.ok) return [{ json: { skip: true, key: s.key || '', reason: free.reason } }];
return [{ json: { key: s.key, site_id: s.site_id, cycle_key: s.cycle_key, job: s.job, workflow_id: s.workflow_id, status: 'starting', attempts: Number(s.attempts) || 1,
  run_id: CYC.claimToken($execution.id, now, Math.random().toString(36).slice(2, 10)), ledger_key: s.ledger_key, monthly: !!s.monthly, reason: ('starting: ' + String(s.why || '')).slice(0, 600),
  due_at: s.due_at, started_at: now, finished_at: '', updated_at: now } }];
