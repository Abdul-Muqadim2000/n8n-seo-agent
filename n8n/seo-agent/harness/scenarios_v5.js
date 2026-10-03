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
  // v4.6 editor gate: a 73-point draft with SEO warnings always gets the editor pass, even when the review rates it 90
  const pcqHi = pcq.map(x => ({ json: { ...x.json, critique: { ...x.json.critique, score: 90, problems: (x.json.critique.problems || []).map(pr => ({ ...pr, severity: 'medium' })) } } }));
  const qaHi = await run('Content QA', pcqHi, { runIndex: 0 }); console.log('   editor gate ->', JSON.stringify({ round1_editor_needed: qa1[0].json.content_qa.editor_needed, with_review_90: qaHi[0].json.content_qa.editor_needed, score: qaHi[0].json.content_qa.content_score }));
  if (qa1[0].json.content_qa.editor_needed !== true || qaHi[0].json.content_qa.editor_needed !== true) throw new Error('editor pass skipped on a draft that misses SEO checks');
  store['Content QA'] = qa1;
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
  // v4.6 domain ages: one competitor known from the cache, RDAP (free) answers gulferp.ae, paid WHOIS only for the rest
  const cachedComp = pc.find(c => !c.json.is_you && c.json.domain !== 'gulferp.ae');
  mock('Load Age Cache', [{ json: { key: 'age:' + cachedComp.json.domain, kind: 'age', site_id: '', value: JSON.stringify({ registered: '2011-03-01', source: 'whois' }), updated_at: new Date(Date.now() - 40 * 864e5).toISOString() } }]);
  const alp = await run('Age Lookup Plan', store['Load Age Cache']); console.log('   age lookups (cache knows ' + cachedComp.json.domain + ') ->', alp.map(x => x.json.domain || 'skip').join(', '));
  mock('RDAP Lookup', alp.map(c => c.json.domain === 'gulferp.ae' ? { objectClassName: 'domain', events: [{ eventAction: 'registration', eventDate: '2015-06-01T00:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-06-01T00:00:00Z' }] } : { errorCode: 404, title: 'Not Found' }));
  const rres = await run('RDAP Results', store['RDAP Lookup']); console.log('   paid WHOIS only for ->', rres.map(x => x.json.domain || 'skip').join(', '));
  if (alp.some(x => x.json.domain === cachedComp.json.domain) || rres.some(x => x.json.domain === 'gulferp.ae')) throw new Error('domain age looked up again although known');
  mock('DataForSEO Whois', rres.map(c => F.whois(c.json.domain)));
  const dag = await run('Domain Ages', store['DataForSEO Whois']); console.log('   domain ages ->', JSON.stringify(dag[0].json.ages), '| rows to store', dag[0].json.rows.length, '| whois requests', dag[0].json.whois_requests);
  const agr = await run('Age Rows', dag); console.log('   age rows ->', JSON.stringify(agr.map(r => Object.keys(r.json).join(','))[0]));
  const ca = await run('Competitor Analysis', agr);
  // a second report: every age known -> no RDAP, no WHOIS, nothing stored
  const savedAges = { 'Load Age Cache': store['Load Age Cache'], 'Age Lookup Plan': store['Age Lookup Plan'], 'RDAP Lookup': store['RDAP Lookup'], 'RDAP Results': store['RDAP Results'], 'DataForSEO Whois': store['DataForSEO Whois'], 'Domain Ages': store['Domain Ages'] };
  mock('Load Age Cache', agr.map(r => ({ json: r.json })).concat(store['Load Age Cache'])); delete store['RDAP Lookup']; delete store['RDAP Results']; delete store['DataForSEO Whois'];
  const alp2 = await run('Age Lookup Plan', store['Load Age Cache']); const dag2 = await run('Domain Ages', alp2);
  console.log('   second report ->', JSON.stringify({ lookups: alp2[0].json.skip ? 0 : alp2.length, rows: dag2[0].json.rows.length, ages: Object.values(dag2[0].json.ages).map(a => a.registered) }));
  if (!alp2[0].json.skip || dag2[0].json.rows.length) throw new Error('second report looked ages up again');
  Object.assign(store, savedAges);
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
  // v4.8: rungs are relative to the site's reach (1 <= reach, 2 <= reach + 15, 3 <= reach + 30; unknown kd = reach + 10), no longer 25 / 45 / 60
  const bandOk = L.rungs.every(r => r.pages.every(p => { const kd = p.kd == null ? L.reach + 10 : p.kd; return r.rung === 1 ? (kd <= L.reach && p.total_volume >= 20) : r.rung === 2 ? (kd <= L.reach + 15) : (kd > L.reach && kd <= L.reach + 30); }));
  const rungPages = L.rungs.flatMap(r => r.pages);
  const linkOk = rungPages.every(p => p.links_to.some(l => l.role === 'top' && l.url === L.top.target_url)) && L.rungs.every(r => r.pages.length < 2 || r.pages.every(p => p.links_to.some(l => l.role === 'sibling'))) && L.top.links_to.length === rungPages.length;
  const monthsOk = L.timeline.every((t, i) => i === 0 ? t.months[0] === 1 : t.months[0] === L.timeline[i - 1].months[1] + 1);
  console.log('   LADDER ->', JSON.stringify({ reach: L.reach, plan: L.plan_type, for_you: L.difficulty_for_you, months: L.months, status: L.feasibility.status, pages: L.stats.pages_total, per_rung: L.rungs.map(r => r.rung + ':' + r.pages.length + '/' + r.available), bands_ok: bandOk, links_ok: linkOk, link_map: L.link_map.length, months_ok: monthsOk, timeline: L.timeline.map(t => t.label + ' ' + t.months.join('-')), write_now: L.write_now.map(w => w.keyword), later: L.later.length, notes: L.notes, alternatives: L.feasibility.alternatives }));
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
  console.log('   week 2 checks ->', tp2.length, '|', (tp2[0].json.deferred_pages || []).length, 'unpublished pages carried (checked monthly)');
  console.log('   week 2 ->', JSON.stringify({ gains: tr2[0].json.gains.length, drops: tr2[0].json.drops, head_now: tr2[0].json.positions.find(p => p.rung === 4), next: tr2[0].json.next_step.action }));
  // v4.6: pages not published yet are checked monthly (their last position is carried in the report); live pages every week
  const recent = pp.map(p => ({ json: { ...p.json, checked_at: new Date(Date.now() - 6 * 864e5).toISOString() } }));
  const mixed = ladderRows.map((r, i) => ({ json: { ...r.json, status: i % 2 ? 'published' : 'planned', page_exists: i % 2 ? true : false } }));
  mock('Load Ladders', mixed); mock('Load History', recent);
  const tp5 = await run('Tracker Plan', recent); const dfr = tp5[0].json.deferred_pages || [];
  console.log('   unpublished pages ->', JSON.stringify({ checked_now: tp5.length, deferred: dfr.length, first_deferred: dfr[0] && { kw: dfr[0].keyword, last: dfr[0].last_position, at: String(dfr[0].last_checked).slice(0, 10) } }));
  mock('SERP Check', tp5.map(c => V.serpFor(c.json.keyword, c.json.domain, 5))); const pp5 = await run('Parse Positions', store['SERP Check']); mock('Save History', pp5);
  const tr5 = await run('Tracker Report', store['Save History']); console.log('   report keeps the deferred pages ->', tr5[0].json.positions.length, '| label', /not published yet: checked monthly/.test(tr5[0].json.html));
  if (!dfr.length || tp5.length + dfr.length !== mixed.length) throw new Error('rank tracker deferral lost pages');
  mock('Load Ladders', ladderRows);
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
  // v4.6: a trend fetched in the last 25 days is read from seo_trends (not bought again)
  mock('Load Trends (Site)', trows.slice(0, 2).map(r => ({ json: { ...r.json, checked_at: new Date(Date.now() - 7 * 864e5).toISOString() } })));
  const tqc = await run('Trends Requests', store['Resolve Properties']); console.log('   trends with 2 stored ->', JSON.stringify({ requests: tqc.filter(x => !x.json.skip).map(x => x.json.keyword), cached: (tqc[0].json.cached_trends || []).map(c => c.keyword) }));
  mock('Google Trends', tqc.map(r => T.trends(r.json))); const ptc = await run('Parse Trends', store['Google Trends']); const trc = await run('Trend Rows', ptc);
  console.log('   parsed ->', ptc.map(x => x.json.keyword + (x.json.cached ? '(stored)' : '')).join(', '), '| rows stored again', trc.filter(x => !x.json.skip).length);
  if (tqc.filter(x => !x.json.skip).length !== tq.length - 2 || ptc.length !== tq.length) throw new Error('trend cache is wrong');
  delete store['Load Trends (Site)']; mock('Parse Trends', pt);
  // v4.6: a keyword Search Console already reports, checked live 5 days ago -> not bought again this week (monthly cross-check)
  const savedRP = store['Resolve Properties'], savedGsc = store['Parse GSC'];
  mock('Resolve Properties', savedRP.map(x => ({ json: { ...x.json, serp_positions: { ...(x.json.serp_positions || {}), [sq[0].json.keyword]: { position: 5, checked_at: new Date(Date.now() - 5 * 864e5).toISOString() } } } })));
  mock('Parse GSC', [{ json: { site_idx: 0, site_id: savedRP[0].json.site_id, tracked: [{ keyword: sq[0].json.keyword, position: 6.2 }, { keyword: sq[1].json.keyword, position: 9 }] } }]);
  const sqS = await run('Site SERP Requests', store['Resolve Properties']); console.log('   live checks with Search Console data ->', sqS.map(x => x.json.keyword).join(', '), '(skipped: ' + sq[0].json.keyword + ', checked 5 days ago)');
  if (sqS.some(x => x.json.keyword === sq[0].json.keyword) || !sqS.some(x => x.json.keyword === sq[1].json.keyword)) throw new Error('live SERP reuse is wrong');
  store['Resolve Properties'] = savedRP; if (savedGsc) store['Parse GSC'] = savedGsc; else delete store['Parse GSC'];
  mock('SERP Check (Site)', sq.map((q, i) => i === 2 ? { error: { message: 'timeout' } } : V.serpFor(q.json.keyword, q.json.domain, [5, 0, 1][i])));
  const ps = await run('Parse Site SERP', store['SERP Check (Site)']);
  const HCOLS = ['ladder_id', 'keyword', 'checked_at', 'position', 'url', 'serp_features', 'domain', 'rung'];
  console.log('   serp rows ->', ps.map(x => x.json.keyword + '=' + x.json.position).join(', '), '| cols exact?', ps.every(x => same(Object.keys(x.json), HCOLS)), '| ladder_id = site id?', ps[0].json.ladder_id === 'site_northwind-erp-com');
  mock('Save Site Rank History', ps);
  // --- metrics, rows, brief input, report ---
  const sm = await run('Site Metrics', store['Save Site Rank History']);
  const m = sm[0].json;
  const mr = await run('Metrics Rows', sm);   // what Save Site Metrics receives: exactly the table columns (2026-10-03 fix)
  if (Object.values(mr[0].json).some(v => v && typeof v === 'object')) throw new Error('Metrics Rows still carries nested objects');
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
  // v4.6: within the month only the core engines are asked; Gemini / Claude and the brand question are carried from the month's full run
  const eng2 = rq2.reduce((m, q) => { m[q.json.engine] = (m[q.json.engine] || 0) + 1; return m; }, {});
  console.log('   week 2 (core engines only) ->', JSON.stringify({ full_due: plan2[0].json.full_due, requests: eng2, brand_asked: rq2.some(q => q.json.kind === 'brand'), carried: Object.entries(mt2[0].json.engines).filter(([, v]) => v.carried).map(([k, v]) => k + ' ' + v.answered + '/' + v.asked + ' @' + String(v.checked_at).slice(0, 10)), brand: mt2[0].json.metrics.brand, asked: mt2[0].json.metrics.asked, grid_cell: Object.values(mt2[0].json.questions[0].engines).join(',') }));
  if (plan2[0].json.full_due || eng2.gemini || eng2.claude || rq2.some(q => q.json.kind === 'brand') || !mt2[0].json.engines.gemini.carried || !mt2[0].json.metrics.brand.carried || mt2[0].json.metrics.brand_known !== false || mt2[0].json.alerts.some(x => /recognise/.test(x.text))) throw new Error('week 2 asked the monthly engines again or lost their numbers');
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
  loadAll({ prospects: [{ json: { site_id: M.SITE, domain: M.DOMAIN, prospect_domain: 'uae-asp.ae', type: 'gap', rank: 25, spam_score: 0, detail: 'old', source_url: '', target_url: '', status: 'contacted', first_seen: '2026-06-01T00:00:00.000Z', last_seen: '2026-06-01T00:00:00.000Z', won_at: '', outreach_subject: 's', outreach_body: 'b', note: 'emailed Ali' } },
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
  // v4.6: next month's full run, gap refreshed 0 days ago -> no gap request, the stored gap prospects are shown; the history is extended, not re-downloaded
  const lastMonth = sr.map(r => ({ json: { ...r.json, checked_at: new Date(Date.now() - 33 * 864e5).toISOString() } }));
  loadAll({ snaps: lastMonth, prospects: prw.map(r => ({ json: r.json })) });
  const p4 = await run('BL Plan', store['Load Case Studies']); const rq4 = await run('BL Requests', p4);
  mock('Run BL Requests', rq4.map(r => M.blFor(r.json))); const g4 = await run('Gap Requests', store['Run BL Requests']); delete store['Run Gap Requests'];
  const pb4 = await run('Parse Backlinks', g4); const B4 = pb4[0].json;
  console.log('   full run, gap stored ->', JSON.stringify({ mode: p4[0].json.mode, gap_due: p4[0].json.gap_due, gap_request: !g4[0].json.skip, gap: B4.gap.length, gap_stored: B4.gap_stored, gap_checked: B4.gap_checked, ts_from: (rq4.find(r => r.json.kind === 'timeseries').json.body[0] || {}).date_from, ts_months: B4.timeseries.length, stored_months: p4[0].json.stored_timeseries.length }));
  if (p4[0].json.mode !== 'full' || p4[0].json.gap_due || !g4[0].json.skip || !B4.gap.length || !B4.gap_stored) throw new Error('quarterly gap reuse is wrong');
  const oj4 = await run('Outreach Jobs', pb4); console.log('   stored gap -> no new gap candidates:', !B4.candidates.some(c => c.type === 'gap'));
  const rp4 = await run('BL Report', await run('BL Snapshot Rows', await run('Prospect Rows', [{ json: { skip: true } }]))); console.log('   report says refreshed quarterly ->', /refreshed every 3 months/.test(rp4[0].json.html || ''));
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
  // v4.6 change-aware scheduler: candidates -> sitemap fingerprint -> audit only when changed / 60+ days / never / no readable sitemap / on demand
  mock('Load Sites', M.sites()); mock('Load Ladders', M.ladders()); mock('Load Monitors', M.monitors()); mock('Load Profiles', M.profiles()); mock('Load Audits', [{ json: {} }]); mock('Load Cache (Audit)', [{ json: {} }]);
  const ac = await run('Audit Candidates', store['Load Cache (Audit)']); console.log('   audit candidates ->', ac.map(c => c.json.domain + ' ' + c.json.sitemap_url + ' last=' + JSON.stringify(c.json.last_audit)).join(' | '));
  const smA = { statusCode: 200, headers: {}, data: F.urlset(['/', '/services/', '/blog/erp-guide/']) };
  const smB = { statusCode: 200, headers: {}, data: F.urlset(['/', '/services/', '/blog/erp-guide/', '/blog/new-post/']) };
  const sched = async (label, sitemap, auditedDaysAgo, cacheFrom) => {
    mock('Load Audits', auditedDaysAgo == null ? [{ json: {} }] : [{ json: { site_id: M.SITE, audited_at: new Date(Date.now() - auditedDaysAgo * 864e5).toISOString(), health_score: 79 } }]);
    mock('Load Cache (Audit)', cacheFrom ? [{ json: cacheFrom }] : [{ json: {} }]);
    const c = await run('Audit Candidates', store['Load Cache (Audit)']); mock('Fetch Sitemap (Schedule)', c.map(() => sitemap));
    const s = await run('Audit Schedule Plan', store['Fetch Sitemap (Schedule)']);
    console.log('   scheduler (' + label + ') ->', s[0].json.run ? 'AUDIT' : 'skip', '|', s[0].json.why, '| fingerprint', s[0].json.fingerprint ? s[0].json.fingerprint.entries + ' entries' : 'none');
    return s;
  };
  const sp = await sched('never audited', smA, null, null);
  const fpr = await run('Fingerprint Rows', sp); console.log('   fingerprint rows ->', JSON.stringify(fpr.map(r => ({ key: r.json.key, kind: r.json.kind, cols: Object.keys(r.json).join(',') }))));
  const ats = await run('Audits To Start', fpr); console.log('   audits to start ->', ats.map(a => a.json.domain + ': ' + a.json.why).join(' | '));
  const storedFp = fpr[0].json;
  const sp2 = await sched('audited 5 days ago', smA, 5, storedFp);
  const sp4 = await sched('40 days, no fingerprint stored yet', smA, 40, null);
  const sp5 = await sched('40 days, sitemap unchanged', smA, 40, storedFp);
  const sp6 = await sched('40 days, new page in the sitemap', smB, 40, storedFp);
  const sp2b = await sched('10 days after an audit, site changed since', smB, 10, storedFp); console.log('   fingerprint kept for the next check ->', !sp2b[0].json.cache_row, '| on the started audit ->', !!sp6[0].json.cache_row);
  if (sp2b[0].json.run || sp2b[0].json.cache_row || !sp6[0].json.cache_row) throw new Error('fingerprint overwritten on a skipped site');
  const sp7 = await sched('65 days, unchanged (safety net)', smA, 65, storedFp);
  const sp8 = await sched('40 days, sitemap 404', { statusCode: 404, headers: {}, data: 'not found' }, 40, storedFp);
  const sp9 = await sched('40 days, sitemap index without dates', { statusCode: 200, headers: {}, data: F.sitemapIndex }, 40, storedFp);
  const sp5b = await sched('40 days, unchanged (again, for the summary)', smA, 40, storedFp); const nd = await run('Audits To Start', await run('Fingerprint Rows', sp5b));
  if (!nd[0].json.nothing_to_do) throw new Error('an unchanged site was started'); console.log('   nothing due ->', JSON.stringify(nd[0].json));
  const ast = await run('Audits Started', nd); console.log('   audits started summary ->', JSON.stringify(ast[0].json.skipped));
  if (!(sp[0].json.run && !sp2[0].json.run && !sp4[0].json.run && !sp5[0].json.run && sp6[0].json.run && sp7[0].json.run && sp8[0].json.run && sp9[0].json.run)) throw new Error('audit scheduler decisions are wrong');
  mock('Manual Run', { domain: M.DOMAIN }); const sp3 = await sched('on demand, audited 5 days ago', smA, 5, storedFp); delete store['Manual Run'];
  if (!sp3[0].json.run) throw new Error('on-demand audit was skipped');
  console.log('   scheduled body ->', JSON.stringify(sp[0].json.body));
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

// ===================================================================================
await guard('web app', async () => {
  reset(); begin('S23 Web app (app/) — request bodies through Quick Validate + Normalize Input, per-company rate limit, Admin API validation');
  // assertion results count like node runs: a wrong value is a failure, not just a log line
  const check = (label, ok, detail) => { H.results.push({ scenario: 'S23 Web app (app/) — request bodies through Quick Validate + Normalize Input, per-company rate limit, Admin API validation', node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 400), items: [] }); };
  const get = (o, p) => p.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
  const P = require('./fixtures_platform.json');
  for (const f of P) {
    const qv = await run('Quick Validate', { headers: f.headers, body: f.body });
    check(f.name + ' / quick validate', qv[0].json.ok, qv[0].json.error);
    delete store['Start Form'];
    const n = await run('Normalize Input', qv[0].json.forward);
    const j = n[0].json;
    const wrong = Object.entries(f.expect).filter(([k, v]) => JSON.stringify(get(j, k)) !== JSON.stringify(v)).map(([k, v]) => `${k}: got ${JSON.stringify(get(j, k))}, want ${JSON.stringify(v)}`);
    check(f.name + ' / normalized', !j.validation_error && !wrong.length, j.validation_error || wrong.join('; '));
    check(f.name + ' / client_ip + callback', j.client_ip === 'app:7a1c2d3e-org' && j.callback_url === f.body.callback_url, JSON.stringify({ client_ip: j.client_ip, callback_url: j.callback_url }));
    console.log('   ' + f.name + ' ->', j.validation_error ? 'ERROR ' + j.validation_error : 'ok' + (wrong.length ? ' | WRONG ' + wrong.join('; ') : ''));
  }
  // per-company daily cap: the company key, not the e-mail that receives the copy; 40 runs, then a clear message
  const kw = P.find(f => f.body.mode === 'keyword');
  const qk = await run('Quick Validate', { headers: kw.headers, body: kw.body }); delete store['Start Form'];
  const nk = await run('Normalize Input', qk[0].json.forward);
  H.staticData.rate = undefined; H.staticData.ai_budget = undefined;
  const big = [{ json: { ...nk[0].json, ai_budget_usd: 0 } }];
  let last; for (let i = 0; i < 41; i++) last = await run('Rate Limit', big);
  check('company key counted', H.staticData.rate.keys['app:7a1c2d3e-org'] === 40 && !H.staticData.rate.keys['owner@northwind-erp.com'], JSON.stringify(H.staticData.rate.keys));
  check('41st company run blocked', /daily limit of 40 runs/.test(last[0].json.validation_error || ''), last[0].json.validation_error);
  // a spoofed marker that is not app:<id> keeps the old e-mail key
  H.staticData.rate = undefined;
  await run('Rate Limit', [{ json: { ...nk[0].json, client_ip: 'app:', ai_budget_usd: 0 } }]);
  check('malformed app marker falls back to e-mail', H.staticData.rate.keys['owner@northwind-erp.com'] === 1, JSON.stringify(H.staticData.rate.keys));
  console.log('   rate limit ->', JSON.stringify(H.staticData.rate.keys));
  // Admin API validation (Site Admin's rules as a 400)
  const av1 = await run('Admin Validate', { body: { action: 'cadence', domain: 'northwind-erp.com', pages_per_week: 2 } });
  check('admin cadence valid', av1[0].json.ok && av1[0].json.forward.request_id.startsWith('admin-'), JSON.stringify(av1[0].json));
  const av2 = await run('Admin Validate', { body: { action: 'prospect', domain: 'northwind-erp.com', prospect_domain: 'x.com', status: 'maybe' } });
  check('admin bad prospect status rejected', !av2[0].json.ok && /status must be/.test(av2[0].json.error), av2[0].json.error);
  const av3 = await run('Admin Validate', { body: { action: 'explode', domain: 'northwind-erp.com' } });
  check('admin unknown action rejected', !av3[0].json.ok, av3[0].json.error);
  const av4 = await run('Admin Validate', { body: { action: 'ai_prompts', site_id: 'site_northwind-erp-com', add: ['Which UAE firms connect ERP systems to Peppol?'] } });
  const aa = await run('Admin Action', { body: av4[0].json.forward });
  check('admin forward accepted by Admin Action', aa[0].json.action === 'ai_prompts' && aa[0].json.add_prompts.length === 1, JSON.stringify(aa[0].json).slice(0, 200));
});

// ===================================================================================
await guard('pipeline', async () => {
  const SN = 'S24 Pipeline phase 2 — ladder settings in the Content Cadence (priority, pause, manual, focus, direct, main-page gate, won, pile-up, opportunities, no settings) + Won / Stuck in the Rank Tracker';
  reset(); begin(SN);
  // assertion results count like node runs (as in S23): a wrong value is a failure
  const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 400), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 300))); };
  const T = require('./fixtures_tracking');
  const D = 'northwind-erp.com', SITE = 'site_northwind-erp-com', HOST = 'https://www.northwind-erp.com/';
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const slug = (k) => HOST + k.replace(/\s+/g, '-') + '/';
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // a ladder = [rung, page_no, keyword, status] rows; rung 4 is the main page
  const ladder = (id, head, pages, start) => pages.map(([rung, page_no, keyword, status]) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ladder_id: id, domain: D, head_keyword: head, rung, page_no, keyword, supporting: '', page_type: rung === 4 ? 'Pillar Page' : 'Guide', target_url: slug(keyword), page_exists: false, status: status || 'planned', months: '', start_date: start, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: 'owner@example.com', callback_url: 'https://hooks.example.com/x', request_id: 'r-' + id } }));
  const std = (id, h, start, st = {}) => ladder(id, h, [[1, 1, h + ' cost', st.a], [1, 2, h + ' guide', st.b], [2, 3, h + ' software', st.c], [3, 4, h + ' providers', st.d], [4, 0, h, st.top]], start);
  const set = (ladder_id, o = {}) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ladder_id, site_id: SITE, domain: D, head_keyword: '', mode: 'auto', priority: null, status: 'active', plan_type: '', reach: null, source: 'app', opportunities: '', auto_start: false, max_active: null, max_waiting: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', ...o } });
  const siteSet = (o) => set('_site', { opportunities: 'auto', max_active: 2, max_waiting: 3, ...o });
  const ranks = (id, kw, positions) => positions.map((p, i) => ({ json: { ladder_id: id, keyword: kw, checked_at: daysAgo(7 * i + 2), position: p, url: p > 0 ? slug(kw) : '', serp_features: '', domain: D, rung: 4 } }));   // newest first, weekly
  const logRow = (keyword, o = {}) => ({ json: { site_id: SITE, domain: D, keyword, source: 'ladder', page_type: 'Guide', existing_page_url: '', rung: 1, ladder_id: '', request_id: 'cad_x', started_at: daysAgo(10), status: 'started', published_url: '', published_at: '', week: '2026-09-21', ...o } });
  const cad = (n) => [{ json: { site_id: SITE, domain: D, pages_per_week: n, status: 'active', updated_at: 'x', request_id: '' } }];
  const EMPTY = [{ json: {} }];
  const plan = async (o = {}) => {
    mock('Manual Run', o.trigger || EMPTY); mock('Load Sites', T.sitesRows()); mock('Load Cadence', cad(o.pages || 3)); mock('Load Ladders', o.ladders || EMPTY);
    mock('Load Query History', o.queries || EMPTY); mock('Load Trends', o.trends || EMPTY); mock('Load Content Log', o.logs || EMPTY);
    mock('Load Ladder Settings', o.settings || EMPTY); mock('Load Main Keyword Ranks', o.ranks || EMPTY);
    const r = await run('Cadence Plan', store['Load Main Keyword Ranks']);
    const picks = r.filter(x => !x.json.nothing_to_do).map(x => x.json);
    return { items: r, picks, kws: picks.map(p => p.keyword), first: r[0].json, status: (r.find(x => x.json.report_only) || {}).json };
  };
  const A = (st) => std('lad_A', 'peppol uae', '2026-07-01T00:00:00.000Z', st), B = (st) => std('lad_B', 'vat software uae', '2026-08-01T00:00:00.000Z', st), Cl = (st) => std('lad_C', 'wms dubai', '2026-09-01T00:00:00.000Z', st);
  const W3 = { a: 'writing', b: 'writing', c: 'writing' };

  // 1. priority: ladder B (priority 1) before ladder A (priority 2); B's written pages skipped, its main page waits for support
  let p = await plan({ ladders: [...A(), ...B({ a: 'writing', b: 'writing' })], settings: [set('lad_A', { priority: 2 }), set('lad_B', { priority: 1 })] });
  console.log('   priority ->', p.kws.join(' | '));
  check('priority: ladder 1 pages first, then ladder 2', eq(p.kws, ['vat software uae software', 'vat software uae providers', 'peppol uae cost']), p.kws);
  check('links stay inside the ladder (top = its own main page)', eq(p.picks[0].body.ladder_links.map(l => l.role + ':' + l.path), ['top:/vat-software-uae/']), JSON.stringify(p.picks[0].body.ladder_links));
  check('pick bodies keep the content-run shape', p.picks.every(x => x.body.mode === 'keyword' && x.body.force_content && x.body.client_ip === 'cadence:' + SITE && x.body.ladder_id === x.ladder_id), JSON.stringify(p.picks[0].body).slice(0, 200));
  // 2. paused ladder: skipped (not queued either)
  p = await plan({ ladders: [...A(), ...B()], settings: [set('lad_A', { priority: 2 }), set('lad_B', { priority: 1, status: 'paused' })] });
  check('paused ladder not written', p.kws.length === 3 && p.picks.every(x => x.ladder_id === 'lad_A') && !p.first.queued_ladders.length, p.kws);
  // 3. manual ladder: not written, its next page listed for approval
  p = await plan({ ladders: [...A(), ...B({ a: 'writing' })], settings: [set('lad_A', { priority: 2 }), set('lad_B', { priority: 1, mode: 'manual' })] });
  console.log('   manual ->', p.kws.join(' | '), '| awaiting:', JSON.stringify(p.first.awaiting_approval));
  check('manual ladder not written', p.picks.every(x => x.ladder_id === 'lad_A') && p.kws.length === 3, p.kws);
  check('manual ladder next page awaiting approval', eq(p.first.awaiting_approval, [{ ladder_id: 'lad_B', head: 'vat software uae', keyword: 'vat software uae guide', rung: 1, page_no: 2, page_type: 'Guide', existing_page_url: '' }]), JSON.stringify(p.first.awaiting_approval));
  const cnm = await run('Cadence Note', [{ json: {} }]); scanHtml('cadence note (manual ladder)', cnm[0].json.html);
  check('cadence note carries the pipeline facts', cnm[0].json.awaiting_approval.length === 1 && /Ready for your approval/.test(cnm[0].json.html) && cnm[0].json.paused_reason === '' && Array.isArray(cnm[0].json.queued_ladders), JSON.stringify(Object.keys(cnm[0].json)));
  // 4. focus: three Auto ladders, max_active 2 (default) -> the newest waits; a fully written ladder frees its slot; max_active 3 writes all
  p = await plan({ ladders: [...A(W3), ...B(W3), ...Cl()] });
  console.log('   3 ladders, max 2 ->', p.kws.join(' | '), '| queued:', JSON.stringify(p.first.queued_ladders));
  check('max_active 2: third ladder not written', eq(p.kws, ['peppol uae providers', 'vat software uae providers']), p.kws);
  check('third ladder listed as queued', eq(p.first.queued_ladders, [{ ladder_id: 'lad_C', head: 'wms dubai', priority: null, reason: 'max_active' }]), JSON.stringify(p.first.queued_ladders));
  p = await plan({ ladders: [...A(W3), ...B(W3), ...Cl()], settings: [siteSet({ max_active: 3 })] });
  check('max_active 3 from the _site row: third ladder written', eq(p.kws, ['peppol uae providers', 'vat software uae providers', 'wms dubai cost']), p.kws);
  p = await plan({ ladders: [...A({ ...W3, d: 'writing', top: 'writing' }), ...B(W3), ...Cl()] });
  check('fully written ladder frees its slot', eq(p.kws, ['vat software uae providers', 'wms dubai cost', 'wms dubai guide']) && !p.first.queued_ladders.length, p.kws);
  // 5. direct plan: the main page first, linking down to its cluster
  p = await plan({ ladders: A(), settings: [set('lad_A', { plan_type: 'direct' })] });
  console.log('   direct ->', p.kws.join(' | '));
  check('direct ladder: main page first', p.kws[0] === 'peppol uae' && p.picks[0].rung === 4 && p.picks[0].body.ladder_links.every(l => l.role === 'down') && p.picks[0].body.ladder_links.length === 4, p.kws);
  // 6. main-page gate
  p = await plan({ ladders: A({ a: 'published', b: 'writing', c: 'writing', d: 'writing' }) });
  console.log('   gate blocked ->', JSON.stringify(p.status && { reason: p.status.reason, waiting_for_support: p.status.waiting_for_support }));
  check('gate blocked: 1 of 4 published -> main page not written', !p.picks.length && p.status && eq(p.status.waiting_for_support, [{ ladder_id: 'lad_A', head: 'peppol uae', published: 1, supporting: 4, needed: 2, head_position: null }]), JSON.stringify(p.items.map(x => x.json.keyword || x.json.reason)));
  const cs = await run('Cadence Status', p.items); scanHtml('cadence status (gate)', cs[0].json.html);
  check('status note for a gated main page', cs.length === 1 && /supporting pages/.test(cs[0].json.subject) && eq(cs[0].json.pages, []) && cs[0].json.stage === 'content_cadence', cs[0] && cs[0].json.subject);
  p = await plan({ ladders: A({ a: 'published', b: 'writing', c: 'writing', d: 'writing' }), logs: [logRow('peppol uae guide', { status: 'published', published_url: slug('peppol uae guide'), published_at: daysAgo(5) })] });
  check('gate open: half published (ladder row + content log) -> main page written', eq(p.kws, ['peppol uae']), p.kws);
  p = await plan({ ladders: A({ a: 'published', b: 'writing', c: 'writing', d: 'writing' }), ranks: ranks('lad_A', 'peppol uae', [25, 60]) });
  check('gate open: main keyword at #25', eq(p.kws, ['peppol uae']), p.kws);
  p = await plan({ ladders: A({ a: 'published', b: 'writing', c: 'writing', d: 'writing' }), ranks: ranks('lad_A', 'peppol uae', [-1, 25]) });
  check('gate: a failed check (-1) is skipped, #25 still counts', eq(p.kws, ['peppol uae']), p.kws);
  p = await plan({ ladders: A({ a: 'published', b: 'writing', c: 'writing', d: 'writing' }), ranks: ranks('lad_A', 'peppol uae', [45, 25]) });
  check('gate: the latest check (#45) decides', !p.picks.length, p.kws);
  // 7. won: main keyword top 3 in the last 4 checks -> no more pages, slot freed
  p = await plan({ ladders: [...A(), ...B()], ranks: ranks('lad_A', 'peppol uae', [2, 1, 3, 2]) });
  console.log('   won ->', p.kws.join(' | '), '| won:', JSON.stringify(p.first.won_ladders));
  check('won ladder not written', p.picks.every(x => x.ladder_id === 'lad_B') && p.kws.length === 3 && eq(p.first.won_ladders, [{ ladder_id: 'lad_A', head: 'peppol uae', position: 2, checks: 4 }]), p.kws);
  p = await plan({ ladders: [...A(), ...B()], ranks: ranks('lad_A', 'peppol uae', [2, 1, 3, 5]) });
  check('not won with one check at #5', p.picks[0].ladder_id === 'lad_A' && !p.first.won_ladders.length, p.kws);
  // 8. pile-up guard
  const waiting3 = ['x one', 'x two', 'x three'].map((k, i) => logRow(k, { started_at: daysAgo(10 + 10 * i) }));
  p = await plan({ ladders: A(), logs: waiting3 });
  console.log('   pile-up ->', JSON.stringify(p.status && { reason: p.status.reason, paused_reason: p.status.paused_reason, waiting: p.status.waiting_publish, upcoming: p.status.upcoming.length }));
  check('pile-up: 3 waiting -> nothing picked, reason recorded', !p.picks.length && p.status && p.status.paused_reason === 'pileup' && p.status.waiting_publish === 3 && p.status.upcoming.length === 4, JSON.stringify(p.first));
  const csp = await run('Cadence Status', p.items); scanHtml('cadence status (pile-up)', csp[0].json.html); save('cadence-status-pileup.html', csp[0].json.html);
  check('pile-up status note (subject, callback fields)', /paused, 3 pages wait/.test(csp[0].json.subject) && csp[0].json.paused_reason === 'pileup' && csp[0].json.request_id.endsWith('_0') && csp[0].json.callback_url, csp[0].json.subject);
  const csd = await run('Cadence Status', p.items.map(x => ({ json: { ...x.json, dry_run: true } })));
  check('no status note in a dry run', csd.length === 0, csd.length);
  p = await plan({ ladders: A(), logs: waiting3, trigger: { domain: D } });
  check('pile-up applies on demand without force', !p.picks.length && p.status.paused_reason === 'pileup', p.kws);
  p = await plan({ ladders: A(), logs: waiting3, trigger: { domain: D, force: true } });
  check('on demand with force: true bypasses the guard', p.kws.length === 3 && p.picks[0].pileup_forced === true && p.picks[0].paused_reason === '', p.kws);
  p = await plan({ ladders: A(), logs: [...waiting3.slice(0, 2), logRow('x old', { started_at: daysAgo(130) })] });
  check('rows older than 120 days do not count', p.kws.length === 3 && p.picks[0].waiting_publish === 2, p.kws);
  p = await plan({ ladders: A(), logs: waiting3, settings: [siteSet({ max_waiting: 5 })] });
  check('max_waiting 5 from the _site row', p.kws.length === 3, p.kws);
  // 9. opportunities manual: no striking / trend picks, listed as suggestions
  if (!queryRows || !trendRows) throw new Error('S10 did not produce query / trend rows');
  const pa = await plan({ queries: queryRows, trends: trendRows });
  const pm = await plan({ queries: queryRows, trends: trendRows, settings: [siteSet({ opportunities: 'manual' })] });
  console.log('   opportunities auto ->', pa.kws.join(' | '), '| manual suggestions ->', (pm.status ? pm.status.suggestions : []).map(s => s.keyword + ' [' + s.source + ']').join(' | '));
  check('opportunities manual: nothing written', !pm.picks.length && pm.status && pm.status.suggestions.length >= 3, JSON.stringify(pm.first).slice(0, 300));
  check('suggestions = what Auto would write', eq(pm.status.suggestions.slice(0, 3).map(s => s.keyword), pa.kws) && pm.status.suggestions.every(s => ['striking', 'trend'].includes(s.source)), JSON.stringify(pm.status.suggestions.map(s => s.keyword)));
  const pml = await plan({ ladders: A(), queries: queryRows, trends: trendRows, pages: 3, settings: [siteSet({ opportunities: 'manual' })] });
  check('opportunities manual with a ladder: ladder pages only, suggestions on the picks', pml.picks.every(x => x.source === 'ladder') && pml.picks[0].suggestions.length > 0, pml.kws);
  // 10. no settings rows: same picks as the v4.7 plan (frozen copy in harness/legacy/)
  const logRows12 = [{ json: { site_id: SITE, domain: D, keyword: 'wms uae', source: 'trend', page_type: 'Guide', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'cad_old', started_at: '2026-09-15T10:00:00.000Z', status: 'started', published_url: '', published_at: '', week: '2026-09-15' } }];
  const proj = (items) => items.filter(x => !x.json.nothing_to_do).map(x => { const j = x.json; return { keyword: j.keyword, source: j.source, page_type: j.page_type, existing: j.existing_page_url, ladder_id: j.ladder_id, rung: j.rung, page_no: j.page_no, why: j.why, request_id: j.request_id, pages: j.pages_per_week, upcoming: j.upcoming, pending: j.pending_publish, dry_run: j.dry_run, body: j.body }; });
  const same12 = async (label, o, extra) => {
    const n = await plan(o); const old = await run('legacy:Cadence_Plan_v4_7', [{ json: {} }]);
    console.log('   ' + label + ' -> new:', n.kws.join(' | '), '| v4.7:', old.filter(x => !x.json.nothing_to_do).map(x => x.json.keyword).join(' | '), '| candidates', n.first.candidates, 'vs', old[0].json.candidates);
    check('no settings = v4.7: ' + label, n.picks.length > 0 && eq(proj(n.items), proj(old)) && (!extra || extra(n, old)), JSON.stringify(proj(n.items)).slice(0, 200) + ' VS ' + JSON.stringify(proj(old)).slice(0, 200));
    return n;
  };
  await same12('S12 fixture (one ladder, striking, trends)', { trigger: { site_id: SITE, on_demand: true }, pages: 2, ladders: ladderRows, queries: queryRows, trends: trendRows, logs: logRows12 }, (n, old) => n.first.candidates === old[0].json.candidates - 1);   // the gated main page is the only candidate less
  await same12('scheduled, 3 pages', { pages: 3, ladders: ladderRows, queries: queryRows, trends: trendRows, logs: logRows12 });
  await same12('no ladder, dry run', { trigger: { domain: D, pages: 3, dry_run: true }, queries: queryRows, trends: trendRows, logs: logRows12 }, (n, old) => n.first.candidates === old[0].json.candidates && n.first.dry_run === true);
  const missing = [{ json: { error: { message: 'Data table with name "seo_ladder_settings" not found' } } }];
  await same12('settings / rank tables missing', { trigger: { site_id: SITE, on_demand: true }, pages: 2, ladders: ladderRows, queries: queryRows, trends: trendRows, logs: logRows12, settings: missing, ranks: missing });
  const n0 = await plan({ trigger: { site_id: SITE, on_demand: true }, pages: 2, ladders: ladderRows, queries: queryRows, trends: trendRows, logs: logRows12 });
  check('no settings: new fields empty', n0.picks.every(x => x.paused_reason === '' && !x.awaiting_approval.length && !x.suggestions.length && !x.queued_ladders.length && !x.won_ladders.length && x.opportunities === 'auto' && x.max_waiting === 3), JSON.stringify(n0.first).slice(0, 300));
  const cn0 = await run('Cadence Note', [{ json: {} }]);
  check('no settings: note has no pipeline sections', !/Ready for your approval|Suggested posts|Queued ladders|waiting for support|Won/.test(cn0[0].json.html), cn0[0].json.html.slice(0, 200));
  mock('Manual Run', EMPTY); mock('Load Cadence', EMPTY); const noCad = await run('Cadence Plan', [{ json: {} }]);
  check('a site without a cadence still gets nothing', noCad.length === 1 && noCad[0].json.nothing_to_do && !noCad[0].json.report_only, JSON.stringify(noCad[0].json));
  // two ladders, no settings rows: the older ladder first (priority by start date) — a deliberate change from the v4.7 rung interleave
  const two = await plan({ ladders: [...B(), ...A()] });
  check('no settings, two ladders: oldest ladder first', eq(two.kws, ['peppol uae cost', 'peppol uae guide', 'peppol uae software']), two.kws);

  // ---- Rank Tracker: won / stuck flags (display only; the e-mail does not change) ----
  const trk = async (ladderRowsT, hist, posOf, log) => {
    mock('Load Ladders', ladderRowsT); mock('Load History', hist.length ? hist : EMPTY); mock('Load Content Log (Tracker)', log && log.length ? log : EMPTY);
    const tp = await run('Tracker Plan', store['Load History']);
    if (tp[0].json.nothing_to_do) return { tp, tr: null };
    mock('SERP Check', tp.map(c => V.serpFor(c.json.keyword, c.json.domain, posOf(c.json.keyword))));
    const pp = await run('Parse Positions', store['SERP Check']); mock('Save History', pp);
    return { tp, tr: await run('Tracker Report', pp) };
  };
  const hrow = (id, kw, rung, pos, days) => ({ json: { ladder_id: id, keyword: kw, checked_at: daysAgo(days), position: pos, url: pos > 0 ? slug(kw) : '', serp_features: '', domain: D, rung } });
  const LW = std('lad_W', 'peppol uae', daysAgo(120));
  let t = await trk(LW, [hrow('lad_W', 'peppol uae', 4, 2, 7), hrow('lad_W', 'peppol uae', 4, 3, 14), hrow('lad_W', 'peppol uae', 4, 1, 21)], (k) => k === 'peppol uae' ? 2 : 0);
  console.log('   tracker won ->', JSON.stringify({ won: t.tr[0].json.won, stuck: t.tr[0].json.stuck, done: t.tr[0].json.done }));
  check('tracker: won after 3 earlier top-3 checks + this one', t.tr[0].json.won === true && t.tr[0].json.stuck === false, JSON.stringify({ won: t.tr[0].json.won }));
  t = await trk(LW, [hrow('lad_W', 'peppol uae', 4, 2, 7), hrow('lad_W', 'peppol uae', 4, -1, 14), hrow('lad_W', 'peppol uae', 4, 3, 21), hrow('lad_W', 'peppol uae', 4, 1, 28)], (k) => k === 'peppol uae' ? 2 : 0);
  check('tracker: a failed check is skipped for won', t.tr && t.tr[0].json.won === true, t.tr && t.tr[0].json.won);
  t = await trk(LW, [hrow('lad_W', 'peppol uae', 4, 2, 7), hrow('lad_W', 'peppol uae', 4, 7, 14), hrow('lad_W', 'peppol uae', 4, 1, 21)], (k) => k === 'peppol uae' ? 2 : 0);
  check('tracker: not won with a #7 among the last 4', t.tr[0].json.won === false, t.tr[0].json.won);
  const LS = std('lad_S', 'vat software uae', daysAgo(150), { a: 'published', b: 'published' });
  const sHist = [hrow('lad_S', 'vat software uae cost', 1, 12, 70), hrow('lad_S', 'vat software uae cost', 1, 12, 35), hrow('lad_S', 'vat software uae guide', 1, 0, 63), hrow('lad_S', 'vat software uae guide', 1, 0, 28)];
  const pubLog = (days) => ['vat software uae cost', 'vat software uae guide'].map(k => logRow(k, { ladder_id: 'lad_S', status: 'published', published_url: slug(k), published_at: daysAgo(days) }));
  const flat = (k) => k === 'vat software uae cost' ? 12 : 0;
  t = await trk(LS, sHist, flat, pubLog(75));
  console.log('   tracker stuck ->', JSON.stringify({ won: t.tr[0].json.won, stuck: t.tr[0].json.stuck }));
  check('tracker: stuck (published 75 days ago, no page improved in 8 weeks)', t.tr[0].json.stuck === true && t.tr[0].json.won === false, JSON.stringify({ stuck: t.tr[0].json.stuck }));
  const htmlStuck = t.tr[0].json.html, subjStuck = t.tr[0].json.subject;
  t = await trk(LS, sHist, flat, []);
  check('tracker: the e-mail does not change with the flags', t.tr[0].json.html === htmlStuck && t.tr[0].json.subject === subjStuck, 'html differs');
  t = await trk(LS, sHist, (k) => k === 'vat software uae cost' ? 9 : 0, pubLog(75));
  check('tracker: not stuck when a published page improved (#12 -> #9)', t.tr[0].json.stuck === false, t.tr[0].json.stuck);
  t = await trk(LS, sHist, flat, pubLog(30));
  check('tracker: not stuck when the first page went live 30 days ago', t.tr[0].json.stuck === false, t.tr[0].json.stuck);
  t = await trk(std('lad_S', 'vat software uae', daysAgo(150)), sHist, flat, []);
  check('tracker: not stuck without published pages', t.tr[0].json.stuck === false, t.tr[0].json.stuck);
});

// ===================================================================================
await guard('pipeline phase 3', async () => {
  const SN = 'S25 Pipeline phase 3 — reach, difficulty for your site, plan types, relative rungs, other ladders, settings row, discovery labels, Keyword Check, won ladders monthly';
  reset(); begin(SN);
  const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 400), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 300))); };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const D = F.OUR, SITE = 'site_northwind-erp-com', LOC = 2784;
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const EMPTY = [{ json: {} }];
  const keysOf = (o) => JSON.stringify(Object.keys(o || {}).sort());
  const CACHE_COLS = JSON.stringify(['key', 'kind', 'site_id', 'value', 'updated_at'].sort());
  const SET_COLS = JSON.stringify(['ladder_id', 'site_id', 'domain', 'head_keyword', 'mode', 'priority', 'status', 'plan_type', 'reach', 'source', 'opportunities', 'auto_start', 'max_active', 'max_waiting', 'created_at', 'updated_at'].sort());
  // the overlap rule of the web app (app/shared/src/ladders.ts), to check the n8n side independently
  const STOPW = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
  const toks = (s) => [...new Set(String(s).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOPW.has(t)).map(t => t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '')).filter(Boolean))];
  const same = (a, b) => { const x = toks(a), y = toks(b); if (!x.length || !y.length) return false; const c = x.filter(t => y.includes(t)).length; return c / (x.length + y.length - c) >= 0.75; };
  const reachRow = (reach, o = {}) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach, method: 'size', p75: null, size_reach: reach, sample: 0, top10: 3, organic_keywords: 25, location_code: o.loc || LOC }), updated_at: o.at || daysAgo(2) } });
  const setRow = (ladder_id, o = {}) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ladder_id, site_id: SITE, domain: D, head_keyword: '', mode: 'auto', priority: null, status: 'active', plan_type: '', reach: null, source: 'app', opportunities: '', auto_start: false, max_active: null, max_waiting: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', ...o } });
  const lrowsOther = (id, head, kws, start, o = {}) => kws.map((kw, i) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ladder_id: id, domain: D, head_keyword: head, rung: kw === head ? 4 : 1 + (i % 3), page_no: i + 1, keyword: kw, supporting: '', page_type: 'Guide', target_url: 'https://' + D + '/' + kw.replace(/\s+/g, '-') + '/', page_exists: false, status: 'planned', months: '', start_date: start, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', email: '', callback_url: '', request_id: '', ...o } }));
  // DataForSEO shapes of the reach calls
  const rankedTop = (list) => V.task({ target: D, items: list.map(([kw, kd, pos]) => ({ se_type: 'google', keyword_data: { keyword: kw, keyword_info: { search_volume: 100 }, keyword_properties: { keyword_difficulty: kd } }, ranked_serp_element: { serp_item: { type: 'organic', rank_group: pos, url: 'https://' + D + '/' + kw.replace(/\s+/g, '-') + '/' } } })) });
  const overview = (top10, count) => V.task({ items: [{ se_type: 'google', metrics: { organic: { pos_1: Math.floor(top10 / 4), pos_2_3: Math.floor(top10 / 4), pos_4_10: top10 - 2 * Math.floor(top10 / 4), count: count == null ? top10 * 5 : count, etv: 10 } } }] });

  // ---------- A. reach: percentile, size tiers, the larger of the two, cache (discovery nodes) ----------
  mock('Seed List', { domain: D, location_code: LOC, language_code: 'en', seeds: ['erp'], primary_seed: 'erp' });
  const reachVia = async (cacheRows, rankedList, top10) => {
    mock('Load Site Cache', cacheRows && cacheRows.length ? cacheRows : EMPTY);
    const rq = await run('Reach Requests (Discovery)', EMPTY);
    if (rq[0].json.skip) delete store['Run Reach Requests'];
    else mock('Run Reach Requests', rq.map(r => r.json.kind === 'reach_ranked' ? (rankedList === null ? { error: { message: 'timeout' } } : rankedTop(rankedList)) : (top10 === null ? { error: { message: 'timeout' } } : overview(top10))));
    const r = await run('Reach (Discovery)', rq[0].json.skip ? rq : store['Run Reach Requests']);
    return { rq, r: r[0].json };
  };
  let x = await reachVia([], [['a1', 10, 1], ['a2', 20, 2], ['a3', 30, 3], ['a4', 40, 4], ['a5', 50, 5], ['a6', 60, 6], ['a7', 70, 7], ['a8', 80, 8], ['b1', 90, 15], ['b2', null, 4]], 9);
  check('reach: two DataForSEO calls when nothing is stored (top-10 keywords, size)', x.rq.length === 2 && eq(x.rq.map(r => r.json.kind), ['reach_ranked', 'reach_overview']) && x.rq[0].json.body[0].filters[0][2] === 10 && x.rq[0].json.body[0].target === D, JSON.stringify(x.rq.map(r => r.json.body)));
  check('reach: 75th percentile of the top-10 difficulties (8 known: 62.5 -> 63; #15 and unknown kd ignored)', x.r.reach === 63 && x.r.method === 'percentile' && x.r.p75 === 63 && x.r.sample === 8 && x.r.size_reach === 20, JSON.stringify(x.r));
  check('reach: newly measured -> one seo_cache row, exact columns', x.r.save === true && keysOf(x.r.cache_row) === CACHE_COLS && x.r.cache_row.key === 'reach:' + SITE && JSON.parse(x.r.cache_row.value).reach === 63 && JSON.parse(x.r.cache_row.value).location_code === LOC, JSON.stringify(x.r.cache_row));
  const rrd = await run('Reach Row (Discovery)', [{ json: x.r }]);
  check('Reach Row (Discovery) passes exactly the cache columns', keysOf(rrd[0].json) === CACHE_COLS, keysOf(rrd[0].json));
  for (const [t10, want] of [[0, 10], [4, 10], [5, 20], [49, 20], [50, 35], [499, 35], [500, 50], [2400, 50]]) {
    x = await reachVia([], [['a1', 70, 2], ['a2', 80, 3]], t10);
    check('reach by size: ' + t10 + ' keywords in the top 10 -> ' + want, x.r.reach === want && x.r.method === 'size', JSON.stringify(x.r));
  }
  x = await reachVia([], [['a1', 5, 1], ['a2', 6, 2], ['a3', 7, 3], ['a4', 8, 4], ['a5', 9, 5], ['a6', 10, 6]], 600);
  check('reach: the larger of percentile (9) and size (50)', x.r.reach === 50 && x.r.p75 === 9 && x.r.method === 'size', JSON.stringify(x.r));
  x = await reachVia([], [['a1', 40, 1], ['a2', 45, 2], ['a3', 50, 3], ['a4', 55, 4]], 3);
  check('reach: fewer than 5 top-10 keywords -> size only', x.r.reach === 10 && x.r.p75 === null && x.r.sample === 4, JSON.stringify(x.r));
  x = await reachVia([], null, null);
  check('reach: both calls failed -> starting value 10, not stored', x.r.reach === 10 && x.r.method === 'default' && x.r.save === false && x.r.errors.length === 2, JSON.stringify(x.r));
  x = await reachVia([], null, 120);
  check('reach: ranking call failed, size known (120) -> 35, stored', x.r.reach === 35 && x.r.method === 'size' && x.r.save === true, JSON.stringify(x.r));
  x = await reachVia([reachRow(42)], []);
  check('reach cache hit: stored 2 days ago -> no DataForSEO call, reused, not saved again', x.rq.length === 1 && x.rq[0].json.skip && x.r.reach === 42 && x.r.cached === true && x.r.save === false, JSON.stringify({ rq: x.rq.map(r => r.json), r: x.r }));
  x = await reachVia([reachRow(42, { at: daysAgo(31) })], [['a1', 30, 1]], 7);
  check('reach cache: stored 31 days ago -> measured again', x.rq.length === 2 && x.r.cached === false && x.r.reach === 20, JSON.stringify(x.r));
  x = await reachVia([reachRow(42, { loc: 2840 })], [['a1', 30, 1]], 7);
  check('reach cache: stored for another market -> measured again', x.rq.length === 2 && x.r.reach === 20, JSON.stringify(x.r));
  mock('Seed List', { domain: '', location_code: LOC, language_code: 'en', seeds: ['erp'] });
  x = await reachVia([], []);
  check('reach: no website -> nothing asked, reach null', x.rq[0].json.skip && x.r.reach === null && x.r.save === false, JSON.stringify(x.r));

  // ---------- B. difficulty for your site and plan type (the Keyword Check answer node) ----------
  const AR = (o = {}) => ({ ok: true, keyword: 'e invoicing software uae', domain: D, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', volume: 320, kd: 40, cpc: 6.5, intent: 'commercial', known: true, position: null, position_url: null,
    reach_info: { reach: 35, method: 'size', p75: null, size_reach: 35, sample: 2, top10: 60, organic_keywords: 400, cached: true, cached_at: daysAgo(3) }, reach_errors: [], cache_row: null, dfs_cost: 0.0202, business: 'ERP partner', services: ['ERP'], existing_keywords: [], business_source: 'request', ...o });
  const FIT = (o = {}) => [{ json: { output: { fit: 2, navigational: false, alternatives: [], ...o } } }];
  const answer = async (ar, fit) => { mock('Assess Result', ar); const r = await run('Assess Response', fit || FIT()); return r[0].json.body; };
  for (const [kd, pos, want, plan, months] of [[40, null, 'easy', 'direct', '2-4'], [41, null, 'reachable', 'short', '4-8'], [55, null, 'reachable', 'short', '4-8'], [56, null, 'hard', 'full', '9-15'], [75, null, 'hard', 'full', '9-15'], [76, null, 'very_hard', 'full', '9-15'], [null, null, 'reachable', 'short', '4-8'], [90, 15, 'easy', 'direct', '2-3'], [90, 25, 'very_hard', 'full', '9-15']]) {
    const b = await answer(AR({ kd, position: pos }));
    check('reach 35, kd ' + kd + (pos ? ', already #' + pos : '') + ' -> ' + want + ' / ' + plan + ' / ' + months + ' months', b.difficulty_for_you === want && b.plan_type === plan && b.months === months, JSON.stringify({ d: b.difficulty_for_you, p: b.plan_type, m: b.months }));
  }
  let b = await answer(AR({ kd: 76 }));
  check('very hard = full ladder, stretch', b.stretch === true && b.label === 'Very hard for your site · Full ladder (stretch) · 9-15 months', b.label);
  b = await answer(AR({ kd: 50, reach_info: { ...AR().reach_info, top10: 150 } }));
  check('strong site (150 top-10 keywords): short ladder 3-6 months', b.plan_type === 'short' && b.months === '3-6', JSON.stringify(b));

  // ---------- C. ladder: plan types at reach 10 / 35 / 55, relative rungs, write-now order ----------
  mock('Start Form', F.forms.startLadder);
  const nL = await run('Normalize Input', F.forms.pageLadder);
  mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
  mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
  const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
  mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
  mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
  await run('Merge Keyword Data', store['Site Authority']);
  mock('Verdict Agent', { output: { ...F.verdictGo, what_must_change: ['Earn 20+ referring domains', 'Consider "e invoicing software uae" first'], expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
  const pvL = await run('Parse Verdict', store['Verdict Agent']);
  mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
  const lrq = await run('Ladder Requests', EMPTY);
  check('Ladder Requests reads Parse Verdict (the Data Table loads run before it)', lrq.length === 4 && lrq[3].json.kind === 'ranked' && lrq[3].json.domain === D, JSON.stringify(lrq.map(r => r.json.kind)));
  mock('Run Ladder Research', V.ladderResearch(lrq.map(r => r.json)));
  const lpool = await run('Ladder Pool', store['Run Ladder Research']);
  const SRk = lpool[0].json.site_rankings;
  check('pool keeps the difficulty per ranked keyword and the top-10 list', SRk.available === true && SRk.top10.length === 2 && SRk.top10.every(k => k.position <= 10 && typeof k.kd === 'number') && typeof SRk.head.kd === 'number', JSON.stringify(SRk.top10));
  const lch = await run('Ladder Relevance Chunks', lpool);
  mock('Ladder Keyword Relevance', lch.map(c => V.ladderRelevance(c.json)));
  const PV0 = pvL[0].json; const LID = PV0.ladder_id;
  const planWith = async (o = {}) => {
    mock('Parse Verdict', { ...PV0, ...(o.pv || {}) });
    mock('Load Site Cache', o.reach == null ? EMPTY : [reachRow(o.reach)]);
    mock('Load Domain Ladders', o.ladders || EMPTY); mock('Load Domain Ladder Settings', o.settings || EMPTY);
    const p = await run('Ladder Plan', store['Ladder Keyword Relevance']);
    return p[0].json;
  };
  const pagesOf = (L) => L.rungs.flatMap(r => r.pages);
  const bandsOk = (L) => L.rungs.every(r => r.band_max === L.reach + (r.rung - 1) * 15 && r.pages.every(p => { const kd = p.kd == null ? L.reach + 10 : p.kd; return kd <= r.band_max && (r.rung !== 1 || p.volume >= 20); }));
  const Lm = await planWith({});
  check('ladder without a stored reach: measured from its own data (0 keywords in the top 10 -> 10) and offered to the cache', Lm.ladder.reach === 10 && Lm.ladder.reach_info.method === 'size' && !Lm.ladder.reach_info.cached && keysOf(Lm.reach_cache_row) === CACHE_COLS, JSON.stringify(Lm.ladder.reach_info));
  const rrl = await run('Reach Row (Ladder)', EMPTY);
  check('Reach Row (Ladder): exact cache columns', keysOf(rrl[0].json) === CACHE_COLS && rrl[0].json.key === 'reach:' + SITE, keysOf(rrl[0].json));
  const L10 = (await planWith({ reach: 10 })).ladder;
  const rrl2 = await run('Reach Row (Ladder)', EMPTY);
  check('stored reach -> Reach Row (Ladder) skips', rrl2[0].json.skip === true && L10.reach_info.cached === true, JSON.stringify(rrl2[0].json));
  check('reach 10, main keyword kd 46 -> hard -> full ladder 9-15 months', L10.reach === 10 && L10.difficulty_for_you === 'hard' && L10.plan_type === 'full' && L10.months === '9-15' && L10.planned && !L10.stretch && L10.label === 'Hard for your site · Full ladder · 9-15 months', JSON.stringify({ r: L10.reach, d: L10.difficulty_for_you, p: L10.plan_type, m: L10.months, l: L10.label }));
  check('full: rungs relative to reach (rung 1 <= 10, rung 2 <= 25, rung 3 <= 40)', bandsOk(L10) && L10.rungs.map(r => r.band_max).join() === '10,25,40' && /up to 10\)/.test(L10.rungs[0].label) && /11-25/.test(L10.rungs[1].label) && /26-40/.test(L10.rungs[2].label) && pagesOf(L10).length >= 6, JSON.stringify(L10.rungs.map(r => [r.label, r.pages.map(p => p.kd)])));
  check('full: write-now = the first supporting page; the main page is the last page', L10.write_now.length === 1 && L10.write_now[0].rung !== 4 && L10.write_now[0].keyword === pagesOf(L10)[0].keyword && L10.top.page_no === pagesOf(L10).length + 1, JSON.stringify(L10.write_now.map(w => [w.rung, w.keyword])));
  check('full: main page in months 9-15 after the rungs', eq(L10.top.months, [9, 15]) && L10.timeline[L10.timeline.length - 1].rung === 4, JSON.stringify(L10.timeline));
  check('full: keywords for later are above reach + 30 (or held back)', L10.later.every(k => k.held_back || k.kd == null || k.kd > 40), JSON.stringify(L10.later.slice(0, 4)));
  const L35 = (await planWith({ reach: 35 })).ladder;
  check('reach 35 -> reachable -> short ladder 4-8 months', L35.difficulty_for_you === 'reachable' && L35.plan_type === 'short' && L35.months === '4-8', JSON.stringify({ d: L35.difficulty_for_you, p: L35.plan_type, m: L35.months }));
  check('short: 3-5 supporting pages (rungs relative to 35), then the main page', pagesOf(L35).length >= 3 && pagesOf(L35).length <= 5 && L35.top.page_no === pagesOf(L35).length + 1 && bandsOk(L35), JSON.stringify(pagesOf(L35).map(p => [p.rung, p.kd])));
  check('short: supporting pages months 1-3, main page 4-8, write-now without the main page', L35.rungs.filter(r => r.pages.length).every(r => eq(r.months, [1, 3])) && eq(L35.top.months, [4, 8]) && L35.write_now.length === 1 && L35.write_now[0].rung !== 4, JSON.stringify(L35.timeline));
  const L55 = (await planWith({ reach: 55, pv: { pages_now: 3 } })).ladder;
  check('reach 55 -> easy -> direct plan 2-4 months', L55.difficulty_for_you === 'easy' && L55.plan_type === 'direct' && L55.months === '2-4' && L55.label === 'Easy for your site · Direct plan · 2-4 months', JSON.stringify({ d: L55.difficulty_for_you, p: L55.plan_type, l: L55.label }));
  check('direct: main page + 2-3 supporting pages; the main page is page 1', pagesOf(L55).length >= 2 && pagesOf(L55).length <= 3 && L55.top.page_no === 1 && pagesOf(L55).every(p => p.page_no > 1), JSON.stringify(pagesOf(L55).map(p => p.page_no)));
  check('direct: write-now order = the main page first, then its supporting pages', L55.write_now.length === 3 && L55.write_now[0].rung === 4 && L55.write_now[0].keyword === 'e invoicing in uae' && L55.write_now.slice(1).every(w => w.rung !== 4) && L55.write_now[0].links_to.length === pagesOf(L55).length && L55.write_now[0].links_to.every(l => /^rung/.test(l.role)), JSON.stringify(L55.write_now.map(w => [w.rung, w.keyword])));
  check('direct: the timeline starts with the main page', L55.timeline[0].rung === 4 && /written first/.test(L55.timeline[0].label) && eq(L55.top.months, [2, 4]), JSON.stringify(L55.timeline));
  check('direct: pages beyond the plan are kept for later', L55.later.some(k => k.held_back), JSON.stringify(L55.later.slice(0, 3)));
  const Lstrong = (await planWith({ reach: 55, pv: { site_authority: { organic_keywords: 1800, top3: 40, top10: 160, est_monthly_traffic: 900 } } })).ladder;
  check('strong site: direct plan 2-3 months', Lstrong.plan_type === 'direct' && Lstrong.months === '2-3', Lstrong.months);
  const Lpos = (await planWith({ reach: 10, pv: { keyword_data: { ...PV0.keyword_data, keyword_difficulty: 80 } } })).ladder;
  check('reach 10, kd 80 -> very hard: full ladder (stretch), alternatives first in the report', Lpos.difficulty_for_you === 'very_hard' && Lpos.plan_type === 'full' && Lpos.stretch === true && Lpos.feasibility.status === 'stretch' && Lpos.feasibility.alternatives.length > 0 && Lpos.notes.some(n => /consider one of the alternatives first/.test(n)), JSON.stringify({ alt: Lpos.feasibility.alternatives, notes: Lpos.notes }));

  // the report and the callback of a planned ladder (short)
  const deliver = async () => { const rep = await run('Build Ladder Report', EMPTY); await run('Prepare PDF Ladder', rep); mock('Render PDF Ladder', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]); const att = await run('Attach PDF Ladder', store['Render PDF Ladder']); return { rep, att, html: decode(rep) }; };
  await planWith({ reach: 35 });
  let dl = await deliver();
  save('ladder-plan-short.doc.html', dl.html); scanHtml('ladder plan (short)', dl.html);
  check('report: "Why this plan" with the reach, the difficulty for this site and the plan', /Why this plan/.test(dl.html) && /reach is difficulty <b>35<\/b>/.test(dl.html) && /Reachable for your site/.test(dl.html) && /Short ladder — about 4-8 months/.test(dl.html) && /reach 35/.test(dl.html) && !/Tracking stops/.test(dl.html), 'html');
  check('report: difficulty labels relative to reach ("easy for you")', /· easy for you/.test(dl.html) && /rung 2 up to reach \+ 15/.test(dl.html), 'html');
  await planWith({ reach: 55 }); dl = await deliver(); save('ladder-plan-direct.doc.html', dl.html); scanHtml('ladder plan (direct)', dl.html);
  check('report (direct): the main page is written first', /Write the main page first/.test(dl.html) && /written first — months 2-4/.test(dl.html), 'html');

  // ---------- D. not realistic, duplicate main keyword, other ladders' keywords ----------
  const Lav = (await planWith({ reach: 35, pv: { verdict: 'AVOID', verdict_reasons: ['Searchers want the government portal'] } })).ladder;
  check('verdict AVOID -> not realistic: no ladder pages, alternatives only', Lav.difficulty_for_you === 'not_realistic' && Lav.plan_type === 'none' && Lav.planned === false && pagesOf(Lav).length === 0 && !Lav.write_now.length && Lav.feasibility.alternatives.length > 0 && Lav.refusal.reason === 'not_realistic' && Lav.months === '' && !Lav.link_map.length && Lav.stats.pages_total === 0, JSON.stringify({ p: Lav.plan_type, alt: Lav.feasibility.alternatives, ref: Lav.refusal }));
  dl = await deliver(); scanHtml('ladder plan (not realistic)', dl.html); save('ladder-plan-not-realistic.doc.html', dl.html);
  check('not realistic: the report says so, shows the alternatives, has no ladder section', /No ladder planned/.test(dl.html) && /Realistic alternative top rungs/.test(dl.html) && !/\d+\. The ladder<\/h2>/.test(dl.html) && !/Pages written now/.test(dl.html), 'html');
  const lr0 = await run('Ladder Rows', dl.att);
  check('not realistic: no seo_ladders rows', lr0.length === 1 && lr0[0].json.skip === true, JSON.stringify(lr0[0].json));
  delete store['Save Ladder Rows']; delete store['Save Ladder Settings'];
  const sr0 = await run('Ladder Settings Rows', lr0);
  check('not realistic: no settings row', sr0.length === 1 && sr0[0].json.skip === true, JSON.stringify(sr0[0].json));
  const del0 = await run('Ladder Delivery', lr0);
  check('not realistic: delivered without a store error', del0[0].json.tracking_registered === false && del0[0].json.store_error === null && del0[0].json.settings_error === null && Object.keys(del0[0].binary).length === 2, JSON.stringify({ t: del0[0].json.tracking_registered, e: del0[0].json.store_error, s: del0[0].json.settings_error }));
  const sp0 = await run('Spawn Page Runs', del0);
  check('not realistic: no page runs are spawned', sp0.length === 0, sp0.length);
  const resp0 = await run('Build Ladder Response', del0);
  check('not realistic: callback planned false, plan none, no top page, the refusal', resp0[0].json.planned === false && resp0[0].json.plan_type === 'none' && resp0[0].json.top_page === null && resp0[0].json.refusal.reason === 'not_realistic' && resp0[0].json.difficulty_for_you === 'not_realistic' && resp0[0].json.feasibility.alternatives.length > 0, JSON.stringify({ p: resp0[0].json.plan_type, r: resp0[0].json.refusal }));
  const Lnav = (await planWith({ reach: 55, pv: { keyword_data: { ...PV0.keyword_data, google_intent: 'navigational' } } })).ladder;
  check('navigational main keyword -> not realistic even when its difficulty is easy', Lnav.difficulty_for_you === 'not_realistic' && Lnav.planned === false, Lnav.difficulty_for_you);
  const Ldup = (await planWith({ reach: 35, ladders: lrowsOther('lad_old', 'E-invoicing in the UAE', ['E-invoicing in the UAE', 'peppol uae'], daysAgo(40)) })).ladder;
  check('duplicate main keyword ("E-invoicing in the UAE" = "e invoicing in uae") -> refused, no pages', Ldup.planned === false && Ldup.plan_type === 'none' && Ldup.refusal.reason === 'duplicate' && Ldup.refusal.ladder_id === 'lad_old' && pagesOf(Ldup).length === 0 && /already has a keyword ladder/.test(Ldup.notes[0]), JSON.stringify(Ldup.refusal));
  dl = await deliver(); scanHtml('ladder plan (duplicate)', dl.html);
  check('duplicate: the report explains it', /already has a keyword ladder for/.test(dl.html) && /No ladder planned/.test(dl.html), 'html');
  const lrD = await run('Ladder Rows', dl.att);
  check('duplicate: nothing stored', lrD[0].json.skip === true && lrD[0].json.reason === 'duplicate', JSON.stringify(lrD[0].json));
  const Lnd = (await planWith({ reach: 35, ladders: lrowsOther('lad_old', 'e invoicing software uae', ['e invoicing software uae'], daysAgo(40)) })).ladder;
  check('not a duplicate: "e invoicing software uae" shares 2 of 3 words', Lnd.planned === true && !Lnd.refusal, JSON.stringify(Lnd.refusal));
  const pick = pagesOf(L35).slice(0, 2).map(p => p.keyword);
  const sup = pagesOf(L10).flatMap(p => p.supporting).find(k => !pick.some(q => same(q, k)));
  const other = lrowsOther('lad_other', 'peppol access point uae', ['peppol access point uae', 'the ' + pick[0], pick[1], sup], daysAgo(60));
  const Lex = (await planWith({ reach: 35, ladders: other })).ladder;
  const plannedKw = [...pagesOf(Lex).flatMap(p => [p.keyword, ...p.supporting]), ...Lex.top.supporting];
  console.log('   other ladder ->', JSON.stringify({ taken: ['the ' + pick[0], pick[1], sup], excluded: Lex.excluded_keywords.map(x => x.keyword).slice(0, 8) }));
  check('other ladders: their keywords are never planned again ("the …" variant, a page, a supporting keyword)', !plannedKw.some(k => [pick[0], pick[1], sup].some(t => same(k, t))) && [pick[0], pick[1], sup].every(t => Lex.excluded_keywords.some(x => same(x.keyword, t) && x.ladder_id === 'lad_other')), JSON.stringify({ planned: plannedKw.slice(0, 12), excluded: Lex.excluded_keywords.slice(0, 5) }));
  check('other ladders: the plan notes what was left out', Lex.notes.some(n => /already belong to other ladders/.test(n)) && Lex.stats.excluded_keywords >= 3 && Lex.planned, JSON.stringify(Lex.notes));
  const Larch = (await planWith({ reach: 35, ladders: other, settings: [setRow('lad_other', { status: 'archived' })] })).ladder;
  check('other ladders: an archived ladder does not block its keywords', !Larch.excluded_keywords.length && pagesOf(Larch)[0].keyword === pick[0], JSON.stringify(Larch.excluded_keywords.slice(0, 3)));
  const Lwww = (await planWith({ reach: 35, ladders: lrowsOther('lad_www', 'e invoicing in uae', ['e invoicing in uae'], daysAgo(5), { domain: 'www.' + D }) })).ladder;
  check('other ladders: a row stored with www. is the same website', Lwww.refusal && Lwww.refusal.reason === 'duplicate', JSON.stringify(Lwww.refusal));

  // ---------- E. the seo_ladder_settings row ----------
  const lads = [...lrowsOther('lad_A', 'wms dubai', ['wms dubai', 'wms dubai cost'], daysAgo(30)), ...lrowsOther('lad_B', 'payroll software uae', ['payroll software uae', 'wps payroll uae'], daysAgo(90))];
  const sets = [setRow('_site', { mode: 'manual', opportunities: 'auto', max_active: 2, max_waiting: 3 }), setRow('lad_A', { priority: 2 })];
  const storedRows = (rows) => mock('Save Ladder Rows', rows.map(r => ({ json: { id: 7, createdAt: 'x', updatedAt: 'x', ...r.json } })));
  await planWith({ reach: 35, ladders: lads, settings: sets }); dl = await deliver();
  const lrS = await run('Ladder Rows', dl.att); storedRows(lrS);
  const sr = await run('Ladder Settings Rows', store['Save Ladder Rows']);
  const mine = (sr.find(r => r.json.ladder_id === LID) || {}).json || {}, back = (sr.find(r => r.json.ladder_id === 'lad_B') || {}).json || {};
  console.log('   settings rows ->', JSON.stringify(sr.map(r => [r.json.ladder_id, r.json.priority, r.json.mode, r.json.status, r.json.plan_type, r.json.reach, r.json.source])));
  check('settings rows: exactly the seo_ladder_settings columns', sr.every(r => keysOf(r.json) === SET_COLS), sr.map(r => keysOf(r.json)).join(' | '));
  check('settings row: mode from the _site row (manual), after every existing ladder (4), active, plan short, reach 35, source ladder', mine.mode === 'manual' && mine.priority === 4 && mine.status === 'active' && mine.plan_type === 'short' && mine.reach === 35 && mine.source === 'ladder' && mine.site_id === SITE && mine.domain === D && mine.head_keyword === 'e invoicing in uae' && mine.created_at === mine.updated_at && mine.opportunities === '' && mine.auto_start === false && mine.max_active === null, JSON.stringify(mine));
  check('settings: an existing ladder without a priority keeps its place (3, after lad_A = 2), mode / status empty = no override', back.priority === 3 && back.mode === '' && back.status === '' && back.source === 'system' && back.head_keyword === 'payroll software uae' && !sr.some(r => r.json.ladder_id === 'lad_A') && sr.length === 2, JSON.stringify(sr.map(r => [r.json.ladder_id, r.json.priority])));
  mock('Save Ladder Settings', sr.map(r => ({ json: { id: 3, createdAt: 'x', updatedAt: 'x', ...r.json } })));
  let del = await run('Ladder Delivery', store['Save Ladder Settings']);
  check('delivery reports the stored ladder and its settings row', del[0].json.tracking_registered === true && del[0].json.stored_rows === lrS.length && del[0].json.settings_registered === true && del[0].json.settings_error === null, JSON.stringify({ t: del[0].json.tracking_registered, s: del[0].json.settings_registered, e: del[0].json.settings_error }));
  const resp = await run('Build Ladder Response', del);
  const R = resp[0].json;
  const OLD_KEYS = ['status', 'stage', 'request_id', 'execution_id', 'ladder_id', 'keyword', 'domain', 'country', 'goal', 'head', 'feasibility', 'rungs', 'top_page', 'link_map', 'timeline', 'write_now', 'pages_started', 'later', 'requirements', 'stats', 'notes', 'tracker', 'tracking_registered', 'stored_rows', 'store_error', 'run_ledger', 'emailed_to', 'pdf', 'file', 'callback_url'];
  check('ladder_plan callback: every v4.7 field kept', OLD_KEYS.every(k => k in R) && R.stage === 'ladder_plan' && R.top_page && R.top_page.rung === 4, OLD_KEYS.filter(k => !(k in R)).join(','));
  check('ladder_plan callback: plan_type, reach, difficulty_for_you, months, label, planned, reach_info, settings_registered', R.plan_type === 'short' && R.reach === 35 && R.difficulty_for_you === 'reachable' && R.months === '4-8' && R.label === 'Reachable for your site · Short ladder · 4-8 months' && R.planned === true && R.refusal === null && R.reach_info.cached === true && R.settings_registered === true && Array.isArray(R.excluded_keywords), JSON.stringify({ p: R.plan_type, r: R.reach, d: R.difficulty_for_you, m: R.months, l: R.label }));
  mock('Save Ladder Settings', [{ json: { error: { message: 'Column "reach" does not exist' } } }]);
  del = await run('Ladder Delivery', store['Save Ladder Settings']);
  check('a failing settings upsert is visible in the callback (settings_error)', del[0].json.settings_registered === false && /Column "reach"/.test(del[0].json.settings_error) && del[0].json.tracking_registered === true, JSON.stringify({ s: del[0].json.settings_registered, e: del[0].json.settings_error }));
  await planWith({ reach: 10 }); dl = await deliver();
  const lr1 = await run('Ladder Rows', dl.att); storedRows(lr1);
  const sr1 = await run('Ladder Settings Rows', store['Save Ladder Rows']);
  check('settings row: no _site row -> auto; the first ladder of the site -> priority 1; plan full, reach 10', sr1.length === 1 && sr1[0].json.mode === 'auto' && sr1[0].json.priority === 1 && sr1[0].json.plan_type === 'full' && sr1[0].json.reach === 10, JSON.stringify(sr1.map(r => r.json)));
  await planWith({ reach: 55, ladders: lrowsOther('lad_B', 'payroll software uae', ['payroll software uae'], daysAgo(90)), settings: [setRow(LID, { mode: 'manual', priority: 1, source: 'app', created_at: '2026-10-02T00:00:00.000Z' })] }); dl = await deliver();
  const lr2 = await run('Ladder Rows', dl.att); storedRows(lr2);
  const sr2 = await run('Ladder Settings Rows', store['Save Ladder Rows']);
  const own = (sr2.find(r => r.json.ladder_id === LID) || {}).json || {}, b2 = (sr2.find(r => r.json.ladder_id === 'lad_B') || {}).json || {};
  check('a row the app wrote first keeps mode, priority, source and created_at; plan type and reach are filled in', own.mode === 'manual' && own.priority === 1 && own.source === 'app' && own.created_at === '2026-10-02T00:00:00.000Z' && own.plan_type === 'direct' && own.reach === 55 && b2.priority === 2, JSON.stringify(sr2.map(r => [r.json.ladder_id, r.json.priority, r.json.mode, r.json.source])));
  mock('Save Ladder Rows', [{ json: { error: { message: 'Data table with name "seo_ladders" not found' } } }]);
  const srF = await run('Ladder Settings Rows', store['Save Ladder Rows']);
  check('settings row only once the ladder rows are stored', srF.length === 1 && srF[0].json.skip === true, JSON.stringify(srF[0].json));

  // ---------- F. discovery: labels and tiers with and without a website ----------
  const SEEDS = { output: { primary_seed: 'erp implementation services', seed_groups: { services: ['erp implementation services', 'odoo implementation', 'dynamics 365 business central partner', 'erp customisation'], problems: ['inventory software for distributors', 'replace excel stock control'], comparisons: ['best erp for distributors', 'odoo vs dynamics 365'], pricing: ['erp implementation cost', 'odoo pricing uae'], local: ['erp implementation dubai', 'erp company abu dhabi'], audience: ['erp for wholesale distributors', 'northwind erp reviews'] }, services: ['ERP implementation', 'Data migration'] } };
  const discover = async (withDomain, cacheRows) => {
    delete store['Start Form']; mock('Start Form', F.forms.startDiscover);
    const nD = await run('Normalize Input', withDomain ? F.forms.pageDiscover : { ...F.forms.pageDiscover, 'Website Domain': '', 'Extra Features': [] });
    mock('Route Mode', nD); mock('Keyword Seeds', SEEDS);
    const sl = await run('Seed List', store['Keyword Seeds']);
    mock('Load Site Cache', cacheRows || EMPTY);
    const rq = await run('Reach Requests (Discovery)', sl);
    if (rq[0].json.skip) delete store['Run Reach Requests']; else mock('Run Reach Requests', rq.map(r => r.json.kind === 'reach_ranked' ? rankedTop([['a1', 10, 1], ['a2', 20, 2], ['a3', 25, 3], ['a4', 30, 5], ['a5', 35, 7]]) : overview(12)));
    const rdv = await run('Reach (Discovery)', rq[0].json.skip ? rq : store['Run Reach Requests']);
    const rr = await run('Research Requests', rdv);
    mock('Run Research', V.runResearch(rr.map(r => r.json)));
    const ckr = await run('Competitor Keyword Requests', store['Run Research']);
    mock('Run Competitor Keywords', V.runCompetitorKeywords(ckr.map(r => r.json)));
    const col = await run('Collect Research', store['Run Competitor Keywords']);
    const ch = await run('Relevance Chunks', col);
    mock('Keyword Relevance', ch.map(c => V.relevance(c.json)));
    const rk = await run('Rank Keywords', store['Keyword Relevance']);
    const legacy = await run('legacy:Rank_Keywords_v4_7', store['Keyword Relevance']);
    mock('AI Demand', V.aiDemand(rk[0].json.keyword_strategy.keywords.map(k => k.keyword)));
    const pk = await run('Priority Keywords', store['AI Demand']);
    mock('Candidate SERP', pk.map((p, i) => i === 0 ? V.serpFor(p.json.keyword, D, 12) : F.aiSerp({ type: 'category', query: p.json.keyword })));
    const ks = await run('Build Keyword Strategy', store['Candidate SERP']);
    const legacyKs = await run('legacy:Build_Keyword_Strategy_v4_7', store['Candidate SERP']);
    const ir = await run('Build Ideas Response', ks);
    return { rq, rd: rdv[0].json, rk: rk[0].json.keyword_strategy, legacy: legacy[0].json.keyword_strategy, ks: ks[0].json, legacyKs: legacyKs[0].json, ir: ir[0].json };
  };
  const W = await discover(true);
  const kws = W.rk.keywords;
  const want = (kd) => kd == null ? 'reachable' : kd <= 35 ? 'easy' : kd <= 50 ? 'reachable' : kd <= 70 ? 'hard' : 'very_hard';
  check('discovery with a website: reach measured (p75 of 10,20,25,30,35 = 30) before the research', W.rq.length === 2 && W.rd.reach === 30 && W.rd.save === true && W.rd.method === 'percentile', JSON.stringify(W.rd));
  check('discovery: every keyword labelled for this site (difficulty_for_you, plan_type, months, label)', kws.length > 0 && kws.every(k => k.difficulty_for_you && k.plan_type && k.months && k.for_you_label), JSON.stringify(kws[0]));
  check('discovery: labels follow reach 30 (easy <= 35, reachable <= 50, hard <= 70)', kws.every(k => k.difficulty_for_you === want(k.kd)), JSON.stringify(kws.filter(k => k.difficulty_for_you !== want(k.kd)).slice(0, 3)));
  const nowC = W.rk.clusters.filter(c => c.tier === 'Now');
  console.log('   tiers with reach 30 ->', JSON.stringify(W.rk.clusters.slice(0, 8).map(c => c.tier + ':' + c.primary_kd + ':' + c.difficulty_for_you)), '| v4.7 ->', JSON.stringify(W.legacy.clusters.slice(0, 8).map(c => c.tier + ':' + c.primary_kd)));
  check('discovery tiers: Now = easy or reachable for this site', nowC.length > 0 && nowC.every(c => ['easy', 'reachable'].includes(c.difficulty_for_you)), JSON.stringify(nowC.map(c => [c.primary_kd, c.difficulty_for_you])));
  check('discovery tiers: no cluster harder than reach + 20 (50) is Now any more', !W.rk.clusters.some(c => c.tier === 'Now' && c.primary_kd != null && c.primary_kd > 50), JSON.stringify(nowC.map(c => c.primary_kd)));
  check('discovery: the pipeline keyword is easy or reachable for this site', ['easy', 'reachable'].includes(W.rk.pipeline_keyword.difficulty_for_you), JSON.stringify(W.rk.pipeline_keyword && [W.rk.pipeline_keyword.keyword, W.rk.pipeline_keyword.kd]));
  const p0 = W.ks.keyword_strategy.priority[0];
  check('discovery: a priority keyword the site already ranks #12 for (live check) -> easy, direct, 2-3 months', p0.live.your_position === 12 && p0.difficulty_for_you === 'easy' && p0.plan_type === 'direct' && p0.months === '2-3', JSON.stringify({ pos: p0.live.your_position, d: p0.difficulty_for_you, m: p0.months }));
  scanHtml('keyword strategy with reach', W.ks.result_html); save('keyword-strategy-reach.html', W.ks.result_html);
  check('discovery report: the reach, a "For your site" column and the label', /Your site's reach: difficulty 30/.test(W.ks.result_html) && /<th>For your site<\/th>/.test(W.ks.result_html) && W.ks.result_html.includes(p0.for_you_label) && /easy or reachable for your site/.test(W.ks.result_html), 'html');
  check('discovery choice options carry the label', W.ks.choice_options[1].endsWith(' · ' + p0.for_you_label), W.ks.choice_options[1]);
  check('keyword_strategy callback: difficulty_for_you / plan_type / months / label per keyword and per topic, plus the reach', W.ir.priority.every(k => k.difficulty_for_you && k.plan_type && k.months && k.label) && W.ir.content_plan.every(c => c.difficulty_for_you && c.plan_type && c.months) && W.ir.reach.reach === 30 && W.ir.start_with.difficulty_for_you, JSON.stringify(W.ir.priority[0]).slice(0, 300));
  const Wc = await discover(true, [reachRow(40)]);
  check('discovery with a stored reach: no DataForSEO call, reach 40 used', Wc.rq.length === 1 && Wc.rq[0].json.skip && Wc.rd.reach === 40 && Wc.rd.cached && Wc.rk.reach.reach === 40 && Wc.rk.keywords.every(k => k.difficulty_for_you === (k.kd == null ? 'reachable' : k.kd <= 45 ? 'easy' : k.kd <= 60 ? 'reachable' : k.kd <= 80 ? 'hard' : 'very_hard')), JSON.stringify(Wc.rd));
  const Wl = await discover(true, [reachRow(10)]);
  const nowL = Wl.rk.clusters.filter(c => c.tier === 'Now'), legacyNow = Wl.legacy.clusters.filter(c => c.tier === 'Now').map(c => c.topic);
  console.log('   tiers with reach 10 ->', JSON.stringify(Wl.rk.clusters.slice(0, 8).map(c => c.tier + ':' + c.primary_kd + ':' + c.difficulty_for_you)));
  check('discovery for a small site (reach 10): Now only up to difficulty 30 — topics v4.7 put in Now move to Next', nowL.every(c => c.primary_kd == null || c.primary_kd <= 30) && legacyNow.some(t => !nowL.some(c => c.topic === t)), JSON.stringify({ now: nowL.map(c => c.primary_kd), legacyNow }));
  const N0 = await discover(false);
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => ['difficulty_for_you', 'plan_type', 'months', 'for_you_label', 'reach'].includes(k) ? undefined : v));
  check('discovery without a website: no reach call, no labels', N0.rq[0].json.skip && N0.rd.reach === null && N0.rk.reach === null && N0.rk.keywords.every(k => k.difficulty_for_you === undefined), JSON.stringify(N0.rd));
  check('discovery without a website = v4.7 (tiers with difficulty <= 55, priority, pipeline keyword)', eq(strip(N0.rk), strip(N0.legacy)) && eq(N0.ks.choice_options, N0.legacyKs.choice_options) && eq(strip(N0.ks.keyword_strategy), strip(N0.legacyKs.keyword_strategy)), 'differs from the frozen v4.7 Rank Keywords / Build Keyword Strategy');
  check('callback without a website: the new fields are null', N0.ir.reach === null && N0.ir.priority.every(k => k.difficulty_for_you === null && k.label === null && k.plan_type === null) && !/For your site/.test(N0.ks.result_html), JSON.stringify(N0.ir.priority[0]).slice(0, 200));

  // ---------- G. Keyword Check workflow (SEOagentAssess) ----------
  const AV = async (body, ip) => { const r = await run('Assess Validate', { headers: { 'x-forwarded-for': ip || 'app:7a1c2d3e-org' }, body }); return r[0].json; };
  H.staticData.assess = undefined;
  const okBody = { keyword: '  E Invoicing Software UAE ', country: 'AE', domain: 'https://www.Northwind-ERP.com/', business: 'ERP and e-invoicing implementation partner', services: ['ERP implementation', 'Peppol e-invoicing'], existing_keywords: ['e invoicing in uae', 'peppol uae'] };
  let v = await AV(okBody);
  check('assess: a valid body is normalised (keyword, domain, country, site id)', v.ok && v.status === 200 && v.keyword === 'e invoicing software uae' && v.domain === D && v.country === 'United Arab Emirates' && v.location_code === 2784 && v.language_code === 'en' && v.site_id === SITE && v.services.length === 2 && v.existing_keywords.length === 2, JSON.stringify(v));
  for (const [label, body, field] of [['missing keyword', { country: 'AE', domain: D }, 'keyword'], ['1-character keyword', { keyword: 'a', country: 'AE', domain: D }, 'keyword'], ['101-character keyword', { keyword: 'x'.repeat(101), country: 'AE', domain: D }, 'keyword'], ['keyword not a string', { keyword: 42, country: 'AE', domain: D }, 'keyword'],
    ['localhost', { keyword: 'erp', country: 'AE', domain: 'localhost' }, 'domain'], ['an IP address', { keyword: 'erp', country: 'AE', domain: '10.0.0.1' }, 'domain'], ['no domain', { keyword: 'erp', country: 'AE' }, 'domain'], ['unknown country', { keyword: 'erp', country: 'Atlantis', domain: D }, 'country'],
    ['services not a list', { keyword: 'erp', country: 'AE', domain: D, services: { a: 1 } }, 'services'], ['existing_keywords not a list', { keyword: 'erp', country: 'AE', domain: D, existing_keywords: 'a, b' }, 'existing_keywords'], ['business not text', { keyword: 'erp', country: 'AE', domain: D, business: ['x'] }, 'business']]) {
    v = await AV(body);
    check('assess 400: ' + label, !v.ok && v.status === 400 && v.errors[field] && Object.keys(v.errors).length === 1, JSON.stringify(v.errors));
  }
  v = await AV({});
  check('assess 400: an empty body -> keyword, domain and country errors at once', v.status === 400 && eq(Object.keys(v.errors).sort(), ['country', 'domain', 'keyword']) && v.error.split('; ').length === 3, JSON.stringify(v.errors));
  check('assess: rejected requests are not counted', !H.staticData.assess || !H.staticData.assess.total || H.staticData.assess.total === 1, JSON.stringify(H.staticData.assess));
  H.staticData.assess = undefined;
  for (let i = 0; i < 40; i++) v = await AV(okBody);
  const v41 = await AV(okBody);
  check('assess 429: the 41st check of one company in a day', v.ok && v41.status === 429 && !v41.ok && /daily limit of 40/.test(v41.error) && H.staticData.assess.keys['app:7a1c2d3e-org'] === 40, v41.error);
  const vOther = await AV(okBody, 'app:other-company-1');
  check('assess: another company has its own daily limit', vOther.ok, vOther.error);
  H.staticData.assess = undefined;
  v = await AV(okBody); mock('Assess Validate', [{ json: v }]);
  mock('Load Assess Cache', EMPTY);
  const aq = await run('Assess Requests', EMPTY);
  check('assess: overview + position + the 2 reach calls when no reach is stored', eq(aq.map(r => r.json.kind), ['overview', 'position', 'reach_ranked', 'reach_overview']) && aq[1].json.body[0].filters[0][2] === 'e invoicing software uae' && aq[1].json.body[0].target === D && aq[0].json.body[0].keywords[0] === 'e invoicing software uae' && aq[0].json.body[0].location_code === 2784, JSON.stringify(aq.map(r => r.json.body)));
  const kwOverview = (kw, kd, vol) => V.task({ items: [{ se_type: 'google', keyword: kw, keyword_info: { search_volume: vol, cpc: 7.25 }, keyword_properties: { keyword_difficulty: kd }, search_intent_info: { main_intent: 'commercial' } }] });
  const posRes = (pos) => V.task({ target: D, items: pos ? [{ keyword_data: { keyword: 'e invoicing software uae' }, ranked_serp_element: { serp_item: { rank_group: pos, url: 'https://www.' + D + '/e-invoicing-software/' } } }] : [] });
  const dfsAnswers = (reqs, o = {}) => reqs.map(r => r.json.kind === 'overview' ? (o.overview || kwOverview('e invoicing software uae', o.kd ?? 38, 480)) : r.json.kind === 'position' ? posRes(o.pos) : r.json.kind === 'reach_ranked' ? rankedTop([['a1', 10, 1], ['a2', 20, 2], ['a3', 25, 3], ['a4', 30, 5], ['a5', 35, 7]]) : overview(12));
  mock('Run Assess Requests', dfsAnswers(aq));
  let ar = await run('Assess Result', store['Run Assess Requests']);
  check('assess: DataForSEO read (volume, kd, intent, cpc), reach 30 measured, cache row, not ranking yet', ar[0].json.ok && ar[0].json.volume === 480 && ar[0].json.kd === 38 && ar[0].json.intent === 'commercial' && ar[0].json.cpc === 7.25 && ar[0].json.reach_info.reach === 30 && ar[0].json.cache_row && ar[0].json.position === null && ar[0].json.business_source === 'request', JSON.stringify({ ...ar[0].json, existing_keywords: undefined }).slice(0, 400));
  let resp1 = await run('Assess Response', FIT({ fit: 2 }));
  let B = resp1[0].json.body;
  const RESP_KEYS = ['keyword', 'country', 'volume', 'kd', 'intent', 'cpc', 'position', 'reach', 'difficulty_for_you', 'plan_type', 'months', 'fit', 'navigational', 'alternatives', 'cost_usd'];
  console.log('   keyword check 200 ->', JSON.stringify(B));
  save('keyword-check-response.json', B);
  check('assess 200: every field of the contract', RESP_KEYS.every(k => k in B) && resp1[0].json.status === 200, RESP_KEYS.filter(k => !(k in B)).join(','));
  check('assess 200: kd 38 at reach 30 -> reachable, short ladder 4-8 months, fit 2, no alternatives', B.difficulty_for_you === 'reachable' && B.plan_type === 'short' && B.months === '4-8' && B.fit === 2 && B.navigational === false && eq(B.alternatives, []) && B.reach === 30 && B.label === 'Reachable for your site · Short ladder · 4-8 months' && !B.warnings.length, JSON.stringify(B));
  check('assess: cost = the DataForSEO task costs (4 x $0.01) + Claude ($0.002)', B.cost_usd === 0.042, B.cost_usd);
  const rra = await run('Reach Row (Assess)', resp1);
  check('assess: the measured reach is stored after the answer (exact cache columns)', keysOf(rra[0].json) === CACHE_COLS && rra[0].json.key === 'reach:' + SITE && JSON.parse(rra[0].json.value).reach === 30, JSON.stringify(rra[0].json));
  mock('Load Assess Cache', [reachRow(30), { json: { key: 'desc:' + D, kind: 'desc', site_id: SITE, value: JSON.stringify({ description: { business_description: 'Stored: ERP partner in Dubai', products_or_services: ['ERP', 'E-invoicing'] }, page_title: '' }), updated_at: daysAgo(5) } }]);
  mock('Assess Validate', [{ json: { ...v, business: '', services: [] } }]);
  const aq2 = await run('Assess Requests', EMPTY);
  check('assess with a stored reach: only 2 DataForSEO calls', eq(aq2.map(r => r.json.kind), ['overview', 'position']), JSON.stringify(aq2.map(r => r.json.kind)));
  mock('Run Assess Requests', dfsAnswers(aq2, { pos: 14, kd: 70 }));
  ar = await run('Assess Result', store['Run Assess Requests']);
  check('assess: the stored reach is reused, business from the stored description, position #14 read', ar[0].json.reach_info.cached && ar[0].json.reach_info.reach === 30 && !ar[0].json.cache_row && ar[0].json.business === 'Stored: ERP partner in Dubai' && eq(ar[0].json.services, ['ERP', 'E-invoicing']) && ar[0].json.business_source === 'stored description' && ar[0].json.position === 14 && /e-invoicing-software/.test(ar[0].json.position_url), JSON.stringify(ar[0].json).slice(0, 300));
  resp1 = await run('Assess Response', FIT({ fit: 2 })); B = resp1[0].json.body;
  check('assess: already #14 -> easy, direct 2-3 months (top 20 shortens); cost $0.022', B.difficulty_for_you === 'easy' && B.plan_type === 'direct' && B.months === '2-3' && B.position === 14 && B.cost_usd === 0.022, JSON.stringify(B));
  const rra2 = await run('Reach Row (Assess)', resp1);
  check('assess: a stored reach is not saved again', rra2[0].json.skip === true, JSON.stringify(rra2[0].json));
  b = await answer(AR({ keyword: 'cleartax e invoicing', existing_keywords: ['e invoicing in uae', 'peppol uae'] }), FIT({ fit: 1, navigational: true, alternatives: ['e invoicing software uae', 'Peppol UAE', 'cleartax e invoicing', 'e invoicing in the UAE', '"FTA e invoicing requirements"', 'einvoicing for sme uae'] }));
  check('assess: another company\'s brand -> not realistic, no plan, up to 3 alternatives (not the keyword itself, not one the site has)', b.difficulty_for_you === 'not_realistic' && b.plan_type === 'none' && b.months === '' && b.navigational === true && eq(b.alternatives, ['e invoicing software uae', 'fta e invoicing requirements', 'einvoicing for sme uae']) && b.label === 'Not realistic for your site', JSON.stringify(b));
  b = await answer(AR({ keyword: 'payroll outsourcing dubai', kd: 20 }), FIT({ fit: 0, alternatives: ['erp implementation dubai'] }));
  check('assess: off-topic (fit 0) -> alternatives, the difficulty is still measured', b.fit === 0 && b.difficulty_for_you === 'easy' && eq(b.alternatives, ['erp implementation dubai']), JSON.stringify(b));
  b = await answer(AR({ kd: 30 }), FIT({ fit: 2, alternatives: ['something else'] }));
  check('assess: a realistic on-topic keyword gets no alternatives', eq(b.alternatives, []), JSON.stringify(b.alternatives));
  b = await answer(AR(), [{ json: { output: '```json\n{"fit": 1, "navigational": false, "alternatives": []}\n```' } }]);
  check('assess: a fenced JSON answer from the model is read', b.fit === 1 && b.navigational === false, JSON.stringify(b));
  b = await answer(AR({ intent: 'navigational', keyword: 'xero login' }), [{ json: { error: { message: 'Overloaded' } } }]);
  check('assess: Claude failed -> fit null, navigational from the keyword data, a warning, no AI cost', b.fit === null && b.navigational === true && b.difficulty_for_you === 'not_realistic' && b.warnings.some(w => /topic check unavailable: Overloaded/.test(w)) && b.cost_usd === 0.0202, JSON.stringify(b));
  b = await answer(AR({ intent: 'navigational', keyword: 'northwind erp' }), [{ json: { error: { message: 'Overloaded' } } }]);
  check('assess: the site\'s own brand is never "another company"', b.navigational === false && b.difficulty_for_you !== 'not_realistic', JSON.stringify(b));
  mock('Assess Validate', [{ json: v }]); mock('Load Assess Cache', EMPTY);
  const aq3 = await run('Assess Requests', EMPTY);
  mock('Run Assess Requests', dfsAnswers(aq3, { overview: { error: { message: 'connect ETIMEDOUT' } } }));
  ar = await run('Assess Result', store['Run Assess Requests']);
  check('assess 502: the keyword overview failed -> ok false with the DataForSEO message', ar[0].json.ok === false && /^DataForSEO keyword overview failed: connect ETIMEDOUT/.test(ar[0].json.error), JSON.stringify(ar[0].json));
  mock('Run Assess Requests', dfsAnswers(aq3, { overview: { status_code: 20000, tasks: [{ status_code: 40200, status_message: 'Payment Required.' }] } }));
  ar = await run('Assess Result', store['Run Assess Requests']);
  check('assess 502: DataForSEO balance empty', ar[0].json.ok === false && /Payment Required\. \(40200\)/.test(ar[0].json.error), ar[0].json.error);
  mock('Run Assess Requests', aq3.map(r => String(r.json.kind).startsWith('reach') ? { error: { message: 'timeout' } } : dfsAnswers([r])[0]));
  ar = await run('Assess Result', store['Run Assess Requests']);
  b = await answer(ar[0].json);
  check('assess: the reach calls failed -> still 200 with the starting reach 10 (not stored) and a warning', ar[0].json.ok && ar[0].json.reach_info.reach === 10 && ar[0].json.reach_info.method === 'default' && !ar[0].json.cache_row && b.reach === 10 && b.warnings.some(w => /partial data/.test(w)), JSON.stringify(b));
  mock('Run Assess Requests', dfsAnswers(aq3, { overview: V.task({ items: [] }) }));
  ar = await run('Assess Result', store['Run Assess Requests']); b = await answer(ar[0].json);
  check('assess: a keyword DataForSEO does not know -> 200, volume / kd null (kd counted as reach + 10), a warning', ar[0].json.ok && b.volume === null && b.kd === null && b.difficulty_for_you === 'reachable' && b.warnings.some(w => /no data for this keyword/.test(w)), JSON.stringify(b));

  // ---------- H. Rank Tracker: a won ladder is checked monthly (main keyword + published pages) ----------
  const slugT = (k) => 'https://www.' + D + '/' + k.replace(/\s+/g, '-') + '/';
  const lrow = (rung, page_no, keyword, status) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ladder_id: 'lad_W', domain: D, head_keyword: 'peppol uae', rung, page_no, keyword, supporting: '', page_type: 'Guide', target_url: slugT(keyword), page_exists: false, status, months: '', start_date: daysAgo(200), country: 'United Arab Emirates', location_code: LOC, language_code: 'en', email: 'owner@example.com', callback_url: 'https://hooks.example.com/x', request_id: 'r-W' } });
  const LW = [lrow(1, 1, 'peppol uae cost', 'published'), lrow(1, 2, 'peppol uae guide', 'planned'), lrow(2, 3, 'peppol uae software', 'published'), lrow(4, 4, 'peppol uae', 'published')];
  const hW = (pos, days) => ({ json: { ladder_id: 'lad_W', keyword: 'peppol uae', checked_at: daysAgo(days), position: pos, url: slugT('peppol uae'), serp_features: '', domain: D, rung: 4 } });
  mock('Load Ladders', LW); mock('Load Content Log (Tracker)', EMPTY);
  mock('Load History', [hW(2, 7), hW(1, 14), hW(3, 21), hW(2, 28)]);
  let tp = await run('Tracker Plan', store['Load History']);
  check('won ladder checked 7 days ago: nothing this week (monthly)', tp.length === 1 && tp[0].json.nothing_to_do && tp[0].json.skipped[0].won === true && /checked monthly, next after/.test(tp[0].json.skipped[0].reason), JSON.stringify(tp[0].json));
  mock('Load History', [hW(2, 29), hW(1, 36), hW(3, 43), hW(2, 50)]);
  tp = await run('Tracker Plan', store['Load History']);
  check('won ladder, last check 29 days ago: the main keyword and the published pages are checked (not the planned page)', eq(tp.map(c => c.json.keyword).sort(), ['peppol uae', 'peppol uae cost', 'peppol uae software']) && tp.every(c => c.json.won_monthly === true), JSON.stringify(tp.map(c => c.json.keyword)));
  mock('SERP Check', tp.map(c => V.serpFor(c.json.keyword, D, c.json.keyword === 'peppol uae' ? 2 : 5)));
  let pp = await run('Parse Positions', store['SERP Check']); mock('Save History', pp);
  let tr = await run('Tracker Report', pp);
  check('monthly check of a won ladder: won stays in the callback, the e-mail says monthly', tr[0].json.won === true && tr[0].json.done === true && /checked once a month/.test(tr[0].json.next_step.text) && /checked monthly/.test(tr[0].json.html) && !/Tracking stops/.test(tr[0].json.html), JSON.stringify({ won: tr[0].json.won, next: tr[0].json.next_step.text }));
  mock('Load History', [hW(2, 7), hW(-1, 14), hW(1, 21), hW(3, 28), hW(2, 35)]);
  tp = await run('Tracker Plan', store['Load History']);
  check('a failed check (-1) does not break a won ladder', tp[0].json.nothing_to_do && tp[0].json.skipped.length === 1 && tp[0].json.skipped[0].won === true, JSON.stringify(tp[0].json));
  mock('Load History', [hW(8, 7), hW(2, 14), hW(1, 21), hW(3, 28)]);
  tp = await run('Tracker Plan', store['Load History']);
  check('a drop out of the top 3 brings the ladder back to weekly checks of every page', tp.length === 4 && tp.every(c => c.json.won_monthly === false), JSON.stringify(tp.map(c => c.json.keyword)));
});

// ===================================================================================
await guard('publish detection', async () => {
  const SN = 'S26 Publish detection (pipeline phase 4) — sitemap index + urlset, slug (www / bare host, slash, folder), title, no false match, existing pages by lastmod, known / old URLs, 15-fetch cap, one URL per page, exact rows, inspection, report, callback';
  reset(); begin(SN);
  const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 400), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 300))); };
  const T = require('./fixtures_tracking'), X = require('./fixtures_detect');
  const D = T.D, SITE = 'site_northwind-erp-com', D2 = 'acme.example', SITE2 = 'site_acme-example', D3 = 'gamma.example', SITE3 = 'site_gamma-example';
  const W = 'https://www.' + D, B = 'https://' + D;
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString(), dayAgo = (n) => daysAgo(n).slice(0, 10);
  const pathOf = (u) => String(u).replace(/^https?:\/\/[^/]+/, '');
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const LCOLS = ['site_id', 'domain', 'keyword', 'source', 'page_type', 'existing_page_url', 'rung', 'ladder_id', 'request_id', 'started_at', 'status', 'published_url', 'published_at', 'week'];
  const keysAre = (o, cols) => eq(Object.keys(o).sort(), [...cols].sort());
  const EMPTY = [{ json: {} }];
  // ---- the tables ----
  const lad = (o) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', ladder_id: 'lad_D', domain: D, head_keyword: 'e invoicing uae', rung: 1, page_no: 1, keyword: '', supporting: '', page_type: 'Guide', target_url: '', page_exists: false, status: 'planned', months: '1-3', start_date: daysAgo(20), country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: '', request_id: 'lad-req', ...o } });
  const LADDERS = [
    lad({ page_no: 1, keyword: 'e invoicing uae fta', target_url: B + '/e-invoicing-uae-fta/', status: 'writing' }),                       // live as www + /blog/ folder + no trailing slash
    lad({ page_no: 2, keyword: 'e invoicing uae penalties', target_url: B + '/e-invoicing-uae-penalties/', status: 'writing' }),         // not live: a similar page (FTA rules) must not be taken for it
    lad({ page_no: 3, keyword: 'peppol uae', target_url: W + '/peppol-uae/', status: 'published', page_exists: true }),                // another page's URL: never claimed
    lad({ rung: 2, page_no: 4, keyword: 'erp for distributors', target_url: W + '/erp-for-distributors/', status: 'writing', page_exists: true }),   // improves an existing page
    lad({ rung: 4, page_no: 5, keyword: 'e invoicing uae', target_url: B + '/e-invoicing-uae/', status: 'planned' }),                    // planned only: not a candidate
    lad({ page_no: 6, keyword: 'uae e invoicing requirements', target_url: B + '/uae-e-invoicing-requirements/', status: 'writing' }),    // whole path beats the /ar/ copy
    lad({ rung: 2, page_no: 7, keyword: 'wms implementation timeline dubai', target_url: B + '/wms-implementation-timeline-dubai/', status: 'writing' })   // competes for the WMS page and loses
  ];
  const lg = (o) => ({ json: { id: 1, createdAt: 'x', updatedAt: 'x', site_id: SITE, domain: D, keyword: '', source: 'trend', page_type: 'Guide', existing_page_url: '', rung: 0, ladder_id: '', request_id: 'cad_x', started_at: daysAgo(10), status: 'started', published_url: '', published_at: '', week: dayAgo(10), ...o } });
  const MODULES = ['finance', 'payroll', 'inventory', 'crm', 'hr', 'sales', 'purchase', 'assets', 'projects', 'quality', 'service', 'manufacturing'];
  const LOGS = [
    lg({ keyword: 'wms implementation dubai', request_id: 'cad_wms', started_at: daysAgo(9) }),
    lg({ keyword: 'erp for distributors', source: 'ladder', rung: 2, ladder_id: 'lad_D', existing_page_url: W + '/erp-for-distributors/', request_id: 'cad_dist', started_at: daysAgo(12) }),
    lg({ keyword: 'erp cost dubai', source: 'striking', page_type: 'Service Page', existing_page_url: W + '/erp-pricing/', request_id: 'cad_cost', started_at: daysAgo(15) }),
    lg({ keyword: 'erp implementation checklist', request_id: 'cad_chk', started_at: daysAgo(8) }),
    lg({ keyword: 'peppol uae guide', request_id: 'cad_pep', started_at: daysAgo(5) }),
    lg({ keyword: 'ifrs 17 case study', source: 'case_study', page_type: 'Case Study', request_id: 'cs_1', started_at: daysAgo(6) }),
    lg({ keyword: 'old topic uae', request_id: 'cad_old', started_at: daysAgo(150) }),
    lg({ keyword: 'sap vs oracle uae', status: 'published', published_url: W + '/blog/sap-vs-oracle/', published_at: daysAgo(30), request_id: 'cad_sap', started_at: daysAgo(40) }),
    ...MODULES.map((m, i) => lg({ site_id: SITE2, domain: D2, keyword: 'erp module ' + m + ' dubai', request_id: 'acme_' + i, started_at: daysAgo(2 + i) })),
    lg({ site_id: SITE3, domain: D3, keyword: 'gamma cloud backup', request_id: 'gam_1', started_at: daysAgo(4) })
  ];
  mock('Load Sites', [...T.sitesRows(), T.sitesRows({ id: 2, site_id: SITE2, domain: D2, keywords: '' })[0], T.sitesRows({ id: 3, site_id: SITE3, domain: D3, keywords: '' })[0]]);
  mock('Load Ladders', LADDERS); mock('Load Rank History', EMPTY); mock('Load Site Metrics', EMPTY); mock('Load Query History', EMPTY); mock('Load Content Log', LOGS); mock('Load Console Alerts', EMPTY); mock('Load Check-ins', EMPTY);
  const plan = await run('Site Plan', EMPTY);
  check('three sites planned', plan.length === 3, plan.map(p => p.json.domain).join(','));
  // ---- 1. candidates ----
  const pc = await run('Publish Candidates', plan);
  const c1 = pc.find(x => x.json.domain === D).json, c2 = pc.find(x => x.json.domain === D2).json;
  const ck = (c) => c.candidates.map(x => x.keyword).sort();
  check('candidates: started log rows (120 days) + writing ladder rows, one per keyword; published, planned and old rows left out',
    eq(ck(c1), ['e invoicing uae fta', 'e invoicing uae penalties', 'erp cost dubai', 'erp for distributors', 'erp implementation checklist', 'ifrs 17 case study', 'peppol uae guide', 'uae e invoicing requirements', 'wms implementation dubai', 'wms implementation timeline dubai'].sort()), JSON.stringify(ck(c1)));
  const dist = c1.candidates.find(x => x.keyword === 'erp for distributors');
  check('a log row with a ladder: source content_log, both rows attached, existing URL kept', dist.source === 'content_log' && dist.ladder && dist.ladder.ladder_id === 'lad_D' && dist.existing_url === W + '/erp-for-distributors/' && dist.ladder_id === 'lad_D', JSON.stringify(dist).slice(0, 300));
  const fta = c1.candidates.find(x => x.keyword === 'e invoicing uae fta');
  check('a writing ladder row: source ladder, planned URL, written at the ladder start', fta.source === 'ladder' && fta.planned_url === B + '/e-invoicing-uae-fta/' && !fta.existing_url && fta.written_at === LADDERS[0].json.start_date && !fta.log, JSON.stringify(fta).slice(0, 300));
  check('known URLs: published pages, existing pages (another page\'s URL is never claimed)', ['/peppol-uae/', '/blog/sap-vs-oracle/', '/erp-pricing/', '/erp-for-distributors/'].every(p => c1.known.some(u => pathOf(u) === p)), JSON.stringify(c1.known));
  check('sitemap URL per site', c1.sitemap_url === B + '/sitemap.xml' && c2.sitemap_url === 'https://' + D2 + '/sitemap.xml' && c2.candidates.length === 12, c1.sitemap_url + ' ' + c2.candidates.length);
  // ---- 2. the sitemaps: northwind = index, acme = urlset, gamma = 404 ----
  const IDX = X.index([[W + '/category-sitemap.xml', dayAgo(0)], [W + '/post-sitemap.xml', dayAgo(1)], [W + '/post_tag-sitemap.xml', dayAgo(2)], [W + '/author-sitemap.xml', dayAgo(3)], [W + '/video-sitemap.xml', dayAgo(4)], [W + '/page-sitemap.xml', dayAgo(5)], [W + '/post-sitemap2.xml', dayAgo(40)], [W + '/news-sitemap.xml', '']]);
  const ACME = X.urlset([['https://' + D2 + '/', dayAgo(1)], ['https://' + D2 + '/about/', dayAgo(200)], ...MODULES.flatMap(m => [1, 2, 3].map(k => ['https://www.' + D2 + '/erp-module-' + m + '-dubai-part-' + k + '/', dayAgo(1)]))]);
  mock('Fetch Sitemap (Detect)', pc.map(x => x.json.domain === D ? IDX : x.json.domain === D2 ? ACME : X.missing()));
  const kids = await run('Sitemap Children (Detect)', store['Fetch Sitemap (Detect)']);
  const kidNames = kids.map(k => k.json.url.split('/').pop());
  check('sitemap index: 5 children, newest first, tag / category / author / video sitemaps last', eq(kidNames, ['post-sitemap.xml', 'page-sitemap.xml', 'post-sitemap2.xml', 'news-sitemap.xml', 'category-sitemap.xml']) && kids.every(k => k.json.site_id === SITE && k.json.total_children === 8), JSON.stringify(kidNames));
  const POSTS = X.urlset([[W + '/blog/e-invoicing-uae-fta', dayAgo(2)], [W + '/uae-e-invoicing-fta-rules/', dayAgo(2)], [W + '/blog/wms-implementation-guide-dubai/', dayAgo(4)], [B + '/blog/wms-implementation-guide-dubai/?ref=feed', dayAgo(4)],
    [W + '/blog/erp-implementation-checklist/', dayAgo(100)], [W + '/case-studies/ifrs-17-case-study/', dayAgo(1), { cdata: true }], [W + '/blog/sap-vs-oracle/', dayAgo(30)], ['https://cdn.other.example/e-invoicing-uae-penalties/', dayAgo(1)]]);
  const PAGES = X.urlset([[W + '/', dayAgo(1)], [W + '/erp-for-distributors/', dayAgo(3)], [W + '/erp-pricing/', dayAgo(60)], [W + '/peppol-uae/', dayAgo(2)], [W + '/uae-e-invoicing-requirements', dayAgo(2)], [W + '/ar/uae-e-invoicing-requirements/', dayAgo(2)]]);
  mock('Fetch Child Sitemaps (Detect)', kids.map(k => /post-sitemap\.xml$/.test(k.json.url) ? POSTS : /page-sitemap/.test(k.json.url) ? PAGES : /post-sitemap2/.test(k.json.url) ? X.missing() : /category/.test(k.json.url) ? X.urlset([[W + '/category/e-invoicing/', dayAgo(0)]]) : X.urlset([])));
  // ---- 3. slug matches and the pages to read ----
  const msl = await run('Match Slugs (Detect)', store['Fetch Child Sitemaps (Detect)']);
  const S = msl[0].json.sites; const s1 = S.find(s => s.site_id === SITE), s2 = S.find(s => s.site_id === SITE2), s3 = S.find(s => s.site_id === SITE3);
  const slugOf1 = Object.fromEntries(s1.slug_matches.map(p => [s1.candidates.find(c => c.key === p.key).keyword, pathOf(p.url)]));
  check('sitemap read across the index (a 404 child tolerated), other hosts and duplicates (http / bare / ?query) dropped', s1.sitemap.ok && s1.sitemap.index && s1.sitemap.files_read === 4 && s1.sitemap.urls === 13, JSON.stringify(s1.sitemap));
  check('slug: planned slug found in a folder on the www host without the trailing slash', slugOf1['e invoicing uae fta'] === '/blog/e-invoicing-uae-fta', JSON.stringify(slugOf1));
  check('slug: the planned path (root) beats the /ar/ copy; one URL per page', slugOf1['uae e invoicing requirements'] === '/uae-e-invoicing-requirements', JSON.stringify(slugOf1));
  check('slug: the keyword slug (case study, CDATA loc)', slugOf1['ifrs 17 case study'] === '/case-studies/ifrs-17-case-study/', JSON.stringify(slugOf1));
  check('existing page: matched when its lastmod is after the page was written; an unchanged one is not', slugOf1['erp for distributors'] === '/erp-for-distributors/' && s1.slug_matches.find(p => /distributors/.test(p.url)).updated === true && !slugOf1['erp cost dubai'] && /not changed/.test(s1.notes['erp cost dubai']), JSON.stringify(s1.notes));
  check('an old URL (lastmod 100 days, before the page was written) is never taken, even with the same slug', !slugOf1['erp implementation checklist'], JSON.stringify(slugOf1));
  const f1 = s1.fetches.map(pathOf).sort();
  check('title check reads only slug-similar pages: WMS guide, FTA rules, the /ar/ copy (not the known /peppol-uae/, the old checklist or claimed URLs)', eq(f1, ['/ar/uae-e-invoicing-requirements/', '/blog/wms-implementation-guide-dubai/', '/uae-e-invoicing-fta-rules/']), JSON.stringify(f1));
  check('15-fetch cap per site (12 pages of one family: 10 title-checked, round robin)', s2.fetches.length === 15 && new Set(s2.fetches).size === 15 && s2.title_checks.length === 10 && s2.slug_matches.length === 0, s2.fetches.length + ' / ' + s2.title_checks.length);
  check('round robin: each of the 10 newest pages gets its own best page read first', MODULES.slice(0, 10).every(m => s2.fetches.includes('https://www.' + D2 + '/erp-module-' + m + '-dubai-part-1/')), JSON.stringify(s2.fetches.map(pathOf)));
  check('a site whose sitemap is missing: nothing read, nothing fetched, error kept', !s3.sitemap.ok && /HTTP 404/.test(s3.sitemap.error) && s3.fetches.length === 0, JSON.stringify(s3.sitemap));
  check('fetch items: one per page, the state rides on the first item', msl.length === 18 && msl.every(x => x.json.fetch && x.json.url) && !!msl[0].json.sites && !msl[1].json.sites, msl.length);
  // ---- 4. title check, assignment, rows ----
  const titleFor = (u) => { const p = pathOf(u);
    if (/wms-implementation-guide-dubai/.test(p)) return X.page('WMS implementation in Dubai: cost and timeline | Northwind ERP', 'WMS implementation in Dubai');
    if (/fta-rules/.test(p)) return X.page('UAE e-invoicing: FTA rules explained', 'UAE e-invoicing: FTA rules explained');
    if (/\/ar\//.test(p)) return X.page('متطلبات الفوترة الإلكترونية في الإمارات', 'متطلبات الفوترة الإلكترونية');
    const m = p.match(/erp-module-([a-z]+)-dubai-part-(\d)/); if (m) return X.page('ERP module ' + m[1] + ' in Dubai &#8211; part ' + m[2], '');
    return X.missing(); };
  mock('Fetch Pages (Detect)', msl.map(x => titleFor(x.json.url)));
  const dp = await run('Detect Published', store['Fetch Pages (Detect)']);
  const d1 = dp.find(x => x.json.site_id === SITE).json, d2 = dp.find(x => x.json.site_id === SITE2).json, d3 = dp.find(x => x.json.site_id === SITE3).json;
  const by = Object.fromEntries(d1.detected.map(f => [f.keyword, f]));
  check('detected on northwind: 5 pages (4 by slug, 1 by title)', d1.detected.length === 5 && d1.detected.filter(f => f.matched_by === 'slug').length === 4 && by['wms implementation dubai'] && by['wms implementation dubai'].matched_by === 'title' && pathOf(by['wms implementation dubai'].url) === '/blog/wms-implementation-guide-dubai/', JSON.stringify(d1.detected));
  check('no false match: "e invoicing uae penalties" is not the FTA rules page (2 of 3 words in the title)', !by['e invoicing uae penalties'] && d1.unmatched.some(u => u.keyword === 'e invoicing uae penalties'), JSON.stringify(d1.unmatched));
  check('one candidate per URL: the WMS page goes to the better match, "wms implementation timeline dubai" stays waiting', !by['wms implementation timeline dubai'] && new Set(d1.detected.map(f => f.url)).size === d1.detected.length, JSON.stringify(d1.detected.map(f => f.keyword)));
  check('detected_published items: keyword, url, ladder_id, matched_by, source', d1.detected.every(f => keysAre(f, ['keyword', 'url', 'ladder_id', 'matched_by', 'source'])) && by['e invoicing uae fta'].source === 'ladder' && by['e invoicing uae fta'].ladder_id === 'lad_D' && by['wms implementation dubai'].source === 'content_log' && by['wms implementation dubai'].ladder_id === '' && by['erp for distributors'].ladder_id === 'lad_D', JSON.stringify(by));
  check('acme: 10 pages found by title, each on its own page (an entity like &#8211; in the title is harmless)', d2.detected.length === 10 && d2.detected.every(f => f.matched_by === 'title' && f.url.includes('-' + f.keyword.split(' ')[2] + '-dubai-part-1/')) && d2.unmatched.length === 2, JSON.stringify(d2.detected.map(f => f.keyword + ' ' + pathOf(f.url))));
  check('gamma (no sitemap): nothing detected, the page keeps waiting', d3.detected.length === 0 && d3.unmatched.length === 1 && d3.pages_fetched === 0, JSON.stringify(d3));
  const lr = await run('Detected Log Rows', dp); const LR = lr.map(x => x.json);
  check('content-log rows: one per page found, exactly the table columns', LR.length === 15 && LR.every(r => keysAre(r, LCOLS) && r.status === 'published' && /^https?:\/\//.test(r.published_url) && r.published_at && r.week === new Date().toISOString().slice(0, 10)), LR.length + ' ' + JSON.stringify(LR[0]));
  const rw = LR.find(r => r.keyword === 'wms implementation dubai'), rf = LR.find(r => r.keyword === 'e invoicing uae fta'), rd = LR.find(r => r.keyword === 'erp for distributors');
  check('the written row is kept (source, request id, start date, site id) and gets the live URL', rw.source === 'trend' && rw.request_id === 'cad_wms' && rw.started_at === LOGS[0].json.started_at && rw.site_id === SITE && rw.published_url === W + '/blog/wms-implementation-guide-dubai/' && rd.existing_page_url === W + '/erp-for-distributors/' && rd.ladder_id === 'lad_D', JSON.stringify([rw, rd]));
  check('a ladder page without a log row gets a new row (source ladder, rung, ladder id)', rf.source === 'ladder' && rf.rung === 1 && rf.ladder_id === 'lad_D' && rf.page_type === 'Guide' && rf.request_id === '' && rf.published_url === W + '/blog/e-invoicing-uae-fta', JSON.stringify(rf));
  // the same rows as "I published a page" (one shared builder): Publish Check for the same page
  mock('Normalize Input', { mode: 'published', domain: D, keyword: 'e invoicing uae fta', published_url: W + '/blog/e-invoicing-uae-fta', content_request_id: '', via_webhook: true });
  mock('Fetch Published Page', T.publishedPage(W + '/blog/e-invoicing-uae-fta', 'e invoicing uae fta')); mock('Load Content Log (Published)', LOGS); mock('Load Ladders (Published)', LADDERS); mock('Load Query History (Published)', EMPTY);
  const pck = await run('Publish Check', EMPTY); const strip = (r) => { const { started_at, published_at, ...rest } = r; return rest; };
  check('identical to the row "I published a page" writes (timestamps aside), ladder row too', eq(strip(pck[0].json.log_row), strip(rf)) && eq(pck[0].json.ladder_row, d1.ladder_rows.find(r => r.keyword === 'e invoicing uae fta')), JSON.stringify([strip(pck[0].json.log_row), strip(rf)]));
  const cr = await run('Detected Case Rows', lr);
  check('case study found live -> its proof row (site_id, keyword, page_url)', cr.length === 1 && eq(cr[0].json, { site_id: SITE, keyword: 'ifrs 17 case study', page_url: W + '/case-studies/ifrs-17-case-study/' }), JSON.stringify(cr.map(x => x.json)));
  const lrr = await run('Detected Ladder Rows', cr); const LRR = lrr.map(x => x.json);
  check('ladder rows: the 3 ladder pages found (fta, requirements, distributors), status published + live URL + page_exists', LRR.length === 3 && LRR.every(r => keysAre(r, ['ladder_id', 'keyword', 'status', 'target_url', 'page_exists']) && r.status === 'published' && r.page_exists === true && r.ladder_id === 'lad_D') && eq(LRR.map(r => r.keyword).sort(), ['e invoicing uae fta', 'erp for distributors', 'uae e invoicing requirements']), JSON.stringify(LRR));
  // ---- 5. no candidates -> no requests ----
  const savedLogs = store['Load Content Log'], savedLad = store['Load Ladders'];
  mock('Load Content Log', LOGS.filter(l => l.json.status === 'published')); mock('Load Ladders', LADDERS.map(l => ({ json: { ...l.json, status: l.json.status === 'writing' ? 'planned' : l.json.status } })));
  const pc0 = await run('Publish Candidates', plan);
  check('nothing written and waiting -> one skip item, no sitemap request', pc0.length === 1 && pc0[0].json.skip === true && !pc0[0].json.sitemap_url, JSON.stringify(pc0[0].json));
  store['Load Content Log'] = savedLogs; store['Load Ladders'] = savedLad; await run('Publish Candidates', plan);
  // ---- 6. the rest of the run: inspection of the pages found, metrics, report, callback ----
  mock('GSC Sites', T.gscSites()); const rp = await run('Resolve Properties', store['GSC Sites']);
  const ir = await run('Inspect Requests', rp); const inspected = ir.filter(x => x.json.site_id === SITE).map(x => pathOf(x.json.inspect_url));
  check('the pages found this week are inspected in the same run (Search Console)', ['/blog/e-invoicing-uae-fta', '/uae-e-invoicing-requirements', '/blog/wms-implementation-guide-dubai/', '/case-studies/ifrs-17-case-study/', '/erp-for-distributors/'].every(p => inspected.includes(p)), JSON.stringify(inspected));
  mock('Inspect URL', ir.map(r => T.inspection(r.json))); await run('Parse Inspection', store['Inspect URL']);
  const sm = await run('Site Metrics', store['Parse Inspection']); const m1 = sm.find(x => x.json.site_id === SITE).json, m3 = sm.find(x => x.json.site_id === SITE3).json;
  check('metrics: detected_published + publish_detection', m1.detected_published.length === 5 && m1.publish_detection.checked && m1.publish_detection.found === 5 && m1.publish_detection.recorded === true && m1.publish_detection.sitemap_urls === 13 && m1.publish_detection.pages_fetched === 3, JSON.stringify(m1.publish_detection));
  const lp = m1.ladder_pages.find(p => p.keyword === 'e invoicing uae fta');
  check('the ladder page now shows the live URL, published, with its index status', lp && lp.url === W + '/blog/e-invoicing-uae-fta' && lp.status === 'published' && lp.detected && lp.inspected && lp.indexed === true, JSON.stringify(lp));
  check('content-log pages found are listed too; the waiting list keeps only the pages not found', m1.ladder_pages.some(p => p.detected && p.url === W + '/blog/wms-implementation-guide-dubai/') && !m1.pending_publish.some(p => ['wms implementation dubai', 'ifrs 17 case study', 'erp for distributors'].includes(p.keyword)) && m1.pending_publish.some(p => p.keyword === 'peppol uae guide'), JSON.stringify(m1.pending_publish.map(p => p.keyword)));
  check('a page found this week but not indexed yet is an info note, not a high alert; no "publish" action for it', !m1.alerts.some(a => a.level === 'high' && /uae-e-invoicing-requirements/.test(a.text)) && m1.alerts.some(a => a.level === 'info' && /found live this week/.test(a.text)) && !m1.actions.some(a => a.type === 'publish' && a.keyword === 'e invoicing uae fta'), JSON.stringify(m1.alerts.map(a => a.level + ':' + a.text.slice(0, 60))));
  check('gamma: detection ran, sitemap missing -> info alert, nothing found', m3.publish_detection.checked && !m3.publish_detection.sitemap_ok && m3.detected_published.length === 0 && m3.alerts.some(a => a.level === 'info' && /could not read the sitemap/.test(a.text)), JSON.stringify(m3.publish_detection));
  const bi = await run('Brief Input', sm); const facts1 = JSON.parse(bi.find(x => x.json.site_id === SITE).json.facts);
  check('brief facts list the pages found live', (facts1.pages_found_live_this_week || []).length === 5, JSON.stringify(facts1.pages_found_live_this_week));
  mock('Site Brief', sm.map(() => ({ json: { error: 'model failed' } })));
  const rep = await run('Site Report', bi); const r1 = rep.find(x => x.json.site_id === SITE).json, r3 = rep.find(x => x.json.site_id === SITE3).json;
  check('report: "We found these pages live on your site" with every URL, tracking has started; subject counts them', /We found these pages live on your site/.test(r1.html) && /tracking has started/.test(r1.html) && m1.detected_published.every(f => r1.html.includes(f.url)) && /5 pages found live/.test(r1.subject) && /found live this week/.test(r1.html), r1.subject);
  check('report: no section when nothing was found', !/We found these pages live/.test(r3.html) && !/found live/.test(r3.subject), r3.subject);
  save('site-tracker-email-detected.html', r1.html); scanHtml('site tracker email (pages found live)', r1.html);
  const cbIn = rep.filter(x => x.json.site_id === SITE).map(x => ({ json: x.json, binary: x.binary }));
  const cb = await run('Build Site Callback', cbIn); const C = cb[0].json;
  check('callback (stage site_tracker): detected_published with the 5 pages, every earlier field kept', C.stage === 'site_tracker' && C.detected_published.length === 5 && C.detected_published.every(f => keysAre(f, ['keyword', 'url', 'ladder_id', 'matched_by', 'source'])) && C.publish_detection.found === 5 &&
    ['site_id', 'domain', 'gsc', 'ga4', 'tracked', 'ladder_pages', 'pending_publish', 'alerts', 'actions', 'console', 'trends', 'subject', 'brief', 'status'].every(k => k in C) && !('html' in C) && !('query_rows' in C), Object.keys(C).join(','));
  console.log('   callback sample ->', JSON.stringify(C.detected_published.slice(0, 2)), JSON.stringify(C.publish_detection));
  // ---- 7. storing failed (onError node output read) / detection failed / no detection at all ----
  mock('Save Detected (Log)', [{ json: { error: { message: 'Data table with name "seo_content_log" not found' } } }]);
  let smE = await run('Site Metrics', store['Parse Inspection']); let mE = smE.find(x => x.json.site_id === SITE).json;
  check('a failed write is reported (alert + recorded false), the report still runs', mE.publish_detection.recorded === false && /seo_content_log/.test(mE.publish_detection.error) && mE.alerts.some(a => a.level === 'medium' && /could not be recorded/.test(a.text)), JSON.stringify(mE.publish_detection));
  delete store['Save Detected (Log)'];
  const savedDP = store['Detect Published']; mock('Detect Published', [{ json: { error: 'TypeError: x is not iterable' } }]);
  smE = await run('Site Metrics', store['Parse Inspection']); mE = smE.find(x => x.json.site_id === SITE).json;
  check('a failed detection step never stops the report: info alert, nothing marked', mE.detected_published.length === 0 && /detection failed/.test(mE.publish_detection.reason) && mE.alerts.some(a => a.level === 'info' && /Publish detection failed/.test(a.text)), JSON.stringify(mE.publish_detection));
  const irE = await run('Inspect Requests', rp); check('inspection without detection output still works', irE.length > 0 && !irE.some(x => /wms-implementation-guide/.test(x.json.inspect_url || '')), irE.length);
  for (const k of ['Publish Candidates', 'Sitemap Children (Detect)', 'Match Slugs (Detect)', 'Detect Published', 'Fetch Pages (Detect)', 'Fetch Sitemap (Detect)', 'Fetch Child Sitemaps (Detect)']) delete store[k];
  const smN = await run('Site Metrics', store['Parse Inspection']); const mN = smN.find(x => x.json.site_id === SITE).json;
  check('no detection in the run: empty list, not checked, pages and waiting list as before', mN.detected_published.length === 0 && mN.publish_detection.checked === false && mN.pending_publish.some(p => p.keyword === 'wms implementation dubai') && mN.ladder_pages.find(p => p.keyword === 'e invoicing uae fta').status === 'writing', JSON.stringify(mN.publish_detection));
  if (savedDP) store['Detect Published'] = savedDP;
});

H.report();
})();
