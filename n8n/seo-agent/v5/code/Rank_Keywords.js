/*__REACH__*/
/*__RADIUS__*/
/*__FIT_GATE__*/
/*__SITE_MODEL__*/
/*__KW_INPUTS__*/
// Applies the AI relevance verdicts, computes the final opportunity score, builds topic clusters and the content plan,
// and chooses the priority keywords (live SERP check next) and the keyword for the content pipeline.
// v4.8: with a website, every keyword is labelled against the site's reach (difficulty_for_you, plan_type, months) and "Now" means easy or
// reachable for THIS site (the pipeline keyword too); without a website the fixed difficulty limit (55) stays.
// 2026-10-11 (FIX_PLAN D4): the shared fit gate drops government / portal / other-brand keywords before anything is recommended
// (keyword_strategy.refused lists them with a reason); G3: every plan carries its estimated chance band.
// G32 (2026-10-13, FIX_PLAN): the research also draws the site's TOPIC RADIUS (`keyword_strategy.topic_radius`, v5/code/_radius.js) —
// which topics are within reach today, which are a stretch and which are out of reach for now, each with the evidence behind it (the
// difficulty against the measured reach, a position the site already holds, a page it already has, a service it sells).
const base = $('Collect Research').first().json;
const chunks = $('Relevance Chunks').all().map(i => i.json);
const outs = $input.all().map(i => i.json);
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const PAGES = ['Service Page', 'Product Page', 'Landing Page', 'Comparison Page', 'Blog Post', 'Guide', 'FAQ Page', 'Location Page', 'Category Page'];
const defaultPage = (intent) => intent === 'informational' ? 'Guide' : intent === 'transactional' ? 'Landing Page' : 'Service Page';
const rel = new Map();
outs.forEach((o, i) => {
  const items = (parse(o.output).items) || [];
  const chunk = chunks[i] ? chunks[i].keywords_chunk : [];
  items.forEach((it, j) => {
    const kw = String(it.keyword || (chunk[j] || {}).keyword || '').toLowerCase().trim();
    if (!kw) return;
    rel.set(kw, { relevance: Math.max(0, Math.min(2, Number(it.relevance ?? 1))), intent: String(it.intent || '').toLowerCase(), page_type: it.page_type, topic: String(it.topic || '').toLowerCase().replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim() });
  });
});
const RELF = { 2: 1, 1: 0.45, 0: 0 };
const ai_reviewed = rel.size;
let R = null; try { const x = $('Reach (Discovery)').first().json; if (x && reachNum(x.reach) != null) R = x; } catch (e) { R = null; }
const strongR = R ? reachStrong(R, null) : false;
// ---- B1-1 (2026-10-15, benchmark area 1 — BENCH_AREA1_keywords.md): the difficulty is measured on the TOPIC where the site has a record on it ----
// K1's own words for what we had: "domain-level, not per topic". The leaders personalise per topic — MarketMuse subtracts a topic-level
// Topic Authority from the keyword difficulty and states the empty case as a rule ("If you have no Topic Authority, then your Personalized
// Difficulty = Keyword Difficulty", docs.marketmuse.com), Semrush lowers Personal KD with the thematic distance between the domain's core
// topics and the target (semrush.com/blog/ai-keyword-research-updates). The ladder has done this since B2-1; discovery still labelled every
// topic against ONE site-wide number cached up to 30 days (exec 518, 2026-10-13: "reach 10" on every one of 43 clusters). The same kit
// answers it here from the keywords the reach was itself measured on — no new call — and only with REACH_CFG.min_top10 on-topic top-10
// keywords behind it. Below that bar the site-wide reach stays exactly as before and the report says which number it used, and on what.
const reachRanked = R && R.ranked !== undefined ? R.ranked : null;
const reachMissingWhy = R && R.cached && !reachRanked
  ? 'the reach stored on ' + String(R.cached_at || '').slice(0, 10) + ' was kept without the keywords behind it, so this run has no topic evidence to read' : '';
const taCacheD = new Map();
const topicReachOf = (topic, head) => { if (!R) return null; const key = String(topic || head || '').toLowerCase().trim(); if (!key) return null;
  if (!taCacheD.has(key)) taCacheD.set(key, reachTopic(reachRanked, key, R.reach, { domain: base.domain || '', reason_missing: reachMissingWhy }));
  return taCacheD.get(key); };
const forYou = (kd, ta) => { if (!R) return {}; const r = ta && reachNum(ta.reach) != null ? ta.reach : R.reach;
  const diff = difficultyForYou(kd, r, {}); const plan = reachPlan(diff, strongR, reachMeasured((ta && ta.used) ? { used: true } : R, null));   // R49: no band on an unmeasured reach
  return { difficulty_for_you: diff, plan_type: plan.plan_type, months: plan.months, for_you_label: reachLabel(diff, plan), chance: plan.chance,
    reach_used: r, reach_basis: (ta && ta.used) ? 'topic' : 'site', topic_reach: (ta && ta.used) ? ta.topic_reach : null }; };
const winnableFor = (diff, kd) => R ? (diff === 'easy' || diff === 'reachable') : (kd == null || kd <= 55);
// the fit gate's context: the website, the declared competitors (strict), the auto-detected rivals (vendor-like), the brand names AI uses for
// other companies (seo_cache ai_brands:, when the cache was read), and the seeds / services as protected words
let cacheRows = []; try { cacheRows = $('Load Site Cache').all().map(i => i.json); } catch (e) { cacheRows = []; }
const fitCtx = { own_domain: base.domain || '', competitors: (base.competitors || []).map(String), serp_domains: ((base.research || {}).competitor_domains || []).filter(d => !(base.competitors || []).includes(d)),
  brands: fitLearnedBrands(cacheRows), protect: [...(base.seeds || []), ...(base.services || []), String(base.business || '').slice(0, 400)] };
// 2026-10-12 (FIX_PLAN D11): a keyword a live page of the site already answers is labelled `covered_by` (page inventory seo_pages +
// this run's sitemap, SM.matchPage) instead of being recommended as a new page — writing a second page for the same search splits the
// signals. The keyword stays in the list, so the owner can see it and refresh the page that exists.
const siteModelD = (() => { try { const m = $('Site Model').first().json.site_model; return (m && typeof m === 'object') ? m : null; } catch (e) { return null; } })();
const pageModelD = SM.withPages(siteModelD || SM.from({ domain: base.domain || '' }, {}), (base.site_urls || []).map(u => ({ url: u, source: 'sitemap' })));
// R36 (2026-10-16, re-rating 2026-10-15): the keyword's OWN Search Console row was never consulted, so six searches the site already ranks
// for with /dynamics-365-finance-and-operations-uae (one at #6.2) were offered as new "Landing / Location Page" cards. A Search Console row
// whose page is on this site is the strongest evidence there is: the keyword is covered by that page (with its position), and only a
// listing page (the blog index) gives way to the dedicated page the inventory matches (R56).
const siteHostD = String(base.domain || '').toLowerCase().replace(/^www\./, '');
const onSiteD = (u) => { const m = String(u || '').toLowerCase().match(/^https?:\/\/([^\/?#:]+)/); const h = m ? m[1].replace(/^www\./, '') : ''; return !!h && !!siteHostD && (h === siteHostD || h.endsWith('.' + siteHostD)); };
const coveredBy = (kw, gsc) => {
  const m = SM.pages(pageModelD).length ? SM.matchPage(pageModelD, kw, gsc && gsc.page) : null;
  const g = gsc && onSiteD(gsc.page) ? gsc : null;
  if (g && !(m && SM.isListing(g.page) && !SM.isListing(m.url))) return { url: SM.canonUrl(pageModelD, g.page), title: '', matched_by: 'search console', position: g.position ?? null,
    impressions: g.impressions ?? null, ...(m && SM.canonUrl(pageModelD, m.url) !== SM.canonUrl(pageModelD, g.page) ? { inventory_match: SM.canonUrl(pageModelD, m.url) } : {}) };
  return m ? { url: SM.canonUrl(pageModelD, m.url), title: m.title || '', matched_by: m.matched_by, ...(g ? { position: g.position ?? null } : {}), ...(m.listing ? { listing: m.listing } : {}) } : null; };
// 2026-10-12 (FIX_PLAN D20): discovery now loads the site's own keyword ladders too (Load Domain Ladders (Discovery), the archived ones skipped
// through seo_ladder_settings). A keyword a ladder head or one of its rungs already covers is marked `ladder_covered` instead of being
// recommended as a new page: the live run offered "e invoicing" as the top pick while the ladder head "e invoicing in uae" was already running.
// The test is the ladder's own one-search-one-page rule in both directions: the same search (Jaccard >= 0.75, keywordsOverlap) or the keyword's
// every meaningful word inside the ladder keyword ("e invoicing" in "e invoicing in uae").
const ladderRowsD = (() => { try { return $('Load Domain Ladders (Discovery)').all().map(i => i.json).filter(r => r && r.ladder_id && r.keyword); } catch (e) { return []; } })();
const ladderArchivedD = (() => { try { return new Set($('Load Ladder Settings (Discovery)').all().map(i => i.json).filter(r => r && r.ladder_id && String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id))); } catch (e) { return new Set(); } })();
const ladderKwsD = (() => { const out = []; const seen = new Set(); const ourD = reachDomain(base.domain || '');
  for (const r of ladderRowsD) { if (!ourD || reachDomain(r.domain) !== ourD || ladderArchivedD.has(String(r.ladder_id))) continue;
    for (const [kw, part] of [[r.keyword, Number(r.rung) === 4 ? 'head' : 'rung'], [r.head_keyword, 'head']]) { const k = String(kw || '').toLowerCase().trim(); const sig = r.ladder_id + '|' + k + '|' + part;
      if (!k || seen.has(sig)) continue; seen.add(sig);
      out.push({ keyword: k, tokens: overlapTokens(k), part, ladder_id: String(r.ladder_id), head_keyword: String(r.head_keyword || '').toLowerCase().trim(), rung: Number(r.rung) || 0, status: r.status || '', target_url: r.target_url || '' }); } }
  return out; })();
const ladderCovers = (kw) => { if (!ladderKwsD.length) return null; const t = overlapTokens(kw); if (!t.length) return null;
  for (const x of ladderKwsD) { if (!x.tokens.length) continue;
    const same = overlapScore(t, x.tokens) >= 0.75; const inside = t.every(w => x.tokens.includes(w));
    if (same || inside) return { ladder_id: x.ladder_id, head_keyword: x.head_keyword || x.keyword, ladder_keyword: x.keyword, part: x.part, rung: x.rung, status: x.status, target_url: x.target_url, how: same ? 'the same search' : 'part of a broader page' }; }
  return null; };
const refused = [];
const kws = (base.research.candidates || []).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1), competitors_in_top20: k.competitors.length, covered_by: coveredBy(k.keyword, k.gsc), ladder_covered: ladderCovers(k.keyword), ...forYou(k.kd, topicReachOf(r.topic, k.keyword)) };
}).filter(k => k.relevance > 0 && k.intent !== 'navigational').filter(k => {
  const g = fitGate(k.keyword, { ...fitCtx, intent: k.intent });
  if (!g.ok) refused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail });
  return g.ok;
}).sort((a, b) => b.opportunity - a.opportunity);

// ---- G8 / K7 (2026-10-13): clusters by SHARED RESULTS PAGES, not only by the AI's topic label ----
// Two searches Google answers with the same pages want one page, not two. The competitors' own ranking URLs (DataForSEO
// ranked_keywords, already fetched above) give each keyword part of its top 10; Build Keyword Strategy recomputes this with the live
// checks' full top 10 on top. A cluster forms when a keyword shares at least 3 of the head keyword's top-10 URLs.
const serpEntry = (k) => ({ keyword: k.keyword, weight: k.opportunity, volume: k.volume,
  urls: (k.competitors || []).filter(c => c && c.url && Number(c.position) > 0 && Number(c.position) <= 10).map(c => c.url) });
const serpOverlap = KWI.serpClusters(kws.map(serpEntry), {});
const serpHeadOf = new Map();
for (const cl of serpOverlap.clusters) for (const m of cl.keywords) serpHeadOf.set(m.keyword, { head_keyword: cl.head_keyword, shared_urls: m.shared_urls, keyword_count: cl.keyword_count });
for (const k of kws) { const h = serpHeadOf.get(k.keyword); k.serp_cluster = (h && h.head_keyword !== k.keyword) ? h : null; }

// ---- clusters: R40 (2026-10-16) — the one grouping rule the ladder uses too (KWI.pageGroup) ----
// A topic label used to group every keyword that shared it, including keywords whose results pages were compared above and found
// different. Now Google's own answer decides where it was read: a SERP cluster is one page, a keyword compared and shared with no one is
// its own page, and only a keyword whose results page could not be compared is grouped on the AI's topic label.
const comparedD = new Set(serpOverlap.compared_keywords || []);
const cl = new Map();
for (const k of kws) {
  const head = serpHeadOf.get(k.keyword);
  const g = KWI.pageGroup({ keyword: k.keyword, topic: k.topic || 'other', page_type: '', serp_head: head && head.keyword_count > 1 ? head.head_keyword : '', compared: comparedD.has(k.keyword) });
  const key = g.key;
  if (!cl.has(key)) cl.set(key, { topic: k.topic || 'other', grouped_by: g.by, keywords: [], total_volume: 0, total_opportunity: 0, page_types: {}, intents: {} });
  const c = cl.get(key); c.keywords.push(k); c.total_volume += k.volume; c.total_opportunity += k.opportunity;
  c.page_types[k.page_type] = (c.page_types[k.page_type] || 0) + 1; c.intents[k.intent] = (c.intents[k.intent] || 0) + 1;
}
const mode = (o) => (Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [''])[0];
const clusters = [...cl.values()].map(c => { const p = c.keywords[0]; const taC = topicReachOf(c.topic, p.keyword); return {
  topic: c.topic, grouped_by: c.grouped_by, primary_keyword: p.keyword, page_type: mode(c.page_types), intent: mode(c.intents), keyword_count: c.keywords.length,
  total_volume: c.total_volume, total_opportunity: +c.total_opportunity.toFixed(1), primary_kd: p.kd, primary_volume: p.volume, primary_cpc: p.cpc,
  supporting: c.keywords.slice(1, 9).map(k => k.keyword), keywords: c.keywords.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, opportunity: k.opportunity })),
  suggested_title: p.keyword.replace(/\b\w/g, m => m.toUpperCase()), covered_by: p.covered_by || null, ladder_covered: p.ladder_covered || null,
  ...forYou(p.kd, taC), ...(taC && taC.note ? { topic_reach_note: taC.note } : {})
}; }).sort((a, b) => b.total_opportunity - a.total_opportunity);
// Tiers follow the goal: for leads/sales the first "Now" slots go to commercial/transactional topics; research topics support them
const goalNow = (base.goal || 'leads');
const buyerIntent = (c) => c.intent === 'commercial' || c.intent === 'transactional';
const ordered = goalNow === 'traffic' ? clusters : [...clusters.filter(buyerIntent), ...clusters.filter(c => !buyerIntent(c))];
let now = 0, nxt = 0;
ordered.forEach(c => {
  // R58 (2026-10-16): a topic one of the site's ladders or one of its live pages already covers is not "Now" / "Build first" - the report's
  // own header said "let that ladder finish" while the plan's first Now row was the same search. It is listed, with what to do instead.
  if (c.ladder_covered || c.covered_by) { c.tier = 'Covered';
    c.tier_note = c.ladder_covered ? 'in your ladder "' + c.ladder_covered.head_keyword + '" (' + c.ladder_covered.how + ') - let that ladder write it'
      : 'improve the page you have: ' + c.covered_by.url + (c.covered_by.position ? ' (you rank #' + c.covered_by.position + ')' : ''); return; }
  const winnable = winnableFor(c.difficulty_for_you, c.primary_kd);   // v4.8: easy or reachable for this site (fixed 55 without a website)
  if (now < 5 && winnable && (goalNow === 'traffic' || buyerIntent(c) || now >= 4)) { c.tier = 'Now'; now++; }
  else if (nxt < 8) { c.tier = 'Next'; nxt++; }
  else c.tier = 'Later';
});
clusters.sort((a, b) => ({ Now: 0, Next: 1, Later: 2, Covered: 3 }[a.tier] - { Now: 0, Next: 1, Later: 2, Covered: 3 }[b.tier]) || b.total_opportunity - a.total_opportunity);

// ---- G32 / K12: the site's topic radius — in reach, a stretch, or out of reach for now, with the evidence per topic ----
const bestPosD = (c) => { const ps = (c.keywords || []).map(k => { const f = kws.find(x => x.keyword === k.keyword) || {}; const p = Number((f.live && f.live.your_position) || f.your_position || 0); return p > 0 ? p : null; }).filter(p => p != null); return ps.length ? Math.min(...ps) : null; };
const topic_radius = RAD.of({ reach: R ? R.reach : null, reach_method: R ? R.method : '', domain: base.domain || '',
  services: [...(base.services || []), ...(((base.site_description || {}).products_or_services) || [])],
  site_topics: (base.seeds || []).slice(0, 12), pages: SM.pages(pageModelD).map(p => ({ url: p.url, title: p.title })),
  topics: clusters.map(c => ({ topic: c.topic, primary_keyword: c.primary_keyword, kd: c.primary_kd, volume: c.total_volume, keyword_count: c.keyword_count,
    your_position: bestPosD(c), keywords: c.keywords })) });
for (const c of clusters) { const t = RAD.pick(topic_radius, c.topic + ' ' + c.primary_keyword); if (t) { c.radius = t.verdict; c.radius_reason = t.reason; } }

const quick_wins = kws.filter(k => k.relevance === 2 && k.kd != null && k.kd < 30 && k.volume >= 30).slice(0, 12);
const questions = kws.filter(k => /^(how|what|why|when|which|where|who|can|do|does|is|are|should|will)\b/.test(k.keyword)).slice(0, 15);
const long_tail = kws.filter(k => k.words >= 4 && k.relevance === 2).slice(0, 15);
const competitor_gaps = kws.filter(k => k.competitors.length && k.relevance === 2).sort((a, b) => b.volume - a.volume).slice(0, 20);
const by_intent = {}; INTENTS.forEach(x => by_intent[x] = kws.filter(k => k.intent === x).slice(0, 10));

// ---- priority keywords: best opportunity, at most a few per topic ----
// G8 / K4 (2026-10-13): how many keywords get a LIVE results-page check used to be fixed at 8, so the intent and page type of
// everything else came from the AI label alone. CONFIG.live_serp_checks (Normalize Input, default 16, hard cap 25) decides now; one
// check is a DataForSEO live-advanced SERP at depth 10 (about $0.002), so the default costs ~$0.03 a run instead of ~$0.016.
const LIVE_N = KWI.liveChecks(base.live_serp_checks);
const PER_TOPIC = Math.max(2, Math.ceil(LIVE_N / 4));   // 2 at 8 checks, 4 at 16: a wider check must not become one topic's list
const priority = []; const per = {};
const pickPriority = (minVol) => { for (const k of kws) { if (priority.includes(k) || k.relevance < 2 || !(k.volume >= minVol)) continue; per[k.topic] = (per[k.topic] || 0) + 1; if (per[k.topic] > PER_TOPIC) continue; priority.push(k); if (priority.length >= LIVE_N) break; } };
pickPriority(50); if (priority.length < LIVE_N) pickPriority(20); if (priority.length < Math.ceil(LIVE_N * 0.625)) pickPriority(0);
if (!priority.length) priority.push(...kws.slice(0, LIVE_N));
const goal = base.goal || 'leads';
const want = goal === 'traffic' ? ['informational', 'commercial'] : goal === 'brand' ? ['informational', 'commercial', 'transactional'] : ['commercial', 'transactional'];
const fits = (k) => k.relevance === 2 && want.includes(k.intent) && winnableFor(k.difficulty_for_you, k.kd);
const free = (k) => !k.covered_by && !k.ladder_covered;   // D11: a live page already answers it; D20: one of the site's ladders already covers it
// R51 (2026-10-16): "where to start" was "construction project erp", whose searches fell 73% in a year (its own follow-up report advised
// against it). A keyword falling by more than FALLING_PCT a year is the pick only when nothing else qualifies, and then it says so.
const FALLING_PCT = -50;
const falling = (k) => Number(k.trend_yearly) <= FALLING_PCT;
const steady = (k) => !falling(k);
const pick0 = kws.find(k => fits(k) && free(k) && steady(k)) || kws.find(k => fits(k) && free(k)) || kws.find(k => fits(k) && !k.covered_by && steady(k)) || kws.find(k => fits(k) && !k.covered_by)
  || kws.find(k => fits(k) && steady(k)) || kws.find(fits) || priority.find(k => free(k) && steady(k)) || priority.find(free) || priority.find(k => !k.covered_by) || priority[0] || kws[0] || null;
const pipeline = pick0 && falling(pick0) ? { ...pick0, trend_note: 'falling ' + pick0.trend_yearly + '% a year - picked only because no steadier keyword qualified' } : pick0;

return [{ json: { ...base, keyword_strategy: {
  goal, pool_size: base.research.pool_size, ai_reviewed, total_relevant: kws.length, keywords: kws.slice(0, 200),
  clusters, quick_wins, questions, long_tail, competitor_gaps, by_intent, priority, pipeline_keyword: pipeline, topic_radius,
  competitor_domains: base.research.competitor_domains, by_source: base.research.by_source, research_failures: base.research.failures, refused: refused.slice(0, 60),
  covered: kws.filter(k => k.covered_by).slice(0, 20).map(k => ({ keyword: k.keyword, volume: k.volume, url: k.covered_by.url, matched_by: k.covered_by.matched_by, position: k.covered_by.position ?? null })), pages_known: SM.pages(pageModelD).length,
  title_gap: SM.titleGap(pageModelD),   // R34: the pages whose title is not on file (judged by their address only)
  ladder_covered: kws.filter(k => k.ladder_covered).slice(0, 20).map(k => ({ keyword: k.keyword, volume: k.volume, ladder_id: k.ladder_covered.ladder_id, head_keyword: k.ladder_covered.head_keyword, ladder_keyword: k.ladder_covered.ladder_keyword, part: k.ladder_covered.part, rung: k.ladder_covered.rung, status: k.ladder_covered.status, target_url: k.ladder_covered.target_url, how: k.ladder_covered.how })), ladders_known: [...new Set(ladderKwsD.map(x => x.ladder_id))].length,
  reach: R ? { reach: R.reach, method: R.method, p75: R.p75 ?? null, size_reach: R.size_reach ?? null, sample: R.sample ?? null, top10: R.top10 ?? null, organic_keywords: R.organic_keywords ?? null, cached: !!R.cached, cached_at: R.cached_at || null, strong: strongR,
    // B1-1 / B1-2: the site-wide number is only as good as what it was measured on, so the report can name those searches; and how many
    // of the topics below had enough of a record on their OWN topic to be measured on it (the rest keep the site-wide number, and say so).
    measured_on: (reachRanked || []).filter(x => Number(x.position) >= 1 && Number(x.position) <= 10).sort((a, b) => Number(a.position) - Number(b.position)).slice(0, 6).map(x => x.keyword),
    evidence_kept: !!reachRanked, evidence_note: reachMissingWhy,
    topics_measured: clusters.filter(c => c.reach_basis === 'topic').length, topics_total: clusters.length } : null,
  // ---- G8 (2026-10-13): the three new inputs, carried into the report, the callback and the app ----
  // K7: which keywords Google answers with the same pages (recomputed in Build Keyword Strategy once the live checks are in)
  serp_clusters: serpOverlap.clusters.slice(0, 15),
  serp_overlap: { keywords_compared: serpOverlap.keywords_compared, compared_keywords: (serpOverlap.compared_keywords || []).slice(0, 300), clustered: serpOverlap.clustered, min_shared_urls: serpOverlap.min_shared_urls, source: 'competitor rankings' },
  // K6: the site's own Search Console queries that seeded this research, and what they measured
  search_console: (base.search_console && typeof base.search_console === 'object')
    ? (({ measured, ...sc }) => ({ ...sc, seeded: (base.gsc_seeds || []), from_research: (base.research || {}).search_console || null }))(base.search_console)   // R36: `measured` stays internal (it can hold 500 rows)
    : null,
  // K4: how many keywords this run checked live on Google
  live_checks: { planned: priority.length, cap: LIVE_N, per_topic: PER_TOPIC, est_cost_usd: +(priority.length * 0.002).toFixed(3) }
} } }];
