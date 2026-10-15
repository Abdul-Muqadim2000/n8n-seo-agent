// Consolidates the Search Analytics responses per site: totals for both periods and a year ago, daily clicks, query movers
// (winners, losers, new, lost), striking-distance queries, CTR gaps, page movers and decaying pages, tracked keyword positions.
// 2026-10-12 (FIX_PLAN G9): every row, not a top-500 sample — the first 25,000-row page of each kind plus the pages GSC More Requests fetched
// are merged here; the queries Search Console withholds are reported as the anonymised share (the period totals minus the sum of the rows);
// brand and non-brand are split with the site model's / seo_monitors' brand names; scraper queries (search operators) are counted apart with
// the same rule the audit uses (GQ, v5/code/_gsc_queries.js, shared with D24 / P1-3) and never shown as customer searches.
// 2026-10-15 (B4-1, benchmark area 4): a decaying page is now a TESTED and SEASONAL judgement (ST.decay), not a 25% threshold.
// ---- shared Search Console query rules (2026-10-12, FIX_PLAN G9 + D24 / P1-3): inlined by the build (the GSC_QUERIES placeholder) into
// Parse GSC (the Site Tracker) and GSC Audit Findings (the audit), so the weekly report and the audit judge a query the same way.
//   * GQ.isScraper(q)  — a query typed by an SEO tool or a scraper, not by a customer (search operators, capital booleans, quoted groups).
//   * GQ.brandTest(..) — brand vs non-brand, from seo_monitors.brand_names / the site model's names, with the domain label as the fallback.
//   * GQ.anonymised(..)— what Search Console withholds: the totals minus the sum of the query rows ("anonymised for privacy").
// D24 (2026-10-11) found scraper queries among techand.ai's top queries; P1-3 (2026-10-12) added the leading minus ("-site:csc.gov.ae") and
// the lower-case booleans Search Console reports. Prose alone never counts: "erp software and accounting for distributors" has no quotes,
// no brackets and no capitals, so it stays a customer query.
const GQ = (() => {
  const OPERATOR = /(^|\s)[-+]?(site|inurl|intitle|intext|inanchor|allintitle|allinurl|allintext|filetype|ext|related|cache|link|before|after|daterange):\S/i;
  const BOOL_CAPS = /(^|[\s")])(AND|OR|\|)([\s("]|$)/;
  const BOOL_ANY = /(^|[\s")])(and|or|\|)([\s("]|$)/i;
  const GROUPED = /"[^"]+"|\([^)]+\)/;   // a quoted phrase or a bracketed group
  const isScraper = (q) => { const s = String(q || ''); return OPERATOR.test(s) || BOOL_CAPS.test(s) || (GROUPED.test(s) && BOOL_ANY.test(s)); };
  const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // every brand form worth matching: the monitor / model names, the business name and the domain's label ('techand' matches 'tech and', 'techand ai')
  const brandKeys = (domain, names) => {
    const keys = [];
    const push = (x) => { const k = squash(x); if (k.length >= 4 && !keys.includes(k)) keys.push(k); };
    push(String(domain || '').split('.')[0]);
    for (const n of (names || [])) { const s = String(n || '').trim(); if (!s) continue; push(/\./.test(s) ? s.split('.')[0] : s); }
    return keys;
  };
  // a query is a brand query when a brand key appears in it as one run of letters/digits
  const brandTest = (domain, names) => { const keys = brandKeys(domain, names); const is = (q) => { const s = squash(q); return keys.some(k => s.includes(k)); }; return { keys, is: keys.length ? is : () => false }; };
  // Search Console never names the queries of rare searches: the dimensionless/date totals hold them, the query rows do not
  const anonymised = (totals, rows) => {
    const t = totals || {}; const sum = (rows || []).reduce((a, r) => ({ clicks: a.clicks + (Number(r.clicks) || 0), impressions: a.impressions + (Number(r.impressions) || 0) }), { clicks: 0, impressions: 0 });
    const ti = Number(t.impressions) || 0, tc = Number(t.clicks) || 0;
    const im = Math.max(0, ti - sum.impressions), cl = Math.max(0, tc - sum.clicks);
    return { clicks: cl, impressions: im, clicks_pct: tc ? Math.round(cl / tc * 1000) / 10 : 0, impressions_pct: ti ? Math.round(im / ti * 1000) / 10 : 0,
      named_clicks: sum.clicks, named_impressions: sum.impressions, note: 'Search Console withholds the queries of rare searches; these clicks and impressions are real but belong to queries it does not name.' };
  };
  return { isScraper, brandKeys, brandTest, anonymised };
})();
// ---- site-tracking statistics (2026-10-12, FIX_PLAN G28): an alert must mean "this really changed", not "a number moved by 30%".
// Clicks, impressions and sessions are counts over two periods of the same length, so the honest test is the two-sample Poisson test
// (normal approximation, the same idea as the z-tests the AI Pulse uses in v5/code/_ai_stats.js):
//     z = (cur - prev) / sqrt(cur + prev),  |z| >= 1.96  =  outside 95% sampling noise.
// 28 clicks against 20 is a 40% "fall" that any week could produce by chance (z = -1.18); 1,400 against 1,600 is a 13% fall that is real
// (z = -3.65). A change therefore needs three things: enough volume to measure, statistical significance, and a size worth telling the owner.
// Anything large but not significant is reported as "watch", never as a fall — and Google's update dates are named when one ran in the period.
// 2026-10-13 (G28 follow-up): `tested()` puts the source, the period, the test and the confidence into every alert's own words, and
// `position()` replaces the last fixed threshold in the site tracking — "5 places" on a keyword with 12 impressions is not a drop.
const ST = (() => {
  const num = (v) => Number(v) || 0;
  const z = (cur, prev) => { const s = num(cur) + num(prev); return s > 0 ? (num(cur) - num(prev)) / Math.sqrt(s) : 0; };
  // 95% interval for the relative change (log-ratio, Poisson counts); null when either side is zero
  const band = (cur, prev) => { const c = num(cur), p = num(prev); if (c <= 0 || p <= 0) return null;
    const se = Math.sqrt(1 / c + 1 / p), lo = Math.log(c / p) - 1.96 * se, hi = Math.log(c / p) + 1.96 * se;
    return [Math.round((Math.exp(lo) - 1) * 100), Math.round((Math.exp(hi) - 1) * 100)]; };
  // cur vs prev over equal periods. opts: { min_events, min_pct } — the events both periods must carry together before anything is claimed,
  // and the size of change worth telling the owner about
  const change = (cur, prev, opts) => {
    const o = opts || {}; const c = num(cur), p = num(prev);
    const minEvents = o.min_events == null ? 0 : o.min_events, minPct = o.min_pct == null ? 0 : o.min_pct;
    const pct = p > 0 ? Math.round((c - p) / p * 100) : (c > 0 ? null : 0);
    const zz = Math.round(z(c, p) * 100) / 100;
    const measurable = (c + p) >= minEvents;                     // both periods together carry enough events to say anything
    const significant = measurable && Math.abs(zz) >= 1.96;
    const big = pct != null && Math.abs(pct) >= minPct;
    return { cur: c, prev: p, pct, z: zz, ci: band(c, p), measurable, significant, big,
      real: significant && big, watch: !significant && big && p > 0,   // large but inside sampling noise: something to watch, not a fall
      direction: pct == null ? 'new' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      text: (pct == null ? 'new' : (pct > 0 ? 'up ' : 'down ') + Math.abs(pct) + '%') + ' (' + p + ' → ' + c + (band(c, p) ? ', 95% range ' + band(c, p)[0] + '% to ' + band(c, p)[1] + '%' : '') + ')' };
  };
  // Google's confirmed ranking updates: context for a real fall, never a cause ("correlation, not proof").
  // G12 (2026-10-13): the list is no longer written here. It is inlined from `v5/data/seo_events.json` — the one dated place to add
  // an update, shared with the chart annotations (`_annotations.js`) and with the app (`app/shared/src/seo-events.generated.ts`).
  const UPDATES = [].concat([{"name": "March 2025 core update", "start": "2025-03-13", "end": "2025-03-27"}, {"name": "June 2025 core update", "start": "2025-06-30", "end": "2025-07-17"}, {"name": "August 2025 spam update", "start": "2025-08-26", "end": "2025-09-22"}, {"name": "December 2025 core update", "start": "2025-12-02", "end": "2025-12-18"}, {"name": "March 2026 core update", "start": "2026-03-10", "end": "2026-03-26"}, {"name": "June 2026 core update", "start": "2026-06-23", "end": "2026-07-08"}, {"name": "September 2026 core update", "start": "2026-09-15", "end": "2026-09-30"}]);
  const updatesIn = (range) => { const r = range || {}; const a = String(r.start || ''), b = String(r.end || '');
    if (!a || !b) return []; return UPDATES.filter(u => u.start <= b && u.end >= a); };
  const updateNote = (range) => { const hits = updatesIn(range); return hits.length ? ' A Google ' + hits.map(u => u.name + ' (' + u.start + ' to ' + u.end + ')').join(' and ') + ' ran inside this period — it may be part of the cause, which cannot be proven from these numbers.' : ''; };
  // ---- G28 follow-up (2026-10-13): an alert must say WHAT was tested, over WHAT period, and HOW SURE it is ----
  // One sentence, from the test itself, so no caller can print a number without its basis. `o`: { source, period, test }.
  // `stats: false` leaves the z value and the range out of this sentence, for a text that already prints them.
  const tested = (ch, o) => { const x = o || {}; const c = ch || {};
    const src = String(x.source || 'Search Console'), per = String(x.period || 'the last 28 days against the 28 days before'),
      test = String(x.test || 'two-sample Poisson z-test (counts over two equal periods)');
    const zz = x.stats === false ? '' : ' (z ' + c.z + ')';
    const sure = c.significant === true ? 'outside 95% sampling noise' + zz
      : c.measurable === false ? 'not enough events to test (' + ((Number(c.cur) || 0) + (Number(c.prev) || 0)) + ' over both periods together)'
      : 'inside 95% sampling noise' + zz + ', so it may be chance';
    return ' Tested: ' + src + ', ' + per + ', ' + test + '; ' + sure + (x.stats === false || !c.ci ? '' : '; 95% range ' + c.ci[0] + '% to ' + c.ci[1] + '%') + '.'; };
  // ---- a MOVE IN AVERAGE POSITION, which is not a count and must not be tested like one ----
  // Search Console's position is the impression-weighted average of the best position per impression over 28 days. With a handful of
  // impressions one search moves it several places, so the old rule ("5 places and the keyword was in the top 10") fired on noise for a
  // small site. There is no published variance for that average, so nothing is claimed about significance: the move is reported only when
  // BOTH periods carry min_impressions, and the clicks of the same two periods are tested (Poisson) so the alert can say how sure it is.
  // o: { impressions, prev_impressions, clicks, prev_clicks, min_impressions, min_places, min_click_events }
  const position = (cur, prev, o) => {
    const x = o || {}; const c = num(cur), p = num(prev);
    const minImp = x.min_impressions == null ? 50 : num(x.min_impressions), minPlaces = x.min_places == null ? 5 : num(x.min_places);
    const imp = num(x.impressions), impPrev = num(x.prev_impressions);
    const places = Math.round((c - p) * 10) / 10;                       // positive = slipped down the page
    const clicks = change(x.clicks, x.prev_clicks, { min_events: x.min_click_events == null ? 20 : num(x.min_click_events), min_pct: 0 });
    const measurable = c > 0 && p > 0 && imp >= minImp && impPrev >= minImp;
    const big = c > 0 && p > 0 && Math.abs(places) >= minPlaces;
    return { cur: c, prev: p, places, impressions: imp, prev_impressions: impPrev, clicks, measurable, big,
      real: measurable && big, watch: big && !measurable,               // a big move on too few impressions: worth a look, never a fact
      direction: places > 0 ? 'down' : places < 0 ? 'up' : 'flat',
      basis: 'Search Console average position, the last 28 days against the 28 days before, on ' + impPrev + ' then ' + imp + ' impressions'
        + (measurable ? '' : ' (under ' + minImp + ' impressions in a period one search can move the average several places)') };
  };
  // ---- B4-1 (2026-10-15, benchmark area 4 — docs/system-review-2026-10-14/BENCH_AREA4_cadence.md): IS THIS PAGE REALLY LOSING
  // TRAFFIC, OR ARE THESE WEEKS QUIET EVERY YEAR? Clearscope's Content Decay view compares a page's clicks over 90 days against
  // THE SAME 90 DAYS A YEAR EARLIER and names the two figures "seasonal difference" and "seasonal growth"
  // (https://www.clearscope.io/support/content-decay); Ahrefs tells you to flag pages down more than 20% YEAR OVER YEAR
  // (https://ahrefs.com/blog/content-decay/). Ours compared 28 days with the 28 before and called any 25% fall on 10 earlier
  // clicks a "decaying page" — the one window that cannot tell a decay from a seasonal dip, at a volume this file's own test
  // rejects (10 -> 7 clicks is z = -0.73, well inside chance). decay() tests the fall first and then, when the year-ago figure
  // was read, refuses to call a fall "decay" that the same page also had a year ago.
  // Two falls are NOT the same thing and need different work, so they are told apart here and nowhere else: clicks down while
  // impressions held is a click-through loss (title and snippet), clicks down WITH impressions is lost visibility (the page).
  // o: { clicks, prev_clicks, yoy_clicks, impressions, prev_impressions, min_events, min_pct, period, yoy_period }
  const decay = (o) => {
    const x = o || {}; const cur = num(x.clicks), prev = num(x.prev_clicks);
    const yoy = (x.yoy_clicks === '' || x.yoy_clicks == null) ? null : num(x.yoy_clicks);
    const minEvents = x.min_events == null ? 40 : num(x.min_events), minPct = x.min_pct == null ? 20 : num(x.min_pct);
    const per = String(x.period || 'the last 28 days against the 28 days before');
    const yper = String(x.yoy_period || 'the same 28 days a year earlier');
    const ch = change(cur, prev, { min_events: minEvents, min_pct: minPct });
    const imps = change(num(x.impressions), num(x.prev_impressions), { min_events: minEvents * 10, min_pct: minPct });
    const yc = yoy == null ? null : change(cur, yoy, { min_events: minEvents, min_pct: minPct });
    const lost = Math.max(0, prev - cur);
    const kind = ch.direction === 'down' ? ((imps.direction === 'down' && imps.significant) ? 'visibility' : 'clickthrough') : null;
    const kindNote = kind === 'visibility' ? ' Impressions fell with the clicks (' + imps.text + '), so the page is being shown less often: this is lost visibility, not a snippet problem.'
      : kind === 'clickthrough' ? ' Impressions held (' + imps.text + '), so the page is still being shown and fewer people click it: look at the title and the description before rewriting the page.' : '';
    const base = (state, note) => ({ state, lost, pct: ch.pct, kind: (state === 'decaying' || state === 'watch') ? kind : null,
      clicks: cur, prev_clicks: prev, yoy_clicks: yoy, change: ch, yoy_change: yc, impressions: imps,
      basis: 'Search Console clicks for this page, ' + per + ' (' + prev + ' → ' + cur + ')'
        + (yoy == null ? '; ' + yper + ' was not read, so a seasonal dip cannot be ruled out' : '; ' + yper + ': ' + yoy + ' clicks')
        + '.' + note });
    if (!ch.measurable) return base('too_small', ' Not enough clicks to test: ' + (cur + prev) + ' over both periods together, against the ' + minEvents + ' this test needs. No fall is claimed.');
    if (ch.direction !== 'down') return base('steady', ' No fall to explain (' + ch.text + ').');
    if (ch.real) {
      if (yc && yc.measurable && yc.direction !== 'down')
        return base('seasonal', ' But against ' + yper + ' the page is ' + yc.text + ', so these weeks are simply quieter than the ones before them every year. Not decay.'
          + tested(yc, { source: 'Search Console', period: 'the last 28 days against ' + yper }));
      return base('decaying', kindNote + tested(ch, { source: 'Search Console', period: per })
        + (yc ? ' Against ' + yper + ' it is ' + yc.text + '.' : ''));
    }
    if (ch.watch) return base('watch', ' Large but inside 95% sampling noise (z ' + ch.z + '), so it is something to watch, not a fall.' + kindNote);
    return base('steady', ' The fall is smaller than the ' + minPct + '% worth acting on (' + ch.text + ').');
  };
  return { z, band, change, position, decay, tested, updatesIn, updateNote, UPDATES };
})();
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
  if (!acc.has(q.site_idx)) acc.set(q.site_idx, { site_idx: q.site_idx, site_id: q.site_id, errors: [], by_date: [], yoy: null, queries_cur: [], queries_prev: [], pages_cur: [], pages_prev: [], pages_yoy: [], kw: {}, paging: {} });
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
  // B4-1: the same 28 days a year earlier, per page. `yoy_read` says whether Google answered at all, so a page missing from the
  // year-ago rows is "0 clicks a year ago" when the request worked and "not read" when it did not — the two mean opposite things.
  const yoyP = new Map(a.pages_yoy.map(r => [r.keys[0], r]));
  const yoy_read = !a.errors.some(e => /^pages_yoy/.test(String(e))) && reqs.concat(moreReqs).some(q => q.site_idx === a.site_idx && q.kind === 'pages_yoy');
  const pages = a.pages_cur.map(r => { const p = prevP.get(r.keys[0]), y = yoyP.get(r.keys[0]);
    return { page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: +r.position.toFixed(1), prev_clicks: p ? p.clicks : 0, prev_impressions: p ? p.impressions : 0, clicks_delta: r.clicks - (p ? p.clicks : 0),
      yoy_clicks: yoy_read ? (y ? y.clicks : 0) : null, yoy_impressions: yoy_read ? (y ? y.impressions : 0) : null }; }).sort((x, y) => y.clicks - x.clicks);
  // B4-1: a page is "decaying" only when the fall survives the two-sample Poisson test AND is not the dip the same weeks had a
  // year ago (ST.decay). Ranked by the clicks actually lost, which is what Clearscope sorts its Content Decay report by
  // (https://www.clearscope.io/blog/content-decay-report). Everything the old 25% rule would have called decay is still reported,
  // under the state the evidence supports, so nothing goes quiet: `seasonal`, `watch` and `too_small` each say why.
  const decayCfg = { min_events: Number(cfg.decay_min_click_events) || 40, min_pct: Number(cfg.decay_min_pct) || 20,
    period: 'the last 28 days against the 28 days before', yoy_period: 'the same 28 days a year earlier' };
  const judged = pages.map(p => ({ ...p, decay: ST.decay({ clicks: p.clicks, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, impressions: p.impressions, prev_impressions: p.prev_impressions, ...decayCfg }) }));
  const byLost = (x, y) => y.decay.lost - x.decay.lost;
  const decaying = judged.filter(p => p.decay.state === 'decaying').sort(byLost).slice(0, 10)
    .map(p => ({ page: p.page, clicks: p.clicks, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, impressions: p.impressions, prev_impressions: p.prev_impressions, lost: p.decay.lost, pct: p.decay.pct, kind: p.decay.kind, basis: p.decay.basis, state: 'decaying' }));
  const not_decay = judged.filter(p => p.decay.state === 'seasonal' || (p.decay.state === 'watch' && p.decay.lost > 0)).sort(byLost).slice(0, 10)
    .map(p => ({ page: p.page, clicks: p.clicks, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, lost: p.decay.lost, pct: p.decay.pct, state: p.decay.state, basis: p.decay.basis }));
  // every page Search Console reported anything for, with its judgement — the Site Tracker stores this in seo_pages so the
  // Content Cadence can write the refresh instead of only recommending it (B4-2 / B4-3)
  const page_perf = judged.filter(p => p.clicks > 0 || p.prev_clicks > 0 || p.impressions > 0).sort((x, y) => (y.clicks + y.prev_clicks) - (x.clicks + x.prev_clicks)).slice(0, 500)
    .map(p => ({ page: p.page, clicks: p.clicks, impressions: p.impressions, position: p.position, prev_clicks: p.prev_clicks, yoy_clicks: p.yoy_clicks, state: p.decay.state, pct: p.decay.pct, lost: p.decay.lost, kind: p.decay.kind, basis: p.decay.basis }));
  const decay_summary = { tested: judged.length, decaying: judged.filter(p => p.decay.state === 'decaying').length,
    seasonal: judged.filter(p => p.decay.state === 'seasonal').length, watch: judged.filter(p => p.decay.state === 'watch').length,
    too_small: judged.filter(p => p.decay.state === 'too_small').length, yoy_read, min_click_events: decayCfg.min_events, min_pct: decayCfg.min_pct,
    note: yoy_read ? 'Every page with clicks was tested against the 28 days before and the same 28 days a year earlier.'
      : 'The year-ago page rows could not be read this week, so a seasonal dip cannot be ruled out for any page.' };
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
    daily, query_count: queries.length, queries: queries.slice(0, 100), winners, losers, new_queries: newQ, lost_queries: lost, striking, ctr_gaps: ctrGaps, pages: pages.slice(0, 20), decaying_pages: decaying, not_decay, decay_summary, page_perf, rising_pages: rising, tracked,
    anonymised, brand_split, scraper_queries, page_count: pages.length, rows_read, paging, truncated } });   // G9: every row read, the anonymised share, brand vs non-brand, scraper queries apart
}
return out.length ? out : [{ json: { skip: true, reason: 'no Search Console data came back' } }];
