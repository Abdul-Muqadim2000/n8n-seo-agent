// ---- reach (v4.8, PIPELINE_FEATURE_SPEC §5.3-5.5): the keyword difficulty this website can already win. ONE copy, inlined by the build into
// Ladder Plan, Reach (Discovery), Rank Keywords, Build Keyword Strategy and the Keyword Check workflow (SEOagentAssess), so they all agree.
//   reach      = the 75th-percentile difficulty of the keywords the site ranks top 10 for (at least 5 of them; linear interpolation), else by
//                size (keywords in the top 10: 0-4 -> 10, 5-49 -> 20, 50-499 -> 35, 500+ -> 50); the larger of the two when both exist.
//   difficulty = easy (kd <= reach + 5, or the site already ranks 1-20 for the keyword) · reachable (<= reach + 20) · hard (<= reach + 40) ·
//   for you      very hard (above) · not realistic (navigational / another company's brand / verdict AVOID); an unknown kd counts as reach + 10.
//   plan       = easy -> direct (2-4 months) · reachable -> short (4-8) · hard -> full (9-15) · very hard -> full, stretch · not realistic -> none;
//                strong sites (100+ top-10 keywords, 1,000+ ranking keywords, or already top 20 for it): direct 2-3, short 3-6, full 6-12.
//   cache      = seo_cache 'reach:<site_id>' for 30 days and the same market (value: reach, method, p75, size_reach, sample, top10,
//                organic_keywords, location_code, and since B1-2 the EVIDENCE itself: `r` = the top-10 keywords it was measured on);
//                a reach that could not be measured (both calls failed) is never stored.
const REACH_CFG = { min_top10: 5, percentile: 0.75, ttl_days: 30, unknown_kd: 10, easy: 5, reachable: 20, hard: 40, easy_position: 20, sample: 100, sample_keep: 60 };
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
// R49 (2026-10-16, re-rating 2026-10-15): the band was read off the plan type alone, so a site whose reach is only the size tier for
// "0 keywords in Google's top 10" (method size, sample 0) was told "estimated chance good (50-70%)" for a KD-3 keyword — the highest
// band, on a reach nothing was measured on. The table stays (a judgement call until G17); it is now applied only when the reach rests on
// a measured ranking: the site's top-10 keywords (percentile, or any top-10 keyword at all), a reach measured on the topic, or the site
// already ranking 1-20 for the keyword. Otherwise there is no band — the plan and the months stay, with the base rate as the only figure.
// The same words live in app/shared/src/keywords.ts (UNMEASURED_LABEL).
const REACH_UNMEASURED_LABEL = 'no estimated chance (no measured ranking to judge it by)';
const reachMeasured = (info, position) => { const i = info || {}; const p = reachNum(position);
  if (p != null && p >= 1 && p <= REACH_CFG.easy_position) return true;
  if (i.used === true || String(i.method || '') === 'percentile') return true;
  return (Number(i.top10) || 0) > 0 || (Number(i.sample) || 0) > 0; };
const reachChance = (plan_type, stretch, measured) => { const c = REACH_CHANCE[plan_type === 'none' ? 'none' : (stretch ? 'stretch' : plan_type)] || REACH_CHANCE.full;
  if (c.band !== 'none' && measured === false) return { band: 'unmeasured', range: [0, 0], label: REACH_UNMEASURED_LABEL, basis: 'base rate' };
  return { band: c.band, range: c.range.slice(), label: c.band === 'none' ? '' : 'estimated chance ' + c.band + ' (' + c.range[0] + '-' + c.range[1] + '%, uncalibrated)' }; };
const reachBaseRateText = () => 'Base rate (' + REACH_BASE_RATE.source + ', ' + REACH_BASE_RATE.year + '): only ' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach Google\'s top 10 within a year, and ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those do so within a month — the rest take months.';
// the sentence under a plan's month range: the chance band, that it is uncalibrated, and the 2025 base rate it is judged against
const reachChanceText = (plan) => !(plan && plan.chance && plan.chance.label) ? '' : plan.chance.band === 'unmeasured'
  ? 'No estimated chance: the reach this plan is judged against rests on no measured ranking (the search data shows none of your keywords in Google\'s top 10), so a band would only restate the plan. The only measured figure is the base rate. ' + reachBaseRateText()
  : (plan && plan.chance && plan.chance.label) ? 'Estimated chance of reaching the top 10 within ' + plan.months + ' months: ' + plan.chance.band + ' (' + plan.chance.range[0] + '-' + plan.chance.range[1] + '%) — ' + REACH_CHANCE_NOTE + '. ' + reachBaseRateText() : '';
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
// the stored reach of this site for this market, when it is younger than 30 days (null otherwise). B1-2: the row also carries the
// keywords the number was measured on (`r`), so a run that reuses the cached reach can still answer "and what is it measured on?" and
// measure a reach on ITS OWN topic (reachTopic) without re-buying the pull. A row written before B1-2 has no `r`: `ranked` is then null
// and the caller says the evidence was not re-read, which is true, rather than reporting zero on-topic keywords, which is not.
function reachCached(rows, domain, location_code) {
  const key = reachKey(domain);
  const row = (rows || []).filter(r => r && !r.error && r.key === key).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (!row) return null;
  let v = null; try { v = JSON.parse(row.value); } catch (e) { return null; }
  if (!v || reachNum(v.reach) == null) return null;
  if (reachNum(location_code) && reachNum(v.location_code) && Number(v.location_code) !== Number(location_code)) return null;
  const days = (Date.now() - new Date(row.updated_at).getTime()) / 864e5;
  if (!(days >= 0 && days < REACH_CFG.ttl_days)) return null;
  const { r: packed, ...rest } = v;
  const ranked = Array.isArray(packed) ? packed.map(x => ({ keyword: String((x || [])[0] || ''), kd: reachNum((x || [])[1]), position: reachNum((x || [])[2]) })).filter(x => x.keyword) : null;
  return { ...rest, reach: Number(v.reach), cached: true, cached_at: String(row.updated_at), ranked, ranked_from: ranked ? 'the stored measurement of ' + String(row.updated_at).slice(0, 10) : '' };
}
// the seo_cache row (exact columns) for a freshly measured reach. `ranked` (optional) is the evidence: [{ keyword, kd, position }] as
// the pull returned it, packed as [keyword, kd, position] triples and capped at REACH_CFG.sample_keep so one row stays small.
const reachPack = (ranked) => (Array.isArray(ranked) ? ranked : []).filter(r => r && r.keyword && reachNum(r.position) != null)
  .slice(0, REACH_CFG.sample_keep).map(r => [String(r.keyword).slice(0, 120), reachNum(r.kd), Number(r.position)]);
const reachCacheRow = (domain, info, location_code, ranked) => { const r = reachPack(ranked);
  return { key: reachKey(domain), kind: 'reach', site_id: reachSiteId(domain),
    value: JSON.stringify({ reach: info.reach, method: info.method, p75: info.p75, size_reach: info.size_reach, sample: info.sample, top10: info.top10, organic_keywords: info.organic_keywords, location_code: reachNum(location_code), ...(r.length ? { r } : {}) }),
    updated_at: new Date().toISOString() }; };
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
// ---- B2-1 (2026-10-15, benchmark area 2): the reach measured on ONE TOPIC, not across the whole website ----
// `reach` above is a single number per site: the 75th-percentile difficulty of everything it ranks top 10 for, cached 30 days. The same
// number therefore decided two unrelated plans — "peppol uae" and "erp implementation dubai" (lad_mv5pjt5y4aoa, 2026-10-13: reach 10 from
// a cached 2026-10-08 measurement). The leaders personalise per TOPIC: MarketMuse subtracts a topic-level Topic Authority from the keyword
// difficulty ("If you have no Topic Authority, then your Personalized Difficulty = Keyword Difficulty",
// https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/), and Semrush measures the thematic distance between a
// domain's core topics and the target topic, lowering PKD the closer the match (https://www.semrush.com/blog/ai-keyword-research-updates/).
// reachTopic() does the same from data the run already paid for: the keywords the site ALREADY ranks for that are on this topic. It is used
// only when that evidence is as strong as the site-wide measurement demands (REACH_CFG.min_top10 keywords in the top 10 with a difficulty).
// Below that bar the site-wide reach stays and the caller is told WHY, so no plan quietly rests on a number measured on other topics. There
// is no third direction: absence of on-topic wins is not evidence of inability, so it never invents a penalty of its own.
const REACH_TOPIC_CFG = { max_examples: 6, max_other: 4 };
// the default on-topic test: half of the head's meaningful words (the shape `_radius.js` RAD.headFit uses; the ladder passes that kit in)
const reachTopicMatch = (head) => { const h = overlapTokens(head); const need = Math.max(1, Math.ceil(h.length / 2));
  return (kw) => { if (!h.length) return false; const t = overlapTokens(kw); return t.filter(x => h.includes(x)).length >= need; }; };
/**
 * ranked: [{ keyword, kd, position }] — every keyword the site ranks for that this run saw (null = the pull failed)
 * head: the topic's head keyword · domainReach: the site-wide reach · o: { match (the on-topic test), domain, reason_missing }
 * -> { used, reach, topic_reach, site_reach, on_topic, top10, sample, best, examples, other_topics, reason, note }
 */
function reachTopic(ranked, head, domainReach, o) {
  const opts = o || {};
  const site = reachNum(domainReach) == null ? reachSizeTier(0) : Number(domainReach);
  const match = typeof opts.match === 'function' ? opts.match : reachTopicMatch(head);
  const rows = (ranked || []).filter(r => r && r.keyword && reachNum(r.position) != null);
  const on = rows.filter(r => { try { return !!match(String(r.keyword)); } catch (e) { return false; } });
  const pos = (r) => Number(r.position);
  const top10 = on.filter(r => pos(r) >= 1 && pos(r) <= 10);
  const kds = top10.map(r => reachNum(r.kd)).filter(v => v != null).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= REACH_CFG.min_top10) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const used = p75 != null;
  const best = on.slice().sort((a, b) => pos(a) - pos(b))[0] || null;
  const examples = top10.slice().sort((a, b) => pos(a) - pos(b)).slice(0, REACH_TOPIC_CFG.max_examples)
    .map(r => ({ keyword: String(r.keyword), position: pos(r), kd: reachNum(r.kd) }));
  const other_topics = rows.filter(r => pos(r) >= 1 && pos(r) <= 10 && on.indexOf(r) < 0).sort((a, b) => pos(a) - pos(b))
    .slice(0, REACH_TOPIC_CFG.max_other).map(r => String(r.keyword));
  const who = String(opts.domain || 'your site');
  const q = '"' + String(head || '') + '"';
  // B1-2: a caller that reuses a stored reach knows WHY there is no list (the pull was not made again); it says that instead of
  // "could not be read", which would blame a failure that never happened.
  const reason = ranked == null ? (String(opts.reason_missing || '') || 'the keywords ' + who + ' ranks for could not be read on this run')
    : !on.length ? 'nothing ' + who + ' ranks for is on this topic'
    : !top10.length ? on.length + ' keyword(s) on this topic rank for ' + who + ', none of them in the top 10 (best #' + (best ? pos(best) : '-') + ')'
    : top10.length + ' keyword(s) on this topic are in the top 10' + (kds.length < top10.length ? ', ' + kds.length + ' of them with a known difficulty' : '')
      + ' - fewer than the ' + REACH_CFG.min_top10 + ' needed to measure a reach on one topic';
  const note = used
    ? 'Measured on this topic: 75% of the ' + kds.length + ' keyword(s) about ' + q + ' that ' + who + ' ranks in the top 10 for have a difficulty of ' + p75
      + ' or lower, so this plan is measured against ' + p75 + ' and not against the site-wide reach of ' + site + '.'
    : 'This plan is measured against your site-wide reach (' + site + '), because ' + reason + '. A reach measured on other topics'
      + (other_topics.length ? ' (' + other_topics.map(k => '"' + k + '"').join(', ') + ')' : '') + ' is weaker evidence for this one: treat the months and the chance below as the optimistic case.';
  return { used, reach: used ? p75 : site, topic_reach: p75, site_reach: site, on_topic: on.length, top10: top10.length, sample: kds.length,
    best: best ? { keyword: String(best.keyword), position: pos(best) } : null, examples, other_topics, reason, note, head: String(head || '') };
}
const reachStrong = (authority, position) => { const p = reachNum(position); return !!(authority && ((Number(authority.top10) || 0) >= 100 || (Number(authority.organic_keywords) || 0) >= 1000)) || (p != null && p >= 1 && p <= REACH_CFG.easy_position); };
// `measured` (R49): reachMeasured(reach info, position); false = no chance band. Left out, the band stays (a caller with no reach info).
function reachPlan(difficulty, strong, measured) {
  const plan_type = { easy: 'direct', reachable: 'short', hard: 'full', very_hard: 'full', not_realistic: 'none' }[difficulty] || 'full';
  const m = plan_type === 'none' ? null : (strong ? REACH_MONTHS_STRONG : REACH_MONTHS)[plan_type];
  return { plan_type, months: m ? m[0] + '-' + m[1] : '', months_range: m ? m.slice() : null, stretch: difficulty === 'very_hard', chance: reachChance(plan_type, difficulty === 'very_hard', measured) };
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
// ---- topic radius (G32, 2026-10-13, system review FIX_PLAN.md G32; criterion K12 in CRITERIA_keywords_content.md) ----
// "Which topics is this website close enough to win, and which are a stretch?" — until now the system answered that per keyword
// (difficulty for your site, `_reach.js`) but never per TOPIC, so a plan could quietly wander off what the site actually sells: the
// 2026-10-11 review found the topic check was a warning on one keyword, never a picture of the radius (K12 scored 5 of 10).
// RAD.of() groups this run's keywords into topics and gives each one a verdict with the evidence behind it:
//   in_reach — the difficulty sits inside the site's reach (or the site already ranks in the top 20 for it), and something the site
//              sells or has a page about names the topic;
//   stretch  — within sight but above the reach, or nothing the site sells names it: possible, but it needs the easier topics (and
//              links) first;
//   far      — very hard for this site today, or not realistic at all (another company's brand, a government portal: `_fit_gate.js`
//              already refuses those keywords, so this is only about difficulty).
// Nothing here blocks anything on its own: it is the block of evidence a plan, a report and the app show, and `RAD.pick()` answers
// "is this topic inside the radius?" for a caller that wants to warn or to ask for a confirmation.
// It needs the reach kit in the same node (`difficultyForYou`, REACH_CFG, REACH_DIFF_LABEL) — the build asserts that.
const RAD = (() => {
  const CFG = { max_topics: 40, in_reach: ['easy', 'reachable'], stretch: ['hard'], min_service_tokens: 1 };
  const LABEL = { in_reach: 'Within reach', stretch: 'A stretch', far: 'Out of reach for now' };
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my', 'our', 'service', 'services', 'company', 'companies', 'solution', 'solutions', 'provider', 'providers', 'software', 'system', 'systems']);
  const S = (v) => String(v == null ? '' : v);
  const num = (v) => (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v);
  // R39 (2026-10-16, re-rating defect A-6): every token of two characters or fewer was dropped, so "ai" was not one of the words that
  // matter in "ai consulting dubai" — the head had two of them ("consult", "dubai"), one shared word was enough, and "supply chain
  // optimization consulting" became rung 2 of an AI-consulting ladder on "consult" alone (exec 610). A two-letter word that names a
  // field ("ai", "bi", "hr", "it", "ui", "ux" ...) is now a word that matters; one that names a place ("uk", "eu") counts the way
  // "dubai" always did. Pronouns and particles ("us", "me", "of", "to") stay out. `_site_model.js` termsOf already kept them.
  const CORE2 = new Set(['ai', 'bi', 'hr', 'it', 'ui', 'ux', 'ml', 'ar', 'vr', 'xr', 'qa', 'pr', 'crm', 'erp', 'iot', 'uk', 'eu', '3d', '5g']);
  const tokens = (s) => { const out = []; for (const t of S(s).toLowerCase().split(/[^a-z0-9]+/)) { if (!t || STOP.has(t) || (t.length <= 2 && !CORE2.has(t))) continue;
    const w = t.length <= 3 ? t : t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, ''); if (w && !out.includes(w)) out.push(w); } return out; };
  // R39, the second half: a rung has to share the head's SUBJECT, not only the kind of service or the place. "supply chain consulting
  // dubai" shares "consult" and "dubai" with "ai consulting dubai" — two of its three words, and still another topic. Service-type
  // words and places are context; when the head has a subject word at all, at least one shared word must be one.
  const GENERIC = new Set(['consult', 'consultant', 'consultancy', 'consultancie', 'advisory', 'advisor', 'agency', 'firm', 'partner', 'expert', 'specialist', 'implementation', 'implement', 'integration', 'integrator',
    'development', 'develop', 'developer', 'support', 'training', 'outsourc', 'cost', 'price', 'pric', 'quote', 'online', 'free', 'guide', 'review', 'list', 'example', 'meaning', 'definition', 'near', 'local', 'hire', 'job']);
  const PLACE = new Set(['uae', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'emirat', 'ksa', 'saudi', 'riyadh', 'jeddah', 'qatar', 'doha', 'kuwait', 'bahrain', 'oman', 'muscat', 'egypt', 'cairo', 'gcc', 'mena',
    'middle', 'east', 'uk', 'london', 'usa', 'eu', 'europe', 'india', 'pakistan', 'singapore', 'australia', 'canada', 'germany', 'america']);
  const subjectOf = (toks) => toks.filter(t => !GENERIC.has(t) && !PLACE.has(t));
  const shared = (a, b) => { const sb = new Set(b); return a.filter(t => sb.has(t)); };
  // what the site sells / already writes about, as one token set per source, so the evidence can name the matching one
  const anchors = (o) => {
    const list = [];
    for (const sv of (o.services || [])) if (S(sv).trim()) list.push({ kind: 'service', label: S(sv).trim(), tokens: tokens(sv) });
    for (const pg of (o.pages || [])) { const label = S(pg.title || pg.url); if (label) list.push({ kind: 'page', label, url: S(pg.url), tokens: tokens([pg.title, pg.keyword, S(pg.url).replace(/^https?:\/\/[^/]+/i, '')].join(' ')) }); }
    for (const tp of (o.site_topics || [])) if (S(tp).trim()) list.push({ kind: 'topic', label: S(tp).trim(), tokens: tokens(tp) });
    return list.filter(a => a.tokens.length);
  };
  // one topic's verdict and the evidence behind it
  const judge = (t, reach, anchorList, o) => {
    const kd = num(t.kd), pos = num(t.your_position);
    const diff = difficultyForYou(kd, reach, { position: pos });
    const toks = tokens([t.topic, t.primary_keyword, (t.keywords || []).map(k => S(k.keyword || k)).join(' ')].join(' '));
    const hits = anchorList.map(a => ({ a, common: shared(toks, a.tokens) })).filter(x => x.common.length >= CFG.min_service_tokens)
      .sort((x, y) => y.common.length - x.common.length);
    const near = hits[0] || null;
    const evidence = [];
    if (pos != null && pos >= 1 && pos <= REACH_CFG.easy_position) evidence.push('you already rank #' + pos + ' for "' + t.primary_keyword + '"');
    evidence.push(kd == null ? 'no difficulty figure for "' + t.primary_keyword + '" (counted as ' + (reach + REACH_CFG.unknown_kd) + ', your reach is ' + reach + ')'
      : 'difficulty ' + kd + ' against your reach ' + reach);
    if (near) evidence.push(near.a.kind === 'service' ? 'it matches what you sell: "' + near.a.label + '"'
      : near.a.kind === 'page' ? 'you already have a page on it: ' + (near.a.url || near.a.label)
      : 'it is one of your topics: "' + near.a.label + '"');
    else if (anchorList.length) evidence.push('nothing you sell or have a page about names this topic');
    if (num(t.volume) != null) evidence.push(Number(t.volume).toLocaleString('en-GB') + ' searches a month across ' + (num(t.keyword_count) || 1) + ' keyword(s)');
    let verdict = CFG.in_reach.includes(diff) ? 'in_reach' : CFG.stretch.includes(diff) ? 'stretch' : 'far';
    let reason = verdict === 'in_reach' ? REACH_DIFF_LABEL[diff] : verdict === 'stretch' ? 'above your reach today, but within sight' : REACH_DIFF_LABEL[diff] || 'very hard for your site today';
    // off what the site sells: a topic can be easy to rank for and still be the wrong topic, so it is a stretch at best
    if (verdict === 'in_reach' && !near && anchorList.length && !(pos != null && pos >= 1 && pos <= REACH_CFG.easy_position)) {
      verdict = 'stretch'; reason = 'the difficulty is inside your reach, but nothing you sell or write about names this topic';
    }
    return { topic: t.topic, primary_keyword: t.primary_keyword, kd: kd, volume: num(t.volume), keyword_count: num(t.keyword_count) || (t.keywords || []).length || 1,
      your_position: pos, difficulty_for_you: diff, verdict, verdict_label: LABEL[verdict], reason, basis: near ? near.a.kind : 'none', matched: near ? near.a.label : '', evidence };
  };
  /**
   * o: { reach, reach_method?, topics: [{ topic, primary_keyword, kd, volume, keyword_count, your_position?, keywords? }],
   *      services?, pages?, site_topics?, checked_at?, domain? }
   * -> { reach, in_reach: [], stretch: [], far: [], topics: [], summary, note, measured }
   */
  const of = (o) => {
    const x = o || {};
    const reach = num(x.reach) == null ? null : Number(x.reach);
    const r = reach == null ? 10 : reach;
    const anchorList = anchors(x);
    const topics = (x.topics || []).filter(t => t && S(t.topic || t.primary_keyword)).slice(0, CFG.max_topics)
      .map(t => judge({ topic: S(t.topic || t.primary_keyword), primary_keyword: S(t.primary_keyword || t.topic), kd: t.kd, volume: t.volume, keyword_count: t.keyword_count, your_position: t.your_position, keywords: t.keywords }, r, anchorList, x));
    const pick1 = (v) => topics.filter(t => t.verdict === v);
    const inR = pick1('in_reach'), st = pick1('stretch'), far = pick1('far');
    const name = (list, k) => list.slice(0, k).map(t => '"' + t.topic + '"').join(', ');
    const summary = !topics.length ? 'Not enough keyword data to draw your topic radius yet.'
      : (inR.length ? inR.length + ' topic(s) are within reach for ' + S(x.domain || 'your site') + ' today (' + name(inR, 3) + (inR.length > 3 ? ' …' : '') + ')' : 'No topic in this research is within reach today')
        + (st.length ? '; ' + st.length + ' are a stretch (' + name(st, 3) + (st.length > 3 ? ' …' : '') + ')' : '')
        + (far.length ? '; ' + far.length + ' are out of reach for now (' + name(far, 2) + (far.length > 2 ? ' …' : '') + ')' : '') + '.';
    const note = reach == null
      ? 'Your reach could not be measured this run, so these verdicts use the smallest default (' + r + '): treat them as provisional.'
      : 'Your reach is the difficulty your site already wins: the 75th percentile of the difficulty of the keywords it ranks in the top 10 for'
        + (x.reach_method === 'size' ? ' (measured from the size of your ranking profile this time)' : x.reach_method === 'default' ? ' (no ranking data: the default for a new site)' : '')
        + '. A stretch topic is not a no: it is the one to come back to once the topics within reach are won and links have been earned.';
    return { reach, reach_method: S(x.reach_method), measured: reach != null, topics, in_reach: inR, stretch: st, far, summary, note, checked_at: S(x.checked_at) };
  };
  /** is one topic (or keyword) inside the radius? -> the topic's verdict, or null when it is not among the topics */
  const pick = (radius, topic) => { const t = tokens(topic); if (!t.length) return null;
    const all = ((radius || {}).topics || []).map(x => ({ x, common: shared(t, tokens([x.topic, x.primary_keyword].join(' '))) }))
      .filter(o => o.common.length).sort((a, b) => b.common.length - a.common.length);
    return all.length ? all[0].x : null; };
  /** one topic's verdict as a sentence (a plan's notes, a tooltip): "A stretch — … (difficulty 55 against your reach 28; …)" */
  const line = (t) => !t ? '' : LABEL[t.verdict] + ': ' + t.reason + ' (' + (t.evidence || []).join('; ') + ')';
  /** the rows a report prints, in reading order: within reach, then the stretches, then what is out of reach for now */
  const rows = (radius) => { const rad = radius || {}; return [...(rad.in_reach || []), ...(rad.stretch || []), ...(rad.far || [])]; };
  /**
   * R23 (2026-10-14, FIX_PLAN.md §3.12): the radius test for ONE pair — is this keyword on the topic of the ladder's head keyword?
   * The ladder pool already asks for one shared word with the head, which is how "azure api management monetization" (volume 10,
   * trend -100%) became the single rung of a ladder for "azure cloud migration dubai" in exec 549: "azure" was enough. Half of the
   * head's meaningful words have to be in the keyword (at least one). A head of one or two meaningful words is too short to judge a
   * topic by, so one shared word is enough there — the AI relevance screen and the fit gate stay the other two filters.
   * -> { ok, shared, need, head_words, reason }   (reason is empty when it passes; it is the sentence the plan prints when it does not)
   */
  const headFit = (headKw, kw) => {
    const h = tokens(headKw), k = tokens(kw);
    if (!h.length || !k.length) return { ok: true, shared: [], need: 0, head_words: h, reason: '' };
    const common = shared(h, k);
    const need = Math.max(1, Math.ceil(h.length / 2));
    const q = (list) => list.map(t => '"' + t + '"').join(', ');
    const subject = subjectOf(h);
    const onSubject = !subject.length || common.some(t => subject.includes(t));
    if (common.length >= need && onSubject) return { ok: true, shared: common, need, head_words: h, subject, reason: '' };
    if (common.length >= need) return { ok: false, shared: common, need, head_words: h, subject,
      reason: 'it is not on this ladder\'s topic: it shares only ' + q(common) + ' with "' + S(headKw) + '", which is the kind of service or the place, not the subject (' + q(subject) + ')' };
    return { ok: false, shared: common, need, head_words: h, subject,
      reason: common.length
        ? 'it is not on this ladder\'s topic: it shares only ' + q(common) + ' with "' + S(headKw) + '" (' + common.length + ' of the ' + h.length + ' words that matter, ' + need + ' needed: ' + q(h) + ')'
        : 'it is not on this ladder\'s topic: it shares none of the words that matter in "' + S(headKw) + '" (' + q(h) + ')' };
  };
  return { of, pick, rows, line, headFit, LABEL, CFG, tokens, subjectOf, CORE2 };
})();
// ---- fit gate (2026-10-11, FIX_PLAN D4 / D8): ONE rule for keywords that no page of this website should target. Inlined by the build
// (the FIT_GATE placeholder) into Analyze Keywords (full report: keyword gap, easy wins, opportunities), Rank Keywords (discovery), Ladder Pool /
// Ladder Plan (ladder rungs and the main keyword), Relevance Chunks (the brands the AI screen is told about) and Brief Context (the hub
// page's cluster list); a copy goes to harness/code_v4/_fit_gate.js as a shim (S34). fitGate(keyword, ctx) -> { ok: true } or
// { ok: false, reason, detail } with reason one of:
//   'own brand'    — the keyword names the website itself (its domain label, 4+ letters);
//   'navigational' — DataForSEO Labs says the intent is navigational (ctx.intent);
//   'government'   — the keyword is a public body or an identity document and nothing else (FTA, EmaraTax, MoHRE, GDRFA, ICP, RTA, DEWA,
//                    ZATCA, GOSI, "ministry …", "… authority", Emirates ID, UAE Pass, visa / labour card status …), or a body with a portal /
//                    status word ("fta portal", "emirates id status"), or, with its results page in hand (ctx.serp), 3+ of the top 5 results
//                    are on government hosts (.gov / .gov.xx / .gouv.xx / u.ae …);
//   'portal'       — a login / portal / password / status check / renewal / verification / application task: people want the owner's own site;
//   'off topic'    — with topics on file (ctx.topics, R13): under a quarter of the keyword's own words have anything to do with what the
//                    site sells ("character ai", "mofa attestation dubai", "mh enterprises uae");
//   'too broad'    — with topics on file: nothing but generic or place words is left of it ("ai", "google ai", "microsoft ai");
//   'other brand'  — one of its words is the label of a declared competitor (cleartax.com ↔ "cleartax"), of a domain on the results page
//                    (facts.ae ↔ "facts"), or a brand name AI uses for another company (seo_cache ai_brands: name -> domain); with the
//                    keyword's own results page in hand also when one domain whose label is in the keyword holds 3+ of the top 5.
// Bounds, so that legitimate keywords survive:
//   * a public body with a topic word is a topic, not a destination: "zatca e invoicing", "fta vat registration", "mohre wps" are kept — only
//     the body alone (plus country words) or with a portal / status word is refused;
//   * a portal word with a content / buying word is kept ("best erp software with mobile login", "emaratax registration guide"); a plain
//     category noun is not enough ("erp software login" is still a login);
//   * a results-page or AI-named brand with a partner-type word ("sap implementation dubai", "microsoft dynamics 365 partner uae") or a
//     comparison word ("facts erp vs odoo") is kept; a declared competitor is kept only when compared ("cleartax vs zoho"); a results-page
//     label (often a dictionary word) counts only where a product name sits — first, or right before a category word ("facts erp", not
//     "erp facts and figures guide");
//   * a domain label shorter than 4 letters, a word of the keyword being researched (ctx.protect: head term / seeds / services) or a generic
//     word (erp, software, tax …) never counts as a brand; "www", "m", "app" prefixes are dropped before the label is taken.
// Relevance to the website's services is NOT judged here. ctx.relevance (FIX_PLAN G19) is the hook: a function (keyword) -> { ok, reason,
// detail } called last, so the first version of G19 plugs in without touching the callers.
const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
// B-3 (2026-10-17, re-rating 2026-10-17, exec 767): the same refusal WITHOUT a body's name. "mofa attestation dubai" was refused but "uae document
// attestation" and "mofa document attestation" were offered as keyword-gap targets under a High finding: attesting, legalising or notarising a
// person's document is a public service whatever words surround it. A keyword whose own words are such a service word plus document / service
// words is refused as 'government'; "attestation software" or "document attestation management system" keep a product word and stay.
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
// B-3: a person looking for work is not a buyer ("finance jobs in uae", "finance manager jobs in uae" were offered as easy wins). A job word with no
// product word ("recruitment software", "hr jobs portal system") is refused as 'job search'.
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
// B-3: words common enough in English that, lifted out of a longer service NAME, they say nothing about the topic: "intelligent" out of
// "Intelligent Document Processing" let "intelligent software solutions" (another company's name) through; "management" out of "Supply Chain
// Management" let "top facilities management companies uae" through; "commerce" out of "Dynamics 365 Commerce" let "commercial companies law
// uae" through. Such a word counts as on topic only when the keyword carries the whole name, or at least two of its words (fitTopic).
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
// F-KW (2026-10-20, finding 8): letters and digits of EVERY script, not a-z only. An Arabic keyword ("برنامج محاسبة في الإمارات") was
// no tokens at all, so a ladder the client chose in Arabic was set aside as `empty` and every Arabic item key was ''. NFKC folds
// full-width and compatibility forms, toLowerCase (never the locale form) folds case; marks (\p{M}) stay inside their word.
const FIT_SPLIT = /[^\p{L}\p{M}\p{N}.]+/u, FIT_SPLIT_WORDS = /[^\p{L}\p{M}\p{N}]+/u;
const fitLow = (s) => String(s || '').normalize('NFKC').toLowerCase();
const fitTokens = (s) => fitLow(s).replace(/[’']/g, '').split(FIT_SPLIT).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// F-KW (2026-10-20, finding 5): a label is the website's own BRAND only when it is distinctive. A label that splits entirely into category,
// generic or place words, or into the words of the keyword or of what the client protected (its ladder heads, its services), describes what
// the site sells ("erp-software.ae", "crmexperts.ae", "accountingsoftware.ae", "interiordesign-dubai.com"); it is not a name, and a keyword
// built from those words is the client's own subject. "techand" does not split ("tech" + the stop word "and" is not allowed), so "techand crm"
// stays the site's own brand. The label itself is never part of its own vocabulary, so "crmexperts reviews" (one word) is still the brand.
const FIT_CATEGORY = new Set(['expert', 'experts', 'specialist', 'specialists', 'consultant', 'advisor', 'advisors', 'advisory', 'agency', 'agencies', 'design', 'designs', 'designer', 'designers',
  'interior', 'interiors', 'outsourcing', 'marketing', 'seo', 'legal', 'law', 'lawyer', 'lawyers', 'clinic', 'clinics', 'dental', 'medical', 'health', 'care', 'realty', 'property', 'properties', 'homes',
  'travel', 'tours', 'logistics', 'cargo', 'shipping', 'trading', 'auto', 'autos', 'cars', 'motors', 'insurance', 'printing', 'events', 'cleaning', 'maintenance', 'security', 'training', 'courses',
  'implementation', 'integration', 'migration', 'support', 'hosting', 'it', 'hr', 'audit', 'auditing', 'bookkeeping', 'consult', 'advice', 'pros', 'works', 'labs', 'studio', 'studios',
  'center', 'centre', 'source', 'point', 'zone', 'link', 'links', 'line', 'now', 'hq', 'co', 'inc', 'llc', 'ltd', 'fz', 'fzco', 'fze', 'dmcc']);
const fitWordBreak = (label, vocab) => { const n = label.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
  for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 30); j < i; j++) if (ok[j] && vocab.has(label.slice(j, i))) { ok[i] = true; break; }
  return ok[n]; };
const fitOwnLabels = (domain, toks, protect) => fitLabels(domain, []).filter(l => {
  const words = [...FIT_GENERIC, ...FIT_GEO, ...FIT_CATEGORY, ...(toks || []), ...(protect || [])].map(w => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(w => w.length >= 2 && w !== l && !FIT_STOP.has(w));
  const vocab = new Set(); for (const w of words) { vocab.add(w); vocab.add(w + 's'); if (w.length > 3 && w.endsWith('s')) vocab.add(w.slice(0, -1)); }
  vocab.delete(l);
  return !fitWordBreak(l, vocab); });
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
// ---- R13 (2026-10-13, re-rating §3.11): TOPIC DISTANCE, the same 25% bar the outreach gate uses (OK.OFF_TOPIC in _outreach_kit.js) ----
// The full report's §4a offered "ai" (165,000/mo), "character ai" (110,000), "google ai", "humanize ai", "meta ai", "blackbox ai",
// "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id status with passport
// number", under a High finding telling the owner to build pages for them: the gate only ever refused classes somebody had listed
// (navigational, a declared competitor, a results-page label), so a brand or a subject nobody listed walked straight through. fitTopic()
// measures what share of a keyword's OWN distinctive words the site's topics carry. Place names and generic category words are neutral —
// they count for neither side, so "best erp software dubai" is judged on "erp" — and a keyword left with nothing but generic or place
// words ("ai", "google ai", "microsoft ai") is too broad for any page of this site to win.
const FIT_TOPIC_BAR = 0.25;
// B-3: category words too wide to stand for what a site sells on their own: "dubai business tax" and "uae businesses" were judged "a category you
// sell (business) in your market" because the site's services name "Dynamics 365 Business Central". They never count for a head term.
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).normalize('NFKC').toLowerCase()
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = fitLow(t).split(FIT_SPLIT_WORDS).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
    return { dist: [...new Set(w.filter(x => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] }; })
  .filter(p => p.dist.length).map(p => ({ ...p, prose: p.dist.length > 6 }));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !/^\d+$/.test(t));   // F-KW: a year or a number ("2026") is neutral, like a place
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !/^\d+$/.test(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    return { ok: false, reason: 'too broad', detail: 'only category or place words, so it says nothing about ' + label + ' ("' + String(keyword || '').trim() + '")', share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * hits.length / own.length) / 100;
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label, share };
}
// ---- F-KW (2026-10-20, findings 1 and 2): POSITIVE topic evidence, for the decisions that write on their own ----
// fitTopic answers "may we refuse it?" and, with fewer than 12 topic words on file, refuses nothing ("no evidence, no refusal"). That is the
// right rule for a refusal and the wrong one for writing a page on our own: a site that lists two services passed every keyword. fitEvidence
// answers "is there evidence it is the client's subject?": `in` = at least the topic bar of the keyword's own words is in the topics given (any
// number of topic words); `out` = with 12+ topic words on file the keyword misses the bar (a refusal); `unknown` = too little on file to say,
// which a caller must treat as NOT in topic (a suggestion at most) and say so in plain words.
// F-REH (2026-10-20, real-credit rehearsal): a DECLARED service's product-category word is positive evidence. "crm service provider uae" for a
// client who listed "CRM implementation" came back "not enough information": `crm` is a category word (FIT_GENERIC), which the share rule
// treats as neutral, so the keyword was judged on "provider" alone. When the client named the category in a service (ctx.services = the
// services they DECLARED, never the crawl's guesses), that word counts as one of the keyword's own words AND as a hit, at any number of topic
// words on file. Only product categories qualify: `ai`, `software`, `cloud` and the wide words never do ("character ai" stays off topic for an
// "AI consulting" site); a FIT_COMMON word ("sales", "central") still needs the whole service name, as in fitTopic.
const FIT_SERVICE_CATS = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
const fitServiceAnchors = (keyword, services) => {
  const svc = new Set((Array.isArray(services) ? services : [services]).filter(Boolean).flatMap(x => fitTokens(String(x))).filter(t => FIT_SERVICE_CATS.has(t)).map(fitStem));
  if (!svc.size) return [];
  return [...new Set(fitTokens(keyword).filter(t => FIT_SERVICE_CATS.has(t) && svc.has(fitStem(t))))];
};
function fitEvidence(keyword, topics, ctx) {
  const o = ctx || {};
  const T = fitTopicWords(topics);
  const anchors = fitServiceAnchors(keyword, o.services || []);
  const t = T.size ? fitTopic(keyword, topics, { ...o, topic_min_words: 1 }) : { ok: false, share: null, detail: '' };
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail, basis: 'topics' };
  if (anchors.length) {
    // the share again, with the declared category word counted as the keyword's own and as matched
    const toks = fitTokens(keyword);
    const own = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !/^\d+$/.test(x));
    const PH = fitTopicPhrases(topics), known = [...T];
    const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
    const ownStems = own.map(fitStem), allStems = toks.filter(x => x.length > 2 && !FIT_GEO.has(x)).map(fitStem);
    const viaName = (w) => { const s = fitStem(w); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x)) && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
    const hit = (w) => FIT_COMMON.has(w) ? viaName(w) : (T.has(fitStem(w)) || known.some(x => stemHit(fitStem(w), x)));
    const hits = own.filter(hit).length + anchors.length, all = own.length + anchors.length;
    const share = Math.round(100 * hits / all) / 100;
    const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
    if (share >= bar) return { verdict: 'in', share, words: T.size, basis: 'declared service', anchors,
      detail: '"' + anchors.join('", "') + '" is one of the services you listed' + (own.length ? ' (' + Math.round(share * 100) + '% of its own words match)' : '') };
  }
  if (!T.size) return { verdict: 'unknown', share: null, words: 0, detail: 'nothing is on file yet about what this website sells or which keywords you chose' };
  if (T.size >= 12) return { verdict: 'out', share: t.share == null ? null : t.share, words: T.size, detail: t.detail };
  return { verdict: 'unknown', share: t.share == null ? null : t.share, words: T.size, detail: 'too little is on file about what this website sells to tell whether this keyword is part of it' };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  const kw = String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  // 1. the website itself
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  for (const l of fitOwnLabels(ctx.own_domain, toks, protect)) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 3. a public body or an identity document: "ministry of finance", "federal tax authority" (no content / buying word), "fta", "emaratax uae",
  //    "emirates id status" (the body alone, or with a portal / status word); "zatca e invoicing" and "fta vat registration" are topics and stay
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: 'a public body, not a topic (' + String(govWord[1] || govWord[0]).trim() + ')' };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter(t => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: 'a public body or an identity document, not a topic (' + body + ')' };
    // R60 (2026-10-16, re-rating 2026-10-15): "mofa attestation dubai" and "how to check emirates id status with passport number" walked
    // through because one more word ("attestation", "passport") or a content word ("how to") made them look like a topic. A word that only
    // names what the public body does FOR A PERSON (attest a document, issue a passport or visa, renew a card, collect a fine, book an
    // appointment) adds no topic: the searcher still wants the body's own service, whatever "how to" is in front of it. "fta vat registration"
    // and "zatca e invoicing" keep a business topic word of their own, so they stay.
    if (rest.every(t => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: 'a service a public body provides to a person, not a topic for this website (' + body + ': ' + rest.join(' ') + ')' };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) ? fitTopicWords(ctx.topics) : null;
  const sells = (re) => !!topicT && [...topicT].some(w => re.test(w));
  // 3b. a document service a public body provides to a person, without the body's name ("uae document attestation"): refused unless the
  //     site's own topics say it sells that service (an attestation agency keeps it)
  const docSvc = toks.filter(t => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(t => !FIT_GEO.has(t) && !FIT_DOC_SERVICE.test(t) && !FIT_GOV_SERVICE.test(t) && !FIT_GOV_NAMES.test(' ' + t + ' ')
      && !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t));
    if (!restD.length) return { ok: false, reason: 'government', detail: 'a document service public bodies (a ministry, an embassy, a notary) provide to a person (' + docSvc.join(' ') + '), not a topic for this website' };
  }
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 4b. a person looking for work (B-3): no product word in it, and the site's topics are not recruitment
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return { ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' };
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !protect.includes(t));
    if (!nt.length || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  else if (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) {
    const t = fitTopic(kw, ctx.topics, ctx); if (!t.ok) return { ok: false, reason: t.reason, detail: t.detail };
  }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- R16 (2026-10-13, system review FIX_PLAN §3.11): the same gate, run over a row somebody stored BEFORE the gate existed ----
// The gate stops a new keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of lad_mv40b6s9h5a8 still held
// "facts erp" (facts.ae, a competing UAE ERP vendor) as a planned page, so the Rank Tracker's report of 2026-10-12 listed it and the
// Content Cadence would have written it. `fitStored` is `fitGate` plus the one rule a stored row needs: a rung whose page is already
// written or published is never dropped — that page is live work, it keeps being tracked, and it is flagged instead of hidden.
// Returns { ok, live, flagged, reason, detail, note }: ok false = leave it out of what is written and reported; `note` is the sentence
// a report or the repair script prints, so the reason always travels with the decision.
const fitStoredLive = (row) => { const r = row || {}; const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
const fitStored = (row, ctx) => {
  const r = row || {}; const kw = String(r.keyword || '').trim();
  const live = fitStoredLive(r) || (ctx || {}).written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx || {});
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = '"' + kw + '" is not a search this website should target: ' + g.detail + ' (' + g.reason + ')';
  // F-KW (2026-10-20, finding 10): plain sentences, and no claim about WHEN the row was planned: a row written after the gate existed (its
  // results page changed, a competitor was declared later) is set aside by the same rule, and "planned before this rule existed" was false for it
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. Its page is already written, so it stays tracked; decide whether to keep it.' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. It is set aside, so no page is written for it.' };
};
// ---- B-G1 / B-G2 / B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the READ path, written once ----
// R16 put `fitStored` on two read paths — the Rank Tracker and the Content Cadence — and wrote the loop around it twice. Three more
// readers of the same stored rungs were written afterwards without it, and every one of them ACTS on what it reads: *AI Plan* (the AI
// Visibility Tracker and the AI Pulse) turns a stored rung into a question asked of ChatGPT and then scores the site against the answer;
// *Growth Plan* turns it into a "question to win" and then into a page the Content Cadence writes; *Site Plan* buys it a live rank check
// every week and prints it in the weekly report. Three copies of one loop are three chances to drift, and the drift IS this defect — so
// the loop lives here, once, and every reader calls it. FITR.rungs() never throws a refusal away: `set_aside` carries the row, the reason
// and the sentence to print, because a list that is shorter because a gate ran has to say so (INVARIANTS rule 1).
const FITR = {
  // The context a stored row is judged in. Deliberately the shape R16's two callers build by hand: the site's own domain, the
  // competitors it declared, the brand names AI uses for other companies, and — PROTECTED, so the ladder's own subject can never look
  // like somebody's brand — the ladder head terms, the site's services and its own tracked keywords. Topics are optional: with none on
  // file the topic bar judges nothing (fitTopic's own "no evidence, no refusal" rule).
  ctx(o) {
    o = o || {};
    const own = fitHost(o.own_domain || o.domain || '');
    const protect = [...new Set([...(o.heads || []), ...(o.services || []), ...(o.keywords || []), ...(o.protect || [])]
      .map(x => String(x || '').trim()).filter(Boolean))];
    return { own_domain: own, brands: o.brands || {}, intent: o.intent || '',
      competitors: [...new Set((o.competitors || []).map(fitHost).filter(d => d && d !== own))],
      serp_domains: (o.serp_domains || []).map(fitHost).filter(Boolean), protect,
      topics: o.topics && (Array.isArray(o.topics) ? o.topics.length : String(o.topics).trim()) ? o.topics : null,
      topic_label: o.topic_label || 'what this website sells' };
  },
  // Every stored row, gated once. Returns { keep, set_aside, dropped, flagged, refused_keywords }:
  //   keep      — what the caller may act on (a row whose page is already written stays: that page is live work);
  //   set_aside — one record per refusal, with `reason`, `detail`, `note` (the sentence to print), `written` and `dropped`.
  // opts: { keyword: row -> the keyword (default row.keyword), live: row -> true when the row must be kept and only flagged,
  //         serpFor: (keyword, row) -> [domains in rank order] for the results-page rules, where: a label naming this read path }.
  rungs(rows, ctx, opts) {
    const o = opts || {}; const C = ctx || {};
    const kwOf = typeof o.keyword === 'function' ? o.keyword : ((r) => (r || {}).keyword);
    const liveOf = typeof o.live === 'function' ? o.live : null;
    const serpFor = typeof o.serpFor === 'function' ? o.serpFor : null;
    const keep = []; const set_aside = [];
    for (const r0 of (rows || [])) {
      const r = (r0 && typeof r0 === 'object') ? r0 : {};
      const kw = String(kwOf(r0) || '').trim();
      if (!kw) { keep.push(r0); continue; }   // a row with no keyword is not this gate's business (the caller's own emptiness rules apply)
      const serp = serpFor ? (serpFor(kw, r0) || []).map(fitHost).filter(Boolean) : [];
      let c = C;
      if (serp.length) c = { ...c, serp, serp_domains: [...new Set([...(C.serp_domains || []), ...serp])] };
      if (liveOf && liveOf(r0)) c = { ...c, written: true };
      const g = fitStored({ ...r, keyword: kw }, c);
      if (g.ok) keep.push(r0);
      if (!g.flagged) continue;
      set_aside.push({ keyword: kw, reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok,
        where: String(o.where || ''), ladder_id: r.ladder_id || '', head_keyword: r.head_keyword || '', rung: Number(r.rung) || 0,
        page_no: Number(r.page_no) || 0, status: r.status || '', target_url: r.target_url || '', prompt_id: r.prompt_id || '' });
    }
    return { keep, set_aside, dropped: set_aside.filter(x => x.dropped), flagged: set_aside.filter(x => !x.dropped),
      refused_keywords: set_aside.filter(x => x.dropped).map(x => x.keyword) };
  },
  // The sentence a human reads. INVARIANTS rule 1: a list that is shorter because a gate ran says so, with the reason, every time.
  // `what` finishes "so they are not …" ("asked of the AI engines", "tracked", "written as a page").
  line(set_aside, what) {
    const a = (set_aside || []).filter(x => x && x.dropped);
    if (!a.length) return '';
    return a.length + ' stored keyword' + (a.length === 1 ? ' was' : 's were') + ' set aside, so ' + (a.length === 1 ? 'it is' : 'they are')
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" (' + (x.detail || x.reason) + ')').join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. A page that is already written is kept and only flagged.';
  }
};
// ---- the page type, as one of the options the form offers (D10, 2026-10-12; the builders inline this file where a node asks for the PAGE_TYPE kit) ----
// The verdict and the keyword screen answer in free text: the live page of execution 365 was planned as "Service Page (ERP implementation
// UAE) with built-in vendor-neutral comparison, cost and compliance sections". That sentence then travelled as the page type into the brief
// (which read it as a guide and set 3,100 words), into the schema and into meta.json. PT.of() maps any such text to one of the fixed options
// and PT.notes() keeps the sentence itself, so nothing the verdict said is lost — it reaches the brief as page_notes instead.
const PT = (() => {
  const TYPES = ['Service Page', 'Product Page', 'Blog Post', 'Landing Page', 'Guide', 'Pillar Page', 'Local Page', 'Case Study'];
  // first match wins by POSITION in the text, not by rule order: "Service Page (…) with built-in vendor-neutral comparison" is a service
  // page that also compares, not a comparison guide.
  const RULES = [[/case stud/i, 'Case Study'], [/\bpillar\b|\bhub\b|topic cluster/i, 'Pillar Page'], [/\blocal\b|city page|area page/i, 'Local Page'],
    [/\bproducts?\b|e-?commerce|\bshop\b|\bstore\b|catalou?g/i, 'Product Page'], [/landing|lead capture|campaign page|squeeze/i, 'Landing Page'],
    [/\bblogs?\b|\bnews\b|\barticles?\b|\bposts?\b/i, 'Blog Post'],
    [/\bguides?\b|how.?to|tutorial|comparison|compare|versus|\bvs\b|\bfaqs?\b|resource|checklist|listicle|round.?up|explainer|glossary/i, 'Guide'],
    [/\bservices?\b|solution|category|collection|offering/i, 'Service Page']];
  const of = (v, dflt) => {
    const t = String(v == null ? '' : v).trim();
    const fallback = TYPES.find(x => x.toLowerCase() === String(dflt || '').trim().toLowerCase()) || 'Service Page';
    if (!t) return fallback;
    const exact = TYPES.find(x => x.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    let best = null;
    for (const r of RULES) { const i = t.search(r[0]); if (i >= 0 && (!best || i < best.i)) best = { i: i, type: r[1] }; }
    return best ? best.type : fallback;
  };
  // the free text, kept for the brief; empty when it says nothing beyond the type itself (the form's own wording included)
  const SAME = ['pillar / hub page', 'pillar/hub page', 'hub page', 'local page (city or area)', 'case study page'];
  const notes = (v, type) => {
    const t = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (!t) return '';
    const bare = t.replace(/[.\s]+$/, '').toLowerCase();
    if (bare === String(type || '').toLowerCase() || TYPES.some(x => x.toLowerCase() === bare) || SAME.indexOf(bare) >= 0) return '';
    return t.slice(0, 300);
  };
  return { of: of, notes: notes, TYPES: TYPES };
})();
// ---- the one site model (G19, 2026-10-12; see SITE_MODEL_SPEC.md; the builders inline this file where a node asks for the SITE_MODEL kit) ----
// Every workflow reads the same facts about a site through SM: the canonical host, the business name / logo / NAP (seo_profiles ->
// the homepage Organization / LocalBusiness schema -> Google Business Profile -> the fields the web app sent), the services and nav
// pages, the page inventory (seo_pages), the business facts, the call to action, the brand names, the competitors and the
// accreditation status. SM.from() builds the model, SM.toRow() writes it back to the seo_sites columns.
const SM = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const normHost = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const bare = (v) => normHost(v).replace(/^www\./, '');
  const hostOf = (u) => normHost((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const siteIdFor = (d) => 'site_' + bare(d).replace(/[^a-z0-9]+/g, '-');
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => S(x)).filter(Boolean);
  const uniq = (a) => [...new Set(a)];
  const jparse = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };
  const STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
  const tokensOf = (s) => S(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // one-letter parts ("e" of "e invoicing") and stop words never decide a page match: with them "e invoicing uae penalties" would
  // score 3 of 4 against /uae-e-invoicing-fta-rules/ and claim the FTA page (the S26 false-match pair).
  const termsOf = (s) => uniq(tokensOf(s).filter(t => t.length > 1 && !STOP.has(t)));
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, ''); return p || '/'; };
  const strip = (s) => S(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---- the homepage HTML: canonical host, Organization / LocalBusiness schema, nav pages ----
  const ldNodes = (html) => {
    const out = []; const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    const push = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(push); return; } out.push(o); if (Array.isArray(o['@graph'])) o['@graph'].forEach(push); };
    while ((m = re.exec(S(html)))) push(jparse(m[1], null));
    return out;
  };
  const ORG_TYPE = /(organization|corporation|localbusiness|professionalservice|store|ngo|educationalorganization|governmentorganization|onlinebusiness|softwarecompany|company|consultant|accountingservice)/i;
  const typesOf = (o) => [].concat((o && o['@type']) || []).map(t => S(t).toLowerCase());
  const orgFromHtml = (html) => {
    const nodes = ldNodes(html).filter(o => typesOf(o).some(t => ORG_TYPE.test(t)));
    const node = nodes.find(o => typesOf(o).some(t => /localbusiness|professionalservice|store/.test(t))) || nodes[0];
    if (!node) return null;
    const logo = typeof node.logo === 'string' ? node.logo : ((node.logo || {}).url || '');
    return { name: S(node.name), type: typesOf(node).join('/'), telephone: S(node.telephone), email: S(node.email), logo: S(logo),
      sameAs: listOf(node.sameAs), address: (node.address && typeof node.address === 'object') ? node.address : null };
  };
  const navFromHtml = (html, host) => {
    const h = S(html); const zones = [];
    for (const re of [/<nav\b[\s\S]*?<\/nav>/gi, /<header\b[\s\S]*?<\/header>/gi]) { const f = h.match(re); if (f) zones.push(...f); }
    const out = []; const seen = new Set();
    for (const zone of zones) {
      for (const a of (zone.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [])) {
        const href = S((a.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1]);
        if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
        const abs = /^https?:\/\//i.test(href) ? href : (href.charAt(0) === '/' ? 'https://' + host + href : '');
        if (!abs || bare(hostOf(abs)) !== bare(host)) continue;
        const p = pathOf(abs); if (p === '/' || seen.has(p)) continue;
        seen.add(p); out.push({ url: abs, title: strip(a).slice(0, 80), path: p });
        if (out.length >= 12) return out;
      }
    }
    return out;
  };

  // ---- precedence: seo_profiles -> homepage schema -> Google Business Profile -> what the app sent ----
  const pick = (sources, read) => { for (const s of sources) { const v = S(read(s.value) || ''); if (v) return { value: v, source: s.name }; } return { value: '', source: '' }; };

  const from = (siteRow, extras) => {
    const row = (siteRow && typeof siteRow === 'object') ? siteRow : {};
    const x = (extras && typeof extras === 'object') ? extras : {};
    const req = x.request || {};
    const prof = x.profile || {};
    const gbp = x.gbp || {};
    const html = S(x.html || (x.home || {}).html);
    const domain = bare(row.domain || x.domain || req.domain || (x.home || {}).url || '');
    const site_id = S(row.site_id) || S(x.site_id) || (domain ? siteIdFor(domain) : '');
    const org = x.homepage_org || (html ? orgFromHtml(html) : null) || null;

    // canonical host: this run's probe, else the homepage's own canonical tag, else where the homepage request landed, else the stored
    // value, else the bare domain. A canonical tag on another domain is ignored.
    const canonTag = (S(html).match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
    const canonHost = hostOf((canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const landed = hostOf(x.final_url || (x.home || {}).url || '');
    const fromProbe = normHost(x.canonical_host || (x.probe || {}).canonical_host || '');
    // the site's own live URLs (ladder pages, published pages, sitemap) are evidence too: the host most of them use
    const voted = (() => { const c = {}; for (const u of (x.seen_hosts || [])) { const h = normHost(u.indexOf('/') >= 0 ? hostOf(u) || u : u); if (h && bare(h) === domain) c[h] = (c[h] || 0) + 1; }
      return Object.keys(c).sort((a, b) => c[b] - c[a] || a.length - b.length)[0] || ''; })();
    const candidates = [[fromProbe, 'probe'], [bare(canonHost) === domain ? canonHost : '', 'canonical tag'], [bare(landed) === domain ? landed : '', 'redirect'], [voted, 'live urls'], [normHost(row.canonical_host), 'stored'], [domain, 'domain']];
    const hit = candidates.find(c => c[0]) || [domain, 'domain'];
    const canonical_host = hit[0], host_source = hit[1];

    const SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: org || {} }, { name: 'gbp', value: gbp }, { name: 'app', value: req }, { name: 'stored', value: { business_name: row.business_name, logo_url: row.logo_url } }];
    const nameHit = pick(SRC, (s) => s.business_name || s.name || s.title);
    const logoHit = pick(SRC, (s) => s.logo_url || s.logo || s.photo_url);
    const addr = (org && org.address && typeof org.address === 'object') ? org.address : {};
    const NAP_SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: { street_address: addr.streetAddress, city: addr.addressLocality, region: addr.addressRegion, postal_code: addr.postalCode, country_code: addr.addressCountry, phone: (org || {}).telephone, public_email: (org || {}).email } },
      { name: 'gbp', value: { street_address: gbp.address, city: gbp.city, phone: gbp.phone } }, { name: 'app', value: req }];
    const street = pick(NAP_SRC, (s) => s.street_address), phone = pick(NAP_SRC, (s) => s.phone);
    const nap = { business_name: nameHit.value, street_address: street.value, city: pick(NAP_SRC, (s) => s.city).value, region: pick(NAP_SRC, (s) => s.region).value,
      postal_code: pick(NAP_SRC, (s) => s.postal_code).value, country_code: pick(NAP_SRC, (s) => s.country_code || s.country).value,
      phone: phone.value, public_email: pick(NAP_SRC, (s) => s.public_email || s.email).value, price_range: S(prof.price_range), source: street.source || phone.source || '' };
    const stored = jparse(row.nap_json, null);
    if (stored && !nap.street_address && !nap.phone) { Object.assign(nap, stored); nap.source = S(stored.source) || 'stored'; }

    // P2-2 (2026-10-12): the Site Describer answers with `products_or_services` — reading only `services` left services_json empty on every
    // site, so the brief's facts said `services: []` although the describer had found nine.
    const desc0 = x.description || {};
    // keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.2 / §14.1): what the client SAID they sell ("What do you sell?" on Track my site,
    // seo_sites.declared_services) comes first and is never dropped by what a crawl read; it is kept apart as well, so SM.toRow writes it back
    // unchanged and the weekly Site Tracker can never overwrite it
    const declListOf = (v) => { if (Array.isArray(v)) return v; const j = jparse(v, null); return Array.isArray(j) ? j : listOf(v); };
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, declared_services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
      model_updated_at: updated_at, sources: { profile: !!prof.site_id || !!prof.business_name, homepage_schema: !!org, gbp: !!(gbp.name || gbp.phone), app: !!(req.business_facts || req.cta || req.business_name), html: !!html } };
  };

  // every URL the agent emits for a site goes through here: https, the canonical host, no double slash
  const siteUrl = (model, path) => {
    const p = S(path);
    if (/^https?:\/\//i.test(p)) return p;
    const host = normHost((model || {}).canonical_host || (model || {}).domain || '');
    const tail = p ? ('/' + p).replace(/\/{2,}/g, '/') : '/';
    return 'https://' + host + tail;
  };
  const apiTarget = (model) => bare((model || {}).domain || (model || {}).canonical_host || '');   // DataForSEO and the other APIs keep the bare domain
  const name = (model) => S((model || {}).business_name) || bare((model || {}).domain || '');
  const nap = (model) => ((model || {}).nap && typeof model.nap === 'object') ? model.nap : { business_name: '', street_address: '', city: '', region: '', postal_code: '', country_code: '', phone: '', public_email: '', price_range: '', source: '' };
  const services = (model) => Array.isArray((model || {}).services) ? model.services : [];
  const pages = (model) => Array.isArray((model || {}).pages) ? model.pages : [];
  const facts = (model) => {
    const t = S((model || {}).business_facts) + ' ' + S(((model || {}).nap || {}).price_range);
    return { business_facts: S((model || {}).business_facts), cta: S((model || {}).cta), accreditation: S((model || {}).accreditation),
      pricing: /(aed|usd|\$|€|£|price|pricing|cost|fee|per month|per user|from \d)/i.test(t),
      timeline: /(\d+\s*(day|week|month|year)|timeline|go.?live|turnaround|within \d)/i.test(t) };
  };
  // a page of the inventory answers a keyword when it already gets impressions for it, or when at least 75% of the keyword's
  // meaningful words are in its slug or title (D11; keep it even while the inventory is empty).
  const MATCH_MIN = 0.75;
  // R35 (2026-10-16, re-rating 2026-10-15): the words were compared literally, so "d365 finance dubai" did not match a page titled
  // "Dynamics 365 Finance & Operations UAE" and the report told the owner that page "does not target" the search. Three rules, applied
  // to BOTH sides before anything is compared: the product's own short names are written out (d365 = dynamics 365, f&o = finance and
  // operations), a word is compared on a light stem (invoice / invoices / invoicing), and an emirate in the SEARCH is covered by a page
  // about the UAE ("emirate ⊂ uae" — never the other way round: a Dubai page does not answer every UAE search).
  const SYN = [[/\bd\s?365\b/g, 'dynamics 365'], [/\bdynamics365\b/g, 'dynamics 365'], [/\bf\s?&\s?o\b|\bfno\b/g, 'finance operations'], [/\bunited arab emirates\b/g, 'uae'],
    [/\babu dhabi\b/g, 'abudhabi'], [/\bras al khaimah\b/g, 'rasalkhaimah'], [/\bumm al quwain\b/g, 'ummalquwain'], [/\bal ain\b/g, 'alain']];
  const EMIRATES = new Set(['dubai', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rasalkhaimah', 'rak', 'ummalquwain', 'alain']);
  const norm = (s) => { let t = S(s).toLowerCase().replace(/&amp;/g, '&'); for (const [re, to] of SYN) t = t.replace(re, to); return t; };
  const stem = (t) => t.length >= 5 ? t.replace(/(ings?|ed|es|(?<!s)s)$/, '').replace(/e$/, '') : t;   // business = businesses, invoice = invoicing
  const matchTerms = (s) => uniq(termsOf(norm(s)).map(stem));
  // a keyword term is covered by a page's terms: the same stem, or an emirate in the search against a page about the UAE
  const covers = (set, t) => set.includes(t) || (EMIRATES.has(t) && (set.includes('uae') || set.includes('emirat')));
  const shareIn = (want, set) => want.length ? want.filter(t => covers(set, t)).length / want.length : 0;
  // R56: a listing page (the blog / insights index, a category, a tag) gets impressions for every article it lists; when a dedicated
  // page matches the same search by its own slug or title, the dedicated page is the one that answers it
  const LISTING = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;
  const isListing = (u) => { const p = pathOf(u).replace(/[?#].*$/, ''); return LISTING.test(p); };
  const untitled = (model) => pages(model).filter(p => !S(p.title) && !S(p.h1));
  const matchPage = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url)))) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    if (qHit && best) return { ...best, listing: listingOf(qHit, best) };
    return qHit || best;
  };
  // A-22 (2026-10-17): how well ONE page of the inventory targets a search by its own words (slug or title / H1, the matchPage rule), so a
  // caller that already knows the page Google ranks can ask whether another page targets the search more closely - never to replace it
  const pageScore = (page, keyword) => { const p = page || {}; const want = matchTerms(keyword); if (!want.length || !S(p.url)) return null;
    return Math.round(Math.max(shareIn(want, matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''))), shareIn(want, matchTerms(S(p.title) + ' ' + S(p.h1)))) * 100) / 100; };
  // R35: how much of a search a page's OWN title / H1 holds (null when the page's title was never read) - the only evidence that may call
  // a page "about something else"
  // the words of a spoken / long-tail search that say nothing about the subject ("which ... can help ... in the uae")
  const FILLER = new Set(['which', 'what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'help', 'helps', 'best', 'top', 'near', 'me', 'is', 'are', 'do', 'does', 'should', 'will', 'would', 'get', 'need', 'i', 'we', 'you']);
  const titleShare = (page, keyword) => { const p = page || {}; if (!S(p.title) && !S(p.h1)) return null;
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem)); if (!want.length) return null; const set = matchTerms(S(p.title) + ' ' + S(p.h1));
    return { share: Math.round(shareIn(want, set) * 100) / 100, have: want.filter(t => covers(set, t)).length, of: want.length, missing: want.filter(t => !covers(set, t)) }; };
  // R34: the pages whose title was never read, so a caller can say what it judged on the address alone instead of reading nothing silently
  const titleGap = (model) => { const all = pages(model); const u = untitled(model);
    return { pages: all.length, untitled: u.length, urls: u.slice(0, 12).map(p => p.url),
      note: u.length ? u.length + ' of the ' + all.length + ' pages of the site have no title on file yet (the weekly site check reads them a batch at a time), so they were judged by their address only' : '' }; };
  // R55: a URL of the site as the site serves it (canonical host); another site's URL is returned as it is
  const canonUrl = (model, u) => { const h = hostOf(u); if (!h || bare(h) !== bare((model || {}).domain || (model || {}).canonical_host || '')) return S(u); return siteUrl(model, pathOf(u)); };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q; } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at', 'declared_services'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at),
      declared_services: JSON.stringify(Array.isArray(m.declared_services) ? m.declared_services : []) };
  };
  // B4-1 / B4-2 (2026-10-15, benchmark area 4): the measurement columns belong to the row, so the kit emits them — a Data Table
  // node auto-maps every field it is given, and a row that is short of a column is as wrong as one that carries a stray field.
  // The model itself measures nothing: these are the defaults the Site Tracker's own judgement is written over
  // (v5/code/Page_Inventory_Site.js), and `''` for decay_state means "never measured", never "steady".
  const num0 = (v) => (Number(v) || 0);
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString(),
    clicks: num0(p.clicks), impressions: num0(p.impressions), position: num0(p.position), prev_clicks: num0(p.prev_clicks), yoy_clicks: num0(p.yoy_clicks),
    decay_state: S(p.decay_state), decay_pct: num0(p.decay_pct), decay_lost: num0(p.decay_lost), decay_kind: S(p.decay_kind),
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at) }));
  // ---- C-7 (re-rating 2026-10-17): ONE page state per keyword, read by the Rank Tracker AND the Site Tracker (and so by the cadence) ----
  // In one morning the Rank Tracker said of "ai consulting" "…/ai-copilot-advisory-uae already answers this search - refresh that page"
  // while the Site Tracker said "fix the four drafts that failed the quality check and run them again", and of "it consulting dubai"
  // "write the main page" while the Site Tracker and the cadence said "written today, failed QA, fix it". The order of evidence is one:
  // a LIVE page of the site that answers the search wins (refresh it; a draft written for the search is retired, never a second page);
  // then a written draft (publish it); then a draft that failed its quality check (fix it and run it again); then a run that wrote nothing.
  // in: { keyword, covered_url, written, not_ready, reasons (array or '; ' text), started } -> { state, text } (text: the parenthesis a list uses)
  const pageStep = (o) => {
    const c = o || {}, kw = S(c.keyword), why = (Array.isArray(c.reasons) ? c.reasons : S(c.reasons).split(/;\s+/)).map(S).filter(Boolean).slice(0, 2).join('; ').slice(0, 220);
    if (S(c.covered_url)) return { state: 'covered', text: S(c.covered_url) + ' already answers this search — refresh that page, do not publish a second one'
      + (c.not_ready || c.written ? '; the draft written for "' + kw + '" is not needed (use its text to refresh that page)' : '') };
    if (c.written) return { state: 'written', text: 'already written — publish it' };
    if (c.not_ready) return { state: 'not_ready', text: 'written, but the draft did not pass the quality check' + (why ? ' (' + why + ')' : '') + ' — fix it and run it again; do not publish it as it is' };
    if (c.started) return { state: 'started', text: 'a page run was started for it but no page was written — it is written again' };
    return { state: 'planned', text: '' };
  };
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms } };
})();
// ---- what the keyword research is allowed to use, and what its numbers mean (2026-10-13, FIX_PLAN G8; criteria K2 / K4 / K6 / K7) ----
// Three inputs the research was missing, all built from data the run already holds (no extra paid call):
//   * KWI.gscSeeds()     - the site's OWN Search Console queries as discovery seeds: a query that gets impressions while no live page
//                          answers it (the D11 page inventory decides through SM.matchPage) and a striking-distance query (position
//                          8-20). Search Console is the only first-party record of what people really type, so it now seeds the paid
//                          pulls instead of only being read afterwards (K6).
//   * KWI.calibrate()    - the traffic estimate checked against the site's own measured clicks and impressions where it already
//                          ranks, labelled `calibrated` or `modelled`. A modelled number is never presented as measured (K2).
//   * KWI.serpClusters() - keywords grouped when their results pages share enough URLs, each cluster named by its head keyword and
//                          carrying the shared URLs, so one page can target the whole group (K7). Discovery compares the top 10 at 3
//                          shared URLs from results pages the run already fetched (the live checks and the competitors' own ranking
//                          URLs); the keyword ladder (B2-4, 2026-10-15) buys one results page per rung candidate and compares the
//                          TOP 7 at a 40% threshold, the convention's own current numbers (B2-6, `top_n` / `min_overlap`).
// Every function is pure and takes its thresholds as options, so the harness (S52) can drive it directly.
const KWI = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const low = (v) => S(v).toLowerCase().replace(/\s+/g, ' ');
  const yes = (v) => v === true || /^(true|1|yes|on)$/i.test(S(v));
  const CFG = {
    min_impressions: 10,        // a query needs this many impressions in the Search Console period before it seeds anything
    striking_min: 8,            // "striking distance": bottom of page 1 to the end of page 2, where one strong page moves the needle
    striking_max: 20,
    target_share: 0.75,         // A-22: a page's own slug / title targets a search at this share of its words (SM.MATCH_MIN)
    off_topic_share: 0.5,       // R35: a ranking page is "about something else" only when its own title / H1 hold less than half of the search's words
    max_seeds: 10,              // how many Search Console queries may be handed to the research as seeds
    period_days: 28,            // the Search Console window the Site Tracker stores (Site_Plan.js ranges.current)
    month_days: 30,
    top_share: 0.3,             // the share of a search a page in the top three takes (the modelled estimate uses the same share)
    min_shared_urls: 3,         // K7: a shared results page means at least this many of the same top-10 URLs
    min_urls: 3,                // a keyword needs this many known top-10 URLs before it can be compared at all
    max_cluster_keywords: 12,
    live_serp_checks: 16,       // K4: how many keywords get a live intent / page-type check (cost-aware cap, see LIVE_MAX)
    live_serp_max: 25,
    // B2-6 (2026-10-15, benchmark area 2, approved by the owner): Keyword Insights, whose convention the shared-URL rule is, now
    // compares the TOP 7 and not the top 10 - "the overlap setting was originally 1-10, it now runs from 1-7 because Google no longer
    // reliably shows 10 traditional links" - at a default threshold of 40% of them (https://docs.keywordinsights.ai/learning-center/
    // the-features/keyword-clustering/). `top_n` cuts every keyword's list to that depth BEFORE anything is compared, and
    // `min_overlap` turns the threshold into a share of it: ceil(7 x 0.4) = 3 of 7. Both default to 0 = off, so the discovery path
    // keeps the top-10 / 3-URL shape it was measured on until the orchestrator re-baselines K7; the ladder (B2-4) passes 7 / 0.4.
    top_n: 0,
    min_overlap: 0,
    // B2-4: how many of a ladder's rung candidates may be sent for a results page of their own, and what one costs. A full ladder
    // plans at most 11 pages (rung limits 4 / 4 / 3) and a page takes at most 7 keywords, so 24 covers more than twice the pages a
    // plan can hold; the rest of the pool would be bought for keywords no page will ever target.
    ladder_serp_checks: 24,
    ladder_serp_max: 30,
    serp_check_usd: 0.002       // one DataForSEO live-advanced SERP at depth 10, the same call the discovery live checks buy
  };
  const bare = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const cap = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // K4: how many live results-page checks this run may buy. One check is a DataForSEO live-advanced SERP at depth 10 (~$0.002), so the
  // default 16 costs about $0.032 a run against $0.016 at the old fixed 8; the owner may set it per run and it is hard-capped at 25.
  const liveChecks = (requested) => { const n = num(requested); return n == null || n <= 0 ? CFG.live_serp_checks : Math.round(cap(n, 1, CFG.live_serp_max)); };
  // B2-4: the same shape for the ladder's own cap. 0 or a negative number means "make no call at all" (a free run), which is why this
  // one does NOT fall back to the default when it is given a zero: a bound of nothing has to be expressible.
  const ladderChecks = (requested) => { const n = num(requested); if (n == null) return CFG.ladder_serp_checks; if (n <= 0) return 0; return Math.round(cap(n, 1, CFG.ladder_serp_max)); };
  const checkCost = (n) => +((Math.max(0, Number(n) || 0)) * CFG.serp_check_usd).toFixed(4);

  // ---- K6: the site's own Search Console queries as seeds ----
  // rows = seo_query_history rows (the Site Tracker writes one per site, query and 28-day period). Only the newest period counts:
  // the table only grows, so older rows would seed last month's picture.
  const gscSeeds = (rows, o) => {
    const c = { ...CFG, ...(o || {}) };
    const dom = bare(c.domain);
    const all = (Array.isArray(rows) ? rows : []).filter(r => r && S(r.query) && !r.error && (!dom || bare(r.domain) === dom));
    const period = all.reduce((m, r) => S(r.period_end) > m ? S(r.period_end) : m, '');
    const isScraper = typeof c.isScraper === 'function' ? c.isScraper : () => false;
    const isBrand = typeof c.isBrand === 'function' ? c.isBrand : () => false;
    const matchPage = typeof c.matchPage === 'function' ? c.matchPage : () => null;
    const dropped = { scraper: 0, brand: 0, low_impressions: 0, duplicate: 0 };
    const seen = new Set(); const considered = [];
    for (const r of all.filter(r => S(r.period_end) === period).sort((a, b) => (num(b.impressions) || 0) - (num(a.impressions) || 0))) {
      const q = low(r.query); if (!q) continue;
      if (seen.has(q)) { dropped.duplicate++; continue; }
      seen.add(q);
      if (isScraper(q)) { dropped.scraper++; continue; }
      if (isBrand(q)) { dropped.brand++; continue; }
      const impressions = num(r.impressions) || 0, clicks = num(r.clicks) || 0, position = num(r.position) || 0;
      if (impressions < c.min_impressions) { dropped.low_impressions++; continue; }
      // which page, if any, already answers this search: the page inventory first (D11), the page Search Console reports only when
      // the inventory is empty (then it is the best evidence we have, and it is labelled as such)
      const inv = matchPage(q, S(r.page));   // R35: the page Search Console credits wins a tie
      // R12 (2026-10-13, re-rating §3.11): 11 of 25 rows read "no page of yours answers this search" while the same row named a live
      // 200-OK page of the site — one of them ranking #6.2 — because only the slug / title match counted and the URL Search Console
      // itself reports was ignored whenever the inventory was non-empty. A URL on this site is evidence: it is the answering page, with
      // its own label ("the page that gets the impressions does not target this search"), so the report never asks the owner for a second
      // page for a search they already rank for (D11's cannibalisation rule, in the discovery path).
      // R55 (2026-10-16): Search Console reports the bare host for an sc-domain property while the inventory holds the canonical one,
      // so one table linked both. Every site URL printed goes through the site's canonical host (`c.canon`, SM.canonUrl); Google's own
      // URL stays as `gsc_page`.
      const canon = typeof c.canon === 'function' ? c.canon : (u) => u;
      const rowUrl = S(r.page);
      const rowBare = bare(rowUrl);
      const rowOnSite = !!rowUrl && !!rowBare && (!dom || rowBare === dom || rowBare.endsWith('.' + dom));
      const pageUrl = rowOnSite ? S(canon(rowUrl)) : rowUrl;
      // R35 (2026-10-16, re-rating 2026-10-15): a row whose page is on the site is a page that RANKS for the query. It used to be labelled
      // "the page that gets the impressions does not target this search" whenever the literal word matcher failed — 20 rows, 18 of them
      // the D365 F&O page for D365 F&O searches. A page is now called off-target only on evidence about the page itself: its own title /
      // H1 (`c.pageTitleShare`, SM.titleShare) holding less than half of the search's words, and the sentence says what was compared.
      const evidence = rowOnSite && typeof c.pageTitleShare === 'function' ? c.pageTitleShare(rowUrl, q) : null;
      const row_page = (rowUrl && (c.use_row_page || rowOnSite))
        ? { url: pageUrl, title: S(evidence && evidence.title), matched_by: c.use_row_page ? 'search console page' : 'search console' } : null;
      // A-22 (2026-10-17, re-rating 2026-10-17, exec 764): 17 of 79 rows named a different page than the one Search Console reports for the
      // query — "dynamics 365 finance and operations pricing dubai" ranks #9.6 with /dynamics-365-finance-and-operations-uae and the owner was
      // told to improve the VAT article, because the inventory's word match decided first and Google's own page only broke a tie. The page
      // Google ranks for a search (Search Console's query x page row) IS the answer. The word match is the fallback for a row with no page
      // of ours, and is labelled as such; where another page targets the search more closely by its words, both are named (`also`), never
      // swapped. The one exception stays R56: a listing page (the blog index) gets impressions for every article it lists, so the dedicated
      // page behind it answers, and the listing is named beside it.
      const listingOf = typeof c.isListing === 'function' ? c.isListing : () => false;
      const pageScore = typeof c.pageScore === 'function' ? c.pageScore : () => null;
      const ukey = (u) => bare(u) + S(u).toLowerCase().replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
      const invUrl = inv ? S(canon(S(inv.url))) : '';
      const invIsRow = !!inv && !!rowUrl && ukey(invUrl) === ukey(pageUrl);
      const listingRow = rowOnSite && listingOf(rowUrl) && !!inv && !invIsRow && !listingOf(inv.url);
      let answered_by = null;
      if (rowOnSite && !listingRow) {
        answered_by = { ...row_page, basis: 'the page Search Console reports for this search' };
        if (inv && !invIsRow && S(inv.matched_by) !== 'query') {
          const own = pageScore(rowUrl, q);
          if (own == null || (Number(inv.score) || 0) > own + 1e-9) answered_by.also = { url: invUrl, title: S(inv.title), matched_by: S(inv.matched_by), score: inv.score ?? null };
        }
      } else if (inv) {
        answered_by = { url: invUrl, title: S(inv.title), matched_by: S(inv.matched_by) || 'inventory',
          basis: listingRow ? 'the page about this search behind the listing page Google shows for it' : 'matched by its words: Search Console names no page of yours for this search',
          ...(inv.listing ? { listing: inv.listing } : listingRow ? { listing: { url: pageUrl, impressions: impressions,
            note: 'Google currently shows ' + (pageUrl.replace(/^https?:\/\/[^/]+/i, '') || '/') + ' (a listing page) for this search; the page that is about it is ' + (invUrl.replace(/^https?:\/\/[^/]+/i, '') || '/') } } : {}) };
      } else answered_by = row_page;
      const kinds = [];
      const ownScore = rowOnSite ? pageScore(rowUrl, q) : null;   // the ranking page's own words (slug or title / H1): a slug that targets the search is not "about something else"
      const offTopic = !!answered_by && answered_by.matched_by === 'search console' && !invIsRow && !!evidence && evidence.share != null && evidence.share < c.off_topic_share
        && !(ownScore != null && ownScore + 1e-9 >= c.target_share);
      const striking = position >= c.striking_min && position <= c.striking_max;
      const lowPos = position > c.striking_max;
      if (!answered_by) kinds.push('no_page');
      else if (offTopic) kinds.push('page_mismatch');
      else if (!inv && lowPos) kinds.push('low_position');
      if (striking) kinds.push('striking');
      const posTxt = position > 0 ? '#' + (Math.round(position * 10) / 10) : 'unreported';
      const pathTxt = answered_by ? (S(answered_by.url).replace(/^https?:\/\/[^/]+/i, '') || '/') : '';
      // A-22: the second page is named beside Google's own, never instead of it; a page matched by words alone says so
      const alsoTxt = answered_by && answered_by.also ? '; ' + (S(answered_by.also.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' matches the words of this search more closely: keep one page for it and link the other to it' : '';
      // a listing page (the blog index) is what Google shows; the position is ITS position, and the page about the search is named beside it
      const listPath = answered_by && answered_by.listing ? (S(answered_by.listing.url).replace(/^https?:\/\/[^/]+/i, '') || '/') : '';
      const rankTxt = listPath ? 'Google shows ' + listPath + ' (a listing page) at ' + posTxt + ' for it; the page about it is ' + pathTxt + ' (link it from ' + listPath + ')'
        : 'you rank ' + posTxt + ' with ' + pathTxt;
      const basisTxt = answered_by && answered_by.matched_by !== 'search console' && answered_by.matched_by !== 'search console page' && !answered_by.listing ? ' (matched by its words: Search Console names no page of yours for this search)' : '';
      const why = kinds.indexOf('no_page') >= 0 ? 'no page of yours answers this search'
        : kinds.indexOf('page_mismatch') >= 0 ? 'the page that gets the impressions is about something else: ' + (evidence.h1 ? 'its title and H1 share' : 'its title shares') + ' only '
          + evidence.have + ' of the ' + evidence.of + ' words of this search (missing: ' + evidence.missing.join(', ') + '); you rank ' + posTxt + ' with ' + pathTxt
          + (striking ? ' (striking distance)' : '') + (answered_by.also ? '; ' + (S(answered_by.also.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' is the page about it by its words, so make that page the clear answer and link it from ' + pathTxt : '; aim that page at it or give the search its own')
        : striking ? rankTxt + ', striking distance: improve that page' + alsoTxt + basisTxt
        : lowPos ? (listPath ? 'low position: ' + rankTxt : 'low position on ' + pathTxt + ' (you rank ' + posTxt + ' with it)') + ': improve that page' + alsoTxt + basisTxt
        : 'a page of yours already answers this search (' + pathTxt + (position > 0 ? ', you rank ' + posTxt : '') + ')'
          + (answered_by && answered_by.listing ? '; Google currently shows ' + (S(answered_by.listing.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + ' for it' : '') + alsoTxt + basisTxt;
      considered.push({ keyword: q, impressions, clicks, position: position > 0 ? Math.round(position * 10) / 10 : null,
        ctr: impressions ? Math.round(clicks / impressions * 1000) / 10 : 0, page: rowOnSite ? pageUrl : rowUrl, gsc_page: rowUrl, on_site: rowOnSite, answered_by, kinds, why,
        period_end: period, period_days: c.period_days, tracked: yes(r.tracked) });
    }
    const wanted = considered.filter(q => q.kinds.length);
    const rank = (x) => x.kinds.indexOf('no_page') >= 0 ? 2 : x.kinds.indexOf('page_mismatch') >= 0 ? 1 : 0;   // R12: a search with no page at all first, then one whose ranking page targets something else
    const order = [...wanted].sort((a, b) => rank(b) - rank(a) || b.impressions - a.impressions);
    return { available: all.length > 0, period_end: period, period_days: c.period_days, rows: all.length, considered: considered.length,
      page_check: (num(c.pages_known) || 0) > 0 ? 'page inventory' : (c.use_row_page ? 'search console page' : 'unavailable'),
      pages_known: num(c.pages_known) || 0,
      queries: wanted, no_page: wanted.filter(q => q.kinds.indexOf('no_page') >= 0), striking: wanted.filter(q => q.kinds.indexOf('striking') >= 0),
      mismatch: wanted.filter(q => q.kinds.indexOf('page_mismatch') >= 0),
      low_position: wanted.filter(q => q.kinds.indexOf('low_position') >= 0),
      // R36 (2026-10-16): EVERY measured search with its page (not only the seeds), so discovery can say "you already rank for this with
      // <page>" for a keyword the providers also returned, instead of recommending a second page for it
      measured: considered.filter(q => q.on_site).slice(0, 500).map(q => ({ keyword: q.keyword, impressions: q.impressions, clicks: q.clicks, position: q.position,
        page: q.page, gsc_page: q.gsc_page, answered_url: q.answered_by ? q.answered_by.url : '' })),
      answered: considered.filter(q => !q.kinds.length && q.answered_by).slice(0, 60),
      seeds: order.slice(0, c.max_seeds).map(q => q.keyword), dropped,
      min_impressions: c.min_impressions, striking_min: c.striking_min, striking_max: c.striking_max };
  };

  // ---- K3: the click loss a results page causes, and where each figure comes from (B1-3, 2026-10-15, benchmark area 1) ----
  // Until today every factor here was an undated constant, and the AI Overview one (0.65 = a 35% loss) was the APRIL 2025 measurement
  // -- "AI Overviews reduced clicks to top-ranking content by 34.5%" -- while the current study, published 2026-02-04 on December 2025
  // data over 300,000 keywords, measures **-58.0% at position 1**, -50.8% at 2 and -46.4% at 3
  // (https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/). The estimate these factors feed is explicitly "what a page in the top
  // three would get" (`top_share`), so the top-three average of that table is the figure that belongs here: it was 1.5x too generous.
  // The other features have no comparable published measurement (the 2025 featured-snippet numbers disagree with each other and with
  // Perficient's "click-neutral" finding), so they stay where they were and are labelled a STATED RULE, not a measurement. Every one of
  // them is named in `CLICK_LOSS` with its basis so a report can print what it applied and why, instead of a bare multiplier.
  const AIO_CTR_2025 = { 1: 0.420, 2: 0.492, 3: 0.536 };   // 1 - the measured loss at each of the top three positions
  const CLICK_LOSS = {
    ai_overview: { factor: +(((AIO_CTR_2025[1] + AIO_CTR_2025[2] + AIO_CTR_2025[3]) / 3).toFixed(3)), basis: 'measured',
      what: 'an AI Overview', source: 'Ahrefs, 300,000 keywords, December 2025 data (published 2026-02-04)',
      url: 'https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/',
      note: 'clicks to position 1 fall 58.0% when an AI Overview is shown (50.8% at 2, 46.4% at 3); this estimate is for a page in the top three, so their average is applied' },
    featured_snippet: { factor: 0.85, basis: 'stated rule', what: 'a featured snippet', source: 'no measurement we could verify; published 2025 studies disagree', url: '' },
    video: { factor: 0.92, basis: 'stated rule', what: 'video results', source: 'no measurement we could verify', url: '' },
    local_pack: { factor: 0.85, basis: 'stated rule', what: 'a local pack', source: 'no measurement we could verify', url: '' },
    shopping: { factor: 0.9, basis: 'stated rule', what: 'shopping results', source: 'no measurement we could verify', url: '' },
  };
  const FEATURE_KEY = { ai_overview: 'ai_overview', featured_snippet: 'featured_snippet', video: 'video', short_videos: 'video',
    local_pack: 'local_pack', map: 'local_pack', shopping: 'shopping', popular_products: 'shopping' };
  // which of the five were seen on this results page, each once, in the order they are listed above
  const lossApplied = (types) => { const seen = new Set((Array.isArray(types) ? types : []).map(x => FEATURE_KEY[S(x).toLowerCase()]).filter(Boolean));
    return Object.keys(CLICK_LOSS).filter(k => seen.has(k)).map(k => ({ key: k, ...CLICK_LOSS[k] })); };
  const featureLoss = (types) => lossApplied(types).reduce((ctr, f) => ctr * f.factor, 1);
  // "an AI Overview (-52% of the clicks, measured: Ahrefs ...)" - one clause per feature, for the note under a traffic figure
  const lossText = (types) => lossApplied(types).map(f => f.what + ' (-' + Math.round((1 - f.factor) * 100) + '% of the clicks, ' + f.basis + (f.source ? ': ' + f.source : '') + ')').join(', ');

  // ---- K2: the traffic number, and where it comes from ----
  // `calibrated`: the site's own measured impressions for this exact search (the Search Console period, scaled to a month) through the
  //               results page's click loss and the share a top-three page takes, never below the clicks the site already gets.
  // `modelled`:   the provider's monthly volume through the same two factors - an estimate of an estimate, named as one.
  // `unknown`:    neither a volume nor a measurement, so no number at all (better than a confident zero).
  const calibrate = (e, o) => {
    const c = { ...CFG, ...(o || {}) };
    const k = e || {};
    const ctr = featureLoss(k.serp_types);
    // B1-3: the figure says which features took clicks off it, how much each one took and whether that number is measured or a rule
    const lossTxt = lossText(k.serp_types);
    const lossNote = lossTxt ? ' Click loss applied: ' + lossTxt + '.' : '';
    // B1-3 (2026-10-15): `num(null)` is 0, not null — Number(null) is 0 and 0 is finite — so a keyword the provider has NO volume for
    // came back as "0 visits a month (modelled)" instead of "no estimate", a confident number where nothing was measured (the R26
    // class). An absent volume is absent; a provider that really reports 0 still reports 0.
    const vol = (k.volume === null || k.volume === undefined || k.volume === '') ? null : num(k.volume);
    const modelled = vol == null ? null : Math.round(vol * ctr * c.top_share);
    const g = (k.gsc && typeof k.gsc === 'object') ? k.gsc : null;
    const impressions = g ? num(g.impressions) : null;
    if (impressions != null && impressions > 0) {
      const clicks = num(g.clicks) || 0;
      const days = num(g.period_days) > 0 ? num(g.period_days) : c.period_days;
      const toMonth = c.month_days / days;
      const traffic_potential = Math.max(Math.round(impressions * toMonth * ctr * c.top_share), Math.round(clicks * toMonth));
      const pos = num(g.position);
      return { traffic_potential, traffic_basis: 'calibrated', modelled_traffic_potential: modelled,
        traffic_note: 'Calibrated with your own Search Console data: ' + Math.round(impressions) + ' impressions and ' + Math.round(clicks)
          + ' click(s) measured for this exact search on your site in ' + Math.round(days) + ' days'
          + (pos ? ' at average position ' + (Math.round(pos * 10) / 10) : '') + '. A page in the top three would take about '
          + traffic_potential + ' visits a month' + (modelled != null ? ' (the modelled estimate from the provider\'s volume is ' + modelled + ').' : '.') + lossNote };
    }
    if (modelled == null) {
      return { traffic_potential: null, traffic_basis: 'unknown', modelled_traffic_potential: null,
        traffic_note: 'No monthly volume from the provider and no Search Console measurement for this search, so no traffic estimate is given.' };
    }
    return { traffic_potential: modelled, traffic_basis: 'modelled', modelled_traffic_potential: modelled,
      traffic_note: 'Modelled, not measured: ' + vol + ' searches a month (a provider estimate) through the click loss of this results page and the share a top-three page takes.' + lossNote };
  };
  // ---- K4: what KIND of page Google actually ranks for this search (B1-5, 2026-10-15, benchmark area 1) ----
  // The intent and the page type came from the AI screen's label (and DataForSEO's `main_intent` behind it). The live results page
  // was already bought for the priority keywords and only its domains, its features and its People Also Ask were kept, so the one
  // piece of evidence that settles the question - the ten pages Google chose - was thrown away. K4's own anchor for a 10 is "the
  // dominant top-10 page type decides, a mismatch is flagged"; Ahrefs tells you to study the top 10 by hand for exactly this.
  // `serpPageTypes` reads the URL and the title of each organic result, with the title first where it is decisive ("best ... ",
  // "how to ...") and the path after it. Nothing is inferred from a domain we have not read, and a result it cannot place is
  // `Other`, counted and never guessed at.
  // F-A1 / A-11 (2026-10-17, re-rating): a title that says it IS a list ("Top 10 ...", "List of ...", "Top IT Consulting Companies in
  // Dubai") is a list wherever it is published - the LinkedIn Pulse listicle of exec 770 was counted as a forum post, so the results page
  // of "dubai it consulting companies" (4 lists of 7) settled nothing and the rung was planned as a service page with no word about it.
  const LIST_TITLE = /\b(?:top\s*\d+\+?|list of)\b|\btop\s+(?:[\w&.-]+\s+){0,4}(?:companies|firms|agencies|providers|consultants|consultancies|vendors|partners|tools|platforms)\b/i;
  const SHAPES = [
    { type: 'Government or official', test: (u, t, d) => /(^|\.)(gov|gov\.[a-z]{2}|gob|govt)(\.|$)/.test(d) || /\.gov($|\.)/.test(d) },
    { type: 'Comparison or list', test: (u, t) => LIST_TITLE.test(t) },
    { type: 'Forum or community', test: (u, t, d) => /(^|\.)(reddit|quora|stackexchange|stackoverflow|linkedin|facebook|x|twitter|medium)\./.test(d) || /\/(forum|community|questions|discussion)\//.test(u) },
    { type: 'Directory or marketplace', test: (u, t, d) => /(^|\.)(g2|capterra|getapp|softwareadvice|trustradius|saashub|clutch|crunchbase|yelp|yellowpages|indiamart)\./.test(d) },
    { type: 'Comparison or list', test: (u, t) => /\b(best|top\s*\d+|vs\.?|versus|alternatives?|comparison|compared)\b/i.test(t) || /\/(best|top|vs|alternatives|compare)[-\/]/.test(u) },
    { type: 'Pricing page', test: (u, t) => /\bpricing\b|\bprice list\b|\bcost(s)?\b.*\b(plans?|pricing)\b/i.test(t) || /\/(pricing|plans|price)(\/|$)/.test(u) },
    { type: 'Guide or article', test: (u, t) => /\b(how to|what is|why|guide|tutorial|checklist|explained|step[- ]by[- ]step|everything you need)\b/i.test(t) || /\/(blog|insights|articles?|news|resources?|learn|guides?|knowledge|academy)(\/|$)/.test(u) },
    { type: 'Service or product page', test: (u, t) => /\/(services?|solutions?|products?|software|platform|industries)(\/|$)/.test(u) || /\b(software|solution|services?|platform)\b/i.test(t) },
    { type: 'Homepage', test: (u) => /^[a-z0-9.-]+\/?$/.test(u) },
  ];
  // what WE would write for it, in the same words, so a mismatch is a real disagreement and not a vocabulary difference
  const OURS = { 'Blog Post': 'Guide or article', Guide: 'Guide or article', 'Pillar Page': 'Guide or article', 'FAQ Page': 'Guide or article',
    'Comparison Page': 'Comparison or list', 'Service Page': 'Service or product page', 'Product Page': 'Service or product page',
    'Landing Page': 'Service or product page', 'Category Page': 'Service or product page', 'Location Page': 'Service or product page',
    'Local Page': 'Service or product page', 'Case Study': 'Guide or article' };
  const shapeOf = (url, title) => {
    const u = urlKey(url), d = bare(url), t = S(title);
    for (const sh of SHAPES) { try { if (sh.test(u, t, d)) return sh.type; } catch (e) {} }
    return 'Other';
  };
  /** results: [{ url, title }] from the live top 10 · o.page_type = the page we plan to write
   *  -> { read, counts, dominant, dominant_count, dominant_share, ours, mismatch, text } */
  const serpPageTypes = (results, o) => {
    const c = { ...CFG, ...(o || {}) };
    const list = (Array.isArray(results) ? results : []).filter(r => r && S(r.url)).slice(0, 10);
    const counts = {};
    for (const r of list) { const k = shapeOf(r.url, r.title); counts[k] = (counts[k] || 0) + 1; }
    const read = list.length;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked[0] || null;
    const ours = OURS[S(c.page_type)] || '';
    // a dominant kind is one at least half the page agrees on, out of at least four results read: below that nobody can call it
    const dominant = top && read >= 4 && top[1] / read >= 0.5 && top[0] !== 'Other' ? top[0] : '';
    const mismatch = !!(dominant && ours && dominant !== ours);
    const text = !read ? 'The results page was not read, so what Google ranks for this search is unknown.'
      : !dominant ? 'Google ranks a mix for this search (' + ranked.map(x => x[1] + ' ' + x[0].toLowerCase()).join(', ') + '), so no page type is settled by the results.'
        : dominant.toLowerCase().replace(/^./, m => m.toUpperCase()) + 's are what Google ranks here: ' + top[1] + ' of the ' + read + ' results read'
          + (ours ? (mismatch ? ', while this plan writes a ' + ours.toLowerCase() + ' - expect to work harder, or write what the results page shows'
            : ', which is what this plan writes') : '') + '.';
    return { read, counts, dominant, dominant_count: top ? top[1] : 0, dominant_share: read ? Math.round((top ? top[1] : 0) / read * 100) : 0,
      ours, mismatch, text };
  };
  const BASIS_TEXT = { calibrated: 'calibrated with your Search Console data', modelled: 'modelled from provider volume', unknown: 'no estimate' };

  // ---- A-24 (2026-10-17, re-rating exec 764): who may stand as a COMPETITOR whose rankings feed keyword discovery ----
  // Discovery took the top three domains of one results page ("erp consultants dubai"), and #2 was naukrigulf.com "ERP Consultant Jobs
  // in UAE - 67 Vacancies": its 300 ranked keywords ("flydubai careers", "dubai iranian hospital", "jobs abu dhabi") were 545 of the
  // 1,168 researched and 224 of the 240 reviewed were rated off-topic. A competitor is a business that sells what the site sells; a job
  // board, a directory / review marketplace, a list of companies, a government portal, a news site or a forum ranks for the search but
  // competes for nothing. Each class is read from the result itself (host, title, URL shape — KWI.shapeOf's rules), never guessed.
  const JOB_HOSTS = /(^|\.)(naukrigulf|naukri|indeed|glassdoor|bayt|monster|monstergulf|foundit|gulftalent|ziprecruiter|jooble|careerjet|simplyhired|wellfound|dubizzle|laimoon|drjobpro|jobsdb|jobstreet|seek|reed|totaljobs|careerbuilder)\./;
  const NEWS_HOSTS = /(^|\.)(khaleejtimes|gulfnews|thenationalnews|thenational|arabianbusiness|zawya|gulfbusiness|emirates247|wam|bloomberg|reuters|forbes|forbesmiddleeast|cnbc|bbc|cnn|nytimes|theguardian|businessinsider|techcrunch|wired|zdnet|computerweekly|itp|economymiddleeast|wamda)\./;
  const DIRECTORY_HOSTS = /(^|\.)(clutch|themanifest|goodfirms|sortlist|designrush|techbehemoths|2gis|yellowpages|yelp|g2|capterra|getapp|softwareadvice|trustradius|saashub|crunchbase|trustpilot|upwork|fiverr|softwaresuggest|gartner|peerspot|serchen|dnb|zoominfo|kompass|hidubai|uaeyp)\./;
  const JOB_TEXT = /\b(jobs?|vacanc(?:y|ies)|careers?|hiring|recruit\w*|salar(?:y|ies))\b/i;
  /** -> '' (a business: may be a competitor) or the class that rules it out */
  const competitorClass = (domain, url, title) => {
    const d = bare(domain || url); if (!d) return 'unknown';
    if (JOB_HOSTS.test(d) || JOB_TEXT.test(S(title)) || /\/(jobs?|careers?|vacanc\w*)(\/|$|-)/i.test(urlKey(url))) return 'job board';
    if (NEWS_HOSTS.test(d)) return 'news or media';
    const shape = shapeOf(S(url) || d, title);
    if (shape === 'Government or official') return 'government';
    if (shape === 'Forum or community') return 'forum or social';
    if (DIRECTORY_HOSTS.test(d) || shape === 'Directory or marketplace') return 'directory or marketplace';
    if (shape === 'Comparison or list') return 'list of companies';
    return '';
  };

  // ---- K7: clusters by shared results pages ----
  // entries: [{ keyword, urls: [top-10 urls], weight, volume }]. A head keyword takes every keyword that shares at least
  // min_shared_urls of its own top-10 URLs; the head is the strongest keyword not already in a cluster, so the cluster can be named
  // after it. Queries and trailing slashes are ignored when URLs are compared (the same page, written two ways).
  const urlKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const serpClusters = (entries, o) => {
    const c = { ...CFG, ...(o || {}) };
    // B2-6: the depth every list is cut to before it is compared, and the number of shared URLs that depth demands. With `top_n` and
    // `min_overlap` set (the ladder: 7 and 0.4) the threshold is a SHARE of the depth - ceil(7 x 0.4) = 3 of 7 - instead of the flat
    // count discovery still uses, and both numbers travel on every cluster so a report can state what was compared and how deeply.
    const depth = (num(c.top_n) || 0) > 0 ? Math.round(c.top_n) : 0;
    const need = (num(c.min_overlap) || 0) > 0 && depth ? Math.max(1, Math.ceil(depth * c.min_overlap)) : c.min_shared_urls;
    const list = (Array.isArray(entries) ? entries : []).map(e => ({ keyword: low((e || {}).keyword),
      urls: (() => { const u = [...new Set(((e || {}).urls || []).map(urlKey).filter(Boolean))]; return depth ? u.slice(0, depth) : u; })(),
      weight: num((e || {}).weight) || 0, volume: num((e || {}).volume) }))
      .filter(e => e.keyword && e.urls.length >= c.min_urls);
    const byKw = new Map(); for (const e of list) if (!byKw.has(e.keyword)) byKw.set(e.keyword, e);
    const ranked = [...byKw.values()].sort((a, b) => b.weight - a.weight || (b.volume || 0) - (a.volume || 0) || a.keyword.localeCompare(b.keyword));
    const used = new Set(); const clusters = [];
    const built = [];
    for (const head of ranked) {
      if (used.has(head.keyword)) continue;
      const hs = new Set(head.urls); const members = [];
      for (const other of ranked) {
        if (other.keyword === head.keyword || used.has(other.keyword)) continue;
        const shared = other.urls.filter(u => hs.has(u));
        if (shared.length >= need) members.push({ keyword: other.keyword, volume: other.volume, shared_urls: shared.length, shared: shared.slice(0, 3), shared_with_head: shared.length });
      }
      if (!members.length) continue;
      used.add(head.keyword); members.forEach(m => used.add(m.keyword));
      built.push({ head, members });
    }
    // F-A1 / A-9 (2026-10-17, re-rating exec 770): a keyword that meets the rule with a MEMBER of a group but not with its head was left
    // alone and labelled "own results page (no other search Google answers with the same pages)" - "it consulting company dubai" shares
    // 3 of its top 7 with "it consulting company in dubai" (the plan's own threshold) and only 2 with the group's head. The rule is a
    // pair rule, so the label could only be true if every pair was compared. A keyword still alone after the heads have taken their
    // members joins the group of the member it shares the most with (one hop: a keyword that joined this way is never a bridge for the
    // next one), and says through whom it joined and how much it shares with the head.
    if (c.attach !== false) {
      for (const k of ranked) {
        if (used.has(k.keyword)) continue;
        const ks = new Set(k.urls); let best = null;
        for (const g of built) for (const m of [{ keyword: g.head.keyword, urls: g.head.urls }, ...g.members.filter(x => !x.via).map(x => byKw.get(x.keyword))]) {
          if (!m || !Array.isArray(m.urls)) continue;
          const shared = m.urls.filter(u => ks.has(u));
          if (shared.length >= need && (!best || shared.length > best.shared.length)) best = { g, via: m.keyword, shared };
        }
        if (!best) continue;
        const hs = new Set(best.g.head.urls);
        best.g.members.push({ keyword: k.keyword, volume: k.volume, shared_urls: best.shared.length, shared: best.shared.slice(0, 3),
          via: best.via === best.g.head.keyword ? '' : best.via, shared_with_head: k.urls.filter(u => hs.has(u)).length });
        used.add(k.keyword);
      }
    }
    for (const { head, members } of built) {
      members.sort((a, b) => b.shared_urls - a.shared_urls || (b.volume || 0) - (a.volume || 0));
      clusters.push({ head_keyword: head.keyword, keyword_count: members.length + 1, urls_compared: head.urls.length,
        min_shared_urls: need, top_n: depth, min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
        total_volume: [head, ...members].reduce((s, m) => s + (num(m.volume) || 0), 0),
        keywords: [{ keyword: head.keyword, volume: head.volume, shared_urls: head.urls.length, shared: [] }, ...members].slice(0, c.max_cluster_keywords) });
    }
    clusters.sort((a, b) => b.keyword_count - a.keyword_count || b.total_volume - a.total_volume);
    // every compared keyword's own list, at the depth it was compared at, so a later step can test any pair by the same rule (A-10)
    const urls_of = {}; for (const e of ranked) urls_of[e.keyword] = e.urls.slice();
    return { clusters, urls_of, keywords_compared: ranked.length, compared_keywords: ranked.map(e => e.keyword), min_shared_urls: need, min_urls: c.min_urls, top_n: depth,
      min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
      clustered: clusters.reduce((n, x) => n + x.keyword_count, 0) };
  };
  // R40 (2026-10-16, re-rating 2026-10-15): ONE rule for which keywords may share a page, used by the ladder (Ladder Plan) and by
  // discovery's content plan (Rank Keywords). Exec 610 compared the results pages of all 10 rung keywords, found no two sharing even 2 of
  // their top 7, and still merged "openai consulting" into "ai consulting firm" because the AI's topic label said so. Now:
  //   * Google answers it with the same pages as other keywords (a SERP cluster)  -> one page for the cluster ('shared results page');
  //   * its results page was read and compared and shares with no one             -> its own page ('own results page');
  //   * its results page could not be read or compared                           -> the AI's topic label + page type ('topic label').
  // -> { key, by } ; `o` = { keyword, topic, page_type, serp_head (the cluster head, '' when it is not in a cluster), compared }
  const pageGroup = (o) => { const x = o || {}; const kw = low(x.keyword);
    if (S(x.serp_head)) return { key: 'serp|' + low(x.serp_head), by: 'shared results page' };
    if (x.compared) return { key: 'kw|' + kw, by: 'own results page' };
    return { key: 'topic|' + (low(x.topic) || kw) + '|' + S(x.page_type), by: 'topic label' }; };
  // "one page can serve all three: 'erp software uae' also covers 'erp system uae' (4 of the same top-10 pages), ..."
  const clusterText = (cl) => {
    const c = cl || {}; const others = (c.keywords || []).slice(1);
    if (!others.length) return '';
    const depthTxt = c.top_n ? 'top ' + c.top_n : 'top-10';
    return 'One page can target all ' + c.keyword_count + ': "' + c.head_keyword + '" shares '
      + others.map(k => k.via ? k.shared_urls + ' of the ' + depthTxt + ' pages of "' + k.via + '" with "' + k.keyword + '" (' + (k.shared_with_head ?? 0) + ' with "' + c.head_keyword + '" itself)'
        : k.shared_urls + ' of its ' + depthTxt + ' pages with "' + k.keyword + '"').join(', ')
      + ' - Google answers these searches with the same pages, so a second page would only split the signals.';
  };
  const pageKindOf = (page_type) => OURS[S(page_type)] || '';   // F-A1 / A-11: the kind of page a plan's page type is, in serpPageTypes' words
  return { CFG, CLICK_LOSS, gscSeeds, calibrate, serpClusters, pageGroup, pageKindOf, clusterText, featureLoss, lossApplied, lossText, serpPageTypes, shapeOf, competitorClass, liveChecks, ladderChecks, checkCost, urlKey, BASIS_TEXT, helpers: { bare, low, num } };
})();
// ---- the pages written and not yet published, and the ladders being written: ONE rule for the Content Cadence and the ladder mode ----
// F-A1 / A-12 (2026-10-17, re-rating exec 770): the ladder mode counted the site's waiting pages its own way (published keywords left
// out, ladder rows ignored) and then wrote a sixth waiting page and started a seventh active ladder while the Content Cadence - the
// owner of both limits (`_site.max_waiting`, `_site.max_active` in seo_ladder_settings) - would have written nothing. Both now ask this
// kit, inlined by the build into *Cadence Plan* (Content Cadence) and *Ladder Plan* (main workflow); the web app mirrors the same rule in
// app/server/src/services/cadence.ts (pile-up) and ladders.ts (focus).
//   waiting(): the Content Cadence's pile-up count, unchanged in meaning (FIX_PLAN D5, R1, R111): a keyword waits when a content-log row
//   of the last `days` says `written` or `not_ready`, or when a ladder row says its page was written (A-20: `writing`, `written` or
//   `not_ready`) and the content log proves it with such a row and no published page. Each keyword counts once; a failed draft
//   (`not_ready`) is labelled `needs_fix`.
//   focus(): which Auto ladders the cadence writes now. The `max_active` highest-priority Auto ladders (status active / queued, main
//   keyword not set aside) that still have a planned page to write are active; the rest wait as Queued. `won` is not judged here (no
//   rank history is read by the ladder mode) - a won ladder with a planned page left is counted, and the result says so in `basis`.
const WAITING = (() => {
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();   // F-KW (2026-10-20): every script, as cycleNorm
  const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
  const WAITS = new Set(['written', 'not_ready']);
  const LADDER_WRITTEN = new Set(['writing', 'written', 'not_ready']);   // A-20: a ladder row whose page run has started or finished
  const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
  const posInt = (v, d, max) => { const n = Number(v); return (v !== '' && v != null && Number.isFinite(n) && n >= 1) ? Math.min(max, Math.floor(n)) : d; };
  const waiting = (o) => {
    const x = o || {}; const now = Number(x.now) || Date.now(); const days = Number(x.days) || 120;
    const log = (x.log || []).filter(r => r && typeof r === 'object'); const ladders = (x.ladders || []).filter(r => r && typeof r === 'object');
    const fresh = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && (now - v) < days * 864e5; };
    const publishedKw = new Set(log.filter(l => String(l.published_url || '').trim()).map(l => norm(l.keyword)));
    const writtenOf = (k) => log.filter(r => norm(r.keyword) === k && (WAITS.has(r.status) || r.status === 'published' || String(r.published_url || '').trim()))
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
    const fixOf = (l) => l && l.status === 'not_ready' ? { needs_fix: true, reasons: String(l.qa_reasons || '').split(/;\s+/).filter(Boolean).slice(0, 3) } : {};
    const map = new Map();
    for (const l of log) { if (!WAITS.has(l.status) || !fresh(l.started_at)) continue; const k = norm(l.keyword); if (!k || map.has(k)) continue;
      map.set(k, { keyword: l.keyword, written_at: String(l.started_at || ''), source: String(l.source || ''), ...fixOf(l) }); }
    for (const l of ladders) { if (!LADDER_WRITTEN.has(l.status)) continue; const k = norm(l.keyword); if (!k || map.has(k) || publishedKw.has(k)) continue;
      const lg = writtenOf(k); if (!lg) continue;   // R1: no written log row = the page was never written
      const at = String(lg.started_at || l.start_date || ''); if (!fresh(at)) continue;
      map.set(k, { keyword: l.keyword, written_at: at, source: 'ladder', ...fixOf(lg) }); }
    const list = [...map.values()].sort((a, b) => String(a.written_at).localeCompare(String(b.written_at)));
    return { list, keys: new Set(map.keys()), count: list.length, needs_fix: list.filter(w => w.needs_fix).length };
  };
  // o: { ladders (seo_ladders rows of the site), settings (seo_ladder_settings rows of the site, '_site' included), log, exclude (ladder id),
  //      recent_days } -> { max_active, active: [...], queued: [...], order: [...] } ; each entry { ladder_id, head, priority, mode, open }
  const focus = (o) => {
    const x = o || {}; const now = Number(x.now) || Date.now();
    const settings = (x.settings || []).filter(r => r && r.ladder_id);
    const siteRow = settings.find(r => String(r.ladder_id) === '_site') || {};
    const siteMode = lc(siteRow.mode) === 'manual' ? 'manual' : 'auto';
    const max_active = posInt(siteRow.max_active, 2, 20);
    const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
    const recentDays = Number(x.recent_days) || 90;
    const recent = new Set((x.log || []).filter(l => l && (l.status === 'published' || (now - Date.parse(String(l.started_at || 0))) < recentDays * 864e5)).map(l => norm(l.keyword)));
    for (const l of (x.ladders || [])) if (l && (LADDER_WRITTEN.has(l.status) || l.status === 'published')) recent.add(norm(l.keyword));
    const groups = new Map();
    for (const r of (x.ladders || [])) { if (!r || !r.ladder_id || String(r.ladder_id) === String(x.exclude || '')) continue; const id = String(r.ladder_id); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(r); }
    const all = [...groups.entries()].map(([id, rows]) => {
      const st = settingOf.get(id) || null; const top = rows.find(r => Number(r.rung) === 4) || null;
      const mode = st && ['auto', 'manual'].includes(lc(st.mode)) ? lc(st.mode) : siteMode;
      const status = st && STATUSES.includes(lc(st.status)) ? lc(st.status) : 'active';
      const priority = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
      const start = rows.map(r => String(r.start_date || '')).filter(Boolean).sort()[0] || String((st && st.created_at) || '');
      const head_aside = !!top && String(top.status || '') === 'set_aside';
      const open = head_aside ? 0 : rows.filter(r => String(r.status || 'planned') === 'planned' && !recent.has(norm(r.keyword))).length;
      return { ladder_id: id, head: String((top && top.keyword) || rows[0].head_keyword || ''), mode, status, priority, start, open, head_aside };
    }).sort((a, b) => a.priority - b.priority || String(a.start).localeCompare(String(b.start)) || a.ladder_id.localeCompare(b.ladder_id));
    const auto = all.filter(l => l.mode === 'auto' && ['active', 'queued'].includes(l.status) && l.open > 0);
    return { max_active, site_mode: siteMode, order: auto, active: auto.slice(0, max_active), queued: auto.slice(max_active), all,
      basis: 'the Content Cadence\'s rule: Auto ladders with status active or queued that still have a planned page, in priority order; a ladder that has already won its main keyword is not told apart here (no rank history is read on this run)' };
  };
  return { waiting, focus, norm, LADDER_WRITTEN, WAITS };
})();
// ---- what the site already holds for a search: its pages, its keyword ladders and its unpublished drafts (2026-10-17, re-rating A-1 /
// A-5 / A-23 / A-25; inlined by build_v4.py section 130 and build_api.py where a node asks for the OWN_COVER placeholder) ----
// The re-rating of 2026-10-17 found four paths that recommended work the site had already done or planned:
//   * the keyword report "erp system dubai" (exec 765) said "Build a Dynamics 365 Business Central / Finance & Operations ERP service
//     page" while /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae are live, and gave as secondary keywords
//     the slug of the first, a planned rung of the ladder "erp software uae" and a variant of the ladder "erp implementation dubai";
//   * the verdict "e invoicing software uae" (exec 760) folded five planned pages of the active ladder "e invoicing in uae" and a written
//     draft into the page it said to improve, and asked for "a penalties section" while the site has the penalties article and the rung;
//   * discovery (exec 764) led "Where to start" / "Build first" / "Now" with "erp system dubai" and "erp systems in uae", the searches the
//     ladder "erp software uae" already holds in other words;
//   * the Keyword Check (exec 750) answered "business central partner uae" with `existing: null` beside the live Business Central page.
// One question underneath all four: does something the site owns already answer this search? This kit answers it from three sources -
// the page inventory (through the caller's `matchPage`, SM.matchPage), the keyword ladders (seo_ladders + seo_ladder_settings, the rows
// the CALLER has already passed through the fit gate) and the content log's unpublished drafts - and says HOW it matched, so a report
// can name the page, the ladder or the draft instead of recommending a second one. Pure functions; the harness drives them directly.
const OWN = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
  // the same words as _reach.js `overlapTokens` (one search, one page), so "the same search" means the same thing in every path
  const tokens = (s) => { const out = []; for (const t of S(s).toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || STOP.has(t)) continue;
    const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
  // two words people use for the same product search ("erp system dubai" = "erp software dubai"): applied to both sides, never to one
  const SYN = { system: 'software' };
  const syn = (ts) => [...new Set(ts.map(t => SYN[t] || t))];
  // places: a search for the same thing in another emirate / the country is the same TOPIC, not the same search
  const PLACES = new Set(['uae', 'dubai', 'abu', 'dhabi', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rak', 'ra', 'khaimah', 'emirate', 'emirat', 'gcc', 'ksa', 'saudi', 'riyadh', 'jeddah', 'qatar', 'doha', 'bahrain', 'oman', 'muscat', 'kuwait', 'mena', 'middle', 'east', 'arab', 'united']);
  const noPlace = (ts) => ts.filter(t => !PLACES.has(t));
  const jacc = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const c = a.filter(t => sb.has(t)).length; return c / (a.length + b.length - c); };
  const inside = (a, b) => a.length > 0 && a.every(t => b.includes(t));
  const RANK = { same: 4, 'other words': 3, variant: 2, 'other place': 1 };
  /** how two searches relate: 'same' (75%+ the same words), 'other words' (the same once system = software), 'variant' (one is the
   *  other plus ONE word, places aside: "erp implementation partner uae" of "erp implementation dubai"), 'other place' (the same words for
   *  another place), or null */
  const relate = (a, b) => {
    const A = tokens(a), B = tokens(b); if (!A.length || !B.length) return null;
    if (jacc(A, B) >= 0.75) return 'same';
    const As = syn(A), Bs = syn(B);
    if (jacc(As, Bs) >= 0.75) return 'other words';
    const Ap = noPlace(As), Bp = noPlace(Bs);
    if (Ap.length >= 2 && Bp.length >= 2) {
      if (jacc(Ap, Bp) >= 0.75) return (As.length === Ap.length && Bs.length === Bp.length) ? 'other words' : 'other place';
      if ((inside(Bp, Ap) && Ap.length - Bp.length === 1) || (inside(Ap, Bp) && Bp.length - Ap.length === 1)) return 'variant';
    }
    return null;
  };
  const HOW = { same: 'the same search', 'other words': 'the same search in other words', variant: 'a close variant of it', 'other place': 'the same topic for another place' };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(x => S(x).toLowerCase()).filter(Boolean);
  const bare = (d) => S(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
  /** the site's keyword ladders as one list of searches (each rung keyword, its supporting keywords and the head), archived ladders and
   *  set-aside rungs left out, each with the LADDER's status from seo_ladder_settings (paused / active) beside the row's own status.
   *  `keep(row)` is the caller's fit gate (fitStored) - a stored rung is read back through the gate it was written through. */
  const ladders = (rows, settings, o) => {
    const c = o || {}; const dom = bare(c.domain); const keep = typeof c.keep === 'function' ? c.keep : () => true;
    const st = new Map((Array.isArray(settings) ? settings : []).filter(r => r && r.ladder_id).map(r => [S(r.ladder_id), S(r.status).toLowerCase()]));
    const out = [];
    for (const r of (Array.isArray(rows) ? rows : [])) {
      if (!r || !S(r.ladder_id) || !S(r.keyword)) continue;
      if (dom && bare(r.domain) && bare(r.domain) !== dom) continue;
      const lst = st.get(S(r.ladder_id)) || '';
      if (lst === 'archived' || /^(set_aside|refused|deleted)$/i.test(S(r.status))) continue;
      if (!keep(r)) continue;
      const rung = Number(r.rung) || 0;
      out.push({ ladder_id: S(r.ladder_id), head_keyword: S(r.head_keyword).toLowerCase(), keyword: S(r.keyword).toLowerCase(), rung, part: rung === 4 ? 'head' : 'rung',
        status: S(r.status) || 'planned', ladder_status: lst || null, target_url: S(r.target_url), supporting: listOf(r.supporting).slice(0, 12) });
    }
    return out;
  };
  /** the content log's pages that exist as text but not on the site (written, not ready, started) */
  const drafts = (rows, o) => {
    const dom = bare((o || {}).domain);
    return (Array.isArray(rows) ? rows : []).filter(r => r && S(r.keyword) && (!dom || !bare(r.domain) || bare(r.domain) === dom))
      .filter(r => !/^(published|discarded|deleted|failed)$/i.test(S(r.status)))
      .map(r => ({ keyword: S(r.keyword).toLowerCase(), status: S(r.status) || 'written', ladder_id: S(r.ladder_id), url: S(r.published_url || r.existing_page_url || r.suggested_url) }));
  };
  const best = (cands) => cands.filter(x => x.rel).sort((a, b) => RANK[b.rel] - RANK[a.rel])[0] || null;
  /** the ladder entry that holds a search, with how. `o.self` = { ladder_id, keyword } of the run's own row (never a conflict with itself);
   *  `o.min` = the weakest relation that counts ('variant' by default; 'other place' to also catch the same topic elsewhere). */
  const ladderOf = (index, kw, o) => {
    const c = o || {}; const min = RANK[c.min || 'variant'];
    const self = c.self || {}; const selfKw = S(self.keyword).toLowerCase();
    const cands = [];
    for (const e of (index || [])) {
      if (self.ladder_id && e.ladder_id === S(self.ladder_id) && (e.keyword === selfKw || (e.part === 'head' && e.head_keyword === selfKw))) continue;
      for (const [k, via] of [[e.keyword, 'keyword'], ...e.supporting.map(s => [s, 'supporting'])]) {
        const rel = relate(kw, k); if (rel && RANK[rel] >= min) cands.push({ ...e, matched: k, via, rel });
      }
    }
    const b = best(cands); if (!b) return null;
    return { kind: 'ladder', ladder_id: b.ladder_id, head_keyword: b.head_keyword, keyword: b.keyword, rung: b.rung, part: b.part, status: b.status,
      ladder_status: b.ladder_status, target_url: b.target_url, matched: b.matched, via: b.via, how: HOW[b.rel], relation: b.rel };
  };
  const draftOf = (list, kw, o) => {
    const c = o || {}; const min = RANK[c.min || 'other words']; const selfKw = S(c.self_keyword).toLowerCase();
    const b = best((list || []).filter(d => d.keyword !== selfKw).map(d => ({ ...d, rel: relate(kw, d.keyword) })).filter(d => d.rel && RANK[d.rel] >= min));
    return b ? { kind: 'draft', keyword: b.keyword, status: b.status, url: b.url, ladder_id: b.ladder_id, how: HOW[b.rel], relation: b.rel } : null;
  };
  const ukey = (u) => bare(u) + S(u).toLowerCase().replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  /** what the site already holds for `kw`: a page (ctx.matchPage), then a ladder, then a draft - the first that answers, or null.
   *  ctx = { matchPage(kw) -> { url, title, matched_by, score } | null, ladders, drafts, exclude_urls: [the page this run improves], self,
 *          page_min: the share of the search's words a page must carry by slug / title (default: whatever matchPage accepted) } */
  const claim = (kw, ctx) => {
    const c = ctx || {};
    const skip = new Set((c.exclude_urls || []).filter(Boolean).map(ukey));
    const p = typeof c.matchPage === 'function' ? c.matchPage(kw) : null;
    const strong = p && (S(p.matched_by) === 'query' || (Number(p.score) || 0) + 1e-9 >= (Number(c.page_min) || 0));   // a caller may ask for every word (secondary keywords)
    if (p && strong && S(p.url) && !skip.has(ukey(p.url))) return { kind: 'page', url: S(p.url), title: S(p.title), matched_by: S(p.matched_by) || 'inventory', how: 'a page of yours targets it' };
    const l = ladderOf(c.ladders, kw, { self: c.self, min: c.min_ladder });
    if (l) return l;
    return draftOf(c.drafts, kw, { self_keyword: (c.self || {}).keyword });
  };
  /** one line a customer reads: "your page /x", "your ladder "y" (rung page "z", planned)", "your draft "z" (not ready)" */
  const sayOf = (x) => {
    if (!x) return '';
    const path = (u) => S(u).replace(/^https?:\/\/[^/]+/i, '') || '/';
    if (x.kind === 'page') return 'your page ' + path(x.url) + (x.title ? ' ("' + x.title + '")' : '');
    if (x.kind === 'ladder') return 'your keyword ladder "' + x.head_keyword + '"' + (x.ladder_status === 'paused' ? ' (paused)' : '') + ' — ' + (x.part === 'head' ? 'its main page' : 'its rung ' + x.rung + ' page') + ' "' + x.keyword + '" (' + x.status + ')' + (x.via === 'supporting' ? ', which also targets "' + x.matched + '"' : '');
    return 'your draft "' + x.keyword + '" (' + x.status + ', not published yet)';
  };
  /** the site's own words that set a page / rung apart from `kw`: its tokens minus the search's, places and generic words left out */
  const GENERIC = new Set(['page', 'service', 'solution', 'software', 'company', 'compan', 'partner', 'guide', 'complete', 'tech', 'uae', 'best', 'top', 'list', 'new', 'cost', 'price']);
  const distinct = (text, kw) => { const k = new Set(syn(tokens(kw))); return syn(tokens(text)).filter(t => !k.has(t) && !PLACES.has(t) && !GENERIC.has(t) && !/^\d+$/.test(t)); };
  /** the prompt block: what the site already has on this topic, so the model never proposes it as new */
  const text = (ctx, kw, o) => {
    const c = ctx || {}; const lim = (o && o.max) || 8;
    const want = noPlace(syn(tokens(kw)));
    const near = (k) => { const t = syn(tokens(k)); return want.some(w => t.includes(w)); };
    const lines = [];
    const pages = (c.pages || []).slice(0, lim);
    if (pages.length) lines.push('Pages of the site on this topic: ' + pages.map(p => (S(p.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + (p.title ? ' ("' + S(p.title).slice(0, 80) + '")' : '')).join('; '));
    const lads = new Map();
    for (const e of (c.ladders || [])) { if (!(near(e.keyword) || near(e.head_keyword) || e.supporting.some(near))) continue;
      const k = e.ladder_id; if (!lads.has(k)) lads.set(k, { head: e.head_keyword, status: e.ladder_status, rungs: [] });
      lads.get(k).rungs.push(e.keyword + ' (' + e.status + ')'); }
    for (const [, l] of [...lads.entries()].slice(0, 6)) lines.push('Keyword ladder "' + l.head + '"' + (l.status ? ' (' + l.status + ')' : '') + ' - its pages: ' + l.rungs.slice(0, 8).join(', '));
    const dr = (c.drafts || []).filter(d => near(d.keyword)).slice(0, 6);
    if (dr.length) lines.push('Pages written but not published yet: ' + dr.map(d => d.keyword + ' (' + d.status + ')').join(', '));
    return lines.join('\n');
  };
  return { tokens, relate, ladders, drafts, ladderOf, draftOf, claim, sayOf, distinct, text, HOW, PLACES, ukey };
})();
// Ladder mode: applies the AI relevance screen, assigns keywords to rungs by difficulty, builds one page per topic
// cluster, maps internal links, matches existing pages, estimates the timeline and picks the pages to write now.
// v4.8 (PIPELINE_FEATURE_SPEC §5.3-5.5): everything is measured against the site's REACH (stored 30 days in seo_cache, else measured from this
// run's "keywords the site ranks for" pull and the site authority): rungs relative to reach (1 <= reach, 2 <= reach + 15, 3 <= reach + 30, above
// = later); the main keyword's difficulty for this site picks the plan — direct (main page FIRST + 2-3 supporting pages), short (3-5 supporting
// pages, then the main page), full (rungs 1-3 + main page, as before; very hard = stretch with the alternatives first) or none (not realistic:
// alternatives only, no pages). Keywords that already belong to another ladder of the site are never planned again (same search: equal stemmed
// word sets or 75%+ in common), and a main keyword that duplicates another ladder's main keyword is refused.
// ---- link kit (v4.10, inlined by build_monitors.py): reads a fetched page the way a link checker does — the links to a site with their rel,
// anchor and placement, page facts (noindex, canonical, outbound links, language) and contact e-mails. Regex only: the n8n sandbox has no URL
// constructor and no DOM. Hosts are compared without "www." (crawls report www. URLs while canonicals often use the bare host).
const LK = (() => {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
  const ent = (() => {
    const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
    return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
      if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
      const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
    });
  })();   // R62: named + decimal + hex, one pass (the same body as v5/code/_entities.js)
  const text = (s) => ent(String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const attr = (attrs, name) => { const m = String(attrs || '').match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? ent(m[1] ?? m[2] ?? m[3] ?? '') : null; };
  const hostOf = (u) => { const m = String(u || '').trim().match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : ''; };
  const regDomain = (h) => { const p = String(h || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    const sld = /^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/; return (sld.test(p[p.length - 2]) && p[p.length - 1].length === 2) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  // the ledger key of a linking host: its registrable domain, except on hosting platforms where every subdomain is a different site
  const PLATFORM = /\.(blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|medium\.com|substack\.com|github\.io|gitlab\.io|wixsite\.com|weebly\.com|webflow\.io|squarespace\.com|netlify\.app|vercel\.app|pages\.dev|herokuapp\.com|web\.app|firebaseapp\.com|blogger\.com|livejournal\.com|over-blog\.com|jimdosite\.com|site123\.me|webnode\.[a-z]+|strikingly\.com|carrd\.co|notion\.site|super\.site|hashnode\.dev|dev\.to|translate\.goog)$/;
  const refKey = (h) => { const x = String(h || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); return PLATFORM.test(x) ? x : regDomain(x); };
  const sameSite = (host, domain) => { const h = String(host || '').toLowerCase().replace(/^www\./, ''), d = String(domain || '').toLowerCase().replace(/^www\./, ''); return !!h && !!d && (h === d || h.endsWith('.' + d)); };
  // D23 (2026-10-11 system review): one list of tracking parameters, for comparing URLs (normUrl) and for the URLs we store and show
  // (cleanUrl). `srsltid` (Google Shopping) and `utm_source=chatgpt.com` were kept in stored links before, so the same page counted
  // twice and outreach quoted a tagged URL.
  const TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+|mkt_tok)$/i;
  const dropTrack = (q) => String(q || '').replace(/^\?/, '').split('&').filter(kv => kv && !TRACK.test(kv.split('=')[0])).join('&');
  const normUrl = (u) => { const s = String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '');
    const i = s.indexOf('?'); const q = i < 0 ? '' : dropTrack(s.slice(i)); const base = (i < 0 ? s : s.slice(0, i)).replace(/\/+$/, '');
    return base + (q ? '?' + q : ''); };
  // the URL as we keep it (scheme and host as they are, the real query kept): for from_url, source_url and anything a person opens
  const cleanUrl = (u) => { const s = String(u || '').trim().replace(/#.*$/, ''); const i = s.indexOf('?');
    if (i < 0) return s; const q = dropTrack(s.slice(i)); return s.slice(0, i) + (q ? '?' + q : ''); };
  const decodeAll = (s) => { let x = String(s || ''); for (let i = 0; i < 3; i++) { try { const y = decodeURIComponent(x); if (y === x) break; x = y; } catch (e) { break; } } return x; };
  // where on the page an index sits: the innermost structural element decides (an "aside" inside "main" is a sidebar, a "header" inside "article" is nav)
  // the innermost structural element decides: an "aside" inside "main" is a sidebar, a "header" inside "article" is nav
  // whole class / id / role tokens, not substrings: page builders put "widget" or "header" in every wrapper (Elementor's "elementor-widget-container")
  function placeOf(stack) {
    const is = (toks, re) => toks.some(t => re.test(t));
    for (let i = stack.length - 1; i >= 0; i--) {
      const { tag } = stack[i]; const toks = stack[i].cls.split(/[\s"'=]+/).filter(t => t && !/^(class|id|role|itemprop)$/.test(t));
      if (is(toks, /^(comments?|comment-[a-z-]+|[a-z-]+-comments?|commentlist|disqus[a-z_-]*|reply|respond)$/)) return 'comment';
      if (tag === 'footer' || is(toks, /^(footer|site-footer|[a-z]+-footer|footer-[a-z-]+|colophon|site-info|copyright|contentinfo)$/)) return 'footer';
      if (tag === 'aside' || is(toks, /sidebar|^(widget|widget-area|widget_[a-z_-]+|secondary|blogroll|related|related-posts|yarpp[a-z-]*|jp-relatedposts|partner-logos|sponsors?|complementary)$/)) return 'sidebar';
      if (tag === 'nav' || tag === 'header' || is(toks, /^(nav|navbar|navigation|menu|[a-z]+-menu|menu-[a-z-]+|[a-z]+-nav|nav-[a-z-]+|breadcrumbs?|masthead|topbar|banner|site-header|header|[a-z]+-header)$/)) return 'nav';
      if (tag === 'article' || tag === 'main' || is(toks, /^(article|entry|entry-content|post|post-content|[a-z]+-content|content|story|prose|main|articlebody|blog-post|single-post|hentry)$/)) return 'content';
    }
    return 'body';
  }
  // one walk over the tags up to `upto` (or the whole page): calls onA(index, stack) at every <a>; scripts / styles skipped
  function walkTags(html, upto, onA) {
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g; const stack = []; let m; let low = null;
    while ((m = re.exec(html)) && m.index < upto) {
      const close = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
      if (!close && (tag === 'script' || tag === 'style' || tag === 'template')) { if (low === null) low = html.toLowerCase(); const end = low.indexOf('</' + tag, re.lastIndex); if (end < 0 || end > upto) break; re.lastIndex = end; continue; }
      if (!close && tag === 'a' && onA) onA(m.index, stack);
      if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue;
      if (close) { let at = -1; for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { at = i; break; } if (at >= 0) stack.length = at; }
      else stack.push({ tag, cls: ((attrs.match(/\b(?:class|id|role|itemprop)\s*=\s*["'][^"']*["']/gi) || []).join(' ')).toLowerCase() });
    }
    return stack;
  }
  // where on the page an index sits (one link: verify)
  function placementAt(html, idx) { return placeOf(walkTags(html, idx, null)); }
  // where every link of a page sits, in one walk (many links: the Link Builder's dead-link check; v4.13 — placementAt per link re-walked the
  // page each time: 11 minutes on real list pages, live 2026-10-11)
  function anchorPlacements(html) { const out = new Map(); walkTags(String(html || ''), Infinity, (i, stack) => out.set(i, placeOf(stack))); return out; }
  // every <a> on the page that points to the site (directly, or through a redirect / tracking URL that carries it)
  function linksTo(html, domain) {
    const out = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi; let m;
    while ((m = re.exec(html))) {
      const href = attr(m[1], 'href'); if (!href) continue;
      const h = hostOf(href); let indirect = false; let to = href;
      if (!sameSite(h, domain)) { const dec = decodeAll(href); const i = dec.toLowerCase().search(new RegExp('https?:\\/\\/(?:[a-z0-9-]+\\.)*' + String(domain).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\/?#:&]|$)', 'i'));
        if (i < 0 || h === '') continue; indirect = true; to = dec.slice(i).split(/[&\s"'<>]/)[0]; }
      const rel = String(attr(m[1], 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
      const img = (m[2].match(/<img\b[^>]*>/i) || [])[0]; const anchor = text(m[2]).slice(0, 160) || (img ? '[image] ' + String(attr(img, 'alt') || '').slice(0, 120) : '');
      out.push({ href: to, rel, anchor, image: !!img && !text(m[2]), indirect, index: m.index });
    }
    return out;
  }
  function pageFacts(html, headers, url) {
    const H = {}; for (const [k, v] of Object.entries(headers || {})) H[String(k).toLowerCase()] = String(v);
    const robots = [...String(html).matchAll(/<meta\b[^>]*>/gi)].map(x => x[0]).filter(t => /name\s*=\s*["']?(robots|googlebot)\b/i.test(t)).map(t => String(attr(t, 'content') || '').toLowerCase()).join(',') + ',' + String(H['x-robots-tag'] || '').toLowerCase();
    const canonTag = [...String(html).matchAll(/<link\b[^>]*>/gi)].map(x => x[0]).find(t => /rel\s*=\s*["']?canonical\b/i.test(t)); const canonical = canonTag ? attr(canonTag, 'href') || '' : '';
    const own = hostOf(url); const hosts = new Set(); let anchors = 0;
    for (const a of String(html).matchAll(/<a\b([^>]*)>/gi)) { anchors++; const h = hostOf(attr(a[1], 'href')); if (h && !sameSite(h, regDomain(own))) hosts.add(regDomain(h)); }
    const body = text((String(html).match(/<body\b[\s\S]*$/i) || [html])[0]);
    return { title: text((String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 160), lang: String(attr((String(html).match(/<html\b[^>]*>/i) || [''])[0], 'lang') || '').slice(0, 10),
      noindex: /noindex|\bnone\b/.test(robots), nofollow_page: /nofollow|\bnone\b/.test(robots), canonical, canonical_elsewhere: !!canonical && /^(https?:)?\/\//i.test(canonical) && normUrl(canonical) !== normUrl(url),
      outbound_domains: hosts.size, anchors, words: body ? body.split(' ').length : 0,
      js_shell: anchors < 3 && body.split(' ').length < 80 && /<script\b/i.test(html) && (/<(div|main|body)\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt|svelte|main-app)\b/i.test(html) || /enable javascript|requires javascript|javascript is (disabled|required)/i.test(body)) };   // a client-rendered app, not just a short page
  }
  const contextAt = (html, idx, len = 170) => text(String(html).slice(Math.max(0, idx - 1500), idx + 1500).replace(/^[^<]*>/, '')).slice(0, 2 * len + 40);
  const challenge = (status, html) => { const s = Number(status) || 0; const h = String(html || '').slice(0, 60000);
    return /cf-browser-verification|challenge-platform|cf_chl_|Just a moment\.\.\.|Attention Required! \| Cloudflare|Enable JavaScript and cookies to continue|_Incapsula_Resource|Request unsuccessful\. Incapsula|px-captcha|perimeterx|datadome|captcha-delivery|Access Denied<\/title>|Pardon Our Interruption/i.test(h) || ((s === 403 || s === 429 || s === 503) && h.length < 30000); };
  // e-mail addresses an outreach could go to (mailto first, then text), without image names, tracking and platform addresses
  function emailsIn(html, domain) {
    const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(sentry|wixpress|example|domain|email|yoursite|sentry-next)\.|^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|dpo|legal|gdpr|unsubscribe)@|@2x|u00/i;
    const found = new Map(); const add = (e, w) => { const x = ent(String(e || '')).toLowerCase().replace(/^mailto:/, '').split('?')[0].trim(); if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(x) || BAD.test(x)) return; found.set(x, Math.max(found.get(x) || 0, w + (sameSite(x.split('@')[1], domain) ? 2 : 0) + (/^(editor|editorial|news|press|media|pr|content|hello|info|contact|partnerships?|marketing)@/.test(x) ? 1 : 0))); };
    for (const m of String(html).matchAll(/href\s*=\s*["']mailto:([^"'>\s]+)/gi)) add(m[1], 3);
    for (const m of text(html).matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) add(m[0], 1);
    for (const m of String(html).matchAll(/"email"\s*:\s*"([^"]+)"/gi)) add(m[1], 2);
    return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 3);
  }
  // one fetched page against the site: was the link found, how, and where
  function verify(page, domain, opts = {}) {
    const status = Number(page.statusCode || page.status || 0); const html = String(page.body ?? page.data ?? '');
    const err = page.error ? String(page.error.message || page.error.description || page.error).slice(0, 160) : '';
    if (err && !html) { const gone = /ENOTFOUND|getaddrinfo ENOTFOUND|NXDOMAIN|certificate has expired|ERR_TLS_CERT_ALTNAME|ECONNREFUSED/i.test(err); return { verify: gone ? 'gone' : 'error', status, error: err }; }
    if (status === 404 || status === 410) return { verify: 'gone', status };
    if (challenge(status, html)) return { verify: 'blocked', status };
    if (status >= 500 || (status && status >= 400)) return { verify: 'error', status };
    const facts = pageFacts(html, page.headers, opts.url || '');
    const links = linksTo(html, domain);
    if (!links.length) return { verify: facts.js_shell ? 'js' : 'missing', status, ...facts };
    const best = links.map(l => ({ ...l, placement: placementAt(html, l.index), follow: !l.rel.some(r => r === 'nofollow' || r === 'sponsored' || r === 'ugc') && !l.indirect && !facts.nofollow_page }))
      .sort((a, b) => (b.follow - a.follow) || ((b.placement === 'content') - (a.placement === 'content')))[0];
    const relKind = best.rel.includes('sponsored') ? 'sponsored' : best.rel.includes('ugc') ? 'ugc' : (best.rel.includes('nofollow') || facts.nofollow_page) ? 'nofollow' : best.indirect ? 'redirect' : 'follow';
    return { verify: 'found', status, ...facts, to_url: best.href, anchor: best.anchor, rel: relKind, placement: best.placement, image: best.image, links_on_page: links.length, context: contextAt(html, best.index) };
  }
  // a page that names the brand: with or without a link to the site (unlinked mentions are the warmest outreach)
  function mention(page, domain, brandRes) {
    const v = verify(page, domain); const html = String(page.body ?? page.data ?? '');
    if (v.verify === 'found') return { ...v, named: true };
    if (v.verify !== 'missing') return { ...v, named: false };
    const t = text(html); let at = -1; for (const re of brandRes) { const i = t.search(re); if (i >= 0 && (at < 0 || i < at)) at = i; }
    return { ...v, named: at >= 0, context: at >= 0 ? t.slice(Math.max(0, at - 160), at + 200) : '' };
  }
  // what kind of site a referrer is: GA4 referrals include e-mail, chat, search and payment hosts that are not links on the web
  const KIND = [
    ['search', /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|qwant|brave|startpage|naver|seznam|search\.yahoo|aol|ask)\.[a-z.]+$/],
    ['ai', /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|claude\.ai|deepseek\.com|grok\.com|meta\.ai|you\.com|poe\.com|phind\.com|mistral\.ai|kagi\.com)$/],
    ['mail', /(^|\.)(mail\.google|outlook\.(live|office|office365)|mail\.yahoo|webmail|zimbra|roundcube|teams\.(microsoft|live)|teams\.public\.onecdn\.static\.microsoft|statics\.teams\.cdn\.office\.net|slack|discord|web\.whatsapp|web\.telegram|zoom\.us|mail\.)/],
    ['tool', /(^|\.)(stripe|paypal|checkout|accounts\.google|login\.microsoftonline|okta|auth0|hubspot|salesforce|zendesk|intercom|calendly|docs\.google|drive\.google|sharepoint|notion\.so|trello|asana|atlassian|github\.dev|localhost|127\.0\.0\.1|translate\.goog|googleusercontent|ampproject|webcache)\b/],
    ['social', /(^|\.)(linkedin|lnkd|facebook|fb|instagram|twitter|x|t|tiktok|youtube|youtu|pinterest|reddit|quora|threads|snapchat|tumblr|medium|vk|weibo|wechat|telegram|t\.co)\.[a-z.]+$|^(t\.co|lnkd\.in|youtu\.be|fb\.me)$/],
  ];
  // infrastructure: CDNs, storage, link shorteners and whole hosting platforms (the Common Crawl graph reports "blogspot.com" or
  // "amazonaws.com" as one domain) — they appear in link graphs but nobody there can be asked for a link (live finding 2026-10-08)
  const INFRA = /(^|\.)(amazonaws\.com|cloudfront\.net|akamai(hd|edge|ized)?\.net|edgesuite\.net|azureedge\.net|azurewebsites\.net|windows\.net|googleusercontent\.com|googleapis\.com|gstatic\.com|ggpht\.com|appspot\.com|app\.link|bit\.ly|t\.co|goo\.gl|ow\.ly|lnkd\.in|tinyurl\.com|rebrand\.ly|blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|squarespace\.com|github\.io|gitlab\.io|herokuapp\.com|netlify\.app|vercel\.app|pages\.dev|web\.app|firebaseapp\.com|doubleclick\.net|addthis\.com|sharethis\.com|cdninstagram\.com|fbcdn\.net|jsdelivr\.net|cloudflare\.com|wp\.com|gravatar\.com|archive\.org|translate\.goog)$/i;
  const isInfra = (d) => INFRA.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  // auto-generated pages that name every domain (WHOIS, "site worth", site statistics, similar-site lists): not mentions, not prospects
  // (live finding 2026-10-08: whois.com came back as an "unlinked mention" of techand.ai)
  const SCRAPER = /(^|[.-])(whois|who\.is|worth|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|sitesimilar|websiteoutlook|statshow|domaintools|robtex|builtwith|urlscan|siteindices|dnslytics|ipaddress|host\.io|domainbigdata|webstatsdomain|siteliner|rank2traffic|websiteinformer|informer|valuation|traffic-?estimate|seo-?analy[sz]er|seositecheckup|sitechecker|webrank|domainstats)/i;
  const isScraper = (d) => SCRAPER.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  // G18-1 (2026-10-12, the accuracy set): a SEARCH-RESULTS page of someone else's site. Its content is whatever was typed into a search box,
  // it is noindex or canonicalised away on most sites, and Google passes nothing from it — yet robuta.com/?q=business+impact came back as
  // techand.ai's best link (SEO value 57, above OpenPeppol's members list at 35) because only whois / stats / valuation hosts counted as
  // scrapers. The shapes: a path segment "search" / "suche" / "recherche" / "busca" (/search, /en/search/), a search script
  // (/search.php, /results.aspx), or a query that carries the search term (?q= / ?s= / ?query= / ?search= / ?keyword= / ?term= / ?k=).
  // Query keys only, never a value, and only on a whole key, so ?qid=, ?src= and ?ref= are not searches. The caller decides what to do with
  // it (Parse Backlinks labels such a page "scraper" when nothing ties the host to our topics, so LK.values' cap of 5 applies).
  const SEARCH_PATH = /(^|\/)(search|searchresults|suche|recherche|busca|buscar|zoeken)(\/|\.(php|html?|aspx?|jsp)$|$)/i;   // "results" alone is left out on purpose: /results/ is a real page on plenty of sites
  const SEARCH_Q = /^(q|s|k|kw|query|search|searchterm|search_term|searchword|keyword|keywords|term|suche|wd)$/i;
  const isSearchPage = (u) => { const s = String(u || '').trim(); if (!s) return false;
    const noHost = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/?#]*/i, ''); const i = noHost.indexOf('?');
    const path = (i < 0 ? noHost : noHost.slice(0, i)).replace(/#.*$/, '');
    if (SEARCH_PATH.test(path)) return true;
    if (i < 0) return false;
    return noHost.slice(i + 1).replace(/#.*$/, '').split('&').some(kv => kv.includes('=') && SEARCH_Q.test(kv.split('=')[0]) && kv.split('=').slice(1).join('=').length > 0); };
  // press-release wires: a competitor's link there is a paid release (usually nofollow), not a site to pitch (live finding 2026-10-08:
  // prnewswire.co.uk and kyodonewsprwire.jp ranked among techand.ai's top gap prospects once Ahrefs DR was on)
  const WIRE = /(^|\.)(prnewswire|businesswire|globenewswire|einpresswire|einnews|accesswire|newswire|prweb|prlog|openpr|newsfilecorp|issuewire|presswire|kyodonewsprwire|marketwired|newsdirect|pressat|24-7pressrelease|prunderground|send2press|realwire|pressebox|presseportal|newsvoir|prfire|cision)\.[a-z.]+$/i;
  const isWire = (d) => WIRE.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  const domainKind = (d, site) => { const x = String(d || '').toLowerCase().replace(/^www\./, ''); if (!x) return 'unknown'; if (site && sameSite(x, site)) return 'self'; for (const [k, re] of KIND) if (re.test(x)) return k; return 'web'; };
  // A link's value on three scales, 0-100 each (a link can matter for one and not the others):
  // - seo: what it passes in search. Weighted signals (authority 30, relevance 20, traffic of the linking page 15, placement 10, editorial
  //   integrity 10, cleanliness 10, anchor 5) times hard gates — a lost link, a noindex page or a canonical pointing elsewhere passes (almost)
  //   nothing; rel nofollow / ugc / sponsored are hints (partial weight). Missing inputs count as average.
  // - referral: the visits it sends (GA4 referral sessions a year; key events add).
  // - brand: earned media and sources AI assistants cite (editorial / press / resource / listing, AI-cited domains, authority).
  // authority: DataForSEO rank 0-1000 (or a Tranco position); relevance 0-1 (Link Analyst 0-3 / 3, else topic words); link_type from the analyst.
  function values(l) {
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const auth = Math.max(l.authority > 0 ? clamp((Number(l.authority) - 40) / 520) : 0, l.tranco > 0 ? clamp(1 - Math.log10(Number(l.tranco)) / 6.2) * 0.9 : 0);
    const authKnown = l.authority > 0 || l.tranco > 0;
    const rel = l.relevance == null || l.relevance === '' ? 0.5 : clamp(Number(l.relevance));
    const visits = Number(l.visits) || 0, kw = Number(l.page_keywords) || 0;
    const traffic = kw > 0 ? clamp(Math.log10(1 + kw) / 2.5) : visits > 0 ? 0.5 : 0.2;
    const place = { content: 1, body: 0.65, sidebar: 0.4, nav: 0.3, footer: 0.2, comment: 0.1 }[l.placement || 'body'] ?? 0.6;
    const editorial = (l.original === false ? 0.4 : 1) * (Number(l.sitewide) >= 20 ? 0.5 : 1) * (['guest_post', 'sponsored'].includes(l.link_type) ? 0.4 : 1);
    const clean = clamp(1 - (Number(l.spam) || 0) / 100) * (Number(l.outbound) > 150 ? 0.5 : Number(l.outbound) > 60 ? 0.8 : 1);
    const anchor = l.anchor_kind === 'money' && rel < 0.5 ? 0.2 : 1;
    let seo = 100 * (0.3 * (authKnown ? auth : 0.15) + 0.2 * rel + 0.15 * traffic + 0.1 * place + 0.1 * editorial + 0.1 * clean + 0.05 * anchor);
    const gate = (l.status === 'lost' ? 0 : 1)   // a link missed once (at risk) keeps its value until a second miss confirms the loss
      * (l.noindex ? 0.1 : 1) * (l.canonical_elsewhere ? 0.3 : 1)
      * (l.kind === 'social' ? 0.3 : ({ follow: 1, redirect: 0.8, ugc: 0.3, nofollow: 0.3, sponsored: 0.15 }[l.rel] ?? 0.8));   // social profile links are nofollow; a rel nobody checked yet counts 0.8
    seo *= gate;
    const cap = { scraper: 5, spam: 0, directory: 40, profile: 35, comment: 15, forum: 50 }[l.link_type || ''];
    if (cap != null) seo = Math.min(seo, cap);
    const keyEvents = Number(l.key_events) || 0;
    const referral = visits > 0 ? Math.min(100, 22 * Math.log10(1 + visits) + (keyEvents > 0 ? 15 + 10 * Math.log10(1 + keyEvents) : 0)) : 0;
    const earned = { editorial: 1, press: 1, resource: 0.8, listing: 0.85, partner: 0.6, forum: 0.45, profile: 0.35, directory: 0.3 }[l.link_type || ''] ?? (l.kind === 'social' ? 0.3 : l.placement === 'content' ? 0.5 : 0.25);
    const brand = l.link_type === 'spam' || l.link_type === 'scraper' ? 0 : Math.min(100, 100 * (0.55 * earned + 0.25 * (authKnown ? auth : 0.15) + (l.ai_cited ? 0.25 : 0)));
    return { seo: Math.round(seo), referral: Math.round(referral), brand: Math.round(brand) };
  }
  const quality = (l) => values(l).seo;
  // anchor kinds (a money-keyword anchor from an off-topic page is a flag; branded / URL / generic anchors are natural)
  const anchorKind = (anchor, domain, brands = []) => { const a = String(anchor || '').toLowerCase().trim(); if (!a || /^\[image\]/.test(a)) return 'image_or_empty';
    const label = String(domain || '').toLowerCase().replace(/^www\./, '').split('.')[0];
    if (a.includes(String(domain).toLowerCase()) || /^(https?:\/\/|www\.)/.test(a)) return 'url';
    if ((label.length >= 4 && a.replace(/[^a-z0-9]/g, '').includes(label)) || brands.some(b => b && a.includes(String(b).toLowerCase()))) return 'brand';
    if (/^(click here|here|this|read more|more|website|link|source|visit( site| website)?|learn more|this article|this post|view|official site|homepage)$/.test(a)) return 'generic';
    return 'money'; };
  // ---- footprint gate (D3, 2026-10-11) ----
  // Link farms sell the same page on many domains: one PBN network linked techand.ai from 16 domains with one path (/all/2835/13.html) and
  // one anchor ("High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service …"), some on casino hosts; the index flagged 4 and
  // the other 12 ranked above peppol.org as "best links" (live 2026-10-11). A cluster is: the same page path or the same keyword anchor on 3+
  // referring sites, an anchor or page title that advertises link selling or gambling, a gambling host, or a page path shared with such a
  // page. Members get link_type "spam" (SEO and brand value 0), stay out of best links, alerts and impact tracking and go on the disavow
  // candidates (review-only). Bounds: a path with one plain segment (/partners, /links) or made of generic words (/en/partners) never
  // clusters, nor do brand / URL / generic anchors or anchors under 4 words (every partner page and every brand mention would); an anchor
  // that is one of the site's own page titles is a citation, not a footprint. One list of link-selling words for every consumer (SPAM_RE).
  const SPAM_RE = /\b(?:pbn|private blog network|buy (?:cheap |quality |high[- ]quality )?(?:backlinks?|links?)|backlinks? (?:service|package|for sale|provider)|dofollow (?:backlinks?|links?)|high[- ]quality (?:backlinks?|links?)|link ?farms?|guest post services?|link building services?|da ?\d{1,2}\W{0,3}pa ?\d{1,2}|casinos?|betting|slots?|gambling|poker|jackpot|sportsbook|bookmakers?|porn|xxx|viagra|cialis|payday loans?|escorts?|essay writing)\b/i;
  const GAMBLING = /casino|poker|gambl|jackpot|sportsbook|bookmaker|roulette|blackjack|baccarat|betwinner|1xbet|mostbet|melbet|parimatch|bet365|betway|unibet|bwin|slotgacor/i;   // unambiguous substrings only ("alphabet" is not a bet)
  const isGambling = (d) => { const x = String(d || '').toLowerCase().replace(/^www\./, ''); return GAMBLING.test(x) || x.split(/[.-]/).some(t => /^(bets?|betting|slots?|lotto|lottery|toto|togel|judi|gacor)$/.test(t)); };
  const GENERIC = /^(en|de|fr|es|it|ar|nl|pt|ru|zh|ja|blog|news|partners?|links?|resources?|clients?|about|about-us|directory|members?|sponsors?|vendors?|tools?|category|tag|page|pages|home|contact|sitemap|index|posts?|articles?|press|media|portfolio|services?|products?|solutions?|team|company)$/;
  const footPath = (u) => { const p = String(u || '').replace(/^https?:\/\/[^\/?#]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase().replace(/\/index\.(html?|php)$/, ''); const seg = p.split('/').filter(Boolean);
    if (!seg.length || seg.every(x => GENERIC.test(x)) || (seg.length === 1 && !/\d/.test(p))) return ''; return p; };
  // rows: anything with ref_domain (or from_url), from_url, anchor and page_title / title. Returns Map ref_domain → reason.
  function footprints(rows, opts = {}) {
    const out = new Map(); const set = (d, why) => { if (d && !out.has(d)) out.set(d, why); };
    const titles = (opts.titles || []).map(t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(t => t.length >= 8);
    const items = []; const byPath = new Map(), byAnchor = new Map();
    for (const r of rows || []) { if (!r) continue; const d = String(r.ref_domain || refKey(hostOf(r.from_url)) || '').toLowerCase(); if (!d) continue;
      const path = footPath(r.from_url); const a = String(r.anchor || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const ak = a && a.split(' ').length >= 4 && anchorKind(a, opts.domain || '', opts.brands || []) === 'money' && !titles.some(t => t.includes(a) || a.includes(t)) ? a : '';
      items.push({ d, path, ak, r });
      if (path) { if (!byPath.has(path)) byPath.set(path, new Set()); byPath.get(path).add(d); }
      if (ak) { if (!byAnchor.has(ak)) byAnchor.set(ak, new Set()); byAnchor.get(ak).add(d); } }
    for (const [p, ds] of byPath) if (ds.size >= 3) for (const d of ds) set(d, 'the same page path on ' + ds.size + ' sites (' + p.slice(0, 60) + ')');
    for (const [a, ds] of byAnchor) if (ds.size >= 3) for (const d of ds) set(d, 'the same keyword anchor on ' + ds.size + ' sites ("' + a.slice(0, 60) + '")');
    for (const x of items) { const txt = String(x.r.anchor || '') + ' | ' + String(x.r.page_title || x.r.title || '');
      if (SPAM_RE.test(txt)) set(x.d, 'the anchor or page title sells links or gambling ("' + String(x.r.anchor || x.r.page_title || x.r.title || '').replace(/\s+/g, ' ').slice(0, 60) + '")');
      else if (isGambling(x.d)) set(x.d, 'a gambling site'); }
    for (const [p, ds] of byPath) if (ds.size >= 2 && [...ds].some(d => out.has(d))) for (const d of ds) set(d, 'shares its page path with a link-farm page (' + p.slice(0, 60) + ')');
    return out;
  }
  return { text, attr, hostOf, regDomain, refKey, sameSite, isInfra, isScraper, isSearchPage, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
})();
const base = $('Parse Verdict').first().json;
const pool = $('Ladder Pool').first().json;
const chunks = $('Ladder Relevance Chunks').all().map(i => i.json);
const outs = $input.all().map(i => i.json);
const head = String(base.keyword || '').toLowerCase().trim();
const domain = String(base.domain || '').toLowerCase();
// D15 (system review 2026-10-11): every URL we emit uses the site model's canonical host (SITE_MODEL_SPEC.md §6) -- the bare domain
// 308-redirects on a www site. With no model (an older run) or another site's domain, the bare domain keeps today's behaviour.
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const siteUrlOf = (dom, path) => SM.siteUrl(SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(dom) ? SITE_MODEL : { domain: dom }, path);
const pagesNow = Math.min(3, Math.max(1, Number(base.pages_now) || 1));
const ladderId = String(base.ladder_id || ('lad_' + Date.now().toString(36)));
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const PAGES = ['Service Page', 'Product Page', 'Landing Page', 'Comparison Page', 'Blog Post', 'Guide', 'FAQ Page', 'Location Page', 'Category Page'];
const defaultPage = (intent) => intent === 'informational' ? 'Guide' : intent === 'transactional' ? 'Landing Page' : 'Service Page';

// ---- reach: stored for this site and market (30 days), else measured from this run's data (saved by "Save Reach (Ladder)") ----
const sa = base.site_authority || null;
const SR = pool.site_rankings || {};
let reachInfo = reachCached(rowsOf('Load Site Cache'), domain, base.location_code);
let reach_cache_row = null;
if (!reachInfo) {
  reachInfo = reachFrom(SR.available === false ? null : (SR.top10 || []), sa);
  if (reachInfo.method !== 'default') reach_cache_row = reachCacheRow(domain, reachInfo, base.location_code);
}
// ---- B2-1 (2026-10-15, benchmark area 2): the reach this plan is measured against is the reach ON THIS TOPIC ----
// The site reach above is one number for the whole website, cached 30 days: on 2026-10-13 the SAME cached reach of 10 (measured
// 2026-10-08 on "peppol uae" research) decided the plan for "erp implementation dubai" (lad_mv5pjt5y4aoa). MarketMuse subtracts a
// topic-level Topic Authority from the difficulty and Semrush lowers PKD with the thematic distance to the domain's core topics; this
// measures the same thing from the `ranked` pull this run already paid for, using the SAME on-topic test the rungs are filtered by
// (RAD.headFit), so the keywords that count as "this topic" for the reach are the keywords that count as "this topic" for the plan.
// It is used only with REACH_CFG.min_top10 on-topic top-10 keywords behind it; otherwise the site reach stays and the plan says so.
const rankedAll = SR.available === false ? null : Object.entries(SR.keywords || {}).map(([keyword, r]) => ({ keyword, kd: r.kd, position: r.position }));
const topic_authority = reachTopic(rankedAll, head, reachInfo.reach, { domain, match: (kw) => RAD.headFit(head, kw).ok });
const reach = topic_authority.reach;

// ---- the site's other ladders (rule R1: one search, one page) ----
const settingsRows = rowsOf('Load Domain Ladder Settings');
const archived = new Set(settingsRows.filter(r => String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id)));
const others = rowsOf('Load Domain Ladders').filter(r => r.ladder_id && String(r.ladder_id) !== ladderId && reachDomain(r.domain) === reachDomain(domain) && !archived.has(String(r.ladder_id)));
const otherHeads = new Map(); for (const r of others) { const h = String(r.head_keyword || (Number(r.rung) === 4 ? r.keyword : '') || '').toLowerCase().trim(); if (h && !otherHeads.has(String(r.ladder_id))) otherHeads.set(String(r.ladder_id), h); }
const taken = []; const seenTaken = new Set();
for (const r of others) for (const k of [r.keyword, r.head_keyword]) { const kw = String(k || '').toLowerCase().trim(); const sig = r.ladder_id + '|' + kw; if (kw && !seenTaken.has(sig)) { seenTaken.add(sig); taken.push({ keyword: kw, tokens: overlapTokens(kw), ladder_id: String(r.ladder_id), head: otherHeads.get(String(r.ladder_id)) || '' }); } }
// ---- R42 (2026-10-16, A14): pages already written and still unpublished, against the site's pile-up limit ----
// The Content Cadence stops at `max_waiting` (the `_site` row of seo_ladder_settings, default 3, pages written + not_ready in the last 120
// days); a ladder run used to write its page on top without a word about it. The report says so (Build_Ladder_Report.js).
const pile_up = (() => {
  // F-A1 / A-12 (2026-10-17): the count is the Content Cadence's own (v5/code/_waiting.js), so the two never disagree about how many
  // pages wait; exec 770 counted 5 waiting (limit 3), said so, and wrote a sixth anyway - the hold below now applies the limit
  const siteRow = settingsRows.find(r => String(r.ladder_id) === '_site') || {};
  const limit = Math.max(1, Math.min(100, Math.round(Number(siteRow.max_waiting)) || 3));
  const dom = reachDomain(domain);
  const log = rowsOf('Load Content Log (Ladder)').filter(r => reachDomain(r.domain) === dom);
  const W = WAITING.waiting({ log, ladders: rowsOf('Load Domain Ladders').filter(r => reachDomain(r.domain) === dom), now: Date.now(), days: 120 });
  return { waiting: W.count, needs_fix: W.needs_fix, limit, keywords: W.list.slice(0, 10).map(x => x.keyword), at_limit: W.count >= limit, loaded: log.length > 0,
    basis: 'the Content Cadence\'s count: pages written (or written and refused by the quality check) in the last 120 days and not published, each keyword once' };
})();
const takenBy = (kw) => { const t = overlapTokens(kw); return taken.find(x => overlapScore(t, x.tokens) >= 0.75) || null; };
const dupHead = [...otherHeads.entries()].map(([id, h]) => ({ ladder_id: id, head: h })).find(x => keywordsOverlap(x.head, head)) || null;
const headTakenAsPage = !dupHead ? takenBy(head) : null;

// ---- AI relevance verdicts ----
const rel = new Map();
outs.forEach((o, i) => {
  const items = (parse(o.output).items) || [];
  const chunk = chunks[i] ? chunks[i].keywords_chunk : [];
  items.forEach((it, j) => {
    const kw = String(it.keyword || (chunk[j] || {}).keyword || '').toLowerCase().trim();
    if (!kw) return;
    rel.set(kw, { relevance: Math.max(0, Math.min(2, Number(it.relevance ?? 1))), intent: String(it.intent || '').toLowerCase(), page_type: it.page_type,
      topic: String(it.topic || '').toLowerCase().replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim(), fit_reason: String(it.fit_reason || '').trim().slice(0, 240) });
  });
});
const RELF = { 2: 1, 1: 0.45, 0: 0 };
const excluded = [];
// F-A1 / A-11: a keyword the screen refused because the pages Google ranks for it sell what this business does not (it reads those pages'
// titles now, Relevance_Chunks.js) is named in the plan with that reason - it used to vanish without a word
const notSold = [];
// 2026-10-11 (FIX_PLAN D8): the pool already refused other brands / government / portal keywords (research.refused); the gate runs once more here
// with the AI screen's intent in hand, so a keyword the AI called navigational never reaches a rung either
const poolRefused = ((pool.research || {}).refused || []).slice();
let cacheRowsP = []; try { cacheRowsP = $('Load Site Cache').all().map(i => i.json); } catch (e) { cacheRowsP = []; }
const sdP = base.site_description || {};
const fitCtxP = { own_domain: domain, competitors: (base.competitors || []).map(String), serp_domains: [...new Set((base.competitors_summary || []).map(c => String(c.domain || '')).filter(Boolean))],
  brands: fitLearnedBrands(cacheRowsP), protect: [head, ...(sdP.products_or_services || []), ...(base.services || []), ...(SITE_MODEL ? SM.services(SITE_MODEL) : []), String(base.business || sdP.business_description || '').slice(0, 400)] };   // keyword-first (2026-10-19): the site model's services, the client's declared ones included
const kws = ((pool.research || {}).candidates || []).filter(k => { const g = fitGate(k.keyword, { ...fitCtxP, intent: (rel.get(k.keyword) || {}).intent || k.intent }); if (!g.ok) poolRefused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return g.ok; }).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), fit_reason: r.fit_reason || '', opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1) };
}).filter(k => { if (k.relevance > 0 && k.intent !== 'navigational') return true;
  if (k.relevance === 0 && k.fit_reason) notSold.push({ keyword: k.keyword, volume: k.volume, reason: k.fit_reason });
  return false; }).filter(k => {
  const t = takenBy(k.keyword); if (!t) return true;
  excluded.push({ keyword: k.keyword, ladder_id: t.ladder_id, head: t.head, as: t.keyword }); return false;
}).sort((a, b) => b.opportunity - a.opportunity);
// ---- R23 (2026-10-14, FIX_PLAN.md §3.12): every rung keyword has to be on this ladder's own topic ----
// Exec 549 planned "azure api management monetization" (volume 10, informational, quarterly trend -100%) as the ONE rung of a ladder
// whose head is "azure cloud migration dubai" — another topic, and no UAE in it. *Ladder Pool*'s own filter only asks for one shared
// word with the head ("azure"), and the AI screen judges relevance to the business, not distance to the head. The topic radius
// (v5/code/_radius.js, the kit discovery draws its radius with) is applied here, keyword by keyword, against the head: a keyword that
// fails it is left out WITH ITS REASON instead of becoming a page, a supporting keyword or an internal link.
const offTopic = [];
const onTopic = kws.filter(k => {
  const t = RAD.headFit(head, k.keyword);
  if (t.ok) return true;
  offTopic.push({ keyword: k.keyword, volume: k.volume, kd: k.kd, shared: t.shared, reason: t.reason });
  return false;
});

// ---- B2-4 (2026-10-15, benchmark area 2, criterion K7): rungs grouped by the results pages Google really shows ----
// `Ladder Clusters` bought one results page per rung candidate (bounded, see that node) and compared the TOP 7 at a 40% threshold -
// Keyword Insights' own current numbers, approved by the owner as B2-6. Two searches Google answers with the same pages are ONE page
// here: the cluster's members take the rung of their head keyword, so the grouping cannot be undone by the difficulty bands below, and
// `makePages` keys them on the cluster instead of on the AI's topic label.
//   INVARIANTS rule 1: a keyword whose results page could not be read is NOT clustered. It keeps its own group, it is named in
// `serp_clusters.not_compared` with the reason, and the plan says how many there were - it is never quietly merged or quietly dropped.
let SERP_CL = null; try { SERP_CL = $('Ladder Clusters').first().json.serp_clusters || null; } catch (e) { SERP_CL = null; }
const clusterOf = (SERP_CL && SERP_CL.available) ? (SERP_CL.of_keyword || {}) : {};
const notCompared = new Set(((SERP_CL || {}).not_compared || []).map(x => String(x.keyword)));
for (const k of onTopic) {
  const c = clusterOf[k.keyword] || null;
  k.serp_group = c ? c.head_keyword : '';
  k.serp_cluster = c && c.head_keyword !== k.keyword ? c : null;
  k.serp_cluster_size = c ? c.keyword_count : 0;
  k.serp_checked = !!SERP_CL && SERP_CL.asked > 0 && !notCompared.has(k.keyword) && (!!c || SERP_CL.compared > 0);
  // R40: "compared" must mean THIS keyword's results page was read - by name when the cluster step lists them, else only when it left
  // nothing uncompared (a keyword past the cap was never asked, so it may still share a topic label)
  const listed = Array.isArray((SERP_CL || {}).compared_keywords) ? SERP_CL.compared_keywords.map(x => String(x).toLowerCase()) : null;
  k.serp_compared = !!(SERP_CL && SERP_CL.available) && !notCompared.has(k.keyword) && (listed ? listed.includes(k.keyword) : (k.serp_checked && !(Number(SERP_CL.left_uncompared) > 0)));
  k.serp_not_compared = notCompared.has(k.keyword);
}

// ---- rung bands relative to reach (unknown difficulty = reach + 10) ----
const kdOf = (k) => k.kd == null ? reach + REACH_CFG.unknown_kd : k.kd;
const longTail = (k) => k.words >= 3 || (k.words >= 2 && k.volume < 200);
const BAND = { 1: reach, 2: reach + 15, 3: reach + 30 };
const rungOf = (k) => { const kd = kdOf(k); if (kd <= BAND[1] && k.volume >= 20 && longTail(k)) return 1; if (kd <= BAND[2]) return 2; if (kd <= BAND[3]) return 3; return 0; };   // 0 = later
// B2-4: one search, one page - so one CLUSTER, one rung. Every member of a cluster takes the rung of its head keyword (the strongest of
// the group); without that, "erp implementation cost" in rung 1 and "erp implementation cost dubai" in rung 2 would still become two
// pages although Google answers both with the same pages, which is exactly what this is here to stop.
const rungMap = new Map(onTopic.map(k => [k.keyword, rungOf(k)]));
const clusterRungs = [];
if (SERP_CL && SERP_CL.available) {
  const byHead = new Map();
  for (const k of onTopic) { const h = k.serp_group; if (!h) continue; if (!byHead.has(h)) byHead.set(h, []); byHead.get(h).push(k); }
  for (const [h, ks] of byHead) {
    if (ks.length < 2) continue;
    const headK = ks.find(k => k.keyword === h) || ks.slice().sort((a, b) => b.opportunity - a.opportunity)[0];
    const r = rungMap.get(headK.keyword);
    const moved = ks.filter(k => rungMap.get(k.keyword) !== r).map(k => k.keyword);
    for (const k of ks) rungMap.set(k.keyword, r);
    clusterRungs.push({ head_keyword: h, rung: r, keywords: ks.map(k => k.keyword), moved });
  }
}
const byRung = { 1: [], 2: [], 3: [] }; const later = [];
for (const k of onTopic) { const r = rungMap.get(k.keyword); if (r) byRung[r].push(k); else later.push(k); }

// ---- existing pages on the site (the site model's page inventory, this run's sitemap, or the URL that already ranks) ----
// 2026-10-12 (FIX_PLAN D11): the old rule scored the keyword's words against the slug's with Jaccard >= 0.5, so 3 keyword words in a
// 9-word slug gave 0.33 and the live page was missed: the 2026-10-01 plan wrote "uae e invoicing penalties" as a NEW page although
// /insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs had been live since August. SM.matchPage decides now:
// a page answers the keyword when >= 75% of its meaningful words are in the slug or the title, or when it already gets impressions for
// the exact query (seo_pages, filled weekly by the Site Tracker). A hit means status 'improve' with the real URL, never a second page.
const siteModel = (() => { try { const m = $('Site Model').first().json.site_model; return (m && typeof m === 'object') ? m : null; } catch (e) { return null; } })();
const invPages = [...(base.site_urls || []).map(u => ({ url: u, source: 'sitemap' })),
  ...((base.internal_link_candidates || []).filter(c => c && c.url && c.title).map(c => ({ url: c.url, title: c.title, source: 'sitemap' })))];
const pageModel = SM.withPages(siteModel || SM.from({ domain }, {}), invPages);
const findExisting = (keyword, yourUrl) => {
  if (yourUrl) return { url: yourUrl, source: 'ranking' };
  const m = SM.matchPage(pageModel, keyword);
  return m ? { url: m.url, source: m.source === 'gsc' || m.matched_by === 'query' ? 'search console' : 'sitemap', matched_by: m.matched_by, title: m.title || '' } : null;
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const homeUrl = domain ? siteUrlOf(domain, '/') : '';
const plannedUrl = (kw) => homeUrl + slug(kw) + '/';

// ---- one page per topic cluster inside each rung ----
const LIMIT = { 1: 4, 2: 4, 3: 3 };
const notPlanned = { 1: [], 2: [], 3: [] };
const MAX_CLUSTER = 6;   // a coarse AI topic label must not swallow a whole rung: split by page type, then into groups of 6
const makePages = (list, rung) => {
  const cl = new Map();
  // B2-4: a shared results page beats the AI's topic label. Keywords Google answers with the same pages share one key (and one page);
  // everything else keeps the old topic|page_type key. A keyword whose results page could not be read is in neither - it keeps its own.
  // R40 (2026-10-16): the one rule discovery uses too (KWI.pageGroup) - a SERP cluster is one page, a keyword whose results page was
  // compared and shared with no one is its OWN page, and only a keyword whose results page could not be compared joins a topic label
  // (exec 610: "openai consulting" was merged into "ai consulting firm" on the label although they share 0 of their top-7 results).
  const byOf = new Map();
  for (const k of list) { const g = KWI.pageGroup({ keyword: k.keyword, topic: k.topic || k.keyword, page_type: k.page_type, serp_head: k.serp_group && (k.serp_cluster_size || 0) > 1 ? k.serp_group : '', compared: k.serp_compared });
    const key = g.key; byOf.set(key, g.by); if (!cl.has(key)) cl.set(key, []); cl.get(key).push(k); }
  const groups = [];
  // a SERP group is evidence, not a label, so it is never split into two pages; an AI-label group still is (MAX_CLUSTER)
  for (const [key, ks] of cl) { const sorted = ks.slice().sort((a, b) => b.opportunity - a.opportunity);
    if (byOf.get(key) !== 'topic label') { groups.push(sorted); continue; }
    for (let i = 0; i < sorted.length; i += MAX_CLUSTER) groups.push(sorted.slice(i, i + MAX_CLUSTER)); }
  const clusters = groups.map(ks => ({ ks, opp: ks.reduce((s, k) => s + k.opportunity, 0) })).sort((a, b) => b.opp - a.opp);
  // R40: the keywords that lost their page to the rung limit are named ("not worth a page now"), never silently gone
  notPlanned[rung] = clusters.slice(LIMIT[rung]).flatMap(({ ks }) => ks.map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, reason: 'the rung holds ' + LIMIT[rung] + ' pages and ' + clusters.length + ' were possible; the stronger ones were kept' })));
  return clusters.slice(0, LIMIT[rung]).map(({ ks }) => {
    const p = ks[0];
    const ex = findExisting(p.keyword, p.your_url);
    const pos = ks.map(k => k.your_position).filter(Boolean);
    // FIX_PLAN D10 (2026-10-12): the AI screen answers in free text ("Comparison Page", "Service Page with a cost section"); the row,
    // the spawned page run and the brief take one of the form's fixed types, and the sentence itself stays as page_notes.
    const ptype = PT.of(p.page_type, defaultPage(p.intent));
    // F-A1 / A-11 (2026-10-17, exec 770): "dubai it consulting companies" (720/month) was planned as a Service Page with no word about
    // its results page - four lists of seven ("top 25 strategy consulting firms", "Top 10 IT consulting companies", a LinkedIn listicle,
    // "List of Top Consulting Companies"). The kind of page Google ranks is read from the titles this run already bought (Ladder Clusters
    // `types_of`, KWI.serpPageTypes); when it settles on a kind this plan does not write, the page says so beside its type.
    const sk = (((SERP_CL || {}).types_of) || {})[String(p.keyword).toLowerCase()] || null;
    const ours = KWI.pageKindOf ? KWI.pageKindOf(ptype) : '';
    const serp_kind = sk ? { read: sk.read, dominant: sk.dominant || '', dominant_count: sk.dominant_count || 0, mismatch: !!(sk.dominant && ours && sk.dominant !== ours), ours } : null;
    const page_type_note = serp_kind && serp_kind.mismatch
      ? serp_kind.dominant + 's are what Google ranks for "' + p.keyword + '": ' + serp_kind.dominant_count + ' of the ' + serp_kind.read + ' results read, while this plan writes a ' + String(ours).toLowerCase()
        + ' - write the kind of page the results show (for a list: a list that includes you, with its criteria) or expect to work harder for it'
      : null;
    // B2-4: what the group was built on - the shared results page, or the AI's topic label when no results page could be read
    const shared = ks.filter(k => k.serp_group === p.serp_group && k.keyword !== p.keyword).map(k => ({ keyword: k.keyword, shared_urls: (k.serp_cluster || {}).shared_urls || null, ...((k.serp_cluster || {}).via ? { via: k.serp_cluster.via, shared_with_head: k.serp_cluster.shared_with_head } : {}) }));
    // F-A1 / A-9: "own results page" is said only when it is true by the pair rule - the cluster step now compares a keyword with every
    // member of a group, not only with its head, so a keyword left alone shares fewer than the threshold with every keyword compared
    const viaM = ks.filter(k => k.serp_cluster && k.serp_cluster.via);
    const grouped_by = p.serp_group && ks.length > 1 ? 'shared results page' + (viaM.length ? ' (' + viaM.map(k => '"' + k.keyword + '" through "' + k.serp_cluster.via + '"').slice(0, 3).join(', ') + ')' : '')
      : p.serp_compared ? 'own results page (it shares fewer than ' + ((SERP_CL || {}).min_shared_urls || 3) + ' of its top ' + ((SERP_CL || {}).top_n || 7) + ' with every other keyword compared)' : 'topic label (results pages not compared)';
    return { rung, keyword: p.keyword, topic: p.topic, page_type: ptype, page_notes: PT.notes(p.page_type, ptype), serp_kind, page_type_note, intent: p.intent, volume: p.volume, kd: p.kd, cpc: p.cpc, opportunity: p.opportunity,
      grouped_by, serp_cluster: p.serp_group && ks.length > 1 ? { head_keyword: p.serp_group, keyword_count: ks.length, shared, urls_compared: ((clusterOf[p.keyword] || {}).urls_compared) || null, min_shared_urls: (SERP_CL || {}).min_shared_urls || null, top_n: (SERP_CL || {}).top_n || null } : null,
      serp_not_compared: !!p.serp_not_compared,
      supporting: ks.slice(1, 7).map(k => k.keyword),
      keywords: ks.slice(0, 8).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, your_position: k.your_position })),
      total_volume: ks.reduce((s, k) => s + k.volume, 0), traffic_potential: ks.reduce((s, k) => s + (k.traffic_potential || 0), 0),
      your_position: pos.length ? Math.min(...pos) : null, exists: !!ex, target_url: ex ? ex.url : plannedUrl(p.keyword), existing_source: ex ? ex.source : null, status: ex ? 'improve' : 'new' };
  });
};
const bandLabel = (r) => r === 1 ? 'Rung 1 — long-tail pages (difficulty up to ' + BAND[1] + ')' : r === 2 ? 'Rung 2 — mid-difficulty pages (' + (BAND[1] + 1) + '-' + BAND[2] + ')' : 'Rung 3 — strong pages (' + (BAND[2] + 1) + '-' + BAND[3] + ')';
const rungs = [1, 2, 3].map(r => ({ rung: r, label: bandLabel(r), band_max: BAND[r], pages: makePages(byRung[r], r), available: byRung[r].length, not_planned: notPlanned[r] }));

// ---- the main keyword for this site: difficulty, plan type, months ----
const kd = base.keyword_data || {}; const headRank = SR.head || null;
const verdict = base.verdict || 'GO_WITH_CHANGES';
// D8: the main keyword through the same gate, with its own results page in hand (one domain whose label is in the keyword holding 3+ of the
// top 5 = a brand query); the head term itself is not a protected word here
const headSerp = (base.competitors_summary || []).slice().sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99)).map(c => String(c.domain || '')).filter(Boolean);
const headGate = fitGate(head, { ...fitCtxP, intent: kd.google_intent || '', serp: headSerp, protect: fitCtxP.protect.slice(1) });
const other_brand = !headGate.ok && headGate.reason === 'other brand';
const navigational = /navigational/i.test(String(kd.google_intent || '')) || (base.verdict_reasons || []).some(r => /navigational|brand (term|name|search)|another company/i.test(String(r))) || (!headGate.ok && ['navigational', 'own brand', 'government', 'portal'].includes(headGate.reason));
const difficulty_for_you = difficultyForYou(kd.keyword_difficulty ?? null, reach, { navigational, other_brand, verdict, position: headRank ? headRank.position : null });
const strongSite = reachStrong(sa, headRank ? headRank.position : null);
// R49 (2026-10-16): no chance band when the reach rests on no measured ranking (exec 610: size tier, 0 keywords in the top 10)
const plan = reachPlan(difficulty_for_you, strongSite, reachMeasured(topic_authority.used ? { used: true } : reachInfo, headRank ? headRank.position : null));
const topType = PT.of(base.recommended_page || base.page_type, base.page_type);
const top = { rung: 4, keyword: head, page_type: topType, page_notes: PT.notes(base.recommended_page || base.page_type, topType), intent: kd.google_intent || null, volume: kd.search_volume ?? null, kd: kd.keyword_difficulty ?? null, cpc: kd.cpc ?? null,
  supporting: (base.secondary_keywords || []).slice(0, 6), your_position: headRank ? headRank.position : null };
// R41 (2026-10-16, B6-15): the head term's traffic was volume x 0.3 with NO click loss (40 -> 12) while the rungs and the verdict beside it
// applied the results page's click loss (the verdict said 6). One figure per keyword per report: the verdict's own estimate when it made
// one, else the same model (KWI.calibrate on the head's volume and this results page's features) - with its basis either way.
const headTraffic = (() => { const ev = base.expected_visits;
  if (ev && typeof ev === 'object' && (ev.visits != null || ev.basis === 'unknown')) return { visits: ev.visits ?? null, basis: ev.basis || '', note: ev.note || ev.basis_text || '', loss: ev.loss_applied || '' };
  const feats = ((base.serp_features || {}).features_present) || [];
  const c = KWI.calibrate({ volume: kd.search_volume ?? null, serp_types: feats }, {});
  return { visits: c.traffic_potential ?? null, basis: c.traffic_basis, note: c.traffic_note || '', loss: KWI.lossText(feats) }; })();
Object.assign(top, { traffic_potential: headTraffic.visits, traffic_basis: headTraffic.basis, traffic_note: headTraffic.note, traffic_loss: headTraffic.loss });
// P2-7 (2026-10-12, Phase 2 live check §3): the length the verdict asked for is stored with the main page, so a later page run still has a
// target when *Parse Analysis* does not run (a `force_content` run: the app's "Write now", the Content Cadence). Run 442 wrote 3,864 words
// for the page the ladder verdict had set at 2,100 — +84% — because nothing remembered that number.
const verdictWords = (() => { for (const t of (base.verdict_changes || [])) {
    const m = String(t || '').match(/\b(?:of|about|around|roughly|approximately|target|aim for|at least|up to)\s+(\d[\d,]{2,5})[\s-]*words?\b/i);
    if (m) { const n = Number(String(m[1]).replace(/,/g, '')); if (n >= 300 && n <= 6000) return n; } } return 0; })();
const analysisWords = Number((base.competitor_analysis || {}).recommended_word_count) || 0;
top.target_words = verdictWords || analysisWords || 0;
// R8 (2026-10-13, re-rating): the rung pages carried `target_words: 0` (seo_ladders rows 19-22 live), so P2-7's clamp protected only the page
// the verdict measured and the spawn body for exec 500 carried `ladder_words: 0`. The target comes from the word counts of the pages that
// actually rank for this ladder's topic (`competitors_summary[].word_count` — the pages this run read with Jina): the MEDIAN of the field for a
// rung page, because a rung keyword is an easier search than the head term and its pages are shorter, while the main page keeps the verdict's
// own number (usually the best page's length). No per-rung results page is read: that would be one paid SERP call per rung keyword.
const headExisting = (base.existing_page && base.existing_page.url) ? { url: base.existing_page.url, source: base.existing_page.source || 'sitemap' } : findExisting(head, headRank && headRank.url);
Object.assign(top, { exists: !!headExisting, target_url: headExisting ? headExisting.url : plannedUrl(head), existing_source: headExisting ? headExisting.source : null, status: headExisting ? 'improve' : 'new' });

// ---- feasibility of the destination (alternatives before any page is dropped) ----
const status = difficulty_for_you === 'not_realistic' ? 'unrealistic' : difficulty_for_you === 'very_hard' ? 'stretch' : 'winnable';
const altPool = [...(base.verdict_changes || []).filter(s => /["“”]/.test(String(s))), ...(base.secondary_keywords || [])].slice(0, 4);
const altPages = [...rungs[2].pages, ...rungs[1].pages, ...rungs[0].pages].map(p => p.keyword);
const alternatives = status === 'winnable' ? [] : (altPool.length ? altPool : altPages.slice(0, 3));

// ---- R23: the data a plan rests on. A ladder is scored, written and published on the strength of this run's research and of the
//      live results page; when either is missing the honest answer is "I could not check this", not a plan with a score on it.
//      Exec 549 produced "winnable / GO_WITH_CHANGES 68" and wrote a page from a pool of ONE keyword while both SERP calls had
//      failed (40101) and the keyword data came back empty. A refusal here also stops the page run: `write_now` stays empty. ----
// Two floors, so a genuinely narrow topic with real data still gets its plan (a main page is a valid ladder: "peppol uae",
// 2026-10-08) while a run whose data never arrived does not: fewer than LADDER_MIN_POOL keywords is too thin whatever else is
// known, and fewer than LADDER_WEAK_POOL counts as nothing at all when the head keyword itself has no volume and no difficulty.
const LADDER_MIN_POOL = 3, LADDER_WEAK_POOL = 5;
const poolSize = Number((pool.research || {}).pool_size) || ((pool.research || {}).candidates || []).length;
const headMeasured = (kd.search_volume ?? null) != null || (kd.keyword_difficulty ?? null) != null;
const thinPool = poolSize < LADDER_MIN_POOL || (poolSize < LADDER_WEAK_POOL && !headMeasured);
const serpOut = (base.serp_features && base.serp_features.unavailable === true) ? String(base.serp_features.error || 'no answer').slice(0, 160) : '';

// ---- refusals: a duplicate main keyword, a destination that is not realistic, or data we do not have -> no ladder pages ----
let refusal = null;
if (dupHead) refusal = { reason: 'duplicate', ladder_id: dupHead.ladder_id, head: dupHead.head,
  message: 'This website already has a keyword ladder for "' + dupHead.head + '" (' + dupHead.ladder_id + '). One search needs one page, so no second ladder was planned: continue that ladder instead.' };
else if (plan.plan_type === 'none') refusal = { reason: 'not_realistic', message: '"' + head + '" is not a realistic main keyword for ' + domain + ' (' + (other_brand ? 'it is another company\'s brand: ' + headGate.detail : navigational ? 'people searching it look for one particular website or brand' + (!headGate.ok ? ': ' + headGate.detail : '') : 'the verdict is AVOID') + '). No ladder pages were planned; pick one of the alternatives as the main keyword instead.' };
else if (serpOut) refusal = { reason: 'serp_unchecked', short: 'the live Google results could not be checked', detail: serpOut,
  message: 'The live Google results for "' + head + '" could not be read on this run (' + serpOut + '), so nothing is known about who ranks for it, how strong those pages are or which results-page features take the clicks. A ladder plan is a bet on that competition, so none was planned, nothing was scored and no page was written. Run it again once the search data provider answers.' };
else if (thinPool) refusal = { reason: 'thin_data', short: 'the keyword research returned too little data', pool_size: poolSize, minimum: LADDER_MIN_POOL, head_measured: headMeasured,
  message: 'The keyword research returned only ' + poolSize + ' keyword' + (poolSize === 1 ? '' : 's') + ' around "' + head + '" in ' + (base.country || 'this market')
    + (headMeasured ? ' (a ladder needs at least ' + LADDER_MIN_POOL + ' to pick rungs from)' : ', and the search data provider has no search volume and no difficulty for "' + head + '" itself')
    + ', so there is not enough data to plan one. No pages were planned and none was written: check the destination keyword, or run it again if the search data provider was failing.' };
const dataRefused = !!(refusal && (refusal.reason === 'serp_unchecked' || refusal.reason === 'thin_data'));
const plan_type = refusal ? 'none' : plan.plan_type;
const planned = !refusal;

// ---- R34 (2026-10-16): one live page, one plan entry ----
// With the page inventory's titles read, the same existing page can answer the main keyword and a rung keyword ("ai consulting dubai"
// and "ai consulting" both -> /ai-copilot-advisory-uae). Improving one page twice is not two pages: a rung page whose existing URL is
// already claimed (by the main page first, then by a stronger rung page) is folded into that entry as a supporting keyword, and said so.
const folded = [];
{ const ukeyF = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const claim = new Map(); if (top.exists) claim.set(ukeyF(top.target_url), top);
  for (const r of rungs) r.pages = r.pages.filter(p => { if (!p.exists) return true; const k = ukeyF(p.target_url); const owner = claim.get(k);
    if (!owner) { claim.set(k, p); return true; }
    owner.supporting = [...new Set([...(owner.supporting || []), p.keyword, ...(p.supporting || [])])];
    folded.push({ keyword: p.keyword, rung: r.rung, url: p.target_url, into: owner === top ? 'main page' : owner.keyword, traffic_potential: p.traffic_potential || 0,
      note: '"' + p.keyword + '" is answered by the same live page as ' + (owner === top ? 'the main keyword' : '"' + owner.keyword + '"') + ' (' + p.target_url + '), so it is a supporting keyword of that page, not a second page' });
    return false; }); }
// ---- F-A1 / A-8 + A-10 (2026-10-17, re-rating exec 770): one keyword, one page - across the rungs, the main page's supporting keywords,
//      the site's other ladders and its live pages ----
// Exec 770 planned "it consulting company dubai" twice: as the rung page of row 32 and as a supporting keyword of the main page (row 33),
// whose six supporting keywords were the verdict's own list, grouped with the main keyword on nothing but their words (only one of them
// had its results page read, and it shares 0 of the main keyword's top 7). The plan's note said "A search that an existing page already
// answers is never given a second page" while it did exactly that inside the plan. Every keyword now has exactly one owner:
//   1. a rung page owns its own keyword and its members (the results pages decided those, Ladder Clusters);
//   2. two rung pages for the same keyword - the same words where Google's own pages were not read for both - become one;
//   3. the main page's supporting keywords are kept only when nothing above owns them, no other ladder has them, no live page of the site
//      answers them, they pass the fit gate and the topic test, and - when their results page was read (Ladder Cluster Requests buys it
//      within the same cap) - Google answers them with the main keyword's own pages; a supporting keyword whose results page could not
//      be read is kept and labelled "grouped by topic, not compared", never presented as measured.
const one_page = { moved: [], left_out: [], kept: [] };
{
  const lowK = (x) => String(x || '').toLowerCase().trim();
  const urlsOfK = (kw) => { const u = (((SERP_CL || {}).urls_of) || {})[lowK(kw)]; return Array.isArray(u) && u.length ? u : null; };
  const needK = (SERP_CL || {}).min_shared_urls || 3, depthK = (SERP_CL || {}).top_n || 7;
  const headUrls = (base.competitors_summary || []).filter(c => c && Number(c.rank) >= 1 && Number(c.rank) <= depthK)
    .sort((a, b) => Number(a.rank) - Number(b.rank)).map(c => KWI.urlKey(c.url || c.domain)).filter(Boolean);
  const headRead = headUrls.length >= KWI.CFG.min_urls;
  const sharedN = (a, b) => { const sb = new Set(b); return a.filter(u => sb.has(u)).length; };
  // the same words: every word kept (numbers and one-letter words too - "phase 1" is not "phase 2"; "best" and "top" change the search),
  // only joining words dropped and a plural folded ("companies" = "company"); the R1 cross-ladder rule (overlapTokens, 75%) is looser
  // on purpose and is not used here
  const JOIN = new Set(['in', 'the', 'a', 'an', 'of', 'for', 'to', 'on', 'at', 'and', 'with', 'by', 'from']);
  const wordsKey = (kw) => [...new Set(lowK(kw).split(/[^a-z0-9]+/).filter(t => t && !JOIN.has(t)).map(t => t.length > 3 ? t.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : t))].sort().join(' ');
  // the same keyword: the same string, or - unless Google's own pages were read for both and settle it - the same words
  const sameKw = (a, b) => { a = lowK(a); b = lowK(b); if (!a || !b) return false; if (a === b) return true;
    const ua = a === head ? (headRead ? headUrls : null) : urlsOfK(a), ub = b === head ? (headRead ? headUrls : null) : urlsOfK(b);
    if (ua && ub) return sharedN(ua, ub) >= needK;
    const wa = wordsKey(a); return !!wa && wa === wordsKey(b); };
  // "does the site already hold this search" is ONE rule, the one the page run's verdict applies to its secondary keywords (F-A3,
  // v5/code/_own_cover.js OWN.claim): a live page (Search Console's own word, or EVERY meaningful word in its slug / title - page_min 1:
  // SM.matchPage's 75% lets "it consulting services dubai" match "AI Consulting Copilot Advisory Services in UAE", 3 of 4 with the subject
  // missing), then another keyword ladder of the site (read back through the fit gate), then an unpublished draft. This ladder's own rows
  // are not stored yet, so they never claim themselves.
  const ownLadders = OWN.ladders(others.filter(r => { try { return fitStored(r, { own_domain: domain, protect: [String(r.head_keyword || '')] }).ok; } catch (e) { return true; } }), settingsRows, { domain });
  const ownDrafts = OWN.drafts(rowsOf('Load Content Log (Ladder)').filter(r => reachDomain(r.domain) === reachDomain(domain)), { domain });
  const ownCtx = (exclude) => ({ matchPage: (k) => SM.matchPage(pageModel, k), ladders: ownLadders, drafts: ownDrafts, exclude_urls: exclude, self: { ladder_id: ladderId, keyword: head }, page_min: 1 });
  const pageOnly = (exclude) => ({ ...ownCtx(exclude), ladders: [], drafts: [] });
  const claimsOf = (pg) => [pg.keyword, ...(pg.supporting || []), ...((pg.keywords || []).map(k => k.keyword))].map(lowK).filter(Boolean);
  // 2. rung pages, in plan order: a page whose keyword another page already owns is folded into that page (or into the main page)
  const owners = [];
  for (const r of rungs) r.pages = r.pages.filter(pg => {
    if (sameKw(pg.keyword, head)) {
      top.supporting = [...new Set([...(top.supporting || []), pg.keyword])];
      one_page.moved.push({ keyword: pg.keyword, from: 'rung ' + r.rung + ' page', to: 'the main page', why: 'it is the main keyword\'s own search' }); return false; }
    const owner = owners.find(o => claimsOf(o).some(k => sameKw(k, pg.keyword)));
    if (owner) { owner.supporting = [...new Set([...(owner.supporting || []), pg.keyword, ...(pg.supporting || [])])];
      one_page.moved.push({ keyword: pg.keyword, from: 'rung ' + r.rung + ' page', to: '"' + owner.keyword + '"', why: 'the same search as a keyword that page already targets' }); return false; }
    owners.push(pg); return true; });
  // a rung page's supporting keyword that a live page of the site already answers belongs to that page, not to a new one
  for (const pg of owners) pg.supporting = (pg.supporting || []).filter(kw => { const c = OWN.claim(kw, pageOnly(pg.exists ? [pg.target_url] : []));
    if (!c) return true;
    one_page.left_out.push({ keyword: kw, page: pg.keyword, why: OWN.sayOf(c) + ' already answers it' }); return false; });
  // 3. the main page's supporting keywords
  const cand = [...new Set([...(top.supporting || []), ...(base.secondary_keywords || [])].map(lowK).filter(Boolean))].slice(0, 12);
  const keep = [];
  for (const kw of cand) {
    const out = (why, extra) => { one_page.left_out.push({ keyword: kw, page: 'main page', why, ...(extra || {}) }); };
    if (kw === head) continue;   // the same search as the head (same words, or the same results page) belongs on this page: it is kept below
    // R34 / step 2 above: a keyword folded into the main page because the same live page (or the main search itself) answers it stays
    const fold = folded.find(f => lowK(f.keyword) === kw && f.into === 'main page') || one_page.moved.find(m => lowK(m.keyword) === kw && m.to === 'the main page');
    if (fold) { keep.push({ keyword: kw, by: fold.why || 'the same live page answers it', shared_urls: null, of: null }); continue; }
    const owner = owners.find(o => claimsOf(o).some(k => sameKw(k, kw)));
    if (owner) { out('the rung page "' + owner.keyword + '" targets it'); continue; }
    const tk = takenBy(kw); if (tk) { out('it belongs to your ladder "' + tk.head + '"'); continue; }   // R1, the cross-ladder rule the rungs use
    const oc = OWN.claim(kw, ownCtx(top.exists ? [top.target_url] : []));
    if (oc) { out(OWN.sayOf(oc) + (oc.kind === 'page' ? ' already answers it' : ' holds it (' + oc.how + ')'), { claim: oc.kind }); continue; }
    const g = fitGate(kw, { ...fitCtxP, intent: '' }); if (!g.ok) { out('refused by the fit gate (' + g.reason + ')'); continue; }
    const hf = RAD.headFit(head, kw); if (!hf.ok) { out('not on this ladder\'s topic'); continue; }
    const u = urlsOfK(kw);
    if (u && headRead) {
      const n = sharedN(u, headUrls);
      if (n >= needK) { keep.push({ keyword: kw, by: 'shared results page', shared_urls: n, of: headUrls.length }); continue; }
      const cl = clusterOf[kw];
      out('Google answers it with other pages: ' + n + ' of the main keyword\'s top ' + headUrls.length + ' (' + needK + ' needed)' + (cl ? '; it groups with "' + cl.head_keyword + '"' : ''), { shared_urls: n });
      continue;
    }
    keep.push({ keyword: kw, by: 'topic label (results page not compared)', shared_urls: null, of: null });
  }
  const kept = keep.slice(0, 6);
  top.supporting = kept.map(k => k.keyword);
  top.supporting_basis = kept;
  const measured = kept.filter(k => k.by === 'shared results page').length, viaFold = kept.filter(k => k.by !== 'shared results page' && k.shared_urls == null && !/^topic label/.test(k.by)).length;
  top.grouped_by = !kept.length ? (headRead ? 'no supporting keyword shares the main keyword\'s results page' : 'no supporting keyword')
    : measured + viaFold === kept.length ? 'shared results page (each shares at least ' + needK + ' of the main keyword\'s top ' + headUrls.length + ')' + (viaFold ? ' or the same live page' : '')
      : measured ? 'shared results page for ' + measured + ' of ' + kept.length + '; the rest grouped by topic (their results pages were not compared)'
        : 'topic label (results pages not compared)';
  one_page.kept = kept;
}
// ---- pages per plan type: direct 2-3 supporting pages, short 3-5, full as before (rung limits); the rest is kept for later ----
const CAP = { direct: 3, short: 5, full: Infinity, none: 0 }[plan_type];
let kept = 0;
for (const r of rungs) {
  const keep = r.pages.slice(0, Math.max(0, CAP - kept)); kept += keep.length;
  for (const p of r.pages.slice(keep.length)) later.unshift({ keyword: p.keyword, volume: p.volume, kd: p.kd, held_back: true });
  r.pages = keep;
}
const rungPages = rungs.flatMap(r => r.pages);
// ---- R22 (2026-10-14, FIX_PLAN.md §3.12): a rung page may never carry a word target of 0 ----
// The rung rows of exec 549 carried `target_words: 0`, so *Spawn Page Runs* passed `ladder_words: 0` and the clamp protected only the
// main page (1,800 from the competitor analysis). The rung page then shipped 2,648 words — +47% — after two editor rounds. The target
// comes from the pages that actually rank for this ladder's topic (the median of the lengths this run read, because a rung keyword is
// an easier search than the head term and its pages are shorter); with no SERP length data it falls back to the main page's own
// target, then to the competitor analysis, and last to a stated default — and the row always says WHICH of them it was.
const RUNG_WORDS = { floor: 700, fallback: 1200 };
const serpWordCounts = (base.competitors_summary || []).map(c => Number(c.word_count) || 0).filter(w => w >= 200 && w <= 12000).sort((a, b) => a - b);
const rungWords = (() => {
  if (serpWordCounts.length) {
    const mid = serpWordCounts.length >> 1;
    const med = serpWordCounts.length % 2 ? serpWordCounts[mid] : Math.round((serpWordCounts[mid - 1] + serpWordCounts[mid]) / 2);
    const words = Math.max(RUNG_WORDS.floor, Math.min(Math.round(med / 100) * 100, top.target_words || Infinity));
    return { words, source: 'the median length of the ' + serpWordCounts.length + ' page(s) read on this topic\'s results page' };
  }
  if (top.target_words) return { words: top.target_words, source: 'the main page of this ladder (no results page was read for the rung keywords)' };
  if (analysisWords) return { words: analysisWords, source: 'the competitor analysis' };
  return { words: RUNG_WORDS.fallback, source: 'the default length for a supporting page (nothing in this run measured one)' };
})();
for (const r of rungs) for (const pg of (r.pages || [])) if (!Number(pg.target_words)) { pg.target_words = rungWords.words; pg.target_words_source = rungWords.source; }
top.target_words_source = verdictWords ? 'the verdict' : analysisWords ? 'the competitor analysis' : 'not measured';
// no supporting page in the data (a narrow topic: the research found no long-tail keywords, live 2026-10-08 "peppol uae"): the main page is the
// whole ladder for now, so it is written first whatever the plan type — the Content Cadence's gate opens too when a ladder has no supporting page
const mainFirst = plan_type === 'direct' || (planned && !rungPages.length);
let pageNo = 0;
if (mainFirst) top.page_no = ++pageNo;   // direct: the main page is written first
for (const p of rungPages) p.page_no = ++pageNo;
if (!mainFirst) top.page_no = ++pageNo;

// ---- internal link map: every rung page -> top page + one sibling; top page -> every rung page ----
const link_map = [];
for (const r of rungs) {
  const ps = r.pages;
  ps.forEach((p, i) => {
    p.links_to = [{ url: top.target_url, role: 'top', keyword: top.keyword }];
    link_map.push({ from: p.target_url, to: top.target_url, type: 'up' });
    if (ps.length > 1) { const sib = ps[(i + 1) % ps.length]; p.links_to.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword }); link_map.push({ from: p.target_url, to: sib.target_url, type: 'sideways' }); }
  });
}
top.links_to = rungPages.map(p => ({ url: p.target_url, role: 'rung ' + p.rung, keyword: p.keyword }));
if (planned) rungPages.forEach(p => link_map.push({ from: top.target_url, to: p.target_url, type: 'down' }));

// ---- timeline (months): full = rung by rung (shorter for a strong site), then the main page in the plan's range; short = supporting pages,
//      then the main page; direct = the main page first, its supporting pages in the same window ----
const range = plan.months_range || [0, 0];
const timeline = [];
const topLabel = 'Top — ' + head;
if (!planned) { for (const r of rungs) r.months = null; top.months = null; }
else if (plan_type === 'full') {
  const BASE_LEN = { 1: 2, 2: 3, 3: 3 }; let month = 1;
  for (const r of rungs) {
    if (!r.pages.length) { r.months = null; continue; }
    const len = Math.max(1, BASE_LEN[r.rung] - (strongSite ? 1 : 0));
    r.months = [month, month + len - 1]; timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); month += len;
  }
  top.months = range.slice(); timeline.push({ rung: 4, label: topLabel, months: top.months, pages: 1 });
} else if (plan_type === 'short') {
  const sup = [1, Math.max(1, range[0] - 1)];
  for (const r of rungs) { r.months = r.pages.length ? sup.slice() : null; if (r.pages.length) timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); }
  top.months = range.slice(); timeline.push({ rung: 4, label: topLabel, months: top.months, pages: 1 });
} else {
  top.months = range.slice(); timeline.push({ rung: 4, label: topLabel + ' (written first)', months: top.months, pages: 1 });
  for (const r of rungs) { r.months = r.pages.length ? range.slice() : null; if (r.pages.length) timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); }
}

const bl = kd.competitor_backlink_strength || {};
// ---- B2-5 (2026-10-15, benchmark area 2): how many different sites own the destination's results page ----
// Semrush ranks the pages of a plan on five named factors and DOMAIN DIVERSITY is the fifth (https://www.semrush.com/kb/1058-keyword-
// strategy-builder); ours never looked at it - `avg_referring_domains` was the only competition signal. A results page held by a few
// sites is a page where each of them holds more than one of the ten results, which is what a site with real topical coverage looks
// like, and it is harder to break into than a page of ten different sites.
//   The COUNT is measured (distinct registrable domains among the top 10 results this run read, at the time it read them, through the
// same LK.regDomain the competitor gate uses since R21, so a rival on a subdomain is not counted as a second site). The ADJUSTMENT is a
// stated rule and says so: it is not measured, and it is printed with the reason wherever the score is.
const headTop10 = (base.competitors_summary || []).filter(c => c && Number(c.rank) >= 1 && Number(c.rank) <= 10);
const diversityDomains = [...new Set(headTop10.map(c => LK.regDomain(LK.hostOf(c.url || '') || String(c.domain || ''))).filter(Boolean))];
// The rule is stated on ten results - 5 or fewer sites is concentrated, 6 or 7 narrow, 8 or more open - but a results page does not
// always carry ten ordinary results (an AI Overview, a local pack and a video block take their room), so it is applied as the SHARE it
// is: half of the results read or fewer is concentrated, 70% or fewer is narrow. Six different sites in six results is a page of six
// different sites, not a narrow one. Below DIVERSITY.min_results there is too little of the page to judge and nothing is adjusted.
const DIVERSITY = { concentrated: 5, narrow: 7, of: 10, min_results: 5 };
const DIVERSITY_PENALTY = { concentrated: 6, narrow: 3, open: 0 };
const divShare = headTop10.length ? diversityDomains.length / headTop10.length : 0;
const divBand = divShare <= DIVERSITY.concentrated / DIVERSITY.of ? 'concentrated' : divShare <= DIVERSITY.narrow / DIVERSITY.of ? 'narrow' : 'open';
const divChecked = !serpOut && headTop10.length >= DIVERSITY.min_results && diversityDomains.length > 0;
const divPenalty = divChecked && !dataRefused ? DIVERSITY_PENALTY[divBand] : 0;
const divText = !divChecked
  ? 'The results page for "' + head + '" could not be read on this run, so how many different sites own it is not known and the score is unchanged.'
  : diversityDomains.length + ' different site(s) hold the top ' + headTop10.length + ' results for "' + head + '"'
    + (divBand === 'open' ? ' — no site owns more than its share, so the page is as open as a results page gets and the feasibility score is unchanged.'
      : ' — ' + (divBand === 'concentrated' ? 'few sites own this page' : 'the page is narrow') + ', so at least one of them holds several of the results with the topical coverage that takes. The feasibility score is '
        + divPenalty + ' point(s) lower for it: a stated rule (' + DIVERSITY_PENALTY.concentrated + ' at ' + DIVERSITY.concentrated + ' sites or fewer of ten, '
        + DIVERSITY_PENALTY.narrow + ' at ' + (DIVERSITY.concentrated + 1) + '-' + DIVERSITY.narrow + ' of ten, nothing above), not a measured effect.')
    + (diversityDomains.length ? ' The sites: ' + diversityDomains.slice(0, 10).join(', ') + '.' : '');
const scoreBefore = dataRefused ? null : (base.verdict_score ?? null);
const scoreAfter = scoreBefore == null ? null : Math.max(0, Math.round(scoreBefore - divPenalty));
const serp_diversity = { checked: divChecked, domains: divChecked ? diversityDomains.length : null, results: headTop10.length,
  band: divChecked ? divBand : 'unknown', share_pct: divChecked ? Math.round(divShare * 100) : null, domain_list: diversityDomains.slice(0, 10), penalty: divPenalty,
  score_before: scoreBefore, score_after: scoreAfter, bands: DIVERSITY, penalties: DIVERSITY_PENALTY,
  basis: divChecked ? 'measured: distinct registrable domains among the top ' + headTop10.length + ' results read on this run'
    + ((base.serp_features || {}).checked_at ? ' at ' + String((base.serp_features || {}).checked_at) : '') + '; the adjustment itself is a stated rule, not a measured effect'
    : 'not available: the live results page could not be read on this run', text: divText };

// R23: a feasibility score is a reading of the competition. With no results page and no research there is nothing to read, so the
// status is "not checked" and the score is empty — never the verdict's number next to the word "winnable".
const feasibility = { status: dataRefused ? 'not_checked' : status, verdict: dataRefused ? null : verdict, score: dataRefused ? null : scoreAfter,
  reasons: [...(base.verdict_reasons || []), ...(divChecked ? [divText] : [])], what_must_change: base.verdict_changes || [], alternatives,
  expected_visits_top3: dataRefused ? null : (base.expected_visits_top3 ?? null), time_to_rank_months: dataRefused ? null : (base.time_to_rank_months ?? null), navigational,
  serp_diversity, score_before: scoreBefore, score_adjustment: -divPenalty,
  scored: !dataRefused, not_scored_reason: dataRefused ? refusal.message : '' };

// ---- what else is needed besides the pages ----
const requirements = [];
const needRd = bl.avg_referring_domains || null;
if (needRd) requirements.push({ item: 'Links to the top page', detail: 'Top-10 pages for "' + head + '" average ' + needRd + ' referring domains. Plan ' + Math.max(5, Math.round(needRd * 0.6)) + '+ relevant links (partners, directories, PR, guest articles) to the top page over the ladder period.' });
if (sa) requirements.push({ item: 'Site authority today', detail: domain + ' ranks for ' + (sa.organic_keywords || 0) + ' keywords (' + (sa.top10 || 0) + ' in the top 10, ' + (sa.top3 || 0) + ' in the top 3). ' + (sa.top10 < 20 ? 'The lower rungs come first: they build topical authority before the head term is realistic.' : 'Existing authority shortens the timeline.') });
if ((pool.head_geo || []).length) requirements.push({ item: 'Local trust signals', detail: 'The head term is local (' + pool.head_geo.join(' ') + '): a complete Google Business Profile, consistent name/address/phone and recent reviews support every rung.' });
requirements.push({ item: 'Entity and trust pages', detail: 'Organization schema, an about page with real credentials, author bylines and case studies; the content QA already adds schema to every generated page.' });
requirements.push({ item: 'Publish on schedule and interlink', detail: 'Each rung page links up to the top page and sideways to one sibling; the top page links down to every rung page. Ranking only starts once the pages are live.' });

// ---- B2-2 (2026-10-15, benchmark area 2): what this website ALREADY has on this topic, before one new page is planned ----
// MarketMuse starts a plan from the site's topic inventory and its effort bands begin with "optimise the existing page if it matches the
// topic; otherwise create a new one" (https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/). The ladder has
// always decided improve-vs-new per page (`findExisting`), but it never counted it up, so a plan opened with five new pages and said
// nothing about the pages the site already had on the same topic. The counts come from data already in the run: the page inventory, and
// the keywords the site ranks for, both filtered with the SAME on-topic test as the rungs.
// a page with no words of its own (the homepage: no title in the inventory and an empty path) matches nothing — RAD.headFit passes an
// empty token set, so it has to be refused here or every site "already has a page" on every topic
const onTopicPage = (p) => { try { const txt = [p.title || '', String(p.url || '').replace(/^https?:\/\/[^/]+/i, '').replace(/[^A-Za-z0-9]+/g, ' ')].join(' ');
  return RAD.tokens(txt).length > 0 && RAD.headFit(head, txt).ok; } catch (e) { return false; } };
const pagesOnTopic = []; const seenPg = new Set();
// R34 (2026-10-16): the count read only this run's sitemap URLs and link candidates (`invPages`), never the page inventory and its titles,
// so a live page titled "AI Consulting & Copilot Advisory UAE" was not "about" the topic. It reads the whole site model now, title + H1.
for (const p of SM.pages(pageModel)) { const u = String(p.url || ''); if (!u || seenPg.has(u) || !onTopicPage({ ...p, title: [p.title, p.h1].filter(Boolean).join(' ') })) continue; seenPg.add(u); pagesOnTopic.push({ url: u, title: String(p.title || '') }); }
const titleGapL = SM.titleGap(pageModel);
const allPlanned = planned ? [...rungPages, top] : [];
const nImprove = allPlanned.filter(p => p.exists).length, nNew = allPlanned.length - nImprove;
const bestPos = topic_authority.best;
topic_authority.coverage = { pages_on_site: pagesOnTopic.length, pages: pagesOnTopic.slice(0, 8), ranked_keywords: topic_authority.on_topic, title_gap: titleGapL, folded,
  top10_keywords: topic_authority.top10, best_position: bestPos ? bestPos.position : null, best_keyword: bestPos ? bestPos.keyword : '',
  planned_total: allPlanned.length, planned_improve: nImprove, planned_new: nNew,
  summary: !planned ? 'No pages were planned, so there is nothing to compare with what the site already has.'
    : (!pagesOnTopic.length && !topic_authority.on_topic
      ? (titleGapL.untitled
        ? 'No page of ' + domain + ' is about "' + head + '" by its title or address, and it ranks for no keyword on it — but ' + titleGapL.note + ' (e.g. ' + titleGapL.urls.slice(0, 3).join(', ') + '). So all ' + allPlanned.length + ' page(s) in this plan are planned as new; check those pages first.'
        : 'Nothing on ' + domain + ' is about "' + head + '" yet — no page and no keyword it ranks for — so all ' + allPlanned.length + ' page(s) in this plan are new and this topic starts from zero.')
      : domain + ' already has ' + pagesOnTopic.length + ' page(s) about "' + head + '" and ranks for ' + topic_authority.on_topic + ' keyword(s) on it ('
        + topic_authority.top10 + ' in the top 10' + (bestPos ? ', best #' + bestPos.position + ' for "' + bestPos.keyword + '"' : '') + '). Of the '
        + allPlanned.length + ' page(s) in this plan, ' + nImprove + ' improve' + (nImprove === 1 ? 's' : '') + ' a page you already have and ' + nNew + ' ' + (nNew === 1 ? 'is' : 'are') + ' new.'
        + (titleGapL.untitled ? ' Note: ' + titleGapL.note + '.' : ''))   // R34: what was judged on the address alone is said, in both branches
      + ' A search that an existing page already answers is never given a second page.' };
// ---- B2-3 (2026-10-15, benchmark area 2): every planned page says why it sits where it sits ----
// Semrush's Keyword Strategy Builder ranks the pages of a plan on five stated factors — relevance to the seed, search volume, keyword
// difficulty, domain diversity and SERP features (https://www.semrush.com/kb/1058-keyword-strategy-builder). Ours ordered pages by rung
// band and by the opportunity sum of their cluster and printed neither, so the plan's order had to be taken on trust. These are the
// factors that really decided it, in the page's own row — nothing new is computed and nothing new is fetched.
const unknownKd = reach + REACH_CFG.unknown_kd;
const whyFactorsOf = (p) => ({ rung: p.rung, kd: p.kd == null ? null : p.kd, counted_kd: p.kd == null ? unknownKd : p.kd, reach,
  difficulty_for_you: difficultyForYou(p.kd == null ? null : p.kd, reach, { position: p.your_position || null }),
  keywords: p.rung === 4 ? 1 + (p.supporting || []).length : ((p.keywords || []).length || 1),
  volume: p.rung === 4 ? (p.volume ?? null) : (p.total_volume ?? null), intent: p.intent || null,
  status: p.exists ? 'improve' : 'new', your_position: p.your_position || null, links_up: (p.links_to || []).some(l => l.role === 'top'),
  grouped_by: p.grouped_by || null, serp_cluster: p.serp_cluster || null,   // B2-4: Semrush's own fifth factor is the SERP, and this is where it decided the grouping
  serp_domains: p.rung === 4 ? serp_diversity.domains : null });
const whyOf = (p) => { const f = whyFactorsOf(p); const b = [];
  b.push((p.rung === 4 ? 'The destination page' : 'Rung ' + p.rung) + ': ' + (f.kd == null ? 'difficulty unknown, counted as ' + unknownKd : 'difficulty ' + f.kd)
    + ' against the reach this plan is measured against (' + reach + ')' + (topic_authority.used ? ', measured on this topic' : ', measured across the whole site'));
  b.push(f.keywords + ' keyword(s)' + (f.volume != null ? ', ' + f.volume + ' searches a month' : ', no search volume in the data'));
  if (f.intent) b.push(f.intent + ' intent');
  if (f.your_position) b.push('you are #' + f.your_position + ' for it today');
  b.push(f.status === 'improve' ? 'improves ' + p.target_url + ', which already answers it' : 'a page you do not have yet');
  if (f.links_up) b.push('links up to the main page');
  // B2-4: when a page exists because Google answers several searches with the same pages, that is the reason it exists
  if (f.serp_cluster && f.serp_cluster.keyword_count > 1) b.push('one page for ' + f.serp_cluster.keyword_count + ' searches Google answers with the same pages ('
    + (f.serp_cluster.shared || []).slice(0, 3).map(x => '"' + x.keyword + '"' + (x.shared_urls ? ' shares ' + x.shared_urls + ' of the top ' + (f.serp_cluster.top_n || 7) : '')).join(', ') + ')');
  else if (p.serp_not_compared) b.push('its results page could not be read on this run, so it was not compared with the others');
  if (p.rung === 4 && f.serp_domains) b.push(f.serp_domains + ' different site(s) hold the top ' + serp_diversity.results + ' results for it');
  return b.join('; ') + '.'; };
for (const p of allPlanned) { p.why = whyOf(p); p.why_factors = whyFactorsOf(p); }

// ---- pages to write now, in the plan's order (direct: the main page first; otherwise the supporting pages, the main page waits for support) ----
const order = !planned ? [] : mainFirst ? [top, ...rungPages] : rungPages;
const write_now = order.slice(0, pagesNow).map(p => ({ page_no: p.page_no, rung: p.rung, keyword: p.keyword, page_type: p.page_type, target_url: p.target_url, exists: p.exists, supporting: p.supporting, links_to: p.links_to, target_words: Number(p.target_words) || 0, why: p.why || '' }));   // R8: a rung page carries its own measured target now, not 0   // B2-3: and the reason it is first
// ---- F-A1 / A-12 (2026-10-17, re-rating exec 770): the website's own limits, the same ones the Content Cadence applies ----
// Exec 770 started a seventh active ladder against `max_active: 2` without a word, and wrote the main page while its own note said
// "You have 5 pages waiting to be published (limit 3)". The limits live in the `_site` row of seo_ladder_settings and the cadence obeys
// them every Monday; a ladder run asked to write pages now obeys them too: past either limit the pages are HELD (the plan and its rows
// are stored, nothing is written, the rows stay `planned`), and the plan says which limit, with the numbers. The cadence writes them
// when the limit clears. `force_content: true` on the request overrides both, and the plan says that it did.
const focusL = WAITING.focus({ ladders: rowsOf('Load Domain Ladders').filter(r => reachDomain(r.domain) === reachDomain(domain)), settings: settingsRows,
  log: rowsOf('Load Content Log (Ladder)').filter(r => reachDomain(r.domain) === reachDomain(domain)), exclude: ladderId, now: Date.now() });
const ownSet = settingsRows.find(r => String(r.ladder_id) === ladderId) || null;
// keyword-first R-K7 (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1 / §14.5): the mode the ladder is STARTED in, when the request names it
// (`ladder_mode`, the app's "Ask me before each page"), else its own settings row, else the website's default
const reqMode = ['auto', 'manual'].includes(String(base.ladder_mode || '').toLowerCase()) ? String(base.ladder_mode).toLowerCase() : '';
const ownMode = reqMode || (ownSet && ['auto', 'manual'].includes(String(ownSet.mode || '').toLowerCase()) ? String(ownSet.mode).toLowerCase() : focusL.site_mode);
const ownPrio = ownSet && Number(ownSet.priority) >= 1 ? Number(ownSet.priority) : Infinity;
const ahead = focusL.order.filter(l => l.priority < ownPrio || ownPrio === Infinity);
const queuedL = planned && ownMode === 'auto' && ahead.length >= focusL.max_active;
const forced = base.force_content === true;
const holdWhy = [];
// R-K7: a Manual ladder writes NOTHING at start - its text always said its pages wait for an OK, and until now the first pages_now were written
// anyway (pagesNow can never be 0). This is the client's own choice, not a limit, so `force_content` does not override it.
const manualHold = planned && write_now.length && ownMode === 'manual' ? { limit: 'manual', text: 'this ladder is Manual, so its pages wait for your OK: nothing was written at the start, and each page is written when you approve it (Write it on the Pipeline page)' } : null;
if (planned && write_now.length && pile_up.at_limit) holdWhy.push({ limit: 'pileup', text: pile_up.waiting + ' page(s) are written and waiting to be published, and the website\'s limit is ' + pile_up.limit
  + (pile_up.needs_fix ? ' (' + pile_up.needs_fix + ' of them did not pass the quality check and need a fix first)' : '') });
if (planned && write_now.length && queuedL) holdWhy.push({ limit: 'max_active', text: 'the website writes at most ' + focusL.max_active + ' Auto ladder(s) at a time, and ' + ahead.length + ' with pages still to write come before this one ('
  + ahead.slice(0, 4).map(l => '"' + l.head + '"').join(', ') + (ahead.length > 4 ? ' …' : '') + '), so it waits as Queued' });
const held = manualHold ? { pages: write_now.splice(0, write_now.length), why: [manualHold, ...holdWhy] }
  : holdWhy.length && !forced ? { pages: write_now.splice(0, write_now.length), why: holdWhy } : null;
const limits = { max_active: focusL.max_active, active_ahead: ahead.length, active_ladders: focusL.active.map(l => l.head), queued: queuedL, own_mode: ownMode, manual_hold: !!manualHold,
  chosen_by: ['client_typed', 'client_picked', 'system_announced'].includes(String(base.chosen_by || '')) ? String(base.chosen_by) : 'client_typed',   // R-K1: who chose this keyword (stored by Ladder Settings Rows)
  max_waiting: pile_up.limit, waiting: pile_up.waiting, waiting_needs_fix: pile_up.needs_fix, at_waiting_limit: pile_up.at_limit, forced: !!(forced && holdWhy.length),
  basis: focusL.basis + '; ' + pile_up.basis,
  text: 'Limits of this website: at most ' + focusL.max_active + ' Auto ladder(s) written at a time (' + ahead.length + ' ahead of this one' + (queuedL ? ', so it waits as Queued' : ownMode === 'manual' ? '; this ladder is Manual, so its pages wait for your OK' : ', so it is written now') + '); at most '
    + pile_up.limit + ' written pages waiting to be published (' + pile_up.waiting + ' now' + (pile_up.needs_fix ? ', ' + pile_up.needs_fix + ' needing a fix' : '') + ').'
    + (held ? ' So the page' + (held.pages.length === 1 ? '' : 's') + ' asked for now (' + held.pages.map(w => '"' + w.keyword + '"').join(', ') + ') ' + (held.pages.length === 1 ? 'was' : 'were') + ' NOT written: ' + held.why.map(w => w.text).join('; and ')
      + (manualHold ? '. The plan is stored; nothing is written until you approve a page.'
        : '. The plan is stored and the Content Cadence writes ' + (held.pages.length === 1 ? 'it' : 'them') + ' when ' + (held.why.some(w => w.limit === 'pileup') ? 'the waiting pages are published or discarded' : '') + (held.why.length > 1 ? ' and ' : '') + (held.why.some(w => w.limit === 'max_active') ? 'a ladder ahead of it is finished or paused (or you move this one up on the Pipeline page)' : '') + '.')
      : (forced && holdWhy.length ? ' The request said to write anyway (force), so the limits were overridden for this run: ' + holdWhy.map(w => w.text).join('; and ') + '.' : '')) };
const pages_total = planned ? rungPages.length + 1 : 0;
const stats = { pool_size: (pool.research || {}).pool_size || 0, ai_reviewed: rel.size, relevant: kws.length, pages_total, rung_pages: planned ? rungPages.length : 0,
  keywords_covered: planned ? rungPages.reduce((s, p) => s + 1 + p.supporting.length, 0) + 1 + top.supporting.length : 0,
  traffic_potential_total: planned ? rungPages.reduce((s, p) => s + (p.traffic_potential || 0), 0) + (top.traffic_potential || 0) + folded.reduce((s, f) => s + (f.traffic_potential || 0), 0) : 0,   // R34: a folded keyword still counts once
  site_rankings_found: SR.count || 0, research_failures: (pool.research || {}).failures || [], excluded_keywords: excluded.length, refused_keywords: poolRefused.length,
  off_topic_keywords: offTopic.length, on_topic: onTopic.length,
  // B2-4: what the results-page comparison cost and what it changed; B2-5: how many sites own the destination's results page
  serp_checks: SERP_CL ? SERP_CL.asked : 0, serp_checks_compared: SERP_CL ? SERP_CL.compared : 0, serp_checks_failed: SERP_CL ? SERP_CL.not_compared.length : 0,
  serp_check_cost_usd: SERP_CL ? SERP_CL.cost_usd : 0, serp_clusters: SERP_CL ? (SERP_CL.clusters || []).length : 0,
  serp_merged_keywords: clusterRungs.reduce((n, c) => n + Math.max(0, c.keywords.length - 1), 0), serp_domains: serp_diversity.domains };
// ---- G32 / K12: the site's topic radius around this ladder — in reach, a stretch, or out of reach for now, with the evidence ----
// (v5/code/_radius.js; the same kit draws discovery's radius, so the two never disagree). It is shown, not enforced: a plan the owner
// approved is never changed by it.
const topic_radius = RAD.of({ reach, reach_method: reachInfo.method, domain,
  services: [...(base.services || []), ...((sdP.products_or_services) || [])], site_topics: [head, ...(base.secondary_keywords || []).slice(0, 8)],
  pages: invPages.map(p => ({ url: p.url, title: p.title || '' })),
  topics: [{ topic: top.topic || head, primary_keyword: head, kd: top.kd, volume: top.volume, keyword_count: 1 + (top.supporting || []).length, your_position: top.your_position, keywords: (top.supporting || []).map(k => ({ keyword: k })) },
    ...rungPages.map(p => ({ topic: p.topic || p.keyword, primary_keyword: p.keyword, kd: p.kd, volume: p.total_volume, keyword_count: (p.keywords || []).length, your_position: p.your_position, keywords: p.keywords }))] });
const head_radius = RAD.pick(topic_radius, head);
const notes = [];
if (refusal) notes.push(refusal.message);
// B2-1 / B2-2: which reach this plan was measured against, and what the site already has on the topic — both in the owner's reading
notes.push(topic_authority.note);
if (planned) notes.push(topic_authority.coverage.summary);
if (planned) for (const f of folded) notes.push(f.note + '.');   // R34
// B2-4: what Google itself said about which of these searches want the same page, what it cost, and what could not be compared
if (SERP_CL && SERP_CL.note) notes.push(SERP_CL.note
  + (planned && clusterRungs.length ? ' In this plan ' + clusterRungs.length + ' group(s) became one page each instead of several: '
    + clusterRungs.slice(0, 4).map(c => '"' + c.head_keyword + '" (+' + Math.max(0, c.keywords.length - 1) + ')').join(', ') + '.' : ''));
// B2-5: the destination's results page, and the stated effect on the score
if (serp_diversity.checked) notes.push(serp_diversity.text);
if (head_radius) notes.push('Topic radius — "' + head_radius.topic + '": ' + RAD.line(head_radius) + '.');
if (poolRefused.length) notes.push(poolRefused.length + ' keyword(s) were left out of the ladder because they are other companies\' brands, government or portal searches, or navigational: ' + poolRefused.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason + ')').join(', ') + (poolRefused.length > 6 ? ' …' : '') + '.');
if (planned && plan_type === 'full' && rungPages.length && pages_total < 8) notes.push('Only ' + pages_total + ' pages could be planned from the data: the topic is narrow in ' + base.country + '. The ladder is shorter but still valid.');
if (planned && plan_type === 'full' && rungPages.length) for (const r of rungs) if (!r.pages.length) notes.push('No keywords fell into rung ' + r.rung + '; the ladder skips it.');
if (planned && plan_type === 'direct' && rungPages.length < 2) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned around the main keyword; add more as the site grows.');
if (planned && plan_type !== 'direct' && !rungPages.length) notes.push('No supporting keywords were found for "' + head + '" in ' + base.country + ' (the topic is narrow in the search data), so the main page is the whole ladder for now and is written first. Supporting pages can be added as the site grows.');
else if (planned && plan_type === 'short' && rungPages.length < 3) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned before the main page.');
if (offTopic.length) notes.push(offTopic.length + ' keyword(s) were left out because they are not on this ladder\'s topic ("' + head + '"): ' + offTopic.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason.replace(/^it is not on this ladder's topic: /, '') + ')').join(', ') + (offTopic.length > 6 ? ' …' : '') + '.');
if (excluded.length) notes.push(excluded.length + ' keyword(s) already belong to other ladders of this site and were left out (one search, one page): ' + excluded.slice(0, 6).map(x => '"' + x.keyword + '" (ladder "' + x.head + '")').join(', ') + (excluded.length > 6 ? ' …' : '') + '.');
// F-A1: one keyword, one page; the limits; and the keywords whose results pages sell what this business does not
if (planned && (one_page.moved.length || one_page.left_out.length)) notes.push('One keyword, one page: '
  + [...one_page.moved.map(m => '"' + m.keyword + '" moved from its ' + m.from + ' to ' + m.to + ' (' + m.why + ')'),
     ...one_page.left_out.slice(0, 8).map(m => '"' + m.keyword + '" is not a supporting keyword of the ' + (m.page === 'main page' ? 'main page' : 'page "' + m.page + '"') + ': ' + m.why)].join('; ')
  + (one_page.left_out.length > 8 ? ' …' : '') + '.');
if (planned && top.supporting && top.supporting.length) notes.push('The main page\'s supporting keywords are grouped by ' + top.grouped_by + ': ' + top.supporting_basis.map(k => '"' + k.keyword + '"' + (k.shared_urls != null ? ' (' + k.shared_urls + ' of ' + k.of + ')' : ' (not compared)')).join(', ') + '.');
for (const r of rungs) for (const pg of (r.pages || [])) if (pg.page_type_note) notes.push(pg.page_type_note + '.');
if (notSold.length) notes.push(notSold.length + ' keyword(s) were left out because the pages Google ranks for them offer something this business does not: ' + notSold.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason.replace(/\.$/, '') + ')').join(', ') + (notSold.length > 6 ? ' …' : '') + '.');
if (planned) notes.push(limits.text);
if (headTakenAsPage) notes.push('The main keyword is also planned as a page of the ladder "' + headTakenAsPage.head + '" (' + headTakenAsPage.ladder_id + '): publish only one page for it.');
if (plan.stretch && planned) notes.push('Very hard for this site today: consider one of the alternatives first (' + alternatives.join(', ') + ').');
const order_text = !planned ? 'no pages' : plan_type === 'direct' ? 'main page first, then the supporting pages that link to it' : !rungPages.length ? 'the main page only for now (no supporting keywords in the data), written first' : plan_type === 'short' ? 'supporting pages first, then the main page once half of them are live' : 'rung by rung from the easiest pages, the main page last';
const ladder = { ladder_id: ladderId, head: { keyword: head, volume: top.volume, kd: top.kd, cpc: top.cpc, intent: top.intent, your_position: top.your_position },
  domain, country: base.country, goal: base.goal || 'leads', feasibility, rungs, top, folded, link_map, timeline, write_now, pages_now: pagesNow,
  later: later.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, ...(k.held_back ? { held_back: true } : {}) })), requirements, stats, notes,
  plan_type, difficulty_for_you, reach, months: planned ? plan.months : '', months_range: planned ? plan.months_range : null, stretch: planned && plan.stretch, planned, refusal, order: order_text,
  label: planned ? reachLabel(difficulty_for_you, plan) : dataRefused ? ('No ladder planned · ' + refusal.short) : (REACH_DIFF_LABEL[difficulty_for_you] + ' · no ladder'),
  chance: planned ? plan.chance : null, chance_text: planned ? reachChanceText(plan) : '', base_rate: REACH_BASE_RATE, refused_keywords: poolRefused.slice(0, 40),
  reach_info: { reach: reachInfo.reach, method: reachInfo.method, p75: reachInfo.p75 ?? null, size_reach: reachInfo.size_reach ?? null, sample: reachInfo.sample ?? null, top10: reachInfo.top10 ?? null, organic_keywords: reachInfo.organic_keywords ?? null, cached: !!reachInfo.cached, cached_at: reachInfo.cached_at || null },   // B2-1: the SITE-wide measurement; `reach` above is what this topic was measured against
  pile_up,   // R42
  limits, held, one_page, not_sold_keywords: notSold.slice(0, 20),   // F-A1 A-12 / A-8 / A-11
  topic_authority,   // B2-1: what this site already wins on THIS topic, what it already has written about it, and which reach the plan used
  serp_clusters: SERP_CL,   // B2-4: the results pages this run read, the groups they made, what could not be compared and what it cost
  serp_cluster_rungs: clusterRungs.slice(0, 12), serp_diversity,   // B2-5: how many different sites own the destination's results page, and the stated adjustment
  excluded_keywords: excluded.slice(0, 40), topic_radius, head_radius, off_topic_keywords: offTopic.slice(0, 20),   // R23: what the topic radius left out, with the reason   // G32: shown with the plan, never enforced on it
  words: { main: top.target_words || 0, rung: rungWords.words, main_source: top.target_words_source, rung_source: rungWords.source },   // R22: where each page's length target came from
  data_check: { pool_size: poolSize, minimum_pool: LADDER_MIN_POOL, head_measured: headMeasured, serp_checked: !serpOut, serp_error: serpOut, enough: !dataRefused },   // R23
  tracker: { cadence: base.tracker_cadence || 'weekly', auto_next_rung: !!base.auto_next_rung, stop_rule: 'once the top rung holds the top 3 for 4 checks it is checked monthly (with the published pages)' }, created_at: new Date().toISOString() };
return [{ json: { ...base, ladder, site_rankings: pool.site_rankings || null, reach_cache_row } }];
