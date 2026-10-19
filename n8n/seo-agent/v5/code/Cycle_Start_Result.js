// Cycle Dispatcher: what the start did, written back onto the job's row. n8n accepted the run: the row stays `starting` until the run's
// ledger row appears (the next sweep reads it). n8n refused it (e.g. the workflow is not published: "Workflow is not active"): `failed`
// with n8n's own words, and the next sweep starts it again - three attempts in all, then it gives up and the owner is alerted.
const rec = $('Cycle Record Row').first().json || {};
const r = $input.first().json || {};
const err = r.error ? String(r.error.message || r.error).slice(0, 300) : '';
const now = new Date().toISOString();
return [{ json: { ...rec, status: err ? 'failed' : 'starting', reason: (err ? 'the start failed (attempt ' + rec.attempts + '): ' + err : 'started at ' + now + ' (attempt ' + rec.attempts + '): waiting for its ledger row').slice(0, 600), updated_at: now } }];
