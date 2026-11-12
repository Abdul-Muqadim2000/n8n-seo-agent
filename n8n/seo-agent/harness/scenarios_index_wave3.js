// IXT1-IXT9 (Index coverage wave 3, 2026-11-12: docs/indexing-2026-10-29/DESIGN_WAVE3.md §2, ENGINE_BUILD.md "Wave 3"). devaicon.com-shaped:
// the real public pages read on 2026-10-30 (fixtures_index/devaicon_2026-10-30, as wave 2 uses them) with the sitemap of 2026-11-12 (every
// page listed, NO <lastmod>: the 10-30 sitemap carried 11 of 30), Google's answers as on production (capability / Open edX / industry /
// insights / job pages never visited, /privacy and /cookies policy pages), replayed day by day through the GENERATED Code nodes
// (harness/code_v4) with a pinned clock. Every check here fails on the code before wave 3 (ix3/engine at 06332af3: run it with CODE_DIR /
// WF_DIR pointing at that build's output) unless its label starts with "control:"; every computation is wrapped, so a node or a function the
// old code lacks is a failed check, not a crash. Called from scenarios_v5.js after scenarios_index_improved.js; also runs on its own:
//   CODE_DIR=<code_v4> WF_DIR=<workflows> node scenarios_index_wave3.js   (prints the counts)
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
  const node = async (name, mocks, input, now) => {
    const code = src(name); if (!code) throw new Error('node "' + name + '" does not exist in this build');
    const $ = (n) => { if (!(n in mocks)) throw new Error('Referenced node "' + n + '" has no data in this run');
      const a = mocks[n].map(j => (j && j.json !== undefined && Object.keys(j).every(k => k === 'json' || k === 'binary')) ? j : { json: j });
      return { all: () => a, first: () => a[0], last: () => a[a.length - 1], get item() { return a[0]; } }; };
    const items = (input || [{ json: {} }]).map(j => (j && j.json !== undefined) ? j : { json: j });
    const $input = { all: () => items, first: () => items[0], last: () => items[items.length - 1], get item() { return items[0]; } };
    const RealDate = Date;
    const D = class extends RealDate { constructor(...a) { if (!a.length) super(now); else super(...a); } static now() { return now; } };
    const thisArg = { helpers: { getBinaryDataBuffer: async () => { throw new Error('no binary'); } } };
    const f = new AsyncF('$', '$input', '$execution', 'URL', 'structuredClone', 'Date', code);
    const out = await f.call(thisArg, $, $input, { id: '4343' }, undefined, undefined, now ? D : Date);
    return (out || []).map(o => o.json);
  };

  // ---- devaicon.com: the pages of 2026-10-30, the sitemap of 2026-11-12 (no lastmod) ----
  const DEV = 'https://devaicon.com';
  const SITE = { site_id: 'site_devaicon-com', domain: 'devaicon.com', canonical_host: 'devaicon.com', gsc_property: 'sc-domain:devaicon.com' };
  const FX = path.join(__dirname, 'fixtures_index', 'devaicon_2026-10-30');
  const gz = (f) => zlib.gunzipSync(fs.readFileSync(path.join(FX, f))).toString('utf8');
  const HOME = gz('home.html.gz'), IND = gz('industries.html.gz'), BFSI = gz('industries_bfsi.html.gz'), CAREERS = gz('careers.html.gz'), PRIV = gz('privacy.html.gz'),
    OEDX = gz('open_edx_services.html.gz'), ROBOTS = fs.readFileSync(path.join(FX, 'robots.txt'), 'utf8');
  const SITEMAP_1030 = gz('sitemap.xml.gz');
  const SITEMAP = SITEMAP_1030.replace(/\s*<lastmod>[^<]*<\/lastmod>/g, '');   // 2026-11-12: changefreq / priority only, no lastmod
  const INDUSTRIES = { bfsi: '', hospitality: 'Hospitality Technology Solutions', manufacturing: 'Manufacturing Technology and Automation', retail: 'Retail Technology Solutions',
    'public-sector': 'Public Sector Digital Services', nonprofit: 'Nonprofit Technology Solutions', 'professional-services': 'Professional Services Technology' };
  const withPage = (html, title, canonical) => html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>').replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, '<link rel="canonical" href="' + canonical + '"/>');
  const pathOf = (u) => (S0(u).match(/^https?:\/\/[^\/?#]*([^?#]*)/i) || [])[1] || '/';
  const P = (u) => pathOf(u).replace(/\/+$/, '') || '/';
  const pageHtml = (u) => { const p = P(u);
    if (p === '/') return HOME; if (p === '/industries') return IND; if (p === '/careers') return CAREERS; if (p === '/privacy') return PRIV; if (p === '/capabilities/open-edx-services') return OEDX;
    const ind = p.match(/^\/industries\/([^\/]+)$/);
    if (ind) return ind[1] === 'bfsi' ? BFSI : withPage(BFSI, INDUSTRIES[ind[1]] + ' | Devaicon', DEV + '/industries');
    const job = p.match(/^\/careers\/([^\/]+)$/); if (job) return withPage(CAREERS, job[1].replace(/-/g, ' ') + ' | Careers at Devaicon', DEV + p);
    return withPage(PRIV, p.split('/').pop().replace(/-/g, ' ') + ' | Devaicon', DEV + p); };
  const OK = (u) => ({ statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, data: pageHtml(u) });
  const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: '', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL', ...o } } });
  const G = { indexed: ['/', '/whatwedo', '/ai-automation-services-pakistan', '/capabilities/intelligent-systems-data', '/capabilities/application-software-development',
      '/capabilities/consulting-transformation', '/contact-us', '/insights/ai-in-industrial-automation', '/careers'],
    crawled: ['/engagement-models', '/privacy'],
    discovered: ['/capabilities/infrastructure-enterprise-systems', '/capabilities/open-edx-services', '/industries', '/insights', '/about-devaicon', '/cookies'] };
  const T0 = Date.parse('2026-10-20T05:15:00Z');   // the first run; day 21 is 2026-11-10, day 23 the day of the client's document
  const answerG = (u, now, o) => { const p = P(u); const over = o && o.answer ? o.answer(p, now) : null; if (over) return over;
    if (G.indexed.includes(p)) return insp({ verdict: 'PASS', coverageState: 'Submitted and indexed', googleCanonical: u, lastCrawlTime: iso(T0 - 9 * DAY) });
    if (G.crawled.includes(p)) return insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(T0 - 20 * DAY) });
    if (G.discovered.includes(p)) return insp({ coverageState: 'Discovered - currently not indexed', pageFetchState: '', indexingState: '', robotsTxtState: '' });
    if (p === '/industries/bfsi') return insp({ coverageState: 'Alternate page with proper canonical tag', userCanonical: DEV + '/industries', googleCanonical: DEV + '/industries', lastCrawlTime: iso(T0 - 12 * DAY) });
    return insp({ coverageState: 'URL is unknown to Google', pageFetchState: '', indexingState: '', robotsTxtState: '' }); };
  const KEY = '3f2a9c1e7b6d4a58b0c2e4f6a8b0c2d4';

  // ---- one day of devaicon.com through the generated nodes (wave 2's day, plus the IndexNow nodes and the report) ----
  const devDay = async (st, now, o) => {
    const opt = o || {}; const M = {}; const lastRun = st.runs.length ? st.runs[st.runs.length - 1] : null;
    const pj = lastRun ? (() => { try { return JSON.parse(lastRun.sitemaps_json || '{}'); } catch (e) { return {}; } })() : {};
    M['Index Sites'] = [{ ...SITE, gsc_connected: true, gsc_permission: 'siteFullUser', cap: 300, used_today: 0, run_at: iso(now), quota_hit: false,
      prev_complete: !!lastRun, prev_complete_at: lastRun ? S0(lastRun.run_at) : '', home_host_prev: 'devaicon.com', on_demand: !!opt.onDemand, callback_url: opt.onDemand ? 'https://app.example/cb' : '',
      chain_id: '', sitemap_submit: false, prev_submissions: [], prev_tree_fp: pj.tree_fp || null, prev_submit_denied: null, prev_sitemap_dates: pj.dates || null }];
    M['Index Plan'] = [{ ...M['Index Sites'][0], dry_run: !!opt.dry }];
    M['Load Index Pages'] = st.stored.length ? st.stored.map(r => ({ ...r })) : [{}];
    M['Load Pages (Index)'] = [{}]; M['Load Page Watch (Index)'] = [{}]; M['Load Content Log (Index)'] = [{}];
    M['Load IndexNow Key (Index)'] = opt.key ? [{ key: 'indexnow:' + SITE.site_id, kind: 'indexnow', site_id: SITE.site_id, value: JSON.stringify({ key: opt.key, verified_at: '2026-10-12T09:30:00Z' }) }] : [{}];
    M['Load AI Pages (Index)'] = opt.aiPages || [{}];
    M['Sitemaps List Requests'] = [{ site_id: SITE.site_id, url: 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Adevaicon.com/sitemaps' }];
    M['GSC Sitemaps List'] = [{ statusCode: 200, statusMessage: 'OK', headers: { 'content-type': 'application/json; charset=UTF-8' }, body: { sitemap: [{ path: DEV + '/sitemap.xml', lastSubmitted: '2026-10-01T08:00:00.000Z', lastDownloaded: '2026-10-28T03:00:00.000Z', isPending: false, warnings: '0', errors: '0' }] } }];
    M['Pages Query Requests'] = [{ skip: true }]; M['Pages Query More'] = [{ skip: true }];
    M['Google Events'] = [{ freeze: opt.freeze || { freeze: false }, started: [], completed: [], events: [] }];
    const sm = opt.sitemap || SITEMAP;
    const sq = await node('Sitemap Requests 1', M, null, now); M['Sitemap Requests 1'] = sq;
    M['Fetch Sitemaps 1'] = sq.filter(q => !q.skip).map(q => /\/robots\.txt$/.test(q.url) ? { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS }
      : /\/sitemap\.xml$/.test(q.url) ? { statusCode: 200, headers: { 'content-type': 'application/xml' }, data: sm }
      : (opt.homeDown && P(q.url) === '/' ? { statusCode: 503, headers: {}, data: 'unavailable' } : OK(q.url)));
    M['Sitemap Read 1'] = await node('Sitemap Read 1', M, M['Fetch Sitemaps 1'], now);
    const lr = await node('Link Read Requests', M, null, now); M['Link Read Requests'] = lr;
    if (lr.some(q => !q.skip)) M['Fetch Link Pages'] = lr.filter(q => !q.skip).map(q => OK(q.url));
    M['Site Links'] = await node('Site Links', M, M['Fetch Link Pages'] || null, now);
    const inv = await node('Index Inventory', M, null, now); M['Index Inventory'] = inv;
    const res = await node('Index Reservation', M, null, now); M['Save Index Reservation'] = res.filter(r => !r.skip).map((r, i) => ({ id: 1 + i, ...r }));
    M['Sitemap Submit Requests'] = await node('Sitemap Submit Requests', M, null, now);
    const pr = await node('Index Probe Requests', M, null, now); M['Index Probe Requests'] = pr;
    const asked = []; const answer = (u) => { asked.push(P(u)); return answerG(u, now, opt); };
    M['Inspect URL (Probe)'] = pr.filter(q => !q.skip).map(q => answer(q.inspect_url));
    const ir = await node('Index Inspect Requests', M, null, now); M['Index Inspect Requests'] = ir;
    M['Inspect URL (Index)'] = ir.filter(q => !q.skip).map(q => answer(q.inspect_url));
    M['Inspect Retry Requests'] = [{ skip: true }]; M['Inspect URL (Retry)'] = [];
    const fr = await node('Page Fetch Requests', M, null, now); M['Page Fetch Requests'] = fr;
    if (fr.some(q => !q.skip)) { M['Fetch Page (Index)'] = fr.filter(q => !q.skip).map(q => OK(q.url)); M['Page First Reads'] = await node('Page First Reads', M, M['Fetch Page (Index)'], now); }
    const hr = await node('Fetch Hop Requests', M, null, now); M['Fetch Hop Requests'] = hr;
    if (!hr[0].skip) M['Fetch Page (Final)'] = hr.map(q => OK(q.url));
    M['Page Signals'] = await node('Page Signals', M, M['Fetch Page (Final)'] || null, now);
    const dg = await node('Index Diagnose', M, null, now); M['Index Diagnose'] = dg;
    // wave 3: IndexNow (nodes the old build does not have are skipped: the run is then what the old build did)
    const keyGets = [], posts = [];
    if (has('IndexNow Key Check (Index)')) {
      const kc = await node('IndexNow Key Check (Index)', M, null, now); M['IndexNow Key Check (Index)'] = kc;
      const kq = kc.filter(q => !q.skip); keyGets.push(...kq.map(q => q.url));
      if (kq.length) M['Fetch IndexNow Key (Index)'] = kq.map(q => opt.keyAnswer ? opt.keyAnswer(q) : { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: q.key });
      const sr = await node('IndexNow Submit Requests (Index)', M, null, now); M['IndexNow Submit Requests (Index)'] = sr;
      const sq2 = sr.filter(q => !q.skip); posts.push(...sq2);
      if (sq2.length) M['Submit IndexNow (Index)'] = sq2.map(q => opt.inAnswer ? opt.inAnswer(q) : { statusCode: 200, headers: {}, data: '' });
    }
    const rows = (await node('Index Page Rows', M, null, now)).filter(r => !r.skip);
    M['Save Index Pages'] = rows.map(r => ({ id: 1, ...r }));
    const hist = (await node('Index History Rows', M, null, now)).filter(r => !r.skip);
    const run = (await node('Index Run Rows', M, null, now)).filter(r => !r.skip)[0] || null;
    M['Index Run Rows'] = run ? [run] : [{ skip: true }];
    const report = opt.onDemand ? (await node('Index Report', M, null, now)).filter(r => !r.skip)[0] || null : null;
    for (const r of rows) { const m = st.stored.filter(x => x.site_id === r.site_id && x.url === r.url); if (m.length) m.forEach(x => Object.assign(x, r)); else st.stored.push({ ...r }); }
    st.history.push(...hist); if (run) st.runs.push(run);
    return { dg: dg[0], rows, asked, run, report, keyGets, posts };   // the day's mocks (page bodies) are not kept: the AIR timing checks run next
  };
  const row = (st, p) => st.stored.find(r => P(r.url) === p) || {};
  const SJ = (run) => T(() => JSON.parse(S0((run || {}).sitemaps_json) || '{}')) || {};
  const JOBS = ['/careers/senior-full-stack-developer', '/careers/ai-ml-engineer', '/careers/cloud-solutions-architect', '/careers/data-engineer', '/careers/product-manager', '/careers/frontend-developer'];
  const WAIT13 = ['/capabilities/open-edx-services/open-edx-hosting', '/capabilities/open-edx-services/open-edx-development', ...JOBS, '/insights/agentic-ai', '/insights/value-driven-innovation-automation'];
  const escalatedOf = (st) => st.stored.filter(r => S0(r.escalated_at)).map(r => P(r.url)).sort();
  const copy = (st) => ({ stored: st.stored.map(r => ({ ...r })), history: [], runs: st.runs.slice() });

  // =================================================================================================================================
  const D = { stored: [], history: [], runs: [] }; const days = {};
  await guard('IXT1 escalation at 21 days', async () => {
    const SN = 'IXT1 (DESIGN_WAVE3 §2.2) devaicon.com over 23 days: a page Google never visited, waiting (or "add links"), not indexed, is escalated on day 21 of watching (not on day 20), escalated_at is kept while it holds, the reasons in the contract\'s order, the note says 3 weeks and the first reason\'s step, the action does not change; a crawl clears it';
    begin(SN); const check = mkCheck(SN);
    for (const d of [0, 7, 14, 20, 21, 22]) { const x = await TA(() => devDay(D, T0 + d * DAY)); days[d] = x; if (x.__error) break; }
    check('control: the days ran through every generated node', Object.values(days).every(x => !x.__error) && D.stored.length > 25, J(Object.values(days).map(x => x.__error).filter(Boolean)));
    const waiting = D.stored.filter(r => r.action === 'wait' && /^(unknown_to_google|discovered_not_crawled)$/.test(S0(r.cause)) && !S0(r.last_crawl)).map(r => P(r.url));
    check('control: the waiting pages are devaicon\'s (Open edX sub-pages, job pages, insights, capability pages), none crawled', WAIT13.every(p => waiting.includes(p)), J(waiting));
    check('day 20: no page is escalated yet (20 days of watching)', T(() => days[20].rows.concat(days[20].dg.all || []).every(r => !S0(r.escalated_at))) === true && Object.prototype.hasOwnProperty.call((days[20].rows || [])[0] || {}, 'escalated_at'),
      J((days[20].rows || []).filter(r => S0(r.escalated_at)).map(r => P(r.url))));
    const esc21 = escalatedOf(D);
    check('day 21: every waiting page Google never visited is escalated; nothing else is (indexed, policy pages, site steps, crawled pages)', J(esc21) === J(waiting.slice().sort()) && esc21.length >= 13, J({ esc21, waiting }));
    const capa = row(D, '/capabilities/infrastructure-enterprise-systems'), job = row(D, '/careers/data-engineer');
    check('escalated_at = the first run it held (day 21), kept on day 22', capa.escalated_at === iso(T0 + 21 * DAY) && job.escalated_at === iso(T0 + 21 * DAY), J([capa.escalated_at, job.escalated_at]));
    check('the action does not change (wait stays wait: the app groups by escalated_at)', esc21.length > 0 && D.stored.filter(r => S0(r.escalated_at)).every(r => r.action === 'wait' || r.action === 'links'), J(D.stored.filter(r => S0(r.escalated_at)).map(r => [P(r.url), r.action])));
    check('escalate_why: never asked -> not_asked first; the 2026-11-12 sitemap has no lastmod -> sitemap_no_dates last; all in the sitemap -> no not_in_sitemap',
      esc21.length > 0 && D.stored.filter(r => S0(r.escalated_at)).every(r => { const w = S0(r.escalate_why).split(','); return w[0] === 'not_asked' && w[w.length - 1] === 'sitemap_no_dates' && !w.includes('not_in_sitemap'); }),
      J(D.stored.filter(r => S0(r.escalated_at)).map(r => [P(r.url), r.escalate_why])));
    check('weak_links exactly when the home page does not link it or one page at most does (link_depth != 1 or linked_n <= 1)', esc21.length > 0 && D.stored.filter(r => S0(r.escalated_at)).every(r => S0(r.escalate_why).split(',').includes('weak_links') === (Number(r.link_depth) !== 1 || Number(r.linked_n) <= 1)),
      J(D.stored.filter(r => S0(r.escalated_at)).map(r => [P(r.url), r.link_depth, r.linked_n, r.escalate_why])));
    check('a job page (linked from /careers only) has weak_links; the reasons keep the contract\'s order', /^not_asked,weak_links,sitemap_no_dates$/.test(S0(job.escalate_why)) && job.link_depth === 2, J([job.escalate_why, job.link_depth, job.linked_n]));
    const H3 = 'Google has not visited this page in the 3 weeks we have watched it. ';
    const esc = D.stored.filter(r => S0(r.escalated_at) && /^not_asked/.test(S0(r.escalate_why)));
    check('the note: "Google has not visited this page in the 3 weeks we have watched it. Ask Google to read it in Search Console" - "(it is on your list today)" on the pages marked today, else when it comes onto the list',
      esc.length > 0 && esc.some(r => r.ask_google === true) && esc.some(r => r.ask_google !== true) && esc.every(r => r.note === H3 + (r.ask_google === true ? 'Ask Google to read it in Search Console (it is on your list today).' : 'Ask Google to read it in Search Console (it comes onto your daily list as the pages before it are done).')),
      J(esc.map(r => [P(r.url), r.ask_google, r.note])));
    // day 23: Google crawls the Open edX hub (read and left out): it is no longer escalated
    const E = copy(D); const hub = '/capabilities/open-edx-services';
    row(E, hub).next_check_at = iso(T0 + 22 * DAY);
    const crawl = T0 + 22.5 * DAY;
    const x = await TA(() => devDay(E, T0 + 23 * DAY, { answer: (p) => p === hub ? insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(crawl) }) : null }));
    check('day 23, Google crawled the page: escalated_at and escalate_why are cleared (it is now "read and left out")', !x.__error && row(E, hub).cause === 'crawled_not_indexed' && row(E, hub).escalated_at === '' && row(E, hub).escalate_why === '' && S0(row(D, hub).escalated_at) !== '',
      J({ err: x.__error, c: row(E, hub).cause, e: row(E, hub).escalated_at, before: row(D, hub).escalated_at }));
    check('the escalated pages are counted in the run row (escalated) and the waiting ones are the rest', (days[22].run || {}).escalated === esc21.length && Number((days[20].run || {}).escalated) === 0, J([(days[22].run || {}).escalated, (days[20].run || {}).escalated]));
  });

  // =================================================================================================================================
  await guard('IXT2 escalate_why codes and wording', async () => {
    const SN = 'IXT2 (DESIGN_WAVE3 §2.2) each escalate_why code, the day-20 / day-21 edge, the anchor (published or first seen), the freeze wording for a short page, job postings are never "short"';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-12T05:15:00Z');
    const base = { url: DEV + '/insights/agentic-ai', domain: 'devaicon.com', state: 'not_indexed', cause: 'discovered_not_crawled', action: 'wait', last_crawl: '', in_sitemap: true,
      first_seen_at: iso(now - 30 * DAY), published_at: '', link_depth: 1, linked_n: 4, words: 900, asked_google_at: '' };
    const E = (o, c) => T(() => IX.escalation({ ...base, ...(o || {}) }, { now, dates_usable: true, freeze: { freeze: false }, ...(c || {}) }));
    const w = (o, c) => { const e = E(o, c); return e && e.on ? e.why.join(',') : (e && e.__error) || (e && e.on === false ? 'off' : J(e)); };
    check('20 days since first seen: not escalated; 21 days: escalated', w({ first_seen_at: iso(now - 20 * DAY) }) === 'off' && w({ first_seen_at: iso(now - 21 * DAY) }) === 'not_asked', J([w({ first_seen_at: iso(now - 20 * DAY) }), w({ first_seen_at: iso(now - 21 * DAY) })]));
    check('the anchor is published_at first (a page we wrote 10 days ago, first seen 40 days ago, is not escalated)', w({ published_at: iso(now - 10 * DAY), first_seen_at: iso(now - 40 * DAY) }) === 'off', w({ published_at: iso(now - 10 * DAY), first_seen_at: iso(now - 40 * DAY) }));
    check('never when Google crawled it, when it is indexed / excluded, or for another cause or action', ['off'].includes(w({ last_crawl: iso(now - 40 * DAY) })) && w({ state: 'indexed', cause: '' }) === 'off' && w({ cause: 'crawled_not_indexed', action: 'quality' }) === 'off' && w({ action: 'site_fix' }) === 'off', J([w({ last_crawl: iso(now - 40 * DAY) }), w({ cause: 'crawled_not_indexed', action: 'quality' })]));
    check('action links (no link found) is escalated too', w({ action: 'links', linked_n: 0, link_depth: 0 }) === 'not_asked,weak_links', w({ action: 'links', linked_n: 0, link_depth: 0 }));
    check('asked 5 days ago: none of the ask reasons; asked 15 days ago: asked_no_visit only; asked 40 days ago: not_asked and asked_no_visit',
      w({ asked_google_at: iso(now - 5 * DAY) }) === '' && w({ asked_google_at: iso(now - 15 * DAY) }) === 'asked_no_visit' && w({ asked_google_at: iso(now - 40 * DAY) }) === 'not_asked,asked_no_visit',
      J([w({ asked_google_at: iso(now - 5 * DAY) }), w({ asked_google_at: iso(now - 15 * DAY) }), w({ asked_google_at: iso(now - 40 * DAY) })]));
    check('weak_links: depth 2 with 3 pages, or the home page as the only link; not for depth 1 with 2+ pages', w({ link_depth: 2, linked_n: 3 }) === 'not_asked,weak_links' && w({ link_depth: 1, linked_n: 1 }) === 'not_asked,weak_links' && w({ link_depth: 1, linked_n: 2 }) === 'not_asked', J([w({ link_depth: 2, linked_n: 3 }), w({ link_depth: 1, linked_n: 1 })]));
    check('short_page under 300 words (our read), never a job posting, never an unread page (0 words)', w({ words: 120 }) === 'not_asked,short_page' && w({ words: 120, url: DEV + '/careers/data-engineer' }) === 'not_asked' && w({ words: 0 }) === 'not_asked',
      J([w({ words: 120 }), w({ words: 120, url: DEV + '/careers/data-engineer' })]));
    check('not_in_sitemap, sitemap_no_dates; all six in the contract\'s order', w({ in_sitemap: false }) === 'not_asked,not_in_sitemap' && w({ asked_google_at: iso(now - 40 * DAY), link_depth: 0, linked_n: 0, words: 100, in_sitemap: false }, { dates_usable: false }) === 'not_asked,asked_no_visit,weak_links,short_page,not_in_sitemap,sitemap_no_dates',
      w({ asked_google_at: iso(now - 40 * DAY), link_depth: 0, linked_n: 0, words: 100, in_sitemap: false }, { dates_usable: false }));
    check('a page the client marked fine to leave out is never escalated', w({ type_override: 'utility' }) === 'off', w({ type_override: 'utility' }));
    const note = (why, o, frz) => T(() => IX.noteOf({ ...base, escalated_at: iso(now - DAY), escalate_why: why, ...(o || {}) }, { now, freeze: frz ? { freeze: true, title: 'November 2026 core update', reason: 'x' } : { freeze: false } }));
    const H3 = 'Google has not visited this page in the 3 weeks we have watched it. ';
    check('note per first reason: asked_no_visit, weak_links (n pages), not_in_sitemap, sitemap_no_dates',
      note('asked_no_visit') === H3 + 'Google did not come even after you asked, so it does not see the page as important yet: link it from your home page or main menu, and get a link from another website.'
      && note('weak_links', { link_depth: 2, linked_n: 1 }) === H3 + 'Only 1 page(s) link here and your home page does not: link it from your home page or main menu.'
      && note('not_in_sitemap') === H3 + 'Add it to your sitemap.' && note('sitemap_no_dates') === H3 + 'Add the date each page last changed to your sitemap.',
      J([note('asked_no_visit'), note('weak_links', { link_depth: 2, linked_n: 1 }), note('not_in_sitemap'), note('sitemap_no_dates')]));
    check('short_page: the words, and during a Google update "... after Google\'s current update finishes." (the code stays)', note('short_page', { words: 180 }) === H3 + 'The page is short (180 words): add what a buyer needs to know.'
      && note('short_page', { words: 180 }, true) === H3 + 'The page is short (180 words): add what a buyer needs to know after Google\'s current update finishes.', J([note('short_page', { words: 180 }), note('short_page', { words: 180 }, true)]));
  });

  // =================================================================================================================================
  await guard('IXT3 ask Google daily to-do', async () => {
    const SN = 'IXT3 (DESIGN_WAVE3 §2.6) "ask Google" over 10 simulated days: at most 3 NEW marks a day, at most 10 in any 7 days, at most 5 marked at once; the page the client marked important first (even outside the sitemap), job postings last, utility pages never; kept marks spend nothing';
    begin(SN); const check = mkCheck(SN);
    const home = new Set(['/capabilities/infrastructure-enterprise-systems', '/capabilities/open-edx-services', '/industries/retail', '/industries/public-sector', '/industries/professional-services', '/whatwedo-ai']
      .map(p => IX.key(DEV + p)));
    const mk = (p, o) => ({ url: DEV + p, domain: 'devaicon.com', state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', in_sitemap: true, linked_by: J([DEV + '/']), title: '', sources: 'sitemap',
      ask_google: false, ask_google_at: '', asked_google_at: '', ...(o || {}) });
    const fresh = () => [mk('/capabilities/infrastructure-enterprise-systems'), mk('/capabilities/open-edx-services'), mk('/industries/retail'), mk('/industries/public-sector'), mk('/industries/professional-services'),
      mk('/insights/agentic-ai'), mk('/insights/value-driven-innovation-automation'), mk('/capabilities/open-edx-services/open-edx-hosting'), mk('/capabilities/open-edx-services/open-edx-development'),
      mk('/landing/ai-audit', { in_sitemap: false, linked_by: '', type_override: 'important' }),
      mk('/careers/data-engineer', { linked_by: J([DEV + '/careers']) }), mk('/careers/ai-ml-engineer', { linked_by: J([DEV + '/careers']) }),
      mk('/privacy', { cause: 'discovered_not_crawled' }), mk('/whatwedo-ai', { type_override: 'utility' })];   // a home-linked service page the client marked fine to leave out
    const t0 = Date.parse('2026-11-12T05:15:00Z');
    // (a) the client asks Google for every marked page the same day (the daily to-do): marks turn over
    let rows = fresh(); const log = [];
    for (let d = 0; d < 10; d++) {
      const now = t0 + d * DAY + (d % 3) * 7 * 60e3;   // the daily run drifts by a few minutes
      const n = T(() => IX.askGoogle(rows, { now, home_keys: home, freeze: { freeze: false } }));
      const marked = rows.filter(r => r.ask_google).map(r => P(r.url)); const newly = rows.filter(r => r.ask_google && r.ask_google_at === iso(now)).map(r => P(r.url));
      log.push({ d, n, marked, newly });
      rows = rows.map(r => ({ ...r, _prev: { ask_google: !!r.ask_google, ask_google_at: S0(r.ask_google_at) }, ...(r.ask_google ? { asked_google_at: iso(now + 3600e3) } : {}) }));
    }
    const allNew = log.flatMap(l => l.newly.map(p => ({ d: l.d, p })));
    check('at most 3 new marks every day, and the to-do is not empty while pages wait (3 on days 0-2)', log.every(l => l.newly.length <= 3) && log[0].newly.length === 3 && log[1].newly.length === 3 && log[2].newly.length === 3, J(log.map(l => [l.d, l.newly.length])));
    check('at most 10 new marks in any 7 days (day 3 gets the 10th, days 4-6 none)', [0, 1, 2, 3].every(s => allNew.filter(x => x.d >= s && x.d < s + 7).length <= 10) && log[3].newly.length === 1 && log.slice(4, 7).every(l => l.newly.length === 0), J(log.map(l => [l.d, l.newly])));
    check('the page the client marked important is first on day 0 (outside the sitemap, not linked)', log[0].newly[0] === '/landing/ai-audit' || (log[0].newly.includes('/landing/ai-audit')), J(log[0].newly));
    const jobDays = allNew.filter(x => /^\/careers\//.test(x.p)).map(x => x.d), contentDays = allNew.filter(x => !/^\/careers\//.test(x.p)).map(x => x.d);
    check('job postings are offered, and only after every other content page was marked (the last value tier)', jobDays.length === 2 && Math.min(...jobDays) >= Math.max(...contentDays) && contentDays.length === 10, J({ jobDays, contentDays }));
    check('never a utility page (/privacy), never a page the client marked fine to leave out (/whatwedo-ai, a service page linked from the home page)', !allNew.some(x => x.p === '/privacy' || x.p === '/whatwedo-ai'), J(allNew));
    // (b) the client does not ask: the marks stay, at most 5 at once, kept marks spend nothing
    let r2 = fresh(); const log2 = [];
    for (let d = 0; d < 4; d++) { const now = t0 + d * DAY; T(() => IX.askGoogle(r2, { now, home_keys: home, freeze: { freeze: false } }));
      log2.push({ d, marked: r2.filter(r => r.ask_google).length, newly: r2.filter(r => r.ask_google && r.ask_google_at === iso(now)).length });
      r2 = r2.map(r => ({ ...r, _prev: { ask_google: !!r.ask_google, ask_google_at: S0(r.ask_google_at) } })); }
    check('nobody asks Google: 3 the first day, 2 more the next (5 at once), then nothing new', J(log2.map(l => [l.marked, l.newly])) === J([[3, 3], [5, 2], [5, 0], [5, 0]]), J(log2));
  });

  // =================================================================================================================================
  await guard('IXT4 priority and do first', async () => {
    const SN = 'IXT4 (DESIGN_WAVE3 §2.7) priority 1..N on every page that should be in Google and is not: a fix seen / an improvement waiting first, then the ask value tier (important and home-linked service pages, articles, other content, job postings), impressions, depth, url; 0 for indexed, left out, utility, nothing to do; the top 5 are "do first"';
    begin(SN); const check = mkCheck(SN);
    const home = new Set(['/capabilities/infrastructure-enterprise-systems', '/industries/retail'].map(p => IX.key(DEV + p)));
    const mk = (p, o) => ({ url: DEV + p, domain: 'devaicon.com', state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', in_sitemap: true, linked_by: J([DEV + '/']), title: '', impressions_28d: 0, ...(o || {}) });
    const rows = [mk('/careers/data-engineer'), mk('/insights/agentic-ai', { impressions_28d: 2 }), mk('/insights/value-driven-innovation-automation', { impressions_28d: 9 }), mk('/about-devaicon'),
      mk('/capabilities/infrastructure-enterprise-systems'), mk('/industries/retail', { cause: 'canonical_elsewhere', action: 'site_fix', state: 'excluded', fix_seen_at: '2026-11-11T05:20:00Z' }),
      mk('/landing/ai-audit', { type_override: 'important' }), mk('/privacy', { cause: 'low_value', action: 'leave_out', state: 'excluded' }), mk('/cookies', { cause: 'discovered_not_crawled' }),
      mk('/whatwedo', { state: 'indexed', cause: '', action: 'none' }), mk('/x/not-checked', { state: 'error', cause: 'not_checked', action: 'none' }),
      mk('/insights/data-sovereign-asset', { type_override: 'utility', cause: 'low_value', action: 'leave_out', state: 'excluded' })];
    const n = T(() => IX.priorityRank(rows, { home_keys: home }));
    const order = rows.filter(r => r.priority > 0).sort((a, b) => a.priority - b.priority).map(r => P(r.url));
    check('the order: the fix seen, the important page, the home-linked service page, articles by impressions, other content, the job posting', J(order) === J(['/industries/retail', '/landing/ai-audit', '/capabilities/infrastructure-enterprise-systems',
      '/insights/value-driven-innovation-automation', '/insights/agentic-ai', '/about-devaicon', '/careers/data-engineer']), J({ n, order }));
    check('0 for indexed, left out, a policy page, a page marked fine to leave out, not checked', ['/whatwedo', '/privacy', '/cookies', '/x/not-checked', '/insights/data-sovereign-asset'].every(p => rows.find(r => P(r.url) === p).priority === 0), J(rows.map(r => [P(r.url), r.priority])));
    const df = T(() => IX.doFirst(rows, { freeze: { freeze: false } }));
    check('do first = the top 5, each with a plain reason', Array.isArray(df) && df.length === 5 && J(df.map(x => P(x.url))) === J(order.slice(0, 5)) && df.every(x => S0(x.why).length > 5) && df[0].why === 'Fixed on your site: waiting for Google to read it again.', J(df));
    // end to end: devaicon's rows carry a priority, the escalated pages among them
    const pr = D.stored.filter(r => Number(r.priority) > 0);
    check('devaicon end to end: every waiting page has a priority, indexed and policy pages 0, priorities 1..N with no gap', pr.length >= 13 && J(pr.map(r => r.priority).sort((a, b) => a - b)) === J(pr.map((_, i) => i + 1))
      && ['/', '/whatwedo', '/privacy', '/cookies'].every(p => Number(row(D, p).priority) === 0), J(D.stored.map(r => [P(r.url), r.priority])));
    check('devaicon: the capability pages linked from the home page come before the insights, the job pages last', (() => { const pp = (p) => Number(row(D, p).priority);
      return pp('/capabilities/infrastructure-enterprise-systems') < pp('/insights/agentic-ai') && JOBS.every(j => pp(j) > pp('/insights/agentic-ai')); })(), J(D.stored.filter(r => r.priority > 0).map(r => [P(r.url), r.priority])));
  });

  // =================================================================================================================================
  await guard('IXT5 overrides kept', async () => {
    const SN = 'IXT5 (DESIGN_WAVE3 §2.4) type_override is written by the app only: "important" makes /privacy an ordinary page again (its cause from Google\'s reading, ranked, offered to ask Google), "utility" leaves an insights page out ("You marked this page as fine to leave out of Google.", never escalated, never asked, never sent to IndexNow); the engine writes back exactly what it read, over two runs';
    begin(SN); const check = mkCheck(SN);
    const E = copy(D);
    row(E, '/privacy').type_override = 'important'; row(E, '/insights/agentic-ai').type_override = 'utility';   // the app's writes, between two runs
    const now = T0 + 23 * DAY;
    const x1 = await TA(() => devDay(E, now, { key: KEY }));
    const pv = row(E, '/privacy'), ag = row(E, '/insights/agentic-ai');
    check('"important": /privacy is no longer a policy page left out - Google read it and left it out (crawled_not_indexed, improve it), ranked', !x1.__error && pv.cause === 'crawled_not_indexed' && pv.action === 'quality' && Number(pv.priority) > 0, J({ err: x1.__error, c: pv.cause, a: pv.action, p: pv.priority, n: pv.note }));
    check('"utility": low_value, leave_out, "You marked this page as fine to leave out of Google.", not escalated, not marked, priority 0', ag.cause === 'low_value' && ag.action === 'leave_out' && ag.note === 'You marked this page as fine to leave out of Google.' && ag.escalated_at === '' && ag.ask_google === false && Number(ag.priority) === 0,
      J({ c: ag.cause, a: ag.action, n: ag.note, e: ag.escalated_at, m: ag.ask_google }));
    check('the rows written carry the app\'s values unchanged; no other row gains an override', (x1.rows || []).filter(r => ['/privacy', '/insights/agentic-ai'].includes(P(r.url))).length === 2
      && (x1.rows || []).every(r => S0(r.type_override) === ({ '/privacy': 'important', '/insights/agentic-ai': 'utility' }[P(r.url)] || '')), J((x1.rows || []).map(r => [P(r.url), r.type_override])));
    check('a page marked fine to leave out is not sent to IndexNow', !(x1.posts[0] || { urls: [] }).urls.includes(DEV + '/insights/agentic-ai') && (x1.posts[0] || { urls: [] }).urls.length > 0, J((x1.posts[0] || {}).urls));
    const x2 = await TA(() => devDay(E, now + DAY));
    const ag2 = { action: row(E, '/insights/agentic-ai').action };
    check('the second run: both overrides as the app wrote them, the outcomes unchanged', !x2.__error && row(E, '/privacy').type_override === 'important' && row(E, '/insights/agentic-ai').type_override === 'utility' && row(E, '/insights/agentic-ai').action === 'leave_out' && row(E, '/privacy').action === 'quality',
      J([row(E, '/privacy').type_override, row(E, '/insights/agentic-ai').type_override, row(E, '/privacy').action]));
    row(E, '/insights/agentic-ai').type_override = '';   // "Undo" in the app
    const x3 = await TA(() => devDay(E, now + 2 * DAY));
    const ag3 = row(E, '/insights/agentic-ai');
    check('undone (""): the rules decide again the same day - left out yesterday, waiting for Google today (its cause from Google\'s stored reading), re-inspected on the next run; the override stays ""',
      !x3.__error && ag2.action === 'leave_out' && ag3.type_override === '' && ag3.action === 'wait' && /^(unknown_to_google|discovered_not_crawled)$/.test(S0(ag3.cause)) && Date.parse(ag3.next_check_at) <= now + 2 * DAY, J({ before: ag2, c: ag3.cause, a: ag3.action, t: ag3.type_override, nc: ag3.next_check_at }));
  });

  // =================================================================================================================================
  await guard('IXT6 IndexNow plan', async () => {
    const SN = 'IXT6 (DESIGN_WAVE3 §2.3) IndexNow: which pages (never sent, changed since sent, not sent by AI Growth in 30 days, opens, not left out / noindex / redirect / gone), the cap of 500, one POST a day; through the nodes: no key, a key file answering something else, a dry run, a 200 (indexnow_at on every page sent, also on pages that did not change otherwise), a 4xx (nothing recorded, one note line), never a retry of a 4xx';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-12T05:15:00Z');
    const mk = (p, o) => ({ url: DEV + p, domain: 'devaicon.com', state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', in_sitemap: true, http_status: 200, final_url: '', noindex: '', indexnow_at: '', priority: 0, ...(o || {}) });
    const C = (rows, ai) => T(() => IX.indexnowCandidates(rows, { now, host: 'devaicon.com', ai_sent: new Map(Object.entries(ai || {}).map(([p, t]) => [IX.key(DEV + p), t])) }));
    const has = (rows, p, ai) => { const c = C(rows, ai); return Array.isArray(c) && c.includes(DEV + p); };
    check('never sent, opens, should be found -> sent', has([mk('/a')], '/a'), J(C([mk('/a')])));
    check('already sent and unchanged -> not again; lastmod / an improvement / a fix newer than the send -> again', !has([mk('/a', { indexnow_at: iso(now - 5 * DAY) })], '/a')
      && has([mk('/a', { indexnow_at: iso(now - 5 * DAY), sitemap_lastmod: iso(now - 2 * DAY) })], '/a') && has([mk('/a', { indexnow_at: iso(now - 5 * DAY), improved_at: iso(now - DAY) })], '/a')
      && has([mk('/a', { indexnow_at: iso(now - 5 * DAY), fix_seen_at: iso(now - DAY) })], '/a'), '');
    check('AI Growth sent it 5 days ago -> not sent; 40 days ago -> sent', !has([mk('/a')], '/a', { '/a': iso(now - 5 * DAY) }) && has([mk('/a')], '/a', { '/a': iso(now - 40 * DAY) }), '');
    check('never a page left out, noindex, a redirect, gone (404 / 410), answering 5xx, on another host; a page not read is sent only when indexed or in the sitemap',
      !has([mk('/a', { action: 'leave_out', cause: 'low_value' })], '/a') && !has([mk('/a', { noindex: 'meta' })], '/a') && !has([mk('/a', { cause: 'redirect', action: 'site_fix', final_url: DEV + '/b' })], '/a')
      && !has([mk('/a', { cause: 'not_found', http_status: 404 })], '/a') && !has([mk('/a', { http_status: 503 })], '/a') && !(C([mk('/a', { url: 'https://www.devaicon.com/a' })]) || ['x']).length
      && has([mk('/a', { http_status: 0, in_sitemap: true })], '/a') && !has([mk('/a', { http_status: 0, in_sitemap: false })], '/a') && has([mk('/a', { http_status: 0, in_sitemap: false, state: 'indexed', cause: '', action: 'none' })], '/a'), '');
    const many = Array.from({ length: 600 }, (_, i) => mk('/p' + i));
    check('at most 500 URLs a site a run', (C(many) || []).length === 500, (C(many) || []).length);
    check('one POST a site a day: a list accepted 3 hours ago -> nothing today', T(() => IX.indexnowSentRecently([mk('/a', { indexnow_at: iso(now - 3 * 3600e3) })], now)) === true && T(() => IX.indexnowSentRecently([mk('/a', { indexnow_at: iso(now - 26 * 3600e3) })], now)) === false, '');
    // through the generated nodes
    const day = T0 + 23 * DAY;
    const nokey = await TA(() => devDay(copy(D), day));
    check('no key (AI Growth made none): no GET, no POST, indexnow_sent 0, the run note says why once', !nokey.__error && nokey.keyGets.length === 0 && nokey.posts.length === 0 && (nokey.run || {}).indexnow_sent === 0
      && (S0((nokey.run || {}).note).match(/IndexNow is not set up for this website yet/g) || []).length === 1 && (SJ(nokey.run).indexnow || {}).status === 'no_key', J({ err: nokey.__error, run: nokey.run && { s: nokey.run.indexnow_sent, n: nokey.run.note } }));
    const wrong = await TA(() => devDay(copy(D), day, { key: KEY, keyAnswer: () => ({ statusCode: 200, headers: {}, data: 'something else' }) }));
    check('the key file answers something else: one GET of https://devaicon.com/<key>.txt, no POST, "did not answer with the key"', !wrong.__error && J(wrong.keyGets) === J([DEV + '/' + KEY + '.txt']) && wrong.posts.length === 0 && /did not answer with the key/.test(S0((wrong.run || {}).note)), J({ err: wrong.__error, g: wrong.keyGets, p: wrong.posts.length }));
    const moved = await TA(() => devDay(copy(D), day, { key: KEY, keyAnswer: () => ({ statusCode: 301, headers: { location: 'https://www.devaicon.com/' + KEY + '.txt' }, data: '' }) }));
    check('a key file that redirects is not verified (no POST)', !moved.__error && moved.posts.length === 0 && (SJ(moved.run).indexnow || {}).status === 'key_not_verified', J(SJ(moved.run).indexnow));
    const dry = await TA(() => devDay(copy(D), day, { key: KEY, dry: true }));
    check('a dry run: no POST, "Test run: nothing was sent to IndexNow (N page(s) would have been)."', !dry.__error && dry.posts.length === 0 && /^.*Test run: nothing was sent to IndexNow \(\d+ page\(s\) would have been\)\./.test(S0((dry.run || {}).note)) && (dry.run || {}).indexnow_sent === 0, J({ err: dry.__error, n: (dry.run || {}).note }));
    const E = copy(D);
    const AIP = [{ site_id: SITE.site_id, url: DEV + '/capabilities/intelligent-systems-data', submitted_at: iso(day - 5 * DAY) }];   // AI Growth's key page, sent 5 days ago
    const ok = await TA(() => devDay(E, day, { key: KEY, aiPages: AIP }));
    const post = ok.posts[0] || {}; const urls = post.urls || [];
    check('one POST to IndexNow with { host, key, keyLocation, urlList }: devaicon\'s pages that open and should be found, the waiting pages included', !ok.__error && ok.posts.length === 1 && post.url === 'https://api.indexnow.org/indexnow' && post.body && post.body.host === 'devaicon.com' && post.body.key === KEY
      && post.body.keyLocation === DEV + '/' + KEY + '.txt' && J(post.body.urlList) === J(urls) && WAIT13.every(p => urls.includes(DEV + p)), J({ err: ok.__error, n: ok.posts.length, url: post.url, urls }));
    check('never a policy page left out, never a redirect / an alternate, never the page AI Growth sent 5 days ago', urls.length > 0 && !urls.some(u => /\/(privacy|cookies|security)$/.test(u)) && !urls.includes(DEV + '/capabilities/intelligent-systems-data') && !urls.includes(DEV + '/industries/bfsi'), J(urls));
    check('pages Google does not have first', urls.length > 0 && (() => { const firstIndexed = urls.findIndex(u => row(E, P(u)).state === 'indexed'); return firstIndexed < 0 || urls.slice(firstIndexed).every(u => row(E, P(u)).state === 'indexed'); })(), J(urls.map(u => [P(u), row(E, P(u)).state])));
    check('200: indexnow_at = the run on every page sent (also a page that did not change otherwise), indexnow_sent in the run row, the note', urls.every(u => row(E, P(u)).indexnow_at === iso(day)) && (ok.run || {}).indexnow_sent === urls.length
      && /We told Bing and the other IndexNow search engines about \d+ page\(s\) today/.test(S0((ok.run || {}).note)), J({ s: (ok.run || {}).indexnow_sent, at: urls.slice(0, 3).map(u => row(E, P(u)).indexnow_at) }));
    const next = await TA(() => devDay(E, day + DAY, { key: KEY, aiPages: AIP }));
    check('the next day: nothing new, no POST (each page is sent once, and again only when it changes)', !next.__error && next.posts.length === 0 && (SJ(next.run).indexnow || {}).status === 'nothing_new', J({ err: next.__error, p: next.posts.length, s: SJ(next.run).indexnow }));
    const E2 = copy(D);
    const bad = await TA(() => devDay(E2, day, { key: KEY, inAnswer: () => ({ statusCode: 422, headers: {}, data: 'Unprocessable Entity' }) }));
    check('422: nothing recorded (no indexnow_at), indexnow_sent 0, one note line "IndexNow did not accept"', !bad.__error && bad.posts.length === 1 && E2.stored.every(r => !S0(r.indexnow_at)) && (bad.run || {}).indexnow_sent === 0 && /IndexNow did not accept our list of \d+ page\(s\) today \(answered 422\)/.test(S0((bad.run || {}).note)),
      J({ err: bad.__error, n: (bad.run || {}).note }));
    const W = T(() => JSON.parse(fs.readFileSync(path.join(__dirname, 'index_wiring.json'), 'utf8'))) || {};
    const ix = W.indexnow || {};
    check('the POST node: neverError + fullResponse (a 4xx is an answer, never retried, never a failed run), onError continue, retried 3x only when the call did not get through; fed only by its IF; the key file fetched without following a redirect; the kill switch baked "on"',
      ix.post === 'Submit IndexNow (Index)' && J(ix.from) === J(['Submit IndexNow (Index)']) && ix.response && ix.response.neverError === true && ix.response.fullResponse === true && ix.on_error === 'continueRegularOutput'
      && ix.retry && ix.retry.maxTries === 3 && J(ix.key_redirect) === J({ redirect: { followRedirects: false } }) && ix.kill_switch === 'on' && /const KILL_OFF = 'on' === 'off';/.test(src('IndexNow Key Check (Index)')), J(ix));
    const reach = (starts, blocked) => { const C2 = W.connections || {}; const seen = new Set(), todo = [...starts]; while (todo.length) { const n = todo.pop(); if (seen.has(n) || (blocked || []).includes(n)) continue; seen.add(n); todo.push(...(C2[n] || []).flat()); } return seen; };
    check('IndexNow is reached only after the run ledger reserves, and writes no table', !reach(['Daily Schedule', 'Manual Run'], ['Reserve Run Ledger (Index)']).has('Submit IndexNow (Index)') && reach(['Daily Schedule', 'Manual Run']).has('Submit IndexNow (Index)')
      && Object.keys(W.writes || {}).every(t => (W.own_tables || []).includes(t) || (W.shared_tables || []).includes(t)), J(Object.keys(W.writes || {})));
  });

  // =================================================================================================================================
  await guard('IXT7 sitemap dates, robots, links', async () => {
    const SN = 'IXT7 (DESIGN_WAVE3 §2.1 / §2.5) the sitemap\'s dates (urls, with_lastmod, distinct; "no usable dates" rule) in seo_index_runs.sitemaps_json.dates; robots_ok per page (yes / no / "" not read); link_depth and linked_n, kept on a day the home page cannot be read';
    begin(SN); const check = mkCheck(SN);
    const SD = (u) => T(() => IX.sitemapDates(u)); const U = (d) => T(() => IX.datesUsable(d));
    const urls = (n, f) => Array.from({ length: n }, (_, i) => ({ loc: DEV + '/p' + i, lastmod: f ? f(i) : '' }));
    check('devaicon 2026-11-12 (30 URLs, no lastmod): { urls 30, with_lastmod 0, distinct 0 }, not usable', J(SD(urls(30))) === J({ urls: 30, with_lastmod: 0, distinct: 0 }) && U(SD(urls(30))) === false, J(SD(urls(30))));
    check('the rule: < 5 URLs always usable; < 50% with lastmod not; 10+ URLs on one date not; real dates usable', U({ urls: 4, with_lastmod: 0, distinct: 0 }) === true && U({ urls: 30, with_lastmod: 11, distinct: 7 }) === false
      && U(SD(urls(12, () => '2026-11-01T00:00:00Z'))) === false && U(SD(urls(8, () => '2026-11-01'))) === true && U(SD(urls(12, (i) => '2026-10-' + String(10 + i).padStart(2, '0')))) === true, '');
    const run = days[22] && days[22].run; const j = SJ(run);
    check('end to end: the run row carries sitemaps_json.dates = { urls: 30, with_lastmod: 0, distinct: 0, usable: false }', j.dates && j.dates.urls === 30 && j.dates.with_lastmod === 0 && j.dates.distinct === 0 && j.dates.usable === false, J(j.dates));
    const E = copy(D);
    const x = await TA(() => devDay(E, T0 + 23 * DAY, { sitemap: SITEMAP_1030 }));
    check('the 2026-10-30 sitemap (11 of 30 with a lastmod, 7 days): still not usable (36%)', !x.__error && SJ(x.run).dates && SJ(x.run).dates.with_lastmod === 11 && SJ(x.run).dates.usable === false, J(SJ(x.run).dates));
    check('robots_ok: "yes" for devaicon\'s pages (its robots.txt allows them), the column on every row', D.stored.filter(r => r.state !== 'unknown').every(r => r.robots_ok === 'yes'), J(D.stored.map(r => [P(r.url), r.robots_ok])));
    check('control: robots_ok "no" for a path its robots.txt disallows (Googlebot rules: /insights/preview/)', T(() => IX.robotsAllows(ROBOTS, 200, '/insights/preview/x')) === false && T(() => IX.robotsAllows(ROBOTS, 200, '/insights/agentic-ai')) === true, '');
    check('link_depth: 1 for the capability pages (home page), 2 for the job pages (from /careers, which the home page links); linked_n counted', row(D, '/capabilities/infrastructure-enterprise-systems').link_depth === 1 && JOBS.every(p => row(D, p).link_depth === 2)
      && Number(row(D, '/capabilities/infrastructure-enterprise-systems').linked_n) >= 2 && Number(row(D, '/careers/data-engineer').linked_n) >= 1, J([row(D, '/capabilities/infrastructure-enterprise-systems').linked_n, row(D, '/careers/data-engineer').link_depth, row(D, '/careers/data-engineer').linked_n]));
    const E2 = copy(D);
    const y = await TA(() => devDay(E2, T0 + 23 * DAY, { homeDown: true }));
    check('a day the home page cannot be read: link_depth / linked_n kept, the escalation reasons unchanged', !y.__error && row(E2, '/careers/data-engineer').link_depth === 2 && row(E2, '/capabilities/infrastructure-enterprise-systems').link_depth === 1
      && row(E2, '/careers/data-engineer').escalate_why === row(D, '/careers/data-engineer').escalate_why, J({ err: y.__error, d: row(E2, '/careers/data-engineer').link_depth, w: row(E2, '/careers/data-engineer').escalate_why }));
  });

  // =================================================================================================================================
  await guard('IXT8 weekly summary', async () => {
    const SN = 'IXT8 (DESIGN_WAVE3 §2.8) the callback summary (waiting, escalated, asked_waiting, read_after_ask_7d, indexnow_sent, do_first, sitemap_dates) and one short to-do block in report_markdown; the run row\'s escalated / asked_waiting / indexnow_sent';
    begin(SN); const check = mkCheck(SN);
    const E = copy(D); const now = T0 + 23 * DAY;
    // the client asked Google about two pages: one 3 days ago that Google read since, one 9 days ago it has not
    const a = row(E, '/capabilities/open-edx-services'); a.asked_google_at = iso(now - 3 * DAY); a.next_check_at = iso(now - 3600e3);
    const b = row(E, '/insights/agentic-ai'); b.asked_google_at = iso(now - 9 * DAY);
    const x = await TA(() => devDay(E, now, { key: KEY, onDemand: true, answer: (p) => p === '/capabilities/open-edx-services' ? insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: iso(now - DAY) }) : null }));
    const sm = (x.report || {}).summary || {};
    check('control: the on-demand run sent its report', !x.__error && !!x.report, J(x.__error));
    check('summary: waiting (not escalated) + escalated = the pages Google has not visited; escalated counted', Number.isFinite(sm.waiting) && sm.escalated >= 12 && sm.waiting + sm.escalated === E.stored.filter(r => r.action === 'wait' && /^(unknown_to_google|discovered_not_crawled)$/.test(S0(r.cause)) && !S0(r.fix_seen_at)).length, J({ w: sm.waiting, e: sm.escalated }));
    check('summary: asked_waiting 1 (asked 9 days ago, not read), read_after_ask_7d 1 (read the day after its ask)', sm.asked_waiting === 1 && sm.read_after_ask_7d === 1, J({ a: sm.asked_waiting, r: sm.read_after_ask_7d, row: [b.asked_google_at, row(E, '/capabilities/open-edx-services').google_read_after_ask_at] }));
    check('summary: indexnow_sent (this run), do_first (5, { url, why }), sitemap_dates', sm.indexnow_sent === (x.run || {}).indexnow_sent && sm.indexnow_sent > 0 && Array.isArray(sm.do_first) && sm.do_first.length === 5 && sm.do_first.every(d => S0(d.url) && S0(d.why))
      && sm.sitemap_dates && sm.sitemap_dates.usable === false, J({ s: sm.indexnow_sent, d: sm.do_first, sd: sm.sitemap_dates }));
    check('the run row: escalated, asked_waiting, indexnow_sent (exact seo_index_runs columns)', (() => { const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'index_wiring.json'), 'utf8')); return J(Object.keys(x.run).sort()) === J(W.run_cols.slice().sort()) && ['escalated', 'asked_waiting', 'indexnow_sent'].every(c => W.run_cols.includes(c)); })()
      && x.run.escalated === sm.escalated && x.run.asked_waiting === 1, J(x.run && Object.keys(x.run)));
    const md = S0((x.report || {}).report_markdown);
    check('report_markdown: one "## Your to-do" block - not visited (and the 3-week ones), the asks, Bing, the sitemap dates, "Do first" 1-5', /## Your to-do\n- Google has not visited \d+ page\(s\) yet; \d+ of them in the 3 weeks or more/.test(md) && /You asked Google about 1 page\(s\) it has not read yet\. Google read 1 page\(s\) in the last 7 days after you asked\./.test(md)
      && /- We told Bing and the other IndexNow search engines about \d+ page\(s\) today\./.test(md) && /- Your sitemap does not give the date each page last changed/.test(md) && /- Do first:\n  1\. https:\/\/devaicon\.com\/[^\n]+\n  2\./.test(md) && (md.match(/## Your to-do/g) || []).length === 1, md.slice(0, 1400));
    check('no dash, curly quote or ellipsis in the new copy', md.includes('## Your to-do') && !/[—–‘’“”…]/.test(md), md.match(/[—–‘’“”…]/g));
  });

  // =================================================================================================================================
  await guard('IXT9 columns', async () => {
    const SN = 'IXT9 (DESIGN_WAVE3 §2.1) the new columns: seo_index_pages priority / escalated_at / escalate_why / type_override / robots_ok / link_depth / linked_n / indexnow_at, seo_index_runs escalated / asked_waiting / indexnow_sent; IX.PAGE_COLS equals the table; every written row has exact columns';
    begin(SN); const check = mkCheck(SN);
    const W = T(() => JSON.parse(fs.readFileSync(path.join(__dirname, 'index_wiring.json'), 'utf8'))) || {};
    const PC = ['priority', 'escalated_at', 'escalate_why', 'type_override', 'robots_ok', 'link_depth', 'linked_n', 'indexnow_at'];
    check('seo_index_pages has the 8 new columns, last, in the contract\'s order; IX.PAGE_COLS equals the table', J((W.page_cols || []).slice(-8)) === J(PC) && J(T(() => IX.PAGE_COLS)) === J(W.page_cols), J((W.page_cols || []).slice(-9)));
    check('seo_index_runs has escalated, asked_waiting, indexnow_sent', ['escalated', 'asked_waiting', 'indexnow_sent'].every(c => (W.run_cols || []).includes(c)), J((W.run_cols || []).slice(-4)));
    const rows = (days[21] || {}).rows || [];
    check('every row Index Page Rows wrote has exactly the table\'s columns', rows.length > 0 && (W.page_cols || []).includes('indexnow_at') && rows.every(r => J(Object.keys(r)) === J(W.page_cols)), J(Object.keys(rows[0] || {})));
    check('type_override / robots_ok take only their contract values', D.stored.some(r => r.robots_ok === 'yes') && D.stored.every(r => ['', 'important', 'utility'].includes(S0(r.type_override)) && ['', 'yes', 'no'].includes(S0(r.robots_ok))), J(D.stored.map(r => [r.type_override, r.robots_ok])));
    const lc = T(() => fs.readFileSync(path.join(__dirname, '..', 'ladder_common.py'), 'utf8')) || '';
    check('ladder_common.py declares them (sync_tables.py adds them to the live tables on deploy)', /\('priority', 'number'\), \('escalated_at', 'string'\), \('escalate_why', 'string'\), \('type_override', 'string'\), \('robots_ok', 'string'\),\s*\('link_depth', 'number'\), \('linked_n', 'number'\), \('indexnow_at', 'string'\)\]/.test(lc)
      && /\('escalated', 'number'\), \('asked_waiting', 'number'\), \('indexnow_sent', 'number'\)\]/.test(lc), '');
    if (process.env.OUT_DIR) try { fs.writeFileSync(path.join(process.env.OUT_DIR, 'index_wave3_devaicon_rows.json'), JSON.stringify(D.stored.map(r => ({ url: r.url, state: r.state, cause: r.cause, action: r.action, priority: r.priority, escalated_at: r.escalated_at,
      escalate_why: r.escalate_why, link_depth: r.link_depth, linked_n: r.linked_n, robots_ok: r.robots_ok, ask_google: r.ask_google, note: r.note })), null, 1)); } catch (e) { /* the sample is optional */ }
  });
};

if (require.main === module) {
  const results = [];
  const H = { results, save: () => {} };
  const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log('   !! scenario "' + name + '" aborted at: ' + String(e && e.message || e)); results.push({ scenario: name, node: 'scenario aborted', ok: false }); } };
  const begin = (sn) => { console.log('\n########## ' + sn + ' ##########'); };
  module.exports({ H, guard, begin }).then(() => { const f = results.filter(r => !r.ok).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); });
}
