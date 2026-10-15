// Search Analytics requests per connected site: clicks by day for 56 days, the same 28 days a year ago, top queries (with page) and
// pages for both periods, and every tracked keyword as an exact query (with the ranking page) for both periods. All free (Google quota).
// 2026-10-12 (FIX_PLAN G9): the query and page rows are read in FULL, not as a top-500 sample. Search Console serves at most 25,000 rows per
// request, so the first page asks for 25,000 and GSC More Requests asks for the next pages (startRow) of any kind that came back full, up to
// `max_gsc_pages` per kind. Everything stays inside Google's free quota (the daily cap is per property, far above a handful of requests).
const sites = $('Resolve Properties').all().map(i => i.json);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const PAGE_ROWS = 25000;   // Search Analytics hard limit per request
const out = [];
sites.forEach((s, idx) => {
  if (!s.gsc_connected) return;
  const base = API + encodeURIComponent(s.gsc_property) + '/searchAnalytics/query';
  const R = s.ranges; const cfg = s.config || {};
  const maxPages = Math.max(1, Math.min(20, Number(cfg.max_gsc_pages) || 4));   // 4 x 25,000 = up to 100,000 rows per kind
  const req = (kind, body, extra) => out.push({ json: { site_idx: idx, site_id: s.site_id, kind, url: base, body: { type: 'web', dataState: 'final', ...body }, paged: false, page: 1, max_pages: maxPages, page_rows: PAGE_ROWS, ...(extra || {}) } });
  const pagedReq = (kind, body) => out.push({ json: { site_idx: idx, site_id: s.site_id, kind, url: base, body: { type: 'web', dataState: 'final', rowLimit: PAGE_ROWS, startRow: 0, ...body }, paged: true, page: 1, max_pages: maxPages, page_rows: PAGE_ROWS } });
  req('by_date', { startDate: R.previous.start, endDate: R.current.end, dimensions: ['date'], rowLimit: 100 });   // the period totals, anonymised queries included (G9 compares the query rows against them)
  req('yoy', { startDate: R.yoy.start, endDate: R.yoy.end, rowLimit: 1 });
  pagedReq('queries_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['query', 'page'] });
  pagedReq('queries_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['query'] });
  pagedReq('pages_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['page'] });
  pagedReq('pages_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['page'] });
  // B4-1 (2026-10-15, benchmark area 4): the same 28 days A YEAR EARLIER, per page. Free, one more request on a quota measured in
  // thousands, and it is the only thing that can tell a decaying page from weeks that are quiet every year — the comparison
  // Clearscope's Content Decay view is built on and the one ours did not have. Search Console keeps 16 months, so it answers today.
  pagedReq('pages_yoy', { startDate: R.yoy.start, endDate: R.yoy.end, dimensions: ['page'] });
  // B7-2 (2026-10-15, benchmark area 7): the device and the country, both periods. The API has answered `device` (DESKTOP / MOBILE /
  // TABLET) and `country` since it existed (https://developers.google.com/webmaster-tools/v1/searchanalytics/query) and we asked for
  // neither, so a site whose mobile clicks halved while desktop held read as one flat "clicks down 18%". Four tiny requests on a free
  // quota measured in thousands — no row paging, because there are three devices and a couple of hundred countries.
  req('device_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['device'], rowLimit: 10 });
  req('device_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['device'], rowLimit: 10 });
  req('country_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['country'], rowLimit: 50 });
  req('country_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['country'], rowLimit: 50 });
  // B7-1 (2026-10-15, benchmark area 7): each dated change gets ITS OWN two windows — the 28 complete days after it and the 28
  // before it — because the report's own 28-v-28 both sit after a change made three months ago and would measure nothing. The whole
  // site's pages come back in each window, so the same two requests carry the page under test AND the control group of every other
  // page, measured over exactly the same days. Free (Google quota), capped at cfg.max_change_tests changes.
  (s.changes || []).filter(c => c && c.readable).slice(0, Math.max(0, Number(cfg.max_change_tests) || 6)).forEach(c => {
    const extra = { test_key: c.key, test_url: c.url, change_date: c.date, change_what: c.what, change_keyword: c.keyword, change_joint: !!c.joint, window_before: c.window_before, window_after: c.window_after };
    req('test_before', { startDate: c.window_before.start, endDate: c.window_before.end, dimensions: ['page'], rowLimit: PAGE_ROWS }, extra);
    req('test_after', { startDate: c.window_after.start, endDate: c.window_after.end, dimensions: ['page'], rowLimit: PAGE_ROWS }, extra);
  });
  (s.tracked || []).slice(0, cfg.max_gsc_keyword_requests || 30).forEach(t => {
    const f = { dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: t.keyword }] }] };
    req('kw_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['page'], rowLimit: 5, ...f }, { keyword: t.keyword });
    req('kw_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['page'], rowLimit: 5, ...f }, { keyword: t.keyword });
  });
});
return out.length ? out : [{ json: { skip: true, reason: 'no site is connected to Search Console' } }];
