// EG1-EG6 (E-GATE, 2026-10-21): the keyword-fit defects of the paid pre-launch run on techand.ai (review: REPORTS_REVIEW.md §2, DRIVER_REPORT.md
// D4 / D12). The client declared seven services, "AI consulting" first. Every check runs the GENERATED code (harness/code_v4) and fails on the
// code before the fix:
//   EG1 D4    two-letter topic words ("ai") were dropped, so "ai consulting services uae", "ai consulting dubai", "best ai consulting firms dubai"
//             were "too broad" for an AI consultancy, and the sentence quoted the keyword as "the keywords you chose"; "ai consulting cost uae"
//             was off topic on the word "cost". A search that carries a whole service name passes; "ai", "google ai", "ai online", "character
//             ai" stay refused.
//   EG2 RV-7  the learned brand "Microsoft UAE" reduced to "uae" and refused every "... uae" keyword without a partner word.
//   EG3 RV-11 a search whose results page is job boards and courses ("ai consultant") is a job search, read from the page, the questions people
//             also ask and the research pool; a buyer word or a training seller keeps it.
//   EG4 RV-11 the ladder: "ai consultant" as the main keyword is refused with the evidence and buyer alternatives, no rung is planned.
//   EG5 RV-11 research: the live check makes it a career search, its reason says so (never "buyers comparing providers"), it goes last and is
//             never the keyword to start with.
//   EG6 D12 / RV-20  AI Growth's set-aside reason no longer adds "written as the keyword ladder page"; the topic radius never quotes the
//             topic's own keyword back as "one of your topics".
// Called from scenarios_v5.js just before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const V = require('./fixtures_v5');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const D = 'techand.ai', SITE = 'site_techand-ai', LOC = 2784;
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  const LABEL = 'what this website sells and the keywords you chose';
  const CTX = { own_domain: D, competitors: [], serp_domains: [], brands: {}, protect: SERVICES, topics: SERVICES, topic_label: LABEL };
  const gate = async (list, ctx) => (await run('_fit_gate', list.map(k => ({ json: { keyword: k, intent: '', ctx } })))).map(i => i.json);
  const by = (rows) => Object.fromEntries(rows.map(r => [r.keyword, r]));
  const NO_TELLS = /[\u2014\u2013\u201c\u201d\u2018\u2019\u2026]/;
  // the results page of "ai consultant" on 2026-10-21 (research live check, r01_discover_report.json): top 5 and the questions people also ask
  const CAREER_PAGES = [{ rank: 1, domain: 'upwork.com', url: 'https://www.upwork.com/hire/ai-consultants/', title: 'Hire the best AI Consultants' },
    { rank: 2, domain: 'usaii.org', url: 'https://www.usaii.org/artificial-intelligence-certifications/certified-artificial-intelligence-consultant', title: 'Certified Artificial Intelligence Consultant (CAIC) | USAII' },
    { rank: 3, domain: 'ae.indeed.com', url: 'https://ae.indeed.com/q-ai-consultant-jobs.html', title: 'Ai Consultant Jobs, Employment in United Arab Emirates' },
    { rank: 4, domain: 'consultancy-me.com', url: 'https://www.consultancy-me.com/industry/ai', title: 'AI consulting firms in the Middle East' },
    { rank: 5, domain: 'ibm.com', url: 'https://www.ibm.com/think/topics/ai-consulting', title: 'What is AI consulting?' }];
  const CAREER_PAA = ['What exactly does an AI consultant do?', "What is AI consulting's salary?", 'How do I become an AI consultant?', 'What is a $900000 AI job?'];
  const POOL_AI = ['ai consultant', 'ai consultant dubai', 'ai consultant company', 'ai consulting services', 'ai consulting dubai', 'ai consultant jobs', 'ai consultant salary', 'ai consultant jobs remote',
    'ai consultant salary uk', 'ai consultant job description', 'ai strategy consultant salary', 'ai consultant course', 'ai consulting firms uae', 'ai implementation consultant uae', 'best ai consulting firms dubai'];

  // ===================================================================================
  await guard('EG1 D4 AI consulting keywords for an AI consultancy', async () => {
    reset(); const SN = 'EG1 E-GATE D4 - a search that carries a whole service name the client gave ("AI consulting", two-letter word included) is not "too broad"; buyer words are neutral; the refusal sentence names the words, not the keyword again'; begin(SN); const check = mkCheck(SN);
    const KEEP = ['ai consulting services uae', 'ai consulting uae', 'ai consulting dubai', 'best ai consulting firms dubai', 'top ai consultants dubai', 'ai consulting cost uae', 'ai consulting'];
    const g = by(await gate([...KEEP, 'ai', 'google ai', 'microsoft ai', 'character ai', 'meta ai'], CTX));
    console.log('   gate ->', J(Object.values(g).map(r => [r.keyword, r.ok ? 'ok' : r.reason])));
    check('the run\'s AI consulting searches pass the gate for a client whose first service is "AI consulting" ("ai consulting services uae" was fit 0 "too broad")', KEEP.every(k => g[k].ok === true), J(KEEP.filter(k => !g[k].ok).map(k => [k, g[k].reason, g[k].detail])));
    check('the bare category and other companies\' AI products are still refused ("ai", "google ai", "microsoft ai" too broad, "character ai" / "meta ai" off topic)',
      g['ai'].reason === 'too broad' && g['google ai'].reason === 'too broad' && g['microsoft ai'].reason === 'too broad' && g['character ai'].reason === 'off topic' && g['meta ai'].ok === false, J([g['ai'], g['character ai'], g['meta ai']]));
    check('the too-broad sentence names the words and does not repeat the keyword as "the keywords you chose (...)"', /only category or place words, "google" and "ai", so nothing in it points to what this website sells/.test(g['google ai'].detail)
      && !/\("google ai"\)/.test(g['google ai'].detail) && !NO_TELLS.test(g['google ai'].detail), g['google ai'].detail);
    // "ai" counts through the client's own phrase, never as a category on its own: a payroll firm (with "HR consulting") is still told "ai
    // consulting uae" is too broad, and an AI consultancy is not handed "ai online", "ai in cloud", "best ai apps" (the S103 regression a bare
    // "ai" topic word caused)
    const PAY = ['Payroll outsourcing', 'Payroll software implementation', 'HR consulting', 'We make it easy for growing companies in Dubai to run payroll, benefits and staff records without spreadsheets'];
    const pay = (await gate(['ai consulting uae'], { ...CTX, topics: PAY, protect: PAY }))[0];
    const wide = by(await gate(['ai online', 'ai in cloud', 'best ai apps', 'ai uae'], { ...CTX, topics: [...SERVICES, 'Cloud services', 'Power Apps'], protect: SERVICES }));
    check('"ai" alone is not a topic word: too broad for a payroll firm, and "ai online", "ai in cloud", "best ai apps", "ai uae" stay too broad for an AI consultancy',
      pay.ok === false && pay.reason === 'too broad' && Object.values(wide).every(r => r.ok === false && r.reason === 'too broad'), J([pay, Object.values(wide).map(r => [r.keyword, r.ok, r.reason])]));
  });

  // ===================================================================================
  await guard('EG2 RV-7 learned brand reduced to a place word', async () => {
    reset(); const SN = 'EG2 E-GATE RV-7 - a learned AI brand counts only through its distinctive words: "Microsoft UAE" no longer refuses every "... uae" keyword; a real brand name still does'; begin(SN); const check = mkCheck(SN);
    const BR = { ...CTX, brands: { 'Microsoft UAE': 'microsoft.com', 'Dubai Holding': 'dubaiholding.com', 'Zoho Books': 'zoho.com', 'ClearTax': 'cleartax.in' } };
    const g = by(await gate(['ai for finance operations uae', 'dynamics 365 finance uae', 'ai consulting uae', 'zoho books uae', 'cleartax e invoicing uae', 'microsoft uae'], BR));
    console.log('   gate ->', J(Object.values(g).map(r => [r.keyword, r.ok ? 'ok' : r.reason + ': ' + r.detail])));
    check('"ai for finance operations uae" (dropped by the pulse as "a brand of Microsoft UAE") and the client\'s other "... uae" searches are no brand of anyone',
      ['ai for finance operations uae', 'dynamics 365 finance uae', 'ai consulting uae'].every(k => g[k].ok === true || g[k].reason !== 'other brand') && ['ai for finance operations uae', 'dynamics 365 finance uae', 'ai consulting uae'].every(k => !/Microsoft UAE/.test(g[k].detail || '')), J(g));
    check('a learned name with a distinctive word still refuses its brand searches ("zoho books uae", "cleartax e invoicing uae")', g['zoho books uae'].reason === 'other brand' && g['cleartax e invoicing uae'].reason === 'other brand', J([g['zoho books uae'], g['cleartax e invoicing uae']]));
    check('the stored name stays in the brand list the AI screen is told about (it is a real company; only its matching changed)', /Microsoft UAE \(microsoft\.com\)/.test(g['ai consulting uae'].brands_text || ''), g['ai consulting uae'].brands_text);
  });

  // ===================================================================================
  await guard('EG3 RV-11 a career search read from its results page', async () => {
    reset(); const SN = 'EG3 E-GATE RV-11 - "ai consultant" is a job search when its results page, its questions and its research pool are about work and training; a buyer word or a training seller keeps it'; begin(SN); const check = mkCheck(SN);
    const CAR = { pages: CAREER_PAGES, paa: CAREER_PAA, related: POOL_AI };
    const g = by(await gate(['ai consultant', 'ai consulting services uae', 'hire ai consultant dubai'], { ...CTX, career: CAR }));
    console.log('   gate ->', J(Object.values(g).map(r => [r.keyword, r.ok ? 'ok' : r.reason + ': ' + r.detail])));
    check('"ai consultant" is refused as a job search, with the evidence (the job board and the course on its results page, a salary question)', g['ai consultant'].ok === false && g['ai consultant'].reason === 'job search'
      && /ae\.indeed\.com/.test(g['ai consultant'].detail) && /usaii\.org/.test(g['ai consultant'].detail) && /salary/i.test(g['ai consultant'].detail) && !NO_TELLS.test(g['ai consultant'].detail), J(g['ai consultant']));
    check('the same results page never refuses a buyer search ("ai consulting services uae", "hire ai consultant dubai")', g['ai consulting services uae'].ok === true && g['hire ai consultant dubai'].ok === true, J([g['ai consulting services uae'], g['hire ai consultant dubai']]));
    const one = (await gate(['ai consultant'], { ...CTX, career: { pages: [CAREER_PAGES[3], CAREER_PAGES[4]], paa: [CAREER_PAA[1]], related: [] } }))[0];
    check('one weak signal alone is not enough (a single salary question and a business results page)', one.ok === true, J(one));
    const trainer = (await gate(['ai consultant'], { ...CTX, topics: [...SERVICES, 'AI consultant certification courses'], protect: SERVICES, career: { pages: [CAREER_PAGES[1], CAREER_PAGES[3]], paa: ['Which AI certification course is best?', 'How long is an AI course?'], related: [] } }))[0];
    check('a site that sells training keeps a search whose only career evidence is courses', trainer.ok === true, J(trainer));
  });

  // ===================================================================================
  await guard('EG4 RV-11 the ladder head', async () => {
    reset(); const SN = 'EG4 E-GATE RV-11 - a keyword ladder for "ai consultant" (results page: a job board and a certification course; pool: jobs and salary searches) is refused with the evidence and buyer alternatives'; begin(SN); const check = mkCheck(SN);
    const SF = { se_results_count: 1200000, checked_at: '2026-10-21T14:10:46.000Z', people_also_ask: CAREER_PAA, related_searches: ['ai consultant salary'], forum_threads: [], featured_snippet: null,
      ai_overview: { present: true, text: '', cited_domains: [], seen_at: '2026-10-21T14:10:46.000Z' }, features_present: ['people_also_ask', 'ai_overview'], video_results: false, shopping_results: false, local_pack: false };
    const PV = { keyword: 'ai consultant', domain: D, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', goal: 'leads', email: '', callback_url: '', request_id: 'r-eg4', ladder_id: 'lad_eg4', pages_now: 1, page_type: 'Service Page', recommended_page: 'Service Page',
      // KW-LADDER (review item 1): competitors_summary is what Pick Top 6 hands the analysis - it skips job boards, so ae.indeed.com is
      // never in it; the job board reaches the ladder only through the head's own results page (SERP Top 10, mocked in planFor)
      competitors: [], competitors_summary: CAREER_PAGES.filter(c => !/indeed/.test(c.domain)), serp_features: SF, business: 'Microsoft partner in Dubai for enterprises in the UAE and GCC: AI consulting and automation, Microsoft Copilot, Dynamics 365 business applications', services: SERVICES,
      site_description: { business_description: 'Microsoft partner in Dubai', products_or_services: SERVICES },
      keyword_data: { search_volume: 170, cpc: 16.2, keyword_difficulty: 0, google_intent: 'commercial', competitor_backlink_strength: { avg_referring_domains: 4 } }, verdict: 'GO_WITH_CHANGES', verdict_score: 68, verdict_reasons: ['Competition is weak.'], verdict_changes: [], verdict_risks: [], secondary_keywords: ['ai consultant dubai', 'ai consulting services'],
      site_authority: { organic_keywords: 12, top3: 0, top10: 0, est_monthly_traffic: 20 }, site_urls: ['https://' + D + '/'], expected_visits_top3: 40, time_to_rank_months: 3 };
    const serpTop = (kw, pages, paa) => V.task({ keyword: kw, items: [...pages.map(p => ({ type: 'organic', rank_group: p.rank, rank_absolute: p.rank, domain: p.domain, url: p.url, title: p.title })),
      ...(paa.length ? [{ type: 'people_also_ask', items: paa.map(q => ({ title: q })) }] : [])] });
    const planFor = async (pv, serp) => {
      reset(); mock('Parse Verdict', pv); mock('SERP Top 10', serp || serpTop(pv.keyword, CAREER_PAGES, CAREER_PAA));
      mock('Ladder Requests', [{ kind: 'suggestions', label: 'suggestions for ' + pv.keyword, body: [{ keyword: pv.keyword }] }, { kind: 'ranked', label: 'keywords ' + D + ' ranks for', domain: D, body: [{ target: D }] }]);
      mock('Load Site Cache', [{ json: { id: 1, key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 10, method: 'size', p75: null, size_reach: 10, sample: 0, top10: 3, organic_keywords: 12, location_code: LOC }), updated_at: new Date(Date.now() - 3 * 864e5).toISOString() } }]);
      mock('Load Domain Ladders', [{ json: {} }]); mock('Load Domain Ladder Settings', [{ json: {} }]);
      const lp = (await run('Ladder Pool', [V.task({ seed_keyword: pv.keyword, items: POOL_AI.map((k, i) => V.kwItem(k, i)) }), V.task({ target: D, items: [] })]))[0].json;
      const lch = await run('Ladder Relevance Chunks', [{ json: lp }]);
      mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
      return { lp, L: (await run('Ladder Plan', store['Ladder Keyword Relevance']))[0].json.ladder };
    };
    const { lp, L } = await planFor(PV);
    console.log('   pool refused ->', J(lp.research.refused.map(r => r.keyword + ':' + r.reason)), '| ladder ->', J({ planned: L.planned, plan: L.plan_type, label: L.label, refusal: L.refusal, alt: (L.feasibility || {}).alternatives }));
    check('the ladder is not planned and the refusal says why in plain words, with the job board, the course and the questions people ask', L.planned === false && L.plan_type === 'none' && L.refusal && L.refusal.reason === 'career'
      && /mostly looking for work or training/.test(L.refusal.message) && /ae\.indeed\.com/.test(L.refusal.message) && /usaii\.org/.test(L.refusal.message) && !NO_TELLS.test(L.refusal.message), J(L.refusal));
    check('nothing is written for it, and the label says no ladder was planned', Array.isArray(L.write_now) && L.write_now.length === 0 && /No ladder planned · people search it to find work or training/.test(L.label), J({ write_now: L.write_now, label: L.label }));
    check('the refusal offers searches buyers make from its own pool (none of them a job or salary search)', Array.isArray(L.feasibility.alternatives) && L.feasibility.alternatives.length >= 1
      && L.feasibility.alternatives.every(k => !/jobs?|salary|course/.test(k)) && L.feasibility.alternatives.some(k => L.refusal.message.includes('"' + k + '"')), J({ alt: L.feasibility.alternatives, msg: L.refusal.message }));
    // the same head with a buyer results page and buyer questions is planned as before
    const BUY = [{ rank: 1, domain: 'consultancy-me.com', url: 'https://www.consultancy-me.com/industry/ai', title: 'AI consulting firms in the Middle East' }, { rank: 2, domain: 'itransition.com', url: 'https://www.itransition.com/ai/consulting', title: 'AI consulting services' },
      { rank: 3, domain: 'thehackettgroup.com', url: 'https://www.thehackettgroup.com/ai-consulting/', title: 'AI consulting' }, { rank: 4, domain: 'masterofcode.com', url: 'https://masterofcode.com/ai-consulting', title: 'AI consulting company' }];
    const { L: Lb } = await planFor({ ...PV, keyword: 'ai consulting dubai', competitors_summary: BUY, serp_features: { ...SF, people_also_ask: ['How much does AI consulting cost?', 'What does an AI consulting firm do?'] } },
      serpTop('ai consulting dubai', BUY, ['How much does AI consulting cost?', 'What does an AI consulting firm do?']));
    check('a buyer head ("ai consulting dubai", consulting firms on its results page) is still planned', Lb.planned === true && !(Lb.refusal && Lb.refusal.reason === 'career'), J({ planned: Lb.planned, refusal: Lb.refusal, label: Lb.label }));
  });

  // ===================================================================================
  await guard('EG5 RV-11 research labels', async () => {
    reset(); const SN = 'EG5 E-GATE RV-11 - research: a priority keyword whose live results page is job boards and courses is labelled for what it is, goes last and is never the keyword to start with'; begin(SN); const check = mkCheck(SN);
    const kw = (keyword, o) => ({ keyword, volume: 170, kd: 0, cpc: 13.85, intent: 'commercial', page_type: 'Service Page', opportunity: 79, competitors_in_top20: 0, serp_types: ['organic', 'people_also_ask'], topic: 'ai consulting', service_fit: 'unknown', ...(o || {}) });
    const pr = [kw('ai consultant', { opportunity: 90 }), kw('ai consulting dubai', { volume: 90, opportunity: 60 }), kw('ai consulting services uae', { volume: 50, opportunity: 50 })];
    mock('Rank Keywords', [{ json: { domain: D, country: 'United Arab Emirates', services: SERVICES, seeds: ['ai consulting'], keyword_strategy: { goal: 'leads', pool_size: 40, total_relevant: 3,
      keywords: [...pr, ...['ai consultant company', 'ai consultant course'].map(k => kw(k, { opportunity: 5 }))], priority: pr, quick_wins: [], clusters: [], questions: [], long_tail: [], competitor_gaps: [], by_intent: { commercial: pr, transactional: [], informational: [] },
      pipeline_keyword: pr[0], refused: ['ai consultant jobs', 'ai consultant salary', 'ai consultant jobs remote', 'ai consultant salary uk', 'ai consultant job description', 'ai strategy consultant salary'].map(k => ({ keyword: k, volume: 10, reason: 'job search', detail: 'people looking for work' })),
      service_fit: { declared_services: SERVICES, judged_on: 'the services you listed', in: 0, unknown: 3, out: 0 } } } }]);
    mock('Priority Keywords', pr.map(p => ({ json: { keyword: p.keyword } })));
    mock('AI Demand', [{ json: {} }]);
    const serp = (keyword, pages, paa) => V.task({ keyword, datetime: '2026-10-21 14:10:46 +00:00', items: [...pages.map((p, i) => ({ type: 'organic', rank_group: i + 1, rank_absolute: i + 1, domain: p.domain, url: p.url, title: p.title })),
      { type: 'people_also_ask', items: paa.map(q => ({ title: q })) }] });
    const BUY = [{ domain: 'consultancy-me.com', url: 'https://www.consultancy-me.com/industry/ai', title: 'AI consulting firms in the Middle East' }, { domain: 'itransition.com', url: 'https://www.itransition.com/ai/consulting', title: 'AI consulting services' }];
    const out = (await run('Build Keyword Strategy', [{ json: serp('ai consultant', CAREER_PAGES, CAREER_PAA) }, { json: serp('ai consulting dubai', BUY, ['How much does AI consulting cost?']) }, { json: serp('ai consulting services uae', BUY, []) }]))[0].json;
    const K = out.keyword_strategy, P = K.priority, a = P.find(k => k.keyword === 'ai consultant') || {};
    console.log('   priority ->', J(P.map(k => [k.keyword, !!k.career, String(k.why || '').slice(0, 120)])), '| start with ->', J(K.pipeline_keyword && K.pipeline_keyword.keyword));
    check('"ai consultant" is marked a career search and its reason says so, never "buyers comparing providers"', !!a.career && /mostly looking for work or training/.test(a.why) && !/buyers comparing providers/.test(a.why) && /ae\.indeed\.com/.test(a.why) && !NO_TELLS.test(a.why), J(a.why));
    check('the buyer searches keep their label ("buyers comparing providers")', P.filter(k => k.keyword !== 'ai consultant').every(k => !k.career && /buyers comparing providers/.test(k.why)), J(P.map(k => [k.keyword, k.why])));
    // KW-GATE (review 12): the replacement must be one of the client's services (fit "in"); here every other keyword is "unknown", so there is none
    check('it goes to the end of the priority list and is not the keyword to start with', P[P.length - 1].keyword === 'ai consultant' && (!K.pipeline_keyword || K.pipeline_keyword.keyword !== 'ai consultant')
      && (out.keyword_suggestions.recommended[0] || {}).keyword !== 'ai consultant', J({ order: P.map(k => k.keyword), start: K.pipeline_keyword && K.pipeline_keyword.keyword, rec0: (out.keyword_suggestions.recommended[0] || {}).keyword }));
  });

  // ===================================================================================
  await guard('EG6 D12 RV-20 reasons that contradict themselves', async () => {
    reset(); const SN = 'EG6 E-GATE D12 / RV-20 - an AI Growth target set aside is never also "written as the keyword ladder page"; the topic radius never quotes a topic\'s own keyword as one of your topics'; begin(SN); const check = mkCheck(SN);
    // D12: a question to win whose keyword the gate refuses (a government portal task) while a planned ladder page shares its words
    const W = 'https://techand.ai'; const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const gaps = [{ prompt_id: 'p_f', prompt: 'How do I log in to the FTA e-invoicing portal?', kind: 'problem', topic: 'fta e invoicing login', competitors: ['example.ae'], volume: 90, stage: 'awareness', fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } }];
    reset();
    mock('Load Sites', [{ json: { site_id: SITE, domain: D, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', services_json: JSON.stringify(['E-invoicing compliance', 'Dynamics 365 Finance']), declared_services: '' } }]);
    mock('Load Ladders', [{ json: { ladder_id: 'lad_ei', site_id: SITE, domain: D, head_keyword: 'e invoicing uae', keyword: 'fta e invoicing login guide', rung: 1, page_no: 2, status: 'planned', target_url: W + '/fta-e-invoicing-login-guide' } }]);
    mock('Load Monitors', [{ json: { site_id: SITE, domain: D, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: { site_id: SITE, domain: D, run_id: 'ai_1', checked_at: ago(1), gaps_json: J(gaps), pages_json: '[]', competitors_json: '[]' } }]);
    mock('Load AI Prompts', gaps.map(g => ({ json: { prompt_id: g.prompt_id, site_id: SITE, prompt: g.prompt, kind: g.kind, keyword: g.topic, status: 'active' } })));
    mock('Load Content Log', [{ json: {} }]); mock('Load Query History', [{ json: {} }]); mock('Load AI Pages', [{ json: {} }]);
    mock('Load AI Targets', [{ json: {} }]); mock('Load AI Growth', [{ json: {} }]); mock('Load Link Prospects (Growth)', [{ json: {} }]); mock('Load AI Answers', [{ json: {} }]); mock('Load Cache (Growth)', [{ json: {} }]);
    const G = (await run('Growth Plan', [{ json: {} }]))[0].json; const t = G.targets.find(x => x.prompt_id === 'p_f') || {};
    console.log('   target ->', J([t.keyword, t.status, t.reason]));
    check('the set-aside target says it is set aside and nothing else about a page (no "written as the keyword ladder page")', t.status === 'set_aside' && /set aside, so no page is written for it/.test(t.reason)
      && !/written as the keyword ladder page/.test(t.reason) && !/no page answers it yet|^refresh /.test(t.reason.replace(/^.*set aside, so no page is written for it\.\s*/, '')), J(t));
    // RV-20: the ladder passes its head as a site topic; the head's own topic is judged on what the site sells, not on itself
    const rad = (await run('_radius', [{ json: { reach: 10, reach_method: 'size', domain: D, services: ['AI consulting'], site_topics: ['ai consultant', 'AI strategy consulting Dubai'],
      topics: [{ topic: 'ai consultant', primary_keyword: 'ai consultant', kd: 0, volume: 170, keyword_count: 2, keywords: [{ keyword: 'ai strategy consulting dubai' }] }], pick: 'ai consultant' } }]))[0].json;
    const ev = (rad.picked || {}).evidence || [];
    console.log('   radius ->', J(ev));
    check('the topic radius never quotes the topic\'s own keyword as "one of your topics" ("AI strategy consulting Dubai" was the plan\'s own keyword)', !ev.some(e => /one of your topics/.test(e)) && ev.some(e => /it matches what you sell: "AI consulting"/.test(e)), J(ev));
    const rad2 = (await run('_radius', [{ json: { reach: 10, domain: D, services: [], site_topics: ['ai consultant'], topics: [{ topic: 'ai consultant dubai', primary_keyword: 'ai consultant dubai', kd: 0, volume: 90, keyword_count: 1 }], pick: 'ai consultant dubai' } }]))[0].json;
    check('a different topic may still name the ladder\'s head as one of your topics', ((rad2.picked || {}).evidence || []).some(e => /one of your topics: "ai consultant"/.test(e)), J((rad2.picked || {}).evidence));
  });
};
