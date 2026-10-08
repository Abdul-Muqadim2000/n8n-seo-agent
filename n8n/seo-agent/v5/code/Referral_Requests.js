// Links that send people (v4.10, GA4 Data API, free; the service account needs Viewer access to the property — the Site Tracker's connect step):
// every referral source of the past year with visits, engaged visits, key events and revenue (365 days) and the past 28 days, and the exact
// referring pages (pageReferrer, the site's own pages excluded). A referrer that sends visits is a live link, whatever any index says, and
// the visits are the link's referral value. E-mail, chat, search and payment hosts are filtered out later (LK.domainKind).
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.ga4_property_id);
if (!plans.length) return [{ json: { skip: true, reason: 'no GA4 property on file (connect GA4 through "Track my site"; the Site Tracker stores the property it detects)' } }];
const MET = ['sessions', 'engagedSessions', 'keyEvents', 'totalRevenue'].map(name => ({ name }));
const REF = { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: 'referral' } } };
const out = [];
for (const p of plans) {
  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + p.ga4_property_id + ':runReport';
  const notSelf = { notExpression: { filter: { fieldName: 'pageReferrer', stringFilter: { matchType: 'CONTAINS', value: p.domain, caseSensitive: false } } } };
  out.push({ json: { site_id: p.site_id, kind: 'ref_sources', url, body: { dateRanges: [{ startDate: '365daysAgo', endDate: 'yesterday', name: 'year' }, { startDate: '28daysAgo', endDate: 'yesterday', name: 'recent' }], dimensions: [{ name: 'sessionSource' }], metrics: MET, dimensionFilter: REF, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 500 } } });
  out.push({ json: { site_id: p.site_id, kind: 'ref_pages', url, body: { dateRanges: [{ startDate: '365daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'pageReferrer' }, { name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'keyEvents' }], dimensionFilter: { andGroup: { expressions: [REF, notSelf] } }, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 500 } } });
}
return out;
