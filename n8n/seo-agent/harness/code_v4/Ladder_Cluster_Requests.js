// ---- what the keyword research is allowed to use, and what its numbers mean (2026-10-13, FIX_PLAN G8; criteria K2 / K4 / K6 / K7) ----
// Three inputs the research was missing, all built from data the run already holds (no extra paid call):
//   * KWI.gscSeeds()     - the site's OWN Search Console queries as discovery seeds: a query that gets impressions while no live page
//                          answers it (the D11 page inventory decides through SM.matchPage) and a striking-distance query (position
//                          8-20). Search Console is the only first-party record of what people really type, so it now seeds the paid
//                          pulls instead of only being read afterwards (K6).
//   * KWI.calibrate()    - the traffic estimate checked against the site's own measured clicks and impressions where it already
//                          ranks, labelled `calibrated` or `modelled`. A modelled number is never presented as measured (K2).
//   * KWI.serpClusters() - keywords grouped when their results pages share enough URLs, each cluster named by its head keyword and
//                          carrying the shared URLs, so one page can target the whole group (K7). Discovery compares the top 10 at 3
//                          shared URLs from results pages the run already fetched (the live checks and the competitors' own ranking
//                          URLs); the keyword ladder (B2-4, 2026-10-15) buys one results page per rung candidate and compares the
//                          TOP 7 at a 40% threshold, the convention's own current numbers (B2-6, `top_n` / `min_overlap`).
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
    live_serp_max: 25,
    // B2-6 (2026-10-15, benchmark area 2, approved by the owner): Keyword Insights, whose convention the shared-URL rule is, now
    // compares the TOP 7 and not the top 10 - "the overlap setting was originally 1-10, it now runs from 1-7 because Google no longer
    // reliably shows 10 traditional links" - at a default threshold of 40% of them (https://docs.keywordinsights.ai/learning-center/
    // the-features/keyword-clustering/). `top_n` cuts every keyword's list to that depth BEFORE anything is compared, and
    // `min_overlap` turns the threshold into a share of it: ceil(7 x 0.4) = 3 of 7. Both default to 0 = off, so the discovery path
    // keeps the top-10 / 3-URL shape it was measured on until the orchestrator re-baselines K7; the ladder (B2-4) passes 7 / 0.4.
    top_n: 0,
    min_overlap: 0,
    // B2-4: how many of a ladder's rung candidates may be sent for a results page of their own, and what one costs. A full ladder
    // plans at most 11 pages (rung limits 4 / 4 / 3) and a page takes at most 7 keywords, so 24 covers more than twice the pages a
    // plan can hold; the rest of the pool would be bought for keywords no page will ever target.
    ladder_serp_checks: 24,
    ladder_serp_max: 30,
    serp_check_usd: 0.002       // one DataForSEO live-advanced SERP at depth 10, the same call the discovery live checks buy
  };
  const bare = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const cap = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // K4: how many live results-page checks this run may buy. One check is a DataForSEO live-advanced SERP at depth 10 (~$0.002), so the
  // default 16 costs about $0.032 a run against $0.016 at the old fixed 8; the owner may set it per run and it is hard-capped at 25.
  const liveChecks = (requested) => { const n = num(requested); return n == null || n <= 0 ? CFG.live_serp_checks : Math.round(cap(n, 1, CFG.live_serp_max)); };
  // B2-4: the same shape for the ladder's own cap. 0 or a negative number means "make no call at all" (a free run), which is why this
  // one does NOT fall back to the default when it is given a zero: a bound of nothing has to be expressible.
  const ladderChecks = (requested) => { const n = num(requested); if (n == null) return CFG.ladder_serp_checks; if (n <= 0) return 0; return Math.round(cap(n, 1, CFG.ladder_serp_max)); };
  const checkCost = (n) => +((Math.max(0, Number(n) || 0)) * CFG.serp_check_usd).toFixed(4);

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

  // ---- K3: the click loss a results page causes, and where each figure comes from (B1-3, 2026-10-15, benchmark area 1) ----
  // Until today every factor here was an undated constant, and the AI Overview one (0.65 = a 35% loss) was the APRIL 2025 measurement
  // -- "AI Overviews reduced clicks to top-ranking content by 34.5%" -- while the current study, published 2026-02-04 on December 2025
  // data over 300,000 keywords, measures **-58.0% at position 1**, -50.8% at 2 and -46.4% at 3
  // (https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/). The estimate these factors feed is explicitly "what a page in the top
  // three would get" (`top_share`), so the top-three average of that table is the figure that belongs here: it was 1.5x too generous.
  // The other features have no comparable published measurement (the 2025 featured-snippet numbers disagree with each other and with
  // Perficient's "click-neutral" finding), so they stay where they were and are labelled a STATED RULE, not a measurement. Every one of
  // them is named in `CLICK_LOSS` with its basis so a report can print what it applied and why, instead of a bare multiplier.
  const AIO_CTR_2025 = { 1: 0.420, 2: 0.492, 3: 0.536 };   // 1 - the measured loss at each of the top three positions
  const CLICK_LOSS = {
    ai_overview: { factor: +(((AIO_CTR_2025[1] + AIO_CTR_2025[2] + AIO_CTR_2025[3]) / 3).toFixed(3)), basis: 'measured',
      what: 'an AI Overview', source: 'Ahrefs, 300,000 keywords, December 2025 data (published 2026-02-04)',
      url: 'https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/',
      note: 'clicks to position 1 fall 58.0% when an AI Overview is shown (50.8% at 2, 46.4% at 3); this estimate is for a page in the top three, so their average is applied' },
    featured_snippet: { factor: 0.85, basis: 'stated rule', what: 'a featured snippet', source: 'no measurement we could verify; published 2025 studies disagree', url: '' },
    video: { factor: 0.92, basis: 'stated rule', what: 'video results', source: 'no measurement we could verify', url: '' },
    local_pack: { factor: 0.85, basis: 'stated rule', what: 'a local pack', source: 'no measurement we could verify', url: '' },
    shopping: { factor: 0.9, basis: 'stated rule', what: 'shopping results', source: 'no measurement we could verify', url: '' },
  };
  const FEATURE_KEY = { ai_overview: 'ai_overview', featured_snippet: 'featured_snippet', video: 'video', short_videos: 'video',
    local_pack: 'local_pack', map: 'local_pack', shopping: 'shopping', popular_products: 'shopping' };
  // which of the five were seen on this results page, each once, in the order they are listed above
  const lossApplied = (types) => { const seen = new Set((Array.isArray(types) ? types : []).map(x => FEATURE_KEY[S(x).toLowerCase()]).filter(Boolean));
    return Object.keys(CLICK_LOSS).filter(k => seen.has(k)).map(k => ({ key: k, ...CLICK_LOSS[k] })); };
  const featureLoss = (types) => lossApplied(types).reduce((ctr, f) => ctr * f.factor, 1);
  // "an AI Overview (-52% of the clicks, measured: Ahrefs ...)" - one clause per feature, for the note under a traffic figure
  const lossText = (types) => lossApplied(types).map(f => f.what + ' (-' + Math.round((1 - f.factor) * 100) + '% of the clicks, ' + f.basis + (f.source ? ': ' + f.source : '') + ')').join(', ');

  // ---- K2: the traffic number, and where it comes from ----
  // `calibrated`: the site's own measured impressions for this exact search (the Search Console period, scaled to a month) through the
  //               results page's click loss and the share a top-three page takes, never below the clicks the site already gets.
  // `modelled`:   the provider's monthly volume through the same two factors - an estimate of an estimate, named as one.
  // `unknown`:    neither a volume nor a measurement, so no number at all (better than a confident zero).
  const calibrate = (e, o) => {
    const c = { ...CFG, ...(o || {}) };
    const k = e || {};
    const ctr = featureLoss(k.serp_types);
    // B1-3: the figure says which features took clicks off it, how much each one took and whether that number is measured or a rule
    const lossTxt = lossText(k.serp_types);
    const lossNote = lossTxt ? ' Click loss applied: ' + lossTxt + '.' : '';
    // B1-3 (2026-10-15): `num(null)` is 0, not null — Number(null) is 0 and 0 is finite — so a keyword the provider has NO volume for
    // came back as "0 visits a month (modelled)" instead of "no estimate", a confident number where nothing was measured (the R26
    // class). An absent volume is absent; a provider that really reports 0 still reports 0.
    const vol = (k.volume === null || k.volume === undefined || k.volume === '') ? null : num(k.volume);
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
          + traffic_potential + ' visits a month' + (modelled != null ? ' (the modelled estimate from the provider\'s volume is ' + modelled + ').' : '.') + lossNote };
    }
    if (modelled == null) {
      return { traffic_potential: null, traffic_basis: 'unknown', modelled_traffic_potential: null,
        traffic_note: 'No monthly volume from the provider and no Search Console measurement for this search, so no traffic estimate is given.' };
    }
    return { traffic_potential: modelled, traffic_basis: 'modelled', modelled_traffic_potential: modelled,
      traffic_note: 'Modelled, not measured: ' + vol + ' searches a month (a provider estimate) through the click loss of this results page and the share a top-three page takes.' + lossNote };
  };
  // ---- K4: what KIND of page Google actually ranks for this search (B1-5, 2026-10-15, benchmark area 1) ----
  // The intent and the page type came from the AI screen's label (and DataForSEO's `main_intent` behind it). The live results page
  // was already bought for the priority keywords and only its domains, its features and its People Also Ask were kept, so the one
  // piece of evidence that settles the question - the ten pages Google chose - was thrown away. K4's own anchor for a 10 is "the
  // dominant top-10 page type decides, a mismatch is flagged"; Ahrefs tells you to study the top 10 by hand for exactly this.
  // `serpPageTypes` reads the URL and the title of each organic result, with the title first where it is decisive ("best ... ",
  // "how to ...") and the path after it. Nothing is inferred from a domain we have not read, and a result it cannot place is
  // `Other`, counted and never guessed at.
  const SHAPES = [
    { type: 'Government or official', test: (u, t, d) => /(^|\.)(gov|gov\.[a-z]{2}|gob|govt)(\.|$)/.test(d) || /\.gov($|\.)/.test(d) },
    { type: 'Forum or community', test: (u, t, d) => /(^|\.)(reddit|quora|stackexchange|stackoverflow|linkedin|facebook|x|twitter|medium)\./.test(d) || /\/(forum|community|questions|discussion)\//.test(u) },
    { type: 'Directory or marketplace', test: (u, t, d) => /(^|\.)(g2|capterra|getapp|softwareadvice|trustradius|saashub|clutch|crunchbase|yelp|yellowpages|indiamart)\./.test(d) },
    { type: 'Comparison or list', test: (u, t) => /\b(best|top\s*\d+|vs\.?|versus|alternatives?|comparison|compared)\b/i.test(t) || /\/(best|top|vs|alternatives|compare)[-\/]/.test(u) },
    { type: 'Pricing page', test: (u, t) => /\bpricing\b|\bprice list\b|\bcost(s)?\b.*\b(plans?|pricing)\b/i.test(t) || /\/(pricing|plans|price)(\/|$)/.test(u) },
    { type: 'Guide or article', test: (u, t) => /\b(how to|what is|why|guide|tutorial|checklist|explained|step[- ]by[- ]step|everything you need)\b/i.test(t) || /\/(blog|insights|articles?|news|resources?|learn|guides?|knowledge|academy)(\/|$)/.test(u) },
    { type: 'Service or product page', test: (u, t) => /\/(services?|solutions?|products?|software|platform|industries)(\/|$)/.test(u) || /\b(software|solution|services?|platform)\b/i.test(t) },
    { type: 'Homepage', test: (u) => /^[a-z0-9.-]+\/?$/.test(u) },
  ];
  // what WE would write for it, in the same words, so a mismatch is a real disagreement and not a vocabulary difference
  const OURS = { 'Blog Post': 'Guide or article', Guide: 'Guide or article', 'Pillar Page': 'Guide or article', 'FAQ Page': 'Guide or article',
    'Comparison Page': 'Comparison or list', 'Service Page': 'Service or product page', 'Product Page': 'Service or product page',
    'Landing Page': 'Service or product page', 'Category Page': 'Service or product page', 'Location Page': 'Service or product page',
    'Local Page': 'Service or product page', 'Case Study': 'Guide or article' };
  const shapeOf = (url, title) => {
    const u = urlKey(url), d = bare(url), t = S(title);
    for (const sh of SHAPES) { try { if (sh.test(u, t, d)) return sh.type; } catch (e) {} }
    return 'Other';
  };
  /** results: [{ url, title }] from the live top 10 · o.page_type = the page we plan to write
   *  -> { read, counts, dominant, dominant_count, dominant_share, ours, mismatch, text } */
  const serpPageTypes = (results, o) => {
    const c = { ...CFG, ...(o || {}) };
    const list = (Array.isArray(results) ? results : []).filter(r => r && S(r.url)).slice(0, 10);
    const counts = {};
    for (const r of list) { const k = shapeOf(r.url, r.title); counts[k] = (counts[k] || 0) + 1; }
    const read = list.length;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked[0] || null;
    const ours = OURS[S(c.page_type)] || '';
    // a dominant kind is one at least half the page agrees on, out of at least four results read: below that nobody can call it
    const dominant = top && read >= 4 && top[1] / read >= 0.5 && top[0] !== 'Other' ? top[0] : '';
    const mismatch = !!(dominant && ours && dominant !== ours);
    const text = !read ? 'The results page was not read, so what Google ranks for this search is unknown.'
      : !dominant ? 'Google ranks a mix for this search (' + ranked.map(x => x[1] + ' ' + x[0].toLowerCase()).join(', ') + '), so no page type is settled by the results.'
        : dominant.toLowerCase().replace(/^./, m => m.toUpperCase()) + 's are what Google ranks here: ' + top[1] + ' of the ' + read + ' results read'
          + (ours ? (mismatch ? ', while this plan writes a ' + ours.toLowerCase() + ' - expect to work harder, or write what the results page shows'
            : ', which is what this plan writes') : '') + '.';
    return { read, counts, dominant, dominant_count: top ? top[1] : 0, dominant_share: read ? Math.round((top ? top[1] : 0) / read * 100) : 0,
      ours, mismatch, text };
  };
  const BASIS_TEXT = { calibrated: 'calibrated with your Search Console data', modelled: 'modelled from provider volume', unknown: 'no estimate' };

  // ---- K7: clusters by shared results pages ----
  // entries: [{ keyword, urls: [top-10 urls], weight, volume }]. A head keyword takes every keyword that shares at least
  // min_shared_urls of its own top-10 URLs; the head is the strongest keyword not already in a cluster, so the cluster can be named
  // after it. Queries and trailing slashes are ignored when URLs are compared (the same page, written two ways).
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const serpClusters = (entries, o) => {
    const c = { ...CFG, ...(o || {}) };
    // B2-6: the depth every list is cut to before it is compared, and the number of shared URLs that depth demands. With `top_n` and
    // `min_overlap` set (the ladder: 7 and 0.4) the threshold is a SHARE of the depth - ceil(7 x 0.4) = 3 of 7 - instead of the flat
    // count discovery still uses, and both numbers travel on every cluster so a report can state what was compared and how deeply.
    const depth = (num(c.top_n) || 0) > 0 ? Math.round(c.top_n) : 0;
    const need = (num(c.min_overlap) || 0) > 0 && depth ? Math.max(1, Math.ceil(depth * c.min_overlap)) : c.min_shared_urls;
    const list = (Array.isArray(entries) ? entries : []).map(e => ({ keyword: low((e || {}).keyword),
      urls: (() => { const u = [...new Set(((e || {}).urls || []).map(urlKey).filter(Boolean))]; return depth ? u.slice(0, depth) : u; })(),
      weight: num((e || {}).weight) || 0, volume: num((e || {}).volume) }))
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
        if (shared.length >= need) members.push({ keyword: other.keyword, volume: other.volume, shared_urls: shared.length, shared: shared.slice(0, 3) });
      }
      if (!members.length) continue;
      used.add(head.keyword); members.forEach(m => used.add(m.keyword));
      members.sort((a, b) => b.shared_urls - a.shared_urls || (b.volume || 0) - (a.volume || 0));
      clusters.push({ head_keyword: head.keyword, keyword_count: members.length + 1, urls_compared: head.urls.length,
        min_shared_urls: need, top_n: depth, min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
        total_volume: [head, ...members].reduce((s, m) => s + (num(m.volume) || 0), 0),
        keywords: [{ keyword: head.keyword, volume: head.volume, shared_urls: head.urls.length, shared: [] }, ...members].slice(0, c.max_cluster_keywords) });
    }
    clusters.sort((a, b) => b.keyword_count - a.keyword_count || b.total_volume - a.total_volume);
    return { clusters, keywords_compared: ranked.length, min_shared_urls: need, min_urls: c.min_urls, top_n: depth,
      min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
      clustered: clusters.reduce((n, x) => n + x.keyword_count, 0) };
  };
  // "one page can serve all three: 'erp software uae' also covers 'erp system uae' (4 of the same top-10 pages), ..."
  const clusterText = (cl) => {
    const c = cl || {}; const others = (c.keywords || []).slice(1);
    if (!others.length) return '';
    const depthTxt = c.top_n ? 'top ' + c.top_n : 'top-10';
    return 'One page can target all ' + c.keyword_count + ': "' + c.head_keyword + '" shares '
      + others.map(k => k.shared_urls + ' of its ' + depthTxt + ' pages with "' + k.keyword + '"').join(', ')
      + ' - Google answers these searches with the same pages, so a second page would only split the signals.';
  };
  return { CFG, CLICK_LOSS, gscSeeds, calibrate, serpClusters, clusterText, featureLoss, lossApplied, lossText, serpPageTypes, shapeOf, liveChecks, ladderChecks, checkCost, urlKey, BASIS_TEXT, helpers: { bare, low, num } };
})();
// ---- topic radius (G32, 2026-10-13, system review FIX_PLAN.md G32; criterion K12 in CRITERIA_keywords_content.md) ----
// "Which topics is this website close enough to win, and which are a stretch?" — until now the system answered that per keyword
// (difficulty for your site, `_reach.js`) but never per TOPIC, so a plan could quietly wander off what the site actually sells: the
// 2026-10-11 review found the topic check was a warning on one keyword, never a picture of the radius (K12 scored 5 of 10).
// RAD.of() groups this run's keywords into topics and gives each one a verdict with the evidence behind it:
//   in_reach — the difficulty sits inside the site's reach (or the site already ranks in the top 20 for it), and something the site
//              sells or has a page about names the topic;
//   stretch  — within sight but above the reach, or nothing the site sells names it: possible, but it needs the easier topics (and
//              links) first;
//   far      — very hard for this site today, or not realistic at all (another company's brand, a government portal: `_fit_gate.js`
//              already refuses those keywords, so this is only about difficulty).
// Nothing here blocks anything on its own: it is the block of evidence a plan, a report and the app show, and `RAD.pick()` answers
// "is this topic inside the radius?" for a caller that wants to warn or to ask for a confirmation.
// It needs the reach kit in the same node (`difficultyForYou`, REACH_CFG, REACH_DIFF_LABEL) — the build asserts that.
const RAD = (() => {
  const CFG = { max_topics: 40, in_reach: ['easy', 'reachable'], stretch: ['hard'], min_service_tokens: 1 };
  const LABEL = { in_reach: 'Within reach', stretch: 'A stretch', far: 'Out of reach for now' };
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my', 'our', 'service', 'services', 'company', 'companies', 'solution', 'solutions', 'provider', 'providers', 'software', 'system', 'systems']);
  const S = (v) => String(v == null ? '' : v);
  const num = (v) => (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v);
  const tokens = (s) => { const out = []; for (const t of S(s).toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 2 || STOP.has(t)) continue;
    const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, ''); if (w && !out.includes(w)) out.push(w); } return out; };
  const shared = (a, b) => { const sb = new Set(b); return a.filter(t => sb.has(t)); };
  // what the site sells / already writes about, as one token set per source, so the evidence can name the matching one
  const anchors = (o) => {
    const list = [];
    for (const sv of (o.services || [])) if (S(sv).trim()) list.push({ kind: 'service', label: S(sv).trim(), tokens: tokens(sv) });
    for (const pg of (o.pages || [])) { const label = S(pg.title || pg.url); if (label) list.push({ kind: 'page', label, url: S(pg.url), tokens: tokens([pg.title, pg.keyword, S(pg.url).replace(/^https?:\/\/[^/]+/i, '')].join(' ')) }); }
    for (const tp of (o.site_topics || [])) if (S(tp).trim()) list.push({ kind: 'topic', label: S(tp).trim(), tokens: tokens(tp) });
    return list.filter(a => a.tokens.length);
  };
  // one topic's verdict and the evidence behind it
  const judge = (t, reach, anchorList, o) => {
    const kd = num(t.kd), pos = num(t.your_position);
    const diff = difficultyForYou(kd, reach, { position: pos });
    const toks = tokens([t.topic, t.primary_keyword, (t.keywords || []).map(k => S(k.keyword || k)).join(' ')].join(' '));
    const hits = anchorList.map(a => ({ a, common: shared(toks, a.tokens) })).filter(x => x.common.length >= CFG.min_service_tokens)
      .sort((x, y) => y.common.length - x.common.length);
    const near = hits[0] || null;
    const evidence = [];
    if (pos != null && pos >= 1 && pos <= REACH_CFG.easy_position) evidence.push('you already rank #' + pos + ' for "' + t.primary_keyword + '"');
    evidence.push(kd == null ? 'no difficulty figure for "' + t.primary_keyword + '" (counted as ' + (reach + REACH_CFG.unknown_kd) + ', your reach is ' + reach + ')'
      : 'difficulty ' + kd + ' against your reach ' + reach);
    if (near) evidence.push(near.a.kind === 'service' ? 'it matches what you sell: "' + near.a.label + '"'
      : near.a.kind === 'page' ? 'you already have a page on it: ' + (near.a.url || near.a.label)
      : 'it is one of your topics: "' + near.a.label + '"');
    else if (anchorList.length) evidence.push('nothing you sell or have a page about names this topic');
    if (num(t.volume) != null) evidence.push(Number(t.volume).toLocaleString('en-GB') + ' searches a month across ' + (num(t.keyword_count) || 1) + ' keyword(s)');
    let verdict = CFG.in_reach.includes(diff) ? 'in_reach' : CFG.stretch.includes(diff) ? 'stretch' : 'far';
    let reason = verdict === 'in_reach' ? REACH_DIFF_LABEL[diff] : verdict === 'stretch' ? 'above your reach today, but within sight' : REACH_DIFF_LABEL[diff] || 'very hard for your site today';
    // off what the site sells: a topic can be easy to rank for and still be the wrong topic, so it is a stretch at best
    if (verdict === 'in_reach' && !near && anchorList.length && !(pos != null && pos >= 1 && pos <= REACH_CFG.easy_position)) {
      verdict = 'stretch'; reason = 'the difficulty is inside your reach, but nothing you sell or write about names this topic';
    }
    return { topic: t.topic, primary_keyword: t.primary_keyword, kd: kd, volume: num(t.volume), keyword_count: num(t.keyword_count) || (t.keywords || []).length || 1,
      your_position: pos, difficulty_for_you: diff, verdict, verdict_label: LABEL[verdict], reason, basis: near ? near.a.kind : 'none', matched: near ? near.a.label : '', evidence };
  };
  /**
   * o: { reach, reach_method?, topics: [{ topic, primary_keyword, kd, volume, keyword_count, your_position?, keywords? }],
   *      services?, pages?, site_topics?, checked_at?, domain? }
   * -> { reach, in_reach: [], stretch: [], far: [], topics: [], summary, note, measured }
   */
  const of = (o) => {
    const x = o || {};
    const reach = num(x.reach) == null ? null : Number(x.reach);
    const r = reach == null ? 10 : reach;
    const anchorList = anchors(x);
    const topics = (x.topics || []).filter(t => t && S(t.topic || t.primary_keyword)).slice(0, CFG.max_topics)
      .map(t => judge({ topic: S(t.topic || t.primary_keyword), primary_keyword: S(t.primary_keyword || t.topic), kd: t.kd, volume: t.volume, keyword_count: t.keyword_count, your_position: t.your_position, keywords: t.keywords }, r, anchorList, x));
    const pick1 = (v) => topics.filter(t => t.verdict === v);
    const inR = pick1('in_reach'), st = pick1('stretch'), far = pick1('far');
    const name = (list, k) => list.slice(0, k).map(t => '"' + t.topic + '"').join(', ');
    const summary = !topics.length ? 'Not enough keyword data to draw your topic radius yet.'
      : (inR.length ? inR.length + ' topic(s) are within reach for ' + S(x.domain || 'your site') + ' today (' + name(inR, 3) + (inR.length > 3 ? ' …' : '') + ')' : 'No topic in this research is within reach today')
        + (st.length ? '; ' + st.length + ' are a stretch (' + name(st, 3) + (st.length > 3 ? ' …' : '') + ')' : '')
        + (far.length ? '; ' + far.length + ' are out of reach for now (' + name(far, 2) + (far.length > 2 ? ' …' : '') + ')' : '') + '.';
    const note = reach == null
      ? 'Your reach could not be measured this run, so these verdicts use the smallest default (' + r + '): treat them as provisional.'
      : 'Your reach is the difficulty your site already wins — the 75th percentile of the difficulty of the keywords it ranks in the top 10 for'
        + (x.reach_method === 'size' ? ' (measured from the size of your ranking profile this time)' : x.reach_method === 'default' ? ' (no ranking data: the default for a new site)' : '')
        + '. A stretch topic is not a no: it is the one to come back to once the topics within reach are won and links have been earned.';
    return { reach, reach_method: S(x.reach_method), measured: reach != null, topics, in_reach: inR, stretch: st, far, summary, note, checked_at: S(x.checked_at) };
  };
  /** is one topic (or keyword) inside the radius? -> the topic's verdict, or null when it is not among the topics */
  const pick = (radius, topic) => { const t = tokens(topic); if (!t.length) return null;
    const all = ((radius || {}).topics || []).map(x => ({ x, common: shared(t, tokens([x.topic, x.primary_keyword].join(' '))) }))
      .filter(o => o.common.length).sort((a, b) => b.common.length - a.common.length);
    return all.length ? all[0].x : null; };
  /** one topic's verdict as a sentence (a plan's notes, a tooltip): "A stretch — … (difficulty 55 against your reach 28; …)" */
  const line = (t) => !t ? '' : LABEL[t.verdict] + ' — ' + t.reason + ' (' + (t.evidence || []).join('; ') + ')';
  /** the rows a report prints, in reading order: within reach, then the stretches, then what is out of reach for now */
  const rows = (radius) => { const rad = radius || {}; return [...(rad.in_reach || []), ...(rad.stretch || []), ...(rad.far || [])]; };
  /**
   * R23 (2026-10-14, FIX_PLAN.md §3.12): the radius test for ONE pair — is this keyword on the topic of the ladder's head keyword?
   * The ladder pool already asks for one shared word with the head, which is how "azure api management monetization" (volume 10,
   * trend -100%) became the single rung of a ladder for "azure cloud migration dubai" in exec 549: "azure" was enough. Half of the
   * head's meaningful words have to be in the keyword (at least one). A head of one or two meaningful words is too short to judge a
   * topic by, so one shared word is enough there — the AI relevance screen and the fit gate stay the other two filters.
   * -> { ok, shared, need, head_words, reason }   (reason is empty when it passes; it is the sentence the plan prints when it does not)
   */
  const headFit = (headKw, kw) => {
    const h = tokens(headKw), k = tokens(kw);
    if (!h.length || !k.length) return { ok: true, shared: [], need: 0, head_words: h, reason: '' };
    const common = shared(h, k);
    const need = Math.max(1, Math.ceil(h.length / 2));
    const q = (list) => list.map(t => '"' + t + '"').join(', ');
    if (common.length >= need) return { ok: true, shared: common, need, head_words: h, reason: '' };
    return { ok: false, shared: common, need, head_words: h,
      reason: common.length
        ? 'it is not on this ladder\'s topic: it shares only ' + q(common) + ' with "' + S(headKw) + '" (' + common.length + ' of the ' + h.length + ' words that matter, ' + need + ' needed)'
        : 'it is not on this ladder\'s topic: it shares none of the words that matter in "' + S(headKw) + '" (' + q(h) + ')' };
  };
  return { of, pick, rows, line, headFit, LABEL, CFG, tokens };
})();
// B2-4 (2026-10-15, benchmark area 2, docs/system-review-2026-10-14/BENCH_AREA2_ladders.md gap 5, criterion K7): one results page per
// rung candidate, so the rungs can be grouped by what Google ACTUALLY answers each search with instead of by the AI's topic label.
//   Until today `Ladder_Pool` initialised `competitors: []` and never filled it (the ladder's four Labs pulls return `serp_info.
// serp_item_types` and no URL list), so `KWI.serpClusters` - which exists, and which discovery uses - had nothing to work on, and two
// searches Google answers with the same pages could become two pages. That is the duplication the "one search, one page" rule exists
// to prevent. The owner chose the DIRECT route (one SERP call per keyword, exact) over the competitor-domain approximation.
//   The bound, and why it is where it is: a full ladder plans at most 11 pages (rung limits 4 / 4 / 3) and a page carries at most 7
// keywords, so KWI.CFG.ladder_serp_checks (24) covers more than twice the pages a plan can hold, at 24 x $0.002 = $0.048 a ladder.
// Everything below the cap is the pool's own opportunity order, after the same two filters the rungs are chosen by (the fit gate, which
// `Ladder Pool` already applied, and RAD.headFit, which `Ladder Plan` applies) - so no call is ever bought for a keyword the plan would
// have thrown away. A `free_only` run, an explicit `ladder_serp_checks: 0` and a pool with fewer than two comparable keywords make no
// call at all, and the plan says which of those it was.
const d = $input.first().json;
const head = String(d.keyword || '').toLowerCase().trim();
const cands = ((d.research || {}).candidates || []).filter(k => k && k.keyword);
const cap = KWI.ladderChecks(d.ladder_serp_checks);
const freeOnly = d.free_only === true;
// the head term keeps the results page the run already bought (competitors_summary), so it is never re-bought here
const onTopic = cands.filter(k => String(k.keyword).toLowerCase() !== head).filter(k => { try { return RAD.headFit(head, k.keyword).ok; } catch (e) { return true; } });
const wanted = onTopic.slice(0, cap);
const plan = { asked: wanted.length, candidates: cands.length, on_topic: onTopic.length, cap, cap_basis: KWI.CFG.ladder_serp_checks === cap
    ? 'the standing cap of ' + KWI.CFG.ladder_serp_checks + ' keywords a ladder may buy a results page for' : 'the cap set for this run (' + cap + ')',
  cost_usd: KWI.checkCost(wanted.length), price_usd: KWI.CFG.serp_check_usd, top_n: 7, min_overlap: 0.4,
  left_uncompared: Math.max(0, onTopic.length - wanted.length) };
const skip = freeOnly ? 'this run was asked for free sources only, so no results page was bought and the rungs are grouped by topic instead'
  : cap <= 0 ? 'results-page comparison is switched off for this run (ladder_serp_checks 0), so the rungs are grouped by topic instead'
    : wanted.length < 2 ? 'only ' + wanted.length + ' rung candidate(s) are on this ladder\'s topic, and a comparison needs at least two, so nothing was bought'
      : '';
if (skip) return [{ json: { cluster_check: false, skip_reason: skip, ...plan, asked: 0, cost_usd: 0 } }];
return wanted.map((k, i) => ({ json: { cluster_check: true, keyword: k.keyword, location_code: d.location_code, language_code: d.language_code || 'en',
  n: i + 1, of: wanted.length, weight: k.pre_score ?? k.opportunity ?? 0, volume: k.volume ?? null, ...plan } }));
