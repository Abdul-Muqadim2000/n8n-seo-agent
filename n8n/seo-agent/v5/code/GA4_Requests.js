// GA4 Data API reports per site with a property id (given at registration, or detected from the web data stream whose URL matches
// the domain): organic-channel totals for both periods, organic landing pages, organic sessions by day. Free (Google quota).
const sites = $('Resolve Properties').all().map(i => i.json);
let streamReqs = [], streams = []; try { streamReqs = $('Stream Requests').all().map(i => i.json); streams = $('GA4 Streams').all().map(i => i.json); } catch (e) {}
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
let acctErr = ''; try { const a = ($('GA4 Accounts').first() || {}).json || {}; if (a.error) acctErr = gErr(a); } catch (e) {}
const hostOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n Code sandbox (live finding 2026-10-02)
const detect = (domain) => {
  for (let i = 0; i < streams.length; i++) { const r = streams[i]; if (!r || r.error) continue;
    for (const ds of (r.dataStreams || [])) { const h = hostOf(ds.webStreamData && ds.webStreamData.defaultUri); if (h && (h === domain || h.endsWith('.' + domain))) return { id: String(ds.name || (streamReqs[i] || {}).property || '').replace(/^properties\//, '').split('/')[0], name: (streamReqs[i] || {}).displayName || ds.displayName || '' }; } }
  return null;
};
const METRICS = [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'keyEvents' }, { name: 'totalUsers' }];
const ORGANIC = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } };
const out = [];
sites.forEach((s, idx) => {
  const given = String(s.ga4_property_id || '').replace(/^properties\//, '').trim();
  const det = given ? null : detect(s.domain);
  const pid = given || (det ? det.id : '');
  if (!pid) return;
  const R = s.ranges; const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + pid + ':runReport';
  const two = [{ startDate: R.current.start, endDate: R.current.end, name: 'current' }, { startDate: R.previous.start, endDate: R.previous.end, name: 'previous' }];
  const req = (kind, body) => out.push({ json: { site_idx: idx, site_id: s.site_id, kind, url, body, ga4_property_id: pid, ga4_detected: !given, ga4_property_name: det ? det.name : '' } });
  req('channels', { dateRanges: two, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: METRICS, limit: 50 });
  req('landing', { dateRanges: two, dimensions: [{ name: 'landingPage' }], metrics: METRICS, dimensionFilter: ORGANIC, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 40 });
  req('daily', { dateRanges: [{ startDate: R.previous.start, endDate: R.current.end }], dimensions: [{ name: 'date' }], metrics: METRICS, dimensionFilter: ORGANIC, orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 100 });
});
return out.length ? out : [{ json: { skip: true, reason: acctErr ? 'GA4 account list: ' + acctErr : 'no GA4 property id given or detected for any site' } }];
