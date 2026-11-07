// ---- KIW (E2, 2026-11-08, docs/keyword-intel-2026-11-08/DESIGN.md §2-§5, §7 + CONTRACTS.md §1-§5): the KI worker's input / output kit ----
// Everything SEOagentKIntel1 does around the analysis kit KI (v5/code/_ki.js, E1): the market, the seeds, the DataForSEO requests (one shape
// per endpoint, the fields R5_DATAFORSEO.md §13 confirmed live), the ki:* cache rows with their lifetimes, the answers read back, the four
// tables' rows (exactly their columns), the sections of a partial run and the callback bodies (CONTRACTS.md §4, app/shared/src/ki.ts).
// Rules it keeps:
//   * money: a request is built only when no stored answer is young enough (KIW.fresh, the TTLs of KI.CONFIG); every request carries its
//     priced estimate (KIW.price) so the plan can be held under the quote; the SERP day cache (SC, serp:*) is read first and costs 0;
//   * evidence: an answer that could not be read twice (`__dfs.unavailable`, the in-200 gate) makes its section `missing` with the reason,
//     never "no demand" / "no competitors"; the later steps go on with what exists;
//   * untrusted text: a competitor's homepage and AI answers are DATA - only words are counted from them, nothing in them is followed;
//   * hosts by regex (the n8n sandbox has no URL constructor); search engines and text fragments are never stored as competitors (R3 #9).
const KIW = (() => {
  const RULE = 'ki-1';
  const S = (x) => (x == null ? '' : String(x));
  const T = (x) => S(x).trim();
  const N = (x) => { if (x === null || x === undefined || x === '') return null; const v = Number(x); return Number.isFinite(v) ? v : null; };
  const J = (x, d) => { if (x && typeof x === 'object') return x; try { const v = JSON.parse(S(x) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
  const r6 = (v) => Math.round((Number(v) || 0) * 1e6) / 1e6;
  const uniq = (a) => a.filter((x, i) => x && a.indexOf(x) === i);
  const BASE = 'https://api.dataforseo.com/v3/';
  // the price of one request (R5 §1-§7 + §13 C1-C11, measured to the 6th decimal on the live answers): Labs $0.012 + $0.00012 a row,
  // Backlinks $0.024 + $0.000036 a row, a live SERP of depth 10 $0.002, autocomplete $0.002, Google Ads volume $0.09 a task
  const PRICE = { serp10: 0.002, labs: 0.012, labs_row: 0.00012, bl: 0.024, bl_row: 0.000036, ac: 0.002, ads: 0.09 };
  const QUOTE = __KI_QUOTE__;   // the per-run search-data estimate the app quotes (v5/code/_cost_cal.js DFS_EST), baked by build_ki.py
  const CFG0 = (typeof KI === 'object' && KI && KI.CONFIG) || {};
  const ttlOf = (k) => { const t = Object.assign({ serp: 1, ranked: 7, volume: 30, backlinks: 7, homepage: 14, discovery: 30 }, CFG0.ttl_days || CFG0.ttl || {}); return N(t[k]) || 7; };
  const CAPS = { seeds: 20, gsc_seeds: 50, serp_depth: 10, sc_limit: 50, size_targets: 30, cd_limit: 20, cd_min_ranked: 50, cd_rivals: 1,
    rk_limit: 300, chosen_max: 5, home_reads: 8, sitemaps: 5, autocomplete: 10, ideas_limit: 300, sugg_n: 2, sugg_limit: 200, related_n: 1,
    related_limit: 150, pi_limit: 500, pi_rank: 10, top_n: 300, top_m: 60, tp_urls: 60, overview_max: 700, intent_max: 1000, ads_max: 1000,
    striking_min: 8, striking_max: 20, striking_impr: 100, striking_impr_small: 30, small_site_impr: 2000,
    ...((CFG0.caps && typeof CFG0.caps === 'object') ? CFG0.caps : {}) };
  // ---- hosts and words ----
  const host = (u) => S(u).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#\s].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  const HOSTRE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
  // a public host only: no IP literal, no localhost / internal names (the SSRF guard every fetched address passes, as Normalize Input's domainOk)
  const publicHost = (h0) => { const h = host(h0); if (!h || h.length > 253 || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':')) return false;
    if (/(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet|test|example|invalid|arpa)$/.test(h)) return false; return HOSTRE.test(h); };
  const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia)\.[a-z.]{2,6}$/;
  const isBusinessHost = (h0, client) => { const h = host(h0); return publicHost(h) && !SEARCH.test(h) && h !== host(client); };
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
  const keyOf = (k) => (typeof KI === 'object' && KI && typeof KI.key === 'function') ? KI.key(k) : normKw(k);
  const hash = (s) => { let h1 = 0x811c9dc5, h2 = 0x7fffffff; const t = S(s); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (Math.imul(h2 + c, 2654435761) ^ (h2 >>> 13)) >>> 0; }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8); };
  // ---- the market (CONTRACTS §3): the site's main country; a different country in the request is refused ----
  const PLACES = { AE: { word: 'uae', cities: ['dubai', 'abu dhabi'] }, SA: { word: 'saudi arabia', cities: ['riyadh', 'jeddah'] }, GB: { word: 'uk', cities: ['london'] },
    US: { word: 'usa', cities: [] }, PK: { word: 'pakistan', cities: ['lahore', 'karachi'] }, IN: { word: 'india', cities: ['bangalore', 'mumbai'] }, SG: { word: 'singapore', cities: [] },
    CA: { word: 'canada', cities: ['toronto'] }, AU: { word: 'australia', cities: ['sydney'] }, DE: { word: 'deutschland', cities: ['berlin'] } };
  const countryOf = (raw, COUNTRIES) => { const r = T(raw); if (!r) return null; const C = COUNTRIES || {};
    const name = Object.keys(C).find(n => n.toLowerCase() === r.toLowerCase()) || Object.keys(C).find(n => S(C[n].iso).toUpperCase() === r.toUpperCase());
    return name ? { name, ...C[name] } : null; };
  const market = (reqCountry, site, COUNTRIES) => {
    const req = countryOf(reqCountry, COUNTRIES); const s = site || {};
    const siteC = countryOf(s.country, COUNTRIES) || (N(s.location_code) ? (() => { const n = Object.keys(COUNTRIES || {}).find(k => COUNTRIES[k].code === N(s.location_code)); return n ? { name: n, ...COUNTRIES[n] } : null; })() : null);
    if (siteC && req && siteC.code !== req.code) return { ok: false, reason: 'market_mismatch', detail: 'this website is measured in ' + siteC.name + '; the request asked for ' + req.name, site_country: siteC.name, asked: req.name };
    const c = siteC || req;
    if (!c) return { ok: false, reason: 'no_market', detail: 'no country is on file for this website and the request named none we know' };
    const lang = T(s.language_code) && siteC ? T(s.language_code).toLowerCase() : c.lang;
    return { ok: true, country: c.name, iso: c.iso, location_code: c.code, language_code: lang, market: c.iso + '-' + lang, from: siteC ? 'site' : 'request' };
  };
  // ---- the services as a list (R3 #4: services_json holds fragments of one sentence) ----
  const PRODUCTS = /\b(microsoft dynamics 365|dynamics 365|business central|finance (?:and|&) operations|dynamics crm|power bi|power platform|copilot studio|sap(?: b1| business one)?|odoo|netsuite|salesforce|zoho|open ?edx|moodle|hubspot|peppol|oracle|sage)\b/i;
  const shortService = (s) => { let t = normKw(s).replace(/\([^)]*\)/g, ' ').replace(/[–—]/g, '-');
    t = t.split(/[:;,]|\s-\s|\bin the\b|\bin\b(?= (?:the )?(?:uae|gcc|dubai|middle east|region|saudi|pakistan))|\bfor\b|\bwith\b|\bacross\b/)[0].trim();
    const w = t.split(' ').filter(Boolean); while (w.length && /^(and|or|the|a|an|we|provide|offer|our|of|to)$/.test(w[0])) w.shift(); while (w.length && /^(and|or|the|a|an|of|to|in)$/.test(w[w.length - 1])) w.pop();
    const out = w.slice(0, 4).join(' ').replace(/[^\p{L}\p{N}&+.# -]+/gu, ' ').replace(/\s+/g, ' ').trim(); return out.length >= 3 && out.split(' ').length >= 1 ? out : ''; };
  const services = (site, req) => { const s = site || {}; const raw = [...J(s.declared_services, []), ...J(s.services_json, [])].map(S);
    const extra = S((req || {}).business).split(/[\n;]+/).map(T).filter(x => x.length > 2 && x.length < 80);
    return uniq([...raw, ...extra].map(shortService).filter(Boolean)).slice(0, 12); };
  const productsOf = (svc) => uniq((svc || []).map(x => { const m = S(x).match(PRODUCTS); return m ? m[1].toLowerCase() : ''; }));
  // ---- the run plan's seeds (DESIGN §2.1): services x market, GSC, tracked, ladder heads, the request's own; fit-gated, capped ----
  const compSeeds = (o) => {
    const P = PLACES[o.iso] || { word: S(o.country).toLowerCase(), cities: [] }; const city = T(o.city).toLowerCase() || P.cities[0] || P.word;
    const out = []; const add = (k, src, w) => { const kw = normKw(k); if (!kw || kw.split(' ').length > 8 || out.some(x => x.keyword === kw)) return; out.push({ keyword: kw, source: src, weight: w }); };
    for (const s of (o.seeds || [])) add(s, 'seed', 1);
    for (const s of (o.services || []).slice(0, 6)) { add(s + ' ' + P.word, 'service', 1); add(s + ' company ' + city, 'service', 0.9); add('best ' + s + ' ' + city, 'service', 0.8); }
    for (const p of (o.products || []).slice(0, 3)) add(p + ' partner ' + P.word, 'service', 1);
    for (const q of (o.gsc || []).slice(0, CAPS.gsc_seeds)) add(q.query, 'gsc', Math.min(1, 0.4 + Math.log10(1 + (N(q.impressions) || 0)) / 5));
    for (const k of (o.tracked || [])) add(k, 'tracked', 0.8);
    for (const k of (o.ladders || [])) add(k, 'ladder', 0.8);
    const kept = [], refused = [];
    for (const s of out) { const g = o.gate ? o.gate(s.keyword) : { ok: true }; if (g.ok) kept.push(s); else refused.push({ keyword: s.keyword, reason: g.reason, detail: g.detail }); }
    return { seeds: kept.slice(0, CAPS.seeds), refused, dropped: Math.max(0, kept.length - CAPS.seeds) };
  };
  // ---- requests (one shape per endpoint; the fields R5 §13 confirmed live) ----
  const req = (call, path, task, est, meta) => ({ ki_call: call, endpoint: BASE + path, body: [task], est_usd: r6(est), ...(meta || {}) });
  const loc = (m) => ({ location_code: m.location_code, language_code: m.language_code });
  const serpBody = (kw, m) => ({ keyword: normKw(kw), ...loc(m), device: 'desktop', depth: CAPS.serp_depth });   // no load_async_ai_overview: it doubles the price (R5 §13 C1)
  const rq = {
    serp: (kw, m) => req('serp', 'serp/google/organic/live/advanced', serpBody(kw, m), PRICE.serp10, { keyword: normKw(kw) }),
    serpCompetitors: (kws, m) => req('serp_competitors', 'dataforseo_labs/google/serp_competitors/live', { keywords: kws.slice(0, 200), ...loc(m), include_subdomains: true, limit: CAPS.sc_limit }, PRICE.labs + CAPS.sc_limit * PRICE.labs_row),
    trafficTargets: (targets, m, call) => req(call || 'bulk_te', 'dataforseo_labs/google/bulk_traffic_estimation/live', { targets: targets.slice(0, 1000), ...loc(m), item_types: ['organic'] }, PRICE.labs + targets.length * PRICE.labs_row),
    refDomains: (targets) => req('bulk_rd', 'backlinks/bulk_referring_domains/live', { targets: targets.slice(0, 1000) }, PRICE.bl + targets.length * PRICE.bl_row),
    competitorsDomain: (d, m) => req('cd:' + host(d), 'dataforseo_labs/google/competitors_domain/live', { target: host(d), ...loc(m), exclude_top_domains: false, max_rank_group: 20, limit: CAPS.cd_limit }, PRICE.labs + CAPS.cd_limit * PRICE.labs_row, { target: host(d) }),
    ranked: (d, m) => req('rk:' + host(d), 'dataforseo_labs/google/ranked_keywords/live', { target: host(d), ...loc(m), item_types: ['organic'], limit: CAPS.rk_limit,
      order_by: ['ranked_serp_element.serp_item.etv,desc'], filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20]] }, PRICE.labs + CAPS.rk_limit * PRICE.labs_row, { target: host(d) }),
    autocomplete: (kw, m) => req('ac', 'serp/google/autocomplete/live/advanced', { keyword: normKw(kw), ...loc(m), client: 'gws-wiz-serp' }, PRICE.ac, { keyword: normKw(kw) }),
    ideas: (kws, m) => req('labs_ideas', 'dataforseo_labs/google/keyword_ideas/live', { keywords: kws.slice(0, 20), ...loc(m), limit: CAPS.ideas_limit, include_serp_info: false, ignore_synonyms: true }, PRICE.labs + CAPS.ideas_limit * PRICE.labs_row),
    suggestions: (kw, m) => req('labs_suggestions', 'dataforseo_labs/google/keyword_suggestions/live', { keyword: normKw(kw), ...loc(m), limit: CAPS.sugg_limit, include_seed_keyword: true, ignore_synonyms: true }, PRICE.labs + CAPS.sugg_limit * PRICE.labs_row, { keyword: normKw(kw) }),
    related: (kw, m) => req('labs_related', 'dataforseo_labs/google/related_keywords/live', { keyword: normKw(kw), ...loc(m), depth: 2, limit: CAPS.related_limit, include_seed_keyword: true }, PRICE.labs + CAPS.related_limit * PRICE.labs_row, { keyword: normKw(kw) }),
    // `*` after a slash is the live-confirmed wildcard (R5 §13 C4); union keeps a row where any one competitor ranks; rows are cut to the
    // top 10 here, after the answer (the server filter path `intersection_result.$page.*` is not confirmed live, fixes/E2.md)
    intersection: (pages, excl, m) => { const p = {}; pages.slice(0, 20).forEach((u, i) => { p[String(i + 1)] = u; });
      return req('page_intersection', 'dataforseo_labs/google/page_intersection/live', { pages: p, exclude_pages: excl.slice(0, 10), intersection_mode: 'union', ...loc(m), item_types: ['organic'],
        order_by: ['keyword_data.keyword_info.search_volume,desc'], limit: CAPS.pi_limit }, PRICE.labs + CAPS.pi_limit * PRICE.labs_row, { pages: pages.slice(0, 20) }); },
    overview: (kws, m) => req('labs_overview', 'dataforseo_labs/google/keyword_overview/live', { keywords: kws.slice(0, CAPS.overview_max), ...loc(m), include_serp_info: false }, PRICE.labs + kws.length * PRICE.labs_row),
    intent: (kws) => req('labs_intent', 'dataforseo_labs/google/search_intent/live', { keywords: kws.slice(0, CAPS.intent_max) }, PRICE.labs + kws.length * PRICE.labs_row),   // keywords only: location and language are dropped silently (R5 §13 C8)
    adsVolume: (kws, m) => req('ads_volume', 'keywords_data/google_ads/search_volume/live', { keywords: kws.slice(0, CAPS.ads_max), ...loc(m) }, PRICE.ads),
  };
  const price = (reqs) => r6((reqs || []).reduce((s, r) => s + (Number(r.est_usd) || 0), 0));
  // ---- answers ----
  const task0 = (a) => (((a || {}).tasks || [])[0]) || {};
  const result0 = (a) => ((task0(a).result || [])[0]) || {};
  const itemsOf = (a) => { const it = result0(a).items; return Array.isArray(it) ? it : []; };
  const okAnswer = (a) => { if (!a || a.error) return false; if (typeof RT === 'object' && RT && RT.dfs) return RT.dfs(a).ok; const t = task0(a); return Number(t.status_code) === 20000; };
  const whyFailed = (a) => { if (!a) return 'no answer'; if (typeof RT === 'object' && RT && RT.dfs) return RT.dfs(a).why || 'could not be read'; return S(task0(a).status_message || (a.error && (a.error.message || a.error)) || 'could not be read'); };
  // pair a gated call's answers with the requests that went out (both in request order); an index with no answer is a failure
  const paired = (reqs, answers) => (reqs || []).map((q, i) => { const a = (answers || [])[i]; const ok = okAnswer(a); return { q, a: a || null, ok, why: ok ? '' : whyFailed(a) }; });
  // ---- the ki:* cache (seo_cache, kind 'ki', one row per site so a company only ever reads its own rows) ----
  const cacheKey = (siteId, what, ...parts) => 'ki:' + S(siteId) + ':' + what + (parts.length ? ':' + parts.map(S).join(':') : '');
  const cacheRead = (rows, k) => { const r = (rows || []).find(x => x && x.key === k); if (!r) return null; const v = J(r.value, null); return v && typeof v === 'object' ? { ...v, _updated_at: S(r.updated_at) } : null; };
  const fresh = (entry, kind, now, force) => { if (!entry || force) return false; const t = Date.parse(S(entry.fetched_at || entry._updated_at)); if (!Number.isFinite(t)) return false;
    return (Date.parse(S(now)) || Date.now()) - t < ttlOf(kind) * 864e5; };
  const cacheRow = (siteId, k, value) => ({ key: k, kind: 'ki', site_id: S(siteId), value: JSON.stringify(value), updated_at: new Date().toISOString() });
  // ---- SERP readings: the cache first (SC), then this run's answers; every organic / local item through SU (google.com/goto, R5 §13 L-1) ----
  const fixAnswer = (a) => { if (!a || !Array.isArray(a.tasks)) return a; return { ...a, tasks: a.tasks.map(t => t && Array.isArray(t.result) ? { ...t, result: t.result.map(r => r && Array.isArray(r.items) ? { ...r, items: SU.normalize(r.items) } : r) } : t) }; };
  const top10Of = (a) => { const items = SU.normalize(itemsOf(a)); const org = items.filter(x => x && x.type === 'organic').sort((x, y) => (N(x.rank_group) || 99) - (N(y.rank_group) || 99)).slice(0, 10);
    return org.map(x => { const h = host(x.domain || x.url); return { url: S(x.url), host: h && !SEARCH.test(h) ? h : '', title: S(x.title).slice(0, 160), pos: N(x.rank_group) || null,
      exact: x.url_exact !== false && !SU.isRedirect(x.url), type: (typeof KI === 'object' && KI.pageType) ? KI.pageType({ ...x, domain: h }) : 'unknown', key: h ? h + (x.url_exact === false ? '~' : '') + S(x.url).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/\/$/, '') : '' }; }); };
  const extrasOf = (a) => { const items = itemsOf(a); const out = { paa: [], related: [], forum: [], aio: false, local: false };
    for (const x of items) { if (!x) continue;
      if (x.type === 'people_also_ask') for (const q of (x.items || [])) { const t = T(q && (q.title || q.question)); if (t) out.paa.push(t); }
      if (x.type === 'related_searches') for (const q of (x.items || [])) { const t = T(typeof q === 'string' ? q : (q && (q.title || q.keyword))); if (t) out.related.push(t); }
      if (x.type === 'discussions_and_forums') for (const q of (x.items || [])) { const t = T(q && q.title); if (t) out.forum.push(t); }
      if (x.type === 'ai_overview') out.aio = true; if (x.type === 'local_pack') out.local = true; }
    return out; };
  // ---- table rows: exactly the columns (a Data Table upsert maps every input field) ----
  const COLS = __KI_COLS__;   // { KI_RUNS: [...], KI_COMP: [...], KI_KW: [...], KI_GAPS: [...] } from ladder_common.py, baked by build_ki.py
  const BOOL = new Set(['scored', 'declared', 'needs_review', 'low_confidence', 'is_head', 'striking']);
  const shape = (table, o) => { const out = {}; for (const c of COLS[table]) { let v = o[c]; if (v === undefined) v = null;
    if (v !== null && typeof v === 'object') v = JSON.stringify(v); if (BOOL.has(c) && v !== null) v = v === true || v === 'true'; out[c] = v; } return out; };
  // ---- sections of a run (CONTRACTS §4: [{key, state: ok|partial|missing|skipped, reason, rows}]) ----
  const sections = () => { const list = []; const api = {
    set: (key, state, reason, rows) => { const i = list.findIndex(s => s.key === key); const v = { key, state, reason: S(reason).slice(0, 300), rows: N(rows) || 0 }; if (i >= 0) list[i] = v; else list.push(v); return api; },
    list: () => list.slice(), status: () => { if (!list.length) return 'failed'; const miss = list.filter(s => s.state === 'missing').length, part = list.filter(s => s.state === 'partial').length, ok = list.filter(s => s.state === 'ok').length;
      if (!ok && !part) return 'failed'; return (miss || part) ? 'partial' : 'ok'; } }; return api; };
  // the state of one gated call for its section: what came back, and why the rest did not
  const callState = (pairs, what) => { const n = pairs.length, okN = pairs.filter(p => p.ok).length;
    if (!n) return { state: 'skipped', reason: what + ': nothing needed asking (stored answers were fresh)' };
    if (!okN) return { state: 'missing', reason: what + ' could not be read: ' + (pairs[0].why || 'no answer') + ' (asked twice; nothing was scored from it)' };
    if (okN < n) return { state: 'partial', reason: what + ': ' + okN + ' of ' + n + ' answers read; ' + (pairs.find(p => !p.ok).why || 'some could not be read') };
    return { state: 'ok', reason: '' }; };
  // ---- the money one gated call measured, each task once by its own id across both attempts (R28) ----
  const measured = (answersNodeItems) => { const ev = ((answersNodeItems || []).find(j => j && j.__dfs) || {}).__dfs; return ev ? (Number(ev.cost_usd) || 0) : 0; };
  const LABELS = { measured: 'measured', provider_estimate: 'estimate from the data provider', modelled: 'our estimate', inferred: 'AI judgement' };
  const STAGES = { competitors: 'ki_competitors', keyword_research: 'ki_research' };
  const baseBody = (q, status, reason, extra) => ({ stage: STAGES[q.kind] || 'ki_competitors', status, reason: S(reason), request_id: S(q.request_id), run_id: S(q.run_id), domain: S(q.domain),
    market: S(q.market), mode: S(q.ki_mode || 'off'), rule_version: RULE, sections: [], summary: {}, labels: LABELS, run_ledger: null,
    run_cost_estimate_usd: 0, run_cost_estimate_basis: '', run_cost_estimate_state: 'modelled', ...(extra || {}) });
  const emptyLists = (kind) => (kind === 'keyword_research' ? { clusters: [], striking: [], questions: [], gaps_summary: {}, plan: [] } : { competitors: [], listings: [], platforms: [] });
  const refusalBody = (q, reason, note) => ({ ...baseBody(q, 'refused', reason, { note: S(note), run_cost_estimate_usd: 0, run_cost_estimate_state: 'measured',
    run_cost_estimate_basis: 'refused before any paid call: no search data was read and no model was asked' }), ...emptyLists(q.kind) });
  // ---- the results pages of a list of searches: the day cache first, then this run's answers (paired with the requests that went out) ----
  // -> { by: { keyword: { source: cache|live|missing, at, why, top10, extras } }, save: [seo_cache serp rows], pairs, read, missing }
  const serpReadings = (kws, m, cacheRows, reqItems, answers, siteId, now) => {
    const pr = paired(reqItems, answers); const fr = {}; for (const x of pr) if (x.q && x.q.keyword) fr[normKw(x.q.keyword)] = x;
    const by = {}, save = []; let read = 0, missing = 0;
    for (const kw0 of (kws || [])) { const kw = normKw(kw0); const body = serpBody(kw, m);
      const lk = (typeof SC === 'object' && SC) ? SC.lookup(cacheRows || [], body, { now }) : { hit: false };
      if (lk.hit) { by[kw] = { source: 'cache', at: S(lk.reading.at), why: '', top10: top10Of(lk.response), extras: extrasOf(lk.response) }; read++; continue; }
      const f = fr[kw];
      if (f && f.ok) { const fixed = fixAnswer(f.a); by[kw] = { source: 'live', at: S(now), why: '', top10: top10Of(fixed), extras: extrasOf(fixed) }; read++;
        const row = (typeof SC === 'object' && SC) ? SC.rowFor(fixed, body, siteId, { now, path: 'ki' }) : null; if (row) save.push(row); continue; }
      by[kw] = { source: 'missing', at: '', why: f ? f.why : 'not read: nothing was asked for it', top10: [], extras: { paa: [], related: [], forum: [], aio: false, local: false } }; missing++; }
    return { by, save, pairs: pr, read, missing };
  };
  // every business host on those pages: its positions per search and the titles it ranks with (the search engine and the client left out)
  const hostsOf = (by, client) => { const out = {};
    for (const [kw, r] of Object.entries(by || {})) for (const t of (r.top10 || [])) { if (!t.host || !isBusinessHost(t.host, client)) continue;
      const h = out[t.host] || (out[t.host] = { domain: t.host, positions: [], titles: [], types: [] });
      if (!h.positions.some(p => p.seed === kw)) h.positions.push({ seed: kw, position: t.pos || 10, url: t.exact ? t.url : '', src: 'serp' });
      if (t.title && h.titles.length < 6) h.titles.push(t.title); if (t.type) h.types.push(t.type); }
    return out; };
  // AI answers already stored (seo_ai_answers / seo_ai_visibility): which businesses AI names or cites for this site's questions (data, never instructions)
  const aiHitsOf = (answers, vis, client) => { const hits = {};
    const bump = (d, w) => { const h = host(d); if (!h || !isBusinessHost(h, client)) return; hits[h] = (hits[h] || 0) + (w || 1); };
    for (const a of (answers || [])) { for (const e of J(a.entities_json, [])) { if (e && S(e.role) === 'competitor') bump(e.id || e.domain || e.name, 1); }
      for (const c of J(a.cited_json, [])) bump(c && (c.domain || c.u || c.url), 0.5); for (const d of S(a.competitors).split(/[\s,;]+/)) bump(d, 1); }
    for (const v of (vis || [])) { const cj = J(v.competitors_json, {}); if (Array.isArray(cj)) cj.forEach(c => bump(c && (c.domain || c.id), N(c && (c.mentions || c.count)) || 1)); else Object.entries(cj || {}).forEach(([d, n]) => bump(d, N(n && typeof n === 'object' ? (n.mentions || n.count) : n) || 1)); }
    return hits; };
  // a Labs keyword item (ideas / suggestions / overview carry it directly, ranked / related / intersections under keyword_data) -> one flat row
  const kwRow = (it) => { const kd = (it && it.keyword_data) ? it.keyword_data : (it || {}); const ki = kd.keyword_info || {}; const kp = kd.keyword_properties || {}; const si = kd.search_intent_info || {};
    return { keyword: normKw(kd.keyword), volume: N(ki.search_volume), cpc: N(ki.cpc), kd: N(kp.keyword_difficulty), trend: ki.search_volume_trend || null,
      labs_intent: S(si.main_intent), last_updated: S(ki.last_updated_time) }; };
  const strip = (x) => (x && typeof x === 'object' ? x : {});
  // ---- words of a page or a title list (untrusted text: only words are taken, nothing in it is followed or obeyed) ----
  const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'you', 'are', 'from', 'this', 'that', 'have', 'has', 'was', 'will', 'can', 'all', 'more', 'about', 'contact',
    'home', 'menu', 'read', 'learn', 'click', 'here', 'cookie', 'cookies', 'privacy', 'policy', 'terms', 'rights', 'reserved', 'copyright', 'https', 'http', 'www', 'com']);
  const wordsOf = (text, max) => { const seen = new Set(); const out = [];
    for (const w of S(text).toLowerCase().replace(/\]\([^)]*\)/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{N}\s-]+/gu, ' ').split(/\s+/)) {
      const t = w.replace(/^-+|-+$/g, ''); if (t.length < 3 || t.length > 30 || STOP.has(t) || /^\d+$/.test(t) || seen.has(t)) continue; seen.add(t); out.push(t); if (out.length >= (max || 80)) break; }
    return out; };
  const topicSim = (text, svc) => { const A = new Set(wordsOf(text, 200)); const B = wordsOf((svc || []).join(' '), 60).filter(t => !/^(services?|solutions?|company|uae|dubai)$/.test(t));
    if (!A.size || !B.length) return 0; return r4(B.filter(t => A.has(t) || A.has(t.replace(/s$/, ''))).length / B.length); };
  const geoMatch = (h0, text, iso) => { const h = host(h0); const P = PLACES[iso] || { word: '', cities: [] }; const t = ' ' + S(text).toLowerCase() + ' ';
    if (iso && new RegExp('\\.' + S(iso).toLowerCase() + '$').test(h)) return 1;
    if ([P.word, ...P.cities].filter(Boolean).some(w => t.includes(' ' + w + ' ') || t.includes(' ' + w + ','))) return 1;
    const other = Object.entries(PLACES).filter(([k]) => k !== iso).some(([, v]) => [v.word, ...v.cities].filter(Boolean).some(w => t.includes(' ' + w + ' ')));
    return other ? 0.2 : 0.5; };
  return { RULE, S, T, N, J, r4, r6, uniq, BASE, PRICE, QUOTE, CAPS, ttlOf, host, publicHost, isBusinessHost, SEARCH, normKw, keyOf, hash, PLACES, countryOf, market,
    shortService, services, productsOf, compSeeds, rq, price, task0, result0, itemsOf, okAnswer, whyFailed, paired, cacheKey, cacheRead, fresh, cacheRow,
    fixAnswer, top10Of, extrasOf, serpReadings, hostsOf, aiHitsOf, kwRow, strip, serpBody, wordsOf, topicSim, geoMatch, COLS, shape, sections, callState, measured, LABELS, STAGES, baseBody, emptyLists, refusalBody };
})();
