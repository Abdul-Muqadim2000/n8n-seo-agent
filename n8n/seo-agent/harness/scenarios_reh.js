// REH1-REH6 (F-REH, 2026-10-20): the defects the REAL-CREDIT REHEARSAL found on a fresh n8n 2.41.4 (the production image and release step),
// running a new client - techand.ai, Asia/Dubai, services "CRM implementation, Dynamics 365 Business Central, Dynamics 365 Sales, E-invoicing
// compliance" - through the app and the engine. Every check runs the GENERATED code (harness/code_v4) and fails on the code before the fix:
//   REH1 ghost reservations: a restart crashed a `keyword` run (06:50) and its ledger row held a run-guard slot for the 2-hour stale rule. The
//        Cycle Dispatcher now reads EVERY reservation younger than the stale window by id (bounded, oldest first) and releases the ones n8n
//        reports crashed / canceled / error / finished unsettled / gone, with the reason in the row; a running one is never touched.
//   REH2 "Track my site" starts the Site Tracker with its own execution id as parent_run_id, so the Track run is not "another analysis in
//        flight": the rehearsal's "3 other run(s) in flight (keyword 06:50, track 07:05, ladder 07:05)" refusal, replayed node by node.
//   REH3 cycle 0's skip_jobs is a claim the ledger must back: a refused, crashed or missing setup run means the job runs in cycle 0; a done
//        one means it is skipped; one still running is waited for.
//   REH4 research ranks what the client sells first (service_fit: in / unknown / out); an `out` keyword is never the start-with pick.
//   REH5 a declared product category ("crm" in "CRM implementation") is topic evidence; the Keyword Check's topic note is one plain sentence
//        that asks for services only when none are listed.
//   REH6 no em dash or arrow in any why / reason / note the research hands the app (a scan of the generated output).
// Called from scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path'); const { fakeN8nApi } = require('./fake_n8n_api');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const J = (x) => JSON.stringify(x);
  const T = (s) => typeof s === 'number' ? s : Date.parse(s), ISO = (t) => new Date(T(t)).toISOString(), MIN = 60000, H1 = 3600000;
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function(body + '\nreturn { ' + names.join(', ') + ' };')(); };
  const { CYC, RG } = kits('Cycle__Cycle_Plan.js', ['CU', 'RG', 'CYC']);
  const CY = (node, input, opts) => run(node, input, { code: 'Cycle__' + node.replace(/[^A-Za-z0-9_.-]+/g, '_'), ...(opts || {}) });
  const API = 'http://localhost:5678/api/v1', WF_IDS = [...new Set(CYC.JOBS.map(j => j.workflow_id))];
  const DOM = 'techand.ai', SID = 'site_techand-ai', TZ = 'Asia/Dubai';
  const SERVICES = ['CRM implementation', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  // ---- the dispatcher's evidence as the generated workflow gathers it: its reads (CYC.execReads, now with the ledger), answered by the
  // faithful fake of n8n 2.41.4's executions API, assembled by CYC.runsFrom
  const runsVia = (execs, jobs, ledger, now, cfg, apiOpts) => { const R = CYC.execReads({ jobs, ledger, known: WF_IDS, api: API, cfg: cfg || CYC.DEFAULTS, now });
    const api = fakeN8nApi(execs, apiOpts); return { runs: CYC.runsFrom(R.reads, R.reads.map(r => api(r.url)), R.unread), reads: R }; };
  const ALL_OFF = { site_id: SID, ai_visibility: false, backlinks: false, ai_growth: false, link_builder: false, audit_monthly: false };
  const plan = (o) => CYC.plan({ now: ISO(o.now), mode: o.mode || 'start', engine_tz: 'America/New_York', sites: o.sites || [{ site_id: SID, domain: DOM, status: 'active' }],
    cycles: o.cycles, jobs: o.jobs || [], monitors: o.monitors || [{ ...ALL_OFF, ai_visibility: true }], cadence: o.cadence || [], ladders: [], ladder_settings: [], ledger: o.ledger || [],
    runs: o.runs || {}, dry_run: !!o.dry_run, config: { max_open: RG.MAX_OPEN, stale_hours: RG.STALE_HOURS } });
  const cycleRow = (anchor, x) => CYC.newCycleRow({ site_id: SID, domain: DOM, tz: TZ, anchor: T(anchor), now: T(anchor), ...(x || {}) });
  const L = (run_id, mode, created_at, x) => ({ run_id: String(run_id), key: 'app:' + SID, mode, status: 'reserved', created_at: ISO(created_at), domain: DOM, heavy: false, cost_basis: 'reserved: Claude $0.0500 ESTIMATED', ...(x || {}) });
  const X = (id, status, startedAt, wf) => ({ id: String(id), workflowId: wf || 'SEOagentV4Full01', mode: 'webhook', status, startedAt: ISO(startedAt), stoppedAt: status === 'running' ? null : ISO(T(startedAt) + MIN) });

  // ===================================================================================================================================
  await guard('REH1 ghost reservations', async () => {
    const SN = 'REH1 ghost reservations (rehearsal: a restart crashed a keyword run; its reservation held a run-guard slot for 2 h) - the dispatcher reads every reservation by id and releases the dead ones'; reset(); begin(SN); const check = mkCheck(SN);
    const T0 = '2026-10-20T07:10:00.000Z';   // 11:10 in Dubai, five minutes after the client pressed Launch
    const cyc0 = cycleRow('2026-10-20T07:05:00.000Z');
    // the rehearsal's ledger: the crashed keyword run (06:50), the Track run and the ladder run (07:05, still running)
    const ledger = [L(8, 'keyword', '2026-10-20T06:50:00.000Z'), L(9, 'track', '2026-10-20T07:05:00.000Z'), L(10, 'ladder', '2026-10-20T07:05:05.000Z')];
    const execs = [X(8, 'crashed', '2026-10-20T06:49:58.000Z'), X(9, 'running', '2026-10-20T07:04:58.000Z'), X(10, 'running', '2026-10-20T07:05:02.000Z')];
    const R = runsVia(execs, [], ledger, T0);
    check('execReads: every reservation younger than the stale window is read by id (kind ledger), oldest first - the dispatcher had no job of its own in flight',
      eq(R.reads.reads.map(r => [r.kind, r.run_id]), [['ledger', '8'], ['ledger', '9'], ['ledger', '10']]) && R.reads.reads.every(r => /\/executions\/\d+$/.test(r.url)) && !R.reads.unread.length, J(R.reads));
    const p = plan({ now: T0, cycles: [cyc0], ledger, runs: R.runs });
    const g = p.ghosts || [];
    check('the plan releases the crashed keyword run (stale, with why) and nothing that is still running',
      p.release.length === 1 && p.release[0].run_id === '8' && p.release[0].ghost === true && /crashed by n8n \(a restart, a deploy or a time-out\)/.test(p.release[0].reason)
      && /not after the 2-hour stale rule/.test(p.release[0].reason) && g.length === 1 && g[0].mode === 'keyword' && g[0].status === 'crashed' && p.release[0].was === 'reserved: Claude $0.0500 ESTIMATED', J({ rel: p.release, g }));
    check('with the ghost released the run guard has room: cycle 0\'s AI visibility starts at once (live runs 2 of 3)', p.live_runs === 2 && p.start.length === 1 && p.start[0].job === 'ai_visibility', J({ live: p.live_runs, s: p.start, j: p.sites[0].jobs }));
    const old = plan({ now: T0, cycles: [cyc0], ledger, runs: {} });   // the evidence the dispatcher had before: no reservation was read by id
    check('the same sweep on the old evidence: no release, 3 runs hold the guard and the job waits for room (it would until 08:50)', !old.release.length && old.live_runs === 3 && !old.start.length
      && /waits for room/.test(((old.sites[0] || {}).jobs || []).find(j => j.job === 'ai_visibility').reason || ''), J({ live: old.live_runs, j: old.sites[0].jobs }));
    // every status n8n can report, one reserved row each
    const one = (st, x) => { const led = [L(70, 'keyword', ISO(T(T0) - 20 * MIN), x)]; const ex = st === 'gone' ? [] : [X(70, st, ISO(T(T0) - 20 * MIN - 2000))];
      const r = runsVia(ex, [], led, T0, null, st === 'fail' ? { fail: 500 } : undefined); return plan({ now: T0, cycles: [cyc0], ledger: led, runs: r.runs }); };
    const rel = (st) => (one(st).ghosts || []).map(x => x.status);
    check('crashed, canceled, error, success (finished unsettled) and gone (404) are released; running, waiting, new, unknown and an unreadable API are not',
      eq(rel('crashed'), ['crashed']) && eq(rel('canceled'), ['canceled']) && eq(rel('error'), ['error']) && eq(rel('success'), ['success']) && eq(rel('gone'), ['gone'])
      && ['running', 'waiting', 'new', 'unknown', 'fail'].every(st => !rel(st).length), J(['crashed', 'canceled', 'error', 'success', 'gone', 'running', 'waiting', 'new', 'unknown', 'fail'].map(s => [s, rel(s)])));
    check('the reasons say what n8n said: "ended with an error", "finished (\\"success\\") without settling", "n8n no longer has"',
      /ended with an error/.test(one('error').release[0].reason) && /without settling its reservation/.test(one('success').release[0].reason) && /n8n no longer has the keyword run of techand\.ai \(execution 70/.test(one('gone').release[0].reason), '');
    const runningElsewhere = { [CYC.LEDGER_RUNS]: { byId: {}, gone: { 71: true }, errors: [] }, SEOagentBacklnk1: { ok: true, data: [{ id: '71', status: 'running', mode: 'integrated', startedAt: T0 }], byId: {}, incomplete: [], errors: [] } };
    check('a 404 by id that a running list still shows is not released (no evidence it is dead)', !plan({ now: T0, cycles: [cyc0], ledger: [L(71, 'backlinks', ISO(T(T0) - 5 * MIN))], runs: runningElsewhere }).release.length, '');
    // what is never read
    const skipped = CYC.execReads({ jobs: [], ledger: [L(80, 'keyword', ISO(T(T0) - 3 * H1)), L(81, 'keyword', ISO(T(T0) - MIN), { status: 'done' }), L('cycle-dispatcher', 'x', ISO(T(T0) - MIN)), L(82, 'keyword', ISO(T(T0) - MIN), { status: 'stale' })],
      known: WF_IDS, api: API, cfg: CYC.DEFAULTS, now: T0 });
    check('never read: a reservation past the stale window (Release Stale Runs has it), a settled or stale row, a run id that is not an execution', !skipped.reads.length && !skipped.unread.length, J(skipped));
    // bounded: 25 dead reservations, 20 a sweep, the rest next sweep
    const many = Array.from({ length: 25 }, (_, i) => L(100 + i, 'keyword', ISO(T(T0) - (60 - i) * MIN)));
    const manyX = many.map(l => X(l.run_id, 'crashed', ISO(T(l.created_at) - 2000)));
    const r1 = runsVia(manyX, [], many, T0), p1 = plan({ now: T0, cycles: [cyc0], ledger: many, runs: r1.runs });
    for (const x of p1.release) for (const l of many) if (l.run_id === x.run_id && l.status === 'reserved') l.status = 'stale';   // Release Dead Runs
    const r2 = runsVia(manyX, [], many, ISO(T(T0) + 5 * MIN)), p2 = plan({ now: ISO(T(T0) + 5 * MIN), cycles: [cyc0], ledger: many, runs: r2.runs });
    check('bounded: at most max_ledger_reads (20) reservations are read a sweep, oldest first; the other 5 are reported unread and released the next sweep',
      CYC.DEFAULTS.max_ledger_reads === 20 && r1.reads.reads.length === 20 && r1.reads.unread.length === 5 && r1.reads.reads[0].run_id === '100' && p1.release.length === 20 && p2.release.length === 5
      && eq(p2.release.map(x => x.run_id), ['120', '121', '122', '123', '124']), J({ reads: r1.reads.reads.length, unread: r1.reads.unread.length, rel1: p1.release.length, rel2: p2.release.map(x => x.run_id) }));
    const po = plan({ now: T0, cycles: [cyc0], ledger, runs: R.runs, mode: 'plan_only' });
    check('plan_only: the ghost is found and reported (would.ghosts), nothing is released', !po.release.length && !po.ghosts.length && po.would.ghosts.length === 1 && po.would.release.some(x => x.run_id === '8') && /dead reservation\(s\) of other runs found \(not released: plan_only\)/.test(po.basis), J({ w: po.would.ghosts, b: po.basis }));
    // through the generated nodes: Cycle Exec Requests -> Read Executions -> Cycle Plan -> Cycle Release Rows (-> Release Dead Runs)
    reset();
    const now = new Date().toISOString(), ledgerN = [L(8, 'keyword', ISO(Date.now() - 20 * MIN)), L(9, 'track', ISO(Date.now() - 5 * MIN))];
    mock('Cycle Entry', [{ json: { entry: 'sweep', now, clock_moved: false, dry_run: false, plan_only: false, note: '' } }]);
    mock('Load Cycle Mode', items([{ key: 'cycle:mode', kind: 'cycle', value: J({ mode: 'start' }), updated_at: now }])); mock('Load Cycle Last', items([]));
    mock('Load Cycles', items([cycleRow(ISO(Date.now() - 6 * MIN))])); mock('Load Cycle Jobs', items([])); mock('Load Sites (Cycle)', items([{ site_id: SID, domain: DOM, status: 'active' }]));
    mock('Load Monitors (Cycle)', items([{ ...ALL_OFF, ai_visibility: true }])); mock('Load Cadence (Cycle)', items([])); mock('Load Ladder Settings (Cycle)', items([])); mock('Load Ladders (Cycle)', items([]));
    mock('Load Run Ledger (Cycle)', items(ledgerN));
    const req = (await CY('Cycle Exec Requests', [{ json: {} }])).map(i => i.json);
    const apiN = fakeN8nApi([X(8, 'crashed', ISO(Date.now() - 20 * MIN - 2000)), X(9, 'running', ISO(Date.now() - 5 * MIN - 2000))]);
    mock('Cycle Exec Requests', req.map(json => ({ json }))); mock('Read Executions (Cycle)', req.map(r => ({ json: apiN(r.url) })));
    const P = (await CY('Cycle Plan', [{ json: {} }]))[0].json;
    const RL = (await CY('Cycle Release Rows', [{ json: {} }])).map(i => i.json);
    check('generated nodes: Cycle Exec Requests asks n8n for both reservations by id; Cycle Plan releases the crashed one only and starts the job',
      req.length === 2 && req.every(r => r.kind === 'ledger') && P.release.length === 1 && P.release[0].run_id === '8' && P.start.length === 1 && P.start[0].job === 'ai_visibility', J({ req, rel: P.release, s: P.start }));
    check('generated nodes: Cycle Release Rows hands Release Dead Runs the run id and a cost_basis that says why, beside what the reservation said',
      RL.length === 1 && RL[0].run_id === '8' && RL[0].ghost === true && /^stale \(released by the cycle dispatcher\): the keyword run of techand\.ai \(execution 8, .*crashed by n8n/.test(RL[0].cost_basis)
      && /\| the reservation said: reserved: Claude \$0\.0500 ESTIMATED$/.test(RL[0].cost_basis) && RL[0].cost_basis.length <= 400, J(RL));
    const WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'cycle_wiring.json'), 'utf8'));
    check('the generated dispatcher is baked with the bound (max_ledger_reads 20)', (WIRE.config || {}).max_ledger_reads === 20, J(WIRE.config));
    mock('Cycle Plan', [{ json: P }]); const rep = JSON.parse((await CY('Cycle Report', [{ json: {} }]))[0].json.value);
    check('the sweep\'s record names the released reservation', (rep.ghosts || []).length === 1 && rep.ghosts[0].run_id === '8' && rep.ghosts[0].mode === 'keyword' && rep.ghosts[0].released === true, J(rep.ghosts));
  });

  // ===================================================================================================================================
  await guard('REH2 Track names itself the Site Tracker\'s parent', async () => {
    const SN = 'REH2 "Track my site" starts the Site Tracker with its own execution id as parent_run_id (rehearsal: "3 other run(s) in flight (keyword 06:50, track 07:05, ladder 07:05)" refused it)'; reset(); begin(SN); const check = mkCheck(SN);
    mock('Site Row (Track)', [{ json: { site_id: SID, domain: DOM, request_id: 'app-track-1' } }]); mock('Save Site (Track)', [{ json: { id: 11, site_id: SID } }]);
    const tp = (await run('Tracker Payload (Track)', [{ json: {} }], { execId: '9' }))[0].json;
    check('Tracker Payload (Track) carries this run\'s own execution id as parent_run_id (as Monitor Start does for the monitors, R77)', tp.parent_run_id === '9' && tp.on_demand === true && tp.site_id === SID, J(tp));
    const plan0 = [{ json: { site_id: SID, domain: DOM, on_demand: true, request_id: 'app-track-1' } }];
    const ledgerRow = async (trig) => { reset(); mock('Site Plan', plan0); mock('Manual Run', [{ json: trig }]); return (await run('Run Ledger Row (Site)', [{ json: {} }], { code: 'Run_Ledger_Row_Site_', execId: '11' }))[0].json; };
    const row = await ledgerRow(tp), rowOld = await ledgerRow({ ...tp, parent_run_id: undefined });
    check('the Site Tracker\'s ledger row names its parent (key parent:9); without it (the old payload) it was schedule:site_tracker', row.key === 'parent:9' && row.mode === 'site_tracker' && row.domain === DOM && rowOld.key === 'schedule:site_tracker', J([row.key, rowOld.key]));
    const OPEN = [{ id: 1, ...L(8, 'keyword', '2026-10-20T06:50:00.000Z') }, { id: 2, ...L(9, 'track', '2026-10-20T07:05:00.000Z') }, { id: 3, ...L(10, 'ladder', '2026-10-20T07:05:05.000Z') }];
    const gate = async (trig, key) => { reset(); mock('Site Plan', plan0); mock('Load Open Runs (Site)', items(OPEN)); mock('Load Catch-up Records (Site)', [{ json: {} }]);
      const mine = { id: 4, run_id: '11', mode: 'site_tracker', status: 'reserved', key, domain: DOM, created_at: '2026-10-20T07:05:20.000Z' };
      mock('Reserve Run Ledger (Site)', [{ json: mine }]); mock('Run Ledger Row (Site)', [{ json: mine }]); mock('Manual Run', [{ json: trig }]);
      return (await run('After Run Ledger (Site)', [{ json: {} }], { code: 'After_Run_Ledger_Site_', execId: '11' })).map(i => i.json); };
    const now = Date.now; Date.now = () => T('2026-10-20T07:05:30.000Z');
    let ok, refused;
    try { ok = await gate(tp, 'parent:9'); refused = await gate({ ...tp, parent_run_id: undefined }, 'schedule:site_tracker'); } finally { Date.now = now; }
    check('the rehearsal replayed in the Site Tracker\'s own gate: with its parent named, Track is not counted - 2 others in flight, the run goes ahead',
      ok.length === 1 && !ok[0].run_refused && ok[0].domain === DOM, J(ok));
    check('... and without it (the old payload) the same rows refuse it exactly as the rehearsal did: too_many_open, "3 other run(s) in flight (keyword 06:50, track 07:05, ladder 07:05)"',
      refused.length === 1 && refused[0].run_refused === true && refused[0].reason === 'too_many_open' && /3 other run\(s\) in flight \(keyword 06:50, track 07:05, ladder 07:05\)/.test(refused[0].basis), J(refused));
  });

  // ===================================================================================================================================
  await guard('REH3 cycle 0 skips only what the ledger shows done', async () => {
    const SN = 'REH3 cycle 0\'s skip_jobs is a claim the ledger must back (rehearsal: the setup Site Tracker run was refused, and cycle 0 skipped the Site Tracker anyway - no site report for 7 days)'; reset(); begin(SN); const check = mkCheck(SN);
    const A0 = '2026-10-20T07:05:00.000Z', NOW = '2026-10-20T07:40:00.000Z';
    const cyc0 = { ...cycleRow(A0, { skip_jobs: ['site_tracker'] }), current_key: 'cyc:' + SID + ':2026-10-20', last_cycle_at: '2026-10-20T07:06:00.000Z', next_due_at: '2026-10-27T02:00:00.000Z', last_monthly_key: '2026-10' };
    const marker = CYC.jobRow({ key: cyc0.current_key + ':cycle', site_id: SID, cycle_key: cyc0.current_key, job: 'cycle', status: 'running', monthly: true, due_at: A0, started_at: '2026-10-20T07:06:00.000Z', updated_at: '2026-10-20T07:06:00.000Z' });
    const ST = (status, x) => ({ ...L(11, 'site_tracker', '2026-10-20T07:05:20.000Z', { key: 'parent:9', status, ...(status === 'done' ? { settled_at: '2026-10-20T07:08:00.000Z' } : {}),
      ...(status === 'refused' ? { cost_basis: 'refused before any spending (too_many_open): There are already 3 analyses running (the limit is 3). Nothing was charged and nothing was started: this scheduled run is skipped and the next one goes ahead as usual. [3 other run(s) in flight (keyword 06:50, track 07:05, ladder 07:05)]' } : {}) }), ...(x || {}) });
    const go = (ledger, runs, now) => plan({ now: now || NOW, cycles: [cyc0], jobs: [marker], monitors: [ALL_OFF], ledger, runs });
    const st = (p) => (p.sites[0].jobs || []).find(j => j.job === 'site_tracker') || {};
    const refused = go([ST('refused')]);
    check('the rehearsal: the setup Site Tracker run was refused (too_many_open) - cycle 0 runs the Site Tracker in its normal order, and says why the skip was not honoured',
      refused.start.length === 1 && refused.start[0].job === 'site_tracker' && eq((refused.sites[0].skip_checks || []).map(x => [x.job, x.honoured]), [['site_tracker', false]])
      && /its run \(execution 11\) ended "refused", not done, so it runs in cycle 0 \(too_many_open\)/.test(refused.sites[0].skip_checks[0].why), J({ s: refused.start, sc: refused.sites[0].skip_checks }));
    const done = go([ST('done')]);
    check('a setup run that settled: the Site Tracker is skipped in cycle 0, the reason names the execution', !done.start.length && st(done).verdict === 'skipped' && /already run when tracking was set up \(execution 11, finished 2026-10-20T07:08:00\.000Z\)/.test(st(done).reason)
      && done.sites[0].skip_checks[0].honoured === true, J({ st: st(done), sc: done.sites[0].skip_checks }));
    const none = go([]);
    check('no setup run on the ledger at all: it runs', none.start.length === 1 && none.start[0].job === 'site_tracker' && /no run of it for techand\.ai since tracking started/.test(none.sites[0].skip_checks[0].why), J(none.sites[0].skip_checks));
    const running = go([ST('reserved')], runsVia([X(11, 'running', '2026-10-20T07:05:15.000Z', 'SEOagentSiteTrk1')], [], [ST('reserved')], NOW).runs);
    check('a setup run still going: not skipped yet and not started twice - it waits for its twin', !running.start.length && st(running).verdict === 'wait' && /site tracker run of techand\.ai is in flight \(execution 11\)/.test(st(running).reason), J(st(running)));
    const crashedL = [ST('reserved')], crashed = go(crashedL, runsVia([X(11, 'crashed', '2026-10-20T07:05:15.000Z', 'SEOagentSiteTrk1')], [], crashedL, NOW).runs);
    check('a setup run a restart crashed: its reservation is released and the Site Tracker starts in the same sweep', crashed.release.some(x => x.run_id === '11') && crashed.start.length === 1 && crashed.start[0].job === 'site_tracker', J({ r: crashed.release, s: crashed.start }));
    const other = go([ST('done', { domain: 'example.com' })]), before = go([ST('done', { created_at: '2026-10-19T07:05:20.000Z', settled_at: '2026-10-19T07:08:00.000Z' })]);
    check('evidence is this website\'s and since tracking started: another domain\'s run, or one from before the anchor (beyond the 10-minute grace), does not count',
      other.start.length === 1 && before.start.length === 1 && other.start[0].job === 'site_tracker' && before.start[0].job === 'site_tracker', J([other.start, before.start]));
    const grace = go([ST('done', { created_at: '2026-10-20T07:00:00.000Z', settled_at: '2026-10-20T07:02:00.000Z' })]);
    check('the app\'s and the engine\'s clocks: a run 5 minutes before the anchor still counts (10-minute grace)', !grace.start.length && st(grace).verdict === 'skipped', J(st(grace)));
    const site = CYC.jobsFor({ settings: CYC.settingsOf({ monitors: ALL_OFF }), zero: true, monthly: true }).find(j => j.job === 'site_tracker');
    check('jobsFor no longer switches the Site Tracker off in every cycle 0 (it used to, whatever had happened at setup)', site.on === true && site.why === '', J(site));
    const ev = CYC.skipEvidence({ skip_jobs: ['audit', 'ai_visibility'], domain: DOM, anchor: T(A0), ledger: [L(20, 'audit', '2026-10-20T07:06:00.000Z', { status: 'done' }), L(21, 'ai_visibility', '2026-10-20T07:06:00.000Z', { status: 'refused' })] });
    check('the audit\'s setup run counts under the main workflow\'s mode too (the Audit Scheduler reserves nothing itself); a refused AI visibility does not', eq(ev.honoured, ['audit']) && ev.not.length === 1 && ev.not[0].job === 'ai_visibility', J(ev));
  });

  // ===================================================================================================================================
  // the rehearsal's research, as Rank Keywords received it (Collect Research): the IT-company searches lead on opportunity
  const cand = (keyword, volume, kd, pre) => ({ keyword, volume, kd, cpc: 4.5, intent: 'commercial', words: keyword.split(' ').length, pre_score: pre, traffic_potential: Math.round(volume * 0.3),
    competitors: [], your_position: null, your_url: '', trend_yearly: 5, serp_types: [], gsc: null, sources: ['ranked_keywords'] });
  const CANDS = [cand('software development company in dubai', 1300, 18, 95), cand('it company in dubai', 880, 15, 90), cand('dubai it solutions', 390, 12, 85),
    cand('it companies in abu dhabi', 480, 14, 84), cand('custom software development company in dubai', 320, 16, 80), cand('crm system', 2400, 45, 70),
    cand('dynamics 365 sales', 590, 38, 65), cand('crm service provider uae', 110, 20, 60), cand('e invoicing uae', 720, 30, 58), cand('business central partner uae', 90, 22, 55)];
  const BUSINESS = 'Microsoft Dynamics 365 and CRM implementation partner for UAE companies; e-invoicing compliance and Peppol onboarding';
  const research = async (o) => {
    reset();
    const base = { domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', goal: 'leads', seeds: ['crm implementation'], services: o.declared || [], declared_services: o.declared || [],
      business: o.business || BUSINESS, competitors: [], site_urls: [], research: { candidates: CANDS, pool_size: CANDS.length, competitor_domains: [], by_source: {}, failures: [] } };
    mock('Collect Research', [{ json: base }]);
    mock('Relevance Chunks', [{ json: { keywords_chunk: CANDS.map(c => ({ keyword: c.keyword })) } }]);
    mock('Load Site Cache', [{ json: {} }]); delete store['Site Model']; delete store['Reach (Discovery)'];
    mock('Load Domain Ladders (Discovery)', [{ json: {} }]); mock('Load Ladder Settings (Discovery)', [{ json: {} }]);
    const KS = (await run('Rank Keywords', [{ json: { output: { items: CANDS.map(c => ({ keyword: c.keyword, relevance: 2, intent: 'commercial', page_type: 'Service Page', topic: c.keyword })) } } }]))[0].json;
    mock('Rank Keywords', [{ json: KS }]);
    const pk = (await run('Priority Keywords', [{ json: {} }])).map(i => i.json); mock('Priority Keywords', pk.map(json => ({ json }))); delete store['AI Demand'];
    // the live checks: an AI Overview on every results page (the "quotable answer block" why that carried an em dash)
    const serp = (kw) => ({ json: { status_code: 20000, tasks: [{ status_code: 20000, result: [{ keyword: kw, datetime: '2026-10-20 08:00:00 +00:00', items: [{ type: 'ai_overview' },
      { type: 'organic', rank_group: 1, rank_absolute: 2, domain: 'example-crm.ae', url: 'https://example-crm.ae/' + kw.replace(/\s+/g, '-'), title: kw }] }] }] } });
    const KSR = (await run('Build Keyword Strategy', pk.map(p => serp(p.keyword))))[0].json;
    const cb = (await run('Build Ideas Response', [{ json: KSR, binary: {} }]))[0].json;
    return { KS: KS.keyword_strategy, KSR, cb };
  };

  await guard('REH4 research starts with what the client sells', async () => {
    const SN = 'REH4 research ranks the client\'s own services first (rehearsal: "software development company in dubai", "it company in dubai"... topped the list; "crm system" and "dynamics 365 sales" came later)'; reset(); begin(SN); const check = mkCheck(SN);
    const R = await research({ declared: SERVICES });
    const fit = (k) => (R.KS.keywords.find(x => x.keyword === k) || {}).service_fit;
    console.log('   service fit ->', J(R.KS.keywords.map(k => [k.keyword, k.service_fit])), '| start with ->', R.KS.pipeline_keyword && R.KS.pipeline_keyword.keyword);
    check('every keyword carries service_fit: the IT-company searches are out, the CRM / Dynamics / e-invoicing ones in ("crm service provider uae" by the declared "crm")',
      ['software development company in dubai', 'it company in dubai', 'dubai it solutions', 'it companies in abu dhabi', 'custom software development company in dubai'].every(k => fit(k) === 'out')
      && ['crm system', 'dynamics 365 sales', 'crm service provider uae', 'e invoicing uae', 'business central partner uae'].every(k => fit(k) === 'in')
      && R.KS.service_fit.in === 5 && R.KS.service_fit.out === 5 && eq(R.KS.service_fit.declared_services, SERVICES), J(R.KS.keywords.map(k => [k.keyword, k.service_fit])));
    check('the start-with pick is one of the client\'s services ("crm system"), not the highest-opportunity IT search the old code picked',
      R.KS.pipeline_keyword && R.KS.pipeline_keyword.keyword === 'crm system' && R.KS.pipeline_keyword.service_fit === 'in' && R.cb.start_with.keyword === 'crm system' && R.cb.start_with.service_fit === 'in', J(R.cb.start_with));
    check('the priority list and the callback list the in keywords first, then the out ones, each in opportunity order',
      eq(R.cb.priority.map(k => k.service_fit), ['in', 'in', 'in', 'in', 'in', 'out', 'out', 'out', 'out', 'out']) && R.cb.priority[0].keyword === 'crm system' && R.cb.priority[5].keyword === 'software development company in dubai',
      J(R.cb.priority.map(k => [k.keyword, k.service_fit])));
    const rec = R.KSR.keyword_suggestions.recommended;
    check('keyword_suggestions.recommended: the pick first ("among the services you listed"), the in keywords, then the out ones marked "not one of the services you listed"',
      rec[0].keyword === 'crm system' && /among the services you listed/.test(rec[0].reason) && rec.slice(0, 5).every(k => k.service_fit === 'in') && rec.slice(5).every(k => k.service_fit === 'out' && k.reason === 'not one of the services you listed'),
      J(rec.map(k => [k.keyword, k.service_fit, k.reason])));
    check('the card says why in the customer\'s words: an in keyword\'s why starts "it is part of what you sell"; the content plan carries the topic\'s fit', /^it is part of what you sell; /.test(R.cb.start_with.why) && R.cb.content_plan.every(c => ['in', 'out', 'unknown'].includes(c.service_fit)), R.cb.start_with.why);
    const out = await research({ declared: ['Interior design', 'Office fit-out', 'Joinery', 'Kitchen fit-out', 'Furniture'], business: 'Interior design studio for villas, offices, restaurants and retail stores; joinery workshop and furniture showroom' });
    check('a client whose services none of the keywords match: no start-with pick at all (an out keyword is never the pipeline keyword), the list stays', out.KS.pipeline_keyword === null && out.cb.start_with === null && out.cb.priority.length === 10
      && out.cb.priority.every(k => k.service_fit === 'out'), J({ p: out.KS.pipeline_keyword, f: out.cb.priority.map(k => k.service_fit) }));
    const none = await research({ declared: [] });
    check('no services declared: every keyword is unknown and the research order stands (the pick is the old one)', none.KS.keywords.every(k => k.service_fit === 'unknown') && none.KS.pipeline_keyword.keyword === 'software development company in dubai'
      && none.KS.service_fit.judged_on === 'nothing (no services listed)', J({ p: none.KS.pipeline_keyword && none.KS.pipeline_keyword.keyword, j: none.KS.service_fit }));
    // REH6 rides on the same run
    const BAD = /[—–→⇒]/;
    const found = [];
    const walk = (o, where) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (/html|pdf|file|data$/i.test(k)) continue;
      if (typeof v === 'string' && /^(why|reason|note|detail|label)$|_note$|_reason$/.test(k) && BAD.test(v)) found.push(where + '.' + k + ': ' + v.slice(0, 120)); else if (v && typeof v === 'object') walk(v, where + '.' + k); } };
    for (const [n, r] of [['declared', R], ['out', out], ['none', none]]) { walk(r.KS, n + ':keyword_strategy(rank)'); walk(r.KSR.keyword_strategy, n + ':keyword_strategy'); walk(r.KSR.keyword_suggestions, n + ':keyword_suggestions'); walk(r.cb, n + ':callback'); }
    check('REH6: no em dash, en dash or arrow in any why / reason / note / detail / label of the research output (keyword strategy, suggestions, callback)', !found.length, found.slice(0, 6).join(' | '));
    check('REH6: the AI Overview why that carried " - write a quotable answer block" with an em dash now reads ", so write a quotable answer block"', R.cb.priority.some(k => /\(they vary between searches\), so write a quotable answer block/.test(k.why || '')), J(R.cb.priority.map(k => k.why).slice(0, 2)));
  });

  // ===================================================================================================================================
  await guard('REH5 declared categories and the Keyword Check note', async () => {
    const SN = 'REH5 a declared product category is topic evidence; the Keyword Check\'s topic note is one plain sentence (rehearsal: "not enough information to judge whether this is on topic for you: not enough information to judge whether it is on topic: only 9 topic words on file...")'; reset(); begin(SN); const check = mkCheck(SN);
    const G = new Function(fs.readFileSync(path.join(CD, '_fit_gate.js'), 'utf8').replace(/return \$input\.all\(\)[\s\S]*$/, 'return { fitEvidence, fitTopic, fitGate };'))();
    const ev = (k, svc, topics) => G.fitEvidence(k, topics || SERVICES, { services: svc === undefined ? SERVICES : svc });
    const crm = ev('crm service provider uae');
    check('"crm service provider uae" with "CRM implementation" declared (9 topic words, under the 12 the share rule needs): in, on the declared category', crm.verdict === 'in' && crm.basis === 'declared service' && eq(crm.anchors, ['crm']) && /"crm" is one of the services you listed/.test(crm.detail), J(crm));
    check('... and without the declared services passed (the Content Cadence\'s automatic writing, the app\'s mirror) it stays unknown', ev('crm service provider uae', []).verdict === 'unknown', J(ev('crm service provider uae', [])));
    check('only product categories anchor: "character ai" for an "AI consulting" site, "sales jobs dubai" / "central bank uae" for Dynamics 365 Sales / Business Central are not in',
      ev('character ai', ['AI consulting'], ['AI consulting']).verdict !== 'in' && ev('sales jobs dubai').verdict !== 'in' && ev('central bank uae').verdict !== 'in' && ev('software development company in dubai').verdict !== 'in',
      J([ev('character ai', ['AI consulting'], ['AI consulting']), ev('sales jobs dubai'), ev('central bank uae')].map(x => x.verdict)));
    check('the share rule still decides with the anchor counted: "dynamics 365 sales" and "e invoicing uae" in on the topic words as before', ev('dynamics 365 sales').verdict === 'in' && ev('dynamics 365 sales').basis === 'topics' && ev('e invoicing uae').verdict === 'in', '');
    check('the unknown detail is plain words: no "topic words on file", no duplicated prefix, no em dash', ['office coffee machines', 'it company in dubai'].every(k => { const d = ev(k).detail; return ev(k).verdict === 'unknown' && !/topic word|not enough information to judge/i.test(d) && !/[—→]/.test(d); }), J(ev('office coffee machines')));
    // the Keyword Check itself (Assess Response), with the rehearsal's four services on the site row
    const AR = (o) => ({ ok: true, keyword: 'crm service provider uae', domain: DOM, site_id: SID, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', volume: 110, kd: 20, cpc: 6.5, intent: 'commercial', known: true, position: null, position_url: null,
      reach_info: { reach: 25, method: 'size', p75: null, size_reach: 25, sample: 2, top10: 40, organic_keywords: 300, cached: true, cached_at: '2026-10-19T00:00:00.000Z' }, reach_errors: [], cache_row: null, dfs_cost: 0.0202, business: '', services: [], existing_keywords: [], business_source: 'request', ...o });
    const ask = async (ar, declared) => { reset(); mock('Assess Result', [{ json: ar }]);
      mock('Load Site (Assess)', [{ json: { site_id: SID, domain: DOM, services_json: '[]', declared_services: J(declared) } }]); mock('Load Monitors (Assess)', [{ json: {} }]);
      for (const n of ['Load Assess Cache', 'Load Ladders (Assess)', 'Load Content Log (Assess)', 'Load Pages (Assess)', 'Load Ladder Settings (Assess)']) mock(n, [{ json: {} }]);
      return (await run('Assess Response', [{ json: { output: { fit: 2, navigational: false, alternatives: '' } } }]))[0].json.body; };
    const b1 = await ask(AR({}), SERVICES);
    check('Keyword Check: "crm service provider uae" with the four declared services is judged on topic - no warning, and it says why', b1.fit_gate.ok === true && b1.fit_gate.topic_judged === true && !b1.warnings.some(w => /could not tell/.test(w))
      && /"crm" is one of the services you listed/.test(b1.fit_gate.topic_basis || ''), J({ g: b1.fit_gate, w: b1.warnings }));
    const b2 = await ask(AR({ keyword: 'office coffee machines dubai' }), SERVICES);
    const w2 = b2.warnings.find(w => /could not tell/.test(w)) || '';
    console.log('   topic note (services listed) ->', w2);
    check('Keyword Check, services listed but the keyword is not one of them: one sentence that names the services and does NOT ask to add what you sell; no internal terms, nothing twice, no em dash',
      /^we could not tell whether this keyword matches what you sell: it does not clearly match the services you listed \(CRM implementation, Dynamics 365 Business Central, Dynamics 365 Sales, E-invoicing compliance\)\. If you offer it, add it to your services and check it again$/.test(w2)
      && !/topic word|on file|not enough information|Add what you sell|website settings/i.test(w2) && (w2.match(/could not tell/g) || []).length === 1 && !/[—→]/.test(w2) && b2.fit_gate.topic_note === w2, J({ w: b2.warnings, g: b2.fit_gate }));
    const b3 = await ask(AR({ keyword: 'office coffee machines dubai' }), []);
    const w3 = b3.warnings.find(w => /could not tell/.test(w)) || '';
    check('Keyword Check, no services listed at all: then, and only then, it asks for them', /^we could not tell whether this keyword matches what you sell, because no services are listed for this website yet\. Add your main services in your website settings and the check will tell you$/.test(w3), J(b3.warnings));
  });
};
