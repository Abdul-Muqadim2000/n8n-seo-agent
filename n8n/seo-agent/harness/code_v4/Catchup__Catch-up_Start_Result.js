// R94: what the start did, written back onto its record. `started` = n8n accepted the execution (the started run then passes its own
// ledger reservation and concurrency gate); `start_failed` = it did not (e.g. the workflow is not published), and the next sweep
// tries once more. A start the target's gate refused is read from the ledger by the planner, not guessed here.
const rec = $('Catch-up Record Row').first().json || {};
const r = $input.first().json || {};
let v = {}; try { v = JSON.parse(rec.value || '{}'); } catch (e) { v = {}; }
const err = r.error ? String(r.error.message || r.error).slice(0, 300) : '';
const now = new Date().toISOString();
v.status = err ? 'start_failed' : 'started'; v.error = err; v.start_checked_at = now;
return [{ json: { key: rec.key, kind: 'catchup', site_id: '', value: JSON.stringify(v), updated_at: now } }];
