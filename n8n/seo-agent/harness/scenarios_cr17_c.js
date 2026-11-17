// CR17C1-CR17C19 (client report 2026-11-17, devaicon.com, package CR17-C "index", build section 193). Synthetic .example rows shaped like the
// production ones (no client data). Runs the GENERATED Index coverage kit (harness/code_v4/Index_Diagnose.js), the AI ranking kits from v5 and
// the generated Build Site Issues through the S6 technical-audit fixtures.
//   F3  the freshness guard both ways: a permanent redirect our read saw after Google's last visit makes the address "moved" (never "indexed,
//       add it to the sitemap", never a drop-out); Google's word wins when Google read the page after us; a temporary redirect is a detour;
//       a stored move stands until Google visits again; a 404 over Google's word needs two reads; "missing from the sitemap" only on a direct 200
//   F2  AI ranking follows a moved page, never counts a page left out on purpose as not in Google, and refuses an L04 step whose page moved
//   C3  Build Site Issues: the Google-state findings are listed but do not change Technical health
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const V5 = path.join(__dirname, '..', 'v5', 'code');
  const J = (x) => { try { return JSON.stringify(x); } catch (e) { return String(x); } };
  const T = (fn) => { try { return fn(); } catch (e) { return { __error: String(e && e.message || e) }; } };
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };

  await guard('cr17 c index', async () => {
    reset(); const SN = 'CR17C (client report 2026-11-17, section 193): moved addresses, the freshness guard, AI ranking on moved pages, Technical health';
    begin(SN); const check = mkCheck(SN);
    const kits = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8');
      const body = names.map(n => { const a = src.indexOf('const ' + n + ' = (() => {'); const b = src.indexOf('\n})();', a); return src.slice(a, b + 6); }).join('\n');
      return new Function('URL', 'structuredClone', body + '\nreturn { ' + names.join(', ') + ' };')(undefined, undefined); };
    const { IX } = kits('Index_Diagnose.js', ['PW', 'IX']);
    const DAY = 864e5; const NOW = Date.parse('2026-11-17T10:16:00.000Z'); const iso = (ms) => new Date(ms).toISOString();
    const SITE = { site_id: 'site_dev-example', domain: 'dev.example' };
    const OLD = 'https://dev.example/capabilities/consulting-transformation', NEW = 'https://dev.example/services/capabilities-consulting-transformation';
    const HTML = (head) => '<html><head>' + (head || '<title>Consulting</title>') + '</head><body><main>' + 'words '.repeat(300) + '</main></body></html>';
    const insp = (o) => ({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', pageFetchState: 'SUCCESSFUL',
      lastCrawlTime: '2026-11-10T08:00:00Z', googleCanonical: OLD, userCanonical: OLD, ...o } } });
    const R = (o) => IX.readInspection(insp(o));
    const page = (o) => ({ site_id: SITE.site_id, domain: 'dev.example', url: OLD, lane: 'existing', sources: 'gsc', in_sitemap: false, state: 'indexed', checks: 1, ...o });
    const ctxOf = (c) => ({ now: NOW, sitemap_complete: true, has_sitemap: true, site: SITE, ...(c || {}) });
    const moved301 = IX.readFetch(OLD, { statusCode: 301, headers: { location: '/services/capabilities-consulting-transformation' } }, { statusCode: 200, headers: {}, body: HTML('<title>Consulting</title><link rel="canonical" href="' + NEW + '">') });
    const moved302 = IX.readFetch(OLD, { statusCode: 302, headers: { location: '/services/capabilities-consulting-transformation' } }, { statusCode: 200, headers: {}, body: HTML() });
    const ok200 = IX.readFetch(OLD, { statusCode: 200, headers: {}, body: HTML('<title>Consulting</title><link rel="canonical" href="' + OLD + '">') }, null);
    const gone = IX.readFetch(OLD, { statusCode: 404, headers: {}, body: '<html><body>Not found</body></html>' }, null);

    check('CR17C1 our read keeps the status of the first answer: 301 / 302 recorded as redirect_status, the final address kept',
      moved301.redirect_status === 301 && moved302.redirect_status === 302 && ok200.redirect_status === 0 && moved301.final_url === NEW, J({ moved301, moved302 }));
    // F3, devaicon row 7: Google's reading of 11-13 (last crawl 11-10, before the redirect of 11-11) says indexed; our read today sees a 301
    const d1 = T(() => IX.diagnose(page(), R(), moved301, ctxOf()));
    check('CR17C2 F3: a 301 our read saw after Google\'s last visit makes the address moved (redirect, left out, excluded): never "indexed, missing from the sitemap"',
      d1 && d1.cause === 'redirect' && d1.action === 'leave_out' && d1.state === 'excluded', J(d1));
    const note1 = T(() => IX.noteOf({ ...page(), ...d1, final_url: NEW, verdict: 'PASS', coverage: 'Submitted and indexed' }, {}));
    check('CR17C3 F3: the client sentence says Google still shows the old address, it moved, nothing to do, keep the redirect (no "add it to the sitemap")',
      /Google still shows this old address/.test(note1) && /Nothing to do/.test(note1) && /at least a year/.test(note1) && !/sitemap/i.test(note1), J(note1));
    const d1s = T(() => IX.diagnose(page({ in_sitemap: true, sources: 'sitemap' }), R(), moved301, ctxOf()));
    const note1s = T(() => IX.noteOf({ ...page({ in_sitemap: true }), ...d1s, final_url: NEW }, {}));
    check('CR17C4 F3: the same moved address still listed in the sitemap is the one site step: take it out and list where it goes',
      d1s && d1s.cause === 'redirect' && d1s.action === 'site_fix' && /does not belong in your sitemap/.test(note1s) && /services\/capabilities-consulting-transformation/.test(note1s), J({ d1s, note1s }));
    // the freshness guard the other way: Google read the page AFTER our read (our read is older than Google's last crawl)
    const d2 = T(() => IX.diagnose(page(), R({ lastCrawlTime: '2026-11-17T12:00:00Z' }), moved301, ctxOf({ fetch_at: '2026-11-17T09:00:00Z' })));
    check('CR17C5 F3 freshness guard: Google read the page after our read -> Google\'s word wins (indexed), and with no direct 200 no sitemap advice either',
      d2 && d2.cause === '' && d2.state === 'indexed', J(d2));
    const d3 = T(() => IX.diagnose(page(), R(), moved302, ctxOf()));
    check('CR17C6 F3: a temporary redirect (302) is a detour, not a move: Google\'s indexed reading stands, no sitemap advice', d3 && d3.cause === '' && d3.state === 'indexed', J(d3));
    // a day with no read of ours: the move we stored stands until Google visits again
    const stored = page({ cause: 'redirect', action: 'leave_out', state: 'excluded', final_url: NEW, fetch_at: '2026-11-17T10:16:00Z', http_status: 200 });
    const d4 = T(() => IX.diagnose(stored, R(), null, ctxOf({ now: NOW + DAY })));
    const d4b = T(() => IX.diagnose(stored, R({ lastCrawlTime: '2026-11-18T09:00:00Z' }), null, ctxOf({ now: NOW + 2 * DAY })));
    check('CR17C7 F3: with no read today the stored move stands over Google\'s older reading; once Google read the page after our read, Google decides again',
      d4 && d4.cause === 'redirect' && d4b && d4b.cause === '' && d4b.state === 'indexed', J({ d4, d4b }));
    // impressions of the old address (the Search-impressions path) do not undo the move either
    check('CR17C8 F3: movedByUs is the rule the impressions path uses (a move after Google\'s last visit) and direct200 only passes a direct 200 that names itself',
      IX.movedByUs(stored, '2026-11-10T08:00:00Z', SITE) === true && IX.movedByUs(stored, '2026-11-18T09:00:00Z', SITE) === false
      && IX.direct200({ url: OLD, fetch_at: 'x', http_status: 200, final_url: '', page_canonical: OLD }) === true && IX.direct200({ url: OLD, fetch_at: 'x', http_status: 200, final_url: NEW }) === false
      && IX.direct200({ url: OLD, fetch_at: 'x', http_status: 200, page_canonical: NEW }) === false && IX.direct200({ url: OLD }) === false, '');
    // two reads before a 404 overrules Google's indexed reading
    const d5a = T(() => IX.diagnose(page(), R(), gone, ctxOf()));
    const d5b = T(() => IX.diagnose(page({ _prev: { fetch_at: iso(NOW - DAY), http_status: 404 } }), R(), gone, ctxOf()));
    const d5c = T(() => IX.diagnose(page({ _prev: { fetch_at: iso(NOW - 3 * 3600e3), http_status: 404 } }), R(), gone, ctxOf()));
    check('CR17C9 F3: a 404 over Google\'s indexed reading needs two reads on two days after Google\'s visit (one read, or two the same morning: Google\'s word stands)',
      d5a && d5a.state === 'indexed' && d5b && d5b.cause === 'not_found' && d5c && d5c.state === 'indexed', J({ d5a, d5b, d5c }));
    const d6 = T(() => IX.diagnose(page(), R(), ok200, ctxOf()));
    const d6n = T(() => IX.diagnose(page(), R(), null, ctxOf()));
    check('CR17C10 F3: "indexed, missing from the sitemap" only for an address our read saw answer 200 directly and name itself; never for one we did not read',
      d6 && d6.cause === 'indexed_not_in_sitemap' && d6.action === 'site_fix' && d6n && d6n.cause === '', J({ d6, d6n }));

    // ---- Q1: the page an old address moved to is asked first; F6: the report counts the app's population ----
    const tgt = { url: NEW, state: 'not_indexed', cause: 'wait_new', action: 'wait', lane: 'new', in_sitemap: true, sources: 'sitemap', impressions_28d: 0 };
    const pol = { url: 'https://dev.example/cookies', state: 'not_indexed', cause: 'unknown_to_google', action: 'links', in_sitemap: true, sources: 'sitemap', type_override: 'important', impressions_28d: 0 };
    const others = Array.from({ length: 6 }, (_, i) => ({ url: 'https://dev.example/industries/p' + i, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', in_sitemap: true, sources: 'sitemap', impressions_28d: 50 - i }));
    const movedRow = { url: OLD, state: 'excluded', cause: 'redirect', action: 'leave_out', final_url: NEW, in_sitemap: false };
    const askRows = [movedRow, pol, ...others, tgt].map(r => ({ ...r }));
    T(() => IX.askGoogle(askRows, { now: NOW, home_keys: new Set(), freeze: { freeze: false }, reselect: true }));
    const askRows0 = [pol, ...others, tgt].map(r => ({ ...r }));
    T(() => IX.askGoogle(askRows0, { now: NOW, home_keys: new Set(), freeze: { freeze: false }, reselect: true }));
    check('CR17C18 Q1: the page an old address now redirects to is asked first (the "fix we saw" tier), ahead of a policy page marked important',
      askRows.find(r => r.url === NEW).ask_google === true && !askRows0.find(r => r.url === NEW).ask_google, J(askRows.map(r => [r.url, r.ask_google])));
    const sm = T(() => IX.summarize([movedRow, { url: 'https://dev.example/x', state: 'indexed', cause: 'indexed_not_in_sitemap', action: 'site_fix', final_url: 'https://dev.example/y' }, tgt,
      { url: 'https://dev.example/in', state: 'indexed', cause: '', action: 'none' }, { url: 'https://dev.example/tag/a', state: 'excluded', cause: 'low_value', action: 'leave_out' }], {}));
    const md = T(() => IX.reportMarkdown({ domain: 'dev.example' }, sm, {}, { rows: [] }));
    check('CR17C19 F6: the engine report counts the pages that should be in Google like the app (moved / left out not counted, a pre-fix moved row not "in Google")',
      sm && sm.should_be === 2 && sm.in_google === 1 && sm.indexed === 2 && /Google has \*\*1 of the 2\*\* pages that should be in Google/.test(String(md)), J({ sm, md: String(md).slice(0, 300) }));

    // ---- F2: AI ranking on a moved page ----
    const rd = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
    const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
    const { AIRF, ARD, ARL } = new Function('URL', 'structuredClone', 'Object', rd('_ai_measure.js') + '\n' + rd('_ai_rank_flags.js') + '\n' + rd('_ai_rank_diag.js') + '\n' + rd('_ai_rank_learn.js') + '\nreturn { AVX, AIRF, ARD, ARL };')(undefined, undefined, SOBJ);
    const EM = 'https://dev.example/engagement-models', EMN = 'https://dev.example/services/engagement-models', PRIV = 'https://dev.example/privacy';
    const k = (u) => AIRF.urlKey(u);
    const prompt = { prompt_id: 'q1', prompt: 'best engagement models for software outsourcing', keyword: 'engagement models', intent: 'recommendation', page_url: EM, market: '' };
    const diagOf = (google, p) => ARD.diagnose({ site: { site_id: SITE.site_id, domain: 'dev.example' }, prompt: p || prompt, answers8: [], units60: [], evidence: '', access: { robots: {}, blocked_engines: [], read_at: iso(NOW) },
      pages: [], index: { google, bing: { in_account: null, crawled: new Map() }, brave: null, cc_captures: null }, serp: new Map(), ourHosts: ['dev.example'], rivals: [], engines: ['ai_mode', 'gemini'], now: NOW, cfg: {} });
    const gMoved = new Map([[k(EM), { state: 'excluded', cause: 'redirect', action: 'leave_out', final_url: EMN }], [k(EMN), { state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', final_url: '' }], [k('https://dev.example/about'), { state: 'indexed', cause: '', action: 'none', final_url: '' }]]);
    const dm = T(() => diagOf(gMoved));
    const sub = (d) => d && d.engines && d.engines.ai_mode ? d.engines.ai_mode.sub : '__none';
    const evUrl = (d) => (((d && d.engines && d.engines.ai_mode && d.engines.ai_mode.evidence) || [])[0] || {}).url;
    check('CR17C11 F2: a question mapped to a moved address follows it: the mapped page is the new address, and its "not in Google" is about the new address',
      dm && dm.mapped_page === EMN && sub(dm) === 'not_indexed' && evUrl(dm) === EMN, J(dm && { mapped: dm.mapped_page, cell: dm.engines && dm.engines.ai_mode }));
    const gMovedIn = new Map(gMoved); gMovedIn.set(k(EMN), { state: 'indexed', cause: '', action: 'none', final_url: '' });
    const dmi = T(() => diagOf(gMovedIn));
    const gPol = new Map([[k(PRIV), { state: 'excluded', cause: 'low_value', action: 'leave_out', final_url: '' }], [k('https://dev.example/about'), { state: 'indexed', cause: '', action: 'none', final_url: '' }]]);
    const dp = T(() => diagOf(gPol, { ...prompt, page_url: PRIV }));
    const gStr = new Map([[k(EM), 'excluded'], [k('https://dev.example/about'), 'indexed']]);
    const ds = T(() => diagOf(gStr));
    check('CR17C12 F2: never "not in Google" for a moved page whose new address is indexed, nor for a policy page left out on purpose; an old string row still reads as before',
      dmi && dmi.mapped_page === EMN && sub(dmi) !== 'not_indexed' && dp && sub(dp) !== 'not_indexed' && ds && sub(ds) === 'not_indexed', J({ dmi: sub(dmi), dp: sub(dp), ds: sub(ds) }));
    const act = { action_id: 'air_site_dev-example_L04_x', lever: 'L04', status: 'queued', mode: 'on', ref: { url: EM }, questions: ['q1'], engines: ['ai_mode'], prereg: { registered_at: iso(NOW - 11 * DAY), window_days: 28 }, created_at: iso(NOW - 11 * DAY) };
    const v1 = T(() => ARL.verify(act, { contentLog: [], pages: [], index: { google: gMoved, bing: {} }, listings: [], outreach: [], sources: [], robots: null, bing: {}, now: NOW }));
    const v2 = T(() => ARL.verify(act, { contentLog: [], pages: [], index: { google: new Map([[k(EM), { state: 'indexed', cause: '', action: 'none', final_url: '' }]]), bing: {} }, listings: [], outreach: [], sources: [], robots: null, bing: {}, now: NOW }));
    const v3 = T(() => ARL.verify({ ...act, ref: { url: PRIV } }, { contentLog: [], pages: [], index: { google: gPol, bing: {} }, listings: [], outreach: [], sources: [], robots: null, bing: {}, now: NOW }));
    const v4 = T(() => ARL.verify(act, { contentLog: [], pages: [], index: { google: new Map([[k(EM), 'indexed']]), bing: {} }, listings: [], outreach: [], sources: [], robots: null, bing: {}, now: NOW }));
    check('CR17C13 F2: the L04 check refuses a step whose page moved ("moved", never judged: happened null), passes an indexed page (object or old string value), refuses a page left out on purpose',
      v1 && v1.happened === null && /^moved: \/engagement-models now redirects to \/services\/engagement-models/.test(v1.refused || '') && v2 && v2.happened === true && v4 && v4.happened === true
      && v3 && v3.happened === null && /left out on purpose/.test(v3.refused || ''), J({ v1, v2, v3, v4 }));
    const pl = fs.readFileSync(path.join(V5, 'AI_Rank_Plan.js'), 'utf8');
    check('CR17C14 F2: AI_Rank_Plan passes cause, action and final address to the diagnosis and stores a refused verify as status refused',
      /final_url: S0\(r\.final_url\) \}\]/.test(pl) && /v\.refused \? 'refused'/.test(pl), '');
  });

  await guard('cr17 c technical health', async () => {
    reset(); const SN = 'CR17C-TH (client report 2026-11-17 C3, section 193): Google-state findings are listed but do not change Technical health';
    begin(SN); const check = mkCheck(SN);
    const F = require('./fixtures');
    mock('Start Form', F.forms.startAudit);
    const n = await run('Normalize Input', F.forms.pageAuditTech);
    mock('Route Mode', n);
    await run('Save Task ID', F.crawlTaskPost);
    await run('Check Crawl', F.summaryDone, { runIndex: 2 });
    mock('Get Crawled Pages', F.crawledPagesRes);
    await run('Crawl Extra Requests', store['Get Crawled Pages']);
    mock('Run Crawl Extras', F.extrasRes);
    await run('Collect Crawl Extras', store['Run Crawl Extras']);
    await run('Build Probes'); await run('Content Probes', store['Collect Crawl Extras']);
    const all6 = F.probeResults('apex');
    mock('Run Probes', [all6[0], all6[2], all6[3], all6[4]]);
    mock('Run Content Probes', [all6[0], all6[1], all6[5], all6[6], all6[7], all6[8], ...all6.slice(9)]);
    const ap = await run('Analyze Probes', store['Run Content Probes']);
    const base = ap[0].json;
    const gs = (o) => ({ category: 'Crawlability & Indexing', severity: 'High', title: 'A large share of important pages is not indexed by Google', why: 'w', fix: 'f', evidence: '23 of 23 sampled pages', affected_count: 23, affected_pct: 100, sample_urls: [], scope: 'pages', google_state: true, ...(o || {}) });
    const score = async (extra) => { const r = await run('Build Site Issues', [{ json: { ...base, extra_findings: [...(base.extra_findings || []), ...extra] } }]); return r[0].json.site_audit; };
    const a0 = await score([]);
    const a100 = await score([gs()]);
    const aCtl = await score([gs({ google_state: undefined })]);
    const f100 = (a100.findings || []).find(f => /not indexed by Google/.test(f.title));
    check('CR17C15 C3: the score is the same with 0% and 100% of the inspected pages out of Google (the finding is Google\'s view, counted under Pages in Google)',
      a0.health_score === a100.health_score && a0.raw_score === a100.raw_score, J({ a0: a0.health_score, a100: a100.health_score }));
    check('CR17C16 C3: the Google-state finding is still listed and ranked, marked unscored with its note; the same finding without the mark still deducts',
      !!f100 && f100.scoring === false && /counted under Pages in Google/.test(f100.score_note || '') && aCtl.raw_score < a0.raw_score, J({ f100, ctl: aCtl.raw_score, a0: a0.raw_score }));
    check('CR17C17 C3: the scoring method names Technical health and says Google-state findings are counted under Pages in Google; "All crawled pages are indexable" is gone',
      /^Technical health: what our crawl can verify/.test(a100.scoring_method || '') && /counted under Pages in Google/.test(a100.scoring_method || '') && !(a100.what_works || []).includes('All crawled pages are indexable'),
      J({ m: a100.scoring_method, w: a100.what_works }));
  });
};
