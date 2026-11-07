// AIR integrations: the planner (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.I / §6.6, CONTRACTS.md §4-§6, package P5). For each website
// the gate let through, what AIR reads from outside this week and what it reuses. It reads stored data only and calls nothing.
//   ONLY a website in mode `on` (AIRF.mayPay) gets a plan: a site in shadow or off reads nothing from outside, paid, keyed or free, so the
//   shadow golden (harness AP3) stays byte-identical. Each read has its own switch on top of `on`:
//     * LLM Mentions (DataForSEO top_mentioned_pages + target_metrics): `ai_rank_mentions`; once a calendar month per site (the marker
//       AIRF.mentionsKey(site, 'yyyy-mm') in seo_cache; a later run of the same month reuses what it stored, $0);
//     * fan-out results pages (DataForSEO SERP, Google and Bing, depth 10): `ai_rank_fanout_n` > 0 is the most paid reads a site makes in an
//       ISO week (both engines together). A Google reading of the last 7 days in the shared SERP cache, or a reading stored this week, costs
//       nothing. Bing is read only for a site that asks Copilot, and only for a search Bing Webmaster gives no position for (decided after the
//       Bing stats in *AI Rank SERP Requests*);
//     * Brave Search (the Claude retrieval proxy): `ai_rank_brave` AND the key SEO_BRAVE_API_KEY at build time (BRAVE_ON below); no key or
//       the flag off = no request, the node never runs. At most AIRC.brave_week_max searches a site a week;
//     * Bing Webmaster stats (free, the existing key; BING_ON below): only for a site in this account's Bing list, once a week (at most
//       AIRC.bing_calls_week_max calls), reused from this week's marker on a second run;
//     * Common Crawl CDX (free, public): is the site in the latest crawl, and how many captures; every AIRC.cc_every_days days.
//   The searches read are the fan-out queries of the site's treated core questions (ARD.fanoutOf over the stored evidence and 28 days of
//   answers), plus each question's own keyword, most frequent first. The market of the reads is the site's own (seo_sites location / language);
//   a site with none falls back to the dominant market of its questions, and a site with neither gets no SERP read (never a guessed country).
// out: one item per paying site { site_id, domain, run_id, mode, loc, engines, week_key, month_key, queries, google, bing_serp, mentions, bing,
//      cc, brave, week, why } or [{ skip: true, reason }]. The call nodes (AI_Rank_Calls.js) and AI Rank Fetched read it by name.
// ---- AIRF: the AI-ranking algorithm's settings, kill switch, ids and shared vocabulary (inlined by build_monitors.py through its marker) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §4.1, frozen in CONTRACTS.md §2-§3). Written by W0 and FROZEN: the packages read it,
// none changes it (a change is a contract change: CONTRACTS.md first, then this file, then every caller). Pure: no node access, no clock, no
// network; n8n sandbox rules (no URL constructor, no Object.defineProperty / setPrototypeOf, no structuredClone).
// Every setting is OFF when empty: a site without the columns, or with them empty, runs exactly as before AIR.
const AIRF = (() => {
  const VERSION = 'air-flags-1';
  // air-2 (FX-B, 2026-11-06, for FX-A's counting changes: a t test across questions, control handling, one trial per action): rows of another rule are
  // never compared or learned from (ai_rank_wiring.py loads priors and runs of this rule only, and hides actions pre-registered under another one)
  const RULE_VERSION = 'air-2';   // the rule AIR's rows are written under (seo_ai_rank_* .rule_version); bump it when a counting rule changes
  const MODES = ['off', 'shadow', 'on'];
  const S = (v) => (v == null ? '' : String(v)).trim();
  const flag = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const modeOf = (v) => { const m = S(v).toLowerCase(); return MODES.includes(m) ? m : 'off'; };
  const fanoutOf = (v) => { const n = Number(v); return S(v) === '' || !Number.isFinite(n) ? 0 : Math.min(50, Math.max(0, Math.round(n))); };
  // seo_monitors row -> s.settings.rank (package P4 puts it on every monitor site in _monitor_sites.js; P3 and P6 read it there)
  const settingsOf = (m) => { const r = m || {};
    return { mode: modeOf(r.ai_rank_mode), reserve: flag(r.ai_rank_reserve), fanout_n: fanoutOf(r.ai_rank_fanout_n), mentions: flag(r.ai_rank_mentions), brave: flag(r.ai_rank_brave) }; };
  // Site Admin `monitors` (package P4 calls it from Admin_Action.js / Monitor_Row_Admin.js): only the fields GIVEN are returned, normalised;
  // '' clears a field to null (= off); a bad value is an error message, never a silent default
  const COLS = ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave'];
  const validate = (given) => { const g = given || {}; const values = {}; const errors = [];
    for (const k of COLS) {
      if (!(k in g) || g[k] === undefined || g[k] === null) continue;
      const v = g[k];
      if (S(v) === '') { values[k] = null; continue; }
      if (k === 'ai_rank_mode') { const m = S(v).toLowerCase(); if (MODES.includes(m)) values[k] = m; else errors.push('ai_rank_mode must be off, shadow or on'); continue; }
      if (k === 'ai_rank_fanout_n') { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n <= 50 && Math.round(n) === n) values[k] = n; else errors.push('ai_rank_fanout_n must be a whole number from 0 to 50'); continue; }
      if (v === true || v === false) { values[k] = v; continue; }
      if (/^(true|1|yes|on)$/i.test(S(v))) values[k] = true; else if (/^(false|0|no|off)$/i.test(S(v))) values[k] = false; else errors.push(k + ' must be true or false');
    }
    return { values, errors }; };
  // the global kill switch: seo_cache row key `air:kill`, value '1' (or true / on / yes) -> AIR skips every site, without a deploy
  const CACHE_KIND = 'air';
  const KILL_KEY = 'air:kill';
  const protectKey = (site_id) => 'air:protect:' + S(site_id);
  const mentionsKey = (site_id, ym) => 'air:mentions:' + S(site_id) + ':' + S(ym);
  const killed = (cacheRows) => (Array.isArray(cacheRows) ? cacheRows : []).some(r => r && S(r.key) === KILL_KEY && /^(1|true|on|yes)$/i.test(S(r.value)));
  // what a site in a mode may do (CONTRACTS.md §5): shadow computes and writes only the five AIR tables, pays nothing; on writes the sinks
  const runs = (rank, kill) => !kill && !!rank && (rank.mode === 'shadow' || rank.mode === 'on');
  const writesSinks = (rank, kill) => !kill && !!rank && rank.mode === 'on';
  const mayPay = (rank, kill) => writesSinks(rank, kill);
  // shared vocabulary (CONTRACTS.md §3.1)
  const ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot', 'chatgpt_api'];
  const EXCLUDED_ENGINES = ['gemini_api'];   // owner decision 9: never diagnosed or learned from until DataForSEO answers in writing
  const GROUP_OF = { ai_overview: 'google', ai_mode: 'google', gemini: 'google', chatgpt: 'chatgpt', chatgpt_api: 'chatgpt', perplexity: 'perplexity', copilot: 'copilot', claude: 'claude' };
  const GROUPS = ['google', 'chatgpt', 'perplexity', 'copilot', 'claude'];
  const STAGES = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];
  const STAGE_LABELS = ['unmeasured', ...STAGES];
  const ACTION_STATUSES = ['shadow', 'proposed', 'queued', 'in_progress', 'done', 'verified', 'not_happened', 'expired', 'refused'];
  const ARMS = ['treated', 'control'];
  const usable = (engine) => ENGINES.includes(S(engine).toLowerCase());
  // ids (one rule for every writer and reader)
  const hash = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };   // FNV-1a, as AVX.hash
  const hex8 = (s) => ('0000000' + hash(s).toString(16)).slice(-8);
  // url_key: no scheme, no www., host lower-cased, no query, no fragment, no trailing slash, at most 300 characters ('' when it is not an http(s) URL)
  const urlKey = (url) => { const m = S(url).match(/^https?:\/\/([^\/?#]+)([^?#]*)/i); if (!m) return '';
    const host = m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '').replace(/\.$/, ''); const path = m[2].replace(/\/+$/, '');
    return (host + path).slice(0, 300); };
  const refKey = (ref) => { const r = ref || {}; return r.prompt_id ? 'p:' + S(r.prompt_id) : r.url ? 'u:' + urlKey(r.url) : r.listing_id ? 'l:' + S(r.listing_id) : 's:site'; };
  const actionId = (site_id, lever, ref) => 'air_' + S(site_id) + '_' + S(lever) + '_' + hex8(refKey(ref));
  const day = (now) => { const d = new Date(typeof now === 'number' ? now : Date.parse(S(now))); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10).replace(/-/g, '') : ''; };
  const runId = (site_id, now) => 'air_' + day(now) + '_' + S(site_id);
  const priorId = (lever, stage, group, scope) => [S(lever), S(stage), S(group), S(scope) || 'global'].join(':');
  const targetId = (site_id, prompt_id) => 'ait_' + S(site_id).replace(/^site_/, '') + '_' + S(prompt_id);   // the AI Growth format, unchanged
  return { VERSION, RULE_VERSION, MODES, COLS, settingsOf, validate, CACHE_KIND, KILL_KEY, protectKey, mentionsKey, killed, runs, writesSinks, mayPay,
    ENGINES, EXCLUDED_ENGINES, GROUP_OF, GROUPS, STAGES, STAGE_LABELS, ACTION_STATUSES, ARMS, usable, hash, urlKey, refKey, actionId, runId, priorId, targetId };
})();
// ---- ARD: the AI-ranking diagnosis kit (inlined by build_monitors.py through its marker, after AIRF) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.A-§2.C, interface frozen in CONTRACTS.md §3.2). OWNER: package P1 (fixes/P1.md).
// What it answers, per site and per question x engine:
//   A  the market (A1), the intent of each question (A2), the frozen core panel (A3/A4), treatment and control arms (A6), what change the
//      panel can detect (A7: MDE and the first-appearance requirement)
//   B  the stage where the client is stuck (S0 cannot be read .. S5 won), with the basis of the reading (direct / proxy_rank / unknown_index),
//      the counts and up to three evidence items; parametric share, no_search, list_dominated, nobody_named, the first / last dates named or cited
//   C  the source graph: every third-party page the answers cite, its type and author, whether it names the client, influence and placeability
// Pure: no $(...), no network, no clock (time comes in as `now`, ms or ISO). n8n sandbox: no URL constructor (hosts by regex), no
// Object.defineProperty / setPrototypeOf, no structuredClone. Needs AIRF (_ai_rank_flags.js) in scope. Engines in AIRF.EXCLUDED_ENGINES
// (gemini_api) are ignored everywhere. Shapes are the frozen ones; fields added beside them are marked "additive" and nobody must rely on
// their absence.
const ARD = (() => {
  const VERSION = 'air-2';   // FX-A2: follows AIRF.RULE_VERSION (FX-B)
  const DAY = 864e5;
  // ---- small helpers -----------------------------------------------------------------------------------------------------------------
  const S = (v) => (v == null ? '' : String(v)).trim();
  const lc = (v) => S(v).toLowerCase();
  const num = (v, d) => { if (v === '' || v == null) return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
  const J = (v, d) => { if (v && typeof v === 'object') return v; const s = S(v); if (!s) return d; try { const x = JSON.parse(s); return x == null ? d : x; } catch (e) { return d; } };
  const MSC = new Map();   // the same answer dates come back thousands of times: parse each once
  const msOf = (t) => { if (typeof t === 'number') return t; const k = S(t); let x = MSC.get(k); if (x === undefined) { x = Date.parse(k); if (!Number.isFinite(x)) x = NaN; if (MSC.size > 50000) MSC.clear(); MSC.set(k, x); } return x; };
  const ISC = new Map();
  const isoOf = (ms) => { if (!Number.isFinite(ms)) return ''; let x = ISC.get(ms); if (x === undefined) { x = new Date(ms).toISOString(); if (ISC.size > 50000) ISC.clear(); ISC.set(ms, x); } return x; };
  const dayOf = (ms) => isoOf(ms).slice(0, 10);
  const r1 = (x) => Math.round(10 * x) / 10; const r3 = (x) => Math.round(1000 * x) / 1000; const r4 = (x) => Math.round(1e4 * x) / 1e4;
  const flag = (v) => v === true || /^(true|1|yes)$/i.test(S(v));
  const usable = (e) => AIRF.usable(e);
  const engOf = (e) => lc(e);
  const median = (xs) => { const a = xs.filter(x => Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };   // as _serp_cache.js
  const HC = new Map();
  const hostOf = (u) => { const k = S(u); let h = HC.get(k); if (h === undefined) { h = hostOf0(k); if (HC.size > 50000) HC.clear(); HC.set(k, h); } return h; };
  const hostOf0 = (u) => { const m = S(u).match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@\/?#]*@)?([^\/?#:\s]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : ''; };
  const pathOf = (u) => { const m = S(u).match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : ''; };
  const isHttp = (u) => /^https?:\/\/[^\/?#\s]+/i.test(S(u));
  const hostIn = (h, list) => { const x = hostOf(h); if (!x) return false; for (const o of list) if (x === o || x.endsWith('.' + o)) return true; return false; };
  const compact = (s) => lc(s).replace(/[^a-z0-9]+/g, '');
  const hex8 = (s) => ('0000000' + AIRF.hash(s).toString(16)).slice(-8);
  const asMap = (m) => (m instanceof Map ? m : m && typeof m === 'object' ? new Map(Object.entries(m)) : new Map());
  // the client's hosts: the site (domain, canonical host), the hosts given, brand aliases; www and case removed
  const ourList = (site, ourHosts, extra) => { const out = new Set(); const add = (h) => { const x = hostOf(h); if (x && /\./.test(x)) out.add(x); };
    const s = site || {}; add(s.domain); add(s.canonical_host); for (const h of (Array.isArray(ourHosts) ? ourHosts : S(ourHosts).split(/[,\s]+/))) add(h); for (const h of (extra || [])) add(h); return [...out]; };

  // ---- places -> countries (A1) --------------------------------------------------------------------------------------------------------
  // [cc, DataForSEO location code, ISO alpha-3, country names, place words]
  const GEO = [
    ['AE', 2784, 'ARE', ['united arab emirates', 'uae', 'emirates'], ['uae', 'u.a.e', 'emirates', 'dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'fujairah', 'al ain', 'umm al quwain']],
    ['SA', 2682, 'SAU', ['saudi arabia', 'ksa', 'kingdom of saudi arabia'], ['saudi', 'saudi arabia', 'ksa', 'riyadh', 'jeddah', 'dammam', 'khobar', 'mecca', 'makkah', 'medina', 'madinah', 'tabuk']],
    ['PK', 2586, 'PAK', ['pakistan'], ['pakistan', 'lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar']],
    ['QA', 2634, 'QAT', ['qatar'], ['qatar', 'doha']], ['KW', 2414, 'KWT', ['kuwait'], ['kuwait']], ['BH', 2048, 'BHR', ['bahrain'], ['bahrain', 'manama']],
    ['OM', 2512, 'OMN', ['oman'], ['oman', 'muscat']], ['EG', 2818, 'EGY', ['egypt'], ['egypt', 'cairo', 'alexandria']], ['JO', 2400, 'JOR', ['jordan'], ['jordan', 'amman']],
    ['IN', 2356, 'IND', ['india'], ['india', 'mumbai', 'delhi', 'new delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'kolkata']],
    ['GB', 2826, 'GBR', ['united kingdom', 'uk', 'great britain'], ['uk', 'united kingdom', 'britain', 'england', 'scotland', 'london', 'manchester', 'birmingham']],
    ['US', 2840, 'USA', ['united states', 'usa', 'united states of america'], ['usa', 'united states', 'america', 'new york', 'california', 'texas', 'florida', 'chicago', 'san francisco', 'los angeles', 'seattle', 'boston']],
    ['CA', 2124, 'CAN', ['canada'], ['canada', 'toronto', 'vancouver', 'montreal']], ['AU', 2036, 'AUS', ['australia'], ['australia', 'sydney', 'melbourne']],
    ['DE', 2276, 'DEU', ['germany'], ['germany', 'berlin', 'munich']], ['FR', 2250, 'FRA', ['france'], ['france', 'paris']], ['NL', 2528, 'NLD', ['netherlands'], ['netherlands', 'amsterdam']],
    ['IE', 2372, 'IRL', ['ireland'], ['ireland', 'dublin']], ['SG', 2702, 'SGP', ['singapore'], ['singapore']], ['MY', 2458, 'MYS', ['malaysia'], ['malaysia', 'kuala lumpur']],
    ['TR', 2792, 'TUR', ['turkey', 'turkiye'], ['turkey', 'istanbul']], ['NG', 2566, 'NGA', ['nigeria'], ['nigeria', 'lagos']], ['KE', 2404, 'KEN', ['kenya'], ['kenya', 'nairobi']],
    ['ZA', 2710, 'ZAF', ['south africa'], ['south africa', 'johannesburg', 'cape town']] ];
  const GCC = ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'];
  const REGIONAL = /\b(gcc|gulf|middle east|mena)\b/;
  const LOC = new Map(GEO.map(g => [g[0], g[1]]));
  const PLACE_RE = GEO.map(g => [g[0], new RegExp('\\b(' + g[4].map(w => w.replace(/[.]/g, '\\.').replace(/ /g, '\\s+')).join('|') + ')\\b', 'i')]);
  const PLACE_TOKENS = new Set(GEO.flatMap(g => g[4].flatMap(w => w.split(' '))).concat(['gcc', 'gulf', 'mena', 'middle', 'east']));
  // a country code from a code, an alpha-3, a name, a DataForSEO location code or a place word ('' when none)
  const ccOf = (v) => { if (typeof v === 'number' || /^\d{4}$/.test(S(v))) { const n = Number(v); const g = GEO.find(x => x[1] === n); return g ? g[0] : ''; }
    const s = lc(v); if (!s) return ''; if (/^[a-z]{2}$/.test(s)) { const g = GEO.find(x => x[0] === s.toUpperCase()); return g ? g[0] : s === 'uk' ? 'GB' : s.toUpperCase(); }
    if (/^[a-z]{3}$/.test(s)) { const g = GEO.find(x => lc(x[2]) === s); if (g) return g[0]; }
    const byName = GEO.find(x => x[3].includes(s)); if (byName) return byName[0];
    const hit = PLACE_RE.find(([, re]) => re.test(s)); return hit ? hit[0] : ''; };
  // every country a keyword names (place words), a regional word (GCC / Gulf / Middle East) counting for the site's own country when it is in the region
  const placesIn = (kw, siteCc) => { const s = lc(kw); const out = PLACE_RE.filter(([, re]) => re.test(s)).map(([cc]) => cc);
    if (!out.length && REGIONAL.test(s) && GCC.includes(siteCc)) out.push(siteCc); return [...new Set(out)]; };

  // ---- A1: the market --------------------------------------------------------------------------------------------------------------
  const isClientChosen = (r) => /^(client|user|owner)/i.test(S(r.chosen_by));
  const kwOf = (x) => (typeof x === 'string' ? x : x ? S(x.keyword || x.query || x.head_keyword) : '');
  const market = ({ site, ladders, tracked, monitors, profile, gscCountries } = {}) => {
    const st = site || {}; const pr = profile || {};
    const siteCc = ccOf(st.country) || ccOf(st.location_code) || ccOf(st.country_code);
    const tally = new Map(); const inputs = [];
    const add = (cc, w, source, value) => { if (!cc || !(w > 0)) return; tally.set(cc, (tally.get(cc) || 0) + w); inputs.push({ cc, w, source, value: S(value) }); };
    // keywords the client chose: a ladder's own head keyword (chosen by the client, or a legacy row with no chooser), tracked keywords;
    // a rung the system spawned, and the panel questions the model wrote, are never a source
    const client = new Set(), ignored = new Set();
    for (const r of (Array.isArray(ladders) ? ladders : [])) { if (!r) continue; const head = normKw(r.head_keyword || r.keyword); const kw = normKw(r.keyword || r.head_keyword); if (!head) continue;
      if (/^(deleted|refused|removed)$/i.test(S(r.status))) continue;
      if (isClientChosen(r) || !S(r.chosen_by)) { client.add(head); if (kw !== head) ignored.add(kw); } else { ignored.add(head); ignored.add(kw); } }
    for (const k of client) ignored.delete(k);
    for (const t of (Array.isArray(tracked) ? tracked : S(tracked).split(','))) { const k = normKw(kwOf(t)); if (k && !ignored.has(k)) client.add(k); }
    for (const k of client) { const ccs = placesIn(k, siteCc); for (const cc of ccs) add(cc, 3 / ccs.length, 'keyword', k); }
    if (siteCc) add(siteCc, 3, 'site.country', S(st.country) || S(st.location_code));
    for (const a of S(pr.service_areas).split(/[,;|\n]+/).map(S).filter(Boolean)) add(ccOf(a), 1, 'profile.service_areas', a);
    const gsc = Array.isArray(gscCountries) ? gscCountries.map(g => [ccOf(g && (g.country || g.cc || g.key || (g.keys || [])[0])), num(g && g.clicks, 0)])
      : gscCountries && typeof gscCountries === 'object' ? Object.entries(gscCountries).map(([k, v]) => [ccOf(k), num(v && typeof v === 'object' ? v.clicks : v, 0)]) : [];
    const topG = gsc.filter(g => g[0] && g[1] > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (topG) add(topG[0], 2, 'search_console.top_country', topG[0]);
    const prCc = ccOf(pr.country_code) || ccOf(pr.country); if (prCc) add(prCc, 1, 'profile.country_code', prCc);
    const kwW = (cc) => inputs.filter(i => i.cc === cc && i.source === 'keyword').reduce((s, i) => s + i.w, 0);
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || (b[0] === siteCc) - (a[0] === siteCc) || kwW(b[0]) - kwW(a[0]) || a[0].localeCompare(b[0]));
    const lang = lc(st.language_code) || lc(pr.language) || 'en';
    if (!ranked.length) return { cc: '', lang, location_code: 0, second: null, conflicts: [], basis: 'no market signal: no client keyword with a place, no site country, no service area, no Search Console country, no profile country' };
    const [cc, w] = ranked[0]; const total = ranked.reduce((s, x) => s + x[1], 0);
    const second = ranked[1] && ranked[1][1] >= 0.75 * w ? { cc: ranked[1][0], share: r3(ranked[1][1] / total) } : null;
    const seen = new Set(); const conflicts = [];
    for (const i of inputs) { if (i.cc === cc) continue; const k = i.source + '|' + i.cc + '|' + i.value; if (seen.has(k)) continue; seen.add(k); conflicts.push({ source: i.source, value: i.cc + (i.value && i.value !== i.cc ? ' (' + i.value + ')' : '') }); }
    const loc = siteCc === cc && num(st.location_code, 0) > 0 ? num(st.location_code, 0) : (LOC.get(cc) || 0);
    const part = (c) => { const by = new Map(); for (const i of inputs.filter(x => x.cc === c)) by.set(i.source, (by.get(i.source) || 0) + i.w); return [...by.entries()].map(([s, v]) => s + ' ' + r1(v)).join(', '); };
    const basis = ranked.slice(0, 3).map(([c, v]) => c + ' ' + r1(v) + ' (' + part(c) + ')').join('; ') + (ignored.size ? '; ' + ignored.size + ' keyword(s) the system chose itself not counted' : '');
    return { cc, lang, location_code: loc, second, conflicts, basis };
  };

  // ---- A2: intent -------------------------------------------------------------------------------------------------------------------
  // an answer (row of seo_ai_answers, or a unit of AVX.history) names a business: the client, or an entity in the role competitor
  const namesBusiness = (a) => { if (!a) return false; if (a.named === true || flag(a.named)) return true;
    if (Array.isArray(a.rivals)) return a.rivals.length > 0;
    const ents = J(a.entities_json, null); if (Array.isArray(ents)) return ents.some(x => x && (x.role === 'competitor' || (x.role === 'self' && x.position != null)));
    return !!S(a.competitors); };
  const answered = (a) => !!a && a.answered !== false && !S(a.error) && usable(a.engine);
  const REC_Q = /\b(best|top|leading|recommend\w*|which\s+(\w+\s+){0,2}(compan|firm|agenc|provider|vendor|partner|consult|house|developer|studio|shop|platform|tool|software|app)\w*|who\s+(are|is|can|offers?|provides?|builds?|sells?|does)|near me|hire)\b/i;
  const PROVIDER_Q = /\b(providers?|vendors?|agenc(y|ies)|compan(y|ies)|firms?|partners?|consultants?|contractors?|developers?|integrators?|resellers?|suppliers?)\b/i;
  const INFO_Q = /^\s*(what|how|why|when|where|is|are|can|does|do|should|will|explain|define)\b/i;
  const intentOf = (prompt, answers28) => { const p = prompt || {};
    if (lc(p.kind) === 'brand' || lc(p.source) === 'brand' || lc(p.intent) === 'brand') return 'brand';
    const pid = S(p.prompt_id);
    const rows = (Array.isArray(answers28) ? answers28 : []).filter(a => answered(a) && (!pid || !S(a.prompt_id) || S(a.prompt_id) === pid));
    if (rows.length >= 4) return rows.filter(namesBusiness).length / rows.length >= 0.5 ? 'recommendation' : 'informational';
    const k = lc(p.kind); if (['recommend', 'recommendation', 'compare', 'choose', 'shortlist', 'alternatives'].includes(k)) return 'recommendation'; if (['learn', 'informational', 'info', 'cost', 'problem', 'howto', 'how_to', 'define'].includes(k)) return 'informational';
    const t = S(p.prompt || p.question); if (!t) return 'unknown';
    return REC_Q.test(t) ? 'recommendation' : INFO_Q.test(t) ? 'informational' : PROVIDER_Q.test(t) ? 'recommendation' : 'unknown'; };

  // ---- tokens for matching a page to a question ------------------------------------------------------------------------------------
  const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'which', 'who', 'are', 'is', 'can', 'does', 'do', 'your', 'you', 'that', 'this', 'from', 'into', 'best', 'top', 'in',
    'of', 'to', 'a', 'an', 'on', 'by', 'or', 'it', 'its', 'my', 'our', 'we', 'company', 'companies', 'provider', 'providers', 'firm', 'firms', 'agency', 'agencies', 'service', 'services',
    'near', 'me', 'much', 'cost', 'costs', 'html', 'php', 'www', 'https', 'http', 'blog', 'page', 'index', 'en', 'ar', 'leading', 'good', 'great']);
  const stem = (w) => (w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);
  const toks = (s, keepCost) => lc(s).replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').split(' ').filter(w => w.length >= 2 && !/^\d{4}$/.test(w) && !PLACE_TOKENS.has(w) && (!STOP.has(w) || (keepCost && /^costs?$/.test(w)))).map(stem);
  const cover = (kw, text) => { const K = [...new Set(toks(kw, true))]; if (!K.length) return 0; const P = new Set(toks(text, true)); return K.filter(k => P.has(k)).length / K.length; };

  // ---- A3/A4: the core panel ----------------------------------------------------------------------------------------------------------
  const marketCc = (m) => S(m).split(/[-_]/)[0].toUpperCase();
  const corePanel = ({ site, prompts, units60, stored, market, demand, now, cfg } = {}) => {
    const N = msOf(now); const C = cfg || {}; const coreMax = num(C.core_max, 30); const FREEZE = num(C.freeze_days, 56) * DAY;
    const mk = market || {}; const siteCc = S(mk.cc).toUpperCase(); const lang = lc(mk.lang) || 'en';
    const P = (Array.isArray(prompts) ? prompts : []).filter(p => p && S(p.prompt_id) && !/^deleted$/i.test(S(p.status)));
    const ST = new Map((Array.isArray(stored) ? stored : []).filter(r => r && S(r.prompt_id)).map(r => [S(r.prompt_id), r]));
    const inW = (t, d) => { const x = msOf(t); return !Number.isFinite(N) || !Number.isFinite(x) || (x > N - d * DAY && x <= N + 6 * 3600e3); };
    const U = (Array.isArray(units60) ? units60 : []).filter(u => answered(u) && inW(u.at, 56));
    const lastHit = new Map(), by28 = new Map();
    for (const u of U) { const pid = S(u.prompt_id); if (u.named || u.cited) { const t = msOf(u.at); if (!lastHit.has(pid) || t > lastHit.get(pid)) lastHit.set(pid, Number.isFinite(t) ? t : N); }
      if (inW(u.at, 28)) { const a = by28.get(pid) || []; a.push(u); by28.set(pid, a); } }
    const DM = asMap(demand && (demand.byPrompt || demand.by_prompt) ? (demand.byPrompt || demand.by_prompt) : demand);
    const volOf = (p) => { const d = DM.get(S(p.prompt_id)); const v = d && typeof d === 'object' ? num(d.volume != null ? d.volume : d.vol, null) : num(d, null); return v != null ? v : num(p.volume, 0); };
    const brand = (p) => intentOf(p, []) === 'brand';
    const isActive = (p) => !S(p.status) || /^active$/i.test(S(p.status));
    const marketOk = (p) => !siteCc || !S(p.market) || marketCc(p.market) === siteCc;
    const iso = isoOf; const core = [], extend = []; const inCore = new Set();
    const meta = (p) => { const u28 = by28.get(S(p.prompt_id)) || []; return { intent: intentOf(p, u28), baseline: u28.some(u => u.named || u.cited) ? 'some' : 'zero', cluster: lc(p.cluster || p.topic) || '', market: S(p.market) || (siteCc ? siteCc + '-' + lang : '') }; };
    const push = (p, since, until, reason) => { core.push({ prompt_id: S(p.prompt_id), core_since: since, core_until: until, reason, ...meta(p) }); inCore.add(S(p.prompt_id)); };
    // 1. frozen ones stay; 2. a question that named or cited the client in 56 days is never retired: its window is extended
    for (const p of P) { if (brand(p)) continue; const pid = S(p.prompt_id); const s = ST.get(pid); const was = s && flag(s.core);
      const until0 = s ? msOf(s.core_until) : NaN; const frozen = was && Number.isFinite(until0) && until0 > N; const hit = lastHit.get(pid);
      if (!frozen && hit == null) continue;
      const since = was && S(s.core_since) ? S(s.core_since) : iso(N);
      let until = Number.isFinite(until0) && was ? until0 : msOf(since) + FREEZE;
      let reason = was ? 'frozen until ' + dayOf(until) + ' (8 weeks from ' + since.slice(0, 10) + ')' : 'named or cited you on ' + dayOf(hit) + ': in the core, never retired while it does';
      if (hit != null && N + FREEZE > until) { until = N + FREEZE; reason = 'named or cited you on ' + dayOf(hit) + ': kept 56 more days, never retired while it does'; extend.push({ prompt_id: pid, core_until: iso(until), reason }); }
      if (!isActive(p)) reason += '; not asked now (' + lc(p.status) + ')';
      push(p, since, iso(until), reason); }
    // 3. fill up to core_max with active questions of the site's market: pinned first, then demand, then the oldest
    const fresh = P.filter(p => !brand(p) && !inCore.has(S(p.prompt_id)) && isActive(p) && marketOk(p))
      .sort((a, b) => (flag(b.pinned) - flag(a.pinned)) || (volOf(b) - volOf(a)) || S(a.created_at).localeCompare(S(b.created_at)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
    const join = (p, outside) => { const s = ST.get(S(p.prompt_id)); const was = s && flag(s.core);
      const since = was && S(s.core_since) ? S(s.core_since) : iso(N); const until = N + FREEZE;
      const where = outside ? 'outside your market (' + marketCc(p.market) + ', yours is ' + siteCc + '): measured because too few questions of your market are asked' : 'in your market (' + (siteCc || 'any') + ')';
      const reason = was ? 'renewed: still asked, ' + where : 'new: asked, ' + where + (volOf(p) > 0 ? ', demand ' + volOf(p) : '');
      if (was) extend.push({ prompt_id: S(p.prompt_id), core_until: iso(until), reason });
      push(p, since, iso(until), reason); };
    for (const p of fresh) { if (core.length >= coreMax) break; join(p, false); }
    // too few questions of the site's market are being asked (a panel that drifted to another country, R4 cause 3): the questions that ARE
    // asked join, up to core_min, labelled; progress can only be measured on questions somebody asks. Off with cfg.core_min = 0.
    const coreMin = Math.min(coreMax, num(C.core_min, 12));
    if (core.length < coreMin) for (const p of P.filter(q => !brand(q) && !inCore.has(S(q.prompt_id)) && isActive(q) && !marketOk(q))
      .sort((a, b) => (flag(b.pinned) - flag(a.pinned)) || (volOf(b) - volOf(a)) || S(a.created_at).localeCompare(S(b.created_at)) || S(a.prompt_id).localeCompare(S(b.prompt_id)))) { if (core.length >= coreMin) break; join(p, true); }
    // 4. questions to propose (never activated here): the caller's candidates from client keywords, Search Console question queries, LLM Mentions
    const cands = Array.isArray(demand && demand.candidates) ? demand.candidates : Array.isArray(C.candidates) ? C.candidates : [];
    const proposed = []; const room = Math.max(0, Math.min(num(C.propose_max, 5), coreMax - core.length)); const taken = new Set();
    // first: questions of the site's market that were retired and are no longer asked (bring them back; `revive` names the stored row, additive)
    const inMarketAsked = core.filter(c => marketOk(P.find(p => S(p.prompt_id) === c.prompt_id) || {}) && isActive(P.find(p => S(p.prompt_id) === c.prompt_id) || {})).length;
    if (siteCc && inMarketAsked < coreMin) for (const p of P.filter(q => !brand(q) && !isActive(q) && marketOk(q) && S(q.market) && !/^(refused|deleted)$/i.test(S(q.status)))
      .sort((a, b) => (volOf(b) - volOf(a)) || S(a.prompt_id).localeCompare(S(b.prompt_id)))) { if (proposed.length >= room) break; const kw = normKw(p.keyword || p.prompt); if (taken.has(kw)) continue; taken.add(kw);
      proposed.push({ prompt: S(p.prompt), keyword: normKw(p.keyword), market: siteCc + '-' + lang, intent: intentOf(p, []), source: 'retired_in_market', revive: S(p.prompt_id),
        reason: 'a question of your market (' + siteCc + ') that is no longer asked (' + lc(p.status) + '): ask it again so progress in your market can be measured' }); }
    const covered = (kw) => P.some(p => cover(kw, S(p.keyword) + ' ' + S(p.prompt)) >= 0.6 || (S(p.keyword) && cover(S(p.keyword), kw) >= 0.8));
    for (const c of cands.slice().sort((a, b) => num(b && b.volume, 0) - num(a && a.volume, 0))) { if (proposed.length >= room) break;
      const kw = normKw(c && (c.keyword || c.query)); if (!kw || taken.has(kw)) continue;
      const cm = S(c.market) ? marketCc(c.market) : ''; const kwCcs = placesIn(kw, siteCc);
      if (siteCc && ((cm && cm !== siteCc) || (kwCcs.length && !kwCcs.includes(siteCc)))) continue;
      if (covered(kw)) continue; taken.add(kw);
      const q = S(c.question) || (INFO_Q.test(kw) ? kw.charAt(0).toUpperCase() + kw.slice(1) + '?' : 'Which companies are best for ' + kw + '?');
      proposed.push({ prompt: q, keyword: kw, market: siteCc ? siteCc + '-' + lang : S(c.market), intent: intentOf({ prompt: q, kind: c.kind }, []), source: S(c.source) || 'keyword',
        reason: 'no question on the panel covers "' + kw + '"' + (num(c.volume, 0) > 0 ? ' (demand ' + num(c.volume, 0) + ')' : '') }); }
    // A4: progress is read only on the core present in both periods
    const prev = new Set([...ST.values()].filter(r => flag(r.core)).map(r => S(r.prompt_id))); const nowSet = new Set(core.map(c => c.prompt_id));
    const added = [...nowSet].filter(x => !prev.has(x)), dropped = [...prev].filter(x => !nowSet.has(x));
    const comparable = prev.size > 0 && !added.length && !dropped.length;
    const why = !prev.size ? 'first reading: no core stored yet, nothing to compare with' : comparable ? 'core unchanged (' + nowSet.size + ' questions): progress is comparable'
      : 'core changed (' + added.length + ' added, ' + dropped.length + ' left): progress is read only on the ' + [...nowSet].filter(x => prev.has(x)).length + ' questions present in both periods';
    return { core, proposed, extend, comparable, why };
  };

  // ---- A6: treatment and control arms (seeded, never reshuffled; FX-A RA-2: a control floor kept every week, rotation one at a time) ---------
  // Each stratum's share of the control target floor(N / 3): floor(n / 3), the remainder to the strata with the largest fraction (a stratum of 5
  // holds 1 or 2, so 30 questions in 6 strata of 5 hold 10, not 6). A control rotates after `holdout_days` only when a replacement in its stratum
  // takes its place in the same run (a treated question no step worked on: not in `exposed`), one per stratum per run (so a first core's controls,
  // all due the same week, rotate over several weeks), and never while it is a registered control of an open action (`locked`). A stratum under its
  // target is refilled from its treated questions no step worked on. `exposed` / `locked`: prompt ids (Set or array; additive inputs, FX-A).
  // `assigned_at` is when the question took its arm (stored as seo_ai_rank_questions.arm_since); a row without it falls back to core_since.
  const assignArms = ({ core, stored, seed, now, site_id, holdout_days, exposed, locked } = {}) => {
    const N = msOf(now); const HOLD = num(holdout_days, 84) * DAY; const iso = isoOf(N);
    const C = (Array.isArray(core) ? core : []).filter(c => c && S(c.prompt_id));
    const ST = new Map((Array.isArray(stored) ? stored : []).filter(r => r && S(r.prompt_id)).map(r => [S(r.prompt_id), r]));
    const EX = new Set([...(exposed || [])].map(S)), LK = new Set([...(locked || [])].map(S));
    const clusterCount = new Map(); for (const c of C) { const k = lc(c.cluster) || 'other'; clusterCount.set(k, (clusterCount.get(k) || 0) + 1); }
    const top = new Set([...clusterCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(x => x[0]));
    // a stratum needs at least 3 questions to hold a control (T, T, C): smaller ones are merged into a coarser stratum, dropping the cluster
    // first, then the baseline, then the intent (a real panel of 13 questions over 10 fine strata held no control at all)
    const MIN_S = 3; const levels = [(c) => [lc(c.intent) || 'unknown', lc(c.baseline) === 'some' ? 'some' : 'zero', top.has(lc(c.cluster) || 'other') ? (lc(c.cluster) || 'other') : 'other'],
      (c) => [lc(c.intent) || 'unknown', lc(c.baseline) === 'some' ? 'some' : 'zero', '*'], (c) => [lc(c.intent) || 'unknown', '*', '*'], () => ['*', '*', '*']];
    const fine = new Map(); { let pending = C.slice(); for (let L = 0; L < levels.length; L++) { const g = new Map(); for (const c of pending) { const k = levels[L](c).join('|'); const a = g.get(k) || []; a.push(c); g.set(k, a); }
      const next = []; for (const [k, a] of g) { if (a.length >= MIN_S || L === levels.length - 1) for (const c of a) fine.set(S(c.prompt_id), k); else next.push(...a); } pending = next; if (!pending.length) break; } }
    const stratumOf = (c) => fine.get(S(c.prompt_id)) || levels[0](c).join('|');
    const out = new Map(); const fresh = []; const known = new Set();
    for (const c of C) { const pid = S(c.prompt_id); const s = ST.get(pid); const arm = s && AIRF.ARMS.includes(lc(s.arm)) ? lc(s.arm) : '';
      if (!arm) { fresh.push(c); continue; }
      const stratum = S(s.stratum) || stratumOf(c); known.add(stratum);
      out.set(pid, { prompt_id: pid, arm, stratum, assigned_at: S(s.assigned_at || s.arm_since || s.core_since) || iso, _new: false }); }
    const key = (c) => AIRF.hash(S(site_id) + '|' + S(c.prompt_id) + '|' + S(seed));
    fresh.sort((a, b) => key(a) - key(b) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
    // a new question joins its stored stratum: the computed one when it already holds stored questions, else the finest level that does
    const placeOf = (c) => { const k = stratumOf(c); if (known.has(k)) return k; for (const L of levels) { const k2 = L(c).join('|'); if (known.has(k2)) return k2; } return k; };
    for (const c of fresh) out.set(S(c.prompt_id), { prompt_id: S(c.prompt_id), arm: 'treated', stratum: placeOf(c), assigned_at: iso, _new: true });
    // the control target per stratum
    const members = new Map(); for (const a of out.values()) { const l = members.get(a.stratum) || []; l.push(a); members.set(a.stratum, l); }
    const total = Math.floor(out.size / 3); const target = new Map(); let sum = 0;
    for (const [k, l] of members) { const b = l.length >= MIN_S ? Math.floor(l.length / 3) : 0; target.set(k, b); sum += b; }
    const order = [...members.entries()].filter(([, l]) => l.length >= MIN_S && l.length % 3).sort((a, b) => (b[1].length % 3) - (a[1].length % 3) || b[1].length - a[1].length || a[0].localeCompare(b[0]));
    for (const [k] of order) { if (sum >= total) break; target.set(k, target.get(k) + 1); sum++; }
    const ctl = (k) => (members.get(k) || []).filter(a => a.arm === 'control');
    // a replacement: a treated question of the stratum no step worked on; a new one first (never treated), then the one treated longest, then the seed order
    const ageMs = (a) => { const t = msOf(a.assigned_at); return Number.isFinite(t) && Number.isFinite(N) ? N - t : 0; };
    const pick = (k, not) => (members.get(k) || []).filter(a => a.arm === 'treated' && !EX.has(a.prompt_id) && !(not && not.has(a.prompt_id)))
      .sort((a, b) => (b._new - a._new) || (ageMs(b) - ageMs(a)) || (key(a) - key(b)) || a.prompt_id.localeCompare(b.prompt_id))[0] || null;
    const set = (a, arm) => { a.arm = arm; a.assigned_at = iso; };
    for (const k of [...members.keys()].sort()) {
      // 1. the new questions and the refill: up to the target
      const swapped = new Set(); while (ctl(k).length < target.get(k)) { const r = pick(k); if (!r) break; set(r, 'control'); swapped.add(r.prompt_id); }
      // 2. the holdout rotates: the oldest control past its 12 weeks (not locked) gives its place to a replacement, one per stratum per run
      const due = ctl(k).filter(a => !swapped.has(a.prompt_id) && !LK.has(a.prompt_id) && HOLD > 0 && ageMs(a) >= HOLD).sort((a, b) => (ageMs(b) - ageMs(a)) || a.prompt_id.localeCompare(b.prompt_id))[0];
      if (due) { const r = pick(k, swapped); if (r) { set(due, 'treated'); set(r, 'control'); } } }
    return C.map(c => { const a = out.get(S(c.prompt_id)); return { prompt_id: a.prompt_id, arm: a.arm, stratum: a.stratum, assigned_at: a.assigned_at }; });
  };

  // ---- A7: minimum detectable effect + the first-appearance requirement -------------------------------------------------------------
  // inverse standard normal (Acklam), accurate to ~1e-9 over (0, 1)
  const qnorm = (p) => { const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]; const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); };
  // P(all k first appearances fall on treated questions | none on control) = C(Q_t, k) / C(Q_t + Q_c, k)
  const allTreatedP = (qt, qc, k) => { let p = 1; for (let i = 0; i < k; i++) p *= (qt - i) / (qt + qc - i); return p; };
  const mde = ({ q_t, q_c, m, p, rho, alpha = 0.05, power = 0.8 } = {}) => {
    const Qt = Math.max(0, Math.floor(num(q_t, 0))), Qc = Math.max(0, Math.floor(num(q_c, 0))), M = Math.max(1, num(m, 28)), R = Math.min(1, Math.max(0, num(rho, 0.3)));
    const A = Math.min(0.5, Math.max(1e-6, num(alpha, 0.05))), PW = Math.min(0.999, Math.max(0.5, num(power, 0.8)));
    const z = qnorm(1 - A / 2) + qnorm(PW); const pIn = num(p, null); const pu = Math.max(pIn == null ? 0 : pIn, 0.02);
    const neff = (Q) => (Q > 0 ? Q * M / (1 + (M - 1) * R) : 0); const nt = neff(Qt), nc = neff(Qc); const v = pu * (1 - pu);
    const prepost = nt > 0 ? r1(100 * z * Math.sqrt(2 * v / nt)) : null;
    const did = nt > 0 && nc > 0 ? r1(100 * z * Math.sqrt(2 * v * (1 / nt + 1 / nc))) : null;
    // FX-A RA-12: the first-appearance test is judged one-sided at alpha / 2 (0.025), the same alpha as the DiD's two-sided 95% range
    const A1 = A / 2; let k = null, kp = null; if (Qt > 0 && Qc > 0) for (let j = 1; j <= Qt; j++) { const pj = allTreatedP(Qt, Qc, j); if (pj < A1) { k = j; kp = r4(pj); break; } }
    const basis = 'percentage points at ' + Math.round(PW * 100) + '% power, alpha ' + A + ' two-sided; n_eff = Q x m / (1 + (m - 1) x rho) with m ' + M + ', rho ' + R
      + (pIn == null ? ', baseline unknown: 2% used' : pIn < 0.02 ? ', baseline ' + r1(100 * pIn) + '%: 2% used for planning' : ', baseline ' + r1(100 * pu) + '%')
      + (k != null ? '; first appearances: ' + k + ' on treated questions and none on control give one-sided p ' + kp + ' (below ' + A1 + ')' : Qt > 0 && Qc > 0 ? '; no number of first appearances reaches one-sided p < ' + A1 + ' with ' + Qt + ' treated and ' + Qc + ' control questions' : '; no control questions: no first-appearance test');
    return { prepost, did, n_eff_t: r1(nt), n_eff_c: r1(nc), p_used: r4(pu), first_appearance_k: k, first_appearance_p: kp, basis };   // first_appearance_p: additive
  };

  // ---- 2.C: page classification ---------------------------------------------------------------------------------------------------------
  const H_ENC = /(^|\.)(wikipedia\.org|wikidata\.org|wikimedia\.org|britannica\.com)$/;
  const H_VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com|wistia\.com)$/;
  const H_COMM = /(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|news\.ycombinator\.com|discord\.com|spiceworks\.com|indiehackers\.com)$|^(community|communities|forum|forums|discuss|discussion|discourse|answers)\./;
  const P_COMM = /\/(forums?|community|communities|threads?|discussions?|topic|questions)\/|\/t\/[^\/]+\/\d+/;
  const H_REVIEW = /(^|\.)(g2\.com|capterra\.[a-z.]+|trustpilot\.com|trustradius\.com|softwareadvice\.com|getapp\.com|sourceforge\.net|softwaresuggest\.com|saasworthy\.com|peerspot\.com|featuredcustomers\.com|yelp\.[a-z.]+|crozdesk\.com|financesonline\.com|slashdot\.org)$/;
  const H_DIR = /(^|\.)(clutch\.co|goodfirms\.co|themanifest\.com|designrush\.com|sortlist\.[a-z.]+|upcity\.com|topdevelopers\.co|appfutura\.com|techbehemoths\.com|selectedfirms\.co|itfirms\.co|softwareworld\.co|topsoftwarecompanies\.co|crunchbase\.com|yellowpages\.[a-z.]+|yellowpages-uae\.com|yell\.com|hotfrog\.[a-z.]+|kompass\.com|europages\.[a-z.]+|cylex\.[a-z.]+|brownbook\.net|f6s\.com|producthunt\.com|bark\.com|dnb\.com|zoominfo\.com|appsource\.microsoft\.com|partner\.microsoft\.com|solutionpartners\.microsoft\.com|appexchange\.salesforce\.com|partners\.salesforce\.com|partners\.odoo\.com|businesslist\.[a-z.]+|2gis\.[a-z.]+|connect\.ae|dubaidirectory\.[a-z.]+)$/;
  const H_GOV = /(^|\.)(gov|gob|gouv|govt|government|mil)(\.[a-z]{2,12})?$|(^|\.)u\.ae$|(^|\.)europa\.eu$|(^|\.)(un|who|oecd|worldbank|imf|wto)\.org$|\.int$/;
  const H_BODY = /(chamber|association|council|federation|institute|society|authority|peppol|alliance|consortium|guild|board)/;
  const P_REG = /\b(accredit\w*|registered|approved|certified|licen[cs]ed|authori[sz]ed|registry|register|members?(hip)?[\s-]+(directory|list)|member[\s-]+directory|providers?[\s-]+list|list[\s-]+of[\s-]+(accredit|approv|regist|certif|licen|member|provider))/;
  const H_SOCIAL = /(^|\.)(linkedin\.com|facebook\.com|x\.com|twitter\.com|instagram\.com|threads\.net|pinterest\.com|medium\.com|substack\.com|dev\.to|hashnode\.dev|blogspot\.com|wordpress\.com|tumblr\.com)$/;
  const H_BLOGPLAT = /(^|\.)(medium\.com|substack\.com|dev\.to|hashnode\.dev|blogspot\.com|wordpress\.com|tumblr\.com)$/;
  const H_NEWS = /(^|\.)(reuters\.com|bloomberg\.com|forbes\.com|cnbc\.com|bbc\.co\.uk|bbc\.com|ft\.com|wsj\.com|nytimes\.com|theguardian\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gulfbusiness\.com|arabnews\.com|saudigazette\.com\.sa|dawn\.com|techcrunch\.com|theverge\.com|businessinsider\.com|economictimes\.indiatimes\.com|livemint\.com|prnewswire\.com|businesswire\.com|globenewswire\.com|einpresswire\.com|menafn\.com|accesswire\.com|newswire\.com|wamda\.com|magnitt\.com)$/;
  const H_NEWSY = /(^|[.-])(news|times|daily|gazette|herald|journal|tribune|magazine|mag)([.-]|$)/;
  const P_NEWS = /\/(news|press|press-releases?|newsroom|media-centre|media-center)(\/|$)|\/(19|20)\d\d\/\d{1,2}\//;
  const LISTY = /\b(best(?![\s-]+(practice|way|time|guide|approach|option for you))|top[\s-]?\d+|\d+[\s-]+(best|top|leading|great)|top[\s-]+(rated|ranked|companies|firms|agencies|providers|vendors|partners|developers|consultants|software|apps|tools|platforms|erp|ai|crm|picks|choices|list)|leading[\s-]+(\w+[\s-]+){0,2}(companies|firms|providers|agencies|partners|vendors|developers|consultants)|(companies|firms|providers|agencies|partners|vendors|developers|consultants|houses)[\s-]+in[\s-]+\w+|list[\s-]+of|alternatives?[\s-]+to|\w+[\s-]+alternatives|vs\.?|versus|compared|comparison|ranked|shortlist)\b/;
  const P_DIR = /\/(companies|agencies|developers|directory|vendors|firms|service-providers|providers|listings?|partners-directory|find-a-partner|partner-finder)(\/|$)(?!docs|api|documentation|reference)/;
  const P_VENDOR = /\/(services?|solutions?|products?|pricing|plans|about(-us)?|contact(-us)?|industries|case-stud(y|ies)|portfolio|platform|features|company|team|careers|customers|integrations?|docs|documentation|support|help|downloads?)(\/|$|-)/;
  const P_ARTICLE = /\/(blog|blogs|insights?|resources?|guides?|articles?|learn|knowledge|academy|library|posts?|whitepapers?|ebooks?)(\/|$)/;
  const rivalSet = (rivals) => { const hosts = new Set(), names = new Set();
    for (const r of (Array.isArray(rivals) ? rivals : S(rivals).split(','))) { if (!r) continue;
      const cand = typeof r === 'string' ? [r] : [r.host, r.domain, r.id, ...(Array.isArray(r.domains) ? r.domains : [])];
      for (const c of cand) { const h = hostOf(c); if (h && /\./.test(h)) hosts.add(h); else if (compact(c).length >= 5) names.add(compact(c)); }
      if (typeof r === 'object' && compact(r.name).length >= 5) names.add(compact(r.name)); }
    return { hosts: [...hosts], names: [...names] }; };
  const isRival = (host, path, RS) => { if (hostIn(host, RS.hosts)) return true; if (!RS.names.length) return false;
    const label = compact(host.split('.').slice(0, -1).join('.')); const segs = lc(path).split('/').map(compact).filter(Boolean);
    return RS.names.some(n => label === n || label.endsWith(n) || (H_SOCIAL.test(host) && segs.slice(0, 2).some(s => s === n || s === '@' + n || s.replace(/^@/, '') === n))); };
  const PLATFORM_TYPES = new Set(['directory', 'review', 'registry', 'community', 'encyclopedia', 'video', 'social']);
  const CLS = new Map();
  const classifyPage = ({ url, title, host, rivals, ourHosts } = {}) => {
    const u = S(url); const h = hostOf(host) || hostOf(u); const RS = rivals && rivals.hosts && rivals.names ? rivals : rivalSet(rivals); const OH = ourList(null, ourHosts);
    const ck = u + '|' + lc(title).slice(0, 120) + '|' + h + '|' + RS.hosts.join(',') + '|' + RS.names.join(',') + '|' + OH.join(',');
    if (CLS.has(ck)) return CLS.get(ck);
    const res = (() => {
      if (!h || (u && !isHttp(u) && !host)) return { page_type: 'unknown', author_kind: 'unknown', why: 'not a web address' };
      if (hostIn(h, OH)) return { page_type: 'client', author_kind: 'client', why: 'your own site (' + h + ')' };
      const path = lc(pathOf(u) || '/'); const text = lc(S(title)) + ' ' + path.replace(/[-_\/.]+/g, ' ');
      const rival = isRival(h, path, RS);
      const kind = (pt, why) => ({ page_type: pt, author_kind: rival && !PLATFORM_TYPES.has(pt) ? 'rival' : rival && (pt === 'social' || pt === 'video') ? 'rival' : PLATFORM_TYPES.has(pt) ? 'platform' : 'editorial', why: why + (rival ? '; written by a rival' : '') });
      if (H_ENC.test(h)) return kind('encyclopedia', 'encyclopedia host');
      if (H_VIDEO.test(h)) return kind('video', 'video host');
      if (H_COMM.test(h) || (P_COMM.test(path) && /(^|\.)(forum|community|discuss)/.test(h))) return kind('community', 'forum or community');
      if (H_REVIEW.test(h)) return kind('review', 'review platform');
      if (H_DIR.test(h)) return kind('directory', 'service directory');
      if (H_GOV.test(h)) return P_REG.test(text) ? kind('registry', 'an official list of accredited or registered providers') : kind('official', 'government or international body');
      if (H_BODY.test(h) && (P_REG.test(text) || /\/(members|directory|member-directory)(\/|$)/.test(path))) return kind('registry', 'an industry body\'s list of members or accredited providers');
      if (H_SOCIAL.test(h)) { if ((H_BLOGPLAT.test(h) || /^\/pulse\//.test(path)) && LISTY.test(text)) return kind('listicle', 'a list on a blogging platform'); return kind('social', 'social or blogging platform'); }
      if (P_DIR.test(path) && !rival && !LISTY.test(lc(S(title)))) return kind('directory', 'a directory path (' + (path.match(P_DIR) || [''])[0] + ')');
      if (LISTY.test(text)) return kind('listicle', 'a list or comparison (title or address)');
      if (H_NEWS.test(h) || P_NEWS.test(path) || H_NEWSY.test(h)) return kind('news', 'news or press');
      if (rival) return kind('vendor_page', 'a rival business\'s own page');
      if (path === '/' || P_VENDOR.test(path)) return kind('vendor_page', 'a business page that is not a list');
      if (P_ARTICLE.test(path)) return kind('vendor_page', 'a business\'s own article, not a list');
      return kind('unknown', 'no rule matched the host, address or title'); })();
    if (CLS.size > 5000) CLS.clear(); CLS.set(ck, res); return res; };

  // ---- evidence kept across weeks (seo_ai_rank_questions.evidence_json) ------------------------------------------------------------------
  // { v: 1, p: prompt_id, at, fn / ln / lc: first named, last named, last cited (ISO), s: { answer key: day number } (answers already counted),
  //   c: { 'YYYY-MM-DD|engine' (days up to 28 old) or 'wYYYY-MM-DD|engine' (weeks, 29-120 days): [n, named, cited, retrieved, has_retrieved_reading,
  //   parametric, cites, list_cites, negative, wrong, names_business] }, f: { query: [n, 'engine,engine', 'YYYY-MM-DD'] } }
  const NC = 11; const CAP = 8000;
  const listType = (pt) => pt === 'listicle' || pt === 'directory';
  const AFM = new WeakMap();
  const answerFacts = (row, OH) => { const ok = (OH || []).join(','); const m = AFM.get(row); if (m && m.ok === ok) return m.F; const F = answerFacts0(row, OH); AFM.set(row, { ok, F }); return F; };
  // the page type of a cited third-party page for the list count (no rival or client context needed: listicle / directory do not depend on it)
  const TOC = new Map();
  const typeOfCite = (c) => { const u = S(c.url) || ('https://' + S(c.host) + '/'); const k = u + '|' + lc(c.title); let t = TOC.get(k); if (t === undefined) { t = classifyPage({ url: u, title: c.title, rivals: [], ourHosts: [] }).page_type; if (TOC.size > 20000) TOC.clear(); TOC.set(k, t); } return t; };
  const answerFacts0 = (row, OH) => { const own = ourList({ domain: row.domain }, OH);
    const cited = J(row.cited_json, null); const cl = Array.isArray(cited) ? cited.filter(c => c && (c.url || c.host)) : (J(row.cited_urls, []) || []).filter(c => c && c.u).map(c => ({ url: c.u, title: c.t }));
    const isOurs = (c) => c.role === 'self' || hostIn(c.host || c.url, own);
    const ourCited = cl.some(isOurs) || flag(row.cited) || !!S(row.our_urls);
    const rt = S(row.retrieved_json); const rl = J(rt, null); const hasR = Array.isArray(rl);
    const ourRetr = ourCited || (hasR && rl.some(x => x && hostIn(x.host || x.url, own)));
    const fz = J(row.fanout_json, null); const fan = (Array.isArray(fz) ? fz : S(row.fanout) ? S(row.fanout).split(' | ') : []).map(normKw).filter(Boolean);
    const ents = J(row.entities_json, null);
    const named = flag(row.named) || (Array.isArray(ents) && ents.some(x => x && x.role === 'self' && x.position != null));
    const biz = named || (Array.isArray(ents) ? ents.some(x => x && (x.role === 'competitor' || (x.role === 'self' && x.position != null))) : !!S(row.competitors));
    const list = cl.filter(c => !isOurs(c) && listType(typeOfCite(c))).length;
    return { named, cited: ourCited, retrieved: ourRetr, hasR, param: cl.length === 0 && fan.length === 0, cites: cl.length, list, neg: named && lc(row.sentiment) === 'negative', wrong: !!S(row.issues), biz, fan: [...new Set(fan)].slice(0, 12), cl, own }; };
  const weekKey = (ms) => { const d = new Date(ms); const dow = (d.getUTCDay() + 6) % 7; return 'w' + dayOf(ms - dow * DAY); };
  const bucketMs = (k) => msOf(S(k).replace(/^w/, '').slice(0, 10) + 'T00:00:00Z');
  const rollObj = (stored, rows, N, pid, OH) => {
    const S0 = J(stored, null); const E0 = S0 && typeof S0 === 'object' && !Array.isArray(S0) ? S0 : {};
    const E = { v: 1, p: S(E0.p) || S(pid), at: S(E0.at), fn: S(E0.fn), ln: S(E0.ln), lc: S(E0.lc), s: { ...(E0.s && typeof E0.s === 'object' ? E0.s : {}) }, c: {}, f: {} };
    for (const [k, v] of Object.entries(E0.c && typeof E0.c === 'object' ? E0.c : {})) if (Array.isArray(v)) E.c[k] = v.slice(0, NC).concat(new Array(Math.max(0, NC - v.length)).fill(0)).map(x => num(x, 0));
    for (const [k, v] of Object.entries(E0.f && typeof E0.f === 'object' ? E0.f : {})) if (Array.isArray(v)) E.f[k] = [num(v[0], 0), S(v[1]), S(v[2])];
    let p = S(pid) || E.p;
    for (const row of (Array.isArray(rows) ? rows : [])) { if (!answered(row)) continue; if (!p && S(row.prompt_id)) { p = S(row.prompt_id); E.p = p; } if (p && S(row.prompt_id) && S(row.prompt_id) !== p) continue;
      const t = msOf(row.checked_at); if (!Number.isFinite(t)) continue; const e = engOf(row.engine);
      const key = hex8(S(row.run_id) + '|' + e + '|' + S(row.checked_at) + '|' + S(row.prompt_id)); if (E.s[key] != null) continue; E.s[key] = Math.floor(t / DAY);
      const F = answerFacts(row, OH); const at = isoOf(t); const dy = at.slice(0, 10); const bk = dy + '|' + e; const cell = E.c[bk] || new Array(NC).fill(0);
      const add = [1, F.named, F.cited, F.retrieved, F.hasR, F.param, F.cites, F.list, F.neg, F.wrong, F.biz]; for (let i = 0; i < NC; i++) cell[i] += add[i] ? Number(add[i]) : 0; E.c[bk] = cell;
      for (const q of F.fan) { const f = E.f[q] || [0, '', '']; f[0]++; const es = new Set(f[1] ? f[1].split(',') : []); es.add(e); f[1] = [...es].sort().join(','); if (dy > f[2]) f[2] = dy; E.f[q] = f; }
      if (F.named) { if (!E.fn || at < E.fn) E.fn = at; if (!E.ln || at > E.ln) E.ln = at; } if (F.cited && (!E.lc || at > E.lc)) E.lc = at; }
    if (Number.isFinite(N)) { E.at = isoOf(N);
      for (const [k, d] of Object.entries(E.s)) if (num(d, 0) < Math.floor(N / DAY) - 21) delete E.s[k];
      const merged = {}; for (const [k, v] of Object.entries(E.c)) { const [b, e] = k.split('|'); const t = bucketMs(b); if (!Number.isFinite(t) || N - t > 120 * DAY) continue;
        const nk = (b.charAt(0) !== 'w' && N - t > 28 * DAY ? weekKey(t) : b) + '|' + e; const cur = merged[nk] || new Array(NC).fill(0); for (let i = 0; i < NC; i++) cur[i] += v[i]; merged[nk] = cur; }
      E.c = merged;
      for (const [q, f] of Object.entries(E.f)) { const t = msOf(f[2] + 'T00:00:00Z'); if (Number.isFinite(t) && N - t > 120 * DAY) delete E.f[q]; } }
    return E; };
  const fit = (E) => { let s = JSON.stringify(E); if (s.length <= CAP) return s;
    const fq = Object.entries(E.f).sort((a, b) => b[1][0] - a[1][0] || b[1][2].localeCompare(a[1][2])); if (fq.length > 30) { E.f = {}; for (const [q, v] of fq.slice(0, 30)) E.f[q] = v; s = JSON.stringify(E); }
    const ck = Object.keys(E.c).sort((a, b) => bucketMs(a.split('|')[0]) - bucketMs(b.split('|')[0]));
    while (s.length > CAP && ck.length > 0) { delete E.c[ck.shift()]; s = JSON.stringify(E); }
    const fk = Object.entries(E.f).sort((a, b) => a[1][0] - b[1][0]).map(x => x[0]); while (s.length > CAP && fk.length) { delete E.f[fk.shift()]; s = JSON.stringify(E); }
    if (s.length > CAP) { E.s = {}; s = JSON.stringify(E); }
    return s.length > CAP ? JSON.stringify({ v: 1, p: E.p, at: E.at, fn: E.fn, ln: E.ln, lc: E.lc, s: {}, c: {}, f: {} }) : s; };
  const rollEvidence = ({ stored, answers8, now, prompt_id, ourHosts } = {}) => {
    const rows = Array.isArray(answers8) ? answers8 : [];
    if (!S(stored) && !rows.some(answered)) return typeof stored === 'string' ? stored : '';
    return fit(rollObj(stored, rows, msOf(now), prompt_id, ourList(null, ourHosts))); };

  // ---- 2.B: fan-out queries per question ----------------------------------------------------------------------------------------------
  const fanFromE = (E) => Object.entries(E.f).map(([query, f]) => ({ query, n: f[0], engines: f[1] ? f[1].split(',').filter(Boolean) : [] }))
    .sort((a, b) => b.n - a.n || a.query.localeCompare(b.query));
  const fanoutOf = ({ prompt_id, answers8, evidence, now } = {}) => fanFromE(rollObj(evidence, (Array.isArray(answers8) ? answers8 : []).filter(a => a && (!S(prompt_id) || S(a.prompt_id) === S(prompt_id))), msOf(now), prompt_id, []));

  // ---- 2.B: the stage per question x engine -------------------------------------------------------------------------------------------
  const BOTS_OF = { chatgpt: ['OAI-SearchBot'], chatgpt_api: ['OAI-SearchBot'], perplexity: ['PerplexityBot'], claude: ['Claude-SearchBot'],
    ai_overview: ['Googlebot'], ai_mode: ['Googlebot'], gemini: ['Googlebot', 'Google-Extended'], copilot: ['Bingbot'] };
  const INDEX_OF = { chatgpt: 'chatgpt', chatgpt_api: 'none', ai_overview: 'google', ai_mode: 'google', gemini: 'google', perplexity: 'google', copilot: 'bing', claude: 'brave' };
  const JS_BLIND = new Set(['chatgpt', 'chatgpt_api', 'perplexity', 'claude']);   // fetchers that read raw HTML (Google and Bing render)
  const W_ENGINE = { chatgpt: 0.30, ai_overview: 0.15, ai_mode: 0.15, gemini: 0.10, perplexity: 0.12, copilot: 0.10, claude: 0.08, chatgpt_api: 0.05 };
  const ORDER = { unmeasured: -1, S0: 0, S1: 1, S2: 2, S3: 3, S4: 4, S5: 5 };
  const NOT_INDEXED = /^(not_indexed|excluded)$/; const INDEXED = /^(indexed)$/;
  const robotsVerdict = (access, bot) => { const R = (access && access.robots) || {}; const k = Object.keys(R).find(x => lc(x) === lc(bot)); if (!k) return null; const v = R[k] || {};
    const a = v.allowed_root != null ? v.allowed_root : v.allowed; return a === false || /^false$/i.test(S(a)) ? { ok: false, rule: S(v.rule || v.root_rule) } : a === true || /^true$/i.test(S(a)) ? { ok: true, rule: S(v.rule) } : null; };
  const jsOnly = (pg) => { if (!pg) return false; const wr = num(pg.words_raw, null); if (wr == null || wr >= 150) return false;
    const wd = num(pg.words_rendered != null ? pg.words_rendered : pg.rendered_words != null ? pg.rendered_words : pg.words_js, null);
    if (wd != null) return wd >= 3 * Math.max(1, wr); return /javascript|client[\s-]side|without js|rendered by js|js[\s-]only/i.test(S(pg.issues)); };
  // diagnose is called once per question with the same site-wide lists: index them by question once (answered, usable engines only)
  const BYP = new WeakMap();
  const byPrompt = (list) => { if (!Array.isArray(list)) return new Map(); let m = BYP.get(list); if (m && m.n === list.length) return m.map;
    const map = new Map(); for (const a of list) { if (!a || !answered(a)) continue; const k = S(a.prompt_id); const g = map.get(k); if (g) g.push(a); else map.set(k, [a]); } BYP.set(list, { n: list.length, map }); return map; };
  // the engines a site asks at all (latest answer per engine, any question), once per list
  const LBE = new WeakMap();
  const lastByEngine = (list) => { if (!Array.isArray(list)) return new Map(); let m = LBE.get(list); if (m && m.n === list.length) return m.map; const map = new Map();
    for (const a of list) { if (!a || !answered(a)) continue; const e = engOf(a.engine); const t = msOf(a.at || a.checked_at); const c = map.get(e); if (c === undefined || (Number.isFinite(t) && !(t <= c))) map.set(e, Number.isFinite(t) ? t : (c === undefined ? NaN : c)); }
    LBE.set(list, { n: list.length, map }); return map; };
  const diagnose = ({ site, prompt, answers8, units60, evidence, access, pages, index, serp, bingStats, brave, brandKnown, ourHosts, rivals, engines, now, cfg } = {}) => {
    const N = msOf(now); const C = cfg || {}; const p = prompt || {}; const pid = S(p.prompt_id); const st = site || {};
    const OH = ourList(st, ourHosts); const ours = (u) => hostIn(u, OH);
    const rows = byPrompt(answers8).get(pid) || [];
    const E = rollObj(evidence, rows, N, pid, OH);
    const inW = (t, d) => { const x = msOf(t); return !Number.isFinite(N) || !Number.isFinite(x) || (x > N - d * DAY && x <= N + 6 * 3600e3); };
    const U = byPrompt(units60).get(pid) || [];
    const CE = Object.entries(E.c).map(([k, v]) => { const [b, ee] = k.split('|'); const bt = bucketMs(b); return { e: ee, end: b.charAt(0) === 'w' ? bt + 7 * DAY : bt + DAY, v }; });
    const CEM = new Map();
    const cellsE = (e, d) => { const ck = e + '|' + d; if (CEM.has(ck)) return CEM.get(ck); const t = new Array(NC).fill(0); for (const c of CE) { if (c.e !== e) continue;
      if (Number.isFinite(N) && c.end <= N - d * DAY) continue; for (let i = 0; i < NC; i++) t[i] += c.v[i]; } CEM.set(ck, t); return t; };
    const intent = ['recommendation', 'informational', 'brand'].includes(lc(p.intent)) ? lc(p.intent) : intentOf(p, U.filter(u => inW(u.at, 28)).length >= 4 ? U.filter(u => inW(u.at, 28)) : rows);
    // the searches the engines ran for this question, plus its own keyword
    const fan = fanFromE(E); const queries = [...new Set([...fan.map(f => f.query), normKw(p.keyword)].filter(Boolean))].slice(0, 40);
    // the client page AIR maps to the question
    const PG = (Array.isArray(pages) ? pages : []).filter(g => g && ours(g.url));
    const G = index && index.google ? asMap(index.google) : new Map();
    const mapped = (() => {
      const byQ = PG.find(g => S(g.questions).split(/[\s,|]+/).includes(pid)); if (byQ) return { ...byQ, how: 'question' };
      const tu = S(p.page_url || p.target_url); if (tu && ours(tu)) return { ...(PG.find(g => AIRF.urlKey(g.url) === AIRF.urlKey(tu)) || { url: tu }), how: 'target' };
      const cnt = new Map(); for (const r of rows) for (const c of answerFacts(r, OH).cl) { const u = S(c.url); if (u && hostIn(c.host || u, OH)) cnt.set(AIRF.urlKey(u), [(cnt.get(AIRF.urlKey(u)) || [0])[0] + 1, u]); }
      const top = [...cnt.values()].sort((a, b) => b[0] - a[0])[0]; if (top) return { ...(PG.find(g => AIRF.urlKey(g.url) === AIRF.urlKey(top[1])) || { url: top[1] }), how: 'cited' };
      const kw = S(p.keyword) || S(p.prompt); const pool = PG.map(g => ({ g, text: pathOf(g.url) + ' ' + S(g.title) }));
      for (const k of G.keys()) if (hostIn('https://' + k, OH) && !pool.some(x => AIRF.urlKey(x.g.url) === k)) pool.push({ g: { url: 'https://' + k }, text: k.replace(/^[^\/]+/, '') });
      let best = null; for (const x of pool) { if (pathOf(x.g.url) === '/' ) continue; const s = cover(kw, x.text); if (s >= 0.5 && (!best || s > best.s || (s === best.s && pathOf(x.g.url).length < pathOf(best.g.url).length))) best = { s, g: x.g }; }
      return best ? { ...best.g, how: 'words' } : null; })();
    const gState = (u) => { const v = G.get(AIRF.urlKey(u)); return v && typeof v === 'object' ? lc(v.state) : lc(v); };
    const serpM = serp ? asMap(serp) : new Map(); const braveM = brave ? asMap(brave) : index && index.brave ? asMap(index.brave) : null;
    const bingPos = bingStats && bingStats.positions ? asMap(bingStats.positions) : null;
    const gsc = index && index.gsc ? asMap(index.gsc) : null;
    const look = (M, q) => M.get(q) || M.get(normKw(q)) || M.get(normKw(q).replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff ]+/g, ' ').replace(/\s+/g, ' ').trim());
    // FX-A RA-13: a Google results page counts only when it was read in the question's market (its market, else the site's): a US page says nothing
    // about a UAE question. An entry may hold one reading per location (`by_loc`, AI_Rank_Plan) or one reading with its `location_code`; a reading
    // with no location recorded is accepted (it cannot be shown to be another market's)
    const wantLoc = (() => { const qcc = S(p.market).split(/[-_]/)[0].toUpperCase(); const l1 = qcc ? LOC.get(qcc) || 0 : 0; if (l1) return l1; const sl = num(st.location_code, 0); return sl > 0 ? sl : (LOC.get(ccOf(st.country)) || 0); })();
    const inMarket = (r) => { if (!r) return null; if (r.by_loc && typeof r.by_loc === 'object') { if (!wantLoc) return r; return r.by_loc[wantLoc] || r.by_loc[String(wantLoc)] || r.by_loc['0'] || null; }
      const rl = num(r.location_code, 0); return !wantLoc || !rl || rl === wantLoc ? r : null; };
    const rankIn = (kind) => { let best = null, read = false, anyOurs = false;
      if (kind === 'google') for (const q of queries) { const r = inMarket(look(serpM, q)); if (!r) continue; read = true; const res = Array.isArray(r.results) ? r.results : Array.isArray(r.items) ? r.items : [];
        for (const x of res) { if (!x) continue; const pos = num(x.pos != null ? x.pos : x.rank_group != null ? x.rank_group : x.rank_absolute, null); if (pos == null || !ours(x.url || x.domain)) continue; anyOurs = true;
          if (!best || pos < best.pos) best = { query: q, pos, index: 'google', read_at: S(r.read_at || r.at || r.datetime) }; break; } }
      else if (kind === 'bing' && bingPos) for (const q of queries) { const v = look(bingPos, q); if (v == null) continue; read = true; const pos = num(v && typeof v === 'object' ? v.pos != null ? v.pos : v.position : v, null);
        if (pos != null && pos > 0) { anyOurs = true; if (!best || pos < best.pos) best = { query: q, pos: r1(pos), index: 'bing', read_at: S(bingStats.read_at) }; } }
      else if (kind === 'brave' && braveM) for (const q of queries) { const r = look(braveM, q); if (!r) continue; read = true; const res = Array.isArray(r) ? r : Array.isArray(r.results) ? r.results : [];
        for (const x of res) { if (!x) continue; const pos = num(x.pos != null ? x.pos : x.position, null); if (pos == null || !ours(x.url)) continue; anyOurs = true; if (!best || pos < best.pos) best = { query: q, pos, index: 'brave', read_at: S(r.read_at) }; break; } }
      return { best, read, anyOurs, top10: !!best && best.pos <= 10 }; };
    const RK = { google: rankIn('google'), bing: rankIn('bing'), brave: rankIn('brave') };
    const thinList = Array.isArray(C.thin_engines) ? C.thin_engines.map(lc) : ['claude'];
    const engs = (Array.isArray(engines) && engines.length ? engines : AIRF.ENGINES).map(engOf).filter(usable);
    const nobodyNamed = (() => { const u28 = U.filter(u => inW(u.at, 28)); if (u28.length >= 4) return u28.filter(namesBusiness).length / u28.length <= 0.2;
      let n = 0, b = 0; for (const e of engs) { const t = cellsE(e, 28); n += t[0]; b += t[10]; } return n >= 4 && b / n <= 0.2; })();
    const byCitation = intent === 'informational' || nobodyNamed;
    const askedBySite = new Set(); for (const L of [units60, answers8]) for (const [e2, t] of lastByEngine(L)) if (!Number.isFinite(N) || !Number.isFinite(t) || (t > N - 56 * DAY && t <= N + 6 * 3600e3)) askedBySite.add(e2);
    // S0 per engine: robots block, a JavaScript-only page for a fetcher that does not render, not in the engine's index. A reading that shows the
    // engine already reads the client (cited, retrieved) beats the page inference, and a ranking in the engine's own index beats Index Coverage;
    // a Google ranking proves nothing about a fetcher that does not render (Perplexity). -> { sub, ev } or null
    const eligibility = (e, cited, retrieved, rk, ix) => {
      const blockBot = (BOTS_OF[e] || []).map(b => [b, robotsVerdict(access, b)]).find(x => x[1] && x[1].ok === false);
      const blockedListed = Array.isArray(access && access.blocked_engines) && access.blocked_engines.map(engOf).includes(e);
      if (blockBot || blockedListed) return { sub: 'blocked', ev: { kind: 'robots', bot: blockBot ? blockBot[0] : (BOTS_OF[e] || [''])[0], rule: blockBot ? blockBot[1].rule : '', at: S(access && access.read_at) } };
      const read = cited > 0 || retrieved > 0; const proof = read || rk.top10 || (ix === 'google' && rk.anyOurs);
      if (!read && JS_BLIND.has(e) && jsOnly(mapped)) return { sub: 'js_only', ev: { kind: 'page', url: S(mapped.url), words_raw: num(mapped.words_raw, 0), what: 'little text without JavaScript', at: S(mapped.checked_at) } };
      if (!proof && ix === 'google' && e !== 'perplexity' && G.size) {
        const gscHit = gsc && queries.some(q => num(look(gsc, q), 0) > 0);
        const siteIdx = [...G.entries()].filter(([k]) => hostIn('https://' + k, OH)); const anyIdx = siteIdx.some(([, v]) => INDEXED.test(v && typeof v === 'object' ? lc(v.state) : lc(v)));
        const ms = mapped ? gState(mapped.url) : ''; const notIdx = mapped ? NOT_INDEXED.test(ms) || (!ms && siteIdx.length > 0 && !anyIdx) : siteIdx.length > 0 && !anyIdx;
        if (!gscHit && notIdx) return { sub: 'not_indexed', ev: { kind: 'index', url: mapped ? S(mapped.url) : '', state: ms || 'no page of the site indexed', what: mapped ? 'the page for this question is not in Google' : 'no page of the site is in Google' } }; }
      if (!proof && ix === 'bing') { const B = (index && index.bing) || {}; const inAcc = B.in_account; const crawled = B.crawled ? asMap(B.crawled) : new Map();
        if (inAcc === false) return { sub: 'not_indexed', ev: { kind: 'bing', what: 'the site is not in the Bing Webmaster account' } };
        if (inAcc === true && mapped && !crawled.has(AIRF.urlKey(mapped.url)) && !S(mapped.bing_crawled_at) && Number.isFinite(msOf(mapped.submitted_at)) && N - msOf(mapped.submitted_at) >= 14 * DAY)
          return { sub: 'not_indexed', ev: { kind: 'bing', url: S(mapped.url), what: 'submitted ' + S(mapped.submitted_at).slice(0, 10) + ', not crawled by Bing 14 days later' } }; }
      return null; };
    const out = {}; const param = {}; const noSearch = [];
    for (const e of [...new Set(engs)]) {
      const any28 = U.some(u => engOf(u.engine) === e && inW(u.at, 28)) || cellsE(e, 28)[0] > 0;
      const thin = thinList.includes(e) || (!any28 && (U.some(u => engOf(u.engine) === e && inW(u.at, 56)) || cellsE(e, 56)[0] > 0));
      const W = thin ? num(C.thin_days, 56) : num(C.window_days, 28); const minN = thin ? num(C.min_n_thin, 2) : num(C.min_n, 4);
      const ue = U.filter(u => engOf(u.engine) === e && inW(u.at, W)); const ce = cellsE(e, W); const useU = ue.length > 0;
      const n = useU ? ue.length : ce[0]; const named = useU ? ue.filter(u => u.named).length : ce[1]; const cited = useU ? ue.filter(u => u.cited).length : ce[2];
      const retrieved = Math.max(ce[3], e === 'chatgpt' ? cited : 0); const hasR = ce[4];
      const positions = (useU ? ue.filter(u => u.named).map(u => num(u.position, null)) : rows.filter(r => engOf(r.engine) === e && answerFacts(r, OH).named).map(r => num(r.position != null ? r.position : r.rank, null))).filter(x => x != null && x > 0);
      const ix = INDEX_OF[e]; const rk = ix === 'google' ? RK.google : ix === 'bing' ? RK.bing : ix === 'brave' ? RK.brave : { best: null, read: false, anyOurs: false, top10: false };
      const ev = [];
      const recent = rows.filter(r => engOf(r.engine) === e).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)));
      // DESIGN 2.B deviation (orchestrator, 2026-11-06, fixes/P1.md): with 0-3 answers, S0 (robots / JavaScript / index presence) and S1 (a rank or
      // fan-out proxy, or ChatGPT's own retrieved set without the client) are still read, marked `provisional`, because their basis is not an
      // answer rate; S2-S5 need n >= 4. Once n >= 4 the ordinary rules decide (agreeing or not) and the cell is no longer provisional.
      const low = n < minN; let prov = false;
      const cell = (stage, sub, basis) => ({ stage, sub, basis, n, named, cited, retrieved, our_rank: rk.best, evidence: ev.slice(0, 3), thin, provisional: prov && (stage === 'S0' || stage === 'S1') });   // thin, provisional: additive
      if (ce[0] > 0) { param[e] = r3(ce[5] / ce[0]); if (ce[0] >= num(C.min_param_n, 3) && ce[5] / ce[0] >= 0.6) noSearch.push(e); }
      const unmeasured = () => { ev.length = 0; ev.push(n === 0 ? { kind: 'count', what: 'no answer of this engine to this question in ' + W + ' days' } : { kind: 'count', what: n + ' answer(s) in ' + W + ' days, ' + minN + ' needed' + (thin ? ' (engine asked less than weekly)' : '') });
        prov = false; return cell('unmeasured', n === 0 ? 'not_asked' : 'too_few', 'direct'); };
      if (n === 0 && !askedBySite.has(e)) { const s0u = eligibility(e, cited, retrieved, rk, ix);   // an engine the site does not ask at all: eligibility only
        if (s0u) { out[e] = { stage: 'S0', sub: s0u.sub, basis: 'direct', n: 0, named: 0, cited: 0, retrieved: 0, our_rank: rk.best, evidence: [s0u.ev, { kind: 'count', what: 'provisional: this engine is not asked for your site' }], thin, provisional: true, asked: false }; continue; }
        out[e] = unmeasured(); continue; }
      if (low) { prov = true; ev.push({ kind: 'count', what: 'provisional: ' + n + ' answer(s) in ' + W + ' days, ' + minN + ' needed for an answer-based stage' }); }
      // S0: the engine cannot read the client (one function, also used for the engines the site does not ask: see below)
      const s0 = eligibility(e, cited, retrieved, rk, ix); if (s0) { ev.push(s0.ev); out[e] = cell('S0', s0.sub, 'direct'); continue; }
      if (low) { const b1 = e === 'chatgpt' ? (hasR > 0 ? 'direct' : '') : rk.read && ix !== 'none' ? 'proxy_rank' : '';
        if (named === 0 && cited === 0 && retrieved === 0 && !rk.top10 && b1) { ev.length = 0;
          ev.push(b1 === 'direct' ? { kind: 'answer', what: 'your site was not among the pages ChatGPT read (' + hasR + ' readings)' } : { kind: ix === 'google' ? 'serp' : ix, query: rk.best ? rk.best.query : queries[0] || '', pos: rk.best ? rk.best.pos : null, at: rk.best ? rk.best.read_at : '', what: rk.best ? 'ranks ' + rk.best.pos : 'not in the results read' });
          ev.push({ kind: 'count', what: 'provisional: ' + n + ' answer(s) in ' + W + ' days' }); out[e] = cell('S1', '', b1); continue; }
        out[e] = unmeasured(); continue; }
      // S3-S5 from the answers
      const rate = named / n, crate = cited / n, med = median(positions);
      const namedA = ce[1]; const negHeavy = ce[8] >= 1 && ce[8] >= Math.ceil(0.25 * Math.max(1, namedA)); const wrong = ce[9] > 0;
      const wonNamed = named >= 2 && rate >= 0.30 && (byCitation || med == null || med <= 3);
      const wonCited = byCitation && cited >= 2 && crate >= 0.30;
      const ansEv = (what, f) => { for (const r of recent.filter(f).slice(0, 2)) ev.push({ kind: 'answer', at: S(r.checked_at), run_id: S(r.run_id), what }); };
      if (wonNamed || wonCited || named >= 1) { const nm = wonNamed || named >= 1;
        ev.push({ kind: 'rate', what: (nm ? 'named in ' + named : 'cited in ' + cited) + ' of ' + n + ' answers' + (med != null && nm ? ', median position ' + r1(med) : '') });
        ansEv(nm ? 'named' : 'cited', r => { const F = answerFacts(r, OH); return nm ? F.named : F.cited; });
        if (wrong) { ev.unshift({ kind: 'accuracy', what: ce[9] + ' answer(s) state something wrong about you' }); out[e] = cell('S4', 'wrong', 'direct'); continue; }
        if (negHeavy) { ev.unshift({ kind: 'sentiment', what: ce[8] + ' answer(s) speak negatively about you' }); out[e] = cell('S4', 'negative', 'direct'); continue; }
        if (wonNamed || wonCited) { out[e] = cell('S5', '', 'direct'); continue; }
        out[e] = cell('S4', !byCitation && named >= 2 && rate >= 0.30 && med != null && med > 3 ? 'low_position' : 'weak', 'direct'); continue; }
      if (cited >= 1) { ev.push({ kind: 'rate', what: 'cited in ' + cited + ' of ' + n + ' answers, named in none' }); ansEv('cited', r => answerFacts(r, OH).cited);
        out[e] = byCitation ? cell('S4', 'weak', 'direct') : cell('S3', '', 'direct'); continue; }
      // S2 / S1: retrieved (direct for ChatGPT) or ranking in the engine's index (proxy)
      if (e === 'chatgpt' && retrieved >= 1) { ev.push({ kind: 'answer', what: 'your page was among the pages ChatGPT read (' + retrieved + ' of ' + n + ' answers)' }); out[e] = cell('S2', '', 'direct'); continue; }
      if (rk.top10) { ev.push({ kind: ix === 'google' ? 'serp' : ix, query: rk.best.query, pos: rk.best.pos, at: rk.best.read_at }); out[e] = cell('S2', '', 'proxy_rank'); continue; }
      const basis = e === 'chatgpt' ? (hasR > 0 ? 'direct' : 'unknown_index') : rk.read ? 'proxy_rank' : 'unknown_index';
      if (e === 'chatgpt' && hasR > 0) ev.push({ kind: 'answer', what: 'your site was not among the pages ChatGPT read (' + hasR + ' readings)' });
      else if (rk.read) ev.push({ kind: ix === 'google' ? 'serp' : ix, query: rk.best ? rk.best.query : queries[0] || '', pos: rk.best ? rk.best.pos : null, at: rk.best ? rk.best.read_at : '', what: rk.best ? 'ranks ' + rk.best.pos : 'not in the results read' });
      else ev.push({ kind: 'none', what: ix === 'none' ? 'no reading of what this engine retrieves' : 'no reading of ' + (ix === 'chatgpt' ? 'what ChatGPT retrieved' : 'the ' + ix + ' results') + ' for these searches' });
      out[e] = cell('S1', '', basis); }
    // engines the site does not ask (or the caller did not list): no answer stage, but eligibility does not depend on asking. A Copilot that
    // cannot find the site in Bing is a step to take in week 1 (DESIGN 2.B deviation, fixes/P1.md): such a cell is a provisional S0 with n 0
    // and `asked: false` (additive); an engine with no S0 finding gets no cell, as before.
    for (const e of AIRF.ENGINES) { if (out[e] || !usable(e)) continue; const ix = INDEX_OF[e]; const rk = ix === 'google' ? RK.google : ix === 'bing' ? RK.bing : ix === 'brave' ? RK.brave : { best: null, read: false, anyOurs: false, top10: false };
      const ce = cellsE(e, 56); const s0 = eligibility(e, ce[2], ce[3], rk, ix); if (!s0) continue;
      out[e] = { stage: 'S0', sub: s0.sub, basis: 'direct', n: 0, named: 0, cited: 0, retrieved: 0, our_rank: rk.best, evidence: [s0.ev, { kind: 'count', what: 'provisional: this engine is not asked for your site' }], thin: false, provisional: true, asked: false }; }
    // question-level signals
    let tc = 0, tl = 0; for (const e of Object.keys(out)) { const t = cellsE(e, 28); tc += t[6]; tl += t[7]; }
    const list_dominated = tc >= num(C.min_list_cites, 3) && tl / tc >= 0.4;
    const meas = Object.entries(out).filter(([, c]) => c.stage !== 'unmeasured' && c.asked !== false); const wsum = meas.reduce((s, [e]) => s + (num((C.weights || {})[e], W_ENGINE[e] || 0.05)), 0);   // an engine the site does not ask never moves best_stage
    let best_stage = 'unmeasured'; if (meas.length) { let acc = 0; for (const [e, c] of meas.slice().sort((a, b) => ORDER[b[1].stage] - ORDER[a[1].stage])) { acc += num((C.weights || {})[e], W_ENGINE[e] || 0.05); if (acc >= 0.25 * wsum - 1e-9) { best_stage = c.stage; break; } } }
    let fnM = msOf(E.fn), lnM = msOf(E.ln), lcM = msOf(E.lc); for (const u of U) { const t = msOf(u.at); if (!Number.isFinite(t)) continue; if (u.named) { if (!(t >= fnM)) fnM = t; if (!(t <= lnM)) lnM = t; } if (u.cited && !(t <= lcM)) lcM = t; }
    const fn = isoOf(fnM), ln = isoOf(lnM), lcx = isoOf(lcM);
    return { prompt_id: pid, intent, engines: out, best_stage, parametric_share: param, no_search: noSearch, list_dominated, nobody_named: nobodyNamed,
      first_named_at: fn || '', last_named_at: ln || '', last_cited_at: lcx || '', mapped_page: mapped ? S(mapped.url) : '', fanout: queries.slice(0, 12) };   // mapped_page, fanout: additive
  };

  // ---- 2.C: the source graph ------------------------------------------------------------------------------------------------------------
  const PLACE = { directory: [0.80, 'a directory with a self-serve profile: a person creates it, reviews raise its place'],
    review: [0.60, 'a review platform with a self-serve profile: it needs genuine reviews to rank'],
    registry: [0.50, 'an official list: you are listed if you meet its rules (check them)'], community: [0.30, 'a disclosed, genuine answer in the thread'],
    news: [0.05, 'a news article: a later story may name you, the article itself rarely changes'] };
  const placeOf = (pt, author, names, contact) => {
    if (names === true) return [0, 'it already names you: keep it that way'];
    if (author === 'client') return [0, 'your own page'];
    if (author === 'rival' && pt === 'listicle') return [0.02, 'a rival\'s list: learn its format and who it names; pitched only with the owner\'s opt-in'];
    if (author === 'rival') return [0, 'a rival\'s own page'];
    if (pt === 'listicle') return contact ? [0.15, 'an editorial list with a contact found'] : [0.05, 'an editorial list, no contact found'];
    if (PLACE[pt]) return PLACE[pt];
    return [0, pt === 'vendor_page' ? 'a business\'s own page: nobody adds you to it' : pt === 'official' || pt === 'encyclopedia' ? 'not a page you can be placed on' : pt === 'video' || pt === 'social' ? 'a post: answer with your own (other levers)' : 'cannot tell what kind of page this is']; };
  const sources = ({ answers8, storedSources, mentionsPages, fetched, prompts, values, rivals, ourHosts, now } = {}) => {
    const N = msOf(now); const RS = rivalSet(rivals); const rows = (Array.isArray(answers8) ? answers8 : []).filter(answered);
    const OH = ourList(null, ourHosts, rows.map(r => r.domain));
    const PQ = Array.isArray(prompts) && prompts.length ? new Map(prompts.filter(p => p && S(p.prompt_id)).map(p => [S(p.prompt_id), p])) : null;
    const VQ = asMap(values); const vOf = (pid) => { const v = VQ.get(pid); return num(v && typeof v === 'object' ? v.V : v, 1); };
    const inW = (t) => { const x = msOf(t); return !Number.isFinite(N) || !Number.isFinite(x) || (x > N - 28 * DAY && x <= N + 6 * 3600e3); };
    const keep = (r) => { const pid = S(r.prompt_id); if (lc(r.kind) === 'brand') return false; if (PQ) { const p = PQ.get(pid); if (!p || intentOf(p, []) === 'brand' || p.core === false || /^false$/i.test(S(p.core))) return false; } return inW(r.checked_at); };
    const answersOf = new Map(); const pages = new Map();
    for (const r of rows) { if (!keep(r)) continue; const pid = S(r.prompt_id); answersOf.set(pid, (answersOf.get(pid) || 0) + 1);
      const own = ourList({ domain: r.domain }, OH); const seen = new Set();
      for (const c of answerFacts(r, OH).cl) { const url = S(c.url) || (c.host ? 'https://' + S(c.host) + '/' : ''); const host = hostOf(c.host || url); if (!url || !host || c.role === 'self' || hostIn(host, own)) continue;
        const key = AIRF.urlKey(url); if (!key || seen.has(key)) continue; seen.add(key);
        const g = pages.get(key) || { url, host, title: '', perQ: new Map(), engines: new Set(), cites: 0, last: '' };
        g.cites++; g.perQ.set(pid, (g.perQ.get(pid) || 0) + 1); g.engines.add(engOf(r.engine)); if (!g.title && S(c.title || c.t)) g.title = S(c.title || c.t);
        const at = isoOf(msOf(r.checked_at)); if (at > g.last) g.last = at; pages.set(key, g); } }
    const FM = new Map(); for (const f of (fetched instanceof Map ? [...fetched.values()] : Array.isArray(fetched) ? fetched : fetched && typeof fetched === 'object' ? Object.values(fetched) : [])) { if (f && S(f.url)) FM.set(AIRF.urlKey(f.url), f); }
    const SM = new Map((Array.isArray(storedSources) ? storedSources : []).filter(r => r && S(r.url_key || r.url)).map(r => [S(r.url_key) || AIRF.urlKey(r.url), r]));
    const arr = (v) => { const x = J(v, null); return Array.isArray(x) ? x.map(S).filter(Boolean) : S(v) ? S(v).split(',').map(S).filter(Boolean) : []; };
    const boolN = (v) => (v === true || /^true$/i.test(S(v)) ? true : v === false || /^false$/i.test(S(v)) ? false : null);
    const out = [];
    const build = (key, url, host, title, from, g) => { const f = FM.get(key); const s = SM.get(key) || {};
      const cls = classifyPage({ url, title: title || S(f && f.title) || S(s.title), host, rivals: RS, ourHosts: OH });
      let names = null; if (f) { const code = num(f.fetch_status != null ? f.fetch_status : f.status != null ? f.status : f.statusCode, 0); const v = f.mentions_us != null ? f.mentions_us : f.names_client != null ? f.names_client : f.names_us;
        names = code >= 200 && code < 300 ? boolN(v) : null; } else names = boolN(s.names_client);
      const rivals_named = f && Array.isArray(f.competitors_named || f.rivals_named) ? (f.competitors_named || f.rivals_named).map(S).filter(Boolean) : arr(s.rivals_named);
      const contact_email = S((f && f.contact_email) || s.contact_email); const contact_url = S((f && f.contact_url) || s.contact_url);
      const [placeability, placeability_why] = placeOf(cls.page_type, cls.author_kind, names, contact_email || contact_url);
      let influence = 0; const qs = g ? [...g.perQ.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : [];
      for (const [pid, k] of qs) { const n = answersOf.get(pid) || 0; if (n > 0) influence += vOf(pid) * k / n; }
      return { url, url_key: key, host, page_type: cls.page_type, author_kind: cls.author_kind, names_client: names, rivals_named, questions: g ? qs.map(x => x[0]) : arr(s.questions),
        engines: g ? [...g.engines].sort() : arr(s.engines), cites_28d: g ? g.cites : 0, influence: r4(influence), placeability, placeability_why, contact_email, contact_url, from,
        last_seen: g ? (S(s.last_seen) > g.last ? S(s.last_seen) : g.last) : S(s.last_seen), page_why: cls.why, first_seen: S(s.first_seen) || (g ? g.last : isoOf(N)) };   // page_why, first_seen: additive
    };
    for (const [key, g] of pages) out.push(build(key, g.url, g.host, g.title, 'answers', g));
    for (const [key, s] of SM) { if (pages.has(key)) continue; const ls = msOf(s.last_seen); if (Number.isFinite(N) && Number.isFinite(ls) && N - ls > 120 * DAY) continue;
      const url = S(s.url) || 'https://' + key; out.push(build(key, url, hostOf(url), S(s.title), S(s.source_from) === 'llm_mentions' ? 'llm_mentions' : 'answers', null)); }
    for (const m of (Array.isArray(mentionsPages) ? mentionsPages : [])) { const url = S(m && m.url); const key = AIRF.urlKey(url); if (!key || pages.has(key) || SM.has(key) || out.some(o => o.url_key === key) || hostIn(url, OH)) continue;
      const o = build(key, url, hostOf(url), S(m.title), 'llm_mentions', null); o.last_seen = o.last_seen || isoOf(N); out.push(o); }
    return out.sort((a, b) => (b.influence * b.placeability - a.influence * a.placeability) || (b.influence - a.influence) || (b.cites_28d - a.cites_28d) || a.url_key.localeCompare(b.url_key));
  };

  return { VERSION, market, intentOf, corePanel, assignArms, mde, fanoutOf, diagnose, classifyPage, sources, rollEvidence };
})();
// ---- SERP-GOTO (2026-11-08, R5 L-1): the real site behind a Google results-page redirect (SU) ----
// Since about 2026-11-05 DataForSEO's LIVE Google organic SERP answers every organic and local-pack item with `domain: "google.com"`,
// `url: "https://google.com/goto?url=CAES..."` (an opaque token nobody can decode), `main_domain` / `relative_url` null and `links[].url`
// wrapped the same way. Google started serving /goto links in August; on 2026-11-02 DataForSEO wrote that Google now throttles how many
// of them can be resolved per results page, so "High priority and Live requests resolve about half" (live probes of 2026-11-08 resolved
// none of 50). Standard-priority tasks (task_post + task_get, about 80 s) still come back with every real URL.
//   Read as it comes, every reader took google.com for the site: the Rank Tracker never found the client (13 of 14 rows of 2026-11-05
// held goto URLs), competitors became google.com, and no two keywords ever shared a result (each token is unique).
//   What survives is `breadcrumb` ("https://www.sage.com › en-ae › erp") and sometimes `website_name` (a host, a brand, or
// "Facebook · <page name>"). The rule, applied as early as possible (every DataForSEO answer node, the SERP cache, the rank kit):
//   * an item is a REDIRECT when its url is a Google redirect (google.<tld>/goto, /url, /search/url, /aclk; or Bing /ck/a) - a normal
//     google.com result (support.google.com/..., about.google/...) is NOT one and passes untouched;
//   * its host comes from the breadcrumb (the text before the first " › "), else from website_name when that is a host, else from a
//     known social network named before " · " ("Facebook · X" -> facebook.com); otherwise the item stays UNRESOLVED: domain null,
//     url null, never google.com;
//   * a recovered url is `https://<host>/<breadcrumb segments joined by "/">` - APPROXIMATE: Google's breadcrumb segments are often the
//     path ("› en-ae › erp") but sometimes page labels ("› Home › Blog"), and a long one is cut ("› best-erp-sof..."). Only a complete
//     breadcrumb of slug segments is a path (`url_path: 'path'`); a cut one, labels or the host alone say `url_partial: true` and the url
//     is then the host's home page (review 2026-11-08, M2);
//   * every rewritten item carries `url_exact: false`, `url_recovered` ('breadcrumb' | 'website_name' | 'social' | null) and the original
//     redirect in `redirect_url`; an item that was not a redirect is returned as the SAME object (old fixtures stay byte-identical).
// What a reader may do with an approximate url (the rule every reader follows):
//   * the SITE (host) is reliable: own-site rank detection matches by host, competitors are counted by host;
//   * the PAGE is not: own-page identification says "page not identified" (url ''), never a guessed page; a cited source needs an exact
//     url; clustering compares `SU.key()` - host + the complete slug path - which is the same for the same result on two pages read
//     the same way, marked `~` so it never equals an exact url key; a partial result has NO key (review H1: two posts of one blog must
//     not look like one page);
//   * own-site rank: -1 only when a result with no site could be ours (`couldBe`: our domain label in its name / title / breadcrumb).
// Regex only: the n8n Code sandbox has no URL constructor. `var` + the guard lets two kits that both inline SU share one copy.
var SU = (typeof SU === 'object' && SU && SU.v === 1) ? SU : (() => {
  const S = (x) => (x == null ? '' : String(x));
  const REDIR = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:google\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:goto|url|search\/url|aclk)(?=[?\/#]|$)|bing\.com\/ck\/a(?=[?\/#]|$))/i;
  const isRedirect = (u) => REDIR.test(S(u).trim());
  // R-H2 (review 2026-11-08): a host may be Unicode (Google shows IDNs as "müller.de") or punycode, its TLD too ("xn--mgbaam7a8h", the UAE)
  const HOST = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,24}|xn--[a-z0-9-]{1,59})$/iu;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // R-L1: "constructor" is not a social network
  const SOCIAL = { facebook: 'facebook.com', linkedin: 'linkedin.com', youtube: 'youtube.com', instagram: 'instagram.com', x: 'x.com',
    twitter: 'x.com', reddit: 'reddit.com', quora: 'quora.com', tiktok: 'tiktok.com', medium: 'medium.com', pinterest: 'pinterest.com' };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  // R-H2: the scheme is optional ("en.wikipedia.org › wiki › ERP"); a first word with no dot ("3 reactions · 1 month ago") is not a host
  const crumbHost = (b) => { const m = S(b).trim().match(/^(?:https?:\/\/)?([^\/\s›]+)/i); const h = m && !/@/.test(m[1]) ? m[1].toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '') : ''; return HOST.test(h) ? h : ''; };
  // the breadcrumb's path segments, up to (not including) the first cut one; `cut` says whether one was cut
  // R-M2: a segment is a PATH segment only when it looks like a slug (lower case, no spaces); "› Home › Blog" are page labels, not a path
  const SLUG = /^[a-z0-9%._~-]+$/;
  const crumbPath = (b) => {
    const parts = S(b).split(/\s*›\s*/).slice(1).map(x => x.trim()).filter(Boolean); const segs = []; let cut = false, labels = false;
    for (const p of parts) { if (/^(?:\.\.\.|…)$/.test(p) || /(?:\.\.\.|…)$/.test(p)) { cut = true; break; } if (!SLUG.test(p)) labels = true; segs.push(p.replace(/\s+/g, '-').replace(/[?#]/g, '')); }
    return { segs, cut, labels };
  };
  // a redirect that CARRIES its target (google.com/url?q=https://..., ?url=https%3A...) is read as that target, exactly (FU-SV kept this
  // rule for the facts search); the /goto token is opaque, so this finds nothing there
  // R-L2: one host rule for a carried target; userinfo ("https://u:p@host") or no host at all is not a target, and nothing here can throw
  const hostOfUrl = (u) => { const m = S(u).match(/^https?:\/\/([^\/?#\s]+)/i); if (!m || /@/.test(m[1])) return ''; const h = m[1].toLowerCase().replace(/:\d+$/, ''); return HOST.test(h) ? h : ''; };
  const dec = (v) => { let x = S(v); for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(x); i++) { try { x = decodeURIComponent(x); } catch (e) { break; } } return x; };
  const carried = (u) => { const s = S(u).trim(); const q = s.indexOf('?'); if (q < 0) return '';
    for (const n of ['url', 'q', 'u']) for (const p of s.slice(q + 1).replace(/#.*$/, '').split('&')) { const e = p.indexOf('=');
      if (e > 0 && p.slice(0, e).toLowerCase() === n) { const t = dec(p.slice(e + 1)).trim(); if (/^https?:\/\/[^\s\/?#]+\.[^\s<>"]*$/i.test(t) && !isRedirect(t) && hostOfUrl(t)) return t; } }
    return ''; };
  const nameHost = (n) => { const s = S(n).trim().toLowerCase(); if (HOST.test(s)) return s;
    const brand = s.split(/\s*·\s*/)[0].trim(); return has(SOCIAL, brand) ? SOCIAL[brand] : ''; };
  // one item -> the same object when it is not a redirect, else a copy with the real host (or none)
  const fixItem = (it) => {
    if (!it || typeof it !== 'object' || !isRedirect(it.url)) return fixLinks(it);
    const tgt = carried(it.url); const th = tgt ? hostOfUrl(tgt) : '';
    if (tgt && th) { const h = th;
      return fixLinks({ ...it, domain: h, url: tgt, main_domain: bare(h), relative_url: (tgt.match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i) || [])[1] || '/', url_recovered: 'redirect', redirect_url: S(it.url) }, true); }   // exact: no url_exact flag
    const ch = crumbHost(it.breadcrumb); const nh = ch ? '' : nameHost(it.website_name);
    const host = ch || nh;
    const how = ch ? 'breadcrumb' : (nh ? (HOST.test(S(it.website_name).trim()) ? 'website_name' : 'social') : null);
    // url_path: 'path' (slug segments, complete), 'labels' (page labels, not a path), 'cut' (Google cut it), 'none' (the host only)
    // url_partial: the PAGE is not known from the breadcrumb (anything but 'path'); its url is then the host's home page
    let url = null, rel = null, partial = true, pathKind = 'none';
    if (host) {
      const p = ch ? crumbPath(it.breadcrumb) : { segs: [], cut: false, labels: false };
      pathKind = p.cut ? 'cut' : p.labels ? 'labels' : p.segs.length ? 'path' : 'none';
      partial = pathKind !== 'path'; const segs = partial ? [] : p.segs;
      rel = '/' + segs.join('/'); url = 'https://' + host + (segs.length ? rel : '/');
    }
    const out = { ...it, domain: host || null, url, main_domain: host ? bare(host) : null, relative_url: rel, url_exact: false,
      url_recovered: how, url_partial: partial, url_path: host ? pathKind : null, redirect_url: S(it.url) };
    return fixLinks(out, true);
  };
  // links / nested items (AI Overview elements, sitelinks): a redirect url there is dropped (null), never kept as google.com
  const fixLinks = (it, copied) => {
    if (!it || typeof it !== 'object') return it;
    let o = it;
    for (const f of ['links', 'items', 'references']) {
      const arr = it[f]; if (!Array.isArray(arr)) continue;
      let changed = false;
      const next = arr.map(x => { if (!x || typeof x !== 'object') return x;
        if (f === 'items' && x.type && (x.type === 'organic' || x.breadcrumb != null)) { const y = fixItem(x); if (y !== x) changed = true; return y; }
        if (isRedirect(x.url)) { changed = true; return { ...x, url: null, domain: (x.domain && !/^(?:www\.)?google\./i.test(S(x.domain))) ? x.domain : null, url_exact: false, redirect_url: S(x.url) }; }
        const y = fixLinks(x); if (y !== x) changed = true; return y; });
      if (changed) { if (o === it && !copied) o = { ...it }; o[f] = next; }   // `copied`: `it` is already this kit's own copy
    }
    return o;
  };
  // a whole DataForSEO answer -> the same object when nothing was a redirect, else a copy (result[].items rewritten, counts on the result)
  const fixAnswer = (res) => {
    if (!res || typeof res !== 'object' || !Array.isArray(res.tasks)) return res;
    let changedAny = false;
    const tasks = res.tasks.map(t => {
      if (!t || !Array.isArray(t.result)) return t;
      let ch = false;
      const result = t.result.map(r => {
        if (!r || !Array.isArray(r.items)) return r;
        let n = 0, rec = 0, unres = 0;
        const items = r.items.map(x => { const y = fixItem(x); if (y !== x) { if (y && y.redirect_url && y.type) { n++; if (y.domain) rec++; else unres++; } } return y; });
        if (!items.some((y, i) => y !== r.items[i])) return r;
        ch = true; return { ...r, items, serp_url: { redirects: n, recovered: rec, unresolved: unres, rule: 'SU (v5/code/_serp_url.js): host from the breadcrumb, url approximate' } };
      });
      if (!ch) return t; changedAny = true; return { ...t, result };
    });
    return changedAny ? { ...res, tasks } : res;
  };
  const fixItems = (items) => (Array.isArray(items) ? items.map(fixItem) : items);
  const exact = (it) => !!it && it.url_exact !== false;
  const unresolved = (it) => !!it && it.url_exact === false && !it.domain;
  // a stored compact reading written before this fix: an item still holding a redirect url with no recovery on it
  const poisoned = (v) => !!v && Array.isArray(v.items) && v.items.some(x => x && (x.type === 'organic' || x.type === 'local_pack') && isRedirect(x.url) && x.url_exact !== false);
  // the clustering key of one result: an exact url as it is (no scheme, no www, no query, no trailing slash); an approximate one as
  // "~host/segments" in lower case (the same result read on two pages gives the same key; it is never equal to an exact key)
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  // R-H1 (review 2026-11-08): only a COMPLETE slug path is a key. A cut, label or host-only breadcrumb has NO key ('') - two different
  // posts of one blog would otherwise share "~host/…" and merge two searches that share no page; with no key such a result neither
  // matches nor counts towards the minimum a results page needs to be compared (Ladder Clusters: "too few to compare")
  const key = (it) => { if (!it) return ''; if (exact(it)) return urlKey(it.url || it.domain);
    if (!it.domain || it.url_partial || !it.relative_url || it.relative_url === '/') return ''; return '~' + urlKey(S(it.domain) + it.relative_url); };
  // R-H2: could this unresolved result be the site's own? Its visible name, title or breadcrumb carries the site's own label
  // ("techand" for techand.ai, "gear up" for gear-up.ae), in any case and spacing
  const flat = (v) => S(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const labelOf = (d) => flat(bare(S(d)).replace(/^https?:\/\//, '').split('/')[0].split('.')[0]);
  const couldBe = (it, domain) => { const l = labelOf(domain); if (!it || l.length < 4) return false;
    return [it.website_name, it.title, it.breadcrumb].some(v => flat(v).includes(l)); };
  // ---- SERP-GOTO (re-review N1): unread readings of seo_rank_history, shared by the Rank Tracker and the Site Tracker ----
  // UNREAD = position -1 because a result Google hid may be ours (snapshot `mo`), or settled after that (`st`). A -1 without `mo` is a
  // failed read, which is not an unread reading and ends a streak. A row stored with bare redirects (before this fix) is no reading.
  const snapOf = (v) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const poisonedRow = (h) => !!h && ((Array.isArray(snapOf(h.snapshot_json).top) && snapOf(h.snapshot_json).top.some(e => e && isRedirect(e.u))) || isRedirect(h.url));
  const unreadRow = (h) => { if (!h || Number(h.position) !== -1) return false; const x = snapOf(h.snapshot_json); return Number(x.mo) > 0 || Number(x.st) > 0; };
  const weekOf = (t) => { const d = new Date(S(t)); if (isNaN(d.getTime())) return ''; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10); };
  // how many earlier CALENDAR WEEKS (Monday-based, UTC) in a row ended unread, newest first: a catch-up or an app re-check in the same
  // week is one week, and this run's own week does not count. rows: one keyword's desktop rows of one tracker (any order)
  const unreadWeeks = (rows, o) => { const now = weekOf((o || {}).now || new Date().toISOString()); const weeks = new Set();
    for (const h of (rows || []).filter(r => r && !poisonedRow(r) && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)))) {
      if (!unreadRow(h)) break; const w = weekOf(h.checked_at); if (w && w !== now) weeks.add(w); }
    return weeks.size; };
  // the words a report uses for an unread reading (null for any other)
  const unreadNote = (snap) => { const x = snapOf(snap); return Number(x.st) > 0 ? 'not found among the results we could read' : Number(x.mo) > 0 ? 'could not be told: a result Google hid may be yours' : null; };
  return { v: 1, REDIR, HOST, unreadRow, weekOf, unreadWeeks, unreadNote, poisonedRowSU: poisonedRow, isRedirect, carried, hostOfUrl, couldBe, labelOf, fixItem, fixItems, fixAnswer, exact, unresolved, poisoned, key, urlKey, crumbHost, crumbPath, nameHost };
})();
// KW-SERP / RV-12 (2026-10-21): ONE Google results-page reading per search and per day, shared by every path that reads it.
//   On 2026-10-21 the research, the ladder and the rank tracker read three different results pages for "ai consultant" on the same day,
// and on 2026-10-17 two runs three minutes apart said "no AI Overview" and "an AI Overview was seen". A client must get one answer, and
// we must pay for it once. The identity of a reading is: the keyword (lower case, spaces collapsed), location_code, language_code, device
// and the UTC day. The row in seo_cache is keyed WITHOUT the day (`serp:<keyword>|<location>|<language>|<device>`) and the day is checked
// on the stored value, so the table holds one row per search (overwritten by the next day's read), not one row per search per day.
//   A path asks for a reading with what it needs: a depth (how many results) and whether the AI Overview's content must be loaded. A
// stored reading is used only when it is from today AND at least that deep AND (when asked) loaded the AI Overview; otherwise the path
// makes its request as before and its reading replaces the stored one. A failed read (HTTP error, a task error inside an HTTP 200, no
// result) is never stored. "No Search Results" (40102) is DataForSEO's final answer: read, and empty, so it is stored.
//   Concurrency: two runs that miss at the same moment both pay once and the later write wins. That is accepted: it costs one extra
// read in a rare race and both runs still read a real page. A cache hit costs nothing: the rebuilt answer carries cost 0 and a task id
// `cache:<id of the paid task>`, so the ledger's count-once-by-task-id rule still counts the money exactly once.
const SC = (() => {
  const CFG = { prefix: 'serp:', kind: 'serp', title_len: 120, desc_len: 160, aio_text_len: 800, max_chars: 20000, default_depth: 100 };
  const S = (x) => (x == null ? '' : String(x));
  const normKw = (k) => { let s = S(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
  const dayOf = (t) => { const d = t ? new Date(t) : new Date(); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };
  // DataForSEO's datetime is "2026-10-21 14:05:12 +00:00"; Date() does not read that form everywhere, so it is rewritten to ISO first
  const isoOf = (t) => { const s = S(t).trim(); if (!s) return ''; const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*([+-]\d{2}):?(\d{2})$/);
    const d = new Date(m ? m[1] + 'T' + m[2] + m[3] + ':' + m[4] : s); return isNaN(d.getTime()) ? '' : d.toISOString(); };
  const ident = (q) => ({ keyword: normKw((q || {}).keyword), location_code: Number((q || {}).location_code) || 0,
    language_code: S((q || {}).language_code || 'en').toLowerCase().trim() || 'en', device: S((q || {}).device || 'desktop').toLowerCase().trim() || 'desktop' });
  const key = (q) => { const i = ident(q); return CFG.prefix + [i.keyword, i.location_code, i.language_code, i.device].join('|'); };
  // what a request needs from a reading: its depth (DataForSEO's default is 100) and whether it asked for the AI Overview's content
  const need = (body) => ({ depth: Number((body || {}).depth) || CFG.default_depth, aio: (body || {}).load_async_ai_overview === true });
  const hhmm = (iso) => { const s = isoOf(iso); return s ? s.slice(11, 16) : ''; };
  const timing = (r) => (r && r.at ? 'read earlier today at ' + hhmm(r.at) + ' UTC' : 'read earlier today');
  const task0 = (res) => ((res && Array.isArray(res.tasks)) ? res.tasks[0] : null) || {};
  // the one test of "this answer is a reading": no HTTP error, 20000 at the top and on the task, a result array; 40102 is read and empty
  const status = (res) => {
    if (!res || typeof res !== 'object' || res.error) return 'failed';
    const t = task0(res);
    if (Number(t.status_code) === 40102 || Number(res.status_code) === 40102) return 'empty';
    if (Number(res.status_code) !== 20000 || Number(t.status_code) !== 20000 || !Array.isArray(t.result)) return 'failed';
    return 'ok';
  };
  const cut = (s, n) => S(s).slice(0, n);
  const ref = (r) => ({ domain: cut((r || {}).domain, 80), url: cut((r || {}).url, 240), title: cut((r || {}).title, CFG.title_len) });
  // SERP-GOTO (2026-11-08, v5/code/_serp_url.js, inlined above this kit): a result whose url was a Google redirect is stored with its
  // recovered host and the flags that say its url is approximate; a clean result is stored exactly as before (no new keys)
  const su = (o, x) => { if (x && x.url_exact === false) { o.url_exact = false; o.url_recovered = x.url_recovered || null; o.url_partial = !!x.url_partial; o.url_path = x.url_path || null; o.relative_url = x.relative_url || null; } return o; };
  // the compact form of one item: enough for every reader of this codebase (organic order and owners, page titles, PAA, related searches,
  // forum threads, the featured snippet, the AI Overview and its cited sources, which features were on the page), nothing else
  const compactItem = (x) => {
    const t = S(x && x.type); const o = { type: t, rank_group: Number(x.rank_group) || null, rank_absolute: Number(x.rank_absolute) || null };
    if (t === 'organic') { o.url = cut(x.url, 300); o.domain = cut(x.domain, 100); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description, CFG.desc_len); return su(o, x); }
    if (t === 'people_also_ask') { o.items = (x.items || []).slice(0, 10).map(q => ({ title: cut(q && (q.title || q.question), 200) })).filter(q => q.title); return o; }
    if (t === 'related_searches') { o.items = (x.items || []).slice(0, 12).map(q => cut(typeof q === 'string' ? q : (q && (q.title || q.keyword)), 120)).filter(Boolean); return o; }
    if (t === 'discussions_and_forums') { o.items = (x.items || []).slice(0, 6).map(q => ({ title: cut(q && q.title, CFG.title_len), domain: cut(q && (q.domain || q.source), 80), url: cut(q && q.url, 240) })); return o; }
    if (t === 'featured_snippet') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description || x.text, 400); return su(o, x); }
    if (t === 'ai_overview') {
      o.asynchronous_ai_overview = x.asynchronous_ai_overview === true;
      o.references = (x.references || []).slice(0, 12).map(ref);
      let left = CFG.aio_text_len;
      o.items = (x.items || []).slice(0, 8).map(y => { const tx = cut(y && (y.text || y.markdown), Math.max(0, left)); left -= tx.length;
        return { title: cut(y && y.title, CFG.title_len), text: tx, references: ((y && y.references) || []).slice(0, 6).map(ref) }; });
      return o;
    }
    if (t === 'local_pack' || t === 'map') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); return su(o, x); }
    return o;
  };
  // a fresh answer -> the reading to store (null when it is not a reading: a failed read is never stored)
  const reading = (res, body, opts) => {
    const st = status(res); if (st === 'failed') return null;
    const o = opts || {}; const t = task0(res); const r0 = ((t.result || [])[0]) || {};
    const b = body || (t.data || {}); const id = ident({ ...(t.data || {}), ...b }); const nd = need(b);
    const at = isoOf(r0.datetime) || isoOf(o.now) || new Date().toISOString();
    const items = Array.isArray(r0.items) ? SU.fixItems(r0.items) : [];   // SERP-GOTO: the real host behind a Google redirect, before anything is stored
    const out = { v: 1, ...id, day: dayOf(at), at, datetime: S(r0.datetime) || at, task_id: S(t.id), cost: Number(t.cost) || 0, depth: nd.depth, aio_loaded: nd.aio,
      empty: st === 'empty', se_results_count: r0.se_results_count ?? null, item_types: Array.isArray(r0.item_types) ? r0.item_types.map(S) : [...new Set(items.map(x => S(x && x.type)))].filter(Boolean),
      ai_overview_seen: items.some(x => x && x.type === 'ai_overview'), path: S(o.path),
      items: items.filter(Boolean).map(x => compactItem(x)) };
    // keep the stored value compact: drop the descriptions, then the titles below the top 10, then the tail, until it fits
    let s = JSON.stringify(out);
    const below10 = (x) => x.type === 'organic' && Number(x.rank_group) > 10;
    if (s.length > CFG.max_chars) { out.items.forEach(x => { if (below10(x)) delete x.description; }); s = JSON.stringify(out); }
    if (s.length > CFG.max_chars) { out.items.forEach(x => { if (below10(x)) delete x.title; }); s = JSON.stringify(out); }
    while (s.length > CFG.max_chars && out.items.length > 10) { out.items.pop(); out.depth = Math.min(out.depth, out.items.filter(x => x.type === 'organic').length); s = JSON.stringify(out); }
    return out;
  };
  // the descriptions, then the titles below the top 10 go first when the value is too long, then the tail (the depth then says so)
  // a stored reading -> an answer in DataForSEO's own shape, so every existing reader works unchanged; it cost nothing
  const response = (r) => ({ status_code: 20000, status_message: 'Ok.', cost: 0, tasks_count: 1, tasks_error: 0,
    serp_cache: { hit: true, key: key(r), read_at: r.at, day: r.day, task_id: r.task_id, depth: r.depth, aio_loaded: !!r.aio_loaded, text: timing(r) },
    tasks: [{ id: 'cache:' + S(r.task_id), status_code: r.empty ? 40102 : 20000, status_message: r.empty ? 'No Search Results.' : 'Ok.', cost: 0,
      data: { keyword: r.keyword, location_code: r.location_code, language_code: r.language_code, device: r.device, depth: r.depth, load_async_ai_overview: !!r.aio_loaded },
      result: r.empty ? null : [{ keyword: r.keyword, location_code: r.location_code, language_code: r.language_code, datetime: r.datetime || r.at,
        se_results_count: r.se_results_count, item_types: r.item_types || [], items_count: (r.items || []).length, items: (r.items || []).map(x => ({ ...x })) }] }] });
  const parse = (row) => { if (!row || typeof row !== 'object') return null; let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } } return v && typeof v === 'object' ? v : null; };
  // the stored reading this request may use, or why not. `rows` are seo_cache rows (any keys; the right one is found by its key)
  const lookup = (rows, body, opts) => {
    const o = opts || {}; const k = key(body); const nd = need(body); const today = dayOf(o.now);
    const row = (Array.isArray(rows) ? rows : []).find(x => x && x.key === k);
    if (!row) return { hit: false, key: k, why: 'not read yet today' };
    const r = parse(row);
    if (!r) return { hit: false, key: k, why: 'stored reading unreadable' };
    if (r.day !== today) return { hit: false, key: k, why: 'last read on ' + (r.day || 'an unknown day') };
    if (SU.poisoned(r)) return { hit: false, key: k, why: 'stored reading holds Google redirect links with no site behind them (read before the 2026-11-08 fix)' };
    if (key(r) !== k) return { hit: false, key: k, why: 'stored reading is for another search' };
    if (!r.empty && Number(r.depth) < nd.depth) return { hit: false, key: k, why: 'read today only ' + r.depth + ' results deep, this needs ' + nd.depth };
    if (nd.aio && !r.aio_loaded) return { hit: false, key: k, why: 'read today without the AI Overview content, which this needs' };
    return { hit: true, key: k, reading: r, response: response(r), text: timing(r) };
  };
  // the seo_cache row (exact columns of CACHE_COLS) for a reading, or null
  const row = (r, siteId) => (r ? { key: key(r), kind: CFG.kind, site_id: S(siteId), value: JSON.stringify(r), updated_at: new Date().toISOString() } : null);
  // a fresh answer straight to its row (null when it was a cache hit or a failed read)
  const rowFor = (res, body, siteId, opts) => { if (res && res.serp_cache && res.serp_cache.hit) return null; return row(reading(res, body, opts), siteId); };
  return { CFG, key, ident, need, status, reading, response, lookup, row, rowFor, timing, dayOf, normKw };
})();
// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----
const COUNTRIES = {
  'United States':        { code: 2840, iso: 'US', lang: 'en', language: 'English', spelling: 'American English',   currency: 'USD' },
  'United Kingdom':       { code: 2826, iso: 'GB', lang: 'en', language: 'English', spelling: 'British English',    currency: 'GBP' },
  'Canada':               { code: 2124, iso: 'CA', lang: 'en', language: 'English', spelling: 'Canadian English',   currency: 'CAD' },
  'Australia':            { code: 2036, iso: 'AU', lang: 'en', language: 'English', spelling: 'Australian English', currency: 'AUD' },
  'New Zealand':          { code: 2554, iso: 'NZ', lang: 'en', language: 'English', spelling: 'British English',    currency: 'NZD' },
  'Ireland':              { code: 2372, iso: 'IE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'EUR' },
  'Pakistan':             { code: 2586, iso: 'PK', lang: 'en', language: 'English', spelling: 'British English',    currency: 'PKR' },
  'India':                { code: 2356, iso: 'IN', lang: 'en', language: 'English', spelling: 'British English',    currency: 'INR' },
  'United Arab Emirates': { code: 2784, iso: 'AE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'AED' },
  'Saudi Arabia':         { code: 2682, iso: 'SA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SAR' },
  'Singapore':            { code: 2702, iso: 'SG', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SGD' },
  'South Africa':         { code: 2710, iso: 'ZA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'ZAR' },
  'Germany':              { code: 2276, iso: 'DE', lang: 'de', language: 'German',  spelling: 'German',             currency: 'EUR' },
  'France':               { code: 2250, iso: 'FR', lang: 'fr', language: 'French',  spelling: 'French',             currency: 'EUR' },
  'Spain':                { code: 2724, iso: 'ES', lang: 'es', language: 'Spanish', spelling: 'European Spanish',   currency: 'EUR' },
  'Italy':                { code: 2380, iso: 'IT', lang: 'it', language: 'Italian', spelling: 'Italian',            currency: 'EUR' },
  'Netherlands':          { code: 2528, iso: 'NL', lang: 'nl', language: 'Dutch',   spelling: 'Dutch',              currency: 'EUR' },
  'Brazil':               { code: 2076, iso: 'BR', lang: 'pt', language: 'Portuguese', spelling: 'Brazilian Portuguese', currency: 'BRL' },
  'Mexico':               { code: 2484, iso: 'MX', lang: 'es', language: 'Spanish', spelling: 'Mexican Spanish',    currency: 'MXN' }
};
const AIRC = { API: 'https://api.dataforseo.com/v3/', serp_depth: 10, serp_fresh_days: 2,   /* FX-B RB-12: the AI visibility run prunes every serp: row older than 2 days (F-85), so an older reading is never there to reuse */ queries_max: 50, brave_week_max: 10, bing_query_pages: 3, bing_calls_week_max: 10,
  mentions_keywords: 5, cc_every_days: 28,
  // planning prices (USD) only: the ledger settles what each DataForSEO task reports, counted once by its task id (AI Rank Fetched)
  price: { serp: 0.002, mentions_pages: 0.15, mentions_metrics: 0.101, brave: 0.005 }, site_usd_max: 0.6 };
const BRAVE_ON = false;   // baked by ai_rank_requests_wiring.py: true only when SEO_BRAVE_API_KEY is set in n8n/.env
const BING_ON = true;    // baked by build_monitors.py: true only when SEO_BING_WEBMASTER_API_KEY is set
const nowMs = Date.now(); const nowIso = new Date(nowMs).toISOString(); const DAY = 864e5;
const S0 = (v) => (v == null ? '' : String(v)).trim();
const P = (s, d) => { if (s && typeof s === 'object') return s; try { const v = JSON.parse(String(s || '')); return v == null ? d : v; } catch (e) { return d; } };
const tryAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const normD = (d) => S0(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
const bySite = (rows, sid, dom) => rows.filter(r => r && (S0(r.site_id) === sid || (!S0(r.site_id) && normD(r.domain) === dom)));
const listOf = (v) => { const j = P(v, null); if (Array.isArray(j)) return j.map(S0).filter(Boolean); return S0(v).split(/[,|;\s]+/).map(S0).filter(Boolean); };
const rawHost = (u) => { const m = S0(u).match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
// ISO week (Monday first): the budget of the paid and keyed reads is per site and per ISO week
const isoWeek = (ms) => { const d = new Date(ms); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); const th = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY + 3 * DAY;
  const y = new Date(th).getUTCFullYear(); return y + '-W' + String(1 + Math.floor((th - Date.UTC(y, 0, 1)) / (7 * DAY))).padStart(2, '0'); };
const weekKey = (sid, wk) => 'air:week:' + sid + ':' + wk;
const ccKey = (sid) => 'air:cc:' + sid;
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];   // as _monitor_sites.js (copilot is opt-in)

const sites = tryAll('AI Rank Live').filter(x => x && x.site_id && !x.skip && !x.error);
const cacheAir = tryAll('Load AI Rank Cache');
// FX-B RB-4: the re-check fails closed too: a kill row read by its key, or a load that errored or never ran, means no paid or keyed read
const killAir = tryAll('Load AI Rank Kill');
const killNow = AIRF.killed(cacheAir) || AIRF.killed(killAir) || !cacheAir.length || !killAir.length || cacheAir.some(r => r && r.error) || killAir.some(r => r && r.error);
const pay = sites.filter(g => AIRF.mayPay(g.rank || AIRF.settingsOf({}), killNow));
if (!pay.length) return [{ json: { skip: true, reason: sites.length ? 'no website in mode on: AIR reads nothing from outside in shadow' : 'no website to read for' } }];

const serpRows = tryAll('Load SERP Cache (Rank)');
const qRows = tryAll('Load AI Rank Questions'), answersAll = tryAll('Load AI Answers (Rank)'), promptsAll = tryAll('Load AI Prompts');
const siteRows = tryAll('Load Sites'), monRows = tryAll('Load Monitors'), plans = tryAll('Growth Plan').filter(p => p && p.site_id && !p.nothing_to_do);
// Bing's list of the sites this account manages (read by AI Growth this run); null = not read (Bing off or the call failed)
const bingList = (() => { if (!BING_ON) return null; try { const r = $('Fetch Bing Sites (Growth)').first(); const j0 = r && r.json; if (!j0 || typeof j0 !== 'object' || j0.error) return null;
  let j = j0; if (j0.d === undefined) { const b = j0.body ?? j0.data; if (b && typeof b === 'object') j = b; else { try { j = JSON.parse(b || '{}'); } catch (e) { j = {}; } } }
  return Array.isArray(j.d) ? j.d.filter(x => x && x.Url) : null; } catch (e) { return null; } })();
const byIso = {}; for (const c of Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {})) if (c && c.iso) byIso[String(c.iso).toUpperCase()] = c;
const cacheOf = (key) => cacheAir.find(r => r && S0(r.key) === key) || null;

const out = [];
for (const g of pay) {
  const sid = g.site_id; const rank = g.rank || AIRF.settingsOf({}); const why = [];
  const gp = plans.find(p => p.site_id === sid) || {}; const dom = normD(gp.domain || g.domain); const host = S0(gp.site_host).toLowerCase() || dom;
  const siteRow = siteRows.find(r => S0(r.site_id) === sid) || siteRows.find(r => normD(r.domain) === dom) || {};
  const mon = monRows.find(m => S0(m.site_id) === sid) || {};
  const engines = (() => { const e = listOf(mon.ai_engines).map(x => x.toLowerCase()).filter(x => AIRF.usable(x)); return e.length ? [...new Set(e)] : DEFAULT_ENGINES.slice(); })();
  const prompts = bySite(promptsAll, sid, dom);
  // ---- the market of the reads: the site's own, else its questions' dominant market, else none (nothing is read in a guessed country) ----
  const loc = (() => { const lc = Number(siteRow.location_code) || 0;
    const iso = S0(((typeof COUNTRIES === 'object' ? COUNTRIES : {})[S0(siteRow.country)] || {}).iso || Object.values(byIso).find(c => Number(c.code) === lc)?.iso).toUpperCase();
    if (lc) return { location_code: lc, language_code: S0(siteRow.language_code || 'en').toLowerCase() || 'en', country_iso: iso, basis: 'the website\'s own market (seo_sites)' };
    const cnt = {}; for (const p of prompts) { const m = S0(p.market).match(/^([A-Za-z]{2})-([A-Za-z]{2})/); if (m) { const k = m[1].toUpperCase() + '-' + m[2].toLowerCase(); cnt[k] = (cnt[k] || 0) + 1; } }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (top) { const [cc, lang] = top[0].split('-'); const c = byIso[cc]; if (c && c.code) return { location_code: Number(c.code), language_code: lang, country_iso: cc, basis: 'the dominant market of its questions (' + top[0] + ')' }; }
    return null; })();
  if (!loc) why.push('no market on file for this website (seo_sites has no location and its questions name none): no results page is read');
  // ---- the questions whose searches matter: treated core questions, else core, else every stored AIR question, else the active panel ----
  const stored = bySite(qRows, sid, dom);
  const isCore = (r) => r.core === true || /^true$/i.test(S0(r.core));
  let qs = stored.filter(r => isCore(r) && S0(r.arm) === 'treated'); let qBasis = 'treated core questions';
  if (!qs.length) { qs = stored.filter(isCore); qBasis = 'core questions (no arms assigned yet)'; }
  if (!qs.length) { qs = stored; qBasis = 'every question AIR has diagnosed'; }
  if (!qs.length) { qs = prompts.filter(p => !['off', 'refused', 'retired', 'proposed'].includes(S0(p.status || 'active').toLowerCase()) && !S0(p.retired_at) && S0(p.kind) !== 'brand')
    .map(p => ({ prompt_id: p.prompt_id, evidence_json: '' })); qBasis = 'the active question panel (AIR has stored no question yet)'; }
  const promptById = new Map(prompts.map(p => [S0(p.prompt_id), p]));
  const answers = bySite(answersAll, sid, dom).filter(a => AIRF.usable(a.engine));
  const agg = new Map();   // normalised query -> { query, key, n, questions }
  const addQ = (query, n, pid) => { const k = SC.normKw(query); if (!k || k.length < 3 || k.length > 200) return; const x = agg.get(k) || { query: k, key: k, n: 0, questions: [] };
    x.n += Number(n) || 0; if (pid && !x.questions.includes(pid)) x.questions.push(pid); agg.set(k, x); };
  for (const r of qs) { const pid = S0(r.prompt_id); if (!pid) continue;
    let fan = []; try { fan = ARD.fanoutOf({ prompt_id: pid, answers8: answers, evidence: S0(r.evidence_json), now: nowMs }) || []; } catch (e) { fan = []; }
    for (const f of fan) addQ(f.query, f.n, pid);
    const kw = S0((promptById.get(pid) || {}).keyword || r.keyword); if (kw) addQ(kw, 1, pid); }
  const queries = [...agg.values()].sort((a, b) => b.n - a.n || b.questions.length - a.questions.length || a.key.localeCompare(b.key)).slice(0, AIRC.queries_max);
  // ---- what this week already read (a second run of the same week reuses it and spends nothing again) ----
  const wk = isoWeek(nowMs); const wkRow = cacheOf(weekKey(sid, wk)); const week = wkRow ? P(wkRow.value, null) : null;
  const usedOf = (k) => Number(((week || {}).reads || {})[k]) || 0;
  const readOf = (e, key) => ((week && Array.isArray(week.readings)) ? week.readings : []).find(x => x && x.e === e && x.k === key) || null;
  // ---- Google results pages for the fan-out searches ----
  const askCopilot = engines.includes('copilot');
  const serpLeft = Math.max(0, rank.fanout_n - usedOf('google') - usedOf('bing'));
  const gBudget = askCopilot ? Math.ceil(serpLeft / 2) : serpLeft;
  const google = { read: [], cached: [], budget: gBudget, basis: rank.fanout_n > 0 ? 'ai_rank_fanout_n = ' + rank.fanout_n + ' paid reads a week (both engines); ' + (usedOf('google') + usedOf('bing')) + ' already made this week' : 'ai_rank_fanout_n is 0: no fan-out results page is read' };
  const bodyOf = (q) => ({ keyword: q.slice(0, 700), location_code: loc.location_code, language_code: loc.language_code, depth: AIRC.serp_depth });
  if (rank.fanout_n > 0 && loc) for (const q of queries) {
    const body = bodyOf(q.query); const row = serpRows.find(r => r && S0(r.key) === SC.key(body)); const v = row ? P(row.value, null) : null;
    const fresh = v && v.at && !SU.poisoned(v) && nowMs - Date.parse(v.at) <= AIRC.serp_fresh_days * DAY && (v.empty || Number(v.depth) >= AIRC.serp_depth);   // SERP-GOTO: a reading with unresolved Google redirect links is read again
    if (fresh) { google.cached.push({ query: q.query, key: q.key, source: 'serp cache', read_at: S0(v.at), location_code: loc.location_code,
      results: v.empty ? [] : (v.items || []).filter(x => x && x.type === 'organic' && x.url).map(x => ({ url: x.url, pos: Number(x.rank_group || x.rank_absolute) || null })) }); continue; }
    const st = readOf('google', q.key); if (st) { google.cached.push({ query: q.query, key: q.key, source: 'this week', read_at: S0(st.at), location_code: Number(st.loc) || loc.location_code, results: st.ours || [], results_scope: 'ours' }); continue; }
    if (google.read.length >= gBudget) continue;
    google.read.push({ query: q.query, key: q.key, body }); }
  // ---- Bing results pages: candidates only; *AI Rank SERP Requests* drops the searches Bing Webmaster already ranks the site for ----
  const bing_serp = { candidates: [], cached: [], budget: Math.max(0, serpLeft - google.read.length), basis: !askCopilot ? 'the website does not ask Copilot: no Bing results page is read' : '' };
  if (askCopilot && rank.fanout_n > 0 && loc) for (const q of queries) { const st = readOf('bing', q.key);
    if (st) { bing_serp.cached.push({ query: q.query, key: q.key, source: 'this week', read_at: S0(st.at), location_code: Number(st.loc) || loc.location_code, results: st.ours || [], results_scope: 'ours' }); continue; }
    bing_serp.candidates.push({ query: q.query, key: q.key, body: bodyOf(q.query) }); }
  // ---- LLM Mentions, once a month ----
  const ym = nowIso.slice(0, 7); const mKey = AIRF.mentionsKey(sid, ym); const mRow = cacheOf(mKey);
  const kws = []; for (const r of qs) { const kw = S0((promptById.get(S0(r.prompt_id)) || {}).keyword).toLowerCase(); if (kw && !kws.includes(kw)) kws.push(kw); }
  for (const k of listOf(siteRow.keywords)) { const kw = k.toLowerCase(); if (kw && !kws.includes(kw)) kws.push(kw); }
  const mentions = { key: mKey, month: ym, due: false, stored: mRow ? P(mRow.value, null) : null, keywords: kws.slice(0, AIRC.mentions_keywords), why: '' };
  if (!rank.mentions) mentions.why = 'ai_rank_mentions is off';
  else if (mentions.stored) mentions.why = 'read this month already (' + S0((mentions.stored || {}).at).slice(0, 10) + '): reused, $0';
  else if (!loc) mentions.why = 'no market on file';
  else if (!mentions.keywords.length) mentions.why = 'no keyword on file to ask the AI-answer database about';
  else mentions.due = true;
  // ---- Bing Webmaster stats, once a week ----
  const site = bingList ? (bingList.find(s => rawHost(s.Url) === host) || bingList.find(s => rawHost(s.Url).replace(/^www\./, '') === dom)) : null;
  const bing = { due: false, site_url: site ? S0(site.Url) : '', stored: week && week.bing_stats ? week.bing_stats : null, query_pages: queries.slice(0, AIRC.bing_query_pages).map(q => q.query), why: '' };
  if (!BING_ON) bing.why = 'no Bing Webmaster key (SEO_BING_WEBMASTER_API_KEY)';
  else if (!bingList) bing.why = 'Bing\'s site list was not read this run';
  else if (!site) bing.why = 'the website is not in this Bing Webmaster account';
  else if (usedOf('bing_calls') >= 1 || bing.stored) bing.why = 'read this week already: reused';
  else bing.due = true;
  // ---- Common Crawl, every 28 days ----
  const ccRow = cacheOf(ccKey(sid)); const ccStored = ccRow ? P(ccRow.value, null) : null;
  const cc = { key: ccKey(sid), due: !(ccStored && ccStored.at && nowMs - Date.parse(ccStored.at) < AIRC.cc_every_days * DAY), stored: ccStored, domain: dom };
  // ---- Brave, with the key and the flag only ----
  const brave = { read: [], cached: [], why: '' };
  if (!BRAVE_ON) brave.why = 'no Brave Search key (SEO_BRAVE_API_KEY): Brave is never called';
  else if (!rank.brave) brave.why = 'ai_rank_brave is off';
  else { const left = Math.max(0, AIRC.brave_week_max - usedOf('brave'));
    for (const q of queries) { const st = readOf('brave', q.key); if (st) { brave.cached.push({ query: q.query, key: q.key, read_at: S0(st.at), results: st.ours || [], results_scope: 'ours' }); continue; }
      if (brave.read.length < left) brave.read.push({ query: q.query, key: q.key }); } }
  // the per-site ceiling of one run: the planned paid reads never pass it (the Bing results pages are counted at their whole budget)
  const est = google.read.length * AIRC.price.serp + bing_serp.budget * AIRC.price.serp + (mentions.due ? AIRC.price.mentions_pages + AIRC.price.mentions_metrics : 0);
  if (est > AIRC.site_usd_max) { const keep = Math.max(0, Math.floor((AIRC.site_usd_max - (mentions.due ? AIRC.price.mentions_pages + AIRC.price.mentions_metrics : 0)) / AIRC.price.serp));
    google.read = google.read.slice(0, keep); bing_serp.budget = Math.max(0, Math.min(bing_serp.budget, keep - google.read.length)); why.push('capped at $' + AIRC.site_usd_max + ' of planned paid reads for this run'); }
  out.push({ json: { site_id: sid, domain: dom, site_host: host, run_id: S0(g.run_id), mode: rank.mode, loc, engines, week_key: weekKey(sid, wk), week: week, month_key: mKey,
    queries: queries.map(q => ({ query: q.query, key: q.key, n: q.n, questions: q.questions.slice(0, 5) })), queries_basis: qBasis, google, bing_serp, mentions, bing, cc, brave,
    our_hosts: [...new Set([dom, 'www.' + dom, host].filter(Boolean))], why } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website to read for' } }];
