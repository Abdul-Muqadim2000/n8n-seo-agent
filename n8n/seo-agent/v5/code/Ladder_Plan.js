/*__REACH__*/
/*__RADIUS__*/
/*__FIT_GATE__*/
/*__PAGE_TYPE__*/
/*__SITE_MODEL__*/
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
// ---- B2-1 (2026-10-15, benchmark area 2): the reach this plan is measured against is the reach ON THIS TOPIC ----
// The site reach above is one number for the whole website, cached 30 days: on 2026-10-13 the SAME cached reach of 10 (measured
// 2026-10-08 on "peppol uae" research) decided the plan for "erp implementation dubai" (lad_mv5pjt5y4aoa). MarketMuse subtracts a
// topic-level Topic Authority from the difficulty and Semrush lowers PKD with the thematic distance to the domain's core topics; this
// measures the same thing from the `ranked` pull this run already paid for, using the SAME on-topic test the rungs are filtered by
// (RAD.headFit), so the keywords that count as "this topic" for the reach are the keywords that count as "this topic" for the plan.
// It is used only with REACH_CFG.min_top10 on-topic top-10 keywords behind it; otherwise the site reach stays and the plan says so.
const rankedAll = SR.available === false ? null : Object.entries(SR.keywords || {}).map(([keyword, r]) => ({ keyword, kd: r.kd, position: r.position }));
const topic_authority = reachTopic(rankedAll, head, reachInfo.reach, { domain, match: (kw) => RAD.headFit(head, kw).ok });
const reach = topic_authority.reach;

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
// ---- R23 (2026-10-14, FIX_PLAN.md §3.12): every rung keyword has to be on this ladder's own topic ----
// Exec 549 planned "azure api management monetization" (volume 10, informational, quarterly trend -100%) as the ONE rung of a ladder
// whose head is "azure cloud migration dubai" — another topic, and no UAE in it. *Ladder Pool*'s own filter only asks for one shared
// word with the head ("azure"), and the AI screen judges relevance to the business, not distance to the head. The topic radius
// (v5/code/_radius.js, the kit discovery draws its radius with) is applied here, keyword by keyword, against the head: a keyword that
// fails it is left out WITH ITS REASON instead of becoming a page, a supporting keyword or an internal link.
const offTopic = [];
const onTopic = kws.filter(k => {
  const t = RAD.headFit(head, k.keyword);
  if (t.ok) return true;
  offTopic.push({ keyword: k.keyword, volume: k.volume, kd: k.kd, shared: t.shared, reason: t.reason });
  return false;
});

// ---- B2-4 (2026-10-15, benchmark area 2, criterion K7): rungs grouped by the results pages Google really shows ----
// `Ladder Clusters` bought one results page per rung candidate (bounded, see that node) and compared the TOP 7 at a 40% threshold -
// Keyword Insights' own current numbers, approved by the owner as B2-6. Two searches Google answers with the same pages are ONE page
// here: the cluster's members take the rung of their head keyword, so the grouping cannot be undone by the difficulty bands below, and
// `makePages` keys them on the cluster instead of on the AI's topic label.
//   INVARIANTS rule 1: a keyword whose results page could not be read is NOT clustered. It keeps its own group, it is named in
// `serp_clusters.not_compared` with the reason, and the plan says how many there were - it is never quietly merged or quietly dropped.
let SERP_CL = null; try { SERP_CL = $('Ladder Clusters').first().json.serp_clusters || null; } catch (e) { SERP_CL = null; }
const clusterOf = (SERP_CL && SERP_CL.available) ? (SERP_CL.of_keyword || {}) : {};
const notCompared = new Set(((SERP_CL || {}).not_compared || []).map(x => String(x.keyword)));
for (const k of onTopic) {
  const c = clusterOf[k.keyword] || null;
  k.serp_group = c ? c.head_keyword : '';
  k.serp_cluster = c && c.head_keyword !== k.keyword ? c : null;
  k.serp_cluster_size = c ? c.keyword_count : 0;
  k.serp_checked = !!SERP_CL && SERP_CL.asked > 0 && !notCompared.has(k.keyword) && (!!c || SERP_CL.compared > 0);
  k.serp_not_compared = notCompared.has(k.keyword);
}

// ---- rung bands relative to reach (unknown difficulty = reach + 10) ----
const kdOf = (k) => k.kd == null ? reach + REACH_CFG.unknown_kd : k.kd;
const longTail = (k) => k.words >= 3 || (k.words >= 2 && k.volume < 200);
const BAND = { 1: reach, 2: reach + 15, 3: reach + 30 };
const rungOf = (k) => { const kd = kdOf(k); if (kd <= BAND[1] && k.volume >= 20 && longTail(k)) return 1; if (kd <= BAND[2]) return 2; if (kd <= BAND[3]) return 3; return 0; };   // 0 = later
// B2-4: one search, one page - so one CLUSTER, one rung. Every member of a cluster takes the rung of its head keyword (the strongest of
// the group); without that, "erp implementation cost" in rung 1 and "erp implementation cost dubai" in rung 2 would still become two
// pages although Google answers both with the same pages, which is exactly what this is here to stop.
const rungMap = new Map(onTopic.map(k => [k.keyword, rungOf(k)]));
const clusterRungs = [];
if (SERP_CL && SERP_CL.available) {
  const byHead = new Map();
  for (const k of onTopic) { const h = k.serp_group; if (!h) continue; if (!byHead.has(h)) byHead.set(h, []); byHead.get(h).push(k); }
  for (const [h, ks] of byHead) {
    if (ks.length < 2) continue;
    const headK = ks.find(k => k.keyword === h) || ks.slice().sort((a, b) => b.opportunity - a.opportunity)[0];
    const r = rungMap.get(headK.keyword);
    const moved = ks.filter(k => rungMap.get(k.keyword) !== r).map(k => k.keyword);
    for (const k of ks) rungMap.set(k.keyword, r);
    clusterRungs.push({ head_keyword: h, rung: r, keywords: ks.map(k => k.keyword), moved });
  }
}
const byRung = { 1: [], 2: [], 3: [] }; const later = [];
for (const k of onTopic) { const r = rungMap.get(k.keyword); if (r) byRung[r].push(k); else later.push(k); }

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
  // B2-4: a shared results page beats the AI's topic label. Keywords Google answers with the same pages share one key (and one page);
  // everything else keeps the old topic|page_type key. A keyword whose results page could not be read is in neither - it keeps its own.
  for (const k of list) { const key = k.serp_group ? 'serp|' + k.serp_group : (k.topic || k.keyword) + '|' + k.page_type; if (!cl.has(key)) cl.set(key, []); cl.get(key).push(k); }
  const groups = [];
  // a SERP group is evidence, not a label, so it is never split into two pages; an AI-label group still is (MAX_CLUSTER)
  for (const [key, ks] of cl) { const sorted = ks.slice().sort((a, b) => b.opportunity - a.opportunity);
    if (String(key).indexOf('serp|') === 0) { groups.push(sorted); continue; }
    for (let i = 0; i < sorted.length; i += MAX_CLUSTER) groups.push(sorted.slice(i, i + MAX_CLUSTER)); }
  const clusters = groups.map(ks => ({ ks, opp: ks.reduce((s, k) => s + k.opportunity, 0) })).sort((a, b) => b.opp - a.opp);
  return clusters.slice(0, LIMIT[rung]).map(({ ks }) => {
    const p = ks[0];
    const ex = findExisting(p.keyword, p.your_url);
    const pos = ks.map(k => k.your_position).filter(Boolean);
    // FIX_PLAN D10 (2026-10-12): the AI screen answers in free text ("Comparison Page", "Service Page with a cost section"); the row,
    // the spawned page run and the brief take one of the form's fixed types, and the sentence itself stays as page_notes.
    const ptype = PT.of(p.page_type, defaultPage(p.intent));
    // B2-4: what the group was built on - the shared results page, or the AI's topic label when no results page could be read
    const shared = ks.filter(k => k.serp_group === p.serp_group && k.keyword !== p.keyword).map(k => ({ keyword: k.keyword, shared_urls: (k.serp_cluster || {}).shared_urls || null }));
    const grouped_by = p.serp_group && ks.length > 1 ? 'shared results page' : (SERP_CL && SERP_CL.available ? 'topic label (no search Google answers with the same pages)' : 'topic label (results pages not compared)');
    return { rung, keyword: p.keyword, topic: p.topic, page_type: ptype, page_notes: PT.notes(p.page_type, ptype), intent: p.intent, volume: p.volume, kd: p.kd, cpc: p.cpc, opportunity: p.opportunity,
      grouped_by, serp_cluster: p.serp_group && ks.length > 1 ? { head_keyword: p.serp_group, keyword_count: ks.length, shared, urls_compared: ((clusterOf[p.keyword] || {}).urls_compared) || null, min_shared_urls: (SERP_CL || {}).min_shared_urls || null, top_n: (SERP_CL || {}).top_n || null } : null,
      serp_not_compared: !!p.serp_not_compared,
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
// R8 (2026-10-13, re-rating): the rung pages carried `target_words: 0` (seo_ladders rows 19-22 live), so P2-7's clamp protected only the page
// the verdict measured and the spawn body for exec 500 carried `ladder_words: 0`. The target comes from the word counts of the pages that
// actually rank for this ladder's topic (`competitors_summary[].word_count` — the pages this run read with Jina): the MEDIAN of the field for a
// rung page, because a rung keyword is an easier search than the head term and its pages are shorter, while the main page keeps the verdict's
// own number (usually the best page's length). No per-rung results page is read: that would be one paid SERP call per rung keyword.
const headExisting = (base.existing_page && base.existing_page.url) ? { url: base.existing_page.url, source: base.existing_page.source || 'sitemap' } : findExisting(head, headRank && headRank.url);
Object.assign(top, { exists: !!headExisting, target_url: headExisting ? headExisting.url : plannedUrl(head), existing_source: headExisting ? headExisting.source : null, status: headExisting ? 'improve' : 'new' });

// ---- feasibility of the destination (alternatives before any page is dropped) ----
const status = difficulty_for_you === 'not_realistic' ? 'unrealistic' : difficulty_for_you === 'very_hard' ? 'stretch' : 'winnable';
const altPool = [...(base.verdict_changes || []).filter(s => /["“”]/.test(String(s))), ...(base.secondary_keywords || [])].slice(0, 4);
const altPages = [...rungs[2].pages, ...rungs[1].pages, ...rungs[0].pages].map(p => p.keyword);
const alternatives = status === 'winnable' ? [] : (altPool.length ? altPool : altPages.slice(0, 3));

// ---- R23: the data a plan rests on. A ladder is scored, written and published on the strength of this run's research and of the
//      live results page; when either is missing the honest answer is "I could not check this", not a plan with a score on it.
//      Exec 549 produced "winnable / GO_WITH_CHANGES 68" and wrote a page from a pool of ONE keyword while both SERP calls had
//      failed (40101) and the keyword data came back empty. A refusal here also stops the page run: `write_now` stays empty. ----
// Two floors, so a genuinely narrow topic with real data still gets its plan (a main page is a valid ladder: "peppol uae",
// 2026-10-08) while a run whose data never arrived does not: fewer than LADDER_MIN_POOL keywords is too thin whatever else is
// known, and fewer than LADDER_WEAK_POOL counts as nothing at all when the head keyword itself has no volume and no difficulty.
const LADDER_MIN_POOL = 3, LADDER_WEAK_POOL = 5;
const poolSize = Number((pool.research || {}).pool_size) || ((pool.research || {}).candidates || []).length;
const headMeasured = (kd.search_volume ?? null) != null || (kd.keyword_difficulty ?? null) != null;
const thinPool = poolSize < LADDER_MIN_POOL || (poolSize < LADDER_WEAK_POOL && !headMeasured);
const serpOut = (base.serp_features && base.serp_features.unavailable === true) ? String(base.serp_features.error || 'no answer').slice(0, 160) : '';

// ---- refusals: a duplicate main keyword, a destination that is not realistic, or data we do not have -> no ladder pages ----
let refusal = null;
if (dupHead) refusal = { reason: 'duplicate', ladder_id: dupHead.ladder_id, head: dupHead.head,
  message: 'This website already has a keyword ladder for "' + dupHead.head + '" (' + dupHead.ladder_id + '). One search needs one page, so no second ladder was planned: continue that ladder instead.' };
else if (plan.plan_type === 'none') refusal = { reason: 'not_realistic', message: '"' + head + '" is not a realistic main keyword for ' + domain + ' (' + (other_brand ? 'it is another company\'s brand: ' + headGate.detail : navigational ? 'people searching it look for one particular website or brand' + (!headGate.ok ? ': ' + headGate.detail : '') : 'the verdict is AVOID') + '). No ladder pages were planned; pick one of the alternatives as the main keyword instead.' };
else if (serpOut) refusal = { reason: 'serp_unchecked', short: 'the live Google results could not be checked', detail: serpOut,
  message: 'The live Google results for "' + head + '" could not be read on this run (' + serpOut + '), so nothing is known about who ranks for it, how strong those pages are or which results-page features take the clicks. A ladder plan is a bet on that competition, so none was planned, nothing was scored and no page was written. Run it again once the search data provider answers.' };
else if (thinPool) refusal = { reason: 'thin_data', short: 'the keyword research returned too little data', pool_size: poolSize, minimum: LADDER_MIN_POOL, head_measured: headMeasured,
  message: 'The keyword research returned only ' + poolSize + ' keyword' + (poolSize === 1 ? '' : 's') + ' around "' + head + '" in ' + (base.country || 'this market')
    + (headMeasured ? ' (a ladder needs at least ' + LADDER_MIN_POOL + ' to pick rungs from)' : ', and the search data provider has no search volume and no difficulty for "' + head + '" itself')
    + ', so there is not enough data to plan one. No pages were planned and none was written: check the destination keyword, or run it again if the search data provider was failing.' };
const dataRefused = !!(refusal && (refusal.reason === 'serp_unchecked' || refusal.reason === 'thin_data'));
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
// ---- R22 (2026-10-14, FIX_PLAN.md §3.12): a rung page may never carry a word target of 0 ----
// The rung rows of exec 549 carried `target_words: 0`, so *Spawn Page Runs* passed `ladder_words: 0` and the clamp protected only the
// main page (1,800 from the competitor analysis). The rung page then shipped 2,648 words — +47% — after two editor rounds. The target
// comes from the pages that actually rank for this ladder's topic (the median of the lengths this run read, because a rung keyword is
// an easier search than the head term and its pages are shorter); with no SERP length data it falls back to the main page's own
// target, then to the competitor analysis, and last to a stated default — and the row always says WHICH of them it was.
const RUNG_WORDS = { floor: 700, fallback: 1200 };
const serpWordCounts = (base.competitors_summary || []).map(c => Number(c.word_count) || 0).filter(w => w >= 200 && w <= 12000).sort((a, b) => a - b);
const rungWords = (() => {
  if (serpWordCounts.length) {
    const mid = serpWordCounts.length >> 1;
    const med = serpWordCounts.length % 2 ? serpWordCounts[mid] : Math.round((serpWordCounts[mid - 1] + serpWordCounts[mid]) / 2);
    const words = Math.max(RUNG_WORDS.floor, Math.min(Math.round(med / 100) * 100, top.target_words || Infinity));
    return { words, source: 'the median length of the ' + serpWordCounts.length + ' page(s) read on this topic\'s results page' };
  }
  if (top.target_words) return { words: top.target_words, source: 'the main page of this ladder (no results page was read for the rung keywords)' };
  if (analysisWords) return { words: analysisWords, source: 'the competitor analysis' };
  return { words: RUNG_WORDS.fallback, source: 'the default length for a supporting page (nothing in this run measured one)' };
})();
for (const r of rungs) for (const pg of (r.pages || [])) if (!Number(pg.target_words)) { pg.target_words = rungWords.words; pg.target_words_source = rungWords.source; }
top.target_words_source = verdictWords ? 'the verdict' : analysisWords ? 'the competitor analysis' : 'not measured';
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
// ---- B2-5 (2026-10-15, benchmark area 2): how many different sites own the destination's results page ----
// Semrush ranks the pages of a plan on five named factors and DOMAIN DIVERSITY is the fifth (https://www.semrush.com/kb/1058-keyword-
// strategy-builder); ours never looked at it - `avg_referring_domains` was the only competition signal. A results page held by a few
// sites is a page where each of them holds more than one of the ten results, which is what a site with real topical coverage looks
// like, and it is harder to break into than a page of ten different sites.
//   The COUNT is measured (distinct registrable domains among the top 10 results this run read, at the time it read them, through the
// same LK.regDomain the competitor gate uses since R21, so a rival on a subdomain is not counted as a second site). The ADJUSTMENT is a
// stated rule and says so: it is not measured, and it is printed with the reason wherever the score is.
const headTop10 = (base.competitors_summary || []).filter(c => c && Number(c.rank) >= 1 && Number(c.rank) <= 10);
const diversityDomains = [...new Set(headTop10.map(c => LK.regDomain(LK.hostOf(c.url || '') || String(c.domain || ''))).filter(Boolean))];
// The rule is stated on ten results - 5 or fewer sites is concentrated, 6 or 7 narrow, 8 or more open - but a results page does not
// always carry ten ordinary results (an AI Overview, a local pack and a video block take their room), so it is applied as the SHARE it
// is: half of the results read or fewer is concentrated, 70% or fewer is narrow. Six different sites in six results is a page of six
// different sites, not a narrow one. Below DIVERSITY.min_results there is too little of the page to judge and nothing is adjusted.
const DIVERSITY = { concentrated: 5, narrow: 7, of: 10, min_results: 5 };
const DIVERSITY_PENALTY = { concentrated: 6, narrow: 3, open: 0 };
const divShare = headTop10.length ? diversityDomains.length / headTop10.length : 0;
const divBand = divShare <= DIVERSITY.concentrated / DIVERSITY.of ? 'concentrated' : divShare <= DIVERSITY.narrow / DIVERSITY.of ? 'narrow' : 'open';
const divChecked = !serpOut && headTop10.length >= DIVERSITY.min_results && diversityDomains.length > 0;
const divPenalty = divChecked && !dataRefused ? DIVERSITY_PENALTY[divBand] : 0;
const divText = !divChecked
  ? 'The results page for "' + head + '" could not be read on this run, so how many different sites own it is not known and the score is unchanged.'
  : diversityDomains.length + ' different site(s) hold the top ' + headTop10.length + ' results for "' + head + '"'
    + (divBand === 'open' ? ' — no site owns more than its share, so the page is as open as a results page gets and the feasibility score is unchanged.'
      : ' — ' + (divBand === 'concentrated' ? 'few sites own this page' : 'the page is narrow') + ', so at least one of them holds several of the results with the topical coverage that takes. The feasibility score is '
        + divPenalty + ' point(s) lower for it: a stated rule (' + DIVERSITY_PENALTY.concentrated + ' at ' + DIVERSITY.concentrated + ' sites or fewer of ten, '
        + DIVERSITY_PENALTY.narrow + ' at ' + (DIVERSITY.concentrated + 1) + '-' + DIVERSITY.narrow + ' of ten, nothing above), not a measured effect.')
    + (diversityDomains.length ? ' The sites: ' + diversityDomains.slice(0, 10).join(', ') + '.' : '');
const scoreBefore = dataRefused ? null : (base.verdict_score ?? null);
const scoreAfter = scoreBefore == null ? null : Math.max(0, Math.round(scoreBefore - divPenalty));
const serp_diversity = { checked: divChecked, domains: divChecked ? diversityDomains.length : null, results: headTop10.length,
  band: divChecked ? divBand : 'unknown', share_pct: divChecked ? Math.round(divShare * 100) : null, domain_list: diversityDomains.slice(0, 10), penalty: divPenalty,
  score_before: scoreBefore, score_after: scoreAfter, bands: DIVERSITY, penalties: DIVERSITY_PENALTY,
  basis: divChecked ? 'measured: distinct registrable domains among the top ' + headTop10.length + ' results read on this run'
    + ((base.serp_features || {}).checked_at ? ' at ' + String((base.serp_features || {}).checked_at) : '') + '; the adjustment itself is a stated rule, not a measured effect'
    : 'not available: the live results page could not be read on this run', text: divText };

// R23: a feasibility score is a reading of the competition. With no results page and no research there is nothing to read, so the
// status is "not checked" and the score is empty — never the verdict's number next to the word "winnable".
const feasibility = { status: dataRefused ? 'not_checked' : status, verdict: dataRefused ? null : verdict, score: dataRefused ? null : scoreAfter,
  reasons: [...(base.verdict_reasons || []), ...(divChecked ? [divText] : [])], what_must_change: base.verdict_changes || [], alternatives,
  expected_visits_top3: dataRefused ? null : (base.expected_visits_top3 ?? null), time_to_rank_months: dataRefused ? null : (base.time_to_rank_months ?? null), navigational,
  serp_diversity, score_before: scoreBefore, score_adjustment: -divPenalty,
  scored: !dataRefused, not_scored_reason: dataRefused ? refusal.message : '' };

// ---- what else is needed besides the pages ----
const requirements = [];
const needRd = bl.avg_referring_domains || null;
if (needRd) requirements.push({ item: 'Links to the top page', detail: 'Top-10 pages for "' + head + '" average ' + needRd + ' referring domains. Plan ' + Math.max(5, Math.round(needRd * 0.6)) + '+ relevant links (partners, directories, PR, guest articles) to the top page over the ladder period.' });
if (sa) requirements.push({ item: 'Site authority today', detail: domain + ' ranks for ' + (sa.organic_keywords || 0) + ' keywords (' + (sa.top10 || 0) + ' in the top 10, ' + (sa.top3 || 0) + ' in the top 3). ' + (sa.top10 < 20 ? 'The lower rungs come first: they build topical authority before the head term is realistic.' : 'Existing authority shortens the timeline.') });
if ((pool.head_geo || []).length) requirements.push({ item: 'Local trust signals', detail: 'The head term is local (' + pool.head_geo.join(' ') + '): a complete Google Business Profile, consistent name/address/phone and recent reviews support every rung.' });
requirements.push({ item: 'Entity and trust pages', detail: 'Organization schema, an about page with real credentials, author bylines and case studies; the content QA already adds schema to every generated page.' });
requirements.push({ item: 'Publish on schedule and interlink', detail: 'Each rung page links up to the top page and sideways to one sibling; the top page links down to every rung page. Ranking only starts once the pages are live.' });

// ---- B2-2 (2026-10-15, benchmark area 2): what this website ALREADY has on this topic, before one new page is planned ----
// MarketMuse starts a plan from the site's topic inventory and its effort bands begin with "optimise the existing page if it matches the
// topic; otherwise create a new one" (https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/). The ladder has
// always decided improve-vs-new per page (`findExisting`), but it never counted it up, so a plan opened with five new pages and said
// nothing about the pages the site already had on the same topic. The counts come from data already in the run: the page inventory, and
// the keywords the site ranks for, both filtered with the SAME on-topic test as the rungs.
// a page with no words of its own (the homepage: no title in the inventory and an empty path) matches nothing — RAD.headFit passes an
// empty token set, so it has to be refused here or every site "already has a page" on every topic
const onTopicPage = (p) => { try { const txt = [p.title || '', String(p.url || '').replace(/^https?:\/\/[^/]+/i, '').replace(/[^A-Za-z0-9]+/g, ' ')].join(' ');
  return RAD.tokens(txt).length > 0 && RAD.headFit(head, txt).ok; } catch (e) { return false; } };
const pagesOnTopic = []; const seenPg = new Set();
for (const p of invPages) { const u = String(p.url || ''); if (!u || seenPg.has(u) || !onTopicPage(p)) continue; seenPg.add(u); pagesOnTopic.push({ url: u, title: String(p.title || '') }); }
const allPlanned = planned ? [...rungPages, top] : [];
const nImprove = allPlanned.filter(p => p.exists).length, nNew = allPlanned.length - nImprove;
const bestPos = topic_authority.best;
topic_authority.coverage = { pages_on_site: pagesOnTopic.length, pages: pagesOnTopic.slice(0, 8), ranked_keywords: topic_authority.on_topic,
  top10_keywords: topic_authority.top10, best_position: bestPos ? bestPos.position : null, best_keyword: bestPos ? bestPos.keyword : '',
  planned_total: allPlanned.length, planned_improve: nImprove, planned_new: nNew,
  summary: !planned ? 'No pages were planned, so there is nothing to compare with what the site already has.'
    : (!pagesOnTopic.length && !topic_authority.on_topic
      ? 'Nothing on ' + domain + ' is about "' + head + '" yet — no page and no keyword it ranks for — so all ' + allPlanned.length + ' page(s) in this plan are new and this topic starts from zero.'
      : domain + ' already has ' + pagesOnTopic.length + ' page(s) about "' + head + '" and ranks for ' + topic_authority.on_topic + ' keyword(s) on it ('
        + topic_authority.top10 + ' in the top 10' + (bestPos ? ', best #' + bestPos.position + ' for "' + bestPos.keyword + '"' : '') + '). Of the '
        + allPlanned.length + ' page(s) in this plan, ' + nImprove + ' improve' + (nImprove === 1 ? 's' : '') + ' a page you already have and ' + nNew + ' ' + (nNew === 1 ? 'is' : 'are') + ' new.')
      + ' A search that an existing page already answers is never given a second page.' };
// ---- B2-3 (2026-10-15, benchmark area 2): every planned page says why it sits where it sits ----
// Semrush's Keyword Strategy Builder ranks the pages of a plan on five stated factors — relevance to the seed, search volume, keyword
// difficulty, domain diversity and SERP features (https://www.semrush.com/kb/1058-keyword-strategy-builder). Ours ordered pages by rung
// band and by the opportunity sum of their cluster and printed neither, so the plan's order had to be taken on trust. These are the
// factors that really decided it, in the page's own row — nothing new is computed and nothing new is fetched.
const unknownKd = reach + REACH_CFG.unknown_kd;
const whyFactorsOf = (p) => ({ rung: p.rung, kd: p.kd == null ? null : p.kd, counted_kd: p.kd == null ? unknownKd : p.kd, reach,
  difficulty_for_you: difficultyForYou(p.kd == null ? null : p.kd, reach, { position: p.your_position || null }),
  keywords: p.rung === 4 ? 1 + (p.supporting || []).length : ((p.keywords || []).length || 1),
  volume: p.rung === 4 ? (p.volume ?? null) : (p.total_volume ?? null), intent: p.intent || null,
  status: p.exists ? 'improve' : 'new', your_position: p.your_position || null, links_up: (p.links_to || []).some(l => l.role === 'top'),
  grouped_by: p.grouped_by || null, serp_cluster: p.serp_cluster || null,   // B2-4: Semrush's own fifth factor is the SERP, and this is where it decided the grouping
  serp_domains: p.rung === 4 ? serp_diversity.domains : null });
const whyOf = (p) => { const f = whyFactorsOf(p); const b = [];
  b.push((p.rung === 4 ? 'The destination page' : 'Rung ' + p.rung) + ': ' + (f.kd == null ? 'difficulty unknown, counted as ' + unknownKd : 'difficulty ' + f.kd)
    + ' against the reach this plan is measured against (' + reach + ')' + (topic_authority.used ? ', measured on this topic' : ', measured across the whole site'));
  b.push(f.keywords + ' keyword(s)' + (f.volume != null ? ', ' + f.volume + ' searches a month' : ', no search volume in the data'));
  if (f.intent) b.push(f.intent + ' intent');
  if (f.your_position) b.push('you are #' + f.your_position + ' for it today');
  b.push(f.status === 'improve' ? 'improves ' + p.target_url + ', which already answers it' : 'a page you do not have yet');
  if (f.links_up) b.push('links up to the main page');
  // B2-4: when a page exists because Google answers several searches with the same pages, that is the reason it exists
  if (f.serp_cluster && f.serp_cluster.keyword_count > 1) b.push('one page for ' + f.serp_cluster.keyword_count + ' searches Google answers with the same pages ('
    + (f.serp_cluster.shared || []).slice(0, 3).map(x => '"' + x.keyword + '"' + (x.shared_urls ? ' shares ' + x.shared_urls + ' of the top ' + (f.serp_cluster.top_n || 7) : '')).join(', ') + ')');
  else if (p.serp_not_compared) b.push('its results page could not be read on this run, so it was not compared with the others');
  if (p.rung === 4 && f.serp_domains) b.push(f.serp_domains + ' different site(s) hold the top ' + serp_diversity.results + ' results for it');
  return b.join('; ') + '.'; };
for (const p of allPlanned) { p.why = whyOf(p); p.why_factors = whyFactorsOf(p); }

// ---- pages to write now, in the plan's order (direct: the main page first; otherwise the supporting pages, the main page waits for support) ----
const order = !planned ? [] : mainFirst ? [top, ...rungPages] : rungPages;
const write_now = order.slice(0, pagesNow).map(p => ({ page_no: p.page_no, rung: p.rung, keyword: p.keyword, page_type: p.page_type, target_url: p.target_url, exists: p.exists, supporting: p.supporting, links_to: p.links_to, target_words: Number(p.target_words) || 0, why: p.why || '' }));   // R8: a rung page carries its own measured target now, not 0   // B2-3: and the reason it is first
const pages_total = planned ? rungPages.length + 1 : 0;
const stats = { pool_size: (pool.research || {}).pool_size || 0, ai_reviewed: rel.size, relevant: kws.length, pages_total, rung_pages: planned ? rungPages.length : 0,
  keywords_covered: planned ? rungPages.reduce((s, p) => s + 1 + p.supporting.length, 0) + 1 + top.supporting.length : 0,
  traffic_potential_total: planned ? rungPages.reduce((s, p) => s + (p.traffic_potential || 0), 0) + (top.traffic_potential || 0) : 0,
  site_rankings_found: SR.count || 0, research_failures: (pool.research || {}).failures || [], excluded_keywords: excluded.length, refused_keywords: poolRefused.length,
  off_topic_keywords: offTopic.length, on_topic: onTopic.length,
  // B2-4: what the results-page comparison cost and what it changed; B2-5: how many sites own the destination's results page
  serp_checks: SERP_CL ? SERP_CL.asked : 0, serp_checks_compared: SERP_CL ? SERP_CL.compared : 0, serp_checks_failed: SERP_CL ? SERP_CL.not_compared.length : 0,
  serp_check_cost_usd: SERP_CL ? SERP_CL.cost_usd : 0, serp_clusters: SERP_CL ? (SERP_CL.clusters || []).length : 0,
  serp_merged_keywords: clusterRungs.reduce((n, c) => n + Math.max(0, c.keywords.length - 1), 0), serp_domains: serp_diversity.domains };
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
// B2-1 / B2-2: which reach this plan was measured against, and what the site already has on the topic — both in the owner's reading
notes.push(topic_authority.note);
if (planned) notes.push(topic_authority.coverage.summary);
// B2-4: what Google itself said about which of these searches want the same page, what it cost, and what could not be compared
if (SERP_CL && SERP_CL.note) notes.push(SERP_CL.note
  + (planned && clusterRungs.length ? ' In this plan ' + clusterRungs.length + ' group(s) became one page each instead of several: '
    + clusterRungs.slice(0, 4).map(c => '"' + c.head_keyword + '" (+' + Math.max(0, c.keywords.length - 1) + ')').join(', ') + '.' : ''));
// B2-5: the destination's results page, and the stated effect on the score
if (serp_diversity.checked) notes.push(serp_diversity.text);
if (head_radius) notes.push('Topic radius — "' + head_radius.topic + '": ' + RAD.line(head_radius) + '.');
if (poolRefused.length) notes.push(poolRefused.length + ' keyword(s) were left out of the ladder because they are other companies\' brands, government or portal searches, or navigational: ' + poolRefused.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason + ')').join(', ') + (poolRefused.length > 6 ? ' …' : '') + '.');
if (planned && plan_type === 'full' && rungPages.length && pages_total < 8) notes.push('Only ' + pages_total + ' pages could be planned from the data: the topic is narrow in ' + base.country + '. The ladder is shorter but still valid.');
if (planned && plan_type === 'full' && rungPages.length) for (const r of rungs) if (!r.pages.length) notes.push('No keywords fell into rung ' + r.rung + '; the ladder skips it.');
if (planned && plan_type === 'direct' && rungPages.length < 2) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned around the main keyword; add more as the site grows.');
if (planned && plan_type !== 'direct' && !rungPages.length) notes.push('No supporting keywords were found for "' + head + '" in ' + base.country + ' (the topic is narrow in the search data), so the main page is the whole ladder for now and is written first. Supporting pages can be added as the site grows.');
else if (planned && plan_type === 'short' && rungPages.length < 3) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned before the main page.');
if (offTopic.length) notes.push(offTopic.length + ' keyword(s) were left out because they are not on this ladder\'s topic ("' + head + '"): ' + offTopic.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason.replace(/^it is not on this ladder's topic: /, '') + ')').join(', ') + (offTopic.length > 6 ? ' …' : '') + '.');
if (excluded.length) notes.push(excluded.length + ' keyword(s) already belong to other ladders of this site and were left out (one search, one page): ' + excluded.slice(0, 6).map(x => '"' + x.keyword + '" (ladder "' + x.head + '")').join(', ') + (excluded.length > 6 ? ' …' : '') + '.');
if (headTakenAsPage) notes.push('The main keyword is also planned as a page of the ladder "' + headTakenAsPage.head + '" (' + headTakenAsPage.ladder_id + '): publish only one page for it.');
if (plan.stretch && planned) notes.push('Very hard for this site today: consider one of the alternatives first (' + alternatives.join(', ') + ').');
const order_text = !planned ? 'no pages' : plan_type === 'direct' ? 'main page first, then the supporting pages that link to it' : !rungPages.length ? 'the main page only for now (no supporting keywords in the data), written first' : plan_type === 'short' ? 'supporting pages first, then the main page once half of them are live' : 'rung by rung from the easiest pages, the main page last';
const ladder = { ladder_id: ladderId, head: { keyword: head, volume: top.volume, kd: top.kd, cpc: top.cpc, intent: top.intent, your_position: top.your_position },
  domain, country: base.country, goal: base.goal || 'leads', feasibility, rungs, top, link_map, timeline, write_now, pages_now: pagesNow,
  later: later.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, ...(k.held_back ? { held_back: true } : {}) })), requirements, stats, notes,
  plan_type, difficulty_for_you, reach, months: planned ? plan.months : '', months_range: planned ? plan.months_range : null, stretch: planned && plan.stretch, planned, refusal, order: order_text,
  label: planned ? reachLabel(difficulty_for_you, plan) : dataRefused ? ('No ladder planned · ' + refusal.short) : (REACH_DIFF_LABEL[difficulty_for_you] + ' · no ladder'),
  chance: planned ? plan.chance : null, chance_text: planned ? reachChanceText(plan) : '', base_rate: REACH_BASE_RATE, refused_keywords: poolRefused.slice(0, 40),
  reach_info: { reach: reachInfo.reach, method: reachInfo.method, p75: reachInfo.p75 ?? null, size_reach: reachInfo.size_reach ?? null, sample: reachInfo.sample ?? null, top10: reachInfo.top10 ?? null, organic_keywords: reachInfo.organic_keywords ?? null, cached: !!reachInfo.cached, cached_at: reachInfo.cached_at || null },   // B2-1: the SITE-wide measurement; `reach` above is what this topic was measured against
  topic_authority,   // B2-1: what this site already wins on THIS topic, what it already has written about it, and which reach the plan used
  serp_clusters: SERP_CL,   // B2-4: the results pages this run read, the groups they made, what could not be compared and what it cost
  serp_cluster_rungs: clusterRungs.slice(0, 12), serp_diversity,   // B2-5: how many different sites own the destination's results page, and the stated adjustment
  excluded_keywords: excluded.slice(0, 40), topic_radius, head_radius, off_topic_keywords: offTopic.slice(0, 20),   // R23: what the topic radius left out, with the reason   // G32: shown with the plan, never enforced on it
  words: { main: top.target_words || 0, rung: rungWords.words, main_source: top.target_words_source, rung_source: rungWords.source },   // R22: where each page's length target came from
  data_check: { pool_size: poolSize, minimum_pool: LADDER_MIN_POOL, head_measured: headMeasured, serp_checked: !serpOut, serp_error: serpOut, enough: !dataRefused },   // R23
  tracker: { cadence: base.tracker_cadence || 'weekly', auto_next_rung: !!base.auto_next_rung, stop_rule: 'once the top rung holds the top 3 for 4 checks it is checked monthly (with the published pages)' }, created_at: new Date().toISOString() };
return [{ json: { ...base, ladder, site_rankings: pool.site_rankings || null, reach_cache_row } }];
