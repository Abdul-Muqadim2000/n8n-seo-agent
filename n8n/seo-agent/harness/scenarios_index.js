// IX1-IX17 (Index coverage, 2026-10-29, docs/indexing-2026-10-29/DESIGN.md): which pages Google left out, why, and what to do. Every check runs the
// GENERATED code (harness/code_v4, written by build_index_coverage.py) on real evidence where it exists: techand.ai's URL Inspection answers,
// sitemap, Search Console sitemaps list and pages of 2026-10-14 (fixtures_ra2.js gsc595), Google's Search Status Dashboard feed
// (fixtures_index/incidents_2026-10-29.json, fetched 2026-10-29) and the spam-policies page of the same day (scripts removed). Called from
// scenarios_v5.js just before the report (one line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
    const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); if (a < 0 || b < 0) throw new Error(n + ' is not inlined in ' + file); return src.slice(a, b + 6); }).join('\n');
    return new Function('URL', 'structuredClone', body + '\nreturn { ' + names.join(', ') + ' };')(undefined, undefined); };
  const { PW, IX } = kits('Index_Diagnose.js', ['PW', 'IX']);
  const TELL = /[—‘’“”…]/;
  const PROMISE = /will be indexed|guarantee|instant/i;
  const DAY = 864e5; const NOW = Date.parse('2026-10-29T09:15:00.000Z'); const iso = (ms) => new Date(ms).toISOString();
  const SITE = { site_id: 'site_techand-ai', domain: 'techand.ai', canonical_host: 'www.techand.ai', gsc_property: 'sc-domain:techand.ai' };
  const W = 'https://www.techand.ai';
  const G = require('./fixtures_ra2.js').gsc595;
  const ANS = new Map(); G.requests.forEach((q, i) => { if (q.kind === 'inspect' && q.inspect_url) ANS.set(IX.key(q.inspect_url), G.answers[i]); });
  const ansBy = (cov) => [...ANS.entries()].find(([, a]) => a && a.inspectionResult && a.inspectionResult.indexStatusResult.coverageState === cov);
  const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: '', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL', ...o } } });
  const INCIDENTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures_index', 'incidents_2026-10-29.json'), 'utf8'));
  const POLICY = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_index', 'spam_policies_2026-10-29.html.gz'))).toString('utf8');
  const WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'index_wiring.json'), 'utf8'));
  const page = (o) => ({ site_id: SITE.site_id, domain: 'techand.ai', url: W + '/x', lane: 'existing', sources: 'sitemap', in_sitemap: true, state: 'unknown', checks: 0, ...o });
  const dx = (p, reading, fetch, c) => IX.diagnose(p, reading, fetch, { now: NOW, watch_since: iso(NOW - 60 * DAY), sitemap_complete: true, has_sitemap: true, ...(c || {}) });
  const R = (o) => IX.readInspection(insp(o));
  // fix wave 1 (X3): page x day rows -> the four page-only windows Search Analytics now answers (each window ends lag_days before `now`)
  const WIN = (rows, now) => { const w = { truncated: {} }; const ws = IX.saWindows(now); w.end = ws[0].end;
    for (const x of ws) { const by = new Map(); for (const r of rows) { const d = r.keys[1]; if (d < x.start || d > x.end) continue; const e = by.get(r.keys[0]) || { keys: [r.keys[0]], clicks: 0, impressions: 0 }; e.clicks += r.clicks || 0; e.impressions += r.impressions || 0; by.set(r.keys[0], e); } w[x.days] = [...by.values()]; }
    return w; };

  // =================================================================================================================================
  await guard('IX1 every cause of DESIGN §4', async () => {
    const SN = 'IX1 Index coverage: every cause row of DESIGN §4 from the documented enum fields first, the coverage string second, our fetch third; the action class and the state follow; the client sentence is plain and promises nothing';
    reset(); begin(SN); const check = mkCheck(SN);
    const cases = [];
    const one = (label, p, r, f, want, c) => { const d = dx(page(p), r, f, c); cases.push([label, d, want]); return d; };
    const [kIdx, aIdx] = [...ANS.entries()].find(([, a]) => a.inspectionResult.indexStatusResult.verdict === 'PASS');
    one('indexed (a real PASS answer)', { url: W + '/capabilities/business-applications' }, IX.readInspection(aIdx), null, ['', 'none', 'indexed']);
    one('indexed, not in the sitemap', { url: W + '/about', in_sitemap: false, sources: 'search' }, IX.readInspection(aIdx), null, ['indexed_not_in_sitemap', 'site_fix', 'indexed']);
    one('wait_new: a page we published 5 days ago, unknown to Google', { url: W + '/new', lane: 'new', sources: 'sitemap,ours', published_at: iso(NOW - 5 * DAY) }, R({ coverageState: 'URL is unknown to Google', pageFetchState: 'PAGE_FETCH_STATE_UNSPECIFIED', indexingState: 'INDEXING_STATE_UNSPECIFIED', robotsTxtState: 'ROBOTS_TXT_STATE_UNSPECIFIED' }), null, ['wait_new', 'wait', 'not_indexed']);
    const unk = ansBy('URL is unknown to Google');
    one('unknown_to_google (a real answer, page in the sitemap)', { url: W + '/u' }, IX.readInspection(unk[1]), null, ['unknown_to_google', 'links', 'not_indexed']);
    one('not_in_sitemap (unknown, nobody lists it)', { url: W + '/u2', in_sitemap: false, sources: 'inventory' }, IX.readInspection(unk[1]), null, ['not_in_sitemap', 'site_fix', 'not_indexed']);
    const disc = ansBy('Discovered - currently not indexed');
    one('discovered_not_crawled (a real answer)', { url: W + '/d' }, IX.readInspection(disc[1]), null, ['discovered_not_crawled', 'links', 'not_indexed']);
    const crawl = ansBy('Crawled - currently not indexed');
    const dq = one('crawled_not_indexed (a real answer)', { url: W + '/c' }, IX.readInspection(crawl[1]), null, ['crawled_not_indexed', 'quality', 'not_indexed']);
    one('noindex (meta tag, page in the sitemap)', { url: W + '/n' }, R({ indexingState: 'BLOCKED_BY_META_TAG', coverageState: "Excluded by 'noindex' tag" }), null, ['noindex', 'site_fix', 'excluded']);
    one('noindex_intended (nobody lists it, no impressions)', { url: W + '/n2', in_sitemap: false, sources: 'inventory' }, R({ indexingState: 'BLOCKED_BY_HTTP_HEADER' }), null, ['noindex_intended', 'leave_out', 'excluded']);
    one('robots_blocked (in the sitemap)', { url: W + '/r' }, R({ robotsTxtState: 'DISALLOWED', pageFetchState: 'BLOCKED_ROBOTS_TXT', coverageState: 'Blocked by robots.txt' }), null, ['robots_blocked', 'site_fix', 'excluded']);
    one('robots_intended (nobody lists it)', { url: W + '/r2', in_sitemap: false, sources: 'inventory' }, R({ robotsTxtState: 'DISALLOWED' }), null, ['robots_intended', 'leave_out', 'excluded']);
    one('canonical_elsewhere (the sitemap lists a non-main address)', { url: W + '/a?ref=x' }, R({ userCanonical: W + '/a', coverageState: 'Alternate page with proper canonical tag' }), null, ['canonical_elsewhere', 'site_fix', 'excluded']);
    one('alternate (not in the sitemap)', { url: W + '/b-print', in_sitemap: false, sources: 'inventory' }, R({ userCanonical: W + '/b', coverageState: 'Alternate page with proper canonical tag' }), null, ['alternate', 'leave_out', 'excluded']);
    const dup = ansBy('Duplicate, Google chose different canonical than user');
    const dh = one('google_chose_other (a REAL answer: Google keeps the bare-host copy of the www page)', { url: dup[1].inspectionResult.indexStatusResult.userCanonical }, IX.readInspection(dup[1]), null, ['google_chose_other', 'duplicate', 'excluded']);
    check('the real duplicate is a host split: merge_into is Google\'s canonical on the other host, and the sentence says to redirect one address to the other',
      dh.host_only === true && /^https:\/\/techand\.ai\//.test(dh.merge_into) && /redirect/.test(IX.noteOf({ ...dh, url: 'x' })), J(dh));
    const dg = one('google_chose_other (another page)', { url: W + '/p1' }, R({ userCanonical: W + '/p1', googleCanonical: W + '/p2', coverageState: 'Duplicate, Google chose different canonical than user' }), null, ['google_chose_other', 'duplicate', 'excluded']);
    check('merge_into is the page Google chose', dg.merge_into === W + '/p2' && dg.host_only === false, J(dg));
    one('duplicate_no_canonical', { url: W + '/p3' }, R({ googleCanonical: W + '/p4', coverageState: 'Duplicate without user-selected canonical' }), null, ['duplicate_no_canonical', 'duplicate', 'excluded']);
    one('not_found in the sitemap -> site_fix', { url: W + '/gone' }, R({ pageFetchState: 'NOT_FOUND', coverageState: 'Not found (404)' }), null, ['not_found', 'site_fix', 'excluded']);
    one('not_found nobody lists or found -> leave_out', { url: W + '/gone2', in_sitemap: false, sources: 'inventory' }, R({ pageFetchState: 'NOT_FOUND' }), null, ['not_found', 'leave_out', 'excluded']);
    one('not_found that still had impressions -> site_fix', { url: W + '/gone3', in_sitemap: false, sources: 'search', last_impression_at: '2026-10-01' }, R({ pageFetchState: 'NOT_FOUND' }), null, ['not_found', 'site_fix', 'excluded']);
    one('soft_404', { url: W + '/s4' }, R({ pageFetchState: 'SOFT_404', coverageState: 'Soft 404' }), null, ['soft_404', 'site_fix', 'not_indexed']);
    one('server_error', { url: W + '/5xx' }, R({ pageFetchState: 'SERVER_ERROR', coverageState: 'Server error (5xx)' }), null, ['server_error', 'site_fix', 'not_indexed']);
    one('access_denied (403)', { url: W + '/priv' }, R({ pageFetchState: 'ACCESS_FORBIDDEN' }), null, ['access_denied', 'site_fix', 'not_indexed']);
    one('redirect in the sitemap -> site_fix', { url: W + '/old' }, R({ coverageState: 'Page with redirect' }), null, ['redirect', 'site_fix', 'excluded']);
    one('redirect nobody lists -> leave_out', { url: W + '/old2', in_sitemap: false, sources: 'inventory' }, R({ coverageState: 'Page with redirect' }), null, ['redirect', 'leave_out', 'excluded']);
    one('low_value (a tag archive Google has not crawled)', { url: W + '/tag/erp', in_sitemap: false, sources: 'inventory' }, IX.readInspection(disc[1]), null, ['low_value', 'leave_out', 'excluded']);
    one('unclassified (a coverage string Google never documented)', { url: W + '/q' }, R({ coverageState: 'Something new from Google' }), null, ['unclassified', 'none', 'not_indexed']);
    const nc = dx(page({ url: W + '/nc' }), IX.readInspection({ error: { code: 429, message: 'Quota exceeded for quota metric', status: 'RESOURCE_EXHAUSTED' } }), null);
    cases.push(['not_checked (quota)', nc, ['not_checked', 'none', 'error']]);
    // our fetch: third, and a hard fact of today over a soft reason of an older crawl
    one('our fetch: a crawled-not-indexed page that answers 404 today is not found', { url: W + '/c2' }, IX.readInspection(crawl[1]), { ok: true, http_status: 404, final_url: '', noindex: '', page_canonical: '' }, ['not_found', 'site_fix', 'excluded']);
    one('our fetch: an unknown page with a noindex header', { url: W + '/u3' }, IX.readInspection(unk[1]), { ok: true, http_status: 200, final_url: '', noindex: 'header', page_canonical: '' }, ['noindex', 'site_fix', 'excluded']);
    one('our fetch: a discovered page that redirects elsewhere today', { url: W + '/d2' }, IX.readInspection(disc[1]), { ok: true, http_status: 200, final_url: W + '/new-home', noindex: '', page_canonical: '' }, ['redirect', 'site_fix', 'excluded']);
    one('redirect_error (fix wave 1, E9: the enum REDIRECT_ERROR is the site\'s fix)', { url: W + '/loop', in_sitemap: false, sources: 'inventory' }, R({ pageFetchState: 'REDIRECT_ERROR', coverageState: 'Redirect error' }), null, ['redirect_error', 'site_fix', 'not_indexed']);
    one('our fetch never overrides a documented enum (robots stays robots)', { url: W + '/r3' }, R({ robotsTxtState: 'DISALLOWED' }), { ok: true, http_status: 404 }, ['robots_blocked', 'site_fix', 'excluded']);
    for (const [label, d, [cause, action, state]] of cases)
      check(label + ' -> ' + cause + ' / ' + action + ' / ' + state, d && d.cause === cause && d.action === action && d.state === state, J(d));
    check('every cause of DESIGN §4 is covered by a case above', IX.CAUSES.filter(c => c !== 'indexed').every(c => cases.some(([, d]) => d && d.cause === c)) && cases.some(([, d]) => d && d.cause === ''),
      J(IX.CAUSES.filter(c => c !== 'indexed' && !cases.some(([, d]) => d && d.cause === c))));
    const notes = cases.map(([, d]) => IX.noteOf({ ...d, url: W + '/x', merge_into: d.merge_into || '', http_status: 404, coverage: 'Something new from Google', _why: 'quota used up' }, {}));
    check('every client sentence: plain characters, no promise ("will be indexed", "guaranteed", "instant")', notes.every(n => n && !TELL.test(n) && !PROMISE.test(n)), J(notes.filter(n => TELL.test(n) || PROMISE.test(n))));
    const fz = IX.noteOf({ ...dq, url: W + '/c' }, { freeze: { freeze: true, title: 'November 2026 core update' } });
    check('quality while an update rolls out: action stays quality, the sentence says to wait for the update', dq.action === 'quality' && /wait until it finishes/.test(fz) && /November 2026 core update/.test(fz), fz);
  });

  // =================================================================================================================================
  await guard('IX2 the plan order and the caps', async () => {
    const SN = 'IX2 Index coverage: the daily plan (DESIGN §3) - new pages on day 1/3/7/14/28, indexed pages that lost every impression, the never-checked backlog (sitemap first, shallower, newer), due re-checks, then the watch; the cap clamped 20-1,200, minus what today already spent; a quota stop spends nothing';
    reset(); begin(SN); const check = mkCheck(SN);
    const ctx = { now: NOW, watch_since: iso(NOW - 90 * DAY) };
    const pages = [
      page({ url: W + '/w', state: 'indexed', inspect_at: iso(NOW - 40 * DAY), next_check_at: iso(NOW - DAY), evidence: 'inspection' }),                                   // 5 watch
      page({ url: W + '/r', state: 'not_indexed', cause: 'discovered_not_crawled', inspect_at: iso(NOW - 8 * DAY), next_check_at: iso(NOW - DAY), checks: 1 }),            // 4 re-check
      page({ url: W + '/deep/a/b', state: 'unknown' }),                                                                                                                       // 3
      page({ url: W + '/shallow', state: 'unknown', sitemap_lastmod: '2026-01-01' }),                                                                                         // 3
      page({ url: W + '/newer', state: 'unknown', sitemap_lastmod: '2026-10-01' }),                                                                                           // 3
      page({ url: W + '/gsc-only', state: 'unknown', in_sitemap: false, sources: 'search' }),                                                                                 // 3
      page({ url: W + '/rest', state: 'unknown', in_sitemap: false, sources: 'inventory' }),                                                                                  // 3
      page({ url: W + '/lost', state: 'indexed', inspect_at: iso(NOW - 20 * DAY), next_check_at: iso(NOW + 30 * DAY), _search: { impr14: 0, impr_before: 40, impr28: 5 } }), // 2
      page({ url: W + '/fresh', lane: 'new', sources: 'sitemap,ours', published_at: iso(NOW - 3.5 * DAY), state: 'not_indexed', inspect_at: iso(NOW - 2.4 * DAY), next_check_at: iso(NOW + 3 * DAY) }), // 1 (day 3)
      page({ url: W + '/left', state: 'excluded', action: 'leave_out', cause: 'alternate', inspect_at: iso(NOW - 10 * DAY), next_check_at: iso(NOW + 46 * DAY) }),          // not due
      page({ url: W + '/gone', state: 'excluded', cause: 'not_found', http_status: 404, in_sitemap: false, sources: 'inventory', inspect_at: iso(NOW - 10 * DAY), next_check_at: '' }), // never again
      page({ url: W + '/reused', state: 'unknown', _reuse: { ok: true } }),                                                                                                   // a fresh Site Tracker reading
    ];
    const pl = IX.plan(pages, { cap: 300, used_today: 0, now: NOW, ...ctx });
    const order = pl.take.map(p => p.url.replace(W, ''));
    check('the order: day-3 new page, the page that lost its impressions, the backlog (sitemap pages, newer lastmod, shallower; then Search Console pages; then the rest), the due re-check, the watch',
      J(order) === J(['/fresh', '/lost', '/newer', '/shallow', '/deep/a/b', '/gsc-only', '/rest', '/r', '/w']), J(order));
    check('never asked: a leave-out page before its 56 days, a 404 nobody lists, a page with a Site Tracker reading of the last 3 days', !order.includes('/left') && !order.includes('/gone') && !order.includes('/reused'), J(order));
    check('backlog_left counts the never-checked pages the plan did not reach', IX.plan(pages, { cap: 22, used_today: 20, now: NOW, ...ctx }).backlog_left === 5 - 0 && pl.backlog_left === 0, J([pl.backlog_left, IX.plan(pages, { cap: 22, used_today: 20, now: NOW, ...ctx }).backlog_left]));
    const small = IX.plan(pages, { cap: 22, used_today: 20, now: NOW, ...ctx });
    check('the cap is the day\'s: 22 a day with 20 spent earlier today leaves 2', small.limit === 2 && small.take.length === 2, J([small.limit, small.take.length]));
    check('the cap is clamped 20-1,200 and empty means 300', IX.capOf(5) === 20 && IX.capOf(5000) === 1200 && IX.capOf('') === 300 && IX.capOf(null) === 300 && IX.capOf('450') === 450, J([IX.capOf(5), IX.capOf(5000), IX.capOf('')]));
    check('a run that hit Google\'s quota today asks nothing more', IX.plan(pages, { cap: 300, stop: true, now: NOW, ...ctx }).take.length === 0, '');
    const nc = IX.nextCheck({ ...page({}), state: 'not_indexed', action: 'links', checks: 1 }, ctx), nc3 = IX.nextCheck({ ...page({}), state: 'not_indexed', action: 'links', checks: 6 }, ctx);
    check('re-checks of a not-indexed page: 7 days, then 14, then every 28', Math.round((Date.parse(nc) - NOW) / DAY) === 7 && Math.round((Date.parse(IX.nextCheck({ ...page({}), state: 'not_indexed', action: 'links', checks: 2 }, ctx)) - NOW) / DAY) === 14 && Math.round((Date.parse(nc3) - NOW) / DAY) === 28, J([nc, nc3]));
    check('the watch: indexed every 28 days, every 56 with impressions in the last 7 days; leave_out every 56; a 404 nobody lists never',
      Math.round((Date.parse(IX.nextCheck({ ...page({}), state: 'indexed', _impr7: 0 }, ctx)) - NOW) / DAY) === 28 && Math.round((Date.parse(IX.nextCheck({ ...page({}), state: 'indexed', _impr7: 3 }, ctx)) - NOW) / DAY) === 56
      && Math.round((Date.parse(IX.nextCheck({ ...page({}), state: 'excluded', action: 'leave_out' }, ctx)) - NOW) / DAY) === 56 && IX.nextCheck({ ...page({}), state: 'excluded', cause: 'not_found', http_status: 410, in_sitemap: false }, ctx) === '', '');
    const nn = IX.nextCheck({ ...page({ lane: 'new', sources: 'sitemap,ours', published_at: iso(NOW - 3.5 * DAY) }), state: 'not_indexed', action: 'wait' }, ctx);
    check('a new page is next due on its next day (published 3.5 days ago -> day 7)', Math.abs((Date.parse(nn) - (NOW - 3.5 * DAY + 7 * DAY)) / DAY) < 0.01, nn);
    check('the lane: a page we published 10 days ago is new, the same page 40 days on is existing; on the first run nothing is new by sight',
      IX.laneOf({ sources: 'ours', published_at: iso(NOW - 10 * DAY) }, ctx) === 'new' && IX.laneOf({ sources: 'ours', published_at: iso(NOW - 40 * DAY) }, ctx) === 'existing'
      && IX.laneOf({ sources: 'sitemap', in_sitemap: true, first_seen_at: iso(NOW) }, { now: NOW }) === 'existing'
      && IX.laneOf({ sources: 'sitemap', in_sitemap: true, first_seen_at: iso(NOW) }, { now: NOW, prev_complete: true, prev_complete_at: iso(NOW - DAY) }) === 'new'
      && IX.laneOf({ sources: 'sitemap', in_sitemap: true, first_seen_at: iso(NOW - DAY), _prev: { lane: 'new' } }, { now: NOW }) === 'new', '');   // fix wave 1 (E3): new by sight only after a complete read
  });

  // =================================================================================================================================
  await guard('IX3 evidence without quota', async () => {
    const SN = 'IX3 Index coverage: a Site Tracker inspection of the same URL in the last 3 days is reused (never repeated); impressions in the last 28 days of data count as indexed, no impressions prove nothing; a failed source keeps what was stored';
    reset(); begin(SN); const check = mkCheck(SN);
    const w = { url: W + '/a', inspect_at: iso(NOW - DAY), index_state: 'NEUTRAL', indexed: 'no', coverage: 'Crawled - currently not indexed', inspect_error: '' };
    check('a Site Tracker reading of yesterday is reused', !!IX.reuseOf(w, NOW) && IX.reuseOf(w, NOW).coverage === 'Crawled - currently not indexed', J(IX.reuseOf(w, NOW)));
    check('a reading 5 days old, or one that failed, is not', !IX.reuseOf({ ...w, inspect_at: iso(NOW - 5 * DAY) }, NOW) && !IX.reuseOf({ ...w, inspect_error: 'quota' }, NOW), '');
    const rows = [];
    for (let d = 0; d < 90; d++) { const day = new Date(Date.parse('2026-10-26T00:00:00Z') - d * DAY).toISOString().slice(0, 10);
      rows.push({ keys: [W + '/live', day], clicks: d < 28 ? 1 : 0, impressions: 3 });
      if (d >= 20) rows.push({ keys: ['https://techand.ai/lost', day], clicks: 0, impressions: 4 });
      if (d === 50) rows.push({ keys: ['https://other.com/x', day], clicks: 0, impressions: 9 }); }
    const ev = IX.searchEvidence(WIN(rows, NOW), SITE, { now: NOW });   // fix wave 1 (X3): page rows per window, no date dimension
    const live = ev.by.get(IX.key(W + '/live')), lost = ev.by.get(IX.key(W + '/lost'));
    check('page rows per window: 28-day impressions and clicks, the first day of the newest window with impressions, the 14-day loss; another host is dropped',
      ev.end === '2026-10-26' && live.impr28 === 84 && live.clicks28 === 28 && live.last_at === '2026-10-20' && lost.impr28 === 4 * 8 && lost.impr14 === 0 && lost.impr_before > 0 && lost.last_at === '2026-09-29'
      && !ev.by.get(IX.key('https://other.com/x')) && ev.by.size === 2, J({ end: ev.end, live, lost, size: ev.by.size }));
    const m = IX.merge({ site: SITE, now: NOW, stored: [], inventory: [{ site_id: SITE.site_id, url: W + '/quiet', title: 'Quiet page' }], sitemap: { read: true, complete: true, urls: [{ loc: W + '/live', lastmod: '' }, { loc: W + '/quiet', lastmod: '' }] },
      ours: [], search: { read: true, by: ev.by }, watch: [] });
    const get = (u) => m.pages.find(p => IX.same(p.url, u));
    check('impressions make a page indexed without a check (evidence: search, next check in 28 / 56 days); a page with none stays unknown',
      get(W + '/live').state === 'indexed' && get(W + '/live').evidence === 'search' && get(W + '/live').next_check_at > iso(NOW + 50 * DAY) && get(W + '/quiet').state === 'unknown', J(m.pages.map(p => [p.url, p.state, p.evidence])));
    check('the pages are stored on the canonical host (www.techand.ai), whatever host Search Console used', m.pages.every(p => p.url.startsWith(W + '/')), J(m.pages.map(p => p.url)));
    const prev = [{ site_id: SITE.site_id, url: W + '/quiet', state: 'not_indexed', in_sitemap: true, sources: 'sitemap', impressions_28d: 7, first_seen_at: iso(NOW - 30 * DAY) }];
    const m2 = IX.merge({ site: SITE, now: NOW, stored: prev, inventory: [], sitemap: { read: false, urls: [] }, ours: [], search: { read: false, by: new Map() }, watch: [] });
    check('a failed sitemap read never makes a page "not in the sitemap"; a failed Search Console read never erases its impressions',
      m2.pages[0].in_sitemap === true && /sitemap/.test(m2.pages[0].sources) && m2.pages[0].impressions_28d === 7 && m2.pages[0].first_seen_at === prev[0].first_seen_at, J(m2.pages[0]));
  });

  // =================================================================================================================================
  await guard('IX4 sitemaps, hosts and low-value pages', async () => {
    const SN = 'IX4 Index coverage: the sitemap tree (urlset, sitemapindex, robots.txt Sitemap lines, image locs ignored, CDATA, .gz named), the caps (50 sitemaps / 5,000 addresses a site), host-agnostic identity and own-host only, the low-value patterns';
    reset(); begin(SN); const check = mkCheck(SN);
    const real = IX.parseSitemap(G.sitemap.data);
    check('techand.ai\'s real sitemap: a urlset of ' + real.urls.length + ' pages, every one on www.techand.ai', real.kind === 'urlset' && real.urls.length >= 40 && real.urls.every(u => /^https:\/\/www\.techand\.ai/.test(u.loc)), J(real.urls.slice(0, 2)));
    const idx = '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + Array.from({ length: 60 }, (_, i) => '<sitemap><loc>https://techand.ai/sm-' + i + '.xml</loc><lastmod>2026-10-0' + (i % 9 + 1) + '</lastmod></sitemap>').join('') + '<sitemap><loc>https://other.com/s.xml</loc></sitemap></sitemapindex>';
    const p = IX.parseSitemap(idx);
    check('a sitemap index: 61 children read', p.kind === 'index' && p.sitemaps.length === 61, p.sitemaps.length);
    let st = IX.sitemapAccept({}, { url: 'https://www.techand.ai/sitemap.xml', from: 'default' }, { statusCode: 200, data: idx }, SITE);
    check('the children are queued up to 50 sitemaps a site (the one read counts), another host never', st.fetched.length + st.next.length === 50 && st.capped_sitemaps === true && !st.next.some(n => /other\.com/.test(n.url)), J([st.fetched.length, st.next.length]));
    const big = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' + Array.from({ length: 6000 }, (_, i) => '<url><image:image><image:loc>https://cdn.example/i' + i + '.png</image:loc></image:image><loc><![CDATA[https://techand.ai/p/' + i + '?a=1&amp;b=2]]></loc></url>').join('') + '</urlset>';
    st = IX.sitemapAccept({}, { url: 'https://www.techand.ai/s2.xml', from: 'child' }, { statusCode: 200, data: big }, SITE);
    check('a urlset of 6,000: capped at 5,000 addresses, the page loc not the image loc, CDATA and &amp; decoded, stored on the canonical host',
      st.urls.length === 5000 && st.capped === true && st.urls[0].loc === 'https://www.techand.ai/p/0?a=1&b=2' && !st.urls.some(u => /cdn\.example/.test(u.loc)), J(st.urls.slice(0, 2)));
    const gz = IX.sitemapAccept({}, { url: 'https://www.techand.ai/s.xml.gz', from: 'robots' }, { statusCode: 200, data: '\x1f\x8b...' }, SITE);
    check('a compressed sitemap is named as not read (never counted as read)', gz.read === 0 && /compressed/.test(gz.errors[0].error), J(gz));
    const e404 = IX.sitemapAccept({}, { url: 'https://www.techand.ai/sitemap.xml', from: 'default' }, { statusCode: 404, data: 'nf' }, SITE);
    check('a missing default /sitemap.xml is not an error worth naming; a failed listed one is', e404.read === 0 && !e404.errors.length
      && IX.sitemapAccept({}, { url: 'https://www.techand.ai/x.xml', from: 'robots' }, { statusCode: 500, data: '' }, SITE).errors.length === 1, J(e404));
    check('robots.txt Sitemap lines, any case', J(IX.robotsSitemaps('User-agent: *\nDisallow:\nSitemap: https://www.techand.ai/sitemap.xml\nsitemap:https://techand.ai/blog.xml\n')) === J(['https://www.techand.ai/sitemap.xml', 'https://techand.ai/blog.xml']), '');
    const roots = IX.sitemapRoots(SITE, 'Sitemap: https://techand.ai/sitemap.xml\nSitemap: https://cdn.other.com/s.xml', ['sc-domain:techand.ai', 'https://www.techand.ai/blog-sitemap.xml']);
    check('the roots: robots.txt lines, /sitemap.xml once (www and bare are one address), the submitted ones; other hosts and a domain property are not sitemaps',
      J(roots.map(r => r.url)) === J(['https://techand.ai/sitemap.xml', 'https://www.techand.ai/blog-sitemap.xml']), J(roots));
    check('host-agnostic identity: scheme, www and a trailing slash are one page; the query is another page; a subdomain is another site',
      IX.same('https://www.techand.ai/a/', 'http://techand.ai/a') && !IX.same('https://techand.ai/a', 'https://techand.ai/a?page=2') && !IX.own('https://blog.techand.ai/a', SITE) && IX.own('https://TECHAND.ai/a', SITE)
      && IX.norm('/x', SITE) === 'https://www.techand.ai/x' && IX.norm('https://other.com/x', SITE) === '' && IX.norm('https://techand.ai/logo.png', SITE) === '', '');
    const LOW = ['/tag/erp', '/category/news/', '/author/jane', '/blog/page/3', '/search?q=erp', '/cart', '/checkout/', '/my-account', '/feed/', '/?s=erp', '/shop?orderby=price', '/2025/03/', '/products?utm_source=x'];
    const OK = ['/', '/insights/peppol-uae', '/pages/about', '/products/erp', '/blog/tagging-best-practices', '/?p=12', '/search-engine-optimisation-uae'];
    check('low-value patterns: listings, filters, searches, carts, accounts, feeds, date archives are left out; real pages are not',
      LOW.every(u => IX.isLowValue('https://www.techand.ai' + u)) && OK.every(u => !IX.isLowValue('https://www.techand.ai' + u)),
      J({ missed: LOW.filter(u => !IX.isLowValue('https://www.techand.ai' + u)), wrong: OK.filter(u => IX.isLowValue('https://www.techand.ai' + u)) }));
  });

  // =================================================================================================================================
  await guard('IX5 link suggestions', async () => {
    const SN = 'IX5 Index coverage: for a page Google has not found or crawled, up to 5 existing INDEXED pages on the same topic (IDF-weighted shared words), never the page itself, never a page Google does not have, never a listing page';
    reset(); begin(SN); const check = mkCheck(SN);
    const rows = [
      { url: W + '/insights/peppol-e-invoicing-uae', title: 'Peppol e-invoicing in the UAE', state: 'not_indexed' },
      { url: W + '/peppol-access-point-uae', title: 'Peppol access point UAE', state: 'indexed', impressions_28d: 40 },
      { url: W + '/e-invoicing-software', title: 'E-invoicing software for UAE companies', state: 'indexed', impressions_28d: 90 },
      { url: W + '/insights/peppol-pint-ae-guide', title: 'PINT AE and Peppol: a guide', state: 'indexed', impressions_28d: 10 },
      { url: W + '/insights/einvoicing-deadlines', title: 'UAE e-invoicing deadlines', state: 'indexed' },
      { url: W + '/peppol-faq', title: 'Peppol questions', state: 'indexed' },
      { url: W + '/peppol-pricing', title: 'Peppol pricing', state: 'indexed' },
      { url: W + '/peppol-other-draft', title: 'Peppol other', state: 'not_indexed' },
      { url: W + '/tag/peppol', title: 'Peppol', state: 'indexed' },
      { url: W + '/dynamics-365-crm', title: 'Dynamics 365 CRM', state: 'indexed' },
    ];
    const s = IX.linkSuggestions(rows[0], rows);
    check('at most 5, topic pages only, ranked by shared rare words', s.length === 5 && s.every(x => /peppol|invoic/i.test(x.url + x.title)) && !s.some(x => /dynamics/.test(x.url)), J(s));
    check('never itself, never a not-indexed page, never a tag listing', !s.some(x => IX.same(x.url, rows[0].url)) && !s.some(x => /draft|\/tag\//.test(x.url)), J(s));
    check('a page with no shared topic gets no suggestion (no filler)', IX.linkSuggestions({ url: W + '/careers', title: 'Careers' }, rows).length === 0, '');
  });

  // =================================================================================================================================
  await guard('IX6 Google events, the policy page, the freeze', async () => {
    const SN = 'IX6 Index coverage: the real Search Status Dashboard feed (9 incidents on 2026-10-29) read into events (core / spam / other, rolling out vs complete), news only when a rollout starts or finishes, the spam-policies page fingerprint from its main text, the freeze while a core or spam update rolls out';
    reset(); begin(SN); const check = mkCheck(SN);
    const ev = IX.parseEvents(INCIDENTS);
    const k = (kind) => ev.filter(e => e.kind === kind).map(e => e.title).sort();
    check('9 events: 3 core, 4 spam, 2 other (the Discover update and the Serving incident), all complete', ev.length === 9 && k('core').length === 3 && k('spam').length === 4 && k('other').length === 2
      && ev.every(e => e.status === 'complete' && e.ended_at) && k('other').some(t => /Discover/.test(t)), J(ev.map(e => [e.title, e.kind, e.status])));
    const sept = ev.find(e => /September 2026 spam/.test(e.title));
    check('the September 2026 spam update: 2026-09-24 16:15 to 2026-10-08 08:00 UTC, its dashboard address', sept && sept.started_at.startsWith('2026-09-24T16:15') && sept.ended_at.startsWith('2026-10-08T08:00') && sept.url === 'https://status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu', J(sept));
    const first = IX.eventRows(ev, [], NOW);
    check('the first run stores every event and announces none of them (all finished weeks ago)', first.rows.length === 9 && !first.started.length && !first.completed.length, J([first.rows.length, first.started, first.completed]));
    const again = IX.eventRows(ev, first.rows, NOW + DAY);
    check('an unchanged feed writes nothing again', again.rows.length === 0, again.rows.length);
    const open = JSON.parse(J(INCIDENTS)); open.unshift({ ...open[0], id: 'NEWcore1', external_desc: 'November 2026 core update', begin: iso(NOW - 2 * DAY), end: undefined, modified: iso(NOW - DAY),
      most_recent_update: { status: 'SERVICE_INFORMATION', text: 'Released' }, uri: 'incidents/NEWcore1' });
    const ro = IX.eventRows(IX.parseEvents(open), first.rows, NOW);
    check('a new core update rolling out is news (started), stored as rolling_out', ro.started.length === 1 && ro.started[0].status === 'rolling_out' && ro.started[0].kind === 'core' && ro.rows.length === 1, J(ro));
    const fz = IX.freeze(first.rows.concat(ro.rows), NOW);
    check('while it rolls out quality suggestions are frozen, with the reason', fz.freeze === true && /November 2026 core update/.test(fz.reason) && !TELL.test(fz.reason), J(fz));
    check('no freeze from finished updates, from an "other" incident, or from a rollout the feed has kept open for 40 days',
      !IX.freeze(first.rows, NOW).freeze && !IX.freeze([{ kind: 'other', status: 'rolling_out', started_at: iso(NOW - DAY) }], NOW).freeze && !IX.freeze([{ kind: 'spam', status: 'rolling_out', started_at: iso(NOW - 40 * DAY) }], NOW).freeze
      && IX.freeze([{ kind: 'spam', status: 'rolling_out', started_at: iso(NOW - 2 * DAY), title: 'X spam update' }], NOW).freeze, '');
    const done = JSON.parse(J(open)); done[0].end = iso(NOW - 3600e3); done[0].most_recent_update = { status: 'AVAILABLE' };
    const fin = IX.eventRows(IX.parseEvents(done), first.rows.concat(ro.rows), NOW);
    check('when it finishes it is news again (completed) and the freeze lifts', fin.completed.length === 1 && fin.completed[0].status === 'complete' && !IX.freeze(first.rows.concat(fin.rows), NOW).freeze, J(fin.completed));
    const pt = IX.policyText(POLICY);
    check('the spam-policies page: its main text (the article) and its "Last updated" date', pt.text_len > 20000 && pt.last_updated === '2026-08-28' && /^[0-9a-f]{8}$/.test(pt.hash), J(pt));
    const p1 = IX.policyEvent({ statusCode: 200, data: POLICY }, [], NOW);
    check('the first reading is the baseline, never news (dated by the page\'s own "Last updated")', p1.read && p1.row && !p1.news && p1.row.kind === 'policy_doc' && p1.row.status === 'changed' && p1.row.started_at.startsWith('2026-08-28'), J(p1.row));
    const chrome = POLICY.replace(/<\/article>/, '</article><nav>a new menu item</nav>').replace(/<title>/i, '<title>New ');
    check('a change to the page around the article is not a policy change', IX.policyEvent({ statusCode: 200, data: chrome }, [p1.row], NOW).row === null, '');
    const changed = POLICY.replace(/(<article\b[^>]*>)/i, '$1<p>Policy circumvention now also covers a new practice described here.</p>');
    const p2 = IX.policyEvent({ statusCode: 200, data: changed }, [p1.row], NOW + DAY);
    check('a change to the policy text is news', p2.row && p2.news === true && /changed its spam policies/.test(p2.row.title), J(p2.row));
    check('a page that did not answer changes nothing and says why', IX.policyEvent({ statusCode: 503, data: '' }, [p1.row], NOW).read === false && IX.policyEvent({ statusCode: 200, data: '<html>short</html>' }, [], NOW).read === false, '');
    // the node, on the real feed as n8n delivers it (full response, text)
    reset();
    mock('Load Google Events', [{ json: {} }]);
    mock('Fetch Google Incidents', [{ json: { statusCode: 200, headers: {}, data: J(INCIDENTS) } }]);
    mock('Fetch Spam Policies', [{ json: { statusCode: 200, headers: {}, data: POLICY } }]);
    const g = (await run('Google Events', [{ json: {} }]))[0].json;
    const er = await run('Google Event Rows', [{ json: {} }]);
    check('Google Events (node): the feed and the page read; 10 rows to store (9 incidents + the policy baseline), exact seo_google_events columns', g.feed_read && g.policy_read && g.rows.length === 10
      && er.length === 10 && er.every(r => J(Object.keys(r.json).sort()) === J(WIRE.event_cols.slice().sort())), J({ fr: g.feed_read, pr: g.policy_read, n: g.rows.length, keys: Object.keys(er[0].json) }));
    reset(); mock('Load Google Events', [{ json: {} }]); mock('Fetch Google Incidents', [{ json: { statusCode: 500, headers: {}, data: 'oops' } }]); mock('Fetch Spam Policies', [{ json: { error: { message: 'ETIMEDOUT' } } }]);
    const gb = (await run('Google Events', [{ json: {} }]))[0].json;
    check('Google Events (node): a feed that failed changes nothing and says so', !gb.feed_read && /500/.test(gb.feed_why) && !gb.policy_read && gb.rows.length === 0 && gb.freeze.freeze === false, J(gb));
  });

  // =================================================================================================================================
  await guard('IX7 update impact', async () => {
    const SN = 'IX7 Index coverage: what a finished update did - windows of equal length before and after, 7 days after it ends and only once Search Console data (3 days behind) covers 7 days; pages with too few impressions left out; dropped / gained only on a 20%+ move that passes a two-sample Poisson test; refreshed as more days arrive';
    reset(); begin(SN); const check = mkCheck(SN);
    const ev = { event_id: 'gssd:x', kind: 'core', status: 'complete', title: 'October 2026 core update', started_at: '2026-10-01T10:00:00Z', ended_at: '2026-10-12T10:00:00Z' };
    check('3 days after it ends: no comparison yet', IX.impactWindows({ ...ev, ended_at: iso(NOW - 3 * DAY) }, NOW) === null, '');
    const w = IX.impactWindows(ev, NOW);
    check('17 days after: 14 days after (data ends 3 days back) against the 14 days before it started', w && w.after_from === '2026-10-13' && w.after_to === '2026-10-26' && w.days === 14 && w.before_to === '2026-09-30' && w.before_from === '2026-09-17', J(w));
    check('a long-finished update compares 28 days each side', IX.impactWindows({ ...ev, started_at: '2026-08-01T00:00:00Z', ended_at: '2026-08-10T00:00:00Z' }, NOW).days === 28, '');
    check('due once; not again within 7 days; again when more days are covered; never past 28 days; never for an update rolling out or a policy page',
      IX.impactDue([ev], [], SITE.site_id, NOW).length === 1 && IX.impactDue([ev], [{ site_id: SITE.site_id, event_id: 'gssd:x', after_from: '2026-10-13', after_to: '2026-10-22', compared_at: iso(NOW - 2 * DAY) }], SITE.site_id, NOW).length === 0
      && IX.impactDue([ev], [{ site_id: SITE.site_id, event_id: 'gssd:x', after_from: '2026-10-13', after_to: '2026-10-22', compared_at: iso(NOW - 8 * DAY) }], SITE.site_id, NOW).length === 1
      && IX.impactDue([{ ...ev, status: 'rolling_out' }, { ...ev, kind: 'policy_doc' }], [], SITE.site_id, NOW).length === 0, '');
    const before = [{ keys: [W + '/a'], clicks: 30, impressions: 1000, position: 6 }, { keys: [W + '/b'], clicks: 3, impressions: 100, position: 9 }, { keys: [W + '/c'], clicks: 1, impressions: 20, position: 30 },
      { keys: ['https://techand.ai/d'], clicks: 2, impressions: 200, position: 12 }, { keys: [W + '/e'], clicks: 0, impressions: 100, position: 20 }];
    const after = [{ keys: [W + '/a'], clicks: 10, impressions: 600, position: 9 }, { keys: [W + '/b'], clicks: 3, impressions: 95, position: 9 }, { keys: [W + '/c'], clicks: 0, impressions: 5, position: 40 },
      { keys: [W + '/d'], clicks: 5, impressions: 320, position: 8 }, { keys: [W + '/e'], clicks: 0, impressions: 85, position: 21 }];
    const cmp = IX.impactCompare(before, after, SITE, [{ url: W + '/a', state: 'indexed', cause: '' }]);
    const seg = Object.fromEntries(cmp.pages_json.map(p => [p.url.replace(W, ''), p.segment]));
    check('a: 1000 -> 600 dropped; b and e hold (5% / 15%); d (bare host in one window, www in the other: one page) gained; c is too small to judge',
      cmp.pages === 4 && cmp.dropped === 1 && cmp.gained === 1 && cmp.stable === 2 && seg['/a'] === 'dropped' && seg['/d'] === 'gained' && seg['/b'] === 'stable' && seg['/e'] === 'stable' && !('/c' in seg) && cmp.pages_json[0].url === W + '/a' && cmp.pages_json[0].state === 'indexed', J(cmp));
    const note = IX.impactNote(ev, cmp, w);
    check('the sentence: counts, the windows, the bar, and that only the pages that lost visibility are worth a review', /1 page\(s\) lost visibility, 1 gained and 2 held/.test(note) && /14 days before/.test(note) && /worth a review/.test(note) && !TELL.test(note), note);
    // the two nodes (they read the clock: the update is dated from today)
    reset();
    const evN = { ...ev, started_at: iso(Date.now() - 28 * DAY), ended_at: iso(Date.now() - 17 * DAY) };
    mock('Google Events', [{ json: { events: [evN] } }]); mock('Load Update Impact', [{ json: {} }]);
    mock('Index Sites', [{ json: { ...SITE, gsc_connected: true } }]); mock('Index Diagnose', [{ json: { site_id: SITE.site_id, domain: 'techand.ai', all: [{ url: W + '/a', state: 'indexed', cause: '' }] } }]);
    const rq = await run('Update Impact Requests', [{ json: {} }]);
    const wNow = IX.impactWindows(evN, Date.now());
    check('Update Impact Requests: two Search Analytics reads by page (before, after) over the windows, on the site\'s property', rq.length === 2 && rq.every(r => J(r.json.body.dimensions) === J(['page']) && /sc-domain%3Atechand\.ai/.test(r.json.url))
      && rq.find(r => r.json.side === 'before').json.body.startDate === wNow.before_from && rq.find(r => r.json.side === 'after').json.body.endDate === wNow.after_to, J(rq.map(r => r.json.body)));
    mock('GSC Impact Query', rq.map(r => ({ json: { rows: r.json.side === 'before' ? before : after } })));
    const ir = await run('Update Impact Rows', [{ json: {} }]);
    check('Update Impact Rows: one row, exact seo_update_impact columns, pages_json carries the dropped page first', ir.length === 1 && J(Object.keys(ir[0].json).sort()) === J(WIRE.impact_cols.slice().sort())
      && ir[0].json.dropped === 1 && JSON.parse(ir[0].json.pages_json)[0].segment === 'dropped', J(ir[0].json));
    mock('GSC Impact Query', rq.map(r => ({ json: r.json.side === 'before' ? { rows: before } : { error: { code: 500, message: 'backend' } } })));
    const ir2 = await run('Update Impact Rows', [{ json: {} }]);
    check('a side that could not be read writes nothing (no half comparison)', ir2.length === 1 && ir2[0].json.skip === true, J(ir2));
  });

  // =================================================================================================================================
  // IX8 - IX12: techand.ai end to end through the generated nodes (real inspection answers, real sitemap, real sitemaps list)
  const SITE_ROW = { site_id: SITE.site_id, domain: 'techand.ai', canonical_host: 'www.techand.ai', gsc_property: 'sc-domain:techand.ai', callback_url: 'https://app.example.test/api/hooks/n8n/hook-token', request_id: 'req-ix', status: 'active' };
  const saRows = (() => { const pr = G.answers[G.requests.findIndex(q => q.kind === 'pages')]; const out = [];
    for (const r of (pr.rows || []).slice(0, 12)) for (let d = 3; d < 31; d += 2) out.push({ keys: [r.keys[0], new Date(NOW - d * DAY).toISOString().slice(0, 10)], clicks: 0, impressions: Math.max(1, Math.round(r.impressions / 14)) });
    return out; })();
  const saKeys = new Set(saRows.map(r => IX.key(r.keys[0])));
  const QUIET = IX.parseSitemap(G.sitemap.data).urls.map(u => IX.norm(u.loc, SITE)).filter(u => u && !saKeys.has(IX.key(u)) && !/\/whatwedo$/.test(u) && IX.pathOf(u) !== '/');   // sitemap pages with no impressions
  const answerFor = (url) => ANS.get(IX.key(url)) || insp({ coverageState: 'URL is unknown to Google', pageFetchState: 'PAGE_FETCH_STATE_UNSPECIFIED' });
  // fix wave 1: the page x day fixture as Search Analytics now answers it - page rows of the window each request names
  const saAnswer = (q, rows) => { const b = q.json.body || {}; const by = new Map(); for (const r of rows) { const d = r.keys[1]; if (d < b.startDate || d > b.endDate) continue;
    const e = by.get(r.keys[0]) || { keys: [r.keys[0]], clicks: 0, impressions: 0 }; e.clicks += r.clicks || 0; e.impressions += r.impressions || 0; by.set(r.keys[0], e); } return { rows: [...by.values()] }; };
  const HOME_HTML = '<html><body><nav><a href="/capabilities">Capabilities</a><a href="/about">About</a></nav><main><a href="https://www.techand.ai/insights/new-ours">New</a></main></body></html>';
  const e2e = async (o) => {
    const opt = o || {};
    reset();
    // fix wave 1 (X1): one website per execution - a part of today's chain unless the scenario asks for the dispatch or an on-demand run
    if (opt.trigger !== null) mock('Manual Run', [{ json: opt.trigger || { trigger: 'ix_chain', site_id: SITE.site_id, parent_run_id: '1', ix_chain: { date: iso(Date.now()).slice(0, 10), started_at: iso(Date.now()), rest: [], part: 1, of: 1, attempt: 0, news: opt.chainNews || {} } } }]);
    mock('Load Sites (Index)', [{ json: { ...SITE_ROW, ...(opt.siteRow || {}) } }]);
    mock('Load Monitors (Index)', [{ json: { site_id: SITE.site_id, index_watch: opt.watch === undefined ? '' : opt.watch, index_daily_cap: opt.cap === undefined ? '' : opt.cap } }]);
    mock('Load Index Runs', opt.runs ? opt.runs.map(r => ({ json: r })) : [{ json: {} }]);
    const plan = await run('Index Plan', [{ json: {} }]);
    if (plan[0].json.nothing_to_do || plan[0].json.dispatch) return { plan };
    mock('Load Google Events', (opt.storedEvents || [{}]).map(json => ({ json })));
    if (opt.readFeed !== false) {
      mock('Fetch Google Incidents', [{ json: { statusCode: 200, headers: {}, data: J(INCIDENTS) } }]);
      mock('Fetch Spam Policies', [{ json: { statusCode: 200, headers: {}, data: POLICY } }]);
    }
    await run('Google Events', [{ json: {} }]);
    if (opt.events) store['Google Events'] = [{ json: { ...store['Google Events'][0].json, ...opt.events } }];
    const sites = await run('Index Sites', [{ json: { siteEntry: opt.siteEntry || [{ siteUrl: 'sc-domain:techand.ai', permissionLevel: 'siteFullUser' }, { siteUrl: 'sc-domain:someone-else.com', permissionLevel: 'siteOwner' }] } }]);
    await run('Sitemaps List Requests', [{ json: {} }]); mock('GSC Sitemaps List', [{ json: G.sitemaps }]);
    const sq = await run('Pages Query Requests', [{ json: {} }]);
    if (!sq[0].json.skip) mock('GSC Pages Query', sq.map(q => ({ json: opt.saFail ? { error: { code: 500, message: 'backend error' } } : opt.saAnswer ? opt.saAnswer(q) : saAnswer(q, saRows) })));
    const sq2 = await run('Pages Query More', [{ json: {} }]);
    if (!sq2[0].json.skip) mock('GSC Pages Query 2', sq2.map(q => ({ json: opt.saAnswer2 ? opt.saAnswer2(q) : { rows: [] } })));
    const smAnswer = opt.smAnswer || ((q) => q.json.home ? { statusCode: 200, headers: {}, data: HOME_HTML } : q.json.robots ? { statusCode: 200, headers: {}, data: opt.robots || 'User-agent: *\nAllow: /\nSitemap: https://www.techand.ai/sitemap.xml\n' } : (opt.smFail ? { statusCode: 503, headers: {}, data: '' } : G.sitemap));
    const r1 = await run('Sitemap Requests 1', [{ json: {} }]);
    mock('Fetch Sitemaps 1', r1.map(q => ({ json: smAnswer(q, 1) })));
    await run('Sitemap Read 1', [{ json: {} }]);
    const r2 = await run('Sitemap Requests 2', [{ json: {} }]); if (!r2[0].json.skip) mock('Fetch Sitemaps 2', r2.map(q => ({ json: smAnswer(q, 2) })));
    await run('Sitemap Read 2', [{ json: {} }]);
    const r3 = await run('Sitemap Requests 3', [{ json: {} }]); if (!r3[0].json.skip) mock('Fetch Sitemaps 3', r3.map(q => ({ json: smAnswer(q, 3) })));
    await run('Sitemap Read 3', [{ json: {} }]);
    mock('Load Index Pages', (opt.stored || [{}]).map(r => ({ json: r })));
    mock('Load Pages (Index)', [{ json: { site_id: SITE.site_id, url: W + '/capabilities', title: 'Capabilities | Tech&', source: 'sitemap' } }, { json: { site_id: SITE.site_id, url: 'https://techand.ai/old-gone-page', title: '', source: 'gsc', http_status: 404 } }]);
    mock('Load Page Watch (Index)', (opt.watchRows || [{ site_id: SITE.site_id, url: W + '/whatwedo', inspect_at: iso(Date.now() - DAY), index_state: 'PASS', indexed: 'yes', coverage: 'Submitted and indexed', inspect_error: '' }]).map(json => ({ json })));
    mock('Load Content Log (Index)', [{ json: { site_id: SITE.site_id, domain: 'techand.ai', status: 'published', published_url: W + '/insights/new-ours', published_at: iso(Date.now() - 4 * DAY) } }].concat((opt.log || []).map(json => ({ json }))));
    const inv = await run('Index Inventory', [{ json: {} }]);
    const res = await run('Index Reservation', [{ json: {} }]);
    mock('Save Index Reservation', opt.reserveFail ? [{ json: { error: 'table not reachable' } }] : res.filter(r => !r.json.skip).map((r, i) => ({ json: { id: 900 + i, ...r.json } })));
    const pr = await run('Index Probe Requests', [{ json: {} }]);
    const quotaAns = { error: { code: 429, message: 'Quota exceeded for quota metric \'Default\' and limit \'Default per day per property\'', status: 'RESOURCE_EXHAUSTED' } };
    const rateAns = { error: { code: 429, message: 'Quota exceeded for quota metric \'Default\' and limit \'Default per minute per property\'', status: 'RESOURCE_EXHAUSTED' } };
    if (!pr[0].json.skip) mock('Inspect URL (Probe)', pr.map(q => ({ json: opt.quota ? quotaAns : opt.rate ? rateAns : (opt.answer ? opt.answer(q.json.inspect_url) : answerFor(q.json.inspect_url)) })));
    const ir = await run('Index Inspect Requests', [{ json: {} }]);
    if (!ir[0].json.skip) mock('Inspect URL (Index)', ir.map(q => ({ json: opt.answer ? opt.answer(q.json.inspect_url) : answerFor(q.json.inspect_url) })));
    const rr = await run('Inspect Retry Requests', [{ json: {} }]);
    if (!rr[0].json.skip) mock('Inspect URL (Retry)', rr.map(q => ({ json: opt.rateAgain ? rateAns : (opt.answer ? opt.answer(q.json.inspect_url) : answerFor(q.json.inspect_url)) })));
    const fr = await run('Page Fetch Requests', [{ json: {} }]);
    if (!fr[0].json.skip) mock('Fetch Page (Index)', fr.map((q, i) => ({ json: opt.fetchAnswer ? opt.fetchAnswer(q.json.url, i) : opt.fetch200 || /unknown|insights\/new-ours/.test(q.json.url) || i % 3 === 0 ? { statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<html><head><title>A page</title></head><body><main>' + 'words '.repeat(400) + '</main></body></html>' }
      : i % 3 === 1 ? { statusCode: 301, headers: { location: W + '/somewhere-else' }, data: '' } : { statusCode: 404, headers: {}, data: 'nf' } })));
    const hr = await run('Fetch Hop Requests', [{ json: {} }]);
    if (!hr[0].json.skip) mock('Fetch Page (Final)', hr.map((q) => ({ json: opt.hopAnswer ? opt.hopAnswer(q.json.url) : { statusCode: 200, headers: {}, data: '<html><head><title>Elsewhere</title></head><body>x</body></html>' } })));
    await run('Page Signals', [{ json: {} }]);
    const dg = await run('Index Diagnose', [{ json: {} }]);
    const rows = await run('Index Page Rows', [{ json: {} }]);
    const dels = await run('Index Delete Rows', [{ json: {} }]);
    const hmoves = await run('Index History Moves', [{ json: {} }]);
    const hist = await run('Index History Rows', [{ json: {} }]);
    mock('Load Update Impact', [{ json: {} }]);
    const iq = await run('Update Impact Requests', [{ json: {} }]);
    if (!iq[0].json.skip) mock('GSC Impact Query', iq.map(() => ({ json: { rows: [] } })));
    await run('Update Impact Rows', [{ json: {} }]);
    const runRows = await run('Index Run Rows', [{ json: {} }]);
    if (opt.monday !== undefined) store['Index Diagnose'] = store['Index Diagnose'].map(i => ({ json: { ...i.json, monday: opt.monday, news_today: opt.news || 0 } }));
    const next = await run('Next Index Part', [{ json: {} }]);
    const rep = await run('Index Report', [{ json: {} }]);
    return { plan, sites, inv, res, pr, ir, rr, fr, hr, dg, rows, dels, hmoves, hist, runRows, next, rep, sq, sq2 };
  };

  await guard('IX8 techand.ai end to end', async () => {
    const SN = 'IX8 Index coverage: techand.ai through every generated node on its real Search Console answers - the plan, Search Console access (another customer\'s property never named), the real sitemap, the inventory on www.techand.ai, two probes then the rest, our own reads, the diagnosis, exact table columns, the run row';
    reset(); begin(SN); const check = mkCheck(SN);
    const X = await e2e({ monday: true });
    check('Index Plan: one item, the default cap 300, nothing spent today', X.plan.length === 1 && X.plan[0].json.cap === 300 && X.plan[0].json.used_today === 0 && X.plan[0].json.site_id === SITE.site_id, J(X.plan[0].json));
    check('Index Sites: the domain property, no other customer named', X.sites[0].json.gsc_property === 'sc-domain:techand.ai' && X.sites[0].json.gsc_connected === true && !/someone-else/.test(J(X.sites)), J(X.sites[0].json));
    const v = X.inv[0].json;
    check('Index Inventory: the real sitemap read (' + v.sitemap.urls + ' addresses), Search Console read, every page on www.techand.ai, our published page and the inventory page merged in',
      v.sitemap.read >= 1 && v.sitemap.urls >= 40 && v.search.read === true && v.pages.every(p => p.url.startsWith(W + '/')) && v.pages.some(p => /insights\/new-ours/.test(p.url) && /ours/.test(p.sources) && p.lane === 'new')
      && v.pages.some(p => /old-gone-page/.test(p.url)), J({ sm: v.sitemap, search: v.search, n: v.pages.length, www: v.pages.filter(p => !p.url.startsWith(W + '/')).map(p => p.url), ours: v.pages.filter(p => /new-ours/.test(p.url)).map(p => [p.sources, p.lane]), gone: v.pages.filter(p => /gone/.test(p.url)).map(p => p.url) }));
    check('the Site Tracker\'s reading of yesterday (/whatwedo) is reused, not asked again', v.reuse.some(u => /\/whatwedo$/.test(u)) && !v.take.some(t => /\/whatwedo$/.test(t.url)), J(v.reuse));
    check('two probes first, the rest after them, all on the property, 150 ms apart in the workflow', X.pr.length === 2 && X.ir.length === v.take.length - 2 && X.pr.concat(X.ir).every(q => q.json.body.siteUrl === 'sc-domain:techand.ai')
      && WIRE.inspect_batch.batchSize === 1 && WIRE.inspect_batch.batchInterval === 150, J([X.pr.length, X.ir.length, v.take.length, WIRE.inspect_batch]));
    check('our own reads: only pages Google does not have, at most 60', X.fr.length > 0 && X.fr.length <= 60 && X.fr.every(q => !/\/whatwedo$/.test(q.json.url)), X.fr.length);
    const d = X.dg[0].json;
    const all = d.all;
    check('every known page has a state and a sentence; inspected / reused / fetched counted', all.length === v.pages.length && all.every(r => ['indexed', 'not_indexed', 'excluded', 'unknown', 'error'].includes(r.state) && r.note)
      && d.counts.inspected === v.take.length && d.counts.reused >= 1 && d.counts.fetched === X.fr.length, J(d.counts));
    const byUrl = (re) => all.find(r => re.test(r.url));
    check('the real answers are diagnosed: an indexed page, a crawled-not-indexed page as quality, the www/bare duplicate as a host split', all.some(r => r.state === 'indexed') && all.some(r => r.action === 'quality' || r.cause === 'not_found' || r.cause === 'redirect')
      && all.some(r => r.cause === 'google_chose_other'), J(all.filter(r => r.state !== 'indexed').slice(0, 6)));
    check('Index Page Rows: exact seo_index_pages columns on every row', X.rows.length === all.length && X.rows.every(r => J(Object.keys(r.json)) === J(WIRE.page_cols)), J(Object.keys(X.rows[0].json)));
    check('Index History Rows: one row per page that got a state, exact columns', X.hist.length > 0 && X.hist.every(r => J(Object.keys(r.json).sort()) === J(WIRE.history_cols.slice().sort())) && X.hist.every(r => r.json.state !== 'unknown'), J(X.hist[0].json));
    const rr = X.runRows[0].json;
    check('Index Run Rows: one row, exact seo_index_runs columns, its counts add up', X.runRows.length === 1 && J(Object.keys(rr).sort()) === J(WIRE.run_cols.slice().sort())
      && rr.known === all.length && rr.indexed + rr.not_indexed + rr.excluded + rr.unknown + (rr.errors - d.counts.errors) === rr.known && rr.inspected === v.take.length && rr.quota_cap === 300, J(rr));
    const smj = JSON.parse(rr.sitemaps_json);
    check('the run row says what the sitemap reading found (for the app\'s "no sitemap submitted" / "sitemap errors" step): 1 submitted, 0 errors, 1 read, 45 addresses, robots.txt 200',
      smj.submitted === 1 && smj.submitted_errors === 0 && smj.read === 1 && smj.urls === 45 && smj.robots_status === 200 && smj.capped === false, rr.sitemaps_json);
    check('link suggestions only on `links` pages, as JSON lists of indexed pages', X.rows.filter(r => r.json.action === 'links').every(r => Array.isArray(JSON.parse(r.json.link_from)))
      && X.rows.filter(r => r.json.action !== 'links').every(r => r.json.link_from === ''), '');
    check('no client sentence promises anything or uses a typographic tell', X.rows.every(r => !TELL.test(r.json.note) && !PROMISE.test(r.json.note)), J(X.rows.find(r => TELL.test(r.json.note) || PROMISE.test(r.json.note))));
    // the callback (DESIGN §5)
    const rep = X.rep[0].json;
    H.save('index_coverage_techand.md', rep.report_markdown); H.save('index_coverage_techand_rows.json', X.rows.map(r => r.json));   // for eyeballing (OUT_DIR)
    const SHAPE = ['stage', 'status', 'domain', 'site_id', 'request_id', 'summary', 'report_markdown', 'cost', 'callback_url'];
    const SUM = ['known', 'indexed', 'not_indexed', 'excluded', 'unknown', 'backlog_left', 'new_pages', 'new_indexed', 'by_action', 'by_cause', 'dropped', 'freeze', 'freeze_reason', 'events', 'impact'];
    check('the callback on a Monday: stage index_coverage, the §5 shape, cost $0, the summary keys', X.rep.length === 1 && rep.stage === 'index_coverage' && rep.status === 'complete' && J(Object.keys(rep).sort()) === J(SHAPE.slice().sort())
      && J(Object.keys(rep.summary).sort()) === J(SUM.slice().sort()) && rep.cost.usd === 0 && rep.request_id === 'req-ix' && J(Object.keys(rep.summary.impact).sort()) === J(['dropped', 'event_title', 'gained', 'stable'])
      && rep.summary.events.every(e => J(Object.keys(e).sort()) === J(['ended_at', 'kind', 'started_at', 'status', 'title'])), J(rep));
    check('the report says what Google has, groups by action, and never promises', /^# Index coverage: techand\.ai/.test(rep.report_markdown) && /known pages in its index/.test(rep.report_markdown) && !PROMISE.test(rep.report_markdown.replace(/nothing here is submitted/, '')) && !TELL.test(rep.report_markdown), rep.report_markdown.slice(0, 600));
    const body = WIRE.callback.body;
    check('the POST body carries the §5 fields and the settled run ledger, nothing else', ["stage: 'index_coverage'", 'summary: $json.summary', 'report_markdown: $json.report_markdown', 'cost: $json.cost', 'run_ledger: $json.run_ledger', 'request_id: $json.request_id']
      .every(t => body.includes(t)) && !/callback_url/.test(body.replace('$json.callback_url', '')), body);
  });

  await guard('IX9 the callback rule, the second run of the day, quota and access', async () => {
    const SN = 'IX9 Index coverage: a quiet Tuesday sends nothing, a drop-out or Google news the same day does, an on-demand caller always; a second run the same day spends only what is left of the cap; a probe that hits Google\'s quota stops the site for the day and nothing is called "not indexed"; no access is reported, never inspected';
    reset(); begin(SN); const check = mkCheck(SN);
    const T = await e2e({ monday: false, news: 0 });
    check('a quiet Tuesday: no callback (the app reads the tables)', T.rep.length === 1 && T.rep[0].json.skip === true, J(T.rep[0].json));
    const N = await e2e({ monday: false, news: 1 });
    check('a Google update started or finished today: the callback goes out', N.rep.length === 1 && N.rep[0].json.stage === 'index_coverage', J(N.rep[0].json));
    const two = await e2e({ cap: 30, runs: [{ site_id: SITE.site_id, run_at: new Date().toISOString(), inspected: 25, note: '' }] });
    check('the second run of the day: 30 a day, 25 already spent -> at most 5 inspections', two.inv[0].json.plan.limit === 5 && (two.pr.filter(q => !q.json.skip).length + two.ir.filter(q => !q.json.skip).length) <= 5, J(two.inv[0].json.plan));
    const qd = await e2e({ runs: [{ site_id: SITE.site_id, run_at: new Date().toISOString(), inspected: 2, note: 'Google\'s daily URL Inspection quota for this property was used up; inspections stopped for today.' }] });
    check('a run after the quota was hit today inspects nothing', qd.pr[0].json.skip === true && qd.ir[0].json.skip === true, J([qd.pr[0].json, qd.inv[0].json.plan]));
    const Q = await e2e({ quota: true, monday: true });
    const qa = Q.dg[0].json;
    check('the probe hits the quota: the site\'s other inspections are not asked today', Q.ir.length === 1 && Q.ir[0].json.skip === true && qa.quota_stop === true, J([Q.ir[0].json, qa.quota_stop]));
    const err = qa.all.filter(r => r.state === 'error');
    check('the two probed pages: state error / not_checked, never "not indexed"; the run says why', err.length === 2 && err.every(r => r.action === 'none') && qa.all.filter(r => r.state === 'not_indexed').length === 0
      && /quota/.test(Q.runRows[0].json.note) && Q.runRows[0].json.errors >= 2, J({ err, note: Q.runRows[0].json.note }));
    // a page we published 3.5 days ago, read 2.5 days ago as "discovered": due on its day 3, so it is one of the two probes
    const prevNew = { site_id: SITE.site_id, url: QUIET[0], state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', evidence: 'inspection', coverage: 'Discovered - currently not indexed',
      inspect_at: iso(Date.now() - 2.5 * DAY), next_check_at: iso(Date.now() - DAY), in_sitemap: true, sources: 'sitemap,ours', lane: 'new', published_at: iso(Date.now() - 3.5 * DAY), first_seen_at: iso(Date.now() - 5 * DAY), checks: 1 };
    const QK = await e2e({ quota: true, stored: [prevNew], monday: true, log: [{ site_id: SITE.site_id, domain: 'techand.ai', status: 'published', published_url: QUIET[0], published_at: prevNew.published_at }] });
    const kept = QK.dg[0].json.all.find(r => IX.same(r.url, QUIET[0]));
    check('a page with an earlier reading keeps it when today\'s check fails (probed, quota answer, still "discovered", never "error")', QK.pr.some(q => IX.same(q.json.inspect_url, QUIET[0])) && kept && kept.state === 'not_indexed' && kept.cause === 'discovered_not_crawled', J({ kept, probes: QK.pr.map(q => q.json.inspect_url) }));
    reset();
    mock('Index Plan', [{ json: { site_id: SITE.site_id, domain: 'techand.ai', gsc_property_hint: '', cap: 300 } }]);
    const na = await run('Index Sites', [{ json: { siteEntry: [{ siteUrl: 'sc-domain:someone-else.com', permissionLevel: 'siteOwner' }] } }]);
    check('no access: kept, said, never inspected; another customer\'s property never named', na[0].json.gsc_connected === false && /no access/.test(na[0].json.gsc_error) && !/someone-else/.test(na[0].json.gsc_error), J(na[0].json));
    const off = await e2e({ watch: 'false' });
    check('a site with index_watch off is not checked on the schedule', off.plan[0].json.nothing_to_do === true, J(off.plan[0].json));
  });

  await guard('IX10 drop-outs, needs a person, the freeze in the run', async () => {
    const SN = 'IX10 Index coverage: a page indexed yesterday that Google now leaves out is a drop-out (dated, in the history, in the callback the same day); 4 unchanged re-checks of an actionable cause need a person; a core update rolling out freezes quality suggestions in the rows, the run and the callback';
    reset(); begin(SN); const check = mkCheck(SN);
    const crawl = ansBy('Crawled - currently not indexed')[1];
    const disc = ansBy('Discovered - currently not indexed')[1];
    const U1 = QUIET[0], U2 = QUIET[1];
    const stored = [
      { site_id: SITE.site_id, url: U1, state: 'indexed', cause: '', action: 'none', evidence: 'inspection', inspect_at: iso(Date.now() - 30 * DAY), next_check_at: iso(Date.now() - DAY), in_sitemap: true, sources: 'sitemap', first_seen_at: iso(Date.now() - 90 * DAY), indexed_since: iso(Date.now() - 80 * DAY), checks: 1, lane: 'existing' },
      { site_id: SITE.site_id, url: U2, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', evidence: 'inspection', coverage: 'Discovered - currently not indexed', inspect_at: iso(Date.now() - 29 * DAY), next_check_at: iso(Date.now() - DAY), in_sitemap: true, sources: 'sitemap', first_seen_at: iso(Date.now() - 120 * DAY), checks: 4, lane: 'existing' },
    ];
    const answer = (u) => IX.same(u, U1) ? crawl : IX.same(u, U2) ? disc : answerFor(u);
    const freezeEv = { events: [{ event_id: 'gssd:nov', kind: 'core', status: 'rolling_out', title: 'November 2026 core update', started_at: iso(Date.now() - 2 * DAY), ended_at: '', source: 'status_dashboard' }],
      freeze: { freeze: true, title: 'November 2026 core update', reason: 'Google\'s November 2026 core update is rolling out (since ' + iso(Date.now() - 2 * DAY).slice(0, 10) + '): page improvements wait until it finishes.', event_id: 'gssd:nov' }, started: [], completed: [] };
    const X = await e2e({ stored, answer, monday: false, events: freezeEv, fetch200: true });
    const d = X.dg[0].json;
    const r1 = X.rows.map(r => r.json).find(r => r.url === U1), r2 = X.rows.map(r => r.json).find(r => r.url === U2);
    check('the drop-out: indexed -> not indexed on an inspection, dated, listed', r1 && r1.state === 'not_indexed' && r1.cause === 'crawled_not_indexed' && r1.dropped_at && d.dropped.length === 1 && d.dropped[0].url === U1, J({ r1, dropped: d.dropped }));
    check('the history row of the change', X.hist.some(h => h.json.url === U1 && h.json.state === 'not_indexed' && h.json.cause === 'crawled_not_indexed'), J(X.hist.map(h => h.json)));
    check('the callback goes out the same day, not a Monday, carrying the drop-out', X.rep.length === 1 && X.rep[0].json.summary.dropped.length === 1 && X.rep[0].json.summary.dropped[0].url === U1, J(X.rep[0].json.summary && X.rep[0].json.summary.dropped));
    check('needs a person: the 5th reading of the same cause after 4 unchanged re-checks; next check in 28 days; the sentence says so', r2 && r2.checks === 5 && r2.needs_person === true && Math.round((Date.parse(r2.next_check_at) - Date.now()) / DAY) === 28 && /needs a person/.test(r2.note), J(r2));
    check('the freeze: the quality page keeps its action, the sentence says to wait for the update, the run row and the callback say frozen',
      r1.action === 'quality' && /wait until it finishes/.test(r1.note) && X.runRows[0].json.freeze === true && /November 2026 core update/.test(X.runRows[0].json.freeze_reason) && X.rep[0].json.summary.freeze === true, J({ note: r1.note, run: X.runRows[0].json.freeze_reason }));
    const again = await e2e({ stored: X.rows.map(r => r.json), answer, monday: false, fetch200: true });
    check('a second run with nothing new writes no unchanged row and no history', again.hist[0].json.skip === true || again.hist.every(h => h.json.url !== U1), J(again.hist.map(h => h.json)));
  });

  // =================================================================================================================================
  await guard('IX11 Site Admin: index_watch and index_daily_cap', async () => {
    const SN = 'IX11 Index coverage settings through Site Admin `monitors`: index_watch a yes / no (anything else refused), index_daily_cap a whole number kept 20-1,200 ("" back to the default), both kept as stored when not given, exact seo_monitors columns; "Track my site" carries them as stored';
    reset(); begin(SN); const check = mkCheck(SN);
    const MC = require('./table_cols.json').MONITORS;
    check('seo_monitors has the two new columns', MC.includes('index_watch') && MC.includes('index_daily_cap'), J(MC.slice(-3)));
    const admin = async (monitors, stored) => { reset(); const a = (await run('Admin Action', [{ json: { action: 'monitors', domain: 'techand.ai', monitors } }]))[0].json;
      mock('Load Monitors (Admin)', [{ json: stored || { site_id: SITE.site_id, domain: 'techand.ai' } }]); return { a, r: (await run('Monitor Row (Admin)', [{ json: {} }]))[0].json }; };
    const off = await admin({ index_watch: 'off', index_daily_cap: '450' });
    check('"off" is false, "450" is 450, exact columns', off.r.index_watch === false && off.r.index_daily_cap === 450 && J(Object.keys(off.r).sort()) === J(MC.slice().sort()), J(off.r));
    const clamp = await admin({ index_watch: true, index_daily_cap: 5000 });
    check('5,000 a day is kept to 1,200 (Google allows 2,000 a day per property, shared with the Site Tracker and the audits)', clamp.r.index_daily_cap === 1200 && clamp.r.index_watch === true, J(clamp.r));
    check('5 a day is raised to 20', (await admin({ index_daily_cap: 5 })).r.index_daily_cap === 20, '');
    const kept = await admin({ ai_pulse: false }, { site_id: SITE.site_id, domain: 'techand.ai', index_watch: false, index_daily_cap: 120 });
    check('a monitors save that does not name them keeps what is stored', kept.r.index_watch === false && kept.r.index_daily_cap === 120, J(kept.r));
    const blank = await admin({}, { site_id: SITE.site_id, domain: 'techand.ai' });
    check('never set: both stay empty (empty = on, 300 a day)', blank.r.index_watch === null && blank.r.index_daily_cap === null, J(blank.r));
    const cleared = await admin({ index_daily_cap: '' }, { site_id: SITE.site_id, domain: 'techand.ai', index_daily_cap: 120 });
    check('"" clears the cap back to the default', cleared.r.index_daily_cap === null, J(cleared.r));
    for (const [bad, re] of [[{ index_watch: 'maybe' }, /index_watch must be true or false/], [{ index_daily_cap: 'lots' }, /index_daily_cap must be a whole number/], [{ index_daily_cap: 12.5 }, /index_daily_cap must be a whole number/]]) {
      reset(); const r = await H.expectError('Admin Action', [{ json: { action: 'monitors', domain: 'techand.ai', monitors: bad } }], re);
      check('refused with its reason: ' + J(bad), r.ok, r.error);
    }
    reset();
    mock('Normalize Input', [{ json: { domain: 'techand.ai', competitors: [], request_id: 'r1', monitor_input: {} } }]);
    mock('Load Monitors (Track)', [{ json: { site_id: SITE.site_id, domain: 'techand.ai', index_watch: false, index_daily_cap: 80 } }]);
    const t = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('"Track my site" carries them as stored (the upsert would empty a column it is not given)', t.index_watch === false && t.index_daily_cap === 80 && J(Object.keys(t).sort()) === J(MC.slice().sort()), J(t));
  });

  // =================================================================================================================================
  await guard('IX12 the generated workflow', async () => {
    const SN = 'IX12 Index coverage: the generated workflow - every node reachable from its two doors, the manual entry on the schedule\'s path, 05:15 daily, no external call before the run ledger reserves, a $0 row with no DataForSEO probe, writes only its own five tables (plus the shared ledger / ops-alert rows), the callback after the settle, covered by the catch-up and the deploy manifest';
    reset(); begin(SN); const check = mkCheck(SN);
    const C = WIRE.connections; const outs = (n) => (C[n] || []).flat();
    const reach = (starts, blocked) => { const seen = new Set(), todo = [...starts]; while (todo.length) { const n = todo.pop(); if (seen.has(n) || (blocked || []).includes(n)) continue; seen.add(n); todo.push(...outs(n)); } return seen; };
    const R0 = reach(['Daily Schedule', 'Manual Run']);
    check('every node is reachable from the schedule or the manual entry', WIRE.nodes.every(n => R0.has(n)), J(WIRE.nodes.filter(n => !R0.has(n))));
    check('the manual entry feeds the schedule\'s own first node', J(outs('Daily Schedule')) === J(outs('Manual Run')), J([outs('Daily Schedule'), outs('Manual Run')]));
    check('daily at 05:15 in the engine\'s zone, mode index_coverage', WIRE.schedule.hour === 5 && WIRE.schedule.minute === 15 && WIRE.schedule.every === 'day' && WIRE.mode === 'index_coverage', J(WIRE.schedule));
    const before = reach(['Daily Schedule', 'Manual Run'], ['Reserve Run Ledger (Index)']);
    check('no call to Google or to a website before the run ledger reserves', WIRE.external.filter(n => before.has(n)).length === 0 && WIRE.external.includes('Inspect URL (Index)'), J(WIRE.external.filter(n => before.has(n))));
    const writes = Object.keys(WIRE.writes);
    check('it writes only its own five tables and the shared run-ledger / ops-alert rows', writes.every(t => WIRE.own_tables.includes(t) || WIRE.shared_tables.includes(t)) && WIRE.own_tables.length === 5
      && J(WIRE.own_tables) === J(['seo_google_events', 'seo_index_history', 'seo_index_pages', 'seo_index_runs', 'seo_update_impact']), J(WIRE.writes));
    check('the callback waits for the settle (Ledger Settle -> Ledger Join -> Callback Ledger -> Has Callback -> POST)', outs('Ledger Settle (Index)').includes('Ledger Join (Index)') && J(outs('Callback Ledger (Index)')) === J(['Has Callback (Index)?'])
      && outs('Has Callback (Index)?').includes('POST Index Report'), J([outs('Ledger Settle (Index)'), outs('Callback Ledger (Index)')]));
    const LW = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger_wiring.json'), 'utf8')).monitors['SEO Agent — Index Coverage'];
    check('the ledger: mode index_coverage, $0 estimate, no DataForSEO probe, the concurrency gate, no Claude node', LW && LW.mode === 'index_coverage' && LW.est.ai === 0 && LW.est.dfs === 0 && LW.no_dfs === true && LW.guard && LW.guard.if === 'Run Allowed? (Index)' && J(LW.ai_nodes) === '[]', J(LW));
    reset();
    mock('Index Plan', [{ json: { site_id: SITE.site_id, domain: 'techand.ai', cap: 300 } }]);
    const row = (await run('Run Ledger Row (Index)', [{ json: { id: 't', name: 'seo_run_ledger' } }]))[0].json;
    check('the reservation: $0, schedule:index_coverage, "spends no model and no paid API money"', row.est_usd === 0 && row.dfs_est_usd === 0 && row.mode === 'index_coverage' && row.key === 'schedule:index_coverage' && /spends no model and no paid API money/.test(row.cost_basis), J(row));
    const CW = JSON.parse(fs.readFileSync(path.join(__dirname, 'catchup_wiring.json'), 'utf8'));
    const cs = (CW.schedules || []).find(s => s.id === 'SEOagentIndexCv1');
    check('the Schedule Catch-up replays it: 05:15 daily, its Manual Run, mode index_coverage, published', cs && cs.cron === '15 5 * * *' && cs.kind === 'daily' && cs.entry_node === 'Manual Run' && cs.mode === 'index_coverage' && (CW.published || []).includes('SEOagentIndexCv1'), J(cs));
    const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deploy_manifest.json'), 'utf8'));
    check('the deploy manifest imports and publishes it', M.workflows.includes('SEO_Agent_Index_Coverage.json') && M.publish.includes('SEOagentIndexCv1') && !M.never_deploy.includes('SEOagentIndexCv1'), '');
    const RW = JSON.parse(fs.readFileSync(path.join(__dirname, 'retry_wiring.json'), 'utf8'));
    const mine = (RW.workflows || {})['SEO Agent — Index Coverage'] || [];
    check('retry rule: every external call retries 3 times 5 s apart, except the callback POST (not idempotent, like every report callback)', mine.length >= 10 && mine.every(x => x.allowed ? x.name === 'POST Index Report' : (x.maxTries === 3 && x.waitBetweenTries === 5000)), J(mine.filter(x => !(x.allowed || x.maxTries === 3))));
  });
};
