// IXI1-IXI4 (Index coverage, client report 2026-11-05, devaicon.com): "I improved these pages (re-written by Alaventra), published the improved
// versions and reported them with the publish check, but Indexing still lists them under 'Google read it and left it out' with 'Improve this
// page'". Google decides again only after it reads the page again (RESEARCH.md §B), so the page is never called indexed by us; it is
// "improved, waiting for Google" (action wait, own report group, inspected half a day / 3 / 7 / 14 / 28 days after the improvement, "ask
// Google" eligible) until Google's last crawl is newer than the improvement, then in search or "Google read your improved version and still
// left it out" (its own action back). An improvement keeps the page in its lane (before: the content-log row made it `ours` and moved it to the
// new-pages lane with "Improve this page" still offered). Each check runs the GENERATED nodes (harness/code_v4) over several days with a
// pinned clock, and fails on the code before this change (1a13ec42).
// Called from scenarios_v5.js after scenarios_index_wave2.js; also runs on its own with CODE_DIR=<code_v4>.
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
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
    const $ = (n) => { if (!(n in mocks)) throw new Error('Referenced node "' + n + '" has no data in this run'); const a = mocks[n].map(j => (j && j.json !== undefined && Object.keys(j).every(k => k === 'json' || k === 'binary')) ? j : { json: j }); return { all: () => a, first: () => a[0], last: () => a[a.length - 1], get item() { return a[0]; } }; };
    const items = (input || [{ json: {} }]).map(j => (j && j.json !== undefined) ? j : { json: j });
    const $input = { all: () => items, first: () => items[0], last: () => items[items.length - 1], get item() { return items[0]; } };
    const RealDate = Date;
    const D = class extends RealDate { constructor(...a) { if (!a.length) super(now); else super(...a); } static now() { return now; } };
    const thisArg = { helpers: { getBinaryDataBuffer: async () => { throw new Error('no binary'); } } };
    const f = new AsyncF('$', '$input', '$execution', 'URL', 'structuredClone', 'Date', code);
    const out = await f.call(thisArg, $, $input, { id: '4242' }, undefined, undefined, now ? D : Date);
    return (out || []).map(o => o.json);
  };
  const W = 'https://www.example.com';
  const SITE0 = { site_id: 'site_example-com', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com' }; const SITE = SITE0;
  const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: '', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL', ...o } } });
  const LEFT_OUT = (crawl) => insp({ coverageState: 'Crawled - currently not indexed', lastCrawlTime: crawl });
  const PASS = (crawl) => insp({ verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: crawl });
  const HTML = () => '<html><head><title>Banking and financial services technology</title></head><body><main>' + 'words '.repeat(600) + '</main></body></html>';
  const OK200 = () => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: HTML() });

  // ---- one website, one day, through the generated nodes; `st` = { stored, history, log } as n8n's tables would hold them ----
  const siteDay = async (st, now, o) => {
    const opt = o || {}; const M = {}; const SITE = opt.site || SITE0;
    M['Index Sites'] = [{ ...SITE, gsc_connected: true, cap: 300, used_today: 0, run_at: iso(now), quota_hit: false, prev_complete: true, prev_complete_at: iso(now - DAY), home_host_prev: SITE.canonical_host, on_demand: false }];
    M['Load Index Pages'] = st.stored.length ? st.stored.map(r => ({ ...r })) : [{}];
    M['Load Pages (Index)'] = [{}]; M['Load Page Watch (Index)'] = [{}];
    M['Load Content Log (Index)'] = (st.log || []).length ? st.log.map(r => ({ ...r })) : [{}];
    const urls = (opt.sitemap || []).map(loc => ({ loc, lastmod: '' }));
    M['Sitemap Read 3'] = [{ site_id: SITE.site_id, urls, read: 1, sets: 1, fetched: [SITE.domain + '/sitemap.xml'], next: [], errors: [], robots_status: 200, robots_txt: 'User-agent: *\nAllow: /\n', home_host: SITE.canonical_host, home_links: [] }];
    M['Pages Query Requests'] = [{ skip: true }]; M['Pages Query More'] = [{ skip: true }]; M['GSC Sitemaps List'] = [{}]; M['Sitemaps List Requests'] = [{ skip: true }];
    M['Google Events'] = [{ freeze: { freeze: false }, started: [], completed: [], events: [] }];
    const inv = await node('Index Inventory', M, null, now); M['Index Inventory'] = inv;
    const res = await node('Index Reservation', M, null, now); M['Save Index Reservation'] = res.filter(r => !r.skip).map((r, i) => ({ id: 1 + i, ...r }));
    const pr = await node('Index Probe Requests', M, null, now); M['Index Probe Requests'] = pr;
    const asked = [];
    const answer = (u) => { asked.push(u); return opt.answer ? opt.answer(u, now) : PASS(iso(now - DAY)); };
    M['Inspect URL (Probe)'] = pr.filter(q => !q.skip).map(q => answer(q.inspect_url));
    const ir = await node('Index Inspect Requests', M, null, now); M['Index Inspect Requests'] = ir;
    M['Inspect URL (Index)'] = ir.filter(q => !q.skip).map(q => answer(q.inspect_url));
    if (has('Inspect Retry Requests')) { M['Inspect Retry Requests'] = [{ skip: true }]; M['Inspect URL (Retry)'] = []; }
    const fr = await node('Page Fetch Requests', M, null, now); M['Page Fetch Requests'] = fr;
    if (fr.some(q => !q.skip)) {
      M['Fetch Page (Index)'] = fr.filter(q => !q.skip).map(q => opt.fetch ? opt.fetch(q.url, now) : OK200());
      if (has('Page First Reads')) M['Page First Reads'] = await node('Page First Reads', M, M['Fetch Page (Index)'], now);
    }
    const hr = await node('Fetch Hop Requests', M, null, now); M['Fetch Hop Requests'] = hr;
    if (!hr[0].skip) M['Fetch Page (Final)'] = hr.map(() => OK200());
    M['Page Signals'] = await node('Page Signals', M, M['Fetch Page (Final)'] || null, now);
    const dg = await node('Index Diagnose', M, null, now); M['Index Diagnose'] = dg;
    const rows = (await node('Index Page Rows', M, null, now)).filter(r => !r.skip);
    for (const r of rows) { const m = st.stored.filter(x => x.site_id === r.site_id && x.url === r.url); if (m.length) m.forEach(x => Object.assign(x, r)); else st.stored.push({ ...r }); }
    // the client's report text (sent on Mondays): the same function Index Report calls, over this run's rows
    const all = (dg[0] || {}).all || [];
    const report = S0(T(() => IX.reportMarkdown({ domain: SITE.domain }, IX.summarize(all, {}), { quota_cap: 300 }, { rows: all })));
    return { inv: inv[0], dg: dg[0], rows, asked, report };
  };
  const rowAt = (st, re) => st.stored.find(r => re.test(r.url)) || null;
  const PAGE = W + '/industries/bfsi';
  // the stored reading of 2 Nov: Google read the page on 30 Oct and left it out; next check due 9 Nov (the usual 7 days)
  const leftOut = () => ({ site_id: SITE.site_id, domain: 'example.com', url: PAGE, lane: 'existing', sources: 'sitemap', in_sitemap: true, first_seen_at: '2026-10-29T05:15:00.000Z',
    state: 'not_indexed', evidence: 'inspection', cause: 'crawled_not_indexed', action: 'quality', verdict: 'NEUTRAL', coverage: 'Crawled - currently not indexed', page_fetch_state: 'SUCCESSFUL',
    last_crawl: '2026-10-30T08:00:00.000Z', inspect_at: '2026-11-02T05:20:00.000Z', next_check_at: '2026-11-09T05:20:00.000Z', checks: 1, title: 'Banking and financial services technology', linked_by: '' });
  // the content-log row the improve run + publish check leave: the address it improved (the bare host, a trailing slash) is the published one
  const improvedLog = (at) => ({ site_id: SITE.site_id, domain: 'example.com', keyword: 'banking & financial services technology', source: 'manual', existing_page_url: 'https://example.com/industries/bfsi/',
    status: 'published', published_url: 'https://www.example.com/industries/bfsi', published_at: at, started_at: '2026-11-02T13:37:00.000Z' });
  const REPORTED = '2026-11-04T12:09:00.000Z';
  const D5 = Date.parse('2026-11-05T05:15:00Z');

  // =================================================================================================================================
  await guard('IXI1 improved page waits for Google, then Google decides', async () => {
    const SN = 'IXI1 (client report 2026-11-05) a page Google left out that the client improved and reported published: the next run calls it "improved, waiting for Google" (no Improve button, its own lane kept, inspected again within the day, next check brought forward, "ask Google" eligible); when Google reads the new version it is in search, or back to its own action with a note that Google read the improved version';
    begin(SN); const check = mkCheck(SN);
    const st = { stored: [leftOut()], history: [], log: [improvedLog(REPORTED)] };
    // day 1 (5 Nov 05:15): Google still has its reading of 30 Oct (it has not crawled the new version)
    const d1 = await TA(() => siteDay(st, D5, { sitemap: [PAGE], answer: () => LEFT_OUT('2026-10-30T08:00:00Z') }));
    const r1 = rowAt(st, /bfsi/) || {};
    check('day 1 runs', !d1.__error, J(d1.__error));
    check('day 1: the improvement is recorded on the page (improved_at = when the client reported it published)', S0(r1.improved_at) === REPORTED, J({ improved_at: r1.improved_at }));
    check('day 1: the page keeps its lane (existing) and is not counted as a page we wrote (no `ours`)', r1.lane === 'existing' && !/\bours\b/.test(S0(r1.sources)), J({ lane: r1.lane, sources: r1.sources }));
    check('day 1: still left out (Google decides, we never call it indexed), action wait: no "Improve this page" for it', r1.state === 'not_indexed' && r1.cause === 'crawled_not_indexed' && r1.action === 'wait', J({ state: r1.state, cause: r1.cause, action: r1.action }));
    check('day 1: Google\'s reading is looked up again the morning after the report (not on 9 Nov)', (d1.asked || []).some(u => /bfsi/.test(u)), J({ asked: d1.asked }));
    check('day 1: the next check is brought forward (before 9 Nov)', Date.parse(r1.next_check_at) < Date.parse('2026-11-09T00:00:00Z'), J({ next: r1.next_check_at }));
    check('day 1: the note says the client improved it and that Google has not read the new version, without promising indexing', /improved version on 2026-11-04/.test(S0(r1.note)) && /has not read|older reading/.test(S0(r1.note)) && !/will be indexed|guarantee/i.test(S0(r1.note)), S0(r1.note));
    check('day 1: "ask Google to read it" is offered for the improved page', r1.ask_google === true, J({ ask_google: r1.ask_google }));
    check('day 1: the run report files it under "Improved by you, waiting for Google", not under "Pages Google read and left out"', /Improved by you, waiting for Google/.test(d1.report) && !/Pages Google read and left out/.test(d1.report), d1.report.slice(0, 600));
    // day 4 (8 Nov): Google read the new version on 7 Nov and still leaves it out -> its own action back, with the honest note
    const A = JSON.parse(J(st));
    const d4 = await TA(() => siteDay(A, D5 + 3 * DAY, { sitemap: [PAGE], answer: () => LEFT_OUT('2026-11-07T09:00:00Z') }));
    const r4 = rowAt(A, /bfsi/) || {};
    check('day 4: inspected again on the schedule (3 days after the improvement)', !d4.__error && (d4.asked || []).some(u => /bfsi/.test(u)), J({ err: d4.__error, asked: d4.asked }));
    check('day 4: Google read the improved version and still left it out: action quality again, the note says Google read the improved version on 7 Nov', r4.action === 'quality' && /read your improved version on 2026-11-07/.test(S0(r4.note)), J({ action: r4.action, note: r4.note }));
    // day 4 (other branch): Google read the new version and put it in search
    const B = JSON.parse(J(st));
    const d4b = await TA(() => siteDay(B, D5 + 3 * DAY, { sitemap: [PAGE], answer: () => PASS('2026-11-07T09:00:00Z') }));
    const r4b = rowAt(B, /bfsi/) || {};
    check('day 4: Google put the improved page in search: indexed, nothing to do (it leaves the left-out group by Google\'s own reading)', !d4b.__error && r4b.state === 'indexed' && r4b.action === 'none', J({ err: d4b.__error, state: r4b.state, action: r4b.action }));
  });
  // =================================================================================================================================
  await guard('IXI2 only an improvement at the same address', async () => {
    const SN = 'IXI2 a "write it anyway" page (a separate new page: the app sends no existing page, app/shared/src/hold.ts) at a new address is our new page (lane new), and the kept page carries no improvement; a written-not-published improvement changes nothing';
    begin(SN); const check = mkCheck(SN);
    const other = { ...improvedLog(REPORTED), keyword: 'bfsi software', existing_page_url: '', published_url: W + '/bfsi-software' };
    const st = { stored: [leftOut()], history: [], log: [other] };
    const d = await TA(() => siteDay(st, D5, { sitemap: [PAGE], answer: () => LEFT_OUT('2026-10-30T08:00:00Z') }));
    const kept = rowAt(st, /industries\/bfsi/) || {}; const fresh = rowAt(st, /bfsi-software/) || {};
    check('the page at the new address is ours (lane new) and the kept page has no improvement and still offers improving', !d.__error && fresh.lane === 'new' && /ours/.test(S0(fresh.sources)) && !S0(kept.improved_at) && kept.action === 'quality', J({ err: d.__error, fresh: [fresh.lane, fresh.sources], kept: [kept.improved_at, kept.action] }));
    const st2 = { stored: [leftOut()], history: [], log: [{ ...improvedLog(''), status: 'written', published_url: '', published_at: '' }] };
    const d2 = await TA(() => siteDay(st2, D5, { sitemap: [PAGE], answer: () => LEFT_OUT('2026-10-30T08:00:00Z') }));
    const k2 = rowAt(st2, /bfsi/) || {};
    check('an improvement that is written but not published (not live) changes nothing', !d2.__error && !S0(k2.improved_at) && k2.action === 'quality', J({ err: d2.__error, improved_at: k2.improved_at, action: k2.action }));
  });
  // =================================================================================================================================
  await guard('IXI3 the shared rule', async () => {
    const SN = 'IXI3 IX.improveState (the rule the app repeats): waiting until Google\'s last crawl is newer than the improvement, then read; never for a page in search or a reason an improvement does not answer';
    begin(SN); const check = mkCheck(SN);
    const st = (o) => T(() => IX.improveState({ state: 'not_indexed', cause: 'crawled_not_indexed', improved_at: REPORTED, last_crawl: '2026-10-30T08:00:00Z', ...o }));
    check('older crawl = waiting', st({}) === 'waiting', J(st({})));
    check('no crawl known = waiting', st({ last_crawl: '' }) === 'waiting', J(st({ last_crawl: '' })));
    check('newer crawl = read', st({ last_crawl: '2026-11-07T09:00:00Z' }) === 'read', J(st({ last_crawl: '2026-11-07T09:00:00Z' })));
    check('in search = nothing', st({ state: 'indexed', cause: '' }) === '', J(st({ state: 'indexed', cause: '' })));
    check('a site step (noindex) = nothing: an improvement does not answer it', st({ cause: 'noindex' }) === '', J(st({ cause: 'noindex' })));
    check('a copy Google chose another page for = waiting (rewriting it is the answer)', st({ cause: 'google_chose_other' }) === 'waiting', J(st({ cause: 'google_chose_other' })));
    check('no improvement = nothing', st({ improved_at: '' }) === '', J(st({ improved_at: '' })));
    const imps = T(() => IX.improvementsOf([improvedLog(REPORTED), { ...improvedLog(REPORTED), published_url: W + '/elsewhere' }, { ...improvedLog(REPORTED), status: 'written' }]));
    check('improvementsOf keeps the published rows only: one at the address it improved (to = \'\'), one at another address (url = the improved page, to = where it went live)',
      Array.isArray(imps) && imps.length === 2 && /industries\/bfsi$/.test(imps[0].url) && imps[0].to === '' && imps[0].at === REPORTED && /industries\/bfsi\/$/.test(imps[1].url) && /\/elsewhere$/.test(imps[1].to), J(imps));
    const mv = (o) => T(() => IX.improveState({ url: PAGE, state: 'not_indexed', cause: 'crawled_not_indexed', improved_at: REPORTED, improved_to: W + '/services/industries-bfsi', last_crawl: '2026-10-30T08:00:00Z', ...o }));
    check('an improvement live at another address = moved (whatever Google read since); at the same address (other host form) = not moved; in search = nothing', mv({}) === 'moved' && mv({ last_crawl: '2026-11-07T00:00:00Z' }) === 'moved'
      && mv({ improved_to: 'https://example.com/industries/bfsi/' }) === 'waiting' && mv({ state: 'indexed', cause: '' }) === '', J([mv({}), mv({ improved_to: 'https://example.com/industries/bfsi/' }), mv({ state: 'indexed', cause: '' })]));
  });
  // =================================================================================================================================
  await guard('IXI4 improvement published at another address', async () => {
    const SN = 'IXI4 (production 2026-11-05, devaicon.com content log rows 19 / 22 / 24) the three improvements were confirmed at NEW addresses (/services/...) while the old pages still open: each old page is "improved version published at another address" with the step to redirect it permanently (never "Improve this page" again, never "waiting for Google"), the new pages stay new pages of ours waiting for Google, and once an old address redirects it is a redirect, not a step';
    begin(SN); const check = mkCheck(SN);
    const DS = { site_id: 'site_devaicon-com', domain: 'devaicon.com', canonical_host: 'devaicon.com', gsc_property: 'sc-domain:devaicon.com' };
    const D = 'https://devaicon.com';
    const PAIRS = [['/capabilities/application-software-development', '/services/capabilities-application-software-development', '2026-11-04T12:11:40.000Z', 'application software development'],
      ['/industries/bfsi', '/services/industries-bfsi', '2026-11-04T12:27:05.000Z', 'banking & financial services technology'],
      ['/engagement-models', '/services/engagement-models', '2026-11-04T12:42:18.000Z', 'software engagement models']];
    const oldRow = (path, next) => ({ site_id: DS.site_id, domain: 'devaicon.com', url: D + path, lane: 'existing', sources: 'sitemap', in_sitemap: true, first_seen_at: '2026-10-29T05:15:00.000Z',
      state: 'not_indexed', evidence: 'inspection', cause: 'crawled_not_indexed', action: 'quality', verdict: 'NEUTRAL', coverage: 'Crawled - currently not indexed', page_fetch_state: 'SUCCESSFUL',
      last_crawl: '2026-10-28T03:00:00.000Z', inspect_at: '2026-11-02T05:20:00.000Z', next_check_at: next, checks: 1, title: path.split('/').pop(), linked_by: '' });
    const newRow = (path, at) => ({ site_id: DS.site_id, domain: 'devaicon.com', url: D + path, lane: 'new', sources: 'sitemap,ours', in_sitemap: true, first_seen_at: at, published_at: at,
      state: 'not_indexed', evidence: 'inspection', cause: 'wait_new', action: 'wait', coverage: 'URL is unknown to Google', inspect_at: '2026-11-05T05:20:00.000Z', next_check_at: '2026-11-07T12:00:00.000Z', checks: 1, linked_by: '' });
    const log = PAIRS.map(([a, b, at, kw], i) => ({ id: [19, 22, 24][i], site_id: DS.site_id, domain: 'devaicon.com', keyword: kw, source: 'manual', existing_page_url: D + a, status: 'published', published_url: D + b, published_at: at,
      publish_note: 'Marked published by you after a warning: sent at another address than the page it updates (checked 2026-11-04)' }));
    const st = { stored: PAIRS.map(([a], i) => oldRow(a, ['2026-11-06T05:20:00.000Z', '2026-11-09T05:20:00.000Z', '2026-11-13T05:20:00.000Z'][i])).concat(PAIRS.map(([, b, at]) => newRow(b, at))), history: [], log };
    const sitemap = PAIRS.flatMap(([a, b]) => [D + a, D + b]);
    const ans = (u) => /\/services\//.test(u) ? insp({ coverageState: 'URL is unknown to Google', verdict: 'NEUTRAL', pageFetchState: '' }) : LEFT_OUT('2026-10-28T03:00:00Z');
    const D6 = Date.parse('2026-11-06T05:15:00Z');
    const d1 = await TA(() => siteDay(st, D6, { site: DS, sitemap, answer: ans }));
    check('day runs', !d1.__error, J(d1.__error));
    const olds = PAIRS.map(([a]) => st.stored.find(r => r.url === D + a) || {}); const news = PAIRS.map(([, b]) => st.stored.find(r => r.url === D + b) || {});
    check('each old page records where its improved version went live (improved_to) and when', olds.every((r, i) => r.improved_to === D + PAIRS[i][1] && r.improved_at === PAIRS[i][2]), J(olds.map(r => [r.url, r.improved_to, r.improved_at])));
    check('each old page is a step on the website (site_fix), still left out by Google, still in the existing lane, never ours', olds.every(r => r.action === 'site_fix' && r.state === 'not_indexed' && r.cause === 'crawled_not_indexed' && r.lane === 'existing' && !/\bours\b/.test(S0(r.sources))),
      J(olds.map(r => [r.action, r.state, r.cause, r.lane, r.sources])));
    check('the note names the new address and the honest step (a permanent 301 redirect, or the text back on the old address), no promise of indexing',
      olds.every((r, i) => S0(r.note).includes('went live at ' + PAIRS[i][1]) && /permanent \(301\) redirect/.test(S0(r.note)) && /put the improved text back on this address/.test(S0(r.note)) && !/will be indexed|guarantee/i.test(S0(r.note))), S0(olds[1].note));
    check('the new pages stay new pages of ours, waiting for Google', news.every(r => r.lane === 'new' && /ours/.test(S0(r.sources)) && r.action === 'wait' && !S0(r.improved_to)), J(news.map(r => [r.lane, r.sources, r.action])));
    check('the report lists the three under "Improved version published at another address", with where each went, and not under the pages to improve',
      /## Improved version published at another address \(3\)/.test(d1.report) && /industries\/bfsi \(improved version at https:\/\/devaicon\.com\/services\/industries-bfsi\)/.test(d1.report) && !/Pages Google read and left out/.test(d1.report), d1.report.slice(0, 900));
    // the client redirects /industries/bfsi permanently to its new address; Google then reads it as a page with redirect
    const R = JSON.parse(J(st));
    const bfsi = R.stored.find(r => r.url === D + '/industries/bfsi'); bfsi.next_check_at = '2026-11-07T00:00:00.000Z';
    const redirAns = (u) => /\/industries\/bfsi$/.test(u) ? insp({ coverageState: 'Page with redirect', verdict: 'NEUTRAL', googleCanonical: D + '/services/industries-bfsi', pageFetchState: 'SUCCESSFUL', lastCrawlTime: '2026-11-07T10:00:00Z' }) : ans(u);
    const redirFetch = (u) => /\/industries\/bfsi$/.test(u) ? { statusCode: 301, headers: { location: D + '/services/industries-bfsi' }, data: '' } : OK200();
    const d2 = await TA(() => siteDay(R, Date.parse('2026-11-08T05:15:00Z'), { site: DS, sitemap, answer: redirAns, fetch: redirFetch }));
    const b2 = R.stored.find(r => r.url === D + '/industries/bfsi') || {};
    check('once the old address redirects, it is a redirect (Google\'s reading), no longer the improvement step', !d2.__error && b2.cause === 'redirect' && T(() => IX.improveState(b2)) === '', J({ err: d2.__error, cause: b2.cause, action: b2.action, note: b2.note }));
  });
};
