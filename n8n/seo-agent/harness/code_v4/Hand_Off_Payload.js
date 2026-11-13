// P1 (2026-11-12): the request this execution started with, handed to a new execution of this workflow that takes over its place in the
// line for a writing slot. n8n measures an execution's time limit from its FIRST start, also across saved Waits (n8n 2.41.4:
// wait-tracker.js resumes with the stored startedAt, workflow-runner.js subtracts the time since it), so a page that waited here for an
// hour would have had too little time left to be written. The new execution reads the same body through *API Entry*, with
// `slot_handoff` = { from_run_id: this execution, queued_at: when the request first joined the line, hops }. Its Rate Limit accepts the
// hand-off only when the ledger holds this execution's row marked `handed_off` for the same request (*Mark Handed Off* ran just before).
const ps = $('Page Slot').first().json || {};
let entry = {};
try { entry = $('API Entry').first().json || {}; } catch (e) { entry = {}; }
const slot_handoff = { from_run_id: String($execution.id), queued_at: String(ps.queued_at || new Date().toISOString()), hops: (Number(ps.hops) || 0) + 1 };
const hasBody = entry && entry.body && typeof entry.body === 'object' && !Array.isArray(entry.body);
return [{ json: hasBody ? { ...entry, body: { ...entry.body, slot_handoff } } : { ...entry, slot_handoff } }];
