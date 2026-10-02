// Consolidates the GA4 reports per site: organic vs all-channel totals for both periods, organic share, landing pages with deltas, daily organic sessions.
const reqs = $('GA4 Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
const errOf = gErr;
const num = (v) => Number(v) || 0;
const acc = new Map();
reqs.forEach((q, i) => {
  if (q.skip) return;
  if (!acc.has(q.site_idx)) acc.set(q.site_idx, { site_idx: q.site_idx, site_id: q.site_id, ga4_property_id: q.ga4_property_id, ga4_detected: !!q.ga4_detected, ga4_property_name: q.ga4_property_name || '', errors: [], channels: [], landing: [], daily: [] });
  const a = acc.get(q.site_idx); const r = res[i]; const e = errOf(r); if (e) { a.errors.push(q.kind + ': ' + e); return; }
  const dims = (r.dimensionHeaders || []).map(h => h.name); const mets = (r.metricHeaders || []).map(h => h.name);
  a[q.kind] = (r.rows || []).map(row => { const o = {}; dims.forEach((d, j) => o[d] = ((row.dimensionValues || [])[j] || {}).value); mets.forEach((m, j) => o[m] = num(((row.metricValues || [])[j] || {}).value)); return o; });
});
const M = (rows) => rows.reduce((t, r) => ({ sessions: t.sessions + (r.sessions || 0), engaged: t.engaged + (r.engagedSessions || 0), key_events: t.key_events + (r.keyEvents || 0), users: t.users + (r.totalUsers || 0) }), { sessions: 0, engaged: 0, key_events: 0, users: 0 });
const out = [];
for (const a of acc.values()) {
  const cur = a.channels.filter(r => r.dateRange === 'current'), prev = a.channels.filter(r => r.dateRange === 'previous');
  const org = (rows) => M(rows.filter(r => r.sessionDefaultChannelGroup === 'Organic Search'));
  const organic = { cur: org(cur), prev: org(prev) }, total = { cur: M(cur), prev: M(prev) };
  const channels = cur.map(r => ({ channel: r.sessionDefaultChannelGroup, sessions: r.sessions || 0, key_events: r.keyEvents || 0 })).sort((x, y) => y.sessions - x.sessions);
  const lp = new Map();
  for (const r of a.landing) { const k = r.landingPage || '/'; const m = lp.get(k) || { page: k, sessions: 0, prev_sessions: 0, engaged: 0, key_events: 0, prev_key_events: 0 }; if (r.dateRange === 'previous') { m.prev_sessions += r.sessions || 0; m.prev_key_events += r.keyEvents || 0; } else { m.sessions += r.sessions || 0; m.engaged += r.engagedSessions || 0; m.key_events += r.keyEvents || 0; } lp.set(k, m); }
  const landing = [...lp.values()].map(m => ({ ...m, delta: m.sessions - m.prev_sessions })).sort((x, y) => y.sessions - x.sessions).slice(0, 15);
  const daily = a.daily.map(r => ({ date: String(r.date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), sessions: r.sessions || 0, engaged: r.engagedSessions || 0, key_events: r.keyEvents || 0 })).sort((x, y) => x.date.localeCompare(y.date));
  out.push({ json: { site_idx: a.site_idx, site_id: a.site_id, ga4_property_id: a.ga4_property_id, ga4_detected: a.ga4_detected, ga4_property_name: a.ga4_property_name, errors: a.errors, organic, total,
    organic_share: total.cur.sessions ? Math.round(organic.cur.sessions / total.cur.sessions * 100) : 0, channels, landing, daily } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no GA4 data came back' } }];
