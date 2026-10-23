// G6 (2026-10-18, n8n/seo-agent/AI_VISIBILITY_SPEC.md §10, docs/AI_PANEL_SCALE_HANDOFF.md): the AI question panel at enterprise scale.
// Built from the real node inputs of the 2026-10-17 re-rating — execution 776 (the weekly AI visibility run on techand.ai, 49 requests) and
// 779 (the AI Pulse, 21) — cut into fixtures_live/g6_live.json.gz by capture_g6.py, plus a synthetic 500-question panel (12 topic clusters x
// 4 buyer roles x 2 markets). Called from scenarios_v5.js just before the report.
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'g6_live.json.gz'))).toString('utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 600), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 450))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  // the panel kit exactly as the build inlined it into a node (the harness reads generated code only)
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const AIP = kitOf('AI_Requests.js', 'AIP');
  const W = FX.weekly, P = FX.pulse;
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  // ---- the synthetic enterprise panel: 499 buyer questions + the brand question -------------------------------------------------
  const CLUSTERS = ['e-invoicing', 'erp implementation', 'vat compliance', 'corporate tax', 'payroll software', 'inventory management', 'crm for b2b', 'business intelligence', 'cloud migration', 'ai consulting', 'procurement automation', 'expense management'];
  const PERSONAS = ['CFO', 'IT manager', 'founder', 'finance manager'];
  const MARKETS = ['AE-en', 'SA-en'];
  const STAGES = ['awareness', 'consideration', 'decision'];
  const VERBS = ['Which providers offer', 'How should I choose', 'What does it cost to get', 'Who are the best partners for', 'What are the risks of', 'How long does it take to roll out', 'Is it worth paying for', 'What should I ask a vendor about', 'Which tools compare well for', 'How do companies handle'];
  const synthPanel = (n) => { const out = [{ prompt_id: 'g6_brand', site_id: 'site_techand-ai', domain: 'techand.ai', prompt: 'What is Tech& (techand.ai) and what does it offer?', kind: 'brand', topic: 'brand', keyword: 'techand', source: 'auto', status: 'active', created_at: day(30), stage: 'brand', cluster: 'brand', volume: null, origin: 'writer', updated_at: day(30), persona: '', market: 'AE-en', pinned: false, fit_note: '' }];
    for (let i = 0; i < n - 1; i++) { const c = CLUSTERS[i % 12], pe = PERSONAS[Math.floor(i / 12) % 4], mk = MARKETS[Math.floor(i / 48) % 2], v = VERBS[Math.floor(i / 96) % 10];
      out.push({ prompt_id: 'g6_' + String(i).padStart(3, '0'), site_id: 'site_techand-ai', domain: 'techand.ai', prompt: v + ' ' + c + ' as a ' + pe + ' in ' + (mk === 'AE-en' ? 'the UAE' : 'Saudi Arabia') + ' (variant ' + i + ')?', kind: 'recommend', topic: c, keyword: c + ' ' + (mk === 'AE-en' ? 'uae' : 'ksa') + ' ' + i,
        source: 'auto', status: 'active', created_at: day(30), stage: STAGES[i % 3], cluster: c, volume: (i * 37) % 900, origin: 'writer', updated_at: day(30), persona: pe, market: mk, pinned: false, fit_note: '' }); }
    return out; };
  const loadWeekly = (o) => { const x = o || {};
    mock('Load Sites', items(W['Load Sites'])); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Profiles', items(W['Load Profiles']));
    mock('Load Monitors', items([{ ...W['Load Monitors'][0], ...(x.monitors || {}) }]));
    mock('Load AI Prompts', items(x.prompts || W['Load AI Prompts']));
    // the month's full run is done (so a scheduled start is a WEEKLY run whatever day the harness runs on)
    mock('Load AI Visibility', items((W['Load AI Visibility'] || []).map((r, i, a) => ({ ...r, checked_at: day(2 + a.length - i), run_kind: i === a.length - 1 ? 'full' : r.run_kind }))));
    mock('Load AI Daily', items(x.daily || [])); mock('Load Cache (AI)', items([...(W['Load Cache (AI)'] || []), ...(x.cache || [])])); mock('Load Query History', items(x.queries || []));
    mock('Load AI Run Answers', items(x.runAnswers || []));
    if (x.trigger) mock('Manual Run', [{ json: x.trigger }]); else delete store['Manual Run'];
    delete store['Prompt Rows']; delete store['Discovery Requests']; delete store['Run Discovery']; delete store['Analyst Jobs']; delete store['Prompt Jobs']; };
  const keyOf = (q) => q.prompt_id + '|' + q.engine;
  const answerRows = (reqs, runId, o) => reqs.filter(q => !/^(market|index)/.test(q.prompt_id)).map((q, i) => ({ site_id: q.site_id, domain: q.domain, run_id: runId, checked_at: new Date().toISOString(), prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered: !(o && o.fail && i % o.fail === 0), mentioned: i % 7 === 0, cited: i % 21 === 0, rank: i % 7 === 0 ? 2 : 0, our_urls: '', competitors: i % 3 ? 'cleartax.com, zoho.com' : 'cleartax.com', sources: 'mof.gov.ae', excerpt: '', cost: 0.004,
    error: (o && o.fail && i % o.fail === 0) ? 'task error 50000: Internal Error.' : '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '' }));

  // ===================================================================================================================================
  await guard('S200 G6 — the panel kit, the limits and the one cost formula', async () => {
    reset(); const SN = 'S200 G6 — the panel holds 3-500 questions (a new site starts at 50, a stored row keeps its size), one cost formula prices every panel x engines x pulse setting';
    begin(SN); const check = mkCheck(SN);
    check('a site with no monitors row starts at 50 questions', AIP.panelSize(null) === 50 && AIP.panelSize({}) === 50, AIP.panelSize(null));
    check('a stored row with an empty size keeps the old default of 20 (a release never raises an existing site\'s spend)', AIP.panelSize({ site_id: 's', ai_prompts_max: '' }) === 20 && AIP.panelSize({ site_id: 's', ai_prompts_max: null }) === 20, '');
    check('a stored size is kept, and held to 3-500', AIP.panelSize({ site_id: 's', ai_prompts_max: 8 }) === 8 && AIP.panelSize({ site_id: 's', ai_prompts_max: 900 }) === 500 && AIP.panelSize({ site_id: 's', ai_prompts_max: 1 }) === 3, '');
    // the monitors kit (inlined into every monitor) applies the same rule
    const monSrc = fs.readFileSync(path.join(CD, 'AI_Plan.js'), 'utf8'); const m0 = monSrc.match(/const panelMaxOf = [^\n]+/);
    const panelMaxOf = m0 ? new Function(m0[0] + '\nreturn panelMaxOf;')() : null;
    check('_monitor_sites.js panelMaxOf and AIP.panelSize agree on every case', panelMaxOf && [null, {}, { site_id: 's' }, { site_id: 's', ai_prompts_max: '' }, { site_id: 's', ai_prompts_max: 8 }, { site_id: 's', ai_prompts_max: 120 }, { site_id: 's', ai_prompts_max: 900 }, { site_id: 's', ai_prompts_max: 0 }]
      .every(r => panelMaxOf(r) === AIP.panelSize(r)), '');
    const c8 = AIP.cost({ panel: 8 }), c500 = AIP.cost({ panel: 500 }), c500all = AIP.cost({ panel: 500, engines: AIP.ENGINES });
    console.log('   cost 8 ->', JSON.stringify(c8.month), '| 500 ->', JSON.stringify(c500.month), 'N', c500.per_week, c500.pulse_questions_day, '| 500 all engines ->', JSON.stringify(c500all.month));
    check('8 questions on the six default engines: the v4.9 figures (weekly $0.12 a run of DataForSEO, the pulse every morning)', c8.asked === 7 && c8.run.weekly.dfs === 0.14 && c8.per_week === 6 && c8.pulse_questions_day === 7 && c8.executions === 1, JSON.stringify(c8.run));
    check('500 questions: 2,495 weekly requests split over 5 executions, the pulse a rotating sample (N < 6 a week), every figure positive', c500.requests.weekly === 2495 && c500.executions === 5 && c500.per_week >= 1 && c500.per_week < 6 && c500.month.total > c8.month.total * 10, JSON.stringify(c500));
    check('the pulse sample at 500 fits one morning\'s request limit', c500.requests.pulse_day <= AIP.LIMITS.pulse_max_requests, c500.requests.pulse_day);
    check('the half-widths it buys are printed: weekly headline within ±3 points, the median cluster within ±8', c500.half_width.headline <= 3 && c500.half_width.cluster <= 8, JSON.stringify(c500.half_width));
    check('every engine on, 500 questions: under the tracker\'s ceiling per run', c500all.run.full.usd < AIP.LIMITS.max_run_usd && c500all.prices.length === 9, JSON.stringify(c500all.run));
    const cOff = AIP.cost({ panel: 200, pulse: false }); check('pulse off: no pulse money, and the half-widths say what the weekly run alone buys', cOff.month.pulse === 0 && cOff.per_week === 0 && cOff.half_width.headline > 0, JSON.stringify(cOff.half_width));
    const cFull = AIP.cost({ panel: 500, pulse_mode: 'full' }); check('pulse = full panel on 500 questions: as many mornings as one morning\'s limit allows, and it says so', cFull.pulse_capped && /morning asks at most/.test(cFull.pulse_why) && cFull.requests.pulse_day <= 900, cFull.pulse_why);
    const cFix = AIP.cost({ panel: 300, pulse_mode: 'sample', pulse_per_week: 2 }); check('the owner\'s N is used', cFix.per_week === 2 && /set by the owner/.test(cFix.pulse_why), cFix.pulse_why);
  });

  // ===================================================================================================================================
  await guard('S201 G6 — the live run 776 / 779 asks exactly what it asked', async () => {
    reset(); const SN = 'S201 G6 — replaying executions 776 and 779 (8 questions) through the new plan and requests: the same 49 / 21 requests, one execution, no split';
    begin(SN); const check = mkCheck(SN);
    loadWeekly({ trigger: { ...W['Manual Run'][0] } });
    const plan = (await run('AI Plan', items(W['Load Cache (AI)'])))[0].json;
    check('one site, the first and last execution of its run (49 requests fit one)', plan.chunk && plan.chunk.no === 1 && plan.chunk.final_expected && !plan.chunk.going, JSON.stringify(plan.chunk));
    check('the run id keeps its v4.9 shape (the app pairs answers by it)', /^ai_\d{8}_techand-ai$/.test(plan.run_id), plan.run_id);
    check('the reservation is this panel\'s exact figure', plan.est_dfs_usd > 0 && plan.est_dfs_usd === AIP.cost({ panel: plan.prompts.length, engines: plan.engines }).run.full.dfs, plan.est_dfs_usd + ' vs ' + JSON.stringify(AIP.cost({ panel: plan.prompts.length, engines: plan.engines }).run.full));
    const req = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    const live = W['AI Requests'];
    const sig = (r) => r.engine + '|' + r.prompt_id + '|' + JSON.stringify(r.body);
    const liveQ = live.filter(r => !/^(market|index)/.test(r.prompt_id)), nowQ = req.filter(r => !/^(market|index)/.test(r.prompt_id));
    check('the same ' + liveQ.length + ' question requests, in the same order, with the same bodies as the live run', nowQ.length === liveQ.length && nowQ.every((r, i) => sig(r) === sig(liveQ[i])), JSON.stringify(nowQ.map(sig).filter((s, i) => s !== sig(liveQ[i] || {})).slice(0, 3)));
    check('the run\'s chunk record: everything asked now, nothing left', req[0].chunks && req[0].chunks[0].asked_now >= liveQ.length && req[0].chunks[0].left_after === 0 && req[0].chunks[0].final, JSON.stringify(req[0].chunks));
    // the pulse 779
    mock('Load Sites', items(P['Load Sites'])); mock('Load Ladders', items(P['Load Ladders'])); mock('Load Monitors', items(P['Load Monitors'])); mock('Load Profiles', items(P['Load Profiles']));
    mock('Load AI Prompts', items(P['Load AI Prompts'])); mock('Load AI Visibility', items(P['Load AI Visibility'])); mock('Load AI Daily', items(P['Load AI Daily'])); mock('Load Cache (AI)', items(P['Load Cache (AI)']));
    mock('Manual Run', [{ json: { ...P['Manual Run'][0] } }]);
    const pp = (await run('AI Plan', items(P['Load Cache (AI)']), { code: 'Pulse__AI_Plan' }))[0].json;
    check('8 questions: the pulse still asks every question every morning (auto mode, as before)', pp.sample && pp.sample.mode === 'full' && pp.prompts.length === 7 && pp.sample.per_week === 6, JSON.stringify(pp.sample));
    const preq = (await run('AI Requests', [{ json: {} }], { code: 'Pulse__AI_Requests' })).map(i => i.json);
    const plive = P['AI Requests'];
    check('the same 21 pulse requests as execution 779', preq.length === plive.length && preq.every((r, i) => sig(r) === sig(plive[i])), JSON.stringify([preq.length, plive.length]));
  });

  // ===================================================================================================================================
  await guard('S202 G6 — a 500-question weekly run split across executions', async () => {
    reset(); const SN = 'S202 G6 — 500 questions on 5 weekly engines: 2,495 requests asked over 5 executions, each key once, the state carried, the week measured once over all of them';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(500);
    let cache = [], stored = [], trigger = null; const asked = new Set(); let twice = 0; const execs = []; let spent = 0; let askedSoFar = 0, nParts = 0;
    // F2 (2026-10-23, E11): a part is sized by TIME (AIP.chunkPlan: 40 of the 60 minutes at the engines' slow-case seconds), no longer 600
    for (let k = 1; k <= 14; k++) {
      loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel, cache, runAnswers: stored, trigger });
      const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
      if (plan.nothing_to_do) { check('chunk ' + k + ' plans something', false, plan.reason); break; }
      if (k === 1) {
        check('chunk 1: a new weekly run of 500 questions, 2,495 requests, not the last part', plan.chunk.no === 1 && !plan.chunk.going && plan.chunk.total_est === 2495 && !plan.chunk.final_expected && plan.prompts.length === 500 && plan.run_kind === 'weekly', JSON.stringify(plan.chunk));
        check('chunk 1: GA4, the crawler check and the database views wait for the last part', !plan.ga4_property_id && !plan.index_due && !plan.market_due && !(plan.key_paths || []).length, JSON.stringify([plan.ga4_property_id, plan.index_due, plan.market_due]));
        check('chunk 1: the run reserves the whole run\'s exact figure', plan.est_dfs_usd === AIP.cost({ panel: 500, engines: plan.engines }).run.weekly.dfs, plan.est_dfs_usd);
        check('every question is asked in its own market (UAE and Saudi Arabia location codes)', plan.markets_map['AE-en'].location_code === 2784 && plan.markets_map['SA-en'] && plan.markets_map['SA-en'].location_code === 2682, JSON.stringify(plan.markets_map));
      }
      const req = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(r => r.engine);
      const qreq = req.filter(r => !/^(market|index)/.test(r.prompt_id));
      for (const r of qreq) { if (asked.has(keyOf(r))) twice++; asked.add(keyOf(r)); }
      if (k === 1) { nParts = Math.ceil(2495 / plan.chunk.size); check('chunk 1 asks the part its TIME budget holds (' + plan.chunk.size + ' requests, under 600: ' + plan.chunk.size_basis + '), the first questions x 5 engines in panel order', plan.chunk.size < 600 && plan.chunk.size >= AIP.TIME.min_requests && qreq.length === plan.chunk.size && qreq[0].prompt_id === 'g6_000' && /40 of the 60 minutes/.test(plan.chunk.size_basis), [qreq.length, qreq[0].prompt_id, plan.chunk.size_basis].join(' ')); }
      askedSoFar += qreq.length;
      if (k === 1) { const sa = qreq.find(r => r.market === 'SA-en'); check('a Saudi question is asked with the Saudi location', sa && sa.body[0].location_code === 2682 || (sa && sa.body[0].web_search_country_iso_code === 'SA'), JSON.stringify(sa && sa.body)); }
      const rows = answerRows(qreq, plan.run_id, k === 2 ? { fail: 50 } : null);
      mock('Apply Analysis', items(rows));
      const ho = (await run('AI Chunk Handoff', [{ json: {} }])).map(i => i.json);
      const h = ho[0];
      execs.push(h.state_row ? JSON.parse(h.state_row.value).executions.slice(-1)[0] : '');
      spent += h.cost_usd || 0;
      if (!h.final) {
        check('chunk ' + k + ': the state row (exact seo_cache columns) and the next execution\'s start (continue_run, parent = this execution)', h.state_row && ['key', 'kind', 'site_id', 'value', 'updated_at'].every(c => c in h.state_row) && Object.keys(h.state_row).length === 5 && h.next && h.next.continue_run === plan.run_id && h.next.parent_run_id === 'test-exec' && h.next.domain === 'techand.ai', JSON.stringify(h).slice(0, 300));
        const st = JSON.parse(h.state_row.value);
        check('chunk ' + k + ': the state counts what is asked and what is left, and records every key sent', st.asked === askedSoFar && st.status === 'running' && st.chunk === k && st.total === 2495 && AIP.unpackKeys(st.asked_keys).size === askedSoFar && st.pending === null, JSON.stringify({ ...st, asked_keys: undefined }).slice(0, 400));
        if (k === 2) check('chunk 2: answers the gate could not get are counted apart and said', st.unavailable === 12 && /could not be read/.test(h.note), h.note);
        check('chunk ' + k + ': its own DataForSEO money is stated for the settle', Math.abs(h.cost_usd - qreq.length * 0.004) < 1e-6, h.cost_usd);
        // AI Metrics: nothing finishes here — the report path ends
        const am = (await run('AI Metrics', [{ json: {} }]))[0].json;
        check('chunk ' + k + ': AI Metrics measures nothing (no site finishes here) and carries no money of its own', am.skip && am.nothing_final && am.cost_usd === undefined, JSON.stringify(am));
        cache = [...cache.filter(c => c.key !== h.state_row.key), h.state_row]; stored = [...stored, ...rows]; trigger = h.next;
        continue;
      }
      // the last part
      check('the last part is execution ' + k + ' and it is flagged final from its plan', k === nParts && plan.chunk.final_expected && plan.chunk.going && plan.chunk.no === nParts && plan.ga4_property_id === String((W['Load Sites'][0] || {}).ga4_property_id || '').replace(/^properties\//, '').trim(), JSON.stringify(plan.chunk));
      check('the last part keeps the run\'s id and start time', plan.run_id === JSON.parse(cache[0].value).run_id && plan.checked_at === JSON.parse(cache[0].value).started_at, plan.run_id);
      const am = (await run('AI Metrics', [{ json: {} }]))[0].json;
      check('the week is measured over EVERY answer of the run: 2,495 requests, the 12 that failed left out of the rates', am.metrics && am.metrics.requests === 2495 && am.metrics.samples === 2495 - 12, JSON.stringify(am.metrics && { r: am.metrics.requests, s: am.metrics.samples }));
      check('the report says the run was asked over ' + nParts + ' executions', am.run_split && am.run_split.executions === nParts && new RegExp('asked over ' + nParts + ' executions').test(am.run_split.note), JSON.stringify(am.run_split));
      check('the ledger settles this execution\'s money; the row and report carry the whole run', Math.abs(am.cost_usd - qreq.length * 0.004) < 1e-6 && Math.abs(am.run_cost_usd - 2495 * 0.004) < 0.01 && am.vis_row.cost_usd === am.run_cost_usd, [am.cost_usd, am.run_cost_usd].join(' '));
      const done = (am.cache_rows || []).find(c => /^ai_run:/.test(c.key));
      check('the run\'s state is marked done (no later start resumes a measured run)', done && JSON.parse(done.value).status === 'done', JSON.stringify(done));
      check('the vis row records ' + nParts + ' executions', am.vis_row.chunks === undefined || am.vis_row.chunks === nParts, am.vis_row.chunks);
      break;
    }
    check('every one of the 2,495 requests was asked exactly once across the executions — never twice', asked.size === 2495 && twice === 0, asked.size + ' asked, ' + twice + ' twice');
  });

  // ===================================================================================================================================
  await guard('S203 G6 — resume, twin and close of a split run', async () => {
    reset(); const SN = 'S203 G6 — a split run silent past the tracker\'s time limit is resumed (asking only what is unanswered), a live one is left alone, an old one is closed, a second run the same day gets its own id';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(500);
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel });
    const p1 = (await run('AI Plan', [{ json: {} }]))[0].json;
    const r1 = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(r => r.engine);
    const half = answerRows(r1.slice(0, 300), p1.run_id);   // the first execution sent its part, stored 300 answers and then died
    // F2 (E1): the record that execution saved BEFORE paying: every key it sent (asked_keys) and the part in flight (pending)
    const sentPacked = AIP.packKeys(r1.filter(r => !/^(market|index)/.test(r.prompt_id)).map(keyOf));
    const st = (min, extra) => ({ key: 'ai_run:site_techand-ai', kind: 'ai', site_id: 'site_techand-ai', updated_at: new Date(Date.now() - min * 60000).toISOString(),
      value: JSON.stringify({ run_id: p1.run_id, run_kind: 'weekly', site_id: 'site_techand-ai', domain: 'techand.ai', started_at: new Date(Date.now() - (min + 30) * 60000).toISOString(), updated_at: new Date(Date.now() - min * 60000).toISOString(), chunk: 1, status: 'running', asked: 0, total: 2495, spent_dfs_usd: 0, committed_dfs_usd: 2.4, spent_ai_usd: 0.1, executions: [],
        asked_keys: sentPacked, pending: { chunk: 1, execution: 'e1', at: new Date(Date.now() - (min + 30) * 60000).toISOString(), n: r1.length, keys: sentPacked }, ...(extra || {}) }) });
    // silent 2 hours: resumed by a scheduled start
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel, cache: [st(120)], runAnswers: half });
    const pr = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a run silent 2 hours is RESUMED (same run id, the next part), not started again; the part that died counts its ' + r1.length + ' sent keys as done (' + (r1.length - 300) + ' of them lost, never re-paid) and is halved',
      !pr.nothing_to_do && pr.run_id === p1.run_id && pr.chunk.going && pr.chunk.resumed && pr.chunk.no === 2 && pr.chunk.done === r1.length && pr.chunk.lost_now === r1.length - 300 && pr.chunk.lost_parts === 1 && !pr.stop && pr.chunk.size_time < p1.chunk.size_time && /halved/.test(pr.chunk.size_basis) && /not asked again/.test(pr.chunk.lost_note || ''), JSON.stringify(pr.chunk));
    check('the resumed part reserves only what is left of the run', pr.est_dfs_usd === +Math.max(0, AIP.cost({ panel: 500, engines: pr.engines }).run.weekly.dfs - 2.4).toFixed(4), pr.est_dfs_usd);
    const rr = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(r => r.engine);
    const storedKeys = new Set(half.map(keyOf));
    const sentKeys = AIP.unpackKeys(sentPacked);
    check('the resumed part asks none of the keys its dead part SENT (stored or not) — it starts after them', rr.length === pr.chunk.size && rr.every(r => !storedKeys.has(keyOf(r)) && !sentKeys.has(keyOf(r))) && rr[0].prompt_id === 'g6_' + String(r1.length / 5).padStart(3, '0'), [rr.length, rr[0].prompt_id].join(' '));
    // silent 10 minutes: a live part — a second start is a twin and does nothing
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel, cache: [st(10)], runAnswers: half });
    const pb = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a run heard from 10 minutes ago is still being asked: a second start does nothing for it, and says why', pb.nothing_to_do && /still being asked/.test(pb.reason), pb.reason);
    // 8 days old: closed, a new run starts
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel, cache: [st(8 * 1440)], runAnswers: half });
    const po = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a run older than 6 days is closed: a new run starts (part 1)', !po.nothing_to_do && po.chunk.no === 1 && !po.chunk.going, JSON.stringify(po.chunk));
    // done today: a second run the same day gets its own id, so it never takes the first run's answers for its own
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel, cache: [st(30, { status: 'done' })], runAnswers: half });
    const pd = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a second run the same day gets its own run id', pd.run_id !== p1.run_id && pd.run_id.indexOf(p1.run_id) === 0 && /_xtest-exec$/.test(pd.run_id) && pd.chunk.done === 0, pd.run_id);
    // a continuation for a run that is not open
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: panel, cache: [st(30, { status: 'done' })], trigger: { domain: 'techand.ai', site_id: 'site_techand-ai', continue_run: p1.run_id } });
    const pn = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a continuation of a run that is already done does nothing', pn.nothing_to_do && /nothing to continue/.test(pn.reason), pn.reason);
    // the pulse resumes a stalled run every morning
    mock('Load Cache (AI)', items([st(120), st(10, {}), { key: 'ai_brands:site_techand-ai', kind: 'ai', value: '{}' }].map((r, i) => i === 1 ? { ...r, key: 'ai_run:site_other-com', value: JSON.stringify({ ...JSON.parse(r.value), site_id: 'site_other-com', domain: 'other.com' }) } : r)));
    const rs = (await run('AI Run Resume', [{ json: {} }], { code: 'Pulse__AI_Run_Resume' })).map(i => i.json);
    check('the pulse starts the stalled run again (and not the one still running)', rs.length === 1 && rs[0].continue_run === p1.run_id && rs[0].domain === 'techand.ai' && rs[0].parent_run_id === 'test-exec', JSON.stringify(rs));
  });

  // ===================================================================================================================================
  await guard('S204 G6 — the run ledger reserves the panel, the balance refuses what it cannot pay', async () => {
    reset(); const SN = 'S204 G6 — the run ledger reserves the exact figure of a 500-question run, and the run guard refuses it on an account that cannot pay, with the reason';
    begin(SN); const check = mkCheck(SN);
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: synthPanel(500) });
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    mock('DFS Balance (AI)', [{ json: { tasks: [{ result: [{ money: { balance: 5.43 } }] }] } }]);
    const row = (await run('Run Ledger Row (AI)', [{ json: { id: 't', name: 'seo_run_ledger' } }]))[0].json;
    check('the reservation is the panel\'s own figure, and says so', Math.abs(row.dfs_est_usd - plan.est_dfs_usd) < 1e-9 && Math.abs(row.est_usd - plan.est_ai_usd) < 1e-9 && /priced from their own panel/.test(row.cost_basis), JSON.stringify({ d: row.dfs_est_usd, a: row.est_usd, b: row.cost_basis }));
    mock('Reserve Run Ledger (AI)', [{ json: { ...row, id: 9 } }]); mock('Load Open Runs (AI)', [{ json: {} }]); mock('Load Catch-up Records (AI)', [{ json: {} }]);
    const g = (await run('After Run Ledger (AI)', [{ json: {} }]))[0].json;
    check('$5.43 on the account, a $' + plan.est_dfs_usd + ' run: refused before anything is spent, with the reason', g.run_refused && g.reason === 'account_low' && /too low for this run/.test(g.refusal), JSON.stringify(g).slice(0, 300));
    mock('DFS Balance (AI)', [{ json: { tasks: [{ result: [{ money: { balance: 80 } }] }] } }]);
    const row2 = (await run('Run Ledger Row (AI)', [{ json: { id: 't', name: 'seo_run_ledger' } }]))[0].json;
    mock('Reserve Run Ledger (AI)', [{ json: { ...row2, id: 10 } }]);
    const g2 = await run('After Run Ledger (AI)', [{ json: {} }]);
    check('$80 on the account: the run goes ahead', !g2[0].json.run_refused && g2[0].json.site_id === 'site_techand-ai', JSON.stringify(g2[0].json).slice(0, 200));
    // a continuation part names the part that started it, so the guard never takes it for a twin
    loadWeekly({ monitors: { ai_prompts_max: 500 }, prompts: synthPanel(500), trigger: { domain: 'techand.ai', continue_run: 'x', parent_run_id: '9001' } });
    const rowC = (await run('Run Ledger Row (AI)', [{ json: { id: 't', name: 'seo_run_ledger' } }]))[0].json;
    check('a continuation\'s ledger row is keyed by the part that started it (parent:<execution>)', rowC.key === 'parent:9001', rowC.key);
  });

  // ===================================================================================================================================
  await guard('S205 G6 — the pulse\'s stratified rotating sample', async () => {
    reset(); const SN = 'S205 G6 — 500 questions: every question asked exactly N mornings a week, every topic x buyer group every morning, one morning under its request limit; full mode and the owner\'s N';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(500).filter(q => q.kind !== 'brand');
    const pw = AIP.pulsePerWeek({ asked: 499, weekly_engines: 5, pulse_engines: 3, cluster_size: 41 });
    check('auto N for 499 questions on 3 pulse engines is between 1 and 5 and states what it buys', pw.per_week >= 1 && pw.per_week < 6 && pw.headline <= 3 && pw.cluster <= 8 && /±/.test(pw.why), JSON.stringify(pw));
    const base = AIP.pulseDay('2026-10-20');   // a Tuesday
    const count = new Map(); let minStrata = 1e9, maxReq = 0;
    for (let d = 0; d < 6; d++) { const s = AIP.pulseSample(panel, { per_week: pw.per_week, day: base + d });
      for (const q of s.asked) count.set(q.prompt_id, (count.get(q.prompt_id) || 0) + 1);
      minStrata = Math.min(minStrata, s.covered === s.strata ? s.strata : -1); maxReq = Math.max(maxReq, s.asked.length * 3); }
    const counts = [...count.values()];
    check('over the six pulse mornings of a week every question is asked at least N times (N = ' + pw.per_week + ')', count.size === 499 && counts.every(c => c >= pw.per_week), JSON.stringify([count.size, Math.min(...counts), Math.max(...counts)]));
    check('… and, with strata large enough, exactly N times (no question is favoured)', counts.filter(c => c === pw.per_week).length === 499, Math.max(...counts));
    check('every topic x buyer group (48) is in every morning\'s sample', minStrata === 48, minStrata);
    check('no morning passes the 900-request limit', maxReq <= 900, maxReq);
    check('a website with no cycle weekday: Tuesday to Sunday are six consecutive pulse days; a Monday shares Tuesday\'s slot (the v4.9 rule, unchanged)', AIP.pulseDay('2026-10-25') - AIP.pulseDay('2026-10-20') === 5 && AIP.pulseDay('2026-10-19') === AIP.pulseDay('2026-10-20') && AIP.pulseDay('2026-10-27') - AIP.pulseDay('2026-10-20') === 6
      && AIP.pulseDay('2026-10-21', 1) === AIP.pulseDay('2026-10-21') && AIP.pulseDay('2026-10-21', null) === AIP.pulseDay('2026-10-21') && AIP.pulseDay('2026-10-21', '') === AIP.pulseDay('2026-10-21'), '');
    // 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): a website's week starts on ITS cycle day. For every weekday: the six days after the cycle
    // day are six consecutive pulse days, the cycle day itself shares the next day's slot (the pulse is skipped on it anyway), and over those six
    // mornings every question is still asked exactly N times - the rotation covers each question exactly as before
    const DAYNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
    const isoPlus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    const perCw = [];
    for (let cw = 0; cw <= 6; cw++) {
      let cd = '2026-10-18'; while (dayOfWeek(cd) !== cw) cd = isoPlus(cd, 1);   // the first cycle day on or after Sunday 2026-10-18
      const six = [1, 2, 3, 4, 5, 6].map(k => AIP.pulseDay(isoPlus(cd, k), cw));
      const consecutive = six.every((v, i) => i === 0 || v - six[i - 1] === 1);
      const sharesNext = AIP.pulseDay(cd, cw) === six[0];
      const nextWeek = AIP.pulseDay(isoPlus(cd, 8), cw) - six[0] === 6;   // the day after the next cycle day continues the count
      const cnt = new Map(); for (const d of six) for (const q of AIP.pulseSample(panel, { per_week: pw.per_week, day: d }).asked) cnt.set(q.prompt_id, (cnt.get(q.prompt_id) || 0) + 1);
      const exact = cnt.size === 499 && [...cnt.values()].every(c => c === pw.per_week);
      perCw.push({ cw: DAYNAME[cw], consecutive, sharesNext, nextWeek, exact });
    }
    check('for a website whose cycle day is any of the seven weekdays, its six pulse mornings are consecutive pulse days, its cycle day shares the next morning\'s slot, the count runs on week after week, and every question is asked exactly N times over the six',
      perCw.every(x => x.consecutive && x.sharesNext && x.nextWeek && x.exact), JSON.stringify(perCw));
    // a small stratum (fewer questions than mornings) is still in every morning — topped up in turn
    const small = [...panel.slice(0, 60), { ...panel[0], prompt_id: 'tiny_1', cluster: 'tiny cluster', persona: 'COO' }];
    let tinyDays = 0; for (let d = 0; d < 6; d++) if (AIP.pulseSample(small, { per_week: 1, day: base + d }).asked.some(q => q.prompt_id === 'tiny_1')) tinyDays++;
    check('a one-question stratum is in all six mornings (topped up), not one', tinyDays === 6, tinyDays);
    // the real Pulse Plan with the 500-question panel
    mock('Load Sites', items(P['Load Sites'])); mock('Load Ladders', items(P['Load Ladders'])); mock('Load Profiles', items(P['Load Profiles'])); mock('Load AI Visibility', items(P['Load AI Visibility'])); mock('Load AI Daily', items(P['Load AI Daily'])); mock('Load Cache (AI)', items(P['Load Cache (AI)']));
    mock('Load Monitors', items([{ ...P['Load Monitors'][0], ai_prompts_max: 500 }])); mock('Load AI Prompts', items(synthPanel(500))); delete store['Manual Run'];
    const pp = (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' }))[0].json;
    check('the pulse plan asks this morning\'s rotating sample, and its note says so', pp.sample && pp.sample.mode === 'sample' && pp.prompts.length < 499 && pp.sample.covered === pp.sample.strata && /rotating sample/.test(pp.sample.note) && pp.panel_size === 499, JSON.stringify(pp.sample));
    check('the pulse reserves this morning\'s exact figure', pp.est_dfs_usd === +(pp.prompts.length * 0.012).toFixed(4), pp.est_dfs_usd);
    const preq = (await run('AI Requests', [{ json: {} }], { code: 'Pulse__AI_Requests' })).map(i => i.json);
    check('the morning\'s requests: the sample on the 3 pulse engines, under the limit', preq.length === pp.prompts.length * 3 && preq.length <= 900, preq.length);
    mock('Load Monitors', items([{ ...P['Load Monitors'][0], ai_prompts_max: 500, ai_pulse_mode: 'full' }]));
    const pf = (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' }))[0].json;
    check('pulse = full panel on 500 questions: as much as one morning allows, and the note says why', pf.sample.capped && /one morning asks at most/.test(pf.sample.why) && pf.prompts.length * 3 <= 900, JSON.stringify(pf.sample));
  });

  // ===================================================================================================================================
  await guard('S206 G6 — growing techand.ai\'s 8-question panel to 500, by market x buyer role, from every source', async () => {
    reset(); const SN = 'S206 G6 — techand.ai\'s real 8-question panel (exec 776) raised to 500 with two buyer roles and a second market: writer jobs per cell (<= 40 each), People-also-ask and competitors\' homepages read';
    begin(SN); const check = mkCheck(SN);
    loadWeekly({ monitors: { ai_prompts_max: 500, ai_personas: 'CFO, IT manager', ai_markets: 'SA-en' }, trigger: { ...W['Manual Run'][0] } });
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('the plan asks for 492 new questions (500 - the 8 stored), within what one run may write (14 jobs x 40)', plan.need_prompts && plan.prompts_needed === 492 && plan.personas.join('|') === 'CFO|IT manager' && plan.markets.join('|') === 'AE-en|SA-en', JSON.stringify([plan.prompts_needed, plan.personas, plan.markets]));
    check('the fit gate\'s context travels with the plan (own domain, competitors, learned brand names, services)', plan.fit_input && plan.fit_input.own_domain === 'techand.ai' && plan.fit_input.competitors.includes('cleartax.com') && Object.keys(plan.fit_input.brands).length > 3, JSON.stringify(plan.fit_input).slice(0, 200));
    const stj = (await run('Site Text Jobs', [{ json: {} }])).map(i => i.json);
    check('the homepages of the declared competitors are read for topic ideas (cleartax.com, azentio.com)', stj.filter(j => j.kind === 'competitor').map(j => j.domain).join(',') === 'cleartax.com,azentio.com', JSON.stringify(stj));
    mock('Read Site (AI)', stj.map(j => ({ json: { site_text: j.kind === 'competitor' ? '# ' + j.domain + '\nE-invoicing software\nVAT returns\nPayroll for SMEs\nContact us\nPrivacy policy\n' : '' } })));
    const dr = (await run('Discovery Requests', [{ json: {} }])).map(i => i.json);
    const paa = dr.filter(r => r.kind === 'paa');
    check('People-also-ask is read per topic in each market (results page, depth 10), the database for up to 4 topics', paa.length >= 2 && new Set(paa.map(r => r.market)).size === 2 && paa.every(r => /serp\/google\/organic/.test(r.endpoint) && r.body[0].depth === 10) && dr.filter(r => r.kind === 'discover').length <= 4,
      JSON.stringify(dr.map(r => r.kind + ':' + (r.market || r.platform || '') + ':' + (r.topic || '')).slice(0, 12)));
    // the results-page answer in DataForSEO's shape (sandbox-probed 2026-10-18: item type people_also_ask with people_also_ask_element titles)
    mock('Run Discovery', dr.map(r => ({ json: r.kind === 'paa' ? { tasks: [{ status_code: 20000, cost: 0.002, result: [{ items: [{ type: 'organic', title: 'x' }, { type: 'people_also_ask', items: [{ type: 'people_also_ask_element', title: 'Is e-invoicing mandatory in ' + (r.market === 'SA-en' ? 'Saudi Arabia' : 'the UAE') + '?' }, { type: 'people_also_ask_element', title: 'How much does an e-invoicing provider cost?' }] }] }] }] } : { tasks: [{ status_code: 20000, cost: 0.1, result: [{ items: [] }] }] } })));
    const jobs = (await run('Prompt Jobs', [{ json: {} }])).map(i => i.json);
    const cells = new Set(jobs.map(j => j.market + '|' + j.persona));
    check('writer jobs: one or more per market x buyer role (4 cells), each at most 40 questions, at most 14 in all', cells.size === 4 && jobs.every(j => j.count >= 1 && j.count <= 40) && jobs.length <= 14 && jobs.reduce((s, j) => s + j.count, 0) <= 492, JSON.stringify(jobs.map(j => j.market + '|' + j.persona + ':' + j.count)));
    check('each job names its buyer role, its market\'s country and language, the clusters in use', jobs.every(j => j.persona && j.language === 'English' && j.country && (j.clusters || []).length >= 1), JSON.stringify(jobs.map(j => [j.persona, j.country, j.language])));
    check('the Saudi jobs get Saudi People-also-ask questions, the UAE jobs UAE ones', jobs.filter(j => j.market === 'SA-en').every(j => j.paa_questions.some(q => /Saudi/.test(q))) && jobs.filter(j => j.market === 'AE-en').every(j => j.paa_questions.some(q => /UAE/.test(q))), JSON.stringify(jobs.map(j => (j.paa_questions || [])[0])));
    check('competitors\' homepages give topic lines, without their names or their menus\' boilerplate', jobs[0].competitor_offers.length === 2 && /E-invoicing software/.test(jobs[0].competitor_offers[0]) && !/Contact us|Privacy/.test(jobs[0].competitor_offers.join(' ')), JSON.stringify(jobs[0].competitor_offers));
    check('only the first job may write the brand question', jobs.filter(j => !j.has_brand_prompt).length <= 1, '');
    const prompt = fs.readFileSync(path.join(CD, 'Prompt_Writer.prompt.txt'), 'utf8');
    check('the writer\'s prompt carries the buyer role, the language, the clusters, People-also-ask and what competitors sell', /\$json\.persona/.test(prompt) && /\$json\.language/.test(prompt) && /\$json\.clusters/.test(prompt) && /paa_questions/.test(prompt) && /competitor_offers/.test(prompt) && /"persona"/.test(prompt), '');
  });

  // ===================================================================================================================================
  await guard('S207 G6 — every new question through the meaning dedupe and the fit gate; refusals stored with the reason', async () => {
    reset(); const SN = 'S207 G6 — the Prompt Writer\'s questions for techand.ai: a repeat in other words is dropped, a competitor\'s brand / a government service / the site\'s own name are stored REFUSED with the gate\'s sentence, never asked';
    begin(SN); const check = mkCheck(SN);
    loadWeekly({ monitors: { ai_prompts_max: 30, ai_personas: 'CFO' }, trigger: { ...W['Manual Run'][0] } });
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    mock('Prompt Jobs', [{ json: { site_id: plan.site_id, persona: 'CFO', market: 'AE-en', count: 22 } }]);
    const Q = (prompt, keyword, extra) => ({ prompt, keyword, kind: 'recommend', stage: 'decision', cluster: 'e-invoicing', origin: 'writer', ...(extra || {}) });
    mock('Prompt Writer', [{ json: { output: { prompts: [
      Q('Which accredited e-invoicing providers in the UAE should a CFO shortlist before the 2026 deadline?', 'e-invoicing providers uae'),
      Q('As a CFO in the UAE, which accredited e-invoicing providers should I shortlist before the 2026 deadline?', 'accredited e-invoicing uae'),   // the same question, other words
      Q('Is ClearTax the right e-invoicing partner for a mid-size UAE distributor?', 'cleartax e-invoicing uae'),   // a declared competitor's brand
      Q('How do I renew my Emirates ID online through the ICP portal?', 'emirates id renewal online'),   // a government service
      Q('Is Techand a reliable ERP partner for UAE manufacturers?', 'techand erp partner'),   // the site's own name outside the brand question
      Q('What does an ERP implementation cost for a 200-person UAE manufacturer?', 'erp implementation cost uae', { kind: 'cost', stage: 'decision', cluster: 'erp implementation' }),
      Q('Which ERP rollout risks should a CFO plan for in the first year?', 'erp rollout risks', { kind: 'problem', stage: 'awareness', cluster: 'erp implementation', origin: 'paa' }) ] } } }]);
    const rows = (await run('Prompt Rows', [{ json: {} }])).map(i => i.json).filter(r => !r.skip);
    const fresh = rows.filter(r => !plan.prompts.some(q => q.prompt_id === r.prompt_id));
    const PRC = ['prompt_id', 'site_id', 'domain', 'prompt', 'kind', 'topic', 'keyword', 'source', 'status', 'created_at', 'stage', 'cluster', 'volume', 'origin', 'updated_at', 'persona', 'market', 'pinned', 'fit_note', 'keyword_source'];   // F2 (E9): + keyword_source
    check('every row has exactly the table\'s columns (the save node maps every field it is given)', rows.every(r => Object.keys(r).length === PRC.length && PRC.every(c => c in r)), JSON.stringify(rows.map(r => Object.keys(r).filter(k => !PRC.includes(k)))));
    check('the repeat in other words is dropped (one of the two "shortlist" questions is stored)', fresh.filter(r => /shortlist/.test(r.prompt)).length === 1, JSON.stringify(fresh.map(r => r.prompt.slice(0, 40))));
    const ref = fresh.filter(r => r.status === 'refused');
    console.log('   refused ->', ref.map(r => r.fit_note).join(' || '));
    check('ClearTax, the Emirates ID portal and "Techand" are stored REFUSED, each with the gate\'s sentence', ref.length === 3 && ref.some(r => /ClearTax/.test(r.prompt) && /other brand/.test(r.fit_note)) && ref.some(r => /Emirates ID/.test(r.prompt) && /government|portal/.test(r.fit_note)) && ref.some(r => /Techand/.test(r.prompt) && /own brand/.test(r.fit_note)), JSON.stringify(ref.map(r => r.fit_note)));
    const ok = fresh.filter(r => r.status === 'active');
    check('the three good questions are stored active with their buyer role, market and origin', ok.length === 3 && ok.every(r => r.persona === 'CFO' && r.market === 'AE-en') && ok.some(r => r.origin === 'paa'), JSON.stringify(ok.map(r => [r.persona, r.market, r.origin])));
    // and a refused question is never asked
    const req = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    check('no request is made for a refused question', !req.some(r => ref.some(x => x.prompt_id === r.prompt_id)) && req.some(r => ok.some(x => x.prompt_id === r.prompt_id)), '');
    // the read path: a stored refused question is not in next week's panel
    loadWeekly({ monitors: { ai_prompts_max: 30 }, prompts: [...W['Load AI Prompts'], ...fresh] });
    const p2 = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('next week\'s panel leaves the refused questions out and keeps the good ones', !p2.prompts.some(q => ref.some(x => x.prompt_id === q.prompt_id)) && ok.every(x => p2.prompts.some(q => q.prompt_id === x.prompt_id)), JSON.stringify(p2.prompts.map(q => q.prompt_id)));
    // the kit's own meaning rule
    check('meaning dedupe: the same question for another buyer role or market is NOT a repeat', !AIP.sameAsk({ prompt: 'Which e-invoicing providers are best in the UAE?', persona: 'CFO' }, { prompt: 'Which e-invoicing providers are best in the UAE?', persona: 'IT manager' })
      && AIP.sameAsk({ prompt: 'Which e-invoicing providers are best in the UAE?', persona: 'CFO', market: 'AE-en' }, { prompt: 'Best e-invoicing providers in the UAE — which ones?', persona: 'CFO', market: 'AE-en' }), '');
  });

  // ===================================================================================================================================
  await guard('S208 G6 — the owner manages the panel: import, edit, re-word, switch off / on, pin', async () => {
    reset(); const SN = 'S208 G6 — Site Admin ai_prompts: a CSV import of questions with buyer role / cluster / market, an edit in place, new wording as a new question, off / on (a refused one becomes the owner\'s), pin / unpin';
    begin(SN); const check = mkCheck(SN);
    await run('Admin Action', { body: { action: 'ai_prompts', domain: 'techand.ai', add: [
      { prompt: 'Which payroll software works best for a 50-person Dubai company?', persona: 'Finance manager', cluster: 'Payroll Software', stage: 'decision', market: 'ae-en', pinned: true },
      { prompt: 'What should a CFO in Riyadh ask before choosing an ERP partner?', persona: 'CFO', cluster: 'erp implementation', stage: 'consideration', market: 'SA' },
      'How long does an e-invoicing rollout take for a UAE retailer?' ],
      edit: [{ prompt_id: 'p_keep', persona: 'IT manager', cluster: 'erp implementation' }, { prompt_id: 'p_reword', prompt: 'Which accredited e-invoicing providers serve UAE logistics companies?' }],
      remove: ['p_off'], enable: ['p_refused'], pin: ['p_keep'], unpin: ['p_pinned'] } });
    const base = { site_id: 'site_techand-ai', domain: 'techand.ai', kind: 'recommend', topic: 't', keyword: 'k', source: 'auto', status: 'active', created_at: '2026-10-01T00:00:00.000Z', stage: 'decision', cluster: 'e-invoicing', volume: 10, origin: 'writer', updated_at: '', persona: '', market: 'AE-en', pinned: false, fit_note: '' };
    mock('Load AI Prompts (Admin)', items([{ ...base, prompt_id: 'p_keep', prompt: 'Keep this one as it is?' }, { ...base, prompt_id: 'p_reword', prompt: 'Which e-invoicing providers are accredited?' }, { ...base, prompt_id: 'p_off', prompt: 'Switch me off?' },
      { ...base, prompt_id: 'p_refused', prompt: 'Is ClearTax good?', status: 'refused', fit_note: '"Is ClearTax good?" was not added: names a competitor (other brand)' }, { ...base, prompt_id: 'p_pinned', prompt: 'Pinned one?', pinned: true }]));
    const rows = (await run('AI Prompt Rows (Admin)', [{ json: {} }])).map(i => i.json);
    const by = (id) => rows.find(r => r.prompt_id === id) || {};
    const added = rows.filter(r => r.origin === 'custom' && r.source === 'custom' && !['p_keep', 'p_reword', 'p_off', 'p_refused', 'p_pinned'].includes(r.prompt_id));
    check('three imported questions, the owner\'s own, with role / cluster (lower case) / stage / market (normalised) / pin', added.length === 4 && added.some(r => r.persona === 'Finance manager' && r.cluster === 'payroll software' && r.market === 'AE-en' && r.pinned === true && r.stage === 'decision') && added.some(r => r.market === 'SA-en' && r.persona === 'CFO'), JSON.stringify(added.map(r => [r.prompt.slice(0, 20), r.persona, r.cluster, r.market, r.pinned])));
    check('an edit changes role and cluster in place, keeps the wording and the id (and the pin applies)', by('p_keep').persona === 'IT manager' && by('p_keep').cluster === 'erp implementation' && by('p_keep').prompt === 'Keep this one as it is?' && by('p_keep').pinned === true, JSON.stringify(by('p_keep')));
    const reworded = rows.find(r => /logistics/.test(r.prompt));
    check('new wording is a NEW question (new id, active) and the old one is switched off — no trend compares two questions', by('p_reword').status === 'off' && reworded && reworded.prompt_id !== 'p_reword' && reworded.status === 'active' && reworded.cluster === 'e-invoicing', JSON.stringify([by('p_reword').status, reworded && reworded.prompt_id]));
    check('switch off; switch on a refused question — it becomes the owner\'s own and says so', by('p_off').status === 'off' && by('p_refused').status === 'active' && by('p_refused').source === 'custom' && /switched on by the owner/.test(by('p_refused').fit_note), JSON.stringify([by('p_off').status, by('p_refused')]));
    check('unpin', by('p_pinned').pinned === false, JSON.stringify(by('p_pinned')));
    check('every row: exact seo_ai_prompts columns', rows.every(r => Object.keys(r).length === 20), JSON.stringify(Object.keys(rows[0])));
    // the weekly plan puts a pinned question first
    loadWeekly({ monitors: { ai_prompts_max: 5 }, prompts: [...W['Load AI Prompts'].slice(0, 6), { ...W['Load AI Prompts'][6], pinned: true }] });
    const p = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a pinned question is asked first and survives a smaller panel', p.prompts[0].prompt_id === W['Load AI Prompts'][6].prompt_id && p.prompts.length === 5, JSON.stringify(p.prompts.map(q => q.prompt_id)));
    // "Track my site": a NEW website starts at 50 questions with the app's buyer roles / markets / pulse sampling; a stored row keeps its size
    const MC = require('./table_cols.json').MONITORS;
    mock('Normalize Input', [{ json: { domain: 'newsite.example', competitors: [], request_id: 'r1', monitor_input: { ai_personas: 'CFO, IT manager', ai_markets: 'SA-en', ai_pulse_mode: 'sample', ai_pulse_per_week: 2 } } }]);
    mock('Load Monitors (Track)', [{ json: {} }]);
    const t1 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('Track my site, new website: 50 questions, the buyer roles, markets and pulse sampling stored, exact columns', t1.ai_prompts_max === 50 && t1.ai_personas === 'CFO, IT manager' && t1.ai_markets === 'SA-en' && t1.ai_pulse_mode === 'sample' && t1.ai_pulse_per_week === 2 && Object.keys(t1).length === MC.length && MC.every(c => c in t1), JSON.stringify(t1));
    mock('Load Monitors (Track)', [{ json: { site_id: 'site_newsite-example', domain: 'newsite.example', ai_prompts_max: '' } }]);
    mock('Normalize Input', [{ json: { domain: 'newsite.example', competitors: [], request_id: 'r2', monitor_input: {} } }]);
    const t2 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('Track my site, a stored row with no size: keeps 20 (a release never raises a site\'s spend)', t2.ai_prompts_max === 20, t2.ai_prompts_max);
  });

  // ===================================================================================================================================
  await guard('S209 G6 — the engines DataForSEO offers now: ChatGPT API and Gemini API wired opt-in', async () => {
    reset(); const SN = 'S209 G6 — sandbox probe of 2026-10-18: ChatGPT and Gemini LLM Responses (web search) asked as two more opt-in engines, parsed like Perplexity / Claude; Grok / DeepSeek / Meta / Copilot have no endpoint and are refused';
    begin(SN); const check = mkCheck(SN);
    loadWeekly({ monitors: { ai_engines: 'chatgpt, chatgpt_api, gemini_api, grok, deepseek' }, trigger: { ...W['Manual Run'][0] } });
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('a site may choose the two API engines; engines DataForSEO has no endpoint for are dropped', plan.engines.join(',') === 'chatgpt,chatgpt_api,gemini_api', plan.engines.join(','));
    const req = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(r => r.engine);
    const ca = req.find(r => r.engine === 'chatgpt_api'), ga = req.find(r => r.engine === 'gemini_api');
    check('the ChatGPT API: chat_gpt/llm_responses with a web-search model, the market\'s country, its price', ca && /chat_gpt\/llm_responses\/live$/.test(ca.endpoint) && ca.body[0].model_name === 'gpt-5.4-mini' && ca.body[0].web_search === true && ca.body[0].web_search_country_iso_code === 'AE' && ca.est_cost === AIP.PRICE.chatgpt_api, JSON.stringify(ca && ca.body));
    check('the Gemini API: gemini/llm_responses with web search and its price', ga && /gemini\/llm_responses\/live$/.test(ga.endpoint) && ga.body[0].model_name === 'gemini-3.5-flash' && ga.body[0].web_search === true && ga.est_cost === AIP.PRICE.gemini_api, JSON.stringify(ga && ga.body));
    // the answer shape the sandbox returned for both (items -> sections -> text + annotations)
    const ans = (text, cites) => ({ tasks: [{ status_code: 20000, cost: 0.011, result: [{ model_name: 'm', web_search: true, money_spent: 0.0106, items: [{ type: 'message', sections: [{ type: 'text', text, annotations: cites.map(u => ({ title: 'src', url: u })) }] }], fan_out_queries: ['uae e-invoicing providers'] }] }] });
    mock('Run AI Requests', req.map(r => ({ json: r.engine === 'chatgpt_api' ? ans('Top picks: Techand (techand.ai) leads, then ClearTax.', ['https://techand.ai/e-invoicing', 'https://www.cleartax.com/ae']) : r.engine === 'gemini_api' ? ans('ClearTax and Zoho are common choices.', ['https://zoho.com/ae']) : { tasks: [{ status_code: 20000, cost: 0.004, result: [{ markdown: 'x', items: [] }] }] } })));
    delete store['Merge AI Answers'];
    const parsed = (await run('Parse AI Answers', store['Run AI Requests'])).map(i => i.json).filter(r => r.engine);
    const pc = parsed.find(r => r.engine === 'chatgpt_api'), pg = parsed.find(r => r.engine === 'gemini_api');
    check('a ChatGPT API answer that names and cites the site: answered, mentioned, cited, rank 1, its cost', pc && pc.answered && pc.mentioned && pc.cited && pc.rank === 1 && pc.cost === 0.011, JSON.stringify(pc).slice(0, 300));
    check('a Gemini API answer that does not: answered, not mentioned, its rivals read', pg && pg.answered && !pg.mentioned && /zoho/.test(pg.competitors), JSON.stringify(pg).slice(0, 300));
    const c = AIP.cost({ panel: 50, engines: ['chatgpt', 'chatgpt_api', 'gemini_api'] });
    check('the price of each engine is stated, the two API ones marked as estimates until their first live call', c.prices.find(x => x.engine === 'chatgpt_api').usd === 0.012 && /estimate/.test(c.prices.find(x => x.engine === 'gemini_api').basis) && /measured/.test(c.prices.find(x => x.engine === 'chatgpt').basis), JSON.stringify(c.prices));
  });

  // ===================================================================================================================================
  await guard('S210 G6 — statistics at scale: segments with ranges, Benjamini-Hochberg over the segment family, no delta across a changed panel', async () => {
    reset(); const SN = 'S210 G6 — the last part of a 500-question run: rates per engine / cluster / buyer role / market / stage with 95% ranges, "too few answers", share of voice per cluster, segment changes corrected by Benjamini-Hochberg, the achievable half-width printed, and no delta when the panel changed';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(498);
    // a tiny third market with two questions, so one segment is under the floor (500 questions in all: the most a panel holds)
    panel.push({ ...panel[1], prompt_id: 'g6_qa_1', prompt: 'Which e-invoicing providers serve Qatar? (a)', market: 'QA-en', keyword: 'e-invoicing qatar a' }, { ...panel[1], prompt_id: 'g6_qa_2', prompt: 'Which ERP partners serve Qatar? (b)', market: 'QA-en', keyword: 'erp qatar b' });
    const ids = panel.filter(q => q.kind !== 'brand').map(q => q.prompt_id).sort();
    // last week: the same 501 buyer questions on the same 5 engines; e-invoicing was named in 60% of its answers, everything else as now
    const ENGS = { chatgpt: 1, gemini: 1, perplexity: 1, ai_overview: 1, ai_mode: 1 };
    const prevRow = (o) => ({ site_id: 'site_techand-ai', domain: 'techand.ai', run_id: 'ai_prev', checked_at: day(7), run_kind: 'full', prompts: 499, answers: 2495, samples: 2495, mention_rate: 14.3, citation_rate: 4.8,
      engines_json: JSON.stringify(Object.fromEntries(Object.keys(ENGS).map(e => [e, { name: e, asked: 501, answered: 501, samples: 501, mentioned: 70, cited: 20 }]))), competitors_json: '[]',
      panel_json: JSON.stringify({ ids: (o && o.ids) || ids }), segments_json: JSON.stringify({ v: 1, rows: [['cluster', 'e-invoicing', 42, 210, 126], ['cluster', 'vat compliance', 42, 210, 30], ['persona', 'cfo', 126, 630, 90]] }) });
    const all = []; for (const q of panel) { if (q.kind === 'brand') continue; for (const e of Object.keys(ENGS)) all.push({ ...q, engine: e }); }
    const rows = answerRows(all.map(q => ({ ...q, site_id: 'site_techand-ai', domain: 'techand.ai' })), 'ai_g6stats');
    rows.forEach((r, i) => { const q = panel.find(x => x.prompt_id === r.prompt_id); if (q && q.cluster === 'e-invoicing') r.mentioned = i % 7 === 0; });
    const runIt = async (o) => {
      loadWeekly({ monitors: { ai_prompts_max: 500, ai_markets: 'SA-en, QA-en' }, prompts: panel, runAnswers: rows.slice(0, rows.length - 100), cache: [{ key: 'ai_run:site_techand-ai', kind: 'ai', site_id: 'site_techand-ai', updated_at: day(0.01),
        value: JSON.stringify({ run_id: 'ai_g6stats', run_kind: 'weekly', site_id: 'site_techand-ai', domain: 'techand.ai', started_at: day(0.05), updated_at: day(0.01), chunk: 4, status: 'running', asked: 2395, total: 2495, spent_dfs_usd: 9.58, executions: ['e1', 'e2', 'e3', 'e4'] }) }],
        trigger: { domain: 'techand.ai', site_id: 'site_techand-ai', continue_run: 'ai_g6stats' } });
      mock('Load AI Visibility', items([prevRow(o)]));
      const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
      // every answer of the run: the earlier parts stored all but this part's; this part answers the last 100
      mock('Apply Analysis', items(rows.slice(rows.length - 100)));
      return { plan, am: (await run('AI Metrics', [{ json: {} }]))[0].json };
    };
    const { plan, am } = await runIt();
    check('the plan continues the run and is its last part', plan.chunk.going && plan.chunk.final_expected && plan.run_id === 'ai_g6stats', JSON.stringify(plan.chunk));
    const S = am.segments, R = S.rows;
    const dimCount = (d) => R.filter(s => s.dim === d).length;
    check('segments per engine (5), cluster (12), buyer role (4), market (3), stage (3) and the three cross tables', dimCount('engine') === 5 && dimCount('cluster') === 12 && dimCount('persona') === 4 && dimCount('market') === 3 && dimCount('stage') === 3 && dimCount('cluster x persona') === 48 && dimCount('engine x cluster') === 60 && dimCount('market x cluster') >= 24,
      JSON.stringify(['engine', 'cluster', 'persona', 'market', 'stage', 'cluster x persona', 'engine x cluster', 'market x cluster'].map(dimCount)));
    const qa = R.find(s => s.dim === 'market' && s.key === 'QA-en'), ei = R.find(s => s.dim === 'cluster' && s.key === 'e-invoicing');
    check('each segment carries its 95% Wilson range; a market with 10 answers says too few, never a rate', ei.enough && ei.ci.length === 2 && ei.ci[0] <= ei.rate && ei.rate <= ei.ci[1] && qa && !qa.enough && qa.n === 10 && /12 before it says anything/.test(qa.why), JSON.stringify([ei, qa]));
    check('share of voice per cluster: yours out of yours plus the businesses named instead in those answers, with the leader', ei.sov > 0 && ei.sov < 100 && ei.leader === 'cleartax.com', JSON.stringify(ei));
    const F = S.family;
    check('the segment changes are one family corrected by Benjamini-Hochberg at q = 0.10, and the note says why not Holm', F.method === 'benjamini-hochberg' && F.q === 0.1 && F.tests >= 2 && /false discovery rate/.test(F.note) && /Holm-adjusted, because each one interrupts you/.test(F.note), JSON.stringify(F));
    check('e-invoicing fell from 60% to ~14% on 210 answers a side: a real move; VAT compliance (same as before) is not', ei.change && ei.change.significant === true && ei.change.delta < -40 && R.find(s => s.dim === 'cluster' && s.key === 'vat compliance').change.significant === false, JSON.stringify([ei.change, R.find(s => s.dim === 'cluster' && s.key === 'vat compliance').change]));
    check('the moves list names it', S.moves.some(x => x.dim === 'cluster' && x.key === 'e-invoicing'), JSON.stringify(S.moves));
    // the same family under Holm, for the record: BH never calls fewer
    const AS = kitOf('AI_Metrics.js', 'AIP');
    check('the panel record: the ids asked, the composition, measured and achievable half-widths', am.panel && am.panel.size === 499 && am.panel.composition.market['QA-en'] === 2 && am.panel.half_width.measured.headline > 0 && am.panel.half_width.achievable.headline > 0 && AS.LIMITS.max === 500, JSON.stringify(am.panel && am.panel.half_width));
    const vr = am.vis_row; const segStore = JSON.parse(vr.segments_json); const panStore = JSON.parse(vr.panel_json);
    check('the stored row keeps the segments compact (named columns once) and the panel\'s ids for next week', segStore.v === 1 && segStore.cols[0] === 'dim' && Array.isArray(segStore.rows[0]) && panStore.ids.length === 499 && vr.segments_json.length < 60000, vr.segments_json.length);
    // the report
    const rep0 = (await run('AI Report', store['AI Metrics']))[0].json;
    check('the report prints the topic, buyer and market tables with ranges, what moved, how precise it is, and caps the answer grid at 60 of 501', /By topic cluster/.test(rep0.html) && /By buyer role/.test(rep0.html) && /By market/.test(rep0.html) && /What moved, by segment/.test(rep0.html) && /Benjamini-Hochberg/.test(rep0.html) && /How precise this is/.test(rep0.html) && /The 60 questions that matter most of the 499 asked/.test(rep0.html) && /too few answers/.test(rep0.html) && /asked over 5 executions/.test(rep0.html),
      ['By topic cluster', 'By buyer role', 'What moved', 'How precise', 'matter most', 'too few answers', 'asked over 5'].map(t => t + ':' + rep0.html.includes(t)).join(' '));
    // a changed panel: only 60% of last week's ids — no delta at all, and no segment change
    const { am: am2 } = await runIt({ ids: ids.slice(0, Math.round(ids.length * 0.6)).concat(Array.from({ length: 200 }, (_, i) => 'gone_' + i)) });
    check('under 80% of the questions in common: no delta, the reason printed, no segment tested', /different panel, not a different result/.test(am2.metrics.delta_not_compared) && am2.segments.family.tests === 0 && !am2.metrics.tests, am2.metrics.delta_not_compared);
  });

  // ===================================================================================================================================
  await guard('S211 G6 — one cost table: the engine is held to the golden cases the app is held to', async () => {
    reset(); const SN = 'S211 G6 — every golden case of v5/data/ai_panel_cost_cases.json (copied by the build to harness/ and app/shared) through the generated AIP.cost, field by field';
    begin(SN); const check = mkCheck(SN);
    const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_panel_cost_cases.json'), 'utf8'));
    const pick = (c) => ({ panel: c.panel, asked: c.asked, per_week: c.per_week, pulse_questions_day: c.pulse_questions_day, executions: c.executions, analyst_jobs: c.analyst_jobs,
      requests: c.requests, run: c.run, full_extra: c.full_extra, pulse_day: c.pulse_day, month: c.month, half_width: c.half_width });
    const bad = G.cases.filter(cs => JSON.stringify(pick(AIP.cost(cs.input))) !== JSON.stringify(cs.expect));
    check(G.cases.length + ' golden cases, every figure equal', G.cases.length >= 20 && !bad.length, JSON.stringify(bad.slice(0, 2).map(cs => [cs.input, pick(AIP.cost(cs.input)), cs.expect])));
    check('the table\'s prices are the engine\'s prices', JSON.stringify(G.prices) === JSON.stringify(AIP.PRICE) && JSON.stringify(G.pulse_engines) === JSON.stringify(AIP.PULSE_ENGINES), JSON.stringify([G.prices, AIP.PRICE]));
    const c8 = G.cases.find(cs => cs.input.panel === 8 && Object.keys(cs.input).length === 1);
    check('8 questions: one pulse morning is $0.084 — what the live pulse measured on 2026-10-08 and 2026-10-13', c8 && c8.expect.pulse_day.usd === 0.084, JSON.stringify(c8 && c8.expect.pulse_day));
  });
};
