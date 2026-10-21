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
const BODY = (j) => ((Array.isArray(j.body) ? j.body[0] : j.body) || {});
// KW-SERP: only the requests whose results page was NOT read today (deep enough, AI Overview when asked) go to DataForSEO;
// when every one was, one item takes the other branch and nothing is bought.
const all = $('SERP Cache Keys (Tracker)').all().map(i => i.json);
const rows = $input.all().map(i => i.json).filter(r => r && r.key);
const misses = all.filter(j => !SC.lookup(rows, BODY(j)).hit);
if (!misses.length) return [{ json: { serp_cache_all_read: true, read_today: all.length } }];
return misses.map(j => ({ json: j }));