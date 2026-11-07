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
// ---- every row, scored with the kit (KI.stage / KI.demand / KI.win / KI.value / KI.gap / KI.score / KI.verdict) ----
const vm = sp.vol_map || rp.vol_map || {};
const by = sp.by || {};
const siteQ = (p.gsc || []).map(q => ({ query: q.query, impressions: q.impressions, position: q.position, page: q.page }));
const siteCtx = { domain: p.domain, queries: siteQ, total_impressions: N(p.site_impressions), model, pages };
const cfg = KI.cfg({ now });
const rows = (rp.rows || []).map(r0 => {
  const v = vm[r0.kw_key] || {};
  const r = { ...r0 }; if (r.volume == null && v.ads_v != null) { r.volume = v.ads_v; r.volume_source = 'Google Ads (Keyword Planner ranges)'; r.volume_basis = 'provider_estimate'; if (r.cpc == null) r.cpc = v.ads_cpc; }
  const sr = by[r.keyword] || null; const top10 = sr ? (sr.top10 || []) : [];
  const intentP = N(r.intent_p);
  const st = KI.stage(top10, r.keyword, r.intent_label ? { label: r.intent_label, probability: intentP } : r.labs_intent, { own_domain: client, cfg });
  const row = { ...r, top10, serp: sr, stage: st.stage, intent: st.intent || null, intent_confidence: N(st.confidence), needs_review: !!st.needs_review || !sr, stage_evidence: st.evidence ? [st.evidence] : [],
    aio: sr ? !!(sr.extras || {}).aio : r.aio };
  // the chosen set's positions for the gap (the results page read; else the provider's stored positions, an estimate)
  const labsTop = (r.competitors || []).filter(x => chosen.includes(KIW.host(x.domain)) && N(x.position)).map(x => ({ url: KIW.S(x.url), host: KIW.host(x.domain), pos: N(x.position), exact: false }));
  row.gap_top10 = top10.length ? top10 : labsTop;
  const dm = KI.demand([row], cfg), wn = KI.win(row, siteCtx, cfg), vl = KI.value(row, siteCtx, cfg), gp = KI.gap({ top10: row.gap_top10 }, chosen, cfg);
  const fitO = { fit: N(r.fit), low: N(r.fit_low), high: N(r.fit_high) };
  const sc = KI.score({ gate: r.gate, gate_reason: r.gate_reason, fit: fitO, stage: row.stage, demand: dm, win: wn, value: vl, gap: gp.gap }, cfg);
  row.demand = dm.demand; row.demand_note = dm.note; row.click_demand = dm.clicks; row.win = wn.win; row.value_f = vl.value; row.gap = gp.gap;
  row.score = sc.score; row.score_low = sc.low; row.score_high = sc.high; row.score_mid = sc.mid; row.low_confidence = !!sc.low_confidence || !sr; row.factors = sc.factors;
  row.client_position = wn.position; row.competitors_out = gp.competitors;
  row.verdict = KI.verdict({ gate: r.gate, fit: fitO, win: wn }, cfg);
  row.striking = r.gate === 'pass' && KI.striking(row, siteCtx, cfg);
  return row; });
// ---- clusters (head-based, KI.cluster: 3 shared of the top 10, no chaining; rows with too few known results stand alone) ----
const clustered = KI.cluster(rows, cfg);
const byKey = {}; for (const r of clustered) byKey[r.kw_key] = r;
for (const r of rows) { const x = byKey[r.kw_key] || {}; r.cluster_id = x.cluster_id || ('c_' + KI.hash(r.kw_key)); r.is_head = x.is_head !== false; r.cluster_size = N(x.cluster_size) || 1; r.cluster_demand = N(x.cluster_demand); r.hub_id = x.hub_id || ''; }
const clusters = {};
for (const r of rows) (clusters[r.cluster_id] = clusters[r.cluster_id] || []).push(r);
const heads = [];
for (const [id, mem] of Object.entries(clusters)) {
  const head = mem.find(r => r.is_head) || mem[0];
  const pa = KI.pageAction({ keyword: head.keyword, members: mem, top10: head.top10, gate: head.gate, verdict: head.verdict }, siteCtx, cfg);
  const cannibal = (pa.cannibal || []).length ? { pages: pa.cannibal, why: pa.cannibal.length + ' of your pages get impressions for the searches of this cluster: one should be the page, the others link to it' } : null;
  for (const r of mem) { r.page_action = pa.action; r.page_url = pa.page_url || ''; r.cannibal = cannibal; r.list_hosts = pa.list_hosts || []; }
  heads.push({ ...head, cluster_id: id, head: head.keyword, members: mem.length, page_action: pa.action, page_url: pa.page_url || null, list_hosts: pa.list_hosts || [], _gate: head.gate, _why: pa.reason });
}
heads.sort((a, b) => (N(b.score_mid) || 0) - (N(a.score_mid) || 0) || (N(b.cluster_demand) || 0) - (N(a.cluster_demand) || 0) || a.head.localeCompare(b.head));
// ---- striking distance (one definition, KI.striking) ----
const striking = rows.filter(r => r.striking).sort((a, b) => (N(b.gsc_impressions) || 0) - (N(a.gsc_impressions) || 0) || a.kw_key.localeCompare(b.kw_key)).slice(0, 30)
  .map(r => ({ keyword: r.keyword, position: N(r.gsc_position), impressions: N(r.gsc_impressions) || 0, page: S(r.gsc_page), change: 'position ' + Math.round(N(r.gsc_position)) + ' with ' + (N(r.gsc_impressions) || 0) + ' impressions in 28 days: improve this page for the search (title, a section that answers it, internal links)' }));
// ---- buyer questions (deduplicated by meaning: KI.key; through the KI gate) ----
const QW = /^(what|how|why|which|who|when|where|is|are|can|does|do|should|will)\b/;
const qs = {}; const addQ = (q, src) => { const t = KIW.normKw(q).replace(/\?$/, ''); if (!QW.test(t) || t.split(' ').length < 3) return; if (KI.gate(t, { ...(p.fit_ctx || {}) }).gate !== 'pass') return; const k = KI.key(t);
  const x = qs[k] || (qs[k] = { question: t + '?', cluster_id: (rows.find(r => r.kw_key === k) || {}).cluster_id || null, sources: [] }); if (!x.sources.includes(src)) x.sources.push(src); };
for (const q of ((c.questions_src || {}).paa || [])) addQ(q, 'paa');
for (const q of ((c.questions_src || {}).autocomplete || [])) addQ(q, 'autocomplete');
for (const q of (p.gsc || [])) addQ(q.query, 'gsc');
for (const r of rows) for (const q of (((r.serp || {}).extras || {}).paa || [])) addQ(q, 'paa');
const questions = Object.values(qs).sort((a, b) => b.sources.length - a.sources.length || a.question.localeCompare(b.question)).slice(0, 30);
// ---- gaps against the chosen set (KI.gaps: stored rows; the intersection's total gives "sample of N of M"); the client's status on a gap is kept ----
const storedGaps = {}; for (const gr of all('Load KI Gaps').filter(r => r && r.gap_id && S(r.market) === p.market)) storedGaps[S(gr.gap_id)] = gr;
const inter = c.intersection || null;
const kg = KI.gaps({ site_id: p.site_id, domain: p.domain, market: p.market, run_id: p.run_id, now, total_impressions: N(p.site_impressions) }, chosen,
  rows.map(r => ({ ...r, top10: r.gap_top10 })), { sample: inter && N(inter.read) != null && N(inter.total) != null ? { n: N(inter.read), m: N(inter.total) } : null }, cfg);
const gapRows = kg.map(x => { const old = storedGaps[x.gap_id] || {};
  return { ...x, sample_note: x.sample_note ? x.sample_note + ' searches the data provider holds for these competitors' : '', status: ['dismissed', 'started', 'done'].includes(S(old.status)) ? S(old.status) : x.status, created_at: S(old.created_at) || x.created_at }; });
const gapsSummary = {}; for (const x of gapRows) gapsSummary[x.type] = (gapsSummary[x.type] || 0) + 1;
// ---- the plan (KI.plan: up to 10 ranked actions; Start creates the existing pipeline item, W2) ----
const plan = KI.plan(heads.filter(h => h._gate !== 'fail').slice(0, 30).map(h => ({ ...h, keyword: h.head, score: { score: h.score, low: h.score_low, high: h.score_high, mid: h.score_mid } })), gapRows, cfg)
  .map(a => { const o = { action_id: a.action_id, kind: a.kind, title: a.title, why: a.why, target: a.target, credits: N(a.credits) || 0 }; if (a.gap_id) o.gap_id = a.gap_id; if (a.cluster_id) o.cluster_id = a.cluster_id; return o; });
// ---- rows for seo_ki_keywords (the scored ones, then the gated ones with their reason) ----
const srcOf = (r) => (r.sources || []).map(x => ({ source: x.source, fetched_at: x.fetched_at, detail: x.detail || '' }));
const volBasis = (r) => r.volume == null ? null : 'provider_estimate';
const kwRow = (r) => KIW.shape('KI_KW', { site_id: p.site_id, domain: p.domain, market: p.market, keyword: r.keyword, kw_key: r.kw_key, sources_json: srcOf(r), source_count: (r.sources || []).length,
  volume: N(r.volume), volume_basis: volBasis(r), volume_source: r.volume == null ? ((r.families || []).length >= 2 ? 'evidenced, volume not measured' : '') : (KIW.S(r.volume_source) || 'DataForSEO Labs'),
  cpc: N(r.cpc), kd: N(r.kd), trend_json: r.trend || null, gsc_impressions: N(r.gsc_impressions), gsc_clicks: N(r.gsc_clicks), gsc_position: N(r.gsc_position), gsc_page: r.gsc_page || null,
  intent: ['commercial', 'transactional', 'informational', 'navigational'].includes(r.intent) ? r.intent : null, stage: r.stage || null, stage_evidence_json: r.stage_evidence || [], intent_confidence: N(r.intent_confidence),
  needs_review: !!r.needs_review, gate: r.gate, gate_reason: r.gate_reason || '', fit: N(r.fit), demand: N(r.demand), win: N(r.win), value: N(r.value_f), gap: N(r.gap),
  score: r.gate === 'fail' ? 0 : N(r.score), score_low: r.gate === 'fail' ? 0 : N(r.score_low), score_high: r.gate === 'fail' ? 0 : N(r.score_high), low_confidence: !!r.low_confidence, verdict: r.gate === 'fail' ? 'gated' : r.verdict,
  cluster_id: r.cluster_id || null, is_head: r.gate === 'fail' ? false : !!r.is_head, cluster_size: N(r.cluster_size), cluster_demand: N(r.cluster_demand), serp_read_at: r.serp ? (r.serp.at || now) : null,
  top10_json: (r.top10 || []).map(t => ({ url: t.url, host: t.host, type: t.type, pos: t.pos })), page_action: r.gate === 'fail' ? 'none' : (r.page_action || 'none'), page_url: r.page_url || null,
  cannibal_json: r.cannibal || null, competitors_json: (r.competitors || []).filter(x => chosen.includes(KIW.host(x.domain)) || !chosen.length).slice(0, 10).map(x => ({ domain: KIW.host(x.domain), position: N(x.position), url: x.url || '' })), striking: !!r.striking, run_id: p.run_id, fetched_at: now, updated_at: now });
const gatedRows = (c.gated || []).map(r => ({ ...r, gate: 'fail', verdict: 'gated', stage: null, top10: [], competitors: r.competitors || [], cluster_id: null, score: 0, score_low: 0, score_high: 0 }));
const kwRows = [...rows, ...gatedRows].map(kwRow);
const missing = sections.filter(s => s.state === 'missing');
const status = !rows.length && missing.length ? 'failed' : (missing.length || sections.some(s => s.state === 'partial') ? 'partial' : 'ok');
const reason = status === 'failed' ? 'no candidate search could be read (' + missing.map(s => s.key).join(', ') + ' could not be read); nothing was guessed, and this is not "no demand"' : '';
const summary = { candidates: N(c.merged) || 0, scored: rows.length, gated: gatedRows.length, dropped_below_top_n: N(c.dropped) || 0, clusters: heads.length, results_pages_read: N(sp.read) || 0,
  results_pages_missing: N(sp.missing) || 0, results_pages_bought: N(sp.live) || 0, striking: striking.length, questions: questions.length, gaps: gapRows.length, plan: plan.length,
  go: rows.filter(r => r.verdict === 'go').length, months: rows.filter(r => r.verdict === 'months').length, hard: rows.filter(r => r.verdict === 'hard').length, needs_review: rows.filter(r => r.needs_review).length };
const clustersOut = heads.slice(0, 50).map(h => ({ cluster_id: h.cluster_id, head: h.head, members: h.members, demand: N(h.cluster_demand), stage: h.stage || null, verdict: h.verdict, score: N(h.score), score_low: N(h.score_low), score_high: N(h.score_high), page_action: h.page_action, page_url: h.page_url }));
return [{ json: { kind: 'keyword_research', status, reason, sections, summary, notes: p.notes || [], kw_rows: kwRows, gap_rows: gapRows.map(x => KIW.shape('KI_GAPS', x)), cache_rows: saveRows, serp_cache_rows: sp.serp_cache_rows || [],
  lists: { clusters: clustersOut, striking, questions, gaps_summary: gapsSummary, plan } } }];
