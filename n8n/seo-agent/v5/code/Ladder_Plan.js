/*__REACH__*/
/*__RADIUS__*/
/*__FIT_GATE__*/
/*__PAGE_TYPE__*/
/*__SITE_MODEL__*/
/*__KW_INPUTS__*/
/*__WAITING__*/
/*__OWN_COVER__*/
/*__READINESS__*/
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
const outs = (() => { try { return $('Ladder Keyword Relevance').all().map(i => i.json); } catch (e) { return $input.all().map(i => i.json); } })();   // D7: the title read sits between the screen and this node
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
// K1 (2026-10-21): the site's own Search Console readings (the page inventory's queries, live pages only, position <= 20) are topic evidence
// too, with the difficulty this run already holds for them (the research pool, the ranked pull); the note prints the sample either way
const kdKnownLP = new Map();
for (const c of ((pool.research || {}).candidates || [])) if (c && c.keyword && reachNum(c.kd) != null) kdKnownLP.set(String(c.keyword).toLowerCase().trim(), reachNum(c.kd));
for (const r of (rankedAll || [])) if (r && r.keyword && reachNum(r.kd) != null && !kdKnownLP.has(String(r.keyword).toLowerCase().trim())) kdKnownLP.set(String(r.keyword).toLowerCase().trim(), reachNum(r.kd));
const gscOwnLP = (() => { try { const m = $('Site Model').first().json.site_model; const ps = (m && Array.isArray(m.pages)) ? m.pages : [];
  return ps.filter(p => !SM.isGone(p)).flatMap(p => (Array.isArray(p.queries) ? p.queries : []).map(q => ({ query: String((q || {}).query || ''), position: Number((q || {}).position) || 0 }))).filter(q => q.query && q.position > 0); } catch (e) { return []; } })();
const topic_authority = reachTopic(rankedAll, head, reachInfo.reach, { domain, match: (kw) => RAD.headFit(head, kw).ok, ...(gscOwnLP.length ? { gsc: gscOwnLP } : {}), kdOf: (k) => kdKnownLP.has(k) ? kdKnownLP.get(k) : null });
const reach = topic_authority.reach;

// ---- the site's other ladders (rule R1: one search, one page) ----
const settingsRows = rowsOf('Load Domain Ladder Settings');
const archived = new Set(settingsRows.filter(r => String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id)));
const others = rowsOf('Load Domain Ladders').filter(r => r.ladder_id && String(r.ladder_id) !== ladderId && reachDomain(r.domain) === reachDomain(domain) && !archived.has(String(r.ladder_id)));
const otherHeads = new Map(); for (const r of others) { const h = String(r.head_keyword || (Number(r.rung) === 4 ? r.keyword : '') || '').toLowerCase().trim(); if (h && !otherHeads.has(String(r.ladder_id))) otherHeads.set(String(r.ladder_id), h); }
const taken = []; const seenTaken = new Set();
for (const r of others) for (const k of [r.keyword, r.head_keyword]) { const kw = String(k || '').toLowerCase().trim(); const sig = r.ladder_id + '|' + kw; if (kw && !seenTaken.has(sig)) { seenTaken.add(sig); taken.push({ keyword: kw, tokens: overlapTokens(kw), ladder_id: String(r.ladder_id), head: otherHeads.get(String(r.ladder_id)) || '' }); } }
// ---- R42 (2026-10-16, A14): pages already written and still unpublished, against the site's pile-up limit ----
// The Content Cadence stops at `max_waiting` (the `_site` row of seo_ladder_settings, default 3, pages written + not_ready in the last 120
// days); a ladder run used to write its page on top without a word about it. The report says so (Build_Ladder_Report.js).
const pile_up = (() => {
  // F-A1 / A-12 (2026-10-17): the count is the Content Cadence's own (v5/code/_waiting.js), so the two never disagree about how many
  // pages wait; exec 770 counted 5 waiting (limit 3), said so, and wrote a sixth anyway - the hold below now applies the limit
  const siteRow = settingsRows.find(r => String(r.ladder_id) === '_site') || {};
  const limit = Math.max(1, Math.min(100, Math.round(Number(siteRow.max_waiting)) || 3));
  const dom = reachDomain(domain);
  const log = rowsOf('Load Content Log (Ladder)').filter(r => reachDomain(r.domain) === dom);
  const W = WAITING.waiting({ log, ladders: rowsOf('Load Domain Ladders').filter(r => reachDomain(r.domain) === dom), now: Date.now(), days: 120 });
  return { waiting: W.count, needs_fix: W.needs_fix, limit, keywords: W.list.slice(0, 10).map(x => x.keyword), at_limit: W.count >= limit, loaded: log.length > 0,
    basis: 'the Content Cadence\'s count: pages written (or written and refused by the quality check) in the last 120 days and not published, each keyword once' };
})();
// ---- KWL-LAD D14 (live run 2026-10-21, exec 125): "ai consulting dubai" became a second ladder beside the rung "ai consultant dubai" of the
// ladder "ai consultant" - the word rule kept "consulting" and "consultant" apart, and the head was compared with other ladders' HEADS only.
// Now the head and every rung keyword are compared with every keyword of the site's other ladders by two rules: the same words once a word
// family is folded (consultant / consulting / consultancy are one word, company / companies, service / services ...), and, where both
// searches have a results page read today (the shared reading this run compared, Ladder Clusters), 3 or more of their top 7 pages in common.
const FAMILY_LP = [[/^consult/, 'consult'], [/^compan/, 'company'], [/^agenc/, 'agency'], [/^servic/, 'service'], [/^provid/, 'provider'], [/^firm/, 'firm'],
  [/^solution/, 'solution'], [/^develop/, 'develop'], [/^automat/, 'automat'], [/^implement/, 'implement'], [/^integrat/, 'integrat'], [/^special/, 'special']];
const famTokensLP = (s) => [...new Set(overlapTokens(s).map(t => { for (const [re, f] of FAMILY_LP) if (re.test(t)) return f; return t; }))];
const urlsTodayLP = (() => { try { const c = $('Ladder Clusters').first().json.serp_clusters || {}; return { of: c.urls_of || {}, top: Number(c.top_n) || 7 }; } catch (e) { return { of: {}, top: 7 }; } })();
// -> null | { by: 'words' | 'results', shared?, of? }
const sameSearchLP = (a, b) => {
  const ka = String(a || '').toLowerCase().trim(), kb = String(b || '').toLowerCase().trim();
  if (!ka || !kb) return null;
  if (ka === kb || overlapScore(famTokensLP(ka), famTokensLP(kb)) >= 0.75) return { by: 'words' };
  const ua = urlsTodayLP.of[ka], ub = urlsTodayLP.of[kb];
  if (Array.isArray(ua) && Array.isArray(ub) && ua.length && ub.length) {
    const top = Math.min(7, urlsTodayLP.top || 7); const sb = new Set(ub.slice(0, top)); const shared = ua.slice(0, top).filter(u => sb.has(u)).length;
    if (shared >= 3) return { by: 'results', shared, of: top };
  }
  return null;
};
const takenBy = (kw) => { for (const x of taken) { const m = sameSearchLP(kw, x.keyword); if (m) return { ...x, match: m }; } return null; };
const dupHead = [...otherHeads.entries()].map(([id, h]) => ({ ladder_id: id, head: h, match: sameSearchLP(h, head) })).find(x => x.match) || null;
// the head is one of ANOTHER ladder's rung keywords (not its head): the same search, so no second ladder either
const headTakenAsPage = !dupHead ? takenBy(head) : null;
const sameWhyLP = (m, a, b) => !m ? '' : m.by === 'results' ? 'Google shows ' + m.shared + ' of the same top ' + m.of + ' pages for "' + a + '" and "' + b + '"'
  : String(a).toLowerCase().trim() === String(b).toLowerCase().trim() ? 'it is the same keyword' : '"' + a + '" and "' + b + '" are the same search in other words';
const overlaps = [];   // every overlap this plan found with the site's other ladders, for the app

// ---- AI relevance verdicts ----
const rel = new Map();
outs.forEach((o, i) => {
  const items = (parse(o.output).items) || [];
  const chunk = chunks[i] ? chunks[i].keywords_chunk : [];
  items.forEach((it, j) => {
    const kw = String(it.keyword || (chunk[j] || {}).keyword || '').toLowerCase().trim();
    if (!kw) return;
    rel.set(kw, { relevance: Math.max(0, Math.min(2, Number(it.relevance ?? 1))), intent: String(it.intent || '').toLowerCase(), page_type: it.page_type,
      topic: String(it.topic || '').toLowerCase().replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim(), fit_reason: String(it.fit_reason || '').trim().slice(0, 240) });
  });
});
const RELF = { 2: 1, 1: 0.45, 0: 0 };
const excluded = [];
// F-A1 / A-11: a keyword the screen refused because the pages Google ranks for it sell what this business does not (it reads those pages'
// titles now, Relevance_Chunks.js) is named in the plan with that reason - it used to vanish without a word
const notSold = [];
// 2026-10-11 (FIX_PLAN D8): the pool already refused other brands / government / portal keywords (research.refused); the gate runs once more here
// with the AI screen's intent in hand, so a keyword the AI called navigational never reaches a rung either
const poolRefused = ((pool.research || {}).refused || []).slice();
let cacheRowsP = []; try { cacheRowsP = $('Load Site Cache').all().map(i => i.json); } catch (e) { cacheRowsP = []; }
const sdP = base.site_description || {};
const fitCtxP = { own_domain: domain, competitors: (base.competitors || []).map(String), serp_domains: [...new Set((base.competitors_summary || []).map(c => String(c.domain || '')).filter(Boolean))],
  brands: fitLearnedBrands(cacheRowsP), protect: [head, ...(sdP.products_or_services || []), ...(base.services || []), ...(SITE_MODEL ? SM.services(SITE_MODEL) : []), String(base.business || sdP.business_description || '').slice(0, 400)] };   // keyword-first (2026-10-19): the site model's services, the client's declared ones included
const kws = ((pool.research || {}).candidates || []).filter(k => { const g = fitGate(k.keyword, { ...fitCtxP, intent: (rel.get(k.keyword) || {}).intent || k.intent }); if (!g.ok) poolRefused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return g.ok; }).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), fit_reason: r.fit_reason || '', opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1) };
}).filter(k => { if (k.relevance > 0 && k.intent !== 'navigational') return true;
  if (k.relevance === 0 && k.fit_reason) notSold.push({ keyword: k.keyword, volume: k.volume, reason: k.fit_reason });
  return false; }).filter(k => {
  const t = takenBy(k.keyword); if (!t) return true;
  excluded.push({ keyword: k.keyword, ladder_id: t.ladder_id, head: t.head, as: t.keyword, by: t.match.by });
  overlaps.push({ keyword: k.keyword, ladder_id: t.ladder_id, ladder: t.head, their_keyword: t.keyword, by: t.match.by, shared: t.match.shared ?? null, action: 'left out', why: sameWhyLP(t.match, k.keyword, t.keyword) }); return false;
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
  // R40: "compared" must mean THIS keyword's results page was read - by name when the cluster step lists them, else only when it left
  // nothing uncompared (a keyword past the cap was never asked, so it may still share a topic label)
  const listed = Array.isArray((SERP_CL || {}).compared_keywords) ? SERP_CL.compared_keywords.map(x => String(x).toLowerCase()) : null;
  k.serp_compared = !!(SERP_CL && SERP_CL.available) && !notCompared.has(k.keyword) && (listed ? listed.includes(k.keyword) : (k.serp_checked && !(Number(SERP_CL.left_uncompared) > 0)));
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
// D7 (paid run 2026-10-21, exec 15): the app starts Track my site and the ladder together, so seo_pages had no title yet. The pages that could
// overlap this plan were read just now (Ladder Title Requests -> Read Ladder Titles -> Ladder Titles, at most 8 free GETs of the client's
// own pages); their titles join the inventory here, so the overlap is judged on what the page says and not on its address alone.
const PAGE_TITLES = (() => { try { const t = $('Ladder Titles').first().json.page_titles; return (t && typeof t === 'object') ? t : null; } catch (e) { return null; } })();
const titlesRead = ((PAGE_TITLES || {}).read || []).filter(r => r && r.url && (r.title || r.h1));
const invPages = [...(base.site_urls || []).map(u => ({ url: u, source: 'sitemap' })),
  ...((base.internal_link_candidates || []).filter(c => c && c.url && c.title).map(c => ({ url: c.url, title: c.title, source: 'sitemap' }))),
  ...titlesRead.map(r => ({ url: r.url, title: r.title || '', h1: r.h1 || '', source: 'sitemap' })),
  // KW-LADDER (review item 10): a page the title read just saw answer 404 / 410 enters the inventory with that status, so the gone rule
  // (SM.isGone) keeps it from being "the page to improve" (/ai-consultant answered 404 and still matched "ai consultant" by its address)
  ...((PAGE_TITLES || {}).failed || []).filter(f => f && f.url && [404, 410].includes(Number(f.status))).map(f => ({ url: f.url, title: '', source: 'sitemap', http_status: Number(f.status), status_at: String((PAGE_TITLES || {}).read_at || '9999') }))];
const pageModel = SM.withPages(siteModel || SM.from({ domain }, {}), invPages);
// KW-LADDER (review item 15): an address the title read saw redirect to ANOTHER page (a retired URL sent home or elsewhere) is not a page
// to improve: it leaves the inventory here and the plan says where it redirects
const redirectedLP = ((PAGE_TITLES || {}).redirected || []).filter(r => r && r.url);
if (redirectedLP.length) { const rk = new Set(redirectedLP.map(r => SM.helpers.pathOf(r.url).replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase()));
  pageModel.pages = (pageModel.pages || []).filter(p => !rk.has(SM.helpers.pathOf(p.url).replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase())); }
const mayOverlapLP = new Map();
const findExisting = (keyword, yourUrl, isHead) => {
  if (yourUrl) return { url: yourUrl, source: 'ranking' };
  const pmx = SM.pageMatch(pageModel, keyword); let m = pmx.match;   // K8: the page ABOUT the search, with its confidence and evidence
  // a rung keyword keeps its own page unless a page carries its words (or its exact search): which rung searches are ONE page is decided by
  // their results pages (F-LADDER, 3 of 7), not by a shared topic word; the topic match is named as "may overlap" there
  if (m && !isHead && m.pass === 'topic') { mayOverlapLP.set(keyword, { url: m.url, title: m.title || '', confidence: m.confidence, note: 'may overlap: ' + String(m.url).replace(/^https?:\/\/[^\/]+/i, '') + ' is about the same subject (' + m.evidence + ')' }); m = null; }
  if (!m && pmx.may_overlap && !mayOverlapLP.has(keyword)) mayOverlapLP.set(keyword, { url: pmx.may_overlap.url, title: pmx.may_overlap.title || '', confidence: pmx.may_overlap.confidence, note: pmx.may_overlap.note });
  return m ? { url: m.url, source: m.source === 'gsc' || m.matched_by === 'query' ? 'search console' : 'sitemap', matched_by: m.matched_by, title: m.title || '',
    confidence: m.confidence == null ? null : m.confidence, evidence: m.evidence || '' } : null;
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const homeUrl = domain ? siteUrlOf(domain, '/') : '';
// RV-17 (2026-10-21, pre-launch run): every planned URL ended in "/" while techand.ai's sitemap writes none and the site 308-redirects the
// slash away. A planned page follows the site's own form: a trailing slash only when most of its sitemap pages carry one (and, as before,
// when there are too few pages to tell).
const slashFormLP = (() => { const ps = (base.site_urls || []).map(u => String(u || '').replace(/^https?:\/\/[^\/?#]+/i, '').replace(/[?#].*$/, '')).filter(x => x && x !== '/');
  if (ps.length < 3) return true; return ps.filter(x => /\/$/.test(x)).length * 2 > ps.length; })();
const plannedUrl = (kw) => homeUrl + slug(kw) + (slashFormLP ? '/' : '');

// ---- one page per topic cluster inside each rung ----
const LIMIT = { 1: 4, 2: 4, 3: 3 };
const notPlanned = { 1: [], 2: [], 3: [] };
const MAX_CLUSTER = 6;   // a coarse AI topic label must not swallow a whole rung: split by page type, then into groups of 6
const makePages = (list, rung) => {
  const cl = new Map();
  // B2-4: a shared results page beats the AI's topic label. Keywords Google answers with the same pages share one key (and one page);
  // everything else keeps the old topic|page_type key. A keyword whose results page could not be read is in neither - it keeps its own.
  // R40 (2026-10-16): the one rule discovery uses too (KWI.pageGroup) - a SERP cluster is one page, a keyword whose results page was
  // compared and shared with no one is its OWN page, and only a keyword whose results page could not be compared joins a topic label
  // (exec 610: "openai consulting" was merged into "ai consulting firm" on the label although they share 0 of their top-7 results).
  const byOf = new Map();
  for (const k of list) { const g = KWI.pageGroup({ keyword: k.keyword, topic: k.topic || k.keyword, page_type: k.page_type, serp_head: k.serp_group && (k.serp_cluster_size || 0) > 1 ? k.serp_group : '', compared: k.serp_compared });
    const key = g.key; byOf.set(key, g.by); if (!cl.has(key)) cl.set(key, []); cl.get(key).push(k); }
  const groups = [];
  // a SERP group is evidence, not a label, so it is never split into two pages; an AI-label group still is (MAX_CLUSTER)
  for (const [key, ks] of cl) { const sorted = ks.slice().sort((a, b) => b.opportunity - a.opportunity);
    if (byOf.get(key) !== 'topic label') { groups.push(sorted); continue; }
    for (let i = 0; i < sorted.length; i += MAX_CLUSTER) groups.push(sorted.slice(i, i + MAX_CLUSTER)); }
  const clusters = groups.map(ks => ({ ks, opp: ks.reduce((s, k) => s + k.opportunity, 0) })).sort((a, b) => b.opp - a.opp);
  // R40: the keywords that lost their page to the rung limit are named ("not worth a page now"), never silently gone
  notPlanned[rung] = clusters.slice(LIMIT[rung]).flatMap(({ ks }) => ks.map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, reason: 'the rung holds ' + LIMIT[rung] + ' pages and ' + clusters.length + ' were possible; the stronger ones were kept' })));
  return clusters.slice(0, LIMIT[rung]).map(({ ks }) => {
    const p = ks[0];
    const ex = findExisting(p.keyword, p.your_url);
    const pos = ks.map(k => k.your_position).filter(Boolean);
    // FIX_PLAN D10 (2026-10-12): the AI screen answers in free text ("Comparison Page", "Service Page with a cost section"); the row,
    // the spawned page run and the brief take one of the form's fixed types, and the sentence itself stays as page_notes.
    const ptype = PT.of(p.page_type, defaultPage(p.intent));
    // F-A1 / A-11 (2026-10-17, exec 770): "dubai it consulting companies" (720/month) was planned as a Service Page with no word about
    // its results page - four lists of seven ("top 25 strategy consulting firms", "Top 10 IT consulting companies", a LinkedIn listicle,
    // "List of Top Consulting Companies"). The kind of page Google ranks is read from the titles this run already bought (Ladder Clusters
    // `types_of`, KWI.serpPageTypes); when it settles on a kind this plan does not write, the page says so beside its type.
    const sk = (((SERP_CL || {}).types_of) || {})[String(p.keyword).toLowerCase()] || null;
    const ours = KWI.pageKindOf ? KWI.pageKindOf(ptype) : '';
    const serp_kind = sk ? { read: sk.read, dominant: sk.dominant || '', dominant_count: sk.dominant_count || 0, mismatch: !!(sk.dominant && ours && sk.dominant !== ours), ours } : null;
    const page_type_note = serp_kind && serp_kind.mismatch
      ? serp_kind.dominant + 's are what Google ranks for "' + p.keyword + '": ' + serp_kind.dominant_count + ' of the ' + serp_kind.read + ' results read, while this plan writes a ' + String(ours).toLowerCase()
        + ' - write the kind of page the results show (for a list: a list that includes you, with its criteria) or expect to work harder for it'
      : null;
    // B2-4: what the group was built on - the shared results page, or the AI's topic label when no results page could be read
    const shared = ks.filter(k => k.serp_group === p.serp_group && k.keyword !== p.keyword).map(k => ({ keyword: k.keyword, shared_urls: (k.serp_cluster || {}).shared_urls || null, ...((k.serp_cluster || {}).via ? { via: k.serp_cluster.via, shared_with_head: k.serp_cluster.shared_with_head } : {}) }));
    // F-A1 / A-9: "own results page" is said only when it is true by the pair rule - the cluster step now compares a keyword with every
    // member of a group, not only with its head, so a keyword left alone shares fewer than the threshold with every keyword compared
    const viaM = ks.filter(k => k.serp_cluster && k.serp_cluster.via);
    const grouped_by = p.serp_group && ks.length > 1 ? 'shared results page' + (viaM.length ? ' (' + viaM.map(k => '"' + k.keyword + '" through "' + k.serp_cluster.via + '"').slice(0, 3).join(', ') + ')' : '')
      : p.serp_compared ? 'own results page (it shares fewer than ' + ((SERP_CL || {}).min_shared_urls || 3) + ' of its top ' + ((SERP_CL || {}).top_n || 7) + ' with every other keyword compared)' : 'topic label (results pages not compared)';
    return { rung, keyword: p.keyword, topic: p.topic, page_type: ptype, page_notes: PT.notes(p.page_type, ptype), serp_kind, page_type_note, intent: p.intent, volume: p.volume, kd: p.kd, cpc: p.cpc, opportunity: p.opportunity,
      grouped_by, serp_cluster: p.serp_group && ks.length > 1 ? { head_keyword: p.serp_group, keyword_count: ks.length, shared, urls_compared: ((clusterOf[p.keyword] || {}).urls_compared) || null, min_shared_urls: (SERP_CL || {}).min_shared_urls || null, top_n: (SERP_CL || {}).top_n || null } : null,
      serp_not_compared: !!p.serp_not_compared,
      supporting: ks.slice(1, 7).map(k => k.keyword),
      keywords: ks.slice(0, 8).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, your_position: k.your_position })),
      total_volume: ks.reduce((s, k) => s + k.volume, 0), traffic_potential: ks.reduce((s, k) => s + (k.traffic_potential || 0), 0),
      your_position: pos.length ? Math.min(...pos) : null, exists: !!ex, target_url: ex ? ex.url : plannedUrl(p.keyword), existing_source: ex ? ex.source : null, status: ex ? 'improve' : 'new' };
  });
};
const bandLabel = (r) => r === 1 ? 'Rung 1: long-tail pages (difficulty up to ' + BAND[1] + ')' : r === 2 ? 'Rung 2: mid-difficulty pages (' + (BAND[1] + 1) + '-' + BAND[2] + ')' : 'Rung 3: strong pages (' + (BAND[2] + 1) + '-' + BAND[3] + ')';
const rungs = [1, 2, 3].map(r => ({ rung: r, label: bandLabel(r), band_max: BAND[r], pages: makePages(byRung[r], r), available: byRung[r].length, not_planned: notPlanned[r] }));

// ---- the main keyword for this site: difficulty, plan type, months ----
const kd = base.keyword_data || {}; const headRank = SR.head || null;
const verdict = base.verdict || 'GO_WITH_CHANGES';
// D8: the main keyword through the same gate, with its own results page in hand (one domain whose label is in the keyword holding 3+ of the
// top 5 = a brand query); the head term itself is not a protected word here
// KW-LADDER (review 2026-10-21 item 1): headSerp and the career evidence read competitors_summary, the pages Pick Top 6 chose for the
// competitor analysis (job boards, course sites and social sites skipped, one page per domain, at most 6), so "ai consultant" reached the gate
// with no indeed, bayt or glassdoor page and the brand rule (3 of the top 5) could never fire, while the Keyword Check, reading the full top 10
// of the same results page, refused it. Both now read the head's OWN results page (SERP Top 10, its retries or today's shared reading), parsed
// exactly as the Keyword Check parses it (Assess_Result.js): the organic top 10, the questions people also ask, the related searches.
// competitors_summary stays the fallback when no answer of that page is in this run.
const HEAD_SERP = (() => { for (const n of ['SERP Top 10 (Light Retry)', 'SERP Top 10 (Retry)', 'SERP Top 10']) {
  let a = null; try { a = $(n).first().json; } catch (e) { a = null; }
  const t = (((a || {}).tasks) || [])[0] || {}; if (Number(t.status_code) !== 20000) continue;
  const items = ((((t.result || [])[0]) || {}).items || []).filter(Boolean);
  const organic = items.filter(x => x.type === 'organic' && (x.url || x.domain)).sort((x, y) => (Number(x.rank_group) || 99) - (Number(y.rank_group) || 99));
  if (!organic.length) continue;
  return { node: n, organic,
    pages: organic.filter(x => !(Number(x.rank_group) > 10)).slice(0, 10).map(x => ({ rank: Number(x.rank_group) || null, domain: String(x.domain || ''), url: String(x.url || ''), title: String(x.title || '') })),
    paa: items.filter(x => x.type === 'people_also_ask').flatMap(x => (x.items || []).map(q => q && (q.title || q.question))).filter(Boolean).map(String).slice(0, 8),
    related: items.filter(x => x.type === 'related_searches').flatMap(x => (x.items || []).map(q => typeof q === 'string' ? q : (q && (q.title || q.keyword)))).filter(Boolean).map(String).slice(0, 12) };
} return null; })();
const headSerp = HEAD_SERP ? HEAD_SERP.pages.map(p => String(p.domain || '')).filter(Boolean)
  : (base.competitors_summary || []).slice().sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99)).map(c => String(c.domain || '')).filter(Boolean);
// E-GATE (2026-10-21, pre-launch run RV-11): the job-search rule read the keyword's own words only, so "ai consultant" (results: a job board,
// a certification course; its pool: "ai consultant jobs", "... salary", "... jobs remote") became a ladder head while those rungs were refused.
// The head is now read with the evidence this run holds: the pages the verdict read, the questions people also ask, and the research pool
// around it (the keywords kept and the ones the pool refused).
const headCareer = { pages: HEAD_SERP ? HEAD_SERP.pages.map(p => ({ domain: p.domain, url: p.url, title: p.title }))
    : (base.competitors_summary || []).filter(c => c && !(Number(c.rank) > 10)).map(c => ({ domain: String(c.domain || ''), url: String(c.url || ''), title: String(c.title || '') })),
  paa: HEAD_SERP && HEAD_SERP.paa.length ? HEAD_SERP.paa : (((base.serp_features || {}).people_also_ask) || []),
  related: [...(HEAD_SERP ? HEAD_SERP.related : []), ...((pool.research || {}).candidates || []).map(k => k && k.keyword), ...((pool.research || {}).refused || []).map(k => k && k.keyword)].filter(Boolean),
  topics: fitCtxP.protect.slice(1) };
const headGate = fitGate(head, { ...fitCtxP, intent: kd.google_intent || '', serp: headSerp, protect: fitCtxP.protect.slice(1), career: headCareer });
const careerHead = !headGate.ok && headGate.reason === 'job search';
const other_brand = !headGate.ok && headGate.reason === 'other brand';
const navigational = /navigational/i.test(String(kd.google_intent || '')) || (base.verdict_reasons || []).some(r => /navigational|brand (term|name|search)|another company/i.test(String(r))) || (!headGate.ok && ['navigational', 'own brand', 'government', 'portal'].includes(headGate.reason));
const difficulty_for_you = difficultyForYou(kd.keyword_difficulty ?? null, reach, { navigational, other_brand, verdict, position: headRank ? headRank.position : null });
const strongSite = reachStrong(sa, headRank ? headRank.position : null);
// R49 (2026-10-16): no chance band when the reach rests on no measured ranking (exec 610: size tier, 0 keywords in the top 10)
const plan = reachPlan(difficulty_for_you, strongSite, reachMeasured(topic_authority.used ? { used: true } : reachInfo, headRank ? headRank.position : null));
const topType = PT.of(base.recommended_page || base.page_type, base.page_type);
const top = { rung: 4, keyword: head, page_type: topType, page_notes: PT.notes(base.recommended_page || base.page_type, topType), intent: kd.google_intent || null, volume: kd.search_volume ?? null, kd: kd.keyword_difficulty ?? null, cpc: kd.cpc ?? null,
  supporting: (base.secondary_keywords || []).slice(0, 6), your_position: headRank ? headRank.position : null };
// R41 (2026-10-16, B6-15): the head term's traffic was volume x 0.3 with NO click loss (40 -> 12) while the rungs and the verdict beside it
// applied the results page's click loss (the verdict said 6). One figure per keyword per report: the verdict's own estimate when it made
// one, else the same model (KWI.calibrate on the head's volume and this results page's features) - with its basis either way.
const headTraffic = (() => { const ev = base.expected_visits;
  if (ev && typeof ev === 'object' && (ev.visits != null || ev.basis === 'unknown')) return { visits: ev.visits ?? null, basis: ev.basis || '', note: ev.note || ev.basis_text || '', loss: ev.loss_applied || '' };
  const feats = ((base.serp_features || {}).features_present) || [];
  const c = KWI.calibrate({ volume: kd.search_volume ?? null, serp_types: feats }, {});
  return { visits: c.traffic_potential ?? null, basis: c.traffic_basis, note: c.traffic_note || '', loss: KWI.lossText(feats) }; })();
Object.assign(top, { traffic_potential: headTraffic.visits, traffic_basis: headTraffic.basis, traffic_note: headTraffic.note, traffic_loss: headTraffic.loss });
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
// KWL-LAD D9 (live run 2026-10-21, exec 125): the main page improved /whatwedo/ai-automation with `existing_confidence: null` and
// `existing_evidence: ''`, because a page handed in by the earlier steps (base.existing_page) dropped SM.pageMatch's confidence and evidence.
// The same page is matched here once more and its confidence and evidence travel with it; a page the matcher does not see keeps the reason
// it was handed in for.
const headExisting = (() => {
  if (!(base.existing_page && base.existing_page.url)) return findExisting(head, headRank && headRank.url, true);
  const ep = base.existing_page;
  const keyOf = (u) => String(SM.helpers.pathOf(String(u || '')) || '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  let pm = null; try { pm = SM.pageMatch(pageModel, head).match; } catch (e) { pm = null; }
  const same = !!(pm && keyOf(pm.url) === keyOf(ep.url));
  const conf = ep.confidence != null ? ep.confidence : (same && pm.confidence != null ? pm.confidence : null);
  const ev = String(ep.evidence || (same ? pm.evidence || '' : '') || '').trim()
    || ('handed in as the page for "' + head + '"' + (ep.matched_by ? ' (matched by its ' + ep.matched_by + ')' : '') + (ep.title ? ': "' + String(ep.title).slice(0, 100) + '"' : ''));
  return { url: ep.url, source: ep.source || 'sitemap', matched_by: ep.matched_by || (same ? pm.matched_by : '') || '', title: ep.title || (same ? pm.title || '' : ''), confidence: conf, evidence: ev };
})();
Object.assign(top, { exists: !!headExisting, target_url: headExisting ? headExisting.url : plannedUrl(head), existing_source: headExisting ? headExisting.source : null, status: headExisting ? 'improve' : 'new',
  existing_confidence: headExisting && headExisting.confidence != null ? headExisting.confidence : null, existing_evidence: headExisting ? (headExisting.evidence || '') : '',
  may_overlap: !headExisting && mayOverlapLP.has(head) ? mayOverlapLP.get(head) : null });   // K8: a weak candidate is named, never planned over

// ---- feasibility of the destination (alternatives before any page is dropped) ----
const status = difficulty_for_you === 'not_realistic' ? 'unrealistic' : difficulty_for_you === 'very_hard' ? 'stretch' : 'winnable';
const altPool = [...(base.verdict_changes || []).filter(s => /["“”]/.test(String(s))), ...(base.secondary_keywords || [])].slice(0, 4);
const altPages = [...rungs[2].pages, ...rungs[1].pages, ...rungs[0].pages].map(p => p.keyword);
let alternatives = status === 'winnable' ? [] : (altPool.length ? altPool : altPages.slice(0, 3));
// E-GATE (RV-11): a career head gets buyer searches from its own pool as alternatives (each already passed the gate)
// KW-LADDER (review item 7): never the same search with a city added ("ai consultant dubai" for "ai consultant"): an alternative that carries
// every word of the head needs a buyer word (services, company, hire, cost ...) to be a different search
const headWordsLP = fitTokens(head).map(t => t.replace(/s$/, ''));
const sameSearchPlus = (k) => { const t = fitTokens(k).map(w => w.replace(/s$/, '')); return headWordsLP.length > 0 && headWordsLP.every(w => t.includes(w)) && !FIT_BUYER_KW.test(' ' + String(k).toLowerCase() + ' '); };
if (careerHead) alternatives = altPages.filter(k => !sameSearchPlus(k)).slice(0, 3);

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
if (dupHead) refusal = { reason: 'duplicate', ladder_id: dupHead.ladder_id, head: dupHead.head, by: dupHead.match.by,
  message: 'This website already has a keyword ladder for "' + dupHead.head + '" (' + dupHead.ladder_id + ')' + (String(dupHead.head) !== String(head).toLowerCase().trim() ? ': ' + sameWhyLP(dupHead.match, head, dupHead.head) : '') + '. One search needs one page, so no second ladder was planned: continue that ladder instead.' };
// KWL-LAD D14: the head is a page another ladder already plans: refused the same way, with the reason in plain words
else if (headTakenAsPage) refusal = { reason: 'duplicate', ladder_id: headTakenAsPage.ladder_id, head: headTakenAsPage.head, their_keyword: headTakenAsPage.keyword, by: headTakenAsPage.match.by,
  message: 'Your ladder "' + (headTakenAsPage.head || headTakenAsPage.keyword) + '" (' + headTakenAsPage.ladder_id + ') already plans a page for "' + headTakenAsPage.keyword + '": ' + sameWhyLP(headTakenAsPage.match, head, headTakenAsPage.keyword)
    + '. One search needs one page, so no second ladder was planned: continue that ladder, or pause it and start this one.' };
else if (plan.plan_type === 'none') refusal = { reason: 'not_realistic', message: '"' + head + '" is not a realistic main keyword for ' + domain + ' (' + (other_brand ? 'it is another company\'s brand: ' + headGate.detail : navigational ? 'people searching it look for one particular website or brand' + (!headGate.ok ? ': ' + headGate.detail : '') : 'the verdict is AVOID') + '). No ladder pages were planned; pick one of the alternatives as the main keyword instead.' };
else if (careerHead) refusal = { reason: 'career', short: 'people search it to find work or training', detail: headGate.detail,
  message: '"' + head + '" is not a good main keyword for ' + domain + '. People searching it are mostly looking for work or training, not for a provider ('
    + ((headGate.career || {}).signals || []).join('; ') + '). A page written for it would compete with job boards and courses for people who are not buyers, so no ladder pages were planned'
    + (alternatives.length ? '. Pick a search buyers make as the main keyword instead, for example "' + alternatives.join('", "') + '".' : '. Pick a search buyers make as the main keyword instead (for example the service with "services", "company" or your city in it).') };
else if (serpOut) {
  // F-SERP (2026-10-20, real-credit rehearsal execs 23 / 31): the client's own keyword came back NOT_CHECKED twice in a row because
  // DataForSEO's scraper answered 40101 "Internal SE Server Error." to the heavy request. The message the client reads says what
  // happened in plain words: Google's results could not be read right now, it is not about their keyword, and when to try again.
  // The provider's own message stays in `detail` (and in data_check.serp_error) for support, never as the client's explanation.
  const sfR = base.serp_features || {};
  const tries = Number(sfR.attempts) || 1;
  const transient = sfR.retryable !== false;
  refusal = { reason: 'serp_unchecked', short: 'the live Google results could not be checked', detail: serpOut, attempts: tries, transient,
    message: 'We could not read Google\'s results for "' + head + '" right now: our search data provider did not answer'
      + (tries > 1 ? ' after ' + tries + ' attempts' : '') + '. '
      + (transient
        ? 'This is a temporary problem on the provider\'s side. It is not a problem with your keyword, and it says nothing about whether "' + head + '" is a good choice. '
        : 'The provider refused the request, which is a problem on our side, not with your keyword. ')
      + 'A ladder plan is a bet on who ranks for the keyword, so none was planned, nothing was scored and no page was written. '
      + (transient ? 'Please try again later (in an hour or so).' : 'Please try again later; if it keeps happening, contact support.') };
}
else if (thinPool) refusal = { reason: 'thin_data', short: 'the keyword research returned too little data', pool_size: poolSize, minimum: LADDER_MIN_POOL, head_measured: headMeasured,
  message: 'The keyword research returned only ' + poolSize + ' keyword' + (poolSize === 1 ? '' : 's') + ' around "' + head + '" in ' + (base.country || 'this market')
    + (headMeasured ? ' (a ladder needs at least ' + LADDER_MIN_POOL + ' to pick rungs from)' : ', and the search data provider has no search volume and no difficulty for "' + head + '" itself')
    + ', so there is not enough data to plan one. No pages were planned and none was written: check the destination keyword, or run it again if the search data provider was failing.' };
const dataRefused = !!(refusal && (refusal.reason === 'serp_unchecked' || refusal.reason === 'thin_data'));
const plan_type = refusal ? 'none' : plan.plan_type;
const planned = !refusal;

// ---- R34 (2026-10-16): one live page, one plan entry ----
// With the page inventory's titles read, the same existing page can answer the main keyword and a rung keyword ("ai consulting dubai"
// and "ai consulting" both -> /ai-copilot-advisory-uae). Improving one page twice is not two pages: a rung page whose existing URL is
// already claimed (by the main page first, then by a stronger rung page) is folded into that entry as a supporting keyword, and said so.
const folded = [];
{ const ukeyF = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const claim = new Map(); if (top.exists) claim.set(ukeyF(top.target_url), top);
  for (const r of rungs) r.pages = r.pages.filter(p => { if (!p.exists) return true; const k = ukeyF(p.target_url); const owner = claim.get(k);
    if (!owner) { claim.set(k, p); return true; }
    owner.supporting = [...new Set([...(owner.supporting || []), p.keyword, ...(p.supporting || [])])];
    folded.push({ keyword: p.keyword, rung: r.rung, url: p.target_url, into: owner === top ? 'main page' : owner.keyword, traffic_potential: p.traffic_potential || 0,
      note: '"' + p.keyword + '" is answered by the same live page as ' + (owner === top ? 'the main keyword' : '"' + owner.keyword + '"') + ' (' + p.target_url + '), so it is a supporting keyword of that page, not a second page' });
    return false; }); }
// ---- F-A1 / A-8 + A-10 (2026-10-17, re-rating exec 770): one keyword, one page - across the rungs, the main page's supporting keywords,
//      the site's other ladders and its live pages ----
// Exec 770 planned "it consulting company dubai" twice: as the rung page of row 32 and as a supporting keyword of the main page (row 33),
// whose six supporting keywords were the verdict's own list, grouped with the main keyword on nothing but their words (only one of them
// had its results page read, and it shares 0 of the main keyword's top 7). The plan's note said "A search that an existing page already
// answers is never given a second page" while it did exactly that inside the plan. Every keyword now has exactly one owner:
//   1. a rung page owns its own keyword and its members (the results pages decided those, Ladder Clusters);
//   2. two rung pages for the same keyword - the same words where Google's own pages were not read for both - become one;
//   3. the main page's supporting keywords are kept only when nothing above owns them, no other ladder has them, no live page of the site
//      answers them, they pass the fit gate and the topic test, and - when their results page was read (Ladder Cluster Requests buys it
//      within the same cap) - Google answers them with the main keyword's own pages; a supporting keyword whose results page could not
//      be read is kept and labelled "grouped by topic, not compared", never presented as measured.
const one_page = { moved: [], left_out: [], kept: [] };
{
  const lowK = (x) => String(x || '').toLowerCase().trim();
  const urlsOfK = (kw) => { const u = (((SERP_CL || {}).urls_of) || {})[lowK(kw)]; return Array.isArray(u) && u.length ? u : null; };
  const needK = (SERP_CL || {}).min_shared_urls || 3, depthK = (SERP_CL || {}).top_n || 7;
  // 2026-10-21 (paid run r04): the main keyword's top 7 came from competitors_summary - the pages the competitor analysis could READ, after
  // it skipped Reddit / LinkedIn / Wikipedia / marketplaces - so a gap-toothed list stood for "the main keyword's results page" and no rung
  // could be measured against it ("ai consulting", "ai consultant dubai" and "ai consulting firm" stayed pages of their own beside "ai
  // consultant"). The results page this run already bought for the main keyword (SERP Top 10 or its retries) is read here in full, at the
  // same depth and by the same URL rule as the rungs; competitors_summary stays the fallback when that answer is not in this run.
  const serpHeadUrls = (() => { if (!HEAD_SERP) return null;   // KW-LADDER: the one reading of the head's page (HEAD_SERP, above)
    const u = [...new Set(HEAD_SERP.organic.map(x => KWI.urlKey(x.url || x.domain)).filter(Boolean))].slice(0, depthK);
    return u.length >= KWI.CFG.min_urls ? u : null; })();
  const headUrls = serpHeadUrls || (base.competitors_summary || []).filter(c => c && Number(c.rank) >= 1 && Number(c.rank) <= depthK)
    .sort((a, b) => Number(a.rank) - Number(b.rank)).map(c => KWI.urlKey(c.url || c.domain)).filter(Boolean);
  const headRead = headUrls.length >= KWI.CFG.min_urls;
  one_page.head_results = serpHeadUrls ? 'the main keyword\'s own results page (top ' + headUrls.length + ')' : headRead ? 'the competitor pages read for the main keyword (' + headUrls.length + ')' : 'not available';
  const sharedN = (a, b) => { const sb = new Set(b); return a.filter(u => sb.has(u)).length; };
  // measured overlap only: null / -1 when a results page was not read (then the words decide, as before)
  const headShare = (kw) => { const u = urlsOfK(kw); return u && headRead ? sharedN(u, headUrls) : null; };
  const pairShare = (a, b) => { const ua = urlsOfK(a), ub = urlsOfK(b); return ua && ub && lowK(a) !== lowK(b) ? sharedN(ua, ub) : -1; };
  // the same words: every word kept (numbers and one-letter words too - "phase 1" is not "phase 2"; "best" and "top" change the search),
  // only joining words dropped and a plural folded ("companies" = "company"); the R1 cross-ladder rule (overlapTokens, 75%) is looser
  // on purpose and is not used here
  const JOIN = new Set(['in', 'the', 'a', 'an', 'of', 'for', 'to', 'on', 'at', 'and', 'with', 'by', 'from']);
  const wordsKey = (kw) => [...new Set(lowK(kw).split(/[^a-z0-9]+/).filter(t => t && !JOIN.has(t)).map(t => t.length > 3 ? t.replace(/ies$/, 'y').replace(/([^s])s$/, '$1') : t))].sort().join(' ');
  // the same keyword: the same string, or - unless Google's own pages were read for both and settle it - the same words
  const sameKw = (a, b) => { a = lowK(a); b = lowK(b); if (!a || !b) return false; if (a === b) return true;
    const ua = a === head ? (headRead ? headUrls : null) : urlsOfK(a), ub = b === head ? (headRead ? headUrls : null) : urlsOfK(b);
    if (ua && ub) return sharedN(ua, ub) >= needK;
    const wa = wordsKey(a); return !!wa && wa === wordsKey(b); };
  // "does the site already hold this search" is ONE rule, the one the page run's verdict applies to its secondary keywords (F-A3,
  // v5/code/_own_cover.js OWN.claim): a live page (Search Console's own word, or EVERY meaningful word in its slug / title - page_min 1:
  // SM.matchPage's 75% lets "it consulting services dubai" match "AI Consulting Copilot Advisory Services in UAE", 3 of 4 with the subject
  // missing), then another keyword ladder of the site (read back through the fit gate), then an unpublished draft. This ladder's own rows
  // are not stored yet, so they never claim themselves.
  const ownLadders = OWN.ladders(others.filter(r => { try { return fitStored(r, { own_domain: domain, protect: [String(r.head_keyword || '')] }).ok; } catch (e) { return true; } }), settingsRows, { domain });
  const ownDrafts = OWN.drafts(rowsOf('Load Content Log (Ladder)').filter(r => reachDomain(r.domain) === reachDomain(domain)), { domain });
  const ownCtx = (exclude) => ({ matchPage: (k) => SM.matchPage(pageModel, k), ladders: ownLadders, drafts: ownDrafts, exclude_urls: exclude, self: { ladder_id: ladderId, keyword: head }, page_min: 1 });
  const pageOnly = (exclude) => ({ ...ownCtx(exclude), ladders: [], drafts: [] });
  const claimsOf = (pg) => [pg.keyword, ...(pg.supporting || []), ...((pg.keywords || []).map(k => k.keyword))].map(lowK).filter(Boolean);
  // 2. rung pages, in plan order: a page whose keyword another page already owns is folded into that page (or into the main page)
  const owners = [];
  for (const r of rungs) r.pages = r.pages.filter(pg => {
    if (sameKw(pg.keyword, head)) {
      // 2026-10-21: the page's other keywords go with it (they were dropped before), and a measured share is printed as measured
      const hs = headShare(pg.keyword);
      top.supporting = [...new Set([...(top.supporting || []), pg.keyword, ...(pg.supporting || [])])];
      one_page.moved.push({ keyword: pg.keyword, from: 'rung ' + r.rung + ' page', to: 'the main page', ...(hs != null ? { shared_urls: hs, of: headUrls.length } : {}),
        why: hs != null ? 'Google answers it with the main keyword\'s own pages (' + hs + ' of the top ' + headUrls.length + ' shared, ' + needK + ' needed), so it is a supporting keyword of the main page, not a page of its own' : 'it is the main keyword\'s own search' });
      for (const m of (pg.supporting || [])) one_page.moved.push({ keyword: m, from: 'rung ' + r.rung + ' page "' + pg.keyword + '"', to: 'the main page', why: 'it went with "' + pg.keyword + '", whose results page is the main keyword\'s' });
      return false; }
    const owner = owners.find(o => claimsOf(o).some(k => sameKw(k, pg.keyword)));
    if (owner) { owner.supporting = [...new Set([...(owner.supporting || []), pg.keyword, ...(pg.supporting || [])])];
      one_page.moved.push({ keyword: pg.keyword, from: 'rung ' + r.rung + ' page', to: '"' + owner.keyword + '"', why: 'the same search as a keyword that page already targets' }); return false; }
    // 2026-10-21: every OTHER keyword of the page too, pair by pair - a member Google answers with the main keyword's pages joins the main
    // page; a member sharing its results page with a keyword an earlier page already claims joins that page (A-9: two searches sharing 3 of
    // 7 that the grouping had put in two different groups stayed on two pages)
    const before = new Set(pg.supporting || []);
    pg.supporting = (pg.supporting || []).filter(m => {
      const mh = headShare(m);
      if (mh != null && mh >= needK) { top.supporting = [...new Set([...(top.supporting || []), m])];
        one_page.moved.push({ keyword: m, from: 'rung ' + r.rung + ' page "' + pg.keyword + '"', to: 'the main page', shared_urls: mh, of: headUrls.length,
          why: 'Google answers it with the main keyword\'s own pages (' + mh + ' of the top ' + headUrls.length + ' shared, ' + needK + ' needed)' }); return false; }
      for (const o of owners) { const k = claimsOf(o).find(c => pairShare(c, m) >= needK); if (!k) continue;
        const n = pairShare(k, m); o.supporting = [...new Set([...(o.supporting || []), m])];
        one_page.moved.push({ keyword: m, from: 'rung ' + r.rung + ' page "' + pg.keyword + '"', to: '"' + o.keyword + '"', shared_urls: n, of: depthK,
          why: 'it shares ' + n + ' of its top ' + depthK + ' with "' + k + '", which that page already targets (' + needK + ' needed)' }); return false; }
      return true; });
    if (Array.isArray(pg.keywords)) pg.keywords = pg.keywords.filter(k => !before.has(k.keyword) || pg.supporting.includes(k.keyword));
    owners.push(pg); return true; });
  // a rung page's supporting keyword that a live page of the site already answers belongs to that page, not to a new one
  for (const pg of owners) pg.supporting = (pg.supporting || []).filter(kw => { const c = OWN.claim(kw, pageOnly(pg.exists ? [pg.target_url] : []));
    if (!c) return true;
    one_page.left_out.push({ keyword: kw, page: pg.keyword, why: OWN.sayOf(c) + ' already answers it' }); return false; });
  // 3. the main page's supporting keywords
  const cand = [...new Set([...(top.supporting || []), ...(base.secondary_keywords || [])].map(lowK).filter(Boolean))].slice(0, 12);
  const keep = [];
  for (const kw of cand) {
    const out = (why, extra) => { one_page.left_out.push({ keyword: kw, page: 'main page', why, ...(extra || {}) }); };
    if (kw === head) continue;   // the same search as the head (same words, or the same results page) belongs on this page: it is kept below
    // R34 / step 2 above: a keyword folded into the main page because the same live page (or the main search itself) answers it stays
    const fold = folded.find(f => lowK(f.keyword) === kw && f.into === 'main page') || one_page.moved.find(m => lowK(m.keyword) === kw && m.to === 'the main page');
    if (fold) { keep.push(fold.shared_urls != null && fold.shared_urls >= needK ? { keyword: kw, by: 'shared results page', shared_urls: fold.shared_urls, of: fold.of || headUrls.length }
      : { keyword: kw, by: fold.why || 'the same live page answers it', shared_urls: null, of: null }); continue; }
    const owner = owners.find(o => claimsOf(o).some(k => sameKw(k, kw)));
    if (owner) { out('the rung page "' + owner.keyword + '" targets it'); continue; }
    const tk = takenBy(kw); if (tk) { out('it belongs to your ladder "' + tk.head + '"'); continue; }   // R1, the cross-ladder rule the rungs use
    const oc = OWN.claim(kw, ownCtx(top.exists ? [top.target_url] : []));
    if (oc) { out(OWN.sayOf(oc) + (oc.kind === 'page' ? ' already answers it' : ' holds it (' + oc.how + ')'), { claim: oc.kind }); continue; }
    const g = fitGate(kw, { ...fitCtxP, intent: '' }); if (!g.ok) { out('refused by the fit gate (' + g.reason + ')'); continue; }
    const hf = RAD.headFit(head, kw); if (!hf.ok) { out('not on this ladder\'s topic'); continue; }
    const u = urlsOfK(kw);
    if (u && headRead) {
      const n = sharedN(u, headUrls);
      if (n >= needK) { keep.push({ keyword: kw, by: 'shared results page', shared_urls: n, of: headUrls.length }); continue; }
      const cl = clusterOf[kw];
      out('Google answers it with other pages: ' + n + ' of the main keyword\'s top ' + headUrls.length + ' (' + needK + ' needed)' + (cl ? '; it groups with "' + cl.head_keyword + '"' : ''), { shared_urls: n });
      continue;
    }
    keep.push({ keyword: kw, by: 'topic label (results page not compared)', shared_urls: null, of: null });
  }
  const kept = keep.slice(0, 6);
  top.supporting = kept.map(k => k.keyword);
  top.supporting_basis = kept;
  const measured = kept.filter(k => k.by === 'shared results page').length, viaFold = kept.filter(k => k.by !== 'shared results page' && k.shared_urls == null && !/^topic label/.test(k.by)).length;
  top.grouped_by = !kept.length ? (headRead ? 'no supporting keyword shares the main keyword\'s results page' : 'no supporting keyword')
    : measured + viaFold === kept.length ? 'shared results page (each shares at least ' + needK + ' of the main keyword\'s top ' + headUrls.length + ')' + (viaFold ? ' or the same live page' : '')
      : measured ? 'shared results page for ' + measured + ' of ' + kept.length + '; the rest grouped by topic (their results pages were not compared)'
        : 'topic label (results pages not compared)';
  one_page.kept = kept;
}
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
const topLabel = 'Top: ' + head;
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
    + (divBand === 'open' ? ': no site owns more than its share, so the page is as open as a results page gets and the feasibility score is unchanged.'
      : ': ' + (divBand === 'concentrated' ? 'few sites own this page' : 'the page is narrow') + ', so at least one of them holds several of the results with the topical coverage that takes. The feasibility score is '
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
// R34 (2026-10-16): the count read only this run's sitemap URLs and link candidates (`invPages`), never the page inventory and its titles,
// so a live page titled "AI Consulting & Copilot Advisory UAE" was not "about" the topic. It reads the whole site model now, title + H1.
for (const p of SM.pages(pageModel)) { const u = String(p.url || ''); if (!u || seenPg.has(u) || !onTopicPage({ ...p, title: [p.title, p.h1].filter(Boolean).join(' ') })) continue; seenPg.add(u); pagesOnTopic.push({ url: u, title: String(p.title || '') }); }
const titleGapL = SM.titleGap(pageModel);
const allPlanned = planned ? [...rungPages, top] : [];
const nImprove = allPlanned.filter(p => p.exists).length, nNew = allPlanned.length - nImprove;
const bestPos = topic_authority.best;
topic_authority.coverage = { pages_on_site: pagesOnTopic.length, pages: pagesOnTopic.slice(0, 8), ranked_keywords: topic_authority.on_topic, title_gap: titleGapL, folded,
  titles_read: PAGE_TITLES ? { asked: PAGE_TITLES.asked, read: titlesRead.slice(0, 8), failed: (PAGE_TITLES.failed || []).slice(0, 8), redirected: (PAGE_TITLES.redirected || []).slice(0, 8), skip_reason: PAGE_TITLES.skip_reason || '' } : null,
  top10_keywords: topic_authority.top10, best_position: bestPos ? bestPos.position : null, best_keyword: bestPos ? bestPos.keyword : '',
  planned_total: allPlanned.length, planned_improve: nImprove, planned_new: nNew,
  summary: !planned ? 'No pages were planned, so there is nothing to compare with what the site already has.'
    // KWL-LAD D9: a plan that improves a page of the site never says that all its pages are new
    : nImprove && !pagesOnTopic.length && !topic_authority.on_topic
      ? 'Of the ' + allPlanned.length + ' page(s) in this plan, ' + nImprove + ' improve' + (nImprove === 1 ? 's' : '') + ' a page you already have ('
        + allPlanned.filter(p => p.exists).slice(0, 3).map(p => String(p.target_url).replace(/^https?:\/\/[^\/]+/i, '') || '/').join(', ') + ') and ' + nNew + ' ' + (nNew === 1 ? 'is' : 'are') + ' new; ' + domain + ' ranks for no keyword on "' + head + '" yet.'
        + (titleGapL.untitled ? ' Note: ' + titleGapL.note + '.' : '')
    : (!pagesOnTopic.length && !topic_authority.on_topic
      ? (titleGapL.untitled
        ? 'No page of ' + domain + ' is about "' + head + '" by its title or address, and it ranks for no keyword on it, but ' + titleGapL.note + ' (e.g. ' + titleGapL.urls.slice(0, 3).join(', ') + '). So all ' + allPlanned.length + ' page(s) in this plan are planned as new; check those pages first.'
        : 'Nothing on ' + domain + ' is about "' + head + '" yet (no page and no keyword it ranks for), so all ' + allPlanned.length + ' page(s) in this plan are new and this topic starts from zero.')
      : domain + ' already has ' + pagesOnTopic.length + ' page(s) about "' + head + '" and ranks for ' + topic_authority.on_topic + ' keyword(s) on it ('
        + topic_authority.top10 + ' in the top 10' + (bestPos ? ', best #' + bestPos.position + ' for "' + bestPos.keyword + '"' : '') + '). Of the '
        + allPlanned.length + ' page(s) in this plan, ' + nImprove + ' improve' + (nImprove === 1 ? 's' : '') + ' a page you already have and ' + nNew + ' ' + (nNew === 1 ? 'is' : 'are') + ' new.'
        + (titleGapL.untitled ? ' Note: ' + titleGapL.note + '.' : ''))   // R34: what was judged on the address alone is said, in both branches
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
// ---- F-A1 / A-12 (2026-10-17, re-rating exec 770): the website's own limits, the same ones the Content Cadence applies ----
// Exec 770 started a seventh active ladder against `max_active: 2` without a word, and wrote the main page while its own note said
// "You have 5 pages waiting to be published (limit 3)". The limits live in the `_site` row of seo_ladder_settings and the cadence obeys
// them every Monday; a ladder run asked to write pages now obeys them too: past either limit the pages are HELD (the plan and its rows
// are stored, nothing is written, the rows stay `planned`), and the plan says which limit, with the numbers. The cadence writes them
// when the limit clears. `force_content: true` on the request overrides both, and the plan says that it did.
const focusL = WAITING.focus({ ladders: rowsOf('Load Domain Ladders').filter(r => reachDomain(r.domain) === reachDomain(domain)), settings: settingsRows,
  log: rowsOf('Load Content Log (Ladder)').filter(r => reachDomain(r.domain) === reachDomain(domain)), exclude: ladderId, now: Date.now() });
const ownSet = settingsRows.find(r => String(r.ladder_id) === ladderId) || null;
// keyword-first R-K7 (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1 / §14.5): the mode the ladder is STARTED in, when the request names it
// (`ladder_mode`, the app's "Ask me before each page"), else its own settings row, else the website's default
const reqMode = ['auto', 'manual'].includes(String(base.ladder_mode || '').toLowerCase()) ? String(base.ladder_mode).toLowerCase() : '';
const ownMode = reqMode || (ownSet && ['auto', 'manual'].includes(String(ownSet.mode || '').toLowerCase()) ? String(ownSet.mode).toLowerCase() : focusL.site_mode);
const ownPrio = ownSet && Number(ownSet.priority) >= 1 ? Number(ownSet.priority) : Infinity;
const ahead = focusL.order.filter(l => l.priority < ownPrio || ownPrio === Infinity);
const queuedL = planned && ownMode === 'auto' && ahead.length >= focusL.max_active;
const forced = base.force_content === true;
const holdWhy = [];
// R-K7: a Manual ladder writes NOTHING at start - its text always said its pages wait for an OK, and until now the first pages_now were written
// anyway (pagesNow can never be 0). This is the client's own choice, not a limit, so `force_content` does not override it.
const manualHold = planned && write_now.length && ownMode === 'manual' ? { limit: 'manual', text: 'this ladder is Manual, so its pages wait for your OK: nothing was written at the start, and each page is written when you approve it (Write it on the Pipeline page)' } : null;
if (planned && write_now.length && pile_up.at_limit) holdWhy.push({ limit: 'pileup', text: pile_up.waiting + ' page(s) are written and waiting to be published, and the website\'s limit is ' + pile_up.limit
  + (pile_up.needs_fix ? ' (' + pile_up.needs_fix + ' of them did not pass the quality check and need a fix first)' : '') });
if (planned && write_now.length && queuedL) holdWhy.push({ limit: 'max_active', text: 'the website writes at most ' + focusL.max_active + ' Auto ladder(s) at a time, and ' + ahead.length + ' with pages still to write come before this one ('
  + ahead.slice(0, 4).map(l => '"' + l.head + '"').join(', ') + (ahead.length > 4 ? ' and ' + (ahead.length - 4) + ' more' : '') + '), so it waits as Queued' });
// P1 (2026-10-20, rehearsal §4 item 1, owner decision): no page is written before the website's author profile and business facts are on file.
// The rehearsal's first page was written at once with neither and Content QA refused it ("11 bracketed field(s) in the byline, the author box
// and the Person schema", claims nothing on file supports), while the client paid about 62 credits for a draft. The plan is still made and
// stored; the page is HELD like a Manual ladder's (its rows stay `planned`, Spawn Page Runs starts nothing, nothing is charged for it) and the
// Content Cadence writes it in the first cycle after both are filled in. The facts are the request's (the app sends the website's own) or the
// site model's; the profile is the seo_profiles row the run already loaded (*Load Profile (Model)*). `force_content` does not override it: it
// is the owner's rule, not a limit. One rule with the cadence and the app: v5/code/_readiness.js.
const readyRow = rowsOf('Load Profile (Model)').find(r => r.site_id === reachSiteId(domain) || (r.domain && reachDomain(r.domain) === reachDomain(domain))) || {};
const readiness = READY.of({ profile: readyRow, facts: String(base.business_facts || '').trim() || String((siteModel || {}).business_facts || '') });
const profileHold = planned && write_now.length && !readiness.ready ? { limit: 'profile', missing: readiness.missing.map(m => m.key),
  text: READY.REASON + ': the first page waits until you add ' + readiness.missing_text + ' (Website settings), so it is not written as a draft with blanks to fill; nothing was charged for it' } : null;
const held = manualHold ? { pages: write_now.splice(0, write_now.length), why: [manualHold, ...(profileHold ? [profileHold] : []), ...holdWhy] }
  : profileHold ? { pages: write_now.splice(0, write_now.length), why: [profileHold, ...holdWhy] }
  : holdWhy.length && !forced ? { pages: write_now.splice(0, write_now.length), why: holdWhy } : null;
const limits = { max_active: focusL.max_active, active_ahead: ahead.length, active_ladders: focusL.active.map(l => l.head), queued: queuedL, own_mode: ownMode, manual_hold: !!manualHold,
  profile_hold: !!profileHold, readiness,   // P1: the first page waits for the author profile and the business facts
  chosen_by: ['client_typed', 'client_picked', 'system_announced'].includes(String(base.chosen_by || '')) ? String(base.chosen_by) : 'client_typed',   // R-K1: who chose this keyword (stored by Ladder Settings Rows)
  max_waiting: pile_up.limit, waiting: pile_up.waiting, waiting_needs_fix: pile_up.needs_fix, at_waiting_limit: pile_up.at_limit, forced: !!(forced && holdWhy.length),
  basis: focusL.basis + '; ' + pile_up.basis,
  text: 'Limits of this website: at most ' + focusL.max_active + ' Auto ladder(s) written at a time (' + ahead.length + ' ahead of this one' + (queuedL ? ', so it waits as Queued' : ownMode === 'manual' ? '; this ladder is Manual, so its pages wait for your OK' : ', so it is written now') + '); at most '
    + pile_up.limit + ' written pages waiting to be published (' + pile_up.waiting + ' now' + (pile_up.needs_fix ? ', ' + pile_up.needs_fix + ' needing a fix' : '') + ').'
    + (held ? ' So the page' + (held.pages.length === 1 ? '' : 's') + ' asked for now (' + held.pages.map(w => '"' + w.keyword + '"').join(', ') + ') ' + (held.pages.length === 1 ? 'was' : 'were') + ' NOT written: ' + held.why.map(w => w.text).join('; and ')
      + (manualHold ? '. The plan is stored; nothing is written until you approve a page.'
        : profileHold && !holdWhy.length ? '. The plan is stored and the page is written in your next weekly cycle once both are on file (or at once with Write it now on the Pipeline page).'
        : '. The plan is stored and the Content Cadence writes ' + (held.pages.length === 1 ? 'it' : 'them') + ' when ' + (held.why.some(w => w.limit === 'pileup') ? 'the waiting pages are published or discarded' : '') + (held.why.length > 1 ? ' and ' : '') + (held.why.some(w => w.limit === 'max_active') ? 'a ladder ahead of it is finished or paused (or you move this one up on the Pipeline page)' : '') + '.')
      : (forced && holdWhy.length ? ' The request said to write anyway (force), so the limits were overridden for this run: ' + holdWhy.map(w => w.text).join('; and ') + '.' : '')) };
const pages_total = planned ? rungPages.length + 1 : 0;
const stats = { pool_size: (pool.research || {}).pool_size || 0, ai_reviewed: rel.size, relevant: kws.length, pages_total, rung_pages: planned ? rungPages.length : 0,
  keywords_covered: planned ? rungPages.reduce((s, p) => s + 1 + p.supporting.length, 0) + 1 + top.supporting.length : 0,
  traffic_potential_total: planned ? rungPages.reduce((s, p) => s + (p.traffic_potential || 0), 0) + (top.traffic_potential || 0) + folded.reduce((s, f) => s + (f.traffic_potential || 0), 0) : 0,   // R34: a folded keyword still counts once
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
  services: [...(base.services || []), ...((sdP.products_or_services) || [])], site_topics: [head],   // E-GATE RV-20: the verdict's own secondary keywords are not the client's topics (they were quoted back as evidence)
  pages: invPages.map(p => ({ url: p.url, title: p.title || '' })),
  topics: [{ topic: top.topic || head, primary_keyword: head, kd: top.kd, volume: top.volume, keyword_count: 1 + (top.supporting || []).length, your_position: top.your_position, keywords: (top.supporting || []).map(k => ({ keyword: k })) },
    ...rungPages.map(p => ({ topic: p.topic || p.keyword, primary_keyword: p.keyword, kd: p.kd, volume: p.total_volume, keyword_count: (p.keywords || []).length, your_position: p.your_position, keywords: p.keywords }))] });
const head_radius = RAD.pick(topic_radius, head);
const notes = [];
if (refusal) notes.push(refusal.message);
// B2-1 / B2-2: which reach this plan was measured against, and what the site already has on the topic — both in the owner's reading
notes.push(topic_authority.note);
if (planned) notes.push(topic_authority.coverage.summary);
if (planned) for (const f of folded) notes.push(f.note + '.');   // R34
// D7: what was read live for this plan, and what could not be
const goneLP = ((PAGE_TITLES || {}).failed || []).filter(f => f && [404, 410].includes(Number(f.status))), failedLP = ((PAGE_TITLES || {}).failed || []).filter(f => f && ![404, 410].includes(Number(f.status)));
if (planned && PAGE_TITLES && PAGE_TITLES.asked) notes.push('Pages read for this plan: ' + PAGE_TITLES.untitled + ' page(s) of the site had no title on file yet, so the '
  + PAGE_TITLES.asked + ' whose address could overlap these keywords were read now: '
  + titlesRead.slice(0, 8).map(r => r.url + ' ("' + String(r.title || r.h1).slice(0, 80) + '")').join(', ')
  + (failedLP.length ? (titlesRead.length ? '; ' : '') + failedLP.length + ' could not be read (' + failedLP.slice(0, 3).map(f => f.url + ': ' + f.reason).join(', ') + ') and were judged by their address only' : '')
  + (goneLP.length ? '; ' + goneLP.length + ' no longer exist (they answer ' + [...new Set(goneLP.map(f => f.status))].join(' or ') + ': ' + goneLP.slice(0, 3).map(f => f.url).join(', ') + '), so none of them is a page to improve' : '')
  + (redirectedLP.length ? '; ' + redirectedLP.length + ' redirect to another address (' + redirectedLP.slice(0, 3).map(r => r.url + ' to ' + r.to).join(', ') + '), so the old address is not a page to improve' : '')
  + '. A page that answers a search in this plan is improved, never given a second page.');
// B2-4: what Google itself said about which of these searches want the same page, what it cost, and what could not be compared
if (SERP_CL && SERP_CL.note) notes.push(SERP_CL.note
  + (planned && clusterRungs.length ? ' In this plan ' + clusterRungs.length + ' group(s) became one page each instead of several: '
    + clusterRungs.slice(0, 4).map(c => '"' + c.head_keyword + '" (+' + Math.max(0, c.keywords.length - 1) + ')').join(', ') + '.' : ''));
// B2-5: the destination's results page, and the stated effect on the score
if (serp_diversity.checked) notes.push(serp_diversity.text);
if (head_radius) notes.push('Topic radius for "' + head_radius.topic + '": ' + RAD.line(head_radius) + '.');
if (poolRefused.length) notes.push(poolRefused.length + ' keyword(s) were left out of the ladder because they are other companies\' brands, government or portal searches, or navigational: ' + poolRefused.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason + ')').join(', ') + (poolRefused.length > 6 ? ' and ' + (poolRefused.length - 6) + ' more' : '') + '.');
if (planned && plan_type === 'full' && rungPages.length && pages_total < 8) notes.push('Only ' + pages_total + ' pages could be planned from the data: the topic is narrow in ' + base.country + '. The ladder is shorter but still valid.');
if (planned && plan_type === 'full' && rungPages.length) for (const r of rungs) if (!r.pages.length) notes.push('No keywords fell into rung ' + r.rung + '; the ladder skips it.');
if (planned && plan_type === 'direct' && rungPages.length < 2) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned around the main keyword; add more as the site grows.');
if (planned && plan_type !== 'direct' && !rungPages.length) notes.push('No supporting keywords were found for "' + head + '" in ' + base.country + ' (the topic is narrow in the search data), so the main page is the whole ladder for now and is written first. Supporting pages can be added as the site grows.');
else if (planned && plan_type === 'short' && rungPages.length < 3) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned before the main page.');
if (offTopic.length) notes.push(offTopic.length + ' keyword(s) were left out because they are not on this ladder\'s topic ("' + head + '"): ' + offTopic.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason.replace(/^it is not on this ladder's topic: /, '') + ')').join(', ') + (offTopic.length > 6 ? ' and ' + (offTopic.length - 6) + ' more' : '') + '.');
if (excluded.length) notes.push(excluded.length + ' keyword(s) already belong to other ladders of this site and were left out (one search, one page): ' + excluded.slice(0, 6).map(x => '"' + x.keyword + '" (ladder "' + x.head + '")').join(', ') + (excluded.length > 6 ? ' and ' + (excluded.length - 6) + ' more' : '') + '.');
// F-A1: one keyword, one page; the limits; and the keywords whose results pages sell what this business does not
if (planned && (one_page.moved.length || one_page.left_out.length)) notes.push('One keyword, one page: '
  + [...one_page.moved.map(m => '"' + m.keyword + '" moved from its ' + m.from + ' to ' + m.to + ' (' + m.why + ')'),
     ...one_page.left_out.slice(0, 8).map(m => '"' + m.keyword + '" is not a supporting keyword of the ' + (m.page === 'main page' ? 'main page' : 'page "' + m.page + '"') + ': ' + m.why)].join('; ')
  + (one_page.left_out.length > 8 ? ' and ' + (one_page.left_out.length - 8) + ' more' : '') + '.');
if (planned && top.supporting && top.supporting.length) notes.push('The main page\'s supporting keywords are grouped by ' + top.grouped_by + ': ' + top.supporting_basis.map(k => '"' + k.keyword + '"' + (k.shared_urls != null ? ' (' + k.shared_urls + ' of ' + k.of + ')' : ' (not compared)')).join(', ') + '.');
for (const r of rungs) for (const pg of (r.pages || [])) if (pg.page_type_note) notes.push(pg.page_type_note + '.');
if (notSold.length) notes.push(notSold.length + ' keyword(s) were left out because the pages Google ranks for them offer something this business does not: ' + notSold.slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason.replace(/\.$/, '') + ')').join(', ') + (notSold.length > 6 ? ' and ' + (notSold.length - 6) + ' more' : '') + '.');
if (planned) notes.push(limits.text);
if (plan.stretch && planned) notes.push('Very hard for this site today: consider one of the alternatives first (' + alternatives.join(', ') + ').');
const order_text = !planned ? 'no pages' : plan_type === 'direct' ? 'main page first, then the supporting pages that link to it' : !rungPages.length ? 'the main page only for now (no supporting keywords in the data), written first' : plan_type === 'short' ? 'supporting pages first, then the main page once half of them are live' : 'rung by rung from the easiest pages, the main page last';
const ladder = { ladder_id: ladderId, head: { keyword: head, volume: top.volume, kd: top.kd, cpc: top.cpc, intent: top.intent, your_position: top.your_position },
  domain, country: base.country, goal: base.goal || 'leads', feasibility, rungs, top, folded, link_map, timeline, write_now, pages_now: pagesNow,
  later: later.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, ...(k.held_back ? { held_back: true } : {}) })), requirements, stats, notes,
  plan_type, difficulty_for_you, reach, months: planned ? plan.months : '', months_range: planned ? plan.months_range : null, stretch: planned && plan.stretch, planned, refusal, order: order_text,
  label: planned ? reachLabel(difficulty_for_you, plan) : (dataRefused || (refusal && refusal.reason === 'career')) ? ('No ladder planned · ' + refusal.short) : (REACH_DIFF_LABEL[difficulty_for_you] + ' · no ladder'),
  chance: planned ? plan.chance : null, chance_text: planned ? reachChanceText(plan) : '', base_rate: REACH_BASE_RATE, refused_keywords: poolRefused.slice(0, 40),
  reach_info: { reach: reachInfo.reach, method: reachInfo.method, p75: reachInfo.p75 ?? null, size_reach: reachInfo.size_reach ?? null, sample: reachInfo.sample ?? null, top10: reachInfo.top10 ?? null, organic_keywords: reachInfo.organic_keywords ?? null, cached: !!reachInfo.cached, cached_at: reachInfo.cached_at || null },   // B2-1: the SITE-wide measurement; `reach` above is what this topic was measured against
  pile_up,   // R42
  limits, held, one_page, not_sold_keywords: notSold.slice(0, 20),   // F-A1 A-12 / A-8 / A-11
  topic_authority,   // B2-1: what this site already wins on THIS topic, what it already has written about it, and which reach the plan used
  serp_clusters: SERP_CL,   // B2-4: the results pages this run read, the groups they made, what could not be compared and what it cost
  serp_cluster_rungs: clusterRungs.slice(0, 12), serp_diversity,   // B2-5: how many different sites own the destination's results page, and the stated adjustment
  overlaps: [...(dupHead ? [{ keyword: head, ladder_id: dupHead.ladder_id, ladder: dupHead.head, their_keyword: dupHead.head, by: dupHead.match.by, shared: dupHead.match.shared ?? null, action: 'refused', why: sameWhyLP(dupHead.match, head, dupHead.head) }] : []),
    ...(headTakenAsPage ? [{ keyword: head, ladder_id: headTakenAsPage.ladder_id, ladder: headTakenAsPage.head, their_keyword: headTakenAsPage.keyword, by: headTakenAsPage.match.by, shared: headTakenAsPage.match.shared ?? null, action: 'refused', why: sameWhyLP(headTakenAsPage.match, head, headTakenAsPage.keyword) }] : []), ...overlaps].slice(0, 40),   // KWL-LAD D14
  excluded_keywords: excluded.slice(0, 40), topic_radius, head_radius, off_topic_keywords: offTopic.slice(0, 20),   // R23: what the topic radius left out, with the reason   // G32: shown with the plan, never enforced on it
  words: { main: top.target_words || 0, rung: rungWords.words, main_source: top.target_words_source, rung_source: rungWords.source },   // R22: where each page's length target came from
  data_check: { pool_size: poolSize, minimum_pool: LADDER_MIN_POOL, head_measured: headMeasured, serp_checked: !serpOut, serp_error: serpOut, enough: !dataRefused },   // R23
  tracker: { cadence: base.tracker_cadence || 'weekly', auto_next_rung: !!base.auto_next_rung, stop_rule: 'once the top rung holds the top 3 for 4 checks it is checked monthly (with the published pages)' }, created_at: new Date().toISOString() };
return [{ json: { ...base, ladder, site_rankings: pool.site_rankings || null, reach_cache_row } }];
