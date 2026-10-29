// IXW1-IXW13 (Index coverage, fix wave 2, 2026-10-29: docs/indexing-2026-10-29/REVIEW_2.md N1-N13, ENGINE_BUILD.md "Fix wave 2"). One
// scenario per finding, most of them MULTI-DAY: a website is run day after day through the GENERATED Code nodes (harness/code_v4) with a
// pinned clock, the table rows each day writes are applied as n8n would (upsert on site_id + url, delete by url, history moved), and the
// next day starts from them. Each check is written to FAIL on the code REVIEW_2 read (integration head 3b0a8cab) and pass on the fixed code;
// every computation is wrapped, so a node or a function the old code lacks is a failed check, not a crash. Called from scenarios_v5.js
// after scenarios_index_fix.js; also runs on its own: `CODE_DIR=<code_v4> node scenarios_index_fix2.js` (prints the counts).
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
  const has = (name) => fs.existsSync(path.join(CD, name.replace(/[^A-Za-z0-9_.-]+/g, '_') + '.js'));
  const src = (name) => { try { return fs.readFileSync(path.join(CD, name.replace(/[^A-Za-z0-9_.-]+/g, '_') + '.js'), 'utf8'); } catch (e) { return ''; } };
  const kits = (file, names) => { const s = src(file);
    const body = names.map(n => { const a = s.indexOf('const ' + n + ' = (() => {'); const b = s.indexOf('\n})();', a); return s.slice(a, b + 6); }).join('\n');
    return new Function('URL', 'structuredClone', body + '\nreturn { ' + names.join(', ') + ' };')(undefined, undefined); };
  const { IX } = kits('Index Diagnose', ['PW', 'IX']);
  const AsyncF = Object.getPrototypeOf(async function () {}).constructor;
  // a generated Code node, run with mocked upstream nodes, its own input items and the clock pinned at `now` (Date.now and new Date())
  const node = async (name, mocks, input, now) => {
    const code = src(name); if (!code) throw new Error('node "' + name + '" does not exist in this build');
    const $ = (n) => { if (!(n in mocks)) throw new Error('Referenced node "' + n + '" has no data in this run'); const a = mocks[n].map(j => (j && j.json !== undefined && Object.keys(j).every(k => k === 'json' || k === 'binary')) ? j : { json: j }); return { all: () => a, first: () => a[0], last: () => a[a.length - 1], get item() { return a[0]; } }; };
    const items = (input || [{ json: {} }]).map(j => (j && j.json !== undefined) ? j : { json: j });
    const $input = { all: () => items, first: () => items[0], last: () => items[items.length - 1], get item() { return items[0]; } };
    const RealDate = Date;
    const D = class extends RealDate { constructor(...a) { if (!a.length) super(now); else super(...a); } static now() { return now; } };
    const thisArg = { helpers: { getBinaryDataBuffer: async (i, prop) => { const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b.data) throw new Error('no binary ' + prop); return Buffer.from(b.data, 'base64'); } } };
    const f = new AsyncF('$', '$input', '$execution', 'URL', 'structuredClone', 'Date', code);
    const out = await f.call(thisArg, $, $input, { id: '4242' }, undefined, undefined, now ? D : Date);
    return (out || []).map(o => o.json);
  };
  const W = 'https://www.example.com';
  const SITE = { site_id: 'site_example-com', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com' };
  const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: '', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL', ...o } } });
  const PASS = (o) => insp({ verdict: 'PASS', coverageState: 'Submitted and indexed', ...(o || {}) });
  const HTML = (head, body) => '<html><head>' + (head || '<title>A page</title>') + '</head><body><main>' + (body || 'words '.repeat(300)) + '</main></body></html>';
  const OK200 = () => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: HTML() });
  const NOINDEX = () => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: HTML('<title>A page</title><meta name="robots" content="noindex">') });

  // ---- one website, one day, through the generated nodes; `st` = { stored: [rows], history: [rows] } is updated as n8n's tables would be ----
  const siteDay = async (st, now, o) => {
    const opt = o || {}; const M = {};
    M['Index Sites'] = [{ ...SITE, gsc_connected: true, cap: opt.cap || 300, used_today: 0, run_at: iso(now), quota_hit: false, prev_complete: true, prev_complete_at: iso(now - DAY), home_host_prev: 'www.example.com', on_demand: false }];
    M['Load Index Pages'] = st.stored.length ? st.stored.map(r => ({ ...r })) : [{}];
    M['Load Pages (Index)'] = [{}]; M['Load Page Watch (Index)'] = [{}]; M['Load Content Log (Index)'] = [{}];
    const urls = (opt.sitemap || []).map(loc => ({ loc, lastmod: '' }));
    M['Sitemap Read 3'] = [{ site_id: SITE.site_id, urls, read: 1, sets: 1, fetched: ['example.com/sitemap.xml'], next: [], errors: [], robots_status: 200, robots_txt: 'User-agent: *\nAllow: /\n', home_host: 'www.example.com', home_links: opt.home_links || [] }];
    M['Pages Query Requests'] = [{ skip: true }]; M['Pages Query More'] = [{ skip: true }]; M['GSC Sitemaps List'] = [{}]; M['Sitemaps List Requests'] = [{ skip: true }];
    M['Google Events'] = [{ freeze: { freeze: false }, started: [], completed: [], events: [] }];
    const inv = await node('Index Inventory', M, null, now); M['Index Inventory'] = inv;
    const res = await node('Index Reservation', M, null, now); M['Save Index Reservation'] = res.filter(r => !r.skip).map((r, i) => ({ id: 1 + i, ...r }));
    const pr = await node('Index Probe Requests', M, null, now); M['Index Probe Requests'] = pr;
    const asked = [];
    const answer = (u) => { asked.push(u); return opt.answer ? opt.answer(u, now) : PASS(); };
    M['Inspect URL (Probe)'] = pr.filter(q => !q.skip).map(q => answer(q.inspect_url));
    const ir = await node('Index Inspect Requests', M, null, now); M['Index Inspect Requests'] = ir;
    M['Inspect URL (Index)'] = ir.filter(q => !q.skip).map(q => answer(q.inspect_url));
    if (has('Inspect Retry Requests')) { M['Inspect Retry Requests'] = [{ skip: true }]; M['Inspect URL (Retry)'] = []; }
    const fr = await node('Page Fetch Requests', M, null, now); M['Page Fetch Requests'] = fr;
    const fetched = fr.filter(q => !q.skip).map(q => q.url);
    if (fetched.length) {
      M['Fetch Page (Index)'] = fr.filter(q => !q.skip).map(q => opt.fetch ? opt.fetch(q.url, now) : OK200());
      if (has('Page First Reads')) M['Page First Reads'] = await node('Page First Reads', M, M['Fetch Page (Index)'], now);
    }
    const hr = await node('Fetch Hop Requests', M, null, now); M['Fetch Hop Requests'] = hr;
    if (!hr[0].skip) M['Fetch Page (Final)'] = hr.map(q => opt.hop ? opt.hop(q.url, now) : OK200());
    M['Page Signals'] = await node('Page Signals', M, M['Fetch Page (Final)'] || null, now);
    const dg = await node('Index Diagnose', M, null, now); M['Index Diagnose'] = dg;
    const rows = (await node('Index Page Rows', M, null, now)).filter(r => !r.skip);
    M['Save Index Pages'] = opt.saveFail ? [{ error: 'table not reachable' }] : rows.map(r => ({ id: 1, ...r }));
    const dels = (await node('Index Delete Rows', M, null, now)).filter(r => !r.skip);
    const hm = (await node('Index History Moves', M, null, now)).filter(r => !r.skip);
    const hist = (await node('Index History Rows', M, null, now)).filter(r => !r.skip);
    // apply, as the Data Table nodes do: upsert on site_id + url (every matching row), delete by url, history re-pointed, history inserted
    if (!opt.saveFail) for (const r of rows) { const m = st.stored.filter(x => x.site_id === r.site_id && x.url === r.url); if (m.length) m.forEach(x => Object.assign(x, r)); else st.stored.push({ ...r }); }
    st.stored = st.stored.filter(x => !dels.some(d => d.site_id === x.site_id && d.url === x.url));
    for (const m of hm) for (const h of st.history) if (h.site_id === m.site_id && h.url === m.from) h.url = m.to;
    st.history.push(...hist);
    return { inv: inv[0], dg: dg[0], rows, dels, asked, fetched };
  };
  const rowAt = (st, re) => st.stored.find(r => re.test(r.url)) || null;
  const base = (o) => ({ site_id: SITE.site_id, domain: 'example.com', url: W + '/p', lane: 'existing', sources: 'sitemap', in_sitemap: true, first_seen_at: '2026-08-01T00:00:00.000Z', checks: 1, evidence: 'inspection', ...(o || {}) });
  const T0 = Date.parse('2026-11-03T10:15:00Z');   // a Tuesday (no Monday reselect of "ask Google" in the old code)

  // =================================================================================================================================
  await guard('IXW1 N1 URL moves', async () => {
    const SN = 'IXW1 (N1) a URL move: the redirect\'s final URL wins and the sitemap\'s form maps onto it - no flip-flop, a fresh plan (the moved page is inspected), never a day without the row, history kept, no row deleted before its successor is saved';
    begin(SN); const check = mkCheck(SN);
    // (a) no stored row: the sitemap lists /a/ and the server answers 301 /a/ -> /a; Google reads /a/ as "Page with redirect" to /a and /a as indexed
    const red = (u) => /\/a\/$/.test(u) ? { statusCode: 301, headers: { location: W + '/a' }, data: '' } : OK200();
    const ansA = (u) => /\/a\/$/.test(u) ? insp({ coverageState: 'Page with redirect', googleCanonical: W + '/a', verdict: 'NEUTRAL' }) : PASS({ googleCanonical: W + '/a' });
    const A = { stored: [], history: [] }; const logA = [];
    for (let d = 0; d < 6; d++) { const x = await TA(() => siteDay(A, T0 + d * DAY, { sitemap: [W + '/a/'], answer: ansA, fetch: red }));
      logA.push({ d, err: x.__error, urls: A.stored.map(r => r.url), state: (A.stored[0] || {}).state, asked: x.asked }); }
    const fromDay1 = logA.slice(1);
    check('(a) no stored row: from day 1 the one row lives at the final /a every day (no flip-flop back to the sitemap\'s /a/)', fromDay1.every(l => !l.err && J(l.urls) === J([W + '/a'])), J(logA));
    check('(a) the moved page gets a fresh plan: it is inspected under /a and read as indexed within two days (never "not checked yet" for ever)', logA.slice(1, 3).some(l => (l.asked || []).includes(W + '/a')) && (A.stored[0] || {}).state === 'indexed' && !!(A.stored[0] || {}).inspect_at, J(logA.map(l => [l.d, l.state, l.asked])));
    // (b) an indexed row stored at the sitemap's /a/: never a day without the row, ends at /a indexed, its history follows it
    const B = { stored: [base({ url: W + '/a/', state: 'indexed', cause: '', action: 'none', inspect_at: '2026-10-01T00:00:00.000Z', next_check_at: '2026-10-29T00:00:00.000Z', verdict: 'PASS', coverage: 'Submitted and indexed' })],
      history: [{ site_id: SITE.site_id, url: W + '/a/', at: '2026-10-01T00:00:00.000Z', state: 'indexed', cause: '' }] }; const logB = [];
    for (let d = 0; d < 5; d++) { const x = await TA(() => siteDay(B, T0 + d * DAY, { sitemap: [W + '/a/'], answer: ansA, fetch: red })); logB.push({ d, err: x.__error, urls: B.stored.map(r => [r.url, r.state]), dels: (x.dels || []).map(r => r.url) }); }
    check('(b) an indexed row: the website has its row on every day (a move never deletes the address just written)', logB.every(l => !l.err && l.urls.length === 1), J(logB));
    check('(b) it ends at the final /a, still indexed, and never counts as a drop-out', J(B.stored.map(r => [r.url, r.state])) === J([[W + '/a', 'indexed']]) && !B.stored.some(r => S0(r.dropped_at)), J(B.stored.map(r => [r.url, r.state, r.dropped_at])));
    check('(b) history kept: the old history row now names /a', B.history.some(h => h.url === W + '/a' && h.at === '2026-10-01T00:00:00.000Z') && !B.history.some(h => h.url === W + '/a/'), J(B.history));
    // (c) the save fails: the old row is not deleted (its successor was never saved)
    const C = { stored: [base({ url: W + '/c', state: 'indexed', cause: '', action: 'none', inspect_at: '2026-10-01T00:00:00.000Z', next_check_at: '2026-10-29T00:00:00.000Z', verdict: 'PASS', coverage: 'Submitted and indexed' })], history: [] };
    const xc = await TA(() => siteDay(C, T0, { sitemap: [W + '/c/'], answer: () => PASS(), saveFail: true }));
    check('(c) a move whose new row could not be saved deletes nothing: the old /c row stays', !xc.__error && J((xc.dels || []).map(r => r.url)) === J([]) && J(C.stored.map(r => r.url)) === J([W + '/c']), J({ err: xc.__error, dels: xc.dels, stored: C.stored.map(r => r.url) }));
  });
  // =================================================================================================================================
  await guard('IXW2 N2 next check only after Google', async () => {
    const SN = 'IXW2 (N2) the next inspection moves only after a Google reading, never on a day our own read alone re-diagnosed the page: a site-fix page our read sees daily, a page waiting for Google after a fix and a links page are all inspected again on their schedule, and needs_person can trip';
    begin(SN); const check = mkCheck(SN);
    // (a) a noindex page the client has not fixed (our read sees the noindex every day; Google too)
    const A = { stored: [base({ state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: iso(T0 - 4 * DAY), next_check_at: iso(T0 + 3 * DAY), verdict: 'NEUTRAL', coverage: "Excluded by 'noindex' tag",
      indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(T0 - 4 * DAY), http_status: 200, noindex: 'meta', last_crawl: iso(T0 - 5 * DAY) })], history: [] };
    let nA = 0; const slide = [];
    for (let d = 0; d < 90; d++) { const now = T0 + d * DAY; const before = (A.stored[0] || {}).next_check_at;
      const x = await TA(() => siteDay(A, now, { sitemap: [W + '/p'], answer: () => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: iso(now - 2 * DAY) }), fetch: NOINDEX }));
      nA += (x.asked || []).length; if (!(x.asked || []).length && (x.fetched || []).length && (A.stored[0] || {}).next_check_at !== before) slide.push(d); }
    check('(a) a site-fix page read by us every day is still inspected on its schedule (7, 14, 28 days: at least 4 inspections in 90 days)', nA >= 4, J({ inspections: nA, row: A.stored[0] && [A.stored[0].next_check_at, A.stored[0].checks] }));
    check('(a) a day with only our own read never moves the next inspection', !slide.length, J(slide.slice(0, 10)));
    check('(a) needs_person trips after 4 unchanged re-checks', (A.stored[0] || {}).needs_person === true, J(A.stored[0] && [A.stored[0].checks, A.stored[0].needs_person]));
    // (b) the fix is seen on the site and Google lags (its last crawl stays before the fix): daily for a week, then weekly - never frozen
    const B = { stored: [base({ state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: iso(T0 - 4 * DAY), next_check_at: iso(T0 + 3 * DAY), verdict: 'NEUTRAL', coverage: "Excluded by 'noindex' tag",
      indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(T0 - 4 * DAY), http_status: 200, noindex: 'meta', last_crawl: iso(T0 - 10 * DAY) })], history: [] };
    const askedB = [];
    for (let d = 0; d < 40; d++) { const now = T0 + d * DAY;
      const x = await TA(() => siteDay(B, now, { sitemap: [W + '/p'], answer: () => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: iso(T0 - 10 * DAY) }), fetch: OK200 }));
      if ((x.asked || []).length) askedB.push(d); }
    check('(b) a page waiting for Google after a fix keeps being inspected after its first week (at least 2 inspections after day 12)', askedB.filter(d => d > 12).length >= 2, J(askedB));
    // (c) a links page (Google found it, has not crawled it): read by us weekly, inspected on its schedule
    const Cs = { stored: [base({ state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', inspect_at: iso(T0 - 8 * DAY), next_check_at: iso(T0 + 6 * DAY), checks: 2, verdict: 'NEUTRAL',
      coverage: 'Discovered - currently not indexed', fetch_at: iso(T0 - 8 * DAY), http_status: 200 })], history: [] };
    const askedC = [];
    for (let d = 0; d < 70; d++) { const now = T0 + d * DAY;
      const x = await TA(() => siteDay(Cs, now, { sitemap: [W + '/p'], answer: () => insp({ coverageState: 'Discovered - currently not indexed', pageFetchState: '', lastCrawlTime: '' }), fetch: OK200 }));
      if ((x.asked || []).length) askedC.push(d); }
    check('(c) a links page read by us weekly is inspected on its schedule (at least 3 inspections in 70 days)', askedC.length >= 3, J(askedC));
  });

  // =================================================================================================================================
  await guard('IXW3 N3 fix_seen_at expires', async () => {
    const SN = 'IXW3 (N3) a fix we saw on the site expires when Google crawls the page AFTER it and still reports the cause: fix_seen_at cleared, the step is the client\'s again with a note, no flip back to "fixed" from the same read, and a new fix after the problem came back is seen again';
    begin(SN); const check = mkCheck(SN);
    const A = { stored: [base({ state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: iso(T0 - 3 * DAY), next_check_at: iso(T0 + 4 * DAY), verdict: 'NEUTRAL', coverage: "Excluded by 'noindex' tag",
      indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(T0 - 2 * DAY), http_status: 200, noindex: 'meta', last_crawl: iso(T0 - 6 * DAY) })], history: [] };
    // Google crawls the day before each inspection and still reads the noindex (served only to Googlebot); our read never sees it
    const log = [];
    for (let d = 0; d < 14; d++) { const now = T0 + d * DAY;
      await TA(() => siteDay(A, now, { sitemap: [W + '/p'], answer: () => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: iso(now - DAY / 2) }), fetch: OK200 }));
      const r = A.stored[0] || {}; log.push([d, r.action, S0(r.fix_seen_at).slice(0, 10), S0(r.fix_failed_at).slice(0, 10), r.needs_person, S0(r.note).slice(0, 50)]); }
    const r = A.stored[0] || {};
    check('day 0: our read sees the noindex gone -> "Fixed on your site", waiting for Google', log[0][1] === 'wait' && !!log[0][2], J(log.slice(0, 2)));
    check('Google crawled after the fix and still reports the noindex: fix_seen_at cleared, the site step is back, with a note that says so', r.action === 'site_fix' && !S0(r.fix_seen_at) && !!S0(r.fix_failed_at) && /still sees the same problem/.test(S0(r.note)), J(log));
    check('no flip back: after the expiry the same fixed read never sets "fixed" again', (() => { const i = log.findIndex(l => !!l[3]); return i > 0 && log.slice(i).every(l => l[1] === 'site_fix' && !l[2]); })(), J(log));
    // the problem comes back on the site (our read sees the noindex), then the client fixes it again: a new fix is seen
    const now1 = T0 + 14 * DAY;
    await TA(() => siteDay(A, now1, { sitemap: [W + '/p'], answer: () => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: iso(now1 - DAY) }), fetch: NOINDEX }));
    const back = { ...(A.stored[0] || {}) };
    A.stored[0].next_check_at = iso(now1 + 20 * DAY);   // no inspection on the next day: only our read
    await TA(() => siteDay(A, now1 + DAY, { sitemap: [W + '/p'], answer: () => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: iso(now1 - DAY) }), fetch: OK200 }));
    const again = A.stored[0] || {};
    check('the problem back on the site clears fix_failed_at; the next fix is "Fixed on your site" again', !S0(back.fix_failed_at) && back.action === 'site_fix' && again.action === 'wait' && !!S0(again.fix_seen_at), J({ back: [back.action, back.fix_failed_at], again: [again.action, again.fix_seen_at] }));
  });

  // =================================================================================================================================
  await guard('IXW4 N4 the shared rule', async () => {
    const SN = 'IXW4 (N4, engine side) THE SHARED RULE: fix_seen_at non-empty = "fixed on your site, waiting for Google" whatever the order of inspect_at and fix_seen_at; only the engine sets and clears it - cleared when Google reports the page indexed or the cause gone, or when Google crawled after the fix and still reports it (N3)';
    begin(SN); const check = mkCheck(SN);
    const A = { stored: [base({ state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: iso(T0 - 3 * DAY), next_check_at: iso(T0), verdict: 'NEUTRAL', coverage: "Excluded by 'noindex' tag",
      indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(T0 - 2 * DAY), http_status: 200, noindex: 'meta', last_crawl: iso(T0 - 6 * DAY) })], history: [] };
    const seen = []; let broken = null;
    // days 0-3: Google lags (crawl before the fix), the page is inspected the same run the fix is seen and on the next days (inspect_at >= fix_seen_at)
    for (let d = 0; d < 4; d++) { const now = T0 + d * DAY;
      await TA(() => siteDay(A, now, { sitemap: [W + '/p'], answer: () => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: iso(T0 - 6 * DAY) }), fetch: OK200 }));
      const r = A.stored[0] || {}; seen.push([d, r.action, r.state, S0(r.fix_seen_at).slice(0, 19), S0(r.inspect_at).slice(0, 19)]);
      if (S0(r.fix_seen_at) && (r.action !== 'wait' || r.state === 'indexed')) broken = r; }
    check('fix_seen_at set => action wait, never on an indexed page - also when inspect_at is the same run or later', !broken && seen.every(s => s[1] === 'wait' && !!s[3]) && seen.some(s => s[4] >= s[3]), J(seen));
    // day 4: Google reports the page indexed -> cleared
    await TA(() => siteDay(A, T0 + 4 * DAY, { sitemap: [W + '/p'], answer: () => PASS({ lastCrawlTime: iso(T0 + 3.5 * DAY) }), fetch: OK200 }));
    const r4 = A.stored[0] || {};
    check('Google reports the page indexed: fix_seen_at cleared by the engine, state indexed, nothing waits', r4.state === 'indexed' && !S0(r4.fix_seen_at) && r4.action === 'none', J([r4.state, r4.action, r4.fix_seen_at]));
    // per N3: Google crawled after the fix and still reports the cause -> cleared
    const fx = T(() => IX.fixState({ prev: { cause: 'noindex', fix_seen_at: iso(T0) }, seen: true, fresh: { last_crawl: iso(T0 + DAY) }, now_iso: iso(T0 + 2 * DAY) }));
    check('per N3 (the kit\'s rule): Google crawled after the fix and still reports it -> fix_seen_at cleared, fix_failed_at = that crawl', fx && fx.fix_seen_at === '' && fx.fix_failed_at === iso(T0 + DAY), J(fx));
    const cols = T(() => IX.PAGE_COLS) || [];
    check('the row carries fix_seen_at, fix_failed_at and ask_google_at (exact table columns)', ['fix_seen_at', 'fix_failed_at', 'ask_google', 'ask_google_at'].every(c => cols.includes(c)), J(cols.slice(-6)));
  });

  // =================================================================================================================================
  await guard('IXW5 N5 a broken chain resumes', async () => {
    const SN = 'IXW5 (N5) a broken chain does not lose the day: the day\'s watch restarts the chain for the websites not done (a finished run row today = done; a run that never finished = retried, last; two such runs = left for tomorrow); a refused dispatch is retried as the watch; the code comment says what the code does';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-03T15:00:00Z'); const today = '2026-11-03';
    const row = (sid, d) => ({ site_id: sid, domain: d, canonical_host: 'www.' + d, gsc_property: 'sc-domain:' + d, status: 'active' });
    const sites = [row('s_a', 'a.com'), row('s_b', 'b.com'), row('s_c', 'c.com'), row('s_d', 'd.com')];
    const RES = J({ reservation: true, complete: true, home_host: '' });
    const runs = [{ site_id: 's_a', run_at: today + 'T10:20:00.000Z', inspected: 40, sitemaps_json: J({ complete: true, checked: true }) },   // finished
      { site_id: 's_b', run_at: today + 'T10:31:00.000Z', inspected: 60, sitemaps_json: RES },                                              // crashed once (its reservation stands)
      { site_id: 's_d', run_at: today + 'T10:40:00.000Z', inspected: 10, sitemaps_json: RES }, { site_id: 's_d', run_at: today + 'T11:45:00.000Z', inspected: 0, sitemaps_json: RES },   // broke twice
      { site_id: 's_a', run_at: '2026-11-02T10:20:00.000Z', inspected: 40, sitemaps_json: J({ complete: true }) }, { site_id: 's_c', run_at: '2026-11-01T10:20:00.000Z', inspected: 40, sitemaps_json: J({ complete: true }) },
      { site_id: 's_b', run_at: '2026-11-02T10:30:00.000Z', inspected: 40, sitemaps_json: J({ complete: true }) }];
    const M = { 'Manual Run': [{ trigger: 'ix_watch', ix_watch: { date: today, n: 1 } }], 'Load Sites (Index)': sites, 'Load Monitors (Index)': [{}], 'Load Index Runs': runs };
    const p = await TA(() => node('Index Plan', M, null, now)); const p0 = (Array.isArray(p) ? p[0] : p) || {};
    check('the watch dispatch: c.com (never run today) and b.com (its run crashed: retried, last); a.com done; d.com broke twice (tomorrow)', p0.dispatch === true && J([...(p0.chain || [])].sort()) === J(['s_b', 's_c']) && (p0.chain || [])[(p0.chain || []).length - 1] === 's_b', J(p0));
    const pOld = await TA(() => node('Index Plan', { ...M, 'Manual Run': [{ trigger: 'ix_watch', ix_watch: { date: '2026-11-02', n: 3 } }] }, null, now)); const po = (Array.isArray(pOld) ? pOld[0] : pOld) || {};
    check('a watch of another day does nothing (tomorrow\'s dispatch checks the websites)', po.nothing_to_do === true && !po.dispatch, J(po));
    const w = await TA(() => node('Index Watch Plan', { 'Index Plan': [p0] }, null, now)); const w0 = (Array.isArray(w) ? w[0] : w) || {};
    check('after a dispatch, the watch is started within the hour as ix_watch with the next number', w0.trigger === 'ix_watch' && (w0.ix_watch || {}).date === today && (w0.ix_watch || {}).n === 2 && Number(w0.wait_minutes) === IX.CFG.watch_minutes && IX.CFG.watch_minutes < 60, J(w0));
    const rf = await TA(() => node('Retry Index Part', { 'Manual Run': [{ trigger: 'schedule' }], 'After Run Ledger (Index)': [{ allowed: false, reason: 'too_many_open' }], 'Index Plan': [{ dispatch: true, chain: ['s_c'], today, watch_n: 0 }] }, null, now));
    const rf0 = (Array.isArray(rf) ? rf[0] : rf) || {};
    check('the 05:15 dispatch refused for capacity is retried as the day\'s watch (not lost for the day)', rf0.trigger === 'ix_watch' && (rf0.ix_watch || {}).n === 1 && Number(rf0.wait_minutes) > 5, J(rf0));
    const WF = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Index_Coverage.json'), 'utf8'))[0]; } catch (e) { return { nodes: [], connections: {} }; } })();
    const C = WF.connections || {}; const outs = (n) => ((C[n] || {}).main || []).flat().filter(Boolean).map(t => t.node);
    const N = (n) => (WF.nodes || []).find(x => x.name === n) || {};
    check('wiring: the settle of every run -> Index Watch Plan -> Wait (Index Watch) -> Start Index Watch (this workflow, not waited for)', outs('Settle Run Ledger (Index)').includes('Index Watch Plan') && outs('Any Index Watch?').includes('Wait (Index Watch)')
      && outs('Wait (Index Watch)').includes('Start Index Watch') && ((N('Start Index Watch').parameters || {}).workflowId || {}).value === WF.id && !!N('Wait (Index Watch)').webhookId, J({ settle: outs('Settle Run Ledger (Index)'), w: outs('Wait (Index Watch)') }));
    check('the dispatch comment says what the code does (no "a crash loses one website, never the day")', !/never the day/.test(src('Dispatch Start')) && /watch/i.test(src('Dispatch Start')), src('Dispatch Start').slice(0, 500));
  });

  // =================================================================================================================================
  await guard('IXW6 N6 ask Google 5 a week', async () => {
    const SN = 'IXW6 (N6 / X8) "ask Google to read it": at most 5 pages NEWLY marked per website in any 7 days (rolling), even when the marked pages are indexed the next day; after the window, new pages can be marked';
    begin(SN); const check = mkCheck(SN);
    let rows = Array.from({ length: 15 }, (_, i) => ({ url: W + '/p' + i, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', in_sitemap: true, sources: 'sitemap', impressions_28d: 0, _prev: { ask_google: false, ask_google_at: '' } }));
    const home = new Set(rows.map(r => IX.key(r.url))); const marked = new Set(); const perDay = [];
    for (let d = 0; d < 7; d++) {
      const n = T(() => IX.askGoogle(rows, { now: T0 + d * DAY, home_keys: home, freeze: { freeze: false }, reselect: d === 6 }));
      const today = rows.filter(r => r.ask_google).map(r => r.url); today.forEach(u => marked.add(u)); perDay.push([d, typeof n === 'number' ? n : n, today.length]);
      // the next day: the pages marked today are indexed (Google read them); the rest unchanged
      rows = rows.map(r => ({ ...r, _prev: { ask_google: !!r.ask_google, ask_google_at: S0(r.ask_google_at) }, ...(r.ask_google ? { state: 'indexed', cause: '', action: 'none' } : {}) }));
    }
    check('15 eligible pages over 7 days (marked ones indexed the next day): at most 5 different pages marked in the week', marked.size <= 5 && marked.size > 0, J({ distinct: marked.size, perDay }));
    T(() => IX.askGoogle(rows, { now: T0 + 8 * DAY, home_keys: home, freeze: { freeze: false } }));
    check('after 7 days, new pages can be marked again', rows.some(r => r.ask_google && !marked.has(r.url)), J(rows.filter(r => r.ask_google).map(r => r.url)));
  });

  // =================================================================================================================================
  await guard('IXW7 N7 sitemaps in bounded batches', async () => {
    const SN = 'IXW7 (N7 / E10 / X2) child sitemaps are read in bounded batches and stop at the address cap (an index of 49 children of 6,000 addresses reads 1-2 children, not 49); a tree of many small children is still read whole; the answers are files read by the Code node, no body carried on';
    begin(SN); const check = mkCheck(SN);
    const site = { site_id: SITE.site_id, domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com', gsc_connected: true, home_host_prev: '' };
    const xmlSet = (locs) => '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locs.map(l => '<url><loc>' + l + '</loc></url>').join('') + '</urlset>';
    const xmlIdx = (locs) => '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locs.map(l => '<sitemap><loc>' + l + '</loc></sitemap>').join('') + '</sitemapindex>';
    const tree = async (children, per, opt) => {
      const o = opt || {}; const M = { 'Index Sites': [site], 'GSC Sitemaps List': [{}], 'Sitemaps List Requests': [{ skip: true }] }; const fetchedBy = [];
      const answer = (q) => q.home ? { statusCode: 200, headers: {}, data: '<html></html>' } : q.robots ? { statusCode: 200, headers: {}, data: 'User-agent: *\n' }
        : /\/sitemap\.xml$/.test(q.url) ? { statusCode: 200, headers: {}, data: xmlIdx(Array.from({ length: children }, (_, i) => W + '/sm-' + i + '.xml')) }
        : { statusCode: 200, headers: {}, data: xmlSet(Array.from({ length: per }, (_, j) => W + '/' + q.url.replace(/^.*\/sm-(\d+)\.xml$/, 'c$1') + '/p' + j)) };
      let last = null;
      for (let r = 1; r <= 9; r++) {
        if (!has('Sitemap Requests ' + r)) break;
        const q = await node('Sitemap Requests ' + r, M, null, T0); M['Sitemap Requests ' + r] = q;
        const asked = q.filter(x => !x.skip);
        fetchedBy.push(asked.filter(x => /\/sm-\d+\.xml$/.test(x.url)).length);
        let input = null;
        if (asked.length) {
          const ans = asked.map(answer);
          if (o.binary) { M['Fetch Sitemaps ' + r] = ans.map(a => ({ statusCode: a.statusCode, headers: a.headers })); input = ans.map(a => ({ json: { statusCode: a.statusCode, headers: a.headers }, binary: { data: { data: Buffer.from(a.data).toString('base64'), mimeType: 'text/xml' } } })); }
          else M['Fetch Sitemaps ' + r] = ans;
        }
        last = await node('Sitemap Read ' + r, M, input, T0); M['Sitemap Read ' + r] = last;
      }
      const st = (last || [])[0] || {};
      return { st, fetchedBy, total: fetchedBy.reduce((a, b) => a + b, 0), complete: T(() => IX.sitemapComplete(st)), out: J(last).length };
    };
    const big = await TA(() => tree(49, 6000));
    check('an index of 49 children of 6,000 addresses: at most 2 children are fetched in all (not 49 in one round), the cap of 5,000 holds', !big.__error && big.total <= 2 && (big.st.urls || []).length <= 5000 && (big.st.urls || []).length >= 4000, J({ err: big.__error, by: big.fetchedBy, urls: (big.st.urls || []).length }));
    check('that tree is partial (children left unread): no "not in the sitemap" advice', big.complete === false, J({ complete: big.complete, next: (big.st.next || []).length }));
    const small = await TA(() => tree(30, 20));
    check('an index of 30 small children is still read whole (complete, 600 addresses) in bounded rounds (never more than 10 children at once)', !small.__error && small.complete === true && (small.st.urls || []).length === 600 && Math.max(...small.fetchedBy) <= 10, J({ err: small.__error, by: small.fetchedBy, urls: (small.st.urls || []).length, complete: small.complete }));
    const bin = await TA(() => tree(3, 10, { binary: true }));
    check('the answers are files (binary): the Code node reads them and keeps only the addresses (30 found)', !bin.__error && (bin.st.urls || []).length === 30 && bin.complete === true, J({ err: bin.__error, urls: (bin.st.urls || []).length, by: bin.fetchedBy }));
    const WF = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Index_Coverage.json'), 'utf8'))[0]; } catch (e) { return { nodes: [] }; } })();
    const fetches = (WF.nodes || []).filter(n => /^Fetch (Sitemaps \d|Page \(Index\)|Page \(Final\))$/.test(n.name));
    check('every sitemap and page fetch answers as a file (no body in the run\'s saved data)', fetches.length >= 5 && fetches.every(n => (((n.parameters.options || {}).response || {}).response || {}).responseFormat === 'file'), J(fetches.map(n => [n.name, (((n.parameters.options || {}).response || {}).response || {}).responseFormat])));
    // a page of 1 MB read as a file: what Page First Reads passes on holds no body
    const page = '<html><head><title>Big</title></head><body><main>' + 'word '.repeat(200000) + '</main></body></html>';
    const pf = await TA(() => node('Page First Reads', { 'Page Fetch Requests': [{ site_id: SITE.site_id, url: W + '/big', page_url: W + '/big' }], 'Fetch Page (Index)': [{ statusCode: 200, headers: { 'content-type': 'text/html' } }] },
      [{ json: { statusCode: 200, headers: { 'content-type': 'text/html' } }, binary: { data: { data: Buffer.from(page).toString('base64'), mimeType: 'text/html' } } }], T0));
    const pf0 = (Array.isArray(pf) ? pf[0] : pf) || {};
    check('Page First Reads reads the file and passes on its reading (200, 200,000 words, the title), not the body', (pf0.f || {}).http_status === 200 && (pf0.f || {}).words >= 199000 && (pf0.f || {}).title === 'Big' && J(pf0).length < 5000, J(pf0).slice(0, 300));
  });

  // =================================================================================================================================
  await guard('IXW9 N9 a chain part skips a site done today', async () => {
    const SN = 'IXW9 (N9) a chain part skips a website already checked today (a finished run row): a second dispatch while a chain is running never reads a website twice; the chain goes on to the next one';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-03T15:00:00Z');
    const M = { 'Manual Run': [{ trigger: 'ix_chain', site_id: SITE.site_id, ix_chain: { date: '2026-11-03', started_at: iso(now - 3600e3), rest: ['s_next'], part: 2, of: 3, attempt: 0 } }],
      'Load Sites (Index)': [{ ...SITE, status: 'active' }], 'Load Monitors (Index)': [{}], 'Load Index Runs': [{ site_id: SITE.site_id, run_at: '2026-11-03T11:00:00.000Z', inspected: 30, sitemaps_json: J({ complete: true, checked: true }) }] };
    const p = await TA(() => node('Index Plan', M, null, now)); const p0 = (Array.isArray(p) ? p[0] : p) || {};
    check('the website has a finished run today: this chain part does nothing and says why', p0.nothing_to_do === true && /already checked today/.test(S0(p0.reason)), J(p0));
    const Mr = { ...M, 'Load Index Runs': [{ site_id: SITE.site_id, run_at: '2026-11-03T11:00:00.000Z', inspected: 30, sitemaps_json: J({ reservation: true }) }] };
    const q = await TA(() => node('Index Plan', Mr, null, now)); const q0 = (Array.isArray(q) ? q[0] : q) || {};
    check('control: a website whose only row today is a crashed run\'s reservation is checked (inside what is left of the cap)', q0.site_id === SITE.site_id && !q0.nothing_to_do && q0.used_today === 30, J(q0));
  });

  // =================================================================================================================================
  await guard('IXW10 N10 duplicate rows pruned', async () => {
    const SN = 'IXW10 (N10) two stored rows of one address: the newest stands, the older one on another form is pruned by its exact url, a row with the very same url is never deleted, and the older row\'s fields are never written over the newer one';
    begin(SN); const check = mkCheck(SN);
    const st = { stored: [base({ url: W + '/a', state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', updated_at: '2026-10-01T00:00:00.000Z', inspect_at: '2026-10-01T00:00:00.000Z', next_check_at: iso(T0 + 20 * DAY) }),
      base({ url: W + '/a/', state: 'indexed', cause: '', action: 'none', updated_at: '2026-11-01T00:00:00.000Z', inspect_at: '2026-11-01T00:00:00.000Z', next_check_at: iso(T0 + 20 * DAY), verdict: 'PASS', coverage: 'Submitted and indexed' })], history: [] };
    const x = await TA(() => siteDay(st, T0, { sitemap: [W + '/a/'] }));
    check('the older /a is deleted, the newer /a/ stays indexed (its fields not overwritten by the older row)', !x.__error && J(st.stored.map(r => [r.url, r.state])) === J([[W + '/a/', 'indexed']]), J({ err: x.__error, dels: x.dels, stored: st.stored.map(r => [r.url, r.state]) }));
    const m = T(() => IX.merge({ site: SITE, now: T0, stored: [base({ url: W + '/b', updated_at: '2026-10-01T00:00:00.000Z' }), base({ url: W + '/b', updated_at: '2026-11-01T00:00:00.000Z' })], inventory: [],
      sitemap: { read: true, complete: true, urls: [{ loc: W + '/b' }] }, ours: [], search: { read: false, by: new Map() }, watch: [] }));
    check('two rows with the very same url: nothing is pruned (a delete by url would take both)', !(m.prune || []).some(p => p.url === W + '/b'), J(m.prune));
  });

  // =================================================================================================================================
  await guard('IXW11 N11 private addresses', async () => {
    const SN = 'IXW11 (N11) the engine cannot resolve DNS in the Code sandbox (the task runner allows no built-in modules): it refuses every address that is not plainly on the site\'s own domain and IP literals of every form; the residual risk (a verified domain pointing to an internal address) is documented in ENGINE_BUILD.md';
    begin(SN); const check = mkCheck(SN);
    check('IP literals, localhost and internal names are never fetched (control: unchanged by this wave)', ['http://127.0.0.1/', 'http://169.254.169.254/latest', 'http://0x7f000001/', 'http://2130706433/', 'http://localhost/', 'http://db.internal/', 'http://[::1]/']
      .every(u => T(() => IX.parseUrl(u)) === null), '');
  });

  // =================================================================================================================================
  await guard('IXW12 N12 a failed run says so', async () => {
    const SN = 'IXW12 (N12) the callback of a run that could not read the website carries failed: true, checked: false and the note, and says its figures are the last check\'s, never today\'s';
    begin(SN); const check = mkCheck(SN);
    const stored = [base({ url: W + '/a', state: 'indexed', cause: '', action: 'none' }), base({ url: W + '/b', state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality' })];
    const M = { 'Index Inventory': [{ site_id: SITE.site_id, domain: 'example.com', site: { ...SITE, callback_url: 'https://app.example.test/hook', request_id: 'r1' }, no_access: true, why: 'the service account has no access to a Search Console property for example.com', pages: stored }],
      'Google Events': [{ freeze: { freeze: false }, started: [], completed: [], events: [] }], 'Page Signals': [{ skip: true }], 'Save Index Reservation': [] };
    const dg = await TA(() => node('Index Diagnose', M, null, Date.parse('2026-11-02T10:15:00Z')));
    const runs = await TA(() => node('Index Run Rows', { 'Index Diagnose': dg }, null, Date.parse('2026-11-02T10:15:00Z')));
    const rep = await TA(() => node('Index Report', { 'Index Diagnose': (Array.isArray(dg) ? dg : []).map(d => ({ ...d, monday: true })), 'Index Run Rows': runs, 'Google Events': M['Google Events'], 'Update Impact Rows': [{ skip: true }], 'Load Update Impact': [{}] }, null, Date.parse('2026-11-02T10:15:00Z')));
    const s = ((Array.isArray(rep) ? rep[0] : {}) || {}).summary || {};
    check('summary.failed true, checked false, the note says we could not check, figures from the last check', s.failed === true && s.checked === false && /could not check this website today/.test(S0(s.note)) && s.figures_from === 'last_check', J({ rep: Array.isArray(rep) ? rep[0] : rep }).slice(0, 900));
  });

  // =================================================================================================================================
  await guard('IXW13 N13 X-Robots-Tag for Google only', async () => {
    const SN = 'IXW13 (N13) an X-Robots-Tag rule counts as noindex only with no crawler named or named for googlebot (bingbot: noindex does not); a page Google left out on an old, vague reading is not given a false "remove the noindex" step';
    begin(SN); const check = mkCheck(SN);
    const rf = (h, head) => T(() => IX.readFetch(W + '/x', { statusCode: 200, headers: { 'x-robots-tag': h, 'content-type': 'text/html' }, data: HTML(head) }, null));
    const cases = [['bingbot: noindex', ''], ['bingbot: noindex, nofollow', ''], ['googlebot: noindex', 'header'], ['noindex', 'header'], ['max-snippet:-1, noindex', 'header'], ['unavailable_after: 25 Jun 2030 15:00:00 PST, noindex', 'header'],
      ['otherbot: noindex, googlebot: nofollow', ''], ['none', 'header']];
    const got = cases.map(([h, want]) => [h, (rf(h) || {}).noindex, want]);
    check('the header rules are read per crawler', got.every(([, g, w]) => g === w), J(got));
    check('a googlebot meta tag is read as noindex', (rf('', '<title>x</title><meta name="googlebot" content="noindex">') || {}).noindex === 'meta', '');
    // multi-day: Google read the page long ago as "crawled, not indexed"; our read sees only `bingbot: noindex` - no noindex step on any day
    const A = { stored: [base({ state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', inspect_at: iso(T0 - 40 * DAY), next_check_at: iso(T0 + 40 * DAY), verdict: 'NEUTRAL', coverage: 'Crawled - currently not indexed',
      last_crawl: iso(T0 - 60 * DAY), page_fetch_state: 'SUCCESSFUL', fetch_at: iso(T0 - 10 * DAY), http_status: 200 })], history: [] };
    const causes = [];
    for (let d = 0; d < 3; d++) { await TA(() => siteDay(A, T0 + d * DAY, { sitemap: [W + '/p'], fetch: () => ({ statusCode: 200, headers: { 'x-robots-tag': 'bingbot: noindex', 'content-type': 'text/html' }, data: HTML() }) })); causes.push((A.stored[0] || {}).cause); }
    check('no day turns the page into "noindex" because of a rule for another crawler', causes.every(c => c === 'crawled_not_indexed'), J(causes));
  });

  // =================================================================================================================================
  await guard('IXW14 X17 contract rows', async () => {
    const SN = 'IXW14 (X17, engine side) the rows the app reads, made by the real nodes: a page fixed on the site and inspected the same run or later (inspect_at >= fix_seen_at), a fix Google did not take (fix_failed_at), an "ask Google" page with its date, a redirect_error page and a reservation run row - written to OUT_DIR for the app\'s contract fixture';
    begin(SN); const check = mkCheck(SN);
    const A = { stored: [base({ url: W + '/fixed', state: 'excluded', cause: 'noindex', action: 'site_fix', inspect_at: iso(T0 - 3 * DAY), next_check_at: iso(T0), verdict: 'NEUTRAL', coverage: "Excluded by 'noindex' tag",
      indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(T0 - 2 * DAY), http_status: 200, noindex: 'meta', last_crawl: iso(T0 - 6 * DAY) }),
      base({ url: W + '/loop', state: 'not_indexed', cause: 'redirect_error', action: 'site_fix', inspect_at: iso(T0 - 3 * DAY), next_check_at: iso(T0 + 9 * DAY), verdict: 'NEUTRAL', coverage: 'Redirect error' }),
      base({ url: W + '/menu-page', state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', inspect_at: iso(T0 - 3 * DAY), next_check_at: iso(T0 + 9 * DAY), verdict: 'NEUTRAL', coverage: 'Discovered - currently not indexed' }),
      base({ url: W + '/not-taken', state: 'excluded', cause: 'noindex', action: 'wait', fix_seen_at: iso(T0 - 4 * DAY), inspect_at: iso(T0 - 3 * DAY), next_check_at: iso(T0), verdict: 'NEUTRAL', coverage: "Excluded by 'noindex' tag",
        indexing_state: 'BLOCKED_BY_META_TAG', fetch_at: iso(T0 - DAY), http_status: 200, noindex: '', last_crawl: iso(T0 - 6 * DAY) })], history: [] };
    const x = await TA(() => siteDay(A, T0, { sitemap: [W + '/fixed', W + '/loop', W + '/menu-page', W + '/not-taken'], home_links: [IX.key(W + '/menu-page')],
      answer: (u) => insp({ coverageState: "Excluded by 'noindex' tag", indexingState: 'BLOCKED_BY_META_TAG', lastCrawlTime: /not-taken/.test(u) ? iso(T0 - DAY) : iso(T0 - 6 * DAY) }), fetch: (u) => /loop/.test(u) ? { statusCode: 301, headers: { location: W + '/loop-b' }, data: '' } : OK200(),
      hop: () => ({ statusCode: 301, headers: { location: W + '/loop' }, data: '' }) }));
    const fixed = rowAt(A, /\/fixed$/) || {}; const menu = rowAt(A, /menu-page$/) || {}; const loop = rowAt(A, /\/loop$/) || {}; const nt = rowAt(A, /not-taken$/) || {};
    const res = await TA(() => node('Index Reservation', { 'Index Inventory': [x.inv || {}], 'Google Events': [{ freeze: { freeze: false } }] }, null, T0));
    const rres = ((Array.isArray(res) ? res[0] : {}) || {});
    const sample = { pages: A.stored, reservation_run_row: rres };
    if (H.save) H.save('index_coverage_contract_rows.json', sample);
    check('a page fixed on the site and inspected the same run: fix_seen_at set, inspect_at >= fix_seen_at, action wait', !!S0(fixed.fix_seen_at) && S0(fixed.inspect_at) >= S0(fixed.fix_seen_at) && fixed.action === 'wait', J([fixed.fix_seen_at, fixed.inspect_at, fixed.action]));
    check('a menu page Google has not crawled carries ask_google and its date; a redirect_error row is a site step', menu.ask_google === true && !!S0(menu.ask_google_at) && loop.cause === 'redirect_error' && loop.action === 'site_fix', J([menu.ask_google, menu.ask_google_at, loop.cause, loop.action]));
    check('a fix Google did not take: fix_failed_at set, fix_seen_at empty, a site step whose note says Google still sees it', !!S0(nt.fix_failed_at) && !S0(nt.fix_seen_at) && nt.action === 'site_fix' && /still sees the same problem/.test(S0(nt.note)), J([nt.fix_failed_at, nt.fix_seen_at, nt.action, nt.note]));
    check('the reservation run row says so in sitemaps_json', /"reservation":true/.test(S0(rres.sitemaps_json)), J(rres).slice(0, 300));
  });
};

if (require.main === module) {
  // on its own: a minimal harness context, so the scenarios can be run against any build's code_v4 (e.g. the integration head's)
  const results = []; let current = '';
  const H = { results, save: () => {} };
  const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log('   !! scenario "' + name + '" aborted at: ' + String(e && e.message || e)); results.push({ scenario: name, node: 'scenario aborted', ok: false }); } };
  const begin = (sn) => { current = sn; console.log('\n########## ' + sn + ' ##########'); };
  module.exports({ H, guard, begin }).then(() => { const f = results.filter(r => !r.ok).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); });
}
