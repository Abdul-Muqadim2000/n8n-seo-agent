// AIR P4 (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §6.5, CONTRACTS.md §4 / §5): the shadow plumbing. AP1-AP12:
//   AP1  settings: empty = off everywhere; Site Admin validates the five fields with AIRF (a bad value is refused with its reason, '' clears,
//        a field not given keeps the stored value); "Track my site" never touches them; every monitor's `s.settings.rank` is AIRF.settingsOf
//   AP2  golden off: every site off -> the AIR side branch adds only `AI Rank Gate` and `Any AI Rank?` and writes nothing (AIRG holds the bytes)
//   AP3  SHADOW GOLDEN: shadow -> every pre-existing Data Table write, the Growth Report, the ai_growth callback, the ledger settle, the posts and
//        every outside request are byte-identical to the same run with every site off; the ONLY addition is rows in the five seo_ai_rank_*
//        tables, with exactly their columns; proved to bite (three sabotaged builds are each caught)
//   AP4  on: target / prospect / proposed-question / core_until / protect / growth-action rows in the existing vocabulary, nothing else touched
//   AP5  isolation: AI Rank Plan (or a builder) that throws -> the report, the callback and the ledger settle are still produced, once
//   AP6  time: the AIR chain adds at most 5 s for two synthetic sites
//   AP7  the run row carries the old logic's choice and the comparison; a missing kit is named, never written as a result
//   AP8  lints: the AIR plan reads ladders / prospects / outreach through their gates; rule 4 holds; every action status has an exit
//   AP9  (python, outside the node harness: recorded in fixes/P4.md) sync_tables.py --dry-run lists only the new tables and columns
//   AP10 harness/ai_rank_replay.js runs on a fixture directory (IN_DIR, OUT_DIR), no network, prints no secret, writes the memo HTML
//   AP11 the AIR nodes exist only in AI Growth; every other workflow gains only the AIRF kit + `settings.rank` (monitors) or the
//        Site Admin validation
//   AP12 kill switch: air:kill = 1 -> nothing of AIR runs past the kill check, outputs as off
const fs = require('fs'); const path = require('path'); const os = require('os');
const { exec } = require('./air_graph_exec');
const FX = require('./fixtures_air');
const WF_DIR = path.join(__dirname, '..', 'workflows');
const AIR_TABLE = /^seo_ai_rank_/;
const AIR_NODE = /^(AI Rank |Any AI Rank|Ensure AI Rank |Load AI Rank |Save AI Rank |Prune AI Rank |Set Core Until$|Patch AI Growth Actions$)|\(Rank\)$/;
const readWf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WF_DIR, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const J = (x) => String(JSON.stringify(x));

// ---- the fake kits: real shapes, so every builder and save is exercised whatever state P1 / P2 are in ----
const FAKE_KITS = `
const ARD = Object.assign({}, ARD_BASE, {
  market: () => ({ cc: 'AE', lang: 'en', location_code: 2784, second: null, conflicts: [], basis: 'fake kit' }),
  intentOf: () => 'recommendation',
  corePanel: ({ prompts, now }) => { const ps = (prompts || []).filter(p => p.kind !== 'brand').slice(0, 4);
    return { core: ps.map(p => ({ prompt_id: p.prompt_id, core_since: new Date(now).toISOString(), core_until: new Date(now + 56 * 864e5).toISOString().slice(0, 10), reason: 'fake core' })),
      proposed: [{ prompt: 'Which firms in Dubai build AI agents for banks?', keyword: 'ai agents dubai', market: 'AE-en', intent: 'recommendation', source: 'fake', reason: 'fake proposal' }],
      extend: [], comparable: true, why: 'fake' }; },
  assignArms: ({ core, now }) => (core || []).map((c, i) => ({ prompt_id: c.prompt_id, arm: i % 3 === 2 ? 'control' : 'treated', stratum: 's1', assigned_at: new Date(now).toISOString() })),
  mde: () => ({ prepost: 0.12, did: 0.2, n_eff_t: 3, n_eff_c: 1, p_used: 0.02, first_appearance_k: 7, basis: 'fake' }),
  fanoutOf: ({ prompt_id }) => [{ query: 'fanout ' + prompt_id, n: 2, engines: ['chatgpt'] }],
  diagnose: ({ prompt }) => ({ prompt_id: prompt.prompt_id, intent: 'recommendation', engines: { chatgpt: { stage: 'S1', sub: '', basis: 'direct', n: 3, named: 0, cited: 0, retrieved: 1, our_rank: null, evidence: [] } },
    best_stage: 'S1', parametric_share: { chatgpt: 0.4 }, no_search: [], list_dominated: true, nobody_named: false, first_named_at: '', last_named_at: '', last_cited_at: '' }),
  sources: ({ site }) => [
    { url: 'https://top-software-firms.example/best-custom-software-companies-uae', url_key: 'top-software-firms.example/best-custom-software-companies-uae', host: 'top-software-firms.example', page_type: 'listicle', author_kind: 'editorial',
      names_client: false, rivals_named: ['rival-two.example'], questions: ['nq1', 'nq2'], engines: ['chatgpt', 'perplexity'], cites_28d: 5, influence: 0.6, placeability: 0.3, placeability_why: 'an editorial list', contact_email: 'editor@top-software-firms.example', contact_url: '', from: 'answers', last_seen: '2026-11-01T00:00:00.000Z' },
    { url: 'https://rival-one.example/blog/top-software-companies-dubai', url_key: 'rival-one.example/blog/top-software-companies-dubai', host: 'rival-one.example', page_type: 'listicle', author_kind: 'rival',
      names_client: false, rivals_named: ['rival-one.example'], questions: ['nq1'], engines: ['chatgpt'], cites_28d: 3, influence: 0.4, placeability: 0.02, placeability_why: 'a competitor list', contact_email: '', contact_url: '', from: 'answers', last_seen: '2026-11-01T00:00:00.000Z' }],
  rollEvidence: () => '{"v":1,"fake":true}' });
const ARL = Object.assign({}, ARL_BASE, {
  value: () => ({ V: 0.8, demand_w: 1, intent_w: 1, stage_w: 0.8, basis: 'fake' }),
  feasibility: () => ({ F: 0.5, market_w: 1, comp_w: 0.5, reach_w: 0.5, basis: 'fake' }),
  candidates: ({ site, diag }) => { const sid = site.site_id; const pid = (diag[0] || {}).prompt_id || 'nq1';
    const mk = (lever, ref) => { const L = ARL_BASE.LEVERS.find(l => l.id === lever); return { action_id: AIRF.actionId(sid, lever, ref), site_id: sid, lever, ref, questions: [pid], engines: ['chatgpt'], target_stage: L.to, executor: L.executor, scope: L.scope, sink: L.sink, sink_ref: '' }; };
    return [mk('L05', { prompt_id: pid }), mk('L08', { url: 'https://top-software-firms.example/best-custom-software-companies-uae' }), mk('L08', { url: 'https://rival-one.example/blog/top-software-companies-dubai' }),
      mk('L16', { url: 'https://' + site.domain + '/services/custom-software' }), mk('L03', {}), mk('L09', { url: 'https://clutch.co/ae/developers/dubai' })]; },
  score: (c) => ({ gain: 0.1, cost: 2, score: 0.05, p_by_cell: [], days: 30, why: 'fake score ' + c.lever, p_hat: 0.2, expected: { p: 0.2, gain: 0.1, cost: 2, score: 0.05, days: 30 } }),
  choose: (scored) => ({ chosen: scored, deferred: [], refused: [] }),
  prereg: (a, { now }) => ({ metric: 'named_rate', questions: a.questions, engines: a.engines, controls: [], window_days: 28, t0_rule: 'live_at', projected: { p: 0.2, gain: 0.1 }, registered_at: new Date(now).toISOString() }),
  verify: () => ({ happened: true, at: '2026-10-20T00:00:00.000Z', evidence: ['fake'] }),
  outcome: () => ({ due: true, stage_moves: { k: 1, n: 3, b: 0 }, did: null, placebo: null, first_appearance: { t: { k: 0, n: 0 }, c: { k: 0, n: 0 }, p_fisher: null, p_binom: null }, leading: {}, verdict: 'cant_tell', why: 'fake' }),
  learnable: (it) => !!(it && it.outcome && it.outcome.due && it.happened),
  learn: ({ outcomes, now }) => (outcomes || []).length ? [{ prior_id: 'L05:S1:chatgpt:global', lever: 'L05', stage: 'S1', engine_group: 'chatgpt', scope: 'global', alpha: 2.2, beta: 4.8, n_outcomes: 1, prior_alpha: 1.2, prior_beta: 4.8, source: 'pooled', updated_at: new Date(now).toISOString(), rule_version: 'air-1' }] : [],
  memo: ({ site, mode }) => ({ v: 1, rule_version: 'air-1', site_id: site.site_id, mode, parts: ARL_BASE.MEMO_PARTS.map(k => ({ key: k, title: ARL_BASE.MEMO_TITLES[k], lines: [{ text: 'fake ' + k, figures: [] }] })), blockers: [] }),
  compareOld: () => ({ overlap: 0, gain_air: 0.5, gain_old: 0.1, causes: { air: ['1', '2'], old: ['3'] }, note: 'fake compare' }) });
`;
const withFakeKits = (wf) => { const w = clone(wf); const n = w.nodes.find(x => x.name === 'AI Rank Plan'); let js = n.parameters.jsCode;
  for (const k of ['ARD', 'ARL']) { const a = 'const ' + k + ' = (() => {'; if (js.split(a).length !== 2) throw new Error('fake kits: ' + a + ' not found exactly once'); js = js.replace(a, 'const ' + k + '_BASE = (() => {'); }
  const anchor = 'const AIR_CFG = '; if (js.split(anchor).length !== 2) throw new Error('fake kits: anchor not found'); n.parameters.jsCode = js.replace(anchor, FAKE_KITS + '\n' + anchor); return w; };

// ---- one AI Growth run on the fixture (the golden test's responders), with every outside request logged ----
async function runGrowth(o) {
  const opt = o || {}; const wf = opt.wf || readWf('SEO_Agent_AI_Growth.json');
  const F = FX.make({ seed: 'air-golden', modes: opt.modes || { nova: '', acme: 'off' } });
  const tables = clone(F.tables);
  if (opt.kill) tables.seo_cache.push({ key: 'air:kill', kind: 'air', site_id: '', value: '1', updated_at: F.now });
  for (const [t, rows] of Object.entries(opt.extra || {})) tables[t] = [...(tables[t] || []), ...clone(rows)];
  if (typeof opt.tablesFn === 'function') opt.tablesFn(tables, F);   // FX-B: a test may change the fixture's rows in place
  const hostOf = (u) => String(u).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').toLowerCase().replace(/^www\./, '');
  const calls = [];
  const http = (node, req) => {
    const u = String(req.url || ''); calls.push(node + ' ' + req.method + ' ' + u);
    if (/api\.anthropic\.com\/v1\/messages\/count_tokens/.test(u)) return { input_tokens: 1000 };
    if (/api\.dataforseo\.com\/v3\/appendix\/user_data/.test(u)) return { status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance: 25 } }] }] };
    if (/bing\.com\/webmaster\/api\.svc/i.test(u)) {
      if (/GetUserSites/i.test(u)) return opt.bing === 'unread' ? { d: null } : opt.bing === 'failed' ? { error: { message: 'Bing answered 500' } } : { d: F.bing.sites.map(s => ({ Url: s, IsVerified: true })) };   // opt.bing: the list read (default), not read, failed
      if (/GetUrlSubmissionQuota/i.test(u)) return { d: { DailyQuota: 10, MonthlyQuota: 300 } };
      if (/GetUrlInfo/i.test(u)) { const m = u.match(/[?&]url=([^&]+)/i); const page = m ? decodeURIComponent(m[1]) : ''; const at = F.bing.crawled[page];
        return { d: { Url: page, HttpStatus: at ? 200 : 0, LastCrawledDate: '/Date(' + (at ? Date.parse(at) : -62135596800000) + ')/', DiscoveryDate: '/Date(' + (at ? Date.parse(at) : -62135596800000) + ')/' } }; }
      return { d: null }; }
    if (/wikidata\.org/.test(u)) return /wbsearchentities/.test(u) ? { search: [] } : { query: { search: [] } };
    if (/\/robots\.txt$/i.test(u)) { const t = F.robots[hostOf(u)]; return req.text ? { statusCode: t ? 200 : 404, headers: {}, data: t || '' } : {}; }
    const p = F.pages[u] || F.pages[u.replace(/\/$/, '')] || F.pages[u + '/'];
    if (p) return req.text ? { statusCode: p.status, headers: { 'content-type': 'text/html' }, data: p.html } : {};
    if (req.method === 'POST') return req.text ? { statusCode: 200, headers: {}, data: '' } : {};
    return req.text ? { statusCode: 404, headers: {}, data: '' } : {};
  };
  const agent = (node, item) => ({ drafts: ((item && item.jobs) || []).map(j => ({ n: j.n, subject: 'Synthetic subject ' + j.n, body: 'Synthetic draft for ' + String(j.url || '') + '. [Your name]' })) });
  const t0 = Date.now();
  const r = await exec({ wf, trigger: {}, tables, http, agent, now: F.nowMs, seed: 'air-golden', execId: 'air-plumb-1', ...(opt.schemas ? { schemas: opt.schemas } : {}) });   // FX-B RB-6: a test's live table schemas
  const ms = Date.now() - t0;
  const last = (n) => { const x = r.runs[n]; return x && x.length ? x[x.length - 1][0] || [] : null; };
  const counts = {}; for (const n of r.order) counts[n] = (counts[n] || 0) + 1;
  return { r, F, ms, calls, counts, last, report: last('Growth Report'), callback: last('Callback Ledger (Growth)'), settle: last('Ledger Settle (Growth)'), posted: r.posts.filter(p => p.node === 'POST Growth Report').map(p => p.body),
    writes: r.writes.filter(w => !AIR_TABLE.test(w.table)), airWrites: r.writes.filter(w => AIR_TABLE.test(w.table)), tables: r.tables };
}
// the shadow golden comparison: everything a client, the app or an existing table sees is identical to the off run; AIR adds rows in its own five
// tables only. Returns the list of differences (empty = identical).
function shadowDiff(off, sh, TC) {
  const bad = [];
  if (J(sh.report) !== J(off.report)) bad.push('Growth Report output changed');
  if (J(sh.callback) !== J(off.callback) || J(sh.posted) !== J(off.posted)) bad.push('the ai_growth callback changed');
  if (J(sh.settle) !== J(off.settle)) bad.push('the ledger settle changed');
  if (J(sh.writes) !== J(off.writes)) { const a = sh.writes.map(w => w.node + '>' + w.table), b = off.writes.map(w => w.node + '>' + w.table);
    bad.push('an existing table write changed: ' + (J(a) !== J(b) ? 'shadow ' + J(a.filter(x => !b.includes(x))).slice(0, 200) : J(sh.writes.find((w, i) => J(w) !== J(off.writes[i])) || {}).slice(0, 300))); }
  if (J(sh.calls) !== J(off.calls)) bad.push('the outside requests changed: ' + J(sh.calls.filter(c => !off.calls.includes(c))).slice(0, 300));
  if (J(sh.r.posts) !== J(off.r.posts)) bad.push('the posts changed');
  const changed = Object.keys(off.counts).filter(n => sh.counts[n] !== off.counts[n]); if (changed.length) bad.push('a pre-existing node ran a different number of times: ' + changed.join(', '));
  const extra = Object.keys(sh.counts).filter(n => !(n in off.counts) && !AIR_NODE.test(n)); if (extra.length) bad.push('a non-AIR node ran only in shadow: ' + extra.join(', '));
  const KEY = { seo_ai_rank_runs: 'AI_RANK_RUNS', seo_ai_rank_questions: 'AI_RANK_QUESTIONS', seo_ai_rank_actions: 'AI_RANK_ACTIONS', seo_ai_rank_sources: 'AI_RANK_SOURCES', seo_ai_rank_priors: 'AI_RANK_PRIORS' };
  for (const w of sh.airWrites) { if (w.op === 'deleteRows') continue; const cols = TC[KEY[w.table]];
    if (!cols) { bad.push('a write to an unknown AIR table ' + w.table); continue; }
    for (const row of w.rows) if (J(Object.keys(row).sort()) !== J(cols.slice().sort())) { bad.push(w.node + ' wrote other columns than ' + w.table + "'s"); break; } }
  if (sh.r.errors.length) bad.push('node errors: ' + J(sh.r.errors).slice(0, 200));
  return bad;
}

module.exports = async (ctx) => {
  const { H, run, mock, reset, guard, begin } = ctx;
  await guard('air plumb', async () => {
    const SN = 'AIR P4 (2026-11-06, DESIGN 6.5): shadow plumbing - settings, gate, plan, rows, saves, shadow golden, replay';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const TC = require('./table_cols.json');
    const AIRM = ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave'];
    const D = 'nova-ai.example', SITE = 'site_nova-ai-example';

    // ---------------- AP1 settings ----------------
    const stored = { site_id: SITE, domain: D, ai_rank_mode: 'shadow', ai_rank_reserve: true, ai_rank_fanout_n: 20, ai_rank_mentions: 'false', ai_rank_brave: '' };
    const adminRow = async (monitors, st) => { reset(); mock('Admin Action', [{ json: { site_id: SITE, domain: D, monitors, updated_at: '2026-11-02T10:00:00Z', request_id: 'r' } }]); mock('Load Monitors (Admin)', [{ json: st || stored }]);
      return (await run('Monitor Row (Admin)', [{ json: {} }]))[0].json; };
    const r1 = await adminRow({ ai_rank_mode: 'on', ai_rank_fanout_n: 12, ai_rank_brave: true });
    const r2 = await adminRow({ ai_rank_mode: '', ai_rank_reserve: '' });
    const r3 = await adminRow({ backlinks: false });
    const r4 = await adminRow({ ai_rank_mode: 'Shadow' }, {});
    check('AP1 Site Admin: a given value is set through AIRF (on, 12, brave true), "" clears to null, a field not given keeps the stored value; exact seo_monitors columns',
      r1.ai_rank_mode === 'on' && r1.ai_rank_fanout_n === 12 && r1.ai_rank_brave === true && r1.ai_rank_reserve === true && r1.ai_rank_mentions === false
      && r2.ai_rank_mode === null && r2.ai_rank_reserve === null && r2.ai_rank_fanout_n === 20 && r3.ai_rank_mode === 'shadow' && r3.backlinks === false && r4.ai_rank_mode === 'shadow' && r4.ai_rank_fanout_n === null
      && [r1, r2, r3, r4].every(r => J(Object.keys(r).sort()) === J(TC.MONITORS.slice().sort())), J({ r1: AIRM.map(k => r1[k]), r2: AIRM.map(k => r2[k]), r3: AIRM.map(k => r3[k]), r4: AIRM.map(k => r4[k]) }));
    const e1 = await H.expectError('Admin Action', { body: { action: 'monitors', domain: D, monitors: { ai_rank_mode: 'maybe' } } }, /ai_rank_mode must be off, shadow or on/);
    const e2 = await H.expectError('Admin Action', { body: { action: 'monitors', domain: D, monitors: { ai_rank_fanout_n: 51, ai_rank_mentions: 'perhaps' } } }, /ai_rank_fanout_n must be a whole number from 0 to 50; ai_rank_mentions must be true or false/);
    reset(); const aa = (await run('Admin Action', { body: { action: 'monitors', domain: D, monitors: { ai_rank_mode: ' SHADOW ', ai_rank_reserve: 'yes', ai_rank_fanout_n: '' } } }))[0].json;
    check('AP1 Admin Action refuses a bad value with its reason (nothing stored) and hands on the normalised value; "" stays "" so the row clears it',
      e1.ok && e2.ok && aa.monitors.ai_rank_mode === 'shadow' && aa.monitors.ai_rank_reserve === true && aa.monitors.ai_rank_fanout_n === '', J({ m: aa.monitors }));
    reset(); mock('Normalize Input', [{ json: { domain: D, competitors: [], monitor_input: { ai_rank_mode: 'off', ai_rank_reserve: false }, request_id: 'r1' } }]); mock('Load Monitors (Track)', [{ json: { ...stored, ai_rank_mode: 'on' } }]);
    const t1 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('AP1 "Track my site" keeps a stored mode `on` even when its body asks for off (the app saving tracking never switches AIR)', t1.ai_rank_mode === 'on' && t1.ai_rank_reserve === true, J(AIRM.map(k => t1[k])));
    // every monitor reads s.settings.rank through AIRF.settingsOf (the inlined _monitor_sites.js, taken from a generated node)
    const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
    const gp = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Audit_Candidates.js'), 'utf8');
    const i0 = gp.indexOf('let trigger = {};'), i1 = gp.indexOf('\n  return { list: kept, on_demand');
    const msSrc = gp.slice(gp.indexOf('// ---- shared by the monitors'), gp.indexOf('\n}', i1) + 2);
    const tbl = { 'Load Sites': [{ site_id: SITE, domain: D, status: 'active' }, { site_id: 'site_acme-erp-example', domain: 'acme-erp.example', status: 'active' }], 'Load Ladders': [], 'Load Profiles': [],
      'Load Monitors': [{ site_id: SITE, ai_rank_mode: 'Shadow', ai_rank_fanout_n: '9' }, { site_id: 'site_acme-erp-example' }], 'Manual Run': [{}] };
    const $s = (n) => ({ all: () => (tbl[n] || []).map(j => ({ json: j })), first: () => ({ json: (tbl[n] || [])[0] || {} }) });
    let msOut = null; try { msOut = new Function('$', 'URL', 'Object', 'structuredClone', msSrc + "\nreturn monitorSites('ai');")($s, undefined, SOBJ, undefined); } catch (e) { msOut = { error: String(e.message) }; }
    const rk = msOut && msOut.list ? msOut.list.map(s => s.settings.rank) : null;
    check('AP1 every monitor site carries settings.rank = AIRF.settingsOf(its seo_monitors row): shadow / fan-out 9 for one, all off for a site whose row is empty',
      i0 > 0 && rk && J(rk) === J([{ mode: 'shadow', reserve: false, fanout_n: 9, mentions: false, brave: false }, { mode: 'off', reserve: false, fanout_n: 0, mentions: false, brave: false }]), J(msOut).slice(0, 400));
    // no callback, report or stored row of any workflow carries the rank settings (settings is never copied whole)
    const allWf = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.json')).map(f => [f, readWf(f)]);
    // the one node that hands `settings` on whole is internal: Audit Candidates feeds only Fetch Sitemap (Schedule) and Audit Sched Plan, which
    // builds the audit's body field by field (crawl_pages, crawl_js); nothing of `settings` reaches the main workflow, a callback or a row
    const INTERNAL = ['SEO_Agent_Audit_Scheduler.json / Audit Candidates'];
    const copies = allWf.flatMap(([f, w]) => w.nodes.filter(n => n.type === 'n8n-nodes-base.code').filter(n => /settings:\s*(s|site)\.settings\b(?!\.)|\.\.\.(s|site)\.settings\b(?!\.)|JSON\.stringify\(\s*(s|site)\.settings\b(?!\.)/.test(n.parameters.jsCode || '')).map(n => f + ' / ' + n.name));
    const sched = readWf('SEO_Agent_Audit_Scheduler.json'); const asp = (sched.nodes.find(n => n.name === 'Audit Schedule Plan') || { parameters: {} }).parameters.jsCode || '';
    check('AP1 no generated node copies a site\'s settings whole into anything a client, the app or a table sees (settings.rank stays inside the run); the one internal copy builds its body field by field',
      J(copies) === J(INTERNAL) && /body: run \? \{ mode: 'audit'/.test(asp) && !/\.\.\.c\.settings|settings: c\.settings/.test(asp), J(copies));

    // ---------------- AP2 golden off ----------------
    const off = await runGrowth({ modes: { nova: '', acme: 'off' } });
    const offAir = Object.keys(off.counts).filter(n => AIR_NODE.test(n));
    check('AP2 every site off: of the AIR side branch only AI Rank Gate and Any AI Rank? run, once each; nothing is written to an AIR table; the report runs once',
      J(offAir.sort()) === J(['AI Rank Gate', 'Any AI Rank?']) && offAir.every(n => off.counts[n] === 1) && !off.airWrites.length && off.counts['Growth Report'] === 1 && !off.r.errors.length, J({ offAir, w: off.airWrites.length, e: off.r.errors }));

    // ---------------- AP3 shadow golden (the skeleton kits as built, then the fake kits) ----------------
    const sh0 = await runGrowth({ modes: { nova: 'shadow', acme: 'shadow' } });
    const d0 = shadowDiff(off, sh0, TC);
    const runRows0 = sh0.airWrites.filter(w => w.table === 'seo_ai_rank_runs').flatMap(w => w.rows);
    check('AP3 SHADOW GOLDEN (kits as built): every existing write, the report, the callback, the settle, the posts and the outside requests identical to the off run; AIR adds only its own rows',
      !d0.length && runRows0.length === 2 && sh0.counts['Growth Report'] === 1, J(d0));
    const wfFake = withFakeKits(readWf('SEO_Agent_AI_Growth.json'));
    const oldShadowAct = { action_id: 'air_' + SITE + '_L12_00000001', site_id: SITE, domain: D, lever: 'L12', executor: 'human', scope: 'site', ref: '{}', questions: '[]', engines: '[]', target_stage: 'S4', status: 'shadow', sink: 'growth_action', sink_ref: '',
      expected_json: '{}', prereg_json: '{"window_days":28}', happened_at: '', verify_json: '', outcome_json: '', learned_at: '', mode: 'shadow', run_id: 'air_20260901_' + SITE, created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z' };
    const sh = await runGrowth({ wf: wfFake, modes: { nova: 'shadow', acme: 'shadow' }, extra: { seo_ai_rank_actions: [oldShadowAct] } });
    const offF = await runGrowth({ wf: wfFake, modes: { nova: '', acme: 'off' }, extra: { seo_ai_rank_actions: [oldShadowAct] } });
    const d1 = shadowDiff(offF, sh, TC);
    const byT = (res, t) => res.airWrites.filter(w => w.table === t && w.op !== 'deleteRows').flatMap(w => w.rows);
    const acts = byT(sh, 'seo_ai_rank_actions'), qs = byT(sh, 'seo_ai_rank_questions'), srcs = byT(sh, 'seo_ai_rank_sources'), runsF = byT(sh, 'seo_ai_rank_runs');
    check('AP3 SHADOW GOLDEN (filled kits): identical to the off run everywhere outside the five AIR tables; questions, sources, actions and run rows written with exactly their columns',
      !d1.length && qs.length > 0 && srcs.length === 4 && acts.length > 0 && runsF.length === 2, J({ d1, q: qs.length, s: srcs.length, a: acts.length, r: runsF.length }));
    const fresh = acts.filter(a => a.action_id !== oldShadowAct.action_id);
    check('AP3 every action of a shadow run has status shadow and mode shadow, no sink reference; the rival list is refused by the gate on the way out (learn only)',
      fresh.length === 10 && fresh.every(a => a.status === 'shadow' && a.mode === 'shadow' && a.sink_ref === '') && !fresh.some(a => /rival-one/.test(a.ref)), J(fresh.map(a => [a.lever, a.status, a.ref])).slice(0, 500));
    check('AP3 0 rows to targets / prospects / prompts / cache / growth from AIR in shadow, no outside request (nothing paid), and the rank settings in no write or post',
      !sh.writes.some(w => /^(Save AI Rank|Set Core Until|Patch AI Growth)/.test(w.node)) && J(sh.calls) === J(offF.calls) && !/"rank":\{"mode"/.test(J(sh.writes) + J(sh.r.posts)), J(sh.writes.map(w => w.node)).slice(0, 300));
    // proved to bite: three sabotaged builds, each caught by the same comparison
    const sab = async (mut) => { const w = clone(wfFake); mut(w); const s = await runGrowth({ wf: w, modes: { nova: 'shadow', acme: 'shadow' }, extra: { seo_ai_rank_actions: [oldShadowAct] } }); return shadowDiff(offF, s, TC); };
    const node = (w, n) => w.nodes.find(x => x.name === n);
    const b1 = await sab(w => { node(w, 'Save AI Rank Questions').parameters.dataTableId.value = 'seo_ai_targets'; });
    const b2 = await sab(w => { const p = node(w, 'AI Rank Plan'); p.parameters.jsCode = p.parameters.jsCode.replace('const on = AIRF.writesSinks(rank, false);', 'const on = true;');
      const t = node(w, 'AI Rank Target Rows'); t.parameters.jsCode = t.parameters.jsCode.replace('!AIRF.writesSinks({ mode: p.mode }, false)', 'false'); });
    const b3 = await sab(w => { w.connections['AI Rank Plan'].main[0].push({ node: 'Growth Report', type: 'main', index: 0 }); });
    check('AP3 the shadow golden bites: a save redirected to an existing table, the sink gate removed, and a second Growth Report are each caught',
      b1.length > 0 && b2.length > 0 && b3.length > 0, J({ b1, b2, b3 }).slice(0, 600));

    // ---------------- AP4 on ----------------
    const oldOnAct = { ...oldShadowAct, action_id: 'air_' + SITE + '_L05_0000000a', lever: 'L05', executor: 'approve', scope: 'question', ref: '{"prompt_id":"nq1"}', status: 'queued', sink: 'ai_target', mode: 'on', created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-01T10:00:00.000Z' };
    const on = await runGrowth({ wf: wfFake, modes: { nova: 'on', acme: 'off' }, extra: { seo_ai_rank_actions: [oldShadowAct, oldOnAct] } });
    const W = (n) => on.r.writes.filter(w => w.node === n).flatMap(w => w.rows);
    const tg = W('Save AI Rank Targets'), pr = W('Save AI Rank Prospects'), pq = W('Save AI Rank Proposed'), cu = W('Set Core Until'), ca = W('Save AI Rank Cache'), ga = W('Patch AI Growth Actions'), pri = W('Save AI Rank Priors');
    check('AP4 on: a target row in the AI Growth vocabulary and id format (ait_<site>_<prompt>), status queued, origin ai_rank with its action id, exactly the seo_ai_targets columns',
      tg.length === 1 && tg[0].target_id === 'ait_nova-ai-example_' + tg[0].prompt_id && tg[0].status === 'queued' && tg[0].origin === 'ai_rank' && /^air_site_nova-ai-example_L05_/.test(tg[0].action_id) && ['answer', 'refresh'].includes(tg[0].kind)
      && J(Object.keys(tg[0]).sort()) === J(TC.AI_TARGETS.slice().sort()), J(tg).slice(0, 400));
    check('AP4 on: a prospect row type ai_source, origin ai_rank, for the editorial list only (never the rival\'s own list), exactly the seo_link_prospects columns',
      pr.length === 1 && pr[0].prospect_domain === 'top-software-firms.example' && pr[0].type === 'ai_source' && pr[0].origin === 'ai_rank' && pr[0].status === 'new' && J(Object.keys(pr[0]).sort()) === J(TC.PROSPECT.slice().sort()), J(pr).slice(0, 400));
    const promptsAfter = on.tables.seo_ai_prompts.filter(p => p.site_id === SITE);
    const F0 = FX.make({ seed: 'air-golden', modes: { nova: 'on', acme: 'off' } }); const before = F0.tables.seo_ai_prompts.filter(p => p.site_id === SITE);
    const touched = promptsAfter.filter(p => before.some(b => b.prompt_id === p.prompt_id)).filter(p => { const b = before.find(x => x.prompt_id === p.prompt_id); const { core_until, id, createdAt, updatedAt, ...rest } = p; const { core_until: c2, ...rest2 } = b; return J(rest) !== J(rest2); });
    check('AP4 on: proposed questions stored as status proposed with no core_until (one writer, D10); Set Core Until writes only core_until and changes no other field of a question',
      pq.length === 1 && pq[0].status === 'proposed' && !('core_until' in pq[0]) && J(Object.keys(pq[0]).sort()) === J(TC.AI_PROMPTS.filter(c => c !== 'core_until').sort())
      && cu.length === 4 && cu.every(r => J(Object.keys(r)) === J(['core_until'])) && !touched.length, J({ pq: pq.length, cu, touched: touched.map(t => t.prompt_id) }).slice(0, 400));
    const growthRow = on.tables.seo_ai_growth.find(g => g.site_id === SITE) || {}; const acts0 = JSON.parse((W('Save AI Growth').find(r => r.site_id === SITE) || {}).actions_json || '[]'); const acts1 = JSON.parse(growthRow.actions_json || '[]');
    check('AP4 on: the growth patch keeps every action the run wrote and adds at most 3 of type ai_rank; the protect row is seo_cache air:protect:<site>, kind air, { urls: [{ url, until, why }] }',
      ga.length === 1 && acts1.length > acts0.length && acts1.length - acts0.length <= 3 && J(acts1.slice(0, acts0.length)) === J(acts0) && acts1.slice(acts0.length).every(a => a.type === 'ai_rank' && a.action && a.why && a.priority)
      && ca.length === 1 && ca[0].key === 'air:protect:' + SITE && ca[0].kind === 'air' && JSON.parse(ca[0].value).urls.every(u => u.url && u.until && u.why), J({ ga, ca, n0: acts0.length, n1: acts1.length }).slice(0, 500));
    const onActs = W('Save AI Rank Actions');
    check('AP4 on: the stored on-mode action is verified and learned from (a prior row written); the old shadow action expires after its window + 14 days; acme (off) writes nothing',
      pri.length === 1 && pri[0].prior_id === 'L05:S1:chatgpt:global' && onActs.some(a => a.action_id === oldOnAct.action_id && a.status === 'verified' && a.learned_at) && onActs.some(a => a.action_id === oldShadowAct.action_id && a.status === 'expired')
      && !on.r.writes.some(w => /^(Save AI Rank|Set Core|Patch AI)/.test(w.node) && w.rows.some(r => r.site_id === 'site_acme-erp-example')), J(onActs.map(a => [a.lever, a.status])).slice(0, 400));
    const noAirRep = (arr) => (arr || []).map(it => { const j = { ...((it && it.json) || {}) }; delete j.ai_rank; delete j.html; delete j.lineage; return j; });
    check('AP4 on: the report, the callback and every pre-existing write except the ones AIR is allowed in on mode are identical to the off run; no node error',
      // D24 (P6, wave 2): an on website's report item gains the "AI ranking plan" section, its lineage line and the additive key ai_rank; everything
      // else of it, and every other website's item, stays identical (harness AE5 holds the section itself)
      J(noAirRep(on.report)) === J(noAirRep(offF.report)) && J(noAirRep(on.callback)) === J(noAirRep(offF.callback)) && J(on.settle) === J(offF.settle) && !on.r.errors.length
      && J((on.report || []).filter(it => !/nova/.test(String((it.json || {}).domain)))) === J((offF.report || []).filter(it => !/nova/.test(String((it.json || {}).domain))))
      && J(on.writes.filter(w => !/^(Save AI Rank|Set Core Until|Patch AI Growth|Prune AI Rank (Week|Mention) Markers)/.test(w.node))) === J(offF.writes), J(on.r.errors).slice(0, 300));

    // ---------------- AP5 isolation ----------------
    const iso = async (mut) => { const w = clone(wfFake); mut(w); return runGrowth({ wf: w, modes: { nova: 'shadow', acme: 'shadow' } }); };
    const x1 = await iso(w => { node(w, 'AI Rank Plan').parameters.jsCode = "throw new Error('boom');"; });
    const x2 = await iso(w => { node(w, 'AI Rank Question Rows').parameters.jsCode = "throw new Error('boom');"; });
    const x3 = await iso(w => { node(w, 'AI Rank Gate').parameters.jsCode = "throw new Error('boom');"; });
    const okIso = (x) => J(x.report) === J(off.report) && J(x.callback) === J(off.callback) && x.counts['Growth Report'] === 1 && x.counts['Settle Run Ledger (Growth)'] === 1 && !x.r.errors.length;
    check('AP5 AI Rank Plan, a row builder or the gate itself throws -> the report and the callback are produced once and unchanged, the ledger settled, no run error',
      okIso(x1) && okIso(x2) && okIso(x3) && !x1.airWrites.some(w => w.table !== 'seo_ai_rank_actions' && w.table !== 'seo_ai_rank_sources' && w.op !== 'deleteRows'), J({ x1: [x1.counts['Growth Report'], x1.r.errors], x2: x2.counts['Growth Report'], x3: x3.counts['Growth Report'] }));

    // ---------------- AP6 time ----------------
    check('AP6 the AIR chain adds at most 5 s for two synthetic sites (shadow run ' + sh.ms + ' ms vs off ' + offF.ms + ' ms)', sh.ms - offF.ms <= 5000, sh.ms + ' vs ' + offF.ms);

    // ---------------- AP7 the run row ----------------
    const rr0 = runRows0.find(r => r.site_id === SITE) || {}; const rrF = runsF.find(r => r.site_id === SITE) || {};
    const old0 = JSON.parse(rr0.old_json || 'null');
    check('AP7 the run row carries the old logic\'s choice (targets, earned pages, actions) and, with the kits filled, the comparison and the memo',
      old0 && Array.isArray(old0.targets) && Array.isArray(old0.earned) && Array.isArray(old0.actions) && old0.earned.length > 0 && JSON.parse(rrF.compare_json || '{}').note === 'fake compare'
      && JSON.parse(rrF.memo_json || '{}').parts.length === 7 && rrF.error === '' && rr0.exec_id === 'air-plumb-1' && rr0.rule_version === 'air-2', J({ old0, c: rrF.compare_json }).slice(0, 400));
    const kitGap = /^kit not built: /.test(rr0.error || '');
    check('AP7 a kit not built yet is named on the run row and nothing computed from it is written (no diagnosis -> no question / action row; no memo / comparison kit -> none stored); with every kit built the row has no error and the diagnosis is stored',
      kitGap ? (/ARD\.diagnose/.test(rr0.error) ? rr0.diag_json === '[]' && !byT(sh0, 'seo_ai_rank_questions').length && !byT(sh0, 'seo_ai_rank_actions').length : true)
        && (!/ARL\.memo/.test(rr0.error) || rr0.memo_json === '') && (!/ARL\.compareOld/.test(rr0.error) || rr0.compare_json === '')
        : rr0.error === '' && rr0.diag_json !== '[]' && byT(sh0, 'seo_ai_rank_questions').length > 0,
      J({ e: rr0.error, m: String(rr0.memo_json).slice(0, 80) }).slice(0, 300));

    // ---------------- AP8 lints ----------------
    const gpj = require('./gate_pairs.json'); const rule4 = require('./rule4.json');
    const planReads = Object.entries(gpj.pairs).map(([k, v]) => [k, (v.readers || {})['SEO Agent — AI Growth / AI Rank Plan']]).filter(([, v]) => v !== undefined);
    const unpaid = J(gpj.unpaid || {});
    check('AP8 the AIR plan reads stored ladders (fit gate), prospects and outreach rows (competitor gate) through their gates; no AIR node is on the ratchet baseline',
      planReads.length === 3 && planReads.every(([, v]) => v === true) && !/AI Rank/.test(unpaid), J({ planReads, unpaid: unpaid.slice(0, 200) }));
    const r4bad = Object.values(rule4).flat().filter(x => x && typeof x === 'object' && x.ok === false);
    check('AP8 INVARIANTS rule 4 holds over the new nodes (no forward state minted, no un-reversed work-in-progress state)', !r4bad.length, J(r4bad).slice(0, 300));
    const exits = { shadow: 'expired', proposed: 'expired', queued: 'expired', in_progress: 'expired', done: 'verified', verified: 'final', not_happened: 'final', expired: 'pruned after 120 days', refused: 'final' };
    const planJs = (readWf('SEO_Agent_AI_Growth.json').nodes.find(n => n.name === 'AI Rank Plan') || { parameters: {} }).parameters.jsCode || '';
    check('AP8 every action status has an exit (shadow / open -> expired after window + 14 days, done -> verified, expired -> pruned), and the plan carries the expiry rule',
      J(Object.keys(exits).sort()) === J(['shadow', 'proposed', 'queued', 'in_progress', 'done', 'verified', 'not_happened', 'expired', 'refused'].sort()) && /status: 'expired'/.test(planJs) && /expire_grace_days: 14/.test(planJs)
      && !!readWf('SEO_Agent_AI_Growth.json').nodes.find(n => n.name === 'Prune AI Rank Actions'), '');

    // ---------------- AP10 the replay tool ----------------
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'air-replay-')); const inDir = path.join(tmp, 'in'), outDir = path.join(tmp, 'out'); fs.mkdirSync(inDir); fs.mkdirSync(outDir);
    const FR = FX.make({ seed: 'air-replay' }); for (const [t, rows] of Object.entries(FR.tables)) fs.writeFileSync(path.join(inDir, t + '.json'), JSON.stringify(rows));
    fs.writeFileSync(path.join(inDir, 'seo_ai_growth.json'), JSON.stringify([{ site_id: SITE, domain: D, run_id: 'grow_20261026_x', checked_at: '2026-10-26T10:00:00.000Z', actions_json: '[{"priority":1,"type":"bing","action":"Add the site to Bing"}]', earned_json: '[]', targets_json: '{}' }]));
    const RP = require('./ai_rank_replay');
    const logs = []; let rep = null;
    try { rep = await RP.main({ IN_DIR: inDir, OUT_DIR: outDir, WEEKS: '2', log: (s) => logs.push(String(s)) }); } catch (e) { rep = { error: String(e && e.stack || e) }; }
    const files = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
    const html = files.includes('replay.html') ? fs.readFileSync(path.join(outDir, 'replay.html'), 'utf8') : '';
    check('AP10 the replay runs the generated AI Growth workflow on a dump directory, offline (every outside request answered locally, none sent), and writes the memo HTML + one JSON per site and week',
      rep && !rep.error && rep.weeks === 2 && rep.sites === 2 && rep.network === 0 && files.includes('replay.html') && files.includes('summary.json') && files.filter(f => /^replay_site_.*\.json$/.test(f)).length === 4
      && /<title>/.test(html) && /This plan and the current one|old logic/i.test(html), J({ rep, files }).slice(0, 500));
    check('AP10 the replay prints counts and paths only (no row content, no key or token), and refuses an output folder inside the repository',
      logs.length > 0 && !logs.some(l => /sk-ant-|xoxb-|AIza|apikey|BEGIN PRIVATE|nova-ai\.example\/services|Which companies build/i.test(l))
      && await RP.main({ IN_DIR: inDir, OUT_DIR: path.join(__dirname, 'out_replay_test'), log: () => {} }).then(() => false, (e) => /inside the repository/.test(String(e.message))), J(logs).slice(0, 400));

    // ---------------- AP11 node diff ----------------
    const airIn = allWf.filter(([f, w]) => w.nodes.some(n => AIR_NODE.test(n.name))).map(([f]) => f);
    const kitIn = allWf.filter(([f, w]) => w.nodes.some(n => /const AIRF = \(\(\) => \{/.test((n.parameters || {}).jsCode || ''))).map(([f, w]) => f + ': ' + w.nodes.filter(n => /const AIRF = \(\(\) => \{/.test((n.parameters || {}).jsCode || '')).map(n => n.name).join(', '));
    const MON = ['AI Plan', 'Audit Candidates', 'BL Plan', 'Growth Plan', 'LB Plan', 'Pilot Plan', 'Pulse Plan'];
    const unexpected = allWf.flatMap(([f, w]) => w.nodes.filter(n => /const AIRF = \(\(\) => \{/.test((n.parameters || {}).jsCode || '')).filter(n => !(MON.includes(n.name) || ['Admin Action', 'Monitor Row (Admin)'].includes(n.name) || (f === 'SEO_Agent_Content_Cadence.json' && n.name === 'Cadence Plan') || (f === 'SEO_Agent_Link_Builder.json' && n.name === 'LB Assemble') || (f === 'SEO_Agent_AI_Growth.json' && n.name === 'Growth Report') || (f === 'SEO_Agent_AI_Growth.json' && AIR_NODE.test(n.name)))).map(n => f + ' / ' + n.name));
    check('AP11 the AIR nodes exist only in the AI Growth workflow; the AIRF kit appears elsewhere only in the monitors\' site list (settings.rank) and Site Admin\'s two nodes (D24: and P6\'s three on-mode consumers, Cadence Plan, LB Assemble, Growth Report)',
      J(airIn) === J(['SEO_Agent_AI_Growth.json']) && !unexpected.length, J({ airIn, unexpected, kitIn }).slice(0, 600));

    // ---------------- AP13 Bing's site list: not read -> unknown, never "not in Bing" (coordinator fix 2026-11-06, P1's replay) ----------------
    const bingCase = async (bing) => { const res = await runGrowth({ modes: { nova: 'shadow', acme: 'shadow' }, bing }); const items = ((res.r.runs['AI Rank Plan'] || []).slice(-1)[0] || [[]])[0].map(i => i.json);
      return Object.fromEntries(items.map(it => { const a = it.air || {}; return [it.site_id, { l03: (a.candidates || []).filter(c => c.lever === 'L03').length,
        s0: (a.diag || []).some(d => ((d.engines || {}).copilot || {}).stage === 'S0' && ((d.engines || {}).copilot || {}).sub === 'not_indexed'), err: it.error }]; })); };
    const bRead = await bingCase('read'), bUnread = await bingCase('unread'), bFailed = await bingCase('failed');
    const NV = 'site_nova-ai-example', AC = 'site_acme-erp-example';
    check('AP13 Bing\'s site list read without the site -> in_account false -> Copilot S0 not_indexed and the Bing step (L03); a site in the list gets neither',
      bRead[NV] && bRead[NV].l03 >= 1 && bRead[NV].s0 && bRead[AC] && bRead[AC].l03 === 0 && !bRead[AC].s0, J(bRead));
    check('AP13 Bing\'s site list not read (an empty answer, or the call failed) -> in_account null -> no Copilot S0 and no Bing step for any site',
      [bUnread, bFailed].every(b => b[NV] && b[AC] && [NV, AC].every(k => b[k].l03 === 0 && !b[k].s0 && !b[k].err)), J({ bUnread, bFailed }));

    // ---------------- AP12 kill switch ----------------
    const k = await runGrowth({ wf: wfFake, modes: { nova: 'shadow', acme: 'on' }, kill: true });
    const kAir = Object.keys(k.counts).filter(n => AIR_NODE.test(n)).sort();
    check('AP12 kill switch (seo_cache air:kill = 1) with sites in shadow and on: only the gate, the kill check and their IFs run; nothing is written; the report and callback as off',
      J(kAir) === J(['AI Rank Gate', 'AI Rank Live', 'Any AI Rank Live?', 'Any AI Rank?', 'Load AI Rank Cache', 'Load AI Rank Kill']) && !k.airWrites.length && J(k.report) === J(offF.report) && J(k.callback) === J(offF.callback)
      && J(k.writes) === J(offF.writes) && k.counts['Growth Report'] === 1, J({ kAir, w: k.airWrites.length }));
  });
};
module.exports.runGrowth = runGrowth; module.exports.shadowDiff = shadowDiff; module.exports.withFakeKits = withFakeKits;
