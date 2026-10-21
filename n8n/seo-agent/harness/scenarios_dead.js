// DEAD1-DEAD9 (E-DEAD, 2026-10-21): the paid pre-launch run on techand.ai (isolated stack, commit 9d97b90) found the reports advising on
// pages that no longer exist. techand.ai had been rebuilt: Search Console still showed ~34 old addresses (2-3k of 5,729 impressions in 28
// days) that answer 404 (the bare host 308s to www, which 404s), with no redirects. The first thing the owner had to hear was "301 the old
// addresses"; instead (REPORTS_REVIEW.md RV-1 ... RV-18):
//   RV-1  no report pulled them into one message; the weekly site report made one of them "the single page" for a search, the AI visibility
//         brief said "build on your existing D365 pages", AI Growth acted on them, the fix pack had no redirects file;
//   RV-2  the audit filed bare-host 308s that end in 404 as Low "redirect somewhere else" ("/x -> /x (308)");
//   RV-3  "add them to the sitemap" / "rewrite the titles" for dead pages;  RV-4 Bing was sent 404 addresses;
//   RV-5  the fix order put CDN caching and authority above them, a complete crawl was called a crawl limit, "N of 23 crawled pages";
//   RV-6  "far fewer top-10 rankings than competitors" against a competitor median of 0, help.ardoq.com as a competitor;
//   RV-8  the disavow file held `domain:us.com`;  RV-14/15/16 smaller wording and scoring slips.
// Every check runs the GENERATED code (harness/code_v4) on fixtures built from the run's own evidence (run/evidence/*.json, the live page
// copies of 2026-10-21) and fails on the code before the fix. Called from scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function(body + '\nreturn { ' + names.join(', ') + ' };')(); };
  // customer text: no em dash, no curly quote, no ellipsis (the owner's rule of 2026-10-19)
  const TELL = /[—‘’“”…]/;
  const DOM = 'techand.ai', SID = 'site_techand-ai', WWW = 'https://www.techand.ai', BARE = 'https://techand.ai';
  // the 19 live pages of the rebuilt site (live copies of 2026-10-21, titles as served) plus /whatwedo/global-rollouts from the sitemap
  const LIVE = [['/', 'Tech& | Turning Technology into measurable Business Impact'], ['/capabilities', 'Capabilities | Tech&'], ['/capabilities/business-applications', 'Business Applications | Tech&'],
    ['/capabilities/cloud-services', 'Cloud Services | Tech&'], ['/capabilities/data', 'Data & Analytics | Tech&'], ['/contact-us', 'Contact Us | Tech&'], ['/industries', 'Industries We Serve | Tech&'],
    ['/insights', 'Insights | Tech&'], ['/whatwedo', 'What We Do | Tech&'], ['/whatwedo/ai-automation', 'AI & Automation | What We Do | Tech&'], ['/whatwedo/assess-envision', 'Assess & Envision | What We Do | Tech&'],
    ['/whatwedo/managed-services', 'Managed Services | What We Do | Tech&'], ['/whatwedo/global-rollouts', 'Global Rollouts | What We Do | Tech&'], ['/whywith-techand', 'Why Tech& | Tech&']];
  // the old addresses (all answer 404 on www; "redirect" = Search Console shows the bare host, which 308s to www first). Impressions and clicks
  // are Search Console's 28 days to 2026-10-18 as the site report of the run read them (r03_site_tracker.json top_pages); 0 where it did not list them
  const GONE_ROWS = [['/dynamics-365-finance-and-operations-uae', 'direct', 1560, 1], ['/insights/upgrading-your-erp-for-uae-peppol-pint-ae-compliance-a-technical-integration-guide', 'redirect', 319, 1],
    ['/insights/your-current-pdf-invoices-will-be-illegal-in-the-uae-by-2027-and-how-to-fix-it', 'direct', 253, 1], ['/dynamics-365-project-operations-uae', 'direct', 251, 4], ['/dynamics-365-crm-uae', 'direct', 233, 1],
    ['/d365-finance-operations-implementation-rollout-uae', 'redirect', 0, 0], ['/insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance', 'redirect', 0, 0]];
  const page404 = '<!DOCTYPE html><html><head><title>404 - Page Not Found | Tech&amp;</title><meta name="robots" content="noindex"></head><body><h1>Page not found</h1>' + '<p>This page does not exist.</p>'.repeat(20) + '</body></html>';
  const crawled = () => ({ tasks: [{ result: [{ items: LIVE.map(([p, t]) => ({ url: WWW + (p === '/' ? '/' : p), resource_type: 'html', status_code: 200, meta: { title: t, htags: {}, canonical: WWW + p } })) }] }] });
  let PLAN = null, GONE_F = null;

  // =================================================================================================================================
  await guard('DEAD1 the audit follows a redirect to its end and files every gone address once', async () => {
    const SN = 'DEAD1 RV-2 / RV-1 / RV-3 / RV-5: a bare-host 308 that ends in 404 is gone (not "redirect somewhere else"), every gone address is ONE finding with the page it should redirect to, the Search Console lists and the coverage line stop advising on them';
    reset(); begin(SN); const check = mkCheck(SN);
    const COVERAGE = { category: 'Crawlability & Indexing', severity: 'Medium', title: 'The crawl covered only part of the site', scoring: true, sample_urls: [], affected_count: 7,
      evidence: 'Crawled 19 of 26 known URLs (73%; sitemap 19 + 7 pages with Search Console impressions); 7 known URLs were not reached, although the crawl finished under its limit of 200 pages: no internal link leads to them', why: 'w', fix: 'f' };
    const SITEMAP_F = { category: 'Crawlability & Indexing', severity: 'Low', title: 'Pages Google shows in search are missing from the sitemap', evidence: '5 page(s) with impressions are not in sitemap.xml', why: 'w', fix: 'Add them to the sitemap', scoring: true,
      sample_urls: [], affected_count: 5, urls_all: [BARE + GONE_ROWS[0][0], BARE + GONE_ROWS[3][0], BARE + GONE_ROWS[4][0], BARE + GONE_ROWS[2][0], BARE + '/nav-gp-migration-to-business-central-uae'] };
    const NOCLICK_F = { category: 'Crawlability & Indexing', severity: 'Low', title: 'Pages shown in Google but never clicked', evidence: '3 page(s) with 50+ impressions and 0 clicks in 28 days', why: 'w', fix: 'rewrite the titles', scoring: true,
      sample_urls: [], affected_count: 3, urls_all: [BARE + '/capabilities/data', BARE + GONE_ROWS[5][0], BARE + GONE_ROWS[6][0]] };
    mock('Render Diff', [{ json: { domain: DOM, probe: { findings: [], what_works: [], measurements: {} }, site_structure: { crawl_coverage: { crawl_complete: true, known_urls: 26, not_crawled: GONE_ROWS.length } },
      extra_findings: [COVERAGE, SITEMAP_F, NOCLICK_F], extra_works: [] } }]);
    const targets = GONE_ROWS.map(([p, how, imp, cl]) => ({ url: (how === 'redirect' ? BARE : WWW) + p, path: p, source: 'Search Console', impressions: imp, clicks: cl, changed_at: '', changed_label: '' }));
    targets[0].not_crawled_plan = { not_crawled_total: GONE_ROWS.length, known_urls: 26, coverage_pct: 73, cap: 25, order_note: '', changed_first: 0, changed: null, method: 'one plain GET each' };
    mock('Not Crawled Targets', targets.map(json => ({ json })));
    mock('Fetch Not Crawled', GONE_ROWS.map(([p, how]) => how === 'redirect' ? { statusCode: 308, headers: { location: WWW + p }, data: '' } : { statusCode: 404, headers: { 'content-type': 'text/html' }, data: page404 }));
    const hops = (await run('Not Crawled Hops', store['Fetch Not Crawled'])).map(i => i.json);
    check('RV-2: every address that answered a redirect is asked again with the redirects followed (the three bare-host 308s), the rest are not',
      hops.length === 3 && hops.every(h => /^https:\/\/techand\.ai\//.test(h.url) && h.first_status === 308), J(hops));
    mock('Fetch Not Crawled (Final)', hops.map(() => ({ statusCode: 404, headers: {}, data: page404 })));
    mock('Get Crawled Pages', crawled());
    const NC = (await run('Not Crawled Check', store['Fetch Not Crawled (Final)']))[0].json;
    const F = NC.extra_findings; const by = (re) => F.filter(f => re.test(String(f.title || '')));
    check('RV-2: an address whose redirect ends in 404 is not filed as "redirect somewhere else" (the run filed 8 of them as Low, evidence "/x -> /x (308)")',
      !by(/redirect somewhere else/).length && NC.not_crawled_check.states.gone === GONE_ROWS.length && !NC.not_crawled_check.states.redirect, J({ titles: F.map(f => f.title), states: NC.not_crawled_check.states }));
    const g = by(/^Pages Google still shows no longer answer: redirect them$/);
    GONE_F = g[0] || null;
    check('RV-1: ONE finding names every gone address, High because Google still shows them, with the count and the impressions they still earn',
      g.length === 1 && g[0].severity === 'High' && g[0].affected_count === GONE_ROWS.length && /7 address\(es\) answer HTTP 404 \(3 of them only after a redirect to the main host\)/.test(g[0].evidence)
      && /still earn impressions in Search Console \(2,616 impressions and 8 clicks/.test(g[0].evidence), J(g.map(f => [f.severity, f.affected_count, f.evidence])));
    const red = (g[0] && g[0].redirects) || []; const to = (p) => (red.find(r => r.from === p) || {}).to;
    check('RV-1: each gone address has the page it should redirect to: an article to its section page, the rollout page to "Global Rollouts", the D365 pages with no live match to the home page (said so)',
      red.length === GONE_ROWS.length && to(GONE_ROWS[1][0]) === '/insights' && to(GONE_ROWS[5][0]) === '/whatwedo/global-rollouts' && to(GONE_ROWS[0][0]) === '/'
      && /no live page matches it by name/.test((red.find(r => r.from === GONE_ROWS[0][0]) || {}).match) && red[0].from === GONE_ROWS[0][0], J(red.map(r => [r.from, r.to, r.match])));
    check('RV-1: the fix is the redirect, pointing at redirects.csv in the fix pack, and the finding text carries no em dash, curly quote or ellipsis',
      g[0] && /permanent \(301\) redirect/.test(g[0].fix) && /redirects\.csv/.test(g[0].fix) && !TELL.test(g[0].title + g[0].evidence + g[0].why + g[0].fix), g[0] && (g[0].evidence + ' | ' + g[0].fix));
    check('RV-1: the not-crawled block carries the redirect plan for the fix pack',
      NC.not_crawled_check.gone === GONE_ROWS.length && (NC.not_crawled_check.redirects || []).length === GONE_ROWS.length, J({ gone: NC.not_crawled_check.gone, n: (NC.not_crawled_check.redirects || []).length }));
    check('RV-3: "add them to the sitemap" is dropped when what is left after the gone addresses is under its own bar (1 of 5 left)', !by(/missing from the sitemap/).length, J(F.map(f => f.title)));
    const nc = by(/never clicked/)[0];
    check('RV-3: "never clicked, rewrite the titles" keeps the live page only and says where the gone ones went', nc && nc.affected_count === 1 && nc.urls_all.length === 1 && /capabilities\/data/.test(nc.urls_all[0])
      && /2 more no longer answer and are in the redirect finding/.test(nc.evidence), J(nc));
    const cov = F.find(f => /crawl (covered only part|reached every page)/.test(f.title));
    check('RV-5: a complete crawl whose missed addresses are all gone is not "the crawl covered only part of the site": an unscored note that there is no limit to raise',
      cov && cov.title === 'The crawl reached every page that still answers' && cov.severity === 'Info' && cov.scoring === false && /no crawl limit to raise/.test(cov.why), J(cov));
    PLAN = NC.not_crawled_check.redirects;
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD2 the fix pack carries the redirects', async () => {
    const SN = 'DEAD2 RV-1: the fix pack holds redirects.csv (+ nginx / Apache) for every gone address and for the crawl\'s broken pages; the README promises redirects only when the pack has them';
    reset(); begin(SN); const check = mkCheck(SN);
    const items = crawled(); items.tasks[0].result[0].items.push({ url: WWW + '/insights/agentic-ai', resource_type: 'broken', status_code: 404, checks: { is_broken: true }, meta: {} });
    const audit = (redirects) => [{ json: { site_id: SID, site_audit: { measurements: { canonical_host: 'www.techand.ai', robots_txt: 'User-agent: *\nAllow: /\nSitemap: https://www.techand.ai/sitemap.xml\n' }, entity: {}, internal_links: [], not_crawled_check: { redirects } } } }];
    mock('Check Crawl', [{ json: { domain: DOM } }]); mock('Get Crawled Pages', items); mock('Audit Diff', audit(PLAN || []));
    const fp = (await run('Fix Pack', [{ json: {} }]))[0].json.fix_pack; const file = (n) => ((fp.files || []).find(f => f.name === n) || {}).content || '';
    const csv = file('redirects.csv');
    check('RV-1: redirects.csv lists every gone address with its target and the crawl\'s broken /insights page (DataForSEO files a 404 under resource_type "broken", which the html-only list never held)',
      (PLAN || []).length === 7 && GONE_ROWS.every(([p]) => csv.indexOf('"' + p + '"') >= 0) && /"\/insights\/agentic-ai"/.test(csv) && /"\/d365-finance-operations-implementation-rollout-uae","\/whatwedo\/global-rollouts"/.test(csv)
      && /location = \/dynamics-365-crm-uae \{ return 301 /.test(file('redirects-nginx.conf')) && /Redirect 301 \/dynamics-365-crm-uae /.test(file('redirects.htaccess')), csv.slice(0, 600));
    check('RV-1: the README says to add the redirects when the pack has them', /add the redirects in your server or CDN/.test(file('README.txt')), file('README.txt').slice(0, 400));
    mock('Get Crawled Pages', crawled()); mock('Audit Diff', audit([]));
    const fp0 = (await run('Fix Pack', [{ json: {} }]))[0].json.fix_pack;
    check('RV-1: with nothing to redirect there is no redirects file and the README does not promise one (it did, live)', !fp0.files.some(f => /^redirects/.test(f.name)) && !/add the redirects/.test(((fp0.files.find(f => f.name === 'README.txt')) || {}).content || ''),
      J(fp0.files.map(f => f.name)));
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD3 the fix order and the denominator', async () => {
    const SN = 'DEAD3 RV-5: the gone addresses with impressions outrank the CDN-caching and authority findings, and their basis counts them in their own unit, not "N of 23 crawled pages"';
    reset(); begin(SN); const check = mkCheck(SN);
    if (!GONE_F) throw new Error('DEAD1 did not produce the finding');
    const CDN = { category: 'Performance', severity: 'High', title: 'HTML cannot be cached by the CDN (no-store / private)', scope: 'site', evidence: 'Cache-Control: private, no-cache, no-store', affected_count: 0, sample_urls: [] };
    const AGE = { category: 'Authority', severity: 'High', title: 'Very young domain competing with long-established sites', scope: 'site', evidence: 'techand.ai registered 2026-02-19', affected_count: 0, sample_urls: [] };
    const sc = { connected: true, totals: { clicks: 32, impressions: 5729 }, pages_with_impressions: 44, page_traffic_complete: true,
      page_traffic: [...GONE_ROWS.map(([p, , imp, cl]) => [p, cl, imp]), ['/', 15, 538], ['/whatwedo', 1, 99]] };
    const out = (await run('_impact', [{ json: { findings: [CDN, AGE, GONE_F], total_pages: 23, search_console: sc, key_pages: [] } }]))[0].json;
    const L = out.findings;
    check('RV-5: the redirect finding is first, ahead of the site-wide CDN-caching and domain-age findings (the run ranked them above the dead pages)',
      L[0].title === GONE_F.title && L[0].impact_blocker === true, J(L.map(f => [f.title, f.impact, f.impact_band])));
    check('RV-5: its basis counts the addresses outside the crawl in their own unit, never as "of 23 crawled pages", and says why it is first',
      /^Google still shows these addresses and they answer with an error/.test(L[0].impact_basis) && /7 of 7 known URLs read outside the crawl/.test(L[0].impact_basis) && !/crawled pages/.test(L[0].impact_basis), L[0].impact_basis);
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD4 a comparison needs a side to compare with', async () => {
    const SN = 'DEAD4 RV-6: no "does not rank in the top 10 / far fewer top-10 rankings" and no "organic traffic under 10% of competitors" against a competitor median of 0 top-10 rankings and 4 visits; a help-centre subdomain is never a competitor';
    reset(); begin(SN); const check = mkCheck(SN);
    const ov = (top10, etv) => ({ tasks: [{ result: [{ items: [{ metrics: { organic: { pos_1: 0, pos_2_3: 0, pos_4_10: top10, count: 12, etv, estimated_paid_traffic_cost: 0 } } }] }] }] });
    mock('Schema Findings', [{ json: { domain: DOM, country: 'United Arab Emirates', extra_findings: [], extra_works: [] } }]);
    mock('Pick Competitors', [{ domain: DOM, is_you: true }, { domain: 'leewayhertz.com' }, { domain: 'gpstrategies.com' }, { domain: 'help.ardoq.com' }].map(json => ({ json })));
    mock('Domain Overview Answers', [ov(0, 0), ov(0, 4), ov(0, 10), ov(0, 1)].map(json => ({ json })));
    mock('Domain Ages', [{ json: { ages: {} } }]);
    const CA = (await run('Competitor Analysis', store['Domain Ages']))[0].json;
    const T = CA.extra_findings.map(f => f.title);
    check('RV-6: the run\'s figures (techand.ai 0 top-10 rankings and 0 visits against a median of 0 and 4) raise no comparison finding', !T.some(t => /top 10|top-10|under 10% of competitors/.test(t)), J(T));
    mock('Domain Overview Answers', [ov(0, 0), ov(40, 900), ov(55, 1200), ov(30, 800)].map(json => ({ json })));
    const CB = (await run('Competitor Analysis', store['Domain Ages']))[0].json;
    check('RV-6: against competitors that do hold rankings and traffic the findings still stand (the guard is a floor, not a switch)',
      CB.extra_findings.some(f => /does not rank in Google.s top 10/.test(f.title)) && CB.extra_findings.some(f => f.title === 'Organic traffic is under 10% of competitors'), J(CB.extra_findings.map(f => f.title)));
    reset();
    mock('Schema Findings', [{ json: { domain: DOM, country: 'United Arab Emirates', competitors: [] } }]);
    mock('Find Competitors Answers', [{ json: { tasks: [{ result: [{ items: [{ domain: 'help.ardoq.com', intersections: 9 }, { domain: 'leewayhertz.com', intersections: 4 }, { domain: 'docs.example-tool.io', intersections: 3 }, { domain: 'gpstrategies.com', intersections: 2 }] }] }] } }]);
    mock('Fallback Queries', [{ json: { query: 'ai consultant' } }]);
    const PC = (await run('Pick Competitors', [{ json: {} }])).map(i => i.json).filter(c => !c.is_you).map(c => c.domain);
    check('RV-6: a help-centre or docs subdomain of some tool is never picked as a competitor (help.ardoq.com was, live)', !PC.includes('help.ardoq.com') && !PC.includes('docs.example-tool.io') && PC.includes('leewayhertz.com'), J(PC));
    reset();
  });

  // =================================================================================================================================
  const SITE_GSC_PAGES = [[WWW + '/', 15, 538], [WWW + '/insights/microsofts-saudi-arabia-east-datacenter-goes-live-in-november-2026-what-it-means-for-your-d365-roadmap', 5, 235],
    ...GONE_ROWS.map(([p, how, imp, cl]) => [(how === 'redirect' ? BARE : WWW) + p, cl, imp]), [BARE + '/whatwedo', 1, 99], [BARE + GONE_ROWS[0][0], 1, 1190]].map(([page, clicks, impressions]) => ({ page, clicks, impressions, position: 30 }));
  await guard('DEAD5 the weekly site report reads what the pages Google shows answer', async () => {
    const SN = 'DEAD5 RV-1 / RV-15: the Site Tracker reads the pages Google shows outside the sitemap (redirects followed), stores what they answer, puts their redirects first and never advises on them; "tech and tech" is the brand; the cannibal line counts its pages';
    reset(); begin(SN); const check = mkCheck(SN);
    const SITEMAP = [...LIVE.map(([p]) => ({ url: WWW + p, lastmod: '2026-10-18' })), { url: WWW + '/insights/microsofts-saudi-arabia-east-datacenter-goes-live-in-november-2026-what-it-means-for-your-d365-roadmap', lastmod: '' }];
    mock('Resolve Properties', [{ json: { site_id: SID, domain: DOM } }]);
    mock('Parse GSC', [{ json: { site_idx: 0, pages: SITE_GSC_PAGES, queries: [], page_perf: [] } }]);
    mock('Detect Published', [{ json: { site_id: SID, inventory: SITEMAP, detected: [], page_titles: LIVE.map(([p, t]) => ({ url: WWW + p, title: t, h1: '' })), sitemap: { ok: true } } }]);
    mock('Load Pages (Site)', []);
    const T = (await run('Status Targets (Site)', store['Load Pages (Site)'])).map(i => i.json);
    check('RV-1: the pages Google shows that the sitemap does not list are read (one per address: the bare and www rows of the F&O page are one), the most impressions first; the sitemap pages are not',
      T.length === GONE_ROWS.length && T[0].url === WWW + GONE_ROWS[0][0] && T[0].impressions === 2750 && !T.some(t => /\/whatwedo$|techand\.ai\/$/.test(t.url)) && T[0].status_plan[0].planned === GONE_ROWS.length,
      J(T.map(t => [t.url, t.impressions])));
    mock('Fetch Page Status (Site)', T.map(() => ({ statusCode: 404, headers: {}, data: page404 })));
    mock('Site Model (Site)', []); mock('Load AI Pages (Site)', []); mock('Match Slugs (Detect)', [{ json: { skip: true, sites: [] } }]);
    const INV = (await run('Page Inventory (Site)', store['Fetch Page Status (Site)']))[0].json;
    const row = (p) => INV.rows.find(r => r.url.indexOf(p) >= 0 && /404/.test(String(r.http_status))) || INV.rows.find(r => r.url.indexOf(p) >= 0) || {};
    check('RV-1: seo_pages rows of the gone addresses carry http_status 404 and when it was read (a page known only from Search Console had no status at all)',
      GONE_ROWS.every(([p]) => Number(row(p).http_status) === 404 && !!row(p).status_at) && INV.gone.length === GONE_ROWS.length && INV.status_check.read === GONE_ROWS.length,
      J(GONE_ROWS.map(([p]) => [p, row(p).http_status])));
    const COLS = (() => { try { return require('./table_cols.json').PAGES || null; } catch (e) { return null; } })();
    check('RV-1: every row is exactly the seo_pages columns, http_status and status_at included', INV.rows.every(r => !COLS || J(Object.keys(r).sort()) === J([...COLS].sort())) && 'http_status' in INV.rows[0], J(Object.keys(INV.rows[0])));
    // the weekly report
    const MODEL = (await run('_site_model', [{ json: { site_row: { site_id: SID, domain: DOM, canonical_host: 'www.techand.ai', business_name: 'Tech&', model_updated_at: new Date().toISOString() } } }]))[0].json.model;
    const RANGES = { current: { start: '2026-09-21', end: '2026-10-18' }, previous: { start: '2026-08-24', end: '2026-09-20' }, yoy: { start: '2025-09-21', end: '2025-10-18' } };
    const CFG = { striking_min_impressions: 30, ctr_gap_min_impressions: 100, alert_min_pct: 10, alert_min_click_events: 40, alert_min_impression_events: 400, alert_min_session_events: 40, service_account_email: 'svc@example.com' };
    const SITE_ROW = { site_id: SID, domain: DOM, gsc_property: 'sc-domain:' + DOM, gsc_connected: true, gsc_permission: 'siteFullUser', gsc_error: null, country: 'United Arab Emirates', location_code: 2784, language_code: 'en',
      email: '', callback_url: '', request_id: '', source: 'app', status: 'active', created_at: '2026-10-21T00:00:00.000Z', keywords: [], tracked: [], ladder_pages: [], ladder_heads: [], serp_positions: {}, pending_publish: [],
      console_alerts: [], last_checkin: null, checkin_due: false, ranges: RANGES, on_demand: false, checked_at: new Date().toISOString(), config: CFG };
    // the run's two cannibalisation rows (r03_site_tracker.json gsc.cannibal): one between three live pages, one between two pages that answer 404
    const CANNIBAL = [{ query: 'tech and tech', pages: [{ page: BARE + '/', share: 38.6, position: 28.9, impressions: 34, clicks: 0 }, { page: BARE + '/whywith-techand', share: 35.2, position: 56.1, impressions: 31, clicks: 0 }, { page: BARE + '/whatwedo', share: 26.1, position: 73.7, impressions: 23, clicks: 0 }],
        preferred: BARE + '/', best: { page: BARE + '/', share: 38.6 }, split: false, impressions: 88, clicks: 0, page_count: 3, basis: 'Search Console showed 3 of your pages for "tech and tech" over the last 28 days (88 impressions).' },
      { query: 'dynamics 365 finance in uae', pages: [{ page: BARE + GONE_ROWS[6][0], share: 65.5, position: 21.9, impressions: 36, clicks: 0 }, { page: BARE + GONE_ROWS[0][0], share: 18.2, position: 42.1, impressions: 10, clicks: 0 }],
        preferred: BARE + GONE_ROWS[6][0], best: { page: BARE + GONE_ROWS[6][0], share: 65.5 }, split: false, impressions: 55, clicks: 0, page_count: 5, basis: 'Search Console showed 2 of your pages for "dynamics 365 finance in uae".' }];
    const tot = (c, i) => ({ clicks: c, impressions: i, ctr: c / i, position: 26 });
    const GSC = { site_idx: 0, totals: { cur: tot(32, 5729), prev: tot(23, 2741), yoy: null }, deltas: { clicks_pct: 39, impressions_pct: 109 }, daily: [], queries: [], pages: SITE_GSC_PAGES, page_perf: [], tracked: [],
      top_pages: SITE_GSC_PAGES.slice(0, 10), winners: [], losers: [], new_queries: [], lost_queries: [], striking: [{ query: 'dynamics 365 crm uae', position: 8, impressions: 120, clicks: 1, page: WWW + GONE_ROWS[4][0] }],
      ctr_gaps: [{ query: 'd365 finance and operations', position: 5, impressions: 300, ctr: 0, expected_ctr: 0.05, page: WWW + GONE_ROWS[0][0] }], decaying_pages: [], not_decay: [], rising_pages: [], errors: [], cannibal: CANNIBAL,
      cannibal_summary: null, devices: null, countries: null, search_types: null, recent: null, content_groups: null, change_tests: [], query_count: 271, page_count: SITE_GSC_PAGES.length, rows_read: 300, paging: [], truncated: [] };
    mock('Resolve Properties', [{ json: SITE_ROW }]); mock('Site Model (Site)', [{ json: { site_id: SID, domain: DOM, model: MODEL } }]); mock('Parse GSC', [{ json: GSC }]);
    const SM_ = (await run('Site Metrics', store['Resolve Properties']))[0].json;
    const goneKeys = GONE_ROWS.map(([p]) => p);
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = (a) => goneKeys.filter(p => new RegExp(esc(p) + '(?![A-Za-z0-9/-])').test(String(a.action || '') + ' ' + String(a.url || '') + ' ' + String(a.why || '')));
    const first = SM_.actions[0] || {};
    check('RV-1: the first action is the redirect of the old addresses (priority 1), naming the targets, with the impressions they still earn',
      first.type === 'redirect_gone' && first.priority === 1 && /Redirect the 7 old address\(es\) that now answer 404/.test(first.action) && /\/dynamics-365-finance-and-operations-uae \(2,750 impressions\) to \//.test(first.action)
      && /Do not work on these pages: they no longer exist/.test(first.why) && !TELL.test(first.action + first.why), J(first));
    const others = SM_.actions.filter(a => a.type !== 'redirect_gone');
    check('RV-1: no other action points at a gone address: no "make it the single page", no striking-distance push, no title rewrite (the run\'s priority 1 consolidated on a 404 page)',
      others.every(a => !names(a).length) && !others.some(a => a.type === 'striking' || a.type === 'ctr'), J(others.map(a => [a.type, a.action.slice(0, 120)])));
    check('RV-1: the cannibalisation between two gone pages is gone, and the report\'s cannibal list holds only live pages',
      !others.some(a => /dynamics 365 finance in uae/.test(a.action)) && SM_.cannibal.length === 1 && SM_.cannibal[0].query === 'tech and tech', J(SM_.cannibal.map(c => c.query)));
    const can = others.find(a => a.type === 'cannibalisation') || {};
    check('RV-15: three pages are not "Two of your pages": the line says 3 and asks to point the others at the chosen one', /^3 of your pages compete for "tech and tech"/.test(can.action || '') && /point the others at it/.test(can.action || '') && !TELL.test(can.action || ''), can.action);
    check('RV-1: the report carries the redirect plan and what the page read covered', (SM_.gone_pages || []).length === 7 && SM_.page_status && SM_.page_status.read === 7, J({ n: (SM_.gone_pages || []).length, st: SM_.page_status }));
    const BI = JSON.parse((await run('Brief Input', store['Site Metrics']))[0].json.facts);
    const tp = J((BI.search_console || {}).top_pages || []);
    check('RV-1: the brief gets the gone addresses once, as redirects to make, and none of them in its top pages (the run\'s brief made one "the single page" and watched another)',
      (BI.pages_that_no_longer_answer || []).length === 7 && /never tell the owner to improve, link to, consolidate on, watch or refresh/.test(BI.pages_that_no_longer_answer_note) && !goneKeys.some(p => tp.indexOf(p + '"') >= 0)
      && BI.computed_actions[0].type === 'redirect_gone' && /never tell the owner to add a redirect between the two host forms/.test(BI.host_note), J({ tp, note: BI.host_note }));
    // RV-15: the brand typed as "tech and tech" is the brand (Parse GSC leaves brand searches out of the cannibal check)
    const { GQ } = kits('Parse_GSC.js', ['GQ']); const bt = GQ.brandTest(DOM, ['Tech&']);
    check('RV-15: "tech and tech" (the name "Tech&" followed by its own word) is a search for the brand, "tech and software" still is not', bt.is('tech and tech') === true && bt.is('tech and') === true && bt.is('tech and software') === false && bt.is('technology and analytics') === false,
      J({ a: bt.is('tech and tech'), b: bt.is('tech and software') }));
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD6 the site model never answers a search with a gone page', async () => {
    const SN = 'DEAD6 RV-1: SM.matchPage skips a page that answers 404, so no ladder, verdict or report calls it "the page that answers this search"; the row keeps its status';
    reset(); begin(SN); const check = mkCheck(SN);
    const row = { site_id: SID, domain: DOM, canonical_host: 'www.techand.ai', business_name: 'Tech&', model_updated_at: new Date().toISOString() };
    const pages = [{ url: WWW + '/dynamics-365-finance-and-operations-uae', title: 'Dynamics 365 Finance and Operations UAE | Tech&', http_status: 404, status_at: '2026-10-21T14:15:00Z', source: 'gsc' },
      { url: WWW + '/capabilities/business-applications', title: 'Business Applications | Tech&', http_status: 200, source: 'sitemap' }];
    const out = (await run('_site_model', [{ json: { site_row: row, extras: { pages }, keyword: 'dynamics 365 finance and operations uae' } }]))[0].json;
    check('RV-1: the gone page is not the match for its own search (it was: the inventory had no status)', out.match === null, J(out.match));
    check('RV-1: the page rows keep what the address answered, and a live page reads 200', out.page_rows.find(r => /dynamics-365/.test(r.url)).http_status === 404 && out.page_rows.find(r => /business-applications/.test(r.url)).http_status === 200, J(out.page_rows.map(r => [r.url, r.http_status])));
    const live = (await run('_site_model', [{ json: { site_row: row, extras: { pages: [{ ...pages[0], http_status: 200 }] }, keyword: 'dynamics 365 finance and operations uae' } }]))[0].json;
    check('RV-1: the same page answering 200 is still matched (only a gone page is skipped)', live.match && /dynamics-365-finance-and-operations-uae/.test(live.match.url), J(live.match));
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD7 the AI visibility brief never builds on a gone page', async () => {
    const SN = 'DEAD7 RV-1 / RV-14: a cited page that answers 404 is not one of "your cited pages" for the brief, it is a redirect to make; a search engine is not a place to get featured, a free-zone authority is official, a ranking-list site is not a rival';
    reset(); begin(SN); const check = mkCheck(SN);
    const M = { mention_rate: 0, mention_ci: [0, 9], samples: 40, pulse_samples: 0, citation_rate: 0, share_of_voice: 0, visibility_score: 0, avg_rank: 0, aio_presence: 0, brand: 'known', sentiment_score: 0, delta: null, errors: 0, requests: 41, demand_total: 0, ai_impressions: 0, lost_demand: 0 };
    const AM = { site_id: SID, domain: DOM, business_name: 'Tech&', checked_at: '2026-10-21T14:32:00Z', metrics: M, traffic: null, index: null, access: null, engines: {}, clusters: { stages: [], clusters: [] }, competitors: [], sources: [],
      our_pages: [{ url: BARE + '/', citations: 2, engines: ['chatgpt'] }, { url: BARE + '/d365-finance-operations-implementation-rollout-uae', citations: 1, engines: ['perplexity'], gone: true, http_status: 404 },
        { url: BARE + '/dynamics-365-finance-and-operations-uae', citations: 1, engines: ['claude'], gone: true, http_status: 404 }],
      gone_cited: [{ from_url: BARE + '/d365-finance-operations-implementation-rollout-uae', from: '/d365-finance-operations-implementation-rollout-uae', to_url: WWW + '/whatwedo/global-rollouts', to: '/whatwedo/global-rollouts', status: 404, citations: 1 },
        { from_url: BARE + '/dynamics-365-finance-and-operations-uae', from: '/dynamics-365-finance-and-operations-uae', to_url: WWW + '/', to: '/', status: 404, citations: 1 }],
      questions: [], gaps: [], fanout: [], perception: { score: 0, positive: 0, negative: 0, descriptors: [], fact_check: 'not_checked', issues: [] }, market: null, alerts: [], actions: [] };
    mock('AI Metrics', [{ json: AM }]);
    const facts = JSON.parse((await run('AI Brief Input', store['AI Metrics']))[0].json.facts);
    check('RV-1: the brief\'s cited pages are the live ones; the gone ones come as redirects with the rule never to build on them (the run\'s brief said "build on your existing D365 pages")',
      facts.your_cited_pages.length === 1 && /techand\.ai\/ 2x/.test(facts.your_cited_pages[0]) && (facts.cited_pages_that_no_longer_answer || []).length === 2 && /Never advise building on/.test(facts.cited_pages_note || ''), J({ c: facts.your_cited_pages, g: facts.cited_pages_that_no_longer_answer }));
    const src = fs.readFileSync(path.join(CD, 'AI_Metrics.js'), 'utf8');
    const KIND = new Function(src.slice(src.indexOf('const GENERIC_SOCIAL'), src.indexOf('const pct = (a, b)')) + '\nreturn kindOf;')();
    check('RV-14: google.com is a search engine (never "Get featured on google.com"), difc.com / adgm.com are official bodies (never rivals AI recommends), a news site stays media',
      KIND('google.com') === 'engine' && KIND('difc.com') === 'official' && KIND('adgm.com') === 'official' && KIND('gulfnews.com') === 'media' && KIND('hyve.ae') === 'site', J(['google.com', 'difc.com', 'adgm.com', 'hyve.ae'].map(KIND)));
    check('RV-14: a site whose cited pages are ranking lists ("Best AI Consultants ... (2026)") is not counted among the businesses AI recommends, and a search engine is never a prospect',
      /const listSites = /.test(src) && /list\(r\.competitors\)\.filter\(notList\)/.test(src) && /\['platform', 'authority', 'engine'\]\.includes\(s\.kind\)/.test(src)
      && new RegExp(src.match(/const LIST_TITLE = (\/.*\/i);/)[1].slice(1, -2), 'i').test('Best AI Consultants for Small Businesses in Dubai (2026)'), 'AI_Metrics.js');
    check('RV-1: AI Metrics reads the page inventory and flags a cited page that answers 404 (seo_pages.http_status, written by the Site Tracker)',
      /\$\('Load Pages \(AI\)'\)/.test(src) && /gone: true, http_status/.test(src) && /GONE\.action\(gone_cited\)/.test(src), 'AI_Metrics.js');
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD8 AI Growth: a gone key page is redirected, not scored and not sent to Bing', async () => {
    const SN = 'DEAD8 RV-16 / RV-4: a key page that answers 404 gets "redirect it", never "remove the noindex", and no readiness score (no 0 in the average); Bing is sent only addresses known to answer 200';
    reset(); begin(SN); const check = mkCheck(SN);
    const DEAD = BARE + '/dynamics-365-finance-and-operations-uae', LIVEU = WWW + '/whatwedo/ai-automation', UNREAD = WWW + '/capabilities/data', PUB = WWW + '/ai-consultant';
    mock('Robots Verdicts (Growth)', []); mock('Growth Plan', [{ json: { site_id: SID, domain: DOM, site_host: 'www.techand.ai', stored_pages: [], key_pages: [],
      submit: [{ url: DEAD, why: 'key page, first submission' }, { url: LIVEU, why: 'key page, first submission' }, { url: UNREAD, why: 'key page, first submission' }, { url: PUB, why: 'published this week' }] } }]);
    mock('Page Requests (Growth)', [{ json: { site_id: SID, url: DEAD, kind: 'cited' } }, { json: { site_id: SID, url: LIVEU, kind: 'cited' } }]);
    const liveHtml = '<html><head><title>AI &amp; Automation | What We Do | Tech&amp;</title></head><body><main><h1>AI and automation</h1><p>' + 'We help companies in the UAE put AI to work in finance and operations, step by step. '.repeat(30) + '</p></main></body></html>';
    mock('Fetch Key Pages', [{ json: { statusCode: 404, headers: {}, body: page404 } }, { json: { statusCode: 200, headers: {}, body: liveHtml } }]);
    const AR = (await run('AI Readiness', store['Fetch Key Pages'])).map(i => i.json);
    const d = AR.find(r => r.url === DEAD) || {};
    check('RV-16: the 404 page is told to redirect, never "Remove the noindex" (a 404 page carries one), and gets no score, so it is no 0 in the average (25 with them, 52-70 without)',
      d.gone === true && d.score === null && /no longer answers \(HTTP 404\)/.test(d.score_withheld) && /permanent \(301\) redirect/.test(d.issues[0] || '') && !d.issues.some(x => /noindex/i.test(x)), J({ score: d.score, issues: d.issues, why: d.score_withheld }));
    check('RV-16: a live key page is still scored', typeof (AR.find(r => r.url === LIVEU) || {}).score === 'number', J(AR.map(r => [r.url, r.score])));
    mock('Manual Run', [{ json: {} }]); mock('Bing Growth Requests', [{ json: { site_id: SID, kind: 'quota', site_url: WWW + '/' } }]); mock('Fetch Bing Growth', [{ json: { d: { DailyQuota: 10 } } }]); mock('Load AI Pages', []);
    const BS = (await run('Bing Submit Requests', store['Fetch Bing Growth']))[0].json;
    check('RV-4: Bing gets the page that answered 200 and the page the publish check found live this week, never the 404 (9 of 14 sent in the run were 404) nor an address not read yet',
      J(BS.urls) === J([LIVEU, PUB]) && BS.refused.some(r => r.url === DEAD && /answers HTTP 404/.test(r.reason) && /redirect it instead/.test(r.reason)) && BS.refused.some(r => r.url === UNREAD && /not read yet/.test(r.reason)), J({ urls: BS.urls, refused: BS.refused }));
    reset();
  });

  // =================================================================================================================================
  await guard('DEAD9 the disavow file never holds a public suffix', async () => {
    const SN = 'DEAD9 RV-8: ggmap.us.com is its own site (us.com is sold one level down like a TLD), so the disavow file holds domain:ggmap.us.com, never domain:us.com';
    reset(); begin(SN); const check = mkCheck(SN);
    const { LK } = kits('Analyze_Backlinks.js', ['LK']);
    check('RV-8: the registrable domain of a host under a privately sold suffix keeps its own label', LK.regDomain('ggmap.us.com') === 'ggmap.us.com' && LK.refKey('www.ggmap.us.com') === 'ggmap.us.com' && LK.regDomain('blog.example.co.uk') === 'example.co.uk' && LK.regDomain('a.b.techand.ai') === 'techand.ai' && LK.regDomain('x.example.co.ae') === 'example.co.ae',
      J(['ggmap.us.com', 'blog.example.co.uk', 'x.example.co.ae'].map(LK.regDomain)));
    check('RV-8: a suffix on its own is never a site (the disavow file filters it out)', LK.isSuffix('us.com') && LK.isSuffix('co.uk') && LK.isSuffix('co.ae') && !LK.isSuffix('ggmap.us.com') && !LK.isSuffix('techand.ai') && !LK.isSuffix('peppol.org'),
      J(['us.com', 'co.uk', 'ggmap.us.com', 'techand.ai'].map(LK.isSuffix)));
    const pb = fs.readFileSync(path.join(CD, 'Parse_Backlinks.js'), 'utf8');
    check('RV-8: Parse Backlinks drops any suffix from the disavow list before writing it (a ref_domain stored before this fix included)', /disavow\.filter\(d => d && \/\\\.\/\.test\(d\) && !LK\.isSuffix\(d\)\)/.test(pb), 'Parse_Backlinks.js');
    reset();
  });
};
