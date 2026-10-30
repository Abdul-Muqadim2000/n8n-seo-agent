// IXR2-IXR8 (Index coverage, fix wave 3, 2026-10-30: docs/indexing-2026-10-29/REVIEW_3.md R2-R8, ENGINE_BUILD.md "Fix wave 3"). Each check runs
// the GENERATED Code nodes (harness/code_v4) with mocked upstream nodes and a pinned clock, and is written to FAIL on the code REVIEW_3 read
// (ix/engine 7777e17d) and pass on the fixed code; every computation is wrapped, so a node the old code lacks is a failed check, not a crash.
// Called from scenarios_v5.js after scenarios_index_fix2.js; also runs on its own:
//   CODE_DIR=<code_v4> WF_FILE=<SEO_Agent_Index_Coverage.json> node scenarios_index_fix3.js   (prints the counts)
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const WFF = process.env.WF_FILE || path.join(__dirname, '..', 'workflows', 'SEO_Agent_Index_Coverage.json');
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
  // a generated Code node with mocked upstream nodes, its own input items, a spy on the binary helper and the clock pinned at `now`
  const node = async (name, mocks, input, now, spy) => {
    const code = src(name); if (!code) throw new Error('node "' + name + '" does not exist in this build');
    const $ = (n) => { if (!(n in mocks)) throw new Error('Referenced node "' + n + '" has no data in this run');
      const a = mocks[n].map(j => (j && j.json !== undefined && Object.keys(j).every(k => k === 'json' || k === 'binary')) ? j : { json: j });
      return { all: () => a, first: () => a[0], last: () => a[a.length - 1] }; };
    const items = (input || [{ json: {} }]).map(j => (j && j.json !== undefined) ? j : { json: j });
    const $input = { all: () => items, first: () => items[0], last: () => items[items.length - 1], get item() { return items[0]; } };
    const RealDate = Date;
    const D = class extends RealDate { constructor(...a) { if (!a.length) super(now); else super(...a); } static now() { return now; } };
    const sp = spy || { calls: 0 };
    const thisArg = { helpers: { getBinaryDataBuffer: async (i, prop) => { sp.calls++; const b = items[i] && items[i].binary && items[i].binary[prop]; if (!b || !b.data) throw new Error('no binary ' + prop); return Buffer.from(b.data, 'base64'); } } };
    const f = new AsyncF('$', '$input', '$execution', 'URL', 'structuredClone', 'Date', code);
    const out = await f.call(thisArg, $, $input, { id: '4242' }, undefined, undefined, now ? D : Date);
    return (out || []).map(o => o.json);
  };
  const first = (x) => (Array.isArray(x) ? x[0] : x) || {};
  const WF = (() => { try { return JSON.parse(fs.readFileSync(WFF, 'utf8'))[0]; } catch (e) { return { nodes: [], connections: {} }; } })();
  const C = WF.connections || {};
  const outs = (n, k) => { const m = ((C[n] || {}).main || []); return (k === undefined ? m.flat() : (m[k] || [])).filter(Boolean).map(t => t.node); };
  const N = (n) => (WF.nodes || []).find(x => x.name === n) || {};
  const reach = (from, stopAt) => { const seen = new Set(); const todo = [from]; while (todo.length) { const x = todo.pop(); if (seen.has(x)) continue; seen.add(x); if (stopAt && stopAt.has(x) && x !== from) continue; todo.push(...outs(x)); } return seen; };
  const RUN_COLS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'index_wiring.json'), 'utf8')).run_cols || []; } catch (e) { return []; } })();
  const W = 'https://www.example.com';

  // =================================================================================================================================
  await guard('IXR2 R2 a part that fails early is counted', async () => {
    const SN = 'IXR2 (R2) a website whose run dies BEFORE its reservation is not restarted by every watch: the part writes an attempt row as soon as the run guard lets it in (before the sitemap rounds), the reservation and the final row replace it, two unfinished runs = left for tomorrow; an attempt row is never "the run before"';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-03T15:00:00Z'); const today = '2026-11-03';
    const sites = ['a.com', 'b.com', 'c.com'].map(d => ({ site_id: 'site_' + d.replace('.', '-'), domain: d, canonical_host: 'www.' + d, gsc_property: 'sc-domain:' + d, status: 'active' }));
    const runs = [{ site_id: 'site_b-com', run_at: today + 'T10:20:00.000Z', inspected: 10, sitemaps_json: J({ complete: true }) },
      { site_id: 'site_c-com', run_at: today + 'T10:40:00.000Z', inspected: 10, sitemaps_json: J({ complete: true }) }];
    // the day's watches: each dispatch that names a.com starts its part, the part writes its attempt row and then crashes in the sitemap rounds
    let started = 0; const log = [];
    for (let n = 1; n <= 30; n++) {
      const t = now + n * 50 * 60e3 / 30;   // the watches of one afternoon, still the same UTC day
      const M = { 'Manual Run': [{ trigger: 'ix_watch', ix_watch: { date: today, n, after: 'started' } }], 'Load Sites (Index)': sites, 'Load Monitors (Index)': [{}], 'Load Index Runs': runs.map(r => ({ ...r })) };
      const p = first(await TA(() => node('Index Plan', M, null, t)));
      if (!p.dispatch || !(p.domains || []).includes('a.com')) { log.push([n, S0(p.reason).slice(0, 60)]); continue; }
      started++;
      const part = first(await TA(() => node('Index Plan', { ...M, 'Manual Run': [{ trigger: 'ix_chain', site_id: 'site_a-com', ix_chain: { date: today, dispatch_id: 'D' + n, rest: [], part: 1, of: 1 } }] }, null, t)));
      const att = first(await TA(() => node('Index Attempt', { 'Index Plan': [part] }, null, t)));
      if (att.site_id && !att.skip) runs.push({ ...att });   // Save Index Attempt wrote it; the part then died in Sitemap Read 3
      log.push([n, 'started a.com', !!att.site_id]);
    }
    check('over the day\'s 30 watches, a.com (its part always dies before the reservation) is started at most ' + IX.CFG.gave_up_after + ' times, then left for tomorrow', started >= 1 && started <= (IX.CFG.gave_up_after || 2), J({ started, log: log.slice(0, 6) }));
    const part = first(await TA(() => node('Index Plan', { 'Manual Run': [{ trigger: 'ix_chain', site_id: 'site_a-com', ix_chain: { date: today, dispatch_id: 'D9', rest: [], part: 1, of: 1 } }], 'Load Sites (Index)': sites, 'Load Monitors (Index)': [{}], 'Load Index Runs': [] }, null, now)));
    const att = first(await TA(() => node('Index Attempt', { 'Index Plan': [part] }, null, now)));
    const sj = T(() => JSON.parse(att.sitemaps_json || '{}'));
    check('the attempt row is an unfinished-run row of this run (site_id + run_at of the plan, nothing inspected, reservation + attempt flags, the chain\'s id) with exactly the run table\'s columns',
      att.site_id === 'site_a-com' && att.run_at === part.run_at && att.inspected === 0 && sj.reservation === true && sj.attempt === true && sj.chain_id === 'D9'
      && RUN_COLS.length > 0 && J(Object.keys(att).sort()) === J([...RUN_COLS].sort()), J({ att, cols: RUN_COLS.length }));
    check('its note is plain words and makes no claim about figures of today', /had not finished/.test(S0(att.note)) && !/[–—…“”]/.test(S0(att.note)), S0(att.note));
    const disp = first(await TA(() => node('Index Attempt', { 'Index Plan': [{ dispatch: true, chain: ['x'] }] }, null, now)));
    check('a dispatch (no website) writes no attempt row', disp.skip === true, J(disp));
    // an attempt row that never got further is not "the run before" (E3: the lanes read whether the previous run read the sitemap completely)
    const pr = first(await TA(() => node('Index Plan', { 'Manual Run': [{ domain: 'a.com' }], 'Load Sites (Index)': sites, 'Load Monitors (Index)': [{}],
      'Load Index Runs': [{ site_id: 'site_a-com', run_at: today + 'T09:00:00.000Z', inspected: 0, sitemaps_json: J({ reservation: true, attempt: true }) },
        { site_id: 'site_a-com', run_at: '2026-11-02T09:00:00.000Z', inspected: 30, sitemaps_json: J({ complete: true, home_host: 'www.a.com' }) }] }, null, now)));
    check('an attempt row is skipped when the plan reads the run before (yesterday\'s complete read still counts)', pr.prev_complete === true && pr.home_host_prev === 'www.a.com', J(pr));
    // wiring: the attempt is saved before anything that can fail, and the reservation replaces it
    const saveAtt = N('Save Index Attempt'); const saveRes = N('Save Index Reservation');
    const keys = (n) => (((n.parameters || {}).filters || {}).conditions || []).map(c => c.keyName).sort();
    check('wiring: Site To Check? -> Index Attempt -> Any Attempt? -> Save Index Attempt -> the site\'s loads; both saves upsert on site_id + run_at',
      outs('Site To Check? (Index)', 0).includes('Index Attempt') && outs('Any Attempt?', 0).includes('Save Index Attempt') && outs('Save Index Attempt').includes('Load Index Pages')
      && (saveAtt.parameters || {}).operation === 'upsert' && J(keys(saveAtt)) === J(['run_at', 'site_id']) && (saveRes.parameters || {}).operation === 'upsert' && J(keys(saveRes)) === J(['run_at', 'site_id']),
      J({ stc: outs('Site To Check? (Index)'), att: (saveAtt.parameters || {}).operation, res: (saveRes.parameters || {}).operation }));
    const toLoads = reach('Index Attempt', new Set(['Load Index Pages']));
    check('nothing runs between the run guard and the attempt row: Site To Check? -> Index Attempt only, and no sitemap round or Search Console call before the site\'s loads',
      J(outs('Site To Check? (Index)', 0)) === J(['Index Attempt']) && J(outs('Index Attempt')) === J(['Any Attempt?']) && !toLoads.has('Sitemap Requests 1') && !toLoads.has('GSC Sites (Index)') && toLoads.has('Save Index Attempt'), J([...toLoads]));
  });

  // =================================================================================================================================
  await guard('IXR3 R3 three-level sitemap trees', async () => {
    const SN = 'IXR3 (R3) a three-level sitemap tree (an index of indexes) that fits under the 50-sitemap cap is read completely in the 7 rounds again (wave 1 read it whole, wave 2 left 43-47 leaves partial); flat indexes and the 49 x 6,000 tree stay bounded';
    begin(SN); const check = mkCheck(SN);
    const T0 = Date.parse('2026-11-03T10:15:00Z');
    const site = { site_id: 's1', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com', gsc_connected: true, home_host_prev: '' };
    const xmlSet = (locs) => '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locs.map(l => '<url><loc>' + l + '</loc></url>').join('') + '</urlset>';
    const xmlIdx = (locs) => '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + locs.map(l => '<sitemap><loc>' + l + '</loc></sitemap>').join('') + '</sitemapindex>';
    // root /sitemap.xml -> `subs` sub-indexes -> `leaves` leaves of `per` addresses, spread over the sub-indexes
    const tree = async (subs, leaves, per) => {
      const M = { 'Index Sites': [site], 'GSC Sitemaps List': [{}], 'Sitemaps List Requests': [{ skip: true }] }; const by = []; let last = null;
      const share = (k) => Array.from({ length: leaves }, (_, i) => i).filter(i => i % subs === k);
      const answer = (q) => q.home ? { statusCode: 200, headers: {}, data: '<html></html>' } : q.robots ? { statusCode: 200, headers: {}, data: 'User-agent: *\n' }
        : /\/sitemap\.xml$/.test(q.url) ? { statusCode: 200, headers: {}, data: xmlIdx(Array.from({ length: subs }, (_, k) => W + '/idx-' + k + '.xml')) }
        : /\/idx-(\d+)\.xml$/.test(q.url) ? { statusCode: 200, headers: {}, data: xmlIdx(share(Number(q.url.match(/idx-(\d+)/)[1])).map(i => W + '/sm-' + i + '.xml')) }
        : { statusCode: 200, headers: {}, data: xmlSet(Array.from({ length: per }, (_, j) => W + '/' + q.url.replace(/^.*\/sm-(\d+)\.xml$/, 'c$1') + '/p' + j)) };
      for (let r = 1; r <= 12; r++) {
        if (!has('Sitemap Requests ' + r)) break;
        const q = await node('Sitemap Requests ' + r, M, null, T0); M['Sitemap Requests ' + r] = q;
        const asked = q.filter(x => !x.skip); by.push(asked.filter(x => /\/(sm|idx)-/.test(x.url)).length);
        if (asked.length) M['Fetch Sitemaps ' + r] = asked.map(answer);
        last = await node('Sitemap Read ' + r, M, null, T0); M['Sitemap Read ' + r] = last;
      }
      const st = (last || [])[0] || {};
      return { by, urls: (st.urls || []).length, left: (st.next || []).length, complete: T(() => IX.sitemapComplete(st)) };
    };
    for (const [subs, leaves] of [[2, 46], [2, 47], [3, 45], [5, 44], [2, 42]]) {
      const t = await TA(() => tree(subs, leaves, 20));
      check('root -> ' + subs + ' sub-indexes -> ' + leaves + ' leaves of 20: complete, ' + (leaves * 20) + ' addresses, never more than 10 sitemaps a round',
        !t.__error && t.complete === true && t.urls === leaves * 20 && Math.max(...t.by) <= IX.CFG.sitemap_batch_max, J(t));
    }
    check('the batch after an index of indexes stays bounded (at most sitemap_batch_max)', Number(IX.CFG.sitemap_batch_deep) > Number(IX.CFG.sitemap_batch_first) && Number(IX.CFG.sitemap_batch_deep) <= Number(IX.CFG.sitemap_batch_max), J(IX.CFG));
  });

  // =================================================================================================================================
  await guard('IXR4 R4 fixed page, new reading wait_new', async () => {
    const SN = 'IXR4 (R4) a page fixed on the site (fix_seen_at, action wait) whose next Google reading is "Discovered - currently not indexed" on a new page (wait_new) stays action wait: it is not filed under the client\'s steps for a day';
    begin(SN); const check = mkCheck(SN);
    const T0 = Date.parse('2026-11-05T10:15:00Z');
    const SITE = { site_id: 's1', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com', cap: 300, run_at: iso(T0) };
    const stored = [{ site_id: 's1', domain: 'example.com', url: W + '/new', state: 'excluded', cause: 'robots_blocked', action: 'wait', fix_seen_at: '2026-11-04T10:15:00.000Z', in_sitemap: true, sources: 'sitemap,ours', lane: 'new',
      first_seen_at: '2026-10-31T00:00:00Z', published_at: '2026-10-31T00:00:00Z', inspect_at: '2026-11-03T00:00:00Z', next_check_at: '2026-11-05T00:00:00Z', checks: 1, evidence: 'inspection', verdict: 'FAIL',
      coverage: 'Blocked by robots.txt', robots_state: 'DISALLOWED', last_crawl: '2026-11-02T00:00:00Z', fetch_at: '2026-11-04T10:15:00Z', http_status: 200 }];
    const m = T(() => IX.merge({ site: SITE, now: T0, stored, inventory: [], sitemap: { read: true, complete: true, urls: [{ loc: W + '/new', lastmod: '2026-10-31' }] }, ours: [{ url: W + '/new', published_at: '2026-10-31T00:00:00Z' }], search: { read: true, by: new Map() }, watch: [] }));
    const pl = T(() => IX.plan(m.pages, { cap: 300, used_today: 0, now: T0, property: SITE.gsc_property }));
    const v = { site_id: 's1', domain: 'example.com', site: SITE, pages: m.pages, moves: m.moves, prune: m.prune, sitemap: { complete: true, urls: 1, read: 1 }, home_links: [], robots: { status: 200, text: 'User-agent: *\nAllow: /\n' }, take: (pl.take || []).map(p => ({ url: p.url })) };
    const reqs = (pl.take || []).map(p => ({ site_id: 's1', inspect_url: p.url }));
    const ans = reqs.map(() => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'PAGE_FETCH_STATE_UNSPECIFIED' } } }));
    const sig = [{ site_id: 's1', url: W + '/new', f: IX.readFetch(W + '/new', { statusCode: 200, headers: {}, body: '<html><head><title>N</title></head><body><main>' + 'w '.repeat(300) + '</main></body></html>' }, null) }];
    const dg = first(await TA(() => node('Index Diagnose', { 'Index Inventory': [v], 'Google Events': [{ freeze: { freeze: false }, started: [], completed: [] }], 'Index Probe Requests': reqs, 'Inspect URL (Probe)': ans,
      'Index Inspect Requests': [], 'Inspect URL (Index)': [], 'Inspect Retry Requests': [], 'Inspect URL (Retry)': [], 'Page Signals': sig, 'Save Index Reservation': [{ site_id: 's1' }] }, null, T0)));
    const row = ((dg.all || []).find(r => /\/new$/.test(r.url))) || {};
    check('the page was inspected today and Google now says it is new and not crawled yet', reqs.length === 1 && row.cause === 'wait_new', J({ reqs: reqs.length, row }));
    check('its action is wait (waiting for Google), not site_fix; by_action counts no client step for it', row.action === 'wait' && !((T(() => IX.summarize(dg.all || [], {})).by_action || {}).site_fix), J(row));
  });

  // =================================================================================================================================
  await guard('IXR5 R5 plain failed-run note', async () => {
    const SN = 'IXR5 (R5) a run whose inventory or diagnosis throws says so in plain words: the run row\'s note, the callback\'s summary.note and the report carry no fragment of the exception; the raw message is kept for ops (why_detail, sitemaps_json.error_detail)';
    begin(SN); const check = mkCheck(SN);
    const T0 = Date.parse('2026-11-03T10:15:00Z');
    const site = { site_id: 's1', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com', gsc_connected: true, cap: 300, used_today: 0, run_at: iso(T0), on_demand: true, callback_url: 'https://app.example/hook', request_id: 'r1' };
    // a sitemap state whose `urls` is not a list: IX.merge throws a TypeError inside Index Inventory
    const M = { 'Index Sites': [site], 'Load Index Pages': [{ site_id: 's1', url: W + '/a', state: 'indexed', cause: '', action: 'none' }], 'Load Pages (Index)': [{}], 'Load Page Watch (Index)': [{}], 'Load Content Log (Index)': [{}],
      'Sitemap Read 7': [{ site_id: 's1', urls: 5, read: 1, sets: 1, fetched: [], next: [], errors: [], robots_status: 200 }], 'Pages Query Requests': [{ skip: true }], 'Pages Query More': [{ skip: true }], 'GSC Sitemaps List': [{}], 'Sitemaps List Requests': [{ skip: true }] };
    const inv = await TA(() => node('Index Inventory', M, null, T0)); const v = first(inv);
    check('the inventory failed (the test throws inside it)', v.failed === true, J(v).slice(0, 300));
    const dg = await TA(() => node('Index Diagnose', { 'Index Inventory': Array.isArray(inv) ? inv : [], 'Google Events': [{ freeze: { freeze: false }, started: [], completed: [] }], 'Index Probe Requests': [{ skip: true }], 'Inspect URL (Probe)': [],
      'Index Inspect Requests': [{ skip: true }], 'Inspect URL (Index)': [], 'Inspect Retry Requests': [{ skip: true }], 'Inspect URL (Retry)': [], 'Page Signals': [], 'Save Index Reservation': [] }, null, T0));
    const rr = first(await TA(() => node('Index Run Rows', { 'Index Diagnose': Array.isArray(dg) ? dg : [], 'Index Plan': [{ ...site, chain_id: '' }] }, null, T0)));
    const rep = first(await TA(() => node('Index Report', { 'Index Diagnose': Array.isArray(dg) ? dg : [], 'Index Run Rows': [rr], 'Google Events': [{}], 'Update Impact Rows': [], 'Load Update Impact': [] }, null, T0)));
    const bad = /failed:|TypeError|iterable|undefined|\bnull\b|is not a|Symbol/i;
    const note = S0(rr.note); const snote = S0((rep.summary || {}).note); const md = S0(rep.report_markdown);
    check('the run row\'s note says the website could not be checked, in plain words only', /could not check this website today/.test(note) && !bad.test(note), note);
    check('the callback\'s summary.note and the report say the same, with no fragment of the error', /could not check this website today/.test(snote) && !bad.test(snote) && !bad.test(md.split('\n').slice(0, 6).join(' ')), J({ snote, md: md.slice(0, 300) }));
    const sj = T(() => JSON.parse(rr.sitemaps_json || '{}'));
    check('the raw error is kept for ops (Index Diagnose why_detail; the run row\'s sitemaps_json.error_detail)', /inventory failed: .*not iterable/.test(S0(first(dg).why_detail)) && /not iterable/.test(S0(sj.error_detail)), J({ d: first(dg).why_detail, e: sj.error_detail }));
    check('IX.plainWhy: an exception becomes the plain sentence, a reason in words passes, nothing is empty',
      T(() => IX.plainWhy('diagnosis failed: Cannot read properties of undefined (reading \'x\')')) === IX.PLAIN_FAIL && T(() => IX.plainWhy('the service account has no access to a Search Console property for a.com')) === 'the service account has no access to a Search Console property for a.com'
      && T(() => IX.plainWhy('')) === 'not checked' && !/[–—…]/.test(S0(IX.PLAIN_FAIL)), J([T(() => IX.plainWhy('x failed: y')), IX.PLAIN_FAIL]));
    const sites = first(await TA(() => node('Index Sites', { 'Index Plan': [{ site_id: 's1', domain: 'example.com' }] }, [{ json: { error: { message: 'Request had insufficient authentication scopes. {"code":403}' } } }], T0)));
    check('a Search Console error answer reaches the client as a plain sentence; Google\'s own text stays in gsc_error_detail', !/scopes|\{/.test(S0(sites.gsc_error)) && /scopes/.test(S0(sites.gsc_error_detail)), J(sites));
  });

  // =================================================================================================================================
  await guard('IXR6 R6 a file above the read limit', async () => {
    const SN = 'IXR6 (R6) a sitemap or page file above the read limit never crosses the task runner (its size is known from the binary\'s metadata or Content-Length first) and becomes a clean partial reading: the tree is not complete and names the sitemap, the page is "could not check"';
    begin(SN); const check = mkCheck(SN);
    const T0 = Date.parse('2026-11-03T10:15:00Z');
    const site = { site_id: 's1', domain: 'example.com', canonical_host: 'www.example.com', gsc_property: 'sc-domain:example.com', gsc_connected: true, home_host_prev: '' };
    const big = IX.CFG.sitemap_read_bytes + 1e6;
    const xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + W + '/a</loc></url></urlset>';
    const bin = (data, bytes) => ({ data: Buffer.from(data).toString('base64'), mimeType: 'text/xml', ...(bytes ? { bytes, fileSize: (bytes / 1e6).toFixed(1) + ' MB' } : {}) });
    const reqs = [{ site_id: 's1', url: W + '/sitemap.xml', from: 'default' }];
    const prev = [{ site_id: 's1', fetched: [], urls: [], next: [{ url: W + '/sitemap.xml', from: 'default' }], errors: [], read: 0, sets: 0, robots_status: 200, robots_txt: '', home_host: 'www.example.com', home_links: [] }];
    const spy = { calls: 0 };
    const out = first(await TA(() => node('Sitemap Read 2', { 'Index Sites': [site], 'Sitemap Read 1': prev, 'Sitemap Requests 2': reqs, 'Fetch Sitemaps 2': [{ statusCode: 200, headers: {} }] },
      [{ json: { statusCode: 200, headers: {} }, binary: { data: bin(xml, big) } }], T0, spy)));
    check('a sitemap file of ' + Math.round(big / 1e6) + ' MB (by its metadata) is not read: the binary helper is never called', spy.calls === 0, J({ calls: spy.calls }));
    check('the sitemap is named with its reason and the tree is partial (no "not in the sitemap" advice), nothing crashed', (out.errors || []).some(e => /larger than we read/.test(S0(e.error))) && T(() => IX.sitemapComplete(out)) === false && !(out.urls || []).length, J(out).slice(0, 400));
    const spy2 = { calls: 0 };
    const cl = first(await TA(() => node('Sitemap Read 2', { 'Index Sites': [site], 'Sitemap Read 1': prev, 'Sitemap Requests 2': reqs, 'Fetch Sitemaps 2': [{ statusCode: 200, headers: { 'content-length': String(big) } }] },
      [{ json: { statusCode: 200, headers: {} }, binary: { data: bin(xml) } }], T0, spy2)));
    check('a Content-Length above the limit is enough to refuse the read', spy2.calls === 0 && (cl.errors || []).some(e => /larger than we read/.test(S0(e.error))), J({ calls: spy2.calls, errors: cl.errors }));
    const spy3 = { calls: 0 };
    const ok = first(await TA(() => node('Sitemap Read 2', { 'Index Sites': [site], 'Sitemap Read 1': prev, 'Sitemap Requests 2': reqs, 'Fetch Sitemaps 2': [{ statusCode: 200, headers: {} }] },
      [{ json: { statusCode: 200, headers: {} }, binary: { data: bin(xml, xml.length) } }], T0, spy3)));
    check('a file under the limit is still read (one address, complete)', spy3.calls === 1 && (ok.urls || []).length === 1 && T(() => IX.sitemapComplete(ok)) === true, J({ calls: spy3.calls, ok }).slice(0, 300));
    const spy4 = { calls: 0 };
    const pg = first(await TA(() => node('Page First Reads', { 'Page Fetch Requests': [{ site_id: 's1', url: W + '/huge', page_url: W + '/huge' }], 'Fetch Page (Index)': [{ statusCode: 200, headers: { 'content-type': 'text/html' } }] },
      [{ json: { statusCode: 200, headers: { 'content-type': 'text/html' } }, binary: { data: { data: Buffer.from('<html><head><title>H</title></head><body>hi</body></html>').toString('base64'), mimeType: 'text/html', bytes: IX.CFG.page_read_bytes + 1 } } }], T0, spy4)));
    check('a page file above its limit is not read and is "could not check" (no reading, so no fix and no cause from it)', spy4.calls === 0 && (pg.f || {}).ok === false && !!S0((pg.f || {}).error), J({ calls: spy4.calls, f: pg.f }));
  });

  // =================================================================================================================================
  await guard('IXR7 R7 a failed self-start raises an alert', async () => {
    const SN = 'IXR7 (R7) a self-start that n8n refused (Start Index Part / Start Next Index Part / Restart Index Part / Start Index Watch) raises one ops alert on the shared path (seo_ops_alerts first, then the webhook, settled from the status code), never a silent "success"; the run still settles';
    begin(SN); const check = mkCheck(SN);
    const T0 = Date.parse('2026-11-03T10:15:00Z');
    const starts = [['Start Index Part', 'Part', 'Before Settle'], ['Start Next Index Part', 'Next', 'Before Settle'], ['Restart Index Part', 'Restart', 'After Settle'], ['Start Index Watch', 'Watch', 'After Settle']];
    for (const [st, lb, g] of starts) {
      const chk = 'Index Start Alert (' + lb + ')';
      check('wiring: ' + st + ' -> Load Start Alerts (' + lb + ') -> ' + chk + ' -> Any Start Alert (' + g + ')? -> Save Index Start Alert (' + g + ')',
        outs(st).includes('Load Start Alerts (' + lb + ')') && outs('Load Start Alerts (' + lb + ')').includes(chk) && outs(chk).includes('Any Start Alert (' + g + ')?') && outs('Any Start Alert (' + g + ')?', 0).includes('Save Index Start Alert (' + g + ')'), J({ st: outs(st) }));
      const bad = first(await TA(() => node(chk, { [st]: [{ error: 'Workflow is not active and cannot be started.' }], ['Load Start Alerts (' + lb + ')']: [{}], 'Manual Run': [{ trigger: 'ix_chain' }] }, null, T0)));
      check(st + ' answered an error: one alert row (this workflow, this node, the error, pending)', !bad.skip && /Index Coverage/.test(S0(bad.workflow)) && S0(bad.node) === st && /not active/.test(S0(bad.message)) && bad.delivered === 'pending' && !!S0(bad.alert_key), J(bad));
      const good = first(await TA(() => node(chk, { [st]: [{ trigger: 'ix_chain', site_id: 's1' }], ['Load Start Alerts (' + lb + ')']: [{}], 'Manual Run': [{}] }, null, T0)));
      check(st + ' worked: no alert', good.skip === true, J(good));
    }
    // the same failure 10 minutes later is one row, not re-sent
    const a1 = first(await TA(() => node('Index Start Alert (Part)', { 'Start Index Part': [{ error: 'Workflow is not active' }], 'Load Start Alerts (Part)': [{}], 'Manual Run': [{}] }, null, T0)));
    const a2 = first(await TA(() => node('Index Start Alert (Part)', { 'Start Index Part': [{ error: 'Workflow is not active' }], 'Load Start Alerts (Part)': [{ ...a1 }], 'Manual Run': [{}] }, null, T0 + 10 * 60e3)));
    check('a repeat within the dedupe window is the same row and is not re-sent', a2.alert_key === a1.alert_key && a2.delivered !== 'pending' && Number(a2.count) === 2, J([a1.delivered, a2.delivered, a2.count]));
    // the pre-settle group goes on to Index Report on every branch (the run settles); the delivery is judged on the status code
    const pre = ['Any Start Alert (Before Settle)?', 'Send Start Webhook? (Before Settle)', 'Any Start Delivery? (Before Settle)'];
    check('wiring: every branch of the pre-settle alert group reaches Index Report, and no start reaches it any other way', pre.every(n => outs(n, 1).includes('Index Report')) && outs('Save Index Start Delivery (Before Settle)').includes('Index Report')
      && !outs('Start Index Part').includes('Index Report') && !outs('Start Next Index Part').includes('Index Report'), J(pre.map(n => [n, outs(n, 1)])));
    const post = N('Post Index Start Alert (Before Settle)'); const pr = ((post.parameters || {}).options || {}).response || {};
    check('the alert POST is neverError WITH fullResponse (a 404 is a failure, never a delivery)', ((pr.response || {}).fullResponse === true) && ((pr.response || {}).neverError === true), J(pr));
    const send = first(await TA(() => node('Index Start Send (Before Settle)', { 'Any Start Alert (Before Settle)?': [a1] }, null, T0)));
    check('no webhook configured (the placeholder of an un-applied build): nothing is posted, the alert stays on record', send.send_webhook === false && /on record/.test(S0(send.note)), J(send).slice(0, 300));
    const body = { alerts: [{ key: a1.alert_key }] };
    const d404 = first(await TA(() => node('Index Start Delivery (Before Settle)', { 'Index Start Send (Before Settle)': [{ webhook_body: body }], 'Any Start Alert (Before Settle)?': [a1] }, [{ json: { statusCode: 404, body: 'no_service' } }], T0)));
    const d200 = first(await TA(() => node('Index Start Delivery (Before Settle)', { 'Index Start Send (Before Settle)': [{ webhook_body: body }], 'Any Start Alert (Before Settle)?': [a1] }, [{ json: { statusCode: 200, body: 'ok' } }], T0)));
    check('a 404 from the webhook is written back as failed (re-tried by the sweep), a 200 as delivered by webhook', d404.delivered === 'failed' && !!S0(d404.next_attempt_at) && d200.delivered === 'webhook' && d200.alert_key === a1.alert_key, J([d404.delivered, d200.delivered]));
  });

  // =================================================================================================================================
  await guard('IXR8 R8 a second chain stops', async () => {
    const SN = 'IXR8 (R8) two chains that met become one: a chain part whose website was already checked today by ANOTHER chain (its final row names another dispatch) stops its own chain; a website done by the same chain or on demand is skipped and the chain goes on';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-11-03T15:00:00Z'); const today = '2026-11-03';
    const sites = ['a.com', 'b.com'].map(d => ({ site_id: 'site_' + d.replace('.', '-'), domain: d, canonical_host: 'www.' + d, gsc_property: 'sc-domain:' + d, status: 'active' }));
    const done = (chainId) => [{ site_id: 'site_a-com', run_at: today + 'T14:00:00.000Z', inspected: 10, sitemaps_json: J({ complete: true, checked: true, ...(chainId !== undefined ? { chain_id: chainId } : {}) }) }];
    const part = (runs) => ({ 'Manual Run': [{ trigger: 'ix_chain', site_id: 'site_a-com', ix_chain: { date: today, dispatch_id: 'D2', rest: ['site_b-com'], part: 1, of: 2, started_at: iso(now - 3600e3) } }], 'Load Sites (Index)': sites, 'Load Monitors (Index)': [{}], 'Load Index Runs': runs });
    const other = first(await TA(() => node('Index Plan', part(done('D1')), null, now)));
    const nxOther = first(await TA(() => node('Next Index Part', { 'Manual Run': part([])['Manual Run'], 'Index Plan': [other] }, null, now)));
    check('done today by another chain (D1): this chain part does nothing and stops its chain (stop_chain), the next part is not started', other.nothing_to_do === true && other.stop_chain === true && nxOther.skip === true && /stops/.test(S0(nxOther.reason)), J({ other, nxOther }));
    const mine = first(await TA(() => node('Index Plan', part(done('D2')), null, now)));
    const nxMine = first(await TA(() => node('Next Index Part', { 'Manual Run': part([])['Manual Run'], 'Index Plan': [mine] }, null, now)));
    check('done today by this same chain (a restarted part): skipped, the chain goes on to b.com', mine.nothing_to_do === true && !mine.stop_chain && nxMine.site_id === 'site_b-com', J({ mine, nxMine }));
    const od = first(await TA(() => node('Index Plan', part(done()), null, now)));
    const nxOd = first(await TA(() => node('Next Index Part', { 'Manual Run': part([])['Manual Run'], 'Index Plan': [od] }, null, now)));
    check('done today on demand (no chain id): skipped, the chain goes on', od.nothing_to_do === true && !od.stop_chain && nxOd.site_id === 'site_b-com', J({ od, nxOd }));
    // the rows say which chain they belong to
    const p = first(await TA(() => node('Index Plan', part([]), null, now)));
    const rr = first(await TA(() => node('Index Run Rows', { 'Index Diagnose': [{ site_id: 'site_a-com', domain: 'a.com', run_at: p.run_at, all: [], counts: {}, sitemap: { complete: true }, failed: false }], 'Index Plan': [p] }, null, now)));
    check('a chain part carries its dispatch id (Index Plan chain_id) and its final run row records it (sitemaps_json.chain_id)', p.chain_id === 'D2' && T(() => JSON.parse(rr.sitemaps_json).chain_id) === 'D2', J({ p: p.chain_id, s: rr.sitemaps_json }));
  });

  // =================================================================================================================================
  await guard('IXP1 production first run: a reading of the bare host is not borrowed for www', async () => {
    const SN = 'IXP1 (production first run 2026-10-29, techand.ai) the Site Tracker inspected https://techand.ai/x, which 308s to https://www.techand.ai/x, and Google answered "Page with redirect" naming the www address as its canonical; that reading must not be borrowed for the www row (which is the indexed page), and a reading naming this exact address as Google\'s canonical never makes it "a redirect" or "a copy of itself"';
    begin(SN); const check = mkCheck(SN);
    const now = Date.parse('2026-10-29T23:55:00Z');
    const site = { site_id: 'site_techand-ai', domain: 'techand.ai', canonical_host: 'www.techand.ai', gsc_property: 'sc-domain:techand.ai' };
    const wwwUrl = 'https://www.techand.ai/dynamics-365-finance-and-operations-uae', bareUrl = 'https://techand.ai/dynamics-365-finance-and-operations-uae';
    const watch = [{ url: bareUrl, status: 308, location: wwwUrl, inspect_at: iso(now - 0.95 * DAY), index_state: 'NEUTRAL', coverage: 'Page with redirect', google_canonical: wwwUrl }];
    const m = T(() => IX.merge({ site, now, stored: [], inventory: [{ url: wwwUrl }], sitemap: { read: true, complete: true, urls: [{ loc: wwwUrl }] }, ours: [], search: { read: false }, watch }));
    const row = ((m && m.pages) || []).find(p => S0(p.url) === wwwUrl) || {};
    check('the www row borrows no reading taken of the bare host', m && !m.__error && !row._watch, J(m && m.__error) + ' watch=' + J(row._watch));
    const watch2 = watch.concat([{ url: wwwUrl, status: 200, inspect_at: iso(now - 0.9 * DAY), index_state: 'PASS', coverage: 'Submitted and indexed', google_canonical: wwwUrl }]);
    const m2 = T(() => IX.merge({ site, now, stored: [], inventory: [{ url: wwwUrl }], sitemap: { read: true, complete: true, urls: [{ loc: wwwUrl }] }, ours: [], search: { read: false }, watch: watch2 }));
    const row2 = ((m2 && m2.pages) || []).find(p => S0(p.url) === wwwUrl) || {};
    check('with both readings stored, the www row borrows the www reading (whatever the order)', row2._watch && S0(row2._watch.url) === wwwUrl, J(row2._watch));
    const p = { url: wwwUrl, sources: 'sitemap,inventory', in_sitemap: true, lane: 'existing', impressions_28d: 973 };
    const d1 = T(() => IX.diagnose(p, { ok: true, reused: true, verdict: 'NEUTRAL', coverage: 'Page with redirect', google_canonical: wwwUrl }, null, { now, sitemap_complete: true, has_sitemap: true }));
    check('a reading naming this exact address as Google\'s canonical is not "a redirect" for it (it is the indexed page)', d1 && !d1.__error && S0(d1.cause) === '' && S0(d1.state) === 'indexed', J(d1));
    const d2 = T(() => IX.diagnose(p, { ok: true, reused: true, verdict: 'NEUTRAL', coverage: 'Duplicate, Google chose different canonical than user', google_canonical: wwwUrl }, null, { now, sitemap_complete: true, has_sitemap: true }));
    check('nor "a copy of" itself', d2 && !d2.__error && S0(d2.cause) === '' && !S0(d2.merge_into), J(d2));
    const d3 = T(() => IX.diagnose({ ...p, url: bareUrl }, { ok: true, reused: true, verdict: 'NEUTRAL', coverage: 'Page with redirect', google_canonical: wwwUrl }, null, { now, sitemap_complete: true, has_sitemap: true }));
    check('control: the bare-host row with the same reading is still a redirect', d3 && S0(d3.cause) === 'redirect', J(d3));
    const d4 = T(() => IX.diagnose({ ...p, url: 'https://www.techand.ai/old-page' }, { ok: true, verdict: 'NEUTRAL', coverage: 'Page with redirect', google_canonical: wwwUrl }, null, { now, sitemap_complete: true, has_sitemap: true }));
    check('control: a real redirect to another page stays a redirect', d4 && S0(d4.cause) === 'redirect', J(d4));
  });
};

if (require.main === module) {
  const results = [];
  const H = { results, save: () => {} };
  const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log('   !! scenario "' + name + '" aborted at: ' + String(e && e.message || e)); results.push({ scenario: name, node: 'scenario aborted', ok: false }); } };
  const begin = (sn) => { console.log('\n########## ' + sn + ' ##########'); };
  module.exports({ H, guard, begin }).then(() => { const f = results.filter(r => !r.ok).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); });
}
