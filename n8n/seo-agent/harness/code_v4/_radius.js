// harness shim (written by build_v4.py section 49, G32): the topic radius — { reach, topics, services, pages, site_topics } -> every topic's verdict with its evidence
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
return $input.all().map(i => { const j = i.json || {}; const rad = RAD.of(j);
  return { json: { ...rad, rows: RAD.rows(rad), labels: RAD.LABEL, picked: j.pick === undefined ? null : RAD.pick(rad, j.pick),
    picked_line: j.pick === undefined ? '' : RAD.line(RAD.pick(rad, j.pick)) } }; });
