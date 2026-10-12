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
  (s.tracked || []).slice(0, cfg.max_gsc_keyword_requests || 30).forEach(t => {
    const f = { dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: t.keyword }] }] };
    req('kw_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['page'], rowLimit: 5, ...f }, { keyword: t.keyword });
    req('kw_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['page'], rowLimit: 5, ...f }, { keyword: t.keyword });
  });
});
return out.length ? out : [{ json: { skip: true, reason: 'no site is connected to Search Console' } }];
