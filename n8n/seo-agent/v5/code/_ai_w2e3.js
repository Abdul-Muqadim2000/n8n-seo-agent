// ---- W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2-§5, MARKET_RND.md §3.1 gaps 4 / 5 / 7 / 9 / 10) -----------------
// Coverage and demand at the leaders' level, for the AI Visibility Tracker (inlined by build_monitors.py after AIP, SC and AIE; pure functions,
// the harness runs them):
//  1. FAN-OUT RANKING GAP (`ai_fanout_check` N, default 0 = off): the searches the engines ran before answering, deduplicated, the N most
//     frequent checked on Google's top 10 (one results-page reading per search and day, shared with every other path through SC), joined to
//     the site's Search Console queries; per search: how often, which engines, our rank and page, the page that should rank (page inventory),
//     the domains that do, and whether an answer that ran it cited us. "We rank #1-3 but are not cited" is flagged on its own.
//  2. PERSONA EFFECT (`ai_persona_context`, API answers only): the same questions asked of the ChatGPT API with each buyer role as the
//     asker's context and once without (one shared control), named rate per role against the control, two-proportion tested, pooled over the
//     last 28 days of stored runs. Kept out of every headline: it is labelled "API answers".
//  3. DEMAND AS A RANGE: per question, every proxy we hold with its source and date (AI keyword volume, the AI-answer database's question
//     volume, Search Console impressions of matching question queries, the owner's uploaded AI reports), and the low / high they span; the
//     monthly market trend (LLM Mentions historical / timeseries_new_lost / top_mentioned_brands) when `ai_demand_market` is on. The ChatGPT
//     part of the database is US-English only, and every figure from it says so for any other market.
//  4. THE OWNER'S AI REPORTS (seo_ai_imports, written by the app): Bing Webmaster "AI Performance" and Search Console's AI Mode / AI
//     Overview exports, summarised for the period; a Bing file is the Copilot figure's ground truth.
//  5. The run's bookkeeping: its execution ids, its notes (lost / unanalysed answers, questions asked outside their market) and each
//     question's asked state (last run, last time, times asked in 28 days, the run whose gate refused it).
// Nothing here is called unless its option is on or its data is present; with every option off the run asks and costs exactly what it did.
const AIX = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const nn = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const tb = (v) => v === true || S(v).toLowerCase() === 'true';
  const parse = (t, d) => { if (t && typeof t === 'object') return t; try { const v = JSON.parse(S(t) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const r4 = (x) => Math.round(x * 10000) / 10000; const r1 = (x) => Math.round(x * 10) / 10;
  const pct = (a, b) => (b ? r1(100 * a / b) : null);
  const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n sandbox
  const pathOf = (u) => { const m = S(u).match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i); return m ? (m[1] || '/') : ''; };
  const isOurs = (host, domain) => { const h = normD(host), d = normD(domain); return !!h && !!d && (h === d || h.endsWith('.' + d)); };
  const cleanUrl = (u) => S(u).replace(/#.*$/, '').replace(/[?&](utm_[a-z]+|gclid|fbclid|srsltid)=[^&]*/gi, '').replace(/\?$/, '');
  const API = 'https://api.dataforseo.com/v3/';
  const day = (iso) => S(iso).slice(0, 10);
  const daysBetween = (a, b) => (Date.parse(day(b) + 'T00:00:00Z') - Date.parse(day(a) + 'T00:00:00Z')) / 864e5;
  const usEn = (plan) => Number(plan.location_code) === 2840 && S(plan.language_code || 'en').toLowerCase() === 'en';
  const US_NOTE = 'the AI-answer database holds ChatGPT answers for US-English only';

  // ---- 0. the options a site set (from monitorSites' settings) ---------------------------------------------------------------------------
  const optionsOf = (settings) => { const s = settings || {};
    return { claude_weekly: !!s.claude_weekly, pulse_engines: S(s.pulse_engines_raw), persona_context: !!s.persona_context, personas: (s.personas || []).length,
      fanout_check: Math.max(0, Math.min(AIP.FANOUT_MAX, Math.round(n0(s.fanout_check)))), demand_market: !!s.demand_market }; };

  // ---- 1. the fan-out ranking gap ------------------------------------------------------------------------------------------------------
  /** the searches one answer row ran: W2-E1's fanout_json (every query) when present, else the stored `fanout` (' | ' joined, first six) */
  const fanoutOf = (r) => { const j = parse(r && r.fanout_json, null); if (Array.isArray(j)) return j.map(x => S(typeof x === 'object' && x ? x.query : x)).filter(Boolean);
    return S(r && r.fanout).split(' | ').map(S).filter(Boolean); };
  const normQuery = (q) => { let s = S(q); try { s = s.normalize('NFKC'); } catch (e) {} return s.toLowerCase().replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim(); };
  /** did this answer cite the site (a boolean, or a URL since W2-E1, or our_urls) */
  const citedRow = (r) => { const c = r && r.cited; return c === true || S(c).toLowerCase() === 'true' || /^https?:\/\//i.test(S(c)) || !!S(r && r.our_urls); };
  /** the run's fan-out searches, deduplicated, most frequent first: [{ query, key, freq, engines, prompts, answers, cited_n }] */
  const fanoutTop = (rows, n) => { const m = new Map();
    for (const r of (rows || [])) { if (!r || !tb(r.answered)) continue; const seen = new Set();
      for (const f of fanoutOf(r)) { const k = normQuery(f); if (!k || k.length < 3 || seen.has(k)) continue; seen.add(k);
        const x = m.get(k) || { query: S(f).replace(/\s+/g, ' ').slice(0, 300), key: k, freq: 0, engines: new Set(), prompts: new Set(), cited_n: 0 };
        x.freq++; x.engines.add(S(r.engine)); x.prompts.add(S(r.prompt_id)); if (citedRow(r)) x.cited_n++; m.set(k, x); } }
    const all = [...m.values()].sort((a, b) => b.freq - a.freq || b.engines.size - a.engines.size || a.key.localeCompare(b.key));
    return { distinct: all.length, top: all.slice(0, Math.max(0, n)).map(x => ({ query: x.query, key: x.key, freq: x.freq, engines: [...x.engines].sort(), prompts: [...x.prompts].slice(0, 5), cited_n: x.cited_n })) }; };
  const serpBody = (plan, q) => ({ keyword: S(q).slice(0, 700), location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en') || 'en', depth: 10 });
  /** the requests a fan-out check still needs (a reading of today, deep enough, is used for nothing) and the readings it reuses */
  const fanoutRequests = (plan, top, serpRows, nowIso) => { const requests = [], hits = {};
    for (const q of (top || [])) { const body = serpBody(plan, q.query); const lk = SC.lookup(serpRows || [], body, { now: nowIso });
      if (lk.hit) { hits[q.key] = lk.response; continue; }
      requests.push({ site_id: plan.site_id, domain: plan.domain, kind: 'fanout', key: q.key, query: q.query, endpoint: API + 'serp/google/organic/live/advanced', body: [body], est_cost: AIP.XPRICE.fanout_serp }); }
    return { requests, hits }; };
  const stemsOf = (t) => AIP.stems(t);
  /** the page of the site that should rank for a search: the inventory page whose address and title share most content words with it */
  const targetPage = (query, pages, domain) => { const qs = stemsOf(query); if (!qs.length) return null; let best = null, bs = 0;
    for (const p of (pages || [])) { if (!p || !p.url || !isOurs(hostOf(p.url), domain)) continue; if (Number(p.http_status) >= 400) continue;
      const ps = stemsOf(pathOf(p.url).replace(/[\/_-]+/g, ' ') + ' ' + S(p.title) + ' ' + S(p.h1)); const A = new Set(ps); let hit = 0; for (const w of qs) if (A.has(w)) hit++;
      const sc = hit / qs.length; if (sc > bs) { bs = sc; best = p.url; } }
    return bs >= 0.34 ? cleanUrl(best) : null; };
  /** the site's Search Console row for a search: the exact query, else the closest one sharing 75% of its content words */
  const gscOf = (query, qrows) => { const k = normQuery(query); let exact = null, best = null, bs = 0; const qs = stemsOf(query);
    for (const r of (qrows || [])) { const rk = normQuery(r.query); if (!rk) continue; if (rk === k) { exact = r; break; } const j = AIP.jaccard(qs, stemsOf(r.query)); if (j > bs) { bs = j; best = r; } }
    const r = exact || (bs >= 0.75 ? best : null); return r ? { query: S(r.query), impressions: n0(r.impressions), clicks: n0(r.clicks), position: nn(r.position), match: exact ? 'exact' : 'close', as_of: day(r.period_end || r.checked_at) } : null; };
  const task0 = (r) => (((r || {}).tasks || [])[0]) || {};
  /** -> fanout_gap_json. `answers` = { key: response } for every search read (fresh or from the shared reading) */
  const fanoutGap = (o) => { const x = o || {}, plan = x.plan || {}, top = x.top || { top: [], distinct: 0 };
    const latestQ = new Map(); for (const r of (x.queries || [])) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.query) continue; const k = normQuery(r.query); const old = latestQ.get(k); if (!old || S(r.checked_at) > S(old.checked_at)) latestQ.set(k, r); }
    const qrows = [...latestQ.values()];
    const queries = top.top.map(q => { const res = (x.answers || {})[q.key] || null; const t = task0(res); const st = SC.status(res);
      const base = { query: q.query, freq: q.freq, engines: q.engines, our_rank: null, our_url: null, target_url: targetPage(q.query, x.pages, plan.domain), top_domains: [], cited: q.cited_n > 0, cited_n: q.cited_n,
        gsc: gscOf(q.query, qrows), read: !res ? 'not asked' : st === 'failed' ? 'not read' : (res.serp_cache && res.serp_cache.hit ? 'reading of today (' + S(res.serp_cache.text) + ')' : 'read now') };
      if (!res || st === 'failed') return { ...base, flag: 'not_read', note: !res ? 'not checked (the run\'s money ceiling or no request)' : 'Google\'s results page could not be read: ' + S(t.status_message || (res.error && (res.error.message || res.error)) || 'no answer').slice(0, 120) };
      const items = (((t.result || [])[0] || {}).items || []).filter(i => i && i.type === 'organic').sort((a, b) => n0(a.rank_group) - n0(b.rank_group));
      const ours = items.find(i => isOurs(hostOf(i.url) || i.domain, plan.domain));
      const our_rank = ours ? n0(ours.rank_group) || null : null;
      const flag = our_rank && our_rank <= 3 && !base.cited ? 'ranks_not_cited' : base.cited ? 'cited' : our_rank ? 'ranks' : 'not_in_top10';
      return { ...base, our_rank, our_url: ours ? cleanUrl(ours.url) : null, top_domains: [...new Set(items.map(i => normD(i.domain || hostOf(i.url))).filter(Boolean))].slice(0, 5), flag }; });
    const read = queries.filter(q => q.flag !== 'not_read');
    return { queries, checked_n: read.length, distinct_n: top.distinct, top_n: top.top.length, setting: n0(x.setting), cost_usd: r4(n0(x.cost_usd)),
      from_reading_today_n: queries.filter(q => /^reading of today/.test(q.read)).length, not_read_n: queries.length - read.length,
      ranks_not_cited: queries.filter(q => q.flag === 'ranks_not_cited').map(q => q.query), not_in_top10_n: read.filter(q => q.our_rank == null).length,
      location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en'), as_of: day(x.now || new Date().toISOString()),
      method: 'the ' + top.top.length + ' most frequent of the ' + top.distinct + ' distinct searches the engines ran before answering this run\'s questions, each checked on Google\'s top 10 (desktop, the site\'s market); "cited" = an answer that ran the search cited one of your pages; a results page read earlier today is reused, never paid twice' }; };

  // ---- 2. the persona effect (API answers) --------------------------------------------------------------------------------------------
  const PERSONA_MODEL = 'gpt-5.4-mini';
  const personaMessage = (role, plan) => 'The person asking you is a ' + S(role) + (S(plan.country) ? ' at a business in ' + S(plan.country) : '') + '. Answer their question as you would answer that person.';
  /** the sub-panel: the same questions for every role (so one control arm serves them all), spread over the panel's topics, in a stable order */
  const personaQuestions = (plan) => { const qs = (plan.prompts || []).filter(q => q && q.kind !== 'brand' && q.prompt);
    const by = new Map(); for (const q of qs) { const k = S(q.cluster || q.topic).toLowerCase() || 'other'; if (!by.has(k)) by.set(k, []); by.get(k).push(q); }
    for (const v of by.values()) v.sort((a, b) => (AIP.hash(a.prompt_id) - AIP.hash(b.prompt_id)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
    const keys = [...by.keys()].sort(); const out = []; let i = 0;
    while (out.length < Math.min(AIP.PERSONA.questions, qs.length)) { const k = keys[i % keys.length]; const v = by.get(k); if (v.length) out.push(v.shift()); i++; if (i > qs.length * 4 + keys.length) break; }
    return out; };
  const personaRequests = (plan, settings) => { const roles = (settings.personas || []).slice(0, AIP.PERSONA.max_roles); if (!settings.persona_context || !roles.length) return [];
    const geo = /^[A-Z]{2}$/.test(S(plan.country_iso).toUpperCase()) ? { web_search_country_iso_code: S(plan.country_iso).toUpperCase() } : {};
    const out = []; const qs = personaQuestions(plan);
    for (const q of qs) for (const role of ['', ...roles]) {
      const body = { user_prompt: q.prompt, model_name: PERSONA_MODEL, web_search: true, max_output_tokens: 1200, ...geo, ...(role ? { system_message: personaMessage(role, plan) } : {}) };
      out.push({ site_id: plan.site_id, domain: plan.domain, kind: 'persona', role: role || '', arm: role ? 'with' : 'without', prompt_id: q.prompt_id, prompt: q.prompt, endpoint: API + 'ai_optimization/chat_gpt/llm_responses/live', body: [body], est_cost: AIP.XPRICE.persona }); }
    return out; };
  /** an LLM Responses answer -> { answered, text, cites } (the parser's own reading of that shape) */
  const llmText = (res) => { const t = task0(res); const r0 = ((t.result || [])[0]) || null; if (!res || res.error || t.status_code !== 20000 || !r0) return { answered: false, text: '', cites: [], error: S(t.status_message || (res && res.error && (res.error.message || res.error)) || 'no answer').slice(0, 160) };
    const secs = (r0.items || []).flatMap(it => it.sections || []); const text = secs.map(s => s.text || '').join('');
    const cites = secs.flatMap(s => s.annotations || []).map(a => ({ url: a.url || '', title: a.title || '', host: hostOf(a.url) }));
    return { answered: !!text, text, cites, error: '' }; };
  /** two proportions: z of (k1/n1 - k2/n2) on the pooled rate; null when either side has no answers */
  const twoProp = (k1, n1, k2, n2) => { if (!n1 || !n2) return null; const p = (k1 + k2) / (n1 + n2); const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); if (!se) return 0; return Math.round(100 * ((k1 / n1 - k2 / n2) / se)) / 100; };
  const MIN = 12;
  const verdictOf = (w, c) => { if (w.n < MIN || c.n < MIN) return { verdict: 'too few answers', z: null, delta: w.n && c.n ? r1(100 * (w.k / w.n - c.k / c.n)) : null };
    const z = twoProp(w.k, w.n, c.k, c.n); const delta = r1(100 * (w.k / w.n - c.k / c.n));
    return { z, delta, verdict: z != null && Math.abs(z) >= 1.96 ? (delta > 0 ? 'named more often with this role' : 'named less often with this role') : 'no measurable difference' }; };
  /** -> the persona block. `pairs` = [{ q: request item, r: response }]; `read` = (text, cites) -> { named, cited } (AIE over the site's names) */
  const personaEffect = (o) => { const x = o || {}; const pairs = x.pairs || []; if (!pairs.length) return null;
    const cnt = () => ({ n: 0, k: 0, c: 0, failed: 0 }); const control = cnt(); const by = new Map();
    for (const { q, r } of pairs) { const a = llmText(r); const box = q.arm === 'without' ? control : (by.get(q.role) || by.set(q.role, cnt()).get(q.role));
      if (!a.answered) { box.failed++; continue; } const v = x.read(a.text, a.cites); box.n++; if (v.named) box.k++; if (v.cited) box.c++; }
    // pooled over the stored runs of the last 28 days (notes_json.persona of earlier rows): one run gives 12 answers a side, four give 48
    const prev = (x.previous || []).filter(p => p && p.persona && daysBetween(p.checked_at, x.now) <= 28 && daysBetween(p.checked_at, x.now) > 0);
    const roles = [...by.entries()].map(([role, w]) => { const v = verdictOf(w, control);
      const pool = prev.reduce((t, p) => { const pr = (p.persona.roles || []).find(rr => S(rr.role) === S(role)); const pc = p.persona.control || {};
        if (!pr) return t; return { n: t.n + n0(pr.n), k: t.k + n0(pr.k), cn: t.cn + n0(pc.n), ck: t.ck + n0(pc.k), runs: t.runs + 1 }; }, { n: w.n, k: w.k, cn: control.n, ck: control.k, runs: 1 });
      const pv = verdictOf({ n: pool.n, k: pool.k }, { n: pool.cn, k: pool.ck });
      return { role, n: w.n, k: w.k, c: w.c, failed: w.failed, rate: pct(w.k, w.n), control_rate: pct(control.k, control.n), delta: v.delta, z: v.z, verdict: v.verdict,
        pooled: { runs: pool.runs, n: pool.n, k: pool.k, control_n: pool.cn, control_k: pool.ck, rate: pct(pool.k, pool.n), control_rate: pct(pool.ck, pool.cn), delta: pv.delta, z: pv.z, verdict: pv.verdict } }; });
    return { label: 'API answers', engine: 'chatgpt_api', model: PERSONA_MODEL, questions: [...new Set(pairs.map(p => p.q.prompt_id))].length, control: { n: control.n, k: control.k, c: control.c, failed: control.failed, rate: pct(control.k, control.n) }, roles,
      method: 'the same questions asked of the ChatGPT API (web search on) with the buyer role sent as the asker\'s context, and once without it; "named" rates compared with a two-proportion z-test (|z| >= 1.96), per run and pooled over the stored runs of the last 28 days; under ' + MIN + ' answers a side: "too few answers". API answers are not what the chatgpt.com interface shows and are kept out of every headline figure',
      as_of: day(x.now) }; };

  // ---- 3. demand as a range, and the monthly market trend --------------------------------------------------------------------------------
  const platformOf = (plan) => (usEn(plan) ? 'chat_gpt' : 'google');
  const monthStart = (iso, back) => { const d = new Date(day(iso) + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); return d.toISOString().slice(0, 10); };
  const demandRequests = (plan, settings, nowIso) => { if (!settings.demand_market || !plan.full_due) return [];
    const loc = { location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en') || 'en' }; const platform = platformOf(plan);
    const topic = S(plan.market_keyword || (plan.topics || [])[0]);
    const out = [
      { kind: 'demand', what: 'historical', endpoint: API + 'ai_optimization/llm_mentions/historical/live', body: [{ target: [{ domain: plan.domain }], ...loc, platform }] },
      { kind: 'demand', what: 'new_lost', endpoint: API + 'ai_optimization/llm_mentions/timeseries_new_lost/live', body: [{ target: [{ domain: plan.domain }], ...loc, platform, date_from: monthStart(nowIso, 6), date_to: day(nowIso), group_range: 'month' }] } ];
    if (topic) out.push({ kind: 'demand', what: 'top_brands', topic, endpoint: API + 'ai_optimization/llm_mentions/top_mentioned_brands/live', body: [{ target: [{ keyword: topic.slice(0, 250), search_scope: ['answer'] }], ...loc, platform, limit: 10 }] });
    return out.map(r => ({ site_id: plan.site_id, domain: plan.domain, platform, est_cost: AIP.XPRICE.demand_task, ...r })); };
  const marketOf = (plan, pairs, nowIso) => { if (!(pairs || []).length) return null; const platform = platformOf(plan); const out = { platform, location_code: Number(plan.location_code) || 2840, language_code: S(plan.language_code || 'en'), as_of: day(nowIso), historical: [], new_lost: [], top_brands: [], errors: [] };
    for (const { q, r } of pairs) { const t = task0(r); const r0 = ((t.result || [])[0]) || {};
      if (!r || r.error || t.status_code !== 20000) { out.errors.push(q.what + ': ' + S(t.status_message || (r && r.error && (r.error.message || r.error)) || 'no answer').slice(0, 120)); continue; }
      const items = r0.items || [];
      if (q.what === 'historical') out.historical = items.map(i => ({ month: S(i.year) + '-' + S(i.month).padStart(2, '0'), mentions: n0((i.metrics || {}).mentions), ai_search_volume: n0((i.metrics || {}).ai_search_volume) })).sort((a, b) => a.month.localeCompare(b.month));
      if (q.what === 'new_lost') out.new_lost = items.map(i => ({ date: S(i.date), new_mentions: n0(i.new_mentions), lost_mentions: n0(i.lost_mentions), new_ai_search_volume: n0(i.new_ai_search_volume), lost_ai_search_volume: n0(i.lost_ai_search_volume) })).sort((a, b) => a.date.localeCompare(b.date));
      if (q.what === 'top_brands') { out.topic = q.topic; out.top_brands = items.slice(0, 10).map(i => ({ brand: S(i.brand), mentions: n0((i.total || {}).mentions), ai_search_volume: n0((i.total || {}).ai_search_volume) })); } }
    out.note = platform === 'chat_gpt' ? 'ChatGPT answers in the AI-answer database (US-English)' : 'Google AI Overview answers in this market; ' + US_NOTE + ', so no ChatGPT figure is shown for it';
    return out; };
  /** the question-shaped LLM Mentions items this run read (discovery / "questions citing you"): [{ question, volume, platform, as_of }] */
  const mentionItems = (pairs, nowIso) => { const out = [];
    for (const { q, r } of (pairs || [])) { const t = task0(r); if (t.status_code !== 20000) continue;
      for (const it of ((((t.result || [])[0]) || {}).items || [])) if (it && it.question) out.push({ question: S(it.question).slice(0, 300), volume: nn(it.ai_search_volume), platform: S(it.platform || q.platform || ''), as_of: day(nowIso) }); }
    return out; };
  const importRows = (rows, plan, fromIso, toIso) => (rows || []).filter(r => r && S(r.site_id) === S(plan.site_id) && day(r.day) >= day(fromIso) && day(r.day) <= day(toIso));
  /** -> demand_json. Every proxy names its source and date; lo / hi span the proxies a question has (none = no range, never 0). */
  const demand = (o) => { const x = o || {}, plan = x.plan || {}; const now = x.now || new Date().toISOString();
    const qs = (plan.prompts || []).filter(q => q && q.kind !== 'brand' && q.prompt);
    const fresh = new Map((x.fresh || []).filter(r => r && r.prompt_id).map(r => [S(r.prompt_id), r]));
    const stored = new Map((x.stored || []).filter(r => r && r.prompt_id).map(r => [S(r.prompt_id), r]));
    const latestQ = new Map(); for (const r of (x.queries || [])) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.query) continue; const k = normQuery(r.query); const old = latestQ.get(k); if (!old || S(r.checked_at) > S(old.checked_at)) latestQ.set(k, r); }
    const gq = [...latestQ.values()].map(r => ({ r, s: stemsOf(r.query) }));
    const imp = importRows(x.imports, plan, new Date(Date.parse(now) - 28 * 864e5).toISOString(), now).filter(r => S(r.query));
    const impQ = imp.map(r => ({ r, s: stemsOf(r.query) }));
    const mi = (x.mentions || []).map(m => ({ m, s: stemsOf(m.question) }));
    const notUS = !usEn(plan);
    const out = [];
    for (const q of qs) { const s = stemsOf(q.prompt), kws = stemsOf(q.keyword || ''); const proxies = [];
      const row = fresh.get(S(q.prompt_id)) || stored.get(S(q.prompt_id)) || {};
      const vol = q.volume != null ? q.volume : nn(row.volume);
      if (vol != null) proxies.push({ source: 'ai_keyword_volume', value: Math.round(vol), as_of: day(row.updated_at || row.created_at || now) || day(now), note: 'AI searches a month for "' + S(q.keyword || row.keyword).slice(0, 60) + '" (DataForSEO, from People also ask)' });
      let bm = null, bj = 0; for (const it of mi) { const j = AIP.jaccard(s, it.s); if (j > bj) { bj = j; bm = it.m; } }
      if (bm && bj >= 0.6 && bm.volume != null) proxies.push({ source: 'llm_mentions_question', value: Math.round(bm.volume), as_of: bm.as_of, note: (bm.platform === 'chat_gpt' ? 'ChatGPT (US-English)' : 'Google AI Overview') + ' question "' + bm.question.slice(0, 60) + '"' + (bm.platform !== 'chat_gpt' && notUS ? '; ' + US_NOTE : '') });
      const match = (cand) => cand.filter(c => AIP.jaccard(s, c.s) >= 0.6 || (kws.length >= 2 && kws.every(w => c.s.includes(w))));
      const gm = match(gq); if (gm.length) { const imps = gm.reduce((t, c) => t + n0(c.r.impressions), 0); const asOf = gm.map(c => day(c.r.period_end || c.r.checked_at)).sort().pop();
        proxies.push({ source: 'search_console_impressions', value: Math.round(imps * 30 / 28), as_of: asOf, note: gm.length + ' matching question quer' + (gm.length === 1 ? 'y' : 'ies') + ', Google Search, 28 days scaled to a month (only searches where you appeared)' }); }
      for (const src of ['gsc_ai', 'bing_ai']) { const im = match(impQ.filter(c => S(c.r.source) === src)); if (!im.length) continue; const v = im.reduce((t, c) => t + n0(c.r.impressions), 0); if (!(v > 0)) continue;
        proxies.push({ source: src === 'gsc_ai' ? 'search_console_ai_upload' : 'bing_ai_upload', value: Math.round(v * 30 / 28), as_of: im.map(c => day(c.r.day)).sort().pop(), note: (src === 'gsc_ai' ? 'Search Console AI Mode / AI Overview impressions' : 'Bing AI Performance impressions') + ' of ' + im.length + ' matching row(s), your upload, 28 days scaled to a month' }); }
      const vals = proxies.map(p => p.value).filter(v => Number.isFinite(v));
      if (proxies.length) out.push({ prompt_id: q.prompt_id, proxies, lo: vals.length ? Math.min(...vals) : null, hi: vals.length ? Math.max(...vals) : null }); }
    out.sort((a, b) => n0(b.hi) - n0(a.hi));
    const CAP = 200;
    return { questions: out.slice(0, CAP), questions_with_proxy: out.length, questions_total: qs.length, cut: out.length > CAP ? 'the ' + CAP + ' questions with the highest figure are kept' : '',
      market: x.market || null, market_carried: !!x.market_carried,
      note: 'Demand is shown as the range of the proxies each question has, each named with its source and date; no single "prompt volume" exists for AI answers. ' + (notUS ? 'For this market ' + US_NOTE + '. ' : '') + 'Search Console impressions are a floor: they count only the searches where the site appeared.',
      as_of: day(now) }; };

  // ---- 4. the owner's uploaded AI reports (seo_ai_imports, written by the app) -----------------------------------------------------------
  const imports = (rows, plan, nowIso) => { const now = nowIso || new Date().toISOString(); const from = new Date(Date.parse(now) - 28 * 864e5).toISOString();
    const mine = importRows(rows, plan, from, now); if (!mine.length) return null; const out = { period: { from: day(from), to: day(now) }, sources: {}, copilot: null };
    for (const src of ['bing_ai', 'gsc_ai']) { const rs = mine.filter(r => S(r.source) === src); if (!rs.length) continue;
      const sum = (k) => rs.reduce((t, r) => t + n0(r[k]), 0); const byUrl = new Map(), byQ = new Map();
      for (const r of rs) { const u = cleanUrl(r.url); if (u) { const a = byUrl.get(u) || { url: u, impressions: 0, citations: 0, clicks: 0 }; a.impressions += n0(r.impressions); a.citations += n0(r.citations); a.clicks += n0(r.clicks); byUrl.set(u, a); }
        const q = S(r.query); if (q) { const a = byQ.get(q) || { query: q.slice(0, 200), impressions: 0, citations: 0, clicks: 0 }; a.impressions += n0(r.impressions); a.citations += n0(r.citations); a.clicks += n0(r.clicks); byQ.set(q, a); } }
      const days = rs.map(r => day(r.day)).sort(); const files = [...new Set(rs.map(r => S(r.file_name)).filter(Boolean))].slice(0, 5); const at = rs.map(r => S(r.imported_at)).sort().pop() || '';
      const rank = (m) => [...m.values()].sort((a, b) => (b.citations - a.citations) || (b.impressions - a.impressions)).slice(0, 10);
      out.sources[src] = { rows: rs.length, days: { from: days[0], to: days[days.length - 1] }, impressions: sum('impressions'), citations: sum('citations'), clicks: sum('clicks'), urls_n: byUrl.size, queries_n: byQ.size,
        top_urls: rank(byUrl), top_queries: rank(byQ), files, imported_at: at }; }
    const b = out.sources.bing_ai;
    if (b) out.copilot = { source: 'bing_ai', citations: b.citations, impressions: b.impressions, urls_n: b.urls_n, as_of: b.days.to, label: 'from Bing Webmaster (your export of ' + (day(b.imported_at) || b.days.to) + ')',
      note: 'Bing\'s AI Performance report counts your citations across Copilot and Bing\'s AI answers; it replaces the Copilot figure read from Bing\'s results page, which shows its summary for few searches' };
    out.note = 'Your uploaded reports, ' + day(from) + ' to ' + day(now) + ': ' + Object.entries(out.sources).map(([k, v]) => (k === 'bing_ai' ? 'Bing AI Performance' : 'Search Console AI Mode / AI Overviews') + ' (' + v.rows + ' rows, ' + v.days.from + ' to ' + v.days.to + ')').join('; ');
    return out; };

  // ---- 5. the run's bookkeeping -----------------------------------------------------------------------------------------------------------
  const execIds = (plan, execId) => [...new Set([...(((plan.chunk || {}).executions) || []), S(execId)].map(S).filter(Boolean))].join(',');
  const notes = (plan, extra) => { const c = plan.chunk || {}; const e = extra || {};
    return { lost_note: S(c.lost_note), unanalysed_note: S(c.unanalysed_note), market_fallback_n: (plan.prompts || []).filter(q => q && q.market_fallback).length,
      ...(e.persona ? { persona: e.persona } : {}), ...(e.fanout_note ? { fanout_note: e.fanout_note } : {}), ...(e.ceiling_note ? { ceiling_note: e.ceiling_note } : {}) }; };
  /** each question's asked state (seo_ai_prompts: last_asked_run, last_asked_at, asked_n_28d, refused_at_run); only rows that change */
  const promptState = (o) => { const x = o || {}, plan = x.plan || {}; const now = x.now || new Date().toISOString(); const runAt = S(plan.checked_at || now);
    const asked = new Set((x.run_rows || []).filter(r => r && S(r.site_id) === S(plan.site_id) && S(r.run_id) === S(plan.run_id) && r.prompt_id).map(r => S(r.prompt_id)));
    const refused = new Set((plan.set_aside || []).filter(s => s && s.dropped && s.prompt_id).map(s => S(s.prompt_id)));
    const weekly = (x.vis_rows || []).filter(v => v && S(v.site_id) === S(plan.site_id) && S(v.run_id) !== S(plan.run_id) && daysBetween(v.checked_at, now) <= 28).map(v => new Set(((parse(v.panel_json, {}) || {}).ids || []).map(S)));
    const pulse = (x.daily_rows || []).filter(d => d && S(d.site_id) === S(plan.site_id) && daysBetween(d.checked_at || d.date, now) <= 28).map(d => new Set(Object.keys(parse(d.prompts_json, {}) || {})));
    const out = [];
    for (const r of (x.stored || [])) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.prompt_id) continue; const id = S(r.prompt_id);
      const was = { last_asked_run: S(r.last_asked_run), last_asked_at: S(r.last_asked_at), asked_n_28d: nn(r.asked_n_28d), refused_at_run: S(r.refused_at_run) };
      const now_ = { ...was };
      if (asked.has(id)) { now_.last_asked_run = S(plan.run_id); now_.last_asked_at = runAt; }
      if (refused.has(id)) now_.refused_at_run = S(plan.run_id);
      now_.asked_n_28d = (asked.has(id) ? 1 : 0) + weekly.filter(s => s.has(id)).length + pulse.filter(s => s.has(id)).length;
      if (now_.last_asked_run !== was.last_asked_run || now_.last_asked_at !== was.last_asked_at || now_.asked_n_28d !== was.asked_n_28d || now_.refused_at_run !== was.refused_at_run)
        out.push({ site_id: S(plan.site_id), prompt_id: id, ...now_ }); }
    return out; };

  // ---- 6. the report's sections and the callback's fields -------------------------------------------------------------------------------
  const FLAG = { ranks_not_cited: '<b style="color:#b45309">ranks top 3, not cited</b>', cited: 'cited', ranks: 'ranks, not cited', not_in_top10: 'not in the top 10', not_read: 'not read' };
  const reportHtml = (x, k) => { if (!x) return ''; const { h3, p_, table, esc, n } = k; let h = '';
    const F = x.fanout_gap; if (F && F.queries && F.queries.length) {
      h += h3('Do you rank for what AI searched?') + p_('The ' + F.top_n + ' most frequent of the ' + F.distinct_n + ' searches the assistants ran before answering, each checked on Google\'s top 10. A page that ranks for these is the page they read; "ranks top 3, not cited" means Google shows your page and the answer still cites someone else.' + (F.not_read_n ? ' ' + F.not_read_n + ' could not be read.' : ''), true)
        + table(['Search', 'Times', 'Engines', 'Your rank', 'Page that should rank', 'Who ranks', 'In answers'], F.queries.slice(0, 25).map(q => [esc(q.query), n(q.freq), esc(q.engines.join(', ')), q.our_rank ? '#' + q.our_rank + (q.our_url ? '<br><span style="font-size:11px">' + esc(pathOf(q.our_url)) + '</span>' : '') : (q.flag === 'not_read' ? 'not read' : 'not in top 10'),
          q.target_url ? esc(pathOf(q.target_url)) : '<span style="color:#94a3b8">no page yet</span>', esc((q.top_domains || []).slice(0, 3).join(', ')), FLAG[q.flag] || esc(q.flag)]));
      if ((F.ranks_not_cited || []).length) h += p_('Ranks in Google\'s top 3 but the answers that searched it did not cite you: ' + F.ranks_not_cited.slice(0, 6).map(esc).join('; ') + '. The page is found; make it the one worth citing (a direct answer near the top, dated facts, sources).', true); }
    const P = x.persona; if (P && (P.roles || []).length) {
      h += h3('Does the asker\'s role change the answer? (API answers)') + p_(esc(P.method) + '. Without a role: named in ' + (P.control.rate == null ? '-' : P.control.rate + '%') + ' of ' + n(P.control.n) + ' answers.', true)
        + table(['Buyer role', 'Named with the role', 'Change', 'This run', 'Last 28 days'], P.roles.map(r => [esc(r.role), (r.rate == null ? '-' : r.rate + '%') + ' of ' + n(r.n), r.delta == null ? '-' : (r.delta > 0 ? '+' : '') + r.delta + ' pts', esc(r.verdict),
          esc(r.pooled.verdict) + ' (' + n(r.pooled.n) + ' vs ' + n(r.pooled.control_n) + ' answers, ' + r.pooled.runs + ' run' + (r.pooled.runs === 1 ? '' : 's') + ')'])); }
    const D = x.demand; if (D && ((D.questions || []).length || D.market)) {
      h += h3('Demand behind your questions') + p_(esc(D.note), true);
      if ((D.questions || []).length) { const pq = new Map((x.prompts || []).map(q => [S(q.prompt_id), q.prompt]));
        h += table(['Question', 'Range a month', 'From'], D.questions.slice(0, 12).map(q => [esc(pq.get(S(q.prompt_id)) || q.prompt_id), q.lo == null ? '-' : (q.lo === q.hi ? n(q.lo) : n(q.lo) + ' to ' + n(q.hi)), esc(q.proxies.map(p => p.source.replace(/_/g, ' ') + ' ' + n(p.value) + ' (' + p.as_of + ')').join('; '))])); }
      const M = D.market; if (M) { h += p_('Market trend' + (D.market_carried ? ' (read ' + esc(M.as_of) + ', monthly)' : '') + ': ' + esc(M.note) + '.', true);
        if ((M.historical || []).length) h += table(['Month', 'Answers mentioning you', 'Their AI search volume'], M.historical.slice(-6).map(r => [esc(r.month), n(r.mentions), n(r.ai_search_volume)]));
        if ((M.new_lost || []).length) h += table(['Month', 'New mentions', 'Lost mentions'], M.new_lost.slice(-6).map(r => [esc(S(r.date).slice(0, 7)), n(r.new_mentions), n(r.lost_mentions)]));
        if ((M.top_brands || []).length) h += table(['Brands AI names most for "' + S(M.topic) + '"', 'Mentions', 'AI search volume'], M.top_brands.map(b => [esc(b.brand), n(b.mentions), n(b.ai_search_volume)]));
        if ((M.errors || []).length) h += p_('Not available: ' + esc(M.errors.join('; ')), true); } }
    const I = x.imports; if (I) { h += h3('Your uploaded AI reports') + p_(esc(I.note), true);
      if (I.copilot) h += p_('Copilot: ' + n(I.copilot.citations) + ' citations of ' + n(I.copilot.urls_n) + ' of your pages, ' + esc(I.copilot.label) + '. ' + esc(I.copilot.note) + '.', true);
      const g = I.sources.gsc_ai; if (g) h += p_('Google AI Mode / AI Overviews: ' + n(g.impressions) + ' impressions, ' + n(g.clicks) + ' clicks on ' + n(g.urls_n) + ' pages (your Search Console export).', true); }
    const N = x.notes || {}; const nl = [N.lost_note, N.unanalysed_note, N.market_fallback_n ? N.market_fallback_n + ' question(s) were asked in your own market because their market is past the limit of ' + AIP.MARKETS_MAX + ' markets a panel covers' : '', N.ceiling_note, N.fanout_note].filter(Boolean);
    if (nl.length) h += p_(nl.map(esc).join(' '), true);
    return h; };
  const callbackFields = (x) => (x ? { fanout_gap: x.fanout_gap || null, persona_effect: x.persona || null, demand: x.demand || null, imports: x.imports || null, exec_ids: x.exec_ids || '', run_notes: x.notes || null } : {});

  return { optionsOf, fanoutOf, normQuery, citedRow, fanoutTop, serpBody, fanoutRequests, targetPage, gscOf, fanoutGap, personaMessage, personaQuestions, personaRequests, llmText, twoProp, verdictOf, personaEffect,
    platformOf, demandRequests, marketOf, mentionItems, demand, imports, execIds, notes, promptState, reportHtml, callbackFields, PERSONA_MODEL, US_NOTE, MIN };
})();
