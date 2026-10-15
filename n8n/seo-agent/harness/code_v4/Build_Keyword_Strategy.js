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
 * head: the topic's head keyword · domainReach: the site-wide reach · o: { match (the on-topic test), domain }
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
  const reason = ranked == null ? 'the keywords ' + who + ' ranks for could not be read on this run'
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
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '—')
        + '</td><td ' + td + '>' + esc1(l.sample || '—') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
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

  // the click loss a results page causes (an AI Overview, a snippet, a local pack and so on take clicks off the blue links)
  const featureLoss = (types) => {
    const t = (Array.isArray(types) ? types : []).map(x => S(x).toLowerCase());
    let ctr = 1;
    if (t.indexOf('ai_overview') >= 0) ctr *= 0.65;
    if (t.indexOf('featured_snippet') >= 0) ctr *= 0.85;
    if (t.indexOf('video') >= 0 || t.indexOf('short_videos') >= 0) ctr *= 0.92;
    if (t.indexOf('local_pack') >= 0 || t.indexOf('map') >= 0) ctr *= 0.85;
    if (t.indexOf('shopping') >= 0 || t.indexOf('popular_products') >= 0) ctr *= 0.9;
    return ctr;
  };

  // ---- K2: the traffic number, and where it comes from ----
  // `calibrated`: the site's own measured impressions for this exact search (the Search Console period, scaled to a month) through the
  //               results page's click loss and the share a top-three page takes, never below the clicks the site already gets.
  // `modelled`:   the provider's monthly volume through the same two factors - an estimate of an estimate, named as one.
  // `unknown`:    neither a volume nor a measurement, so no number at all (better than a confident zero).
  const calibrate = (e, o) => {
    const c = { ...CFG, ...(o || {}) };
    const k = e || {};
    const ctr = featureLoss(k.serp_types);
    const vol = num(k.volume);
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
          + traffic_potential + ' visits a month' + (modelled != null ? ' (the modelled estimate from the provider\'s volume is ' + modelled + ').' : '.') };
    }
    if (modelled == null) {
      return { traffic_potential: null, traffic_basis: 'unknown', modelled_traffic_potential: null,
        traffic_note: 'No monthly volume from the provider and no Search Console measurement for this search, so no traffic estimate is given.' };
    }
    return { traffic_potential: modelled, traffic_basis: 'modelled', modelled_traffic_potential: modelled,
      traffic_note: 'Modelled, not measured: ' + vol + ' searches a month (a provider estimate) through the click loss of this results page and the share a top-three page takes.' };
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
  return { CFG, gscSeeds, calibrate, serpClusters, clusterText, featureLoss, liveChecks, ladderChecks, checkCost, urlKey, BASIS_TEXT, helpers: { bare, low, num } };
})();
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
  k.live = { top_domains: [...new Set(organic.map(o => normD(o.domain)).filter(Boolean))].slice(0, 5), your_position: mine ? mine.rank_group : null, checked_at: serpSeenAt(serps[i]),
    features: [...new Set(items.map(x => x.type))].filter(t => t !== 'organic'), ai_overview: items.some(x => x.type === 'ai_overview'), paa: (items.find(x => x.type === 'people_also_ask') || { items: [] }).items.slice(0, 4).map(q => q.title || q.question).filter(Boolean) };
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
  if (!live) return { live: null, stored, count: 0, seen: 0, text: hist || 'unknown — the results page could not be read' };
  const o = aioObserved([live]);
  return { live: live.seen, stored, count: o.count, seen: o.seen, text: o.text + (hist ? '; ' + hist : '') };
};
const why = (k) => {
  const bits = [];
  if (k.kd != null && k.kd < 30) bits.push('low competition');
  if (k.cpc != null && k.cpc >= 5) bits.push('high commercial value (CPC ' + cpcTxt(k.cpc) + ')');
  if (k.intent === 'transactional') bits.push('buyers ready to act');
  else if (k.intent === 'commercial') bits.push('buyers comparing providers');
  else bits.push('research-stage traffic that builds authority');
  if (k.competitors_in_top20) bits.push(k.competitors_in_top20 + ' competitor(s) already rank for it');
  const ao = aioObs(k);   // D20: only the live check may claim an AI Overview; the undated stored value is named as historical
  if (ao.live === true) bits.push('an AI Overview was seen on ' + obsDay(k.live.checked_at) + ' (they vary between searches) — write a quotable answer block');
  else if (ao.live == null && ao.stored === true) bits.push('the stored results page showed an AI Overview (historical, undated — not checked live)');
  if (k.live && k.live.your_position) bits.push('you are already at #' + k.live.your_position);
  // G8 / K2: say when the traffic number is the site's own measurement rather than a model, and K7: when one page can serve more searches
  if (k.traffic_basis === 'calibrated' && k.gsc) bits.push('Search Console already measured ' + Math.round(Number(k.gsc.impressions) || 0) + ' impressions for this exact search on your site in ' + (Number(k.gsc.period_days) || 28) + ' days, so the traffic number below is calibrated, not modelled');
  if (k.serp_cluster) bits.push('the same pages rank for "' + k.serp_cluster.head_keyword + '" (' + k.serp_cluster.shared_urls + ' shared top-10 results), so one page can target both');
  return bits.join('; ') + '.';
};
ks.priority.forEach(k => { k.why = why(k); });
// v4.8: the live position upgrades the label (already top 20 = easy; a top-20 position also shortens the months)
const RR = ks.reach || null;
if (RR) ks.priority.forEach(k => { const p = k.live && k.live.your_position; if (p && p <= REACH_CFG.easy_position) { const diff = difficultyForYou(k.kd, RR.reach, { position: p }); const plan = reachPlan(diff, reachStrong(RR, p));
  Object.assign(k, { difficulty_for_you: diff, plan_type: plan.plan_type, months: plan.months, for_you_label: reachLabel(diff, plan) }); } });

// ---- compatibility object for the file, email and content-pipeline steps ----
let pipeline = ks.pipeline_keyword ? withAi(ks.pipeline_keyword) : null;
if (pipeline) { const enriched = ks.priority.find(k => k.keyword === pipeline.keyword); pipeline = enriched ? { ...enriched } : { ...pipeline, why: why(pipeline) }; ks.pipeline_keyword = pipeline; }
const recommended = [];
if (pipeline) recommended.push({ ...pipeline, reason: 'best fit for the goal "' + ks.goal + '"' });
ks.priority.forEach(k => { if (!recommended.some(r => r.keyword === k.keyword)) recommended.push(k); });
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
const chanceTxt = (k) => k.chance && k.chance.label ? ', ' + esc(k.chance.band) + ' chance (' + k.chance.range[0] + '-' + k.chance.range[1] + '%, uncalibrated)' : '';
const forYouCell = (k) => k.difficulty_for_you ? esc(FY[k.difficulty_for_you] || k.difficulty_for_you) + (k.months ? '<br><span class="muted">' + esc(({ direct: 'direct', short: 'short ladder', full: 'full ladder' })[k.plan_type] || '') + ', ' + esc(k.months) + ' mo' + chanceTxt(k) + '</span>' : '') : '—';
const KW0 = [['Keyword', k => esc(k.keyword)], ['Searches/mo', k => num(k.volume)], ['Difficulty', k => kdLabel(k.kd)], ['CPC $', k => k.cpc == null ? '—' : cpcTxt(k.cpc)], ['Intent', k => cap(k.intent)], ['Trend', k => trend(k)], ['SERP features', k => feat(k)], ['Opportunity', k => num(k.opportunity)]];
const KW = RR ? [...KW0.slice(0, 3), ['For your site', forYouCell], ...KW0.slice(3)] : KW0;
const reachLine = RR ? 'Your site\'s reach: difficulty ' + RR.reach + ' (' + (RR.method === 'percentile' ? '75% of the ' + RR.sample + ' keywords you rank top 10 for are at or below it' : 'from ' + num(RR.top10) + ' keyword(s) in the top 10') + (RR.cached ? ', measured ' + String(RR.cached_at || '').slice(0, 10) : '') + '). "For your site": easy up to reach + 5 or already top 20, reachable up to + 20, hard up to + 40. Months and the chance band per plan are estimates (the chance is uncalibrated until this system has measured its own ladders). ' + reachBaseRateText() : '';
// 2026-10-12 (FIX_PLAN D11): a keyword a live page of the site already answers is named with that page, so nobody writes a second one
const coveredLine = (ks.covered || []).length ? (ks.covered.length === 1 ? 'One keyword below is' : ks.covered.length + ' keywords below are') + ' already answered by a page you have: ' + ks.covered.slice(0, 5).map(c => '"' + esc(c.keyword) + '" \u2192 <a href="' + esc(c.url) + '">' + esc(c.url) + '</a>').join(', ') + '. Refresh those pages instead of writing new ones \u2014 two pages for one search split the signals and neither ranks.' : '';
// 2026-10-12 (FIX_PLAN D20): a keyword one of the site's own keyword ladders already covers is named with that ladder, so the top pick never
// competes with a ladder that is already running one search, one page.
const ladderLine = (ks.ladder_covered || []).length ? (ks.ladder_covered.length === 1 ? 'One keyword below is' : ks.ladder_covered.length + ' keywords below are') + ' already covered by a keyword ladder of yours: ' + ks.ladder_covered.slice(0, 5).map(c => '"' + esc(c.keyword) + '" \u2192 ladder "' + esc(c.head_keyword) + '" (' + esc(c.how) + ', ' + (c.part === 'head' ? 'its main page' : 'rung ' + c.rung) + ', ' + esc(c.status || 'planned') + ')').join(', ') + '. Let that ladder finish \u2014 two pages for one search split the signals and neither ranks.' : '';
const refusedLine = (ks.refused || []).length ? ks.refused.length + ' keyword(s) were left out as government, portal or other companies\' brand searches (e.g. ' + ks.refused.slice(0, 5).map(r => '"' + esc(r.keyword) + '" — ' + esc(r.reason)).join(', ') + ').' : '';
// ---- G8 (2026-10-13): the three new inputs in the report ----
// K2: every traffic number says whether the site's own Search Console data could check it
const tpCell = (k) => '~' + num(k.traffic_potential) + '/mo' + (k.traffic_basis === 'calibrated' ? ' (calibrated with your data)' : k.traffic_basis === 'modelled' ? ' (modelled)' : '');
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
  ${reachLine ? '<p class="muted">' + esc(reachLine) + '</p>' : ''}${refusedLine ? '<p class="muted">' + refusedLine + '</p>' : ''}${coveredLine ? '<p class="muted">' + coveredLine + '</p>' : ''}${ladderLine ? '<p class="muted">' + ladderLine + '</p>' : ''}

  <div class="callout"><b>Where to start:</b> ${pipeline ? '"' + esc(pipeline.keyword) + '" — ' + num(pipeline.volume) + ' searches/mo, difficulty ' + kdLabel(pipeline.kd) + ', ' + esc(pipeline.intent) + ' intent, best page: ' + esc(pipeline.page_type) + '. ' + (pipeline.for_you_label ? esc(pipeline.for_you_label) + '. ' : '') + esc(pipeline.why) : 'Not enough data to pick a first keyword.'}
  ${now.length ? '<br><b>Build first:</b> ' + now.map(c => esc(c.topic) + ' (' + esc(c.page_type) + ', ' + num(c.total_volume) + '/mo across ' + c.keyword_count + ' keywords)').join(' · ') : ''}</div>

  <h2>Priority keywords (${ks.priority.length}) — live-checked on Google</h2>
  ${liveFailures.length ? '<p class="muted">' + liveFailures.length + ' of ' + prio.length + ' live checks could not be made (the search data provider failed): those keywords show the stored SERP features and "not checked".</p>' : ''}
  ${ks.priority.map((k, i) => `<div class="card">
    <div class="kw">${i + 1}. ${esc(k.keyword)}</div>
    <p>${k.volume == null ? '<span class="pill">No provider volume — measured on your site instead</span>' : '<span class="pill">' + num(k.volume) + ' searches/mo</span>'}<span class="pill">Difficulty ${kdLabel(k.kd)}</span>${k.for_you_label ? '<span class="pill ' + (['easy', 'reachable'].includes(k.difficulty_for_you) ? 'now' : 'later') + '">' + esc(k.for_you_label) + '</span>' : ''}<span class="pill">${cap(k.intent)}</span><span class="pill">${esc(k.page_type)}</span>${k.cpc != null ? '<span class="pill">CPC $' + cpcTxt(k.cpc) + '</span>' : ''}${k.ladder_covered ? '<span class="pill later">Already in your ladder "' + esc(k.ladder_covered.head_keyword) + '"</span>' : ''}${k.serp_cluster ? '<span class="pill">Same results page as "' + esc(k.serp_cluster.head_keyword) + '"</span>' : ''}<span class="pill${k.traffic_basis === 'calibrated' ? ' now' : ''}">Traffic potential ${tpCell(k)}</span>${k.ai_search_volume ? '<span class="pill ai">AI search volume ' + num(k.ai_search_volume) + '/mo</span>' : ''}</p>
    <p>${esc(k.why)}</p>
    <p class="muted"><b>Topic:</b> ${esc(k.topic)} · <b>SERP features:</b> ${esc(k.live ? (k.live.features.join(', ') || 'none') : feat(k))}${k.live ? ' (live check at ' + esc(obsClock(k.live.checked_at)) + ')' : ' (stored results page)'} · <b>AI Overview:</b> ${esc(aioObs(k).text)} · <b>Who ranks now:</b> ${esc(k.live ? (k.live.top_domains.join(', ') || 'unknown') : 'not checked')}${base.domain ? ' · <b>Your position:</b> ' + (k.live && k.live.your_position ? '#' + k.live.your_position : 'not in top 20') : ''}${k.live && k.live.paa.length ? '<br><b>People also ask:</b> ' + esc(k.live.paa.join(' · ')) : ''}</p>
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
  ${(ks.clusters || []).length ? `<table class="t"><tr><th>Tier</th><th>Topic / page</th><th>Primary keyword</th><th>Page type</th><th>Keywords</th><th>Total searches/mo</th><th>Difficulty</th>${RR ? '<th>For your site</th>' : ''}</tr>` + (ks.clusters || []).slice(0, 25).map(c => `<tr><td><span class="pill ${c.tier.toLowerCase()}">${c.tier}</span></td><td><b>${esc(cap(c.topic))}</b><br><span class="muted">${esc((c.supporting || []).slice(0, 5).join(', '))}</span></td><td>${esc(c.primary_keyword)}</td><td>${esc(c.page_type)}</td><td>${c.keyword_count}</td><td>${num(c.total_volume)}</td><td>${kdLabel(c.primary_kd)}</td>${RR ? '<td>' + forYouCell(c) + '</td>' : ''}</tr>`).join('') + '</table>' : '<p class="muted">Not enough related keywords to form topics.</p>'}

  <h2>Quick wins (difficulty under 30, relevant, real demand)</h2>
  ${table(ks.quick_wins || [], KW)}

  <h2>Questions your buyers ask</h2>
  <p class="muted">Each is a guide, FAQ entry or section with a direct 40-60 word answer — the format AI Overviews and assistants quote.</p>
  ${table(ks.questions || [], KW.slice(0, 5))}

  <h2>Keywords competitors rank for and you should too</h2>
  <p class="muted">Competitors checked: ${esc((ks.competitor_domains || []).join(', ') || 'none found')}.</p>
  ${table(ks.competitor_gaps || [], [...KW.slice(0, 5), ['Competitors in top 20', k => esc((k.competitors || []).map(c => c.domain + ' #' + c.position).slice(0, 3).join(', '))]])}

  <h2>Long-tail phrases (4+ words)</h2>
  ${table(ks.long_tail || [], KW.slice(0, 6))}

  ${ks.ai_demand.available ? '<h2>AI search demand</h2><p class="muted">How often these keywords are asked in AI assistants (DataForSEO AI keyword data) next to Google demand.</p>' + table(ks.ai_demand.top, [['Keyword', k => esc(k.keyword)], ['AI searches/mo', k => num(k.ai_search_volume)], ['Google searches/mo', k => num(k.google_volume)]]) : ''}

  ${['commercial', 'transactional', 'informational'].map(x => `<h2>${cap(x)} keywords</h2>${table((ks.by_intent || {})[x] || [], KW)}`).join('')}

  ${lineageHtml}

  <h2>How this was built</h2>
  <p class="muted">Seeds: ${esc(seeds.join(', '))}${SC && (SC.seeded || []).length ? ', plus your own Search Console searches: ' + esc(SC.seeded.slice(0, 10).join(', ')) : ''}. Sources: ${esc(Object.entries(ks.by_source || {}).map(([k, v]) => k + ' ' + v).join(', '))}. Opportunity = traffic potential (volume after SERP-feature click loss) × winnability (difficulty and top-10 link strength) × commercial value (CPC) × intent weight for your goal × trend, then multiplied by AI relevance (2 = core, 1 = adjacent, 0 = dropped). Traffic potential is <b>calibrated</b> where Search Console measured that exact search on your site (its impressions and clicks over 28 days, scaled to a month) and <b>modelled</b> everywhere else (the provider's monthly volume, typically 50-70% off for a single keyword) — the label is on every number. ${prio.length} keyword${prio.length === 1 ? '' : 's'} were checked live on Google for intent and page type${(ks.live_checks || {}).cap ? ' (limit ' + ks.live_checks.cap + ' a run, about $' + ((ks.live_checks.cap * 0.002).toFixed(2)) + ' of search data)' : ''}.${(ks.research_failures || []).length ? ' Some data pulls failed: ' + esc(ks.research_failures.join('; ')) + '.' : ''}</p>
  <p class="by">Prepared by ${esc(base.brand || 'Dev SEO')} · Search volumes, difficulty, CPC and SERP features from DataForSEO for ${esc(base.country)}.</p>
</div>`;

// Options for the form-only "Choose your keyword" step (the number prefix makes the pick unambiguous)
const choice_options = ['Let the system choose for my goal', ...ks.priority.slice(0, 8).map((k, i) => (i + 1) + '. ' + k.keyword + ' · ' + num(k.volume) + ' searches/mo · difficulty ' + (k.kd == null ? '?' : k.kd) + ' · ' + cap(k.intent) + ' · ' + k.page_type + (k.for_you_label ? ' · ' + k.for_you_label : ''))];
return [{ json: { ...base, keyword_strategy: ks, keyword_suggestions, result_html: html, lineage, choice_options } }];
