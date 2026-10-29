// Index coverage: Search Console's pages with web impressions over the last 90 days, by page AND day, in ONE request per website (25,000 rows,
// final data). A page with impressions in the last 28 days of data was in Google's index then (DESIGN §1.3); no impressions proves nothing.
// The same rows give the last day with impressions and the "lost every impression in the last 14 days" signal of a possible drop-out.
const S = (v) => String(v == null ? '' : v).trim();
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const day = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const out = sites.map(s => ({ json: { site_id: s.site_id, url: API + encodeURIComponent(s.gsc_property) + '/searchAnalytics/query',
  body: { startDate: day(90), endDate: day(1), dimensions: ['page', 'date'], type: 'web', dataState: 'final', rowLimit: 25000 } } }));
return out.length ? out : [{ json: { skip: true, reason: 'no website with Search Console access' } }];
