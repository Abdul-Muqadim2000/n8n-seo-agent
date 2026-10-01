const H = require('./harness');
const F = require('./fixtures');
const { run, mock, begin, expectError, save, scanHtml, store } = H;
const decode = (items) => Buffer.from(items[0].binary.data.data, 'base64').toString('utf8');
const guard = (name, fn) => { try { fn(); } catch (e) { console.log(`   !! scenario "${name}" aborted at: ${(e.message || e).split('\n')[0]}`); } };
const reset = () => { for (const k of Object.keys(store)) delete store[k]; };

// ===================================================================================
guard('validation', () => {
  begin('S0 Normalize Input — validation & webhook parsing');
  mock('Start Form', F.forms.startKeyword);
  const v1 = run('Normalize Input', F.forms.badCountry); console.log('   bad country ->', JSON.stringify(v1[0].json.validation_error), '| via_webhook', v1[0].json.via_webhook);
  mock('Start Form', F.forms.startAudit);
  const v2 = run('Normalize Input', F.forms.badDomain); console.log('   bad domain ->', JSON.stringify(v2[0].json.validation_error));
  mock('Start Form', F.forms.startDescribe);
  const v3 = run('Normalize Input', F.forms.localhostDomain); console.log('   internal host ->', JSON.stringify(v3[0].json.validation_error));
  const v4 = run('Rate Limit', v3); console.log('   rate limit passthrough keeps error ->', !!v4[0].json.validation_error);
  // webhook verdict (no Start Form)
  reset();
  const wv = run('Normalize Input', F.forms.webhookVerdict);
  console.log('   webhook verdict ->', JSON.stringify({ mode: wv[0].json.mode, verdict_only: wv[0].json.verdict_only, country: wv[0].json.country, location_code: wv[0].json.location_code, via_webhook: wv[0].json.via_webhook, callback_url: wv[0].json.callback_url, include_content: wv[0].json.include_content, need_site_description: wv[0].json.need_site_description }));
  const wk = run('Normalize Input', F.forms.webhookKeywordDefault);
  console.log('   webhook default ->', JSON.stringify({ mode: wk[0].json.mode, include_content: wk[0].json.include_content, include_seo_report: wk[0].json.include_seo_report, page_type: wk[0].json.page_type, run_page_check: wk[0].json.run_page_check }));
  // rate limit
  H.staticData.rate = undefined;
  for (let i = 0; i < 6; i++) run('Rate Limit', wk);
  const rl7 = run('Rate Limit', wk); console.log('   7th run ->', JSON.stringify(rl7[0].json.validation_error));
  const wnc = run('Normalize Input', { body: { keyword: 'x', country: 'US' } }); console.log('   API without callback/email ->', JSON.stringify(wnc[0].json.validation_error));
});

// ===================================================================================
guard('keyword', () => {
  reset(); begin('S1 Keyword mode (form) — full content pipeline');
  mock('Start Form', F.forms.startKeyword);
  const n = run('Normalize Input', F.forms.pageKeyword);
  console.log('   normalized ->', JSON.stringify({ keyword: n[0].json.keyword, domain: n[0].json.domain, email: n[0].json.email, include_content: n[0].json.include_content, include_seo_report: n[0].json.include_seo_report, run_page_check: n[0].json.run_page_check, need_site_description: n[0].json.need_site_description, language_code: n[0].json.language_code }));
  run('Rate Limit');
  const nro = run('Normalize Input', F.forms.pageKeywordReportOnly); console.log('   report-only request -> include_content', nro[0].json.include_content, '| include_seo_report', nro[0].json.include_seo_report);
  store['Normalize Input'] = n;
  mock('Read Website', { site_text: F.jinaSite });
  const cs = run('Clean Site Text', store['Read Website']);
  console.log('   clean site ->', JSON.stringify({ page_title: cs[0].json.page_title, read_ok: cs[0].json.read_ok, len: cs[0].json.site_text.length }));
  mock('Site Describer', { output: { business_name: 'Northwind ERP', one_line_summary: 'ERP partner for distributors', business_description: 'Northwind ERP implements and customises Odoo and Dynamics 365 for distributors in the UAE.', industry: 'IT services', products_or_services: ['ERP implementation', 'Data migration'], target_audience: ['Distributors', 'Wholesalers'], unique_selling_points: ['Bilingual consultants'], location_served: 'UAE', tone_of_brand: 'Professional', suggested_meta_title: 'Northwind ERP | ERP Implementation Dubai', suggested_meta_description: 'ERP implementation for UAE distributors. Book a call.', seed_keywords: ['erp implementation dubai', 'odoo partner uae', 'erp for distributors', 'northwind erp'] } });
  run('Parse Description', store['Site Describer']);
  mock('Route Mode', store['Parse Description']);
  run('Prepare Keyword Run', store['Route Mode']);
  mock('Fetch Sitemap Index', { statusCode: 200, headers: {}, sitemap_xml: F.sitemapIndex });
  const sm = run('Parse Sitemap Index', store['Fetch Sitemap Index']);
  console.log('   sitemaps to read ->', sm.map(i => i.json.url).join(' , '));
  mock('Fetch Sitemaps', sm.map((s, i) => ({ statusCode: i === 2 ? 404 : 200, headers: {}, sitemap_xml: i === 0 ? F.urlset(F.siteUrls.slice(0, 11)) : (i === 1 ? F.urlset(F.siteUrls.slice(11)) : '') })));
  const cu = run('Collect Site URLs', store['Fetch Sitemaps']);
  console.log('   site urls ->', JSON.stringify({ count: cu[0].json.site_urls_count, existing_page: cu[0].json.existing_page, candidates: cu[0].json.internal_link_candidates.slice(0, 5).map(c => c.path) }));
  mock('SERP Top 10', F.serpTop);
  const top = run('Pick Top 6', store['SERP Top 10']);
  console.log('   picked ->', top.map(t => `#${t.json.rank} ${t.json.domain}`).join(', '), '| first url:', top[0].json.url);
  mock('Read Competitor Pages', top.map((t, i) => i === 2 ? { error: { message: 'Request failed with status code 522' } } : (i === 4 ? { page_text: F.jinaBlocked } : { page_text: F.compPage(i, 260 + i * 40) })));
  const cc = run('Clean Competitor Pages', store['Read Competitor Pages']);
  console.log('   competitors read ->', cc[0].json.competitors_read, '| failed:', JSON.stringify(cc[0].json.failed_pages), '| avg words:', cc[0].json.avg_competitor_words, '| features:', cc[0].json.serp_features.features_present.join(','), '| AIO cites:', cc[0].json.serp_features.ai_overview.cited_domains.join(','));
  console.log('   digest chars ->', cc[0].json.competitor_digest.length, '| headings[0]:', JSON.stringify(cc[0].json.competitors[0].headings.slice(0, 4)));
  mock('Competitor Analyzer', { output: F.competitorAnalysis });
  run('Parse Analysis', store['Competitor Analyzer']);
  mock('Keyword Data', F.keywordOverview);
  const mk = run('Merge Keyword Data', store['Keyword Data']);
  console.log('   keyword data ->', JSON.stringify(mk[0].json.keyword_data).slice(0, 220));
  mock('Verdict Agent', { output: F.verdictGo });
  const pv = run('Parse Verdict', store['Verdict Agent']);
  console.log('   verdict ->', pv[0].json.verdict, pv[0].json.verdict_score, '| include_content:', pv[0].json.include_content);
  mock('Strategy Brief', { output: F.brief });
  run('Parse Brief', store['Strategy Brief']);
  mock('Copywriter', { output: F.draft() });
  const qa1 = run('Content QA', store['Copywriter'], { runIndex: 0 });
  console.log('   QA round 1 ->', JSON.stringify({ passed: qa1[0].json.content_qa.passed, main_words: qa1[0].json.content_qa.main_content_words, faq: qa1[0].json.content_qa.faq_count, internal_links: qa1[0].json.content_qa.internal_links, external: qa1[0].json.content_qa.external_links, answer_words: qa1[0].json.content_qa.answer_block_words }));
  console.log('   QA fixes ->', JSON.stringify(qa1[0].json.content_qa.auto_fixes));
  console.log('   QA warnings ->', JSON.stringify(qa1[0].json.content_qa.warnings));
  console.log('   placeholder word still present?', /placeholder/i.test(qa1[0].json.output), '| AED price still present?', /AED\s?\d/.test(qa1[0].json.output), '| gartner link kept?', /gartner/.test(qa1[0].json.output), '| pricing link removed?', !/\/pricing\//.test(qa1[0].json.output));
  // Editor returns a corrected draft -> QA round 2
  mock('Editor', { output: F.draft({ longTitle: true }) });
  const qa2 = run('Content QA', store['Editor'], { runIndex: 1 });
  console.log('   QA round 2 ->', 'round', qa2[0].json.qa_round, '| passed', qa2[0].json.content_qa.passed, '| title len', qa2[0].json.content_qa.meta_title_length);
  const wf = run('Build Word File', qa2);
  const doc = decode(wf); save('keyword-report.doc.html', doc); scanHtml('keyword report+content', doc);
  console.log('   word file ->', wf[0].json.file_name, '| report_type:', wf[0].json.report_type, '| qa_summary:', wf[0].json.qa_summary);
  console.log('   JSON-LD blocks in doc:', (doc.match(/application\/ld\+json/g) || []).length, '| has FAQPage:', /FAQPage/.test(doc), '| has Service schema:', /"@type": "Service"/.test(doc));
  const prep = run('Prepare PDF Report', wf);
  console.log('   prepare pdf -> binaries', Object.keys(prep[0].binary).join(','), '| html name', prep[0].binary.html.fileName, '| ledger', JSON.stringify(wf[0].json.run_ledger));
  mock('Render PDF Report', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const att = run('Attach PDF Report', store['Render PDF Report']);
  console.log('   attach pdf ->', JSON.stringify({ pdf_ready: att[0].json.pdf_ready, pdf_file_name: att[0].json.pdf_file_name, binaries: Object.keys(att[0].binary) }));
  mock('Render PDF Report', [{ json: { error: { message: 'connect ECONNREFUSED gotenberg:3000' } } }]);
  const att2 = run('Attach PDF Report', store['Render PDF Report']);
  console.log('   attach pdf (renderer down) -> pdf_ready', att2[0].json.pdf_ready, '| binaries', Object.keys(att2[0].binary).join(','), '| error', att2[0].json.pdf_error);
  const wr = run('Build Webhook Response', att);
  console.log('   webhook response keys ->', Object.keys(wr[0].json).join(','), '| file bytes (b64):', wr[0].json.file && wr[0].json.file.data.length, '| pdf:', wr[0].json.pdf && wr[0].json.pdf.fileName);

  // Truncated copywriter output (max_tokens hit)
  begin('S1b Keyword — truncated Copywriter output (4096-token cap simulation)');
  mock('Copywriter', { output: F.draft({ truncate: true }) });
  const qat = run('Content QA', store['Copywriter'], { runIndex: 0 });
  console.log('   truncated QA ->', JSON.stringify({ passed: qat[0].json.content_qa.passed, main_words: qat[0].json.content_qa.main_content_words, faq: qat[0].json.content_qa.faq_count, warnings: qat[0].json.content_qa.warnings.length }));

  // AVOID verdict path -> Build Word File directly (no content)
  begin('S1c Keyword — AVOID verdict goes straight to report');
  mock('Verdict Agent', { output: F.verdictAvoid });
  const pva = run('Parse Verdict', store['Verdict Agent']);
  const wfa = run('Build Word File', pva);
  const doca = decode(wfa); save('keyword-avoid.doc.html', doca); scanHtml('avoid report', doca);
  console.log('   avoid ->', wfa[0].json.report_type, wfa[0].json.file_name, '| verdict in doc:', /AVOID/.test(doca));

  // No competitors in SERP
  begin('S1d Keyword — SERP returned nothing');
  mock('SERP Top 10', F.serpEmpty);
  const t0 = run('Pick Top 6', store['SERP Top 10']);
  console.log('   pick top 6 (empty) ->', JSON.stringify(t0[0].json));
  mock('Read Competitor Pages', [{ error: { message: 'Invalid URL' } }]);
  const cc0 = run('Clean Competitor Pages', store['Read Competitor Pages']);
  console.log('   clean (empty) -> competitors_read', cc0[0].json.competitors_read, '| avg', cc0[0].json.avg_competitor_words, '| digest empty?', !cc0[0].json.competitor_digest.trim());
  mock('Keyword Data', F.keywordOverviewEmpty);
  mock('Parse Analysis', { ...store['Clean Competitor Pages'][0].json, competitor_analysis: F.competitorAnalysis });
  const mk0 = run('Merge Keyword Data', store['Keyword Data']);
  console.log('   merged (empty kw data) ->', JSON.stringify(mk0[0].json.keyword_data));
});

// ===================================================================================
guard('verdict', () => {
  reset(); begin('S2 Verdict-only mode (form)');
  mock('Start Form', F.forms.startVerdict);
  const n = run('Normalize Input', F.forms.pageVerdict);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, verdict_only: n[0].json.verdict_only, include_seo_report: n[0].json.include_seo_report, include_content: n[0].json.include_content, need_site_description: n[0].json.need_site_description, domain: n[0].json.domain }));
  mock('Route Mode', n);
  run('Prepare Keyword Run', n);
  mock('Fetch Sitemaps', []);
  const cu = run('Collect Site URLs', []);
  console.log('   collect (no domain) ->', JSON.stringify({ sitemap_ok: cu[0].json.sitemap_ok, candidates: cu[0].json.internal_link_candidates.length, existing: cu[0].json.existing_page }));
});

// ===================================================================================
guard('describe', () => {
  reset(); begin('S3 Describe mode');
  mock('Start Form', F.forms.startDescribe);
  const n = run('Normalize Input', F.forms.pageDescribe);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, country: n[0].json.country, need_site_description: n[0].json.need_site_description }));
  run('Rate Limit');
  mock('Read Website', { error: { message: 'timeout of 30000ms exceeded' } });
  const cs = run('Clean Site Text', store['Read Website']);
  console.log('   read failed -> read_ok', cs[0].json.read_ok, '| site_text len', cs[0].json.site_text.length, '(Site Describer would still be called with empty text)');
  const fb = run('Describe Fallback', cs);
  console.log('   fallback ->', JSON.stringify({ failed: fb[0].json.site_read_failed, name: fb[0].json.site_description.business_name }));
  const bp = run('Build Description Page', fb);
  console.log('   warning shown on page?', /could not read/.test(bp[0].json.result_html));
  save('description-page.html', bp[0].json.result_html); scanHtml('description page', bp[0].json.result_html);
});

// ===================================================================================
guard('discover', () => {
  reset(); begin('S4 Discover mode -> keyword ideas -> chained content run');
  mock('Start Form', F.forms.startDiscover);
  const n = run('Normalize Input', F.forms.pageDiscover);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, include_content: n[0].json.include_content, include_seo_report: n[0].json.include_seo_report, include_audit: n[0].json.include_audit, audit_level: n[0].json.audit_level, need_site_description: n[0].json.need_site_description }));
  mock('Route Mode', n);
  mock('Keyword Seeds', { output: { seeds: ['erp implementation dubai', 'odoo implementation uae', 'erp for distributors', 'erp system price uae', 'best erp for wholesale', 'northwind erp reviews', 'erp', 'a very long seed phrase with seven words here'], services: ['ERP implementation'] } });
  const sl = run('Seed List', store['Keyword Seeds']);
  console.log('   seeds ->', JSON.stringify(sl[0].json.seeds));
  mock('Discover Ideas', F.keywordIdeas);
  const rc = run('Rank Candidates', store['Discover Ideas']);
  console.log('   candidates ->', rc.map(c => `${c.json.keyword} (score ${c.json.score}, ${c.json.intent})`).join(' | '));
  mock('Candidate SERP', rc.map(c => F.aiSerp({ type: 'category', query: c.json.keyword })));
  const ks = run('Build Keyword Suggestions', store['Candidate SERP']);
  console.log('   suggestions ->', JSON.stringify({ recommended: ks[0].json.keyword_suggestions.recommended.map(r => r.keyword + '@' + (r.your_position || '-')), easy: ks[0].json.keyword_suggestions.easy_wins.length, clusters: ks[0].json.keyword_suggestions.topic_clusters.map(c => c.topic + '(' + c.keyword_count + ')') }));
  save('keyword-ideas.html', ks[0].json.result_html); scanHtml('keyword ideas page', ks[0].json.result_html);
  const kf0 = run('Build Keyword File', ks);
  run('Prepare PDF Ideas', kf0); mock('Render PDF Ideas', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const kf = run('Attach PDF Ideas', store['Render PDF Ideas']);
  console.log('   ideas pdf ->', kf[0].json.pdf_file_name, '| ledger calls', kf[0].json.run_ledger.dataforseo_calls);
  const kdoc = decode(kf); save('keyword-ideas.doc.html', kdoc); scanHtml('keyword ideas doc', kdoc);
  console.log('   keyword file ->', kf[0].json.file_name, '| note present:', /will be emailed/.test(kdoc));
  const sfs = run('Seed From Suggestion', kf);
  console.log('   seed from suggestion ->', sfs[0].json.keyword, sfs[0].json.page_type, '|', sfs[0].json.chosen_keyword_reason);
  run('Prepare Keyword Run', sfs);
  // Pick Top 6 falls back to $('Route Mode') for domain in this chained path
  mock('SERP Top 10', F.serpTop);
  const top = run('Pick Top 6', store['SERP Top 10']);
  console.log('   chained pick top 6 -> own domain excluded?', !top.some(t => t.json.domain === F.OUR));
});

// ===================================================================================
guard('audit-full', () => {
  reset(); begin('S5 Audit mode — Full SEO Report');
  mock('Start Form', F.forms.startAudit);
  const n = run('Normalize Input', F.forms.pageAuditFull);
  console.log('   ->', JSON.stringify({ mode: n[0].json.mode, audit_level: n[0].json.audit_level, competitors: n[0].json.competitors, include_full_report: n[0].json.include_full_report, language_code: n[0].json.language_code }));
  mock('Route Mode', n);
  expectError('Save Task ID', F.crawlTaskPostFail, /Could not start site crawl/);
  run('Save Task ID', F.crawlTaskPost);
  const c1 = run('Check Crawl', F.summaryRunning, { runIndex: 0 });
  console.log('   crawl poll 1 ->', c1[0].json.crawl_finished, c1[0].json.crawl_progress, c1[0].json.pages_crawled);
  const c2 = run('Check Crawl', F.summaryDone, { runIndex: 3 });
  console.log('   crawl poll 2 ->', c2[0].json.crawl_finished, '| pages_crawled', c2[0].json.pages_crawled);
  expectError('Check Crawl', F.summaryRunning, /too long/, 26) || null;
  H.results[H.results.length - 1].node = 'Check Crawl (timeout guard)';
  store['Check Crawl'] = c2;
  mock('Get Crawled Pages', F.crawledPagesRes);
  const cer = run('Crawl Extra Requests', store['Get Crawled Pages']);
  console.log('   extra requests ->', cer.map(i => i.json.extra).join(','));
  mock('Run Crawl Extras', F.extrasRes);
  const cce = run('Collect Crawl Extras', store['Run Crawl Extras']);
  console.log('   extras ->', JSON.stringify({ dup_titles: cce[0].json.crawl_extras.duplicate_title.length, non_indexable: cce[0].json.crawl_extras.non_indexable.length, errors: cce[0].json.crawl_extras.errors }));
  const hostP = run('Build Probes', cce);
  const contP = run('Content Probes', cce);
  console.log('   probes ->', hostP.length, 'host +', contP.length, 'content');
  const all0 = F.probeResults('apex');
  mock('Run Probes', [all0[0], all0[2], all0[3], all0[4]]);
  mock('Run Content Probes', [all0[0], all0[1], all0[5], all0[6], all0[7], all0[8], ...all0.slice(9)]);
  const ap = run('Analyze Probes', store['Run Content Probes']);
  console.log('   probe findings ->', ap[0].json.probe.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  console.log('   probe works ->', ap[0].json.probe.what_works.join(' | '));
  console.log('   measurements ->', JSON.stringify(ap[0].json.probe.measurements));
  const pk = run('Pick Key Pages', ap);
  console.log('   key pages ->', pk.map(p => p.json.kind + ':' + p.json.url.replace('https://northwind-erp.com', '')).join(' '));
  mock('Fetch Page HTML', F.pageHtmlResults(pk.map(p => p.json)));
  const ah = run('Analyze HTML', store['Fetch Page HTML']);
  console.log('   html findings ->', ah[0].json.html_analysis.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  console.log('   html works ->', ah[0].json.html_analysis.works.join(' | '));
  const utc = run('URLs To Check', ah);
  console.log('   urls to check ->', utc.map(u => u.json.purpose + ' ' + u.json.url).join(' | '));
  mock('Check Schema URLs', F.headResults(utc.map(u => u.json)));
  const sf = run('Schema Findings', store['Check Schema URLs']);
  console.log('   schema url findings ->', sf[0].json.extra_findings.filter(f => /URL is broken/.test(f.title)).map(f => `[${f.severity}] ${f.title}`).join(' | '));
  mock('Find Competitors', F.labsCompetitors);
  const fq = run('Fallback Queries', store['Find Competitors']);
  console.log('   fallback queries ->', fq.map(q => q.json.query).join(' | '));
  mock('Fallback SERP', fq.map(q => F.aiSerp({ type: 'category', query: q.json.query })));
  const pc = run('Pick Competitors', store['Fallback SERP']);
  console.log('   competitors ->', pc.map(c => c.json.domain + (c.json.is_you ? '(you)' : '')).join(', '), '| method:', pc[1] && pc[1].json.method);
  mock('Domain Overview', pc.map(c => F.rankOverview(c.json.domain)));
  mock('DataForSEO Whois', pc.map(c => F.whois(c.json.domain)));
  mock('RDAP Lookup', pc.map(c => c.json.domain === 'gulferp.ae' ? { objectClassName: 'domain', events: [{ eventAction: 'registration', eventDate: '2015-06-01T00:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-06-01T00:00:00Z' }] } : { errorCode: 404, title: 'Not Found' }));
  const ca = run('Competitor Analysis', store['RDAP Lookup']);
  console.log('   benchmark rows ->', JSON.stringify(ca[0].json.competitor_benchmark.rows.map(r => ({ d: r.domain, kw: r.organic_keywords, top10: r.top10, age: r.domain_age_years }))));
  console.log('   benchmark findings ->', ca[0].json.extra_findings.filter(f => f.category === 'Authority').map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const kt = run('KW Targets', ca);
  mock('Ranked Keywords', kt.map(t => F.ranked(t.json.domain)));
  mock('Keyword Ideas', F.keywordIdeas);
  const ak = run('Analyze Keywords', store['Keyword Ideas']);
  console.log('   keywords ->', JSON.stringify({ domains: ak[0].json.site_keywords.domains.map(d => d.domain + ':' + d.total + '/' + d.top10), gap: ak[0].json.site_keywords.keyword_gap.length, easy: ak[0].json.site_keywords.easy_wins.length, striking: ak[0].json.site_keywords.striking_distance.map(k => k.keyword) }));
  run('BL Targets', ak);
  mock('Backlink Summary', store['BL Targets'].map(t => F.backlinkSummary(t.json.domain)));
  mock('Backlink Gap', F.backlinkGap);
  const ab = run('Analyze Backlinks', store['Backlink Gap']);
  console.log('   backlinks ->', JSON.stringify({ available: ab[0].json.authority.available, you: ab[0].json.authority.rows.find(r => r.is_you), gap: ab[0].json.authority.gap.map(g => g.referring_domain + 'x' + g.links_to_competitors) }));
  const ps = run('PS Targets', ab);
  mock('PageSpeed', ps.map(t => F.psi(t.json.domain)));
  const aps = run('Analyze PageSpeed', store['PageSpeed']);
  console.log('   pagespeed ->', JSON.stringify(aps[0].json.pagespeed.rows.map(r => ({ d: r.domain, score: r.score, lcp: r.field.lcp, avail: r.available }))));
  console.log('   perf findings ->', aps[0].json.extra_findings.filter(f => f.category === 'Performance').map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const ch = run('Competitor Homes', aps);
  mock('Read Competitor Homes', ch.map((c, i) => ({ page_text: F.compPage(i, 300) })));
  const bcp = run('Build Content Prompt', store['Read Competitor Homes']);
  console.log('   content prompt ->', JSON.stringify({ skip: bcp[0].json.content_skip, pages_read: bcp[0].json.content_pages_read, our_len: bcp[0].json.content_prompt_our.length, comp_len: bcp[0].json.content_prompt_comp.length }));
  mock('Content Reviewer', { output: F.contentReview });
  const pcr = run('Parse Content Review', store['Content Reviewer']);
  console.log('   content review findings ->', pcr[0].json.extra_findings.filter(f => f.source === 'ai_review').map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const aq = run('AI Queries', pcr);
  console.log('   ai queries ->', aq.map(q => q.json.type + ':"' + q.json.query + '"').join(' | '), '| brand:', aq[0].json.brand_name);
  mock('AI SERP', aq.map(q => F.aiSerp(q.json)));
  const lp = run('LLM Prompts', store['AI SERP']);
  console.log('   llm prompts ->', lp.map(p => p.json.platform + '/' + p.json.kind).join(', '), '| rec prompt:', lp[1].json.prompt.slice(0, 120));
  mock('Ask LLMs', F.llmAnswers(lp.map(p => p.json)));
  const av = run('AI Visibility', store['Ask LLMs']);
  console.log('   ai visibility ->', JSON.stringify({ brand: av[0].json.ai_visibility.brand_name, index_est: av[0].json.ai_visibility.index_estimate, llm: av[0].json.ai_visibility.llm_answers.map(l => l.platform + ':' + (l.ok ? (l.mentions_you ? 'mentions' : 'no-mention') : 'ERR')), queries: av[0].json.ai_visibility.queries.map(q => q.type + ':' + (q.ai_overview ? 'AIO' : '-') + ':' + q.your_position) }));
  console.log('   ai findings ->', av[0].json.extra_findings.filter(f => f.category === 'AI Search Readiness' || /indexed/.test(f.title)).map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const bsi = run('Build Site Issues', av);
  const a = bsi[0].json.site_audit;
  console.log('   findings by severity (scored only) ->', JSON.stringify(a.findings.filter(f => f.scoring !== false).reduce((m, f) => (m[f.severity] = (m[f.severity] || 0) + 1, m), {})));
  console.log('   SITE AUDIT ->', JSON.stringify({ score: a.health_score, raw: a.raw_score, cap: a.score_cap, grade: a.grade, counts: a.issue_counts, cats: a.category_scores, not_assessed: a.not_assessed }));
  console.log('   top findings ->', a.findings.slice(0, 12).map(f => `[${f.severity}/${f.category}] ${f.title}`).join('\n      '));
  console.log('   total findings', a.findings.length, '| what works', a.what_works.length, '| notes', JSON.stringify(a.notes));
  const bfr0 = run('Build Full Report', bsi);
  run('Prepare PDF Audit', bfr0); mock('Render PDF Audit', [{ json: {}, binary: { pdf: { data: 'JVBERi0xLjQK', mimeType: 'application/pdf', fileName: 'index.pdf' } } }]);
  const bfr = run('Attach PDF Audit', store['Render PDF Audit']);
  console.log('   full report ledger ->', JSON.stringify(bfr[0].json.run_ledger), '| pdf', bfr[0].json.pdf_file_name);
  const fdoc = decode(bfr); save('full-seo-report.doc.html', fdoc); scanHtml('full report', fdoc);
  console.log('   full report ->', bfr[0].json.file_name, '| subject data:', JSON.stringify({ score: bfr[0].json.health_score, grade: bfr[0].json.grade, top: bfr[0].json.top_issues.slice(0, 3) }));

  // apex -> www redirect variant (false positive check)
  begin('S5b Audit — site whose apex 301s to www');
  const allw = F.probeResults('www');
  mock('Run Probes', [allw[0], allw[2], allw[3], allw[4]]);
  mock('Run Content Probes', [allw[2], allw[2], allw[5], allw[6], allw[7], allw[8], ...allw.slice(9)]);
  const apw = run('Analyze Probes', store['Run Content Probes']);
  console.log('   canonical host ->', apw[0].json.canonical_host);
  console.log('   www-variant probe findings ->', apw[0].json.probe.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  console.log('   www-variant works ->', apw[0].json.probe.what_works.join(' | '));
});

// ===================================================================================
guard('audit-tech', () => {
  reset(); begin('S6 Audit mode — technical Site Audit only (Germany)');
  mock('Start Form', F.forms.startAudit);
  const n = run('Normalize Input', F.forms.pageAuditTech);
  console.log('   ->', JSON.stringify({ audit_level: n[0].json.audit_level, location_code: n[0].json.location_code, language_code: n[0].json.language_code, language_name: n[0].json.language_name }));
  mock('Route Mode', n);
  run('Save Task ID', F.crawlTaskPost);
  run('Check Crawl', F.summaryDone, { runIndex: 2 });
  mock('Get Crawled Pages', F.crawledPagesRes);
  run('Crawl Extra Requests', store['Get Crawled Pages']);
  mock('Run Crawl Extras', F.extrasRes);
  run('Collect Crawl Extras', store['Run Crawl Extras']);
  run('Build Probes'); run('Content Probes', store['Collect Crawl Extras']);
  const all6 = F.probeResults('apex');
  mock('Run Probes', [all6[0], all6[2], all6[3], all6[4]]);
  mock('Run Content Probes', [all6[0], all6[1], all6[5], all6[6], all6[7], all6[8], ...all6.slice(9)]);
  const ap = run('Analyze Probes', store['Run Content Probes']);
  const bsi = run('Build Site Issues', ap);
  const a = bsi[0].json.site_audit;
  console.log('   SITE AUDIT (tech) ->', JSON.stringify({ score: a.health_score, raw: a.raw_score, cap: a.score_cap, grade: a.grade, counts: a.issue_counts, cats: a.category_scores }));
  console.log('   findings ->', a.findings.map(f => `[${f.severity}] ${f.title}`).join(' | '));
  const bar = run('Build Audit Report', bsi);
  const adoc = decode(bar); save('site-audit-report.doc.html', adoc); scanHtml('site audit report', adoc);
  console.log('   audit report ->', bar[0].json.file_name);
});

H.report();
