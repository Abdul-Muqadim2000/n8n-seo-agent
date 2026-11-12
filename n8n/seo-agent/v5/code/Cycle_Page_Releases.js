// P1 (2026-11-12, prod review S1-05): the content-log rows of the page runs this sweep released (CYC.pageReleases). A page run that died
// (canceled at the time limit, crashed, gone from n8n) left the row its start opened saying `started`, which the app and the Content Cadence
// read as a page on its way. Each becomes `failed` with the reason (*Mark Dead Pages (Cycle)*), and an AI question it was writing goes back
// to `queued` (*Requeue Dead AI Targets (Cycle)*). Reads the plan explicitly: the nodes before this one saved Data Table rows.
/*__CATCHUP__*/
/*__CYCLE__*/
const release = $('Cycle Plan').first().json.release || [];
let rows = []; try { rows = $input.all().map(i => i.json || {}).filter(r => r && r.request_id && !r.error); } catch (e) { rows = []; }
const out = CYC.pageReleases(release, rows);
return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];
