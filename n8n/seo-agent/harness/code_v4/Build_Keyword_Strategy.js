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
// ---- results-page observations (2026-10-11, FIX_PLAN D26): an AI Overview (and every other SERP feature) is what ONE Google query showed at
// ONE moment — live, the ladder plan said "no AI Overview" and the page run minutes later "cites 11 domains". Inlined by the build
// (the SERP_OBS placeholder) into Analyze Competitor Pages (the digest the verdict reads), Build Keyword Strategy (stored vs live checks) and Build
// Ladder Report; the keyword report's row is patched by build_v4.py. Every text says WHEN it was seen ("seen in the check at 15:58 UTC on
// 2026-10-11") or "seen in N of M checks", and that AI Overviews vary between searches — never "there is no AI Overview".
// the time of a DataForSEO SERP answer (result datetime "2026-10-11 15:58:12 +00:00", else the task time, else now) as ISO
const serpSeenAt = (res) => {
  try {
    const t0 = ((res || {}).tasks || [])[0] || {}; const r0 = (t0.result || [])[0] || {};
    const raw = String(r0.datetime || t0.time || r0.check_url_time || '');
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(?:Z|([+-]\d{2}):?(\d{2}))?/);
    if (m) { const d = new Date(m[1] + 'T' + m[2] + ':' + (m[3] || '00') + (m[4] ? m[4] + ':' + m[5] : 'Z')); if (!isNaN(d.getTime())) return d.toISOString(); }
  } catch (e) {}
  return new Date().toISOString();
};
// "15:58 UTC on 2026-10-11"
const obsClock = (iso) => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d.getTime())) return 'an unknown time'; const z = d.toISOString(); return z.slice(11, 16) + ' UTC on ' + z.slice(0, 10); };
// obs: [{ seen: true | false | null, at: iso, source }] -> { count, seen, text }; null = that check could not read the results page (not counted)
const aioObserved = (obs) => {
  const known = (obs || []).filter(o => o && o.seen != null);
  if (!known.length) return { count: 0, seen: 0, text: 'unknown — the results page could not be read' };
  const seen = known.filter(o => o.seen);
  const one = (o) => (o.seen ? 'seen' : 'not seen') + ' in the check at ' + obsClock(o.at) + (o.source ? ' (' + o.source + ')' : '');
  if (known.length === 1) return { count: 1, seen: seen.length, text: one(known[0]) + ' — AI Overviews vary between searches, so this is one observation, not a fixed feature of the query' };
  return { count: known.length, seen: seen.length, text: 'seen in ' + seen.length + ' of ' + known.length + ' checks (' + known.map(one).join('; ') + ') — AI Overviews vary between searches' };
};
// ---- lineage (G29, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.11) ----
// Every number a customer reads has to say where it came from, over what period, and how big the sample was. Before this, the AI
// visibility report said it (sample sizes, Wilson ranges) and the others did not: the weekly report printed "1,240 impressions" and
// "#8" side by side without saying that one is a 28-day Search Console count and the other one live sample of one results page.
// LN.of() carries that as structured fields next to the value (`source`, `period`, `sample`, `basis`), LN.note() turns them into one
// short line for a tooltip or a footnote, and LN.block() prints the whole list under a report as "Where these numbers come from".
// Rules: the vocabulary is the one the rest of the system already uses (G6 "modelled, not measured clicks", G8 `calibrated` /
// `modelled` / `unknown`, G28 statistical ranges, G26 `impact_basis`) - this kit makes it universal, it does not invent a second
// scheme. A modelled or uncalibrated number must say so. Where lineage is genuinely unknown the note reads "source not recorded":
// never a guessed source.
const LN = (() => {
  const MISSING = 'source not recorded';
  // where numbers come from. `label` is what a customer reads, `how` the one sentence about what that source can and cannot see.
  const SOURCES = {
    gsc: { label: 'Google Search Console', how: 'Google\'s own count of the impressions and clicks it served; the last 3 days are not final, and figures are averages across devices and locations' },
    gsc_history: { label: 'your stored Search Console history', how: 'the weekly Search Console readings we have kept for this site' },
    inspection: { label: 'Search Console URL Inspection', how: 'Google\'s own answer about one URL at the moment it was asked' },
    gsc_links: { label: 'your Search Console link export', how: 'the sample of links Google shows you; it is a sample, not the whole list' },
    ga4: { label: 'Google Analytics 4', how: 'visits measured on your site by your own GA4 property' },
    serp: { label: 'a live Google results page', how: 'one results page read through DataForSEO at that moment, from one country and one device' },
    kwdata: { label: 'Google Ads keyword data (through DataForSEO)', how: 'the provider\'s monthly search volume and cost per click; a provider estimate for a single keyword, not a measurement of your site' },
    backlink_index: { label: 'the DataForSEO backlink index', how: 'one crawler\'s index of the web: it finds much of the web, never all of it' },
    bing: { label: 'Bing Webmaster Tools', how: 'Bing\'s own figures for the site it has verified' },
    link_graph: { label: 'the Common Crawl web graph', how: 'a public crawl of the web, released every few months' },
    ahrefs: { label: 'the Ahrefs Domain Rating API', how: 'Ahrefs\' own 0-100 rating of a domain' },
    trends: { label: 'Google Trends', how: 'a relative index of search interest (100 = the peak of the period), not a count of searches' },
    ai_engines: { label: 'the AI assistants themselves', how: 'the answers ChatGPT, Gemini, Google AI Mode and the others gave to the questions in your panel' },
    ai_db: { label: 'the DataForSEO AI-answer database', how: 'a database of AI answers and the brands they name' },
    own_check: { label: 'our own fetch of the page', how: 'we requested the page ourselves and read what came back' },
    draft: { label: 'the finished draft itself', how: 'counted in the text this run wrote, before anybody published it' },
    crawl: { label: 'our crawl of your website', how: 'the pages we could reach and read on your site' },
    crux: { label: 'the Chrome User Experience Report', how: 'speed as real Chrome visitors experienced it over 28 days' },
    pagespeed: { label: 'Google PageSpeed Insights (Lighthouse)', how: 'one simulated mobile load in a lab, not what your visitors felt' },
    rdap: { label: 'the domain registry (RDAP, else WHOIS)', how: 'the registry\'s own record of when a domain was registered' },
    gbp: { label: 'Google Business Profile', how: 'the public listing Google holds for the business' },
    wikidata: { label: 'Wikidata', how: 'the public knowledge base search engines read' },
    web: { label: 'public web pages we read', how: 'pages we fetched and quoted; nothing behind a login' },
    you: { label: 'what you told us', how: 'the business profile, the monthly check-in or the forms you filled in' },
    model: { label: 'a model on top of measured data', how: 'computed from measured numbers with a published formula, not measured itself' },
    none: { label: MISSING, how: 'this figure reached the report without its source: treat it as unverified' },
  };
  // how the figure was arrived at. The words are the ones G6 / G8 / G28 already use.
  const BASIS = {
    measured: 'measured',
    calibrated: 'calibrated against your own measured data',
    modelled: 'modelled, not measured',
    one_sample: 'one sample, not an average',
    estimated: 'estimated',
    reported: 'reported by the source',
    unknown: MISSING,
  };
  const S = (v) => String(v == null ? '' : v);
  const fmt = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = (k) => SOURCES[k] || SOURCES.none;
  // "2026-09-15 to 2026-10-12 (28 days)" - the period a figure covers, never an empty string
  const range = (r, label) => { const o = r || {}; const a = S(o.start), b = S(o.end);
    if (!a && !b) return label ? S(label) : 'period not recorded';
    if (a && b) { const d = Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5) + 1;
      return a + ' to ' + b + (Number.isFinite(d) && d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : ''); }
    return 'to ' + (b || a); };
  const asOf = (at) => { const d = S(at).slice(0, 10); return d ? 'as of ' + d : 'date not recorded'; };
  const days = (n, end) => (Number(n) || 0) + ' days' + (S(end).slice(0, 10) ? ' to ' + S(end).slice(0, 10) : '');
  const sample = (n, unit) => (n == null || n === '' || !Number.isFinite(Number(n))) ? 'sample not recorded' : fmt(n) + (unit ? ' ' + S(unit) : '');
  // one figure's lineage, as structured fields beside the value
  const of = (figure, source, o) => { const x = o || {}; const key = SOURCES[source] ? source : 'none';
    const basis = BASIS[x.basis] ? x.basis : (key === 'none' ? 'unknown' : 'measured');
    return { figure: S(figure), source: key, source_label: src(key).label, source_how: src(key).how,
      period: S(x.period) || 'period not recorded', sample: x.sample == null ? 'sample not recorded' : S(x.sample),
      basis, basis_label: BASIS[basis], note: S(x.note) };
  };
  // a figure whose source nobody recorded: say exactly that instead of inventing one
  const unknown = (figure, why) => ({ figure: S(figure), source: 'none', source_label: MISSING, source_how: src('none').how,
    period: '', sample: '', basis: 'unknown', basis_label: MISSING, note: S(why) });
  // "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured"
  const note = (l) => { const x = l || {}; const lbl = x.source_label || MISSING;
    return [lbl, x.period, x.sample, x.basis_label === lbl ? '' : x.basis_label, x.note].filter(Boolean).join(' · '); };
  const isHonest = (l) => !!l && (l.basis !== 'unknown' || note(l).indexOf(MISSING) >= 0);
  // ---- the evidence half of the same rule (R10, promoted to the class by lineage_lint.py, 2026-10-15) ----
  // A finding is a figure like any other: it may not be shown without the thing that shows it. R10 was exactly this - Google
  // retired the Mobile Usability report, the API answered VERDICT_UNSPECIFIED for every page, and the audit raised a HIGH finding
  // on 45 of 47 pages whose evidence string was "/:  | /whatwedo/ai-automation: " - punctuation and nothing else. So the test is
  // not `evidence !== ''`: a string that is only separators, brackets or a bare "0" carries no evidence either.
  const hasEvidence = (f) => {
    const ev = S((f || {}).evidence).replace(/<[^>]*>/g, ' ');     // markup is not evidence
    return /[A-Za-z]|[1-9]/.test(ev.replace(/[\s;|,.:·\-–—()\[\]\/]+/g, ' '));
  };
  // the findings that may be shown, and the titles of the ones held back. `allow` names a title that is evidence in itself
  // (a count in the title, a note about data that could not be collected); everything else has to carry its own.
  const unevidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    return (list || []).filter(f => f && !hasEvidence(f) && allow.indexOf(S(f.title)) < 0).map(f => S(f.title || f.id || 'untitled')); };
  const evidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    const keep = (list || []).filter(f => f && (hasEvidence(f) || allow.indexOf(S(f.title)) >= 0));
    if (typeof x.onDrop === 'function') { const d = unevidenced(list, o); if (d.length) x.onDrop(d); }
    return keep; };
  const evidenceNote = (dropped) => (dropped || []).length
    ? (dropped.length + ' finding(s) were left out because nothing was measured to show them: ' + dropped.slice(0, 5).join(', ')) : '';
  const html = (l) => '<span style="color:#64748b;font-size:11px">' + esc1(note(l)) + '</span>';
  const line = (l) => '<div style="color:#64748b;font-size:11px;margin-top:2px">' + esc1(note(l)) + '</div>';
  // the block under a report: one row per figure, so no number is left without a source, a period and a sample
  const block = (list, o) => { const rows = (list || []).filter(Boolean); const x = o || {};
    const td = 'style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;color:#334155"';
    const th = 'style="padding:3px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    if (!rows.length) return '';
    return '<h3 style="margin:18px 0 4px;font-size:13px;color:#0f172a">' + esc1(x.title || 'Where these numbers come from') + '</h3>'
      + '<table style="border-collapse:collapse;margin:4px 0;max-width:100%">'
      + '<tr><th ' + th + '>Figure</th><th ' + th + '>Source</th><th ' + th + '>Period</th><th ' + th + '>Sample</th><th ' + th + '>How it was arrived at</th></tr>'
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '-')
        + '</td><td ' + td + '>' + esc1(l.sample || '-') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(': ')) + '</td></tr>').join('')
      + '</table><p style="color:#64748b;font-size:11px;margin:4px 0">' + esc1(x.footer || 'A figure marked "' + BASIS.modelled + '" is computed, not counted; "' + MISSING + '" means the figure reached this report without its source and should be treated as unverified.') + '</p>';
  };
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, hasEvidence, evidenced, unevidenced,
    evidenceNote, SOURCES, BASIS, MISSING };
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
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !FIT_BUYER.has(t) && !/^\d+$/.test(t));   // F-KW: a year or a number ("2026") is neutral, like a place; E-GATE: so is a buyer's word (cost, firm)
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
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    const carried = fitCarriedName(toks, topics);
    if (carried) return { ok: true, reason: '', detail: 'it names "' + carried + '", part of ' + label, share: 1 };
    // E-GATE (D4): the sentence names the words, not the keyword again (it read "... and the keywords you chose ("<the keyword itself>")")
    return { ok: false, reason: 'too broad', detail: (toks.length === 1 ? 'its one word, "' + toks[0] + '", is a category or a place' : 'it has only category or place words, ' + fitAnd(toks.map(t => '"' + t + '"'))) + ', so nothing in it points to ' + label, share: cats.length ? 0.5 : 0 };
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
function fitCareer(keyword, o) {
  o = o || {};
  const kw = fitLow(keyword).replace(/\s+/g, ' ').trim();
  const none = (why) => ({ career: false, points: 0, signals: [], detail: '', why });
  if (!kw) return none('no keyword');
  if (FIT_PRODUCT.test(' ' + kw + ' ') || FIT_BUYER_KW.test(' ' + kw + ' ')) return none('it carries a product or buyer word');
  const T = fitTopicWords((Array.isArray(o.topics) ? o.topics : [o.topics]).filter(t => t && fitTokens(t).length <= 6));
  const sellsJobs = [...T].some(w => /^(recruit|staff|hiring|headhunt|talent|job|career)/.test(w)), sellsCourses = [...T].some(w => /^(train|cours|educat|academ|certif|tutor)/.test(w));
  if (sellsJobs && sellsCourses) return none('this website sells recruitment and training');
  const isJob = (p) => !sellsJobs && (FIT_JOB_HOSTS.test(p.domain) || FIT_JOB_PATH.test(p.path) || FIT_JOB_TITLE.test(p.title));
  const isCourse = (p) => !sellsCourses && (FIT_COURSE_HOSTS.test(p.domain) || FIT_COURSE_PATH.test(p.path) || FIT_COURSE_TITLE.test(p.title));
  const pages = (o.pages || []).map(p => typeof p === 'string' ? { domain: p, url: '', title: '' } : (p || {}))
    .map(p => ({ domain: fitHost(p.domain || p.url || ''), path: String(p.url || '').replace(/^https?:\/\/[^/]+/i, ''), title: String(p.title || '') })).filter(p => p.domain).slice(0, 10);
  const careerDom = [...new Set(pages.filter(p => isJob(p) || isCourse(p)).map(p => p.domain))];
  const qs = [...new Set((o.paa || []).map(q => String(q || '').trim()).filter(q => q && ((!sellsJobs && FIT_JOB_Q.test(q)) || (!sellsCourses && FIT_COURSE_Q.test(q)))))];
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
  return { career: true, points, signals, why: '',
    detail: 'people searching it are mostly looking for work or training, not for a provider: ' + signals.join('; ') };
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
// Final keyword strategy: merges AI search demand and the live SERP checks into the ranked keyword set and renders the
// "Keyword Strategy" report. Also exposes keyword_suggestions for the downstream file/email/content steps.
// v4.8: with a website the report shows each keyword's difficulty for this site and plan ("Easy for your site · Direct plan · 2-4 months");
// a priority keyword the site already ranks 1-20 for (live check) counts as easy.
// 2026-10-11: D26 — an AI Overview is an observation: the stored results page (DataForSEO's database) and the live check are two checks
// ("seen in 1 of 2 checks"), each with its time; G3 — the 2025 base rate and the chance band next to every plan.
const base = $('Rank Keywords').first().json;
const ks = JSON.parse(JSON.stringify(base.keyword_strategy || {}));
const prio = $('Priority Keywords').all().map(i => i.json);
const serps = $input.all().map(i => i.json);
let aiRes = null; try { aiRes = $('AI Demand Answers').first().json; } catch (e) { aiRes = null; }

// ---- AI search demand (ChatGPT & co) ----
const aiMap = new Map(); let aiAvailable = false, aiError = '';
if (aiRes) {
  const t = (aiRes.tasks || [])[0] || {};
  if (aiRes.error || t.status_code >= 40000) aiError = (aiRes.error && aiRes.error.message) || t.status_message || 'no data';
  else {
    const r0 = (t.result || [])[0];
    const items = r0 && Array.isArray(r0.items) ? r0.items : (Array.isArray(t.result) ? t.result : []);
    for (const it of items) { if (it && it.keyword) { aiMap.set(String(it.keyword).toLowerCase(), it.ai_search_volume ?? null); } }
    aiAvailable = aiMap.size > 0;
  }
}
const withAi = (k) => ({ ...k, ai_search_volume: aiMap.has(k.keyword) ? aiMap.get(k.keyword) : null });
ks.keywords = (ks.keywords || []).map(withAi);
ks.priority = (ks.priority || []).map(withAi);
ks.quick_wins = (ks.quick_wins || []).map(withAi);
ks.ai_demand = { available: aiAvailable, error: aiError, top: ks.keywords.filter(k => k.ai_search_volume).sort((a, b) => b.ai_search_volume - a.ai_search_volume).slice(0, 10).map(k => ({ keyword: k.keyword, ai_search_volume: k.ai_search_volume, google_volume: k.volume })) };

// ---- live SERP check for the priority keywords ----
const ours = String(base.domain || '').toLowerCase();
const normD = (d) => String(d || '').toLowerCase().replace(/^www\./, '');
// 2026-10-09: a failed check (DataForSEO 50000 "Internal Server Error." with HTTP 200, or an HTTP error) leaves the keyword
// unchecked (live: null, "not checked") and is listed under research_failures; it used to read as "no AI Overview, nobody ranks".
const serpErr = (s) => { s = s || {}; const t = (Array.isArray(s.tasks) ? s.tasks[0] : null) || {};
  return (s.error || Number(s.status_code) >= 40000 || !Array.isArray(s.tasks) || Number(t.status_code) >= 40000) ? String((s.error && (s.error.message || s.error)) || t.status_message || s.status_message || 'no answer').slice(0, 120) : ''; };
const liveFailures = [];
// E-GATE (2026-10-21, pre-launch run RV-11): "ai consultant" was labelled commercial, "buyers comparing providers" and Easy while its live results
// page was a job board and a certification course and the questions people also ask were about salary and becoming one. Each live check is now
// read for that (fitCareer in _fit_gate.js: the top 10 with their titles, the questions, and the research pool around the keyword, the kept
// keywords and the ones the gate refused as job searches); a career search says so in its reason and goes to the end of the list.
const careerRelated = [...(ks.keywords || []).map(k => k && k.keyword), ...(ks.refused || []).map(r => r && r.keyword)].filter(Boolean);
const careerTopics = [...((ks.service_fit || {}).declared_services || []), ...(base.services || []), ...(base.seeds || [])].map(x => String(x || '').trim()).filter(Boolean);
const liveUrlsBy = new Map();   // G8 / K7: the full top 10 of every keyword this run checked live
prio.forEach((p, i) => {
  const err = serpErr(serps[i]);
  if (err) { const k0 = ks.priority.find(x => x.keyword === p.keyword); if (k0) { k0.live = null; liveFailures.push('Live Google check for "' + p.keyword + '": ' + err); } return; }
  const res = serps[i]?.tasks?.[0]?.result?.[0] || {};
  const items = res.items || [];
  const organic = items.filter(x => x.type === 'organic');
  const mine = ours ? organic.find(o => normD(o.domain) === ours || normD(o.domain).endsWith('.' + ours)) : null;
  liveUrlsBy.set(String(p.keyword || '').toLowerCase(), organic.filter(o => !(Number(o.rank_group) > 10)).map(o => o.url).filter(Boolean));
  const k = ks.priority.find(x => x.keyword === p.keyword);
  if (!k) return;
  // B1-5 / K4 (2026-10-15): the ten pages Google chose are the evidence for what KIND of page wins this search; until today only
  // their domains were kept and the page type came from the AI label alone.
  k.live = { top_domains: [...new Set(organic.map(o => normD(o.domain)).filter(Boolean))].slice(0, 5), your_position: mine ? mine.rank_group : null, checked_at: serpSeenAt(serps[i]),
    page_types: KWI.serpPageTypes(organic.filter(o => !(Number(o.rank_group) > 10)).map(o => ({ url: o.url, title: o.title })), { page_type: k.page_type }),
    features: [...new Set(items.map(x => x.type))].filter(t => t !== 'organic'), ai_overview: items.some(x => x.type === 'ai_overview'), paa: (items.find(x => x.type === 'people_also_ask') || { items: [] }).items.slice(0, 4).map(q => q.title || q.question).filter(Boolean) };
  const car = fitCareer(k.keyword, { pages: organic.filter(o => !(Number(o.rank_group) > 10)).map(o => ({ domain: o.domain, url: o.url, title: o.title })),
    paa: items.filter(x => x.type === 'people_also_ask').flatMap(x => (x.items || []).map(q => q.title || q.question)).filter(Boolean), related: careerRelated, topics: careerTopics });
  if (car.career) k.career = { detail: car.detail, signals: car.signals, points: car.points };
});
if (liveFailures.length) ks.research_failures = [...(ks.research_failures || []), ...liveFailures];
// ---- G8 / K7 (2026-10-13): the SERP-overlap clusters, recomputed with the live checks' full top 10 ----
// Rank Keywords could only use the competitors' ranking URLs; here every keyword that was checked live contributes its whole top 10,
// so the "one page can serve all of these" grouping rests on real results pages. Nothing extra is fetched.
const serpEntries = (ks.keywords || []).map(k => ({ keyword: k.keyword, weight: k.opportunity, volume: k.volume,
  urls: [...(liveUrlsBy.get(String(k.keyword || '').toLowerCase()) || []),
    ...(k.competitors || []).filter(c => c && c.url && Number(c.position) > 0 && Number(c.position) <= 10).map(c => c.url)] }));
const overlap = KWI.serpClusters(serpEntries, {});
ks.serp_clusters = overlap.clusters.slice(0, 15);
ks.serp_overlap = { keywords_compared: overlap.keywords_compared, clustered: overlap.clustered, min_shared_urls: overlap.min_shared_urls,
  live_checked: liveUrlsBy.size, source: liveUrlsBy.size ? 'live checks + competitor rankings' : 'competitor rankings' };
const serpHead = new Map();
for (const cl of ks.serp_clusters) for (const m of cl.keywords) serpHead.set(m.keyword, { head_keyword: cl.head_keyword, shared_urls: m.shared_urls, keyword_count: cl.keyword_count });
const tagSerp = (k) => { const h = serpHead.get(String(k.keyword || '').toLowerCase()); k.serp_cluster = (h && h.head_keyword !== k.keyword) ? h : null; return k; };
ks.keywords = (ks.keywords || []).map(tagSerp); ks.priority = (ks.priority || []).map(tagSerp); ks.quick_wins = (ks.quick_wins || []).map(tagSerp);
const cpcTxt = (c) => String(Math.round(Number(c) * 100) / 100);   // DataForSEO CPCs are float32 (13.65999984741211)
// D26: the AI Overview observations of a keyword — the stored results page (undated: DataForSEO's database) and, when checked, the live SERP.
// D20 (2026-10-12): the two are no longer averaged into one claim. The LIVE check speaks for today ("seen on <date>"); the stored Labs value has
// no date, so it is only ever reported as "historical" and never lets a card claim an AI Overview its own live check did not find.
const obsDay = (iso) => { const d = String(iso || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : 'an unknown date'; };
const aioObs = (k) => {
  const live = (k.live && k.live.ai_overview != null) ? { seen: !!k.live.ai_overview, at: k.live.checked_at, source: 'live check' } : null;
  const stored = (Array.isArray(k.serp_types) && k.serp_types.length) ? k.serp_types.includes('ai_overview') : null;
  const hist = stored == null ? '' : (stored ? 'the stored results page showed one (historical, undated)' : 'none in the stored results page (historical, undated)');
  if (!live) return { live: null, stored, count: 0, seen: 0, text: hist || 'unknown: the results page could not be read' };
  const o = aioObserved([live]);
  return { live: live.seen, stored, count: o.count, seen: o.seen, text: o.text + (hist ? '; ' + hist : '') };
};
const why = (k) => {
  const bits = [];
  if (k.service_fit === 'in') bits.push('it is part of what you sell');   // F-REH: the client's own services first, in the words of the card
  if (k.kd != null && k.kd < 30) bits.push('low competition');
  if (k.cpc != null && k.cpc >= 5) bits.push('high commercial value (CPC ' + cpcTxt(k.cpc) + ')');
  if (k.career) bits.push(k.career.detail + ', so a page for it would bring few buyers');   // E-GATE RV-11: the results page outranks the provider's intent label
  else if (k.intent === 'transactional') bits.push('buyers ready to act');
  else if (k.intent === 'commercial') bits.push('buyers comparing providers');
  else bits.push('research-stage traffic that builds authority');
  if (k.competitors_in_top20) bits.push(k.competitors_in_top20 + ' competitor(s) already rank for it');
  const ao = aioObs(k);   // D20: only the live check may claim an AI Overview; the undated stored value is named as historical
  if (ao.live === true) bits.push('an AI Overview was seen on ' + obsDay(k.live.checked_at) + ' (they vary between searches), so write a quotable answer block');
  else if (ao.live == null && ao.stored === true) bits.push('the stored results page showed an AI Overview (historical, undated, not checked live)');
  if (k.live && k.live.your_position) bits.push('you are already at #' + k.live.your_position);
  // K4: what Google ranks settles the page type; a disagreement with the plan is said out loud, never silently overridden
  if (k.live && k.live.page_types && k.live.page_types.read) bits.push(k.live.page_types.text.replace(/\.$/, ''));
  // G8 / K2: say when the traffic number is the site's own measurement rather than a model, and K7: when one page can serve more searches
  if (k.traffic_basis === 'calibrated' && k.gsc) bits.push('Search Console already measured ' + Math.round(Number(k.gsc.impressions) || 0) + ' impressions for this exact search on your site in ' + (Number(k.gsc.period_days) || 28) + ' days, so the traffic number below is calibrated, not modelled');
  if (k.serp_cluster) bits.push('the same pages rank for "' + k.serp_cluster.head_keyword + '" (' + k.serp_cluster.shared_urls + ' shared top-10 results), so one page can target both');
  return bits.join('; ') + '.';
};
ks.priority.forEach(k => { k.why = why(k); });
// E-GATE RV-11: a career search is kept (it is real data) but never leads: it goes to the end of the list, and it is never the keyword to start with
const careerKws = ks.priority.filter(k => k.career).map(k => k.keyword);
if (careerKws.length) ks.priority = [...ks.priority.filter(k => !k.career), ...ks.priority.filter(k => k.career)];
if (careerKws.length && ks.pipeline_keyword && careerKws.includes(ks.pipeline_keyword.keyword)) {
  const was = ks.pipeline_keyword.keyword; const alt = ks.priority.find(k => !k.career && k.service_fit !== 'out' && !k.covered_by) || null;
  ks.pipeline_keyword = alt ? { ...alt, career_note: '"' + was + '" was the first pick, but people searching it are mostly looking for work or training, so "' + alt.keyword + '" is the one to start with' } : null;
}
// v4.8: the live position upgrades the label (already top 20 = easy; a top-20 position also shortens the months)
const RR = ks.reach || null;
// B1-1: the upgrade keeps the reach the keyword was really measured against (its topic's, where there was one), so a live top-20
// position never quietly swaps the topic measurement back for the site-wide number.
if (RR) ks.priority.forEach(k => { const p = k.live && k.live.your_position; if (p && p <= REACH_CFG.easy_position) { const rUsed = k.reach_used != null ? k.reach_used : RR.reach;
  const diff = difficultyForYou(k.kd, rUsed, { position: p }); const plan = reachPlan(diff, reachStrong(RR, p), reachMeasured(RR, p));
  Object.assign(k, { difficulty_for_you: diff, plan_type: plan.plan_type, months: plan.months, for_you_label: reachLabel(diff, plan), reach_used: rUsed }); } });

// ---- compatibility object for the file, email and content-pipeline steps ----
let pipeline = ks.pipeline_keyword ? withAi(ks.pipeline_keyword) : null;
if (pipeline) { const enriched = ks.priority.find(k => k.keyword === pipeline.keyword); pipeline = enriched ? { ...enriched, ...(pipeline.trend_note ? { trend_note: pipeline.trend_note } : {}), ...(pipeline.ladder_note ? { ladder_note: pipeline.ladder_note } : {}) } : { ...pipeline, why: why(pipeline) }; ks.pipeline_keyword = pipeline; }   // R51: the falling label survives the enrichment
// F-REH (2026-10-20, real-credit rehearsal): the list a non-technical owner picks from starts with what they sell. The start-with pick first
// (Rank Keywords never picks a keyword that is not one of their services), then the priority keywords in, unknown, out order of service fit
// (stable: the opportunity order within each); an `out` keyword stays in the list, last, and says why.
const FIT_ORDER = { in: 0, unknown: 1, out: 2 };
const recommended = [];
if (pipeline) recommended.push({ ...pipeline, reason: 'best fit for the goal "' + ks.goal + '"' + (pipeline.service_fit === 'in' ? ' among the services you listed' : '') });
ks.priority.map((k, i) => [k, i]).sort((a, b) => (FIT_ORDER[a[0].service_fit] ?? 1) - (FIT_ORDER[b[0].service_fit] ?? 1) || a[1] - b[1])
  .forEach(([k]) => { if (!recommended.some(r => r.keyword === k.keyword)) recommended.push(k.service_fit === 'out' ? { ...k, reason: 'not one of the services you listed' } : k); });
const keyword_suggestions = { covered: ks.covered || [], ladder_covered: ks.ladder_covered || [], recommended, easy_wins: ks.quick_wins, by_intent: ks.by_intent, topic_clusters: (ks.clusters || []).map(c => ({ topic: c.topic, total_volume: c.total_volume, keyword_count: c.keyword_count, suggested_page: c.page_type, keywords: (c.keywords || []).map(k => k.keyword) })), total_found: ks.total_relevant,
  // G8: the searches the site already gets impressions for (K6) and the groups one page can serve (K7)
  search_console: ks.search_console || null, serp_clusters: (ks.serp_clusters || []).map(c => ({ head_keyword: c.head_keyword, keyword_count: c.keyword_count, keywords: (c.keywords || []).map(k => k.keyword), shared_urls: c.min_shared_urls })),
  // G32: the topic radius, so the app and the content steps see the same verdicts as the report
  topic_radius: ks.topic_radius || null };

// ---- report ----
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-GB');
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const kdLabel = (v) => v == null ? '—' : v + (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard');
const feat = (k) => { const t = k.serp_types || []; const f = []; if (t.includes('ai_overview')) f.push('AI Overview'); if (t.includes('featured_snippet')) f.push('Snippet'); if (t.includes('video') || t.includes('short_videos')) f.push('Video'); if (t.includes('local_pack') || t.includes('map')) f.push('Local pack'); if (t.includes('people_also_ask')) f.push('PAA'); if (t.includes('shopping') || t.includes('popular_products')) f.push('Shopping'); return f.join(', ') || '—'; };
const trend = (k) => k.trend_yearly == null ? '—' : (k.trend_yearly > 0 ? '+' : '') + k.trend_yearly + '%';
const table = (list, cols) => list.length ? '<table class="t"><tr>' + cols.map(c => '<th>' + c[0] + '</th>').join('') + '</tr>' + list.map(k => '<tr>' + cols.map(c => '<td>' + c[1](k) + '</td>').join('') + '</tr>').join('') + '</table>' : '<p class="muted">Nothing with measurable demand in this group.</p>';
const FY = { easy: 'Easy', reachable: 'Reachable', hard: 'Hard', very_hard: 'Very hard', not_realistic: 'Not realistic' };
const chanceTxt = (k) => !(k.chance && k.chance.label) ? '' : k.chance.band === 'unmeasured' ? ', ' + esc(k.chance.label) : ', ' + esc(k.chance.band) + ' chance (' + k.chance.range[0] + '-' + k.chance.range[1] + '%, uncalibrated)';   // R49: no band on an unmeasured reach
// B1-1: a label measured on the topic itself says so, with the difficulty it was measured against; everything else is the site-wide number
const basisTxt = (k) => k.reach_basis === 'topic' && k.topic_reach != null ? ', measured on this topic (difficulty ' + k.topic_reach + ')' : '';
const forYouCell = (k) => k.difficulty_for_you ? esc(FY[k.difficulty_for_you] || k.difficulty_for_you) + (k.months ? '<br><span class="muted">' + esc(({ direct: 'direct', short: 'short ladder', full: 'full ladder' })[k.plan_type] || '') + ', ' + esc(k.months) + ' mo' + chanceTxt(k) + esc(basisTxt(k)) + '</span>' : '') : '—';
const KW0 = [['Keyword', k => esc(k.keyword)], ['Searches/mo', k => num(k.volume)], ['Difficulty', k => kdLabel(k.kd)], ['CPC $', k => k.cpc == null ? '—' : cpcTxt(k.cpc)], ['Intent', k => cap(k.intent)], ['Trend', k => trend(k)], ['SERP features', k => feat(k)], ['Opportunity', k => num(k.opportunity)]];
const KW = RR ? [...KW0.slice(0, 3), ['For your site', forYouCell], ...KW0.slice(3)] : KW0;
// B1-1 / B1-2 (2026-10-15, benchmark area 1): the site-wide reach now says WHAT it was measured on, and the line states how many of
// the topics below could be measured on their own topic instead. A number measured on other topics is weaker evidence for this one.
const measuredOnTxt = !RR ? '' : (RR.measured_on || []).length
  ? ' That number comes from the searches you already win — ' + RR.measured_on.slice(0, 4).map(k => '"' + k + '"').join(', ') + (RR.measured_on.length > 4 ? ' and others' : '') + '.'
  : (RR.evidence_note ? ' ' + RR.evidence_note + '.' : '');
const topicReachTxt = !RR ? '' : (RR.topics_measured
  ? ' ' + RR.topics_measured + ' of the ' + RR.topics_total + ' topics below were measured on their OWN topic (the difficulty you have already beaten on it); the rest use the site-wide number above, which is the optimistic case for a topic you have no record on.'
  : ' No topic below has the ' + REACH_CFG.min_top10 + ' top-10 keywords of its own that measuring a topic needs, so every "for your site" label uses the site-wide number — treat it as the optimistic case for a topic you have no record on.');
const reachLine = RR ? 'Your site\'s reach: difficulty ' + RR.reach + ' (' + (RR.method === 'percentile' ? '75% of the ' + RR.sample + ' keywords you rank top 10 for are at or below it' : 'from ' + num(RR.top10) + ' keyword(s) in the top 10') + (RR.cached ? ', measured ' + String(RR.cached_at || '').slice(0, 10) : '') + ').' + measuredOnTxt + topicReachTxt + ' "For your site": easy up to reach + 5 or already top 20, reachable up to + 20, hard up to + 40. Months and the chance band per plan are estimates (the chance is uncalibrated until this system has measured its own ladders). ' + reachBaseRateText() : '';
// 2026-10-12 (FIX_PLAN D11): a keyword a live page of the site already answers is named with that page, so nobody writes a second one
const coveredLine = (ks.covered || []).length ? (ks.covered.length === 1 ? 'One keyword below is' : ks.covered.length + ' keywords below are') + ' already answered by a page you have: ' + ks.covered.slice(0, 5).map(c => '"' + esc(c.keyword) + '" \u2192 <a href="' + esc(c.url) + '">' + esc(c.url) + '</a>').join(', ') + '. Refresh those pages instead of writing new ones \u2014 two pages for one search split the signals and neither ranks.' : '';
// 2026-10-12 (FIX_PLAN D20): a keyword one of the site's own keyword ladders already covers is named with that ladder, so the top pick never
// competes with a ladder that is already running one search, one page.
const ladderLine = (ks.ladder_covered || []).length ? (ks.ladder_covered.length === 1 ? 'One keyword below is' : ks.ladder_covered.length + ' keywords below are') + ' already covered by a keyword ladder of yours: ' + ks.ladder_covered.slice(0, 5).map(c => '"' + esc(c.keyword) + '" \u2192 ladder "' + esc(c.head_keyword) + '" (' + esc(c.how) + ', ' + (c.part === 'head' ? 'its main page' : 'rung ' + c.rung) + ', ' + esc(c.status || 'planned') + ')').join(', ') + '. Let that ladder finish \u2014 two pages for one search split the signals and neither ranks.' : '';
// A-24 (2026-10-17): 224 of 240 reviewed keywords were off-topic (a job board's rankings) and the header only printed "16 relevant".
// Below a quarter relevant the report says the pool was mostly off-topic and where most of it came from, so the lists read as thin.
const poolLine = (() => { const rv = Number(ks.ai_reviewed) || 0, ok = Number(ks.total_relevant) || 0; if (rv < 40 || ok / rv >= 0.25) return '';
  const src = Object.entries(ks.by_source || {}).sort((a, b) => b[1] - a[1])[0];
  return 'Only ' + ok + ' of the ' + rv + ' keywords reviewed fit your business: the research pool was mostly off-topic' + (src ? ' (its largest source: ' + src[0] + ', ' + src[1] + ' keywords)' : '') + ', so the lists below are thin - add your own seed keywords or declare your competitors to widen them.'; })();
const refusedLine = (ks.refused || []).length ? ks.refused.length + ' keyword(s) were left out as government, portal or other companies\' brand searches (e.g. ' + ks.refused.slice(0, 5).map(r => '"' + esc(r.keyword) + '" — ' + esc(r.reason)).join(', ') + ').' : '';
// ---- G8 (2026-10-13): the three new inputs in the report ----
// K2: every traffic number says whether the site's own Search Console data could check it
// B1-3: a keyword the provider has no volume for has no traffic estimate at all, and the cell says so instead of printing "~—/mo"
const tpCell = (k) => k.traffic_potential == null ? 'not estimated (no volume measured)' : '~' + num(k.traffic_potential) + '/mo' + (k.traffic_basis === 'calibrated' ? ' (calibrated with your data)' : k.traffic_basis === 'modelled' ? ' (modelled)' : '');
const SC = ks.search_console || null;
const scRows = SC ? (SC.queries || []) : [];
const scTable = (list) => table(list, [['Search', q => esc(q.keyword)], ['Impressions (' + ((SC && SC.period_days) || 28) + ' days)', q => num(q.impressions)], ['Clicks', q => num(q.clicks)],
  ['Your position', q => q.position == null ? 'not reported' : '#' + q.position],
  // R12 (2026-10-13): the reason comes from the kit (KWI.gscSeeds), so a row that names a live page of ours can never read
  // "no page of yours answers this search" — it reads that the page getting the impressions targets something else
  ['Why it is here', q => esc(q.why || (q.kinds.includes('no_page') ? 'no page of yours answers this search' : 'you rank #' + q.position + ' — striking distance'))
    + (q.kinds.includes('no_page') && (SC && SC.page_check) === 'search console page' ? ' (judged on the page Search Console reports, no page list on file yet)' : '')],
  ['Page that gets the impressions', q => q.page ? '<a href="' + esc(q.page) + '">' + esc(String(q.page).replace(/^https?:\/\/[^/]+/, '') || '/') + '</a>' : '—']]);
const scLine = !SC ? '' : (SC.available
  ? (SC.seeded || []).length + ' of your own Search Console searches were used as research seeds (the ' + ((SC.no_page || []).length) + ' with impressions and no page of their own, '
    + ((SC.mismatch || []).length ? 'the ' + (SC.mismatch || []).length + ' a live page of yours already earns the impressions for while targeting something else, ' : '')
    + 'and the ' + ((SC.striking || []).length) + ' where you rank ' + SC.striking_min + '-' + SC.striking_max + '), measured in the 28 days to ' + esc(String(SC.period_end || '').slice(0, 10)) + '. ' + (SC.dropped ? 'Left out: ' + (SC.dropped.brand || 0) + ' brand searches, ' + (SC.dropped.scraper || 0) + ' typed by SEO tools, ' + (SC.dropped.low_impressions || 0) + ' under ' + SC.min_impressions + ' impressions.' : '')
  : 'No Search Console history is stored for this website yet, so the research started from the business description and the site itself. Connect Search Console (or let one weekly tracker run finish) and the next research will start from the searches you already appear for.');
// K7: the searches Google answers with the same pages
const SO = ks.serp_overlap || null;
const serpClusterHtml = (ks.serp_clusters || []).length
  ? '<p class="muted">Google answers these searches with the same pages (at least ' + ((SO && SO.min_shared_urls) || 3) + ' shared top-10 results, from ' + esc((SO && SO.source) || 'the results pages this run read') + '). One page per group: a second page for the same results page only splits the signals.</p>'
    + (ks.serp_clusters || []).slice(0, 8).map(c => '<div class="card"><div class="kw">' + esc(c.head_keyword) + '</div><p class="muted">' + esc(KWI.clusterText(c)) + '</p><p>'
      + (c.keywords || []).map(k => '<span class="pill">' + esc(k.keyword) + (k.volume == null ? '' : ' · ' + num(k.volume) + '/mo') + '</span>').join('') + '</p></div>').join('')
  : '<p class="muted">No two keywords shared ' + ((SO && SO.min_shared_urls) || 3) + ' or more of their top-10 results' + (SO && SO.keywords_compared ? ' among the ' + SO.keywords_compared + ' whose results pages this run read' : '') + ', so every topic below needs its own page.</p>';
// G32 / K12: the site's topic radius — which topics are within reach today, which are a stretch, and the evidence behind each verdict
// (built in Rank Keywords by v5/code/_radius.js; every row carries its own label, so this only lays the data out)
const RAD_PILL = { in_reach: 'now', stretch: 'next', far: 'later' };
const rad = ks.topic_radius || null;
const radRows = rad ? [...(rad.in_reach || []), ...(rad.stretch || []), ...(rad.far || [])] : [];
const radiusHtml = !radRows.length ? '' : '<h2>Your topic radius: what is within reach and what is a stretch</h2>'
  + '<p class="muted">' + esc(rad.summary) + '</p>'
  + '<table class="t"><tr><th>Topic</th><th>Verdict</th><th>Why</th><th>On what evidence</th></tr>'
  + radRows.slice(0, 25).map(t => '<tr><td><b>' + esc(cap(t.topic)) + '</b><br><span class="muted">' + esc(t.primary_keyword) + '</span></td>'
    + '<td><span class="pill ' + (RAD_PILL[t.verdict] || 'later') + '">' + esc(t.verdict_label) + '</span></td><td>' + esc(t.reason) + '</td>'
    + '<td class="muted">' + esc((t.evidence || []).join('; ')) + '</td></tr>').join('')
  + '</table><p class="muted">' + esc(rad.note) + '</p>';
const goalText = { leads: 'enquiries and leads', sales: 'online sales', traffic: 'traffic and authority', brand: 'brand awareness' }[ks.goal] || ks.goal;
const now = (ks.clusters || []).filter(c => c.tier === 'Now'), next = (ks.clusters || []).filter(c => c.tier === 'Next'), later = (ks.clusters || []).filter(c => c.tier === 'Later');
const seeds = (base.seeds || []).slice(0, 10);

// ---- B-L2 (2026-10-15, INVARIANTS rule 1, lineage_lint.py "lineage"): the keyword strategy prints searches per month,
// difficulty and cost per click as if they were facts about this site. They are the provider's ESTIMATES for a single keyword —
// the methodology paragraph said so in prose, which no table of numbers inherits, and when the strategy ships on its own (the
// "Keyword Strategy" document, the ideas callback) the full report's "Where these numbers come from" table was not there at all.
// The same table is now part of this document, and it travels in the returned json so the app shows the same words.
const today = new Date().toISOString().slice(0, 10);
const kwCount = (ks.keywords || []).length;
const calibrated = (ks.keywords || []).filter(k => k.traffic_basis === 'calibrated').length;
const liveDone = (ks.live_checks || {}).done != null ? (ks.live_checks || {}).done : prio.length;
const lineage = [
  LN.of('Searches per month, difficulty and cost per click', 'kwdata', { basis: 'estimated', period: 'the provider\'s latest 12-month average',
    sample: LN.sample(kwCount, 'keywords'), note: 'a provider estimate for one keyword in ' + String(base.country || '') + ', not a measurement of your site: a single keyword\'s volume and difficulty can be well off, and the ranking below uses them together, never one on its own' }),
  LN.of('Traffic potential per keyword', calibrated ? 'gsc' : 'model', { basis: calibrated ? 'calibrated' : 'modelled', period: calibrated ? 'the last 28 days, scaled to a month' : 'per month, once the page ranks',
    sample: LN.sample(kwCount, 'keywords, ' + calibrated + ' of them calibrated against your own Search Console data'),
    note: 'searches after results-page click loss x a top-3 click share; every number carries its own "calibrated" or "modelled" label' }),
  liveDone
    ? LN.of('Who ranks now, results-page features, AI Overview and your position', 'serp', { basis: 'one_sample', period: LN.asOf(today),
        sample: LN.sample(liveDone, 'keywords checked live on Google'), note: 'one results page per keyword at one moment, from ' + String(base.country || 'the chosen country') + ' on one device; every other keyword is marked "not checked", never "nobody ranks"' })
    : LN.unknown('Who ranks now, results-page features, AI Overview and your position', 'no live results page was read in this run'),
  (SC && SC.available)
    ? LN.of('Searches your website already appears for', 'gsc', { basis: 'measured', period: 'the 28 days to ' + String((SC && SC.period_end) || '').slice(0, 10),
        sample: LN.sample(scRows.length, 'searches'), note: 'Google\'s own count for your property; the last 3 days are not final' })
    : LN.unknown('Searches your website already appears for', 'no Search Console history is stored for this website yet'),
  ks.ai_demand && ks.ai_demand.available
    ? LN.of('AI search demand', 'ai_db', { basis: 'reported', period: LN.asOf(today), sample: LN.sample((ks.ai_demand.top || []).length, 'keywords with AI demand'),
        note: 'how often these keywords are asked in AI assistants, as the AI-answer database reports it' })
    : LN.unknown('AI search demand', String((ks.ai_demand && ks.ai_demand.error) || 'the AI keyword database returned nothing for this run')),
  RR
    ? LN.of('Difficulty for your site and the plan type', 'model', { basis: 'modelled', period: LN.asOf(today), sample: 'your site\'s reach ' + String(RR.reach == null ? 'unknown' : RR.reach),
        note: 'your reach against each keyword\'s difficulty; the month ranges are modelled from published base rates, not from your own history yet' })
    : LN.unknown('Difficulty for your site and the plan type', 'no website was given for this research, so difficulty is the provider\'s number and not yours'),
];
const lineageHtml = '<h2>Where these numbers come from</h2>'
  + '<table class="t"><tr><th>Figure</th><th>Source</th><th>Period</th><th>Sample</th><th>How it was arrived at</th></tr>'
  + lineage.map(l => '<tr><td>' + esc(l.figure) + '</td><td>' + esc(l.source_label) + '</td><td>' + esc(l.period || '—') + '</td><td>' + esc(l.sample || '—') + '</td><td>' + esc([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
  + '</table><p class="muted">A figure marked "' + esc(LN.BASIS.modelled) + '" is computed, not counted; "' + esc(LN.BASIS.estimated) + '" is the data provider\'s own estimate for a single keyword; "' + esc(LN.MISSING) + '" means the figure reached this report without its source and should be treated as unverified.</p>';

const html = `
<style>
  .w{font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#1e293b;text-align:left;line-height:1.55;padding:24px 20px}
  h1{font-size:25px;margin:0 0 4px;color:#0f172a} h2{font-size:17px;color:#1e3a8a;margin:28px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px} h3{font-size:14px;color:#334155;margin:16px 0 6px}
  .muted{color:#64748b;font-size:13px} .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:10px 0}
  .kw{font-size:17px;font-weight:bold;color:#0f172a} .pill{display:inline-block;background:#e0e7ff;color:#1e3a8a;border-radius:20px;padding:2px 10px;font-size:12px;margin:2px 6px 2px 0}
  .pill.ai{background:#fef3c7;color:#92400e} .pill.now{background:#dcfce7;color:#166534} .pill.next{background:#e0f2fe;color:#075985} .pill.later{background:#f1f5f9;color:#475569}
  .t{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0} .t th{background:#1e3a8a;color:#fff;text-align:left;padding:7px} .t td{border:1px solid #e2e8f0;padding:7px;vertical-align:top}
  .callout{border-left:4px solid #1e3a8a;background:#f1f5f9;padding:10px 14px;margin:12px 0} .by{color:#64748b;font-size:12px;margin-top:24px}
</style>
<div class="w">
  <h1>Keyword strategy${base.domain ? ' for ' + esc(base.domain) : ''}</h1>
  <p class="muted">${esc(base.country)} · goal: ${esc(goalText)} · ${num(ks.pool_size)} keywords researched from ${num(base.research && base.research.requests)} data pulls · ${num(ks.ai_reviewed)} screened for relevance by AI · ${num(ks.total_relevant)} relevant</p>
  ${poolLine ? '<p class="muted"><b>' + esc(poolLine) + '</b></p>' : ''}${reachLine ? '<p class="muted">' + esc(reachLine) + '</p>' : ''}${refusedLine ? '<p class="muted">' + refusedLine + '</p>' : ''}${coveredLine ? '<p class="muted">' + coveredLine + '</p>' : ''}${(ks.title_gap && ks.title_gap.untitled) ? '<p class="muted">' + esc(ks.title_gap.note) + ': a page among them may already answer a search below.</p>' : ''}${ladderLine ? '<p class="muted">' + ladderLine + '</p>' : ''}

  <div class="callout"><b>Where to start:</b> ${pipeline ? '"' + esc(pipeline.keyword) + '" — ' + num(pipeline.volume) + ' searches/mo, difficulty ' + kdLabel(pipeline.kd) + ', ' + esc(pipeline.intent) + ' intent, best page: ' + esc(pipeline.page_type) + '. ' + (pipeline.for_you_label ? esc(pipeline.for_you_label) + '. ' : '') + (pipeline.trend_note ? '<b>Searches ' + esc(pipeline.trend_note) + '.</b> ' : '') + (pipeline.ladder_note ? '<b>Note: ' + esc(pipeline.ladder_note) + '.</b> ' : '') + esc(pipeline.why) : 'Not enough data to pick a first keyword.'}
  ${now.length ? '<br><b>Build first:</b> ' + now.map(c => esc(c.topic) + ' (' + esc(c.page_type) + ', ' + num(c.total_volume) + '/mo across ' + c.keyword_count + ' keywords' + (c.ladder_near ? '; ' + esc(c.tier_note) : '') + ')').join(' · ') : ''}</div>

  <h2>Priority keywords (${ks.priority.length}) — live-checked on Google</h2>
  ${liveFailures.length ? '<p class="muted">' + liveFailures.length + ' of ' + prio.length + ' live checks could not be made (the search data provider failed): those keywords show the stored SERP features and "not checked".</p>' : ''}
  ${ks.priority.map((k, i) => `<div class="card">
    <div class="kw">${i + 1}. ${esc(k.keyword)}</div>
    <p>${k.volume == null ? '<span class="pill">No provider volume — measured on your site instead</span>' : '<span class="pill">' + num(k.volume) + ' searches/mo</span>'}<span class="pill">Difficulty ${kdLabel(k.kd)}</span>${k.for_you_label ? '<span class="pill ' + (['easy', 'reachable'].includes(k.difficulty_for_you) ? 'now' : 'later') + '">' + esc(k.for_you_label) + '</span>' : ''}<span class="pill">${cap(k.intent)}</span><span class="pill">${esc(k.page_type)}</span>${k.cpc != null ? '<span class="pill">CPC $' + cpcTxt(k.cpc) + '</span>' : ''}${k.ladder_covered ? '<span class="pill later">Already in your ladder "' + esc(k.ladder_covered.head_keyword) + '"</span>' : ''}${k.serp_cluster ? '<span class="pill">Same results page as "' + esc(k.serp_cluster.head_keyword) + '"</span>' : ''}<span class="pill${k.traffic_basis === 'calibrated' ? ' now' : ''}">Traffic potential ${tpCell(k)}</span>${k.ai_search_volume ? '<span class="pill ai">AI search volume ' + num(k.ai_search_volume) + '/mo</span>' : ''}</p>
    <p>${esc(k.why)}</p>
    <p class="muted"><b>Topic:</b> ${esc(k.topic)} · <b>SERP features:</b> ${esc(k.live ? (k.live.features.join(', ') || 'none') : feat(k))}${k.live ? ' (live check at ' + esc(obsClock(k.live.checked_at)) + ')' : ' (stored results page)'} · <b>AI Overview:</b> ${esc(aioObs(k).text)} · <b>Who ranks now:</b> ${esc(k.live ? (k.live.top_domains.join(', ') || 'unknown') : 'not checked')}${k.live && k.live.page_types && k.live.page_types.read ? ' · <b>What Google ranks:</b> ' + esc(k.live.page_types.text) + (k.live.page_types.mismatch ? ' <span class="pill later">page type mismatch</span>' : '') : ''}${base.domain ? ' · <b>Your position:</b> ' + (k.live && k.live.your_position ? '#' + k.live.your_position : 'not in top 20') : ''}${k.live && k.live.paa.length ? '<br><b>People also ask:</b> ' + esc(k.live.paa.join(' · ')) : ''}</p>
  </div>`).join('') || '<p class="muted">No priority keywords could be determined.</p>'}

  <h2>Searches your website already appears for</h2>
  <p class="muted">${scLine}</p>
  ${scRows.length ? scTable(scRows.slice(0, 20)) : ''}
  ${(SC && SC.answered || []).length ? '<p class="muted">' + (SC.answered.length === 1 ? 'One other search is' : SC.answered.length + ' other searches are') + ' already answered by a page you have, so they were not seeded: ' + SC.answered.slice(0, 5).map(q => '"' + esc(q.keyword) + '" → <a href="' + esc(q.answered_by.url) + '">' + esc(String(q.answered_by.url).replace(/^https?:\/\/[^/]+/, '') || '/') + '</a>').join(', ') + '.</p>' : ''}

  <h2>Searches that share a results page</h2>
  ${serpClusterHtml}

  ${radiusHtml}

  <h2>Content plan by topic</h2>
  <p class="muted">One strong page per topic. "Now" = highest opportunity and ${RR ? 'easy or reachable for your site' : 'winnable difficulty'}; "Next" = plan for the following months; "Later" = long-term or hard.</p>
  ${(ks.clusters || []).length ? `<table class="t"><tr><th>Tier</th><th>Topic / page</th><th>Primary keyword</th><th>Page type</th><th>Keywords</th><th>Total searches/mo</th><th>Difficulty</th>${RR ? '<th>For your site</th>' : ''}</tr>` + (ks.clusters || []).slice(0, 25).map(c => `<tr><td><span class="pill ${c.tier.toLowerCase()}">${c.tier}</span></td><td><b>${esc(cap(c.topic))}</b><br><span class="muted">${esc((c.supporting || []).slice(0, 5).join(', '))}</span>${c.tier_note ? '<br><span class="muted">' + esc(c.tier_note) + '</span>' : ''}</td><td>${esc(c.primary_keyword)}</td><td>${esc(c.page_type)}</td><td>${c.keyword_count}</td><td>${num(c.total_volume)}</td><td>${kdLabel(c.primary_kd)}</td>${RR ? '<td>' + forYouCell(c) + '</td>' : ''}</tr>`).join('') + '</table>' : '<p class="muted">Not enough related keywords to form topics.</p>'}

  <h2>Quick wins (difficulty under 30, relevant, real demand)</h2>
  ${table(ks.quick_wins || [], KW)}

  <h2>Questions your buyers ask</h2>
  <p class="muted">Each is a guide, FAQ entry or section with a direct 40-60 word answer — the format AI Overviews and assistants quote.</p>
  ${table(ks.questions || [], KW.slice(0, 5))}

  <h2>Keywords competitors rank for and you should too</h2>
  <p class="muted">Competitors checked: ${esc((((ks.competitor_basis || {}).picked) || []).length ? ks.competitor_basis.picked.map(p => p.domain + (p.how ? ' (' + p.how + ')' : '')).join('; ') : ((ks.competitor_domains || []).join(', ') || 'none found'))}.${ks.competitor_basis && ks.competitor_basis.note ? ' How they were chosen: ' + esc(ks.competitor_basis.note) : ''}</p>
  ${table(ks.competitor_gaps || [], [...KW.slice(0, 5), ['Competitors in top 20', k => esc((k.competitors || []).map(c => c.domain + ' #' + c.position).slice(0, 3).join(', '))]])}

  <h2>Long-tail phrases (4+ words)</h2>
  ${table(ks.long_tail || [], KW.slice(0, 6))}

  ${ks.ai_demand.available ? '<h2>AI search demand</h2><p class="muted">How often these keywords are asked in AI assistants (DataForSEO AI keyword data) next to Google demand.</p>' + table(ks.ai_demand.top, [['Keyword', k => esc(k.keyword)], ['AI searches/mo', k => num(k.ai_search_volume)], ['Google searches/mo', k => num(k.google_volume)]]) : ''}

  ${['commercial', 'transactional', 'informational'].map(x => `<h2>${cap(x)} keywords</h2>${table((ks.by_intent || {})[x] || [], KW)}`).join('')}

  ${lineageHtml}

  <h2>How this was built</h2>
  <p class="muted">Seeds: ${esc(seeds.join(', '))}${SC && (SC.seeded || []).length ? ', plus your own Search Console searches: ' + esc(SC.seeded.slice(0, 10).join(', ')) : ''}. Sources: ${esc(Object.entries(ks.by_source || {}).map(([k, v]) => k + ' ' + v).join(', '))}. Opportunity = traffic potential (volume after SERP-feature click loss) × winnability (difficulty and top-10 link strength) × commercial value (CPC) × intent weight for your goal × trend, then multiplied by AI relevance (2 = core, 1 = adjacent, 0 = dropped). Traffic potential is <b>calibrated</b> where Search Console measured that exact search on your site (its impressions and clicks over 28 days, scaled to a month) and <b>modelled</b> everywhere else (the provider's monthly volume, typically 50-70% off for a single keyword) — the label is on every number. Click loss: a results page with an AI Overview is counted at ${Math.round(KWI.CLICK_LOSS.ai_overview.factor * 100)}% of the clicks, measured by ${esc(KWI.CLICK_LOSS.ai_overview.source)} (<a href="${esc(KWI.CLICK_LOSS.ai_overview.url)}">source</a>); the deductions for a featured snippet, video, a local pack and shopping results are stated rules, not measurements. ${prio.length} keyword${prio.length === 1 ? '' : 's'} were checked live on Google for intent and page type${(ks.live_checks || {}).cap ? ' (limit ' + ks.live_checks.cap + ' a run, about $' + ((ks.live_checks.cap * 0.002).toFixed(2)) + ' of search data)' : ''}.${(ks.research_failures || []).length ? ' Some data pulls failed: ' + esc(ks.research_failures.join('; ')) + '.' : ''}</p>
  <p class="by">Prepared by ${esc(base.brand || 'Dev SEO')} · Search volumes, difficulty, CPC and SERP features from DataForSEO for ${esc(base.country)}.</p>
</div>`;

// Options for the form-only "Choose your keyword" step (the number prefix makes the pick unambiguous)
const choice_options = ['Let the system choose for my goal', ...ks.priority.slice(0, 8).map((k, i) => (i + 1) + '. ' + k.keyword + ' · ' + num(k.volume) + ' searches/mo · difficulty ' + (k.kd == null ? '?' : k.kd) + ' · ' + cap(k.intent) + ' · ' + k.page_type + (k.for_you_label ? ' · ' + k.for_you_label : ''))];
return [{ json: { ...base, keyword_strategy: ks, keyword_suggestions, result_html: html, lineage, choice_options } }];
