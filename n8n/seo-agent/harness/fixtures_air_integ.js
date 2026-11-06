// AIR P5 fixtures (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §6.6, CONTRACTS.md §6): synthetic answers of the outside services AIR reads,
// and a runner of the GENERATED AI Growth workflow on fixtures_air with those answers. PUBLIC REPO: synthetic only (`.example` hosts, plus
// g2.com / clutch.co as directory hosts). The SHAPES are the providers' own:
//   * DataForSEO LLM Mentions top_mentioned_pages / target_metrics: the free sandbox (sandbox.dataforseo.com, probed 2026-11-06 from a container,
//     no credential printed): result[0].items[] { page, location, language, platform: [{ key, mentions, ai_search_volume }], sources_domain, ...,
//     total: { mentions, ai_search_volume } }, result[0].aggregated_metrics.total; the sandbox does NOT validate request fields (CLAUDE.md);
//   * DataForSEO serp/{google,bing}/organic/live/advanced: the sandbox (result[0] { keyword, datetime, items: [{ type, rank_group, url, domain }] });
//   * Bing Webmaster GetQueryStats / GetPageStats / GetCrawlStats: one free live call 2026-11-06 (types only: { d: [{ AvgClickPosition,
//     AvgImpressionPosition, Clicks, Date: '/Date(ms)/', Impressions, Query }] }; positions are plain ranks, -1 when no click; weekly buckets);
//     GetCrawlIssues / GetQueryPageStats answered empty lists live, so their item fields follow Microsoft's documentation (needs one live call);
//   * Common Crawl CDX: one free live call 2026-11-06 (collinfo.json newest first; NDJSON lines; 404 {"message": "No Captures found for: ..."});
//   * Brave Search: its documentation (web.results[] { title, url, description }); no key was available (needs one live call).
// runOn(sites, opt) -> { r (air_graph_exec result), F, calls, counts, last(node), fetched }  sites: { nova|acme: { mode, fanout_n, mentions, brave, engines } }
//   opt: { braveKey: bool (a build WITH the Brave key: the generated BRAVE_ON is turned true in a copy), tables (start tables), http (override),
//          cc: 'ok' | 'none' | 'error', bingSites: [url], dupTask: bool (two results pages answer with one task id), wf }
const fs = require('fs'); const path = require('path');
const { exec } = require('./air_graph_exec');
const FX = require('./fixtures_air');
const WF_DIR = path.join(__dirname, '..', 'workflows');
const readWf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WF_DIR, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const hostOf = (u) => String(u).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').toLowerCase().replace(/^www\./, '');
const fnv = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + (h >>> 0).toString(16)).slice(-8); };
const SITE = { nova: 'site_nova-ai-example', acme: 'site_acme-erp-example' };

// ---- the answers ----
const dfsEnvelope = (endpoint, body, result, cost, id) => ({ version: '0.1.20251101', status_code: 20000, status_message: 'Ok.', time: '0.4 sec.', cost, tasks_count: 1, tasks_error: 0,
  tasks: [{ id: id || ('fx-' + fnv(endpoint + JSON.stringify(body))), status_code: 20000, status_message: 'Ok.', time: '0.3 sec.', cost, result_count: 1, path: endpoint.split('/v3/')[1].split('/'), data: (body || [])[0] || {}, result }] });
const mentionsPages = () => [{ total_count: 5, offset: 0, items_count: 5, aggregated_metrics: { total: { mentions: 310, ai_search_volume: 5200 } }, items: [
  { page: 'https://top-software-firms.example/best-custom-software-companies-uae?utm_source=chatgpt.com', location: [{ key: 2784, mentions: 40, ai_search_volume: 900 }], language: [{ key: 'en', mentions: 40, ai_search_volume: 900 }], platform: [{ key: 'google', mentions: 40, ai_search_volume: 900 }], total: { mentions: 40, ai_search_volume: 900 } },
  { page: 'https://top-software-firms.example/best-custom-software-companies-uae', platform: [{ key: 'google', mentions: 12, ai_search_volume: 300 }], total: { mentions: 12, ai_search_volume: 300 } },
  { page: 'https://www.g2.com/categories/custom-software-development', platform: [{ key: 'google', mentions: 25, ai_search_volume: 700 }], total: { mentions: 25, ai_search_volume: 700 } },
  { page: 'https://uae-tech-review.example/top-ai-development-firms-2026', platform: [{ key: 'google', mentions: 9, ai_search_volume: 210 }], total: { mentions: 9, ai_search_volume: 210 } },   // cited by no answer of the panel
  { page: 'https://nova-ai.example/services/custom-software', platform: [{ key: 'google', mentions: 2, ai_search_volume: 40 }], total: { mentions: 2, ai_search_volume: 40 } }] }];
const targetMetrics = () => [{ total_count: 0, offset: 0, items_count: 0, aggregated_metrics: { total: { mentions: 3, ai_search_volume: 55 } }, items: [] }];
const serpResult = (engine, kw, ours) => { const others = ['https://rival-one.example/', 'https://top-software-firms.example/best-custom-software-companies-uae', 'https://www.g2.com/categories/custom-software-development', 'https://clutch.co/ae/developers/dubai', 'https://bigsoft.example/services'];
  const items = []; let pos = 1; for (const u of others) { if (ours && pos === ours.pos) items.push({ type: 'organic', rank_group: pos, rank_absolute: pos, url: ours.url, domain: hostOf(ours.url), title: 'Ours' }), pos++; items.push({ type: 'organic', rank_group: pos, rank_absolute: pos, url: u, domain: hostOf(u), title: 'Result ' + pos }); pos++; }
  return [{ keyword: kw, type: 'organic', se_domain: engine === 'bing' ? 'bing.com' : 'google.ae', location_code: 2784, language_code: 'en', datetime: '2026-11-02 10:00:05 +00:00', item_types: ['organic'], se_results_count: 1000, items_count: items.length, items }]; };
const msD = (iso) => '/Date(' + Date.parse(iso) + ')/';
const bingQueryStats = () => ({ d: [
  { __type: 'QueryStats:#Microsoft.Bing.Webmaster.Api', AvgClickPosition: -1, AvgImpressionPosition: 6, Clicks: 0, Date: msD('2026-10-26T00:00:00Z'), Impressions: 10, Query: 'custom software development dubai 2026' },
  { __type: 'QueryStats:#Microsoft.Bing.Webmaster.Api', AvgClickPosition: -1, AvgImpressionPosition: 9, Clicks: 0, Date: msD('2026-10-19T00:00:00Z'), Impressions: 30, Query: 'custom software development dubai 2026' },
  { __type: 'QueryStats:#Microsoft.Bing.Webmaster.Api', AvgClickPosition: 2, AvgImpressionPosition: 3, Clicks: 1, Date: msD('2026-08-01T00:00:00Z'), Impressions: 50, Query: 'nova ai' }] });   // outside the 35-day window
const bingPageStats = () => ({ d: [{ __type: 'QueryStats:#Microsoft.Bing.Webmaster.Api', AvgClickPosition: -1, AvgImpressionPosition: 8, Clicks: 0, Date: msD('2026-10-26T00:00:00Z'), Impressions: 40, Query: 'https://nova-ai.example/services/custom-software' }] });
const bingCrawlIssues = () => ({ d: [{ Url: 'https://nova-ai.example/old-page', HttpCode: 404, InLinks: 2, Issues: 4 }, { Url: 'https://nova-ai.example/private', HttpCode: 200, InLinks: 0, Issues: 16 }] });
const bingCrawlStats = () => ({ d: [{ Date: msD('2026-10-31T00:00:00Z'), AllOtherCodes: 0, BlockedByRobotsTxt: 1, Code2xx: 9, Code301: 0, Code302: 0, Code4xx: 1, Code5xx: 0, ConnectionTimeout: 0, ContainsMalware: 0, CrawlErrors: 1, CrawledPages: 11, DnsFailures: 0, InIndex: 6, InLinks: 14 },
  { Date: msD('2026-10-24T00:00:00Z'), AllOtherCodes: 0, BlockedByRobotsTxt: 0, Code2xx: 5, Code301: 0, Code302: 0, Code4xx: 0, Code5xx: 0, ConnectionTimeout: 0, ContainsMalware: 0, CrawlErrors: 0, CrawledPages: 5, DnsFailures: 0, InIndex: 5, InLinks: 12 }] });
const ccCollections = () => [{ id: 'CC-MAIN-2026-43', name: 'October 2026 Index', 'cdx-api': 'https://index.commoncrawl.org/CC-MAIN-2026-43-index', from: '2026-10-05T10:56:23', to: '2026-10-18T05:34:47' }, { id: 'CC-MAIN-2026-38', name: 'September 2026 Index' }];
const braveAnswer = (q) => ({ type: 'search', query: { original: q }, web: { type: 'search', results: [
  { title: 'Best list', url: 'https://top-software-firms.example/best-custom-software-companies-uae', description: '' },
  { title: 'Nova AI', url: 'https://nova-ai.example/services/custom-software', description: '' },
  { title: 'Rival', url: 'https://rival-one.example/', description: '' }] } });

// the outside world of one run; every request logged as "<node> <METHOD> <url>"
function responder(F, o, calls) {
  const bingSites = o.bingSites || [...F.bing.sites, 'https://nova-ai.example/'];
  return (node, req) => {
    const u = String(req.url || ''); calls.push(node + ' ' + req.method + ' ' + u);
    if (typeof o.http === 'function') { const r = o.http(node, req); if (r !== undefined) return r; }
    if (/api\.anthropic\.com\/v1\/messages\/count_tokens/.test(u)) return { input_tokens: 1000 };
    if (/api\.dataforseo\.com\/v3\/appendix\/user_data/.test(u)) return { status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance: 25 } }] }] };
    if (/llm_mentions\/top_mentioned_pages/.test(u)) return dfsEnvelope(u, req.body, mentionsPages(), 0.15);
    if (/llm_mentions\/target_metrics/.test(u)) return dfsEnvelope(u, req.body, targetMetrics(), 0.101);
    if (/serp\/(google|bing)\/organic\/live\/advanced/.test(u)) { const engine = /serp\/bing/.test(u) ? 'bing' : 'google'; const kw = String((((req.body || [])[0]) || {}).keyword || '');
      const ours = /custom software/.test(kw) ? { url: 'https://nova-ai.example/services/custom-software', pos: engine === 'bing' ? 4 : 3 } : null;
      return dfsEnvelope(u, req.body, serpResult(engine, kw, ours), 0.002, o.dupTask ? 'fx-dup-task' : null); }
    if (/bing\.com\/webmaster\/api\.svc/i.test(u)) {
      if (/GetUserSites/i.test(u)) return { d: bingSites.map(s => ({ Url: s, IsVerified: true })) };
      if (/GetQueryStats/i.test(u)) return bingQueryStats(); if (/GetPageStats/i.test(u)) return bingPageStats();
      if (/GetCrawlIssues/i.test(u)) return bingCrawlIssues(); if (/GetCrawlStats/i.test(u)) return bingCrawlStats();
      if (/GetQueryPageStats/i.test(u)) return { d: [] };
      if (/GetUrlSubmissionQuota/i.test(u)) return { d: { DailyQuota: 10, MonthlyQuota: 300 } };
      if (/GetUrlInfo/i.test(u)) return { d: { Url: '', HttpStatus: 0, LastCrawledDate: '/Date(-62135596800000)/' } };
      return { d: null }; }
    if (/index\.commoncrawl\.org\/collinfo\.json/.test(u)) return ccCollections();
    if (/index\.commoncrawl\.org\/CC-MAIN-[\d-]+-index/.test(u)) {
      if (o.cc === 'none') return { statusCode: 404, headers: { 'content-type': 'application/json' }, data: '{"message": "No Captures found for: nova-ai.example"}' };
      if (o.cc === 'error') return { statusCode: 503, headers: {}, data: 'Service Unavailable' };
      return { statusCode: 200, headers: { 'content-type': 'text/x-ndjson' }, data: '{"url": "https://nova-ai.example/", "status": "200"}\n{"url": "https://nova-ai.example/services/custom-software", "status": "200"}\n{"url": "https://www.nova-ai.example/", "status": "301"}\n' }; }
    if (/api\.search\.brave\.com/.test(u)) { const m = u.match(/[?&]q=([^&]+)/); return braveAnswer(m ? decodeURIComponent(m[1]) : ''); }
    if (/serpapi\.com|generativelanguage\.googleapis\.com/i.test(u)) throw new Error('forbidden host called: ' + u);
    if (/wikidata\.org/.test(u)) return /wbsearchentities/.test(u) ? { search: [] } : { query: { search: [] } };
    if (/\/robots\.txt$/i.test(u)) { const t = F.robots[hostOf(u)]; return req.text ? { statusCode: t ? 200 : 404, headers: {}, data: t || '' } : {}; }
    const p = F.pages[u] || F.pages[u.replace(/\/$/, '')] || F.pages[u + '/'];
    if (p) return req.text ? { statusCode: p.status, headers: { 'content-type': 'text/html' }, data: p.html } : {};
    if (req.method === 'POST') return req.text ? { statusCode: 200, headers: {}, data: '' } : {};
    return req.text ? { statusCode: 404, headers: {}, data: '' } : {};
  };
}

// a copy of the generated workflow built as if SEO_BRAVE_API_KEY were set (the baked flag turned true in the planner and the six request nodes), or exactly as generated
function withBraveKey(wf, on) { const w = clone(wf); let n = 0;
  for (const nd of w.nodes) { const js = (nd.parameters || {}).jsCode; if (!js || !/const BRAVE_ON = (true|false);/.test(js)) continue; nd.parameters.jsCode = js.replace(/const BRAVE_ON = (true|false);/, 'const BRAVE_ON = ' + (on ? 'true' : 'false') + ';'); n++; }
  if (n !== 7) throw new Error('withBraveKey: expected the flag in 7 nodes (the planner and the six request nodes), found ' + n); return w; }

async function runOn(sites, opt) {
  const o = opt || {}; const F = FX.make({ seed: 'air-golden', modes: { nova: (sites.nova || {}).mode || '', acme: (sites.acme || {}).mode || 'off' } });
  const tables = o.tables ? clone(o.tables) : clone(F.tables);
  for (const [k, s] of Object.entries(sites)) { const m = tables.seo_monitors.find(x => x.site_id === SITE[k]); if (!m) continue;
    if (s.mode !== undefined) m.ai_rank_mode = s.mode || null; if (s.fanout_n !== undefined) m.ai_rank_fanout_n = s.fanout_n; if (s.mentions !== undefined) m.ai_rank_mentions = s.mentions;
    if (s.brave !== undefined) m.ai_rank_brave = s.brave; if (s.engines !== undefined) m.ai_engines = s.engines; }
  for (const [t, rows] of Object.entries(o.extra || {})) tables[t] = [...(tables[t] || []), ...clone(rows)];
  const base = o.wf || readWf('SEO_Agent_AI_Growth.json'); const wf = o.braveKey === undefined ? base : withBraveKey(base, !!o.braveKey);
  const calls = [];
  const r = await exec({ wf, trigger: {}, tables, http: responder(F, o, calls), agent: (node, item) => ({ drafts: ((item && item.jobs) || []).map(j => ({ n: j.n, subject: 'Synthetic subject ' + j.n, body: 'Synthetic draft. [Your name]' })) }),
    now: o.now || F.nowMs, seed: 'air-golden', execId: o.execId || 'air-integ-1' });
  const last = (n) => { const x = r.runs[n]; return x && x.length ? x[x.length - 1][0] || [] : null; };
  const counts = {}; for (const n of r.order) counts[n] = (counts[n] || 0) + 1;
  const fetched = (last('AI Rank Fetched') || []).map(i => i.json).filter(j => j && j.site_id);
  return { r, F, calls, counts, last, fetched, wf };
}
module.exports = { runOn, readWf, withBraveKey, clone, SITE, responder, mentionsPages, targetMetrics, serpResult, bingQueryStats, ccCollections, braveAnswer };
