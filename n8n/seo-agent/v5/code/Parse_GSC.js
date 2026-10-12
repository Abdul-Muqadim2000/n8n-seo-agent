// Consolidates the Search Analytics responses per site: totals for both periods and a year ago, daily clicks, query movers
// (winners, losers, new, lost), striking-distance queries, CTR gaps, page movers and decaying pages, tracked keyword positions.
// 2026-10-12 (FIX_PLAN G9): every row, not a top-500 sample — the first 25,000-row page of each kind plus the pages GSC More Requests fetched
// are merged here; the queries Search Console withholds are reported as the anonymised share (the period totals minus the sum of the rows);
// brand and non-brand are split with the site model's / seo_monitors' brand names; scraper queries (search operators) are counted apart with
// the same rule the audit uses (GQ, v5/code/_gsc_queries.js, shared with D24 / P1-3) and never shown as customer searches.
/*__GSC_QUERIES__*/
const reqs = $('GSC Requests').all().map(i => i.json);
const res = (() => { try { return $('GSC Query').all().map(i => i.json); } catch (e) { return $input.all().map(i => i.json); } })();
const moreReqs = (() => { try { return $('GSC More Requests').all().map(i => i.json).filter(q => q && !q.skip); } catch (e) { return []; } })();
const moreRes = (() => { try { return $('GSC Query (More)').all().map(i => i.json); } catch (e) { return []; } })();
const sites = $('Resolve Properties').all().map(i => i.json);
const models = (() => { try { return $('Site Model (Site)').all().map(i => i.json).filter(m => m && m.site_id); } catch (e) { return []; } })();
const EXPECTED_CTR = [0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.035, 0.03, 0.025];   // typical organic CTR by position (industry averages)
const rowsOf = (r) => (r && Array.isArray(r.rows)) ? r.rows.map(x => ({ keys: x.keys || [], clicks: Number(x.clicks) || 0, impressions: Number(x.impressions) || 0, ctr: Number(x.ctr) || 0, position: Number(x.position) || 0 })) : [];
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };   // Google errors: the useful text sits in context.data (invalid_grant: account not found) or in error.message (PERMISSION_DENIED)
const errOf = gErr;
const sum = (rows) => { const t = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, pw: a.pw + r.position * r.impressions }), { clicks: 0, impressions: 0, pw: 0 }); return { clicks: t.clicks, impressions: t.impressions, ctr: t.impressions ? +(t.clicks / t.impressions).toFixed(4) : 0, position: t.impressions ? +(t.pw / t.impressions).toFixed(1) : 0 }; };
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const acc = new Map();
const take = (q, r) => {
  if (!q || q.skip) return;
  if (!acc.has(q.site_idx)) acc.set(q.site_idx, { site_idx: q.site_idx, site_id: q.site_id, errors: [], by_date: [], yoy: null, queries_cur: [], queries_prev: [], pages_cur: [], pages_prev: [], kw: {}, paging: {} });
  const a = acc.get(q.site_idx); const e = errOf(r);
  if (e) { a.errors.push(q.kind + (q.keyword ? ' "' + q.keyword + '"' : '') + (q.page > 1 ? ' page ' + q.page : '') + ': ' + e); return; }
  const rows = rowsOf(r);
  if (q.paged) { const pg = a.paging[q.kind] || (a.paging[q.kind] = { pages: 0, rows: 0, page_rows: Number(q.page_rows) || 25000, max_pages: Number(q.max_pages) || 4, truncated: false });
    pg.pages += 1; pg.rows += rows.length; if (q.page >= pg.max_pages && rows.length >= pg.page_rows) pg.truncated = true; }
  if (q.kind === 'kw_cur' || q.kind === 'kw_prev') { const k = a.kw[q.keyword] || (a.kw[q.keyword] = { keyword: q.keyword, cur: null, prev: null }); const top = [...rows].sort((x, y) => y.impressions - x.impressions)[0]; k[q.kind === 'kw_cur' ? 'cur' : 'prev'] = { ...sum(rows), page: top ? top.keys[0] : '' }; }
  else if (q.kind === 'yoy') a.yoy = sum(rows);
  else a[q.kind] = (a[q.kind] || []).concat(rows);   // G9: one kind, several 25,000-row pages
};
reqs.forEach((q, i) => take(q, res[i]));
moreReqs.forEach((q, i) => take(q, moreRes[i]));
const out = [];
for (const a of acc.values()) {
  const s = sites[a.site_idx] || {}; const R = s.ranges || {}; const cfg = s.config || {};
  const inR = (d, r) => !!r && d >= r.start && d <= r.end;
  const daily = a.by_date.map(r => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const cur = sum(a.by_date.filter(r => inR(r.keys[0], R.current))), prev = sum(a.by_date.filter(r => inR(r.keys[0], R.previous)));
  // queries: current rows are query x page -> one row per query with its strongest page
  const qmapAll = new Map();
  for (const r of a.queries_cur) { const q = r.keys[0]; const m = qmapAll.get(q) || { query: q, rows: [], page: '', pageImp: -1 }; m.rows.push(r); if (r.impressions > m.pageImp) { m.pageImp = r.impressions; m.page = r.keys[1] || ''; } qmapAll.set(q, m); }
  // G9 / D24: a query typed by an SEO tool (site:, inurl:, capital booleans) is not a customer search — counted apart, never listed
  const qmap = new Map([...qmapAll.entries()].filter(([q]) => !GQ.isScraper(q)));
  const scraperRows = [...qmapAll.entries()].filter(([q]) => GQ.isScraper(q)).map(([q, m]) => ({ query: q, ...sum(m.rows) })).sort((x, y) => y.impressions - x.impressions);
  const prevQ = new Map(a.queries_prev.filter(r => !GQ.isScraper(r.keys[0])).map(r => [r.keys[0], r]));
  const queries = [...qmap.values()].map(m => { const t = sum(m.rows); const p = prevQ.get(m.query); return { query: m.query, page: m.page, ...t, prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, prev_position: p ? +p.position.toFixed(1) : 0, clicks_delta: t.clicks - (p ? p.clicks : 0), position_delta: (p && p.position > 0 && t.position > 0) ? +(p.position - t.position).toFixed(1) : null }; }).sort((x, y) => y.impressions - x.impressions);
  const lost = [...prevQ.values()].filter(p => p.clicks >= 5 && !qmap.has(p.keys[0])).map(p => ({ query: p.keys[0], prev_clicks: p.clicks, prev_position: +p.position.toFixed(1) })).sort((x, y) => y.prev_clicks - x.prev_clicks).slice(0, 10);
  const winners = queries.filter(q => q.clicks_delta >= 5 && q.prev_clicks > 0 && q.clicks_delta / q.prev_clicks >= 0.3).sort((x, y) => y.clicks_delta - x.clicks_delta).slice(0, 10);
  const losers = queries.filter(q => q.clicks_delta <= -5 && q.prev_clicks > 0 && -q.clicks_delta / q.prev_clicks >= 0.3).sort((x, y) => x.clicks_delta - y.clicks_delta).slice(0, 10);
  // G9 (2026-10-12): brand vs non-brand uses every name of the business (seo_monitors.brand_names and the site model) and the domain label as
  // the fallback ('techand' matches 'techand', 'tech and', 'techand ai'; live finding 2026-10-02)
  const model = (models.find(m => m.site_id === a.site_id) || {}).model || null;
  const brandNames = [...((model && model.brand_names) || []), (model && model.business_name) || '', ...((s.config || {}).brand_names || [])].filter(Boolean);
  const BR = GQ.brandTest(s.domain, brandNames); const isBrand = BR.is;
  const newQ = queries.filter(q => !prevQ.has(q.query) && q.impressions >= 20 && !isBrand(q.query)).slice(0, 10);
  const striking = queries.filter(q => q.position >= 4 && q.position <= 20 && q.impressions >= (cfg.striking_min_impressions || 30) && !isBrand(q.query)).slice(0, 15);
  const ctrGaps = queries.filter(q => q.position > 0 && q.position <= 10 && q.impressions >= (cfg.ctr_gap_min_impressions || 100) && !isBrand(q.query)).map(q => ({ ...q, expected_ctr: EXPECTED_CTR[Math.max(0, Math.min(9, Math.round(q.position) - 1))] })).filter(q => q.ctr < q.expected_ctr * 0.5).sort((x, y) => (y.impressions * (y.expected_ctr - y.ctr)) - (x.impressions * (x.expected_ctr - x.ctr))).slice(0, 10);
  const prevP = new Map(a.pages_prev.map(r => [r.keys[0], r]));
  const pages = a.pages_cur.map(r => { const p = prevP.get(r.keys[0]); return { page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: +r.position.toFixed(1), prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, clicks_delta: r.clicks - (p ? p.clicks : 0) }; }).sort((x, y) => y.clicks - x.clicks);
  const decaying = pages.filter(p => p.prev_clicks >= 10 && -p.clicks_delta / p.prev_clicks * 100 >= (cfg.decay_drop_pct || 25)).sort((x, y) => x.clicks_delta - y.clicks_delta).slice(0, 10);
  const rising = pages.filter(p => p.clicks_delta >= 5 && (p.prev_clicks === 0 || p.clicks_delta / p.prev_clicks >= 0.3)).sort((x, y) => y.clicks_delta - x.clicks_delta).slice(0, 10);
  // ---- G9: what Search Console does not name, and who searched the brand ----
  const anonymised = { current: GQ.anonymised(cur, [...qmapAll.values()].flatMap(m => m.rows)), previous: GQ.anonymised(prev, a.queries_prev) };
  const brandSum = (list, want) => { const picked = list.filter(q => isBrand(q.query) === want); const t = sum(picked.map(q => ({ clicks: q.clicks, impressions: q.impressions, position: q.position }))); return { queries: picked.length, clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, top: picked.slice(0, 5).map(q => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, position: q.position })) }; };
  const prevList = [...prevQ.values()].map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  const brand_split = { names: BR.keys, brand: brandSum(queries, true), non_brand: brandSum(queries, false),
    previous: { brand: brandSum(prevList, true), non_brand: brandSum(prevList, false) },
    note: BR.keys.length ? 'Brand = the query contains ' + BR.keys.join(' / ') + '. Non-brand clicks are the ones SEO wins.' : 'No brand name known for this site: every query counts as non-brand.' };
  brand_split.brand_clicks_pct = cur.clicks ? Math.round(brand_split.brand.clicks / cur.clicks * 1000) / 10 : 0;
  const scraper_queries = { count: scraperRows.length, clicks: scraperRows.reduce((n, q) => n + q.clicks, 0), impressions: scraperRows.reduce((n, q) => n + q.impressions, 0), sample: scraperRows.slice(0, 3).map(q => q.query) };
  const paging = Object.entries(a.paging).map(([kind, pg]) => ({ kind, pages: pg.pages, rows: pg.rows, truncated: pg.truncated }));
  const rows_read = paging.reduce((n, x) => n + x.rows, 0); const truncated = paging.filter(x => x.truncated).map(x => x.kind);
  const tracked = Object.values(a.kw).map(k => ({ keyword: k.keyword, position: k.cur && k.cur.impressions ? k.cur.position : 0, prev_position: k.prev && k.prev.impressions ? k.prev.position : 0, clicks: k.cur ? k.cur.clicks : 0, impressions: k.cur ? k.cur.impressions : 0, prev_clicks: k.prev ? k.prev.clicks : 0, prev_impressions: k.prev ? k.prev.impressions : 0, ctr: k.cur ? k.cur.ctr : 0, page: k.cur ? k.cur.page : '' }));
  out.push({ json: { site_idx: a.site_idx, site_id: a.site_id, errors: a.errors, totals: { cur, prev, yoy: a.yoy || null },
    deltas: { clicks_pct: pct(cur.clicks, prev.clicks), impressions_pct: pct(cur.impressions, prev.impressions), position: (prev.position && cur.position) ? +(prev.position - cur.position).toFixed(1) : null, ctr_pts: +((cur.ctr - prev.ctr) * 100).toFixed(2), yoy_clicks_pct: a.yoy ? pct(cur.clicks, a.yoy.clicks) : null },
    daily, query_count: queries.length, queries: queries.slice(0, 100), winners, losers, new_queries: newQ, lost_queries: lost, striking, ctr_gaps: ctrGaps, pages: pages.slice(0, 20), decaying_pages: decaying, rising_pages: rising, tracked,
    anonymised, brand_split, scraper_queries, page_count: pages.length, rows_read, paging, truncated } });   // G9: every row read, the anonymised share, brand vs non-brand, scraper queries apart
}
return out.length ? out : [{ json: { skip: true, reason: 'no Search Console data came back' } }];
