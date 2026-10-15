// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

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
      const inv = matchPage(q);
      // R12 (2026-10-13, re-rating §3.11): 11 of 25 rows read "no page of yours answers this search" while the same row named a live
      // 200-OK page of the site — one of them ranking #6.2 — because only the slug / title match counted and the URL Search Console
      // itself reports was ignored whenever the inventory was non-empty. A URL on this site is evidence: it is the answering page, with
      // its own label ("the page that gets the impressions does not target this search"), so the report never asks the owner for a second
      // page for a search they already rank for (D11's cannibalisation rule, in the discovery path).
      const rowUrl = S(r.page);
      const rowBare = bare(rowUrl);
      const rowOnSite = !!rowUrl && !!rowBare && (!dom || rowBare === dom || rowBare.endsWith('.' + dom));
      const row_page = (rowUrl && (c.use_row_page || rowOnSite))
        ? { url: rowUrl, title: '', matched_by: c.use_row_page ? 'search console page' : 'impressions' } : null;
      const answered_by = inv ? { url: S(inv.url), title: S(inv.title), matched_by: S(inv.matched_by) || 'inventory' } : row_page;
      const kinds = [];
      if (!answered_by) kinds.push('no_page');
      else if (!inv && answered_by.matched_by === 'impressions') kinds.push('page_mismatch');
      const striking = position >= c.striking_min && position <= c.striking_max;
      if (striking) kinds.push('striking');
      const posTxt = position > 0 ? '#' + (Math.round(position * 10) / 10) : 'unreported';
      const why = kinds.indexOf('no_page') >= 0 ? 'no page of yours answers this search'
        : kinds.indexOf('page_mismatch') >= 0 ? 'the page that gets the impressions does not target this search'
          + (striking ? ' (you rank ' + posTxt + ' with it — striking distance)' : ' (you rank ' + posTxt + ' with it)')
          : striking ? 'you rank ' + posTxt + ' — striking distance' : 'a page of yours already answers this search';
      considered.push({ keyword: q, impressions, clicks, position: position > 0 ? Math.round(position * 10) / 10 : null,
        ctr: impressions ? Math.round(clicks / impressions * 1000) / 10 : 0, page: rowUrl, answered_by, kinds, why,
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
      answered: considered.filter(q => !q.kinds.length && q.answered_by).slice(0, 20),
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
  const SHAPES = [
    { type: 'Government or official', test: (u, t, d) => /(^|\.)(gov|gov\.[a-z]{2}|gob|govt)(\.|$)/.test(d) || /\.gov($|\.)/.test(d) },
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
    for (const head of ranked) {
      if (used.has(head.keyword)) continue;
      const hs = new Set(head.urls); const members = [];
      for (const other of ranked) {
        if (other.keyword === head.keyword || used.has(other.keyword)) continue;
        const shared = other.urls.filter(u => hs.has(u));
        if (shared.length >= need) members.push({ keyword: other.keyword, volume: other.volume, shared_urls: shared.length, shared: shared.slice(0, 3) });
      }
      if (!members.length) continue;
      used.add(head.keyword); members.forEach(m => used.add(m.keyword));
      members.sort((a, b) => b.shared_urls - a.shared_urls || (b.volume || 0) - (a.volume || 0));
      clusters.push({ head_keyword: head.keyword, keyword_count: members.length + 1, urls_compared: head.urls.length,
        min_shared_urls: need, top_n: depth, min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
        total_volume: [head, ...members].reduce((s, m) => s + (num(m.volume) || 0), 0),
        keywords: [{ keyword: head.keyword, volume: head.volume, shared_urls: head.urls.length, shared: [] }, ...members].slice(0, c.max_cluster_keywords) });
    }
    clusters.sort((a, b) => b.keyword_count - a.keyword_count || b.total_volume - a.total_volume);
    return { clusters, keywords_compared: ranked.length, min_shared_urls: need, min_urls: c.min_urls, top_n: depth,
      min_overlap_pct: depth && (num(c.min_overlap) || 0) > 0 ? Math.round(c.min_overlap * 100) : null,
      clustered: clusters.reduce((n, x) => n + x.keyword_count, 0) };
  };
  // "one page can serve all three: 'erp software uae' also covers 'erp system uae' (4 of the same top-10 pages), ..."
  const clusterText = (cl) => {
    const c = cl || {}; const others = (c.keywords || []).slice(1);
    if (!others.length) return '';
    const depthTxt = c.top_n ? 'top ' + c.top_n : 'top-10';
    return 'One page can target all ' + c.keyword_count + ': "' + c.head_keyword + '" shares '
      + others.map(k => k.shared_urls + ' of its ' + depthTxt + ' pages with "' + k.keyword + '"').join(', ')
      + ' - Google answers these searches with the same pages, so a second page would only split the signals.';
  };
  return { CFG, CLICK_LOSS, gscSeeds, calibrate, serpClusters, clusterText, featureLoss, lossApplied, lossText, serpPageTypes, shapeOf, liveChecks, ladderChecks, checkCost, urlKey, BASIS_TEXT, helpers: { bare, low, num } };
})();
const prev = $('Merge Keyword Data').first().json;
const verdict = parseAgentJson($input.first().json.output);

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
// 2026-10-12 (FIX_PLAN D10): the verdict answers in free text; the fixed option decides the length band, the schema and
// meta.json, and the sentence itself travels on as page_notes so the brief still hears what the verdict asked for.
const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];
if (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';

// ---- a keyword the site already has a page for (P2-5, 2026-10-12; inlined into the v3 node *Parse Verdict* by build_v4.py section 39) ----
// Run 444 asked for a verdict on "uae e invoicing penalties" — a search the site's own /insights/…-uae-e-invoicing-penalties-… page has
// answered since 2026-08-21 — and the answer was "Build an informational penalty guide", recommended_page "Guide": the owner was told to
// create a second URL for a search their page already answers (the exact D11 harm). *Collect Client Pages* now sets `existing_page` from
// the page inventory (SM.matchPage) and `v5/prompts/verdict.txt` forbids a new page; this is the deterministic half of it.
// ---- R7 (2026-10-13, re-rating): no verdict may ask for FAQPage schema (G2 removed it from everything we write) ----
// Live: exec 486 `verdict_changes[3]` said "add … an FAQ with schema matching the People Also Ask questions" and the ladder's exec 495
// `what_must_change[3]` said "Add an FAQ section that mirrors the People Also Ask questions, with FAQ and Service schema". Google stopped
// showing FAQ rich results on 2026-05-07, so the owner would spend time on markup that shows nothing. The prompt now forbids it; this
// rewrites the schema part out of any line that still asks for it and keeps the FAQ *section*, which is what AI assistants quote.
const FAQ_SCHEMA_RE = /\b(?:faq\s*page|faqpage)\b(?:\s+(?:schema|markup|structured\s+data))?|\bfaq\b[^.;]{0,20}?\b(?:schema|markup|structured\s+data)\b|\b(?:schema|markup|structured\s+data)\b[^.;]{0,20}?\bfaq\b/gi;
const noFaqSchema = (line) => {
  let t = String(line == null ? '' : line);
  if (!FAQ_SCHEMA_RE.test(t)) return t;
  FAQ_SCHEMA_RE.lastIndex = 0;
  t = t.replace(/\b(an?\s+)?FAQ\s+with\s+(?:its\s+own\s+)?(?:schema|markup|structured data)\b/gi, '$1FAQ section (question headings answered directly)')
       .replace(/\bwith\s+FAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, 'with $1 schema')
       .replace(/\bFAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, '$1 schema')
       .replace(/\b(?:an?\s+)?FAQ\s*(?:page)?\s+(?:schema|markup|structured data)\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bFAQPage\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bwith\s+(?:FAQ|FAQPage)\s+(?:schema|markup|structured data)\b/gi, '')
       .replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/,\s*\./g, '.').trim();
  return t;
};
verdict.risks = (Array.isArray(verdict.risks) ? verdict.risks : []).map(noFaqSchema);
verdict.reasons = (Array.isArray(verdict.reasons) ? verdict.reasons : []).map(noFaqSchema);
// Page-claims kit (R38 / R48, 2026-10-16; inlined by build sections 102 and 103).
// A statement about what the CUSTOMER'S OWN page lacks is a statement about their property, and the verdict made three false ones in one
// sentence (exec 608: "no mandate dates, no tables, no author or date" - the page has all three). `Collect Client Pages` now measures the
// page's facts on the whole page (`existing_page_digest`); this kit is the deterministic half: a negative claim about the page that the
// digest contradicts, or that the digest says could not be checked, is not allowed to reach the customer as a fact.
//   PC.topics(text)            which parts of a page a sentence is about: dates, pubdate, table, author, cta
//   PC.claimsAbsence(text)     does it say something is missing / absent
//   PC.judge(text, digest, o)  { drop, why } - o.scoped: every line is about the client's page (the analyzer's `existing_page_gaps`)
//   PC.filterLines(lines, d, o) -> { lines, dropped }   one line = one statement (arrays of reasons / gaps)
//   PC.filterText(text, d, o)   -> { text, dropped }    sentence by sentence (a paragraph)
//   PC.fta(text)               R48: "FTA-accredited" -> the Ministry of Finance (the UAE's e-invoicing accreditation is the Ministry's)
const PC = (() => {
  const S = (x) => String(x == null ? '' : x);
  const NEG = /\b(?:no|not|without|lacks?|lacking|lack of|missing|absent|doesn['’]?t|does not|isn['’]?t|is not|aren['’]?t|are not|never|zero|nothing|none|yet to|fails? to|omits?)\b/i;
  const HEDGE = /\b(?:in the excerpt|excerpt provided|text provided|provided text|provided excerpt|first part|visible in the text provided|in the text we (?:read|were given))\b/i;
  const TOPIC = [
    ['table', /\btables?\b|comparison (?:chart|matrix)|\bmatrix\b/i],
    ['author', /\bauthors?\b|\bbylines?\b|written by|author box|\bexpert (?:name|bio|credit)/i],
    ['pubdate', /\b(?:publish(?:ed|ing)?|updated?|modified|last[- ]updated|revised|freshness)\b[^.;]{0,30}\bdates?\b|\bdates?\b[^.;]{0,20}\b(?:published|updated|modified)\b|\bpublication dates?\b|\bdatestamps?\b|\bdated\b/i],
    ['dates', /\b(?:mandate|deadline|implementation|compliance|timeline|key|regulatory|go-live|rollout|roll-out)\s+dates?\b|\bdates?\b|\b(?:19|20)\d{2}\b[^.;]{0,20}\b(?:deadline|mandate)\b/i],
    ['cta', /\bCTAs?\b|call[- ]to[- ]action|contact (?:form|details|button|link)|lead (?:form|capture|magnet)|enquiry form|inquiry form|conversion (?:element|path)/i]
  ];
  const CLIENT_REF = /\b(?:existing|current|client['’]?s?|your|our|target (?:url|page)|the (?:insights |blog |service )?(?:page|article|post)|this (?:page|article|post)|its (?:visible |own |current )?(?:text|content|copy)|the url)\b/i;
  const COMP_ONLY = /\b(?:competitors?|rivals?|top[- ]?(?:3|5|10)|ranking pages|the serp|results pages?)\b/i;
  const topics = (text) => {
    const t = S(text), out = [];
    for (const [k, re] of TOPIC) if (re.test(t)) out.push(k);
    // "no author or date" is a statement about the byline and its date
    if (out.indexOf('author') >= 0 && /\bor\s+(?:a\s+)?(?:publication |publish |update )?dates?\b/i.test(t) && out.indexOf('pubdate') < 0) out.push('pubdate');
    return out;
  };
  const claimsAbsence = (text) => NEG.test(S(text));
  const dig = (d) => (d && typeof d === 'object' && d.url !== undefined) ? d : null;
  // one statement, judged against the page's facts; the `why` is the sentence the owner can read in the report
  const judge = (text, digest, o) => {
    const d = dig(digest), t = S(text), opts = o || {};
    if (!d || !t) return { drop: false };
    if (!claimsAbsence(t)) return { drop: false };
    const tp = topics(t);
    if (!tp.length) return { drop: false };
    // a sentence that does not name the client's page (competitors, the results page) is not a claim about it
    if (!opts.scoped && (!CLIENT_REF.test(t) || (COMP_ONLY.test(t) && !/\b(?:existing|current|client['’]?s?|your|our)\b/i.test(t)))) return { drop: false };
    const dates = (d.dates || []), structure = !!d.structure_reliable;
    for (const k of tp) {
      if (k === 'dates' && (dates.length || d.published)) return { drop: true, topic: k, why: 'the page states dates in its text (' + (dates.slice(0, 3).join('; ') || d.published) + ')' };
      if (k === 'table') { if (d.tables > 0) return { drop: true, topic: k, why: 'the page has ' + d.tables + ' table(s)' }; if (!structure) return { drop: true, topic: k, why: 'tables could not be checked: the text reader flattens them and the page\'s HTML was not read in full' }; }
      if (k === 'author') { if (d.author) return { drop: true, topic: k, why: 'the page names its author (' + d.author + ')' }; if (!structure) return { drop: true, topic: k, why: 'a byline could not be checked: the text reader drops it and the page\'s HTML was not read in full' }; }
      if (k === 'pubdate') { if (d.published || d.modified) return { drop: true, topic: k, why: 'the page carries a publication date (' + (d.published || d.modified) + ')' }; if (!structure) return { drop: true, topic: k, why: 'a publication date could not be checked: the page\'s HTML was not read in full' }; }
      if (k === 'cta') { if (d.cta === true) return { drop: true, topic: k, why: 'the page has a call to action' }; if (!structure && d.cta !== false) return { drop: true, topic: k, why: 'a call to action could not be checked: the page\'s HTML was not read in full' }; }
    }
    // a negative claim that rests on "the excerpt provided" is a guess about the rest of the page, whatever it is about
    if (HEDGE.test(t)) return { drop: true, topic: tp[0], why: 'it rests on an excerpt of the page, not on the page' };
    return { drop: false };
  };
  const filterLines = (lines, digest, o) => {
    const kept = [], dropped = [];
    for (const l of (Array.isArray(lines) ? lines : [])) {
      const j = judge(l, digest, o);
      if (j.drop) dropped.push({ text: S(l).slice(0, 300), topic: j.topic, why: j.why }); else kept.push(l);
    }
    return { lines: kept, dropped };
  };
  const filterText = (text, digest, o) => {
    const t = S(text), parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/), kept = [], dropped = [];
    for (const p of parts) {
      const j = judge(p, digest, o);
      if (j.drop) dropped.push({ text: p.slice(0, 300), topic: j.topic, why: j.why }); else kept.push(p);
    }
    return { text: kept.join(' ').trim(), dropped };
  };
  // R48: in the UAE the Ministry of Finance accredits e-invoicing service providers (the Federal Tax Authority administers the tax); vendors' own pages say "FTA-accredited"
  const fta = (text) => S(text)
    .replace(/\bFTA[-\s]accredited\b/g, 'Ministry of Finance-accredited').replace(/\bFTA[-\s]accredit(ation)\b/gi, 'Ministry of Finance accreditation')
    .replace(/\baccredited by the (?:UAE )?(?:Federal Tax Authority|FTA)\b/gi, 'accredited under the Ministry of Finance\'s e-invoicing framework');
  return { topics, claimsAbsence, judge, filterLines, filterText, fta };
})();
// ---- R38 / R48 (2026-10-16): what the verdict says about the client's own page is checked against what was measured on that page ----
// Exec 608: reasons[3] said "Its visible text has no mandate dates, ... no tables, ... no author or date" about a page that has all three.
// The Verdict Agent now reads the page's facts; this removes any sentence of its reasons / risks that the digest still contradicts (or that
// the digest says could not be checked) and says so in `page_claims_dropped`. R48: "FTA-accredited" -> the Ministry of Finance's framework.
const PCD = prev.existing_page_digest || null;
const page_claims_dropped = [];
const pcClean = (arr) => (Array.isArray(arr) ? arr : []).map(x => { const r = PC.filterText(x, PCD, {}); r.dropped.forEach(d => page_claims_dropped.push(d)); return PC.fta(r.text); }).filter(Boolean);
verdict.risks = pcClean(verdict.risks);
verdict.reasons = pcClean(verdict.reasons);

// ---- R18 (2026-10-14, FIX_PLAN §3.12): a feasibility score computed on a results page nobody could read ----
// Execution 549: both SERP calls answered 40101 inside an HTTP 200, were billed, ran once — and the run still said
// "winnable, GO_WITH_CHANGES 68" and wrote a page. The retry is wired above; when it fails too, the competition was never seen,
// so there is no verdict and no number — only what was tried, and the suggestion to run the check again.
const EV56 = (() => {
  const sf = prev.serp_features || {}; const ev = prev.serp_evidence || null; const kd = prev.keyword_data_evidence || null;
  const out = !!(sf.unavailable || (ev && ev.unavailable));
  const why = String((ev && ev.error) || sf.error || 'no answer from the search data provider').slice(0, 160);
  const again = (ev && ev.retried) ? ' The search was sent again once and failed again.' : '';
  return {
    withheld: out,
    evidence: { serp: out ? 'unavailable' : 'read', error: out ? why : '', asked: ev ? ev.asked : 1, checked: ev ? ev.checked : (out ? 0 : 1),
      retried: ev ? ev.retried : 0, keyword_data: (kd && kd.unavailable) ? 'unavailable' : 'read' },
    reason: out ? 'No score is given for this keyword: the live Google results could not be read (' + why + ').' + again
      + ' Nobody has seen the pages that rank, the featured snippet or the AI Overview, so any number here would be invented. Run the check again.' : ''
  };
})();
// ---- B1-1 (2026-10-15, benchmark area 1): the two numbers the keyword report puts in front of a customer ----
// They used to be whatever the Verdict Agent typed into its JSON. The same run computes both properly: `_reach.js` turns a keyword
// difficulty and this site's reach into a plan with a month RANGE and an uncalibrated chance band against a published base rate, and
// `KWI.calibrate` turns a monthly volume into visits through the measured click loss of the results page that was actually read.
const KD77 = (prev.keyword_data || {}).keyword_difficulty ?? null;
const VOL77 = (prev.keyword_data || {}).search_volume ?? null;
const SF77 = prev.serp_features || {};
const SERP_READ77 = SF77.unavailable !== true;
let CACHE77 = []; try { CACHE77 = $('Load Site Cache').all().map(i => i.json); } catch (e) { CACHE77 = []; }
// the site's reach: the stored measurement (30 days, same market) or, failing that, the size tier of the authority this run already
// read. Never a fresh paid pull: a keyword report does not buy the ranked-keywords list.
const RI77 = reachCached(CACHE77, prev.domain, prev.location_code) || { ...reachFrom(null, prev.site_authority || null), ranked: null, cached: false };
const TA77 = reachTopic(RI77.ranked === undefined ? null : RI77.ranked, prev.keyword, RI77.reach, { domain: prev.domain || 'your site',
  reason_missing: RI77.cached ? 'the reach stored on ' + String(RI77.cached_at || '').slice(0, 10) + ' was kept without the keywords behind it, so this report has no topic evidence to read'
    : 'a keyword report does not buy the list of keywords your site ranks for (the keyword research and the ladder do)' });
const DIFF77 = prev.domain ? difficultyForYou(KD77, TA77.reach, {}) : null;
const PLAN77 = DIFF77 ? reachPlan(DIFF77, reachStrong(RI77, null)) : null;
const FORYOU77 = !DIFF77 ? null : { difficulty_for_you: DIFF77, plan_type: PLAN77.plan_type, months: PLAN77.months, months_range: PLAN77.months_range,
  stretch: PLAN77.stretch, chance: PLAN77.chance, reach_used: TA77.reach, reach_basis: TA77.used ? 'topic' : 'site',
  site_reach: TA77.site_reach, topic_reach: TA77.topic_reach, kd_known: KD77 != null,
  label: reachLabel(DIFF77, PLAN77.plan_type === 'none' ? null : PLAN77) + (TA77.used ? ' \u00b7 measured on this topic' : ''),
  note: TA77.note + (KD77 == null ? ' This keyword has no measured difficulty either, so it is counted as that reach + ' + REACH_CFG.unknown_kd + '.' : '') };
const TTR77 = (!PLAN77 || PLAN77.plan_type === 'none') ? null : { months: PLAN77.months, months_range: PLAN77.months_range, basis: 'modelled',
  chance: PLAN77.chance, note: reachChanceText(PLAN77), base_rate: REACH_BASE_RATE, model_months: verdict.time_to_rank_months ?? null };
// the visits a page in the top three would take. A results page nobody could read yields NO estimate: what it takes in clicks before
// anyone reaches a link is exactly what was not seen.
const VIS77 = (() => {
  const model = verdict.expected_monthly_visits_top3 ?? null;
  if (!SERP_READ77) return { visits: null, basis: 'unknown', basis_text: 'not estimated: the live results page could not be read, so the clicks it takes before anyone reaches a link are unknown',
    note: 'No visit estimate: the live Google results could not be read (' + String(SF77.error || 'no answer').slice(0, 120) + ').', model_estimate: model, loss_applied: '' };
  const c = KWI.calibrate({ volume: VOL77, serp_types: SF77.features_present || [] }, {});
  const basis_text = c.traffic_basis === 'calibrated' ? 'calibrated with your own Search Console data'
    : c.traffic_basis === 'modelled' ? 'modelled from the provider\'s monthly volume, after this results page\'s click loss'
    : 'not estimated: no monthly search volume was measured for this keyword';
  return { visits: c.traffic_potential, basis: c.traffic_basis, basis_text, note: c.traffic_note, model_estimate: model, loss_applied: KWI.lossText(SF77.features_present || []) };
})();
const EXP = (prev.existing_page && prev.existing_page.url) ? prev.existing_page : null;
let verdict_changes = Array.isArray(verdict.what_must_change) ? verdict.what_must_change.map(x => PC.fta(noFaqSchema(x))).filter(Boolean) : [];   // R7: never FAQPage schema
let existing_page_action = null;
if (EXP) {
  existing_page_action = 'improve';
  // a line that explicitly asks for a SECOND URL is dropped; a line that asks for work ("Build an informational penalty guide of about
  // 1,800 words …", the live answer of run 444) is kept but addressed to the page that exists, so no advice and no word target is lost.
  const NEW_URL_RE = /\b(?:new|second|separate|dedicated|additional|another|standalone|stand-alone)\s+(?:page|url|post|article)\b|\b(?:publish|create|build|launch|spin up)\s+an?\s+(?:new\s+)?(?:page|url)\b/i;
  const CREATE_RE = /^(?:please\s+)?(?:build|create|write|publish|launch|produce|develop|make|add|set up)\b/i;
  const WORDS_RE = /\b(\d[\d,]{2,5})\s*words?\b/i;
  const dropped = verdict_changes.filter(c => NEW_URL_RE.test(c));
  verdict_changes = verdict_changes.filter(c => !NEW_URL_RE.test(c))
    .map(c => CREATE_RE.test(c) ? c.replace(CREATE_RE, (m) => 'On that page, ' + m.toLowerCase()) : c);
  // the length the verdict asked for is the brief's clamp (D10): never lose it with the line that happened to carry it
  const lostWords = dropped.map(c => (c.match(WORDS_RE) || [])[1]).filter(Boolean)[0];
  if (lostWords && !verdict_changes.some(c => WORDS_RE.test(c))) verdict_changes.push('Aim for about ' + lostWords + ' words on that page.');
  verdict_changes.unshift('Improve the page the site already has for this search (' + EXP.url + '): update and expand it, keep its URL, and do not publish a second page for this keyword.');
}

return [{
  json: {
    ...prev,
    verdict: EV56.withheld ? 'NOT_CHECKED' : verdict.verdict,
    verdict_score: EV56.withheld ? null : (verdict.score ?? null),
    verdict_evidence: EV56.evidence,
    score_withheld: EV56.withheld,
    score_withheld_reason: EV56.reason,
    verdict_reasons: EV56.withheld ? [EV56.reason, ...(verdict.reasons || [])] : (verdict.reasons || []),
    verdict_risks: verdict.risks || [],
    recommended_page: PT.of(verdict.recommended_page || prev.page_type, prev.page_type),
    page_notes: PT.notes(verdict.recommended_page, PT.of(verdict.recommended_page || prev.page_type, prev.page_type)),
    secondary_keywords: verdict.secondary_keywords || [],
    verdict_changes,
    page_claims_dropped,
    existing_page_action,
    expected_visits_top3: EV56.withheld ? null : (VIS77.visits ?? null),
    expected_visits: EV56.withheld ? null : VIS77,
    time_to_rank_months: EV56.withheld ? null : (verdict.time_to_rank_months ?? null),   // kept for the ladder and older readers: it is the MODEL's own number and every surface now says so
    time_to_rank: EV56.withheld ? null : TTR77,
    for_you: EV56.withheld ? null : FORYOU77,
    reach_info: FORYOU77 ? { reach: RI77.reach, method: RI77.method, cached: !!RI77.cached, cached_at: RI77.cached_at || null, evidence_kept: !!RI77.ranked } : null
  }
}];