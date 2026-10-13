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
  const tokens = (s) => { const out = []; for (const t of S(s).toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 2 || STOP.has(t)) continue;
    const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, ''); if (w && !out.includes(w)) out.push(w); } return out; };
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
      : 'Your reach is the difficulty your site already wins — the 75th percentile of the difficulty of the keywords it ranks in the top 10 for'
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
  const line = (t) => !t ? '' : LABEL[t.verdict] + ' — ' + t.reason + ' (' + (t.evidence || []).join('; ') + ')';
  /** the rows a report prints, in reading order: within reach, then the stretches, then what is out of reach for now */
  const rows = (radius) => { const rad = radius || {}; return [...(rad.in_reach || []), ...(rad.stretch || []), ...(rad.far || [])]; };
  return { of, pick, rows, line, LABEL, CFG, tokens };
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
const FIT_GENERIC = new Set(['software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
const fitTokens = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9.]+/).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
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
  for (const l of fitLabels(ctx.own_domain, [])) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
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
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
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
  // 6. relevance to the website's services (G19): not built yet — the hook
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
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
    const services = uniq([...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
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
      nap, services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
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
  const matchPage = (model, keyword) => {
    const want = termsOf(keyword); if (!want.length) return null;
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model);
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) return { url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0 };
    }
    let best = null;
    for (const p of inv) {
      const slug = termsOf(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = termsOf(S(p.title) + ' ' + S(p.h1));
      const inSlug = want.filter(t => slug.includes(t)).length / want.length;
      const inTitle = want.filter(t => title.includes(t)).length / want.length;
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 >= MATCH_MIN && (!best || score > best.score)) best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: Math.round(score * 100) / 100, impressions: 0 };
    }
    return best;
  };
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
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at) };
  };
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString() }));
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml } };
})();
// Ladder mode: applies the AI relevance screen, assigns keywords to rungs by difficulty, builds one page per topic
// cluster, maps internal links, matches existing pages, estimates the timeline and picks the pages to write now.
// v4.8 (PIPELINE_FEATURE_SPEC §5.3-5.5): everything is measured against the site's REACH (stored 30 days in seo_cache, else measured from this
// run's "keywords the site ranks for" pull and the site authority): rungs relative to reach (1 <= reach, 2 <= reach + 15, 3 <= reach + 30, above
// = later); the main keyword's difficulty for this site picks the plan — direct (main page FIRST + 2-3 supporting pages), short (3-5 supporting
// pages, then the main page), full (rungs 1-3 + main page, as before; very hard = stretch with the alternatives first) or none (not realistic:
// alternatives only, no pages). Keywords that already belong to another ladder of the site are never planned again (same search: equal stemmed
// word sets or 75%+ in common), and a main keyword that duplicates another ladder's main keyword is refused.
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
const reach = reachInfo.reach;

// ---- the site's other ladders (rule R1: one search, one page) ----
const settingsRows = rowsOf('Load Domain Ladder Settings');
const archived = new Set(settingsRows.filter(r => String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id)));
const others = rowsOf('Load Domain Ladders').filter(r => r.ladder_id && String(r.ladder_id) !== ladderId && reachDomain(r.domain) === reachDomain(domain) && !archived.has(String(r.ladder_id)));
const otherHeads = new Map(); for (const r of others) { const h = String(r.head_keyword || (Number(r.rung) === 4 ? r.keyword : '') || '').toLowerCase().trim(); if (h && !otherHeads.has(String(r.ladder_id))) otherHeads.set(String(r.ladder_id), h); }
const taken = []; const seenTaken = new Set();
for (const r of others) for (const k of [r.keyword, r.head_keyword]) { const kw = String(k || '').toLowerCase().trim(); const sig = r.ladder_id + '|' + kw; if (kw && !seenTaken.has(sig)) { seenTaken.add(sig); taken.push({ keyword: kw, tokens: overlapTokens(kw), ladder_id: String(r.ladder_id), head: otherHeads.get(String(r.ladder_id)) || '' }); } }
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
      topic: String(it.topic || '').toLowerCase().replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim() });
  });
});
const RELF = { 2: 1, 1: 0.45, 0: 0 };
const excluded = [];
// 2026-10-11 (FIX_PLAN D8): the pool already refused other brands / government / portal keywords (research.refused); the gate runs once more here
// with the AI screen's intent in hand, so a keyword the AI called navigational never reaches a rung either
const poolRefused = ((pool.research || {}).refused || []).slice();
let cacheRowsP = []; try { cacheRowsP = $('Load Site Cache').all().map(i => i.json); } catch (e) { cacheRowsP = []; }
const sdP = base.site_description || {};
const fitCtxP = { own_domain: domain, competitors: (base.competitors || []).map(String), serp_domains: [...new Set((base.competitors_summary || []).map(c => String(c.domain || '')).filter(Boolean))],
  brands: fitLearnedBrands(cacheRowsP), protect: [head, ...(sdP.products_or_services || []), ...(base.services || []), String(base.business || sdP.business_description || '').slice(0, 400)] };
const kws = ((pool.research || {}).candidates || []).filter(k => { const g = fitGate(k.keyword, { ...fitCtxP, intent: (rel.get(k.keyword) || {}).intent || k.intent }); if (!g.ok) poolRefused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return g.ok; }).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1) };
}).filter(k => k.relevance > 0 && k.intent !== 'navigational').filter(k => {
  const t = takenBy(k.keyword); if (!t) return true;
  excluded.push({ keyword: k.keyword, ladder_id: t.ladder_id, head: t.head, as: t.keyword }); return false;
}).sort((a, b) => b.opportunity - a.opportunity);

// ---- rung bands relative to reach (unknown difficulty = reach + 10) ----
const kdOf = (k) => k.kd == null ? reach + REACH_CFG.unknown_kd : k.kd;
const longTail = (k) => k.words >= 3 || (k.words >= 2 && k.volume < 200);
const BAND = { 1: reach, 2: reach + 15, 3: reach + 30 };
const rungOf = (k) => { const kd = kdOf(k); if (kd <= BAND[1] && k.volume >= 20 && longTail(k)) return 1; if (kd <= BAND[2]) return 2; if (kd <= BAND[3]) return 3; return 0; };   // 0 = later
const byRung = { 1: [], 2: [], 3: [] }; const later = [];
for (const k of kws) { const r = rungOf(k); if (r) byRung[r].push(k); else later.push(k); }

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
const MAX_CLUSTER = 6;   // a coarse AI topic label must not swallow a whole rung: split by page type, then into groups of 6
const makePages = (list, rung) => {
  const cl = new Map();
  for (const k of list) { const key = (k.topic || k.keyword) + '|' + k.page_type; if (!cl.has(key)) cl.set(key, []); cl.get(key).push(k); }
  const groups = [];
  for (const ks of cl.values()) { const sorted = ks.slice().sort((a, b) => b.opportunity - a.opportunity); for (let i = 0; i < sorted.length; i += MAX_CLUSTER) groups.push(sorted.slice(i, i + MAX_CLUSTER)); }
  const clusters = groups.map(ks => ({ ks, opp: ks.reduce((s, k) => s + k.opportunity, 0) })).sort((a, b) => b.opp - a.opp);
  return clusters.slice(0, LIMIT[rung]).map(({ ks }) => {
    const p = ks[0];
    const ex = findExisting(p.keyword, p.your_url);
    const pos = ks.map(k => k.your_position).filter(Boolean);
    // FIX_PLAN D10 (2026-10-12): the AI screen answers in free text ("Comparison Page", "Service Page with a cost section"); the row,
    // the spawned page run and the brief take one of the form's fixed types, and the sentence itself stays as page_notes.
    const ptype = PT.of(p.page_type, defaultPage(p.intent));
    return { rung, keyword: p.keyword, topic: p.topic, page_type: ptype, page_notes: PT.notes(p.page_type, ptype), intent: p.intent, volume: p.volume, kd: p.kd, cpc: p.cpc, opportunity: p.opportunity,
      supporting: ks.slice(1, 7).map(k => k.keyword),
      keywords: ks.slice(0, 8).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, your_position: k.your_position })),
      total_volume: ks.reduce((s, k) => s + k.volume, 0), traffic_potential: ks.reduce((s, k) => s + (k.traffic_potential || 0), 0),
      your_position: pos.length ? Math.min(...pos) : null, exists: !!ex, target_url: ex ? ex.url : plannedUrl(p.keyword), existing_source: ex ? ex.source : null, status: ex ? 'improve' : 'new' };
  });
};
const bandLabel = (r) => r === 1 ? 'Rung 1 — long-tail pages (difficulty up to ' + BAND[1] + ')' : r === 2 ? 'Rung 2 — mid-difficulty pages (' + (BAND[1] + 1) + '-' + BAND[2] + ')' : 'Rung 3 — strong pages (' + (BAND[2] + 1) + '-' + BAND[3] + ')';
const rungs = [1, 2, 3].map(r => ({ rung: r, label: bandLabel(r), band_max: BAND[r], pages: makePages(byRung[r], r), available: byRung[r].length }));

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
const plan = reachPlan(difficulty_for_you, strongSite);
const topType = PT.of(base.recommended_page || base.page_type, base.page_type);
const top = { rung: 4, keyword: head, page_type: topType, page_notes: PT.notes(base.recommended_page || base.page_type, topType), intent: kd.google_intent || null, volume: kd.search_volume ?? null, kd: kd.keyword_difficulty ?? null, cpc: kd.cpc ?? null,
  supporting: (base.secondary_keywords || []).slice(0, 6), traffic_potential: kd.search_volume ? Math.round(kd.search_volume * 0.3) : null, your_position: headRank ? headRank.position : null };
// P2-7 (2026-10-12, Phase 2 live check §3): the length the verdict asked for is stored with the main page, so a later page run still has a
// target when *Parse Analysis* does not run (a `force_content` run: the app's "Write now", the Content Cadence). Run 442 wrote 3,864 words
// for the page the ladder verdict had set at 2,100 — +84% — because nothing remembered that number.
const verdictWords = (() => { for (const t of (base.verdict_changes || [])) {
    const m = String(t || '').match(/\b(?:of|about|around|roughly|approximately|target|aim for|at least|up to)\s+(\d[\d,]{2,5})[\s-]*words?\b/i);
    if (m) { const n = Number(String(m[1]).replace(/,/g, '')); if (n >= 300 && n <= 6000) return n; } } return 0; })();
const analysisWords = Number((base.competitor_analysis || {}).recommended_word_count) || 0;
top.target_words = verdictWords || analysisWords || 0;
const headExisting = (base.existing_page && base.existing_page.url) ? { url: base.existing_page.url, source: base.existing_page.source || 'sitemap' } : findExisting(head, headRank && headRank.url);
Object.assign(top, { exists: !!headExisting, target_url: headExisting ? headExisting.url : plannedUrl(head), existing_source: headExisting ? headExisting.source : null, status: headExisting ? 'improve' : 'new' });

// ---- feasibility of the destination (alternatives before any page is dropped) ----
const status = difficulty_for_you === 'not_realistic' ? 'unrealistic' : difficulty_for_you === 'very_hard' ? 'stretch' : 'winnable';
const altPool = [...(base.verdict_changes || []).filter(s => /["“”]/.test(String(s))), ...(base.secondary_keywords || [])].slice(0, 4);
const altPages = [...rungs[2].pages, ...rungs[1].pages, ...rungs[0].pages].map(p => p.keyword);
const alternatives = status === 'winnable' ? [] : (altPool.length ? altPool : altPages.slice(0, 3));

// ---- refusals: a duplicate main keyword, or a destination that is not realistic -> no ladder pages ----
let refusal = null;
if (dupHead) refusal = { reason: 'duplicate', ladder_id: dupHead.ladder_id, head: dupHead.head,
  message: 'This website already has a keyword ladder for "' + dupHead.head + '" (' + dupHead.ladder_id + '). One search needs one page, so no second ladder was planned: continue that ladder instead.' };
else if (plan.plan_type === 'none') refusal = { reason: 'not_realistic', message: '"' + head + '" is not a realistic main keyword for ' + domain + ' (' + (other_brand ? 'it is another company\'s brand: ' + headGate.detail : navigational ? 'people searching it look for one particular website or brand' + (!headGate.ok ? ': ' + headGate.detail : '') : 'the verdict is AVOID') + '). No ladder pages were planned; pick one of the alternatives as the main keyword instead.' };
const plan_type = refusal ? 'none' : plan.plan_type;
const planned = !refusal;

// ---- pages per plan type: direct 2-3 supporting pages, short 3-5, full as before (rung limits); the rest is kept for later ----
const CAP = { direct: 3, short: 5, full: Infinity, none: 0 }[plan_type];
let kept = 0;
for (const r of rungs) {
  const keep = r.pages.slice(0, Math.max(0, CAP - kept)); kept += keep.length;
  for (const p of r.pages.slice(keep.length)) later.unshift({ keyword: p.keyword, volume: p.volume, kd: p.kd, held_back: true });
  r.pages = keep;
}
const rungPages = rungs.flatMap(r => r.pages);
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
const feasibility = { status, verdict, score: base.verdict_score ?? null, reasons: base.verdict_reasons || [], what_must_change: base.verdict_changes || [], alternatives,
  expected_visits_top3: base.expected_visits_top3 ?? null, time_to_rank_months: base.time_to_rank_months ?? null, navigational };

// ---- what else is needed besides the pages ----
const requirements = [];
const needRd = bl.avg_referring_domains || null;
if (needRd) requirements.push({ item: 'Links to the top page', detail: 'Top-10 pages for "' + head + '" average ' + needRd + ' referring domains. Plan ' + Math.max(5, Math.round(needRd * 0.6)) + '+ relevant links (partners, directories, PR, guest articles) to the top page over the ladder period.' });
if (sa) requirements.push({ item: 'Site authority today', detail: domain + ' ranks for ' + (sa.organic_keywords || 0) + ' keywords (' + (sa.top10 || 0) + ' in the top 10, ' + (sa.top3 || 0) + ' in the top 3). ' + (sa.top10 < 20 ? 'The lower rungs come first: they build topical authority before the head term is realistic.' : 'Existing authority shortens the timeline.') });
if ((pool.head_geo || []).length) requirements.push({ item: 'Local trust signals', detail: 'The head term is local (' + pool.head_geo.join(' ') + '): a complete Google Business Profile, consistent name/address/phone and recent reviews support every rung.' });
requirements.push({ item: 'Entity and trust pages', detail: 'Organization schema, an about page with real credentials, author bylines and case studies; the content QA already adds schema to every generated page.' });
requirements.push({ item: 'Publish on schedule and interlink', detail: 'Each rung page links up to the top page and sideways to one sibling; the top page links down to every rung page. Ranking only starts once the pages are live.' });

// ---- pages to write now, in the plan's order (direct: the main page first; otherwise the supporting pages, the main page waits for support) ----
const order = !planned ? [] : mainFirst ? [top, ...rungPages] : rungPages;
const write_now = order.slice(0, pagesNow).map(p => ({ page_no: p.page_no, rung: p.rung, keyword: p.keyword, page_type: p.page_type, target_url: p.target_url, exists: p.exists, supporting: p.supporting, links_to: p.links_to, target_words: Number(p.target_words) || 0 }));
const pages_total = planned ? rungPages.length + 1 : 0;
const stats = { pool_size: (pool.research || {}).pool_size || 0, ai_reviewed: rel.size, relevant: kws.length, pages_total, rung_pages: planned ? rungPages.length : 0,
  keywords_covered: planned ? rungPages.reduce((s, p) => s + 1 + p.supporting.length, 0) + 1 + top.supporting.length : 0,
  traffic_potential_total: planned ? rungPages.reduce((s, p) => s + (p.traffic_potential || 0), 0) + (top.traffic_potential || 0) : 0,
  site_rankings_found: SR.count || 0, research_failures: (pool.research || {}).failures || [], excluded_keywords: excluded.length, refused_keywords: poolRefused.length };
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
if (head_radius) notes.push('Topic radius — "' + head_radius.topic + '": ' + RAD.line(head_radius) + '.');
if (poolRefused.length) notes.push(poolRefused.length + ' keyword(s) were left out of the ladder because they are other companies\' brands, government or portal searches, or navigational: ' + poolRefused.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason + ')').join(', ') + (poolRefused.length > 6 ? ' …' : '') + '.');
if (planned && plan_type === 'full' && rungPages.length && pages_total < 8) notes.push('Only ' + pages_total + ' pages could be planned from the data: the topic is narrow in ' + base.country + '. The ladder is shorter but still valid.');
if (planned && plan_type === 'full' && rungPages.length) for (const r of rungs) if (!r.pages.length) notes.push('No keywords fell into rung ' + r.rung + '; the ladder skips it.');
if (planned && plan_type === 'direct' && rungPages.length < 2) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned around the main keyword; add more as the site grows.');
if (planned && plan_type !== 'direct' && !rungPages.length) notes.push('No supporting keywords were found for "' + head + '" in ' + base.country + ' (the topic is narrow in the search data), so the main page is the whole ladder for now and is written first. Supporting pages can be added as the site grows.');
else if (planned && plan_type === 'short' && rungPages.length < 3) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned before the main page.');
if (excluded.length) notes.push(excluded.length + ' keyword(s) already belong to other ladders of this site and were left out (one search, one page): ' + excluded.slice(0, 6).map(x => '"' + x.keyword + '" (ladder "' + x.head + '")').join(', ') + (excluded.length > 6 ? ' …' : '') + '.');
if (headTakenAsPage) notes.push('The main keyword is also planned as a page of the ladder "' + headTakenAsPage.head + '" (' + headTakenAsPage.ladder_id + '): publish only one page for it.');
if (plan.stretch && planned) notes.push('Very hard for this site today: consider one of the alternatives first (' + alternatives.join(', ') + ').');
const order_text = !planned ? 'no pages' : plan_type === 'direct' ? 'main page first, then the supporting pages that link to it' : !rungPages.length ? 'the main page only for now (no supporting keywords in the data), written first' : plan_type === 'short' ? 'supporting pages first, then the main page once half of them are live' : 'rung by rung from the easiest pages, the main page last';
const ladder = { ladder_id: ladderId, head: { keyword: head, volume: top.volume, kd: top.kd, cpc: top.cpc, intent: top.intent, your_position: top.your_position },
  domain, country: base.country, goal: base.goal || 'leads', feasibility, rungs, top, link_map, timeline, write_now, pages_now: pagesNow,
  later: later.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, ...(k.held_back ? { held_back: true } : {}) })), requirements, stats, notes,
  plan_type, difficulty_for_you, reach, months: planned ? plan.months : '', months_range: planned ? plan.months_range : null, stretch: planned && plan.stretch, planned, refusal, order: order_text,
  label: planned ? reachLabel(difficulty_for_you, plan) : (REACH_DIFF_LABEL[difficulty_for_you] + ' · no ladder'),
  chance: planned ? plan.chance : null, chance_text: planned ? reachChanceText(plan) : '', base_rate: REACH_BASE_RATE, refused_keywords: poolRefused.slice(0, 40),
  reach_info: { reach, method: reachInfo.method, p75: reachInfo.p75 ?? null, size_reach: reachInfo.size_reach ?? null, sample: reachInfo.sample ?? null, top10: reachInfo.top10 ?? null, organic_keywords: reachInfo.organic_keywords ?? null, cached: !!reachInfo.cached, cached_at: reachInfo.cached_at || null },
  excluded_keywords: excluded.slice(0, 40), topic_radius, head_radius,   // G32: shown with the plan, never enforced on it
  tracker: { cadence: base.tracker_cadence || 'weekly', auto_next_rung: !!base.auto_next_rung, stop_rule: 'once the top rung holds the top 3 for 4 checks it is checked monthly (with the published pages)' }, created_at: new Date().toISOString() };
return [{ json: { ...base, ladder, site_rankings: pool.site_rankings || null, reach_cache_row } }];
