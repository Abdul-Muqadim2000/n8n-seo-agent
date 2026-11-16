// LG1-LG3 (client reports 2026-11-16, build section 191; docs/client-reports-2026-11-16/LIVE_GRADE.md). A client published two pages we
// delivered at 97 and 98 ("95+"), and the live page grade read 84 with the publish check failing six image checks. The live text was the
// client's own rewrite (0% and 7% of our sentences), four checks measured our own reader and the site template, and the image checks read
// the site chrome. Synthetic pages only (no client text): the finalize body is the anonymised replay_3336 fixture (novaand.example).
//   LG1  the live grade says whose text is live (kept_pct of the delivered sentences), what it measured (the live page, the day), what to do
//        (on the website, then Re-check) and, part by part, why points went (live_parts, the longest sentences)
//   LG2  on a LIVE page only: a direct answer without our "Quick answer:" label counts, a questions section after the article is set aside
//        before "FAQ last", a table the reader flattened is a table (and no run-on sentence), the site name the CMS appends to the title is
//        not counted in its 60 characters; a final version of the same text is graded as before. Every run: an "FAQ" word inside a normal
//        heading is no second FAQ section, and an image is never a source (nor unlinked as a "repeat" of one)
//   LG3  the publish check reads the images of the article (not related cards, a "book a session" avatar or the logo), counts decorative
//        ones apart, says "no images" once, names an image borrowed from Google Images, a background hero and the images we delivered
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const F36 = R.load('replay_3336.json.gz');
  const BODY0 = F36.nodes['Finalize Webhook']['0'].items[0].json.body;
  const D = 'https://www.' + BODY0.domain;
  const LIVE = D + '/ms-365-erp-uae';
  const gating = { qa_blocking: [], duplicate_targets: [], verdict: null, score: null, score_withheld: false, page_type: 'Service Page', verdict_acknowledged: false, copied_passages: [], content_request_id: '3298', length_points: null };
  const reader = (md, title) => ({ statusCode: 200, data: 'Title: ' + (title || 'MS 365 ERP for UAE Businesses') + '\nURL Source: ' + LIVE + '\n\nMarkdown Content:\n' + md });
  const chain = async (body, read) => {
    reset(); delete store['Finalize Editor'];
    const lp = await run('Live Read Plan', [{ json: { body, headers: {} } }], { code: 'Finalize__Live_Read_Plan' });
    mock('Live Read Plan', lp);
    const lb = lp[0].json.live_plan.read ? await run('Live Page Body', [{ json: read }], { code: 'Finalize__Live_Page_Body' }) : lp;
    const dp = await run('Duplicate Status Plan', lb, { code: 'Finalize__Duplicate_Status_Plan' });
    const pb = await run('Parse Brief', dp, { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { pb: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    return { pb: pb[0].json, qa: qa[0].json, v: (await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' }))[0].json.body };
  };
  const META = { ...BODY0.meta, meta_description: 'How MS 365 ERP brings finance, stock and reporting into one system for UAE companies, what it costs and how a project runs.' };
  const liveBody = (live) => ({ ...clone(BODY0), meta: clone(META), grade_only: true, answers: [], page_run: clone(gating), grade_live: { url: LIVE, h1: 'MS 365 ERP for UAE Businesses', title: 'MS 365 ERP for UAE Businesses', ...live } });
  const finalBody = (md) => ({ ...clone(BODY0), meta: clone(META), markdown: md, answers: [], page_run: clone(gating) });
  const para = (n, seed) => Array.from({ length: n }, (_, i) => ['Teams', 'record', 'orders', 'and', 'invoices', 'in', 'one', 'place', 'so', 'managers', 'see', 'stock', 'cash', 'and', 'sales', 'today.'][(i + seed) % 16]).join(' ');
  // a rewrite in the client's own words: long sentences, long words, no "Quick answer" label, the site template's questions after the article
  const REWRITE = [
    '# MS 365 ERP for UAE Businesses',
    '',
    '## What is MS 365 ERP and how does it differ from separate business tools?',
    '',
    '**MS 365 ERP** is the combination of Microsoft Dynamics 365 finance and operations applications with the wider Microsoft 365 productivity suite, so that accounting, inventory, purchasing and management reporting share one data model and one sign-in. Organisations across the Emirates adopt it to replace disconnected spreadsheets and to give managers current figures.',
    '',
    'Comprehensive operational visibility across distributed organisational entities necessitates considerable integration planning, particularly regarding regulatory documentation, multicurrency consolidation, intercompany reconciliation and authorisation hierarchies that accommodate geographically dispersed management structures within regional enterprises.',
    '',
    '## Comparing ERP options for mid-sized companies',
    '',
    '| Criterion | Spreadsheets | MS 365 ERP |',
    '| --- | --- | --- |',
    '| Month-end close | Manual | Automated |',
    '| VAT returns | Copied by hand | Prepared from postings |',
    '',
    '## How an MS 365 ERP implementation progresses through its operational phases',
    '',
    'Implementation methodologies typically incorporate discovery workshops, configuration iterations, comprehensive data migration rehearsals, integration verification activities and organisational change management programmes before productive operational utilisation commences across participating business divisions.',
    '',
    '## What determines the investment required?',
    '',
    para(64, 0),
    '',
    para(64, 5),
    '',
    'Licensing considerations, implementation partner engagement, customisation requirements and ongoing administrative responsibilities collectively determine the total organisational investment associated with enterprise resource planning modernisation initiatives.',
    '',
    '## Talk to our MS 365 ERP team',
    '',
    'Book a call and we will review your current processes with you.',
    '',
    '## Frequently asked questions',
    '',
    'How long does an implementation take?',
    'Most projects take between four and nine months, depending on data quality and the number of entities involved.',
    '',
    'Can invoices be printed in Arabic?',
    'Yes, invoices and reports can be printed in Arabic and English from the same records.',
  ].join('\n');

  // ---------- LG1 whose text is live, what was measured, what to do, part by part ----------
  await guard('LG1 live grade says whose text', async () => {
    const SN = 'LG1 (client reports 2026-11-16, section 191) the live grade of a page the client rewrote says how much of the delivered text is on it, that it measured the live page, that the next step is on the website, and why each part lost points; our own text read back verbatim is "kept"';
    begin(SN); const check = mkCheck(SN);
    const own = await chain(liveBody({}), reader(REWRITE));
    const v = own.v || {}; const lr = v.live_read || {};
    check('the request is graded as a live page (grade_only, live_read ok)', v.grade_only === true && lr.ok === true, J({ g: v.grade_only, lr, pb: own.pb && own.pb.errors }));
    check('kept_pct: none of the delivered sentences is on the rewritten live page', lr.kept_pct === 0 && lr.kept_sentences === 0 && lr.delivered_sentences >= 40, J({ kept: lr.kept_pct, n: lr.kept_sentences, of: lr.delivered_sentences }));
    check('the basis names the live page and the day, never "this final version, after your answers"', /measured on the live page https?:\/\/\S+ms-365-erp-uae as read on \d{4}-\d{2}-\d{2}, with the same check as the version we delivered/.test(v.grade.basis) && !/after your answers/.test(v.grade.basis), v.grade.basis);
    check('the next step is a change on the website and a Re-check, never the editor', /on your website|Re-check/.test(v.delivery.next_step) && !/in the editor/.test(v.delivery.next_step), J({ st: v.delivery.status, next: v.delivery.next_step }));
    const parts = v.live_parts || [];
    check('live_parts: one row per scored part (structure, coverage, readability, specificity, plain language, sources, fit) with points, max and reasons where points were lost',
      parts.length === 7 && parts.every(p => typeof p.points === 'number' && p.max > 0 && Array.isArray(p.reasons) && (p.points >= p.max || p.reasons.length > 0 || p.dim === 'fit' || p.dim === 'specificity')), J(parts));
    const rd = parts.find(p => p.dim === 'readability') || {};
    check('readability lost points and says the reading ease and the sentence length', rd.points < rd.max && /Reading ease -?[\d.]+ out of 100/.test(rd.reasons[0] || '') && /sentences average [\d.]+ words/.test(rd.reasons[0] || ''), J(rd));
    check('the longest sentences are named (at most 5, longest first, each over 22 words)', Array.isArray(v.readability.longest) && v.readability.longest.length >= 2 && v.readability.longest.length <= 5
      && v.readability.longest.every((x, i, a) => x.words > 22 && (!i || a[i - 1].words >= x.words) && x.text.length <= 200), J(v.readability));
    check('no client-facing text carries an em dash, a curly quote or an ellipsis character', !/[—–“”‘’…]/.test(J({ p: parts, a: v.live_adjustments, n: v.delivery.next_step, b: v.grade.basis })), '');
    // the version we delivered, read back verbatim: kept, and still the same grade path
    const ours = await chain(liveBody({}), reader(BODY0.markdown));
    check('our own delivered text read back from the live page: kept_pct 90% or more', (ours.v.live_read || {}).kept_pct >= 90, J(ours.v.live_read));
    // a final version (no grade_only) carries none of the live fields and keeps the editor's next step
    const fin = await chain(finalBody(BODY0.markdown), null);
    check('a final version: no live_parts, no live_read, the basis of a final version', fin.v && !fin.v.live_parts && !fin.v.live_read && /measured on this final version/.test(fin.v.grade.basis), J({ lp: !!(fin.v || {}).live_parts, b: ((fin.v || {}).grade || {}).basis }));
  });

  // ---------- LG2 our own measuring never costs points on a live page; final versions unchanged ----------
  await guard('LG2 live page measuring', async () => {
    const SN = 'LG2 (client reports 2026-11-16, section 191) on a LIVE page a direct answer without the label, the template\'s questions section, a flattened table and the site name in the title cost nothing; a final version of the same text is graded as before; every run: "FAQ" inside a normal heading and image links';
    begin(SN); const check = mkCheck(SN);
    const st = (r) => (((r.v || {}).grade || {}).breakdown || {}).structure;
    const sc = (r, code) => ((((r.qa || {}).content_qa || {}).structure_checks || []).find(c => c.code === code) || {}).ok;
    const adj = (r) => (((r.qa || {}).content_qa || {}).live_adjustments || []).map(x => x.code);
    const warn = (r) => (((r.qa || {}).content_qa || {}).warnings || []);
    const A = await chain(liveBody({}), reader(REWRITE));
    const labelled = REWRITE.replace('**MS 365 ERP** is the combination', '**Quick answer:** MS 365 ERP is the combination').replace(/\n## Frequently asked questions[\s\S]*$/, '');
    const B = await chain(liveBody({}), reader(labelled));
    check('a live page that opens with a direct answer and ends with the template questions scores the structure of the same text with the label and without the questions', st(A) === st(B) && sc(A, 'direct_answer') === true && sc(A, 'faq_last') === true, J({ A: st(A), B: st(B), checks: A.qa.content_qa.structure_checks }));
    check('both relaxations are said (direct answer, questions section)', adj(A).includes('direct_answer') && adj(A).includes('faq_last'), J(adj(A)));
    check('no "Quick answer block missing" or "call to action should be the last section" advice on the live page', !warn(A).some(w => /Quick answer block missing|call to action should be the last/.test(w)), J(warn(A)));
    const finA = await chain(finalBody(REWRITE), null);
    check('the same text as a final version is graded as before: the label and the questions section still count against it (structure lower)', st(finA) < st(A) && sc(finA, 'direct_answer') === false && sc(finA, 'faq_last') === false && !adj(finA).length, J({ fin: st(finA), live: st(A), adj: adj(finA) }));
    // a CMS table the reader flattened into lines, and the site name after the title
    const ROWS = ['Criterion Weight What to ask for', 'Vendor partner status and current designation High The listing on the vendor own directory and every designation it holds today with dates',
      'References in your sector High Two or three references you can call of a similar size with what went live and when and who ran the project'];
    const FLAT = REWRITE.replace(/\| Criterion[\s\S]*?\| VAT returns[^\n]*\n/, ROWS.join('\n') + '\n\nThe weights are a guide.\n');
    const T0 = await chain(liveBody({ title: 'MS 365 ERP for UAE Businesses: Choosing Your ERP Partner | Nova&' }), reader(FLAT));
    const T1 = await chain(liveBody({ title: 'MS 365 ERP for UAE Businesses: Choosing Your ERP Partner | Nova&', tables: 1, table_rows: ROWS }), reader(FLAT));
    const longN = (r) => ((r.qa || {}).content_qa || {}).readability.long_sentences;
    check('without the page\'s table rows the flattened lines read as no table', sc(T0, 'table') === false, J(T0.qa.content_qa.structure_checks));
    check('with the publish check\'s table (tables 1, its rows): the rows are put back as a table, the table check passes and they are no long sentences any more',
      T1.v.live_read.table_rows_restored === 3 && T1.v.live_read.tables === 1 && sc(T1, 'table') === true && longN(T1) < longN(T0) && adj(T1).includes('table'), J({ lr: T1.v.live_read, long: [longN(T0), longN(T1)], adj: adj(T1) }));
    check('the site name after the title tag is not counted in its 60 characters on a live page', sc(T1, 'meta_title') === true && adj(T1).includes('title_site_name') && !warn(T1).some(w => /^Meta title is \d+ characters/.test(w)), J({ w: warn(T1).filter(w => /Meta title/.test(w)), adj: adj(T1) }));
    const finT = await chain({ ...finalBody(BODY0.markdown), meta: { ...META, title: 'MS 365 ERP for UAE Businesses: Choosing Your ERP Partner | Nova&' } }, null);
    check('a final version with the same title still fails the 60-character check (unchanged)', sc(finT, 'meta_title') === false, J(finT.qa.content_qa.structure_checks.find(c => c.code === 'meta_title')));
  });

  // ---------- LG2b every run: "FAQ" inside a normal heading; image links are no sources and are never unlinked ----------
  await guard('LG2b every run', async () => {
    const SN = 'LG2b (client reports 2026-11-16, section 191) every run (drafts and final versions too): a heading that contains the word FAQ is no second questions section, and an image is never a cited source nor unlinked as a repeat of one';
    begin(SN); const check = mkCheck(SN);
    const IMG = BODY0.markdown.replace(/\n## /, '\n## Comparing FAQ chatbots and workflow tools\n\nA short comparison of two kinds of tools for answering customers.\n\n![Hero](https://encrypted-tbn0.gstatic.com/images?q=tbn:abc)\n\n![Step one](images/step-one.webp)\n\n![Step two](images/step-two.webp)\n\n## Frequently asked questions\n\nHow long does it take?\nMost projects take four to nine months, depending on the data and the number of entities.\n\n## ');
    const I = await chain(finalBody(IMG), null);
    const cq = I.qa.content_qa;
    check('every run: a heading that only contains the word FAQ is no second questions section', !cq.warnings.some(w => /Duplicate FAQ/.test(w)), J(cq.warnings.filter(w => /FAQ/.test(w))));
    check('every run: no image is listed as a cited source, and both untitled images keep their links', !cq.sources_cited.some(s => /gstatic|images\//.test(s.url)) && /!\[Step two\]\(images\/step-two\.webp\)/.test(I.qa.output) && /!\[Step one\]\(images\/step-one\.webp\)/.test(I.qa.output),
      J({ src: cq.sources_cited.map(s => s.url), unlinked: cq.weak_sources_unlinked }));
  });

  // ---------- LG3 the publish check reads the article's images ----------
  await guard('LG3 publish check images', async () => {
    const SN = 'LG3 (client reports 2026-11-16, section 191) the publish check reads the images of the article only: related cards, an avatar in the article footer and alt="" thumbnails in links are not "content images without alt"; no image is one failed check; a Google Images thumbnail, a background hero and the images we delivered are named';
    begin(SN); const check = mkCheck(SN);
    const DOM = 'brightlane-demo.com'; const URL1 = 'https://' + DOM + '/insights/governed-ai-agents';
    const ROW = { site_id: 'site_brightlane-demo-com', domain: DOM, keyword: 'governed ai agents', source: 'cadence', page_type: 'Guide', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'cad_x_1', started_at: '2026-11-13T06:00:00.000Z', status: 'written', published_url: '', published_at: '', week: '2026-11-10' };
    const words = Array.from({ length: 720 }, (_, i) => ['governed', 'agents', 'approve', 'refunds', 'with', 'a', 'person', 'in', 'the', 'loop.'][i % 10]).join(' ');
    const html = (o) => '<!DOCTYPE html><html><head><title>Governed AI Agents: A Practical Guide | Brightlane</title><meta name="description" content="When an AI agent may act alone and when a person approves, with the controls a governed agent needs in production.">'
      + '<link rel="canonical" href="' + URL1 + '"><meta property="og:image" content="https://' + DOM + '/og-governed.webp"><script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"Governed AI agents","author":{"@type":"Person","name":"Lina Park"},"datePublished":"2026-11-13"}</script></head>'
      + '<body><nav><a href="/"><img src="/logo.svg" alt="Brightlane Logo" width="200" height="100"></a></nav><main>'
      + '<section class="hero"><div class="absolute inset-0 bg-cover" style="background-image:url(' + o.bg + ');opacity:0.5"></div></section>'
      + '<article><header><h1>Governed AI agents</h1><span class="byline">By Lina Park</span></header>' + (o.figure || '') + '<p>' + words + '</p>'
      + '<table><tr><th>Agent</th><th>Risk</th><th>Approval</th></tr><tr><td>Governed agent</td><td>Low</td><td>A person signs off on refunds over the limit</td></tr></table>'
      + (o.inLink || '') + '<footer class="mt-12"><div><img src="/session-photo.webp" alt="" class="h-16 w-16 shrink-0 rounded-full object-cover"><p>Book a session with our team</p></div></footer></article>'
      + '<section><h2>Related articles</h2>' + [1, 2, 3].map(i => '<a href="/insights/r' + i + '"><img src="/related-' + i + '.webp" alt="" loading="lazy" class="h-48 w-full object-cover"><span>Read more</span></a>').join('') + '</section>'
      + '</main><footer><img src="/logo_dark.svg" alt="Brightlane Logo" width="80" height="80"></footer></body></html>';
    const pc = async (h, extra) => {
      reset();
      await run('Normalize Input', { body: { mode: 'published', domain: DOM, content_request_id: 'cad_x_1', keyword: 'governed ai agents', url: URL1, callback_url: 'https://hooks.example.com/x', request_id: 'pub-191', ...(extra || {}) } });
      mock('Load Content Log (Published)', [{ json: ROW }]); mock('Load Ladders (Published)', [{ json: {} }]); mock('Load Query History (Published)', [{ json: {} }]);
      mock('Fetch Published Page', { statusCode: 200, statusMessage: 'OK', headers: { 'content-type': 'text/html; charset=utf-8' }, data: h });
      return (await run('Publish Check', [{ json: {} }]))[0].json;
    };
    const named = (c, n) => (c.checks || []).find(x => x.name === n) || null;
    const GSTATIC = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcDemo&amp;s=10';
    // governed-like: one real image (a Google Images thumbnail, no width/height), one alt="" thumbnail in a link inside the article
    const g = await pc(html({ bg: GSTATIC, figure: '<figure><img src="' + GSTATIC + '" alt="Governed AI agents with a person approving a refund" fetchPriority="high" class="w-full h-64 md:h-96 object-cover"></figure>',
      inLink: '<p><a href="/insights/agent-controls"><img src="/agent-controls-card.webp" alt=""></a></p>' }));
    check('the article is read: 1 content image, 1 decorative (an alt="" thumbnail in a link); the footer avatar and the related cards are not counted', g.images.count === 1 && g.images.decorative === 1 && g.images.read_from === 'article', J(g.images));
    check('"At least 2 content images" fails on the one real image (it passed on chrome before)', named(g, 'At least 2 content images') && named(g, 'At least 2 content images').ok === false, J(named(g, 'At least 2 content images')));
    check('"Every image has alt text" passes: decorative alt="" is right', named(g, 'Every image has alt text') && named(g, 'Every image has alt text').ok === true, J(named(g, 'Every image has alt text')));
    check('"Images carry width and height" fails for the one image', named(g, 'Images carry width and height') && named(g, 'Images carry width and height').ok === false && /^1 image/.test(named(g, 'Images carry width and height').detail), J(named(g, 'Images carry width and height')));
    check('the image loaded from Google Images fails "Images hosted on your website" with the source named', named(g, 'Images hosted on your website') && named(g, 'Images hosted on your website').ok === false && /Google Images/.test(named(g, 'Images hosted on your website').detail), J(named(g, 'Images hosted on your website')));
    check('page signals: the article\'s table and its rows, and the article word count', g.page_signals.tables === 1 && g.page_signals.table_rows.length === 2 && /^Agent Risk Approval$/.test(g.page_signals.table_rows[0]) && g.page_signals.article_words > 700
      && /words in the article \(\d+ words on the whole page, menus included\)/.test(named(g, 'Enough content on the page').detail), J({ ps: g.page_signals, enough: named(g, 'Enough content on the page') }));
    // agentic-like: no image in the article, a LinkedIn background hero, the 3 images we delivered not on the page
    const LICDN = 'https://media.licdn.com/dms/image/v2/demo/article-cover_image-shrink_720_1280/0/1?e=1&amp;v=beta';
    const a = await pc(html({ bg: LICDN }), { delivered_images: ['governed-ai-agents-hero.webp', 'images/agent-autonomy-matrix.webp', 'approval-flow.webp'] });
    const imgChecks = (a.checks || []).filter(c => /image/i.test(c.name) && !/Open Graph/.test(c.name));
    check('no content image is ONE failed check (not six)', imgChecks.length === 1 && imgChecks[0].name === 'Images in the article' && imgChecks[0].ok === false, J(imgChecks));
    check('it names the background hero (LinkedIn) and the 3 images we delivered that are not on the page', /background/.test(imgChecks[0].detail) && /LinkedIn/.test(imgChecks[0].detail) && /could not find any of the 3 images we made/.test(imgChecks[0].detail)
      && a.images.delivered.sent === 3 && a.images.delivered.on_page === 0 && a.images.background && a.images.background.source === 'LinkedIn', J({ d: imgChecks[0].detail, img: a.images }));
    check('the plain-text report has no em dash in what this check added', !/[—…]/.test(imgChecks[0].detail + J(a.images.advice)), imgChecks[0].detail);
    // our images on the page (by file name, wherever the CMS put them)
    const ok = await pc(html({ bg: LICDN, figure: ['governed-ai-agents-hero.webp', 'agent-autonomy-matrix.webp'].map(f => '<figure><img src="https://cdn.' + DOM + '/uploads/' + f + '" alt="Governed AI agents ' + f.split('.')[0] + '" width="1000" height="600"></figure>').join('') }),
      { delivered_images: ['governed-ai-agents-hero.webp', 'agent-autonomy-matrix.webp', 'approval-flow.webp'] });
    check('two of our three images on the page: counted by file name, no borrowed image, image checks pass', ok.images.delivered.on_page === 2 && ok.images.count === 2 && !named(ok, 'Images hosted on your website')
      && named(ok, 'At least 2 content images').ok === true && named(ok, 'Images carry width and height').ok === true, J({ img: ok.images, failed: ok.failed }));
  });

  // ---------- LG4 the independent review (2026-11-16): the live grade's readings ----------
  await guard('LG4 review live grade', async () => {
    const SN = 'LG4 (review of section 191) the live grade: no "Quick answer is 0 words" beside an accepted answer (M2), the live page\'s own meta description or none (M3), the FAQ-last rule of delivered grades unchanged (L1), a linked image is no source (L2), an answer must name the search (L4), live readings only after a real read (L5), kept_pct without meta lines and the label, and only when comparable (L6), one live next step (L7)';
    begin(SN); const check = mkCheck(SN);
    const cq = (r) => (r.qa || {}).content_qa || {};
    const sc = (r, code) => ((cq(r).structure_checks || []).find(c => c.code === code) || {}).ok;
    const adj = (r) => (cq(r).live_adjustments || []).map(x => x.code);
    // M2
    const A = await chain(liveBody({ meta_description: META.meta_description }), reader(REWRITE));
    check('M2: an accepted direct answer is never "Quick answer is 0 words", and its words are the answer block', !cq(A).warnings.some(w => /Quick answer is \d+ words/.test(w)) && cq(A).answer_block_words >= 40, J({ w: cq(A).warnings.filter(w => /Quick answer/.test(w)), n: cq(A).answer_block_words }));
    // M3
    check('M3: the live page\'s own description read by the check (a good one) passes, with no "not read" line', sc(A, 'meta_description') === true && !adj(A).includes('meta_description'), J(cq(A).structure_checks));
    const noDesc = await chain(liveBody({ meta_description: '' }), reader(REWRITE));
    check('M3: a live page with no description of its own fails the check with the live page named (our delivered one is never graded)', sc(noDesc, 'meta_description') === false
      && cq(noDesc).warnings.includes('The meta description of your live page is missing') && /live page/.test(((cq(noDesc).structure_checks || []).find(c => c.code === 'meta_description') || {}).text), J(cq(noDesc).structure_checks.find(c => c.code === 'meta_description')));
    const badOurs = await chain({ ...liveBody({}), meta: { ...META, meta_description: 'Too short.' } }, reader(REWRITE));
    check('M3: when the check did not read the live description, ours is not graded (even a bad one) and the grade says so', sc(badOurs, 'meta_description') === true && adj(badOurs).includes('meta_description') && !cq(badOurs).warnings.some(w => /Meta description/.test(w)), J({ adj: adj(badOurs), w: cq(badOurs).warnings.filter(w => /escription/.test(w)) }));
    // L1
    const topicFaq = REWRITE.replace('## Frequently asked questions', '## MS 365 ERP FAQs');
    const finF = await chain(finalBody(topicFaq), null);
    check('L1: a final version ending on "## <topic> FAQs" still fails "FAQ last" (the delivered grade does not move)', sc(finF, 'faq_last') === false, J(cq(finF).structure_checks));
    const liveF = await chain(liveBody({ meta_description: META.meta_description }), reader(REWRITE.replace('## Frequently asked questions', '## 7. Frequently asked questions')));
    check('L1: on a live page a numbered "7. Frequently asked questions" section at the end is set aside too', sc(liveF, 'faq_last') === true && adj(liveF).includes('faq_last'), J(adj(liveF)));
    // L2
    const GR = new Function(require('fs').readFileSync(require('path').join(__dirname, '..', 'v5', 'code', '_grade.js'), 'utf8') + '\nreturn GR;')();
    const tier = () => 'vendor';
    const linked = GR.sources('Our team is a certified partner of the platform. [![Partner badge](https://cdn.example.org/badge.png)](https://partner.vendor.example/directory)\n', { domain: 'novaand.example' }, { tier });
    const real = GR.sources('Our team is a certified partner of the platform, see [the vendor directory](https://partner.vendor.example/directory).\n', { domain: 'novaand.example' }, { tier });
    check('L2: a linked image (a badge, a card) is no citation; a link with words is', linked.units === 0 && real.units === 1, J({ linked: linked.units, real: real.units }));
    // L4
    const vague = REWRITE.replace(/\*\*MS 365 ERP\*\* is the combination[^\n]*/, 'In 2026 many businesses across the Emirates are rethinking how they run finance, stock and reporting, and a growing number of teams are comparing platforms, partners and timelines before they commit budget to a project that will shape how they work for years to come in the region.');
    const V = await chain(liveBody({ meta_description: META.meta_description }), reader(vague));
    check('L4: a first paragraph that does not name the search is no direct answer (an "are" is not enough)', sc(V, 'direct_answer') === false && !adj(V).includes('direct_answer'), J(adj(V)));
    // L5
    const noLive = { ...clone(BODY0), meta: clone(META), markdown: REWRITE, grade_only: true, answers: [], page_run: clone(gating) };
    const L5 = await chain(noLive, null);
    check('L5: a grade_only request with no live read is never graded with the live readings', L5.qa && cq(L5).live === false && !adj(L5).length && sc(L5, 'direct_answer') === false, J({ live: cq(L5).live, adj: adj(L5) }));
    // L6
    const ours = 'Meta Title: MS 365 ERP for UAE Businesses and the partners who implement it well\n\n' + REWRITE.replace('**MS 365 ERP** is the combination', '**Quick answer:** MS 365 ERP is the combination');
    const theirs = REWRITE.replace('**MS 365 ERP** is the combination', 'MS 365 ERP is the combination');
    const K = await chain({ ...liveBody({ meta_description: META.meta_description }), delivered_markdown: ours }, reader(theirs));
    check('L6: our "Meta Title:" line is no sentence, and the sentence after our "Quick answer:" label counts once the label is gone (100% kept)', K.v.live_read.kept_pct === 100, J(K.v.live_read));
    const short = '# MS 365 ERP\n\n' + para(70, 1) + '\n\n## Contact\n\n' + para(30, 2);
    const S2 = await chain(liveBody({ meta_description: META.meta_description }), reader(short));
    check('L6: a read too short to compare gives no share, with the reason', S2.v && S2.v.live_read.kept_pct === null && /too little text/.test(S2.v.live_read.kept_note || ''), J(S2.v && S2.v.live_read));
    // L7
    const legacy = liveBody({ meta_description: META.meta_description }); delete legacy.page_run;
    const L7 = await chain(legacy, reader(REWRITE));
    check('L7: a live grade\'s next step is on the website, never "make the final version again"', L7.v && /on your website/.test(L7.v.delivery.next_step) && !/final version|content list|in the editor/.test(L7.v.delivery.next_step), J(L7.v && { st: L7.v.delivery.status, n: L7.v.delivery.next_step }));
  });

  // ---------- LG5 the independent review (2026-11-16): the publish check's article and images ----------
  await guard('LG5 review publish check', async () => {
    const SN = 'LG5 (review of section 191) the publish check: the article of a page whose content is in <main> with card <article>s (M1), a hero above the article, a content image linked to its own file (L3), our images under a CMS file name (L8), a Blogger site\'s own images (L9)';
    begin(SN); const check = mkCheck(SN);
    const DOM = 'brightlane-demo.com'; const URL1 = 'https://' + DOM + '/services/ai-consulting';
    const ROW = { site_id: 'site_brightlane-demo-com', domain: DOM, keyword: 'ai consulting', source: 'manual', page_type: 'Service Page', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'r-5', started_at: '2026-11-13T06:00:00.000Z', status: 'written', published_url: '', published_at: '', week: '' };
    const words = (n) => Array.from({ length: n }, (_, i) => ['ai', 'consulting', 'helps', 'teams', 'plan', 'data', 'and', 'models', 'that', 'work.'][i % 10]).join(' ');
    const shell = (inner, head) => '<!DOCTYPE html><html><head><title>AI Consulting Services | Brightlane</title>' + (head || '') + '<meta name="description" content="AI consulting for companies that want working models, clean data and a plan their teams can run, from a first workshop to production.">'
      + '<link rel="canonical" href="' + URL1 + '"><script type="application/ld+json">{"@type":"Service"}</script><meta property="og:image" content="https://' + DOM + '/og.webp"></head><body><nav><a href="/"><img src="/logo.png" alt="Brightlane logo" width="120" height="40"></a></nav>' + inner + '<footer>Footer</footer></body></html>';
    const pc = async (h, extra) => {
      reset();
      await run('Normalize Input', { body: { mode: 'published', domain: DOM, content_request_id: 'r-5', keyword: 'ai consulting', url: URL1, callback_url: 'https://hooks.example.com/x', request_id: 'pub-195', ...(extra || {}) } });
      mock('Load Content Log (Published)', [{ json: ROW }]); mock('Load Ladders (Published)', [{ json: {} }]); mock('Load Query History (Published)', [{ json: {} }]);
      mock('Fetch Published Page', { statusCode: 200, statusMessage: 'OK', headers: { 'content-type': 'text/html; charset=utf-8' }, data: h });
      return (await run('Publish Check', [{ json: {} }]))[0].json;
    };
    const named = (c, n) => (c.checks || []).find(x => x.name === n) || null;
    const cards = '<h2>Latest insights</h2>' + [1, 2, 3].map(i => '<article class="card"><a href="/insights/i' + i + '"><img src="/blog-' + i + '.webp" alt="Blog ' + i + '"><h3>Insight ' + i + '</h3></a></article>').join('');
    // M1: content in <main>, cards built as <article>
    const m1 = await pc(shell('<main><h1>AI consulting</h1><img src="/ai-consulting-hero.webp" alt="AI consulting workshop" width="1200" height="675"><p>' + words(400) + '</p><img src="/ai-consulting-flow.webp" alt="AI consulting delivery flow" width="1000" height="600"><table><tr><th>Stage</th><th>Weeks</th><th>Output</th></tr><tr><td>Discovery</td><td>2</td><td>A plan</td></tr></table>' + cards + '</main>'));
    check('M1: a <main> page with card <article>s is read from its <main>: the 2 real images, its table and its words, never a card', m1.images.read_from === 'main' && m1.images.count === 2 && m1.page_signals.tables === 1 && m1.page_signals.article_words >= 400 && named(m1, 'At least 2 content images').ok === true,
      J({ from: m1.images.read_from, n: m1.images.count, t: m1.page_signals.tables, w: m1.page_signals.article_words }));
    // a hero <img> between the H1 and the article, cards after it
    const hero = await pc(shell('<main><header><h1>AI consulting</h1><img src="/ai-consulting-hero.webp" alt="AI consulting workshop" width="1200" height="675"></header><article><p>' + words(300) + '</p><img src="/ai-consulting-flow.webp" alt="AI consulting flow" width="1000" height="600"></article>' + cards + '</main>'));
    check('M1: a hero image between the H1 and the article is counted with the article; the cards are not', hero.images.read_from === 'article' && hero.images.count === 2, J(hero.images));
    // L3
    const l3 = await pc(shell('<article><h1>AI consulting</h1><p>' + words(300) + '</p><a href="/uploads/ai-consulting-chart.png"><img src="/uploads/ai-consulting-chart.png" alt=""></a><img src="/ai-consulting-flow.webp" alt="AI consulting flow" width="1000" height="600"></article>'));
    check('L3: an empty-alt image linked to its own file is a content image without alt text, not decorative', l3.images.count === 2 && l3.images.decorative === 0 && named(l3, 'Every image has alt text').ok === false, J(l3.images));
    // L8
    const l8 = await pc(shell('<article><h1>AI consulting</h1><p>' + words(300) + '</p><img src="/wp-content/uploads/2026/11/ai-consulting-hero-1024x576.webp" alt="AI consulting" width="1024" height="576"><img src="/media/ai-consulting-flow-3f9a2c7d1e.webp" alt="AI consulting flow" width="1000" height="600"><img src="/media/ai-consulting-matrix-v2.webp" alt="AI consulting matrix" width="1000" height="600"></article>'),
      { delivered_images: ['ai-consulting-hero.webp', 'ai-consulting-flow.webp', 'ai-consulting-matrix.webp'] });
    check('L8: our images under a CMS file name are found (size and hash suffixes), a close name is "probably ours", nothing is called missing', l8.images.delivered.on_page === 2 && l8.images.delivered.probably === 1 && l8.images.delivered.missing.length === 0, J(l8.images.delivered));
    // L9
    const blog = await pc(shell('<article><h1>AI consulting</h1><p>' + words(300) + '</p>' + [1, 2].map(i => '<img src="https://blogger.googleusercontent.com/img/b/R29v/ai-consulting-' + i + '.webp" alt="AI consulting ' + i + '" width="800" height="450">').join('') + '</article>', '<meta name="generator" content="Blogger">'));
    check('L9: a Blogger site\'s own images (googleusercontent) are not "loaded from another website"', blog.images.count === 2 && !named(blog, 'Images hosted on your website'), J({ img: blog.images.borrowed, failed: blog.failed }));
    const thumb = await pc(shell('<article><h1>AI consulting</h1><p>' + words(300) + '</p><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:x" alt="AI consulting" width="800" height="450"></article>', '<meta name="generator" content="Blogger">'));
    check('L9: a Google Images thumbnail is always borrowed', named(thumb, 'Images hosted on your website') && /Google Images/.test(named(thumb, 'Images hosted on your website').detail), J(thumb.failed));
  });
};
