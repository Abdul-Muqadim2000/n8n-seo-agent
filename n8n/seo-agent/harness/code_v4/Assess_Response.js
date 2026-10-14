// ---- reach (v4.8, PIPELINE_FEATURE_SPEC §5.3-5.5): the keyword difficulty this website can already win. ONE copy, inlined by the build into
// Ladder Plan, Reach (Discovery), Rank Keywords, Build Keyword Strategy and the Keyword Check workflow (SEOagentAssess), so they all agree.
//   reach      = the 75th-percentile difficulty of the keywords the site ranks top 10 for (at least 5 of them; linear interpolation), else by
//                size (keywords in the top 10: 0-4 -> 10, 5-49 -> 20, 50-499 -> 35, 500+ -> 50); the larger of the two when both exist.
//   difficulty = easy (kd <= reach + 5, or the site already ranks 1-20 for the keyword) · reachable (<= reach + 20) · hard (<= reach + 40) ·
//   for you      very hard (above) · not realistic (navigational / another company's brand / verdict AVOID); an unknown kd counts as reach + 10.
//   plan       = easy -> direct (2-4 months) · reachable -> short (4-8) · hard -> full (9-15) · very hard -> full, stretch · not realistic -> none;
//                strong sites (100+ top-10 keywords, 1,000+ ranking keywords, or already top 20 for it): direct 2-3, short 3-6, full 6-12.
//   cache      = seo_cache 'reach:<site_id>' for 30 days and the same market (value: reach, method, p75, size_reach, sample, top10,
//                organic_keywords, location_code); a reach that could not be measured (both calls failed) is never stored.
const REACH_CFG = { min_top10: 5, percentile: 0.75, ttl_days: 30, unknown_kd: 10, easy: 5, reachable: 20, hard: 40, easy_position: 20, sample: 100 };
const REACH_MONTHS = { direct: [2, 4], short: [4, 8], full: [9, 15] }, REACH_MONTHS_STRONG = { direct: [2, 3], short: [3, 6], full: [6, 12] };
const REACH_DIFF_LABEL = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const REACH_PLAN_LABEL = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
// G3 (2026-10-11): the evidence behind "months, not weeks" and an estimated chance per plan. Ahrefs 2025 (REACH_BASE_RATE.url): 1.74% of new
// pages reached Google's top 10 within a year, and 40.8% of those did so within a month (the 2017 figure, 5.7%, is no longer cited). The chance
// bands are judgement calls relative to that base rate (a keyword within the site's reach is far from a random new page) and are UNCALIBRATED
// until G17 fits them to this system's own ladders — every text that shows them says so. The same values live in app/shared/src/keywords.ts.
const REACH_BASE_RATE = { year: 2025, source: 'Ahrefs', top10_within_year_pct: 1.74, of_those_within_month_pct: 40.8, url: 'https://ahrefs.com/blog/how-long-does-it-take-to-rank/' };
const REACH_CHANCE = { direct: { band: 'good', range: [50, 70] }, short: { band: 'fair', range: [30, 50] }, full: { band: 'low', range: [15, 30] }, stretch: { band: 'slim', range: [5, 15] }, none: { band: 'none', range: [0, 0] } };
const REACH_CHANCE_NOTE = 'an uncalibrated estimate until this system has measured its own ladders';
// { band, range, label }: "estimated chance good (50-70%, uncalibrated)"; '' label for no plan
const reachChance = (plan_type, stretch) => { const c = REACH_CHANCE[plan_type === 'none' ? 'none' : (stretch ? 'stretch' : plan_type)] || REACH_CHANCE.full;
  return { band: c.band, range: c.range.slice(), label: c.band === 'none' ? '' : 'estimated chance ' + c.band + ' (' + c.range[0] + '-' + c.range[1] + '%, uncalibrated)' }; };
const reachBaseRateText = () => 'Base rate (' + REACH_BASE_RATE.source + ', ' + REACH_BASE_RATE.year + '): only ' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach Google\'s top 10 within a year, and ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those do so within a month — the rest take months.';
// the sentence under a plan's month range: the chance band, that it is uncalibrated, and the 2025 base rate it is judged against
const reachChanceText = (plan) => (plan && plan.chance && plan.chance.label) ? 'Estimated chance of reaching the top 10 within ' + plan.months + ' months: ' + plan.chance.band + ' (' + plan.chance.range[0] + '-' + plan.chance.range[1] + '%) — ' + REACH_CHANCE_NOTE + '. ' + reachBaseRateText() : '';
const reachDomain = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
const reachSiteId = (d) => 'site_' + reachDomain(d).replace(/[^a-z0-9]+/g, '-');
const reachKey = (d) => 'reach:' + reachSiteId(d);
const reachNum = (v) => (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v);
const reachSizeTier = (top10) => { const n = Number(top10) || 0; return n >= 500 ? 50 : n >= 50 ? 35 : n >= 5 ? 20 : 10; };
// ranked: [{ kd, position }] for the site (null = the call failed; only positions 1-10 count); authority: { top10, organic_keywords } (null = unknown)
function reachFrom(ranked, authority) {
  const top = (ranked || []).filter(r => { const p = reachNum(r && r.position); return p != null && p >= 1 && p <= 10; });
  const kds = top.map(r => reachNum(r.kd)).filter(v => v != null).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= REACH_CFG.min_top10) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const known = !!(authority && reachNum(authority.top10) != null);
  const top10 = known ? reachNum(authority.top10) : top.length;
  const size_reach = reachSizeTier(top10);
  const reach = p75 != null ? Math.max(p75, size_reach) : size_reach;
  const method = (!ranked && !known) ? 'default' : (p75 != null && p75 >= size_reach) ? 'percentile' : 'size';
  return { reach, method, p75, size_reach, sample: kds.length, top10, organic_keywords: authority && reachNum(authority.organic_keywords) != null ? reachNum(authority.organic_keywords) : null, cached: false };
}
// the stored reach of this site for this market, when it is younger than 30 days (null otherwise)
function reachCached(rows, domain, location_code) {
  const key = reachKey(domain);
  const row = (rows || []).filter(r => r && !r.error && r.key === key).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (!row) return null;
  let v = null; try { v = JSON.parse(row.value); } catch (e) { return null; }
  if (!v || reachNum(v.reach) == null) return null;
  if (reachNum(location_code) && reachNum(v.location_code) && Number(v.location_code) !== Number(location_code)) return null;
  const days = (Date.now() - new Date(row.updated_at).getTime()) / 864e5;
  if (!(days >= 0 && days < REACH_CFG.ttl_days)) return null;
  return { ...v, reach: Number(v.reach), cached: true, cached_at: String(row.updated_at) };
}
// the seo_cache row (exact columns) for a freshly measured reach
const reachCacheRow = (domain, info, location_code) => ({ key: reachKey(domain), kind: 'reach', site_id: reachSiteId(domain),
  value: JSON.stringify({ reach: info.reach, method: info.method, p75: info.p75, size_reach: info.size_reach, sample: info.sample, top10: info.top10, organic_keywords: info.organic_keywords, location_code: reachNum(location_code) }),
  updated_at: new Date().toISOString() });
// o: { position (the site's rank for the keyword), navigational, other_brand, verdict }
function difficultyForYou(kd, reach, o) {
  o = o || {};
  if (o.navigational || o.other_brand || String(o.verdict || '').toUpperCase() === 'AVOID') return 'not_realistic';
  const pos = reachNum(o.position);
  if (pos != null && pos >= 1 && pos <= REACH_CFG.easy_position) return 'easy';
  const r = reachNum(reach) == null ? reachSizeTier(0) : Number(reach);
  const k = reachNum(kd) == null ? r + REACH_CFG.unknown_kd : Number(kd);
  return k <= r + REACH_CFG.easy ? 'easy' : k <= r + REACH_CFG.reachable ? 'reachable' : k <= r + REACH_CFG.hard ? 'hard' : 'very_hard';
}
const reachStrong = (authority, position) => { const p = reachNum(position); return !!(authority && ((Number(authority.top10) || 0) >= 100 || (Number(authority.organic_keywords) || 0) >= 1000)) || (p != null && p >= 1 && p <= REACH_CFG.easy_position); };
function reachPlan(difficulty, strong) {
  const plan_type = { easy: 'direct', reachable: 'short', hard: 'full', very_hard: 'full', not_realistic: 'none' }[difficulty] || 'full';
  const m = plan_type === 'none' ? null : (strong ? REACH_MONTHS_STRONG : REACH_MONTHS)[plan_type];
  return { plan_type, months: m ? m[0] + '-' + m[1] : '', months_range: m ? m.slice() : null, stretch: difficulty === 'very_hard', chance: reachChance(plan_type, difficulty === 'very_hard') };
}
const reachLabel = (difficulty, plan) => [REACH_DIFF_LABEL[difficulty] || '', plan ? REACH_PLAN_LABEL[plan.plan_type] + (plan.stretch ? ' (stretch)' : '') : '', plan && plan.months ? plan.months + ' months' : ''].filter(Boolean).join(' · ');
// DataForSEO Labs calls that measure reach on a cache miss (~$0.03): the site's top-10 keywords with their difficulty, and its size
const reachRequests = (domain, location_code, language_code) => {
  const L = 'https://api.dataforseo.com/v3/dataforseo_labs/google/', t = reachDomain(domain), lang = language_code || 'en';
  return [{ kind: 'reach_ranked', label: 'top-10 keywords of ' + t, endpoint: L + 'ranked_keywords/live',
      body: [{ target: t, location_code, language_code: lang, limit: REACH_CFG.sample, order_by: ['keyword_data.keyword_info.search_volume,desc'], filters: [['ranked_serp_element.serp_item.rank_group', '<=', 10]] }] },
    { kind: 'reach_overview', label: 'size of ' + t, endpoint: L + 'domain_rank_overview/live', body: [{ target: t, location_code, language_code: lang }] }];
};
const reachTaskOk = (x) => !!(x && !x.error && (((x.tasks || [])[0] || {}).status_code || 0) < 40000 && ((x.tasks || [])[0] || {}).status_code);
const reachError = (x) => { if (!x) return 'no response'; const e = x.error; if (e) return String((typeof e === 'object' ? (e.message || e.description || JSON.stringify(e)) : e)).slice(0, 200);
  const t = (x.tasks || [])[0] || {}; return String(t.status_message || x.status_message || 'no data').slice(0, 200) + (t.status_code ? ' (' + t.status_code + ')' : ''); };
// parses the answers of reachRequests (in any order: matched by kind) -> { ranked: [{ keyword, kd, position }] | null, authority | null, errors }
function reachParse(reqs, res) {
  let ranked = null, authority = null; const errors = [];
  (reqs || []).forEach((r, i) => {
    const x = (res || [])[i];
    if (!reachTaskOk(x)) { errors.push(r.label + ': ' + reachError(x)); return; }
    const r0 = ((x.tasks[0].result || [])[0]) || {};
    if (r.kind === 'reach_ranked') ranked = (r0.items || []).map(it => { const kd0 = it.keyword_data || {}; const se = (it.ranked_serp_element || {}).serp_item || {};
      return { keyword: String(kd0.keyword || '').toLowerCase(), kd: (kd0.keyword_properties || {}).keyword_difficulty ?? null, position: se.rank_group ?? null }; });
    if (r.kind === 'reach_overview') { const m = (((r0.items || [])[0] || {}).metrics || {}).organic; authority = m ? { organic_keywords: m.count ?? 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), top10: (m.pos_1 || 0) + (m.pos_2_3 || 0) + (m.pos_4_10 || 0) } : { organic_keywords: 0, top3: 0, top10: 0 }; }
  });
  return { ranked, authority, errors };
}
// rule R1 "one search, one page" — the same words as the web app (app/shared/src/ladders.ts): lower case, one-letter and stop words out, a light
// stem, place names kept; two keywords are the same search when their word sets are equal or 75%+ the same (Jaccard)
const OVERLAP_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
const overlapTokens = (s) => { const out = []; for (const t of String(s || '').toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || OVERLAP_STOP.has(t)) continue;
  const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
const overlapScore = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const common = a.filter(t => sb.has(t)).length; return common / (a.length + b.length - common); };
const keywordsOverlap = (a, b) => overlapScore(overlapTokens(a), overlapTokens(b)) >= 0.75;
// Keyword Check: the answer. Difficulty for this site and plan from the shared reach rules; topic fit, navigational / other brand and the
// alternatives from the small Claude call (if it failed: fit null, navigational from DataForSEO's intent unless the keyword names the site itself).
// Alternatives only when the keyword is not realistic or off-topic, never the keyword itself or one the site already targets.
const CONFIG = { ai_cost_usd: 0.002 };   // Claude Haiku 4.5, ~900 input + ~80 output tokens ($1 / $5 per million)
const a = $('Assess Result').first().json;
const out = $input.first().json || {};
let o = out.output;
if (o && typeof o !== 'object') { try { o = JSON.parse(String(o).replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { o = null; } }
const aiOk = !!(o && typeof o === 'object' && o.fit != null && Number.isFinite(Number(o.fit)));
const fit = aiOk ? Math.max(0, Math.min(2, Math.round(Number(o.fit)))) : null;
const brand = String(a.domain || '').split('.')[0].replace(/[^a-z0-9]/g, '');
const ownBrand = brand.length >= 4 && String(a.keyword).replace(/[^a-z0-9]/g, '').includes(brand);
const navigational = aiOk ? (o.navigational === true || String(o.navigational).toLowerCase() === 'true') : (String(a.intent || '') === 'navigational' && !ownBrand);
const reach = a.reach_info.reach;
const difficulty_for_you = difficultyForYou(a.kd, reach, { navigational, position: a.position });
const plan = reachPlan(difficulty_for_you, reachStrong(a.reach_info, a.position));
const listOf = (v) => (Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/[\n,;]+/) : [])).map(x => String(x == null ? '' : x).toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()).filter(x => x.length >= 2 && x.length <= 100);
const need = difficulty_for_you === 'not_realistic' || fit === 0;
const alternatives = need && aiOk ? [...new Set(listOf(o.alternatives))].filter(x => !keywordsOverlap(x, a.keyword) && !(a.existing_keywords || []).some(e => keywordsOverlap(e, x))).slice(0, 3) : [];
const warnings = [];
if (!aiOk) warnings.push('topic check unavailable: ' + String((out.error && (out.error.message || out.error)) || 'no answer from the model').slice(0, 160));
if ((a.reach_errors || []).length) warnings.push('reach measured from partial data: ' + a.reach_errors.join('; ').slice(0, 200));
if (!a.known) warnings.push('DataForSEO has no data for this keyword in ' + a.country + ' (volume and difficulty unknown)');
// D22 (2026-10-11): a stored description written before the site's menu pages were read lists only the homepage's services, which is how
// "business central partner uae" came back as fit 1. Say so whenever that list is what decided a less-than-core fit.
if (fit !== null && fit < 2 && /homepage only/.test(String(a.services_source || ''))) warnings.push('the topic check used a stored description written from the homepage only, so a service named elsewhere on the site may be missing: run "Describe my website" to refresh it');
const body = { ok: true, keyword: a.keyword, country: a.country, volume: a.volume, kd: a.kd, intent: a.intent, cpc: a.cpc, position: a.position, reach,
  difficulty_for_you, plan_type: plan.plan_type, months: plan.months, fit, navigational, alternatives,
  cost_usd: +(Number(a.dfs_cost || 0) + (aiOk ? CONFIG.ai_cost_usd : 0)).toFixed(4),
  label: reachLabel(difficulty_for_you, plan.plan_type === 'none' ? null : plan) || REACH_DIFF_LABEL[difficulty_for_you], stretch: plan.stretch, position_url: a.position_url,
  chance: plan.plan_type === 'none' ? null : plan.chance, chance_text: plan.plan_type === 'none' ? '' : reachChanceText(plan), base_rate: REACH_BASE_RATE,   // G3 (2026-10-11): the estimated chance band (uncalibrated) and the 2025 base rate
  reach_info: { method: a.reach_info.method, p75: a.reach_info.p75 ?? null, size_reach: a.reach_info.size_reach ?? null, sample: a.reach_info.sample ?? null, top10: a.reach_info.top10 ?? null, cached: !!a.reach_info.cached, cached_at: a.reach_info.cached_at || null },
  business_source: a.business_source, warnings };
// ---- R26 (2026-10-14, FIX_PLAN.md §3.12): an answer with no search data may not sound sure ----
// Live on 2026-10-14 "business central partner uae" and "dynamics 365 partner uae" came back with volume, difficulty, intent and CPC
// all null — DataForSEO has nothing for them in the UAE — and the answer still read "Reachable for your site · Short ladder ·
// 4-8 months" with "estimated chance fair (30-50%)". The gap R3 closed for the topic fit, one field over: an unknown belongs in the
// label the customer reads, and a chance band computed from a difficulty nobody measured is not an estimate, it is a guess.
const NO_DATA = 'no search data';   // the same words in the label, the warning and the app
body.search_data_known = !(a.volume == null && a.kd == null);
body.difficulty_known = a.kd != null;
if (!body.search_data_known) {
  body.label = body.label + ' \u00b7 ' + NO_DATA;
  body.chance = null;   // suppressed, not widened: with no volume and no difficulty there is nothing to widen around
  body.chance_text = 'No estimated chance: DataForSEO has no search volume and no difficulty for "' + a.keyword + '" in ' + a.country
    + ', so the difficulty this estimate rests on (counted as your reach + ' + REACH_CFG.unknown_kd + ') was never measured. The plan and the months below rest on that same assumption.';
  body.plan_assumed = true;
} else if (!body.difficulty_known && body.chance_text) {
  // volume is known, the difficulty is not: the band stays (it is the plan's band), but it says what it was computed on
  body.chance_text = body.chance_text + ' DataForSEO has no difficulty for this keyword, so it was counted as your reach + ' + REACH_CFG.unknown_kd + '.';
  body.plan_assumed = true;
}
return [{ json: { status: 200, body } }];
