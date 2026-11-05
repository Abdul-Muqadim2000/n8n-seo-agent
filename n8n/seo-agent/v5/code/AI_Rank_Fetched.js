// AI Rank Fetched (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.I / §6.6, CONTRACTS.md §6, package P5): every outside answer of the AIR
// read chain parsed into ONE item per website in mode `on`, in the shape AI Rank Plan hands to the kits:
//   { site_id, cost_usd, mentions_pages: [{ url, title, mentions, platform }], target_metrics: { month, mentions, ai_search_volume } | null,
//     bing_stats: { read_at, positions: { query: pos }, pages: { url_key: { impressions, clicks } }, crawl_issues: [{ url, issue }] } | null,
//     serp_reads: [{ query, location_code, results: [{ url, pos }], read_at, cached }], cc_captures: number | null, brave: { query: [{ url, pos }] } | null }
// plus, beside it (additive): engine on each serp read, Bing's crawl stats and per-search pages, the basis of every part, the reads counted,
// Brave's estimated cost, and `cache_rows` (exact seo_cache columns) that *AI Rank Fetch Rows* stores: the Google readings (the shared SERP cache,
// with the site id), this week's marker (budget used + compact readings, so a second run of the week pays nothing again), the month's LLM
// Mentions marker and the Common Crawl reading.
// Money (INVARIANTS rule 3, R28): `cost_usd` is DataForSEO only, what each task reported, both attempts of the in-200 gate, each task counted
// ONCE by its id across the whole run (a results page two sites share is paid by the first and free to the second). The run ledger's settle
// reads it (measured = 'Growth Metrics|AI Rank Fetched'). Brave reports no cost per call: its figure is `brave_usd_est`, an estimate, never in
// cost_usd. A read that failed is never a reading: no result, no row, and the next run asks again (a failed DataForSEO task is billed 0).
// A site in shadow or off never reaches this node with a plan: the node answers [{ skip: true }] and AI Rank Plan reads nothing outside.
/*__AI_RANK_FLAGS__*/
/*__SERP_CACHE__*/
const nowMs = Date.now(); const nowIso = new Date(nowMs).toISOString(); const DAY = 864e5;
const CFG = { bing_window_days: 35, keep_queries: 300, keep_pages: 200, keep_issues: 50, keep_readings: 200, mentions_pages: 50, brave_price: 0.005, cc_limit: 1000, value_max: 60000 };
const S0 = (v) => (v == null ? '' : String(v)).trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const r1 = (x) => Math.round(10 * x) / 10; const r4 = (x) => Math.round(1e4 * x) / 1e4;
const J = (x) => { try { return JSON.stringify(x == null ? null : x); } catch (e) { return ''; } };
const tryAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return null; } };   // null: the node did not run in this execution
const live = (name) => (tryAll(name) || []).filter(r => r && !r.skip);
const plans = (tryAll('AI Rank Requests') || []).filter(p => p && p.site_id && !p.skip && !p.error);
if (!plans.length) return [{ json: { skip: true, reason: 'no website in mode on: nothing was read from outside' } }];
const hostOf = (u) => { const m = S0(u).match(/^(?:https?:\/\/)?([^\/?#:\s]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : ''; };
const hostIn = (u, list) => { const h = hostOf(u); return !!h && list.some(o => { const x = hostOf(o); return x && (h === x || h.endsWith('.' + x)); }); };
const cleanUrl = (u) => S0(u).replace(/#.*$/, '').replace(/([?&])(utm_[a-z]+|gclid|fbclid|srsltid)=[^&]*/gi, '$1').replace(/[?&]+$/, '').replace(/\?&+/, '?');
const msDate = (s) => { const m = S0(s).match(/\/Date\((-?\d+)/); return m ? Number(m[1]) : Date.parse(S0(s)); };
const task0 = (a) => ((a && Array.isArray(a.tasks)) ? a.tasks[0] : null) || {};
const dfsOk = (a) => !!a && !a.error && Number(a.status_code) === 20000 && Number(task0(a).status_code) === 20000;
const jsonOf = (r) => { if (!r || typeof r !== 'object') return {}; if (r.d !== undefined || r.web !== undefined) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
// pairs a call's request items with its answers; null when they cannot be paired one to one (then nothing of that call is read)
const pair = (reqNode, callNode) => { const q = live(reqNode); const a = tryAll(callNode); if (!q.length || !a) return { pairs: [], ran: false, unpaired: false };
  if (a.length !== q.length) return { pairs: [], ran: true, unpaired: true }; return { pairs: q.map((r, i) => [r, a[i] || {}]), ran: true, unpaired: false }; };
// ---- DataForSEO money: each task once by its id, across both calls and both attempts ----
const seenTask = new Set(); const costBy = {}; const tasksBy = {};
const charge = (sid, ans) => { const ids = (Array.isArray((ans || {}).tasks) ? ans.tasks : []).map(t => S0((t || {}).id)).filter(Boolean);
  if (ids.length && ids.every(id => seenTask.has(id))) return 0; ids.forEach(id => seenTask.add(id));
  const c = num((ans || {}).__dfs_cost_usd) != null ? num(ans.__dfs_cost_usd) : (Array.isArray((ans || {}).tasks) ? ans.tasks : []).reduce((s, t) => s + (num((t || {}).cost) || 0), 0);
  costBy[sid] = r4((costBy[sid] || 0) + c); tasksBy[sid] = (tasksBy[sid] || 0) + ids.length; return c; };
const site = {};   // site_id -> working state
for (const p of plans) site[p.site_id] = { p, errors: [], reads: { google: 0, bing: 0, brave: 0, bing_calls: 0 }, serp: [], readings: [], rows: [], mentions: null, metrics: null, mentionsFresh: false,
  bing: { qs: [], ps: [], issues: [], stats: [], qp: {}, ran: 0 }, cc: null, ccFresh: null, brave: {}, braveN: 0 };
const errs = (sid, what) => { if (site[sid]) site[sid].errors.push(S0(what).slice(0, 200)); };

// ---- LLM Mentions ----
const M = pair('AI Rank Mention Requests', 'AI Rank Mentions Call');
if (M.unpaired) for (const s of Object.values(site)) errs(s.p.site_id, 'LLM Mentions: requests and answers could not be paired, nothing read');
for (const [q, a] of M.pairs) { const s = site[q.site_id]; if (!s) continue; s.mCost = r4((s.mCost || 0) + charge(q.site_id, a));
  if (!dfsOk(a)) { errs(q.site_id, 'LLM Mentions ' + q.kind + ' failed: ' + S0(task0(a).status_message || a.status_message || (a.error && (a.error.message || a.error)) || 'no answer')); continue; }
  const r0 = ((task0(a).result || [])[0]) || {};
  if (q.kind === 'pages') { const byKey = new Map();
    for (const it of (Array.isArray(r0.items) ? r0.items : [])) { const url = cleanUrl(it && it.page); const k = AIRF.urlKey(url); if (!k || hostIn(url, s.p.our_hosts || [])) continue;
      const x = byKey.get(k) || { url, title: S0(it.title).slice(0, 160), mentions: 0, platform: S0(((it.platform || [])[0] || {}).key) || 'google', ai_search_volume: 0 };
      x.mentions += num((it.total || {}).mentions) || 0; x.ai_search_volume += num((it.total || {}).ai_search_volume) || 0; byKey.set(k, x); }
    s.mentions = [...byKey.values()].sort((x, y) => y.mentions - x.mentions || x.url.localeCompare(y.url)).slice(0, CFG.mentions_pages); s.mentionsFresh = true; }
  else { const it = (Array.isArray(r0.items) ? r0.items : [])[0]; const tot = (it && it.total) || ((r0.aggregated_metrics || {}).total) || {};
    s.metrics = { month: S0((s.p.mentions || {}).month), mentions: num(tot.mentions), ai_search_volume: num(tot.ai_search_volume), basis: it ? 'the domain\'s own row' : 'the answer\'s aggregated total' }; } }

// ---- Bing Webmaster stats ----
const B = pair('AI Rank Bing Requests', 'AI Rank Bing Call');
if (B.unpaired) for (const s of Object.values(site)) errs(s.p.site_id, 'Bing Webmaster: requests and answers could not be paired, nothing read');
for (const [q, a] of B.pairs) { const s = site[q.site_id]; if (!s) continue; s.reads.bing_calls++; const d = jsonOf(a).d;
  if (!Array.isArray(d)) { errs(q.site_id, 'Bing ' + q.kind + ': no list in the answer'); continue; } s.bing.ran++;
  if (q.kind === 'query_stats') s.bing.qs.push(...d); else if (q.kind === 'page_stats') s.bing.ps.push(...d); else if (q.kind === 'crawl_issues') s.bing.issues.push(...d);
  else if (q.kind === 'crawl_stats') s.bing.stats.push(...d); else if (q.kind === 'query_pages') s.bing.qp[q.query] = d; }

// ---- results pages (Google and Bing) ----
const R = pair('AI Rank SERP Requests', 'AI Rank SERP Call');
if (R.unpaired) for (const s of Object.values(site)) errs(s.p.site_id, 'results pages: requests and answers could not be paired, nothing read');
for (const [q, a] of R.pairs) { const ids = (q.site_ids || [q.site_id]).filter(id => site[id]); if (!ids.length) continue; charge(ids[0], a);
  const body = (q.body || [])[0] || {}; const st = SC.status(a);
  if (st === 'failed') { for (const id of ids) errs(id, (q.engine === 'bing' ? 'Bing' : 'Google') + ' results page for "' + S0(q.query).slice(0, 60) + '" failed'); continue; }
  const rd = SC.reading(a, body, { now: nowIso, path: 'air fan-out ' + q.engine }); if (!rd) continue;
  const results = rd.empty ? [] : (rd.items || []).filter(x => x && x.type === 'organic' && x.url).map(x => ({ url: x.url, pos: Number(x.rank_group || x.rank_absolute) || null }));
  site[ids[0]].reads[q.engine === 'bing' ? 'bing' : 'google']++;
  if (q.engine === 'google') { const row = SC.rowFor(a, body, ids[0], { now: nowIso, path: 'air fan-out google' }); if (row) site[ids[0]].rows.push(row); }   // the shared SERP cache: Google only (its key has no engine)
  for (const id of ids) { const s = site[id];
    s.serp.push({ query: S0(q.query), key: S0(q.key), engine: q.engine, location_code: Number(body.location_code) || 0, results, read_at: S0(rd.at), cached: false, results_scope: 'all' });
    s.readings.push({ e: q.engine, k: S0(q.key), q: S0(q.query), loc: Number(body.location_code) || 0, at: S0(rd.at), ours: results.filter(x => hostIn(x.url, s.p.our_hosts || [])).slice(0, 5) }); } }

// ---- Common Crawl ----
const C = pair('AI Rank CC Index Requests', 'AI Rank CC Index Call');
for (const [q, a] of C.pairs) { const s = site[q.site_id]; if (!s) continue; const code = Number(a.statusCode); const text = S0(a.body ?? a.data);
  if (code === 200) { const n = text.split('\n').filter(l => l.trim().charAt(0) === '{').length; s.ccFresh = { crawl: S0(q.crawl), captures: n, capped: n >= CFG.cc_limit, at: nowIso }; }
  else if (code === 404 && /no captures/i.test(text)) s.ccFresh = { crawl: S0(q.crawl), captures: 0, capped: false, at: nowIso };
  else errs(q.site_id, 'Common Crawl index answered ' + (code || 'nothing') + ': not read'); }

// ---- Brave ----
const V = pair('AI Rank Brave Requests', 'AI Rank Brave Call');
for (const [q, a] of V.pairs) { const s = site[q.site_id]; if (!s) continue; const j = jsonOf(a); const res = ((j.web || {}).results);
  if (!Array.isArray(res)) { errs(q.site_id, 'Brave search for "' + S0(q.query).slice(0, 60) + '" answered no results list'); continue; }
  s.braveN++; s.reads.brave++; const list = res.filter(x => x && x.url).slice(0, 20).map((x, i) => ({ url: S0(x.url), pos: i + 1 }));
  s.brave[S0(q.key)] = list; s.readings.push({ e: 'brave', k: S0(q.key), q: S0(q.query), loc: 0, at: nowIso, ours: list.filter(x => hostIn(x.url, s.p.our_hosts || [])).slice(0, 5) }); }

// ---- one item per site ----
const ISSUE = [[1, 'redirect 301'], [2, 'redirect 302'], [4, 'client error (4xx)'], [8, 'server error (5xx)'], [16, 'blocked by robots.txt'], [32, 'contains malware'],
  [64, 'important page blocked by robots.txt'], [128, 'DNS error'], [256, 'timeout']];
const issueOf = (n) => { const f = Number(n) || 0; const l = ISSUE.filter(([b]) => (f & b) === b).map(x => x[1]); return l.length ? l.join(', ') : f ? 'issue code ' + f : 'none'; };
const out = [];
for (const s of Object.values(site)) {
  const p = s.p; const ours = p.our_hosts || []; const week0 = p.week && typeof p.week === 'object' ? p.week : null;
  // Bing: Webmaster's positions over the last weeks (impression-weighted), then the results pages read for searches it had no position for
  let bing_stats = null;
  if (s.bing.ran) { const qAgg = new Map();
    for (const x of s.bing.qs) { const t = msDate(x.Date); if (Number.isFinite(t) && nowMs - t > CFG.bing_window_days * DAY) continue; const k = SC.normKw(x.Query); if (!k) continue;
      const g = qAgg.get(k) || { imp: 0, clk: 0, pw: 0 }; const imp = Number(x.Impressions) || 0; const pos = Number(x.AvgImpressionPosition);
      g.imp += imp; g.clk += Math.max(0, Number(x.Clicks) || 0); if (pos > 0) g.pw += pos * Math.max(1, imp); qAgg.set(k, g); }
    const positions = {}, basis = {}, queries = {};
    for (const [k, g] of [...qAgg.entries()].sort((x, y) => y[1].imp - x[1].imp).slice(0, CFG.keep_queries)) { const pos = g.pw > 0 ? r1(g.pw / Math.max(1, g.imp)) : null;
      queries[k] = { pos, impressions: g.imp, clicks: g.clk }; if (pos) { positions[k] = pos; basis[k] = 'webmaster'; } }
    const query_pages = {};
    for (const [k, d] of Object.entries(s.bing.qp)) { const rows = d.filter(x => x && Number(x.AvgImpressionPosition) > 0).map(x => ({ url: S0(x.Query), pos: Number(x.AvgImpressionPosition), impressions: Number(x.Impressions) || 0 }));
      query_pages[k] = rows.slice(0, 10); const best = rows.reduce((m, x) => (m == null || x.pos < m ? x.pos : m), null); if (best && positions[k] == null) { positions[k] = r1(best); basis[k] = 'webmaster (page stats)'; } }
    const pages = {}; const pAgg = new Map();
    for (const x of s.bing.ps) { const t = msDate(x.Date); if (Number.isFinite(t) && nowMs - t > CFG.bing_window_days * DAY) continue; const k = AIRF.urlKey(x.Query); if (!k) continue;
      const g = pAgg.get(k) || { impressions: 0, clicks: 0, pw: 0 }; const imp = Number(x.Impressions) || 0; g.impressions += imp; g.clicks += Math.max(0, Number(x.Clicks) || 0);
      if (Number(x.AvgImpressionPosition) > 0) g.pw += Number(x.AvgImpressionPosition) * Math.max(1, imp); pAgg.set(k, g); }
    for (const [k, g] of [...pAgg.entries()].sort((x, y) => y[1].impressions - x[1].impressions).slice(0, CFG.keep_pages)) pages[k] = { impressions: g.impressions, clicks: g.clicks, pos: g.pw > 0 ? r1(g.pw / Math.max(1, g.impressions)) : null };
    const crawl_issues = s.bing.issues.filter(x => x && x.Url).slice(0, CFG.keep_issues).map(x => ({ url: S0(x.Url), issue: issueOf(x.Issues), http: num(x.HttpCode), in_links: num(x.InLinks) }));
    const cs = s.bing.stats.filter(x => x && Number.isFinite(msDate(x.Date))).sort((x, y) => msDate(y.Date) - msDate(x.Date))[0] || null;
    bing_stats = { read_at: nowIso, from: 'webmaster', site_url: S0((p.bing || {}).site_url), positions, positions_basis: basis, queries, pages, crawl_issues, query_pages,
      crawl_stats: cs ? { date: new Date(msDate(cs.Date)).toISOString().slice(0, 10), crawled: num(cs.CrawledPages), errors: num(cs.CrawlErrors), in_index: num(cs.InIndex), in_links: num(cs.InLinks),
        blocked_robots: num(cs.BlockedByRobotsTxt), code_4xx: num(cs.Code4xx), code_5xx: num(cs.Code5xx) } : null }; }
  else if (p.bing && p.bing.stored && typeof p.bing.stored === 'object') bing_stats = { ...p.bing.stored, from: 'this week' };
  const bingReads = [...s.serp.filter(x => x.engine === 'bing'), ...((p.bing_serp || {}).cached || []).map(x => ({ ...x, engine: 'bing', cached: true }))];
  if (bingReads.length) { bing_stats = bing_stats || { read_at: nowIso, from: 'results pages only', positions: {}, positions_basis: {}, queries: {}, pages: {}, crawl_issues: [], query_pages: {}, crawl_stats: null };
    bing_stats.positions = { ...(bing_stats.positions || {}) }; bing_stats.positions_basis = { ...(bing_stats.positions_basis || {}) };
    for (const r of bingReads) { const k = SC.normKw(r.key || r.query); if (!k || bing_stats.positions[k] != null) continue;
      const best = (r.results || []).filter(x => hostIn(x.url, ours) && Number(x.pos) > 0).reduce((m, x) => (m == null || x.pos < m ? x.pos : m), null);
      bing_stats.positions[k] = best || 0; bing_stats.positions_basis[k] = best ? 'bing results page' : 'bing results page (not in the ' + ((r.results || []).length || 0) + ' results read)'; } }
  // the results pages AI Rank Plan merges into its Google map (fresh, this week's stored, today's shared cache)
  const serp_reads = [...s.serp, ...((p.google || {}).cached || []).map(x => ({ query: x.query, key: x.key, engine: 'google', location_code: x.location_code, results: x.results || [], read_at: x.read_at, cached: true, results_scope: x.results_scope || 'all', source: x.source })),
    ...((p.bing_serp || {}).cached || []).map(x => ({ query: x.query, key: x.key, engine: 'bing', location_code: x.location_code, results: x.results || [], read_at: x.read_at, cached: true, results_scope: 'ours', source: x.source }))];
  // Brave: this run's lists, and this week's stored ones (the site's own results only)
  const braveMap = { ...Object.fromEntries(((p.brave || {}).cached || []).map(x => [S0(x.key), x.results || []])), ...s.brave };
  const brave = Object.keys(braveMap).length ? braveMap : null;
  // Common Crawl: this run's reading, else the stored one (read every 28 days), else unknown
  const ccStored = (p.cc || {}).stored; const ccUse = s.ccFresh || (ccStored && ccStored.captures != null ? ccStored : null);
  // LLM Mentions: this month's read, else the stored one of this month
  const mStored = (p.mentions || {}).stored; const mentions_pages = s.mentionsFresh ? s.mentions : (mStored && Array.isArray(mStored.pages) ? mStored.pages : []);
  const target_metrics = s.metrics || (s.mentionsFresh ? null : (mStored && mStored.target_metrics) || null);
  // ---- the rows to keep (on only: this node runs for nothing else) ----
  const rows = s.rows.slice();
  if (s.mentionsFresh) rows.push({ key: S0((p.mentions || {}).key), kind: AIRF.CACHE_KIND, site_id: p.site_id, value: J({ v: 1, month: S0((p.mentions || {}).month), at: nowIso, pages: s.mentions, target_metrics: s.metrics, cost_usd: s.mCost || 0 }), updated_at: nowIso });   // what the two LLM Mentions tasks cost
  if (s.ccFresh) rows.push({ key: S0((p.cc || {}).key), kind: AIRF.CACHE_KIND, site_id: p.site_id, value: J({ v: 1, ...s.ccFresh }), updated_at: nowIso });
  const newReads = s.reads.google + s.reads.bing + s.reads.brave + s.reads.bing_calls;
  if (newReads || s.readings.length) {
    const r0 = (week0 && week0.reads) || {}; const old = (week0 && Array.isArray(week0.readings)) ? week0.readings : [];
    const readings = [...old.filter(x => !s.readings.some(y => y.e === x.e && y.k === x.k)), ...s.readings].slice(-CFG.keep_readings);
    const compactBing = bing_stats && s.bing.ran ? { read_at: bing_stats.read_at, site_url: bing_stats.site_url, positions: bing_stats.positions, positions_basis: Object.fromEntries(Object.entries(bing_stats.positions_basis).filter(([, v]) => /^webmaster/.test(v))),
      pages: Object.fromEntries(Object.entries(bing_stats.pages).slice(0, 60)), crawl_issues: bing_stats.crawl_issues.slice(0, 20), crawl_stats: bing_stats.crawl_stats, queries: {}, query_pages: {} } : (week0 && week0.bing_stats) || null;
    let val = { v: 1, week: S0(p.week_key).split(':').pop(), site_id: p.site_id, at: nowIso,
      reads: { google: (Number(r0.google) || 0) + s.reads.google, bing: (Number(r0.bing) || 0) + s.reads.bing, brave: (Number(r0.brave) || 0) + s.reads.brave, bing_calls: (Number(r0.bing_calls) || 0) + s.reads.bing_calls },
      readings, bing_stats: compactBing };
    let str = J(val); if (str.length > CFG.value_max && val.bing_stats) { val.bing_stats = { ...val.bing_stats, pages: {}, crawl_issues: [] }; str = J(val); }
    while (str.length > CFG.value_max && val.readings.length) { val.readings = val.readings.slice(Math.ceil(val.readings.length / 4)); str = J(val); }
    rows.push({ key: S0(p.week_key), kind: AIRF.CACHE_KIND, site_id: p.site_id, value: str, updated_at: nowIso }); }
  const cost = r4(costBy[p.site_id] || 0);
  out.push({ json: { site_id: p.site_id, domain: S0(p.domain), mode: S0(p.mode), cost_usd: cost,
    cost_basis: tasksBy[p.site_id] ? 'measured: ' + tasksBy[p.site_id] + ' DataForSEO task(s) at what each reported, each counted once by its task id (both attempts of the in-200 gate)' : 'no paid DataForSEO task this run: $0',
    brave_usd_est: r4(s.braveN * CFG.brave_price), brave_basis: s.braveN ? 'estimate: ' + s.braveN + ' Brave search(es) x $' + CFG.brave_price + ' (Brave reports no cost per call; inside its monthly free credit)' : '',
    mentions_pages, target_metrics, bing_stats, serp_reads, cc_captures: ccUse ? Number(ccUse.captures) : null, cc: ccUse ? { crawl: S0(ccUse.crawl), capped: !!ccUse.capped, at: S0(ccUse.at), fresh: !!s.ccFresh } : null, brave,
    reads: s.reads, basis: { queries: S0(p.queries_basis), market: p.loc ? S0(p.loc.basis) : 'no market', serp: S0((p.google || {}).basis), bing: S0((p.bing || {}).why) || 'read this run', mentions: S0((p.mentions || {}).why) || 'read this run', brave: S0((p.brave || {}).why) },
    errors: s.errors.slice(0, 20), cache_rows: rows } });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing to report' } }];
