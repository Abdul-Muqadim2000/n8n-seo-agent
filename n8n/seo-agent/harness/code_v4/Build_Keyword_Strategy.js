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
// Final keyword strategy: merges AI search demand and the live SERP checks into the ranked keyword set and renders the
// "Keyword Strategy" report. Also exposes keyword_suggestions for the downstream file/email/content steps.
// v4.8: with a website the report shows each keyword's difficulty for this site and plan ("Easy for your site · Direct plan · 2-4 months");
// a priority keyword the site already ranks 1-20 for (live check) counts as easy.
const base = $('Rank Keywords').first().json;
const ks = JSON.parse(JSON.stringify(base.keyword_strategy || {}));
const prio = $('Priority Keywords').all().map(i => i.json);
const serps = $input.all().map(i => i.json);
let aiRes = null; try { aiRes = $('AI Demand').first().json; } catch (e) { aiRes = null; }

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
prio.forEach((p, i) => {
  const res = serps[i]?.tasks?.[0]?.result?.[0] || {};
  const items = res.items || [];
  const organic = items.filter(x => x.type === 'organic');
  const mine = ours ? organic.find(o => normD(o.domain) === ours || normD(o.domain).endsWith('.' + ours)) : null;
  const k = ks.priority.find(x => x.keyword === p.keyword);
  if (!k) return;
  k.live = { top_domains: organic.slice(0, 5).map(o => normD(o.domain)), your_position: mine ? mine.rank_group : null,
    features: [...new Set(items.map(x => x.type))].filter(t => t !== 'organic'), ai_overview: items.some(x => x.type === 'ai_overview'), paa: (items.find(x => x.type === 'people_also_ask') || { items: [] }).items.slice(0, 4).map(q => q.title || q.question).filter(Boolean) };
});
const why = (k) => {
  const bits = [];
  if (k.kd != null && k.kd < 30) bits.push('low competition');
  if (k.cpc != null && k.cpc >= 5) bits.push('high commercial value (CPC ' + k.cpc + ')');
  if (k.intent === 'transactional') bits.push('buyers ready to act');
  else if (k.intent === 'commercial') bits.push('buyers comparing providers');
  else bits.push('research-stage traffic that builds authority');
  if (k.competitors_in_top20) bits.push(k.competitors_in_top20 + ' competitor(s) already rank for it');
  if ((k.serp_types || []).includes('ai_overview')) bits.push('AI Overview present — write a quotable answer block');
  if (k.live && k.live.your_position) bits.push('you are already at #' + k.live.your_position);
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
const keyword_suggestions = { recommended, easy_wins: ks.quick_wins, by_intent: ks.by_intent, topic_clusters: (ks.clusters || []).map(c => ({ topic: c.topic, total_volume: c.total_volume, keyword_count: c.keyword_count, suggested_page: c.page_type, keywords: (c.keywords || []).map(k => k.keyword) })), total_found: ks.total_relevant };

// ---- report ----
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-GB');
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const kdLabel = (v) => v == null ? '—' : v + (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard');
const feat = (k) => { const t = k.serp_types || []; const f = []; if (t.includes('ai_overview')) f.push('AI Overview'); if (t.includes('featured_snippet')) f.push('Snippet'); if (t.includes('video') || t.includes('short_videos')) f.push('Video'); if (t.includes('local_pack') || t.includes('map')) f.push('Local pack'); if (t.includes('people_also_ask')) f.push('PAA'); if (t.includes('shopping') || t.includes('popular_products')) f.push('Shopping'); return f.join(', ') || '—'; };
const trend = (k) => k.trend_yearly == null ? '—' : (k.trend_yearly > 0 ? '+' : '') + k.trend_yearly + '%';
const table = (list, cols) => list.length ? '<table class="t"><tr>' + cols.map(c => '<th>' + c[0] + '</th>').join('') + '</tr>' + list.map(k => '<tr>' + cols.map(c => '<td>' + c[1](k) + '</td>').join('') + '</tr>').join('') + '</table>' : '<p class="muted">Nothing with measurable demand in this group.</p>';
const FY = { easy: 'Easy', reachable: 'Reachable', hard: 'Hard', very_hard: 'Very hard', not_realistic: 'Not realistic' };
const forYouCell = (k) => k.difficulty_for_you ? esc(FY[k.difficulty_for_you] || k.difficulty_for_you) + (k.months ? '<br><span class="muted">' + esc(({ direct: 'direct', short: 'short ladder', full: 'full ladder' })[k.plan_type] || '') + ', ' + esc(k.months) + ' mo</span>' : '') : '—';
const KW0 = [['Keyword', k => esc(k.keyword)], ['Searches/mo', k => num(k.volume)], ['Difficulty', k => kdLabel(k.kd)], ['CPC $', k => k.cpc == null ? '—' : k.cpc], ['Intent', k => cap(k.intent)], ['Trend', k => trend(k)], ['SERP features', k => feat(k)], ['Opportunity', k => num(k.opportunity)]];
const KW = RR ? [...KW0.slice(0, 3), ['For your site', forYouCell], ...KW0.slice(3)] : KW0;
const reachLine = RR ? 'Your site\'s reach: difficulty ' + RR.reach + ' (' + (RR.method === 'percentile' ? '75% of the ' + RR.sample + ' keywords you rank top 10 for are at or below it' : 'from ' + num(RR.top10) + ' keyword(s) in the top 10') + (RR.cached ? ', measured ' + String(RR.cached_at || '').slice(0, 10) : '') + '). "For your site": easy up to reach + 5 or already top 20, reachable up to + 20, hard up to + 40.' : '';
const goalText = { leads: 'enquiries and leads', sales: 'online sales', traffic: 'traffic and authority', brand: 'brand awareness' }[ks.goal] || ks.goal;
const now = (ks.clusters || []).filter(c => c.tier === 'Now'), next = (ks.clusters || []).filter(c => c.tier === 'Next'), later = (ks.clusters || []).filter(c => c.tier === 'Later');
const seeds = (base.seeds || []).slice(0, 10);

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
  ${reachLine ? '<p class="muted">' + esc(reachLine) + '</p>' : ''}

  <div class="callout"><b>Where to start:</b> ${pipeline ? '"' + esc(pipeline.keyword) + '" — ' + num(pipeline.volume) + ' searches/mo, difficulty ' + kdLabel(pipeline.kd) + ', ' + esc(pipeline.intent) + ' intent, best page: ' + esc(pipeline.page_type) + '. ' + (pipeline.for_you_label ? esc(pipeline.for_you_label) + '. ' : '') + esc(pipeline.why) : 'Not enough data to pick a first keyword.'}
  ${now.length ? '<br><b>Build first:</b> ' + now.map(c => esc(c.topic) + ' (' + esc(c.page_type) + ', ' + num(c.total_volume) + '/mo across ' + c.keyword_count + ' keywords)').join(' · ') : ''}</div>

  <h2>Priority keywords (${ks.priority.length}) — live-checked on Google</h2>
  ${ks.priority.map((k, i) => `<div class="card">
    <div class="kw">${i + 1}. ${esc(k.keyword)}</div>
    <p><span class="pill">${num(k.volume)} searches/mo</span><span class="pill">Difficulty ${kdLabel(k.kd)}</span>${k.for_you_label ? '<span class="pill ' + (['easy', 'reachable'].includes(k.difficulty_for_you) ? 'now' : 'later') + '">' + esc(k.for_you_label) + '</span>' : ''}<span class="pill">${cap(k.intent)}</span><span class="pill">${esc(k.page_type)}</span>${k.cpc != null ? '<span class="pill">CPC $' + k.cpc + '</span>' : ''}<span class="pill">Traffic potential ~${num(k.traffic_potential)}/mo</span>${k.ai_search_volume ? '<span class="pill ai">AI search volume ' + num(k.ai_search_volume) + '/mo</span>' : ''}</p>
    <p>${esc(k.why)}</p>
    <p class="muted"><b>Topic:</b> ${esc(k.topic)} · <b>SERP features:</b> ${esc(k.live ? (k.live.features.join(', ') || 'none') : feat(k))} · <b>Who ranks now:</b> ${esc(k.live ? (k.live.top_domains.join(', ') || 'unknown') : 'not checked')}${base.domain ? ' · <b>Your position:</b> ' + (k.live && k.live.your_position ? '#' + k.live.your_position : 'not in top 20') : ''}${k.live && k.live.paa.length ? '<br><b>People also ask:</b> ' + esc(k.live.paa.join(' · ')) : ''}</p>
  </div>`).join('') || '<p class="muted">No priority keywords could be determined.</p>'}

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

  <h2>How this was built</h2>
  <p class="muted">Seeds: ${esc(seeds.join(', '))}. Sources: ${esc(Object.entries(ks.by_source || {}).map(([k, v]) => k + ' ' + v).join(', '))}. Opportunity = traffic potential (volume after SERP-feature click loss) × winnability (difficulty and top-10 link strength) × commercial value (CPC) × intent weight for your goal × trend, then multiplied by AI relevance (2 = core, 1 = adjacent, 0 = dropped).${(ks.research_failures || []).length ? ' Some data pulls failed: ' + esc(ks.research_failures.join('; ')) + '.' : ''}</p>
  <p class="by">Prepared by ${esc(base.brand || 'Dev SEO')} · Search volumes, difficulty, CPC and SERP features from DataForSEO for ${esc(base.country)}.</p>
</div>`;

// Options for the form-only "Choose your keyword" step (the number prefix makes the pick unambiguous)
const choice_options = ['Let the system choose for my goal', ...ks.priority.slice(0, 8).map((k, i) => (i + 1) + '. ' + k.keyword + ' · ' + num(k.volume) + ' searches/mo · difficulty ' + (k.kd == null ? '?' : k.kd) + ' · ' + cap(k.intent) + ' · ' + k.page_type + (k.for_you_label ? ' · ' + k.for_you_label : ''))];
return [{ json: { ...base, keyword_strategy: ks, keyword_suggestions, result_html: html, choice_options } }];
