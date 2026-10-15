/*__REACH__*/
// Keyword Check: reads the DataForSEO answers. The keyword overview is required (no answer -> 502); the position and the reach degrade gracefully
// (position unknown -> null; reach calls failed -> the stored or default reach, not stored). Business context for the topic check: the request,
// else the stored homepage description (seo_cache 'desc:<domain>', 30 days).
const v = $('Assess Validate').first().json;
const reqs = $('Assess Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const answer = (kind) => { const i = reqs.findIndex(r => r.kind === kind); return i >= 0 ? res[i] : undefined; };
const dfs_cost = +res.reduce((s, x) => s + (x && Array.isArray(x.tasks) ? x.tasks.reduce((a, t) => a + (Number(t && t.cost) || 0), 0) : 0), 0).toFixed(4);
const ov = answer('overview');
if (!reachTaskOk(ov)) return [{ json: { ok: false, error: 'DataForSEO keyword overview failed: ' + reachError(ov), dfs_cost } }];
const it = ((((ov.tasks[0].result || [])[0]) || {}).items || [])[0] || null;
const info = (it && it.keyword_info) || {}, props = (it && it.keyword_properties) || {};
const pr = answer('position');
let position = null, position_url = null;
if (reachTaskOk(pr)) { const best = ((((pr.tasks[0].result || [])[0]) || {}).items || []).map(x => ((x || {}).ranked_serp_element || {}).serp_item || {}).filter(x => x.rank_group).sort((a, b) => a.rank_group - b.rank_group)[0]; if (best) { position = best.rank_group; position_url = best.url || null; } }
let rows = []; try { rows = $('Load Assess Cache').all().map(i => i.json).filter(r => r && !r.error); } catch (e) { rows = []; }
// B1-2 (2026-10-15, benchmark area 1): the keywords the reach was measured on travel with it, from this run's pull or from the stored
// row, so the answer can measure the difficulty on the TOPIC of the keyword that was asked about instead of only across the whole site.
let reach_info = reachCached(rows, v.domain, v.location_code), cache_row = null, reach_errors = [];
if (!reach_info) {
  const rq = reqs.filter(r => String(r.kind).startsWith('reach_'));
  const parsed = reachParse(rq, rq.map(r => answer(r.kind)));
  reach_info = { ...reachFrom(parsed.ranked, parsed.authority), ranked: parsed.ranked }; reach_errors = parsed.errors;
  if (reach_info.method !== 'default') cache_row = reachCacheRow(v.domain, reach_info, v.location_code, parsed.ranked);
}
let desc = null; const drow = rows.find(r => r.key === 'desc:' + v.domain);
try { desc = drow && (Date.now() - new Date(drow.updated_at).getTime()) < 30 * 864e5 ? (JSON.parse(drow.value).description || null) : null; } catch (e) { desc = null; }
const business = v.business || (desc && desc.business_description) || '';
// D22 (2026-10-11): the stored description now covers the homepage AND the site's menu pages, so the topic check sees the full service list
// ("business central partner uae" scored fit 1 live while Business Central was on /whatwedo/). `pages_read` marks such a row; a row written
// before that change is homepage-only and the answer says so (Assess Response).
const descPages = (desc && Array.isArray(desc.pages_read) ? desc.pages_read.length : 0);
const services = v.services.length ? v.services : ((desc && desc.products_or_services) || []).map(String).slice(0, 20);
const services_source = v.services.length ? 'request' : (desc ? (descPages > 1 ? 'stored description (' + descPages + ' pages read)' : 'stored description (homepage only)') : 'none');
return [{ json: { ok: true, keyword: v.keyword, domain: v.domain, country: v.country, location_code: v.location_code, language_code: v.language_code,
  volume: info.search_volume ?? null, kd: props.keyword_difficulty ?? null, cpc: info.cpc ?? null, intent: (it && (it.search_intent_info || {}).main_intent) || null, known: !!it,
  position, position_url, reach_info, reach_errors, cache_row, dfs_cost, business, services, services_source, existing_keywords: v.existing_keywords,
  business_source: v.business ? 'request' : (desc ? 'stored description' : 'none') } }];
