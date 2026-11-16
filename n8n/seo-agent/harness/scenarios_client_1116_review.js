// CQR1-CQR6 (client reports 2026-11-16, the independent engine review of the AI answer page fix: M1-M3, L2-L7; L1 is the shared cadence case
// app_ai_page_does_not_use_the_automatic_allowance in fixtures/cadence_levels.json). Synthetic data only. Each non-control check fails on the
// integration head 12bc7165.
//   CQR1  M1  the client's own topics widen the TOPIC test only: "best odoo partner uae" stays "other brand" with a published "dynamics 365 vs
//             odoo" page; L4 in AI Growth: a held run's question is queued with a plain reason, not left "being written"
//   CQR2  M2  a page of a keyword ladder that also answers a question is never held against its own ladder's main page; L2: a question in
//             another market than the website's is not the page of a ladder head that names no place
//   CQR3  M3  a page whose title and H1 the client shortened is still found at its new address; the moved service page is still refused;
//             L7: another folder (/blog/...) is another page, only the same path in a section folder (/services/...) is the page moved
//   CQR4  L4  AI Target Settle (both cadence branches): a run held for the client's OK puts its question back in the queue, in plain words
//   CQR5  L2 / L3 / L5 / L6  one rule in every node: a place word is not a topic word, the market, LRU.questionPage, LRU.isBlog
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const kitFrom = (file, name) => { const src = fs.readFileSync(path.join(CODE, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' is not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const V5C = path.join(__dirname, '..', 'v5', 'code');
  const lruFull = () => new Function(fs.readFileSync(path.join(V5C, '_fit_gate.js'), 'utf8') + '\n' + fs.readFileSync(path.join(V5C, '_ladder_rules.js'), 'utf8') + '\nreturn LRU;')();   // LRU with the fit gate's places, as every node has it
  const FORBIDDEN = /\b(?:cad|ait|lad)_[A-Za-z0-9]|\bseo_[a-z_]+|\bL\d{2}\b|\$\s?\d|[—–…“”]/;
  const T = 'https://www.techand.example', D = 'https://devaicon.com';

  // ===================================================================================================================================
  await guard('CQR1 M1 widened topics', async () => {
    reset(); const SN = 'CQR1 (review M1 / L4) AI Growth: the client\'s own topics widen the topic test only (brand refusals unchanged); a held run\'s question is queued in plain words'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_techand-example', DOM = 'techand.example';
    const SVC = ['Microsoft Dynamics 365 Business Central implementation', 'Dynamics 365 Finance and Operations consulting', 'Dynamics 365 CRM for sales and service', 'ERP data migration', 'Power BI reporting'];
    const gap = (pid, prompt, topic) => ({ prompt_id: pid, prompt, kind: 'recommend', topic, competitors: ['rival-erp.example'], sources: [], volume: 40, stage: 'decision', cluster: topic, fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } });
    const G = [gap('q_odoo', 'Who is the best Odoo partner in the UAE for a trading company?', 'erp software uae'),
      gap('q_sap', 'Which SAP Business One partners work with UAE distributors?', 'erp software uae'),
      gap('q_held', 'Which Dynamics 365 CRM partner suits a UAE real estate company?', 'dynamics 365 crm')];
    const P = [['q_odoo', 'best odoo partner uae', 'erp software uae'], ['q_sap', 'sap business one partners uae', 'erp software uae'], ['q_held', 'dynamics 365 crm partner real estate uae', 'dynamics 365 crm']]
      .map(([prompt_id, keyword, topic]) => ({ json: { site_id: SID, status: 'active', prompt_id, prompt: G.find(g => g.prompt_id === prompt_id).prompt, keyword, topic, focus_topic: topic, focus_source: 'page', focus_state: 'active', kind: 'recommend' } }));
    const LOG = [
      { site_id: SID, domain: DOM, keyword: 'dynamics 365 vs odoo', source: 'app', request_id: '9001', status: 'published', published_url: T + '/insights/dynamics-365-vs-odoo', published_at: day(30), started_at: day(32) },
      { site_id: SID, domain: DOM, keyword: 'sap business one vs business central', source: 'app', request_id: '9002', status: 'published', published_url: T + '/insights/sap-business-one-vs-business-central', published_at: day(30), started_at: day(32) },
      { site_id: SID, domain: DOM, keyword: 'dynamics 365 crm partner real estate uae', source: 'ai_answer', request_id: '13215', status: 'held', started_at: day(3),
        qa_reasons: 'held for your OK; your website already has a page for this search: ' + T + '/dynamics-365-crm-uae' }];
    const TGT = [{ target_id: 'ait_techand-example_q_held', site_id: SID, domain: DOM, prompt_id: 'q_held', keyword: 'dynamics 365 crm partner real estate uae', kind: 'answer', status: 'writing', request_id: '13215', written_at: day(3) }];
    mock('Load Sites', [{ json: { site_id: SID, domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', canonical_host: 'www.' + DOM, declared_services: J(SVC), services_json: J(SVC) } }]);
    mock('Load Ladders', [{ json: {} }]); mock('Load Monitors', [{ json: { site_id: SID, domain: DOM, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]); mock('Load Cycles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: { site_id: SID, domain: DOM, run_id: 'ai_cqr1', checked_at: day(1), gaps_json: J(G), pages_json: '[]', competitors_json: J([{ domain: 'rival-erp.example', mentions: 3, auto: true }]) } }]);
    mock('Load AI Prompts', P); mock('Load Content Log', LOG.map(j => ({ json: j }))); mock('Load Query History', [{ json: {} }]); mock('Load AI Pages', [{ json: {} }]);
    mock('Load AI Targets', TGT.map(j => ({ json: j }))); mock('Load AI Growth', [{ json: {} }]); mock('Load AI Answers', [{ json: {} }]); mock('Load Cache (Growth)', [{ json: {} }]); mock('Load Link Prospects (Growth)', [{ json: {} }]);
    mock('Load Pages (Growth)', [{ json: { site_id: SID, url: T + '/insights/dynamics-365-vs-odoo', title: 'Dynamics 365 vs Odoo for UAE companies', h1: '', http_status: 200 } }]);
    const GP = (await run('Growth Plan', store['Load Cache (Growth)']))[0].json;
    const t = (pid) => (GP.targets || []).find(x => x.prompt_id === pid) || {};
    console.log('   targets ->', J((GP.targets || []).map(x => [x.prompt_id, x.status, x.reason_code, String(x.reason).slice(0, 90)])));
    check('M1: "best odoo partner uae" stays set aside as another company\'s product, although a published page compares Dynamics 365 with Odoo', t('q_odoo').status === 'set_aside' && t('q_odoo').reason_code === 'not_for_site'
      && JSON.parse(t('q_odoo').reason_args).reason === 'brand' && /Odoo/.test(t('q_odoo').reason), J(t('q_odoo')));
    check('M1: "sap business one partners uae" too (a published SAP comparison page does not make SAP the client\'s)', t('q_sap').status === 'set_aside' && JSON.parse(t('q_sap').reason_args).reason === 'brand', J(t('q_sap')));
    check('L4: the question whose page run was HELD is queued (not "being written"), its code names the page that owns the search, in plain words', t('q_held').status === 'queued' && t('q_held').reason_code === 'same_search_page'
      && JSON.parse(t('q_held').reason_args).page_url === T + '/dynamics-365-crm-uae' && /waits for your OK/.test(t('q_held').reason) && !FORBIDDEN.test(t('q_held').reason) && !t('q_held').request_id, J(t('q_held')));
  });

  // ===================================================================================================================================
  await guard('CQR2 M2 ladder page', async () => {
    reset(); const SN = 'CQR2 (review M2 / L2) Parse Verdict: a ladder page that answers a question is never held against its own ladder; a question in another market is not a ladder head\'s'; begin(SN); const check = mkCheck(SN);
    const R = require('./replay')(H);
    const F = R.load('replay_3299.json.gz'); const PB = F.nodes['Parse Brief']['0'].items[0].json;
    const PREV = (() => { const p = JSON.parse(JSON.stringify(PB)); for (const k of ['verdict_hold', 'would_hold', 'hold', 'hold_shadow', 'hold_ack', 'verdict_acknowledged', 'duplicate_check']) delete p[k]; p.client_ip = 'app:0b1c2d3e-anon'; return p; })();
    const AGENT = { verdict: 'GO_WITH_CHANGES', score: 55, reasons: ['Service providers lead the results.'], risks: [], what_must_change: [], secondary_keywords: [], recommended_page: 'Service Page', expected_monthly_visits_top3: 1, time_to_rank_months: 6 };
    const pv = async (over) => { reset(); mock('Merge Keyword Data', [{ json: { ...PREV, existing_page: null, existing_page_url: '', ...(over || {}) } }]); mock('Load Site Cache', [{ json: {} }]);
      return (await run('Parse Verdict', [{ json: { output: { ...AGENT } } }]))[0].json; };
    const model = { ...PB.site_model, domain: 'techand.example', canonical_host: 'www.techand.example', pages: [
      { url: T + '/dynamics-365-crm-uae', title: 'Dynamics 365 CRM in Dubai & UAE: Sales and Service | Tech&', h1: 'Dynamics 365 CRM Services in Dubai and the UAE', source: 'sitemap', http_status: 200 }] };
    const cov = { read: { ladders: true, drafts: true, pages: true }, drafts: [], pages: [], self: { ladder_id: '', keyword: '', target_url: '' },
      ladders: [{ ladder_id: 'lad_crm01', head_keyword: 'crm service provider', keyword: 'crm service provider', rung: 4, part: 'head', status: 'planned', ladder_status: null, target_url: T + '/dynamics-365-crm-uae', supporting: [] }] };
    const AIT = { question: 'Who are the best CRM service providers in the UAE?', kind: 'answer', target_id: 'ait_x_q', fanout: [], competitors: [], sources: [] };
    const base = { domain: 'techand.example', country: 'United Arab Emirates', page_type: 'Service Page', site_model: model, own_coverage: cov, ai_target: AIT };
    // the cadence folded the question into rung 2 "crm service provider uae" of the same ladder; the Pipeline's "Write now" sends the same run
    const rung = await pv({ ...base, keyword: 'crm service provider uae', ladder_id: 'lad_crm01', ladder_rung: 2, ladder_head: 'crm service provider', ladder_target_url: T + '/crm-service-provider-uae' });
    console.log('   rung ->', J({ w: rung.would_hold, h: rung.verdict_hold, alts: ((rung.hold || rung.hold_shadow || {}).alternatives || []).map(a => a.kind) }));
    check('M2: the ladder\'s own rung (with the AI question) is not held against the ladder\'s main page, and no "improve the main page" is offered', rung.verdict_hold === false && rung.would_hold === false
      && !(((rung.duplicate_check || {}).targets) || []).some(x => x.url === T + '/dynamics-365-crm-uae'), J({ w: rung.would_hold, d: rung.duplicate_check }));
    const own = await pv({ ...base, keyword: 'best crm service provider uae' });
    check('control: the same question written as a page of its own is still held against the ladder\'s live page', own.verdict_hold === true && ((own.hold || {}).alternatives || [])[0].kind === 'ai_refresh', J({ h: own.verdict_hold }));
    const ksa = await pv({ ...base, keyword: 'best crm service provider saudi arabia', ai_target: { ...AIT, question: 'Who are the best CRM service providers in Saudi Arabia?' } });
    check('L2: a question about Saudi Arabia is not the UAE website\'s "crm service provider" page (the head names no place: the website\'s market)', ksa.would_hold === false && !(((ksa.duplicate_check || {}).targets) || []).length, J({ w: ksa.would_hold, d: ksa.duplicate_check }));
  });

  // ===================================================================================================================================
  await guard('CQR3 M3 detection', async () => {
    reset(); const SN = 'CQR3 (review M3 / L7) publish detection: a shortened title at a new address is still found; the moved service page is still refused; another folder is another page'; begin(SN); const check = mkCheck(SN);
    const SITE = 'site_devaicon-com', DOM = 'devaicon.com', OWNER = D + '/ai-automation-services-pakistan', MOVED = D + '/services/ai-automation-services-pakistan';
    const detect = async (cands, urls, pages) => { reset();
      const sm = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => '<url><loc>' + u + '</loc></url>').join('') + '</urlset>';
      mock('Publish Candidates', [{ json: { site_idx: 0, site_id: SITE, domain: DOM, sitemap_url: D + '/sitemap.xml', candidates: cands, known: [OWNER], owners: [{ url: OWNER, keyword: 'ai automation services pakistan' }], detect: true } }]);
      mock('Fetch Sitemap (Detect)', [{ json: { statusCode: 200, data: sm } }]); mock('Load Pages (Site)', [{ json: {} }]); mock('Load AI Pages (Site)', [{ json: {} }]);
      const ms = (await run('Match Slugs (Detect)', store['Publish Candidates'])).map(x => x.json); const fetched = ms.filter(x => x.fetch).map(x => x.url);
      mock('Fetch Pages (Detect)', fetched.length ? fetched.map(u => ({ json: { statusCode: 200, data: '<html><head><title>' + ((pages || {})[u] || ['Other | Devaicon'])[0] + '</title></head><body><h1>' + ((pages || {})[u] || ['', 'Other'])[1] + '</h1></body></html>' } })) : [{ json: {} }]);
      return { ms, det: (await run('Detect Published', store['Fetch Pages (Detect)']))[0].json }; };
    const cand = (o) => ({ key: o.keyword, keyword: o.keyword, source: 'content_log', log: { site_id: SITE, domain: DOM, keyword: o.keyword, source: 'ai_answer', request_id: '12467', status: 'written', started_at: '2026-11-10T14:54:00.000Z' }, ladder: null,
      written_at: '2026-11-10T14:54:00.000Z', existing_url: '', planned_url: '', ladder_id: '', planned_slug: o.slug || '', planned_title: o.title || '', planned_h1: o.h1 || '', qa_failed: false });
    const NEW = D + '/insights/ai-automation-dubai';
    const c1 = cand({ keyword: 'best ai automation services dubai', slug: 'best-ai-automation-services-dubai-guide', title: 'Best AI Automation Services in Dubai: A 2026 Buyer\'s Guide | Devaicon', h1: 'Best AI Automation Services in Dubai: How to Choose the Right Partner' });
    const x1 = await detect([c1], [D + '/', MOVED, NEW], { [NEW]: ['AI Automation Services in Dubai | Devaicon', 'Best AI Automation Services in Dubai'], [MOVED]: ['AI Automation Services in Pakistan | ISO 27001 | Devaicon', 'AI automation services in Pakistan'] });
    console.log('   shortened ->', J({ detected: x1.det.detected, unmatched: x1.det.unmatched }));
    check('M3: the page published at a new address with a shortened title and H1 is found (by the keyword / live-in-written fallback)', (x1.det.detected || []).length === 1 && x1.det.detected[0].url === NEW, J(x1.det.detected));
    check('M3: the moved service page is never a candidate for it', !((((x1.ms[0] || {}).sites || [])[0] || {}).title_checks || []).some(c => (c.options || []).some(o => o.url === MOVED)), J((((x1.ms[0] || {}).sites || [])[0] || {}).title_checks));
    // L7: the keyword's own slug in a section folder is the owner page moved; in another folder it is another page
    const BLOG = D + '/blog/ai-automation-services-pakistan';
    const x2 = await detect([cand({ keyword: 'ai automation services pakistan' })], [D + '/', MOVED, BLOG], {});
    console.log('   folders ->', J({ detected: x2.det.detected, unmatched: x2.det.unmatched }));
    check('L7: /blog/ai-automation-services-pakistan (another folder) can be the new page; /services/ai-automation-services-pakistan (the owner page moved) never is', (x2.det.detected || []).length === 1 && x2.det.detected[0].url === BLOG, J(x2.det.detected));
    check('L7: a candidate found carries no "moved" note', !(x2.det.unmatched || []).length, J(x2.det.unmatched));
  });

  // ===================================================================================================================================
  await guard('CQR4 L4 settle held', async () => {
    reset(); const SN = 'CQR4 (review L4) AI Target Settle, both cadence branches: a run held for the client\'s OK puts its question back in the queue, in plain words'; begin(SN); const check = mkCheck(SN);
    mock('Load AI Targets Writing (Cadence)', [{ json: { target_id: 'ait_h', site_id: 'site_x', domain: 'x.example', question: 'q', keyword: 'best crm partner uae', status: 'writing', request_id: 'r9', written_at: day(2) } }]);
    mock('Load Content Log', [{ json: { site_id: 'site_x', domain: 'x.example', keyword: 'best crm partner uae', request_id: 'r9', status: 'held', started_at: day(2), qa_reasons: 'held for your OK; your website already has a page for this search: https://x.example/crm-uae' } }]);
    for (const node of ['AI Target Settle', 'AI Target Settle (Idle)']) {
      const o = ((await run(node, [{ json: {} }]))[0] || {}).json || {};
      check(node + ': queued, code same_search_page with the page the hold named, no run id kept, plain words', o.target_id === 'ait_h' && o.status === 'queued' && o.reason_code === 'same_search_page' && o.request_id === ''
        && JSON.parse(o.reason_args).page_url === 'https://x.example/crm-uae' && /waits for your OK/.test(o.reason) && !FORBIDDEN.test(o.reason), J(o));
    }
  });

  // ===================================================================================================================================
  await guard('CQR5 one rule', async () => {
    reset(); const SN = 'CQR5 (review L2 / L3 / L5 / L6) one rule everywhere: a place is not a topic word, the market counts, LRU.questionPage and LRU.isBlog in every node'; begin(SN); const check = mkCheck(SN);
    const LRU = lruFull();
    check('L3: "crm dubai" (one topic word and a place) covers no question: not "best crm for real estate dubai"', LRU.coversHead('best crm for real estate dubai', 'crm dubai', 'United Arab Emirates') === false, J(LRU.qWords('crm dubai')));
    check('L2: a head with no place covers a question in the website\'s market only', LRU.coversHead('best crm service provider uae', 'crm service provider', 'United Arab Emirates') === true
      && LRU.coversHead('best crm service provider saudi arabia', 'crm service provider', 'United Arab Emirates') === false && LRU.coversHead('best crm service provider uae', 'crm service provider', 'Pakistan') === false, '');
    check('L2: a head that names its place keeps it ("agentic ai development in uae" and a UAE question)', LRU.coversHead('agentic ai development companies uae', 'agentic ai development in uae', '') === true, '');
    check('L5: questionPage takes a rung of the same search, the main page it covers, never another rung it covers', LRU.questionPage('best crm service provider uae', { keyword: 'crm service provider uae', rung: 2 }, 'AE') === true
      && LRU.questionPage('best crm service provider uae', { keyword: 'crm service provider', rung: 4 }, 'AE') === true && LRU.questionPage('best crm service provider uae', { keyword: 'crm service provider', rung: 2 }, 'AE') === false, '');
    for (const f of ['Cadence_Plan.js', 'Growth_Plan.js', 'AI_Target_Settle.js', 'AI_Target_Settle_Idle_.js', 'Parse_Verdict.js']) {
      const src = fs.readFileSync(path.join(CODE, f), 'utf8');
      check('L5: ' + f + ' asks LRU.questionPage, and no node keeps its own coversHead rule', /LRU\.questionPage\(/.test(src) && !/LRU\.coversHead\(/.test(src.replace(/const LRU = \(\(\) => \{[\s\S]*?\n\}\)\(\);/, '')), f);
    }
    const am = fs.readFileSync(path.join(CODE, 'AI_Metrics.js'), 'utf8');
    check('L6: AI Metrics types a refresh with LRU.isBlog (the cadence\'s and the app\'s rule): /academy/ and /stories/ pages are guides too', /LRU\.isBlog\(/.test(am) && kitFrom('AI_Metrics.js', 'LRU').isBlog('https://x.example/academy/ai-cost') === true, '');
  });
};
