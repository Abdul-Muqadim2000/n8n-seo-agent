// PV1-PV9 (2026-10-27, techand.ai and devaicon.com on production): "I published it" marked a draft published whenever the address
// answered HTTP 200. (a) a NEW draft "ms 365 erp" reported at an older, different page (/dynamics-365-business-central-uae); (b) a
// REFRESH of /insights/is-microsoft-dynamics-365-an-erp-system reported before the refresh was applied (old title, no "erp systems in
// uae"); (c) so one address became the published page of two keywords from two ladders. Publish Check now shows the live page IS the
// draft before any state moves (v5/code/_publish_verify.js), refuses an address that is another keyword's published page, and records
// a page the owner confirms after the warning with verified false and the reason. The pages are the REAL pages, fetched once on
// 2026-10-27 and trimmed (harness/fixtures/publish_*.html); the Devaicon page is the correct published page of its keyword and must pass.
// Called from scenarios_v5.js before the report (one line).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
  const BC = fx('publish_techand_business_central.html'), ERP = fx('publish_techand_d365_erp_system.html'), DEV = fx('publish_devaicon_ai_industrial_automation.html');
  const ok200 = (html) => ({ statusCode: 200, statusMessage: 'OK', headers: { 'content-type': 'text/html; charset=utf-8' }, data: html });
  const U_BC = 'https://www.techand.ai/dynamics-365-business-central-uae', U_ERP = 'https://www.techand.ai/insights/is-microsoft-dynamics-365-an-erp-system';
  const U_DEV = 'https://devaicon.com/insights/ai-in-industrial-automation';
  const row = (o) => ({ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: '', source: 'keyword', page_type: 'Service Page', existing_page_url: '', rung: 0, ladder_id: '', request_id: '', started_at: '2026-10-25T09:00:00.000Z', status: 'written', published_url: '', published_at: '', week: '2026-10-20', ...o });
  const MS365 = row({ keyword: 'ms 365 erp', request_id: '5101', ladder_id: 'lad_ms365', rung: 1, source: 'ladder' });
  const ERPUAE = row({ keyword: 'erp systems in uae', request_id: '5102', ladder_id: 'lad_erpuae', rung: 2, source: 'ladder', page_type: 'Guide', existing_page_url: U_ERP });
  const RUNG_MS = { domain: 'techand.ai', ladder_id: 'lad_ms365', keyword: 'ms 365 erp', rung: 1, status: 'writing', target_url: 'https://www.techand.ai/ms-365-erp', page_exists: false, page_type: 'Service Page' };
  const RUNG_ERP = { domain: 'techand.ai', ladder_id: 'lad_erpuae', keyword: 'erp systems in uae', rung: 2, status: 'writing', target_url: U_ERP, page_exists: true, page_type: 'Guide' };
  const RUNG_D365 = { domain: 'techand.ai', ladder_id: 'lad_d365', keyword: 'is microsoft dynamics 365 an erp system', rung: 2, status: 'published', target_url: U_ERP, page_exists: true, page_type: 'Guide' };
  const check1 = async (body, html, logs, ladders) => {
    reset();
    const n = await run('Normalize Input', { body: { mode: 'published', domain: body.domain || 'techand.ai', callback_url: 'https://hooks.example.com/x', request_id: 'pub-' + Math.random().toString(36).slice(2, 8), ...body } });
    mock('Load Content Log (Published)', (logs || []).map(json => ({ json }))); mock('Load Ladders (Published)', (ladders && ladders.length ? ladders : [{}]).map(json => ({ json }))); mock('Load Query History (Published)', [{ json: {} }]);
    mock('Fetch Published Page', html);
    const c = (await run('Publish Check', [{ json: {} }]))[0].json;
    return { c, n: n[0].json };
  };
  const notMoved = (c, prior) => c.recorded_live === false && c.log_row.status === prior && c.log_row.published_url === '' && c.log_row.published_at === '' && c.ladder_row === null;

  await guard('PV1 a new draft reported at another page', async () => {
    const SN = 'PV1 (2026-10-27, case a) the NEW draft "ms 365 erp" reported at /dynamics-365-business-central-uae, a different live page ("Business Central ERP Solutions in UAE"): nothing is marked published, the owner is told what was found';
    begin(SN); const check = mkCheck(SN);
    const { c } = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC }, ok200(BC), [MS365], [RUNG_MS]);
    check('the page answers (live) but is not recorded', c.live === true && c.recorded_live === false && c.verified === false, J({ live: c.live, rec: c.recorded_live }));
    check('outcome not_the_draft, confirmable', c.verify === 'not_the_draft' && c.confirmable === true, J({ v: c.verify, conf: c.confirmable }));
    check('the draft row keeps its state (written), no URL, no date; the ladder rung is not touched', notMoved(c, 'written'), J({ row: c.log_row, lad: c.ladder_row }));
    check('the evidence names the live title and heading and what was missing', c.verify_evidence && /Business Central ERP Solutions in UAE/.test(c.verify_evidence.title) && /Business Central Partner in UAE/.test(c.verify_evidence.h1) && c.verify_evidence.keyword_in_title === false && c.verify_evidence.keyword_in_text === 0 && c.verify_missing.length >= 1, J(c.verify_evidence));
    check('the summary says it was not marked and what to do, in plain words (no em dash, no ellipsis character)', /^Not marked published\. This page does not look like the page written for "ms 365 erp"/.test(c.summary) && /Check the address/.test(c.summary) && !/[—…“”]/.test(c.verify_message), c.summary);
    check('the downstream ladder update is skipped', (await run('Published Ladder Row', [{ json: c }]))[0].json.skip === true, J(c.ladder_row));
    const r = (await run('Build Published Response', [{ json: { ...c, stored: true } }]))[0].json;
    check('the callback carries recorded false, the outcome, the message and the evidence', r.recorded === false && r.live === true && r.verify === 'not_the_draft' && r.confirmable === true && /does not look like/.test(r.verify_message) && r.verify_evidence && r.content_request_id === '5101', J({ rec: r.recorded, v: r.verify }));
  });

  await guard('PV2 a refresh reported before it was applied', async () => {
    const SN = 'PV2 (2026-10-27, case b) the REFRESH "erp systems in uae" of /insights/is-microsoft-dynamics-365-an-erp-system reported while the page still has its old title: not marked, outcome refresh_not_live, on www and on the bare host';
    begin(SN); const check = mkCheck(SN);
    const { c } = await check1({ keyword: 'erp systems in uae', content_request_id: '5102', url: U_ERP }, ok200(ERP), [ERPUAE], [RUNG_ERP, RUNG_D365]);
    check('refresh_not_live, nothing recorded, the rung untouched', c.verify === 'refresh_not_live' && notMoved(c, 'written'), J({ v: c.verify, row: c.log_row, lad: c.ladder_row }));
    check('the old title is quoted and the keyword is missing from title and heading', /UAE Buyers Guide/.test(c.verify_evidence.title) && c.verify_evidence.keyword_in_title === false && c.verify_evidence.keyword_in_heading === false && /update does not look live yet/.test(c.verify_message), J(c.verify_evidence));
    check('the page text alone never proves a refresh (the old page was about the topic already)', c.verify_evidence.refresh_of === U_ERP, J(c.verify_evidence));
    const bare = await check1({ keyword: 'erp systems in uae', content_request_id: '5102', url: 'https://techand.ai/insights/is-microsoft-dynamics-365-an-erp-system/' }, ok200(ERP), [{ ...ERPUAE, existing_page_url: 'https://www.techand.ai/insights/is-microsoft-dynamics-365-an-erp-system' }], [RUNG_ERP, RUNG_D365]);
    check('the bare host with a trailing slash is the same page: same outcome (not "another address")', bare.c.verify === 'refresh_not_live' && notMoved(bare.c, 'written'), J({ v: bare.c.verify }));
    const elsewhere = await check1({ keyword: 'erp systems in uae', content_request_id: '5102', url: U_BC }, ok200(BC), [ERPUAE], [RUNG_ERP]);
    check('a refresh sent at another address: refresh_other_address, confirmable, nothing recorded', elsewhere.c.verify === 'refresh_other_address' && elsewhere.c.confirmable === true && notMoved(elsewhere.c, 'written'), J({ v: elsewhere.c.verify }));
  });

  await guard('PV3 one address, two keywords', async () => {
    const SN = 'PV3 (2026-10-27, case c) an address already recorded as the published page of ANOTHER keyword is refused, host-agnostic (www / bare, trailing slash), even when the page uses the keyword and even after a confirmation; a planned refresh of exactly that page is the one exception';
    begin(SN); const check = mkCheck(SN);
    const BCROW = row({ keyword: 'business central erp uae', request_id: '4001', status: 'published', published_url: 'https://techand.ai/dynamics-365-business-central-uae/', published_at: '2026-10-01T00:00:00.000Z' });
    const synthetic = BC.replace(/<title>[^<]*<\/title>/i, '<title>MS 365 ERP for UAE Companies | Tech&amp;</title>');
    const { c } = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC }, ok200(synthetic), [MS365, BCROW], [RUNG_MS]);
    check('address_used_by_other_keyword, names the other keyword, not confirmable, nothing recorded', c.verify === 'address_used_by_other_keyword' && c.confirmable === false && /already the published page for "business central erp uae"/.test(c.verify_message) && notMoved(c, 'written'), J({ v: c.verify, m: c.verify_message }));
    const conf = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC, confirm_mismatch: true }, ok200(synthetic), [MS365, BCROW], [RUNG_MS]);
    check('a confirmation does not override it (one URL never becomes the page of two keywords)', conf.c.verify === 'address_used_by_other_keyword' && conf.c.confirmed === false && notMoved(conf.c, 'written'), J({ v: conf.c.verify, rec: conf.c.recorded_live }));
    const lad = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: 'https://techand.ai/insights/is-microsoft-dynamics-365-an-erp-system' }, ok200(ERP.replace(/<title>[^<]*<\/title>/i, '<title>MS 365 ERP | Tech&amp;</title>')), [MS365], [RUNG_MS, RUNG_D365]);
    check('a published ladder rung of another ladder holds its address too (seo_ladders read, bare host)', lad.c.verify === 'address_used_by_other_keyword' && /is microsoft dynamics 365 an erp system/.test(lad.c.verify_message), J({ v: lad.c.verify }));
    const same = await check1({ keyword: 'business central erp uae', url: U_BC + '/' }, ok200(BC), [BCROW], []);
    check('the same keyword reported again at its own address is fine (not "another keyword")', same.c.verify === 'ok' && same.c.recorded_live === true, J({ v: same.c.verify }));
  });

  await guard('PV4 the correct new page passes (real Devaicon page)', async () => {
    const SN = 'PV4 (2026-10-27) the real Devaicon page IS the published page of "ai in industrial automation": verified, recorded published with its address';
    begin(SN); const check = mkCheck(SN);
    const DRAFT = row({ site_id: 'site_devaicon-com', domain: 'devaicon.com', keyword: 'ai in industrial automation', request_id: '6200', page_type: 'Blog post', source: 'keyword' });
    const { c } = await check1({ domain: 'devaicon.com', keyword: 'ai in industrial automation', content_request_id: '6200', url: U_DEV }, ok200(DEV), [DRAFT], []);
    check('verified (keyword in the title and the heading) and recorded', c.verify === 'ok' && c.verified === true && c.recorded_live === true && c.verify_evidence.keyword_in_title === true && c.verify_evidence.keyword_in_heading === true, J({ v: c.verify, ev: c.verify_evidence }));
    check('the draft row is published with the address and a date; no note', c.log_row.status === 'published' && c.log_row.published_url === U_DEV && !!c.log_row.published_at && !('publish_note' in c.log_row), J(c.log_row));
    check('the summary is the usual one', /^Recorded\. /.test(c.summary), c.summary);
    const wrongEarlier = await check1({ domain: 'devaicon.com', keyword: 'ai in industrial automation', content_request_id: '6200', url: 'https://devaicon.com/insights/ai-in-manufacturing' }, { statusCode: 404, statusMessage: 'Not Found', headers: {}, data: '<html><body>Not found</body></html>' }, [DRAFT], []);
    check('a wrong address that answers 404 is still the old path (not fetched, nothing recorded)', wrongEarlier.c.live === false && wrongEarlier.c.verify === 'not_live' && wrongEarlier.c.log_row.status === 'written', J({ live: wrongEarlier.c.live, v: wrongEarlier.c.verify }));
  });

  await guard('PV5 the correct refresh passes', async () => {
    const SN = 'PV5 (2026-10-27) the refresh once applied (new title with the keyword) at exactly the page it updates: recorded, and the page that was another keyword\'s published page now carries both, said in the summary';
    begin(SN); const check = mkCheck(SN);
    const applied = ERP.replace(/<title>[^<]*<\/title>/i, '<title>ERP Systems in UAE: Is Microsoft Dynamics 365 One? | Tech&amp;</title>');
    const { c } = await check1({ keyword: 'erp systems in uae', content_request_id: '5102', url: 'https://techand.ai/insights/is-microsoft-dynamics-365-an-erp-system' }, ok200(applied), [ERPUAE], [RUNG_ERP, RUNG_D365]);
    check('verified and recorded on the refreshed page', c.verify === 'ok' && c.recorded_live === true && c.log_row.status === 'published' && c.ladder_row && c.ladder_row.status === 'published', J({ v: c.verify, row: c.log_row.status, lad: c.ladder_row }));
    check('the note says the page now carries both keywords', /already the published page for "is microsoft dynamics 365 an erp system"/.test(c.verify_note) && /carries both keywords/.test(c.summary), c.summary);
  });

  await guard('PV6 the owner confirms after the warning', async () => {
    const SN = 'PV6 (2026-10-27) "It is the right page, mark it published": re-sent with confirm_mismatch: true, the page is recorded published with verified false and the reason kept (publish_note), visible in the content list';
    begin(SN); const check = mkCheck(SN);
    const { c, n } = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC, confirm_mismatch: true }, ok200(BC), [MS365], [RUNG_MS]);
    check('Normalize Input passes confirm_mismatch through', n.confirm_mismatch === true, J(n.confirm_mismatch));
    check('recorded, not verified, confirmed', c.recorded_live === true && c.verified === false && c.confirmed === true && c.verify === 'not_the_draft', J({ rec: c.recorded_live, v: c.verify }));
    check('the row is published with the reason stored', c.log_row.status === 'published' && c.log_row.published_url === U_BC && /^Marked published by you after a warning: the page did not match the draft/.test(c.log_row.publish_note || ''), J(c.log_row));
    check('the ladder rung follows (the owner confirmed it)', c.ladder_row && c.ladder_row.status === 'published' && c.ladder_row.target_url === U_BC, J(c.ladder_row));
    check('the summary says it was marked on the owner\'s word', /^Marked published as you confirmed/.test(c.summary), c.summary);
    const s = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC, confirm_mismatch: 'true' }, ok200(BC), [MS365], [RUNG_MS]);
    check('"true" as a string (a form) is a confirmation too', s.n.confirm_mismatch === true && s.c.recorded_live === true, J(s.n.confirm_mismatch));
    const later = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC.replace('dynamics-365-business-central-uae', 'ms-365-erp') }, ok200(BC.replace(/<title>[^<]*<\/title>/i, '<title>MS 365 ERP in the UAE | Tech&amp;</title>')), [{ ...MS365, status: 'published', published_url: U_BC, publish_note: 'Marked published by you after a warning: x' }], [RUNG_MS]);
    check('a later verified report clears the stored reason', later.c.verify === 'ok' && later.c.log_row.publish_note === '', J(later.c.log_row));
  });

  await guard('PV7 the draft title and the page text', async () => {
    const SN = 'PV7 (2026-10-27) other evidence: the live title matching the DRAFT\'s own title (sent by the app) counts; a new page whose text uses the keyword in 3+ sentences counts; a single mention does not';
    begin(SN); const check = mkCheck(SN);
    const t = BC.replace(/<title>[^<]*<\/title>/i, '<title>Microsoft 365 ERP for UAE Businesses: A Buyer\'s Guide | Tech&amp;</title>');
    const { c, n } = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC, draft_title: 'Microsoft 365 ERP for UAE Businesses: A Buyer\'s Guide', draft_h1: 'Microsoft 365 ERP for UAE businesses' }, ok200(t), [MS365], [RUNG_MS]);
    check('Normalize Input passes the draft title and heading', n.draft_title === 'Microsoft 365 ERP for UAE Businesses: A Buyer\'s Guide' && n.draft_h1 === 'Microsoft 365 ERP for UAE businesses', J({ t: n.draft_title, h: n.draft_h1 }));
    check('the draft title on the live page verifies it', c.verify === 'ok' && c.verify_evidence.draft_match === true && c.recorded_live === true, J({ v: c.verify, ev: c.verify_evidence }));
    const without = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC, draft_title: 'Something else entirely about payroll' }, ok200(t), [MS365], [RUNG_MS]);
    check('a different draft title does not', without.c.verify === 'not_the_draft', J({ v: without.c.verify }));
    const body3 = BC.replace(/<main\b[^>]*>/i, (m) => m + '<p>MS 365 ERP fits small teams.</p><p>Why MS 365 ERP costs less.</p><p>MS 365 ERP for retail.</p>');
    const text3 = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC }, ok200(body3), [MS365], [RUNG_MS]);
    check('a new page using the keyword in 3 sentences of its own content passes', text3.c.verify === 'ok' && text3.c.verify_evidence.keyword_in_text >= 3, J(text3.c.verify_evidence));
    const body1 = BC.replace(/<main\b[^>]*>/i, (m) => m + '<p>We also implement MS 365 ERP.</p>');
    const text1 = await check1({ keyword: 'ms 365 erp', content_request_id: '5101', url: U_BC }, ok200(body1), [MS365], [RUNG_MS]);
    check('one passing mention does not', text1.c.verify === 'not_the_draft' && text1.c.verify_evidence.keyword_in_text === 1 && /uses it once/.test(text1.c.verify_message), J(text1.c.verify_evidence));
  });

  await guard('PV8 the keyword rule on the real pages', async () => {
    const SN = 'PV8 (2026-10-27) the keyword rule on the three real pages: each page passes for its own keyword and fails for the keyword reported at it by mistake';
    begin(SN); const check = mkCheck(SN);
    const cases = [
      [BC, U_BC, 'business central erp uae', 'ok'], [BC, U_BC, 'dynamics 365 business central uae', 'ok'], [BC, U_BC, 'ms 365 erp', 'not_the_draft'], [BC, U_BC, 'erp systems in uae', 'not_the_draft'],
      [ERP, U_ERP, 'is microsoft dynamics 365 an erp system', 'ok'], [ERP, U_ERP, 'erp systems in uae', 'not_the_draft'], [ERP, U_ERP, 'ms 365 erp', 'not_the_draft'],
      [DEV, U_DEV, 'ai in industrial automation', 'ok'], [DEV, U_DEV, 'industrial automation ai', 'ok'], [DEV, U_DEV, 'ai consulting dubai', 'not_the_draft'],
    ];
    const got = [];
    for (const [html, url, kw, want] of cases) {
      const dom = url.indexOf('devaicon') >= 0 ? 'devaicon.com' : 'techand.ai';
      const { c } = await check1({ domain: dom, keyword: kw, url }, ok200(html), [], []);
      got.push([kw, url.replace(/^https:\/\/[^/]+/, ''), c.verify, want]);
    }
    const bad = got.filter(g => g[2] !== g[3]);
    check(cases.length + ' cases, all as expected (precision and recall 100% on this set)', !bad.length, J(bad));
  });
};
