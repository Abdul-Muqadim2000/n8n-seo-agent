// Fixtures for the Site Tracker (scenario S10): Search Console (site list, Search Analytics, URL Inspection), GA4 Admin + Data API,
// Google Trends through DataForSEO. Shapes follow the real APIs; numbers are chosen to trigger every detector once.
const D = 'northwind-erp.com';
const HOST = 'https://www.' + D;
const sitesRows = (o) => [{ json: { id: 1, createdAt: 'x', updatedAt: 'x', site_id: 'site_northwind-erp-com', domain: D, gsc_property: '', ga4_property_id: '', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: 'owner@example.com', callback_url: 'https://hooks.example.com/x', keywords: 'erp implementation dubai, e invoicing software uae, northwind erp login', status: 'active', source: 'form', created_at: '2026-09-01T00:00:00.000Z', last_run_at: '2026-09-22T09:00:00.000Z', last_status: 'gsc:ok ga4:ok', request_id: 'req-site-1', ...(o || {}) } }];
const gscSites = () => ({ siteEntry: [{ siteUrl: HOST + '/', permissionLevel: 'siteOwner' }, { siteUrl: 'sc-domain:' + D, permissionLevel: 'siteFullUser' }, { siteUrl: 'sc-domain:other.example', permissionLevel: 'siteRestrictedUser' }, { siteUrl: 'https://unverified.example/', permissionLevel: 'siteUnverifiedUser' }] });
const gscDenied = () => ({ error: { code: 403, message: 'User does not have sufficient permission for site. See also: https://support.google.com/webmasters/answer/2451999.', status: 'PERMISSION_DENIED' } });
// query, path, current [clicks, impressions, position], previous [clicks, impressions, position]; null = did not appear in that period
const Q = [
  ['erp implementation dubai', '/erp-implementation-dubai/', [40, 900, 6.2], [28, 820, 7.5]],      // winner + striking distance + tracked
  ['erp software uae', '/erp-software-uae/', [55, 2400, 3.1], [52, 2300, 3.4]],                    // CTR gap (2.3% at #3)
  ['e invoicing software uae', '/e-invoicing-uae/', [12, 500, 9.8], [20, 520, 4.1]],              // loser + tracked + slipped 5+ places
  ['northwind erp login', '/login/', [90, 120, 1.0], [88, 118, 1.0]],                              // brand, tracked
  ['erp for distributors', '/erp-for-distributors/', [8, 260, 14.5], [3, 200, 18.2]],              // striking distance
  ['peppol uae', '/peppol-uae/', [0, 45, 24.0], null],                                             // new query
  ['erp cost dubai', '/erp-pricing/', [3, 80, 12.0], [2, 70, 13.0]],
  ['sap vs oracle uae', '/blog/sap-vs-oracle/', [6, 300, 7.0], [14, 320, 6.5]],
  ['e invoicing in uae', '/e-invoicing-in-uae/', [2, 140, 18.0], [1, 90, 25.0]],                   // ladder head
  ['uae e invoicing penalties', '/uae-e-invoicing-penalties/', [0, 30, 35.0], null],
  ['erp implementation checklist', '/blog/erp-checklist/', [9, 410, 8.8], [8, 390, 9.0]],
  ['wms uae', '/wms-uae/', [4, 150, 11.0], [4, 140, 11.5]],
  ['old erp guide', '/blog/old-guide/', [5, 200, 9.0], [30, 600, 5.0]],                           // decaying page
  ['dynamics 365 partner dubai', '/dynamics-365/', null, [9, 150, 8.0]]                            // lost query
];
const row = (keys, c, im, p) => ({ keys, clicks: c, impressions: im, ctr: im ? +(c / im).toFixed(4) : 0, position: p });
const days = (from, to) => { const out = []; for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10)); return out; };
const gscResponse = (req) => {
  const b = req.body || {}; const k = req.kind;
  if (k === 'by_date') { const ds = days(b.startDate, b.endDate); const curStart = ds[ds.length - 28]; return { rows: ds.map((d, i) => { const c = (d >= curStart ? 15 : 12) + (i % 3); return row([d], c, c * 30, d >= curStart ? 7.9 : 8.5); }), responseAggregationType: 'byProperty' }; }
  if (k === 'yoy') return { rows: [row([], 300, 9000, 9.1)] };
  if (k === 'queries_cur') return { rows: Q.filter(q => q[2]).map(q => row([q[0], HOST + q[1]], ...q[2])) };
  if (k === 'queries_prev') return { rows: Q.filter(q => q[3]).map(q => row([q[0]], ...q[3])) };
  if (k === 'pages_cur' || k === 'pages_prev') { const idx = k === 'pages_cur' ? 2 : 3; const m = new Map(); for (const q of Q) { if (!q[idx]) continue; const u = HOST + q[1]; const a = m.get(u) || { c: 0, im: 0, pw: 0 }; a.c += q[idx][0]; a.im += q[idx][1]; a.pw += q[idx][2] * q[idx][1]; m.set(u, a); } return { rows: [...m].map(([u, a]) => row([u], a.c, a.im, a.im ? +(a.pw / a.im).toFixed(1) : 0)) }; }
  if (k === 'kw_cur' || k === 'kw_prev') { const idx = k === 'kw_cur' ? 2 : 3; const q = Q.find(x => x[0] === req.keyword); return { rows: q && q[idx] ? [row([HOST + q[1]], ...q[idx])] : [] }; }
  return { rows: [] };
};
const ga4Accounts = () => ({ accountSummaries: [{ name: 'accountSummaries/1', account: 'accounts/1', displayName: 'Northwind', propertySummaries: [{ property: 'properties/111', displayName: 'Northwind app', propertyType: 'PROPERTY_TYPE_ORDINARY', parent: 'accounts/1' }, { property: 'properties/222', displayName: 'Northwind ERP website', propertyType: 'PROPERTY_TYPE_ORDINARY', parent: 'accounts/1' }] }] });
const ga4Streams = (req) => req.property === 'properties/222'
  ? { dataStreams: [{ name: 'properties/222/dataStreams/9', type: 'WEB_DATA_STREAM', displayName: 'Web', webStreamData: { measurementId: 'G-XXXX', defaultUri: HOST } }] }
  : { dataStreams: [{ name: 'properties/111/dataStreams/1', type: 'WEB_DATA_STREAM', displayName: 'App site', webStreamData: { measurementId: 'G-YYYY', defaultUri: 'https://app.other.example' } }] };
const MH = [{ name: 'sessions', type: 'TYPE_INTEGER' }, { name: 'engagedSessions', type: 'TYPE_INTEGER' }, { name: 'keyEvents', type: 'TYPE_FLOAT' }, { name: 'totalUsers', type: 'TYPE_INTEGER' }];
const H = (names) => names.map(name => ({ name }));
const mv = (...vals) => vals.map(v => ({ value: String(v) }));
const ga4Report = (req) => {
  if (req.kind === 'channels') { const ch = [['Organic Search', [420, 300, 12, 380], [350, 240, 9, 320]], ['Direct', [200, 120, 5, 180], [210, 130, 6, 190]], ['Paid Search', [90, 60, 4, 85], [100, 70, 5, 95]], ['Referral', [40, 25, 1, 38], [35, 20, 1, 33]]];
    return { dimensionHeaders: H(['sessionDefaultChannelGroup', 'dateRange']), metricHeaders: MH, rows: ch.flatMap(c => [{ dimensionValues: mv(c[0], 'current'), metricValues: mv(...c[1]) }, { dimensionValues: mv(c[0], 'previous'), metricValues: mv(...c[2]) }]), rowCount: 8, kind: 'runReport' }; }
  if (req.kind === 'landing') { const lp = [['/erp-implementation-dubai/', [150, 110, 6, 140], [100, 70, 4, 95]], ['/', [120, 80, 3, 110], [125, 85, 3, 115]], ['/e-invoicing-uae/', [60, 45, 2, 55], [80, 60, 2, 75]], ['/blog/old-guide/', [20, 10, 0, 19], [45, 30, 0, 44]]];
    return { dimensionHeaders: H(['landingPage', 'dateRange']), metricHeaders: MH, rows: lp.flatMap(c => [{ dimensionValues: mv(c[0], 'current'), metricValues: mv(...c[1]) }, { dimensionValues: mv(c[0], 'previous'), metricValues: mv(...c[2]) }]), rowCount: 8, kind: 'runReport' }; }
  if (req.kind === 'daily') { const ds = days(req.body.dateRanges[0].startDate, req.body.dateRanges[0].endDate); return { dimensionHeaders: H(['date']), metricHeaders: MH, rows: ds.map((d, i) => ({ dimensionValues: mv(d.replace(/-/g, '')), metricValues: mv(12 + (i % 4), 8, i % 7 === 0 ? 1 : 0, 11) })), rowCount: ds.length, kind: 'runReport' }; }
  return { rows: [], kind: 'runReport' };
};
const inspection = (req) => { const u = req.body.inspectionUrl; const indexed = !/erp-for-distributors|penalties|requirements/.test(u);   // the published blog page is not indexed yet
  return { inspectionResult: { inspectionResultLink: 'https://search.google.com/search-console/inspect?resource_id=sc-domain:' + D, indexStatusResult: { verdict: indexed ? 'PASS' : 'NEUTRAL', coverageState: indexed ? 'Submitted and indexed' : 'Discovered - currently not indexed', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', ...(indexed ? { lastCrawlTime: '2026-09-27T10:11:12Z', pageFetchState: 'SUCCESSFUL', googleCanonical: u, userCanonical: u } : { pageFetchState: 'PAGE_FETCH_STATE_UNSPECIFIED' }), crawledAs: 'MOBILE' } } }; };
const trends = (req) => { const kw = req.body[0].keywords[0]; const rising = /e invoicing/.test(kw); const sparse = /login/.test(kw);
  const pts = Array.from({ length: 52 }, (_, i) => { const d = new Date(Date.UTC(2025, 9, 5) + i * 7 * 864e5).toISOString().slice(0, 10); const base = 40 + Math.round(20 * Math.sin(i / 8)); const v = sparse ? (i % 13 === 0 ? 100 : 0) : rising ? (i >= 48 ? 90 + (i - 48) * 2 : base) : base; return { date_from: d, date_to: d, timestamp: Math.floor(Date.UTC(2025, 9, 5) / 1000) + i * 7 * 86400, missing_data: false, values: [v] }; });
  return { version: '0.1.2026', status_code: 20000, status_message: 'Ok.', cost: 0.0012, tasks: [{ id: 'x', status_code: 20000, status_message: 'Ok.', cost: 0.0012, result: [{ keywords: [kw], type: 'web', location_code: 2784, language_code: 'en', check_url: 'https://trends.google.com/trends/explore', items: [
    { position: 1, type: 'google_trends_graph', title: 'Interest over time', keywords: [kw], data: pts, averages: [50] },
    { position: 2, type: 'google_trends_queries_list', title: 'Related queries', keywords: [kw], data: { top: [{ query: kw + ' uae', value: '100' }, { query: kw + ' software', value: '60' }], rising: [{ query: kw + ' 2026', value: 'Breakout' }, { query: kw + ' fta', value: '+450%' }] } }] }] }] }; };
// a live published page (for Publish Check): status + headers + html body, as the HTTP node returns with fullResponse
const publishedPage = (url, kw, o = {}) => { const title = o.title == null ? (kw.replace(/\b\w/g, c => c.toUpperCase()) + ' | Northwind ERP') : o.title; const body = Array.from({ length: o.words == null ? 900 : o.words }, (_, i) => 'word' + (i % 50)).join(' ');
  const imgs = o.noImages ? '' : [1, 2, 3].map(i => '<figure><img src="' + (o.genericNames ? 'https://www.northwind-erp.com/wp-content/uploads/IMG_20' + i + '0.jpg' : 'https://www.northwind-erp.com/images/' + kw.replace(/\s+/g, '-') + '-' + i + '.webp') + '"' + (o.noAlt ? '' : ' alt="' + kw + ' step ' + i + ' explained"') + (o.noDims ? '' : ' width="1000" height="600"') + ' loading="lazy"></figure>').join('');
  const html = '<!DOCTYPE html><html><head><title>' + title + '</title>' + (o.noImages ? '' : '<meta property="og:image" content="https://www.northwind-erp.com/images/' + kw.replace(/\s+/g, '-') + '-1.webp">') + (o.noDesc ? '' : '<meta name="description" content="' + (o.desc || ('Everything about ' + kw + ' for UAE companies: requirements, costs, timelines and a practical checklist to get started.')) + '">') + (o.canonical === undefined ? '<link rel="canonical" href="' + url + '">' : (o.canonical ? '<link rel="canonical" href="' + o.canonical + '">' : '')) + (o.noindex ? '<meta name="robots" content="noindex">' : '') + '</head><body><nav>Home About</nav>' + (o.noH1 ? '' : '<h1>' + kw + ' explained</h1>') + imgs + '<p>' + body + '</p>' + (o.noSchema ? '' : '<script type="application/ld+json">{"@type":"FAQPage"}</script>') + '</body></html>';
  return { statusCode: o.status == null ? 200 : o.status, statusMessage: 'OK', headers: { 'content-type': 'text/html; charset=utf-8', ...(o.xRobots ? { 'x-robots-tag': o.xRobots } : {}) }, data: html }; };   // `data`, as the HTTP node returns text live
// audit: Search Console sitemaps list + search analytics / inspection answers for the audit requests
const gscSitemaps = (o = {}) => ({ sitemap: o.none ? [] : [{ path: HOST + '/sitemap.xml', lastSubmitted: '2026-08-01T10:00:00.000Z', isPending: !!o.pending, isSitemapsIndex: true, lastDownloaded: o.stale ? '2026-07-01T10:00:00.000Z' : '2026-09-28T10:00:00.000Z', warnings: String(o.warnings || 0), errors: String(o.errors || 0), contents: [{ type: 'web', submitted: '48', indexed: '0' }] }] });
const gscAuditResponse = (req) => {
  if (req.kind === 'inspect') return inspection(req);
  if (req.kind === 'totals') return { rows: [row([], 120, 9000, 8.4)] };
  if (req.kind === 'pages') return { rows: [row([HOST + '/'], 60, 3000, 5.1), row([HOST + '/erp-implementation-dubai/'], 30, 2000, 6.5), row([HOST + '/never-clicked/'], 0, 300, 15), row([HOST + '/shown-1/'], 2, 100, 20), row([HOST + '/shown-2/'], 1, 80, 22), row([HOST + '/shown-3/'], 1, 60, 25)] };
  if (req.kind === 'queries') return { rows: Q.filter(q => q[2]).map(q => row([q[0]], ...q[2])) };
  return { rows: [] };
};
// Search Console notification mails as the IMAP trigger (simple format) delivers them, and a Pages-report export
const consoleMail = (kind) => { const base = { from: 'Google Search Console Team <sc-noreply@google.com>', date: '2026-09-28T07:12:00.000Z', metadata: { 'message-id': '<' + kind + '-2026-09-28@google.com>' } };
  if (kind === 'manual') return { ...base, subject: 'Manual action on https://northwind-erp.com/: Unnatural links to your site', textPlain: 'Search Console has detected that some of the links pointing to your site may be manipulative. Manual action: unnatural links. Learn more.' };
  if (kind === 'security') return { ...base, subject: 'Security issues detected on sc-domain:northwind-erp.com', textPlain: 'Google has detected that some pages on your site may be hacked. Hacked content detected. Review the security issues report.' };
  if (kind === 'coverage') return { ...base, subject: 'New reasons preventing your pages from being indexed on https://northwind-erp.com/', textPlain: 'Search Console has identified new reasons that pages on your site are not being indexed: Crawled - currently not indexed. 12 affected pages.' };
  if (kind === 'cwv') return { ...base, subject: 'Core Web Vitals issues detected on https://northwind-erp.com/', textPlain: 'Mobile: LCP issue: longer than 2.5s. 8 affected URLs.' };
  if (kind === 'summary') return { ...base, subject: 'Your monthly Search Console summary for https://northwind-erp.com/', textPlain: 'Top queries this month …' };
  return { from: 'newsletter@example.com', subject: 'Weekly deals', textPlain: 'Buy now', date: '2026-09-28T07:12:00.000Z', metadata: { 'message-id': '<x@example.com>' } }; };
const pagesExportCsv = () => '﻿Reason,Source,Validation,Trend,Pages\n"Discovered - currently not indexed",Google systems,Not started,Up,"1,204"\n"Crawled - currently not indexed",Google systems,Not started,Flat,37\n"Page with redirect",Website,N/A,Flat,9\n"Excluded by \'noindex\' tag",Website,N/A,Flat,4\n';
module.exports = { consoleMail, pagesExportCsv, gscSitemaps, gscAuditResponse, publishedPage, D, HOST, sitesRows, gscSites, gscDenied, gscResponse, ga4Accounts, ga4Streams, ga4Report, inspection, trends, Q, days };
