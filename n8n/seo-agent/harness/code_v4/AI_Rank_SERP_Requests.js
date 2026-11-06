// AIR integrations: the requests of one call node (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.I / §6.6, CONTRACTS.md §6, package P5).
// One source for the six request nodes of the AIR read chain; ai_rank_requests_wiring.py bakes which one this node is (CALL below). Each reads
// the plan of *AI Rank Requests* (one item per site in mode `on`; nothing for a site in shadow or off) and returns the requests of its call, or
// [{ skip: true, reason }] so its IF sends nothing and the chain goes on:
//   mentions  DataForSEO LLM Mentions: top_mentioned_pages (the pages AI answers cite for the site's topic keywords) + target_metrics (the
//             client's own mention count); paid, `ai_rank_mentions`, once a month          -> AI Rank Mentions Call (in-200 gate, no node retry)
//   bing      Bing Webmaster stats: GetQueryStats, GetPageStats, GetCrawlIssues, GetCrawlStats + GetQueryPageStats for the top searches;
//             free, the existing key, once a week                                           -> AI Rank Bing Call (retry rule)
//   serp      DataForSEO results pages, Google (planned) and Bing (only for searches Bing Webmaster gave no position for this run, within the
//             week's budget); one request per search, location and engine, shared by the sites that need it  -> AI Rank SERP Call (in-200 gate)
//   cc        Common Crawl's list of crawls (one free GET when a site is due)                 -> AI Rank CC Collections
//   cc_index  the site's captures in the newest crawl (free, public)                          -> AI Rank CC Index Call
//   brave     Brave Search web results (`ai_rank_brave` + the key, built in only with the key)  -> AI Rank Brave Call
// Nothing here is paid unless the planner put it there, and the planner plans only for a site where AIRF.mayPay is true.
const CALL = "serp";
const BRAVE_ON = false;   // baked by ai_rank_requests_wiring.py: true only when SEO_BRAVE_API_KEY is set in n8n/.env
const API = 'https://api.dataforseo.com/v3/', BING_API = 'https://ssl.bing.com/webmaster/api.svc/json/', CC_INDEX = 'https://index.commoncrawl.org/',
  BRAVE_API = 'https://api.search.brave.com/res/v1/web/search';
const PRICE = { serp: 0.002, mentions_pages: 0.15, mentions_metrics: 0.101 };   // planning figures only (the ledger reads each task's reported cost)
// the countries Brave's `country` parameter accepts (Brave Search API docs, 2026-11); any other market is searched with country=ALL
const BRAVE_CC = new Set('AR AU AT BE BR CA CL DK FI FR DE HK IN ID IT JP KR MY MX NL NZ NO CN PL PT PH RU SA ZA ES SE CH TW TR GB US'.split(' '));
const S0 = (v) => (v == null ? '' : String(v)).trim();
const tryAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const plans = tryAll('AI Rank Requests').filter(p => p && p.site_id && !p.skip && !p.error);
const skip = (reason) => [{ json: { skip: true, call: CALL, reason } }];
if (!plans.length) return skip('no website in mode on');
const out = [];
const enc = (s) => encodeURIComponent(S0(s));
const normKw = (k) => { let s = S0(k); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/\s+/g, ' ').trim(); };   // as _serp_cache.js

if (CALL === 'mentions') {
  for (const p of plans) { const m = p.mentions || {}; if (!m.due || !p.loc) continue;
    const loc = { location_code: p.loc.location_code, language_code: p.loc.language_code };
    out.push({ json: { site_id: p.site_id, kind: 'pages', endpoint: API + 'ai_optimization/llm_mentions/top_mentioned_pages/live',
      body: [{ target: (m.keywords || []).map(k => ({ keyword: S0(k).slice(0, 250), search_scope: ['answer'] })), ...loc, platform: 'google', limit: 50 }], est_cost: PRICE.mentions_pages } });
    out.push({ json: { site_id: p.site_id, kind: 'metrics', endpoint: API + 'ai_optimization/llm_mentions/target_metrics/live',
      body: [{ target: [{ domain: S0(p.domain) }], ...loc, platform: 'google' }], est_cost: PRICE.mentions_metrics } }); }
  return out.length ? out : skip('no LLM Mentions read is due this month');
}

if (CALL === 'bing') {
  for (const p of plans) { const b = p.bing || {}; if (!b.due || !b.site_url) continue;
    const base = (m) => BING_API + m + '?siteUrl=' + enc(b.site_url);
    for (const [kind, m] of [['query_stats', 'GetQueryStats'], ['page_stats', 'GetPageStats'], ['crawl_issues', 'GetCrawlIssues'], ['crawl_stats', 'GetCrawlStats']]) out.push({ json: { site_id: p.site_id, kind, url: base(m) } });
    for (const q of (b.query_pages || [])) out.push({ json: { site_id: p.site_id, kind: 'query_pages', query: normKw(q), url: base('GetQueryPageStats') + '&query=' + enc(q) } }); }
  return out.length ? out : skip('no Bing Webmaster read is due');
}

if (CALL === 'serp') {
  // Bing Webmaster's own positions of this run, per site: a search it already ranks the site for needs no Bing results page
  const bReq = tryAll('AI Rank Bing Requests').filter(r => r && !r.skip); const bAns = tryAll('AI Rank Bing Call');
  const bingHas = new Map();   // site_id -> Set(normalised query)
  const jsonOf = (r) => { if (!r || typeof r !== 'object') return {}; if (r.d !== undefined) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
  if (bReq.length === bAns.length) bReq.forEach((q, i) => { if (!['query_stats', 'query_pages'].includes(q.kind)) return; const d = jsonOf(bAns[i]).d; if (!Array.isArray(d)) return;
    const set = bingHas.get(q.site_id) || new Set(); for (const x of d) { const pos = Number(x && x.AvgImpressionPosition); if (!(pos > 0)) continue; set.add(q.kind === 'query_pages' ? q.query : normKw(x.Query)); } bingHas.set(q.site_id, set); });
  const byKey = new Map();
  const add = (p, engine, q) => { const k = engine + '|' + q.key + '|' + p.loc.location_code + '|' + p.loc.language_code; const x = byKey.get(k);
    if (x) { if (!x.site_ids.includes(p.site_id)) x.site_ids.push(p.site_id); return; }
    byKey.set(k, { site_id: p.site_id, site_ids: [p.site_id], engine, query: q.query, key: q.key,
      endpoint: API + (engine === 'bing' ? 'serp/bing/organic/live/advanced' : 'serp/google/organic/live/advanced'), body: [q.body], est_cost: PRICE.serp }); };
  for (const p of plans) { if (!p.loc) continue;
    for (const q of ((p.google || {}).read || [])) add(p, 'google', q);
    const bs = p.bing_serp || {}; let left = Number(bs.budget) || 0; const has = bingHas.get(p.site_id) || new Set();
    for (const q of (bs.candidates || [])) { if (left <= 0) break; if (has.has(q.key)) continue; add(p, 'bing', q); left--; } }
  const reqs = [...byKey.values()];
  return reqs.length ? reqs.map(j => ({ json: j })) : skip('no results page to read: none planned, or every search was read this week');
}

if (CALL === 'cc') {
  return plans.some(p => (p.cc || {}).due) ? [{ json: { url: CC_INDEX + 'collinfo.json' } }] : skip('Common Crawl was read in the last 28 days for every website');
}

if (CALL === 'cc_index') {
  // the newest crawl is the first entry of collinfo.json (verified 2026-11-06: CC-MAIN-2026-43 first)
  let crawl = ''; try { const r = $('AI Rank CC Collections').first().json || {}; const list = Array.isArray(r) ? r : Array.isArray(r.data) ? r.data : Array.isArray(r.body) ? r.body : Object.values(r).filter(x => x && typeof x === 'object' && x.id);
    crawl = S0((list[0] || {}).id); } catch (e) { crawl = ''; }
  if (!/^CC-MAIN-\d{4}-\d{2}$/.test(crawl)) return skip('Common Crawl\'s list of crawls could not be read');
  for (const p of plans) { if (!(p.cc || {}).due || !S0(p.domain)) continue;
    out.push({ json: { site_id: p.site_id, crawl, url: CC_INDEX + crawl + '-index?url=' + enc(p.domain) + '&matchType=domain&output=json&fl=url,status&limit=1000' } }); }
  return out.length ? out : skip('no website is due for a Common Crawl check');
}

if (CALL === 'brave') {
  if (!BRAVE_ON) return skip('no Brave Search key: Brave is never called');
  for (const p of plans) { const b = p.brave || {}; if (!(b.read || []).length) continue;
    const cc = S0((p.loc || {}).country_iso).toUpperCase();
    const country = BRAVE_CC.has(cc) ? cc : 'ALL'; const lang = S0((p.loc || {}).language_code || 'en').toLowerCase().slice(0, 2) || 'en';
    for (const q of b.read) out.push({ json: { site_id: p.site_id, query: q.query, key: q.key, url: BRAVE_API + '?q=' + enc(q.query) + '&count=20&country=' + country + '&search_lang=' + lang + '&safesearch=off' } }); }
  return out.length ? out : skip('no Brave search is due');
}
return skip('unknown call ' + CALL);
