// PS1-PS8 (P1, 2026-11-12, prod review S1-01 / S1-05, plans/P1_page_concurrency.md): page runs take a writing slot.
// On 2026-11-12 the Content Cadence started three page runs of one website within 11 seconds (executions 13063-13065); all three ran into the
// time limit at 90-100% done, none was delivered, and their content-log rows kept saying `started`. Every check runs the GENERATED code
// (harness/code_v4) or the wiring the build recorded (ledger_wiring.json `page_slot`), and fails on the code before the fix:
//   PS1 the decision (RG.pageSlot): 0 / 1 / 2 writing, first come first served, the race pair, stale and old rows, my own row, other runs,
//       the override (0 / 3), give up at 6 h, the hand-off at 40 min, the estimate, fail open; RG.isPage, RG.handoffOf, RG.isStale.
//   PS2 the ledger row: a page run's row is `waiting` with page / request_id / keyword / queued_at; every other run's is `reserved` with
//       empty page fields, in the table's exact columns; the monitor and Keyword Check rows carry the same columns.
//   PS3 the Page Slot node: the look count ($runIndex) decides the customer notes, the override row, the callback body.
//   PS4 the wiring: the gate between Input OK? and the run, the saved Wait, the hand-off, every starter of the main workflow.
//   PS5 the clocks and counts: a flipped row's clock, live runs ignore waiting rows, Rate Limit counts a hand-off once and a waiting row once.
//   PS6 the Cycle Dispatcher: a waiting row of a dead run is read and released (status_was), a waiting n8n execution is not, the page it
//       was writing is freed (exact keys only).
//   PS7 the refusal path: the slot's reason reaches the caller, the run's own started row becomes failed, the AI question is queued again.
//   PS8 the Content Cadence counts a started page as in flight for 8 h; the hand-off payload and Normalize Input's slot_handoff.
// Called from scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path'); const { fakeN8nApi } = require('./fake_n8n_api');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const T = (s) => typeof s === 'number' ? s : Date.parse(s), ISO = (t) => new Date(T(t)).toISOString(), MIN = 60000, H1 = 3600000;
  const TELLS = /[—–“”‘’…]/;
  const TC = require('./table_cols.json');
  let LW = {}; try { LW = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger_wiring.json'), 'utf8')).page_slot || {}; } catch (e) { LW = {}; }
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function(body + '\nreturn { ' + names.join(', ') + ' };')(); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const NOW = '2026-11-12T01:30:00.000Z';
  const page = (id, status, created, x) => ({ id, run_id: String(13000 + id), key: 'cadence:site_northwind-erp-com', mode: 'keyword', status, created_at: ISO(created), page: true, request_id: 'cad_' + id, keyword: 'kw ' + id, queued_at: ISO(created), ...(x || {}) });
  const mineRow = (id, created, x) => ({ id, run_id: String(13000 + id), created_at: ISO(created), queued_at: ISO(created), page: true, status: 'waiting', ...(x || {}) });

  // ===================================================================================
  await guard('PS1 page slot decision', async () => {
    const SN = 'PS1 P1 - the writing-slot decision (RG.pageSlot): at most two pages are written at once, first come first served, and a run that cannot get a slot waits, hands its wait on, or gives up with nothing charged'; reset(); begin(SN); const check = mkCheck(SN);
    const { RG } = kits('Page_Slot.js', ['RG']);
    const P = (rows, mine, x) => RG.pageSlot({ rows, mine, now: NOW, limit: 2, ...(x || {}) });
    const me = mineRow(20, NOW);
    check('RG.PAGE: 2 at once, a look every 120 s, 6 h at most, the 2 h run limit, 20 min a page, a hand-off after 40 min, 12 hand-offs at most; the override key',
      eq(RG.PAGE, { limit: 2, poll_seconds: 120, max_wait_hours: 6, run_hours: 2, page_minutes: 20, handoff_minutes: 40, max_hops: 12 }) && RG.PAGE_KEY === 'slots:page' && RG.PAGE.run_hours === RG.STALE_HOURS, J(RG.PAGE));
    const r0 = P([], me), r1 = P([page(1, 'reserved', T(NOW) - 5 * MIN)], me), r2 = P([page(1, 'reserved', T(NOW) - 5 * MIN), page(2, 'reserved', T(NOW) - 4 * MIN)], me);
    check('nothing writing: admitted; one writing: admitted; two writing: waits (the 2026-11-12 third page)', r0.slot === 'admit' && r1.slot === 'admit' && r2.slot === 'wait' && r2.running === 2 && r2.ahead === 0, J([r0.slot, r1.slot, r2.slot, r2.basis]));
    check('the waiting note says why, how many, when, and that nothing is charged; no em dash, curly quote or ellipsis',
      /^Your page is waiting for a writing slot\. Pages are written 2 at a time: 2 pages are being written now and 0 are ahead of yours\. It starts as soon as a slot is free, in about 40 minutes\. Nothing is charged while it waits\.$/.test(r2.note)
      && r2.eta_minutes === 40 && !TELLS.test(r2.note) && /^A writing slot is free: your page is being written now \(about 20 minutes\)\.$/.test(r0.note), r2.note);
    // FIFO: one writing, one waiting that joined before me -> I wait; one waiting that joined after me -> I go first
    const early = page(5, 'waiting', T(NOW) - 2 * MIN), late = page(30, 'waiting', T(NOW) + 1000);
    const f1 = P([page(1, 'reserved', T(NOW) - 5 * MIN), early], me), f2 = P([page(1, 'reserved', T(NOW) - 5 * MIN), late], me);
    check('first come, first served: a run that joined the line earlier goes first (I wait), one that joined later waits for me (I go)', f1.slot === 'wait' && f1.ahead === 1 && f2.slot === 'admit' && f2.ahead === 0, J([f1.basis, f2.basis]));
    // the race: two rows inserted at the same millisecond, one slot left; each sees the other
    const A = mineRow(40, NOW, { run_id: '13040' }), B = mineRow(41, NOW, { run_id: '13041' });
    const w1 = page(1, 'reserved', T(NOW) - 5 * MIN);
    const ra = P([w1, { ...A, page: true }, { ...B, page: true }], A), rb = P([w1, { ...A, page: true }, { ...B, page: true }], B);
    const rb2 = P([w1, { ...A, page: true, status: 'reserved' }, { ...B, page: true }], B);
    check('the race pair: of two rows inserted at the same moment for the last slot, only the lower row id is admitted - also after it already took the slot', ra.slot === 'admit' && rb.slot === 'wait' && rb2.slot === 'wait' && rb2.running === 2, J([ra.slot, rb.slot, rb2.slot]));
    // what does not count
    const stale = P([page(1, 'reserved', T(NOW) - 3 * H1), page(2, 'reserved', T(NOW) - 2.5 * H1)], me);
    const oldWaiter = P([page(1, 'reserved', T(NOW) - 5 * MIN), page(2, 'waiting', T(NOW) - 7 * H1)], me);
    const own = P([page(1, 'reserved', T(NOW) - 5 * MIN), { ...me }], me);
    const others = P([{ ...page(1, 'reserved', T(NOW) - 5 * MIN), page: false, mode: 'audit' }, { ...page(2, 'reserved', T(NOW) - 5 * MIN), page: false, mode: 'ai_visibility' }, { ...page(3, 'reserved', NOW), error: 'x' }, page(4, 'stale', NOW), page(6, 'refused', NOW), page(7, 'handed_off', NOW), page(8, 'done', NOW)], me);
    check('never counted: a writer past the 2 h run limit (crashed), a waiter older than 6 h 15 min, my own row, an audit or monitor row, a read error, stale / refused / handed-off / done rows',
      stale.slot === 'admit' && stale.running === 0 && oldWaiter.slot === 'admit' && oldWaiter.ahead === 0 && own.slot === 'admit' && own.running === 1 && others.slot === 'admit' && others.running === 0 && others.ahead === 0,
      J([stale.basis, oldWaiter.basis, own.basis, others.basis]));
    const two = [page(1, 'reserved', T(NOW) - 5 * MIN), page(2, 'reserved', T(NOW) - 4 * MIN)];
    const z = P([], me, { limit: 0, limit_source: 'override slots:page' }), three = P(two, me, { limit: 3 });
    check('the override: 0 holds every page run (a plain "paused" note), 3 admits a third page; the basis names where the limit came from',
      z.slot === 'wait' && /^Page writing is paused for a moment\./.test(z.note) && z.eta_minutes === null && /override slots:page/.test(z.basis) && three.slot === 'admit', J([z, three.slot]));
    const late6 = P(two, { ...me, queued_at: ISO(T(NOW) - 6 * H1), created_at: ISO(T(NOW) - 10 * MIN) }, { hops: 8 });
    check('after 6 hours in line it gives up: nothing charged, nothing written, the plain way back', late6.slot === 'give_up'
      && late6.validation_error === 'No writing slot became free in 6 hours (2 pages were ahead of this one). Nothing was charged and nothing was written. Start it again when you like; a page from the weekly plan is picked again in its next cycle.'
      && !TELLS.test(late6.validation_error) && late6.note === '', late6.validation_error);
    const hops = P(two, { ...me, queued_at: ISO(T(NOW) - 2 * H1) }, { hops: 12 });
    check('the hand-off backstop: 12 hand-offs and still no slot is a give-up', hops.slot === 'give_up' && /^No writing slot became free in 2 hours/.test(hops.validation_error), hops.validation_error);
    const h39 = P(two, { ...me, created_at: ISO(T(NOW) - 37 * MIN), queued_at: ISO(T(NOW) - 37 * MIN) }), h40 = P(two, { ...me, created_at: ISO(T(NOW) - 39 * MIN), queued_at: ISO(T(NOW) - 70 * MIN) }, { hops: 1 });
    check('the hand-off: an execution that would be past 40 minutes at its next look hands its place on (n8n keeps counting the time limit from its first start); before that it waits',
      h39.slot === 'wait' && h40.slot === 'handoff' && h40.waited_minutes === 70 && h40.exec_minutes === 39 && h40.queued_at === ISO(T(NOW) - 70 * MIN), J([h39.slot, h40.slot, h40.basis]));
    const ahead3 = P([...two, page(2.1, 'waiting', T(NOW) - 3 * MIN), page(2.2, 'waiting', T(NOW) - 2 * MIN), page(2.3, 'waiting', T(NOW) - MIN)], me);
    check('the estimate: 3 ahead with 2 at a time is two rounds of pages, then my own (60 min); the counts are in the result', ahead3.ahead === 3 && ahead3.running === 2 && ahead3.eta_minutes === 60, J(ahead3));
    const fo1 = P(two, me, { read_failed: true }), fo2 = P(two, { ...me, id: 0 });
    check('fail open: an unreadable ledger or a run with no ledger row of its own is admitted and the basis says so', fo1.slot === 'admit' && fo1.fail_open && /the run ledger could not be read/.test(fo1.basis)
      && fo2.slot === 'admit' && /no ledger row of its own/.test(fo2.basis), J([fo1.basis, fo2.basis]));
    // isPage / handoffOf / isStale
    const base = { mode: 'keyword', include_content: true, verdict_only: false, via_webhook: true };
    check('RG.isPage: a page run started through the API door; never a verdict, a report-only run, an audit, a form run or a refused request',
      RG.isPage(base) && !RG.isPage({ ...base, verdict_only: true }) && !RG.isPage({ ...base, include_content: false }) && !RG.isPage({ ...base, mode: 'audit' }) && !RG.isPage({ ...base, via_webhook: false }) && !RG.isPage({ ...base, validation_error: 'x' }), '');
    const prev = { id: 9, run_id: '13009', status: 'handed_off', request_id: 'cad_1', page: true };
    const d = { request_id: 'cad_1', slot_handoff: { from_run_id: '13009', queued_at: NOW, hops: 1 } };
    check('RG.handoffOf: trusted only with the earlier execution\'s row marked handed_off for the same request; a body alone proves nothing',
      RG.handoffOf(d, [prev]) && !RG.handoffOf(d, []) && !RG.handoffOf(d, [{ ...prev, status: 'waiting' }]) && !RG.handoffOf({ ...d, request_id: 'cad_2' }, [prev]) && !RG.handoffOf({ ...d, slot_handoff: { from_run_id: 'x' } }, [prev]) && !RG.handoffOf({ request_id: 'cad_1' }, [prev]), '');
    check('RG.isStale: a waiting row is gone after 6 h 15 min; a reserved row after the run limit; created_at is the clock',
      !RG.isStale({ status: 'waiting', created_at: ISO(T(NOW) - 6 * H1) }, T(NOW)) && RG.isStale({ status: 'waiting', created_at: ISO(T(NOW) - 6.3 * H1) }, T(NOW))
      && RG.isStale({ status: 'reserved', created_at: ISO(T(NOW) - 2.1 * H1) }, T(NOW), 2) && !RG.isStale({ status: 'reserved', created_at: ISO(T(NOW) - 1.9 * H1) }, T(NOW), 2), '');
  });

  // ===================================================================================
  const KW = { headers: {}, params: {}, query: {}, body: { mode: 'keyword', keyword: 'erp implementation services', country: 'AE', domain: 'northwind-erp.com', business: 'ERP implementation partner',
    callback_url: 'https://hooks.example.com/seo', email: '', request_id: 'cad_20261112_1', receive: ['Keyword Report', 'Page Content'], client_ip: 'cadence:site_northwind-erp-com' } };
  const ni = async (body) => { delete store['Start Form']; return (await run('Normalize Input', [{ json: body }]))[0].json; };
  await guard('PS2 ledger row', async () => {
    const SN = 'PS2 P1 - a page run\'s ledger row waits in line (`waiting`, page / request_id / keyword / queued_at); every other row is `reserved` with empty page fields, in the exact columns'; reset(); begin(SN); const check = mkCheck(SN);
    const d = await ni(KW);
    check('Normalize Input: the page run carries the slot settings (2, 120 s, 6 h, 40 min) and no hand-off', d.include_content === true && d.via_webhook === true && d.page_slots === 2 && d.page_slot_poll_seconds === 120
      && d.page_slot_max_wait_hours === 6 && d.page_slot_handoff_minutes === 40 && d.slot_handoff === null && !d.validation_error, J({ ic: d.include_content, vw: d.via_webhook, ps: d.page_slots, err: d.validation_error, ho: d.slot_handoff }));
    mock('Normalize Input', [{ json: d }]);
    const row = (await run('Run Ledger Row', [{ json: { id: 'tbl', name: 'seo_run_ledger' } }]))[0].json;
    check('the page run\'s row: exact seo_run_ledger columns, `waiting`, page true, its request id and keyword, queued when it was created', eq(Object.keys(row), TC.RUN_LEDGER) && row.status === 'waiting' && row.page === true
      && row.request_id === 'cad_20261112_1' && row.keyword === 'erp implementation services' && row.queued_at === row.created_at, J(row));
    mock('Normalize Input', [{ json: { ...d, slot_handoff: { from_run_id: '13009', queued_at: '2026-11-12T01:28:12.000Z', hops: 2 } } }]);
    const hrow = (await run('Run Ledger Row', [{ json: { id: 'tbl' } }]))[0].json;
    check('a run that continues another execution\'s wait keeps that execution\'s place in line (queued_at), its own created_at', hrow.status === 'waiting' && hrow.queued_at === '2026-11-12T01:28:12.000Z' && hrow.created_at !== hrow.queued_at, J(hrow));
    for (const [what, x] of [['a verdict', { verdict_only: true, include_content: false }], ['a report-only keyword run', { include_content: false }], ['an audit', { mode: 'audit', include_content: false }], ['a form run', { via_webhook: false }]]) {
      mock('Normalize Input', [{ json: { ...d, ...x } }]);
      const r = (await run('Run Ledger Row', [{ json: { id: 'tbl' } }]))[0].json;
      check(what + ' reserves as before: `reserved`, page false, empty page fields, the exact columns', r.status === 'reserved' && r.page === false && r.request_id === '' && r.keyword === '' && r.queued_at === '' && eq(Object.keys(r), TC.RUN_LEDGER), J(r));
    }
    const mon = fs.readFileSync(path.join(CD, 'Pulse__Run_Ledger_Row_Pulse_.js'), 'utf8'), ass = fs.readFileSync(path.join(CD, 'Run_Ledger_Row_Assess_.js'), 'utf8');
    check('the monitors\' and the Keyword Check\'s rows carry the new columns too, never as a page run (their exact-column checks run in S31 / S54 / R77)',
      /page: false, request_id: '', keyword: '', queued_at: ''/.test(mon) && /page: false, request_id: '', keyword: '', queued_at: ''/.test(ass) && eq(TC.RUN_LEDGER.slice(-4), ['page', 'request_id', 'keyword', 'queued_at']) && eq(LW.ledger_cols, TC.RUN_LEDGER), J(TC.RUN_LEDGER.slice(-6)));
  });

  // ===================================================================================
  await guard('PS3 Page Slot node', async () => {
    const SN = 'PS3 P1 - the Page Slot node: the override row, the look count ($runIndex) for the customer\'s notes, and the callback the app reads'; reset(); begin(SN); const check = mkCheck(SN);
    const t0 = new Date(Date.now() - 5 * MIN).toISOString();
    const NI = { mode: 'keyword', keyword: 'dynamics ax dubai', domain: 'northwind-erp.com', request_id: 'cad_20261112_2', callback_url: 'https://app.example.com/api/hooks/n8n/tok', via_webhook: true,
      page_slots: 2, page_slot_poll_seconds: 120, page_slot_max_wait_hours: 6, page_slot_handoff_minutes: 40, slot_handoff: null };
    const me = { id: 914, run_id: 'test-exec', created_at: t0, queued_at: t0, page: true, status: 'waiting' };
    mock('Normalize Input', [{ json: NI }]); mock('Run Ledger Row', [{ json: { ...me, id: undefined } }]); mock('Reserve Run Ledger', [{ json: me }]); mock('Load Slot Override', items([]));
    const busy = [page(912, 'reserved', Date.now() - 6 * MIN), page(913, 'reserved', Date.now() - 6 * MIN)];
    const look = async (rows, runIndex) => (await run('Page Slot', items(rows), { runIndex }))[0].json;
    const a = await look(busy, 0), b = await look(busy, 1), c = await look(busy.slice(0, 1), 2), d0 = await look([], 0);
    check('the first look that must wait tells the customer once; the next looks are quiet; the look that gets the slot says "started"; a run admitted at once says nothing',
      a.slot === 'wait' && a.first_wait === true && a.started_after_wait === false && b.first_wait === false && c.slot === 'admit' && c.started_after_wait === true && d0.slot === 'admit' && d0.started_after_wait === false && d0.first_wait === false,
      J([a.slot, a.first_wait, b.first_wait, c.slot, c.started_after_wait, d0.started_after_wait]));
    check('the item carries what the slot callback needs', a.callback_url === NI.callback_url && a.request_id === NI.request_id && a.keyword === NI.keyword && a.domain === 'northwind-erp.com' && a.execution_id === 'test-exec' && a.limit === 2 && a.limit_source === 'config', J(a));
    mock('Load Slot Override', items([{ key: 'slots:page', kind: 'slots', value: '{"limit":0}' }]));
    const z = await look([], 0);
    mock('Load Slot Override', items([{ key: 'slots:page', kind: 'slots', value: '{"limit":3}' }]));
    const three = await look(busy, 0);
    check('the override row of seo_cache wins over the setting: 0 holds the run, 3 admits a third page', z.slot === 'wait' && z.limit === 0 && /override slots:page/.test(z.limit_source) && three.slot === 'admit' && three.limit === 3, J([z.slot, z.limit, three.slot]));
    mock('Load Slot Override', items([]));
    const fo = await look([{ error: 'The table could not be read' }], 0);
    check('an unreadable ledger fails open (admitted, said in the basis)', fo.slot === 'admit' && fo.fail_open === true, fo.basis);
    // the callback body exactly as POST Slot Note builds it
    const expr = String(LW.post_body || '').replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, '');
    const body = new Function('$json', 'return ' + expr)(a);
    const parsed = JSON.parse(body), started = JSON.parse(new Function('$json', 'return ' + expr)(c));
    check('POST Slot Note: progress / page_slot, waiting with the counts and the estimate, then started; the request id the app matches',
      parsed.status === 'progress' && parsed.stage === 'page_slot' && parsed.slot === 'waiting' && parsed.request_id === 'cad_20261112_2' && parsed.running === 2 && parsed.ahead === 0 && parsed.eta_minutes === 40 && parsed.limit === 2
      && /^Your page is waiting for a writing slot/.test(parsed.note) && started.slot === 'started' && started.eta_minutes === 20, body);
  });

  // ===================================================================================
  await guard('PS4 wiring', async () => {
    const SN = 'PS4 P1 - the wiring: the gate sits between Input OK? and the run, the wait is saved, the hand-off starts this workflow, every starter of the main workflow passes the gate'; reset(); begin(SN); const check = mkCheck(SN);
    const C = LW.connections || {};
    check('Input OK? -> Page Run? (page runs) -> Load Slot Override -> Load Page Slots -> Page Slot; other runs go straight on', eq(C['Input OK?'], [['Page Run?'], ['Mark Run Refused']])
      && eq(C['Page Run?'], [['Load Slot Override'], ['Ensure Cache Table (Site)']]) && eq(C['Load Slot Override'], [['Load Page Slots']]) && eq(C['Load Page Slots'], [['Page Slot']]), J([C['Input OK?'], C['Page Run?']]));
    check('admitted: the row is taken first (Take Page Slot by this execution\'s run id, reserved, the clock restarted), then the run', eq(C['Page Slot'], [['Slot Note?', 'Got Page Slot?']]) && eq(C['Got Page Slot?'], [['Take Page Slot'], ['Gave Up Waiting?']])
      && eq(C['Take Page Slot'], [['Slot Taken']]) && eq(C['Slot Taken'], [['Ensure Cache Table (Site)']]) && LW.take && eq(LW.take.filters, [['run_id', '={{ $execution.id }}']]) && LW.take.values.status === 'reserved' && LW.take.values.created_at === '={{ new Date().toISOString() }}' && Object.keys(LW.take.values).length === 2, J(LW.take));
    check('waiting: a saved Wait (at least 65 s, unit seconds, a webhook id) and back to the override read; give-up -> the refusal; hand-off -> row first, then the new execution; a failed hand-off is refused',
      eq(C['Gave Up Waiting?'], [['Mark Run Refused'], ['Hand Off?']]) && eq(C['Hand Off?'], [['Mark Handed Off'], ['Wait For Page Slot']]) && eq(C['Wait For Page Slot'], [['Load Slot Override']])
      && LW.wait && LW.wait.unit === 'seconds' && /Math\.max\(65,/.test(LW.wait.amount) && LW.wait.webhook === true && eq(C['Mark Handed Off'], [['Hand Off Payload']]) && eq(C['Hand Off Payload'], [['Hand Off Page Run']])
      && eq(C['Hand Off Page Run'], [['Handed Off?']]) && eq(C['Handed Off?'], [[], ['Mark Run Refused']]) && LW.self_run === 'SEOagentV4Full01', J([C['Hand Off?'], C['Handed Off?'], LW.wait]));
    check('the handed-off row is settled $0 with when and why', eq(LW.handed_off && LW.handed_off.filters, [['run_id', '={{ $execution.id }}']]) && ['status', 'settled_usd', 'dfs_usd', 'measured_usd', 'estimated_usd', 'settled_at', 'cost_basis'].every(k => (LW.handed_off.values || []).includes(k)), J(LW.handed_off));
    const want = [['SEOagentAPIentry', 'Start SEO Run'], ['SEOagentAuditSc1', 'Start Scheduled Audits'], ['SEOagentCadence1', 'Start Content Runs'], ['SEOagentV4Full01', 'Hand Off Page Run'], ['SEOagentV4Full01', 'Start Audit Run'],
      ['SEOagentV4Full01', 'Start Case Study Run'], ['SEOagentV4Full01', 'Start Follow-up Runs'], ['SEOagentV4Full01', 'Start Page Runs']];
    check('every Execute Workflow node that starts the main workflow is known (app runs, the cadence, ladder pages, follow-ups, case studies, audits, the hand-off): each goes through the gate', eq(LW.starters, want), J(LW.starters));
    check('the numbers agree: the run limit is the 2 h executionTimeout, a page admitted at its last look still has 78 min, the cadence counts 8 h', LW.page && LW.page.run_hours * 3600 === LW.execution_timeout && LW.execution_timeout === 7200
      && LW.execution_timeout / 60 - LW.page.handoff_minutes - LW.page.poll_seconds / 60 === 78 && LW.cadence_in_flight_hours === 8, J([LW.page, LW.execution_timeout, LW.cadence_in_flight_hours]));
    const rl = fs.readFileSync(path.join(CD, 'Rate_Limit.js'), 'utf8'), qv = fs.readFileSync(path.join(CD, 'Quick_Validate.js'), 'utf8');
    check('Rate Limit leaves handed-off rows out of every count; the API door drops a caller\'s own slot_handoff', /r\.status !== 'refused' && r\.status !== 'handed_off' && !isStale\(r\)/.test(rl) && /RG\.handoffOf\(d, ledger\)/.test(rl) && /slot_handoff: null/.test(qv), '');
  });

  // ===================================================================================
  await guard('PS5 clocks and counts', async () => {
    const SN = 'PS5 P1 - the clocks and the counts: a slot restarts the row\'s clock, live runs ignore waiting rows, Rate Limit counts a request once across a hand-off'; reset(); begin(SN); const check = mkCheck(SN);
    const { RG } = kits('Rate_Limit.js', ['RG']);
    const now = Date.now();
    const flipped = { run_id: '1', status: 'reserved', created_at: ISO(now - 10 * MIN), queued_at: ISO(now - 3 * H1), page: true };
    check('a row admitted after 3 h in line counts from its admission: not stale, live; a waiting row is never a live run (it holds no run-guard slot)',
      !RG.isStale(flipped, now, 2) && eq(RG.liveRuns([flipped, { run_id: '2', status: 'waiting', created_at: ISO(now - MIN), page: true }], { now: ISO(now), run_id: '99' }).map(r => r.run_id), ['1']), '');
    // Rate Limit through Run Ledger Row -> Reserve -> Load, exactly as the intake runs
    const K = 'p1@northwind-erp.com';
    const d = await ni({ ...KW, body: { ...KW.body, email: K, client_ip: '' } });
    const rows = [];
    const intake = async (x, pre) => {
      mock('Normalize Input', [{ json: { ...d, ai_budget_usd: 15, ai_budget_period: 'day', ...(x || {}) } }]);
      const row = (await run('Run Ledger Row', [{ json: { id: 'tbl' } }]))[0].json;
      const mine = { id: rows.length + 1, ...row, ...(pre || {}) }; rows.push(mine);
      mock('Reserve Run Ledger', [{ json: { ...mine } }]); mock('Load Run Ledger', rows.map(r => ({ json: { ...r } })));
      return (await run('Rate Limit', store['Load Run Ledger']))[0].json;
    };
    const today = new Date().toISOString();
    for (let i = 0; i < 5; i++) rows.push({ id: rows.length + 1, run_id: String(500 + i), key: K, mode: 'keyword', est_usd: 0.1, created_at: today, status: 'done', settled_usd: 0.1, page: false });
    const first = await intake();
    check('the sixth run of the day is accepted and its row waits in line', !first.validation_error && first.run_number_today === 6 && rows[5].status === 'waiting', first.validation_error || J(rows[5]));
    rows[5].status = 'handed_off'; rows[5].run_id = '13009';
    const ho = await intake({ slot_handoff: { from_run_id: '13009', queued_at: rows[5].queued_at, hops: 1 } });
    check('its hand-off is the same request: accepted although 6 runs are on record today, and marked as a trusted hand-off', !ho.validation_error && ho.slot_handoff_ok === true, ho.validation_error);
    const fake = await intake({ slot_handoff: { from_run_id: '777', queued_at: today, hops: 1 } });
    check('a hand-off nobody handed off is just a new request: the daily limit refuses it', /daily limit of 6 runs/.test(fake.validation_error || '') && fake.slot_handoff_ok === false, fake.validation_error);
    rows.length = 0;
    rows.push({ id: 1, run_id: '600', key: 'other@x.com', mode: 'keyword', est_usd: 2, created_at: today, status: 'waiting', page: true }, { id: 2, run_id: '601', key: 'other@x.com', mode: 'keyword', est_usd: 2, created_at: today, status: 'handed_off', page: true });
    const budget = await intake({ ai_budget_usd: 3.5 });
    check('the day\'s budget counts a waiting run\'s reservation once and a handed-off row not at all', !budget.validation_error && budget.ai_budget_used_est_usd < 3.5 && budget.ai_budget_used_est_usd >= 2, J([budget.validation_error, budget.ai_budget_used_est_usd]));
    const cc = fs.readFileSync(path.join(CD, 'Run_Ledger_Settle.js'), 'utf8');
    check('the cost kit never treats a waiting or handed-off row as a run sharing the account\'s money', /if \(st === 'waiting' \|\| st === 'handed_off'\) return false;/.test(cc), '');
    const ki = fs.readFileSync(path.join(CD, 'KI_Limit.js'), 'utf8');
    check('the keyword-intelligence limit leaves handed-off rows out too', /r\.status !== 'handed_off'/.test(ki), '');
  });

  // ===================================================================================
  await guard('PS6 dispatcher', async () => {
    const SN = 'PS6 P1 / S1-05 - the Cycle Dispatcher: a waiting row of a dead page run is read and released from `waiting`, a waiting n8n execution is left alone, and the page it was writing is freed'; reset(); begin(SN); const check = mkCheck(SN);
    const { CYC, RG } = kits('Cycle__Cycle_Plan.js', ['CU', 'RG', 'CYC']);
    const API = 'http://localhost:5678/api/v1', WF_IDS = [...new Set(CYC.JOBS.map(j => j.workflow_id))];
    const T0 = '2026-11-12T02:40:00.000Z';
    const L = (run_id, status, created, x) => ({ run_id: String(run_id), key: 'cadence:site_northwind-erp-com', mode: 'keyword', status, created_at: ISO(created), domain: 'northwind-erp.com', heavy: false, cost_basis: 'reserved', page: true, request_id: 'cad_' + run_id, keyword: 'Dynamics AX Dubai', queued_at: ISO(created), ...(x || {}) });
    const X = (id, status, startedAt) => ({ id: String(id), workflowId: 'SEOagentV4Full01', mode: 'integrated', status, startedAt: ISO(startedAt), stoppedAt: ['running', 'waiting'].includes(status) ? null : ISO(T(startedAt) + MIN) });
    const ledger = [L(13063, 'waiting', T(T0) - 70 * MIN), L(13064, 'waiting', T(T0) - 69 * MIN), L(13065, 'reserved', T(T0) - 68 * MIN)];
    const execs = [X(13063, 'canceled', T(T0) - 70 * MIN), X(13064, 'waiting', T(T0) - 69 * MIN), X(13065, 'crashed', T(T0) - 68 * MIN)];
    const R = CYC.execReads({ jobs: [], ledger, known: WF_IDS, api: API, cfg: CYC.DEFAULTS, now: T0 });
    check('execReads reads waiting rows by id as well as reserved ones', eq(R.reads.map(r => r.run_id), ['13063', '13064', '13065']), J(R.reads.map(r => [r.kind, r.run_id])));
    const api = fakeN8nApi(execs), runs = CYC.runsFrom(R.reads, R.reads.map(r => api(r.url)), R.unread);
    const p = CYC.plan({ now: T0, mode: 'start', engine_tz: 'America/New_York', sites: [], cycles: [], jobs: [], monitors: [], cadence: [], ladders: [], ladder_settings: [], ledger, runs, config: { max_open: RG.MAX_OPEN, stale_hours: RG.STALE_HOURS } });
    const rel = Object.fromEntries((p.release || []).map(x => [x.run_id, x]));
    check('the canceled waiting run and the crashed writer are released, each from the state it was in, naming its page; the execution n8n holds in a Wait is left alone',
      rel['13063'] && rel['13063'].status_was === 'waiting' && rel['13063'].page === true && rel['13063'].request_id === 'cad_13063' && rel['13063'].keyword === 'Dynamics AX Dubai'
      && rel['13065'] && rel['13065'].status_was === 'reserved' && !rel['13064'], J(p.release));
    const old = CYC.execReads({ jobs: [], ledger: [L(1, 'waiting', T(T0) - 9 * H1)], known: WF_IDS, api: API, cfg: CYC.DEFAULTS, now: T0 });
    check('a waiting row older than any run can be (6 h in line + 2 h writing + 30 min) is not read again', !old.reads.length, J(old.reads));
    // the generated nodes: Cycle Release Rows -> Release Dead Runs (matches status_was) and Cycle Page Releases
    mock('Cycle Plan', [{ json: { release: p.release } }]);
    const rr = (await run('Cycle Release Rows', [{ json: {} }], { code: 'Cycle__Cycle_Release_Rows' })).map(i => i.json);
    check('Cycle Release Rows hands Release Dead Runs the state each row was released from', eq(rr.map(r => [r.run_id, r.status_was]).sort(), [['13063', 'waiting'], ['13065', 'reserved']]), J(rr));
    const LOG = [{ request_id: 'cad_13063', keyword: 'dynamics ax dubai', status: 'started' }, { request_id: 'cad_13065', keyword: 'Dynamics AX Dubai', status: 'started' },
      { request_id: 'cad_13063', keyword: 'business central implementation uae', status: 'started' }, { request_id: 'cad_13064', keyword: 'Dynamics AX Dubai', status: 'started' }, { request_id: 'cad_13065', keyword: 'Dynamics AX Dubai', status: 'written' }];
    const pr = (await run('Cycle Page Releases', items(LOG), { code: 'Cycle__Cycle_Page_Releases' })).map(i => i.json);
    check('the released runs\' own started pages become failed with the reason (request id AND keyword; a sibling of the same request, a live run\'s page and a written page are untouched)',
      eq(pr.map(r => [r.request_id, r.keyword, r.status]), [['cad_13063', 'dynamics ax dubai', 'failed'], ['cad_13065', 'Dynamics AX Dubai', 'failed']]) && pr.every(r => /^page run stopped without a result \(n8n execution 1306[35]\)/.test(r.qa_reasons)), J(pr));
    mock('Cycle Plan', [{ json: { release: [] } }]);
    const none = (await run('Cycle Page Releases', items(LOG), { code: 'Cycle__Cycle_Page_Releases' }))[0].json;
    check('nothing released, nothing freed', none.skip === true, J(none));
  });

  // ===================================================================================
  await guard('PS7 refusal path', async () => {
    const SN = 'PS7 P1 / S1-05 - a page run that gave up (or could not hand its wait on) is refused with the slot\'s own reason, frees its started page and queues its AI question again'; reset(); begin(SN); const check = mkCheck(SN);
    const base = { mode: 'keyword', keyword: 'erp project management uae', request_id: 'cad_63', via_webhook: true, callback_url: 'https://app.example.com/h' };
    const GIVE = 'No writing slot became free in 6 hours (3 pages were ahead of this one). Nothing was charged and nothing was written. Start it again when you like; a page from the weekly plan is picked again in its next cycle.';
    mock('Ladder Duplicate (Words)', [{ json: base }]); mock('Rate Limit', [{ json: base }]);
    const plain = (await run('Refused Input', [{ json: {} }]))[0].json;
    mock('Page Slot', [{ json: { slot: 'give_up', validation_error: GIVE, handoff_failed_error: 'HF' } }]);
    const gave = (await run('Refused Input', [{ json: {} }]))[0].json;
    mock('Page Slot', [{ json: { slot: 'handoff', validation_error: '', handoff_failed_error: 'This page waited for a writing slot but could not keep its place in line, so it was not written. Nothing was charged. Start it again.' } }]);
    mock('Hand Off Page Run', [{ json: { error: 'Workflow is not active' } }]);
    const hof = (await run('Refused Input', [{ json: {} }]))[0].json;
    check('Refused Input: a run the slot never saw is refused as before; one that gave up carries the slot\'s reason; a failed hand-off says it could not keep its place',
      !plain.validation_error && plain.keyword === base.keyword && gave.validation_error === GIVE && /could not keep its place in line/.test(hof.validation_error) && !TELLS.test(hof.validation_error), J([plain.validation_error, gave.validation_error, hof.validation_error]));
    reset();
    mock('Normalize Input', [{ json: base }]); mock('Refused Input', [{ json: { ...base, validation_error: GIVE } }]);
    mock('Load Content Log (Refused)', items([{ request_id: 'cad_63', keyword: 'ERP Project Management UAE', status: 'started' }, { request_id: 'cad_63', keyword: 'erp project management uae', status: 'written' }]));
    const row = (await run('Refused Page Row', store['Load Content Log (Refused)']))[0].json;
    check('Refused Page Row: the run\'s own started row (its request id and keyword) is named for Release Refused Page, with the refusal as the reason',
      row.request_id === 'cad_63' && row.keyword === 'ERP Project Management UAE' && row.status === 'failed' && row.qa_reasons === 'page run not started: ' + GIVE, J(row));
    mock('Load Content Log (Refused)', items([]));
    const none = (await run('Refused Page Row', store['Load Content Log (Refused)']))[0].json;
    check('no started row of this run: a key that matches nothing (a written page is never touched)', none.request_id === '__no_row__' && none.marked === 0, J(none));
    const rq = LW.requeue || {};
    const want = [['request_id', 'eq', "={{ String($('Normalize Input').first().json.request_id || '') || '__no_request__' }}"], ['status', 'eq', 'writing']];
    check('Release Refused Page matches started rows only; both requeue nodes move only this request\'s `writing` AI question back to `queued` with a reason',
      eq((LW.release_refused || []).slice(-1), [['status', 'eq', 'started']]) && ['Requeue AI Target (Refused)', 'Requeue AI Target (Failed)'].every(n => rq[n] && eq(rq[n].filters, want) && eq(rq[n].values, ['reason', 'request_id', 'status', 'updated_at', 'written_at'])), J(rq));
    const C = LW.connections || {};
    check('the refusal frees the page first (before a form\'s completion page could end the run); a failed run requeues before it is stopped', (C['Refused Input'] || [[]])[0][0] === 'Load Content Log (Refused)'
      && eq(C['Load Content Log (Refused)'], [['Refused Page Row']]) && eq(C['Refused Page Row'], [['Release Refused Page']]) && eq(C['Mark Page Run Failed'], [['Requeue AI Target (Failed)', 'DFS Balance End']]), J([C['Refused Input'], C['Mark Page Run Failed']]));
  });

  // ===================================================================================
  await guard('PS8 cadence and hand-off payload', async () => {
    const SN = 'PS8 P1 - the Content Cadence counts a started page as in flight for 8 h; the hand-off payload carries the request and its place in line; Normalize Input keeps only a well-formed hand-off'; reset(); begin(SN); const check = mkCheck(SN);
    const cp = fs.readFileSync(path.join(CD, 'Cadence_Plan.js'), 'utf8');
    check('Cadence Plan: in_flight_hours 8 (6 h in line + 2 h writing)', /in_flight_hours: 8,/.test(cp) && !/in_flight_hours: 2,/.test(cp), '');
    mock('Page Slot', [{ json: { queued_at: '2026-11-12T01:28:12.000Z', hops: 1 } }]);
    mock('API Entry', [{ json: { headers: { a: 1 }, body: { mode: 'keyword', keyword: 'kw', request_id: 'cad_1', slot_handoff: { from_run_id: '1', queued_at: 'x', hops: 0 } } } }]);
    const hp = (await run('Hand Off Payload', [{ json: {} }], { execId: '13070' }))[0].json;
    check('Hand Off Payload: the same body, this execution as from_run_id, the original place in line, one more hand-off', hp.headers && hp.headers.a === 1 && hp.body.keyword === 'kw' && hp.body.request_id === 'cad_1'
      && eq(hp.body.slot_handoff, { from_run_id: '13070', queued_at: '2026-11-12T01:28:12.000Z', hops: 2 }), J(hp));
    const good = await ni({ ...KW, body: { ...KW.body, slot_handoff: { from_run_id: '13070', queued_at: '2026-11-12T01:28:12Z', hops: 2 } } });
    const bad = await ni({ ...KW, body: { ...KW.body, slot_handoff: { from_run_id: 'abc', queued_at: 'soon' } } });
    check('Normalize Input: a well-formed hand-off is kept (normalised), anything else is dropped', eq(good.slot_handoff, { from_run_id: '13070', queued_at: '2026-11-12T01:28:12.000Z', hops: 2 }) && bad.slot_handoff === null, J([good.slot_handoff, bad.slot_handoff]));
  });
};
