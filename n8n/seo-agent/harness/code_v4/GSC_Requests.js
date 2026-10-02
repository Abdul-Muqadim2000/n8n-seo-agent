// Search Analytics requests per connected site: clicks by day for 56 days, the same 28 days a year ago, top queries (with page) and
// pages for both periods, and every tracked keyword as an exact query (with the ranking page) for both periods. All free (Google quota).
const sites = $('Resolve Properties').all().map(i => i.json);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const out = [];
sites.forEach((s, idx) => {
  if (!s.gsc_connected) return;
  const base = API + encodeURIComponent(s.gsc_property) + '/searchAnalytics/query';
  const R = s.ranges; const cfg = s.config || {};
  const req = (kind, body, extra) => out.push({ json: { site_idx: idx, site_id: s.site_id, kind, url: base, body: { type: 'web', dataState: 'final', ...body }, ...(extra || {}) } });
  req('by_date', { startDate: R.previous.start, endDate: R.current.end, dimensions: ['date'], rowLimit: 100 });
  req('yoy', { startDate: R.yoy.start, endDate: R.yoy.end, rowLimit: 1 });
  req('queries_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['query', 'page'], rowLimit: 500 });
  req('queries_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['query'], rowLimit: 500 });
  req('pages_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['page'], rowLimit: 100 });
  req('pages_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['page'], rowLimit: 100 });
  (s.tracked || []).slice(0, cfg.max_gsc_keyword_requests || 30).forEach(t => {
    const f = { dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: t.keyword }] }] };
    req('kw_cur', { startDate: R.current.start, endDate: R.current.end, dimensions: ['page'], rowLimit: 5, ...f }, { keyword: t.keyword });
    req('kw_prev', { startDate: R.previous.start, endDate: R.previous.end, dimensions: ['page'], rowLimit: 5, ...f }, { keyword: t.keyword });
  });
});
return out.length ? out : [{ json: { skip: true, reason: 'no site is connected to Search Console' } }];
