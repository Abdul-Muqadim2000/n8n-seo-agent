// KLL1-KLL6 (KWL-LAD, 2026-10-21): the keyword live run's ladder and Keyword Check defects (scratchpad KW_LIVE_REPORT.md). Every check runs the
// GENERATED code (harness/code_v4) or the generated workflow JSON, and fails on the code before the fix:
//   KLL1 D9   the main page improves a page of the site: its confidence and evidence travel with it, and no note says "all pages are new"
//   KLL2 D14  "ai consulting dubai" is the same search as the other ladder's rung "ai consultant dubai": refused with a plain reason, listed in overlaps
//   KLL3 D4   a job search whose buyer searches belong to a ladder of the site says which ladder holds them
//   KLL4 D7   an Arabic keyword's results page is read in Arabic, and the answer says how the keyword was read
//   KLL5 D5   the Keyword Check keeps inside its time: 12 s first read, 1 s wait, 8 s retry only when it fits; a late page is "not read in
//             time"; a check stopped by its time limit is released by the next check's settle
//   KLL6 D11  the title reader keeps "&" (hex, decimal and double-encoded entities)
// Called from scenarios_v5.js just before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const fs = require('fs'); const path = require('path');
  const V = require('./fixtures_v5');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const EMPTY = [{ json: {} }];
  const D = 'techand.ai', HOST = 'https://www.techand.ai', SITE = 'site_techand-ai', LOC = 2784;
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'E-invoicing compliance'];
  const NO_TELLS = /[—–“”‘’…]/;
  const env = (task) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', tasks: [task] });
  const ok = (id, cost, result) => env({ id, status_code: 20000, status_message: 'Ok.', cost, result: [result] });
  const org = (rank, domain, url, title) => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain, url, title });
  const serpOf = (id, kw, organic, paa, related) => ok(id, 0, { keyword: kw, datetime: '2026-10-21 08:00:00 +00:00', items: [...organic,
    ...(paa.length ? [{ type: 'people_also_ask', items: paa.map(q => ({ type: 'people_also_ask_element', title: q })) }] : []),
    ...(related.length ? [{ type: 'related_searches', items: related }] : [])] });
  const CAREER_ORG = [org(1, 'www.upwork.com', 'https://www.upwork.com/hire/ai-consultants/', 'Hire the best AI Consultants'),
    org(2, 'www.usaii.org', 'https://www.usaii.org/artificial-intelligence-certifications/certified-artificial-intelligence-consultant', 'Certified Artificial Intelligence Consultant (CAIC) | USAII'),
    org(3, 'ae.indeed.com', 'https://ae.indeed.com/q-ai-consultant-jobs.html', 'Ai Consultant Jobs, Employment in United Arab Emirates'),
    org(4, 'www.bayt.com', 'https://www.bayt.com/en/uae/jobs/ai-consultant-jobs/', 'AI Consultant Jobs in UAE'),
    org(5, 'www.glassdoor.com', 'https://www.glassdoor.com/Salaries/ai-consultant-salary-SRCH_KO0,13.htm', 'AI Consultant Salary'),
    org(6, 'www.ibm.com', 'https://www.ibm.com/think/topics/ai-consulting', 'What is AI consulting?')];
  const CAREER = serpOf('cache:serp-c1', 'ai consultant', CAREER_ORG, ['What is AI consulting\'s salary?', 'How do I become an AI consultant?'], []);
  const SERVICE_ORG = [org(1, 'www.alpha-ai.ae', 'https://www.alpha-ai.ae/services/ai-consulting/', 'AI Consulting Services in Dubai | Alpha AI'),
    org(2, 'www.beta.ae', 'https://www.beta.ae/solutions/artificial-intelligence/', 'AI Consulting Solutions Dubai | Beta'),
    org(3, 'gamma.com', 'https://gamma.com/services/ai-strategy-dubai/', 'AI Strategy and Consulting Services Dubai'),
    org(4, 'delta.ae', 'https://delta.ae/services/ai/', 'Artificial Intelligence Consulting Services | Delta'),
    org(5, 'epsilon.io', 'https://epsilon.io/products/ai-platform/', 'AI Platform and Consulting Services')];
  const SERVICE = serpOf('cache:serp-s1', 'ai consulting dubai', SERVICE_ORG, ['How much does AI consulting cost in Dubai?'], []);
  const POOL = ['ai consulting dubai', 'ai consulting services uae', 'ai consulting firms uae', 'ai implementation consultant uae', 'best ai consulting firms dubai',
    'ai strategy consulting dubai', 'ai automation services uae', 'ai consulting cost uae', 'generative ai consulting uae', 'ai readiness assessment uae'];
  const SF = (paa) => ({ se_results_count: 1200000, checked_at: '2026-10-21T08:00:00.000Z', people_also_ask: paa, related_searches: [], forum_threads: [], featured_snippet: null,
    ai_overview: { present: false, text: '', cited_domains: [], seen_at: null }, features_present: ['people_also_ask'], video_results: false, shopping_results: false, local_pack: false });
  const top6 = (orgs) => orgs.slice(0, 6).map(o => ({ rank: o.rank_group, domain: o.domain.replace(/^www\./, ''), url: o.url, title: o.title, word_count: 1500 }));
  const PV = (kw, orgs, paa, extra) => ({ keyword: kw, domain: D, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', goal: 'leads', email: '', callback_url: '', request_id: 'r-kll', ladder_id: 'lad_kll',
    pages_now: 1, page_type: 'Service Page', recommended_page: 'Service Page', competitors: [], competitors_summary: top6(orgs), serp_features: SF(paa),
    business: 'Microsoft partner in Dubai: AI consulting and automation, Microsoft Copilot, Dynamics 365 business applications', services: SERVICES,
    site_description: { business_description: 'Microsoft partner in Dubai', products_or_services: SERVICES },
    keyword_data: { search_volume: 170, cpc: 16.2, keyword_difficulty: 0, google_intent: 'commercial', competitor_backlink_strength: { avg_referring_domains: 4 } }, verdict: 'GO_WITH_CHANGES', verdict_score: 68,
    verdict_reasons: ['Competition is weak.'], verdict_changes: [], verdict_risks: [], secondary_keywords: [], site_authority: { organic_keywords: 12, top3: 0, top10: 0, est_monthly_traffic: 20 },
    site_urls: [HOST + '/'], expected_visits_top3: 40, time_to_rank_months: 3, ...(extra || {}) });
  const planFor = async (pv, serp, o = {}) => {
    reset(); mock('Parse Verdict', pv);
    if (serp) mock('Cached SERP (Top 10)', serp);
    mock('Ladder Requests', [{ kind: 'suggestions', label: 'suggestions for ' + pv.keyword, body: [{ keyword: pv.keyword }] }, { kind: 'ranked', label: 'keywords ' + D + ' ranks for', domain: D, body: [{ target: D }] }]);
    mock('Load Site Cache', [{ json: { id: 1, key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 10, method: 'size', p75: null, size_reach: 10, sample: 0, top10: 3, organic_keywords: 12, location_code: LOC }), updated_at: new Date(Date.now() - 3 * 864e5).toISOString() } }]);
    mock('Load Domain Ladders', (o.ladders || []).length ? o.ladders.map(r => ({ json: r })) : EMPTY); mock('Load Domain Ladder Settings', EMPTY);
    if (o.site) mock('Site Model', [{ json: { site_model: o.site } }]);
    const lp = (await run('Ladder Pool', [V.task({ seed_keyword: pv.keyword, items: POOL.map((k, i) => V.kwItem(k, i)) }), V.task({ target: D, items: [] })]))[0].json;
    const lch = await run('Ladder Relevance Chunks', [{ json: lp }]);
    mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
    return (await run('Ladder Plan', store['Ladder Keyword Relevance']))[0].json.ladder;
  };
  const ladderRows = () => [
    { ladder_id: 'lad_old', domain: D, keyword: 'ai consultant', head_keyword: 'ai consultant', rung: 4, status: 'planned' },
    { ladder_id: 'lad_old', domain: D, keyword: 'ai consultant dubai', head_keyword: 'ai consultant', rung: 1, status: 'planned' },
    { ladder_id: 'lad_old', domain: D, keyword: 'ai consulting', head_keyword: 'ai consultant', rung: 2, status: 'planned' },
    { ladder_id: 'lad_old', domain: D, keyword: 'ai consulting firm', head_keyword: 'ai consultant', rung: 2, status: 'planned' }];
  const checkFor = async (kw, serp, o = {}) => {
    reset();
    mock('Assess Validate', [{ json: { ok: true, status: 200, keyword: kw, domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', business: 'AI consulting and Microsoft Dynamics partner in the UAE', services: SERVICES, existing_keywords: o.existing || [], caller: 'app:test', ...(o.v || {}) } }]);
    mock('Load Assess Cache', [{ json: { key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 30, method: 'size', p75: null, size_reach: 30, sample: 0, top10: 20, organic_keywords: 300, location_code: LOC }), updated_at: new Date(Date.now() - 3 * 864e5).toISOString() } }]);
    if (o.ladders) mock('Load Ladders (Assess)', o.ladders.map(r => ({ json: r })));
    const reqs = (await run('Assess Requests', EMPTY)).map(i => i.json);
    const ans = reqs.map(r => r.kind === 'overview' ? ok('ov-1', 0.01, { items: [{ keyword: kw, keyword_info: { search_volume: 170, cpc: 6.5 }, keyword_properties: { keyword_difficulty: 0 }, search_intent_info: { main_intent: 'commercial' } }] })
      : r.kind === 'serp' ? serp : ok('x-' + r.kind, 0, { items: [] }));
    const ar = (await run('Assess Result', ans.map(j => ({ json: j }))))[0].json; mock('Assess Result', [{ json: ar }]);
    const body = (await run('Assess Response', [{ json: { output: { fit: o.fit == null ? 2 : o.fit, navigational: false, alternatives: o.alt == null ? '' : o.alt } } }]))[0].json.body;
    return { reqs, ar, body };
  };

  // ===================================================================================
  await guard('KLL1 main page improved with its evidence', async () => {
    reset(); const SN = 'KLL1 KWL-LAD D9 - the main page improves a page of the site: its confidence and evidence travel with it, and no note says all pages are new'; begin(SN); const check = mkCheck(SN);
    const REAL = HOST + '/whatwedo/ai-consulting-dubai';
    const site = { domain: D, canonical_host: 'www.techand.ai', business_name: 'Tech&', pages: [{ url: HOST + '/', title: '', h1: '', source: 'sitemap', queries: [] }, { url: REAL, title: 'AI Consulting Dubai | What We Do | Tech&', h1: 'AI consulting in Dubai', source: 'sitemap', queries: [] }] };
    const L = await planFor(PV('ai consulting dubai', SERVICE_ORG, ['How much does AI consulting cost in Dubai?'], { existing_page: { url: REAL, source: 'page inventory' } }), SERVICE, { site });
    const top = L.top || {};
    console.log('   top ->', J({ status: top.status, url: top.target_url, conf: top.existing_confidence, ev: top.existing_evidence }));
    check('the main page is improved, with a confidence and its evidence (they were null and empty)', top.status === 'improve' && top.existing_confidence != null && String(top.existing_evidence || '').length > 5, J(top));
    const all = [...(L.notes || []), String(((L.topic_authority || {}).coverage || {}).summary || '')].join(' | ');
    check('no note says every page of the plan is new while the main page improves one', !/planned as new|are new and this topic starts from zero/.test(all) && /improve/.test(String(((L.topic_authority || {}).coverage || {}).summary || '')), all.slice(0, 600));
  });

  // ===================================================================================
  await guard('KLL2 one search one ladder', async () => {
    reset(); const SN = 'KLL2 KWL-LAD D14 - "ai consulting dubai" is the same search as the rung "ai consultant dubai" of the ladder "ai consultant": refused with a plain reason, never a second ladder'; begin(SN); const check = mkCheck(SN);
    const L = await planFor(PV('ai consulting dubai', SERVICE_ORG, ['How much does AI consulting cost in Dubai?']), SERVICE, { ladders: ladderRows() });
    console.log('   ladder ->', J({ planned: L.planned, refusal: L.refusal, overlaps: (L.overlaps || []).slice(0, 3) }));
    check('the plan is refused as a duplicate of the ladder that already plans "ai consultant dubai"', L.planned === false && L.refusal && L.refusal.reason === 'duplicate' && L.refusal.ladder_id === 'lad_old'
      && /ai consultant dubai/.test(L.refusal.message) && !NO_TELLS.test(L.refusal.message), J(L.refusal));
    check('the overlap is listed for the app with the other ladder and the reason', (L.overlaps || []).some(x => x.ladder_id === 'lad_old' && x.action === 'refused' && x.why), J(L.overlaps));
  });

  // ===================================================================================
  await guard('KLL3 buyer searches held by a ladder', async () => {
    reset(); const SN = 'KLL3 KWL-LAD D4 - "ai consultant" is a job search; its buyer searches belong to the ladder "ai consultant", and the answer says so'; begin(SN); const check = mkCheck(SN);
    const { body } = await checkFor('ai consultant', CAREER, { existing: ['ai consultant', 'ai consultant dubai', 'ai consulting', 'ai consulting firm'], ladders: ladderRows(), fit: 0, alt: '' });
    console.log('   check ->', J({ fit: body.fit, alt: body.alternatives, held: body.alternatives_held, note: body.alternatives_note }));
    check('refused as a job search (control)', body.fit === 0 && body.fit_gate && body.fit_gate.reason === 'job search', J(body.fit_gate));
    check('the held buyer searches are named with the ladder that holds them', (body.alternatives_held || []).length >= 2 && /your ladder "ai consultant" already covers/.test(body.alternatives_note || '')
      && /"ai consultant dubai"/.test(body.alternatives_note) && !NO_TELLS.test(body.alternatives_note) && (body.warnings || []).includes(body.alternatives_note), J({ held: body.alternatives_held, note: body.alternatives_note }));
  });

  // ===================================================================================
  await guard('KLL4 Arabic read in Arabic', async () => {
    reset(); const SN = 'KLL4 KWL-LAD D7 - an Arabic keyword: its results page is asked for in Arabic and the answer says how the keyword was read'; begin(SN); const check = mkCheck(SN);
    const AR = 'استشارات الذكاء الاصطناعي دبي';
    const v = (await run('Assess Validate', [{ json: { headers: {}, body: { keyword: AR, country: 'United Arab Emirates', domain: D } } }]))[0].json;
    check('Assess Validate: the results page language is Arabic and the shared reading key carries it', v.ok && v.serp_language_code === 'ar' && /\|ar\|/.test(String(v.serp_cache_key || '')), J({ ok: v.ok, lang: v.serp_language_code, key: v.serp_cache_key }));
    const { reqs, body } = await checkFor(AR, serpOf('serp-ar', AR, SERVICE_ORG, [], []), { v: { serp_language_code: 'ar', arabic_script: true } });
    const sreq = reqs.find(r => r.kind === 'serp');
    check('the results page request asks Google in Arabic', sreq && sreq.body[0].language_code === 'ar', J(sreq && sreq.body));
    console.log('   reading ->', J(body.reading));
    check('the answer says how the Arabic was read, in plain words', body.reading && /read as "/.test(body.reading.note) && /Arabic/.test(body.reading.note) && body.fit_gate.reading_note === body.reading.note
      && (body.warnings || []).includes(body.reading.note) && !NO_TELLS.test(body.reading.note), J(body.reading));
  });

  // ===================================================================================
  await guard('KLL5 Keyword Check time budget', async () => {
    reset(); const SN = 'KLL5 KWL-LAD D5 - the Keyword Check answers inside its time: a short first read, a retry only when it fits, "not read in time", and a stopped check released'; begin(SN); const check = mkCheck(SN);
    const LW = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger_wiring.json'), 'utf8')).assess || {};
    const TB = LW.time_budget || {}, RS = LW.release_stale || {};
    const t1 = TB.first_timeout_ms, t2 = TB.retry_timeout_ms, w = TB.retry_wait_s;
    check('first read 12 s, wait 1 s, retry 8 s: worst case 21 s before the model, under the 45 s limit with room for it', t1 === 12000 && t2 === 8000 && w === 1 && (t1 + w * 1000 + t2) <= 24000 && TB.workflow_timeout_s === 45, J(TB));
    const conds = (RS.conditions || []).map(c => c[0] + ' ' + c[1]);
    check('a check stopped before its settle is released by the next one: assess rows still reserved after two minutes become stale, with the estimate', (RS.after || []).includes('Settle Run Ledger (Assess)')
      && ['mode eq', 'status eq', 'created_at lt'].every(c => conds.includes(c)) && (RS.values || {}).status === 'stale', J(RS));
    // the retry plan: a request sent 30 s ago gets no second attempt; one sent now does
    const timeoutAns = { error: { message: 'timeout of 12000ms exceeded' } };
    const overview = ok('ov-1', 0.01, { items: [] });
    const reqs = (sent) => [{ kind: 'overview', endpoint: 'x', body: [{}], sent_at: sent }, { kind: 'serp', endpoint: 'y', body: [{}], sent_at: sent }];
    mock('Assess Requests', reqs(Date.now() - 30000).map(j => ({ json: j })));
    const late = (await run('Run Assess Requests Retry Plan', [{ json: overview }, { json: timeoutAns }])).map(i => i.json);
    mock('Assess Requests', reqs(Date.now()).map(j => ({ json: j })));
    const early = (await run('Run Assess Requests Retry Plan', [{ json: overview }, { json: timeoutAns }])).map(i => i.json);
    check('the retry is sent only when it can still end inside the budget', late.length === 1 && late[0].skip && late[0].out_of_time === true && early.some(x => x.is_retry && x.kind === 'serp'), J({ late, early: early.map(x => [x.kind, x.is_retry]) }));
    // a results page that timed out: "not read in time", judged without it
    const { body } = await checkFor('ai consulting dubai', timeoutAns);
    check('the answer says the results page was not read in time and judges without it', body.serp.read === false && body.serp.late === true && body.serp.why === 'not read in time'
      && (body.warnings || []).some(x => /results page not read in time/.test(x)) && body.fit_judged_without_serp === true, J({ serp: body.serp, w: body.warnings }));
  });

  // ===================================================================================
  await guard('KLL6 titles keep the ampersand', async () => {
    reset(); const SN = 'KLL6 KWL-LAD D11 - the title reader keeps "&" (hex, decimal and double-encoded entities); the homepage title read now wins over the copy on file'; begin(SN); const check = mkCheck(SN);
    const A = HOST + '/whatwedo/ai-automation', B = HOST + '/capabilities';
    mock('Ladder Title Requests', [{ json: { title_check: true, home_ref: true, url: HOST + '/', home_title: 'Tech | Turning Technology into measurable Business Impact', untitled: 2 } },
      { json: { title_check: true, url: A, why: 'could overlap' } }, { json: { title_check: true, url: B, why: 'could overlap' } }]);
    mock('Read Ladder Titles', [{ json: { statusCode: 200, body: '<html><head><title>Tech&amp; | Turning Technology into measurable Business Impact</title></head></html>' } },
      { json: { statusCode: 200, body: '<html><head><title>AI &#x26; Automation | What We Do | Tech&amp;</title></head><body><h1>AI &amp;amp; Automation</h1></body></html>' } },
      { json: { statusCode: 200, body: '<html><head><title>Capabilities &#38; Services | Tech&#x26;</title></head></html>' } }]);
    const pt = (await run('Ladder Titles', EMPTY))[0].json.page_titles;
    const a = (pt.read || []).find(r => r.url === A) || {}, b = (pt.read || []).find(r => r.url === B) || {};
    console.log('   titles ->', J({ a, b, home: pt.home_title }));
    check('"AI & Automation | What We Do | Tech&" is read with its "&" (hex entity), the H1 too (double-encoded)', a.title === 'AI & Automation | What We Do | Tech&' && a.h1 === 'AI & Automation', J(a));
    check('decimal entities too, and the homepage title read now replaces the copy that lost its "&"', b.title === 'Capabilities & Services | Tech&' && pt.home_title === 'Tech& | Turning Technology into measurable Business Impact', J({ b, home: pt.home_title }));
  });
};
