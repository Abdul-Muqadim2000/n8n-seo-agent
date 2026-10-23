// F2 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/ENGINE_AUDIT.md, fixes/F2.md): run robustness, money safety, ids and load of the
// AI visibility engine. Every scenario here failed on the code before F2 (the audit's proofs p_chain.js / p_arabic.js are its first two)
// and passes after it. Called from scenarios_v5.js after scenarios_g6.js; reads only the generated code (code_v4) and workflows.
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'g6_live.json.gz'))).toString('utf8'));
  const W = FX.weekly;
  const TC = JSON.parse(fs.readFileSync(path.join(__dirname, 'table_cols.json'), 'utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 600), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 450))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const AIP = kitOf('AI_Requests.js', 'AIP');
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const CLUSTERS = ['e-invoicing', 'erp implementation', 'vat compliance', 'corporate tax', 'payroll software', 'inventory management'];
  const synthPanel = (n) => { const out = [];
    for (let i = 0; i < n; i++) { const c = CLUSTERS[i % CLUSTERS.length];
      out.push({ prompt_id: 'f2_' + String(i).padStart(3, '0'), site_id: 'site_techand-ai', domain: 'techand.ai', prompt: 'Which providers offer ' + c + ' in the UAE (variant ' + i + ')?', kind: 'recommend', topic: c, keyword: c + ' uae ' + i,
        source: 'auto', status: 'active', created_at: day(30), stage: 'decision', cluster: c, volume: 10, origin: 'writer', updated_at: day(30), persona: '', market: 'AE-en', pinned: false, fit_note: '', keyword_source: 'writer' }); }
    return out; };
  const loadWeekly = (o) => { const x = o || {};
    mock('Load Sites', items(W['Load Sites'])); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Profiles', items(W['Load Profiles']));
    mock('Load Monitors', items([{ ...W['Load Monitors'][0], ...(x.monitors || {}) }]));
    mock('Load AI Prompts', items(x.prompts || W['Load AI Prompts']));
    mock('Load AI Visibility', items((W['Load AI Visibility'] || []).map((r, i, a) => ({ ...r, checked_at: day(2 + a.length - i), run_kind: i === a.length - 1 ? 'full' : r.run_kind }))));
    mock('Load AI Daily', items([])); mock('Load Cache (AI)', items([...(W['Load Cache (AI)'] || []), ...(x.cache || [])])); mock('Load Query History', items([]));
    mock('Load AI Run Answers', items(x.runAnswers || []));
    if (x.trigger) mock('Manual Run', [{ json: x.trigger }]); else delete store['Manual Run'];
    for (const n of ['Prompt Rows', 'Discovery Requests', 'Run Discovery', 'Analyst Jobs', 'Prompt Jobs', 'AI Asking State', 'Save Asking State', 'AI Requests Go', 'AI Answer Rows', 'Save AI Answers', 'Apply Analysis', 'Parse AI Answers']) delete store[n]; };
  const keyOf = (q) => q.prompt_id + '|' + q.engine;
  const qOnly = (reqs) => reqs.filter(r => r.engine && !/^(market|index)/.test(String(r.prompt_id)));
  const ansRows = (reqs, runId) => qOnly(reqs).map(q => ({ site_id: q.site_id, domain: q.domain, run_id: runId, checked_at: new Date().toISOString(), prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered: true, mentioned: false, cited: false, rank: 0, our_urls: '', competitors: '', sources: '', excerpt: '', cost: 0.004, error: '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '' }));

  // one part of a split run, as the generated workflow runs it: plan -> requests -> record (saved or not) -> go -> answers stored (or not) -> hand-off
  // opts.saveAsking: the upsert answers with the row (default) or an error; opts.save: 'ok' | 'fail' | 'die' (the execution stops before its hand-off)
  const part = async (o, opts) => {
    loadWeekly(o);
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    if (plan.nothing_to_do) return { plan, paid: [], state: null, h: null };
    const reqs = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    const asking = (await run('AI Asking State', [{ json: {} }])).map(i => i.json);
    mock('Save Asking State', (opts && opts.saveAsking === 'fail') ? [{ json: { error: { message: 'insert failed: data table size limit' } } }] : asking.filter(r => !r.skip).map(r => ({ json: { id: 1, ...r } })));
    const go = (await run('AI Requests Go', [{ json: {} }])).map(i => i.json);
    const paid = go[0] && go[0].skip ? [] : qOnly(go).map(keyOf);
    let state = asking.find(r => r.key) || null;
    if (paid.length) {
      const rows = ansRows(go, plan.run_id);
      mock('Parse AI Answers', items(rows));
      const raw = (await run('AI Answer Rows', [{ json: {} }])).map(i => i.json);
      if (opts && opts.save === 'die') return { plan, paid, state, h: null, raw };
      mock('Save AI Answers', (opts && opts.save === 'fail') ? [{ json: { error: { message: 'insert failed: data table size limit (1 GB) reached' } } }] : raw.map((r, i) => ({ json: { id: i + 1, ...r } })));
      mock('Apply Analysis', items(rows));
    } else { delete store['AI Answer Rows']; delete store['Save AI Answers']; mock('Apply Analysis', [{ json: { skip: true } }]); }
    const h = (await run('AI Chunk Handoff', [{ json: {} }])).map(i => i.json)[0];
    if (h && h.state_row) state = h.state_row;
    return { plan, paid, state, h, stored: paid.length && !(opts && opts.save === 'fail') ? ansRows(go, plan.run_id) : [] };
  };

  // ===================================================================================================================================
  await guard('F2-1 E1 — a part whose answers were not stored never re-pays: 4 parts, saves failing, every key paid once', async () => {
    reset(); const SN = 'F2-1 E1 (the audit\'s p_chain): 200 questions, a part whose save FAILS stops the run with an ops alert and a plain reason; later starts ask nothing; no key is paid twice';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(200);
    let cache = [], trigger = null, stored = []; const paidAll = []; let first = null;
    for (let k = 1; k <= 4; k++) {
      const r = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache, runAnswers: stored, trigger }, { save: 'fail' });
      paidAll.push(...r.paid);
      if (k === 1) { first = r;
        check('part 1 records what it is about to pay for BEFORE paying: the state row (exact seo_cache columns) holds the keys and the part in flight', r.state && ['key', 'kind', 'site_id', 'value', 'updated_at'].every(c => c in r.state) && Object.keys(r.state).length === 5, JSON.stringify(r.state).slice(0, 200));
        const st = JSON.parse(r.h.state_row.value);
        check('part 1: its save failed, so the run STOPS (failed_store) with the reason, no next part, and nothing more is reserved', r.h.stopped && st.status === 'failed_store' && /could not be stored/.test(st.stop_reason) && r.h.next === null, JSON.stringify({ status: st.status, why: st.stop_reason, next: r.h.next }));
        const al = (await run('Run Alert Rows', [{ json: {} }])).map(i => i.json);
        check('an ops alert row is recorded (exact seo_ops_alerts columns, critical, due now so this execution\'s sweep delivers it)', al.length === 1 && Object.keys(al[0]).sort().join() === [...TC.OPS_ALERTS].sort().join() && al[0].severity === 'critical' && /STOPPED/.test(al[0].message) && Date.parse(al[0].next_attempt_at) <= Date.now(), JSON.stringify(al[0]).slice(0, 300));
      }
      cache = r.h && r.h.state_row ? [r.h.state_row] : cache;
      trigger = r.h && r.h.next ? r.h.next : { domain: 'techand.ai', site_id: 'site_techand-ai' };   // a later start of the tracker (a retry of the cycle job, a catch-up, the pulse's resume)
      if (k > 1) check('start ' + k + ' after the stop asks NOTHING and says why', r.paid.length === 0 && r.plan.nothing_to_do && /was stopped/.test(r.plan.reason), r.plan.reason || JSON.stringify(r.plan.chunk));
    }
    const twice = paidAll.length - new Set(paidAll).size;
    check('4 starts: ' + paidAll.length + ' keys paid, every one once (the old code paid the first 600 in every part until the run expired)', twice === 0 && paidAll.length === first.paid.length && paidAll.length > 0, paidAll.length + ' paid, ' + twice + ' twice');
  });

  // ===================================================================================================================================
  await guard('F2-2 E1 / E11 — a part that dies before its hand-off: the next one never re-asks what it sent', async () => {
    reset(); const SN = 'F2-2 E1/E11: a part dies after paying (the 60-minute limit, a restart): its stored answers count, its lost keys are not asked again, the next part is halved; a second loss stops the run';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(200);
    // part 1 completes
    const p1 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel }, { save: 'ok' });
    let cache = [p1.h.state_row], stored = p1.stored, trigger = p1.h.next;
    // part 2 pays and dies after storing half of its answers (its record was saved before paying; its hand-off never ran)
    const p2 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache, runAnswers: stored, trigger }, { save: 'die' });
    const half = p2.raw.slice(0, Math.floor(p2.raw.length / 2));
    stored = stored.concat(half); cache = [{ ...p2.state, updated_at: new Date(Date.now() - 2 * 3600e3).toISOString(), value: JSON.stringify({ ...JSON.parse(p2.state.value), updated_at: new Date(Date.now() - 2 * 3600e3).toISOString() }) }];
    // the pulse resumes it two hours later
    const p3 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache, runAnswers: stored, trigger: { domain: 'techand.ai', site_id: 'site_techand-ai', continue_run: '' } }, { save: 'ok' });
    const sent12 = new Set([...p1.paid, ...p2.paid]);
    check('the resumed part asks none of the keys parts 1 and 2 SENT, stored or not', p3.paid.length > 0 && p3.paid.every(k => !sent12.has(k)), p3.paid.slice(0, 3).join(' '));
    check('it counts the lost keys once (not asked again), says so, and is halved', p3.plan.chunk.lost_now === p2.paid.length - half.length && /not asked again/.test(p3.plan.chunk.lost_note) && /halved/.test(p3.plan.chunk.size_basis) && !p3.plan.stop, JSON.stringify({ lost: p3.plan.chunk.lost_now, basis: p3.plan.chunk.size_basis }));
    const al = (await run('Run Alert Rows', [{ json: {} }])).map(i => i.json);
    check('an ops alert (high) names the lost part', al.length === 1 && al[0].severity === 'high' && /never stored/.test(al[0].message), JSON.stringify(al).slice(0, 300));
    // part 4 dies too: the second loss stops the run
    cache = [p3.h.state_row]; stored = stored.concat(p3.stored);
    const p4 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache, runAnswers: stored, trigger: p3.h.next }, { save: 'die' });
    check('part 4 is planned and records its keys before paying', p4.state && p4.paid.length > 0, JSON.stringify(p4.plan.reason || p4.plan.stop || p4.plan.chunk).slice(0, 400));
    if (!p4.state) return;
    cache = [{ ...p4.state, value: JSON.stringify({ ...JSON.parse(p4.state.value), updated_at: new Date(Date.now() - 2 * 3600e3).toISOString() }) }];
    const p5 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache, runAnswers: stored, trigger: { domain: 'techand.ai', site_id: 'site_techand-ai' } }, { save: 'ok' });
    check('a second lost part STOPS the run: nothing asked, the state says failed_store with the reason', p5.paid.length === 0 && p5.plan.stop && p5.plan.stop.status === 'failed_store' && p5.h && JSON.parse(p5.h.state_row.value).status === 'failed_store' && !p5.h.next, JSON.stringify(p5.plan.stop || p5.plan.reason));
    const all = [...p1.paid, ...p2.paid, ...p3.paid, ...p4.paid, ...p5.paid];
    check('no key was paid twice across the five executions', all.length === new Set(all).size, all.length + ' vs ' + new Set(all).size);
    // E11: the answers are stored before the analyst
    check('the answers are stored the moment they are parsed: AI Answer Rows carries exactly the seo_ai_answers columns', p2.raw.length > 0 && p2.raw.every(r => Object.keys(r).join() === TC.AI_ANSWERS.join()), JSON.stringify(Object.keys(p2.raw[0] || {})));
  });

  // ===================================================================================================================================
  await guard('F2-3 E1 — the run\'s money ceiling and the record that must exist before paying', async () => {
    reset(); const SN = 'F2-3 E1: a run at its hard DataForSEO ceiling stops with an alert; a part asks only what fits under the ceiling; a part whose record could not be saved pays nothing';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(200);
    const p1 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel }, { save: 'ok' });
    const st1 = JSON.parse(p1.h.state_row.value);
    check('the run carries a ceiling fixed at its start (1.5 x its own estimate)', st1.ceiling_dfs_usd > 0 && Math.abs(st1.ceiling_dfs_usd - AIP.runCeiling(p1.plan.run_cost_est.dfs)) < 0.011, st1.ceiling_dfs_usd + ' vs ' + p1.plan.run_cost_est.dfs);
    // a state whose spend reached the ceiling with questions left
    const over = { ...p1.h.state_row, value: JSON.stringify({ ...st1, spent_dfs_usd: st1.ceiling_dfs_usd + 0.01 }) };
    const p2 = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache: [over], runAnswers: p1.stored, trigger: p1.h.next }, { save: 'ok' });
    check('at the ceiling: nothing is asked, the run stops (stopped_ceiling) and an ops alert says why', p2.paid.length === 0 && p2.plan.stop && p2.plan.stop.status === 'stopped_ceiling' && JSON.parse(p2.h.state_row.value).status === 'stopped_ceiling' && p2.plan.est_dfs_usd === 0, JSON.stringify(p2.plan.stop));
    // just under it: AI Requests stops adding requests at what is left
    const near = { ...p1.h.state_row, value: JSON.stringify({ ...st1, spent_dfs_usd: st1.ceiling_dfs_usd - 0.05 }) };
    loadWeekly({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache: [near], runAnswers: p1.stored, trigger: p1.h.next });
    const pn = (await run('AI Plan', [{ json: {} }]))[0].json;
    const rq = qOnly((await run('AI Requests', [{ json: {} }])).map(i => i.json));
    const est = rq.reduce((t, r) => t + (Number(r.est_cost) || 0), 0);
    check('$0.05 under the ceiling: the part asks at most $0.05 of requests and names the rest as capped', est <= 0.05 + 1e-9 && rq.length > 0 && pn.chunk.ceiling_left_usd <= 0.0501, est + ' / ' + rq.length);
    // a record that could not be saved: nothing is paid
    const pr = await part({ monitors: { ai_prompts_max: 200 }, prompts: panel }, { saveAsking: 'fail' });
    check('the record before paying could not be saved: nothing is paid, the hand-off alerts and starts nothing', pr.paid.length === 0 && pr.h && pr.h.next === null && pr.h.alerts.length === 1 && /could not be saved/.test(pr.h.alerts[0].message), JSON.stringify(pr.h).slice(0, 300));
  });

  // ===================================================================================================================================
  await guard('F2-4 E2 / E15 / E9 / E20 — question ids for every script, per site, 64 bits; a real search phrase', async () => {
    reset(); const SN = 'F2-4 E2/E15/E9/E20: three Arabic questions are three rows with three ids, the same question on the writer\'s and the owner\'s path has one id, two sites never share one, an owner question gets a search phrase from its words';
    begin(SN); const check = mkCheck(SN);
    loadWeekly({ monitors: { ai_prompts_max: 30, ai_markets: 'AE-ar' }, trigger: { ...W['Manual Run'][0] } });
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    mock('Prompt Jobs', [{ json: { site_id: plan.site_id, persona: '', market: 'AE-ar', count: 5 } }]);
    const AR = ['ما هي أفضل شركات تطبيق الفوترة الإلكترونية في الإمارات؟', 'كم تكلفة تطبيق نظام تخطيط موارد المؤسسات لشركة متوسطة في دبي؟', 'كيف أختار مزود خدمة الرواتب المناسب لشركتي في أبوظبي؟'];
    mock('Prompt Writer', [{ json: { output: { prompts: AR.map(p => ({ prompt: p, kind: 'recommend', stage: 'decision', cluster: 'arabic', keyword: '', origin: 'writer' })) } } }]);
    const rows = (await run('Prompt Rows', [{ json: {} }])).map(i => i.json).filter(r => AR.includes(r.prompt));
    check('the writer\'s 3 Arabic questions are 3 rows with 3 distinct ids (the old normaliser gave them ONE id and stored one)', rows.length === 3 && new Set(rows.map(r => r.prompt_id)).size === 3 && rows.every(r => /^q_[0-9a-z]{14}$/.test(r.prompt_id)), JSON.stringify(rows.map(r => [r.prompt_id, r.status])));
    check('Cyrillic and Chinese questions get their own ids too', new Set([AIP.promptId('s', 'Какая ERP лучше для малого бизнеса?'), AIP.promptId('s', 'Какая CRM лучше для малого бизнеса?'), AIP.promptId('s', '哪家公司提供最好的电子发票服务？'), AIP.promptId('s', '哪家公司提供最好的工资服务？')]).size === 4, '');
    check('one question, one id: case, spacing, punctuation and Arabic harakat do not change it', AIP.promptId('s', 'What is ERP?') === AIP.promptId('s', '  what IS erp ') && AIP.promptId('s', 'مَا هِيَ أفضل') === AIP.promptId('s', 'ما هي أفضل'), '');
    check('two sites never share an id (the key is per site and the upsert is on site_id + prompt_id)', AIP.promptId('site_a', 'What is ERP?') !== AIP.promptId('site_b', 'What is ERP?'), '');
    // the owner's path gives the writer's question the SAME id
    await run('Admin Action', { body: { action: 'ai_prompts', domain: 'techand.ai', add: [AR[0], { prompt: 'What should I check before choosing an e-invoicing provider in the UAE?' }, { prompt: 'Which payroll provider suits a 40-person Dubai firm?', keyword: 'payroll provider dubai' }] } });
    mock('Load AI Prompts (Admin)', items([{ prompt_id: 'p_legacy1', site_id: 'site_techand-ai', domain: 'techand.ai', prompt: 'Which payroll provider suits a 40-person Dubai firm?', kind: 'custom', topic: '', keyword: 'which payroll provider suits a', source: 'custom', status: 'active', created_at: day(9), stage: 'decision', cluster: '', volume: null, origin: 'custom', updated_at: '', persona: '', market: '', pinned: false, fit_note: '' }]));
    const ad = (await run('AI Prompt Rows (Admin)', [{ json: {} }])).map(i => i.json);
    const arA = ad.find(r => r.prompt === AR[0]) || {}, chk = ad.find(r => /check before choosing/.test(r.prompt)) || {}, pay = ad.find(r => /payroll provider/.test(r.prompt)) || {};
    check('the owner adds the writer\'s Arabic question: the same id on both paths', arA.prompt_id === rows.find(r => r.prompt === AR[0]).prompt_id, arA.prompt_id + ' vs ' + rows.find(r => r.prompt === AR[0]).prompt_id);
    check('E9: an owner question\'s search phrase comes from its content words, not its first five words, and says it was derived', chk.keyword === 'choosing e-invoicing provider uae' && chk.keyword_source === 'derived', JSON.stringify([chk.keyword, chk.keyword_source]));
    check('E9: the owner\'s own keyword is used and marked; a stored row with the same text keeps its stored (legacy) id', pay.keyword === 'payroll provider dubai' && pay.keyword_source === 'owner' && pay.prompt_id === 'p_legacy1', JSON.stringify([pay.prompt_id, pay.keyword, pay.keyword_source]));
    // W2-E3 (2026-10-23): the asked-state columns (last_asked_run, last_asked_at, asked_n_28d, refused_at_run) have ONE writer, the weekly run's
    // Save Prompt State (an update that touches only them); every other writer leaves them out, so an upsert never blanks them
    check('every Admin row has exactly the seo_ai_prompts columns (but the asked state, which the weekly run alone writes)', ad.every(r => Object.keys(r).sort().join() === TC.AI_PROMPTS.filter(c => !(TC.AI_PROMPTS_STATE || []).includes(c)).sort().join()), JSON.stringify(Object.keys(ad[0] || {})));
    // E9: a derived phrase is not asked of Google's AI Overview; E20: a re-upsert keeps fit_note and the stored market
    const base = synthPanel(4).map((p, i) => i === 0 ? { ...p, keyword_source: 'derived', keyword: 'choosing e-invoicing provider uae' } : i === 1 ? { ...p, market: 'QA-en', fit_note: 'switched on by the owner over the keyword rule: x', volume: '', stage: '', cluster: '' } : p);
    loadWeekly({ monitors: { ai_prompts_max: 30 }, prompts: base, trigger: { ...W['Manual Run'][0] } });
    const p2 = (await run('AI Plan', [{ json: {} }]))[0].json;
    const rq = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    check('a derived search phrase is not asked of the AI Overview; a writer\'s phrase is', !rq.some(r => r.engine === 'ai_overview' && r.prompt_id === base[0].prompt_id) && rq.some(r => r.engine === 'ai_overview' && r.prompt_id === base[2].prompt_id), JSON.stringify(rq.filter(r => r.engine === 'ai_overview').map(r => r.prompt_id)));
    mock('Prompt Jobs', [{ json: { skip: true } }]); delete store['Prompt Writer'];
    const pr = (await run('Prompt Rows', [{ json: {} }])).map(i => i.json);
    const kept = pr.find(r => r.prompt_id === base[1].prompt_id) || {};
    check('E20: re-upserting a stored question keeps its fit_note and its stored market', kept.fit_note === base[1].fit_note && kept.market === 'QA-en', JSON.stringify([kept.fit_note, kept.market]));
  });

  // ===================================================================================================================================
  await guard('F2-5 E17 — an on-demand check that meets an open run is answered at once', async () => {
    reset(); const SN = 'F2-5 E17: an on-demand check during an open split run gets a rejected callback of its own (reason open_run, the run id, its progress, when it should finish); a resume keeps the open run\'s caller';
    begin(SN); const check = mkCheck(SN);
    const panel = synthPanel(200);
    const st = (min) => ({ key: 'ai_run:site_techand-ai', kind: 'ai', site_id: 'site_techand-ai', updated_at: new Date(Date.now() - min * 60000).toISOString(),
      value: JSON.stringify({ run_id: 'ai_20261023_techand-ai', run_kind: 'weekly', site_id: 'site_techand-ai', domain: 'techand.ai', started_at: new Date(Date.now() - (min + 30) * 60000).toISOString(), updated_at: new Date(Date.now() - min * 60000).toISOString(),
        chunk: 1, status: 'running', asked: 300, total: 995, request_id: 'cyc_x', callback_url: 'https://app.test/hook/weekly', asked_keys: {}, executions: ['e1'] }) });
    const od = { domain: 'techand.ai', request_id: 'req-od-1', callback_url: 'https://app.test/hook/od' };
    loadWeekly({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache: [st(10)], trigger: od });
    const pb = (await run('AI Plan', [{ json: {} }]))[0].json;
    const nb = (await run('Busy Notices (AI)', [{ json: {} }])).map(i => i.json);
    check('busy: nothing is planned, and the caller gets its own rejected callback with the open run\'s id, progress and expected finish', pb.nothing_to_do && nb.length === 1 && nb[0].callback_url === od.callback_url && nb[0].body.request_id === 'req-od-1' && nb[0].body.reason === 'open_run' && nb[0].body.open_run.run_id === 'ai_20261023_techand-ai' && nb[0].body.open_run.expected_finish && /already running/.test(nb[0].body.error) && nb[0].body.cost_usd === 0, JSON.stringify(nb[0]).slice(0, 400));
    loadWeekly({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache: [st(120)], trigger: od });
    const pr = (await run('AI Plan', [{ json: {} }]))[0].json;
    const nr = (await run('Open Run Notices (AI)', [{ json: {} }])).map(i => i.json);
    check('resume by an on-demand start: the run continues under ITS caller (request id and callback from the state), and the on-demand caller is told', !pr.nothing_to_do && pr.request_id === 'cyc_x' && pr.callback_url === 'https://app.test/hook/weekly' && nr.length === 1 && nr[0].body.request_id === 'req-od-1' && /started its next part again/.test(nr[0].body.error), JSON.stringify([pr.request_id, pr.callback_url, nr[0] && nr[0].body.error]));
    loadWeekly({ monitors: { ai_prompts_max: 200 }, prompts: panel, cache: [st(10)] });
    await run('AI Plan', [{ json: {} }]);
    const ns = (await run('Busy Notices (AI)', [{ json: {} }])).map(i => i.json);
    check('a scheduled start that meets the open run posts nothing (nobody is waiting)', ns.length === 1 && ns[0].skip, JSON.stringify(ns));
  });

  // ===================================================================================================================================
  await guard('F2-6 E11 / E12 / E18 / E22 — wiring, scoped loads, one gate input, time-sized parts', async () => {
    reset(); const SN = 'F2-6: the generated tracker stores answers before the analyst and records before paying; every AI-table read is scoped to the site (and run); the weekly run and the pulse build one gate input; parts are sized by time';
    begin(SN); const check = mkCheck(SN);
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_vis_wiring.json'), 'utf8'));   // written by build_monitors.py from the generated workflow
    const outs = (n) => ((wf.connections[n] || {}).main || []).flat().filter(Boolean).map(c => c.node);
    const reach = (from, to, avoid) => { const seen = new Set([from]), st = [from]; while (st.length) { const c = st.pop(); if (c === to) return true; for (const n of outs(c)) if (!seen.has(n) && !(avoid || []).includes(n)) { seen.add(n); st.push(n); } } return false; };
    check('E11: Save AI Answers comes BEFORE the Answer Analyst (no path from the analyst to the insert)', reach('Save AI Answers', 'Answer Analyst') && !reach('Answer Analyst', 'Save AI Answers'), '');
    check('E1: Run AI Requests is reachable only through the saved record (no path from AI Requests to it that avoids Save Asking State + AI Requests Go)', !reach('AI Requests', 'Run AI Requests', ['AI Requests Go']) && reach('Save Asking State', 'Run AI Requests'), '');
    const conds = (n) => ((wf.filters || {})[n] || {}).conditions || [];
    const scoped = ['Load AI Prompts', 'Load AI Visibility', 'Load AI Daily', 'Load Cache (AI)', 'Load Query History', 'Load AI Run Answers', 'Load Pages (AI)', 'Load Link Prospects'];
    // R-E2 (2026-10-23): `eq` (exact) when the start names the site, `like '%'` only when it names none (n8n's like is a CONTAINS match)
    check('E12: every read of a per-site AI table is filtered by the site server-side (R-E2: exact when the start names it)', scoped.every(n => conds(n).some(c => c.keyName === 'site_id' && /=== '%' \? 'like' : 'eq'/.test(String(c.condition)) && /Manual Run/.test(c.keyValue))), JSON.stringify(scoped.filter(n => !conds(n).some(c => c.keyName === 'site_id'))));
    check('E12: the run\'s answers are filtered by the run too, and the weekly rows by a 60-day window', conds('Load AI Run Answers').some(c => c.keyName === 'run_id' && /continue_run/.test(c.keyValue)) && conds('Load AI Visibility').some(c => c.keyName === 'checked_at' && /60 \* 864e5/.test(c.keyValue)), '');
    check('E15: Save Prompts upserts on site_id + prompt_id', JSON.stringify(conds('Save Prompts').map(c => c.keyName)) === '["site_id","prompt_id"]', JSON.stringify(conds('Save Prompts')));
    // the scope expression on its own: a site id, a domain, nothing
    const expr = conds('Load AI Prompts').find(c => c.keyName === 'site_id').keyValue.replace(/^=\{\{|\}\}$/g, '');
    const evalScope = (t) => new Function('$', 'return (' + expr + ');')((n) => ({ first: () => ({ json: t }) }));
    check('E12: the scope reads site_id, else the domain (https://www. stripped), else every site (%)', evalScope({ site_id: 'site_x-com' }) === 'site_x-com' && evalScope({ domain: 'https://www.Tech-And.ai/x' }) === 'site_tech-and-ai' && evalScope({}) === '%', [evalScope({ site_id: 'site_x-com' }), evalScope({ domain: 'https://www.Tech-And.ai/x' }), evalScope({})].join(' '));
    // E18: the same gate input on the two paths
    loadWeekly({ monitors: {}, trigger: { ...W['Manual Run'][0] } });
    const wk = (await run('AI Plan', [{ json: {} }]))[0].json;
    const P = FX.pulse;
    mock('Load Sites', items(P['Load Sites'])); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Monitors', items(P['Load Monitors'])); mock('Load Profiles', items(P['Load Profiles']));
    mock('Load AI Prompts', items(P['Load AI Prompts'])); mock('Load AI Visibility', items(P['Load AI Visibility'])); mock('Load AI Daily', items(P['Load AI Daily'])); mock('Load Cache (AI)', items(P['Load Cache (AI)']));
    mock('Manual Run', [{ json: { ...P['Manual Run'][0] } }]);
    const pp = (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' }))[0].json;
    const norm = (f) => JSON.stringify({ ...f, competitors: [...(f.competitors || [])].sort(), heads: [...(f.heads || [])].sort() });
    check('E18: the weekly plan and the pulse build the SAME fit-gate input for the site (ladder heads, services, keywords)', pp.fit_input && wk.fit_input && norm(pp.fit_input.heads ? { heads: pp.fit_input.heads, own: pp.fit_input.own_domain } : {}) === norm({ heads: wk.fit_input.heads, own: wk.fit_input.own_domain }) && (wk.fit_input.services || []).length === (pp.fit_input.services || []).length,
      JSON.stringify({ week: wk.fit_input, pulse: pp.fit_input }).slice(0, 500));
    // E11: the time budget
    const cp = AIP.chunkPlan({ engines: ['chatgpt', 'perplexity', 'gemini', 'ai_overview', 'ai_mode'], analyst_jobs: 12 });
    check('E11: a part is sized to fit 40 of the 60 minutes (requests x modelled seconds + analyst jobs + loads < 40 min), never 600 at the slow-case times', cp.size < 600 && cp.size * cp.sec_per_request + 12 * AIP.TIME.analyst_job_s + AIP.TIME.fixed_s + AIP.TIME.retry_wait_s <= AIP.TIME.budget_s + 1 && AIP.chunkPlan({ engines: ['ai_overview'], measured_s: 0.5 }).size === 600, JSON.stringify(cp));
    check('E11: a measured slow run gets smaller parts', AIP.chunkPlan({ engines: ['chatgpt'], measured_s: 12, analyst_jobs: 6 }).size < AIP.chunkPlan({ engines: ['chatgpt'], analyst_jobs: 6 }).size, '');
    // E22: a stored market past the cap is asked in the own market and the request says so
    const many = synthPanel(10).map((p, i) => ({ ...p, market: ['AE-en', 'SA-en', 'QA-en', 'KW-en', 'BH-en', 'OM-en', 'EG-en', 'JO-en', 'LB-en', 'MA-en'][i] }));
    loadWeekly({ monitors: { ai_prompts_max: 30 }, prompts: many, trigger: { ...W['Manual Run'][0] } });
    await run('AI Plan', [{ json: {} }]);
    const rq = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    check('E22: a question whose market is past the ' + AIP.MARKETS_MAX + '-market cap is flagged market_fallback and counted', rq.some(r => r.market_fallback) && (rq[0].chunks || [])[0].market_fallback > 0, JSON.stringify((rq[0].chunks || [])[0]));
  });
};
