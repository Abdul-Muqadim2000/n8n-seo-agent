/*__REACH__*/
// Keyword Check: the answer. Difficulty for this site and plan from the shared reach rules; topic fit, navigational / other brand and the
// alternatives from the small Claude call (if it failed: fit null, navigational from DataForSEO's intent unless the keyword names the site itself).
// Alternatives only when the keyword is not realistic or off-topic, never the keyword itself or one the site already targets.
const CONFIG = { ai_cost_usd: 0.002 };   // Claude Haiku 4.5, ~900 input + ~80 output tokens ($1 / $5 per million)
const FIT_UNKNOWN = 'topic check unavailable';   // R3: the same words in the label, the warning and the app (shared/src/keywords.ts)
const a = $('Assess Result').first().json;
const out = $input.first().json || {};
// R3 (2026-10-13, re-rating): *Parser - Keyword Fit* failed twice on "business central partner uae" and the 200 shipped `fit: null` with the
// money spent, mentioned only in `warnings`. The structured answer is read first; a plain line or a JSON object inside free text (what
// *Keyword Fit (Text)* answers when the parser comes back empty) is read too; and an unknown fit is now in the label, not only in the warnings.
const fromText = (v) => {
  const t = String(v == null ? '' : v).replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const j = t.match(/\{[\s\S]*\}/);
  if (j) { try { const x = JSON.parse(j[0]); if (x && typeof x === 'object') return x; } catch (e) {} }
  const f = t.match(/\bfit\s*[=:]\s*([0-2])\b/i); if (!f) return null;
  const nav = t.match(/\bnavigational\s*[=:]\s*(true|false|yes|no)\b/i);
  const alt = t.match(/\balternatives\s*[=:]\s*([^\n]*)/i);
  return { fit: Number(f[1]), navigational: !!nav && /^(true|yes)$/i.test(nav[1]), alternatives: alt ? String(alt[1]).replace(/^\s*none\s*$/i, '') : '' };
};
let o = out.output != null ? out.output : out.text;
if (o && typeof o !== 'object') o = fromText(o);
const aiOk = !!(o && typeof o === 'object' && o.fit != null && Number.isFinite(Number(o.fit)));
const fit = aiOk ? Math.max(0, Math.min(2, Math.round(Number(o.fit)))) : null;
// the second attempt (*Keyword Fit (Text)*) runs only when the first came back empty; referencing a node that did not run throws
let plainRan = false; try { plainRan = !!($('Keyword Fit (Text)').first() || {}).json; } catch (e) { plainRan = false; }
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
if (!aiOk) warnings.push('topic check unavailable: ' + String((out.error && (out.error.message || out.error)) || 'no answer from the model').slice(0, 160) + (plainRan ? ' (the plain-text retry answered nothing either)' : ''));
if ((a.reach_errors || []).length) warnings.push('reach measured from partial data: ' + a.reach_errors.join('; ').slice(0, 200));
if (!a.known) warnings.push('DataForSEO has no data for this keyword in ' + a.country + ' (volume and difficulty unknown)');
// D22 (2026-10-11): a stored description written before the site's menu pages were read lists only the homepage's services, which is how
// "business central partner uae" came back as fit 1. Say so whenever that list is what decided a less-than-core fit.
if (fit !== null && fit < 2 && /homepage only/.test(String(a.services_source || ''))) warnings.push('the topic check used a stored description written from the homepage only, so a service named elsewhere on the site may be missing: run "Describe my website" to refresh it');
const body = { ok: true, keyword: a.keyword, country: a.country, volume: a.volume, kd: a.kd, intent: a.intent, cpc: a.cpc, position: a.position, reach,
  difficulty_for_you, plan_type: plan.plan_type, months: plan.months, fit, navigational, alternatives,
  cost_usd: +(Number(a.dfs_cost || 0) + CONFIG.ai_cost_usd * (plainRan ? 2 : 1)).toFixed(4),   // R3: the model is charged even when its answer could not be parsed
  label: (reachLabel(difficulty_for_you, plan.plan_type === 'none' ? null : plan) || REACH_DIFF_LABEL[difficulty_for_you]) + (fit === null ? ' \u00b7 ' + FIT_UNKNOWN : ''), fit_known: fit !== null, stretch: plan.stretch, position_url: a.position_url,
  chance: plan.plan_type === 'none' ? null : plan.chance, chance_text: plan.plan_type === 'none' ? '' : reachChanceText(plan), base_rate: REACH_BASE_RATE,   // G3 (2026-10-11): the estimated chance band (uncalibrated) and the 2025 base rate
  reach_info: { method: a.reach_info.method, p75: a.reach_info.p75 ?? null, size_reach: a.reach_info.size_reach ?? null, sample: a.reach_info.sample ?? null, top10: a.reach_info.top10 ?? null, cached: !!a.reach_info.cached, cached_at: a.reach_info.cached_at || null },
  business_source: a.business_source, warnings };
return [{ json: { status: 200, body } }];
