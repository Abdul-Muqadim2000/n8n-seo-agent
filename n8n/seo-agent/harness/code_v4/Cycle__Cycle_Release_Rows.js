// Cycle Dispatcher: the run-ledger reservations of runs n8n reports crashed or canceled, released before anything starts. Such a row is
// still `reserved` and would hold the run guard for the 2 hours *Release Stale Runs* waits - the retry would be refused as its own twin.
// It is marked `stale`, the state that node writes (only a row still `reserved`; a run that settled meanwhile keeps its row). Reads the
// plan explicitly - the node before this one saved Data Table rows.
const rows = $('Cycle Plan').first().json.release || [];
return rows.length ? rows.map(r => ({ json: { run_id: String(r.run_id), key: r.key, reason: String(r.reason || '').slice(0, 300) } })) : [{ json: { skip: true } }];
