// F2 (2026-10-23, ENGINE_AUDIT.md E17 / E1): the callers that must hear something NOW, one item per callback (`{callback_url, body}`):
//  * read from *AI Plan* (node "Open Run Notices (AI)" on the run's path, "Busy Notices (AI)" on the nothing-to-do path): an on-demand
//    check that met an open run of the same website — still being asked, resumed by this start, or stopped — is answered at once with a
//    `rejected` callback (reason 'open_run': the run's id, its progress, when it should finish; the app closes the request with that
//    sentence and charges nothing) instead of silence or of taking over the open run's caller;
//  * read from *AI Chunk Handoff* (node "Stop Notices (AI)"): an on-demand run that had to STOP tells its own caller why (reason 'run_stopped').
// A scheduled run has nobody waiting: it posts nothing (its ops alert and its state row keep the reason).
const SRC = 'AI Chunk Handoff';
let items = []; try { items = $(SRC).all().map(i => i.json || {}); } catch (e) { items = []; }
const notices = items.flatMap(j => Array.isArray(j.notices) ? j.notices : []).filter(n => n && n.callback_url && n.body);
return notices.length ? notices.map(n => ({ json: n })) : [{ json: { skip: true } }];
