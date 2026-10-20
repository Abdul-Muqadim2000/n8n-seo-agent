// Cycle Dispatcher: the run-ledger reservations of runs n8n reports crashed, canceled or ended in an error, released before anything starts.
// Such a row is still `reserved` and would hold the run guard for the 2 hours *Release Stale Runs* waits - the retry would be refused as its
// own twin. F-REH (2026-10-20, real-credit rehearsal): not only the dispatcher's own jobs - EVERY reservation younger than the stale window
// whose execution is dead, finished without settling, or gone (CYC.plan `ghosts`): a deploy's restart crashed a `keyword` run and its row
// refused the client's first Site Tracker run as "another analysis in flight". It is marked `stale`, the state that node writes (only a row
// still `reserved`; a run that settled meanwhile keeps its row), and its cost_basis (400 characters) says why, beside what the reservation
// said - the reason is shortened to fit, never the reservation's own words.
// Reads the plan explicitly - the node before this one saved Data Table rows.
const rows = $('Cycle Plan').first().json.release || [];
const HEAD = 'stale (released by the cycle dispatcher): ';
const basis = (r) => { const was = r.was ? ' | the reservation said: ' + String(r.was).slice(0, 120) : '';
  const why = String(r.reason || 'its run is no longer running'), room = Math.max(60, 400 - HEAD.length - was.length);
  return (HEAD + (why.length > room ? why.slice(0, room - 3) + '...' : why) + was).slice(0, 400); };
return rows.length ? rows.map(r => ({ json: { run_id: String(r.run_id), key: r.key, reason: String(r.reason || '').slice(0, 300), ghost: !!r.ghost, cost_basis: basis(r) } })) : [{ json: { skip: true } }];
