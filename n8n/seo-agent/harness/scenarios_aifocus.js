// AIFOCUS-1..8 (AI-FOCUS 2026-10-27, docs/ai-panel-focus-2026-10-27/RESEARCH_AND_DESIGN.md §7): the AI question panel follows the client's focus.
// Production facts: devaicon.com (Pakistan) typed "open edx provider" once at onboarding and then worked only on a keyword ladder about AI automation;
// its 10-question panel, written before the ladder existed, asked about Open edX in the UAE every week and every pulse morning. techand.ai (UAE, eight
// ladders) must barely move.
//   AIFOCUS-1  the labelled set (accuracy/ai_panel_focus.json): topic precision >= 95%, recall >= 90%, questions on focus >= 95%, 0 questions written
//              outside the website's market, 0 automatic changes to the owner's own or pinned questions; each case's own expectations
//   AIFOCUS-2  the 12-week timeline: a ladder starts (week 2), a page is published (week 4), the ladder is deleted (week 7), the country changes
//              (week 9); additions the week a ladder starts, retirements only on the month's full run, baselines reset at most once a month + once
//              per new ladder, the change on the questions asked both weeks available >= 90% of weeks, untouched topics keep their trend, nothing
//              asked twice, the panel never above its size
//   AIFOCUS-3  devaicon.com through the real nodes: AI Plan -> Prompt Jobs -> Prompt Writer (its answers) -> Prompt Rows -> AI Requests
//   AIFOCUS-4  the pulse scope 'focus' (Pulse Plan): only the questions of the topics the client works on and the pinned ones; 'all' as before
//   AIFOCUS-5  Site Admin: accept (proposed -> asked) and retire (kept with its history, never asked); the monitors row's pulse scope and focus mode
//   AIFOCUS-6  the money: the pulse scope prices like the app (golden cases), a swap inside the panel never moves the monthly quote, devaicon $4.72
//   AIFOCUS-7  the trend that survives a moving panel: the matched change and a topic's own overlap
//   AIFOCUS-8  the kit is the one inlined in every node that reads it, and follows the n8n sandbox rules
// Called from scenarios_v5.js just before the report (one appended line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const V5 = path.join(__dirname, '..', 'v5');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  // the kits as the engine inlines them (the fit gate's place helpers first, then AIF), from the source folder; AIFOCUS-8 holds the nodes to it
  const KIT = new Function(fs.readFileSync(path.join(V5, 'code', '_fit_gate.js'), 'utf8') + '\n' + fs.readFileSync(path.join(V5, 'code', '_ai_focus.js'), 'utf8') + '\nreturn { AIF, fitGate, FITR };')();
  const { AIF, fitGate, FITR } = KIT;
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const LAB = JSON.parse(fs.readFileSync(path.join(__dirname, 'accuracy', 'ai_panel_focus.json'), 'utf8'));
  const G6 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'g6_live.json.gz'))).toString('utf8')).weekly;
  const NOW = LAB.now;
  const day = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString();

  // ---- the stored panels the cases name ----
  const devaiconPanel = () => { const out = [{ prompt_id: 'dv_brand', site_id: 'site_devaicon-com', domain: 'devaicon.com', kind: 'brand', prompt: 'What is Devaicon (devaicon.com) and what does it offer?', source: 'auto', status: 'active', market: 'AE-en', created_at: '2026-10-25T09:00:00Z', stage: 'brand', cluster: 'brand' }];
    const Q = ['Which companies in the UAE are the best Open edX providers for a corporate academy?', 'How do I choose an Open edX hosting partner in Dubai?', 'How much does a managed Open edX platform cost in the UAE?',
      'Open edX or Moodle: which suits a university in Abu Dhabi better?', 'Which Open edX providers in Dubai offer Arabic course themes?', 'Who can migrate our courses to Open edX in the UAE?',
      'What should a training company in the UAE check before hiring an Open edX provider?', 'Which Open edX vendors in Dubai support single sign-on?', 'How long does an Open edX setup take for a UAE government training centre?'];
    Q.forEach((p, i) => out.push({ prompt_id: 'dv_' + i, site_id: 'site_devaicon-com', domain: 'devaicon.com', kind: ['recommend', 'choose', 'cost', 'compare', 'recommend', 'recommend', 'choose', 'recommend', 'problem'][i], prompt: p,
      keyword: 'open edx provider uae', cluster: 'open edx provider', topic: 'open edx provider', source: 'auto', status: 'active', market: 'AE-en', created_at: '2026-10-25T09:00:00Z', stage: 'decision' }));
    return out; };
  const dPanel = () => { const out = [{ prompt_id: 'd_b', kind: 'brand', prompt: 'What is Multi D and what does it offer?', source: 'auto', status: 'active', market: 'GB-en' }];
    const add = (lid, kw, n) => { for (let i = 0; i < n; i++) out.push({ prompt_id: lid + '_' + i, kind: 'recommend', prompt: 'Question ' + i + ' about ' + kw, keyword: kw, cluster: kw, source: 'auto', status: 'active', market: 'GB-en', created_at: day('2026-08-01T00:00:00Z', i), focus_source: 'ladder:' + lid, focus_seen_at: '2026-10-20T00:00:00Z' }); };
    add('lad_d1', 'accounting software uk', 4); add('lad_d2', 'payroll outsourcing london', 3); add('lad_d3', 'vat returns service', 2); return out; };
  const storedOf = (c) => c.stored === 'devaicon_open_edx' ? devaiconPanel() : c.stored === 'g6_live' ? (G6['Load AI Prompts'] || []).map(p => ({ ...p, created_at: p.created_at || '2026-09-01T00:00:00Z', focus_seen_at: '2026-10-20T00:00:00Z' })) : c.stored === 'synthetic_d' ? dPanel() : (c.stored || []);
  const laddersOf = (c) => c.ladders === 'g6_live' ? (G6['Load Ladders'] || []).filter(l => l.status !== 'set_aside') : c.ladders;
  const outFor = (c) => { const ctx0 = FITR.ctx({ own_domain: c.domain, competitors: c.competitors || [], heads: laddersOf(c).map(l => l.head_keyword), services: c.services });
    return (k) => { const g = fitGate(k, ctx0); return g.ok ? null : (g.detail || g.reason); }; };
  const evalCase = (c, over) => { const o = { ...c, ...(over || {}) };
    const focus = AIF.focusOf({ ladders: laddersOf(o), settings: o.settings, content_log: o.content_log, keywords: o.keywords, services: o.services, gsc: [], iso: o.iso, now: NOW, out: outFor(o) });
    const rec = AIF.reconcile({ stored: storedOf(o), focus, N: o.N, now: NOW, full: o.full, weeks: o.weeks, own_market: o.own_market, markets: o.markets || [], ladder_ids: [...new Set(laddersOf(o).map(l => l.ladder_id))] });
    return { focus, rec }; };

  {
    reset(); const SN = 'AIFOCUS-1 the labelled set: topics, questions on focus, market, the owner\'s questions (accuracy/ai_panel_focus.json)'; begin(SN); const check = mkCheck(SN);
    let tp = 0, produced = 0, expected = 0, wrongMarket = 0, ownerMoved = 0; const misses = [];
    for (const c of LAB.cases) {
      const { focus, rec } = evalCase(c);
      const got = focus.topics.filter(t => t.state !== 'out');
      const exp = c.expect.topics;
      produced += got.length; expected += exp.length;
      for (const e of exp) { const hit = got.find(t => t.state === e.state && (t.label === e.label || AIF.sameTopic(t.label, e.label))); if (hit) tp++; else misses.push(c.id + ': expected ' + e.state + ' "' + e.label + '"'); }
      for (const t of got) if (!exp.some(e => e.state === t.state && (t.label === e.label || AIF.sameTopic(t.label, e.label)))) misses.push(c.id + ': produced ' + t.state + ' "' + t.label + '"');
      // what the run writes: in the website's own market (the writer jobs carry it; nothing else is written), never the owner's questions
      const stored = storedOf(c); const owner = new Set(stored.filter(p => AIF.ownerQ(p)).map(p => p.prompt_id));
      ownerMoved += rec.retire.filter(r => owner.has(r.prompt_id)).length + rec.updates.filter(u => owner.has(u.prompt_id) && u.focus_state === 'out').length * 0;
      const E = c.expect;
      if (E.retire != null) check(c.id + ': retires ' + E.retire + ' question(s)', rec.retire.length === E.retire, J(rec.retire.map(r => [r.prompt_id, r.reason])));
      if (E.retire_ids) check(c.id + ': retires exactly the deleted ladder\'s automatic questions', J(rec.retire.map(r => r.prompt_id).sort()) === J(E.retire_ids.slice().sort()), J(rec.retire));
      if (E.owner_off_focus) check(c.id + ': the pinned question on the deleted topic is kept and named for the owner', J(rec.owner_off_focus.map(x => x.prompt_id)) === J(E.owner_off_focus) && !rec.retire.some(r => E.owner_off_focus.includes(r.prompt_id)), J(rec.owner_off_focus));
      if (E.retire_not_full != null) { const nf = evalCase(c, { full: false }).rec; check(c.id + ': outside the month\'s full run the deleted ladder\'s questions wait (still asked)', nf.retire.length === E.retire_not_full, J(nf.retire)); }
      if (E.write_min != null) check(c.id + ': writes at least ' + E.write_min + ' question(s), first for "' + E.write_topic_first + '"', rec.write.reduce((t, w) => t + w.count, 0) >= E.write_min && rec.write[0] && rec.write[0].label === E.write_topic_first, J(rec.write.map(w => [w.label, w.count])));
      if (E.write_total != null) check(c.id + ': writes ' + E.write_total + ' question(s) over the services', rec.write.reduce((t, w) => t + w.count, 0) === E.write_total, J(rec.write.map(w => [w.label, w.count])));
      if (E.kept_all) check(c.id + ': keeps every stored question (no swap, no retirement)', rec.keep.length === stored.filter(p => p.kind !== 'brand' && (!p.status || p.status === 'active')).length && !rec.retire.length, J({ keep: rec.keep.length, retire: rec.retire }));
      if (E.not_measured != null) { const nm = Array.isArray(E.not_measured) ? E.not_measured : []; check(c.id + ': ' + (nm.length ? 'names the ladder the panel has no room for' : 'measures every topic'), J(rec.not_measured.map(x => x.label)) === J(nm), J(rec.not_measured)); }
      if (E.raise_to != null) check(c.id + ': proposes a panel of ' + E.raise_to + ' (a price for the owner, never applied by itself)', rec.raise_to === E.raise_to, rec.raise_to);
      if (E.write && !Array.isArray(E.write)) for (const [lab, n] of Object.entries(E.write)) check(c.id + ': writes ' + n + ' for the new ladder "' + lab + '" inside the panel', (rec.write.find(w => w.label === lab) || {}).count === n, J(rec.write));
      if (E.swap != null) check(c.id + ': makes room by retiring ' + E.swap + ' over-quota automatic question(s) (a swap, announced)', rec.retire.filter(r => r.swap).length === E.swap, J(rec.retire));
      if (E.out) check(c.id + ': the competitor keyword is out of focus with its reason', J(focus.out.map(o => o.label)) === J(E.out) && focus.out.every(o => o.reason), J(focus.out));
      if (c.country_change) { const cc = c.country_change; const r2 = evalCase(c, { iso: cc.iso, own_market: cc.own_market, markets: cc.markets }).rec;
        check(c.id + ': after the country changes, ' + cc.expect_market_drift + ' questions of the old market are named for the owner, none retired by itself', r2.market_drift.length === cc.expect_market_drift && r2.retire.length === cc.expect_retire, J({ drift: r2.market_drift.map(x => x.prompt_id), retire: r2.retire })); }
      // the writer jobs carry the website's own market (AIFOCUS-3 checks the job and the place rule on the real nodes)
      wrongMarket += rec.write.filter(w => !w.label).length;
    }
    const precision = produced ? tp / produced : 1, recall = expected ? tp / expected : 1;
    // the question-level labels
    let qok = 0; const qmiss = [];
    for (const q of LAB.questions) { const c = LAB.cases.find(x => x.id === q.case); const { focus } = evalCase(c); const z = AIF.topicOf({ prompt: q.prompt, keyword: q.keyword }, focus.topics);
      const on = !!(z && ['active', 'core', 'maintain', 'paused'].includes(z.state)); if (on === q.on_focus) qok++; else qmiss.push(q.case + ': "' + q.prompt + '" -> ' + (z ? z.state + ' ' + z.label : 'no topic')); }
    const qacc = qok / LAB.questions.length;
    console.log('   topic precision ' + (100 * precision).toFixed(1) + '%, recall ' + (100 * recall).toFixed(1) + '% (' + tp + ' of ' + produced + ' produced, ' + expected + ' expected); questions on focus ' + (100 * qacc).toFixed(1) + '% (' + qok + ' of ' + LAB.questions.length + ')');
    check('topic precision >= 95%', precision >= 0.95, (100 * precision).toFixed(1) + '% ' + J(misses));
    check('topic recall >= 90%', recall >= 0.9, (100 * recall).toFixed(1) + '% ' + J(misses));
    check('questions on focus >= 95% (labelled by a person)', qacc >= 0.95, (100 * qacc).toFixed(1) + '% ' + J(qmiss));
    check('0 questions written outside the website\'s market', wrongMarket === 0, wrongMarket);
    check('0 automatic changes to the owner\'s own or pinned questions', ownerMoved === 0, ownerMoved);
  }

  {
    reset(); const SN = 'AIFOCUS-2 the 12-week timeline: a ladder starts, a page goes live, the ladder is deleted, the country changes'; begin(SN); const check = mkCheck(SN);
    const N = 12, T0 = '2026-11-02T08:00:00Z';
    const site = { domain: 'acme-hr.ae', iso: 'AE', own: 'AE-en', services: ['Payroll software', 'HR consulting'] };
    let store0 = [{ prompt_id: 's_b', kind: 'brand', prompt: 'What is Acme HR and what does it offer?', source: 'auto', status: 'active', market: 'AE-en', created_at: '2026-08-01T00:00:00Z' }];
    for (let i = 0; i < 6; i++) store0.push({ prompt_id: 's_l1_' + i, kind: 'recommend', prompt: 'Payroll software question ' + i, keyword: 'payroll software uae', cluster: 'payroll software uae', source: 'auto', status: 'active', market: 'AE-en', created_at: '2026-08-01T00:00:00Z', focus_source: 'ladder:lad_s1', focus_seen_at: '2026-10-30T00:00:00Z' });
    for (let i = 0; i < 3; i++) store0.push({ prompt_id: 's_hr_' + i, kind: 'recommend', prompt: 'HR consulting question ' + i, keyword: 'hr consulting', cluster: 'hr consulting', source: 'auto', status: 'active', market: 'AE-en', created_at: '2026-08-01T00:00:00Z', focus_source: 'service', focus_seen_at: '2026-10-30T00:00:00Z' });
    let ladders = [{ ladder_id: 'lad_s1', head_keyword: 'payroll software uae', rung: 4, keyword: 'payroll software uae', start_date: '2026-08-01' }];
    let settings = [{ ladder_id: 'lad_s1', status: 'active', created_at: '2026-08-01T00:00:00Z' }];
    let log = [], iso = 'AE', own = 'AE-en'; let seq = 0;
    const weeks = []; const FULL = new Set([1, 5, 9]);
    const rate = (topic) => /payroll/.test(topic) ? 0.4 : /onboarding/.test(topic) ? 0.1 : /compliance/.test(topic) ? 0.25 : 0.3;
    const unitsOf = (ids, w) => { const out = []; for (const id of ids) { const p = store0.find(x => x.prompt_id === id); for (const e of ['chatgpt', 'perplexity', 'gemini', 'ai_mode']) { const h = (AIF.words(p.prompt + e + w).join('').length * 7 + id.length) % 100; out.push({ prompt_id: id, engine: e, named: h < 100 * rate(String(p.keyword || p.cluster)), answered: true }); } } return out; };
    let prevIds = null, prevUnits = null, prevCluster = null; let resets = 0, matchedOk = 0, matchedN = 0, coreBroken = 0, twice = 0, over = 0, offFullRetire = 0, ladderWeekAdds = 0, writes = 0, written = 0, drift9 = -1;
    for (let w = 1; w <= 12; w++) {
      const now = day(T0, 7 * (w - 1));
      if (w === 2) { ladders.push({ ladder_id: 'lad_s2', head_keyword: 'employee onboarding software', rung: 4, keyword: 'employee onboarding software', start_date: now.slice(0, 10) }); settings.push({ ladder_id: 'lad_s2', status: 'active', created_at: now }); }
      if (w === 4) log.push({ keyword: 'payroll compliance uae', status: 'published', published_at: now });
      if (w === 7) { ladders = ladders.filter(l => l.ladder_id !== 'lad_s2'); settings = settings.filter(s => s.ladder_id !== 'lad_s2'); }
      if (w === 9) { iso = 'SA'; own = 'SA-en'; }
      const focus = AIF.focusOf({ ladders, settings, content_log: log, keywords: [], services: site.services, gsc: [], iso, now });
      const rec = AIF.reconcile({ stored: store0, focus, N, now, full: FULL.has(w), weeks: 8 + w, own_market: own, markets: [], ladder_ids: ladders.map(l => l.ladder_id) });
      if (!FULL.has(w)) offFullRetire += rec.retire.filter(r => !r.swap && !rec.provisional).length;
      if (w === 2) ladderWeekAdds = (rec.write.find(x => /onboarding/.test(x.label)) || {}).count || 0;
      if (w === 9) drift9 = rec.market_drift.length;
      // apply: retire, stamp, write (the simulated writer writes exactly what each topic asks for, in the website's market)
      for (const r of rec.retire) { const p = store0.find(x => x.prompt_id === r.prompt_id); p.status = 'retired'; p.retired_at = now; p.retire_reason = r.reason; }
      for (const u of rec.updates) Object.assign(store0.find(x => x.prompt_id === u.prompt_id), { focus_topic: u.focus_topic, focus_source: u.focus_source, focus_state: u.focus_state, focus_seen_at: u.focus_seen_at });
      for (const x of rec.write) { writes += x.count; for (let i = 0; i < x.count; i++) { written++; store0.push({ prompt_id: 's_n' + (++seq), kind: 'recommend', prompt: x.label + ' question ' + seq, keyword: x.label, cluster: x.label, source: 'auto', status: 'active', market: own, created_at: now, focus_topic: x.label, focus_source: x.source, focus_state: x.state, focus_seen_at: now }); } }
      const asked = store0.filter(p => p.status === 'active' && p.kind !== 'brand').map(p => p.prompt_id);
      if (new Set(asked).size !== asked.length) twice++;
      if (store0.filter(p => p.status === 'active').length > N) over++;
      const units = unitsOf(asked, w);
      if (prevIds) { const A = new Set(asked); const c = prevIds.filter(id => A.has(id)).length; if (c / Math.max(A.size, prevIds.length) < 0.8) resets++;
        const m = AIF.matched(units, prevUnits); matchedN++; if (m.available) matchedOk++;
        const coreNow = asked.filter(id => /^s_hr_/.test(id)), coreBefore = prevCluster; if (!AIF.topicOverlap(coreNow, coreBefore).same) coreBroken++; }
      prevIds = asked; prevUnits = units; prevCluster = asked.filter(id => /^s_hr_/.test(id));
      weeks.push({ w, full: FULL.has(w), added: rec.write.map(x => x.label + ' x' + x.count), retired: rec.retire.map(r => r.prompt_id), asked: asked.length });
    }
    console.log('   ' + weeks.map(x => 'w' + x.w + (x.full ? '*' : '') + ' asked ' + x.asked + (x.added.length ? ' +' + x.added.join('+') : '') + (x.retired.length ? ' -' + x.retired.length : '')).join(' | '));
    check('the new ladder\'s questions are added the week it starts (week 2)', ladderWeekAdds >= 2, J(weeks[1]));
    check('retirements happen only on the month\'s full run (a swap for a new ladder aside)', offFullRetire === 0, J(weeks));
    check('the deleted ladder\'s questions retire at the next full run (week 9)', weeks[8].retired.some(id => store0.find(p => p.prompt_id === id && /deleted/.test(p.retire_reason || ''))), J(weeks[8]));
    check('baselines reset at most once a month + once per new ladder (<= 4 in 12 weeks)', resets <= 4, resets);
    check('the change on the questions asked both weeks is available in >= 90% of weeks', matchedOk / matchedN >= 0.9, matchedOk + ' of ' + matchedN);
    check('the untouched topic ("hr consulting") keeps its trend every week', coreBroken === 0, coreBroken);
    check('no question asked twice in one run, and the panel never above its size', twice === 0 && over === 0, J({ twice, over }));
    check('nothing written beyond what the topics asked for (nothing paid twice)', written === writes, J({ written, writes }));
    check('the country change names the old-market questions for the owner and retires none by itself', drift9 > 0 && weeks[8].retired.every(id => !/market/.test((store0.find(p => p.prompt_id === id) || {}).retire_reason || '')), drift9);
  }

  {
    reset(); const SN = 'AIFOCUS-3 devaicon.com through the real nodes: AI Plan -> Prompt Jobs -> Prompt Rows -> AI Requests'; begin(SN); const check = mkCheck(SN);
    const SITE = 'site_devaicon-com', DOM = 'devaicon.com';
    mock('Manual Run', [{ json: { domain: DOM } }]);
    mock('Load Sites', items([{ site_id: SITE, domain: DOM, country: 'Pakistan', location_code: 2586, language_code: 'en', keywords: 'open edx provider', status: 'active',
      declared_services: J(['AI workflow automation', 'AI agents', 'Custom software development']) }]));
    mock('Load Ladders', items([{ ladder_id: 'lad_dev1', domain: DOM, head_keyword: 'ai automation solutions gcc', rung: 4, keyword: 'ai automation solutions gcc', status: 'planned', start_date: '2026-10-26' },
      { ladder_id: 'lad_dev1', domain: DOM, head_keyword: 'ai automation solutions gcc', rung: 1, keyword: 'ai automation for small business', status: 'planned' }]));
    mock('Load Ladder Settings (AI)', items([{ ladder_id: 'lad_dev1', site_id: SITE, domain: DOM, status: 'active', chosen_by: 'client_typed', created_at: '2026-10-26T08:00:00Z' }]));
    mock('Load Content Log (AI)', items([{ site_id: SITE, domain: DOM, keyword: 'ai in industrial automation', status: 'published', published_at: '2026-10-26T12:00:00Z' }]));
    mock('Load Monitors', items([{ site_id: SITE, domain: DOM, ai_visibility: true, ai_prompts_max: 10, ai_engines: '' }]));
    mock('Load Profiles', items([])); mock('Load AI Prompts', items(devaiconPanel()));
    mock('Load AI Visibility', items([{ site_id: SITE, domain: DOM, run_id: 'ai_20261025_devaicon-com', checked_at: '2026-10-25T09:00:00Z', run_kind: 'full', prompts: 9, samples: 45, engines_json: '{}' }]));
    for (const n of ['Load AI Daily', 'Load Cache (AI)', 'Load Query History', 'Load AI Run Answers', 'Load Link Prospects', 'Load Pages (AI)', 'Load AI Targets (AI)', 'Load AI Imports', 'Load SERP Cache (AI)']) mock(n, items([]));
    for (const n of ['Site Text Jobs', 'Read Site (AI)', 'Discovery Requests', 'Run Discovery', 'Prompt Jobs', 'Prompt Writer', 'Prompt Rows']) delete store[n];
    const plan = (await run('AI Plan', [{ json: {} }]))[0].json;
    const F = plan.focus || {};
    check('the plan retires the 9 Open edX questions asked in the UAE (the panel has no trend yet), history kept', (F.retire || []).length === 9 && F.retire.every(r => /^dv_\d$/.test(r.prompt_id)), J(F.retire));
    check('the plan writes 7 questions for the ladder "ai automation solutions" (its page merged in) and 2 for a declared service', J((F.write || []).map(w => [w.label, w.count])) === J([['ai automation solutions', 7], ['ai agents', 2]]), J(F.write));
    check('the brand question is kept; the Open edX questions are not asked this run', plan.prompts.length === 1 && plan.prompts[0].kind === 'brand', J(plan.prompts.map(p => p.prompt_id)));
    check('the run is asked in Pakistan only (the UAE questions\' market is not added)', J(plan.markets) === J(['PK-en']), J(plan.markets));
    check('the topics handed to the writer and discovery are the focus, not the abandoned keyword', plan.topics[0] === 'ai automation solutions' && !plan.topics.includes('open edx provider'), J(plan.topics));
    check('the Needs-you inputs travel with the plan (watch topic, nothing the owner must decide)', (F.topics || []).some(t => t.label === 'open edx provider' && t.state === 'watch') && !(F.owner_off_focus || []).length, J(F.topics));
    const jobs = (await run('Prompt Jobs', [{ json: {} }])).map(i => i.json);
    check('the writer job carries the topics and how many each (7 + 2), in PK-en, with the place rule (Pakistan, its cities)', jobs.length === 1 && jobs[0].market === 'PK-en' && J(jobs[0].focus_topics.map(t => [t.label, t.count])) === J([['ai automation solutions', 7], ['ai agents', 2]]) && jobs[0].count === 9 && /Pakistan/.test(jobs[0].place_rule) && /Karachi/.test(jobs[0].place_rule), J(jobs.map(j => [j.focus_topics, j.market, j.count, j.place_rule])));
    // the writer's answer: distinct questions per topic (one of them names Dubai, which the market rule must refuse)
    const WR = { 'ai automation solutions': ['Which AI automation firms in Dubai serve manufacturers?', 'Which companies in Pakistan offer AI automation for mid-sized businesses?', 'How do I choose an AI automation partner in Pakistan?',
      'How much does an AI automation project cost in Pakistan?', 'Custom AI automation or ready-made tools: which suits a growing company?', 'Who are the best providers of AI for industrial automation in Pakistan?',
      'How can factories in Lahore use AI to cut machine downtime?', 'What does AI-based quality inspection on a production line cost?'],
      'ai agents': ['Which firms in Pakistan build AI agents that automate back-office work?', 'How should a company start using AI agents for customer support?', 'What do AI agents for sales teams cost to build?'] };
    const ans = jobs.map(j => ({ output: J({ prompts: j.focus_topics.flatMap(t => (WR[t.label] || []).slice(0, t.count + (t.label === 'ai automation solutions' ? 1 : 0)).map((q, i) => ({ prompt: q, kind: 'recommend', stage: 'decision', cluster: t.label, keyword: t.label + ' ' + i, origin: 'writer' }))) }) }));
    mock('Prompt Writer', ans.map(a => ({ json: a })));
    const rows = (await run('Prompt Rows', [{ json: {} }])).map(i => i.json).filter(r => !r.skip);
    const retired = rows.filter(r => r.status === 'retired'), fresh = rows.filter(r => r.status === 'active' && r.prompt_id.indexOf('q_') === 0), refused = rows.filter(r => r.status === 'refused');
    check('Prompt Rows stores the 9 retired questions with the date and the reason (not deleted)', retired.length === 9 && retired.every(r => r.retired_at && /UAE|AE-en|market/i.test(r.retire_reason)), J(retired.map(r => [r.prompt_id, r.retire_reason])));
    check('a written question naming Dubai is refused with the place named (the market rule on the writer\'s output)', refused.length === 1 && /Dubai/i.test(refused[0].fit_note) && /outside/.test(refused[0].fit_note), J(refused));
    check('the new questions carry their focus topic, PK-en, and the topic as their cluster', fresh.length >= 8 && fresh.every(r => r.market === 'PK-en' && r.focus_topic && r.cluster === String(r.focus_topic).toLowerCase() && r.focus_seen_at), J(fresh.map(r => [r.focus_topic, r.market, r.cluster])));
    check('no topic gets more than the reconcile asked for', fresh.filter(r => r.focus_topic === 'ai agents').length <= 2 && fresh.filter(r => r.focus_topic === 'ai automation solutions').length <= 7, J(fresh.map(r => r.focus_topic)));
    const table = (fs.existsSync(path.join(__dirname, 'table_cols.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'table_cols.json'), 'utf8')) : {})['seo_ai_prompts'];
    if (Array.isArray(table)) check('every Prompt Rows row is exactly table columns (the focus columns included)', rows.every(r => Object.keys(r).every(k => table.includes(k))), J(rows.map(r => Object.keys(r).filter(k => !table.includes(k))).filter(x => x.length)));
    try { const reqs = (await run('AI Requests', [{ json: {} }])).map(i => i.json).filter(r => r && r.prompt_id);
      check('AI Requests asks none of the retired questions and nothing in the UAE', reqs.length > 0 && !reqs.some(r => /^dv_\d$/.test(r.prompt_id)) && !reqs.some(r => Number(r.location_code) === 2784), J(reqs.slice(0, 4).map(r => [r.prompt_id, r.engine, r.location_code]))); }
    catch (e) { check('AI Requests runs on the plan', false, e.message); }
  }

  {
    reset(); const SN = 'AIFOCUS-4 the pulse scope: focus asks the topics the client works on and the pinned questions; all asks the panel'; begin(SN); const check = mkCheck(SN);
    const SITE = 'site_devaicon-com', DOM = 'devaicon.com';
    const P = [];
    for (let i = 0; i < 7; i++) P.push({ prompt_id: 'pf_a' + i, site_id: SITE, domain: DOM, kind: 'recommend', prompt: 'AI automation question ' + i, keyword: 'ai automation solutions', cluster: 'ai automation solutions', source: 'auto', status: 'active', market: 'PK-en', focus_state: 'active', focus_topic: 'ai automation solutions' });
    for (let i = 0; i < 2; i++) P.push({ prompt_id: 'pf_c' + i, site_id: SITE, domain: DOM, kind: 'recommend', prompt: 'AI agents question ' + i, keyword: 'ai agents', cluster: 'ai agents', source: 'auto', status: 'active', market: 'PK-en', focus_state: 'core', focus_topic: 'ai agents' });
    P.push({ prompt_id: 'pf_pin', site_id: SITE, domain: DOM, kind: 'custom', prompt: 'Which LMS do Pakistani universities use?', keyword: 'lms pakistan', source: 'custom', pinned: true, status: 'active', market: 'PK-en', focus_state: 'out' });
    P.push({ prompt_id: 'pf_ret', site_id: SITE, domain: DOM, kind: 'recommend', prompt: 'Retired question', keyword: 'open edx', source: 'auto', status: 'retired', market: 'AE-en' });
    const pulse = async (scope) => { reset(); mock('Manual Run', [{ json: { domain: DOM } }]);
      mock('Load Sites', items([{ site_id: SITE, domain: DOM, country: 'Pakistan', location_code: 2586, language_code: 'en', status: 'active' }]));
      mock('Load Monitors', items([{ site_id: SITE, domain: DOM, ai_visibility: true, ai_prompts_max: 10, ai_pulse: true, ai_pulse_scope: scope }]));
      mock('Load AI Prompts', items(P)); for (const n of ['Load Profiles', 'Load AI Visibility', 'Load AI Daily', 'Load Cache (AI)', 'Load Cycles', 'Load Ladders', 'Load Link Prospects']) mock(n, items([]));
      return (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' }))[0].json; };
    const f = await pulse('focus');
    check('scope focus: the 7 ladder questions and the pinned one, every morning', J(f.prompts.map(p => p.prompt_id).sort()) === J([...P.filter(p => p.focus_state === 'active').map(p => p.prompt_id), 'pf_pin'].sort()), J(f.prompts.map(p => p.prompt_id)));
    check('scope focus: the morning says what it left to the weekly check, and is priced on what it asks', f.sample.scope === 'focus' && f.sample.scope_left_out === 2 && /weekly check/.test(f.sample.note) && Math.abs(f.est_dfs_usd - 8 * 0.012) < 1e-9, J({ s: f.sample, est: f.est_dfs_usd }));
    const a = await pulse('');
    check('a stored site with no scope asks the whole panel as before (never the retired one)', a.prompts.length === 10 && !a.prompts.some(p => p.prompt_id === 'pf_ret') && a.sample.scope === 'all', J(a.prompts.map(p => p.prompt_id)));
  }

  {
    reset(); const SN = 'AIFOCUS-5 Site Admin: accept and retire questions; the monitors row keeps the pulse scope and the focus mode'; begin(SN); const check = mkCheck(SN);
    const v = await run('Admin Validate', { body: { action: 'ai_prompts', domain: 'devaicon.com', accept: ['q_new1'], retire: ['dv_1'] } });
    check('the Admin API accepts accept / retire', v[0].json.ok === true, J(v[0].json));
    const vBad = await run('Admin Validate', { body: { action: 'ai_prompts', domain: 'devaicon.com' } });
    check('...and names them when nothing is given', !vBad[0].json.ok && /accept or retire/.test(vBad[0].json.error), vBad[0].json.error);
    const act = (await run('Admin Action', { body: v[0].json.forward }))[0].json;
    check('Admin Action carries the two lists', J(act.accept_prompts) === J(['q_new1']) && J(act.retire_prompts) === J(['dv_1']), J({ a: act.accept_prompts, r: act.retire_prompts }));
    mock('Load AI Prompts (Admin)', items([{ prompt_id: 'q_new1', site_id: 'site_devaicon-com', prompt: 'Which AI automation firms in Pakistan serve banks?', status: 'proposed', source: 'auto', kind: 'recommend', focus_topic: 'ai automation solutions', focus_source: 'ladder:lad_dev1', focus_state: 'active' },
      { prompt_id: 'dv_1', site_id: 'site_devaicon-com', prompt: 'How do I choose an Open edX hosting partner in Dubai?', status: 'active', source: 'auto', kind: 'choose', market: 'AE-en' }]));
    const rows = (await run('AI Prompt Rows (Admin)', [{ json: {} }])).map(i => i.json);
    const acc = rows.find(r => r.prompt_id === 'q_new1'), ret = rows.find(r => r.prompt_id === 'dv_1');
    check('Accept: the proposed question is asked from now on, still the engine\'s, with its topic', acc && acc.status === 'active' && acc.source === 'auto' && acc.focus_topic === 'ai automation solutions', J(acc));
    check('Retire: kept with the date and "retired by you", never deleted', ret && ret.status === 'retired' && ret.retired_at && ret.retire_reason === 'retired by you', J(ret));
    reset();
    mock('Admin Action', [{ json: { action: 'monitors', site_id: 'site_x', domain: 'x.com', updated_at: NOW, monitors: { ai_pulse_scope: 'focus', ai_focus_mode: 'off' } } }]);
    mock('Load Monitors (Admin)', items([{ site_id: 'site_x', domain: 'x.com', ai_prompts_max: 12 }]));
    const m1 = (await run('Monitor Row (Admin)', [{ json: {} }]))[0].json;
    check('Site Admin monitors stores the pulse scope and the focus mode', m1.ai_pulse_scope === 'focus' && m1.ai_focus_mode === 'off', J({ s: m1.ai_pulse_scope, f: m1.ai_focus_mode }));
    mock('Admin Action', [{ json: { action: 'monitors', site_id: 'site_x', domain: 'x.com', updated_at: NOW, monitors: { ai_prompts_max: 14 } } }]);
    mock('Load Monitors (Admin)', items([{ site_id: 'site_x', domain: 'x.com', ai_prompts_max: 12, ai_pulse_scope: '' }]));
    const m2 = (await run('Monitor Row (Admin)', [{ json: {} }]))[0].json;
    check('a stored site that does not set them keeps the whole-panel pulse and the focus on', m2.ai_pulse_scope === '' && m2.ai_focus_mode === '', J({ s: m2.ai_pulse_scope, f: m2.ai_focus_mode }));
    mock('Normalize Input', [{ json: { domain: 'newsite.com', competitors: [], monitor_input: {} } }]); mock('Load Monitors (Track)', items([]));
    const t1 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('a NEW website starts with the pulse on its focus', t1.ai_pulse_scope === 'focus' && t1.ai_focus_mode === '', J({ s: t1.ai_pulse_scope }));
    mock('Load Monitors (Track)', items([{ site_id: 'site_newsite-com', domain: 'newsite.com', ai_prompts_max: 20 }]));
    const t2 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('a stored website keeps the whole-panel pulse after "Track my site"', t2.ai_pulse_scope === '', J({ s: t2.ai_pulse_scope }));
  }

  {
    reset(); const SN = 'AIFOCUS-6 the money: the pulse scope in the one cost formula; a swap never moves the quote; devaicon.com $4.72 against $5.35'; begin(SN); const check = mkCheck(SN);
    const AIP = kitOf('AI_Requests.js', 'AIP');
    const GC = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_panel_cost_cases.json'), 'utf8'));
    const pick = (c) => ({ panel: c.panel, asked: c.asked, per_week: c.per_week, pulse_questions_day: c.pulse_questions_day, executions: c.executions, analyst_jobs: c.analyst_jobs, requests: c.requests, run: c.run, full_extra: c.full_extra, pulse_day: c.pulse_day, month: c.month, half_width: c.half_width });
    const bad = (GC.cases_scope || []).filter(cs => J(pick(AIP.cost(cs.input))) !== J(cs.expect));
    check('AIP.cost gives every pulse-scope golden case (the app is held to the same table)', (GC.cases_scope || []).length >= 6 && !bad.length, J(bad.map(b => b.input)));
    check('a case without pulse_questions is the old figure, unchanged', J(pick(AIP.cost({ panel: 10 }))) === J(pick(AIP.cost({ panel: 10, pulse_questions: null }))));
    check('devaicon.com: 10 questions with the pulse on its 7 ladder questions = $4.72 a month (283 credits), today $5.35', AIP.cost({ panel: 10, pulse_questions: 7 }).month.total === 4.72 && AIP.cost({ panel: 10 }).month.total === 5.35);
    const before = AIP.cost({ panel: 10 }).month.total; const after = AIP.cost({ panel: 10 }).month.total;
    check('a swap inside the panel the client pays for never changes the monthly quote', before === after);
  }

  {
    reset(); const SN = 'AIFOCUS-7 a trend that survives a moving panel: the change on the questions asked both weeks, a topic\'s own overlap'; begin(SN); const check = mkCheck(SN);
    const mk = (ids, named) => ids.flatMap(id => ['chatgpt', 'gemini'].map(e => ({ prompt_id: id, engine: e, named: named(id, e), answered: true })));
    const prev = mk(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], (id) => id < 'c');
    const now = mk(['a', 'b', 'c', 'd', 'e', 'f', 'x', 'y', 'z'], (id) => id < 'e');
    const m = AIF.matched(now, prev);
    check('the change is computed on the 6 questions asked both weeks, with its counts', m.available && m.questions === 6 && m.n === 12 && m.n_before === 12 && m.k === 8 && m.k_before === 4, J(m));
    check('...and tested (two-proportion z, labelled with what it is)', m.z != null && /asked both weeks/.test(m.label), J(m));
    const few = AIF.matched(mk(['a', 'b'], () => true), mk(['a', 'b'], () => false));
    check('under 6 common questions it is not called a change, and says why', !few.available && few.delta === null && /fewer than 6/.test(few.label), J(few));
    check('a topic whose own questions overlap 80% keeps its trend; a rewritten one starts again', AIF.topicOverlap(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'f']).same === true && AIF.topicOverlap(['x', 'y'], ['a', 'b']).same === false);
    const src = fs.readFileSync(path.join(CD, 'AI_Metrics.js'), 'utf8');
    check('AI Metrics stores each topic\'s question ids and the panel events, and prints the matched change when the panel moved', /cluster_ids:/.test(src) && /AIF\.matched\(/.test(src) && /questions asked both weeks/.test(src) && /ownSame\(s\)/.test(src));
  }

  {
    reset(); const SN = 'AIFOCUS-8 one kit, inlined in every node that reads it, within the n8n sandbox rules'; begin(SN); const check = mkCheck(SN);
    const kit = fs.readFileSync(path.join(V5, 'code', '_ai_focus.js'), 'utf8').trim();
    for (const f of ['AI_Plan.js', 'Prompt_Jobs.js', 'Prompt_Rows.js', 'AI_Metrics.js', 'Pulse__AI_Plan.js']) {
      const s = fs.readFileSync(path.join(CD, f), 'utf8'); check(f + ' inlines the focus kit unchanged', s.indexOf(kit) >= 0); }
    check('the kit uses no URL constructor, no structured clone, no property definitions', !/new URL\(|structuredClone\(|Object\.defineProperty|Object\.defineProperties|Object\.setPrototypeOf/.test(kit));
    const app = path.join(__dirname, '..', '..', '..', 'app', 'shared', 'src', 'ai-focus.generated.js');
    if (fs.existsSync(app)) check('the app\'s generated module is the same kit', fs.readFileSync(app, 'utf8').indexOf(kit) >= 0);
  }
};
