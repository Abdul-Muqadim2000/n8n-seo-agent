// IXF1-IXF12 (Index coverage, fix wave 1, 2026-10-29: docs/indexing-2026-10-29/FIX_CONTRACT.md, REVIEW_ENGINE.md E1-E16, REVIEW_CROSS.md X1-X4,
// X7, X8, X13, X16). One check per finding, each written to FAIL on the code the reviews read (every computation is wrapped, so a function the
// old kit lacks is a failed check, not a crash) and pass on the fixed code. Runs the GENERATED code (harness/code_v4) like scenarios_index.js;
// called from scenarios_v5.js right after it.
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => { try { return JSON.stringify(x); } catch (e) { return String(x); } };
  const T = (fn) => { try { return fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };
  const TA = async (fn) => { try { return await fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); return src.slice(a, b + 6); }).join('\n');
    return new Function('URL', 'structuredClone', body + '\nreturn { ' + names.join(', ') + ' };')(undefined, undefined); };
  const { IX } = kits('Index_Diagnose.js', ['PW', 'IX']);
  const DAY = 864e5; const NOW = Date.now(); const iso = (ms) => new Date(ms).toISOString();
  const SITE = { site_id: 'site_example-com', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com' };
  const W = 'https://www.example.com';
  const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: '', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL', ...o } } });
  const R = (o) => IX.readInspection(insp(o));
  const page = (o) => ({ site_id: SITE.site_id, domain: 'example.com', url: W + '/x', lane: 'existing', sources: 'sitemap', in_sitemap: true, state: 'unknown', checks: 0, ...o });
  const dx = (p, r, f, c) => IX.diagnose(p, r, f, { now: NOW, sitemap_complete: true, has_sitemap: true, sitemap_read: true, ...(c || {}) });
  const xmlSet = (locs) => '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locs.map(l => '<url><loc>' + l + '</loc></url>').join('') + '</urlset>';
  const xmlIdx = (locs) => '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locs.map(l => '<sitemap><loc>' + l + '</loc></sitemap>').join('') + '</sitemapindex>';
  const HTML = (body, head) => '<html><head>' + (head || '<title>A page</title>') + '</head><body><main>' + (body || 'words '.repeat(300)) + '</main></body></html>';
  const WF = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Index_Coverage.json'), 'utf8'))[0]; } catch (e) { return { nodes: [], connections: {}, settings: {} }; } })();
  const NODE = (n) => (WF.nodes || []).find(x => x.name === n) || null;

  // ---- a one-site run through the generated nodes (one execution = one website) ----
  const ROW = { site_id: SITE.site_id, domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com', callback_url: 'https://app.example.test/hook', request_id: 'r1', status: 'active' };
  const one = async (o) => {
    const opt = o || {}; reset();
    mock('Manual Run', [{ json: opt.trigger || { trigger: 'ix_chain', site_id: SITE.site_id, parent_run_id: '1', ix_chain: { date: iso(NOW).slice(0, 10), started_at: iso(NOW), rest: opt.rest || [], part: 1, of: 1, attempt: 0, news: {} } } }]);
    mock('Load Sites (Index)', (opt.sites || [{ ...ROW, ...(opt.row || {}) }]).map(json => ({ json })));
    mock('Load Monitors (Index)', [{ json: { site_id: SITE.site_id, index_watch: '', index_daily_cap: opt.cap === undefined ? '' : opt.cap } }]);
    mock('Load Index Runs', (opt.runs || [{}]).map(json => ({ json })));
    const plan = await run('Index Plan', [{ json: {} }]);
    if (plan[0].json.nothing_to_do || plan[0].json.dispatch) return { plan };
    mock('Load Google Events', (opt.storedEvents || [{}]).map(json => ({ json })));
    await run('Google Events', [{ json: {} }]);
    const sites = await run('Index Sites', [{ json: { siteEntry: opt.siteEntry || [{ siteUrl: ROW.gsc_property, permissionLevel: 'siteFullUser' }] } }]);
    if (sites[0].json.skip) return { plan, sites };
    await run('Sitemaps List Requests', [{ json: {} }]); mock('GSC Sitemaps List', [{ json: { sitemap: [{ path: W + '/sitemap.xml', errors: 0 }] } }]);
    const sq = await TA(() => run('Pages Query Requests', [{ json: {} }]));
    if (Array.isArray(sq) && !sq[0].json.skip) mock('GSC Pages Query', sq.map(q => ({ json: opt.sa ? opt.sa(q.json) : { rows: [] } })));
    const sq2 = await TA(() => run('Pages Query More', [{ json: {} }]));
    if (Array.isArray(sq2) && !sq2[0].json.skip) mock('GSC Pages Query 2', sq2.map(q => ({ json: opt.sa2 ? opt.sa2(q.json) : { rows: [] } })));
    const sm = opt.sm || ((q) => q.json.home ? { statusCode: 200, headers: {}, data: '<html><body><a href="/a">A</a></body></html>' } : q.json.robots ? { statusCode: 200, headers: {}, data: 'User-agent: *\nAllow: /\n' } : { statusCode: 200, headers: {}, data: xmlSet(opt.urls || [W + '/a']) });
    const reqs = [];
    for (const r of [1, 2, 3]) {
      const q = await run('Sitemap Requests ' + r, [{ json: {} }]); reqs.push(q);
      if (!q[0].json.skip) mock('Fetch Sitemaps ' + r, q.map(x => ({ json: sm(x, r) })));
      await run('Sitemap Read ' + r, [{ json: {} }]);
    }
    mock('Load Index Pages', (opt.stored || [{}]).map(json => ({ json })));
    mock('Load Pages (Index)', [{ json: {} }]); mock('Load Page Watch (Index)', (opt.watch || [{}]).map(json => ({ json })));
    mock('Load Content Log (Index)', (opt.log || [{}]).map(json => ({ json })));
    const inv = await run('Index Inventory', [{ json: {} }]);
    const res = await TA(() => run('Index Reservation', [{ json: {} }]));
    if (Array.isArray(res)) mock('Save Index Reservation', opt.reserveFail ? [{ json: { error: 'no table' } }] : res.filter(r => !r.json.skip).map((r, i) => ({ json: { id: 1 + i, ...r.json } })));
    const pr = await run('Index Probe Requests', [{ json: {} }]);
    const ans = (q) => (opt.answer ? opt.answer(q.json.inspect_url) : insp({ coverageState: 'Submitted and indexed', verdict: 'PASS' }));
    if (!pr[0].json.skip) mock('Inspect URL (Probe)', pr.map(q => ({ json: opt.probe ? opt.probe(q.json.inspect_url) : ans(q) })));
    const ir = await run('Index Inspect Requests', [{ json: {} }]);
    if (!ir[0].json.skip) mock('Inspect URL (Index)', ir.map(q => ({ json: ans(q) })));
    const rr = await TA(() => run('Inspect Retry Requests', [{ json: {} }]));
    if (Array.isArray(rr) && !rr[0].json.skip) mock('Inspect URL (Retry)', rr.map(q => ({ json: opt.retry ? opt.retry(q.json.inspect_url) : ans(q) })));
    const fr = await run('Page Fetch Requests', [{ json: {} }]);
    if (!fr[0].json.skip) mock('Fetch Page (Index)', fr.map(q => ({ json: opt.fetch ? opt.fetch(q.json.url) : { statusCode: 200, headers: {}, data: HTML() } })));
    if (!fr[0].json.skip) await TA(() => run('Page First Reads', store['Fetch Page (Index)']));   // fix wave 2 (X2): the first answers parsed right after the fetch
    const hr = await run('Fetch Hop Requests', [{ json: {} }]);
    if (!hr[0].json.skip) mock('Fetch Page (Final)', hr.map(q => ({ json: opt.hop ? opt.hop(q.json.url) : { statusCode: 200, headers: {}, data: HTML() } })));
    const sig = await TA(() => run('Page Signals', store['Fetch Page (Final)'] || [{ json: {} }]));
    const dg = await run('Index Diagnose', [{ json: {} }]);
    const rows = await run('Index Page Rows', [{ json: {} }]);
    mock('Save Index Pages', opt.saveFail ? [{ json: { error: 'table not reachable' } }] : rows.filter(r => !r.json.skip).map(r => ({ json: r.json })));   // fix wave 2 (N1): the upsert answers with the rows it saved
    const dels = await TA(() => run('Index Delete Rows', [{ json: {} }]));
    const hist = await run('Index History Rows', [{ json: {} }]);
    mock('Load Update Impact', [{ json: {} }]);
    await run('Update Impact Requests', [{ json: {} }]); await run('Update Impact Rows', [{ json: {} }]);
    const runRows = await run('Index Run Rows', [{ json: {} }]);
    const next = await TA(() => run('Next Index Part', [{ json: {} }]));
    const rep = await run('Index Report', [{ json: {} }]);
    return { plan, sites, sq, sq2, reqs, inv, res, pr, ir, rr, fr, hr, sig, dg, rows, dels, hist, runRows, next, rep };
  };
  const rowOf = (X, re) => ((X.rows || []).map(r => r.json).find(r => re.test(r.url || ''))) || null;
  const allOf = (X, re) => (((X.dg || [])[0] || {}).json || {}).all ? X.dg[0].json.all.find(r => re.test(r.url)) : null;

  // =================================================================================================================================
  await guard('IXF1 E1 partial sitemap tree', async () => {
    const SN = 'IXF1 (E1, FIX_CONTRACT decision 2) a partly read sitemap tree never says "not in the sitemap": a page not found keeps its stored value, no "add it to the sitemap" advice, the run says the tree was partial; the tree stops at the address cap';
    reset(); begin(SN); const check = mkCheck(SN);
    const st = T(() => { let x = IX.sitemapAccept({}, { url: W + '/sitemap.xml', from: 'default' }, { statusCode: 200, data: xmlIdx([W + '/post-sitemap.xml', W + '/page-sitemap.xml']) }, SITE);
      x = IX.sitemapAccept({ ...x, next: [] }, { url: W + '/post-sitemap.xml', from: 'child' }, { statusCode: 200, data: xmlSet([W + '/blog/a']) }, SITE);
      x = IX.sitemapAccept(x, { url: W + '/page-sitemap.xml', from: 'child' }, { statusCode: 503, data: '' }, SITE); x.robots_status = 200; return x; });
    check('one child answered 503: the tree is partial', T(() => IX.sitemapComplete(st)) === false, J(st));
    const prev = [{ site_id: SITE.site_id, url: W + '/services', state: 'indexed', cause: '', in_sitemap: true, sources: 'sitemap', first_seen_at: iso(NOW - 30 * DAY), inspect_at: iso(NOW - 3 * DAY), lane: 'existing' }];
    const m = T(() => IX.merge({ site: SITE, now: NOW, stored: prev, inventory: [], sitemap: { read: true, complete: false, urls: st.urls || [] }, ours: [], search: { read: false, by: new Map() }, watch: [] }));
    const sv = (m.pages || []).find(p => /services/.test(p.url)) || {};
    check('a page the failed child would list keeps in_sitemap = true', sv.in_sitemap === true, J(sv));
    const d = T(() => dx(page({ url: W + '/services', in_sitemap: false }), R({ verdict: 'PASS', coverageState: 'Submitted and indexed' }), null, { sitemap_complete: false, sitemap_read: true }));
    check('an indexed page not found in a PARTIAL read is not "indexed, not in the sitemap"', d && d.cause === '' && d.action === 'none', J(d));
    const u = T(() => dx(page({ url: W + '/x2', in_sitemap: false, sources: 'inventory' }), R({ coverageState: 'URL is unknown to Google', pageFetchState: 'PAGE_FETCH_STATE_UNSPECIFIED' }), null, { sitemap_complete: false, sitemap_read: true }));
    check('an unknown page not found in a PARTIAL read is "unknown to Google" (links), never "not in the sitemap" (site_fix)', u && u.cause === 'unknown_to_google' && u.action === 'links', J(u));
    const big = T(() => { let x = IX.sitemapAccept({}, { url: W + '/s1.xml', from: 'child' }, { statusCode: 200, data: xmlSet(Array.from({ length: 5200 }, (_, i) => W + '/p' + i)) }, SITE);
      return IX.sitemapAccept({ ...x, next: [] }, { url: W + '/idx.xml', from: 'child' }, { statusCode: 200, data: xmlIdx(Array.from({ length: 20 }, (_, i) => W + '/more-' + i + '.xml')) }, SITE); });
    check('E10: once 5,000 addresses are read no further child sitemap is queued (the old tree fetched 49 more)', (big.next || []).length === 0 && big.capped === true, J({ next: (big.next || []).length, capped: big.capped }));
    const X = await one({ stored: prev.concat([{ site_id: SITE.site_id, url: W + '/a', state: 'indexed', in_sitemap: true, sources: 'sitemap', first_seen_at: iso(NOW - 30 * DAY), lane: 'existing', inspect_at: iso(NOW - DAY), next_check_at: iso(NOW + 20 * DAY) }]),
      sm: (q) => q.json.home ? { statusCode: 200, headers: {}, data: '<html></html>' } : q.json.robots ? { statusCode: 200, headers: {}, data: 'User-agent: *\nSitemap: ' + W + '/sitemap.xml\n' }
        : /page-sitemap/.test(q.json.url) ? { statusCode: 503, headers: {}, data: '' } : /post-sitemap/.test(q.json.url) ? { statusCode: 200, headers: {}, data: xmlSet([W + '/a']) }
          : { statusCode: 200, headers: {}, data: xmlIdx([W + '/post-sitemap.xml', W + '/page-sitemap.xml']) } });
    const rr = ((X.runRows || [])[0] || {}).json || {};
    const sj = T(() => JSON.parse(rr.sitemaps_json || '{}'));
    const svc = allOf(X, /services/);
    check('end to end: the run row says the tree was partial (sitemaps_json.complete false, the note says so) and /services keeps its place in the sitemap',
      sj && sj.complete === false && /could not be read completely/.test(rr.note || '') && (!rowOf(X, /services/) || rowOf(X, /services/).in_sitemap === true) && svc && svc.cause !== 'indexed_not_in_sitemap', J({ sj, note: rr.note, svc }));
  });

  // =================================================================================================================================
  await guard('IXF2 E2 our fetch vs Google', async () => {
    const SN = 'IXF2 (E2, decision 3) Google\'s documented reading wins: a bot wall, a challenge, 401 / 403 / 429 / 503 or a language redirect from OUR side is "could not check", never a cause; our read adds a hard fact only over a vague reading Google has not refreshed';
    reset(); begin(SN); const check = mkCheck(SN);
    const g = R({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(NOW - 5 * DAY), pageFetchState: 'SUCCESSFUL' });
    const p = page({ url: W + '/guide' });
    for (const [lbl, first] of [['403 from a Cloudflare challenge', { statusCode: 403, headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' }, data: '<html><title>Just a moment...</title></html>' }],
      ['503 challenge page', { statusCode: 503, headers: {}, data: '<html><title>Attention Required</title></html>' }],
      ['429 to our reader', { statusCode: 429, headers: {}, data: '' }],
      ['a language redirect for our location', { statusCode: 302, headers: { location: W + '/ar/guide' }, data: '' }]]) {
      const f = T(() => IX.readFetch(W + '/guide', first, null));
      const d = T(() => dx(p, g, f));
      check(lbl + ': our read is blocked, Google\'s "crawled, not indexed" stands (quality, not a site fix)', f && f.blocked === true && d && d.cause === 'crawled_not_indexed' && d.action === 'quality', J({ f, d }));
    }
    const f404 = T(() => IX.readFetch(W + '/guide', { statusCode: 404, headers: {}, data: 'nf' }, null));
    check('a fresh successful Google crawl (5 days) is not overruled by our 404', T(() => dx(p, g, f404).cause) === 'crawled_not_indexed', J(T(() => dx(p, g, f404))));
    const old = R({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(NOW - 60 * DAY), pageFetchState: 'SUCCESSFUL' });
    check('an OLD crawl (60 days) of a vague reading: our 404 today is the fact', T(() => dx(p, old, f404).cause) === 'not_found', J(T(() => dx(p, old, f404))));
    const cap = T(() => IX.readFetch(W + '/contact', { statusCode: 200, headers: {}, data: HTML('<form><div class="g-recaptcha"></div></form>' + 'words '.repeat(200)) }, null));
    check('a real page with a captcha on its contact form is not a bot wall', cap && cap.blocked === false && cap.http_status === 200, J(cap));
  });

  // =================================================================================================================================
  await guard('IXF3 E3 lanes', async () => {
    const SN = 'IXF3 (E3, decision 5) a page is "new" only if we wrote it or it first appeared in a sitemap after a run that read the tree completely: the first complete read puts everything in existing; a 2023 article is never "new, wait, that is normal"';
    reset(); begin(SN); const check = mkCheck(SN);
    const urls = Array.from({ length: 5 }, (_, i) => ({ loc: W + '/2023/article-' + i, lastmod: '2023-05-0' + (i + 1) }));
    const m = T(() => IX.merge({ site: SITE, now: NOW, stored: [{ site_id: SITE.site_id, url: W + '/', state: 'indexed', first_seen_at: iso(NOW - DAY), lane: 'existing', sources: 'search' }],
      inventory: [], sitemap: { read: true, complete: true, urls }, ours: [], search: { read: false, by: new Map() }, watch: [], prev_complete: false }));
    const lanes = (m.pages || []).filter(p => /article/.test(p.url)).map(p => p.lane);
    check('day 2, the first complete read after a failed day 1: every old article is existing', lanes.length === 5 && lanes.every(l => l === 'existing'), J(lanes));
    const art = ((m.pages || []).find(p => /article-0/.test(p.url))) || {};
    const d = T(() => dx(art, R({ coverageState: 'Discovered - currently not indexed', pageFetchState: 'PAGE_FETCH_STATE_UNSPECIFIED' }), null));
    check('a 2023 article "discovered, not crawled" is links work, not "new, wait"', d && d.cause === 'discovered_not_crawled' && d.action === 'links', J(d));
    const m2 = T(() => IX.merge({ site: SITE, now: NOW, stored: [{ site_id: SITE.site_id, url: W + '/', state: 'indexed', first_seen_at: iso(NOW - 9 * DAY), lane: 'existing', sources: 'sitemap', in_sitemap: true }],
      inventory: [], sitemap: { read: true, complete: true, urls: [{ loc: W + '/', lastmod: '' }, { loc: W + '/brand-new', lastmod: iso(NOW).slice(0, 10) }, { loc: W + '/old-but-new-to-us', lastmod: '2022-01-01' }] },
      ours: [], search: { read: false, by: new Map() }, watch: [], prev_complete: true, prev_complete_at: iso(NOW - DAY) }));
    const ln = (re) => (((m2.pages || []).find(p => re.test(p.url))) || {}).lane;
    check('after a complete read: a page appearing today is new; one whose lastmod predates that read is existing', ln(/brand-new/) === 'new' && ln(/old-but-new-to-us/) === 'existing', J([ln(/brand-new/), ln(/old-but-new/)]));
  });

  // =================================================================================================================================
  await guard('IXF4 E4 URL identity', async () => {
    const SN = 'IXF4 (E4, decision 4) the inspected URL is the sitemap\'s form on the canonical host; a stored row on another form moves (old row deleted, history moved); a same-site redirect that only changes the slash / case / www moves the row and is never a drop-out or a site step';
    reset(); begin(SN); const check = mkCheck(SN);
    const m = T(() => IX.merge({ site: SITE, now: NOW, stored: [{ site_id: SITE.site_id, url: W + '/blog/peppol', state: 'indexed', sources: 'ours', first_seen_at: iso(NOW - 40 * DAY), lane: 'existing' }],
      inventory: [], sitemap: { read: true, complete: true, urls: [{ loc: W + '/blog/peppol/', lastmod: '' }] }, ours: [{ url: W + '/blog/peppol', published_at: iso(NOW - 40 * DAY) }], search: { read: false, by: new Map() }, watch: [] }));
    const pg = ((m.pages || [])[0]) || {};
    check('merge: the row takes the sitemap\'s form /blog/peppol/ and the move is listed', pg.url === W + '/blog/peppol/' && J(m.moves) === J([{ site_id: SITE.site_id, from: W + '/blog/peppol', to: W + '/blog/peppol/', why: 'the sitemap lists it as ' + W + '/blog/peppol/' }]), J({ url: pg.url, moves: m.moves }));
    const stored = [{ site_id: SITE.site_id, url: W + '/a', state: 'indexed', cause: '', action: 'none', in_sitemap: false, sources: 'inventory', first_seen_at: iso(NOW - 60 * DAY), lane: 'existing', inspect_at: iso(NOW - 30 * DAY), next_check_at: iso(NOW - DAY), checks: 1, evidence: 'inspection' }];
    const X = await one({ stored, urls: [W + '/other'], answer: () => insp({ coverageState: 'Page with redirect', googleCanonical: W + '/a/', pageFetchState: 'SUCCESSFUL' }),
      fetch: () => ({ statusCode: 301, headers: { location: W + '/a/' }, data: '' }) });
    const d = ((X.dg || [])[0] || {}).json || {};
    const moved = ((d.all || []).find(r => /\/a\/$/.test(r.url))) || null;
    check('end to end: the slash redirect moves the row to /a/, keeps it indexed, no drop-out, no site step, and the old /a row is deleted',
      moved && moved.state === 'indexed' && moved.action !== 'site_fix' && !(d.dropped || []).length && Array.isArray(X.dels) && X.dels.some(r => r.json.url === W + '/a'), J({ moved, dropped: d.dropped, dels: X.dels }));
  });

  // =================================================================================================================================
  await guard('IXF5 E5 host and property', async () => {
    const SN = 'IXF5 (E5, decision 4) an empty canonical_host takes the host the home page ends on; a URL-prefix property inspects only addresses under it; "not part of this property" is an access error';
    reset(); begin(SN); const check = mkCheck(SN);
    const X = await one({ row: { canonical_host: '' }, urls: [W + '/services/'],
      sm: (q) => q.json.home ? (/^https:\/\/example\.com\//.test(q.json.url) ? { statusCode: 301, headers: { location: W + '/' }, data: '' } : { statusCode: 200, headers: {}, data: '<html></html>' })
        : q.json.robots ? { statusCode: 200, headers: {}, data: 'User-agent: *\n' } : /^https:\/\/example\.com\//.test(q.json.url) ? { statusCode: 301, headers: { location: W + q.json.url.replace(/^https:\/\/example\.com/, '') }, data: '' } : { statusCode: 200, headers: {}, data: xmlSet([W + '/services/']) } });
    const v = ((X.inv || [])[0] || {}).json || {};
    check('empty canonical_host, home 301 -> www: every page is stored and inspected on www.example.com', (v.pages || []).length > 0 && (v.pages || []).every(p => p.url.startsWith(W + '/')) && (v.sitemap || {}).home_host === 'www.example.com', J({ pages: (v.pages || []).map(p => p.url), sm: v.sitemap }));
    check('a URL-prefix property https://www.example.com/blog/: only addresses under it are asked', T(() => IX.inProperty(W + '/blog/x', 'https://www.example.com/blog/')) === true && T(() => IX.inProperty(W + '/about', 'https://www.example.com/blog/')) === false
      && T(() => IX.inProperty('https://example.com/blog/x', 'https://www.example.com/')) === false && T(() => IX.inProperty(W + '/x', 'sc-domain:example.com')) === true, '');
    const r = IX.readInspection({ error: { code: 403, message: 'You do not own this site, or the inspected URL is not part of this property.' } });
    check('"not part of this property" is an access error (it stops the site; it is never a page fault)', r.ok === false && r.error_kind === 'access', J(r));
  });

  // =================================================================================================================================
  await guard('IXF6 E6 X1 run shape and reservation', async () => {
    const SN = 'IXF6 (E6 / X1 / X2 / E10, decision 1) one execution per website: the dispatch starts a chain, each website saves its rows then starts the next; before inspecting, a reservation row holds the planned inspections so a crash or replay never spends past the cap; no reservation, no inspection';
    reset(); begin(SN); const check = mkCheck(SN);
    reset(); mock('Load Sites (Index)', [{ json: ROW }, { json: { ...ROW, site_id: 'site_two-com', domain: 'two.com', canonical_host: '' } }, { json: { ...ROW, site_id: 'site_three-com', domain: 'three.com' } }]);
    mock('Load Monitors (Index)', [{ json: {} }]); mock('Load Index Runs', [{ json: { site_id: 'site_three-com', run_at: iso(NOW - 3600e3), inspected: 300 } }]);
    const dp = (await run('Index Plan', [{ json: {} }]))[0].json;
    check('the dispatch (no website named): one item, the chain of websites not yet checked today (three.com was), nothing inspected here', dp.dispatch === true && J(dp.chain) === J(['site_example-com', 'site_two-com']), J(dp));
    mock('Google Events', [{ json: { started: [], completed: [], policy_news: null } }]);
    const ds = await TA(() => run('Dispatch Start', [{ json: {} }]));
    check('Dispatch Start: the first website\'s own execution, the rest handed on, parent_run_id set', Array.isArray(ds) && ds[0].json.site_id === 'site_example-com' && J(ds[0].json.ix_chain.rest) === J(['site_two-com']) && !!ds[0].json.parent_run_id, J(ds));
    const X = await one({ rest: ['site_two-com'], cap: 20, urls: Array.from({ length: 30 }, (_, i) => W + '/p' + i) });
    const res = (Array.isArray(X.res) ? X.res[0] : {}).json || {};
    check('the reservation row: written before the first inspection, exact seo_index_runs columns, inspected = the planned count (20), the same run_at as the final row',
      res.inspected === 20 && /had not finished/.test(res.note || '') && res.run_at && res.run_at === ((X.runRows || [])[0] || {}).json.run_at, J(res));
    const nx = Array.isArray(X.next) ? X.next[0].json : {};
    check('after its saves the website starts the next one of the chain', nx.site_id === 'site_two-com' && nx.ix_chain && nx.ix_chain.part === 2, J(nx));
    const RP = await one({ cap: 20, runs: [{ site_id: SITE.site_id, run_at: iso(NOW - 600e3), inspected: 20, note: 'Today\'s check started ... had not finished', sitemaps_json: '{"reservation":true}' }], urls: [W + '/a', W + '/b'] });
    check('a replay after a crash: the crashed run\'s reservation counts, so nothing more is inspected today', RP.plan[0].json.used_today === 20 && RP.pr[0].json.skip === true, J([RP.plan[0].json.used_today, RP.pr[0].json]));
    const RF = await one({ reserveFail: true, urls: [W + '/a', W + '/b'] });
    check('a reservation that could not be saved: no inspection at all', RF.pr[0].json.skip === true && /reservation/.test(RF.pr[0].json.reason || ''), J(RF.pr[0].json));
    const sig = Array.isArray(X.sig) ? X.sig.map(i => i.json) : [];
    check('X2 / E10: what later steps read of our page reads carries no page body', sig.length > 0 && sig.every(x => !/<html/i.test(J(x))), J(sig.slice(0, 1)));
    const inv = ((X.inv || [])[0] || {}).json || {};
    check('E10: a stored row is not carried twice (the slim previous copy has no note / title / link_from)', (inv.pages || []).every(p => !p._prev || (p._prev.note === undefined && p._prev.title === undefined)), J((inv.pages || []).map(p => p._prev).find(Boolean)));
    // the generated workflow: the per-site part saves before it starts the next, nothing follows redirects, the time bound
    const C = WF.connections || {}; const outs = (n) => ((C[n] || {}).main || []).flat().filter(Boolean).map(t => t.node);
    const reach = (a, b) => { const seen = new Set([a]), todo = [a]; while (todo.length) { const n = todo.pop(); if (n === b) return true; for (const t of outs(n)) if (!seen.has(t)) { seen.add(t); todo.push(t); } } return false; };
    check('wiring: Save Index Pages and Save Index Runs come before Start Next Index Part; the reservation before the first inspection', !!NODE('Start Next Index Part') && reach('Save Index Pages', 'Start Next Index Part') && reach('Save Index Runs', 'Start Next Index Part') && reach('Save Index Reservation', 'Inspect URL (Probe)'), J(outs('Save Index Runs')));
    const fetches = (WF.nodes || []).filter(n => /^Fetch (Sitemaps \d|Page \(Index\)|Page \(Final\))$/.test(n.name));
    check('E11: no fetch of a sitemap or a page follows a redirect by itself (every hop is ours, re-checked)', fetches.length === IX.CFG.sitemap_rounds + 2 && fetches.every(n => ((n.parameters.options || {}).redirect || {}).redirect && n.parameters.options.redirect.redirect.followRedirects === false), J(fetches.map(n => [n.name, n.parameters.options.redirect])));
    check('run time bound: one website per execution at the highest cap (1,200 x ~2 s) stays inside the 3,600 s limit', IX.CFG.cap_max * 2 < (WF.settings || {}).executionTimeout && !!NODE('Dispatch Start'), J([IX.CFG.cap_max, (WF.settings || {}).executionTimeout]));
  });

  // =================================================================================================================================
  await guard('IXF7 E7 E9 E15 E16 causes', async () => {
    const SN = 'IXF7 (E7 / E9 / E15 / E16) a reused Site Tracker reading is classified from Google\'s words; a redirect error is a site step; low-value patterns only where they mean a listing; no position for a window with no impressions';
    reset(); begin(SN); const check = mkCheck(SN);
    const reused = (cov, gc) => IX.reuseOf({ url: W + '/p', inspect_at: iso(NOW - DAY), index_state: 'NEUTRAL', indexed: 'no', coverage: cov, google_canonical: gc || '', inspect_error: '' }, NOW);
    const a = T(() => dx(page({ url: W + '/p', in_sitemap: false, sources: 'inventory' }), reused('Alternate page with proper canonical tag', W + '/q'), null));
    check('E7: a reused "Alternate page with proper canonical tag" is alternate (leave out), not "add a canonical tag"', a && a.cause === 'alternate' && a.action === 'leave_out', J(a));
    const g = T(() => dx(page({ url: W + '/p' }), reused('Duplicate, Google chose different canonical than user', W + '/q'), null));
    check('E7: a reused "Google chose different canonical" is google_chose_other, merge into Google\'s choice', g && g.cause === 'google_chose_other' && g.merge_into === W + '/q', J(g));
    const re = T(() => dx(page({ url: W + '/loop', in_sitemap: false, sources: 'inventory' }), R({ coverageState: 'Redirect error' }), null));
    check('E9: "Redirect error" (not in the sitemap) is a site step with its own sentence, never "a redirect is normal"', re && re.cause === 'redirect_error' && re.action === 'site_fix' && !/normal/.test(T(() => IX.noteOf({ ...re, url: W + '/loop' }, {})) || ''), J(re));
    const lv = T(() => dx(page({ url: W + '/products/search/', in_sitemap: false, sources: 'inventory' }), R({ coverageState: 'Crawled - currently not indexed' }), null));
    check('E15: /products/search/ (a product page) is not a low-value search page', lv && lv.cause === 'crawled_not_indexed', J(lv));
    check('E15: a tag page the site lists in its sitemap is not low value; /tag/x nobody lists still is', T(() => IX.isLowValue(W + '/tag/erp', { in_sitemap: true })) === false && IX.isLowValue(W + '/tag/erp') === true, '');
    const cmp = T(() => IX.impactCompare([{ keys: [W + '/a'], clicks: 3, impressions: 200, position: 7 }], [], SITE, []));
    const pj = ((cmp && cmp.pages_json) || [])[0] || {};
    check('E16: a page with no impressions after the update has no position after it (null, "no data"), not 0', pj.after_pos === null && pj.before_pos === 7, J(pj));
  });

  // =================================================================================================================================
  await guard('IXF8 E8 X3 Search Analytics', async () => {
    const SN = 'IXF8 (X3 / E8, decision 7) Search Analytics by page without the date dimension, paged with startRow; a truncated answer keeps the stored impressions of the pages it cut';
    reset(); begin(SN); const check = mkCheck(SN);
    const stored = [{ site_id: SITE.site_id, url: W + '/old-offer', state: 'excluded', cause: 'noindex', action: 'site_fix', in_sitemap: false, sources: 'inventory,search', impressions_28d: 12, last_impression_at: '2026-10-20',
      inspect_at: iso(NOW - 8 * DAY), verdict: 'NEUTRAL', coverage: 'Excluded by noindex tag', indexing_state: 'BLOCKED_BY_META_TAG', first_seen_at: iso(NOW - 60 * DAY), lane: 'existing', checks: 1, next_check_at: iso(NOW + 5 * DAY) }];
    const full = Array.from({ length: 25000 }, (_, i) => ({ keys: [W + '/p' + (i % 40)], clicks: 0, impressions: 5 }));   // a full page (25,000 rows); few distinct pages keep the run small
    const X = await one({ stored, urls: [W + '/a'], sa: () => ({ rows: full }), sa2: () => ({ rows: full }) });
    const qs = Array.isArray(X.sq) ? X.sq.map(q => q.json.body) : [];
    check('the requests: page dimension only, startRow 0, 25,000 rows, one per window (90 / 28 / 14 / 7 days)', qs.length === 4 && qs.every(b => J(b.dimensions) === J(['page']) && b.startRow === 0 && b.rowLimit === 25000), J(qs));
    const q2 = Array.isArray(X.sq2) ? X.sq2.map(q => q.json.body.startRow) : [];
    check('a full first page is followed by startRow 25,000', q2.length === 4 && q2.every(r => r === 25000), J(q2));
    const v = ((X.inv || [])[0] || {}).json || {};
    const off = (v.pages || []).find(p => /old-offer/.test(p.url)) || {};
    check('50,000 rows (the hard stop): the run knows it was truncated and a page it cut keeps its 12 stored impressions', (v.search || {}).truncated === true && off.impressions_28d === 12 && off.last_impression_at === '2026-10-20', J({ search: v.search, off: { i: off.impressions_28d, l: off.last_impression_at } }));
    const rr = ((X.runRows || [])[0] || {}).json || {};
    check('the run note says the answer was cut', /more pages than we read/.test(rr.note || ''), rr.note);
  });

  // =================================================================================================================================
  await guard('IXF9 E11 SSRF', async () => {
    const SN = 'IXF9 (E11) addresses are parsed strictly: a backslash, userinfo, an IP literal, another port or another domain is never fetched; a redirect is followed only to the site\'s own domain';
    reset(); begin(SN); const check = mkCheck(SN);
    const bad = ['http://169.254.169.254\\@www.example.com/computeMetadata/v1/', 'http://127.0.0.1:5678\\@example.com/rest/settings', 'http://user:pw@www.example.com:6379/x.xml', 'http://10.0.0.5/x', 'http://[::1]/x', 'https://www.example.com:8080/x', 'https://evil.com/x'];
    check('IX.own / IX.safe refuse every one of them', bad.every(u => !IX.own(u, SITE) && !T(() => IX.safe(u, SITE))), J(bad.filter(u => IX.own(u, SITE))));
    const st = T(() => IX.sitemapAccept({}, { url: W + '/sitemap.xml', from: 'default' }, { statusCode: 200, data: xmlIdx(bad.concat([W + '/ok.xml'])) }, SITE));
    check('a sitemap index naming them queues only the site\'s own child, rebuilt', J((st.next || []).map(n => n.url)) === J([W + '/ok.xml']), J(st.next));
    check('a page redirect to an internal or foreign address is not followed', T(() => IX.hopOf(W + '/a', { statusCode: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }, SITE)) === '' && T(() => IX.hopOf(W + '/a', { statusCode: 302, headers: { location: '/b' } }, SITE)) === W + '/b', '');
  });

  // =================================================================================================================================
  await guard('IXF10 E12 E13 E14 cap, rate, no access', async () => {
    const SN = 'IXF10 (E12 / E13 / E14) at the 6,000 cap our own pages win and the run says so; a per-minute limit is retried, never "daily quota used"; a site without access keeps its figures and says it was not checked (no "0 of 0")';
    reset(); begin(SN); const check = mkCheck(SN);
    const stored = Array.from({ length: 6000 }, (_, i) => ({ site_id: SITE.site_id, url: W + '/old/' + i, state: 'excluded', cause: 'not_found', http_status: 404, in_sitemap: false, sources: 'inventory', first_seen_at: iso(NOW - 30 * DAY) }));
    const m = T(() => IX.merge({ site: SITE, now: NOW, stored, inventory: [], sitemap: { read: true, complete: true, urls: [] }, ours: [{ url: W + '/just-published', published_at: iso(NOW - DAY) }], search: { read: true, by: new Map() }, watch: [] }));
    check('E12: 6,000 stored rows and a page we just published: ours is kept, the run knows it is capped', (m.pages || []).some(p => /just-published/.test(p.url)) && m.capped === true, J({ n: (m.pages || []).length, capped: m.capped }));
    const rate = { error: { code: 429, message: 'Quota exceeded for quota metric \'Default\' and limit \'Default per minute per property\'', status: 'RESOURCE_EXHAUSTED' } };
    const rk = IX.readInspection(rate);
    check('E13: a per-minute 429 is a rate limit, not the daily quota', rk.error_kind === 'rate', J(rk));
    const X = await one({ urls: Array.from({ length: 6 }, (_, i) => W + '/r' + i), probe: () => rate, answer: () => insp({ verdict: 'PASS', coverageState: 'Submitted and indexed' }) });
    const rr = ((X.runRows || [])[0] || {}).json || {};
    check('E13: the probe\'s per-minute limit does not stop the site; those pages are asked again after a minute; the note never says the daily quota was used up',
      Array.isArray(X.ir) && !X.ir[0].json.skip && Array.isArray(X.rr) && X.rr.length === 2 && !X.rr[0].json.skip && !/daily URL Inspection quota/.test(rr.note || '') && !((X.dg[0] || {}).json || {}).quota_stop, J({ ir: X.ir && X.ir.length, rr: X.rr, note: rr.note }));
    const X2 = await one({ urls: [W + '/r0', W + '/r1', W + '/r2'], probe: () => rate, retry: () => rate });
    check('E13: a second per-minute answer in the same run is taken as the day\'s quota', ((X2.dg[0] || {}).json || {}).quota_stop === true, J((X2.dg[0] || {}).json));
    const NA = await one({ trigger: { domain: 'example.com', callback_url: 'https://app.example.test/hook' }, siteEntry: [{ siteUrl: 'sc-domain:someone-else.com', permissionLevel: 'siteOwner' }], stored: [{ site_id: SITE.site_id, url: W + '/a', state: 'indexed', cause: '', action: 'none', lane: 'existing' }, { site_id: SITE.site_id, url: W + '/b', state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', lane: 'existing' }] });
    const nr = (((NA.runRows || [])[0] || {}).json) || {};
    const md = ((((NA.rep || [])[0] || {}).json) || {}).report_markdown || '';
    check('E14: no access - the run row keeps the stored figures (2 known, 1 indexed), inspected 0, and says it could not check', nr.known === 2 && nr.indexed === 1 && nr.inspected === 0 && /could not check/i.test(nr.note || ''), J(nr));
    check('E14: the report says the website could not be checked and never "0 of 0"', /could not check this website/.test(md) && !/\*\*0 of 0\*\*/.test(md), md.slice(0, 300));
  });

  // =================================================================================================================================
  await guard('IXF11 X4 X7 X8 drop-outs, fixes, ask Google', async () => {
    const SN = 'IXF11 (X4 / X7 / X8) a drop-out is only an indexed page now left out with something to do; a fix our read sees today waits for Google (fix_seen_at, action wait, re-checked within a day) and clears when the problem is back; "ask Google to read it" on at most 5 pages';
    reset(); begin(SN); const check = mkCheck(SN);
    const was = (u, o) => ({ site_id: SITE.site_id, url: u, state: 'indexed', cause: '', action: 'none', in_sitemap: false, sources: 'inventory', first_seen_at: iso(NOW - 90 * DAY), lane: 'existing', inspect_at: iso(NOW - 30 * DAY), next_check_at: iso(NOW - DAY), checks: 1, evidence: 'inspection', ...(o || {}) });
    const X = await one({ stored: [was(W + '/moved-on-purpose'), was(W + '/private-page'), was(W + '/real-drop', { in_sitemap: true, sources: 'sitemap' })], urls: [W + '/real-drop'],
      answer: (u) => /moved-on-purpose/.test(u) ? insp({ coverageState: 'Page with redirect', googleCanonical: W + '/elsewhere' }) : /private-page/.test(u) ? insp({ indexingState: 'BLOCKED_BY_META_TAG', coverageState: 'Excluded by noindex tag' })
        : insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(NOW - 2 * DAY) }), fetch: () => ({ statusCode: 200, headers: {}, data: HTML() }) });
    const dd = (((X.dg || [])[0] || {}).json || {}).dropped || [];
    check('X4: a redirect the client made and an intended noindex are not drop-outs; the sitemap page Google left out is', J(dd.map(x => x.url)) === J([W + '/real-drop']), J(dd));
    const nx = { site_id: SITE.site_id, url: W + '/svc', state: 'excluded', cause: 'noindex', action: 'site_fix', in_sitemap: true, sources: 'sitemap', first_seen_at: iso(NOW - 90 * DAY), lane: 'existing', inspect_at: iso(NOW - 3 * DAY),
      next_check_at: iso(NOW + 10 * DAY), checks: 1, evidence: 'inspection', verdict: 'NEUTRAL', coverage: 'Excluded by noindex tag', indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(NOW - 2 * DAY), noindex: 'meta' };
    const F = await one({ stored: [nx], urls: [W + '/svc'], fetch: () => ({ statusCode: 200, headers: {}, data: HTML() }) });
    const r = rowOf(F, /\/svc$/) || {};
    check('X7: the noindex is gone on the site but Google still shows it: fix_seen_at set, action wait, "Fixed on your site", re-checked within 2 days',
      !!r.fix_seen_at && r.action === 'wait' && /Fixed on your site/.test(r.note || '') && Date.parse(r.next_check_at) - NOW <= 2 * DAY, J({ f: r.fix_seen_at, a: r.action, n: r.note, nc: r.next_check_at }));
    const B = await one({ stored: [{ ...nx, ...r, next_check_at: iso(NOW + 10 * DAY), fetch_at: iso(NOW - 2 * DAY) }], urls: [W + '/svc'], fetch: () => ({ statusCode: 200, headers: {}, data: HTML('', '<title>x</title><meta name="robots" content="noindex">') }) });
    const rb = rowOf(B, /\/svc$/) || {};
    check('X7: the noindex is back the next day: fix_seen_at cleared, the site step returns', rb.fix_seen_at === '' && rb.action === 'site_fix', J({ f: rb.fix_seen_at, a: rb.action }));
    const rows = Array.from({ length: 8 }, (_, i) => ({ url: W + '/ours-' + i, state: 'not_indexed', cause: 'wait_new', action: 'wait', sources: 'sitemap,ours', in_sitemap: true, published_at: iso(NOW - 10 * DAY), impressions_28d: i }))
      .concat([{ url: W + '/alt', state: 'excluded', cause: 'alternate', action: 'leave_out', sources: 'ours', published_at: iso(NOW - 20 * DAY) }]);
    const n = T(() => IX.askGoogle(rows, { now: NOW, reselect: true }));
    check('X8: at most 5 pages are marked "ask Google to read it", never one left out on purpose', n === 5 && rows.filter(x => x.ask_google).length === 5 && !rows.find(x => /alt$/.test(x.url)).ask_google, J(rows.map(x => [x.url, x.ask_google])));
    const fo = (F.rows || []).map(x => x.json)[0] || {};
    check('X7 / X8: the two new seo_index_pages columns are written', Object.prototype.hasOwnProperty.call(fo, 'fix_seen_at') && Object.prototype.hasOwnProperty.call(fo, 'ask_google'), J(Object.keys(fo).slice(-4)));
  });

  // =================================================================================================================================
  await guard('IXF12 X13 X16 news baseline and retention', async () => {
    const SN = 'IXF12 (X13 / X16) the first reading of Google\'s feed and a site\'s first run send no same-day news callback; history older than 400 days is pruned by the dispatch; a long-gone row nobody lists is pruned';
    reset(); begin(SN); const check = mkCheck(SN);
    const ev = [{ event_id: 'gssd:x', source: 'status_dashboard', kind: 'core', title: 'X core update', started_at: iso(NOW - 2 * DAY), ended_at: '', status: 'rolling_out', url: 'u' }];
    const first = IX.eventRows(ev, [], NOW);
    check('X13: the feed\'s first reading stores the rollout but is not news', first.rows.length === 1 && first.started.length === 0, J(first));
    const X = await one({ urls: [W + '/a'] });
    mock('Google Events', [{ json: { ...(store['Google Events'] || [{ json: {} }])[0].json, started: ev } }]);
    const dg = await run('Index Diagnose', [{ json: {} }]);
    check('X13: on a site\'s first run, an update in today\'s news sends no same-day callback', dg[0].json.news_today === 0, J({ news: dg[0].json.news_today, first: dg[0].json.first_run }));
    const pr = NODE('Prune Index History');
    check('X16: the dispatch deletes history older than 400 days', !!pr && pr.parameters.operation === 'deleteRows' && /400/.test(J(pr.parameters.filters)), J(pr && pr.parameters));
    const m = T(() => IX.merge({ site: SITE, now: NOW, stored: [{ site_id: SITE.site_id, url: W + '/gone', state: 'excluded', cause: 'not_found', http_status: 404, in_sitemap: false, sources: 'inventory', first_seen_at: iso(NOW - 300 * DAY), updated_at: iso(NOW - 200 * DAY), inspect_at: iso(NOW - 200 * DAY) }],
      inventory: [], sitemap: { read: true, complete: true, urls: [{ loc: W + '/a', lastmod: '' }] }, ours: [], search: { read: true, by: new Map() }, watch: [] }));
    check('X16: a 404 row in no source, untouched for 200 days, is pruned', J((m.prune || []).map(x => [x.site_id, x.url])) === J([[SITE.site_id, W + '/gone']]) && !(m.pages || []).some(p => /gone/.test(p.url)), J(m.prune));
  });
};
