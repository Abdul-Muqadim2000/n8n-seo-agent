// Resolves the Search Console property for the audited domain and builds the requests: search performance for the last 28 days
// (totals, top pages, top queries) and one URL inspection per sampled page. Skips everything when the service account has no access.
const plan = $('GSC Audit Plan').first().json;
const res = ($input.first() || {}).json || {};
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };
const hostOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const d = plan.domain;
const entries = Array.isArray(res.siteEntry) ? res.siteEntry.filter(e => e.siteUrl && e.permissionLevel !== 'siteUnverifiedUser') : [];
const pick = entries.find(e => e.siteUrl === 'sc-domain:' + d) || entries.filter(e => /^https?:\/\//.test(e.siteUrl) && (hostOf(e.siteUrl) === d || hostOf(e.siteUrl).endsWith('.' + d))).sort((a, b) => (a.siteUrl.startsWith('https') ? 0 : 1) - (b.siteUrl.startsWith('https') ? 0 : 1))[0] || null;
const error = res.error ? gErr(res) : (Array.isArray(res.siteEntry) ? null : 'no answer from the Search Console API');
if (!pick) return [{ json: { skip: true, connected: false, property: '', permission: '', error: error || ('the service account has no access to a Search Console property for ' + d + (entries.length ? ' (it can see: ' + entries.map(e => e.siteUrl).slice(0, 5).join(', ') + ')' : '')) } }];
const property = pick.siteUrl; const base = 'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(property);
const R = plan.range; const out = [];
const req = (kind, url, body, extra) => out.push({ json: { kind, url, body, property, permission: pick.permissionLevel, sitemaps_url: base + '/sitemaps', connected: true, ...(extra || {}) } });
req('totals', base + '/searchAnalytics/query', { startDate: R.start, endDate: R.end, type: 'web', dataState: 'final', rowLimit: 1 });
req('pages', base + '/searchAnalytics/query', { startDate: R.start, endDate: R.end, type: 'web', dataState: 'final', dimensions: ['page'], rowLimit: 200 });
req('queries', base + '/searchAnalytics/query', { startDate: R.start, endDate: R.end, type: 'web', dataState: 'final', dimensions: ['query'], rowLimit: 100 });
for (const u of plan.sample) req('inspect', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: u, siteUrl: property, languageCode: 'en-US' }, { inspect_url: u });
return out;
