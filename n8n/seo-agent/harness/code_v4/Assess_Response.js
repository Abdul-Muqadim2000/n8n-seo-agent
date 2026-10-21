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
const REACH_TOPIC_CFG = { max_examples: 6, max_other: 4, min_sample: REACH_CFG.min_top10, max_position: 20 };
// the default on-topic test: half of the head's meaningful words (the shape `_radius.js` RAD.headFit uses; the ladder passes that kit in)
const reachTopicMatch = (head) => { const h = overlapTokens(head); const need = Math.max(1, Math.ceil(h.length / 2));
  return (kw) => { if (!h.length) return false; const t = overlapTokens(kw); return t.filter(x => h.includes(x)).length >= need; }; };
// ---- K1 (2026-10-21, KW-MATCH): the topic sample also comes from the site's OWN readings ----
// On 2026-10-17 and again on 2026-10-21 (r04, "ai consultant") every plan was measured against one site-wide reach of 10 ("method size,
// sample 0"): the ranked-keyword pull holds nothing for a small site, so reachTopic never had evidence. The site's own Search Console
// queries (seo_pages, position <= 20) and the rank tracker's readings are that evidence, free. A caller passes them as `gsc` / `tracked`
// with `kdOf(keyword)` (the difficulty the run already holds for that keyword); a row counts for this topic when it carries the topic's
// distinctive words (generic and place words left out), and only rows with a known difficulty enter the sample. Below
// REACH_TOPIC_CFG.min_sample the site-wide reach stays and the note says so, with the sample size.
const REACH_TOPIC_GENERIC = new Set(['consulting', 'consultant', 'consultancy', 'service', 'services', 'company', 'companies', 'agency', 'firm', 'provider', 'providers', 'solution', 'solutions',
  'expert', 'experts', 'specialist', 'partner', 'partners', 'best', 'top', 'near', 'me', 'cost', 'price', 'pricing', 'uae', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'gcc', 'emirates',
  'saudi', 'arabia', 'ksa', 'riyadh', 'qatar', 'doha', 'oman', 'bahrain', 'kuwait', 'middle', 'east']);
const reachTopicCore = (head) => overlapTokens(String(head || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => !REACH_TOPIC_GENERIC.has(t)).join(' '));
const reachTopicDistinct = (head) => { const h = reachTopicCore(head); const need = h.length <= 2 ? h.length : Math.ceil(h.length * 0.6);
  return (kw) => { if (!h.length) return false; const t = overlapTokens(kw); return t.filter(x => h.includes(x)).length >= need; }; };
function reachTopicOwn(head, o, site, who) {
  const opts = o || {}; const min = Number(opts.min_sample) > 0 ? Number(opts.min_sample) : REACH_TOPIC_CFG.min_sample;
  const on = reachTopicDistinct(head); const kdOf = typeof opts.kdOf === 'function' ? opts.kdOf : () => null;
  const rows = new Map();
  const add = (kw, position, kd, source) => { const k = String(kw || '').toLowerCase().trim(); const p = reachNum(position); if (!k || p == null || p < 1 || p > REACH_TOPIC_CFG.max_position || (source !== 'ranked' && !on(k))) return;
    const d = reachNum(kd) != null ? reachNum(kd) : reachNum(kdOf(k)); const old = rows.get(k);
    if (!old || p < old.position) rows.set(k, { keyword: k, position: Math.round(p * 10) / 10, kd: d != null ? d : (old ? old.kd : null), source }); else if (old.kd == null && d != null) old.kd = d; };
  for (const r of (opts.ranked_on || [])) add(r.keyword, r.position, r.kd, 'ranked');
  for (const r of (Array.isArray(opts.gsc) ? opts.gsc : [])) add(r && (r.query || r.keyword), r && r.position, r && r.kd, 'search_console');
  for (const r of (Array.isArray(opts.tracked) ? opts.tracked : [])) add(r && r.keyword, r && r.position, r && r.kd, 'rank_tracker');
  const all = [...rows.values()]; const known = all.filter(r => r.kd != null);
  const kds = known.map(r => r.kd).sort((a, b) => a - b);
  let p75 = null;
  if (kds.length >= min) { const i = REACH_CFG.percentile * (kds.length - 1), lo = Math.floor(i), hi = Math.ceil(i); p75 = Math.round(kds[lo] + (kds[hi] - kds[lo]) * (i - lo)); }
  const by = (s) => known.filter(r => r.source === s).length;
  const sources = { search_console: by('search_console'), rank_tracker: by('rank_tracker'), ranked: by('ranked') };
  const parts = [[sources.search_console, 'from Search Console'], [sources.rank_tracker, 'from the rank tracker'], [sources.ranked, 'from the ranking data']].filter(x => x[0]).map(x => x[0] + ' ' + x[1]);
  const q = '"' + String(head || '') + '"';
  const sample_text = known.length + ' of your searches about ' + q + ' rank in the top ' + REACH_TOPIC_CFG.max_position + ' with a known difficulty' + (parts.length ? ' (' + parts.join(', ') + ')' : '')
    + (all.length > known.length ? '; ' + (all.length - known.length) + ' more rank there with no difficulty on file' : '');
  const used = p75 != null;
  const note = used
    ? 'Measured on this topic: ' + sample_text + ', and 75% of them have a difficulty of ' + p75 + ' or lower, so this plan is measured against ' + p75 + ' and not against the site-wide reach of ' + site + '.'
    : 'This plan is measured against your site-wide reach (' + site + '), because only ' + sample_text + ', and at least ' + min + ' are needed to measure a reach on one topic. Treat the months and the chance below as the optimistic case.';
  return { used, p75, sample: known.length, min_sample: min, sources, rows: all.sort((a, b) => a.position - b.position).slice(0, REACH_TOPIC_CFG.max_examples), sample_text, note };
}
/**
 * ranked: [{ keyword, kd, position }] — every keyword the site ranks for that this run saw (null = the pull failed)
 * head: the topic's head keyword · domainReach: the site-wide reach · o: { match (the on-topic test), domain, reason_missing,
 *   gsc: [{ query, position }] / tracked: [{ keyword, position }] (K1: the site's own readings, top 20), kdOf(keyword) -> kd | null, min_sample }
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
  const out = { used, reach: used ? p75 : site, topic_reach: p75, site_reach: site, on_topic: on.length, top10: top10.length, sample: kds.length,
    best: best ? { keyword: String(best.keyword), position: pos(best) } : null, examples, other_topics, reason, note, head: String(head || ''),
    method: used ? 'topic' : 'site', min_sample: REACH_TOPIC_CFG.min_sample, sample_text: kds.length + ' of your top-10 keywords about ' + q + ' with a known difficulty' };
  // K1: with the site's own readings (Search Console / rank tracker) the sample is read from them too, and printed
  if (!Array.isArray(opts.gsc) && !Array.isArray(opts.tracked)) return out;
  const own = reachTopicOwn(head, { ...opts, ranked_on: top10 }, site, who);
  return { ...out, used: own.used, reach: own.used ? own.p75 : site, topic_reach: own.p75, sample: own.sample, min_sample: own.min_sample, sources: own.sources,
    own_rows: own.rows, sample_text: own.sample_text, method: own.used ? 'topic' : 'site', note: own.note,
    reason: own.used ? out.reason : 'only ' + own.sample_text + ' (at least ' + own.min_sample + ' are needed)' };
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
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal',
  // KW-GATE (2026-10-21): regions and the markets e-invoicing and ERP searches name ("e invoicing europe", "belgium", "bpo company in middle east")
  'middle', 'east', 'mena', 'emea', 'apac', 'europe', 'european', 'eu', 'africa', 'asia', 'belgium', 'germany', 'france', 'netherlands', 'italy', 'spain', 'portugal', 'poland', 'austria',
  'switzerland', 'ireland', 'luxembourg', 'denmark', 'sweden', 'norway', 'finland', 'greece', 'singapore', 'malaysia', 'australia', 'zealand', 'canada', 'japan', 'china', 'turkey', 'jordan', 'lebanon',
  'morocco', 'nigeria', 'kenya', 'london', 'england', 'britain', 'america', 'states', 'united', 'world', 'worldwide', 'global']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
// KW-GATE (2026-10-21): other countries' tax and identity bodies too ("hmrc vat login" was a plain portal refusal, not a government one)
const FIT_GOV_NAMES = /\b(hmrc|irs|cra|ato|finanzamt|elster|agenzia entrate|belastingdienst|skatteverket|spf finances|dgfip|impots\.gouv|fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
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
const FIT_COURSE_ONLY = /\b(courses?|bootcamps?|diploma|degree|syllabus|exam|exams|dumps|study material)\b/;
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
// ---- KW-GATE (2026-10-21, keyword accuracy set: in recall 54%): Arabic keywords are READ, not guessed ----
// Every Arabic keyword was "0% of its own words match" (the topics are English), so "استشارات الذكاء الاصطناعي في دبي" (AI consulting in Dubai)
// was refused as off topic and "وظائف الذكاء الاصطناعي في دبي" (AI jobs in Dubai) was refused for the wrong reason. The keyword is normalised
// (alef forms, ta marbuta, alef maqsura, hamza seats, diacritics, tatweel, Arabic digits), split, its article / prefixes taken off, and the
// common search words are mapped to the English words the rules below already judge, through a small glossary (phrases first). No
// machine translation call. A word the glossary does not know stays as it is (fitTopic treats it as unread, not as evidence either way).
const FIT_AR = /[؀-ۿ]/;
const FIT_AR_PHRASES_SRC = [['ذكاء اصطناعي', 'ai'], ['فاتوره الكترونيه', 'e invoicing'], ['فواتير الكترونيه', 'e invoicing'], ['فوتره الكترونيه', 'e invoicing'],
  ['فوتره', 'invoicing'], ['ضريبه قيمه مضافه', 'vat'], ['قيمه مضافه', 'vat'], ['تخطيط موارد موسسات', 'erp'], ['تخطيط موارد', 'erp'], ['موارد بشريه', 'hr'],
  ['اداره علاقات عملاء', 'crm'], ['علاقات عملاء', 'crm'], ['هويه اماراتيه', 'emirates id'], ['بطاقه هويه', 'id card'], ['وزاره خارجيه', 'ministry of foreign affairs'],
  ['هيئه اتحاديه للضرائب', 'fta'], ['هيئه اتحاديه ضرائب', 'fta'], ['تعلم اله', 'machine learning'], ['ابو ظبي', 'abu dhabi'], ['راس خيمه', 'ras al khaimah'],
  ['خدمه عملاء', 'customer service'], ['تسجيل دخول', 'login'], ['سيره ذاتيه', 'cv'], ['عن بعد', 'remote']];
const FIT_AR_WORDS_SRC = { 'استشارات': 'consulting', 'استشاره': 'consulting', 'استشاري': 'consulting', 'استشاريه': 'consulting', 'مستشار': 'consultant', 'مستشارين': 'consultants', 'مستشارون': 'consultants',
  'شركه': 'company', 'شركات': 'companies', 'مكتب': 'firm', 'برنامج': 'software', 'برامج': 'software', 'نظام': 'system', 'انظمه': 'systems', 'حلول': 'solutions', 'خدمات': 'services',
  'خدمه': 'service', 'تطبيق': 'app', 'تطبيقات': 'apps', 'منصه': 'platform', 'اتمته': 'automation', 'ذكاء': 'intelligence', 'اصطناعي': 'artificial', 'فاتوره': 'invoice', 'فواتير': 'invoices',
  'الكترونيه': 'electronic', 'الكتروني': 'electronic', 'ضريبه': 'tax', 'ضرائب': 'tax', 'ضريبي': 'tax', 'محاسبه': 'accounting', 'محاسبي': 'accounting', 'محاسب': 'accountant', 'محاسبين': 'accountants',
  'راتب': 'salary', 'رواتب': 'salary', 'وظائف': 'jobs', 'وظيفه': 'job', 'توظيف': 'recruitment', 'دوره': 'course', 'دورات': 'courses', 'تدريب': 'training', 'شهاده': 'certificate', 'شهادات': 'certificates',
  'تصديق': 'attestation', 'توثيق': 'attestation', 'تجديد': 'renewal', 'هويه': 'id', 'تاشيره': 'visa', 'اقامه': 'residency', 'جواز': 'passport', 'حكومه': 'government', 'حكومي': 'government',
  'حكوميه': 'government', 'وزاره': 'ministry', 'هيئه': 'authority', 'بوابه': 'portal', 'تسجيل': 'registration', 'دخول': 'login', 'سعر': 'price', 'اسعار': 'prices', 'تكلفه': 'cost', 'افضل': 'best',
  'اكبر': 'top', 'مايكروسوفت': 'microsoft', 'دايناميكس': 'dynamics', 'داينامكس': 'dynamics', 'ديناميكس': 'dynamics', 'كوبايلوت': 'copilot', 'سيلزفورس': 'salesforce', 'ساب': 'sap',
  'اوراكل': 'oracle', 'نتسويت': 'netsuite', 'اودو': 'odoo', 'دبي': 'dubai', 'امارات': 'uae', 'اماراتي': 'uae', 'اماراتيه': 'uae', 'ابوظبي': 'abu dhabi', 'شارقه': 'sharjah', 'عجمان': 'ajman',
  'سعوديه': 'saudi', 'رياض': 'riyadh', 'جده': 'jeddah', 'قطر': 'qatar', 'دوحه': 'doha', 'مصر': 'egypt', 'كويت': 'kuwait', 'بحرين': 'bahrain', 'عمان': 'oman', 'خليج': 'gcc',
  'كيف': 'how to', 'ماهي': 'what is', 'ماهو': 'what is', 'ما': 'what', 'هو': '', 'هي': '', 'في': '', 'من': '', 'على': '', 'الى': '', 'عن': '', 'مع': 'with', 'او': '', 'و': '',
  'مبيعات': 'sales', 'بيع': 'sales', 'ماليه': 'finance', 'مالي': 'finance', 'اعمال': 'business', 'سحابه': 'cloud', 'سحابي': 'cloud', 'بيانات': 'data', 'امن': 'security', 'سيبراني': 'cyber',
  'تسويق': 'marketing', 'موقع': 'website', 'عقارات': 'real estate', 'تصنيع': 'manufacturing', 'مخزون': 'inventory', 'تنفيذ': 'implementation', 'شريك': 'partner', 'شركاء': 'partners',
  'مرخص': 'certified', 'معتمد': 'certified', 'معتمده': 'certified', 'متطلبات': 'requirements', 'دليل': 'guide', 'مقارنه': 'comparison', 'مجاني': 'free', 'تحميل': 'download' };
const fitArNorm = (s) => String(s || '').normalize('NFKC').replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ـ/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
// the glossary in the same normal form as the keyword (so "وظائف" and "وظايف", "شركة" and "شركه" are one word)
const FIT_AR_WORDS = Object.fromEntries(Object.entries(FIT_AR_WORDS_SRC).map(([k, v]) => [fitArNorm(k), v]));
const FIT_AR_PHRASES = FIT_AR_PHRASES_SRC.map(([k, v]) => [fitArNorm(k), v]);
// the article and the one-letter prefixes glued to it ("الامارات", "بالامارات", "للشركات"); a word of 3 letters or less is never cut
const fitArStem = (w) => { if (FIT_AR_WORDS[w] !== undefined) return w; const m = w.match(/^(?:وال|بال|كال|فال|لل|ال)(.{2,})$/); if (m && m[1].length >= 2) return m[1];
  const v = w.match(/^و(.{3,})$/); return v && FIT_AR_WORDS[v[1]] !== undefined ? v[1] : w; };
// "استشارات الذكاء الاصطناعي في دبي" -> { text: "consulting ai dubai", read: true, unread: [] }; an English keyword comes back unchanged
const fitArabic = (s) => {
  const raw = String(s || '');
  if (!FIT_AR.test(raw)) return { text: raw, read: false, unread: [] };
  const toks = fitArNorm(raw).split(/[^\p{L}\p{M}\p{N}.&]+/u).filter(Boolean).map(t => FIT_AR.test(t) ? fitArStem(t) : t.toLowerCase());
  const out = [], unread = [];
  for (let i = 0; i < toks.length;) {
    let hit = null;
    for (const [p, en] of FIT_AR_PHRASES) { const pw = p.split(' '); if (pw.length > 1 && pw.every((w, j) => toks[i + j] === w)) { hit = [pw.length, en]; break; } }
    if (hit) { out.push(hit[1]); i += hit[0]; continue; }
    const t = toks[i++];
    if (!FIT_AR.test(t)) { out.push(t); continue; }
    const one = FIT_AR_PHRASES.find(([p]) => p === t);
    if (one) { out.push(one[1]); continue; }
    if (FIT_AR_WORDS[t] !== undefined) { if (FIT_AR_WORDS[t]) out.push(FIT_AR_WORDS[t]); continue; }
    out.push(t); unread.push(t);
  }
  return { text: out.join(' ').replace(/\s+/g, ' ').trim(), read: true, unread };
};
// ---- KW-GATE: what the client DECLARED it sells, widened by a small category tree, and the products of OTHER vendors ----
// A category search of what the client sells is in topic ("erp software uae" for a Business Central partner, "peppol uae" for an e-invoicing
// firm, "vat registration uae" next to e-invoicing compliance, "it company dubai" for an IT firm). A family is declared only by the client's
// own words (ctx.services / ctx.protect: services, business line, chosen keywords), never by a crawl or the research pool. `anchors` are product
// categories that count as matched words of the keyword; `words` join the topic words; `wide` are two-letter categories ("ai", "it") that
// count only with a word naming a seller ("best ai companies uae", "ai firm dubai"), so "ai online", "ai uae" and "best ai apps" stay too broad.
const FIT_FAMILIES = [
  { re: /\b(erp|erps|enterprise resource planning|business central|dynamics 365 (finance|f ?& ?o|supply chain)|finance and operations|netsuite|sap|odoo|acumatica|epicor|sage (x3|intacct|200)|oracle (fusion|cloud erp|epm|erp))\b/, anchors: ['erp', 'erps'], words: ['erp'] },
  { re: /\b(e ?-?invoic\w*|einvoic\w*|electronic invoic\w*|peppol|fatoora)\b/, anchors: ['invoicing', 'invoice', 'invoices', 'einvoicing'], words: ['peppol', 'pint', 'fatoora', 'invoicing', 'einvoicing'], svc: ['vat'] },
  { re: /\b(crm|dynamics 365 (sales|customer service|marketing)|customer engagement|salesforce|hubspot)\b/, anchors: ['crm'], words: ['crm'] },
  { re: /\b(vat|value added tax|tax (registration|consultan\w*|advis\w*|filing|compliance))\b/, anchors: ['vat'], words: [] },
  { re: /\b(ai|artificial intelligence|machine learning|copilot|genai|generative ai)\b/, anchors: [], words: [], wide: ['ai'] },   // no extra topic words: "generative ai" and "ai agent" stay as wide as "ai" (R13)
  { re: /\b(it (services|support|solutions|consulting|company|outsourcing|infrastructure)|managed it|information technology)\b/, anchors: [], words: [], wide: ['it'] }];
const FIT_TAX_SERVICE = /\b(registration|register|registering|deregistration|filing|returns?|compliance|compliant|consultants?|consultancy|consulting|advisors?|advisory|agents?|services?|refunds?|audit|auditing)\b/;
const FIT_SELLER = /\b(company|companies|firm|firms|agency|agencies|provider|providers|consultants?|consultancy|consultancies|consulting|services|service|partners?|vendors?|specialists?|experts?|solutions|integrators?)\b/;
const FIT_REAL_GEO = (t) => FIT_GEO.has(t) && t !== 'online' && t !== 'portal';
// the declared side, once per context: { text, toks: Set, anchors: Set, words: Set (stemmed), wide: Set }
const fitDeclared = (ctx) => {
  const o = ctx || {};
  const src = [...(Array.isArray(o.services) ? o.services : [o.services]), ...(o.protect || []), ...(o.brand_names || [])].filter(Boolean).map(x => fitLow(x)).join(' | ');
  const d = { text: src, toks: new Set(src.split(FIT_SPLIT_WORDS).filter(Boolean)), anchors: new Set(), words: new Set(), wide: new Set() };
  d.svc = new Set();
  for (const f of FIT_FAMILIES) if (f.re.test(src)) { f.anchors.forEach(a => d.anchors.add(a)); f.words.forEach(w => d.words.add(fitStem(w))); (f.wide || []).forEach(w => d.wide.add(w)); (f.svc || []).forEach(w => d.svc.add(w)); }
  // a product category the client named in a service ("CRM implementation", "Payroll outsourcing") is an anchor too (F-REH's rule, for every caller)
  for (const t of d.toks) if (FIT_SERVICE_CATS_K.has(t)) d.anchors.add(t);
  // what makes a vendor the client's own: everything the client told us, the topics included (some callers pass services only as topics)
  const topicsTxt = (Array.isArray(o.topics) ? o.topics : [o.topics]).filter(Boolean).map(x => fitLow(x)).join(' | ');
  d.vtext = src + ' | ' + topicsTxt; d.vtoks = new Set(d.vtext.split(FIT_SPLIT_WORDS).filter(Boolean));
  return d;
};
const FIT_SERVICE_CATS_K = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
// Another company's PRODUCT or firm. Refused as 'other brand' unless the client declared it (its services, business line, chosen keywords or
// domain name it), or the keyword compares it ("dynamics 365 vs sap business one"). A partner word does not make SAP the client's: "sap
// implementation dubai" is a page for SAP's partners, not for a Dynamics 365 partner.
const FIT_VENDORS = [['SAP', ['sap', 's4hana']], ['Oracle NetSuite', ['netsuite'], ['oracle']], ['Oracle', ['oracle'], ['netsuite']], ['Odoo', ['odoo']], ['Sage', ['sage']], ['Acumatica', ['acumatica']],
  ['Epicor', ['epicor']], ['Infor', ['infor']], ['Syspro', ['syspro']], ['QuickBooks', ['quickbooks']], ['Xero', ['xero']], ['Tally', ['tally']], ['Zoho', ['zoho']], ['FreshBooks', ['freshbooks']],
  ['Microsoft Dynamics 365', ['dynamics', 'navision', 'axapta'], ['microsoft', 'business central']], ['Business Central', ['business central'], ['dynamics', 'microsoft']], ['Microsoft Copilot', ['copilot'], ['microsoft']],
  ['Salesforce', ['salesforce']], ['HubSpot', ['hubspot']], ['Pipedrive', ['pipedrive']], ['Freshworks', ['freshworks', 'freshsales']], ['Zendesk', ['zendesk']], ['ServiceNow', ['servicenow']], ['Workday', ['workday']],
  ['Storecove', ['storecove']], ['Pagero', ['pagero']], ['Avalara', ['avalara']], ['Sovos', ['sovos']], ['ClearTax', ['cleartax']], ['Edicom', ['edicom']], ['Tungsten', ['tungsten']], ['Basware', ['basware']],
  ['Comarch', ['comarch']], ['Banqup', ['banqup']], ['Unifiedpost', ['unifiedpost']], ['Tradeshift', ['tradeshift']], ['Coupa', ['coupa']],
  ['Capgemini', ['capgemini']], ['Deloitte', ['deloitte']], ['Accenture', ['accenture']], ['KPMG', ['kpmg']], ['PwC', ['pwc']], ['McKinsey', ['mckinsey']], ['IBM', ['ibm']], ['Infosys', ['infosys']],
  ['TCS', ['tcs']], ['Wipro', ['wipro']], ['Cognizant', ['cognizant']],
  ['OpenAI', ['openai', 'chatgpt']], ['Google Gemini', ['gemini']], ['Perplexity', ['perplexity']], ['Meta', ['meta']], ['Anthropic', ['anthropic', 'claude']], ['DeepSeek', ['deepseek']], ['Mistral', ['mistral']],
  ['Midjourney', ['midjourney']], ['Jasper', ['jasper']]];
// the first vendor the keyword names that the client did not declare: { name, word } or null
const fitVendor = (toks, decl, ownLabels) => {
  const line = ' ' + toks.join(' ') + ' ';
  const said = (w) => w.indexOf(' ') > 0 ? line.includes(' ' + w + ' ') : toks.includes(w);
  const declared = (w) => w.indexOf(' ') > 0 ? (' ' + String(decl.vtext || decl.text).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ').includes(' ' + w + ' ') : ((decl.vtoks || decl.toks).has(w) || (ownLabels || []).includes(w));
  for (const [name, words, also] of FIT_VENDORS) {
    const w = words.find(said); if (!w) continue;
    if ([...words, ...(also || [])].some(declared)) continue;
    return { name, word: w };
  }
  return null;
};
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
// E-GATE (2026-10-21, pre-launch run D4): the topic words drop every word of two letters (below), so "ai" is never one of them, and a client
// whose first declared service is "AI consulting" was told "ai consulting services uae", "ai consulting dubai" and "best ai consulting firms
// dubai" were "too broad" (only category or place words, none of them the site's). Making "ai" a topic word on its own is not the fix: it is a
// category word (R13), and with it every "ai" + category or place search of an AI-selling site passed ("ai online", "ai in cloud", "best ai
// apps", harness S103). The short word counts through the client's own phrase instead (fitCarriedName below): a keyword made only of category
// and place words that carries the WHOLE of a short topic phrase (a service the client named, a keyword they chose: "AI consulting", "Power
// BI", "HR software") names that service. Two-letter words count there because fitTokens keeps them.
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).normalize('NFKC').toLowerCase()
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// E-GATE (D4): words a buyer adds to any service search ("ai consulting cost uae", "best ai consulting firm dubai"). They say how the person
// buys, not what they buy, so they are neutral like a place: "ai consulting cost uae" was refused as off topic on the word "cost" alone.
const FIT_BUYER = new Set(['cost', 'costs', 'price', 'prices', 'pricing', 'fee', 'fees', 'quote', 'quotes', 'cheap', 'cheapest', 'affordable', 'firm', 'near', 'nearby']);
const fitAnd = (a) => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
// the short topic phrase (2 to 6 words, never prose) whose every word the keyword carries ("consultants" carries "consulting": the same stem rule as fitTopic)
const fitCarriedName = (toks, topics) => { const ks = toks.filter(t => !FIT_GEO.has(t)).map(fitStem);
  const hit = (x) => { const s = fitStem(x); return ks.some(k => k === s || (k.length >= 5 && s.length >= 5 && (k.indexOf(s) === 0 || s.indexOf(k) === 0))); };
  for (const t of (Array.isArray(topics) ? topics : [topics])) { const raw = String(t || '').replace(/\s+/g, ' ').trim(); if (!raw) continue;
    const w = fitTokens(raw).filter(x => !FIT_GEO.has(x) && !/^\d+$/.test(x));
    if (w.length < 2 || w.length > 6) continue;
    if (w.every(hit)) return raw; }
  return ''; };
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
  // KW-GATE (2026-10-21): an Arabic keyword is judged on its English reading; a "number 1" claim says nothing about the subject
  const AR = fitArabic(keyword);
  const toks = fitTokens(AR.text.replace(/(^|\s)(no\.? ?1|number (one|1)|#1)(?=\s|$)/gi, ' '));
  const decl = o._decl || fitDeclared(o);
  for (const w of decl.words) T.add(w);
  const unread = new Set(AR.unread);
  let own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^[\d.]+$/.test(t));   // F-KW: a year or a number ("2026", "3.0") is neutral, like a place; E-GATE: so is a buyer's word (cost, firm)
  // KW-GATE: a product category the client declared (erp for a Business Central partner, vat and invoicing next to e-invoicing) is a matched word of the keyword
  // a neighbouring tax word ("vat" next to e-invoicing compliance) counts only when the keyword asks for a service done for the buyer:
  // "vat registration uae" is the client's work, "uae vat", "vat tax uae" and "online vat calculator" are not
  const svcAsk = FIT_TAX_SERVICE.test(' ' + toks.join(' ') + ' ');
  const anchors = [...new Set(toks.filter(t => decl.anchors.has(t) || (svcAsk && (decl.svc || new Set()).has(t))))];
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^\d+$/.test(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  // an Arabic word the glossary cannot read is neither evidence nor a refusal once another word of the keyword matched
  if (unread.size && own.some(t => !unread.has(t) && matchOwn(t))) own = own.filter(t => !unread.has(t));
  if (!own.length) {
    const cats = [...new Set(toks.filter(t => (FIT_GENERIC.has(t) && !FIT_WIDE.has(t) && matches(t)) || decl.anchors.has(t)))];   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(FIT_REAL_GEO);
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    // KW-GATE (review 13): "it company dubai" for an IT firm, "best ai companies uae" for an AI consultancy: a two-letter category the client
    // declared, with a word naming a seller. "ai", "ai uae", "ai online", "best ai apps" carry no seller and stay too broad.
    const wide = toks.filter(t => decl.wide.has(t));
    if (wide.length && FIT_SELLER.test(' ' + toks.join(' ') + ' ')) return { ok: true, reason: '', detail: 'a search for a provider of ' + wide[0].toUpperCase() + ', a category you sell', share: 1 };
    const carried = fitCarriedName(toks, topics);
    if (carried) return { ok: true, reason: '', detail: 'it names "' + carried + '", part of ' + label, share: 1 };
    // E-GATE (D4): the sentence names the words, not the keyword again (it read "... and the keywords you chose ("<the keyword itself>")")
    return { ok: false, reason: 'too broad', detail: (toks.length === 1 ? 'its one word, "' + toks[0] + '", is a category or a place' : 'it has only category or place words, ' + fitAnd(toks.map(t => '"' + t + '"'))) + ', so nothing in it points to ' + label, share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * (hits.length + anchors.length) / (own.length + anchors.length)) / 100;
  const readAs = AR.read ? ' (read as "' + AR.text + '")' : '';
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + readAs + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label + (anchors.length ? ' ("' + anchors.join('", "') + '" is a category you listed)' : ''), share };
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
  // KW-GATE: judged on the topics alone here (no declared-category anchors), so a keyword that passes only through a declared category says so (basis below)
  const t = T.size ? fitTopic(keyword, topics, { ...o, topic_min_words: 1, _decl: { ...fitDeclared(o), anchors: new Set(), svc: new Set() } }) : { ok: false, share: null, detail: '' };
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail, basis: 'topics' };
  if (anchors.length) {
    // the share again, with the declared category word counted as the keyword's own and as matched
    const toks = fitTokens(keyword);
    const own = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^\d+$/.test(x));
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
// ---- E-GATE (2026-10-21, pre-launch run RV-11): a search made by people looking for WORK or TRAINING, read from its results page ----
// The job-search rule (4b) reads the keyword's own words only, so it refused "ai consultant jobs" and "ai consultant salary" and let "ai
// consultant" through: research labelled it commercial, "buyers comparing providers", Easy, and it became the client's ladder head, while its
// results page was ae.indeed.com, usaii.org (a certification course) and upwork, and the questions people also ask were "What is AI
// consulting's salary?" and "How do I become an AI consultant?". fitCareer reads three kinds of evidence a caller may have:
//   pages   - the top results ({ domain, url, title } or domains): job boards, salary sites and course / certification sites, or a page whose
//             address or title is a job listing or a course;
//   paa     - the "people also ask" questions: pay, jobs, careers, becoming one, courses, certification;
//   related - the research pool: of the searches that contain all of this keyword's own words, the share that are about jobs, pay or courses.
// Points: 3+ such pages 1.5, 2 pages 1, 1 page 0.5; 2+ questions 1, one 0.5; related 40%+ of 4+ variants 1. A career search needs 1.5, so
// one kind of evidence alone is never enough unless the results page itself is mostly job and course pages. A keyword with a product or
// buyer word ("ai consulting services uae", "hire an ai consultant", "recruitment software") is never one. A site whose own short topics
// (a service name, a chosen keyword; never prose) are recruitment keeps its job searches, one that sells training keeps its course searches.
const FIT_JOB_HOSTS = /(^|\.)(naukrigulf|naukri|indeed|glassdoor|bayt|monster|monstergulf|foundit|gulftalent|ziprecruiter|jooble|careerjet|simplyhired|wellfound|laimoon|drjobpro|jobsdb|jobstreet|seek|reed|totaljobs|careerbuilder|dice|payscale|salary|salaryexplorer|ambitionbox|talent|adzuna|jobrapido|levels)\.[a-z.]+$/;
const FIT_COURSE_HOSTS = /(^|\.)(coursera|udemy|edx|simplilearn|udacity|usaii|iabac|greatlearning|mygreatlearning|upgrad|datacamp|skillshare|futurelearn|pluralsight|classcentral|emeritus|edureka|intellipaat|knowledgehut|careerfoundry|springboard|codecademy|alison)\.[a-z.]+$/;
const FIT_JOB_PATH = /\/(jobs?|careers?|vacanc[a-z]*|salar[a-z]*)(\/|$|-|\?)/i, FIT_COURSE_PATH = /\/(courses?|certifications?|learning)(\/|$|-|\?)/i;
const FIT_JOB_TITLE = /\b(jobs?|vacanc(y|ies)|hiring now|salar(y|ies))\b/i, FIT_COURSE_TITLE = /\b(courses?|certification|certificate program(me)?|program fee|bootcamp|diploma|degree)\b/i;
const FIT_JOB_Q = /\b(salary|salaries|earn|earns|earning|become|becoming|jobs?|careers?|qualifications?)\b/i, FIT_COURSE_Q = /\b(courses?|certifications?|degree|study)\b/i;
const FIT_JOB_KW = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|cv|resume|become|becoming)\b/, FIT_COURSE_KW = /\b(courses?|certifications?|degree|diploma)\b/;
const FIT_BUYER_KW = /\b(services?|company|companies|firms?|agency|agencies|provider|providers|vendor|vendors|partners?|hire|cost|costs|price|prices|pricing|quote|quotes|outsourc\w*)\b/;
// KW-GATE (review 8): what a recruitment or a training business calls what it sells. Read from the client's own short topics (service names,
// chosen keywords; never prose), so "Manpower supply", "Executive search", "Employment agency" keep job searches and "Power BI workshops",
// "Corporate learning programs", "Excel bootcamps" keep course searches. One definition for rule 4b and for fitCareer.
const FIT_SELLS_JOBS = /\b(recruit\w*|staffing|staff augmentation|hiring|headhunt\w*|talent (acquisition|search|solutions)|manpower|employment (agenc\w*|services?)|placements?|executive search|job (board|portal)s?|careers? (services?|coaching))\b/;
const FIT_SELLS_COURSES = /\b(train\w*|courses?|educat\w*|academ\w*|tutor\w*|learning|e-?learning|workshops?|bootcamps?|class(es)?|institutes?|institution|certification (training|courses?|programs?|preparation))\b/;
const fitSells = (topics) => { const short = (Array.isArray(topics) ? topics : [topics]).filter(t => t && fitTokens(t).length <= 6).map(fitLow).join(' | ');
  return { jobs: FIT_SELLS_JOBS.test(short), courses: FIT_SELLS_COURSES.test(short) }; };
// KW-GATE (review 6): a word the keyword itself carries is not evidence about the results page ("certification" in "iso 27001 certification
// dubai" is in every buyer's title too). The title / question is read without the keyword's own words.
const fitWithout = (text, toks) => { let t = ' ' + fitLow(text) + ' '; for (const w of toks) t = t.split(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')).join(' '); return t; };
function fitCareer(keyword, o) {
  o = o || {};
  const kw = fitLow(fitArabic(keyword).text).replace(/\s+/g, ' ').trim();
  const none = (why) => ({ career: false, points: 0, signals: [], detail: '', why });
  if (!kw) return none('no keyword');
  if (FIT_PRODUCT.test(' ' + kw + ' ') || FIT_BUYER_KW.test(' ' + kw + ' ')) return none('it carries a product or buyer word');
  const S = fitSells(o.topics);
  const sellsJobs = S.jobs, sellsCourses = S.courses;
  if (sellsJobs && sellsCourses) return none('this website sells recruitment and training');
  const kwToks = fitTokens(kw);
  const isJob = (p) => !sellsJobs && (FIT_JOB_HOSTS.test(p.domain) || FIT_JOB_PATH.test(p.path) || FIT_JOB_TITLE.test(fitWithout(p.title, kwToks)));
  const isCourse = (p) => !sellsCourses && (FIT_COURSE_HOSTS.test(p.domain) || FIT_COURSE_PATH.test(p.path) || FIT_COURSE_TITLE.test(fitWithout(p.title, kwToks)));
  const pages = (o.pages || []).map(p => typeof p === 'string' ? { domain: p, url: '', title: '' } : (p || {}))
    .map(p => ({ domain: fitHost(p.domain || p.url || ''), path: String(p.url || '').replace(/^https?:\/\/[^/]+/i, ''), title: String(p.title || '') })).filter(p => p.domain).slice(0, 10);
  const careerDom = [...new Set(pages.filter(p => isJob(p) || isCourse(p)).map(p => p.domain))];
  const qs = [...new Set((o.paa || []).map(q => String(q || '').trim()).filter(q => q && ((!sellsJobs && FIT_JOB_Q.test(fitWithout(q, kwToks))) || (!sellsCourses && FIT_COURSE_Q.test(fitWithout(q, kwToks))))))];
  const own = fitTokens(kw).filter(t => !FIT_GEO.has(t));
  const variants = [...new Set((o.related || []).map(r => fitLow(typeof r === 'string' ? r : (r || {}).keyword).replace(/\s+/g, ' ').trim()))]
    .filter(r => r && r !== kw && own.length && own.every(t => fitTokens(r).includes(t)));
  const careerVar = variants.filter(r => (!sellsJobs && FIT_JOB_KW.test(' ' + r + ' ')) || (!sellsCourses && FIT_COURSE_KW.test(' ' + r + ' ')));
  const pp = careerDom.length >= 3 ? 1.5 : careerDom.length === 2 ? 1 : careerDom.length === 1 ? 0.5 : 0;
  const qp = qs.length >= 2 ? 1 : qs.length === 1 ? 0.5 : 0;
  const rp = variants.length >= 4 && careerVar.length / variants.length >= 0.4 ? 1 : 0;
  const points = pp + qp + rp;
  const signals = [];
  if (careerDom.length) signals.push('job, salary or course pages rank for it (' + careerDom.slice(0, 4).join(', ') + ')');
  if (qs.length) signals.push('the questions people also ask are about pay, jobs or training ("' + qs[0].replace(/["\u201c\u201d]/g, '') + '")');
  if (rp) signals.push(careerVar.length + ' of the ' + variants.length + ' related searches are about jobs, pay or courses');
  if (points < 1.5) return { career: false, points, signals, detail: '', why: 'not enough evidence' };
  // KW-GATE (review 5): questions and related searches alone never make a career search: at least one job, salary or course page must rank for it
  if (!careerDom.length) return { career: false, points, signals, detail: '', why: 'no job, salary or course page ranks for it' };
  return { career: true, points, signals, why: '',
    detail: 'people searching it are mostly looking for work or training, not for a provider: ' + signals.join('; ') };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  // KW-GATE (2026-10-21): an Arabic keyword is judged on its English reading (fitArabic); the sentence says how it was read
  const AR = fitArabic(String(keyword || ''));
  const kw = AR.text.toLowerCase().replace(/\s+/g, ' ').trim();
  const res = (r) => (AR.read && r && r.ok === false && r.detail && !/read as "/.test(r.detail)) ? { ...r, detail: r.detail + ' (read as "' + AR.text + '")' } : r;
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const decl = fitDeclared(ctx);
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  const topicsOn = !!(ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim()));
  const sellsWhat = fitSells(ctx.topics || []);
  // 1. the website itself
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  // KW-GATE (2026-10-21): a label that is also a word of what the client declared is its TOPIC as well as its name: "peppol" for peppol.org
  //    (services "Peppol network", "Peppol access point certification") made "what is peppol", "peppol access point" and "peppol uae"
  //    navigational. Such a label is judged like any other topic word; a login, a job or a course search for it is still refused below.
  const ownLabels = fitOwnLabels(ctx.own_domain, toks, protect);
  for (const l of ownLabels) if ((toks.includes(l) || squashed.includes(l)) && !decl.toks.has(l)) {
    if (has(FIT_JOBS) && !sellsWhat.jobs) return { ok: false, reason: 'job search', detail: 'people looking for work at this company (' + l + '), not buyers of what it sells' };
    return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  }
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
  // KW-GATE (review 2): a results page full of government sites says the searcher may want the public body, unless the keyword carries what
  //    the client declared it sells: "vat registration uae" for a VAT consultancy (tax.gov.ae, u.ae, mof.gov.ae, ey, pwc) is its own service
  const declaredHere = () => topicsOn && (toks.some(t => decl.anchors.has(t)) || fitTopic(AR.read ? keyword : kw, ctx.topics, { ...ctx, topic_min_words: 1, _decl: decl }).ok);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold && !partnerWord && !declaredHere()) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = topicsOn ? fitTopicWords(ctx.topics) : null;
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
  //     (KW-GATE review 8: manpower, employment agencies, executive search and placements are recruitment too)
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sellsWhat.jobs && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return res({ ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' });
  //     KW-GATE: a person looking for a course for themselves ("netsuite certification course"), unless the client sells training
  if (has(FIT_COURSE_ONLY) && !has(FIT_PRODUCT) && !has(FIT_BUYER_KW) && !sellsWhat.courses) return res({ ok: false, reason: 'job search', detail: 'people looking for a course or a certificate for themselves, not buyers of what this website sells' });
  // 4c. the same, read from the keyword's results page when the caller has it (E-GATE RV-11: ctx.career = { pages, paa, related })
  if (ctx.career && typeof ctx.career === 'object') { const c = fitCareer(kw, { ...ctx.career, topics: ctx.career.topics || ctx.topics || [] }); if (c.career) return { ok: false, reason: 'job search', detail: c.detail, career: c }; }
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  // E-GATE (2026-10-21, pre-launch run RV-7): a learned name counts only through its DISTINCTIVE words. "Microsoft UAE" (seo_cache ai_brands:)
  // lost "microsoft" as a generic word and kept "uae", so every "... uae" keyword without a partner word ("ai for finance operations uae", "erp
  // software uae") was refused as "a brand of Microsoft UAE" in research, ladders, AI Growth and the pulse. Place, generic, category and common
  // words and numbers are never a brand's own part; a name with nothing else left is ignored here, so a stored bad name is harmless on read.
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !FIT_GEO.has(t) && !FIT_WIDE.has(t) && !FIT_CATEGORY.has(t) && !FIT_COMMON.has(t) && !FIT_BUYER.has(t)
      && !/^\d+$/.test(t) && !protect.includes(t));
    if (!nt.length || !nt.some(t => t.length >= 3) || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 5c. KW-GATE (review 3, 4, 14; moved here from the full report so every path decides the same): a company's own name in front of a colon
  //     ("ingoude: erp solutions dubai") or of a "number 1" claim ("ibt no 1 bpo company in middle east"). The name must be a word that is no
  //     category, place or topic word: "dynamics 365: business central pricing" and "no 1 erp company in uae" are searches for what the client sells.
  const nameWords = (s) => fitTokens(s).filter(t => !FIT_GENERIC.has(t) && !FIT_GEO.has(t) && !FIT_WIDE.has(t) && !FIT_BUYER.has(t) && !/^[\d.]+$/.test(t)
    && !decl.toks.has(t) && !protect.includes(t) && !(topicT && topicT.has(fitStem(t))));
  // only a short name (one or two words) of a keyword, never a question ("Odoo or Business Central: which ERP ...?" is a comparison)
  const colon = String(keyword || '').includes('?') ? null : kw.match(/^([\p{L}\p{N}&.' -]{2,24}):\s+\S/u);
  if (colon && fitTokens(colon[1]).length <= 2 && !compareWord && !/\bor\b/.test(colon[1]) && nameWords(colon[1]).length) return res({ ok: false, reason: 'other brand', detail: 'starts with a company\'s own name (' + nameWords(colon[1]).join(' ') + '), not a topic' });
  const claim = kw.match(/^(.*?)(?:^|\s)(no\.? ?1|number (?:one|1)|#1)(?=\s|$)/);
  if (claim && nameWords(claim[1]).length) return res({ ok: false, reason: 'other brand', detail: 'a company\'s own "number 1" claim (' + nameWords(claim[1]).join(' ') + '), not a topic' });
  // 5d. a list of companies in ANOTHER industry ("top facilities management companies uae"), judged even when few topic words are on file;
  //     category words are neutral ("best erp companies in dubai" is judged by the topic rule below)
  const list = kw.match(/^(?:top|best|leading|biggest|largest)\s+(?:\d+\s+)?(.+?)\s+(?:companies|firms|providers|agencies|suppliers|contractors)\b/);
  if (list && topicT && topicT.size) {
    const T2 = new Set([...topicT, ...decl.words]);
    const w = fitTokens(list[1]).filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !decl.anchors.has(t) && !/^[\d.]+$/.test(t));
    const hit = (t) => { const st = fitStem(t); return T2.has(st) || [...T2].some(x => x.length >= 5 && st.length >= 5 && (st.indexOf(x) === 0 || x.indexOf(st) === 0)); };
    if (w.length && !w.some(hit)) return res({ ok: false, reason: 'off topic', detail: 'a list of companies in another industry (' + w.join(' ') + '), nothing this website sells' });
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return res({ ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }); }
  else if (topicsOn) {
    const t = fitTopic(AR.read ? keyword : kw, ctx.topics, { ...ctx, _decl: decl });
    if (!t.ok) {
      // KW-GATE: off topic only BECAUSE every word of its own is another vendor's product ("netsuite pricing", "meta ai", "cleartax vs zoho"):
      // the client reads the real reason, another company's brand
      const ownW = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !FIT_BUYER.has(x) && !/^[\d.]+$/.test(x));
      const vs = ownW.length && t.reason === 'off topic' ? ownW.map(x => fitVendor([x], decl, ownLabels)) : [];
      if (vs.length && vs.every(Boolean)) return res({ ok: false, reason: 'other brand', detail: 'names ' + [...new Set(vs.map(v => v.name))].join(' and ') + ', another company\'s product or firm, which is not among what you sell' });
      return res({ ok: false, reason: t.reason, detail: t.detail });
    }
  }
  // 7. KW-GATE (2026-10-21): a product or a firm of ANOTHER vendor the client did not declare ("netsuite pricing" and "sap implementation dubai"
  //     for a Dynamics 365 partner, "storecove pricing" for peppol.org, "tech consultant deloitte"). A comparison is a topic of its own and stays
  //     ("dynamics 365 vs sap business one"); the client's own products never count (its services, business line, chosen keywords, domain).
  //     No evidence, no refusal: only with the client's services, or 12+ topic words, on file. It runs after the topic rule, so a keyword that is off topic anyway keeps that reason (the app's port of this gate, app/shared/src/fit-gate.ts, and the shared cadence fixture agree on it).
  if (!compareWord && ((topicT && topicT.size >= 12) || (Array.isArray(ctx.services) && ctx.services.filter(Boolean).length))) { const v = fitVendor(toks, decl, ownLabels.length ? ownLabels : fitLabels(ctx.own_domain, [])); if (v) return res({ ok: false, reason: 'other brand', detail: 'names ' + v.name + ', another company\'s product or firm, which is not among what you sell' }); }
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
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) })).filter(p => p.url);

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
  // RV-1 (2026-10-21): a page whose address answered 404 / 410 when it was last read (redirects followed: the bare host 308s to www, which
  // 404s) is GONE. It is still in the inventory (Google keeps showing it), but no advice may point at it: matchPage never returns it as
  // "the page that answers this search", and the readers list it as a redirect to make (v5/code/_gone.js). Unknown (0) is not gone.
  const isGone = (p) => { const n = Number((p || {}).http_status) || 0; return n === 404 || n === 410; };
  const gonePages = (model) => pages(model).filter(isGone);
  // ---- K8 (2026-10-21, KW-MATCH): the page that is ABOUT the search, not only the page that repeats its words ----
  // The 75% word rule missed techand.ai's live "AI & Automation | What We Do | Tech&" (/whatwedo/ai-automation) for "ai consulting dubai"
  // (1 of 3 words) and the ladder planned a new top page beside it; it also let "it consulting services dubai" claim an AI consulting page
  // on "consulting services dubai" alone. Now: brand, place and generic service words ("consulting", "services", "company", "dubai") never
  // decide a match; what is left (the search's core words) must be on the page, weighted by how rare each word is on this site (IDF: a word
  // on every page proves nothing); the page's title / H1, address and Search Console searches are the evidence, in that order; a page whose
  // own words belong to another service of the client is never the answer; an article is not the answer to a buying search; a gone page
  // answers nothing. Every hit carries `confidence` (0-1), `confidence_label` and `evidence` in plain words; a weaker one is `may_overlap`
  // (pageMatch), which callers report as "may overlap" and never as the page.
  const GENERIC = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'consultancies', 'service', 'services', 'company', 'companies', 'agency', 'agencies',
    'firm', 'firms', 'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'professional', 'professionals',
    'team', 'teams', 'best', 'top', 'near', 'me', 'leading', 'trusted', 'certified', 'official', 'online', 'local', 'affordable', 'cheap', 'home', 'page', 'website', 'site']);
  const COMMERCIAL = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'service', 'services', 'company', 'companies', 'agency', 'agencies', 'firm', 'firms',
    'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'hire', 'price', 'pricing', 'cost', 'quote']);
  const PLACES = new Set(['uae', 'gcc', 'mena', 'emirates', 'emirate', 'middle', 'east', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'dammam', 'qatar', 'doha', 'oman', 'muscat',
    'bahrain', 'manama', 'kuwait', 'egypt', 'cairo', 'uk', 'london', 'usa', 'india', 'pakistan', 'karachi', 'lahore', 'singapore', 'europe', 'gulf', 'dxb', 'difc', 'dafza']);
  // the kind of service a search or a page is about: "crm consulting" is not answered by a "CRM implementation" page (the words left are the same)
  const KIND = { consulting: 'consulting', consultant: 'consulting', consultants: 'consulting', consultancy: 'consulting', advisory: 'consulting', implementation: 'implementation', implement: 'implementation',
    migration: 'migration', integration: 'integration', support: 'support', training: 'training', course: 'training', courses: 'training', pricing: 'pricing', price: 'pricing', cost: 'pricing',
    audit: 'audit', development: 'development', licensing: 'licensing', license: 'licensing', licence: 'licensing', jobs: 'jobs', careers: 'jobs', career: 'jobs', hosting: 'hosting', outsourcing: 'outsourcing' };
  const kindsOf = (s) => uniq(tokensOf(norm(s)).map(t => KIND[t]).filter(Boolean));
  const ARTICLE = /\/(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|guides?)\/[^/]+/i;
  const svcList = (model) => (model && Array.isArray(model.declared_services) && model.declared_services.length) ? model.declared_services : services(model);
  // the client's own name ("Tech&", "techand"): never a topic word, unless the word also names one of its services ("ERP Partners" sells ERP)
  const brandWords = (model) => { const m = model || {}; const label = bare(m.domain || m.canonical_host || '').split('.')[0].replace(/[^a-z0-9]/g, '');
    const svc = new Set(svcList(m).flatMap(sv => tokensOf(norm(sv))));
    return new Set([...(m.brand_names || []), m.business_name].flatMap(b => tokensOf(norm(b))).concat(label ? [label] : []).filter(t => t.length > 2 && !svc.has(t))); };
  // the words that say WHAT a text is about: no stop / filler / generic / place / brand word, light stem, synonyms written out
  const coreTerms = (s, brands) => uniq(tokensOf(norm(s)).filter(t => t.length > 1 && !STOP.has(t) && !FILLER.has(t) && !GENERIC.has(t) && !PLACES.has(t) && !EMIRATES.has(t) && !(brands && brands.has(t))).map(stem));
  const slugText = (u) => pathOf(u).replace(/[?#].*$/, '').replace(/\.[a-z]{2,5}$/i, '').replace(/[\/_-]+/g, ' ');
  const fieldsOf = (p, brands) => ({ title: coreTerms(S(p.title) + ' ' + S(p.h1), brands), own: coreTerms(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url), brands),
    slug: coreTerms(slugText(p.url), brands), desc: coreTerms(S(p.description), brands),
    queries: (p.queries || []).filter(q => (Number((q || {}).impressions) || 0) > 0).map(q => coreTerms(S((q || {}).query || (q || {}).keyword), brands)) });
  // the client's services a set of core words belongs to (declared first): a service is hit when at least half its own core words are there
  const serviceHits = (model, terms, brands) => { const set = new Set(terms); const out = [];
    for (const sv of svcList(model)) { const st = coreTerms(sv, brands); if (!st.length) continue; const have = st.filter(t => set.has(t)).length; if (have >= Math.max(1, Math.ceil(st.length / 2))) out.push(S(sv)); }
    return out; };
  const MATCH_CONF = { page: 0.75, overlap: 0.4, article_cap: 0.6, high: 0.85 };
  const confLabel = (c) => c >= MATCH_CONF.high ? 'high' : c >= MATCH_CONF.page ? 'medium' : 'low';
  const topicMatch = (model, keyword, inv, opts) => {
    const o = opts || {}; const brands = brandWords(model); const core = coreTerms(keyword, brands); if (!core.length) return { best: null, overlap: null, core };
    const commercial = tokensOf(norm(keyword)).some(t => COMMERCIAL.has(t)); const kKinds = kindsOf(keyword);
    const docs = inv.map(p => ({ p, f: fieldsOf(p, brands) }));
    const N = docs.length || 1; const df = (t) => docs.filter(d => covers(d.f.own, t)).length;
    const w = new Map(core.map(t => [t, Math.log((N + 1) / (df(t) + 1)) + 1]));   // IDF: a word on every page of the site weighs least
    const W = core.reduce((a, t) => a + w.get(t), 0);
    const kSvc = serviceHits(model, core, brands);
    const kSvcTerms = new Set(kSvc.flatMap(sv => coreTerms(sv, brands)));
    const ignored = uniq(tokensOf(norm(keyword)).filter(t => GENERIC.has(t) || PLACES.has(t) || EMIRATES.has(t) || brands.has(t)));
    let best = null, overlap = null;
    const better = (a, b) => !b || a.confidence > b.confidence + 1e-9 || (Math.abs(a.confidence - b.confidence) < 1e-9 && (a.search_queries_about > b.search_queries_about || (o.isPref && o.isPref(a.url) && !o.isPref(b.url))));
    for (const { p, f } of docs) {
      if (o.skip && o.skip(p)) continue;
      const qAbout = f.queries.filter(q => core.every(t => covers(q, t)));   // its Search Console searches that carry every core word of this one
      const field = (t) => covers(f.title, t) ? 1 : covers(f.slug, t) ? 0.9 : qAbout.length >= 2 ? 1 : f.queries.filter(q => covers(q, t)).length >= 2 ? 0.85 : qAbout.length === 1 ? 0.7 : covers(f.desc, t) ? 0.6 : 0;
      const cov = core.reduce((a, t) => a + w.get(t) * field(t), 0) / W;
      if (cov <= 0) continue;
      const pSvc = serviceHits(model, f.own, brands);
      if (kSvc.length && pSvc.length && !pSvc.some(sv => kSvc.includes(sv))) continue;   // another service of the client: never the answer, not even "may overlap"
      // focus: how much of the page's own title is this search (or the client service it belongs to); a page about five things is a weaker answer
      const own = f.title.length ? f.title : f.slug;
      const focus = own.length ? own.filter(t => core.includes(t) || kSvcTerms.has(t)).length / own.length : 0;
      let conf = cov * (0.8 + 0.2 * focus);
      const article = ARTICLE.test(pathOf(p.url)) || isListing(p.url);
      if (commercial && article) conf = Math.min(conf, MATCH_CONF.article_cap);   // an article about the subject is not the page that sells it
      const pKinds = kindsOf(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url)); const kindClash = kKinds.length && pKinds.length && !pKinds.some(k => kKinds.includes(k));
      if (kindClash) conf = Math.min(conf, MATCH_CONF.article_cap);   // "crm consulting" vs a "CRM implementation" page: another kind of service
      const untitled = !S(p.title) && !S(p.h1);
      if (untitled && qAbout.length < 2) conf = Math.min(conf, MATCH_CONF.article_cap);   // an address alone is not enough to call it the page (R34: titles not read yet)
      conf = Math.round(conf * 100) / 100;
      const inTitle = core.filter(t => covers(f.title, t)), inSlug = core.filter(t => !covers(f.title, t) && covers(f.slug, t));
      const ev = [];
      if (inTitle.length) ev.push('its title' + (S(p.title) ? ' "' + S(p.title).replace(/&amp;/g, '&') + '"' : '') + ' is about ' + inTitle.map(t => '"' + t + '"').join(' and '));
      if (inSlug.length) ev.push('its address ' + pathOf(p.url) + ' carries ' + inSlug.map(t => '"' + t + '"').join(' and '));
      if (qAbout.length) ev.push(qAbout.length + ' of its Search Console searches ' + (qAbout.length === 1 ? 'is' : 'are') + ' about it');
      const shared = pSvc.find(sv => kSvc.includes(sv));
      if (shared) ev.push('both are about your service "' + shared + '"');
      if (commercial && article) ev.push('it is an article, not the page that sells this service');
      if (kindClash) ev.push('it is about ' + pKinds.join(' / ') + ', the search asks for ' + kKinds.join(' / '));
      if (untitled && qAbout.length < 2) ev.push('its title was not read yet');
      if (!ev.length) ev.push('some of its words are about this search');
      const hit = { url: p.url, title: p.title, source: p.source, matched_by: inTitle.length ? 'title' : inSlug.length ? 'slug' : qAbout.length ? 'query' : 'topic', score: conf, impressions: 0,
        confidence: conf, confidence_label: confLabel(conf), search_queries_about: qAbout.length, article, pass: 'topic',
        evidence: ev.join(', ') + (ignored.length ? ' (' + ignored.map(t => '"' + t + '"').join(', ') + ' left out as too general)' : '') };
      if (conf + 1e-9 >= MATCH_CONF.page) { if (better(hit, best)) best = hit; }
      else if (conf + 1e-9 >= MATCH_CONF.overlap && better(hit, overlap)) overlap = hit;
    }
    return { best, overlap, core };
  };
  // { match, may_overlap }: `match` is the page that answers the search (or null), `may_overlap` a weaker candidate to mention, never to act on
  const pageMatch = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return { match: null, may_overlap: null };
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model).filter(p => !isGone(p));   // RV-1: a gone page answers nothing
    const brands = brandWords(model); const core = coreTerms(keyword, brands);
    const kSvc = core.length ? serviceHits(model, core, brands) : [];
    const otherService = (p) => { if (!kSvc.length) return false; const ps = serviceHits(model, fieldsOf(p, brands).own, brands); return ps.length > 0 && !ps.some(sv => kSvc.includes(sv)); };
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0,
        confidence: 1, confidence_label: 'high', pass: 'query', evidence: 'Google already shows it for this exact search (' + (Number(q.impressions) || 0) + ' impressions in Search Console)' });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return { match: lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit, may_overlap: null }; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 < MATCH_MIN) continue;
      // K8: the 75% may be made of generic and place words only when the search's core words are on the page too ("it consulting services
      // dubai" is not an AI consulting page), and never on a page of another service of the client
      if (core.length && !core.every(t => covers(slug, t) || covers(title, t))) continue;
      if (otherService(p)) continue;
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url))) { const sc = Math.round(score * 100) / 100;
        best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: sc, impressions: 0, confidence: sc, confidence_label: confLabel(sc), pass: 'words',
          evidence: (inSlug >= inTitle ? 'its address ' + pathOf(p.url) : 'its title "' + S(p.title).replace(/&amp;/g, '&') + '"') + ' carries ' + Math.round(score * 100) + '% of the words of the search' }; }
    }
    let overlap = null;
    if (!best) { const t = topicMatch(model, keyword, inv, { skip: (p) => !!qHit && isListing(p.url), isPref }); best = t.best; overlap = t.overlap; }
    if (qHit && best) return { match: { ...best, listing: listingOf(qHit, best) }, may_overlap: null };
    const match = qHit || best;
    return { match, may_overlap: match || !overlap ? null : { ...overlap, note: 'may overlap: ' + pathOf(overlap.url) + ' touches this search (' + overlap.evidence + '), but not closely enough to call it the page for it' } };
  };
  const matchPage = (model, keyword, prefer) => pageMatch(model, keyword, prefer).match;
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
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q;
        // RV-1: the newest reading of the address wins (a page that came back after a redirect was added is live again)
        if ((Number(p.http_status) || 0) && S(p.status_at) >= S(old.status_at)) { old.http_status = Number(p.http_status) || 0; old.status_at = S(p.status_at); } } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) }); }
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
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at),
    http_status: num0(p.http_status), status_at: S(p.status_at) }));   // RV-1: what the address answered when it was last read (0 = not read)
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
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, pageMatch, MATCH_CONF, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, gonePages,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms, coreTerms } };
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
    serp_check_usd: 0.006       // one DataForSEO live-advanced SERP 30 deep with the AI Overview (measured $0.006, fa3_live), the one request shape every path sends since KW-SERP (2026-10-21); depth 10 was $0.002
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

// Keyword Check: the answer. Difficulty for this site and plan from the shared reach rules; topic fit, navigational / other brand and the
// alternatives from the small Claude call (if it failed: fit null, navigational from DataForSEO's intent unless the keyword names the site itself).
// Alternatives only when the keyword is not realistic or off-topic, never the keyword itself or one the site already targets.
// A-28 (re-rating 2026-10-17): $0.002 was a guess (~900 in + ~80 out); n8n's own token usage of execs 749-751 / 761-762 put one Haiku
// call at $0.0029-0.0033 (the prompt plus the agent's tool and formatting instructions, ~2,000 tokens). Not counted per call: two
// count_tokens round-trips would land on the caller's clock (section 108), so the figure is the measured upper end, labelled ESTIMATED.
const CONFIG = { ai_cost_usd: 0.0033 };
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
const fitAi = aiOk ? Math.max(0, Math.min(2, Math.round(Number(o.fit)))) : null;
// the second attempt (*Keyword Fit (Text)*) runs only when the first came back empty; referencing a node that did not run throws
let plainRan = false; try { plainRan = !!($('Keyword Fit (Text)').first() || {}).json; } catch (e) { plainRan = false; }
// F-KW (2026-10-20, finding 5): the site's own brand is its DISTINCTIVE label only (fitOwnLabels): on an exact-match domain
// ("erp-software.ae") "erp software uae" is the client's subject, not a search for the site itself
const kwToksA = fitTokens(a.keyword);
const ownBrand = fitOwnLabels(a.domain, kwToksA, [...new Set((a.services || []).flatMap(x => fitTokens(x)))]).some(l => kwToksA.includes(l) || kwToksA.join('').includes(l));
const navAi = aiOk ? (o.navigational === true || String(o.navigational).toLowerCase() === 'true') : (String(a.intent || '') === 'navigational' && !ownBrand);
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
// ---- keyword-first R-K4 (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1): the deterministic fit gate, called at last ----
// The Keyword Check inlined fitGate and never called it, so whether a competitor's brand, a government portal or the site's own name was "a
// fit" was left to one Haiku call (and to nothing when that call failed). The gate runs first, on what the engine knows about the site: its own
// domain, the competitors it declared (seo_monitors / the site row), the brand names AI uses for other companies (seo_cache ai_brands:<site>),
// DataForSEO's intent, and as topics what it sells (the request's services, the site model's services, the client's declared services) and the
// keywords it already chose. A refusal makes `fit` 0 with its reason, whatever the model said; the model's alternatives are still offered.
const siteRowA = rowsOf('Load Site (Assess)')[0] || {}, monRowA = rowsOf('Load Monitors (Assess)')[0] || {};
const modelA = (() => { try { return SM.from({ ...siteRowA, site_id: siteRowA.site_id || a.site_id || '', domain: siteRowA.domain || a.domain || '' }, { monitors: monRowA }); } catch (e) { return null; } })();
let cacheA = []; try { cacheA = $('Load Assess Cache').all().map(i => i.json).filter(r => r && r.key); } catch (e) { cacheA = []; }
const headsA = [...new Set(rowsOf('Load Ladders (Assess)').map(r => String(r.head_keyword || '')).filter(Boolean))];
const servicesA = [...new Set([...(a.services || []), ...(modelA ? modelA.services : [])].map(x => String(x || '').trim()).filter(Boolean))];
const gateCtxA = FITR.ctx({ own_domain: a.domain, intent: a.intent || '', competitors: modelA ? modelA.competitors : [], brands: fitLearnedBrands(cacheA), heads: headsA, services: servicesA,
  topics: [...servicesA, ...headsA, ...(a.existing_keywords || [])], topic_label: 'what this website sells and the keywords you chose' });
// ---- E-SERP (2026-10-21, pre-launch run RV-11): the keyword's own results page, read the way the ladder head and the research read it ----
// "ai consultant" came back a fit and Easy here (no results page was read) while the ladder refused it as a career search: upwork, a USAII
// certification, indeed, bayt, glassdoor, and the questions people also ask were about salary. The gate now gets the same evidence the ladder
// head gets: the top 10 (ctx.serp, the brand-query rule) and ctx.career (fitCareer: the pages, the questions, the related searches). A page
// that could not be read is said to be unread, and the fit is judged without it; it is never read as "no demand".
const serpA = (a.serp && typeof a.serp === 'object') ? a.serp : { asked: false, read: false, why: 'not asked', pages: [], paa: [], related: [] };
const serpPagesA = Array.isArray(serpA.pages) ? serpA.pages : [];
if (serpA.read) {
  gateCtxA.serp = serpPagesA.map(p => String(p.domain || '')).filter(Boolean);
  gateCtxA.career = { pages: serpPagesA.map(p => ({ domain: p.domain, url: p.url, title: p.title })), paa: serpA.paa || [], related: serpA.related || [],
    topics: [...servicesA, ...headsA, ...(a.existing_keywords || [])] };
}
const gate = fitGate(a.keyword, gateCtxA);
const careerA = !gate.ok && gate.reason === 'job search' && !!gate.career;
const GATE_WORDS = { 'own brand': 'it is your own brand name', 'other brand': 'it names another company', government: 'it is a government service', navigational: 'people search it to reach one particular website',
  portal: 'it is a login, portal or status check', 'off topic': 'it is not about what you sell', 'too broad': 'it is too broad to win', 'job search': careerA ? 'people search it to find work or training' : 'people search it to find work', empty: 'there is no keyword' };
// what KIND of page Google ranks here (KWI.serpPageTypes, the research's and the ladder's rule): lists, jobs, courses or service pages
const kindsA = serpA.read && serpPagesA.length ? KWI.serpPageTypes(serpPagesA.map(p => ({ url: p.url || p.domain, title: p.title || '' })), {}) : null;
const fit = gate.ok ? fitAi : 0;
// F-KW (2026-10-20, finding 2): the gate judges topic distance only with 12+ topic words on file. Below that it passed everything and the
// answer read as if the topic had been checked. Now the check says when there is not enough information to judge (and how to fix it), and a
// keyword with positive evidence says so; the model's own fit still stands, it is never overruled on too little evidence.
// F-REH (2026-10-20, real-credit rehearsal): the services the client DECLARED (the request's, and the stored seo_sites.declared_services) are
// passed to fitEvidence as well, so a keyword that carries one of their product categories ("crm service provider uae" for "CRM
// implementation") counts as on topic even with few words on file. And the note is the customer's own sentence, built here for the state the
// site is in: it asks for services only when none are listed (the rehearsal's client had listed four and was told to "add what you sell"),
// with no internal terms and nothing said twice.
const declaredA = [...new Set([...(a.services || []), ...((modelA && modelA.declared_services) || [])].map(x => String(x || '').trim()).filter(Boolean))];
const evA = gate.ok ? fitEvidence(a.keyword, gateCtxA.topics || [], { topic_label: 'what you sell and the keywords you chose', services: declaredA }) : null;
const topic_judged = !evA || evA.verdict !== 'unknown';
const topicNoteA = topic_judged ? '' : !declaredA.length
  ? 'we could not tell whether this keyword matches what you sell, because no services are listed for this website yet. Add your main services in your website settings and the check will tell you'
  : 'we could not tell whether this keyword matches what you sell: it does not clearly match the services you listed (' + declaredA.slice(0, 4).join(', ') + (declaredA.length > 4 ? ' and ' + (declaredA.length - 4) + ' more' : '') + '). If you offer it, add it to your services and check it again';
const navigational = gate.ok ? navAi : (gate.reason === 'navigational' || navAi);
const fit_gate = gate.ok ? { ok: true, reason: '', detail: '', topic_judged, topic_note: topicNoteA, ...(evA && evA.basis === 'declared service' ? { topic_basis: evA.detail } : {}) } : { ok: false, reason: gate.reason, detail: gate.detail, words: GATE_WORDS[gate.reason] || gate.reason, topic_judged: true, topic_note: '' };
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
const existing = (() => {
  const kw = String(a.keyword || '').toLowerCase().trim();
  const same = (x) => { const k = String(x || '').toLowerCase().trim(); return !!k && (k === kw || keywordsOverlap(k, kw)); };
  const dom = reachDomain(a.domain);
  // a stored rung the fit gate refuses (a competitor's brand, a government portal) is not "one of your keywords" - same gate as every read path
  const lad = rowsOf('Load Ladders (Assess)').filter(r => fitStored(r, { own_domain: a.domain, protect: [a.keyword] }).ok).filter(r => !dom || reachDomain(r.domain) === dom).find(r => same(r.keyword) || (Number(r.rung) === 4 && same(r.head_keyword)));
  const log = rowsOf('Load Content Log (Assess)').filter(r => !dom || reachDomain(r.domain) === dom).find(r => same(r.keyword));
  const hit = (a.existing_keywords || []).find(same) || (lad && lad.keyword) || (log && log.keyword) || '';
  // A-1 (2026-10-17, exec 750): a live page of the site that already targets the search (the page inventory seo_pages, SM.matchPage: the
  // page that gets impressions for it, or 75% of its words in the slug / title) - "business central partner uae" was answered `existing:
  // null` beside /dynamics-365-business-central-uae ("Certified Microsoft Dynamics 365 Business Central Partner in UAE")
  const pages = rowsOf('Load Pages (Assess)');
  const model = pages.length ? SM.withPages(SM.from({ domain: a.domain || '' }, {}), pages) : null;
  const pm = model ? SM.matchPage(model, kw) : null;
  const pg = pm && !SM.isListing(pm.url) ? { url: String(pm.url), title: String(pm.title || ''), matched_by: pm.matched_by } : null;
  // A-2 (exec 751): the ladder's OWN status is its seo_ladder_settings row's (active / paused / ...), never the rung row's (planned /
  // writing, which is `row_status`). A ladder with no settings row is active (the Content Cadence's own default) - but only when the settings
  // could be read at all; with nothing readable its status is unknown (null), never the rung row's word.
  const sets = rowsOf('Load Ladder Settings (Assess)');
  const lst = lad ? (sets.find(r => String(r.ladder_id || '') === String(lad.ladder_id || '')) || null) : null;
  const LSTAT = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
  const ladStatus = !lad ? null : lst && LSTAT.includes(String(lst.status || '').trim().toLowerCase()) ? String(lst.status).trim().toLowerCase()
    : (lst || sets.length) ? 'active' : null;
  if (!hit && !lad && !log && !pg) return null;
  if (!hit && !lad && !log) return { keyword: kw, how: 'a page of yours', ladder_id: null, ladder_status: null, rung: null, page_url: pg.url, page_title: pg.title || null, page_status: 'live',
    matched_by: pg.matched_by, pages_checked: pages.length,
    note: 'you already have a page for this search: ' + pg.url + (pg.title ? ' ("' + pg.title + '")' : '') + ' - improve that page rather than starting a ladder for a second one' };
  const page_url = String((log && (log.published_url || log.existing_page_url)) || (lad && lad.target_url) || (pg && pg.url) || '').trim();
  return { keyword: String(hit || (lad && lad.keyword) || ''), how: String(hit).toLowerCase().trim() === kw ? 'the same keyword' : 'the same search',
    ladder_id: lad ? String(lad.ladder_id || '') : null, ladder_status: ladStatus, row_status: lad ? String(lad.status || '') : null, rung: lad ? Number(lad.rung) || null : null,
    page_url: page_url || null, page_status: log ? String(log.status || '') : null, live_page: pg ? pg.url : null, pages_checked: pages.length,
    note: 'already one of your keywords' + (lad ? ' (ladder ' + lad.ladder_id + (ladStatus ? ', ' + ladStatus : '') + ')' : ' (one of your keyword ladders)')
      + (page_url ? ' - its page: ' + page_url : '') + ': continue that ladder / improve that page rather than starting a second one for the same search' };
})();
const listOf = (v) => (Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/[\n,;]+/) : [])).map(x => String(x == null ? '' : x).toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()).filter(x => x.length >= 2 && x.length <= 100);
const need = difficulty_for_you === 'not_realistic' || fit === 0;
// KW-GATE (review 16): every alternative goes through the same gate, WITHOUT the asked keyword's own results page and career evidence: those
// pages describe the asked search, not the alternative (a government results page for "vat registration uae" must not refuse "vat consultant uae")
const ctxAlt = { ...gateCtxA, career: null, serp: [] };
let alternatives = need && aiOk ? [...new Set(listOf(o.alternatives))].filter(x => fitGate(x, ctxAlt).ok && !keywordsOverlap(x, a.keyword) && !(a.existing_keywords || []).some(e => keywordsOverlap(e, x))).slice(0, 3) : [];
// E-SERP: a career search is offered BUYER searches only - the model's and the results page's own related searches, each through the same gate
// (no job, pay or course words), with a buyer word for the related ones; none at hand = none offered, never the job searches back
if (careerA) {
  const ctxNoCareer = ctxAlt;
  const buyerOk = (k) => { const t = ' ' + String(k).toLowerCase() + ' '; return fitGate(k, ctxNoCareer).ok && !FIT_JOB_KW.test(t) && !FIT_COURSE_KW.test(t) && !keywordsOverlap(k, a.keyword) && !(a.existing_keywords || []).some(e => keywordsOverlap(e, k)); };
  const relBuyer = listOf(serpA.related || []).filter(k => FIT_BUYER_KW.test(' ' + k + ' '));
  alternatives = [...new Set([...alternatives, ...relBuyer])].filter(buyerOk).slice(0, 3);
}
const warnings = [];
if (!gate.ok) warnings.push('not a fit for this website: ' + fit_gate.words + ' (' + gate.detail + ')');
if (!topic_judged) warnings.push(topicNoteA);
// E-SERP: an unread results page is said once, with the provider's reason; it is not "no demand" and nothing was concluded from it
if (serpA.asked && !serpA.read) warnings.push('results page not read (' + String(serpA.why || 'no answer').slice(0, 140) + '): the fit was judged without it, so whether people search it for work or training was not checked');
if (gate.ok && kindsA && kindsA.dominant && !['Service or product page', 'Homepage'].includes(kindsA.dominant)) warnings.push('what Google ranks: ' + kindsA.text);
if (!aiOk && gate.ok) warnings.push('topic check unavailable: ' + String((out.error && (out.error.message || out.error)) || 'no answer from the model').slice(0, 160) + (plainRan ? ' (the plain-text retry answered nothing either)' : ''));
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
  fit_gate, fit_source: !gate.ok ? 'gate' : aiOk ? 'model' : 'unknown',   // R-K4: a refusal by the gate decides the fit, independent of the model
  cost_usd: +(Number(a.dfs_cost || 0) + CONFIG.ai_cost_usd * (plainRan ? 2 : 1)).toFixed(4),   // R3: the model is charged even when its answer could not be parsed
  label: (reachLabel(difficulty_for_you, plan.plan_type === 'none' ? null : plan) || REACH_DIFF_LABEL[difficulty_for_you]) + (topic.used ? ' \u00b7 measured on this topic' : '') + (fit === null ? ' \u00b7 ' + FIT_UNKNOWN : '') + (gate.ok ? '' : ' \u00b7 not a fit: ' + fit_gate.words), fit_known: fit !== null, stretch: plan.stretch, position_url: a.position_url,
  chance: plan.plan_type === 'none' ? null : plan.chance, chance_text: plan.plan_type === 'none' ? '' : reachChanceText(plan), base_rate: REACH_BASE_RATE,   // G3 (2026-10-11): the estimated chance band (uncalibrated) and the 2025 base rate
  reach_info: { method: a.reach_info.method, p75: a.reach_info.p75 ?? null, size_reach: a.reach_info.size_reach ?? null, sample: a.reach_info.sample ?? null, top10: a.reach_info.top10 ?? null, cached: !!a.reach_info.cached, cached_at: a.reach_info.cached_at || null,
    site_reach: topic.site_reach },
  // B1-1: which number this answer was measured against, what stands behind it, and the sentence that says so in the owner's words
  reach_basis: topic.used ? 'topic' : 'site', topic_reach: topic.topic_reach, reach_used: reach,
  topic_evidence: { on_topic: topic.on_topic, top10: topic.top10, sample: topic.sample, best: topic.best, examples: topic.examples, other_topics: topic.other_topics, reason: topic.reason },
  reach_note: topic.note,
  existing,   // R50
  // E-SERP: the results page this answer read (or why it could not), and what kind of page Google ranks there
  serp: { read: !!serpA.read, asked: !!serpA.asked, why: serpA.read ? '' : String(serpA.why || ''), pages_read: serpPagesA.length, top: serpPagesA.slice(0, 5).map(p => p.domain),
    paa: (serpA.paa || []).slice(0, 4), page_types: kindsA ? { read: kindsA.read, dominant: kindsA.dominant, counts: kindsA.counts, text: kindsA.text } : null,
    checked_at: serpA.checked_at || null, ai_overview_seen: serpA.read ? !!serpA.ai_overview_seen : null, read_today: !!serpA.read_today, read_note: String(serpA.read_note || '') },   // KW-SERP: the one reading of today, shared with every path
  fit_judged_without_serp: !serpA.read,
  business_source: a.business_source, warnings };
if (existing) body.label = body.label + (existing.how === 'a page of yours' ? ' · you already have a page for it' : ' · already one of your keywords');
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
