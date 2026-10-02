const H = require('./harness');
const F = require('./fixtures');
const V = require('./fixtures_v5');
const { run, mock, begin, expectError, save, scanHtml, store } = H;
(async () => {
const decode = (items) => Buffer.from(items[0].binary.data.data, 'base64').toString('utf8');
const guard = async (name, fn) => { try { await fn(); } catch (e) { console.log(`   !! scenario "${name}" aborted at: ${(e.message || e).split('\n')[0]}`); } };
const reset = () => { for (const k of Object.keys(store)) delete store[k]; };
let pvS1 = null;   // Parse Verdict output of S1, reused by S18 (page types)
// Search Console + sitemap part of the audit (between the data collection and Build Site Issues); `mode`: 'ok' | 'denied' | 'nosm'
const runGscAudit = async (input, mode) => {
  const T = require('./fixtures_tracking');
  const gp = await run('GSC Audit Plan', input);
  console.log('   gsc audit plan ->', JSON.stringify({ domain: gp[0].json.domain, pages: gp[0].json.crawl_pages, indexable: gp[0].json.crawl_indexable, sample: gp[0].json.sample.length, first: gp[0].json.sample[0], complete: gp[0].json.crawl_finished && gp[0].json.pages_crawled < gp[0].json.crawl_limit }));
  mock('Fetch Sitemap (Audit)', mode === 'nosm' ? { statusCode: 404, headers: {}, data: 'not found' } : { statusCode: 200, headers: {}, data: F.sitemapIndex });
  const sc1 = await run('Sitemap Children (Audit)', store['Fetch Sitemap (Audit)']); console.log('   sitemap children ->', sc1.map(x => x.json.url || 'skip: ' + x.json.reason).join(', '));
  const crawledPaths = (F.crawledPagesRes.tasks[0].result[0].items || []).slice(0, 6).map(p => p.url.replace(/^https?:\/\/[^/]+/, ''));
  mock('Fetch Sitemap Children (Audit)', sc1.filter(x => x.json.url).map(() => ({ statusCode: 200, headers: {}, data: F.urlset([...crawledPaths, '/only-in-sitemap/', '/old-redirected/']).replace(/https:\/\/northwind-erp\.com/g, 'https://www.northwind-erp.com') })));   // www in the sitemap, bare domain in the crawl
  mock('GSC Sites (Audit)', mode === 'denied' ? T.gscDenied() : T.gscSites());
  const gr = await run('GSC Audit Requests', store['GSC Sites (Audit)']);
  console.log('   gsc audit requests ->', gr.length, JSON.stringify(gr.reduce((m, q) => { const k = q.json.kind || (q.json.skip ? 'skip' : '?'); m[k] = (m[k] || 0) + 1; return m; }, {})), '| property', gr[0].json.property || '-', gr[0].json.error ? '| error: ' + gr[0].json.error : '');
  if (!gr[0].json.skip) { mock('GSC Audit Query', gr.map(q => T.gscAuditResponse(q.json))); mock('GSC Sitemaps (Audit)', T.gscSitemaps(mode === 'ok' ? {} : { none: true })); } else { delete store['GSC Audit Query']; delete store['GSC Sitemaps (Audit)']; }
  const gf = await run('GSC Audit Findings', gr[0].json.skip ? gr : store['GSC Sitemaps (Audit)']);
  const sc = gf[0].json.search_console, st = gf[0].json.site_structure;
  console.log('   gsc findings ->', gf[0].json.extra_findings.map(f => '[' + f.severity + (f.scoring === false ? ', unscored' : '') + '] ' + f.title).join(' | '));
  console.log('   gsc works ->', gf[0].json.extra_works.join(' | '));
  console.log('   search console ->', JSON.stringify({ connected: sc.connected, property: sc.property, error: sc.error, totals: sc.totals, sitemaps: sc.sitemaps.length, coverage: sc.coverage, not_indexed: sc.not_indexed.length, canon: sc.canonical_mismatch.length, rich: sc.rich_results, shown_not_in_sitemap: sc.not_in_sitemap_but_shown.length }));
  console.log('   structure ->', JSON.stringify(st));
  return gf;
};

// ===================================================================================
await guard('validation', async () => {
  begin('S0 Normalize Input — validation & webhook parsing');
  mock('Start Form', F.forms.startKeyword);
  const v1 = await run('Normalize Input', F.forms.badCountry); console.log('   bad country ->', JSON.stringify(v1[0].json.validation_error), '| via_webhook', v1[0].json.via_webhook);
  mock('Start Form', F.forms.startAudit);
  const v2 = await run('Normalize Input', F.forms.badDomain); console.log('   bad domain ->', JSON.stringify(v2[0].json.validation_error));
  mock('Start Form', F.forms.startDescribe);
  const v3 = await run('Normalize Input', F.forms.localhostDomain); console.log('   internal host ->', JSON.stringify(v3[0].json.validation_error));
  const v4 = await run('Rate Limit', v3); console.log('   rate limit passthrough keeps error ->', !!v4[0].json.validation_error);
  // webhook verdict (no Start Form)
  reset();
  const wv = await run('Normalize Input', F.forms.webhookVerdict);
  console.log('   webhook verdict ->', JSON.stringify({ mode: wv[0].json.mode, verdict_only: wv[0].json.verdict_only, country: wv[0].json.country, location_code: wv[0].json.location_code, via_webhook: wv[0].json.via_webhook, callback_url: wv[0].json.callback_url, include_content: wv[0].json.include_content, need_site_description: wv[0].json.need_site_description }));
  const wk = await run('Normalize Input', F.forms.webhookKeywordDefault);
  console.log('   webhook default ->', JSON.stringify({ mode: wk[0].json.mode, include_content: wk[0].json.include_content, include_seo_report: wk[0].json.include_seo_report, page_type: wk[0].json.page_type, run_page_check: wk[0].json.run_page_check }));
  // rate limit
  H.staticData.rate = undefined;
  for (let i = 0; i < 6; i++) await run('Rate Limit', wk);
  const rl7 = await run('Rate Limit', wk); console.log('   7th run ->', JSON.stringify(rl7[0].json.validation_error));
  const wnc = await run('Normalize Input', { body: { keyword: 'x', country: 'US' } }); console.log('   API without callback/email ->', JSON.stringify(wnc[0].json.validation_error));
});

// ===================================================================================
await guard('keyword', async () => {
  reset(); begin('S1 Keyword mode (form) — full content pipeline');
  mock('Start Form', F.forms.startKeyword);
  const n = await run('Normalize Input', F.forms.pageKeyword);
  console.log('   new fields ->', JSON.stringify({ goal: n[0].json.goal, tone: n[0].json.tone, cta: n[0].json.cta, business_facts: n[0].json.business_facts }));
  console.log('   normalized ->', JSON.stringify({ keyword: n[0].json.keyword, domain: n[0].json.domain, email: n[0].json.email, include_content: n[0].json.include_content, include_seo_report: n[0].json.include_seo_report, run_page_check: n[0].json.run_page_check, need_site_description: n[0].json.need_site_description, language_code: n[0].json.language_code }));
  await run('Rate Limit');
  const nro = await run('Normalize Input', F.forms.pageKeywordReportOnly); console.log('   report-only request -> include_content', nro[0].json.include_content, '| include_seo_report', nro[0].json.include_seo_report);
  store['Normalize Input'] = n;
  mock('Read Website', { site_text: F.jinaSite });
  const cs = await run('Clean Site Text', store['Read Website']);
  console.log('   clean site ->', JSON.stringify({ page_title: cs[0].json.page_title, read_ok: cs[0].json.read_ok, len: cs[0].json.site_text.length }));
  mock('Site Describer', { output: { business_name: 'Northwind ERP', one_line_summary: 'ERP partner for distributors', business_description: 'Northwind ERP implements and customises Odoo and Dynamics 365 for distributors in the UAE.', industry: 'IT services', products_or_services: ['ERP implementation', 'Data migration'], target_audience: ['Distributors', 'Wholesalers'], unique_selling_points: ['Bilingual consultants'], location_served: 'UAE', tone_of_brand: 'Professional', suggested_meta_title: 'Northwind ERP | ERP Implementation Dubai', suggested_meta_description: 'ERP implementation for UAE distributors. Book a call.', seed_keywords: ['erp implementation dubai', 'odoo partner uae', 'erp for distributors', 'northwind erp'] } });
  await run('Parse Description', store['Site Describer']);
  mock('Route Mode', store['Parse Description']);
  await run('Prepare Keyword Run', store['Route Mode']);
  mock('Fetch Sitemap Index', { statusCode: 200, headers: {}, sitemap_xml: F.sitemapIndex });
  const sm = await run('Parse Sitemap Index', store['Fetch Sitemap Index']);
  console.log('   sitemaps to read ->', sm.map(i => i.json.url).join(' , '));
  mock('Fetch Sitemaps', sm.map((s, i) => ({ statusCode: i === 2 ? 404 : 200, headers: {}, sitemap_xml: i === 0 ? F.urlset(F.siteUrls.slice(0, 11)) : (i === 1 ? F.urlset(F.siteUrls.slice(11)) : '') })));
  const cu = await run('Collect Site URLs', store['Fetch Sitemaps']);
  console.log('   site urls ->', JSON.stringify({ count: cu[0].json.site_urls_count, existing_page: cu[0].json.existing_page, candidates: cu[0].json.internal_link_candidates.slice(0, 5).map(c => c.path) }));
  const cpr = await run('Client Page Requests', cu);
  console.log('   client page requests ->', cpr.map(r => r.json.kind + ':' + r.json.url).join(' | '));
  mock('Read Client Pages', cpr.map((r, i) => i === 1 ? { error: { message: 'timeout' } } : { page_text: F.jinaSite }));
  const ccp = await run('Collect Client Pages', store['Read Client Pages']);
  console.log('   client pages ->', ccp[0].json.client_pages_read, 'read | existing text', ccp[0].json.existing_page_text.length, 'chars | signals', JSON.stringify(ccp[0].json.client_signals));
  mock('SERP Top 10', F.serpTop);
  const top = await run('Pick Top 6', store['SERP Top 10']);
  console.log('   picked ->', top.map(t => `#${t.json.rank} ${t.json.domain}`).join(', '), '| first url:', top[0].json.url);
  mock('Read Competitor Pages', top.map((t, i) => i === 2 ? { error: { message: 'Request failed with status code 522' } } : (i === 4 ? { page_text: F.jinaBlocked } : { page_text: F.compPage(i, 260 + i * 40) })));
  const fb = await run('Find Blocked Pages', store['Read Competitor Pages']);
  console.log('   blocked ->', JSON.stringify(fb[0].json.blocked.map(b => b.domain + ':' + b.reason)));
  const bpi = await run('Blocked Page Items', fb);
  mock('Retry Blocked Pages', bpi.map((b, i) => i === 0 ? { page_text: F.compPage(2, 420) } : { page_text: F.jinaBlocked }));
  const cc = await run('Analyze Competitor Pages', store['Retry Blocked Pages']);
  console.log('   retried pages merged ->', cc[0].json.retried_pages);
  console.log('   competitors read ->', cc[0].json.competitors_read, '| failed:', JSON.stringify(cc[0].json.failed_pages), '| avg words:', cc[0].json.avg_competitor_words, '| features:', cc[0].json.serp_features.features_present.join(','), '| AIO cites:', cc[0].json.serp_features.ai_overview.cited_domains.join(','));
  console.log('   digest chars ->', cc[0].json.competitor_digest.length, '| headings[0]:', JSON.stringify(cc[0].json.competitors[0].headings.slice(0, 4)));
  console.log('   term model ->', cc[0].json.term_model.slice(0, 8).map(t => t.term + '(' + t.docs + ')').join(', '), '| questions', cc[0].json.competitor_questions.length, '| stats', cc[0].json.stats_seen.length, '| forum', cc[0].json.serp_features.forum_threads.length);
  mock('Facts SERP', V.factsSerp);
  const cf = await run('Collect Facts', store['Facts SERP']);
  console.log('   facts ->', cf[0].json.facts.map(f => f.source + '[' + f.authority + ']').join(', '), '| extra questions', cf[0].json.extra_questions.length);
  mock('Competitor Analyzer', { output: F.competitorAnalysis });
  const pa = await run('Parse Analysis', store['Competitor Analyzer']);
  console.log('   parse analysis keeps facts?', Array.isArray(pa[0].json.facts), '| term_digest?', !!pa[0].json.term_digest);
  mock('Keyword Data', F.keywordOverview);
  mock('Site Authority', F.rankOverview(F.OUR));
  const mk = await run('Merge Keyword Data', store['Site Authority']);
  console.log('   site authority ->', JSON.stringify(mk[0].json.site_authority));
  console.log('   keyword data ->', JSON.stringify(mk[0].json.keyword_data).slice(0, 220));
  mock('Verdict Agent', { output: F.verdictGo });
  const pv = await run('Parse Verdict', store['Verdict Agent']);
  console.log('   verdict ->', pv[0].json.verdict, pv[0].json.verdict_score, '| include_content:', pv[0].json.include_content);
  pvS1 = pv[0].json;
  mock('Load Profile (Brief)', [{ json: {} }]); mock('Load Case Studies (Brief)', [{ json: {} }]);   // empty tables: alwaysOutputData gives one empty item
  const bc0 = await run('Brief Context', store['Load Case Studies (Brief)']);
  console.log('   brief context (no profile) ->', JSON.stringify({ role: bc0[0].json.page_role, article_like: bc0[0].json.article_like, author: bc0[0].json.author, profile: bc0[0].json.site_profile, proof: bc0[0].json.proof_library.length, video: bc0[0].json.video, eeat: bc0[0].json.eeat_context.slice(0, 50), role_brief: bc0[0].json.role_brief }));
  mock('Strategy Brief', { output: V.briefV5 });
  const pb0 = await run('Parse Brief', store['Strategy Brief']); console.log('   parse brief keeps the context ->', pb0[0].json.page_role, '| verdict kept', pb0[0].json.verdict);
  mock('Copywriter', { output: V.draftV5() });
  mock('Critic', { output: V.critique });
  const pcq = await run('Parse Critique', store['Critic']);
  console.log('   critique ->', pcq[0].json.critique.score, pcq[0].json.critique.verdict, '| problems', pcq[0].json.critique.problems.length);
  const qa1 = await run('Content QA', pcq, { runIndex: 0 });
  console.log('   QA v5 ->', JSON.stringify({ score: qa1[0].json.content_qa.content_score, breakdown: qa1[0].json.content_qa.score_breakdown, coverage: qa1[0].json.content_qa.coverage_pct, missing: qa1[0].json.content_qa.missing_terms, banned: qa1[0].json.content_qa.banned_phrases.map(b => b.phrase), readability: qa1[0].json.content_qa.readability, specificity: qa1[0].json.content_qa.specificity_per_100_words, sources: qa1[0].json.content_qa.sources_cited.map(s => s.host) }));
  console.log('   QA round 1 ->', JSON.stringify({ passed: qa1[0].json.content_qa.passed, main_words: qa1[0].json.content_qa.main_content_words, faq: qa1[0].json.content_qa.faq_count, internal_links: qa1[0].json.content_qa.internal_links, external: qa1[0].json.content_qa.external_links, answer_words: qa1[0].json.content_qa.answer_block_words }));
  console.log('   QA fixes ->', JSON.stringify(qa1[0].json.content_qa.auto_fixes));
  console.log('   QA warnings ->', JSON.stringify(qa1[0].json.content_qa.warnings));
  console.log('   placeholder word still present?', /placeholder/i.test(qa1[0].json.output), '| AED price still present?', /AED\s?\d/.test(qa1[0].json.output), '| gartner link kept?', /gartner/.test(qa1[0].json.output), '| pricing link removed?', !/\/pricing\//.test(qa1[0].json.output));
  // Editor returns a corrected draft -> QA round 2
  mock('Editor', { output: V.draftV5({ longTitle: true }) });
  const qa2 = await run('Content QA', store['Editor'], { runIndex: 1 });
  console.log('   QA round 2 ->', 'round', qa2[0].json.qa_round, '| passed', qa2[0].json.content_qa.passed, '| score', qa2[0].json.content_qa.content_score, '| critic carried', qa2[0].json.content_qa.critic_score, '| warnings', qa2[0].json.content_qa.warnings.length);
  const wf = await run('Build Word File', qa2);
  const doc = decode(wf); save('keyword-report.doc.html', doc); scanHtml('keyword report+content', doc);
  console.log('   word file ->', wf[0].json.file_name, '| report_type:', wf[0].json.report_type, '| qa_summary:', wf[0].json.qa_summary);
  console.log('   JSON-LD blocks in doc:', (doc.match(/application\/ld\+json/g) || []).length, '| has FAQPage:', /FAQPage/.test(doc), '| has Service schema:', /"@type": "Service"/.test(doc));
  const prep = await run('Prepare PDF Report', wf);
  console.log('   prepare pdf -> binaries', Object.keys(prep[0].binary).join(','), '| html name', prep[0].binary.html.fileName, '| ledger', JSON.stringify(wf[0].json.run_ledger));
  mock('Render PDF Report', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const att = await run('Attach PDF Report', store['Render PDF Report']);
  console.log('   attach pdf ->', JSON.stringify({ pdf_ready: att[0].json.pdf_ready, pdf_file_name: att[0].json.pdf_file_name, binaries: Object.keys(att[0].binary) }));
  mock('Render PDF Report', [{ json: { error: { message: 'connect ECONNREFUSED gotenberg:3000' } } }]);
  const att2 = await run('Attach PDF Report', store['Render PDF Report']);
  console.log('   attach pdf (renderer down) -> pdf_ready', att2[0].json.pdf_ready, '| binaries', Object.keys(att2[0].binary).join(','), '| error', att2[0].json.pdf_error);
  const bp = await run('Blog Package', att);
  const bm = bp[0].json.article_meta;
  console.log('   blog package ->', JSON.stringify({ binaries: Object.keys(bp[0].binary), slug: bp[0].json.article_slug, title: bm.title, h1: bm.h1, desc_len: bm.meta_description_length, words: bm.word_count, score: bm.content_score, headings: bm.headings.length, internal_links: bm.internal_links.length, external_links: bm.external_links.length, schema: bm.schema_blocks.map(b => b.type), url: bm.suggested_url, checklist: bm.publish_checklist.length, pdf_kept: !!bp[0].binary.pdf }));
  const bhtml = Buffer.from(bp[0].binary.article_html.data, 'base64').toString('utf8'); const bmd = Buffer.from(bp[0].binary.article_md.data, 'base64').toString('utf8');
  console.log('   image plan ->', JSON.stringify({ images: bm.images.map(i => [i.slot, i.purpose, i.filename, i.alt_text.length]), featured: bm.featured_image && bm.featured_image.filename, og: bm.open_graph['og:image'], figures_html: (bhtml.match(/<figure>/g) || []).length, figures_md: (bmd.match(/^!\[/gm) || []).length, hero_first: /<h1>[^<]*<\/h1>\n<figure>/.test(bhtml) }));
  console.log('   article html ->', bhtml.length, 'chars | h1:', (bhtml.match(/<h1>/g) || []).length, '| h2:', (bhtml.match(/<h2>/g) || []).length, '| tables:', (bhtml.match(/<table>/g) || []).length, '| ld+json:', (bhtml.match(/ld\+json/g) || []).length, '| meta lines leaked?', /^(Title|Meta Description|Slug):/m.test(bhtml), '| md starts with H1?', /^# /.test(bmd), '| md meta lines leaked?', /^(Title|Meta Description|Slug):/m.test(bmd));
  save('blog-package-article.html', bhtml); save('blog-package-article.md', bmd); save('blog-package-meta.json', JSON.stringify(bm, null, 2)); scanHtml('blog package article', bhtml);
  const bp0 = await run('Blog Package', [{ json: { keyword: 'x', verdict: 'AVOID' }, binary: { data: { data: 'AA==', mimeType: 'text/html' } } }]); console.log('   no content passes through ->', !bp0[0].json.article_meta, Object.keys(bp0[0].binary).join(','));
  const wr = await run('Build Webhook Response', bp);
  console.log('   webhook response keys ->', Object.keys(wr[0].json).join(','), '| file bytes (b64):', wr[0].json.file && wr[0].json.file.data.length, '| pdf:', wr[0].json.pdf && wr[0].json.pdf.fileName, '| markdown:', wr[0].json.markdown && wr[0].json.markdown.length, '| html:', wr[0].json.html && wr[0].json.html.length, '| meta title:', wr[0].json.meta && wr[0].json.meta.title);

  // Truncated copywriter output (max_tokens hit)
  begin('S1b Keyword — truncated Copywriter output (4096-token cap simulation)');
  mock('Copywriter', { output: F.draft({ truncate: true }) });
  mock('Critic', { output: '```json\n{"score": 30, "verdict": "rewrite", "problems": [], "revision_instructions": "Finish the draft."}\n```' });
  await run('Parse Critique', store['Critic']);
  const qat = await run('Content QA', store['Parse Critique'], { runIndex: 0 });
  console.log('   truncated QA ->', JSON.stringify({ passed: qat[0].json.content_qa.passed, main_words: qat[0].json.content_qa.main_content_words, faq: qat[0].json.content_qa.faq_count, warnings: qat[0].json.content_qa.warnings.length }));

  // AVOID verdict path -> Build Word File directly (no content)
  begin('S1c Keyword — AVOID verdict goes straight to report');
  mock('Verdict Agent', { output: F.verdictAvoid });
  const pva = await run('Parse Verdict', store['Verdict Agent']);
  const wfa = await run('Build Word File', pva);
  const doca = decode(wfa); save('keyword-avoid.doc.html', doca); scanHtml('avoid report', doca);
  console.log('   avoid ->', wfa[0].json.report_type, wfa[0].json.file_name, '| verdict in doc:', /AVOID/.test(doca));

  // No competitors in SERP
  begin('S1d Keyword — SERP returned nothing');
  mock('SERP Top 10', F.serpEmpty);
  const t0 = await run('Pick Top 6', store['SERP Top 10']);
  console.log('   pick top 6 (empty) ->', JSON.stringify(t0[0].json));
  mock('Read Competitor Pages', [{ error: { message: 'Invalid URL' } }]);
  delete store['Retry Blocked Pages']; delete store['Blocked Page Items'];
  const fb0 = await run('Find Blocked Pages', store['Read Competitor Pages']);
  console.log('   blocked (empty serp) ->', fb0[0].json.blocked_count);
  const cc0 = await run('Analyze Competitor Pages', store['Read Competitor Pages']);
  console.log('   clean (empty) -> competitors_read', cc0[0].json.competitors_read, '| avg', cc0[0].json.avg_competitor_words, '| digest empty?', !cc0[0].json.competitor_digest.trim());
  mock('Keyword Data', F.keywordOverviewEmpty);
  mock('Parse Analysis', { ...store['Analyze Competitor Pages'][0].json, competitor_analysis: F.competitorAnalysis });
  const mk0 = await run('Merge Keyword Data', store['Keyword Data']);
  console.log('   merged (empty kw data) ->', JSON.stringify(mk0[0].json.keyword_data));
});

// ===================================================================================
await guard('verdict', async () => {
  reset(); begin('S2 Verdict-only mode (form)');
  mock('Start Form', F.forms.startVerdict);
  const n = await run('Normalize Input', F.forms.pageVerdict);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, verdict_only: n[0].json.verdict_only, include_seo_report: n[0].json.include_seo_report, include_content: n[0].json.include_content, need_site_description: n[0].json.need_site_description, domain: n[0].json.domain }));
  mock('Route Mode', n);
  await run('Prepare Keyword Run', n);
  mock('Fetch Sitemaps', []);
  const cu = await run('Collect Site URLs', []);
  console.log('   collect (no domain) ->', JSON.stringify({ sitemap_ok: cu[0].json.sitemap_ok, candidates: cu[0].json.internal_link_candidates.length, existing: cu[0].json.existing_page }));
});

// ===================================================================================
await guard('describe', async () => {
  reset(); begin('S3 Describe mode');
  mock('Start Form', F.forms.startDescribe);
  const n = await run('Normalize Input', F.forms.pageDescribe);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, country: n[0].json.country, need_site_description: n[0].json.need_site_description }));
  await run('Rate Limit');
  mock('Read Website', { error: { message: 'timeout of 30000ms exceeded' } });
  const cs = await run('Clean Site Text', store['Read Website']);
  console.log('   read failed -> read_ok', cs[0].json.read_ok, '| site_text len', cs[0].json.site_text.length, '(Site Describer would still be called with empty text)');
  const fb = await run('Describe Fallback', cs);
  console.log('   fallback ->', JSON.stringify({ failed: fb[0].json.site_read_failed, name: fb[0].json.site_description.business_name }));
  const bp = await run('Build Description Page', fb);
  console.log('   warning shown on page?', /could not read/.test(bp[0].json.result_html));
  const dr = await run('Build Describe Response', bp);
  console.log('   describe callback ->', dr[0].json.stage, '| html', !!dr[0].json.html);
  save('description-page.html', bp[0].json.result_html); scanHtml('description page', bp[0].json.result_html);
});

// ===================================================================================
await guard('discover', async () => {
  reset(); begin('S4 Discover mode -> keyword ideas -> chained content run');
  mock('Start Form', F.forms.startDiscover);
  const n = await run('Normalize Input', F.forms.pageDiscover);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, include_content: n[0].json.include_content, include_seo_report: n[0].json.include_seo_report, include_audit: n[0].json.include_audit, audit_level: n[0].json.audit_level, need_site_description: n[0].json.need_site_description }));
  mock('Route Mode', n);
  mock('Keyword Seeds', { output: { primary_seed: 'erp implementation services', seed_groups: { services: ['erp implementation services', 'odoo implementation', 'dynamics 365 business central partner', 'erp customisation'], problems: ['inventory software for distributors', 'replace excel stock control'], comparisons: ['best erp for distributors', 'odoo vs dynamics 365'], pricing: ['erp implementation cost', 'odoo pricing uae'], local: ['erp implementation dubai', 'erp company abu dhabi'], audience: ['erp for wholesale distributors', 'northwind erp reviews'] }, services: ['ERP implementation', 'Data migration'] } });
  const sl = await run('Seed List', store['Keyword Seeds']);
  console.log('   seeds ->', sl[0].json.seeds.length, 'seeds | primary', sl[0].json.primary_seed, '| groups', Object.keys(sl[0].json.seed_groups).join(','));
  const rr = await run('Research Requests', sl);
  console.log('   research requests ->', rr.map(r => r.json.kind).join(','));
  mock('Run Research', V.runResearch(rr.map(r => r.json)));
  const ckr = await run('Competitor Keyword Requests', store['Run Research']);
  console.log('   competitor requests ->', ckr.map(r => r.json.kind + ':' + (r.json.domain || '-')).join(','));
  mock('Run Competitor Keywords', V.runCompetitorKeywords(ckr.map(r => r.json)));
  const col = await run('Collect Research', store['Run Competitor Keywords']);
  console.log('   pool ->', JSON.stringify({ pool: col[0].json.research.pool_size, candidates: col[0].json.research.candidates.length, by_source: col[0].json.research.by_source, failures: col[0].json.research.failures, top3: col[0].json.research.candidates.slice(0, 3).map(k => k.keyword + ' ' + k.pre_score) }));
  const ch = await run('Relevance Chunks', col);
  console.log('   chunks ->', ch.map(c => c.json.chunk_size).join(','));
  mock('Keyword Relevance', ch.map(c => V.relevance(c.json)));
  const rk = await run('Rank Keywords', store['Keyword Relevance']);
  const kst = rk[0].json.keyword_strategy;
  console.log('   ranked ->', JSON.stringify({ relevant: kst.total_relevant, reviewed: kst.ai_reviewed, clusters: kst.clusters.slice(0, 5).map(c => c.tier + ':' + c.topic + '(' + c.keyword_count + ')'), quick: kst.quick_wins.length, questions: kst.questions.length, gaps: kst.competitor_gaps.length, priority: kst.priority.map(k => k.keyword), pipeline: kst.pipeline_keyword && kst.pipeline_keyword.keyword }));
  mock('AI Demand', V.aiDemand(kst.keywords.map(k => k.keyword)));
  const pk = await run('Priority Keywords', store['AI Demand']);
  mock('Candidate SERP', pk.map(p => F.aiSerp({ type: 'category', query: p.json.keyword })));
  const ks = await run('Build Keyword Strategy', store['Candidate SERP']);
  console.log('   strategy ->', JSON.stringify({ recommended0: ks[0].json.keyword_suggestions.recommended[0].keyword, ai: ks[0].json.keyword_strategy.ai_demand.available, live0: ks[0].json.keyword_strategy.priority[0].live, clusters: ks[0].json.keyword_suggestions.topic_clusters.length }));
  save('keyword-strategy.html', ks[0].json.result_html); scanHtml('keyword strategy page', ks[0].json.result_html);
  console.log('   choice options ->', ks[0].json.choice_options.length, '|', ks[0].json.choice_options[1]);
  const ch1 = await run('Apply Choice', { 'Which keyword should we write for?': ks[0].json.choice_options[2], submittedAt: '2026-10-01T10:00:00.000Z', formMode: 'production' });
  console.log('   user choice ->', ch1[0].json.chosen_by, '|', ch1[0].json.chosen_keyword, '| equals priority[1]?', ch1[0].json.chosen_keyword === ks[0].json.keyword_strategy.priority[1].keyword, '| recommended[0]:', ch1[0].json.keyword_suggestions.recommended[0].keyword, '| html updated?', /Your choice/.test(ch1[0].json.result_html));
  const ch2 = await run('Apply Choice', { 'Which keyword should we write for?': 'Let the system choose for my goal' });
  console.log('   system choice ->', ch2[0].json.chosen_by, '|', ch2[0].json.chosen_keyword === ks[0].json.keyword_strategy.pipeline_keyword.keyword);
  store['Build Keyword Strategy'] = ch1;   // the file/email/content steps see the user's pick
  const kf0 = await run('Build Keyword File', ks);
  await run('Prepare PDF Ideas', kf0); mock('Render PDF Ideas', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const kf = await run('Attach PDF Ideas', store['Render PDF Ideas']);
  console.log('   ideas pdf ->', kf[0].json.pdf_file_name, '| ledger calls', kf[0].json.run_ledger.dataforseo_calls);
  const ir = await run('Build Ideas Response', kf);
  console.log('   ideas callback ->', JSON.stringify({ stage: ir[0].json.stage, start_with: ir[0].json.start_with && ir[0].json.start_with.keyword, priority: ir[0].json.priority.length, plan: ir[0].json.content_plan.length, pdf_b64: ir[0].json.pdf && ir[0].json.pdf.data.length, follow_ups: ir[0].json.follow_ups }));
  const kdoc = decode(kf); save('keyword-ideas.doc.html', kdoc); scanHtml('keyword ideas doc', kdoc);
  console.log('   keyword file ->', kf[0].json.file_name, '| note present:', /will be emailed/.test(kdoc));
  const sfu = await run('Spawn Follow-ups', kf);
  console.log('   follow-ups ->', sfu.length, '|', sfu.map(i => i.json.body.mode + ':' + (i.json.body.keyword || i.json.body.report_type)).join(' | '), '| keyword = recommended[0]?', sfu[0].json.body.keyword === kf[0].json.keyword_suggestions.recommended[0].keyword, '| receive', JSON.stringify(sfu[0].json.body.receive), '| chosen_by', sfu[0].json.body.chosen_by);
  delete store['Start Form'];
  const nsf = await run('Normalize Input', sfu[0]);
  console.log('   spawned keyword run ->', JSON.stringify({ mode: nsf[0].json.mode, via_webhook: nsf[0].json.via_webhook, keyword: nsf[0].json.keyword, include_content: nsf[0].json.include_content, include_seo_report: nsf[0].json.include_seo_report, pipeline_source: nsf[0].json.pipeline_source, reason: nsf[0].json.chosen_keyword_reason.slice(0, 40), err: nsf[0].json.validation_error }));
  const rlsf = await run('Rate Limit', nsf); console.log('   spawned run estimate ->', rlsf[0].json.ai_spend_estimate_usd);
  const nsa = await run('Normalize Input', sfu[1]);
  console.log('   spawned audit run ->', JSON.stringify({ mode: nsa[0].json.mode, audit_level: nsa[0].json.audit_level, email: nsa[0].json.email, err: nsa[0].json.validation_error }));
  mock('Start Form', F.forms.startDiscover);
  await run('Prepare Keyword Run', nsf); console.log('   pipeline_source kept ->', store['Prepare Keyword Run'][0].json.pipeline_source);
  // Pick Top 6 falls back to $('Route Mode') for domain in this chained path
  mock('SERP Top 10', F.serpTop);
  const top = await run('Pick Top 6', store['SERP Top 10']);
  console.log('   chained pick top 6 -> own domain excluded?', !top.some(t => t.json.domain === F.OUR));
});

// ===================================================================================
await guard('audit-full', async () => {
  reset(); begin('S5 Audit mode — Full SEO Report');
  mock('Start Form', F.forms.startAudit);
  const n = await run('Normalize Input', F.forms.pageAuditFull);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, audit_level: n[0].json.audit_level, competitors: n[0].json.competitors, include_full_report: n[0].json.include_full_report, language_code: n[0].json.language_code }));
  mock('Route Mode', n);
  const sar = await run('Spawn Audit Run', n);
  console.log('   form audit spawns ->', JSON.stringify(sar[0].json.body).slice(0, 200));
  delete store['Start Form'];
  const nsar = await run('Normalize Input', sar[0]); console.log('   spawned audit normalised ->', JSON.stringify({ mode: nsar[0].json.mode, via_webhook: nsar[0].json.via_webhook, include_full_report: nsar[0].json.include_full_report, competitors: nsar[0].json.competitors, email: nsar[0].json.email, err: nsar[0].json.validation_error }));
  mock('Start Form', F.forms.startAudit);
  await expectError('Save Task ID', F.crawlTaskPostFail, /Could not start site crawl/);
  await run('Save Task ID', F.crawlTaskPost);
  const c1 = await run('Check Crawl', F.summaryRunning, { runIndex: 0 });
  console.log('   crawl poll 1 ->', c1[0].json.crawl_finished, c1[0].json.crawl_progress, c1[0].json.pages_crawled);
  const c2 = await run('Check Crawl', F.summaryDone, { runIndex: 3 });
  console.log('   crawl poll 2 ->', c2[0].json.crawl_finished, '| pages_crawled', c2[0].json.pages_crawled);
  await expectError('Check Crawl', F.summaryRunning, /too long/, 26) || null;
  H.results[H.results.length - 1].node = 'Check Crawl (timeout guard)';
  store['Check Crawl'] = c2;
  mock('Get Crawled Pages', F.crawledPagesRes);
  const cer = await run('Crawl Extra Requests', store['Get Crawled Pages']);
  console.log('   extra requests ->', cer.map(i => i.json.extra).join(','));
  mock('Run Crawl Extras', F.extrasRes);
  const cce = await run('Collect Crawl Extras', store['Run Crawl Extras']);
  console.log('   extras ->', JSON.stringify({ dup_titles: cce[0].json.crawl_extras.duplicate_title.length, non_indexable: cce[0].json.crawl_extras.non_indexable.length, errors: cce[0].json.crawl_extras.errors }));
  const hostP = await run('Build Probes', cce);
  const contP = await run('Content Probes', cce);
  console.log('   probes ->', hostP.length, 'host +', contP.length, 'content');
  const all0 = F.probeResults('apex');
  mock('Run Probes', [all0[0], all0[2], all0[3], all0[4]]);
  mock('Run Content Probes', [all0[0], all0[1], all0[5], all0[6], all0[7], all0[8], ...all0.slice(9)]);
  const ap = await run('Analyze Probes', store['Run Content Probes']);
  console.log('   probe findings ->', ap[0].json.probe.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  console.log('   probe works ->', ap[0].json.probe.what_works.join(' | '));
  console.log('   measurements ->', JSON.stringify(ap[0].json.probe.measurements));
  const pk = await run('Pick Key Pages', ap);
  console.log('   key pages ->', pk.map(p => p.json.kind + ':' + p.json.url.replace('https://northwind-erp.com', '')).join(' '));
  mock('Fetch Page HTML', F.pageHtmlResults(pk.map(p => p.json)));
  const ah = await run('Analyze HTML', store['Fetch Page HTML']);
  console.log('   html findings ->', ah[0].json.html_analysis.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  console.log('   html works ->', ah[0].json.html_analysis.works.join(' | '));
  const utc = await run('URLs To Check', ah);
  console.log('   urls to check ->', utc.map(u => u.json.purpose + ' ' + u.json.url).join(' | '));
  mock('Check Schema URLs', F.headResults(utc.map(u => u.json)));
  const sf = await run('Schema Findings', store['Check Schema URLs']);
  console.log('   schema url findings ->', sf[0].json.extra_findings.filter(f => /URL is broken/.test(f.title)).map(f => `[${f.severity}] ${f.title}`).join(' | '));
  mock('Find Competitors', F.labsCompetitors);
  const fq = await run('Fallback Queries', store['Find Competitors']);
  console.log('   fallback queries ->', fq.map(q => q.json.query).join(' | '));
  mock('Fallback SERP', fq.map(q => F.aiSerp({ type: 'category', query: q.json.query })));
  const pc = await run('Pick Competitors', store['Fallback SERP']);
  console.log('   competitors ->', pc.map(c => c.json.domain + (c.json.is_you ? '(you)' : '')).join(', '), '| method:', pc[1] && pc[1].json.method);
  mock('Domain Overview', pc.map(c => F.rankOverview(c.json.domain)));
  mock('DataForSEO Whois', pc.map(c => F.whois(c.json.domain)));
  mock('RDAP Lookup', pc.map(c => c.json.domain === 'gulferp.ae' ? { objectClassName: 'domain', events: [{ eventAction: 'registration', eventDate: '2015-06-01T00:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-06-01T00:00:00Z' }] } : { errorCode: 404, title: 'Not Found' }));
  const ca = await run('Competitor Analysis', store['RDAP Lookup']);
  console.log('   benchmark rows ->', JSON.stringify(ca[0].json.competitor_benchmark.rows.map(r => ({ d: r.domain, kw: r.organic_keywords, top10: r.top10, age: r.domain_age_years }))));
  console.log('   benchmark findings ->', ca[0].json.extra_findings.filter(f => f.category === 'Authority').map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const kt = await run('KW Targets', ca);
  mock('Ranked Keywords', kt.map(t => F.ranked(t.json.domain)));
  mock('Keyword Ideas', F.keywordIdeas);
  const ak = await run('Analyze Keywords', store['Keyword Ideas']);
  console.log('   keywords ->', JSON.stringify({ domains: ak[0].json.site_keywords.domains.map(d => d.domain + ':' + d.total + '/' + d.top10), gap: ak[0].json.site_keywords.keyword_gap.length, easy: ak[0].json.site_keywords.easy_wins.length, striking: ak[0].json.site_keywords.striking_distance.map(k => k.keyword) }));
  await run('BL Targets', ak);
  mock('Backlink Summary', store['BL Targets'].map(t => F.backlinkSummary(t.json.domain)));
  mock('Backlink Gap', F.backlinkGap);
  const ab = await run('Analyze Backlinks', store['Backlink Gap']);
  console.log('   backlinks ->', JSON.stringify({ available: ab[0].json.authority.available, you: ab[0].json.authority.rows.find(r => r.is_you), gap: ab[0].json.authority.gap.map(g => g.referring_domain + 'x' + g.links_to_competitors) }));
  const ps = await run('PS Targets', ab);
  mock('PageSpeed', ps.map(t => F.psi(t.json.domain)));
  const aps = await run('Analyze PageSpeed', store['PageSpeed']);
  console.log('   pagespeed ->', JSON.stringify(aps[0].json.pagespeed.rows.map(r => ({ d: r.domain, score: r.score, lcp: r.field.lcp, avail: r.available }))));
  console.log('   perf findings ->', aps[0].json.extra_findings.filter(f => f.category === 'Performance').map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const ch = await run('Competitor Homes', aps);
  mock('Read Competitor Homes', ch.map((c, i) => ({ page_text: F.compPage(i, 300) })));
  const bcp = await run('Build Content Prompt', store['Read Competitor Homes']);
  console.log('   content prompt ->', JSON.stringify({ skip: bcp[0].json.content_skip, pages_read: bcp[0].json.content_pages_read, our_len: bcp[0].json.content_prompt_our.length, comp_len: bcp[0].json.content_prompt_comp.length }));
  mock('Content Reviewer', { output: F.contentReview });
  const pcr = await run('Parse Content Review', store['Content Reviewer']);
  console.log('   content review findings ->', pcr[0].json.extra_findings.filter(f => f.source === 'ai_review').map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const aq = await run('AI Queries', pcr);
  console.log('   ai queries ->', aq.map(q => q.json.type + ':"' + q.json.query + '"').join(' | '), '| brand:', aq[0].json.brand_name);
  mock('AI SERP', aq.map(q => F.aiSerp(q.json)));
  const lp = await run('LLM Prompts', store['AI SERP']);
  console.log('   llm prompts ->', lp.map(p => p.json.platform + '/' + p.json.kind).join(', '), '| rec prompt:', lp[1].json.prompt.slice(0, 120));
  mock('Ask LLMs', F.llmAnswers(lp.map(p => p.json)));
  const av = await run('AI Visibility', store['Ask LLMs']);
  console.log('   ai visibility ->', JSON.stringify({ brand: av[0].json.ai_visibility.brand_name, index_est: av[0].json.ai_visibility.index_estimate, llm: av[0].json.ai_visibility.llm_answers.map(l => l.platform + ':' + (l.ok ? (l.mentions_you ? 'mentions' : 'no-mention') : 'ERR')), queries: av[0].json.ai_visibility.queries.map(q => q.type + ':' + (q.ai_overview ? 'AIO' : '-') + ':' + q.your_position) }));
  console.log('   ai findings ->', av[0].json.extra_findings.filter(f => f.category === 'AI Search Readiness' || /indexed/.test(f.title)).map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const gf5 = await runGscAudit(av, 'ok');
  const bsi = await run('Build Site Issues', gf5);
  console.log('   site_audit carries search console? ->', !!bsi[0].json.site_audit.search_console, '| structure?', !!bsi[0].json.site_audit.site_structure, '| not assessed:', bsi[0].json.site_audit.not_assessed.length);
  const a = bsi[0].json.site_audit;
  console.log('   findings by severity (scored only) ->', JSON.stringify(a.findings.filter(f => f.scoring !== false).reduce((m, f) => (m[f.severity] = (m[f.severity] || 0) + 1, m), {})));
  console.log('   SITE AUDIT ->', JSON.stringify({ score: a.health_score, raw: a.raw_score, cap: a.score_cap, grade: a.grade, counts: a.issue_counts, cats: a.category_scores, not_assessed: a.not_assessed }));
  console.log('   top findings ->', a.findings.slice(0, 12).map(f => `[${f.severity}/${f.category}] ${f.title}`).join('\n      '));
  console.log('   total findings', a.findings.length, '| what works', a.what_works.length, '| notes', JSON.stringify(a.notes));
  const bfr0 = await run('Build Full Report', bsi);
  await run('Prepare PDF Audit', bfr0); mock('Render PDF Audit', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const bfr = await run('Attach PDF Audit', store['Render PDF Audit']);
  const ar = await run('Build Audit Response', bfr);
  console.log('   audit callback ->', JSON.stringify({ stage: ar[0].json.stage, score: ar[0].json.health_score, pdf_b64: ar[0].json.pdf && ar[0].json.pdf.data.length, doc_b64: ar[0].json.file && ar[0].json.file.data.length }));
  console.log('   full report ledger ->', JSON.stringify(bfr[0].json.run_ledger), '| pdf', bfr[0].json.pdf_file_name);
  const fdoc = decode(bfr); save('full-seo-report.doc.html', fdoc); scanHtml('full report', fdoc);
  console.log('   full report ->', bfr[0].json.file_name, '| subject data:', JSON.stringify({ score: bfr[0].json.health_score, grade: bfr[0].json.grade, top: bfr[0].json.top_issues.slice(0, 3) }));

  // apex -> www redirect variant (false positive check)
  begin('S5b Audit — site whose apex 301s to www');
  const allw = F.probeResults('www');
  mock('Run Probes', [allw[0], allw[2], allw[3], allw[4]]);
  mock('Run Content Probes', [allw[2], allw[2], allw[5], allw[6], allw[7], allw[8], ...allw.slice(9)]);
  const apw = await run('Analyze Probes', store['Run Content Probes']);
  console.log('   canonical host ->', apw[0].json.canonical_host);
  console.log('   www-variant probe findings ->', apw[0].json.probe.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  console.log('   www-variant works ->', apw[0].json.probe.what_works.join(' | '));
});

// ===================================================================================
await guard('audit-tech', async () => {
  reset(); begin('S6 Audit mode — technical Site Audit only (Germany)');
  mock('Start Form', F.forms.startAudit);
  const n = await run('Normalize Input', F.forms.pageAuditTech);
  console.log('   ->', JSON.stringify({ audit_level: n[0].json.audit_level, location_code: n[0].json.location_code, language_code: n[0].json.language_code, language_name: n[0].json.language_name }));
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
  const gf6 = await runGscAudit(ap, 'denied');
  const bsi = await run('Build Site Issues', gf6);
  const a = bsi[0].json.site_audit;
  console.log('   not assessed (denied) ->', a.not_assessed.filter(x => /Search Console/.test(x)).length === 1, '| info finding unscored?', a.findings.some(f => /Search Console not connected/.test(f.title) && f.scoring === false));
  const gf6b = await runGscAudit(ap, 'nosm'); console.log('   no sitemap.xml ->', gf6b[0].json.extra_findings.map(f => f.title).filter(t => /sitemap/i.test(t)).join(' | '));
  console.log('   SITE AUDIT (tech) ->', JSON.stringify({ score: a.health_score, raw: a.raw_score, cap: a.score_cap, grade: a.grade, counts: a.issue_counts, cats: a.category_scores }));
  console.log('   findings ->', a.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const bar = await run('Build Audit Report', bsi);
  const adoc = decode(bar); save('site-audit-report.doc.html', adoc); scanHtml('site audit report', adoc);
  console.log('   report has SC section? ->', /Search Console &amp; Site Structure/.test(adoc), '| structure table?', /Clicks from home/.test(adoc), '| callback fields ->', JSON.stringify({ sc: bar[0].json.search_console ? bar[0].json.search_console.connected : 'none', st: !!bar[0].json.site_structure }));
  console.log('   audit report ->', bar[0].json.file_name);
});

// ===================================================================================
let ladderRows = null; let trendRows = null; let queryRows = null;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
await guard('ladder', async () => {
  reset(); begin('S7 Ladder mode — verdict, rungs, link map, report, Data Table rows, page runs');
  mock('Start Form', F.forms.startLadder);
  const bad = await run('Normalize Input', F.forms.pageLadderNoEmail); console.log('   no email ->', JSON.stringify(bad[0].json.validation_error));
  const n = await run('Normalize Input', F.forms.pageLadder);
  const j = n[0].json;
  console.log('   form ladder ->', JSON.stringify({ mode: j.mode, keyword: j.keyword, domain: j.domain, pages_now: j.pages_now, ladder_id: /^lad_/.test(j.ladder_id), include_content: j.include_content, need_site_description: j.need_site_description, run_page_check: j.run_page_check, business: j.business, email: j.email, tracker: j.tracker_cadence, wp: j.publish_wordpress }));
  H.staticData.rate = undefined; H.staticData.ai_budget = undefined;
  const rl = await run('Rate Limit', n); console.log('   rate limit est ->', rl[0].json.ai_spend_estimate_usd, '| error:', rl[0].json.validation_error || 'none');
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'ladder', keyword: 'E Invoicing in UAE', country: 'AE', domain: 'techand.ai', business: 'ERP partner', pages_now: 2, callback_url: 'https://hooks.example.com/x' } });
  console.log('   api ladder ->', JSON.stringify({ mode: na[0].json.mode, pages_now: na[0].json.pages_now, via_webhook: na[0].json.via_webhook, err: na[0].json.validation_error }));
  const np = await run('Normalize Input', { body: { mode: 'keyword', keyword: 'peppol e invoicing uae', page_type: 'Guide', country: 'United Arab Emirates', domain: 'northwind-erp.com', business: 'x', customers: 'y', business_facts: 'f', cta: 'Book', tone: 'Bold and confident', goal: 'Get leads and enquiries', receive: ['Keyword Report', 'Page Content'], email: 'o@e.com', force_content: true, ladder_id: 'lad_1', ladder_rung: 1, ladder_head: 'e invoicing in uae', ladder_links: [{ url: 'https://northwind-erp.com/e-invoicing-in-uae/', path: '/e-invoicing-in-uae/', role: 'top', keyword: 'e invoicing in uae', planned: true }, { url: 'https://northwind-erp.com/services/odoo-erp/', path: '/services/odoo-erp/', role: 'sibling', planned: false }] } });
  const pj = np[0].json;
  console.log('   page run ->', JSON.stringify({ mode: pj.mode, force_content: pj.force_content, ladder_id: pj.ladder_id, rung: pj.ladder_rung, head: pj.ladder_head, links: pj.ladder_links.length, include_content: pj.include_content, include_seo_report: pj.include_seo_report, business: pj.business, facts: pj.business_facts, cta: pj.cta, page_type: pj.page_type, err: pj.validation_error }));
  // ladder links become internal-link candidates (brief + QA allow them) on a page run
  await run('Prepare Keyword Run', np); console.log('   page run pipeline_source ->', store['Prepare Keyword Run'][0].json.pipeline_source);
  mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
  const cuP = await run('Collect Site URLs', store['Fetch Sitemaps']);
  const cand = cuP[0].json.internal_link_candidates;
  console.log('   candidates ->', cand.slice(0, 4).map(c => (c.ladder ? '[' + c.ladder + '] ' : '') + c.path).join(' | '), '| planned top present?', cand.some(c => c.ladder === 'top' && c.planned), '| sibling deduped?', cand.filter(c => /odoo-erp/.test(c.url)).length === 1);
  // ladder run base: keyword pipeline up to the verdict on the head term
  mock('Start Form', F.forms.startLadder); mock('Route Mode', n);
  await run('Prepare Keyword Run', n); console.log('   ladder pipeline_source ->', store['Prepare Keyword Run'][0].json.pipeline_source);
  const cu = await run('Collect Site URLs', store['Fetch Sitemaps']);
  mock('Parse Analysis', { ...cu[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
  mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
  await run('Merge Keyword Data', store['Site Authority']);
  mock('Verdict Agent', { output: { ...F.verdictGo, what_must_change: ['Earn 20+ referring domains', 'Consider "e invoicing software uae" first'], expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
  const pv = await run('Parse Verdict', store['Verdict Agent']);
  console.log('   verdict base -> mode', pv[0].json.mode, '| site_urls', pv[0].json.site_urls.length, '| authority', JSON.stringify(pv[0].json.site_authority));
  const lr = await run('Ladder Requests', pv);
  console.log('   ladder requests ->', lr.map(r => r.json.kind + (r.json.body[0].limit ? ':' + r.json.body[0].limit : '')).join(', '), '| ideas seeds:', JSON.stringify(lr[2].json.body[0].keywords));
  mock('Run Ladder Research', lr.map(() => ({ error: { message: 'Node does not have any credentials set' } })));
  await expectError('Ladder Pool', store['Run Ladder Research'], /every research pull failed/);
  mock('Run Ladder Research', V.ladderResearch(lr.map(r => r.json)));
  const lp = await run('Ladder Pool', store['Run Ladder Research']);
  const R = lp[0].json.research;
  console.log('   pool ->', JSON.stringify({ pool: R.pool_size, candidates: R.candidates.length, by_source: R.by_source, failures: R.failures, rankings: lp[0].json.site_rankings.count, head_rank: lp[0].json.site_rankings.head, head_tokens: lp[0].json.head_tokens, head_geo: lp[0].json.head_geo }));
  console.log('   head excluded from candidates?', !R.candidates.some(c => c.keyword === 'e invoicing in uae'), '| brand excluded?', !R.candidates.some(c => /northwind/.test(c.keyword)), '| top3:', R.candidates.slice(0, 3).map(c => c.keyword + ' kd' + c.kd + ' v' + c.volume + (c.your_position ? ' #' + c.your_position : '')).join(' | '));
  const ch = await run('Ladder Relevance Chunks', lp);
  console.log('   chunks ->', ch.map(c => c.json.chunk_size).join(','), '| business mentions ladder?', /KEYWORD LADDER/.test(ch[0].json.business));
  mock('Ladder Keyword Relevance', ch.map(c => V.ladderRelevance(c.json)));
  const plan = await run('Ladder Plan', store['Ladder Keyword Relevance']);
  const L = plan[0].json.ladder;
  const bandOk = L.rungs.every(r => r.pages.every(p => { const kd = p.kd == null ? 35 : p.kd; return r.rung === 1 ? (kd <= 25 && p.total_volume >= 20) : r.rung === 2 ? (kd <= 45) : (kd > 45 && kd <= 60); }));
  const rungPages = L.rungs.flatMap(r => r.pages);
  const linkOk = rungPages.every(p => p.links_to.some(l => l.role === 'top' && l.url === L.top.target_url)) && L.rungs.every(r => r.pages.length < 2 || r.pages.every(p => p.links_to.some(l => l.role === 'sibling'))) && L.top.links_to.length === rungPages.length;
  const monthsOk = L.timeline.every((t, i) => i === 0 ? t.months[0] === 1 : t.months[0] === L.timeline[i - 1].months[1] + 1);
  console.log('   LADDER ->', JSON.stringify({ status: L.feasibility.status, pages: L.stats.pages_total, per_rung: L.rungs.map(r => r.rung + ':' + r.pages.length + '/' + r.available), bands_ok: bandOk, links_ok: linkOk, link_map: L.link_map.length, months_ok: monthsOk, timeline: L.timeline.map(t => t.label + ' ' + t.months.join('-')), write_now: L.write_now.map(w => w.keyword), later: L.later.length, notes: L.notes, alternatives: L.feasibility.alternatives }));
  console.log('   top ->', JSON.stringify({ url: L.top.target_url, exists: L.top.exists, source: L.top.existing_source, your_position: L.top.your_position, kd: L.top.kd }), '| existing rung pages:', rungPages.filter(p => p.exists).map(p => p.keyword + '->' + p.target_url).join(' ; ') || 'none');
  console.log('   requirements ->', L.requirements.map(r => r.item).join(' | '));
  const rep = await run('Build Ladder Report', plan);
  const ldoc = decode(rep); save('ladder-plan.doc.html', ldoc); scanHtml('ladder plan', ldoc);
  console.log('   report ->', rep[0].json.file_name, '|', rep[0].json.report_type, '| ledger calls', rep[0].json.run_ledger.dataforseo_calls, '| slimmed?', rep[0].json.site_urls === undefined && !!rep[0].json.ladder);
  await run('Prepare PDF Ladder', rep); mock('Render PDF Ladder', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const att = await run('Attach PDF Ladder', store['Render PDF Ladder']);
  console.log('   pdf ->', att[0].json.pdf_file_name, '| binaries', Object.keys(att[0].binary).join(','));
  const rows = await run('Ladder Rows', att);
  const COLS = ['ladder_id', 'domain', 'head_keyword', 'rung', 'page_no', 'keyword', 'supporting', 'page_type', 'target_url', 'page_exists', 'status', 'months', 'start_date', 'country', 'location_code', 'language_code', 'email', 'callback_url', 'request_id'];
  console.log('   rows ->', rows.length, '| columns exact?', rows.every(r => JSON.stringify(Object.keys(r.json).sort()) === JSON.stringify(COLS.slice().sort())), '| statuses', JSON.stringify(rows.reduce((m, r) => (m[r.json.status] = (m[r.json.status] || 0) + 1, m), {})), '| top row rung', rows[rows.length - 1].json.rung);
  ladderRows = rows.map(r => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ...r.json } }));
  mock('Save Ladder Rows', ladderRows);
  const del = await run('Ladder Delivery', store['Save Ladder Rows']);
  console.log('   delivery ->', JSON.stringify({ tracking_registered: del[0].json.tracking_registered, stored_rows: del[0].json.stored_rows, binaries: Object.keys(del[0].binary), email: del[0].json.email }));
  const sp = await run('Spawn Page Runs', del);
  const b = sp[0].json.body;
  console.log('   page runs ->', sp.length, '| body:', JSON.stringify({ mode: b.mode, keyword: b.keyword, page_type: b.page_type, country: b.country, domain: b.domain, goal: b.goal, receive: b.receive, email: b.email, force_content: b.force_content, ladder_id: !!b.ladder_id, rung: b.ladder_rung, links: b.ladder_links.map(l => l.role) }));
  delete store['Start Form'];
  const nsp = await run('Normalize Input', sp[0]);
  console.log('   spawned run normalised ->', JSON.stringify({ mode: nsp[0].json.mode, via_webhook: nsp[0].json.via_webhook, keyword: nsp[0].json.keyword, include_content: nsp[0].json.include_content, force_content: nsp[0].json.force_content, ladder_id: nsp[0].json.ladder_id === b.ladder_id, links: nsp[0].json.ladder_links.length, goal: nsp[0].json.goal, err: nsp[0].json.validation_error }));
  const resp = await run('Build Ladder Response', del);
  console.log('   ladder callback ->', JSON.stringify({ stage: resp[0].json.stage, rungs: resp[0].json.rungs.length, top: resp[0].json.top_page.keyword, started: resp[0].json.pages_started, pdf_b64: resp[0].json.pdf && resp[0].json.pdf.data.length, doc_b64: resp[0].json.file && resp[0].json.file.data.length, registered: resp[0].json.tracking_registered }));
  mock('Save Ladder Rows', [{ json: { error: { message: 'Data table with name "seo_ladders" not found' } } }]);
  const del2 = await run('Ladder Delivery', store['Save Ladder Rows']);
  console.log('   store failure ->', JSON.stringify({ tracking_registered: del2[0].json.tracking_registered, store_error: del2[0].json.store_error }));
  // the rung-1 page run keeps content even on an AVOID verdict (Verdict Router honours force_content) — checked by the IF expression, nothing to run here
});

// ===================================================================================
await guard('tracker', async () => {
  reset(); begin('S8 Rank tracker — plan, positions, progress report');
  if (!ladderRows) throw new Error('ladder scenario did not produce rows');
  mock('Load Ladders', ladderRows); mock('Load History', [{ json: {} }]);
  const tp = await run('Tracker Plan', store['Load History']);
  console.log('   checks ->', tp.length, '| first:', JSON.stringify({ kw: tp[0].json.keyword, rung: tp[0].json.rung, depth: tp[0].json.body[0].depth, loc: tp[0].json.body[0].location_code, email: tp[0].json.email }), '| head included?', tp.some(c => c.json.rung === 4));
  const posOf = (c, i) => c.json.rung === 4 ? 0 : (i % 3 === 0 ? 7 : i % 3 === 1 ? 2 : 0);
  mock('SERP Check', tp.map((c, i) => i === 2 ? { error: { message: 'timeout' } } : V.serpFor(c.json.keyword, c.json.domain, posOf(c, i))));
  const pp = await run('Parse Positions', store['SERP Check']);
  const HCOLS = ['ladder_id', 'keyword', 'checked_at', 'position', 'url', 'serp_features', 'domain', 'rung'];
  console.log('   positions ->', pp.map(p => p.json.position).join(','), '| columns exact?', pp.every(p => JSON.stringify(Object.keys(p.json).sort()) === JSON.stringify(HCOLS.slice().sort())), '| failed check = -1?', pp[2].json.position === -1, '| url for #7:', pp[0].json.url);
  mock('Save History', pp);
  const tr = await run('Tracker Report', store['Save History']);
  const r = tr[0].json;
  console.log('   report ->', JSON.stringify({ ladders: tr.length, subject: r.subject, next: r.next_step.action, rung: r.next_step.rung, rungs: r.rungs, email: r.email, api_body_kw: r.api_body && r.api_body.keyword, done: r.done }));
  save('tracker-email.html', r.html); scanHtml('tracker email', r.html);
  console.log('   form link in email?', /\/form\//.test(r.html), '| api body in email?', /ladder_rung/.test(r.html));
  // second check a week later: gains, drops, previous positions
  const prev = pp.map(p => ({ json: { ...p.json, checked_at: '2026-09-24T08:00:00.000Z', position: p.json.position > 0 ? p.json.position + 6 : (p.json.rung === 4 ? 0 : 30) } }));
  mock('Load History', prev);
  const tp2 = await run('Tracker Plan', prev);
  mock('SERP Check', tp2.map((c, i) => V.serpFor(c.json.keyword, c.json.domain, c.json.rung === 4 ? 12 : (i === 1 ? 40 : posOf(c, i)))));
  const pp2 = await run('Parse Positions', store['SERP Check']); mock('Save History', pp2);
  const tr2 = await run('Tracker Report', store['Save History']);
  console.log('   week 2 ->', JSON.stringify({ gains: tr2[0].json.gains.length, drops: tr2[0].json.drops, head_now: tr2[0].json.positions.find(p => p.rung === 4), next: tr2[0].json.next_step.action }));
  // stop rule: the head term has held the top 3 for 4 checks -> ladder skipped; nothing to do when no ladders
  const headKw = ladderRows[ladderRows.length - 1].json.keyword;
  const topHist = [0, 1, 2, 3].map(i => ({ json: { ladder_id: ladderRows[0].json.ladder_id, keyword: headKw, checked_at: '2026-09-' + (10 + i) + 'T08:00:00.000Z', position: 2, url: 'u', serp_features: '', domain: 'northwind-erp.com', rung: 4 } }));
  mock('Load History', topHist);
  const tp3 = await run('Tracker Plan', topHist);
  console.log('   stop rule ->', JSON.stringify(tp3[0].json));
  mock('Load Ladders', [{ json: {} }]); mock('Load History', [{ json: {} }]);
  const tp4 = await run('Tracker Plan', store['Load History']);
  console.log('   no ladders ->', JSON.stringify(tp4[0].json));
});

// ===================================================================================
await guard('wordpress', async () => {
  reset(); begin('S9 WordPress draft payload');
  const wp = await run('Build WP Draft', { keyword: 'erp implementation services', page_markdown: V.draftV5(), wordpress_url: 'https://blog.example.com/', schema_blocks: [{ type: 'FAQPage', json: { '@context': 'https://schema.org', '@type': 'FAQPage' } }], content_brief_slug: 'erp-implementation-services', ladder_id: 'lad_1', request_id: 'r1', email: 'o@e.com' });
  const p = wp[0].json.wp_payload;
  console.log('   payload ->', JSON.stringify({ url: wp[0].json.wordpress_url, title: p.title, slug: p.slug, status: p.status, excerpt_len: p.excerpt.length, h2s: (p.content.match(/<h2>/g) || []).length, h1_left: /<h1>|^# /m.test(p.content), tables: (p.content.match(/<table>/g) || []).length, scripts: (p.content.match(/application\/ld\+json/g) || []).length, meta_keys: Object.keys(p.meta).length, links: (p.content.match(/<a href/g) || []).length }));
});

// ===================================================================================
await guard('site tracker', async () => {
  reset(); begin('S10 Site tracking — track mode, Search Console, GA4, inspection, trends, live checks, metrics, report');
  const T = require('./fixtures_tracking');
  if (!ladderRows) throw new Error('ladder scenario did not produce rows');
  // --- intake: form page + API body ---
  mock('Start Form', { 'What do you want?': 'Track my site (rankings & traffic)' });
  const bad = await run('Normalize Input', { 'Website Domain': '', 'Target Country': 'United Arab Emirates', 'Email me the weekly report': 'o@e.com' }); console.log('   no domain ->', JSON.stringify(bad[0].json.validation_error));
  const n = await run('Normalize Input', { 'Website Domain': 'https://www.northwind-erp.com/', 'Target Country': 'United Arab Emirates', 'Search terms to track (optional)': 'ERP implementation Dubai\ne invoicing software uae, Northwind ERP login\n erp implementation dubai ', 'GA4 property ID (optional)': 'properties/222', 'Email me the weekly report': 'Owner@Example.com' });
  const j = n[0].json;
  console.log('   form track ->', JSON.stringify({ mode: j.mode, domain: j.domain, keyword: j.keyword, terms: j.track_keywords, ga4: j.ga4_property_id, email: j.email, need_desc: j.need_site_description, loc: j.location_code, err: j.validation_error }));
  H.staticData.rate = undefined; H.staticData.ai_budget = undefined;
  const rl = await run('Rate Limit', n); console.log('   rate limit est ->', rl[0].json.ai_spend_estimate_usd, '| error:', rl[0].json.validation_error || 'none');
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'track', domain: 'techand.ai', country: 'AE', keywords: ['E Invoicing UAE', 'erp dubai', 'e invoicing uae'], ga4_property_id: '333', callback_url: 'https://hooks.example.com/x', request_id: 'r-track' } });
  console.log('   api track ->', JSON.stringify({ mode: na[0].json.mode, via_webhook: na[0].json.via_webhook, terms: na[0].json.track_keywords, ga4: na[0].json.ga4_property_id, err: na[0].json.validation_error }));
  const SCOLS = ['site_id', 'domain', 'gsc_property', 'ga4_property_id', 'country', 'location_code', 'language_code', 'email', 'callback_url', 'keywords', 'status', 'source', 'created_at', 'last_run_at', 'last_status', 'request_id'];
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const srow = await run('Site Row (Track)', [{ json: { id: 7, name: 'seo_sites', columns: [] } }]);   // input is the Data Table create output, not the request (live finding)
  console.log('   site row ->', JSON.stringify({ site_id: srow[0].json.site_id, keywords: srow[0].json.keywords, source: srow[0].json.source, cols_exact: same(Object.keys(srow[0].json), SCOLS) }));
  mock('Save Site (Track)', srow); const pay = await run('Tracker Payload (Track)', srow);
  const tresp = await run('Build Track Response', pay);
  console.log('   payload ->', JSON.stringify(pay[0].json), '| response ->', JSON.stringify({ stage: tresp[0].json.stage, site_id: tresp[0].json.site_id, stored: tresp[0].json.stored, keywords: tresp[0].json.keywords.length, cb: tresp[0].json.callback_url }));
  mock('Save Site (Track)', [{ json: { error: { message: 'Data table with name "seo_sites" not found' } } }]); const pay2 = await run('Tracker Payload (Track)', store['Save Site (Track)']); console.log('   store failure ->', JSON.stringify(pay2[0].json));
  // --- site admin: delete / pause / resume ---
  const ad = await run('Admin Action', { headers: {}, body: { action: 'Pause', domain: 'https://www.techand.ai/', request_id: 'adm1' } }); console.log('   admin pause ->', JSON.stringify(ad[0].json));
  const adr = await run('Admin Result', [{ json: { id: 3, site_id: 'site_techand-ai', status: 'paused' } }]); console.log('   admin result ->', JSON.stringify(adr[0].json));
  const adr0 = await run('Admin Result', [{ json: {} }]); console.log('   admin no match ->', adr0[0].json.affected);
  await expectError('Admin Action', { action: 'nuke', site_id: 'x' }, /delete, pause, resume/); await expectError('Admin Action', { action: 'delete' }, /site_id or domain/);
  // --- the tracker: plan (on demand, scheduled with a virtual ladder site, no match) ---
  reset();
  const histRows = ladderRows.slice(0, 3).map((r, i) => ({ json: { ladder_id: r.json.ladder_id, keyword: r.json.keyword, checked_at: '2026-09-29T08:00:00.000Z', position: [7, 0, 2][i], url: 'https://www.northwind-erp.com/x/', serp_features: 'people_also_ask', domain: 'northwind-erp.com', rung: r.json.rung } }));
  mock('Manual Run', { site_id: 'site_northwind-erp-com', on_demand: true, request_id: 'req-on-demand' });
  const logRows = [{ json: { id: 1, site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', keyword: 'erp for distributors', source: 'striking', page_type: 'Service Page', existing_page_url: 'https://www.northwind-erp.com/erp-for-distributors/', rung: 0, ladder_id: '', request_id: 'cad_1', started_at: '2026-09-20T10:00:00.000Z', status: 'published', published_url: 'https://www.northwind-erp.com/erp-for-distributors/', published_at: '2026-09-25T10:00:00.000Z', week: '2026-09-20' } },
    { json: { id: 2, site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', keyword: 'wms uae', source: 'trend', page_type: 'Guide', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'cad_2', started_at: '2026-09-15T10:00:00.000Z', status: 'started', published_url: '', published_at: '', week: '2026-09-15' } }];
  mock('Load Sites', T.sitesRows()); mock('Load Ladders', ladderRows); mock('Load Rank History', histRows); mock('Load Site Metrics', [{ json: {} }]); mock('Load Query History', [{ json: {} }]); mock('Load Content Log', logRows);
  const d5 = new Date(Date.now() - 5 * 864e5).toISOString(), d60 = new Date(Date.now() - 60 * 864e5).toISOString();
  mock('Load Console Alerts', [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', kind: 'manual_action', severity: 'critical', subject: 'Manual action on https://northwind-erp.com/: Unnatural links', summary: 'x', received_at: d5, message_id: 'm1', status: 'new', source: 'mail' } }, { json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', kind: 'coverage', severity: 'high', subject: 'old notice', summary: 'x', received_at: d60, message_id: 'm0', status: 'new', source: 'mail' } }]);
  mock('Load Check-ins', [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', month: '2026-08', manual_action: false, security_issue: false, notes: '', coverage_json: JSON.stringify({ kind: 'reasons', reasons: [{ reason: 'Discovered - currently not indexed', pages: 12 }, { reason: 'Crawled - currently not indexed', pages: 5 }], not_indexed_total: 17 }), not_indexed_total: 17, csv_kind: 'reasons', submitted_at: '2026-08-04T10:00:00.000Z', source: 'form', request_id: '' } }]);
  const plan = await run('Site Plan', store['Load Query History']);
  const p = plan[0].json;
  console.log('   console in plan ->', JSON.stringify({ notices: p.console_alerts.map(x => x.kind), last_checkin: p.last_checkin && p.last_checkin.month, checkin_due: p.checkin_due }));
  console.log('   blog pages in plan ->', JSON.stringify({ blog_tracked: p.tracked.filter(t => t.source === 'blog').map(t => t.keyword), published_pages: p.ladder_pages.filter(x => x.status === 'published').map(x => x.url), pending: p.pending_publish }));
  console.log('   plan ->', JSON.stringify({ sites: plan.length, site_id: p.site_id, domain: p.domain, tracked: p.tracked.length, site_terms: p.tracked.filter(t => t.source === 'site').length, ladder_terms: p.tracked.filter(t => t.source === 'ladder').length, pages: p.ladder_pages.length, heads: p.ladder_heads, serp_known: Object.keys(p.serp_positions).length, ranges: p.ranges, request_id: p.request_id, first_run: p.first_run }));
  console.log('   period sanity ->', 'current 28 days?', T.days(p.ranges.current.start, p.ranges.current.end).length === 28, '| previous ends day before current?', T.days(p.ranges.previous.end, p.ranges.current.start).length === 2, '| yoy 28?', T.days(p.ranges.yoy.start, p.ranges.yoy.end).length === 28);
  mock('Manual Run', { domain: 'nobody.example' }); const p0 = await run('Site Plan', store['Load Query History']); console.log('   no match ->', JSON.stringify(p0[0].json));
  mock('Manual Run', [{ json: {} }]); mock('Load Sites', T.sitesRows({ site_id: 'site_acme-example', domain: 'acme.example', keywords: 'acme erp', status: 'active' }));
  const p2 = await run('Site Plan', store['Load Query History']); console.log('   scheduled ->', p2.map(x => x.json.domain + ':' + x.json.source + (x.json.virtual ? ' (virtual, email ' + x.json.email + ')' : '')).join(' | '));
  mock('Load Sites', T.sitesRows({ email: '', callback_url: '' })); const p2b = await run('Site Plan', store['Load Query History']); console.log('   site without address inherits the ladder e-mail ->', p2b[0].json.email, '|', p2b[0].json.callback_url || '(no callback)');
  mock('Load Sites', T.sitesRows({ status: 'paused' })); const p3 = await run('Site Plan', store['Load Query History']); console.log('   paused site skipped on schedule ->', p3[0].json.nothing_to_do ? JSON.stringify(p3[0].json) : p3.map(x => x.json.domain + ':' + x.json.source).join(' | '));
  mock('Manual Run', { site_id: 'site_northwind-erp-com', on_demand: true, request_id: 'req-on-demand' }); mock('Load Sites', T.sitesRows()); await run('Site Plan', store['Load Query History']);
  // --- Search Console ---
  mock('GSC Sites', T.gscSites()); const rp = await run('Resolve Properties', store['GSC Sites']);
  console.log('   property ->', JSON.stringify({ property: rp[0].json.gsc_property, connected: rp[0].json.gsc_connected, permission: rp[0].json.gsc_permission }));
  mock('GSC Sites', T.gscDenied()); const rpd = await run('Resolve Properties', store['GSC Sites']); console.log('   denied ->', JSON.stringify({ connected: rpd[0].json.gsc_connected, error: rpd[0].json.gsc_error }));
  mock('GSC Sites', { siteEntry: [{ siteUrl: 'https://www.northwind-erp.com/', permissionLevel: 'siteOwner' }] }); const rpu = await run('Resolve Properties', store['GSC Sites']); console.log('   url-prefix fallback ->', rpu[0].json.gsc_property);
  mock('GSC Sites', T.gscSites()); await run('Resolve Properties', store['GSC Sites']);
  const gq = await run('GSC Requests', store['Resolve Properties']);
  const kinds = gq.reduce((m, q) => { m[q.json.kind] = (m[q.json.kind] || 0) + 1; return m; }, {});
  console.log('   gsc requests ->', gq.length, JSON.stringify(kinds), '| url:', gq[0].json.url, '| kw filter:', JSON.stringify(gq.find(q => q.json.kind === 'kw_cur').json.body.dimensionFilterGroups));
  mock('GSC Query', gq.map(q => T.gscResponse(q.json))); const pg = await run('Parse GSC', store['GSC Query']);
  const g = pg[0].json;
  console.log('   totals ->', JSON.stringify({ cur: g.totals.cur, prev: g.totals.prev, yoy: g.totals.yoy, deltas: g.deltas, daily: g.daily.length, queries: g.query_count }));
  console.log('   movers ->', JSON.stringify({ winners: g.winners.map(q => q.query), losers: g.losers.map(q => q.query), new: g.new_queries.map(q => q.query), lost: g.lost_queries.map(q => q.query) }));
  console.log('   opportunities ->', JSON.stringify({ striking: g.striking.map(q => q.query + '@' + q.position), ctr_gaps: g.ctr_gaps.map(q => q.query + ' ' + (q.ctr * 100).toFixed(1) + '% vs ' + Math.round(q.expected_ctr * 100) + '%'), decaying: g.decaying_pages.map(x => x.page), rising: g.rising_pages.map(x => x.page) }));
  console.log('   tracked (gsc) ->', JSON.stringify(g.tracked.map(t => [t.keyword, t.position, t.prev_position, t.impressions, t.page.replace(/^https?:\/\/[^/]+/, '')])));
  const checks1 = { striking_has_erp_impl: g.striking.some(q => q.query === 'erp implementation dubai'), ctr_gap_erp_software: g.ctr_gaps.some(q => q.query === 'erp software uae'), loser_einv: g.losers.some(q => q.query === 'e invoicing software uae'), new_peppol: g.new_queries.some(q => q.query === 'peppol uae'), lost_d365: g.lost_queries.some(q => q.query === 'dynamics 365 partner dubai'), decaying_old_guide: g.decaying_pages.some(x => /old-guide/.test(x.page)), clicks_up: g.deltas.clicks_pct > 0, query_page_kept: g.queries.every(q => q.page) };
  console.log('   checks ->', JSON.stringify(checks1), Object.values(checks1).every(Boolean) ? 'ALL OK' : '!! SOME FAILED');
  // --- GA4: detect the property from the stream URL, then reports ---
  mock('GA4 Accounts', T.ga4Accounts()); const sr = await run('Stream Requests', store['GA4 Accounts']); console.log('   stream requests ->', sr.map(x => x.json.property || 'skip:' + x.json.reason).join(', '));
  mock('GA4 Streams', sr.map(r => T.ga4Streams(r.json))); const gr = await run('GA4 Requests', store['GA4 Streams']);
  console.log('   ga4 requests ->', gr.length, JSON.stringify({ property: gr[0].json.ga4_property_id, detected: gr[0].json.ga4_detected, name: gr[0].json.ga4_property_name, url: gr[0].json.url, ranges: gr[0].json.body.dateRanges.map(r => r.name) }));
  mock('GA4 Report', gr.map(r => T.ga4Report(r.json))); const pa = await run('Parse GA4', store['GA4 Report']);
  const a = pa[0].json; console.log('   ga4 ->', JSON.stringify({ organic: a.organic, total_cur: a.total.cur.sessions, share: a.organic_share, channels: a.channels.map(c => c.channel + ':' + c.sessions), landing: a.landing.map(l => l.page + ' ' + l.sessions + '(' + (l.delta > 0 ? '+' : '') + l.delta + ')'), daily: a.daily.length, first_day: a.daily[0] }));
  mock('GA4 Accounts', { error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } }); const sr2 = await run('Stream Requests', store['GA4 Accounts']); console.log('   ga4 auth failure ->', JSON.stringify(sr2[0].json));
  mock('GA4 Accounts', T.ga4Accounts()); await run('Stream Requests', store['GA4 Accounts']);
  // --- URL inspection, trends, live SERP checks ---
  const ir = await run('Inspect Requests', store['Resolve Properties']); console.log('   inspections ->', ir.length, '(only live pages) | first body:', JSON.stringify(ir[0].json.body));
  mock('Inspect URL', ir.map(r => T.inspection(r.json))); const pi = await run('Parse Inspection', store['Inspect URL']);
  console.log('   index status ->', pi.map(x => x.json.url.replace(/^https?:\/\/[^/]+/, '') + ':' + (x.json.indexed ? 'indexed' : x.json.coverage)).join(' | '));
  const tq = await run('Trends Requests', store['Resolve Properties']); console.log('   trend requests ->', tq.map(x => x.json.keyword).join(', '), '| body:', JSON.stringify(tq[0].json.body[0]));
  mock('Google Trends', tq.map(r => T.trends(r.json))); const pt = await run('Parse Trends', store['Google Trends']);
  console.log('   trends ->', JSON.stringify(pt.map(x => ({ kw: x.json.keyword, dir: x.json.direction, change: x.json.change_pct, peak: x.json.peak_date, rising: x.json.rising.map(r => r.query + ' ' + r.value), cost: x.json.cost }))));
  const trows = await run('Trend Rows', store['Parse Trends']); const TCOLS = ['site_id', 'domain', 'keyword', 'checked_at', 'period_end', 'direction', 'change_pct', 'peak_date', 'latest', 'average', 'rising', 'top'];
  console.log('   trend rows ->', trows.length, '| cols exact?', trows.every(x => same(Object.keys(x.json), TCOLS)), '| first:', JSON.stringify({ kw: trows[0].json.keyword, dir: trows[0].json.direction, rising: trows[0].json.rising }));
  trendRows = trows;
  const sq = await run('Site SERP Requests', store['Resolve Properties']); console.log('   serp checks ->', sq.map(x => x.json.keyword).join(', '), '| depth', sq[0].json.body[0].depth);
  mock('SERP Check (Site)', sq.map((q, i) => i === 2 ? { error: { message: 'timeout' } } : V.serpFor(q.json.keyword, q.json.domain, [5, 0, 1][i])));
  const ps = await run('Parse Site SERP', store['SERP Check (Site)']);
  const HCOLS = ['ladder_id', 'keyword', 'checked_at', 'position', 'url', 'serp_features', 'domain', 'rung'];
  console.log('   serp rows ->', ps.map(x => x.json.keyword + '=' + x.json.position).join(', '), '| cols exact?', ps.every(x => same(Object.keys(x.json), HCOLS)), '| ladder_id = site id?', ps[0].json.ladder_id === 'site_northwind-erp-com');
  mock('Save Site Rank History', ps);
  // --- metrics, rows, brief input, report ---
  const sm = await run('Site Metrics', store['Save Site Rank History']);
  const m = sm[0].json;
  const MCOLS = ['site_id', 'domain', 'period_start', 'period_end', 'checked_at', 'gsc_connected', 'ga4_connected', 'clicks', 'impressions', 'ctr', 'position', 'prev_clicks', 'prev_impressions', 'prev_ctr', 'prev_position', 'yoy_clicks', 'yoy_impressions', 'sessions', 'engaged_sessions', 'key_events', 'prev_sessions', 'prev_engaged_sessions', 'prev_key_events', 'organic_share', 'queries', 'striking', 'alerts'];
  const QCOLS = ['site_id', 'domain', 'period_end', 'checked_at', 'query', 'clicks', 'impressions', 'ctr', 'position', 'prev_clicks', 'prev_impressions', 'prev_position', 'page', 'tracked', 'serp_position'];
  console.log('   metrics ->', JSON.stringify({ gsc: m.gsc.connected, ga4: m.ga4.connected, ga4_detected: m.ga4.detected, alerts: m.alerts.map(x => x.level + ': ' + x.text.slice(0, 70)), actions: m.actions.map(x => x.priority + ':' + x.type), api_bodies: m.actions.filter(x => x.api_body).length }));
  console.log('   tracked ->', JSON.stringify(m.tracked.map(t => [t.keyword, t.source, t.gsc_position, t.gsc_prev_position, t.serp_position])));
  console.log('   ladder pages ->', JSON.stringify(m.ladder_pages.map(x => [x.url.replace(/^https?:\/\/[^/]+/, ''), x.rung, x.status, x.indexed])));
  console.log('   rows ->', JSON.stringify({ metrics_cols_exact: same(Object.keys(m.metrics_row), MCOLS), metrics: { clicks: m.metrics_row.clicks, prev: m.metrics_row.prev_clicks, sessions: m.metrics_row.sessions, striking: m.metrics_row.striking, alerts: m.metrics_row.alerts.slice(0, 60) }, query_rows: m.query_rows.length, query_cols_exact: m.query_rows.every(r => same(Object.keys(r), QCOLS)), tracked_rows: m.query_rows.filter(r => r.tracked).length, site_cols_exact: same(Object.keys(m.site_row), SCOLS), site_row: { gsc: m.site_row.gsc_property, ga4: m.site_row.ga4_property_id, last_status: m.site_row.last_status, keywords: m.site_row.keywords } }));
  const checks2 = { notice_alert: m.alerts.some(x => /Search Console notice/.test(x.text)), manual_action_first: m.actions[0] && m.actions[0].type === 'manual_action', checkin_action: m.actions.some(x => x.type === 'checkin'), coverage_report_action: m.actions.some(x => x.type === 'coverage_report'), old_notice_excluded: m.console.notices.length === 1, index_action: m.actions.some(x => x.type === 'index'), publish_action: m.actions.some(x => x.type === 'publish'), planned_not_inspected: m.ladder_pages.filter(p => p.status === 'planned' && !p.page_exists).every(p => p.indexed === null && /planned/.test(p.inspect_error)), striking_action: m.actions.some(x => x.type === 'striking' && x.api_body && x.api_body.existing_page_url), ctr_action: m.actions.some(x => x.type === 'ctr'), decay_action: m.actions.some(x => x.type === 'decay'), trend_action: m.actions.some(x => x.type === 'trend'), ga4_connected: m.ga4.connected, no_setup_alerts: !m.alerts.some(x => x.level === 'setup'), not_indexed_alert: m.alerts.some(x => /not indexed/.test(x.text)), slip_alert: m.alerts.some(x => /slipped/.test(x.text)), serp_merged: m.tracked.some(t => t.serp_position === 5) };
  console.log('   checks ->', JSON.stringify(checks2), Object.values(checks2).every(Boolean) ? 'ALL OK' : '!! SOME FAILED');
  const qr = await run('Query Rows', sm); const srw = await run('Site Rows', sm); console.log('   query rows ->', qr.length, '| site rows ->', srw.length);
  queryRows = qr; console.log('   pending in report facts? ->', (m.pending_publish || []).map(x => x.keyword).join(','));
  mock('Load AI Visibility (Site)', [{ json: { site_id: 'site_northwind-erp-com', checked_at: '2026-09-28T07:00:00Z', mention_rate: 25, citation_rate: 12.5, share_of_voice: 30, competitors_json: JSON.stringify([{ domain: 'azentio.com', share: 40 }]), alerts: '' } }, { json: { site_id: 'site_northwind-erp-com', checked_at: '2026-09-21T07:00:00Z', mention_rate: 18.5, citation_rate: 6, share_of_voice: 22 } }]);
  mock('Load Backlink Snapshots (Site)', [{ json: { site_id: 'site_northwind-erp-com', checked_at: '2026-09-28T07:30:00Z', mode: 'light', referring_domains: 13, new_links: 4, lost_links: 1, important_lost: 1, spammy_new: 3, spam_score: 63 } }]);
  mock('Load Audits (Site)', [{ json: { site_id: 'site_northwind-erp-com', audited_at: '2026-09-01T06:00:00Z', health_score: 70, grade: 'C', critical: 1, high: 4, medium: 6, pages_crawled: 58 } }, { json: { site_id: 'site_northwind-erp-com', audited_at: '2026-08-01T06:00:00Z', health_score: 64 } }]);
  const bi = await run('Brief Input', srw); const facts = JSON.parse(bi[0].json.facts); console.log('   facts ->', bi[0].json.facts.length, 'chars | keys:', Object.keys(facts).join(','), '| striking:', facts.search_console.striking_distance.length, '| actions:', facts.computed_actions.length);
  mock('Site Brief', [{ json: { output: { headline: 'Search clicks up 23%; two pages one push away from the top 3', summary: 'Clicks rose from 364 to 448 in 28 days. "erp implementation dubai" moved from #7.5 to #6.2 with 900 impressions. The old ERP guide lost 25 clicks. One ladder page is not indexed yet.', highlights: ['Clicks 448 (+23%)', '"erp software uae" ranks #3 but converts only 2.3% of 2,400 impressions'], actions: [{ priority: 1, action: 'Request indexing for /uae-e-invoicing-penalties/', why: 'Discovered, not indexed', keyword: 'uae e invoicing penalties', url: 'https://www.northwind-erp.com/uae-e-invoicing-penalties/' }, { priority: 2, action: 'Expand /erp-implementation-dubai/ with an FAQ and 3 internal links', why: '900 impressions at #6.2', keyword: 'erp implementation dubai', url: '' }], watch: ['/blog/old-guide/ clicks'] } } }]);
  const rep = await run('Site Report', bi); const r = rep[0].json;
  console.log('   monday summary block ->', /AI search, backlinks and technical health/.test(r.html), '| ai', /named in 25%/.test(r.html), '| links', /1 important lost/.test(r.html), '| audit', /health 70\/100/.test(r.html), '| brief facts', !!JSON.parse(bi[0].json.facts).growth_monitors);
  console.log('   report ->', JSON.stringify({ subject: r.subject, stage: r.stage, file: r.file_name, html: r.html.length, binary: !!rep[0].binary.data, brief: !!r.brief, has_connect_box: /Connect Google/.test(r.html), tiles: (r.html.match(/text-transform:uppercase/g) || []).length, api_bodies: (r.html.match(/"mode":"keyword"/g) || []).length }));
  save('site-tracker-email.html', r.html); scanHtml('site tracker email', r.html);
  console.log('   console section in report? ->', /Search Console notices and monthly check-in/.test(r.html), '| reminder?', /Monthly check-in due/.test(r.html), '| notice row?', /manual action/.test(r.html));
  mock('Site Brief', [{ json: { error: 'model failed' } }]); const rep2 = await run('Site Report', bi);
  console.log('   brief failure fallback ->', JSON.stringify({ brief: rep2[0].json.brief, has_actions: /Do this week/.test(rep2[0].json.html) && /<ol/.test(rep2[0].json.html) })); scanHtml('site tracker email (no brief)', rep2[0].json.html);
  const cb = await run('Build Site Callback', [{ json: rep2[0].json, binary: { ...rep2[0].binary, pdf: { data: Buffer.from('%PDF-1.4 test').toString('base64'), fileName: 'x.pdf', mimeType: 'application/pdf' } } }]);
  console.log('   callback ->', JSON.stringify({ stage: cb[0].json.stage, pdf: cb[0].json.pdf && cb[0].json.pdf.data.length, html_dropped: !('html' in cb[0].json), rows_dropped: !('query_rows' in cb[0].json), keys: Object.keys(cb[0].json).length }));
  // --- not connected at all (first run before access is granted): no Google data, trends + ladder positions still used ---
  mock('GSC Sites', T.gscDenied()); const rpx = await run('Resolve Properties', store['GSC Sites']);
  const gqx = await run('GSC Requests', rpx); console.log('   gsc requests (denied) ->', JSON.stringify(gqx[0].json));
  for (const k of ['Parse GSC', 'Parse GA4', 'Parse Inspection', 'Parse Site SERP', 'GA4 Streams', 'Stream Requests']) delete store[k];
  mock('GA4 Accounts', { error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } });
  const grx = await run('GA4 Requests', store['GA4 Accounts']); console.log('   ga4 requests (denied) ->', JSON.stringify(grx[0].json));
  const irx = await run('Inspect Requests', rpx); const sqx = await run('Site SERP Requests', rpx); console.log('   inspections (denied) ->', JSON.stringify(irx[0].json), '| serp checks still run ->', sqx.length);
  const smx = await run('Site Metrics', store['Parse Trends']); const mx = smx[0].json;
  console.log('   metrics (not connected) ->', JSON.stringify({ gsc: mx.gsc.connected, gsc_error: mx.gsc.error, ga4: mx.ga4.connected, ga4_error: mx.ga4.error, alerts: mx.alerts.map(x => x.level), actions: mx.actions.map(x => x.type), tracked_serp: mx.tracked.map(t => t.serp_position), trends: mx.trends.length, metrics_row_clicks: mx.metrics_row.clicks, query_rows: mx.query_rows.length }));
  const bix = await run('Brief Input', smx); mock('Site Brief', [{ json: { error: 'x' } }]); const repx = await run('Site Report', bix);
  console.log('   report (not connected) ->', JSON.stringify({ subject: repx[0].json.subject, connect_box: /Users and permissions/.test(repx[0].json.html) && /Property access management/.test(repx[0].json.html), tracked_table: /Tracked keywords/.test(repx[0].json.html) })); scanHtml('site tracker email (not connected)', repx[0].json.html);
  save('site-tracker-email-not-connected.html', repx[0].json.html);
});

// ===================================================================================
await guard('content cadence', async () => {
  reset(); begin('S12 Content cadence — plan (ladder, striking distance, trends), logs, ladder marks, note');
  const T = require('./fixtures_tracking');
  if (!ladderRows || !queryRows || !trendRows) throw new Error('earlier scenarios did not produce rows');
  const logRows = [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', keyword: 'wms uae', source: 'trend', page_type: 'Guide', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'cad_old', started_at: '2026-09-15T10:00:00.000Z', status: 'started', published_url: '', published_at: '', week: '2026-09-15' } }];
  const cadRows = [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', pages_per_week: 2, status: 'active', updated_at: 'x', request_id: '' } }];
  mock('Manual Run', { site_id: 'site_northwind-erp-com', on_demand: true }); mock('Load Sites', T.sitesRows()); mock('Load Cadence', cadRows); mock('Load Ladders', ladderRows); mock('Load Query History', queryRows); mock('Load Trends', trendRows); mock('Load Content Log', logRows);
  const cp = await run('Cadence Plan', store['Load Content Log']);
  console.log('   picks ->', cp.map(x => x.json.keyword + ' [' + x.json.source + (x.json.rung ? ' rung ' + x.json.rung : '') + ']').join(' | '), '| request ids:', cp.map(x => x.json.request_id).join(','));
  const b = cp[0].json.body;
  console.log('   body ->', JSON.stringify({ mode: b.mode, keyword: b.keyword, page_type: b.page_type, country: b.country, domain: b.domain, email: b.email, cb: b.callback_url, force: b.force_content, client_ip: b.client_ip, ladder: b.ladder_id === cp[0].json.ladder_id, rung: b.ladder_rung, head: b.ladder_head, links: (b.ladder_links || []).map(l => l.role) }));
  console.log('   upcoming ->', cp[0].json.upcoming.map(u => u.keyword + ' (' + u.source + ')').join(', '), '| pending:', JSON.stringify(cp[0].json.pending_publish), '| candidates:', cp[0].json.candidates);
  delete store['Start Form'];
  const nb = await run('Normalize Input', { body: b }); console.log('   content run normalised ->', JSON.stringify({ mode: nb[0].json.mode, keyword: nb[0].json.keyword, force_content: nb[0].json.force_content, ladder_id: !!nb[0].json.ladder_id, links: (nb[0].json.ladder_links || []).length, need_desc: nb[0].json.need_site_description, err: nb[0].json.validation_error }));
  H.staticData.rate = undefined; H.staticData.ai_budget = undefined;
  for (let i = 0; i < 7; i++) await run('Rate Limit', [{ json: { ...nb[0].json, email: 'owner@example.com', client_ip: 'public' } }]);
  const rlInt = await run('Rate Limit', nb); console.log('   internal spawn not blocked by the owner limit ->', !rlInt[0].json.validation_error, '| key counted:', JSON.stringify(Object.keys(H.staticData.rate.keys)));
  const lr = await run('Log Rows', cp); const LCOLS = ['site_id', 'domain', 'keyword', 'source', 'page_type', 'existing_page_url', 'rung', 'ladder_id', 'request_id', 'started_at', 'status', 'published_url', 'published_at', 'week'];
  console.log('   log rows ->', lr.length, '| cols exact?', lr.every(x => same(Object.keys(x.json), LCOLS)), '| status:', lr[0].json.status);
  const lm = await run('Ladder Marks', lr); console.log('   ladder marks ->', JSON.stringify(lm.map(x => x.json)));
  const cn = await run('Cadence Note', lm); console.log('   note ->', JSON.stringify({ subject: cn[0].json.subject, email: cn[0].json.email, stage: cn[0].json.stage, pages: cn[0].json.pages.length, pending: cn[0].json.pending_publish.length })); scanHtml('cadence note', cn[0].json.html); save('cadence-note.html', cn[0].json.html);
  // no ladder: striking distance + rising trends, 3 pages, dry run
  mock('Manual Run', { domain: 'northwind-erp.com', pages: 3, dry_run: true }); mock('Load Ladders', [{ json: {} }]);
  const cp2 = await run('Cadence Plan', store['Load Content Log']); console.log('   no ladder ->', cp2.map(x => x.json.keyword + ' [' + x.json.source + ']' + (x.json.existing_page_url ? ' improves ' + x.json.existing_page_url.replace(/^https?:\/\/[^/]+/, '') : '')).join(' | '), '| dry_run:', cp2[0].json.dry_run);
  const lr2 = await run('Log Rows', cp2); console.log('   dry run logs nothing ->', lr2.length === 0); const lm2 = await run('Ladder Marks', cp2); console.log('   dry run marks nothing ->', JSON.stringify(lm2[0].json));
  // scheduled: no cadence row -> nothing; cadence off -> nothing; paused site -> nothing
  mock('Manual Run', [{ json: {} }]); mock('Load Cadence', [{ json: {} }]); const cp3 = await run('Cadence Plan', store['Load Content Log']); console.log('   scheduled without cadence ->', JSON.stringify(cp3[0].json));
  mock('Load Cadence', [{ json: { ...cadRows[0].json, status: 'off' } }]); const cp4 = await run('Cadence Plan', store['Load Content Log']); console.log('   cadence off ->', cp4[0].json.nothing_to_do === true);
  mock('Load Cadence', cadRows); mock('Load Sites', T.sitesRows({ status: 'paused' })); const cp5 = await run('Cadence Plan', store['Load Content Log']); console.log('   paused ->', cp5[0].json.nothing_to_do === true);
  // admin: cadence + unpublish
  const ac = await run('Admin Action', { body: { action: 'cadence', domain: 'northwind-erp.com', pages_per_week: 5 } }); console.log('   admin cadence (capped) ->', JSON.stringify({ pages: ac[0].json.pages_per_week, status: ac[0].json.cadence_status }));
  const cr = await run('Cadence Row (Admin)', ac); const CCOLS = ['site_id', 'domain', 'pages_per_week', 'status', 'updated_at', 'request_id']; console.log('   cadence row cols exact? ->', same(Object.keys(cr[0].json), CCOLS));
  const au = await run('Admin Action', { body: { action: 'unpublish', domain: 'northwind-erp.com', keyword: ' WMS UAE ' } }); console.log('   admin unpublish ->', JSON.stringify({ keyword: au[0].json.keyword, site_id: au[0].json.site_id }));
  await expectError('Admin Action', { action: 'cadence', domain: 'x.com' }, /pages_per_week/); await expectError('Admin Action', { action: 'unpublish', domain: 'x.com' }, /keyword/);
});

// ===================================================================================
await guard('published', async () => {
  reset(); begin('S13 I published a page — intake, live check, log + ladder rows, link suggestions, response');
  const T = require('./fixtures_tracking');
  if (!ladderRows || !queryRows) throw new Error('earlier scenarios did not produce rows');
  mock('Start Form', { 'What do you want?': 'I published a page' });
  const bad1 = await run('Normalize Input', { 'Website Domain': 'northwind-erp.com', 'Keyword of the page': 'wms uae', 'Published page URL': 'northwind-erp.com/wms' }); console.log('   bad url ->', JSON.stringify(bad1[0].json.validation_error));
  const bad2 = await run('Normalize Input', { 'Website Domain': 'northwind-erp.com', 'Keyword of the page': 'wms uae', 'Published page URL': 'https://other.example/wms-uae/' }); console.log('   other domain ->', JSON.stringify(bad2[0].json.validation_error));
  const n = await run('Normalize Input', { 'Website Domain': 'https://www.northwind-erp.com', 'Keyword of the page': ' WMS UAE ', 'Published page URL': 'https://www.northwind-erp.com/blog/wms-uae/' });
  console.log('   form published ->', JSON.stringify({ mode: n[0].json.mode, domain: n[0].json.domain, keyword: n[0].json.keyword, url: n[0].json.published_url, err: n[0].json.validation_error }));
  H.staticData.rate = { day: new Date().toISOString().slice(0, 10), total: 0, keys: { 'northwind-erp.com': 6 } }; H.staticData.ai_budget = undefined;
  const rl = await run('Rate Limit', n); console.log('   published is never rate-limited ->', !rl[0].json.validation_error, '| est', rl[0].json.ai_spend_estimate_usd);
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'published', domain: 'northwind-erp.com', content_request_id: 'cad_old', url: 'https://www.northwind-erp.com/blog/wms-uae/', callback_url: 'https://hooks.example.com/x', request_id: 'pub-1' } });
  console.log('   api published ->', JSON.stringify({ mode: na[0].json.mode, keyword: na[0].json.keyword, rid: na[0].json.content_request_id, url: na[0].json.published_url, err: na[0].json.validation_error }));
  const logRows = [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', keyword: 'wms uae', source: 'trend', page_type: 'Guide', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'cad_old', started_at: '2026-09-15T10:00:00.000Z', status: 'started', published_url: '', published_at: '', week: '2026-09-15' } }];
  mock('Load Content Log (Published)', logRows); mock('Load Ladders (Published)', ladderRows); mock('Load Query History (Published)', queryRows);
  const url = 'https://www.northwind-erp.com/blog/wms-uae/';
  mock('Fetch Published Page', T.publishedPage(url, 'wms uae'));
  const pc = await run('Publish Check', store['Load Query History (Published)']); const c = pc[0].json;   // input = the last table load, as live
  console.log('   images ->', JSON.stringify(c.images));
  console.log('   check ->', JSON.stringify({ live: c.live, passed: c.passed + '/' + c.checks.length, failed: c.failed, log_found: c.log_found, ladder_found: c.ladder_found, keyword: c.keyword, link_from: c.link_from.map(l => l.page.replace(/^https?:\/\/[^/]+/, '') + (l.related ? '*' : '')), subject: c.subject }));
  const LCOLS = ['site_id', 'domain', 'keyword', 'source', 'page_type', 'existing_page_url', 'rung', 'ladder_id', 'request_id', 'started_at', 'status', 'published_url', 'published_at', 'week'];
  const plr = await run('Published Log Row', pc); console.log('   log row ->', JSON.stringify({ cols_exact: same(Object.keys(plr[0].json), LCOLS), status: plr[0].json.status, url: plr[0].json.published_url, source: plr[0].json.source, started_kept: plr[0].json.started_at === '2026-09-15T10:00:00.000Z' }));
  const pla = await run('Published Ladder Row', pc); console.log('   ladder row (none for a trend page) ->', JSON.stringify(pla[0].json));
  mock('Save Published (Log)', plr); const pdv = await run('Published Delivery', plr); const pr = await run('Build Published Response', pdv);
  console.log('   response ->', JSON.stringify({ stage: pr[0].json.stage, stored: pr[0].json.stored, live: pr[0].json.live, checks: pr[0].json.checks.length, page_title: pr[0].json.page.title, cb: pr[0].json.callback_url })); scanHtml('publish check html', c.html); console.log('   plain text ->', c.plain.split('\n')[0]);
  // ladder keyword: ladder row produced; failing page: 404, noindex, missing meta
  const lk = ladderRows[1].json.keyword; const lurl = 'https://www.northwind-erp.com/' + lk.replace(/\s+/g, '-') + '/';
  mock('Start Form', { 'What do you want?': 'I published a page' }); await run('Normalize Input', { 'Website Domain': 'northwind-erp.com', 'Keyword of the page': lk, 'Published page URL': lurl }); delete store['Start Form'];
  mock('Fetch Published Page', T.publishedPage(lurl, lk, { noDesc: true, noindex: true, words: 200, noAlt: true, genericNames: true, noDims: true })); const pc2 = await run('Publish Check', store['Load Query History (Published)']);
  console.log('   ladder page with defects ->', JSON.stringify({ passed: pc2[0].json.passed, failed: pc2[0].json.failed, ladder_found: pc2[0].json.ladder_found, ladder_links: pc2[0].json.link_from.filter(l => l.ladder).length }));
  const pla2 = await run('Published Ladder Row', pc2); console.log('   ladder row ->', JSON.stringify(pla2[0].json));
  mock('Fetch Published Page', T.publishedPage(lurl, lk, { status: 404 })); const pc3 = await run('Publish Check', store['Load Query History (Published)']); console.log('   404 ->', JSON.stringify({ live: pc3[0].json.live, summary: pc3[0].json.summary.slice(0, 80), status_row: pc3[0].json.log_row.status }));
  mock('Fetch Published Page', { error: 'timeout of 45000ms exceeded', details: {} }); const pc4 = await run('Publish Check', store['Load Query History (Published)']); console.log('   fetch error ->', JSON.stringify({ live: pc4[0].json.live, first_check: pc4[0].json.checks[0] })); scanHtml('publish check html (error)', pc4[0].json.html);
});

// ===================================================================================
await guard('console alerts', async () => {
  reset(); begin('S14 Console Alerts — Search Console notification mails -> typed alerts, owner e-mail');
  const T = require('./fixtures_tracking');
  const out = [];
  for (const k of ['manual', 'security', 'coverage', 'cwv', 'summary', 'other']) { const c = await run('Classify Notification', T.consoleMail(k)); out.push(k + ' -> ' + JSON.stringify({ relevant: c[0].json.relevant, kind: c[0].json.kind, sev: c[0].json.severity, domain: c[0].json.domain })); }
  console.log('   ' + out.join('\n   '));
  await run('Classify Notification', T.consoleMail('manual'));
  const ACOLS = ['site_id', 'domain', 'kind', 'severity', 'subject', 'summary', 'received_at', 'message_id', 'status', 'source'];
  const ar = await run('Alert Row', store['Classify Notification']); console.log('   alert row cols exact? ->', same(Object.keys(ar[0].json), ACOLS), '| id:', ar[0].json.message_id);
  mock('Load Sites (Alerts)', T.sitesRows()); mock('Load Ladders (Alerts)', [{ json: {} }]);
  const at = await run('Alert Target', store['Load Ladders (Alerts)']); console.log('   alert target ->', JSON.stringify({ email: at[0].json.email, cb: at[0].json.callback_url, subject: at[0].json.subject_line, steps: (at[0].json.html.match(/<li>/g) || []).length })); scanHtml('alert e-mail', at[0].json.html);
  mock('Load Sites (Alerts)', [{ json: {} }]); mock('Load Ladders (Alerts)', ladderRows); const at2 = await run('Alert Target', store['Load Ladders (Alerts)']); console.log('   ladder fallback e-mail ->', at2[0].json.email);
});

// ===================================================================================
await guard('checkin', async () => {
  reset(); begin('S15 Monthly Search Console check-in — form upload, API text, parsing, rows, alerts, response');
  const T = require('./fixtures_tracking');
  mock('Start Form', { 'What do you want?': 'Search Console check-in (monthly)' });
  const csv = T.pagesExportCsv();
  const intake = await run('Check-in Intake', [{ json: { 'Website Domain': 'https://www.northwind-erp.com', 'Any manual action in Search Console?': 'Yes', 'Any security issue in Search Console?': 'No', 'Notes (optional)': 'Unnatural links notice, 2026-09-28' }, binary: { Pages_report_export__optional_CSV_: { data: Buffer.from(csv, 'utf8').toString('base64'), fileName: 'Table.csv', mimeType: 'text/csv' } } }]);
  console.log('   intake ->', JSON.stringify({ file: intake[0].json.pages_csv_file, chars: intake[0].json.pages_csv_text.length }));
  const n = await run('Normalize Input', intake); const j = n[0].json;
  console.log('   normalised ->', JSON.stringify({ mode: j.mode, domain: j.domain, manual: j.checkin_manual_action, security: j.checkin_security_issue, notes: j.checkin_notes, csv: j.checkin_csv_text.length, err: j.validation_error }));
  H.staticData.rate = { day: new Date().toISOString().slice(0, 10), total: 0, keys: { 'northwind-erp.com': 6 } }; const rl = await run('Rate Limit', n); console.log('   never rate-limited ->', !rl[0].json.validation_error);
  const pc = await run('Parse Check-in', n); const c = pc[0].json;
  console.log('   parsed ->', JSON.stringify({ kind: c.coverage.kind, reasons: c.coverage.reasons.map(r => r.reason + ':' + r.pages), total: c.coverage.not_indexed_total, month: c.checkin_month, lines: c.summary_lines.length }));
  const KCOLS = ['site_id', 'domain', 'month', 'manual_action', 'security_issue', 'notes', 'coverage_json', 'not_indexed_total', 'csv_kind', 'submitted_at', 'source', 'request_id'];
  const kr = await run('Checkin Row', pc); console.log('   check-in row cols exact? ->', same(Object.keys(kr[0].json), KCOLS), '| manual:', kr[0].json.manual_action, '| total:', kr[0].json.not_indexed_total);
  const al = await run('Alert From Checkin', kr); console.log('   alerts from check-in ->', al.map(x => x.json.kind + ' (' + x.json.message_id + ')').join(', '));
  mock('Save Check-in', kr); const dl = await run('Check-in Delivery', kr); const resp = await run('Build Check-in Response', dl);
  console.log('   response ->', JSON.stringify({ stage: resp[0].json.stage, month: resp[0].json.month, manual: resp[0].json.manual_action, stored: resp[0].json.stored, summary0: resp[0].json.summary[0].slice(0, 60) }));
  console.log('   plain ->', c.plain.split('\n')[0].slice(0, 100));
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'checkin', domain: 'techand.ai', manual_action: false, security_issue: false, pages_csv: 'Date,Indexed,Not indexed\n2026-09-01,40,12\n2026-09-29,43,6\n', callback_url: 'https://hooks.example.com/x', request_id: 'ck1' } });
  const pc2 = await run('Parse Check-in', na); console.log('   api chart csv ->', JSON.stringify({ mode: na[0].json.mode, kind: pc2[0].json.coverage.kind, indexed: pc2[0].json.coverage.indexed_total, not_indexed: pc2[0].json.coverage.not_indexed_total }));
  const al2 = await run('Alert From Checkin', pc2); console.log('   no alert when both no ->', JSON.stringify(al2[0].json));
  const na3 = await run('Normalize Input', { body: { mode: 'checkin', domain: 'techand.ai', manual_action: 'yes', pages_csv: 'garbage,data\n1,2\n', callback_url: 'https://hooks.example.com/x' } }); const pc3 = await run('Parse Check-in', na3); console.log('   unrecognised csv ->', pc3[0].json.coverage.kind, '|', pc3[0].json.summary_lines[2].slice(0, 70));
  const bad = await run('Normalize Input', { body: { mode: 'checkin', callback_url: 'https://hooks.example.com/x' } }); console.log('   no domain ->', JSON.stringify(bad[0].json.validation_error));
});

// ===================================================================================
await guard('profile', async () => {
  reset(); begin('S16 Business profile — form + API intake, merge with the stored row, readiness, schema preview, response');
  const PCOLS = ['site_id', 'domain', 'business_name', 'business_type', 'logo_url', 'street_address', 'city', 'region', 'postal_code', 'country_code', 'phone', 'public_email', 'opening_hours', 'price_range', 'service_areas', 'map_url', 'author_name', 'author_job_title', 'author_credentials', 'author_bio', 'author_url', 'author_image_url', 'author_same_as', 'author_knows_about', 'reviewer_name', 'reviewer_job_title', 'reviewer_url', 'updated_at', 'request_id'];
  const same = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  mock('Start Form', { 'What do you want?': 'Set up my business profile (author & address)' });
  const form = { 'Website Domain': 'www.northwind-erp.com', 'Author name': 'Sara Khan', 'Author job title': 'Head of ERP Delivery', 'Author credentials and experience': 'ACCA; 12 years in UAE VAT; led 40 Odoo and Business Central rollouts',
    'Author bio': 'Sara leads ERP delivery at Northwind ERP. She has moved distributors in Dubai and Abu Dhabi from spreadsheets to Odoo and Business Central since 2014.', 'Author profile links (one per line)': 'https://northwind-erp.com/team/sara-khan/\nhttps://www.linkedin.com/in/sarakhan/',
    'Author photo URL (optional)': 'https://northwind-erp.com/images/author-sara-khan.webp', 'Topics the author knows best': 'ERP implementation, UAE VAT, e-invoicing', 'Expert reviewer (optional)': 'Omar Haddad, Chartered Accountant (ICAEW), https://www.linkedin.com/in/omarhaddad/',
    'Company name': 'Northwind ERP', 'Category (for local search)': 'IT consultancy', 'Street address': 'Office 1203, Aspect Tower, Business Bay', 'City': 'Dubai', 'Region / state / emirate': 'Dubai', 'Postal code': '', 'Country': 'United Arab Emirates',
    'Phone': '+971 4 555 0100', 'Public e-mail on the website': 'hello@northwind-erp.com', 'Opening hours': 'Mo-Fr 09:00-18:00', 'Areas you serve': 'Dubai, Abu Dhabi, Sharjah', 'Google Maps link (optional)': 'https://maps.google.com/?cid=123', 'Logo URL (optional)': 'https://northwind-erp.com/logo.png', 'Email (optional)': '' };
  const n = await run('Normalize Input', form); const pi = n[0].json.profile_input || {};
  console.log('   form profile ->', JSON.stringify({ mode: n[0].json.mode, domain: n[0].json.domain, err: n[0].json.validation_error, keyword: n[0].json.keyword, business: n[0].json.business, author: pi.author_name, url: pi.author_url, same_as: pi.author_same_as, reviewer: [pi.reviewer_name, pi.reviewer_job_title, pi.reviewer_url], country: pi.country_code, city: pi.city, areas: pi.service_areas, need_site_description: n[0].json.need_site_description }));
  H.staticData.rate = { day: new Date().toISOString().slice(0, 10), total: 0, keys: { 'northwind-erp.com': 6 } }; H.staticData.ai_budget = undefined;
  const rl = await run('Rate Limit', n); console.log('   profile is never rate-limited ->', !rl[0].json.validation_error, '| est', rl[0].json.ai_spend_estimate_usd);
  mock('Load Profile (Profile)', [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', business_name: 'Northwind ERP LLC', author_bio: 'old bio', phone: '+971 4 000 0000', city: 'Dubai', price_range: '$$' } }]);
  const pr = await run('Profile Row', store['Load Profile (Profile)']);
  console.log('   profile row ->', JSON.stringify({ cols_exact: same(Object.keys(pr[0].json), PCOLS), site_id: pr[0].json.site_id, business: pr[0].json.business_name, phone: pr[0].json.phone, price_kept: pr[0].json.price_range, bio_replaced: pr[0].json.author_bio.slice(0, 20) }));
  mock('Save Profile', pr);
  const pd = await run('Profile Delivery', pr); const P = pd[0].json;
  console.log('   delivery ->', JSON.stringify({ existed: P.existed, changed: P.changed.length, eeat: P.eeat_score, local: P.local_score, missing_eeat: P.eeat_checklist.filter(x => !x.ok).map(x => x.item), person: P.schema_preview.person && P.schema_preview.person['@id'], lb: P.schema_preview.local_business && P.schema_preview.local_business.address.streetAddress, stored: P.stored }));
  console.log('   plain ->', P.plain.split('\n')[0].slice(0, 220));
  const resp = await run('Build Profile Response', pd); console.log('   response ->', JSON.stringify({ stage: resp[0].json.stage, keys: Object.keys(resp[0].json).length, profile_cols: Object.keys(resp[0].json.profile).length }));
  // partial update through the API: empty keeps, "-" clears, an author override object
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'profile', domain: 'northwind-erp.com', author: { name: 'Sara Khan', job_title: 'Director of ERP Delivery', same_as: ['https://www.linkedin.com/in/sarakhan/'] }, phone: '-', callback_url: 'https://hooks.example.com/x', request_id: 'pf1' } });
  mock('Load Profile (Profile)', pr); const pr2 = await run('Profile Row', pr);
  console.log('   api update ->', JSON.stringify({ err: na[0].json.validation_error, title: pr2[0].json.author_job_title, phone_cleared: pr2[0].json.phone === '', bio_kept: pr2[0].json.author_bio.slice(0, 12), city_kept: pr2[0].json.city, url_kept: pr2[0].json.author_url }));
  mock('Save Profile', [{ json: { error: { message: 'Data table not found' } } }]); const pd2 = await run('Profile Delivery', pr2); console.log('   store failure reported ->', pd2[0].json.stored, pd2[0].json.store_error);
  const b1 = await run('Normalize Input', { body: { mode: 'profile', domain: 'northwind-erp.com', callback_url: 'https://hooks.example.com/x' } }); console.log('   empty profile ->', JSON.stringify(b1[0].json.validation_error));
  const b2 = await run('Normalize Input', { body: { mode: 'profile', domain: 'northwind-erp.com', author: { name: 'X', url: 'linkedin.com/in/x' }, callback_url: 'https://hooks.example.com/x' } }); console.log('   bad link ->', JSON.stringify(b2[0].json.validation_error));
  const b3 = await run('Normalize Input', { body: { mode: 'profile', author: { name: 'X' }, callback_url: 'https://hooks.example.com/x' } }); console.log('   no domain ->', JSON.stringify(b3[0].json.validation_error));
  // a keyword run with an author override (API)
  const nk = await run('Normalize Input', { body: { mode: 'keyword', keyword: 'erp implementation services', country: 'AE', domain: 'northwind-erp.com', page_type: 'Blog Post', author: { name: 'Guest Writer', job_title: 'Analyst' }, callback_url: 'https://hooks.example.com/x' } });
  console.log('   keyword run with author override ->', JSON.stringify({ err: nk[0].json.validation_error, author: (nk[0].json.profile_input || {}).author_name, city_not_taken: (nk[0].json.profile_input || {}).city === '' }));
});

// ===================================================================================
await guard('case study', async () => {
  reset(); begin('S17 Case study — intake (form + API), stored proof row, content-log row, spawned page run, budget room, response');
  const CCOLS = ['case_id', 'site_id', 'domain', 'keyword', 'title', 'client_name', 'client_public', 'industry', 'location', 'service', 'challenge', 'solution', 'timeline', 'results', 'quote', 'quote_by', 'page_url', 'status', 'created_at', 'request_id'];
  const LCOLS = ['site_id', 'domain', 'keyword', 'source', 'page_type', 'existing_page_url', 'rung', 'ladder_id', 'request_id', 'started_at', 'status', 'published_url', 'published_at', 'week'];
  const same = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  mock('Start Form', { 'What do you want?': 'Write a case study' });
  const csForm = { 'Website Domain': 'northwind-erp.com', 'Target Country': 'United Arab Emirates', 'Service you delivered': 'Odoo implementation', 'Client name or description': 'Gulf Fresh Foods', 'May we name the client?': 'No, keep them anonymous', 'Client industry': 'food distribution', 'Client location': 'Dubai',
    'The challenge': 'Orders were keyed twice into two systems, stock counts were off by 8% and the month-end close took 9 days.', 'What you did': 'Odoo 18 with inventory, purchase and accounting; a van-sales app for 22 drivers; three data-migration rehearsals before go-live.',
    'Timeline': '14 weeks, March to June 2026', 'Results (with numbers)': 'Month-end close from 9 days to 3; stock accuracy from 92% to 99.4%; AED 180,000 a year saved in write-offs.', 'Client quote (optional)': 'We close the month in three days now, and nobody re-keys an order.', 'Quote by (name, role)': 'Rami Saleh, Finance Director', 'Keyword for this page (optional)': '', 'Email me the case study': 'owner@northwind-erp.com' };
  const n = await run('Normalize Input', csForm); const j = n[0].json;
  console.log('   form intake ->', JSON.stringify({ mode: j.mode, keyword: j.keyword, page_type: j.page_type, case_id: /^cs_/.test(j.case_id), public: j.case_study.client_public, service: j.case_study.service, results: j.case_study.results.slice(0, 30), err: j.validation_error, include_content: j.include_content, need_site_description: j.need_site_description }));
  const today = new Date().toISOString().slice(0, 10);
  H.staticData.rate = undefined; H.staticData.ai_budget = { period: today, spent_est: 9.5, runs: 4 };
  const rlx = await run('Rate Limit', n); console.log('   no room for the page today ->', JSON.stringify(rlx[0].json.validation_error));
  H.staticData.ai_budget = undefined; H.staticData.rate = undefined;
  const rl = await run('Rate Limit', n); console.log('   intake ->', JSON.stringify({ err: rl[0].json.validation_error, est: rl[0].json.ai_spend_estimate_usd, owner_runs: H.staticData.rate.keys['owner@northwind-erp.com'] }));
  mock('Ensure Case Table', [{ json: { id: 't1', name: 'seo_case_studies' } }]); mock('Ensure Log Table (Case)', [{ json: { id: 't2', name: 'seo_content_log' } }]);
  const cr = await run('Case Study Row', store['Ensure Log Table (Case)']);   // input = the table object, as live
  console.log('   case row ->', JSON.stringify({ cols_exact: same(Object.keys(cr[0].json), CCOLS), title: cr[0].json.title, public: cr[0].json.client_public, status: cr[0].json.status, rid: !!cr[0].json.request_id }));
  mock('Save Case Study', cr); const lr = await run('Case Study Log Row', cr);
  console.log('   log row ->', JSON.stringify({ cols_exact: same(Object.keys(lr[0].json), LCOLS), source: lr[0].json.source, page_type: lr[0].json.page_type, status: lr[0].json.status, keyword: lr[0].json.keyword }));
  mock('Log Case Study', lr); const sp = await run('Spawn Case Study Run', lr); const body = sp[0].json.body;
  console.log('   spawn ->', JSON.stringify({ mode: body.mode, page_type: body.page_type, force: body.force_content, key: body.client_ip, case_id: body.case_id === cr[0].json.case_id, goal: body.goal, receive: body.receive }));
  // the spawned body through API Entry (Normalize Input + Rate Limit) — the page run itself
  const saveN = n; delete store['Start Form'];
  const rn = await run('Normalize Input', { body }); const r = rn[0].json;
  console.log('   page run normalised ->', JSON.stringify({ err: r.validation_error, mode: r.mode, page_type: r.page_type, keyword: r.keyword, case_kept: !!(r.case_study && r.case_study.results), public: r.case_study && r.case_study.client_public, include_content: r.include_content, force: r.force_content, case_id: r.case_id === body.case_id }));
  const rrl = await run('Rate Limit', rn); console.log('   page run rate limit ->', JSON.stringify({ err: rrl[0].json.validation_error, est: rrl[0].json.ai_spend_estimate_usd, internal_key: H.staticData.rate.keys['casestudy:site_northwind-erp-com'], owner_runs_unchanged: H.staticData.rate.keys['owner@northwind-erp.com'] }));
  store['Normalize Input'] = saveN; mock('Start Form', { 'What do you want?': 'Write a case study' });
  mock('Start Case Study Run', [{ json: {} }]); const dl = await run('Case Study Delivery', store['Start Case Study Run']);
  console.log('   delivery ->', JSON.stringify({ status: dl[0].json.status, stored: dl[0].json.stored, started: dl[0].json.started, hints: dl[0].json.hints.length }), '|', dl[0].json.plain.split('\n')[0].slice(0, 160));
  // API intake with a callback, named client, no quote
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'case_study', domain: 'northwind-erp.com', country: 'AE', keyword: 'odoo case study dubai', case_study: { client_name: 'Gulf Fresh Foods', client_public: true, industry: 'food distribution', service: 'Odoo implementation', challenge: 'Two systems', solution: 'Odoo 18', results: 'Close from 9 days to 3' }, callback_url: 'https://hooks.example.com/x', request_id: 'cs-api-1' } });
  const cra = await run('Case Study Row', na); mock('Save Case Study', cra); mock('Start Case Study Run', [{ json: {} }]);
  const dla = await run('Case Study Delivery', store['Start Case Study Run']); const ra = await run('Build Case Study Response', dla);
  console.log('   api ->', JSON.stringify({ err: na[0].json.validation_error, keyword: na[0].json.keyword, title: cra[0].json.title, rid: cra[0].json.request_id, stage: ra[0].json.stage, status: ra[0].json.status, hints: ra[0].json.hints, cb: !!ra[0].json.callback_url }));
  mock('Start Case Study Run', [{ json: { error: { message: 'Workflow is not active' } } }]); const dlf = await run('Case Study Delivery', store['Start Case Study Run']); console.log('   spawn failure ->', dlf[0].json.status, '|', dlf[0].json.summary.slice(0, 90));
  const b1 = await run('Normalize Input', { body: { mode: 'case_study', domain: 'northwind-erp.com', country: 'AE', case_study: { service: 'Odoo', challenge: 'x', solution: 'y' }, callback_url: 'https://hooks.example.com/x' } }); console.log('   no results ->', JSON.stringify(b1[0].json.validation_error));
  const b2 = await run('Normalize Input', { body: { mode: 'case_study', domain: 'northwind-erp.com', case_study: { service: 'Odoo', challenge: 'x', solution: 'y', results: 'z' }, callback_url: 'https://hooks.example.com/x' } }); console.log('   no country ->', JSON.stringify(b2[0].json.validation_error));
});

// ===================================================================================
await guard('page types', async () => {
  reset(); begin('S18 Page types — hub, case study, local, video: brief context, schema, blog package, live publish check');
  if (!pvS1) throw new Error('S1 did not produce a Parse Verdict item');
  const T = require('./fixtures_tracking');
  const SITE = 'site_northwind-erp-com';
  const profileRow = { site_id: SITE, domain: 'northwind-erp.com', business_name: 'Northwind ERP', business_type: 'IT consultancy', logo_url: 'https://northwind-erp.com/logo.png', street_address: 'Office 1203, Aspect Tower, Business Bay', city: 'Dubai', region: 'Dubai', postal_code: '', country_code: 'AE', phone: '+971 4 555 0100', public_email: 'hello@northwind-erp.com',
    opening_hours: 'Mo-Fr 09:00-18:00', price_range: '', service_areas: 'Dubai, Abu Dhabi, Sharjah', map_url: 'https://maps.google.com/?cid=123', author_name: 'Sara Khan', author_job_title: 'Head of ERP Delivery', author_credentials: 'ACCA; led 40 Odoo and Business Central rollouts', author_bio: 'Sara leads ERP delivery at Northwind ERP and has moved 40 distributors off spreadsheets since 2014.',
    author_url: 'https://northwind-erp.com/team/sara-khan/', author_image_url: 'https://northwind-erp.com/images/author-sara-khan.webp', author_same_as: 'https://www.linkedin.com/in/sarakhan/', author_knows_about: 'ERP implementation, UAE VAT', reviewer_name: 'Omar Haddad', reviewer_job_title: 'Chartered Accountant (ICAEW)', reviewer_url: 'https://www.linkedin.com/in/omarhaddad/', updated_at: '2026-10-02T08:00:00.000Z', request_id: '' };
  const decodeB = (it, k) => Buffer.from(it.binary[k].data, 'base64').toString('utf8');
  const pipeline = async (label, pvOver, o = {}) => {
    mock('Parse Verdict', [{ json: { ...pvS1, ...pvOver } }]);
    mock('Load Profile (Brief)', o.profile ? [{ json: o.profile }] : [{ json: {} }]); mock('Load Case Studies (Brief)', o.cases || [{ json: {} }]);
    if (o.videoFetch) mock('Fetch Video Details', o.videoFetch); else delete store['Fetch Video Details'];
    const bc = await run('Brief Context', store['Load Case Studies (Brief)']); const B = bc[0].json;
    mock('Strategy Brief', { output: { ...V.briefV5, experience_notes: ['In our 40 rollouts the data migration rehearsal decided the go-live date', '[Author insight: the most common mistake you see in the first month after go-live]'], video_placement: o.videoPlacement || '' } });
    const pb = await run('Parse Brief', store['Strategy Brief']);
    const qa = await run('Content QA', [{ json: { output: o.draft || V.draftV5(), critique: V.critique } }], { runIndex: 0 }); const Q = qa[0].json.content_qa;
    const wf = await run('Build Word File', qa); const doc = decode(wf); save('page-type-' + label + '-report.doc.html', doc); scanHtml(label + ' report', doc);
    const bp = await run('Blog Package', wf); const M = bp[0].json.article_meta; const html = decodeB(bp[0], 'article_html'), md = decodeB(bp[0], 'article_md');
    save('page-type-' + label + '.html', html); save('page-type-' + label + '.md', md); save('page-type-' + label + '.meta.json', JSON.stringify(M, null, 2)); scanHtml(label + ' article', html);
    console.log('   ' + label + ' context ->', JSON.stringify({ role: B.page_role, article_like: B.article_like, author: B.author && B.author.name, reviewer: B.reviewer && B.reviewer.name, profile: !!B.site_profile, proof: B.proof_library.length, hub_pages: B.hub_pages.length, video: B.video && { date: B.video.upload_date, dur: B.video.duration_iso, chapters: B.video.chapters.length, missing: B.video.missing }, role_brief: B.role_brief.slice(0, 40) }));
    console.log('   ' + label + ' schema ->', Q.schema_types.join(', '), '| eeat notes', Q.eeat_notes.length, '| unverified stats', JSON.stringify(Q.unverified_statistics));
    console.log('   ' + label + ' package ->', JSON.stringify({ byline: /class="byline"/.test(html), author_box: /class="author-box"/.test(html), toc: (html.match(/<nav class="toc"/g) || []).length, toc_links: (html.match(/href="#/g) || []).length, h2_ids: (html.match(/<h2 id="/g) || []).length, cluster: /Guides in this series/.test(html), snapshot: /case-snapshot/.test(html), nap: /class="nap"/.test(html), video: /<iframe/.test(html), transcript: /class="transcript"/.test(html), image_markers_left: /\[Image:/.test(html + md), placeholders: (html.match(/\[(Author Name|Job title|Phone|Street address[^\]]*)\]/g) || []).length, checklist: M.publish_checklist.length, meta_role: M.page_role, md_byline: /^\*By /m.test(md), md_author: /About the author/.test(md) }));
    return { B, Q, M, html, md, doc };
  };
  const publish = async (label, html, keyword, logPage, ladderRows) => {
    const url = 'https://northwind-erp.com/' + label + '/';
    mock('Normalize Input', [{ json: { mode: 'published', domain: 'northwind-erp.com', keyword, published_url: url, content_request_id: '', via_webhook: true, callback_url: 'https://hooks.example.com/x' } }]);
    mock('Fetch Published Page', { statusCode: 200, headers: {}, data: html });
    mock('Load Content Log (Published)', [{ json: { site_id: SITE, domain: 'northwind-erp.com', keyword, source: 'manual', page_type: logPage, existing_page_url: '', rung: 0, ladder_id: '', request_id: 'r1', started_at: '2026-10-01T10:00:00.000Z', status: 'started', published_url: '', published_at: '', week: '2026-10-01' } }]);
    mock('Load Ladders (Published)', ladderRows || [{ json: {} }]); mock('Load Query History (Published)', [{ json: {} }]);
    const pc = await run('Publish Check', store['Load Query History (Published)']); const c = pc[0].json;
    const v44 = c.checks.filter(x => /Author named|Date shown|author placeholders|Table of contents|cluster pages|LocalBusiness|Phone number|VideoObject|transcript/i.test(x.name));
    console.log('   ' + label + ' live check ->', c.passed + '/' + c.checks.length, '| signals', JSON.stringify(c.page_signals), '\n      ' + v44.map(x => (x.ok ? 'OK ' : 'FIX ') + x.name + ': ' + x.detail).join('\n      '));
    return c;
  };
  const kw = pvS1.keyword;
  // (a) hub: the ladder's top page (rung 4) with the profile (author + reviewer); 4 rung pages, 2 of them live
  const rungLinks = [['erp data migration checklist', 1, false], ['erp implementation cost uae', 1, false], ['odoo vs business central', 2, true], ['erp go-live plan', 2, true]].map(([k, r, planned]) => ({ url: 'https://northwind-erp.com/' + k.replace(/ /g, '-') + '/', path: '/' + k.replace(/ /g, '-') + '/', role: 'rung ' + r, keyword: k, planned }));
  const hub = await pipeline('hub', { page_type: 'Guide', ladder_rung: 4, ladder_id: 'lad_hub', ladder_head: kw, ladder_links: rungLinks }, { profile: profileRow });
  const hubLadder = [{ json: { ladder_id: 'lad_hub', domain: 'northwind-erp.com', head_keyword: kw, rung: 4, page_no: 5, keyword: kw, page_type: 'Guide', target_url: 'https://northwind-erp.com/hub/', page_exists: false, status: 'writing' } },
    ...rungLinks.map((l, i) => ({ json: { ladder_id: 'lad_hub', domain: 'northwind-erp.com', head_keyword: kw, rung: Number(l.role.slice(-1)), page_no: i + 1, keyword: l.keyword, page_type: 'Guide', target_url: l.url, page_exists: !l.planned, status: l.planned ? 'planned' : 'published' } }))];
  await publish('hub', hub.html, kw, 'Guide', hubLadder);
  // (b) case study: anonymised client, an older published case study as proof, numbers from the case facts in the copy
  const cs = { client_name: 'Gulf Fresh Foods', client_public: false, industry: 'food distribution', location: 'Dubai', service: 'Odoo implementation', challenge: 'Orders keyed twice; month-end close took 9 days.', solution: 'Odoo 18 with inventory, purchase and accounting; three migration rehearsals.', timeline: '14 weeks', results: 'Month-end close from 9 days to 3; stock accuracy from 92% to 99.4%; AED 180,000 a year saved in write-offs.', quote: 'We close the month in three days now.', quote_by: 'Rami Saleh, Finance Director' };
  const older = [{ json: { case_id: 'cs_old', site_id: SITE, domain: 'northwind-erp.com', keyword: 'business central case study', title: 'Atlas Trading: Business Central', client_name: 'Atlas Trading', client_public: true, industry: 'trading', location: 'Sharjah', service: 'Business Central', challenge: 'x', solution: 'y', timeline: '10 weeks', results: 'Invoices posted same day instead of 4 days', quote: 'Fast.', quote_by: 'Lina Aziz, CFO', page_url: 'https://northwind-erp.com/case-studies/atlas-trading/', status: 'published', created_at: '2026-08-01T10:00:00.000Z', request_id: 'r0' } },
    { json: { case_id: 'cs_1', site_id: SITE, domain: 'northwind-erp.com', keyword: 'odoo implementation case study', title: 'self', status: 'writing', created_at: '2026-10-02T10:00:00.000Z' } }];
  const csDraft = V.draftV5() + '\n\nStock accuracy rose from 92% to 99.4% and write-offs fell by AED 180,000 a year. Teams that rehearse migration three times report 40% fewer go-live defects.\n';
  const csr = await pipeline('case-study', { page_type: 'Case Study', case_study: cs, case_id: 'cs_1', keyword: 'odoo implementation case study' }, { profile: profileRow, cases: older, draft: csDraft });
  console.log('   case study facts ->', JSON.stringify({ proof_titles: csr.B.proof_library.map(p => p.title), self_excluded: !csr.B.proof_library.some(p => p.title === 'self'), anonymised_in_facts: /do NOT name them/.test(csr.B.role_writer), aed_kept: /AED 180,000/.test(csr.Q ? csr.doc : ''), case_stat_exempt: !csr.Q.unverified_statistics.includes('99.4%'), invented_stat_flagged: csr.Q.unverified_statistics.includes('40%'), snapshot_client: (csr.M.case_study || {}).snapshot && csr.M.case_study.snapshot.Client }));
  await publish('case-study', csr.html, 'odoo implementation case study', 'Case Study');
  // (c) local page with the full profile, and (c2) without any profile
  const loc = await pipeline('local', { page_type: 'Local Page', local_area: 'Dubai Marina' }, { profile: profileRow });
  const lbBlock = (loc.M.schema_blocks.find(b => /Service|Business/.test(b.type) && b.type !== 'Service') || {}).json || {};
  console.log('   local schema ->', JSON.stringify({ type: lbBlock['@type'], tel: lbBlock.telephone, street: (lbBlock.address || {}).streetAddress, areas: (lbBlock.areaServed || []).map(a => a.name), hours: lbBlock.openingHours, local_meta: loc.M.local }));
  await publish('local', loc.html, kw, 'Local Page');
  const loc2 = await pipeline('local-no-profile', { page_type: 'Local Page', local_area: 'Dubai Marina' }, {});
  console.log('   local without profile -> eeat notes', JSON.stringify(loc2.Q.eeat_notes), '| nap placeholders', /\[Phone\]/.test(loc2.html));
  // (d) video page (blog post, no profile): YouTube page read for title, upload date and duration; transcript with VTT cues and chapters
  const vid = { url: 'https://youtu.be/AbCdEfGhIjK', provider: 'youtube', id: 'AbCdEfGhIjK', embed_url: 'https://www.youtube.com/embed/AbCdEfGhIjK', fetch_url: 'https://www.youtube.com/watch?v=AbCdEfGhIjK', thumbnail_url: 'https://i.ytimg.com/vi/AbCdEfGhIjK/hqdefault.jpg', title: '', description: '', placement: '',
    transcript: 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nWelcome to the go-live walkthrough.\n\n0:00 Intro\n1:30 Data migration rehearsals\n4:10 Go-live weekend\n\n' + Array.from({ length: 80 }, (_, i) => 'We moved stock, open orders and balances in rehearsal ' + (i % 3 + 1) + '.').join(' '), upload_date: '', duration: '' };
  const ytPage = '<html><head><meta property="og:title" content="ERP go-live in 14 weeks &amp; what we learned"><meta property="og:description" content="0:00 Intro&#10;1:30 Data migration"><meta itemprop="uploadDate" content="2026-08-14T07:00:00-07:00"><meta itemprop="duration" content="PT6M12S"></head><body>...</body></html>';
  const vp = await pipeline('video', { page_type: 'Blog Post', video: vid }, { videoFetch: { statusCode: 200, headers: {}, data: ytPage } });
  const vo = (vp.M.schema_blocks.find(b => b.type === 'VideoObject') || {}).json || {};
  console.log('   video schema ->', JSON.stringify({ name: vo.name, upload: vo.uploadDate, duration: vo.duration, thumb: vo.thumbnailUrl, clips: (vo.hasPart || []).map(c => c.name + '@' + c.startOffset + '-' + c.endOffset), embed: vo.embedUrl, iframe_nocookie: /youtube-nocookie\.com\/embed\/AbCdEfGhIjK/.test(vp.html), vtt_stripped: !/-->/.test(vp.html), meta_video: vp.M.video && vp.M.video.missing }));
  await publish('video', vp.html, kw, 'Blog Post');
  // Vimeo oEmbed + a page without details found
  mock('Parse Verdict', [{ json: { ...pvS1, page_type: 'Blog Post', video: { url: 'https://vimeo.com/123456789', provider: 'vimeo', id: '123456789', embed_url: 'https://player.vimeo.com/video/123456789', fetch_url: 'https://vimeo.com/api/oembed.json?url=x', thumbnail_url: '', transcript: '' } } }]);
  mock('Load Profile (Brief)', [{ json: {} }]); mock('Load Case Studies (Brief)', [{ json: {} }]);
  mock('Fetch Video Details', { statusCode: 200, headers: {}, data: JSON.stringify({ title: 'Warehouse tour', duration: 245, upload_date: '2026-07-01 09:30:00', thumbnail_url: 'https://i.vimeocdn.com/video/1.jpg' }) });
  const vm = await run('Brief Context', store['Load Case Studies (Brief)']); console.log('   vimeo ->', JSON.stringify({ title: vm[0].json.video.title, dur: vm[0].json.video.duration_iso, date: vm[0].json.video.upload_date, thumb: !!vm[0].json.video.thumbnail_url, missing: vm[0].json.video.missing }));
  mock('Fetch Video Details', { statusCode: 429, headers: {}, data: 'Too many requests' }); mock('Parse Verdict', [{ json: { ...pvS1, page_type: 'Blog Post', video: vid } }]);
  const vf = await run('Brief Context', store['Load Case Studies (Brief)']); console.log('   youtube page not readable ->', JSON.stringify({ found: vf[0].json.video.details_found, missing: vf[0].json.video.missing, chapters: vf[0].json.video.chapters.length }));
  // intake: page types, local area from the keyword, video URL parsing, validation
  mock('Start Form', F.forms.startKeyword);
  const base = { ...F.forms.pageKeyword };
  const pt1 = await run('Normalize Input', { ...base, 'Page Type': 'Pillar / hub page' }); console.log('   pillar ->', pt1[0].json.page_type);
  const pt2 = await run('Normalize Input', { ...base, 'Target Keyword': 'erp consultants in dubai marina', 'Page Type': 'Local page (city or area)' }); console.log('   local from keyword ->', pt2[0].json.page_type, '|', pt2[0].json.local_area, '|', pt2[0].json.validation_error);
  const pt3 = await run('Normalize Input', { ...base, 'Page Type': 'Local page (city or area)' }); console.log('   local without area ->', JSON.stringify(pt3[0].json.validation_error));
  const pt4 = await run('Normalize Input', { ...base, 'Video URL for this page (optional)': 'https://youtu.be/AbCdEfGhIjK?t=4', 'Video transcript (optional)': '0:00 Intro\n1:30 Data' }); const v4 = pt4[0].json.video || {}; console.log('   video url ->', JSON.stringify({ provider: v4.provider, id: v4.id, fetch: v4.fetch_url, thumb: v4.thumbnail_url, transcript: v4.transcript.length }));
  const pt5 = await run('Normalize Input', { ...base, 'Video URL for this page (optional)': 'youtube.com/watch?v=x' }); console.log('   bad video url ->', JSON.stringify(pt5[0].json.validation_error));
  // length bands for the new page types
  for (const [ptype, rec, extra] of [['Pillar Page', 1200, {}], ['Guide', 1200, { ladder_rung: 4 }], ['Case Study', 2600, {}], ['Local Page', 600, {}], ['Service Page', 3000, {}]]) {
    mock('Collect Facts', { ...pvS1, page_type: ptype, ...extra }); mock('Competitor Analyzer', { output: { ...F.competitorAnalysis, recommended_word_count: rec } });
    const pa = await run('Parse Analysis', store['Competitor Analyzer']); console.log('   length band', ptype + (extra.ladder_rung ? ' (ladder top)' : ''), rec, '->', pa[0].json.competitor_analysis.recommended_word_count);
  }
});

// ===================================================================================
await guard('ai visibility', async () => {
  reset(); begin('S19 AI Visibility Tracker — plan, prompts, requests, real engine answers, metrics, rows, report, second week, ad hoc');
  const M = require('./fixtures_monitors');
  const same2 = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  const ANS = ['site_id', 'domain', 'run_id', 'checked_at', 'prompt_id', 'prompt', 'kind', 'topic', 'engine', 'answered', 'mentioned', 'cited', 'rank', 'our_urls', 'competitors', 'sources', 'excerpt', 'cost', 'error'];
  const VIS = ['site_id', 'domain', 'run_id', 'checked_at', 'prompts', 'answers', 'mention_rate', 'citation_rate', 'share_of_voice', 'avg_rank', 'aio_presence', 'aio_citation_rate', 'engines_json', 'competitors_json', 'sources_json', 'pages_json', 'gaps_json', 'market_json', 'market_month', 'cost_usd', 'alerts'];
  const PRC = ['prompt_id', 'site_id', 'domain', 'prompt', 'kind', 'topic', 'keyword', 'source', 'status', 'created_at'];
  const PROS = ['site_id', 'domain', 'prospect_domain', 'type', 'rank', 'spam_score', 'detail', 'source_url', 'target_url', 'status', 'first_seen', 'last_seen', 'won_at', 'outreach_subject', 'outreach_body', 'note'];
  const loadAll = (o = {}) => { mock('Load Sites', M.sites()); mock('Load Ladders', M.ladders()); mock('Load Monitors', M.monitors()); mock('Load Profiles', M.profiles()); mock('Load AI Prompts', o.prompts || [{ json: {} }]); mock('Load AI Visibility', o.vis || [{ json: {} }]); mock('Load Link Prospects', o.prospects || [{ json: {} }]); };
  loadAll();
  const plan = await run('AI Plan', store['Load Link Prospects']); const P = plan[0].json;
  console.log('   plan ->', JSON.stringify({ sites: plan.length, brand: P.brand_names, competitors: P.competitors, topics: P.topics, engines: P.engines, need_prompts: P.need_prompts, needed: P.prompts_needed, market_due: P.market_due, run_id: P.run_id }));
  const stj = await run('Site Text Jobs', plan); console.log('   site text needed ->', JSON.stringify(stj[0].json));
  const jobs = await run('Prompt Jobs', plan); console.log('   prompt jobs ->', jobs.length, JSON.stringify({ count: jobs[0].json.count, brand_prompt_needed: !jobs[0].json.has_brand_prompt }));
  mock('Prompt Writer', [{ json: M.promptWriter }]);
  const pr = await run('Prompt Rows', store['Prompt Writer']);
  console.log('   prompt rows ->', pr.length, '| cols exact', same2(Object.keys(pr[0].json), PRC), '| kinds', [...new Set(pr.map(r => r.json.kind))].join(','), '| duplicate dropped', pr.filter(r => /best ERP implementation partners/.test(r.json.prompt)).length === 1);
  mock('Save Prompts', pr);
  const rq = await run('AI Requests', pr); const R = rq.map(r => r.json);
  const byE = R.reduce((m, r) => { m[r.engine] = (m[r.engine] || 0) + 1; return m; }, {});
  console.log('   requests ->', R.length, JSON.stringify(byE), '| est $' + R.reduce((s, r) => s + r.est_cost, 0).toFixed(2), '| chatgpt via scraper', /llm_scraper/.test(R.find(r => r.engine === 'chatgpt').endpoint), '| aio keyword', R.find(r => r.engine === 'ai_overview').body[0].keyword, '| no AIO for brand', !R.some(r => r.engine === 'ai_overview' && r.kind === 'brand'));
  // real answers; the client is named + cited by ChatGPT and Claude on the recommend questions, Gemini fails once
  const us = (q) => q.kind === 'recommend' && (q.engine === 'chatgpt' || q.engine === 'claude');
  mock('Run AI Requests', R.map((q, i) => M.answerFor(q, i, { us, fail: (q2, j) => q2.engine === 'gemini' && j === R.findIndex(x => x.engine === 'gemini') })));
  const pa = await run('Parse AI Answers', store['Run AI Requests']); const A = pa.map(r => r.json);
  console.log('   answers ->', A.length, '| cols exact', same2(Object.keys(A[0]), ANS), '| answered', A.filter(a => a.answered).length, '| named', A.filter(a => a.mentioned).length, '| cited', A.filter(a => a.cited).length, '| errors', A.filter(a => a.error).length, '| market not stored', !A.some(a => a.engine === 'market'));
  const cg = A.find(a => a.engine === 'chatgpt' && a.mentioned); const cl = A.find(a => a.engine === 'claude' && a.mentioned);
  console.log('   chatgpt answer ->', JSON.stringify({ rank: cg.rank, our_urls: cg.our_urls, competitors: cg.competitors.split(', ').slice(0, 5), sources: cg.sources.split(', ').slice(0, 4) }));
  console.log('   claude answer ->', JSON.stringify({ rank: cl.rank, cited: cl.cited, our_urls: cl.our_urls, competitors: cl.competitors.split(', ').slice(0, 4) }), '| gemini sources from titles', A.find(a => a.engine === 'gemini' && a.answered).sources.split(', ').slice(0, 3));
  console.log('   aio / ai mode ->', JSON.stringify({ aio: A.filter(a => a.engine === 'ai_overview').map(a => a.answered + ':' + a.sources.split(', ').slice(0, 2).join('+')), ai_mode_sources: A.find(a => a.engine === 'ai_mode').sources.split(', ').slice(0, 3) }));
  mock('Save AI Answers', pa);
  const mt = await run('AI Metrics', store['Save AI Answers']); const X = mt[0].json;
  console.log('   metrics ->', JSON.stringify(X.metrics));
  console.log('   engines ->', Object.values(X.engines).map(e => e.name + ' ' + e.mentioned + '/' + e.answered + (e.errors ? ' (' + e.errors + ' err)' : '')).join(' | '));
  console.log('   competitors ->', X.competitors.map(c => c.domain + ' ' + c.mentions + ' ' + c.share + '%' + (c.auto ? ' auto' : '')).join(' | '));
  console.log('   sources AI trusts ->', X.sources.slice(0, 6).map(s => s.domain + ' ' + s.citations + ' ' + s.kind).join(' | '), '| our pages', X.our_pages.map(x => x.url).join(' '));
  console.log('   gaps ->', X.gaps.length, '| market ->', JSON.stringify({ top: (X.market.top || []).slice(0, 3).map(x => x.domain + ' ' + x.mentions), you: X.market.you, total: X.market.total_mentions }));
  console.log('   actions ->', X.actions.map(a => '[' + a.type + '] ' + a.action).join(' | '), '| content action body', !!(X.actions.find(a => a.api_body) || {}).api_body);
  console.log('   alerts ->', JSON.stringify(X.alerts.map(a => a.text)));
  const vr = await run('AI Vis Rows', mt); console.log('   vis row ->', JSON.stringify({ cols_exact: same2(Object.keys(vr[0].json), VIS), mention: vr[0].json.mention_rate, sov: vr[0].json.share_of_voice, market_month: vr[0].json.market_month, cost: vr[0].json.cost_usd }));
  const ap = await run('AI Prospect Rows', vr); console.log('   ai_source prospects ->', ap.length, '| cols exact', same2(Object.keys(ap[0].json), PROS), '| first', ap[0].json.prospect_domain, ap[0].json.status, '|', ap[0].json.detail);
  const bi = await run('AI Brief Input', ap); console.log('   brief facts ->', bi[0].json.facts.length, 'chars');
  mock('AI Brief', [{ json: { output: { headline: 'ChatGPT and Claude name Northwind ERP for 2 of 8 questions; Azentio leads', summary: 'You appear in ...', actions: [{ priority: 1, action: 'Get listed on mof.gov.ae', why: 'cited 9 times' }], watch: ['Gemini'] } } }]);
  const rp = await run('AI Report', store['AI Brief']); const html = rp[0].json.html; save('ai-visibility-report.html', html); scanHtml('ai visibility report', html);
  console.log('   report ->', JSON.stringify({ subject: rp[0].json.subject, grid_rows: (html.match(/<tr>/g) || []).length, has_market: /Market view/.test(html), has_sources: /Sources AI relies on/.test(html), api_bodies: (html.match(/POST http/g) || []).length, file: rp[0].binary.data.fileName }));
  mock('Render PDF AI', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  await run('Prepare PDF AI', rp); const att = await run('Attach PDF AI', store['Render PDF AI']); const cb = await run('Build AI Callback', att);
  console.log('   callback ->', JSON.stringify({ stage: cb[0].json.stage, keys: Object.keys(cb[0].json).length, pdf: !!cb[0].json.pdf, no_html: !cb[0].json.html, binaries_kept: Object.keys(att[0].binary).join(',') }));
  // second week: same questions (none written), previous row, the client no longer named -> alert + deltas; market carried within the month
  const savedPrompts = pr.map(r => r);
  loadAll({ prompts: savedPrompts, vis: vr, prospects: ap });
  const plan2 = await run('AI Plan', store['Load Link Prospects']); console.log('   week 2 plan ->', JSON.stringify({ need_prompts: plan2[0].json.need_prompts, prompts: plan2[0].json.prompts.length, market_due: plan2[0].json.market_due, previous: !!plan2[0].json.previous, auto_rivals: plan2[0].json.competitors }));
  await run('Prompt Jobs', plan2); const pr2 = await run('Prompt Rows', [{ json: { skip: true } }]); console.log('   week 2 prompt rows ->', JSON.stringify(pr2[0].json));
  const rq2 = await run('AI Requests', pr2); mock('Run AI Requests', rq2.map((q, i) => M.answerFor(q.json, i, { noAio: true })));
  await run('Parse AI Answers', store['Run AI Requests']); const mt2 = await run('AI Metrics', store['Parse AI Answers']);
  console.log('   week 2 ->', JSON.stringify({ mention: mt2[0].json.metrics.mention_rate, delta: mt2[0].json.metrics.delta, aio_presence: mt2[0].json.metrics.aio_presence, alerts: mt2[0].json.alerts.map(a => a.level), market_carried: !!(mt2[0].json.market || {}).carried, prospects_status_kept: mt2[0].json.prospect_rows[0].status, first_seen_kept: mt2[0].json.prospect_rows[0].first_seen === ap[0].json.first_seen }));
  // ad hoc on-demand domain, prompt writer failure -> templates, nothing to do
  mock('Manual Run', { domain: 'https://www.newclient.ae/', email: 'x@newclient.ae', country: 'United Arab Emirates', location_code: 2784, competitors: ['rival.ae'] }); loadAll();
  const p3 = await run('AI Plan', store['Load Link Prospects']); console.log('   ad hoc ->', JSON.stringify({ domain: p3[0].json.domain, adhoc: p3[0].json.adhoc, on_demand: p3[0].json.on_demand, email: p3[0].json.email, competitors: p3[0].json.competitors, topics: p3[0].json.topics, need_prompts: p3[0].json.need_prompts, need_site_text: p3[0].json.need_site_text }));
  const st3 = await run('Site Text Jobs', p3); mock('Read Site (AI)', [{ json: { site_text: 'NewClient — VAT and e-invoicing advisory for UAE SMEs. Services: VAT registration, corporate tax filing, e-invoicing readiness.' } }]);
  const pj3 = await run('Prompt Jobs', store['Read Site (AI)']); console.log('   prompt job with site text ->', st3.length, JSON.stringify(st3[0].json), '|', (pj3[0].json.site_text || '').slice(0, 40));
  mock('Manual Run', { domain: 'newclient.ae', email: 'x@newclient.ae', topics: ['vat registration uae'] }); const p3b = await run('AI Plan', store['Load Link Prospects']); console.log('   ad hoc with topics ->', JSON.stringify({ topics: p3b[0].json.topics, need_site_text: p3b[0].json.need_site_text }));
  mock('Prompt Writer', [{ json: { error: 'model failed' } }]); await run('Prompt Jobs', p3);
  delete store['Manual Run']; mock('AI Plan', [{ json: { ...p3[0].json, topics: ['erp dubai'], need_prompts: true, prompts_needed: 4, business_name: 'New Client' } }]); mock('Prompt Jobs', [{ json: { site_id: p3[0].json.site_id } }]);
  const pr3 = await run('Prompt Rows', store['Prompt Writer']); console.log('   template fallback ->', pr3.length, pr3.map(r => r.json.kind + ':' + r.json.source).join(','), '|', pr3[0].json.prompt);
  mock('Load Sites', [{ json: {} }]); mock('Load Ladders', [{ json: {} }]); const p4 = await run('AI Plan', store['Load Link Prospects']); console.log('   nothing to do ->', JSON.stringify(p4[0].json));
  mock('Load Monitors', M.monitors({ ai_visibility: false })); mock('Load Sites', M.sites()); const p5 = await run('AI Plan', store['Load Link Prospects']); console.log('   switched off ->', JSON.stringify(p5[0].json));
});

// ===================================================================================
await guard('backlinks', async () => {
  reset(); begin('S20 Backlink Monitor — full run (real backlink data), gap, mentions, reclaim, outreach, pipeline, won, light run');
  const M = require('./fixtures_monitors');
  const same2 = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  const SNAP = ['site_id', 'domain', 'checked_at', 'mode', 'rank', 'backlinks', 'referring_domains', 'referring_domains_nofollow', 'spam_score', 'broken_backlinks', 'new_links', 'lost_links', 'important_lost', 'spammy_new', 'lost_json', 'new_json', 'competitors_json', 'timeseries_json', 'cost_usd'];
  const PROS = ['site_id', 'domain', 'prospect_domain', 'type', 'rank', 'spam_score', 'detail', 'source_url', 'target_url', 'status', 'first_seen', 'last_seen', 'won_at', 'outreach_subject', 'outreach_body', 'note'];
  const loadAll = (o = {}) => { mock('Load Sites', M.sites()); mock('Load Ladders', M.ladders()); mock('Load Monitors', o.monitors || M.monitors()); mock('Load Profiles', M.profiles()); mock('Load Backlink Snapshots', o.snaps || [{ json: {} }]); mock('Load Link Prospects', o.prospects || [{ json: {} }]);
    mock('Load Content Log', [{ json: { site_id: M.SITE, domain: M.DOMAIN, keyword: 'erp for distributors', published_url: 'https://northwind-erp.com/erp-for-distributors/', status: 'published' } }]); mock('Load Case Studies', [{ json: { case_id: 'cs_1', site_id: M.SITE, title: 'Gulf Fresh Foods: Odoo', page_url: 'https://northwind-erp.com/case-studies/gulf-fresh/' } }]); };
  // an existing prospect that now links (won) and an AI-source prospect without a draft
  loadAll({ prospects: [{ json: { site_id: M.SITE, domain: M.DOMAIN, prospect_domain: 'uae-asp.ae', type: 'gap', rank: 25, spam_score: 0, detail: 'old', source_url: '', target_url: '', status: 'contacted', first_seen: '2026-08-01T00:00:00.000Z', last_seen: '2026-08-01T00:00:00.000Z', won_at: '', outreach_subject: 's', outreach_body: 'b', note: 'emailed Ali' } },
    { json: { site_id: M.SITE, domain: M.DOMAIN, prospect_domain: 'zawya.com', type: 'ai_source', rank: 0, spam_score: 0, detail: 'Cited 4x in AI answers', status: 'new', first_seen: '2026-10-01T00:00:00.000Z', last_seen: '2026-10-01T00:00:00.000Z', outreach_body: '' } }] });
  const plan = await run('BL Plan', store['Load Case Studies']); const P = plan[0].json;
  console.log('   plan ->', JSON.stringify({ mode: P.mode, since: P.since.slice(0, 10), competitors: P.competitors, need_competitors: P.need_competitors, brand: P.brand_names, assets: P.assets.map(a => a.kind) }));
  const rq = await run('BL Requests', plan); console.log('   requests ->', rq.length, rq.map(r => r.json.kind).join(','), '| lost filter', JSON.stringify(rq.find(r => r.json.kind === 'lost').json.body[0].filters));
  mock('Run BL Requests', rq.map(r => M.blFor(r.json)));
  const gr = await run('Gap Requests', store['Run BL Requests']); console.log('   gap request ->', JSON.stringify({ competitors: gr[0].json.competitors, mode: gr[0].json.body[0].intersection_mode, exclude: gr[0].json.body[0].exclude_targets }));
  mock('Run Gap Requests', [M.gap()]);
  const pb = await run('Parse Backlinks', store['Run Gap Requests']); const B = pb[0].json;
  console.log('   profile ->', JSON.stringify(B.summary));
  console.log('   lost ->', B.lost.length, '| important', B.important_lost.map(l => l.from_domain + ' ' + l.domain_rank).join(','), '| new', B.new_links.length, '| spammy', B.spammy.length, B.spammy.slice(0, 2).map(l => l.from_domain).join(','));
  console.log('   reclaim ->', JSON.stringify(B.reclaim.map(r => ({ url: r.broken_url, links: r.links, domains: r.domains, to: r.redirect_to }))));
  console.log('   gap ->', B.gap.length, B.gap.slice(0, 4).map(g => g.domain + ' r' + g.rank + ' ' + g.links_to.join('+')).join(' | '), '| mentions', B.mentions.map(m => m.domain).join(','), '| timeseries', B.timeseries.length);
  console.log('   alerts ->', JSON.stringify(B.alerts.map(a => a.level + ': ' + a.text.slice(0, 70))), '| deliver', B.deliver, '| disavow lines', (B.disavow_text.match(/^domain:/gm) || []).length, '| cost', B.cost_usd);
  const oj = await run('Outreach Jobs', pb); console.log('   outreach jobs ->', oj.length, JSON.stringify(oj[0].json.prospects.map(p => p.type + ':' + p.prospect_domain).slice(0, 8)));
  mock('Outreach Writer', [{ json: M.outreach }]);
  const prw = await run('Prospect Rows', store['Outreach Writer']); const PR = prw.map(r => r.json);
  console.log('   prospect rows ->', PR.length, '| cols exact', same2(Object.keys(PR[0]), PROS), '| types', JSON.stringify(PR.reduce((m, r) => { m[r.type] = (m[r.type] || 0) + 1; return m; }, {})));
  const won = PR.find(r => r.prospect_domain === 'uae-asp.ae'); const lostP = PR.find(r => r.type === 'lost'); const zaw = PR.find(r => r.prospect_domain === 'zawya.com');
  console.log('   pipeline ->', JSON.stringify({ won: won && [won.status, !!won.won_at, won.note], lost_draft: lostP && !!lostP.outreach_body, ai_source_touched: !!zaw, reclaim_target: (PR.find(r => r.type === 'reclaim') || {}).target_url }));
  mock('Save Prospects', prw); const sr = await run('BL Snapshot Rows', prw); console.log('   snapshot ->', JSON.stringify({ cols_exact: same2(Object.keys(sr[0].json), SNAP), rd: sr[0].json.referring_domains, important_lost: sr[0].json.important_lost, spammy: sr[0].json.spammy_new }));
  mock('Save BL Snapshot', sr); const rp = await run('BL Report', sr); const html = rp[0].json.html; save('backlink-report.html', html); scanHtml('backlink report', html);
  console.log('   report ->', JSON.stringify({ subject: rp[0].json.subject, binaries: Object.keys(rp[0].binary), drafts: (html.match(/<pre style="white-space:pre-wrap/g) || []).length, csv_rows: Buffer.from(rp[0].binary.prospects_csv.data, 'base64').toString().split('\n').length - 1, pipeline: rp[0].json.pipeline }));
  save('prospects.csv', Buffer.from(rp[0].binary.prospects_csv.data, 'base64').toString()); save('disavow-candidates.txt', Buffer.from(rp[0].binary.disavow_txt.data, 'base64').toString());
  mock('Render PDF BL', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  await run('Prepare PDF BL', rp); const att = await run('Attach PDF BL', store['Render PDF BL']); const cb = await run('Build BL Callback', att);
  console.log('   attach + callback ->', JSON.stringify({ binaries: Object.keys(att[0].binary), files: Object.keys(cb[0].json.files), stage: cb[0].json.stage, no_refdomains: cb[0].json.refdomains === undefined }));
  // light run in the same month: 3 requests, quiet without an important loss
  loadAll({ snaps: sr });
  const p2 = await run('BL Plan', store['Load Case Studies']); const rq2 = await run('BL Requests', p2);
  console.log('   light run ->', JSON.stringify({ mode: p2[0].json.mode, since_last: p2[0].json.since.slice(0, 10), requests: rq2.map(r => r.json.kind), competitors_kept: p2[0].json.competitors }));
  const quietLost = JSON.parse(JSON.stringify(M.blLost())); quietLost.tasks[0].result[0].items = []; const quietNew = JSON.parse(JSON.stringify(quietLost));
  mock('Run BL Requests', rq2.map(r => r.json.kind === 'lost' ? quietLost : r.json.kind === 'new' ? quietNew : M.blFor(r.json))); const g2 = await run('Gap Requests', store['Run BL Requests']); delete store['Run Gap Requests'];
  const pb2 = await run('Parse Backlinks', g2); console.log('   light parse ->', JSON.stringify({ deliver: pb2[0].json.deliver, alerts: pb2[0].json.alerts.map(a => a.level), gap: pb2[0].json.gap.length }));
  await run('Outreach Jobs', pb2); const pr2 = await run('Prospect Rows', [{ json: { skip: true } }]); await run('BL Snapshot Rows', pr2); const rp2 = await run('BL Report', store['BL Snapshot Rows']); console.log('   quiet week -> report items', rp2.length);
  // no competitors configured: Labs competitors are requested and the gap uses them
  loadAll({ monitors: M.monitors({ competitors: '' }) }); const p3 = await run('BL Plan', store['Load Case Studies']); const rq3 = await run('BL Requests', p3);
  mock('Run BL Requests', rq3.map(r => M.blFor(r.json))); const g3 = await run('Gap Requests', store['Run BL Requests']);
  console.log('   labs competitors ->', JSON.stringify({ requested: rq3.some(r => r.json.kind === 'competitors'), picked: g3[0].json.competitors }));
});

// ===================================================================================
await guard('audit upgrades', async () => {
  reset(); begin('S21 Audit — crawl options, brand & entity check, history + diff, internal links, fix pack, report, scheduler');
  const M = require('./fixtures_monitors');
  const same2 = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  mock('Start Form', F.forms.startAudit);
  const n = await run('Normalize Input', { ...F.forms.pageAuditTech, 'Pages to crawl': '500', 'Render JavaScript': 'Yes, the site is built with JavaScript (slower)' });
  console.log('   crawl options ->', JSON.stringify({ pages: n[0].json.crawl_max_pages, js: n[0].json.crawl_js, err: n[0].json.validation_error }));
  const nbad = await run('Normalize Input', { ...F.forms.pageAuditTech, 'Pages to crawl': '1000', 'Render JavaScript': 'Yes, the site is built with JavaScript (slower)' }); console.log('   1000 + JS ->', JSON.stringify(nbad[0].json.validation_error));
  const n0 = await run('Normalize Input', F.forms.pageAuditTech); console.log('   default ->', n0[0].json.crawl_max_pages, n0[0].json.crawl_js);
  mock('Route Mode', n0);
  await run('Save Task ID', F.crawlTaskPost);
  await expectError('Check Crawl', F.summaryDone, /too long/, 30);   // a 200-page crawl may poll 25 times
  mock('Normalize Input', [{ json: { ...n0[0].json, crawl_max_pages: 1000 } }]); await run('Save Task ID', F.crawlTaskPost);
  const big = await run('Check Crawl', F.summaryDone, { runIndex: 30 }); console.log('   1000-page crawl polls 30 times ->', !!big.length);
  store['Normalize Input'] = n0; await run('Save Task ID', F.crawlTaskPost); await run('Check Crawl', F.summaryDone, { runIndex: 2 });
  mock('Get Crawled Pages', F.crawledPagesRes); await run('Crawl Extra Requests', store['Get Crawled Pages']); mock('Run Crawl Extras', F.extrasRes); await run('Collect Crawl Extras', store['Run Crawl Extras']);
  await run('Build Probes'); await run('Content Probes', store['Collect Crawl Extras']);
  const all6 = F.probeResults('apex'); mock('Run Probes', [all6[0], all6[2], all6[3], all6[4]]); mock('Run Content Probes', [all6[0], all6[1], all6[5], all6[6], all6[7], all6[8], ...all6.slice(9)]);
  const ap = await run('Analyze Probes', store['Run Content Probes']); const meas = ap[0].json.probe.measurements;
  console.log('   probe measurements ->', JSON.stringify({ robots: meas.robots_txt.length, ai_blocked: meas.ai_crawlers_blocked, llms: meas.llms_txt_present }));
  const gf = await runGscAudit(ap, 'ok');
  mock('Load Profile (Audit)', M.profiles()); const gq = await run('GBP Request', store['Load Profile (Audit)']);
  console.log('   gbp request ->', JSON.stringify({ skip: gq[0].json.skip, keyword: gq[0].json.body && gq[0].json.body[0].keyword, org: !!gq[0].json.homepage_org, phones: gq[0].json.homepage_phones }));
  mock('Fetch GBP', [M.gbpFound()]); const ec = await run('Entity Check', store['Fetch GBP']);
  const ent = ec[0].json.extra_findings.filter(f => f.category === 'AI Search Readiness' && !/AI crawler|llms/i.test(f.title));
  console.log('   entity findings ->', ent.map(f => '[' + f.severity + '] ' + f.title).join(' | '), '| entity.gbp', JSON.stringify((ec[0].json.entity || {}).gbp));
  const stranger = M.gbpFound(); Object.assign(stranger.tasks[0].result[0].items[0], { title: 'CECEP Techand Adnan site office', phone: '', url: 'http://www.sztechand.com/', domain: 'sztechand.com', category: 'Construction company' });
  mock('Fetch GBP', [M.gbpNone(), stranger]); const ecS = await run('Entity Check', store['Fetch GBP']); console.log('   unrelated listing ignored ->', JSON.stringify({ gbp: ecS[0].json.entity.gbp, others: ecS[0].json.entity.other_listings, false_findings: ecS[0].json.extra_findings.filter(f => /another website|name differs/.test(f.title)).length }));
  mock('Fetch GBP', [M.gbpNone()]); const ec2 = await run('Entity Check', store['Fetch GBP']); console.log('   gbp not found (local business) ->', ec2[0].json.extra_findings.filter(f => /Google Business Profile/.test(f.title)).map(f => f.severity + ' ' + f.title).join(' | '));
  store['Entity Check'] = ec;
  const bsi = await run('Build Site Issues', ec); const a = bsi[0].json.site_audit; console.log('   scored -> health', a.health_score, '| entity kept', !!a.entity, '| works', a.what_works.filter(w => /Google Business|sameAs/.test(w)).length);
  // first audit: no history -> baseline
  mock('Load Audit History', [{ json: {} }]); mock('Load Audit Findings', [{ json: {} }]);
  const dd = await run('Audit Diff', store['Load Audit Findings']); const D = dd[0].json.site_audit;
  console.log('   first audit ->', JSON.stringify({ baseline: D.audit_diff.baseline, audit_id: /^aud_/.test(dd[0].json.audit_id), internal_links: D.internal_links.length, sample: D.internal_links[0] }));
  const ar = await run('Audit Row', dd); const AUD = ['site_id', 'domain', 'audit_id', 'audited_at', 'report_type', 'health_score', 'grade', 'pages_crawled', 'findings', 'critical', 'high', 'medium', 'low', 'scheduled', 'request_id'];
  console.log('   audit row ->', JSON.stringify({ cols_exact: same2(Object.keys(ar[0].json), AUD), score: ar[0].json.health_score, findings: ar[0].json.findings }));
  mock('Save Audit', ar); const fr = await run('Finding Rows', ar); const FC = ['site_id', 'domain', 'audit_id', 'audited_at', 'finding_key', 'category', 'severity', 'title', 'affected_count'];
  console.log('   finding rows ->', fr.length, '| cols exact', same2(Object.keys(fr[0].json), FC), '| key sample', fr[0].json.finding_key);
  mock('Save Findings', fr); const fp = await run('Fix Pack', fr); const FP = fp[0].json.fix_pack;
  console.log('   fix pack ->', FP.files.map(f => f.name).join(', '), '| binaries', Object.keys(fp[0].binary).length, '| props', fp[0].json.fix_props.length, '| robots changes', JSON.stringify(fp[0].json.site_audit.fix_pack.robots_changes));
  const fileOf = (nm) => (FP.files.find(f => f.name === nm) || {}).content || '';
  save('fix-pack-robots.txt', fileOf('robots.txt')); save('fix-pack-llms.txt', fileOf('llms.txt')); save('fix-pack-organization.jsonld', fileOf('organization.jsonld')); save('fix-pack-redirects.csv', fileOf('redirects.csv')); save('fix-pack-README.txt', fileOf('README.txt'));
  console.log('   robots.txt ->', JSON.stringify({ sitemap: /^Sitemap: https:\/\/.+sitemap\.xml/m.test(fileOf('robots.txt')), ai_group: /User-agent: OAI-SearchBot/.test(fileOf('robots.txt')) }), '| llms.txt ->', fileOf('llms.txt').split('\n').filter(l => /^## /.test(l)).join(' / '), '| redirects ->', fileOf('redirects.csv').split('\n').length - 2, 'rows', '| org sameAs', (JSON.parse(fileOf('organization.jsonld').replace(/<\/?script[^>]*>/g, '')).sameAs || []).length);
  mock('Zip Fix Pack', [{ json: {}, binary: { fix_pack_zip: { data: 'UEsDBA==', mimeType: 'application/zip', fileName: 'fix-pack.zip' } } }]);
  const ra = await run('Restore Audit Item', store['Zip Fix Pack']); console.log('   restore ->', JSON.stringify({ zipped: ra[0].json.fix_pack_zipped, binaries: Object.keys(ra[0].binary).length, site_audit_kept: !!ra[0].json.site_audit.audit_diff }));
  const rep = await run('Build Audit Report', ra); const doc = decode(rep); save('site-audit-report-v45.doc.html', doc); scanHtml('audit report v4.5', doc);
  console.log('   report sections ->', JSON.stringify({ progress: /Progress, Links, Brand/.test(doc), internal: /Internal links to add/.test(doc), brand: /Brand &amp; entity consistency|Brand & entity consistency/.test(doc), fixpack: /Fix pack \(attached\)/.test(doc), baseline_text: /First audit stored/.test(doc) }));
  await run('Prepare PDF Audit', rep); mock('Render PDF Audit', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const att = await run('Attach PDF Audit', store['Render PDF Audit']); console.log('   attach ->', Object.keys(att[0].binary).join(','));
  const resp = await run('Build Audit Response', att); console.log('   callback ->', JSON.stringify({ audit_id: !!resp[0].json.audit_id, diff: !!resp[0].json.audit_diff, internal_links: (resp[0].json.internal_links || []).length, entity: !!resp[0].json.entity, fix_files: ((resp[0].json.fix_pack || {}).files || []).length }));
  // second audit: the first one is history; one finding fixed, one new
  const prevAudit = { ...ar[0].json, audited_at: new Date(Date.now() - 31 * 864e5).toISOString(), health_score: a.health_score - 6 };
  const prevFindings = fr.map(r => ({ ...r.json, audit_id: prevAudit.audit_id })).slice(1).concat([{ ...fr[0].json, audit_id: prevAudit.audit_id, finding_key: 'Security|an old issue that is now gone', title: 'An old issue that is now gone', severity: 'High' }]);
  mock('Load Audit History', [{ json: prevAudit }]); mock('Load Audit Findings', prevFindings.map(j => ({ json: j })));
  const dd2 = await run('Audit Diff', store['Load Audit Findings']); const D2 = dd2[0].json.site_audit.audit_diff;
  console.log('   second audit diff ->', JSON.stringify({ baseline: D2.baseline, delta: D2.score_delta, days: D2.days_since, summary: D2.summary, fixed: D2.fixed.map(f => f.title), new: D2.new.map(f => f.title).slice(0, 2) }));
  mock('Restore Audit Item', [{ json: { ...dd2[0].json, site_audit: { ...dd2[0].json.site_audit, fix_pack: fp[0].json.site_audit.fix_pack } } }]);
  const rep2 = await run('Build Audit Report', store['Restore Audit Item']); const doc2 = decode(rep2); scanHtml('audit report (second)', doc2); console.log('   second report ->', /fixed<\/span>/.test(doc2), /score .* → <b>/.test(doc2));
  // scheduler: due / recently audited / on demand; the spawned body through Normalize Input
  mock('Load Sites', M.sites()); mock('Load Ladders', M.ladders()); mock('Load Monitors', M.monitors()); mock('Load Profiles', M.profiles()); mock('Load Audits', [{ json: {} }]);
  const sp = await run('Audit Schedule Plan', store['Load Audits']); console.log('   scheduler (due) ->', JSON.stringify(sp[0].json.body));
  mock('Load Audits', [{ json: { site_id: M.SITE, audited_at: new Date(Date.now() - 5 * 864e5).toISOString() } }]); const sp2 = await run('Audit Schedule Plan', store['Load Audits']); console.log('   scheduler (audited 5 days ago) ->', JSON.stringify(sp2[0].json));
  mock('Manual Run', { domain: M.DOMAIN }); const sp3 = await run('Audit Schedule Plan', store['Load Audits']); console.log('   scheduler (on demand) ->', sp3[0].json.body ? 'started ' + sp3[0].json.domain : JSON.stringify(sp3[0].json)); delete store['Manual Run'];
  delete store['Start Form']; const sn = await run('Normalize Input', { body: sp[0].json.body }); H.staticData.rate = undefined;
  const srl = await run('Rate Limit', sn); console.log('   scheduled audit run ->', JSON.stringify({ mode: sn[0].json.mode, pages: sn[0].json.crawl_max_pages, js: sn[0].json.crawl_js, scheduled: sn[0].json.scheduled, err: sn[0].json.validation_error, internal_key: !!H.staticData.rate.keys['audit:' + M.SITE], est: srl[0].json.ai_spend_estimate_usd }));
});

// ===================================================================================
await guard('monitor intake', async () => {
  reset(); begin('S22 Intake — AI visibility / backlink checks (form + API), Track my site monitor settings, Site Admin monitors / prospect / ai_prompts');
  const same2 = (a, b) => a.length === b.length && a.every(k => b.includes(k));
  mock('Start Form', { 'What do you want?': 'Check my AI visibility' });
  const n = await run('Normalize Input', { 'Website Domain': 'www.northwind-erp.com', 'Target Country': 'United Arab Emirates', 'Competitors (optional)': 'azentio.com, https://www.cleartax.com/ae', 'Email me the report': 'owner@northwind-erp.com' });
  console.log('   form ai visibility ->', JSON.stringify({ mode: n[0].json.mode, domain: n[0].json.domain, competitors: n[0].json.competitors, err: n[0].json.validation_error }));
  H.staticData.rate = undefined; H.staticData.ai_budget = undefined; const rl = await run('Rate Limit', n); console.log('   rate limit ->', JSON.stringify({ err: rl[0].json.validation_error, est: rl[0].json.ai_spend_estimate_usd, counted: H.staticData.rate.keys['owner@northwind-erp.com'] }));
  const ms = await run('Monitor Start', n); console.log('   monitor start body ->', JSON.stringify(ms[0].json));
  mock('Start AI Visibility', [{ json: {} }]); const st = await run('Monitor Started', store['Start AI Visibility']); console.log('   started ->', st[0].json.stage, st[0].json.status, '|', st[0].json.plain.split('\n')[0].slice(0, 120));
  delete store['Start Form'];
  const na = await run('Normalize Input', { body: { mode: 'backlinks', domain: 'northwind-erp.com', country: 'AE', competitors: ['azentio.com'], callback_url: 'https://hooks.example.com/x', request_id: 'bl-1' } });
  store['Normalize Input'] = na; await run('Monitor Start', na); delete store['Start AI Visibility']; mock('Start Backlink Monitor', [{ json: { error: { message: 'Workflow is not active' } } }]);
  const st2 = await run('Monitor Started', store['Start Backlink Monitor']); const br = await run('Build Monitor Response', st2); console.log('   api backlinks ->', JSON.stringify({ stage: br[0].json.stage, status: br[0].json.status, error: br[0].json.error, eta: br[0].json.estimated_minutes }));
  const nb = await run('Normalize Input', { body: { mode: 'ai_visibility', country: 'AE', callback_url: 'https://hooks.example.com/x' } }); console.log('   no domain ->', JSON.stringify(nb[0].json.validation_error));
  // Track my site: competitors from the form + monitors object from the API, merged over the stored row
  const MC = ['site_id', 'domain', 'ai_visibility', 'ai_engines', 'ai_prompts_max', 'backlinks', 'audit_monthly', 'audit_pages', 'audit_js', 'competitors', 'brand_names', 'updated_at', 'request_id'];
  const nt = await run('Normalize Input', { body: { mode: 'track', domain: 'northwind-erp.com', country: 'AE', competitors: 'azentio.com', monitors: { ai_engines: ['chatgpt', 'perplexity', 'bard'], audit_pages: 5000, backlinks: 'no' }, callback_url: 'https://hooks.example.com/x' } });
  mock('Load Monitors (Track)', [{ json: { site_id: 'site_northwind-erp-com', ai_prompts_max: 10, brand_names: 'Northwind', audit_js: true } }]);
  const mr = await run('Monitor Row (Track)', store['Load Monitors (Track)']); console.log('   track monitors ->', JSON.stringify({ cols_exact: same2(Object.keys(mr[0].json), MC), engines: mr[0].json.ai_engines, pages: mr[0].json.audit_pages, backlinks: mr[0].json.backlinks, prompts_kept: mr[0].json.ai_prompts_max, brand_kept: mr[0].json.brand_names, js_kept: mr[0].json.audit_js, competitors: mr[0].json.competitors }));
  // Site Admin
  const aa = await run('Admin Action', { body: { action: 'monitors', domain: 'northwind-erp.com', ai_prompts_max: 12, competitors: 'https://www.rival.ae/', audit_monthly: false } });
  mock('Load Monitors (Admin)', [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', ai_engines: 'chatgpt', backlinks: false, audit_pages: 500 } }]);
  const am = await run('Monitor Row (Admin)', store['Load Monitors (Admin)']); console.log('   admin monitors ->', JSON.stringify({ cols_exact: same2(Object.keys(am[0].json), MC), prompts: am[0].json.ai_prompts_max, competitors: am[0].json.competitors, audit: am[0].json.audit_monthly, engines_kept: am[0].json.ai_engines, backlinks_kept: am[0].json.backlinks, pages_kept: am[0].json.audit_pages }));
  await run('Admin Action', { body: { action: 'prospect', domain: 'northwind-erp.com', prospect_domain: 'www.peppol.org', status: 'contacted', note: 'emailed the secretariat' } });
  mock('Load Link Prospects (Admin)', [{ json: { site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', prospect_domain: 'peppol.org', type: 'lost', rank: 598, spam_score: 0, detail: 'x', status: 'new', first_seen: '2026-10-01', last_seen: '2026-10-01', won_at: '', outreach_subject: 's', outreach_body: 'b', note: '' } }]);
  const ap = await run('Prospect Rows (Admin)', store['Load Link Prospects (Admin)']); console.log('   admin prospect ->', JSON.stringify({ n: ap.length, status: ap[0].json.status, note: ap[0].json.note, draft_kept: ap[0].json.outreach_body }));
  await expectError('Admin Action', { body: { action: 'prospect', domain: 'northwind-erp.com', prospect_domain: 'x.com', status: 'maybe' } }, /status must be/);
  await run('Admin Action', { body: { action: 'ai_prompts', domain: 'northwind-erp.com', add: ['Which UAE firms help wholesalers connect their ERP to the Peppol network?'], remove: ['p_old'] } });
  mock('Load AI Prompts (Admin)', [{ json: { prompt_id: 'p_old', site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', prompt: 'Old question?', kind: 'cost', topic: 't', keyword: 'k', source: 'auto', status: 'active', created_at: '2026-09-01' } }]);
  const apr = await run('AI Prompt Rows (Admin)', store['Load AI Prompts (Admin)']); console.log('   admin ai_prompts ->', apr.map(r => r.json.source + ':' + r.json.status + ':' + r.json.prompt.slice(0, 30)).join(' | '));
});

H.report();
})();
