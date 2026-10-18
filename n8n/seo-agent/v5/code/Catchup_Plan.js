// R94 (2026-10-16, build section 98): which scheduled fires were missed, and which of them this run starts. The decision is the
// pure kit CU (v5/code/_catchup.js); this node only gathers its evidence: n8n's own API (the workflow and its executions), the
// catch-up's records in seo_cache and the live run reservations in seo_run_ledger. The room it leaves for starts is the run
// guard's own rule (RG.liveRuns / RG.MAX_OPEN, v5/code/_run_guard.js), so the planner never starts a run the gate would refuse.
/*__CATCHUP__*/
/*__RUN_GUARD__*/
const SCHEDULES = __SCHEDULES__;
const TZ = '__TZ__';
const CONFIG = __CONFIG__;
const LIMIT = __EXEC_LIMIT__;
const e = $('Catch-up Entry').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (x) { return []; } };
const body = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(String(b || '{}')); } catch (x) { return {}; } };
const failed = (r) => { const st = Number(r && r.statusCode) || 0; return st ? 'HTTP ' + st : String((r && r.error && (r.error.message || r.error)) || 'no answer').slice(0, 160); };
const targets = all('Catch-up Targets'), wfRes = all('Read Workflows (Catch-up)'), exRes = all('Read Executions (Catch-up)');
const workflows = {}, runs = {};
targets.forEach((t, i) => {
  const w = wfRes[i] || {}, wb = body(w);
  workflows[t.workflow_id] = Number(w.statusCode) === 200 && wb && wb.id === t.workflow_id
    ? { ok: true, active: wb.active !== false, createdAt: String(wb.createdAt || ''), updatedAt: String(wb.updatedAt || '') }
    : { ok: false, error: failed(w) };
  const x = exRes[i] || {}, xb = body(x), data = Array.isArray(xb.data) ? xb.data : null;
  const rows = (data || []).map(d => ({ id: String(d.id || ''), mode: String(d.mode || ''), status: String(d.status || ''), startedAt: String(d.startedAt || '') }));
  runs[t.workflow_id] = Number(x.statusCode) === 200 && data
    ? { ok: true, full: rows.length >= LIMIT, oldest: rows.map(r => r.startedAt).filter(Boolean).sort()[0] || '', data: rows }
    : { ok: false, error: failed(x) };
});
// a catch-up that cannot see anything must not be a quiet one: the run fails, and the Error Handler raises the ops alert
if (targets.length && targets.every(t => !workflows[t.workflow_id].ok) && targets.every(t => !runs[t.workflow_id].ok))
  throw new Error('Schedule Catch-up cannot read n8n\'s own API (' + workflows[targets[0].workflow_id].error + '): set N8N_API_KEY in n8n/.env and run apply_env.py (credential "n8n API (SEO Agent catch-up)")');
const records = all('Load Catch-up Records').filter(r => r.key && String(r.key).startsWith('catchup'));
const ledger = all('Load Run Ledger (Catch-up)').filter(r => r.run_id);
const live = RG.liveRuns(ledger, { now: e.now, run_id: 'catchup' });
const p = CU.plan({ schedules: SCHEDULES, tz: TZ, now: e.now, entry: e.entry, workflows, runs, records, ledger, live_runs: live,
  dry_run: !!e.dry_run, plan_only: !!e.plan_only, config: { ...CONFIG, max_open: RG.MAX_OPEN } });
// the catch-up's own state: when it was first armed (fires due before that are never started) and when n8n last started
const state = [];
if (!e.plan_only && p.arm_new) state.push({ key: 'catchup:armed', kind: 'catchup', site_id: '', value: JSON.stringify({ armed_at: p.now, entry: p.entry }), updated_at: p.now });
if (!e.plan_only && p.entry === 'init') state.push({ key: 'catchup:instance', kind: 'catchup', site_id: '', value: JSON.stringify({ started_at: p.now }), updated_at: p.now });
return [{ json: { ...p, clock_moved: !!e.clock_moved, state_rows: state } }];
