/*__REACH__*/
/*__SERP_OBS__*/
/*__KW_INPUTS__*/
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
  search_console: ks.search_console || null, serp_clusters: (ks.serp_clusters || []).map(c => ({ head_keyword: c.head_keyword, keyword_count: c.keyword_count, keywords: (c.keywords || []).map(k => k.keyword), shared_urls: c.min_shared_urls })) };

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
  <p class="muted">Seeds: ${esc(seeds.join(', '))}${SC && (SC.seeded || []).length ? ', plus your own Search Console searches: ' + esc(SC.seeded.slice(0, 10).join(', ')) : ''}. Sources: ${esc(Object.entries(ks.by_source || {}).map(([k, v]) => k + ' ' + v).join(', '))}. Opportunity = traffic potential (volume after SERP-feature click loss) × winnability (difficulty and top-10 link strength) × commercial value (CPC) × intent weight for your goal × trend, then multiplied by AI relevance (2 = core, 1 = adjacent, 0 = dropped). Traffic potential is <b>calibrated</b> where Search Console measured that exact search on your site (its impressions and clicks over 28 days, scaled to a month) and <b>modelled</b> everywhere else (the provider's monthly volume, typically 50-70% off for a single keyword) — the label is on every number. ${prio.length} keyword${prio.length === 1 ? '' : 's'} were checked live on Google for intent and page type${(ks.live_checks || {}).cap ? ' (limit ' + ks.live_checks.cap + ' a run, about $' + ((ks.live_checks.cap * 0.002).toFixed(2)) + ' of search data)' : ''}.${(ks.research_failures || []).length ? ' Some data pulls failed: ' + esc(ks.research_failures.join('; ')) + '.' : ''}</p>
  <p class="by">Prepared by ${esc(base.brand || 'Dev SEO')} · Search volumes, difficulty, CPC and SERP features from DataForSEO for ${esc(base.country)}.</p>
</div>`;

// Options for the form-only "Choose your keyword" step (the number prefix makes the pick unambiguous)
const choice_options = ['Let the system choose for my goal', ...ks.priority.slice(0, 8).map((k, i) => (i + 1) + '. ' + k.keyword + ' · ' + num(k.volume) + ' searches/mo · difficulty ' + (k.kd == null ? '?' : k.kd) + ' · ' + cap(k.intent) + ' · ' + k.page_type + (k.for_you_label ? ' · ' + k.for_you_label : ''))];
return [{ json: { ...base, keyword_strategy: ks, keyword_suggestions, result_html: html, choice_options } }];
