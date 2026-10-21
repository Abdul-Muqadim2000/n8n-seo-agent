// LP1-LP3 (2026-10-21, paid pre-launch run r04 / DRIVER_REPORT D7): a keyword plan never ignores a page the client already has, and never
// plans two pages for one search. Realistic data: the techand.ai page list and the rung results pages of r04_ladder_plan.json (exec 15).
//   LP1  seo_pages rows with no title (Track my site had not stored them yet): the ladder reads the titles of the pages that could overlap
//        (Ladder Title Requests -> Read Ladder Titles -> Ladder Titles, the real nodes) and finds /whatwedo/ai-automation, whose title is
//        about AI consulting, as the main page to improve - no duplicate top page; the plan says what it read.
//   LP2  a rung keyword sharing 3 of the main keyword's top 7 becomes a supporting keyword of the main page, with the count (the main
//        keyword's own results page is read from SERP Top 10, not from the competitor pages the analysis could fetch).
//   LP3  two rung keywords sharing 3 of 7 that the grouping put in two different groups end up on ONE page, with the count.
// Called from scenarios_v5.js just before the report (one appended line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const EMPTY = [{ json: {} }];
  const DOM = 'techand.ai', HOST = 'https://www.techand.ai';
  // r04 title_gap.urls (the 12 the plan printed of the 19 untitled pages)
  const PAGES = ['', '/whatwedo', '/capabilities', '/industries', '/whatwedo/assess-envision', '/whatwedo/build-implement', '/whatwedo/run-optimize',
    '/whatwedo/managed-services', '/whatwedo/global-rollouts', '/whatwedo/ai-automation', '/capabilities/business-applications', '/capabilities/cloud-services'].map(p => HOST + p);
  // r04 serp_clusters.urls_of (exec 15)
  const R04 = {
    'ai consulting': ['reddit.com/r/consulting/comments/1qbszl2/the_ai_consulting_gold_rush_turned_us_into_the', 'consultancy-me.com/rankings/top-consulting-firms-in-the-middle-east-by-area-of-expertise/ai-genai',
      'mckinsey.com/capabilities/quantumblack/how-we-help-clients', 'bcg.com/capabilities/artificial-intelligence', 'every.to/consulting', 'leewayhertz.com/top-ai-consulting-companies', 'consultport.com/simply-explained/what-is-ai-consulting'],
    'ai consultant dubai': ['opinosis-analytics.com/ai-consulting-in-dubai', 'masterofcode.com/blog/ai-companies-in-dubai', 'revenuebase.ai/companies/ai-consulting-companies/united-arab-emirates/dubai',
      'squareonemea.com/solutions/artificial-intelligence-machine-learning', 'coart.studio/blog/ai-consulting-cost-dubai', 'linkedin.com/pulse/how-choose-right-ai-consulting-company-dubai-your-industry-kochar-1nrke', 'sokrabuae.com/ai-consulting-services-uae'],
    'ai consulting firm': ['masterofcode.com/ai-consulting', 'ibm.com/think/topics/ai-tools-for-consulting', 'thehackettgroup.com/glossary/ai-consulting', 'sixpathsconsulting.com/top-ai-consulting-companies',
      'geeks.ltd/services/ai-data-strategy/artificial-intelligence-consulting', 'molecularcloud.org/p/top-enterprise-ai-consulting-companies-in-dubai-2026', 'tredence.com/service/ai-consulting'] };
  // the main keyword's own top 7: reddit, mckinsey and bcg are also in "ai consulting"'s top 7 (3 of 7 = the 40% rule); Pick Top 6 skips
  // reddit / linkedin / coursera / indeed, so the competitor pages the analysis READ are only two of them
  const HEAD_TOP = ['reddit.com/r/consulting/comments/1qbszl2/the_ai_consulting_gold_rush_turned_us_into_the', 'linkedin.com/pulse/how-to-become-an-ai-consultant',
    'mckinsey.com/capabilities/quantumblack/how-we-help-clients', 'bcg.com/capabilities/artificial-intelligence', 'upwork.com/hire/ai-consultants', 'coursera.org/articles/ai-consultant', 'indeed.com/career-advice/ai-consultant'];
  const serpOf = (urls, kw) => ({ status_code: 20000, tasks: [{ id: 't-' + kw.replace(/\W+/g, '-'), status_code: 20000, status_message: 'Ok.', cost: 0.002,
    result: [{ keyword: kw, items: [{ type: 'ai_overview', rank_group: 1 }, ...urls.map((u, i) => ({ type: 'organic', rank_group: i + 1, url: 'https://' + u, domain: u.split('/')[0], title: kw + ' result ' + (i + 1) }))] }] }] });
  const cand = (keyword, pre_score, extra) => ({ keyword, volume: 90, kd: 0, cpc: 4, intent: 'commercial', pre_score, words: keyword.split(' ').length, traffic_potential: 12, ...(extra || {}) });

  // one plan, the real nodes from the pool on: clusters (real Ladder Clusters on mocked results pages), the title read, the plan
  const planOf = async (o) => {
    const F = require('./fixtures');
    mock('Start Form', F.forms.startLadder);
    const nL = await run('Normalize Input', F.forms.pageLadder);
    mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
    mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
    const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
    mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
    mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
    await run('Merge Keyword Data', store['Site Authority']);
    mock('Verdict Agent', { output: { ...F.verdictGo, expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
    const PV0 = (await run('Parse Verdict', store['Verdict Agent']))[0].json;
    const pv = { ...PV0, keyword: 'ai consultant', domain: DOM, country: 'United Arab Emirates', site_urls: PAGES, internal_link_candidates: [], secondary_keywords: [], existing_page: null,
      keyword_data: { search_volume: 170, keyword_difficulty: 0, google_intent: 'commercial', cpc: 6 }, verdict: 'GO', chosen_by: 'client_typed', ladder_mode: 'auto',
      competitors_summary: [{ rank: 3, domain: 'mckinsey.com', url: 'https://' + HEAD_TOP[2], title: 'QuantumBlack', word_count: 1400 }, { rank: 4, domain: 'bcg.com', url: 'https://' + HEAD_TOP[3], title: 'AI at BCG', word_count: 1600 }] };
    mock('Parse Verdict', pv);
    const pool = { ...pv, research: { pool_size: o.cands.length, candidates: o.cands, refused: [], failures: [] }, site_rankings: { count: 0, head: null, keywords: {}, available: false, top10: [] }, head_tokens: ['ai', 'consultant'], head_geo: [] };
    mock('Ladder Pool', pool);
    mock('Ladder Relevance Chunks', []); mock('Ladder Keyword Relevance', []); mock('After Count (Ladder Keyword Relevance)', []);
    // the rungs' results pages, compared by the real cluster node (top 7, 40%)
    const kws = Object.keys(o.urls);
    mock('Ladder Cluster Requests', kws.map((k, i) => ({ cluster_check: true, keyword: k, location_code: 2784, language_code: 'en', n: i + 1, of: kws.length,
      weight: (o.cands.find(c => c.keyword === k) || {}).pre_score || 0, volume: 90, asked: kws.length, cap: 24, cap_basis: '', candidates: kws.length, on_topic: kws.length, left_uncompared: 0 })));
    mock('Run Ladder Cluster SERP', kws.map(k => serpOf(o.urls[k], k)));
    mock('Ladder Cluster Retry', []); mock('Run Ladder Cluster SERP (Retry)', []);
    await run('Ladder Clusters', EMPTY);
    if (o.headSerp) mock('SERP Top 10', serpOf(o.headSerp, 'ai consultant'));
    // the site: seo_pages rows with NO title (Track my site had not stored them when the ladder ran)
    mock('Site Model', [{ json: { site_model: { domain: DOM, canonical_host: 'www.techand.ai', business_name: 'Tech&', business_facts: 'Dynamics 365 and AI consulting partner in Dubai since 2016, 40 consultants.',
      pages: PAGES.map(u => ({ url: u, title: '', h1: '', source: 'sitemap', queries: [] })) } } }]);
    mock('Load Site Cache', EMPTY); mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY); mock('Load Content Log (Ladder)', EMPTY);
    mock('Load Profile (Model)', [{ json: { site_id: 'site_techand-ai', domain: DOM, author_name: 'Omar Said', author_job_title: 'AI practice lead', author_bio: 'Omar leads the AI practice and has delivered more than 50 projects for companies in the Gulf.' } }]);
    if (o.titles) {
      const rq = await run('Ladder Title Requests', EMPTY);
      const asked = rq.map(r => r.json).filter(r => r.title_check);
      mock('Read Ladder Titles', asked.map(r => o.titles[r.url] ? { statusCode: 200, headers: { 'content-type': 'text/html' }, body: o.titles[r.url] } : { statusCode: 404, headers: {}, body: 'Not found' }));
      await run('Ladder Titles', EMPTY);
    } else mock('Ladder Titles', { page_titles: { asked: 0, read: [], failed: [], skip_reason: 'not part of this case' } });
    const out = (await run('Ladder Plan', []))[0].json;
    return out.ladder || out;
  };
  const pagesOf = (L) => (L.rungs || []).flatMap(r => r.pages || []);

  await guard('LP1 ladder picture: untitled pages are read', async () => {
    reset(); const SN = 'LP1 ladder picture — seo_pages has no titles yet: the ladder reads the pages that could overlap and improves /whatwedo/ai-automation instead of planning a second top page'; begin(SN); const check = mkCheck(SN);
    const AUTO = HOST + '/whatwedo/ai-automation';
    const L = await planOf({ cands: [cand('ai consulting', 40), cand('ai consultant dubai', 30), cand('ai consulting firm', 25)], urls: R04,
      titles: { [AUTO]: '<!doctype html><html><head><title>AI Consultant in Dubai | AI Consulting &amp; Automation | Tech&amp;</title></head><body><h1>AI consulting and automation</h1></body></html>' } });
    const top = L.top || {};
    const tr = ((L.topic_authority || {}).coverage || {}).titles_read || null;
    console.log('   top ->', J({ kw: top.keyword, exists: top.exists, url: top.target_url, status: top.status }), '| read ->', J(tr && tr.read.map(r => r.url)));
    check('the title read asked for /whatwedo/ai-automation (its address shares "ai" with the main keyword) and read its title', !!tr && tr.read.some(r => r.url === AUTO && /AI Consultant/.test(r.title)), J(tr));
    check('the main page is the existing /whatwedo/ai-automation, to improve - no duplicate top page', top.exists === true && top.status === 'improve' && top.target_url === AUTO, J({ exists: top.exists, url: top.target_url, status: top.status }));
    check('the plan says which pages it read now, and that the others were not readable', (L.notes || []).some(n => /Pages read for this plan: .*whatwedo\/ai-automation \("AI Consultant in Dubai/.test(n)), J((L.notes || []).filter(n => /Pages read/.test(n)).concat([String(L.planned)])));
  });

  await guard('LP2 one page per search: rung vs main keyword', async () => {
    reset(); const SN = 'LP2 one page per search — a rung sharing 3 of the main keyword\'s top 7 (its own results page, SERP Top 10) is a supporting keyword of the main page, with the count'; begin(SN); const check = mkCheck(SN);
    const L = await planOf({ cands: [cand('ai consulting', 40), cand('ai consultant dubai', 30), cand('ai consulting firm', 25)], urls: R04, headSerp: HEAD_TOP });
    const pages = pagesOf(L).map(p => p.keyword);
    const mv = ((L.one_page || {}).moved || []).find(m => m.keyword === 'ai consulting') || null;
    console.log('   rung pages ->', J(pages), '| main supporting ->', J((L.top || {}).supporting), '| moved ->', J(mv));
    check('"ai consulting" is not a page of its own', !pages.includes('ai consulting'), J(pages));
    check('it is a supporting keyword of the main page, measured (3 of the top 7)', ((L.top || {}).supporting || []).includes('ai consulting') && mv && mv.to === 'the main page' && mv.shared_urls === 3 && /3 of the top 7 shared/.test(mv.why), J(mv));
    check('the reason is in the plan notes', (L.notes || []).some(n => /"ai consulting" moved from its rung \d page to the main page \(Google answers it with the main keyword's own pages \(3 of the top 7/.test(n)), J((L.notes || []).filter(n => /One keyword/.test(n))));
    check('control: "ai consultant dubai" and "ai consulting firm" share 0 of the main keyword\'s top 7 and keep their own pages', pages.includes('ai consultant dubai') && pages.includes('ai consulting firm'), J(pages));
  });

  await guard('LP3 one page per search: rung vs rung', async () => {
    reset(); const SN = 'LP3 one page per search — two rung keywords sharing 3 of 7, put in two different groups by the clustering, end up on one page with the count'; begin(SN); const check = mkCheck(SN);
    const a = R04['ai consulting'], b = R04['ai consulting firm'], d = R04['ai consultant dubai'];
    // A takes X (3 shared), B takes Y (3 shared); X and Y share 3 of 7 with each other but neither shares 3 with the other group's head
    const urls = { 'ai consulting services uae': a, 'ai consulting company uae': [a[0], a[1], a[2], d[0], d[1], d[2], d[3]],
      'ai consulting firm dubai': b, 'ai consulting agency dubai': [d[0], d[1], d[2], b[0], b[1], b[2], 'example-agency.ae/ai'] };
    const L = await planOf({ cands: [cand('ai consulting services uae', 50), cand('ai consulting firm dubai', 40), cand('ai consulting company uae', 30), cand('ai consulting agency dubai', 20)], urls, headSerp: HEAD_TOP.slice().reverse().map(u => u + '/x') });
    const pg = pagesOf(L);
    const owner = pg.filter(p => p.keyword === 'ai consulting agency dubai' || (p.supporting || []).includes('ai consulting agency dubai'));
    const withCo = pg.find(p => p.keyword === 'ai consulting company uae' || (p.supporting || []).includes('ai consulting company uae'));
    const mv = ((L.one_page || {}).moved || []).find(m => m.keyword === 'ai consulting agency dubai') || null;
    console.log('   pages ->', J(pg.map(p => [p.keyword, p.supporting])), '| moved ->', J(mv));
    check('the two searches that share 3 of 7 are on ONE page', owner.length === 1 && withCo && owner[0] === withCo, J(pg.map(p => [p.keyword, p.supporting])));
    check('the move is printed with the count', !!mv && mv.shared_urls === 3 && /shares 3 of its top 7 with "ai consulting company uae"/.test(mv.why), J(mv));
    check('the page it left no longer lists it', !pg.some(p => p.keyword === 'ai consulting firm dubai' && (p.supporting || []).includes('ai consulting agency dubai')), J(pg.map(p => [p.keyword, p.supporting])));
  });
};
