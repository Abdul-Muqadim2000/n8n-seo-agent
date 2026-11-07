// Research Candidates (E2, DESIGN.md §3.1-§3.2): every candidate search with every source that produced it, gated BEFORE any money is spent
// on it (R1 #4: volume was decided before fit). Sources: gsc (the newest 28-day Search Console reading) | paa / related / forum (the results
// pages already read today) | autocomplete | labs_ideas / labs_suggestions / labs_related | competitor (the chosen set's ranked keywords) | gap
// (page_intersection) | tracked | ladder | seed. Each keyword passes fitGate (other brands, government, jobs, other markets, off topic) and
// gets a pre-score that INCLUDES its fit (KI.prescore); only the top N go on to enrichment, and the gated ones are kept with their reason.
// A source that could not be read twice is `missing` in its section with the reason; the candidates of the other sources go on.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return []; } };
const now = p.now || new Date().toISOString();
const cache = all('Load KI Cache').filter(r => r && r.key);
const ck = (what, ...x) => KIW.cacheKey(p.site_id, what, ...x);
const m = { location_code: p.location_code, language_code: p.language_code };
const seeds = (p.seeds || []).map(s => s.keyword);
const reqs = all('Any Research Discover?').filter(r => r && !r.skip && r.ki_call);
const pairs = KIW.paired(reqs, all('Run Research Discover Answers'));
const saveRows = [], sections = [];
const lists = [];   // [{ source, fetched_at, rows }]
// ---- Search Console (measured), tracked, ladders, seeds ----
lists.push({ source: 'gsc', fetched_at: p.gsc_period_end || now, rows: (p.gsc || []).map(q => ({ keyword: q.query, impressions: q.impressions, clicks: q.clicks, position: q.position, page: q.page, detail: q.impressions + ' impressions in 28 days' })) });
lists.push({ source: 'tracked', fetched_at: now, rows: (p.tracked || []).map(k => ({ keyword: k })) });
lists.push({ source: 'ladder', fetched_at: now, rows: (p.ladders || []).map(k => ({ keyword: k })) });
lists.push({ source: 'seed', fetched_at: now, rows: seeds.map(k => ({ keyword: k })) });
sections.push({ key: 'search_console', state: (p.gsc || []).length ? 'ok' : 'skipped', reason: (p.gsc || []).length ? '' : 'no Search Console reading is stored for this website yet (connect it, or wait for the weekly tracking)', rows: (p.gsc || []).length });
// ---- People also ask / related searches / forum threads of the seeds' pages read today (free) ----
const seedCache = all('Load SERP Cache (KI Seeds)').filter(r => r && r.key);
const paa = [], rel = [], forum = [];
for (const kw of seeds) { const lk = SC.lookup(seedCache, KIW.serpBody(kw, m), { now }); if (!lk.hit) continue; const ex = KIW.extrasOf(lk.response);
  ex.paa.forEach(q => paa.push({ keyword: q, detail: 'asked on the results page of "' + kw + '"' })); ex.related.forEach(q => rel.push({ keyword: q, detail: 'related to "' + kw + '"' })); ex.forum.forEach(q => forum.push({ keyword: q, detail: 'a forum thread on "' + kw + '"' })); }
lists.push({ source: 'paa', fetched_at: now, rows: paa }, { source: 'related', fetched_at: now, rows: rel }, { source: 'forum', fetched_at: now, rows: forum });
// ---- autocomplete + Labs discovery (one bundle in the cache, 30 days) ----
const discKey = ck('disc', p.market, KIW.hash(seeds.join('|')));
let disc = KIW.cacheRead(cache, discKey); if (!KIW.fresh(disc, 'discovery', now, p.ki_force)) disc = null;
const discPairs = pairs.filter(x => ['ac', 'labs_ideas', 'labs_suggestions', 'labs_related'].includes(x.q.ki_call));
if (discPairs.length) {
  const take = (call, fn) => discPairs.filter(x => x.q.ki_call === call && x.ok).flatMap(x => KIW.itemsOf(x.a).map(fn)).filter(r => r && r.keyword);
  const acRows = take('ac', it => ({ keyword: KIW.normKw(it.suggestion) })).filter(r => fitMarket(r.keyword, p.iso).ok);
  const lab = (it) => { const k = KIW.kwRow(it); return k.keyword ? { keyword: k.keyword, volume: k.volume, cpc: k.cpc, kd: k.kd, intent: k.labs_intent, trend: k.trend, volume_source: 'DataForSEO Labs' } : null; };
  disc = { fetched_at: now, ac: acRows, ideas: take('labs_ideas', lab), sugg: take('labs_suggestions', lab), related: take('labs_related', lab),
    failed: discPairs.filter(x => !x.ok).map(x => x.q.ki_call + ': ' + x.why) };
  // only a complete bundle is kept for reuse: a call that failed is asked again next run
  if (!disc.failed.length) saveRows.push(KIW.cacheRow(p.site_id, discKey, { ...disc, ac: disc.ac.slice(0, 200), ideas: disc.ideas.slice(0, 400), sugg: disc.sugg.slice(0, 400), related: disc.related.slice(0, 300) }));
}
if (disc) { lists.push({ source: 'autocomplete', fetched_at: disc.fetched_at, rows: disc.ac || [] }, { source: 'labs_ideas', fetched_at: disc.fetched_at, rows: disc.ideas || [] },
  { source: 'labs_suggestions', fetched_at: disc.fetched_at, rows: disc.sugg || [] }, { source: 'labs_related', fetched_at: disc.fetched_at, rows: disc.related || [] }); }
const discFailed = (disc && disc.failed) || [];
sections.push({ key: 'discovery', state: !disc ? (seeds.length ? 'missing' : 'skipped') : (discFailed.length ? (discFailed.length >= discPairs.length && discPairs.length ? 'missing' : 'partial') : 'ok'),
  reason: !disc ? (seeds.length ? 'the keyword lists could not be read' : 'no seed passed the fit gate') : (discFailed.length ? 'could not be read: ' + discFailed.join('; ') : ''),
  rows: disc ? (disc.ac || []).length + (disc.ideas || []).length + (disc.sugg || []).length + (disc.related || []).length : 0 });
// ---- the chosen competitors' ranked keywords (7 days, shared with the Competitors run) ----
const chosen = p.chosen || [];
const rk = {}; const rkFailed = [];
for (const x of pairs.filter(x => /^rk:/.test(x.q.ki_call))) { const d = KIW.host(x.q.target); if (!x.ok) { rkFailed.push(d + ' (' + x.why + ')'); continue; }
  const r0 = KIW.result0(x.a); const v = { fetched_at: now, total: KIW.N(r0.total_count), etv: KIW.N((((r0.metrics || {}).organic) || {}).etv), items: KIW.itemsOf(x.a).map(it => { const k = KIW.kwRow(it); const se = ((it.ranked_serp_element || {}).serp_item) || {};
    return { k: k.keyword, v: k.volume, cpc: k.cpc, kd: k.kd, i: k.labs_intent, pos: KIW.N(se.rank_group), url: KIW.S(se.url), etv: KIW.N(se.etv) }; }).filter(r => r.k) };
  rk[d] = v; saveRows.push(KIW.cacheRow(p.site_id, ck('rk', p.market, d), v)); }
for (const d of chosen) if (!rk[d]) { const e = KIW.cacheRead(cache, ck('rk', p.market, d)); if (KIW.fresh(e, 'ranked', now, p.ki_force)) rk[d] = e; }
const compPos = {};   // kw_key -> [{ domain, position, url }]
const compRows = [];
for (const [d, v] of Object.entries(rk)) for (const it of (v.items || [])) { const kk = KIW.keyOf(it.k); (compPos[kk] = compPos[kk] || []).push({ domain: d, position: it.pos, url: it.url });
  compRows.push({ keyword: it.k, volume: it.v, cpc: it.cpc, kd: it.kd, intent: it.i, volume_source: 'DataForSEO Labs', detail: d + ' ranks #' + it.pos }); }
lists.push({ source: 'competitor', fetched_at: now, rows: compRows });
sections.push({ key: 'competitor_keywords', state: !chosen.length ? 'skipped' : (rkFailed.length ? (Object.keys(rk).length ? 'partial' : 'missing') : (chosen.every(d => rk[d]) ? 'ok' : 'partial')),
  reason: !chosen.length ? 'no competitor is chosen yet: run Competitors and pick up to ' + p.max_chosen : (rkFailed.length ? 'could not be read: ' + rkFailed.join('; ') : (chosen.every(d => rk[d]) ? '' : chosen.filter(d => !rk[d]).length + ' competitor keyword list(s) wait for the next run: this run is held at the price quoted')), rows: compRows.length });
// ---- the gap: page_intersection (sample of N of M) ----
const piKey = ck('pi', p.market, KIW.hash(chosen.slice().sort().join('|')));
let pi = KIW.cacheRead(cache, piKey); if (!KIW.fresh(pi, 'ranked', now, p.ki_force)) pi = null;
const piPair = pairs.find(x => x.q.ki_call === 'page_intersection');
if (piPair && piPair.ok) { const r0 = KIW.result0(piPair.a); const pages = (piPair.q.pages || []).map(KIW.host);
  pi = { fetched_at: now, total: KIW.N(r0.total_count), read: KIW.itemsOf(piPair.a).length, pages, items: KIW.itemsOf(piPair.a).map(it => { const k = KIW.kwRow(it); const ir = it.intersection_result || {};
    const comps = Object.entries(ir).map(([i, el]) => el ? { domain: pages[Number(i) - 1] || KIW.host(el.domain), position: KIW.N(el.rank_group), url: KIW.S(el.url) } : null).filter(Boolean);
    return { k: k.keyword, v: k.volume, cpc: k.cpc, kd: k.kd, i: k.labs_intent, comps }; }).filter(r => r.k && r.comps.some(c => c.position && c.position <= KIW.CAPS.pi_rank)) };
  saveRows.push(KIW.cacheRow(p.site_id, piKey, pi)); }
const gapRows = ((pi && pi.items) || []).map(it => { const kk = KIW.keyOf(it.k); for (const c of it.comps) { const l = (compPos[kk] = compPos[kk] || []); if (!l.some(x => x.domain === c.domain)) l.push(c); }
  return { keyword: it.k, volume: it.v, cpc: it.cpc, kd: it.kd, intent: it.i, volume_source: 'DataForSEO Labs', detail: it.comps.filter(c => c.position <= KIW.CAPS.pi_rank).length + ' of your competitors rank in the top 10, you do not' }; });
lists.push({ source: 'gap', fetched_at: pi ? pi.fetched_at : now, rows: gapRows });
const intersection = pi ? { total: pi.total, read: pi.read, top10: (pi.items || []).length, sample_note: pi.total != null && pi.read != null && pi.total > pi.read ? 'sample of ' + pi.read + ' of ' + pi.total + ' searches the data provider holds for these competitors (the ' + pi.read + ' with the most searches were read)' : '' } : null;
sections.push({ key: 'gap', state: !chosen.length ? 'skipped' : (piPair && !piPair.ok ? 'missing' : (pi ? 'ok' : 'missing')), reason: !chosen.length ? 'no competitor is chosen yet' : (piPair && !piPair.ok ? 'the gap could not be read: ' + piPair.why : (pi ? (intersection.sample_note || '') : 'the gap was not read')), rows: gapRows.length });
// ---- merge, gate, pre-score ----
const merged = KI.mergeCandidates(lists);
const fc = p.fit_ctx || {};
const protect = [...(fc.protect || []), ...(p.tracked || []), ...(p.ladders || [])];
// the KI write gate (KI.gate, the shared fit gate in the KI vocabulary) and the continuous fit above it (KI.fit); a fit under the bar is gated too
const lowFitText = (KI.GATE_TEXT || {}).low_fit || 'too far from what you sell';
const rows = [], gated = [];
for (const r of merged) {
  const g = KI.gate(r.keyword, { ...fc, protect, intent: r.labs_intent === 'navigational' ? 'navigational' : '' });
  const f = g.gate === 'pass' ? KI.fit(r.keyword, fc) : { fit: 0, low: 0, high: 0 };
  const lowFit = g.gate === 'pass' && f.fit < (KI.CONFIG.fit_gate || 0.35);
  const row = { ...r, gate: g.gate === 'pass' && !lowFit ? 'pass' : 'fail', gate_reason: g.gate === 'pass' ? (lowFit ? lowFitText : '') : (g.text || g.reason) + (g.detail ? ' (' + g.detail + ')' : ''),
    gate_code: g.gate === 'pass' ? (lowFit ? 'low_fit' : '') : g.reason, fit: f.fit, fit_low: f.low, fit_high: f.high, competitors: compPos[r.kw_key] || [] };
  row.prescore = KI.prescore(row, KI.CONFIG);
  (row.gate === 'pass' ? rows : gated).push(row); }
rows.sort((a, b) => b.prescore - a.prescore || a.kw_key.localeCompare(b.kw_key));
const top = rows.slice(0, KIW.CAPS.top_n);
// ---- what still needs volume / intent (stored for 30 days) ----
const volKey = ck('vol', p.market);
const vol = KIW.fresh(KIW.cacheRead(cache, volKey), 'volume', now, false) ? (KIW.cacheRead(cache, volKey) || {}) : {};
const volMap = vol.map || {};
const fresh30 = (e) => e && Date.parse(now) - Date.parse(e.at) < KIW.ttlOf('volume') * 864e5 && !p.ki_force;
const needOverview = top.filter(r => r.volume == null && !fresh30(volMap[r.kw_key])).map(r => r.keyword).slice(0, KIW.CAPS.overview_max);
const needIntent = top.filter(r => !(fresh30(volMap[r.kw_key]) && volMap[r.kw_key].intent)).map(r => r.keyword).slice(0, KIW.CAPS.intent_max);
return [{ json: { rows: top, gated: gated.sort((a, b) => (KIW.N(b.gsc_impressions) || KIW.N(b.volume) || 0) - (KIW.N(a.gsc_impressions) || KIW.N(a.volume) || 0) || a.kw_key.localeCompare(b.kw_key)).slice(0, 100),
  dropped: Math.max(0, rows.length - top.length), merged: merged.length, need_overview: needOverview, need_intent: needIntent, vol_map: volMap, intersection, comp_pos: compPos,
  sections, cache_rows: saveRows, questions_src: { paa: paa.map(x => x.keyword), autocomplete: ((disc && disc.ac) || []).map(x => x.keyword) } } }];
