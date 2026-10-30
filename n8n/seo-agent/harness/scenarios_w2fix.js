// W2-FIX (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/fixes/W2-FIX.md): the leftovers of AI visibility wave 2.
//   W2FIX-1  the front door reserves the website's whole AI panel (the app's quote, CC.pick) instead of its flat table row
//   W2FIX-2  units_json is blanked on weekly rows older than 70 days, by a scoped update after the week is stored
//   W2FIX-3  the app's Site Admin `monitors` bodies (fixtures_platform_admin.json, `npm run export:payloads`) store every wave-2 key, and
//            "Track my site" keeps the W2-E3 options
//   W2FIX-4  the repeat pilot has a door (SEO Agent - AI Pilot API), is in the deploy manifest, prices first and spends only on `confirm: true`
// Called from scenarios_v5.js beside scenarios_w2e2.js; reads only the generated code (code_v4), the generated workflows and wiring, and the
// app's exported fixtures.
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const ROOT = path.join(__dirname, '..');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 600), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 450))); };
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const wfOf = (f) => { const w = readJson(path.join(ROOT, 'workflows', f)); return Array.isArray(w) ? w[0] : w; };
  const TC = readJson(path.join(__dirname, 'table_cols.json'));

  // ===================================================================================================================================
  await guard('W2FIX-1 the front door reserves the website\'s whole AI panel', async () => {
    reset(); const SN = 'W2FIX-1 — an on-demand AI visibility check reserves the app\'s quote of the website\'s whole panel (never less than the table row, at most $150) in Rate Limit and Run Ledger Row; every other mode is untouched';
    begin(SN); const check = mkCheck(SN);
    for (const f of ['Rate_Limit.js', 'Run_Ledger_Row.js']) {
      const CC = kitOf(f, 'CC'); const cal = CC.readCal([]);
      const base = CC.pick('dfs', { mode: 'ai_visibility' }, cal), baseAi = CC.pick('ai', { mode: 'ai_visibility' }, cal);
      const big = CC.pick('dfs', { mode: 'ai_visibility', panel_quote_dfs_usd: 10.6814, panel_quote_ai_usd: 0.9, panel_quote_panel: 200 }, cal);
      const bigAi = CC.pick('ai', { mode: 'ai_visibility', panel_quote_dfs_usd: 10.6814, panel_quote_ai_usd: 0.9, panel_quote_panel: 200 }, cal);
      check(f + ': the 200-question quote is reserved ($10.68 of search data, $0.90 of Claude), with the basis saying so', big.usd === 10.6814 && bigAi.usd === 0.9 && /whole panel as quoted \(\$10\.6814, 200 questions/.test(big.basis) && big.panel_quoted === 10.6814, JSON.stringify([big, bigAi]));
      const small = CC.pick('dfs', { mode: 'ai_visibility', panel_quote_dfs_usd: 0.2 }, cal);
      check(f + ': a quote below the table row never lowers the reservation (a caller can only make the guard stricter)', small.usd === base.usd && base.usd > 0.2 && small.panel_quoted === 0, JSON.stringify([small, base]));
      const huge = CC.pick('dfs', { mode: 'ai_visibility', panel_quote_dfs_usd: 9000 }, cal);
      check(f + ': a quote is taken up to $150 (AIP max_run_usd), never above', huge.usd === 150, JSON.stringify(huge));
      const bl = CC.pick('dfs', { mode: 'backlinks', panel_quote_dfs_usd: 50 }, cal), blBase = CC.pick('dfs', { mode: 'backlinks' }, cal);
      check(f + ': another mode ignores a quote', bl.usd === blBase.usd && baseAi.usd > 0, JSON.stringify([bl, blBase]));
    }
    // the app's body (fixtures_platform.json, the server's extra) through Quick Validate and Normalize Input, then Run Ledger Row
    const P = readJson(path.join(__dirname, 'fixtures_platform.json'));
    const fq = P.find(f => f.body.mode === 'ai_visibility' && f.body.panel_quote);
    const fn = P.find(f => f.body.mode === 'ai_visibility' && !f.body.panel_quote);
    check('the app\'s fixtures carry an on-demand check with the server\'s quote and one without', !!fq && !!fn && fq.body.panel_quote.dfs_usd > 1, JSON.stringify(fq && fq.body.panel_quote));
    if (!fq || !fn) return;
    const norm = async (f) => { const qv = await run('Quick Validate', { headers: f.headers, body: f.body }); delete store['Start Form']; return (await run('Normalize Input', qv[0].json.forward))[0].json; };
    const nq = await norm(fq);
    check('Normalize Input carries the quote (dfs, Claude, panel size)', nq.panel_quote_dfs_usd === fq.body.panel_quote.dfs_usd && nq.panel_quote_ai_usd === fq.body.panel_quote.ai_usd && nq.panel_quote_panel === 200, JSON.stringify({ d: nq.panel_quote_dfs_usd, a: nq.panel_quote_ai_usd, p: nq.panel_quote_panel, err: nq.validation_error }));
    mock('Load Cost Calibration', [{ json: {} }]);
    const row = (await run('Run Ledger Row', [{ json: {} }]))[0].json;
    check('Run Ledger Row reserves the quote on the front door\'s row (the parent still settles $0 as handed off, R81)', row.dfs_est_usd === fq.body.panel_quote.dfs_usd && row.est_usd === fq.body.panel_quote.ai_usd && row.mode === 'ai_visibility' && /whole panel as quoted/.test(row.cost_basis), JSON.stringify({ dfs: row.dfs_est_usd, ai: row.est_usd, basis: row.cost_basis }));
    const nn = await norm(fn);
    check('without a quote (an older app, the API) the figures are the table\'s, as before', nn.panel_quote_dfs_usd === 0 && nn.panel_quote_ai_usd === 0, JSON.stringify(nn.panel_quote_dfs_usd));
    const rowN = (await run('Run Ledger Row', [{ json: {} }]))[0].json;
    check('... and Run Ledger Row reserves the table row', rowN.dfs_est_usd < 2 && !/whole panel/.test(rowN.cost_basis), JSON.stringify(rowN.dfs_est_usd));
    const kw = P.find(f => f.body.mode === 'keyword');
    const nk = await norm({ ...kw, body: { ...kw.body, panel_quote: { dfs_usd: 40, ai_usd: 9, panel: 500 } } });
    check('a quote sent with another mode is dropped by Normalize Input', nk.panel_quote_dfs_usd === 0 && nk.panel_quote_ai_usd === 0 && nk.panel_quote_panel === 0, JSON.stringify(nk.panel_quote_dfs_usd));
  });

  // ===================================================================================================================================
  await guard('W2FIX-2 units_json trimmed after 70 days', async () => {
    reset(); const SN = 'W2FIX-2 — data size: units_json (the per-answer record, ~145 KB a week at 500 x 9) is blanked on this site\'s weekly rows aged 70-120 days, after the week is stored; the readers look back at most 60 days';
    begin(SN); const check = mkCheck(SN);
    const W = readJson(path.join(__dirname, 'w2e1_wiring.json')); const t = W['Trim Old Units'];
    const conds = (x) => ((x && x.filters && x.filters.conditions) || []).map(c => c.keyName + ' ' + c.condition + ' ' + String(c.keyValue).replace(/\s+/g, ''));
    check('an UPDATE of units_json to "" (nothing else) on this site\'s rows aged 70-120 days, once a run, never failing it', t && t.operation === 'update' && JSON.stringify(t.values) === JSON.stringify({ units_json: '' }) && t.executeOnce === true && t.onError === 'continueRegularOutput'
      && conds(t).some(c => /^site_id .*=== '%' \? 'like' : 'eq'.*ManualRun/.test(c)) && conds(t).some(c => /^units_json isNotEmpty/.test(c))   /* R-E2 exact site, R-E7 only rows not trimmed yet */ && conds(t).some(c => /^checked_at lt .*Date\.now\(\)-70\*864e5/.test(c)) && conds(t).some(c => /^checked_at gte .*Date\.now\(\)-120\*864e5/.test(c)) && conds(t).length === 4, JSON.stringify(t));
    check('it runs after the answers\' own trim (so after the week\'s row and the run\'s done state are saved) and before the question state', t && t.from.join() === 'Trimmed (AI)' && t.to.join() === 'Trimmed Units (AI)', JSON.stringify(t && [t.from, t.to]));
    const WR = readJson(path.join(__dirname, 'w2e3_wiring.json'))['SEO_Agent_AI_Visibility.json'];
    check('the table is seo_ai_visibility', WR.dt['Trim Old Units'] && WR.dt['Trim Old Units'].table === 'seo_ai_visibility' && WR.dt['Trim Old Units'].operation === 'update', JSON.stringify(WR.dt['Trim Old Units']));
    const lv = ((WR.dt['Load AI Visibility'] || {}).filters || {}).conditions || [];
    const back = lv.map(c => (String(c.keyValue).match(/Date\.now\(\) - (\d+) \* 864e5/) || [])[1]).filter(Boolean).map(Number);
    check('the tracker loads 60 days of weekly rows (the 28-day window and an action\'s 28 days before and after are inside it), so 70 days never cuts a record a run reads', back.length === 1 && back[0] === 60 && back[0] < 70, JSON.stringify(lv));
    const AVX = kitOf('AI_Metrics.js', 'AVX');
    const u = AVX.unpackUnits('');
    check('a blanked record reads as "no per-answer record" (the 28-day window leaves the row out and counts it), never an error', u === null || u === undefined || (typeof u === 'object' && !(u.units || []).length), JSON.stringify(u));
  });

  // ===================================================================================================================================
  await guard('W2FIX-3 the app\'s settings saves reach the stored row', async () => {
    reset(); const SN = 'W2FIX-3 — the website settings\' Site Admin `monitors` bodies (built by the app\'s siteAdminMonitorsBody) store every wave-2 key under its own name: alert rules, share-of-voice set, Claude weekly, pulse engines, persona test, fan-out check, market trend; "Track my site" keeps the W2-E3 options';
    begin(SN); const check = mkCheck(SN);
    const A = readJson(path.join(__dirname, 'fixtures_platform_admin.json'));
    check('the app exported its Site Admin monitors bodies (4 cases: the three wave-2 saves and the index coverage settings)', A.length === 4 && A.some(f => /index/i.test(f.name) && 'index_watch' in (f.expect || {}) && 'index_daily_cap' in (f.expect || {})), A.map(f => f.name).join(' | '));
    const MC = TC.MONITORS;
    for (const f of A) {
      reset();
      const v = (await run('Admin Validate', { body: f.body }))[0].json;
      check(f.name + ' / Admin API accepts it', v.ok === true, v.error);
      const a = (await run('Admin Action', v.forward))[0].json;
      mock('Load Monitors (Admin)', [{ json: f.stored }]);
      const r = (await run('Monitor Row (Admin)', store['Load Monitors (Admin)']))[0].json;
      const wrong = Object.entries(f.expect).filter(([k, want]) => { const got = r[k]; if (Array.isArray(want)) { try { return JSON.stringify(JSON.parse(got || '[]')) !== JSON.stringify(want); } catch (e) { return true; } } return JSON.stringify(got) !== JSON.stringify(want); })
        .map(([k, want]) => k + ': got ' + JSON.stringify(r[k]) + ', want ' + JSON.stringify(want));
      check(f.name + ' / stored as the app meant (exact columns)', !wrong.length && Object.keys(r).length === MC.length && MC.every(c => c in r) && a.action === 'monitors', wrong.join('; ') || JSON.stringify(Object.keys(r).filter(k => !MC.includes(k))));
    }
    // "Track my site" with the options (fixtures_platform.json), through Normalize Input into Monitor Row (Track)
    const P = readJson(path.join(__dirname, 'fixtures_platform.json'));
    const ft = P.find(f => f.name === 'track with the AI wave-2 options');
    check('the app\'s fixtures carry a "Track my site" with the W2-E3 options', !!ft, '');
    if (!ft) return;
    reset();
    const qv = await run('Quick Validate', { headers: ft.headers, body: ft.body }); delete store['Start Form'];
    const n = (await run('Normalize Input', qv[0].json.forward))[0].json;
    check('Normalize Input passes the options into monitor_input', n.monitor_input && n.monitor_input.ai_claude_weekly === true && n.monitor_input.ai_pulse_engines === 'chatgpt, perplexity' && n.monitor_input.ai_fanout_check === 25 && n.monitor_input.ai_demand_market === true && n.monitor_input.ai_persona_context === false, JSON.stringify(n.monitor_input));
    mock('Load Monitors (Track)', [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', ai_persona_context: true, ai_sov_set: 'rival.com', ai_alert_rules_json: '[]' } }]);
    const tr = (await run('Monitor Row (Track)', store['Load Monitors (Track)']))[0].json;
    check('Monitor Row (Track) stores them; persona switched off by the save; the set and the rules kept (Site Admin only)', tr.ai_claude_weekly === true && tr.ai_pulse_engines === 'chatgpt, perplexity' && tr.ai_fanout_check === 25 && tr.ai_demand_market === true && tr.ai_persona_context === false && tr.ai_sov_set === 'rival.com' && tr.ai_alert_rules_json === '[]' && Object.keys(tr).length === MC.length, JSON.stringify(tr));
  });

  // ===================================================================================================================================
  await guard('W2FIX-4 the repeat pilot has a door', async () => {
    reset(); const SN = 'W2FIX-4 — the repeat pilot: POST /webhook/seo-ai-pilot (API key) answers 202 and then starts SEOagentAIPilot1; only a literal confirm: true spends; both workflows are imported and published by every deploy, neither is scheduled; the quote callback says whether it can be confirmed and why not';
    begin(SN); const check = mkCheck(SN);
    const wf = wfOf('SEO_Agent_AI_Pilot_API.json'); const N = Object.fromEntries(wf.nodes.map(n => [n.name, n])); const C = wf.connections;
    const hook = N['AI Pilot API'];
    check('a webhook POST seo-ai-pilot behind the API key credential, answered by a response node', hook && hook.parameters.path === 'seo-ai-pilot' && hook.parameters.httpMethod === 'POST' && hook.parameters.authentication === 'headerAuth' && hook.parameters.responseMode === 'responseNode' && hook.credentials && hook.credentials.httpHeaderAuth && hook.credentials.httpHeaderAuth.id === 'SEOcredApiHeader' && !!hook.webhookId, JSON.stringify(hook && hook.parameters));
    const nexts = (n) => ((C[n] || {}).main || []).map(l => (l || []).map(t => t.node));
    check('answer first (202), then start the pilot as its own execution (no wait)', JSON.stringify(nexts('Pilot API OK?')) === JSON.stringify([['Respond Pilot Accepted'], ['Respond Pilot Bad Request']]) && nexts('Respond Pilot Accepted')[0][0] === 'Pilot Payload' && nexts('Pilot Payload')[0][0] === 'Start AI Pilot'
      && N['Respond Pilot Accepted'].parameters.options.responseCode === 202 && N['Start AI Pilot'].parameters.workflowId.value === 'SEOagentAIPilot1' && N['Start AI Pilot'].parameters.options.waitForSubWorkflow === false, JSON.stringify(C));
    check('neither workflow has a schedule', !wf.nodes.some(n => /schedule|cron/i.test(n.type)) && !wfOf('SEO_Agent_AI_Pilot.json').nodes.some(n => /schedule|cron/i.test(n.type)), '');
    const M = readJson(path.join(ROOT, 'deploy_manifest.json'));
    check('deploy_manifest.json imports and publishes both (the pilot is started through Execute Workflow, so it must be published); neither is on never_deploy', ['SEO_Agent_AI_Pilot.json', 'SEO_Agent_AI_Pilot_API.json'].every(f => M.workflows.includes(f)) && ['SEOagentAIPilot1', 'SEOagentAIPilAPI'].every(i => M.publish.includes(i)) && !['SEOagentAIPilot1', 'SEOagentAIPilAPI'].some(i => (M.never_deploy || []).includes(i)), JSON.stringify([M.workflows.slice(-3), M.publish.slice(-3)]));
    const V = async (b) => (await run('Pilot API Validate', [{ json: { body: b } }]))[0].json;
    const v0 = await V({ domain: 'https://www.Northwind-ERP.com/', callback_url: 'https://api.example.com/api/hooks/n8n/x', request_id: 'app-pilot-1' });
    check('a price request: valid, confirm false, the domain normalised, the caller\'s request id kept', v0.ok && v0.confirm === false && v0.domain === 'northwind-erp.com' && v0.request_id === 'app-pilot-1' && v0.email === '', JSON.stringify(v0));
    const v1 = await V({ domain: 'northwind-erp.com', confirm: true });
    check('a confirmation: confirm true', v1.ok && v1.confirm === true, JSON.stringify(v1));
    const v2 = await V({ domain: 'northwind-erp.com', confirm: 'yes' });
    const v3 = await V({ confirm: true });
    const v4 = await V({ domain: 'northwind-erp.com', callback_url: 'javascript:alert(1)' });
    check('refused: confirm that is not a boolean, no website, a callback that is not http(s)', !v2.ok && /confirm/.test(v2.error) && !v3.ok && /domain or site_id/.test(v3.error) && !v4.ok && /callback_url/.test(v4.error), JSON.stringify([v2.error, v3.error, v4.error]));
    // the quote callback the app shows (Pilot Report after an unconfirmed plan), and the refusal of a panel too small to measure
    const SID = 'site_northwind-erp-com', DOM = 'northwind-erp.com';
    const load = (trig, n) => { reset(); mock('Manual Run', [{ json: trig }]); mock('Load Sites', [{ json: { site_id: SID, domain: DOM, status: 'active', country: 'United Arab Emirates', location_code: 2784, language_code: 'en' } }]);
      mock('Load Monitors', [{ json: { site_id: SID, domain: DOM, ai_engines: 'chatgpt, gemini, ai_mode', ai_prompts_max: 50 } }]); mock('Load Profiles', [{ json: {} }]);
      mock('Load AI Prompts', Array.from({ length: n }, (_, i) => ({ json: { prompt_id: 'q' + i, prompt: 'Which UAE firm handles e-invoicing question ' + i + '?', kind: 'recommend', site_id: SID, domain: DOM, status: 'active', cluster: 'c' + (i % 4), source: 'auto' } })));
      mock('Load AI Visibility', [{ json: {} }]); mock('Load Cache (AI)', [{ json: {} }]); };
    load({ domain: DOM, callback_url: 'https://api.example.com/api/hooks/n8n/x', request_id: 'app-pilot-1' }, 12);
    await run('AI Plan', [{ json: {} }], { code: 'Pilot__AI_Plan' });
    const q = (await run('Pilot Report', [{ json: {} }], { code: 'Pilot__Pilot_Report' }))[0].json;
    check('the quote: stage ai_pilot_quote, the price, can_confirm true, the reason in words, the caller\'s request id', q.stage === 'ai_pilot_quote' && q.can_confirm === true && q.quote.price_usd > 0 && q.quote.price_usd <= 4 && /confirm: true/.test(q.reason) && q.request_id === 'app-pilot-1' && q.pilot === null, JSON.stringify({ s: q.stage, c: q.can_confirm, r: q.reason, p: q.quote.price_usd }));
    load({ domain: DOM, callback_url: 'https://api.example.com/api/hooks/n8n/x', request_id: 'app-pilot-2', confirm: true }, 2);
    await run('AI Plan', [{ json: {} }], { code: 'Pilot__AI_Plan' });
    const z = (await run('Pilot Report', [{ json: {} }], { code: 'Pilot__Pilot_Report' }))[0].json;
    check('a panel of 2 questions: nothing asked even when confirmed, can_confirm false, the reason says why', z.stage === 'ai_pilot_quote' && z.can_confirm === false && /at least 3/.test(z.reason), JSON.stringify({ s: z.stage, c: z.can_confirm, r: z.reason }));
  });
};
