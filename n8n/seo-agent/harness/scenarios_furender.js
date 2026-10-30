// FUR1-FUR5 (FU-R1, page-quality programme 2026-10-29, docs/page-quality-2026-10-29/BASELINE.md "Recurring defects": "Own site not read when it
// is client-rendered (0 own pages read)", BEFORE run K7 / K8). The client's own site was a React app: the text reader answered an empty page,
// the plain GET a script shell, so the page run read 0 of the site's own pages and wrote without its services, proof or internal links.
//   FUR1  the kit (v5/code/_client_render.js CRK): when a page needs the renderer, the rendered page in the reader's line format, the site's
//         own links on the rendered homepage, the next pages to read
//   FUR2  a client-rendered site through the real nodes: Client Page Requests -> Client Render Plan -> Client Render More -> Collect Client
//         Pages reads the homepage, the platform hub and the page closest to the search, each labelled, with the menu as link candidates;
//         the same inputs on the frozen pre-change node read 0 pages (the defect, reproduced)
//   FUR3  bounded and honest: at most 3 renders, a bot check / failed render is "not read" with its reason, nothing invented
//   FUR4  a server-rendered site is unchanged: the plan sends one skip item and Collect Client Pages answers exactly what the pre-change node
//         answered (frozen copy harness/legacy/Collect_Client_Pages_before_FUR1.js), existing page and its measured facts included
//   FUR5  the wiring this build wrote (the render chain between Read Client Page HTML and Collect Client Pages, the browser render)
// Fixtures are anonymised (lumenpath-demo.com, harbourline-demo.com); every check runs the GENERATED code in the harness sandbox.
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const kit = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' is not inlined in ' + file); return src.slice(a, b + 6); };
  const loadKits = () => new Function(kit('Client_Render_Plan.js', 'LK') + '\n' + kit('Client_Render_Plan.js', 'CRK') + '\nreturn { LK, CRK };')();
  const clean = () => { for (const k of ['Client Render Plan', 'Render Client Pages', 'Client Render More', 'Render More Client Pages']) delete store[k]; };

  // ---------- anonymised fixtures: a client-rendered product site (Vite / React shell) ----------
  const D = 'lumenpath-demo.com'; const W = 'https://' + D;
  const KW = 'ai search visibility tracking';
  const SHELL = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Lumenpath</title>\n'
    + '    <meta name="description" content="One platform for search and AI answers." />\n    <link rel="icon" href="/favicon.ico" />\n    <script src="/theme-init.js"></script>\n'
    + '    <script type="module" crossorigin src="/assets/index-4f2a9c.js"></script>\n    <link rel="stylesheet" crossorigin href="/assets/index-77b1d0.css">\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n';
  const READER_EMPTY = 'Title: Lumenpath\n\nURL Source: ' + W + '/\n\nMarkdown Content:\n\n';
  const NAV = '<header class="site-header"><nav><a href="/">Lumenpath</a><a href="/platform">Platform</a><a href="/platform/ai-visibility">AI visibility</a>'
    + '<a href="/platform/keyword-research">Keyword research</a><a href="/pricing">Pricing</a><a href="/about">About</a><a href="/login">Log in</a>'
    + '<a href="https://app.' + D + '/signup">Start free</a></nav></header>';
  const FOOT = '<footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="https://social.example.org/lumenpath">Follow us</a><a href="mailto:hello@' + D + '">hello@' + D + '</a><p>Footer note about cookies and our newsletter.</p></footer>';
  const page = (title, main) => '<!doctype html><html lang="en"><head><title>' + title + '</title><script type="module" src="/assets/index-4f2a9c.js"></script></head><body><div id="root">' + NAV
    + '<main>' + main + '</main>' + FOOT + '</div><div class="cookie-banner">We use cookies. Accept all.</div></body></html>';
  const HOME_R = page('Lumenpath', '<h1>Rank in search. Get named in AI answers.</h1><p>Lumenpath runs search as one weekly loop: keyword research, pages written for the keywords you choose, technical audits, AI search visibility tracking and backlinks.</p>'
    + '<h2>What it does</h2><ul><li>Keyword research with a verdict for every search</li><li>Pages checked for facts before you publish</li><li>AI visibility: the questions buyers ask ChatGPT, Gemini and Perplexity, tracked every week</li><li>Technical audits with a fix pack</li></ul>'
    + '<h2>Proof</h2><p>Trusted by 120 customers in 9 countries. Setting up is free.</p><p><a href="/platform/ai-visibility">See how AI visibility works</a> or <a href="#pricing">compare plans</a>.</p>');
  const PLATFORM_R = page('Platform | Lumenpath', '<h1>The platform</h1><p>Eleven capabilities that work as one loop. Research tells the writer what to write, the audit tells the writer what to fix, and tracking tells you what moved.</p>'
    + '<h2>Capabilities</h2><ul><li>Keyword research and verdicts</li><li>Keyword ladders</li><li>Content with fact checks</li><li>Technical audits</li><li>Search Console and GA4 tracking</li><li>AI search visibility</li><li>Backlinks and link building</li></ul><p>Every analysis shows its cost before it runs.</p>');
  const AIV_R = page('AI visibility | Lumenpath', '<h1>AI search visibility</h1><p>See whether ChatGPT, Gemini, Perplexity and Google AI Mode name your brand when buyers ask about your category. A panel of up to 500 questions runs every week, with a daily pulse on the questions that matter most.</p>'
    + '<h2>What you see</h2><ul><li>Mention rate and citation rate with their ranges</li><li>Share of voice against your competitors</li><li>The pages AI cites when it does not name you</li></ul><p>Alerts fire only on real changes, not on noise.</p>');
  const rendered = (html, extra) => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, body: html, ...(extra || {}) });
  const CTX = { mode: 'keyword', keyword: KW, domain: D, existing_page: null, existing_page_url: '', internal_link_candidates: [{ url: W + '/', path: '/' }], site_urls: [], site_urls_count: 0 };

  await guard('FUR1 the render kit', async () => {
    reset(); clean(); const SN = 'FUR1 (FU-R1 2026-10-29) the render kit: a page is rendered only when the reader got nothing AND its HTML is a script shell; the rendered page, its links, the next pages'; begin(SN); const check = mkCheck(SN);
    const { CRK } = loadKits();
    const shell = CRK.need({ page_text: READER_EMPTY }, { page_html: SHELL }, W + '/', D);
    check('an empty reading of a script shell on the run\'s own host is rendered, with the reason in words', shell.render === true && /JavaScript/.test(shell.why), J(shell));
    const read = CRK.need({ page_text: 'Title: x\n\nMarkdown Content:\n' + 'Harbourline ships freight across the Gulf every week. '.repeat(8) }, { page_html: SHELL }, W + '/', D);
    check('a page the reader read (200 characters or more) is never rendered, whatever its HTML', read.render === false && /reader/.test(read.why), J(read));
    const ssr = CRK.need({ page_text: READER_EMPTY }, { page_html: '<html><head><title>x</title></head><body><main><h1>Freight</h1><p>' + 'Harbourline moves freight across the Gulf with its own fleet and customs team. '.repeat(12) + '</p></main></body></html>' }, W + '/', D);
    check('an empty reading of a page whose HTML carries its text is not rendered (the server already sent the text)', ssr.render === false, J(ssr));
    check('another host is never rendered', CRK.need({ page_text: '' }, { page_html: SHELL }, 'https://other-demo.org/', D).render === false);
    check('www and the bare host are the same site', CRK.need({ page_text: '' }, { page_html: SHELL }, 'https://www.' + D + '/', D).render === true);
    const bot = CRK.need({ page_text: '' }, { page_html: '<html><head><title>Just a moment...</title></head><body><div id="root"></div><script src="/cdn-cgi/challenge-platform/x.js"></script></body></html>' }, W + '/', D);
    check('a bot check is not a script shell: not rendered, said so', bot.render === false && /bot check/.test(bot.why), J(bot));
    check('a failed plain fetch is not rendered blind', CRK.need({ page_text: '' }, { error: { message: 'timeout' } }, W + '/', D).render === false);
    const r = CRK.rendered(rendered(HOME_R));
    check('the rendered homepage is usable and keeps its headings as "#" lines', r.ok && /^# Rank in search/m.test(r.raw) && /^## What it does/m.test(r.raw), r.why || r.raw.slice(0, 300));
    check('the menu, the footer and the cookie banner are left out of its text (as the reader removes them)', r.ok && !/Log in|Privacy|Follow us|Accept all/.test(r.raw), r.raw);
    check('list items and the proof line are kept', r.ok && /^- AI visibility: the questions buyers ask/m.test(r.raw) && /Trusted by 120 customers/.test(r.raw), r.raw);
    const links = CRK.links(HOME_R, W + '/', D);
    console.log('   links ->', J(links.map(l => l.path + ' [' + l.title + ']')));
    check('the homepage\'s own links: absolute on its host, with their link text', links.some(l => l.url === W + '/platform/ai-visibility' && l.title === 'AI visibility') && links.every(l => l.url.startsWith(W + '/')), J(links));
    check('no sign-in, legal, other-host, app-subdomain, mail or anchor link', !links.some(l => /login|privacy|terms|signup|social|mailto|#/.test(l.url)), J(links.map(l => l.url)));
    check('each page once (the menu and the body both link the AI visibility page)', links.filter(l => l.path === '/platform/ai-visibility').length === 1, J(links));
    const more = CRK.pickMore(links, KW, [W + '/'], 2);
    check('next: the platform hub (services) and the page closest to the search (related, half its words or more)', more.length === 2 && more[0].kind === 'services' && more[0].url === W + '/platform' && more[1].kind === 'related' && more[1].url === W + '/platform/ai-visibility' && more[1].topic_match >= 0.5, J(more));
    check('no page close enough: only the hub', J(CRK.pickMore(links, 'freight forwarding dubai', [W + '/'], 2).map(m => m.kind)) === J(['services']));
    check('the room left is respected', CRK.pickMore(links, KW, [W + '/'], 1).length === 1 && CRK.pickMore(links, KW, [W + '/'], 0).length === 0);
    const still = CRK.rendered(rendered('<html><body><div id="root"><p>Loading</p></div></body></html>'));
    check('a render that is still empty is "not read", with the reason', !still.ok && /almost no text/.test(still.why), J(still));
    check('a render behind a bot check is "not read"', !CRK.rendered(rendered('<html><head><title>Just a moment...</title></head><body>cf_chl_</body></html>', { statusCode: 403 })).ok);
    check('a render that failed is "not read"', /render failed/.test(CRK.rendered({ error: { message: 'ETIMEDOUT' } }).why));
  });

  await guard('FUR2 a client-rendered site is read', async () => {
    reset(); clean(); const SN = 'FUR2 (FU-R1 2026-10-29, BEFORE K7 / K8) a client-rendered site through the real nodes: the homepage, the platform hub and the page closest to the search are read after their scripts ran'; begin(SN); const check = mkCheck(SN);
    mock('Collect Site URLs', [{ json: CTX }]);
    const reqs = (await run('Client Page Requests', [{ json: CTX }])).map(r => r.json);
    check('the page run asks for the homepage only (no sitemap, no inventory: the site\'s pages are unknown)', reqs.length === 1 && reqs[0].kind === 'home', J(reqs));
    mock('Read Client Pages', reqs.map(() => ({ json: { page_text: READER_EMPTY } })));
    mock('Read Client Page HTML', reqs.map(() => ({ json: { page_html: SHELL } })));
    // the defect, reproduced on the frozen pre-change node: 0 pages
    const before = (await run('Collect Client Pages', store['Read Client Page HTML'], { code: 'legacy:Collect_Client_Pages_before_FUR1' }))[0].json;
    check('before: the pre-change node reads 0 of the site\'s own pages (K7 / K8)', before.client_pages_read === 0, J(before.client_pages_read));
    const plan = (await run('Client Render Plan', store['Read Client Page HTML'])).map(r => r.json);
    check('the plan renders the homepage (stage 1), with why', plan.length === 1 && plan[0].kind === 'home' && plan[0].index === 0 && plan[0].stage === 1 && /script shell/.test(plan[0].why), J(plan));
    mock('Render Client Pages', [rendered(HOME_R)]);
    const more = (await run('Client Render More', store['Render Client Pages'])).map(r => r.json);
    check('then the platform hub and the AI visibility page, found on the rendered homepage (2 more, 3 in all)', more.length === 2 && more[0].url === W + '/platform' && more[1].url === W + '/platform/ai-visibility', J(more));
    mock('Render More Client Pages', [rendered(PLATFORM_R), rendered(AIV_R)]);
    const out = (await run('Collect Client Pages', store['Render More Client Pages']))[0].json;
    const cp = out.client_pages || [];
    console.log('   client pages ->', J(cp.map(p => [p.kind, p.url, p.words, p.read_via])));
    check('3 of the site\'s own pages read: home, services, related', out.client_pages_read === 3 && J(cp.map(p => p.kind)) === J(['home', 'services', 'related']), J(cp.map(p => p.kind)));
    check('each one labelled read_via: rendered', cp.every(p => p.read_via === 'rendered'), J(cp.map(p => p.read_via)));
    check('services come from the real site (the platform page\'s capability list)', /Keyword ladders/.test((cp.find(p => p.kind === 'services') || {}).text || '') && /panel of up to 500 questions/.test((cp.find(p => p.kind === 'related') || {}).text || ''), J(cp.map(p => p.text.slice(0, 120))));
    check('proof comes from the real site (the client signals read "120 customers")', (out.client_signals.numbers || []).some(n => /120 customers/.test(n)), J(out.client_signals));
    check('the menu and the footer are not in the page text', !cp.some(p => /Log in|Follow us|Accept all/.test(p.text)), J(cp.map(p => p.text)));
    const lc = out.internal_link_candidates || [];
    check('internal links come from the real site: the homepage\'s menu becomes link candidates, labelled, the homepage kept first', lc[0] && lc[0].url === W + '/' && lc.some(c => c.url === W + '/platform/ai-visibility' && c.title === 'AI visibility' && c.source === 'rendered homepage') && lc.some(c => c.path === '/pricing'), J(lc));
    check('no sign-in or legal page among them', !lc.some(c => /login|privacy|terms|signup/.test(c.url)), J(lc.map(c => c.url)));
    const cr = out.client_render || {};
    check('the run\'s evidence says what was rendered and why (client_render: 3 of 3 tried, cap 3)', cr.rendered === 3 && cr.tried === 3 && cr.cap === 3 && cr.pages.every(p => p.why) && /scripts ran/.test(cr.method || ''), J(cr));
    check('no existing page is invented (the matched-by-words page is read as related, not as the page to rewrite)', !out.existing_page && out.existing_page_text === '' && out.existing_page_digest === null, J({ ep: out.existing_page, d: out.existing_page_digest }));
    check('no character the client reads breaks the wording rule', !/[—–…“”]/.test(J(cr)));
    clean();
  });

  await guard('FUR3 bounded and honest', async () => {
    reset(); clean(); const SN = 'FUR3 (FU-R1 2026-10-29) at most 3 renders a run; a failed or blocked render is "not read" with its reason, never filled in'; begin(SN); const check = mkCheck(SN);
    // four pages of the run, all script shells: the plan renders 3, and nothing is left for the homepage's links
    const reqs = [{ kind: 'existing', url: W + '/guides/ai-visibility' }, { kind: 'home', url: W + '/' }, { kind: 'related', url: W + '/platform' }, { kind: 'services', url: W + '/solutions' }];
    mock('Collect Site URLs', [{ json: CTX }]); mock('Client Page Requests', reqs.map(r => ({ json: r })));
    mock('Read Client Pages', reqs.map(() => ({ json: { page_text: READER_EMPTY } }))); mock('Read Client Page HTML', reqs.map(() => ({ json: { page_html: SHELL } })));
    const plan = (await run('Client Render Plan', store['Read Client Page HTML'])).map(r => r.json);
    check('four shells, three renders (CRK.CONFIG.max_pages)', plan.length === 3 && J(plan.map(p => p.index)) === J([0, 1, 2]), J(plan));
    const GUIDE_R = page('AI search visibility guide | Lumenpath', '<h1>AI search visibility</h1><p>' + 'A practical guide to measuring whether AI answers name your brand: build a question panel, run it weekly, read mention and citation rates with their ranges, and act on the pages AI cites. '.repeat(4) + '</p>'
      + '<h2>The metrics</h2><table><tr><th>Metric</th><th>What it counts</th></tr><tr><td>Mention rate</td><td>Answers that name you</td></tr><tr><td>Citation rate</td><td>Answers that link to you</td></tr></table>');
    mock('Render Client Pages', [rendered(GUIDE_R), rendered(HOME_R), rendered(PLATFORM_R)]);
    const more = (await run('Client Render More', store['Render Client Pages'])).map(r => r.json);
    check('no render left for the homepage\'s links: one skip item, with the reason', more.length === 1 && more[0].skip && /no renders left/.test(more[0].more_plan.why), J(more));
    const out = (await run('Collect Client Pages', [{ json: more[0] }]))[0].json;
    check('the existing page read rendered measures its facts on the rendered HTML (structure checked, its headings)', out.existing_page_digest && out.existing_page_digest.structure_reliable === true && out.existing_page_digest.headings.includes('AI search visibility'), J(out.existing_page_digest && { r: out.existing_page_digest.structure_reliable, h: out.existing_page_digest.headings }));
    check('3 pages read, the 4th not', out.client_pages_read === 3 && !(out.client_pages || []).some(p => p.url === W + '/solutions'), J((out.client_pages || []).map(p => p.url)));
    clean();
    // the homepage's render is blocked: nothing read, nothing invented, the reason recorded
    reset(); mock('Collect Site URLs', [{ json: CTX }]); mock('Client Page Requests', [{ json: { kind: 'home', url: W + '/' } }]);
    mock('Read Client Pages', [{ json: { page_text: READER_EMPTY } }]); mock('Read Client Page HTML', [{ json: { page_html: SHELL } }]);
    await run('Client Render Plan', store['Read Client Page HTML']);
    mock('Render Client Pages', [{ statusCode: 403, headers: {}, body: '<html><head><title>Just a moment...</title></head><body>cf_chl_opt</body></html>' }]);
    const m2 = (await run('Client Render More', store['Render Client Pages'])).map(r => r.json);
    check('a blocked homepage render: no second stage, said so', m2.length === 1 && m2[0].skip && /not rendered/.test(m2[0].more_plan.why), J(m2));
    const o2 = (await run('Collect Client Pages', [{ json: m2[0] }]))[0].json;
    check('nothing read, no link candidates added, the reason in client_render', o2.client_pages_read === 0 && J(o2.internal_link_candidates) === J(CTX.internal_link_candidates) && o2.client_render.rendered === 0 && /bot check/.test(o2.client_render.pages[0].why), J({ n: o2.client_pages_read, cr: o2.client_render }));
    clean();
    // the render answered nothing at all (alwaysOutputData gives an empty item)
    reset(); mock('Collect Site URLs', [{ json: CTX }]); mock('Client Page Requests', [{ json: { kind: 'home', url: W + '/' } }]);
    mock('Read Client Pages', [{ json: { page_text: READER_EMPTY } }]); mock('Read Client Page HTML', [{ json: { page_html: SHELL } }]);
    await run('Client Render Plan', store['Read Client Page HTML']); mock('Render Client Pages', [{}]);
    const m3 = (await run('Client Render More', store['Render Client Pages'])).map(r => r.json);
    const o3 = (await run('Collect Client Pages', [{ json: m3[0] }]))[0].json;
    check('an empty render answer: nothing read, "the render returned nothing"', o3.client_pages_read === 0 && /returned nothing/.test(o3.client_render.pages[0].why), J(o3.client_render));
    clean();
  });

  await guard('FUR4 a server-rendered site is unchanged', async () => {
    reset(); clean(); const SN = 'FUR4 (FU-R1 2026-10-29) a server-rendered site: no render, and Collect Client Pages answers exactly what the pre-change node answered'; begin(SN); const check = mkCheck(SN);
    const SD = 'harbourline-demo.com'; const SW = 'https://www.' + SD;
    const SCTX = { mode: 'keyword', keyword: 'freight forwarding dubai', domain: SD, existing_page: { url: SW + '/freight-forwarding-dubai', title: 'Freight forwarding in Dubai' }, existing_page_url: SW + '/freight-forwarding-dubai',
      internal_link_candidates: [{ url: SW + '/', path: '/' }, { url: SW + '/services/customs-clearance', path: '/services/customs-clearance' }], site_urls: [SW + '/', SW + '/freight-forwarding-dubai', SW + '/services/customs-clearance', SW + '/services'], site_urls_count: 4 };
    const reqs = [{ kind: 'existing', url: SW + '/freight-forwarding-dubai' }, { kind: 'home', url: SW + '/' }, { kind: 'related', url: SW + '/services/customs-clearance' }, { kind: 'services', url: SW + '/services' }];
    const body = (h1, para, extra) => '<!doctype html><html lang="en"><head><title>' + h1 + ' | Harbourline</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Mira Haddad"},"datePublished":"2026-03-04"}</script></head><body>'
      + '<header><nav><a href="/">Home</a><a href="/services">Services</a></nav></header><main><h1>' + h1 + '</h1><p>' + para.repeat(10) + '</p>' + (extra || '') + '<p><a href="/contact">Get a quote</a></p></main><footer>Harbourline LLC, Dubai</footer></body></html>';
    const TABLE = '<table><tr><th>Route</th><th>Days</th></tr><tr><td>Jebel Ali to Riyadh</td><td>3</td></tr><tr><td>Jebel Ali to Muscat</td><td>2</td></tr></table>';
    const HTML = [body('Freight forwarding in Dubai', 'Harbourline has moved sea and road freight out of Jebel Ali since 2009, with 40 trucks and its own customs brokers. ', TABLE),
      body('Harbourline', 'Freight forwarding, customs clearance and warehousing across the GCC for 300 clients. '),
      body('Customs clearance', 'Our licensed brokers clear import and export shipments at Jebel Ali and Dubai airport, usually within one working day. '),
      body('Services', 'Sea freight, road freight to Saudi Arabia and Oman, customs clearance and bonded warehousing. ')];
    const md = (h, s) => 'Title: ' + h + '\n\nURL Source: x\n\nMarkdown Content:\n# ' + h + '\n\n' + s.repeat(6) + '\n\n| Route | Days |\n|---|---|\n| Jebel Ali to Riyadh | 3 |\n\nPublished 4 March 2026';
    const READER = [md('Freight forwarding in Dubai', 'Harbourline has moved sea and road freight out of Jebel Ali since 2009, with 40 trucks and its own customs brokers. '),
      md('Harbourline', 'Freight forwarding, customs clearance and warehousing across the GCC for 300 clients. Call +971 4 555 0100. '),
      { error: { message: 'Request failed with status code 524' } },
      md('Services', 'Sea freight, road freight to Saudi Arabia and Oman, customs clearance and bonded warehousing. ')];
    mock('Collect Site URLs', [{ json: SCTX }]); mock('Client Page Requests', reqs.map(r => ({ json: r })));
    mock('Read Client Pages', READER.map(x => ({ json: typeof x === 'string' ? { page_text: x } : x })));
    mock('Read Client Page HTML', HTML.map(h => ({ json: { page_html: h } })));
    const plan = (await run('Client Render Plan', store['Read Client Page HTML'])).map(r => r.json);
    check('nothing to render: one skip item (the "nothing to render" branch), and why per page', plan.length === 1 && plan[0].skip === true && plan[0].render_plan.needed === 0 && plan[0].render_plan.pages.length === 4, J(plan));
    check('the page the reader failed on is not rendered either: its HTML carries its text', /text in its HTML/.test(plan[0].render_plan.pages[2].why), J(plan[0].render_plan.pages[2]));
    const now = (await run('Collect Client Pages', [{ json: plan[0] }]))[0].json;
    const old = (await run('Collect Client Pages', store['Read Client Page HTML'], { code: 'legacy:Collect_Client_Pages_before_FUR1' }))[0].json;
    check('the output is identical to the pre-change node\'s, key for key (pages, existing page, its measured facts, signals, link candidates)', J(now) === J(old), J(Object.keys(now).filter(k => J(now[k]) !== J(old[k]))));
    check('and it did read the site (3 pages, the existing page measured from its HTML with its table and author)', now.client_pages_read === 3 && now.existing_page_digest && now.existing_page_digest.structure_reliable && now.existing_page_digest.tables === 1 && now.existing_page_digest.author === 'Mira Haddad', J({ n: now.client_pages_read, d: now.existing_page_digest && { t: now.existing_page_digest.tables, a: now.existing_page_digest.author } }));
    check('no render label on a server-rendered site', !('client_render' in now) && !(now.client_pages || []).some(p => 'read_via' in p), J(Object.keys(now)));
    clean();
    // the old wiring still works (a direct feed from Read Client Page HTML, no plan in the run): what every older scenario and replay does
    const direct = (await run('Collect Client Pages', store['Read Client Page HTML']))[0].json;
    check('the direct feed (no render chain in the run) answers the same', J(direct) === J(old), J(Object.keys(direct).filter(k => J(direct[k]) !== J(old[k]))));
  });

  await guard('FUR5 the wiring', async () => {
    reset(); clean(); const SN = 'FUR5 (FU-R1 2026-10-29) the generated main workflow: the render chain sits between Read Client Page HTML and Collect Client Pages, through the browser render'; begin(SN); const check = mkCheck(SN);
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_v4.json'), 'utf8'))[0];
    const by = Object.fromEntries(wf.nodes.map(n => [n.name, n])); const C = wf.connections;
    // W07-A (2026-10-31, build section 179): a reader node is now `<name> (reader)` followed by its fallback `<name>`, which also feeds the one
    // page-reader alert chain; the chain below reads through both, and the HTTP checks look at the reader node itself
    const outs = (n, i) => (((C[n] || {}).main || [])[i] || []).map(t => t.node).map(x => /^Render (?:More )?Client Pages \(reader\)$/.test(x) ? x.replace(/ \(reader\)$/, '') : x).filter(x => x !== 'Reader Refusals');
    check('Read Client Page HTML -> Client Render Plan -> Any Client Render?', J(outs('Read Client Page HTML', 0)) === J(['Client Render Plan']) && J(outs('Client Render Plan', 0)) === J(['Any Client Render?']));
    check('render branch: Render Client Pages -> Client Render More -> Any More Client Render? -> Render More Client Pages -> Collect Client Pages', J(outs('Any Client Render?', 0)) === J(['Render Client Pages']) && J(outs('Render Client Pages', 0)) === J(['Client Render More'])
      && J(outs('Any More Client Render?', 0)) === J(['Render More Client Pages']) && J(outs('Render More Client Pages', 0)) === J(['Collect Client Pages']));
    check('both "nothing to render" branches go straight to Collect Client Pages', J(outs('Any Client Render?', 1)) === J(['Collect Client Pages']) && J(outs('Any More Client Render?', 1)) === J(['Collect Client Pages']));
    for (const n of ['Render Client Pages', 'Render More Client Pages']) {
      const r = by[n + ' (reader)'];
      const h = Object.fromEntries(r.parameters.headerParameters.parameters.map(p => [p.name, p.value]));
      check(n + ': the browser render as HTML, never failing the run, the retry rule, the Jina credential', h['X-Engine'] === 'browser' && h['X-Return-Format'] === 'html' && r.onError === 'continueRegularOutput' && r.alwaysOutputData === true
        && r.retryOnFail === true && r.maxTries >= 3 && r.credentials && r.credentials.httpHeaderAuth && r.credentials.httpHeaderAuth.id === 'SEOcredJinaReade'
        && by[n].type === 'n8n-nodes-base.code' && J(((C[n + ' (reader)'] || {}).main || [])[0].map(t => t.node)) === J([n]), J(r).slice(0, 400));
    }
  });
  clean();
};
