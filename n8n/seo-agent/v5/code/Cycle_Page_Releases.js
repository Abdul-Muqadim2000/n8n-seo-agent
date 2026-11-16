// P1 (2026-11-12, prod review S1-05): the content-log rows of the page runs this sweep released (CYC.pageReleases). A page run that died
// (canceled at the time limit, crashed, gone from n8n) left the row its start opened saying `started`, which the app and the Content Cadence
// read as a page on its way. Each becomes `failed` with the reason (*Mark Dead Pages (Cycle)*), and an AI question it was writing goes back
// to `queued` (*Requeue Dead AI Targets (Cycle)*). Reads the plan explicitly: the nodes before this one saved Data Table rows.
/*__CATCHUP__*/
/*__CYCLE__*/
// review S1 (2026-11-12): only the runs whose row *Release Dead Runs* really moved to `stale`. The plan reads the ledger before it reads the
// executions, so a run that handed its wait on in between (its row `handed_off`, its execution ended `success`) is in the plan's list
// although it is alive in a new execution: the update matched nothing, and its page must not be freed.
let released = new Set();
try { released = new Set($('Release Dead Runs').all().map(i => i.json || {}).filter(r => r && r.run_id && String(r.status || '') === 'stale').map(r => String(r.run_id))); } catch (e) { released = new Set(); }
const release = ($('Cycle Plan').first().json.release || []).filter(r => r && released.has(String(r.run_id)));
let rows = []; try { rows = $input.all().map(i => i.json || {}).filter(r => r && r.request_id && !r.error); } catch (e) { rows = []; }
const out = CYC.pageReleases(release, rows);
return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];
