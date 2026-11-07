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
  // the lifetimes are KI.CONFIG.ttl_days (serp 1, ranked_keywords 7, volume 30, backlinks 7, homepage 14, competitors 30); discovery lists are volume data
  const TTL_NAME = { serp: 'serp', ranked: 'ranked_keywords', volume: 'volume', backlinks: 'backlinks', homepage: 'homepage', discovery: 'volume', competitors: 'competitors' };
  const ttlOf = (k) => { const t = CFG0.ttl_days || {}; return N(t[TTL_NAME[k] || k]) || ({ serp: 1, ranked: 7, volume: 30, backlinks: 7, homepage: 14, discovery: 30 })[k] || 7; };
  const CAPS = { seeds: 20, gsc_seeds: 50, serp_depth: 10, sc_limit: 50, size_targets: 30, cd_limit: 20, cd_min_ranked: 50, cd_rivals: 1,
    rk_limit: 300, chosen_max: 5, home_reads: 8, sitemaps: 5, autocomplete: 10, ideas_limit: 300, sugg_n: 2, sugg_limit: 200, related_n: 1,
    related_limit: 150, pi_limit: 500, pi_rank: 10, top_n: 300, top_m: 60, tp_urls: 60, overview_max: 700, intent_max: 1000, ads_max: 1000,
    home_bytes: 400000, fetch_timeout_ms: 15000, rd_targets: 300,
    ...((CFG0.caps && typeof CFG0.caps === 'object') ? CFG0.caps : {}) };
  // ---- hosts and words ----
  const host = (u) => S(u).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#\s].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  const HOSTRE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
  // a public host only: no IP literal, no localhost / internal names (the SSRF guard every fetched address passes, as Normalize Input's domainOk)
  // FX-L (REVIEW_PERF_SAFETY H2): also no wildcard-DNS names that resolve to any address you write in them (nip.io, sslip.io ...), no names
  // with an IP inside, no cloud metadata names, no credentials
  const WILDCARD_DNS = /(^|\.)(nip\.io|sslip\.io|xip\.io|traefik\.me|localtest\.me|lvh\.me|vcap\.me|lacolhost\.com|fbi\.com|localhost\.run|ngrok\.io|ngrok-free\.app|1u\.ms|rbndr\.us|burpcollaborator\.net|oastify\.com|interact\.sh)$/;
  const publicHost = (h0) => { if (/@/.test(S(h0).replace(/^https?:\/\//i, '').replace(/[\/?#].*$/, ''))) return false; const h = host(h0); if (!h || h.length > 253 || /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':')) return false;
    if (/(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet|test|example|invalid|arpa|metadata)$/.test(h) || /(^|\.)metadata\.google\.internal$/.test(h) || WILDCARD_DNS.test(h)) return false;
    if (/(^|[.-])(\d{1,3})[.-](\d{1,3})[.-](\d{1,3})[.-](\d{1,3})([.-]|$)/.test(h)) return false; return HOSTRE.test(h); };
  // one redirect hop, checked by us (the HTTP nodes follow none): https only, a public host, the SAME registrable domain as the address
  // asked (apex <-> www, http -> https), no credentials. Anything else is not followed.
  const regOf = (h) => (typeof KI === 'object' && KI && KI.reg) ? KI.reg(host(h)) : host(h).split('.').slice(-2).join('.');
  const hopOf = (askedUrl, answer) => { const a = answer || {}; const code = N(a.statusCode); if (!code || code < 300 || code >= 400) return '';
    const hd = a.headers || {}; let loc = S(hd.location || hd.Location || '').trim(); if (!loc) return '';
    const base = S(askedUrl).match(/^(https?:\/\/[^\/?#]+)/i); if (/^\/(?!\/)/.test(loc) && base) loc = base[1] + loc;
    if (!/^https:\/\/[^\s\/?#@]+(?:[\/?#]\S*)?$/i.test(loc)) return '';
    const h = host(loc); if (!publicHost(h) || regOf(h) !== regOf(host(askedUrl))) return ''; return loc.slice(0, 500); };
  // the text of an HTML page, linear time (no backtracking regex over a page of unclosed tags): script / style / noscript / svg blocks out,
  // tags out, entities out, capped at max characters of the input
  const htmlText = (html, max) => { const src = S(html).slice(0, max || 400000); const low = src.toLowerCase(); let out = '', i = 0;
    const SKIP = ['script', 'style', 'noscript', 'svg'];
    while (i < src.length) { const lt = low.indexOf('<', i); if (lt < 0) { out += src.slice(i); break; } out += src.slice(i, lt) + ' ';
      const tag = SKIP.find(t => low.startsWith('<' + t, lt) && /[\s>\/]/.test(low.charAt(lt + t.length + 1) || '>'));
      if (tag) { const end = low.indexOf('</' + tag, lt + 1); if (end < 0) break; const gt = low.indexOf('>', end); i = gt < 0 ? src.length : gt + 1; continue; }
      const gt = low.indexOf('>', lt + 1); if (gt < 0) break; i = gt + 1; }
    return out.replace(/&[a-z#0-9]{1,10};/gi, ' ').replace(/\s+/g, ' ').trim(); };
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
    const w0 = t.split(' ').filter(Boolean); while (w0.length && /^(and|or|the|a|an|we|provide|offer|our|of|to)$/.test(w0[0])) w0.shift();
    const w = w0.slice(0, 5); while (w.length && /^(and|or|the|a|an|of|to|in|for|&)$/.test(w[w.length - 1])) w.pop();
    const out = w.join(' ').replace(/[^\p{L}\p{N}&+.# -]+/gu, ' ').replace(/\s+/g, ' ').trim(); return out.length >= 3 && out.split(' ').length >= 1 ? out : ''; };
  // the services as the confirmed LIST (KI.services: JSON arrays parsed, a sentence never cut), and their short forms for the seeds
  // FX-L B1: every distinct service is kept (devaicon's "Open edX Services" was item 21 of 30 and a cap of 16 cut it); the list is RANKED by
  // evidence - declared by the client, the impressions of the site's own Search Console queries that contain it, a page of the site named
  // for it - and only then capped (60), never cut by position
  const services = (site, req, gsc, pages) => { const s = site || {}; const k = (v) => (typeof KI === 'object' && KI.services) ? KI.services(v) : J(v, []).map(S);
    const declared = k(s.declared_services); const all = []; const seen = new Set();
    for (const x of [...declared, ...k(s.services_json), ...k(S((req || {}).business).split(/[\n;]+/).map(T).filter(x => x.length > 2 && x.length < 160))]) { const kk = keyOf(x); if (!kk || seen.has(kk)) continue; seen.add(kk); all.push(x); }
    const dk = new Set(declared.map(keyOf)); const tok = (x) => keyOf(x).split(' ').filter(t => t.length > 1);
    const ev = (x) => { const t = tok(x); if (!t.length) return 0; const has = (q) => { const qt = new Set(keyOf(q).split(' ')); return t.every(w => qt.has(w)); };
      const imp = (gsc || []).filter(q => has(q.query || q.keyword)).reduce((a, q) => a + (N(q.impressions) || 0), 0);
      const pg = (pages || []).some(p => has(S(p.title) + ' ' + S(p.url).replace(/[\/_-]+/g, ' '))) ? 1 : 0;
      return (dk.has(keyOf(x)) ? 3 : 0) + Math.log10(1 + imp) + pg; };
    return all.map((x, i) => ({ x, i, e: ev(x) })).sort((a, b) => b.e - a.e || a.i - b.i).slice(0, 60).map(o => o.x); };
  const GENERIC1 = /^(services?|solutions?|support|consulting|implementation|development|software|systems?|cloud|automation|it|ai)$/i;
  const seedServices = (svc) => uniq((svc || []).map(x => normKw(x).replace(/[^\p{L}\p{N}&+#. -]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(x => x && x.split(' ').length <= 5 && !GENERIC1.test(x) && !/[.:;!?()]/.test(x.replace(/\b\d+\.\d+\b/g, '')))).slice(0, 12);
  const productsOf = (svc) => uniq((svc || []).map(x => { const m = S(x).match(PRODUCTS); return m ? m[1].toLowerCase() : ''; }));
  // ---- the run plan's seeds (DESIGN §2.1): services x market, GSC, tracked, ladder heads, the request's own; fit-gated, capped ----
  // FX-L H1 (REVIEW_LOGIC H1): the seeds are balanced by evidence inside the cap instead of filled by service phrasings: the request's own
  // (<= 6), the top non-brand Search Console queries (<= 6), tracked keywords and ladder heads (<= 4), then the services x the market (<= 2
  // phrasings each, round robin, so every service gets its turn before any gets a second), then products. A seed must be a plausible
  // search: no punctuation inside, 2-6 words, never a single generic word.
  const plausible = (kw, maxW) => { const w = kw.split(' ').filter(Boolean); if (w.length < 2 || w.length > (maxW || 6)) return false; if (/[.,:;!?()\[\]"]/.test(kw.replace(/\b\d+\.\d+\b/g, ''))) return false; return true; };
  const compSeeds = (o) => {
    const P = PLACES[o.iso] || { word: S(o.country).toLowerCase(), cities: [] }; const city = T(o.city).toLowerCase() || P.cities[0] || P.word;
    const cap = CAPS.seeds; const Q = { seed: 6, gsc: 6, tracked: 4 };
    const kept = [], refused = [], seenK = new Set(), waiting = new Set();
    const take = (k, src, w, quota) => { const kw = normKw(k); if (!kw) return false; const kk = keyOf(kw); if (seenK.has(kk)) return false;
      const maxW = src === 'service' ? 6 : 8;   // a phrase we build from a service: 6 words; a search people typed (Search Console, tracked, ladder, the request): 8
      if (!plausible(kw, maxW)) { refused.push({ keyword: kw, reason: 'not_a_search', detail: 'not a plausible search (punctuation, or under 2 / over ' + maxW + ' words)' }); seenK.add(kk); return false; }
      const g = o.gate ? o.gate(kw) : { gate: 'pass' };
      if (g.gate !== 'pass') { refused.push({ keyword: kw, reason: g.reason, detail: g.text || g.detail }); seenK.add(kk); return false; }
      if (kept.length >= cap || (quota != null && kept.filter(x => x.source === src || (src === 'tracked' && x.source === 'ladder') || (src === 'ladder' && x.source === 'tracked')).length >= quota)) { waiting.add(kk); return false; }
      seenK.add(kk); waiting.delete(kk); kept.push({ keyword: kw, source: src, weight: w }); return true; };
    for (const s0 of (o.seeds || [])) take(s0, 'seed', 1, Q.seed);
    for (const q of (o.gsc || []).slice(0, CAPS.gsc_seeds)) take(q.query, 'gsc', Math.min(1, 0.4 + Math.log10(1 + (N(q.impressions) || 0)) / 5), Q.gsc);
    for (const k of (o.tracked || [])) take(k, 'tracked', 0.8, Q.tracked);
    for (const k of (o.ladders || [])) take(k, 'ladder', 0.8, Q.tracked);
    const svc = (o.services || []).slice(0, 12); const prods = (o.products || []).slice(0, 3);
    const phr = [(x) => x + ' ' + P.word, (x) => x + ' company ' + city];
    for (let r = 0; r < phr.length && kept.length < cap; r++) for (const x of svc) { if (kept.length >= cap) break; take(phr[r](x), 'service', r ? 0.9 : 1, null); }
    for (const p0 of prods) if (kept.length < cap) take(p0 + ' partner ' + P.word, 'service', 1, null);
    // what is left of the cap goes to the remaining Search Console queries
    for (const q of (o.gsc || []).slice(0, CAPS.gsc_seeds)) if (kept.length < cap) take(q.query, 'gsc', Math.min(1, 0.4 + Math.log10(1 + (N(q.impressions) || 0)) / 5), null);
    return { seeds: kept.slice(0, cap), refused, dropped: waiting.size };
  };
  // FX-L (REVIEW_PERF_SAFETY M2): the discovery and overlap bundles are keyed on the seeds that do not change week to week (the request's own
  // and the service phrases), never on the weekly Search Console reading, so a repeat inside the 30-day lifetime is free
  const seedHash = (seeds) => hash((seeds || []).filter(x => x && (x.source === 'seed' || x.source === 'service')).map(x => x.keyword).sort().join('|') || 'none');
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
  // every answer has passed SU.fixAnswer in its gate's Answers node (the SERP-GOTO hotfix); a cached reading is fixed here the same way (idempotent)
  const fixAnswer = (a) => (a && typeof SU === 'object' && SU && SU.fixAnswer ? SU.fixAnswer(a) : a);
  // the top 10 of a results page: host by KI.hostOf (a redirect still on google.com, or no domain, is "host unknown" and skipped), its page
  // type, title, position, and whether the address is exact (an address rebuilt from a breadcrumb is not: the host is reliable, the page is not)
  const top10Of = (a, ctx) => { const items = ((typeof SU === 'object' && SU && SU.fixItems) ? SU.fixItems(itemsOf(a)) : itemsOf(a)) || [];
    const org = items.filter(x => x && x.type === 'organic').sort((x, y) => (N(x.rank_group) || 99) - (N(y.rank_group) || 99)).filter(x => (N(x.rank_group) || 99) <= 10);
    const out = []; for (const x of org) { const h = KI.hostOf(x); if (!h || SEARCH.test(h)) continue; const exact = x.url_exact !== false && !(SU && SU.isRedirect && SU.isRedirect(x.url));
      out.push({ url: S(x.url), host: h, title: S(x.title).slice(0, 160), pos: N(x.rank_group) || null, exact, url_partial: !!x.url_partial, type: KI.pageType(x, ctx || {}) || 'other' }); }
    return out; };
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
  const LABELS = { measured: 'measured', provider_estimate: 'estimate from the data provider', modelled: 'our estimate', inferred: 'our reading of the results' };
  const STAGES = { competitors: 'ki_competitors', keyword_research: 'ki_research' };
  const baseBody = (q, status, reason, extra) => ({ stage: STAGES[q.kind] || 'ki_competitors', status, reason: S(reason), request_id: S(q.request_id), run_id: S(q.run_id), domain: S(q.domain),
    market: S(q.market), mode: S(q.ki_mode || 'off'), rule_version: RULE, sections: [], summary: {}, labels: LABELS, run_ledger: null,
    run_cost_estimate_usd: 0, run_cost_estimate_basis: '', run_cost_estimate_state: 'modelled', ...(extra || {}) });
  const emptyLists = (kind) => (kind === 'keyword_research' ? { clusters: [], striking: [], questions: [], gaps_summary: {}, plan: [] } : { competitors: [], listings: [], platforms: [] });
  const refusalBody = (q, reason, note) => ({ ...baseBody(q, 'refused', reason, { note: S(note), run_cost_estimate_usd: 0, run_cost_estimate_state: 'measured',
    run_cost_estimate_basis: 'refused before any paid call: no search data was read and no model was asked' }), ...emptyLists(q.kind) });
  // ---- the results pages of a list of searches: the day cache first, then this run's answers (paired with the requests that went out) ----
  // -> { by: { keyword: { source: cache|live|missing, at, why, top10, extras } }, save: [seo_cache serp rows], pairs, read, missing }
  const serpReadings = (kws, m, cacheRows, reqItems, answers, siteId, now, ctx) => {
    const pr = paired(reqItems, answers); const fr = {}; for (const x of pr) if (x.q && x.q.keyword) fr[normKw(x.q.keyword)] = x;
    const by = {}, save = []; let read = 0, missing = 0;
    for (const kw0 of (kws || [])) { const kw = normKw(kw0); const body = serpBody(kw, m);
      const lk = (typeof SC === 'object' && SC) ? SC.lookup(cacheRows || [], body, { now }) : { hit: false };
      if (lk.hit) { by[kw] = { source: 'cache', at: S(lk.reading.at), why: '', top10: top10Of(lk.response, ctx), extras: extrasOf(lk.response) }; read++; continue; }
      const f = fr[kw];
      if (f && f.ok) { const fixed = fixAnswer(f.a); by[kw] = { source: 'live', at: S(now), why: '', top10: top10Of(fixed, ctx), extras: extrasOf(fixed) }; read++;
        const row = (typeof SC === 'object' && SC) ? SC.rowFor(fixed, body, siteId, { now, path: 'ki' }) : null; if (row) save.push(row); continue; }
      by[kw] = { source: 'missing', at: '', why: f ? f.why : 'not read: nothing was asked for it', top10: [], extras: { paa: [], related: [], forum: [], aio: false, local: false } }; missing++; }
    return { by, save, pairs: pr, read, missing };
  };
  // every business host on those pages: its positions per search and the titles it ranks with (the search engine and the client left out)
  const hostsOf = (by, client) => { const out = {};
    for (const [kw, r] of Object.entries(by || {})) for (const t of (r.top10 || [])) { if (!t.host || !isBusinessHost(t.host, client)) continue;
      const h = out[t.host] || (out[t.host] = { domain: t.host, positions: [], titles: [], types: [] });
      if (!h.positions.some(p => p.seed === kw)) h.positions.push({ seed: kw, position: t.pos || 10, url: t.exact ? t.url : '', title: t.title, type: t.type, src: 'serp' });
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
  // ---- one domain's class (KI.classifyDomain): the client, its services and market, the declared set, what this domain's results on the run's
  // pages are (appearances: seed, position, title, page type) and the words of its homepage when read (untrusted DATA, only words) ----
  const classify = (p, c, home) => KI.classifyDomain(c.domain, { own_domain: host(p.domain), services: p.services || [], declared: p.declared || [], market: S(p.iso),
    appearances: (c.positions || []).filter(x => x.src === 'serp').map(x => ({ keyword: x.seed, position: x.position, url: x.url, title: x.title, type: x.type })),
    pages: home && home.tokens ? [{ title: '', text: S(home.tokens) }] : [] });
  return { RULE, S, T, N, J, r4, r6, uniq, BASE, PRICE, QUOTE, CAPS, ttlOf, host, publicHost, isBusinessHost, SEARCH, normKw, keyOf, hash, PLACES, countryOf, market,
    shortService, services, seedServices, productsOf, compSeeds, seedHash, plausible, hopOf, htmlText, regOf, WILDCARD_DNS, rq, price, task0, result0, itemsOf, okAnswer, whyFailed, paired, cacheKey, cacheRead, fresh, cacheRow,
    fixAnswer, top10Of, extrasOf, serpReadings, hostsOf, aiHitsOf, kwRow, strip, serpBody, wordsOf, topicSim, geoMatch, classify, COLS, shape, sections, callState, measured, LABELS, STAGES, baseBody, emptyLists, refusalBody };
})();
