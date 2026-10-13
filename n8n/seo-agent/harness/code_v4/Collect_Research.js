// ---- what the keyword research is allowed to use, and what its numbers mean (2026-10-13, FIX_PLAN G8; criteria K2 / K4 / K6 / K7) ----
// Three inputs the research was missing, all built from data the run already holds (no extra paid call):
//   * KWI.gscSeeds()     - the site's OWN Search Console queries as discovery seeds: a query that gets impressions while no live page
//                          answers it (the D11 page inventory decides through SM.matchPage) and a striking-distance query (position
//                          8-20). Search Console is the only first-party record of what people really type, so it now seeds the paid
//                          pulls instead of only being read afterwards (K6).
//   * KWI.calibrate()    - the traffic estimate checked against the site's own measured clicks and impressions where it already
//                          ranks, labelled `calibrated` or `modelled`. A modelled number is never presented as measured (K2).
//   * KWI.serpClusters() - keywords grouped when their top-10 results share at least 3 URLs, each cluster named by its head keyword
//                          and carrying the shared URLs, so one page can target the whole group (K7). Only results pages the run
//                          already fetched are used: the live checks and the competitors' own ranking URLs.
// Every function is pure and takes its thresholds as options, so the harness (S52) can drive it directly.
const KWI = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const low = (v) => S(v).toLowerCase().replace(/\s+/g, ' ');
  const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const CFG = {
    min_impressions: 10,        // a query needs this many impressions in the Search Console period before it seeds anything
    striking_min: 8,            // "striking distance": bottom of page 1 to the end of page 2, where one strong page moves the needle
    striking_max: 20,
    max_seeds: 10,              // how many Search Console queries may be handed to the research as seeds
    period_days: 28,            // the Search Console window the Site Tracker stores (Site_Plan.js ranges.current)
    month_days: 30,
    top_share: 0.3,             // the share of a search a page in the top three takes (the modelled estimate uses the same share)
    min_shared_urls: 3,         // K7: a shared results page means at least this many of the same top-10 URLs
    min_urls: 3,                // a keyword needs this many known top-10 URLs before it can be compared at all
    max_cluster_keywords: 12,
    live_serp_checks: 16,       // K4: how many keywords get a live intent / page-type check (cost-aware cap, see LIVE_MAX)
    live_serp_max: 25
  };
  const bare = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const cap = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // K4: how many live results-page checks this run may buy. One check is a DataForSEO live-advanced SERP at depth 10 (~$0.002), so the
  // default 16 costs about $0.032 a run against $0.016 at the old fixed 8; the owner may set it per run and it is hard-capped at 25.
  const liveChecks = (requested) => { const n = num(requested); return n == null || n <= 0 ? CFG.live_serp_checks : Math.round(cap(n, 1, CFG.live_serp_max)); };

  // ---- K6: the site's own Search Console queries as seeds ----
  // rows = seo_query_history rows (the Site Tracker writes one per site, query and 28-day period). Only the newest period counts:
  // the table only grows, so older rows would seed last month's picture.
  const gscSeeds = (rows, o) => {
    const c = { ...CFG, ...(o || {}) };
    const dom = bare(c.domain);
    const all = (Array.isArray(rows) ? rows : []).filter(r => r && S(r.query) && !r.error && (!dom || bare(r.domain) === dom));
    const period = all.reduce((m, r) => S(r.period_end) > m ? S(r.period_end) : m, '');
    const isScraper = typeof c.isScraper === 'function' ? c.isScraper : () => false;
    const isBrand = typeof c.isBrand === 'function' ? c.isBrand : () => false;
    const matchPage = typeof c.matchPage === 'function' ? c.matchPage : () => null;
    const dropped = { scraper: 0, brand: 0, low_impressions: 0, duplicate: 0 };
    const seen = new Set(); const considered = [];
    for (const r of all.filter(r => S(r.period_end) === period).sort((a, b) => (num(b.impressions) || 0) - (num(a.impressions) || 0))) {
      const q = low(r.query); if (!q) continue;
      if (seen.has(q)) { dropped.duplicate++; continue; }
      seen.add(q);
      if (isScraper(q)) { dropped.scraper++; continue; }
      if (isBrand(q)) { dropped.brand++; continue; }
      const impressions = num(r.impressions) || 0, clicks = num(r.clicks) || 0, position = num(r.position) || 0;
      if (impressions < c.min_impressions) { dropped.low_impressions++; continue; }
      // which page, if any, already answers this search: the page inventory first (D11), the page Search Console reports only when
      // the inventory is empty (then it is the best evidence we have, and it is labelled as such)
      const inv = matchPage(q);
      // R12 (2026-10-13, re-rating §3.11): 11 of 25 rows read "no page of yours answers this search" while the same row named a live
      // 200-OK page of the site — one of them ranking #6.2 — because only the slug / title match counted and the URL Search Console
      // itself reports was ignored whenever the inventory was non-empty. A URL on this site is evidence: it is the answering page, with
      // its own label ("the page that gets the impressions does not target this search"), so the report never asks the owner for a second
      // page for a search they already rank for (D11's cannibalisation rule, in the discovery path).
      const rowUrl = S(r.page);
      const rowBare = bare(rowUrl);
      const rowOnSite = !!rowUrl && !!rowBare && (!dom || rowBare === dom || rowBare.endsWith('.' + dom));
      const row_page = (rowUrl && (c.use_row_page || rowOnSite))
        ? { url: rowUrl, title: '', matched_by: c.use_row_page ? 'search console page' : 'impressions' } : null;
      const answered_by = inv ? { url: S(inv.url), title: S(inv.title), matched_by: S(inv.matched_by) || 'inventory' } : row_page;
      const kinds = [];
      if (!answered_by) kinds.push('no_page');
      else if (!inv && answered_by.matched_by === 'impressions') kinds.push('page_mismatch');
      const striking = position >= c.striking_min && position <= c.striking_max;
      if (striking) kinds.push('striking');
      const posTxt = position > 0 ? '#' + (Math.round(position * 10) / 10) : 'unreported';
      const why = kinds.indexOf('no_page') >= 0 ? 'no page of yours answers this search'
        : kinds.indexOf('page_mismatch') >= 0 ? 'the page that gets the impressions does not target this search'
          + (striking ? ' (you rank ' + posTxt + ' with it — striking distance)' : ' (you rank ' + posTxt + ' with it)')
          : striking ? 'you rank ' + posTxt + ' — striking distance' : 'a page of yours already answers this search';
      considered.push({ keyword: q, impressions, clicks, position: position > 0 ? Math.round(position * 10) / 10 : null,
        ctr: impressions ? Math.round(clicks / impressions * 1000) / 10 : 0, page: rowUrl, answered_by, kinds, why,
        period_end: period, period_days: c.period_days, tracked: yes(r.tracked) });
    }
    const wanted = considered.filter(q => q.kinds.length);
    const rank = (x) => x.kinds.indexOf('no_page') >= 0 ? 2 : x.kinds.indexOf('page_mismatch') >= 0 ? 1 : 0;   // R12: a search with no page at all first, then one whose ranking page targets something else
    const order = [...wanted].sort((a, b) => rank(b) - rank(a) || b.impressions - a.impressions);
    return { available: all.length > 0, period_end: period, period_days: c.period_days, rows: all.length, considered: considered.length,
      page_check: (num(c.pages_known) || 0) > 0 ? 'page inventory' : (c.use_row_page ? 'search console page' : 'unavailable'),
      pages_known: num(c.pages_known) || 0,
      queries: wanted, no_page: wanted.filter(q => q.kinds.indexOf('no_page') >= 0), striking: wanted.filter(q => q.kinds.indexOf('striking') >= 0),
      mismatch: wanted.filter(q => q.kinds.indexOf('page_mismatch') >= 0),
      answered: considered.filter(q => !q.kinds.length && q.answered_by).slice(0, 20),
      seeds: order.slice(0, c.max_seeds).map(q => q.keyword), dropped,
      min_impressions: c.min_impressions, striking_min: c.striking_min, striking_max: c.striking_max };
  };

  // the click loss a results page causes (an AI Overview, a snippet, a local pack and so on take clicks off the blue links)
  const featureLoss = (types) => {
    const t = (Array.isArray(types) ? types : []).map(x => S(x).toLowerCase());
    let ctr = 1;
    if (t.indexOf('ai_overview') >= 0) ctr *= 0.65;
    if (t.indexOf('featured_snippet') >= 0) ctr *= 0.85;
    if (t.indexOf('video') >= 0 || t.indexOf('short_videos') >= 0) ctr *= 0.92;
    if (t.indexOf('local_pack') >= 0 || t.indexOf('map') >= 0) ctr *= 0.85;
    if (t.indexOf('shopping') >= 0 || t.indexOf('popular_products') >= 0) ctr *= 0.9;
    return ctr;
  };

  // ---- K2: the traffic number, and where it comes from ----
  // `calibrated`: the site's own measured impressions for this exact search (the Search Console period, scaled to a month) through the
  //               results page's click loss and the share a top-three page takes, never below the clicks the site already gets.
  // `modelled`:   the provider's monthly volume through the same two factors - an estimate of an estimate, named as one.
  // `unknown`:    neither a volume nor a measurement, so no number at all (better than a confident zero).
  const calibrate = (e, o) => {
    const c = { ...CFG, ...(o || {}) };
    const k = e || {};
    const ctr = featureLoss(k.serp_types);
    const vol = num(k.volume);
    const modelled = vol == null ? null : Math.round(vol * ctr * c.top_share);
    const g = (k.gsc && typeof k.gsc === 'object') ? k.gsc : null;
    const impressions = g ? num(g.impressions) : null;
    if (impressions != null && impressions > 0) {
      const clicks = num(g.clicks) || 0;
      const days = num(g.period_days) > 0 ? num(g.period_days) : c.period_days;
      const toMonth = c.month_days / days;
      const traffic_potential = Math.max(Math.round(impressions * toMonth * ctr * c.top_share), Math.round(clicks * toMonth));
      const pos = num(g.position);
      return { traffic_potential, traffic_basis: 'calibrated', modelled_traffic_potential: modelled,
        traffic_note: 'Calibrated with your own Search Console data: ' + Math.round(impressions) + ' impressions and ' + Math.round(clicks)
          + ' click(s) measured for this exact search on your site in ' + Math.round(days) + ' days'
          + (pos ? ' at average position ' + (Math.round(pos * 10) / 10) : '') + '. A page in the top three would take about '
          + traffic_potential + ' visits a month' + (modelled != null ? ' (the modelled estimate from the provider\'s volume is ' + modelled + ').' : '.') };
    }
    if (modelled == null) {
      return { traffic_potential: null, traffic_basis: 'unknown', modelled_traffic_potential: null,
        traffic_note: 'No monthly volume from the provider and no Search Console measurement for this search, so no traffic estimate is given.' };
    }
    return { traffic_potential: modelled, traffic_basis: 'modelled', modelled_traffic_potential: modelled,
      traffic_note: 'Modelled, not measured: ' + vol + ' searches a month (a provider estimate) through the click loss of this results page and the share a top-three page takes.' };
  };
  const BASIS_TEXT = { calibrated: 'calibrated with your Search Console data', modelled: 'modelled from provider volume', unknown: 'no estimate' };

  // ---- K7: clusters by shared results pages ----
  // entries: [{ keyword, urls: [top-10 urls], weight, volume }]. A head keyword takes every keyword that shares at least
  // min_shared_urls of its own top-10 URLs; the head is the strongest keyword not already in a cluster, so the cluster can be named
  // after it. Queries and trailing slashes are ignored when URLs are compared (the same page, written two ways).
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const serpClusters = (entries, o) => {
    const c = { ...CFG, ...(o || {}) };
    const list = (Array.isArray(entries) ? entries : []).map(e => ({ keyword: low((e || {}).keyword),
      urls: [...new Set(((e || {}).urls || []).map(urlKey).filter(Boolean))], weight: num((e || {}).weight) || 0, volume: num((e || {}).volume) }))
      .filter(e => e.keyword && e.urls.length >= c.min_urls);
    const byKw = new Map(); for (const e of list) if (!byKw.has(e.keyword)) byKw.set(e.keyword, e);
    const ranked = [...byKw.values()].sort((a, b) => b.weight - a.weight || (b.volume || 0) - (a.volume || 0) || a.keyword.localeCompare(b.keyword));
    const used = new Set(); const clusters = [];
    for (const head of ranked) {
      if (used.has(head.keyword)) continue;
      const hs = new Set(head.urls); const members = [];
      for (const other of ranked) {
        if (other.keyword === head.keyword || used.has(other.keyword)) continue;
        const shared = other.urls.filter(u => hs.has(u));
        if (shared.length >= c.min_shared_urls) members.push({ keyword: other.keyword, volume: other.volume, shared_urls: shared.length, shared: shared.slice(0, 3) });
      }
      if (!members.length) continue;
      used.add(head.keyword); members.forEach(m => used.add(m.keyword));
      members.sort((a, b) => b.shared_urls - a.shared_urls || (b.volume || 0) - (a.volume || 0));
      clusters.push({ head_keyword: head.keyword, keyword_count: members.length + 1, urls_compared: head.urls.length,
        min_shared_urls: c.min_shared_urls, total_volume: [head, ...members].reduce((s, m) => s + (num(m.volume) || 0), 0),
        keywords: [{ keyword: head.keyword, volume: head.volume, shared_urls: head.urls.length, shared: [] }, ...members].slice(0, c.max_cluster_keywords) });
    }
    clusters.sort((a, b) => b.keyword_count - a.keyword_count || b.total_volume - a.total_volume);
    return { clusters, keywords_compared: ranked.length, min_shared_urls: c.min_shared_urls, min_urls: c.min_urls,
      clustered: clusters.reduce((n, x) => n + x.keyword_count, 0) };
  };
  // "one page can serve all three: 'erp software uae' also covers 'erp system uae' (4 of the same top-10 pages), ..."
  const clusterText = (cl) => {
    const c = cl || {}; const others = (c.keywords || []).slice(1);
    if (!others.length) return '';
    return 'One page can target all ' + c.keyword_count + ': "' + c.head_keyword + '" shares '
      + others.map(k => k.shared_urls + ' of its top-10 pages with "' + k.keyword + '"').join(', ')
      + ' - Google answers these searches with the same pages, so a second page would only split the signals.';
  };
  return { CFG, gscSeeds, calibrate, serpClusters, clusterText, featureLoss, liveChecks, urlKey, BASIS_TEXT, helpers: { bare, low, num } };
})();
// Merges every research response into one keyword pool with metrics, SERP features and competitor positions,
// then scores each keyword's OPPORTUNITY before the AI relevance pass:
//   traffic potential (volume x CTR after SERP features) x winnability (difficulty, top-10 link strength)
//   x commercial value (CPC) x intent weight for the client's goal x trend
// 2026-10-13 (FIX_PLAN G8, criteria K2 / K6): every keyword the site's Search Console measured carries that measurement
// (impressions, clicks, average position, the page that gets them) and its traffic potential is CALIBRATED against it
// instead of modelled from the provider's volume - and says which of the two it is (KWI.calibrate). Search Console queries
// the providers never returned join the pool as candidates in their own right, with no invented search volume.
const base = (() => { try { const x = $('Search Console Seeds (Discovery)').first().json; if (x && Array.isArray(x.seeds) && x.seeds.length) return x; } catch (e) {} return $('Seed List').first().json; })();
const reqA = $('Research Requests').all().map(i => i.json), resA = $('Run Research').all().map(i => i.json);
const reqB = $('Competitor Keyword Requests').all().map(i => i.json), resB = $input.all().map(i => i.json);
const goal = base.goal || 'leads';
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const W = {
  leads:   { transactional: 1.3, commercial: 1.25, informational: 0.8, navigational: 0.2 },
  sales:   { transactional: 1.4, commercial: 1.2, informational: 0.7, navigational: 0.2 },
  traffic: { informational: 1.2, commercial: 1.0, transactional: 0.9, navigational: 0.2 },
  brand:   { informational: 1.1, commercial: 1.1, transactional: 1.0, navigational: 0.3 }
}[goal] || { transactional: 1.3, commercial: 1.25, informational: 0.8, navigational: 0.2 };
const classify = (kw, intent) => {
  if (INTENTS.includes(intent)) return intent;
  const k = String(kw).toLowerCase();
  if (brand.length > 3 && k.includes(brand)) return 'navigational';
  if (/\b(price|pricing|cost|costs|buy|hire|quote|near me|licen[cs]e|subscription|free trial|demo|order|book)\b/.test(k)) return 'transactional';
  if (/\b(best|top|vs|versus|compare|comparison|review|reviews|alternatives?|services?|company|companies|agency|partner|partners|consultants?|consulting|providers?|firms?)\b/.test(k)) return 'commercial';
  return 'informational';
};
// G8: what Search Console measured for this site in the newest 28-day period, by exact query
const SC = (base.search_console && typeof base.search_console === 'object') ? base.search_console : {};
const gscBy = new Map(((SC.queries || [])).map(q => [String(q.keyword || '').toLowerCase(), q]));
const gscFacts = (kw) => { const q = gscBy.get(kw); return q ? { impressions: q.impressions, clicks: q.clicks, position: q.position, ctr: q.ctr,
  page: q.page || '', answered_by: q.answered_by || null, kinds: q.kinds || [], period_end: q.period_end || SC.period_end || '', period_days: q.period_days || SC.period_days || 28 } : null; };
const pool = new Map();
const addItem = (raw, source, extra = {}) => {
  const kd = raw.keyword_data || raw;
  const kw = String(kd.keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!kw) return;
  const info = kd.keyword_info || {};
  const vol = info.search_volume ?? 0;
  if (vol < 10) return;
  const props = kd.keyword_properties || {}, serp = kd.serp_info || {}, bl = kd.avg_backlinks_info || {}, trend = info.search_volume_trend || {};
  let e = pool.get(kw);
  if (!e) {
    e = { keyword: kw, volume: vol, cpc: info.cpc ?? null, competition: info.competition ?? null, kd: props.keyword_difficulty ?? null,
      intent: classify(kw, (kd.search_intent_info || {}).main_intent), trend_yearly: trend.yearly ?? null, trend_quarterly: trend.quarterly ?? null,
      monthly: (info.monthly_searches || []).slice(0, 12).map(m => m.search_volume), serp_types: serp.serp_item_types || [],
      se_results_count: serp.se_results_count ?? null, avg_rd: bl.referring_domains != null ? Math.round(bl.referring_domains) : null,
      words: props.words_count || kw.split(' ').length, sources: [], competitors: [], gsc: gscFacts(kw) };
    pool.set(kw, e);
    if (e.gsc) e.sources.push('search_console');
  }
  if (!e.sources.includes(source)) e.sources.push(source);
  if (extra.competitor) e.competitors.push(extra.competitor);
  if (e.kd == null && props.keyword_difficulty != null) e.kd = props.keyword_difficulty;
  if (!e.serp_types.length && Array.isArray(serp.serp_item_types)) e.serp_types = serp.serp_item_types;
  if (e.cpc == null && info.cpc != null) e.cpc = info.cpc;
};
const walk = (req, res) => {
  const items = res?.tasks?.[0]?.result?.[0]?.items || [];
  for (const it of items) {
    if (req.kind === 'serp') continue;
    if (req.kind === 'competitor') { const se = (it.ranked_serp_element || {}).serp_item || {}; addItem(it, 'competitor', { competitor: { domain: req.domain, position: se.rank_group ?? null, url: se.url || null } }); }
    else addItem(it, req.kind);
  }
};
reqA.forEach((r, i) => walk(r, resA[i]));
reqB.forEach((r, i) => walk(r, resB[i]));
// G8 (K6): a search the site already gets impressions for is a candidate even when no provider returned it. It keeps `volume: null`
// (Search Console impressions are not a search volume: they count only the searches this site was shown in) and is scored from the
// measured data, so it is never dressed up with a number nobody measured.
let gsc_only = 0;
for (const q of (SC.queries || [])) {
  const kw = String(q.keyword || '').toLowerCase().trim();
  if (!kw || pool.has(kw)) continue;
  pool.set(kw, { keyword: kw, volume: null, volume_note: 'no monthly volume from the search-data provider; the numbers below are what Search Console measured on your site',
    cpc: null, competition: null, kd: null, intent: classify(kw, null), trend_yearly: null, trend_quarterly: null, monthly: [], serp_types: [],
    se_results_count: null, avg_rd: null, words: kw.split(' ').length, sources: ['search_console'], competitors: [], gsc: gscFacts(kw) });
  gsc_only++;
}

const score = (e) => {
  // G8 (K2): the same two factors as before - the results page's click loss and the share a top-three page takes - but applied to the
  // site's own MEASURED impressions when Search Console has them, and labelled `calibrated` / `modelled` / `unknown` either way.
  // Without Search Console data the number is exactly what it was: volume x click loss x 0.3.
  const cal = KWI.calibrate(e, {});
  const traffic_potential = cal.traffic_potential == null ? 0 : cal.traffic_potential;
  let win = Math.min(1, Math.max(0.05, (100 - (e.kd ?? 50)) / 100));
  if (e.avg_rd != null && e.avg_rd > 300) win *= 0.5; else if (e.avg_rd != null && e.avg_rd > 100) win *= 0.7;
  const value = 1 + Math.log10(1 + (e.cpc || 0));
  const iw = W[e.intent] ?? 1;
  const tr = 1 + Math.min(0.3, Math.max(-0.3, (e.trend_yearly || 0) / 100));
  return { traffic_potential, traffic_basis: cal.traffic_basis, traffic_note: cal.traffic_note, modelled_traffic_potential: cal.modelled_traffic_potential,
    winnability: +win.toFixed(2), value_factor: +value.toFixed(2), pre_score: +(traffic_potential * win * value * iw * tr).toFixed(1) };
};
const all = [...pool.values()].map(e => { if (brand.length > 3 && e.keyword.includes(brand)) e.intent = 'navigational'; return { ...e, ...score(e) }; })
  .sort((a, b) => b.pre_score - a.pre_score);
const candidates = all.filter(e => e.intent !== 'navigational').slice(0, 240);
const bySource = {};
for (const e of all) for (const s of e.sources) bySource[s] = (bySource[s] || 0) + 1;
const pairs = [...reqA.map((r, i) => [r, resA[i]]), ...reqB.map((r, i) => [r, resB[i]])];
const failures = pairs.filter(([r, res]) => !res || res.error || Number(res.status_code) >= 40000 || ((res.tasks || [])[0] || {}).status_code >= 40000)   // + a top-level DataForSEO error (50000 with tasks: null, HTTP 200)
  .map(([r, res]) => r.label + ': ' + ((res && ((res.error && res.error.message) || ((res.tasks || [])[0] || {}).status_message || res.status_message)) || 'no response'));
return [{ json: { ...base, research: {
  pool_size: all.length, candidates, long_tail_pool: all.filter(e => e.words >= 4 && e.intent !== 'navigational').slice(0, 300),
  competitor_domains: [...new Set(reqB.filter(r => r.kind === 'competitor').map(r => r.domain))], by_source: bySource, failures, requests: pairs.length,
  // G8: how much of the pool came from the site's own Search Console, and how many estimates its data could check
  search_console: { available: !!SC.available, seeded: (base.gsc_seeds || []).length, measured: all.filter(e => e.gsc).length, only_source: gsc_only,
    calibrated: all.filter(e => e.traffic_basis === 'calibrated').length, modelled: all.filter(e => e.traffic_basis === 'modelled').length, period_end: SC.period_end || '' }
} } }];
