// CY1-CY32 (2026-10-19; CY25-CY32 F-ENG 2026-10-20, the production-safety review: error / unsettled outcomes, bounded blind, running runs read, every load refuses, the Instance Started door and the claim, changed-field updates, the published + watched dispatcher, the release step's guard; n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md §4 / §9 / §14, agent E1 "Cycle core"): the week belongs to the
// website. The pure cycle kit (v5/code/_cycle.js, CYC) is taken out of the GENERATED Cycle Plan node exactly as the build inlined it, together
// with the catch-up's time rule (CU) and the run guard (RG), and replayed on any date: due times in three zones across both DST changes, the
// most recent missed cycle once, the 12-hour gap, pause and resume, weekday changes, the monthly date and exactly 12 monthly cycles a year,
// the job order and its dependency rule, every outcome the ledger and n8n can report, capped starts, adoption, plan-only, the preview and the
// deploy guard's question. CY18-CY24 then run the generated dispatcher nodes on fixtures end to end: record before start, the claim read
// back, the §14.2 payload exactly, outcomes from ledger rows, the seo_cycles updates, retention, the report and the gave-up alarm.
// Called from scenarios_v5.js just before the report.
const fs = require('fs'); const path = require('path');
const { fakeN8nApi } = require('./fake_n8n_api');   // F-ENG (2026-10-20): n8n 2.41.4's executions API, faithfully (no running run in the default list)
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  let WIRE = {}; try { WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'cycle_wiring.json'), 'utf8')); } catch (e) { WIRE = {}; }
  const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'deploy_window_cases.json'), 'utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 700), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 500))); };
  // the kits exactly as the build inlined them into the Cycle Plan node (the harness reads generated code only)
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function(body + '\nreturn { ' + names.join(', ') + ' };')(); };
  let K = null; try { K = kits('Cycle__Cycle_Plan.js', ['CU', 'RG', 'CYC']); } catch (e) { K = null; }
  if (!K) { await guard('CY0 the cycle kit is inlined', async () => { begin('CY0 the cycle kit'); mkCheck('CY0')('the generated Cycle Plan node carries CU, RG and CYC', false, 'Cycle__Cycle_Plan.js is missing or does not inline the kits'); }); return; }
  const { CYC } = K;
  const CY_RUN = (node, input) => run(node, input, { code: 'Cycle__' + node.replace(/[^A-Za-z0-9_.-]+/g, '_') });
  // a generated dispatcher node that must throw (H.expectError reads unprefixed files): the result row says whether it threw what was expected
  const CY_ERR = async (node, input, re) => { try { await run(node, input, { code: 'Cycle__' + node.replace(/[^A-Za-z0-9_.-]+/g, '_'), expectError: true }); } catch (e) {}
    const r = H.results[H.results.length - 1];
    if (r.ok) { r.ok = false; r.error = 'Expected an error but node succeeded'; } else if (re && !re.test(r.error)) { r.error = 'Wrong error: ' + r.error; } else { r.ok = true; r.error = 'threw as expected: ' + r.error.slice(0, 90); }
    return r; };
  const T = (s) => typeof s === 'number' ? s : Date.parse(s), ISO = (t) => new Date(T(t)).toISOString(), MIN = 60000, H1 = 3600000, D1 = 86400000;
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  // ---- a small world: the tables the dispatcher reads, and what its writing nodes do with a plan ----
  const SITE = (id, dom, x) => ({ site_id: id, domain: dom, status: 'active', ...(x || {}) });
  const ALL_ON = (id) => ({ site_id: id, ai_visibility: true, backlinks: true, ai_growth: true, link_builder: true, audit_monthly: true });
  const ALL_OFF = (id) => ({ site_id: id, ai_visibility: false, backlinks: false, ai_growth: false, link_builder: false, audit_monthly: false });
  const world = (o) => { const c = o || {}; return { sites: c.sites || [], cycles: (c.cycles || []).map(r => ({ ...r })), jobs: (c.jobs || []).map(r => ({ ...r })), ledger: c.ledger || [],
    monitors: c.monitors || [], cadence: c.cadence || [], ladders: c.ladders || [], ladder_settings: c.ladder_settings || [], runs: c.runs || {}, mode: c.mode || 'start', seq: 1000, starts: [] }; };
  const upsert = (arr, key, row) => { const i = arr.findIndex(r => r[key] === row[key]); if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push({ ...row }); };
  const API_BASE = 'http://localhost:5678/api/v1', WF_IDS = [...new Set(CYC.JOBS.map(j => j.workflow_id))];
  // what the dispatcher learns from n8n: its reads (CYC.execReads) answered by the faithful fake API, assembled by CYC.runsFrom
  const runsVia = (execs, jobs, ledger, cfg, apiOpts) => { const R = CYC.execReads({ jobs, ledger, known: WF_IDS, api: API_BASE, cfg }); const api = fakeN8nApi(execs, apiOpts);
    return CYC.runsFrom(R.reads, R.reads.map(r => api(r.url)), R.unread); };
  const planW = (w, now, x) => CYC.plan({ now: ISO(now), mode: w.mode, engine_tz: 'America/New_York', sites: w.sites, cycles: w.cycles, jobs: w.jobs, monitors: w.monitors, cadence: w.cadence,
    ladders: w.ladders, ladder_settings: w.ladder_settings, ledger: w.ledger, runs: w.execs ? runsVia(w.execs, w.jobs, w.ledger) : w.runs, ...(x || {}) });
  const applyW = (w, p, now) => { for (const r of p.cycle_rows) upsert(w.cycles, 'site_id', r); for (const r of p.job_rows) upsert(w.jobs, 'key', r);
    for (const x of (p.release || [])) for (const l of w.ledger) if (String(l.run_id) === x.run_id && l.status === 'reserved') l.status = 'stale';   // Release Dead Runs
    for (const s of p.start) { upsert(w.jobs, 'key', CYC.jobRow({ ...s, status: 'starting', run_id: 'dsp:sim', reason: 'starting: ' + s.why, started_at: ISO(now), finished_at: '', updated_at: ISO(now) })); w.starts.push(s); }
    return p; };
  const sweep = (w, now, x) => applyW(w, planW(w, now, x), now);
  const ledgerFor = (w, key, at, status, extra) => { const j = w.jobs.find(r => r.key === key); const id = String(++w.seq); const dom = (w.sites.find(s => s.site_id === j.site_id) || {}).domain || '';
    const row = { id: w.seq, run_id: id, key: j.ledger_key, mode: CYC.BY_JOB[j.job].mode, status, created_at: ISO(at), settled_at: status === 'done' ? ISO(T(at) + MIN) : '', domain: dom, heavy: false, cost_basis: '', ...(extra || {}) };
    w.ledger.push(row); return row; };
  const settleStarting = (w, at) => { for (const j of w.jobs.filter(r => r.status === 'starting')) ledgerFor(w, j.key, at, 'done'); };
  // a cycle to its end: sweep, settle what started a minute later, sweep again 5 minutes on, until nothing is open
  const runOut = (w, from, max) => { let t = T(from); for (let n = 0; n < (max || 40); n++) { const p = sweep(w, t); settleStarting(w, t + MIN);
    if (!p.start.length && !w.jobs.some(r => r.job !== 'cycle' && (r.status === 'starting' || r.status === 'running')) && n > 0) break; t += 5 * MIN; } return t; };
  const cyc = (w, id) => w.cycles.find(r => r.site_id === (id || 'site_a-com')) || {};
  const job = (w, key) => w.jobs.find(r => r.key === key) || {};
  const kick = (id, dom, tz, anchor, x) => CYC.newCycleRow({ site_id: id, domain: dom, tz, anchor: T(anchor), now: T(anchor), ...(x || {}) });

  // ===== CY1: the contract =====
  await guard('CY1 cycle contract', async () => {
    const SN = 'CY1 the cycle kit mirrors the app contract (app/shared/src/cycles.ts): the job order and workflows, 06:00, 48 h, the cycle key and the request id'; reset(); begin(SN); const check = mkCheck(SN);
    const kit = CYC.JOBS.map(j => [j.job, j.workflow_id]);
    check('CY1: the kit runs the eight jobs in today\'s Monday order, each through its own workflow',
      JSON.stringify(kit) === JSON.stringify([['ai_visibility', 'SEOagentAIVisib1'], ['backlinks', 'SEOagentBacklnk1'], ['rank_tracker', 'SEOagentTracker1'], ['site_tracker', 'SEOagentSiteTrk1'],
        ['ai_growth', 'SEOagentAIGrow1'], ['content_cadence', 'SEOagentCadence1'], ['link_builder', 'SEOagentLinkBld1'], ['audit', 'SEOagentAuditSc1']]), JSON.stringify(kit));
    let ts = null; for (const p of [process.env.CYCLES_TS, path.join(__dirname, '..', '..', '..', 'app', 'shared', 'src', 'cycles.ts')].filter(Boolean)) { try { ts = fs.readFileSync(p, 'utf8'); break; } catch (e) {} }
    const fromTs = ts ? [...ts.slice(ts.indexOf('export const CYCLE_JOBS = ['), ts.indexOf('] as const', ts.indexOf('export const CYCLE_JOBS = ['))).matchAll(/\{ job: '(\w+)', workflowId: '(\w+)' \}/g)].map(m => [m[1], m[2]]) : null;
    const fromWire = (WIRE.cycles_ts_jobs || null) && WIRE.cycles_ts_jobs.map(j => [j.job, j.workflow_id]);
    const contract = fromTs || fromWire;
    check('CY1: the job order equals CYCLE_JOBS in app/shared/src/cycles.ts (read as text' + (fromTs ? '' : ', through the build\'s copy in cycle_wiring.json') + ')',
      !!contract && JSON.stringify(contract) === JSON.stringify(kit), JSON.stringify({ contract, kit }));
    const consts = ts ? { local_time: (/export const CYCLE_LOCAL_TIME = '([0-9:]+)'/.exec(ts) || [])[1], preview_hours: +((/export const PREVIEW_HOURS_BEFORE = (\d+);/.exec(ts) || [])[1]) } : (WIRE.cycles_ts_consts || {});
    check('CY1: the local time (06:00) and the preview lead (48 h) are the contract\'s CYCLE_LOCAL_TIME and PREVIEW_HOURS_BEFORE',
      consts.local_time === CYC.DEFAULTS.local_time && consts.preview_hours === CYC.DEFAULTS.preview_hours && CYC.DEFAULTS.local_time === '06:00' && CYC.DEFAULTS.preview_hours === 48, JSON.stringify(consts));
    check('CY1: the cycle key is cyc:<site_id>:<local due date> and the request id cyc_<site_id without site_>_<YYYYMMDD>_<job> (§14.2)',
      CYC.cycleKey('site_a-com', '2026-10-21') === 'cyc:site_a-com:2026-10-21' && CYC.requestId('site_a-com', '2026-10-21', 'backlinks') === 'cyc_a-com_20261021_backlinks'
      && CYC.ledgerKey('cyc:site_a-com:2026-10-21', 'audit') === 'cycle:cyc:site_a-com:2026-10-21:audit' && CYC.dateOfKey('cyc:site_x:2026-01-02') === '2026-01-02', '');
    check('CY1: the generated workflows the dispatcher starts are the eight targets, each with one Manual Run (build_cycle.py, from the generated files)',
      Object.keys(WIRE.targets || {}).sort().join() === [...new Set(CYC.JOBS.map(j => j.workflow_id))].sort().join() && Object.values(WIRE.targets || {}).every(t => t.entry_node), JSON.stringify(WIRE.targets));
  });

  // ===== CY2: due times in three zones, across both DST changes =====
  await guard('CY2 DST', async () => {
    const SN = 'CY2 cycle 0 at the anchor, every later cycle at 06:00 in the website\'s own zone: New York, London (both DST changes) and Dubai (no DST)'; reset(); begin(SN); const check = mkCheck(SN);
    const zone = (tz, anchor, want) => {
      const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', tz, anchor)] });
      const p0 = sweep(w, T(anchor) + MIN);
      const k0 = cyc(w).current_key, due1 = cyc(w).next_due_at;
      runOut(w, T(anchor) + 6 * MIN);
      sweep(w, T(due1) + MIN); const k1 = cyc(w).current_key, due2 = cyc(w).next_due_at;
      runOut(w, T(due1) + 6 * MIN);
      sweep(w, T(due2) + MIN); const k2 = cyc(w).current_key;
      return { p0opened: !!(p0.sites[0] || {}).opened, k0, due1, k1, due2, k2, wd: cyc(w).cycle_weekday };
    };
    const ny = zone('America/New_York', '2026-10-28T15:00:00.000Z');
    check('CY2: New York, autumn: cycle 0 at the anchor (Wed 28 Oct, 11:00 EDT), cycle 1 on Wed 4 Nov at 06:00 EST = 11:00Z (DST ended 1 Nov), cycle 2 a week later at 11:00Z',
      ny.p0opened && ny.k0 === 'cyc:site_a-com:2026-10-28' && ny.due1 === '2026-11-04T11:00:00.000Z' && ny.k1 === 'cyc:site_a-com:2026-11-04' && ny.due2 === '2026-11-11T11:00:00.000Z' && ny.k2 === 'cyc:site_a-com:2026-11-11' && ny.wd === 3, JSON.stringify(ny));
    const nys = zone('America/New_York', '2026-03-04T15:00:00.000Z');
    check('CY2: New York, spring: anchor Wed 4 Mar 10:00 EST, cycle 1 Wed 11 Mar 06:00 EDT = 10:00Z (DST began 8 Mar), then 18 Mar 10:00Z',
      nys.due1 === '2026-03-11T10:00:00.000Z' && nys.due2 === '2026-03-18T10:00:00.000Z' && nys.k1 === 'cyc:site_a-com:2026-03-11', JSON.stringify(nys));
    const lsp = zone('Europe/London', '2026-03-25T10:00:00.000Z');
    check('CY2: London, spring: anchor Wed 25 Mar 10:00 GMT, cycle 1 Wed 1 Apr 06:00 BST = 05:00Z (BST began 29 Mar), then 8 Apr 05:00Z',
      lsp.due1 === '2026-04-01T05:00:00.000Z' && lsp.due2 === '2026-04-08T05:00:00.000Z' && lsp.k0 === 'cyc:site_a-com:2026-03-25', JSON.stringify(lsp));
    const lau = zone('Europe/London', '2026-10-21T09:00:00.000Z');
    check('CY2: London, autumn: anchor Wed 21 Oct 10:00 BST, cycle 1 Wed 28 Oct 06:00 GMT = 06:00Z (BST ended 25 Oct), then 4 Nov 06:00Z',
      lau.due1 === '2026-10-28T06:00:00.000Z' && lau.due2 === '2026-11-04T06:00:00.000Z', JSON.stringify(lau));
    const dxb = zone('Asia/Dubai', '2026-10-21T08:00:00.000Z');
    check('CY2: Dubai (no DST): anchor Wed 21 Oct 12:00 GST, cycles at 06:00 GST = 02:00Z on 28 Oct and 4 Nov',
      dxb.due1 === '2026-10-28T02:00:00.000Z' && dxb.due2 === '2026-11-04T02:00:00.000Z' && dxb.k1 === 'cyc:site_a-com:2026-10-28', JSON.stringify(dxb));
    // the local date of an evening anchor: the key is the website's date, not UTC's
    const late = kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T03:30:00.000Z');
    check('CY2: an anchor at 23:30 on Tuesday in New York (03:30Z Wednesday) is a Tuesday website: weekday 2, monthly day 20, cycle 0 keyed by the local date',
      late.cycle_weekday === 2 && late.monthly_day === 20 && CYC.cycleKey('site_a-com', CYC.local('America/New_York', T(late.anchor_at)).date) === 'cyc:site_a-com:2026-10-20', JSON.stringify(late));
  });

  // ===== CY3: day one =====
  await guard('CY3 day one', async () => {
    const SN = 'CY3 cycle 0 runs at setup and there is no second cycle on day one, whatever the hour of setup'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [{ ...ALL_OFF('site_a-com'), ai_visibility: true }], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T07:00:00.000Z')] });   // 03:00 local Wednesday
    const p0 = sweep(w, '2026-10-21T07:03:00.000Z');
    check('CY3: a website set up at 03:00 local opens cycle 0 at once (monthly, marker written), and its next cycle is next Wednesday 06:00 - not 06:00 the same day',
      p0.sites[0].opened && p0.sites[0].opened.cycle0 && p0.sites[0].opened.monthly && cyc(w).current_key === 'cyc:site_a-com:2026-10-21' && cyc(w).next_due_at === '2026-10-28T10:00:00.000Z'
      && job(w, 'cyc:site_a-com:2026-10-21:cycle').status === 'running', JSON.stringify({ s: p0.sites[0], c: cyc(w) }));
    runOut(w, '2026-10-21T07:08:00.000Z');
    const p1 = sweep(w, '2026-10-21T10:01:00.000Z');
    check('CY3: at 06:01 the same day nothing new opens: the website is still in cycle 0', !p1.sites[0].opened && cyc(w).current_key === 'cyc:site_a-com:2026-10-21' && !p1.start.length, JSON.stringify(p1.sites[0]));
    check('CY3: cycle 0 finished: its marker says so with the counts', /finished at .*: 1 done, 7 skipped, 0 gave up/.test(job(w, 'cyc:site_a-com:2026-10-21:cycle').reason) && job(w, 'cyc:site_a-com:2026-10-21:cycle').status === 'done',
      job(w, 'cyc:site_a-com:2026-10-21:cycle').reason);
    const w2 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T03:30:00.000Z')] });
    sweep(w2, '2026-10-21T03:33:00.000Z');
    check('CY3: a website set up at 23:30 Tuesday local is a Tuesday website: cycle 0 keyed 20 Oct, cycle 1 on Tuesday 27 Oct 06:00 EDT',
      cyc(w2).current_key === 'cyc:site_a-com:2026-10-20' && cyc(w2).next_due_at === '2026-10-27T10:00:00.000Z', JSON.stringify(cyc(w2)));
    const w3 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T16:00:00.000Z')] });
    const early = sweep(w3, '2026-10-21T15:58:00.000Z');
    check('CY3: an anchor a few minutes ahead (the kickoff allows up to an hour) is not due yet: nothing opens, it is due at the anchor',
      !early.start.length && early.sites[0].verdict === 'not_due' && early.sites[0].next_due_at === '2026-10-21T16:00:00.000Z', JSON.stringify(early.sites[0]));
  });

  // ===== CY4: a year of weeks, no drift =====
  await guard('CY4 52 weeks', async () => {
    const SN = 'CY4 52 cycles in a row: every one at 06:00 local on the website\'s weekday, exactly 7 local days apart across both DST changes, keys never repeated'; reset(); begin(SN); const check = mkCheck(SN);
    for (const tz of ['America/New_York', 'Europe/London', 'Asia/Dubai']) {
      const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', tz, '2026-01-07T14:00:00.000Z')] });
      let t = runOut(w, '2026-01-07T14:01:00.000Z'); const keys = [cyc(w).current_key], dues = [];
      for (let i = 0; i < 51; i++) { const due = cyc(w).next_due_at; dues.push(due); t = runOut(w, T(due) + MIN); keys.push(cyc(w).current_key); }
      const loc = dues.map(d => CYC.local(tz, T(d)));
      const ok = loc.every(l => l.h === 6 && l.mi === 0 && l.wd === 3) && new Set(keys).size === 52
        && keys.slice(1).every((k, i) => CYC.dateAdd(CYC.dateOfKey(keys[i]), 7) === CYC.dateOfKey(k));
      check('CY4: ' + tz + ' - 51 later cycles all at 06:00 local on Wednesday, each 7 local days after the last, 52 distinct keys',
        ok, JSON.stringify({ bad: loc.map((l, i) => [dues[i], l.h, l.mi, l.wd]).filter(x => x[1] !== 6 || x[2] !== 0 || x[3] !== 3).slice(0, 3), keys: keys.slice(0, 3), n: new Set(keys).size }));
    }
  });

  // ===== CY5: changing the weekday =====
  await guard('CY5 weekday change', async () => {
    const SN = 'CY5 a weekday change moves the next cycle to the chosen weekday at least 3 days after the last cycle started, then weekly'; reset(); begin(SN); const check = mkCheck(SN);
    const base = () => { const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
      runOut(w, '2026-10-21T14:01:00.000Z'); runOut(w, '2026-10-28T10:01:00.000Z'); return w; };   // cycle 1 started Wed 28 Oct
    const after = (wd) => { const w = base(); cyc(w).cycle_weekday = wd; const p = sweep(w, '2026-10-29T12:00:00.000Z'); return { w, next: cyc(w).next_due_at, wrote: p.cycle_rows.length }; };
    const thu = after(4), sat = after(6), mon = after(1), wed = after(3), tue = after(2);
    check('CY5: last cycle Wed 28 Oct; Thursday -> Thu 5 Nov (8 days: Thu 29 Oct is too soon), Saturday -> Sat 31 Oct (3 days), Monday -> Mon 2 Nov, Tuesday -> Tue 3 Nov, unchanged Wednesday -> Wed 4 Nov',
      thu.next === '2026-11-05T11:00:00.000Z' && sat.next === '2026-10-31T10:00:00.000Z' && mon.next === '2026-11-02T11:00:00.000Z' && tue.next === '2026-11-03T11:00:00.000Z' && wed.next === '2026-11-04T11:00:00.000Z'
      && thu.wrote === 1 && wed.wrote === 0, JSON.stringify({ thu: thu.next, sat: sat.next, mon: mon.next, tue: tue.next, wed: wed.next, wrote: [thu.wrote, wed.wrote] }));
    const w = sat.w; runOut(w, '2026-10-31T10:01:00.000Z');
    check('CY5: the Saturday cycle runs (key 31 Oct) and the next is the following Saturday, 7 Nov 06:00 EST', cyc(w).current_key === 'cyc:site_a-com:2026-10-31' && cyc(w).next_due_at === '2026-11-07T11:00:00.000Z', JSON.stringify(cyc(w)));
    const gaps = [thu, sat, mon, tue, wed].map(x => (T(x.next) - T('2026-10-28T10:01:00.000Z')) / D1);
    check('CY5: no two cycles ever start fewer than 3 days apart', gaps.every(g => g >= 2.9), JSON.stringify(gaps));
  });

  // ===== CY6: overdue by more than a cycle =====
  await guard('CY6 overdue', async () => {
    const SN = 'CY6 a website more than a full cycle overdue runs only the most recent due cycle, once, and records how many were not run'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    runOut(w, '2026-10-21T14:01:00.000Z');
    const p = sweep(w, '2026-11-06T15:00:00.000Z');   // the engine was down from 22 Oct to Friday 6 Nov
    const s = p.sites[0];
    check('CY6: on Friday 6 Nov the most recent due cycle (Wed 4 Nov) opens; 28 Oct is not run and is named in the marker',
      s.opened && s.opened.key === 'cyc:site_a-com:2026-11-04' && s.opened.not_run_before === 1 && /1 earlier cycle\(s\) were not run/.test(job(w, 'cyc:site_a-com:2026-11-04:cycle').reason)
      && !w.jobs.some(r => r.cycle_key === 'cyc:site_a-com:2026-10-28'), JSON.stringify(s.opened));
    check('CY6: the next cycle is at least 3 days after this start, on the website\'s weekday: Wed 11 Nov 06:00 EST', cyc(w).next_due_at === '2026-11-11T11:00:00.000Z' && cyc(w).last_cycle_at === '2026-11-06T15:00:00.000Z', JSON.stringify(cyc(w)));
    settleStarting(w, '2026-11-06T15:01:00.000Z');
    const again = sweep(w, '2026-11-06T15:05:00.000Z');
    check('CY6: the next sweep opens nothing more (the overdue weeks never stack up)', !again.sites[0].opened && cyc(w).current_key === 'cyc:site_a-com:2026-11-04', JSON.stringify(again.sites[0]));
    const w2 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-01T14:00:00.000Z')] });
    const p2 = sweep(w2, '2026-10-19T14:00:00.000Z');
    check('CY6: a cycle 0 that never ran and is more than a cycle late is not run as cycle 0: the most recent (Thu 15 Oct) runs, monthly, with site tracking',
      p2.sites[0].opened && p2.sites[0].opened.key === 'cyc:site_a-com:2026-10-15' && !p2.sites[0].opened.cycle0 && p2.sites[0].opened.monthly && p2.sites[0].opened.not_run_before === 2
      && (p2.sites[0].jobs.find(j => j.job === 'site_tracker') || {}).verdict === 'start', JSON.stringify(p2.sites[0]));
  });

  // ===== CY7: the 12-hour gap =====
  await guard('CY7 12 h gap', async () => {
    const SN = 'CY7 a cycle due less than 12 h before the next one is skipped and recorded once; the next one runs on time'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    runOut(w, '2026-10-21T14:01:00.000Z');
    const p = sweep(w, '2026-11-04T01:00:00.000Z');   // Tue 3 Nov 20:00 EST: 28 Oct is due, 4 Nov 06:00 is 10 h away
    const mk = job(w, 'cyc:site_a-com:2026-10-28:cycle');
    check('CY7: 28 Oct is skipped (10 h before 4 Nov): a skipped marker with the reason, nothing started, the next due time is 4 Nov 11:00Z',
      mk.status === 'skipped' && /next cycle is due 2026-11-04T11:00:00.000Z, in 10 h/.test(mk.reason) && !p.start.length && cyc(w).next_due_at === '2026-11-04T11:00:00.000Z'
      && p.sites[0].skipped_cycle && p.sites[0].skipped_cycle.key === 'cyc:site_a-com:2026-10-28', JSON.stringify({ mk, s: p.sites[0] }));
    const p2 = sweep(w, '2026-11-04T01:05:00.000Z');
    check('CY7: the next sweep writes nothing again (the skip is recorded once, not every 5 minutes)', p2.job_rows.length === 0 && p2.cycle_rows.length === 0 && !p2.start.length, JSON.stringify([p2.job_rows, p2.cycle_rows]));
    const p3 = sweep(w, '2026-11-04T11:01:00.000Z');
    check('CY7: at 06:01 on 4 Nov that cycle opens and starts its first job', p3.sites[0].opened && p3.sites[0].opened.key === 'cyc:site_a-com:2026-11-04' && p3.start.length === 1, JSON.stringify(p3.sites[0]));
  });

  // ===== CY8: pause and resume =====
  await guard('CY8 pause resume', async () => {
    const SN = 'CY8 a paused website (by its owner or the credit guard) is skipped with the reason; on resume the most recent due cycle runs once, then its weekday continues'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cadence: [{ site_id: 'site_a-com', pages_per_week: 1, status: 'active' }], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    runOut(w, '2026-10-21T14:01:00.000Z', 60);
    w.sites[0].status = 'paused';
    const p = sweep(w, '2026-10-28T10:01:00.000Z');
    check('CY8: paused at its due time: no cycle opens, nothing starts, the reason says it runs once on resume, the preview is cleared',
      p.sites[0].verdict === 'paused' && /the website is paused/.test(p.sites[0].reason) && /runs once on resume/.test(p.sites[0].reason) && !p.start.length && !p.sites[0].opened && cyc(w).next_preview_at === '',
      JSON.stringify(p.sites[0]));
    const later = sweep(w, '2026-11-13T15:00:00.000Z');
    check('CY8: still paused two weeks later: still nothing', !later.start.length && later.sites[0].verdict === 'paused', JSON.stringify(later.sites[0]));
    w.sites[0].status = 'active';
    const r = sweep(w, '2026-11-13T15:05:00.000Z');
    check('CY8: resumed on Friday 13 Nov: the most recent due cycle (Wed 11 Nov) runs once, starting with AI visibility; the next is Wed 18 Nov',
      r.sites[0].opened && r.sites[0].opened.key === 'cyc:site_a-com:2026-11-11' && r.sites[0].opened.not_run_before === 2 && r.start.length === 1 && r.start[0].job === 'ai_visibility' && cyc(w).next_due_at === '2026-11-18T11:00:00.000Z',
      JSON.stringify({ o: r.sites[0].opened, c: cyc(w) }));
    const w2 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [{ ...kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z'), status: 'off' }] });
    const off = sweep(w2, '2026-10-21T14:02:00.000Z');
    check('CY8: a cycle switched off (seo_cycles.status off) starts nothing and says so', off.sites[0].verdict === 'paused' && /switched off/.test(off.sites[0].reason) && !off.start.length, JSON.stringify(off.sites[0]));
    const w3 = world({ sites: [SITE('site_a-com', 'a.com', { status: 'paused' })], monitors: [ALL_OFF('site_a-com')] });
    const ad = sweep(w3, '2026-10-21T14:02:00.000Z');
    check('CY8: a paused website with no cycle row is not adopted', !ad.adopted.length && !w3.cycles.length, JSON.stringify(ad.adopted));
    const w4 = world({ sites: [], monitors: [], cycles: [kick('site_gone', 'gone.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    const gone = sweep(w4, '2026-10-21T14:02:00.000Z');
    check('CY8: a cycle row whose website is no longer tracked starts nothing', gone.sites[0].verdict === 'paused' && /no longer tracked/.test(gone.sites[0].reason) && !gone.start.length, JSON.stringify(gone.sites[0]));
  });

  // ===== CY9: monthly =====
  await guard('CY9 monthly', async () => {
    const SN = 'CY9 the monthly date is the anchor\'s day clamped to 28; the monthly extras run on the first cycle on or after it - exactly 12 in any 52 cycles in a row, cycle 0 included'; reset(); begin(SN); const check = mkCheck(SN);
    check('CY9: the monthly day clamps to 28 (31 Jan -> 28, 29 Feb -> 28, 19 Oct -> 19) and the period runs from that day to the same day next month',
      CYC.monthlyDayOf('America/New_York', T('2026-01-31T15:00:00Z')) === 28 && CYC.monthlyDayOf('Asia/Dubai', T('2028-02-29T08:00:00Z')) === 28 && CYC.monthlyDayOf('America/New_York', T('2026-10-19T15:00:00Z')) === 19
      && CYC.periodKey('2026-10-27', 28) === '2026-09' && CYC.periodKey('2026-10-28', 28) === '2026-10' && CYC.periodKey('2026-01-05', 15) === '2025-12' && CYC.periodKey('2026-12-15', 15) === '2026-12', '');
    const sim = (tz, anchor, n) => {
      const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', tz, anchor)] });
      runOut(w, T(anchor) + MIN);
      for (let i = 1; i < n; i++) runOut(w, T(cyc(w).next_due_at) + MIN);
      const marks = w.jobs.filter(r => r.job === 'cycle' && r.status !== 'skipped');
      return { cycles: marks.length, monthly: marks.filter(r => r.monthly).length, months: [...new Set(marks.filter(r => r.monthly).map(r => CYC.periodKey(CYC.dateOfKey(r.cycle_key), cyc(w).monthly_day)))].length, first: marks[0] && marks[0].monthly };
    };
    for (const [tz, anchor] of [['America/New_York', '2026-01-31T15:00:00.000Z'], ['Europe/London', '2026-03-29T00:30:00.000Z'], ['Asia/Dubai', '2026-02-28T10:00:00.000Z'],
      ['America/New_York', '2026-10-01T12:00:00.000Z'], ['Europe/London', '2026-10-15T09:00:00.000Z'], ['America/New_York', '2026-12-28T20:00:00.000Z']]) {
      const r = sim(tz, anchor, 52);
      check('CY9: ' + tz + ' anchored ' + anchor + ' - 52 cycles, exactly 12 monthly (cycle 0 is one), one per monthly period', r.cycles === 52 && r.monthly === 12 && r.months === 12 && r.first === true, JSON.stringify(r));
    }
    const two = sim('America/New_York', '2026-05-20T14:00:00.000Z', 104);
    check('CY9: two years (104 cycles) give exactly 24 monthly cycles', two.cycles === 104 && two.monthly === 24, JSON.stringify(two));
    // the monthly flag reaches the jobs: backlinks full (light false) and the audit only on the monthly cycle
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    runOut(w, '2026-10-21T14:01:00.000Z', 80);
    const s0 = w.starts.map(s => s.job), bl0 = w.starts.find(s => s.job === 'backlinks');
    w.starts = []; runOut(w, '2026-10-28T10:01:00.000Z', 80);
    const s1 = w.starts.map(s => s.job), bl1 = w.starts.find(s => s.job === 'backlinks');
    check('CY9: cycle 0 (monthly) runs the audit and the full backlink check (light: false, monthly: true); cycle 1 (not monthly) has no audit and a light check',
      s0.includes('audit') && bl0.payload.light === false && bl0.payload.monthly === true && !s1.includes('audit') && bl1.payload.light === true && bl1.payload.monthly === false
      && /monthly cycle only/.test(job(w, 'cyc:site_a-com:2026-10-28:audit').reason), JSON.stringify({ s0, s1, bl0: bl0.payload, bl1: bl1.payload }));
    w.starts = []; runOut(w, '2026-11-04T11:01:00.000Z', 80); runOut(w, '2026-11-11T11:01:00.000Z', 80); runOut(w, '2026-11-18T11:01:00.000Z', 80);
    const s4 = w.starts.filter(s => s.job === 'audit').map(s => s.cycle_key);
    check('CY9: the next monthly cycle is the first on or after 21 Nov (Wed 25 Nov), not 18 Nov', !s4.length, JSON.stringify(s4));
    w.starts = []; runOut(w, '2026-11-25T11:01:00.000Z', 80);
    check('CY9: on 25 Nov the audit runs again and last_monthly_key moves to 2026-11', w.starts.some(s => s.job === 'audit' && s.cycle_key === 'cyc:site_a-com:2026-11-25') && cyc(w).last_monthly_key === '2026-11', JSON.stringify(cyc(w)));
  });

  // ===== CY10: order and dependency =====
  await guard('CY10 order and dependency', async () => {
    const SN = 'CY10 a job starts only when every earlier enabled job of its cycle is done, skipped or gave up; switched-off jobs are skipped with their reason; skip_jobs only in cycle 0'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cadence: [{ site_id: 'site_a-com', pages_per_week: 2, status: 'active' }],
      ladders: [{ domain: 'a.com', keyword: 'crm implementation services', head_keyword: 'crm implementation' }],
      cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z', { skip_jobs: ['ai_visibility'] })] });
    const p1 = sweep(w, '2026-10-21T14:01:00.000Z');
    check('CY10: cycle 0 with skip_jobs [ai_visibility]: AI visibility is skipped ("already run when tracking was set up") and backlinks starts first',
      p1.start.length === 1 && p1.start[0].job === 'backlinks' && /already run when tracking was set up/.test(job(w, 'cyc:site_a-com:2026-10-21:ai_visibility').reason), JSON.stringify(p1.start));
    ledgerFor(w, 'cyc:site_a-com:2026-10-21:backlinks', '2026-10-21T14:02:00.000Z', 'reserved');
    const p2 = sweep(w, '2026-10-21T14:06:00.000Z');
    check('CY10: while backlinks runs (ledger row reserved), nothing else starts and every later job waits for it',
      !p2.start.length && job(w, 'cyc:site_a-com:2026-10-21:backlinks').status === 'running' && p2.sites[0].jobs.filter(j => j.verdict === 'wait').length === 6
      && /waits for backlinks to finish/.test(p2.sites[0].jobs.find(j => j.job === 'rank_tracker').reason), JSON.stringify(p2.sites[0].jobs));
    w.ledger[w.ledger.length - 1].status = 'done'; w.ledger[w.ledger.length - 1].settled_at = '2026-10-21T14:08:00.000Z';
    const p3 = sweep(w, '2026-10-21T14:11:00.000Z');
    check('CY10: once backlinks settled, it is done and the rank tracker (the website has a ladder) starts', job(w, 'cyc:site_a-com:2026-10-21:backlinks').status === 'done' && p3.start.length === 1 && p3.start[0].job === 'rank_tracker',
      JSON.stringify(p3.start));
    w.starts = []; runOut(w, '2026-10-21T14:12:00.000Z', 60);
    check('CY10: the rest of cycle 0 in order: site tracking skipped (Track my site ran it), then AI growth, the cadence, link building, the audit',
      JSON.stringify(w.starts.map(s => s.job)) === JSON.stringify(['ai_growth', 'content_cadence', 'link_builder', 'audit']) && /Track my site/.test(job(w, 'cyc:site_a-com:2026-10-21:site_tracker').reason),
      JSON.stringify(w.starts.map(s => s.job)));
    w.starts = []; runOut(w, '2026-10-28T10:01:00.000Z', 60);
    check('CY10: cycle 1 runs AI visibility again (skip_jobs is for cycle 0 only) and site tracking, in order, no audit',
      JSON.stringify(w.starts.map(s => s.job)) === JSON.stringify(['ai_visibility', 'backlinks', 'rank_tracker', 'site_tracker', 'ai_growth', 'content_cadence', 'link_builder']), JSON.stringify(w.starts.map(s => s.job)));
    // switched off
    const w2 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [{ site_id: 'site_a-com', ai_visibility: 'false', backlinks: true, link_builder: false, audit_monthly: true }],
      cadence: [{ site_id: 'site_a-com', pages_per_week: 0 }], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    runOut(w2, '2026-10-21T14:01:00.000Z', 60);
    const r = (j) => job(w2, 'cyc:site_a-com:2026-10-21:' + j);
    check('CY10: what the website switched off is skipped with the plain reason - AI visibility off takes AI growth with it, 0 pages a week skips the cadence, no ladder skips the rank tracker',
      r('ai_visibility').status === 'skipped' && /AI visibility is switched off/.test(r('ai_visibility').reason) && /reads its question panel/.test(r('ai_growth').reason)
      && /no pages a week are set \(0\)/.test(r('content_cadence').reason) && /no keyword ladder/.test(r('rank_tracker').reason) && /link building is switched off/.test(r('link_builder').reason)
      && JSON.stringify(w2.starts.map(s => s.job)) === JSON.stringify(['backlinks', 'audit']), JSON.stringify(w2.starts.map(s => s.job)));
    const w3 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], ladders: [{ domain: 'a.com', keyword: 'x' }],
      cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    const jobs3 = CYC.jobsFor({ settings: CYC.settingsOf({ monitors: ALL_ON('x'), cadence: { pages_per_week: 1, status: 'off' }, has_ladder: true }), zero: false, monthly: false });
    check('CY10: a cadence switched off (status off) is skipped even with pages set', /content cadence is switched off/.test(jobs3.find(j => j.job === 'content_cadence').why) && w3, '');
  });

  // ===== CY11: outcomes =====
  await guard('CY11 outcomes', async () => {
    const SN = 'CY11 outcomes from the ledger and n8n: settled = done (hand-offs count, parts never), capacity refusals retried free for 24 h, account too low gives up, a crash retried then given up after 3'; reset(); begin(SN); const check = mkCheck(SN);
    const START = '2026-10-21T14:00:00.000Z', NOW = T(START) + 20 * MIN, LK = 'cycle:cyc:site_a-com:2026-10-21:backlinks';
    const row = (x) => CYC.jobRow({ key: 'cyc:site_a-com:2026-10-21:backlinks', site_id: 'site_a-com', cycle_key: 'cyc:site_a-com:2026-10-21', job: 'backlinks', workflow_id: 'SEOagentBacklnk1',
      status: 'starting', attempts: 1, run_id: 'dsp:9', ledger_key: LK, monthly: true, started_at: START, updated_at: START, ...(x || {}) });
    const L = (x) => ({ run_id: '501', key: LK, mode: 'backlinks', status: 'reserved', created_at: '2026-10-21T14:00:30.000Z', domain: 'a.com', ...(x || {}) });
    const OK_RUNS = { SEOagentBacklnk1: { ok: true, data: [] } };
    const o = (ledger, runs, x, now) => CYC.outcome({ row: row(x), ledger, runs: runs || OK_RUNS, now: now || NOW, cfg: CYC.DEFAULTS });
    check('CY11: a settled ledger row is done, with its execution', o([L({ status: 'done', settled_at: '2026-10-21T14:15:00.000Z' })]).state === 'done' && o([L({ status: 'done' })]).run_id === '501', '');
    check('CY11: a settled hand-off (dfs_source handoff) counts as done', /handed off/.test(o([L({ status: 'done', dfs_source: 'handoff' })]).reason), '');
    check('CY11: a reserved row is running; the same row with n8n saying the execution crashed is failed',
      o([L()]).state === 'running' && o([L()], { SEOagentBacklnk1: { ok: true, data: [{ id: '501', status: 'crashed', mode: 'integrated', startedAt: START }] } }).state === 'failed', '');
    check('CY11: a reservation past the 2-hour stale rule is failed (it crashed or was stopped)', o([L()], null, null, T(START) + 2 * H1 + 5 * MIN).state === 'failed' && o([L({ status: 'stale' })]).state === 'failed', '');
    const ref = (txt) => o([L({ status: 'refused', cost_basis: 'refused before any spending: ' + txt + ' [0 other run(s) in flight]' })]);
    check('CY11: the run guard\'s own sentences are read as their codes: too_many_open, same_mode, heavy_busy, account_low; a code anywhere wins',
      ref('There are already 3 analyses running (the limit is 3). Nothing was charged').code === 'too_many_open'
      && ref('The previous backlinks run (execution 77, started 13:58 UTC) is still going. Nothing was charged').code === 'same_mode'
      && ref('A large audit of a.com is already running (execution 12, started 13:00 UTC).').code === 'heavy_busy'
      && ref('The search-data account is too low for this run ($0.40 left; it needs about $0.45)').code === 'account_low'
      && ref('refused (too_many_open): retried by the dispatcher').code === 'too_many_open' && ref('something new').code === 'other', '');
    const pre = (code, txt) => o([L({ status: 'refused', cost_basis: 'refused before any spending (' + code + '): ' + txt })]).code;
    check('CY11: the run guard\'s prefix "refused before any spending (<reason>):" is read for all five reasons (E2\'s contract)',
      pre('same_mode', 'x') === 'same_mode' && pre('heavy_busy', 'x') === 'heavy_busy' && pre('too_many_open', 'There are already 3') === 'too_many_open' && pre('account_low', 'x') === 'account_low' && pre('caught_up', 'x') === 'caught_up', '');
    check('CY11: AI Visibility settled the final key at $0 and a resumed chain wrote a newer :part row - still running, and the second settle is done',
      o([L({ status: 'done', created_at: '2026-10-21T14:01:00.000Z' }), L({ key: LK + ':part2', run_id: '510', status: 'reserved', created_at: '2026-10-21T14:05:00.000Z' })]).state === 'running'
      && o([L({ status: 'done', created_at: '2026-10-21T14:01:00.000Z' }), L({ key: LK + ':part2', run_id: '510', status: 'done', created_at: '2026-10-21T14:05:00.000Z' }), L({ run_id: '511', status: 'done', created_at: '2026-10-21T14:09:00.000Z' })]).state === 'done'
      && o([L({ key: LK + ':part1', status: 'done', created_at: '2026-10-21T14:01:00.000Z' }), L({ run_id: '512', status: 'done', created_at: '2026-10-21T14:03:00.000Z' })]).state === 'done', '');
    check('CY11: rows of a split run (:part1, :part2) are progress, never done; the final key settles it',
      o([L({ key: LK + ':part1', status: 'done', settled_at: '2026-10-21T14:10:00.000Z' })]).state === 'running'
      && o([L({ key: LK + ':part1', status: 'done' }), L({ key: LK + ':part2', status: 'reserved', run_id: '502', created_at: '2026-10-21T14:11:00.000Z' })]).state === 'running'
      && o([L({ key: LK + ':part1', status: 'done' }), L({ run_id: '503', status: 'done', created_at: '2026-10-21T14:12:00.000Z' })]).state === 'done'
      && o([L({ key: LK + ':part1', status: 'done', settled_at: '2026-10-21T14:10:00.000Z' })], null, null, T(START) + 3 * H1).state === 'failed', '');
    check('CY11: a double start (two racing sweeps): the twin refused same_mode does not hide the run that is going', o([L({ run_id: '600', status: 'refused', cost_basis: 'The previous backlinks run (execution 501) is still going' }), L()]).state === 'running', '');
    // F-ENG (2026-10-20): the execution is in n8n as n8n keeps it - RUNNING - and reaches the plan only through the reads the dispatcher makes
    const RUN700 = [{ id: '700', workflowId: 'SEOagentBacklnk1', status: 'running', mode: 'integrated', startedAt: '2026-10-21T14:00:20.000Z' }];
    const viaApi = runsVia(RUN700, [row()], []);
    check('CY11: no ledger row yet: an execution of the workflow after the start is running (read through status=running, as n8n 2.41.4 lists it); none after 10 min is failed; within 10 min it is starting',
      o([], viaApi).state === 'running' && o([], OK_RUNS).state === 'failed' && o([], OK_RUNS, null, T(START) + 4 * MIN).state === 'starting', JSON.stringify(viaApi));
    check('CY11: an execution that belongs to another job\'s ledger row is never taken for ours',
      CYC.outcome({ row: row(), ledger: [], runs: viaApi, claimed: new Set(['700']), now: NOW, cfg: CYC.DEFAULTS }).state === 'failed', '');
    check('CY11: n8n\'s executions unreadable and no ledger row: blind (looked at again), but after 2 h it is failed',
      o([], { SEOagentBacklnk1: { ok: false, error: 'HTTP 401' } }).state === 'blind' && o([], { SEOagentBacklnk1: { ok: false, error: 'HTTP 401' } }, null, T(START) + 2 * H1 + MIN).state === 'failed', '');
    check('CY11: a run that finished "success" with no ledger row under its key is done, and says its plan node does not key cycle runs',
      /does not key cycle runs/.test(o([], { SEOagentBacklnk1: { ok: true, data: [{ id: '701', status: 'success', mode: 'integrated', startedAt: '2026-10-21T14:00:20.000Z' }] } }).reason), '');
    // through the plan: capacity refusal retried without an attempt, then gave up after 24 h of refusals
    const W = () => world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cycles: [{ ...kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T13:00:00.000Z'), current_key: 'cyc:site_a-com:2026-10-21', last_cycle_at: '2026-10-21T13:01:00.000Z', next_due_at: '2026-10-28T10:00:00.000Z', last_monthly_key: '2026-10' }],
      jobs: [CYC.jobRow({ key: 'cyc:site_a-com:2026-10-21:cycle', site_id: 'site_a-com', cycle_key: 'cyc:site_a-com:2026-10-21', job: 'cycle', status: 'running', monthly: true, due_at: '2026-10-21T13:00:00.000Z', updated_at: START }),
        CYC.jobRow({ key: 'cyc:site_a-com:2026-10-21:ai_visibility', site_id: 'site_a-com', cycle_key: 'cyc:site_a-com:2026-10-21', job: 'ai_visibility', status: 'done', monthly: true, updated_at: START }), row()] });
    const w = W(); w.ledger.push(L({ status: 'refused', cost_basis: 'refused before any spending: There are already 3 analyses running (the limit is 3).' }));
    const p = sweep(w, NOW);
    check('CY11: refused for capacity: status refused, the attempt is not spent, and it is started again at once with the same attempt number',
      p.start.length === 1 && p.start[0].job === 'backlinks' && p.start[0].attempts === 1 && /again after a capacity refusal/.test(p.start[0].why) && /retried by the dispatcher without spending an attempt/.test((p.job_rows.find(r => r.job === 'backlinks') || {}).reason),
      JSON.stringify({ start: p.start, rows: p.job_rows }));
    const w24 = W(); for (let h = 0; h <= 24; h += 4) w24.ledger.push(L({ run_id: String(800 + h), status: 'refused', created_at: ISO(T(START) + h * H1), cost_basis: 'refused before any spending: There are already 3 analyses running' }));
    w24.jobs[2].started_at = ISO(T(START) + 24 * H1 - MIN);
    const p24 = sweep(w24, T(START) + 24 * H1 + 10 * MIN);
    check('CY11: refused for capacity for 24 h without a break: gave up, named in the alarm list, and the next job is not held by it',
      job(w24, 'cyc:site_a-com:2026-10-21:backlinks').status === 'gave_up' && /refused for capacity for 24 h/.test(job(w24, 'cyc:site_a-com:2026-10-21:backlinks').reason)
      && p24.gave_up.length === 1 && p24.gave_up[0].job === 'backlinks' && p24.start.length === 1 && p24.start[0].job === 'ai_growth', JSON.stringify({ g: p24.gave_up, s: p24.start.map(s => s.job) }));
    const wcu = W(); wcu.ledger.push(L({ status: 'refused', cost_basis: 'refused before any spending (caught_up): The catch-up already ran this scheduled slot' }));
    const pcu = sweep(wcu, NOW);
    check('CY11: caught_up is not retried (only same_mode, heavy_busy and too_many_open are): it gives up with the reason', job(wcu, 'cyc:site_a-com:2026-10-21:backlinks').status === 'gave_up' && pcu.gave_up.length === 1 && /not retried/.test(job(wcu, 'cyc:site_a-com:2026-10-21:backlinks').reason),
      JSON.stringify(job(wcu, 'cyc:site_a-com:2026-10-21:backlinks')));
    const wl = W(); wl.ledger.push(L({ status: 'refused', cost_basis: 'refused before any spending: The search-data account is too low for this run ($0.40 left; it needs about $0.45).' }));
    const pl = sweep(wl, NOW);
    check('CY11: account too low: gave up at once with the reason (retrying would be refused the same way)', job(wl, 'cyc:site_a-com:2026-10-21:backlinks').status === 'gave_up' && /topping up the search-data account/.test(job(wl, 'cyc:site_a-com:2026-10-21:backlinks').reason) && pl.gave_up.length === 1,
      job(wl, 'cyc:site_a-com:2026-10-21:backlinks').reason);
    // a crash: retried, attempt 2, attempt 3, then gave up
    const wc = W(); const crash = (at) => { const j = job(wc, 'cyc:site_a-com:2026-10-21:backlinks'); wc.ledger.push(L({ run_id: String(900 + j.attempts), created_at: ISO(T(j.started_at) + 30000) }));
      wc.runs = { SEOagentBacklnk1: { ok: true, data: [{ id: String(900 + j.attempts), status: 'crashed', mode: 'integrated', startedAt: ISO(T(j.started_at) + 20000) }] } }; return sweep(wc, at); };
    const c1 = crash(NOW), c2 = crash(NOW + 10 * MIN), c3 = crash(NOW + 20 * MIN);
    check('CY11: a run n8n crashed is retried - attempt 2, attempt 3 - and after the third it gives up with the reason, alarmed once',
      c1.release.length === 1 && c1.release[0].run_id === '901' && c1.start[0] && c1.start[0].attempts === 2 && c2.start[0] && c2.start[0].attempts === 3 && !c3.start.some(s => s.job === 'backlinks') && job(wc, 'cyc:site_a-com:2026-10-21:backlinks').status === 'gave_up'
      && /gave up after 3 attempt\(s\).*crashed/.test(job(wc, 'cyc:site_a-com:2026-10-21:backlinks').reason) && c3.gave_up.length === 1 && c1.gave_up.length === 0,
      JSON.stringify([c1.start, c2.start, c3.start, job(wc, 'cyc:site_a-com:2026-10-21:backlinks')]));
    // a start that failed (Execute Workflow error) on its last attempt
    const wf = W(); wf.jobs[2] = { ...wf.jobs[2], status: 'failed', attempts: 3, reason: 'the start failed (attempt 3): Workflow is not active and cannot be executed.' };
    const pf = sweep(wf, NOW);
    check('CY11: a start n8n refused on the third attempt gives up instead of trying a fourth', job(wf, 'cyc:site_a-com:2026-10-21:backlinks').status === 'gave_up' && !pf.start.some(s => s.job === 'backlinks') && pf.gave_up.length === 1,
      JSON.stringify(job(wf, 'cyc:site_a-com:2026-10-21:backlinks')));
  });

  // ===== CY12: racing sweeps and the deploy guard's question =====
  await guard('CY12 racing and deploy window', async () => {
    const SN = 'CY12 two racing sweeps start a job once; and the deploy guard answers the same as deploy_guard.py on every shared case'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    const A = planW(w, '2026-10-21T14:01:00.000Z'), B = planW(w, '2026-10-21T14:01:01.000Z');
    check('CY12: two sweeps that plan from the same tables both see the same start (which is why the claim is read back)', A.start.length === 1 && B.start.length === 1 && A.start[0].key === B.start[0].key, '');
    applyW(w, A, '2026-10-21T14:01:00.000Z');
    const C = planW(w, '2026-10-21T14:02:00.000Z');
    check('CY12: once one sweep recorded the job, the next one starts nothing: the job is "starting", waiting for its run', !C.start.length && C.sites[0].jobs[0].verdict === 'starting', JSON.stringify(C.sites[0].jobs[0]));
    // the generated payload node: our claim -> start; another sweep's claim -> stand down
    const rec = { ...A.start[0], status: 'starting', run_id: 'dsp:test-exec', started_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    mock('Cycle Record Row', [{ json: CYC.jobRow(rec) }]); mock('Save Cycle Record', [{ json: { id: 7, ...CYC.jobRow(rec) } }]);
    mock('Cycle Plan', [{ json: { ...A, now: new Date().toISOString() } }]);
    const mine = (await CY_RUN('Cycle Payload', [{ json: { ...CYC.jobRow(rec), id: 7 } }]))[0].json;
    const theirs = (await CY_RUN('Cycle Payload', [{ json: { ...CYC.jobRow(rec), run_id: 'dsp:other-sweep', id: 7 } }]))[0].json;
    check('CY12: the sweep whose claim is on the row read back starts the job; the one whose claim was overwritten stands down with the reason',
      mine.trigger === 'cycle' && !mine.skip && theirs.skip === true && /another dispatcher sweep \(dsp:other-sweep\) claimed this job/.test(theirs.reason), JSON.stringify([mine, theirs]));
    // the deploy guard's question
    const py = WIRE.deploy_guard || {};
    for (const c of CASES.cases) {
      const r = CYC.deployWindow({ jobs: c.jobs, cycles: c.cycles, now: CASES.now, minutes: c.minutes || 15 });
      const want = c.want, p = py[c.name];
      const K = (a) => JSON.stringify(a.map(j => j.key));
      const same = r.busy === want.busy && K(r.starting) === JSON.stringify(want.starting) && K(r.running) === JSON.stringify(want.running) && r.due.length === want.due && r.ignored_stale.length === (want.ignored || 0);
      check('CY12: deploy window - ' + c.name + ' -> ' + (want.busy ? 'refuse' : 'go') + ', and deploy_guard.py (build section 140) answered the same',
        same && !!p && p.busy === r.busy && JSON.stringify(p.starting) === K(r.starting) && JSON.stringify(p.running) === K(r.running) && p.due === r.due.length && p.ignored === r.ignored_stale.length
        && p.reason === r.reason && p.note === r.note, JSON.stringify({ js: r, py: p, want }));
    }
    const g = WIRE.guard_check || {};
    check('CY12: the deploy scripts\' guard (build section 140 self-test): idle and a fresh instance go; a running job refuses; --force and --force-monday override; tables that cannot be read refuse unless --force',
      g.idle === true && g.fresh_instance_no_tables === true && g.busy === false && g.running_only === true && g.busy_force === true && g.busy_force_monday === true && g.unreadable_401 === false && g.unreachable === false && g.unreadable_force === true, JSON.stringify(g));
  });

  // ===== CY13: capacity =====
  await guard('CY13 capacity', async () => {
    const SN = 'CY13 at most 2 starts a sweep and 2 dispatcher jobs in flight, never into a refusal the run guard would give, most overdue first'; reset(); begin(SN); const check = mkCheck(SN);
    const sites = ['a', 'b', 'c', 'd', 'e'].map(x => SITE('site_' + x + '-com', x + '.com'));
    const cycles = sites.map((s, i) => kick(s.site_id, s.domain, 'America/New_York', ISO(T('2026-10-21T14:00:00.000Z') - (5 - i) * 10 * MIN)));
    const w = world({ sites, monitors: sites.map(s => ALL_ON(s.site_id)), cycles });
    const p1 = sweep(w, '2026-10-21T14:01:00.000Z');
    check('CY13: five websites due at once: two start this sweep, the most overdue first (a, b); the rest wait for room with the reason',
      p1.start.length === 2 && p1.start.map(s => s.site_id).join() === 'site_a-com,site_b-com' && p1.sites.filter(s => (s.jobs[0] || {}).verdict === 'capacity').length === 3
      && /waits for room/.test(p1.sites[2].jobs[0].reason), JSON.stringify(p1.start.map(s => s.site_id)));
    const p2 = sweep(w, '2026-10-21T14:06:00.000Z');
    check('CY13: with two dispatcher jobs in flight, the next sweep starts none', !p2.start.length && p2.open_jobs === 2, JSON.stringify({ open: p2.open_jobs }));
    settleStarting(w, '2026-10-21T14:07:00.000Z');
    const p3 = sweep(w, '2026-10-21T14:11:00.000Z');
    check('CY13: when they settle, the most overdue cycles go on first: the next jobs of a and b (backlinks), while c, d and e still wait for room',
      p3.start.map(s => s.site_id + ':' + s.job).join() === 'site_a-com:backlinks,site_b-com:backlinks' && p3.sites.slice(2).every(x => x.jobs[0].verdict === 'capacity'), JSON.stringify(p3.start.map(s => [s.site_id, s.job])));
    const busy = world({ sites: [sites[0]], monitors: [ALL_ON('site_a-com')], cycles: [cycles[0]],
      ledger: [1, 2, 3].map(i => ({ id: i, run_id: String(i), key: 'parent:' + i, mode: 'technical', status: 'reserved', created_at: '2026-10-21T13:59:00.000Z', domain: 'x' + i + '.com' })) });
    const pb = sweep(busy, '2026-10-21T14:01:00.000Z');
    check('CY13: three other runs hold the run guard (its limit): nothing starts - a start would only be refused "too many open"', !pb.start.length && pb.room === 0 && pb.live_runs === 3, JSON.stringify({ room: pb.room, live: pb.live_runs }));
    const twin = world({ sites: [sites[0]], monitors: [ALL_ON('site_a-com')], cycles: [cycles[0]],
      ledger: [{ id: 1, run_id: '41', key: 'parent:40', mode: 'ai_visibility', status: 'reserved', created_at: '2026-10-21T13:59:00.000Z', domain: 'a.com' }] });
    const pt = sweep(twin, '2026-10-21T14:01:00.000Z');
    check('CY13: an on-demand AI visibility run of the same website is in flight: the cycle\'s AI visibility waits (it would be refused as its twin)',
      !pt.start.length && pt.sites[0].jobs[0].verdict === 'wait' && /in flight \(execution 41\).*twin/.test(pt.sites[0].jobs[0].reason), JSON.stringify(pt.sites[0].jobs[0]));
    const other = world({ sites: [sites[0]], monitors: [ALL_ON('site_a-com')], cycles: [cycles[0]],
      ledger: [{ id: 1, run_id: '41', key: 'cycle:cyc:site_b-com:2026-10-21:ai_visibility', mode: 'ai_visibility', status: 'reserved', created_at: '2026-10-21T13:59:00.000Z', domain: 'b.com' }] });
    check('CY13: the same job of ANOTHER website does not hold this one (the twin rule is per website)', sweep(other, '2026-10-21T14:01:00.000Z').start.length === 1, '');
    const tight = sweep(world({ sites, monitors: sites.map(s => ALL_ON(s.site_id)), cycles }), '2026-10-21T14:01:00.000Z', { config: { max_starts: 1 } });
    check('CY13: max_starts is honoured (1 -> one start)', tight.start.length === 1, '');
  });

  // ===== CY14: adoption =====
  await guard('CY14 adoption', async () => {
    const SN = 'CY14 a tracked, active website with no cycle row is adopted (anchored now, in the engine\'s zone, adopted: true) and its cycle 0 starts'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com'), SITE('site_b-com', 'b.com')], monitors: [ALL_ON('site_a-com'), ALL_ON('site_b-com')],
      cycles: [{ ...kick('site_b-com', 'b.com', 'Europe/London', '2026-10-19T09:00:00.000Z'), current_key: 'cyc:site_b-com:2026-10-19', last_cycle_at: '2026-10-19T09:01:00.000Z', next_due_at: '2026-10-26T06:00:00.000Z', last_monthly_key: '2026-10' }] });
    const p = sweep(w, '2026-10-21T14:01:00.000Z');
    const a = cyc(w, 'site_a-com');
    check('CY14: a.com had no row: adopted with anchor now, America/New_York, Wednesday, monthly day 21, adopted true; logged in the plan',
      p.adopted.length === 1 && p.adopted[0].site_id === 'site_a-com' && a.anchor_at === '2026-10-21T14:01:00.000Z' && a.tz === 'America/New_York' && a.adopted === true && a.cycle_weekday === 3 && a.monthly_day === 21,
      JSON.stringify({ adopted: p.adopted, a }));
    check('CY14: the adopted website\'s cycle 0 opens in the same sweep and its first job starts', a.current_key === 'cyc:site_a-com:2026-10-21' && p.start.some(s => s.site_id === 'site_a-com' && s.job === 'ai_visibility'), JSON.stringify(p.start));
    check('CY14: b.com, which has its row, is not adopted again', cyc(w, 'site_b-com').adopted === false && w.cycles.length === 2, '');
    const k = kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:01:00.000Z');
    check('CY14: the adopted row is the kickoff\'s row (one builder, CYC.newCycleRow) apart from adopted and the cycle it opened',
      ['anchor_at', 'tz', 'cycle_weekday', 'local_time', 'monthly_day', 'status', 'skip_jobs'].every(f => String(k[f]) === String(a[f])), JSON.stringify({ k, a }));
  });

  // ===== CY15: plan_only and dry runs =====
  await guard('CY15 plan only', async () => {
    const SN = 'CY15 plan-only (the safe default) and dry runs compute and report, record nothing as started and start nothing'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ mode: 'plan_only', sites: [SITE('site_a-com', 'a.com'), SITE('site_b-com', 'b.com')], monitors: [ALL_ON('site_a-com'), ALL_ON('site_b-com')],
      cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    const p = sweep(w, '2026-10-21T14:01:00.000Z');
    check('CY15: plan_only: no cycle row, no job row, no start - but the would-be starts, adoption and openings are in the plan for the report',
      p.mode === 'plan_only' && !p.start.length && !p.cycle_rows.length && !p.job_rows.length && p.would.start.length === 2 && p.would.cycle_rows.length === 2 && p.adopted.length === 1
      && p.sites.every(s => s.jobs[0].verdict === 'plan_only') && /plan_only mode/.test(p.sites[0].jobs[0].reason) && w.cycles.length === 1 && !w.jobs.length && !p.retention.run && !p.gave_up.length,
      JSON.stringify({ mode: p.mode, would: p.would && p.would.start.map(s => s.key) }));
    const d = planW(world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] }), '2026-10-28T10:01:00.000Z', { dry_run: true, mode: 'start' });
    check('CY15: a dry run with the mode on "start" still starts nothing and says it was a dry run', d.mode === 'plan_only' && d.dry_run && !d.start.length && /a dry run starts nothing/.test(d.sites[0].jobs[0].reason), JSON.stringify(d.sites[0].jobs[0]));
  });

  // ===== CY16: the "Coming up" preview =====
  await guard('CY16 preview', async () => {
    const SN = 'CY16 the preview: the cadence with preview: true, 48 h before every cycle except cycle 0, only when the cadence would write, keyed <next cycle key>:preview'; reset(); begin(SN); const check = mkCheck(SN);
    const mk = (pages) => { const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cadence: [{ site_id: 'site_a-com', pages_per_week: pages, status: 'active' }],
      cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] }); runOut(w, '2026-10-21T14:01:00.000Z', 30); return w; };
    const w = mk(1);
    check('CY16: after cycle 0 the next preview is due 48 h before cycle 1 (Mon 26 Oct 10:00Z); nothing previews cycle 0 itself',
      cyc(w).next_preview_at === '2026-10-26T10:00:00.000Z' && !w.jobs.some(r => r.job === 'preview'), JSON.stringify(cyc(w)));
    const early = sweep(w, '2026-10-26T09:55:00.000Z');
    check('CY16: five minutes before its time nothing previews', !early.start.length, '');
    const p = sweep(w, '2026-10-26T10:01:00.000Z');
    const pv = p.start[0] || {};
    check('CY16: at its time the preview starts the cadence with the exact payload: job preview, preview true, the NEXT cycle\'s key and due time',
      p.start.length === 1 && pv.key === 'cyc:site_a-com:2026-10-28:preview' && pv.workflow_id === 'SEOagentCadence1' && pv.ledger_key === 'cycle:cyc:site_a-com:2026-10-28:preview'
      && JSON.stringify(Object.keys(pv.payload).sort()) === JSON.stringify(['cycle_key', 'domain', 'job', 'monthly', 'preview', 'request_id', 'scheduled_for', 'site_id', 'trigger', 'tz']) && pv.payload.tz === 'America/New_York'
      && pv.payload.preview === true && pv.payload.job === 'preview' && pv.payload.cycle_key === 'cyc:site_a-com:2026-10-28' && pv.payload.scheduled_for === '2026-10-28T10:00:00.000Z'
      && pv.payload.request_id === 'cyc_a-com_20261028_preview' && pv.payload.monthly === false, JSON.stringify(pv));
    settleStarting(w, '2026-10-26T10:02:00.000Z');
    const p2 = sweep(w, '2026-10-26T10:06:00.000Z');
    check('CY16: the preview settles once (done) and is not started again', job(w, 'cyc:site_a-com:2026-10-28:preview').status === 'done' && !p2.start.length, JSON.stringify(job(w, 'cyc:site_a-com:2026-10-28:preview')));
    const w0 = mk(0);
    check('CY16: a website with 0 pages a week gets no preview (nothing would be written)', cyc(w0).next_preview_at === '' && !sweep(w0, '2026-10-26T10:01:00.000Z').start.length, JSON.stringify(cyc(w0)));
    const wl = mk(1); const pl = sweep(wl, '2026-10-28T05:00:00.000Z');   // the dispatcher was down for the preview: 5 h before the cycle
    check('CY16: a preview that could not start until 5 h before its cycle is recorded as skipped (too late to read), not started',
      !pl.start.length && job(wl, 'cyc:site_a-com:2026-10-28:preview').status === 'skipped' && /could not run in time/.test(job(wl, 'cyc:site_a-com:2026-10-28:preview').reason), JSON.stringify(job(wl, 'cyc:site_a-com:2026-10-28:preview')));
    const wf = mk(1); sweep(wf, '2026-10-26T10:01:00.000Z');
    upsert(wf.jobs, 'key', { ...job(wf, 'cyc:site_a-com:2026-10-28:preview'), status: 'failed', attempts: 1, reason: 'attempt 1 failed: crashed' });
    sweep(wf, '2026-10-28T10:01:00.000Z');
    check('CY16: a failed preview still open when its cycle starts is set aside with the reason', job(wf, 'cyc:site_a-com:2026-10-28:preview').status === 'skipped' && /its cycle started before the preview could run/.test(job(wf, 'cyc:site_a-com:2026-10-28:preview').reason),
      JSON.stringify(job(wf, 'cyc:site_a-com:2026-10-28:preview')));
  });

  // ===== CY17: a cycle replaced while jobs were open =====
  await guard('CY17 superseded', async () => {
    const SN = 'CY17 when the next cycle opens, jobs of the old one that never ran are set aside with the reason, a running one is left to finish, the old marker is closed'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    sweep(w, '2026-10-21T14:01:00.000Z');
    upsert(w.jobs, 'key', { ...job(w, 'cyc:site_a-com:2026-10-21:ai_visibility'), status: 'refused', reason: 'refused by its run guard (too_many_open)' });
    w.ledger.push({ run_id: '1', key: 'cycle:cyc:site_a-com:2026-10-21:ai_visibility', mode: 'ai_visibility', status: 'refused', created_at: '2026-10-28T09:00:00.000Z', domain: 'a.com', cost_basis: 'There are already 3 analyses running' });
    const p = sweep(w, '2026-10-28T10:01:00.000Z');
    check('CY17: the refused job of 21 Oct is set aside when 28 Oct opens; the old marker is closed; the new cycle starts with its own AI visibility',
      job(w, 'cyc:site_a-com:2026-10-21:ai_visibility').status === 'skipped' && /set aside: cycle cyc:site_a-com:2026-10-28 started before it could run/.test(job(w, 'cyc:site_a-com:2026-10-21:ai_visibility').reason)
      && job(w, 'cyc:site_a-com:2026-10-21:cycle').status === 'done' && /closed when cyc:site_a-com:2026-10-28 started/.test(job(w, 'cyc:site_a-com:2026-10-21:cycle').reason)
      && p.start.length === 1 && p.start[0].key === 'cyc:site_a-com:2026-10-28:ai_visibility', JSON.stringify(p.start));
    const w2 = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_ON('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    sweep(w2, '2026-10-21T14:01:00.000Z');
    upsert(w2.jobs, 'key', { ...job(w2, 'cyc:site_a-com:2026-10-21:ai_visibility'), started_at: '2026-10-28T09:58:00.000Z' });
    w2.ledger.push({ run_id: '2', key: 'cycle:cyc:site_a-com:2026-10-21:ai_visibility', mode: 'ai_visibility', status: 'reserved', created_at: '2026-10-28T09:58:30.000Z', domain: 'a.com' });
    const p2 = sweep(w2, '2026-10-28T10:01:00.000Z');
    check('CY17: a job of the old cycle still running is left to finish, and the new cycle\'s same job waits for it (the twin rule)',
      job(w2, 'cyc:site_a-com:2026-10-21:ai_visibility').status === 'running' && !p2.start.length && p2.sites[0].jobs[0].verdict === 'wait', JSON.stringify(p2.sites[0].jobs[0]));
  });

  // ===== CY18-CY24: the generated dispatcher nodes, end to end =====
  const SITES = [SITE('site_techand-ai', 'techand.ai')];
  const loadAll = (o) => { const c = o || {};
    mock('Load Cycle Mode', items(c.mode === undefined ? [] : [{ key: 'cycle:mode', kind: 'cycle', value: typeof c.mode === 'string' ? c.mode : JSON.stringify(c.mode), updated_at: '2026-10-19T12:00:00.000Z' }]));
    mock('Load Cycle Last', items(c.last ? [{ key: 'cycle:last', kind: 'cycle', value: '{}', updated_at: c.last }] : []));
    mock('Load Cycles', items(c.cycles || [])); mock('Load Cycle Jobs', items(c.jobs || [])); mock('Load Sites (Cycle)', items(c.sites || SITES));
    mock('Load Monitors (Cycle)', items(c.monitors || [ALL_ON('site_techand-ai')])); mock('Load Cadence (Cycle)', items(c.cadence || [{ site_id: 'site_techand-ai', pages_per_week: 1, status: 'active' }]));
    mock('Load Ladder Settings (Cycle)', items(c.ladder_settings || [])); mock('Load Ladders (Cycle)', items(c.ladders || [])); mock('Load Run Ledger (Cycle)', items(c.ledger || []));
    if (c.exec) { mock('Cycle Exec Requests', c.exec.req.map(json => ({ json }))); mock('Read Executions (Cycle)', c.exec.res.map(json => ({ json }))); }
    else { mock('Cycle Exec Requests', [{ json: { skip: true } }]); delete store['Read Executions (Cycle)']; } };
  const entry = (now, x) => mock('Cycle Entry', [{ json: { entry: 'sweep', now, clock_moved: false, dry_run: false, plan_only: false, note: '', ...(x || {}) } }]);
  const TK = (anchor) => kick('site_techand-ai', 'techand.ai', 'Asia/Dubai', anchor);

  await guard('CY18 the doors', async () => {
    const SN = 'CY18 the dispatcher\'s doors: Instance Started is init, the 5-minute schedule a sweep, Cycle Run a test whose clock moves only on a dry run'; reset(); begin(SN); const check = mkCheck(SN);
    mock('Instance Started', [{ json: { event: 'Instance started' } }]);
    const E1 = (await CY_RUN('Cycle Entry', [{ json: {} }]))[0].json; delete store['Instance Started'];
    const E2 = (await CY_RUN('Cycle Entry', [{ json: {} }]))[0].json;
    mock('Cycle Run', [{ json: { dry_run: true, now: '2026-10-28T02:01:00.000Z' } }]);
    const E3 = (await CY_RUN('Cycle Entry', [{ json: {} }]))[0].json;
    mock('Cycle Run', [{ json: { plan_only: 'true', now: '2026-10-28T02:01:00.000Z' } }]);
    const E4 = (await CY_RUN('Cycle Entry', [{ json: {} }]))[0].json; delete store['Cycle Run'];
    check('CY18: init / sweep / manual are told apart; a dry run may move the clock; plan_only with a clock is refused the clock and says why',
      E1.entry === 'init' && E2.entry === 'sweep' && E3.entry === 'manual' && E3.dry_run && E3.clock_moved && E3.now === '2026-10-28T02:01:00.000Z'
      && E4.entry === 'manual' && E4.plan_only && !E4.dry_run && !E4.clock_moved && E4.now !== '2026-10-28T02:01:00.000Z' && /only together with dry_run/.test(E4.note), JSON.stringify([E1, E2, E3, E4]));
    check('CY18 (build section 140): the generated workflow records before it starts, is inactive and publishes every target; the sweep is 3-58/5',
      WIRE.record_then_start === true && WIRE.sweep_cron === '3-58/5 * * * *' && (WIRE.published_targets || []).length === 8 && WIRE.workflow && WIRE.workflow.id === 'SEOagentCycleDsp' && WIRE.credential === 'SEOcredN8nApiKey',
      JSON.stringify({ rts: WIRE.record_then_start, cron: WIRE.sweep_cron, pub: WIRE.published_targets }));
  });

  await guard('CY19 executions and mode', async () => {
    const SN = 'CY19 the evidence nodes: n8n\'s executions are read only for workflows with a job in flight, and the mode switch defaults to plan_only'; reset(); begin(SN); const check = mkCheck(SN);
    mock('Load Cycle Jobs', items([{ key: 'k1', job: 'backlinks', status: 'running', workflow_id: 'SEOagentBacklnk1' }, { key: 'k2', job: 'audit', status: 'done', workflow_id: 'SEOagentAuditSc1' },
      { key: 'k3', job: 'cycle', status: 'running', workflow_id: '' }, { key: 'k4', job: 'preview', status: 'starting', workflow_id: 'SEOagentCadence1' }, { key: 'k5', job: 'x', status: 'running', workflow_id: 'Evil/../../x' }]));
    const R = (await CY_RUN('Cycle Exec Requests', [{ json: {} }])).map(i => i.json);
    check('CY19: reads only for workflows with a starting / running job (the cadence and the backlink monitor): their RUNNING runs (status=running, 250 a page), only known workflow ids, no key in any URL',
      R.length === 2 && R.map(r => r.workflow_id).join() === 'SEOagentBacklnk1,SEOagentCadence1' && R.every(r => r.kind === 'running' && /^http:\/\/localhost:5678\/api\/v1\/executions\?workflowId=SEOagent\w+&status=running&limit=250$/.test(r.url)) && !R.some(r => /key|token/i.test(r.url)), JSON.stringify(R));
    mock('Load Cycle Jobs', items([{ key: 'k2', job: 'audit', status: 'done', workflow_id: 'SEOagentAuditSc1' }]));
    check('CY19: nothing in flight: no read at all (a skip item for the IF)', (await CY_RUN('Cycle Exec Requests', [{ json: {} }]))[0].json.skip === true, '');
    const now = new Date().toISOString();
    const plan = async (o) => { loadAll(o); entry(o.now || now, o.entry); return (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json; };
    const base = { cycles: [TK(now)] };
    const none = await plan({ ...base }), off = await plan({ ...base, mode: { mode: 'plan_only' } }), bad = await plan({ ...base, mode: 'not json' }), on = await plan({ ...base, mode: { mode: 'start' } });
    check('CY19: no cycle:mode row, plan_only, or an unreadable value: plan_only (nothing starts); {"mode":"start"} starts',
      none.mode === 'plan_only' && /safe default/.test(none.mode_reason) && !none.start.length && none.would.start.length === 1 && off.mode === 'plan_only' && bad.mode === 'plan_only' && /not \{"mode"/.test(bad.mode_reason)
      && on.mode === 'start' && on.start.length === 1 && on.start[0].job === 'ai_visibility', JSON.stringify([none.mode_reason, bad.mode_reason, on.start]));
    const manual = await plan({ ...base, mode: { mode: 'start' }, entry: { plan_only: true } });
    check('CY19: a manual plan_only test overrides "start"', manual.mode === 'plan_only' && !manual.start.length && /asked for plan_only/.test(manual.mode_reason), manual.mode_reason);
    loadAll({ ...base, mode: { mode: 'start' } }); mock('Load Cycles', [{ json: { error: { message: 'Could not find the data table' } } }]); entry(now);
    const err = await CY_ERR('Cycle Plan', [{ json: {} }], /cannot read seo_cycles/);
    check('CY19: a cycle table that cannot be read fails the run (the Error Handler alerts) instead of planning blind', err.ok, err.error);
    // executions read back into the plan: a crashed run of ours is failed and retried
    const T0 = new Date(Date.now() - 15 * MIN).toISOString();
    const d0 = CYC.local('Asia/Dubai', T(T0)).date, ck = 'cyc:site_techand-ai:' + d0;
    const jobs = [CYC.jobRow({ key: ck + ':cycle', site_id: 'site_techand-ai', cycle_key: ck, job: 'cycle', status: 'running', monthly: true, due_at: T0, updated_at: T0 })];
    jobs.push(CYC.jobRow({ key: ck + ':ai_visibility', site_id: 'site_techand-ai', cycle_key: ck, job: 'ai_visibility', workflow_id: 'SEOagentAIVisib1', status: 'starting', attempts: 1, run_id: 'dsp:1', ledger_key: 'cycle:' + ck + ':ai_visibility', monthly: true, started_at: T0, updated_at: T0 }));
    const cy = { ...TK(T0), current_key: ck, last_cycle_at: T0, next_due_at: new Date(Date.now() + 6 * D1).toISOString(), last_monthly_key: CYC.periodKey(d0, TK(T0).monthly_day) };
    const crashed = await plan({ mode: { mode: 'start' }, cycles: [cy], jobs, ledger: [{ run_id: '881', key: 'cycle:' + ck + ':ai_visibility', mode: 'ai_visibility', status: 'reserved', created_at: new Date(T(T0) + 30000).toISOString(), domain: 'techand.ai' }],
      exec: { req: [{ workflow_id: 'SEOagentAIVisib1', url: 'x' }], res: [{ statusCode: 200, body: { data: [{ id: '881', mode: 'integrated', status: 'crashed', startedAt: new Date(T(T0) + 20000).toISOString() }] } }] } });
    const RL = (await CY_RUN('Cycle Release Rows', [{ json: {} }])).map(i => i.json);
    check('CY19: the dead run\'s reservation is handed to Release Dead Runs (marked stale, so the retry is not refused as its own twin)', RL.length === 1 && RL[0].run_id === '881' && /crashed/.test(RL[0].reason), JSON.stringify(RL));
    check('CY19: n8n says the run crashed: the plan marks it failed, releases its reservation and starts attempt 2 the same sweep',
      crashed.start.length === 1 && crashed.start[0].attempts === 2 && crashed.release.length === 1 && crashed.release[0].run_id === '881' && /crashed by n8n/.test((crashed.job_rows.find(r => r.job === 'ai_visibility') || {}).reason), JSON.stringify({ s: crashed.start, r: crashed.job_rows }));
    const blind = await plan({ mode: { mode: 'start' }, cycles: [cy], jobs, exec: { req: [{ workflow_id: 'SEOagentAIVisib1', url: 'x' }], res: [{ statusCode: 401, body: { message: 'unauthorized' } }] } });
    check('CY19: n8n\'s executions answer 401 and there is no ledger row yet: the job stays starting (blind), nothing is restarted on a guess',
      !blind.start.length && !blind.job_rows.some(r => r.job === 'ai_visibility') && /could not be read \(HTTP 401\)/.test((blind.sites[0].jobs[0] || {}).reason), JSON.stringify(blind.sites[0].jobs[0]));
    const gated = await plan({ mode: { mode: 'start' }, cycles: [TK(now)], monitors: [{ ...ALL_ON('site_techand-ai'), competitors: 'cleartax.com' }], ladders: [{ domain: 'techand.ai', keyword: 'cleartax login', head_keyword: 'e invoicing uae' }] });
    check('CY19: a website whose only stored rungs fail the fit gate has no ladder to rank-check (the gate on the read path)',
      gated.ladders_set_aside.length === 1 && /set aside by the fit gate/.test(gated.ladders_set_aside[0].note), JSON.stringify(gated.ladders_set_aside));
  });

  await guard('CY20 record then start', async () => {
    const SN = 'CY20 record then start through the generated nodes: the outcome rows first (exact columns), the job row "starting" with this sweep\'s claim, then the §14.2 payload exactly'; reset(); begin(SN); const check = mkCheck(SN);
    const now = new Date().toISOString();
    loadAll({ mode: { mode: 'start' }, cycles: [TK(now)] }); entry(now);
    const P = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
    const SR0 = (await CY_RUN('Cycle State Rows', [{ json: {} }])).map(i => i.json);
    const SRU = (await CY_RUN('Cycle State Updates', [{ json: {} }])).map(i => i.json), SR = SRU;
    check('CY20: the existing seo_cycles row is not written whole (no new row this sweep); its UPDATE carries only the fields the sweep changed - the cycle opened (current_key, last_cycle_at, last_monthly_key, next due 7 days on at 06:00 Dubai) - and never cycle_weekday, tz or anchor_at',
      SR0.length === 1 && SR0[0].skip === true && SR.length === 1 && SR[0].site_id === 'site_techand-ai' && SR[0].current_key === 'cyc:site_techand-ai:' + CYC.local('Asia/Dubai', T(now)).date && SR[0].last_cycle_at
      && CYC.local('Asia/Dubai', T(SR[0].next_due_at)).h === 6 && SR[0].last_monthly_key && SR[0].updated_at && !('cycle_weekday' in SR[0]) && !('tz' in SR[0]) && !('anchor_at' in SR[0])
      && Object.keys(SR[0]).every(k => WIRE.cycles_cols.includes(k)), JSON.stringify([SR0, SR]));
    const JR = (await CY_RUN('Cycle Job Rows', [{ json: { id: 1 } }])).map(i => i.json);
    check('CY20: the job rows carry exactly the seo_cycle_jobs columns: the cycle marker (running, monthly) - the start is not among them',
      JR.length === 1 && JSON.stringify(Object.keys(JR[0])) === JSON.stringify(WIRE.cycle_jobs_cols) && JR[0].job === 'cycle' && JR[0].status === 'running' && JR[0].monthly === true, JSON.stringify(JR));
    const SI = (await CY_RUN('Cycle Start Items', [{ json: { id: 2 } }])).map(i => i.json);
    mock('Loop Cycle Starts', [{ json: SI[0] }]); mock('Read Claim (Cycle)', [{ json: {} }]);   // the row read just before the claim: none yet
    const RR = (await CY_RUN('Cycle Record Row', [{ json: {} }]))[0].json;
    check('CY20: the record row is exactly the seo_cycle_jobs columns, status starting, attempt 1, this execution\'s claim token (dsp:<execution>:<time>:<random>), ledger key cycle:<cycle_key>:<job>',
      JSON.stringify(Object.keys(RR)) === JSON.stringify(WIRE.cycle_jobs_cols) && RR.status === 'starting' && RR.attempts === 1 && /^dsp:test-exec:[0-9a-z]+:[0-9a-z]+$/.test(RR.run_id) && RR.ledger_key === 'cycle:' + RR.cycle_key + ':ai_visibility'
      && RR.workflow_id === 'SEOagentAIVisib1' && RR.started_at && !RR.finished_at, JSON.stringify(RR));
    mock('Save Cycle Record', [{ json: { id: 41, createdAt: 'x', updatedAt: 'x', ...RR } }]);
    const PL = (await CY_RUN('Cycle Payload', [{ json: { id: 41, ...RR } }]))[0].json;
    check('CY20: the payload is the §14.2 contract exactly: trigger cycle, domain, site_id, cycle_key, job, monthly, scheduled_for, request_id, and the website\'s tz - no workflow id, no extras',
      JSON.stringify(Object.keys(PL).sort()) === JSON.stringify(['cycle_key', 'domain', 'job', 'monthly', 'request_id', 'scheduled_for', 'site_id', 'trigger', 'tz']) && PL.tz === 'Asia/Dubai' && PL.trigger === 'cycle' && PL.domain === 'techand.ai'
      && PL.site_id === 'site_techand-ai' && PL.job === 'ai_visibility' && PL.monthly === true && PL.cycle_key === RR.cycle_key && PL.request_id === 'cyc_techand-ai_' + CYC.dateOfKey(RR.cycle_key).replace(/-/g, '') + '_ai_visibility'
      && PL.scheduled_for === TK(now).anchor_at, JSON.stringify(PL));
    mock('Save Cycle Record', [{ json: { error: { message: 'Data table not found' } } }]);
    const X1 = (await CY_RUN('Cycle Payload', [{ json: {} }]))[0].json;
    mock('Save Cycle Record', [{ json: { id: 41, ...RR } }]); mock('Cycle Plan', [{ json: { ...P, now: new Date(Date.now() - 11 * MIN).toISOString() } }]);
    const X2 = (await CY_RUN('Cycle Payload', [{ json: { id: 41, ...RR } }]))[0].json;
    mock('Cycle Plan', [{ json: P }]);
    const X3 = (await CY_RUN('Cycle Payload', [{ json: {} }]))[0].json;
    check('CY20: no start without a saved record, from a plan older than 10 minutes, or without the row read back - each a skip with its reason',
      X1.skip && /could not be saved \(Data table not found\)/.test(X1.reason) && X2.skip && /paused after it planned/.test(X2.reason) && X3.skip && /could not be read back/.test(X3.reason), JSON.stringify([X1, X2, X3]));
    const OK = (await CY_RUN('Cycle Start Result', [{ json: PL }]))[0].json, KO = (await CY_RUN('Cycle Start Result', [{ json: { error: { message: 'Workflow is not active and cannot be executed.' } } }]))[0].json;
    check('CY20: what the start did goes back on the same row: still starting (waiting for its ledger row) or failed with n8n\'s own words',
      OK.status === 'starting' && /waiting for its ledger row/.test(OK.reason) && KO.status === 'failed' && /Workflow is not active/.test(KO.reason) && KO.key === RR.key && JSON.stringify(Object.keys(OK)) === JSON.stringify(WIRE.cycle_jobs_cols), JSON.stringify([OK, KO]));
  });

  await guard('CY21 a whole cycle through the nodes', async () => {
    const SN = 'CY21 the generated nodes over a whole cycle: each sweep reads the ledger, marks the finished job done, starts the next, and closes the cycle'; reset(); begin(SN); const check = mkCheck(SN);
    const t0 = Date.now() - 2 * H1;
    const st = { cycles: [{ ...TK(new Date(t0).toISOString()) }], jobs: [], ledger: [] };
    const started = [];
    for (let i = 0; i < 14; i++) {
      const now = new Date(t0 + i * 5 * MIN).toISOString();
      loadAll({ mode: { mode: 'start' }, cycles: st.cycles, jobs: st.jobs, ledger: st.ledger, monitors: [ALL_ON('site_techand-ai')], cadence: [{ site_id: 'site_techand-ai', pages_per_week: 1 }],
        ladders: [{ domain: 'techand.ai', keyword: 'e invoicing uae', head_keyword: 'e invoicing uae' }] }); entry(now);
      const P = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
      for (const r of (await CY_RUN('Cycle State Rows', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) upsert(st.cycles, 'site_id', r);
      for (const r of (await CY_RUN('Cycle State Updates', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) upsert(st.cycles, 'site_id', r);
      for (const r of (await CY_RUN('Cycle Job Rows', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) upsert(st.jobs, 'key', r);
      for (const s of (await CY_RUN('Cycle Start Items', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) {
        mock('Loop Cycle Starts', [{ json: s }]); mock('Read Claim (Cycle)', items(st.jobs.filter(j => j.key === s.key)));
        const rr = (await CY_RUN('Cycle Record Row', [{ json: {} }]))[0].json; const rec = { ...rr, started_at: now, updated_at: now }; upsert(st.jobs, 'key', rec);
        mock('Cycle Record Row', [{ json: rec }]); mock('Save Cycle Record', [{ json: { id: 1, ...rec } }]); mock('Cycle Plan', [{ json: { ...P, now: new Date().toISOString() } }]);
        const pl = (await CY_RUN('Cycle Payload', [{ json: { id: 1, ...rec } }]))[0].json; started.push(pl);
        st.ledger.push({ run_id: String(5000 + started.length), key: 'cycle:' + pl.cycle_key + ':' + pl.job, mode: CYC.BY_JOB[pl.job].mode, status: 'done', created_at: new Date(T(now) + MIN).toISOString(), settled_at: new Date(T(now) + 2 * MIN).toISOString(), domain: 'techand.ai' });
      }
      if (P.sites[0].verdict === 'cycle_done') break;
    }
    const ck = st.cycles[0].current_key;
    check('CY21: cycle 0 ran its jobs in order through the generated nodes, one per sweep (site tracking skipped), each with the §14.2 payload',
      JSON.stringify(started.map(p => p.job)) === JSON.stringify(['ai_visibility', 'backlinks', 'rank_tracker', 'ai_growth', 'content_cadence', 'link_builder', 'audit'])
      && started.every(p => p.trigger === 'cycle' && p.cycle_key === ck && p.domain === 'techand.ai') && started.find(p => p.job === 'backlinks').light === false, JSON.stringify(started.map(p => [p.job, p.light])));
    check('CY21: every job row ends done or skipped, from its settled ledger row, and the marker closes with the counts',
      CYC.NAMES.every(n => ['done', 'skipped'].includes((st.jobs.find(r => r.key === ck + ':' + n) || {}).status)) && (st.jobs.find(r => r.key === ck + ':cycle') || {}).status === 'done'
      && /7 done, 1 skipped, 0 gave up/.test((st.jobs.find(r => r.key === ck + ':cycle') || {}).reason), JSON.stringify(st.jobs.map(r => [r.job, r.status])));
  });

  await guard('CY22 retention report alarm', async () => {
    const SN = 'CY22 retention deletes job rows older than 120 days, the sweep is recorded in seo_cache, and a job that gave up fails the run so the Error Handler alerts'; reset(); begin(SN); const check = mkCheck(SN);
    const P = CYC.plan({ now: '2026-10-21T14:00:00.000Z', mode: 'start', sites: [], cycles: [], jobs: [], ledger: [], runs: {} });
    mock('Cycle Plan', [{ json: { ...P, mode_reason: 'start', plan_only_input: false, clock_moved: false } }]);
    const R1 = (await CY_RUN('Cycle Retention', [{ json: {} }]))[0].json;
    mock('Cycle Plan', [{ json: { ...CYC.plan({ now: '2026-10-21T14:00:00.000Z', mode: 'plan_only', sites: [], cycles: [], jobs: [], ledger: [], runs: {} }) } }]);
    const R2 = (await CY_RUN('Cycle Retention', [{ json: {} }]))[0].json;
    check('CY22: retention cuts at 120 days before now (2026-06-23); a plan-only sweep deletes nothing', R1.before === '2026-06-23T14:00:00.000Z' && R1.days === 120 && R2.skip === true, JSON.stringify([R1, R2]));
    mock('Cycle Plan', [{ json: { ...P, mode_reason: 'x', plan_only_input: false, clock_moved: false } }]);
    const REP = (await CY_RUN('Cycle Report', [{ json: { key: 'cyc:a:2026-10-21:audit', status: 'starting', run_id: 'dsp:1', attempts: 1, reason: 'started' } }, { json: { skip: true, key: 'k2', reason: 'another dispatcher sweep claimed it' } }]))[0].json;
    const RV = JSON.parse(REP.value);
    mock('Cycle Plan', [{ json: { ...P, dry_run: true } }]);
    const REP2 = (await CY_RUN('Cycle Report', [{ json: {} }]))[0].json;
    check('CY22: the report is seo_cache cycle:last with what started and what stood down; a test writes cycle:last_test',
      REP.key === 'cycle:last' && REP.kind === 'cycle' && RV.started.length === 2 && RV.started[1].status === 'not_started' && REP2.key === 'cycle:last_test', JSON.stringify({ k: REP.key, s: RV.started, k2: REP2.key }));
    mock('Cycle Plan', [{ json: { ...P, gave_up: [{ key: 'cyc:site_a:2026-10-21:backlinks', job: 'backlinks', domain: 'a.com', reason: 'gave up after 3 attempt(s): crashed' }] } }]);
    const al = await CY_ERR('Cycle Alarm', [{ json: {} }], /1 cycle job\(s\) gave up.*a\.com backlinks \(gave up after 3 attempt/);
    mock('Cycle Plan', [{ json: { ...P, mode: 'plan_only', gave_up: [{ key: 'x', job: 'backlinks', domain: 'a.com', reason: 'r' }] } }]);
    const quiet = (await CY_RUN('Cycle Alarm', [{ json: {} }]))[0].json;
    check('CY22: a job that gave up fails the run at the last node, naming the website, the job and the reason; a plan-only run never alarms', al.ok && quiet.gave_up === 0, al.error);
  });

  await guard('CY23 deploy scripts', async () => {
    const SN = 'CY23 both deploy scripts ask the one guard (build section 140): the Monday window is gone, --force and --force-monday override, unreadable tables refuse'; reset(); begin(SN); const check = mkCheck(SN);
    const g = WIRE.deploy_guard || {};
    check('CY23: the build ran deploy_guard.py on every shared case', Object.keys(g).length === CASES.cases.length && CASES.cases.every(c => g[c.name] && g[c.name].busy === c.want.busy), JSON.stringify(Object.keys(g)));
    let cw = {}; try { cw = JSON.parse(fs.readFileSync(path.join(__dirname, 'catchup_wiring.json'), 'utf8')); } catch (e) {}
    check('CY23: the catch-up\'s wiring no longer carries the Monday 07:00-12:00 guard, and it does not catch up the dispatcher\'s sweep',
      !cw.deploy_guard && !(cw.schedules || []).some(s => s.id === 'SEOagentCycleDsp'), JSON.stringify({ g: !!cw.deploy_guard, s: (cw.schedules || []).map(s => s.id) }));
  });

  await guard('CY24 kickoff to dispatcher', async () => {
    const SN = 'CY24 the kickoff\'s row is what the dispatcher runs: Site Kickoff writes it (generated nodes), the next sweep opens cycle 0 in the owner\'s zone and starts its first job'; reset(); begin(SN); const check = mkCheck(SN);
    const now = new Date().toISOString();
    const v = (await run('Kickoff Validate', { body: { domain: 'https://www.techand.ai/', tz: 'Asia/Dubai', skip_jobs: ['ai_visibility'] } }))[0].json; mock('Kickoff Validate', [{ json: v }]);
    mock('Load Sites (Kickoff)', [{ json: SITES[0] }]); mock('Load Cycles (Kickoff)', [{ json: {} }]);
    const KP = (await run('Kickoff Plan', [{ json: {} }]))[0].json;
    const row = (await run('Kickoff Cycle Row', [{ json: {} }]))[0].json;
    loadAll({ mode: { mode: 'start' }, cycles: [row] }); entry(new Date(Date.now() + MIN).toISOString());
    const P = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
    check('CY24: the kickoff answers with cycle 0\'s key (the Dubai date) and the dispatcher opens exactly that cycle, skipping AI visibility (already run) and starting backlinks',
      KP.cycle_key === 'cyc:site_techand-ai:' + CYC.local('Asia/Dubai', T(now)).date && P.sites[0].opened && P.sites[0].opened.key === KP.cycle_key && P.sites[0].opened.cycle0
      && P.start.length === 1 && P.start[0].job === 'backlinks' && /already run when tracking was set up/.test((P.job_rows.find(r => r.job === 'ai_visibility') || {}).reason || ''), JSON.stringify({ kp: KP.cycle_key, s: P.sites[0] }));
  });

  // =====================================================================================================================================
  // CY25-CY32 (F-ENG 2026-10-20): the production-safety review of the cycle. Each check fails on the code before the fix (the replays of
  // the review: err.js, blind.js, loadfail.js) and n8n's answers come from harness/fake_n8n_api.js, which answers as n8n 2.41.4 does.
  // =====================================================================================================================================
  const T25 = '2026-10-21T14:00:00.000Z', CK25 = 'cyc:site_a-com:2026-10-21', LK25 = (j) => 'cycle:' + CK25 + ':' + j;
  const row25 = (job, wf, x) => CYC.jobRow({ key: CK25 + ':' + job, site_id: 'site_a-com', cycle_key: CK25, job, workflow_id: wf, status: 'starting', attempts: 1, run_id: 'dsp:9',
    ledger_key: LK25(job), monthly: true, started_at: T25, updated_at: T25, ...(x || {}) });
  const W25 = (rows, ledger, execs) => { const w = world({ sites: [SITE('site_a-com', 'a.com'), SITE('site_b-com', 'b.com')], monitors: [ALL_ON('site_a-com'), ALL_ON('site_b-com')],
    cycles: [{ ...kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T13:00:00.000Z'), current_key: CK25, last_cycle_at: '2026-10-21T13:01:00.000Z', next_due_at: '2026-10-28T10:00:00.000Z', last_monthly_key: '2026-10' },
      { ...kick('site_b-com', 'b.com', 'America/New_York', '2026-10-21T13:59:00.000Z') }],
    jobs: [CYC.jobRow({ key: CK25 + ':cycle', site_id: 'site_a-com', cycle_key: CK25, job: 'cycle', status: 'running', monthly: true, due_at: '2026-10-21T13:00:00.000Z', updated_at: T25 }),
      CYC.jobRow({ key: CK25 + ':ai_visibility', site_id: 'site_a-com', cycle_key: CK25, job: 'ai_visibility', status: 'done', monthly: true, updated_at: T25 }), ...rows], ledger });
    w.execs = execs; return w; };

  await guard('CY25 error and unsettled', async () => {
    const SN = 'CY25 an execution that ended in "error" is failed at once and its reservation released; one that ended "success" with its row still reserved is done, never run again, and alerted once as unsettled money'; reset(); begin(SN); const check = mkCheck(SN);
    const row = row25('backlinks', 'SEOagentBacklnk1');
    const L = [{ key: LK25('backlinks'), run_id: '700', status: 'reserved', created_at: ISO(T(T25) + 20000), mode: 'backlinks', domain: 'a.com' }];
    const ex = (st) => [{ id: '700', workflowId: 'SEOagentBacklnk1', status: st, mode: 'integrated', startedAt: ISO(T(T25) + 10000), stoppedAt: st === 'running' ? null : ISO(T(T25) + 60000) }];
    const at = (st, mins) => CYC.outcome({ row, ledger: L, runs: runsVia(ex(st), [row], L), claimed: new Set(), now: T(T25) + mins * MIN, cfg: CYC.DEFAULTS });
    const e5 = at('error', 5), e60 = at('error', 60), e119 = at('error', 119), s5 = at('success', 5), s121 = at('success', 121), r5 = at('running', 5), c5 = at('crashed', 5);
    check('CY25: "error" with the row reserved is failed at once - at 5, 60 and 119 min, not after the 2-hour stale rule (err.js: it was "running" until 121 min) - with the reservation released',
      [e5, e60, e119].every(o => o.state === 'failed' && o.release === '700') && /ended with an error/.test(e5.reason) && c5.state === 'failed' && c5.release === '700', JSON.stringify([e5, e60, e119]));
    check('CY25: "success" with the row still reserved is done (err.js: it was "running", then "failed" at 121 min and run AGAIN), its reservation released, its money named as unsettled',
      s5.state === 'done' && s121.state === 'done' && s5.release === '700' && s5.unsettled && s5.unsettled.run_id === '700' && s5.unsettled.ledger_key === LK25('backlinks') && /not settled/.test(s5.reason), JSON.stringify([s5, s121]));
    check('CY25: a reserved row whose run n8n still runs is running - GET /executions/<id> shows a running execution, the default list never does',
      r5.state === 'running' && fakeN8nApi(ex('running'))(API_BASE + '/executions?workflowId=SEOagentBacklnk1&limit=100').body.data.length === 0 && fakeN8nApi(ex('running'))(API_BASE + '/executions/700').body.status === 'running', JSON.stringify(r5));
    // through the plan
    const we = W25([row], L.map(r => ({ ...r })), ex('error')), pe = sweep(we, T(T25) + 5 * MIN);
    check('CY25: through the plan, the errored run is released (Release Dead Runs) and attempt 2 starts the same sweep - it does not hold a start slot for 2 h',
      pe.release.some(r => r.run_id === '700') && pe.start.some(s => s.job === 'backlinks' && s.attempts === 2), JSON.stringify({ rel: pe.release, s: pe.start.map(s => [s.job, s.attempts]) }));
    const ws = W25([row], L.map(r => ({ ...r })), ex('success')), ps = sweep(ws, T(T25) + 5 * MIN), ps2 = sweep(ws, T(T25) + 10 * MIN);
    check('CY25: through the plan, the finished run is done and never started again, its reservation released, and named in `unsettled` once (the sweep it turned done, not the next)',
      job(ws, CK25 + ':backlinks').status === 'done' && !ps.start.some(s => s.job === 'backlinks') && !ps2.start.some(s => s.job === 'backlinks') && ps.release.some(r => r.run_id === '700')
      && ps.unsettled.length === 1 && ps.unsettled[0].domain === 'a.com' && ps.unsettled[0].job === 'backlinks' && ps2.unsettled.length === 0, JSON.stringify({ u: ps.unsettled, u2: ps2.unsettled, st: job(ws, CK25 + ':backlinks') }));
    mock('Cycle Plan', [{ json: { ...ps, mode: 'start', dry_run: false } }]);
    const al = await CY_ERR('Cycle Alarm', [{ json: {} }], /1 cycle run\(s\) finished but left their run-ledger row unsettled.*a\.com backlinks \(execution 700/);
    mock('Cycle Plan', [{ json: { ...ps2, mode: 'start', dry_run: false } }]);
    const quiet = (await CY_RUN('Cycle Alarm', [{ json: {} }]))[0].json;
    check('CY25: the generated Cycle Alarm fails the run (the Error Handler\'s ops alert) for the unsettled money, once; the next sweep is quiet', al.ok && quiet.unsettled === 0, al.error);
  });

  await guard('CY26 blind is bounded', async () => {
    const SN = 'CY26 a start the reads cannot confirm is blind for at most stale_hours, then failed; the reads are windows on startedAt, a full page is "not confirmable", never "no run"'; reset(); begin(SN); const check = mkCheck(SN);
    const row = row25('content_cadence', 'SEOagentCadence1');
    // blind.js: the dispatcher was off; 100 newer finished runs (other websites') fill the old one-page read. The old evidence shape:
    const old = { SEOagentCadence1: { ok: true, full: true, oldest: ISO(T(T25) + H1), data: Array.from({ length: 100 }, (_, i) => ({ id: String(5000 + i), status: 'success', mode: 'integrated', startedAt: ISO(T(T25) + H1 + i * MIN) })) } };
    const ob = (now) => CYC.outcome({ row, ledger: [], runs: old, claimed: new Set(), now, cfg: CYC.DEFAULTS });
    check('CY26: blind.js - a full page newer than the start: blind for at most 2 h, then failed (was blind after 1, 3 and 30 days, holding a start slot for ever)',
      ob(T(T25) + 30 * MIN).state === 'blind' && ob(T(T25) + D1).state === 'failed' && ob(T(T25) + 30 * D1).state === 'failed' && /treated as failed/.test(ob(T(T25) + D1).reason), JSON.stringify(ob(T(T25) + D1)));
    // the reads the kit makes now: a window on startedAt per start, the running runs, each reservation by id - 250 a page
    const R = CYC.execReads({ jobs: [row], ledger: [{ key: LK25('content_cadence'), run_id: '901', status: 'reserved', created_at: ISO(T(T25) + 30000) }], known: WF_IDS, api: API_BASE, cfg: CYC.DEFAULTS });
    const kinds = R.reads.map(r => r.kind).join();
    const win = R.reads.find(r => r.kind === 'window') || {};
    check('CY26: the reads: the running runs (status=running), the reservation by id, and a window startedAfter = start - 5 s, startedBefore = start + confirm + 1 min, limit 250',
      kinds === 'running,id,window' && /status=running/.test(R.reads[0].url) && /\/executions\/901$/.test(R.reads[1].url) && win.from === ISO(T(T25) - 5000) && win.to === ISO(T(T25) + 11 * MIN)
      && /startedAfter=2026-10-21T13%3A59%3A55\.000Z&startedBefore=2026-10-21T14%3A11%3A00\.000Z&limit=250$/.test(win.url) && !R.unread.length, JSON.stringify(R));
    // the same world as blind.js through the faithful API: the 100 later runs are outside the window, so the job is not "blind" - after 10 min with no run it is failed and retried
    const later = Array.from({ length: 100 }, (_, i) => ({ id: String(5000 + i), workflowId: 'SEOagentCadence1', status: 'success', mode: 'integrated', startedAt: ISO(T(T25) + H1 + i * MIN), stoppedAt: ISO(T(T25) + H1 + i * MIN + 30000) }));
    const nb = CYC.outcome({ row, ledger: [], runs: runsVia(later, [row], []), claimed: new Set(), now: T(T25) + 3 * D1, cfg: CYC.DEFAULTS });
    check('CY26: blind.js through the reads: the later runs are outside the start\'s window, so the start is failed (no run appeared in 10 min) and retried - not blind', nb.state === 'failed' && /no run of its workflow appeared/.test(nb.reason), JSON.stringify(nb));
    // a window that is really full (300 runs of other websites inside the 10 minutes): nextCursor -> not confirmable -> blind, then failed
    const crowd = Array.from({ length: 300 }, (_, i) => ({ id: String(7000 + i), workflowId: 'SEOagentCadence1', status: 'success', mode: 'trigger', startedAt: ISO(T(T25) + 1000 + i * 1000), stoppedAt: ISO(T(T25) + 2000 + i * 1000) }));
    const full = runsVia(crowd, [row], []);
    const fb = (now) => CYC.outcome({ row, ledger: [], runs: full, claimed: new Set(), now, cfg: CYC.DEFAULTS });
    check('CY26: a full window (n8n answers nextCursor) is incomplete: blind at 30 min, failed after 2 h',
      (full.SEOagentCadence1.incomplete || []).length === 1 && fb(T(T25) + 30 * MIN).state === 'blind' && fb(T(T25) + 2 * H1 + MIN).state === 'failed', JSON.stringify({ inc: full.SEOagentCadence1.incomplete, s: fb(T(T25) + 30 * MIN) }));
    const capped = CYC.execReads({ jobs: [row], ledger: [], known: WF_IDS, api: API_BASE, cfg: { ...CYC.DEFAULTS, max_exec_reads: 1 } });
    const cr = CYC.runsFrom(capped.reads, capped.reads.map(r => fakeN8nApi([])(r.url)), capped.unread);
    check('CY26: reads beyond max_exec_reads are not made, and the start they covered is blind (bounded), never "no run"', capped.reads.length === 1 && capped.unread.length === 1
      && CYC.outcome({ row, ledger: [], runs: cr, claimed: new Set(), now: T(T25) + 30 * MIN, cfg: CYC.DEFAULTS }).state === 'blind', JSON.stringify(capped));
    // and the plan of blind.js: the stuck row no longer holds one of the two in-flight slots for ever
    const wb = W25([row, row25('link_builder', 'SEOagentLinkBld1')], [], later);
    const pb = sweep(wb, T(T25) + 3 * D1);
    check('CY26: blind.js through the plan: the two stuck rows are failed and retried, and b.com\'s cycle 0 gets room', pb.start.length === 2 && job(wb, CK25 + ':content_cadence').attempts >= 1
      && ['failed', 'starting'].includes(job(wb, CK25 + ':content_cadence').status), JSON.stringify({ s: pb.start.map(s => [s.site_id, s.job, s.attempts]), open: pb.open_jobs }));
  });

  await guard('CY27 running runs are read', async () => {
    const SN = 'CY27 n8n\'s public API never lists a running execution unless asked status=running: the dispatcher asks, so a run slow to reserve its ledger row is running, never started twice'; reset(); begin(SN); const check = mkCheck(SN);
    const T0 = new Date(Date.now() - 12 * MIN).toISOString(), d0 = CYC.local('Asia/Dubai', T(T0)).date, ck = 'cyc:site_techand-ai:' + d0;
    const jobs = [CYC.jobRow({ key: ck + ':cycle', site_id: 'site_techand-ai', cycle_key: ck, job: 'cycle', status: 'running', monthly: true, due_at: T0, updated_at: T0 }),
      CYC.jobRow({ key: ck + ':ai_visibility', site_id: 'site_techand-ai', cycle_key: ck, job: 'ai_visibility', workflow_id: 'SEOagentAIVisib1', status: 'starting', attempts: 1, run_id: 'dsp:1', ledger_key: 'cycle:' + ck + ':ai_visibility', monthly: true, started_at: T0, updated_at: T0 })];
    const cy = { ...TK(T0), current_key: ck, last_cycle_at: T0, next_due_at: new Date(Date.now() + 6 * D1).toISOString(), last_monthly_key: CYC.periodKey(d0, TK(T0).monthly_day) };
    const execs = [{ id: '991', workflowId: 'SEOagentAIVisib1', status: 'running', mode: 'integrated', startedAt: new Date(T(T0) + 20000).toISOString(), stoppedAt: null }];
    const api = fakeN8nApi(execs);
    check('CY27: the faithful API: the default list of the workflow does not show the running run; status=running does', api(API_BASE + '/executions?workflowId=SEOagentAIVisib1&limit=250').body.data.length === 0
      && api(API_BASE + '/executions?workflowId=SEOagentAIVisib1&status=running&limit=250').body.data.length === 1, '');
    loadAll({ mode: { mode: 'start' }, cycles: [cy], jobs }); entry(new Date().toISOString());
    const req = (await CY_RUN('Cycle Exec Requests', [{ json: {} }])).map(i => i.json);
    mock('Cycle Exec Requests', req.map(json => ({ json }))); mock('Read Executions (Cycle)', req.map(r => ({ json: api(r.url) })));
    const P = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
    const v = (P.sites[0].jobs || []).find(j => j.job === 'ai_visibility') || {};
    check('CY27: 12 min after the start, with no ledger row yet, the generated nodes see the running run: the job is running, nothing is started again (was: "failed" after 10 min, then a second start)',
      req.some(r => r.kind === 'running') && v.verdict === 'running' && /execution 991/.test(v.reason) && !P.start.some(s => s.job === 'ai_visibility') && (P.job_rows.find(r => r.job === 'ai_visibility') || {}).status === 'running',
      JSON.stringify({ req: req.map(r => r.kind), v, start: P.start }));
    // the old evidence (the default list only) - what the dispatcher read before: no run -> failed -> started twice
    const oldRuns = { SEOagentAIVisib1: { ok: true, data: api(API_BASE + '/executions?workflowId=SEOagentAIVisib1&limit=100').body.data } };
    check('CY27: with the default list only (the old read) the same job is "failed" and would start again - the double start this fixes',
      CYC.outcome({ row: jobs[1], ledger: [], runs: oldRuns, claimed: new Set(), now: Date.now(), cfg: CYC.DEFAULTS }).state === 'failed', '');
  });

  await guard('CY28 every load refuses', async () => {
    const SN = 'CY28 a table that could not be read - any of them, the websites\' own settings too - refuses the whole sweep; nothing is skipped with a false reason'; reset(); begin(SN); const check = mkCheck(SN);
    const site = SITE('site_a-com', 'a.com');
    const c = { ...kick('site_a-com', 'a.com', 'America/New_York', '2026-10-14T14:00:00.000Z'), current_key: CK25, last_cycle_at: T25, last_monthly_key: '2026-10' };
    const done = (j) => CYC.jobRow({ key: CK25 + ':' + j, site_id: 'site_a-com', cycle_key: CK25, job: j, status: 'done', updated_at: T25 });
    const jobs = [CYC.jobRow({ key: CK25 + ':cycle', site_id: 'site_a-com', cycle_key: CK25, job: 'cycle', status: 'running', monthly: false, due_at: T25 }), ...['ai_visibility', 'backlinks', 'rank_tracker', 'site_tracker', 'ai_growth'].map(done)];
    const err = [{ error: { message: 'SQLITE_BUSY: database is locked' } }];
    const ok = CYC.plan({ now: T(T25) + H1, mode: 'start', sites: [site], cycles: [c], jobs, monitors: [ALL_ON('site_a-com')], cadence: [{ site_id: 'site_a-com', pages_per_week: 1, status: 'active' }], ladders: [{ domain: 'a.com' }], ladder_settings: [], ledger: [], runs: {} });
    check('CY28: control - the tables read: the cadence starts (the next job in the cycle)', ok.start.some(s => s.job === 'content_cadence'), JSON.stringify(ok.start));
    const thrown = (o) => { try { CYC.plan({ now: T(T25) + H1, mode: 'start', sites: [site], cycles: [c], jobs, monitors: [ALL_ON('site_a-com')], cadence: [], ladders: [], ladder_settings: [], ledger: [], runs: {}, ...o }); return ''; } catch (e) { return String(e.message); } };
    const t1 = thrown({ monitors: err }), t2 = thrown({ cadence: err, ladders: err }), t3 = thrown({ ladder_settings: err }), t4 = thrown({ sites: err });
    check('CY28: loadfail.js - an error item from Load Monitors / Load Cadence / Load Ladders / Load Ladder Settings / Load Sites makes the kit refuse the sweep (was: content_cadence "skipped: no pages a week are set (0)" and written)',
      /seo_monitors could not be read \(SQLITE_BUSY/.test(t1) && /seo_cadence could not be read/.test(t2) && /seo_ladder_settings could not be read/.test(t3) && /seo_sites could not be read/.test(t4), JSON.stringify([t1, t2, t3, t4]));
    for (const n of ['Load Monitors (Cycle)', 'Load Cadence (Cycle)', 'Load Ladders (Cycle)', 'Load Ladder Settings (Cycle)', 'Load Cycle Mode', 'Load Cycle Last']) {
      loadAll({ mode: { mode: 'start' }, cycles: [TK(new Date().toISOString())] }); mock(n, [{ json: { error: { message: 'Data table not found' } } }]); entry(new Date().toISOString());
      const r = await CY_ERR('Cycle Plan', [{ json: {} }], /cannot read .*Data table not found.*nothing was started or skipped/);
      check('CY28: the generated Cycle Plan fails the run (the Error Handler alerts) when ' + n + ' could not be read', r.ok, r.error);
    }
  });

  await guard('CY29 the Instance Started door and the claim', async () => {
    const SN = 'CY29 the Instance Started door stands down after a sweep that just finished, and two sweeps planned from one snapshot start a job once (the row is read before the claim, the claim is a token, read back)'; reset(); begin(SN); const check = mkCheck(SN);
    const now = new Date().toISOString();
    loadAll({ mode: { mode: 'start' }, cycles: [TK(now)], last: new Date(Date.now() - 60000).toISOString() }); entry(now, { entry: 'init' });
    const P1 = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
    mock('Cycle Plan', [{ json: P1 }]); const RP = (await CY_RUN('Cycle Report', [{ json: {} }]))[0].json;
    check('CY29: n8n started 45 s ago and a sweep finished 60 s ago: the Instance Started door plans nothing, writes nothing, starts nothing, and keeps its own record (cycle:last stays the last real sweep)',
      /stands down/.test(P1.skipped_init || '') && !P1.start.length && !P1.cycle_rows.length && !P1.job_rows.length && RP.key === 'cycle:last_init_skip', JSON.stringify({ s: P1.skipped_init, k: RP.key }));
    loadAll({ mode: { mode: 'start' }, cycles: [TK(now)], last: new Date(Date.now() - 3 * MIN).toISOString() }); entry(now, { entry: 'init' });
    const P2 = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
    loadAll({ mode: { mode: 'start' }, cycles: [TK(now)], last: new Date(Date.now() - 60000).toISOString() }); entry(now, { entry: 'sweep' });
    const P3 = (await CY_RUN('Cycle Plan', [{ json: {} }]))[0].json;
    check('CY29: the door plans as usual when the last sweep is 3 min old, and the 5-minute sweep is never held back by it', !P2.skipped_init && P2.start.length === 1 && !P3.skipped_init && P3.start.length === 1, JSON.stringify([P2.skipped_init, P3.skipped_init]));
    // two sweeps from one snapshot: A records first; B reads the row before its claim and backs off
    const s = P3.start[0];
    mock('Loop Cycle Starts', [{ json: s }]); mock('Read Claim (Cycle)', [{ json: {} }]);
    const A = (await CY_RUN('Cycle Record Row', [{ json: {} }]))[0].json;
    mock('Read Claim (Cycle)', [{ json: { id: 3, ...A } }]);
    const B = (await CY_RUN('Cycle Record Row', [{ json: {} }]))[0].json;
    check('CY29: sweep A writes its claim; sweep B, planned from the same snapshot (no row), reads A\'s row before its own claim and backs off with the reason - so B can never overwrite A\'s claim after A read it back',
      A.status === 'starting' && /^dsp:/.test(A.run_id) && B.skip === true && /another dispatcher sweep recorded this job after this sweep planned/.test(B.reason), JSON.stringify([A, B]));
    const ex = { status: 'failed', run_id: 'dsp:1:a:b', updated_at: '2026-10-21T14:00:00.000Z' };
    check('CY29: CYC.claimFree - the row the plan wrote is free; one another sweep changed (claim, status or write time) is not; an unreadable row is not',
      CYC.claimFree(ex, [{ key: 'k', ...ex }]).ok && !CYC.claimFree(ex, [{ key: 'k', ...ex, run_id: 'dsp:2:c:d', status: 'starting' }]).ok && !CYC.claimFree(ex, [{ key: 'k', ...ex, updated_at: '2026-10-21T14:00:01.000Z' }]).ok
      && !CYC.claimFree(ex, [{}]).ok && !CYC.claimFree(null, [{ key: 'k', status: 'starting' }]).ok && CYC.claimFree(null, [{}]).ok && !CYC.claimFree(null, [{ error: { message: 'x' } }]).ok, '');
    const t1 = CYC.claimToken('77', '2026-10-21T14:00:00.000Z', 'r1'), t2 = CYC.claimToken('77', '2026-10-21T14:00:00.000Z', 'r2');
    check('CY29: two claims of one execution at one moment differ (the random part), and the payload starts only on its own exact token', t1 !== t2 && /^dsp:77:/.test(t1), JSON.stringify([t1, t2]));
    // the whole race through the nodes: both sweeps' payloads - only one starts
    mock('Cycle Record Row', [{ json: A }]); mock('Save Cycle Record', [{ json: { id: 3, ...A } }]); mock('Cycle Plan', [{ json: { ...P3, now: new Date().toISOString() } }]);
    const mine = (await CY_RUN('Cycle Payload', [{ json: { id: 3, ...A } }]))[0].json;
    check('CY29: A reads its own token back and starts the job; B never reached its save', mine.trigger === 'cycle' && !mine.skip, JSON.stringify(mine));
  });

  await guard('CY30 the app\'s weekday survives a sweep', async () => {
    const SN = 'CY30 an existing seo_cycles row is updated with the fields the sweep changed only: an app PATCH of the weekday made mid-sweep is never put back'; reset(); begin(SN); const check = mkCheck(SN);
    const w = world({ sites: [SITE('site_a-com', 'a.com')], monitors: [ALL_OFF('site_a-com')], cycles: [kick('site_a-com', 'a.com', 'America/New_York', '2026-10-21T14:00:00.000Z')] });
    const p = planW(w, '2026-10-21T14:01:00.000Z');
    const full = p.cycle_rows[0];
    check('CY30: the plan names what it changed (current_key, last_cycle_at, last_monthly_key, the due times) and not the weekday', full && full.created === false && full.changed.includes('current_key') && !full.changed.includes('cycle_weekday') && full.cycle_weekday === 3, JSON.stringify(full));
    // the owner moves the week to Friday while the sweep runs (PATCH .../cycle {weekday: 5})
    w.cycles[0].cycle_weekday = 5;
    mock('Cycle Plan', [{ json: p }]);
    const U = (await CY_RUN('Cycle State Updates', [{ json: {} }])).map(i => i.json), N = (await CY_RUN('Cycle State Rows', [{ json: {} }])).map(i => i.json);
    for (const r of U) upsert(w.cycles, 'site_id', r);   // Update Cycle Rows: the item's fields, by site_id
    check('CY30: the generated nodes write no whole row and an update without cycle_weekday: the owner\'s Friday is kept (the old Save Cycle Rows wrote the snapshot\'s Wednesday back)',
      N[0].skip === true && U.length === 1 && !('cycle_weekday' in U[0]) && w.cycles[0].cycle_weekday === 5 && w.cycles[0].current_key === 'cyc:site_a-com:2026-10-21', JSON.stringify({ U, row: w.cycles[0] }));
    const p2 = planW(w, '2026-10-21T14:06:00.000Z');
    check('CY30: the next sweep reads the Friday and moves the next due time to it (at least 3 days after the last cycle)', CYC.weekdayOf(CYC.local('America/New_York', T(p2.sites[0].next_due_at)).date) === 5, JSON.stringify(p2.sites[0].next_due_at));
    const wa = world({ sites: [SITE('site_z-com', 'z.com')], monitors: [ALL_OFF('site_z-com')], cycles: [] });
    const pa = planW(wa, '2026-10-21T14:01:00.000Z');
    mock('Cycle Plan', [{ json: pa }]);
    const NA = (await CY_RUN('Cycle State Rows', [{ json: {} }])).map(i => i.json), UA = (await CY_RUN('Cycle State Updates', [{ json: {} }])).map(i => i.json);
    check('CY30: a website adopted this sweep (no row yet) is written whole, with exactly the table\'s columns', NA.length === 1 && JSON.stringify(Object.keys(NA[0])) === JSON.stringify(WIRE.cycles_cols) && UA[0].skip === true, JSON.stringify(NA));
  });

  await guard('CY31 the dispatcher is published and watched', async () => {
    const SN = 'CY31 every deploy publishes the dispatcher (plan_only until cycle:mode), and the catch-up\'s watchdog alerts when it is inactive or stopped sweeping, at most every 6 h'; reset(); begin(SN); const check = mkCheck(SN);
    check('CY31 (build section 140): the dispatcher is in deploy_manifest.json publish, and it plans only until seo_cache cycle:mode says start', WIRE.dispatcher_published === true, JSON.stringify(WIRE.dispatcher_published));
    let CU2 = null; try { CU2 = kits('Catchup__Dispatcher_Watchdog.js', ['CU']).CU; } catch (e) { CU2 = null; }
    check('CY31: the catch-up carries the dispatcher watchdog (generated Dispatcher Watchdog node, CU.cycleWatchdog)', !!(CU2 && CU2.cycleWatchdog), '');
    if (!CU2 || !CU2.cycleWatchdog) return;
    const now = '2026-10-21T14:00:00.000Z', on = { ok: true, active: true, updatedAt: '2026-10-20T10:00:00.000Z' };
    const wd = (o) => CU2.cycleWatchdog({ now, entry: 'sweep', wf: on, last: { updated_at: '2026-10-21T13:57:00.000Z' }, state: {}, ...o });
    const ok = wd({}), off = wd({ wf: { ...on, active: false } }), stale = wd({ last: { updated_at: '2026-10-21T13:30:00.000Z' } });
    const again = wd({ last: { updated_at: '2026-10-21T13:30:00.000Z' }, state: stale.state, now: '2026-10-21T15:00:00.000Z' }), later = wd({ last: { updated_at: '2026-10-21T13:30:00.000Z' }, state: stale.state, now: '2026-10-21T20:01:00.000Z' });
    const init = wd({ entry: 'init', wf: { ...on, active: false } }), test = wd({ test: true, wf: { ...on, active: false } }), never = wd({ last: null, wf: { ...on, updatedAt: '2026-10-21T13:00:00.000Z' } }), fresh = wd({ last: null, wf: { ...on, updatedAt: '2026-10-21T13:50:00.000Z' } });
    check('CY31: active and swept 3 min ago: fine; inactive: alarm; last sweep 30 min ago: alarm; no sweep record 60 min after its last update: alarm; just published 10 min ago: wait',
      !ok.alarm && ok.verdict === 'sweeping' && off.alarm && /not active/.test(off.reason) && stale.alarm && /30 min ago/.test(stale.reason) && never.alarm && !fresh.alarm, JSON.stringify([ok, off, stale, never, fresh].map(x => [x.verdict, x.alarm])));
    check('CY31: rate-limited - one alarm, quiet an hour later, again after 6 h; never on the door n8n just started through, never in a test', !again.alarm && later.alarm && !init.alarm && !test.alarm, JSON.stringify([again.reason, later.alarm, init.verdict, test.verdict]));
    // the generated nodes: the watchdog reads the workflow and cycle:last; Watchdog Alarm fails the run with the reason
    mock('Catch-up Entry', [{ json: { entry: 'sweep', now: new Date().toISOString(), plan_only: false, dry_run: false } }]);
    mock('Read Dispatcher Workflow (Watchdog)', [{ json: { statusCode: 200, body: { id: 'SEOagentCycleDsp', active: false, updatedAt: '2026-10-19T10:00:00.000Z' } } }]);
    mock('Load Cycle Last (Watchdog)', [{ json: { key: 'cycle:last', updated_at: new Date(Date.now() - 2 * H1).toISOString() } }]); mock('Load Catch-up Records', [{ json: {} }]);
    const D = (await run('Dispatcher Watchdog', [{ json: {} }], { code: 'Catchup__Dispatcher_Watchdog' }))[0].json;
    mock('Dispatcher Watchdog', [{ json: D }]); mock('Watchdog Result', [{ json: { value: '{}' } }]);
    let al = null; try { await run('Watchdog Alarm', [{ json: {} }], { code: 'Catchup__Watchdog_Alarm', expectError: true }); } catch (e) {}
    al = H.results[H.results.length - 1]; const threw = !al.ok && /Cycle Dispatcher .* is not starting any website's cycle/.test(al.error); al.ok = threw; al.error = threw ? 'threw as expected: ' + al.error.slice(0, 90) : 'did not throw the dispatcher alarm: ' + al.error;
    check('CY31: the generated Dispatcher Watchdog sees an inactive dispatcher with a 2-hour-old sweep, saves its state, and Watchdog Alarm fails the run (the ops alert)', D.alarm === true && D.save === true && D.state_row && D.state_row.key === 'catchup:watchdog:SEOagentCycleDsp' && threw, JSON.stringify(D).slice(0, 300));
  });

  await guard('CY32 the release step asks the cycle rule', async () => {
    const SN = 'CY32 the image\'s release step (n8n/deploy/release.mjs) asks CYC.deployWindow read out of the generated dispatcher: a start refuses, a running job is reported, unreadable tables refuse, SEO_DEPLOY_FORCE overrides'; reset(); begin(SN); const check = mkCheck(SN);
    let G = null; try { G = await import(require('url').pathToFileURL(path.join(__dirname, 'deploy_guard.mjs')).href); } catch (e) { G = null; }
    check('CY32: deploy_guard.mjs (copied into the harness by build section 140) loads', !!G, 'run build_v4.py first');
    if (!G) return;
    const kit = G.kitFromSource(fs.readFileSync(path.join(CD, 'Cycle__Cycle_Plan.js'), 'utf8')).CYC;
    const tables = (jobs, cycles, o = {}) => async (method, p) => {
      if (o.status) return { status: o.status, body: { message: 'unauthorized' } };
      if (p.startsWith('/data-tables?')) return { status: 200, body: { data: o.none ? [] : [{ id: 't1', name: 'seo_cycle_jobs' }, { id: 't2', name: 'seo_cycles' }], nextCursor: null } };
      const id = p.split('/')[2]; return { status: 200, body: { data: id === 't1' ? jobs : cycles, nextCursor: null } };
    };
    const now = Date.parse('2026-10-21T14:00:00.000Z'), said = [];
    const say = (m) => said.push(m);
    const starting = [{ key: 'cyc:site_a:2026-10-21:backlinks', job: 'backlinks', status: 'starting', updated_at: '2026-10-21T13:59:00.000Z' }];
    const running = [{ key: 'cyc:site_b:2026-10-21:audit', job: 'audit', status: 'running', updated_at: '2026-10-21T13:30:00.000Z' }];
    const r = {
      idle: await G.deployGuard({ api: tables([], []), CYC: kit, now, say }), fresh: await G.deployGuard({ api: tables([], [], { none: true }), CYC: kit, now, say }),
      start: await G.deployGuard({ api: tables(starting, []), CYC: kit, now, say }), run: await G.deployGuard({ api: tables(running, []), CYC: kit, now, say }),
      due: await G.deployGuard({ api: tables([], [{ site_id: 'site_a', domain: 'a.com', status: 'active', next_due_at: '2026-10-21T14:10:00.000Z' }]), CYC: kit, now, say }),
      unread: await G.deployGuard({ api: tables([], [], { status: 401 }), CYC: kit, now, say }), noUrl: await G.deployGuard({ api: null, CYC: kit, now, say }),
      forced: await G.deployGuard({ api: tables(starting, []), CYC: kit, now, say, force: 'SEO_DEPLOY_FORCE_MONDAY' }) };
    check('CY32: idle and a fresh instance release; a job starting or a cycle due in 10 min refuses; a running job releases and is reported with why it is safe',
      r.idle === null && r.fresh === null && /refusing now - 1 dispatcher job\(s\) starting/.test(r.start || '') && r.run === null && said.some(m => /cyc:site_b:2026-10-21:audit.*the dispatcher sees the dead run/.test(m)) && /due by/.test(r.due || ''), JSON.stringify(r));
    check('CY32: tables that cannot be read refuse, naming SEO_DEPLOY_GUARD_URL and the first-release SEO_DEPLOY_FORCE; the old SEO_DEPLOY_FORCE_MONDAY overrides loudly',
      /could not be read \(n8n answered 401/.test(r.unread || '') && /SEO_DEPLOY_GUARD_URL/.test(r.noUrl || '') && /SEO_DEPLOY_FORCE=true/.test(r.unread || '') && r.forced === null && said.some(m => /DEPLOY GUARD OVERRIDDEN \(SEO_DEPLOY_FORCE_MONDAY\)/.test(m)), JSON.stringify(r));
    for (const c of CASES.cases) {
      const a = kit.deployWindow({ jobs: c.jobs, cycles: c.cycles, now: CASES.now, minutes: c.minutes || 15 }), b = CYC.deployWindow({ jobs: c.jobs, cycles: c.cycles, now: CASES.now, minutes: c.minutes || 15 });
      if (JSON.stringify(a) !== JSON.stringify(b)) { check('CY32: the release step\'s rule is the dispatcher\'s on "' + c.name + '"', false, JSON.stringify([a, b])); return; }
    }
    check('CY32: the release step\'s rule (read out of the generated workflow) answers every shared case exactly as the kit does', true, '');
  });
};
