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
// ---- AIRF: the AI-ranking algorithm's settings, kill switch, ids and shared vocabulary (inlined by build_monitors.py through its marker) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §4.1, frozen in CONTRACTS.md §2-§3). Written by W0 and FROZEN: the packages read it,
// none changes it (a change is a contract change: CONTRACTS.md first, then this file, then every caller). Pure: no node access, no clock, no
// network; n8n sandbox rules (no URL constructor, no Object.defineProperty / setPrototypeOf, no structuredClone).
// Every setting is OFF when empty: a site without the columns, or with them empty, runs exactly as before AIR.
const AIRF = (() => {
  const VERSION = 'air-flags-1';
  const RULE_VERSION = 'air-1';   // the rule AIR's rows are written under (seo_ai_rank_* .rule_version); bump it when a counting rule changes
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
  // the compact form of one item: enough for every reader of this codebase (organic order and owners, page titles, PAA, related searches,
  // forum threads, the featured snippet, the AI Overview and its cited sources, which features were on the page), nothing else
  const compactItem = (x) => {
    const t = S(x && x.type); const o = { type: t, rank_group: Number(x.rank_group) || null, rank_absolute: Number(x.rank_absolute) || null };
    if (t === 'organic') { o.url = cut(x.url, 300); o.domain = cut(x.domain, 100); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description, CFG.desc_len); return o; }
    if (t === 'people_also_ask') { o.items = (x.items || []).slice(0, 10).map(q => ({ title: cut(q && (q.title || q.question), 200) })).filter(q => q.title); return o; }
    if (t === 'related_searches') { o.items = (x.items || []).slice(0, 12).map(q => cut(typeof q === 'string' ? q : (q && (q.title || q.keyword)), 120)).filter(Boolean); return o; }
    if (t === 'discussions_and_forums') { o.items = (x.items || []).slice(0, 6).map(q => ({ title: cut(q && q.title, CFG.title_len), domain: cut(q && (q.domain || q.source), 80), url: cut(q && q.url, 240) })); return o; }
    if (t === 'featured_snippet') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); o.description = cut(x.description || x.text, 400); return o; }
    if (t === 'ai_overview') {
      o.asynchronous_ai_overview = x.asynchronous_ai_overview === true;
      o.references = (x.references || []).slice(0, 12).map(ref);
      let left = CFG.aio_text_len;
      o.items = (x.items || []).slice(0, 8).map(y => { const tx = cut(y && (y.text || y.markdown), Math.max(0, left)); left -= tx.length;
        return { title: cut(y && y.title, CFG.title_len), text: tx, references: ((y && y.references) || []).slice(0, 6).map(ref) }; });
      return o;
    }
    if (t === 'local_pack' || t === 'map') { o.domain = cut(x.domain, 100); o.url = cut(x.url, 300); o.title = cut(x.title, CFG.title_len); return o; }
    return o;
  };
  // a fresh answer -> the reading to store (null when it is not a reading: a failed read is never stored)
  const reading = (res, body, opts) => {
    const st = status(res); if (st === 'failed') return null;
    const o = opts || {}; const t = task0(res); const r0 = ((t.result || [])[0]) || {};
    const b = body || (t.data || {}); const id = ident({ ...(t.data || {}), ...b }); const nd = need(b);
    const at = isoOf(r0.datetime) || isoOf(o.now) || new Date().toISOString();
    const items = Array.isArray(r0.items) ? r0.items : [];
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
const M = pair('AI Rank Mention Requests', 'AI Rank Mentions Call Answers');
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
const R = pair('AI Rank SERP Requests', 'AI Rank SERP Call Answers');
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
