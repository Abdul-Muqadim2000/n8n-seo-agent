// AIR plan (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2, CONTRACTS.md §4, package P4): the AI-ranking algorithm for each website the gate
// let through (shadow or on, not killed). It reads stored data and this run's own outputs only, calls the two kits (ARD diagnosis, ARL decision;
// packages P1 / P2) through their frozen signatures, and hands one item per site to the row builders. It WRITES NOTHING itself.
//   out: { site_id, domain, mode, run_id, air: { market, panel: { core, proposed, extend, comparable, why, arms, mde }, diag, sources, candidates,
//          chosen, deferred, refused, outcomes, priors, memo, compare, cost, ...rows for the builders }, error: '' }
// Rules (CONTRACTS.md §3-§5):
//   * a kit result marked `unavailable` (a W0 skeleton) is never written: its rows are left out and the run row says `kit not built: <which>`;
//   * the old logic's choice this run (Growth Plan targets, Earned Media pages, Growth Metrics actions) is recorded beside AIR's (DESIGN 2.E);
//   * stored ladder rungs are read through the fit gate (FITR.rungs, INVARIANTS rule 2), stored prospects and outreach rows through the
//     competitor gate (OK.sellsSame), and a placement on a rival's own page is never chosen (owner: rival lists are learn-only);
//   * the sink rows (targets, prospects, proposed questions, core windows, protect cache, growth actions) are built ONLY for a site in `on`
//     (AIRF.writesSinks); in shadow the plan says what it would do and the builders write the five seo_ai_rank_* tables only;
//   * nothing paid: the only outside reading is `AI Rank Fetched` (package P5, wave 2), which spends only for an `on` site (AIRF.mayPay).
/*__MONITOR_SITES__*/
/*__SITE_MODEL__*/
/*__FIT_GATE__*/
/*__AI_MEASURE__*/
/*__AI_PANEL__*/
/*__SERP_CACHE__*/
/*__LINK_KIT__*/
/*__OUTREACH_KIT__*/
/*__AI_RANK_DIAG__*/
/*__AI_RANK_LEARN__*/
const AIR_CFG = { H: 25, window_min_days: 28, expire_grace_days: 14, sources_max: 200, actions_max: 300, growth_add_max: 3, protect_days: 28,
  // capacities: ARL's own defaults (own_pages 1 a week, pitches 5, human_new 3, human_open_max 8) in shadow AND on, so the shadow plan is what on would do
  open: ['proposed', 'queued', 'in_progress', 'done'], json_max: 60000 };
const nowMs = Date.now(); const nowIso = new Date(nowMs).toISOString();
const DAY = 864e5;
const J = (x) => { try { return JSON.stringify(x == null ? null : x); } catch (e) { return ''; } };
const P = (s, d) => { if (s && typeof s === 'object') return s; try { const v = JSON.parse(String(s || '')); return v == null ? d : v; } catch (e) { return d; } };
const S0 = (v) => (v == null ? '' : String(v)).trim();
const tryAll = (name) => { try { return $(name).all().map(i => i.json || {}); } catch (e) { return []; } };
const bySite = (rows, sid, dom) => rows.filter(r => r && (r.site_id === sid || (!r.site_id && normD(r.domain) === dom)));
const latest = (rows, col) => rows.slice().sort((a, b) => String(b[col] || '').localeCompare(String(a[col] || '')))[0] || null;
const hostOf = (u) => { const m = S0(u).match(/^https?:\/\/([^\/?#]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '') : ''; };

// ---- this run ----
const gateSites = tryAll('AI Rank Live').filter(x => x.site_id && !x.skip && !x.error);
const monitor = monitorSites('ai');
const plansG = tryAll('Growth Plan').filter(p => p.site_id && !p.nothing_to_do);
const earnedG = tryAll('Earned Media').filter(e => e.site_id);
const metricsG = tryAll('Growth Metrics').filter(m => m.site_id && !m.skip);
const robotsG = tryAll('Robots Verdicts (Growth)').filter(r => r.site_id);
const fetchedG = tryAll('AI Rank Fetched').filter(f => f.site_id);   // wave 2 (P5): absent until then, so nothing outside is read
// ---- stored data (the AI Growth loads, plus AIR's own) ----
const promptsAll = rowsOf('Load AI Prompts'), answersAll = rowsOf('Load AI Answers'), visAll = rowsOf('Load AI Visibility'), aiPagesAll = rowsOf('Load AI Pages');
const targetsAll = rowsOf('Load AI Targets'), monRows = rowsOf('Load Monitors'), laddersAll = rowsOf('Load Ladders'), logAll = rowsOf('Load Content Log');
const rqAll = rowsOf('Load AI Rank Questions'), raAll = rowsOf('Load AI Rank Actions'), rsAll = rowsOf('Load AI Rank Sources'), rpAll = rowsOf('Load AI Rank Priors'), rrAll = rowsOf('Load AI Rank Runs');
const indexAll = rowsOf('Load Index Pages (Rank)'), serpRows = rowsOf('Load SERP Cache (Rank)'), dailyAll = rowsOf('Load AI Daily (Rank)');
const answers28All = rowsOf('Load AI Answers (Rank)'), queryAll = rowsOf('Load Query History');   // P1: the source graph reads 28 days of answers; Search Console queries feed demand
const listingsAll = rowsOf('Load Listings (Rank)'), outreachAll = rowsOf('Load Link Outreach (Rank)'), prospectsAll = rowsOf('Load Link Prospects (Rank)');

// Google results pages the engines' searches return (seo_cache serp:*, any date, each labelled with its reading date). FX-A RA-13: one reading per
// keyword AND location (`by_loc`; the latest of each), so ARD reads only a results page of the question's market; the entry's own fields are the
// latest reading of any location (read when the market is not known)
const serp = new Map();
const putSerp = (m, k, e) => { const prev = m.get(k); const by = Object.assign({}, prev ? prev.by_loc : {}); const lk = String(Number(e.location_code) || 0);
  if (!by[lk] || String(by[lk].read_at) <= String(e.read_at)) by[lk] = e; const latest = !prev || String(prev.read_at) <= String(e.read_at) ? e : prev; m.set(k, Object.assign({}, latest, { by_loc: by })); };
for (const r of serpRows) { const v = P(r.value, null); if (!v || typeof v !== 'object' || !v.keyword || SU.poisoned(v)) continue;   // SERP-GOTO (2026-11-08): a reading stored with Google redirect links and no site behind them is not a reading
  putSerp(serp, SC.normKw(v.keyword), { results: (v.items || []).filter(x => x && x.type === 'organic' && x.url).map(x => ({ url: x.url, pos: Number(x.rank_group || x.rank_absolute) || null })), read_at: String(v.at || v.day || ''), location_code: Number(v.location_code) || 0 }); }

// the robots verdict of this run, in the shape ARD reads: { robots: { bot: { allowed_root, rule } }, blocked_engines, read_at }
const BOT_ENGINES = { 'OAI-SearchBot': ['chatgpt', 'chatgpt_api'], 'ChatGPT-User': ['chatgpt', 'chatgpt_api'], 'PerplexityBot': ['perplexity'], 'Perplexity-User': ['perplexity'],
  'Claude-SearchBot': ['claude'], 'Claude-User': ['claude'], 'Bingbot': ['copilot'], 'Googlebot': ['ai_overview', 'ai_mode', 'gemini'], 'Google-Extended': [] };
const accessOf = (rv) => { if (!rv) return { robots: {}, blocked_engines: [], read_at: '', basis: 'robots.txt was not read this run' };
  const robots = {}; for (const b of (rv.bots || [])) robots[b.bot] = { allowed_root: rv.found ? b.allowed_root : null, rule: b.root_rule || '' };
  const byEngine = {}; for (const [bot, engines] of Object.entries(BOT_ENGINES)) { if (!robots[bot]) continue; for (const e of engines) (byEngine[e] = byEngine[e] || []).push(robots[bot].allowed_root); }
  const blocked_engines = Object.keys(byEngine).filter(e => byEngine[e].length && byEngine[e].every(x => x === false)).sort();
  return { robots, blocked_engines, read_at: S0(rv.checked_at), basis: rv.found ? 'measured' : rv.unavailable ? 'not available' : 'measured (no robots.txt)' }; };

// Bing's list of the sites this account manages (Fetch Bing Sites (Growth)), read once. `null` when it was not read (Bing off, the call failed,
// an empty answer): then nobody knows whether a site is in Bing, and `in_account` must be null, never false (a false "not in Bing" gave
// techand.ai, which is in Bing, a Copilot S0 and a Bing step). Growth Metrics' own in_account is left as it is: it feeds the report.
const bingList = (() => { try { const r = $('Fetch Bing Sites (Growth)').first(); const j0 = r && r.json; if (!j0 || typeof j0 !== 'object' || j0.error) return null;
  let j = j0; if (j0.d === undefined) { const b = j0.body ?? j0.data; if (b && typeof b === 'object') j = b; else { try { j = JSON.parse(b || '{}'); } catch (e) { j = {}; } } }
  return Array.isArray(j.d) ? j.d.filter(x => x && x.Url) : null; } catch (e) { return null; } })();
// D24 (P5): this run's fan-out results pages (AI Rank Fetched `serp_reads`, Google only; Bing's reach the kits through bing_stats.positions) are
// merged into the site's own copy of the Google map, a later reading of the same search winning, so the S1 / S2 proxy basis can be read
const serpFor = (f) => { const reads = f && Array.isArray(f.serp_reads) ? f.serp_reads.filter(r => r && (!r.engine || r.engine === 'google')) : []; if (!reads.length) return serp;
  const m = new Map(serp); for (const r of reads) { const k = SC.normKw(r.query || r.key); if (!k) continue;
    putSerp(m, k, { results: (r.results || []).filter(x => x && x.url).map(x => ({ url: x.url, pos: Number(x.pos) || null })), read_at: String(r.read_at || ''), location_code: Number(r.location_code) || 0 }); }
  return m; };
const rawHost = (u) => { const m = S0(u).match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
// RA-4 (FX-A): the exposure ledger - which questions each EXECUTED action (mode on; shadow rows execute nothing) works on, from its registration to
// the end of its window (open-ended while it is open). The levers that touch every question alike (ARL.UNIFORM) are not exposure.
const exposureOf = (rows) => rows.filter(a => a && S0(a.mode) === 'on' && !['shadow', 'refused', ''].includes(S0(a.status)) && !ARL.UNIFORM.includes(S0(a.lever))).map(a => {
  const pre = P(a.prereg_json, {}) || {}; const vf = P(a.verify_json, {}) || {}; const win = Math.max(AIR_CFG.window_min_days, Number(pre.window_days) || 0);
  const t0 = Date.parse(S0(pre.t0_rule === 'live_at' ? vf.live_at : '') || S0(a.happened_at) || S0(vf.at)); const open = AIR_CFG.open.includes(S0(a.status)) && S0(a.status) !== 'done';
  const to = open ? '' : Number.isFinite(t0) ? new Date(t0 + win * DAY).toISOString() : S0(a.updated_at);
  return { action_id: S0(a.action_id), lever: S0(a.lever), questions: P(a.questions, []).map(S0), from: S0(pre.registered_at) || S0(a.created_at), to, window_days: win, controls: (pre.controls || []).map(S0), open: AIR_CFG.open.includes(S0(a.status)) }; });
const out = []; const siteLearn = [];
for (const g of gateSites) {
  const sid = g.site_id;
  try {
    const rank = g.rank || AIRF.settingsOf({}); const mode = rank.mode; const on = AIRF.writesSinks(rank, false);
    const unavailable = new Set(); const un = (name, r) => { if (r && r.unavailable) unavailable.add(name); return r; };
    const s = monitor.list.find(x => x.site_id === sid) || { site_id: sid, domain: g.domain, settings: { rank, engines: [] }, profile: {}, keywords: [] };
    const dom = normD(s.domain || g.domain);
    const gp = plansG.find(p => p.site_id === sid) || {}; const em = earnedG.find(e => e.site_id === sid) || {}; const gm = metricsG.find(m => m.site_id === sid) || {};
    const fetched = fetchedG.find(f => f.site_id === sid) || null;
    const serpS = serpFor(fetched);
    const ourHosts = [...new Set([dom, 'www.' + dom, S0(gp.site_host).toLowerCase()].filter(Boolean))];
    const competitors = (gp.competitors || s.settings.competitors || []).map(normD).filter(Boolean);
    const rivals = [...new Set([...competitors, ...(gp.rival_sources || []).map(normD)].filter(d => d && d !== dom))];
    const engines = (s.settings.engines || []).filter(e => AIRF.usable(e));
    const site = { site_id: sid, domain: dom, site_host: S0(gp.site_host) || dom, country: s.country || '', location_code: Number(s.location_code) || 0, language_code: s.language_code || 'en',
      keywords: s.keywords || [], business_name: s.business_name || gp.business_name || '', services: gp.services || [], competitors, profile: s.profile || {} };
    // ---- read paths through their gates (INVARIANTS rule 2) ----
    const lrows = laddersAll.filter(l => normD(l.domain) === dom);
    const fitCtx = FITR.ctx({ own_domain: dom, competitors, heads: lrows.map(l => l.head_keyword), services: site.services });
    const fitG = FITR.rungs(lrows, fitCtx, { where: 'AI ranking (market and questions)' });
    const ladders = fitG.keep;
    const rivalWhy = (d, extra) => OK.sellsSame({ type: 'ai_source', domain: d, competitors, ai_rivals: gp.rival_sources || [], topics: gp.topics || [], ...(extra || {}) });
    const prospects = bySite(prospectsAll, sid, dom).filter(r => !rivalWhy(r.prospect_domain));
    const outreach = bySite(outreachAll, sid, dom).filter(r => !rivalWhy(r.prospect_domain));
    const listings = bySite(listingsAll, sid, dom);
    // ---- the site's AI data ----
    const prompts = bySite(promptsAll, sid, dom);
    const promptById = new Map(prompts.map(p => [S0(p.prompt_id), p]));
    // ONE array each, passed whole to every ARD call (P1 indexes them by question once per list): 28 days for the source graph, 8 days for the stages
    const answers28 = (() => { const a = bySite(answers28All, sid, dom); return (a.length ? a : bySite(answersAll, sid, dom)).filter(x => AIRF.usable(x.engine)); })();
    const answers8 = answers28.filter(a => { const t = Date.parse(a.checked_at); return !Number.isFinite(t) || t >= nowMs - 8 * DAY; });
    const visRows = bySite(visAll, sid, dom);
    const visLast = latest(visRows, 'checked_at') || {};
    const rule = ((AVX.unpackUnits(visLast.units_json) || {}).rule_version) || S0(visLast.rule_version);
    const hist = AVX.history({ rule, from: new Date(nowMs - 60 * DAY).toISOString(), to: new Date(nowMs + 1).toISOString(), vis_rows: visRows, daily_rows: bySite(dailyAll, sid, dom) });
    const units60 = (hist.units || []).filter(u => AIRF.usable(u.engine));
    const demand = P(visLast.demand_json, {}) || {};   // the AI search demand per question (ARL.value)
    const queries = bySite(queryAll, sid, dom); const gsc = new Map(); for (const q of queries) { const k = S0(q.query).toLowerCase(); if (k) gsc.set(k, Math.max(gsc.get(k) || 0, Number(q.impressions) || 0)); }
    // LIVE1 (2026-11-07): the page Search Console shows for each query (the one with the most impressions): a concrete address for a refresh (ARL.candidates)
    const gscPages = new Map(); { const best = new Map(); for (const q of queries) { const k = S0(q.query).toLowerCase().replace(/\s+/g, ' '); const u = S0(q.page); const im = Number(q.impressions) || 0; if (!k || !u) continue; const b = best.get(k); if (!b || im > b) { best.set(k, im); gscPages.set(k, u); } } }
    const monRow = monRows.find(m => m.site_id === sid) || {};
    const aiPages = bySite(aiPagesAll, sid, dom);
    const storedQ = new Map(bySite(rqAll, sid, dom).map(r => [S0(r.prompt_id), r]));
    const storedA = bySite(raAll, sid, dom);   // (also read by the arms below: the exposure ledger)
    const storedSrc = bySite(rsAll, sid, dom);
    const runsPrev = bySite(rrAll, sid, dom).filter(r => r.run_id !== g.run_id);
    const prevRun = latest(runsPrev, 'checked_at');
    const access = accessOf(robotsG.find(r => r.site_id === sid));
    const bingIn = bingList === null ? null : bingList.some(x => { const h = rawHost(x.Url); return (h && h === S0(gp.site_host).toLowerCase()) || h.replace(/^www\./, '') === dom; });   // the list read: in it or not; not read: null
    const index = { google: new Map(bySite(indexAll, sid, dom).map(r => [AIRF.urlKey(r.url), S0(r.state || r.coverage)])),
      bing: { in_account: bingIn, crawled: new Map(aiPages.filter(p => S0(p.bing_crawled_at)).map(p => [AIRF.urlKey(p.url), S0(p.bing_crawled_at)])) },
      brave: fetched && fetched.brave ? new Map(Object.entries(fetched.brave)) : null, cc_captures: fetched && fetched.cc_captures != null ? Number(fetched.cc_captures) : null, gsc };
    const brandKnown = visLast.perception_json ? !!(P(visLast.perception_json, {}) || {}).known : null;
    // ---- A: market, core panel, arms, MDE ----
    const market = un('ARD.market', ARD.market({ site, ladders, tracked: site.keywords, monitors: monRow, profile: site.profile, gscCountries: [] }));
    // corePanel's demand (P1): { byPrompt: { prompt_id: { volume } }, candidates: [{ keyword, question?, source, volume, market }] } - candidates from the
    // gated ladder keywords and the site's own Search Console queries
    const mkt = market.unavailable || !market.cc ? '' : market.cc + '-' + (market.lang || 'en');
    const candidatesQ = [...ladders.map(l => ({ keyword: S0(l.keyword).toLowerCase(), source: 'ladder', volume: Number(l.volume) || 0, market: mkt })),
      ...[...gsc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => ({ keyword: k, source: 'gsc', volume: v, market: mkt }))].filter(c => c.keyword);
    const panelDemand = { byPrompt: Object.fromEntries(prompts.map(p => [S0(p.prompt_id), { volume: Number(p.volume) || 0 }])), candidates: candidatesQ };
    const panel0 = un('ARD.corePanel', ARD.corePanel({ site, prompts, units60, stored: [...storedQ.values()], market, demand: panelDemand, now: nowMs, cfg: {} }));
    // RA-2 (FX-A): a control is replaced only by a treated question no executed step worked on in the last two windows, and never rotates while it is a
    // registered control of an open action
    const exposure = exposureOf(storedA);
    const exposedQ = new Set(exposure.filter(x => !x.to || Date.parse(x.to) >= nowMs - 2 * x.window_days * DAY).flatMap(x => x.questions));
    const lockedQ = new Set(exposure.filter(x => x.open).flatMap(x => x.controls));
    const arms = ARD.assignArms({ core: panel0.core || [], stored: [...storedQ.values()], seed: sid, now: nowMs, site_id: sid, holdout_days: 84, exposed: exposedQ, locked: lockedQ }) || [];
    const armOf = new Map(arms.map(a => [S0(a.prompt_id), a]));
    const qT = arms.filter(a => a.arm === 'treated').length, qC = arms.filter(a => a.arm === 'control').length;
    // RA-11 (FX-A): m = answers per core question in the last 28 days (the period the formula assumes), p = the named share on the core (no brand
    // question); the memo prints the test actually run - one question (own page, passage fix, correction), a placement on 3 - beside the panel figure
    const coreSet = new Set((panel0.core || []).map(c => S0(c.prompt_id))); const u28 = units60.filter(u => coreSet.has(S0(u.prompt_id)) && Date.parse(u.at) > nowMs - 28 * DAY);
    const perQ = new Map(); for (const u of u28) perQ.set(u.prompt_id, (perQ.get(u.prompt_id) || 0) + 1);
    const mAns = perQ.size ? Math.round([...perQ.values()].reduce((a, b) => a + b, 0) / perQ.size) : 0;
    const pNamed = u28.length ? u28.filter(u => u.named).length / u28.length : 0;
    const mde0 = un('ARD.mde', ARD.mde({ q_t: qT, q_c: qC, m: mAns, p: pNamed, rho: 0.3 }));
    const mde = mde0.unavailable ? mde0 : Object.assign({}, mde0, { one_question: qC ? ARD.mde({ q_t: 1, q_c: qC, m: mAns, p: pNamed, rho: 0.3 }) : null, page_level: qC && qT ? ARD.mde({ q_t: Math.min(3, qT), q_c: qC, m: mAns, p: pNamed, rho: 0.3 }) : null, page_level_q: Math.min(3, qT) });
    // ---- B: the stage of each question x engine ----
    const coreIds = new Set((panel0.core || []).map(c => S0(c.prompt_id)));
    const LIVE_OUT = new Set(['off', 'refused', 'retired', 'proposed']);
    const asked = prompts.filter(p => coreIds.has(S0(p.prompt_id)) || (!LIVE_OUT.has(S0(p.status || 'active').toLowerCase()) && !S0(p.retired_at)));
    const evidenceOf = new Map();
    const diag = [];
    for (const p of asked) { const pid = S0(p.prompt_id);
      const ev = ARD.rollEvidence({ stored: S0((storedQ.get(pid) || {}).evidence_json), answers8, now: nowMs, prompt_id: pid, ourHosts }); evidenceOf.set(pid, typeof ev === 'string' ? ev.slice(0, 8192) : '');
      const d = un('ARD.diagnose', ARD.diagnose({ site, prompt: p, answers8, units60, evidence: evidenceOf.get(pid), access, pages: aiPages, index, serp: serpS,
        bingStats: fetched ? fetched.bing_stats || null : null, brave: index.brave, brandKnown, ourHosts, rivals, engines, now: nowMs, cfg: {} }));
      if (!d.unavailable) diag.push(d); }
    // ---- E: value and feasibility per question ----
    const values = {}, feas = {};
    for (const d of diag) { const p = promptById.get(S0(d.prompt_id)) || {};
      const v = un('ARL.value', ARL.value({ prompt: p, demand: demand[S0(d.prompt_id)] || demand[S0(p.keyword).toLowerCase()] || (gsc.get(S0(p.keyword).toLowerCase()) ? { gsc_impressions_28d: gsc.get(S0(p.keyword).toLowerCase()) } : null), intent: d.intent, stage: p.stage }));
      const a8 = answers8.filter(x => S0(x.prompt_id) === S0(d.prompt_id));
      const f = un('ARL.feasibility', ARL.feasibility({ prompt: p, market, diag: typeof ARL.rivalsMedian === 'function' ? { ...d, rivals_median: ARL.rivalsMedian(a8) } : d, reach: null }));
      if (!v.unavailable) values[S0(d.prompt_id)] = v; if (!f.unavailable) feas[S0(d.prompt_id)] = f; }
    // ---- C: the source graph ----
    const sources = (ARD.sources({ answers8: answers28, storedSources: storedSrc, mentionsPages: fetched ? fetched.mentions_pages || [] : [], fetched: em.earned || [], prompts,
      values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.V])), rivals, ourHosts, now: nowMs }) || [])
      .slice().sort((a, b) => (Number(b.influence) || 0) - (Number(a.influence) || 0)).slice(0, AIR_CFG.sources_max);
    // FX-A2: the pages the client gave us (the app's source rows, source_from 'client', written only when its own fetch found the business named)
    // are kept as written whatever their influence: they are what L11-L15 / L17 verify against; a weekly run never re-reads or rewrites them
    { const own = storedSrc.filter(r => S0(r.source_from) === 'client' && S0(r.url_key || AIRF.urlKey(r.url)));
      for (const r of own) { const k = S0(r.url_key) || AIRF.urlKey(r.url); const i = sources.findIndex(x => (S0(x.url_key) || AIRF.urlKey(x.url)) === k); const base = i >= 0 ? sources[i] : { url_key: k, url: S0(r.url), host: S0(r.host), page_type: S0(r.page_type), author_kind: S0(r.author_kind), questions: P(r.questions, []), engines: P(r.engines, []), influence: 0, placeability: 0, cites_28d: 0 };
        const x = Object.assign({}, base, { names_client: r.names_client === true || S0(r.names_client) === 'true', from: 'client', checked_at: S0(r.checked_at), last_seen: S0(r.last_seen) || S0(r.checked_at), first_seen: S0(r.first_seen), client: true });
        if (i >= 0) sources[i] = x; else sources.push(x); } }
    const srcByKey = new Map(sources.map(x => [S0(x.url_key) || AIRF.urlKey(x.url), x]));
    // ---- D / E: candidates, scores, the choice ----
    const candidates = ARL.candidates({ site: { ...site, hosts: ourHosts, prompts, pages: aiPages, gsc_pages: gscPages }, diag, sources, arms, stored_actions: storedA, settings: rank, now: nowMs }) || [];
    // LIVE1 (2026-11-07): every placement (a pitch: sink prospect) passes the Link Builder's own vetting BEFORE the choice (OK.placementVet: its
    // stored verdicts, an earlier pitch to the same site, and its rules that need no page), so a refused or already-pitched list is never chosen
    // and the pitch slots go to the next candidates. A reachable contact is preferred; a contact form only is allowed and marked a manual step.
    const outreachSite = bySite(outreachAll, sid, dom), prospectsSite = bySite(prospectsAll, sid, dom);
    // LIVE1: an own page passes the Content Cadence's own freshness rules before the choice, so the one AI ranking page of the week is one the
    // reserved slot can write (live, both sites' refresh targets were pages the agent had published 7-9 days before: the cadence refused both).
    // A refresh waits 60 days after the page was refreshed or published (Cadence_Plan refreshedRecently, F-38); a new page waits 90 days after a
    // page for the same keyword was started or published (Cadence_Plan recent). The question's other own pages and the other questions stay open.
    const keyOfU = (u) => S0(u).toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    const normKw = (k) => S0(k).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
    const logSite = bySite(logAll, sid, dom); const freshAt = new Map(), kwAt = new Map();
    for (const l of logSite) { const st0 = Date.parse(S0(l.started_at)), pb = Date.parse(S0(l.published_at));
      if (S0(l.existing_page_url) && Number.isFinite(st0) && nowMs - st0 < 60 * DAY) freshAt.set(keyOfU(l.existing_page_url), S0(l.started_at).slice(0, 10));
      if (S0(l.published_url) && Number.isFinite(pb) && nowMs - pb < 60 * DAY) freshAt.set(keyOfU(l.published_url), S0(l.published_at).slice(0, 10));
      if (S0(l.keyword) && (S0(l.status) === 'published' || (Number.isFinite(st0) && nowMs - st0 < 90 * DAY))) kwAt.set(normKw(l.keyword), S0(l.published_at || l.started_at).slice(0, 10)); }
    const ownWhy = (c) => { if (c.lever === 'L06') { const at = freshAt.get(keyOfU(S0((c.ref || {}).url) || c.page_url)); return at ? 'its page was refreshed or published on ' + at + ': the Content Cadence refreshes a page again only after 60 days' : ''; }
      const kw = normKw(c.keyword || (promptById.get(S0((c.ref || {}).prompt_id)) || {}).keyword); const at = kw ? kwAt.get(kw) : ''; return at ? 'a page for "' + kw + '" was written on ' + at + ': the Content Cadence writes a search again only after 90 days' : ''; };
    const vetted = candidates.map(c => { if (c.sink === 'ai_target' && !c.refused && ['L05', 'L06'].includes(c.lever)) { const w = ownWhy(c); return w ? { ...c, refused: 'not written this week: ' + w } : c; }
      if (c.sink !== 'prospect' || c.refused) return c; const url = S0((c.ref || {}).url); const src = url ? srcByKey.get(AIRF.urlKey(url)) || {} : {};
      const v = OK.placementVet({ url, domain: hostOf(url), title: S0(src.title), outreach: outreachSite, prospects: prospectsSite, competitors, ai_rivals: gp.rival_sources || [], topics: gp.topics || [], terms: site.services, contact_email: S0(src.contact_email), contact_url: S0(src.contact_url) });
      if (v.refused) return { ...c, refused: 'not pitched (the Link Builder\'s vetting): ' + v.refused };
      if (v.contact === 'email') return { ...c, contact: 'email', contact_email: v.email };
      if (v.contact === 'form') return { ...c, contact: 'form', contact_url: v.form, manual: true, factor: Math.round(1e4 * (Number(c.factor) || 1) * 0.7) / 1e4, why: S0(c.why) + '; a contact form only: a manual step (send it yourself through ' + v.form + ')' };
      return { ...c, contact: '', factor: Math.round(1e4 * (Number(c.factor) || 1) * 0.85) / 1e4 }; });
    const scored = vetted.map(c => { const sc = un('ARL.score', ARL.score(c, { priors: rpAll, values, feas, weights: null, H: AIR_CFG.H })); return sc.unavailable ? null : { ...c, ...sc }; }).filter(Boolean);
    const openStored = storedA.filter(a => AIR_CFG.open.includes(S0(a.status)));
    const choice = ARL.choose(scored, { capacities: {}, arms, mode, open_actions: storedA.filter(a => ['shadow', ...AIR_CFG.open].includes(S0(a.status))), now: nowMs, units60, exposure }) || { chosen: [], deferred: [], refused: [] };
    // the gate on the way out: a placement pitch to a competitor's own page is refused here, whatever the kit chose (rival lists: learn only)
    const refused = (choice.refused || []).slice(); const chosen = [];
    // LIVE1: ARL.choose returns its own action shape; the vetting's contact facts are carried back by action id (the sink reads them)
    const vetById = new Map(vetted.filter(c => c.sink === 'prospect').map(c => [S0(c.action_id), c]));
    for (const a0 of (choice.chosen || [])) { const vc = vetById.get(S0(a0.action_id)); const a = vc ? { ...a0, contact: vc.contact || '', contact_email: S0(vc.contact_email), contact_url: S0(vc.contact_url), manual: vc.manual === true } : a0;
      const url = S0((a.ref || {}).url); const src = url ? srcByKey.get(AIRF.urlKey(url)) : null;
      if (a.sink === 'prospect') { const why = rivalWhy(hostOf(url), { url, title: src ? src.title || '' : '' });
        if (why || (src && ['rival', 'client'].includes(S0(src.author_kind)))) { refused.push({ what: a.action_id || a.lever, why: why || 'a page written by ' + (src.author_kind === 'client' ? 'the client' : 'a competitor') + ': learned from, never pitched' }); continue; } }
      // RA-14 (FX-A): an own page is screened against the refused tactics before anything is written (shadow shows it too)
      let screen = null; if (['L05', 'L06'].includes(S0(a.lever)) && typeof ARL.screenOwnPage === 'function') { const pq = promptById.get(S0((a.ref || {}).prompt_id)) || {};
        screen = ARL.screenOwnPage({ keyword: pq.keyword || pq.topic, question: pq.prompt, fanouts: ARD.fanoutOf({ prompt_id: S0((a.ref || {}).prompt_id), answers8, evidence: evidenceOf.get(S0((a.ref || {}).prompt_id)) || '' }).slice(0, 8) });
        if (screen.refused) { refused.push({ what: a.action_id || a.lever, why: screen.refused.id + ': ' + screen.refused.why }); continue; } if (!screen.page_type) screen = null; }
      chosen.push({ ...a, screen, prereg: a.prereg && !a.prereg.unavailable ? a.prereg : ARL.prereg(a, { arms, units60, now: nowMs, exposure }) }); }
    // ---- G: verify and judge (only actions AIR executed: mode `on`, an open status); learning runs ONCE after every site (RA-10) ----
    // RA-1 / RA-9 (FX-A): the stages and answer counts at the start are frozen in verify_json (t0_snapshot) the first time our check finds the action
    // done, from the latest stored reading at or before its start (the compact stages_json of the run rows), else this run's reading (labelled)
    const readings = runsPrev.map(r => ({ at: S0(r.checked_at), diag: S0(r.stages_json) ? r.stages_json : P(r.diag_json, []), basis: 'the AI ranking reading of ' + S0(r.checked_at).slice(0, 10) })).filter(x => x.at);
    const stagesAt = (t) => { let best = null; for (const r of readings) { const x = Date.parse(r.at); if (!Number.isFinite(x) || !Number.isFinite(t) || x > t + 6 * 3600e3 || t - x > 14 * DAY) continue; const d = ARL.stagesUnpack(r.diag); if (d.length && (!best || x > best.x)) best = { x, d }; } return best ? best.d : null; };
    const outcomes = [];
    for (const a of openStored.filter(x => S0(x.mode) === 'on')) {
      const qs0 = P(a.questions, []); const act = { ...a, ref: P(a.ref, {}), questions: qs0, engines: P(a.engines, []), expected: P(a.expected_json, {}), prereg: P(a.prereg_json, {}), keyword: S0((promptById.get(S0(qs0[0])) || {}).keyword) };
      const v = ARL.verify(act, { contentLog: bySite(logAll, sid, dom), pages: aiPages, index, listings, outreach, sources, robots: access, bing: index.bing, now: nowMs });
      const sv = P(a.verify_json, {}) || {}; let snap = sv.t0_snapshot || null; const first = !S0(a.happened_at);
      const t0 = Date.parse(act.prereg.t0_rule === 'live_at' ? S0(v.live_at || sv.live_at || a.live_at) : S0(a.happened_at || v.at));
      if (!snap && v.happened === true && Number.isFinite(t0)) snap = ARL.snapshotT0(act, { t0, readings, diagNow: first ? diag : null, units: units60, now: nowMs });   // a start seen weeks ago is never read from this week's stages
      const v2 = snap ? { ...v, t0_snapshot: snap } : v;
      const o = ARL.outcome(act, { units60, diagNow: diag, diagAtT0: snap ? null : stagesAt(t0), arms, now: nowMs, verified: v2, exposure });
      outcomes.push({ action_id: a.action_id, lever: a.lever, site_id: sid, action: { ...a, site_id: sid }, verify: v2, outcome: o, happened: v.happened === true }); }   // ARL.learn / learnable read { action, outcome, happened }
    // RA-12: the false discovery rate over the actions judged in the last quarter (stored verdicts are history, never rewritten)
    const fdrR = typeof ARL.fdr === 'function' ? ARL.fdr({ outcomes, judged: storedA, now: nowMs }) : null;
    // ---- H: the old logic's choice, the comparison, the memo ----
    const old = { targets: (gm.targets || gp.targets || []).filter(t => S0(t.status) === 'queued').slice(0, 10).map(t => ({ target_id: t.target_id, prompt_id: t.prompt_id || '', question: t.question, kind: t.kind, page_url: t.page_url || '', value: t.value })),
      earned: (em.earned || gp.earned || []).slice(0, 10).map(e => ({ url: e.url, host: e.host || hostOf(e.url), kind: e.kind || '', citations: e.citations || 0, mentions_us: e.mentions_us === true, action: S0(e.action_type || e.action).slice(0, 160) })),
      actions: (gm.actions || []).slice(0, 12).map(x => ({ priority: x.priority, type: x.type, action: S0(x.action).slice(0, 200) })) };
    const compare = un('ARL.compareOld', ARL.compareOld({ chosen, old }));
    const blockers = (gm.actions || []).filter(x => ['bing', 'indexnow', 'robots', 'fetchers', 'access', 'render'].includes(S0(x.type))).slice(0, 8).map(x => ({ what: S0(x.action).slice(0, 200), owner: 'client', since: '', blocks: S0(x.why).slice(0, 200) }));
    const cost = { usd: fetched ? Math.round(1e4 * (Number(fetched.cost_usd) || 0)) / 1e4 : 0, basis: fetched ? 'AI Rank Fetched (measured, counted once by task id)' : 'stored data only: no paid or outside read this run' };
    // RA-9: last week's stages come from the compact stages_json (the full diagnosis is trimmed from a run row of about 20 questions or more)
    const diagPrev = !prevRun ? [] : (() => { const st = ARL.stagesUnpack(prevRun.stages_json); if (st.length) return st; const d = P(prevRun.diag_json, []); return Array.isArray(d) ? d : []; })();
    const memo = un('ARL.memo', ARL.memo({ site, diagNow: diag, diagPrev, chosen, open: openStored, outcomes, mde, blockers, cost, old, mode }));
    const panel = { core: panel0.core || [], proposed: panel0.proposed || [], extend: panel0.extend || [], comparable: !!panel0.comparable, why: S0(panel0.why), arms, mde: mde.unavailable ? null : mde };
    // ---- the rows of the five AIR tables (shadow and on) ----
    const q_rows = diag.map(d => { const pid = S0(d.prompt_id); const p = promptById.get(pid) || {}; const c = (panel.core || []).find(x => S0(x.prompt_id) === pid) || null; const sq = storedQ.get(pid) || {};
      const ext = (panel.extend || []).find(x => S0(x.prompt_id) === pid) || null; const arm = armOf.get(pid) || {}; const v = values[pid] || null; const f = feas[pid] || null;
      return { site_id: sid, domain: dom, prompt_id: pid, question: S0(p.prompt).slice(0, 300), intent: S0(d.intent), market: S0(p.market) || (market.unavailable || !market.cc ? '' : market.cc + '-' + (market.lang || 'en')),
        core: !!c, core_since: c ? S0(c.core_since) : S0(sq.core_since), core_until: ext ? S0(ext.core_until) : c ? S0(c.core_until) : '', arm: S0(arm.arm || sq.arm), stratum: S0(arm.stratum || sq.stratum), arm_since: S0(arm.assigned_at || sq.arm_since),
        value: v ? Number(v.V) || 0 : null, demand: v ? Number(v.demand_w) || 0 : null, demand_basis: v ? S0(v.basis).slice(0, 300) : '', feasibility: f ? Number(f.F) || 0 : null,
        stage_json: J(d.engines || {}), best_stage: S0(d.best_stage), parametric_json: J({ parametric_share: d.parametric_share || {}, no_search: d.no_search || [], list_dominated: !!d.list_dominated, nobody_named: !!d.nobody_named }),
        evidence_json: evidenceOf.get(pid) || '', first_named_at: S0(d.first_named_at), last_named_at: S0(d.last_named_at), last_cited_at: S0(d.last_cited_at), updated_at: nowIso, rule_version: AIRF.RULE_VERSION }; });
    const statusOf = (a) => !on ? 'shadow' : (['ai_target', 'prospect', 'protect'].includes(a.sink) || (a.executor === 'human')) ? 'queued' : 'proposed';
    const sinkRefOf = (a) => !on ? '' : a.sink === 'ai_target' ? AIRF.targetId(sid, S0((a.ref || {}).prompt_id)) : a.sink === 'prospect' ? hostOf((a.ref || {}).url) : a.sink === 'protect' ? AIRF.protectKey(sid) : '';
    const storedById = new Map(storedA.map(a => [S0(a.action_id), a]));
    const a_rows = [];
    for (const a of chosen) { const id = S0(a.action_id) || AIRF.actionId(sid, a.lever, a.ref); const st = storedById.get(id) || {};
      // RA-7 (FX-A): a registration is kept only by an attempt that is still open and executed (`on`); a shadow row, or an attempt that ended (did not
      // happen, expired, verified), is registered afresh (registration date, baseline, controls), the earlier attempts kept as history in prereg_json
      const keep = on && AIR_CFG.open.includes(S0(st.status)) && S0(st.mode) === 'on' && !!S0(st.prereg_json);
      const old = !keep && S0(st.prereg_json) && S0(st.status) !== 'shadow' && S0(st.mode) === 'on' ? P(st.prereg_json, {}) || {} : null;
      const fresh = a.prereg && !a.prereg.unavailable ? Object.assign({}, a.prereg, old ? { attempt: (Number(old.attempt) || 1) + 1, previous: [{ registered_at: S0(old.registered_at), status: S0(st.status), verdict: S0((P(st.outcome_json, {}) || {}).verdict) }, ...(old.previous || [])].slice(0, 5) } : {}) : null;
      a_rows.push({ action_id: id, site_id: sid, domain: dom, lever: S0(a.lever), executor: S0(a.executor), scope: S0(a.scope), ref: J(a.ref || {}), questions: J(a.questions || []), engines: J(a.engines || []),
        target_stage: S0(a.target_stage), status: statusOf(a), sink: S0(a.sink), sink_ref: keep ? S0(st.sink_ref) || sinkRefOf(a) : sinkRefOf(a), expected_json: J(a.expected || { p: a.p_hat, gain: a.gain, cost: a.cost, score: a.score, days: a.days }),
        prereg_json: keep ? S0(st.prereg_json) : fresh ? J(fresh) : '',   // written once per attempt, never changed while it runs
        happened_at: keep ? S0(st.happened_at) : '', verify_json: keep ? S0(st.verify_json) : '', outcome_json: keep ? S0(st.outcome_json) : '', learned_at: keep ? S0(st.learned_at) : '', mode, run_id: g.run_id, created_at: keep ? S0(st.created_at) || nowIso : nowIso, updated_at: nowIso,
        client_url: S0(st.client_url) }); }   // FX-A2: the address the client pasted is never wiped by a weekly run (a new attempt re-checks the same page)
    // every stored action has an exit (INVARIANTS rule 4): verified / not happened from its outcome, `expired` once its window + 14 days passed
    const chosenIds = new Set(a_rows.map(r => r.action_id)); const pendingOc = [];
    for (const o of outcomes) { const a = storedById.get(S0(o.action_id)); if (!a || chosenIds.has(S0(a.action_id))) continue; const v = o.verify || {}; const oc = o.outcome || {};
      const status = v.happened === true ? (oc.due && oc.verdict && oc.verdict !== 'not_due' ? 'verified' : 'done') : v.happened === false && oc.due ? 'not_happened' : S0(a.status);
      if (status === S0(a.status) && !(v.happened === true && !S0(a.happened_at))) continue;
      const row = { ...a, status, happened_at: v.happened === true ? (S0(a.happened_at) || S0(v.at) || nowIso) : S0(a.happened_at), verify_json: J(v), outcome_json: oc.due ? J(oc) : S0(a.outcome_json),
        learned_at: !S0(a.learned_at) && typeof ARL.learnable === 'function' && ARL.learnable(o) ? nowIso : S0(a.learned_at), updated_at: nowIso };
      a_rows.push(row); if (oc.due) pendingOc.push({ row, oc, id: S0(a.action_id) }); chosenIds.add(S0(a.action_id)); }
    // RA-16 (FX-A): an executed action that never happened expires at its registration + the lever's longest time to effect + 14 days (ARL.expiryDays,
    // as verify); one that happened is never expired here (it waits for the end of its window); a shadow plan not chosen again: its window + 14 days
    const judgedNow = new Set(outcomes.map(o => S0(o.action_id)));   // verify ran on these this run, with its own clock (a placement's starts at the pitch): no second clock here
    for (const a of storedA) { if (chosenIds.has(S0(a.action_id)) || judgedNow.has(S0(a.action_id)) || !['shadow', ...AIR_CFG.open].includes(S0(a.status)) || S0(a.happened_at) || S0(a.status) === 'done') continue;
      const pre = P(a.prereg_json, {}) || {}; const win = Math.max(AIR_CFG.window_min_days, Number(pre.window_days) || 0); const sh = S0(a.status) === 'shadow';
      const since = Date.parse(sh ? a.updated_at || a.created_at : S0(pre.registered_at) || a.created_at || a.updated_at);
      const days = sh ? win + AIR_CFG.expire_grace_days : (typeof ARL.expiryDays === 'function' ? ARL.expiryDays(S0(a.lever), pre) : win + AIR_CFG.expire_grace_days);
      if (Number.isFinite(since) && nowMs - since > days * DAY) a_rows.push({ ...a, status: 'expired', updated_at: nowIso }); }
    const s_rows = sources.map(x => { const k = S0(x.url_key) || AIRF.urlKey(x.url); const st = storedSrc.find(r => S0(r.url_key) === k) || {};
      return { site_id: sid, domain: dom, url_key: k, url: S0(x.url), host: S0(x.host) || hostOf(x.url), page_type: S0(x.page_type), author_kind: S0(x.author_kind), names_client: x.names_client === null || x.names_client === undefined ? null : !!x.names_client,
        rivals_named: J(x.rivals_named || []), questions: J(x.questions || []), engines: J(x.engines || []), cites_28d: Number(x.cites_28d) || 0, influence: Number(x.influence) || 0, placeability: Number(x.placeability) || 0,
        placeability_why: S0(x.placeability_why).slice(0, 300), contact_email: S0(x.contact_email), contact_url: S0(x.contact_url), source_from: S0(x.from) || 'answers', first_seen: S0(st.first_seen) || nowIso, last_seen: S0(x.last_seen) || nowIso, checked_at: x.client ? S0(x.checked_at) || S0(st.checked_at) : nowIso }; })
      .filter(r => r.url_key && !(sources.find(x => x.client && (S0(x.url_key) || AIRF.urlKey(x.url)) === r.url_key) && !storedSrc.some(z => S0(z.url_key) === r.url_key && S0(z.source_from) !== 'client')));   // FX-A2: a client row that only the app wrote is left exactly as the app wrote it
    const p_rows = [];   // filled after every site (RA-10)
    // ---- the sinks, `on` only (AIRF.writesSinks): nothing below is built for a site in shadow ----
    const sinks = { targets: [], prospects: [], proposed: [], core: [], cache: [], growth: null };
    if (on) {
      const targetsSite = bySite(targetsAll, sid, dom); const maxScore = Math.max(1e-9, ...chosen.map(a => Number(a.score) || 0));
      for (const a of chosen.filter(x => x.sink === 'ai_target')) { const pid = S0((a.ref || {}).prompt_id); const p = promptById.get(pid); if (!p) continue;
        const tid = AIRF.targetId(sid, pid); const st = targetsSite.find(t => S0(t.target_id) === tid) || {};
        if (['writing', 'written', 'won'].includes(S0(st.status))) continue;   // live work or a win: AIR leaves it alone
        const qs = sources.filter(x => (x.questions || []).includes(pid)).slice(0, 6);
        // LIVE1 (2026-11-07): a refresh carries the page it refreshes (the action's own page_url; the ref held only the question, so prod wrote '');
        // a refresh with no address could never be written by the cadence, so it is refused here with its reason, never stored
        const pageUrl = S0((a.ref || {}).url) || S0(a.page_url) || S0(st.page_url);
        if (a.lever === 'L06' && !pageUrl) { refused.push({ what: a.action_id || a.lever, why: 'a refresh with no page address: no page of the site is known for this question' }); continue; }
        sinks.targets.push({ target_id: tid, site_id: sid, domain: dom, prompt_id: pid, question: S0(p.prompt), keyword: S0(p.keyword || p.topic), kind: a.lever === 'L06' ? 'refresh' : 'answer',
          page_url: a.lever === 'L06' ? pageUrl : S0(st.page_url), page_type: a.lever === 'L06' ? '' : (a.screen && a.screen.page_type ? a.screen.page_type : (S0(st.page_type) || 'Guide')), fanout: ARD.fanoutOf({ prompt_id: pid, answers8, evidence: evidenceOf.get(pid) || '' }).slice(0, 8).map(f => f.query).join(' | '),
          sources_json: J(qs.map(x => ({ u: x.url, t: '', n: Number(x.cites_28d) || 1 }))), competitors: [...new Set(qs.flatMap(x => x.rivals_named || []))].slice(0, 8).join(', '), engines: (a.engines || []).join(', '), stage: S0(p.stage),
          value: Math.round(100 * (1 + 4 * Math.min(1, (Number(a.score) || 0) / maxScore))) / 100, status: 'queued', reason: ('AI ranking (' + a.lever + '): ' + (a.screen && a.screen.note ? a.screen.note + '. ' : '') + S0(a.why || (ARL.LEVERS.find(l => l.id === a.lever) || {}).label)).slice(0, 600),
          created_at: S0(st.created_at) || nowIso, updated_at: nowIso, request_id: S0(st.request_id), written_at: S0(st.written_at), won_at: S0(st.won_at), origin: 'ai_rank', action_id: S0(a.action_id), live_at: S0(st.live_at) || null }); }
      for (const a of chosen.filter(x => x.sink === 'prospect')) { const url = S0((a.ref || {}).url); const pd = hostOf(url); if (!pd) continue; const src = srcByKey.get(AIRF.urlKey(url)) || {};
        const st = prospects.find(r => S0(r.prospect_domain) === pd && S0(r.type) === 'ai_source') || null;
        if (st && !(['ai_rank', 'ai_growth', ''].includes(S0(st.origin)) && ['new', ''].includes(S0(st.status)))) continue;   // the Link Builder already works it: AIR does not take it over
        const o = st || {};
        sinks.prospects.push({ site_id: sid, domain: dom, prospect_domain: pd, type: 'ai_source', rank: Number(o.rank) || 0, spam_score: Number(o.spam_score) || 0,
          detail: ('cited for ' + (src.questions || []).length + ' question(s) on ' + (src.engines || []).length + ' engine(s)' + ((src.rivals_named || []).length ? '; names ' + src.rivals_named.slice(0, 3).join(', ') : '')).slice(0, 500),
          source_url: url, target_url: S0(o.target_url), status: S0(o.status) || 'new', first_seen: S0(o.first_seen) || nowIso, last_seen: nowIso, won_at: S0(o.won_at), outreach_subject: S0(o.outreach_subject), outreach_body: S0(o.outreach_body),
          note: S0(o.note) || ('AI ranking placement (' + a.lever + ')' + (a.manual ? ': a contact form only, a manual step' : '')), score: Math.max(0, Math.min(100, Math.round(100 * (Number((a.expected || {}).p) || Number(a.p_hat) || 0)))), origin: 'ai_rank',
          contact_email: S0(o.contact_email) || S0(src.contact_email) || S0(a.contact_email), contact_url: S0(o.contact_url) || S0(src.contact_url) || S0(a.contact_url), contacted_at: S0(o.contacted_at), followup_step: Number(o.followup_step) || 0,
          followup_subject: S0(o.followup_subject), followup_body: S0(o.followup_body), verified_at: S0(o.verified_at), drafted_at: S0(o.drafted_at) }); }
      const fitCtxQ = { ...fitCtx, topics: null };
      for (const q of (panel.proposed || [])) { const text = S0(q.prompt); if (text.length < 10 || AIP.findStored(prompts, sid, text)) continue;
        const kw = S0(q.keyword); const gate = kw ? fitGate(kw, fitCtxQ) : { ok: true }; if (!gate.ok) { refused.push({ what: 'question "' + text.slice(0, 80) + '"', why: 'not proposed: ' + S0(gate.detail || gate.reason) }); continue; }
        sinks.proposed.push({ prompt_id: AIP.promptId(sid, text), site_id: sid, domain: dom, prompt: text, kind: q.intent === 'informational' ? 'learn' : q.intent === 'brand' ? 'brand' : 'recommend', topic: kw, keyword: kw,
          source: 'ai_rank', status: 'proposed', created_at: nowIso, stage: '', cluster: '', volume: null, origin: 'ai_rank', updated_at: nowIso, persona: '', market: S0(q.market) || (market.cc ? market.cc + '-' + (market.lang || 'en') : ''),
          pinned: false, fit_note: S0(q.reason).slice(0, 300), keyword_source: 'ai_rank', last_asked_run: '', last_asked_at: '', asked_n_28d: 0, refused_at_run: '', focus_topic: '', focus_source: '', focus_state: '', focus_seen_at: '', retired_at: '', retire_reason: '' }); }
      for (const c of [...(panel.core || []), ...(panel.extend || [])]) { const pid = S0(c.prompt_id); const p = promptById.get(pid); const until = S0(c.core_until);
        if (!p || !until || S0(p.core_until) === until) continue; if (sinks.core.some(x => x.prompt_id === pid)) { sinks.core.find(x => x.prompt_id === pid).core_until = until; continue; }
        sinks.core.push({ site_id: sid, prompt_id: pid, core_until: until }); }
      const protect = chosen.filter(a => a.sink === 'protect' && S0((a.ref || {}).url)).map(a => ({ url: S0(a.ref.url), until: new Date(nowMs + AIR_CFG.protect_days * DAY).toISOString(), why: S0(a.why || 'AI answers cite this page').slice(0, 200) }));
      if (protect.length) sinks.cache.push({ key: AIRF.protectKey(sid), kind: AIRF.CACHE_KIND, site_id: sid, value: J({ urls: protect }), updated_at: nowIso });
      const human = chosen.filter(a => a.executor === 'human' || ['growth_action', 'site_task', 'listing'].includes(a.sink)).slice(0, AIR_CFG.growth_add_max);
      const gr = gm.growth_row || null;
      if (human.length && gr && gr.run_id) { const had = P(gr.actions_json, []); const list = Array.isArray(had) ? had.slice() : [];
        const lab = (a) => S0((ARL.LEVERS.find(l => l.id === a.lever) || {}).label) || a.lever;
        for (const a of human) { const item = { priority: 2, type: 'ai_rank', action: (lab(a) + (S0((a.ref || {}).url) ? ': ' + a.ref.url : '')).slice(0, 200), why: S0(a.why || 'chosen by AI ranking (' + a.lever + ')').slice(0, 300) };
          if (!list.some(x => x && x.action === item.action)) list.push(item); }
        sinks.growth = { site_id: sid, run_id: S0(gr.run_id), actions_json: J(list) }; }
    }
    const kitsMissing = [...unavailable].sort();
    const air = { market: market.unavailable ? null : market, panel: panel0.unavailable ? null : panel, diag, stages: ARL.stagesPack(diag), sources, candidates: scored.length ? scored : candidates, chosen, deferred: choice.deferred || [], refused, outcomes, priors: p_rows, memo: memo.unavailable ? null : memo,
      compare: compare.unavailable ? null : compare, cost, old, learn: [], fdr: fdrR, set_aside: fitG.set_aside || [], kits_missing: kitsMissing, rule_version: AIRF.RULE_VERSION, checked_at: nowIso,
      rows: { questions: q_rows, actions: a_rows.slice(0, AIR_CFG.actions_max), sources: s_rows, priors: p_rows }, sinks };
    out.push({ json: { site_id: sid, domain: dom, mode, run_id: g.run_id, air, error: '' } });
    siteLearn.push({ sid, air, outcomes, history: storedA.filter(a => S0(a.learned_at)), pendingOc });
  } catch (e) {
    out.push({ json: { site_id: sid, domain: g.domain || '', mode: g.mode || '', run_id: g.run_id || AIRF.runId(sid, nowMs), air: null, error: 'AI ranking plan failed for this site: ' + S0(e && e.message).slice(0, 300) } });
  }
}
// ---- G4 (RA-10, FX-A): learning ONCE over every site's outcomes, so two sites learning one key in one run build one global row, not two that
// overwrite each other; each site's item carries its own rows and the global rows of the keys it touched (identical values in every item)
if (siteLearn.length) { try {
  const allOc = siteLearn.flatMap(x => x.outcomes); const history = siteLearn.flatMap(x => x.history);
  const rowsL = (ARL.learn({ priors: rpAll, outcomes: allOc, now: nowMs, history }) || []).filter(r => r && r.prior_id).map(r => ({ ...r, updated_at: S0(r.updated_at) || nowIso, rule_version: S0(r.rule_version) || AIRF.RULE_VERSION }));
  const claimed = typeof ARL.claimCells === 'function' ? ARL.claimCells(allOc.filter(ARL.learnable), history) : new Map();
  for (const x of siteLearn) { const keys = new Set(rowsL.filter(r => r.scope === x.sid).map(r => r.lever + '|' + r.stage + '|' + r.engine_group)); const levers = new Set(x.outcomes.filter(o => ARL.learnable(o)).map(o => S0(o.lever)));
    const mine = rowsL.filter(r => r.scope === x.sid || (r.scope === 'global' && (keys.has(r.lever + '|' + r.stage + '|' + r.engine_group) || levers.has(S0(r.lever)))));
    x.air.priors.push(...mine); x.air.learn.push(...mine);
    for (const p of x.pendingOc) { const c = claimed.get(p.id); if (c && c.dropped.length) p.row.outcome_json = J(Object.assign({}, p.oc, { learn_overlap: { dropped: c.dropped, why: 'these cells were already taught by an earlier overlapping action: one move teaches one action' } })); } }
} catch (e) { for (const x of siteLearn) x.air.learn_error = 'learning failed: ' + S0(e && e.message).slice(0, 200); } }
return out.length ? out : [{ json: { skip: true, reason: 'no website to plan' } }];
