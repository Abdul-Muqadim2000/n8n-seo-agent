
// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data', 'Candidate SERP', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand', 'Run Ladder Research'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer', 'Keyword Relevance', 'Ladder Keyword Relevance', 'Critic'];
const run_ledger = { dataforseo_usd: 0, dataforseo_calls: 0, by_node: {}, ai_calls: 0, ai_nodes: [], started_at: null, finished_at: new Date().toISOString(), duration_min: null };
for (const n of __LEDGER_NODES) {
  let items = []; try { items = $(n).all(); } catch (e) { continue; }
  for (const it of items) {
    const j = (it && it.json) || {}; let c = 0;
    if (Array.isArray(j.tasks)) { for (const t of j.tasks) c += Number((t && t.cost) || 0); } else if (j.cost) { c += Number(j.cost) || 0; }
    run_ledger.dataforseo_calls++;
    if (c) { run_ledger.dataforseo_usd += c; run_ledger.by_node[n] = +((run_ledger.by_node[n] || 0) + c).toFixed(4); }
  }
}
for (const n of __AI_NODES) { try { const k = $(n).all().length; if (k) { run_ledger.ai_calls += k; run_ledger.ai_nodes.push(n); } } catch (e) {} }
try { run_ledger.started_at = $('Normalize Input').first().json.started_at || null; } catch (e) {}
if (run_ledger.started_at) run_ledger.duration_min = +(((Date.now() - new Date(run_ledger.started_at)) / 60000).toFixed(1));
run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);
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
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, SOURCES, BASIS, MISSING };
})();
const d = $('Ladder Plan').first().json;   // v4.8: the reach cache row is saved in between; 2026-10-11: D26 (AI Overview as a timed observation), G3 (2025 base rate + chance band), D8 (refused brands listed)
const L = d.ladder || {};
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || n === '' || isNaN(n)) ? 'N/A' : Number(n).toLocaleString('en-GB');
const SHORT = { easy: 'easy for you', reachable: 'reachable', hard: 'hard', very_hard: 'very hard' };   // v4.8: difficulty relative to the site's reach
const kdLabel = (v) => v == null ? 'N/A' : v + (L.reach != null ? ' · ' + SHORT[difficultyForYou(v, L.reach, {})] : (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard'));
const posText = (p) => p ? '#' + p : 'not in top 60';
const months = (m) => Array.isArray(m) ? (m[0] === m[1] ? 'month ' + m[0] : 'months ' + m[0] + '-' + m[1]) : '—';
let secNo = 0;
const h2 = (title, pageBreak) => '<h2' + (pageBreak ? ' class="pb"' : '') + '>' + (++secNo) + '. ' + esc(title) + '</h2>';
const kv = (rows) => '<table class="kv">' + rows.map(r => '<tr><td class="k">' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>').join('') + '</table>';
const ul = (arr) => (arr && arr.length) ? '<ul>' + arr.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p>None</p>';
const today = new Date().toISOString().slice(0, 10);
const f = L.feasibility || {}; const head = L.head || {}; const top = L.top || {}; const st = L.stats || {};
const rungs = (L.rungs || []).filter(r => r.pages && r.pages.length);
const allPages = rungs.flatMap(r => r.pages);
const statusLabel = { winnable: 'Winnable', stretch: 'A stretch — possible with authority building', unrealistic: 'Not realistic as the top rung' }[f.status] || esc(f.status);
// v4.8: the plan for this site (reach, difficulty for you, plan type, order); a refused ladder (duplicate / not realistic) has no pages
const planned = L.planned !== false; const ri = L.reach_info || {};
const DIFF = { easy: 'Easy for your site', reachable: 'Reachable for your site', hard: 'Hard for your site', very_hard: 'Very hard for your site', not_realistic: 'Not realistic for your site' };
const PLAN = { direct: 'Direct plan', short: 'Short ladder', full: 'Full ladder', none: 'No ladder' };
const planName = (PLAN[L.plan_type] || 'Full ladder') + (L.stretch ? ' (stretch)' : '');
const reachHow = ri.method === 'percentile' ? '75% of the ' + num(ri.sample) + ' keywords ' + esc(L.domain) + ' ranks in the top 10 for have a difficulty of ' + ri.p75 + ' or lower'
  : ri.method === 'size' ? esc(L.domain) + ' ranks in the top 10 for ' + num(ri.top10) + ' keyword' + (ri.top10 === 1 ? '' : 's') + (ri.sample ? ' (too few with a known difficulty to measure)' : '') + '; sites of that size usually win keywords up to difficulty ' + ri.size_reach
  : 'the site\'s rankings could not be read, so the starting value for a new site is used';
const reachText = 'Your site\'s reach is difficulty <b>' + esc(L.reach) + '</b>: ' + reachHow + (ri.cached ? ' (measured ' + esc(String(ri.cached_at || '').slice(0, 10)) + ', kept 30 days)' : '') + '.';
const diffWhy = L.difficulty_for_you === 'not_realistic' ? 'people searching it look for one particular website or brand, or the verdict says to avoid it'
  : (head.your_position && head.your_position <= 20) ? 'you already rank #' + head.your_position + ' for it'
  : 'its difficulty is ' + (head.kd == null ? 'unknown (counted as ' + (Number(L.reach) + 10) + ')' : head.kd) + ' against your reach of ' + esc(L.reach);
const orderText = { direct: 'Write the main page first (it is within reach now), then ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) that link to it.',
  short: 'Write ' + Math.max(0, (L.stats || {}).rung_pages || 0) + ' supporting page(s) first; the main page follows once half of them are live (or it already ranks in the top 30).',
  full: 'Climb rung by rung from the easiest pages; the main page comes last, once the rungs below support it.' + (L.stretch ? ' It is very hard for your site today, so consider the alternatives first.' : ''),
  none: '' }[L.plan_type] || '';
const mainOnly = L.planned && L.plan_type !== 'direct' && !((L.stats || {}).rung_pages);   // no supporting keywords in the data: the main page is written first
const orderLine = mainOnly ? 'No supporting keywords were found in the search data for this topic, so the main page is the whole ladder for now and is written first; supporting pages can be added as the site grows.' : orderText;
const chanceLine = planned && L.chance && L.chance.label ? '<p><b>Estimated chance</b> of reaching the top 10 within ' + esc(L.months) + ' months: <b>' + esc(L.chance.band) + '</b> (' + L.chance.range[0] + '-' + L.chance.range[1] + '%) — ' + esc(REACH_CHANCE_NOTE) + '. ' + esc(reachBaseRateText()) + '</p>' : '';
const refusedLine = (L.refused_keywords || []).length ? '<p class="small">Left out as other companies\' brands, government or portal searches, or navigational: ' + L.refused_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '" (' + esc(x.reason) + ')').join(', ') + (L.refused_keywords.length > 12 ? ' …' : '') + '.</p>' : '';
const whyPlan = () => h2('Why this plan') + '<p>' + reachText + '</p><p>"' + esc(head.keyword) + '" is <b>' + esc(DIFF[L.difficulty_for_you] || L.difficulty_for_you) + '</b>: ' + diffWhy + '.</p>' +
  (planned ? '<p><b>' + esc(planName) + ' — about ' + esc(L.months) + ' months.</b> ' + esc(orderLine) + '</p>' + chanceLine : '<div class="note"><b>No ladder planned.</b> ' + esc((L.refusal || {}).message || '') + '</div>') +
  ((L.excluded_keywords || []).length ? '<p class="small">Left out because another ladder of this site already covers them (one search, one page): ' + L.excluded_keywords.slice(0, 12).map(x => '"' + esc(x.keyword) + '"').join(', ') + (L.excluded_keywords.length > 12 ? ' …' : '') + '.</p>' : '') + refusedLine +
  '<p class="small">Difficulty for your site: easy up to reach + 5 (or you already rank in the top 20), reachable up to reach + 20, hard up to reach + 40, very hard above. Easy → direct plan (2-4 months, estimated chance good), reachable → short ladder (4-8, fair), hard → full ladder (9-15, low), very hard → full ladder as a stretch (slim); a little faster for strong sites. The month ranges follow the 2025 Ahrefs study (' + REACH_BASE_RATE.top10_within_year_pct + '% of new pages reach the top 10 within a year; ' + REACH_BASE_RATE.of_those_within_month_pct + '% of those within a month); the chance bands are uncalibrated estimates until this system has measured its own ladders.</p>';
// D26: the results page at the time of the check — an observation, not a fact about the query
const sf = d.serp_features || null;
const serpObsLine = sf && !sf.unavailable ? '<p class="small">Results page in the check at ' + esc(obsClock(sf.checked_at || (sf.ai_overview || {}).seen_at)) + ': AI Overview ' + esc(aioObserved([{ seen: (sf.ai_overview || {}).present, at: sf.checked_at || (sf.ai_overview || {}).seen_at }]).text) + ((sf.ai_overview || {}).present && ((sf.ai_overview || {}).cited_domains || []).length ? ' In that check it cited ' + esc(sf.ai_overview.cited_domains.slice(0, 8).join(', ')) + '.' : '') + (sf.featured_snippet ? ' Featured snippet held by ' + esc(sf.featured_snippet.domain) + ' in that check.' : '') + '</p>'
  : sf && sf.unavailable ? '<p class="small">The live results page could not be read for this run (' + esc(sf.error || 'no answer') + '): whether an AI Overview or a featured snippet appears is unknown.</p>' : '';
const statusClass = f.status === 'winnable' ? 'ok' : (f.status === 'unrealistic' ? 'bad' : '');
const parts = [];

parts.push(`
<div class="cover">
  <div class="brand">Keyword Ladder Plan</div>
  <h1 class="title">${esc(head.keyword)}</h1>
  <p class="sub">${esc(L.domain)} &nbsp;•&nbsp; ${esc(L.country)} &nbsp;•&nbsp; ${today}</p>
  <p class="by">Prepared by ${esc(d.brand || 'Dev SEO')}</p>
</div>`);

// 1. Summary
parts.push(h2('The plan in one page') + kv([
  ['Destination keyword', '<b>' + esc(head.keyword) + '</b> — ' + num(head.volume) + ' searches/mo, difficulty ' + kdLabel(head.kd) + (head.cpc != null ? ', CPC ' + String(Math.round(Number(head.cpc) * 100) / 100) : '')],
  ['Is it realistic?', '<span class="' + statusClass + '">' + statusLabel + '</span>' + (f.score != null ? ' (verdict ' + esc(f.verdict) + ', ' + f.score + '/100)' : '')],
  ...(L.stretch && (f.alternatives || []).length ? [['Consider first', f.alternatives.map(a => '"' + esc(a) + '"').join(' · ') + ' — realistic alternatives; the full ladder below is a stretch']] : []),
  ['For your site', '<b>' + esc(DIFF[L.difficulty_for_you] || '—') + '</b> · reach ' + esc(L.reach) + ' · ' + (planned ? esc(planName) + ' · about ' + esc(L.months) + ' months' : 'no ladder planned')],
  ['Where you rank today', (head.your_position ? '#' + head.your_position + ' for the destination keyword' : 'not in the top 60 for the destination keyword') + (st.site_rankings_found ? '; the site ranks for ' + num(st.site_rankings_found) + ' keywords in the top 60' : '')],
  ['The ladder', planned ? num(st.pages_total) + ' pages: ' + rungs.map(r => r.pages.length + ' on rung ' + r.rung).join(', ') + (rungs.length ? ' and' : '') + ' the main page — ' + esc(L.order || '') : 'none — ' + esc((L.refusal || {}).reason === 'duplicate' ? 'this website already has a ladder for this keyword' : 'not realistic for this site')],
  ['Timeline', (L.timeline || []).map(t => esc(t.label) + ': ' + months(t.months)).join(' · ') || '—'],
  ['Traffic potential', planned ? '~' + num(st.traffic_potential_total) + ' visits/month across the ladder once the pages rank in the top 3' : '—'],
  // R1 (2026-10-13): the plan used to call these pages written and promise them as page content before the page run had even started — and a
  // run the day's AI budget refused then left nothing behind but a ladder row saying "writing" (live: execution 500).
  ['Started now', (L.write_now || []).length ? (L.write_now || []).map(w => '"' + esc(w.keyword) + '" (rung ' + w.rung + ')').join(', ') + ' — started as its own page run; each arrives as its own report. A run the day\'s AI budget refuses writes nothing and puts the page back to "planned" for the next weekly run.' : 'none'],
  ['Tracking', planned ? 'Positions checked ' + esc((L.tracker || {}).cadence || 'weekly') + '; progress e-mail with the next rung; once the top page holds the top 3 for 4 checks it is checked monthly' : 'nothing to track']
]) + ((L.notes || []).filter(n => !(L.refusal && n === L.refusal.message)).length ? '<div class="note">' + L.notes.filter(n => !(L.refusal && n === L.refusal.message)).map(esc).join('<br>') + '</div>' : ''));

// 2. Why this plan (v4.8)
parts.push(whyPlan());

// 3. Feasibility
parts.push(h2('Is the destination realistic?') +
  '<p>Google ranks the head term for the site with the most complete, trusted coverage of the topic. The ladder builds that coverage from the bottom: specific pages that are winnable now, linking up to one strong page for the head term.</p>' +
  '<h3>Why</h3>' + ul(f.reasons) + serpObsLine +
  ((f.what_must_change || []).length ? '<h3>What must change first</h3>' + ul(f.what_must_change) : '') +
  ((f.alternatives || []).length ? '<div class="note"><b>Realistic alternative top rungs:</b> ' + f.alternatives.map(esc).join(' · ') + '. ' + (f.status === 'unrealistic' ? 'Brand terms of other companies are navigational and out of reach; pick one of these as the destination instead.' : 'Consider one of these if authority building stalls.') + '</div>' : '') +
  kv([['Expected visits/month at #1-3', f.expected_visits_top3 != null ? num(f.expected_visits_top3) : 'N/A'], ['Time to rank (verdict estimate)', f.time_to_rank_months != null ? f.time_to_rank_months + ' months' : 'N/A']]));

// 4. The ladder (only when pages were planned)
if (planned) {
let ladderHtml = h2('The ladder', true) + '<p class="small">One page per topic. Lower rungs are specific and winnable; each rung links up to the top page. Pages marked "improve" already exist on your site.</p>';
for (const r of rungs) {
  ladderHtml += '<h3>' + esc(r.label) + ' — ' + months(r.months) + '</h3>' +
    '<table class="ct"><tr><th>#</th><th>Page (primary keyword)</th><th>Supporting keywords</th><th>Page type</th><th>Searches/mo</th><th>Difficulty</th><th>You today</th><th>Page on site</th></tr>' +
    r.pages.map(p => '<tr><td>' + p.page_no + '</td><td><b>' + esc(p.keyword) + '</b></td><td>' + esc((p.supporting || []).join(', ') || '—') + '</td><td>' + esc(p.page_type) + '</td><td>' + num(p.total_volume) + '</td><td>' + kdLabel(p.kd) + '</td><td>' + esc(posText(p.your_position)) + '</td><td>' + (p.exists ? '<span class="ok">improve</span><br><span class="small">' + esc(p.target_url) + '</span>' : 'new<br><span class="small">' + esc(p.target_url) + '</span>') + '</td></tr>').join('') + '</table>';
}
ladderHtml += '<h3>Top — ' + esc(top.keyword) + ' — ' + months(top.months) + '</h3>' + kv([
  ['Page', (top.exists ? '<span class="ok">improve</span> ' : 'new ') + esc(top.target_url)],
  ['Page type', esc(top.page_type)], ['Supporting keywords', esc((top.supporting || []).join(', ') || '—')],
  ['Searches/mo · difficulty', num(top.volume) + ' · ' + kdLabel(top.kd)], ['You today', esc(posText(top.your_position))], ['When', L.plan_type === 'direct' || mainOnly ? 'written first — ' + months(top.months) : months(top.months)]
]);
parts.push(ladderHtml);

// G32 / K12 (2026-10-13, FIX_PLAN): the site's topic radius — the topics of this ladder that are within reach today, the ones that are a
// stretch and the ones that are out of reach for now, each with the evidence behind the verdict (v5/code/_radius.js, built in Ladder Plan).
// It is shown, not enforced: the plan above is unchanged by it.
const radL = L.topic_radius || null;
const radRowsL = radL ? [...(radL.in_reach || []), ...(radL.stretch || []), ...(radL.far || [])] : [];
if (radRowsL.length) parts.push(h2('Your topic radius: what is within reach and what is a stretch') + '<p class="small">' + esc(radL.summary) + '</p>'
  + '<table class="ct"><tr><th>Topic</th><th>Verdict</th><th>Why</th><th>On what evidence</th></tr>'
  + radRowsL.slice(0, 20).map(t => '<tr><td><b>' + esc(t.topic) + '</b><br>' + esc(t.primary_keyword) + '</td><td>' + esc(t.verdict_label) + '</td><td>' + esc(t.reason) + '</td><td>' + esc((t.evidence || []).join('; ')) + '</td></tr>').join('')
  + '</table><p class="small">' + esc(radL.note) + '</p>');

// 5. Internal link map
parts.push(h2('Internal link map') + '<p class="small">Every rung page links up to the top page and sideways to one sibling; the top page links down to every rung page.</p>' +
  '<table class="ct"><tr><th>From</th><th>Links to</th><th>Type</th></tr>' + (L.link_map || []).slice(0, 60).map(l => '<tr><td>' + esc(l.from) + '</td><td>' + esc(l.to) + '</td><td>' + esc(l.type) + '</td></tr>').join('') + '</table>');

// 6. Write now
parts.push(h2('Pages written now') + ((L.write_now || []).length ? '<table class="ct"><tr><th>#</th><th>Keyword</th><th>Page type</th><th>URL</th><th>Links to</th></tr>' +
  L.write_now.map(w => '<tr><td>' + w.page_no + '</td><td><b>' + esc(w.keyword) + '</b></td><td>' + esc(w.page_type) + '</td><td>' + esc(w.target_url) + (w.exists ? ' (improve)' : ' (new)') + '</td><td>' + esc((w.links_to || []).map(x => x.keyword).join(', ')) + '</td></tr>').join('') + '</table>' +
  '<p>Each page runs through the full content pipeline (competitor analysis, verified facts, brief, copywriter, critic, QA, editor) and arrives as its own PDF and Word file' + (d.email ? ' at ' + esc(d.email) : '') + '. Publish it at the URL above, then the weekly tracker measures the climb.</p>' : '<p>No pages requested now.</p>'));

// 7. Requirements
parts.push(h2('What else is needed') + '<table class="ct"><tr><th>Item</th><th>Detail</th></tr>' + (L.requirements || []).map(r => '<tr><td><b>' + esc(r.item) + '</b></td><td>' + esc(r.detail) + '</td></tr>').join('') + '</table>');

// 8. Tracking
parts.push(h2('Tracking and next rungs') + '<p>The ladder is registered for ' + esc((L.tracker || {}).cadence || 'weekly') + ' position checks (Google top 100 for every page\'s primary keyword). The progress e-mail shows position changes, which rungs are in the top 10 / top 3, and the recommendation for the next rung with a ready-to-send request. ' +
  ((L.tracker || {}).auto_next_rung ? 'The next rung\'s pages are generated automatically.' : 'Pages for the next rung are written when you confirm (recommend-only mode).') + ' Once the top page has held the top 3 for 4 checks, the main keyword and the published pages are checked monthly, so a drop is noticed.</p>');
}

// 9. Later
if ((L.later || []).length) parts.push(h2(planned ? 'Keywords for later (difficulty above ' + (Number(L.reach) + 30) + ', or beyond this plan\'s pages)' : 'Keywords found around the main keyword') + '<table class="ct"><tr><th>Keyword</th><th>Searches/mo</th><th>Difficulty</th></tr>' + L.later.map(k => '<tr><td>' + esc(k.keyword) + '</td><td>' + num(k.volume) + '</td><td>' + kdLabel(k.kd) + '</td></tr>').join('') + '</table>');

// 10. Method
parts.push(h2('How this was built') + '<p class="small">' + num(st.pool_size) + ' keywords were pulled around the head term (long-tail suggestions, related searches, keyword ideas for the head term and your services, and the keywords your site already ranks for). ' + num(st.ai_reviewed) + ' were screened by AI for topical relevance to the head term; ' + num(st.relevant) + ' survived. Rungs follow difficulty relative to your reach (' + esc(L.reach) + '): rung 1 up to the reach (long-tail, 20+ searches), rung 2 up to reach + 15, rung 3 up to reach + 30, the head term on top; keywords other ladders of this site already cover are left out. One page per topic cluster, 2-4 pages per rung; a direct plan keeps 2-3 supporting pages, a short ladder 3-5. Traffic potential = searches after SERP-feature click loss × a top-3 click share. Positions and metrics from DataForSEO for ' + esc(L.country) + '.' + ((st.research_failures || []).length ? ' Some data pulls failed: ' + esc(st.research_failures.join('; ')) + '.' : '') + '</p>');

// G29 (2026-10-13, FIX_PLAN): the same plan with every figure's source, period and sample, as a table and as structured fields
const lineage = [
  LN.of('Searches per month and difficulty', 'kwdata', { basis: 'estimated', period: 'the provider\'s latest 12-month average', sample: LN.sample(st.pool_size, 'keywords pulled'),
    note: 'a provider estimate for ' + String(L.country || '') + ', not a measurement of your site; a single keyword\'s volume can be well off' }),
  LN.of('Traffic potential per page', 'model', { basis: 'modelled', period: 'per month, once the page ranks', sample: LN.sample((L.rungs || []).length, 'rungs planned'),
    note: 'searches after results-page click loss × a top-3 click share — modelled, never measured clicks' }),
  LN.of('Difficulty for your site and the plan type', 'model', { basis: 'modelled', period: LN.asOf(today), sample: 'your site\'s reach ' + String(L.reach == null ? 'unknown' : L.reach),
    note: 'your reach against each keyword\'s difficulty; the month ranges and chances are modelled from published base rates, not from your own history yet' }),
  LN.of('Who ranks now and which results-page features show', 'serp', { basis: 'one_sample', period: LN.asOf(today), sample: LN.sample((d.live_checks && d.live_checks.done) || (L.rungs || []).length, 'keywords checked live on Google'),
    note: 'one results page per keyword at one moment, from ' + String(L.country || 'the chosen country') }),
];
parts.push(h2('Where these numbers come from') + '<table class="ct"><tr><th>Figure</th><th>Source</th><th>Period</th><th>Sample</th><th>How it was arrived at</th></tr>'
  + lineage.map(l => '<tr><td>' + esc(l.figure) + '</td><td>' + esc(l.source_label) + '</td><td>' + esc(l.period || '—') + '</td><td>' + esc(l.sample || '—') + '</td><td>' + esc([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
  + '</table><p class="small">A figure marked "modelled, not measured" is computed, not counted.</p>');

const css = `
@page { margin: 0.9in; }
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 28px 30px; margin-bottom: 24px; }
.brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.title { font-size: 26pt; margin: 6px 0; color: #fff; border: none; }
.sub { color: #CBD5E1; margin: 0; }
.by { color: #93C5FD; margin: 10px 0 0; font-size: 10pt; }
h2 { color: #1E3A8A; font-size: 15pt; margin-top: 26px; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; }
h3 { color: #334155; font-size: 12.5pt; margin-top: 16px; }
p { margin: 0 0 9px; }
.kv { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
.kv td { padding: 7px 10px; border: 1px solid #E2E8F0; font-size: 10pt; vertical-align: top; }
.kv .k { width: 190px; font-weight: bold; background: #EEF2FF; color: #0F172A; }
.ct { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }
.ct th { background: #1E3A8A; color: #fff; padding: 6px; text-align: left; border: 1px solid #1E3A8A; }
.ct td { padding: 6px; border: 1px solid #CBD5E1; vertical-align: top; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 10px 14px; margin: 12px 0; }
.ok { color: #15803D; font-weight: bold; }
.bad { color: #B91C1C; font-weight: bold; }
.small { font-size: 9pt; color: #64748B; }
.pb { page-break-before: always; }`;
const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(head.keyword)} — Keyword Ladder Plan</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${css}</style></head>
<body>${parts.join('\n')}</body></html>`;
const safe = String(head.keyword || 'keyword').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileName = 'keyword-ladder-' + safe + '-' + today + '.doc';
// drop the large intermediate fields; keep what delivery, the store rows and the page runs need
const slim = { ...d, site_text: undefined, client_pages: undefined, existing_page_text: undefined, competitor_digest: undefined, term_digest: undefined, term_model: undefined,
  competitors_summary: undefined, competitor_questions: undefined, stats_seen: undefined, facts: undefined, extra_questions: undefined, serp_digest: undefined,
  site_urls: undefined, internal_link_candidates: undefined, research: undefined, competitor_analysis: undefined, serp_features: undefined, result_html: undefined, reach_cache_row: undefined };
return [{
  json: { ...slim, run_ledger, lineage, request_id: d.request_id || null, report_type: 'Keyword Ladder Plan', file_name: fileName, ladder_id: L.ladder_id, site_urls_count: (d.site_urls || []).length,
    qa_summary: 'Ladder plan: ' + num(st.pages_total) + ' pages, ' + (L.write_now || []).length + ' written now' },
  binary: { data: { data: Buffer.from('﻿' + html, 'utf8').toString('base64'), mimeType: 'application/msword', fileName, fileExtension: 'doc' } }
}];
