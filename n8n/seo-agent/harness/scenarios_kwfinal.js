// KF1-KF5 (KW-FINAL, 2026-10-22): the keyword re-check's new defects (scratchpad run/KW_RECHECK_REPORT.md). Every check runs the GENERATED
// code (harness/code_v4) or the build's wiring record, and fails on the code before the fix:
//   KF1 N3 / D5  a paid DataForSEO node that can carry several items has no node-level retry (n8n 2.41.4 re-runs the WHOLE node, every item,
//                when the first item fails); the in-200 gate re-sends the failed items only; the Keyword Check fits its time budget
//   KF2 N1       ERP / Dynamics 365 / PINT-AE: the categories of what the client declared ("erp consultants" for a Business Central partner)
//   KF3 N2       a duplicate ladder is refused by words right after Rate Limit, before any paid call, with the plain reason
//   KF4 N4       the Keyword Check never names a planned / 404 address as "your existing page"
//   KF5 N5 / N6  a listing page (the blog index) covers no keyword; a job search is never "refresh your page"; the exact ladder is named
// Called from scenarios_v5.js just before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const items = (arr) => (arr || []).map(j => ({ json: j }));
  const HOST = 'https://www.techand.ai', DOM = 'techand.ai';
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  const BUSINESS = 'Microsoft partner in Dubai for enterprises in the UAE and GCC: AI consulting and automation, Microsoft Copilot, Dynamics 365 business applications, data and cloud';

  // ===================================================================================================================================
  await guard('KF1 N3 paid multi-item calls retry per item', async () => {
    const SN = 'KF1 N3 / D5: n8n re-runs a whole node with retryOnFail when its FIRST item fails (all items re-sent and re-billed): paid multi-item nodes carry no node-level retry, the gate re-sends the failed items only';
    begin(SN); const check = mkCheck(SN);
    const RW = JSON.parse(fs.readFileSync(path.join(__dirname, 'retry_wiring.json'), 'utf8'));
    const st = RW.selftest || {};
    check('the lint bites: a paid multi-item node WITH node-level retry fails, one that stops on error fails, the per-item pattern passes, executeOnce / a named single-item node may retry, check() strips the retry',
      st.flags_paid_multi_with_retry === true && st.flags_paid_multi_that_stops === true && st.passes_paid_per_item === true && st.passes_paid_execute_once === true
      && st.passes_paid_single_item === true && st.apply_strips_paid_retry === true && st.single_item_reasons === true, J(st));
    const all = Object.entries(RW.workflows || {}).flatMap(([wf, ns]) => ns.map(n => ({ wf, ...n })));
    const paidMulti = all.filter(n => n.per_item === true);
    const bad = paidMulti.filter(n => n.retryOnFail !== false || !/^continue/.test(String(n.onError)));
    console.log('   paid multi-item nodes ->', paidMulti.length, '| single-item paid nodes with retry ->', all.filter(n => n.paid && !n.per_item && n.retryOnFail).length);
    check('every paid multi-item DataForSEO node of every workflow has no node-level retry and turns a failure into an item (' + paidMulti.length + ' nodes)',
      paidMulti.length >= 30 && !bad.length, J(bad.map(n => n.wf + ' / ' + n.name)));
    const kc = (nm) => (RW.workflows['SEO Agent — Keyword Check'] || []).find(n => n.name === nm) || {};
    const first = kc('Run Assess Requests'), retry = kc('Run Assess Requests (Retry)');
    // n8n's loop: tries = retryOnFail ? clamp(maxTries, 2, 5) : 1; a whole-node re-run waits waitBetweenTries between tries
    const worst = (n) => { const tries = n.retryOnFail ? Math.min(5, Math.max(2, Number(n.maxTries) || 3)) : 1; return tries * (Number(n.timeout) || 300000) + (tries - 1) * (Number(n.waitBetweenTries) || 1000); };
    const total = worst(first) + 1000 + worst(retry);
    check('the Keyword Check (exec 145: 13.5 s + 34 s > 45 s): both reads are per-item, so the worst case is 12 s + 1 s + 8 s = 21 s, inside its 24 s read budget and the 45 s limit',
      first.per_item === true && retry.per_item === true && first.retryOnFail === false && retry.retryOnFail === false && total <= 24000, J({ first, retry, total }));
    const single = (RW.workflows['SEO Agent v4'] || []).filter(n => ['SERP Top 10', 'SERP Top 10 (Retry)', 'SERP Top 10 (Light Retry)', 'Keyword Data'].includes(n.name));
    check('a call that carries ONE item by construction keeps the 3 x 5 s retry (only that one request is re-sent): the head keyword\'s three attempts, the keyword overview',
      single.length === 4 && single.every(n => n.paid && n.per_item === false && n.retryOnFail === true && n.maxTries === 3), J(single));
  });

  // ===================================================================================================================================
  await guard('KF2 N1 ERP / D365 / PINT-AE', async () => {
    const SN = 'KF2 N1: "erp consultants", "finance erp system", "erp finance", "d365 cloud migration uae" and "pint-ae xml format mandatory fields" are the services of a Dynamics 365 / e-invoicing client (exec 149 said "not one of the services you listed")';
    begin(SN); const check = mkCheck(SN);
    const G = new Function(fs.readFileSync(path.join(CD, '_fit_gate.js'), 'utf8').replace(/return \$input\.all\(\)[\s\S]*$/, 'return { fitEvidence, fitSyn };'))();
    const ev = (k, svc) => G.fitEvidence(k, [...(svc || SERVICES), BUSINESS], { topic_label: 'the services you listed', services: svc || SERVICES });
    const want = ['erp consultants', 'finance erp system', 'erp finance', 'd365 cloud migration uae', 'pint-ae xml format mandatory fields'];
    const got = want.map(k => [k, ev(k)]);
    got.forEach(([k, e]) => console.log('   ' + k.padEnd(40), e.verdict, '|', e.detail));
    check('all five are "in" for the client who declared Dynamics 365 Finance / Business Central / Sales and e-invoicing', got.every(([, e]) => e.verdict === 'in'), J(got));
    check('the reason names the service the category comes from ("erp" is the category of Dynamics 365 Finance ...), and PINT names the e-invoicing service',
      /category of Dynamics 365 (Finance|Business Central)/.test(got[0][1].detail) && /E-invoicing compliance/.test(got[4][1].detail), J([got[0][1].detail, got[4][1].detail]));
    check('d365 is how buyers write Dynamics 365 (one spelling on both sides)', G.fitSyn('d365 cloud migration uae') === 'dynamics 365 cloud migration uae', G.fitSyn('d365 cloud migration uae'));
    const ai = ['AI consulting', 'AI and automation'];
    const noErp = ['erp consultants', 'finance erp system'].map(k => [k, ev(k, ai).verdict]);
    check('a client who declared no ERP product gets no ERP category for free (AI consulting only: not "in")', noErp.every(([, v]) => v !== 'in'), J(noErp));
    check('the rest stays as it was: "character ai" is still out, "crm software dubai" (Dynamics 365 Sales) in', ev('character ai').verdict === 'out' && ev('crm software dubai').verdict === 'in', J([ev('character ai'), ev('crm software dubai')]));
  });

  // ===================================================================================================================================
  await guard('KF3 N2 duplicate ladder before any paid call', async () => {
    const SN = 'KF3 N2: "ai consulting company dubai" beside the ladder "ai consulting dubai" is refused right after Rate Limit (exec 152 refused it after $0.142 + $0.138 of paid steps)';
    begin(SN); const check = mkCheck(SN);
    const LADS = [{ ladder_id: 'lad_mvigmou94c3c', domain: DOM, head_keyword: 'ai consulting dubai', keyword: 'ai consulting dubai', rung: 4, status: 'planned' },
      { ladder_id: 'lad_mvigmou94c3c', domain: DOM, head_keyword: 'ai consulting dubai', keyword: 'best ai company in dubai', rung: 2, status: 'planned' },
      { ladder_id: 'lad_erp', domain: 'www.techand.ai', head_keyword: 'erp software uae', keyword: 'erp software uae', rung: 4, status: 'planned' }];
    const ask = async (d, rows, sets) => { reset(); mock('Rate Limit', [{ json: d }]); mock('Load Ladders (Dup Check)', rows ? items(rows) : [{ json: {} }]); mock('Load Ladder Settings (Dup Check)', items(sets || [{}]));
      return (await run('Ladder Duplicate (Words)', [{ json: {} }]))[0].json; };
    const REQ = { mode: 'ladder', keyword: 'ai consulting company dubai', domain: DOM, ladder_id: 'lad_new1', client_ip: 'app:co_1', request_id: 'r1' };
    const a = await ask(REQ, LADS);
    console.log('   refusal ->', a.validation_error);
    check('refused with the plain reason, naming the ladder, before anything is paid for (nothing charged)',
      /already has a keyword ladder for "ai consulting dubai" \(lad_mvigmou94c3c\)/.test(a.validation_error || '') && /same search in other words/.test(a.validation_error) && /nothing was charged/.test(a.validation_error)
      && a.refusal && a.refusal.before_paid_steps === true && a.refusal.by === 'words' && !/[—–“”…]/.test(a.validation_error), J(a));
    const b = await ask({ ...REQ, keyword: 'best ai companies in dubai' }, LADS);
    check('a keyword that is another ladder\'s planned page is refused too, naming that page', /already plans a page for "best ai company in dubai"/.test(b.validation_error || ''), J(b));
    const ok1 = await ask({ ...REQ, keyword: 'dynamics 365 finance partner uae' }, LADS);
    const ok2 = await ask({ ...REQ, mode: 'keyword' }, LADS);
    const ok3 = await ask({ ...REQ, ladder_id: 'lad_mvigmou94c3c' }, LADS);
    const ok4 = await ask(REQ, LADS, [{ ladder_id: 'lad_mvigmou94c3c', status: 'archived', domain: DOM }]);
    const ok5 = await ask(REQ, null);
    check('everything else passes untouched: another search, another mode, a re-plan of the stored ladder itself, an archived ladder, no ladder read',
      [ok1, ok2, ok3, ok4, ok5].every(x => !x.validation_error && x.keyword), J([ok1, ok2, ok3, ok4, ok5].map(x => x.validation_error || '')));
    const L = new Function(fs.readFileSync(path.join(CD, '_ladder_dup.js'), 'utf8').replace(/return \$input\.all\(\)[\s\S]*$/, 'return LDUP;'))();
    check('one words rule: Ladder Plan uses LDUP.sameWords (the refusal at Rate Limit and the one in the plan cannot drift)',
      /LDUP\.sameWords\(ka, kb\)/.test(fs.readFileSync(path.join(CD, 'Ladder_Plan.js'), 'utf8')) && L.sameWords('ai consultancy dubai', 'ai consulting dubai') && !L.sameWords('erp software uae', 'ai consulting dubai'), '');
    check('the refused request reaches the refusal path with its reason (Refused Input reads the duplicate check first)',
      /\$\('Ladder Duplicate \(Words\)'\)/.test(fs.readFileSync(path.join(CD, 'Refused_Input.js'), 'utf8')), '');
  });

  // ===================================================================================================================================
  await guard('KF4 N4 no 404 page as existing', async () => {
    const SN = 'KF4 N4: the Keyword Check named https://www.techand.ai/ai-consultant/ (the old ladder\'s planned address, a draft, answering 404) as the existing page';
    begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'fa3_live.json.gz'))).toString('utf8'));
    const A = FX.as751; const kw = String(((A['Assess Result'] || [])[0] || {}).keyword || '').toLowerCase().trim();
    const PLANNED = HOST + '/ai-consultant/';
    const ask = async (pages) => { reset();
      mock('Assess Result', items(A['Assess Result']));
      mock('Load Ladders (Assess)', items([{ ladder_id: 'lad_old', domain: DOM, head_keyword: kw, keyword: kw, rung: 4, status: 'writing', target_url: PLANNED }]));
      mock('Load Content Log (Assess)', items([{ domain: DOM, keyword: kw, status: 'not_ready', ladder_id: 'lad_old', existing_page_url: '', published_url: '' }]));
      mock('Load Pages (Assess)', items(pages)); mock('Load Ladder Settings (Assess)', items([{ ladder_id: 'lad_old', status: 'active', domain: DOM }]));
      return (await run('Assess Response', items(A['Fit Parsed?'])))[0].json.body; };
    const gone = await ask([{ url: HOST + '/ai-consultant', http_status: 404, title: '' }, { url: HOST + '/whatwedo', http_status: 200, title: 'What we do' }]);
    console.log('   existing ->', J(gone.existing));
    check('a planned address that answers 404 is not an existing page: no page_url, it travels as planned_url with the draft\'s state',
      gone.existing && !/ai-consultant/.test(String(gone.existing.page_url || '')) && gone.existing.planned_url === PLANNED && gone.existing.draft_status === 'not_ready' && /planned/.test(gone.existing.note), J(gone.existing));
    const live = await ask([{ url: HOST + '/ai-consultant', http_status: 200, title: 'AI Consultant' }]);
    check('the same address once it answers 200 in the inventory IS the page', live.existing && live.existing.page_url === PLANNED && live.existing.page_status === 'live', J(live.existing));
  });

  // ===================================================================================================================================
  await guard('KF5 N5 N6 research covered and ladder names', async () => {
    const SN = 'KF5 N5 / N6: /insights (the blog index) is not "the page answering" a search; a job search is never "refresh your page"; the ladder whose main keyword IS the search is named';
    begin(SN); const check = mkCheck(SN);
    const cand = (keyword, volume, kd, pre, gsc) => ({ keyword, volume, kd, cpc: 4.5, intent: 'commercial', words: keyword.split(' ').length, pre_score: pre, traffic_potential: Math.round(volume * 0.3),
      competitors: [], your_position: null, your_url: '', trend_yearly: 5, serp_types: [], gsc: gsc || null, sources: ['ranked_keywords'] });
    const G = (page, pos) => ({ page, gsc_page: page, position: pos, impressions: 30, clicks: 0, ctr: 0, period_days: 28, period_end: '2026-10-18', kinds: ['striking'] });
    const CANDS = [cand('dynamics 365 finance vat compliance uae', 90, 10, 95, G(HOST + '/insights', 12)), cand('ai consultant', 320, 10, 90, G(HOST + '/whatwedo/ai-automation', 15)),
      cand('ai consulting dubai', 140, 12, 85), cand('dynamics 365 business central partner uae', 140, 20, 80)];
    const model = { domain: DOM, canonical_host: 'www.techand.ai', business_name: 'Tech&', declared_services: SERVICES, services: SERVICES, model_updated_at: '2026-10-21T18:00:00.000Z',
      pages: [{ url: HOST + '/insights', title: 'Insights | Tech&', h1: 'Insights', source: 'sitemap', http_status: 200, status_at: '2026-10-21T17:00:00.000Z', queries: [] },
        { url: HOST + '/whatwedo/ai-automation', title: 'AI & Automation | What We Do | Tech&', h1: 'AI & Automation', source: 'sitemap', http_status: 200, status_at: '2026-10-21T17:00:00.000Z', queries: [] }] };
    reset();
    const base = { domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', goal: 'leads', seeds: ['ai consulting'], services: SERVICES, declared_services: SERVICES,
      business: BUSINESS, competitors: [], site_urls: [], research: { candidates: CANDS, pool_size: CANDS.length, competitor_domains: [], by_source: {}, failures: [] } };
    mock('Collect Research', [{ json: base }]);
    mock('Relevance Chunks', [{ json: { keywords_chunk: CANDS.map(c => ({ keyword: c.keyword })) } }]);
    mock('Load Site Cache', [{ json: {} }]); mock('Site Model', [{ json: { site_model: model } }]); delete store['Reach (Discovery)'];
    mock('Load Domain Ladders (Discovery)', items([{ ladder_id: 'lad_aic', domain: DOM, head_keyword: 'ai consultant', keyword: 'ai consulting dubai', rung: 2, status: 'planned' },
      { ladder_id: 'lad_acd', domain: DOM, head_keyword: 'ai consulting dubai', keyword: 'ai consulting dubai', rung: 4, status: 'planned' }]));
    mock('Load Ladder Settings (Discovery)', [{ json: {} }]);
    const KS = (await run('Rank Keywords', [{ json: { output: { items: CANDS.map(c => ({ keyword: c.keyword, relevance: 2, intent: 'commercial', page_type: 'Service Page', topic: c.keyword })) } } }]))[0].json;
    const ks = KS.keyword_strategy;
    console.log('   covered ->', J((ks.covered || []).map(c => c.keyword + ' -> ' + c.url)), '| ladder_covered ->', J((ks.ladder_covered || []).map(c => c.keyword + ' -> ' + c.head_keyword)));
    check('N5: the blog index /insights covers no keyword ("dynamics 365 finance vat compliance uae" is free, not "refresh /insights")',
      !(ks.covered || []).some(c => /\/insights\/?$/.test(c.url)), J(ks.covered));
    const lc = (ks.ladder_covered || []).find(c => c.keyword === 'ai consulting dubai');
    check('N6: "ai consulting dubai" is named with the ladder whose main keyword it is (lad_acd), not the other ladder\'s rung', lc && lc.ladder_id === 'lad_acd' && lc.head_keyword === 'ai consulting dubai', J(lc));
    mock('Rank Keywords', [{ json: KS }]);
    const pk = (await run('Priority Keywords', [{ json: {} }])).map(i => i.json); mock('Priority Keywords', pk.map(json => ({ json }))); delete store['AI Demand'];
    const job = (kw) => ({ json: { status_code: 20000, tasks: [{ status_code: 20000, result: [{ keyword: kw, datetime: '2026-10-21 18:33:00 +00:00', items: [
      { type: 'people_also_ask', items: [{ title: 'What is AI consulting\'s salary?' }, { title: 'How do I become an AI consultant?' }] },
      ...[['ae.indeed.com', '/q-ai-consultant-jobs.html', 'AI Consultant Jobs in Dubai'], ['www.bayt.com', '/en/uae/jobs/ai-consultant-jobs/', 'AI Consultant jobs in UAE'],
        ['www.glassdoor.com', '/Job/dubai-ai-consultant-jobs.htm', 'AI consultant jobs in Dubai'], ['www.usaii.org', '/certifications/ai-consultant', 'Certified AI Consultant certification'],
        ['www.naukrigulf.com', '/ai-consultant-jobs', 'AI Consultant Jobs']].map(([d, p, t], i) => ({ type: 'organic', rank_group: i + 1, rank_absolute: i + 1, domain: d, url: 'https://' + d + p, title: t }))] }] }] } });
    const serp = (kw) => ({ json: { status_code: 20000, tasks: [{ status_code: 20000, result: [{ keyword: kw, datetime: '2026-10-21 18:33:00 +00:00', items: [
      { type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'example-erp.ae', url: 'https://example-erp.ae/' + kw.replace(/\s+/g, '-'), title: kw }] }] }] } });
    const KSR = (await run('Build Keyword Strategy', pk.map(p => p.keyword === 'ai consultant' ? job(p.keyword) : serp(p.keyword))))[0].json;
    const txt = J(KSR);
    const m = txt.match(/already answered by a page you have:(.*?)Refresh those pages/);
    const careerFlag = (KSR.keyword_strategy && (KSR.keyword_strategy.priority || []).find(k => k.keyword === 'ai consultant')) || null;
    check('N5: the job search "ai consultant" is never in "already answered by a page you have ... Refresh those pages"', careerFlag && careerFlag.career && !(m && /ai consultant\\"/.test(m[1])), J({ career: careerFlag && !!careerFlag.career, line: m && m[1] }));
  });
};
