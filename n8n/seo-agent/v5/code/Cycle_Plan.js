// Cycle Dispatcher (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4.6): what every website's cycle needs this sweep. The decision is the pure
// kit CYC (v5/code/_cycle.js, harness scenarios_cycle.js); this node only gathers its evidence - the schedule table (seo_cycles,
// seo_cycle_jobs), each website's own settings (seo_sites, seo_monitors, seo_cadence, its ladders), the run ledger of the last two days
// (a job is done when its row `cycle:<cycle_key>:<job>` settled) and n8n's executions of the runs it started. The room it starts into is
// the run guard's own rule (RG.liveRuns / RG.MAX_OPEN, v5/code/_run_guard.js), so it never starts a run the guard would refuse.
// The switch: seo_cache `cycle:mode` = {"mode":"start"} starts jobs; anything else (no row, {"mode":"plan_only"}, unreadable) only plans
// and reports - the safe default, flipped by the owner at go-live (plan §10 step 8).
/*__CATCHUP__*/
/*__RUN_GUARD__*/
/*__CYCLE__*/
/*__FIT_GATE__*/
const TZ = '__TZ__';
const CONFIG = __CONFIG__;
const LIMIT = __EXEC_LIMIT__;
const e = $('Cycle Entry').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (x) { return []; } };
const body = (r) => { const b = r && (r.body ?? r.data); if (b && typeof b === 'object') return b; try { return JSON.parse(String(b || '{}')); } catch (x) { return {}; } };
const failed = (r) => { const st = Number(r && r.statusCode) || 0; return st ? 'HTTP ' + st : String((r && r.error && (r.error.message || r.error)) || 'no answer').slice(0, 160); };
// a table the plan cannot read must not be a quiet one: the run fails, and the Error Handler raises the ops alert
for (const [n, what] of [['Load Cycles', 'seo_cycles'], ['Load Cycle Jobs', 'seo_cycle_jobs'], ['Load Run Ledger (Cycle)', 'seo_run_ledger'], ['Load Sites (Cycle)', 'seo_sites']]) {
  const bad = all(n).find(r => r && r.error);
  if (bad) throw new Error('Cycle Dispatcher cannot read ' + what + ' (' + String(bad.error.message || bad.error).slice(0, 200) + '): nothing was started, so no website\'s cycle can be decided this sweep');
}
// the mode switch
let mode = 'plan_only', mode_reason = 'no seo_cache row cycle:mode, so the safe default (plan_only) applies';
const mrow = all('Load Cycle Mode').find(r => r && String(r.key || '') === 'cycle:mode');
if (mrow) {
  let v = null; try { v = typeof mrow.value === 'object' ? mrow.value : JSON.parse(String(mrow.value || '')); } catch (x) { v = null; }
  if (v && v.mode === 'start') { mode = 'start'; mode_reason = 'seo_cache cycle:mode says start (updated ' + String(mrow.updated_at || '?') + ')'; }
  else if (v && v.mode === 'plan_only') mode_reason = 'seo_cache cycle:mode says plan_only';
  else mode_reason = 'seo_cache cycle:mode is not {"mode":"start"|"plan_only"} (' + String(mrow.value || '').slice(0, 80) + '), so plan_only applies';
}
if (e.plan_only && mode === 'start') { mode = 'plan_only'; mode_reason += '; this manual run asked for plan_only'; }
// n8n's executions of the workflows that have a job in flight, in the order of *Cycle Exec Requests*
const targets = all('Cycle Exec Requests').filter(t => t && t.workflow_id && !t.skip), res = all('Read Executions (Cycle)');
const runs = {};
targets.forEach((t, i) => {
  const x = res[i] || {}, xb = body(x), data = Array.isArray(xb.data) ? xb.data : null;
  const rows = (data || []).map(d => ({ id: String(d.id || ''), mode: String(d.mode || ''), status: String(d.status || ''), startedAt: String(d.startedAt || ''), stoppedAt: String(d.stoppedAt || '') }));
  runs[t.workflow_id] = Number(x.statusCode) === 200 && data
    ? { ok: true, full: rows.length >= LIMIT, oldest: rows.map(r => r.startedAt).filter(Boolean).sort()[0] || '', data: rows }
    : { ok: false, error: failed(x) };
});
// the Rank Tracker job runs for a website that has a ladder rung the fit gate keeps (INVARIANTS rule 2: stored rungs are read back through
// the same gate that writes them, FITR - a website whose only rungs are a competitor's brand or a government portal buys no rank check)
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const siteRows = all('Load Sites (Cycle)').filter(s => s && s.site_id && s.domain), monRows = all('Load Monitors (Cycle)');
const byDom = {};
for (const r of all('Load Ladders (Cycle)')) { if (!r || r.error || !r.domain) continue; const d = normD(r.domain); (byDom[d] = byDom[d] || []).push(r); }
const ladders = [], ladders_set_aside = [];
for (const [d, rows] of Object.entries(byDom)) {
  const site = siteRows.find(s => normD(s.domain) === d) || {}, m = monRows.find(x => x && x.site_id === site.site_id) || {};
  const g = FITR.rungs(rows, FITR.ctx({ own_domain: d, competitors: listOf(m.competitors).map(normD), heads: [...new Set(rows.map(r => r.head_keyword).filter(Boolean))] }),
    { where: 'the cycle dispatcher (does this website have a ladder to rank-check?)' });
  if ((g.keep || []).length) ladders.push({ domain: d, rungs: g.keep.length });
  else ladders_set_aside.push({ domain: d, rungs: rows.length, note: 'every stored rung is set aside by the fit gate, so the cycle runs no rank check: ' + ((g.set_aside || [])[0] || {}).note });
}
const p = CYC.plan({ now: e.now, entry: e.entry, mode, dry_run: !!e.dry_run, engine_tz: TZ, sites: siteRows, cycles: all('Load Cycles'),
  jobs: all('Load Cycle Jobs'), monitors: monRows, cadence: all('Load Cadence (Cycle)'), ladders,
  ladder_settings: all('Load Ladder Settings (Cycle)'), ledger: all('Load Run Ledger (Cycle)'), runs, config: { ...CONFIG, max_open: RG.MAX_OPEN, stale_hours: RG.STALE_HOURS } });
return [{ json: { ...p, mode_reason, clock_moved: !!e.clock_moved, plan_only_input: !!e.plan_only, note: String(e.note || ''), ladders_set_aside } }];
