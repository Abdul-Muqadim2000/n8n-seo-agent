// W07A1-W07A7 (fix agent W07-A, 2026-10-31; docs/page-quality-2026-10-29/WAVE06.md "Open resilience item" and section 9; build section 179,
// reader_fallback.py). On 2026-10-30 the page reader's account ran out of balance and every read answered HTTP 402. Nothing noticed: the
// K1 run held "ms 365 erp" on its search score alone (38) and told the client its page "has no title, main heading or Search Console search on
// file" about a page nobody had read (fixtures/w07a_reader402.json: that run's reader items, anonymised, and what it decided).
//   W07A1 what is a refusal: the production 402 item, a full response, a body kept in its output field, 401 / 429 / 403 in the reader's own
//         words; a page that is down, blocked or slow is NOT one (and is left as it was)
//   W07A2 the 402 replay with the fallback failing too: every read stays unread with the reason; Collect Client Pages says the page "could not
//         be read" (never "no title on file"); Parse Verdict gives no verdict, score, hold, duplicate or existing-page decision and stops the
//         page run before the brief; the callback, the report and the content log say why
//   W07A3 the fallback recovers: the reader without the key (spaced, stopped at its first refusal), then a direct read of the page in the
//         reader's own format; the page is confirmed by its own title and the run decides as before
//   W07A4 a funded key changes nothing: the same objects, no call, and every downstream output byte for byte the same
//   W07A5 render reads (the page after its scripts ran) never fall back to the plain HTML; the Backlink Monitor's render that answered the
//         reader's error JSON as if it were the page is now unread
//   W07A6 one ops alert per refusal: recorded first, deduped for 30 minutes, delivered only on a 2xx
//   W07A7 the generated workflows: every reader node has its fallback and feeds nothing else, the alert chain, the router
// Called from scenarios_v5.js (one line). Every check runs the GENERATED code (harness/code_v4).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const PLAIN = /[—–…‘’“”]/;
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'w07a_reader402.json'), 'utf8'));
  const RD = new Function(fs.readFileSync(path.join(CD, '_reader.js'), 'utf8') + '\nreturn RD;')();
  const D = 'novaand.example'; const W = 'https://www.' + D; const ERP = W + '/ms-365-erp-uae';
  const BODY402 = '{"data":null,"code":402,"name":"InsufficientBalanceError","status":40203,"message":"Account balance not enough to run this query, please recharge.","readableMessage":"InsufficientBalanceError: Account balance not enough to run this query, please recharge."}';
  const md = (t, h, s) => 'Title: ' + t + '\n\nURL Source: x\n\nMarkdown Content:\n# ' + h + '\n\n' + s.repeat(8);
  const html = (title, h1, para) => '<!doctype html><html lang="en"><head><title>' + title + '</title></head><body><header><nav><a href="/">Home</a><a href="/whatwedo">What we do</a></nav></header><main><h1>' + h1 + '</h1><p>'
    + para.repeat(30) + '</p><h2>How we deliver it</h2><p>' + para.repeat(6) + '</p><p><a href="/contact-us">Book a consultation</a></p></main><footer>Novaand, Dubai</footer></body></html>';
  const ERP_PAGE = { title: 'MS 365 ERP in the UAE: Dynamics 365 Partner | Novaand', h1: 'MS 365 ERP for UAE Businesses', para: 'Microsoft 365 is not an ERP; the ERP is Dynamics 365 Business Central or Finance. ' };
  const HOME = { title: 'Novaand | Turning technology into business impact', h1: 'Value driven innovation', para: 'Novaand is a Microsoft partner in Dubai for Dynamics 365, AI and automation. ' };
  const GUIDE = { title: 'Is Microsoft Dynamics 365 an ERP System?', h1: 'Is Microsoft Dynamics 365 an ERP System?', para: 'Dynamics 365 Finance and Business Central are the ERP applications of the suite. ' };
  const WWD = { title: 'What We Do | Novaand', h1: 'What We Do', para: 'We implement Dynamics 365, build AI assistants and automate finance processes for UAE companies. ' };
  const CLIENT = [ERP_PAGE, HOME, GUIDE, WWD];
  const PAGES = [{ url: W, title: HOME.title, h1: HOME.h1, queries: [] }, { url: W + '/whatwedo', title: WWD.title, h1: WWD.h1, queries: [] },
    { url: ERP, title: '', h1: '', queries: [] }, { url: W + '/insights/is-microsoft-dynamics-365-an-erp-system', title: GUIDE.title, h1: GUIDE.h1, queries: [] }];
  const MODEL = { site_id: 'site_novaand-example', domain: D, canonical_host: 'www.' + D, business_name: 'Novaand', brand_names: ['Novaand'], services: ['Dynamics 365 Finance', 'Dynamics 365 Business Central', 'AI consulting'], pages: PAGES };
  // a fake network: [regex, answer | function | Error]; every call recorded; an address nobody answers is "not found"
  const net = (routes) => { const calls = [];
    const fn = async (o) => { calls.push({ url: String(o.url), auth: !!((o.headers || {}).Authorization || (o.headers || {}).authorization), headers: o.headers || {} });
      for (const [re, ans] of routes) if (re.test(String(o.url))) { if (ans instanceof Error) throw ans; return typeof ans === 'function' ? ans(o) : ans; }
      throw new Error('getaddrinfo ENOTFOUND ' + String(o.url)); };
    fn.calls = calls; return fn; };
  const sleeps = []; const sleep = async (ms) => { sleeps.push(ms); };
  const READER = /^https:\/\/r\.jina\.ai\//;
  const reqsClient = FX.client_requests;   // [existing ms-365-erp-uae, home, related guide, services] as the run asked them
  const CTX = (over) => ({ mode: 'keyword', keyword: 'ms 365 erp', domain: D, existing_page: { url: ERP, match: 0.75, source: 'sitemap' }, existing_page_url: '', site_model: MODEL,
    internal_link_candidates: [{ url: W + '/', path: '/' }], site_urls: PAGES.map(p => p.url), site_urls_count: PAGES.length, ...(over || {}) });
  // the generated fallback node of a reader, on the reader's recorded answers
  const fallback = async (name, reqNode, reqs, answers, http) => {
    mock(reqNode, reqs.map(r => ({ json: r })));
    return (await run(name, answers.map(j => ({ json: j })), { http, sleep })).map(i => i.json);
  };
  const collect = async (readItems, htmlPages) => {
    for (const k of ['Client Render Plan', 'Render Client Pages', 'Client Render More', 'Render More Client Pages']) delete store[k];
    mock('Site Model', [{ json: { site_model: MODEL } }]);
    mock('Collect Site URLs', [{ json: CTX() }]); mock('Client Page Requests', reqsClient.map(r => ({ json: r })));
    mock('Read Client Pages', readItems.map(j => ({ json: j })));
    mock('Read Client Page HTML', htmlPages.map(p => ({ json: p ? { page_html: html(p.title, p.h1, p.para) } : { error: { message: 'timeout' } } })));
    return (await run('Collect Client Pages', store['Read Client Page HTML']))[0].json;
  };
  // Parse Verdict on the recorded K1-shaped run (3299's Parse Brief, anonymised), with the reader nodes' items when given
  const F99 = R.load('replay_3299.json.gz');
  const PB = F99.nodes['Parse Brief']['0'].items[0].json;
  const PREV = (() => { const p = clone(PB); for (const k of ['verdict_hold', 'would_hold', 'hold', 'hold_shadow', 'hold_ack', 'verdict_acknowledged', 'duplicate_check', 'verdict_readings', 'pages_unread', 'pages_unread_stop']) delete p[k]; p.client_ip = 'app:0b1c2d3e-anon'; return p; })();
  const AGENT = { verdict: 'GO_WITH_CHANGES', score: 38, reasons: ['Volume is 10 searches a month, and the trend shows 10 in only 5 of the last 12 months.'], risks: ['A page that already exists competes for it.'],
    what_must_change: ['Target \'Dynamics 365 ERP implementation UAE\' instead.'], secondary_keywords: PB.secondary_keywords, recommended_page: 'Service Page', expected_monthly_visits_top3: 1, time_to_rank_months: 7 };
  const pv = async (over, reads) => {
    reset();
    mock('Merge Keyword Data', [{ json: { ...PREV, site_model: { ...PB.site_model, pages: [] }, keyword_data: { ...(PB.keyword_data || {}), search_volume: 10 }, ...(over || {}) } }]);
    mock('Load Site Cache', [{ json: {} }]);
    for (const [k, v] of Object.entries(reads || {})) mock(k, v.map(j => ({ json: j })));
    return (await run('Parse Verdict', [{ json: { output: AGENT } }]))[0].json;
  };

  // ---------- W07A1 what is a refusal ----------
  await guard('W07A1 refusal', async () => {
    const SN = 'W07A1 (WAVE06 section 9) RD.refusal: the reader\'s own refusals (402 as recorded, 401 / 429, a 403 in its own words, a full response, a body kept in its output field) and nothing else';
    reset(); begin(SN); const check = mkCheck(SN);
    const prod = FX.reads['Read Client Pages'][0];
    const r = RD.refusal(prod, 'page_text');
    check('the production 402 item (exec 351, every client / competitor / retry / regulatory read): refused, HTTP 402 InsufficientBalanceError, no account id', !!r && r.status === 402 && r.name === 'InsufficientBalanceError' && /recharge/.test(r.message) && !/uid/.test(J(r)), J(r));
    check('all 20 recorded reads of that run are refusals', Object.values(FX.reads).every(l => l.every(j => !!RD.refusal(j, 'page_text'))) && Object.values(FX.reads).reduce((a, l) => a + l.length, 0) === 20, J(Object.keys(FX.reads)));
    const cases = [
      ['a full response (render reads)', { statusCode: 402, body: BODY402, headers: {} }, 'data', 402],
      ['the reader\'s error JSON kept as the page (neverError, the Backlink Monitor\'s render)', { data: BODY402 }, 'data', 402],
      ['401 as n8n words it', { error: { message: 'Authorization failed - please check your credentials', httpCode: '401', description: '{"code":401,"name":"AuthenticationRequiredError","message":"Authentication is required"}' } }, 'page_text', 401],
      ['429 rate limit', { error: { message: '429 - {"code":429,"name":"RateLimitTriggeredError","readableMessage":"RateLimitTriggeredError: Per IP rate limit exceeded"}', status: '429' } }, 'page_text', 429],
      ['403 with the reader\'s key words', { error: { message: '403 - {"code":403,"name":"InvalidApiKeyError","message":"Invalid API key"}' } }, 'page_text', 403]];
    for (const [label, item, prop, st] of cases) { const x = RD.refusal(item, prop); check('refusal: ' + label, !!x && x.status === st, J(x)); }
    const not = [
      ['a page that is down (422 from the reader about the target)', { error: { message: '422 - {"code":422,"name":"AssertionFailureError","message":"Failed to goto https://x.example: net::ERR_NAME_NOT_RESOLVED"}' } }],
      ['a time-out', { error: { message: 'timeout of 45000ms exceeded', code: 'ECONNABORTED' } }],
      ['a 403 about the target site (blocked domain)', { error: { message: '403 - {"code":403,"name":"SecurityCompromiseError","message":"Domain x.example blocked until later due to previous abuse"}' } }],
      ['a page about account balances', { page_text: 'Title: How to check your account balance\n\nMarkdown Content:\n# Balance\nError 402 means payment required; recharge your quota.' }],
      ['a render that answered 200', { statusCode: 200, body: '<html><body><p>ok</p></body></html>' }],
      ['a render whose page answered 404 through the reader', { statusCode: 404, body: '<html><body>Not found</body></html>' }]];
    for (const [label, item] of not) check('not a refusal: ' + label, RD.refusal(item, 'page_text') === null, J(RD.refusal(item, 'page_text')));
    check('the reason a client reads names no vendor, no code and no dash', /stopped answering us/.test(RD.clientReason(r)) && !/jina|402|http/i.test(RD.clientReason(r)) && !PLAIN.test(RD.clientReason(r)), RD.clientReason(r));
  });

  // ---------- W07A2 the 402 replay, the fallback failing too ----------
  await guard('W07A2 402 replay', async () => {
    const SN = 'W07A2 (WAVE06 section 9, the K1 402 run, anonymised) every read refused and the fallback failing too: no verdict, score, hold or existing-page decision on pages nobody read, and the client told why';
    reset(); begin(SN); const check = mkCheck(SN);
    // the reader without the key refuses too; the pages themselves cannot be reached
    const http = net([[READER, { statusCode: 402, body: BODY402 }]]);
    sleeps.length = 0;
    const cl = await fallback('Read Client Pages', 'Client Page Requests', reqsClient, clone(FX.reads['Read Client Pages']), http);
    check('client pages: 4 of 4 unread, each with the refusal and the fallback\'s own reasons; nothing invented', cl.length === 4 && cl.every(j => j.error && j.error.reader_refused === true && j.reader_fallback.via === 'none' && j.reader_fallback.refused.status === 402)
      && /reader without the key/.test(cl[0].reader_fallback.why) && /direct fetch/.test(cl[0].reader_fallback.why) && !('page_text' in cl[0]), J(cl[0]));
    check('the reader without the key is asked once, and never again after it refused; it never carries a key', http.calls.filter(c => READER.test(c.url)).length === 1 && http.calls.every(c => !c.auth) && sleeps.length === 0, J(http.calls.map(c => c.url)));
    check('each page is then fetched directly (4 calls, the page addresses)', http.calls.filter(c => !READER.test(c.url)).map(c => c.url).join(' ') === reqsClient.map(r => r.url).join(' '), J(http.calls));
    const http2 = net([[READER, { statusCode: 402, body: BODY402 }]]);
    const cp = await fallback('Read Competitor Pages', 'Restore Top 6', FX.competitor_requests, clone(FX.reads['Read Competitor Pages']), http2);
    check('competitor pages: 3 of 3 unread', cp.length === 3 && cp.every(j => j.reader_fallback && j.reader_fallback.via === 'none'), J(cp[0]));
    // Collect Client Pages on those items (the page HTML could not be read either)
    reset();
    const cc = await collect(cl, [null, null, null, null]);
    check('the page the sitemap matched is "could not be read", not "has no title, main heading or Search Console search on file" (the recorded reason)',
      !cc.existing_page_unconfirmed && !!cc.existing_page_unread && cc.existing_page_unread.url === ERP && /could not be read/.test(cc.existing_page_unread.why) && !/no title/.test(J(cc))
      && /no title, main heading/.test(FX.recorded.existing_page_unconfirmed_why), J({ unread: cc.existing_page_unread, unconf: cc.existing_page_unconfirmed }));
    check('nothing was decided about it: no existing page, no refresh address, no page read', cc.existing_page === null && cc.existing_page_url === '' && cc.client_pages_read === 0, J({ e: cc.existing_page, u: cc.existing_page_url }));
    // Parse Verdict
    const o = await pv({ client_pages_read: 0, competitors_read: 0, existing_page: null, existing_page_url: '', existing_page_unread: cc.existing_page_unread, existing_page_unconfirmed: undefined },
      { 'Read Client Pages': cl, 'Read Competitor Pages': cp, 'Analyze Competitor Pages': [{ competitors_read: 0 }] });
    console.log('   W07A2 ->', J({ verdict: o.verdict, score: o.verdict_score, hold: o.verdict_hold, would: o.would_hold, stop: o.pages_unread_stop, nc: o.hold_not_checked }));
    check('recorded: GO_WITH_CHANGES 38, held "clearly low"; now: NOT_CHECKED, no score, no hold, no shadow hold',
      FX.recorded.verdict_score === 38 && FX.recorded.verdict_hold === true && o.verdict === 'NOT_CHECKED' && o.verdict_score === null && o.verdict_hold === false && o.would_hold === false && o.hold === null && o.hold_shadow === null, J(o.hold));
    check('the page run stops before the brief, with the pages named and the reason in plain words', o.pages_unread_stop === true && !!o.pages_unread && o.pages_unread.missing.length === 3
      && /could not be read/.test(o.pages_unread.reason) && /Nothing was written/.test(o.pages_unread.reason) && /run it again later/.test(o.pages_unread.reason) && !PLAIN.test(o.pages_unread.reason) && !/jina/i.test(o.pages_unread.reason), J(o.pages_unread));
    check('no duplicate or existing-page decision, no advice and no reasons made on pages nobody read', o.duplicate_check && o.duplicate_check.checked === false && o.verdict_changes.length === 0 && o.verdict_risks.length === 0
      && o.verdict_reasons.length === 1 && o.verdict_reasons[0] === o.pages_unread.reason && /pages this check needs could not be read/.test(o.hold_not_checked) && o.expected_visits === null, J({ d: o.duplicate_check, c: o.verdict_changes, r: o.verdict_reasons }));
    // the router, the callback, the content log
    const nc = (() => { const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_v4.json'), 'utf8'))[0]; return wf.nodes.find(n => n.name === 'Need Content?').parameters.conditions.conditions[0].leftValue; })();
    check('Need Content? sends it to the report-only delivery', nc === '={{ !!$json.include_content && !$json.verdict_hold && !$json.pages_unread_stop }}', nc);
    reset(); mock('Parse Verdict', [{ json: o }]);
    const cb = (await run('Build Webhook Response', [{ json: { request_id: '9001', keyword: o.keyword, domain: D, verdict: o.verdict, verdict_score: o.verdict_score, score_withheld: o.score_withheld, verdict_reasons: o.verdict_reasons } }]))[0].json;
    check('the callback carries pages_unread (reason, what was missing) and NOT_CHECKED with no score', !!cb.pages_unread && cb.pages_unread.missing.length === 3 && /could not be read/.test(cb.pages_unread.reason) && cb.verdict === 'NOT_CHECKED' && cb.score == null && cb.hold === null, J({ p: cb.pages_unread, v: cb.verdict }));
    const NI = { domain: D, keyword: 'ms 365 erp', request_id: 'req-k1-402', client_ip: 'app:0b1c2d3e-anon', page_type: 'Service Page' };
    const logRow = async (stored) => { reset(); mock('Normalize Input', [{ json: NI }]); mock('Parse Verdict', [{ json: o }]); mock('Blog Package', [{ json: {} }]);
      mock('Load Content Log (Run)', stored.length ? stored.map(j => ({ json: j })) : [{ json: {} }]); return (await run('Content Log Row', store['Load Content Log (Run)']))[0].json; };
    const started = { site_id: 'site_novaand-example', domain: D, keyword: 'ms 365 erp', request_id: 'req-k1-402', status: 'started', started_at: '2026-10-30T12:56:07.000Z' };
    const lr = await logRow([started]);
    check('content log: the run\'s started row becomes failed with the reason (never held: the keyword is tried again)', lr.status === 'failed' && /could not be read/.test(lr.qa_reasons) && !PLAIN.test(lr.qa_reasons), J(lr));
    const lw = await logRow([{ ...started, status: 'written', request_id: 'older' }]);
    check('a page this keyword already has keeps its row', lw.skip === true && /keeps its row/.test(lw.reason), J(lw));
    // the report (the Word / PDF file): its three "not checked" lines name the pages when pages_unread is set
    const bwf = fs.readFileSync(path.join(CD, 'Build_Word_File.js'), 'utf8');
    check('the report says the pages could not be read, not that Google could not be read', (bwf.match(/d\.pages_unread \?/g) || []).length === 3
      && /'NOT CHECKED: the pages it needs could not be read'/.test(bwf) && /'not scored: the pages it needs could not be read'/.test(bwf), 'Build_Word_File.js');
  });

  // ---------- W07A3 the fallback recovers ----------
  await guard('W07A3 recovers', async () => {
    const SN = 'W07A3 the fallback recovers a refused read: the reader without the key (spaced, no key), else the page read directly in the reader\'s own format; the run then decides as before';
    reset(); begin(SN); const check = mkCheck(SN);
    sleeps.length = 0;
    const byUrl = (u) => CLIENT[reqsClient.findIndex(r => u.endsWith(r.url))] || null;
    const ok = net([[READER, (o) => { const p = byUrl(o.url); return p ? { statusCode: 200, body: md(p.title, p.h1, p.para) } : { statusCode: 404, body: 'not found' }; }]]);
    const a = await fallback('Read Client Pages', 'Client Page Requests', reqsClient, clone(FX.reads['Read Client Pages']), ok);
    check('the reader without the key: 4 of 4 read, the same field the keyed reader fills (page_text), marked reader_keyless', a.every(j => typeof j.page_text === 'string' && j.page_text.length > 200 && !j.error && j.reader_fallback.via === 'reader_keyless'), J(a.map(j => j.reader_fallback)));
    check('no key is sent, the reader\'s own headers are (the selectors it removes), and the calls are spaced (3 waits for 4 reads)', ok.calls.every(c => !c.auth && /header, nav, footer/.test(c.headers['X-Remove-Selector'] || '')) && sleeps.length === 3 && sleeps.every(ms => ms > 0 && ms <= 3200), J({ s: sleeps }));
    reset();
    const ca = await collect(a, CLIENT);
    check('the page is read and confirmed by its own title, as with a funded key', !!ca.existing_page && ca.existing_page.url === ERP && /title/.test(ca.existing_page.confirmed_by) && !ca.existing_page_unread && ca.client_pages_read === 4, J({ e: ca.existing_page, u: ca.existing_page_unread }));
    // the reader without the key refuses too: the page itself, in the reader's format
    sleeps.length = 0;
    const direct = net([[READER, { statusCode: 402, body: BODY402 }], [/^https:\/\/www\.novaand\.example\//, (o) => { const p = byUrl(o.url); return { statusCode: 200, body: html(p.title, p.h1, p.para), headers: {} }; }]]);
    const b = await fallback('Read Client Pages', 'Client Page Requests', reqsClient, clone(FX.reads['Read Client Pages']), direct);
    check('a direct read: 4 of 4, in the reader\'s line format (Title line, "#" headings, no menu or footer), marked direct', b.every(j => j.reader_fallback.via === 'direct' && /^Title: /.test(j.page_text) && /\n# /.test(j.page_text) && !/Novaand, Dubai/.test(j.page_text)), b[0].page_text.slice(0, 300));
    reset();
    const cb2 = await collect(b, CLIENT);
    check('read directly, the page is confirmed by its own title and its text is the page to improve', !!cb2.existing_page && cb2.existing_page.url === ERP && cb2.existing_page_text.length > 200, J({ e: cb2.existing_page }));
    const o = await pv({ client_pages_read: 4, competitors_read: 3, existing_page: cb2.existing_page, existing_page_url: '' }, { 'Read Client Pages': b, 'Analyze Competitor Pages': [{ competitors_read: 3 }] });
    check('the verdict is decided as before (the pages were read): held as a duplicate of the page the site has, no pages_unread', !('pages_unread' in o) && o.verdict === 'GO_WITH_CHANGES' && o.verdict_hold === true && (o.hold.kinds || []).includes('duplicate'), J({ v: o.verdict, h: o.hold && o.hold.kinds }));
    // a homepage read keeps its menu links for the nav pages (Read Website)
    const home = net([[READER, { statusCode: 402, body: BODY402 }], [/novaand\.example/, { statusCode: 200, body: html(HOME.title, HOME.h1, HOME.para) }]]);
    const hw = await fallback('Read Website', 'Need Site Read?', [{ domain: D }], [clone(FX.reads['Read Client Pages'][0])], home);
    check('Read Website: the homepage read directly keeps the site\'s own menu links ([What we do](https://...)) in site_text', /\[What we do\]\(https:\/\/novaand\.example\/whatwedo\)/.test(hw[0].site_text || '') && hw[0].reader_fallback.via === 'direct', (hw[0].site_text || J(hw[0])).slice(0, 400));
  });

  // ---------- W07A4 a funded key changes nothing ----------
  await guard('W07A4 funded key', async () => {
    const SN = 'W07A4 a funded key changes nothing: the fallback hands on the very same objects with no call, a page-level failure stays as it was, and every output downstream is byte for byte the same';
    reset(); begin(SN); const check = mkCheck(SN);
    const none = net([]);
    const good = CLIENT.map(p => ({ page_text: md(p.title, p.h1, p.para) }));
    good[2] = { error: { message: 'timeout of 45000ms exceeded', code: 'ECONNABORTED' } };   // a page that is slow: not a refusal
    mock('Client Page Requests', reqsClient.map(r => ({ json: r })));
    const input = good.map(j => ({ json: j }));
    const out = await run('Read Client Pages', input, { http: none, sleep });
    check('the same objects, in order, nothing added, no call', out.length === 4 && out.every((it, i) => it.json === input[i].json) && none.calls.length === 0 && !out.some(it => 'reader_fallback' in it.json), J(none.calls));
    reset();
    const viaNode = await collect(out.map(i => i.json), CLIENT);
    reset();
    const direct = await collect(clone(good), CLIENT);
    check('Collect Client Pages: the same output as before the fallback existed', J(viaNode) === J(direct), J(viaNode).slice(0, 200));
    const p1 = await pv({}, { 'Read Client Pages': good, 'Read Competitor Pages': [{ page_text: md('A', 'A', 'x ') }], 'Analyze Competitor Pages': [{ competitors_read: 1 }] });
    const p0 = await pv({});
    const strip = (x) => { const y = clone(x); return y; };
    check('Parse Verdict: the same output with the reader nodes\' answers as without them (no pages_unread key)', J(strip(p1)) === J(strip(p0)) && !('pages_unread' in p1) && !('pages_unread_stop' in p1), J(p1).slice(0, 200));
    // the render reads too
    const rk = [{ statusCode: 200, body: '<html><body><h1>ok</h1>' + '<p>text</p>'.repeat(50) + '</body></html>', headers: {} }];
    mock('Any Render Diff?', [{ json: { url: W + '/', index: 0 } }]);
    const ro = await run('Render Key Pages', rk.map(j => ({ json: j })), { http: none, sleep });
    check('Render Key Pages: the same object, no call', ro[0].json === undefined ? false : J(ro[0].json) === J(rk[0]) && none.calls.length === 0, J(ro[0].json).slice(0, 120));
  });

  // ---------- W07A5 render reads ----------
  await guard('W07A5 render', async () => {
    const SN = 'W07A5 a render (the page after its scripts ran) never falls back to the plain HTML; the Backlink Monitor\'s render that kept the reader\'s error JSON as the page is unread';
    reset(); begin(SN); const check = mkCheck(SN);
    const rendered = '<html><head><title>Rendered</title></head><body><main><h1>After scripts</h1>' + '<p>Text written by JavaScript.</p>'.repeat(40) + '</main></body></html>';
    const kl = net([[READER, (o) => ({ statusCode: 200, body: o.headers['X-Return-Format'] === 'html' ? rendered : 'markdown' })]]);
    mock('Any Render Diff?', [{ json: { url: W + '/', index: 0 } }]);
    const a = await run('Render Key Pages', [{ json: { statusCode: 402, body: BODY402, headers: {} } }], { http: kl, sleep });
    check('Render Key Pages: the reader without the key renders it (its own headers: html, browser engine, no cache), as a full response', a[0].json.statusCode === 200 && a[0].json.body === rendered && a[0].json.reader_fallback.via === 'reader_keyless'
      && kl.calls[0].headers['X-Return-Format'] === 'html' && kl.calls[0].headers['X-Engine'] === 'browser' && !kl.calls[0].auth, J(kl.calls[0]));
    const no = net([[READER, { statusCode: 402, body: BODY402 }], [/novaand/, { statusCode: 200, body: rendered }]]);
    mock('Any Render Diff?', [{ json: { url: W + '/', index: 0 } }]);
    const b = await run('Render Key Pages', [{ json: { statusCode: 402, body: BODY402, headers: {} } }], { http: no, sleep });
    check('refused again: unread with the reason, and the page itself is NOT fetched as a stand-in (the plain HTML would hide what only exists after scripts)', !!b[0].json.error && b[0].json.reader_fallback.via === 'none' && no.calls.length === 1 && READER.test(no.calls[0].url)
      && /no plain-HTML stand-in/.test(b[0].json.reader_fallback.why), J({ j: b[0].json, c: no.calls }));
    mock('Any Render?', [{ json: { index: 0, url: 'https://blog.example/post', render_url: 'https://r.jina.ai/https://blog.example/post' } }]);
    const bl = await run('Render Pages', [{ json: { data: BODY402 } }], { http: net([[READER, { statusCode: 402, body: BODY402 }]]), sleep });
    check('Backlink Monitor: the reader\'s error JSON is no longer handed on as the linking page (no `data`), it is unread', !('data' in bl[0].json) && !!bl[0].json.error && bl[0].json.reader_fallback.via === 'none', J(bl[0].json));
    const bl2 = await run('Render Pages', [{ json: { data: BODY402 } }], { http: net([[READER, { statusCode: 200, body: rendered }]]), sleep });
    check('Backlink Monitor: rendered through the reader without the key, in the same field', bl2[0].json.data === rendered && bl2[0].json.reader_fallback.via === 'reader_keyless', J(bl2[0].json).slice(0, 200));
  });

  // ---------- W07A6 one ops alert ----------
  await guard('W07A6 ops alert', async () => {
    const SN = 'W07A6 one ops alert per refusal: Reader Refusals names the reader and the error, the row is recorded first, a repeat within 30 minutes is counted and not sent, delivered only on a 2xx';
    reset(); begin(SN); const check = mkCheck(SN);
    const unread = FX.reads['Read Client Pages'].map((j, i) => ({ error: { message: 'x', reader_refused: true, status: 402 }, reader_fallback: { via: i === 0 ? 'reader_keyless' : 'none', refused: { status: 402, name: 'InsufficientBalanceError', message: 'Account balance not enough to run this query, please recharge.' }, path: "the client's own pages", node: 'Read Client Pages' } }));
    const rr = (await run('Reader Refusals', unread.map(j => ({ json: j }))))[0].json;
    check('the alert names the reader, the status and what to do; the details say what the fallback did', !rr.skip && /HTTP 402 InsufficientBalanceError/.test(rr.alert.message) && /recharge it/.test(rr.detail) && /1 through the reader without the key/.test(rr.detail) && /3 could not be read/.test(rr.detail) && /critical/.test(rr.alert.subject), J(rr));
    const skip = (await run('Reader Refusals', CLIENT.map(p => ({ json: { page_text: md(p.title, p.h1, p.para) } }))))[0].json;
    check('a funded key: nothing to alert', skip.skip === true, J(skip));
    // the same identity for every step of the run (another step, other counts)
    const rr2 = (await run('Reader Refusals', [{ json: { ...unread[1], reader_fallback: { ...unread[1].reader_fallback, path: 'regulatory pages', node: 'Read Regulatory Pages' } } }]))[0].json;
    check('one identity for every step (OA.keyOf on the stable part)', rr2.alert_key === rr.alert_key, J([rr.alert_key, rr2.alert_key]));
    mock('Reader Refusals', [{ json: rr }]);
    const first = (await run('Reader Alert Plan', [{ json: {} }]))[0].json;
    check('first sighting: recorded pending, critical, with the details, exactly the table\'s columns', first.delivered === 'pending' && first.severity === 'critical' && first.count === 1 && /could not be read/.test(first.message) && Object.keys(first).length === 18, J(first));
    const prior = { ...first, last_seen_at: new Date(Date.now() - 5 * 60000).toISOString(), delivered: 'webhook' };
    const again = (await run('Reader Alert Plan', [{ json: prior }]))[0].json;
    check('a repeat within 30 minutes: counted on its row (2), the delivered state kept, not sent again', again.count === 2 && again.delivered === 'webhook' && /repeat within 30 minutes/.test(again.notes), J(again));
    mock('Reader Alert Plan', [{ json: again }]);
    const sendAgain = (await run('Reader Alert Send', [{ json: again }]))[0].json;
    check('the repeat is not posted', sendAgain.send_webhook === false && /not sent again/.test(sendAgain.note), J(sendAgain));
    mock('Reader Alert Plan', [{ json: first }]);
    const send = (await run('Reader Alert Send', [{ json: first }]))[0].json;
    check('the first one would be posted where a webhook is configured (none in the harness: the placeholder is not a URL), with the reader in the text', send.send_webhook === false && /no alert webhook is configured/.test(send.note) && /page reader refused/i.test(send.webhook_body.text), J(send));
    const ok = (await run('Reader Alert Delivery', [{ json: { statusCode: 200, body: 'ok' } }]))[0].json;
    check('delivered only on a 2xx', ok.delivered === 'webhook' && ok.attempts === 1 && ok.next_attempt_at === '', J(ok));
    const bad = (await run('Reader Alert Delivery', [{ json: { statusCode: 404, body: 'no_service' } }]))[0].json;
    check('a 404 is a failure with its reason and the next attempt booked', bad.delivered === 'failed' && /HTTP 404/.test(bad.notes) && !!bad.next_attempt_at, J(bad));
  });

  // ---------- W07A7 the generated workflows ----------
  await guard('W07A7 wiring', async () => {
    const SN = 'W07A7 the generated workflows: every node that reads through the page reader has its fallback and feeds nothing else; the fallback feeds the old successors and the one alert chain';
    reset(); begin(SN); const check = mkCheck(SN);
    const WD = path.join(__dirname, '..', 'workflows');
    const wfs = fs.readdirSync(WD).filter(f => /^SEO_Agent_.*\.json$/.test(f) && f !== 'SEO_Agent_v3_original_export.json');
    let readers = 0; const bad = [];
    for (const f of wfs) {
      const wf = (() => { const x = JSON.parse(fs.readFileSync(path.join(WD, f), 'utf8')); return Array.isArray(x) ? x[0] : x; })();
      const by = Object.fromEntries(wf.nodes.map(n => [n.name, n]));
      const outs = (n) => ((wf.connections[n] || {}).main || []).flat().map(t => t.node);
      for (const n of wf.nodes) {
        const isReader = n.type === 'n8n-nodes-base.httpRequest' && (J(n.credentials || {}).includes('SEOcredJinaReade') || /r\.jina\.ai/.test(String((n.parameters || {}).url || '')));
        if (!isReader) continue;
        readers++;
        const fb = n.name.replace(/ \(reader\)$/, '');
        if (!/ \(reader\)$/.test(n.name)) { bad.push(f + ': ' + n.name + ' has no fallback'); continue; }
        if (J(outs(n.name)) !== J([fb])) bad.push(f + ': ' + n.name + ' feeds ' + J(outs(n.name)));
        if (!by[fb] || by[fb].type !== 'n8n-nodes-base.code' || !/await RD\.recover\(H,/.test(by[fb].parameters.jsCode)) bad.push(f + ': ' + fb + ' is not the fallback');
        if (!outs(fb).includes('Reader Refusals')) bad.push(f + ': ' + fb + ' does not feed Reader Refusals');
      }
      if (wf.nodes.some(n => n.name === 'Reader Refusals')) {
        const post = by['Post Reader Alert']; const rsp = (((post.parameters.options || {}).response || {}).response) || {};
        if (!(rsp.fullResponse && rsp.neverError)) bad.push(f + ': Post Reader Alert is not judged on its status');
        if (J(outs('Reader Alert Delivery')) !== J(['Save Reader Alert Delivery'])) bad.push(f + ': the delivery is not written back');
      }
    }
    check('13 reader nodes across the main workflow, the AI Visibility Tracker and the Backlink Monitor, every one wrapped', readers === 13 && !bad.length, J({ readers, bad }));
    const wiring = JSON.parse(fs.readFileSync(path.join(__dirname, 'reader_wiring.json'), 'utf8'));
    check('the build recorded the 11 readers of the main workflow', Object.keys(wiring.readers).length === 11, J(Object.keys(wiring.readers)));
  });
};
