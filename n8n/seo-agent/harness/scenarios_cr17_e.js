// CR17E1-CR17E5 (client report 2026-11-17, devaicon.com C4 + F9; build section 195). The rows are the production ones of 2026-11-17
// (seo_link_prospects 206 / 248 / 242, seo_backlinks 1358 / 1359, seo_link_outreach 239 / 292 / 238 / 302 / 319 / 325 / 316, seo_pages /
// seo_index_pages of devaicon.com); a developer's profile name is replaced by a placeholder, nothing else is changed.
//   CR17E1  the won rule (LK.wonCheck / LK.junkLink): a bebee job listing and a github profile are never won; nobody written to = never won;
//           contacted + our own reading of a clean page = won; a won link whose ledger row is lost = lost
//   CR17E2  Prospect Rows (Backlink Monitor): the three stored "won" rows heal (206 / 248 back to new, 242 low value), a real win is won
//   CR17E3  the outreach kit: the fit gate's government list (u.ae), platform / job board / competitor codes, one verdict per website,
//           our page by topic (the Open edX service page, never a silent homepage), real link text without the brand suffix
//   CR17E4  LB Assemble on the stored rows: abstract-technology.de leaves the queue (its other row is a competitor), u.ae is a government
//           site, linkedin a platform (not "a competitor"), a pitch aimed at a 301 address is re-aimed, a new "Open edX vs Moodle" page gets
//           the service page and "Open edX Services" as link text, a page nobody of ours covers is held; the queue and the left-out list
//           never name the same website; the signer is never the company twice
//   CR17E5  LB Plan: the whole inventory is a target, a redirect is followed to the page it lands on, utility pages are not targets
module.exports = async (ctx) => {
  const { H, run, mock, reset, begin, guard, store } = ctx;
  const fs = require('fs');
  const path = require('path');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const items = (a) => (a && a.length ? a.map(j => ({ json: j })) : [{ json: {} }]);
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  // the kits exactly as the build inlines them into LB Assemble (link kit, rivals, outreach kit)
  const kits = () => { const src = fs.readFileSync(path.join(CODE, 'LB_Assemble.js'), 'utf8'); const cut = src.indexOf('const CT = (() => {'); return new Function(src.slice(0, cut) + '; return { LK, RV, OK };')(); };
  const SID = 'site_devaicon-com', DOM = 'devaicon.com', D = 'https://devaicon.com';
  const NOW = '2026-11-17T12:00:00.000Z';
  const BEBEE = 'https://bebee.com/pk/jobs/machine-learning-engineer-devaicon--t7xk-896388669';
  const PROFILE = 'https://github.com/example-dev';   // seo_backlinks 1359 (a developer's own profile; name replaced)
  const L1358 = { site_id: SID, domain: DOM, ref_domain: 'bebee.com', kind: 'web', from_url: BEBEE, to_url: '', anchor: '', rel: '', link_type: '', sources: 'gsc', status: 'lost', verify: 'missing', verified_at: '2026-11-13T01:08:09.441Z', lost_reason: 'link_removed', page_title: '', noindex: false };
  const L1359 = { site_id: SID, domain: DOM, ref_domain: 'github.com', kind: 'web', from_url: PROFILE, to_url: D + '/', anchor: D + '/', rel: 'nofollow', link_type: '', sources: 'gsc', status: 'live', verify: 'found', verified_at: '2026-11-13T01:08:09.441Z', lost_reason: '', page_title: 'example-dev · GitHub', noindex: false };
  const P = (o) => ({ site_id: SID, domain: DOM, rank: 0, spam_score: 0, detail: '', source_url: '', target_url: '', status: 'new', first_seen: '2026-10-20T00:00:00.000Z', last_seen: '2026-11-06T01:08:08.812Z', won_at: '', outreach_subject: '', outreach_body: '', note: '', score: 0, origin: 'web', contact_email: '', contact_url: '', contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', drafted_at: '', ...o });
  const P206 = P({ prospect_domain: 'bebee.com', type: 'mention', status: 'won', won_at: '2026-11-06T01:08:08.812Z', source_url: BEBEE, score: 80, rank: 473 });
  const P248 = P({ prospect_domain: 'bebee.com', type: 'ai_source', status: 'won', won_at: '2026-11-06T01:08:08.812Z', source_url: 'https://bebee.com/pk/jobs/role/machine-learning-engineer', origin: 'ai_visibility' });
  const P242 = P({ prospect_domain: 'github.com', type: 'ai_source', status: 'won', won_at: '2026-11-06T01:08:08.812Z', verified_at: '2026-11-06T01:08:08.812Z', source_url: 'https://github.com/overhangio/tutor-indigo', origin: 'ai_visibility' });

  await guard('CR17E1 won rule', async () => {
    reset(); const SN = 'CR17E1 (2026-11-17) a won link = we wrote to them + our own check found it on a clean page; job listings, profiles and domain collisions are never won'; begin(SN); const check = mkCheck(SN);
    const { LK } = kits();
    check('a bebee listing is a job board (host) and a job page (path + title) elsewhere too', LK.isJobBoard(BEBEE, 'Machine Learning Engineer - DEVAICON | BeBee') && LK.isJobBoard('https://careers-site.example/jobs/ml-engineer', '145+ Machine Learning Engineer Jobs in Pakistan') && !LK.isJobBoard('https://blog.example/jobs-to-be-done', 'The jobs to be done framework'), '');
    check('a github page and a linkedin profile are profiles; an article is not', /code host/.test(LK.profilePage(PROFILE)) && /profile/.test(LK.profilePage('https://www.linkedin.com/in/someone')) && LK.profilePage('https://example-blog.com/2026/open-edx-guide') === '', J([LK.profilePage(PROFILE), LK.profilePage('https://www.linkedin.com/in/someone')]));
    const w206 = LK.wonCheck({ prospect: P206, rows: [L1358], site: DOM, now: NOW });
    check('bebee (206): a Search Console sample row, never read by us, no address of ours, nobody written to -> not won', !w206.won && w206.state !== 'won' && !w206.contacted, J(w206));
    const w242 = LK.wonCheck({ prospect: P242, rows: [L1359], site: DOM, now: NOW });
    check('github (242): the link is on a developer profile -> found, low value, never won', w242.state === 'low_value' && /code host/.test(w242.reason), J(w242));
    const clean = { site_id: SID, ref_domain: 'partner-blog.example', kind: 'web', from_url: 'https://partner-blog.example/open-edx-hosting-guide', to_url: D + '/capabilities/open-edx-services', rel: 'follow', link_type: 'editorial', status: 'live', verify: 'found', verified_at: '2026-11-15T00:00:00.000Z', page_title: 'Open edX hosting guide' };
    const pc = P({ prospect_domain: 'partner-blog.example', type: 'resource', status: 'contacted', contacted_at: '2026-11-03T09:00:00.000Z' });
    check('contacted + our check found it on a clean page -> won', LK.wonCheck({ prospect: pc, rows: [clean], site: DOM, now: NOW }).state === 'won', '');
    check('the same link, nobody written to -> already links to you (not a result)', LK.wonCheck({ prospect: { ...pc, status: 'new', contacted_at: '' }, rows: [clean], site: DOM, now: NOW }).state === 'already_links', '');
    check('a fresh reading of a contacted site counts the same way (LB claims, Reply Reader)', LK.wonCheck({ prospect: pc, rows: [], site: DOM, reading: { verify: 'found', url: clean.from_url, to_url: clean.to_url, rel: 'follow', title: 'Open edX hosting guide' }, now: NOW }).won === true, '');
    // FX-LINKS (review R2 M1): the old check encoded the defect (any lost row of the domain, at any time, made a won link lost); a loss now
    // needs the ledger row of the won page, lost after the win, on a link our check had confirmed
    check('a confirmed won link whose own page\'s ledger row went lost (two misses) after the win -> lost', LK.wonCheck({ prospect: { ...pc, status: 'won', won_at: '2026-11-05T00:00:00.000Z', verified_at: '2026-11-05T00:00:00.000Z', source_url: clean.from_url }, rows: [{ ...clean, status: 'lost', verify: 'missing', lost_reason: 'link_removed', lost_at: '2026-11-15T00:00:00.000Z' }], site: DOM, now: NOW }).state === 'lost', '');
    check('a reading older than 35 days is not evidence', LK.wonCheck({ prospect: pc, rows: [{ ...clean, verified_at: '2026-09-01T00:00:00.000Z' }], site: DOM, now: NOW }).state === 'not_found', '');
    check('the Reply Reader applies the same junk gate before it believes "it is live"', /LK\.junkLink\(/.test(fs.readFileSync(path.join(CODE, 'Reply_Classify_Input.js'), 'utf8')), '');
  });

  await guard('CR17E2 Prospect Rows', async () => {
    reset(); const SN = 'CR17E2 (2026-11-17) the Backlink Monitor heals the stored domain-collision wins and marks a real one won'; begin(SN); const check = mkCheck(SN);
    const clean = { site_id: SID, domain: DOM, ref_domain: 'partner-blog.example', kind: 'web', from_url: 'https://partner-blog.example/open-edx-hosting-guide', to_url: D + '/capabilities/open-edx-services', rel: 'follow', link_type: 'editorial', status: 'live', verify: 'found', verified_at: '2026-11-15T00:00:00.000Z', page_title: 'Open edX hosting guide' };
    const pc = P({ prospect_domain: 'partner-blog.example', type: 'resource', status: 'contacted', contacted_at: '2026-11-03T09:00:00.000Z' });
    mock('Parse Backlinks', [{ json: { site_id: SID, domain: DOM, checked_at: NOW, link_builder: true, candidates: [], ledger_rows: [L1358, L1359, clean], refdomains: ['bebee.com', 'github.com', 'partner-blog.example'] } }]);
    mock('Load Link Prospects', items([P206, P248, P242, pc]));
    mock('Outreach Input', [{ json: { skip: true } }]); mock('Outreach Writer', [{ json: {} }]);
    const out = (await run('Prospect Rows', [{ json: {} }])).map(i => i.json);
    const by = (d, t) => out.find(r => r.prospect_domain === d && r.type === t) || {};
    console.log('   CR17E2 ->', J(out.map(r => [r.prospect_domain, r.type, r.status, r.note.slice(0, 60)])));
    check('bebee mention (206): back to new, won_at cleared, the reason on the row', by('bebee.com', 'mention').status === 'new' && by('bebee.com', 'mention').won_at === '' && /not a won link/.test(by('bebee.com', 'mention').note), J(by('bebee.com', 'mention')));
    check('bebee ai_source (248): back to new', by('bebee.com', 'ai_source').status === 'new', J(by('bebee.com', 'ai_source')));
    check('github (242): low value (a link on a code host profile), verified_at cleared', by('github.com', 'ai_source').status === 'low_value' && by('github.com', 'ai_source').verified_at === '', J(by('github.com', 'ai_source')));
    check('a site we wrote to whose page now links to us: won, with the date our check confirmed it', by('partner-blog.example', 'resource').status === 'won' && by('partner-blog.example', 'resource').verified_at === NOW, J(by('partner-blog.example', 'resource')));
  });

  await guard('CR17E3 outreach kit', async () => {
    reset(); const SN = 'CR17E3 (2026-11-17) one government list, one verdict per website, our page by topic, real link text'; begin(SN); const check = mkCheck(SN);
    const { OK } = kits();
    check('u.ae (the UAE government portal) is a government site, as the fit gate says; so are dubai.ae and gov.uk; a .ae business is not', OK.isGov('u.ae') && OK.isGov('www.u.ae') && OK.isGov('dubai.ae') && OK.isGov('gov.uk') && !OK.isGov('techand.ai') && !OK.isGov('example.ae'), '');
    const R = (o) => ({ prospect_domain: '', type: 'ai_source', page_url: '', page_title: '', ...o });
    const ctx0 = { competitors: [], serp_rivals: [{ domain: 'linkedin.com', host: 'linkedin.com', position: 3, keyword: 'open edx provider' }], ai_rivals: [], topics: ['custom ai solutions uae'], terms: ['Open edX Services', 'AI automation services'] };
    const q319 = OK.requalify(R({ prospect_domain: 'u.ae', page_url: 'https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws', page_title: 'Data protection laws | The Official Platform of the UAE Government' }), ctx0);
    check('stored row 319 (u.ae, needs_contact) is refused: government', OK.reasonCode(q319) === 'government', q319);
    const q325 = OK.requalify(R({ prospect_domain: 'linkedin.com', page_url: 'https://linkedin.com/pulse/top-10-ai-automation-companies-dubai-uae', page_title: 'cited for 2 question(s)' }), ctx0);
    check('stored row 325 (linkedin): a platform, never "a competing site"', OK.reasonCode(q325) === 'platform' && !/competing/.test(q325), q325);
    const q238 = OK.requalify(R({ prospect_domain: 'bebee.com', type: 'mention', page_url: BEBEE, page_title: 'Machine Learning Engineer - DEVAICON | BeBee' }), ctx0);
    check('stored row 238 (bebee mention, drafted): a job board', OK.reasonCode(q238) === 'job_board', q238);
    const v = OK.domainVerdicts([{ prospect_domain: 'abstract-technology.de', type: 'resource', status: 'not_fit', fit_reason: 'a competing provider: their page sells what you sell (50% of your service words, topic match 100%, "book a consultation", "free trial")', checked_at: '2026-10-25T00:00:00.000Z' },
      { prospect_domain: 'example-journal.org', type: 'resource', status: 'not_fit', fit_reason: 'page in another language (de)' }]);
    check('one verdict per website: a competitor verdict is about the website, another language is about a page', v.get('abstract-technology.de') && v.get('abstract-technology.de').code === 'competitor' && !v.has('example-journal.org'), J([...v]));
    const pages = [{ url: D + '/', title: 'Devaicon - Value Driven Innovation Through Automation & AI', keyword: 'Devaicon', kind: 'home' },
      { url: D + '/capabilities/open-edx-services', title: 'Open edX Services | Devaicon', keyword: '', kind: 'money' },
      { url: D + '/services/ai-automation-services-pakistan', title: 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', keyword: 'ai automation services pakistan', kind: 'money' },
      { url: D + '/insights/autonomous-ai-customer-service', title: 'How Customer Services Are Achieving Productivity with AI', keyword: '', kind: 'article' }];
    const df = new Map(); for (const d of pages.map(x => [x.title, x.keyword].join(' '))) for (const w of new Set(OK.words(d).map(OK.stem))) df.set(w, (df.get(w) || 0) + 1);
    const t292 = OK.pickTarget({ type: 'ai_source', text: 'Moodle vs. the Open edX platform | Abstract Technology Open edX and Moodle compared for universities' }, pages, df, pages.length, D + '/', 'Devaicon', DOM);
    check('"Open edX vs Moodle" (292 / 299 went to the homepage) -> the Open edX service page, link text "Open edX Services"', t292.url === D + '/capabilities/open-edx-services' && t292.anchor_text === 'Open edX Services', J(t292));
    const tNo = OK.pickTarget({ type: 'resource', text: 'Machine learning consulting for hospitals: a buyer survey of clinical teams' }, pages, df, pages.length, D + '/', 'Devaicon', DOM);
    check('a page none of ours covers is held (no_matching_page), never the homepage', tNo.hold === 'no_matching_page' && tNo.url === '' && /no page of yours covers their topic/.test(tNo.reason), J(tNo));
    const tList = OK.pickTarget({ type: 'ai_list', text: 'Best Open edX service providers and hosting companies' }, pages, df, pages.length, D + '/', 'Devaicon', DOM);
    check('an editorial "best X providers" list asks for the page that sells X', tList.url === D + '/capabilities/open-edx-services', J(tList));
    const tMen = OK.pickTarget({ type: 'mention', text: 'They name Devaicon' }, pages, df, pages.length, D + '/', 'Devaicon', DOM);
    check('a mention names the business: the homepage, link text "Devaicon" (never "Your brand name")', tMen.url === D + '/' && tMen.anchor_text === 'Devaicon', J(tMen));
    check('link text: the brand suffix is taken off a page title; a doubled one too', OK.stripBrand('AI Automation Services in Pakistan | ISO 27001 | Devaicon', 'Devaicon', DOM) === 'AI Automation Services in Pakistan' && OK.stripBrand('AI Development Companies in the UAE | Devaicon | Devaicon', 'Devaicon', DOM) === 'AI Development Companies in the UAE', '');
    check('no business name on file: the bare address, never a keyword', J(OK.anchorText('brand', { url: D + '/' }, '', DOM)) === J({ kind: 'url', text: 'devaicon.com' }), J(OK.anchorText('brand', { url: D + '/' }, '', DOM)));
  });

  await guard('CR17E4 LB Assemble', async () => {
    reset(); const SN = 'CR17E4 (2026-11-17) LB Assemble on devaicon\'s stored rows: one verdict per website, healed reasons, re-aimed targets, real link text, held pitches'; begin(SN); const check = mkCheck(SN);
    const pages = [{ url: D + '/', title: 'Devaicon - Value Driven Innovation Through Automation & AI', keyword: 'Devaicon', kind: 'home' },
      { url: D + '/capabilities/open-edx-services', title: 'Open edX Services | Devaicon', keyword: '', kind: 'money' },
      { url: D + '/services/ai-automation-services-pakistan', title: 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', keyword: 'ai automation services pakistan', kind: 'money' },
      { url: D + '/services/ai-development-companies', title: 'AI Development Companies in the UAE | Devaicon | Devaicon', keyword: 'ai development companies uae', kind: 'money' }];
    const plan = { site_id: SID, domain: DOM, email: '', callback_url: '', request_id: 'cr17e', on_demand: true, free_only: false, competitors: [], serp_rivals: [{ domain: 'linkedin.com', host: 'linkedin.com', position: 3, keyword: 'open edx provider' }], ai_rivals: [],
      topics: ['ai automation services pakistan', 'custom ai solutions uae'], services: ['Open edX Services', 'AI automation services', 'Custom AI solutions', 'Machine learning consulting'], pages, home: D + '/', profile: { business_type: 'AI and software development company', author_name: 'Devaicon', author_job_title: 'Software Developer' },
      brand: 'Devaicon', brand_known: true, brand_names: ['Devaicon'], country: 'Pakistan', country_iso: 'PK', language_code: 'en', accreditation: '', budget: 10, due: { listings: false }, state: {} };
    const ORow = (o) => ({ site_id: SID, domain: DOM, score: 40, fit: 0.4, fit_reason: '', checks_json: '{}', page_url: '', page_title: '', evidence: '', contacts_json: '[]', contact_email: '', contact_form_url: '', country: '', language: 'en', target_url: '', target_reason: '', anchor_hint: '', sequence_json: '', deadline: '', drafted_at: '', checked_at: '2026-11-13T01:00:00.000Z', request_id: '', ...o });
    const seq = JSON.stringify([{ step: 0, wait_days: 0, subject: 'Open edX hosting for your comparison', body: 'Hello ...' }]);
    const stored = [
      ORow({ prospect_domain: 'abstract-technology.de', type: 'resource', status: 'not_fit', fit: 1, fit_reason: 'a competing provider: their page sells what you sell (50% of your service words, topic match 100%, "book a consultation", "free trial")', page_url: 'https://abstract-technology.de/sandbox-free-trial', checked_at: '2026-10-25T00:00:00.000Z' }),   // 239
      ORow({ prospect_domain: 'abstract-technology.de', type: 'ai_source', status: 'drafted', page_url: 'https://abstract-technology.de/blog/open-edx-vs-moodle', page_title: 'Moodle vs. the Open edX platform | Abstract Technology', target_url: D + '/', anchor_hint: 'brand', sequence_json: seq, drafted_at: '2026-10-30T01:33:39.722Z', contacts_json: '[{"email":"info@abstract-technology.de","kind":"general","own":true}]' }),   // 292
      ORow({ prospect_domain: 'u.ae', type: 'ai_source', status: 'needs_contact', page_url: 'https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws', page_title: 'Data protection laws | The Official Platform of the UAE Government', target_url: D + '/services/ai-development-companies', anchor_hint: 'title' }),   // 319
      ORow({ prospect_domain: 'linkedin.com', type: 'ai_source', status: 'not_fit', fit: 0, fit_reason: 'a competing site of yours (linkedin.com): a site that outranks you for one of your own keywords (#3 for "open edx provider"), and a competitor does not link to your page', page_url: 'https://linkedin.com/pulse/top-10-ai-automation-companies-dubai-uae', page_title: 'cited for 2 question(s) on 1 engine(s)' }),   // 325
      ORow({ prospect_domain: 'sparkixtech.com', type: 'ai_source', status: 'needs_contact', page_url: 'https://sparkixtech.com/top-10-ai-development-companies-pakistan', page_title: 'Top 10 AI Development Companies in Pakistan: AI automation services', target_url: D + '/ai-automation-services-pakistan', target_reason: 'not ranking yet', anchor_hint: 'title' }),   // 316: aimed at a 301
    ];
    const prospects = stored.map(o => P({ prospect_domain: o.prospect_domain, type: o.type, status: 'new', rank: o.prospect_domain === 'u.ae' ? 0 : 200 }));
    const page = (title, body, email) => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<html lang="en"><head><title>' + title + '</title></head><body><main><h1>' + title + '</h1><p>' + body + '</p>' + (email ? '<p>Write to <a href="mailto:' + email + '">' + email + '</a></p>' : '') + '</main></body></html>' });
    const reqs = [{ site_id: SID, kind: 'prospect', prospect_domain: 'lms-compare.example', type: 'resource', url: 'https://lms-compare.example/open-edx-vs-moodle', title: 'Open edX vs Moodle' },
      { site_id: SID, kind: 'prospect', prospect_domain: 'edu-research.example', type: 'resource', url: 'https://edu-research.example/ml-consulting-hospitals', title: 'Machine learning consulting for hospitals' }];
    mock('LB Plan', [{ json: plan }]);
    mock('Load Link Prospects', items(prospects)); mock('Load Link Outreach', items(stored)); mock('Load AIR Kill (LB)', items([])); mock('Load Monitors', items([{ site_id: SID, domain: DOM }]));
    for (const n of ['Load Listings', 'Load Backlinks', 'Load Link Impact', 'Load Query History', 'Load Content Log', 'LB Source Requests', 'Fetch LB Sources', 'LB Second Requests', 'Fetch LB Second', 'LB DFS Requests', 'Run LB DFS']) mock(n, items([]));
    mock('LB Page Requests', reqs.map(j => ({ json: j })));
    mock('Fetch LB Pages', [{ json: page('Open edX vs Moodle: which LMS for your university', 'We compare Open edX and Moodle for universities: Open edX services, hosting, the Open edX platform, course authoring and Moodle plugins. A resource list for LMS buyers.', 'editor@lms-compare.example') },
      { json: page('Machine learning consulting for hospitals', 'Machine learning consulting for hospitals: how clinical teams buy machine learning consulting, what to ask a machine learning consulting firm, a resource list for hospital buyers.', 'editor@edu-research.example') }].map(x => x.json));
    const A = (await run('LB Assemble', [{ json: {} }]))[0].json;
    const rows = A.outreach_rows || [];
    const byK = (d, t) => rows.find(o => o.prospect_domain === d && o.type === t) || {};
    console.log('   CR17E4 ->', J(rows.map(o => [o.prospect_domain, o.type, o.status, o.reason_code, (o.target_url || '').replace(D, ''), o.anchor_text])));
    check('292 (abstract-technology.de blog post, "Ready to send"): left out with its website\'s competitor verdict', byK('abstract-technology.de', 'ai_source').status === 'not_fit' && byK('abstract-technology.de', 'ai_source').reason_code === 'competitor' && /the same website is left out/.test(byK('abstract-technology.de', 'ai_source').fit_reason), J(byK('abstract-technology.de', 'ai_source')));
    check('319 (u.ae): left out, government', byK('u.ae', 'ai_source').status === 'not_fit' && byK('u.ae', 'ai_source').reason_code === 'government', J(byK('u.ae', 'ai_source')));
    check('325 (linkedin): the reason is healed to "a platform", never "a competing site"', byK('linkedin.com', 'ai_source').reason_code === 'platform' && !/competing/.test(byK('linkedin.com', 'ai_source').fit_reason), J(byK('linkedin.com', 'ai_source')));
    const r316 = byK('sparkixtech.com', 'ai_source');
    check('316 (aimed at an address that 301s): re-aimed at one of our live pages (or held), never the old address', !!r316.prospect_domain && r316.target_url !== D + '/ai-automation-services-pakistan' && (pages.some(p => p.url === r316.target_url) || r316.status === 'held'), J(r316));
    const lms = byK('lms-compare.example', 'resource');
    check('a new "Open edX vs Moodle" resource page: our Open edX service page, link text "Open edX Services", ready', lms.status === 'ready' && lms.target_url === D + '/capabilities/open-edx-services' && lms.anchor_text === 'Open edX Services', J(lms));
    const edu = byK('edu-research.example', 'resource');
    check('an on-topic page no page of ours covers: held as no_matching_page, not pitched with the homepage', edu.status === 'held' && edu.reason_code === 'no_matching_page' && edu.target_url === '', J(edu));
    const final = new Map(); for (const o of [...stored, ...rows]) final.set(o.prospect_domain + '|' + o.type, o);
    const open = new Set(['ready', 'needs_contact', 'drafted', 'needs_edit', 'held']);
    const site = (d) => d.replace(/^www\./, '');
    const both = [...final.values()].filter(o => open.has(o.status)).map(o => site(o.prospect_domain)).filter(d => [...final.values()].some(x => site(x.prospect_domain) === d && x.status === 'not_fit' && ['competitor', 'government', 'platform', 'job_board', 'not_a_site', 'sells_links', 'low_authority'].includes(x.reason_code || '')));
    check('no website is both in the queue and left out for a website-level reason', both.length === 0, J(both));
    check('the writer is never handed a left-out website', !(A.jobs || []).some(j => ['abstract-technology.de', 'u.ae', 'linkedin.com'].includes(j.prospect_domain)), J((A.jobs || []).map(j => j.prospect_domain)));
    check('the run says how many pitches wait for a page of yours', A.summary.no_page >= 1, J(A.summary));
    // the writer: the company is not a person, so the draft is signed [Your name] (the draft gate holds it until the client edits it)
    mock('LB Assemble', [{ json: { ...A, jobs: [{ ...lms, checks_json: '{}', contacts_json: '[{"email":"editor@lms-compare.example","kind":"editorial","own":true}]' }] } }]);
    const W = (await run('LB Writer Input', [{ json: {} }]))[0].json;
    check('the signer is a person or [Your name], never "Devaicon, Software Developer, Devaicon"', W.signer === '[Your name], Devaicon', W.signer);
    check('the writer gets the link text itself', W.jobs[0].anchor_text === 'Open edX Services', J(W.jobs[0]));
    mock('LB Plan', [{ json: { ...plan, profile: { ...plan.profile, author_name: 'Tech& Technical Team', author_job_title: 'Microsoft Dynamics 365 and AI Consulting Team' }, brand: 'Tech&', domain: 'techand.ai' } }]);
    const W2 = (await run('LB Writer Input', [{ json: {} }]))[0].json;
    check('techand.ai\'s "Tech& Technical Team" is a team, not a person: [Your name]', W2.signer === '[Your name], Tech&', W2.signer);
    mock('LB Plan', [{ json: { ...plan, profile: { ...plan.profile, author_name: 'Sara Example', author_job_title: 'Head of Delivery' } } }]);
    check('a real person signs with the title', (await run('LB Writer Input', [{ json: {} }]))[0].json.signer === 'Sara Example, Head of Delivery, Devaicon', '');
    check('the prompt offers the link text itself when they ask', /j\.anchor_text \? '"' \+ j\.anchor_text \+ '"'/.test(fs.readFileSync(path.join(__dirname, '..', 'v5', 'prompts', 'link_outreach.txt'), 'utf8')), '');
  });

  await guard('CR17E5 LB Plan targets', async () => {
    reset(); const SN = 'CR17E5 (2026-11-17) LB Plan: the whole inventory is a target, a redirect is followed, utility pages are not targets'; begin(SN); const check = mkCheck(SN);
    mock('Load Sites', items([{ site_id: SID, domain: DOM, status: 'active', keywords: 'ai automation services pakistan', country: 'Pakistan', location_code: 2586, language_code: 'en' }]));
    mock('Load Monitors', items([{ site_id: SID, domain: DOM, link_builder: true }])); mock('Load Profiles', items([{ site_id: SID, domain: DOM, business_name: 'Devaicon' }]));
    mock('Load Ladders', items([{ domain: DOM, keyword: 'ai automation services pakistan', head_keyword: 'ai automation services pakistan', rung: 4, status: 'published', target_url: D + '/ai-automation-services-pakistan', page_type: 'service page' }]));
    for (const n of ['Load Link Prospects', 'Load Link Outreach', 'Load Backlinks', 'Load Backlink Snapshots', 'Load Content Log', 'Load AI Targets', 'Load Query History', 'Load Rank History', 'Load Cache (Links)', 'Load AI Visibility (LB)', 'Load Cache (LB Rivals)', 'Load Listings', 'Load Link Impact', 'Load Cycles']) mock(n, items([]));
    const pg = (u, t, st) => ({ site_id: SID, url: D + u, title: t, http_status: st, queries_json: '' });
    mock('Load Pages (LB)', items([pg('/', 'Devaicon - Value Driven Innovation Through Automation & AI', 200), pg('/capabilities/open-edx-services', 'Open edX Services | Devaicon', 200), pg('/ai-automation-services-pakistan', 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', 301),
      pg('/services/ai-automation-services-pakistan', 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', 0), pg('/careers/ai-ml-engineer', 'AI/ML Engineer Careers | Devaicon', 200), pg('/privacy', 'Privacy Policy | Devaicon', 200), pg('/insights/agentic-ai', 'Agentic AI is Revolutionizing the Industries | Devaicon', 200),
      pg('/industries/bfsi', 'Banking & Financial Services Technology | Devaicon', 301), pg('/services/industries-bfsi', 'Banking & Financial Services Technology | Devaicon', 200), pg('/gone-page', 'Old | Devaicon', 404)]));
    mock('Load Index Pages (LB)', items([{ site_id: SID, domain: DOM, url: D + '/ai-automation-services-pakistan', http_status: 200, final_url: D + '/services/ai-automation-services-pakistan', noindex: '' },
      { site_id: SID, domain: DOM, url: D + '/services/ai-automation-services-pakistan', http_status: 200, final_url: '', noindex: '' }]));
    delete store['Manual Run']; mock('Manual Run', [{ json: { domain: DOM } }]);
    const out = (await run('LB Plan', [{ json: {} }])).map(i => i.json)[0] || {};
    const urls = (out.pages || []).map(p => p.url.replace(/^https:\/\/(www\.)?devaicon\.com/, ''));
    console.log('   CR17E5 pages ->', J((out.pages || []).map(p => [p.url.replace(D, ''), p.kind])));
    check('the Open edX service page (not in Search Console\'s top 15) is a target, as a service page', (out.pages || []).some(p => /\/capabilities\/open-edx-services$/.test(p.url) && p.kind === 'money'), J(urls));
    check('the ladder\'s 301 address is followed to the page it lands on; the old address is never a target', urls.includes('/services/ai-automation-services-pakistan') && !urls.includes('/ai-automation-services-pakistan'), J(urls));
    check('a 301 whose landing page is not on record is never a target (its live twin is offered on its own)', urls.includes('/services/industries-bfsi') && !urls.includes('/industries/bfsi'), J(urls));
    check('careers, privacy and a 404 are never targets', !urls.some(u => /careers|privacy|gone-page/.test(u)), J(urls));
  });

  // ---- FX-LINKS (review R2 M1 M2 L1 L2 L3, 2026-11-18) ----
  const WON_PAGE = 'https://partner-blog.example/open-edx-hosting-guide';
  const LROW = (o) => ({ site_id: SID, domain: DOM, ref_domain: 'partner-blog.example', kind: 'web', from_url: WON_PAGE, to_url: D + '/capabilities/open-edx-services', rel: 'follow', link_type: 'editorial', status: 'live', verify: 'found', verified_at: '2026-11-15T00:00:00.000Z', last_seen: '2026-11-15T00:00:00.000Z', first_seen: '2026-11-08T00:00:00.000Z', page_title: 'Open edX hosting guide', ...o });
  const PW = (o) => P({ prospect_domain: 'partner-blog.example', type: 'lost', status: 'won', contacted_at: '2026-11-03T09:00:00.000Z', won_at: '2026-11-10T00:00:00.000Z', verified_at: '2026-11-10T00:00:00.000Z', source_url: WON_PAGE, ...o });

  await guard('CR17E6 won rule (FX-LINKS)', async () => {
    reset(); const SN = 'CR17E6 (FX-LINKS) lost only from the won page after the win; a link there before the pitch is not won; a stale reading is not gone; a person\'s note is kept'; begin(SN); const check = mkCheck(SN);
    const { LK } = kits();
    const oldLoss = LROW({ status: 'lost', verify: 'missing', lost_reason: 'link_removed', lost_at: '2026-11-01T00:00:00.000Z' });   // the loss we pitched to restore
    const r1 = LK.wonCheck({ prospect: PW(), rows: [oldLoss], site: DOM, now: NOW });
    check('M1: a "link to restore" win whose ledger row was lost BEFORE the win stays won (not lost)', r1.state !== 'lost', J(r1));
    const otherPage = LROW({ from_url: 'https://partner-blog.example/old-list', status: 'lost', verify: 'missing', lost_reason: 'link_removed', lost_at: '2026-11-16T00:00:00.000Z' });
    const r2 = LK.wonCheck({ prospect: PW(), rows: [otherPage], site: DOM, now: NOW });
    check('M1: a lost row of ANOTHER page of the domain never makes the won link lost', r2.state !== 'lost', J(r2));
    const r3 = LK.wonCheck({ prospect: PW(), rows: [LROW({ status: 'lost', verify: 'missing', lost_reason: 'link_removed', lost_at: '2026-11-16T00:00:00.000Z' })], site: DOM, now: NOW });
    check('M1: the won page\'s own row lost after the win -> lost', r3.state === 'lost', J(r3));
    const r3b = LK.wonCheck({ prospect: PW(), rows: [LROW({ status: 'lost', verify: 'missing', lost_at: '2026-11-16T00:00:00.000Z' })], site: DOM, won_url: 'https://partner-blog.example/another-page', now: NOW });
    check('M1: the won page is the Link Builder\'s own (won_url) when it is known', r3b.state !== 'lost', J(r3b));
    const r4 = LK.wonCheck({ prospect: PW({ verified_at: '' }), rows: [LROW({ status: 'lost', verify: 'missing', lost_at: '2026-11-16T00:00:00.000Z' })], site: DOM, now: NOW });
    check('M2: a claim our check never confirmed cannot be "lost"', r4.state === 'not_found', J(r4));
    const pc = P({ prospect_domain: 'partner-blog.example', type: 'resource', status: 'contacted', contacted_at: '2026-11-03T09:00:00.000Z' });
    const r5 = LK.wonCheck({ prospect: pc, rows: [LROW({ first_seen: '2026-09-20T00:00:00.000Z' })], site: DOM, now: NOW });
    check('L3: a link the ledger saw before anyone wrote to them is "already links to you", not won', r5.state === 'already_links' && r5.before_contact === true && !r5.won, J(r5));
    const r5b = LK.wonCheck({ prospect: pc, rows: [LROW({ first_seen: '2026-09-20T00:00:00.000Z' })], reading: { verify: 'found', url: WON_PAGE, to_url: D + '/', rel: 'follow', title: 'Open edX hosting guide' }, site: DOM, now: NOW });
    check('L3: our own reading of that same page counts the same way (the ledger dates the link)', r5b.state === 'already_links', J(r5b));
    check('L3: a pitch to RESTORE a link, and a prospect already won, keep their win', LK.wonCheck({ prospect: { ...pc, type: 'lost' }, rows: [LROW({ first_seen: '2026-09-20T00:00:00.000Z' })], site: DOM, now: NOW }).state === 'won'
      && LK.wonCheck({ prospect: PW({ type: 'resource' }), rows: [LROW({ first_seen: '2026-09-20T00:00:00.000Z' })], site: DOM, now: NOW }).state === 'won', '');
    check('L3: a link first seen after the pitch is won', LK.wonCheck({ prospect: pc, rows: [LROW()], site: DOM, now: NOW }).state === 'won', '');
    const stale = LK.wonCheck({ prospect: P({ prospect_domain: 'partner-blog.example', type: 'resource', status: 'linked' }), rows: [LROW({ verified_at: '2026-10-01T00:00:00.000Z', last_seen: '2026-11-16T00:00:00.000Z' })], site: DOM, now: NOW });
    check('L1: an old reading of a live row is not evidence, but it is not "gone" either', stale.state === 'not_found' && stale.gone === false, J(stale));
    check('L1: every row lost -> gone', LK.wonCheck({ prospect: P({ prospect_domain: 'partner-blog.example', type: 'resource', status: 'linked' }), rows: [LROW({ status: 'lost', verify: 'missing' })], site: DOM, now: NOW }).gone === true, '');
    const person = 'Wrote to Ana (editor) on 3 Nov from my Gmail, she said it is up';
    const n1 = LK.noteWith(person, 'won 2026-11-17: our check found your link on ' + WON_PAGE);
    const n2 = LK.noteWith(n1, 'won 2026-11-24: our check found your link on ' + WON_PAGE);
    check('M2: a person\'s note is never overwritten; our line goes after it and replaces only our earlier line', n1.startsWith(person) && /\nOur check: won 2026-11-17/.test(n1) && n2.startsWith(person) && !/2026-11-17/.test(n2) && /2026-11-24/.test(n2), J([n1, n2]));
    check('M2: an engine / app note is replaced as before', LK.noteWith('sent by you from your own e-mail (marked in the app)', 'won 2026-11-17: x') === 'won 2026-11-17: x' && LK.noteWith('', 'not a won link: y') === 'not a won link: y', '');
    const long = 'x'.repeat(295);
    check('M2: a person\'s long note is never cut to fit ours', LK.noteWith(long, 'not a won link: nobody was written to') === long, '');
  });

  await guard('CR17E7 Prospect Rows (FX-LINKS)', async () => {
    reset(); const SN = 'CR17E7 (FX-LINKS) Backlink Monitor: a won link stays won past an old loss, a lost one is won again, a person\'s Won is a claim with its note, linked does not flap'; begin(SN); const check = mkCheck(SN);
    const person = 'Wrote to Ana on 3 Nov from my own mail';
    const rows = [
      PW({ prospect_domain: 'restore.example', type: 'lost', source_url: 'https://restore.example/tools' }),
      P({ prospect_domain: 'back.example', type: 'resource', status: 'lost', contacted_at: '2026-10-01T00:00:00.000Z', won_at: '2026-10-10T00:00:00.000Z', verified_at: '2026-11-01T00:00:00.000Z', note: 'won 2026-10-10, gone by 2026-11-01: their page no longer carries a link to you' }),
      P({ prospect_domain: 'claim.example', type: 'resource', status: 'won', contacted_at: '2026-11-12T00:00:00.000Z', won_at: '2026-11-12T00:00:00.000Z', verified_at: '', note: person }),
      P({ prospect_domain: 'claimfound.example', type: 'resource', status: 'won', contacted_at: '2026-11-12T00:00:00.000Z', won_at: '2026-11-12T00:00:00.000Z', verified_at: '', note: person }),
      P({ prospect_domain: 'legacy.example', type: 'mention', status: 'won', won_at: '2026-10-20T00:00:00.000Z', note: person }),
      P({ prospect_domain: 'stale.example', type: 'resource', status: 'linked', note: 'they link to you, but nobody was written to: not a link-building result' }),
      P({ prospect_domain: 'goneaway.example', type: 'resource', status: 'linked' }),
    ];
    const led = (d, o) => LROW({ ref_domain: d, from_url: 'https://' + d + '/page', ...o });
    const ledger = [
      led('restore.example', { from_url: 'https://restore.example/tools', status: 'lost', verify: 'missing', lost_reason: 'link_removed', lost_at: '2026-11-01T00:00:00.000Z' }),
      led('back.example', {}),
      led('claimfound.example', {}),
      led('stale.example', { verified_at: '2026-10-01T00:00:00.000Z', last_seen: '2026-11-16T00:00:00.000Z' }),
      led('goneaway.example', { status: 'lost', verify: 'missing', lost_reason: 'link_removed' }),
    ];
    mock('Parse Backlinks', [{ json: { site_id: SID, domain: DOM, checked_at: NOW, link_builder: true, candidates: [], ledger_rows: ledger, refdomains: [] } }]);
    mock('Load Link Prospects', items(rows));
    mock('Outreach Input', [{ json: { skip: true } }]); mock('Outreach Writer', [{ json: {} }]);
    const out = (await run('Prospect Rows', [{ json: {} }])).map(i => i.json);
    const by = (d) => out.find(r => r.prospect_domain === d) || rows.find(r => r.prospect_domain === d);
    console.log('   CR17E7 ->', J(out.map(r => [r.prospect_domain, r.status, r.verified_at, r.note.slice(0, 50)])));
    check('M1: a restored link (won 10 Nov) is not lost by the loss we pitched about (1 Nov)', by('restore.example').status === 'won', J(by('restore.example')));
    check('M1: a lost link our check finds again is won again', by('back.example').status === 'won' && /^won again/.test(by('back.example').note) && by('back.example').verified_at === NOW, J(by('back.example')));
    check('M2: a person\'s Won with nothing found yet stays won (a claim), their note intact', by('claim.example').status === 'won' && by('claim.example').note === person && by('claim.example').verified_at === '', J(by('claim.example')));
    const cf = by('claimfound.example');
    check('M2: a claim our check confirms gets verified_at; the person\'s note kept, our line after it', cf.status === 'won' && cf.verified_at === NOW && cf.won_at === '2026-11-12T00:00:00.000Z' && cf.note.startsWith(person) && /Our check: won/.test(cf.note), J(cf));
    const lg = by('legacy.example');
    check('M2: a Won a person set before contacted_at was stamped, with their own note, is kept as their claim (never sent back to new)', lg.status === 'won' && lg.note === person && !!lg.contacted_at, J(lg));
    check('L1: a site that links, read 48 days ago, stays "already links to you"', by('stale.example').status === 'linked', J(by('stale.example')));
    check('L1: a site whose every ledger row is lost goes back to new', by('goneaway.example').status === 'new', J(by('goneaway.example')));
  });

  await guard('CR17E8 Site Admin prospect (FX-LINKS)', async () => {
    reset(); const SN = 'CR17E8 (FX-LINKS) a person\'s Won / Replied stamps contacted_at; the app\'s own note goes after the person\'s'; begin(SN); const check = mkCheck(SN);
    const person = 'Called them twice, Ana promised the link';
    const stored = P({ prospect_domain: 'claim.example', type: 'resource', status: 'new', note: person });
    const go = async (a) => { mock('Admin Action', [{ json: { site_id: SID, domain: DOM, prospect_domain: 'claim.example', prospect_type: 'resource', updated_at: NOW, note: null, ...a } }]); mock('Load Link Prospects (Admin)', items([stored])); return (await run('Prospect Rows (Admin)', [{ json: {} }]))[0].json; };
    const w = await go({ prospect_status: 'won' });
    check('Won from the Backlinks page: contacted_at stamped (their claim), won_at set, the note untouched', w.status === 'won' && w.contacted_at === NOW && w.won_at === NOW && w.note === person, J(w));
    const r = await go({ prospect_status: 'replied', note: 'you said the link is live: our check reads their page in the next weekly run and counts it won when it finds it', note_mode: 'system' });
    check('the app\'s line (note_mode system) goes after the person\'s note, never over it', r.note.startsWith(person) && /Our check: you said the link is live/.test(r.note) && r.contacted_at === NOW, J(r));
    const t = await go({ prospect_status: 'contacted', note: 'New note typed by the person' });
    check('a note the person types replaces the note (their own edit)', t.note === 'New note typed by the person', J(t));
  });

  await guard('CR17E9 LB re-checks claims and lost links (FX-LINKS)', async () => {
    reset(); const SN = 'CR17E9 (FX-LINKS) the Link Builder reads unconfirmed claims and lost links as claims, within its budget; a lost link found again is won again; the outreach row keeps its keys'; begin(SN); const check = mkCheck(SN);
    const plan = { site_id: SID, domain: DOM, competitors: [], ai_rivals: [], qualify_max: 0, home: D + '/', topics: [], profile: {}, due: {}, brand: 'Devaicon', country_iso: 'PK' };
    const pr = [
      P({ prospect_domain: 'verified.example', type: 'resource', status: 'won', contacted_at: '2026-10-01T00:00:00.000Z', won_at: '2026-10-10T00:00:00.000Z', verified_at: '2026-10-10T00:00:00.000Z' }),
      P({ prospect_domain: 'claim.example', type: 'resource', status: 'won', contacted_at: '2026-11-12T00:00:00.000Z', won_at: '2026-11-12T00:00:00.000Z', verified_at: '' }),
      P({ prospect_domain: 'lostone.example', type: 'resource', status: 'lost', contacted_at: '2026-09-01T00:00:00.000Z', won_at: '2026-09-10T00:00:00.000Z', verified_at: '2026-11-01T00:00:00.000Z' }),
      ...Array.from({ length: 7 }, (_, i) => P({ prospect_domain: 'lost' + i + '.example', type: 'resource', status: 'lost', contacted_at: '2026-09-01T00:00:00.000Z', won_at: '2026-09-10T00:00:00.000Z', verified_at: '2026-11-01T00:00:00.000Z' })),
    ];
    mock('LB Plan', [{ json: plan }]); mock('Load Link Prospects', items(pr)); mock('Load Link Outreach', items([])); mock('Load Backlinks', items([]));
    for (const n of ['LB Source Requests', 'Fetch LB Sources', 'LB DFS Requests', 'Run LB DFS']) mock(n, items([]));
    const q = (await run('LB Page Requests', [{ json: {} }])).map(i => i.json).filter(x => x.kind === 'won' || x.kind === 'claim');
    const k = (d) => (q.find(x => x.prospect_domain === d) || {}).kind;
    console.log('   CR17E9 queue ->', J(q.map(x => [x.prospect_domain, x.kind])));
    check('a confirmed win is read as won; a claim and a lost link we wrote to are read as claims', k('verified.example') === 'won' && k('claim.example') === 'claim', J(q));
    check('lost links are read within the budget: at most 4 a run, after the wins and claims', q.filter(x => /^lost/.test(x.prospect_domain)).length === 4 && q.length <= 12, J(q.map(x => x.prospect_domain)));
    // LB Assemble: the lost link is found again on a page with no stored outreach row (a site contacted outside the Link Builder)
    const lp = { site_id: SID, domain: DOM, email: '', callback_url: '', request_id: 'fx', on_demand: true, free_only: false, competitors: [], serp_rivals: [], ai_rivals: [], topics: ['open edx'], services: ['Open edX Services'], pages: [{ url: D + '/', title: 'Devaicon', keyword: 'Devaicon', kind: 'home' }], home: D + '/',
      profile: { business_type: 'software' }, brand: 'Devaicon', brand_known: true, brand_names: ['Devaicon'], country: 'Pakistan', country_iso: 'PK', language_code: 'en', accreditation: '', budget: 10, due: { listings: false }, state: {} };
    const person = 'Their editor Omar said he will put it back';
    const lostP = { ...pr[2], note: person };
    mock('LB Plan', [{ json: lp }]);
    mock('Load Link Prospects', items([lostP, pr[1]])); mock('Load Link Outreach', items([])); mock('Load AIR Kill (LB)', items([])); mock('Load Monitors', items([{ site_id: SID, domain: DOM }]));
    for (const n of ['Load Listings', 'Load Backlinks', 'Load Link Impact', 'Load Query History', 'Load Content Log', 'LB Source Requests', 'Fetch LB Sources', 'LB Second Requests', 'Fetch LB Second', 'LB DFS Requests', 'Run LB DFS']) mock(n, items([]));
    const html = (u) => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<html lang="en"><head><title>Open edX hosting guide</title></head><body><main><h1>Open edX hosting guide</h1><p>Good Open edX hosting firms: <a href="' + u + '">Devaicon</a> runs Open edX for universities.</p></main></body></html>' });
    mock('LB Page Requests', [{ json: { site_id: SID, kind: 'claim', url: 'https://lostone.example/guide', prospect_domain: 'lostone.example', type: 'resource', won_at: '2026-09-10T00:00:00.000Z', contacted_at: '2026-09-01T00:00:00.000Z' } }, { json: { site_id: SID, kind: 'claim', url: 'https://claim.example/list', prospect_domain: 'claim.example', type: 'resource', won_at: '2026-11-12T00:00:00.000Z', contacted_at: '2026-11-12T00:00:00.000Z' } }]);
    mock('Fetch LB Pages', [html(D + '/capabilities/open-edx-services'), html(D + '/')]);
    const A = (await run('LB Assemble', [{ json: {} }]))[0].json;
    const po = (A.prospect_rows || []); const oo = (A.outreach_rows || []);
    const lo = po.find(r => r.prospect_domain === 'lostone.example') || {}; const cl = po.find(r => r.prospect_domain === 'claim.example') || {};
    console.log('   CR17E9 assemble ->', J(po.map(r => [r.prospect_domain, r.status, r.won_at, r.verified_at, String(r.note).slice(0, 60)])), J(oo.map(o => [o.prospect_domain, o.type])));
    check('M1: a lost link found again on their page is won again; the person\'s note kept', lo.status === 'won' && !!lo.verified_at && lo.note.startsWith(person) && /won again/.test(lo.note), J(lo));
    check('M2: a claim our reading confirms keeps the date the person marked it won, and gets verified_at', cl.status === 'won' && cl.won_at === '2026-11-12T00:00:00.000Z' && !!cl.verified_at, J(cl));
    check('L2: the outreach row of a win with no stored row carries its own site / prospect / type keys', oo.length >= 2 && oo.every(o => o.site_id && o.prospect_domain && o.type), J(oo.map(o => [o.site_id, o.prospect_domain, o.type])));
    const W = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Link_Builder.json'), 'utf8')); const wf = Array.isArray(W) ? W[0] : W;
    const oc = ((wf.nodes.find(n => n.name === 'Outreach Rows') || {}).parameters || {}).jsCode || '';
    check('L2: the outreach sink never writes a row without its upsert keys', /String\(r\.prospect_domain \?\? ''\)\.trim\(\) !== ''/.test(oc) && /String\(r\.type \?\? ''\)\.trim\(\) !== ''/.test(oc), oc.slice(0, 300));
  });
};
