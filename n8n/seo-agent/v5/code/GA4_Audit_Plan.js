// B5-12 (2026-10-16, benchmark area 5; Conductor weights an issue by page views and conversion rate): the audit's impact weight has used
// Search Console clicks and impressions only, and for a lead-generation site an impression is a weak proxy for value. When the audit
// request names the site's GA4 property (the app passes it from the site's settings), ask GA4 for the key events of the organic landing
// pages over the last 28 complete days (free, Google quota; the same service account as Search Console). Nothing here is paid.
// No property id = no request, and *GA4 Key Events* says so; the fix list is then weighted by clicks and impressions, and says that.
const prev = $input.first().json || {};
let base = {}; try { base = $('Check Crawl').first().json || {}; } catch (e) {}
const pid = String(prev.ga4_property_id || base.ga4_property_id || '').replace(/^properties\//, '').replace(/[^0-9]/g, '').slice(0, 16);
if (!pid) return [{ json: { skip: true, reason: 'no GA4 property id came with this audit request, so the fix list is weighted by Search Console clicks and impressions' } }];
const day = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 86400000), start = new Date(end.getTime() - 27 * 86400000);
const ORGANIC = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } };
return [{ json: { skip: false, ga4_property_id: pid, period: { start: day(start), end: day(end), days: 28 },
  url: 'https://analyticsdata.googleapis.com/v1beta/properties/' + pid + ':runReport',
  body: { dateRanges: [{ startDate: day(start), endDate: day(end) }], dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'keyEvents' }, { name: 'sessions' }],
    dimensionFilter: ORGANIC, orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }], limit: 250, metricAggregations: ['TOTAL'] } } }];
