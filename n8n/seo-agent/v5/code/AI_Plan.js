// AI visibility plan (weekly, in each website's own cycle, and on demand): one job per site — the brand names to look for, the competitors (configured, detected,
// and the brand names AI uses for them, learned by the Answer Analyst), the topics, the stored question panel (seo_ai_prompts: stable week to week
// so the trend means something; up to 50 questions with buyer stage, topic cluster and monthly AI search volume), the engines, the AI Pulse samples
// of the past days (seo_ai_daily) that join this week's figures, last week's numbers, and what is due this run: the monthly full run (Claude and the
// brand question), question discovery (Search Console questions + real questions from the AI-answer database), search volumes, the market-wide
// index (the DataForSEO AI-answer database: your share against the competitors across every answer, not only the panel), AI referral traffic from
// GA4 (visits, key events and revenue from ChatGPT, Perplexity, Gemini, Copilot, Claude …) and the AI-crawler access check. (v4.9)
// B-G1 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the question panel used to be built from EVERY stored ladder keyword, so a rung
// that is a competitor's brand or a government portal — exactly what the fit gate refuses when a rung is planned — became a question we
// ask ChatGPT and then score ourselves against. The stored rungs now go through the same read-path gate R16 built (FITR, _fit_gate.js),
// and every rung set aside travels with the plan so the report can name it with its reason instead of quietly shortening the list.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the panel holds up to 500 questions (persona, funnel stage, topic cluster, market), the weekly
// run asks all of it on every enabled engine and is SPLIT ACROSS EXECUTIONS when it is bigger than one execution should carry
// (AIP.LIMITS.chunk_requests). One run = one run_id, one state row in seo_cache (`ai_run:<site_id>`), one deterministic list of requests;
// every execution asks only what no earlier execution of the same run has answered (so a repeated or resumed chunk never pays twice), and
// the last one computes the week over every answer of the run. This node decides, per site, which of three things this execution is:
// the FIRST chunk of a new run, the NEXT chunk of a run (`continue_run` on the trigger), or the RESUME of a run that went silent (any
// start of the tracker picks it up instead of starting a second run the same week). A start while a chunk is still running is a twin and
// does nothing for that site. Each item carries what is left to spend on the run (est_dfs_usd / est_ai_usd: the run ledger reserves it,
// and the run guard refuses a run the DataForSEO account cannot pay for, with the reason).
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.4 / §4.5): a run of a website's weekly cycle (`trigger: 'cycle'`) is a scheduled run for one site: the
// monthly full run (Claude, the brand question, discovery of every volume, the market-wide index and the market view) comes ONLY from the
// `monthly` the Cycle Dispatcher passes - never from the UTC month - and the cycle travels with the run (`cycle`), through every continuation
// of a split run, so only the run's LAST execution settles the cycle's ledger key (Monitor_Ledger_Row).
// F2 (2026-10-23, ENGINE_AUDIT.md E1 / E11 / E17 / E18 / E20 / E22): a run that cannot pay twice. The state row records every key the run
// has SENT (`asked_keys`, written before the requests leave) and AI Requests never asks one of them again; a part whose sent keys were not
// stored is found here (the first time: counted as could-not-be-read and the next part halved; the second time: the run STOPS with an ops
// alert); the run has a hard DataForSEO ceiling (1.5 x its own estimate) checked against what it measured and committed; a part is sized
// by TIME (AIP.chunkPlan: 40 of the execution's 60 minutes), measured from the run's earlier parts. A stopped run is a plan item with
// `stop` and nothing to ask (AI Chunk Handoff writes its state, the ops alert and the caller's notice; its ledger row settles the cycle
// job). An on-demand start that meets an open run is told so at once (`notices`, a `rejected` callback with reason 'open_run', the run's
// id, its progress and when it should finish) and never takes over the open run's caller.
/*__MONITOR_SITES__*/
/*__COUNTRIES__*/
/*__AI_PANEL__*/
/*__SITE_MODEL__*/
/*__FIT_GATE__*/
const CONFIG = { max_sites_per_run: 15, max_topics: 8, monthly_engines: ['claude'],   // v4.9: Gemini moved to the weekly set (the real gemini.google.com answer costs $0.004 through the scraper)
  gsc_questions: 15, pulse_days: 7 };
const { list, on_demand, want, total, cycle, cycle_why } = monitorSites('ai');
if (!list.length) return [{ json: { nothing_to_do: true, cycle, reason: cycle ? (cycle_why || 'nothing to run for this cycle') : on_demand ? 'no site matches "' + want + '"' : (total ? 'AI visibility is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), ladders = rowsOf('Load Ladders'), daily = rowsOf('Load AI Daily'), cache = rowsOf('Load Cache (AI)'), queries = rowsOf('Load Query History');
// G6: the answers stored by earlier executions of an unfinished run (this week, not the pulse). Read raw: rowsOf() drops a row carrying
// `error` (it is meant for a Data Table node that failed), and an answer the gate could not get carries its task error — it is still
// ASKED, and asking it again in every later execution would never let a run end (a failed task is billed nothing; the report names it).
let runRows = []; try { runRows = $('Load AI Run Answers').all().map(i => i.json).filter(r => r && r.run_id && r.prompt_id && r.engine); } catch (e) {}
const continuing = String(trigger.continue_run || '').trim();   // G6: set when the previous chunk started this execution
const LIVE = new Set(['off', 'refused']);   // G6: a question switched off by the owner or refused by the fit gate is never asked
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const codeOfIso = (iso) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => String(x.iso || '').toUpperCase() === String(iso || '').toUpperCase()); return c ? Number(c.code) : AIP.locationOf(iso); };   // G6: a market outside COUNTRIES keeps its own country
const skipped = [];   // G6: sites this execution does nothing for, with the reason (a twin start, nothing to continue, a run above the ceiling)
const notices = [];   // F2 (E17): the on-demand callers told at once that their check is part of an open run (AI Open Run Notices posts them)
const openRun = (st, s, why) => { const left = Math.max(0, (Number(st.total) || 0) - (Number(st.asked) || 0)); const per = Math.max(1, Number(st.last_size) || AIP.LIMITS.chunk_requests);
  const parts = Math.ceil(left / per); const eta = new Date(Math.max(Date.parse(st.updated_at) || Date.now(), Date.now()) + parts * (AIP.TIME.budget_s + AIP.TIME.fixed_s) * 1000).toISOString();
  return { run_id: st.run_id, status: st.status, part: Number(st.chunk) || 1, asked: Number(st.asked) || 0, total: Number(st.total) || 0, started_at: st.started_at || '', updated_at: st.updated_at || '',
    expected_finish: String(st.status) === 'running' ? eta : '', why }; };
const tell = (s, st, kind) => {   // E17: only a caller that is waiting for its own answer (an on-demand start with a callback) and is not the open run's own caller
  if (!on_demand || !s.callback_url || (st && String(st.request_id || '') && String(st.request_id) === String(s.request_id || ''))) return;
  const o = openRun(st, s, kind);
  const sentence = kind === 'blocked'
    ? 'The AI visibility check of ' + s.domain + ' was not started: this week\'s run (' + o.run_id + ') was stopped (' + String(st.stop_reason || st.status) + '). Nothing was asked and nothing was charged; the team has been alerted.'
    : 'An AI visibility check of ' + s.domain + ' is already running (run ' + o.run_id + ', part ' + o.part + ', ' + o.asked + ' of ' + (o.total || '?') + ' questions asked). ' + (kind === 'resume' ? 'This request started its next part again. ' : '')
      + 'Its report will come with that run' + (o.expected_finish ? ', about ' + o.expected_finish.slice(0, 16).replace('T', ' ') + ' UTC' : '') + '. This request was not run separately and nothing was charged for it.';
  notices.push({ callback_url: s.callback_url, body: { stage: 'rejected', status: 'rejected', reason: 'open_run', skipped: true, error: sentence, request_id: String(s.request_id || ''), domain: s.domain, mode: 'ai_visibility', on_demand: true, open_run: o, cost_usd: 0 } }); };
const QUESTION = /^(how|what|which|who|why|when|where|is|are|can|does|do|should|best|top|cost|price|vs|compare)\b|\?|\b(vs|versus|best|cost|price|how to|which)\b/i;
const planned = list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const label = s.domain.split('.')[0];
  const brand_names = [...new Set([s.domain, s.business_name || '', ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : [])].map(x => String(x).trim()).filter(x => x.length >= 3))];   // P34-6: the model's name is a brand name too
  const lrowsAll = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0));
  const asked = on_demand ? listOf(trigger.topics).map(x => x.toLowerCase()) : [];   // "Main services or products" on the on-demand form / API `topics`
  // D15 (system review 2026-10-11): the plan carries the site's canonical host (the site model, SITE_MODEL_SPEC.md §6), so every URL the run
  // emits is on the host the site really serves; with no model yet the bare domain keeps today's behaviour.
  const site_model = SM.stored(s) || { domain: s.domain, canonical_host: s.domain };
  // G6: the state of this site's split run, and what this execution is for it
  const st = AIP.stateOf(cache, s.site_id);
  const verdict = AIP.stateVerdict(st, iso, continuing);
  if (continuing && verdict !== 'continue') { skipped.push({ domain: s.domain, why: 'nothing to continue: run ' + continuing + ' is ' + (st && st.run_id === continuing ? st.status : 'not the open run') }); return null; }
  if (verdict === 'busy') { tell(s, st, 'busy'); skipped.push({ domain: s.domain, why: 'run ' + st.run_id + ' is still being asked (chunk ' + (st.chunk || 1) + ', ' + (st.asked || 0) + ' of ' + (st.total || '?') + ' requests, updated ' + String(st.updated_at || '').slice(0, 16) + ' UTC); it continues by itself' }); return null; }
  // F2 (E1): a STOPPED run (its answers were not stored, or it reached its money ceiling) blocks this site's weekly run until it is older than
  // resume_days or a person clears the state row — a retry of the cycle job, a catch-up or an on-demand start never pays for it again
  if (verdict === 'blocked') { tell(s, st, 'blocked'); skipped.push({ domain: s.domain, blocked: true, why: 'run ' + st.run_id + ' was stopped (' + String(st.stop_reason || st.status) + '); nothing is asked for this website until the run is older than ' + AIP.LIMITS.resume_days + ' days or the state row ai_run:' + s.site_id + ' is cleared' }); return null; }
  if (verdict === 'resume') tell(s, st, 'resume');
  const going = verdict === 'continue' || verdict === 'resume';
  const mineAll = promptRows.filter(p => p.site_id === s.site_id && !LIVE.has(String(p.status || 'active')) && p.prompt);
  const mineVis = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const prev = mineVis[0] || null;
  // brand names AI uses for competitors (learned by the Answer Analyst: "ClearTax" -> cleartax.in), so a competitor named without its website still counts
  const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id); const aliases = aliasRow ? parse(aliasRow.value, {}) : {};
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const competitors = [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8);
  // B-G1: the read-path gate, before a single stored rung can become a topic, a question or a page we check for AI readiness.
  // Protected so the ladder's own subject can never read as somebody's brand: the head terms, the site's services and its own keywords.
  // F2 (E18): one gate input for the weekly run and the pulse (AIP.fitInput: ladder heads + the site's services + its keywords)
  const fit_input = AIP.fitInput({ domain: s.domain, competitors, aliases, ladders: lrowsAll, services: SM.services(site_model), keywords: s.keywords || [] });
  const fitCtx = FITR.ctx(fit_input);
  const fit = FITR.rungs(lrowsAll, fitCtx, { where: 'AI question panel' });
  const lrows = fit.keep;
  // and the panel rows ALREADY stored from those rungs (seo_ai_prompts predates the gate too): an auto-written question whose keyword is
  // a competitor's brand is dropped, a question the owner added themselves is kept and only flagged — it is their deliberate choice.
  // The brand question is deliberately about the site itself ("What is X and what does it offer?"), so it is never judged here — the
  // gate's first rule is "names the website itself", and running it over that question would refuse the one question that must stay.
  const fitQ = FITR.rungs(mineAll.filter(p => p.kind !== 'brand'), fitCtx, { where: 'AI question panel', keyword: (p) => p.keyword || p.topic || '', live: (p) => p.source === 'custom' });
  const refusedQ = new Set(fitQ.set_aside.filter(x => x.dropped).map(x => x.prompt_id));
  // G6: pinned questions first (the owner's choice is never cut by a smaller panel), then the stored order (the panel's order)
  const pin = (p) => p.pinned === true || String(p.pinned) === 'true';
  const mine = mineAll.filter(p => p.kind === 'brand' || !refusedQ.has(p.prompt_id)).map((p, i) => ({ p, i }))
    .sort((a, b) => ((pin(b.p) ? 1 : 0) - (pin(a.p) ? 1 : 0)) || a.i - b.i).map(x => x.p);
  const set_aside = [...fit.set_aside, ...fitQ.set_aside];
  const custom = mine.filter(p => p.source === 'custom' || pin(p)), auto = mine.filter(p => p.source !== 'custom' && !pin(p));
  const topics =[...new Set([...asked, ...lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()), ...(s.keywords || []), ...lrows.filter(l => Number(l.rung) !== 4).map(l => String(l.keyword || '').toLowerCase().trim())].filter(Boolean))].slice(0, CONFIG.max_topics);
  // full run = the first run of the month (or any on-demand run): every engine + the brand question + discovery + the market-wide index
  const isFull = (v) => String(v.run_kind || '') === 'full' || String(v.run_kind || '') === 'on_demand' || (!v.run_kind && (() => { const e = parse(v.engines_json, {}); return ['gemini', 'claude'].some(k => e[k] && Number(e[k].asked) > 0 && !e[k].carried); })());
  const lastFull = mineVis.find(isFull) || null;
  // the monthly full run: a cycle run takes it from the dispatcher (cycle.monthly) and nowhere else; outside a cycle the UTC month rule stays
  const full_due = going ? !!st.full_due : (on_demand || (cycle ? cycle.monthly : !mineVis.some(v => String(v.checked_at).slice(0, 7) === month && isFull(v))));
  // the cycle this run belongs to: this start's own (a cycle job, or a continuation that carries it), else the one the split run was started for
  const runCycle = cycle || (going && st && st.cycle && st.cycle.key ? st.cycle : null);
  const carried = lastFull ? { checked_at: lastFull.checked_at, engines: parse(lastFull.engines_json, {}) } : null;
  const room = Math.max(0, s.settings.prompts_max - custom.length);
  const deficit = Math.max(0, room - auto.length);
  // G6: questions are written in the FIRST chunk of a run only (a continuation asks the panel the first chunk stored); the Prompt Writer
  // writes at most writer_batch x writer_jobs_per_run in one run, so a new 500-question panel is written in one week
  const need = going ? 0 : Math.min(AIP.LIMITS.writer_batch * AIP.LIMITS.writer_jobs_per_run, (!auto.length || deficit >= 2) ? deficit : 0);   // top up only when 2+ questions are missing (not every week for one)
  const ownMarket = AIP.normMarket(isoOf(Number(s.location_code) || 2840) + '-' + (s.language_code || 'en')) || 'US-en';
  // the markets the panel covers: the site's own, the ones in its settings, and any market a stored question names (an imported question keeps its market)
  const markets = AIP.marketsOf({ country_iso: isoOf(Number(s.location_code) || 2840), language_code: s.language_code || 'en', ai_markets: [...s.settings.markets, ...mineAll.map(p => p.market).filter(Boolean)] });
  const markets_map = Object.fromEntries(markets.map(m => { const [cc, lang] = m.split('-'); return [m, { location_code: m === ownMarket ? (Number(s.location_code) || 2840) : codeOfIso(cc), language_code: lang || 'en', country_iso: cc }]; }).filter(([, v]) => v.location_code));
  const personas = AIP.personasOf({ ai_personas: s.settings.personas });
  const prompts = [...custom, ...auto].slice(0, s.settings.prompts_max).map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto',
    stage: p.stage || '', cluster: p.cluster || p.topic || '', volume: p.volume === '' || p.volume == null ? null : Number(p.volume), origin: p.origin || (p.source === 'custom' ? 'custom' : 'writer'), created_at: p.created_at || '',
    persona: String(p.persona || '').trim(), market: markets_map[AIP.normMarket(p.market)] ? AIP.normMarket(p.market) : ownMarket, pinned: pin(p),
    // F2 (E20 / E22 / E9): what the stored row says, carried so a re-upsert never blanks it; a market past the cap is asked in the own market and says so
    market_stored: String(p.market || ''), market_fallback: !!(AIP.normMarket(p.market) && !markets_map[AIP.normMarket(p.market)]), fit_note: String(p.fit_note || ''), keyword_source: String(p.keyword_source || '') }));
  // search volumes: questions without one (new) every week; all of them on the month's full run (AI Keyword Data, $0.0001 a keyword)
  const volume_keywords = [...new Set(prompts.filter(p => p.kind !== 'brand' && p.keyword && (full_due || p.volume === null || Number.isNaN(p.volume))).map(p => String(p.keyword).toLowerCase().trim()).filter(k => k.length >= 3 && k.length <= 120))].slice(0, 100);
  // real questions people search (Search Console, last weeks): long or question-shaped queries are the closest thing to an AI prompt
  const gsc_questions = [...new Map(queries.filter(q => q.site_id === s.site_id && q.query && (String(q.query).split(/\s+/).length >= 5 || QUESTION.test(String(q.query))))
    .sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0)).map(q => [String(q.query).toLowerCase().trim(), { query: String(q.query).trim(), impressions: Number(q.impressions) || 0, clicks: Number(q.clicks) || 0, position: Number(q.position) || 0 }])).values()].slice(0, CONFIG.gsc_questions);
  // AI Pulse samples since the last weekly run (or the past week): they join this week's figures (more samples = a steadier, honest rate)
  const since = prev ? String(prev.checked_at) : new Date(now.getTime() - CONFIG.pulse_days * 864e5).toISOString();
  const pulse_rows = daily.filter(d => d.site_id === s.site_id && String(d.checked_at) > since).map(d => ({ date: d.date, checked_at: d.checked_at, samples: Number(d.samples) || 0, mentioned: Number(d.mentioned) || 0, cited: Number(d.cited) || 0,
    mention_rate: Number(d.mention_rate) || 0, visibility_score: Number(d.visibility_score) || 0, engines: parse(d.engines_json, {}), prompts: parse(d.prompts_json, {}), competitors: parse(d.competitors_json, {}), sources: parse(d.sources_json, {}) }));
  const prevMention = prev ? Number(prev.mention_rate) || 0 : 0, prevSamples = prev ? Number(prev.samples) || Number(prev.answers) || 0 : 0;
  const location_code = Number(s.location_code) || 2840;
  // ---- G6: this run's identity, what earlier executions of it already asked, and what is left to pay for ----
  const baseId = 'ai_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '');
  const run_id = going ? st.run_id : (st && st.run_id && String(st.run_id).indexOf(baseId) === 0 ? baseId + '_x' + $execution.id : baseId);   // a second run the same day gets its own id: its answers are its own
  const run_checked_at = going ? String(st.started_at || iso) : iso;
  const storedKeys = new Set(going ? runRows.filter(r => r.run_id === run_id && r.prompt_id && r.engine).map(r => AIP.reqKey(r.prompt_id, r.engine)) : []);
  // F2 (E1): what the run has SENT (recorded before it paid) and the part in flight. Earlier parts' keys were checked against the save by their
  // own hand-off; a `pending` part is one that never reached its hand-off, so its keys that are not stored were paid for and lost.
  const sentKeys = going ? AIP.unpackKeys(st.asked_keys) : new Set();
  const pendingKeys = going && st.pending ? AIP.unpackKeys(st.pending.keys) : new Set();
  const lostNow = [...pendingKeys].filter(k => !storedKeys.has(k));
  const lostParts = going ? Number(st.lost_parts) || 0 : 0;
  // a state written before asked_keys existed: the count is all there is (the audit's guard), and a shortfall is a lost part too
  const legacyShort = going && !st.asked_keys && Number(st.asked) > 0 && storedKeys.size < (Number(st.asked) - Number(st.unavailable || 0)) * 0.9;
  // AI Requests is handed EVERY key the run stored or sent: a recorded key is never asked again, whatever happened to its answer
  const doneKeys = [...new Set([...storedKeys, ...sentKeys])];
  const runKind = going ? String(st.run_kind || 'weekly') : (on_demand ? 'on_demand' : full_due ? 'full' : 'weekly');
  const costNow = AIP.cost({ panel: Math.max(prompts.length + need, AIP.LIMITS.min), engines: s.settings.engines, pulse: s.settings.pulse, pulse_mode: s.settings.pulse_mode, pulse_per_week: s.settings.pulse_per_week });
  const runCost = full_due ? costNow.run.full : costNow.run.weekly;
  const spent = going ? { dfs: Number(st.spent_dfs_usd) || 0, ai: Number(st.spent_ai_usd) || 0 } : { dfs: 0, ai: 0 };
  if (!going && runCost.usd > AIP.LIMITS.max_run_usd) { skipped.push({ domain: s.domain, why: 'this run would cost about $' + runCost.usd.toFixed(2) + ' (' + prompts.length + ' questions x ' + s.settings.engines.length + ' engines), above the $' + AIP.LIMITS.max_run_usd + ' a run the tracker allows; nothing was asked or charged — lower the panel or the engines' }); return null; }
  // how many requests this run makes in all, and whether this execution can be its last (the database views, GA4, the crawler check and the
  // metrics run in the last one): an upper bound — the AI Overview is asked once per search phrase, so the real count can only be smaller
  const engNow = s.settings.engines.filter(e => full_due || !CONFIG.monthly_engines.includes(e));
  const reqTotal = (prompts.filter(q => q.kind !== 'brand').length + need) * engNow.length + (full_due ? engNow.filter(e => e !== 'copilot' && e !== 'ai_overview').length : 0);
  const reqLeft = Math.max(0, reqTotal - doneKeys.length);
  // F2 (E1): the run's hard money ceiling (fixed at its start) and what is left under it
  const ceiling = going && Number(st.ceiling_dfs_usd) > 0 ? Number(st.ceiling_dfs_usd) : AIP.runCeiling(runCost.dfs);
  const committed = going ? Math.max(Number(st.spent_dfs_usd) || 0, Number(st.committed_dfs_usd) || 0) : 0;
  let stop = null;
  if (going && (legacyShort || (lostNow.length && (lostParts >= 1 || st.save_failed))))
    stop = { status: 'failed_store', lost: legacyShort ? Math.max(0, Number(st.asked) - storedKeys.size) : lostNow.length,
      reason: (legacyShort ? (Number(st.asked) - storedKeys.size) + ' of the ' + st.asked + ' requests its earlier parts asked have no stored answer' : lostNow.length + ' request(s) of part ' + ((st.pending || {}).chunk || st.chunk) + ' were paid for but their answers were never stored, and this has happened before in this run')
        + '. They are not asked again (that would pay twice); the run is stopped, and nothing more is asked for this website this week. Check the Data Table size and the execution of the part named in the state row, then clear ai_run:' + s.site_id + ' to let a new run start.' };
  else if (going && reqLeft > 0 && committed >= ceiling)
    stop = { status: 'stopped_ceiling', lost: 0, reason: 'the run has spent or committed $' + committed.toFixed(2) + ' of DataForSEO against its ceiling of $' + ceiling.toFixed(2) + ' (1.5 x its own estimate) with ' + reqLeft + ' request(s) still to ask. Nothing more is asked; check the prices in the run\'s ledger rows before clearing ai_run:' + s.site_id + '.' };
  const halve = !stop && (lostNow.length > 0 || !!(going && st.halve_next));
  // F2 (E11): the part sized by TIME (the run's measured seconds per request once a part has measured them), and the analyst jobs it leaves room for
  const aj = Math.min(12, Math.max(6, Math.ceil((Number(costNow.analyst_jobs) || 0) / Math.max(1, Number(costNow.executions) || 1))));
  const cp = AIP.chunkPlan({ engines: engNow, measured_s: going ? Number(st.sec_per_request) || 0 : 0, analyst_jobs: aj, halve });
  const chunk = { no: going ? (Number(st.chunk) || 1) + 1 : 1, size: cp.size, size_time: cp.size, sec_per_request: cp.sec_per_request, size_basis: cp.basis, analyst_jobs_max: aj, going, resumed: verdict === 'resume', final_expected: reqLeft <= cp.size,
    ceiling_dfs_usd: ceiling, committed_dfs_usd: +committed.toFixed(4), ceiling_left_usd: +Math.max(0, ceiling - committed).toFixed(4),
    // F2 (E1): the keys a part paid for whose answers never came back to the table (counted once, never asked again) and the parts that lost them
    lost_now: stop ? 0 : lostNow.length, lost_total: (going ? Number(st.lost) || 0 : 0) + (stop ? 0 : lostNow.length), lost_parts: lostParts + (!stop && lostNow.length ? 1 : 0),
    unanalysed: going && st.pending && !lostNow.length && pendingKeys.size ? pendingKeys.size : 0,
    total_est: reqTotal, done: doneKeys.length, executions: (going && Array.isArray(st.executions)) ? st.executions : [], started_at: run_checked_at,
    // what earlier parts asked and could not be read even when sent again: not asked a third time, named in the week's report
    unavailable: going ? runRows.filter(r => r.run_id === run_id && r.error).length : 0 };
  if (chunk.unavailable) chunk.unavailable_note = chunk.unavailable + ' request(s) of this run could not be read in its earlier part(s), even when sent again; they are not asked again and the week counts the answers that came back';
  if (chunk.lost_total) chunk.lost_note = chunk.lost_total + ' request(s) of this run were paid for in a part that stopped before its answers were stored (the execution\'s time limit, a restart); they are not asked again (that would pay twice) and the week counts the answers that were stored';
  if (chunk.unanalysed) chunk.unanalysed_note = chunk.unanalysed + ' answer(s) of this run were stored by a part that stopped before the Answer Analyst read them; they keep the parser\'s reading (the businesses named in order by text position, no sentiment, no wrong-claim check)';
  if (stop) { Object.assign(chunk, { size: 0, size_time: 0, final_expected: null, stop: true }); }   // F2: nothing is asked; the ledger key is the job's own (null is not a part)
  // pages that must stay fetchable for AI: the ones AI cited last time and the keyword-ladder pages (checked against robots.txt per AI bot)
  const pathOf = (u) => { const m = String(u || '').match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i); return m ? (m[1] || '/') : (String(u || '').startsWith('/') ? String(u) : ''); };
  const key_paths = [...new Set([...(prev ? (parse(prev.pages_json, []) || []).map(x => pathOf(x && x.url)) : []), ...lrows.map(l => pathOf(l.target_url))].filter(x => x && x !== '/'))].slice(0, 8);
  return { json: { site_id: s.site_id, domain: s.domain,
    // G6: the split run (chunk, what is done, what is left to spend), the markets and personas the panel covers, the cost model of this panel
    chunk, done_keys: doneKeys, markets, markets_map, own_market: ownMarket, personas, pulse_mode: s.settings.pulse_mode, pulse_per_week: s.settings.pulse_per_week,
    est_dfs_usd: stop ? 0 : +Math.min(Math.max(0, runCost.dfs - spent.dfs), Math.max(0, ceiling - committed)).toFixed(4), est_ai_usd: stop ? 0 : +Math.max(0, runCost.ai - spent.ai).toFixed(4), run_cost_est: runCost, cost_model: costNow,
    // F2 (E1): a stopped run asks nothing; AI Chunk Handoff writes its state, the ops alert and the notice to its own caller
    stop, ceiling_dfs_usd: ceiling,
    spent_before: spent, state_before: going ? st : null, canonical_host: site_model.canonical_host || s.domain, country: s.country || '', location_code, language_code: s.language_code || 'en', country_iso: isoOf(location_code),
    // F2 (E17): a run that continues keeps ITS caller (the request id, e-mail and callback it was started with); a different on-demand caller
    // that resumed it was told so at once (notices) and never takes the open run's report
    email: going ? String(st.email || '') : (s.email || ''), callback_url: going ? String(st.callback_url || '') : (s.callback_url || ''),
    request_id: going ? String(st.request_id || '') : (s.request_id || ''), on_demand: going ? !!st.on_demand : on_demand, adhoc: !!s.adhoc,   /* G6: a continuation is the run it continues (scheduled or on demand) */ business_name: s.business_name || ''   /* P34-6: the site model's name (monitorSites nameOf), not seo_profiles alone */, business_type: s.profile.business_type || '', city: s.profile.city || '', profile: s.profile,
    // G10 (2026-10-11 system review): the Answer Analyst can only call a claim wrong against facts on file, so the site model's
    // services, business facts and accreditation status travel with the profile (SITE_MODEL_SPEC.md; with no sheet the analyst
    // reports "not checked", never "no wrong claims")
    services: SM.services(site_model).slice(0, 20), business_facts: SM.facts(site_model).business_facts, accreditation: SM.facts(site_model).accreditation,
    brand_names, competitors, configured_competitors: s.settings.competitors, aliases, topics, engines: s.settings.engines, prompts_max: s.settings.prompts_max, pulse: s.settings.pulse,
    prompts: stop ? [] : prompts, full_due, run_kind: runKind, monthly_engines: CONFIG.monthly_engines.filter(e => s.settings.engines.includes(e)), carried,
    need_prompts: !stop && need > 0, prompts_needed: stop ? 0 : need, need_site_text: !stop && need > 0 && !topics.length && !s.business_name, gsc_questions,
    // G6: discovery runs in a run's first execution (it feeds the Prompt Writer); the database views, GA4 and the crawler check in its last
    discovery_due: !going && !!topics.length && (full_due || need > 0), volume_keywords: going ? [] : volume_keywords, index_due: full_due,
    market_due: !!topics.length && (runCycle ? (going ? !!st.full_due : cycle.monthly) : (!prev || String(prev.market_month || '') !== month)), market_keyword: topics[0] || '',
    ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, '').trim(), pulse_rows, key_paths,
    // B-G1: what the gate refused, with its reason, so the report names it instead of printing a shorter list (INVARIANTS rule 1)
    set_aside, set_aside_note: FITR.line(set_aside, 'asked of the AI engines or scored against'),
    // G6: the gate's context, so the questions the Prompt Writer writes this run are judged by the same rule before they are stored
    fit_input,
    previous: prev ? { checked_at: prev.checked_at, mention_rate: prevMention, samples: prevSamples, mentioned_k: Math.round(prevMention * prevSamples / 100),
      // B-L4 (2026-10-15, INVARIANTS rule 1): the panel is settable from 3 to 50 and a weekly check asks fewer engines than the
      // monthly full one, so the stored row's OWN panel size and run kind travel with its figures. Without them AI Metrics
      // subtracted a 20-question run from an 8-question one and called the difference a change in visibility.
      prompts: Number(prev.prompts) || 0, run_kind: String(prev.run_kind || ''), citation_rate: Number(prev.citation_rate), share_of_voice: Number(prev.share_of_voice), avg_rank: Number(prev.avg_rank),
      visibility_score: prev.visibility_score === '' || prev.visibility_score == null ? null : Number(prev.visibility_score), sentiment_score: prev.sentiment_score === '' || prev.sentiment_score == null ? null : Number(prev.sentiment_score),
      engines: parse(prev.engines_json, {}), market_month: prev.market_month || '', market: parse(prev.market_json, null), index: parse(prev.index_json, null), perception: parse(prev.perception_json, null), traffic: parse(prev.traffic_json, null), access: parse(prev.access_json, null),
      competitors: parse(prev.competitors_json, []),
      // G6: the panel that row asked (its question ids: a delta needs 80% of them in common) and its segments (each segment's change is tested against them)
      panel: parse(prev.panel_json, null), segments: (() => { const x = parse(prev.segments_json, null); if (!x || !Array.isArray(x.rows)) return null;
        return { rows: x.rows.map(r => Array.isArray(r) ? { dim: r[0], key: r[1], questions: r[2], n: r[3], k: r[4] } : r) }; })() } : null,
    run_id, checked_at: run_checked_at, cycle: runCycle } };
}).filter(Boolean);
// G6: one execution carries at most exec_requests engine requests across all its sites (a scheduled run covers up to 15). The budget goes
// to the sites in order; a site whose run does not fit is asked in part and continues in its own execution. Only the LAST execution of a
// site's run asks the database views, reads GA4 and the crawler access and computes the week, so those wait for it.
// F2 (E11): and at most what fits the execution's TIME across its sites (each part's own seconds per request, the analyst jobs of every site)
{ let budget = AIP.LIMITS.exec_requests;
  let secs = AIP.TIME.budget_s - AIP.TIME.fixed_s - AIP.TIME.retry_wait_s - Math.min(36, planned.reduce((t, it) => t + (it.json.chunk.stop ? 0 : it.json.chunk.analyst_jobs_max || 0), 0)) * AIP.TIME.analyst_job_s;
  for (const it of planned) { const j = it.json, c = j.chunk; const left = Math.max(0, c.total_est - c.done);
    if (c.stop) { j.index_due = false; j.market_due = false; j.ga4_property_id = ''; j.key_paths = []; j.discovery_due = false; j.volume_keywords = []; continue; }
    const byTime = Math.max(planned.length > 1 ? 0 : AIP.TIME.min_requests, Math.floor(Math.max(0, secs) / Math.max(0.5, c.sec_per_request || 1)));
    c.size = Math.max(0, Math.min(c.size_time || AIP.LIMITS.chunk_requests, budget, byTime)); c.final_expected = left <= c.size; budget -= Math.min(left, c.size); secs -= Math.min(left, c.size) * (c.sec_per_request || 1);
    if (!c.final_expected) { j.index_due = false; j.market_due = false; j.ga4_property_id = ''; j.key_paths = []; } } }
if (!planned.length) return [{ json: { nothing_to_do: true, reason: skipped.map(x => x.domain + ': ' + x.why).join(' | ') || 'nothing to do', skipped, notices } }];
if (skipped.length) planned[0].json.skipped_sites = skipped;
if (notices.length) planned[0].json.notices = notices;
return planned;
