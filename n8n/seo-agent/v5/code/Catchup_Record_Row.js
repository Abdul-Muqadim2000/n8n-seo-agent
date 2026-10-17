// R94: RECORD, then start. The idempotency key `catchup:<workflow id>:<due ISO>` goes into seo_cache BEFORE the run is started, so a
// restart and the hourly sweep can never start the same fire twice: once this row exists the planner calls that fire caught up.
// A dry run records under `catchup_dry:`, which production never reads, so a test never uses up a real week's fire.
const s = $input.first().json || {};
const now = new Date().toISOString();
const value = { workflow_id: s.workflow_id, label: s.label, mode: s.mode, scheduled_for: s.scheduled_for, entry: s.entry, status: 'starting',
  attempts: Number(s.attempt) || 1, started_at: now, dry_run: !!s.dry_run, retry_of: s.retry_of || '', why: s.why || '',
  claim: String($execution.id), late_min: Number(s.late_min) || 0 };   // C-1: who claimed the fire (Confirm Claim reads it back: two sweeps racing start it once)
return [{ json: { key: s.key, kind: 'catchup', site_id: '', value: JSON.stringify(value), updated_at: now } }];
