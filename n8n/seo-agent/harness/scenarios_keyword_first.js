// Keyword-first autopilot (2026-10-19, agent E3; n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md §5.1, §5.5-§5.7, §9 KF, §14). On 2026-10-19 the
// Content Cadence wrote a page for a client (Techand) on a topic nobody chose: an AI refresh about Dynamics 365 for a CRM-only website that had
// chosen no keyword. Every scenario here runs the REAL generated nodes (harness/code_v4) and holds them to the rules that exist because of it:
//   KF1  the contract: Cadence Plan mirrors app/shared/src/cycles.ts (cycleNorm, AUTO_SOURCES, the default level, ChosenBy) as text and as behaviour;
//   KF2  the shared fixture harness/fixtures/cadence_levels.json, every case through Cadence Plan (the app's cadence.ts mirror runs the same file):
//        the Techand replay, each level's exact picks, pages_per_week 0, who chose the ladder, skips / approvals, R-K7, previews;
//   KF3  the invariants of every fixture run (no refused keyword written or suggested, bodies are content runs, the budget is respected);
//   KF4  preview: one cycle_preview callback, nothing started / logged / marked;
//   KF5  the content_cadence callback's new fields (level, waiting_for_keyword, cycle_key, suggestions in the CyclePreviewItem shape) and the notes;
//   KF6  AI Growth: a target whose own keyword fails the gate is stored set_aside with its reason (the Techand D365 target), never queued;
//   KF7  the Keyword Check's deterministic fit gate (own brand, other brand, AI-learned brand, government, navigational, off topic);
//   KF8  the ladder start: chosen_by and the start mode stored on the settings row; a Manual ladder writes nothing at start, and says so;
//   KF9  research from the app never writes a page on the system's own pick;
//   KF10 declared services: Normalize Input, Track my site (and a re-save keeps a paused site paused), the site model and its row.
//   KF11-KF16 (F-KW, 2026-10-20) the production-safety review of keyword-first: in topic is what the client chose (the Techand D365 refresh),
//        evidence before writing and sparse topics, exact-match domains, the preview at the due time, old plans re-checked, homepages, one budget
//        across the cycle, one content-log row per page, the chooser on the ladder rows, approvals per item, every script, plain words.
// Called from scenarios_v5.js just before the report (one appended line).
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
  const CONTRACT = JSON.parse(fs.readFileSync(path.join(__dirname, 'cycles_contract.json'), 'utf8'));
  const TC = require('./table_cols.json');
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));   // a Data Table load with alwaysOutputData: one empty item when nothing matched
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const ks = (arr) => (arr || []).map(x => ({ keyword: x.keyword, source: x.source }));
  const sortJ = (arr) => (arr || []).map(x => JSON.stringify(x)).sort();
  // the clock a case is planned at: `new Date()` and `Date.now()` inside the node read the fixture's `now` (restored after every run)
  const RealDate = Date;
  const frozen = async (iso, fn) => { const T = RealDate.parse(iso);
    class FrozenDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
    global.Date = FrozenDate; try { return await fn(); } finally { global.Date = RealDate; } };
  const cycleNormOf = new Function('s', 'return ' + CONTRACT.cycle_norm_body + ';');   // the contract's own function, evaluated as written in cycles.ts

  // the loads the Content Cadence makes, from one fixture case's tables
  const loadCadence = (c) => {
    const t = c.tables || {};
    mock('Manual Run', [{ json: c.trigger || {} }]);
    mock('Load Sites', items(t.sites)); mock('Load Cadence', items(t.cadence)); mock('Load Ladders', items(t.ladders)); mock('Load Query History', items(t.query_history));
    mock('Load Trends', items(t.trends)); mock('Load Content Log', items(t.content_log)); mock('Load Ladder Settings', items(t.ladder_settings)); mock('Load Main Keyword Ranks', items(t.ranks));
    mock('Load AI Targets (Cadence)', items(t.ai_targets)); mock('Load AI Targets Writing (Cadence)', items([])); mock('Load Monitors (Cadence)', items(t.monitors));
    mock('Load Pages (Cadence)', items(t.pages)); mock('Load AI Brands (Cadence)', items(t.ai_brands)); mock('Load Skips (Cadence)', items(t.skips)); mock('Load Cost (Cadence)', items(t.cost));
    mock('Load Cycle Jobs (Cadence)', items(t.cycle_jobs));   // F-KW: the content-cadence jobs of earlier cycles (R-K7)
    mock('Load Profiles (Cadence)', items(t.profiles));   // P1: the author profiles (an empty load = no profile on file)
  };
  const planCase = async (c) => { reset(); loadCadence(c);
    const out = await frozen(c.now, async () => (await run('Cadence Plan', [{ json: {} }])).map(i => i.json));
    const picks = out.filter(j => !j.nothing_to_do && !j.preview);
    const facts = out.find(j => j.preview) || out.find(j => j.site_id && !j.nothing_to_do) || out.find(j => j.report_only) || out[0] || {};
    return { out, picks, facts }; };

  // ===================================================================================
  // KF1 — the contract with app/shared/src/cycles.ts, as text and as behaviour
  // ===================================================================================
  await guard('KF1 keyword-first contract', async () => {
    reset(); const SN = 'KF1 keyword-first — Cadence Plan mirrors app/shared/src/cycles.ts: cycleNorm (the same regex), AUTO_SOURCES, the default level 2 and ChosenBy'; begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(CODE, 'Cadence_Plan.js'), 'utf8');
    check('cycleNorm: the node carries the contract\'s body character for character', src.includes('const cycleNorm = (s) => ' + CONTRACT.cycle_norm_body + ';'), CONTRACT.cycle_norm_body);
    // and where the repository is mounted, the TypeScript itself is read too (the container has no app/; the build compared it already)
    const tsPath = path.join(__dirname, '..', '..', '..', 'app', 'shared', 'src', 'cycles.ts');
    if (fs.existsSync(tsPath)) { const ts = fs.readFileSync(tsPath, 'utf8'); const m = ts.match(/export const cycleNorm = \(s: string\): string => (.+?);\n/);
      check('cycleNorm: cycles.ts itself (read from the repository) has the same body', !!m && m[1].trim() === CONTRACT.cycle_norm_body, m && m[1]); }
    else console.log('   (app/shared/src/cycles.ts is not mounted here: compared through harness/cycles_contract.json, which the build writes from it)');
    const am = src.match(/const AUTO_SOURCES = \{(.*?)\};/);
    const auto = {}; if (am) for (const [, k, v] of am[1].matchAll(/(\d):\s*\[([^\]]*)\]/g)) auto[k] = v.split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
    check('AUTO_SOURCES: the same sources at each level as cycles.ts', eq(auto, CONTRACT.auto_sources), JSON.stringify({ node: auto, contract: CONTRACT.auto_sources }));
    check('the default level is the contract\'s (2), and an empty or invalid level reads as it', src.includes('DEFAULT_LEVEL = ' + CONTRACT.default_level + ';') && /LEVELS\.includes\(n\) \? n : DEFAULT_LEVEL/.test(src), CONTRACT.default_level);
    check('ChosenBy: the client values the node treats as chosen are the contract\'s client_* values (plus empty = legacy / API)', src.includes("const CLIENT_CHOSEN = new Set(['', 'client_typed', 'client_picked']);") && eq(CONTRACT.chosen_by, ['client_picked', 'client_typed', 'system_announced']), JSON.stringify(CONTRACT.chosen_by));
    // behaviour: the contract's function and the node's item keys agree on awkward input
    const samples = ['CRM — Service, Provider!', '  e-Invoicing   in the UAE ', 'D365 F&O partner (UAE)', 'crm', ''];
    const c0 = FX.cases.find(c => c.name === 'level1_ladder_only');
    const r = await planCase({ ...c0, tables: { ...c0.tables, trends: [{ ...c0.tables.trends[0], rising: samples.filter(Boolean).map(x => x + ' (+50%)').join(', ') }], ai_targets: [], pages: [], query_history: [] } });
    const sug = (r.facts.suggestions || []).concat(r.facts.refused || []);
    check('item keys: every suggestion carries cycleNorm(keyword), exactly as the contract computes it', (r.facts.suggestions || []).length > 0 && (r.facts.suggestions || []).every(s => s.item_key === cycleNormOf(s.keyword)), JSON.stringify(sug.map(s => [s.keyword, s.item_key])));
    check('cycleNorm itself: "CRM — Service, Provider!" -> "crm service provider", empty -> ""', cycleNormOf('CRM — Service, Provider!') === 'crm service provider' && cycleNormOf('') === '' && cycleNormOf('D365 F&O partner (UAE)') === 'd365 f o partner uae', cycleNormOf('D365 F&O partner (UAE)'));
  });

  // ===================================================================================
  // KF2 / KF3 — every case of the shared fixture through the real Cadence Plan, and the invariants of every run
  // ===================================================================================
  await guard('KF2 keyword-first shared fixture', async () => {
    reset(); const SN = 'KF2 keyword-first — harness/fixtures/cadence_levels.json through the real Cadence Plan (the Techand replay, each level\'s picks, pages 0, who chose the ladder, skips / approvals, R-K7, previews)'; begin(SN); const check = mkCheck(SN);
    check('the fixture documents itself and names its contract', /cadence\.ts/.test(FX._doc) && FX.contract === 'app/shared/src/cycles.ts' && FX.cases.length >= 20, FX.cases.length);
    for (const c of FX.cases) {
      const r = await planCase(c); const e = c.expect; const f = r.facts;
      console.log('   ' + c.name + ' -> picks', JSON.stringify(ks(r.picks)), '| suggestions', JSON.stringify(ks(f.suggestions)), '| waiting', !!f.waiting_for_keyword, '| refused', JSON.stringify((f.refused || []).map(x => x.keyword + ' (' + x.reason + ')')));
      check(c.name + ': picks', eq(ks(r.picks), e.picks), JSON.stringify(ks(r.picks)));
      check(c.name + ': suggestions', eq(ks(f.suggestions), e.suggestions), JSON.stringify(ks(f.suggestions)));
      check(c.name + ': waiting_for_keyword ' + !!e.waiting_for_keyword, !!f.waiting_for_keyword === !!e.waiting_for_keyword, JSON.stringify({ waiting: f.waiting_for_keyword, reason: f.reason }));
      check(c.name + ': refused (with their reasons)', eq(sortJ((f.refused || []).map(x => ({ keyword: x.keyword, reason: x.reason }))), sortJ(e.refused)), JSON.stringify(f.refused));
      if (f.level != null) check(c.name + ': the effective level is ' + c.level, f.level === c.level, f.level);
      if (e.items) check(c.name + ': the preview plan (items with auto)', eq((f.items || []).map(x => ({ keyword: x.keyword, source: x.source, auto: x.auto })), e.items), JSON.stringify(f.items));
      if (e.awaiting) check(c.name + ': waiting for approval', eq((f.awaiting_approval || []).map(x => x.keyword), e.awaiting), JSON.stringify(f.awaiting_approval));
      if (e.skipped) check(c.name + ': skipped by the client', eq((f.skipped || []).map(x => x.item_key).sort(), [...e.skipped].sort()), JSON.stringify(f.skipped));
      if (e.approved_not_written) check(c.name + ': approvals not written, with their reasons', eq((f.approved_not_written || []).map(x => ({ keyword: x.keyword, reason: x.reason })), e.approved_not_written), JSON.stringify(f.approved_not_written));
      if (e.budget_spent != null) check(c.name + ': R-K7 pages already spent in the cycle = ' + e.budget_spent, (f.budget || {}).spent === e.budget_spent, JSON.stringify(f.budget));
      // P1: what was held for the author profile and the business facts, and which parts are missing
      if (e.held) check(c.name + ': held for the author profile and business facts', eq(ks(f.held_for_profile), e.held) && (f.held_for_profile || []).every(h => h.held === 'profile' && /waiting for your author profile and business facts/.test(h.why)), JSON.stringify(f.held_for_profile));
      if (e.waiting_for_profile != null) check(c.name + ': waiting_for_profile ' + e.waiting_for_profile, !!f.waiting_for_profile === e.waiting_for_profile, JSON.stringify(f.readiness));
      if (e.missing) check(c.name + ': the missing parts, in order', eq(((f.readiness || {}).missing || []).map(m => m.key), e.missing), JSON.stringify(f.readiness));
      if (e.held && e.held.length && c.trigger && c.trigger.preview) check(c.name + ': the preview lists the held pages as items marked held, with the reason', e.held.every(h => (f.items || []).some(x => x.keyword === h.keyword && x.held === 'profile')) && /waiting for your author profile and business facts/.test(f.reason), JSON.stringify({ items: f.items, reason: f.reason }));
      if (e.held && e.held.length && !(c.trigger && c.trigger.preview)) check(c.name + ': nothing is started, and the status says what to add', !r.picks.length && r.out.some(j => j.report_only && /waiting for your author profile and business facts/.test(j.reason)), JSON.stringify(r.out.map(j => j.reason)));
      // ---- KF3: the invariants every run must hold, whatever the case ----
      const refusedK = new Set((f.refused || []).map(x => cycleNormOf(x.keyword)));
      const pages = Number((((c.tables.cadence || [])[0]) || {}).pages_per_week) || 0;
      check(c.name + ': no refused keyword is written or suggested (R-K4)', ![...r.picks, ...(f.suggestions || [])].some(p => refusedK.has(cycleNormOf(p.keyword))), JSON.stringify([...refusedK]));
      check(c.name + ': P1, every pick carries the website\'s business facts, sent after an empty `business`', r.picks.every(p => p.body.business === '' && Object.keys(p.body).indexOf('business') < Object.keys(p.body).indexOf('business_facts') && p.body.business_facts === String(((c.tables.sites || [])[0] || {}).business_facts || '')), JSON.stringify(r.picks.map(p => [p.body.business, (p.body.business_facts || '').slice(0, 20)])));
      check(c.name + ': every pick is a content run with the planned keyword, a unique request id and an item key', r.picks.every(p => p.body && p.body.mode === 'keyword' && p.body.force_content === true && p.body.keyword === p.keyword && p.item_key === cycleNormOf(p.keyword))
        && new Set(r.picks.map(p => p.request_id)).size === r.picks.length, JSON.stringify(r.picks.map(p => p.request_id)));
      check(c.name + ': pages_per_week bounds everything automatic (the AI page on top only at level 3, never with 0 a week)', r.picks.filter(p => !/^ai_/.test(p.source) || c.level !== 3).length <= pages && (pages > 0 || !r.picks.length), JSON.stringify({ pages, picks: ks(r.picks) }));
      check(c.name + ': every suggestion is a needs-OK item with its key, its price and its source', (f.suggestions || []).every(s => s.auto === false && s.item_key === cycleNormOf(s.keyword) && s.est_usd > 0 && s.source && 'ai_target' in s && 'ladder_id' in s && 'rung' in s), JSON.stringify(f.suggestions));
      if (c.trigger && c.trigger.trigger === 'cycle' && !c.trigger.preview) check(c.name + ': a cycle run is dated by its cycle (request ids, week, cycle_key)', r.picks.every(p => p.request_id.startsWith('cad_' + c.trigger.cycle_key.slice(-10).replace(/-/g, '') + '_')) && f.cycle_key === c.trigger.cycle_key, JSON.stringify(r.picks.map(p => p.request_id)));
      if (c.trigger && c.trigger.preview) check(c.name + ': a preview is ONE item, a dry run, and starts nothing', r.out.filter(j => j.preview).length === 1 && !r.picks.length && r.out.every(j => j.dry_run === true || j.nothing_to_do), JSON.stringify(r.out.map(j => [j.preview, j.dry_run, j.keyword])));
    }
  });

  // ===================================================================================
  // KF4 — preview: one cycle_preview callback, and nothing downstream writes anything
  // ===================================================================================
  await guard('KF4 keyword-first preview', async () => {
    reset(); const SN = 'KF4 keyword-first — the "Coming up" preview: one cycle_preview callback in the CyclePreview shape, the e-mail beside it, and nothing started, logged or marked'; begin(SN); const check = mkCheck(SN);
    const c = FX.cases.find(x => x.name === 'preview_level2'); const r = await planCase(c);
    mock('Cadence Plan', r.out.map(json => ({ json })));
    const pv = (await run('Cadence Preview', [{ json: {} }])).map(i => i.json);
    const b = (pv[0] || {}).callback_body || {};
    console.log('   preview ->', JSON.stringify({ n: pv.length, stage: (pv[0] || {}).stage, items: (b.items || []).length, suggestions: (b.suggestions || []).length, subject: (pv[0] || {}).subject }));
    check('one preview item per site, stage cycle_preview, status progress', pv.length === 1 && pv[0].stage === 'cycle_preview' && pv[0].status === 'progress' && pv[0].request_id.startsWith('prev_20261023_'), JSON.stringify(pv.map(p => [p.stage, p.request_id])));
    const SHAPE = ['site_id', 'domain', 'cycle_key', 'scheduled_for', 'level', 'pages_per_week', 'waiting_for_keyword', 'paused_reason', 'items', 'suggestions'];
    check('the callback body carries every CyclePreview field (cycles.ts)', SHAPE.every(k => k in b) && b.cycle_key === c.trigger.cycle_key && b.scheduled_for === c.trigger.scheduled_for && b.level === 2 && b.pages_per_week === 3 && b.waiting_for_keyword === false && b.trigger === 'cycle', JSON.stringify(Object.keys(b)));
    const ITEM = ['item_key', 'keyword', 'source', 'page_type', 'existing_page_url', 'ladder_id', 'rung', 'why', 'auto', 'est_usd', 'ai_target'];
    check('every item and suggestion carries every CyclePreviewItem field, with the engine\'s own price of a page', [...b.items, ...b.suggestions].every(x => ITEM.every(k => k in x) && x.est_usd === r.facts.est_page_usd && x.est_usd > 0), JSON.stringify(b.items[0]));
    check('the AI suggestion carries its AI target (question, kind, target id), so the app\'s "Write it" writes it as an AI answer page', b.suggestions.some(x => x.source === 'ai_answer' && x.ai_target && x.ai_target.question && x.ai_target.target_id === 'ait_techand-ai_crmq'), JSON.stringify(b.suggestions));
    check('the e-mail names what is written on its own and what waits for an OK, with prices, and says where its numbers come from', /Written on their own/.test(pv[0].html) && /Suggestions/.test(pv[0].html) && /Where these numbers come from/.test(pv[0].html) && Array.isArray(pv[0].lineage), pv[0].html.slice(0, 300));
    H.scanHtml('cycle preview e-mail', pv[0].html);
    // the price is the run guard's own estimate of a content run: the shipped default ($0.80 Claude + $0.04 DataForSEO) until the engine has
    // settled content runs, then the calibrated figure from seo_cache (CC.pick, v5/code/_cost_cal.js) - never a number typed into the cadence
    check('the price of a page is the shipped content-run estimate with no calibration on file ($0.84)', r.facts.est_page_usd === 0.84 && /content run/.test(r.facts.est_basis), JSON.stringify({ p: r.facts.est_page_usd, b: r.facts.est_basis }));
    const cal = await planCase({ ...c, tables: { ...c.tables, cost: [{ key: 'cost:ai:content', kind: 'cost', site_id: '', value: JSON.stringify({ mean: 1, max: 1, last: 1, n: 3, recent: [1, 1, 1] }), updated_at: '2026-10-20T00:00:00.000Z' }] } });
    check('with settled content runs on file the price follows the engine\'s calibration (1.00 x 1.25 headroom + $0.04 = $1.29), on every item', cal.facts.est_page_usd === 1.29 && cal.facts.items.every(x => x.est_usd === 1.29) && /calibrated/.test(cal.facts.est_basis), JSON.stringify({ p: cal.facts.est_page_usd, b: cal.facts.est_basis }));
    mock('Cadence Plan', r.out.map(json => ({ json })));   // the preview plan again (planCase reset the store)
    // nothing downstream writes: the content log, the ladder marks, the AI target marks and the weekly note all drop a preview item
    const lr = (await run('Log Rows', [{ json: {} }])).map(i => i.json);
    const lm = (await run('Ladder Marks', [{ json: {} }])).map(i => i.json);
    const am = (await run('AI Target Marks', [{ json: {} }])).map(i => i.json);
    const cn = (await run('Cadence Note', [{ json: {} }])).map(i => i.json);
    check('a preview writes no content-log row, marks no ladder row and no AI target, and is not a weekly note', lr.length === 0 && lm.length === 1 && lm[0].skip === true && am.length === 1 && am[0].skip === true && cn.length === 0, JSON.stringify({ lr, lm, am, cn: cn.length }));
    // a preview of a site with nothing to write still reports its status
    const w = await planCase(FX.cases.find(x => x.name === 'preview_waiting')); mock('Cadence Plan', w.out.map(json => ({ json })));
    const pw = (await run('Cadence Preview', [{ json: {} }])).map(i => i.json);
    check('a preview with nothing to write still sends its status (waiting for the first keyword)', pw.length === 1 && pw[0].callback_body.waiting_for_keyword === true && !pw[0].callback_body.items.length && /choose your first keyword/.test(pw[0].subject) && /Waiting for your first keyword/.test(pw[0].html), JSON.stringify(pw[0] && pw[0].callback_body));
    // and a paused website's preview says it is paused
    const base = FX.cases.find(x => x.name === 'preview_level2');
    const pp = await planCase({ ...base, tables: { ...base.tables, sites: [{ ...base.tables.sites[0], status: 'paused' }] } });
    check('a paused website: its preview says so (paused_reason site_paused), nothing planned', pp.out.length === 1 && pp.out[0].preview && pp.out[0].paused_reason === 'site_paused' && !pp.out[0].items.length, JSON.stringify(pp.out));
    const pc = await planCase({ ...FX.cases.find(x => x.name === 'approve_in_cycle'), tables: { ...FX.cases.find(x => x.name === 'approve_in_cycle').tables, sites: [{ ...base.tables.sites[0], status: 'paused' }] } });
    check('a paused website: its real cycle writes nothing and says why', pc.out.length === 1 && pc.out[0].nothing_to_do && pc.out[0].paused_reason === 'site_paused' && !pc.picks.length, JSON.stringify(pc.out));
  });

  // ===================================================================================
  // KF5 — the content_cadence callback's new fields, and the notes
  // ===================================================================================
  await guard('KF5 keyword-first callback', async () => {
    reset(); const SN = 'KF5 keyword-first — the content_cadence callback carries level, waiting_for_keyword, cycle_key and suggestions in the CyclePreviewItem shape; the notes say what waits and why'; begin(SN); const check = mkCheck(SN);
    const c = { ...FX.cases.find(x => x.name === 'level2_in_topic_refreshes'), trigger: { trigger: 'cycle', domain: 'techand.ai', site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-21', scheduled_for: '2026-10-21T09:00:00.000Z' } };
    const r = await planCase(c); mock('Cadence Plan', r.out.map(json => ({ json })));
    const note = (await run('Cadence Note', [{ json: {} }])).map(i => i.json)[0] || {};
    console.log('   note ->', JSON.stringify({ level: note.level, wfk: note.waiting_for_keyword, cycle: note.cycle_key, pages: (note.pages || []).length, suggestions: (note.suggestions || []).map(s => s.keyword) }));
    check('a cycle run with no request id of its own: the note keeps the first page\'s id', note.request_id === note.pages[0].request_id, note.request_id);
    const rc = await planCase({ ...c, trigger: { ...c.trigger, request_id: 'cyc_techand-ai_20261021_content_cadence' } }); mock('Cadence Plan', rc.out.map(json => ({ json })));
    const noteC = (await run('Cadence Note', [{ json: {} }])).map(i => i.json)[0] || {};
    check('the cycle run\'s own request id (cyc_...) is the note\'s, while each page keeps its own cad_ id', noteC.request_id === 'cyc_techand-ai_20261021_content_cadence' && noteC.pages.every(p => /^cad_20261021_/.test(p.request_id)), JSON.stringify({ n: noteC.request_id, p: (noteC.pages || []).map(p => p.request_id) }));
    const pr = await planCase({ ...FX.cases.find(x => x.name === 'preview_waiting'), trigger: { ...FX.cases.find(x => x.name === 'preview_waiting').trigger, request_id: 'cyc_techand-ai_20261023_preview' } });
    check('a preview and a status item carry the cycle run\'s request id', pr.out.length === 1 && pr.out[0].request_id === 'cyc_techand-ai_20261023_preview', JSON.stringify(pr.out.map(j => j.request_id)));
    check('the weekly note: level 2, not waiting, the cycle key and date, the budget', note.level === 2 && note.waiting_for_keyword === false && note.cycle_key === c.trigger.cycle_key && note.cycle_date === '2026-10-21' && note.trigger === 'cycle' && note.budget && note.budget.pages_per_week === 3, JSON.stringify(note).slice(0, 400));
    check('its pages carry their item key and say whether they were automatic or approved', note.pages.length === 3 && note.pages.every(p => p.item_key === cycleNormOf(p.keyword) && p.auto === true && p.approved === false && p.est_usd > 0), JSON.stringify(note.pages));
    check('its suggestions are CyclePreviewItems (source, AI target, price), so "Write it" can carry them', note.suggestions.length === 3 && note.suggestions.every(s => s.item_key && s.source && 'ai_target' in s && s.auto === false) && note.suggestions[0].ai_target && note.suggestions[0].ai_target.kind === 'answer', JSON.stringify(note.suggestions));
    check('the refusals travel too, with their reasons', (note.refused || []).length === 2 && note.refused.every(x => x.reason === 'off topic' && x.detail), JSON.stringify(note.refused));
    check('the note says the suggestions wait for an OK, with the price, and names what was not suggested', /Suggested pages<\/b> \(written only after your OK; the app shows what each one costs in credits\)/.test(note.html) && !/\$\d/.test(note.html) && /Not suggested/.test(note.html) && !/opportunity posts are set to Manual/.test(note.html), note.html.slice(0, 500));
    H.scanHtml('cadence note (keyword-first)', note.html);
    // the waiting status note
    const w = await planCase(FX.cases.find(x => x.name === 'techand_replay_defaults'));
    const st = (await run('Cadence Status', w.out.map(json => ({ json })))).map(i => i.json);
    console.log('   status ->', JSON.stringify(st.map(s => [s.subject, s.waiting_for_keyword, (s.refused || []).length])));
    check('the Techand replay: one status note, "choose the keyword you want to be found for", waiting, the D365 target named as not suggested', st.length === 1 && /choose the keyword you want to be found for/.test(st[0].subject) && st[0].waiting_for_keyword === true && st[0].level === 2
      && /Waiting for your first keyword/.test(st[0].html) && /Not suggested/.test(st[0].html) && /dynamics 365 finance operations partner uae/.test(st[0].html) && st[0].stage === 'content_cadence' && st[0].pages.length === 0, JSON.stringify(st[0]).slice(0, 500));
    H.scanHtml('cadence status (waiting for keyword)', st[0].html);
  });

  // ===================================================================================
  // KF6 — AI Growth: a target whose own keyword fails the gate is set aside with its reason
  // ===================================================================================
  await guard('KF6 keyword-first growth targets', async () => {
    reset(); const SN = 'KF6 keyword-first — AI Growth stores a question to win whose own keyword fails the fit gate as set_aside with its reason (the Techand D365 target on a CRM-only site), never queued'; begin(SN); const check = mkCheck(SN);
    const D = 'techand.ai', SITE = 'site_techand-ai', W = 'https://techand.ai';
    const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const SVC = JSON.stringify(['CRM implementation services', 'CRM consulting for sales teams', 'CRM data migration', 'Customer support desk setup', 'Sales pipeline automation', 'CRM training and adoption']);
    const gaps = [{ prompt_id: 'p_d', prompt: 'Which Dynamics 365 Finance and Operations partner should a UAE company choose?', kind: 'recommend', topic: 'dynamics 365 finance operations partner uae', competitors: ['example-partner.ae'], volume: 300, stage: 'decision', fanout: ['d365 partner uae'], cited_urls: [], engines: { chatgpt: 'absent' } },
      { prompt_id: 'p_c', prompt: 'Who are the best CRM consultants in the UAE?', kind: 'recommend', topic: 'best crm consultants uae', competitors: ['example-crm.ae'], volume: 200, stage: 'decision', fanout: ['crm consultants uae'], cited_urls: [], engines: { chatgpt: 'absent' } }];
    const visRow = { site_id: SITE, domain: D, run_id: 'ai_1', checked_at: ago(1), gaps_json: JSON.stringify(gaps), pages_json: '[]', competitors_json: '[]' };
    const qh = [{ site_id: SITE, domain: D, period_end: '2026-10-18', query: 'dynamics 365 finance operations partner uae', page: W + '/dynamics-365-finance-and-operations-uae/', impressions: 300, clicks: 3, position: 14 }];
    const growth = async (o = {}) => { reset();
      mock('Load Sites', [{ json: { site_id: SITE, domain: D, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', services_json: o.svc || SVC, declared_services: o.declared || '' } }]);
      mock('Load Ladders', [{ json: {} }]); mock('Load Monitors', [{ json: { site_id: SITE, domain: D, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]);
      mock('Load AI Visibility', [{ json: visRow }]); mock('Load AI Prompts', gaps.map(g => ({ json: { prompt_id: g.prompt_id, site_id: SITE, prompt: g.prompt, kind: g.kind, keyword: g.topic, status: 'active' } })));
      mock('Load Content Log', [{ json: {} }]); mock('Load Query History', qh.map(json => ({ json }))); mock('Load AI Pages', [{ json: {} }]);
      mock('Load AI Targets', o.targets || [{ json: {} }]); mock('Load AI Growth', [{ json: {} }]); mock('Load Link Prospects (Growth)', [{ json: {} }]); mock('Load AI Answers', [{ json: {} }]); mock('Load Cache (Growth)', [{ json: {} }]);
      return (await run('Growth Plan', [{ json: {} }]))[0].json; };
    const G = await growth();
    const tD = G.targets.find(t => t.prompt_id === 'p_d'), tC = G.targets.find(t => t.prompt_id === 'p_c');
    console.log('   targets ->', JSON.stringify(G.targets.map(t => [t.keyword, t.kind, t.status, t.reason.slice(0, 90)])));
    check('the D365 target (a refresh of the D365 page) is stored set_aside, with the gate\'s reason in its own words', tD && tD.status === 'set_aside' && tD.kind === 'refresh' && /not a search this website should target/.test(tD.reason) && /off topic/.test(tD.reason), JSON.stringify(tD));
    check('the CRM question is queued as before', tC && tC.status === 'queued', JSON.stringify(tC));
    check('the plan lists it (targets_set_aside) and the report line says so', G.targets_set_aside.length === 1 && G.targets_set_aside[0].keyword === tD.keyword && G.targets_set_aside[0].kept === false && /question\(s\) to win were set aside/.test(G.set_aside_note), JSON.stringify({ a: G.targets_set_aside, n: G.set_aside_note }));
    mock('Growth Metrics', [{ json: { target_rows: G.targets } }]); const rows = (await run('AI Target Rows', [{ json: G }])).map(r => r.json);
    check('the stored row: exactly the seo_ai_targets columns, status set_aside', rows.some(r => r.target_id === tD.target_id && r.status === 'set_aside') && rows.every(r => Object.keys(r).length === TC.AI_TARGETS.length && Object.keys(r).every(k => TC.AI_TARGETS.includes(k))), JSON.stringify(rows.map(r => [r.target_id, r.status])));
    // a page already being written for it is live work: kept and flagged, never dropped
    const Gw = await growth({ targets: [{ json: { target_id: tD.target_id, site_id: SITE, domain: D, prompt_id: 'p_d', question: gaps[0].prompt, keyword: tD.keyword, kind: 'refresh', status: 'writing', request_id: 'cad_x', written_at: ago(2), created_at: ago(9) } }] });
    const tDw = Gw.targets.find(t => t.prompt_id === 'p_d');
    check('a target already being written keeps `writing` and is flagged (its page is live work)', tDw.status === 'writing' && /kept and flagged/.test(tDw.reason) && Gw.targets_set_aside[0].kept === true, JSON.stringify(tDw));
    // the client declared Dynamics 365 among its services: the same target is in topic and queued
    const Gd = await growth({ declared: JSON.stringify(['Dynamics 365 Finance and Operations partner']) });
    check('with Dynamics 365 among the client\'s declared services, the same target is queued (the gate reads declared_services through the site model)', Gd.targets.find(t => t.prompt_id === 'p_d').status === 'queued' && !Gd.targets_set_aside.length, JSON.stringify(Gd.targets.map(t => [t.keyword, t.status])));
  });

  // ===================================================================================
  // KF7 — the Keyword Check calls the deterministic fit gate it inlines
  // ===================================================================================
  await guard('KF7 keyword-first keyword check', async () => {
    reset(); const SN = 'KF7 keyword-first — the Keyword Check refuses deterministically (own brand, a declared competitor, a brand AI names, government, navigational, off topic): fit 0 with the reason and the alternatives, whatever the model said'; begin(SN); const check = mkCheck(SN);
    const D = 'techand.ai', SITE = 'site_techand-ai';
    const SVC = ['CRM implementation services', 'CRM consulting for sales teams', 'CRM data migration', 'Customer support desk setup', 'Sales pipeline automation', 'CRM training and adoption'];
    const AR = (o = {}) => ({ ok: true, keyword: 'crm implementation dubai', domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', volume: 320, kd: 30, cpc: 6.5, intent: 'commercial', known: true, position: null, position_url: null,
      reach_info: { reach: 35, method: 'size', p75: null, size_reach: 35, sample: 2, top10: 60, organic_keywords: 400, cached: true, cached_at: '2026-10-18T00:00:00.000Z' }, reach_errors: [], cache_row: null, dfs_cost: 0.0202,
      business: 'CRM partner', services: [], existing_keywords: [], business_source: 'request', ...o });
    const FIT = (o = {}) => [{ json: { output: { fit: 2, navigational: false, alternatives: 'crm implementation dubai, crm consultants uae', ...o } } }];
    const answer = async (ar, fit, o = {}) => { reset(); mock('Assess Result', [{ json: ar }]);
      mock('Load Site (Assess)', [{ json: { site_id: SITE, domain: D, services_json: JSON.stringify(o.services || SVC), declared_services: o.declared || '', competitors: o.siteComp || '' } }]);
      mock('Load Monitors (Assess)', [{ json: { site_id: SITE, domain: D, competitors: o.competitors || 'example-crm.ae' } }]);
      mock('Load Assess Cache', o.cache || [{ json: {} }]); mock('Load Ladders (Assess)', [{ json: {} }]); mock('Load Content Log (Assess)', [{ json: {} }]); mock('Load Pages (Assess)', [{ json: {} }]); mock('Load Ladder Settings (Assess)', [{ json: {} }]);
      return (await run('Assess Response', fit || FIT()))[0].json.body; };
    let b = await answer(AR());
    check('an on-topic keyword passes the gate: the model\'s fit (2) stands, fit_source model', b.fit === 2 && b.fit_gate.ok === true && b.fit_source === 'model' && !/not a fit/.test(b.label), JSON.stringify({ fit: b.fit, g: b.fit_gate, l: b.label }));
    b = await answer(AR({ keyword: 'example crm pricing uae' }));
    check('a declared competitor\'s brand: fit 0 from the gate (other brand) although the model said 2, with the alternatives', b.fit === 0 && b.fit_gate.reason === 'other brand' && b.fit_source === 'gate' && /not a fit: it names another company/.test(b.label) && b.alternatives.length > 0 && b.warnings.some(w => /not a fit for this website/.test(w)), JSON.stringify({ fit: b.fit, g: b.fit_gate, alt: b.alternatives, l: b.label }));
    b = await answer(AR({ keyword: 'zoho crm alternatives for sales teams' }), null, { cache: [{ json: { key: 'ai_brands:' + SITE, kind: 'ai', site_id: SITE, value: JSON.stringify({ 'Zoho CRM': 'zoho.com' }) } }] });
    check('a comparison with a brand AI names is a topic, not a refusal (the gate\'s own comparison rule)', b.fit_gate.ok === true, JSON.stringify(b.fit_gate));
    b = await answer(AR({ keyword: 'zoho crm pricing' }), null, { cache: [{ json: { key: 'ai_brands:' + SITE, kind: 'ai', site_id: SITE, value: JSON.stringify({ 'Zoho CRM': 'zoho.com' }) } }] });
    check('a brand the AI answers name for another company (seo_cache ai_brands): other brand', b.fit === 0 && b.fit_gate.reason === 'other brand' && /AI names for another company/.test(b.fit_gate.detail), JSON.stringify(b.fit_gate));
    b = await answer(AR({ keyword: 'techand crm' }));
    check('the website\'s own brand: own brand', b.fit === 0 && b.fit_gate.reason === 'own brand', JSON.stringify(b.fit_gate));
    b = await answer(AR({ keyword: 'emirates id status check' }));
    check('a government service: government', b.fit === 0 && b.fit_gate.reason === 'government', JSON.stringify(b.fit_gate));
    b = await answer(AR({ keyword: 'hubspot', intent: 'navigational' }), FIT({ fit: 2, navigational: false }));
    check('DataForSEO says navigational: refused as navigational, and the answer is navigational whatever the model said', b.fit === 0 && b.fit_gate.reason === 'navigational' && b.navigational === true && b.difficulty_for_you === 'not_realistic', JSON.stringify({ g: b.fit_gate, n: b.navigational, d: b.difficulty_for_you }));
    b = await answer(AR({ keyword: 'office coffee machines dubai' }));
    check('off topic against what the site sells (its services, declared ones included): fit 0, off topic', b.fit === 0 && b.fit_gate.reason === 'off topic', JSON.stringify(b.fit_gate));
    b = await answer(AR({ keyword: 'dynamics 365 finance operations partner uae' }), null, { declared: JSON.stringify(['Dynamics 365 Finance and Operations implementation']) });
    check('a service the client DECLARED makes its keyword a topic (declared_services reach the gate through the site model)', b.fit_gate.ok === true && b.fit === 2, JSON.stringify(b.fit_gate));
    b = await answer(AR({ keyword: 'example crm pricing uae' }), [{ json: { error: { message: 'Overloaded' } } }]);
    check('the model is down: the gate still decides a refusal (fit 0, known), with no alternatives to offer', b.fit === 0 && b.fit_known === true && b.fit_source === 'gate' && !b.alternatives.length && !b.warnings.some(w => /topic check unavailable/.test(w)), JSON.stringify({ fit: b.fit, k: b.fit_known, w: b.warnings }));
    b = await answer(AR(), [{ json: { error: { message: 'Overloaded' } } }]);
    check('the model is down and the gate passes: fit unknown, said in the label', b.fit === null && b.fit_known === false && b.fit_source === 'unknown' && /topic check unavailable/.test(b.label), JSON.stringify({ fit: b.fit, l: b.label }));
  });

  // ===================================================================================
  // KF8 — the ladder start: who chose it, the mode it starts in, and a Manual ladder that writes nothing
  // ===================================================================================
  await guard('KF8 keyword-first ladder start', async () => {
    reset(); const SN = 'KF8 keyword-first — a ladder start stores chosen_by and its start mode; a Manual ladder writes nothing at start and its texts say its pages wait for an OK'; begin(SN); const check = mkCheck(SN);
    const F = require('./fixtures'); const V = require('./fixtures_v5'); const EMPTY = [{ json: {} }];
    mock('Start Form', F.forms.startLadder);
    const nL = await run('Normalize Input', F.forms.pageLadder);
    mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
    mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
    const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
    mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
    mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
    await run('Merge Keyword Data', store['Site Authority']);
    mock('Verdict Agent', { output: { ...F.verdictGo, expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
    const pvL = await run('Parse Verdict', store['Verdict Agent']);
    mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
    const lrq = await run('Ladder Requests', EMPTY);
    mock('Run Ladder Research', V.ladderResearch(lrq.map(r => r.json)));
    const lpool = await run('Ladder Pool', store['Run Ladder Research']);
    const lch = await run('Ladder Relevance Chunks', lpool);
    mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
    const PV0 = pvL[0].json;
    const planWith = async (pv) => { mock('Parse Verdict', { ...PV0, ...pv }); mock('Load Site Cache', EMPTY); mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
      return (await run('Ladder Plan', store['Ladder Keyword Relevance']))[0].json; };
    const auto = await planWith({ chosen_by: 'client_picked', ladder_mode: 'auto' });
    check('an Auto ladder start writes its first page at once (pages_now 1)', auto.ladder.planned && auto.ladder.write_now.length === 1 && !auto.ladder.held && auto.ladder.limits.own_mode === 'auto' && auto.ladder.limits.chosen_by === 'client_picked', JSON.stringify({ w: auto.ladder.write_now.length, h: auto.ladder.held }));
    const man = await planWith({ chosen_by: 'client_typed', ladder_mode: 'manual', force_content: true });
    const L = man.ladder;
    console.log('   manual ->', JSON.stringify({ planned: L.planned, write_now: L.write_now.length, held: L.held && L.held.why.map(w => w.limit), text: L.limits.text.slice(0, 160) }));
    check('a Manual ladder start writes NOTHING (pages_now can no longer force a page), even with force_content', L.planned && L.write_now.length === 0 && L.held && L.held.pages.length === 1 && L.held.why[0].limit === 'manual' && L.limits.manual_hold === true, JSON.stringify({ w: L.write_now, h: L.held }));
    check('its texts say the pages wait for an OK (plan notes and the limits sentence)', /this ladder is Manual, so its pages wait for your OK/.test(L.limits.text) && /nothing is written until you approve a page/.test(L.limits.text) && L.notes.some(n => /wait for your OK/.test(n)), L.limits.text);
    mock('Attach PDF Ladder', [{ json: man }]);
    const rows = (await run('Ladder Rows', [{ json: man }])).map(r => r.json);
    check('no ladder row is marked writing', rows.length > 1 && rows.every(r => r.status === 'planned'), JSON.stringify(rows.map(r => r.status)));
    const spawn = await run('Spawn Page Runs', [{ json: man }]);
    check('no page run is spawned', spawn.length === 0, spawn.length);
    const repSrc = fs.readFileSync(path.join(CODE, 'Build_Ladder_Report.js'), 'utf8');
    check('the ladder report says a Manual ladder\'s pages wait for the client\'s OK, before (never instead of) the limits sentence', /\(L\.limits \|\| \{\}\)\.manual_hold === true \? 'none: this ladder is Manual, so each page waits for your OK/.test(repSrc), 'Build_Ladder_Report.js');
    // the settings row: chosen_by and the mode from the request, exactly the table's columns
    mock('Save Ladder Rows', rows.map(r => ({ json: { id: 7, createdAt: 'x', updatedAt: 'x', ...r } })));
    mock('Normalize Input', [{ json: { ...nL[0].json, chosen_by: 'client_typed', ladder_mode: 'manual' } }]);
    const sr = (await run('Ladder Settings Rows', store['Save Ladder Rows'])).map(r => r.json);
    const mine = sr.find(r => r.ladder_id === L.ladder_id) || {};
    check('the settings row stores chosen_by and the start mode from the request', mine.chosen_by === 'client_typed' && mine.mode === 'manual' && mine.autopilot_level === null, JSON.stringify(mine));
    const SET_COLS = ['ladder_id', 'site_id', 'domain', 'head_keyword', 'mode', 'priority', 'status', 'plan_type', 'reach', 'source', 'opportunities', 'auto_start', 'max_active', 'max_waiting', 'created_at', 'updated_at', 'chosen_by', 'autopilot_level', 'rechecked_at'];   // ladder_common.py LADDER_SETTINGS_COLS
    check('the settings row has exactly the seo_ladder_settings columns', sr.every(r => eq(Object.keys(r).sort(), [...SET_COLS].sort())), JSON.stringify(Object.keys(mine)));
    mock('Normalize Input', [{ json: { ...nL[0].json, chosen_by: '', ladder_mode: '' } }]);
    const sr2 = (await run('Ladder Settings Rows', store['Save Ladder Rows'])).map(r => r.json);
    check('a ladder started through the API with no chooser: client_typed (the caller is the client)', (sr2.find(r => r.ladder_id === L.ladder_id) || {}).chosen_by === 'client_typed', JSON.stringify(sr2));
    mock('Normalize Input', [{ json: { ...nL[0].json, chosen_by: 'system_announced' } }]);
    const sr3 = (await run('Ladder Settings Rows', store['Save Ladder Rows'])).map(r => r.json);
    check('an announced keyword (level 3): system_announced', (sr3.find(r => r.ladder_id === L.ladder_id) || {}).chosen_by === 'system_announced', JSON.stringify(sr3));
  });

  // ===================================================================================
  // KF9 — research from the app never writes a page on the system's own pick
  // ===================================================================================
  await guard('KF9 keyword-first research follow-up', async () => {
    reset(); const SN = 'KF9 keyword-first — research started from the web app never writes a page on its own top pick, even with "receive content" ticked; an API / form caller keeps today\'s behaviour'; begin(SN); const check = mkCheck(SN);
    const d = { country: 'United Arab Emirates', domain: 'techand.ai', business: 'CRM partner', email: '', callback_url: 'https://hooks.example.com/cb', request_id: 'r1', include_content: true, include_seo_report: true, include_audit: false,
      keyword_suggestions: { recommended: [{ keyword: 'crm implementation dubai', intent: 'commercial', why: 'best fit' }] } };
    mock('Normalize Input', [{ json: { client_ip: 'app:9b1c2d3e-aaaa' } }]);
    const a = (await run('Spawn Follow-ups', [{ json: d }])).map(r => r.json.body);
    check('from the app: the keyword report on the pick is delivered, the page is NOT written', a.length === 1 && a[0].mode === 'keyword' && a[0].receive.join() === 'Keyword Report', JSON.stringify(a));
    mock('Normalize Input', [{ json: { client_ip: 'app:9b1c2d3e-aaaa' } }]);
    const a2 = (await run('Spawn Follow-ups', [{ json: { ...d, include_seo_report: false } }])).map(r => r.json.body);
    check('from the app with only "receive content": nothing at all is started', a2.length === 0, JSON.stringify(a2));
    mock('Normalize Input', [{ json: { client_ip: '' } }]);
    const f = (await run('Spawn Follow-ups', [{ json: d }])).map(r => r.json.body);
    check('from the form / API: unchanged (report + page on the pick)', f.length === 1 && f[0].receive.includes('Page Content'), JSON.stringify(f));
  });

  // ===================================================================================
  // KF10 — declared services, Track my site and the site model
  // ===================================================================================
  await guard('KF10 keyword-first declared services', async () => {
    reset(); const SN = 'KF10 keyword-first — declared services: Normalize Input (services, timezone, chosen_by, ladder_mode), Track my site stores them and keeps a paused site paused, the site model merges them and writes the row back'; begin(SN); const check = mkCheck(SN);
    const body = { mode: 'track', domain: 'techand.ai', country: 'United Arab Emirates', callback_url: 'https://hooks.example.com/x', keywords: ['crm service provider'],
      services: ['CRM implementation', ' crm implementation ', 'CRM data migration', 'x'], timezone: 'Asia/Dubai', chosen_by: 'Client_Picked', ladder_mode: 'Manual' };
    const ni = (await run('Normalize Input', { body }))[0].json;
    check('Normalize Input: services cleaned and de-duplicated (case-insensitive, 2+ characters), services_given, the zone, the chooser and the start mode', eq(ni.services, ['CRM implementation', 'CRM data migration']) && ni.services_given === true && ni.timezone === 'Asia/Dubai' && ni.chosen_by === 'client_picked' && ni.ladder_mode === 'manual' && ni.mode === 'track', JSON.stringify({ s: ni.services, g: ni.services_given, tz: ni.timezone, c: ni.chosen_by, m: ni.ladder_mode }));
    const ni2 = (await run('Normalize Input', { body: { ...body, services: undefined, timezone: 'Mars/Olympus_Mons', chosen_by: 'system', ladder_mode: 'sometimes' } }))[0].json;
    check('Normalize Input: no services key = not given (a re-save leaves the stored list alone); an unknown zone, chooser or mode = empty', ni2.services_given === false && !ni2.services.length && ni2.timezone === '' && ni2.chosen_by === '' && ni2.ladder_mode === '', JSON.stringify({ g: ni2.services_given, tz: ni2.timezone, c: ni2.chosen_by, m: ni2.ladder_mode }));
    // Track my site: the row
    mock('Normalize Input', [{ json: ni }]); mock('Load Site (Track)', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', status: 'paused' } }]);
    const row = (await run('Site Row (Track)', [{ json: { id: 7, name: 'seo_sites', columns: [] } }]))[0].json;
    check('a re-save keeps a paused site paused (only Site Admin resumes it)', row.status === 'paused', row.status);
    check('the declared services are stored as a JSON list, and every field is a seo_sites column', JSON.parse(row.declared_services).join('|') === 'CRM implementation|CRM data migration' && Object.keys(row).every(k => TC.SITES.includes(k)), JSON.stringify(row));
    mock('Load Site (Track)', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', status: 'active' } }]);
    check('an active site stays active', (await run('Site Row (Track)', [{ json: {} }]))[0].json.status === 'active', 'status');
    delete store['Load Site (Track)'];
    check('a first save (no stored row) is active', (await run('Site Row (Track)', [{ json: {} }]))[0].json.status === 'active', 'status');
    mock('Normalize Input', [{ json: ni2 }]);
    check('a re-save without services leaves declared_services out of the row (the stored list is kept)', !('declared_services' in (await run('Site Row (Track)', [{ json: {} }]))[0].json), 'declared_services');
    // the site model
    const SVC = JSON.stringify(['ERP implementation']);
    const m = (await run('_site_model', [{ json: { site_row: { site_id: 'site_techand-ai', domain: 'techand.ai', services_json: SVC, declared_services: JSON.stringify(['CRM implementation', 'CRM data migration']) } } }]))[0].json;
    check('the model\'s services put the declared ones first and keep the read ones', eq(m.services.slice(0, 3), ['CRM implementation', 'CRM data migration', 'ERP implementation']) && eq(m.model.declared_services, ['CRM implementation', 'CRM data migration']), JSON.stringify(m.services));
    check('SM.toRow writes declared_services back unchanged, and only seo_sites columns', m.row.declared_services === JSON.stringify(['CRM implementation', 'CRM data migration']) && Object.keys(m.row).every(k => TC.SITES.includes(k)) && TC.SITES.includes('declared_services') && m.columns.includes('declared_services'), JSON.stringify(m.row));
    const back = (await run('_site_model', [{ json: { site_row: m.row } }]))[0].json;
    check('a round trip through the stored row keeps them (the weekly Site Tracker never overwrites them)', eq(back.model.declared_services, ['CRM implementation', 'CRM data migration']) && back.row.declared_services === m.row.declared_services, JSON.stringify(back.model.declared_services));
    const legacy = (await run('_site_model', [{ json: { site_row: { site_id: 'site_x', domain: 'x.example.org', declared_services: 'CRM implementation, CRM training' } } }]))[0].json;
    check('a comma-separated value is read too (and written back as JSON)', eq(legacy.model.declared_services, ['CRM implementation', 'CRM training']) && legacy.row.declared_services === JSON.stringify(['CRM implementation', 'CRM training']), JSON.stringify(legacy.row.declared_services));
  });

  // ===================================================================================
  // F-KW (2026-10-20): the production-safety review of keyword-first. Its replays (s1-s10) are fixture cases now (KF2 runs them all:
  // techand_real_services_*, paused_ladder_is_not_a_topic, level3_sparse_topics_new_topics_suggested, homepage_and_menu_pages_never_rewritten,
  // preview_judged_at_due_time*, preview_month_rollover, preview_without_cycle_trigger, rk7_mid_cycle_ladder_start, rk7_ladder_start_counted_once,
  // stale_ladder_*, arabic_*, approval_*, announced_ladder_settings_row_lost, level2_ai_refresh_crawl_only_is_suggestion). Every check below
  // fails on the code before the review's fixes.
  // ===================================================================================
  const caseOf = (n) => JSON.parse(JSON.stringify(FX.cases.find(c => c.name === n)));
  await guard('KF11 keyword-first safety: in topic is what the client chose', async () => {
    reset(); const SN = 'KF11 keyword-first safety (finding 1) — the Techand D365 refresh is never written at levels 1-2 once the client chose a CRM keyword, whatever the crawl says the site sells; level 3 may'; begin(SN); const check = mkCheck(SN);
    const D365 = 'dynamics 365 finance operations partner uae';
    for (const n of ['techand_real_services_level2', 'techand_real_services_level2_cycle', 'techand_real_services_level1', 'paused_ladder_is_not_a_topic']) {
      const r = await planCase(caseOf(n));
      check(n + ': the D365 refresh is not written, it is offered as a suggestion (the gate passes it: the site sells D365)', !r.picks.some(p => p.keyword === D365) && (r.facts.suggestions || []).some(s => s.keyword === D365 && s.auto === false) && !(r.facts.refused || []).length, JSON.stringify({ p: ks(r.picks), s: ks(r.facts.suggestions) }));
    }
    const pv = await planCase({ ...caseOf('techand_real_services_level2'), trigger: { trigger: 'cycle', domain: 'techand.ai', site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-23', scheduled_for: '2026-10-23T06:00:00.000Z', job: 'preview', preview: true } });
    check('its "Coming up" preview lists nothing automatic for it (only the suggestion)', !(pv.facts.items || []).some(x => x.keyword === D365) && (pv.facts.suggestions || []).some(s => s.keyword === D365), JSON.stringify(pv.facts.items));
    const l3 = await planCase(caseOf('techand_real_services_level3'));
    check('level 3 (full autopilot, the client\'s choice): in topic through the site\'s own services, written as the AI page (plan §5.5)', l3.picks.length === 1 && l3.picks[0].keyword === D365 && l3.picks[0].source === 'ai_refresh', JSON.stringify(ks(l3.picks)));
    const mig = await planCase(caseOf('level2_ai_refresh_crawl_only_is_suggestion')), mig2 = await planCase(caseOf('level2_ai_refresh_in_topic'));
    check('a service only the crawl lists never makes a level-2 page in topic; the same service DECLARED by the client does', !mig.picks.some(p => p.source === 'ai_refresh') && mig2.picks.some(p => p.source === 'ai_refresh'), JSON.stringify({ crawl: ks(mig.picks), declared: ks(mig2.picks) }));
    const src = fs.readFileSync(path.join(CODE, 'Cadence_Plan.js'), 'utf8');
    check('the source: level 1-2 evidence reads chosenTopics (ladders + declared), never `services`', /const chosenTopics = cleanT\(\[\.\.\.ladderTopics\(clientIds\), \.\.\.declared\]\);/.test(src) && /const evidenceTopics = level === 3 \? fullTopics : chosenTopics;/.test(src), 'Cadence_Plan.js');
  });

  await guard('KF12 keyword-first safety: evidence before writing, sparse topics, exact-match domains', async () => {
    reset(); const SN = 'KF12 keyword-first safety (findings 2 and 5) — a level-3 new topic needs positive evidence; sparse topics say "not enough information" (cadence, AI Growth, Keyword Check); an exact-match domain\'s own subject is not its brand'; begin(SN); const check = mkCheck(SN);
    const r = await planCase(caseOf('level3_sparse_topics_new_topics_suggested'));
    check('level 3 with two declared services: "chatgpt for sales emails" and "office coffee machines" are NOT written (suggestions)', !r.picks.length && ['chatgpt for sales emails', 'office coffee machines'].every(k => (r.facts.suggestions || []).some(s => s.keyword === k)), JSON.stringify({ p: ks(r.picks), s: ks(r.facts.suggestions) }));
    // the gate kit itself
    const G = new Function(fs.readFileSync(path.join(CODE, '_fit_gate.js'), 'utf8').replace(/return \$input\.all\(\)[\s\S]*$/, 'return { fitGate, fitStored, fitEvidence, fitTokens };'))();
    const ev = G.fitEvidence('office coffee machines', ['CRM implementation', 'CRM consulting']);
    check('fitEvidence: two services on file, a keyword with none of their words = unknown with a plain sentence (never "in")', ev.verdict === 'unknown' && /too little is on file about what this website sells/.test(ev.detail) && !/topic word/.test(ev.detail), JSON.stringify(ev));
    check('fitEvidence: the same list and "crm implementation dubai" = in; nothing on file = unknown', G.fitEvidence('crm implementation dubai', ['CRM implementation', 'CRM consulting']).verdict === 'in' && G.fitEvidence('crm implementation dubai', []).verdict === 'unknown', 'fitEvidence');
    const own = [['erp software uae', 'erp-software.ae', ['erp software uae']], ['erp software price uae', 'erp-software.ae', ['erp software uae']], ['crm experts dubai', 'crmexperts.ae', ['crm experts dubai']], ['accounting software uae', 'accountingsoftware.ae', []],
      ['vat consultants dubai', 'vatconsultants.ae', []], ['payroll outsourcing uae', 'payrolloutsourcing.ae', []], ['interior design dubai', 'interiordesign-dubai.com', []]];
    const res = own.map(([k, d, p]) => [k, d, G.fitGate(k, { own_domain: d, protect: p })]);
    check('an exact-match domain\'s own subject is not refused as its own brand (s3: erp-software.ae, crmexperts.ae, accountingsoftware.ae, vatconsultants.ae, payrolloutsourcing.ae, interiordesign-dubai.com)', res.every(([, , g]) => g.ok), JSON.stringify(res.filter(([, , g]) => !g.ok)));
    check('the stored rung of the same is kept (fitStored, the cadence read path)', G.fitStored({ keyword: 'erp software price uae', status: 'planned' }, { own_domain: 'erp-software.ae', protect: ['erp software uae'] }).ok === true, 'fitStored');
    const t1 = G.fitGate('techand crm', { own_domain: 'techand.ai', protect: ['CRM implementation'] }), t2 = G.fitGate('northwind reviews', { own_domain: 'northwind-erp.com', protect: ['erp software uae'] }),
      t3 = G.fitGate('facts erp pricing', { own_domain: 'facts.ae', protect: ['erp software uae'] });
    check('a distinctive label is still the site\'s own brand ("techand crm", "northwind reviews" on northwind-erp.com, "facts erp pricing" on facts.ae)', [t1, t2, t3].every(t => t.reason === 'own brand'), JSON.stringify({ t1, t2, t3 }));
    // AI Growth: a target with too little on file to judge is listed as such, with the sentence, and never called on topic
    const D = 'techand.ai', SITE = 'site_techand-ai';
    const gaps = [{ prompt_id: 'p_d', prompt: 'Which Dynamics 365 Finance and Operations partner should a UAE company choose?', kind: 'recommend', topic: 'dynamics 365 finance operations partner uae', competitors: ['example-partner.ae'], volume: 300, stage: 'decision', fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } },
      { prompt_id: 'p_c', prompt: 'Who are the best CRM consultants in the UAE?', kind: 'recommend', topic: 'best crm implementation consultants uae', competitors: ['example-crm.ae'], volume: 200, stage: 'decision', fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } }];
    reset();
    mock('Load Sites', [{ json: { site_id: SITE, domain: D, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', services_json: '[]', declared_services: JSON.stringify(['CRM implementation', 'CRM consulting']) } }]);
    mock('Load Ladders', [{ json: {} }]); mock('Load Monitors', [{ json: { site_id: SITE, domain: D, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: { site_id: SITE, domain: D, run_id: 'ai_1', checked_at: new Date(Date.now() - 864e5).toISOString(), gaps_json: JSON.stringify(gaps), pages_json: '[]', competitors_json: '[]' } }]);
    mock('Load AI Prompts', gaps.map(g => ({ json: { prompt_id: g.prompt_id, site_id: SITE, prompt: g.prompt, kind: g.kind, keyword: g.topic, status: 'active' } })));
    for (const n of ['Load Content Log', 'Load Query History', 'Load AI Pages', 'Load AI Targets', 'Load AI Growth', 'Load Link Prospects (Growth)', 'Load AI Answers', 'Load Cache (Growth)']) mock(n, [{ json: {} }]);
    const GP = (await run('Growth Plan', [{ json: {} }]))[0].json;
    const tD = GP.targets.find(t => t.prompt_id === 'p_d'), tC = GP.targets.find(t => t.prompt_id === 'p_c');
    check('AI Growth with two declared services: the D365 question says there is not enough information to judge it (listed in targets_unjudged), the CRM one does not', (GP.targets_unjudged || []).some(x => x.target_id === tD.target_id) && /Too little is known about what you sell to tell whether this question is part of it/.test(tD.reason) && !(GP.targets_unjudged || []).some(x => x.target_id === tC.target_id), JSON.stringify({ u: GP.targets_unjudged, d: tD && tD.reason }));
    // the Keyword Check
    const AR = (o) => ({ ok: true, keyword: 'crm implementation dubai', domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', volume: 320, kd: 30, cpc: 6.5, intent: 'commercial', known: true, position: null, position_url: null,
      reach_info: { reach: 35, method: 'size', p75: null, size_reach: 35, sample: 2, top10: 60, organic_keywords: 400, cached: true, cached_at: '2026-10-18T00:00:00.000Z' }, reach_errors: [], cache_row: null, dfs_cost: 0.0202, business: 'CRM partner', services: [], existing_keywords: [], business_source: 'request', ...o });
    const ask = async (ar, site) => { reset(); mock('Assess Result', [{ json: ar }]);
      mock('Load Site (Assess)', [{ json: { site_id: SITE, domain: ar.domain, services_json: '[]', declared_services: JSON.stringify(['CRM implementation']), ...(site || {}) } }]); mock('Load Monitors (Assess)', [{ json: {} }]);
      for (const n of ['Load Assess Cache', 'Load Ladders (Assess)', 'Load Content Log (Assess)', 'Load Pages (Assess)', 'Load Ladder Settings (Assess)']) mock(n, [{ json: {} }]);
      return (await run('Assess Response', [{ json: { output: { fit: 2, navigational: false, alternatives: '' } } }]))[0].json.body; };
    let b = await ask(AR({ keyword: 'office coffee machines dubai' }));
    check('Keyword Check, one declared service: an unrelated keyword is not called judged: topic_judged false, a warning that says so', b.fit_gate.ok === true && b.fit_gate.topic_judged === false && b.warnings.some(w => /^we could not tell whether this keyword matches what you sell: it does not clearly match the services you listed \(CRM implementation\)/.test(w)), JSON.stringify({ g: b.fit_gate, w: b.warnings }));
    b = await ask(AR({ keyword: 'crm implementation dubai' }));
    check('... and a keyword with evidence is judged (no such warning)', b.fit_gate.topic_judged === true && !b.warnings.some(w => /could not tell whether this keyword/.test(w)), JSON.stringify(b.fit_gate));
    b = await ask(AR({ keyword: 'erp software uae', domain: 'erp-software.ae', site_id: 'site_erp-software-ae' }), { site_id: 'site_erp-software-ae', domain: 'erp-software.ae', declared_services: JSON.stringify(['ERP software implementation']) });
    check('Keyword Check on an exact-match domain: "erp software uae" is not the site\'s own brand', b.fit_gate.ok === true && b.fit === 2, JSON.stringify(b.fit_gate));
  });

  await guard('KF13 keyword-first safety: Coming up shows the cycle; old plans; homepages', async () => {
    reset(); const SN = 'KF13 keyword-first safety (findings 3, 4) — the preview is judged at the cycle\'s due time; a ladder planned 60+ days ago waits for the app\'s fresh check; the homepage and the menu pages are never rewritten on their own'; begin(SN); const check = mkCheck(SN);
    const keys = (r) => [...r.picks.map(p => p.keyword)].sort();
    for (const [p, q] of [['preview_judged_at_due_time', 'preview_judged_at_due_time_real']]) {
      const a = await planCase(caseOf(p)), b = await planCase(caseOf(q));
      check(p + ': the preview lists exactly what the real cycle writes (the AI page included)', eq([...(a.facts.items || []).filter(x => x.auto).map(x => x.keyword)].sort(), keys(b)) && keys(b).includes('best crm consultants uae'), JSON.stringify({ preview: (a.facts.items || []).map(x => x.keyword), real: keys(b) }));
    }
    const m = await planCase(caseOf('preview_month_rollover'));
    check('a preview on Oct 30 for the cycle of Nov 1 counts November\'s AI allowance (the October page does not block it)', (m.facts.items || []).some(x => x.source === 'ai_answer') && m.facts.ai_pages && m.facts.ai_pages.used_this_month === 0, JSON.stringify(m.facts.ai_pages));
    const pw = await planCase(caseOf('preview_without_cycle_trigger'));
    check('preview: true without trigger cycle is a preview (one dry-run item, nothing started)', pw.out.length === 1 && pw.out[0].preview === true && pw.out[0].dry_run === true && !pw.picks.length, JSON.stringify(pw.out.map(j => [j.preview, j.dry_run, j.keyword])));
    const st = await planCase(caseOf('stale_ladder_waits_for_fresh_check'));
    const aw = (st.facts.awaiting_approval || [])[0] || {};
    check('a ladder planned 142 days ago becomes active and is NOT written: listed with "checking this keyword again before writing", recheck true, and in recheck_ladders', !st.picks.length && aw.recheck === true && /checking this keyword again before writing/.test(aw.why) && (st.facts.recheck_ladders || []).some(x => x.ladder_id === 'lad_b'), JSON.stringify({ aw, rl: st.facts.recheck_ladders }));
    const ok = await planCase(caseOf('stale_ladder_after_fresh_check'));
    check('after the app\'s check passed (rechecked_at) its first page is written', ok.picks.length === 1 && ok.picks[0].ladder_id === 'lad_b' && !(ok.facts.recheck_ladders || []).length, JSON.stringify(ks(ok.picks)));
    const old = caseOf('stale_ladder_after_fresh_check'); old.tables.ladder_settings[2].rechecked_at = '2026-05-01T00:00:00.000Z';
    const o2 = await planCase(old);
    check('a re-check older than the plan it checks does not count', !o2.picks.length && (o2.facts.recheck_ladders || []).length === 1, JSON.stringify(ks(o2.picks)));
    const h = await planCase(caseOf('homepage_and_menu_pages_never_rewritten'));
    check('the homepage and a main menu page are suggestions, never automatic, and say why', !h.picks.some(p => p.source !== 'ladder') && ['crm consultants in uae', 'crm implementation services uae'].every(k => (h.facts.suggestions || []).some(s => s.keyword === k && /homepage or a main menu page/.test(s.why))), JSON.stringify(h.facts.suggestions));
    const l3 = caseOf('homepage_and_menu_pages_never_rewritten'); l3.tables.ladder_settings = [{ ladder_id: '_site', site_id: 'site_techand-ai', domain: 'techand.ai', autopilot_level: 3 }];
    const h3 = await planCase(l3);
    check('... at level 3 as well', !h3.picks.some(p => p.existing_page_url && /^https:\/\/techand\.ai\/(services\/)?$/.test(p.existing_page_url)), JSON.stringify(ks(h3.picks)));
  });

  await guard('KF14 keyword-first safety: one budget, one row per page, who chose it, which item was approved', async () => {
    reset(); const SN = 'KF14 keyword-first safety (findings 6, 7, 9) — a mid-cycle ladder start counts once against the next cycle; two pages of one ladder start keep two content-log rows; the chooser survives a lost settings row; an approval is for one item'; begin(SN); const check = mkCheck(SN);
    const a = await planCase(caseOf('rk7_mid_cycle_ladder_start'));
    check('a Saturday ladder start counts against the next cycle (spent 1 of 1, named "ladder start")', a.facts.budget.spent === 1 && !a.picks.length && a.facts.budget.spent_keywords.some(x => x.how === 'ladder start'), JSON.stringify(a.facts.budget));
    const b = await planCase(caseOf('rk7_ladder_start_counted_once'));
    check('a start the previous cadence run already counted is not counted again', b.facts.budget.spent === 0 && b.picks.length === 1, JSON.stringify(b.facts.budget));
    const nj = caseOf('rk7_mid_cycle_ladder_start'); delete nj.tables.cycle_jobs;
    const c = await planCase(nj);
    check('with no job row the previous due time (7 days before) bounds the window: still counted', c.facts.budget.spent === 1, JSON.stringify(c.facts.budget));
    // finding 7: Content Log Row
    reset();
    mock('Normalize Input', [{ json: { domain: 'techand.ai', keyword: 'crm data migration checklist', request_id: 'app-ladder-1', client_ip: 'ladder:lad_crm', ladder_id: 'lad_crm', ladder_rung: 1, page_type: 'Guide' } }]);
    mock('Blog Package', [{ json: { article_html: '<p>x</p>', qa_not_ready: false } }]);
    mock('Load Content Log (Run)', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'crm implementation cost uae', source: 'ladder', request_id: 'app-ladder-1', status: 'written', started_at: '2026-10-21T09:40:00.000Z', rung: 1, ladder_id: 'lad_crm' } }]);
    const row = (await run('Content Log Row', [{ json: {} }]))[0].json;
    check('page 2 of a ladder start (same request id as page 1) keeps its own keyword, so the upsert by keyword writes its own row', row.keyword === 'crm data migration checklist' && row.request_id === 'app-ladder-1', JSON.stringify(row));
    // finding 9: the chooser
    const ls = await planCase(caseOf('announced_ladder_settings_row_lost'));
    check('an announced ladder whose settings row was lost is not the client\'s choice at level 2 (its rows say system_announced): nothing written, waiting', !ls.picks.length && ls.facts.waiting_for_keyword === true, JSON.stringify(ks(ls.picks)));
    reset();
    mock('Attach PDF Ladder', [{ json: { domain: 'techand.ai', pages_now: 1, ladder: { ladder_id: 'lad_new', domain: 'techand.ai', head: { keyword: 'crm service provider uae' }, rungs: [{ months: [1, 2], pages: [{ rung: 1, page_no: 1, keyword: 'crm implementation cost uae' }] }], top: { rung: 4, keyword: 'crm service provider uae' }, write_now: [] } } }]);
    mock('Normalize Input', [{ json: { chosen_by: 'system_announced' } }]);
    const lr = (await run('Ladder Rows', [{ json: {} }])).map(x => x.json);
    check('the ladder run writes chosen_by on every seo_ladders row, exactly the table\'s columns', lr.length === 2 && lr.every(x => x.chosen_by === 'system_announced') && lr.every(x => eq(Object.keys(x).sort(), [...TC.LADDER].sort())), JSON.stringify(lr[0]));
    mock('Normalize Input', [{ json: {} }]);
    check('... client_typed when the request names no chooser (an API caller is the client)', (await run('Ladder Rows', [{ json: {} }])).every(x => x.json.chosen_by === 'client_typed'), 'chosen_by');
    mock('Save Ladder Rows', lr.map(r => ({ json: { id: 1, ...r } })));
    mock('Load Domain Ladder Settings', [{ json: { ladder_id: 'lad_new', site_id: 'site_techand-ai', domain: 'techand.ai', priority: 3, status: 'active', mode: 'auto', chosen_by: 'client_typed', rechecked_at: '2026-10-20T00:00:00.000Z' } }]);
    mock('Load Domain Ladders', [{ json: { ladder_id: 'lad_ann', domain: 'techand.ai', keyword: 'x y', head_keyword: 'x y', rung: 4, start_date: '2026-10-01T00:00:00.000Z', chosen_by: 'system_announced' } },
      { json: { ladder_id: 'lad_leg', domain: 'techand.ai', keyword: 'p q', head_keyword: 'p q', rung: 4, start_date: '2026-09-01T00:00:00.000Z' } }]);
    const sr = (await run('Ladder Settings Rows', [{ json: {} }])).map(x => x.json);
    const by = (id) => sr.find(x => x.ladder_id === id) || {};
    check('a back-filled settings row takes the chooser its ladder\'s own rows carry (system_announced), a legacy ladder stays \'\'', by('lad_ann').chosen_by === 'system_announced' && by('lad_leg').chosen_by === '', JSON.stringify(sr.map(x => [x.ladder_id, x.chosen_by])));
    check('the ladder\'s own settings row keeps the app\'s rechecked_at', by('lad_new').rechecked_at === '2026-10-20T00:00:00.000Z' && sr.every(x => 'rechecked_at' in x), JSON.stringify(by('lad_new')));
    // approvals
    const am = await planCase(caseOf('approval_keyword_only_two_items')), as = await planCase(caseOf('approval_by_source'));
    check('a keyword-only approval that fits two different pages writes neither and says so (ambiguous)', !am.picks.some(p => p.approved) && (am.facts.approved_not_written || []).some(x => x.reason === 'ambiguous'), JSON.stringify(am.facts.approved_not_written));
    check('an approval naming its source writes exactly that item', as.picks.filter(p => p.approved).length === 1 && as.picks.find(p => p.approved).source === 'decay', JSON.stringify(ks(as.picks)));
  });

  await guard('KF15 keyword-first safety: every script', async () => {
    reset(); const SN = 'KF15 keyword-first safety (finding 8) — Arabic keywords: tokens, item keys and skips in every script, identically in the engine and cycles.ts'; begin(SN); const check = mkCheck(SN);
    const ar = 'أفضل برنامج محاسبة للشركات الصغيرة';
    check('cycleNorm (the contract\'s own text) keeps Arabic words, folds case and punctuation as before', cycleNormOf(ar + '!') === ar && cycleNormOf('CRM — Service, Provider!') === 'crm service provider' && cycleNormOf('ＣＲＭ Ｄｕｂａｉ') === 'crm dubai', JSON.stringify([cycleNormOf(ar), cycleNormOf('ＣＲＭ Ｄｕｂａｉ')]));
    const r = await planCase(caseOf('arabic_ladder_written'));
    check('an Arabic ladder is written, not set aside as empty, and each page carries its Arabic item key', r.picks.length === 2 && r.picks.every(p => p.item_key && p.item_key === cycleNormOf(p.keyword)) && !(r.facts.set_aside || []).length, JSON.stringify(r.picks.map(p => [p.keyword, p.item_key])));
    const m = await planCase(caseOf('arabic_manual_ladder_one_approval'));
    check('one approved Arabic page of a Manual ladder is written, the other waits', m.picks.length === 1 && m.picks[0].keyword === ar && (m.facts.awaiting_approval || []).length === 1, JSON.stringify(ks(m.picks)));
    const G = new Function(fs.readFileSync(path.join(CODE, '_fit_gate.js'), 'utf8').replace(/return \$input\.all\(\)[\s\S]*$/, 'return { fitTokens };'))();
    check('the gate tokenises Arabic and accented words', G.fitTokens('برنامج محاسبة').length === 2 && G.fitTokens('logiciel de comptabilité').includes('comptabilité'), JSON.stringify(G.fitTokens('برنامج محاسبة')));
  });

  await guard('KF16 keyword-first safety: customer-facing words', async () => {
    reset(); const SN = 'KF16 keyword-first safety (finding 10) — no em dash, arrow, ellipsis or curly quote in what the cadence, the gate and its e-mails say; no dollar figure in the e-mails; no false "planned before this rule existed"'; begin(SN); const check = mkCheck(SN);
    const BAD = /[—–→…“”‘’]/;
    const KEYS = new Set(['why', 'reason', 'detail', 'note', 'html', 'subject', 'label', 'text']);
    const hits = []; const scan = (where, v, k) => { if (typeof v === 'string') { if (KEYS.has(k) && BAD.test(v)) hits.push(where + '.' + k + ': ' + v.slice(Math.max(0, v.search(BAD) - 40), v.search(BAD) + 20)); return; }
      if (Array.isArray(v)) v.forEach(x => scan(where, x, k)); else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) scan(where, vv, kk); };
    const dollars = [];
    for (const c of FX.cases) {
      const r = await planCase(c); scan(c.name + ' Cadence Plan', r.out, '');
      mock('Cadence Plan', r.out.map(json => ({ json })));
      const mails = [...(await run('Cadence Note', [{ json: {} }])), ...(await run('Cadence Status', r.out.map(json => ({ json })))), ...(await run('Cadence Preview', [{ json: {} }]))].map(i => i.json);
      for (const m of mails) { scan(c.name + ' e-mail', { html: m.html, subject: m.subject }, ''); if (/\$\s?\d/.test(String(m.html || '') + String(m.subject || ''))) dollars.push(c.name + ': ' + String(m.html).match(/.{0,40}\$\s?\d.{0,10}/)[0]); }
      if (/planned before this rule existed/.test(JSON.stringify(r.out) + JSON.stringify(mails))) hits.push(c.name + ': "planned before this rule existed"');
    }
    check('no em dash, en dash, arrow, ellipsis or curly quote in any why / reason / detail / note / subject / e-mail of the fixture cases', !hits.length, hits.slice(0, 8).join(' | '));
    check('no dollar figure in a cadence e-mail (the app shows credits)', !dollars.length, dollars.slice(0, 4).join(' | '));
    const G = new Function(fs.readFileSync(path.join(CODE, '_fit_gate.js'), 'utf8').replace(/return \$input\.all\(\)[\s\S]*$/, 'return { fitGate, fitStored, FITR };'))();
    const words = [G.fitGate('zoho crm pricing uae', { own_domain: 'acme.ae', topics: ['CRM implementation services', 'CRM consulting for sales teams', 'CRM data migration', 'Customer support desk setup', 'Sales pipeline automation', 'CRM training and adoption'] }).detail,
      G.fitStored({ keyword: 'emirates id status check', status: 'planned' }, { own_domain: 'acme.ae' }).note, G.fitStored({ keyword: 'emirates id status check', status: 'written' }, { own_domain: 'acme.ae' }).note,
      G.FITR.line([{ keyword: 'fta portal', detail: 'a public body', dropped: true }], 'tracked')];
    check('the gate\'s own sentences are plain (off topic, set aside, kept and flagged, the read-path line)', words.every(w => w && !BAD.test(w) && !/planned before this rule existed/.test(w)), JSON.stringify(words));
  });
  // ===================================================================================
  // KF21-KF23 — P1 (2026-10-20, rehearsal §4 item 1): no page before the author profile and the business facts
  // ===================================================================================
  await guard('KF21 profile before the first page: the ladder start', async () => {
    reset(); const SN = 'KF21 profile before the first page — a ladder start without the author profile or the business facts keeps its plan and holds its page (nothing spawned, nothing charged, force_content does not override it); with both it writes, and the page run carries the facts'; begin(SN); const check = mkCheck(SN);
    const F = require('./fixtures'); const V = require('./fixtures_v5'); const EMPTY = [{ json: {} }];
    mock('Start Form', F.forms.startLadder);
    const nL = await run('Normalize Input', F.forms.pageLadder);
    mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
    mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
    const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
    mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
    mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
    await run('Merge Keyword Data', store['Site Authority']);
    mock('Verdict Agent', { output: { ...F.verdictGo, expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
    const pvL = await run('Parse Verdict', store['Verdict Agent']);
    mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
    const lrq = await run('Ladder Requests', EMPTY);
    mock('Run Ladder Research', V.ladderResearch(lrq.map(r => r.json)));
    const lpool = await run('Ladder Pool', store['Run Ladder Research']);
    const lch = await run('Ladder Relevance Chunks', lpool);
    mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
    const PV0 = pvL[0].json; const dom = String(PV0.domain || '').toLowerCase().replace(/^www\./, ''); const sid = 'site_' + dom.replace(/[^a-z0-9]+/g, '-');
    const FACTS = 'Founded in 2011; 30 consultants; certified partner; fixed-price implementation packages from 12 weeks; offices in two cities.';
    const AUTHOR = { site_id: sid, domain: dom, author_name: 'Omar Said', author_job_title: 'Practice lead', author_bio: 'Omar leads the practice and has delivered more than 50 projects for mid-sized companies.' };
    const planWith = async (pv, o) => { mock('Parse Verdict', { ...PV0, chosen_by: 'client_typed', ladder_mode: 'auto', ...pv }); mock('Load Site Cache', EMPTY); mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
      mock('Load Profile (Model)', o.profile ? [{ json: o.profile }] : EMPTY);
      mock('Site Model', [{ json: { site_model: { domain: dom, business_facts: o.modelFacts || '', cta: '' } } }]);
      return (await run('Ladder Plan', store['Ladder Keyword Relevance']))[0].json; };
    // the rehearsal client: no profile, no facts
    const none = await planWith({ business_facts: '', force_content: true }, {}); const L = none.ladder;
    console.log('   no profile, no facts ->', JSON.stringify({ planned: L.planned, write_now: L.write_now.length, held: L.held && L.held.why.map(w => w.limit), missing: L.limits.readiness.missing.map(m => m.key) }));
    check('the plan is made and stored, its page HELD for the profile (force_content does not override it)', L.planned && L.write_now.length === 0 && L.held && L.held.pages.length === 1 && L.held.why[0].limit === 'profile' && L.limits.profile_hold === true, JSON.stringify({ w: L.write_now, h: L.held }));
    check('every missing part is named, in customer words', eq(L.limits.readiness.missing.map(m => m.key), ['author_name', 'author_job_title', 'author_bio', 'business_facts']) && /waiting for your author profile and business facts/.test(L.limits.text) && /your author's name/.test(L.limits.text) && /nothing was charged for it/.test(L.limits.text), L.limits.text);
    check('the reason is plain words (no em dash, ellipsis or curly quote)', !/[—–…“”‘’]/.test(L.limits.text + JSON.stringify(L.held)), L.limits.text);
    mock('Attach PDF Ladder', [{ json: none }]);
    const rows = (await run('Ladder Rows', [{ json: none }])).map(r => r.json);
    check('every ladder row stays planned (the cadence writes it later; R-K7: it spends nothing now)', rows.length > 1 && rows.every(r => r.status === 'planned'), JSON.stringify(rows.map(r => r.status)));
    check('no page run is spawned, so nothing is charged for a page', (await run('Spawn Page Runs', [{ json: none }])).length === 0, 'spawned');
    // only the facts are missing
    const noFacts = (await planWith({ business_facts: 'We do CRM.' }, { profile: AUTHOR })).ladder;
    check('facts of a few words are not enough: held, missing business_facts only', noFacts.write_now.length === 0 && noFacts.held && noFacts.held.why[0].limit === 'profile' && eq(noFacts.limits.readiness.missing.map(m => m.key), ['business_facts']), JSON.stringify(noFacts.limits.readiness));
    // a Manual ladder without the profile: both reasons, Manual first
    const man = (await planWith({ business_facts: '', ladder_mode: 'manual' }, {})).ladder;
    check('a Manual ladder without the profile names both reasons (Manual first)', man.held && eq(man.held.why.map(w => w.limit).slice(0, 2), ['manual', 'profile']), JSON.stringify(man.held && man.held.why.map(w => w.limit)));
    // both on file: the page is written at once and its run carries the facts
    const ready = await planWith({ business_facts: FACTS }, { profile: AUTHOR });
    check('with the author profile and the facts, the first page is written at once', ready.ladder.write_now.length === 1 && !ready.ladder.held && ready.ladder.limits.readiness.ready === true, JSON.stringify({ w: ready.ladder.write_now.length, h: ready.ladder.held }));
    const sp = (await run('Spawn Page Runs', [{ json: ready }])).map(i => i.json.body);
    check('the page run carries the request\'s business facts', sp.length === 1 && sp[0].business_facts === FACTS, JSON.stringify(sp.map(b => b.business_facts)));
    // the request has no facts but the site model does (stored by Track my site or Site Admin facts): ready, and the run carries the stored facts
    const viaModel = await planWith({ business_facts: '' }, { profile: AUTHOR, modelFacts: FACTS });
    const sp2 = (await run('Spawn Page Runs', [{ json: viaModel }])).map(i => i.json.body);
    check('facts stored on the website count, and reach the page run when the request had none', viaModel.ladder.write_now.length === 1 && sp2.length === 1 && sp2[0].business_facts === FACTS, JSON.stringify({ w: viaModel.ladder.write_now.length, f: sp2.map(b => b.business_facts) }));
  });

  await guard('KF22 profile before the first page: the data path', async () => {
    reset(); const SN = 'KF22 profile before the first page — Track my site stores the business facts the app sends (only when the key is there), Site Admin takes action facts, and the readiness kit is the rule the app mirrors'; begin(SN); const check = mkCheck(SN);
    const FACTS = 'Founded in 2015; 25 CRM consultants; certified partner since 2017; fixed-price packages from 10 weeks.';
    const body = { mode: 'track', domain: 'techand.ai', country: 'United Arab Emirates', email: '', callback_url: 'https://hooks.example.com/x', business: '', customers: '', keywords: ['crm service provider'], business_facts: FACTS };
    const ni = (await run('Normalize Input', { body }))[0].json;
    check('Normalize Input: the facts and facts_given (the key was sent); `business` stays empty', ni.facts_given === true && ni.business_facts === FACTS && !ni.business, JSON.stringify({ g: ni.facts_given, f: ni.business_facts, b: ni.business }));
    mock('Normalize Input', [{ json: ni }]); mock('Load Site (Track)', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', status: 'active' } }]);
    const row = (await run('Site Row (Track)', [{ json: {} }]))[0].json;
    check('Track my site stores them on seo_sites (a real column)', row.business_facts === FACTS && TC.SITES.includes('business_facts'), JSON.stringify(row));
    const b2 = { ...body }; delete b2.business_facts;
    const ni2 = (await run('Normalize Input', { body: b2 }))[0].json;
    mock('Normalize Input', [{ json: ni2 }]);
    check('a re-save without the key leaves the stored facts alone', ni2.facts_given === false && !('business_facts' in (await run('Site Row (Track)', [{ json: {} }]))[0].json), JSON.stringify(ni2.facts_given));
    mock('Admin Run', [{ json: { body: { action: 'facts', site_id: 'site_techand-ai', business_facts: '  ' + FACTS + '  ' } } }]);
    const a = (await run('Admin Action', [{ json: {} }]))[0].json;
    check('Site Admin facts: the facts, trimmed, for the site row', a.action === 'facts' && a.business_facts === FACTS && a.site_id === 'site_techand-ai', JSON.stringify(a));
    mock('Admin Run', [{ json: { body: { action: 'facts', site_id: 'site_techand-ai' } } }]);
    const er = await H.expectError('Admin Action', [{ json: {} }], /business_facts/);
    check('Site Admin facts without a text is refused', er.ok, er.error);
    const av = (await run('Admin Validate', [{ json: { body: { action: 'facts', domain: 'techand.ai', business_facts: FACTS } } }]))[0].json;
    const av2 = (await run('Admin Validate', [{ json: { body: { action: 'facts', domain: 'techand.ai' } } }]))[0].json;
    check('the Admin API accepts facts with a text and answers 400 without one', av.ok === true && av2.ok === false && /business_facts/.test(av2.error), JSON.stringify({ av, av2 }));
    // the kit: the rule the app mirrors (app/shared/src/readiness.ts holds the same numbers; its vitest suite reads the kit)
    const kitSrc = fs.readFileSync(path.join(CODE, 'Cadence_Plan.js'), 'utf8').match(/const READY = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);
    check('the readiness kit is inlined into Cadence Plan', !!kitSrc, 'READY');
    const K = new Function((kitSrc ? kitSrc[0] : 'const READY = null;') + '\nreturn READY;')();
    const full = K.of({ profile: { author_name: 'A', author_job_title: 'B', author_bio: 'C' }, facts: 'x'.repeat(30) });
    const empty = K.of({});
    check('READY: 30 characters of facts and name + job title + bio are ready; nothing on file names all four parts', K.FACTS_MIN === 30 && full.ready && !empty.ready && eq(empty.missing.map(m => m.key), ['author_name', 'author_job_title', 'author_bio', 'business_facts'])
      && empty.missing_text === "your author's name, your author's job title, a short author bio and your business facts" && !K.of({ profile: {}, facts: '   ' + 'y'.repeat(29) + '   ' }).facts_ready, JSON.stringify(empty));
  });

  await guard('KF23 profile before the first page: the preview e-mail and callback', async () => {
    reset(); const SN = 'KF23 profile before the first page — the "Coming up" callback carries waiting_for_profile, what is missing and the held items; its e-mail lists them apart and says what to add'; begin(SN); const check = mkCheck(SN);
    const c = FX.cases.find(x => x.name === 'preview_holds_for_profile'); const r = await planCase(c);
    mock('Cadence Plan', r.out.map(json => ({ json })));
    const pv = (await run('Cadence Preview', [{ json: {} }])).map(i => i.json); const b = (pv[0] || {}).callback_body || {};
    check('the callback says the site waits for its profile, names what is missing, and the held items are marked', b.waiting_for_profile === true && eq((b.readiness || {}).missing, ['author_name', 'author_job_title', 'author_bio']) && (b.items || []).filter(x => x.held === 'profile').length === 3, JSON.stringify({ w: b.waiting_for_profile, r: b.readiness, held: (b.items || []).map(x => x.held) }));
    check('the e-mail lists them under their own heading, never as "written on their own", and says what to add', /Ready to write once your author profile and business facts are on file/.test(pv[0].html) && !/Written on their own/.test(pv[0].html) && /Add your author(&#39;|')s name/.test(pv[0].html) && /add your author profile/.test(pv[0].subject), pv[0].subject);
    H.scanHtml('cycle preview e-mail (held for the profile)', pv[0].html);
  });
};
