// F-ENG (2026-10-20): is the Cycle Dispatcher sweeping? Every website's week is started by that one workflow, every 5 minutes; a deploy that
// imported it and left it inactive, or a sweep that keeps failing, stops every website's cycle and nothing else says so. This node reads
// what the catch-up already reads through the public API (the workflow: active?) and the dispatcher's own record (seo_cache `cycle:last`,
// written at the end of every real sweep), and decides through the pure kit (CU.cycleWatchdog): an alarm when it is inactive or its last
// sweep is older than 20 minutes, at most one every 6 hours while it lasts (Watchdog Alarm raises it). A test run judges nothing and writes nothing.
/*__CATCHUP__*/
const DISPATCHER = '__DISPATCHER_ID__';
const e = $('Catch-up Entry').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (x) { return []; } };
const body = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(String(b || '{}')); } catch (x) { return {}; } };
const stateKey = 'catchup:watchdog:' + DISPATCHER;
const w = all('Read Dispatcher Workflow (Watchdog)')[0] || {}, wb = body(w);
const wf = Number(w.statusCode) === 200 && wb && wb.id === DISPATCHER ? { ok: true, active: wb.active !== false, updatedAt: String(wb.updatedAt || '') }
  : { ok: false, error: Number(w.statusCode) ? 'HTTP ' + Number(w.statusCode) : String((w.error && (w.error.message || w.error)) || 'no answer').slice(0, 160) };
const last = all('Load Cycle Last (Watchdog)').find(r => r && !r.error && r.key === 'cycle:last') || null;
const rec = all('Load Catch-up Records').find(r => r && r.key === stateKey) || {};
let state = {}; try { state = JSON.parse(rec.value || '{}'); } catch (x) { state = {}; }
const now = new Date().toISOString();
const d = CU.cycleWatchdog({ wf, last, state, now, entry: e.entry, test: !!(e.plan_only || e.dry_run) });
return [{ json: { ...d, save: d.verdict !== 'test', state_row: { key: stateKey, kind: 'catchup', site_id: '', value: JSON.stringify({ ...d.state, last_check_at: now, last_verdict: d.verdict, last_reason: d.reason }), updated_at: now } } }];
