// Trend per keyword: direction (last 4 weeks vs the 12-month average), latest and peak, related rising / top searches, DataForSEO cost.
const reqs = $('Trends Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
return reqs.filter(q => !q.skip).map((q, i) => {
  const r = res[i] || {}; const task = ((r.tasks || [])[0]) || {}; const result = ((task.result || [])[0]) || {}; const items = result.items || [];
  const err = r.error ? String(r.error.message || r.error).slice(0, 200) : (task.status_code && task.status_code >= 40000 ? 'DataForSEO ' + task.status_code + ' ' + (task.status_message || '') : (items.length ? null : 'no trend data'));
  const graph = items.find(x => x.type === 'google_trends_graph'); const ql = items.find(x => x.type === 'google_trends_queries_list');
  const pts = graph ? (graph.data || []).filter(d => !d.missing_data && Array.isArray(d.values)).map(d => ({ date: d.date_from, value: Number(d.values[0]) || 0 })) : [];
  const avg = pts.length ? pts.reduce((a, p) => a + p.value, 0) / pts.length : 0;
  const last4 = pts.slice(-4); const recent = last4.length ? last4.reduce((a, p) => a + p.value, 0) / last4.length : 0;
  const change = avg > 0 ? Math.round((recent - avg) / avg * 100) : null;
  const peak = pts.length ? pts.reduce((m, p) => p.value > m.value ? p : m, pts[0]) : null;
  // sparse series (mostly zeros, a few spikes: low-volume terms) produce +1000% artefacts (seen live) -> report them as 'sparse', never as rising/falling
  const sparse = pts.length > 0 && (avg < 5 || pts.filter(p => p.value > 0).length < pts.length / 2);
  const direction = change == null ? 'unknown' : sparse ? 'sparse' : change >= 20 ? 'rising' : change <= -20 ? 'falling' : 'stable';
  const list = (arr) => (arr || []).slice(0, 5).map(x => ({ query: x.query, value: String(x.value) }));
  return { json: { site_idx: q.site_idx, site_id: q.site_id, keyword: q.keyword, error: err, direction, change_pct: change, latest: pts.length ? pts[pts.length - 1].value : null, average: Math.round(avg), peak_date: peak ? peak.date : '', peak_value: peak ? peak.value : null,
    points: pts.length, rising: ql ? list((ql.data || {}).rising) : [], top: ql ? list((ql.data || {}).top) : [], cost: Number(task.cost) || 0 } };
});
