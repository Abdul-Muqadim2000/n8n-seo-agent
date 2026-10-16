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
// ---- B1-1 / B1-2 (2026-10-15, benchmark area 1): "difficulty for your site" is measured on THIS keyword's topic where the site has a
// record on it. The leaders personalise per topic (MarketMuse Personalized Difficulty = Keyword Difficulty - a topic-level Topic
// Authority, and "If you have no Topic Authority, then your Personalized Difficulty = Keyword Difficulty"; Semrush lowers Personal KD
// with the thematic distance to the domain's core topics). Ours used one number per website, cached 30 days, for every keyword: on
// 2026-10-13 "erp software uae", "business central partner uae" and "dynamics 365 partner uae" (execs 487-489) were all answered against
// the same site-wide reach. The topic measurement replaces it only with REACH_CFG.min_top10 on-topic top-10 keywords behind it; below
// that bar the site reach stays, unchanged, and the answer says which number it used and why - never a penalty for a topic never tried.
const topic = reachTopic(a.reach_info.ranked === undefined ? null : a.reach_info.ranked, a.keyword, a.reach_info.reach,
  { domain: a.domain, reason_missing: a.reach_info.cached ? 'the reach stored on ' + String(a.reach_info.cached_at || '').slice(0, 10) + ' was kept without the keywords behind it, so this check has no topic evidence to read' : '' });
const reach = topic.reach;
const difficulty_for_you = difficultyForYou(a.kd, reach, { navigational, position: a.position });
// R49 (2026-10-16): a chance band only on a reach that rests on a measured ranking (exec 598: method size, 0 top-10 keywords -> "good 50-70%")
const plan = reachPlan(difficulty_for_you, reachStrong(a.reach_info, a.position), reachMeasured(topic.used ? { used: true } : a.reach_info, a.position));
// ---- R50 (2026-10-16): the check's own answer names the ladder / page that already holds this search ----
// The app sends the website's ladder keywords (`existing_keywords`) and used them only to filter the alternatives, so a check on
// "erp software uae" — the head of an active ladder with a written page — answered "Easy · Direct plan" with no word about it. The same
// search (one search, one page: equal words or 75%+ in common) is named; when the Keyword Check also loaded the domain's seo_ladders /
// seo_content_log rows (optional nodes), the ladder id, its status and the page are given too.
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const existing = (() => {
  const kw = String(a.keyword || '').toLowerCase().trim();
  const same = (x) => { const k = String(x || '').toLowerCase().trim(); return !!k && (k === kw || keywordsOverlap(k, kw)); };
  const dom = reachDomain(a.domain);
  const lad = rowsOf('Load Ladders (Assess)').filter(r => !dom || reachDomain(r.domain) === dom).find(r => same(r.keyword) || (Number(r.rung) === 4 && same(r.head_keyword)));
  const log = rowsOf('Load Content Log (Assess)').filter(r => !dom || reachDomain(r.domain) === dom).find(r => same(r.keyword));
  const hit = (a.existing_keywords || []).find(same) || (lad && lad.keyword) || (log && log.keyword) || '';
  if (!hit && !lad && !log) return null;
  const page_url = String((log && (log.published_url || log.existing_page_url)) || (lad && lad.target_url) || '').trim();
  return { keyword: String(hit || (lad && lad.keyword) || ''), how: String(hit).toLowerCase().trim() === kw ? 'the same keyword' : 'the same search',
    ladder_id: lad ? String(lad.ladder_id || '') : null, ladder_status: lad ? String(lad.status || '') : null, rung: lad ? Number(lad.rung) || null : null,
    page_url: page_url || null, page_status: log ? String(log.status || '') : null,
    note: 'already one of your keywords' + (lad ? ' (ladder ' + lad.ladder_id + (lad.status ? ', ' + lad.status : '') + ')' : ' (one of your keyword ladders)')
      + (page_url ? ' - its page: ' + page_url : '') + ': continue that ladder / improve that page rather than starting a second one for the same search' };
})();
const listOf = (v) => (Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/[\n,;]+/) : [])).map(x => String(x == null ? '' : x).toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()).filter(x => x.length >= 2 && x.length <= 100);
const need = difficulty_for_you === 'not_realistic' || fit === 0;
const alternatives = need && aiOk ? [...new Set(listOf(o.alternatives))].filter(x => !keywordsOverlap(x, a.keyword) && !(a.existing_keywords || []).some(e => keywordsOverlap(e, x))).slice(0, 3) : [];
const warnings = [];
if (!aiOk) warnings.push('topic check unavailable: ' + String((out.error && (out.error.message || out.error)) || 'no answer from the model').slice(0, 160) + (plainRan ? ' (the plain-text retry answered nothing either)' : ''));
if ((a.reach_errors || []).length) warnings.push('reach measured from partial data: ' + a.reach_errors.join('; ').slice(0, 200));
// B1-1: an encouraging answer that rests on a reach measured on OTHER topics says so where the warnings are read. Only then: a site
// with no record anywhere is not borrowing anything, and a measurement on this topic needs no caveat.
if (!topic.used && ['easy', 'reachable'].includes(difficulty_for_you) && (topic.other_topics || []).length)
  warnings.push('measured against your site-wide reach (' + topic.site_reach + '), which comes from other topics ('
    + topic.other_topics.slice(0, 3).map(k => '"' + k + '"').join(', ') + '): ' + topic.reason + ', so this is the optimistic case');
if (!a.known) warnings.push('DataForSEO has no data for this keyword in ' + a.country + ' (volume and difficulty unknown)');
// D22 (2026-10-11): a stored description written before the site's menu pages were read lists only the homepage's services, which is how
// "business central partner uae" came back as fit 1. Say so whenever that list is what decided a less-than-core fit.
if (fit !== null && fit < 2 && /homepage only/.test(String(a.services_source || ''))) warnings.push('the topic check used a stored description written from the homepage only, so a service named elsewhere on the site may be missing: run "Describe my website" to refresh it');
const body = { ok: true, keyword: a.keyword, country: a.country, volume: a.volume, kd: a.kd, intent: a.intent, cpc: a.cpc, position: a.position, reach,
  difficulty_for_you, plan_type: plan.plan_type, months: plan.months, fit, navigational, alternatives,
  cost_usd: +(Number(a.dfs_cost || 0) + CONFIG.ai_cost_usd * (plainRan ? 2 : 1)).toFixed(4),   // R3: the model is charged even when its answer could not be parsed
  label: (reachLabel(difficulty_for_you, plan.plan_type === 'none' ? null : plan) || REACH_DIFF_LABEL[difficulty_for_you]) + (topic.used ? ' \u00b7 measured on this topic' : '') + (fit === null ? ' \u00b7 ' + FIT_UNKNOWN : ''), fit_known: fit !== null, stretch: plan.stretch, position_url: a.position_url,
  chance: plan.plan_type === 'none' ? null : plan.chance, chance_text: plan.plan_type === 'none' ? '' : reachChanceText(plan), base_rate: REACH_BASE_RATE,   // G3 (2026-10-11): the estimated chance band (uncalibrated) and the 2025 base rate
  reach_info: { method: a.reach_info.method, p75: a.reach_info.p75 ?? null, size_reach: a.reach_info.size_reach ?? null, sample: a.reach_info.sample ?? null, top10: a.reach_info.top10 ?? null, cached: !!a.reach_info.cached, cached_at: a.reach_info.cached_at || null,
    site_reach: topic.site_reach },
  // B1-1: which number this answer was measured against, what stands behind it, and the sentence that says so in the owner's words
  reach_basis: topic.used ? 'topic' : 'site', topic_reach: topic.topic_reach, reach_used: reach,
  topic_evidence: { on_topic: topic.on_topic, top10: topic.top10, sample: topic.sample, best: topic.best, examples: topic.examples, other_topics: topic.other_topics, reason: topic.reason },
  reach_note: topic.note,
  existing,   // R50
  business_source: a.business_source, warnings };
if (existing) body.label = body.label + ' · already one of your keywords';
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
