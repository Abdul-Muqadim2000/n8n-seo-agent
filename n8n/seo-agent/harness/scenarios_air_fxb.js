// AIR FX-B (2026-11-06, docs/ai-ranking-2026-11-05/REVIEW_B_SAFETY.md, fixes/FX-B.md): the safety review's graph-level findings, checked on the
// GENERATED workflows (air_graph_exec) and, for the workflows other than AI Growth, node by node against the production base. Synthetic data only.
//   FXB4   RB-4  the kill switch fails CLOSED: an unreadable seo_cache (either load errors) stops AIR, no paid / keyed call, no sink write; the kill
//                row is read by its key, whatever its kind
//   FXB5   RB-5  the AIR target sink never re-queues a question the client kept out ("kept by you") or the fit gate set aside, and gates its keyword
//   FXB6   RB-6  (a) the in-memory tables refuse unknown columns (strict schema) and bite; (b) before sync_tables.py the only off-mode writes that
//                need a new column are the ones D12 names; (c) the six monitor plan nodes and Site Admin give, for a site with no AI-ranking
//                setting, exactly what they gave at the production base 1a8bfbf0 (harness/air_golden/monitor_nodes_off.json); (d) the AI Growth
//                fixture extended with a set-aside question that has a cited client page and a refresh target published lately reaches the
//                F-37 / F-38 paths, and its output is pinned (harness/air_golden/ai_growth_off_paths.json)
//   FXB8   RB-8  AIR waits for the next run when this AI Growth run is already 25 minutes old (the report is never pushed past the 2,400 s limit)
//   FXBR   AIRF rule air-2 (FX-A's counting changes): priors, runs and actions of air-1 are never compared or learned from
//   FXB11  RB-11 old air:week / air:mentions markers are pruned after an `on` run, the rest of seo_cache is untouched, shadow prunes nothing
// Regenerate (only for a deliberate change, with the reason in the commit):
//   AIR_GOLDEN_WRITE=1 AIR_GOLDEN_MON_BASE=<dir of the base commit's workflows/*.json> node scenarios_air_fxb.js   (monitor_nodes_off.json)
//   AIR_GOLDEN_WRITE=1 [AIR_GOLDEN_BASE_WF=<base AI Growth json>] node scenarios_air_fxb.js                        (ai_growth_off_paths.json)
const fs = require('fs'); const path = require('path');
const { exec } = require('./air_graph_exec');
const FX = require('./fixtures_air');
const PL = require('./scenarios_air_plumb');
const WF_DIR = path.join(__dirname, '..', 'workflows');
const GOLD = path.join(__dirname, 'air_golden');
const readWf = (f, dir) => { const w = JSON.parse(fs.readFileSync(path.join(dir || WF_DIR, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const J = (x) => String(JSON.stringify(x));
const node = (w, n) => w.nodes.find(x => x.name === n);
const NOVA = 'site_nova-ai-example';
const AIR_SINK = /^(Save AI Rank Targets|Save AI Rank Prospects|Save AI Rank Proposed|Set Core Until|Save AI Rank Cache|Patch AI Growth Actions)$/;
const REQ = /^(AI Rank (Requests|Mention|Bing|SERP|CC|Brave|Fetch)|Any AI Rank (Mentions|Bing|SERP|CC|Brave|Fetch))/;

// ---- (c) one Code node of a generated workflow, run on its own: the Data Table loads of its workflow answer with the fixture's rows, every other
// node it names answers one empty item; the clock is pinned and Math.random seeded (the same rules as air_graph_exec) ----
const SANDBOX_NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']);
const SANDBOX_OBJECT = new Proxy(Object, { get: (t, k) => SANDBOX_NOOP.has(k) ? ((o) => o) : t[k] });
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function runNode(wf, name, tables, nowMs, trigger, extra) {
  const n = node(wf, name); if (!n) throw new Error('no node ' + name + ' in ' + wf.name);
  const RealDate = Date; const PD = class extends RealDate { constructor(...a) { if (!a.length) super(nowMs); else super(...a); } static now() { return nowMs; } };
  let st = 2166136261; const M = Object.create(Math); M.random = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const loads = {}; for (const x of wf.nodes) { if (x.type !== 'n8n-nodes-base.dataTable') continue; const p = x.parameters || {}; if (p.resource === 'table') { loads[x.name] = [{ json: { id: 'dt', name: p.tableName } }]; continue; }
    if (p.operation === 'get') loads[x.name] = (tables[String(((p.dataTableId || {}).value) || '')] || []).map(r => ({ json: clone(r) })); }
  const trig = (wf.nodes.find(x => /Trigger$/i.test(x.type) || x.type === 'n8n-nodes-base.executeWorkflowTrigger') || {}).name;
  const acc = (arr) => ({ all: () => arr, first: () => arr[0], last: () => arr[arr.length - 1], item: arr[0], get json() { return arr[0] && arr[0].json; } });
  const $ = (nm) => acc(extra && extra[nm] ? extra[nm].map(j => ({ json: clone(j) })) : nm === trig || nm === 'Admin Run' || nm === 'Manual Run' ? [{ json: clone(trigger || {}) }] : (loads[nm] || [{ json: {} }]));
  const fn = new AsyncFunction('$input', '$', '$runIndex', '$getWorkflowStaticData', '$now', '$execution', '$workflow', '$json', '$node', 'URL', 'Object', 'structuredClone', 'Date', 'Math', 'require', n.parameters.jsCode);
  const inp = [{ json: clone(trigger || {}) }];
  try { const r = await fn.call({ helpers: {} }, acc(inp), $, 0, () => ({}), new PD(), { id: 'fxb-node' }, { id: wf.id, name: wf.name }, inp[0].json, new Proxy({}, { get: (t, k) => ({ name: String(k), runIndex: 0 }) }), undefined, SANDBOX_OBJECT, undefined, PD, M, undefined);
    return (Array.isArray(r) ? r : [r]).map(x => (x && typeof x === 'object' && 'json' in x) ? x.json : x); }
  catch (e) { return { thrown: String((e && e.message) || e).slice(0, 300) }; }
}
// the site with NO AI-ranking setting: the fixture's monitor rows without the five ai_rank_* columns (as before sync_tables.py, or never set)
const AIRM = ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave'];
const monTables = () => { const F = FX.make({ seed: 'air-fxb-mon', modes: { nova: '', acme: '' } }); const T = clone(F.tables);
  T.seo_monitors = T.seo_monitors.map(m => { const c = { ...m }; for (const k of AIRM) delete c[k]; return c; }); return { T, nowMs: F.nowMs }; };
const MON_NODES = [['SEO_Agent_AI_Visibility.json', 'AI Plan'], ['SEO_Agent_AI_Pulse.json', 'AI Plan'], ['SEO_Agent_AI_Pilot.json', 'AI Plan'], ['SEO_Agent_Audit_Scheduler.json', 'Audit Candidates'],
  ['SEO_Agent_Backlink_Monitor.json', 'BL Plan'], ['SEO_Agent_Link_Builder.json', 'LB Plan'], ['SEO_Agent_Site_Admin.json', 'Admin Action']];
const ADMIN_BODY = { action: 'monitors', site_id: NOVA, domain: 'nova-ai.example', monitors: { ai_prompts_max: 25, competitors: 'rival-one.example' } };
async function monOutputs(dir) {
  const { T, nowMs } = monTables(); const out = {};
  for (const [f, nm] of MON_NODES) { const wf = readWf(f, dir); out[f + ' / ' + nm] = await runNode(wf, nm, T, nowMs, nm === 'Admin Action' ? ADMIN_BODY : {}); }
  // Monitor Row (Admin) reads Admin Action's output: run it on the output the same workflow's Admin Action gave
  { const wf = readWf('SEO_Agent_Site_Admin.json', dir); const a = out['SEO_Agent_Site_Admin.json / Admin Action']; const w = clone(wf);
    const n = node(w, 'Monitor Row (Admin)'); const T2 = clone(T); w.nodes.push({ name: '__fxb_admin', type: 'n8n-nodes-base.dataTable', parameters: { operation: 'get', dataTableId: { value: '__fxb_admin' } } });
    T2.__fxb_admin = Array.isArray(a) ? a : []; n.parameters.jsCode = n.parameters.jsCode.split("$('Admin Action')").join("$('__fxb_admin')");
    out['SEO_Agent_Site_Admin.json / Monitor Row (Admin)'] = await runNode(w, 'Monitor Row (Admin)', T2, nowMs, ADMIN_BODY); }
  return out;
}
// what may differ from the base, and only this: `settings.rank` (AIRF.settingsOf, every field off) on the items a monitor plan hands to its own nodes
// and the five ai_rank_* columns present as null on the Site Admin monitor row (a site that never had them; null = off, the column exists after
// sync_tables.py, which deploy_engine.py runs before any workflow is updated - D12)
const stripAirNull = (x) => Array.isArray(x) ? x.map(stripAirNull) : (x && typeof x === 'object') ? Object.fromEntries(Object.entries(x).filter(([k, v]) => !(AIRM.includes(k) && v === null))) : x;
const stripRank = (x) => Array.isArray(x) ? x.map(stripRank) : (x && typeof x === 'object') ? Object.fromEntries(Object.entries(x).filter(([k, v]) => !(k === 'rank' && v && typeof v === 'object' && v.mode === 'off' && Object.keys(v).length === 5)).map(([k, v]) => [k, stripRank(v)])) : x;
const firstDiff = (a, b, p = '') => { if (J(a) === J(b)) return ''; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d; } }
  return p + ': ' + J(a).slice(0, 220) + ' vs ' + J(b).slice(0, 220); };

// ---- (d) the AI Growth fixture extended to the F-37 / F-38 paths ----
const pathsFixture = (tables, F) => {
  const nova = F.archetypes.nova; const W = 'https://' + nova.domain; const ago = (d) => new Date(F.nowMs - d * 864e5).toISOString();
  // enough of what the client sells for the topic bar to judge (with fewer than 12 topic words it refuses nothing, and F-37 is never reached)
  const siteRow = tables.seo_sites.find(r => r.site_id === NOVA); siteRow.declared_services = JSON.stringify(['Custom software development for logistics companies', 'AI development and machine learning consulting',
    'Mobile app development for iOS and Android', 'Cloud migration and DevOps services', 'Web application development with React and Node', 'Data engineering and analytics dashboards', 'ERP integration and API development', 'UI and UX design for business software']);
  // F-37: a question off the client's topic whose answer AI cites ON the client's own page (a set-aside question with a cited client page)
  const pidA = 'nq_fxb_cited', textA = 'Which yacht charter in Dubai is best for a team outing?';
  tables.seo_ai_prompts.push({ ...tables.seo_ai_prompts.find(p => p.site_id === NOVA && p.kind !== 'brand'), prompt_id: pidA, prompt: textA, keyword: 'yacht charter dubai', topic: 'yacht charter', kind: 'recommend', status: 'active' });
  const vis = tables.seo_ai_visibility.filter(v => v.site_id === NOVA).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
  const gaps = JSON.parse(vis.gaps_json || '[]'); gaps.push({ prompt_id: pidA, prompt: textA, kind: 'recommend', topic: 'yacht charter', competitors: ['rival-one.example'], sources: [], volume: 90, stage: 'decision', cluster: 'yacht charter', fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } });
  // F-38: a refresh target whose page the agent published 10 days ago and nobody has read yet
  const pidB = 'nq_fxb_fresh', textB = 'Who builds custom software for logistics companies in Dubai?', pageB = W + '/services/logistics-software';
  tables.seo_ai_prompts.push({ ...tables.seo_ai_prompts.find(p => p.site_id === NOVA && p.kind !== 'brand'), prompt_id: pidB, prompt: textB, keyword: 'custom software logistics dubai', topic: 'custom software', kind: 'recommend', status: 'active' });
  gaps.push({ prompt_id: pidB, prompt: textB, kind: 'recommend', topic: 'custom software', competitors: ['rival-one.example'], sources: [], volume: 120, stage: 'decision', cluster: 'custom software', fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } });
  vis.gaps_json = JSON.stringify(gaps);
  const pages = JSON.parse(vis.pages_json || '[]'); pages.push({ url: W + '/team-events/', citations: 2, engines: ['chatgpt'] }); vis.pages_json = JSON.stringify(pages);
  tables.seo_ai_answers.push({ ...tables.seo_ai_answers.find(a => a.site_id === NOVA), prompt_id: pidA, prompt: textA, engine: 'chatgpt', answered: true, mentioned: false, cited: true, our_urls: nova.domain + '/team-events/', checked_at: ago(1) });
  tables.seo_ai_answers.push({ ...tables.seo_ai_answers.find(a => a.site_id === NOVA), prompt_id: pidB, prompt: textB, engine: 'chatgpt', answered: true, mentioned: false, cited: true, our_urls: nova.domain + '/services/logistics-software', checked_at: ago(1) });
  tables.seo_content_log.push({ ...tables.seo_content_log.find(l => l.site_id === NOVA), keyword: 'custom software logistics dubai', request_id: 'cad_fxb_fresh', started_at: ago(14), status: 'published', published_url: pageB, published_at: ago(10) });
  return { pidA, pidB };
};

module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  const mk = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const wf0 = readWf('SEO_Agent_AI_Growth.json'); const wfFake = PL.withFakeKits(wf0);
  const TC = require('./table_cols.json');

  // =================================================================================================================================
  await guard('air FXB4 kill switch fails closed', async () => {
    const SN = 'AIR FXB4 (RB-4) - the kill switch fails CLOSED: an unreadable seo_cache stops AIR (no paid or keyed call, no sink write); the kill row is read by its key whatever its kind'; begin(SN); const check = mk(SN);
    const off = await PL.runGrowth({ wf: wfFake, modes: { nova: '', acme: 'off' } });
    const ctl = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'shadow' } });
    check('control: with the switch readable and off, an on site plans (AI Rank Plan ran, the request planner ran)', ctl.counts['AI Rank Plan'] === 1 && ctl.counts['AI Rank Requests'] === 1, J(Object.keys(ctl.counts).filter(n => /AI Rank/.test(n))));
    const broken = (nm) => { const w = clone(wfFake); const n = node(w, nm); n.type = 'n8n-nodes-base.code'; n.typeVersion = 2; n.parameters = { jsCode: "throw new Error('the seo_cache read timed out');" }; return w; };
    for (const nm of ['Load AI Rank Cache', 'Load AI Rank Kill']) {
      const r = await PL.runGrowth({ wf: broken(nm), modes: { nova: 'on', acme: 'shadow' } });
      const live = ((r.last('AI Rank Live') || [])[0] || {}).json || {};
      const ran = Object.keys(r.counts).filter(n => REQ.test(n) || n === 'AI Rank Plan' || /^Ensure AI Rank /.test(n));
      check(nm + ' errors -> AI Rank Live stops AIR for every site ("could not be read"), no AIR table is ensured, nothing is planned or requested', live.skip === true && live.unreadable === true && /could not be read/.test(live.reason || '') && !ran.length, J({ live, ran }));
      check(nm + ' errors -> no AIR write and no sink write; the report, the callback and every existing write are the off run\'s', !r.airWrites.length && !r.r.writes.some(w => AIR_SINK.test(w.node)) && J(r.report) === J(off.report) && J(r.callback) === J(off.callback) && J(r.writes) === J(off.writes) && r.counts['Growth Report'] === 1, J(r.r.writes.map(w => w.node)).slice(0, 300));
    }
    const k = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'shadow' }, extra: { seo_cache: [{ key: 'air:kill', kind: '', site_id: '', value: '1', updated_at: '2026-11-01T00:00:00.000Z' }] } });
    check('a kill row inserted by hand with another kind (\'\') still stops AIR: nothing requested, nothing written', (((k.last('AI Rank Live') || [])[0] || {}).json || {}).killed === true && !k.counts['AI Rank Requests'] && !k.airWrites.length, J((k.last('AI Rank Live') || [])[0]));
    // the planner's own re-check fails closed too (it is the last guard before a paid request)
    const src = node(wfFake, 'AI Rank Requests').parameters.jsCode;
    check('the request planner re-checks the switch with the same fail-closed rule (an errored or missing load counts as killed)', /killAir\.some\(r => r && r\.error\)/.test(src) && /!cacheAir\.length \|\| !killAir\.length/.test(src), 'AI Rank Requests');
  });

  // =================================================================================================================================
  await guard('air FXB5 target sink', async () => {
    const SN = 'AIR FXB5 (RB-5) - the AIR target sink never re-queues a question the client kept out or the fit gate set aside, and its keyword passes the fit gate'; begin(SN); const check = mk(SN);
    const base = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' } });
    const T0 = base.r.writes.filter(w => w.node === 'Save AI Rank Targets').flatMap(w => w.rows);
    check('control: an on run queues one AIR target', T0.length === 1 && T0[0].origin === 'ai_rank' && T0[0].status === 'queued', J(T0).slice(0, 300));
    const tid = (T0[0] || {}).target_id, pid = (T0[0] || {}).prompt_id;
    const setRow = (st) => (tables) => { const rows = tables.seo_ai_targets; const r = rows.find(x => x.target_id === tid);
      const row = { ...(r || rows[0]), target_id: tid, site_id: NOVA, prompt_id: pid, question: 'q', keyword: (T0[0] || {}).keyword, kind: 'answer', origin: null, action_id: null, live_at: null, ...st, updated_at: '2026-10-30T00:00:00.000Z' };
      if (r) Object.assign(r, row); else rows.push(row); };
    for (const [st, why] of [[{ status: 'skipped', reason: 'kept by you' }, 'kept by you'], [{ status: 'set_aside', reason: 'not a search this website should target: names a competitor' }, 'set aside by the fit gate']]) {
      const r = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, tablesFn: setRow(st) });
      const tg = r.r.writes.filter(w => w.node === 'Save AI Rank Targets').flatMap(w => w.rows);
      const after = (r.tables.seo_ai_targets || []).filter(x => x.target_id === tid);
      check('a stored target ' + why + ' is not written by AIR (no AIR row for it) and keeps its status', !tg.some(x => x.target_id === tid) && after.length >= 1 && after.every(x => x.status === st.status), J({ tg: tg.map(x => [x.target_id, x.status]), after: after.map(x => [x.status, x.reason]) }));
    }
    // the sink keyword through the fit gate: the chosen question's keyword names a configured competitor
    const rival = (FX.make({ seed: 'air-golden' }).archetypes.nova.rivals[0] || [])[0] || 'rival-one.example';
    const g = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, tablesFn: (tables) => { const p = tables.seo_ai_prompts.find(x => x.site_id === NOVA && x.prompt_id === pid); if (p) p.keyword = String(rival).split('.')[0] + ' software pricing'; } });
    const tgG = g.r.writes.filter(w => w.node === 'Save AI Rank Targets').flatMap(w => w.rows);
    check('a chosen question whose keyword names a competitor (' + rival + ') is refused by the sink\'s fit gate: no AIR target row', !tgG.some(x => x.target_id === tid), J(tgG.map(x => [x.target_id, x.keyword])));
    const js = node(wfFake, 'AI Rank Target Rows').parameters.jsCode, js2 = node(wfFake, 'AI Rank Run Row').parameters.jsCode;
    check('the fit gate is inlined in the target builder only (the other builders stay small)', /function fitGate\(/.test(js) && !/function fitGate\(/.test(js2) && js2.length < 20000, J({ target: js.length, run: js2.length }));
  });

  // =================================================================================================================================
  await guard('air FXB6 strict schema and goldens', async () => {
    const SN = 'AIR FXB6 (RB-6) - the in-memory tables refuse unknown columns; before sync_tables only the writes D12 names need a new column; the other AIRF workflows unchanged for a site with no setting; the F-37 / F-38 paths pinned'; begin(SN); const check = mk(SN);
    // (a) strict schema: every run of the AIR scenarios writes only declared columns
    const off = await PL.runGrowth({ wf: wfFake, modes: { nova: '', acme: 'off' } }), sh = await PL.runGrowth({ wf: wfFake, modes: { nova: 'shadow', acme: 'shadow' } }), on = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'shadow' } });
    check('(a) off, shadow and on write only the columns each table declares (strict schema on by default)', [off, sh, on].every(x => !(x.r.schemaErrors || []).length), J([off, sh, on].map(x => x.r.schemaErrors)));
    const bite = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, schemas: { seo_ai_targets: TC.AI_TARGETS.filter(c => c !== 'origin') } });
    check('(a) it bites: with `origin` missing from seo_ai_targets the AIR target save is refused (as n8n refuses an unknown column)', (bite.r.schemaErrors || []).some(e => e.table === 'seo_ai_targets' && e.columns.includes('origin')), J(bite.r.schemaErrors));
    // (b) the deploy order (D12): the live tables BEFORE sync_tables.py adds the nine new columns
    const pre = { seo_ai_targets: TC.AI_TARGETS.filter(c => !TC.AI_TARGETS_AIR.includes(c)), seo_monitors: TC.MONITORS.filter(c => !TC.AIR_MONITORS.includes(c)), seo_ai_prompts: TC.AI_PROMPTS.filter(c => !TC.AI_PROMPTS_AIR.includes(c)) };
    const offPre = await PL.runGrowth({ wf: wf0, modes: { nova: '', acme: 'off' }, schemas: pre });
    const need = [...new Set((offPre.r.schemaErrors || []).map(e => e.node + ' > ' + e.table + ' (' + e.columns.join(', ') + ')'))];
    check('(b) before sync_tables.py, an OFF run fails exactly one write: Save AI Targets (origin, action_id, live_at) - so the engine deploy must run sync_tables.py first (D12, deploy_engine.py does)', J(need) === J(['Save AI Targets > seo_ai_targets (origin, action_id, live_at)']), J(need));
    // (c) the other workflows that inline AIRF, node by node, against the production base
    const SNAP = path.join(GOLD, 'monitor_nodes_off.json');
    if (process.env.AIR_GOLDEN_WRITE === '1' && process.env.AIR_GOLDEN_MON_BASE) { const b = await monOutputs(process.env.AIR_GOLDEN_MON_BASE);
      fs.writeFileSync(SNAP, J({ note: 'FX-B RB-6: the six monitor plan nodes and Site Admin (Admin Action + Monitor Row (Admin)) on fixtures_air seed air-fxb-mon, every site with NO ai_rank_* column, taken from the production base workflows (1a8bfbf0). Regenerate only for a deliberate change of these nodes for every site.', base: '1a8bfbf0', outputs: b }) + '\n'); console.log('   wrote ' + SNAP); }
    if (!fs.existsSync(SNAP)) check('(c) the snapshot exists (harness/air_golden/monitor_nodes_off.json)', false, 'missing');
    else { const S = JSON.parse(fs.readFileSync(SNAP, 'utf8')).outputs; const now = await monOutputs();
      for (const k of Object.keys(S)) { const a = stripAirNull(stripRank(now[k])), b = S[k];
        check('(c) ' + k + ': a site with no AI-ranking setting gets exactly the production base\'s output (only settings.rank all off, or the ai_rank_* columns as null, may be added)', J(a) === J(b) && !(a && a.thrown), firstDiff(a, b)); } }
    // (d) the F-37 / F-38 paths in AI Growth
    const SNAP2 = path.join(GOLD, 'ai_growth_off_paths.json');
    let ids = null; const g = await PL.runGrowth({ wf: wf0, modes: { nova: '', acme: 'off' }, tablesFn: (t, F) => { ids = pathsFixture(t, F); } });
    const plan = (g.last('Growth Plan') || []).map(i => i.json).find(p => p.site_id === NOVA) || {};
    const tA = (plan.targets || []).find(t => t.prompt_id === ids.pidA) || {}, tB = (plan.targets || []).find(t => t.prompt_id === ids.pidB) || {};
    const saA = (plan.targets_set_aside || []).find(x => x.target_id === tA.target_id) || {};
    check('(d) the F-37 path is reached: an off-topic question with a cited client page is kept (flagged, not set aside) and not queued', tA.target_id && tA.status !== 'set_aside' && tA.status !== 'queued' && saA.kept === true && /AI already cites your page/.test(tA.reason || ''), J({ tA: [tA.status, String(tA.reason).slice(0, 200)], saA }));
    check('(d) the F-38 path is reached: a refresh target whose page was published 10 days ago and not read yet waits for its readiness check', tB.target_id && tB.kind === 'refresh' && tB.status === 'skipped' && /its AI readiness is checked before any refresh is planned/.test(tB.reason || ''), J({ tB: [tB.kind, tB.status, String(tB.reason).slice(0, 200)] }));
    const pin = { report: g.report, callback: g.callback, posted: g.posted, writes: g.writes };
    if (process.env.AIR_GOLDEN_WRITE === '1') { let moved = null;
      if (process.env.AIR_GOLDEN_BASE_WF) { const b = await PL.runGrowth({ wf: readWf(path.basename(process.env.AIR_GOLDEN_BASE_WF), path.dirname(process.env.AIR_GOLDEN_BASE_WF)), modes: { nova: '', acme: 'off' }, tablesFn: (t, F) => pathsFixture(t, F) });
        const bt = (((b.last('Growth Plan') || []).map(i => i.json).find(p => p.site_id === NOVA) || {}).targets || []);
        moved = (plan.targets || []).map(t => { const o = bt.find(x => x.target_id === t.target_id) || {}; return o.status !== t.status || o.reason !== t.reason || o.keyword !== t.keyword ? { target_id: t.target_id, base: [o.status, o.keyword, String(o.reason || '').slice(0, 240)], now: [t.status, t.keyword, String(t.reason || '').slice(0, 240)] } : null; }).filter(Boolean); }
      fs.writeFileSync(SNAP2, J({ note: 'FX-B RB-6: AI Growth, every site off, on fixtures_air seed air-golden extended with an off-topic question that has a cited client page (F-37) and a refresh target published 10 days ago (F-38). Pinned from the build that fixed them; `moved_from_base` lists the targets whose status / keyword / reason differ from the production base 1a8bfbf0 on the same fixture (the intended P3 / FX-B changes).', moved_from_base: moved, ...pin }) + '\n'); console.log('   wrote ' + SNAP2); }
    if (!fs.existsSync(SNAP2)) check('(d) the snapshot exists (harness/air_golden/ai_growth_off_paths.json)', false, 'missing');
    else { const S2 = JSON.parse(fs.readFileSync(SNAP2, 'utf8'));
      check('(d) the extended run (report, callback, every write) is byte-identical to its pinned snapshot', J(pin) === J({ report: S2.report, callback: S2.callback, posted: S2.posted, writes: S2.writes }), firstDiff(pin, { report: S2.report, callback: S2.callback, posted: S2.posted, writes: S2.writes })); }
  });

  // =================================================================================================================================
  await guard('air FXB8 late run', async () => {
    const SN = 'AIR FXB8 (RB-8) - when this AI Growth run is already more than 25 minutes old, the AIR side branch waits for the next run (the report is never delayed past the workflow limit)'; begin(SN); const check = mk(SN);
    const F = FX.make({ seed: 'air-golden', modes: { nova: 'on', acme: 'shadow' } }); const T = clone(F.tables);
    const plan = (min) => [{ site_id: NOVA, domain: 'nova-ai.example', checked_at: new Date(F.nowMs - min * 60000).toISOString() }, { site_id: 'site_acme-erp-example', domain: 'acme-erp.example', checked_at: new Date(F.nowMs - min * 60000).toISOString() }];
    const g5 = await runNode(wf0, 'AI Rank Gate', T, F.nowMs, {}, { 'Growth Plan': plan(5) }), g30 = await runNode(wf0, 'AI Rank Gate', T, F.nowMs, {}, { 'Growth Plan': plan(30) });
    check('a run 5 minutes old: the gate hands on the on and shadow sites', Array.isArray(g5) && g5.length === 2 && g5.every(x => x.site_id && !x.skip), J(g5).slice(0, 300));
    check('a run 30 minutes old: the gate skips AIR with the reason, so the report and the ledger settle go out as before', Array.isArray(g30) && g30.length === 1 && g30[0].skip === true && g30[0].late === true && /minutes old/.test(g30[0].reason || ''), J(g30).slice(0, 300));
  });

  // =================================================================================================================================
  await guard('air FXBR rule version', async () => {
    const SN = 'AIR FXBR (AIRF air-2) - after the counting rules changed, rows of air-1 are never compared or learned from: priors and runs of this rule only, an action pre-registered under air-1 hidden from the plan'; begin(SN); const check = mk(SN);
    const AIRF0 = (() => { const src = node(wf0, 'AI Rank Gate').parameters.jsCode; const a = src.indexOf('const AIRF = (() => {'), b = src.indexOf('\n})();', a); return new Function(src.slice(a, b + 6) + '\nreturn AIRF;')(); })();
    check('AIRF.RULE_VERSION is air-2', AIRF0.RULE_VERSION === 'air-2', AIRF0.RULE_VERSION);
    const act = (id, rule, status) => ({ action_id: 'air_' + NOVA + '_L05_' + id, site_id: NOVA, domain: 'nova-ai.example', lever: 'L05', executor: 'approve', scope: 'question', ref: '{"prompt_id":"nq1"}', questions: '["nq1"]', engines: '["chatgpt"]', target_stage: 'S2',
      status, sink: 'ai_target', sink_ref: '', expected_json: '{}', prereg_json: JSON.stringify({ window_days: 28, rule_version: rule }), happened_at: '', verify_json: '', outcome_json: '', learned_at: '', mode: 'on', run_id: 'air_20261001_' + NOVA, created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-01T10:00:00.000Z' });
    const prior = (rule) => ({ prior_id: 'L05:S1:chatgpt:global', lever: 'L05', stage: 'S1', engine_group: 'chatgpt', scope: 'global', alpha: rule === 'air-1' ? 40 : 2, beta: 4, n_outcomes: rule === 'air-1' ? 36 : 1, prior_alpha: 1.2, prior_beta: 4.8, source: 'pooled', updated_at: '2026-10-20T00:00:00.000Z', rule_version: rule });
    const runRow = (rule, d) => ({ site_id: NOVA, domain: 'nova-ai.example', run_id: 'air_' + d + '_' + NOVA, checked_at: '2026-10-' + d.slice(6) + 'T10:00:00.000Z', mode: 'shadow', rule_version: rule, diag_json: '[]', error: '' });
    const r = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, extra: { seo_ai_rank_actions: [act('0000a001', 'air-1', 'queued'), act('0000a002', 'air-2', 'queued')], seo_ai_rank_priors: [prior('air-1')],
      seo_ai_rank_runs: [runRow('air-1', '20261028'), runRow('air-2', '20261030')] } });
    const out = (n) => ((r.r.runs[n] || []).slice(-1)[0] || [[]])[0].map(i => i.json).filter(x => x && Object.keys(x).length);
    check('the priors the plan scores and learns with are this rule\'s only (the air-1 prior with 36 outcomes is not read)', !out('Load AI Rank Priors').some(x => x.rule_version === 'air-1'), J(out('Load AI Rank Priors')));
    check('the earlier runs the plan compares with are this rule\'s only', out('Load AI Rank Runs').length >= 1 && out('Load AI Rank Runs').every(x => x.rule_version === 'air-2'), J(out('Load AI Rank Runs').map(x => [x.run_id, x.rule_version])));
    const acts = out('Load AI Rank Actions').map(x => x.action_id);
    check('an action pre-registered under air-1 is hidden from the plan, the air-2 one is handed on, and the stored rows stay', acts.includes('air_' + NOVA + '_L05_0000a002') && !acts.includes('air_' + NOVA + '_L05_0000a001') && out('Load AI Rank Actions (Stored)').length >= 2, J({ acts, stored: out('Load AI Rank Actions (Stored)').map(x => x.action_id) }));
    const saved = r.r.writes.filter(w => w.node === 'Save AI Rank Actions').flatMap(w => w.rows);
    check('the air-1 action is never verified or learned from (no row written for it)', !saved.some(a => a.action_id === 'air_' + NOVA + '_L05_0000a001'), J(saved.map(a => [a.action_id, a.status])));
  });

  // =================================================================================================================================
  await guard('air FXB11 marker prune', async () => {
    const SN = 'AIR FXB11 (RB-11) - old air:week / air:mentions markers are pruned after an on run; this week\'s and last week\'s stay; nothing else in seo_cache is touched; shadow prunes nothing'; begin(SN); const check = mk(SN);
    const F = FX.make({ seed: 'air-golden' }); const ago = (d) => new Date(F.nowMs - d * 864e5).toISOString();
    const stale = []; for (let i = 0; i < 20; i++) stale.push({ key: 'air:week:' + NOVA + ':2025-W' + String(10 + i).padStart(2, '0'), kind: 'air', site_id: NOVA, value: '{"v":1}', updated_at: ago(30 + 7 * i) });
    const keep = [{ key: 'air:week:' + NOVA + ':last', kind: 'air', site_id: NOVA, value: '{"v":1}', updated_at: ago(7) }, { key: 'air:mentions:' + NOVA + ':' + ago(20).slice(0, 7), kind: 'air', site_id: NOVA, value: '{"v":1}', updated_at: ago(20) },
      { key: 'air:protect:' + NOVA, kind: 'air', site_id: NOVA, value: '{"urls":[]}', updated_at: ago(200) }, { key: 'air:cc:' + NOVA, kind: 'air', site_id: NOVA, value: '{"v":1}', updated_at: ago(100) },
      { key: 'ai_brands:' + NOVA, kind: 'ai_brands', site_id: NOVA, value: '{}', updated_at: ago(300) }];
    const oldMentions = [0, 1, 2].map(i => ({ key: 'air:mentions:' + NOVA + ':2025-0' + (3 + i), kind: 'air', site_id: NOVA, value: '{"v":1}', updated_at: ago(90 + 30 * i) }));
    const extra = { seo_cache: [...stale, ...keep, ...oldMentions] };
    const on = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, extra });
    const keys = (on.tables.seo_cache || []).map(r => r.key);
    check('an on run prunes once (both prune nodes ran once, whether or not it had markers to save)', on.counts['Prune AI Rank Week Markers'] === 1 && on.counts['Prune AI Rank Mention Markers'] === 1, J(Object.keys(on.counts).filter(n => /Fetch|Prune/.test(n))));
    check('the 20 stale week markers and the 3 stale month markers are gone', !stale.some(r => keys.includes(r.key)) && !oldMentions.some(r => keys.includes(r.key)), J(keys.filter(k => /^air:/.test(k))));
    check('last week\'s marker, the month marker of 20 days, the protect row, the Common Crawl row and every other cache row stay', keep.every(r => keys.includes(r.key)), J({ keys: keys.filter(k => /^air:|ai_brands/.test(k)) }));
    const sh = await PL.runGrowth({ wf: wfFake, modes: { nova: 'shadow', acme: 'shadow' }, extra });
    check('shadow prunes nothing (no prune node runs, every marker stays)', !sh.counts['Prune AI Rank Week Markers'] && !sh.counts['Prune AI Rank Mention Markers'] && [...stale, ...keep, ...oldMentions].every(r => (sh.tables.seo_cache || []).some(x => x.key === r.key)), J(Object.keys(sh.counts).filter(n => /Prune AI Rank/.test(n))));
    const k = await PL.runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, extra: { seo_cache: [...stale, { key: 'air:kill', kind: 'air', site_id: '', value: '1', updated_at: ago(400) }] } });
    check('the kill switch still works with old markers around (and it is not a marker: never pruned)', (((k.last('AI Rank Live') || [])[0] || {}).json || {}).killed === true && (k.tables.seo_cache || []).some(r => r.key === 'air:kill'), J((k.last('AI Rank Live') || [])[0]));
  });
};
module.exports.monOutputs = monOutputs;
