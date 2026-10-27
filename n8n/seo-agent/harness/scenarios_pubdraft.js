// PD1-PD3 (2026-10-23, techand.ai on production): a draft the quality check refused ("needs your edits") is finished by hand outside
// the app, published on the client's website, then reported with "I published this page" from its report. The app now offers that
// button on such a draft, prefilled with the draft's keyword and its engine request id, so the check must (PD1) resolve the draft by
// that id even when the typed keyword differs, (PD2) say so on the live page when a bracket the owner had to fill in is still there,
// with the one placeholder detector (PH) that Content QA and the app use, and (PD3) not count what is not a gap on a real page.
// Called from scenarios_v5.js before the report (one line).
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const URL1 = 'https://www.techand.ai/blog/ai-consulting-dubai/';
  const DRAFT = { site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'ai consulting services dubai', source: 'keyword', page_type: 'Blog post', existing_page_url: '', rung: 0, ladder_id: '', request_id: '4127', started_at: '2026-10-22T09:00:00.000Z', status: 'not_ready', published_url: '', published_at: '', week: '2026-10-19' };
  const OTHER = { ...DRAFT, keyword: 'ai consulting dubai', request_id: '3999', status: 'written', page_type: 'Guide' };
  const page = (article, o = {}) => ({ statusCode: 200, statusMessage: 'OK', headers: { 'content-type': 'text/html; charset=utf-8' },
    data: '<!DOCTYPE html><html><head><title>' + (o.title || 'AI Consulting Services Dubai') + ' | Tech&amp;</title><meta name="description" content="How AI consulting services in Dubai are scoped, priced and delivered, with a checklist for UAE companies.">'
      + '<link rel="canonical" href="' + URL1 + '"><script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"AI consulting services Dubai","author":{"@type":"Person","name":"Sara Khan"},"datePublished":"2026-10-22"}</script></head>'
      + '<body><nav>Home Services [Menu]</nav>' + (o.noArticle ? '' : '<article>') + '<h1>' + (o.h1 || o.title || 'AI consulting services Dubai') + '</h1><p class="byline">By Sara Khan, updated 22 Oct 2026</p>' + article
      + Array.from({ length: 700 }, (_, i) => 'word' + (i % 40)).join(' ') + (o.noArticle ? '' : '</article>') + '<footer>' + (o.footer || 'Contact [email&#160;protected]') + '</footer></body></html>' });
  const publishCheck = async (body, html) => {
    reset();
    await run('Normalize Input', { body: { mode: 'published', domain: 'techand.ai', callback_url: 'https://hooks.example.com/x', request_id: 'pub-77', ...body } });
    mock('Load Content Log (Published)', [DRAFT, OTHER].map(json => ({ json }))); mock('Load Ladders (Published)', [{ json: {} }]); mock('Load Query History (Published)', [{ json: {} }]);
    mock('Fetch Published Page', html);
    return (await run('Publish Check', [{ json: {} }]))[0].json;
  };
  const named = (c, name) => (c.checks || []).find(x => x.name === name) || null;

  await guard('PD1 the draft is found by its request id', async () => {
    const SN = 'PD1 (2026-10-23) "I published this page" on a draft that needed edits: the app sends the draft\'s request id, so the check marks THAT draft published even when the keyword typed differs';
    begin(SN); const check = mkCheck(SN);
    const c = await publishCheck({ keyword: 'AI consulting in Dubai', content_request_id: '4127', url: URL1 }, page('<p>Fees start at AED 18,000 for an assessment.</p>'));
    check('the content-log row found is the draft named by content_request_id (not the keyword match)', c.log_found === true && c.log_row && String(c.log_row.request_id) === '4127', J({ found: c.log_found, row: c.log_row && c.log_row.request_id }));
    check('the stored keyword is the draft\'s own, so the content list and tracking follow one row', c.keyword === 'ai consulting services dubai' && c.log_row.keyword === 'ai consulting services dubai', J({ kw: c.keyword, row: c.log_row.keyword }));
    check('a live page moves the not_ready draft to published with its address', c.live === true && c.log_row.status === 'published' && c.log_row.published_url === URL1, J({ live: c.live, status: c.log_row.status, url: c.log_row.published_url }));
    const k = await publishCheck({ keyword: 'ai consulting dubai', url: URL1 }, page('<p>Fees start at AED 18,000.</p>'));
    check('without an id the keyword still decides (the older path is unchanged)', String(k.log_row.request_id) === '3999', J(k.log_row && k.log_row.request_id));
  });

  await guard('PD4 the ladder rung follows the draft found by its request id', async () => {
    const SN = 'PD4 (2026-10-23, techand.ai on production) the draft is found by its request id while the typed keyword names no rung: its own ladder rung is moved to published with the live address, not left not_ready';
    begin(SN); const check = mkCheck(SN);
    const LID = 'lad_mvdyn365', LURL = 'https://www.techand.ai/insights/is-microsoft-dynamics-365-an-erp-system';
    const RUNG = { domain: 'techand.ai', ladder_id: LID, keyword: 'is microsoft dynamics 365 an erp system', rung: 2, status: 'not_ready', target_url: 'https://www.techand.ai/is-microsoft-dynamics-365-an-erp-system', page_exists: false, page_type: 'Guide' };
    const HEAD = { ...RUNG, keyword: 'dynamics 365 erp system', rung: 4, status: 'planned', target_url: 'https://www.techand.ai/dynamics-365-erp-system' };
    const NEAR = { ...RUNG, keyword: 'microsoft dynamics erp', rung: 3, status: 'planned', target_url: 'https://www.techand.ai/microsoft-dynamics-erp' };
    const LOG = { ...DRAFT, keyword: RUNG.keyword, source: 'ladder', page_type: 'Guide', rung: 2, ladder_id: LID, request_id: '1240', status: 'not_ready' };
    const runIt = async (body, ladders, logs, html) => {
      reset();
      await run('Normalize Input', { body: { mode: 'published', domain: 'techand.ai', callback_url: 'https://hooks.example.com/x', request_id: 'pub-78', ...body } });
      mock('Load Content Log (Published)', logs.map(json => ({ json }))); mock('Load Ladders (Published)', ladders.map(json => ({ json }))); mock('Load Query History (Published)', [{ json: {} }]);
      mock('Fetch Published Page', html || page('<p>Dynamics 365 is a family of business applications.</p>', { title: 'Is Microsoft Dynamics 365 an ERP System? UAE Buyers Guide' }));   // 2026-10-27: the live page is the draft (its keyword in the title)
      return (await run('Publish Check', [{ json: {} }]))[0].json;
    };
    const c = await runIt({ keyword: 'microsoft dynamics 365 erp system', content_request_id: '1240', url: LURL }, [HEAD, NEAR, RUNG], [LOG]);
    check('the draft is found by its id', c.log_found === true && String(c.log_row.request_id) === '1240', J({ found: c.log_found, rid: c.log_row && c.log_row.request_id }));
    check('its ladder rung is found although the typed keyword names no rung', c.ladder_found === true, J({ ladder_found: c.ladder_found }));
    check('the rung moves to published with the live address and page_exists', c.ladder_row && c.ladder_row.ladder_id === LID && c.ladder_row.keyword === RUNG.keyword && c.ladder_row.status === 'published' && c.ladder_row.target_url === LURL && c.ladder_row.page_exists === true, J(c.ladder_row));
    check('no other rung (head term, near match) is touched', c.ladder_row && c.ladder_row.keyword !== HEAD.keyword && c.ladder_row.keyword !== NEAR.keyword, J(c.ladder_row));
    const other = await runIt({ keyword: 'microsoft dynamics 365 erp system', content_request_id: '1240', url: LURL }, [{ ...RUNG, ladder_id: 'lad_other' }, HEAD], [LOG]);
    check('a rung of the same keyword in another ladder is still found by keyword when the id does not match', other.ladder_found === true && other.ladder_row && other.ladder_row.keyword === RUNG.keyword, J(other.ladder_row));
    const typed = await runIt({ keyword: 'dynamics 365 erp system', url: 'https://www.techand.ai/dynamics-365-erp-system' }, [HEAD, RUNG], [], page('<p>Dynamics 365 is a family of business applications.</p>', { title: 'Dynamics 365 ERP System for UAE Companies' }));
    check('without a draft the typed keyword still decides (older path unchanged)', typed.ladder_found === true && typed.ladder_row && typed.ladder_row.keyword === HEAD.keyword, J(typed.ladder_row));
    const down = await runIt({ keyword: 'microsoft dynamics 365 erp system', content_request_id: '1240', url: LURL }, [RUNG], [LOG],
      { statusCode: 404, statusMessage: 'Not Found', headers: { 'content-type': 'text/html' }, data: '<html><body>Not found</body></html>' });
    check('a page answering 404: the rung is found but left untouched (no ladder row), the draft stays not_ready', down.ladder_found === true && down.live === false && down.ladder_row === null && down.log_row.status === 'not_ready', J({ found: down.ladder_found, live: down.live, row: down.ladder_row, st: down.log_row && down.log_row.status }));
  });

  await guard('PD2 leftover brackets on the live page are named', async () => {
    const SN = 'PD2 (2026-10-23) a bracket the owner had to fill in is still on the live page: the check names it ("No brackets left to fill in"), with the shared detector (PH)';
    begin(SN); const check = mkCheck(SN);
    const c = await publishCheck({ keyword: 'ai consulting services dubai', content_request_id: '4127', url: URL1 },
      page('<p>Fees start at [Price] for an assessment. [Confirm: 40+ projects delivered in the UAE] Our team is led by [name, role].</p>'));
    const b = named(c, 'No brackets left to fill in');
    check('the check is there and fails', b && b.ok === false, J(b));
    check('it counts the three brackets and names them', b && /^3 still on the page: /.test(b.detail) && /\[Price\]/.test(b.detail) && /\[Confirm: 40\+ projects/.test(b.detail) && /\[name, role\]/.test(b.detail), J(b && b.detail));
    check('it is one of the failed checks the report lists', (c.failed || []).includes('No brackets left to fill in'), J(c.failed));
    check('the page is still recorded as published: it is live, the report says what to fix on it', c.log_row.status === 'published', J(c.log_row.status));
    const ok = await publishCheck({ keyword: 'ai consulting services dubai', content_request_id: '4127', url: URL1 }, page('<p>Fees start at AED 18,000. We have delivered 40+ projects. Our team is led by Sara Khan, Head of AI.</p>'));
    const b2 = named(ok, 'No brackets left to fill in');
    check('a finished page passes it ("none found")', b2 && b2.ok === true && b2.detail === 'none found', J(b2));
  });

  await guard('PD3 what is not a gap on a real page', async () => {
    const SN = 'PD3 (2026-10-23) on a real page the check reads the article, not the menu or footer; Cloudflare\'s "[email protected]", footnotes, checkboxes and "[Updated 2026]" are not gaps; an author bracket is counted once';
    begin(SN); const check = mkCheck(SN);
    const c = await publishCheck({ keyword: 'ai consulting services dubai', url: URL1 },
      page('<p>See the <a href="/x">pricing guide</a>, a footnote [1], a checkbox [x] and [Updated October 2026]. Write to [email&#160;protected] today.</p>', { footer: '[Cookie settings] [email protected]' }));
    const b = named(c, 'No brackets left to fill in');
    check('menu, footer, footnote, date label and Cloudflare e-mail masking: none counted', b && b.ok === true, J(b));
    const a = await publishCheck({ keyword: 'ai consulting services dubai', url: URL1 }, page('<p>[Author insight: a client story from Dubai] More text.</p>'));
    check('an author bracket fails the author check only (no double count)', named(a, 'No author placeholders left') && named(a, 'No author placeholders left').ok === false && named(a, 'No brackets left to fill in').ok === true, J(a.checks.filter(x => /placeholder|bracket/i.test(x.name))));
    const n = await publishCheck({ keyword: 'ai consulting services dubai', url: URL1 }, page('<p>Price: [Price].</p>', { noArticle: true, footer: 'Footer' }));
    check('a page without <article> or <main> is read whole, so a bracket is still found', named(n, 'No brackets left to fill in').ok === false, J(named(n, 'No brackets left to fill in')));
  });
};
