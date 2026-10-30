// IXV1-IXV7 (Index coverage wave 2, 2026-10-30: docs/indexing-2026-10-29/DESIGN_WAVE2.md §2 and §4, ENGINE_BUILD.md "Wave 2"). The
// devaicon.com advice check of 2026-10-30 (RESUME.md) replayed through the GENERATED Code nodes (harness/code_v4) with a pinned clock:
// the real public pages read once on 2026-10-30 (fixtures_index/devaicon_2026-10-30: home, /industries, /industries/bfsi, /careers, /privacy,
// /capabilities/open-edx-services, sitemap.xml, robots.txt; scripts, styles and inline SVG removed). The other six /industries/* pages are
// bfsi's page with their own titles and the same canonical (-> /industries), as the live pages carry them; job pages are /careers with their
// own title and a self canonical; every other page is the privacy page's template with its own title and a self canonical. Google's answers
// are devaicon-shaped (9 indexed, 2 crawled-not-indexed, 6 discovered, the rest unknown, /industries/bfsi "Alternate page with proper
// canonical tag" -> /industries). Each check is written to FAIL on ix/engine 35c24b03 (the code before wave 2) and pass on wave 2; every
// computation is wrapped, so a node or a function the old code lacks is a failed check, not a crash. Called from scenarios_v5.js after
// scenarios_index_fix3.js; also runs on its own:
//   CODE_DIR=<code_v4> WF_DIR=<workflows> node scenarios_index_wave2.js   (prints the counts)
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const WFD = process.env.WF_DIR || path.join(__dirname, '..', 'workflows');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => { try { return JSON.stringify(x); } catch (e) { return String(x); } };
  const T = (fn) => { try { return fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };
  const TA = async (fn) => { try { return await fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };
  const DAY = 864e5; const iso = (ms) => new Date(ms).toISOString(); const S0 = (v) => String(v == null ? '' : v).trim();
  const fileOf = (name) => path.join(CD, name.replace(/[^A-Za-z0-9_.-]+/g, '_') + '.js');
  const has = (name) => fs.existsSync(fileOf(name));
  const src = (name) => { try { return fs.readFileSync(fileOf(name), 'utf8'); } catch (e) { return ''; } };
  const kits = (file, names) => { const s = src(file);
    const body = names.map(n => { const a = s.indexOf('const ' + n + ' = (() => {'); const b = s.indexOf('\n})();', a); return s.slice(a, b + 6); }).join('\n');
    return new Function('URL', 'structuredClone', body + '\nreturn { ' + names.join(', ') + ' };')(undefined, undefined); };
  const { IX } = kits('Index Diagnose', ['PW', 'IX']);
  const AsyncF = Object.getPrototypeOf(async function () {}).constructor;
  // a generated Code node, run with mocked upstream nodes, its own input items and the clock pinned at `now`
  const node = async (name, mocks, input, now) => {
    const code = src(name); if (!code) throw new Error('node "' + name + '" does not exist in this build');
    const $ = (n) => { if (!(n in mocks)) throw new Error('Referenced node "' + n + '" has no data in this run');
      const a = mocks[n].map(j => (j && j.json !== undefined && Object.keys(j).every(k => k === 'json' || k === 'binary')) ? j : { json: j });
      return { all: () => a, first: () => a[0], last: () => a[a.length - 1], get item() { return a[0]; } }; };
    const items = (input || [{ json: {} }]).map(j => (j && j.json !== undefined) ? j : { json: j });
    const $input = { all: () => items, first: () => items[0], last: () => items[items.length - 1], get item() { return items[0]; } };
    const RealDate = Date;
    const D = class extends RealDate { constructor(...a) { if (!a.length) super(now); else super(...a); } static now() { return now; } };
    const thisArg = { helpers: { getBinaryDataBuffer: async (i, prop) => { const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b.data) throw new Error('no binary ' + prop); return Buffer.from(b.data, 'base64'); } } };
    const f = new AsyncF('$', '$input', '$execution', 'URL', 'structuredClone', 'Date', code);
    const out = await f.call(thisArg, $, $input, { id: '4242' }, undefined, undefined, now ? D : Date);
    return (out || []).map(o => o.json);
  };

  // ---- devaicon.com, as read on 2026-10-30 ----
  const DEV = 'https://devaicon.com';
  const SITE = { site_id: 'site_devaicon-com', domain: 'devaicon.com', canonical_host: 'devaicon.com', gsc_property: 'sc-domain:devaicon.com' };
  const FX = path.join(__dirname, 'fixtures_index', 'devaicon_2026-10-30');
  const gz = (f) => zlib.gunzipSync(fs.readFileSync(path.join(FX, f))).toString('utf8');
  const HOME = gz('home.html.gz'), IND = gz('industries.html.gz'), BFSI = gz('industries_bfsi.html.gz'), CAREERS = gz('careers.html.gz'), PRIV = gz('privacy.html.gz'),
    OEDX = gz('open_edx_services.html.gz'), SITEMAP = gz('sitemap.xml.gz'), ROBOTS = fs.readFileSync(path.join(FX, 'robots.txt'), 'utf8');
  const INDUSTRIES = { bfsi: '', hospitality: 'Hospitality Technology Solutions', manufacturing: 'Manufacturing Technology and Automation', retail: 'Retail Technology Solutions',
    'public-sector': 'Public Sector Digital Services', nonprofit: 'Nonprofit Technology Solutions', 'professional-services': 'Professional Services Technology' };
  const withPage = (html, title, canonical) => html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>').replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, '<link rel="canonical" href="' + canonical + '"/>');
  const pathOf = (u) => (S0(u).match(/^https?:\/\/[^\/?#]*([^?#]*)/i) || [])[1] || '/';
  const P = (u) => pathOf(u).replace(/\/+$/, '') || '/';
  const fixes = new Set();   // pages whose canonical the client fixed (IXV1 day 3)
  const pageHtml = (u) => { const p = P(u);
    if (p === '/') return HOME; if (p === '/industries') return IND; if (p === '/careers') return CAREERS; if (p === '/privacy') return PRIV; if (p === '/capabilities/open-edx-services') return OEDX;
    const ind = p.match(/^\/industries\/([^\/]+)$/);
    if (ind) { const html = ind[1] === 'bfsi' ? BFSI : withPage(BFSI, INDUSTRIES[ind[1]] + ' | Devaicon', DEV + '/industries'); return fixes.has(p) ? withPage(html, (ind[1] === 'bfsi' ? 'Banking &amp; Financial Services Technology' : INDUSTRIES[ind[1]]) + ' | Devaicon', DEV + p) : html; }
    const job = p.match(/^\/careers\/([^\/]+)$/); if (job) return withPage(CAREERS, job[1].replace(/-/g, ' ') + ' | Careers at Devaicon', DEV + p);
    return withPage(PRIV, p.split('/').pop().replace(/-/g, ' ') + ' | Devaicon', DEV + p); };
  const OK = (u) => ({ statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, data: pageHtml(u) });
  const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: '', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL', ...o } } });
  const G = { indexed: ['/', '/whatwedo', '/ai-automation-services-pakistan', '/capabilities/intelligent-systems-data', '/capabilities/application-software-development',
      '/capabilities/consulting-transformation', '/contact-us', '/insights/ai-in-industrial-automation', '/careers'],
    crawled: ['/engagement-models', '/privacy'],
    discovered: ['/capabilities/infrastructure-enterprise-systems', '/capabilities/open-edx-services', '/industries', '/insights', '/about-devaicon', '/cookies'] };
  const T0 = Date.parse('2026-11-03T10:15:00Z');   // a Tuesday (the engine's callback day is Monday; nothing here depends on it)
  const answerG = (u, now, o) => { const p = P(u); const over = o && o.answer ? o.answer(p, now) : null; if (over) return over;
    if (G.indexed.includes(p)) return insp({ verdict: 'PASS', coverageState: 'Submitted and indexed', googleCanonical: u, lastCrawlTime: iso(T0 - 9 * DAY) });
    if (G.crawled.includes(p)) return insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(T0 - 20 * DAY) });
    if (G.discovered.includes(p)) return insp({ coverageState: 'Discovered - currently not indexed', pageFetchState: '', indexingState: '', robotsTxtState: '' });
    if (p === '/industries/bfsi') return insp({ coverageState: 'Alternate page with proper canonical tag', userCanonical: DEV + '/industries', googleCanonical: DEV + '/industries', lastCrawlTime: iso(T0 - 12 * DAY) });
    return insp({ coverageState: 'URL is unknown to Google', pageFetchState: '', indexingState: '', robotsTxtState: '' }); };
  const sitemapAnswer = (u) => /\/robots\.txt$/.test(u) ? { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS }
    : /\/sitemap\.xml$/.test(u) ? { statusCode: 200, headers: { 'content-type': 'application/xml' }, data: SITEMAP } : null;
  const GSC_LISTED = (o) => ({ sitemap: [{ path: DEV + '/sitemap.xml', lastSubmitted: '2026-10-01T08:00:00.000Z', lastDownloaded: '2026-10-28T03:00:00.000Z', isPending: false, isSitemapsIndex: false, warnings: '0', errors: '0', ...(o || {}) }] });

  // ---- one day of devaicon.com through the generated nodes; st = { stored: [rows], history: [], runs: [run rows] } is updated as n8n's tables would be ----
  const devDay = async (st, now, o) => {
    const opt = o || {}; const M = {}; const lastRun = st.runs.length ? st.runs[st.runs.length - 1] : null;
    const pj = lastRun ? (() => { try { return JSON.parse(lastRun.sitemaps_json || '{}'); } catch (e) { return {}; } })() : {};
    M['Index Sites'] = [{ ...SITE, gsc_connected: true, gsc_permission: opt.permission || 'siteFullUser', cap: 300, used_today: 0, run_at: iso(now), quota_hit: false,
      prev_complete: !!lastRun, prev_complete_at: lastRun ? S0(lastRun.run_at) : '', home_host_prev: 'devaicon.com', on_demand: false, chain_id: '', sitemap_submit: !!opt.submit,
      prev_submissions: Array.isArray(pj.submissions) ? pj.submissions : [], prev_tree_fp: pj.tree_fp || null, prev_submit_denied: pj.submit_denied || null }];
    M['Index Plan'] = [{ ...M['Index Sites'][0] }];
    M['Load Index Pages'] = st.stored.length ? st.stored.map(r => ({ ...r })) : [{}];
    M['Load Pages (Index)'] = [{}]; M['Load Page Watch (Index)'] = [{}]; M['Load Content Log (Index)'] = [{}];
    M['Sitemaps List Requests'] = [{ site_id: SITE.site_id, url: 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Adevaicon.com/sitemaps' }];
    M['GSC Sitemaps List'] = [opt.gscList !== undefined ? opt.gscList : GSC_LISTED()];
    M['Pages Query Requests'] = [{ skip: true }]; M['Pages Query More'] = [{ skip: true }];
    M['Google Events'] = [{ freeze: { freeze: false }, started: [], completed: [], events: [] }];
    // round 1 of the sitemap tree: the home page, robots.txt, /sitemap.xml (complete in one round, as on the live site)
    const sq = await node('Sitemap Requests 1', M, null, now); M['Sitemap Requests 1'] = sq;
    M['Fetch Sitemaps 1'] = sq.filter(q => !q.skip).map(q => sitemapAnswer(q.url) || (opt.homeDown && P(q.url) === '/' ? { statusCode: 503, headers: {}, data: 'unavailable' } : OK(q.url)));
    M['Sitemap Read 1'] = await node('Sitemap Read 1', M, M['Fetch Sitemaps 1'], now);
    // wave 2: the parents' links (nodes the old build does not have are skipped: the run is then what the old build did)
    let parents = [];
    if (has('Link Read Requests')) {
      const lr = await node('Link Read Requests', M, null, now); M['Link Read Requests'] = lr; parents = lr.filter(q => !q.skip).map(q => P(q.url));
      if (lr.some(q => !q.skip)) M['Fetch Link Pages'] = lr.filter(q => !q.skip).map(q => OK(q.url));
      M['Site Links'] = await node('Site Links', M, M['Fetch Link Pages'] || null, now);
    }
    const inv = await node('Index Inventory', M, null, now); M['Index Inventory'] = inv;
    const res = await node('Index Reservation', M, null, now); M['Save Index Reservation'] = res.filter(r => !r.skip).map((r, i) => ({ id: 1 + i, ...r }));
    let submits = [];
    if (has('Sitemap Submit Requests')) {
      const sr = await node('Sitemap Submit Requests', M, null, now); M['Sitemap Submit Requests'] = sr; submits = sr.filter(q => !q.skip);
      if (submits.length) M['Submit Sitemap (Index)'] = submits.map(q => opt.submitAnswer ? opt.submitAnswer(q, now) : { statusCode: 204, headers: {}, body: '' });
    }
    const pr = await node('Index Probe Requests', M, null, now); M['Index Probe Requests'] = pr;
    const asked = [];
    const answer = (u) => { asked.push(P(u)); return answerG(u, now, opt); };
    M['Inspect URL (Probe)'] = pr.filter(q => !q.skip).map(q => answer(q.inspect_url));
    const ir = await node('Index Inspect Requests', M, null, now); M['Index Inspect Requests'] = ir;
    M['Inspect URL (Index)'] = ir.filter(q => !q.skip).map(q => answer(q.inspect_url));
    M['Inspect Retry Requests'] = [{ skip: true }]; M['Inspect URL (Retry)'] = [];
    const fr = await node('Page Fetch Requests', M, null, now); M['Page Fetch Requests'] = fr;
    const fetched = fr.filter(q => !q.skip).map(q => P(q.url));
    if (fetched.length) { M['Fetch Page (Index)'] = fr.filter(q => !q.skip).map(q => OK(q.url)); M['Page First Reads'] = await node('Page First Reads', M, M['Fetch Page (Index)'], now); }
    const hr = await node('Fetch Hop Requests', M, null, now); M['Fetch Hop Requests'] = hr;
    if (!hr[0].skip) M['Fetch Page (Final)'] = hr.map(q => OK(q.url));
    M['Page Signals'] = await node('Page Signals', M, M['Fetch Page (Final)'] || null, now);
    const dg = await node('Index Diagnose', M, null, now); M['Index Diagnose'] = dg;
    const rows = (await node('Index Page Rows', M, null, now)).filter(r => !r.skip);
    M['Save Index Pages'] = rows.map(r => ({ id: 1, ...r }));
    const hist = (await node('Index History Rows', M, null, now)).filter(r => !r.skip);
    const run = (await node('Index Run Rows', M, null, now)).filter(r => !r.skip)[0] || null;
    for (const r of rows) { const m = st.stored.filter(x => x.site_id === r.site_id && x.url === r.url); if (m.length) m.forEach(x => Object.assign(x, r)); else st.stored.push({ ...r }); }
    st.history.push(...hist); if (run) st.runs.push(run);
    return { inv: inv[0], dg: dg[0], rows, asked, fetched, parents, submits, run, sitemapRead: M['Sitemap Read 1'][0] };
  };
  const row = (st, p) => st.stored.find(r => P(r.url) === p) || {};
  const linkedOf = (r) => { try { const a = JSON.parse(S0(r.linked_by) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const OTHER_IND = Object.keys(INDUSTRIES).filter(k => k !== 'bfsi').map(k => '/industries/' + k);
  const ALL_IND = Object.keys(INDUSTRIES).map(k => '/industries/' + k);
  const JOBS = ['/careers/senior-full-stack-developer', '/careers/ai-ml-engineer', '/careers/cloud-solutions-architect', '/careers/data-engineer', '/careers/product-manager', '/careers/frontend-developer'];

  // =================================================================================================================================
  const D = { stored: [], history: [], runs: [] }; let d1 = {}, d2 = {}, d3 = {};
  await guard('IXV1 devaicon.com advice', async () => {
    const SN = 'IXV1 (DESIGN_WAVE2 §2.1-§2.3) devaicon.com end to end: the site\'s own links (home page + parents) find the 6 industry pages missing from the sitemap and give every page its linked_by; pages Google has not visited that the site already links to WAIT with the plain note and no link suggestions; the 7 industry pages that name /industries as their canonical with titles of their own are a site step (in the sitemap or not); policy pages are left out; "ask Google" goes to the capability pages first, never /cookies / /security / /about; a day the home page cannot be read changes nothing; a fixed canonical is seen';
    begin(SN); const check = mkCheck(SN);
    d1 = await TA(() => devDay(D, T0));
    check('control: day 1 ran through every generated node', !d1.__error && D.stored.length > 0, J(d1.__error));
    // §2.1 the links read
    check('the parent pages read: /industries, /careers, /insights and /capabilities/open-edx-services (at most 10, never the home page)', ['/industries', '/careers', '/insights', '/capabilities/open-edx-services'].every(p => (d1.parents || []).includes(p)) && !(d1.parents || []).includes('/') && (d1.parents || []).length <= 10, J(d1.parents));
    check('the 6 industry pages missing from the sitemap are found through the site\'s links (source home) and checked like any page', OTHER_IND.every(p => { const r = row(D, p); return r.url && /(^|,)home(,|$)/.test(S0(r.sources)) && r.in_sitemap !== true && !!S0(r.inspect_at); }), J(OTHER_IND.map(p => [p, row(D, p).sources, !!row(D, p).inspect_at])));
    check('linked_by: capability pages are linked from the home page, job pages from /careers, the Open edX pages from their parent', (() => {
      const a = linkedOf(row(D, '/capabilities/infrastructure-enterprise-systems')), b = linkedOf(row(D, '/careers/data-engineer')), c = linkedOf(row(D, '/capabilities/open-edx-services/open-edx-hosting'));
      return a.includes(DEV + '/') && b.includes(DEV + '/careers') && c.includes(DEV + '/capabilities/open-edx-services') && a.length <= 3; })(),
      J(['/capabilities/infrastructure-enterprise-systems', '/careers/data-engineer', '/capabilities/open-edx-services/open-edx-hosting'].map(p => [p, row(D, p).linked_by])));
    // §2.2 already linked -> wait, never "add internal links"
    const waits = ['/capabilities/infrastructure-enterprise-systems', '/capabilities/open-edx-services', '/insights/agentic-ai', '/insights/data-sovereign-asset', '/capabilities/open-edx-services/open-edx-hosting'].concat(JOBS);
    check('every page Google has not visited that the site already links to: action wait, cause kept, no link suggestions', waits.every(p => { const r = row(D, p); return r.action === 'wait' && /^(unknown_to_google|discovered_not_crawled)$/.test(S0(r.cause)) && S0(r.link_from) === ''; }),
      J(waits.map(p => [p, row(D, p).cause, row(D, p).action, S0(row(D, p).link_from).slice(0, 60)])));
    check('the note says where it is linked from and what helps (sitemap pages: "and listed in your sitemap")', /^Already linked from your website \(\/\) and listed in your sitemap\. Google has not visited it yet, which is common for a young website\. What helps: links from other websites to your site, and asking Google to read your most important pages\.$/.test(S0(row(D, '/capabilities/infrastructure-enterprise-systems').note))
      && /^Already linked from your website \(\/careers\) and listed in your sitemap\./.test(S0(row(D, '/careers/data-engineer').note)), J([row(D, '/capabilities/infrastructure-enterprise-systems').note, row(D, '/careers/data-engineer').note]));
    check('no page is told "add internal links" (every not-indexed page here is linked from the site)', !D.stored.some(r => r.action === 'links'), J(D.stored.filter(r => r.action === 'links').map(r => [P(r.url), r.cause])));
    // §2.2 the canonical to /industries with titles of their own
    check('all 7 industry pages: canonical_elsewhere, a site step (site_fix), excluded - also the 6 not in the sitemap (Google said "unknown" or "alternate")', ALL_IND.every(p => { const r = row(D, p); return r.cause === 'canonical_elsewhere' && r.action === 'site_fix' && r.state === 'excluded'; }),
      J(ALL_IND.map(p => [p, row(D, p).cause, row(D, p).action, row(D, p).page_canonical])));
    check('their note: "This page tells Google it is a copy of /industries ... point its canonical tag to itself and add it to your sitemap."', ALL_IND.every(p => S0(row(D, p).note) === 'This page tells Google it is a copy of /industries, so Google shows that page instead. If this page should be found on its own, point its canonical tag to itself and add it to your sitemap.'),
      J(row(D, '/industries/bfsi').note));
    check('the fetch reached the alternate and never-seen linked pages within the 60 cap (every industry page read)', ALL_IND.every(p => (d1.fetched || []).includes(p)) && (d1.fetched || []).length <= 60, J(d1.fetched));
    // §2.2 / §2.4 utility pages
    check('/privacy (crawled, not indexed): "Policy and utility pages do not need to be in Google." - low_value, leave_out, never "improve this page"', (() => { const r = row(D, '/privacy'); return r.cause === 'low_value' && r.action === 'leave_out' && r.note === 'Policy and utility pages do not need to be in Google.'; })(), J(row(D, '/privacy')));
    check('/cookies and /security: low_value, leave_out', ['/cookies', '/security'].every(p => row(D, p).cause === 'low_value' && row(D, p).action === 'leave_out'), J(['/cookies', '/security'].map(p => [row(D, p).cause, row(D, p).action])));
    check('control: /engagement-models (crawled, not indexed, a real page) keeps "improve this page" (quality)', row(D, '/engagement-models').action === 'quality', J([row(D, '/engagement-models').cause, row(D, '/engagement-models').action]));
    check('control: the 9 indexed pages stay indexed with nothing to do', G.indexed.every(p => row(D, p).state === 'indexed' && row(D, p).action === 'none'), J(G.indexed.map(p => [p, row(D, p).state, row(D, p).action])));
    // §2.3 ask Google by value
    const askedP = D.stored.filter(r => r.ask_google === true).map(r => P(r.url));
    check('"ask Google" (5): the capability / industry pages linked from the home page first, then articles', J(askedP.slice().sort()) === J(['/capabilities/infrastructure-enterprise-systems', '/capabilities/open-edx-services', '/industries', '/insights/agentic-ai', '/insights/autonomous-ai-customer-service'].sort()), J(askedP));
    check('"ask Google" never a utility page, a job posting, /about-devaicon or the /insights listing while service pages wait', !askedP.some(p => /^\/(cookies|security|privacy|about-devaicon|insights)$|^\/careers\//.test(p)), J(askedP));
    check('the run row records the link read and the access Google reports for us', (() => { const j = JSON.parse(S0((d1.run || {}).sitemaps_json) || '{}'); return j.permission === 'siteFullUser' && j.permission_full === true && j.links && j.links.read === true && j.submit && j.submit.on === false && j.submit.gate === 'off'; })(), S0((d1.run || {}).sitemaps_json).slice(0, 600));
    // day 2: the home page does not answer -> linked_by 'unread', nothing concluded, no wait flips to links
    d2 = await TA(() => devDay(D, T0 + DAY, { homeDown: true }));
    check('day 2, the home page answers 503: linked_by "unread" and every waiting page still waits (nothing concluded, no flip to "add links")', !d2.__error && S0(row(D, '/capabilities/infrastructure-enterprise-systems').linked_by) === 'unread' && waits.every(p => row(D, p).action === 'wait'),
      J({ err: d2.__error, lb: row(D, '/capabilities/infrastructure-enterprise-systems').linked_by, w: waits.map(p => row(D, p).action) }));
    check('day 2: an industry page left out of the sitemap is NOT "fixed" by being absent from the sitemap (only a self canonical fixes it)', ALL_IND.every(p => !S0(row(D, p).fix_seen_at) && row(D, p).action === 'site_fix'), J(ALL_IND.map(p => [p, row(D, p).action, row(D, p).fix_seen_at])));
    // day 3: the client points the canonical of /industries/bfsi (Google read it as an alternate of /industries) and of /industries/hospitality
    // (Google has never seen it) to the pages themselves
    fixes.add('/industries/bfsi'); fixes.add('/industries/hospitality');
    d3 = await TA(() => devDay(D, T0 + 2 * DAY));
    fixes.clear();
    const b = row(D, '/industries/bfsi'), h = row(D, '/industries/hospitality');
    check('day 3, bfsi\'s canonical points to itself: "Fixed on your site. Waiting for Google to read it again." (Google still has it as an alternate)', !d3.__error && !!S0(b.fix_seen_at) && b.action === 'wait' && /^Fixed on your site\. Waiting for Google/.test(S0(b.note)), J([b.cause, b.action, b.fix_seen_at, b.note]));
    check('day 3, hospitality (never seen by Google) with its canonical fixed: the step left is the sitemap, and the note knows the page is already linked', h.cause === 'not_in_sitemap' && h.action === 'site_fix' && /^Google does not know this page and your sitemap does not list it\. Add it to the sitemap; it is already linked from your website \(\/\)\.$/.test(S0(h.note)), J([h.cause, h.action, h.note]));
    check('day 3: the other industry pages stay a site step', ALL_IND.filter(p => !['/industries/bfsi', '/industries/hospitality'].includes(p)).every(p => row(D, p).action === 'site_fix' && row(D, p).cause === 'canonical_elsewhere'), J(ALL_IND.map(p => [p, row(D, p).action])));
    if (process.env.OUT_DIR) try { fs.writeFileSync(path.join(process.env.OUT_DIR, 'index_wave2_devaicon_rows.json'), JSON.stringify(D.stored.map(r => ({ url: r.url, state: r.state, cause: r.cause, action: r.action, linked_by: r.linked_by, ask_google: r.ask_google, note: r.note })), null, 1)); } catch (e) { /* the sample is optional */ }
  });

  // =================================================================================================================================
  await guard('IXV2 link suggestions', async () => {
    const SN = 'IXV2 (DESIGN_WAVE2 §2.2) link suggestions: at most 3, indexed, never a utility page or a job posting, never a page that already links, a real topic overlap (the site\'s name and words on most pages are not a topic), no generic fallback: an empty list beats a wrong one';
    begin(SN); const check = mkCheck(SN);
    // devaicon's pages as Google had them when /cookies was suggested for a data-sovereignty article (the live advice of 2026-10-30)
    const ix = (p, t, o) => ({ url: DEV + p, title: t + ' | Devaicon', state: 'indexed', domain: 'devaicon.com', ...(o || {}) });
    const rows = [ix('/', 'Devaicon - Value Driven Innovation Through Automation & AI', { impressions_28d: 30 }), ix('/whatwedo', 'What We Do', { impressions_28d: 12 }), ix('/cookies', 'Cookie Policy', { impressions_28d: 9 }),
      ix('/privacy', 'Privacy Policy', { impressions_28d: 8 }), ix('/security', 'Security', { impressions_28d: 7 }), ix('/careers', 'Careers at Devaicon - Join Our Innovation Team', { impressions_28d: 6 }),
      ix('/careers/data-engineer', 'Data Engineer | Careers at Devaicon'), ix('/capabilities/intelligent-systems-data', 'Intelligent Systems & Data'), ix('/insights/ai-in-industrial-automation', 'AI in Industrial Automation'),
      ix('/capabilities/application-software-development', 'Application Software Development'), ix('/ai-automation-services-pakistan', 'AI Automation Services in Pakistan')];
    const sov = { url: DEV + '/insights/data-sovereign-asset', title: 'Data sovereignty as a strategic asset | Devaicon', state: 'not_indexed', domain: 'devaicon.com' };
    const edge = { url: DEV + '/insights/edge-ai-industrial-automation', title: 'Edge AI for industrial automation | Devaicon', state: 'not_indexed', domain: 'devaicon.com' };
    const none = { url: DEV + '/office-relocation-notice', title: 'Office relocation notice | Devaicon', state: 'not_indexed', domain: 'devaicon.com' };
    const a = T(() => IX.linkSuggestions(sov, rows, { site: SITE })), b = T(() => IX.linkSuggestions(edge, rows, { site: SITE })), c = T(() => IX.linkSuggestions(none, rows, { site: SITE }));
    const util = (l) => (Array.isArray(l) ? l : []).some(x => /\/(cookies|privacy|security)$|\/careers\//.test(x.url));
    check('never a utility page or a job posting (the live advice suggested /cookies for a data-sovereignty article)', Array.isArray(a) && Array.isArray(b) && !util(a) && !util(b), J({ a, b }));
    check('a real topic overlap only (a section like /insights/ is not a topic): the data-sovereignty article gets the data page, the edge-AI article the industrial-automation pages', Array.isArray(a) && a.length >= 1 && a.every(x => /data/i.test(x.url + x.title)) && Array.isArray(b) && b.length >= 1 && b.some(x => /industrial-automation/.test(x.url)) && b.length <= 3, J({ a, b }));
    check('no generic filler: two articles on different topics do not get the same list, and neither gets the home page, /whatwedo or /careers (pages that share only the site\'s name)', J(a) !== J(b) && ![].concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : []).some(x => /devaicon\.com\/(whatwedo|careers)?$/.test(x.url)), J({ a, b }));
    check('a page with no topic in common gets NO suggestion (the site\'s name "Devaicon" in every title is not a topic)', Array.isArray(c) && c.length === 0, J(c));
    const d = T(() => IX.linkSuggestions(edge, rows, { site: SITE, linked_from: [DEV + '/insights/ai-in-industrial-automation'] }));
    check('never a page that already links to it', Array.isArray(d) && !d.some(x => /ai-in-industrial-automation/.test(x.url)), J(d));
    check('the live run: no not-indexed page of devaicon.com got a suggestion list (each is already linked)', D.stored.length > 0 && D.stored.every(r => S0(r.link_from) === '' || S0(r.link_from) === '[]'), J(D.stored.filter(r => S0(r.link_from)).map(r => [P(r.url), r.link_from])));
  });

  // =================================================================================================================================
  await guard('IXV3 utility list and ask-Google order', async () => {
    const SN = 'IXV3 (DESIGN_WAVE2 §2.3 / §2.4) the shared utility list (exported for the app), job postings, and the "ask Google" value order: service pages linked from the home page, then articles, then other pages; ties: impressions, then the shallower path';
    begin(SN); const check = mkCheck(SN);
    const U = T(() => IX.UTILITY) || {};
    const SPEC = ['privacy', 'privacy-policy', 'cookies', 'cookie-policy', 'terms', 'terms-of-service', 'terms-and-conditions', 'legal', 'imprint', 'impressum', 'disclaimer', 'accessibility', 'sitemap',
      'login', 'signin', 'sign-in', 'register', 'signup', 'account', 'cart', 'checkout', 'search', 'thank-you', 'thanks'];
    check('IX.UTILITY carries exactly the §2.4 segments, security as a top-level page only, careers / jobs for job postings', J((U.segments || []).slice().sort()) === J(SPEC.slice().sort()) && J(U.top_level_only) === J(['security']) && J(U.job_dirs) === J(['careers', 'jobs']), J(U));
    const u = (p) => T(() => IX.isUtility(DEV + p));
    check('whole segments, any case, any depth: /privacy, /Legal/Imprint, /terms.html, /en/cookie-policy', [u('/privacy'), u('/Legal/Imprint'), u('/terms.html'), u('/en/cookie-policy')].every(x => x === true), J([u('/privacy'), u('/Legal/Imprint'), u('/terms.html'), u('/en/cookie-policy')]));
    check('not a utility page: /services/security, /privacy-first-analytics, /searching-for-talent, /careers', [u('/services/security'), u('/privacy-first-analytics'), u('/searching-for-talent'), u('/careers')].every(x => x === false), J([u('/services/security'), u('/privacy-first-analytics'), u('/searching-for-talent'), u('/careers')]));
    check('job postings: /careers/data-engineer and /jobs/x are, /careers is not', T(() => IX.isJobPosting(DEV + '/careers/data-engineer')) === true && T(() => IX.isJobPosting(DEV + '/jobs/x')) === true && T(() => IX.isJobPosting(DEV + '/careers')) === false, '');
    const home = new Set(['/capabilities/a', '/industries/b', '/insights/c', '/about', '/insights', '/privacy', '/careers/x'].map(p => IX.key(DEV + p)));
    const mk = (p, o) => ({ url: DEV + p, domain: 'devaicon.com', state: 'not_indexed', cause: 'discovered_not_crawled', action: 'wait', in_sitemap: true, linked_by: J([DEV + '/']), title: '', ...(o || {}) });
    const rs = [mk('/about'), mk('/insights'), mk('/insights/c'), mk('/blog/2025/03/d', { impressions_28d: 0 }), mk('/capabilities/a'), mk('/industries/b'), mk('/privacy'), mk('/careers/x'), mk('/x/y/z/deep')];
    const n = T(() => IX.askGoogle(rs, { now: T0, home_keys: home, freeze: { freeze: false } }));
    const on = rs.filter(r => r.ask_google).map(r => P(r.url));
    check('5 marked, by value: /industries/b and /capabilities/a (service pages linked from home), the two articles, then the shallowest other page', n === 5 && J(on.slice().sort()) === J(['/about', '/blog/2025/03/d', '/capabilities/a', '/industries/b', '/insights/c'].sort()), J({ n, on }));
    check('never /privacy (utility) or /careers/x (a job posting), even with room', !on.includes('/privacy') && !on.includes('/careers/x'), J(on));
    // §2.2: a canonical to another page is a site step only when the page has a title of its own; a real duplicate stays "fine to leave out"
    const titles = new Map([[IX.key(DEV + '/blog'), 'Blog | Devaicon'], [IX.key(DEV + '/industries'), 'Industries We Serve | Devaicon']]);
    const alt = (p, t) => T(() => IX.refine({ url: DEV + p, domain: 'devaicon.com', cause: 'alternate', action: 'leave_out', state: 'excluded', title: t, page_canonical: DEV + p.replace(/\/[^\/]+$/, '').replace(/\/page$/, ''), in_sitemap: false, linked_by: '' }, { titles, site: SITE }));
    const pag = alt('/blog/page/2', 'Blog | Devaicon'), own = alt('/industries/retail', 'Retail Technology Solutions | Devaicon');
    check('same title as the canonical target (pagination, a real copy): stays alternate / leave_out; its own title: canonical_elsewhere / site_fix', pag && pag.cause === 'alternate' && pag.action === 'leave_out' && own && own.cause === 'canonical_elsewhere' && own.action === 'site_fix' && own.own_title === true, J({ pag, own }));
  });

  // =================================================================================================================================
  await guard('IXV4 I asked Google, checked back', async () => {
    const SN = 'IXV4 (DESIGN_WAVE2 §2.3) "I asked Google" (asked_google_at, written by the app) checked back over simulated days: re-inspected within 2 days and every 3 days after, google_read_after_ask_at = Google\'s crawl after the ask with "Google read it again on <date>.", no new "ask Google" mark for 28 days; with no crawl, the 14-day note, then offered again after 28 days';
    begin(SN); const check = mkCheck(SN);
    const E = { stored: D.stored.map(r => ({ ...r })), history: [], runs: D.runs.slice() };
    const A = '/capabilities/open-edx-services', B = '/capabilities/infrastructure-enterprise-systems';
    const t0 = T0 + 3 * DAY; const askAt = t0 + 2 * 3600e3;   // the client presses "I asked Google" two hours after day 0's run
    const crawlA = t0 + 5 * DAY;
    const answer = (p, now) => {
      if (p === A && now >= crawlA) return insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(crawlA) });
      if (p === A || p === B) return insp({ coverageState: 'Discovered - currently not indexed', pageFetchState: '', indexingState: '', robotsTxtState: '' });
      return null; };
    const log = { A: [], B: [] }; const wrote = [];
    for (let d = 0; d <= 30; d++) {
      const now = t0 + d * DAY;
      const x = await TA(() => devDay(E, now, { answer }));
      if (x.__error) { log.err = x.__error; break; }
      if (d === 0) for (const p of [A, B]) { const r = row(E, p); r.asked_google_at = iso(askAt); }   // the app's write (between two runs)
      else for (const r of (x.rows || [])) if ([A, B].includes(P(r.url))) wrote.push(S0(r.asked_google_at));
      for (const [k, p] of [['A', A], ['B', B]]) { const r = row(E, p); log[k].push({ d, asked: (x.asked || []).includes(p), mark: r.ask_google === true, read: S0(r.google_read_after_ask_at).slice(0, 10), note: S0(r.note).slice(0, 70) }); }
    }
    const day = (k, d) => log[k][d] || {};
    check('control: the days ran', !log.err && log.A.length === 31, J(log.err));
    check('A: re-inspected the day after the ask (within 2 days), then every 3 days while waiting', day('A', 1).asked && day('A', 4).asked && !day('A', 2).asked && !day('A', 3).asked, J(log.A.slice(0, 8).map(l => [l.d, l.asked])));
    check('A: Google crawled on day 5 -> google_read_after_ask_at = that crawl, the note "Google read it again on <date>." with the new outcome', day('A', 7).read === iso(crawlA).slice(0, 10) && new RegExp('^Google read it again on ' + iso(crawlA).slice(0, 10) + '\\. ').test(row(E, A).note || '') && row(E, A).cause === 'crawled_not_indexed',
      J({ log: log.A.slice(4, 9), note: row(E, A).note, cause: row(E, A).cause }));
    check('A and B (the capability pages) were marked "ask Google" on day 0, and get no new mark while the ask is fresh (28 days)', day('A', 0).mark && day('B', 0).mark && log.A.slice(1, 28).every(l => !l.mark) && log.B.slice(1, 28).every(l => !l.mark), J({ A: log.A.filter(l => l.mark).map(l => l.d), B: log.B.filter(l => l.mark).map(l => l.d) }));
    check('B: no crawl -> from day 14 "You asked Google on <date>; Google has not read it again yet. There is nothing more to do on your side for now."', day('B', 13).note.indexOf('You asked Google') < 0 && /^You asked Google on \d{4}-\d{2}-\d{2}; Google has not read it again yet/.test(day('B', 15).note), J([day('B', 13).note, day('B', 15).note]));
    check('B: re-inspected the day after the ask, and the check-back inspections stop after 14 days (only the normal schedule after that)', day('B', 1).asked && log.B.slice(15, 28).filter(l => l.asked).length <= 2, J(log.B.map(l => [l.d, l.asked])));
    // offered again: B qualifies for the mark again once 28 days have passed (whether it gets one depends on the 5 marks already held)
    const alone = (d) => { const r = { ...row(E, B), ask_google: false, ask_google_at: '' }; T(() => IX.askGoogle([r], { now: t0 + d * DAY, home_keys: new Set([IX.key(DEV + B)]), freeze: { freeze: false } })); return r.ask_google === true; };
    check('B: offered again after 28 days (eligible for the mark again on day 29, not on day 27)', alone(29) === true && alone(27) === false, J([alone(27), alone(29)]));
    check('the engine never writes asked_google_at itself (only the app does): every row it writes for A / B carries the app\'s value unchanged', wrote.length > 0 && wrote.every(v => v === iso(askAt)), J(wrote.slice(0, 6)));
  });

  // =================================================================================================================================
  await guard('IXV5 sitemap submission gate', async () => {
    const SN = 'IXV5 (DESIGN_WAVE2 §2.5) the opt-in sitemap submission: the gate matrix (switch off / read-only / full / kill switch / list not read / outside the property), when (not listed / errors and changed / changed and 7 days apart; never unchanged, the first reading is a baseline), the 403, the check back from sitemaps.list, and end to end through the nodes (an empty list `{}` is a list read)';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-10T10:00:00Z');
    const OKSM = [{ url: DEV + '/sitemap.xml', from: 'robots' }];
    const urls = (n) => Array.from({ length: n }, (_, i) => ({ loc: DEV + '/p' + i }));
    const base = { on: true, kill_off: false, permission: 'siteFullUser', property: 'sc-domain:devaicon.com', ok: OKSM, complete: true, urls: urls(30), now };
    const L = (o) => [{ path: DEV + '/sitemap.xml', errors: 0, last_submitted: '2026-10-01T08:00:00.000Z', last_downloaded: '2026-10-28T03:00:00.000Z', ...(o || {}) }];
    const fpOf = (n) => T(() => IX.treeFp(urls(n), true));
    const sp = (o) => T(() => IX.submitPlan({ ...base, ...o }));
    const g = (o) => { const r = sp(o); return r && !r.__error ? r.gate + ':' + (r.submit || []).map(x => x.reason).join(',') : J(r); };
    check('switch off -> nothing', g({ on: false, gsc: [] }) === 'off:', g({ on: false, gsc: [] }));
    check('read-only access (siteRestrictedUser) -> nothing', g({ permission: 'siteRestrictedUser', gsc: [] }) === 'not_full_access:', g({ permission: 'siteRestrictedUser', gsc: [] }));
    check('the kill switch (SEO_SITEMAP_SUBMIT=off) -> nothing', g({ kill_off: true, gsc: [] }) === 'kill_switch:', g({ kill_off: true, gsc: [] }));
    check('Search Console\'s list not read today -> nothing', g({ gsc: null }) === 'list_not_read:', g({ gsc: null }));
    check('full access (siteOwner or siteFullUser) and not listed -> submit (not_listed)', g({ gsc: [] }) === 'ok:not_listed' && g({ permission: 'siteOwner', gsc: [] }) === 'ok:not_listed', g({ gsc: [] }));
    check('a URL-prefix property that does not cover the sitemap -> nothing', g({ gsc: [], property: 'https://www.devaicon.com/' }) === 'ok:', g({ gsc: [], property: 'https://www.devaicon.com/' }));
    check('listed, first reading of its addresses (a baseline, no change known) -> nothing', g({ gsc: L(), prev: {} }) === 'ok:', g({ gsc: L(), prev: {} }));
    check('listed, addresses unchanged since the last read -> never an unchanged resubmit', g({ gsc: L(), prev: { tree_fp: { fp: fpOf(30), changed_at: '' } } }) === 'ok:', g({ gsc: L(), prev: { tree_fp: { fp: fpOf(30), changed_at: '' } } }));
    check('listed, addresses changed since Search Console\'s lastSubmitted, no submission of ours in 7 days -> resubmit (changed)', g({ gsc: L(), prev: { tree_fp: { fp: fpOf(29), changed_at: '' } } }) === 'ok:changed', g({ gsc: L(), prev: { tree_fp: { fp: fpOf(29), changed_at: '' } } }));
    check('listed WITH errors and changed since our last submission (8 days ago) -> resubmit (errors_changed)', g({ gsc: L({ errors: 2, last_submitted: iso(now - 8 * DAY) }), prev: { tree_fp: { fp: fpOf(29) }, submissions: [{ path: DEV + '/sitemap.xml', at: iso(now - 8 * DAY), status: 'read' }] } }) === 'ok:errors_changed',
      g({ gsc: L({ errors: 2, last_submitted: iso(now - 8 * DAY) }), prev: { tree_fp: { fp: fpOf(29) }, submissions: [{ path: DEV + '/sitemap.xml', at: iso(now - 8 * DAY), status: 'read' }] } }));
    check('7-day spacing: changed again, but we submitted it 3 days ago -> nothing', g({ gsc: L({ last_submitted: iso(now - 3 * DAY) }), prev: { tree_fp: { fp: fpOf(29) }, submissions: [{ path: DEV + '/sitemap.xml', at: iso(now - 3 * DAY), status: 'confirmed' }] } }) === 'ok:', '');
    // the 403
    const plan = sp({ gsc: [] });
    const r403 = T(() => IX.submitResults(plan, [{ path: DEV + '/sitemap.xml', reason: 'not_listed' }], [{ statusCode: 403, headers: {}, body: { error: { code: 403, message: 'User does not have sufficient permission' } } }], now));
    check('a 403 -> recorded "denied", permission not full, the level remembered', r403 && r403.today && r403.today[0].status === 'denied' && r403.permission_full === false && r403.submit_denied && r403.submit_denied.level === 'siteFullUser', J(r403));
    check('after a 403: no retry at the same access level the next day', g({ gsc: [], now: now + DAY, prev: { submissions: (r403 || {}).submissions, submit_denied: (r403 || {}).submit_denied } }) === 'denied_before:', g({ gsc: [], now: now + DAY, prev: { submit_denied: (r403 || {}).submit_denied } }));
    check('after a 403: tried again when Google reports another (full) level, or after 28 days', g({ gsc: [], permission: 'siteOwner', now: now + DAY, prev: { submit_denied: (r403 || {}).submit_denied } }) === 'ok:not_listed' && g({ gsc: [], now: now + 29 * DAY, prev: { submit_denied: (r403 || {}).submit_denied } }) === 'ok:not_listed', '');
    // the check back
    const back = T(() => IX.submitPlan({ ...base, gsc: L({ last_submitted: iso(now + 60e3), last_downloaded: iso(now + 5 * 3600e3) }), now: now + DAY, prev: { submissions: [{ path: DEV + '/sitemap.xml', at: iso(now), status: 'submitted' }] } }));
    check('checked back from sitemaps.list: lastSubmitted after ours = confirmed, lastDownloaded after it = "read" with Google\'s date', back && (back.submissions || [])[0] && back.submissions[0].status === 'read' && back.submissions[0].read_at === iso(now + 5 * 3600e3) && back.submissions[0].confirmed_at === iso(now + 60e3), J(back && back.submissions));
    const md = (on) => T(() => IX.reportMarkdown({ domain: 'devaicon.com' }, { known: 1, indexed: 1, should_index: 1, unknown: 0, errors: 0 }, { quota_cap: 300 }, { rows: [], submit_on: on }));
    check('the report\'s promise follows the switch: "We only read your Search Console, except your sitemap ..." only when it is on', /lets us submit your sitemap and nothing else/.test(S0(md(true))) && /nothing here is submitted to Google/.test(S0(md(false))) && !/submit your sitemap/.test(S0(md(false))), J([md(true), md(false)]).slice(0, 400));
    // end to end through the nodes: switched on, full access, Search Console lists nothing (`{}`)
    const E = { stored: D.stored.map(r => ({ ...r })), history: [], runs: D.runs.slice() };
    const t1 = T0 + 10 * DAY;
    const x1 = await TA(() => devDay(E, t1, { submit: true, gscList: {} }));
    const put = (x1.submits || [])[0] || {};
    check('end to end: an empty sitemaps.list ({}) is read as "no sitemap submitted" and the robots.txt sitemap is submitted with ONE PUT to sitemaps.submit', !x1.__error && (x1.submits || []).length === 1 && put.url === 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Adevaicon.com/sitemaps/https%3A%2F%2Fdevaicon.com%2Fsitemap.xml' && put.reason === 'not_listed', J({ err: x1.__error, submits: x1.submits }));
    const j1 = T(() => JSON.parse(S0((x1.run || {}).sitemaps_json) || '{}')) || {};
    check('the run row: submit on / ok, the submission recorded (submitted), the note says so', (j1.submissions || [])[0] && j1.submissions[0].status === 'submitted' && j1.submit && j1.submit.on === true && j1.submit.gate === 'ok' && /We submitted your sitemap to Google today/.test(S0((x1.run || {}).note)), J({ j: j1, note: (x1.run || {}).note }));
    const x2 = await TA(() => devDay(E, t1 + DAY, { submit: true, gscList: GSC_LISTED({ lastSubmitted: iso(t1 + 60e3), lastDownloaded: iso(t1 + 4 * 3600e3) }) }));
    const j2 = T(() => JSON.parse(S0((x2.run || {}).sitemaps_json) || '{}')) || {};
    check('the next day: listed with our date -> no resubmit, the submission reads "read" (Google read your sitemap)', !x2.__error && (x2.submits || []).length === 0 && (j2.submissions || [])[0] && j2.submissions[0].status === 'read', J({ err: x2.__error, s: x2.submits, j: j2.submissions }));
    const x3 = await TA(() => devDay(E, t1 + 2 * DAY, { submit: true, permission: 'siteRestrictedUser', gscList: {} }));
    const j3 = T(() => JSON.parse(S0((x3.run || {}).sitemaps_json) || '{}')) || {};
    check('read-only access with the switch on: nothing sent, permission recorded, the note asks for Full access', !x3.__error && (x3.submits || []).length === 0 && j3.permission === 'siteRestrictedUser' && j3.permission_full === false && /read-only access/.test(S0((x3.run || {}).note)), J({ err: x3.__error, j: j3, note: (x3.run || {}).note }));
    const x4 = await TA(() => devDay(E, t1 + 3 * DAY, { submit: false, gscList: {} }));
    check('control: switched off, nothing sent (an unsubmitted sitemap is the client\'s step, as before)', !x4.__error && (x4.submits || []).length === 0, J(x4.submits || x4.__error));
  });

  // =================================================================================================================================
  await guard('IXV6 the write credential and the generated workflows', async () => {
    const SN = 'IXV6 (DESIGN_WAVE2 §2.5) the write-scope credential SEOcredGoogleSvcW is on exactly ONE node of every generated workflow (Submit Sitemap (Index): a PUT, fed only by Sitemap Submit Requests, a 4xx read as an answer and never retried); every other Google call keeps the read-only credential; the kill switch is baked; sync_credentials.py creates it from the same service account with the webmasters scope';
    begin(SN); const check = mkCheck(SN);
    const wfs = []; for (const f of (fs.existsSync(WFD) ? fs.readdirSync(WFD) : [])) if (f.endsWith('.json')) { try { const d = JSON.parse(fs.readFileSync(path.join(WFD, f), 'utf8')); for (const w of (Array.isArray(d) ? d : [d])) wfs.push(w); } catch (e) { /* not a workflow */ } }
    const withW = []; const googleOther = [];
    for (const w of wfs) for (const n of (w.nodes || [])) { const id = ((n.credentials || {}).googleApi || {}).id; if (id === 'SEOcredGoogleSvcW') withW.push(w.name + ' / ' + n.name); else if (id && id !== 'SEOcredGoogleSvc') googleOther.push(w.name + ' / ' + n.name + ': ' + id); }
    check('exactly one node in all generated workflows carries SEOcredGoogleSvcW: Index Coverage / Submit Sitemap (Index)', J(withW) === J(['SEO Agent — Index Coverage / Submit Sitemap (Index)']), J(withW));
    check('control: no Google node uses any other Google credential', googleOther.length === 0, J(googleOther));
    const wf = wfs.find(w => w.id === 'SEOagentIndexCv1') || { nodes: [], connections: {} };
    const n = (wf.nodes || []).find(x => x.name === 'Submit Sitemap (Index)') || {};
    const C = wf.connections || {}; const outs = (a) => ((C[a] || {}).main || []).flat().filter(Boolean).map(t => t.node);
    const feeders = Object.keys(C).filter(a => outs(a).includes('Submit Sitemap (Index)'));
    check('a PUT to the URL Sitemap Submit Requests built, neverError + fullResponse (a 4xx is an answer, never retried)', (n.parameters || {}).method === 'PUT' && (n.parameters || {}).url === '={{ $json.url }}' && J(((n.parameters || {}).options || {}).response) === J({ response: { fullResponse: true, neverError: true } }), J(n.parameters));
    check('fed only by Any Sitemap Submit? (after Sitemap Submit Requests), after the run\'s reservation', J(feeders) === J(['Any Sitemap Submit?']) && outs('Sitemap Submit Requests').includes('Any Sitemap Submit?') && outs('Any Reservation?').concat(outs('Save Index Reservation')).includes('Sitemap Submit Requests'), J({ feeders, after: outs('Save Index Reservation') }));
    const others = (wf.nodes || []).filter(x => x.type === 'n8n-nodes-base.httpRequest' && x.name !== 'Submit Sitemap (Index)' && ['PUT', 'PATCH', 'DELETE'].includes((x.parameters || {}).method));
    check('control: no other PUT / PATCH / DELETE in Index Coverage', others.length === 0, J(others.map(x => x.name)));
    check('the kill switch is baked into Sitemap Submit Requests and Index Inventory (on by default)', /const KILL_OFF = '(on|off)' === 'off';/.test(src('Sitemap Submit Requests')) && /const SUBMIT_KILL_OFF = '(on|off)' === 'off';/.test(src('Index Inventory')), '');
    const sc = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'sync_credentials.py'), 'utf8'); } catch (e) { return ''; } })();
    check('sync_credentials.py: SEOcredGoogleSvcW from the same SEO_GOOGLE_SA_* settings, scope webmasters (write), the read-only credential unchanged',
      /\('SEOcredGoogleSvcW', [^\n]*'googleApi', \{'email': 'SEO_GOOGLE_SA_EMAIL', 'privateKey': 'SEO_GOOGLE_SA_PRIVATE_KEY'\}[^\n]*'scopes': SCOPES_WRITE\}\)/.test(sc) && /SCOPES_WRITE = 'https:\/\/www\.googleapis\.com\/auth\/webmasters'/.test(sc)
      && /SCOPES = 'https:\/\/www\.googleapis\.com\/auth\/webmasters\.readonly https:\/\/www\.googleapis\.com\/auth\/analytics\.readonly'/.test(sc), sc.slice(0, 200));
  });

  // =================================================================================================================================
  await guard('IXV7 Site Admin index_sitemap_submit and the columns', async () => {
    const SN = 'IXV7 (DESIGN_WAVE2 §2.5 / §2.1 / §2.3) the new columns and the setting: seo_index_pages.linked_by / asked_google_at / google_read_after_ask_at, seo_monitors.index_sitemap_submit (validated by Site Admin `monitors` like index_watch, empty = off, kept as stored when not given; "Track my site" carries it)';
    begin(SN); const check = mkCheck(SN);
    const TC = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'table_cols.json'), 'utf8')); } catch (e) { return {}; } })();
    const W2 = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'index_wiring.json'), 'utf8')); } catch (e) { return {}; } })();
    check('seo_monitors has index_sitemap_submit', (TC.MONITORS || []).includes('index_sitemap_submit'), J((TC.MONITORS || []).slice(-3)));
    check('seo_index_pages has linked_by, asked_google_at, google_read_after_ask_at, and IX.PAGE_COLS equals the table', ['linked_by', 'asked_google_at', 'google_read_after_ask_at'].every(c => (W2.page_cols || []).includes(c)) && J(T(() => IX.PAGE_COLS)) === J(W2.page_cols), J((W2.page_cols || []).slice(-4)));
    const admin = async (monitors, stored) => { const a = (await node('Admin Action', { 'Admin Run': [{ action: 'monitors', domain: 'devaicon.com', monitors }] }, null, T0))[0];
      const r = (await node('Monitor Row (Admin)', { 'Admin Action': [a], 'Load Monitors (Admin)': [stored || { site_id: SITE.site_id, domain: 'devaicon.com' }] }, null, T0))[0]; return { a, r }; };
    const on = await TA(() => admin({ index_sitemap_submit: 'on' }));
    check('"on" is stored true, exact seo_monitors columns', on.r && on.r.index_sitemap_submit === true && J(Object.keys(on.r).sort()) === J((TC.MONITORS || []).slice().sort()), J(on.r || on.__error));
    const off = await TA(() => admin({ index_sitemap_submit: false }, { site_id: SITE.site_id, domain: 'devaicon.com', index_sitemap_submit: true }));
    check('false is stored false', off.r && off.r.index_sitemap_submit === false, J(off.r || off.__error));
    const kept = await TA(() => admin({ ai_pulse: false }, { site_id: SITE.site_id, domain: 'devaicon.com', index_sitemap_submit: true }));
    check('a monitors save that does not name it keeps what is stored', kept.r && kept.r.index_sitemap_submit === true, J(kept.r || kept.__error));
    const blank = await TA(() => admin({}, { site_id: SITE.site_id, domain: 'devaicon.com' }));
    check('never set: empty (= off)', blank.r && blank.r.index_sitemap_submit === null, J(blank.r || blank.__error));
    const bad = await TA(() => node('Admin Action', { 'Admin Run': [{ action: 'monitors', domain: 'devaicon.com', monitors: { index_sitemap_submit: 'maybe' } }] }, null, T0));
    check('anything else is refused with its reason: "index_sitemap_submit must be true or false"', bad && /index_sitemap_submit must be true or false/.test(S0(bad.__error)), J(bad));
    const t = await TA(() => node('Monitor Row (Track)', { 'Normalize Input': [{ domain: 'devaicon.com', competitors: [], request_id: 'r1', monitor_input: {} }],
      'Load Monitors (Track)': [{ site_id: SITE.site_id, domain: 'devaicon.com', index_sitemap_submit: true, index_watch: false }] }, null, T0));
    check('"Track my site" carries it as stored (the upsert would empty a column it is not given), exact columns', Array.isArray(t) && t[0] && t[0].index_sitemap_submit === true && J(Object.keys(t[0]).sort()) === J((TC.MONITORS || []).slice().sort()), J(t));
    const plan = await TA(() => node('Index Plan', { 'Manual Run': [{ domain: 'devaicon.com' }], 'Load Sites (Index)': [{ ...SITE, status: 'active' }], 'Load Monitors (Index)': [{ site_id: SITE.site_id, index_sitemap_submit: true }], 'Load Index Runs': [{}] }, null, T0));
    const plan0 = await TA(() => node('Index Plan', { 'Manual Run': [{ domain: 'devaicon.com' }], 'Load Sites (Index)': [{ ...SITE, status: 'active' }], 'Load Monitors (Index)': [{ site_id: SITE.site_id }], 'Load Index Runs': [{}] }, null, T0));
    check('the run reads the switch: on when stored true, OFF when empty', Array.isArray(plan) && plan[0].sitemap_submit === true && Array.isArray(plan0) && plan0[0].sitemap_submit === false, J([plan, plan0].map(p => Array.isArray(p) ? p[0].sitemap_submit : p)));
  });
};

if (require.main === module) {
  const results = [];
  const H = { results, save: () => {} };
  const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log('   !! scenario "' + name + '" aborted at: ' + String(e && e.message || e)); results.push({ scenario: name, node: 'scenario aborted', ok: false }); } };
  const begin = (sn) => { console.log('\n########## ' + sn + ' ##########'); };
  module.exports({ H, guard, begin }).then(() => { const f = results.filter(r => !r.ok).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); });
}
