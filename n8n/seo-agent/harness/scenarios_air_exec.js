// AIR P6 (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md 2.F / 2.H / 6.7, CONTRACTS.md §1 P6): the on-mode consumers. Every check runs the REAL
// generated nodes (harness/code_v4) or the generated workflow (air_graph_exec), on synthetic data only:
//   AE1  Content Cadence reserve + honour: harness/air_cadence_cases.json through the real Cadence Plan (the app's cadence.ts mirror runs the same
//        file in app/server/test/airCadence.test.ts): the reserved AI ranking page on top at levels 2 and 3, one a week, inside ai_pages_month,
//        a topic verdict honoured, a safety refusal kept; off, shadow and the kill switch byte-identical to a plan without any AIR column;
//   AE2  protect: a ladder rung, a striking-distance and a decay refresh aimed at a page AI answers cite become suggestions with the reason; an
//        approved item and AIR's own refresh are written; every keyword-first fixture case is byte-identical with AIR off / shadow / killed;
//   AE3  listings: the service-firm directories for an `on` website (agency or mixed), today's checklist exactly for every other one;
//   AE4  Link Builder: AI ranking's placements scored with its own probability and drafted first (at most 5), other rows unchanged, off unchanged;
//   AE5  AI Growth report and callback: the "AI ranking plan" section and the additive key `ai_rank` for an `on` website only; off, shadow and the
//        kill switch leave the report HTML and the callback identical.
const fs = require('fs'); const path = require('path');
const { exec } = require('./air_graph_exec');
const FXA = require('./fixtures_air');
const WF_DIR = path.join(__dirname, '..', 'workflows');
const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
const J = (x) => String(JSON.stringify(x));
const clone = (x) => JSON.parse(JSON.stringify(x));
const EMDASH = /[—‘’“”…]/;   // the copy rule: no em dash, curly quote or ellipsis character in new text

module.exports = async (ctx) => {
  const { H, run, mock, reset, guard, begin } = ctx;
  const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'air_cadence_cases.json'), 'utf8'));
  const KFX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const RealDate = Date;
  const frozen = async (iso, fn) => { const T = RealDate.parse(iso);
    class FrozenDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
    global.Date = FrozenDate; try { return await fn(); } finally { global.Date = RealDate; } };
  const loadCadence = (c) => { const t = c.tables || {};
    mock('Manual Run', [{ json: c.trigger || {} }]);
    mock('Load Sites', items(t.sites)); mock('Load Cadence', items(t.cadence)); mock('Load Ladders', items(t.ladders)); mock('Load Query History', items(t.query_history));
    mock('Load Trends', items(t.trends)); mock('Load Content Log', items(t.content_log)); mock('Load Ladder Settings', items(t.ladder_settings)); mock('Load Main Keyword Ranks', items(t.ranks));
    mock('Load AI Targets (Cadence)', items(t.ai_targets)); mock('Load AI Targets Writing (Cadence)', items([])); mock('Load Monitors (Cadence)', items(t.monitors));
    mock('Load Pages (Cadence)', items(t.pages)); mock('Load AI Brands (Cadence)', items(t.ai_brands)); mock('Load Skips (Cadence)', items(t.skips)); mock('Load Cost (Cadence)', items(t.cost));
    mock('Load Cycle Jobs (Cadence)', items(t.cycle_jobs)); mock('Load Profiles (Cadence)', items(t.profiles));
    mock('Load AIR Cache (Cadence)', items(t.air_cache)); };
  const planCase = async (c) => { reset(); loadCadence(c);
    const out = await frozen(c.now, async () => (await run('Cadence Plan', [{ json: {} }])).map(i => i.json));
    const picks = out.filter(j => !j.nothing_to_do && !j.preview);
    const facts = out.find(j => j.preview) || out.find(j => j.site_id && !j.nothing_to_do) || out.find(j => j.report_only) || out[0] || {};
    return { out, picks, facts }; };
  // the same case with every AIR column and row taken away: what the plan was before AIR existed
  const stripAir = (c) => { const x = clone(c); const t = x.tables;
    for (const m of t.monitors || []) for (const k of ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave']) delete m[k];
    for (const r of t.ai_targets || []) for (const k of ['origin', 'action_id', 'live_at']) delete r[k];
    t.air_cache = []; return x; };
  const ks = (arr) => (arr || []).map(x => ({ keyword: x.keyword, source: x.source }));
  const sortJ = (arr) => (arr || []).map(x => J(x)).sort();
  const eq = (a, b) => J(a) === J(b);

  // ===================================================================================
  // AE1 / AE2 - the shared case file through the real Cadence Plan
  // ===================================================================================
  await guard('air exec AE1 AE2 cadence reserve honour protect', async () => {
    reset(); const SN = 'AIR P6 AE1 / AE2: Content Cadence on-mode rules (reserve, honour, protect) through the real Cadence Plan, harness/air_cadence_cases.json (the app mirror runs the same file)'; begin(SN); const check = mkCheck(SN);
    check('the case file documents itself, names the app mirror, and holds at least 12 cases', /cadence\.ts/.test(CASES._doc) && CASES.contract === 'app/server/src/services/cadence.ts' && CASES.cases.length >= 12, CASES.cases.length);
    const src = fs.readFileSync(path.join(CODE, 'Cadence_Plan.js'), 'utf8');
    check('Cadence Plan inlines AIRF (the one settings / kill-switch rule) and reads the kind-air cache load', src.includes('const AIRF = (() => {') && !src.includes('/*__AI_RANK_FLAGS__*/') && src.includes("rowsOf('Load AIR Cache (Cadence)')"), 'AIRF or the load missing');
    for (const c of CASES.cases) {
      const r = await planCase(c); const e = c.expect; const f = r.facts;
      const airPicks = r.picks.filter(p => (c.tables.ai_targets || []).some(t => t.target_id === p.target_id && t.origin === 'ai_rank') && /reserved AI ranking page/.test(p.why));
      console.log('   ' + c.name + ' -> picks', J(ks(r.picks)), '| suggestions', J(ks(f.suggestions)), '| refused', J((f.refused || []).map(x => x.keyword + ' (' + x.reason + ')')), '| air', J(f.air ? { reserved: f.air.reserved && f.air.reserved.keyword, honoured: f.air.honoured.map(x => x.keyword), protected: f.air.protected.map(x => x.keyword) } : null));
      if (!e.picks) { check(c.name + ': the case has an expectation', false, J({ picks: ks(r.picks), suggestions: ks(f.suggestions), waiting_for_keyword: !!f.waiting_for_keyword, refused: (f.refused || []).map(x => ({ keyword: x.keyword, reason: x.reason })), air: f.air ? { reserved: f.air.reserved && f.air.reserved.keyword, honoured: f.air.honoured.map(x => x.keyword), protected: f.air.protected.map(x => x.keyword) } : null })); continue; }
      check(c.name + ': picks', eq(ks(r.picks), e.picks), J(ks(r.picks)));
      check(c.name + ': suggestions', eq(ks(f.suggestions), e.suggestions), J(ks(f.suggestions)));
      check(c.name + ': waiting_for_keyword ' + !!e.waiting_for_keyword, !!f.waiting_for_keyword === !!e.waiting_for_keyword, J(f.waiting_for_keyword));
      check(c.name + ': refused (with their reasons)', eq(sortJ((f.refused || []).map(x => ({ keyword: x.keyword, reason: x.reason }))), sortJ(e.refused)), J(f.refused));
      if (e.air === null) check(c.name + ': no `air` key (a website that is not on, or stopped by the kill switch)', !r.out.some(j => 'air' in j), J(r.out.map(j => Object.keys(j).includes('air'))));
      else check(c.name + ': the air facts (reserved, honoured, protected)', !!f.air && f.air.mode === 'on' && (f.air.reserved ? f.air.reserved.keyword : null) === e.air.reserved
        && eq(f.air.honoured.map(x => x.keyword), e.air.honoured) && eq(f.air.protected.map(x => x.keyword), e.air.protected), J(f.air));
      if (e.protect_reason) check(c.name + ': the suggestions that rewrite a protected page say why', e.protect_reason.every(k => (f.suggestions || []).some(x => x.keyword === k && /AI answers cite this page/.test(x.why))), J((f.suggestions || []).map(x => [x.keyword, x.why.slice(-120)])));
      if (e.same_as_stripped) { const r0 = await planCase(stripAir(c));
        check(c.name + ': byte-identical to the same tables without any AIR column or row', J(r.out) === J(r0.out), J(r.out).slice(0, 300) + ' vs ' + J(r0.out).slice(0, 300)); }
      // the invariants of every on-mode plan
      const refusedK = new Set((f.refused || []).map(x => String(x.keyword).toLowerCase()));
      check(c.name + ': no refused keyword is written or suggested', ![...r.picks, ...(f.suggestions || [])].some(p => refusedK.has(String(p.keyword).toLowerCase())), J([...refusedK]));
      const pages = Number((((c.tables.cadence || [])[0]) || {}).pages_per_week) || 0;
      check(c.name + ': at most one reserved AI ranking page, only with the reserve on, the rest within pages_per_week (the level-3 AI page on top)',
        airPicks.length <= 1 && (!airPicks.length || (c.tables.monitors[0].ai_rank_mode === 'on' && c.tables.monitors[0].ai_rank_reserve === true))
        && r.picks.filter(p => !airPicks.includes(p) && !(/^ai_/.test(p.source) && c.level === 3)).length <= pages, J({ pages, picks: ks(r.picks), air: ks(airPicks) }));
      for (const p of airPicks) check(c.name + ': the reserved page is an ordinary AI content run that carries its AI target (question, target id)',
        p.body && p.body.mode === 'keyword' && p.body.force_content === true && p.body.ai_target && p.body.ai_target.target_id === p.target_id && /^ai_(answer|refresh)$/.test(p.source), J(p.body && p.body.ai_target));
      for (const s of (f.suggestions || []).filter(s => /AI answers cite this page/.test(s.why))) check(c.name + ': a protected item is suggested with the reason, never written', !r.picks.some(p => p.keyword === s.keyword) && /could lose it/.test(s.why) && !EMDASH.test(s.why.split('; AI answers cite')[1] || ''), s.why);
    }
    // AE2: EVERY keyword-first fixture case is byte-identical with AIR off, shadow (reserve on, every page protected) or on + killed
    let same = 0, diff = [];
    for (const c0 of KFX.cases) {
      const base = await planCase(c0);
      const urls = [...new Set([...(c0.tables.pages || []).map(p => p.url), ...(c0.tables.query_history || []).map(q => q.page), ...(c0.tables.ai_targets || []).map(t => t.page_url), ...(c0.tables.ladders || []).map(l => l.target_url)].filter(Boolean))];
      const protect = { key: 'air:protect:' + (((c0.tables.sites || [])[0]) || {}).site_id, kind: 'air', site_id: '', value: J({ urls: urls.map(u => ({ url: u, until: '2099-01-01T00:00:00.000Z', why: 'test' })) }) };
      for (const [mode, kill] of [['off', false], ['shadow', false], ['on', true], ['', false]]) {
        const c = clone(c0); c.tables.air_cache = [protect, ...(kill ? [{ key: 'air:kill', kind: 'air', site_id: '', value: '1' }] : [])];
        for (const m of c.tables.monitors || []) Object.assign(m, { ai_rank_mode: mode, ai_rank_reserve: true });
        for (const t of c.tables.ai_targets || []) Object.assign(t, { origin: 'ai_rank', action_id: 'air_x_L05_00000000' });
        const r = await planCase(c); if (J(r.out) === J(base.out)) same++; else diff.push(c0.name + ' (' + (mode || 'empty') + (kill ? ', killed' : '') + ')');
      }
    }
    check('AE2: all ' + KFX.cases.length + ' keyword-first cases x {off, shadow, empty, on + kill switch} (every page protected, every AI target AIR\'s, the reserve on) are byte-identical to the plan without AIR', !diff.length && same === KFX.cases.length * 4, diff.slice(0, 8).join(', '));
  });

  // ===================================================================================
  // AE3 - the listings checklist
  // ===================================================================================
  await guard('air exec AE3 listings', async () => {
    reset(); const SN = 'AIR P6 AE3: the service-firm directories (The Manifest, Sortlist, the Microsoft partner directory, national associations) only for a website whose AI ranking is on; today\'s checklist exactly for every other one'; begin(SN); const check = mkCheck(SN);
    const LS = new Function(fs.readFileSync(path.join(__dirname, '..', 'v5', 'code', '_listings.js'), 'utf8') + '\nreturn { LISTINGS, listingsFor, siteKind };')();
    const ids = (a) => a.map(l => l.id);
    const AIRIDS = LS.LISTINGS.filter(l => l.air).map(l => l.id);
    check('the AIR entries are marked, unique and carry a reason, a submit page and no em dash', AIRIDS.length >= 4 && new Set(LS.LISTINGS.map(l => l.id)).size === LS.LISTINGS.length && LS.LISTINGS.filter(l => l.air).every(l => l.why && /^https:\/\//.test(l.submit) && !EMDASH.test(l.why + l.name)), J(AIRIDS));
    const combos = [];
    for (const kind of [['saas'], ['agency'], ['agency', 'saas'], ['local'], ['any']]) for (const iso of ['AE', 'PK', 'SA', 'GB']) for (const site of ['', 'we are a Microsoft Dynamics 365 partner', 'zoho and odoo connectors'])
      combos.push({ kind, iso, site, off: ids(LS.listingsFor(kind, iso, 'crm erp software e-invoicing', site)), offNoOpts: ids(LS.listingsFor(kind, iso, 'crm erp software e-invoicing', site, undefined)), on: ids(LS.listingsFor(kind, iso, 'crm erp software e-invoicing', site, { air: true })) });
    check('off: no AIR entry is ever offered, with or without an empty options argument (' + combos.length + ' kind x country x site combinations)', combos.every(x => !x.off.some(i => AIRIDS.includes(i)) && J(x.off) === J(x.offNoOpts)), J(combos.find(x => x.off.some(i => AIRIDS.includes(i)))));
    check('off: the checklist is today\'s list exactly (the on list minus the AIR entries, in the same order)', combos.every(x => J(x.on.filter(i => !AIRIDS.includes(i))) === J(x.off)), 'order changed');
    const ag = combos.find(x => J(x.kind) === J(['agency']) && x.iso === 'AE' && x.site === '');
    check('on, an agency in the UAE: The Manifest and Sortlist are added; the Pakistan association is not', ag.on.includes('themanifest') && ag.on.includes('sortlist') && !ag.on.includes('pasha'), J(ag.on));
    const pk = combos.find(x => J(x.kind) === J(['agency', 'saas']) && x.iso === 'PK' && x.site === '');
    check('on, a mixed software firm in Pakistan: P@SHA is offered', pk.on.includes('pasha'), J(pk.on));
    const ms = combos.find(x => J(x.kind) === J(['agency', 'saas']) && x.iso === 'AE' && /Microsoft/.test(x.site)); const nms = combos.find(x => J(x.kind) === J(['agency', 'saas']) && x.iso === 'AE' && x.site === '');
    check('on: the Microsoft partner directory only for a site whose own pages name Microsoft products', ms.on.includes('ms_partner_dir') && !nms.on.includes('ms_partner_dir'), J({ ms: ms.on, none: nms.on }));
    const loc = combos.find(x => J(x.kind) === J(['local']) && x.iso === 'AE' && x.site === '');
    check('on, a local business: no service-firm directory', !loc.on.some(i => AIRIDS.includes(i)), J(loc.on));
    check('siteKind: a custom software development company is a software seller today, and a service firm too only when its AI ranking is on',
      J(LS.siteKind('custom software development company', 'ai agents dubai')) === J(['saas']) && J(LS.siteKind('custom software development company', 'ai agents dubai', { air: true })) === J(['agency', 'saas'])
      && J(LS.siteKind('restaurant', 'custom software', { air: true })) === J(['local']) && J(LS.siteKind('e-invoicing platform', '', { air: true })) === J(LS.siteKind('e-invoicing platform', '')),
      J([LS.siteKind('custom software development company', 'ai agents dubai'), LS.siteKind('custom software development company', 'ai agents dubai', { air: true })]));
    const lb = fs.readFileSync(path.join(CODE, 'LB_Assemble.js'), 'utf8');
    check('LB Assemble passes { air: true } to siteKind and listingsFor only for an on website (AIRF.writesSinks on its seo_monitors row, with the kill switch read from Load AIR Kill (LB))', /siteKind\(p\.profile\.business_type, p\.topics\.join\(' '\), airOn \? \{ air: true \} : undefined\)/.test(lb) && /LK\.text\(selfHtml\), airOn \? \{ air: true \} : undefined\)/.test(lb) && /AIRF\.writesSinks\(AIRF\.settingsOf\(m\), airKill\)/.test(lb) && lb.includes("AIRF.killed(rows('Load AIR Kill (LB)'))"), 'wiring');
  });

  // ===================================================================================
  // AE4 - the Link Builder: AI ranking's placements
    // FX-C RC-8: directories per firm type. A professional-services firm (tax, HR, accounting, management) gets the service-firm directories
    // only, never a software marketplace; the Microsoft partner directory needs partner words on the site, not "we use Microsoft 365"
    const SOFTMKT = ['g2', 'capterra', 'trustradius', 'saashub', 'alternativeto', 'producthunt', 'appsource'];
    for (const [bt, tp] of [['tax consulting firm', 'corporate tax registration uae'], ['management consulting', 'strategy consulting dubai'], ['HR consultancy', 'hr outsourcing uae'], ['accounting firm', 'bookkeeping and vat returns dubai']]) {
      const kOn = LS.siteKind(bt, tp, { air: true }), kOff = LS.siteKind(bt, tp);
      const off = ids(LS.listingsFor(kOff, 'AE', tp, 'we use Microsoft 365 and Azure every day')), on = ids(LS.listingsFor(kOn, 'AE', tp, 'we use Microsoft 365 and Azure every day', { air: true }));
      const added = on.filter(i => !off.includes(i));
      check('RC-8 on, a ' + bt + ': an agency only, adds The Manifest and Sortlist only (no software marketplace, no Microsoft partner directory for "we use Microsoft 365")',
        J(kOn) === J(['agency']) && J(added.slice().sort()) === J(['sortlist', 'themanifest']) && !on.some(i => SOFTMKT.includes(i) || i === 'ms_partner_dir'), J({ kOn, added, on }));
    }
    const msUse = ids(LS.listingsFor(['agency', 'saas'], 'AE', 'crm erp software', 'our team uses Microsoft 365, Azure and SharePoint', { air: true })), msPartner = ids(LS.listingsFor(['agency', 'saas'], 'AE', 'crm erp software', 'We are a Microsoft Solutions Partner for Business Applications', { air: true }));
    check('RC-8: the Microsoft partner directory for a site that says it is a Microsoft partner, never for one that only uses Microsoft products', !msUse.includes('ms_partner_dir') && msPartner.includes('ms_partner_dir'), J({ msUse, msPartner }));
    check('RC-8: P@SHA (a software houses association) is never offered to a professional-services firm in Pakistan', !ids(LS.listingsFor(LS.siteKind('tax consulting firm', 'tax returns lahore', { air: true }), 'PK', 'tax', '', { air: true })).includes('pasha'), 'pasha offered');
  // ===================================================================================
  await guard('air exec AE4 link builder', async () => {
    reset(); const SN = 'AIR P6 AE4: Link Builder - an AI ranking placement is scored with AI ranking\'s own probability; the writer budget takes rows by expected value with at most 2 AI ranking placements a week (FX-C RC-7); the kill switch gives today\'s output; off unchanged'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_nova-ai-example', DOM = 'nova-ai.example';
    const page = (title, dom) => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<html lang="en"><head><title>' + title + '</title></head><body><h1>' + title + '</h1><p>A list of the best custom software development companies in Dubai for AI agents and automation projects. We compare delivery, pricing and reviews of software firms.</p><p>Contact the editor: <a href="mailto:editor@' + dom + '">editor@' + dom + '</a></p></body></html>' });
    const plan = { site_id: SID, domain: DOM, email: '', callback_url: '', request_id: 'lb_test', on_demand: true, free_only: false, competitors: [], serp_rivals: [], ai_rivals: [], topics: ['custom software development', 'ai agents'], services: ['custom software development', 'AI agents'],
      pages: [{ url: 'https://' + DOM + '/services/custom-software', title: 'Custom software development', keyword: 'custom software development dubai' }], home: 'https://' + DOM + '/', profile: { business_type: 'custom software development company' }, brand: 'Nova', brand_names: ['Nova'],
      country: 'United Arab Emirates', country_iso: 'AE', language_code: 'en', accreditation: '', budget: 2, due: { listings: false }, state: {} };
    const pros = (origin, dom, score) => ({ site_id: SID, domain: DOM, prospect_domain: dom, type: 'ai_source', rank: 0, spam_score: 0, detail: 'cited', source_url: 'https://' + dom + '/best-software-companies-dubai', target_url: '', status: 'new', first_seen: '2026-10-20T00:00:00.000Z', last_seen: '2026-11-01T00:00:00.000Z', won_at: '', score, origin, contact_email: '', contact_url: '' });
    const runLB = async (mode, o = {}) => { reset();
      mock('LB Plan', [{ json: o.budget ? { ...plan, budget: o.budget } : plan }]);
      mock('Load Link Prospects', items([pros('ai_rank', 'lists-one.example', 8), pros('ai_growth', 'lists-two.example', 40), pros('ai_rank', 'lists-three.example', 12), ...(o.prospects || [])]));
      mock('Load AIR Kill (LB)', items(o.kill ? [{ key: 'air:kill', kind: 'air', site_id: '', value: '1' }] : []));
      mock('Load Link Outreach', items(o.outreach || []));
      for (const n of ['Load Listings', 'Load Backlinks', 'Load Link Impact', 'Load Query History', 'Load Content Log', 'LB Source Requests', 'Fetch LB Sources', 'LB Second Requests', 'Fetch LB Second', 'LB DFS Requests', 'Run LB DFS']) mock(n, items([]));
      mock('Load Monitors', items([{ site_id: SID, domain: DOM, ai_rank_mode: mode, ai_rank_reserve: true }]));
      const reqs = ['lists-one.example', 'lists-two.example', 'lists-three.example'].map(d => ({ site_id: SID, kind: 'prospect', prospect_domain: d, type: 'ai_source', url: 'https://' + d + '/best-software-companies-dubai', title: 'Best software companies in Dubai' }));
      mock('LB Page Requests', reqs.map(j => ({ json: j }))); mock('Fetch LB Pages', reqs.map(r => ({ json: page('Best custom software development companies in Dubai', r.prospect_domain) })));
      return (await run('LB Assemble', [{ json: {} }]))[0].json; };
    const off = await runLB(''), sh = await runLB('shadow'), on = await runLB('on');
    const O = (A, d) => (A.outreach_rows || []).find(o => o.prospect_domain === d) || {};
    console.log('   AE4 off ->', J((off.outreach_rows || []).map(o => [o.prospect_domain, o.status, o.score])), 'jobs', J((off.jobs || []).map(j => j.prospect_domain)));
    console.log('   AE4 on  ->', J((on.outreach_rows || []).map(o => [o.prospect_domain, o.status, o.score])), 'jobs', J((on.jobs || []).map(j => j.prospect_domain)));
    check('the three placements are read and ready in every mode (the test reads what it means to)', ['lists-one.example', 'lists-two.example', 'lists-three.example'].every(d => O(off, d).status === 'ready' && O(on, d).status === 'ready'), J((off.outreach_rows || []).map(o => [o.prospect_domain, o.status, o.fit_reason])));
    const norm = (A) => J({ ...A, checked_at: '', cache_row: null, outreach_rows: (A.outreach_rows || []).map(o => ({ ...o, checked_at: '' })), prospect_rows: (A.prospect_rows || []).map(o => ({ ...o, first_seen: '', last_seen: '' })), jobs: (A.jobs || []).map(o => ({ ...o, checked_at: '' })) });
    check('off and shadow: identical output (scores, order, drafts)', norm(off) === norm(sh), norm(sh).slice(0, 300));
    const fitF = (o) => 0.4 + 0.6 * Math.min(1, Number(o.fit) + 0.2);
    check('on: an AI ranking placement is scored with its own probability (stored score / 100) and the same fit factor', O(on, 'lists-one.example').score === Math.round(100 * 0.08 * fitF(O(on, 'lists-one.example'))) && O(on, 'lists-three.example').score === Math.round(100 * 0.12 * fitF(O(on, 'lists-three.example'))),
      J([O(on, 'lists-one.example'), O(on, 'lists-three.example')].map(o => [o.score, o.fit])));
    check('on: every other row is scored exactly as off', O(on, 'lists-two.example').score === O(off, 'lists-two.example').score, J([O(on, 'lists-two.example').score, O(off, 'lists-two.example').score]));
    check('off: the stored scores stand (an ai_rank row is not rescored on a website that is not on)', O(off, 'lists-one.example').score === 8 && O(off, 'lists-three.example').score === 12, J([O(off, 'lists-one.example').score, O(off, 'lists-three.example').score]));
    check('on: the writer budget (2) takes rows by expected value, so the stronger ordinary placement comes before AI ranking\'s (RC-7: no hoist)', J((on.jobs || []).map(j => j.prospect_domain)) === J(['lists-two.example', 'lists-three.example']), J((on.jobs || []).map(j => j.prospect_domain)));
    check('off: the writer budget takes the rows in their own order (the highest score first)', (off.jobs || [])[0] && off.jobs[0].prospect_domain === 'lists-two.example', J((off.jobs || []).map(j => j.prospect_domain)));
  });

  // ===================================================================================
  // AE5 - the AI Growth report and callback
  // ===================================================================================
  await guard('air exec AE5 report callback', async () => {
    // RC-7: the kill switch. With the air:kill row an on website gets exactly the off output (flat scores, today's order, no AI ranking directory)
    const killed = await runLB('on', { kill: true });
    check('RC-7 kill switch: an on website with the air:kill row is byte-identical to off (scores, order, drafts)', norm(killed) === norm(off), norm(killed).slice(0, 300));
    // RC-7: a mention (0.9) and a lost-link reclaim (0.7) already ready, and five AI ranking placements (~0.1): by expected value, at most 2 AI ones
    const rdy = (dom, type, score) => ({ site_id: SID, domain: DOM, prospect_domain: dom, type, status: 'ready', score, fit: 0.5, sequence_json: '', contacts_json: '[{"email":"editor@' + dom + '"}]', checks_json: '{}', page_url: 'https://' + dom + '/p', page_title: 'A page', target_url: 'https://' + DOM + '/', checked_at: '2026-11-01T00:00:00.000Z' });
    const airDoms = ['air-a.example', 'air-b.example', 'air-c.example', 'air-d.example', 'air-e.example'];
    const evOut = [rdy('mention.example', 'mention', 90), rdy('lost.example', 'lost', 70), ...airDoms.map((d, i) => rdy(d, 'ai_source', 12 - i))];
    const evPros = airDoms.map((d, i) => pros('ai_rank', d, 12 - i));
    const ev3 = await runLB('on', { budget: 3, outreach: evOut, prospects: evPros }), ev8 = await runLB('on', { budget: 8, outreach: evOut, prospects: evPros }), ev3off = await runLB('', { budget: 3, outreach: evOut, prospects: evPros }), ev3kill = await runLB('on', { budget: 3, outreach: evOut, prospects: evPros, kill: true });
    const jd = (A) => (A.jobs || []).map(j => j.prospect_domain);
    console.log('   AE4 EV on budget 3 ->', J(jd(ev3)), '| budget 8 ->', J(jd(ev8)), '| off ->', J(jd(ev3off)));
    check('RC-7: budget 3: the mention, the reclaim and the next best row by expected value (an ordinary placement) are drafted; no AI ranking placement', J(jd(ev3)) === J(['mention.example', 'lost.example', 'lists-two.example']), J(jd(ev3)));
    check('RC-7: budget 3: no AI ranking placement is drafted ahead of the mention or the reclaim', jd(ev3)[0] === 'mention.example' && jd(ev3)[1] === 'lost.example', J(jd(ev3)));
    const airN = (A) => jd(A).filter(d => airDoms.includes(d) || d === 'lists-one.example' || d === 'lists-three.example').length;
    check('RC-7: a large budget (8) still drafts at most 2 AI ranking placements a week (the weakest wait), every better row first', airN(ev8) === 2 && jd(ev8)[0] === 'mention.example' && jd(ev8)[1] === 'lost.example' && !jd(ev8).includes('air-e.example') && !jd(ev8).includes('air-d.example'), J(jd(ev8)));
    check('RC-7: with the kill switch the same tables give the off result byte for byte', norm(ev3kill) === norm(ev3off), norm(ev3kill).slice(0, 300));
    reset(); const SN = 'AIR P6 AE5: the AI Growth report and callback - the "AI ranking plan" section and the additive key ai_rank for an on website only; off, shadow and the kill switch identical'; begin(SN); const check = mkCheck(SN);
    const readWf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WF_DIR, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
    const WF = readWf('SEO_Agent_AI_Growth.json');
    // test kits with real shapes (as AP3 does), so the on-mode plan has chosen actions whatever the calibration of the real kits
    const FAKE = `
const ARD = Object.assign({}, ARD_BASE, {
  market: () => ({ cc: 'AE', lang: 'en', location_code: 2784, second: null, conflicts: [], basis: 'test kit' }), intentOf: () => 'recommendation',
  corePanel: ({ prompts, now }) => { const ps = (prompts || []).filter(p => p.kind !== 'brand').slice(0, 4); return { core: ps.map(p => ({ prompt_id: p.prompt_id, core_since: new Date(now).toISOString(), core_until: new Date(now + 56 * 864e5).toISOString().slice(0, 10), reason: 'test core' })), proposed: [], extend: [], comparable: true, why: 'test' }; },
  assignArms: ({ core, now }) => (core || []).map((c, i) => ({ prompt_id: c.prompt_id, arm: i % 3 === 2 ? 'control' : 'treated', stratum: 's1', assigned_at: new Date(now).toISOString() })),
  mde: () => ({ prepost: 0.12, did: 0.2, n_eff_t: 3, n_eff_c: 1, p_used: 0.02, first_appearance_k: 7, basis: 'test' }), fanoutOf: ({ prompt_id }) => [{ query: 'fanout ' + prompt_id, n: 2, engines: ['chatgpt'] }],
  diagnose: ({ prompt }) => ({ prompt_id: prompt.prompt_id, intent: 'recommendation', engines: { chatgpt: { stage: 'S1', sub: '', basis: 'direct', n: 3, named: 0, cited: 0, retrieved: 1, our_rank: null, evidence: [] } }, best_stage: 'S1', parametric_share: { chatgpt: 0.4 }, no_search: [], list_dominated: true, nobody_named: false, first_named_at: '', last_named_at: '', last_cited_at: '' }),
  sources: () => [], rollEvidence: () => '' });
const ARL = Object.assign({}, ARL_BASE, {
  value: () => ({ V: 0.8, demand_w: 1, intent_w: 1, stage_w: 0.8, basis: 'test' }), feasibility: () => ({ F: 0.5, market_w: 1, comp_w: 0.5, reach_w: 0.5, basis: 'test' }),
  candidates: ({ site, diag }) => { const sid = site.site_id; const pid = (diag[0] || {}).prompt_id || 'nq1';
    const mk = (lever, ref) => { const L = ARL_BASE.LEVERS.find(l => l.id === lever); return { action_id: AIRF.actionId(sid, lever, ref), site_id: sid, lever, ref, questions: [pid], engines: ['chatgpt'], target_stage: L.to, executor: L.executor, scope: L.scope, sink: L.sink, sink_ref: '', why: 'test ' + lever }; };
    return [mk('L05', { prompt_id: pid }), mk('L03', {}), mk('L09', { url: 'https://clutch.co/ae/developers/dubai' })]; },
  score: (c) => ({ gain: 0.1, cost: 2, score: 0.05, p_by_cell: [], days: 30, why: 'test score ' + c.lever, p_hat: 0.2, expected: { p: 0.2, gain: 0.1, cost: 2, score: 0.05, days: 30 } }),
  choose: (scored) => ({ chosen: scored, deferred: [], refused: [] }),
  prereg: (a, { now }) => ({ metric: 'named_rate', questions: a.questions, engines: a.engines, controls: [], window_days: 28, t0_rule: 'live_at', projected: { p: 0.2, gain: 0.1 }, registered_at: new Date(now).toISOString() }),
  verify: () => ({ happened: null, at: '', evidence: [] }), outcome: () => ({ due: false, verdict: 'not_due', why: 'test' }), learnable: () => false, learn: () => [],
  memo: ({ site, mode }) => ({ v: 1, rule_version: 'air-1', site_id: site.site_id, mode, parts: ARL_BASE.MEMO_PARTS.map(k => ({ key: k, title: ARL_BASE.MEMO_TITLES[k], lines: [{ text: 'test line ' + k, figures: [{ name: 'test_figure', value: 1, basis: 'test basis' }] }] })), blockers: [{ what: 'connect a mailbox', owner: 'client', since: '2026-10-20', blocks: '0 pitches can be sent' }] }),
  compareOld: () => ({ overlap: 0, gain_air: 0.5, gain_old: 0.1, causes: { air: ['1'], old: [] }, note: 'test compare' }) });
`;
    const withKits = (wf) => { const w = clone(wf); const n = w.nodes.find(x => x.name === 'AI Rank Plan'); let js = n.parameters.jsCode;
      for (const k of ['ARD', 'ARL']) { const a = 'const ' + k + ' = (() => {'; if (js.split(a).length !== 2) throw new Error('test kits: ' + a); js = js.replace(a, 'const ' + k + '_BASE = (() => {'); }
      const anchor = 'const AIR_CFG = '; if (js.split(anchor).length !== 2) throw new Error('test kits: anchor'); n.parameters.jsCode = js.replace(anchor, FAKE + '\n' + anchor); return w; };
    const runG = async (modes, o = {}) => { const F = FXA.make({ seed: 'air-golden', modes }); const tables = clone(F.tables);
      if (o.kill) tables.seo_cache.push({ key: 'air:kill', kind: 'air', site_id: '', value: '1', updated_at: F.now });
      const hostOf = (u) => String(u).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').toLowerCase().replace(/^www\./, '');
      const http = (node, req) => { const u = String(req.url || '');
        if (/count_tokens/.test(u)) return { input_tokens: 1000 };
        if (/appendix\/user_data/.test(u)) return { status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance: 25 } }] }] };
        if (/bing\.com\/webmaster/i.test(u)) { if (/GetUserSites/i.test(u)) return { d: F.bing.sites.map(s => ({ Url: s, IsVerified: true })) }; if (/GetUrlSubmissionQuota/i.test(u)) return { d: { DailyQuota: 10, MonthlyQuota: 300 } };
          if (/GetUrlInfo/i.test(u)) { const m = u.match(/[?&]url=([^&]+)/i); const pg = m ? decodeURIComponent(m[1]) : ''; const at = F.bing.crawled[pg]; return { d: { Url: pg, HttpStatus: at ? 200 : 0, LastCrawledDate: '/Date(' + (at ? Date.parse(at) : -62135596800000) + ')/', DiscoveryDate: '/Date(' + (at ? Date.parse(at) : -62135596800000) + ')/' } }; } return { d: null }; }
        if (/wikidata\.org/.test(u)) return /wbsearchentities/.test(u) ? { search: [] } : { query: { search: [] } };
        if (/\/robots\.txt$/i.test(u)) { const t = F.robots[hostOf(u)]; return req.text ? { statusCode: t ? 200 : 404, headers: {}, data: t || '' } : {}; }
        const p = F.pages[u] || F.pages[u.replace(/\/$/, '')] || F.pages[u + '/']; if (p) return req.text ? { statusCode: p.status, headers: { 'content-type': 'text/html' }, data: p.html } : {};
        if (req.method === 'POST') return req.text ? { statusCode: 200, headers: {}, data: '' } : {}; return req.text ? { statusCode: 404, headers: {}, data: '' } : {}; };
      const agent = (node, item) => ({ drafts: ((item && item.jobs) || []).map(j => ({ n: j.n, subject: 'Synthetic subject ' + j.n, body: 'Synthetic draft. [Your name]' })) });
      const r = await exec({ wf: o.wf || withKits(WF), trigger: {}, tables, http, agent, now: F.nowMs, seed: 'air-golden', execId: 'air-exec-1' });
      const last = (n) => { const x = r.runs[n]; return x && x.length ? (x[x.length - 1][0] || []).map(i => i.json) : []; };
      return { r, F, report: last('Growth Report'), posted: r.posts.filter(p => p.node === 'POST Growth Report').map(p => p.body), errors: r.errors }; };
    const site = (R, sid) => R.report.find(j => j.site_id === sid) || null;
    const off = await runG({ nova: '', acme: 'off' }), sh = await runG({ nova: 'shadow', acme: 'shadow' }), on = await runG({ nova: 'on', acme: 'off' }), killed = await runG({ nova: 'on', acme: 'on' }, { kill: true });
    const NOVA = (off.report.find(j => /nova/.test(j.domain)) || {}).site_id, ACME = (off.report.find(j => /acme/.test(j.domain)) || {}).site_id;
    check('the fixture has both websites in the report (the test reads what it means to)', !!NOVA && !!ACME && off.report.length === 2, J(off.report.map(j => j.domain)));
    check('off: no section and no ai_rank key on any website', off.report.every(j => !('ai_rank' in j) && !/AI ranking plan/.test(j.html || '')), J(off.report.map(j => 'ai_rank' in j)));
    check('shadow: the report items and the posted callbacks are byte-identical to off', J(sh.report) === J(off.report) && J(sh.posted) === J(off.posted), 'shadow changed the report');
    check('the kill switch with both websites on: byte-identical to off', J(killed.report) === J(off.report) && J(killed.posted) === J(off.posted), 'the kill switch did not stop the section');
    const n = site(on, NOVA) || {}, a = site(on, ACME) || {};
    check('on: the on website gets the section; the other website\'s report item is byte-identical to off', /AI ranking plan/.test(n.html || '') && J(a) === J(site(off, ACME)), J({ section: /AI ranking plan/.test(n.html || ''), acmeSame: J(a) === J(site(off, ACME)) }));
    const R = n.ai_rank || {};
    check('on: ai_rank carries the contract keys (v, mode, run_id, memo, actions, steps, cost, compare, counts, reserve)', R.v === 1 && R.mode === 'on' && !!R.run_id && R.memo && R.memo.parts.length === 7 && Array.isArray(R.actions) && R.actions.length === 3 && Array.isArray(R.steps)
      && R.cost && typeof R.cost.usd === 'number' && R.compare && R.compare.note === 'test compare' && R.counts && typeof R.counts.core === 'number' && typeof R.reserve === 'boolean', J(R).slice(0, 600));
    check('on: the human steps (Bing Webmaster, the directory profile) are steps keyed ai_rank:<lever>:<refKey>, each with what, why and how we check it', R.steps.length === 2 && R.steps.every(s => /^ai_rank:L\d\d:(s:site|u:|p:|l:)/.test(s.key) && s.what && s.check && s.action_id) && R.steps.some(s => s.key === 'ai_rank:L09:u:clutch.co/ae/developers/dubai'), J(R.steps));
    check('on: each action names its questions in words (not ids) and who does it', R.actions.every(x => x.label && x.executor && Array.isArray(x.questions)) && R.actions.some(x => x.questions.length && !/^[a-z]{1,4}\d+$/.test(x.questions[0])), J(R.actions.map(x => [x.lever, x.questions])));
    const posted = on.posted.find(b => b && b.site_id === NOVA) || {}, postedA = on.posted.find(b => b && b.site_id === ACME) || {};
    check('on: the callback POSTed for the on website carries ai_rank; the other website\'s callback is byte-identical to off', J(posted.ai_rank) === J(R) && J(postedA) === J(off.posted.find(b => b && b.site_id === ACME)), J(Object.keys(posted)));
    const sec = (n.html || '').split('AI ranking plan')[1] || '';
    check('the new section follows the copy rule (no em dash, curly quote or ellipsis) and prints every figure with its basis', !EMDASH.test(sec.split('Where these numbers come from')[0]) && /test figure: 1 \(test basis\)/.test(sec) && /Waiting on/.test(sec), sec.slice(0, 400));
    check('no node error in any run', ![off, sh, on, killed].some(x => x.errors.length), J([off, sh, on, killed].map(x => x.errors)).slice(0, 300));
    // the lever labels in the report node are ARL's own
    const ARLsrc = fs.readFileSync(path.join(__dirname, '..', 'v5', 'code', '_ai_rank_learn.js'), 'utf8'); const GR = fs.readFileSync(path.join(__dirname, '..', 'v5', 'code', 'Growth_Report.js'), 'utf8');
    const labels = [...ARLsrc.matchAll(/\{ id: '(L\d\d)', label: '((?:[^'\\]|\\.)*)'/g)].map(m => [m[1], m[2]]);
    check('the report\'s lever labels equal ARL.LEVERS (17)', labels.length === 17 && labels.every(([id, l]) => GR.includes(id + ": '" + l + "'")), J(labels.filter(([id, l]) => !GR.includes(id + ": '" + l + "'"))));
  });
};
