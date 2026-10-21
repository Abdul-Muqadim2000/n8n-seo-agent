/*__REACH__*/
/*__SERP_CACHE__*/
// Keyword Check: the DataForSEO Labs calls, sent in parallel (one HTTP node, no batching): the keyword overview (volume, difficulty, intent, CPC),
// the site's position for this exact keyword (ranked_keywords filtered on it), and — only when no reach is stored for this site and market
// (30 days) — the two calls that measure the site's reach; and the keyword's own results page (E-SERP, below).
const v = $('Assess Validate').first().json;
let rows = []; try { rows = $('Load Assess Cache').all().map(i => i.json).filter(r => r && !r.error); } catch (e) { rows = []; }
const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/';
const reqs = [
  { kind: 'overview', label: 'keyword overview', endpoint: L + 'keyword_overview/live', body: [{ keywords: [v.keyword], location_code: v.location_code, language_code: v.language_code }] },
  { kind: 'position', label: 'position of ' + v.domain, endpoint: L + 'ranked_keywords/live', body: [{ target: v.domain, location_code: v.location_code, language_code: v.language_code, limit: 10, filters: [['keyword_data.keyword', '=', v.keyword]] }] }
];
if (!reachCached(rows, v.domain, v.location_code)) reqs.push(...reachRequests(v.domain, v.location_code, v.language_code));
// E-SERP (2026-10-21, pre-launch run RV-11): ONE organic results page for the keyword, the same request the ladder's head read sends (keyword,
// location, language, depth 10; ~$0.002), so the career rule (fitCareer: job boards, courses, "salary" questions) and what Google ranks decide
// this check exactly as they decide the ladder head and the research. "ai consultant" (upwork, usaii, indeed, bayt, glassdoor) was a fit and
// Easy here while the ladder refused it. Sent last, through the same call, so the in-200 retry gate and the cost by task id cover it.
// KW-SERP (RV-12, 2026-10-21): ONE reading of a results page per search and day, shared with the research, the ladder and the rank tracker
// (v5/code/_serp_cache.js, seo_cache `serp:<keyword>|<location>|<language>|<device>`). A reading made earlier today, at least 30 results
// deep with the AI Overview, is used as it is (cost 0) and travels on the first request item for Assess Result; otherwise the page is bought as before.
// KW-SERP (owner decision 2026-10-21): every path asks Google the SAME way - 30 deep with the AI Overview loaded, the head's request -
// so whichever path reads a search first, every other path gets the same answer that day ($0.006 measured for this shape, fa3_live).
const serpBody = { keyword: v.keyword, location_code: v.location_code, language_code: v.language_code || 'en', depth: 30, load_async_ai_overview: true };
const serpHit = SC.lookup(rows, serpBody);
if (serpHit.hit) reqs[0].serp_cached = serpHit.response;
else reqs.push({ kind: 'serp', label: 'results page for "' + v.keyword + '"', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: [serpBody] });
return reqs.map(r => ({ json: r }));
