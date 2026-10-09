// AI referral traffic from GA4 (v4.9; free, Google quota): what the AI answers are worth. For each site with a GA4 property (given at registration
// or detected by the Site Tracker and stored in seo_sites) four Data API reports, last 28 complete days vs the 28 before: visits, engaged visits,
// key events and revenue per AI assistant (referrer host, or GA4's own "ai-assistant" medium since May 2026), AI landing pages, AI visits by day
// (12 weeks) and all channels (to compare AI visitors with organic ones). Google AI Overviews and AI Mode cannot be told apart from Organic Search
// in GA4; Search Console counts them. The service account needs Viewer access to the property (the Site Tracker's connect step).
const AI_SOURCE_RE = 'chatgpt|openai|perplexity|gemini\\.google|bard\\.google|copilot|edgeservices\\.bing|claude\\.ai|anthropic|deepseek|grok\\.com|meta\\.ai|you\\.com|poe\\.com|phind|mistral|kagi|felo\\.ai|duck\\.ai';
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && p.ga4_property_id);
if (!plans.length) return [{ json: { skip: true, reason: 'no GA4 property on file (connect GA4 through "Track my site"; the Site Tracker stores the property it detects)' } }];
const day = (d) => d.toISOString().slice(0, 10); const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const end = addDays(new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), -1);
const cur = { startDate: day(addDays(end, -27)), endDate: day(end), name: 'current' }, prev = { startDate: day(addDays(end, -55)), endDate: day(addDays(end, -28)), name: 'previous' };
const AI = { orGroup: { expressions: [{ filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'PARTIAL_REGEXP', value: AI_SOURCE_RE, caseSensitive: false } } }, { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', value: 'ai-assistant' } } }] } };
const MET = ['sessions', 'engagedSessions', 'keyEvents', 'totalRevenue', 'totalUsers'].map(name => ({ name }));
const out = [];
for (const p of plans) {
  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + p.ga4_property_id + ':runReport';
  const req = (kind, body) => out.push({ json: { site_id: p.site_id, kind, url, body, period: { start: cur.startDate, end: cur.endDate, prev_start: prev.startDate, prev_end: prev.endDate } } });
  req('ai_sources', { dateRanges: [cur, prev], dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], metrics: MET, dimensionFilter: AI, limit: 100 });
  req('ai_landing', { dateRanges: [cur], dimensions: [{ name: 'landingPage' }], metrics: MET, dimensionFilter: AI, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 25 });
  req('ai_daily', { dateRanges: [{ startDate: day(addDays(end, -83)), endDate: day(end) }], dimensions: [{ name: 'date' }], metrics: MET, dimensionFilter: AI, orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 100 });
  req('channels', { dateRanges: [cur, prev], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: MET, limit: 50 });
}
return out;
