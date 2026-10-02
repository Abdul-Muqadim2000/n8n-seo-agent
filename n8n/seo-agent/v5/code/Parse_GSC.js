// Consolidates the Search Analytics responses per site: totals for both periods and a year ago, daily clicks, query movers
// (winners, losers, new, lost), striking-distance queries, CTR gaps, page movers and decaying pages, tracked keyword positions.
const reqs = $('GSC Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const sites = $('Resolve Properties').all().map(i => i.json);
const EXPECTED_CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.035, 0.03, 0.025];   // typical organic CTR by position (industry averages)
const rowsOf = (r) => (r && Array.isArray(r.rows)) ? r.rows.map(x => ({ keys: x.keys || [], clicks: Number(x.clicks) || 0, impressions: Number(x.impressions) || 0, ctr: Number(x.ctr) || 0, position: Number(x.position) || 0 })) : [];
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
const errOf = gErr;
const sum = (rows) => { const t = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, pw: a.pw + r.position * r.impressions }), { clicks: 0, impressions: 0, pw: 0 }); return { clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0, position: t.impressions ? +(t.pw / t.impressions).toFixed(1) : 0 }; };
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const acc = new Map();
reqs.forEach((q, i) => {
  if (q.skip) return;
  if (!acc.has(q.site_idx)) acc.set(q.site_idx, { site_idx: q.site_idx, site_id: q.site_id, errors: [], by_date: [], yoy: null, queries_cur: [], queries_prev: [], pages_cur: [], pages_prev: [], kw: {} });
  const a = acc.get(q.site_idx); const r = res[i]; const e = errOf(r);
  if (e) { a.errors.push(q.kind + (q.keyword ? ' "' + q.keyword + '"' : '') + ': ' + e); return; }
  const rows = rowsOf(r);
  if (q.kind === 'kw_cur' || q.kind === 'kw_prev') { const k = a.kw[q.keyword] || (a.kw[q.keyword] = { keyword: q.keyword, cur: null, prev: null }); const top = [...rows].sort((x, y) => y.impressions - x.impressions)[0]; k[q.kind === 'kw_cur' ? 'cur' : 'prev'] = { ...sum(rows), page: top ? top.keys[0] : '' }; }
  else if (q.kind === 'yoy') a.yoy = sum(rows);
  else a[q.kind] = rows;
});
const out = [];
for (const a of acc.values()) {
  const s = sites[a.site_idx] || {}; const R = s.ranges || {}; const cfg = s.config || {};
  const inR = (d, r) => !!r && d >= r.start && d <= r.end;
  const daily = a.by_date.map(r => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const cur = sum(a.by_date.filter(r => inR(r.keys[0], R.current))), prev = sum(a.by_date.filter(r => inR(r.keys[0], R.previous)));
  // queries: current rows are query x page -> one row per query with its strongest page
  const qmap = new Map();
  for (const r of a.queries_cur) { const q = r.keys[0]; const m = qmap.get(q) || { query: q, rows: [], page: '', pageImp: -1 }; m.rows.push(r); if (r.impressions > m.pageImp) { m.pageImp = r.impressions; m.page = r.keys[1] || ''; } qmap.set(q, m); }
  const prevQ = new Map(a.queries_prev.map(r => [r.keys[0], r]));
  const queries = [...qmap.values()].map(m => { const t = sum(m.rows); const p = prevQ.get(m.query); return { query: m.query, page: m.page, ...t, prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, prev_position: p ? +p.position.toFixed(1) : 0, clicks_delta: t.clicks - (p ? p.clicks : 0), position_delta: (p && p.position > 0 && t.position > 0) ? +(p.position - t.position).toFixed(1) : null }; }).sort((x, y) => y.impressions - x.impressions);
  const lost = [...prevQ.values()].filter(p => p.clicks >= 5 && !qmap.has(p.keys[0])).map(p => ({ query: p.keys[0], prev_clicks: p.clicks, prev_position: +p.position.toFixed(1) })).sort((x, y) => y.prev_clicks - x.prev_clicks).slice(0, 10);
  const winners = queries.filter(q => q.clicks_delta >= 5 && q.prev_clicks > 0 && q.clicks_delta / q.prev_clicks >= 0.3).sort((x, y) => y.clicks_delta - x.clicks_delta).slice(0, 10);
  const losers = queries.filter(q => q.clicks_delta <= -5 && q.prev_clicks > 0 && -q.clicks_delta / q.prev_clicks >= 0.3).sort((x, y) => x.clicks_delta - y.clicks_delta).slice(0, 10);
  const brandKey = String(s.domain || '').split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');   // 'techand' matches 'techand', 'tech and', 'techand ai' (live finding 2026-10-02)
  const isBrand = (q) => brandKey.length >= 4 && String(q).toLowerCase().replace(/[^a-z0-9]/g, '').includes(brandKey);
  const newQ = queries.filter(q => !prevQ.has(q.query) && q.impressions >= 20 && !isBrand(q.query)).slice(0, 10);
  const striking = queries.filter(q => q.position >= 4 && q.position <= 20 && q.impressions >= (cfg.striking_min_impressions || 30) && !isBrand(q.query)).slice(0, 15);
  const ctrGaps = queries.filter(q => q.position > 0 && q.position <= 10 && q.impressions >= (cfg.ctr_gap_min_impressions || 100) && !isBrand(q.query)).map(q => ({ ...q, expected_ctr: EXPECTED_CTR[Math.max(0, Math.min(9, Math.round(q.position) - 1))] })).filter(q => q.ctr < q.expected_ctr * 0.5).sort((x, y) => (y.impressions * (y.expected_ctr - y.ctr)) - (x.impressions * (x.expected_ctr - x.ctr))).slice(0, 10);
  const prevP = new Map(a.pages_prev.map(r => [r.keys[0], r]));
  const pages = a.pages_cur.map(r => { const p = prevP.get(r.keys[0]); return { page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: +r.position.toFixed(1), prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, clicks_delta: r.clicks - (p ? p.clicks : 0) }; }).sort((x, y) => y.clicks - x.clicks);
  const decaying = pages.filter(p => p.prev_clicks >= 10 && -p.clicks_delta / p.prev_clicks * 100 >= (cfg.decay_drop_pct || 25)).sort((x, y) => x.clicks_delta - y.clicks_delta).slice(0, 10);
  const rising = pages.filter(p => p.clicks_delta >= 5 && (p.prev_clicks === 0 || p.clicks_delta / p.prev_clicks >= 0.3)).sort((x, y) => y.clicks_delta - x.clicks_delta).slice(0, 10);
  const tracked = Object.values(a.kw).map(k => ({ keyword: k.keyword, position: k.cur && k.cur.impressions ? k.cur.position : 0, prev_position: k.prev && k.prev.impressions ? k.prev.position : 0, clicks: k.cur ? k.cur.clicks : 0, impressions: k.cur ? k.cur.impressions : 0, prev_clicks: k.prev ? k.prev.clicks : 0, prev_impressions: k.prev ? k.prev.impressions : 0, ctr: k.cur ? k.cur.ctr : 0, page: k.cur ? k.cur.page : '' }));
  out.push({ json: { site_idx: a.site_idx, site_id: a.site_id, errors: a.errors, totals: { cur, prev, yoy: a.yoy || null },
    deltas: { clicks_pct: pct(cur.clicks, prev.clicks), impressions_pct: pct(cur.impressions, prev.impressions), position: (prev.position && cur.position) ? +(prev.position - cur.position).toFixed(1) : null, ctr_pts: +((cur.ctr - prev.ctr) * 100).toFixed(2), yoy_clicks_pct: a.yoy ? pct(cur.clicks, a.yoy.clicks) : null },
    daily, query_count: queries.length, queries: queries.slice(0, 100), winners, losers, new_queries: newQ, lost_queries: lost, striking, ctr_gaps: ctrGaps, pages: pages.slice(0, 20), decaying_pages: decaying, rising_pages: rising, tracked } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no Search Console data came back' } }];
