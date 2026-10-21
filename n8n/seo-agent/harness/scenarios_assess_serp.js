// AS1-AS4 (E-SERP, 2026-10-21): the Keyword Check reads ONE Google results page for the keyword, like the ladder head and the research, so
// the same keyword gets the same verdict on every path. Before this the check read no results page and rated "ai consultant" (upwork, a USAII
// certification, indeed, bayt, glassdoor; "people also ask" about salary) a fit and Easy while the ladder refused it. Every check runs the
// GENERATED code (harness/code_v4) and fails on the code before the fix:
//   AS1 "ai consultant" with its career results page -> fit 0, the job-or-training reason with the evidence, buyer alternatives only
//   AS2 "ai consulting dubai" with a page of service pages -> fit 2, the page read, Google ranks service pages, no career word
//   AS3 the results page fails inside HTTP 200 (40101) -> re-sent once by the in-200 gate, then "results page not read" and judged without it
//   AS4 the results page's cost reaches the run ledger, counted once by task id across both attempts
// Called from scenarios_v5.js just before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const D = 'techand.ai', SITE = 'site_techand-ai', LOC = 2784;
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const EMPTY = [{ json: {} }];
  const NO_DEMAND = /no demand|no search demand|nobody searches/i;
  const env = (task) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', tasks: [task] });
  const ok = (id, cost, result) => env({ id, status_code: 20000, status_message: 'Ok.', cost, result: [result] });
  const overview = (id, kw) => ok(id, 0.01, { items: [{ keyword: kw, keyword_info: { search_volume: 320, cpc: 6.5 }, keyword_properties: { keyword_difficulty: 22 }, search_intent_info: { main_intent: 'commercial' } }] });
  const position = (id) => ok(id, 0.01, { items: [] });
  const org = (rank, domain, url, title) => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain, url, title });
  const serpOf = (id, kw, organic, paa, related) => ok(id, 0.002, { keyword: kw, datetime: '2026-10-21 08:00:00 +00:00', items: [...organic,
    ...(paa.length ? [{ type: 'people_also_ask', items: paa.map(q => ({ type: 'people_also_ask_element', title: q })) }] : []),
    ...(related.length ? [{ type: 'related_searches', items: related }] : [])] });
  const CAREER = serpOf('serp-c1', 'ai consultant', [org(1, 'www.upwork.com', 'https://www.upwork.com/hire/ai-consultants/', 'Hire the best AI Consultants'),
    org(2, 'www.usaii.org', 'https://www.usaii.org/artificial-intelligence-certifications/certified-artificial-intelligence-consultant', 'Certified Artificial Intelligence Consultant (CAIC) | USAII'),
    org(3, 'ae.indeed.com', 'https://ae.indeed.com/q-ai-consultant-jobs.html', 'Ai Consultant Jobs, Employment in United Arab Emirates'),
    org(4, 'www.bayt.com', 'https://www.bayt.com/en/uae/jobs/ai-consultant-jobs/', 'AI Consultant Jobs in UAE'),
    org(5, 'www.glassdoor.com', 'https://www.glassdoor.com/Salaries/ai-consultant-salary-SRCH_KO0,13.htm', 'AI Consultant Salary'),
    org(6, 'www.ibm.com', 'https://www.ibm.com/think/topics/ai-consulting', 'What is AI consulting?')],
    ['What exactly does an AI consultant do?', "What is AI consulting's salary?", 'How do I become an AI consultant?'],
    ['ai consultant salary', 'ai consultant jobs', 'ai consulting services dubai', 'ai consulting company uae']);
  const SERVICE = serpOf('serp-s1', 'ai consulting dubai', [org(1, 'www.alpha-ai.ae', 'https://www.alpha-ai.ae/services/ai-consulting/', 'AI Consulting Services in Dubai | Alpha AI'),
    org(2, 'www.beta.ae', 'https://www.beta.ae/solutions/artificial-intelligence/', 'AI Consulting Solutions Dubai | Beta'),
    org(3, 'gamma.com', 'https://gamma.com/services/ai-strategy-dubai/', 'AI Strategy and Consulting Services Dubai'),
    org(4, 'delta.ae', 'https://delta.ae/services/ai/', 'Artificial Intelligence Consulting Services | Delta'),
    org(5, 'epsilon.io', 'https://epsilon.io/products/ai-platform/', 'AI Platform and Consulting Services')], ['How much does AI consulting cost in Dubai?'], []);
  const FIT = (fit, alternatives) => [{ json: { output: { fit, navigational: false, alternatives: alternatives || '' } } }];
  const start = async (kw) => {
    const V = { ok: true, status: 200, keyword: kw, domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', business: 'AI consulting and Microsoft Dynamics partner in the UAE', services: SERVICES, existing_keywords: [], caller: 'app:test' };
    mock('Assess Validate', [{ json: V }]);
    mock('Load Assess Cache', [{ json: { key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 30, method: 'size', p75: null, size_reach: 30, sample: 0, top10: 20, organic_keywords: 300, location_code: LOC }), updated_at: daysAgo(3) } }]);
    return (await run('Assess Requests', EMPTY)).map(i => i.json);
  };
  const answersFor = (reqs, serp, kw) => reqs.map(r => r.kind === 'overview' ? overview('ov-1', kw) : r.kind === 'position' ? position('pos-1') : r.kind === 'serp' ? serp : ok('x-' + r.kind, 0, { items: [] }));
  const respond = async (input, fit, alts) => { const ar = (await run('Assess Result', input))[0].json; mock('Assess Result', [{ json: ar }]); return { ar, body: (await run('Assess Response', FIT(fit, alts)))[0].json.body }; };

  // ===================================================================================
  await guard('AS1 E-SERP "ai consultant" read from its results page', async () => {
    reset(); const SN = 'AS1 E-SERP - the Keyword Check reads the results page of "ai consultant" (job boards, a certification, salary questions) and gives the ladder\'s verdict: fit 0, a career search'; begin(SN); const check = mkCheck(SN);
    const reqs = await start('ai consultant');
    const sq = reqs.find(r => r.kind === 'serp');
    check('one organic results page is asked for: live/advanced, 30 deep with the AI Overview (KW-SERP: the one shape every path sends), the site\'s location and language (the ladder head\'s request fields)',
      !!sq && /serp\/google\/organic\/live\/advanced$/.test(sq.endpoint) && J(Object.keys(sq.body[0]).sort()) === J(['depth', 'keyword', 'language_code', 'load_async_ai_overview', 'location_code']) && sq.body[0].depth === 30 && sq.body[0].load_async_ai_overview === true && sq.body[0].location_code === LOC && sq.body[0].keyword === 'ai consultant'
        && reqs.filter(r => r.kind === 'serp').length === 1, J(reqs.map(r => [r.kind, r.body])));
    const { body } = await respond(answersFor(reqs, CAREER, 'ai consultant').map(j => ({ json: j })), 2, 'ai consultant salary, ai consulting services uae, ai consultant course');
    console.log('   keyword check ->', J({ fit: body.fit, gate: body.fit_gate, alts: body.alternatives, serp: body.serp, label: body.label }));
    check('fit 0 from the gate with the career reason and its evidence (job boards, a course site, the salary question), whatever the model said',
      body.fit === 0 && body.fit_source === 'gate' && body.fit_gate.ok === false && body.fit_gate.reason === 'job search' && /looking for work or training/.test(body.fit_gate.detail)
        && /indeed\.com/.test(body.fit_gate.detail) && /usaii\.org/.test(body.fit_gate.detail) && /salary/i.test(body.fit_gate.detail) && /not a fit: people search it to find work or training/.test(body.label), J(body.fit_gate) + ' ' + body.label);
    check('buyer alternatives only: the model\'s salary and course searches are dropped, buyer searches from the model and the related searches are kept',
      body.alternatives.length >= 1 && body.alternatives.includes('ai consulting services uae') && body.alternatives.every(k => !/salary|jobs?|course|certif/.test(k)), J(body.alternatives));
    check('the answer carries the page it read', body.serp && body.serp.read === true && body.serp.pages_read === 6 && body.fit_judged_without_serp === false && body.serp.top[0] === 'www.upwork.com', J(body.serp));
  });

  // ===================================================================================
  await guard('AS2 E-SERP "ai consulting dubai" with service pages', async () => {
    reset(); const SN = 'AS2 E-SERP - "ai consulting dubai" with a results page of service pages stays a core fit (2), and the check says Google ranks service pages'; begin(SN); const check = mkCheck(SN);
    const reqs = await start('ai consulting dubai');
    const { body } = await respond(answersFor(reqs, SERVICE, 'ai consulting dubai').map(j => ({ json: j })), 2, '');
    console.log('   keyword check ->', J({ fit: body.fit, gate: body.fit_gate, serp: body.serp, warnings: body.warnings }));
    check('fit 2, no refusal, no career wording', body.fit === 2 && body.fit_gate.ok === true && !/work or training|job/.test(J(body.warnings) + body.label), J({ fit: body.fit, gate: body.fit_gate, label: body.label, w: body.warnings }));
    check('the page was read and Google ranks service pages there', body.serp && body.serp.read === true && body.serp.page_types && body.serp.page_types.dominant === 'Service or product page' && body.serp.pages_read === 5
      && !body.warnings.some(w => /^what Google ranks|results page not read/.test(w)), J({ serp: body.serp, w: body.warnings }));
  });

  // ===================================================================================
  await guard('AS3 E-SERP a results page that fails inside HTTP 200', async () => {
    reset(); const SN = 'AS3 E-SERP - a 40101 inside a 200 is re-sent once by the in-200 gate; failed twice, the check says the page was not read and judges the fit without it (never "no demand")'; begin(SN); const check = mkCheck(SN);
    const reqs = await start('ai consultant');
    const fail = (id) => env({ id, status_code: 40101, status_message: 'Internal SE Server Error.', cost: 0 });
    mock('Run Assess Requests', answersFor(reqs, fail('serp-f1'), 'ai consultant'));
    const plan = (await run('Run Assess Requests Retry Plan', store['Run Assess Requests'])).map(i => i.json);
    check('the gate re-sends the results page, and only it', plan.length === 1 && plan[0].is_retry === true && plan[0].kind === 'serp', J(plan));
    mock('Run Assess Requests (Retry)', [fail('serp-f2')]);
    const merged = await run('Run Assess Requests Answers', store['Run Assess Requests']);
    const { ar, body } = await respond(merged, 2, '');
    console.log('   keyword check ->', J({ fit: body.fit, serp: body.serp, warnings: body.warnings, ok: ar.ok }));
    check('the check still answers (200), with the model\'s fit, judged without the page, and says so with the provider\'s reason',
      ar.ok === true && body.fit === 2 && body.fit_judged_without_serp === true && body.serp.read === false && body.serp.asked === true && /Internal SE Server Error/.test(body.serp.why)
        && body.warnings.some(w => /^results page not read \(Internal SE Server Error\.[^)]*\)\): the fit was judged without it/.test(w)), J({ serp: body.serp, w: body.warnings }));
    check('an unread page is never "no demand"', !NO_DEMAND.test(J(body)), J(body.warnings));
  });

  // ===================================================================================
  await guard('AS4 E-SERP the results page in the run ledger', async () => {
    reset(); const SN = 'AS4 E-SERP - the results page\'s cost reaches the Keyword Check\'s ledger row and its cost_usd, counted once by task id across both attempts'; begin(SN); const check = mkCheck(SN);
    const settle = async (body) => { mock('Run Ledger Row (Assess)', [{ json: { run_id: 'test-exec', mode: 'assess', est_usd: 0.0033, dfs_est_usd: 0.034, cost_mode: 'assess' } }]);
      mock('Assess Response', [{ json: { status: 200, body } }]); return (await run('Ledger Settle (Assess)', EMPTY))[0].json; };
    // a first attempt that did the work and answered empty (billed), re-sent; the retry repeats the same task id -> one task, $0.002 once
    const reqs = await start('ai consultant');
    const emptySerp = ok('serp-e1', 0.002, null);   // 20000 with no result: the work was done and billed, and RT re-sends it
    mock('Run Assess Requests', answersFor(reqs, emptySerp, 'ai consultant'));
    const plan = (await run('Run Assess Requests Retry Plan', store['Run Assess Requests'])).map(i => i.json);
    mock('Run Assess Requests (Retry)', [{ ...CAREER, tasks: [{ ...CAREER.tasks[0], id: 'serp-e1' }] }]);
    const merged = await run('Run Assess Requests Answers', store['Run Assess Requests']);
    const { ar, body } = await respond(merged, 2, '');
    const L = await settle(body);
    console.log('   ledger ->', J({ plan: plan.map(p => p.kind), dfs_cost: ar.dfs_cost, cost_usd: body.cost_usd, dfs_usd: L.dfs_usd }));
    check('overview $0.01 + position $0.01 + the results page $0.002 once (same task id on both attempts) = $0.022, and the career verdict from the retried page',
      plan.length === 1 && plan[0].kind === 'serp' && ar.dfs_cost === 0.022 && body.fit === 0 && body.serp.read === true, J({ plan, dfs: ar.dfs_cost, fit: body.fit }));
    check('the ledger row settles the same DataForSEO figure the caller was told, measured', L.dfs_usd === 0.022 && L.dfs_measured === true && Math.abs(body.cost_usd - (0.022 + 0.0033)) < 1e-9 && L.reported_usd === body.cost_usd, J(L));
    // two distinct tasks (both billed) are both money that moved
    const reqs2 = await start('ai consultant');
    mock('Run Assess Requests', answersFor(reqs2, emptySerp, 'ai consultant'));
    await run('Run Assess Requests Retry Plan', store['Run Assess Requests']);
    mock('Run Assess Requests (Retry)', [{ ...CAREER, tasks: [{ ...CAREER.tasks[0], id: 'serp-e2' }] }]);
    const m2 = await run('Run Assess Requests Answers', store['Run Assess Requests']);
    const r2 = await respond(m2, 2, '');
    check('two billed attempts with their own task ids count both ($0.024), never three', r2.ar.dfs_cost === 0.024, J(r2.ar.dfs_cost));
  });
};
