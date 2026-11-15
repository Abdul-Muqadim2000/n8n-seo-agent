// CQ1-CQ8 (client reports 2026-11-16, devaicon.com / techand.ai: "write a page for this AI question" was written and recorded as another version
// of a service page). Synthetic data in the shapes production holds (public addresses of the client pages involved; no personal data).
//   CQ1  AI Metrics: a lost question's action uses the question's OWN search, not the panel topic; a page type the form accepts; the action is
//        the right kind for what is already decided (a written page: publish it; AI Growth's refresh: improve that page; set aside: nothing)
//   CQ2  Parse Verdict: an AI page is checked on its question's search like any page. devaicon's Dubai question beside its Pakistan page: not a
//        duplicate (another market); techand's "best crm service provider uae" beside the ladder's live CRM page: held with "Improve
//        /dynamics-365-crm-uae for this question" first (automatic runs: shadow); no page: written. The requested Guide stays a Guide.
//   CQ3  the grade: an AI page's fit is not cut by a low verdict while no duplicate is open; a duplicate still caps it
//   CQ4  Content Log Row: an AI run is `ai_answer` / `ai_refresh` whoever started it, and the row keeps the page as written (slug, title, H1)
//   CQ5  publish detection: the AI guide is never recorded at the client's MOVED service page; it is found at its own slug, or by its written title
//   CQ6  AI Growth: the client's own topics count (engagement models), a question is never matched to another market's page, a page that owns the
//        question's search is improved (same_search_page), the fold into a ladder needs the same search, the state follows the content log
//        (published -> written / live, failed -> queued, another search's ladder page -> queued), every row carries a reason code and plain words
//   CQ7  AI Target Marks / Settle (the cadence, both branches): plain reasons, failed runs queued again, no ids or table names
//   CQ8  the plain-words lint: no run id, target id, table name, lever id, dollar figure or long dash in a stored reason (AQ.clean)
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const NOW = new Date().toISOString();
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const kitFrom = (file, name) => { const src = fs.readFileSync(path.join(CODE, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' is not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const FORBIDDEN = /\b(?:cad|ait|lad)_[A-Za-z0-9]|\bseo_[a-z_]+|\bL\d{2}\b|\$\s?\d|[—–…“”]/;
  const D = 'https://devaicon.com', T = 'https://www.techand.ai';

  // ===================================================================================================================================
  await guard('CQ1 AI Metrics actions', async () => {
    reset(); const SN = 'CQ1 (INV1 F1 / F5 / F13) AI Metrics: the action for a lost question uses its own search and is the right kind for what is already decided'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_devaicon-com', DOM = 'devaicon.com';
    const P = [
      { prompt_id: 'q_dubai', prompt: 'Which companies offer the best AI automation services for businesses in Dubai?', kind: 'recommend', topic: 'ai automation services', keyword: 'best ai automation services dubai' },
      { prompt_id: 'q_govern', prompt: 'Governed agentic AI vs fully autonomous AI agents: which is safer for a UAE company?', kind: 'compare', topic: 'agentic ai development in uae', keyword: 'governed vs autonomous ai agents' },
      { prompt_id: 'q_engage', prompt: 'Fixed-price vs dedicated team: which engagement model suits an AI project?', kind: 'compare', topic: 'engagement models', keyword: 'ai project engagement models' },
      { prompt_id: 'q_cost', prompt: 'How much does AI automation cost for a mid-sized company in the UAE?', kind: 'cost', topic: 'ai automation services', keyword: 'ai automation cost uae' },
      { prompt_id: 'q_aside', prompt: 'Which government portal registers AI companies?', kind: 'recommend', topic: 'ai automation services', keyword: 'government ai registration portal' }]
      .map(p => ({ source: 'auto', stage: 'decision', cluster: p.topic, persona: 'CEO', market: 'AE-en', volume: { q_cost: 500, q_govern: 400, q_dubai: 300, q_aside: 200 }[p.prompt_id] || 50, origin: 'writer', created_at: '2026-10-01', ...p }));
    const row = (pid, topic, i) => ({ site_id: SID, domain: DOM, run_id: 'ai_cq1', checked_at: NOW, prompt_id: pid, prompt: P.find(p => p.prompt_id === pid).prompt, kind: P.find(p => p.prompt_id === pid).kind, topic, engine: ['chatgpt', 'perplexity', 'ai_mode', 'gemini'][i % 4],
      answered: true, mentioned: false, cited: false, rank: 0, our_urls: '', competitors: 'rival-ai.example', sources: '', excerpt: '', cost: 0.004, error: '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '[]',
      named: false, position: null, entities: J([{ id: 'rival-ai.example', name: 'Rival AI', role: 'competitor', position: 1, cited: false }]) });
    const rows = []; for (const p of P) for (let i = 0; i < 5; i++) rows.push(row(p.prompt_id, p.topic, i));
    const plan = [{ json: { site_id: SID, domain: DOM, canonical_host: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', country_iso: 'AE', email: '', callback_url: '', request_id: '', on_demand: false, adhoc: false,
      business_name: 'Devaicon', business_type: '', city: 'Sharjah', profile: {}, services: [], business_facts: [], accreditation: '', brand_names: [DOM, 'Devaicon'], competitors: ['rival-ai.example'], configured_competitors: ['rival-ai.example'], aliases: {},
      topics: ['ai automation services'], engines: ['chatgpt', 'perplexity', 'ai_mode', 'gemini'], prompts_max: 20, pulse: false, prompts: P, full_due: false, run_kind: 'weekly', monthly_engines: [], carried: null, need_prompts: false, prompts_needed: 0,
      need_site_text: false, gsc_questions: [], discovery_due: false, volume_keywords: [], index_due: false, market_due: false, market_keyword: 'ai automation services', ga4_property_id: '', pulse_rows: [], key_paths: [], set_aside: [], set_aside_note: '',
      pulse_window: { from: day(7), to: NOW, days: 7 }, previous: null, run_id: 'ai_cq1', checked_at: NOW } }];
    const tid = (pid) => 'ait_devaicon-com_' + pid;
    const drive = async (targets, logs) => { reset(); mock('AI Plan', plan); mock('Apply Analysis', rows.map(r => ({ json: r }))); mock('AI Requests', [{ json: { site_id: SID, engine: 'chatgpt' } }]); mock('Run AI Requests', [{ json: {} }]);
      mock('Load AI Targets (AI)', items(targets)); mock('Load Content Log (AI)', items(logs)); return (await run('AI Metrics', store['Apply Analysis']))[0].json; };
    const A = await drive([], []);
    const act = (X, re) => (X.actions || []).find(a => a.type === 'content' && re.test(a.action));
    const dubai = act(A, /Dubai/);
    console.log('   actions ->', J((A.actions || []).filter(a => /content|publish/.test(a.type)).map(a => [a.type, a.action.slice(0, 50), a.api_body && a.api_body.keyword, a.api_body && a.api_body.page_type])));
    check('F1: the Dubai question\'s page is written for its own search "best ai automation services dubai", never the panel topic "ai automation services"', dubai && dubai.api_body.keyword === 'best ai automation services dubai' && dubai.keyword === 'best ai automation services dubai'
      && dubai.api_body.ai_target && dubai.api_body.ai_target.kind === 'answer' && dubai.api_body.ai_target.target_id === tid('q_dubai'), J(dubai));
    const cmp = act(A, /Governed|engagement/);
    check('F13: a comparison question is written as a Guide (the form has no "Comparison Page")', cmp && cmp.api_body.page_type === 'Guide' && (A.actions || []).every(a => !a.api_body || ['Guide', 'Service Page'].includes(a.api_body.page_type)), J(cmp && cmp.api_body));
    const G0 = JSON.parse(A.vis_row.gaps_json || '[]');
    check('gaps_json carries each question\'s own keyword beside its topic', G0.length >= 4 && G0.every(g => g.keyword && g.topic) && G0.find(g => g.prompt_id === 'q_dubai').keyword === 'best ai automation services dubai', J(G0.map(g => [g.prompt_id, g.keyword, g.topic])));
    // what is already decided
    const B = await drive([
      { target_id: tid('q_dubai'), site_id: SID, status: 'written', kind: 'answer', keyword: 'best ai automation services dubai', request_id: '12467' },
      { target_id: tid('q_cost'), site_id: SID, status: 'queued', kind: 'refresh', keyword: 'ai automation cost uae', page_url: D + '/insights/ai-automation-cost-uae' },
      { target_id: tid('q_aside'), site_id: SID, status: 'set_aside', kind: 'answer', keyword: 'government ai registration portal' }],
      [{ site_id: SID, domain: DOM, keyword: 'best ai automation services dubai', request_id: '12467', status: 'written', started_at: '2026-11-10T14:54:00.000Z' }]);
    console.log('   decided ->', J((B.actions || []).filter(a => /content|publish/.test(a.type)).map(a => [a.type, a.action.slice(0, 60), a.api_body && a.api_body.existing_page_url])));
    check('F5: a question whose page is written gets "Publish your page", never a second "Write the page" (no api_body)', (B.actions || []).some(a => a.type === 'publish' && /Dubai/.test(a.action) && !a.api_body) && !act(B, /Dubai/), J(B.actions.filter(a => /Dubai/.test(a.action))));
    const cost = act(B, /cost/i);
    check('F5: AI Growth\'s refresh: "Improve /insights/ai-automation-cost-uae", existing page and AI target kind refresh, a Guide for an /insights/ page', cost && /^Improve \/insights\/ai-automation-cost-uae/.test(cost.action) && cost.api_body.existing_page_url === D + '/insights/ai-automation-cost-uae'
      && cost.api_body.ai_target.kind === 'refresh' && cost.api_body.page_type === 'Guide', J(cost));
    check('F5: a question set aside gets no content action', !(B.actions || []).some(a => /government/i.test(a.action)), J(B.actions.map(a => a.action)));
    const G1 = JSON.parse(B.vis_row.gaps_json || '[]');
    check('gaps_json carries the stored target state and its page', G1.find(g => g.prompt_id === 'q_dubai').target_status === 'written' && G1.find(g => g.prompt_id === 'q_cost').page_url === D + '/insights/ai-automation-cost-uae', J(G1.map(g => [g.prompt_id, g.target_status, g.page_url])));
    const C = await drive([], [{ site_id: SID, domain: DOM, keyword: 'best ai automation services dubai', request_id: '12467', status: 'published', published_url: D + '/insights/ai-automation-services-uae', published_at: '2026-11-12T10:00:00.000Z', started_at: '2026-11-10T14:54:00.000Z' }]);
    check('F5: an app page for the question that is already live (found by its keyword, no target row): no action for it at all', !(C.actions || []).some(a => /Dubai/.test(a.action)), J((C.actions || []).map(a => a.action)));
  });

  // ===================================================================================================================================
  await guard('CQ2 Parse Verdict AI duplicate', async () => {
    reset(); const SN = 'CQ2 (INV1 F2 / F3 / F10) Parse Verdict: one search, one page for AI pages too, on the question\'s own search; another market is advice; the requested type stays'; begin(SN); const check = mkCheck(SN);
    const R = require('./replay')(H);
    const F = R.load('replay_3299.json.gz'); const PB = F.nodes['Parse Brief']['0'].items[0].json;
    const PREV = (() => { const p = JSON.parse(JSON.stringify(PB)); for (const k of ['verdict_hold', 'would_hold', 'hold', 'hold_shadow', 'hold_ack', 'verdict_acknowledged', 'duplicate_check']) delete p[k]; p.client_ip = 'app:0b1c2d3e-anon'; return p; })();
    const AGENT = { verdict: 'GO_WITH_CHANGES', score: 48, reasons: ['A crowded search with service providers in the results.'], risks: [], what_must_change: [], secondary_keywords: [], recommended_page: 'Service Page', expected_monthly_visits_top3: 1, time_to_rank_months: 6 };
    const pv = async (over) => { reset(); mock('Merge Keyword Data', [{ json: { ...PREV, existing_page: null, existing_page_url: '', ...(over || {}) } }]); mock('Load Site Cache', [{ json: {} }]);
      return (await run('Parse Verdict', [{ json: { output: { ...AGENT } } }]))[0].json; };
    const AIT = (q) => ({ question: q, kind: 'answer', target_id: 'ait_x_q', fanout: [], competitors: ['rival.example'], sources: [] });
    const devModel = { ...PB.site_model, domain: 'devaicon.com', canonical_host: 'devaicon.com', pages: [
      { url: D + '/services/ai-automation-services-pakistan', title: 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', h1: 'AI automation services in Pakistan', source: 'sitemap' },
      { url: D + '/services/engagement-models', title: 'Engagement Models | Outsourcing, Dedicated Teams | Devaicon', h1: 'Engagement models', source: 'sitemap' },
      { url: D + '/', title: 'Devaicon | Software and AI', h1: '', source: 'sitemap' }] };
    // (a) devaicon: the Dubai question beside the Pakistan service page
    const a = await pv({ keyword: 'best ai automation services dubai', domain: 'devaicon.com', country: 'United Arab Emirates', page_type: 'Guide', site_model: devModel, own_coverage: null, ai_target: AIT('Which companies offer the best AI automation services for businesses in Dubai?') });
    console.log('   devaicon ->', J({ w: a.would_hold, dup: (a.duplicate_check || {}).targets, type: a.recommended_page, notes: a.page_notes }));
    check('devaicon: the Pakistan service page is another market\'s page, so the Dubai question\'s page is written (no hold)', a.would_hold === false && a.verdict_hold === false && ((a.duplicate_check || {}).targets || []).length === 0 && (a.duplicate_check || {}).checked === true, J(a.duplicate_check));
    check('F10: the AI guide stays a Guide although the verdict recommended a "Service Page"', a.recommended_page === 'Guide', a.recommended_page);
    // (b) techand: "best crm service provider uae" beside the ladder's live page for "crm service provider"
    const tModel = { ...PB.site_model, domain: 'techand.ai', canonical_host: 'www.techand.ai', pages: [
      { url: T + '/dynamics-365-crm-uae', title: 'Dynamics 365 CRM in Dubai & UAE: Sales and Service | Tech&', h1: 'Dynamics 365 CRM Services in Dubai and the UAE', source: 'sitemap', http_status: 200 },
      { url: T + '/insights/crm-for-customers', title: 'CRM for Customers: How to Choose One in the UAE | Tech&', h1: '', source: 'sitemap' }] };
    const cov = { read: { ladders: true, drafts: true, pages: true }, drafts: [], pages: [], self: { ladder_id: '', keyword: 'best crm service provider uae', target_url: '' },
      ladders: [{ ladder_id: 'lad_crm01', head_keyword: 'crm service provider', keyword: 'crm service provider', rung: 4, part: 'head', status: 'planned', ladder_status: null, target_url: T + '/dynamics-365-crm-uae', supporting: [] },
        { ladder_id: 'lad_crm01', head_keyword: 'crm service provider', keyword: 'crm for customers', rung: 2, part: 'rung', status: 'published', ladder_status: null, target_url: T + '/insights/crm-for-customers', supporting: [] }] };
    const tb = { keyword: 'best crm service provider uae', domain: 'techand.ai', country: 'United Arab Emirates', page_type: 'Guide', site_model: tModel, own_coverage: cov, ai_target: AIT('Who are the best CRM service providers in the UAE for a growing real estate company?') };
    const b = await pv(tb);
    const alts = ((b.hold || {}).alternatives || []);
    console.log('   techand ->', J({ held: b.verdict_hold, kinds: (b.hold || {}).kinds, alts: alts.map(x => [x.kind, x.label, x.url]), reasons: (b.hold || {}).reasons }));
    check('techand: held for the client (a person started it): the ladder\'s live CRM page owns the question\'s search', b.verdict_hold === true && b.hold_mode === 'enforce' && (b.hold.kinds || []).includes('duplicate'), J({ h: b.verdict_hold, k: (b.hold || {}).kinds }));
    check('the first way forward improves /dynamics-365-crm-uae FOR THE QUESTION (same AI target, kind refresh, that page as the existing page)', alts[0] && alts[0].kind === 'ai_refresh' && alts[0].url === T + '/dynamics-365-crm-uae' && alts[0].existing_page_url === T + '/dynamics-365-crm-uae'
      && alts[0].ai_target && alts[0].ai_target.kind === 'refresh' && /Improve \/dynamics-365-crm-uae for this question/.test(alts[0].label) && alts[0].page_type === 'Guide', J(alts[0]));
    check('the reason says it in plain words (no long dash, no curly quote)', (b.hold.reasons || []).some(r => /is already the page for "best crm service provider uae"/.test(r) && /improve that page for the question/.test(r)) && !/[—–…“”]/.test((b.hold.reasons || []).join(' ') + alts.map(x => x.label + x.why).join(' ')), J(b.hold.reasons));
    const ack = await pv({ ...tb, hold_ack: { score: 48 } });
    check('"Write it anyway": written, not held', ack.verdict_hold === false && ack.would_hold === false && ack.verdict_acknowledged === true, J({ h: ack.verdict_hold }));
    const auto = await pv({ ...tb, client_ip: 'cadence:site_techand-ai', force_content: true, pipeline_source: 'cadence' });
    check('an automatic run records it (shadow), it does not stop the page (the plan already turns such a question into a refresh)', auto.would_hold === true && auto.verdict_hold === false && auto.hold_mode === 'shadow' && auto.hold_shadow && auto.hold_shadow.alternatives[0].kind === 'ai_refresh', J({ w: auto.would_hold, m: auto.hold_mode }));
    // (c) a question no page answers
    const c = await pv({ ...tb, keyword: 'governed vs autonomous ai agents', ai_target: AIT('Governed agentic AI vs fully autonomous AI agents: which is safer?') });
    check('a question no page of the site owns: written as a new answer page (no hold, no duplicate)', c.would_hold === false && ((c.duplicate_check || {}).targets || []).length === 0, J({ w: c.would_hold, d: c.duplicate_check }));
    // (d) the same AI question started as a refresh of the owning page (the alternative above): a refresh of the page is never its own duplicate
    const d = await pv({ ...tb, existing_page_url: T + '/dynamics-365-crm-uae', ai_target: { ...tb.ai_target, kind: 'refresh' } });
    check('the refresh of /dynamics-365-crm-uae for the question: not held', d.would_hold === false && d.verdict_hold === false, J({ w: d.would_hold, e: d.hold_exempt }));
  });

  // ===================================================================================================================================
  await guard('CQ3 grade fit', async () => {
    reset(); const SN = 'CQ3 (INV1 F10) the grade: an AI page\'s fit is not cut by a low verdict (it was chosen for the question); an open duplicate still caps it'; begin(SN); const check = mkCheck(SN);
    const GR = kitFrom('_grade.js', 'GR');
    const base = { verdict_score: 48, ai_target: { question: 'Which companies offer the best AI automation services in Dubai?', kind: 'answer' } };
    const ai = GR.fit(GR.fitOf(base), {}, 20), plain = GR.fit(GR.fitOf({ verdict_score: 48 }), {}, 20), dup = GR.fit(GR.fitOf(base), { open: true }, 20);
    console.log('   fit ->', J({ ai: [ai.points, ai.caps.map(c => c.why)], plain: [plain.points, plain.caps.length], dup: [dup.points, dup.caps.map(c => c.why)] }));
    check('AI page, verdict 48: full fit (20 of 20), no verdict cap, the score kept in the note', ai.points === 20 && !ai.caps.length && /48 out of 100/.test(ai.note) && ai.band === 'full', J(ai));
    check('control: a plain page at 48 keeps the verdict cap', plain.points < 20 && plain.caps.some(c => /verdict/.test(c.why)), J(plain));
    check('an AI page beside the page that owns its search keeps both limits (no duplicate points, the verdict share as before)', dup.duplicate_points === 0 && dup.verdict_points < 10 && dup.points <= 20 * GR.SHARE.fit_duplicate, J(dup));
  });

  // ===================================================================================================================================
  await guard('CQ4 content log row', async () => {
    reset(); const SN = 'CQ4 (INV1 F6 / F4) Content Log Row: an AI run is ai_answer / ai_refresh whoever started it; the row keeps the page as written'; begin(SN); const check = mkCheck(SN);
    const NI = { domain: 'devaicon.com', keyword: 'best ai automation services dubai', request_id: '12467', client_ip: 'app:company-anon', page_type: 'Guide', ai_target: { question: 'Which companies offer the best AI automation services in Dubai?', kind: 'answer' } };
    const PKG = { keyword: NI.keyword, article_html: '<h1>x</h1>', article_slug: 'ai-automation-services-uae', article_title: 'AI Automation Services in the UAE: A Buyer\'s Guide',
      article_meta: { slug: 'ai-automation-services-uae', title: 'AI Automation Services in the UAE: A Buyer\'s Guide', h1: 'AI Automation Services in the UAE: A Buyer\'s Guide to Choosing a Provider', quality: { not_ready: false } }, qa_not_ready: false };
    const row = async (ni, stored) => { reset(); mock('Normalize Input', [{ json: ni }]); mock('Parse Verdict', [{ json: {} }]); mock('Blog Package', [{ json: PKG }]);
      mock('Load Content Log (Run)', items(stored)); return (await run('Content Log Row', store['Load Content Log (Run)']))[0].json; };
    const r1 = await row(NI, [{ site_id: 'site_devaicon-com', domain: 'devaicon.com', keyword: NI.keyword, source: 'app', status: 'started', request_id: '12467', started_at: '2026-11-10T14:54:00.000Z' }]);
    check('an app-started AI page: source ai_answer (the app opened it as "app")', r1.source === 'ai_answer' && r1.status === 'written', J({ s: r1.source, st: r1.status }));
    check('the page as written: planned slug, title and H1', r1.planned_slug === 'ai-automation-services-uae' && /Buyer's Guide$/.test(r1.planned_title) && /to Choosing a Provider$/.test(r1.planned_h1), J([r1.planned_slug, r1.planned_title, r1.planned_h1]));
    const r2 = await row({ ...NI, existing_page_url: T + '/dynamics-365-crm-uae', ai_target: { ...NI.ai_target, kind: 'refresh' } }, []);
    check('an AI refresh: ai_refresh', r2.source === 'ai_refresh', r2.source);
    const r3 = await row({ ...NI, ladder_id: 'lad_1', ladder_rung: 4 }, [{ site_id: 'site_devaicon-com', domain: 'devaicon.com', keyword: NI.keyword, source: 'ladder', status: 'started', request_id: '12467', started_at: '2026-11-10T14:54:00.000Z' }]);
    check('a ladder page that also answers a question stays a ladder page', r3.source === 'ladder', r3.source);
    const r4 = await row({ ...NI, ai_target: null }, []);
    check('control: a plain app page stays "app"', r4.source === 'app', r4.source);
  });

  // ===================================================================================================================================
  await guard('CQ5 publish detection', async () => {
    reset(); const SN = 'CQ5 (INV1 F4, Site Tracker exec 13492) the AI guide is never recorded live at the client\'s moved service page; found at its own slug or by its written title'; begin(SN); const check = mkCheck(SN);
    const SITE = 'site_devaicon-com', DOM = 'devaicon.com';
    const log = (o) => ({ site_id: SITE, domain: DOM, keyword: 'ai automation services', source: 'ai_answer', request_id: '12467', status: 'written', started_at: '2026-11-10T14:54:00.000Z', ...(o || {}) });
    const W = { planned_slug: 'ai-automation-services-uae', planned_title: 'AI Automation Services in the UAE: A Buyer\'s Guide', planned_h1: 'AI Automation Services in the UAE: A Buyer\'s Guide to Choosing a Provider' };
    const cand = (lg) => ({ key: 'ai automation services', keyword: 'ai automation services', source: 'content_log', log: lg, ladder: null, written_at: lg.started_at, existing_url: '', planned_url: '', ladder_id: '',
      planned_slug: lg.planned_slug || '', planned_title: lg.planned_title || '', planned_h1: lg.planned_h1 || '', qa_failed: false });
    const owner = D + '/ai-automation-services-pakistan';
    const detect = async (lg, urls, pages) => { reset();
      const sm = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => '<url><loc>' + u + '</loc></url>').join('') + '</urlset>';
      mock('Publish Candidates', [{ json: { site_idx: 0, site_id: SITE, domain: DOM, sitemap_url: D + '/sitemap.xml', candidates: [cand(lg)], known: [owner], owners: [{ url: owner, keyword: 'ai automation services pakistan' }], detect: true } }]);
      mock('Fetch Sitemap (Detect)', [{ json: { statusCode: 200, data: sm } }]); mock('Load Pages (Site)', [{ json: {} }]); mock('Load AI Pages (Site)', [{ json: {} }]);
      const ms = (await run('Match Slugs (Detect)', store['Publish Candidates'])).map(x => x.json);
      const fetched = ms.filter(x => x.fetch).map(x => x.url);
      mock('Fetch Pages (Detect)', fetched.map(u => ({ json: (pages || {})[u] ? { statusCode: 200, data: '<html><head><title>' + pages[u][0] + '</title></head><body><h1>' + pages[u][1] + '</h1></body></html>' } : { statusCode: 200, data: '<html><head><title>Other | Devaicon</title></head><body><h1>Other</h1></body></html>' } })));
      if (!fetched.length) mock('Fetch Pages (Detect)', [{ json: {} }]);
      const det = (await run('Detect Published', store['Fetch Pages (Detect)']))[0].json; return { ms, fetched, det }; };
    const MOVED = D + '/services/ai-automation-services-pakistan';
    const live = { [MOVED]: ['AI Automation Services in Pakistan | ISO 27001 | Devaicon', 'AI automation services in Pakistan'] };
    const x0 = await detect(log(), [D + '/', MOVED, D + '/services/engagement-models'], live);
    console.log('   old row ->', J({ fetched: x0.fetched, detected: x0.det.detected, unmatched: x0.det.unmatched }));
    const opts0 = ((((x0.ms[0] || {}).sites || [])[0] || {}).title_checks || []).flatMap(c => (c.options || []).map(o => o.url));
    check('a row with no written title (written before): the moved service page is not a candidate for its title check, and nothing is recorded', !opts0.includes(MOVED) && !(x0.det.detected || []).length, J({ opts: opts0, d: x0.det.detected }));
    const x1 = await detect(log(W), [D + '/', MOVED, D + '/insights/ai-automation-services-uae'], live);
    check('with the written slug: found at /insights/ai-automation-services-uae (slug), never at the service page', (x1.det.detected || []).length === 1 && x1.det.detected[0].url === D + '/insights/ai-automation-services-uae' && x1.det.detected[0].matched_by === 'slug', J(x1.det.detected));
    const GUIDE = D + '/insights/ai-automation-services-guide-uae', OTHER = D + '/blog/ai-automation-services-dubai';
    const x2 = await detect(log(W), [D + '/', MOVED, OTHER, GUIDE], { ...live, [GUIDE]: ['AI Automation Services in the UAE: A Buyer\'s Guide | Devaicon', 'AI Automation Services in the UAE: A Buyer\'s Guide to Choosing a Provider'],
      [OTHER]: ['AI Automation Services: Pricing for Dubai Companies | Devaicon', 'AI automation services pricing'] });
    console.log('   written title ->', J({ fetched: x2.fetched, detected: x2.det.detected }));
    check('by its written title: the page whose title IS the written one is found; a page that only carries the keyword is not', (x2.det.detected || []).length === 1 && x2.det.detected[0].url === GUIDE && x2.det.detected[0].matched_by === 'title', J(x2.det.detected));
  });

  // ===================================================================================================================================
  await guard('CQ6 AI Growth targets', async () => {
    reset(); const SN = 'CQ6 (INV1 F5 / F7 / F8 / F9 / F11) AI Growth: own topics, markets, the page that owns a search, the fold rule, the state from the content log, reason codes'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_devaicon-com', DOM = 'devaicon.com';
    const SVC = ['AI automation services', 'Agentic AI development', 'Open edX development', 'Custom software development', 'Cloud and Microsoft enterprise systems', 'Managed IT support'];
    const gap = (pid, prompt, topic, kind) => ({ prompt_id: pid, prompt, kind: kind || 'recommend', topic, competitors: ['rival-ai.example'], sources: [], volume: 40, stage: 'decision', cluster: topic, fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } });
    const G = [gap('q_dubai', 'Which companies offer the best AI automation services for businesses in Dubai?', 'ai automation services'),
      gap('q_engage', 'Fixed-price vs dedicated team vs time-and-material: which engagement model suits an AI software project?', 'engagement models', 'compare'),
      gap('q_bestengage', 'What engagement model works best for a small business starting its first AI project?', 'engagement models', 'choose'),
      gap('q_agentic', 'Who are the top agentic AI development companies in the UAE for building autonomous business agents?', 'agentic ai development in uae'),
      gap('q_govern', 'Governed agentic AI vs fully autonomous AI agents: which is safer for a UAE company?', 'agentic ai development in uae', 'compare'),
      gap('q_failed', 'How much does AI automation cost for a mid-sized company in the UAE?', 'ai automation services', 'cost')];
    const P = [['q_dubai', 'best ai automation services dubai', 'ai automation services', 'ladder:lad_pk'], ['q_engage', 'ai project engagement models', 'engagement models', 'page'], ['q_bestengage', 'best engagement model ai project', 'engagement models', 'page'],
      ['q_agentic', 'agentic ai development companies uae', 'agentic ai development in uae', 'ladder:lad_ag'], ['q_govern', 'governed vs autonomous ai agents', 'agentic ai development in uae', 'ladder:lad_ag'], ['q_failed', 'ai automation cost uae', 'ai automation services', 'ladder:lad_pk']]
      .map(([prompt_id, keyword, topic, src]) => ({ json: { site_id: SID, status: 'active', prompt_id, prompt: G.find(g => g.prompt_id === prompt_id).prompt, keyword, topic, focus_topic: topic, focus_source: src, focus_state: 'active', kind: 'recommend' } }));
    const LAD = [
      { ladder_id: 'lad_pk', domain: DOM, head_keyword: 'ai automation services pakistan', rung: 4, page_no: 0, keyword: 'ai automation services pakistan', target_url: D + '/ai-automation-services-pakistan', page_exists: true, status: 'published', country: 'Pakistan' },
      { ladder_id: 'lad_pk', domain: DOM, head_keyword: 'ai automation services pakistan', rung: 2, page_no: 1, keyword: 'ai development companies', target_url: D + '/ai-development-companies', page_exists: false, status: 'planned' },
      { ladder_id: 'lad_ag', domain: DOM, head_keyword: 'agentic ai development in uae', rung: 4, page_no: 0, keyword: 'agentic ai development in uae', target_url: D + '/services/agentic-ai-development-in-uae', page_exists: false, status: 'planned' },
      { ladder_id: 'lad_ag', domain: DOM, head_keyword: 'agentic ai development in uae', rung: 2, page_no: 1, keyword: 'ai app development companies', target_url: D + '/ai-app-development-companies', page_exists: false, status: 'written' }];
    const tid = (pid) => 'ait_devaicon-com_' + pid;
    const TGT = [
      { target_id: tid('q_agentic'), site_id: SID, domain: DOM, prompt_id: 'q_agentic', keyword: 'agentic ai development companies uae', kind: 'answer', status: 'written', request_id: 'cad_20261106_devaicon-com_2', written_at: '2026-11-06T01:28:11.144Z' },
      { target_id: tid('q_govern'), site_id: SID, domain: DOM, prompt_id: 'q_govern', keyword: 'governed vs autonomous ai agents', kind: 'answer', status: 'writing', request_id: 'cad_20261113_devaicon-com_2', written_at: day(3) },
      { target_id: tid('q_failed'), site_id: SID, domain: DOM, prompt_id: 'q_failed', keyword: 'ai automation cost uae', kind: 'answer', status: 'writing', request_id: 'cad_20261112_devaicon-com_3', written_at: day(4) }];
    const LOG = [
      { site_id: SID, domain: DOM, keyword: 'ai app development companies', source: 'ladder', request_id: 'cad_20261106_devaicon-com_2', status: 'written', started_at: '2026-11-06T01:28:11.144Z' },
      { site_id: SID, domain: DOM, keyword: 'governed vs autonomous ai agents', source: 'ai_answer', request_id: 'cad_20261113_devaicon-com_2', status: 'published', published_url: D + '/insights/governed-vs-autonomous-ai-agents', published_at: day(2), started_at: day(3) },
      { site_id: SID, domain: DOM, keyword: 'ai automation cost uae', source: 'ai_answer', request_id: 'cad_20261112_devaicon-com_3', status: 'failed', started_at: day(4) },
      { site_id: SID, domain: DOM, keyword: 'engagement models', source: 'app', request_id: '7491', status: 'published', published_url: D + '/services/engagement-models', published_at: day(20), started_at: day(22) }];
    const INV = [{ site_id: SID, url: D + '/services/ai-automation-services-pakistan', title: 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', h1: 'AI automation services in Pakistan', http_status: 200 },
      { site_id: SID, url: D + '/services/engagement-models', title: 'Engagement Models | Outsourcing, Dedicated Teams | Devaicon', h1: 'Engagement models', http_status: 200 }];
    const QH = [{ site_id: SID, page: D + '/services/ai-automation-services-pakistan', query: 'ai automation services', impressions: 300, clicks: 4, position: 9, period_end: '2026-11-10' },
      { site_id: SID, page: D + '/services/ai-automation-services-pakistan', query: 'best ai automation services', impressions: 120, clicks: 1, position: 14, period_end: '2026-11-10' }];
    reset();
    mock('Load Sites', [{ json: { site_id: SID, domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', canonical_host: DOM, declared_services: JSON.stringify(SVC), services_json: JSON.stringify(SVC) } }]);
    mock('Load Ladders', LAD.map(j => ({ json: j }))); mock('Load Monitors', [{ json: { site_id: SID, domain: DOM, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]); mock('Load Cycles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: { site_id: SID, domain: DOM, run_id: 'ai_cq6', checked_at: day(1), gaps_json: J(G), pages_json: '[]', competitors_json: J([{ domain: 'rival-ai.example', mentions: 3, auto: true }]) } }]);
    mock('Load AI Prompts', P); mock('Load Content Log', LOG.map(j => ({ json: j }))); mock('Load Query History', QH.map(j => ({ json: j }))); mock('Load AI Pages', [{ json: {} }]);
    mock('Load AI Targets', TGT.map(j => ({ json: j }))); mock('Load AI Growth', [{ json: {} }]); mock('Load AI Answers', [{ json: {} }]); mock('Load Cache (Growth)', [{ json: {} }]); mock('Load Link Prospects (Growth)', [{ json: {} }]);
    mock('Load Pages (Growth)', INV.map(j => ({ json: j })));
    const GP = (await run('Growth Plan', store['Load Cache (Growth)']))[0].json;
    const t = (pid) => (GP.targets || []).find(x => x.prompt_id === pid) || {};
    console.log('   targets ->', J((GP.targets || []).map(x => [x.prompt_id, x.status, x.kind, x.page_url, x.reason_code])));
    check('F9: "ai project engagement models" and "best engagement model ai project" are on the client\'s topic (its own page and panel topic): not set aside', !['set_aside'].includes(t('q_engage').status) && !['set_aside'].includes(t('q_bestengage').status), J([t('q_engage'), t('q_bestengage')].map(x => [x.status, x.reason])));
    check('F9: the engagement questions are a refresh of the client\'s own /services/engagement-models (it owns that search)', t('q_engage').kind === 'refresh' && t('q_engage').page_url === D + '/services/engagement-models', J(t('q_engage')));
    check('F5: the Dubai question is never matched to the Pakistan page (another market): a new answer page, reason code new_page', t('q_dubai').kind === 'answer' && !/pakistan/.test(t('q_dubai').page_url) && t('q_dubai').reason_code === 'new_page', J(t('q_dubai')));
    check('F7 / F8: question 37 was "written" as the ladder page of ANOTHER search: it is queued again for a page of its own, and says why', t('q_agentic').status === 'queued' && /another search/.test(t('q_agentic').reason) && !t('q_agentic').request_id, J(t('q_agentic')));
    check('F7: it is handed to the ladder\'s main page "agentic ai development in uae" (the question carries all of its words), never to the rung "ai app development companies"', /agentic ai development in uae/.test(t('q_agentic').reason) && t('q_agentic').reason_code === 'ladder_page', J([t('q_agentic').reason, t('q_agentic').reason_code]));
    check('F8: question 41 "writing" whose page is published: written, code live, with its address', t('q_govern').status === 'written' && t('q_govern').reason_code === 'live' && JSON.parse(t('q_govern').reason_args).page_url === D + '/insights/governed-vs-autonomous-ai-agents', J(t('q_govern')));
    check('F8: a page run that FAILED puts its question back in the queue now (run_failed), not after 14 days', t('q_failed').status === 'queued' && t('q_failed').reason_code === 'run_failed' && !t('q_failed').request_id, J(t('q_failed')));
    check('F11: every row carries a reason code the contract knows, its args as JSON, and a reason in plain words (no ids, table names, money, long dashes)',
      (GP.targets || []).every(x => x.reason_code && typeof x.reason_args === 'string' && JSON.parse(x.reason_args) && !FORBIDDEN.test(String(x.reason || ''))), J((GP.targets || []).filter(x => !x.reason_code || FORBIDDEN.test(String(x.reason || ''))).map(x => [x.prompt_id, x.reason])));
  });

  // ===================================================================================================================================
  await guard('CQ7 cadence marks and settle', async () => {
    reset(); const SN = 'CQ7 (INV1 F8 / F11) AI Target Marks / Settle: plain reasons with codes, a failed run queued at once, another search\'s ladder page is not the question\'s page; the idle branch settles too'; begin(SN); const check = mkCheck(SN);
    const S7 = 'site_x', D7 = 'x.example';
    mock('Cadence Plan', [{ json: { site_id: S7, domain: D7, keyword: 'what is peppol', source: 'ai_answer', target_id: 'ait_1', request_id: 'cad_20261116_x-example_1', body: { request_id: 'cad_20261116_x-example_1' } } }]);
    mock('Start Content Runs', [{ json: { ok: true } }]);
    const m = (await run('AI Target Marks', [{ json: {} }]))[0].json;
    check('marked writing with the run id in request_id, and a plain reason with its code (no run id, no table name, no long dash)', m.status === 'writing' && m.request_id === 'cad_20261116_x-example_1' && m.reason_code === 'writing' && !FORBIDDEN.test(m.reason), J(m));
    const tg = (id, rid, kw) => ({ json: { target_id: id, site_id: S7, domain: D7, question: 'q', keyword: kw || '', status: 'writing', request_id: rid, written_at: '2026-11-06T01:00:00.000Z' } });
    const lg = (rid, status, o) => ({ json: { site_id: S7, domain: D7, keyword: 'k ' + rid, request_id: rid, status, started_at: '2026-11-06T01:00:00.000Z', ...(o || {}) } });
    mock('Load AI Targets Writing (Cadence)', [tg('ait_pub', 'r1'), tg('ait_fail', 'r2'), tg('ait_fold', 'r3', 'agentic ai development companies uae'), tg('ait_same', 'r4', 'best e invoicing software uae')]);
    mock('Load Content Log', [lg('r1', 'published', { published_url: 'https://x.example/peppol', published_at: '2026-11-07T10:00:00.000Z' }), lg('r2', 'failed'),
      lg('r3', 'written', { source: 'ladder', keyword: 'ai app development companies' }), lg('r4', 'written', { source: 'ladder', keyword: 'e invoicing software in uae' })]);
    mock('Cadence Plan', [{ json: { nothing_to_do: true, report_only: true, site_id: S7, domain: D7 } }]);
    for (const node of ['AI Target Settle', 'AI Target Settle (Idle)']) {
      const out = (await run(node, [{ json: {} }])).map(i => i.json); const by = (id) => out.find(o => o.target_id === id) || {};
      console.log('   ' + node + ' ->', J(out.map(o => [o.target_id, o.status, o.reason_code])));
      check(node + ': published -> written (code live, its address), failed -> queued (run_failed), a ladder page of another search -> queued, the same search in other words -> written',
        by('ait_pub').status === 'written' && by('ait_pub').reason_code === 'live' && /x\.example\/peppol/.test(by('ait_pub').reason_args)
        && by('ait_fail').status === 'queued' && by('ait_fail').reason_code === 'run_failed' && by('ait_fold').status === 'queued' && /another search/.test(by('ait_fold').reason)
        && by('ait_same').status === 'written', J(out));
      check(node + ': every reason in plain words', out.every(o => !FORBIDDEN.test(String(o.reason || ''))), J(out.map(o => o.reason)));
    }
    // the wiring: the idle settle hangs off "nothing to write", behind its own IF, and writes the reason code too
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Content_Cadence.json'), 'utf8'))[0];
    const down = (n, i) => (((wf.connections[n] || {}).main || [])[i || 0] || []).map(x => x.node);
    const vals = (n) => ((wf.nodes.find(x => x.name === n) || {}).parameters || {}).columns || {};
    const ifc = J(((wf.nodes.find(x => x.name === 'Settle Idle?') || {}).parameters || {}).conditions || {});
    check('wiring: Any Pages? (false) -> Settle Idle? (not a dry run, not a preview) -> AI Target Settle (Idle) -> Any AI Settles (Idle)? -> Settle AI Targets (Idle)', down('Any Pages?', 1).includes('Settle Idle?') && down('Settle Idle?', 0).includes('AI Target Settle (Idle)')
      && down('AI Target Settle (Idle)').includes('Any AI Settles (Idle)?') && down('Any AI Settles (Idle)?', 0).includes('Settle AI Targets (Idle)') && /dry_run/.test(ifc) && /preview/.test(ifc), J({ a: down('Any Pages?', 1), ifc }));
    check('both settle writers and the mark write reason_code / reason_args', ['Settle AI Targets', 'Settle AI Targets (Idle)', 'Mark AI Target Writing'].every(n => (vals(n).value || {}).reason_code === '={{ $json.reason_code }}' && (vals(n).value || {}).reason_args === '={{ $json.reason_args }}'), J(vals('Settle AI Targets (Idle)')));
  });

  // ===================================================================================================================================
  await guard('CQ8 plain words', async () => {
    reset(); const SN = 'CQ8 (INV1 F11) AQ: every reason code has a plain sentence; clean() takes ids, table names, lever ids, money and long dashes out; LRU folds only the same search'; begin(SN); const check = mkCheck(SN);
    const AQ = kitFrom('Growth_Plan.js', 'AQ');
    const say = AQ.CODES.map(c => [c, AQ.reason(c, { page_url: 'https://x.example/services/a', keyword: 'k', date: '2026-11-13' })]);
    check('every code has a sentence, none with a forbidden token', say.every(([, t]) => t && !FORBIDDEN.test(t)), J(say.filter(([, t]) => !t || FORBIDDEN.test(t))));
    const raw = 'AI ranking (L06): Refresh the ranking page for the searches the engines run: 5 cell(s), expected gain 0.0119 over $9.63 (client time at $25 an hour) — a page run (cad_20261113_devaicon-com_2) was started; this row moves to "written" only against a seo_content_log row for that run';
    const cl = AQ.clean(raw);
    check('clean(): the production reason loses its lever id, money, run id, table name and long dash', !FORBIDDEN.test(cl) && /Refresh the ranking page/.test(cl), cl);
    check('page types: "Comparison Page" is a Guide; a form type is kept', AQ.pageType('Comparison Page') === 'Guide' && AQ.pageType('Service Page') === 'Service Page' && AQ.pageType('') === 'Guide', '');
    check('the question\'s own search first, then the topic', AQ.keywordOf({ keyword: 'Best AI automation services Dubai', topic: 'ai automation services' }) === 'best ai automation services dubai' && AQ.keywordOf({ topic: 'engagement models' }) === 'engagement models', '');
    const LRU = kitFrom('Cadence_Plan.js', 'LRU');
    const fold = [['agentic ai development companies uae', 'ai app development companies', false, false], ['agentic ai development companies uae', 'agentic ai development in uae', false, true],
      ['best e invoicing software uae', 'e invoicing software in uae', true, true], ['best crm service provider uae', 'crm service provider', false, true], ['best ai automation services dubai', 'ai automation services pakistan', false, false],
      ['best ai automation companies pakistan', 'ai development companies', false, false]];
    for (const [q, k, same, covers] of fold) check('LRU "' + q + '" vs "' + k + '": same ' + same + ', covers ' + covers, LRU.sameQuestion(q, k) === same && LRU.coversHead(q, k) === covers, J({ s: LRU.sameQuestion(q, k), c: LRU.coversHead(q, k), q: LRU.qWords(q), k: LRU.qWords(k) }));
