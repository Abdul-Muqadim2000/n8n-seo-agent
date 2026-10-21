// SC1-SC5 (KW-SERP, 2026-10-21, pre-launch run RV-12 / A-21 of 2026-10-17): ONE Google results-page reading per search and day, shared by
// every path. On 2026-10-21 the research, the ladder and the rank tracker read three different results pages for "ai consultant" the same
// day; on 2026-10-17 two runs three minutes apart said "no AI Overview" and "an AI Overview was seen". Every check runs the GENERATED code
// (harness/code_v4); before the change the nodes SC2-SC5 run did not exist (the guard fails on "no code") and the Keyword Check sent a
// second results-page request for a search read minutes earlier (SC2's "no second request" fails on the pre-change Assess Requests).
//   SC1 the kit: key, same day hit at cost 0, another day / location / device misses, depth and AI Overview needs, failed reads never stored
//   SC2 the Keyword Check: the second check of the same keyword the same day sends no results-page request, costs nothing for it, says when it was read
//   SC3 the ladder head and the Keyword Check share one reading: the same top pages, the same AI Overview answer, the same career verdict
//   SC4 the ladder's rung reads: only keywords not read today are bought; all read today = nothing bought; fresh readings stored, failed ones not
//   SC5 depth: a reading too shallow for a path (the head needs 30 + the AI Overview; the rank tracker 50) is bought again and replaces the row
//   SC6 the research live checks and the Keyword Check share the page, whichever comes first; the research's gate pairs only what it sent
//   SC7 the Rank Tracker (50 deep + AI Overview) refreshes the row, and its reading serves a later Keyword Check; costs counted once
// Called from scenarios_v5.js just before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const D = 'techand.ai', SITE = 'site_techand-ai', LOC = 2784;
  const EMPTY = [{ json: {} }];
  const now = new Date();
  const dfsTime = (d) => d.toISOString().slice(0, 19).replace('T', ' ') + ' +00:00';
  const today = dfsTime(new Date(now.getTime() - 60 * 1000)), yesterday = dfsTime(new Date(now.getTime() - 864e5));
  const hhmm = today.slice(11, 16);
  const org = (rank, domain, url, title) => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain, url, title, description: 'About ' + title });
  const CAREER_PAGES = [org(1, 'www.upwork.com', 'https://www.upwork.com/hire/ai-consultants/', 'Hire the best AI Consultants'),
    org(2, 'www.usaii.org', 'https://www.usaii.org/artificial-intelligence-certifications/certified-artificial-intelligence-consultant', 'Certified Artificial Intelligence Consultant (CAIC) | USAII'),
    org(3, 'ae.indeed.com', 'https://ae.indeed.com/q-ai-consultant-jobs.html', 'Ai Consultant Jobs, Employment in United Arab Emirates'),
    org(4, 'www.bayt.com', 'https://www.bayt.com/en/uae/jobs/ai-consultant-jobs/', 'AI Consultant Jobs in UAE'),
    org(5, 'www.glassdoor.com', 'https://www.glassdoor.com/Salaries/ai-consultant-salary-SRCH_KO0,13.htm', 'AI Consultant Salary'),
    org(6, 'www.ibm.com', 'https://www.ibm.com/think/topics/ai-consulting', 'What is AI consulting?')];
  const AIO = { type: 'ai_overview', rank_group: 1, rank_absolute: 1, asynchronous_ai_overview: false, items: [{ type: 'ai_overview_element', title: 'AI consultants', text: 'An AI consultant advises companies.', references: [{ domain: 'www.ibm.com', url: 'https://www.ibm.com/think/topics/ai-consulting', title: 'IBM' }] }],
    references: [{ domain: 'www.ibm.com', url: 'https://www.ibm.com/think/topics/ai-consulting', title: 'IBM' }] };
  const PAA = { type: 'people_also_ask', rank_group: 1, rank_absolute: 7, items: [{ type: 'people_also_ask_element', title: 'What exactly does an AI consultant do?' }, { type: 'people_also_ask_element', title: "What is AI consulting's salary?" }] };
  const REL = { type: 'related_searches', rank_group: 1, rank_absolute: 12, items: ['ai consultant salary', 'ai consultant jobs', 'ai consulting services dubai'] };
  // an answer in DataForSEO's shape; `data` echoes the request like the live API does
  const serp = (id, kw, body, items, o = {}) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', cost: o.cost || 0.002, tasks: [{ id, status_code: 20000, status_message: 'Ok.', cost: o.cost || 0.002,
    data: { api: 'serp', function: 'live', se: 'google', se_type: 'organic', keyword: kw, location_code: LOC, language_code: 'en', ...body },
    result: [{ keyword: kw, location_code: LOC, language_code: 'en', datetime: o.at || today, se_results_count: 1200000, item_types: [...new Set(items.map(x => x.type))], items }] }] });
  const fail = (id, code, msg) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', cost: 0, tasks: [{ id, status_code: code, status_message: msg, cost: 0, result: null }] });
  const kit = async (fn, ...args) => (await run('_serp_cache', [{ json: { fn, args } }]))[0].json.r;
  const B10 = (kw, o = {}) => ({ keyword: kw, location_code: LOC, language_code: 'en', depth: 10, ...o });
  const HEAD_BODY = (kw) => ({ keyword: kw, location_code: LOC, language_code: 'en', depth: 30, load_async_ai_overview: true });

  // ===================================================================================
  await guard('SC1 KW-SERP the results-page cache kit', async () => {
    reset(); const SN = 'SC1 KW-SERP - one reading per keyword, location, language, device and UTC day; deep enough, AI Overview when needed; a failed read is never stored'; begin(SN); const check = mkCheck(SN);
    const k1 = await kit('key', { keyword: '  AI   Consultant ', location_code: LOC, language_code: 'EN' });
    const k2 = await kit('key', { keyword: 'ai consultant', location_code: String(LOC), language_code: 'en', device: 'desktop' });
    check('the key: keyword in lower case with its spaces collapsed, the location, the language, the device (desktop when unsaid), and no date in the row key',
      k1 === k2 && k1 === 'serp:ai consultant|2784|en|desktop', J([k1, k2]));
    const fresh = serp('t-head-1', 'ai consultant', { depth: 30, load_async_ai_overview: true }, [AIO, ...CAREER_PAGES, PAA, REL]);
    const row = await kit('rowFor', fresh, HEAD_BODY('ai consultant'), '');
    const val = JSON.parse(row.value);
    check('a fresh reading becomes one seo_cache row with exactly the table columns, the day, the depth, the AI Overview loaded and seen, the paid task id and its cost',
      J(Object.keys(row).sort()) === J(['key', 'kind', 'site_id', 'updated_at', 'value']) && row.kind === 'serp' && val.day === now.toISOString().slice(0, 10) && val.depth === 30 && val.aio_loaded === true
        && val.ai_overview_seen === true && val.task_id === 't-head-1' && val.cost === 0.002 && row.value.length < 20000, J({ row: { ...row, value: row.value.length }, val: { day: val.day, depth: val.depth } }));
    const hit = await kit('lookup', [row], B10('AI consultant'));
    const t = hit.response.tasks[0];
    check('the same search the same day is a hit for a path that needs less (10 deep): cost 0, task id cache:<paid id>, the same pages, and when it was read',
      hit.hit === true && hit.response.cost === 0 && t.cost === 0 && t.id === 'cache:t-head-1' && t.result[0].items.filter(x => x.type === 'organic').map(x => x.domain).join() === CAREER_PAGES.map(x => x.domain).join()
        && hit.text === 'read earlier today at ' + hhmm + ' UTC' && t.result[0].items.some(x => x.type === 'ai_overview'), J({ hit: hit.hit, text: hit.text, id: t.id, cost: t.cost }));
    const old = { ...row, value: JSON.stringify({ ...val, day: '2026-10-20', at: '2026-10-20T08:00:00.000Z' }) };
    const misses = [await kit('lookup', [old], B10('ai consultant')), await kit('lookup', [row], B10('ai consultant', { location_code: 2840 })),
      await kit('lookup', [row], B10('ai consultant', { device: 'mobile' })), await kit('lookup', [row], B10('ai consultant', { language_code: 'ar' }))];
    check('another day, another location, another device and another language all miss (and say why)', misses.every(m => m.hit === false) && /last read on 2026-10-20/.test(misses[0].why) && misses[1].why === 'not read yet today', J(misses));
    const shallow = await kit('rowFor', serp('t-kc-1', 'ai consultant', { depth: 10 }, [...CAREER_PAGES]), B10('ai consultant'), '');
    const needHead = await kit('lookup', [shallow], HEAD_BODY('ai consultant'));
    const needAio = await kit('lookup', [shallow], B10('ai consultant', { load_async_ai_overview: true }));
    check('a reading 10 deep without the AI Overview does not serve the head (30 + AI Overview), and says why', needHead.hit === false && /only 10 results deep, this needs 30/.test(needHead.why)
      && needAio.hit === false && /without the AI Overview/.test(needAio.why), J([needHead.why, needAio.why]));
    const failed = [await kit('rowFor', fail('t-f1', 40101, 'Internal SE Server Error.'), B10('ai consultant'), ''), await kit('rowFor', { error: { message: 'ETIMEDOUT' } }, B10('ai consultant'), ''),
      await kit('rowFor', { version: '0.1', status_code: 20000, tasks: [{ id: 't-n', status_code: 20000, cost: 0.002, result: null }] }, B10('ai consultant'), '')];
    check('a failed read is never stored: a task error inside an HTTP 200, an HTTP error, a task with no result', failed.every(r => r === null), J(failed));
    const empty = await kit('rowFor', fail('t-e1', 40102, 'No Search Results.'), B10('zzqx unknown search'), '');
    const eh = await kit('lookup', [empty], B10('zzqx unknown search'));
    check('"No Search Results" (40102) is a final answer: stored, and served as the same empty answer', !!empty && eh.hit === true && eh.response.tasks[0].status_code === 40102, J({ empty: !!empty, eh: eh.hit }));
    const again = await kit('rowFor', hit.response, B10('ai consultant'), '');
    check('a reading served from the cache is not written back as a new reading', again === null, J(again));
  });

  // ===================================================================================
  const kcStart = async (kw, cacheRows) => {
    const V = { ok: true, status: 200, keyword: kw, domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', business: 'AI consulting and Microsoft Dynamics partner in the UAE',
      services: ['AI consulting', 'Dynamics 365 Finance'], existing_keywords: [], caller: 'app:test', serp_cache_key: 'serp:' + kw + '|2784|en|desktop' };
    mock('Assess Validate', [{ json: V }]);
    mock('Load Assess Cache', [{ json: { key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 30, method: 'size', p75: null, size_reach: 30, sample: 0, top10: 20, organic_keywords: 300, location_code: LOC }), updated_at: new Date().toISOString() } },
      ...(cacheRows || []).map(r => ({ json: r }))]);
    return (await run('Assess Requests', EMPTY)).map(i => i.json);
  };
  const env = (id, cost, result) => ({ version: '0.1.2026', status_code: 20000, status_message: 'Ok.', tasks: [{ id, status_code: 20000, status_message: 'Ok.', cost, result: [result] }] });
  const kcAnswers = (reqs, serpAns) => reqs.map(r => r.kind === 'overview' ? env('ov-1', 0.01, { items: [{ keyword: 'ai consultant', keyword_info: { search_volume: 320, cpc: 6.5 }, keyword_properties: { keyword_difficulty: 22 }, search_intent_info: { main_intent: 'commercial' } }] })
    : r.kind === 'position' ? env('pos-1', 0.01, { items: [] }) : r.kind === 'serp' ? serpAns : env('x-' + r.kind, 0, { items: [] }));
  const kcRespond = async (answers) => { const ar = (await run('Assess Result', answers.map(j => ({ json: j }))))[0].json; mock('Assess Result', [{ json: ar }]);
    const body = (await run('Assess Response', [{ json: { output: { fit: 2, navigational: false, alternatives: 'ai consulting services uae' } } }]))[0].json.body;
    const rows = (await run('Reach Row (Assess)', EMPTY)).map(i => i.json); return { ar, body, rows }; };

  await guard('SC2 KW-SERP the Keyword Check reads a results page once a day', async () => {
    reset(); const SN = 'SC2 KW-SERP - the second Keyword Check of "ai consultant" the same day sends no results-page request, pays nothing for it and says when it was read'; begin(SN); const check = mkCheck(SN);
    const r1 = await kcStart('ai consultant', []);
    const s1 = r1.find(r => r.kind === 'serp');
    check('first check: one results-page request is sent (nothing read today)', !!s1 && r1.filter(r => r.kind === 'serp').length === 1 && !r1[0].serp_cached, J(r1.map(r => r.kind)));
    const first = await kcRespond(kcAnswers(r1, serp('t-kc-1', 'ai consultant', { depth: 10 }, [...CAREER_PAGES, PAA, REL])));
    const stored = first.rows.find(r => r.kind === 'serp');
    check('first check: its fresh reading is handed to the save (Reach Row (Assess)), beside nothing else since the reach is stored', !!stored && stored.key === 'serp:ai consultant|2784|en|desktop' && first.ar.dfs_cost === 0.022
      && first.body.serp.read === true && first.body.serp.read_today === false, J({ rows: first.rows.map(r => r.key || r), dfs: first.ar.dfs_cost }));
    const r2 = await kcStart('ai consultant', [stored]);
    check('second check the same day: NO results-page request (the second path uses the first reading)', !r2.some(r => r.kind === 'serp') && !!(r2[0].serp_cached && r2[0].serp_cached.serp_cache.hit), J(r2.map(r => r.kind)));
    const second = await kcRespond(kcAnswers(r2, null));
    console.log('   second check ->', J({ serp: second.body.serp, fit: second.body.fit, dfs: second.ar.dfs_cost }));
    check('…the same answer from the same page (fit 0, a career search; the same top sites), $0 for the page, and when it was read',
      second.body.fit === 0 && first.body.fit === 0 && J(second.body.serp.top) === J(first.body.serp.top) && second.ar.dfs_cost === 0.02 && second.body.serp.read_today === true
        && second.body.serp.read_note === 'read earlier today at ' + hhmm + ' UTC', J({ s: second.body.serp, f: [first.body.fit, second.body.fit], dfs: second.ar.dfs_cost }));
    check('…and nothing is stored again from a reading served from the cache', !second.rows.some(r => r.kind === 'serp'), J(second.rows));
    // a reading from yesterday is bought again
    const old = { ...stored, value: JSON.stringify({ ...JSON.parse(stored.value), day: '2026-10-20', at: '2026-10-20T08:00:00.000Z' }) };
    const r3 = await kcStart('ai consultant', [old]);
    check('a reading from another day is not used: the page is bought again', r3.filter(r => r.kind === 'serp').length === 1, J(r3.map(r => r.kind)));
    // a failed read is not stored
    const r4 = await kcStart('ai consultant', []);
    const fourth = await kcRespond(kcAnswers(r4, fail('t-f1', 40101, 'Internal SE Server Error.')));
    check('a failed read is not stored', !fourth.rows.some(r => r.kind === 'serp') && fourth.body.serp.read === false, J(fourth.rows));
  });

  // ===================================================================================
  await guard('SC3 KW-SERP the ladder head and the Keyword Check share one reading', async () => {
    reset(); const SN = 'SC3 KW-SERP - the ladder head reads "ai consultant" (30 deep, AI Overview) and stores it; the Keyword Check after it uses that reading: the same pages, the same AI Overview answer, the same career verdict'; begin(SN); const check = mkCheck(SN);
    const KW = 'ai consultant';
    // the head path: nothing stored -> SERP Top 10 buys it
    const keyItem = (await run('SERP Cache Key (Top 10)', [{ json: { keyword: KW, location_code: LOC, language_code: 'en', domain: D } }]))[0].json;
    check('the head carries the key of its request (30 deep, AI Overview)', keyItem.serp_cache_key === 'serp:ai consultant|2784|en|desktop' && keyItem.serp_cache_body.depth === 30 && keyItem.serp_cache_body.load_async_ai_overview === true, J(keyItem));
    const use0 = (await run('Use SERP Cache (Top 10)', EMPTY))[0].json;
    check('nothing read today: SERP Top 10 is asked', use0.serp_cache_hit === false && use0.serp_cached === null, J({ hit: use0.serp_cache_hit, why: use0.serp_cache_why }));
    const headAns = serp('t-head-1', KW, { depth: 30, load_async_ai_overview: true }, [AIO, ...CAREER_PAGES, PAA, REL]);
    mock('SERP Top 10', [headAns]);
    mock('Pick Top 6', CAREER_PAGES.slice(0, 3).map(p => ({ json: { url: p.url, domain: p.domain } })));
    const rowH = (await run('SERP Cache Row (Top 10)', EMPTY))[0].json;
    check('the head\'s fresh reading becomes today\'s row', rowH.key === 'serp:ai consultant|2784|en|desktop' && JSON.parse(rowH.value).aio_loaded === true, J({ key: rowH.key, skip: rowH.skip }));
    const restored = (await run('Restore Top 6', EMPTY)).map(i => i.json);
    check('the run goes on with the competitors Pick Top 6 chose', restored.length === 3 && restored[0].domain === 'www.upwork.com', J(restored));
    // a second ladder / page run the same day: no SERP Top 10 call
    delete store['SERP Top 10'];
    mock('SERP Cache Key (Top 10)', [keyItem]);
    const use1 = (await run('Use SERP Cache (Top 10)', [{ json: rowH }]))[0].json;
    const cached = (await run('Cached SERP (Top 10)', [{ json: use1 }]))[0].json;
    check('a second head read the same day takes the cached branch (no paid call): cost 0, the paid task id kept, the AI Overview kept',
      use1.serp_cache_hit === true && cached.cost === 0 && cached.tasks[0].id === 'cache:t-head-1' && cached.tasks[0].result[0].items.some(x => x.type === 'ai_overview'), J({ hit: use1.serp_cache_hit, why: use1.serp_cache_why }));
    const noRow = (await run('SERP Cache Row (Top 10)', EMPTY))[0].json;
    check('…and it is not stored again (SERP Top 10 did not run)', noRow.skip === true, J(noRow));
    // the Keyword Check after the ladder
    const reqs = await kcStart(KW, [rowH]);
    check('the Keyword Check sends no results-page request: the head\'s reading serves it', !reqs.some(r => r.kind === 'serp'), J(reqs.map(r => r.kind)));
    const kc = await kcRespond(kcAnswers(reqs, null));
    console.log('   keyword check after the ladder ->', J({ fit: kc.body.fit, gate: kc.body.fit_gate && kc.body.fit_gate.reason, serp: kc.body.serp }));
    check('one answer for the client: the Keyword Check reads the head\'s top pages, the same AI Overview (seen), and the same career verdict (fit 0, job search)',
      J(kc.body.serp.top) === J(CAREER_PAGES.slice(0, 5).map(p => p.domain)) && kc.body.serp.ai_overview_seen === true && JSON.parse(rowH.value).ai_overview_seen === true
        && kc.body.fit === 0 && kc.body.fit_gate.reason === 'job search' && kc.body.serp.read_today === true, J({ top: kc.body.serp.top, aio: kc.body.serp.ai_overview_seen, fit: kc.body.fit }));
  });

  // ===================================================================================
  await guard('SC4 KW-SERP the ladder rung reads', async () => {
    reset(); const SN = 'SC4 KW-SERP - the ladder buys a rung keyword\'s results page only when it was not read today; all read today = nothing bought; fresh readings stored, failed ones not'; begin(SN); const check = mkCheck(SN);
    const U = (n) => 'https://site' + n + '.example/page';
    const pagesOf = { 'ai consulting dubai': [1, 2, 3, 4, 5, 6, 7], 'ai consulting company uae': [1, 2, 3, 14, 15, 16, 17], 'ai strategy consulting uae': [21, 22, 23, 24, 25, 26, 27] };
    const ans = (kw, id) => serp(id, kw, { depth: 10 }, pagesOf[kw].map((n, i) => org(i + 1, 'site' + n + '.example', U(n), kw + ' ' + n)));
    const kws = Object.keys(pagesOf);
    const plan = { cap: 24, cap_basis: 'the standing cap', candidates: 3, on_topic: 3, asked: 3, left_uncompared: 0, supporting_asked: 0 };
    const reqs = kws.map((k, i) => ({ cluster_check: true, keyword: k, serp_cache_key: 'serp:' + k + '|2784|en|desktop', location_code: LOC, language_code: 'en', n: i + 1, of: 3, weight: 3 - i, volume: 100, ...plan }));
    const rowOf = async (kw, id) => kit('rowFor', ans(kw, id), HEAD_BODY(kw), '');
    const r0 = await rowOf(kws[0], 't-kc-a'), r1 = await rowOf(kws[1], 't-res-b');
    mock('Ladder Pool', [{ json: { keyword: 'ai consulting', location_code: LOC, language_code: 'en' } }]);
    mock('Ladder Cluster Requests', reqs);
    // two of three read today (by the Keyword Check and the research): only the third is sent
    mock('Load SERP Cache (Ladder)', [{ json: r0 }, { json: r1 }]);
    const split = (await run('Ladder SERP Cache Split', [{ json: r0 }, { json: r1 }])).map(i => i.json);
    check('only the keyword not read today is sent to DataForSEO', split.length === 1 && split[0].keyword === kws[2] && split[0].cluster_check === true, J(split.map(s => s.keyword)));
    mock('Run Ladder Cluster SERP', [ans(kws[2], 't-lad-c')]);
    const retry = (await run('Ladder Cluster Retry', store['Run Ladder Cluster SERP'])).map(i => i.json);
    check('the in-200 gate pairs the one answer with the one keyword sent (nothing to re-send)', retry.length === 1 && retry[0].no_retry === true, J(retry));
    const cl = (await run('Ladder Clusters', store['Run Ladder Cluster SERP']))[0].json.serp_clusters;
    console.log('   clusters ->', J({ compared: cl.compared, cost: cl.cost_usd, read_today: cl.read_today, clusters: cl.clusters.map(c => c.head_keyword), note: cl.read_today_note }));
    check('all three are compared (two from today\'s readings), the shared-page group is found, and only the bought page is paid: $0.002',
      cl.compared === 3 && cl.not_compared.length === 0 && cl.cost_usd === 0.002 && cl.read_today === 2 && cl.clusters.length === 1 && cl.clusters[0].keyword_count === 2
        && /2 results page\(s\) were read earlier today at \d\d:\d\d UTC and used again at no cost/.test(cl.cost_basis), J(cl));
    const rows = (await run('Ladder SERP Cache Rows', EMPTY)).map(i => i.json);
    check('the one fresh reading is stored, the two served from the cache are not', rows.length === 1 && rows[0].key === 'serp:' + kws[2] + '|2784|en|desktop', J(rows.map(r => r.key || r)));
    // all three read today: one item down the "nothing to buy" branch, cost 0
    reset();
    mock('Ladder Pool', [{ json: { keyword: 'ai consulting', location_code: LOC, language_code: 'en' } }]);
    mock('Ladder Cluster Requests', reqs);
    const r2 = await rowOf(kws[2], 't-lad-c');
    const split2 = (await run('Ladder SERP Cache Split', [{ json: r0 }, { json: r1 }, { json: r2 }])).map(i => i.json);
    mock('Load SERP Cache (Ladder)', [{ json: r0 }, { json: r1 }, { json: r2 }]);
    check('all read today: one item that buys nothing', split2.length === 1 && split2[0].cluster_check === false && split2[0].all_read_today === true, J(split2));
    const cl2 = (await run('Ladder Clusters', [{ json: split2[0] }]))[0].json.serp_clusters;
    check('…and the clusters are the same as the paid run\'s, at no cost', cl2.compared === 3 && cl2.cost_usd === 0 && cl2.read_today === 3 && cl2.clusters.length === 1 && cl2.clusters[0].keyword_count === 2, J(cl2));
    const rows2 = (await run('Ladder SERP Cache Rows', EMPTY)).map(i => i.json);
    check('…and nothing is stored', rows2.length === 1 && rows2[0].skip === true, J(rows2));
    // a failed bought read: compared as "could not", never stored
    reset();
    mock('Ladder Pool', [{ json: { keyword: 'ai consulting', location_code: LOC, language_code: 'en' } }]);
    mock('Ladder Cluster Requests', reqs);
    mock('Load SERP Cache (Ladder)', [{ json: r0 }, { json: r1 }]);
    mock('Ladder SERP Cache Split', [reqs[2]]);
    mock('Run Ladder Cluster SERP', [fail('t-f3', 40101, 'Internal SE Server Error.')]);
    const retry3 = (await run('Ladder Cluster Retry', store['Run Ladder Cluster SERP'])).map(i => i.json);
    mock('Run Ladder Cluster SERP (Retry)', [fail('t-f4', 40101, 'Internal SE Server Error.')]);
    const cl3 = (await run('Ladder Clusters', store['Run Ladder Cluster SERP']))[0].json.serp_clusters;
    const rows3 = (await run('Ladder SERP Cache Rows', EMPTY)).map(i => i.json);
    check('a read that failed twice is named as not compared, with its reason and its retry, and is never stored',
      retry3.some(x => x.is_retry && Number(x.retry_of) === 0) && cl3.not_compared.length === 1 && cl3.not_compared[0].keyword === kws[2] && cl3.not_compared[0].retried === true && cl3.compared === 2
        && rows3.length === 1 && rows3[0].skip === true, J({ nc: cl3.not_compared, rows3 }));
  });

  // ===================================================================================
  await guard('SC5 KW-SERP depth', async () => {
    reset(); const SN = 'SC5 KW-SERP - a reading too shallow for a path is bought again and replaces the row: the head needs 30 + the AI Overview, the rank tracker 50'; begin(SN); const check = mkCheck(SN);
    const KW = 'ai consulting dubai';
    const kc = await kit('rowFor', serp('t-kc-1', KW, { depth: 10 }, CAREER_PAGES), B10(KW), '');   // a 10-deep reading (the head's lighter third attempt)
    mock('SERP Cache Key (Top 10)', [{ json: { keyword: KW, location_code: LOC, language_code: 'en', serp_cache_key: kc.key, serp_cache_body: HEAD_BODY(KW) } }]);
    const use = (await run('Use SERP Cache (Top 10)', [{ json: kc }]))[0].json;
    check('the head does not use a 10-deep reading: it buys its own', use.serp_cache_hit === false && /only 10 results deep, this needs 30/.test(use.serp_cache_why), J(use.serp_cache_why));
    // the head's first attempt fails, the retry answers: the retry's reading is stored and replaces the shallow row (same key)
    mock('SERP Top 10', [fail('t-h1', 40101, 'Internal SE Server Error.')]);
    mock('SERP Top 10 (Retry)', [serp('t-h2', KW, { depth: 30, load_async_ai_overview: true }, [AIO, ...CAREER_PAGES])]);
    const row = (await run('SERP Cache Row (Top 10)', EMPTY))[0].json;
    check('the attempt that answered (the retry) becomes the row, under the same key, so it replaces the shallow one', row.key === kc.key && JSON.parse(row.value).task_id === 't-h2' && JSON.parse(row.value).depth === 30, J(row.key));
    delete store['SERP Top 10 (Retry)'];
    mock('SERP Top 10', [fail('t-h3', 40101, 'Internal SE Server Error.')]);
    const none = (await run('SERP Cache Row (Top 10)', EMPTY))[0].json;
    check('when every attempt failed nothing is stored', none.skip === true, J(none));
    // the rank tracker needs 50: a 30-deep reading misses; its 50-deep reading then serves the 10-deep and the 30-deep paths that do not need the AI Overview
    const need50 = await kit('lookup', [row], { keyword: KW, location_code: LOC, language_code: 'en', depth: 50, device: 'desktop' });
    const many = Array.from({ length: 50 }, (_, i) => org(i + 1, 'site' + i + '.example', 'https://site' + i + '.example/ai-consulting-dubai', 'AI consulting Dubai ' + i));
    const deep = await kit('rowFor', serp('t-rt-1', KW, { depth: 50 }, many), { keyword: KW, location_code: LOC, language_code: 'en', depth: 50, device: 'desktop' }, '');
    const v = JSON.parse(deep.value);
    const serve10 = await kit('lookup', [deep], B10(KW)), serveHead = await kit('lookup', [deep], HEAD_BODY(KW)), mobile = await kit('lookup', [deep], B10(KW, { device: 'mobile' }));
    check('the rank tracker (50 deep) does not use a 30-deep reading; its own 50-deep reading fits in the row and serves a 10-deep path, not the head (no AI Overview), not mobile',
      need50.hit === false && v.depth === 50 && v.items.length === 50 && deep.value.length <= 20000 && serve10.hit === true && serveHead.hit === false && mobile.hit === false,
      J({ need50: need50.why, depth: v.depth, len: deep.value.length, s10: serve10.hit, head: serveHead.why, mobile: mobile.why }));
  });
  // ===================================================================================
  // SC6 / SC7 (owner decision 2026-10-21): one request shape (30 deep + the AI Overview; the tracker 50 deep + the AI Overview) and the
  // research live checks and the Rank Tracker on the same cache, through the split around their in-200 gates.
  const SEED = { location_code: LOC, language_code: 'en' };
  const DUBAI_PAGES = [org(1, 'www.alpha-ai.ae', 'https://www.alpha-ai.ae/services/ai-consulting/', 'AI Consulting Services in Dubai'),
    org(2, 'www.beta.ae', 'https://www.beta.ae/solutions/artificial-intelligence/', 'AI Consulting Solutions Dubai'), org(3, 'gamma.com', 'https://gamma.com/services/ai-strategy-dubai/', 'AI Strategy Dubai')];
  const costOnce = (answers) => { const ids = new Set(); let c = 0; for (const a of answers) for (const t of ((a || {}).tasks || [])) { const v = Number(t.cost || 0); if (!v || ids.has(t.id)) continue; ids.add(t.id); c += v; } return +c.toFixed(4); };
  const research = async (kws, rows, answersFor) => {
    for (const k of ['Candidate SERP', 'Candidate SERP Answers', 'Candidate SERP (Retry)', 'Candidate SERP Retry Plan', 'SERP Cache Split (Research)']) delete store[k];
    mock('Seed List', [{ json: SEED }]);
    await run('SERP Cache Keys (Research)', kws.map(k => ({ json: { keyword: k, volume: 300 } })));
    mock('Load SERP Cache (Research)', rows.length ? rows.map(r => ({ json: r })) : EMPTY);
    const split = (await run('SERP Cache Split (Research)', store['Load SERP Cache (Research)'])).map(i => i.json);
    let bought = [];
    if (!split[0].serp_cache_all_read) {
      bought = split.map(j => answersFor(j.keyword));
      mock('Candidate SERP', bought);
      const plan = (await run('Candidate SERP Retry Plan', store['Candidate SERP'])).map(i => i.json);
      if (plan.some(p => p.is_retry)) throw new Error('unexpected retry ' + J(plan));
      await run('Candidate SERP Answers', EMPTY);
    }
    const out = (await run('SERP With Cache (Research)', EMPTY)).map(i => i.json);
    const rowsOut = (await run('SERP Cache Rows (Research)', EMPTY)).map(i => i.json);
    const restored = (await run('Restore SERP (Research)', EMPTY)).map(i => i.json);
    return { split, out, rowsOut, restored, bought };
  };

  await guard('SC6 KW-SERP research live checks share the reading with the Keyword Check', async () => {
    reset(); const SN = 'SC6 KW-SERP - the research live checks and the Keyword Check read one results page per search a day, whichever comes first, and agree on it; the money is counted once'; begin(SN); const check = mkCheck(SN);
    const HB = { depth: 30, load_async_ai_overview: true };
    const answersFor = (kw) => kw === 'ai consultant' ? serp('t-res-1', kw, HB, [AIO, ...CAREER_PAGES, PAA, REL], { cost: 0.006 }) : serp('t-res-2', kw, HB, DUBAI_PAGES, { cost: 0.006 });
    // 1. research first: both bought, both stored, in their own order
    const r1 = await research(['ai consultant', 'ai consulting dubai'], [], answersFor);
    check('research first: both pages bought (30 deep with the AI Overview), the answers handed on in order, both stored',
      r1.split.length === 2 && r1.out.length === 2 && r1.out[0].tasks[0].id === 't-res-1' && r1.out[1].tasks[0].id === 't-res-2' && r1.rowsOut.length === 2 && r1.restored.length === 2
        && r1.out[0].__dfs.cost_usd === 0.012 && r1.out[0].__dfs.read_today === 0, J({ split: r1.split.map(s => s.keyword), rows: r1.rowsOut.map(r => r.key), ev: r1.out[0].__dfs.cost_usd }));
    const resRow = r1.rowsOut.find(r => r.key === 'serp:ai consultant|2784|en|desktop');
    // 2. the Keyword Check after it: no request, the same page
    const reqs = await kcStart('ai consultant', [resRow]);
    const kc = await kcRespond(kcAnswers(reqs, null));
    const resTop = r1.out[0].tasks[0].result[0].items.filter(x => x.type === 'organic').slice(0, 5).map(x => x.domain);
    check('the Keyword Check after the research sends no results-page request and reads the research\'s page: the same top sites, the same AI Overview (seen), a career search (fit 0)',
      !reqs.some(r => r.kind === 'serp') && J(kc.body.serp.top) === J(resTop) && kc.body.serp.ai_overview_seen === true && r1.out[0].tasks[0].result[0].items.some(x => x.type === 'ai_overview')
        && kc.body.fit === 0 && kc.body.fit_gate.reason === 'job search' && kc.ar.dfs_cost === 0.02, J({ top: kc.body.serp.top, resTop, aio: kc.body.serp.ai_overview_seen, dfs: kc.ar.dfs_cost }));
    // 3. Keyword Check first, research after: the research buys only the other keyword
    reset();
    const k0 = await kcStart('ai consultant', []);
    const kcFirst = await kcRespond(kcAnswers(k0, serp('t-kc-9', 'ai consultant', HB, [AIO, ...CAREER_PAGES, PAA, REL])));
    const kcRow = kcFirst.rows.find(r => r.kind === 'serp');
    const r2 = await research(['ai consultant', 'ai consulting dubai'], [kcRow], answersFor);
    console.log('   research after the check ->', J({ sent: r2.split.map(s => s.keyword), ids: r2.out.map(a => a.tasks[0].id), ev: r2.out[0].__dfs }));
    check('the research after a Keyword Check buys only the keyword not read today, and its retry gate pairs the one answer with the one request',
      r2.split.length === 1 && r2.split[0].keyword === 'ai consulting dubai' && r2.bought.length === 1, J(r2.split));
    check('…and reads the check\'s own page for "ai consultant": the same task (cache:t-kc-9, cost 0), the same top sites and the same AI Overview as the check',
      r2.out[0].tasks[0].id === 'cache:t-kc-9' && r2.out[0].tasks[0].cost === 0 && J(r2.out[0].tasks[0].result[0].items.filter(x => x.type === 'organic').slice(0, 5).map(x => x.domain)) === J(kcFirst.body.serp.top)
        && r2.out[0].tasks[0].result[0].items.some(x => x.type === 'ai_overview') === kcFirst.body.serp.ai_overview_seen, J(r2.out[0].tasks[0].id));
    check('costs counted once: the research pays $0.006 (one page), the evidence says one was read earlier today, and the cached answer adds nothing by task id',
      r2.out[0].__dfs.cost_usd === 0.006 && r2.out[0].__dfs.read_today === 1 && /read earlier today at \d\d:\d\d UTC/.test(r2.out[0].__dfs.read_today_note)
        && costOnce(r2.out) === 0.006 && r2.out[0].__dfs_cost_usd === 0 && r2.rowsOut.length === 1 && r2.rowsOut[0].key === 'serp:ai consulting dubai|2784|en|desktop', J(r2.out[0].__dfs));
    // 4. everything read today: nothing bought, the readers still get every answer in order
    const r3 = await research(['ai consultant', 'ai consulting dubai'], [kcRow, r2.rowsOut[0]], answersFor);
    check('all read today: one item down the other branch, nothing bought, both answers handed on in order at $0, nothing stored again',
      r3.split.length === 1 && r3.split[0].serp_cache_all_read === true && r3.bought.length === 0 && r3.out.length === 2 && r3.out.every(a => a.tasks[0].cost === 0 && /^cache:/.test(a.tasks[0].id))
        && r3.out[0].__dfs.cost_usd === 0 && /nothing bought/.test(r3.out[0].__dfs.cost_basis) && r3.rowsOut[0].skip === true, J({ split: r3.split, ev: r3.out[0].__dfs }));
  });

  await guard('SC7 KW-SERP the Rank Tracker refreshes the reading and serves the later paths', async () => {
    reset(); const SN = 'SC7 KW-SERP - the Rank Tracker (50 deep + AI Overview) buys what is not deep enough, refreshes the row, and its reading serves a later Keyword Check the same day; costs counted once'; begin(SN); const check = mkCheck(SN);
    const KW = 'ai consultant';
    const body = (device) => [{ keyword: KW, location_code: LOC, language_code: 'en', depth: 50, load_async_ai_overview: true, device, os: device === 'mobile' ? 'android' : 'windows' }];
    const items = ['desktop', 'mobile'].map(d => ({ ladder_id: 'lad_1', keyword: KW, device: d, endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: body(d) }));
    const many = (pfx) => [AIO, ...CAREER_PAGES, ...Array.from({ length: 44 }, (_, i) => org(i + 7, pfx + i + '.example', 'https://' + pfx + i + '.example/ai', 'AI ' + i)), PAA, REL];
    const tracker = async (rows, answersFor) => {
      for (const k of ['SERP Check', 'SERP Check Answers', 'SERP Check (Retry)', 'SERP Check Retry Plan', 'SERP Cache Split (Tracker)']) delete store[k];
      await run('SERP Cache Keys (Tracker)', items.map(j => ({ json: j })));
      mock('Load SERP Cache (Tracker)', rows.length ? rows.map(r => ({ json: r })) : EMPTY);
      const split = (await run('SERP Cache Split (Tracker)', store['Load SERP Cache (Tracker)'])).map(i => i.json);
      if (!split[0].serp_cache_all_read) {
        mock('SERP Check', split.map(j => answersFor(j.device)));
        await run('SERP Check Retry Plan', store['SERP Check']);
        await run('SERP Check Answers', EMPTY);
      }
      const out = (await run('SERP With Cache (Tracker)', EMPTY)).map(i => i.json);
      const rowsOut = (await run('SERP Cache Rows (Tracker)', EMPTY)).map(i => i.json);
      return { split, out, rowsOut };
    };
    const ansFor = (d) => serp('t-rt-' + d, KW, { depth: 50, load_async_ai_overview: true, device: d }, many(d === 'mobile' ? 'm' : 'd'), { cost: 0.01 });
    // a Keyword Check read the search earlier today (30 deep): not deep enough for the tracker
    const k0 = await kcStart(KW, []);
    const kcFirst = await kcRespond(kcAnswers(k0, serp('t-kc-1', KW, { depth: 30, load_async_ai_overview: true }, [AIO, ...CAREER_PAGES, PAA, REL])));
    const kcRow = kcFirst.rows.find(r => r.kind === 'serp');
    const t1 = await tracker([kcRow], ansFor);
    check('the tracker does not use a 30-deep reading for its 50-deep check: both devices are bought', t1.split.length === 2 && t1.out.map(a => a.tasks[0].id).join() === 't-rt-desktop,t-rt-mobile', J(t1.split.map(s => s.device)));
    const desk = t1.rowsOut.find(r => r.key === 'serp:ai consultant|2784|en|desktop'), mob = t1.rowsOut.find(r => r.key === 'serp:ai consultant|2784|en|mobile');
    check('its readings refresh the rows: the desktop row is now 50 deep with the AI Overview (replacing the check\'s 30-deep one, same key), the mobile one has its own key',
      !!desk && !!mob && JSON.parse(desk.value).depth === 50 && JSON.parse(desk.value).aio_loaded === true && JSON.parse(desk.value).items.filter(x => x.type === 'organic').length === 50 && desk.value.length <= 20000,
      J(t1.rowsOut.map(r => r.key)));
    // a later Keyword Check uses the tracker's deeper reading
    const k2 = await kcStart(KW, [desk]);
    const kc2 = await kcRespond(kcAnswers(k2, null));
    check('a later Keyword Check uses the tracker\'s 50-deep reading: no request, the same top sites, the same AI Overview answer, the same career verdict, $0 for the page',
      !k2.some(r => r.kind === 'serp') && J(kc2.body.serp.top) === J(CAREER_PAGES.slice(0, 5).map(p => p.domain)) && kc2.body.serp.ai_overview_seen === true && kc2.body.fit === 0
        && kc2.ar.dfs_cost === 0.02 && kc2.body.serp.read_today === true, J({ top: kc2.body.serp.top, fit: kc2.body.fit, dfs: kc2.ar.dfs_cost }));
    // the tracker again the same day: nothing bought, the cost evidence says so
    const t2 = await tracker([desk, mob], ansFor);
    check('the tracker again the same day buys nothing: both checks are today\'s readings at $0, in order, and nothing is stored again',
      t2.split[0].serp_cache_all_read === true && t2.out.length === 2 && t2.out.every(a => a.tasks[0].cost === 0) && t2.out[1].tasks[0].data.device === 'mobile'
        && t2.out[0].__dfs.cost_usd === 0 && costOnce(t2.out) === 0 && t2.rowsOut[0].skip === true, J(t2.out[0].__dfs));
    check('costs counted once over the day: the tracker paid 2 x $0.01 once; nothing for the cached answers',
      costOnce([...t1.out, ...t2.out]) === 0.02 && t1.out[0].__dfs.cost_usd === 0.02, J({ t1: t1.out[0].__dfs.cost_usd }));
  });
};
