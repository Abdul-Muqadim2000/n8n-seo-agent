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
    data: '<!DOCTYPE html><html><head><title>AI Consulting Services Dubai | Tech&amp;</title><meta name="description" content="How AI consulting services in Dubai are scoped, priced and delivered, with a checklist for UAE companies.">'
      + '<link rel="canonical" href="' + URL1 + '"><script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"AI consulting services Dubai","author":{"@type":"Person","name":"Sara Khan"},"datePublished":"2026-10-22"}</script></head>'
      + '<body><nav>Home Services [Menu]</nav>' + (o.noArticle ? '' : '<article>') + '<h1>AI consulting services Dubai</h1><p class="byline">By Sara Khan, updated 22 Oct 2026</p>' + article
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
