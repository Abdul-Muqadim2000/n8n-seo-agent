// Research Result (E2, DESIGN.md §3.4-§3.13 + §4, CONTRACTS.md §2 KI_KW / KI_GAPS / §4): the keyword universe of this site and market.
//   * stage and intent from what ranks first (page types of the top 10), words second, Labs intent third (KI.stage); a probability under 0.65
//     or a stage read without a results page is "needs your review";
//   * one head-based clustering rule (KI.cluster: 3 shared of the top 10, no chaining), score with its range (KI.score: gated, multiplicative,
//     monotone; a range wider than 25 points is "low confidence"), one verdict word (KI.verdict from Win: Go / Takes a few months / Hard for your
//     site now; a gated search says why) - no verdict is typed by a model;
//   * the page each cluster maps to (SM.matchPage + the page Search Console credits): refresh it when the site ranks or has the page, a new page
//     otherwise, "get on these lists" when the top 10 is mostly lists / directories (R3 #5); two of the site's pages with impressions for one
//     cluster is a cannibalisation flag (R3 #6);
//   * striking distance (one definition): positions 8-20 with >= 100 impressions in 28 days (>= 30 on a small site);
//   * buyer questions: People also ask, autocomplete questions and Search Console question queries, deduplicated;
//   * gaps against the CHOSEN set only (KI.gaps), reconciled with the provider's intersection total or labelled "sample of N of M";
//   * the plan: up to 10 ranked actions (KI.plan), each with why, credits and its target.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const g = $('KI Gate').first().json || {};
const c = $('Research Candidates').first().json || {};
const rp = $('Research Picture').first().json || {};
const sp = $('Research SERP Picture').first().json || {};
const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return []; } };
const now = p.now || new Date().toISOString();
const N = KIW.N, S = KIW.S;
const client = KIW.host(p.domain);
const chosen = p.chosen || [];
const sections = [...(c.sections || []), ...(rp.sections || []), ...(sp.sections || [])];
const saveRows = [...(c.cache_rows || []), ...(rp.cache_rows || []), ...(sp.cache_rows || [])];
// ---- traffic potential of the #1 page (exact addresses only) ----
const cache = all('Load KI Cache').filter(r => r && r.key);
const tpKey = KIW.cacheKey(p.site_id, 'tp', p.market);
const tpOld = KIW.cacheRead(cache, tpKey) || {}; const tp = { ...((tpOld && tpOld.map) || {}) };
const tpReq = all('Any Research Traffic?').filter(r => r && !r.skip && r.ki_call); const tpPairs = KIW.paired(tpReq, all('Run Research Traffic Answers'));
let tpRead = 0; for (const x of tpPairs) { if (!x.ok) continue; for (const it of KIW.itemsOf(x.a)) { const u = S(it.target); if (!u) continue; tp[u] = { etv: N((((it.metrics || {}).organic) || {}).etv), at: now }; tpRead++; } }
if (tpRead) saveRows.push(KIW.cacheRow(p.site_id, tpKey, { fetched_at: now, map: tp }));
if (tpPairs.length) sections.push({ key: 'traffic_potential', ...KIW.callState(tpPairs, 'the traffic potential of the #1 pages'), rows: tpRead });
// ---- the site's pages (page mapping) ----
const pages = all('Load Pages (KI)').filter(r => r && r.url);
let model = null; try { model = SM.withPages(SM.from(g.site || { domain: p.domain }, {}), pages); } catch (e) { model = null; }
const matchUrl = (kw, prefer) => { try { const mm = model ? SM.matchPage(model, kw, prefer) : null; return mm ? S(mm.url || mm) : ''; } catch (e) { return ''; } };
// ---- every row, scored ----
const vm = sp.vol_map || rp.vol_map || {};
const by = sp.by || {};
const svcWeak = (top10) => { if (!top10 || !top10.length) return null; const ugc = top10.filter(t => ['forum', 'platform'].includes(t.type)).length; return Math.min(1, 0.2 + ugc / top10.length); };
const rows = (rp.rows || []).map(r0 => {
  const v = vm[r0.kw_key] || {};
  const r = { ...r0 }; if (r.volume == null && v.ads_v != null) { r.volume = v.ads_v; r.volume_source = 'google_ads'; if (r.cpc == null) r.cpc = v.ads_cpc; }
  const sr = by[r.keyword] || null; const top10 = sr ? sr.top10 : [];
  const st = KI.stage(top10, r.keyword, r.intent_label || r.labs_intent);
  const intentP = N(r.intent_p);
  const myPos = N(r.gsc_position) || ((top10.find(t => t.host === client) || {}).pos) || null;
  const comps = KIW.uniq([...(r.competitors || []).map(x => KIW.host(x.domain) + '|' + x.position + '|' + S(x.url)),
    ...top10.filter(t => chosen.includes(t.host)).map(t => t.host + '|' + t.pos + '|' + (t.exact ? t.url : ''))]).map(s0 => { const [domain, position, url] = s0.split('|'); return { domain, position: N(position), url }; })
    .filter(x => chosen.includes(x.domain)).sort((a, b) => (a.position || 99) - (b.position || 99));
  const best = {}; for (const x of comps) if (!best[x.domain] || x.position < best[x.domain].position) best[x.domain] = x;
  const compList = Object.values(best);
  const gapShare = chosen.length ? compList.filter(x => x.position && x.position <= 10).length / chosen.length : 0;
  const t1 = (top10.find(t => t.pos === 1 && t.exact) || {}).url; const tpv = t1 && tp[t1] ? N(tp[t1].etv) : null;
  const row = { ...r, stage: st.stage, intent: st.intent || r.intent_label || r.labs_intent || null, intent_confidence: KIW.r4(intentP != null ? Math.min(intentP, st.confidence) : st.confidence),
    needs_review: !!st.needs_review || !sr || (intentP != null && intentP < 0.65), stage_evidence: st.evidence || [], top10, serp: sr, client_position: myPos, competitors: compList, gap: KIW.r4(gapShare),
    weak_spots: svcWeak(top10), tp: tpv };
  row.demand = KI.demand(row, KI.CONFIG); row.win = KI.win(row, { domain: p.domain, impressions: p.site_impressions }, KI.CONFIG);
  const sc = KI.score(row, KI.CONFIG); row.score = sc.score; row.score_low = sc.low; row.score_high = sc.high; row.low_confidence = !!sc.low_confidence || !sr; row.factors = sc.factors;
  row.verdict = KI.verdict(row); return row; });
// ---- clusters (head-based, the rows with a results page read; the rest stand alone) ----
const clusterIn = rows.map(r => ({ ...r, top10: (r.top10 || []).map(t => ({ url: t.url, host: t.host, key: t.key })) }));
const clustered = KI.cluster(clusterIn, KI.CONFIG);
const cl = {}; for (const r of clustered) cl[r.kw_key] = r;
for (const r of rows) { const x = cl[r.kw_key] || {}; r.cluster_id = x.cluster_id || ('c_' + r.kw_key.replace(/[^a-z0-9]+/g, '_').slice(0, 40)); r.is_head = x.is_head !== false; r.cluster_size = N(x.cluster_size) || 1; }
const clusters = {};
for (const r of rows) (clusters[r.cluster_id] = clusters[r.cluster_id] || []).push(r);
const heads = [];
for (const [id, mem] of Object.entries(clusters)) {
  const head = mem.find(r => r.is_head) || mem[0];
  const cdem = KIW.r4(mem.reduce((s, r) => s + (N(r.demand) || 0), 0));
  const gscPages = KIW.uniq(mem.filter(r => N(r.gsc_impressions) > 0 && r.gsc_page).map(r => S(r.gsc_page)));
  const pageUrl = gscPages[0] || matchUrl(head.keyword, head.gsc_page);
  const pa = KI.pageAction({ top10: head.top10, gsc_page: head.gsc_page, page_url: pageUrl }, { domain: p.domain });
  const cannibal = gscPages.length >= 2 ? { pages: gscPages.slice(0, 5), why: gscPages.length + ' of your pages get impressions for the searches of this cluster: one should be the page, the others link to it' } : null;
  for (const r of mem) { r.cluster_demand = cdem; r.page_action = pa.action; r.page_url = pa.url || pageUrl || ''; r.cannibal = cannibal; }
  heads.push({ cluster_id: id, head: head.keyword, members: mem.length, demand: cdem, stage: head.stage || null, verdict: head.verdict, score: head.score, score_low: head.score_low, score_high: head.score_high,
    page_action: pa.action, page_url: pa.url || pageUrl || null, _gate: head.gate, _why: pa.why });
}
heads.sort((a, b) => (N(b.score) || 0) - (N(a.score) || 0) || (b.demand || 0) - (a.demand || 0) || a.head.localeCompare(b.head));
// ---- striking distance (one definition) ----
const small = (N(p.site_impressions) || 0) < KIW.CAPS.small_site_impr;
const minImpr = small ? KIW.CAPS.striking_impr_small : KIW.CAPS.striking_impr;
for (const r of rows) r.striking = !!(N(r.gsc_position) && r.gsc_position >= KIW.CAPS.striking_min && r.gsc_position <= KIW.CAPS.striking_max && (N(r.gsc_impressions) || 0) >= minImpr && r.gate === 'pass');
const striking = rows.filter(r => r.striking).sort((a, b) => (N(b.gsc_impressions) || 0) - (N(a.gsc_impressions) || 0) || a.kw_key.localeCompare(b.kw_key)).slice(0, 30)
  .map(r => ({ keyword: r.keyword, position: N(r.gsc_position), impressions: N(r.gsc_impressions) || 0, page: S(r.gsc_page), change: 'position ' + Math.round(N(r.gsc_position)) + ' with ' + (N(r.gsc_impressions) || 0) + ' impressions: improve this page for the search (title, a section that answers it, internal links)' }));
// ---- buyer questions (deduplicated by meaning: the same words in any order) ----
const QW = /^(what|how|why|which|who|when|where|is|are|can|does|do|should|will)\b/;
const qs = {}; const addQ = (q, src) => { const t = KIW.normKw(q).replace(/\?$/, ''); if (!QW.test(t) || t.split(' ').length < 3) return; if (!fitGate(t, { ...(p.fit_ctx || {}) }).ok) return; const k = KIW.keyOf(t);
  const x = qs[k] || (qs[k] = { question: t + '?', cluster_id: (rows.find(r => r.kw_key === k) || {}).cluster_id || null, sources: [] }); if (!x.sources.includes(src)) x.sources.push(src); };
for (const q of ((c.questions_src || {}).paa || [])) addQ(q, 'paa');
for (const q of ((c.questions_src || {}).autocomplete || [])) addQ(q, 'autocomplete');
for (const q of (p.gsc || [])) addQ(q.query, 'gsc');
for (const r of rows) for (const q of (((r.serp || {}).extras || {}).paa || [])) addQ(q, 'paa');
const questions = Object.values(qs).sort((a, b) => b.sources.length - a.sources.length || a.question.localeCompare(b.question)).slice(0, 30);
// ---- gaps against the chosen set (and their reconciliation with the provider's total) ----
const storedGaps = {}; for (const gr of all('Load KI Gaps').filter(r => r && r.gap_id && S(r.market) === p.market)) storedGaps[S(gr.gap_id)] = gr;
const gid = (type, k) => 'g_' + KIW.hash(p.site_id + '|' + p.market + '|' + type + '|' + k).slice(0, 14);
const kg = chosen.length ? KI.gaps({ domain: p.domain }, chosen, rows, { intersection: c.intersection }) : [];
const credits = (a) => ({ new_page: __KI_PAGE_CREDITS__, refresh: __KI_PAGE_CREDITS__, list: 0, pitch: 0, link: 0, defend: 0 })[a] || 0;
const gapRows = [];
for (const x of kg) { const id = gid(x.type, x.kw_key || KIW.keyOf(x.keyword)); const old = storedGaps[id] || {};
  gapRows.push({ gap_id: id, site_id: p.site_id, domain: p.domain, market: p.market, type: x.type, keyword: x.keyword, cluster_id: x.cluster_id || null, competitor_domains_json: x.competitor_domains || [],
    client_position: N(x.client_position), evidence_json: x.evidence || [], sample_note: (c.intersection && c.intersection.sample_note) || '', action: x.action, action_target: x.keyword, credits: credits(x.action),
    status: ['dismissed', 'started', 'done'].includes(S(old.status)) ? S(old.status) : 'open', run_id: p.run_id, created_at: S(old.created_at) || now, updated_at: now }); }
for (const r of rows.filter(r => r.striking)) { const id = gid('striking', r.kw_key); const old = storedGaps[id] || {};
  gapRows.push({ gap_id: id, site_id: p.site_id, domain: p.domain, market: p.market, type: 'striking', keyword: r.keyword, cluster_id: r.cluster_id, competitor_domains_json: r.competitors.map(x => x.domain),
    client_position: N(r.gsc_position), evidence_json: [{ impressions: N(r.gsc_impressions) || 0, position: N(r.gsc_position), page: S(r.gsc_page), source: 'search_console' }], sample_note: '', action: 'refresh', action_target: S(r.gsc_page) || r.keyword,
    credits: credits('refresh'), status: ['dismissed', 'started', 'done'].includes(S(old.status)) ? S(old.status) : 'open', run_id: p.run_id, created_at: S(old.created_at) || now, updated_at: now }); }
const gapsSummary = {}; for (const x of gapRows) gapsSummary[x.type] = (gapsSummary[x.type] || 0) + 1;
// ---- the plan (up to 10 actions; Start creates the existing pipeline item, W2) ----
const planIn = heads.filter(h => h._gate !== 'fail').slice(0, 20);
const plan = KI.plan(planIn, gapRows.map(x => ({ ...x, competitor_domains: KIW.J(x.competitor_domains_json, []) })), KI.CONFIG).slice(0, 10).map((a, i) => ({
  action_id: 'a_' + KIW.hash(p.site_id + '|' + p.market + '|' + S(a.kind) + '|' + S(a.target)).slice(0, 12), kind: S(a.kind) || 'new_page', title: S(a.title), why: S(a.why), target: S(a.target),
  credits: N(a.credits) != null ? N(a.credits) : credits(S(a.kind)), ...(a.gap_id ? { gap_id: a.gap_id } : {}), ...(a.cluster_id ? { cluster_id: a.cluster_id } : {}) }));
// ---- rows for seo_ki_keywords (the scored ones, then the gated ones with their reason) ----
const srcOf = (r) => (r.sources || []).map(x => ({ source: x.source, fetched_at: x.fetched_at, detail: x.detail || '' }));
const volBasis = (r) => r.volume == null ? null : 'provider_estimate';
const kwRow = (r) => KIW.shape('KI_KW', { site_id: p.site_id, domain: p.domain, market: p.market, keyword: r.keyword, kw_key: r.kw_key, sources_json: srcOf(r), source_count: (r.sources || []).length,
  volume: N(r.volume), volume_basis: volBasis(r), volume_source: r.volume == null ? ((r.sources || []).length >= 2 ? 'evidenced, volume not measured' : '') : (r.volume_source === 'google_ads' ? 'Google Ads (Keyword Planner ranges)' : 'DataForSEO Labs'),
  cpc: N(r.cpc), kd: N(r.kd), trend_json: r.trend || null, gsc_impressions: N(r.gsc_impressions), gsc_clicks: N(r.gsc_clicks), gsc_position: N(r.gsc_position), gsc_page: r.gsc_page || null,
  intent: ['commercial', 'transactional', 'informational', 'navigational'].includes(r.intent) ? r.intent : null, stage: r.stage || null, stage_evidence_json: r.stage_evidence || [], intent_confidence: N(r.intent_confidence),
  needs_review: !!r.needs_review, gate: r.gate, gate_reason: r.gate_reason || '', fit: N(r.fit), demand: N(r.demand), win: N(r.win), value: r.factors ? N(r.factors.value) : null, gap: N(r.gap),
  score: r.gate === 'fail' ? 0 : N(r.score), score_low: r.gate === 'fail' ? 0 : N(r.score_low), score_high: r.gate === 'fail' ? 0 : N(r.score_high), low_confidence: !!r.low_confidence, verdict: r.gate === 'fail' ? 'gated' : r.verdict,
  cluster_id: r.cluster_id || null, is_head: r.gate === 'fail' ? false : !!r.is_head, cluster_size: N(r.cluster_size), cluster_demand: N(r.cluster_demand), serp_read_at: r.serp ? (r.serp.at || now) : null,
  top10_json: (r.top10 || []).map(t => ({ url: t.url, host: t.host, type: t.type, pos: t.pos })), page_action: r.gate === 'fail' ? 'none' : (r.page_action || 'none'), page_url: r.page_url || null,
  cannibal_json: r.cannibal || null, competitors_json: (r.competitors || []).map(x => ({ domain: x.domain, position: x.position, url: x.url || '' })), striking: !!r.striking, run_id: p.run_id, fetched_at: now, updated_at: now });
const gatedRows = (c.gated || []).map(r => ({ ...r, gate: 'fail', verdict: 'gated', stage: null, top10: [], competitors: r.competitors || [], cluster_id: null }));
const kwRows = [...rows, ...gatedRows].map(kwRow);
const missing = sections.filter(s => s.state === 'missing');
const status = !rows.length && missing.length ? 'failed' : (missing.length || sections.some(s => s.state === 'partial') ? 'partial' : 'ok');
const reason = status === 'failed' ? 'no candidate search could be read (' + missing.map(s => s.key).join(', ') + ' could not be read); nothing was guessed, and this is not "no demand"' : '';
const summary = { candidates: N(c.merged) || 0, scored: rows.length, gated: gatedRows.length, dropped_below_top_n: N(c.dropped) || 0, clusters: heads.length, results_pages_read: N(sp.read) || 0,
  results_pages_missing: N(sp.missing) || 0, results_pages_bought: N(sp.live) || 0, striking: striking.length, questions: questions.length, gaps: gapRows.length, plan: plan.length,
  go: rows.filter(r => r.verdict === 'go').length, months: rows.filter(r => r.verdict === 'months').length, hard: rows.filter(r => r.verdict === 'hard').length, needs_review: rows.filter(r => r.needs_review).length };
const clustersOut = heads.slice(0, 50).map(h => ({ cluster_id: h.cluster_id, head: h.head, members: h.members, demand: h.demand, stage: h.stage, verdict: h.verdict, score: h.score, score_low: h.score_low, score_high: h.score_high, page_action: h.page_action, page_url: h.page_url }));
return [{ json: { kind: 'keyword_research', status, reason, sections, summary, notes: p.notes || [], kw_rows: kwRows, gap_rows: gapRows.map(x => KIW.shape('KI_GAPS', x)), cache_rows: saveRows, serp_cache_rows: sp.serp_cache_rows || [],
  lists: { clusters: clustersOut, striking, questions, gaps_summary: gapsSummary, plan } } }];
