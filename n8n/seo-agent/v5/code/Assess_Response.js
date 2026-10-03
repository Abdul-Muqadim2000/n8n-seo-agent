/*__REACH__*/
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
const body = { ok: true, keyword: a.keyword, country: a.country, volume: a.volume, kd: a.kd, intent: a.intent, cpc: a.cpc, position: a.position, reach,
  difficulty_for_you, plan_type: plan.plan_type, months: plan.months, fit, navigational, alternatives,
  cost_usd: +(Number(a.dfs_cost || 0) + (aiOk ? CONFIG.ai_cost_usd : 0)).toFixed(4),
  label: reachLabel(difficulty_for_you, plan.plan_type === 'none' ? null : plan) || REACH_DIFF_LABEL[difficulty_for_you], stretch: plan.stretch, position_url: a.position_url,
  reach_info: { method: a.reach_info.method, p75: a.reach_info.p75 ?? null, size_reach: a.reach_info.size_reach ?? null, sample: a.reach_info.sample ?? null, top10: a.reach_info.top10 ?? null, cached: !!a.reach_info.cached, cached_at: a.reach_info.cached_at || null },
  business_source: a.business_source, warnings };
return [{ json: { status: 200, body } }];
