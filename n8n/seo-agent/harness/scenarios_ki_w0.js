// KIW0-1..KIW0-8 (KI W0 contract commit, 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md): the frozen interface the keyword-intelligence
// packages code against. They test SHAPES and RULES, never the skeleton's refusal as the end state: E2 replaces "not_available_yet" with the
// worker, and only KIW0-7's last case (a Trial / On website is still refused) changes then. A change that breaks any other check is a contract
// change (CONTRACTS.md first).
//   KIW0-1 tables: the four KI tables exactly as frozen (§2), the three seo_monitors settings last, after the AIR block
//   KIW0-2 Site Admin `monitors` validates the three settings (§1): normalised, '' clears, a bad value is a named error
//   KIW0-3 Monitor Row (Admin) stores them (given / cleared / kept), exact seo_monitors columns
//   KIW0-4 "Track my site" carries them as stored, whatever its body says, exact columns
//   KIW0-5 the front door: both modes, domain required, seeds capped, ETA 6 / 12, target ki; every other mode target main
//   KIW0-6 the generated wiring: the router, Start KI Run -> SEOagentKIntel1 without waiting, the skeleton's nodes, the manifest
//   KIW0-7 the skeleton refuses with the contract's callback (§4): killed / ki_off / not_available_yet, fails closed, nothing spent
//   KIW0-8 money and words: the cost rows on both sides (§7), the parity fixture (§6)
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, reset, guard, begin } = ctx;
  await guard('ki w0 contract', async () => {
    reset(); const SN = 'KIW0 (W0 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md): the keyword-intelligence contract - tables, settings, front door, skeleton, cost';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const J = (x) => String(JSON.stringify(x));
    const ROOT = path.join(__dirname, '..'); const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
    const TC = require('./table_cols.json');

    // ---- KIW0-1 tables ----
    const FROZEN = {
      KI_RUNS: ['site_id', 'domain', 'run_id', 'request_id', 'kind', 'market', 'location_code', 'language_code', 'mode', 'rule_version', 'started_at', 'finished_at', 'status', 'reason', 'sections_json', 'counts_json', 'cost_dfs_usd', 'cost_claude_usd', 'config_json'],
      KI_COMP: ['site_id', 'domain', 'market', 'comp_domain', 'class', 'class_basis', 'class_confidence', 'scored', 'score', 'score_low', 'score_high', 'serp_share', 'topic_sim', 'geo_match', 'ai_share', 'size_tag', 'seeds_seen', 'seeds_total', 'reasons_json', 'evidence_json', 'declared', 'status', 'status_by', 'first_seen', 'last_seen', 'misses', 'profile_json', 'run_id', 'updated_at'],
      KI_KW: ['site_id', 'domain', 'market', 'keyword', 'kw_key', 'sources_json', 'source_count', 'volume', 'volume_basis', 'volume_source', 'cpc', 'kd', 'trend_json', 'gsc_impressions', 'gsc_clicks', 'gsc_position', 'gsc_page', 'intent', 'stage', 'stage_evidence_json', 'intent_confidence', 'needs_review', 'gate', 'gate_reason', 'gate_detail', 'fit', 'demand', 'win', 'value', 'gap', 'score', 'score_low', 'score_high', 'low_confidence', 'verdict', 'cluster_id', 'is_head', 'cluster_size', 'cluster_demand', 'serp_read_at', 'top10_json', 'page_action', 'page_url', 'cannibal_json', 'competitors_json', 'striking', 'run_id', 'fetched_at', 'updated_at'],
      KI_GAPS: ['gap_id', 'site_id', 'domain', 'market', 'type', 'keyword', 'cluster_id', 'competitor_domains_json', 'client_position', 'evidence_json', 'sample_note', 'action', 'action_target', 'credits', 'status', 'run_id', 'created_at', 'updated_at'] };
    check('KIW0-1 the four KI tables carry exactly the frozen columns (CONTRACTS.md §2)', Object.entries(FROZEN).every(([k, v]) => J(TC[k]) === J(v)), J(Object.keys(FROZEN).filter(k => J(TC[k]) !== J(FROZEN[k]))));
    const KIM = ['ki_mode', 'ki_refresh', 'ki_max_competitors'];
    check('KIW0-1 seo_monitors ends with the three KI settings, right after the five AIR settings', J(TC.KI_MONITORS) === J(KIM) && J(TC.MONITORS.slice(-3)) === J(KIM) && TC.MONITORS[TC.MONITORS.length - 4] === 'ai_rank_brave', J(TC.MONITORS.slice(-6)));
    const lc = rd('ladder_common.py');
    check('KIW0-1 table names and the sync_tables pairs (<NAME>_TABLE / <NAME>_COLS, so sync_tables.py adds a later column)',
      ["KI_RUNS_TABLE = 'seo_ki_runs'", "KI_COMP_TABLE = 'seo_ki_competitors'", "KI_KW_TABLE = 'seo_ki_keywords'", "KI_GAPS_TABLE = 'seo_ki_gaps'"].every(x => lc.includes(x)), '');

    // ---- KIW0-2 Site Admin validation ----
    const D = 'nova-ki.example', SITE = 'site_nova-ki-example';
    const aa = async (monitors) => (await run('Admin Action', { body: { action: 'monitors', domain: D, monitors } }))[0].json.monitors;
    reset(); const v1 = await aa({ ki_mode: ' Trial ', ki_refresh: 'no', ki_max_competitors: '3' });
    reset(); const v2 = await aa({ ki_mode: 'ON', ki_refresh: true, ki_max_competitors: 5 });
    reset(); const v3 = await aa({ ki_mode: '', ki_max_competitors: '' });
    check('KIW0-2 Site Admin normalises the KI settings it is given; "" is handed on as a clear',
      v1.ki_mode === 'trial' && v1.ki_refresh === false && v1.ki_max_competitors === 3 && v2.ki_mode === 'on' && v2.ki_refresh === true && v2.ki_max_competitors === 5 && v3.ki_mode === '' && v3.ki_max_competitors === '', J({ v1, v2, v3 }));
    const bad = [[{ ki_mode: 'shadow' }, /ki_mode must be off, trial or on/], [{ ki_refresh: 'perhaps' }, /ki_refresh must be true or false/],
      [{ ki_max_competitors: 6 }, /ki_max_competitors must be a whole number from 1 to 5/], [{ ki_max_competitors: '2.5' }, /ki_max_competitors must be a whole number from 1 to 5/], [{ ki_max_competitors: 0 }, /from 1 to 5/]];
    const badOk = [];
    for (const [m, re] of bad) { reset(); badOk.push((await H.expectError('Admin Action', { body: { action: 'monitors', domain: D, monitors: m } }, re)).ok); }
    check('KIW0-2 a bad KI value is refused with its reason (nothing is stored)', badOk.every(Boolean), J(badOk));

    // ---- KIW0-3 Monitor Row (Admin) ----
    const stored = { site_id: SITE, domain: D, ki_mode: 'trial', ki_refresh: 'false', ki_max_competitors: 4, ai_rank_mode: 'shadow' };
    const adminRow = async (given, old = stored) => { reset(); const a = (await run('Admin Action', { body: { action: 'monitors', domain: D, monitors: given } }))[0].json;
      mock('Admin Action', [{ json: a }]); mock('Load Monitors (Admin)', [{ json: old }]); return (await run('Monitor Row (Admin)', [{ json: a }]))[0].json; };
    const r1 = await adminRow({ ki_mode: 'on', ki_max_competitors: 2 });
    const r2 = await adminRow({ ki_mode: '', ki_refresh: '', ki_max_competitors: '' });
    const r3 = await adminRow({ backlinks: false });
    const r4 = await adminRow({ ki_mode: 'Trial' }, {});
    check('KIW0-3 Monitor Row (Admin): a given value is stored, "" clears to empty, a field not given keeps the stored value, a new row starts empty (= off)',
      r1.ki_mode === 'on' && r1.ki_max_competitors === 2 && r1.ki_refresh === false && r2.ki_mode === null && r2.ki_refresh === null && r2.ki_max_competitors === null
      && r3.ki_mode === 'trial' && r3.ki_refresh === false && r3.ki_max_competitors === 4 && r3.backlinks === false && r3.ai_rank_mode === 'shadow' && r4.ki_mode === 'trial' && r4.ki_refresh === null && r4.ki_max_competitors === null,
      J([r1, r2, r3, r4].map(r => KIM.map(k => r[k]))));
    check('KIW0-3 Monitor Row (Admin) writes exactly the seo_monitors columns', [r1, r2, r3, r4].every(r => J(Object.keys(r).sort()) === J(TC.MONITORS.slice().sort())), J(Object.keys(r1).filter(k => !TC.MONITORS.includes(k))));

    // ---- KIW0-4 Monitor Row (Track) ----
    reset(); mock('Normalize Input', [{ json: { domain: D, competitors: [], monitor_input: { ki_mode: 'off', ki_refresh: true, ki_max_competitors: 1 }, request_id: 'r1' } }]); mock('Load Monitors (Track)', [{ json: { ...stored, ki_mode: 'on' } }]);
    const t1 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    reset(); mock('Normalize Input', [{ json: { domain: D, competitors: [], monitor_input: { ki_mode: 'on' }, request_id: 'r2' } }]); mock('Load Monitors (Track)', [{ json: {} }]);
    const t2 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('KIW0-4 "Track my site" carries the stored KI settings and never takes them from its body (the app saving tracking never switches KI); a new site stays empty',
      t1.ki_mode === 'on' && t1.ki_refresh === false && t1.ki_max_competitors === 4 && t2.ki_mode === null && t2.ki_refresh === null && t2.ki_max_competitors === null, J([t1, t2].map(r => KIM.map(k => r[k]))));
    check('KIW0-4 Monitor Row (Track) writes exactly the seo_monitors columns', [t1, t2].every(r => J(Object.keys(r).sort()) === J(TC.MONITORS.slice().sort())), J(Object.keys(t1).filter(k => !TC.MONITORS.includes(k))));

    // ---- KIW0-5 the front door ----
    const qv = async (body) => { reset(); return (await run('Quick Validate', { headers: { 'x-forwarded-for': 'app:org-ki' }, body }))[0].json; };
    const B = { country: 'United Arab Emirates', domain: D, callback_url: 'https://app.example/api/hooks/n8n/tok' };
    const q1 = await qv({ mode: 'competitors', ...B }); const q2 = await qv({ mode: 'keyword_research', ...B, seeds: ['erp uae'] });
    const q3 = await qv({ mode: 'competitors', country: 'United Arab Emirates', callback_url: B.callback_url });
    const q4 = await qv({ mode: 'keyword_research', ...B, seeds: Array.from({ length: 21 }, (_, i) => 'seed ' + i) });
    const q5 = await qv({ mode: 'keyword_research', ...B, seeds: 'erp uae' });
    const q6 = await qv({ mode: 'backlinks', ...B }); const q7 = await qv({ mode: 'keyword', keyword: 'erp uae', ...B });
    check('KIW0-5 Quick Validate accepts both KI modes (ETA 6 / 12 minutes) and sends them to the KI workflow',
      q1.ok && q2.ok && q1.target === 'ki' && q2.target === 'ki' && q1.estimated_minutes === 6 && q2.estimated_minutes === 12 && q1.forward.body.request_id === q1.request_id, J({ q1: [q1.ok, q1.error, q1.target, q1.estimated_minutes], q2: [q2.ok, q2.error, q2.target, q2.estimated_minutes] }));
    check('KIW0-5 a KI request needs the website; seeds are a list of at most 20', !q3.ok && /domain is required/.test(q3.error) && !q4.ok && /at most 20/.test(q4.error) && !q5.ok && /seeds must be an array/.test(q5.error), J([q3.error, q4.error, q5.error]));
    check('KIW0-5 every other mode still goes to the main workflow', q6.ok && q6.target === 'main' && q7.ok && q7.target === 'main' && q6.estimated_minutes === 5, J([q6.target, q7.target]));
    const k1 = (await run('KI Input', [{ json: q2.forward }]))[0].json;
    check('KIW0-5 the skeleton reads the forwarded request (site id the engine\'s rule, request id the front door\'s, callback kept)',
      k1.kind === 'keyword_research' && k1.stage === 'ki_research' && k1.site_id === SITE && k1.request_id === q2.request_id && k1.callback_url === B.callback_url && J(k1.seeds) === J(['erp uae']) && k1.rule_version === 'ki-1', J(k1));

    // ---- KIW0-6 the generated wiring ----
    const api = JSON.parse(rd('workflows', 'SEO_Agent_API.json'))[0];
    const outs = (w, n) => ((w.connections[n] || {}).main || []).map(l => (l || []).map(t => t.node));
    const sk = api.nodes.find(n => n.name === 'Start KI Run') || { parameters: { workflowId: {} } };
    check('KIW0-6 the front door: Prepare Payload -> Start Which Run? -> [Start KI Run | Start SEO Run] -> Forget Old Requests; Start KI Run starts SEOagentKIntel1 without waiting',
      J(outs(api, 'Prepare Payload')) === J([['Start Which Run?']]) && J(outs(api, 'Start Which Run?')) === J([['Start KI Run'], ['Start SEO Run']]) && J(outs(api, 'Start KI Run')) === J([['Forget Old Requests']])
      && sk.parameters.workflowId.value === 'SEOagentKIntel1' && sk.parameters.options.waitForSubWorkflow === false, J({ pp: outs(api, 'Prepare Payload'), r: outs(api, 'Start Which Run?') }));
    const W = require('./ki_wiring.json'); const ki = JSON.parse(rd('workflows', W.file))[0];
    // E2 (2026-11-08): the skeleton became the worker; what stays frozen is the door: the request, then the settings and the kill switch, then the
    // gate, and nothing paid or written on the way to a refusal (the worker's own wiring is scenarios_ki_e2.js KIE2-1)
    const reachK = (w, from, stop) => { const seen = new Set(); const todo = [from]; while (todo.length) { const n = todo.pop(); if (seen.has(n) || n === stop) continue; seen.add(n); for (const l of ((w.connections[n] || {}).main || [])) for (const t of (l || [])) todo.push(t.node); } return seen; };
    const beforeGate = [...reachK(ki, 'Manual Run', 'KI Gate')];
    check('KIW0-6 the worker keeps the door: one trigger, settings and kill switch read before the gate, nothing paid or written before it, one final callback without a retry',
      ki.id === 'SEOagentKIntel1' && ki.active === false && ['KI Input', 'Load Monitors (KI)', 'Load Kill Switch (KI)', 'KI Gate', 'POST KI Report', 'Manual Run'].every(n => W.nodes.includes(n))
      && beforeGate.includes('Load Monitors (KI)') && beforeGate.includes('Load Kill Switch (KI)') && W.callback.retry === false
      && !ki.nodes.some(n => beforeGate.includes(n.name) && (/langchain/.test(n.type) || /dataforseo/i.test(JSON.stringify(n.parameters || {})) || (n.type === 'n8n-nodes-base.dataTable' && !['get', 'create'].includes(n.parameters.operation)))), J(beforeGate));
    const M = JSON.parse(rd('deploy_manifest.json'));
    check('KIW0-6 deploy_manifest.json imports and publishes it (the front door starts it through Execute Workflow, so it must be published)',
      M.workflows.includes(W.file) && M.publish.includes('SEOagentKIntel1') && !(M.never_deploy || []).includes('SEOagentKIntel1'), J(M.publish.slice(-3)));

    // ---- KIW0-7 the refusals ----
    const gate = async (kind, monRows, killRows) => { reset();
      const inp = (await run('KI Input', [{ json: { body: { mode: kind, ...B, request_id: 'req-1' } } }]))[0].json;
      mock('Load Monitors (KI)', monRows.map(j => ({ json: j }))); mock('Load Kill Switch (KI)', killRows.map(j => ({ json: j })));
      return (await run('KI Gate', [{ json: {} }]))[0].json; };
    const mon = (m) => [{ site_id: SITE, domain: D, ki_mode: m }];
    const cases = {
      killed: await gate('competitors', mon('on'), [{ key: 'ki:kill', value: '1' }]),
      killUnread: await gate('competitors', mon('on'), [{ error: 'table not found' }]),
      noRow: await gate('competitors', [{}], [{}]),
      off: await gate('keyword_research', mon('off'), [{}]),
      typo: await gate('keyword_research', mon('yes'), [{}]),
      monUnread: await gate('competitors', [{ error: 'timeout' }], [{}]),
      killOff: await gate('competitors', mon('trial'), [{ key: 'ki:kill', value: '0' }]),
      trial: await gate('competitors', mon('Trial'), [{}]),
      on: await gate('keyword_research', mon('on'), [{}]) };
    const R = Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, v.callback_body ? v.callback_body.reason : (v.refused ? 'refused without a body' : 'runs')]));
    check('KIW0-7 the kill switch stops every run and fails closed (unreadable = killed); off / empty / unknown / unreadable settings = ki_off; Trial and On reach the worker (E2: they run)',
      J(R) === J({ killed: 'killed', killUnread: 'killed', noRow: 'ki_off', off: 'ki_off', typo: 'ki_off', monUnread: 'ki_off', killOff: 'runs', trial: 'runs', on: 'runs' }), J(R));
    const BASE = ['stage', 'status', 'reason', 'request_id', 'run_id', 'domain', 'market', 'mode', 'rule_version', 'sections', 'summary', 'labels', 'run_ledger', 'run_cost_estimate_usd', 'run_cost_estimate_basis', 'run_cost_estimate_state'];
    // E2: the refusal shape is checked on two refused cases of each kind (killed / off); Trial and On runs answer through the worker (KIE2-12)
    const cb = cases.killOff.callback_body || (await gate('competitors', mon('trial'), [{ key: 'ki:kill', value: '1' }])).callback_body, rb = cases.off.callback_body;
    const REFUSED = Object.fromEntries(Object.entries(cases).filter(([, v]) => v.refused));
    check('KIW0-7 the refusal is the contract\'s final callback (§4): its stage, status refused, the request id, every base key, the mode-specific lists empty, nothing spent',
      cb.stage === 'ki_competitors' && rb.stage === 'ki_research' && Object.values(REFUSED).every(c => c.callback_body.status === 'refused' && c.callback_body.run_cost_estimate_usd === 0 && c.callback_url === B.callback_url && c.callback_body.request_id === 'req-1')
      && BASE.every(k => k in cb && k in rb) && ['competitors', 'listings', 'platforms'].every(k => J(cb[k]) === '[]') && ['clusters', 'striking', 'questions', 'plan'].every(k => J(rb[k]) === '[]') && J(rb.gaps_summary) === '{}'
      && cb.mode === 'trial' && rb.mode === 'off' && cases.off.callback_body.mode === 'off' && cb.rule_version === 'ki-1' && !cases.trial.refused && !cases.on.refused, J({ cb, rb }));

    // ---- KIW0-8 money and words ----
    const CC = new Function(rd('v5', 'code', '_cost_cal.js') + '\nreturn CC;')();
    check('KIW0-8 the engine estimates: competitors $0.35 search data, keyword_research $0.90 (CONTRACTS.md §7), no Claude row (FX-L: the worker calls no model), and keysFor finds them',
      CC.DFS_EST.competitors === 0.35 && CC.DFS_EST.keyword_research === 0.9 && CC.EST.competitors === 0 && CC.EST.keyword_research === 0
      && J(CC.keysFor('dfs', { mode: 'competitors' })) === J(['competitors']) && J(CC.keysFor('ai', { mode: 'keyword_research' })) === J(['keyword_research']), J({ e: [CC.EST.competitors, CC.EST.keyword_research], d: [CC.DFS_EST.competitors, CC.DFS_EST.keyword_research] }));
    const costTs = fs.readFileSync(path.join(ROOT, '..', '..', 'app', 'shared', 'src', 'cost.ts'), 'utf8');
    const row = (k) => { const m = costTs.match(new RegExp('\\n  ' + k + ': \\{ ai: ([0-9.]+), dfs: ([0-9.]+),')); return m ? [Number(m[1]), Number(m[2])] : null; };
    check('KIW0-8 the app mirror (app/shared/src/cost.ts) carries the same two rows', J(row('competitors')) === J([CC.EST.competitors, CC.DFS_EST.competitors]) && J(row('keyword_research')) === J([CC.EST.keyword_research, CC.DFS_EST.keyword_research]), J([row('competitors'), row('keyword_research')]));
    const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ki_parity.json'), 'utf8'));
    check('KIW0-8 the parity fixture: rule ki-1, the five verdict words (FX-L: unknown = not judged yet), the Win thresholds, a case per boundary',
      P.rule_version === 'ki-1' && J(Object.keys(P.verdicts)) === J(['go', 'months', 'hard', 'gated', 'unknown']) && P.thresholds.go === 0.6 && P.thresholds.months === 0.35 && P.cases.length >= 8
      && P.cases.every(c => ['go', 'months', 'hard', 'gated', 'unknown'].includes(c.verdict)) && !/[—‘’“”…]/.test(JSON.stringify(P)), J(P.thresholds));
  });
};
