// KL1-KL3 (KW-LADDER, 2026-10-21): the independent review of the keyword merges (KW_REVIEW.md items 1, 7, 9, 10, 15). Every check runs the
// GENERATED code (harness/code_v4) and fails on the code before the fix:
//   KL1 item 1 + 7  the ladder reads the head's OWN results page (today's shared reading, Cached SERP (Top 10)), not competitors_summary
//                   (Pick Top 6 skips job boards): "ai consultant" is refused with the job boards as evidence, and its alternatives are
//                   never the same search plus a city ("ai consultant dubai")
//   KL2             one reading, one verdict: the Keyword Check and the ladder, given the same results page on the same day, agree -
//                   "ai consultant" refused as a job or training search on both, "ai consulting dubai" a fit on both
//   KL3 item 9 / 10 / 15  the title read: an app-shell title (the homepage's, or shared by most pages read) is not a page title; a page that
//                   answers 404 enters the inventory as gone and is never the page to improve; a redirect is followed once and only to the
//                   same page on the client's own host, and a retired URL that redirects elsewhere is reported as redirected, not titled
// Called from scenarios_v5.js just before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const V = require('./fixtures_v5');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const EMPTY = [{ json: {} }];
  const D = 'techand.ai', HOST = 'https://www.techand.ai', SITE = 'site_techand-ai', LOC = 2784;
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  const NO_TELLS = /[—–“”‘’…]/;
  const env = (task) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', tasks: [task] });
  const ok = (id, cost, result) => env({ id, status_code: 20000, status_message: 'Ok.', cost, result: [result] });
  const org = (rank, domain, url, title) => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain, url, title });
  const serpOf = (id, kw, organic, paa, related) => ok(id, 0, { keyword: kw, datetime: '2026-10-21 08:00:00 +00:00', items: [...organic,
    ...(paa.length ? [{ type: 'people_also_ask', items: paa.map(q => ({ type: 'people_also_ask_element', title: q })) }] : []),
    ...(related.length ? [{ type: 'related_searches', items: related }] : [])] });
  // the results page of "ai consultant" (r01 / AS1): a hiring marketplace, a certification, three job boards, IBM
  const CAREER_ORG = [org(1, 'www.upwork.com', 'https://www.upwork.com/hire/ai-consultants/', 'Hire the best AI Consultants'),
    org(2, 'www.usaii.org', 'https://www.usaii.org/artificial-intelligence-certifications/certified-artificial-intelligence-consultant', 'Certified Artificial Intelligence Consultant (CAIC) | USAII'),
    org(3, 'ae.indeed.com', 'https://ae.indeed.com/q-ai-consultant-jobs.html', 'Ai Consultant Jobs, Employment in United Arab Emirates'),
    org(4, 'www.bayt.com', 'https://www.bayt.com/en/uae/jobs/ai-consultant-jobs/', 'AI Consultant Jobs in UAE'),
    org(5, 'www.glassdoor.com', 'https://www.glassdoor.com/Salaries/ai-consultant-salary-SRCH_KO0,13.htm', 'AI Consultant Salary'),
    org(6, 'www.ibm.com', 'https://www.ibm.com/think/topics/ai-consulting', 'What is AI consulting?')];
  const CAREER = serpOf('cache:serp-c1', 'ai consultant', CAREER_ORG, ['What exactly does an AI consultant do?', 'How much does an AI consultant cost?'],
    ['ai consulting services dubai', 'ai consulting company uae']);
  const SERVICE_ORG = [org(1, 'www.alpha-ai.ae', 'https://www.alpha-ai.ae/services/ai-consulting/', 'AI Consulting Services in Dubai | Alpha AI'),
    org(2, 'www.beta.ae', 'https://www.beta.ae/solutions/artificial-intelligence/', 'AI Consulting Solutions Dubai | Beta'),
    org(3, 'gamma.com', 'https://gamma.com/services/ai-strategy-dubai/', 'AI Strategy and Consulting Services Dubai'),
    org(4, 'delta.ae', 'https://delta.ae/services/ai/', 'Artificial Intelligence Consulting Services | Delta'),
    org(5, 'epsilon.io', 'https://epsilon.io/products/ai-platform/', 'AI Platform and Consulting Services')];
  const SERVICE = serpOf('cache:serp-s1', 'ai consulting dubai', SERVICE_ORG, ['How much does AI consulting cost in Dubai?'], []);
  // what Pick Top 6 hands the analysis from those pages: job boards and course sites skipped, one page per domain, at most 6
  const SKIP = /indeed|glassdoor|bayt|naukrigulf|monster|linkedin|udemy|coursera|simplilearn/;
  const top6 = (orgs) => orgs.filter(o => !SKIP.test(o.domain)).slice(0, 6).map(o => ({ rank: o.rank_group, domain: o.domain.replace(/^www\./, ''), url: o.url, title: o.title, word_count: 1500 }));
  // the research pool around the head: no job or salary variants, so the pool alone never makes it a career search
  const POOL = ['ai consultant', 'ai consultant dubai', 'ai consultant uae', 'ai consulting services', 'ai consulting dubai', 'ai consulting firms uae', 'ai implementation consultant uae',
    'best ai consulting firms dubai', 'ai consulting company uae', 'ai strategy consulting dubai', 'ai automation services uae', 'ai consulting cost uae'];
  const SF = (paa) => ({ se_results_count: 1200000, checked_at: '2026-10-21T08:00:00.000Z', people_also_ask: paa, related_searches: [], forum_threads: [], featured_snippet: null,
    ai_overview: { present: false, text: '', cited_domains: [], seen_at: null }, features_present: ['people_also_ask'], video_results: false, shopping_results: false, local_pack: false });
  const PV = (kw, orgs, paa, extra) => ({ keyword: kw, domain: D, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', goal: 'leads', email: '', callback_url: '', request_id: 'r-kl', ladder_id: 'lad_kl',
    pages_now: 1, page_type: 'Service Page', recommended_page: 'Service Page', competitors: [], competitors_summary: top6(orgs), serp_features: SF(paa),
    business: 'Microsoft partner in Dubai for enterprises in the UAE and GCC: AI consulting and automation, Microsoft Copilot, Dynamics 365 business applications', services: SERVICES,
    site_description: { business_description: 'Microsoft partner in Dubai', products_or_services: SERVICES },
    keyword_data: { search_volume: 170, cpc: 16.2, keyword_difficulty: 0, google_intent: 'commercial', competitor_backlink_strength: { avg_referring_domains: 4 } }, verdict: 'GO_WITH_CHANGES', verdict_score: 68,
    verdict_reasons: ['Competition is weak.'], verdict_changes: [], verdict_risks: [], secondary_keywords: [], site_authority: { organic_keywords: 12, top3: 0, top10: 0, est_monthly_traffic: 20 },
    site_urls: [HOST + '/'], expected_visits_top3: 40, time_to_rank_months: 3, ...(extra || {}) });
  // the real ladder nodes from the pool on; the head's results page is today's shared reading (Cached SERP (Top 10)), as when the Keyword
  // Check read the same search earlier that day
  const planFor = async (pv, serp, o = {}) => {
    reset(); mock('Parse Verdict', pv);
    if (serp) mock('Cached SERP (Top 10)', serp);
    mock('Ladder Requests', [{ kind: 'suggestions', label: 'suggestions for ' + pv.keyword, body: [{ keyword: pv.keyword }] }, { kind: 'ranked', label: 'keywords ' + D + ' ranks for', domain: D, body: [{ target: D }] }]);
    mock('Load Site Cache', [{ json: { id: 1, key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 10, method: 'size', p75: null, size_reach: 10, sample: 0, top10: 3, organic_keywords: 12, location_code: LOC }), updated_at: new Date(Date.now() - 3 * 864e5).toISOString() } }]);
    mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
    const lp = (await run('Ladder Pool', [V.task({ seed_keyword: pv.keyword, items: POOL.map((k, i) => V.kwItem(k, i)) }), V.task({ target: D, items: [] })]))[0].json;
    const lch = await run('Ladder Relevance Chunks', [{ json: lp }]);
    mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
    let pt = null;
    if (o.site) {
      mock('Site Model', [{ json: { site_model: o.site } }]);
      const rq = (await run('Ladder Title Requests', EMPTY)).map(r => r.json);
      const asked = rq.filter(r => r.title_check);
      mock('Read Ladder Titles', asked.map(r => o.answer(r)));
      const hops = (await run('Ladder Title Hops', store['Read Ladder Titles'])).map(h => h.json);
      const hopItems = hops.filter(h => h.hop);
      if (hopItems.length) mock('Read Ladder Titles (Redirect)', hopItems.map(h => o.hopAnswer(h)));
      pt = (await run('Ladder Titles', EMPTY))[0].json.page_titles;
      o.trace = { asked: asked.map(r => r.url), hops: hopItems };
    }
    const L = (await run('Ladder Plan', store['Ladder Keyword Relevance']))[0].json.ladder;
    return { L, pt };
  };
  // the Keyword Check, the real nodes (Assess Requests -> Assess Result -> Assess Response) with the same results page
  const checkFor = async (kw, serp) => {
    reset();
    mock('Assess Validate', [{ json: { ok: true, status: 200, keyword: kw, domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', business: 'AI consulting and Microsoft Dynamics partner in the UAE', services: SERVICES, existing_keywords: [], caller: 'app:test' } }]);
    mock('Load Assess Cache', [{ json: { key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 30, method: 'size', p75: null, size_reach: 30, sample: 0, top10: 20, organic_keywords: 300, location_code: LOC }), updated_at: new Date(Date.now() - 3 * 864e5).toISOString() } }]);
    const reqs = (await run('Assess Requests', EMPTY)).map(i => i.json);
    const ans = reqs.map(r => r.kind === 'overview' ? ok('ov-1', 0.01, { items: [{ keyword: kw, keyword_info: { search_volume: 170, cpc: 6.5 }, keyword_properties: { keyword_difficulty: 0 }, search_intent_info: { main_intent: 'commercial' } }] })
      : r.kind === 'serp' ? serp : ok('x-' + r.kind, 0, { items: [] }));
    const ar = (await run('Assess Result', ans.map(j => ({ json: j }))))[0].json; mock('Assess Result', [{ json: ar }]);
    return (await run('Assess Response', [{ json: { output: { fit: 2, navigational: false, alternatives: 'ai consulting services uae' } } }]))[0].json.body;
  };
  const sameSearchPlus = (head, k) => { const hw = head.split(' '); const kw = k.split(' ').map(w => w.replace(/s$/, '')); return hw.every(w => kw.includes(w.replace(/s$/, ''))) && !/\b(services?|company|companies|firms?|agency|provider|partners?|hire|cost|price|pricing)\b/.test(k); };

  // ===================================================================================
  await guard('KL1 ladder head reads its own results page', async () => {
    reset(); const SN = 'KL1 KW-LADDER items 1 + 7 - the ladder judges "ai consultant" on its own results page (job boards included), not on the pages Pick Top 6 kept; its alternatives are buyer searches, never the same search plus a city'; begin(SN); const check = mkCheck(SN);
    const pv = PV('ai consultant', CAREER_ORG, ['What exactly does an AI consultant do?', 'How much does an AI consultant cost?']);
    check('control: competitors_summary holds no job board (Pick Top 6 skips them), so the evidence can only come from the results page itself', !pv.competitors_summary.some(c => /indeed|bayt|glassdoor/.test(c.domain)), J(pv.competitors_summary.map(c => c.domain)));
    const { L } = await planFor(pv, CAREER);
    console.log('   ladder ->', J({ planned: L.planned, refusal: L.refusal && L.refusal.reason, alt: (L.feasibility || {}).alternatives }));
    check('the head is refused as a job or training search with the job boards of its own results page as evidence (indeed, bayt, glassdoor)', L.planned === false && L.refusal && L.refusal.reason === 'career'
      && /indeed\.com/.test(L.refusal.message) && /bayt\.com|glassdoor\.com/.test(L.refusal.message) && !NO_TELLS.test(L.refusal.message), J(L.refusal));
    const alt = (L.feasibility || {}).alternatives || [];
    check('the alternatives offered are never the head plus a place ("ai consultant dubai", "ai consultant uae"); each is a different search or carries a buyer word', alt.length >= 1 && !alt.some(k => sameSearchPlus('ai consultant', k)) && !/"ai consultant (dubai|uae)"/.test(L.refusal.message), J({ alt, msg: L.refusal.message }));
  });

  // ===================================================================================
  await guard('KL2 one reading one verdict', async () => {
    reset(); const SN = 'KL2 KW-LADDER - the Keyword Check and the ladder read the same results page on the same day and give the same verdict: "ai consultant" refused (work or training), "ai consulting dubai" a fit'; begin(SN); const check = mkCheck(SN);
    const kc1 = await checkFor('ai consultant', CAREER);
    const { L: l1 } = await planFor(PV('ai consultant', CAREER_ORG, ['What exactly does an AI consultant do?', 'How much does an AI consultant cost?']), CAREER);
    const kc2 = await checkFor('ai consulting dubai', SERVICE);
    const { L: l2 } = await planFor(PV('ai consulting dubai', SERVICE_ORG, ['How much does AI consulting cost in Dubai?']), SERVICE);
    console.log('   check ->', J([kc1.fit_gate, kc2.fit_gate && kc2.fit_gate.ok]), '| ladder ->', J([l1.refusal && l1.refusal.reason, l2.planned, l2.refusal && l2.refusal.reason]));
    check('"ai consultant": the Keyword Check refuses it as a job search and so does the ladder', kc1.fit === 0 && kc1.fit_gate && kc1.fit_gate.reason === 'job search' && l1.planned === false && l1.refusal && l1.refusal.reason === 'career', J({ kc: kc1.fit_gate, l: l1.refusal }));
    check('both name the same job boards from the one reading', ['indeed.com', 'bayt.com'].every(d => kc1.fit_gate.detail.includes(d) === l1.refusal.message.includes(d)) && /indeed\.com/.test(l1.refusal.message), J({ kc: kc1.fit_gate.detail, l: l1.refusal.message }));
    check('both offer buyer searches, never "ai consultant dubai"', !(kc1.alternatives || []).some(k => sameSearchPlus('ai consultant', k)) && !((l1.feasibility || {}).alternatives || []).some(k => sameSearchPlus('ai consultant', k)) && ((l1.feasibility || {}).alternatives || []).length >= 1,
      J({ kc: kc1.alternatives, l: (l1.feasibility || {}).alternatives }));
    check('"ai consulting dubai": a fit on the Keyword Check and planned by the ladder (no refusal)', kc2.fit_gate && kc2.fit_gate.ok === true && kc2.fit > 0 && l2.planned === true && !l2.refusal, J({ kc: [kc2.fit, kc2.fit_gate], l: [l2.planned, l2.refusal] }));
  });

  // ===================================================================================
  await guard('KL3 the title read', async () => {
    reset(); const SN = 'KL3 KW-LADDER items 9 / 10 / 15 - app-shell titles are not page titles, a 404 page is gone (never the page to improve), redirects followed only to the same page on the client\'s host'; begin(SN); const check = mkCheck(SN);
    const SHELL = 'Tech& | Enterprise Automation & Digital Transformation Solutions';
    const page = (title, h1) => '<!doctype html><html><head><title>' + title.replace(/&/g, '&amp;') + '</title></head><body>' + (h1 ? '<h1>' + h1 + '</h1>' : '<div id="root"></div>') + '</body></html>';
    const P = (p) => HOST + p;
    const GONE = P('/ai-consulting-dubai'), REAL = P('/whatwedo/ai-automation'), SLASH = P('/services/ai-consulting'), OLD = P('/ai-consulting-old'), AWAY = P('/ai-consulting-partner');
    const SHELLS = ['/insights/ai-automation-roadmap', '/insights/ai-strategy-uae', '/insights/ai-governance-dubai'].map(P);
    const urls = [GONE, REAL, SLASH, OLD, AWAY, ...SHELLS];
    const site = { domain: D, canonical_host: 'www.techand.ai', business_name: 'Tech&', pages: [P('/'), ...urls].map(u => ({ url: u, title: '', h1: '', source: 'sitemap', queries: [] })) };
    const o = { site,
      answer: (r) => r.home_ref ? { statusCode: 200, headers: { 'content-type': 'text/html' }, body: page(SHELL, '') }
        : r.url === GONE ? { statusCode: 404, headers: {}, body: '<html><head><title>' + SHELL + '</title></head></html>' }
        : r.url === REAL ? { statusCode: 200, headers: {}, body: page('AI Consulting and Automation | Tech&', 'AI consulting and automation') }
        : r.url === SLASH ? { statusCode: 301, headers: { location: 'https://techand.ai/services/ai-consulting/' }, body: '' }
        : r.url === OLD ? { statusCode: 301, headers: { location: '/' }, body: '' }
        : r.url === AWAY ? { statusCode: 302, headers: { location: 'https://partner-site.com/ai' }, body: '' }
        : { statusCode: 200, headers: {}, body: page(SHELL, '') },
      hopAnswer: (h) => h.of_url === SLASH ? { statusCode: 200, headers: {}, body: page('AI Consulting Services in Dubai | Tech&', 'AI consulting services') } : { statusCode: 200, headers: {}, body: page(SHELL, '') } };
    const pv = PV('ai consulting dubai', SERVICE_ORG, ['How much does AI consulting cost in Dubai?'], { site_urls: [P('/'), ...urls] });
    const { L, pt } = await planFor(pv, SERVICE, o);
    console.log('   asked ->', J(o.trace), '\n   titles ->', J(pt), '\n   top ->', J({ url: (L.top || {}).target_url, exists: (L.top || {}).exists }));
    const readOf = (u) => (pt.read || []).find(r => r.url === u);
    check('every one of the 8 addresses was asked, plus the homepage as a reference (not counted as a page of the plan)', urls.every(u => o.trace.asked.includes(u)) && pt.asked === 8 && /Enterprise Automation/.test(pt.home_title || ''), J({ asked: o.trace.asked, n: pt.asked, home: pt.home_title }));
    check('item 9: the app-shell title is not a page title: none of the three /insights pages is "read" with it, each is judged by its address with the reason', SHELLS.every(u => !readOf(u)) && SHELLS.every(u => (pt.failed || []).some(f => f.url === u && /site-wide title/.test(f.reason)))
      && !(pt.read || []).some(r => /Enterprise Automation/.test(r.title)), J(pt));
    check('item 9 control: a page with its own title is read', readOf(REAL) && /AI Consulting and Automation/.test(readOf(REAL).title), J(pt.read));
    check('item 10: the page that answered 404 is failed with its status', (pt.failed || []).some(f => f.url === GONE && f.status === 404), J(pt.failed));
    check('item 10: the 404 page is never the page to improve for "ai consulting dubai" (its address matches every word)', (L.top || {}).target_url !== GONE && !((L.rungs || []).flatMap(r => r.pages || []).some(p => p.target_url === GONE && p.status === 'improve')), J(L.top));
    check('item 15: a redirect to the same page on the client\'s host (bare host, trailing slash) is followed once and the page keeps its own title', o.trace.hops.length === 1 && o.trace.hops[0].of_url === SLASH && readOf(SLASH) && /AI Consulting Services in Dubai/.test(readOf(SLASH).title), J({ hops: o.trace.hops, read: pt.read }));
    check('item 15: a retired URL that redirects home and one that redirects to another website are reported as redirected, never titled', !readOf(OLD) && !readOf(AWAY)
      && (pt.redirected || []).some(r => r.url === OLD && r.to === HOST + '/' && /another page/.test(r.reason)) && (pt.redirected || []).some(r => r.url === AWAY && /partner-site\.com/.test(r.to) && /another website/.test(r.reason)), J(pt.redirected));
    check('item 15: the redirected addresses are not pages to improve, and the plan says where they go', (L.top || {}).target_url !== OLD && (L.top || {}).target_url !== AWAY
      && (L.notes || []).some(n => /redirect to another address \(.*ai-consulting-old to https:\/\/www\.techand\.ai\//.test(n) && /no longer exist \(they answer 404/.test(n)), J((L.notes || []).filter(n => /Pages read/.test(n))));
  });
};
