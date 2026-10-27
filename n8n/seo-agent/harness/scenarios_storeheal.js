// STOREHEAL (2026-10-27, production 2026-10-25: devaicon.com run ai_20261025_devaicon-com stopped `failed_store` with "3 of the 59 answers of
// part 1 could not be stored (seo_ai_answers: Internal SE Server Error.)" while all 59 rows were in the table). Root cause: the hand-off counted
// a row *Save AI Answers* handed back as unsaved when its `error` COLUMN was set - the column that keeps DataForSEO's message for an answer the
// in-200 gate could not read. n8n 2.41's Data Table insert writes a call's rows in one transaction and hands each back with its id, or fails
// them all, so "3 of 59" could never be a real insert failure. These scenarios hold the fix: a row is stored when the table handed it back
// with an id; a short save is read back and the truly missing rows inserted once more before a part may stop; a run already stopped
// `failed_store` heals itself on the next start of the tracker or the pulse's resume; and nothing is ever asked or paid for twice.
// Called from scenarios_v5.js; reads only the generated code (code_v4) and fixtures.
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
  const SITE = 'site_techand-ai', DOM = 'techand.ai';
  const panelOf = (n) => { const out = [];
    for (let i = 0; i < n; i++) out.push({ prompt_id: 'sh_' + String(i).padStart(3, '0'), site_id: SITE, domain: DOM, prompt: 'Which providers offer e-invoicing in the UAE (variant ' + i + ')?', kind: 'recommend', topic: 'e-invoicing', keyword: 'e-invoicing uae ' + i,
      source: 'auto', status: 'active', created_at: day(30), stage: 'decision', cluster: 'e-invoicing', volume: 10, origin: 'writer', updated_at: day(30), persona: '', market: 'AE-en', pinned: false, fit_note: '', keyword_source: 'writer' });
    return out; };
  const NODES = ['Prompt Rows', 'Discovery Requests', 'Run Discovery', 'Analyst Jobs', 'Prompt Jobs', 'AI Asking State', 'Save Asking State', 'AI Requests Go', 'AI Answer Rows', 'Save AI Answers', 'Apply Analysis', 'Parse AI Answers',
    'AI Save Check', 'Reread AI Answers', 'AI Save Retry Rows', 'Retry Save AI Answers'];
  const loadWeekly = (o) => { const x = o || {};
    mock('Load Sites', items(W['Load Sites'])); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Profiles', items(W['Load Profiles']));
    mock('Load Monitors', items([{ ...W['Load Monitors'][0], ...(x.monitors || {}) }]));
    mock('Load AI Prompts', items(x.prompts));
    mock('Load AI Visibility', items((W['Load AI Visibility'] || []).map((r, i, a) => ({ ...r, checked_at: day(2 + a.length - i), run_kind: i === a.length - 1 ? 'full' : r.run_kind }))));
    mock('Load AI Daily', items([])); mock('Load Cache (AI)', items([...(W['Load Cache (AI)'] || []), ...(x.cache || [])])); mock('Load Query History', items([]));
    mock('Load AI Run Answers', items(x.runAnswers || []));
    if (x.trigger) mock('Manual Run', [{ json: x.trigger }]); else delete store['Manual Run'];
    for (const n of NODES) delete store[n]; };
  const keyOf = (q) => q.prompt_id + '|' + q.engine;
  const qOnly = (reqs) => reqs.filter(r => r.engine && !/^(market|index)/.test(String(r.prompt_id)));
  // the parser's rows; `unread` answers carry the gate's DataForSEO message, exactly as production stored them
  const ansRows = (reqs, runId, unread) => qOnly(reqs).map((q, i) => ({ site_id: q.site_id, domain: q.domain, run_id: runId, checked_at: new Date().toISOString(), prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered: !(i < (unread || 0)), mentioned: false, cited: false, rank: 0, our_urls: '', competitors: '', sources: '', excerpt: '', cost: 0.004, error: i < (unread || 0) ? 'Internal SE Server Error.' : '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '' }));
  let nextId = 1000;
  const asTable = (r) => ({ id: nextId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...r });   // what the Data Table hands back
  const failItems = (rows) => rows.map(r => ({ json: { ...r }, error: { message: 'insert failed: Internal Server Error (database is locked)' } }));   // n8n: the input row + the error on the ITEM

  // one part as the generated workflow runs it: plan -> requests -> record -> go -> answers -> Save -> [AI Save Check -> Reread -> Retry Rows -> Retry Save] -> hand-off
  // opts: unread (answers the gate could not read), save 'ok' | 'fail', reread 'all' | 'half' | 'none', retry 'ok' | 'fail'
  const part = async (o, opts) => { const x = opts || {};
    loadWeekly(o);
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    if (plan.nothing_to_do) return { plan, paid: [], h: null, table: [] };
    const reqs = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    const asking = (await run('AI Asking State', [{ json: {} }])).map(i => i.json);
    mock('Save Asking State', asking.filter(r => !r.skip).map(r => ({ json: { id: 1, ...r } })));
    const go = (await run('AI Requests Go', [{ json: {} }])).map(i => i.json);
    const paid = go[0] && go[0].skip ? [] : qOnly(go).map(keyOf);
    let table = [], check = null, retryRows = null;
    if (paid.length) {
      mock('Parse AI Answers', items(ansRows(go, plan.run_id, x.unread)));
      const raw = (await run('AI Answer Rows', [{ json: {} }])).map(i => i.json);
      if (x.save === 'fail') mock('Save AI Answers', failItems(raw)); else { const saved = raw.map(asTable); table = table.concat(saved); mock('Save AI Answers', saved.map(j => ({ json: j }))); }
      check = (await run('AI Save Check', [{ json: {} }])).map(i => i.json);
      if (!check[0].skip) {
        // what the table really holds: written despite the reported error ('all'), half of it, or nothing
        const held = x.reread === 'all' ? raw : x.reread === 'half' ? raw.slice(0, Math.floor(raw.length / 2)) : [];
        const back = held.map(asTable); table = table.concat(back);
        mock('Reread AI Answers', back.length ? back.map(j => ({ json: j })) : [{ json: {} }]);
        retryRows = (await run('AI Save Retry Rows', [{ json: {} }])).map(i => i.json);
        if (!retryRows[0].skip) { if (x.retry === 'ok') { const ins = retryRows.map(asTable); table = table.concat(ins); mock('Retry Save AI Answers', ins.map(j => ({ json: j }))); } else mock('Retry Save AI Answers', failItems(retryRows)); }
      }
      mock('Apply Analysis', items(raw));
    } else { mock('Apply Analysis', [{ json: { skip: true } }]); }
    const h = (await run('AI Chunk Handoff', [{ json: {} }])).map(i => i.json)[0];
    const al = h ? (await run('Run Alert Rows', [{ json: {} }])).map(i => i.json).filter(a => !a.skip) : [];
    return { plan, paid, h, st: h && h.state_row ? JSON.parse(h.state_row.value) : null, table, check, retryRows, alerts: al };
  };
  const MON = { ai_prompts_max: 12 };

  // ===================================================================================================================================
  await guard('STOREHEAL-1 the production replay: stored rows that carry DataForSEO\'s error are stored', async () => {
    reset(); const SN = 'STOREHEAL-1 (devaicon.com 2026-10-25): a part whose save hands back every row, 3 of them carrying "Internal SE Server Error." in the error column, is NOT failed_store';
    begin(SN); const check = mkCheck(SN);
    const r = await part({ monitors: MON, prompts: panelOf(12) }, { unread: 3, save: 'ok' });
    check('the part asked its requests and 3 answers could not be read by the gate (stored with their error)', r.paid.length > 3 && r.table.filter(t => t.error).length === 3, r.paid.length + ' paid');
    check('AI Save Check sees no gap: every row came back from the table with its id (the error column is not a failed save)', r.check && r.check.length === 1 && r.check[0].skip === true, JSON.stringify(r.check));
    check('the hand-off does not stop the run: no failed_store, no lost answers, no critical alert', r.h && !r.h.stopped && r.st.status === 'running' && r.st.lost === 0 && !r.st.lost_keys && !r.alerts.some(a => a.severity === 'critical'), JSON.stringify({ st: r.st && r.st.status, why: r.st && r.st.stop_reason }));
    check('the 3 answers the gate could not read are counted as could-not-be-read, never as lost', r.st.unavailable === 3, JSON.stringify({ unavailable: r.st.unavailable }));
  });

  // ===================================================================================================================================
  await guard('STOREHEAL-2 a save that reported an error for rows it did write', async () => {
    reset(); const SN = 'STOREHEAL-2: the save hands back an error for every row, the table holds them all -> read back, nothing re-inserted, not failed_store';
    begin(SN); const check = mkCheck(SN);
    const r = await part({ monitors: MON, prompts: panelOf(12) }, { save: 'fail', reread: 'all' });
    check('AI Save Check asks for a read-back of this site and run', r.check && r.check.length === 1 && !r.check[0].skip && r.check[0].site_id === SITE && r.check[0].run_id === r.plan.run_id && r.check[0].missing === r.paid.length, JSON.stringify(r.check));
    check('nothing is inserted twice: every row is already in the table', r.retryRows && r.retryRows[0].skip === true, JSON.stringify(r.retryRows && r.retryRows[0]));
    check('the run carries on (running, nothing lost) and the state says how many were found on the re-read', !r.h.stopped && r.st.status === 'running' && r.st.lost === 0 && r.st.save_rechecked === r.paid.length, JSON.stringify({ st: r.st.status, rechecked: r.st.save_rechecked }));
  });

  // ===================================================================================================================================
  await guard('STOREHEAL-3 the truly missing rows are inserted once more', async () => {
    reset(); const SN = 'STOREHEAL-3: the table holds half of a failed save; the other half is inserted once more (exact columns) and the run carries on';
    begin(SN); const check = mkCheck(SN);
    const r = await part({ monitors: MON, prompts: panelOf(12) }, { save: 'fail', reread: 'half', retry: 'ok' });
    const half = Math.floor(r.paid.length / 2);
    check('AI Save Retry Rows carries exactly the missing answers, as exact seo_ai_answers rows', r.retryRows && r.retryRows.length === r.paid.length - half && r.retryRows.every(x => Object.keys(x).join() === TC.AI_ANSWERS.join()), (r.retryRows || []).length + ' vs ' + (r.paid.length - half));
    check('none of the retried rows is one the table already held', r.retryRows.every(x => !r.table.slice(0, half).some(t => t.prompt_id === x.prompt_id && t.engine === x.engine)), '');
    check('after the retry every answer is stored: not failed_store', !r.h.stopped && r.st.status === 'running' && r.st.lost === 0, JSON.stringify({ st: r.st.status, why: r.st.stop_reason }));
  });

  // ===================================================================================================================================
  await guard('STOREHEAL-4 truly missing after the retry -> paused, with the keys and a plain reason', async () => {
    reset(); const SN = 'STOREHEAL-4: a save that failed, a table that holds nothing and a retry that fails -> failed_store with lost_keys, a reason that says what happened and what the engine does next';
    begin(SN); const check = mkCheck(SN);
    const r = await part({ monitors: MON, prompts: panelOf(12) }, { save: 'fail', reread: 'none', retry: 'fail' });
    check('the run stops failed_store with every lost key recorded', r.h.stopped && r.st.status === 'failed_store' && r.st.lost === r.paid.length && AIP.unpackKeys(r.st.lost_keys).size === r.paid.length && r.h.next === null, JSON.stringify({ st: r.st.status, lost: r.st.lost }));
    check('the reason names the insert\'s own error (not a DataForSEO message), the read-back and the retry, and that nobody has to clear the row',
      /database is locked/.test(r.st.stop_reason) && /read back/.test(r.st.stop_reason) && /inserted once more/.test(r.st.stop_reason) && /Nobody has to clear/.test(r.st.stop_reason) && !/Internal SE Server/.test(r.st.stop_reason), r.st.stop_reason);
    check('a critical ops alert carries the same reason', r.alerts.length === 1 && r.alerts[0].severity === 'critical' && /read back/.test(r.alerts[0].message), JSON.stringify(r.alerts).slice(0, 300));
  });

  // ===================================================================================================================================
  await guard('STOREHEAL-5 a failed_store run whose answers are all in the table heals on the next start and on the pulse\'s resume', async () => {
    reset(); const SN = 'STOREHEAL-5: the production state (failed_store, lost 3, no lost_keys, all answers stored) heals on the next tracker start and through the AI Pulse\'s resume; nothing is asked twice';
    begin(SN); const check = mkCheck(SN);
    const panel = panelOf(12);
    // part 1, as the OLD code ended it: every row stored, the state written failed_store with lost 3 and no lost_keys
    const p1 = await part({ monitors: MON, prompts: panel }, { unread: 3, save: 'ok' });
    const legacy = { ...p1.st, status: 'failed_store', finishing: false, lost: 3, lost_keys: undefined, stop_reason: '3 of the ' + p1.paid.length + ' answers of part 1 could not be stored (seo_ai_answers: Internal SE Server Error.). They were paid for and are not asked again (that would pay twice); the run is stopped.',
      updated_at: new Date(Date.now() - 3 * 3600e3).toISOString() };
    delete legacy.lost_keys;
    const row = { ...p1.h.state_row, value: JSON.stringify(legacy) };
    check('the old stopped state blocks the site (the bug as production saw it)', AIP.stateVerdict(legacy, new Date().toISOString(), '') === 'blocked', '');
    // (a) the next start of the tracker (a catch-up / cycle job: no continue_run) reads the run's rows and heals
    const p2 = await part({ monitors: MON, prompts: panel, cache: [row], runAnswers: p1.table }, { save: 'ok' });
    check('the next start is NOT blocked: the run continues as the same run, healed (found 3, missing 0)', !p2.plan.nothing_to_do && p2.plan.run_id === p1.plan.run_id && p2.plan.chunk.going && p2.plan.chunk.store_heal && p2.plan.chunk.store_heal.missing === 0 && p2.plan.chunk.store_heal.found === 3, JSON.stringify(p2.plan.reason || p2.plan.chunk.store_heal));
    check('nothing is asked again: no key part 1 sent is in this start\'s requests', p2.paid.every(k => !p1.paid.includes(k)), p2.paid.filter(k => p1.paid.includes(k)).join(' '));
    check('the healed state: running, lost 0, no stop reason; the report note says the answers were all found and nothing was asked again', p2.st && p2.st.status === 'running' && p2.st.lost === 0 && !p2.st.stop_reason && /every one of them is in the table/.test(p2.plan.chunk.unavailable_note || ''), JSON.stringify({ st: p2.st && p2.st.status, note: p2.plan.chunk.unavailable_note }));
    check('an ops alert (medium) says the run continued by itself', p2.alerts.some(a => /store_healed/.test(a.alert_key) && a.severity === 'medium' && /CONTINUED by itself/.test(a.message)), JSON.stringify(p2.alerts.map(a => a.alert_key)));
    // (b) the AI Pulse's resume picks the stopped run up and starts the tracker with continue_run; that start heals too
    reset();
    mock('Load Cache (AI)', [{ json: row }]);
    const res = (await run('AI Run Resume', [{ json: {} }], { code: 'Pulse__AI_Run_Resume' })).map(i => i.json);
    check('the pulse\'s resume starts the stopped run again so the tracker checks the table (continue_run, store_check)', res.length === 1 && res[0].continue_run === p1.plan.run_id && res[0].store_check === true && res[0].site_id === SITE, JSON.stringify(res));
    const p3 = await part({ monitors: MON, prompts: panel, cache: [row], runAnswers: p1.table, trigger: res[0] }, { save: 'ok' });
    check('the resumed start continues the run (continue) and asks nothing part 1 sent', !p3.plan.nothing_to_do && p3.plan.run_id === p1.plan.run_id && p3.plan.chunk.store_heal && p3.paid.every(k => !p1.paid.includes(k)), JSON.stringify(p3.plan.reason || p3.plan.chunk.store_heal));
    // (c) the pulse never resumes a run stopped at its money ceiling, nor one older than resume_days
    reset();
    mock('Load Cache (AI)', [{ json: { ...row, value: JSON.stringify({ ...legacy, status: 'stopped_ceiling' }) } }, { json: { ...row, key: 'ai_run:site_old-com', value: JSON.stringify({ ...legacy, site_id: 'site_old-com', started_at: day(7) }) } }]);
    const res2 = (await run('AI Run Resume', [{ json: {} }], { code: 'Pulse__AI_Run_Resume' })).map(i => i.json);
    check('a run stopped at its money ceiling and a stopped run older than 6 days are not started again', res2.length === 1 && res2[0].skip === true, JSON.stringify(res2));
  });

  // ===================================================================================================================================
  await guard('STOREHEAL-6 truly missing answers: continue once, counted as could-not-be-read; a second failure stays stopped', async () => {
    reset(); const SN = 'STOREHEAL-6: a failed_store run whose lost answers are truly missing continues ONCE (never re-asking or re-paying them, the report says so); a second storage failure keeps it stopped';
    begin(SN); const check = mkCheck(SN);
    const panel = panelOf(200);
    const MON2 = { ai_prompts_max: 200 };
    // part 1 stores; part 2 fails its save entirely -> failed_store with lost_keys
    const p1 = await part({ monitors: MON2, prompts: panel }, { save: 'ok' });
    check('part 1 is not the last part (the run continues)', p1.h && p1.h.next && !p1.h.final, JSON.stringify({ final: p1.h && p1.h.final }));
    let stored = p1.table;
    const p2 = await part({ monitors: MON2, prompts: panel, cache: [p1.h.state_row], runAnswers: stored, trigger: p1.h.next }, { save: 'fail', reread: 'none', retry: 'fail' });
    check('part 2 stops failed_store with its lost keys', p2.st && p2.st.status === 'failed_store' && AIP.unpackKeys(p2.st.lost_keys).size === p2.paid.length && p2.paid.length > 0, JSON.stringify({ st: p2.st && p2.st.status }));
    const lost = new Set(p2.paid);
    // the next start (no continue_run) heals with the lost answers truly missing
    const p3 = await part({ monitors: MON2, prompts: panel, cache: [p2.h.state_row], runAnswers: stored }, { save: 'ok' });
    check('the next start continues the run once: store_heal names the missing answers', !p3.plan.nothing_to_do && p3.plan.chunk.store_heal && p3.plan.chunk.store_heal.missing === lost.size && p3.plan.chunk.store_heal.found === 0, JSON.stringify(p3.plan.reason || p3.plan.chunk.store_heal));
    check('the lost answers are never asked again (that would pay twice), nor anything parts 1 and 2 sent', p3.paid.every(k => !lost.has(k) && !p1.paid.includes(k)), p3.paid.filter(k => lost.has(k)).join(' '));
    check('they count as lost / could not be read and the report says so in plain words', p3.plan.chunk.lost_total === lost.size && /still missing/.test(p3.plan.chunk.unavailable_note || '') && /never asked again/.test(p3.plan.chunk.unavailable_note || ''), JSON.stringify({ lost: p3.plan.chunk.lost_total, note: p3.plan.chunk.unavailable_note }));
    check('the state records the one heal (store_heals 1) and a high ops alert says the run continued', p3.st && p3.st.store_heals === 1 && p3.alerts.some(a => /store_healed/.test(a.alert_key) && a.severity === 'high'), JSON.stringify({ heals: p3.st && p3.st.store_heals, alerts: p3.alerts.map(a => a.alert_key + ':' + a.severity) }));
    stored = stored.concat(p3.table);
    // a second storage failure in the same run: the part stops, and every later start stays blocked
    let p4 = p3;
    if (p3.h && p3.h.next) {
      p4 = await part({ monitors: MON2, prompts: panel, cache: [p3.h.state_row], runAnswers: stored, trigger: p3.h.next }, { save: 'fail', reread: 'none', retry: 'fail' });
      check('a second storage failure stops the run and its reason says it stays stopped for a person', p4.st && p4.st.status === 'failed_store' && /stays stopped/.test(p4.st.stop_reason) && /N8N_DATA_TABLES_MAX_SIZE_BYTES/.test(p4.st.stop_reason), JSON.stringify({ st: p4.st && p4.st.status, why: p4.st && p4.st.stop_reason }));
      const p5 = await part({ monitors: MON2, prompts: panel, cache: [p4.h.state_row], runAnswers: stored }, { save: 'ok' });
      check('the next start asks nothing and says why (a second storage failure in one run)', p5.plan.nothing_to_do && p5.paid.length === 0 && /second storage failure/.test(p5.plan.reason), p5.plan.reason || JSON.stringify(p5.plan.chunk));
      const all = [...p1.paid, ...p2.paid, ...p3.paid, ...p4.paid, ...p5.paid];
      check('no key was paid twice across the five starts', all.length === new Set(all).size, all.length + ' vs ' + new Set(all).size);
    } else check('the healed start had a next part to fail in', false, JSON.stringify({ final: p3.h && p3.h.final }));
  });

  // ===================================================================================================================================
  await guard('STOREHEAL-7 the wiring: the read-back and the retry sit between the save and the analyst', async () => {
    reset(); const SN = 'STOREHEAL-7: AI Visibility Tracker wiring - Save AI Answers -> AI Save Check -> Reread AI Answers (by site AND run) -> AI Save Retry Rows -> Retry Save AI Answers -> Analyst Jobs';
    begin(SN); const check = mkCheck(SN);
    const wfs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_AI_Visibility.json'), 'utf8'));   // the generated workflow (an import array)
    const wf = (Array.isArray(wfs) ? wfs : [wfs]).find(w => w && w.id === 'SEOagentAIVisib1');
    const out = (a) => ((wf.connections[a] || {}).main || []).flat().map(c => c.node);
    const reach = (a, b, seen = new Set()) => { if (a === b) return true; if (seen.has(a)) return false; seen.add(a); return out(a).some(n => reach(n, b, seen)); };
    check('Save AI Answers leads to AI Save Check and no longer straight to the analyst', out('Save AI Answers').join() === 'AI Save Check', out('Save AI Answers').join());
    check('a gap is read back, retried once and reaches the analyst; no gap goes straight to the analyst', reach('Any Save Gap?', 'Reread AI Answers') && out('Any Save Gap?').includes('Analyst Jobs') && reach('Reread AI Answers', 'Retry Save AI Answers') && out('Retry Save AI Answers').includes('Analyst Jobs') && out('Any Save Retry?').includes('Analyst Jobs'), JSON.stringify({ gap: out('Any Save Gap?'), retry: out('Any Save Retry?') }));
    const rr = wf.nodes.find(n => n.name === 'Reread AI Answers'); const conds = ((rr.parameters.filters || {}).conditions || []).map(c => c.keyName + ':' + c.condition).join();
    check('the read-back filters by site AND run (exact match) and never stops the part', rr && rr.parameters.operation === 'get' && conds === 'site_id:eq,run_id:eq' && rr.onError === 'continueRegularOutput' && rr.alwaysOutputData === true, conds);
    const rs = wf.nodes.find(n => n.name === 'Retry Save AI Answers');
    check('the retry is a plain insert into seo_ai_answers (no node-level retry: one more try only)', rs && rs.parameters.operation === 'insert' && rs.parameters.dataTableId.value === 'seo_ai_answers' && !rs.retryOnFail, JSON.stringify(rs && { op: rs.parameters.operation, retry: rs.retryOnFail }));
    check('no new paid node: the read-back path holds Data Table and Code nodes only', ['AI Save Check', 'Any Save Gap?', 'Reread AI Answers', 'AI Save Retry Rows', 'Any Save Retry?', 'Retry Save AI Answers'].every(nm => { const n = wf.nodes.find(x => x.name === nm); return n && /dataTable|code|\.if$/.test(n.type); }), '');
  });
};
