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
const API = '__N8N_API__';
const KNOWN = __WORKFLOW_IDS__;
const e = $('Cycle Entry').first().json;
const all = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (x) { return []; } };
// a table the plan cannot read must not be a quiet one: the run fails, and the Error Handler raises the ops alert. F-ENG (2026-10-20): EVERY
// load, the websites' own settings included - read as empty, a monitors / cadence / ladders table that could not be read switched jobs off and
// skipped paid work with a false reason ("switched off"). The kit refuses such a plan too (CYC.plan), so the rule holds on either side.
const LOADS = [['Load Cycle Mode', 'seo_cache (cycle:mode)'], ['Load Cycle Last', 'seo_cache (cycle:last)'], ['Load Cycles', 'seo_cycles'], ['Load Cycle Jobs', 'seo_cycle_jobs'],
  ['Load Sites (Cycle)', 'seo_sites'], ['Load Monitors (Cycle)', 'seo_monitors'], ['Load Cadence (Cycle)', 'seo_cadence'], ['Load Ladder Settings (Cycle)', 'seo_ladder_settings'],
  ['Load Ladders (Cycle)', 'seo_ladders'], ['Load Run Ledger (Cycle)', 'seo_run_ledger']];
for (const [n, what] of LOADS) {
  const bad = all(n).find(r => r && r.error);
  if (bad) throw new Error('Cycle Dispatcher cannot read ' + what + ' (' + String(bad.error.message || bad.error).slice(0, 200) + '): nothing was started or skipped, so no website\'s cycle is decided from a partial picture this sweep');
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
// F-ENG (2026-10-20): the Instance Started door stands down when a sweep finished in the last few minutes - its 45-second wait can land on a
// cron sweep, and two sweeps planning from one snapshot is how one job gets started twice (the claim read-back is the second line)
const lrow = all('Load Cycle Last').find(r => r && String(r.key || '') === 'cycle:last');
const lastAt = lrow ? Date.parse(String(lrow.updated_at || '')) : NaN, quiet = (Number(CONFIG.init_quiet_minutes) || 2) * 60000, tNow = Date.parse(e.now) || Date.now();
if (e.entry === 'init' && Number.isFinite(lastAt) && tNow >= lastAt && tNow - lastAt < quiet) {
  const why = 'n8n has just started, but a dispatcher sweep finished at ' + new Date(lastAt).toISOString() + ' (' + Math.round((tNow - lastAt) / 1000) + ' s ago): this door stands down and the next 5-minute sweep decides';
  return [{ json: { now: new Date(tNow).toISOString(), entry: e.entry, mode: 'plan_only', configured_mode: mode, mode_reason, dry_run: false, engine_tz: TZ, skipped_init: why,
    sites: [], adopted: [], open_jobs: 0, live_runs: 0, room: 0, cycle_rows: [], job_rows: [], start: [], would: null, release: [], gave_up: [], unsettled: [],
    retention: { run: false }, counts: {}, basis: why, clock_moved: !!e.clock_moved, plan_only_input: false, note: String(e.note || ''), ladders_set_aside: [], exec_reads: { read: 0, unread: 0, errors: [] } } }];
}
// n8n's executions of the workflows that have a job in flight: the reads *Cycle Exec Requests* made (in its order) and, recomputed from the
// same tables, the ones it did not make (beyond max_exec_reads) - a start one of those covered is "not confirmable", never "no run"
// F-REH (2026-10-20): every read it made, by its URL - a reservation's read by id (kind `ledger`) names no workflow
const targets = all('Cycle Exec Requests').filter(t => t && t.url && !t.skip), res = all('Read Executions (Cycle)');
const reads = CYC.execReads({ jobs: all('Load Cycle Jobs'), ledger: all('Load Run Ledger (Cycle)'), known: KNOWN, api: API, cfg: CONFIG, now: e.now });
const runs = CYC.runsFrom(targets, res, reads.unread);
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
const exec_reads = { read: targets.length, unread: reads.unread.length, errors: Object.entries(runs).flatMap(([w, r]) => (r.errors || []).map(x => w + ': ' + x)).slice(0, 10) };
return [{ json: { ...p, mode_reason, clock_moved: !!e.clock_moved, plan_only_input: !!e.plan_only, note: String(e.note || ''), ladders_set_aside, exec_reads } }];
