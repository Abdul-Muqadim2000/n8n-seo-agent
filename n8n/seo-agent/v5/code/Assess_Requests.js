/*__REACH__*/
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
reqs.push({ kind: 'serp', label: 'results page for "' + v.keyword + '"', endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
  body: [{ keyword: v.keyword, location_code: v.location_code, language_code: v.language_code || 'en', depth: 10 }] });
return reqs.map(r => ({ json: r }));
