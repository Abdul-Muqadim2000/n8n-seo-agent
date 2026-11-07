// ---- KI SHIM (E2, 2026-11-08): a THIN stand-in for E1's kit v5/code/_ki.js (docs/keyword-intel-2026-11-08/CONTRACTS.md §6) ----
// build_ki.py inlines v5/code/_ki.js when it exists and this file only when it does not, so the worker (SEOagentKIntel1) can be built and
// replayed before E1 lands. It implements the §6 entry points with the simplest rule that keeps the contract's shapes; every number it
// gives is `modelled`. It is DELETED once E1's kit is merged (E2 report, fixes/E2.md). Pure and deterministic, regex only (no URL).
const KI = (() => {
  const VERSION = 'ki-1';
  const CONFIG = {
    weights: { serp: 0.45, topic: 0.20, geo: 0.15, ai: 0.20 }, score: { demand: 0.40, win: 0.35, value: 0.15, gap: 0.10 },
    win_parts: { strength: 0.35, existing: 0.25, topical: 0.20, weak: 0.20 }, stage_w: { hire: 1, compare: 0.9, solution: 0.65, problem: 0.5, info: 0.3 },
    verdict: { go: 0.6, months: 0.35 }, cluster: { t_page: 3, t_hub: 2, top: 10 }, demand_floor: 0.15, low_conf_range: 25, review_conf: 0.6,
    striking: { min_pos: 8, max_pos: 20, min_impr: 100, min_impr_small: 30, small_site_impr: 2000 }, chosen_max: 5, misses_leave: 2,
    ttl_days: { serp: 1, ranked: 7, volume: 30, backlinks: 7, homepage: 14, discovery: 30 },
    caps: { seeds: 20, top_n: 300, top_m: 60 } };
  const S = (x) => (x == null ? '' : String(x));
  const N = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (kw) => { let s = S(kw); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/[‘’']/g, '').replace(/[^\p{L}\p{N}&+.#\s-]+/gu, ' ').replace(/\s+/g, ' ').trim(); };
  const key = (kw) => norm(kw).split(' ').filter(Boolean).map(w => w.replace(/s$/, '')).sort().join(' ');
  const host = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  // ---- what a domain is (rules first) ----
  const LISTS = {
    platform: /(^|\.)(linkedin|facebook|instagram|youtube|twitter|x|tiktok|reddit|quora|medium|wikipedia|pinterest|github|wordpress|blogspot|slideshare)\.(com|org|net)$/,
    directory: /(^|\.)(clutch\.co|goodfirms\.co|g2\.com|capterra\.(com|in|ae|co\.uk)|trustradius\.com|softwareadvice\.com|getapp\.com|themanifest\.com|designrush\.com|sortlist\.(com|ae)|topdevelopers\.co|yellowpages\.ae|yelp\.com|crunchbase\.com|bayzat\.com|selectedfirms\.co|techbehemoths\.com|appsfutures\.com)$/,
    job_board: /(^|\.)(indeed\.com|bayt\.com|naukrigulf\.com|glassdoor\.com|gulftalent\.com|monster\.com|dubizzle\.com|ziprecruiter\.com|wuzzuf\.net)$/,
    media: /(^|\.)(khaleejtimes\.com|gulfnews\.com|thenationalnews\.com|zawya\.com|forbes\.com|arabianbusiness\.com|reuters\.com|bbc\.(com|co\.uk)|cnn\.com|techcrunch\.com|gulfbusiness\.com|wam\.ae)$/,
    principal: /(^|\.)(microsoft\.com|dynamics\.com|sap\.com|oracle\.com|odoo\.com|salesforce\.com|openedx\.org|netsuite\.com|zoho\.com|google\.com\/cloud|aws\.amazon\.com|ibm\.com)$/ };
  const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu)\.[a-z.]{2,6}$/;
  const GOV = /(^|\.)(gov(\.[a-z]{2})?|u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|tax\.gov\.ae|mil)$/;
  const LISTY = /\b(top|best)\s+\d*\s*[\w\s-]{0,40}(companies|agencies|firms|partners|providers|vendors|consultants)\b|\b\d+\s+best\b|\blist of\b/i;
  const toks = (s) => norm(s).split(' ').filter(t => t.length > 2 && !/^(the|and|for|with|your|our|services?|company|companies|solutions?|uae|dubai)$/.test(t));
  const sim = (a, b) => { const A = new Set(toks(a)), B = new Set(toks(b)); if (!A.size || !B.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / Math.min(A.size, B.size); };
  // ctx: { client, declared: [hosts], titles: [titles of its results], home: 'tokens of its homepage', services: [phrases], market_iso }
  const classifyDomain = (h0, ctx) => {
    const c = ctx || {}; const h = host(h0); const reasons = [];
    if (!h || h === host(c.client) || SEARCH.test(h) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return { class: null, basis: 'rule', confidence: 1, reasons: ['not a business website (search engine, the client itself or not a host)'] };
    if ((c.declared || []).map(host).includes(h)) return { class: 'direct', basis: 'declared', confidence: 1, reasons: ['you named it as a competitor'] };
    for (const k of ['platform', 'directory', 'job_board', 'media', 'principal']) if (LISTS[k].test(h)) return { class: k, basis: 'rule', confidence: 0.95, reasons: ['known ' + k.replace('_', ' ') + ' site'] };
    if (GOV.test(h)) return { class: 'government', basis: 'rule', confidence: 0.95, reasons: ['a government host'] };
    const titles = (c.titles || []).map(S);
    if (titles.length && titles.filter(t => LISTY.test(t)).length * 2 >= titles.length) return { class: 'publisher_list', basis: 'rule', confidence: 0.75, reasons: ['its pages in these results are lists of companies'] };
    const svc = (c.services || []).join(' ');
    const t = Math.max(sim(titles.join(' '), svc), c.home ? sim(c.home, svc) : 0);
    if (t >= 0.34) return { class: 'direct', basis: c.home ? 'page' : 'rule', confidence: cl(0.55 + t / 2, 0, 0.95), reasons: ['its pages offer the services you sell (' + Math.round(t * 100) + '% word match)'] };
    if (t > 0) return { class: 'adjacent', basis: c.home ? 'page' : 'rule', confidence: cl(0.4 + t, 0, 0.8), reasons: ['some of its pages overlap with what you sell'] };
    return { class: 'adjacent', basis: 'rule', confidence: 0.45, reasons: ['ranks for your searches; what it sells could not be read'] };
  };
  const CTR = [0, 0.28, 0.15, 0.10, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
  const ctr = (p) => { const n = N(p); return n && n >= 1 && n <= 10 ? CTR[Math.round(n)] : (n && n <= 20 ? 0.01 : 0); };
  // domains: [{ domain, class, positions: [{ seed, position, url }], topic_sim, geo_match, ai_hits }]; seeds: [{ keyword, weight }]
  const scoreCompetitors = (domains, seeds, cfg) => {
    const W = Object.assign({}, CONFIG.weights, (cfg || {}).weights || {}); const sd = seeds || [];
    const wOf = (k) => { const s = sd.find(x => x.keyword === k); return s ? (N(s.weight) || 1) : 1; };
    const denom = sd.reduce((a, s) => a + (N(s.weight) || 1) * CTR[1], 0) || 1;
    const aiMax = Math.max(1, ...(domains || []).map(d => N(d.ai_hits) || 0));
    return (domains || []).map(d => {
      const scored = d.class === 'direct' || d.class === 'adjacent';
      const best = {}; for (const p of (d.positions || [])) if (!best[p.seed] || p.position < best[p.seed]) best[p.seed] = p.position;
      const serp_share = +(Object.entries(best).reduce((a, [k, p]) => a + wOf(k) * ctr(p), 0) / denom).toFixed(4);
      const topic_sim = cl(N(d.topic_sim) || 0, 0, 1), geo_match = cl(N(d.geo_match) == null ? 0.5 : N(d.geo_match), 0, 1), ai_share = +((N(d.ai_hits) || 0) / aiMax).toFixed(4);
      const mid = 100 * (W.serp * cl(serp_share * 3, 0, 1) + W.topic * topic_sim + W.geo * geo_match + W.ai * ai_share);
      const spread = 100 * W.topic * 0.25 + (d.ai_hits == null ? 100 * W.ai * 0.5 : 0);
      return { domain: d.domain, class: d.class, scored, serp_share, topic_sim: +topic_sim.toFixed(4), geo_match: +geo_match.toFixed(4), ai_share,
        score: scored ? Math.round(mid) : null, score_low: scored ? Math.max(0, Math.round(mid - spread / 2)) : null, score_high: scored ? Math.min(100, Math.round(mid + spread / 2)) : null,
        seeds_seen: Object.keys(best).length, seeds_total: sd.length };
    }).sort((a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score) || a.domain.localeCompare(b.domain));
  };
  const sizeTag = (client, comp) => {
    const ck = N((client || {}).keywords), k = N((comp || {}).keywords), cr = N((client || {}).refdomains), r = N((comp || {}).refdomains);
    if (k == null) return 'unknown';
    if (ck != null && ck > 0 && k > 20 * ck && cr != null && r != null && r > 10 * Math.max(1, cr)) return 'out_of_reach';
    if (ck == null || ck === 0) return k > 500 ? 'leader' : 'peer';
    return k > 3 * ck ? 'leader' : (k < ck / 3 ? 'smaller' : 'peer');
  };
  // sourceLists: [{ source, fetched_at, rows: [{ keyword, ...fields }] }] -> rows { keyword, kw_key, sources: [{source, fetched_at, detail}], ...fields }
  const mergeCandidates = (sourceLists) => {
    const by = new Map();
    for (const L of (sourceLists || [])) for (const r of (L.rows || [])) {
      const k = key(r.keyword); if (!k || norm(r.keyword).length > 120) continue;
      const cur = by.get(k) || { keyword: norm(r.keyword), kw_key: k, sources: [] };
      if (!cur.sources.some(s => s.source === L.source)) cur.sources.push({ source: L.source, fetched_at: S(L.fetched_at), detail: S(r.detail || '').slice(0, 120) });
      for (const [f, v] of Object.entries(r)) if (f !== 'keyword' && f !== 'detail' && v != null && v !== '' && cur[f] == null) cur[f] = v;
      by.set(k, cur);
    }
    return [...by.values()].sort((a, b) => a.kw_key.localeCompare(b.kw_key));
  };
  const prescore = (row, cfg) => {
    const r = row || {}; if (r.gate === 'fail') return 0;
    const v = N(r.gsc_impressions) || N(r.volume) || 0; const src = (r.sources || []).length;
    return +((N(r.fit) == null ? 0.5 : N(r.fit)) * (Math.log10(1 + v) + 0.6 * src + (r.gsc_impressions ? 1 : 0))).toFixed(4);
  };
  const pageType = (it) => {
    const x = it || {}; const h = host(x.domain || x.url); const t = S(x.title);
    if (!h) return 'unknown';
    if (GOV.test(h)) return 'government'; if (LISTS.directory.test(h)) return 'directory'; if (LISTS.platform.test(h)) return 'platform';
    if (LISTS.job_board.test(h)) return 'job_board'; if (LISTS.media.test(h)) return 'media';
    if (x.type === 'discussions_and_forums' || /(^|\.)(reddit|quora)\./.test(h)) return 'forum';
    if (LISTY.test(t)) return 'list'; if (/\b(what is|how to|guide|vs\.?|versus|explained|definition)\b/i.test(t)) return 'guide';
    return 'service';
  };
  const stage = (top10, keyword, labsIntent) => {
    const types = (top10 || []).map(x => x.type || pageType(x)); const n = types.length || 1; const c = (t) => types.filter(x => x === t).length;
    const kw = norm(keyword); let st = 'solution', ev = [];
    if (/\b(vs|versus|alternatives?|compare|comparison|best|top|reviews?)\b/.test(kw)) st = 'compare';
    else if (/\b(company|companies|partner|partners|agency|agencies|consultants?|provider|providers|near me|services?|hire|cost|price|pricing|quote)\b/.test(kw)) st = 'hire';
    else if (/\b(what|how|why|guide|meaning|definition|examples?|is)\b/.test(kw)) st = 'info';
    else if (/\b(problem|issue|error|fix|not working)\b/.test(kw)) st = 'problem';
    if (top10 && top10.length) { const svc = c('service'), lst = c('list') + c('directory'), gd = c('guide');
      ev.push(svc + ' of ' + n + ' results are company service pages, ' + lst + ' lists or directories, ' + gd + ' guides');
      if (svc / n >= 0.6 && st !== 'compare') st = 'hire'; else if (lst / n >= 0.5) st = 'compare'; else if (gd / n >= 0.6) st = 'info'; }
    const intent = S(labsIntent) || ({ hire: 'transactional', compare: 'commercial', solution: 'commercial', problem: 'informational', info: 'informational' })[st];
    const confidence = top10 && top10.length ? 0.75 : 0.5;
    return { stage: st, intent, confidence, evidence: ev, needs_review: confidence < CONFIG.review_conf };
  };
  // rows: [{ kw_key, keyword, top10: [{ url, host }], demand }] -> same rows + cluster_id, is_head, cluster_size
  const urlKey = (x) => S(x && (x.key || x.url || x.host)).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const cluster = (rows, cfg) => {
    const T = Object.assign({}, CONFIG.cluster, (cfg || {}).cluster || {});
    const list = (rows || []).slice().sort((a, b) => (N(b.demand) || 0) - (N(a.demand) || 0) || S(a.keyword).localeCompare(S(b.keyword)));
    const heads = [];
    for (const r of list) {
      const mine = new Set((r.top10 || []).slice(0, T.top).map(urlKey).filter(Boolean)); let joined = null;
      if (mine.size) for (const h of heads) { let n = 0; for (const u of h.urls) if (mine.has(u)) n++; if (n >= T.t_page) { joined = h; break; } }
      if (joined) { joined.members.push(r); r.cluster_id = joined.id; r.is_head = false; }
      else { const id = 'c_' + S(r.kw_key).replace(/[^a-z0-9]+/g, '_').slice(0, 40); heads.push({ id, urls: mine, members: [r] }); r.cluster_id = id; r.is_head = true; }
    }
    for (const h of heads) for (const m of h.members) m.cluster_size = h.members.length;
    return list;
  };
  const demand = (c, cfg) => { const v = N((c || {}).gsc_impressions) || N((c || {}).volume) || 0; const src = ((c || {}).sources || []).length;
    const d = cl(Math.log10(1 + v) / 4, 0, 1); return v ? +d.toFixed(4) : (src >= 2 ? (cfg && cfg.demand_floor) || CONFIG.demand_floor : 0); };
  const win = (row, site, cfg) => { const r = row || {}; const P = CONFIG.win_parts; const kd = N(r.kd); const pos = N(r.gsc_position);
    const strength = kd == null ? 0.5 : cl(1 - kd / 100, 0, 1); const existing = pos ? cl(1 - (pos - 1) / 30, 0, 1) : 0;
    const topical = cl(N(r.fit) == null ? 0.5 : N(r.fit), 0, 1); const weak = cl(N(r.weak_spots) || 0.3, 0, 1);
    return +(P.strength * strength + P.existing * existing + P.topical * topical + P.weak * weak).toFixed(4); };
  const score = (row, cfg) => { const r = row || {}; const W = CONFIG.score; const gate = r.gate === 'fail' ? 0 : 1; const fit = cl(N(r.fit) == null ? 0.5 : N(r.fit), 0, 1);
    const stageW = CONFIG.stage_w[r.stage] || 0.5; const d = N(r.demand) == null ? demand(r, cfg) : N(r.demand); const w = N(r.win) == null ? win(r, null, cfg) : N(r.win);
    const value = cl(N(r.value) == null ? (N(r.cpc) ? Math.log10(1 + N(r.cpc)) / 1.5 : 0.3) : N(r.value), 0, 1); const gap = cl(N(r.gap) || 0, 0, 1);
    const mid = 100 * gate * fit * stageW * (W.demand * d + W.win * w + W.value * value + W.gap * gap);
    const spread = (r.volume == null && !r.gsc_impressions ? 20 : 8) + (r.kd == null ? 8 : 0);
    const lo = Math.max(0, mid - spread * gate), hi = Math.min(100, mid + spread * gate);
    return { score: Math.round(mid), low: Math.round(lo), high: Math.round(hi), factors: { gate, fit, stageW, demand: d, win: w, value: +value.toFixed(4), gap }, low_confidence: hi - lo > CONFIG.low_conf_range };
  };
  const verdict = (row) => { const r = row || {}; if (r.gate === 'fail') return 'gated'; const w = N(r.win); if (w == null) return 'hard'; return w >= CONFIG.verdict.go ? 'go' : (w >= CONFIG.verdict.months ? 'months' : 'hard'); };
  // client: { domain, positions: { kw_key: pos } }; chosen: [domains]; keywordRows: rows with competitors: [{domain, position}]; extra: { intersection: { total, rows } }
  const gaps = (client, chosen, keywordRows, extra) => {
    const out = []; const ch = (chosen || []).map(host);
    for (const r of (keywordRows || [])) {
      if (r.gate === 'fail') continue;
      const comps = (r.competitors || []).filter(c => ch.includes(host(c.domain)) && N(c.position) && c.position <= 10);
      const me = N(r.client_position);
      let type = null, action = null;
      if (comps.length >= 2 && (!me || me > 100)) { type = 'missing'; action = 'new_page'; }
      else if (comps.length === 1 && (!me || me > 100)) { type = 'untapped'; action = 'new_page'; }
      else if (comps.length >= 1 && me && me > 10) { type = 'weak'; action = 'refresh'; }
      else if (me && me <= 3 && comps.length) { type = 'strong'; action = 'defend'; }
      if (!type) continue;
      out.push({ type, keyword: r.keyword, kw_key: r.kw_key, cluster_id: r.cluster_id || null, competitor_domains: comps.map(c => host(c.domain)), client_position: me || null, action, evidence: comps.map(c => ({ domain: host(c.domain), position: c.position, url: S(c.url) })) });
    }
    return out;
  };
  const pageAction = (cl0, site) => { const c = cl0 || {}; const types = (c.top10 || []).map(x => x.type || pageType(x)); const n = types.length || 1;
    if (types.length && types.filter(t => t === 'list' || t === 'directory').length / n >= 0.5) return { action: 'list', url: '', why: 'most results are lists or directories: get on them' };
    if (c.gsc_page) return { action: 'refresh', url: S(c.gsc_page), why: 'your page already shows for it' };
    if (c.page_url) return { action: 'refresh', url: S(c.page_url), why: 'you have a page about it' };
    return { action: 'new', url: '', why: 'no page of yours answers it' }; };
  const plan = (clusters, gp, cfg) => {
    const acts = [];
    for (const c of (clusters || []).filter(x => x.verdict !== 'gated').slice(0, 10)) acts.push({ kind: c.page_action === 'list' ? 'list' : (c.page_action === 'refresh' ? 'refresh' : 'new_page'), title: (c.page_action === 'list' ? 'Get listed for ' : c.page_action === 'refresh' ? 'Improve your page for ' : 'Write a page for ') + '"' + c.head + '"', why: 'score ' + c.score + ' (' + c.score_low + '-' + c.score_high + ')', target: S(c.page_url || c.head), cluster_id: c.cluster_id, score: N(c.score) || 0 });
    for (const g of (gp || []).filter(x => x.type === 'missing').slice(0, 5)) acts.push({ kind: 'new_page', title: 'Close the gap on "' + g.keyword + '"', why: g.competitor_domains.length + ' of your competitors rank, you do not', target: g.keyword, gap_id: g.gap_id, score: 30 });
    return acts.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 10);
  };
  const readable = (row, ctx) => { const c = ctx || {}; if (c.killed) return false; if (!['trial', 'on'].includes(S(c.mode))) return false; return S((row || {}).gate) === 'pass'; };
  const label = (b) => ({ measured: 'measured', provider_estimate: 'estimate from the data provider', modelled: 'our estimate', inferred: 'AI judgement' })[S(b)] || 'not available';
  return { VERSION, CONFIG, SHIM: true, norm, key, classifyDomain, scoreCompetitors, sizeTag, mergeCandidates, prescore, pageType, stage, cluster, demand, win, score, verdict, gaps, pageAction, plan, readable, label };
})();
