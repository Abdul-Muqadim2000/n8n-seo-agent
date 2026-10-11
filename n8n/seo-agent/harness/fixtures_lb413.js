// Fixtures for the Link Builder v4.13 (LINK_BUILDER_SPEC.md). The site is techand.ai. REAL responses captured 2026-10-11 from the n8n
// container (fixtures_live/lb_*.gz): Bluesky #journorequest (100 posts, dates moved to "now" so recency rules stay testable), techand.ai's
// Wayback CDX, the UAE Ministry of Finance provider list (names ClearTax and Azentio, not techand.ai), azdan.com's "Top 20 UAE e-invoicing
// providers" (sales@azdan.com next to SAP and Deloitte addresses), flick.network's provider page, techand.ai's homepage (links LinkedIn),
// cleartax.com (403 bot wall) and saashub.com/techand (404). Every other page is built to exercise one path (sells links, gone, blocked,
// other language, a dead link, a mention, an author page, a competitor's dead page).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const gz = (n) => zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'lb_' + n + '.gz'))).toString('utf8');
const SITE = 'site_techand-ai', DOMAIN = 'techand.ai';
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString();
const day = (daysAgo) => iso(daysAgo).slice(0, 10);
const H = 'https://techand.ai';
const HUB = H + '/insights/e-invoicing-in-uae', GUIDE = H + '/insights/peppol-accredited-service-providers-uae', SERVICE = H + '/services/e-invoicing', ANSWER = H + '/insights/best-e-invoicing-software-uae';
// ---- plan inputs ----
const sites = () => [{ json: { site_id: SITE, domain: DOMAIN, gsc_property: 'sc-domain:techand.ai', ga4_property_id: '543096312', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'http://server:4000/api/hooks/n8n/tok', keywords: 'e invoicing in uae, peppol uae', status: 'active', source: 'track' } }];
const ladders = () => [
  { json: { ladder_id: 'lad_t', domain: DOMAIN, head_keyword: 'e invoicing in uae', rung: 4, page_no: 1, keyword: 'e invoicing in uae', page_type: 'Pillar / hub page', target_url: HUB, page_exists: true, status: 'published', country: 'United Arab Emirates', location_code: 2784 } },
  { json: { ladder_id: 'lad_t', domain: DOMAIN, head_keyword: 'e invoicing in uae', rung: 2, page_no: 2, keyword: 'peppol accredited service providers uae', page_type: 'Guide', target_url: GUIDE, page_exists: true, status: 'published' } },
  { json: { ladder_id: 'lad_t', domain: DOMAIN, head_keyword: 'e invoicing in uae', rung: 3, page_no: 3, keyword: 'e invoicing software uae', page_type: 'Service Page', target_url: SERVICE, page_exists: true, status: 'published' } },
  { json: { ladder_id: 'lad_t', domain: DOMAIN, head_keyword: 'e invoicing in uae', rung: 1, page_no: 4, keyword: 'e invoice penalties uae', page_type: 'Guide', target_url: '', page_exists: false, status: 'planned' } }];
const monitors = (o = {}) => [{ json: { site_id: SITE, domain: DOMAIN, ai_visibility: true, backlinks: true, link_builder: true, audit_monthly: true, competitors: 'cleartax.com, azentio.com', brand_names: '', ...o } }];
const profiles = () => [{ json: { site_id: SITE, domain: DOMAIN, business_name: 'Techand Systems', business_type: 'ERP and e-invoicing consultancy', author_name: 'Sara Khan', author_job_title: 'Head of Finance Systems', city: 'Dubai', country_code: 'AE', street_address: 'Office 1204, Bay Square', public_email: 'hello@techand.ai' } }];
const P = (d, type, o = {}) => ({ site_id: SITE, domain: DOMAIN, prospect_domain: d, type, rank: 0, spam_score: 0, detail: '', source_url: '', target_url: '', status: 'new', first_seen: iso(10), last_seen: iso(3), won_at: '', outreach_subject: '', outreach_body: '', note: '', score: 30, origin: 'web',
  contact_email: '', contact_url: '', contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', ...o });
const prospects = () => [
  P('azdan.com', 'list', { source_url: 'https://www.azdan.com/blog/top-20-uae-einvoicing-service-providers', score: 31, detail: '"Top 20 UAE E-Invoicing ASP | Azdan" lists cleartax.com, azentio.com, not you' }),
  P('penieltech.com', 'list', { source_url: 'https://www.penieltech.com/blog/best-invoicing-tools-uae-small-business/', score: 32, detail: '"5 Best E-Invoicing Tools in UAE" lists cleartax.com, not you' }),
  P('mof.gov.ae', 'ai_source', { source_url: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/', score: 62, contact_email: 'sajid@advintek.ae', detail: 'AI cites this official 4x (chatgpt)' }),   // the wrong contact AI Growth stored (live 2026-10-11)
  P('flick.network', 'ai_source', { source_url: 'https://www.flick.network/en-ae/e-invoicing-service-providers-uae', score: 14, detail: 'AI cites this article 1x (gemini)' }),
  P('linkfarm-seo.com', 'gap', { score: 40, detail: 'Links to cleartax.com, not to you (Common Crawl)' }),
  P('gonepage.net', 'gap', { score: 38, detail: 'Links to azentio.com, not to you' }),
  P('blockedsite.com', 'mention', { source_url: 'https://blockedsite.com/news/uae-einvoicing', score: 45, detail: 'Names Techand Systems' }),
  P('erpdaily.ae', 'mention', { source_url: 'https://erpdaily.ae/2026/09/uae-e-invoicing-partners', score: 50, detail: 'Names Techand Systems without a link' }),
  P('rechnung-blog.de', 'gap', { score: 35, detail: 'Links to cleartax.com' }),
  P('peppol.org', 'gap', { score: 60, detail: 'already links' }),
  P('travelbooker.com', 'gap', { score: 45, detail: 'Links to cleartax.com (Common Crawl)' }),   // live 2026-10-11: off-topic sites from the gap (Navan, Stripe) were kept
  P('techand.ai', 'reclaim', { score: 90, detail: 'broken page on your site' })];
// last week: one prospect qualified with its contact, not drafted yet (the budget was used) → drafted this week; one already drafted (kept)
const outreachPrev = () => [
  { site_id: SITE, domain: DOMAIN, prospect_domain: 'consultsynergy.ae', type: 'gap', status: 'ready', score: 42, fit: 0.55, fit_reason: 'topic match 55%', checks_json: '{}', page_url: 'https://consultsynergy.ae/e-invoicing', page_title: 'E-invoicing advisory in the UAE', evidence: 'Names cleartax.com — "We help UAE businesses choose an accredited e-invoicing provider."',
    contacts_json: JSON.stringify([{ email: 'info@consultsynergy.ae', kind: 'general', own: true, source_url: 'https://consultsynergy.ae/contact' }]), contact_email: 'info@consultsynergy.ae', contact_form_url: '', country: 'AE', language: 'en', target_url: GUIDE, target_reason: 'topic match 60%', anchor_hint: 'title', sequence_json: '', deadline: '', drafted_at: '', checked_at: iso(7), request_id: '' },
  { site_id: SITE, domain: DOMAIN, prospect_domain: 'invoicefatura.com', type: 'gap', status: 'drafted', score: 42, fit: 0.6, page_url: 'https://invoicefatura.com/', contacts_json: '[]', contact_email: 'hello@invoicefatura.com', target_url: GUIDE, sequence_json: JSON.stringify([{ step: 0, wait_days: 0, subject: 'A Peppol guide for your readers', body: 'Hi …' }]), drafted_at: iso(7), checked_at: iso(7) }];
const listingsPrev = () => [{ site_id: SITE, domain: DOMAIN, listing_id: 'g2', name: 'G2', category: 'reviews', status: 'submitted', profile_url: '', rel: 'none', competitors: '', submit_url: 'https://sell.g2.com/', priority: 1, why: '', checked_at: iso(40), submitted_at: iso(30), note: 'submitted by Sara' }];
// the ledger: peppol.org's followed link to the homepage (found 80 days ago: impact reads), a link to the hub 20 days ago (too early), a keyword-anchor link to the service page
const ledger = () => [
  { site_id: SITE, domain: DOMAIN, ref_domain: 'peppol.org', kind: 'web', from_url: 'https://peppol.org/members/full-members-list/', to_url: H + '/', anchor: 'Techand', anchor_kind: 'brand', rel: 'follow', status: 'live', verify: 'found', first_seen: iso(80), seo_value: 52 },
  { site_id: SITE, domain: DOMAIN, ref_domain: 'gulfbiz.ae', kind: 'web', from_url: 'https://gulfbiz.ae/peppol', to_url: HUB, anchor: 'e-invoicing in the UAE', anchor_kind: 'money', rel: 'follow', status: 'live', verify: 'found', first_seen: iso(20), seo_value: 30 },
  { site_id: SITE, domain: DOMAIN, ref_domain: 'erpdir.ae', kind: 'web', from_url: 'https://erpdir.ae/vendors', to_url: SERVICE, anchor: 'e invoicing software uae', anchor_kind: 'money', rel: 'follow', status: 'live', verify: 'found', first_seen: iso(400), seo_value: 25 },
  { site_id: SITE, domain: DOMAIN, ref_domain: 'linkedin.com', kind: 'social', from_url: 'https://www.linkedin.com/company/techanduae', to_url: H + '/', anchor: '', rel: 'nofollow', status: 'live', verify: 'found', first_seen: iso(200), seo_value: 0 }];
// Search Console windows (28 days, weekly): before the peppol.org link (85 days ago) and now — the homepage improves more than the other pages
const Q = (period, page, query, impressions, position, clicks = 0) => ({ site_id: SITE, domain: DOMAIN, period_end: period, checked_at: period + 'T09:00:00Z', query, clicks, impressions, ctr: 0, position, page, tracked: false });
const queries = () => [
  Q(day(85), H + '/', 'techand', 40, 9.0, 4), Q(day(85), H + '/', 'erp partner dubai', 60, 24.0), Q(day(85), HUB, 'e invoicing in uae', 120, 28.0), Q(day(85), GUIDE, 'peppol accredited service providers uae', 50, 35.0),
  Q(day(85), SERVICE, 'e invoicing software uae', 80, 41.0), Q(day(85), H + '/insights/vat-uae', 'vat uae', 90, 30.0), Q(day(85), H + '/capabilities/erp', 'erp uae', 70, 33.0), Q(day(85), H + '/insights/zatca', 'zatca phase 2', 40, 22.0),
  Q(day(3), H + '/', 'techand', 55, 4.0, 9), Q(day(3), H + '/', 'erp partner dubai', 80, 14.0, 2), Q(day(3), HUB, 'e invoicing in uae', 150, 21.0, 1), Q(day(3), GUIDE, 'peppol accredited service providers uae', 60, 12.0, 1),
  Q(day(3), SERVICE, 'e invoicing software uae', 90, 40.0), Q(day(3), H + '/insights/vat-uae', 'vat uae', 95, 29.0), Q(day(3), H + '/capabilities/erp', 'erp uae', 75, 32.0), Q(day(3), H + '/insights/zatca', 'zatca phase 2', 45, 23.0)];
const ranks = () => [{ ladder_id: 'lad_t', keyword: 'e invoicing in uae', checked_at: iso(5), position: 21, url: HUB, domain: DOMAIN, rung: 4 }];
const snaps = () => [{ site_id: SITE, domain: DOMAIN, checked_at: iso(9), mode: 'full', competitors_json: JSON.stringify([{ domain: 'cleartax.com' }, { domain: 'azentio.com' }]) }];
const targets = () => [{ target_id: 'ait_1', site_id: SITE, domain: DOMAIN, question: 'What is the best e-invoicing software in the UAE?', keyword: 'best e-invoicing software uae', kind: 'new', page_url: ANSWER, status: 'won' }];
const cache = (o = {}) => [{ key: 'linkbld:' + SITE, kind: 'linkbld', site_id: SITE, value: JSON.stringify({ listings_at: iso(40), resources_at: iso(10), broken_at: iso(40), ...o }), updated_at: iso(10) }];
// ---- source responses (HTTP text: the body under data) ----
const bsky = (extra = []) => { const j = JSON.parse(gz('bsky_journorequest.json')); j.posts.forEach((p, i) => { p.record.createdAt = new Date(Date.now() - (i + 1) * 3600e3).toISOString(); });
  j.posts.unshift(...extra); return { statusCode: 200, data: JSON.stringify(j) }; };
const onTopicPost = () => ({ uri: 'at://did:plc:fin/app.bsky.feed.post/3mfinreq1', author: { handle: 'gulffinance.bsky.social', displayName: 'Gulf Finance Desk' }, indexedAt: iso(0.1),
  record: { createdAt: iso(0.1), text: '#JournoRequest Looking for e-invoicing experts in the UAE to explain what the 2027 Peppol deadline means for SMEs and their ERP systems. Deadline 20 Oct. Email desk@gulffinance.ae' } });
const cdx = () => ({ statusCode: 200, data: gz('cdx_techand.json') });
const searx = (urls) => ({ statusCode: 200, data: JSON.stringify({ results: urls.map(u => ({ url: u, title: 'result ' + u })) }) });
const dfsBroken = () => ({ tasks: [{ status_code: 20000, status_message: 'Ok.', cost: 0.0216, result: [{ items_count: 2, items: [
  { domain_from: 'www.erpinsights.ae', url_from: 'https://www.erpinsights.ae/peppol-guide', url_to: 'https://www.cleartax.com/ae/peppol-accredited-providers-old', anchor: 'list of accredited Peppol providers', is_broken: true, url_to_status_code: 404, domain_from_rank: 210, dofollow: true },
  { domain_from: 'casino-links.biz', url_from: 'https://casino-links.biz/finance', url_to: 'https://www.cleartax.com/ae/vat-old', anchor: 'vat', is_broken: true, url_to_status_code: 404, domain_from_rank: 400, dofollow: true }] }] }] });
// ---- pages (the HTTP node's full text response) ----
const html = (title, body, o = {}) => '<!doctype html><html lang="' + (o.lang || 'en') + '"><head><title>' + title + '</title></head><body><main>' + body + '</main><footer><a href="/contact">Contact</a></footer></body></html>';
const PAGES = {
  'https://www.azdan.com/blog/top-20-uae-einvoicing-service-providers': gz('page_azdan_top20.html'),
  'https://www.penieltech.com/blog/best-invoicing-tools-uae-small-business/': html('5 Best E-Invoicing Tools in UAE: Complete Business Guide', '<h1>5 Best E-Invoicing Tools in UAE</h1><p>Small businesses in the UAE must move to Peppol e-invoicing. We compared ClearTax and three other tools for SMEs, with prices and setup time.</p><p>Read the official <a href="https://old-vat-portal.ae/e-invoicing-guide">UAE e-invoicing guide</a> and <a href="https://www.tax.gov.ae/en/default.aspx">the FTA site</a> and <a href="https://www.cleartax.com/ae">ClearTax</a>.</p><p>Write for us: we accept expert articles.</p>'),
  'https://mof.gov.ae/en/about-us/initiatives/einvoicing/pre-approved-einvoicing-service-providers/': gz('page_mof_asp_list.html'),
  'https://www.flick.network/en-ae/e-invoicing-service-providers-uae': gz('page_flick_providers.html'),
  'https://linkfarm-seo.com/': html('Guest posts and backlinks', '<p>Sponsored post $50 per article, dofollow link guaranteed. Buy a guest post today. Casino, finance, crypto accepted.</p>' + Array.from({ length: 5 }, (_, i) => '<a href="https://site' + i + '.com/">s</a>').join('')),
  'https://blockedsite.com/news/uae-einvoicing': '<html><head><title>Just a moment...</title></head><body>Checking your browser cf-browser-verification</body></html>',
  'https://erpdaily.ae/2026/09/uae-e-invoicing-partners': html('UAE e-invoicing: which ERP partners are ready?', '<article><p>By <a rel="author" href="/author/layla-haddad">Layla Haddad</a></p><p>Several Dubai partners, including Techand Systems and two Big Four firms, are helping mid-size companies prepare their ERP for Peppol before the 2027 deadline.</p></article>'),
  'https://travelbooker.com/': html('Book cheap flights and hotels', '<p>Compare flights and hotels worldwide and save on your next trip. Write to hello@travelbooker.com</p>'),
  'https://rechnung-blog.de/': html('E-Rechnung: Pflicht ab 2025', '<p>Die E-Rechnung wird Pflicht. Peppol und ZUGFeRD im Vergleich mit ClearTax.</p>', { lang: 'de' }),
  'https://www.erpinsights.ae/peppol-guide': html('A practical Peppol guide for UAE finance teams', '<p>Finance teams in the UAE should check the <a href="https://www.cleartax.com/ae/peppol-accredited-providers-old">list of accredited Peppol providers</a> before choosing an e-invoicing partner.</p><p>Contact the editor: <a href="mailto:editor@erpinsights.ae">editor@erpinsights.ae</a></p>'),
  'https://casino-links.biz/finance': html('Finance links', '<p>casino betting finance links, sponsored post $30 per link</p>'),
  // our own pages and the competitors' (listings evidence)
  'https://techand.ai/': gz('page_techand_home.html'),
  'https://www.cleartax.com/': gz('page_cleartax_home.html'),
  'https://cleartax.com/': gz('page_cleartax_home.html'),
  'https://azentio.com/': html('Azentio', '<p>Azentio software.</p><a href="https://www.g2.com/products/azentio-orbitx/reviews">Read our reviews on G2</a> <a href="https://www.crunchbase.com/organization/azentio">Crunchbase</a> <a href="https://www.linkedin.com/company/azentio">LinkedIn</a>'),
  'https://www.saashub.com/techand-systems': gz('page_saashub_techand.html'),
  'https://www.crunchbase.com/organization/techand': '<html><head><title>Attention Required! | Cloudflare</title></head><body>cf_chl_ challenge</body></html>',
  // contacts and outbound checks
  'https://www.azdan.com/contact': html('Contact Azdan', '<p>Write to <a href="mailto:sales@azdan.com">sales@azdan.com</a></p>'),
  'https://www.penieltech.com/contact': html('Contact', '<form action="/send"><input name="name"><textarea name="msg"></textarea></form><p>Editorial: <a href="mailto:editor@penieltech.com">editor@penieltech.com</a></p>'),
  'https://erpdaily.ae/author/layla-haddad': html('Layla Haddad, ERP Daily', '<p>Layla covers ERP and tax technology. <a href="mailto:layla.haddad@erpdaily.ae">layla.haddad@erpdaily.ae</a></p>'),
  'https://erpdaily.ae/contact': html('Contact ERP Daily', '<p>News desk: news@erpdaily.ae · Advertising: ads@erpdaily.ae</p>'),
  'https://www.flick.network/contact': html('Contact Flick', '<p>sales@flick.network</p>'),
  'https://www.tax.gov.ae/en/default.aspx': html('FTA', '<p>Federal Tax Authority</p>'),
  'https://www.cleartax.com/ae': html('ClearTax UAE', '<p>ClearTax</p>') };
const STATUS = { 'https://gonepage.net/': 404, 'https://blockedsite.com/news/uae-einvoicing': 403, 'https://www.cleartax.com/': 403, 'https://cleartax.com/': 403, 'https://www.saashub.com/techand-systems': 404, 'https://www.crunchbase.com/organization/techand': 403,
  'https://old-vat-portal.ae/e-invoicing-guide': 404, 'https://techand.ai/capabilities/data': 404 };
const fetchPage = (url) => { const u = String(url); if (PAGES[u] !== undefined) return { statusCode: STATUS[u] || 200, headers: { 'content-type': 'text/html' }, data: PAGES[u] };
  if (STATUS[u]) return { statusCode: STATUS[u], headers: {}, data: '<html><title>Not found</title></html>' };
  if (/^https:\/\/techand\.ai\//.test(u)) return { statusCode: 200, headers: {}, data: html('Techand page', '<p>page</p>') };
  return { statusCode: 200, headers: {}, data: html('A page', '<p>Some page.</p>') }; };   // any other page answers (only the ones listed above are dead)
// the writer's answer (Claude) for the jobs it gets: a sequence for each, except the one it judges not a fit
const writer = (jobs) => ({ output: { sequences: jobs.filter(j => j.prospect_domain !== 'flick.network').map(j => ({ n: j.n, steps: j.type === 'press'
  ? [{ step: 0, subject: 'Re: the 2027 Peppol deadline for UAE SMEs', body: 'Hi, here is what the 2027 deadline means for SMEs: [three practical points]. Sara Khan, Head of Finance Systems, Techand Systems' }, { step: 1, body: 'A short follow-up in case it helps your piece.' }, { step: 2, body: 'third step that must be dropped for press' }]
  : [{ step: 0, subject: 'A dead link in your e-invoicing guide', body: 'Hi, the link "' + j.page_title + '" … Sara Khan, Head of Finance Systems, Techand Systems' }, { step: 1, body: 'One more detail …' }, { step: 2, body: 'Who would be the right person? I will not write again.' }] })),
  skip: jobs.filter(j => j.prospect_domain === 'flick.network').map(j => ({ n: j.n, reason: 'a competing e-invoicing provider\'s own page' })) } });
module.exports = { SITE, DOMAIN, H, HUB, GUIDE, SERVICE, ANSWER, iso, sites, ladders, monitors, profiles, prospects, outreachPrev, listingsPrev, ledger, queries, ranks, snaps, targets, cache, bsky, onTopicPost, cdx, searx, dfsBroken, fetchPage, writer, gz };
