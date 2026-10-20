// 2026-10-19 (n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md §2.2, §4.3-§4.5, §4.8, §14.2, §15; agent E2 "Cycle semantics"): a THIRD kind of
// run. A website's week starts the day it set up and repeats every 7 days at 06:00 in its own time zone; the Cycle Dispatcher starts each job
// of a cycle through the workflow's own Manual Run with { trigger: 'cycle', domain, site_id, cycle_key, job, monthly, scheduled_for,
// request_id, light? }. These scenarios prove every rule of that run on the GENERATED nodes - one site, scheduled semantics (on_demand false,
// switched-off jobs and paused sites honoured), the monthly extras only from `monthly`, the ledger key `cycle:<cycle_key>:<job>` (and
// `…:part<n>` for every execution of a split AI Visibility run but its last), the callbacks dated by the cycle, the Rank Tracker for one
// site, month and day keys in the website's time zone, the per-site run guard, the AI Pulse that skips each site's own cycle day, the
// crons that are gone - and that the on-demand path (the app / API Manual Runs with a domain) behaves exactly as it did.
// Called from scenarios_v5.js just before the report.
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 700), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 500))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const src = (f) => fs.readFileSync(path.join(CD, f), 'utf8');
  const kitOf = (file, name) => { const s = src(file); const a = s.indexOf('const ' + name + ' = (() => {'); const b = s.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(s.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const ST = kitOf('AI_Plan.js', 'ST'), CU = kitOf('Callback_Ledger_AI_.js', 'CU'), AIP = kitOf('AI_Requests.js', 'AIP');
  let WIRE = {}; try { WIRE = require('./catchup_wiring.json'); } catch (e) {}
  // a fixed clock for the code under test: `new Date()` / `Date.now()` answer `iso`, every other use of Date is the real one
  const RealDate = Date;
  const atNow = async (iso, fn) => { const t = RealDate.parse(iso);
    class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(t); } static now() { return t; } }
    global.Date = FakeDate; try { return await fn(); } finally { global.Date = RealDate; } };
  const ago = (n) => new Date(Date.now() - n * 864e5).toISOString();
  // the dispatcher's payload for one job (plan §14.2)
  const SID = 'site_techand-ai', DOM = 'techand.ai';
  const cyc = (job, o = {}) => { const date = o.date || '2026-10-21'; const sid = o.site_id || SID;
    const p = { trigger: 'cycle', domain: o.domain || DOM, site_id: sid, cycle_key: 'cyc:' + sid + ':' + date, job, monthly: !!o.monthly,
      scheduled_for: o.scheduled_for || (date + 'T02:00:00.000Z'), request_id: 'cyc_' + sid.replace(/^site_/, '') + '_' + date.replace(/-/g, '') + '_' + job };
    if (job === 'backlinks') p.light = !o.monthly;
    return { ...p, ...(o.extra || {}) }; };
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'g6_live.json.gz'))).toString('utf8'));
  const W = FX.weekly;

  // ===================================================================================================================================
  await guard('CS1 the website calendar kit', async () => {
    reset(); const SN = 'CS1 cycle semantics — the website\'s calendar (ST, v5/code/_site_time.js): local day / month / weekday in the website\'s zone, the cycle run read from a Manual Run, the cycle\'s date on its reports';
    begin(SN); const check = mkCheck(SN);
    check('the engine zone is baked in (America/New_York when GENERIC_TIMEZONE is unset) and an unknown or missing zone falls back to it', ST.ENGINE_TZ === 'America/New_York' && ST.zone('') === 'America/New_York' && ST.zone('Mars/Olympus') === 'America/New_York' && ST.zone('Asia/Dubai') === 'Asia/Dubai', ST.ENGINE_TZ);
    // 2026-10-31 21:00 New York (EDT, UTC-4) = 2026-11-01 01:00 UTC = 2026-11-01 05:00 Dubai
    const T = '2026-11-01T01:00:00.000Z';
    check('month keys follow the website\'s zone: the 31st at 21:00 in New York is still October there, November in UTC and in Dubai',
      ST.monthKey(T, 'America/New_York') === '2026-10' && T.slice(0, 7) === '2026-11' && ST.monthKey(T, 'Asia/Dubai') === '2026-11', JSON.stringify([ST.monthKey(T, 'America/New_York'), ST.monthKey(T, 'Asia/Dubai')]));
    check('day keys and weekdays follow it too (Saturday 31 Oct in New York, Sunday 1 Nov in Dubai)', ST.dayKey(T, 'America/New_York') === '2026-10-31' && ST.weekday(T, 'America/New_York') === 6 && ST.dayKey(T, 'Asia/Dubai') === '2026-11-01' && ST.weekday(T, 'Asia/Dubai') === 0,
      JSON.stringify([ST.dayKey(T, 'America/New_York'), ST.weekday(T, 'America/New_York'), ST.dayKey(T, 'Asia/Dubai'), ST.weekday(T, 'Asia/Dubai')]));
    check('across the European clock change (25 Oct 2026, London) the local date is right on both sides', ST.dayKey('2026-10-24T23:30:00.000Z', 'Europe/London') === '2026-10-25' && ST.dayKey('2026-10-25T23:30:00.000Z', 'Europe/London') === '2026-10-25',
      JSON.stringify([ST.dayKey('2026-10-24T23:30:00.000Z', 'Europe/London'), ST.dayKey('2026-10-25T23:30:00.000Z', 'Europe/London')]));
    check('the weekday of a calendar date needs no zone; a malformed one is -1', ST.weekdayOfDate('2026-10-21') === 3 && ST.weekdayOfDate('2026-10-19') === 1 && ST.weekdayOfDate('21/10/2026') === -1, '');
    check('a cycle is dated "Week of Wed 21 Oct" and its day is said "every Wednesday"; with no day, "each week"', ST.weekOf('2026-10-21') === 'Week of Wed 21 Oct' && ST.everyText(3) === 'every Wednesday' && ST.everyText(null) === 'each week' && ST.everyText(9) === 'each week', ST.weekOf('2026-10-21'));
    const rows = [{ site_id: SID, domain: DOM, tz: 'Asia/Dubai', cycle_weekday: 3 }, { site_id: 'site_b', domain: 'b.example', tz: 'not/a zone', cycle_weekday: '' }, { error: 'x' }];
    check('the website\'s cycle row is found by site id or by domain (www and scheme ignored); its zone and weekday are read; a bad zone is the engine\'s, an empty weekday is none',
      ST.tzOf(rows, { site_id: SID }) === 'Asia/Dubai' && ST.tzOf(rows, { domain: 'https://www.techand.ai/' }) === 'Asia/Dubai' && ST.cycleWeekday(rows, { domain: DOM }) === 3
      && ST.tzOf(rows, { site_id: 'site_b' }) === 'America/New_York' && ST.cycleWeekday(rows, { site_id: 'site_b' }) === null && ST.tzOf(rows, { site_id: 'site_none' }) === 'America/New_York' && ST.cycleWeekday([], { site_id: SID }) === null, '');
    const c = ST.cycleOf(cyc('ai_visibility', { monthly: true }));
    check('a cycle run is read from its Manual Run: the key, the local due date, the job, monthly, the due time and request id, and its label',
      c && c.key === 'cyc:site_techand-ai:2026-10-21' && c.date === '2026-10-21' && c.job === 'ai_visibility' && c.monthly === true && c.scheduled_for === '2026-10-21T02:00:00.000Z' && c.request_id === 'cyc_techand-ai_20261021_ai_visibility' && c.label === 'Week of Wed 21 Oct', JSON.stringify(c));
    check('monthly as text is read as the dispatcher meant it ("false" is false), light only when given', ST.cycleOf({ trigger: 'cycle', cycle_key: 'cyc:s:2026-10-21', monthly: 'false' }).monthly === false && ST.cycleOf({ trigger: 'cycle', cycle_key: 'cyc:s:2026-10-21', monthly: 'true', light: 'false' }).monthly === true
      && ST.cycleOf({ trigger: 'cycle', cycle_key: 'cyc:s:2026-10-21' }).light === null && ST.cycleOf({ trigger: 'cycle', cycle_key: 'cyc:s:2026-10-21', light: true }).light === true, '');
    check('nothing else is a cycle run: an on-demand start, a catch-up start, a batch start', ST.cycleOf({ domain: DOM }) === null && ST.cycleOf({ trigger: 'catchup', scheduled_for: 'x' }) === null && ST.cycleOf({}) === null && ST.cycleOf(null) === null, '');
    check('the fields a cycle callback carries (plan §14.2), and none for any other run', JSON.stringify(ST.callbackFields(c)) === JSON.stringify({ trigger: 'cycle', cycle_key: c.key, cycle_date: '2026-10-21', cycle_week: 'Week of Wed 21 Oct', cycle_job: 'ai_visibility' }) && JSON.stringify(ST.callbackFields(null)) === '{}', JSON.stringify(ST.callbackFields(c)));
    // CU.lateRun (v5/code/_catchup.js): a cycle job is late only past the cycle's normal span
    const L0 = CU.lateRun({ trigger: 'cycle', scheduled_for: '2026-10-21T02:00:00.000Z', started_at: '2026-10-21T03:30:00.000Z', tz: 'Asia/Dubai' });
    const L1 = CU.lateRun({ trigger: 'cycle', scheduled_for: '2026-10-21T02:00:00.000Z', started_at: '2026-10-21T08:05:00.000Z', tz: 'Asia/Dubai' });
    const L2 = CU.lateRun({ trigger: 'catchup', scheduled_for: '2026-10-21T02:00:00.000Z', started_at: '2026-10-21T03:30:00.000Z', why: 'n8n restarted', kind: 'daily' });
    const L3 = CU.lateRun({ trigger: '', started_at: '2026-10-21T08:05:00.000Z' });
    check('CU.lateRun: a cycle job 90 min after its cycle was due is the cycle\'s normal pace (its jobs run one after the other), not late; the same start for a catch-up slot IS late (30 min)',
      L0.late === false && L0.via === 'cycle' && L0.late_min === 90 && L2.late === true && L2.via === 'catchup', JSON.stringify([L0, L2.late]));
    check('CU.lateRun: past ' + CU.CYCLE_LATE_MIN + ' min a cycle job is late, worded as the website\'s cycle in its own zone; an on-demand run is never late',
      CU.CYCLE_LATE_MIN === 180 && L1.late === true && L1.late_min === 365 && /run of this website's weekly cycle that was due Wed 21 Oct 2026, 06:00 \(Asia\/Dubai\)/.test(L1.text) && L3.late === false && L3.via === 'on_demand', JSON.stringify(L1));
  });

  // ===================================================================================================================================
  // AI Visibility: the fixture of execution 776 (techand.ai, 8 questions); `full` = this UTC month already had its full run
  const loadAI = (o = {}) => {
    reset();
    mock('Load Sites', items((W['Load Sites'] || []).map(r => ({ ...r, ...(o.site || {}) })))); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Profiles', items(W['Load Profiles']));
    mock('Load Monitors', items([{ ...W['Load Monitors'][0], ...(o.monitors || {}) }])); mock('Load AI Prompts', items(o.prompts || W['Load AI Prompts']));
    const fullAt = o.full === false ? ago(40) : new Date(Date.now() - 60000).toISOString();
    mock('Load AI Visibility', items((W['Load AI Visibility'] || []).map((r, i, a) => ({ ...r, checked_at: i === a.length - 1 ? fullAt : ago(45 + i), run_kind: i === a.length - 1 ? 'full' : 'weekly' }))));
    mock('Load AI Daily', items([])); mock('Load Cache (AI)', items([...(W['Load Cache (AI)'] || []), ...(o.cache || [])])); mock('Load Query History', items([])); mock('Load AI Run Answers', items(o.runAnswers || []));
    if (o.trigger) mock('Manual Run', [{ json: o.trigger }]); else delete store['Manual Run'];
  };
  const aiPlan = async (o) => { loadAI(o); return (await run('AI Plan', [{ json: {} }])).map(i => i.json); };

  await guard('CS2 AI Visibility as a cycle job', async () => {
    reset(); const SN = 'CS2 cycle semantics — AI Visibility: one site, on_demand false, the switched-off job and the paused site honoured, the monthly full run only from `monthly`, the cycle carried, and the on-demand path exactly as before';
    begin(SN); const check = mkCheck(SN);
    const m1 = (await aiPlan({ trigger: cyc('ai_visibility', { monthly: true }), full: true }))[0];
    check('a monthly cycle job is the full run (Claude, the brand question, the market index) although this UTC month already had one - the dispatcher decides, not the calendar',
      m1.site_id === SID && m1.on_demand === false && m1.full_due === true && m1.run_kind === 'full' && m1.index_due === true && m1.monthly_engines.includes('claude') && m1.cycle && m1.cycle.key === 'cyc:site_techand-ai:2026-10-21' && m1.request_id === 'cyc_techand-ai_20261021_ai_visibility',
      JSON.stringify({ od: m1.on_demand, full: m1.full_due, kind: m1.run_kind, idx: m1.index_due, cycle: m1.cycle && m1.cycle.key, rid: m1.request_id }));
    const m0 = (await aiPlan({ trigger: cyc('ai_visibility', { monthly: false }), full: false }))[0];
    check('any other cycle job is the weekly run although this UTC month has had NO full run yet (the UTC rule would have made it full)',
      m0.on_demand === false && m0.full_due === false && m0.run_kind === 'weekly' && m0.index_due === false && m0.cycle && m0.cycle.monthly === false, JSON.stringify({ full: m0.full_due, kind: m0.run_kind }));
    const mkt1 = (await aiPlan({ trigger: cyc('ai_visibility', { monthly: true }), full: true }))[0], mkt0 = (await aiPlan({ trigger: cyc('ai_visibility', { monthly: false }), full: false }))[0];
    check('the market view follows `monthly` too (never the stored month of the last one)', (mkt1.market_due === !!mkt1.topics.length) && mkt0.market_due === false, JSON.stringify([mkt1.market_due, mkt1.topics.length, mkt0.market_due]));
    const off = (await aiPlan({ trigger: cyc('ai_visibility'), monitors: { ai_visibility: false } }))[0];
    check('AI visibility switched off for the site: the cycle job runs nothing and says why', off.nothing_to_do === true && /switched off for techand\.ai/.test(off.reason) && off.cycle && off.cycle.key, JSON.stringify(off));
    const paused = (await aiPlan({ trigger: cyc('ai_visibility'), site: { status: 'paused' } }))[0];
    check('a paused website: the cycle job runs nothing and says it is paused', paused.nothing_to_do === true && /is paused/.test(paused.reason), JSON.stringify(paused));
    const unknown = (await aiPlan({ trigger: cyc('ai_visibility', { domain: 'unknown-site.example', site_id: 'site_unknown-site-example' }) }))[0];
    check('a website nobody tracks is never checked ad hoc by a cycle job (the dispatcher only knows tracked websites)', unknown.nothing_to_do === true && /no tracked website matches/.test(unknown.reason), JSON.stringify(unknown));
    // ---- the on-demand path: exactly as before ----
    const od = (await aiPlan({ trigger: { domain: DOM, request_id: 'app-1', callback_url: 'https://app.example.test/hook', email: 'o@x.test' }, full: true }))[0];
    const odOff = (await aiPlan({ trigger: { domain: DOM, request_id: 'app-2' }, monitors: { ai_visibility: false } }))[0];
    const odPaused = (await aiPlan({ trigger: { domain: DOM, request_id: 'app-3' }, site: { status: 'paused' } }))[0];
    const odAdhoc = (await aiPlan({ trigger: { domain: 'unknown-site.example', request_id: 'app-4', country: 'United Arab Emirates' } }))[0];
    check('on demand (the app / API with a domain): on_demand true, always the full run, the caller\'s callback and e-mail, no cycle', od.on_demand === true && od.full_due === true && od.run_kind === 'on_demand' && od.callback_url === 'https://app.example.test/hook' && od.email === 'o@x.test' && od.request_id === 'app-1' && od.cycle === null,
      JSON.stringify({ od: od.on_demand, kind: od.run_kind, cb: od.callback_url, cycle: od.cycle }));
    check('on demand still ignores the off switch and the pause (the owner asked), and checks an untracked domain ad hoc', !odOff.nothing_to_do && odOff.on_demand === true && !odPaused.nothing_to_do && odPaused.on_demand === true && !odAdhoc.nothing_to_do && odAdhoc.adhoc === true && odAdhoc.domain === 'unknown-site.example',
      JSON.stringify([odOff.nothing_to_do, odPaused.nothing_to_do, odAdhoc.adhoc]));
    const batch = (await aiPlan({ full: true }));
    check('a start that names no site is the batch run over every site, with the UTC month rule (the month had its full run: weekly)', batch.length >= 1 && batch.every(p => p.on_demand === false && p.cycle === null) && batch[0].full_due === false && batch[0].run_kind === 'weekly', JSON.stringify(batch.map(p => [p.domain, p.run_kind])));
  });

  // ===================================================================================================================================
  // the ledger row of every workflow: `cycle:<cycle_key>:<job>` with the site's domain, the old keys for every other run
  const ledgerRow = async (tag, planNode, planItems, trigger, o = {}) => {
    reset();
    mock(planNode, items(planItems));
    if (trigger) mock(o.entry || 'Manual Run', [{ json: trigger }]);
    return (await run('Run Ledger Row (' + tag + ')', [{ json: { id: 'tbl' } }], { code: (o.prefix || '') + 'Run_Ledger_Row_' + tag + '_' }))[0].json;
  };
  await guard('CS3 the ledger key of a cycle job', async () => {
    reset(); const SN = 'CS3 cycle semantics — every weekly workflow keys its run-ledger row cycle:<cycle_key>:<job> with the website\'s domain (the dispatcher\'s done signal); every other run keeps its key';
    begin(SN); const check = mkCheck(SN);
    const K = 'cyc:site_techand-ai:2026-10-21';
    const JOBS = [['AI', 'AI Plan', 'ai_visibility', [{ site_id: SID, domain: DOM, chunk: { no: 1, final_expected: true } }]], ['BL', 'BL Plan', 'backlinks', [{ site_id: SID, domain: DOM, mode: 'light' }]],
      ['Tracker', 'Tracker Plan', 'rank_tracker', [{ domain: DOM, keyword: 'a' }, { domain: DOM, keyword: 'b' }, { domain: 'www.techand.ai', keyword: 'c' }].map(x => ({ ...x, domain: x.domain.replace(/^www\./, '') }))],
      ['Site', 'Site Plan', 'site_tracker', [{ site_id: SID, domain: DOM }]], ['Growth', 'Growth Plan', 'ai_growth', [{ site_id: SID, domain: DOM }]], ['LB', 'LB Plan', 'link_builder', [{ site_id: SID, domain: DOM }]],
      ['Audit', 'Audit Schedule Plan', 'audit', [{ site_id: SID, domain: DOM, run: true }]], ['Cadence', 'Cadence Plan', 'content_cadence', [{ site_id: SID, domain: DOM }]]];
    const got = [];
    for (const [tag, plan, job, rows] of JOBS) { const r = await ledgerRow(tag, plan, rows, cyc(job)); got.push([tag, r.key, r.domain, r.mode]); }
    check('all eight weekly workflows (AI Visibility, Backlinks, Rank Tracker, Site Tracker, AI Growth, Content Cadence, Link Builder, the Audit Scheduler) key a cycle job cycle:<cycle_key>:<job> and name the website',
      got.every(([tag, key, dom], i) => key === 'cycle:' + K + ':' + JOBS[i][2] && dom === DOM), JSON.stringify(got));
    check('the Rank Tracker of one website names it although its plan emits one item per keyword check', got.find(g => g[0] === 'Tracker')[2] === DOM, JSON.stringify(got.find(g => g[0] === 'Tracker')));
    check('the Audit Scheduler\'s job is `audit` (its mode stays audit_schedule)', got.find(g => g[0] === 'Audit')[1] === 'cycle:' + K + ':audit' && got.find(g => g[0] === 'Audit')[3] === 'audit_schedule', JSON.stringify(got.find(g => g[0] === 'Audit')));
    const prev = await ledgerRow('Cadence', 'Cadence Plan', [{ site_id: SID, domain: DOM }], cyc('preview'));
    check('the cadence\'s "Coming up" preview 48 h before a cycle is its own job: cycle:<cycle_key>:preview', prev.key === 'cycle:' + K + ':preview', prev.key);
    const nothing = await ledgerRow('BL', 'BL Plan', [{ nothing_to_do: true, reason: 'paused' }], cyc('backlinks'));
    check('a cycle job whose plan had nothing to do still writes its own key with the website (so the dispatcher sees it done, not missing)', nothing.key === 'cycle:' + K + ':backlinks' && nothing.domain === DOM && nothing.est_usd === 0 && nothing.dfs_est_usd === 0, JSON.stringify(nothing));
    // ---- every other run: unchanged ----
    const sched = await ledgerRow('BL', 'BL Plan', [{ site_id: SID, domain: DOM }, { site_id: 'site_b', domain: 'b.example' }], null);
    const one = await ledgerRow('BL', 'BL Plan', [{ site_id: SID, domain: DOM }], null);
    const parent = await ledgerRow('BL', 'BL Plan', [{ site_id: SID, domain: DOM }], { domain: DOM, parent_run_id: '773' });
    const odNoParent = await ledgerRow('BL', 'BL Plan', [{ site_id: SID, domain: DOM }], { domain: DOM });
    const pulse = await ledgerRow('Pulse', 'AI Plan', [{ site_id: SID, domain: DOM }, { site_id: 'site_b', domain: 'b.example' }], null, { prefix: 'Pulse__' });
    const watch = await ledgerRow('Watch', 'Watch Plan', [{ site_id: SID, domain: DOM }], {}, { entry: 'Watch Run' });
    check('a batch run keeps schedule:<mode> with no domain (two sites) or its one site; an on-demand run started by the front door keeps parent:<id>; the daily pulse and page watch keep theirs',
      sched.key === 'schedule:backlinks' && sched.domain === '' && one.key === 'schedule:backlinks' && one.domain === DOM && parent.key === 'parent:773' && odNoParent.key === 'schedule:backlinks' && odNoParent.domain === DOM
      && pulse.key === 'schedule:ai_pulse' && pulse.domain === '' && watch.key === 'schedule:page_watch', JSON.stringify([sched.key, sched.domain, one.domain, parent.key, odNoParent.key, pulse.key, pulse.domain, watch.key]));
  });

  // ===================================================================================================================================
  await guard('CS4 a split AI Visibility run settles the cycle once', async () => {
    reset(); const SN = 'CS4 cycle semantics — a 500-question AI Visibility cycle job runs in several executions: every part but the last is keyed cycle:<key>:ai_visibility:part<n>, the cycle travels through every continuation (and a resume by the pulse), and only the LAST execution settles cycle:<key>:ai_visibility';
    begin(SN); const check = mkCheck(SN);
    const CLUS = ['e-invoicing', 'erp implementation', 'vat compliance', 'corporate tax', 'payroll software', 'inventory management', 'crm for b2b', 'business intelligence', 'cloud migration', 'ai consulting'];
    const panel = [{ prompt_id: 'cs_brand', site_id: SID, domain: DOM, prompt: 'What is Tech& (techand.ai) and what does it offer?', kind: 'brand', topic: 'brand', keyword: 'techand', source: 'auto', status: 'active', created_at: ago(30), stage: 'brand', cluster: 'brand', volume: null, origin: 'writer', updated_at: ago(30), persona: '', market: 'AE-en', pinned: false, fit_note: '' }];
    for (let i = 0; i < 499; i++) panel.push({ prompt_id: 'cs_' + String(i).padStart(3, '0'), site_id: SID, domain: DOM, prompt: 'Which providers offer ' + CLUS[i % 10] + ' in the UAE for a company of ' + (i + 5) + ' staff?', kind: 'recommend', topic: CLUS[i % 10], keyword: CLUS[i % 10] + ' uae ' + i,
      source: 'auto', status: 'active', created_at: ago(30), stage: 'consideration', cluster: CLUS[i % 10], volume: 50, origin: 'writer', updated_at: ago(30), persona: '', market: 'AE-en', pinned: false, fit_note: '' });
    const MON = { ai_prompts_max: 500 };
    const T1 = cyc('ai_visibility', { monthly: true });
    const p1 = (await aiPlan({ trigger: T1, monitors: MON, prompts: panel, full: true }))[0];
    check('part 1 of a cycle job: the first chunk of a new run (not the last), monthly from the dispatcher, the cycle carried', p1.chunk && p1.chunk.no === 1 && p1.chunk.final_expected === false && p1.full_due === true && p1.cycle && p1.cycle.key === T1.cycle_key && p1.on_demand === false,
      JSON.stringify({ chunk: p1.chunk && { no: p1.chunk.no, final: p1.chunk.final_expected, total: p1.chunk.total_est, size: p1.chunk.size }, cycle: p1.cycle }));
    mock('AI Plan', [{ json: p1 }]); mock('Manual Run', [{ json: T1 }]);
    const r1 = (await run('Run Ledger Row (AI)', [{ json: {} }], { code: 'Run_Ledger_Row_AI_' }))[0].json;
    check('part 1 is keyed cycle:<key>:ai_visibility:part1 - a part that finished is never read as the job finished', r1.key === 'cycle:' + T1.cycle_key + ':ai_visibility:part1' && r1.domain === DOM, r1.key);
    // the chain as n8n runs it: each execution asks its chunk, stores the answers, hands off (state + the start of the next part), until the
    // execution that knows it is the last. Every part keys its ledger row by its number; only the last one settles the cycle's key.
    let answers = [], trig = T1, plan = p1, h1 = null, st1 = null, cache = [], keys = [], firstHandoff = null;
    const answerOf = (q, runId) => ({ site_id: SID, run_id: runId, prompt_id: q.prompt_id, engine: q.engine, answered: true, cost: 0.004, error: '' });
    for (let part = 1; part <= 8; part++) {
      if (part > 1) plan = (await aiPlan({ trigger: trig, monitors: MON, prompts: panel, full: true, cache, runAnswers: answers }))[0];
      mock('AI Plan', [{ json: plan }]); mock('Manual Run', [{ json: trig }]);
      const row = (await run('Run Ledger Row (AI)', [{ json: {} }], { code: 'Run_Ledger_Row_AI_' }))[0].json;
      keys.push({ part, key: row.key, final: plan.chunk.final_expected, going: plan.chunk.going, full: plan.full_due, cycle: plan.cycle && plan.cycle.key, run_id: plan.run_id });
      if (plan.chunk.final_expected) break;
      const reqs = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(q => q.prompt_id && q.engine);
      const now = reqs.map(q => answerOf(q, plan.run_id)); answers = answers.concat(now);
      mock('Apply Analysis', items(now));
      delete store['Discovery Requests']; delete store['Run Discovery']; delete store['Analyst Jobs']; delete store['Prompt Jobs'];
      h1 = (await run('AI Chunk Handoff', [{ json: {} }])).map(i => i.json)[0]; st1 = JSON.parse(h1.state_row.value);
      if (!firstHandoff) firstHandoff = { h: h1, st: st1 };
      cache = [{ ...h1.state_row, value: JSON.stringify({ ...st1, updated_at: new Date().toISOString() }) }];
      trig = h1.next; if (!trig) break;
    }
    console.log('   split run ->', JSON.stringify(keys));
    const H1 = firstHandoff.h, S1 = firstHandoff.st;
    check('the hand-off keeps the cycle in the run\'s state and starts part 2 as a cycle run of the SAME cycle (trigger, key, job, monthly, due time) beside continue_run',
      H1.final === false && S1.cycle && S1.cycle.key === T1.cycle_key && S1.cycle.monthly === true && H1.next && H1.next.trigger === 'cycle' && H1.next.cycle_key === T1.cycle_key && H1.next.job === 'ai_visibility'
      && H1.next.monthly === true && H1.next.scheduled_for === T1.scheduled_for && H1.next.continue_run === p1.run_id && H1.next.parent_run_id === 'test-exec' && H1.next.request_id === T1.request_id, JSON.stringify(H1.next));
    const last = keys[keys.length - 1], parts = keys.slice(0, -1);
    check('every execution is the same run of the same cycle, keeps the monthly full run from the state, and every part but the last is keyed …:part<n>',
      keys.length >= 2 && keys.every(k => k.run_id === p1.run_id && k.full === true && k.cycle === T1.cycle_key) && keys.slice(1).every(k => k.going === true)
      && parts.every(k => k.final === false && k.key === 'cycle:' + T1.cycle_key + ':ai_visibility:part' + k.part), JSON.stringify(keys));
    check('the LAST execution settles cycle:<key>:ai_visibility - the dispatcher\'s done signal, written exactly once', last.final === true && last.key === 'cycle:' + T1.cycle_key + ':ai_visibility'
      && keys.filter(k => k.key === 'cycle:' + T1.cycle_key + ':ai_visibility').length === 1, JSON.stringify(last));
    st1 = S1; h1 = H1;
    // a chain that broke: the pulse resumes it as a run of its cycle
    reset();
    mock('Load Cache (AI)', [{ json: { ...h1.state_row, value: JSON.stringify({ ...st1, updated_at: ago(0.1) }) } }]);
    const res = (await run('AI Run Resume', [{ json: {} }], { code: 'Pulse__AI_Run_Resume' })).map(i => i.json);
    check('the AI Pulse\'s safety net resumes a silent cycle run AS a run of its cycle, so its last execution still settles the cycle\'s key',
      res.length === 1 && res[0].trigger === 'cycle' && res[0].cycle_key === T1.cycle_key && res[0].job === 'ai_visibility' && res[0].monthly === true && res[0].continue_run === p1.run_id, JSON.stringify(res));
    // an on-demand split run keeps its on-demand semantics through its continuations (no cycle appears)
    const od1 = (await aiPlan({ trigger: { domain: DOM, request_id: 'app-9', parent_run_id: '900' }, monitors: MON, prompts: panel }))[0];
    mock('AI Plan', [{ json: od1 }]); mock('Manual Run', [{ json: { domain: DOM, request_id: 'app-9', parent_run_id: '900' } }]);
    const odReqs = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(q => q.prompt_id && q.engine);
    mock('Apply Analysis', items(odReqs.map(q => answerOf(q, od1.run_id))));
    const hod = (await run('AI Chunk Handoff', [{ json: {} }])).map(i => i.json)[0];
    check('an on-demand split run stays on demand: no cycle in its state or in the start of its next part, which keeps its parent key', od1.cycle === null && hod.next && !hod.next.trigger && !hod.next.cycle_key && JSON.parse(hod.state_row.value).cycle === null && JSON.parse(hod.state_row.value).on_demand === true,
      JSON.stringify(hod.next));
  });

  // ===================================================================================================================================
  // the run guard of a scheduled workflow (After Run Ledger, LEDGER_RESUME_JS + RG)
  const gateRun = async (tag, planNode, plan, trigger, ledger, mine, o = {}) => {
    reset();
    mock(planNode, items(plan)); mock('Load Open Runs (' + tag + ')', items(ledger)); mock('Load Catch-up Records (' + tag + ')', [{ json: {} }]);
    mock('Reserve Run Ledger (' + tag + ')', [{ json: mine }]); mock('Run Ledger Row (' + tag + ')', [{ json: mine }]);
    if (trigger) mock(o.entry || 'Manual Run', [{ json: trigger }]);
    return (await run('After Run Ledger (' + tag + ')', [{ json: {} }], { code: (o.prefix || '') + 'After_Run_Ledger_' + tag + '_' })).map(i => i.json);
  };
  await guard('CS5 the run guard per website', async () => {
    reset(); const SN = 'CS5 cycle semantics — the run guard: two websites\' runs of one job both go ahead, the same website twice is refused (and the dispatcher retries it), a capacity refusal of a cycle job is never "skipped", the daily batch keeps the mode-only rule';
    begin(SN); const check = mkCheck(SN);
    const now = (m) => new Date(Date.now() - m * 60000).toISOString();
    const live = (id, dom, mode) => ({ id, run_id: 'e' + id, key: 'cycle:cyc:x:2026-10-21:ai_visibility', mode: mode || 'ai_visibility', status: 'reserved', created_at: now(10), domain: dom });
    const mine = { id: 50, run_id: 'test-exec', key: 'cycle:cyc:site_techand-ai:2026-10-21:ai_visibility', mode: 'ai_visibility', status: 'reserved', created_at: now(0), domain: DOM };
    const P = [{ site_id: SID, domain: DOM }];
    const two = await gateRun('AI', 'AI Plan', P, cyc('ai_visibility'), [live(10, 'example.org')], mine);
    check('another website\'s AI Visibility job in flight does not refuse this one (a 7-day cycle per website: they are not twins)', !two[0].run_refused && two[0].site_id === SID, JSON.stringify(two[0]).slice(0, 300));
    const same = await gateRun('AI', 'AI Plan', P, cyc('ai_visibility'), [live(10, 'www.techand.ai')], mine);
    check('the same website\'s AI Visibility still in flight is refused - same_mode, marked retry, the dispatcher starts it again, the reason first in the row\'s basis',
      same[0].run_refused === true && same[0].reason === 'same_mode' && same[0].retry === true && same[0].cycle_key === 'cyc:site_techand-ai:2026-10-21' && /for techand\.ai/.test(same[0].refusal) && /starts it again in a few minutes/.test(same[0].refusal)
      && /^refused before any spending \(same_mode\): /.test(same[0].cost_basis) && same[0].callback_url === '', JSON.stringify(same[0]).slice(0, 500));
    const batchLive = await gateRun('AI', 'AI Plan', P, cyc('ai_visibility'), [live(10, '')], mine);
    check('a live run over every site (no domain on its row) is the twin of any run of its mode', batchLive[0].run_refused === true && batchLive[0].reason === 'same_mode', JSON.stringify(batchLive[0]).slice(0, 200));
    const crowd = await gateRun('AI', 'AI Plan', P, cyc('ai_visibility'), [live(10, 'a.example', 'backlinks'), live(11, 'b.example', 'rank_tracker'), live(12, 'c.example', 'site_tracker')], mine);
    check('too many analyses at once: a cycle job is retried by the dispatcher, never "skipped" (that would cost the website its week)',
      crowd[0].run_refused === true && crowd[0].reason === 'too_many_open' && crowd[0].retry === true && /retried by the dispatcher in a few minutes/.test(crowd[0].refusal) && !/skipped/.test(crowd[0].refusal)
      && /^refused before any spending \(too_many_open\): /.test(crowd[0].cost_basis), JSON.stringify(crowd[0].refusal));
    const crowdBatch = await gateRun('AI', 'AI Plan', P, null, [live(10, 'a.example', 'backlinks'), live(11, 'b.example', 'rank_tracker'), live(12, 'c.example', 'site_tracker')], { ...mine, domain: '' });
    check('the same crowd for a run with no dispatcher behind it keeps today\'s words: skipped, the next one goes ahead', crowdBatch[0].run_refused === true && crowdBatch[0].retry === false && /this scheduled run is skipped/.test(crowdBatch[0].refusal), JSON.stringify(crowdBatch[0].refusal));
    // on demand: per website too (a domain on its trigger), and the caller is told
    const odOther = await gateRun('BL', 'BL Plan', [{ site_id: SID, domain: DOM }], { domain: DOM, callback_url: 'https://app.example.test/h', request_id: 'r1' }, [live(10, 'example.org', 'backlinks')], { ...mine, mode: 'backlinks', key: 'schedule:backlinks' });
    const odSame = await gateRun('BL', 'BL Plan', [{ site_id: SID, domain: DOM }], { domain: DOM, callback_url: 'https://app.example.test/h', request_id: 'r1' }, [live(10, DOM, 'backlinks')], { ...mine, mode: 'backlinks', key: 'schedule:backlinks' });
    check('an on-demand backlinks check for one website goes ahead beside another website\'s; the same website twice is refused and its caller is told (R116)',
      !odOther[0].run_refused && odSame[0].run_refused === true && odSame[0].reason === 'same_mode' && odSame[0].retry === false && odSame[0].callback_url === 'https://app.example.test/h' && odSame[0].on_demand === true, JSON.stringify(odSame[0]).slice(0, 300));
    const bySid = await gateRun('Site', 'Site Plan', [{ site_id: SID, domain: DOM }], { site_id: SID, on_demand: true }, [live(10, DOM, 'site_tracker')], { ...mine, mode: 'site_tracker', key: 'schedule:site_tracker', domain: DOM });
    check('a start that names its website by site_id is per website too (the domain comes from its own row)', bySid[0].run_refused === true && bySid[0].reason === 'same_mode' && bySid[0].site === DOM, JSON.stringify(bySid[0]).slice(0, 200));
    // the daily batch pulse: mode only, as before
    const pmine = { id: 50, run_id: 'test-exec', key: 'schedule:ai_pulse', mode: 'ai_pulse', status: 'reserved', created_at: now(0), domain: '' };
    const pulse = await gateRun('Pulse', 'AI Plan', [{ site_id: SID, domain: DOM }, { site_id: 'site_b', domain: 'b.example' }], null, [{ ...live(10, 'other.example', 'ai_pulse'), key: 'schedule:ai_pulse' }], pmine, { prefix: 'Pulse__' });
    check('the daily batch AI Pulse keeps the mode-only twin rule: another pulse in flight refuses it whatever site its row names', pulse[0].run_refused === true && pulse[0].reason === 'same_mode' && pulse[0].site === '', JSON.stringify(pulse[0]).slice(0, 200));
  });

  // ===================================================================================================================================
  // the Rank Tracker for one website (it never read its Manual Run)
  const lad = (dom, id, kw, rung, page, extra) => ({ id: rung * 10 + page, ladder_id: id, domain: dom, head_keyword: id === 'lad_a' ? 'peppol uae' : 'erp dubai', rung, page_no: page, keyword: kw, page_type: 'Guide',
    target_url: 'https://' + dom + '/' + kw.replace(/\s+/g, '-') + '/', page_exists: true, status: 'published', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: 'o@' + dom, callback_url: 'https://hooks.example.test/' + dom, request_id: 'r-' + id, ...(extra || {}) });
  const LADS = [lad(DOM, 'lad_a', 'peppol uae', 4, 1), lad(DOM, 'lad_a', 'peppol access point uae', 1, 2), lad('example.org', 'lad_b', 'erp dubai', 4, 1), lad('example.org', 'lad_b', 'erp software dubai', 1, 2)];
  const SITES = [{ site_id: SID, domain: DOM, status: 'active', location_code: 2784, language_code: 'en', country: 'United Arab Emirates', keywords: 'e invoicing uae', email: '', callback_url: 'https://hooks.example.test/t' },
    { site_id: 'site_example-org', domain: 'example.org', status: 'active', location_code: 2784, language_code: 'en', country: 'United Arab Emirates', keywords: 'erp consultants dubai', email: '', callback_url: 'https://hooks.example.test/e' }];
  const tracker = async (trigger, o = {}) => {
    reset();
    mock('Load Ladders', items(o.ladders || LADS)); mock('Load History', items([])); mock('Load Content Log (Tracker)', items([])); mock('Load Pages (Tracker)', items([]));
    mock('Load Sites (Tracker)', items(o.sites || SITES)); mock('Load Monitors (Tracker)', items([])); mock('Load AI Brands (Tracker)', items([]));
    if (trigger) mock('Manual Run', [{ json: trigger }]); else delete store['Manual Run'];
    return (await run('Tracker Plan', [{ json: {} }])).map(i => i.json);
  };
  await guard('CS6 the Rank Tracker for one website', async () => {
    reset(); const SN = 'CS6 cycle semantics — the Rank Tracker reads its Manual Run: a cycle job and an on-demand start check ONE website (its ladders and its own keyword list), keep the caps, and a cycle job honours a paused website; a start that names none checks every website';
    begin(SN); const check = mkCheck(SN);
    const all = await tracker(null);
    const doms = (xs) => [...new Set(xs.filter(x => !x.nothing_to_do).map(x => x.domain))].sort();
    check('no site named: every website\'s ladders and keyword lists are checked (the old weekly batch)', JSON.stringify(doms(all)) === JSON.stringify(['example.org', 'techand.ai']) && all.every(x => x.scope && x.scope.all_sites === true && x.cycle === null), JSON.stringify(doms(all)));
    const cy = await tracker(cyc('rank_tracker'));
    check('a cycle job of techand.ai checks techand.ai only - its ladder pages and its own keyword list - and carries the cycle and its request id',
      JSON.stringify(doms(cy)) === JSON.stringify(['techand.ai']) && cy.some(x => x.ladder_id === 'lad_a') && cy.some(x => x.watch_keyword && x.keyword === 'e invoicing uae') && !cy.some(x => x.ladder_id === 'lad_b' || x.keyword === 'erp consultants dubai')
      && cy.every(x => x.cycle && x.cycle.key === 'cyc:site_techand-ai:2026-10-21' && x.on_demand === false && x.request_id === 'cyc_techand-ai_20261021_rank_tracker' && x.scope.domain === DOM && x.scope.cycle === true), JSON.stringify(cy.map(x => [x.domain, x.keyword, x.request_id])));
    const od = await tracker({ domain: 'https://www.example.org/' });
    check('an on-demand start for example.org checks example.org only, with its ladders\' own request ids and callbacks', JSON.stringify(doms(od)) === JSON.stringify(['example.org']) && od.every(x => x.on_demand === true && x.cycle === null)
      && od.filter(x => x.ladder_id === 'lad_b').every(x => x.request_id === 'r-lad_b' && x.callback_url === 'https://hooks.example.test/example.org'), JSON.stringify(od.map(x => [x.domain, x.request_id])));
    const bySid = await tracker({ site_id: 'site_example-org' });
    check('…named by its site id too', JSON.stringify(doms(bySid)) === JSON.stringify(['example.org']), JSON.stringify(doms(bySid)));
    const virtual = await tracker({ site_id: 'site_virtual-example' }, { ladders: [...LADS, lad('virtual.example', 'lad_v', 'cloud uae', 4, 1)] });
    check('…including a website known only from its ladder (no seo_sites row): the id every engine derives from the domain', JSON.stringify(doms(virtual)) === JSON.stringify(['virtual.example']), JSON.stringify(doms(virtual)));
    const paused = await tracker(cyc('rank_tracker'), { sites: SITES.map(s => s.site_id === SID ? { ...s, status: 'paused' } : s) });
    check('a cycle job of a paused website checks nothing and says why', paused.length === 1 && paused[0].nothing_to_do === true && /is paused/.test(paused[0].reason) && paused[0].scope.paused === true && paused[0].domain === DOM, JSON.stringify(paused[0]).slice(0, 300));
    const odPaused = await tracker({ domain: DOM }, { sites: SITES.map(s => s.site_id === SID ? { ...s, status: 'paused' } : s) });
    check('an on-demand start of a paused website still checks its ladder (the owner asked) - its own keyword list stays paused, as it always was', odPaused.some(x => x.ladder_id === 'lad_a') && !odPaused.some(x => x.watch_keyword), JSON.stringify(odPaused.map(x => x.keyword)));
    const none = await tracker(cyc('rank_tracker', { domain: 'nothing.example', site_id: 'site_nothing-example' }));
    check('a website with no ladder and no keyword list: nothing to check, said plainly', none.length === 1 && none[0].nothing_to_do === true && /no keyword ladder and no keyword list/.test(none[0].reason), JSON.stringify(none[0]).slice(0, 300));
    const many = []; for (let i = 0; i < 140; i++) many.push(lad(DOM, 'lad_' + (i % 10), 'kw ' + i, (i % 10) === 0 ? 4 : 1, i, { status: 'published' }));
    const capped = await tracker(cyc('rank_tracker'), { ladders: [...many, ...LADS.slice(2)] });
    check('the caps stay: at most 15 keywords a ladder and 120 checks a run, for one website as for all', capped.length <= 120 && capped.every(x => x.domain === DOM), capped.length);
  });

  // ===================================================================================================================================
  const siteLoads = (o = {}) => {
    reset();
    mock('Load Sites', items(o.sites || [{ site_id: SID, domain: DOM, status: 'active', keywords: 'peppol uae', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.test/s', created_at: ago(30), last_run_at: ago(7) },
      { site_id: 'site_example-org', domain: 'example.org', status: 'active', keywords: 'erp dubai', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.test/e', created_at: ago(30), last_run_at: ago(7) }]));
    for (const n of ['Load Ladders', 'Load Rank History', 'Load Site Metrics', 'Load Query History', 'Load Content Log', 'Load Console Alerts', 'Load Monitors (Site)']) mock(n, items([]));
    mock('Load Check-ins', items(o.checkins || [])); mock('Load Cycles', items(o.cycles || []));
    if (o.trigger) mock('Manual Run', [{ json: o.trigger }]); else mock('Manual Run', {});
  };
  await guard('CS7 the Site Tracker as a cycle job', async () => {
    reset(); const SN = 'CS7 cycle semantics — the Site Tracker: one website with scheduled semantics (a paused website honoured), the check-in month in the website\'s own zone, its weekly day named, and the "Track my site" on-demand start as before';
    begin(SN); const check = mkCheck(SN);
    siteLoads({ trigger: cyc('site_tracker'), cycles: [{ site_id: SID, domain: DOM, tz: 'Asia/Dubai', cycle_weekday: 3 }] });
    const c = (await run('Site Plan', [{ json: {} }])).map(i => i.json);
    check('a cycle job: techand.ai only, on_demand false, the cycle\'s request id, its zone and "every Wednesday"', c.length === 1 && c[0].domain === DOM && c[0].on_demand === false && c[0].request_id === 'cyc_techand-ai_20261021_site_tracker'
      && c[0].cycle && c[0].cycle.key === 'cyc:site_techand-ai:2026-10-21' && c[0].tz === 'Asia/Dubai' && c[0].cycle_weekday === 3 && c[0].every_week === 'every Wednesday', JSON.stringify(c.map(x => [x.domain, x.on_demand, x.request_id, x.tz, x.every_week])));
    siteLoads({ trigger: cyc('site_tracker'), sites: [{ site_id: SID, domain: DOM, status: 'paused', keywords: '', email: '', callback_url: 'x' }] });
    const p = (await run('Site Plan', [{ json: {} }]))[0].json;
    check('a paused website: the cycle job tracks nothing and says why', p.nothing_to_do === true && /is paused/.test(p.reason) && p.cycle && p.cycle.key, JSON.stringify(p));
    siteLoads({ trigger: { site_id: SID, domain: DOM, on_demand: true, request_id: 'trk-1' }, sites: [{ site_id: SID, domain: DOM, status: 'paused', keywords: '', email: '', callback_url: 'x' }] });
    const od = (await run('Site Plan', [{ json: {} }])).map(i => i.json);
    check('"Track my site" (on demand) still reports a paused website at once, with its own request id and no cycle', od.length === 1 && od[0].on_demand === true && od[0].request_id === 'trk-1' && od[0].cycle === null && od[0].every_week === 'each week', JSON.stringify(od.map(x => [x.on_demand, x.request_id])));
    siteLoads({});
    const batch = (await run('Site Plan', [{ json: {} }])).map(i => i.json);
    check('no site named: every active website, scheduled semantics', batch.length === 2 && batch.every(x => x.on_demand === false && x.cycle === null), JSON.stringify(batch.map(x => x.domain)));
    // the check-in month in the website's zone: a check-in submitted at 21:00 New York on 31 Oct is October's answer (stored month: November, the UTC month)
    const ck = { id: 1, site_id: SID, domain: DOM, month: '2026-11', manual_action: false, security_issue: false, notes: 'all good', coverage_json: '{}', not_indexed_total: 0, csv_kind: 'none', submitted_at: '2026-11-01T01:00:00.000Z', source: 'form', is_test: false };
    const due = async (now, tz) => atNow(now, async () => { siteLoads({ trigger: cyc('site_tracker'), checkins: [ck], cycles: [{ site_id: SID, domain: DOM, tz, cycle_weekday: 6 }] }); return (await run('Site Plan', [{ json: {} }]))[0].json; });
    const nyOct = await due('2026-11-01T02:00:00.000Z', 'America/New_York');   // still 31 Oct 22:00 in New York
    const nyNov = await due('2026-11-07T12:00:00.000Z', 'America/New_York');
    const dxNov = await due('2026-11-07T12:00:00.000Z', 'Asia/Dubai');
    check('the check-in reminder counts the website\'s own month: answered for October in New York that evening, due again in November there; in Dubai the same check-in answers November',
      nyOct.local_month === '2026-10' && nyOct.checkin_due === false && nyNov.local_month === '2026-11' && nyNov.checkin_due === true && dxNov.local_month === '2026-11' && dxNov.checkin_due === false,
      JSON.stringify([[nyOct.local_month, nyOct.checkin_due], [nyNov.local_month, nyNov.checkin_due], [dxNov.local_month, dxNov.checkin_due]]));
    const odd = await atNow('2026-10-20T12:00:00.000Z', async () => { siteLoads({ trigger: cyc('site_tracker'), checkins: [{ ...ck, month: '2026-09', submitted_at: '2026-10-02T09:00:00.000Z' }] }); return (await run('Site Plan', [{ json: {} }]))[0].json; });
    check('a row whose stored month is not its submission\'s UTC month was given that month on purpose and keeps it (September here: October is still due)', odd.checkin_due === true && odd.last_checkin && odd.last_checkin.month === '2026-09', JSON.stringify([odd.checkin_due, odd.last_checkin && odd.last_checkin.month]));
  });

  // ===================================================================================================================================
  await guard('CS8 Backlinks, Link Builder, AI Growth and the audit as cycle jobs', async () => {
    reset(); const SN = 'CS8 cycle semantics — Backlinks full only on the monthly cycle, Link Builder\'s pitches per page counted in the website\'s month, AI Growth\'s Wikidata check only on the monthly cycle (else monthly in the website\'s calendar), the audit only on a monthly cycle';
    begin(SN); const check = mkCheck(SN);
    const S1 = [{ site_id: SID, domain: DOM, status: 'active', keywords: 'peppol uae', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: 'o@techand.ai', callback_url: 'https://hooks.example.test/x' }];
    const MON1 = [{ site_id: SID, domain: DOM, ai_visibility: true, backlinks: true, audit_monthly: true, link_builder: true, ai_growth: true, competitors: 'cleartax.com' }];
    const base = (o = {}) => { reset();
      mock('Load Sites', items(o.sites || S1)); mock('Load Ladders', items([])); mock('Load Monitors', items(o.monitors || MON1)); mock('Load Profiles', items([]));
      if (o.trigger) mock('Manual Run', [{ json: o.trigger }]); else delete store['Manual Run']; };
    // ---- Backlinks ----
    const blRun = async (trigger, snaps) => { base({ trigger }); for (const n of ['Load Link Prospects', 'Load Content Log', 'Load Case Studies', 'Load Backlinks', 'Load Link Imports', 'Load AI Visibility (BL)', 'Load Cache (BL Rivals)']) mock(n, items([]));
      mock('Load Backlink Snapshots', items(snaps || [])); return (await run('BL Plan', [{ json: {} }])).map(i => i.json); };
    const fullThisMonth = [{ site_id: SID, checked_at: new Date(Date.now() - 60000).toISOString(), mode: 'full', competitors_json: '[]' }];
    const b1 = (await blRun(cyc('backlinks', { monthly: true }), fullThisMonth))[0], b0 = (await blRun(cyc('backlinks', { monthly: false }), []))[0];
    const bl = (await blRun(cyc('backlinks', { monthly: true, extra: { light: true } }), []))[0];
    check('Backlinks: the monthly cycle is the full report although this UTC month had one; any other cycle is light although this month had none; `light: true` keeps it light',
      b1.mode === 'full' && b1.on_demand === false && b0.mode === 'light' && b0.on_demand === false && bl.mode === 'light' && b1.cycle && b1.cycle.key === 'cyc:site_techand-ai:2026-10-21', JSON.stringify([b1.mode, b0.mode, bl.mode]));
    const bOff = (await (async () => { base({ trigger: cyc('backlinks'), monitors: [{ ...MON1[0], backlinks: false }] }); for (const n of ['Load Link Prospects', 'Load Content Log', 'Load Case Studies', 'Load Backlinks', 'Load Link Imports', 'Load Backlink Snapshots']) mock(n, items([])); return (await run('BL Plan', [{ json: {} }])).map(i => i.json); })())[0];
    check('Backlinks switched off for the site: the cycle job runs nothing, with the reason', bOff.nothing_to_do === true && /backlink monitor is switched off for techand\.ai/.test(bOff.reason), JSON.stringify(bOff));
    const bOd = (await blRun({ domain: DOM, light: true }, []))[0], bOdF = (await blRun({ domain: DOM }, fullThisMonth))[0];
    check('Backlinks on demand: full unless `light`, as before', bOd.mode === 'light' && bOd.on_demand === true && bOdF.mode === 'full' && bOdF.cycle === null, JSON.stringify([bOd.mode, bOdF.mode]));
    // ---- Link Builder: pitches per page in the website's month ----
    const lbRun = async (trigger, outreach, cycles) => { base({ trigger }); for (const n of ['Load Link Prospects', 'Load Backlinks', 'Load Backlink Snapshots', 'Load Content Log', 'Load AI Targets', 'Load Query History', 'Load Rank History', 'Load Cache (Links)', 'Load Pages (LB)', 'Load AI Visibility (LB)', 'Load Cache (LB Rivals)', 'Load Listings', 'Load Link Impact']) mock(n, items([]));
      mock('Load Link Outreach', items(outreach)); mock('Load Cycles', items(cycles || [])); return (await run('LB Plan', [{ json: {} }])).map(i => i.json); };
    const HOME = 'https://techand.ai/';
    const pitch = { site_id: SID, prospect_domain: 'x.example', target_url: HOME, drafted_at: '2026-11-01T01:30:00.000Z' };   // 31 Oct 21:30 in New York
    const lbNy = await atNow('2026-11-01T02:00:00.000Z', async () => (await lbRun(cyc('link_builder'), [pitch], [{ site_id: SID, tz: 'America/New_York', cycle_weekday: 6 }]))[0]);
    const lbDx = await atNow('2026-11-01T02:00:00.000Z', async () => (await lbRun(cyc('link_builder'), [pitch], [{ site_id: SID, tz: 'Asia/Dubai', cycle_weekday: 0 }]))[0]);
    const lbNyNov = await atNow('2026-11-02T15:00:00.000Z', async () => (await lbRun(cyc('link_builder'), [pitch], [{ site_id: SID, tz: 'America/New_York', cycle_weekday: 1 }]))[0]);
    const homeOf = (p) => (p.pages || []).find(x => x.kind === 'home') || {};
    check('Link Builder: a pitch drafted at 21:30 on 31 Oct in New York counts for October there (and for November in Dubai); in New York\'s November the page has no pitch this month',
      lbNy.month === '2026-10' && homeOf(lbNy).pitched === 1 && lbDx.month === '2026-11' && homeOf(lbDx).pitched === 1 && lbNyNov.month === '2026-11' && homeOf(lbNyNov).pitched === 0 && lbNy.on_demand === false && lbNy.cycle,
      JSON.stringify([[lbNy.month, homeOf(lbNy).pitched], [lbDx.month, homeOf(lbDx).pitched], [lbNyNov.month, homeOf(lbNyNov).pitched]]));
    // ---- AI Growth: Wikidata ----
    const grRun = async (trigger, prevEntityAt, cycles) => { base({ trigger }); for (const n of ['Load AI Visibility', 'Load AI Prompts', 'Load Content Log', 'Load Query History', 'Load AI Pages', 'Load AI Targets', 'Load Link Prospects (Growth)', 'Load AI Answers', 'Load Cache (Growth)']) mock(n, items([]));
      mock('Load AI Growth', items(prevEntityAt ? [{ site_id: SID, checked_at: prevEntityAt, entity_json: JSON.stringify({ checked_at: prevEntityAt, found: false }) }] : [])); mock('Load Cycles', items(cycles || []));
      return (await run('Growth Plan', [{ json: {} }])).map(i => i.json); };
    const g1 = (await grRun(cyc('ai_growth', { monthly: true }), new Date(Date.now() - 60000).toISOString()))[0], g0 = (await grRun(cyc('ai_growth', { monthly: false }), null))[0];
    check('AI Growth: the Wikidata check runs on the monthly cycle although it ran this month, and not on any other cycle although it never ran - the dispatcher decides',
      g1.entity_due === true && g1.on_demand === false && g0.entity_due === false && g1.cycle && g1.cycle.key === 'cyc:site_techand-ai:2026-10-21', JSON.stringify([g1.entity_due, g0.entity_due]));
    const gNy = await atNow('2026-11-01T02:00:00.000Z', async () => (await grRun(null, '2026-10-05T12:00:00.000Z', [{ site_id: SID, tz: 'America/New_York' }]))[0]);
    const gDx = await atNow('2026-11-01T02:00:00.000Z', async () => (await grRun(null, '2026-10-05T12:00:00.000Z', [{ site_id: SID, tz: 'Asia/Dubai' }]))[0]);
    check('AI Growth outside a cycle: the Wikidata check is monthly in the WEBSITE\'s calendar - not yet due at 22:00 on 31 Oct in New York, due in Dubai where it is already November',
      gNy.entity_due === false && gDx.entity_due === true, JSON.stringify([gNy.entity_due, gDx.entity_due]));
    const gOff = (await (async () => { base({ trigger: cyc('ai_growth'), monitors: [{ ...MON1[0], ai_growth: false }] }); for (const n of ['Load AI Visibility', 'Load AI Prompts', 'Load Content Log', 'Load Query History', 'Load AI Pages', 'Load AI Targets', 'Load AI Growth', 'Load Link Prospects (Growth)', 'Load AI Answers', 'Load Cache (Growth)', 'Load Cycles']) mock(n, items([])); return (await run('Growth Plan', [{ json: {} }])).map(i => i.json); })())[0];
    const gOd = (await (async () => { base({ trigger: { domain: DOM }, monitors: [{ ...MON1[0], ai_growth: false }] }); for (const n of ['Load AI Visibility', 'Load AI Prompts', 'Load Content Log', 'Load Query History', 'Load AI Pages', 'Load AI Targets', 'Load AI Growth', 'Load Link Prospects (Growth)', 'Load AI Answers', 'Load Cache (Growth)', 'Load Cycles']) mock(n, items([])); return (await run('Growth Plan', [{ json: {} }])).map(i => i.json); })())[0];
    check('AI Growth switched off: a cycle job runs nothing and says so; on demand it still runs (the owner asked) and re-checks Wikidata', gOff.nothing_to_do === true && /AI growth loop is switched off for techand\.ai/.test(gOff.reason) && !gOd.nothing_to_do && gOd.on_demand === true && gOd.entity_due === true, JSON.stringify([gOff, gOd.entity_due]));
    // ---- the audit: only on a monthly cycle ----
    const auRun = async (trigger) => { base({ trigger }); mock('Load Audits', items([])); return (await run('Audit Candidates', [{ json: {} }])).map(i => i.json); };
    const a0 = (await auRun(cyc('audit', { monthly: false })))[0], a1 = (await auRun(cyc('audit', { monthly: true })));
    check('the audit: a cycle that is not the website\'s monthly one audits nothing (and says so); its monthly cycle is a candidate - techand.ai only, on_demand false, the cycle\'s request id',
      a0.nothing_to_do === true && /monthly cycle/.test(a0.reason) && a1.length === 1 && a1[0].domain === DOM && a1[0].on_demand === false && a1[0].request_id === 'cyc_techand-ai_20261021_audit' && a1[0].cycle && a1[0].cycle.monthly === true, JSON.stringify([a0.reason, a1.map(x => [x.domain, x.on_demand, x.request_id])]));
    mock('Audit Candidates', items(a1)); mock('Load Cache (Audit)', items([]));
    const ap = (await run('Audit Schedule Plan', [{ json: { statusCode: 404, body: '' } }]))[0].json;
    check('…and a website never audited is audited on its first monthly cycle, the audit carrying the cycle\'s request id and `scheduled`', ap.run === true && /first monthly cycle/.test(ap.why) && ap.body && ap.body.request_id === 'cyc_techand-ai_20261021_audit' && ap.body.scheduled === true, JSON.stringify([ap.run, ap.why, ap.body && ap.body.request_id]));
    const aOd = (await auRun({ domain: DOM }));
    check('the audit on demand: a candidate whatever the cycle (it always audits)', aOd.length === 1 && aOd[0].on_demand === true && aOd[0].cycle === null, JSON.stringify(aOd.map(x => [x.on_demand, x.cycle])));
  });

  // ===================================================================================================================================
  await guard('CS9 the AI Pulse skips each website on its own cycle day', async () => {
    reset(); const SN = 'CS9 cycle semantics — the AI Pulse runs every day; a website is skipped on its own cycle day (its local weekday, its zone), Monday for a website with no cycle row; the rotation counts the six other mornings from that day and covers each question exactly as before; a start by hand is never skipped';
    begin(SN); const check = mkCheck(SN);
    const P = FX.pulse;
    const panel = [];
    for (let i = 0; i < 60; i++) panel.push({ prompt_id: 'cp_' + String(i).padStart(2, '0'), site_id: SID, domain: DOM, prompt: 'Which firms offer ' + ['e-invoicing', 'erp', 'vat', 'payroll'][i % 4] + ' in the UAE (variant ' + i + ')?', kind: 'recommend', topic: ['e-invoicing', 'erp', 'vat', 'payroll'][i % 4], keyword: 'kw ' + i, source: 'auto', status: 'active',
      created_at: ago(30), stage: 'consideration', cluster: ['e-invoicing', 'erp', 'vat', 'payroll'][i % 4], volume: 10, origin: 'writer', updated_at: ago(30), persona: '', market: 'AE-en', pinned: false, fit_note: '' });
    const pulse = async (now, o = {}) => atNow(now, async () => {
      reset();
      mock('Load Sites', items(P['Load Sites'])); mock('Load Ladders', items(P['Load Ladders'])); mock('Load Profiles', items(P['Load Profiles'])); mock('Load AI Visibility', items(P['Load AI Visibility'])); mock('Load AI Daily', items([])); mock('Load Cache (AI)', items(P['Load Cache (AI)']));
      mock('Load Monitors', items([{ ...P['Load Monitors'][0], ai_prompts_max: 60, ai_pulse_mode: 'sample', ai_pulse_per_week: 2 }])); mock('Load AI Prompts', items(panel));
      mock('Load Cycles', items(o.cycles || []));
      if (o.fired !== false) mock('Daily Schedule', [{ json: { timestamp: now } }]); else delete store['Daily Schedule'];
      if (o.trigger) mock('Manual Run', [{ json: o.trigger }]); else delete store['Manual Run'];
      return (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' })).map(i => i.json);
    });
    const THU = [{ site_id: SID, domain: DOM, tz: 'Asia/Dubai', cycle_weekday: 4 }];
    // Thursday 22 Oct 2026, 06:30 New York = 10:30 UTC = 14:30 Dubai (Thursday there too)
    const thu = await pulse('2026-10-22T10:30:00.000Z', { cycles: THU });
    check('a website whose cycle day is Thursday (Dubai) is skipped on the Thursday morning the schedule fires, with the reason', thu.length === 1 && thu[0].nothing_to_do === true && (thu[0].cycle_day_skipped || []).length === 1
      && /Thursday, 2026-10-22 in Asia\/Dubai\) is its weekly cycle day/.test(thu[0].cycle_day_skipped[0].why) && /weekly cycle today/.test(thu[0].reason), JSON.stringify(thu[0]).slice(0, 400));
    const mon = await pulse('2026-10-26T10:30:00.000Z', { cycles: THU });
    check('…and sampled on Monday (the old shared weekly day is an ordinary pulse morning for it now)', !mon[0].nothing_to_do && mon[0].prompts.length > 0 && mon[0].cycle_weekday === 4 && mon[0].cycle_weekday_known === true && mon[0].local_date === '2026-10-26' && mon[0].tz === 'Asia/Dubai',
      JSON.stringify({ n: mon[0].prompts && mon[0].prompts.length, cw: mon[0].cycle_weekday, d: mon[0].local_date }));
    const noRowMon = await pulse('2026-10-26T10:30:00.000Z'), noRowTue = await pulse('2026-10-27T10:30:00.000Z');
    check('a website with no cycle row keeps the Monday skip (in the engine zone) and is sampled on Tuesday', noRowMon[0].nothing_to_do === true && /Monday, the weekly day of a website with no cycle yet/.test(noRowMon[0].cycle_day_skipped[0].why) && !noRowTue[0].nothing_to_do && noRowTue[0].cycle_weekday === 1 && noRowTue[0].cycle_weekday_known === false,
      JSON.stringify([noRowMon[0].reason, noRowTue[0].cycle_weekday]));
    // the local date decides: 06:30 New York on Wednesday 21 Oct (10:30 UTC) is 00:30 on Thursday 22 Oct in Kiritimati (UTC+14)
    const kir = await pulse('2026-10-21T10:30:00.000Z', { cycles: [{ site_id: SID, domain: DOM, tz: 'Pacific/Kiritimati', cycle_weekday: 4 }] });
    const kirWed = await pulse('2026-10-21T10:30:00.000Z', { cycles: [{ site_id: SID, domain: DOM, tz: 'Pacific/Kiritimati', cycle_weekday: 3 }] });
    check('the website\'s LOCAL date decides: the Wednesday cron is already Thursday in Kiritimati, so a website there with a Thursday cycle is skipped and one with a Wednesday cycle is sampled',
      kir[0].nothing_to_do === true && /2026-10-22 in Pacific\/Kiritimati/.test(kir[0].cycle_day_skipped[0].why) && !kirWed[0].nothing_to_do && kirWed[0].local_date === '2026-10-22', JSON.stringify([kir[0].reason, kirWed[0].local_date]));
    const od = await pulse('2026-10-22T10:30:00.000Z', { cycles: THU, fired: false, trigger: { domain: DOM, request_id: 'app-p', callback_url: 'https://app.example.test/p' } });
    const byHand = await pulse('2026-10-22T10:30:00.000Z', { cycles: THU, fired: false });
    const catchup = await pulse('2026-10-22T10:30:00.000Z', { cycles: THU, fired: false, trigger: { trigger: 'catchup', scheduled_for: '2026-10-22T10:30:00.000Z' } });
    check('a start by hand is never skipped - on demand, or a test over every site - while the catch-up replaying the cron skips like the cron', !od[0].nothing_to_do && od[0].on_demand === true && !byHand[0].nothing_to_do && catchup[0].nothing_to_do === true, JSON.stringify([od[0].nothing_to_do, byHand[0].nothing_to_do, catchup[0].nothing_to_do]));
    // coverage over four weeks: every question on exactly per_week of each website-week's six pulse mornings, for a Thursday website and a Monday one
    const coverage = async (cycles, startIso) => {
      const weeks = [];
      for (let w = 0; w < 4; w++) { const cnt = new Map(); let mornings = 0;
        for (let d = 0; d < 7; d++) { const t = new Date(Date.parse(startIso) + (w * 7 + d) * 864e5).toISOString(); const out = await pulse(t, { cycles });
          if (out[0].nothing_to_do) continue; mornings++; for (const q of out[0].prompts) cnt.set(q.prompt_id, (cnt.get(q.prompt_id) || 0) + 1); }
        weeks.push({ mornings, asked: cnt.size, exact: [...cnt.values()].every(c => c === 2) }); }
      return weeks; };
    const thuWeeks = await coverage(THU, '2026-10-23T10:30:00.000Z');   // Friday after a Thursday cycle, four website-weeks
    const monWeeks = await coverage([], '2026-10-20T10:30:00.000Z');    // Tuesday after a Monday, four weeks (no cycle row)
    check('over four weeks a Thursday website gets six pulse mornings a week and every one of its 60 questions exactly twice a week - the same coverage a Monday website gets',
      thuWeeks.every(w => w.mornings === 6 && w.asked === 60 && w.exact) && monWeeks.every(w => w.mornings === 6 && w.asked === 60 && w.exact), JSON.stringify({ thu: thuWeeks, mon: monWeeks }));
    const pm = src('Pulse__Pulse_Metrics.js');
    check('the pulse mail names the weekly report by the website\'s day ("every Thursday"), "each week" without one, never "Monday"', /ST\.everyText\(p\.cycle_weekday\)/.test(pm) && !/report \(Monday\)/.test(pm), (pm.match(/The weekly AI visibility report[^<]{0,160}/) || [''])[0]);
    check('the cron is every day 06:30 now (the catch-up carries it so)', ((WIRE.schedules || []).find(s => s.id === 'SEOagentAIPulse1') || {}).cron === '30 6 * * *', JSON.stringify((WIRE.schedules || []).map(s => [s.id, s.cron])));
  });

  // ===================================================================================================================================
  await guard('CS9b the AI Pulse serves every website', async () => {
    reset(); const SN = 'CS9b the AI Pulse serves EVERY website each morning (F-ENG 2026-10-20): 40 websites in parts of at most 15 and one morning\'s request limit, each part handing the rest to the next, every website once';
    begin(SN); const check = mkCheck(SN);
    const P = FX.pulse;
    const pad = (i) => String(i).padStart(2, '0');
    const SITES = [], MONS = [], PROMPTS = [];
    for (let i = 0; i < 40; i++) {
      const sid = 'site_s' + pad(i) + '-com', dom = 's' + pad(i) + '.com', heavy = i < 10;   // ten websites with a 50-question panel: 150 requests a morning each
      SITES.push({ ...P['Load Sites'][0], site_id: sid, domain: dom, keywords: '' });
      MONS.push({ ...P['Load Monitors'][0], site_id: sid, domain: dom, competitors: '', brand_names: '', ai_prompts_max: heavy ? 50 : 8, ai_pulse: true });
      const n = heavy ? 50 : 8;
      for (let q = 0; q < n; q++) PROMPTS.push({ ...P['Load AI Prompts'][q % P['Load AI Prompts'].length], prompt_id: 'p_' + pad(i) + '_' + pad(q), site_id: sid, domain: dom,
        prompt: 'Which firms in the UAE offer service ' + q + ' of line ' + i + ' for mid-size companies?', topic: 'service line ' + q, keyword: 'service ' + q + ' uae', status: 'active', source: 'auto' });
    }
    const plan = async (now, trigger, fired) => atNow(now, async () => {
      reset();
      mock('Load Sites', items(SITES)); mock('Load Ladders', items([])); mock('Load Profiles', items(P['Load Profiles'])); mock('Load AI Visibility', items([])); mock('Load AI Daily', items([]));
      mock('Load Cache (AI)', items([])); mock('Load Monitors', items(MONS)); mock('Load AI Prompts', items(PROMPTS)); mock('Load Cycles', items([]));
      if (fired) mock('Daily Schedule', [{ json: { timestamp: now } }]); else delete store['Daily Schedule'];
      if (trigger) mock('Manual Run', [{ json: trigger }]); else delete store['Manual Run'];
      return (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' })).map(i => i.json);
    });
    // Tuesday 27 Oct 2026, 06:30 New York (a website with no cycle row keeps the Monday skip, so Tuesday is an ordinary pulse morning)
    const served = [], parts = [];
    let trig = null, guardN = 0;
    for (;;) {
      const out = await plan('2026-10-27T10:30:00.000Z', trig, !trig);
      const real = out.filter(o => !o.nothing_to_do);
      const req = real.reduce((t, o) => t + o.prompts.length * o.pulse_engines.length, 0);
      parts.push({ n: real.length, req, part: (out[0].pulse_part || {}).part, next: !!out[0].pulse_next, dates: [...new Set(real.map(o => o.date))] });
      served.push(...real.map(o => o.site_id));
      trig = out[0].pulse_next;
      if (!trig || ++guardN > 10) break;
    }
    const uniq = new Set(served);
    check('CS9b: every one of the 40 websites is served exactly once this morning (the pulse used to ask the first 15 and drop 25 in silence)',
      served.length === 40 && uniq.size === 40 && SITES.every(s => uniq.has(s.site_id)), JSON.stringify({ served: served.length, parts }));
    check('CS9b: no part holds more than 15 websites or more than one morning\'s request limit (' + AIP.LIMITS.pulse_max_requests + ' requests), and the heavy panels make the first parts smaller',
      parts.every(p => p.n <= 15 && p.req <= AIP.LIMITS.pulse_max_requests) && parts.length >= 4 && parts[0].n < 15, JSON.stringify(parts));
    check('CS9b: every part is the same morning (one date), numbered 1, 2, 3 ...; the last hands nothing on', parts.every((p, i) => p.part === i + 1 && p.dates.join() === '2026-10-27') && !parts[parts.length - 1].next && parts.slice(0, -1).every(p => p.next), JSON.stringify(parts));
    const first = await plan('2026-10-27T10:30:00.000Z', null, true);
    const nx = first[0].pulse_next || {};
    check('CS9b: the hand-off is the next execution\'s Manual Run: trigger pulse_part, this execution as parent_run_id (the run guard does not take its own reservation for a twin), the morning\'s date, the cursor, scheduled: true',
      nx.trigger === 'pulse_part' && nx.parent_run_id && nx.pulse_part && nx.pulse_part.date === '2026-10-27' && nx.pulse_part.part === 2 && nx.pulse_part.scheduled === true && /^site_s\d\d-com$/.test(nx.pulse_part.after), JSON.stringify(nx));
    // a later part still skips a website on its cycle day: `scheduled` travels with the chain
    const mondayNext = await plan('2026-10-26T10:30:00.000Z', { trigger: 'pulse_part', parent_run_id: '1', pulse_part: { date: '2026-10-26', after: 'site_s30-com', part: 3, scheduled: true } }, false);
    check('CS9b: a later part of a scheduled Monday still skips the websites whose weekly day it is (Monday for a website with no cycle row) - and only the websites after the cursor are looked at',
      mondayNext[0].nothing_to_do === true && (mondayNext[0].cycle_day_skipped || []).length === 9 && mondayNext[0].cycle_day_skipped.every(x => x.domain > 's30.com'), JSON.stringify(mondayNext[0]).slice(0, 300));
    const nextSrc = (() => { try { return src('Pulse__Next_Pulse_Part.js'); } catch (e) { return ''; } })();
    check('CS9b: the generated pulse starts its next part (Next Pulse Part reads AI Plan\'s pulse_next; its later parts do not resume AI visibility runs again)',
      /pulse_next/.test(nextSrc) && /pulse_part/.test(src('Pulse__AI_Run_Resume.js')), nextSrc.slice(0, 200));
  });
  // ===================================================================================================================================
  await guard('CS10 a cycle run\'s callback is dated by its cycle', async () => {
    reset(); const SN = 'CS10 cycle semantics — every callback of a cycle run carries trigger: cycle, cycle_key, cycle_date and is dated "Week of …" in its subject and HTML; every other run\'s callback is unchanged; a cycle job hours late says so';
    begin(SN); const check = mkCheck(SN);
    const SETTLED = { run_id: '901', status: 'done', settled_usd: 0.05, cost_mode: 'ai_visibility', dfs_usd: 0.14, dfs_measured: true, ai_usd: 0.05, ai_measured: true, ai_measured_usd: 0.05, ai_source: 'priced', ai_basis: 'measured', settled_at: '2026-10-21T03:10:00.000Z', dfs_source: 'tasks', cost_basis: 'x' };
    const CB = { status: 'progress', stage: 'ai_visibility', request_id: 'cyc_techand-ai_20261021_ai_visibility', domain: DOM, subject: '[AI visibility] techand.ai - named in 12% of AI answers', html: '<html><body><h1>AI visibility</h1></body></html>', callback_url: 'https://app.example.test/hook' };
    const cbRun = async (trigger, tag = 'AI', code = 'Callback_Ledger_AI_') => { reset(); if (trigger) mock('Manual Run', [{ json: trigger }]); return (await run('Callback Ledger (' + tag + ')', [{ json: CB }, { json: SETTLED }], { code }))[0].json; };
    const c = await cbRun({ ...cyc('ai_visibility'), started_at: '2026-10-21T02:40:00.000Z' });
    check('a cycle run\'s callback: trigger cycle, cycle_key, cycle_date (the local due date), cycle_week, and the settled run_ledger as before',
      c.trigger === 'cycle' && c.cycle_key === 'cyc:site_techand-ai:2026-10-21' && c.cycle_date === '2026-10-21' && c.cycle_week === 'Week of Wed 21 Oct' && c.cycle_job === 'ai_visibility' && c.run_ledger && c.run_ledger.settled === true, JSON.stringify(c).slice(0, 400));
    check('its report is dated by the cycle, never by a Monday: "· Week of Wed 21 Oct" on the subject and one line first in the HTML; on time (40 min after the due time), not "ran late"',
      /· Week of Wed 21 Oct$/.test(c.subject) && /<body><p class="cycle-week"[^>]*>Week of Wed 21 Oct: this website's weekly cycle\.<\/p><h1>/.test(c.html) && !c.ran_late && !/Monday/.test(c.subject + c.html), JSON.stringify([c.subject, c.html.slice(0, 200)]));
    const late = await cbRun({ ...cyc('ai_visibility'), started_at: '2026-10-21T08:30:00.000Z' });
    check('a cycle job that started 6.5 h after its cycle was due carries ran_late (the cycle\'s words) as well as its cycle date', late.ran_late && late.ran_late.late === true && late.ran_late.via === 'cycle' && /weekly cycle that was due/.test(late.ran_late.text) && /\(ran late — due 2026-10-21\)$/.test(late.subject) && late.cycle_key, JSON.stringify(late.ran_late));
    const od = await cbRun({ domain: DOM, request_id: 'app-1' });
    const batch = await cbRun(null);
    check('an on-demand or batch run\'s callback is exactly as before: no cycle fields, the subject and HTML untouched', !('trigger' in od) && !('cycle_key' in od) && od.subject === CB.subject && od.html === CB.html && !('cycle_key' in batch) && batch.subject === CB.subject, JSON.stringify([od.subject, Object.keys(od)]));
    const site = await cbRun(cyc('site_tracker'), 'Site', 'Callback_Ledger_Site_'), bl = await cbRun(cyc('backlinks'), 'BL', 'Callback_Ledger_BL_'), tr = await cbRun(cyc('rank_tracker'), 'Tracker', 'Callback_Ledger_Tracker_');
    check('the Site Tracker\'s, the Backlink Monitor\'s and the Rank Tracker\'s callbacks carry the cycle the same way (one Callback Ledger code for every workflow)', [site, bl, tr].every(x => x.trigger === 'cycle' && x.cycle_date === '2026-10-21' && /Week of Wed 21 Oct/.test(x.subject)), JSON.stringify([site.cycle_job, bl.cycle_job, tr.cycle_job]));
    // the reports' own words: the website's day where it is known, "each week" where it is not - never "Monday"
    const code = (f) => src(f).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');   // what a customer can read: the code, not the comments of the kits it inlines
    const BLR = code('BL_Report.js'), GR = code('Growth_Report.js'), SR = code('Site_Report.js'), PC = code('Publish_Check.js'), PCK = code('Parse_Check-in.js'), BTR = code('Build_Track_Response.js');
    check('engine wording: the backlink, AI growth, site, publish-check, check-in and "Track my site" texts no longer say Monday to a customer',
      ![BLR, GR, SR, PC, PCK, BTR].some(t => /Every Monday|every Monday|on Monday|the Monday report|Monday content run|\(Monday\)/.test(t))
      && /ST\.everyText\(ST\.weekdayOfDate\(s\.cycle\.date\)\)/.test(BLR) && /planOf\(m\.site_id\)\.every_week/.test(SR) && /next weekly report/.test(PC) && /the weekly report keeps asking/.test(PCK) && /on the weekday tracking started/.test(BTR),
      'Monday still in: ' + [['BL_Report', BLR], ['Growth_Report', GR], ['Site_Report', SR], ['Publish_Check', PC], ['Parse_Checkin', PCK], ['Build_Track_Response', BTR]].filter(([, t]) => /Monday/.test(t)).map(([n]) => n).join(', '));
  });

  // ===================================================================================================================================
  await guard('CS11 no weekly cron left', async () => {
    reset(); const SN = 'CS11 cycle semantics — the seven weekly workflows and the Audit Scheduler have no Schedule Trigger (build section 98 fails a build that puts one back), each starts from its Manual Run into a plan that reads the cycle run, and the catch-up keeps the two daily crons';
    begin(SN); const check = mkCheck(SN);
    const CW = WIRE.cycle_workflows || {};
    const WANT = { SEOagentAIVisib1: 'AI Plan', SEOagentBacklnk1: 'BL Plan', SEOagentTracker1: 'Tracker Plan', SEOagentSiteTrk1: 'Site Plan', SEOagentAIGrow1: 'Growth Plan', SEOagentCadence1: 'Cadence Plan', SEOagentLinkBld1: 'LB Plan', SEOagentAuditSc1: 'Audit Candidates' };
    check('the eight workflows the cycle runs, each with its Manual Run and its plan node (proved on the generated graph by build section 98)', Object.keys(WANT).every(id => CW[id] && CW[id].plan === WANT[id] && CW[id].manual_run === 'Manual Run') && Object.keys(CW).length === 8, JSON.stringify(CW));
    check('every weekly workflow that posts a report posts the cycle fields (a POST of the whole item, or an explicit body that spreads trigger / cycle_key / cycle_date - build section 98 proves each body)',
      Object.entries(CW).every(([id, w]) => id === 'SEOagentAuditSc1' ? (w.callback_posts || []).length === 0 : (w.callback_posts || []).length === 1)
      && (CW.SEOagentTracker1 || {}).callback_posts[0] === 'POST Progress' && (CW.SEOagentCadence1 || {}).callback_posts[0] === 'POST Cadence Note', JSON.stringify(Object.entries(CW).map(([id, w]) => [id, w.callback_posts])));
    check('the catch-up replays the two daily crons and nothing else; the Cycle Dispatcher\'s own sweep is never replayed', JSON.stringify((WIRE.schedules || []).map(s => s.id).sort()) === JSON.stringify(['SEOagentAIPulse1', 'SEOagentPageWch1']) && JSON.stringify(WIRE.daily_crons) === JSON.stringify(['SEOagentAIPulse1', 'SEOagentPageWch1']) && JSON.stringify(WIRE.not_replayed) === JSON.stringify(['SEOagentCycleDsp']),
      JSON.stringify({ s: (WIRE.schedules || []).map(s => s.id), d: WIRE.daily_crons, n: WIRE.not_replayed }));
    const gates = { AI: 'After_Run_Ledger_AI_.js', BL: 'After_Run_Ledger_BL_.js', Tracker: 'After_Run_Ledger_Tracker_.js', Site: 'After_Run_Ledger_Site_.js', Growth: 'After_Run_Ledger_Growth_.js', Cadence: 'After_Run_Ledger_Cadence_.js', LB: 'After_Run_Ledger_LB_.js', Audit: 'After_Run_Ledger_Audit_.js' };
    const sched = Object.entries(gates).map(([t, f]) => [t, (src(f).match(/const __SCHED = [^;]*;/) || [''])[0]]);
    check('no weekly gate carries a schedule any more (const __SCHED = {}): no timer of theirs exists to fire late', sched.every(([, s]) => s === 'const __SCHED = {};'), JSON.stringify(sched));
    check('the AI Pulse and the Page Watch gates still carry theirs (the delayed-timer refusal R94 built stays for them)', /"cron": "30 6 \* \* \*"/.test(src('Pulse__After_Run_Ledger_Pulse_.js')) && /"cron": "45 5 \* \* \*"/.test(src('After_Run_Ledger_Watch_.js')), '');
    const plans = { 'AI_Plan.js': 1, 'BL_Plan.js': 1, 'Tracker_Plan.js': 1, 'Site_Plan.js': 1, 'Growth_Plan.js': 1, 'LB_Plan.js': 1, 'Audit_Candidates.js': 1 };
    check('every plan node of the seven reads the cycle run through ST.cycleOf (the cadence\'s is Cadence_Plan.js)', Object.keys(plans).every(f => /ST\.cycleOf\(/.test(src(f)) && /const ST = \(\(\) => \{/.test(src(f))), Object.keys(plans).filter(f => !/ST\.cycleOf\(/.test(src(f))).join(', '));
    check('every Callback Ledger reads the cycle and dates its report by it', ['Callback_Ledger_AI_.js', 'Callback_Ledger_BL_.js', 'Callback_Ledger_Site_.js', 'Callback_Ledger_Tracker_.js', 'Callback_Ledger_Growth_.js', 'Callback_Ledger_LB_.js', 'Callback_Ledger_Cadence_.js', 'Pulse__Callback_Ledger_Pulse_.js'].every(f => /ST\.cycleOf\(__trig\)/.test(src(f)) && /cycleMark\(/.test(src(f))), '');
  });
};
