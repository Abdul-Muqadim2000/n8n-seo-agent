// Index coverage (fix wave 1, X3 / E8 / FIX_CONTRACT decision 7): Search Console's pages with web impressions, by PAGE only (one row per page,
// no date dimension), one request per window (90, 28, 14, 7 days of final data ending 3 days back), 25,000 rows each. A window that answers a
// full page is asked again from row 25,000 (Pages Query More); 50,000 rows a window is the hard stop and the run note says so. The page x day
// query it replaces passed its 25,000-row cap at ~280 pages and zeroed the impressions of exactly the pages this feature is about.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const sites = $('Index Sites').all().map(i => i.json).filter(s => s && s.site_id && s.gsc_connected);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const out = [];
for (const s of sites) for (const w of IX.saWindows(Date.now()))
  out.push({ json: { site_id: s.site_id, days: w.days, start_row: 0, url: API + encodeURIComponent(s.gsc_property) + '/searchAnalytics/query',
    body: { startDate: w.start, endDate: w.end, dimensions: ['page'], type: 'web', dataState: 'final', rowLimit: IX.CFG.sa_rows, startRow: 0 } } });
return out.length ? out : [{ json: { skip: true, reason: 'no website with Search Console access' } }];
