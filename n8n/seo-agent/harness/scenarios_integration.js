// INT1-INT8 (2026-10-19, agent E4 "Engine integration"; n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md §4, §5, §14): the CONTRACT TEST across
// the agents. E1 built the cycle kit and the dispatcher, E2 the cycle run in every weekly workflow, E3 the keyword-first cadence; each proved
// its own side. This file runs a whole new client's life through the GENERATED nodes of all of them, feeding each node's real output into the
// next one - the dispatcher's own Cycle Payload into each workflow's Manual Run, that workflow's own ledger row back into the dispatcher's
// next sweep - so a field one side writes and the other does not read (or reads under another name) fails here by name:
//   INT1 "Track my site" creates the website's cycle (the seo_sites row, then seo_cycles: anchor, Asia/Dubai, skip_jobs) and every way it
//        must not: an anchor outside the window, a bad zone, a re-save, a paused site, a failed save, an unreadable table; the kickoff builds
//        the same row with the same builder and refuses a second start;
//   INT2 the life: the ladder the client chose, cycle 0 swept by the dispatcher job by job in CYCLE_JOBS order, each payload into its
//        workflow's Manual Run (on_demand false, the cycle carried), its ledger key cycle:<cycle_key>:<job> with the domain, the run guard,
//        the real settle, the callback's cycle fields - through the content cadence (level 2, one client-chosen Auto ladder, R-K7) and the
//        link builder; cycle 0 is monthly; the "Coming up" preview 48 h before cycle 1 (nothing written, one cycle_preview); a skip of the
//        previewed page; cycle 1 at 06:00 Dubai 7 days on, not monthly, writing the NEXT ladder page; a crash of one job retried, the cycle
//        carrying on;
//   INT3 the AI Pulse skips the website on its cycle weekday only;
//   INT4 a domain with ladders and no seo_sites row: a rank-tracking-only cycle (only the rank check, ever), then "Track my site" turns it
//        into the normal cycle, same anchor;
//   INT5 Ladder Pool protects the services the client declared (seo_sites.declared_services), not only the request's;
//   INT6 Growth Metrics counts set_aside questions beside queued / written;
//   INT7 an approval is the client's choice: written while the site waits for its first keyword, never past a skip, the budget or the pile-up.
// Called from scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path'); const { fakeN8nApi } = require('./fake_n8n_api');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'cycle_wiring.json'), 'utf8'));
  const TC = require('./table_cols.json');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const J = (x) => JSON.stringify(x);
  const RealDate = Date;
  const T = (s) => typeof s === 'number' ? s : RealDate.parse(s), ISO = (t) => new RealDate(T(t)).toISOString(), MIN = 60000, H1 = 3600000, D1 = 86400000;
  // a frozen clock for everything a node does inside `fn` (new Date(), Date.now()); every other use of Date is the real one
  const at = async (t, fn) => { const ms = T(t);
    class FrozenDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }
    global.Date = FrozenDate; try { return await fn(); } finally { global.Date = RealDate; } };
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function(body + '\nreturn { ' + names.join(', ') + ' };')(); };
  const { CYC } = kits('Cycle__Cycle_Plan.js', ['CU', 'RG', 'CYC']);
  const CY = (node, input, opts) => run(node, input, { code: 'Cycle__' + node.replace(/[^A-Za-z0-9_.-]+/g, '_'), ...(opts || {}) });
  const upsert = (arr, key, row) => { const i = arr.findIndex(r => r[key] === row[key]); if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.push({ ...row }); return arr; };
  let EXEC = 7000;   // n8n's execution ids, one per workflow run of this life
  const nextExec = () => String(++EXEC);
  const F = require('./fixtures'); const V = require('./fixtures_v5');
  const DOM = 'northwind-erp.com', SID = 'site_northwind-erp-com', TZ = 'Asia/Dubai', HOOK = 'https://app.example.test/api/hooks/n8n/tok_northwind';
  const T0 = '2026-10-21T08:00:00.000Z';   // Wednesday 21 Oct 2026, 12:00 in Dubai: the owner presses Launch
  const ENGINE_TZ = WIRE.tz || 'America/New_York';

  // ---- "Track my site" through the generated main-workflow nodes: Normalize Input -> Site Row -> (save) -> Cadence Row / Monitor Row ->
  // Track Cycle Plan -> Track Cycle Row -> (save) -> Tracker Payload -> Build Track Response. A Data Table save returns the saved row.
  const track = async (now, body, o = {}) => at(now, async () => {
    reset();
    const ni = (await run('Normalize Input', { body }))[0].json; mock('Normalize Input', [{ json: ni }]);
    mock('Load Site (Track)', items(o.prior_site ? [o.prior_site] : []));
    const site = (await run('Site Row (Track)', [{ json: { id: 3, name: 'seo_sites' } }]))[0].json;
    mock('Save Site (Track)', [{ json: o.site_save_error ? { error: { message: o.site_save_error } } : { id: 11, ...site } }]);
    const cad = (await run('Cadence Row (Track)', [{ json: {} }]))[0].json;
    mock('Load Monitors (Track)', items([]));
    const mon = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    mock('Load Cycle (Track)', o.cycle_load_error ? [{ json: { error: { message: o.cycle_load_error } } }] : items(o.prior_cycle ? [o.prior_cycle] : []));
    const plan = (await run('Track Cycle Plan', [{ json: { id: 12 } }]))[0].json;
    let row = null;
    if (plan.write === true) { row = (await run('Track Cycle Row', [{ json: plan }]))[0].json; mock('Save Cycle (Track)', [{ json: o.cycle_save_error ? { error: { message: o.cycle_save_error } } : { id: 13, ...row } }]); }
    const tp = (await run('Tracker Payload (Track)', [{ json: {} }], { execId: o.execId || 'test-exec' }))[0].json;   // F-REH: Track's own execution id is the Site Tracker's parent
    const resp = (await run('Build Track Response', [{ json: tp }]))[0].json;
    return { ni, site, cad, mon, plan, row, tp, resp };
  });
  const TRACK_BODY = (x) => ({ mode: 'track', domain: 'https://www.northwind-erp.com/', country: 'United Arab Emirates', callback_url: HOOK, request_id: 'app-track-1', keywords: ['e invoicing in uae'],
    blogs_per_week: 1, services: ['E-invoicing implementation', 'ERP implementation', 'Peppol onboarding'], timezone: TZ, tracking_started_at: ISO(T(T0) - 30000), ...(x || {}) });

  // =====================================================================================================================================
  await guard('INT1 Track my site creates the cycle', async () => {
    reset(); const SN = 'INT1 integration — "Track my site" writes the seo_sites row, then the website\'s seo_cycles row with the cycle kit\'s one builder (anchor = tracking_started_at, Asia/Dubai, cycle 0 due now, skip_jobs site_tracker); a re-save keeps the week; the kickoff cannot drift and refuses a second start';
    begin(SN); const check = mkCheck(SN);
    const A = await track(T0, TRACK_BODY());
    check('(a) Normalize Input takes tracking_started_at and timezone by their exact keys (the fuzzy key matcher cannot take them for another field)',
      A.ni.mode === 'track' && A.ni.tracking_started_at === ISO(T(T0) - 30000) && A.ni.timezone === TZ && A.ni.domain === DOM, J({ m: A.ni.mode, t: A.ni.tracking_started_at, tz: A.ni.timezone, d: A.ni.domain }));
    check('(a) the seo_sites row comes first: the site id every engine derives, active, the declared services, only seo_sites columns', A.site.site_id === SID && A.site.status === 'active' && JSON.parse(A.site.declared_services).length === 3
      && Object.keys(A.site).every(k => TC.SITES.includes(k)), J(A.site));
    const R = A.row || {};
    check('(a) a new cycle row, exactly the seo_cycles columns', A.plan.write === true && A.plan.created === true && eq(Object.keys(R), WIRE.cycles_cols), J(Object.keys(R)));
    check('(a) anchored at the request\'s tracking start, in Asia/Dubai, cycle 0 due at the anchor, skip_jobs site_tracker (Track ran it), active, not adopted',
      R.anchor_at === ISO(T(T0) - 30000) && R.tz === TZ && R.next_due_at === R.anchor_at && R.skip_jobs === 'site_tracker' && R.status === 'active' && R.adopted === false && R.current_key === '' && R.last_cycle_at === '', J(R));
    check('(a) its week: a Wednesday website (cycle_weekday 3 in Dubai), local time 06:00, monthly day 21', R.cycle_weekday === 3 && R.local_time === '06:00' && R.monthly_day === 21, J(R));
    check('(a) the setup answer carries the cycle: created, written, the cycle 0 key in the website\'s date, the next due time',
      A.resp.stage === 'site_tracker_setup' && A.resp.cycle && A.resp.cycle.created === true && A.resp.cycle.written === true && A.resp.cycle.cycle_key === 'cyc:' + SID + ':2026-10-21' && A.resp.cycle.tz === TZ && A.resp.cycle.next_due_at === R.anchor_at, J(A.resp.cycle));
    check('(a) the Site Tracker still starts at once for this site, on demand (Track\'s own report), after the cycle row', A.tp.site_id === SID && A.tp.on_demand === true && A.tp.stored === true, J(A.tp));
    // ---- the anchor window: the kickoff's own rule, and Track falls back to now with the reason ----
    const old = await track(T0, TRACK_BODY({ tracking_started_at: ISO(T(T0) - 10 * D1) }));
    const ahead = await track(T0, TRACK_BODY({ tracking_started_at: ISO(T(T0) + 2 * H1) }));
    const near = await track(T0, TRACK_BODY({ tracking_started_at: ISO(T(T0) + 50 * MIN) }));
    const junk = await track(T0, TRACK_BODY({ tracking_started_at: 'next tuesday' }));
    const none = await track(T0, TRACK_BODY({ tracking_started_at: undefined }));
    check('a tracking start 10 days old, 2 h ahead or no date at all is not the anchor: the cycle is anchored now, and the reason says why',
      old.row.anchor_at === T0 && /10 days old/.test(old.plan.anchor_basis) && ahead.row.anchor_at === T0 && /in the future/.test(ahead.plan.anchor_basis) && junk.ni.tracking_started_at === '' && junk.row.anchor_at === T0 && none.row.anchor_at === T0 && /no tracking start/.test(none.plan.anchor_basis),
      J([old.plan.anchor_basis, ahead.plan.anchor_basis, junk.plan.anchor_basis]));
    check('a tracking start 50 minutes ahead is inside the window (at most 1 h): cycle 0 is due then, not now', near.row.anchor_at === ISO(T(T0) + 50 * MIN) && near.row.next_due_at === near.row.anchor_at, J(near.row));
    check('the window is ONE rule: the kickoff\'s anchor window is the kit\'s (6 days back, 1 h ahead)', eq(CYC.ANCHOR, { past_days: 6, ahead_hours: 1 }) && CYC.anchorOf(ISO(T(T0) - 5 * D1), T(T0)).ok && !CYC.anchorOf(ISO(T(T0) - 7 * D1), T(T0)).ok, J(CYC.ANCHOR));
    const badTz = await track(T0, TRACK_BODY({ timezone: 'Mars/Olympus_Mons' })), noTz = await track(T0, TRACK_BODY({ timezone: undefined }));
    check('an unknown zone (Normalize Input empties it) or none: the engine\'s zone (' + ENGINE_TZ + '), said so', badTz.row.tz === ENGINE_TZ && noTz.row.tz === ENGINE_TZ && /no time zone was sent/.test(noTz.plan.tz_basis), J([badTz.row.tz, noTz.plan.tz_basis]));
    // ---- a re-save: the week never moves, a paused website stays paused ----
    const later = ISO(T(T0) + 3 * D1);
    const stored = { ...R, current_key: 'cyc:' + SID + ':2026-10-21', last_cycle_at: ISO(T(T0) + 3 * MIN), next_due_at: '2026-10-28T02:00:00.000Z', last_monthly_key: '2026-10' };
    const re = await track(later, TRACK_BODY({ tracking_started_at: later, timezone: 'Europe/London' }), { prior_site: { ...A.site }, prior_cycle: stored });
    check('a re-save three days later writes NO cycle row: anchor, weekday, due times and the cycle in progress are kept (the zone too: it was the owner\'s)',
      re.plan.write === false && re.row === null && re.plan.anchor_at === R.anchor_at && re.plan.tz === TZ && re.plan.next_due_at === '2026-10-28T02:00:00.000Z' && re.resp.cycle.created === false && re.resp.cycle.written === false, J(re.plan));
    const pausedRow = { ...stored, status: 'paused' };
    const reP = await track(later, TRACK_BODY(), { prior_site: { ...A.site, status: 'paused' }, prior_cycle: pausedRow });
    check('a paused website stays paused: the seo_sites row keeps paused, the cycle row is not touched', reP.site.status === 'paused' && reP.plan.write === false && reP.plan.status === 'paused' && /stays paused/.test(reP.plan.reason), J({ s: reP.site.status, p: reP.plan.reason }));
    const reNoTz = await track(later, TRACK_BODY(), { prior_site: A.site, prior_cycle: { ...stored, tz: '' } });
    check('a stored row with no zone gets the request\'s zone, everything else kept', reNoTz.plan.write === true && reNoTz.row.tz === TZ && reNoTz.row.anchor_at === R.anchor_at && reNoTz.row.next_due_at === stored.next_due_at && reNoTz.row.current_key === stored.current_key, J(reNoTz.row));
    const reAdopted = await track(later, TRACK_BODY(), { prior_site: A.site, prior_cycle: { ...stored, tz: ENGINE_TZ, adopted: true } });
    check('a row the dispatcher ADOPTED in the engine zone takes the owner\'s zone (nobody chose ' + ENGINE_TZ + '); its anchor and cycle are kept',
      reAdopted.plan.write === true && reAdopted.row.tz === TZ && reAdopted.row.anchor_at === R.anchor_at && reAdopted.row.adopted === true && /engine's guess/.test(reAdopted.plan.reason), J(reAdopted.plan.reason));
    const firstPaused = await track(T0, TRACK_BODY(), { prior_site: { ...A.site, status: 'paused' } });
    check('a paused website with no cycle row yet gets its row (the dispatcher honours the pause, and cycle 0 runs once on resume)', firstPaused.site.status === 'paused' && firstPaused.plan.created === true && firstPaused.row.status === 'active', J(firstPaused.plan));
    // ---- failure paths: nothing half-written ----
    const sFail = await track(T0, TRACK_BODY(), { site_save_error: 'Data table not found' });
    const lFail = await track(T0, TRACK_BODY(), { cycle_load_error: 'connection reset' });
    const cFail = await track(T0, TRACK_BODY(), { cycle_save_error: 'Data table not found' });
    check('the seo_sites save failed: no cycle row (the dispatcher adopts a tracked site later); the cycle table unreadable: nothing written, said why',
      sFail.plan.write === false && /seo_sites row was not saved/.test(sFail.plan.reason) && lFail.plan.write === false && /could not be read \(connection reset\)/.test(lFail.plan.reason) && lFail.resp.cycle.written === false, J([sFail.plan.reason, lFail.plan.reason]));
    check('the cycle save failed: the answer says it was not written and that the dispatcher adopts the website', cFail.resp.cycle.written === false && /could not be saved/.test(cFail.resp.cycle.error), J(cFail.resp.cycle));
    // ---- the kickoff: the same builder, the same row; and a second start is refused (the race is gone: the app never needs it) ----
    const kick = async (body, cycles) => at(T0, async () => { reset();
      const v = (await run('Kickoff Validate', { body }))[0].json; mock('Kickoff Validate', [{ json: v }]);
      mock('Load Sites (Kickoff)', items([A.site])); mock('Load Cycles (Kickoff)', items(cycles));
      return { v, p: (await run('Kickoff Plan', [{ json: {} }]))[0].json }; });
    const K = await kick({ domain: DOM, tz: TZ, anchor_at: ISO(T(T0) - 30000), skip_jobs: ['site_tracker'] }, []);
    const { updated_at: u1, ...rowK } = K.p.row; const { updated_at: u2, ...rowT } = R;
    check('Site Kickoff and "Track my site" build the SAME row from the same inputs (CYC.cycleRow): they cannot drift', eq(rowK, rowT) && K.p.cycle_key === A.resp.cycle.cycle_key, J({ kick: rowK, track: rowT }));
    const K2 = await kick({ domain: DOM }, [R]);
    check('after Track, the kickoff refuses a second start (already_started, 409): only `force` restarts cycle 0', K2.p.refused === true && K2.p.code === 'already_started', J(K2.p));
    const K3 = await kick({ domain: DOM, force: true }, [{ ...R, status: 'paused' }]);
    check('a forced restart of a paused cycle starts cycle 0 again and keeps it paused (a restart is not a resume)', K3.p.refused === false && K3.p.row.status === 'paused' && K3.p.row.anchor_at === T0, J(K3.p.row));
    const K4 = await kick({ domain: DOM, anchor_at: ISO(T(T0) - 8 * D1) }, []);
    check('the kickoff still refuses an anchor outside the window (400), in its own words', K4.v.ok === false && /8 days old: cycle 0 starts at the anchor, so it must be within the last 6 days/.test(K4.v.error), K4.v.error);
  });

  // =====================================================================================================================================
  // ---- the world of one client: the Data Tables as the engine leaves them, changed only by what the generated nodes write ----
  const newWorld = () => ({ sites: [], cycles: [], jobs: [], ledger: [], monitors: [], cadence: [], ladders: [], ladder_settings: [], content_log: [], skips: [], prompts: [], execs: [], seq: 100,
    starts: [], payloads: [], callbacks: [], runs: [] });
  // one dispatcher sweep through its generated nodes (the doors, the evidence, the plan, the writes, record-then-start, the alarm)
  const sweep = async (W, now, o = {}) => at(now, async () => {
    reset(); const dspExec = nextExec();
    mock('Load Cycle Mode', items([{ key: 'cycle:mode', kind: 'cycle', value: J({ mode: 'start' }), updated_at: ISO(T(T0) - D1) }])); mock('Load Cycle Last', items([]));
    mock('Load Cycles', items(W.cycles)); mock('Load Cycle Jobs', items(W.jobs)); mock('Load Sites (Cycle)', items(W.sites)); mock('Load Monitors (Cycle)', items(W.monitors));
    mock('Load Cadence (Cycle)', items(W.cadence)); mock('Load Ladder Settings (Cycle)', items(W.ladder_settings)); mock('Load Ladders (Cycle)', items(W.ladders));
    mock('Load Run Ledger (Cycle)', items(W.ledger.filter(r => T(r.created_at) >= T(now) - 2 * D1)));
    const E = (await CY('Cycle Entry', [{ json: {} }]))[0].json;
    const req = (await CY('Cycle Exec Requests', [{ json: {} }])).map(i => i.json);
    // F-ENG (2026-10-20): n8n's executions answered as n8n 2.41.4 answers them (harness/fake_n8n_api.js: no running run in the default list,
    // status=running for those, a run by id, windows on startedAt) - the old fake listed running runs in every read, which n8n never does
    const API = fakeN8nApi(W.execs.map(x => ({ id: x.id, workflowId: x.workflowId, mode: x.mode, status: x.status, startedAt: x.startedAt, stoppedAt: x.stoppedAt || null })));
    if (!req[0].skip) mock('Read Executions (Cycle)', req.map(r => ({ json: API(r.url) })));
    const P = (await CY('Cycle Plan', [{ json: {} }]))[0].json;
    for (const r of (await CY('Cycle State Rows', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) upsert(W.cycles, 'site_id', r);
    for (const r of (await CY('Cycle State Updates', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) upsert(W.cycles, 'site_id', r);   // F-ENG: the changed fields only
    for (const r of (await CY('Cycle Job Rows', [{ json: { id: 1 } }])).map(x => x.json).filter(x => !x.skip)) upsert(W.jobs, 'key', r);
    const rel = (await CY('Cycle Release Rows', [{ json: {} }])).map(x => x.json).filter(x => !x.skip);
    for (const x of rel) for (const l of W.ledger) if (String(l.run_id) === x.run_id && l.status === 'reserved') l.status = 'stale';   // Release Dead Runs
    const started = [];
    for (const s of (await CY('Cycle Start Items', [{ json: {} }])).map(x => x.json).filter(x => !x.skip)) {
      mock('Loop Cycle Starts', [{ json: s }]); mock('Read Claim (Cycle)', items(W.jobs.filter(j => j.key === s.key)));   // F-ENG: the row read just before the claim
      const rr = (await CY('Cycle Record Row', [{ json: {} }], { execId: dspExec }))[0].json;
      if (rr.skip) { started.push({ skip: true, reason: rr.reason, key: rr.key }); continue; }
      upsert(W.jobs, 'key', rr);
      mock('Save Cycle Record', [{ json: { id: ++W.seq, ...W.jobs.find(j => j.key === rr.key) } }]);
      const back = W.jobs.find(j => j.key === rr.key);   // Confirm Cycle Claim: the row read back from the table
      const pl = (await CY('Cycle Payload', [{ json: { id: W.seq, ...back } }]))[0].json;
      if (pl.skip) { started.push({ skip: true, reason: pl.reason, key: rr.key }); continue; }
      const ex = { id: nextExec(), workflowId: rr.workflow_id, mode: 'integrated', status: 'running', startedAt: new Date().toISOString(), payload: pl, key: rr.key };
      W.execs.push(ex);   // Start Cycle Job: n8n accepted the run (waitForSubWorkflow false), it is its own execution now
      const res = (await CY('Cycle Start Result', [{ json: pl }]))[0].json; upsert(W.jobs, 'key', res);
      started.push({ payload: pl, exec: ex, record: rr, result: res }); W.payloads.push(pl);
    }
    await CY('Cycle Report', [{ json: {} }]);
    let alarm = null;
    if ((P.gave_up || []).length || (P.unsettled || []).length) { try { await CY('Cycle Alarm', [{ json: {} }], { expectError: true }); } catch (e) {} const r = H.results[H.results.length - 1]; alarm = r.error; r.ok = !!o.expect_alarm; if (!o.expect_alarm) r.error = 'unexpected alarm: ' + r.error; }
    else await CY('Cycle Alarm', [{ json: {} }]);
    W.starts.push(...started.filter(s => !s.skip).map(s => ({ at: now, job: s.payload.job, cycle_key: s.payload.cycle_key, attempt: s.record.attempts })));
    return { E, P, started, alarm, rel };
  });
  // ---- the job workflows: each one's tables, its Manual Run = the dispatcher's payload, its plan node, its ledger row, the run guard, the
  // real settle and its callback. A Data Table insert returns the row with an id.
  const TAG = { ai_visibility: 'AI', backlinks: 'BL', rank_tracker: 'Tracker', site_tracker: 'Site', ai_growth: 'Growth', content_cadence: 'Cadence', preview: 'Cadence', link_builder: 'LB', audit: 'Audit' };
  const PLAN = { ai_visibility: 'AI Plan', backlinks: 'BL Plan', rank_tracker: 'Tracker Plan', site_tracker: 'Site Plan', ai_growth: 'Growth Plan', content_cadence: 'Cadence Plan', preview: 'Cadence Plan', link_builder: 'LB Plan', audit: 'Audit Schedule Plan' };
  const base = (W, pl) => { mock('Load Sites', items(W.sites)); mock('Load Ladders', items(W.ladders)); mock('Load Monitors', items(W.monitors)); mock('Load Profiles', items([])); mock('Manual Run', [{ json: pl }]); };
  const planJob = async (W, pl) => {
    const job = pl.job;
    if (job === 'ai_visibility') { base(W, pl); mock('Load AI Prompts', items(W.prompts)); for (const n of ['Load AI Visibility', 'Load AI Daily', 'Load Cache (AI)', 'Load Query History', 'Load AI Run Answers']) mock(n, items([])); }
    else if (job === 'backlinks') { base(W, pl); for (const n of ['Load Link Prospects', 'Load Content Log', 'Load Case Studies', 'Load Backlinks', 'Load Link Imports', 'Load AI Visibility (BL)', 'Load Cache (BL Rivals)', 'Load Backlink Snapshots']) mock(n, items([])); }
    else if (job === 'rank_tracker') { mock('Load Ladders', items(W.ladders)); mock('Load Sites (Tracker)', items(W.sites)); mock('Manual Run', [{ json: pl }]);
      for (const n of ['Load History', 'Load Content Log (Tracker)', 'Load Pages (Tracker)', 'Load Monitors (Tracker)', 'Load AI Brands (Tracker)']) mock(n, items([])); }
    else if (job === 'site_tracker') { mock('Load Sites', items(W.sites)); mock('Load Ladders', items(W.ladders)); mock('Load Cycles', items(W.cycles)); mock('Manual Run', [{ json: pl }]);
      for (const n of ['Load Rank History', 'Load Site Metrics', 'Load Query History', 'Load Content Log', 'Load Console Alerts', 'Load Monitors (Site)', 'Load Check-ins']) mock(n, items([])); }
    else if (job === 'ai_growth') { base(W, pl); mock('Load AI Prompts', items(W.prompts)); mock('Load Cycles', items(W.cycles));
      for (const n of ['Load AI Visibility', 'Load Content Log', 'Load Query History', 'Load AI Pages', 'Load AI Targets', 'Load Link Prospects (Growth)', 'Load AI Answers', 'Load Cache (Growth)', 'Load AI Growth']) mock(n, items([])); }
    else if (job === 'link_builder') { base(W, pl); mock('Load Cycles', items(W.cycles));
      for (const n of ['Load Link Prospects', 'Load Backlinks', 'Load Backlink Snapshots', 'Load Content Log', 'Load AI Targets', 'Load Query History', 'Load Rank History', 'Load Cache (Links)', 'Load Pages (LB)', 'Load AI Visibility (LB)', 'Load Cache (LB Rivals)', 'Load Listings', 'Load Link Impact', 'Load Link Outreach']) mock(n, items([])); }
    else if (job === 'content_cadence' || job === 'preview') { mock('Manual Run', [{ json: pl }]);
      mock('Load Sites', items(W.sites)); mock('Load Cadence', items(W.cadence)); mock('Load Ladders', items(W.ladders)); mock('Load Content Log', items(W.content_log)); mock('Load Ladder Settings', items(W.ladder_settings));
      mock('Load Skips (Cadence)', items(W.skips)); mock('Load Monitors (Cadence)', items(W.monitors));
      for (const n of ['Load Query History', 'Load Trends', 'Load Main Keyword Ranks', 'Load AI Targets (Cadence)', 'Load AI Targets Writing (Cadence)', 'Load Pages (Cadence)', 'Load AI Brands (Cadence)', 'Load Cost (Cadence)']) mock(n, items([])); }
    else if (job === 'audit') { base(W, pl); mock('Load Audits', items([])); const cand = (await run('Audit Candidates', [{ json: {} }])).map(i => i.json); mock('Audit Candidates', items(cand)); mock('Load Cache (Audit)', items([]));
      return (await run('Audit Schedule Plan', [{ json: { statusCode: 404, body: '' } }])).map(i => i.json); }
    return (await run(PLAN[job], [{ json: {} }])).map(i => i.json);
  };
  // a cycle job's run, from its Manual Run to its settled ledger row (o.crash: n8n kills it after it reserved its row)
  const runJob = async (W, start, now, o = {}) => at(now, async () => {
    reset(); const pl = start.payload, ex = start.exec, tag = TAG[pl.job], job = pl.job;
    const plan = await planJob(W, pl);
    const row = (await run('Run Ledger Row (' + tag + ')', [{ json: { id: 'tbl' } }], { code: 'Run_Ledger_Row_' + tag + '_', execId: ex.id }))[0].json;
    const reserved = { id: ++W.seq, ...row }; W.ledger.push(reserved);
    mock('Reserve Run Ledger (' + tag + ')', [{ json: reserved }]); mock('Run Ledger Row (' + tag + ')', [{ json: reserved }]);
    mock('Load Open Runs (' + tag + ')', items(W.ledger.filter(r => r.status === 'reserved' && r !== reserved))); mock('Load Catch-up Records (' + tag + ')', [{ json: {} }]);
    const gate = (await run('After Run Ledger (' + tag + ')', [{ json: {} }], { code: 'After_Run_Ledger_' + tag + '_', execId: ex.id })).map(i => i.json);
    const out = { job, pl, plan, row, gate, exec: ex };
    if (o.crash) { ex.status = 'crashed'; ex.stoppedAt = new Date(Date.now() + MIN).toISOString(); W.runs.push(out); return out; }
    mock('Load Run Ledger (' + tag + ')', items(W.ledger));
    const settled = (await run('Ledger Settle (' + tag + ')', items(W.ledger), { code: 'Ledger_Settle_' + tag + '_', execId: ex.id }))[0].json;
    const lr = W.ledger.find(r => r === reserved); Object.assign(lr, settled, { settled_at: settled.settled_at || new Date().toISOString() });   // Settle Run Ledger: update by run_id
    out.settled = settled;
    // the callback (every workflow but the Audit Scheduler, which spawns the audit runs): the report's own fields, then the Callback Ledger
    if (tag !== 'Audit') {
      let cb = null;
      if (tag === 'Cadence') {
        mock('Cadence Plan', plan.map(json => ({ json })));
        const first = plan[0] || {};
        if (pl.preview) cb = (await run('Cadence Preview', [{ json: {} }])).map(i => i.json)[0];
        else if (plan.some(p => !p.nothing_to_do && !p.preview)) cb = (await run('Cadence Note', [{ json: {} }])).map(i => i.json)[0];
        else cb = (await run('Cadence Status', plan.filter(x => x.nothing_to_do).map(json => ({ json })))).map(i => i.json)[0];   // the false branch of Any Pages? hands it the plan's items
        out.cadence_cb = cb; void first;
      } else {
        const p0 = plan.find(x => x && (x.request_id || x.domain)) || {};
        cb = { status: 'progress', stage: job, request_id: p0.request_id || pl.request_id, domain: DOM, subject: '[' + job + '] ' + DOM, html: '<html><body><h1>' + job + '</h1></body></html>', callback_url: HOOK };
      }
      if (cb) { const c = (await run('Callback Ledger (' + tag + ')', [{ json: cb }, { json: settled }], { code: 'Callback_Ledger_' + tag + '_', execId: ex.id }))[0].json; out.callback = c; W.callbacks.push(c); }
    }
    ex.status = 'success'; ex.stoppedAt = new Date().toISOString();
    W.runs.push(out); return out;
  });
  // one sweep, then every job it started runs 1 minute later; returns what happened
  const step = async (W, now, o = {}) => { const s = await sweep(W, now, o); const ran = [];
    for (const st of s.started.filter(x => !x.skip)) ran.push(await runJob(W, st, T(now) + MIN, (o.crash && o.crash(st)) ? { crash: true } : {}));
    return { ...s, ran }; };

  const LIFE = { W: null };
  await guard('INT2 a client\'s life through every agent\'s nodes', async () => {
    reset(); const SN = 'INT2 integration — one client\'s life through the generated nodes of every agent: Track, the chosen ladder, cycle 0 job by job (payload -> Manual Run -> plan -> ledger key -> settle -> next job), the preview, a skip, cycle 1, a crash retried';
    begin(SN); const check = mkCheck(SN);
    const W = newWorld(); LIFE.W = W;
    // ---- day one: Track my site (INT1's path), then the ladder the client chose ("Your first keyword", Auto) ----
    const A = await track(T0, TRACK_BODY(), { execId: '6900' });
    W.sites.push({ id: 11, ...A.site }); W.cadence.push(A.cad); W.monitors.push(A.mon); W.cycles.push({ id: 13, ...A.row });
    // ---- F-REH (2026-10-20, the real-credit rehearsal): Track's OWN Site Tracker run, as it happened on the rehearsal engine. Track's row (6900,
    // `track`) is still reserved while it hands over, a `keyword` run (6890) was crashed by a restart and left its row reserved, and a ladder
    // run (6891) is going: "3 other run(s) in flight" refused the setup run too_many_open. Now the Site Tracker names its parent (Tracker
    // Payload's parent_run_id -> key parent:6900), so it sees 2 others and runs; and the dispatcher's first sweep releases the dead keyword row.
    W.ledger.push({ id: ++W.seq, run_id: '6900', key: 'app:' + SID, mode: 'track', status: 'reserved', created_at: ISO(T(T0) + 2000), domain: DOM, heavy: false },
      { id: ++W.seq, run_id: '6890', key: 'app:' + SID, mode: 'keyword', status: 'reserved', created_at: ISO(T(T0) - 15 * MIN), domain: DOM, heavy: false },
      { id: ++W.seq, run_id: '6891', key: 'app:' + SID, mode: 'ladder', status: 'reserved', created_at: ISO(T(T0) + 1000), domain: DOM, heavy: false });
    W.execs.push({ id: '6890', workflowId: 'SEOagentV4Full01', mode: 'webhook', status: 'crashed', startedAt: ISO(T(T0) - 15 * MIN - 2000), stoppedAt: ISO(T(T0) - 5 * MIN) });
    const W0 = { ...W, runs: [], callbacks: [] };
    const setupEx = { id: '6901', workflowId: 'SEOagentSiteTrk1', mode: 'integrated', status: 'running', startedAt: ISO(T(T0) + 20000) };
    const setup = await runJob(W0, { payload: { ...A.tp, job: 'site_tracker' }, exec: setupEx }, T(T0) + 30000);
    W.seq = W0.seq; W.execs.push(setupEx);
    W.ledger.find(r => r.run_id === '6900').status = 'done'; W.ledger.find(r => r.run_id === '6891').status = 'done';   // Track and the ladder run finish and settle
    check('F-REH: Track passes its own execution id to the Site Tracker; the setup run\'s ledger row names it (parent:6900) and its run guard does not count Track - 2 others in flight, so it runs and settles',
      A.tp.parent_run_id === '6900' && setup.row.key === 'parent:6900' && setup.row.mode === 'site_tracker' && setup.row.domain === DOM && setup.gate.every(g => !g.run_refused) && setup.settled.status === 'done',
      J({ tp: A.tp.parent_run_id, key: setup.row.key, gate: setup.gate.map(g => [g.run_refused, g.reason, g.basis]), st: setup.settled.status }));
    const L = await at(T(T0) + MIN, async () => {
      reset(); const EMPTY = [{ json: {} }];
      mock('Start Form', F.forms.startLadder);
      const nL = await run('Normalize Input', F.forms.pageLadder);
      mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
      mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
      const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
      mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
      mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
      await run('Merge Keyword Data', store['Site Authority']);
      mock('Verdict Agent', { output: { ...F.verdictGo, expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
      const pvL = await run('Parse Verdict', store['Verdict Agent']);
      mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
      const lrq = await run('Ladder Requests', EMPTY);
      mock('Run Ladder Research', V.ladderResearch(lrq.map(r => r.json)));
      const lpool = await run('Ladder Pool', store['Run Ladder Research']);
      const lch = await run('Ladder Relevance Chunks', lpool);
      mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
      mock('Parse Verdict', { ...pvL[0].json, chosen_by: 'client_picked', ladder_mode: 'auto' }); mock('Load Site Cache', EMPTY); mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
      const plan = (await run('Ladder Plan', store['Ladder Keyword Relevance']))[0].json;
      mock('Attach PDF Ladder', [{ json: plan }]);
      const rows = (await run('Ladder Rows', [{ json: plan }])).map(r => r.json);
      mock('Save Ladder Rows', rows.map((r, i) => ({ json: { id: 200 + i, ...r } })));
      mock('Normalize Input', [{ json: { ...nL[0].json, chosen_by: 'client_picked', ladder_mode: 'auto' } }]);
      const set = (await run('Ladder Settings Rows', store['Save Ladder Rows'])).map(r => r.json);
      return { plan, rows, set };
    });
    W.ladders.push(...L.rows.map((r, i) => ({ id: 200 + i, ...r }))); W.ladder_settings.push(...L.set);
    const lad = L.plan.ladder; const LID = lad.ladder_id;
    check('the ladder the client chose: an Auto ladder on ' + DOM + ', chosen_by client_picked, its first page written at start (pages_now 1)',
      L.rows.every(r => r.domain === DOM && r.ladder_id === LID) && L.set.find(s => s.ladder_id === LID).chosen_by === 'client_picked' && L.set.find(s => s.ladder_id === LID).mode === 'auto' && lad.write_now.length === 1
      && L.rows.filter(r => r.status === 'writing').length === 1, J({ rows: L.rows.map(r => [r.keyword, r.status, r.rung]), set: L.set }));

    // ---- (b) the first sweep: cycle 0 opens and job 1 starts with the exact §14.2 payload, from the dispatcher's own nodes ----
    const ck0 = 'cyc:' + SID + ':2026-10-21';
    const s1 = await step(W, T(T0) + 3 * MIN);
    const p1 = (s1.started[0] || {}).payload || {};
    const ghost = W.ledger.find(r => r.run_id === '6890') || {};
    check('F-REH: the first sweep reads every other reservation by id and releases the keyword run the restart crashed (stale, with why) - not after 2 hours; the honoured skip is reported',
      s1.rel.some(x => x.run_id === '6890' && x.ghost === true && /crashed by n8n/.test(x.reason) && /^stale \(released by the cycle dispatcher\)/.test(x.cost_basis)) && ghost.status === 'stale'
      && (s1.P.ghosts || []).length === 1 && s1.P.ghosts[0].mode === 'keyword' && eq((s1.P.sites[0].skip_checks || []).map(x => [x.job, x.honoured, x.run_id]), [['site_tracker', true, '6901']]),
      J({ rel: s1.rel, ghosts: s1.P.ghosts, ghost, sc: s1.P.sites[0].skip_checks }));
    check('(b) the first sweep opens cycle 0 (monthly) for the website Track wrote, and starts exactly one job: ai_visibility', s1.P.sites.length === 1 && s1.P.sites[0].opened && s1.P.sites[0].opened.key === ck0 && s1.P.sites[0].opened.cycle0 === true
      && s1.P.sites[0].opened.monthly === true && s1.started.length === 1 && p1.job === 'ai_visibility' && !s1.P.adopted.length, J({ site: s1.P.sites[0], started: s1.started.map(x => x.payload) }));
    check('(b) the payload is §14.2 field for field: trigger, domain, site_id, cycle_key, job, monthly, scheduled_for (the anchor), request_id, tz - and nothing else',
      eq(Object.keys(p1).sort(), ['cycle_key', 'domain', 'job', 'monthly', 'request_id', 'scheduled_for', 'site_id', 'trigger', 'tz']) && p1.trigger === 'cycle' && p1.domain === DOM && p1.site_id === SID && p1.cycle_key === ck0
      && p1.monthly === true && p1.scheduled_for === A.row.anchor_at && p1.request_id === 'cyc_northwind-erp-com_20261021_ai_visibility' && p1.tz === TZ, J(p1));
    check('(b) recorded before it started: the job row was "starting" with this sweep\'s claim, the ledger key cycle:<cycle_key>:<job>, attempt 1', s1.started[0].record.status === 'starting' && /^dsp:\d+:[0-9a-z]+:[0-9a-z]+$/.test(s1.started[0].record.run_id)
      && s1.started[0].record.ledger_key === 'cycle:' + ck0 + ':ai_visibility' && s1.started[0].record.attempts === 1, J(s1.started[0].record));
    const site0 = W.cycles[0];
    check('(b) the cycle row now says cycle 0 is current and cycle 1 is due Wed 28 Oct 06:00 Dubai (02:00Z), its preview 48 h before', site0.current_key === ck0 && site0.next_due_at === '2026-10-28T02:00:00.000Z'
      && site0.next_preview_at === '2026-10-26T02:00:00.000Z' && site0.last_monthly_key === '2026-10', J(site0));
    // ---- (c) the payload in the AI Visibility workflow ----
    const r1 = s1.ran[0];
    const ai0 = r1.plan[0] || {};
    check('(c) ai_visibility: its plan reads the payload as a cycle run for ONE site - on_demand false, the cycle carried, the monthly full run, the cycle\'s request id',
      r1.plan.every(x => x.domain === DOM) && ai0.on_demand === false && ai0.cycle && ai0.cycle.key === ck0 && ai0.cycle.monthly === true && ai0.full_due === true && ai0.request_id === p1.request_id, J({ od: ai0.on_demand, cycle: ai0.cycle, full: ai0.full_due, rid: ai0.request_id, nothing: ai0.nothing_to_do, reason: ai0.reason }));
    check('(c) its ledger row is keyed cycle:<cycle_key>:ai_visibility with the domain, under its own execution id; the run guard lets it through', r1.row.key === 'cycle:' + ck0 + ':ai_visibility' && r1.row.domain === DOM && r1.row.run_id === r1.exec.id && r1.row.status === 'reserved'
      && eq(Object.keys(r1.row), TC.RUN_LEDGER) && r1.gate.every(g => !g.run_refused), J({ row: r1.row, gate: r1.gate.map(g => g.run_refused) }));
    check('(c) its settle closes that row (done) and its callback carries the cycle: trigger, cycle_key, cycle_date, cycle_week, cycle_job, the settled run_ledger',
      r1.settled.status === 'done' && r1.callback.trigger === 'cycle' && r1.callback.cycle_key === ck0 && r1.callback.cycle_date === '2026-10-21' && r1.callback.cycle_week === 'Week of Wed 21 Oct' && r1.callback.cycle_job === 'ai_visibility'
      && r1.callback.request_id === p1.request_id && r1.callback.run_ledger && /Week of Wed 21 Oct/.test(r1.callback.subject), J({ s: r1.settled.status, cb: { t: r1.callback.trigger, k: r1.callback.cycle_key, d: r1.callback.cycle_date, w: r1.callback.cycle_week, rl: !!r1.callback.run_ledger } }));
    // ---- (d) every next job: the sweep reads the settled row, marks the job done and starts the next, in CYCLE_JOBS order ----
    let t = T(T0) + 3 * MIN; const order = [p1.job]; const steps = [s1];
    for (let i = 0; i < 20; i++) { t += 5 * MIN; const s = await step(W, t); steps.push(s); for (const st of s.started) if (!st.skip) order.push(st.payload.job); if (s.P.sites[0].verdict === 'cycle_done') break; }
    const jobRow = (k) => W.jobs.find(r => r.key === k) || {};
    check('(d) cycle 0 runs its jobs one per sweep in CYCLE_JOBS order (site tracking left out: Track ran it), through the content cadence and the link builder to the monthly audit',
      eq(order, ['ai_visibility', 'backlinks', 'rank_tracker', 'ai_growth', 'content_cadence', 'link_builder', 'audit']) && eq(CYC.NAMES, ['ai_visibility', 'backlinks', 'rank_tracker', 'site_tracker', 'ai_growth', 'content_cadence', 'link_builder', 'audit']), J(order));
    check('(d) each job became done from ITS settled ledger row (the reason names the key and the execution), site_tracker skipped with the reason, the marker closed with the counts',
      ['ai_visibility', 'backlinks', 'rank_tracker', 'ai_growth', 'content_cadence', 'link_builder', 'audit'].every(j => jobRow(ck0 + ':' + j).status === 'done' && new RegExp('ledger row cycle:' + ck0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':' + j + ' settled').test(jobRow(ck0 + ':' + j).reason))
      && jobRow(ck0 + ':site_tracker').status === 'skipped' && /already run when tracking was set up \(execution 6901, finished /.test(jobRow(ck0 + ':site_tracker').reason) && jobRow(ck0 + ':cycle').status === 'done' && /7 done, 1 skipped, 0 gave up/.test(jobRow(ck0 + ':cycle').reason),
      J(W.jobs.filter(r => r.cycle_key === ck0).map(r => [r.job, r.status, r.reason.slice(0, 80)])));
    const R = (j, k) => W.runs.find(r => r.job === j && (!k || r.pl.cycle_key === k));
    const rows0 = W.runs.filter(r => r.pl.cycle_key === ck0);
    for (const r of rows0) { const p0 = r.plan[0] || {};
      console.log('   cycle 0 ' + r.job + ' -> plan items ' + r.plan.length + ', on_demand ' + p0.on_demand + ', cycle ' + ((p0.cycle || {}).key || p0.cycle_key || '-') + (p0.nothing_to_do ? ', nothing to do: ' + String(p0.reason || '').slice(0, 90) : '')
        + ' | ledger ' + r.row.key + ' (' + r.row.domain + ', exec ' + r.row.run_id + ') -> ' + (r.settled || {}).status + ' | callback ' + (r.callback ? r.callback.stage + ' ' + r.callback.cycle_key : 'none')); }
    check('(c) every job of cycle 0 keyed its ledger row cycle:<cycle_key>:<job> with the domain, was let through by its run guard, and settled done',
      rows0.length === 7 && rows0.every(r => r.row.key === 'cycle:' + ck0 + ':' + r.job && r.row.domain === DOM && r.gate.every(g => !g.run_refused) && r.settled.status === 'done' && r.row.run_id === r.exec.id), J(rows0.map(r => [r.job, r.row.key, r.row.domain, r.gate.map(g => g.run_refused || g.reason), r.settled && r.settled.status])));
    check('(c) every plan treated its payload as a cycle run for one site: on_demand false, the cycle key, the cycle\'s request id where it names one',
      rows0.every(r => r.plan.filter(x => !x.nothing_to_do || x.cycle).every(x => (x.on_demand === false || x.on_demand === undefined) && (!x.cycle || x.cycle.key === ck0) && (!x.domain || x.domain === DOM))), J(rows0.map(r => [r.job, (r.plan[0] || {}).on_demand, ((r.plan[0] || {}).cycle || {}).key, (r.plan[0] || {}).domain])));
    check('(c) every callback of cycle 0 carries trigger cycle, its cycle_key and cycle_date, and the job it reports (the Audit Scheduler sends none: it spawns the audit)',
      W.callbacks.filter(c => c.cycle_key === ck0).length === 6 && W.callbacks.every(c => c.trigger === 'cycle' && c.cycle_date === '2026-10-21' && c.cycle_job), J(W.callbacks.map(c => [c.cycle_job, c.cycle_key, c.stage])));
    // (e) cycle 0 is monthly
    const bl0 = R('backlinks', ck0), au0 = R('audit', ck0), gr0 = R('ai_growth', ck0);
    check('(e) cycle 0 is the monthly cycle: AI visibility full, backlinks full (light false), AI Growth\'s Wikidata check due, the audit runs',
      bl0.pl.light === false && bl0.pl.monthly === true && (bl0.plan[0] || {}).mode === 'full' && (gr0.plan[0] || {}).entity_due === true && au0.pl.monthly === true && (au0.plan[0] || {}).run === true && /first monthly cycle/.test((au0.plan[0] || {}).why || '')
        && W.payloads.filter(p => p.cycle_key === ck0).every(p => p.monthly === true), J({ bl: [bl0.pl.light, (bl0.plan[0] || {}).mode], gr: (gr0.plan[0] || {}).entity_due, au: [(au0.plan[0] || {}).run, (au0.plan[0] || {}).why] }));
    // (d) the content cadence in cycle 0: level 2, the client's Auto ladder - and R-K7: the ladder start's page is this cycle's one page
    const cad0 = R('content_cadence', ck0), c0 = cad0.plan.find(x => x.site_id === SID) || {};
    check('(d) content_cadence (level 2, one client-chosen Auto ladder, 1 page a week): the ladder start already wrote this cycle\'s page, so nothing more is written (R-K7: one cycle, one budget)',
      c0.level === 2 && c0.waiting_for_keyword === false && c0.client_ladders === 1 && c0.budget && c0.budget.pages_per_week === 1 && c0.budget.spent === 1 && c0.budget.room === 0 && !cad0.plan.some(x => x.body)
        && /already used/.test(c0.reason || ''), J({ level: c0.level, wfk: c0.waiting_for_keyword, budget: c0.budget, reason: c0.reason }));
    check('(d) its note reaches the app with the cycle fields (content_cadence callback: trigger, cycle_key, level, waiting_for_keyword)', cad0.callback && cad0.callback.stage === 'content_cadence' && cad0.callback.trigger === 'cycle' && cad0.callback.cycle_key === ck0
      && cad0.callback.level === 2 && cad0.callback.waiting_for_keyword === false, J(cad0.callback && { s: cad0.callback.stage, t: cad0.callback.trigger, k: cad0.callback.cycle_key, l: cad0.callback.level }));
    const lb0 = R('link_builder', ck0);
    check('(d) link_builder: one site, on_demand false, the cycle carried, its key settled', (lb0.plan[0] || {}).on_demand === false && ((lb0.plan[0] || {}).cycle || {}).key === ck0 && lb0.row.key === 'cycle:' + ck0 + ':link_builder', J(lb0.plan[0] && { od: lb0.plan[0].on_demand, c: lb0.plan[0].cycle }));
    check('(c) the two plans that carry no `cycle` object say it their way: the cadence trigger cycle + cycle_key + the cycle\'s request id; the audit a scheduled body with the cycle\'s request id',
      c0.trigger === 'cycle' && c0.cycle_key === ck0 && c0.request_id === 'cyc_northwind-erp-com_20261021_content_cadence' && (au0.plan[0] || {}).body && au0.plan[0].body.scheduled === true && au0.plan[0].body.request_id === 'cyc_northwind-erp-com_20261021_audit',
      J({ cad: [c0.trigger, c0.cycle_key, c0.request_id], au: (au0.plan[0] || {}).body && [au0.plan[0].body.scheduled, au0.plan[0].body.request_id] }));
    const rt0 = R('rank_tracker', ck0);
    check('(d) rank_tracker checks this website\'s ladder only, with the cycle\'s request id', rt0.plan.length > 0 && rt0.plan.every(x => x.domain === DOM && x.request_id === 'cyc_northwind-erp-com_20261021_rank_tracker'), J(rt0.plan.map(x => [x.domain, x.keyword, x.request_id])));
    // a quiet sweep after the cycle finished writes nothing and starts nothing
    const quiet = await step(W, t + 5 * MIN);
    check('a sweep after cycle 0 finished starts nothing and writes no row', !quiet.started.length && quiet.P.job_rows.length === 0 && quiet.P.cycle_rows.length === 0 && quiet.P.sites[0].verdict === 'cycle_done', J({ s: quiet.P.sites[0].verdict, jr: quiet.P.job_rows.length, cr: quiet.P.cycle_rows.length }));

    // ---- (f) 48 h before cycle 1: the preview job -> the cadence in preview mode -> one cycle_preview, nothing written ----
    const ck1 = 'cyc:' + SID + ':2026-10-28';
    const early = await step(W, T('2026-10-26T01:55:00.000Z'));
    check('(f) five minutes before the preview\'s time nothing starts', !early.started.length, J(early.started.map(s => s.payload)));
    const pv = await step(W, T('2026-10-26T02:03:00.000Z'));
    const pvp = (pv.started[0] || {}).payload || {};
    check('(f) at 48 h before cycle 1 the dispatcher starts the preview job: the cadence\'s workflow, cycle 1\'s key, preview true, scheduled_for = cycle 1\'s due time, not monthly',
      pv.started.length === 1 && pvp.job === 'preview' && pvp.preview === true && pvp.cycle_key === ck1 && pvp.scheduled_for === '2026-10-28T02:00:00.000Z' && pvp.monthly === false && pv.started[0].record.workflow_id === 'SEOagentCadence1'
        && pvp.request_id === 'cyc_northwind-erp-com_20261028_preview', J(pvp));
    const pr = R('preview', ck1), pp = pr.plan.filter(x => x.preview);
    check('(f) the cadence reads it as the preview: ONE plan item for the site, a dry run, its key cycle:<next cycle>:preview, nothing written',
      pp.length === 1 && pp[0].dry_run === true && pr.row.key === 'cycle:' + ck1 + ':preview' && pr.row.domain === DOM && !pr.plan.some(x => x.body && !x.preview), J({ n: pp.length, key: pr.row.key, items: (pp[0] || {}).items }));
    const pcb = pr.callback || {};
    const pitems = ((pcb.callback_body || {}).items) || [];
    check('(f) one cycle_preview callback with the CyclePreview fields: the next ladder page as an automatic item (with its key, price and ladder), for cycle 1',
      pcb.stage === 'cycle_preview' && pcb.callback_body && pcb.callback_body.cycle_key === ck1 && pcb.callback_body.scheduled_for === '2026-10-28T02:00:00.000Z' && pcb.callback_body.level === 2 && pitems.length === 1
        && pitems[0].source === 'ladder' && pitems[0].auto === true && pitems[0].ladder_id === LID && pitems[0].est_usd > 0 && pcb.trigger === 'cycle', J({ stage: pcb.stage, body: pcb.callback_body && { k: pcb.callback_body.cycle_key, items: pitems } }));
    // nothing downstream of a preview writes: the content log, the ladder marks, the weekly note
    const nothing = await at(T('2026-10-26T02:05:00.000Z'), async () => { reset(); mock('Cadence Plan', pr.plan.map(json => ({ json })));
      return { lr: (await run('Log Rows', [{ json: {} }])).map(i => i.json), lm: (await run('Ladder Marks', [{ json: {} }])).map(i => i.json), cn: (await run('Cadence Note', [{ json: {} }])).map(i => i.json) }; });
    check('(f) the preview writes no content-log row, marks no ladder row and sends no weekly note', nothing.lr.length === 0 && nothing.lm.length === 1 && nothing.lm[0].skip === true && nothing.cn.length === 0, J(nothing));
    const pv2 = await step(W, T('2026-10-26T02:13:00.000Z'));
    check('(f) the next sweep marks the preview done and starts nothing more before cycle 1', (W.jobs.find(r => r.key === ck1 + ':preview') || {}).status === 'done' && !pv2.started.length, J(W.jobs.find(r => r.key === ck1 + ':preview')));

    // ---- (g) the client skips the previewed page (the app writes seo_skips) ----
    const pk = pitems[0];
    W.skips.push({ key: SID + ':' + ck1 + ':' + pk.item_key, site_id: SID, cycle_key: ck1, item_key: pk.item_key, decision: 'skip', scope: 'cycle', by: 'owner', created_at: '2026-10-26T09:00:00.000Z' });

    // ---- (h) cycle 1: due 7 days after cycle 0 at 06:00 Dubai, not monthly; (i) a crash of one job mid-cycle, retried ----
    const before = await step(W, T('2026-10-28T01:58:00.000Z'));
    check('(h) two minutes before 06:00 in Dubai on Wed 28 Oct nothing opens', !before.started.length && !before.P.sites[0].opened, J(before.P.sites[0]));
    const c1 = await step(W, T('2026-10-28T02:03:00.000Z'));
    const q1 = (c1.started[0] || {}).payload || {};
    check('(h) cycle 1 opens 7 days after cycle 0, at 06:00 Asia/Dubai (02:00Z), keyed by the Dubai date, NOT monthly; job 1 starts with monthly false',
      c1.P.sites[0].opened && c1.P.sites[0].opened.key === ck1 && c1.P.sites[0].opened.due_at === '2026-10-28T02:00:00.000Z' && c1.P.sites[0].opened.monthly === false && c1.P.sites[0].opened.cycle0 === false
        && q1.job === 'ai_visibility' && q1.monthly === false && q1.scheduled_for === '2026-10-28T02:00:00.000Z' && q1.request_id === 'cyc_northwind-erp-com_20261028_ai_visibility', J({ o: c1.P.sites[0].opened, p: q1 }));
    check('(h) its next cycle is Wed 4 Nov 06:00 Dubai, and the website keeps its weekday', W.cycles[0].next_due_at === '2026-11-04T02:00:00.000Z' && W.cycles[0].cycle_weekday === 3 && W.cycles[0].current_key === ck1, J(W.cycles[0]));
    // job 2 (backlinks) crashes after it reserved its ledger row: n8n reports the execution crashed
    let tt = T('2026-10-28T02:08:00.000Z');
    const crashStep = await step(W, tt, { crash: (st) => st.payload.job === 'backlinks' && st.record.attempts === 1 });
    const crashed = W.runs.find(r => r.job === 'backlinks' && r.pl.cycle_key === ck1);
    check('(i) backlinks of cycle 1 starts light (not the monthly cycle) and its run crashes after reserving cycle:<key>:backlinks',
      crashStep.started.length === 1 && crashStep.started[0].payload.job === 'backlinks' && crashStep.started[0].payload.light === true && crashed && crashed.exec.status === 'crashed' && crashed.row.status === 'reserved', J(crashStep.started.map(s => s.payload)));
    tt += 5 * MIN; const retry = await step(W, tt);
    const bk = W.jobs.find(r => r.key === ck1 + ':backlinks') || {};
    check('(i) the next sweep reads n8n\'s "crashed", releases the dead reservation (stale, so the retry is not refused as its twin) and starts attempt 2 the same sweep',
      retry.rel.length === 1 && retry.rel[0].run_id === crashed.exec.id && W.ledger.find(l => l.run_id === crashed.exec.id).status === 'stale' && retry.started.length === 1 && retry.started[0].payload.job === 'backlinks' && retry.started[0].record.attempts === 2
        && retry.ran[0].gate.every(g => !g.run_refused) && retry.ran[0].settled.status === 'done', J({ rel: retry.rel, st: retry.started.map(s => [s.payload.job, s.record.attempts]), bk }));
    tt += 5 * MIN; const after = await step(W, tt);
    check('(i) then the cycle carries on: backlinks done on attempt 2, rank_tracker next', (W.jobs.find(r => r.key === ck1 + ':backlinks') || {}).status === 'done' && (W.jobs.find(r => r.key === ck1 + ':backlinks') || {}).attempts === 2
      && after.started.length === 1 && after.started[0].payload.job === 'rank_tracker', J({ bk: W.jobs.find(r => r.key === ck1 + ':backlinks'), next: after.started.map(s => s.payload.job) }));
    const order1 = [];
    for (let i = 0; i < 20; i++) { tt += 5 * MIN; const s = await step(W, tt); for (const st of s.started) if (!st.skip) order1.push(st.payload.job); if (s.P.sites[0].verdict === 'cycle_done') break; }
    check('(h) cycle 1 runs the rest in order: the Site Tracker this time (no longer cycle 0), no audit (not the monthly cycle)', eq(order1, ['site_tracker', 'ai_growth', 'content_cadence', 'link_builder'])
      && (W.jobs.find(r => r.key === ck1 + ':audit') || {}).status === 'skipped' && /monthly cycle only/.test((W.jobs.find(r => r.key === ck1 + ':audit') || {}).reason) && /7 done, 1 skipped, 0 gave up/.test((W.jobs.find(r => r.key === ck1 + ':cycle') || {}).reason), J({ order1, audit: W.jobs.find(r => r.key === ck1 + ':audit') }));
    const st1 = R('site_tracker', ck1);
    check('(h) the Site Tracker of cycle 1: one site, on_demand false, the website\'s zone and "every Wednesday"', (st1.plan[0] || {}).on_demand === false && (st1.plan[0] || {}).tz === TZ && (st1.plan[0] || {}).every_week === 'every Wednesday', J(st1.plan[0] && { od: st1.plan[0].on_demand, tz: st1.plan[0].tz, ew: st1.plan[0].every_week }));
    // (g) cycle 1's cadence: the skipped page is not written; the next one is, within the one page a week
    const cad1 = R('content_cadence', ck1), w1 = cad1.plan.filter(x => x.body), f1 = cad1.plan.find(x => x.site_id === SID) || {};
    check('(g) cycle 1\'s cadence does not write the page the client skipped; it writes the NEXT page of the ladder - exactly one (1 a week) - as a content run with the ladder fields',
      w1.length === 1 && w1[0].keyword !== pk.keyword && w1[0].source === 'ladder' && w1[0].ladder_id === LID && w1[0].body.mode === 'keyword' && w1[0].body.ladder_id === LID && w1[0].body.force_content === true
        && (f1.skipped || []).some(x => x.item_key === pk.item_key && x.scope === 'cycle') && w1[0].request_id.startsWith('cad_20261028_'), J({ written: w1.map(x => [x.keyword, x.source, x.request_id]), skipped: f1.skipped, previewed: pk.keyword }));
    check('(g) the page written in cycle 1 is the ladder\'s, chosen by the client: the note carries its key and auto', cad1.callback && cad1.callback.stage === 'content_cadence' && (cad1.callback.pages || []).length === 1 && cad1.callback.pages[0].auto === true && cad1.callback.cycle_key === ck1, J(cad1.callback && cad1.callback.pages));
    check('every start of the life was recorded first and claimed by its sweep, and belongs to this website\'s cycles (16 starts: 7 + the preview + 8 with the retry)', W.starts.length === W.payloads.length && W.starts.length === 16
      && W.starts.every(s => s.cycle_key.startsWith('cyc:' + SID + ':')) && W.runs.every(r => r.row.run_id === r.exec.id), J(W.starts.map(s => [s.job, s.attempt])));
  });

  // =====================================================================================================================================
  await guard('INT3 the AI Pulse skips the cycle day only', async () => {
    reset(); const SN = 'INT3 integration — the AI Pulse reads the cycle row "Track my site" wrote: the website is skipped on ITS cycle weekday (Wednesday in Dubai) and sampled on every other morning';
    begin(SN); const check = mkCheck(SN);
    const A = await track(T0, TRACK_BODY());
    const cyc = [{ ...A.row, current_key: 'cyc:' + SID + ':2026-10-21' }];
    const panel = []; for (let i = 0; i < 12; i++) panel.push({ prompt_id: 'int_' + i, site_id: SID, domain: DOM, prompt: 'Which companies offer ' + ['e-invoicing', 'erp', 'peppol'][i % 3] + ' implementation in the UAE (' + i + ')?', kind: 'recommend', topic: ['e-invoicing', 'erp', 'peppol'][i % 3],
      keyword: ['e invoicing in uae', 'erp implementation uae', 'peppol uae'][i % 3], source: 'auto', status: 'active', created_at: '2026-10-21T09:00:00.000Z', stage: 'consideration', cluster: ['e-invoicing', 'erp', 'peppol'][i % 3], volume: 20, origin: 'writer', updated_at: '2026-10-21T09:00:00.000Z', persona: '', market: 'AE-en', pinned: false, fit_note: '' });
    const pulse = async (now, o = {}) => at(now, async () => { reset();
      mock('Load Sites', items([A.site])); mock('Load Ladders', items([])); mock('Load Profiles', items([])); mock('Load AI Visibility', items([])); mock('Load AI Daily', items([])); mock('Load Cache (AI)', items([]));
      mock('Load Monitors', items([A.mon])); mock('Load AI Prompts', items(panel)); mock('Load Cycles', items(o.cycles || cyc));
      if (o.byHand) delete store['Daily Schedule']; else mock('Daily Schedule', [{ json: { timestamp: ISO(now) } }]);
      return (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' })).map(i => i.json); });
    const days = []; for (let d = 0; d < 7; d++) { const now = T('2026-10-27T10:30:00.000Z') + d * D1; const out = await pulse(now); days.push({ date: ISO(now).slice(0, 10), skipped: !!out[0].nothing_to_do && (out[0].cycle_day_skipped || []).some(x => x.domain === DOM) }); }
    check('(j) over a week of 06:30 New York mornings the website is skipped on exactly one: Wednesday 28 Oct (its cycle day in Dubai)', days.filter(d => d.skipped).length === 1 && days.find(d => d.skipped).date === '2026-10-28', J(days));
    const hand = await pulse(T('2026-10-28T10:30:00.000Z'), { byHand: true });
    check('(j) a start by hand on the cycle day is never skipped', !hand[0].nothing_to_do, J(hand[0]).slice(0, 200));
    const noRow = await pulse(T('2026-10-26T10:30:00.000Z'), { cycles: [] });
    check('(j) without the cycle row (the old world) the same website would be skipped on Monday instead - the row Track wrote is what moves its day', !!noRow[0].nothing_to_do, J(noRow[0]).slice(0, 200));
  });

  // =====================================================================================================================================
  await guard('INT4 a ladder-only domain gets a rank-tracking-only cycle', async () => {
    reset(); const SN = 'INT4 integration — a domain with keyword ladders and no seo_sites row lost its weekly rank check when the crons went: the dispatcher adopts it as a RANK-TRACKING-ONLY cycle (only rank_tracker, ever; e-mail and callback from its ladder rows), and "Track my site" later makes it the normal cycle with the same anchor';
    begin(SN); const check = mkCheck(SN);
    const LD = 'ladderonly-erp.com', LSID = 'site_ladderonly-erp-com', LHOOK = 'https://api.partner.example/hooks/ladders';
    const lrow = (kw, rung, page, st) => ({ id: rung * 10 + page, ladder_id: 'lad_lo', domain: LD, head_keyword: 'peppol access point uae', rung, page_no: page, keyword: kw, page_type: 'Guide', target_url: 'https://' + LD + '/' + kw.replace(/\s+/g, '-') + '/',
      page_exists: st === 'published', status: st, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: 'owner@' + LD, callback_url: LHOOK, request_id: 'api-ladder-1', start_date: '2026-09-01T00:00:00.000Z' });
    const W = newWorld();
    W.ladders.push(lrow('peppol access point uae', 4, 0, 'published'), lrow('peppol access point cost uae', 1, 1, 'published'), lrow('what is peppol uae', 2, 2, 'planned'));
    const tA = T('2026-10-22T13:02:00.000Z');
    const a1 = await step(W, tA);
    const C = W.cycles.find(r => r.site_id === LSID) || {};
    check('the first sweep adopts the domain: a cycle row anchored now, in the engine zone, adopted, and the report names it rank-tracking only',
      a1.P.adopted.length === 1 && a1.P.adopted[0].rank_only === true && a1.P.adopted[0].domain === LD && C.adopted === true && C.anchor_at === ISO(tA) && C.tz === ENGINE_TZ && C.domain === LD && a1.P.sites[0].rank_only === true, J({ ad: a1.P.adopted, row: C }));
    check('…and starts its rank check first - not AI visibility - with the §14.2 payload for the derived site id', a1.started.length === 1 && a1.started[0].payload.job === 'rank_tracker' && a1.started[0].payload.site_id === LSID && a1.started[0].payload.domain === LD && a1.started[0].payload.trigger === 'cycle',
      J(a1.started.map(s => s.payload)));
    const rt = a1.ran[0];
    check('the Rank Tracker reads it as a cycle run of that domain and checks its ladder, with the e-mail and callback of the ladder rows (no seo_sites row to read them from)',
      rt.plan.length > 0 && rt.plan.every(x => x.domain === LD && x.on_demand === false && x.cycle && x.cycle.key === a1.started[0].payload.cycle_key && x.email === 'owner@' + LD && x.callback_url === LHOOK) && rt.row.key === 'cycle:' + a1.started[0].payload.cycle_key + ':rank_tracker' && rt.row.domain === LD,
      J(rt.plan.map(x => [x.domain, x.keyword, x.email, x.callback_url])));
    // three weeks of hourly sweeps: nothing but the rank check ever starts
    let t = tA; const jobsStarted = new Set(['rank_tracker']); let rankRuns = 1;
    for (let h = 0; h < 21 * 24; h++) { t += H1; const s = await sweepKit(W, t); for (const st of s.start) { jobsStarted.add(st.job); if (st.job === 'rank_tracker') rankRuns++; settleKit(W, st, t + MIN); } }
    check('over three weeks of sweeps only rank_tracker ever starts for it - no monitor, no cadence, no preview, no audit - once a cycle (4 cycles: the adoption and three more)',
      eq([...jobsStarted], ['rank_tracker']) && rankRuns === 4 && W.cycles.find(r => r.site_id === LSID).next_preview_at === '', J({ jobs: [...jobsStarted], rankRuns }));
    const others = W.jobs.filter(r => r.site_id === LSID && r.job !== 'cycle' && r.job !== 'rank_tracker');
    check('every other job of its cycles is recorded skipped with the reason (not tracked, so only the rank check runs)', others.length === 4 * 7 && others.every(r => r.status === 'skipped' && /not tracked .*only their rank check/.test(r.reason)), J(others.slice(0, 3)));
    // Track my site arrives: the same row becomes the normal cycle
    const tT = t + 2 * H1;
    const TB = { mode: 'track', domain: LD, country: 'United Arab Emirates', callback_url: HOOK, request_id: 'app-track-lo', blogs_per_week: 0, timezone: TZ, tracking_started_at: ISO(tT) };
    const trk = await track(tT, TB, { prior_cycle: W.cycles.find(r => r.site_id === LSID) });
    check('"Track my site" keeps the adopted row\'s anchor and week, and takes the owner\'s zone (the engine zone was a guess)', trk.plan.created === false && trk.plan.anchor_at === ISO(tA) && trk.plan.write === true && trk.row.tz === TZ && trk.row.adopted === true, J(trk.plan));
    W.sites.push({ id: 31, ...trk.site }); W.monitors.push(trk.mon); W.cadence.push(trk.cad); upsert(W.cycles, 'site_id', trk.row);
    const due = T(W.cycles.find(r => r.site_id === LSID).next_due_at);
    const n1 = await sweepKit(W, due + 3 * MIN);
    check('its next cycle is a normal one: AI visibility starts first (the monitors are on now), and the row is no longer rank-only', n1.start.length === 1 && n1.start[0].job === 'ai_visibility' && n1.sites.find(s => s.site_id === LSID).rank_only === false, J({ s: n1.start, site: n1.sites.find(s => s.site_id === LSID) }));
    // and the safety nets: no adoption for a domain that is tracked, or whose ladder rungs the fit gate all refused
    const W2 = newWorld(); W2.sites.push({ site_id: 'site_a-erp-com', domain: 'a-erp.com', status: 'active' }); W2.ladders.push({ ...lrow('x', 4, 0, 'planned'), domain: 'a-erp.com' });
    const k2 = await sweepKit(W2, tA);
    check('a domain WITH a seo_sites row is adopted as a normal website, never rank-only', k2.adopted.length === 1 && k2.adopted[0].rank_only === false, J(k2.adopted));
    const g3 = await at(tA, async () => { reset();
      mock('Load Cycle Mode', items([{ key: 'cycle:mode', value: J({ mode: 'start' }) }])); for (const n of ['Load Cycles', 'Load Cycle Jobs', 'Load Sites (Cycle)', 'Load Monitors (Cycle)', 'Load Cadence (Cycle)', 'Load Ladder Settings (Cycle)', 'Load Run Ledger (Cycle)']) mock(n, items([]));
      mock('Load Ladders (Cycle)', items([{ ...lrow('cleartax login', 1, 1, 'planned'), domain: 'gated-erp.com', head_keyword: 'cleartax login' }])); mock('Cycle Exec Requests', [{ json: { skip: true } }]);
      await CY('Cycle Entry', [{ json: {} }]); return (await CY('Cycle Plan', [{ json: {} }]))[0].json; });
    check('a domain whose only rungs the fit gate refuses buys no rank check: it is not adopted (the gate on the read path)', g3.adopted.length === 0 && g3.ladders_set_aside.length === 1, J({ ad: g3.adopted, aside: g3.ladders_set_aside }));
  });
  // the kit alone, for the three-week loops (the generated node is the same kit: INT2 ran it through the nodes)
  async function sweepKit(W, now) {
    const p = CYC.plan({ now: ISO(now), mode: 'start', engine_tz: ENGINE_TZ, sites: W.sites, cycles: W.cycles, jobs: W.jobs, monitors: W.monitors, cadence: W.cadence,
      ladders: [...new Set(W.ladders.map(l => l.domain))].map(domain => ({ domain, rungs: W.ladders.filter(l => l.domain === domain).length })), ladder_settings: W.ladder_settings, ledger: W.ledger, runs: {} });
    for (const r of p.cycle_rows) upsert(W.cycles, 'site_id', r); for (const r of p.job_rows) upsert(W.jobs, 'key', r);
    for (const s of p.start) upsert(W.jobs, 'key', CYC.jobRow({ ...s, status: 'starting', run_id: 'dsp:kit', reason: 'starting: ' + s.why, started_at: ISO(now), finished_at: '', updated_at: ISO(now) }));
    return p;
  }
  function settleKit(W, s, at0) { const id = nextExec(); W.ledger.push({ id: ++W.seq, run_id: id, key: s.ledger_key, mode: CYC.BY_JOB[s.job].mode, status: 'done', created_at: ISO(at0), settled_at: ISO(at0 + MIN), domain: s.payload.domain }); }

  // =====================================================================================================================================
  await guard('INT5 Ladder Pool protects the declared services', async () => {
    reset(); const SN = 'INT5 integration — Ladder Pool protects the services the client declared ("What do you sell?", seo_sites.declared_services), not only the request\'s: a ladder started later without services keeps a keyword about the client\'s own service';
    begin(SN); const check = mkCheck(SN);
    const EMPTY = [{ json: {} }];
    mock('Start Form', F.forms.startLadder);
    const nL = await run('Normalize Input', F.forms.pageLadder);
    mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
    mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
    const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
    mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
    mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
    await run('Merge Keyword Data', store['Site Authority']);
    mock('Verdict Agent', { output: { ...F.verdictGo, expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
    const pv = (await run('Parse Verdict', store['Verdict Agent']))[0].json;
    mock('Parse Verdict', { ...pv, services: [], competitors_summary: [...(pv.competitors_summary || []), { domain: 'zoho.com' }] });
    mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
    const lrq = await run('Ladder Requests', EMPTY); const research = V.ladderResearch(lrq.map(r => r.json));
    mock('Run Ladder Research', research); delete store['Load Site Row (Model)']; delete store['Site Model'];
    const without = (await run('Ladder Pool', store['Run Ladder Research']))[0].json;
    const zohoRef = (without.research.refused || []).filter(r => /\bzoho\b/.test(r.keyword));
    mock('Load Site Row (Model)', [{ json: { site_id: 'site_northwind-erp-com', domain: DOM, declared_services: J(['Zoho Books implementation', 'E-invoicing implementation']) } }]);
    const withD = (await run('Ladder Pool', store['Run Ladder Research']))[0].json;
    const zohoKept = (withD.research.candidates || []).filter(c => /\bzoho\b/.test(c.keyword));
    check('without declared services a Zoho keyword is refused as another company on the results page (zoho.com)', zohoRef.length > 0 && zohoRef.every(r => r.reason === 'other brand'), J(zohoRef.slice(0, 3)));
    check('with "Zoho Books implementation" declared (seo_sites.declared_services, read from the stored row) the same keywords are kept, and the research names the protected services',
      zohoKept.length > 0 && !(withD.research.refused || []).some(r => /\bzoho\b/.test(r.keyword)) && eq(withD.research.protected_services, ['Zoho Books implementation', 'E-invoicing implementation']), J({ kept: zohoKept.map(c => c.keyword).slice(0, 4), prot: withD.research.protected_services }));
    mock('Load Site Row (Model)', [{ json: { error: { message: 'Data table not found' } } }]); mock('Site Model', [{ json: { site_model: { declared_services: ['Zoho Books implementation'] } } }]);
    const viaModel = (await run('Ladder Pool', store['Run Ladder Research']))[0].json;
    check('an unreadable stored row falls back to the site model the run carries', eq(viaModel.research.protected_services, ['Zoho Books implementation']) && !(viaModel.research.refused || []).some(r => /\bzoho\b/.test(r.keyword)), J(viaModel.research.protected_services));
  });

  // =====================================================================================================================================
  await guard('INT6 Growth Metrics counts set_aside targets', async () => {
    reset(); const SN = 'INT6 integration — the AI Growth summary (targets_json) counts the questions the fit gate set aside beside queued / writing / written / won, so six targets never read as four';
    begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(CD, 'Growth_Metrics.js'), 'utf8');
    check('Growth Metrics counts status set_aside in targets_json', /set_aside: targets\.filter\(t => t\.status === 'set_aside'\)\.length/.test(src), '');
    const m = src.match(/targets_json: J\((\{[\s\S]*?\})\),\n/);
    let tj = null; try { tj = new Function('targets', 'queued', 'J', 'return ' + m[1] + ';')([{ status: 'queued', value: 3 }, { status: 'set_aside' }, { status: 'set_aside' }, { status: 'written' }, { status: 'won' }, { status: 'writing' }], [{ status: 'queued', value: 3, target_id: 't1', question: 'q', kind: 'answer', page_url: '' }], (x) => x); } catch (e) { tj = { error: String(e) }; }
    check('six stored targets: 1 queued, 1 writing, 1 written, 1 won and 2 set aside - all six counted', tj && tj.queued === 1 && tj.writing === 1 && tj.written === 1 && tj.won === 1 && tj.set_aside === 2, J(tj));
  });

  // =====================================================================================================================================
  await guard('INT7 an approval is the client\'s choice', async () => {
    reset(); const SN = 'INT7 integration — an approved "Coming up" item is written while the site waits for its first keyword (levels 1-2); skips beat approvals; the budget and the pile-up guard still hold; what is not written says why';
    begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
    const c = FX.cases.find(x => x.name === 'approve_while_waiting_for_keyword');
    const p = FX.cases.find(x => x.name === 'approve_while_waiting_pileup');
    check('the shared fixture holds the two cases (the app mirror runs the same file)', !!c && !!p, J(FX.cases.map(x => x.name).filter(n => /approve/.test(n))));
    const planOf = async (cs) => at(cs.now, async () => { reset();
      const t = cs.tables; mock('Manual Run', [{ json: cs.trigger }]);
      mock('Load Sites', items(t.sites)); mock('Load Cadence', items(t.cadence)); mock('Load Ladders', items(t.ladders)); mock('Load Query History', items(t.query_history)); mock('Load Trends', items(t.trends)); mock('Load Content Log', items(t.content_log));
      mock('Load Ladder Settings', items(t.ladder_settings)); mock('Load Main Keyword Ranks', items(t.ranks)); mock('Load AI Targets (Cadence)', items(t.ai_targets)); mock('Load AI Targets Writing (Cadence)', items([])); mock('Load Monitors (Cadence)', items(t.monitors));
      mock('Load Pages (Cadence)', items(t.pages)); mock('Load AI Brands (Cadence)', items(t.ai_brands)); mock('Load Skips (Cadence)', items(t.skips)); mock('Load Cost (Cadence)', items(t.cost));
      return (await run('Cadence Plan', [{ json: {} }])).map(i => i.json); });
    const o = await planOf(c), w = o.filter(x => x.body), f = o.find(x => x.site_id) || {};
    check('waiting for the first keyword, one page a week, two approvals and one of them also skipped: the approved, not-skipped item is written - only that one',
      f.waiting_for_keyword === true && w.length === 1 && w[0].approved === true && w[0].auto === false && eq(w.map(x => x.keyword), c.expect.picks.map(x => x.keyword)), J({ wfk: f.waiting_for_keyword, w: w.map(x => [x.keyword, x.approved]) }));
    check('the skip beat its approval, and the approval over the budget is listed as not written (budget)', (f.skipped || []).length === 1 && (f.approved_not_written || []).length === 1 && f.approved_not_written[0].reason === 'budget', J({ sk: f.skipped, anw: f.approved_not_written }));
    const op = await planOf(p), fp = op.find(x => x.site_id) || {};
    check('the pile-up guard holds an approval too: nothing written, the approval listed with the reason pileup', !op.some(x => x.body) && (fp.approved_not_written || []).length >= 1 && fp.approved_not_written.every(x => x.reason === 'pileup'), J({ anw: fp.approved_not_written, r: fp.reason }));
  });
};
