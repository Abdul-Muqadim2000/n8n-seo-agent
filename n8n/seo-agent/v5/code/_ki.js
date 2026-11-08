// ---- KI (keyword intelligence, 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md section 6, R4_MARKET.md section 6): ONE kit for ----
// competitor analysis and buyer keyword research. Pure and deterministic: no clock (pass cfg.now), no network, no random, no table access.
// Inlined by the KI worker (build_ki.py) AFTER the kits it calls, which must be inlined first in the same node:
//   _fit_gate.js (fitGate, fitMarket, fitEvidence; required for KI.gate / KI.fit), _competitors.js (CMP; required for KI.classifyDomain /
//   KI.pageType), _site_model.js (SM; optional, KI.pageAction uses SM.matchPage when a site model is given), _kw_inputs.js (KWI; optional,
//   KI.pageType uses KWI.shapeOf for the guide / pricing / service shapes when present).
// Nothing here changes what those kits answer for their existing callers: KI only CALLS them and maps their answers to the KI vocabulary.
//
// The method (R4 6.1-6.7, DESIGN.md sections 2-4), every weight / threshold / cap / TTL in KI.CONFIG (overridable by a run's config_json):
//   Score  = 100 x Gate x Fit x StageW x (0.40 Demand + 0.35 Win + 0.15 Value + 0.10 Gap); every factor 0..1; monotone in every factor
//   Win    = 0.35 Strength + 0.25 ExistingRank + 0.20 Topical + 0.20 WeakSpots; verdict Go >= 0.60, Takes a few months >= 0.35, else Hard
//   Comp   = 0.45 SERPshare + 0.20 TopicSim + 0.15 GeoMatch + 0.20 AIshare, only for direct / adjacent; size is a TAG, never a score input
//   Cluster: head-based, sorted by click demand, a keyword joins the FIRST head it shares >= T_page (3) of the top 10 with; hub at T_hub (2);
//            no chaining (members never recruit); ties by key. Identical top 10s are never split, zero overlap is never merged.
//   Stage  : strong words first (what is / vs / best / pricing / near me), then the page types of the top 10 (position weighted), then weak
//            words, then the provider's intent label, else "info" with needs_review. Weights hire 1.00 compare 0.90 solution 0.65 problem
//            0.50 info 0.30.
// Live SERP items may carry recovered hosts (the SERP-goto hotfix, kit SU: url_exact false, url_recovered, url_partial): an item with no
// domain is skipped and never counted; an approximate url is compared by host + path tokens; a partial url counts for its host only (own
// site and competitors), never for clustering; a Google redirect still carrying google.com is treated as "host unknown".
// Text read from other sites (titles, snippets, page text, AI answers) is untrusted data: it can only move a class or a share, never pick
// an action by itself, and nothing is ever executed or followed from it.
var KI = (typeof KI === 'object' && KI && KI.VERSION === 'ki-1') ? KI : (() => {
  const VERSION = 'ki-1';
  const S = (v) => (v == null ? '' : String(v));
  const num = (v) => { if (v === '' || v == null || typeof v === 'boolean') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const r2 = (x) => Math.round(x * 100) / 100;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const r1 = (x) => Math.round(x * 10) / 10;
  const uniq = (a) => { const seen = new Set(); const out = []; for (const x of a) if (!seen.has(x)) { seen.add(x); out.push(x); } return out; };
  const jparse = (v, d) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? d : o; } catch (e) { return d; } };
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  // FNV-1a 32 bit, base 36: deterministic ids (cluster, gap, action) from text
  const hash = (s) => { let h = 0x811c9dc5; const t = S(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  // plain ASCII for every sentence a client reads (no em dashes, no curly quotes, no ellipsis character)
  const ascii = (s) => S(s).replace(/[\u2018\u2019\u201a\u2032]/g, "'").replace(/[\u201c\u201d\u201e\u2033]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...').replace(/\u203a/g, '>').replace(/\u00a0/g, ' ').normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------------------------------------------------------------------------
  // CONFIG: every number of the method. A run's config_json may override any of it (KI.cfg merges deeply, arrays replace).
  // ---------------------------------------------------------------------------------------------------------------------------------
  const CONFIG = {
    rule_version: VERSION,
    // opportunity score (R4 6.4)
    score_weights: { demand: 0.40, win: 0.35, value: 0.15, gap: 0.10 },
    win_weights: { strength: 0.35, existing_rank: 0.25, topical: 0.20, weak_spots: 0.20 },
    verdict: { go: 0.60, months: 0.35 },
    low_confidence_range: 25,          // points between the low and the high score
    win_spread: 0.15,                  // the modelled Win is printed +/- this
    fit_gate: 0.35,                    // Fit below this gates the keyword (reason low_fit)
    fit_unknown: 0.5,                  // nothing on file to judge topic distance: modelled middle, flagged
    fit_no_place: 0.9,                 // a keyword that names no place, for a site measured in one market
    fit_title_weight: 0.25,            // share of Fit read from the results' titles when they are in hand
    fit_spread: 0.1,                   // an inferred Fit is printed +/- this
    labs_unsure: 0.65,                 // a provider intent probability under this is "unsure" (R5 13.1 #7, Arabic labels)
    // demand (R4 6.4): clicks a page at p_star would get, after the AI answer's click loss; GSC impressions beat provider volume
    demand: { p_star: 5, d_ref: 300, floor: 0.15, floor_low: 0.10, floor_high: 0.25, min_sources_for_floor: 2, gsc_days: 28, month_days: 30,
      ctr_spread: 0.30, volume_spread: 0.20, gsc_max_position: 20, floor_volume: 5, floor_volume_high: 20, censored_high: 3 },
    // click-through by position (modelled curve; positions 11-20 and 21-30 flat)
    ctr: [0.28, 0.155, 0.10, 0.07, 0.053, 0.042, 0.034, 0.028, 0.024, 0.021],
    ctr_p11_20: 0.010, ctr_p21_30: 0.004,
    // win inputs
    existing_rank: [{ max: 10, v: 1.0 }, { max: 20, v: 0.8 }, { max: 50, v: 0.5 }],
    strength_span: 10,                 // 10x the median strength of the top 10 = 1.0, a tenth = 0.0, equal = 0.5
    strength_unknown: 0.5, strength_unknown_spread: 0.25,
    topical_ref: 5,                    // this many of the site's own ranking queries on the topic = Topical 1.0
    topical_max_position: 50,
    weak: { stale_days: 730, thin_words: 300, low_rank: 100, low_refdomains: 10 },
    // value (R4 6.4)
    value: { cpc_ref: 15, missing: 0.5, missing_spread: 0.25 },
    // gap (R4 6.4)
    gap_ai_bonus: 0.5,
    // stage weights (R4 6.4 StageW); the app mirror is KI_STAGE_WEIGHT (parity fixture)
    stage_weights: { hire: 1.0, compare: 0.9, solution: 0.650, problem: 0.5, info: 0.3 },
    // stage rule (R4 6.5): page-type shares of the top 10 that decide
    stage_rule: { min_read: 4, provider_share: 0.40, list_share: 0.30, info_share: 0.50, ads_commercial: 3, review_below: 0.6 },
    // clustering (R4 6.3)
    cluster: { t_page: 3, t_hub: 2, top_n: 10, min_urls: 3 },
    // competitor score (R4 6.1)
    comp_weights: { serp_share: 0.45, topic_sim: 0.20, geo_match: 0.15, ai_share: 0.20 },
    comp_spread: 0.15,                 // an inferred TopicSim / GeoMatch is printed +/- this
    comp_min_seeds: 2,                 // with 3+ seeds read, a scored competitor must be seen on at least this many
    comp_max_rows: 20, comp_max_chosen: 5, comp_leave_after_misses: 2,
    class_review_below: 0.6,           // class confidence under this = needs your review
    direct_topic: 0.5,                 // TopicSim from which a business is a direct competitor (no contrary market evidence)
    size: { out_kw: 20, out_rd: 10, leader: 3, smaller: 1 / 3 },
    // candidate pipeline (DESIGN 3.2)
    caps: { enrich: 300, serp: 60, seeds: 20, plan: 10, questions: 30, striking: 30, clusters_out: 50, evidence: 20 },
    // striking distance (DESIGN 3.11): one definition everywhere
    striking: { min: 8, max: 20, impressions: 100, small_site_impressions: 30, small_site_total: 5000 },
    // page action (DESIGN 3.9 / 3.10)
    page_action: { list_share: 0.50 },
    // gaps (R4 6.2)
    gaps: { missing_min: 2, top: 10, absent_over: 100, weak_min: 11, weak_max: 100, strong_max: 7 },
    // plan (DESIGN 3.13): expected value multipliers per action and verdict
    plan: { kind_mult: { refresh: 1.15, new_page: 1.0, list: 0.9, pitch: 0.7, link: 0.5, defend: 0.6 },
      verdict_mult: { go: 1.0, months: 0.75, hard: 0.4 }, gap_ev: { listing: 30, ai_answer: 25, backlink: 15, page_type: 28, topic: 32 } },
    // credits of a started action: usd x markup / credit value (the app's rate, cost.ts content = 1.90)
    credits: { markup: 3, credit_value_usd: 0.05, usd: { new_page: 1.90, refresh: 1.90, list: 0, pitch: 0, link: 0, defend: 0 } },
    // cache TTLs, days (DESIGN 7)
    ttl_days: { serp: 1, ranked_keywords: 7, volume: 30, backlinks: 7, homepage: 14, competitors: 30 },
    // the AI answer's share of clicks lost, per stage (modelled, R4 6.4: informational 0.55, comparison 0.40, selection 0.15)
    aio_loss: { info: 0.55, problem: 0.55, solution: 0.40, compare: 0.40, hire: 0.15, local_pack: 0.10 }
  };
  const merge = (a, b) => { if (!isObj(b)) return a; const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v; return out; };
  /** the config a run uses: KI.CONFIG with its config_json (object or JSON string) merged in */
  const cfg = (over) => merge(CONFIG, jparse(over, {}));
  const C = (c) => (c && c.rule_version ? c : cfg(c));

  // ---------------------------------------------------------------------------------------------------------------------------------
  // words
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** the keyword as shown and stored: NFKC, lower case, punctuation to spaces, one space */
  const norm = (kw) => { let s = S(kw); try { s = s.normalize('NFKC'); } catch (e) {}
    return s.toLowerCase().replace(/[\u2018\u2019'`]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim(); };
  const KEY_STOP = new Set(['a', 'an', 'the', 'in', 'of', 'for', 'to', 'at', 'on', 'and', 'with', 'by', 'near', 'from']);
  const stem1 = (t) => (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) ? t.replace(/ies$/, 'y').replace(/s$/, '') : t;
  /** close variants share one key: stop words out, plurals folded, single letters joined to the next word (e invoicing = einvoicing),
   *  word order ignored ("uae erp software" = "erp software uae"). Deterministic, never empty for a non-empty keyword. */
  // FX-L L1: stop words go BEFORE single letters are joined ("what is a crm company" = "what is crm company", never "acrm"), and a migration
  // pair keeps its direction ("sap to dynamics 365 migration" is not "dynamics 365 to sap migration")
  const MIGRATE = /\b(?:migrat\w*|upgrad\w*|mov(?:e|ing)|switch\w*|convert\w*|transition\w*)\b/;
  const key = (kw) => { const n = norm(kw); const all = n.split(' ').filter(Boolean); const dir = /\b(?:to|from)\b/.test(n) && MIGRATE.test(n);
    const toks = all.filter(t => !KEY_STOP.has(t) || (dir && (t === 'to' || t === 'from'))); const base = toks.length ? toks : all; const j = [];
    for (let i = 0; i < base.length; i++) { if (base[i].length === 1 && /\p{L}/u.test(base[i]) && i + 1 < base.length) { base[i + 1] = base[i] + base[i + 1]; continue; } j.push(base[i]); }
    const use = j.map(stem1);
    return dir ? use.join(' ') : uniq(use).sort().join(' '); };
  const GEO = (typeof FIT_GEO !== 'undefined' && FIT_GEO instanceof Set) ? FIT_GEO : new Set(['uae', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'gcc', 'ksa', 'saudi', 'qatar', 'oman', 'bahrain', 'kuwait', 'pakistan', 'india', 'uk', 'usa', 'us']);
  const TOK_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me', 'near', 'best', 'top', 'vs']);
  const toks = (s) => norm(s).split(' ').filter(t => t.length > 1 && !TOK_STOP.has(t));
  const ownToks = (s) => toks(s).filter(t => !GEO.has(t) && !/^\d+$/.test(t)).map(stem1);

  /** the site's services as a LIST of phrases (R3 #4: a confirmed service is never split on a comma inside it). Arrays are kept as given;
   *  a JSON array string is parsed; a plain string is split on new lines, semicolons, pipes and bullets, and on commas ONLY when every
   *  piece is a short phrase (a list typed in one line), never inside a sentence. */
  // FX-L B1 (REVIEW_LOGIC B1): the stored lists are not clean. services_json / declared_services hold the pieces of ONE sentence cut at
  // commas and at 80 characters ("Microsoft Dynamics 365 consulting and implementation in the UAE and GCC: Busines", "CRM and Project
  // Operations. We also do NAV", "and ongoing managed IT support. Every solution is built around your business nee"). EVERY item, array or
  // string, goes through the same cleaner: a word cut by the 80-character limit is dropped, the item is split at sentence ends, colons,
  // semicolons, bullets and (short pieces only) commas; "We provide" / "we also do" / a leading "and" go; a market tail ("in the UAE and
  // GCC") goes; a sentence ("Every solution is built ...") is not a service; "X and Y" becomes X and Y ("GP and AX migrations" -> "GP
  // migrations", "AX migrations"; "consulting and implementation" keeps its product). Deduped by KI.key. NO cap by position (the caller
  // ranks by relevance first and caps after): devaicon's "Open edX Services" is item 21 of 30.
  const SVC_GEO = '(?:uae|u\\.a\\.e|gcc|dubai|abu dhabi|sharjah|ajman|middle east|mena|the region|region|saudi arabia|saudi|ksa|qatar|oman|bahrain|kuwait|pakistan|india|uk|usa|us|emirates)';
  const SVC_GEO_TAIL = new RegExp('\\s+(?:in|across|for|throughout|within|around)\\s+(?:the\\s+)?' + SVC_GEO + '(?:\\s*(?:,|and|&)\\s*(?:the\\s+)?' + SVC_GEO + ')*\\b.*$', 'i');
  const SVC_GEO_HEAD = new RegExp('^(?:the\\s+)?' + SVC_GEO + '\\s+(?=\\S)', 'i');
  const SVC_VERB = /^(?:(?:we|our team|our company|our experts|i)\s+)?(?:also\s+|can\s+)?(?:provide|provides|offer|offers|deliver|delivers|do|does|build|builds|specialise in|specialize in|specialised in|specialized in|help with|work on|handle|handles|cover|covers|support you with)\s+/i;
  const SVC_LEAD = /^(?:(?:and|or|also|plus|as well as|including|incl\.?|such as|like|e\.g\.?|with)\s+)+/i;
  const SVC_SENT = /^(?:every|each|this|that|these|those|it|its|it's|there|here|when|while|because|if|which|who|whose|all|many|most|some|any|no|we|our|you|your|they|their|us|i|get|let|contact|call|learn|read|find|see)\b/i;
  const SVC_GENERIC = new Set(['services', 'service', 'solutions', 'solution', 'support', 'consulting', 'consultancy', 'implementation', 'implementations', 'development', 'compliance', 'migration',
    'migrations', 'integration', 'integrations', 'management', 'hosting', 'training', 'maintenance', 'systems', 'system', 'software', 'apps', 'products', 'upgrades', 'upgrade', 'automation', 'audit', 'audits']);
  const svcClean = (p0) => { let p = S(p0).replace(/\s+/g, ' ').trim();
    for (let k = 0; k < 3; k++) p = p.replace(SVC_LEAD, '').replace(SVC_VERB, '').trim();
    p = p.replace(SVC_GEO_TAIL, '').replace(SVC_GEO_HEAD, '').replace(/^[\s\-\u2013\u2014*+.,:;]+|[\s\-\u2013\u2014*+.,:;!?]+$/g, '').trim();
    return p; };
  const svcOk = (p) => { const w = p.split(/\s+/).filter(Boolean); if (!w.length || w.length > 7 || p.length < 2 || p.length > 70) return false;
    if (SVC_SENT.test(p) || /[.!?]/.test(p.replace(/\b[a-z]\.[a-z]\.?/gi, '').replace(/\.(?=net|js|io)\b/gi, ''))) return false;
    if (!/\p{L}/u.test(p)) return false; if (w.length === 1 && (SVC_GENERIC.has(w[0].toLowerCase()) && !/^automation$/i.test(w[0]))) return false;
    if (w.length === 1 && w[0].length < 3 && !/^[A-Z0-9&]{2}$/.test(w[0])) return false; return true; };
  // "X and Y": two services, or one with a shared head / tail ("GP and AX migrations", "Dynamics 365 consulting and implementation")
  const svcAnd = (p) => { const m = p.match(/^(.+?)\s+and\s+(.+)$/i); if (!m) return [p];
    let L = m[1].trim(), R = m[2].trim(); const Lw = L.split(' '), Rw = R.split(' ');
    const gen = (t) => SVC_GENERIC.has(S(t).toLowerCase());
    if (Rw.length <= 2 && Rw.every(gen) && Lw.length >= 2) R = (gen(Lw[Lw.length - 1]) ? Lw.slice(0, -1) : Lw).concat(Rw).join(' ');
    else if (Lw.length === 1 && Rw.length >= 2 && gen(Rw[Rw.length - 1]) && !gen(Lw[0]) && (Lw[0].length <= 4 || /^[A-Z0-9&]+$/.test(Lw[0]))) L = Lw[0] + ' ' + Rw[Rw.length - 1];   // a product code ("GP and AX migrations")
    return [L, ...svcAnd(R)]; };
  const svcPieces = (raw) => { let t = S(raw).replace(/\s*[\r\n]+\s*/g, ' ; ').replace(/[ \t]+/g, ' ').trim(); if (!t) return [];
    // a piece cut by the 80-character limit (no closing punctuation): its last, partial word is not a word
    if (t.length >= 78 && t.length <= 82 && !/[.!?)\]]$/.test(t)) t = t.replace(/\s*\S+$/, '');
    const out = [];
    const paren = []; t = t.replace(/\(([^)]{2,40})\)/g, (_m, x) => { paren.push(x); return ' '; });
    const segs = t.split(/\s*(?:\n|;|\||\u2022|\u00b7|:\s|:$|\.\s+(?=[A-Z0-9])|\.$|\s-\s|\s\u2013\s|\s\u2014\s)\s*/).map(x => x.trim()).filter(Boolean);
    for (const s0 of segs) { let pieces = [s0];
      if (s0.includes(',')) { const c = s0.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean); if (c.length >= 2 && c.every(x => x.split(/\s+/).length <= 7)) pieces = c; }
      for (const p1 of pieces) { const p = svcClean(p1); if (!p) continue;
        const parts = p.split(/\s+/).length <= 8 && /\sand\s/i.test(p) ? svcAnd(p).map(svcClean) : [p];
        for (const x of parts) if (svcOk(x)) out.push(x); } }
    for (const x of paren) { const p = svcClean(x); if (svcOk(p) && p.split(' ').length <= 3) out.push(p); }
    return out; };
  const services = (v) => {
    let a = v;
    if (typeof a === 'string') { const j = jparse(a, null); if (Array.isArray(j)) a = j; }
    const items = Array.isArray(a) ? a.flatMap(x => Array.isArray(x) ? x : [isObj(x) ? (x.name || x.service || x.title || '') : x]) : [a];
    const out = []; const seen = new Set();
    for (const it of items) for (const p of svcPieces(it)) { const k = key(p); if (!k || seen.has(k)) continue; seen.add(k); out.push(p); }
    return out.slice(0, 120);
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // hosts and urls
  // ---------------------------------------------------------------------------------------------------------------------------------
  const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,20})$/;
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const bareHost = (h) => S(h).toLowerCase().trim().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^@\/]*@/, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\d?\./, '');
  /** a valid registrable web host, or '' (text fragments, IP literals, single words, spaces) */
  const validHost = (h) => { const x = bareHost(h); if (!x || /\s/.test(S(h).trim().replace(/^[a-z]+:\/\//i, '').replace(/[\/?#].*$/, '')) || /^\d+(\.\d+){3}$/.test(x)) return ''; return HOST_RE.test(x) ? x : ''; };
  const reg = (h) => { const x = bareHost(h); if (typeof CMP === 'object' && CMP && typeof CMP.reg === 'function') return CMP.reg(x);
    const p = x.split('.').filter(Boolean); if (p.length <= 2) return x; const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  /** the host of a SERP item, or null when it is not known (no domain, or a Google redirect that still says google.com) */
  const hostOf = (it) => { if (!it) return null; if (typeof it === 'string') return validHost(it) || null;
    const u = S(it.url); if (REDIR.test(u) && !it.url_recovered) return null;
    if (it.domain === null && it.url_exact === false) return null;
    const h = validHost(it.domain || it.main_domain || (u.match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');
    if (!h) return null; if (REDIR.test(u) && /(^|\.)google\./.test(h)) return null;
    return h; };
  const pathTokens = (it) => { const u = S(typeof it === 'string' ? it : it.url).toLowerCase();
    let p = u.replace(/^[a-z]+:\/\/[^\/?#]*/, '').replace(/[?#].*$/, '');
    p = p.replace(/\.(html?|php|aspx?)$/, '');
    return p.split('/').map(x => x.replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '')).filter(Boolean); };
  /** the identity of a result page for clustering: host + path tokens, www / scheme / slash / query ignored. An approximate (recovered)
   *  url is keyed the same way, so the same breadcrumb on two results pages agrees; a partial one, or one with no host, has no key. */
  const urlKey = (it) => { if (!it) return null; const o = typeof it === 'string' ? { url: it } : it;
    if (o.url_partial === true) return null; const h = hostOf(o); if (!h) return null;
    const p = pathTokens(o); return h + (p.length ? '/' + p.join('/') : '/'); };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // domain classes (R4 6.1 #5): rules + known lists first, page text second, an LLM answer only when the caller passes one
  // ---------------------------------------------------------------------------------------------------------------------------------
  // the vendor of a product a client may resell or implement: a service naming the product makes its domains PRINCIPALS (never competitors)
  const PRINCIPALS = [
    { re: /\b(microsoft|dynamics|d365|business central|power platform|power bi|power apps|power automate|fabric|copilot|azure|sharepoint|office 365|microsoft 365|m365|navision|nav|great plains|dynamics gp|dynamics ax)\b/i,
      hosts: ['microsoft.com', 'dynamics.com', 'microsoft.ae', 'azure.com', 'powerbi.com', 'powerplatform.com', 'office.com', 'microsoftonline.com', 'windows.net', 'sharepoint.com'] },
    { re: /\bopen ?edx\b/i, hosts: ['openedx.org', 'axim.org', 'edx.readthedocs.io', 'openedx.atlassian.net'] },
    { re: /\bodoo\b/i, hosts: ['odoo.com'] }, { re: /\bsap\b|s\/?4 ?hana/i, hosts: ['sap.com'] }, { re: /\bsalesforce\b/i, hosts: ['salesforce.com'] },
    { re: /\bhubspot\b/i, hosts: ['hubspot.com'] }, { re: /\bzoho\b/i, hosts: ['zoho.com'] }, { re: /\bnetsuite\b/i, hosts: ['netsuite.com', 'oracle.com'] },
    { re: /\boracle\b/i, hosts: ['oracle.com'] }, { re: /\bsage\b/i, hosts: ['sage.com'] }, { re: /\bshopify\b/i, hosts: ['shopify.com'] },
    { re: /\baws\b|amazon web services/i, hosts: ['aws.amazon.com', 'amazonaws.com'] }, { re: /\bgoogle cloud\b|\bgcp\b/i, hosts: ['cloud.google.com'] },
    { re: /\bgoogle workspace\b/i, hosts: ['workspace.google.com'] }, { re: /\bpeppol\b/i, hosts: ['peppol.org', 'peppol.eu'] },
    { re: /\bmoodle\b/i, hosts: ['moodle.org', 'moodle.com'] }, { re: /\bservicenow\b/i, hosts: ['servicenow.com'] }, { re: /\bacumatica\b/i, hosts: ['acumatica.com'] },
    { re: /\bwordpress\b/i, hosts: ['wordpress.org', 'wordpress.com'] }, { re: /\bmagento\b|adobe commerce/i, hosts: ['magento.com', 'adobe.com'] }
  ];
  // global platforms and other software vendors (format or vendor, not a competitor), beyond CMP's lists
  const PLATFORM_HOSTS = /(^|\.)(zapier|make|notion|slack|canva|figma|monday|asana|trello|clickup|airtable|freshworks|freshdesk|zendesk|pipedrive|intercom|mailchimp|dropbox|box|docusign|stripe|paypal|twilio|okta|infor|epicor|ifs|unit4|tally|quickbooks|sage|acumatica|syspro|xero|freshbooks|wave|bitrix24|insightly|keap|sugarcrm|vtiger|creatio|medium|researchgate|academia|sciencedirect|springer|ieee|arxiv|mdpi|ncbi|scribd|slideshare|issuu|github|gitlab|bitbucket|stackoverflow|npmjs|readthedocs|wikipedia|wikimedia|wikihow|fandom|quora|reddit|tumblr|blogspot|wordpress|wix|weebly|squarespace|upwork|fiverr|freelancer|toptal|guru|peopleperhour|play\.google|apps\.apple|appsource\.microsoft)\.[a-z.]+$/;
  // directories, review sites and "top companies" ranking sites (places to be listed)
  const DIRECTORY_HOSTS = /(^|\.)(clutch|themanifest|goodfirms|sortlist|designrush|techbehemoths|topdevelopers|itfirms|appfutura|f6s|g2|capterra|getapp|softwareadvice|trustradius|trustpilot|peerspot|softwaresuggest|gartner|saashub|alternativeto|selecthub|financesonline|softwareworld|crozdesk|technologyadvice|appvizer|softwarefinder|softwareconnect|top10erp|erpfocus|upcity|agencyspotter|expertise|yelp|yellowpages|2gis|crunchbase|zoominfo|dnb|kompass|hidubai|uaeyp|serchen|bark|thumbtack|goodfirms|rightfirms|techreviewer|vendorland|builtin|zoftwarehub)\.[a-z.]+$/;
  // trade media and analyst blogs that write about the products a client sells (they rank, they compete for no buyer)
  const MEDIA_HOSTS = /(^|\.)(erpresearch|erpsoftwareblog|msdynamicsworld|dynamicscommunity|technologyevaluation|panorama-consulting|erpnews|cio|computerweekly|itpro|zdnet|techtarget|techradar|forbes|businessinsider|entrepreneur|inc|fastcompany|venturebeat|techcrunch|theverge|wired|khaleejtimes|gulfnews|thenationalnews|arabianbusiness|zawya|gulfbusiness|itp|economymiddleeast|wamda|magnitt|cxotoday|tahawultech|menabytes|analyticsinsight|towardsdatascience|kdnuggets|marktechpost|dawn|tribune|propakistani|techjuice|mashable|engadget|bbc|cnn|reuters|bloomberg|cnbc|nytimes|theguardian|ft|wsj|economist)\.[a-z.]+$/;
  // regulators, central banks and public bodies whose addresses do not end in .gov (beyond CMP's UAE free-zone list and the .gov endings)
  const GOV_HOSTS = /(^|\.)(centralbank|cbuae|ico|fca|cma|sbp|secp|pta|fbr|sama|zatca|rbi|sebi|sec|ecb|europa|edpb|vara|sca|dfsa|fsra|tra|tdra|citra|qcb|cbb|cbo|cbk|mas|bnm|bis|imf|worldbank|oecd|un|who)\.(?!(?:com|net|io|ai|co|app|dev|biz)$)(?:[a-z]{2,3}|(?:org|gov|gob|go|or)\.[a-z]{2})$/;
  const CC_MARKET = { ae: 'AE', sa: 'SA', qa: 'QA', om: 'OM', bh: 'BH', kw: 'KW', eg: 'EG', pk: 'PK', in: 'IN', uk: 'GB', 'co.uk': 'GB', au: 'AU', 'com.au': 'AU', ca: 'CA', de: 'DE', fr: 'FR', nl: 'NL',
    es: 'ES', it: 'IT', ie: 'IE', sg: 'SG', my: 'MY', za: 'ZA', ng: 'NG', ke: 'KE', nz: 'NZ', 'co.nz': 'NZ', 'com.pk': 'PK', 'co.in': 'IN', 'com.sa': 'SA', 'com.eg': 'EG', tr: 'TR', jo: 'JO', lb: 'LB', ma: 'MA' };
  const hostMarket = (h) => { const x = bareHost(h); const p = x.split('.'); const two = p.slice(-2).join('.'); return CC_MARKET[two] || CC_MARKET[p[p.length - 1]] || ''; };
  // CMP's host kind -> the KI class (search engines and the site itself are not classes: they are never stored)
  const KIND_CLASS = { job: 'job_board', directory: 'directory', review: 'directory', marketplace: 'platform', media: 'media', gov: 'government',
    social: 'platform', qa: 'platform', reference: 'platform', education: 'platform', help: 'platform', platform: 'platform' };
  const principalsOf = (ctx) => { const o = ctx || {}; const txt = services(o.services).concat(services(o.topics || [])).join(' | ');
    const out = new Set((Array.isArray(o.principals) ? o.principals : []).map(x => reg(validHost(x) || x)).filter(Boolean));
    for (const p of PRINCIPALS) if (p.re.test(txt)) p.hosts.forEach(h => out.add(h));
    return out; };
  const isPrincipal = (h, set) => { for (const p of set) if (h === p || h.endsWith('.' + p) || reg(h) === p) return true; return false; };
  // FX-L B2 (REVIEW_LOGIC B2): the topic of a DOMAIN is read from its OWN text only - the titles of its results and its homepage words -
  // never from the search it was found on. The seeds are built from the client's services, so a seed's words always match them, and every
  // business on a service results page came out "direct" ("sometravel.com" on "dynamics 365 business central company dubai": 100%). Per
  // title: a service phrase of 2+ words inside it = 1, a product or category the client sells (Open edX, Dynamics 365, Peppol, ERP, CRM) =
  // 0.8, else the share of its own words (the brand's words and seller words like "company" / "best" / "solutions" left out) that are
  // the client's service words; its homepage: how many of the client's service phrases it names (3 = 1.0). The best reading counts. No
  // text of its own -> null (the caller says "needs your review", never "direct").
  const SELLER_W = new Set(['company', 'companies', 'services', 'service', 'solutions', 'solution', 'provider', 'providers', 'partner', 'partners', 'agency', 'agencies', 'firm', 'firms',
    'consultants', 'consultant', 'best', 'top', 'leading', 'official', 'homepage', 'welcome', 'group', 'llc', 'ltd', 'fze', 'fzco', 'inc', 'global', 'international',
    'technologies', 'technology', 'tech', 'experts', 'expert', 'specialists', 'specialist', 'trusted', 'certified', 'reviews', 'review', 'site', 'website', 'page', 'guide', 'choose', 'how', 'why']);
  const SELLER_S = new Set([...SELLER_W].map(stem1));
  const PRODUCT_W = /\b(?:open ?edx|dynamics 365|d365|business central|power bi|power platform|power apps|power automate|copilot studio|navision|great plains|dynamics (?:gp|ax|nav|crm)|sap(?: b1| business one| s\/?4 ?hana)?|odoo|netsuite|salesforce|zoho|moodle|hubspot|peppol|pint ?ae|sharepoint|azure|servicenow|acumatica|shopify|magento)\b/gi;
  const TOPIC_WEAK = new Set(['automation', 'cloud', 'ai', 'data', 'digital', 'it', 'web', 'marketing', 'design', 'consulting', 'support', 'software', 'development', 'service', 'solution', 'system', 'technology', 'integration', 'analytic', 'security']);
  const STANDARDS = [{ re: /e-?invoic|peppol|fatoora|zatca/, words: ['pint', 'peppol', 'ubl', 'fatoora', 'einvoice', 'einvoicing', 'invoicing'] },
    { re: /open ?edx|\blms\b|moodle/, words: ['edx', 'lms', 'scorm', 'xapi', 'lti'] }];
  const CAT_W = new Set(['erp', 'crm', 'hrms', 'hcm', 'lms', 'wms', 'einvoicing', 'peppol', 'odoo', 'netsuite', 'salesforce', 'zoho', 'moodle', 'hubspot', 'sharepoint', 'servicenow', 'acumatica', 'edx']);
  const topicKit = (ctx) => { const o = ctx || {}; const svc = services(o.services).concat(services(o.topics || []));
    const strip = (arr) => arr.filter(t => !SELLER_S.has(t));
    const phr = uniq(svc.map(x => strip(ownToks(x)).join(' ')).filter(Boolean)).map(x => x.split(' '));
    const prods = uniq(svc.flatMap(x => (S(x).match(PRODUCT_W) || []).map(m => ownToks(m).join(' '))).filter(Boolean)).map(x => x.split(' '));
    const cats = new Set(svc.flatMap(ownToks).filter(t => CAT_W.has(t)));
    // the standards a service works in are its subject too (PINT AE, Peppol, UBL for an e-invoicing service)
    const allTxt = svc.join(' | ').toLowerCase();
    for (const st of STANDARDS) if (st.re.test(allTxt)) st.words.forEach(w => cats.add(w));
    // a generic word ("automation", "cloud", "ai") is weak evidence alone: it counts half (a whole service phrase still counts 1 above)
    const strong = new Set(phr.flat().filter(t => !TOPIC_WEAK.has(t)));
    return { svc, strip, phr, prods, cats, vocab: new Set(phr.flat()), strong }; };
  /** KI.topicSim(titles, homeText, ctx, host) -> 0..1 or null: a domain's own text against the client's services (see above) */
  const topicSim = (titles, homeText, ctx, host) => {
    const K = topicKit(ctx); if (!K.svc.length) return null;
    // the site's own name in a title ("... | Rand Group", "Edly - ...") is left out: the title segment whose letters ARE the host's label
    const lab = S(validHost(host) || host).split('.')[0].replace(/[^a-z0-9]/g, '');
    const sq = (x) => norm(x).replace(/[^a-z0-9]/g, '');
    const noBrand = (text) => { const seg = S(text).split(/\s+[|\-\u2013\u2014:\u00b7]\s+/).map(x => x.trim()).filter(Boolean);
      const keep = seg.filter(x => { const q = sq(x); return !(lab.length >= 3 && q && x.split(/\s+/).length <= 4 && (q === lab || lab.includes(q) || q.includes(lab))); });
      return (keep.length ? keep : seg).join(' '); };
    const own = (text) => uniq(K.strip(ownToks(noBrand(text))));
    const one = (text) => { const tw = own(text); if (!tw.length) return null; const set = new Set(tw); const has = (p) => p.length && p.every(t => set.has(t));
      if (K.phr.some(p => p.length >= 2 && has(p))) return 1;
      if (K.prods.some(has) || tw.some(t => K.cats.has(t))) return 0.8;
      return r2(tw.reduce((x, t) => x + (K.strong.has(t) ? 1 : K.vocab.has(t) ? 0.5 : 0), 0) / tw.length); };
    const ts = (Array.isArray(titles) ? titles : [titles]).filter(t => S(t).trim()).slice(0, 8).map(one).filter(x => x != null);
    let hs = null; if (S(homeText).trim()) { const set = new Set(ownToks(homeText)); const hit = (p) => p.length && p.every(t => set.has(t));
      hs = clip((K.phr.filter(p => p.length >= 2 && hit(p)).length + K.prods.filter(hit).length) / 3, 0, 1); }
    const all = ts.concat(hs == null ? [] : [hs]); return all.length ? Math.max(...all) : null; };
  /** KI.classifyDomain(host, ctx) -> { class, basis, confidence, reasons, valid, host, reg, store, needs_review }
   *  ctx: { own_domain, market (ISO2), services (list), topics, principals, declared: [domains], user: { domain: class },
   *         appearances: [{ keyword, position, type, title, url }] (this domain on the run's results pages; titles are untrusted text),
   *         pages: [{ url, title, text }] (its own pages read, untrusted), llm: { class, confidence } (only when an LLM was asked) }
   *  store=false for anything that may never become a competitor row: text fragments, search engines, the site itself. */
  const CLASS_IDS = ['direct', 'adjacent', 'principal', 'directory', 'publisher_list', 'platform', 'government', 'job_board', 'media'];
  const classifyDomain = (host, ctx) => {
    const o = ctx || {}; const raw = S(host).trim();
    const h = validHost(raw);
    const out = (cls, basis, conf, reasons, extra) => ({ class: cls, basis, confidence: r2(conf), reasons, valid: !!h, host: h || raw, reg: h ? reg(h) : '', store: !!cls,
      needs_review: !!cls && conf < C(o.cfg).class_review_below, ...(extra || {}) });
    if (!h) return { ...out(null, 'rule', 1, ['not a web address: ' + ascii(raw).slice(0, 60)]), valid: false, store: false, reject: 'fragment' };
    const own = validHost(o.own_domain);
    if (own && (h === own || h.endsWith('.' + own) || reg(h) === reg(own))) return { ...out(null, 'rule', 1, ['your own site']), store: false, reject: 'own_site' };
    const R = reg(h);
    // the client's or a platform admin's own word is final
    const user = isObj(o.user) ? (o.user[h] || o.user[R]) : null;
    if (user && CLASS_IDS.includes(user)) return out(user, 'user', 1, ['set by you']);
    const pset = principalsOf(o);
    if (isPrincipal(h, pset)) return out('principal', 'rule', 0.95, ['the maker of a product you sell or implement']);
    const kind = (typeof CMP === 'object' && CMP && CMP.kindOfHost) ? CMP.kindOfHost(h, own) : 'business';
    if (kind === 'search') return { ...out(null, 'rule', 1, ['a search engine, never a competitor']), store: false, reject: 'search_engine' };
    if (kind === 'unknown') return { ...out(null, 'rule', 1, ['not a web address']), valid: false, store: false, reject: 'fragment' };
    const declared = (Array.isArray(o.declared) ? o.declared : services(o.declared)).map(x => reg(validHost(x) || x)).filter(Boolean);
    if (kind === 'gov' || GOV_HOSTS.test(h)) return out('government', 'rule', 0.95, ['a government, regulator or public body']);
    if (kind === 'job' || /(^|\.)(indeed|naukri|naukrigulf|bayt|glassdoor|monster|gulftalent|rozee|mustakbil|wuzzuf)\./.test(h)) return out('job_board', 'rule', 0.95, ['a job board']);
    if (DIRECTORY_HOSTS.test(h)) return out('directory', 'rule', 0.9, ['a directory or review site where companies are listed']);
    if (MEDIA_HOSTS.test(h)) return out('media', 'rule', 0.85, ['a news, trade media or analyst site']);
    if (PLATFORM_HOSTS.test(h)) return out('platform', 'rule', 0.9, ['a global platform or another company\'s software']);
    const ccOnly = /^[a-z0-9-]+\.[a-z]{2}$/.test(R) && !/\.(io|ai|co|me|tv|ly|fm)$/.test(R);
    if (kind !== 'business' && !(kind === 'platform' && ccOnly)) return out(KIND_CLASS[kind] || 'platform', 'rule', 0.9, [(typeof CMP === 'object' && CMP.LABEL && CMP.LABEL[kind]) || kind]);
    if (declared.includes(R)) return out('direct', 'declared', 0.9, ['declared by you as a competitor']);
    // page signals: what this domain's results on the run's pages are, and what its own pages say (untrusted text)
    const apps = (Array.isArray(o.appearances) ? o.appearances : []).filter(Boolean);
    const typed = apps.map(a => ({ a, t: S(a.type) || (a.url || a.title ? pageType({ url: a.url, domain: h, title: a.title }, o) : '') })).filter(x => x.t);
    const types = typed.map(x => x.t);
    const nList = types.filter(t => t === 'list').length, nProv = types.filter(t => t === 'provider' || t === 'vendor').length;
    const nGuide = types.filter(t => t === 'guide' || t === 'news' || t === 'video').length;
    const reasons = [];
    // FX-L H3: a list publisher needs two list pages, or one list of PRODUCTS; one list of providers on a site is often that provider's own
    // article ("Best Open edX Service Providers in 2026 - Edly"), so it is read on its topic below, at review confidence
    let oneSellerList = false;
    if (types.length >= 1 && nList === types.length && nProv === 0) {
      if (types.length >= 2) return out('publisher_list', 'page', 0.8, ['every result of it read is a list of companies or products (' + nList + ')']);
      if (!LIST_SELLERS.test(S(typed[0].a.title))) return out('publisher_list', 'page', 0.55, ['its one result read is a list of products or tools']);
      oneSellerList = true;
    }
    if (typeof o.llm === 'object' && o.llm && CLASS_IDS.includes(o.llm.class)) {
      const lc = clip(num(o.llm.confidence) == null ? 0.5 : num(o.llm.confidence), 0, 1);
      return out(o.llm.class, 'llm', lc, ['an AI reading of its pages (' + Math.round(lc * 100) + '% sure)']);
    }
    // FX-L B2: its OWN text only (titles of its results, its pages), never the search it was found on
    const pageText = (Array.isArray(o.pages) ? o.pages : []).map(p => S(p.title) + ' ' + S(p.text).slice(0, 3000)).join(' | ');
    const sim = topicSim(apps.map(a => S(a.title)), pageText, o, h);
    const hm = hostMarket(h); const mkt = S(o.market).toUpperCase();
    const geoOff = !!(hm && mkt && hm !== mkt);
    const gm = hm === mkt && mkt ? 1 : 0.5;
    if (sim != null) reasons.push(Math.round(sim * 100) + '% topic match with your services (its own titles and pages)');
    if (hm) reasons.push('web address in ' + hm);
    if (oneSellerList) reasons.push('its one result read is a list of providers (it may be a competitor\'s own article)');
    const capC = (c) => (oneSellerList ? Math.min(c, 0.55) : c);
    if (sim === 0) return out('adjacent', 'page', 0.35, reasons.concat(['nothing in its own titles or pages matches your services: not counted as a competitor until you confirm']), { topic_sim: 0, geo_match: geoOff ? 0 : gm });
    if (geoOff) return out('adjacent', 'page', capC(0.7), reasons.concat(['based in another market']), { topic_sim: sim, geo_match: 0 });
    if (sim != null && sim >= C(o.cfg).direct_topic) return out('direct', 'page', capC(nProv ? 0.8 : nGuide && nGuide === types.length ? 0.6 : 0.7), reasons, { topic_sim: sim, geo_match: gm });
    if (sim != null) return out('adjacent', 'page', capC(0.6), reasons.concat(['sells something that overlaps']), { topic_sim: sim, geo_match: gm });
    // no text of its own: never "direct" from where it was found
    return out('adjacent', 'rule', 0.4, reasons.concat([apps.length ? 'seen on your service searches, but no title or page of its own was read: needs your review' : 'not enough evidence yet']), { topic_sim: null, geo_match: gm });
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // page type of one SERP item (R4 6.5 #1)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const PAGE_TYPES = ['provider', 'vendor', 'list', 'directory', 'guide', 'forum', 'job_board', 'government', 'news', 'video', 'other'];
  // FX-L H3 (REVIEW_LOGIC H3): a list needs a number ("Top 10 ...", "8 Best ..."), "list of", "alternatives" / "vs", or a PLURAL seller or
  // product noun as the head ("best CRM companies", "top ERP tools"); "Best ERP Software Company in Dubai" and "Leading CRM Solutions
  // Provider in Dubai" are a provider describing itself (singular seller), and a homepage is never a list without a number
  const LIST_NUM = /\b(?:top\s*\d+\+?|\d+\+?\s+(?:best|top|leading|greatest|biggest|largest|most)|list of)\b/i;
  const LIST_SELLERS = /\b(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|integrators|resellers|specialists|experts|studios|contractors)\b/i;
  const LIST_PLURAL = /\b(?:best|top|leading|biggest|largest|popular|recommended)\s+(?:[\w&.+-]+\s+){0,6}?(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|developers|integrators|resellers|specialists|studios|contractors|tools|platforms|softwares|apps|alternatives|options|picks|choices)\b(?!\s+(?:company|firm|agency|provider|partner|consultant|consultancy|developer|integrator|reseller|vendor|specialist)\b)/i;
  const LIST_OTHER = /\balternatives\b|\b(?:vs\.?|versus)\b|\bcompared\b|\bcomparison\b/i;
  const LIST_YEAR = /\b(?:best|top)\s+(?:[\w&.+-]+\s+){0,5}?(?:software|tools|apps|systems|platforms)\b.*\b20\d\d\b/i;
  const LIST_SLUG = /(?:^|\/)(?:\d+-)?(?:top|best)-(?:[a-z0-9]+-){0,6}?(?:\d+|companies|firms|agencies|providers|consultants|vendors|partners|developers|integrators|tools|platforms|softwares|apps|alternatives)(?:-|\/|$)|(?:^|\/)top-(?:[a-z0-9]+-){0,4}?software(?!-(?:company|provider|partner|development|house))(?:-|\/|$)/;
  const isListTitle = (t, p) => { const home = p === '/' || !S(p).replace(/\//g, '');
    if (LIST_NUM.test(t)) return true; if (home) return false;
    return LIST_PLURAL.test(t) || LIST_OTHER.test(t) || LIST_YEAR.test(t) || LIST_SLUG.test(p); };
  const GUIDE_T = /\b(?:what is|what are|what's|how to|how does|why|guide|tutorial|explained|overview|introduction|definition|meaning|vs|difference|everything you need|complete|ultimate|101|beginner|faq|examples?|review|reviews|pdf)\b|\?/i;
  const GUIDE_P = /\/(?:blog|blogs|insights?|articles?|news|resources?|learn|guides?|knowledge|academy|wiki|faq|post|posts|stories|publication|science|document|presentation|docs?)(?:\/|$)/;
  const SERVICE_P = /\/(?:services?|solutions?|products?|software|platform|industries|consulting|implementation|offerings?|what-we-do|capabilities|expertise|partners?)(?:\/|$|-)/;
  const SERVICE_T = /\b(?:services?|solutions?|software|platform|partner|consult(?:ing|ancy|ants?)|implementation|agency|company|developers?|development|hosting|support|integrat(?:ion|or)s?|provider)\b/i;
  const VIDEO_H = /(^|\.)(youtube|youtu|vimeo|dailymotion|tiktok)\.[a-z.]+$/;
  const pageType = (it, ctx) => {
    if (!it) return null; const h = hostOf(it); if (!h) return null;
    const t = S(it.title); const u = S(it.url).toLowerCase(); const p = '/' + pathTokens(it).join('/');
    const kind = (typeof CMP === 'object' && CMP && CMP.kindOfHost) ? CMP.kindOfHost(h, (ctx || {}).own_domain) : 'business';
    if (S(it.type) === 'video' || VIDEO_H.test(h) || /\/watch(?:$|\/)|\/videos?\//.test(p)) return 'video';
    if (kind === 'gov' || /(^|\.)(gov|gouv|gob|mil)(\.[a-z]{2})?$/.test(h)) return 'government';
    if (kind === 'job' || ((typeof CMP === 'object' && CMP.kindOfResult) ? CMP.kindOfResult(u, t, '') === 'job' : /\b(jobs?|vacanc|careers?)\b/i.test(t))) return 'job_board';
    if (isListTitle(t, p) && !/\b(what is|how to)\b/i.test(t)) return 'list';
    if (DIRECTORY_HOSTS.test(h) || kind === 'directory' || kind === 'review') return 'directory';
    if (kind === 'qa' || kind === 'social' || /\/(?:forums?|community|communities|questions|discussion|threads?|pulse)\//.test(p) || /(^|\.)(community|forums?|answers|techcommunity)\./.test(h)) return 'forum';
    if (kind === 'media' || MEDIA_HOSTS.test(h)) return 'news';
    if (kind === 'reference' || kind === 'education' || /(^|\.)(wikipedia|researchgate|sciencedirect|springer|ieee|arxiv|mdpi|scribd|slideshare|readthedocs)\./.test(h)) return 'guide';
    const pset = principalsOf(ctx || {}); const R0 = reg(h);
    const ccOnly = /^[a-z0-9-]+\.[a-z]{2}$/.test(R0) && !/\.(io|ai|co|me|tv|ly|fm)$/.test(R0);
    const vendorHost = isPrincipal(h, pset) || (kind === 'platform' && !ccOnly) || PLATFORM_HOSTS.test(h);
    const guide = GUIDE_T.test(t) || GUIDE_P.test(p);
    if (vendorHost) return guide && !/\/(?:products?|pricing|solutions?)(?:\/|$)/.test(p) ? 'guide' : 'vendor';
    if (guide && !(SERVICE_P.test(p) && !GUIDE_P.test(p))) return 'guide';
    if (SERVICE_P.test(p) || SERVICE_T.test(t) || p === '/' || !p.replace(/\//g, '')) return 'provider';
    if (typeof KWI === 'object' && KWI && KWI.shapeOf) { const sh = KWI.shapeOf(u, t); if (sh === 'Guide or article') return 'guide'; if (sh === 'Service or product page' || sh === 'Pricing page' || sh === 'Homepage') return 'provider'; }
    return t || p.length > 1 ? 'provider' : 'other';
  };
  /** the top 10 as stored (top10_json): [{ url, host, type, pos, exact }], items with no host skipped, positions kept */
  const top10 = (items, ctx, c0) => { const c = C(c0); const out = []; const seen = new Set();
    (Array.isArray(items) ? items : []).filter(x => x && (!x.type || /organic|video|local|^(provider|vendor|list|directory|guide|forum|job_board|government|news|video|other)$/.test(S(x.type))))
      .map((x, i) => ({ x, pos: num(x.rank_group) || num(x.pos) || num(x.position) || num(x.p) || (i + 1) }))
      .sort((a, b) => a.pos - b.pos)
      .forEach(({ x, pos }) => { if (out.length >= c.cluster.top_n || pos > c.cluster.top_n) return; const h = hostOf(x.u ? { ...x, url: x.u } : x); if (!h) return;
        const o = x.u ? { ...x, url: x.u, title: x.t } : x; const k = urlKey(o) || ('~' + h + '#' + pos); if (seen.has(k)) return; seen.add(k);
        const ty = PAGE_TYPES.includes(S(x.type)) ? S(x.type) : pageType(o, ctx);
        out.push({ url: S(o.url), host: h, type: ty, pos, exact: o.url_exact !== false }); });
    return out; };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // intent and stage (R4 6.5): strong words, then what ranks, then weak words, then the provider's label
  // ---------------------------------------------------------------------------------------------------------------------------------
  const W_INFO = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will)\b|\b(?:what is|what are|meaning|definition|define|explained|examples?|history|types of|benefits of|advantages|disadvantages|pros and cons|methodolog(?:y|ies)|models?|frameworks?|languages?|life ?cycle|sdlc|tutorial|course|courses|certification|jobs?|salary|salaries|careers?)\b/;
  const W_QUESTION = /^(?:what|who|why|when|where|which|is|are|does|do|can|should|will|how)\b/;
  // a product noun, a project noun, or the name of a product a client may sell (the PRINCIPALS list): people who know the solution they want
  const W_PRODUCT = /\b(?:software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|erp|crm|hrms|lms|implementation|migration|integration|upgrade|hosting)\b/;
  const W_COMPARE = /\b(?:best|top|vs|versus|alternatives?|compare|comparison|pricing|price|prices|cost|costs|fees?|quote|quotes|reviews?|rated|cheapest|affordable|ranking|rankings|list of)\b/;
  const W_PROBLEM = /\b(?:deadline|deadlines|penalt(?:y|ies)|fines?|mandate|mandatory|requirements?|compliance|compliant|rules|regulations?|law|problem|problems|issues?|errors?|not working|fix|risks?|challenges?|audit|phase 2|go live|obligations?)\b/;
  const W_SELLER_ONE = /\b(?:company|agency|firm|provider|partner|consultant|consultancy|contractor|developer|vendor|integrator|reseller|specialist|expert|freelancer|house|studio|near me|hire|hiring a)\b/;
  const W_SELLER_MANY = /\b(?:companies|agencies|firms|providers|partners|consultants|consultancies|contractors|developers|vendors|integrators|resellers|specialists|experts|studios)\b/;
  const W_SERVICE = /\b(?:(?:implementation|consulting|development|managed|support|migration|outsourcing|integration|maintenance|hosting|upgrade) services?|services? providers?|it services|managed services)\b/;
  const W_SOLUTION = /\b(?:software|system|systems|platform|platforms|tool|tools|solution|solutions|app|apps|application|module|modules|features?|implementation|migration|integration|upgrade|automation|development|hosting|cloud|erp|crm|hrms|lms|setup|process|services?)\b/;
  const W_NAV = /\b(?:log ?in|sign ?in|portal|login|download)\b/;
  const STAGE_INTENT = { hire: 'commercial', compare: 'commercial', solution: 'commercial', problem: 'informational', info: 'informational' };
  const TYPE_WORD = { provider: 'company service pages', vendor: 'software makers\' pages', list: 'lists', directory: 'directories', guide: 'guides or articles',
    forum: 'forum or social posts', job_board: 'job boards', government: 'government pages', news: 'news or media pages', video: 'videos', other: 'other pages' };
  const STAGE_WORD = { hire: 'people looking to hire', compare: 'people comparing options', solution: 'people looking for a solution', problem: 'people with a problem to solve', info: 'people learning about the topic' };
  const posW = (pos, i) => 1 / Math.sqrt(Math.max(1, num(pos) || (i + 1)));
  /** KI.stage(top10, keyword, labsIntent, ctx?) -> { stage, intent, confidence, evidence (text), shares, needs_review, by }
   *  top10: stored items ({ type, pos }) or raw SERP items (typed here); labsIntent: 'commercial' | ... or { label, probability }. */
  const stage = (topItems, keyword, labsIntent, ctx) => {
    const c = C((ctx || {}).cfg); const R = c.stage_rule;
    const kw = norm(keyword); const has = (re) => re.test(kw);
    const items = (Array.isArray(topItems) ? topItems : []).filter(Boolean).slice(0, c.cluster.top_n)
      .map((x, i) => ({ type: PAGE_TYPES.includes(S(x.type)) ? S(x.type) : pageType(x, ctx), pos: num(x.pos) || num(x.rank_group) || num(x.position) || (i + 1) }))
      .filter(x => x.type);
    const total = items.reduce((s, x, i) => s + posW(x.pos, i), 0);
    const share = (set) => total ? items.reduce((s, x, i) => s + (set.includes(x.type) ? posW(x.pos, i) : 0), 0) / total : 0;
    const sh = { provider: share(['provider', 'directory']), list: share(['list']), info: share(['guide', 'news', 'video', 'forum']), vendor: share(['vendor']) };
    const counts = {}; for (const x of items) counts[x.type] = (counts[x.type] || 0) + 1;
    const ctext = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => n + ' ' + (n === 1 ? TYPE_WORD[k].replace(/s$/, '').replace(/ pages$/, ' page') : TYPE_WORD[k])).join(', ');
    const li = isObj(labsIntent) ? S(labsIntent.label) : S(labsIntent); const lp = isObj(labsIntent) ? num(labsIntent.probability) : null;
    const nav = has(W_NAV) || li === 'navigational';
    const res = (st, conf, by, why) => { const informational = st === 'solution' && items.length >= R.min_read && sh.info >= R.info_share;
      const intent = nav && st !== 'hire' && st !== 'compare' ? 'navigational' : (informational ? 'informational' : (st === 'hire' && /\b(?:hire|buy|quote|near me)\b/.test(kw) ? 'transactional' : STAGE_INTENT[st]));
      const ev = (items.length ? items.length + ' results read: ' + ctext : 'results page not read') + ' -> ' + STAGE_WORD[st] + (why ? ' (' + why + ')' : '');
      return { stage: st, intent, confidence: r2(conf), evidence: ascii(ev), shares: { provider: r2(sh.provider), list: r2(sh.list), info: r2(sh.info), vendor: r2(sh.vendor) }, counts,
        read: items.length, needs_review: conf < R.review_below, by }; };
    if (!kw) return res('info', 0, 'none', 'no keyword');
    const serpOk = items.length >= R.min_read;
    // the SERP's own reading, when there is enough of it
    let serp = '';
    if (serpOk) {
      if (sh.list >= R.list_share && (sh.list >= sh.provider || has(W_SELLER_MANY) || has(W_COMPARE))) serp = 'compare';
      else if (sh.provider >= R.provider_share) serp = 'hire';
      else if (sh.info >= R.info_share) serp = 'info';
      else if (sh.vendor + sh.provider >= R.provider_share) serp = 'solution';
    }
    // 1. strong words (R4 6.5 #3)
    if (has(W_COMPARE) && !(/^(?:what|how|why|is|are)\b/.test(kw) && !/\b(?:best|top|vs|versus|alternatives?|cost|costs|price|pricing)\b/.test(kw))) return res('compare', serp === 'compare' ? 0.9 : 0.8, 'words', 'a comparison word');
    if (has(W_INFO) && (W_QUESTION.test(kw) || (!has(W_SELLER_ONE) && !has(W_SELLER_MANY)))) return res(has(W_PROBLEM) ? 'problem' : 'info', serp === 'info' || !serpOk ? 0.85 : 0.7, 'words', 'a learning word');
    if (/\bnear me\b/.test(kw)) return res('hire', 0.9, 'words', 'near me');
    // 2. what ranks
    const local = (typeof fitMarket === 'function') ? (fitMarket(kw, (ctx || {}).market || '').places || []).length > 0 : [...kw.split(' ')].some(t => GEO.has(t));
    const sellerOne = has(W_SELLER_ONE) || has(W_SERVICE), sellerMany = has(W_SELLER_MANY);
    if (serp === 'compare') return res('compare', sellerMany || sellerOne ? 0.85 : 0.75, 'serp', '');
    if (serp === 'hire') return res(has(W_PROBLEM) && !sellerOne ? 'problem' : 'hire', sellerOne || local ? 0.85 : 0.75, 'serp', '');
    const product = has(W_PRODUCT) || PRINCIPALS.some(p => p.re.test(kw));
    if (serp === 'info') return res(has(W_PROBLEM) ? 'problem' : (product ? 'solution' : 'info'), 0.75, 'serp', '');
    if (serp === 'solution') return res(sellerOne ? 'hire' : 'solution', 0.7, 'serp', '');
    // 3. weaker words
    if (sellerMany) return res('compare', 0.7, 'words', 'several sellers named');
    if (sellerOne) return res('hire', 0.75, 'words', 'a seller named');
    if (has(W_PROBLEM)) return res('problem', 0.7, 'words', 'a problem word');
    if ((has(W_SOLUTION) || product) && local) return res('hire', 0.65, 'words', 'a service in a place');
    if (has(W_SOLUTION) || product) return res('solution', 0.65, 'words', product && !has(W_SOLUTION) ? 'a product name' : 'a solution word');
    // 4. the provider's intent label (R5 13.1 #7: under 0.65 it is unsure)
    const unsure = lp != null && lp < c.labs_unsure;
    if (li === 'transactional') return res('hire', unsure ? 0.5 : 0.6, 'labs', 'provider intent');
    if (li === 'commercial') return res(local ? 'hire' : 'solution', unsure ? 0.5 : 0.6, 'labs', 'provider intent');
    if (li === 'informational' || li === 'navigational') return res('info', unsure ? 0.5 : 0.6, 'labs', 'provider intent');
    if (local) return res('hire', 0.55, 'words', 'a place named');
    return res('info', 0.4, 'default', 'no evidence');
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // gate and fit (the shared fit gate, mapped to the KI reasons)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const GATE_REASON = { 'other market': 'other_market', 'job search': 'career', 'other brand': 'other_brand', 'government': 'government', 'portal': 'portal',
    'navigational': 'navigational', 'own brand': 'own_brand', 'off topic': 'off_topic', 'too broad': 'too_broad', 'empty': 'empty' };
  const GATE_TEXT = { other_market: 'outside your market', career: 'someone looking for a job or a course', other_brand: 'another company\'s brand', government: 'a government service',
    portal: 'someone looking for a login or a portal', navigational: 'someone looking for one particular website', own_brand: 'your own brand (tracked, not a new opportunity)',
    off_topic: 'not something you sell', too_broad: 'too broad to point to what you sell', empty: 'no keyword', low_fit: 'too far from what you sell', avoid: 'you or our check said not to write it' };
  /** the gate ctx from a site: { own_domain, market, services (list), topics, competitors, serp_domains, brands, intent, protect, serp, career, avoid } */
  const gctx = (ctx) => { const o = ctx || {}; const svc = services(o.services); const topics = uniq(svc.concat(services(o.topics || [])));
    return { own_domain: o.own_domain || o.domain || '', market: S(o.market || '').toUpperCase().slice(0, 2), services: svc, topics, competitors: o.competitors || [],
      serp_domains: o.serp_domains || [], brands: o.brands || {}, intent: o.intent || '', protect: o.protect || [], serp: o.serp || [], career: o.career || null }; };
  /** KI.gate(keyword, ctx) -> { gate: 'pass' | 'fail', reason, text, detail }. The KI write path's gate (gate_lint pair: write KI.gate, read KI.readable). */
  const gate = (keyword, ctx) => {
    const o = ctx || {}; const k = key(keyword);
    const avoid = o.avoid instanceof Set ? o.avoid : new Set((Array.isArray(o.avoid) ? o.avoid : []).map(key));
    if (!k) return { gate: 'fail', reason: 'empty', text: GATE_TEXT.empty, detail: 'no keyword' };
    if (avoid.has(k)) return { gate: 'fail', reason: 'avoid', text: GATE_TEXT.avoid, detail: 'a stored AVOID verdict for this keyword (it needs an explicit override)' };
    if (typeof fitGate !== 'function') return { gate: 'fail', reason: 'empty', text: 'the fit gate is not available', detail: 'fit gate kit not inlined (fails closed)' };
    const g = fitGate(S(keyword), gctx(o));
    if (g && g.ok) return { gate: 'pass', reason: '', text: '', detail: '' };
    const reason = GATE_REASON[(g || {}).reason] || 'off_topic';
    return { gate: 'fail', reason, text: GATE_TEXT[reason], detail: ascii((g || {}).detail || '') };
  };
  const BUYER_W = new Set(['provider', 'providers', 'company', 'companies', 'service', 'services', 'partner', 'partners', 'agency', 'agencies', 'firm', 'firms', 'vendor', 'vendors',
    'best', 'top', 'leading', 'cost', 'costs', 'price', 'prices', 'pricing', 'hire', 'expert', 'experts', 'specialist', 'specialists', 'consultant', 'consultants', 'solution',
    'solutions', 'list', 'cheap', 'affordable', 'quote', 'near', 'me', 'online', 'free', 'reviews', 'review', 'what', 'how', 'why', 'which']);
  const BUYER_S = new Set([...BUYER_W].map(stem1));
  const containFit = (keyword, g, pages) => {
    const kt = uniq(ownToks(keyword).filter(t => !BUYER_S.has(t))); if (!kt.length || !g.topics.length) return null;
    const K = topicKit({ services: g.services, topics: g.topics }); const set = new Set(kt); const has = (p) => p.length && p.every(t => set.has(t));
    const ph = K.phr.filter(p => p.length >= 2 && has(p)).sort((a, b) => b.length - a.length)[0];
    if (ph) return { fit: 1, detail: '"' + ph.join(' ') + '" is one of your services' };
    const pr = K.prods.find(has) || (kt.find(t => K.cats.has(t)) ? [kt.find(t => K.cats.has(t))] : null);
    if (pr) return { fit: 0.85, detail: '"' + pr.join(' ') + '" is a product or category you sell' };
    const docs = K.phr.concat((Array.isArray(pages) ? pages : []).map(x => uniq(ownToks(S(x && (x.title || x.h1 || '')) + ' ' + pathTokens(S(x && x.url)).join(' ').replace(/-/g, ' ')))).filter(d => d.length));
    if (!docs.length) return null;
    const df = (t) => docs.filter(d => d.includes(t)).length; const Nd = docs.length;
    const w = (t) => { const f = df(t); return Math.log(1 + Nd / (1 + f)); };
    const tot = kt.reduce((x, t) => x + (df(t) ? w(t) : Math.log(1 + Nd)), 0); const got = kt.filter(t => df(t) > 0).reduce((x, t) => x + w(t), 0);
    return { fit: tot > 0 ? r3(got / tot) : 0, detail: kt.filter(t => df(t) > 0).length + ' of its ' + kt.length + ' own words are in your services or pages' }; };
  /** KI.fit(keyword, ctx, top10?) -> { fit, low, high, basis, detail }: the keyword's (and its results' titles') share of what the site sells,
   *  x the place match (a place in the market 1, no place fit_no_place). The gate stays the hard stop; this is the continuous part above it. */
  const fit = (keyword, ctx, topItems) => {
    const o = ctx || {}; const c = C(o.cfg); const g = gctx(o);
    let base = null, basis = 'inferred', detail = '';
    if (typeof fitEvidence === 'function' && g.topics.length) { const e = fitEvidence(S(keyword), g.topics, { services: g.services, market: g.market });
      if (e.verdict === 'in') base = num(e.share) == null ? 1 : clip(num(e.share), 0, 1); else if (e.verdict === 'out') base = num(e.share) == null ? 0 : clip(num(e.share), 0, 1); detail = ascii(e.detail || ''); }
    // FX-L H8 (REVIEW_LOGIC H8): the service phrase INSIDE a longer search counts ("peppol access point provider uae" for an e-invoicing /
    // Peppol service; the qualifier words must not dilute it): a service phrase of 2+ words contained = 1, a product or category the site
    // sells = 0.85, else an IDF-weighted share of the search's own words (buyer words left out) found in the site's services and page
    // titles (a word every service carries weighs little, a word no service or page carries weighs most). The highest reading counts.
    const cn = containFit(keyword, g, o.pages);
    if (cn && cn.fit != null && (base == null || cn.fit > base)) { base = cn.fit; basis = 'inferred'; detail = cn.detail; }
    let unknown = false;
    if (base == null) { base = c.fit_unknown; unknown = true; detail = detail || 'too little on file about what you sell to judge it'; }
    const titles = (Array.isArray(topItems) ? topItems : []).map(x => S(x && (x.title || x.t))).filter(Boolean).slice(0, 10);
    if (titles.length >= 3 && typeof fitEvidence === 'function' && g.topics.length) {
      const inn = titles.filter(t => fitEvidence(t, g.topics, { services: g.services, market: g.market }).verdict === 'in').length / titles.length;
      base = (1 - c.fit_title_weight) * base + c.fit_title_weight * inn;
    }
    let geo = 1;
    if (g.market && typeof fitMarket === 'function') { const m = fitMarket(S(keyword), g.market); geo = !m.ok ? 0 : (m.inside.length ? 1 : c.fit_no_place); }
    const f = clip(base * geo, 0, 1); const sp = unknown ? c.fit_spread * 1.5 : c.fit_spread;
    return { fit: r3(f), low: r3(clip(f - sp, 0, 1)), high: r3(clip(f + sp, 0, 1)), basis, unknown, geo, detail };
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // candidates (DESIGN 3.1-3.2)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const SOURCES = ['gsc', 'paa', 'related', 'forum', 'autocomplete', 'labs_ideas', 'labs_suggestions', 'labs_related', 'competitor', 'gap', 'tracked', 'ladder', 'seed'];
  // independent evidence families for the demand floor: three Labs endpoints are one provider; our own lists are no evidence of demand
  // FX-L H7: People also ask, related searches and forum threads come from the SAME results page: one family, not three
  const FAMILY = { gsc: 'gsc', paa: 'serp_page', related: 'serp_page', forum: 'serp_page', autocomplete: 'autocomplete', labs_ideas: 'labs', labs_suggestions: 'labs', labs_related: 'labs', competitor: 'competitor', gap: 'competitor' };
  const families = (row) => uniq(((row && (Array.isArray(row.sources) ? row.sources : jparse(row.sources_json, []))) || []).map(s => FAMILY[S(isObj(s) ? s.source : s)]).filter(Boolean));
  /** KI.mergeCandidates(sourceLists) -> rows { keyword, kw_key, sources: [{ source, fetched_at, detail }], source_count, families, volume, volume_basis,
   *  volume_source, cpc, kd, gsc_impressions, gsc_clicks, gsc_position, gsc_page, labs_intent, aio }. sourceLists: { source: [rows | strings] } or
   *  [{ source, rows, fetched_at }]. Close variants merge on KI.key; the shown keyword is the first one met in SOURCES order. Sorted by kw_key. */
  const mergeCandidates = (lists) => {
    const groups = Array.isArray(lists) ? lists.map(g => ({ source: S(g && g.source), rows: (g && g.rows) || [], fetched_at: S(g && g.fetched_at) }))
      : Object.entries(lists || {}).map(([s, rows]) => ({ source: s, rows: rows || [], fetched_at: '' }));
    groups.sort((a, b) => (SOURCES.indexOf(a.source) < 0 ? 99 : SOURCES.indexOf(a.source)) - (SOURCES.indexOf(b.source) < 0 ? 99 : SOURCES.indexOf(b.source)) || a.source.localeCompare(b.source));
    const by = new Map();
    for (const g of groups) {
      if (!SOURCES.includes(g.source)) continue;
      for (const r0 of g.rows) {
        const r = isObj(r0) ? r0 : { keyword: r0 }; const kw = norm(r.keyword || r.query || r.question || r.suggestion || r.text); if (!kw) continue;
        const k = key(kw); const row = by.get(k) || { keyword: kw, kw_key: k, sources: [], volume: null, volume_basis: '', volume_source: '', cpc: null, kd: null,
          gsc_impressions: null, gsc_clicks: null, gsc_position: null, gsc_page: '', labs_intent: '', aio: null, trend: null };
        const fa = S(r.fetched_at || g.fetched_at);
        if (!row.sources.some(s => s.source === g.source)) row.sources.push({ source: g.source, fetched_at: fa, detail: ascii(S(r.detail || r.from || '')).slice(0, 120) });
        if (g.source === 'gsc') { const im = num(r.impressions), cl = num(r.clicks), po = num(r.position);
          if (im != null && (row.gsc_impressions == null || im > row.gsc_impressions)) { row.gsc_impressions = im; row.gsc_clicks = cl; row.gsc_position = po; row.gsc_page = S(r.page || r.url); } }
        const vol = num(r.volume != null ? r.volume : r.search_volume);
        if (vol != null && row.volume == null) { row.volume = vol; row.volume_basis = 'provider_estimate'; row.volume_source = S(r.volume_source || (/^labs/.test(g.source) || g.source === 'competitor' || g.source === 'gap' ? 'DataForSEO keyword data' : 'Google Ads')); }
        if (row.cpc == null && num(r.cpc) != null) row.cpc = num(r.cpc);
        if (row.kd == null && num(r.kd != null ? r.kd : r.keyword_difficulty) != null) row.kd = num(r.kd != null ? r.kd : r.keyword_difficulty);
        if (!row.labs_intent && S(r.intent || r.main_intent)) row.labs_intent = S(r.intent || r.main_intent).toLowerCase();
        if (row.aio == null && typeof r.aio === 'boolean') row.aio = r.aio;
        if (row.trend == null && r.trend) row.trend = r.trend;
        by.set(k, row);
      }
    }
    return [...by.values()].map(r => ({ ...r, source_count: r.sources.length, families: families(r) })).sort((a, b) => a.kw_key.localeCompare(b.kw_key));
  };
  /** KI.prescore(row, cfg) -> 0..100, the cheap order before money (DESIGN 3.2: fit is IN it, R1 #4): gated rows 0; Fit x a word-based stage
   *  weight x (0.5 demand proxy + 0.3 independent sources + 0.2 Search Console). Ties are broken by the caller on kw_key. */
  const prescore = (row, c0) => {
    const c = C(c0); const r = row || {};
    if (S(r.gate) === 'fail') return 0;
    const f = num(r.fit) == null ? c.fit_unknown : clip(num(r.fit), 0, 1);
    const st = r.stage && c.stage_weights[r.stage] != null ? r.stage : stage([], r.keyword, r.labs_intent, {}).stage;
    const sw = c.stage_weights[st];
    const im = num(r.gsc_impressions), vol = num(r.volume);
    const dem = clip(Math.log10(1 + (im != null ? im * c.demand.month_days / c.demand.gsc_days : vol != null ? vol : 0)) / Math.log10(1 + 1000), 0, 1);
    const fam = (Array.isArray(r.families) ? r.families : families(r)).length;
    const p = 100 * f * sw * (0.5 * dem + 0.3 * clip(fam / 3, 0, 1) + 0.2 * (im != null && im > 0 ? 1 : 0));
    return r1(p);
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // clustering (R4 6.3)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const keysOf = (row, c) => { const t = Array.isArray(row.top10) ? row.top10 : jparse(row.top10_json, []);
    return uniq((Array.isArray(t) ? t : []).slice(0, c.cluster.top_n).map(x => (isObj(x) && x.exact === false && !x.url_partial) ? urlKey({ url: x.url, domain: x.host, url_exact: false }) : urlKey(isObj(x) ? (x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)) : x)).filter(Boolean)); };
  /** KI.cluster(rows, cfg) -> rows (same order as given) with cluster_id, is_head, cluster_size, cluster_demand, hub_id, shared_with_head,
   *  borderline. Demand for ordering: row.click_demand, else KI.demand([row]).clicks. Head-based, no chaining; rows with fewer than
   *  min_urls known results are their own head (not compared). Deterministic: same rows in any order -> same ids. */
  const cluster = (rows, c0) => {
    const c = C(c0); const T = c.cluster.t_page, H = c.cluster.t_hub;
    const list = (Array.isArray(rows) ? rows : []).map((r, i) => { const kk = S(r.kw_key) || key(r.keyword);
      const d = num(r.click_demand) != null ? num(r.click_demand) : demand([r], c).clicks; return { i, r, kk, d: d || 0, keys: new Set(keysOf(r, c)) }; });
    const order = list.slice().sort((a, b) => b.d - a.d || a.kk.localeCompare(b.kk));
    const heads = []; const res = new Map();
    for (const e of order) {
      if (e.keys.size < c.cluster.min_urls) {
        // FX-L M5: identical results pages are never split, even when fewer than min_urls of their addresses are keyable
        const twin = e.keys.size ? heads.find(h => h.e.keys.size === e.keys.size && [...e.keys].every(k => h.e.keys.has(k))) : null;
        if (twin) { res.set(e.i, { cluster_id: twin.id, is_head: false, hub_id: '', shared_with_head: e.keys.size, borderline: false, compared: true }); continue; }
        const id = 'c_' + hash(e.kk); heads.push({ e, id, compared: false }); res.set(e.i, { cluster_id: id, is_head: true, hub_id: '', shared_with_head: null, borderline: false, compared: false }); continue; }
      let joined = null, hub = null, border = false;
      for (const h of heads) { if (!h.compared) continue; let n = 0; for (const k of e.keys) if (h.e.keys.has(k)) n++;
        if (n === T || n === T - 1) border = true;
        if (n >= T) { joined = { h, n }; break; } if (n >= H && !hub) hub = h; }
      if (joined) res.set(e.i, { cluster_id: joined.h.id, is_head: false, hub_id: '', shared_with_head: joined.n, borderline: joined.n === T, compared: true });
      else { const id = 'c_' + hash(e.kk); heads.push({ e, id, compared: true }); res.set(e.i, { cluster_id: id, is_head: true, hub_id: hub ? hub.id : '', shared_with_head: null, borderline: border, compared: true }); }
    }
    const size = {}, dem = {}; for (const e of list) { const id = res.get(e.i).cluster_id; size[id] = (size[id] || 0) + 1; dem[id] = (dem[id] || 0) + e.d; }
    return list.map(e => { const x = res.get(e.i); return { ...e.r, kw_key: e.kk, ...x, cluster_size: size[x.cluster_id], cluster_demand: r1(dem[x.cluster_id]) }; });
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // factors (R4 6.4)
  // ---------------------------------------------------------------------------------------------------------------------------------
  const ctrAt = (p, c) => { const n = Math.round(num(p) || 0); if (n >= 1 && n <= 10) return c.ctr[n - 1]; if (n <= 20 && n > 10) return c.ctr_p11_20; if (n <= 30 && n > 20) return c.ctr_p21_30; return 0; };
  /** KI.demand(cluster, cfg) -> { demand, low, high, clicks, basis, floor, note }: cluster = rows (or { members }). Click demand per month at
   *  p_star after the AI answer's loss; Search Console impressions (28 days, scaled to a month) beat provider volume; no volume anywhere but
   *  >= 2 independent sources -> the floor, "evidenced, volume not measured". */
  const demand = (cl, c0) => {
    const c = C(c0); const D = c.demand; const rows = Array.isArray(cl) ? cl : ((cl && (cl.members || cl.rows)) || (cl ? [cl] : []));
    let clicks = 0, lo = 0, hi = 0, any = false, measured = false, est = false, censored = false; let fams = new Set();
    const ctr = ctrAt(D.p_star, c);
    const keepOf = (st0) => { const st = c.aio_loss[st0] != null ? st0 : 'info'; return c.aio_loss[st]; };
    for (const r of rows) {
      if (!r) continue; families(r).forEach(f => fams.add(f)); (Array.isArray(r.families) ? r.families : []).forEach(f => fams.add(f));
      const loss = keepOf(r.stage);
      const aio = r.aio === true ? 1 : r.aio === false ? 0 : null;
      const im = num(r.gsc_impressions); const vol = num(r.volume); const gp = num(r.gsc_position);
      // FX-L H7 (REVIEW_LOGIC H7): Search Console impressions are the demand only where the site is seen (page 1-2, position <= 20); further
      // down they are censored by the site's own position (a result at #50 is rarely shown), so the larger of them and the provider's volume
      // counts; a measured 0 is a measured 0 (no floor)
      const imM = im != null && im > 0 ? im * D.month_days / D.gsc_days : null;
      let v = null, vlo = null, vhi = null;
      if (imM != null && (gp == null || gp <= (D.gsc_max_position || 20))) { v = imM; vlo = v; vhi = v; measured = true; }
      else if (imM != null && vol != null && vol > 0) { if (vol >= imM) { v = vol; vlo = Math.max(imM, vol * (1 - D.volume_spread)); vhi = vol * (1 + D.volume_spread); est = true; } else { v = imM; vlo = imM; vhi = imM * (1 + D.volume_spread); measured = true; censored = true; } }
      else if (imM != null) { v = imM; vlo = imM; vhi = imM * (D.censored_high || 3); measured = true; censored = true; }
      else if (vol != null && vol > 0) { v = vol; vlo = vol * (1 - D.volume_spread); vhi = vol * (1 + D.volume_spread); est = true; }
      else if (vol === 0) { v = 0; vlo = 0; vhi = 0; est = true; }
      if (v == null) continue; any = true;
      const keep = aio == null ? 1 - loss * 0.5 : 1 - loss * aio;
      const keepLo = aio == null ? 1 - loss : keep, keepHi = aio == null ? 1 : keep;
      clicks += v * ctr * keep; lo += vlo * ctr * (1 - D.ctr_spread) * keepLo; hi += vhi * ctr * (1 + D.ctr_spread) * keepHi;
    }
    const sc = (x) => clip(Math.log10(1 + x) / Math.log10(1 + D.d_ref), 0, 1);
    if (!any) {
      // FX-L H7: the floor is the demand of a SMALL measured volume (floor_volume, default 5 a month), so an unmeasured search can never
      // outrank a measured 10; its range runs from 0 to the demand of floor_volume_high (20)
      const ok = fams.size >= D.min_sources_for_floor;
      const fv = (x) => sc(x * ctr * (1 - c.aio_loss.info * 0.5));
      const fl = Math.min(D.floor, fv(D.floor_volume || 5)), fh = Math.min(D.floor_high, fv(D.floor_volume_high || 20));
      return ok ? { demand: r3(fl), low: 0, high: r3(fh), clicks: 0, basis: 'modelled', floor: true, note: 'evidenced, volume not measured (' + fams.size + ' independent sources)' }
        : { demand: 0, low: 0, high: r3(fl), clicks: 0, basis: 'modelled', floor: false, note: 'no volume and fewer than ' + D.min_sources_for_floor + ' independent sources' };
    }
    return { demand: r3(sc(clicks)), low: r3(sc(lo)), high: r3(sc(hi)), clicks: r1(clicks), basis: 'modelled', floor: false,
      note: measured ? (censored ? 'from your Search Console impressions (a lower bound: your page is beyond page two)' : est ? 'from your Search Console impressions and provider volume' : 'from your Search Console impressions') : 'from provider volume (an estimate)' };
  };
  const existingRank = (p, c) => { const n = num(p); if (n == null || n <= 0) return 0; for (const b of c.existing_rank) if (n <= b.max) return b.v; return 0; };
  /** KI.win(row, site, cfg) -> { win, low, high, strength, existing_rank, topical, weak_spots, position, position_basis, parts (text) }
   *  row: { keyword, gsc_position, gsc_impressions, position (a SERP reading), top10, strength?, topical? }
   *  site: { domain, refdomains, rank, queries: [{ query, impressions, position }] } */
  const win = (row, site, c0) => {
    const c = C(c0); const r = row || {}; const s = site || {}; const own = validHost(s.domain || s.own_domain);
    const items = Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, []);
    // ExistingRank: Search Console first, then the reading of the results page (host only, so a recovered url still counts)
    let pos = null, pbasis = '';
    if (num(r.gsc_position) != null && num(r.gsc_position) > 0) { pos = num(r.gsc_position); pbasis = 'measured'; }
    else if (num(r.position) != null && num(r.position) > 0) { pos = num(r.position); pbasis = 'measured'; }
    else if (own) { const hit = (items || []).find(x => { const h = hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)); return h && (h === own || reg(h) === reg(own)); });
      if (hit) { pos = num(hit.pos) || num(hit.rank_group) || num(hit.position); pbasis = 'measured'; } }
    const er = existingRank(pos, c);
    // Strength: the site's referring domains (or rank) against the median of the top 10, log ratio
    let st = null, stLo = null, stHi = null, stBasis = 'modelled';
    if (num(r.strength) != null) { st = clip(num(r.strength), 0, 1); stLo = clip(st - 0.1, 0, 1); stHi = clip(st + 0.1, 0, 1); stBasis = S(r.strength_basis) || 'modelled'; }
    else {
      const med = (vals) => { const v = vals.filter(x => x != null).sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
      const pair = num(s.refdomains) != null ? [num(s.refdomains), num(r.top10_refdomains_median) != null ? num(r.top10_refdomains_median) : med((items || []).map(x => num(x.refdomains)))]
        : num(s.rank) != null ? [num(s.rank), num(r.top10_rank_median) != null ? num(r.top10_rank_median) : med((items || []).map(x => num(x.rank)))] : [null, null];
      if (pair[0] != null && pair[1] != null) { st = clip(0.5 + 0.5 * Math.log10((1 + pair[0]) / (1 + pair[1])) / Math.log10(c.strength_span), 0, 1); stLo = clip(st - 0.1, 0, 1); stHi = clip(st + 0.1, 0, 1); stBasis = 'modelled'; }
    }
    const stUnknown = st == null;
    // FX-L H2 / M1: an unknown Strength is the middle with its whole plausible span (never a constant presented as a judgement); a page the
    // site already has in the top 10 / top 20 is itself evidence that it is not weaker than most of these results
    if (stUnknown) { st = c.strength_unknown; stLo = clip(st - c.strength_unknown_spread, 0, 1); stHi = clip(st + c.strength_unknown_spread, 0, 1);
      if (pos != null && pos <= 10) stLo = Math.max(stLo, 0.5); else if (pos != null && pos <= 20) stLo = Math.max(stLo, 0.4); st = Math.max(st, stLo); }
    // Topical: the site's own ranking queries on this topic (Search Console)
    let tp = null;
    if (num(r.topical) != null) tp = clip(num(r.topical), 0, 1);
    else { const kt = ownToks(r.keyword); const need = Math.max(1, Math.ceil(kt.length / 2));
      const qs = (Array.isArray(s.queries) ? s.queries : []).filter(q => q && num(q.impressions) > 0 && num(q.position) != null && num(q.position) <= c.topical_max_position)
        .filter(q => { const qt = new Set(ownToks(q.query || q.keyword)); return kt.length && kt.filter(t => qt.has(t)).length >= need; });
      tp = kt.length ? clip(uniq(qs.map(q => key(q.query || q.keyword))).length / c.topical_ref, 0, 1) : 0; }
    // WeakSpots: the share of the top 10 that is thin, stale, off-intent, forum / UGC (hire / compare only) or low authority
    const W = c.weak; const nowMs = c.now ? Date.parse(c.now) : NaN; const stg = S(r.stage);
    const onIntent = { hire: ['provider', 'directory', 'list'], compare: ['list', 'directory', 'provider'], solution: ['vendor', 'provider', 'guide', 'list'], problem: ['guide', 'news', 'government', 'provider'], info: ['guide', 'news', 'video', 'government'] }[stg] || null;
    const it2 = (items || []).filter(x => x && (x.host || x.domain || x.url));
    const weakOne = (x) => { const ty = S(x.type);
      if ((stg === 'hire' || stg === 'compare') && ty === 'forum') return true;
      if (num(x.words) != null && num(x.words) < W.thin_words) return true;
      const d = Date.parse(S(x.date || x.updated || x.timestamp)); if (Number.isFinite(nowMs) && Number.isFinite(d) && nowMs - d > W.stale_days * 864e5) return true;
      if (onIntent && ty && !onIntent.includes(ty) && ty !== 'other') return true;
      if (num(x.rank) != null && num(x.rank) < W.low_rank) return true; if (num(x.refdomains) != null && num(x.refdomains) < W.low_refdomains) return true;
      return false; };
    const ws = it2.length ? it2.filter(weakOne).length / it2.length : 0;
    const ww = c.win_weights;
    const core = (sv) => ww.strength * sv + ww.existing_rank * er + ww.topical * tp + ww.weak_spots * ws;
    const w = clip(core(st), 0, 1);
    // FX-L M1: the range is what is not measured (Strength's span), not a constant: a measured Strength keeps its own +/- 0.1
    const lo = clip(Math.min(core(stLo), w), 0, 1), hi = clip(Math.max(core(stHi), w), 0, 1);
    const parts = [];
    parts.push(pos != null ? 'you are at position ' + Math.round(pos) + (pbasis === 'measured' && num(r.gsc_position) != null ? ' (your Search Console)' : '') : 'you do not rank for it yet');
    parts.push(stUnknown ? 'your strength against these results is not measured yet' : 'strength ' + Math.round(st * 100) + '% against the top results (referring domains)');
    if (tp > 0) parts.push('your site already ranks for related searches');
    if (ws > 0) parts.push(Math.round(ws * it2.length) + ' of the top ' + it2.length + ' results are weak spots');
    return { win: r3(w), low: r3(lo), high: r3(hi), strength: r3(st), strength_known: !stUnknown, existing_rank: er, topical: r3(tp), weak_spots: r3(ws), position: pos, position_basis: pbasis, parts };
  };
  /** KI.value(row, site, cfg) -> { value, low, high, basis }: the owner's value for the matching service, else CPC on a log scale, else 0.5 */
  const value = (row, site, c0) => {
    const c = C(c0); const r = row || {}; const sv = (site && site.service_values) || {};
    const kt = new Set(ownToks(r.keyword));
    for (const [svc, v] of Object.entries(sv).sort((a, b) => a[0].localeCompare(b[0]))) { const st = ownToks(svc); if (num(v) != null && st.length && st.every(t => kt.has(t))) { const x = clip(num(v), 0, 1); return { value: x, low: x, high: x, basis: 'measured', source: 'owner' }; } }
    const cpc = num(r.cpc);
    // FX-L L2: a CPC of 0 is "no advertiser data", not a value of 0 (it scored below an unknown CPC)
    if (cpc != null && cpc > 0) { const x = clip(Math.log10(1 + cpc) / Math.log10(1 + c.value.cpc_ref), 0, 1); return { value: r3(x), low: r3(x), high: r3(x), basis: 'provider_estimate', source: 'cpc' }; }
    const m = c.value.missing; return { value: m, low: clip(m - c.value.missing_spread, 0, 1), high: clip(m + c.value.missing_spread, 0, 1), basis: 'modelled', source: 'none' };
  };
  /** KI.gap(row, chosen, cfg) -> { gap, competitors: [{ domain, position }] }: the share of the chosen competitors in the top 10 (+0.5 when one is cited in AI answers for it) */
  const gapFactor = (row, chosen, c0) => {
    const c = C(c0); const r = row || {}; const ch = uniq((Array.isArray(chosen) ? chosen : []).map(d => reg(validHost(isObj(d) ? d.comp_domain || d.domain : d) || '')).filter(Boolean));
    if (!ch.length) return { gap: 0, competitors: [] };
    const items = Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, []);
    const seen = new Map(); for (const x of (items || [])) { const h = hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)); if (!h) continue; const R = reg(h);
      const ps = num(x.pos) || num(x.rank_group) || num(x.position); if (ps != null && ps > c.gaps.top) continue;   // FX-L M4: the top 10 only
      if (ch.includes(R) && !seen.has(R)) seen.set(R, ps); }
    const ai = (Array.isArray(r.ai_cited) ? r.ai_cited : []).map(d => reg(validHost(d) || '')).some(d => ch.includes(d));
    return { gap: r3(clip(seen.size / ch.length + (ai ? c.gap_ai_bonus : 0), 0, 1)), competitors: [...seen.entries()].map(([domain, position]) => ({ domain, position })) };
  };
  const fnum = (x, d) => { if (isObj(x)) return num(x.demand != null ? x.demand : x.win != null ? x.win : x.value != null ? x.value : x.gap != null ? x.gap : x.fit); return num(x) == null ? d : num(x); };
  const rng = (row, k, v) => { const rr = (row && row._ranges && row._ranges[k]) || (row && isObj(row[k]) ? [row[k].low, row[k].high] : null) || [num(row && row[k + '_low']), num(row && row[k + '_high'])];
    const lo = num(rr[0]), hi = num(rr[1]); return [lo == null ? v : Math.min(lo, v), hi == null ? v : Math.max(hi, v)]; };
  /** KI.score(row, cfg) -> { score, low, high, mid, factors: { gate, fit, stageW, demand, win, value, gap }, low_confidence, reason }
   *  row: { gate, fit, stage, demand, win, value, gap } (numbers, or the objects KI.demand / KI.win / KI.value / KI.fit return) with optional
   *  ranges (_ranges: { demand: [lo, hi], ... } or demand_low / demand_high). Gated -> 0, 0, 0 with the reason. */
  const score = (row, c0) => {
    const c = C(c0); const r = row || {};
    const f = clip(fnum(r.fit, c.fit_unknown), 0, 1); const lowFit = f < c.fit_gate; const g = S(r.gate) === 'fail' || lowFit ? 0 : 1;
    const sw = c.stage_weights[S(r.stage)] != null ? c.stage_weights[S(r.stage)] : c.stage_weights.info;
    const d = clip(fnum(r.demand, 0), 0, 1), w = clip(fnum(r.win, 0), 0, 1), v = clip(fnum(r.value, c.value.missing), 0, 1), gp = clip(fnum(r.gap, 0), 0, 1);
    const W = c.score_weights;
    const at = (ff, dd, wi, vv) => 100 * g * ff * sw * (W.demand * dd + W.win * wi + W.value * vv + W.gap * gp);
    const s = at(f, d, w, v);
    const [fl, fh] = rng(r, 'fit', f), [dl, dh] = rng(r, 'demand', d), [wl0, wh0] = rng(r, 'win', w), [vl, vh] = rng(r, 'value', v);
    // FX-L M1: a Win object carries its own range (Strength's span); only a bare number is printed +/- win_spread
    const winRanged = isObj(r.win) && num(r.win.low) != null && num(r.win.high) != null;
    const wl = winRanged ? wl0 : Math.min(wl0, clip(w - c.win_spread, 0, 1)), wh = winRanged ? wh0 : Math.max(wh0, clip(w + c.win_spread, 0, 1));
    const lo = at(clip(fl, 0, 1), clip(dl, 0, 1), wl, clip(vl, 0, 1)), hi = at(clip(fh, 0, 1), clip(dh, 0, 1), wh, clip(vh, 0, 1));
    const out = { score: r1(s), low: r1(Math.min(lo, s)), high: r1(Math.max(hi, s)), factors: { gate: g, fit: r3(f), stageW: sw, demand: r3(d), win: r3(w), value: r3(v), gap: r3(gp) },
      reason: g ? '' : (S(r.gate) === 'fail' ? S(r.gate_reason) : 'low_fit') };
    out.mid = r1((out.low + out.high) / 2); out.low_confidence = (out.high - out.low) > c.low_confidence_range;
    return out;
  };
  /** KI.verdict(row) -> go | months | hard | gated: from the Win factor only (no model types a verdict, R1 #7) */
  const verdict = (row, c0) => { const c = C(c0); const r = row || {}; if (S(r.gate) === 'fail') return 'gated';
    if (fnum(r.fit, null) != null && fnum(r.fit, null) < c.fit_gate) return 'gated';
    // FX-L H2 / L8: no Win is "not judged yet", never Hard; a Win read with an unknown Strength is judged only when both ends of its
    // range give the same word
    const w = fnum(r.win, null); if (w == null || !Number.isFinite(w)) return 'unknown';
    const word = (x) => x >= c.verdict.go ? 'go' : x >= c.verdict.months ? 'months' : 'hard';
    if (isObj(r.win) && r.win.strength_known === false && num(r.win.low) != null && num(r.win.high) != null && word(num(r.win.low)) !== word(num(r.win.high))) return 'unknown';
    return word(w); };
  const VERDICT_WORDS = { go: 'Go', months: 'Takes a few months', hard: 'Hard for your website now', gated: 'Not for you', unknown: 'Not judged yet' };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // competitors (R4 6.1 #2, #6)
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** KI.sizeTag(client, comp, cfg) -> peer | leader | smaller | out_of_reach | unknown, from { keywords, refdomains } of both sides */
  const sizeTag = (client, comp, c0) => {
    const c = C(c0); const a = client || {}, b = comp || {};
    const rk = num(a.keywords) != null && num(b.keywords) != null ? (num(b.keywords) + 1) / (num(a.keywords) + 1) : null;
    const rr = num(a.refdomains) != null && num(b.refdomains) != null ? (num(b.refdomains) + 1) / (num(a.refdomains) + 1) : null;
    if (rk == null && rr == null) return 'unknown';
    if (rk != null && rr != null && rk > c.size.out_kw && rr > c.size.out_rd) return 'out_of_reach';
    const m = Math.max(rk == null ? 0 : rk, rr == null ? 0 : rr), n = Math.min(rk == null ? Infinity : rk, rr == null ? Infinity : rr);
    if (m > c.size.leader) return 'leader';
    if (n < c.size.smaller && m < 1) return 'smaller';
    return 'peer';
  };
  /** KI.scoreCompetitors(domains, seeds, cfg) -> rows (sorted: scored first by score, then serp_share, then domain)
   *  domains: [{ domain, class, class_basis, class_confidence, topic_sim, geo_match, ai_share, declared, status, keywords, refdomains }] or
   *           strings; empty = every host on the seeds, classified with cfg.ctx (KI.classifyDomain).
   *  seeds: [{ keyword, top10: [items], demand?: click demand weight, stage?: 'hire' ... }]
   *  SERPshare(d) = sum_k w_k x CTR(pos_dk) / sum_k w_k x CTR(1), w_k = demand x stage weight. Only direct / adjacent are scored. */
  const scoreCompetitors = (domains, seeds, c0) => {
    const c = C(c0); const ctx = (c0 && c0.ctx) || c.ctx || {}; const W = c.comp_weights;
    const sd = (Array.isArray(seeds) ? seeds : []).filter(s => s && S(s.keyword)).map(s => ({ keyword: norm(s.keyword), w: Math.max(0, num(s.demand) == null ? 1 : num(s.demand)) * (c.stage_weights[S(s.stage)] != null ? c.stage_weights[S(s.stage)] : 1), items: Array.isArray(s.top10) ? s.top10 : jparse(s.top10_json, []) }));
    // FX-L M3: the share is over the seeds whose results page was READ (an unread seed is not "absent"), and says how many were not read
    const readSd = sd.filter(s => (s.items || []).length > 0); const unread = sd.length - readSd.length;
    const denom = readSd.reduce((x, s) => x + s.w * c.ctr[0], 0);
    const best = new Map();   // reg -> Map(seed index -> { pos, url })
    sd.forEach((s, si) => { for (const [i, x0] of (s.items || []).entries()) { const x = x0 && x0.u ? { ...x0, url: x0.u } : (x0 && x0.host && !x0.domain ? { ...x0, domain: x0.host } : x0); const h = hostOf(x); if (!h) continue;
      const R = reg(h); const pos = num(x.pos) || num(x.rank_group) || num(x.position) || (i + 1); if (pos > c.cluster.top_n) continue;
      const m = best.get(R) || new Map(); const prev = m.get(si); if (!prev || pos < prev.pos) m.set(si, { pos, url: S(x.url), exact: x.url_exact !== false, title: S(x.title), type: S(x.type) }); best.set(R, m); } });
    let list = (Array.isArray(domains) ? domains : []).map(d => isObj(d) ? d : { domain: d }).filter(d => S(d.domain || d.comp_domain));
    if (!list.length) list = [...best.keys()].sort().map(d => ({ domain: d }));
    const read = readSd.length; const minSeeds = read >= 3 ? c.comp_min_seeds : 1;
    const rows = []; const seenD = new Set();
    for (const d0 of list) {
      const vh = validHost(d0.domain || d0.comp_domain); if (!vh) continue; const R = reg(vh); if (seenD.has(R)) continue; seenD.add(R);
      const m = best.get(R) || new Map();
      const apps = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([si, v]) => ({ keyword: sd[si].keyword, position: v.pos, url: v.url, title: v.title, type: v.type }));
      let cls = d0.class, cb = d0.class_basis, cc = num(d0.class_confidence), reasons0 = [];
      let ts = num(d0.topic_sim), gm = num(d0.geo_match);
      if (!CLASS_IDS.includes(cls)) { const k = classifyDomain(R, { ...ctx, appearances: apps, cfg: c }); if (!k.store) continue; cls = k.class; cb = k.basis; cc = k.confidence; reasons0 = k.reasons;
        if (ts == null && num(k.topic_sim) != null) ts = num(k.topic_sim); if (gm == null && num(k.geo_match) != null) gm = num(k.geo_match); }
      const credit = [...m.entries()].reduce((x, [si, v]) => x + sd[si].w * ctrAt(v.pos, c), 0);
      const ss = denom > 0 ? clip(credit / denom, 0, 1) : 0;
      const scored = (cls === 'direct' || cls === 'adjacent') && !(ts != null && ts === 0);   // FX-L B2: nothing of its own matches your services -> not counted
      const aiS = num(d0.ai_share);
      const tsU = ts == null, gmU = gm == null;
      const T = tsU ? 0.5 : clip(ts, 0, 1), G = gmU ? 0.5 : clip(gm, 0, 1), A = aiS == null ? 0 : clip(aiS, 0, 1);
      const sc = (t, g, a) => 100 * (W.serp_share * ss + W.topic_sim * t + W.geo_match * g + W.ai_share * a);
      const sp = c.comp_spread;
      const s = scored ? sc(T, G, A) : null;
      const lo = scored ? sc(clip(T - (tsU ? 0.5 : sp), 0, 1), clip(G - (gmU ? 0.5 : 0), 0, 1), aiS == null ? 0 : A) : null;
      const hi = scored ? sc(clip(T + (tsU ? 0.5 : sp), 0, 1), clip(G + (gmU ? 0.5 : 0), 0, 1), aiS == null ? 0.25 : A) : null;
      const enough = m.size >= minSeeds || !!d0.declared;
      const reasons = [];
      const unreadTxt = unread ? ' (' + unread + ' not read)' : '';
      if (read) reasons.push(m.size ? 'in the top 10 for ' + m.size + ' of ' + read + ' of your service searches read' + unreadTxt + (S(c.market_name || ctx.market_name) ? ' in ' + ascii(c.market_name || ctx.market_name) : '') : 'not in the top 10 of the ' + read + ' service searches read' + unreadTxt);
      if (d0.declared) reasons.push('declared by you');
      if (scored && !enough) reasons.push('seen on too few of your searches to count yet');
      reasons.push(...reasons0.map(ascii));
      rows.push({ comp_domain: R, class: cls, class_basis: cb || 'rule', class_confidence: cc == null ? null : r2(cc), scored: scored && enough,
        score: scored && enough ? r1(s) : null, score_low: scored && enough ? r1(lo) : null, score_high: scored && enough ? r1(hi) : null,
        serp_share: r3(ss), topic_sim: tsU ? null : r3(T), geo_match: gmU ? null : r3(G), ai_share: aiS == null ? null : r3(A),
        size_tag: sizeTag(c.client || ctx.client || {}, { keywords: d0.keywords, refdomains: d0.refdomains }, c),
        seeds_seen: m.size, seeds_total: read, seeds_unread: unread, reasons, evidence: apps.slice(0, c.caps.evidence).map(a => ({ seed: a.keyword, position: a.position, url: a.url })),
        declared: !!d0.declared, status: S(d0.status) || (d0.declared ? 'chosen' : 'candidate'), status_by: S(d0.status_by) || (d0.declared ? 'declared' : 'auto') });
    }
    rows.sort((a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score) || b.serp_share - a.serp_share || a.comp_domain.localeCompare(b.comp_domain));
    return rows;
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // striking distance, page action, gaps, plan
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** KI.striking(row, site, cfg) -> bool: Search Console position 8-20 with >= 100 impressions in 28 days (>= 30 for a small site) */
  const striking = (row, site, c0) => { const c = C(c0); const r = row || {}; const p = num(r.gsc_position), im = num(r.gsc_impressions);
    if (p == null || im == null) return false; const small = num((site || {}).total_impressions) != null && num(site.total_impressions) < c.striking.small_site_total;
    return p >= c.striking.min && p <= c.striking.max && im >= (small ? c.striking.small_site_impressions : c.striking.impressions); };
  /** KI.pageAction(cluster, site, cfg) -> { action: new | refresh | list | none, page_url, reason, list_hosts, cannibal: [urls] }
   *  cluster: { keyword | head, members: [rows], top10 } (or a head row with top10); site: { domain, model (SM), pages: [{ url, title }], queries } */
  const pageAction = (cl, site, c0) => {
    const c = C(c0); const k = cl || {}; const s = site || {}; const own = validHost(s.domain || s.own_domain);
    const members = Array.isArray(k.members) && k.members.length ? k.members : [k];
    const head = S(k.keyword || k.head || (members[0] || {}).keyword);
    if (S(k.gate) === 'fail' || S(k.verdict) === 'gated') return { action: 'none', page_url: '', reason: 'not for you', list_hosts: [], cannibal: [] };
    const items = (Array.isArray(k.top10) ? k.top10 : jparse(k.top10_json, [])) || [];
    const typed = items.map(x => (x && PAGE_TYPES.includes(S(x.type))) ? x : { ...x, type: pageType(x && x.u ? { ...x, url: x.u } : x, { own_domain: own }) }).filter(x => x && x.type);
    const lists = typed.filter(x => x.type === 'list' || x.type === 'directory');
    // pages of the site that earn impressions for any member (Search Console): two different pages = cannibalisation
    const gp = uniq(members.map(m => S(m.gsc_page)).filter(Boolean).concat((Array.isArray(s.queries) ? s.queries : []).filter(q => q && S(q.page) && num(q.impressions) > 0 && members.some(m => key(m.keyword) === key(q.query))).map(q => S(q.page))));
    const gpKeys = uniq(gp.map(u => urlKey(u) || u));
    const cannibal = gpKeys.length >= 2 ? gp.slice(0, 5) : [];
    const ownItem = own ? typed.find(x => { const h = hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x)); return h && (h === own || reg(h) === reg(own)); }) : null;
    let match = '';
    if (typeof SM === 'object' && SM && s.model && typeof SM.matchPage === 'function') { try { const m = SM.matchPage(s.model, head); match = m ? S(m.url) : ''; } catch (e) { match = ''; } }
    if (!match && Array.isArray(s.pages)) { const kt = ownToks(head); const need = Math.max(2, Math.ceil(kt.length * 0.75));
      const best = s.pages.map(p => { const pt = new Set(ownToks(S(p.title) + ' ' + pathTokens(S(p.url)).join(' ').replace(/-/g, ' '))); return { url: S(p.url), n: kt.filter(t => pt.has(t)).length }; })
        .filter(p => p.url && p.n >= Math.min(need, kt.length) && kt.length).sort((a, b) => b.n - a.n || a.url.localeCompare(b.url))[0];
      match = best ? best.url : ''; }
    // FX-L L5: for a buyer stage (hire / compare / solution) the page is a service page when one exists; a blog post is flagged
    const cand = uniq(gp.concat(ownItem && ownItem.exact !== false ? [S(ownItem.url)] : [], match ? [match] : []).filter(Boolean));
    const isBlog = (u) => GUIDE_P.test('/' + pathTokens(u).join('/'));
    const buyer = ['hire', 'compare', 'solution'].includes(S(k.stage || (members[0] || {}).stage));
    const page = (buyer ? (cand.find(u => !isBlog(u)) || cand[0]) : cand[0]) || '';
    const blogNote = buyer && page && isBlog(page) ? ' (it is a blog post: people searching this want a service page)' : '';
    if (typed.length && lists.length / typed.length >= c.page_action.list_share)
      return { action: 'list', page_url: page, reason: lists.length + ' of the top ' + typed.length + ' results are lists or directories: get onto them' + (page ? ' (and keep your page)' : ''),
        list_hosts: uniq(lists.map(x => hostOf(x.u ? { ...x, url: x.u } : (x.host && !x.domain ? { ...x, domain: x.host } : x))).filter(Boolean)).slice(0, 10), cannibal };
    if ((gp.length || ownItem) && page) return { action: 'refresh', page_url: page, reason: 'your site already ranks for it' + blogNote, list_hosts: [], cannibal };
    if (match) return { action: 'refresh', page_url: page || match, reason: 'your site has a page for it' + blogNote, list_hosts: [], cannibal };
    if (gp.length || ownItem) return { action: 'new', page_url: '', reason: 'your site shows for it, but the page could not be identified: a page of its own answers it', list_hosts: [], cannibal };   // FX-L L6: no refresh without a target
    return { action: 'new', page_url: '', reason: 'no page of yours answers it', list_hosts: [], cannibal };
  };
  const credits = (kind, c) => { const usd = num((c.credits.usd || {})[kind]) || 0; if (!(usd > 0)) return 0;
    return Math.max(1, Math.ceil(Math.round(usd * c.credits.markup / c.credits.credit_value_usd * 100) / 100 - 1e-9)); };
  const GAP_ACTION = { missing: 'new_page', untapped: 'new_page', weak: 'refresh', striking: 'refresh', strong: 'defend', topic: 'new_page', page_type: 'new_page', ai_answer: 'pitch', listing: 'list', backlink: 'link' };
  /** KI.gaps(client, chosen, keywordRows, extra) -> gap rows as stored (seo_ki_gaps; JSON columns as strings)
   *  client: { site_id, domain, market, run_id, now }; chosen: [domains]; keywordRows: rows with top10 + client position (gsc_position or
   *  position, or the client in top10) + page_action / cluster_id; extra: { topics, page_types, ai_answers, listings, backlinks, sample: { n, m } } */
  const gaps = (client, chosen, keywordRows, extra, c0) => {
    const c = C(c0); const cl = client || {}; const own = validHost(cl.domain); const G = c.gaps; const x = extra || {};
    const ch = uniq((Array.isArray(chosen) ? chosen : []).map(d => reg(validHost(isObj(d) ? d.comp_domain || d.domain : d) || '')).filter(Boolean));
    const out = []; const seen = new Set(); let unread = 0;
    const sample = isObj(x.sample) && num(x.sample.n) != null && num(x.sample.m) != null && num(x.sample.n) < num(x.sample.m) ? 'sample of ' + num(x.sample.n) + ' of ' + num(x.sample.m) : '';
    const push = (type, kw, o) => { const id = 'g_' + type + '_' + hash([cl.domain, cl.market, type, key(kw), S(o.target)].join('|'));
      if (seen.has(id)) return; seen.add(id);
      const action = o.action || GAP_ACTION[type];
      out.push({ gap_id: id, site_id: S(cl.site_id), domain: S(cl.domain), market: S(cl.market), type, keyword: norm(kw), cluster_id: S(o.cluster_id),
        competitor_domains_json: JSON.stringify(uniq(o.comps || []).slice(0, 10)), client_position: o.pos == null ? null : o.pos, evidence_json: JSON.stringify(o.evidence || []).slice(0, 4000),
        sample_note: o.sample != null ? o.sample : '', action, action_target: S(o.target), credits: credits(action, c), status: 'open', run_id: S(cl.run_id), created_at: S(cl.now || c.now), updated_at: S(cl.now || c.now) }); };
    for (const r of (Array.isArray(keywordRows) ? keywordRows : [])) {
      if (!r || S(r.gate) === 'fail') continue;
      const items = (Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, [])) || [];
      const inTop = new Map(); let ownPos = null;
      for (const [i, it0] of items.entries()) { const it = it0 && it0.u ? { ...it0, url: it0.u } : (it0 && it0.host && !it0.domain ? { ...it0, domain: it0.host } : it0); const h = hostOf(it); if (!h) continue;
        const p = num(it.pos) || num(it.rank_group) || num(it.position) || (i + 1); if (p > G.top) continue; const R = reg(h);
        if (own && (R === reg(own))) { if (ownPos == null || p < ownPos) ownPos = p; continue; }
        if (ch.includes(R) && !inTop.has(R)) inTop.set(R, p); }
      const pos = num(r.gsc_position) != null ? num(r.gsc_position) : num(r.position) != null ? num(r.position) : ownPos;
      const comps = [...inTop.keys()]; const ev = [...inTop.entries()].map(([d, p]) => ({ domain: d, position: p }));
      // FX-L H6: "missing" / "untapped" need the client MEASURED absent: a known position over 100, or the provider's intersection (it
      // excludes the client's pages), or a results page read with the client not on it while the site's Search Console reading is complete
      // and has no row for it. An unknown position is "not read", never "not in the top 100".
      const srcs = (Array.isArray(r.sources) ? r.sources : jparse(r.sources_json, [])) || [];
      const fromGap = srcs.some(x => S(isObj(x) ? x.source : x) === 'gap');
      const known = pos != null || fromGap || (!!r.serp_read && cl.gsc_complete === true && num(r.gsc_impressions) == null);
      if (!known) { if (comps.length) unread++; continue; }
      const absent = pos == null || pos > G.absent_over;
      const sNote = fromGap ? sample : '';   // FX-L L7: "sample of N of M" is about the provider's intersection only
      const listAct = S(r.page_action) === 'list' ? 'list' : '';
      if (striking(r, cl, c)) push('striking', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, target: S(r.gsc_page || r.page_url), action: 'refresh', sample: '' });
      else if (comps.length >= G.missing_min && absent) push('missing', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: listAct || 'new_page', target: '', sample: sNote });
      else if (comps.length === 1 && absent) push('untapped', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: listAct || 'new_page', sample: sNote });
      else if (comps.length >= 1 && pos != null && pos >= G.weak_min && pos <= G.weak_max) push('weak', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: S(r.page_url) ? 'refresh' : (listAct || 'new_page'), target: S(r.page_url), sample: '' });
      else if (pos != null && pos <= G.strong_max && comps.length >= 1) push('strong', r.keyword, { pos, comps, evidence: ev, cluster_id: r.cluster_id, action: 'defend', target: S(r.page_url || r.gsc_page), sample: '' });
    }
    for (const t of (x.topics || [])) if (t && num(t.competitor_pages) >= 2 && !t.client_page) push('topic', t.keyword || t.head, { comps: t.competitors || [], cluster_id: t.cluster_id, evidence: t.evidence || [] });
    for (const t of (x.page_types || [])) if (t && (t.competitors || []).length && !t.client_has) push('page_type', t.keyword || t.service, { comps: t.competitors, evidence: [{ page_type: S(t.type) }], target: S(t.type) });
    for (const t of (x.ai_answers || [])) if (t && (t.competitors || []).some(d => ch.includes(reg(validHost(d) || ''))) && !t.client_named) push('ai_answer', t.keyword || t.question, { comps: t.competitors, evidence: [{ question: ascii(t.question || '').slice(0, 200) }] });
    for (const t of (x.listings || [])) { const h = validHost(t && t.domain); if (h && (t.lists_competitors || []).length && !t.lists_client) push('listing', t.keyword || '', { comps: t.lists_competitors, evidence: [{ list: h }], target: h, action: 'list' }); }
    for (const t of (x.backlinks || [])) { const h = validHost(t && t.domain); if (h && (t.links_to || []).filter(d => ch.includes(reg(validHost(d) || ''))).length >= 2 && !t.links_client) push('backlink', '', { comps: t.links_to, evidence: [{ referring_domain: h }], target: h, action: 'link' }); }
    const sorted = out.sort((a, b) => a.type.localeCompare(b.type) || a.keyword.localeCompare(b.keyword) || a.gap_id.localeCompare(b.gap_id));
    return sorted;
  };
  /** KI.gapsUnread(...same args) -> how many keyword rows with a competitor in the top 10 were left out because the client's position was not read */
  const gapsUnread = (client, chosen, keywordRows, cfg0) => { const c = C(cfg0); const own = validHost((client || {}).domain);
    const ch = uniq((Array.isArray(chosen) ? chosen : []).map(d => reg(validHost(isObj(d) ? d.comp_domain || d.domain : d) || '')).filter(Boolean)); let n = 0;
    for (const r of (Array.isArray(keywordRows) ? keywordRows : [])) { if (!r || S(r.gate) === 'fail') continue; const items = (Array.isArray(r.top10) ? r.top10 : jparse(r.top10_json, [])) || [];
      let ownSeen = false, comp = false; for (const it0 of items) { const it = it0 && it0.host && !it0.domain ? { ...it0, domain: it0.host } : it0; const h = hostOf(it); if (!h) continue; const p = num(it.pos) || 99; if (p > c.gaps.top) continue;
        if (own && reg(h) === reg(own)) ownSeen = true; else if (ch.includes(reg(h))) comp = true; }
      const srcs = (Array.isArray(r.sources) ? r.sources : jparse(r.sources_json, [])) || []; const fromGap = srcs.some(x => S(isObj(x) ? x.source : x) === 'gap');
      const pos = num(r.gsc_position) != null ? num(r.gsc_position) : num(r.position);
      if (comp && !ownSeen && pos == null && !fromGap && !(r.serp_read && (client || {}).gsc_complete === true && num(r.gsc_impressions) == null)) n++; }
    return n; };
  const KIND_TITLE = { refresh: (k) => 'Improve your page for "' + k + '"', new_page: (k) => 'Write a page for "' + k + '"', list: (k) => 'Get onto the lists that rank for "' + k + '"',
    pitch: (k) => 'Get named in AI answers for "' + k + '"', link: (k) => 'Ask ' + k + ' for a link', defend: (k) => 'Keep your place for "' + k + '"' };
  const STAGE_WHY = { hire: 'people searching it are looking to hire', compare: 'people searching it are comparing providers', solution: 'people searching it are looking for a solution',
    problem: 'people searching it have a problem to solve', info: 'people searching it are learning about the topic' };
  /** KI.plan(clusters, gaps, cfg) -> <= 10 actions { action_id, kind, title, why, target, credits, cluster_id | gap_id, ev }, ranked by expected value
   *  clusters: head rows { keyword, cluster_id, score (number or KI.score object), verdict, stage, page_action, page_url, gsc_position,
   *  gsc_impressions, striking, cluster_size, demand_note }; gaps: KI.gaps rows. Plain ASCII words. */
  const plan = (clusters, gapRows, c0) => {
    const c = C(c0); const P = c.plan; const acts = []; const byCluster = new Set();
    for (const h of (Array.isArray(clusters) ? clusters : [])) {
      if (!h || S(h.gate) === 'fail' || S(h.verdict) === 'gated') continue;
      const sc = isObj(h.score) ? h.score : { score: num(h.score), mid: num(h.score_mid) != null ? num(h.score_mid) : num(h.score_low) != null && num(h.score_high) != null ? (num(h.score_low) + num(h.score_high)) / 2 : num(h.score) };
      const mid = num(sc.mid) != null ? num(sc.mid) : num(sc.score); if (!(mid > 0)) continue;
      const pa = S(h.page_action); const kind = pa === 'list' ? 'list' : pa === 'refresh' ? 'refresh' : pa === 'none' ? '' : 'new_page'; if (!kind) continue;
      const v = S(h.verdict) || 'hard'; const ev = mid * (P.kind_mult[kind] || 1) * (P.verdict_mult[v] != null ? P.verdict_mult[v] : 0.4) * (h.striking ? 1.2 : 1);
      const kw = norm(h.keyword);
      const why = [];
      if (h.striking && num(h.gsc_position) != null) why.push('your page is at position ' + Math.round(num(h.gsc_position)) + ' in your Search Console' + (num(h.gsc_impressions) != null ? ' with ' + Math.round(num(h.gsc_impressions)) + ' impressions in 28 days' : '') + ', a few places from page one');
      else if (num(h.gsc_position) != null) why.push('you are at position ' + Math.round(num(h.gsc_position)) + ' in your Search Console');
      if (STAGE_WHY[S(h.stage)]) why.push(STAGE_WHY[S(h.stage)]);
      if (kind === 'list') why.push('the results page is mostly lists and directories, so a listing reaches these buyers sooner than a new page');
      if (num(h.cluster_size) > 1) why.push('one page can answer ' + num(h.cluster_size) + ' searches that Google treats as the same');
      if (S(h.demand_note)) why.push(S(h.demand_note));
      why.push('verdict: ' + VERDICT_WORDS[v] + ', score ' + Math.round(mid) + (num(sc.low) != null && num(sc.high) != null ? ' (' + Math.round(num(sc.low)) + '-' + Math.round(num(sc.high)) + ')' : ''));
      const target = kind === 'refresh' ? S(h.page_url) : kind === 'list' ? (Array.isArray(h.list_hosts) ? h.list_hosts.slice(0, 5).join(', ') : '') : kw;
      acts.push({ action_id: 'a_' + hash('c|' + S(h.cluster_id || key(kw)) + '|' + kind), kind, title: ascii(KIND_TITLE[kind](kw)), why: ascii(why.join('; ').replace(/^./, m => m.toUpperCase()) + '.'),
        target: ascii(target), credits: credits(kind, c), cluster_id: S(h.cluster_id), ev: r1(ev) });
      if (h.cluster_id) byCluster.add(S(h.cluster_id));
    }
    for (const g of (Array.isArray(gapRows) ? gapRows : [])) {
      if (!g || S(g.status) === 'dismissed' || S(g.status) === 'done') continue;
      if (g.cluster_id && byCluster.has(S(g.cluster_id))) continue;
      const base = P.gap_ev[S(g.type)]; if (base == null) continue;
      const comps = jparse(g.competitor_domains_json, []) || []; const kind = S(g.action) === 'new_page' ? 'new_page' : S(g.action);
      if (!KIND_TITLE[kind]) continue;
      const ev = base * (P.kind_mult[kind] || 1) * (1 + Math.min(4, comps.length) * 0.1);
      const subj = kind === 'link' ? S(g.action_target) : (S(g.keyword) || S(g.action_target));
      const why = { listing: 'this list or directory ranks for your service searches and names ' + comps.length + ' of your competitors, not you',
        ai_answer: 'AI answers for this question name ' + comps.slice(0, 3).join(', ') + ' and not you', backlink: 'this site links to ' + comps.length + ' of your competitors and not to you',
        page_type: 'your competitors have a ' + S(g.action_target) + ' page for this service and you do not', topic: 'at least two of your competitors rank with a page on this topic and you have none' }[S(g.type)] || '';
      acts.push({ action_id: 'a_' + hash('g|' + S(g.gap_id)), kind, title: ascii(KIND_TITLE[kind](subj)), why: ascii((why.replace(/^./, m => m.toUpperCase()) + '.' + (S(g.sample_note) ? ' (' + S(g.sample_note) + ')' : ''))),
        target: ascii(S(g.action_target)), credits: credits(kind, c), gap_id: S(g.gap_id), ev: r1(ev) });
    }
    const seenT = new Set();
    return acts.sort((a, b) => b.ev - a.ev || a.title.localeCompare(b.title) || a.action_id.localeCompare(b.action_id))
      .filter(a => !(a.kind === 'refresh' && !S(a.target)))   // FX-L L6: an "Improve your page" with no page is not an action
      .filter(a => { const k = a.kind === 'refresh' ? 'refresh|' + (urlKey(S(a.target)) || S(a.target)) : a.kind + '|' + a.title; if (seenT.has(k)) return false; seenT.add(k); return true; }).slice(0, c.caps.plan);
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // the read path and the labels
  // ---------------------------------------------------------------------------------------------------------------------------------
  /** KI.readable(row, ctx) -> bool: the ONE read gate for every consumer (CONTRACTS section 2). Fails closed: false unless ctx.killed is
   *  exactly false and ctx.mode is 'on'; a keyword row that is gated (or fails the fit gate again with ctx.fit, a gate ctx) is never read;
   *  a competitor row is read only with a valid host that is not a search engine, the site itself or a dismissed row. */
  const readable = (row, ctx) => {
    const o = ctx || {}; const r = row || {};
    if (o.killed !== false) return false;
    if (S(o.mode).toLowerCase() !== 'on') return false;
    if (r.comp_domain != null) { if (S(r.status) === 'dismissed') return false; const k = classifyDomain(S(r.comp_domain), { own_domain: o.own_domain || r.domain, services: [], cfg: o.cfg });
      return !!k.valid && k.reject !== 'search_engine' && k.reject !== 'own_site' && CLASS_IDS.includes(S(r.class)); }
    if (S(r.gate) !== 'pass') return false;
    if (o.fit && S(r.keyword)) { const g = gate(r.keyword, o.fit); if (g.gate !== 'pass') return false; }
    return true;
  };
  const LABELS = { measured: 'measured', provider_estimate: 'estimate from <source>', modelled: 'our estimate', inferred: 'our reading of the results' };
  /** KI.label(basis, source?, fetched_at?) -> { basis, text, date }: one of measured / provider_estimate / modelled / inferred, with the words
   *  the app shows (app/shared/src/ki.ts KI_BASIS / kiBasisLabel); anything else -> { basis: 'none', text: 'not available' } */
  const label = (basis, source, fetchedAt) => { const b = S(basis); const d = S(fetchedAt).slice(0, 10);
    if (!LABELS[b]) return { basis: 'none', text: 'not available', date: '' };
    const t = b === 'provider_estimate' ? 'estimate from ' + (ascii(source) || 'our data provider') : LABELS[b];
    return { basis: b, text: t + (d && (b === 'measured' || b === 'provider_estimate') ? ' on ' + d : ''), date: d }; };

  return { VERSION, CONFIG, cfg, norm, key, services, validHost, reg, hostOf, urlKey, classifyDomain, CLASS_IDS, PAGE_TYPES, pageType, top10, stage,
    gate, fit, GATE_TEXT, mergeCandidates, families, prescore, cluster, demand, win, value, gap: gapFactor, score, verdict, VERDICT_WORDS, sizeTag,
    scoreCompetitors, striking, pageAction, gaps, gapsUnread, plan, readable, label, ascii, hash, topicSim };
})();
