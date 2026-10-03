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
  return { plan_type, months: m ? m[0] + '-' + m[1] : '', months_range: m ? m.slice() : null, stretch: difficulty === 'very_hard' };
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
// Applies the AI relevance verdicts, computes the final opportunity score, builds topic clusters and the content plan,
// and chooses the priority keywords (live SERP check next) and the keyword for the content pipeline.
// v4.8: with a website, every keyword is labelled against the site's reach (difficulty_for_you, plan_type, months) and "Now" means easy or
// reachable for THIS site (the pipeline keyword too); without a website the fixed difficulty limit (55) stays.
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
const forYou = (kd) => { if (!R) return {}; const diff = difficultyForYou(kd, R.reach, {}); const plan = reachPlan(diff, strongR); return { difficulty_for_you: diff, plan_type: plan.plan_type, months: plan.months, for_you_label: reachLabel(diff, plan) }; };
const winnableFor = (diff, kd) => R ? (diff === 'easy' || diff === 'reachable') : (kd == null || kd <= 55);
const kws = (base.research.candidates || []).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1), competitors_in_top20: k.competitors.length, ...forYou(k.kd) };
}).filter(k => k.relevance > 0 && k.intent !== 'navigational').sort((a, b) => b.opportunity - a.opportunity);

// ---- clusters (topic label from the AI pass) ----
const cl = new Map();
for (const k of kws) {
  const key = k.topic || 'other';
  if (!cl.has(key)) cl.set(key, { topic: key, keywords: [], total_volume: 0, total_opportunity: 0, page_types: {}, intents: {} });
  const c = cl.get(key); c.keywords.push(k); c.total_volume += k.volume; c.total_opportunity += k.opportunity;
  c.page_types[k.page_type] = (c.page_types[k.page_type] || 0) + 1; c.intents[k.intent] = (c.intents[k.intent] || 0) + 1;
}
const mode = (o) => (Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [''])[0];
const clusters = [...cl.values()].map(c => { const p = c.keywords[0]; return {
  topic: c.topic, primary_keyword: p.keyword, page_type: mode(c.page_types), intent: mode(c.intents), keyword_count: c.keywords.length,
  total_volume: c.total_volume, total_opportunity: +c.total_opportunity.toFixed(1), primary_kd: p.kd, primary_volume: p.volume, primary_cpc: p.cpc,
  supporting: c.keywords.slice(1, 9).map(k => k.keyword), keywords: c.keywords.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, opportunity: k.opportunity })),
  suggested_title: p.keyword.replace(/\b\w/g, m => m.toUpperCase()), ...forYou(p.kd)
}; }).sort((a, b) => b.total_opportunity - a.total_opportunity);
// Tiers follow the goal: for leads/sales the first "Now" slots go to commercial/transactional topics; research topics support them
const goalNow = (base.goal || 'leads');
const buyerIntent = (c) => c.intent === 'commercial' || c.intent === 'transactional';
const ordered = goalNow === 'traffic' ? clusters : [...clusters.filter(buyerIntent), ...clusters.filter(c => !buyerIntent(c))];
let now = 0, nxt = 0;
ordered.forEach(c => {
  const winnable = winnableFor(c.difficulty_for_you, c.primary_kd);   // v4.8: easy or reachable for this site (fixed 55 without a website)
  if (now < 5 && winnable && (goalNow === 'traffic' || buyerIntent(c) || now >= 4)) { c.tier = 'Now'; now++; }
  else if (nxt < 8) { c.tier = 'Next'; nxt++; }
  else c.tier = 'Later';
});
clusters.sort((a, b) => ({ Now: 0, Next: 1, Later: 2 }[a.tier] - { Now: 0, Next: 1, Later: 2 }[b.tier]) || b.total_opportunity - a.total_opportunity);

const quick_wins = kws.filter(k => k.relevance === 2 && k.kd != null && k.kd < 30 && k.volume >= 30).slice(0, 12);
const questions = kws.filter(k => /^(how|what|why|when|which|where|who|can|do|does|is|are|should|will)\b/.test(k.keyword)).slice(0, 15);
const long_tail = kws.filter(k => k.words >= 4 && k.relevance === 2).slice(0, 15);
const competitor_gaps = kws.filter(k => k.competitors.length && k.relevance === 2).sort((a, b) => b.volume - a.volume).slice(0, 20);
const by_intent = {}; INTENTS.forEach(x => by_intent[x] = kws.filter(k => k.intent === x).slice(0, 10));

// ---- priority keywords: best opportunity, at most 2 per topic ----
const priority = []; const per = {};
const pickPriority = (minVol) => { for (const k of kws) { if (priority.includes(k) || k.relevance < 2 || k.volume < minVol) continue; per[k.topic] = (per[k.topic] || 0) + 1; if (per[k.topic] > 2) continue; priority.push(k); if (priority.length >= 8) break; } };
pickPriority(50); if (priority.length < 8) pickPriority(20); if (priority.length < 5) pickPriority(0);
if (!priority.length) priority.push(...kws.slice(0, 8));
const goal = base.goal || 'leads';
const want = goal === 'traffic' ? ['informational', 'commercial'] : goal === 'brand' ? ['informational', 'commercial', 'transactional'] : ['commercial', 'transactional'];
const pipeline = kws.find(k => k.relevance === 2 && want.includes(k.intent) && winnableFor(k.difficulty_for_you, k.kd)) || priority[0] || kws[0] || null;

return [{ json: { ...base, keyword_strategy: {
  goal, pool_size: base.research.pool_size, ai_reviewed, total_relevant: kws.length, keywords: kws.slice(0, 200),
  clusters, quick_wins, questions, long_tail, competitor_gaps, by_intent, priority, pipeline_keyword: pipeline,
  competitor_domains: base.research.competitor_domains, by_source: base.research.by_source, research_failures: base.research.failures,
  reach: R ? { reach: R.reach, method: R.method, p75: R.p75 ?? null, size_reach: R.size_reach ?? null, sample: R.sample ?? null, top10: R.top10 ?? null, organic_keywords: R.organic_keywords ?? null, cached: !!R.cached, cached_at: R.cached_at || null, strong: strongR } : null
} } }];
