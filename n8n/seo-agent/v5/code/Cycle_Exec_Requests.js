// Cycle Dispatcher: the reads of n8n's own public API the plan needs about the runs it started (the ledger row is the first evidence; this
// is the second, for a run that has not reserved its row yet, or died, or finished without settling it). The reads are the kit's
// (CYC.execReads, v5/code/_cycle.js), shaped by what n8n 2.41.4's public API really answers (its executions controller, read in the image):
//  * the workflow's RUNNING executions (`status=running`) - the default list never shows a running one (`excludeRunning`), so without
//    this read a run slow to reserve its ledger row looked like no run at all and was started twice;
//  * each reservation's own execution by id (`/executions/<id>`, any status): an `error` / crashed run is released at once, a `success`
//    whose row stayed reserved is done (its unsettled money alerted), never run again;
//  * a 10-minute window of finished runs after each start (`startedAfter` / `startedBefore`, both inclusive, 250 a page): a page that is
//    full (`nextCursor`) is reported as incomplete, never read as "no run".
// Only the cycle's own workflows are ever read, at most max_exec_reads a sweep; Cycle Plan recomputes the same list to know what was not read.
/*__CATCHUP__*/
/*__CYCLE__*/
const API = '__N8N_API__';
const KNOWN = __WORKFLOW_IDS__;
const CONFIG = __CONFIG__;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return []; } };
const r = CYC.execReads({ jobs: all('Load Cycle Jobs'), ledger: all('Load Run Ledger (Cycle)'), known: KNOWN, api: API, cfg: CONFIG });
return r.reads.length ? r.reads.map(json => ({ json })) : [{ json: { skip: true, unread: r.unread.length } }];
