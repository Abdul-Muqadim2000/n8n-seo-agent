// Index coverage: what a finished Google core or spam update did to each website's pages (DESIGN §1.9). Seven days after an update completes,
// and once Search Console's data covers at least seven days after it, the same number of days before and after are read by page (two requests
// per update and website; at most two updates a website a run). Repeated as more days arrive, up to 28 days after; never for an update still
// rolling out.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const now = Date.now();
const grab = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const events = (grab('Google Events')[0] || {}).events || [];
const stored = grab('Load Update Impact');
const sites = grab('Index Sites').filter(s => s.site_id && s.gsc_connected);
const diag = grab('Index Diagnose').filter(x => x.site_id && !x.failed);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const out = [];
for (const s of sites) {
  if (!diag.some(x => x.site_id === s.site_id)) continue;
  for (const due of IX.impactDue(events, stored, s.site_id, now).slice(0, 2)) {
    const w = due.windows;
    for (const side of ['before', 'after']) out.push({ json: { site_id: s.site_id, event_id: due.event.event_id, side, windows: w,
      url: API + encodeURIComponent(s.gsc_property) + '/searchAnalytics/query',
      body: { startDate: w[side + '_from'], endDate: w[side + '_to'], dimensions: ['page'], type: 'web', dataState: 'final', rowLimit: 25000 } } });
  }
}
return out.length ? out : [{ json: { skip: true, reason: 'no update to compare' } }];
