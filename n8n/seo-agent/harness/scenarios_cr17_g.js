// CR17-G (client report 2026-11-17, devaicon.com; build section 197; private: ~/seo-agent-secrets/client-reports-2026-11-17/INV_7_ladder_ai.md):
//   CR17G1  LRU.folderFor: where the site keeps a kind of page (votes, the 60% majority, at least 3 pages, the root fallback, moves, company pages)
//   CR17G2  the Content Cadence: a rung planned at the root of a site that keeps its service pages in /services/ is written there; the shared
//           fixture harness/fixtures/cr17_g_folder.json is also run through the app's mirror (app/server/test/cadenceFolder.test.ts)
//   CR17G3  Ladder Plan's planned address takes the folder, with the reason
//   CR17G4  Content QA: a page no ladder placed gets the site's folder for its kind, and the package says why ("Publish it at ...")
//   CR17G5  Blog Package: the questions the page was written to answer (the AI question the run carried, its question headings)
//   CR17G6  AI questions settle when a page goes live ($0): Publish Check / Detect Published re-settle the questions the page answers, and a
//           page written for a question keeps it (AI Target Settle, AI Growth)
// Called from scenarios_v5.js (one appended line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const LRU = new Function(fs.readFileSync(path.join(CD, '_ladder_rules.js'), 'utf8').replace(/\nreturn \$input[\s\S]*$/, '') + '\nreturn LRU;')();
  const TELL = /[—–…→“”‘’]/;

  // ---- devaicon.com as it was on 17 Nov 2026 (sitemap + content log, reduced) ----
  const D = 'https://devaicon.com';
  const devPages = ['/', '/whatwedo', '/industries', '/industries/retail', '/industries/education', '/industries/hospitality', '/capabilities/open-edx-services', '/capabilities/open-edx-services/open-edx-hosting',
    '/services/agentic-ai-development-in-uae', '/services/ai-app-development-companies', '/services/ai-development-companies', '/services/engagement-models', '/services/industries-bfsi',
    '/insights', '/insights/custom-ai-solutions-uae', '/insights/ai-in-industrial-automation', '/insights/agentic-ai', '/about-devaicon', '/careers', '/careers/data-engineer', '/contact-us', '/privacy', '/security']
    .map(p => ({ url: D + p, http_status: 200 })).concat([{ url: D + '/ai-automation-services-pakistan', http_status: 301 }]);
  const devPublished = [['/services/agentic-ai-development-in-uae', 'Service Page'], ['/services/ai-app-development-companies', 'Service Page'], ['/services/ai-development-companies', 'Service Page'],
    ['/services/engagement-models', 'Service Page'], ['/services/industries-bfsi', 'Service Page'], ['/ai-automation-services-pakistan', 'Service Page'],
    ['/insights/custom-ai-solutions-uae', 'Guide'], ['/insights/ai-in-industrial-automation', 'Guide'], ['/insights/governed-vs-autonomous-ai-agents', 'Guide']].map(([p, t]) => ({ url: D + p, page_type: t }));
  const devMoves = [{ from: D + '/ai-automation-services-pakistan', to: D + '/services/ai-automation-services-pakistan' }, { from: D + '/engagement-models', to: D + '/services/engagement-models' }];

  await guard('CR17G1 folderFor', async () => {
    const SN = 'CR17G1 F4 — LRU.folderFor: a new page goes where the site keeps that kind of page (3 pages and 60%, else the root as before)'; reset(); begin(SN); const check = mkCheck(SN);
    const svc = LRU.folderFor('Service Page', { published: devPublished, moves: devMoves, pages: devPages });
    const art = LRU.folderFor('Guide', { published: devPublished, pages: devPages });
    console.log('   devaicon ->', J({ svc, art }));
    check('devaicon service pages -> /services/ from the pages the client published (the root page it moved counts at its new address)', svc.folder === '/services/' && svc.basis === 'published' && svc.votes === svc.of && svc.of >= 6, J(svc));
    check('devaicon guides -> /insights/', art.folder === '/insights/' && art.kind === 'article', J(art));
    check('the reason is plain words, no em dash', /^your service pages live under \/services\/ \(\d+ of the \d+ you published or moved recently\)$/.test(svc.why) && !TELL.test(svc.why + art.why), svc.why);
    check('AI answer, comparison, FAQ and case-study pages are articles; service, local, pillar and landing pages are services',
      ['Guide', 'Blog Post', 'Comparison Page', 'FAQ Page', 'Case Study', 'AI answer page'].every(t => LRU.classOf(t) === 'article') && ['Service Page', 'Local Page', 'Pillar Page', 'Landing Page', 'Product Page', ''].every(t => LRU.classOf(t) === 'service'), 'class');
    const two = LRU.folderFor('Service Page', { published: devPublished.slice(0, 2), pages: [] });
    check('fewer than 3 pages behind a folder: the root, as before', two.folder === '/' && two.basis === 'default', J(two));
    const split = LRU.folderFor('Service Page', { published: [['/services/a'], ['/services/b'], ['/solutions/c'], ['/solutions/d'], ['/e']].map(([p]) => ({ url: D + p, page_type: 'Service Page' })), pages: [] });
    check('no 60% majority: the root, as before', split.folder === '/' && split.basis === 'default', J(split));
    const inv = LRU.folderFor('Service Page', { pages: ['/services/a', '/services/b', '/services/c', '/about-us', '/contact', '/privacy', '/services', '/blog/x', '/blog/y'].map(p => D + p) });
    check('the live inventory decides when nothing was published: company pages, folder index pages and articles are not service pages', inv.folder === '/services/' && inv.basis === 'inventory', J(inv));
    const blogSvc = LRU.folderFor('Service Page', { published: ['/insights/a', '/insights/b', '/insights/c'].map(p => ({ url: D + p, page_type: 'Service Page' })), pages: [] });
    check('a service page is never planned in a blog folder (rule 1), even when service pages went live there', blogSvc.folder === '/', J(blogSvc));
    const techand = LRU.folderFor('Service Page', { published: [{ url: 'https://www.techand.ai/ms-365-erp-uae', page_type: 'Service Page' }, { url: 'https://www.techand.ai/insights/is-microsoft-dynamics-365-an-erp-system', page_type: 'Service Page' }],
      pages: ['/dynamics-365-crm-uae', '/ms-365-erp-uae', '/business-central-implementation-uae', '/power-platform-analytics-uae', '/whatwedo/a', '/insights/x', '/insights/y', '/contact-us'].map(p => 'https://www.techand.ai' + p) });
    check('techand.ai keeps its service pages at the root', techand.folder === '/', J(techand));
    const gone = LRU.folderFor('Guide', { published: ['/blog/a', '/blog/b', '/blog/c'].map(p => ({ url: D + p, page_type: 'Guide' })), pages: ['/blog/a', '/blog/b', '/blog/c'].map(p => ({ url: D + p, http_status: 404 })) });
    check('pages that no longer answer (404, not moved) say nothing about where the site keeps its pages', gone.folder === '/' && gone.basis === 'default', J(gone));
    check('plannedUrl: the folder and the slash form', LRU.plannedUrl(D + '/', 'AI App Development', false, '/services/') === D + '/services/ai-app-development'
      && LRU.plannedUrl(D, 'x y', true, svc) === D + '/services/x-y/' && LRU.plannedUrl(D, 'x y', false, '/') === D + '/x-y' && LRU.plannedUrl(D, 'x y') === D + '/x-y', LRU.plannedUrl(D + '/', 'AI App Development', false, '/services/'));
  });

  await guard('CR17G2 cadence writes the rung in the site folder', async () => {
    const SN = 'CR17G2 F4 — the Content Cadence writes a rung planned at the root in the folder the site keeps its service pages in (fixture shared with the app mirror)'; reset(); begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cr17_g_folder.json'), 'utf8'));
    const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
    const RealDate = Date;
    for (const c of FX.cases) {
      reset(); const t = c.tables;
      mock('Manual Run', [{ json: c.trigger || {} }]);
      for (const [n, k] of [['Load Sites', 'sites'], ['Load Cadence', 'cadence'], ['Load Ladders', 'ladders'], ['Load Query History', 'query_history'], ['Load Trends', 'trends'], ['Load Content Log', 'content_log'],
        ['Load Ladder Settings', 'ladder_settings'], ['Load Main Keyword Ranks', 'ranks'], ['Load AI Targets (Cadence)', 'ai_targets'], ['Load Monitors (Cadence)', 'monitors'], ['Load Pages (Cadence)', 'pages'],
        ['Load AI Brands (Cadence)', 'ai_brands'], ['Load Skips (Cadence)', 'skips'], ['Load Cost (Cadence)', 'cost'], ['Load Cycle Jobs (Cadence)', 'cycle_jobs'], ['Load Profiles (Cadence)', 'profiles']]) mock(n, items(t[k]));
      mock('Load AI Targets Writing (Cadence)', items([]));
      const T = RealDate.parse(c.now); class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
      global.Date = FD; let out; try { out = (await run('Cadence Plan', [{ json: {} }])).map(i => i.json); } finally { global.Date = RealDate; }
      const pick = out.find(j => j.keyword === c.expect.pick_keyword && j.body);
      console.log('   ' + c.name + ' ->', J(pick && { target: pick.body.ladder_target_url, existing: pick.body.existing_page_url }));
      check(c.name + ': ' + c.doc, pick && pick.body.ladder_target_url === c.expect.target_url && !pick.body.existing_page_url, J(pick && pick.body.ladder_target_url));
    }
  });

  await guard('CR17G3 Ladder Plan planned address', async () => {
    const SN = 'CR17G3 F4 — Ladder Plan plans a new page in the site folder for its kind and says why'; reset(); begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(CD, 'Ladder_Plan.js'), 'utf8');
    const a = src.indexOf('const folderEvLP = (() => {'), b = src.indexOf('\n', src.indexOf('const plannedUrl = (kw, type) =>'));
    check('Ladder Plan builds its folder evidence from the content log, the ladders, the redirects the title read saw and the inventory', a > 0 && b > a
      && /rowsOf\('Load Content Log \(Ladder\)'\)/.test(src.slice(a, b)) && /rowsOf\('Load Domain Ladders'\)/.test(src.slice(a, b)) && /redirected/.test(src.slice(a, b)), 'missing');
    const rows = { 'Load Content Log (Ladder)': devPublished.map(p => ({ domain: 'devaicon.com', status: 'published', published_url: p.url, page_type: p.page_type })), 'Load Domain Ladders': [] };
    const mk = new Function('rowsOf', 'reachDomain', 'domain', 'PAGE_TITLES', 'SM', 'pageModel', 'base', 'LRU', 'homeUrl', 'slashFormLP', 'slug',
      src.slice(a, b) + '\nreturn { plannedUrl, folderLP };');
    const f = mk((n) => rows[n] || [], (d) => String(d || '').replace(/^www\./, ''), 'devaicon.com', { redirected: [] }, { pages: (m) => m.pages }, { pages: devPages }, { site_urls: [] }, LRU, D + '/', false, (x) => x);
    check('the main page and a service rung -> /services/, a guide rung -> /insights/', f.plannedUrl('ai app development', 'Service Page') === D + '/services/ai-app-development'
      && f.plannedUrl('agentic ai explained', 'Guide') === D + '/insights/agentic-ai-explained', J([f.plannedUrl('ai app development', 'Service Page'), f.plannedUrl('agentic ai explained', 'Guide')]));
    const g = mk(() => [], (d) => d, 'example.com', { redirected: [] }, { pages: () => [] }, { pages: [] }, { site_urls: [] }, LRU, 'https://example.com/', true, (x) => x);
    check('a site we cannot read: the root and the slash form, as before', g.plannedUrl('ai app development', 'Service Page') === 'https://example.com/ai-app-development/', g.plannedUrl('ai app development', 'Service Page'));
    check('the plan says why a new page sits in a folder (target_why) and reports the folders', /fw\.why/.test(src) && /folders: planned \? \{ service: folderLP\('Service Page'\), article: folderLP\('Guide'\) \}/.test(src), 'no reason');
  });

  // ---- Content QA and the package on exec 42's page (techand.ai), placed by no ladder ----
  const FX42 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_eqa_42.json.gz'))).toString());
  const SITE_MODEL = { site_model: { ...(FX42.parse_brief.site_model || {}), domain: 'techand.ai', canonical_host: 'www.techand.ai' } };
  const qa = async (over, loads) => {
    reset();
    mock('Parse Brief', [{ json: { ...clone(FX42.parse_brief), ladder_id: '', ladder_target_url: '', ...(over || {}) } }]);
    mock('Analyze Competitor Pages', [{ json: { competitors: clone(FX42.analyze_competitors) } }]);
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    for (const [n, r] of Object.entries(loads || {})) mock(n, r.map(j => ({ json: j })));
    return (await run('Content QA', [{ json: { output: FX42.draft_round2, critique: null } }], { runIndex: 1 }))[0].json;
  };
  const W = 'https://www.techand.ai';
  const logsSvc = ['crm-consulting', 'crm-data-migration', 'crm-training'].map(s => ({ domain: 'techand.ai', status: 'published', published_url: W + '/services/' + s, page_type: 'Service Page' }));
  const logsArt = ['a', 'b', 'c'].map(s => ({ domain: 'techand.ai', status: 'published', published_url: W + '/insights/' + s, page_type: 'Guide' }));

  await guard('CR17G4 Content QA address follows the site', async () => {
    const SN = 'CR17G4 F4 — Content QA: a page no ladder placed gets the folder where the site keeps that kind of page, and the package says why'; reset(); begin(SN); const check = mkCheck(SN);
    const a = (await qa({ page_type: 'Guide', site_urls: [] }, { 'Load Drafts (Run)': [...logsSvc, ...logsArt], 'Load Ladders (Run)': [] })).content_qa;
    const s = (await qa({ page_type: 'Service Page', site_urls: [] }, { 'Load Drafts (Run)': [...logsSvc, ...logsArt], 'Load Ladders (Run)': [] })).content_qa;
    const none = (await qa({ page_type: 'Service Page', site_urls: [] }, {})).content_qa;
    const lad = (await qa({ page_type: 'Service Page', site_urls: [], ladder_id: 'lad_x', ladder_target_url: W + '/ai-consultant' }, { 'Load Drafts (Run)': logsSvc })).content_qa;
    console.log('   page_url ->', J({ guide: a.page_url, service: s.page_url, none: none.page_url, ladder: lad.page_url, why: a.page_url_why }));
    check('a guide goes under /insights/, a service page under /services/ (where the client published ours)', /^https:\/\/www\.techand\.ai\/insights\/[a-z0-9-]+$/.test(a.page_url) && /^https:\/\/www\.techand\.ai\/services\/[a-z0-9-]+$/.test(s.page_url), J([a.page_url, s.page_url]));
    check('the reason travels with it, in plain words', /^your guides and articles live under \/insights\/ \(3 of the 3 you published or moved recently\)$/.test(a.page_url_why) && !TELL.test(a.page_url_why), a.page_url_why);
    check('nothing published and no folder in the inventory: the address the slug gave before (no reason)', !/\/(services|insights)\//.test(none.page_url) && !none.page_url_why, J([none.page_url, none.page_url_why]));
    check('a ladder page keeps the address its ladder planned (R15)', lad.page_url === W + '/ai-consultant' && !lad.page_url_why, lad.page_url);
    const bw = { ...clone(FX42.build_word_file), ladder_id: '', ladder_target_url: '', ladder_links: [], qa_page_url: a.page_url, qa_page_url_why: a.page_url_why };
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    const M = (await run('Blog Package', [{ json: bw }]))[0].json.article_meta;
    const pub = (M.publish_checklist || []).find(x => /^Publish it at/.test(x)) || '';
    check('the package says where to publish it and why, and suggests that address', pub === 'Publish it at ' + a.page_url + ': ' + a.page_url_why && M.suggested_url === a.page_url, J({ pub, url: M.suggested_url }));
  });

  await guard('CR17G5 Blog Package questions this page answers', async () => {
    const SN = 'CR17G5 Q2 — the package names the questions the page was written to answer (the AI question the run carried, its question headings)'; reset(); begin(SN); const check = mkCheck(SN);
    const Q = 'Who are the top agentic AI development companies in the UAE for building autonomous business agents?';
    const md = 'Title: AI app development companies\n# AI App Development Companies in the UAE\n\nIntro text.\n\n## ' + Q + '\n\nAnswer.\n\n## How much does an AI app cost?\n\nText.\n\n## Our process\n\nText.\n\n## What is the timeline for [an AI app](https://x.test)?\n\nText.';
    mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    const P = (await run('Blog Package', [{ json: { ...clone(FX42.build_word_file), page_markdown: md, ai_target: { question: Q, kind: 'answer', target_id: 'ait_q37' } } }]))[0].json.article_meta;
    console.log('   questions_answered ->', J(P.questions_answered));
    check('the AI question the run carried', J(P.questions_answered.ai) === J([{ question: Q, kind: 'answer', target_id: 'ait_q37' }]), J(P.questions_answered.ai));
    check('its own question headings (links and the AI question itself out), not the other headings', J(P.questions_answered.headings) === J(['How much does an AI app cost?', 'What is the timeline for an AI app?']), J(P.questions_answered.headings));
    reset(); mock('Site Model', [{ json: clone(SITE_MODEL) }]); mock('Parse Brief', [{ json: { ai_target: { question: Q, kind: 'refresh' } } }]);
    const P2 = (await run('Blog Package', [{ json: { ...clone(FX42.build_word_file), page_markdown: md } }]))[0].json.article_meta;
    check('a ladder page the weekly pages attached the question to: read from the run\'s brief', P2.questions_answered.ai.length === 1 && P2.questions_answered.ai[0].kind === 'refresh', J(P2.questions_answered));
    reset(); mock('Site Model', [{ json: clone(SITE_MODEL) }]);
    const P3 = (await run('Blog Package', [{ json: { ...clone(FX42.build_word_file), page_markdown: md } }]))[0].json.article_meta;
    check('a page written for no AI question lists none', P3.questions_answered.ai.length === 0, J(P3.questions_answered));
  });

  await guard('CR17G6 AI questions settle when a page goes live', async () => {
    const SN = 'CR17G6 Q3 / Q2 — a page going live settles the AI questions it answers at once, and a page written for a question keeps it'; reset(); begin(SN); const check = mkCheck(SN);
    const SID = 'site_devaicon-com', DOM = 'devaicon.com';
    const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
    const Q37 = 'Who are the top agentic AI development companies in the UAE for building autonomous business agents?';
    const head = { site_id: SID, domain: DOM, keyword: 'agentic ai development in uae', source: 'ladder', rung: 4, page_type: 'Service Page', request_id: 'cad_head', status: 'published', published_url: D + '/services/agentic-ai-development-in-uae', published_at: day(4), started_at: day(4) };
    const rung = { site_id: SID, domain: DOM, keyword: 'ai app development companies', source: 'ladder', rung: 2, page_type: 'Service Page', request_id: 'cad_rung', status: 'published', published_url: D + '/services/ai-app-development-companies', published_at: day(11), started_at: day(11) };
    const t37 = (over) => ({ target_id: 'ait_q37', site_id: SID, domain: DOM, prompt_id: 'q37', question: Q37, keyword: 'agentic ai development companies uae', kind: 'answer', status: 'writing', request_id: 'cad_rung', written_at: day(11), ...(over || {}) });
    // ---- the cadence's settle: the question was folded into the rung "ai app development companies" ----
    const settle = async (logs, target) => { reset(); mock('Load AI Targets Writing (Cadence)', [{ json: target }]); mock('Load Content Log', logs.map(j => ({ json: j })));
      mock('Load Sites', [{ json: { site_id: SID, domain: DOM, country: 'United Arab Emirates' } }]); mock('Cadence Plan', [{ json: { nothing_to_do: true, report_only: true, site_id: SID, domain: DOM } }]);
      return (await run('AI Target Settle', [{ json: {} }])).map(i => i.json); };
    const a = await settle([head, rung], t37());
    console.log('   owner live ->', J(a));
    check('the ladder main page that owns the question\'s search is live: the question is written there (live, its address, its run), never queued for a second page',
      a.length === 1 && a[0].status === 'written' && a[0].reason_code === 'live' && a[0].request_id === 'cad_head' && /agentic-ai-development-in-uae/.test(a[0].reason_args) && !TELL.test(a[0].reason), J(a));
    const b = await settle([rung], t37());
    check('no other page owns it: the page written for the question keeps it (Q2), live at its own address', b.length === 1 && b[0].status === 'written' && b[0].reason_code === 'live' && /ai-app-development-companies/.test(b[0].reason_args), J(b));
    const c = await settle([{ ...rung, status: 'written', published_url: '', published_at: '' }], t37());
    check('the folded page is not live yet: nothing to keep, the question goes back to the queue (AI Growth may give it a ladder page)', c.length === 1 && c[0].status === 'queued' && c[0].reason_code === 'new_page', J(c));
    // ---- AI Growth's weekly settle keeps the same answer ----
    reset();
    const SVC = ['Agentic AI development', 'AI app development'];
    const G = [{ prompt_id: 'q37', prompt: Q37, kind: 'recommend', topic: 'agentic ai development in uae', competitors: ['rival-ai.example'], sources: [], volume: 40, stage: 'decision', cluster: 'agentic ai development in uae', fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } }];
    mock('Load Sites', [{ json: { site_id: SID, domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', canonical_host: DOM, declared_services: J(SVC), services_json: J(SVC) } }]);
    mock('Load Ladders', [{ json: { ladder_id: 'lad_a', domain: DOM, head_keyword: 'agentic ai development in uae', keyword: 'agentic ai development in uae', rung: 4, status: 'published', target_url: head.published_url, page_exists: true } }]);
    mock('Load Monitors', [{ json: { site_id: SID, domain: DOM, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]); mock('Load Cycles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: { site_id: SID, domain: DOM, run_id: 'ai_cr17', checked_at: day(1), gaps_json: J(G), pages_json: '[]', competitors_json: '[]' } }]);
    mock('Load AI Prompts', [{ json: { site_id: SID, status: 'active', prompt_id: 'q37', prompt: Q37, keyword: 'agentic ai development companies uae', topic: 'agentic ai development in uae', focus_topic: 'agentic ai development in uae', focus_source: 'client', focus_state: 'active', kind: 'recommend' } }]);
    mock('Load Content Log', [head, rung].map(j => ({ json: j }))); mock('Load Query History', [{ json: {} }]); mock('Load AI Pages', [{ json: {} }]);
    mock('Load AI Targets', [{ json: { ...t37({ status: 'written' }), target_id: 'ait_devaicon-com_q37', created_at: day(40), updated_at: day(5), reason_code: 'written', reason_args: '{}' } }]); mock('Load AI Growth', [{ json: {} }]); mock('Load AI Answers', [{ json: {} }]);
    mock('Load Cache (Growth)', [{ json: {} }]); mock('Load Link Prospects (Growth)', [{ json: {} }]); mock('Load Pages (Growth)', [{ json: {} }]);
    const GP = (await run('Growth Plan', store['Load Cache (Growth)']))[0].json;
    const g = (GP.targets || []).find(x => x.prompt_id === 'q37') || {};
    console.log('   AI Growth q37 ->', J([g.status, g.reason_code, g.request_id, g.reason_args]));
    check('AI Growth: the same answer as the settle (written, live at the main page, its run), no new page planned', g.status === 'written' && g.reason_code === 'live' && g.request_id === 'cad_head' && /agentic-ai-development-in-uae/.test(g.reason_args), J(g));
    // ---- "I published a page" (main workflow) and publish detection (Site Tracker): the questions settle at once ----
    const T = (id, over) => ({ json: { target_id: id, site_id: SID, domain: DOM, question: 'q ' + id, keyword: 'k ' + id, kind: 'answer', status: 'queued', request_id: '', ...(over || {}) } });
    const targets = [T('ait_q37', { question: Q37, keyword: 'agentic ai development companies uae' }), T('ait_other', { keyword: 'cloud migration cost uae' }),
      T('ait_busy', { question: 'Best agentic AI development companies in Dubai?', keyword: 'best agentic ai development companies dubai', status: 'writing', request_id: 'cad_other' }),
      T('ait_own', { keyword: 'something else entirely', status: 'writing', request_id: 'cad_head' }), T('ait_won', { keyword: 'agentic ai development companies', status: 'won' })];
    reset(); mock('Publish Check', [{ json: { recorded_live: true, country: 'United Arab Emirates', log_row: head } }]); mock('Load AI Targets (Publish)', targets);
    const p = (await run('AI Target Settle (Publish)', [{ json: {} }])).map(i => i.json);
    console.log('   publish settle ->', J(p.map(x => [x.target_id, x.status, x.reason_code, x.request_id])));
    check('"I published a page": the question the page answers (same search or its ladder\'s main page) and the run\'s own question settle written / live, nothing else',
      J(p.map(x => x.target_id).sort()) === J(['ait_own', 'ait_q37']) && p.every(x => x.status === 'written' && x.reason_code === 'live' && x.request_id === 'cad_head' && /agentic-ai-development-in-uae/.test(x.reason_args)), J(p));
    check('the settle rows carry exactly the columns the update node writes', p.every(x => ['target_id', 'status', 'request_id', 'written_at', 'at', 'reason_code', 'reason_args', 'reason'].every(k => k in x)), J(p[0]));
    reset(); mock('Publish Check', [{ json: { recorded_live: false, country: 'United Arab Emirates', log_row: { ...head, status: 'written', published_url: '' } } }]); mock('Load AI Targets (Publish)', targets);
    const n = (await run('AI Target Settle (Publish)', [{ json: {} }])).map(i => i.json);
    check('a page that was not recorded live settles nothing', n.length === 1 && n[0].skip === true, J(n));
    reset(); mock('Detect Published', [{ json: { site_id: SID, domain: DOM, log_rows: [head] } }]); mock('Load AI Targets (Publish)', targets); mock('Load Sites', [{ json: { site_id: SID, domain: DOM, country: 'United Arab Emirates' } }]);
    const dd = (await run('AI Target Settle (Publish)', [{ json: {} }])).map(i => i.json);
    check('publish detection (Site Tracker): the same questions settle', J(dd.map(x => x.target_id).sort()) === J(['ait_own', 'ait_q37']), J(dd));
  });
};
