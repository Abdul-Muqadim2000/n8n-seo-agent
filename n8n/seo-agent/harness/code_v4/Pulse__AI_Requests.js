// One DataForSEO request per question x engine (ChatGPT and Gemini = the real chatgpt.com / gemini.google.com answers through the LLM scraper;
// Perplexity and Claude = LLM Responses with web search, localised to the site's country; Google AI Mode with the question; the Google AI Overview on
// the matching search phrase), plus the monthly views of the AI-answer database (387M+ real questions; Google AI Overviews in every country, ChatGPT
// for US-English): the market view (who AI cites for the main topic), the market-wide index (how often answers cite you vs each competitor, weighted
// by AI search volume) and the real questions where AI cites you. Shared by the AI Visibility Tracker and the AI Pulse (plan field `pulse_run`:
// the fast engines only, no brand question, no database views). Costs measured live on 2026-10-02 / priced 2026-10-08.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10):
//  * every question is asked in ITS market (country + language, `markets_map` from the plan), not only the site's own;
//  * two more opt-in engines: the ChatGPT API and the Gemini API (DataForSEO LLM Responses with web search — what an agent or an app built
//    on those models answers, beside the consumer interfaces the scrapers read);
//  * the weekly run's requests are ONE deterministic list per site (questions in panel order, engines in a fixed order); an execution asks
//    the keys no earlier execution of the same run answered, at most its chunk (`AIP.slice`) — a resumed or repeated chunk never pays twice;
//  * the prices are the one table in _ai_panel.js (AIP.PRICE) and the cost caps follow the panel: the run may spend what the panel's exact
//    estimate says (+25%), never more than the tracker's ceiling.
// ---- G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the AI question panel at enterprise scale — shared by AI Plan, AI Requests, Prompt Jobs,
// Prompt Rows, Pulse Plan, AI Metrics and the Site Admin (inlined by the build). Pure functions, no node access: the harness runs them.
// The money is here too (AIP.cost, section 8: ONE formula for the engine; app/shared/src/cost.ts mirrors it against one table of golden
// cases). And the rest: the limits, the markets and personas a question carries, the strata the daily sample rotates through,
// the requests of a run in one deterministic order (so a resumed run never pays for the same answer twice), the state of a run that is
// split across executions, and the "same question in other words" rule that keeps a 500-question panel from asking one thing ten times.
const AIP = (() => {
  const LIMITS = {
    min: 3, max: 500,                 // questions a site may track (the brand question included)
    default_new: 50,                  // a site with NO seo_monitors row starts here
    default_stored: 20,               // a row whose ai_prompts_max is empty keeps the v4.9 default (an existing site is never raised by a release)
    chunk_requests: 600,              // engine requests one execution of the weekly run asks for one site (about 25 KB an answer: ~30 MB of execution data)
    exec_requests: 1200,              // and for all its sites together (a scheduled run covers up to 15 sites)
    pulse_max_requests: 900,          // requests one pulse morning may ask (the v4.9 cap); the daily sample is sized to fit under it
    full_pulse_max_panel: 50,         // up to this panel the pulse asks every question every day, as before (auto mode)
    target_headline: 3,               // ± points (95%) the weekly headline rate should reach — the pulse's N is chosen for it
    target_cluster: 8,                // ± points (95%) the median topic cluster should reach
    cluster_size_guess: 12,           // questions per cluster when the panel has none yet (the Prompt Writer aims at 8-15)
    min_segment: 12,                  // answers under which a segment rate is "too few answers" (= MIN_RATE_SAMPLES)
    stall_minutes: 65,                // a split run silent this long is resumed by the next start of the tracker or the pulse: the tracker's
                                      // execution limit is 60 minutes, so a part not heard of for 65 is dead, never merely slow (a resume of a
                                      // live part would ask its questions twice; the run guard refuses that twin too)
    resume_days: 6,                   // an unfinished run older than this is closed, not resumed (a new week starts a new run)
    max_run_usd: 150,                 // one weekly / full run above this is refused by the plan, with the reason
    writer_batch: 40,                 // questions one Prompt Writer job writes (the agent's answer must fit its token budget)
    writer_jobs_per_run: 14,          // Prompt Writer jobs one run may start (14 x 40 = 560: a new 500-question panel in one run)
    similar: 0.6,                     // Jaccard over content-word stems at or above which two questions ask the same thing
  };
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h; };

  // ---- 1. the panel size a site is held to ----------------------------------------------------------------------------------
  /** `row` = the site's seo_monitors row, or null when it has none. A stored number is never changed; an empty field keeps 20. */
  const panelSize = (row) => {
    if (!row || !S(row.site_id)) return LIMITS.default_new;
    const v = Number(row.ai_prompts_max);
    if (row.ai_prompts_max === '' || row.ai_prompts_max == null || !Number.isFinite(v) || v <= 0) return LIMITS.default_stored;
    return clamp(Math.round(v), LIMITS.min, LIMITS.max);
  };

  // ---- 2. markets and personas -----------------------------------------------------------------------------------------------
  /** "ae-EN", "AE en", "ae" -> "AE-en" (country ISO + language); '' when it is not a market */
  const normMarket = (m, dfltLang) => {
    const x = S(m).replace(/[_\s]+/g, '-'); const mm = x.match(/^([A-Za-z]{2})(?:-([A-Za-z]{2,3}))?$/);
    if (!mm) return '';
    return mm[1].toUpperCase() + '-' + (mm[2] || dfltLang || 'en').toLowerCase();
  };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(S).filter(Boolean);
  /** the markets a site's panel covers: its own first, then the extra ones in its settings (at most 6) */
  const marketsOf = (site) => {
    const own = normMarket(S(site.country_iso) + '-' + S(site.language_code || 'en')) || 'US-en';
    const extra = listOf(site.ai_markets).map(m => normMarket(m, 'en')).filter(Boolean);
    return [...new Set([own, ...extra])].slice(0, 8);
  };
  // DataForSEO's location code for a country is 2000 + its ISO 3166 numeric code. The main workflow's COUNTRIES table holds 22 countries;
  // a market outside it (Qatar, Kuwait, Germany …) must still be asked IN that country, never quietly relabelled as the site's own market.
  const ISO_NUM = { AE: 784, SA: 682, QA: 634, KW: 414, BH: 48, OM: 512, EG: 818, JO: 400, LB: 422, MA: 504, TN: 788, DZ: 12, IQ: 368, TR: 792, IL: 376, PK: 586, IN: 356, BD: 50, LK: 144, NP: 524,
    US: 840, CA: 124, MX: 484, BR: 76, AR: 32, CL: 152, CO: 170, PE: 604, GB: 826, IE: 372, FR: 250, DE: 276, NL: 528, BE: 56, LU: 442, CH: 756, AT: 40, IT: 380, ES: 724, PT: 620,
    SE: 752, NO: 578, DK: 208, FI: 246, PL: 616, CZ: 203, SK: 703, HU: 348, RO: 642, BG: 100, GR: 300, HR: 191, SI: 705, RS: 688, UA: 804, EE: 233, LV: 428, LT: 440, CY: 196, MT: 470,
    ZA: 710, NG: 566, KE: 404, GH: 288, ET: 231, TZ: 834, UG: 800, AU: 36, NZ: 554, SG: 702, MY: 458, ID: 360, TH: 764, VN: 704, PH: 608, HK: 344, TW: 158, JP: 392, KR: 410, CN: 156 };
  const locationOf = (cc) => { const n = ISO_NUM[S(cc).toUpperCase()]; return n ? 2000 + n : 0; };
  const PERSONA_MAX = 6;
  const personasOf = (site) => [...new Set(listOf(site.ai_personas).map(p => p.replace(/\s+/g, ' ').slice(0, 40)))].slice(0, PERSONA_MAX);
  const stageOf = (s) => { const x = S(s).toLowerCase(); return ['awareness', 'consideration', 'decision', 'brand'].includes(x) ? x : ''; };

  // ---- 3. one question, said another way ----------------------------------------------------------------------------------------
  const STOP = new Set(('a an and are as at be best by can do does for from get has have how i in is it its me my of on or our should the their them '
    + 'there these this to top us we what when where which who why will with you your vs versus near me good great right').split(' '));
  const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ing|ers|er|es|ed|ly|s)$/, '').slice(0, 7);
  const stems = (t) => [...new Set(S(t).toLowerCase().replace(/[^a-z0-9؀-ۿ\s]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(stem).filter(w => w.length >= 2))];
  const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  /** do two questions ask the same thing? (same market and persona, and their content words overlap enough) */
  const sameAsk = (a, b) => {
    if (S(a.market || '') !== S(b.market || '') && a.market && b.market) return false;
    if (a.persona && b.persona && S(a.persona).toLowerCase() !== S(b.persona).toLowerCase()) return false;
    return jaccard(stems(a.prompt), stems(b.prompt)) >= LIMITS.similar;
  };
  /** keep the first of every group of questions that ask the same thing; `existing` are kept already. Returns { keep, dup: [{q, like}] } */
  const dedupe = (cands, existing) => {
    const kept = (existing || []).map(q => ({ ...q, _s: stems(q.prompt) }));
    const keep = [], dup = [];
    for (const q of (cands || [])) {
      const s = stems(q.prompt);
      const like = kept.find(k => (S(k.market || '') === S(q.market || '') || !k.market || !q.market)
        && (!k.persona || !q.persona || S(k.persona).toLowerCase() === S(q.persona).toLowerCase()) && jaccard(k._s, s) >= LIMITS.similar);
      if (like) { dup.push({ q, like: like.prompt }); continue; }
      kept.push({ ...q, _s: s }); keep.push(q);
    }
    return { keep, dup };
  };

  // ---- 4. strata and the daily rotating sample ----------------------------------------------------------------------------------
  const stratumOf = (q) => (S(q.cluster || q.topic).toLowerCase() || 'other') + ' | ' + (S(q.persona).toLowerCase() || 'any buyer');
  /** the pulse-day counter: the six days after the website's cycle day (its weekly run) are six consecutive numbers, and the cycle day
   *  itself shares the next day's. `cycleWeekday` is 0 (Sunday) … 6 (Saturday); with none it is Monday (1), the v4.9 rule exactly - every
   *  website then had its weekly run on Monday and its pulse Tuesday..Sunday. 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): a website's week
   *  starts on the day it set up, so its six pulse mornings are counted from ITS cycle day; a question is still asked on exactly `per_week`
   *  of every six consecutive pulse mornings (pulseSample), whatever the weekday. `iso` is the website's LOCAL date (YYYY-MM-DD…). */
  const pulseDay = (iso, cycleWeekday) => {
    const cw = Number.isInteger(Number(cycleWeekday)) && cycleWeekday !== null && cycleWeekday !== '' && Number(cycleWeekday) >= 0 && Number(cycleWeekday) <= 6 ? Number(cycleWeekday) : 1;
    const t = Date.parse(S(iso).slice(0, 10) + 'T00:00:00Z'); const d = Math.floor((t - Date.UTC(1970, 0, 4 + cw)) / 864e5);   // 1970-01-04 was a Sunday: the anchor is the first cycle day of 1970
    const w = Math.floor(d / 7), r = ((d % 7) + 7) % 7;
    return w * 6 + (r === 0 ? 0 : r - 1);
  };
  /** the weekly answer counts a panel collects */
  const halfWidth = (n, p) => { const N = n0(n); if (N <= 0) return null; const z = 1.96, q = p == null ? 0.5 : p; const d = 1 + z * z / N, m = z * Math.sqrt(q * (1 - q) / N + z * z / (4 * N * N)); return Math.round(1000 * m / d) / 10; };
  /** N: how many pulse mornings a week each question is asked. 'full' = every morning; auto = the smallest N that brings the weekly
   *  headline to ±target_headline and the median cluster to ±target_cluster (both at 95%, at worst p = 0.5) — capped by what one
   *  morning may ask. Returns { per_week, why, headline, cluster } with the half-widths it buys. */
  const pulsePerWeek = (o) => {
    const asked = Math.max(1, n0(o.asked)); const wE = Math.max(0, n0(o.weekly_engines)); const pE = Math.max(0, n0(o.pulse_engines));
    const cl = Math.max(1, n0(o.cluster_size) || LIMITS.cluster_size_guess);
    const capQ = pE ? Math.floor(LIMITS.pulse_max_requests / pE) : asked;   // questions one morning may ask
    const capN = Math.max(1, Math.min(6, Math.floor(6 * capQ / asked)));
    const at = (N) => ({ headline: halfWidth(asked * (wE + N * pE)), cluster: halfWidth(Math.min(asked, cl) * (wE + N * pE)) });
    const mode = S(o.mode).toLowerCase();
    if (!pE) return { per_week: 0, why: 'no pulse engine is on', ...at(0), capped: false };
    if (mode === 'full' || (mode !== 'sample' && asked <= LIMITS.full_pulse_max_panel - 1)) {
      const N = Math.min(6, capN);
      return { per_week: N, ...at(N), capped: N < 6, why: N < 6 ? 'every question every morning would be ' + (asked * pE) + ' requests; one morning asks at most ' + LIMITS.pulse_max_requests + ', so each question is asked ' + N + ' mornings a week' : 'every question, every pulse morning' };
    }
    const fixed = n0(o.per_week);
    if (fixed >= 1) { const N = Math.min(6, Math.round(fixed), capN); return { per_week: N, ...at(N), capped: N < Math.round(fixed), why: 'set by the owner: each question ' + N + ' morning(s) a week' + (N < Math.round(fixed) ? ' (more would pass the ' + LIMITS.pulse_max_requests + '-request morning limit)' : '') }; }
    for (let N = 1; N <= capN; N++) { const h = at(N); if (h.headline <= LIMITS.target_headline && h.cluster <= LIMITS.target_cluster) return { per_week: N, ...h, capped: false, why: 'the fewest mornings that bring the weekly rate to ±' + h.headline + ' points and a ' + cl + '-question cluster to ±' + h.cluster + ' (95%)' }; }
    return { per_week: capN, ...at(capN), capped: true, why: 'the most one morning allows (' + LIMITS.pulse_max_requests + ' requests): a ' + cl + '-question cluster reaches ±' + at(capN).cluster + ' points, not ±' + LIMITS.target_cluster };
  };
  /** today's sample: every question asked on `per_week` of the six pulse mornings, slots spread round-robin inside each stratum (with a
   *  per-stratum offset so the mornings carry the same load), and every stratum present every morning (a stratum too small to be
   *  covered by its slots gets one extra question that day, chosen in turn). Returns { asked, strata, covered, per_week, extra } */
  const pulseSample = (prompts, o) => {
    const N = clamp(Math.round(n0(o.per_week)) || 6, 1, 6); const pd = n0(o.day);
    const groups = new Map();
    for (const q of (prompts || [])) { const k = stratumOf(q); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    const asked = []; let extra = 0;
    for (const [k, qs] of groups) {
      const sorted = qs.slice().sort((a, b) => (hash(a.prompt_id) - hash(b.prompt_id)) || S(a.prompt_id).localeCompare(S(b.prompt_id)));
      const off = hash(k) % 6; let got = 0;
      sorted.forEach((q, i) => { const slot = (off + i) % 6; if (((pd - slot) % 6 + 6) % 6 < N) { asked.push({ ...q, slot, stratum: k }); got++; } });
      if (!got && sorted.length) { const q = sorted[((pd % sorted.length) + sorted.length) % sorted.length]; asked.push({ ...q, slot: -1, stratum: k, top_up: true }); extra++; }
    }
    return { asked, strata: groups.size, covered: new Set(asked.map(q => q.stratum)).size, per_week: N, extra };
  };

  // ---- 5. the requests of one run, in one order -------------------------------------------------------------------------------
  const reqKey = (prompt_id, engine) => S(prompt_id) + '|' + S(engine);
  /** the requests a run still owes: `all` in the run's deterministic order, minus the keys answered by an earlier execution of the same
   *  run, cut at `limit`. Returns { now, left, done, total, final } — `final` when nothing is left after this execution. */
  const slice = (all, doneKeys, limit) => {
    const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys || []);
    const owed = (all || []).filter(r => !done.has(reqKey(r.prompt_id, r.engine)));
    const lim = Math.max(1, n0(limit) || LIMITS.chunk_requests);
    const now = owed.slice(0, lim);
    return { now, left: owed.length - now.length, done: (all || []).length - owed.length, total: (all || []).length, final: owed.length <= lim };
  };

  // ---- 6. a run split across executions: its state row in seo_cache (`ai_run:<site_id>`, kind ai) --------------------------------
  const stateKey = (site_id) => 'ai_run:' + S(site_id);
  const parse = (t, d) => { try { const v = typeof t === 'string' ? JSON.parse(t || '') : t; return v == null ? d : v; } catch (e) { return d; } };
  const stateOf = (cacheRows, site_id) => { const r = (cacheRows || []).find(c => c && c.key === stateKey(site_id)); return r ? parse(r.value, null) : null; };
  /** what to do with a stored state at `now`: 'continue' (this is its next chunk), 'resume' (silent too long: pick it up), 'busy' (a chunk
   *  is running right now), 'closed' (finished, or too old to resume) */
  const stateVerdict = (st, nowIso, continuing) => {
    if (!st || !st.run_id) return 'closed';
    if (S(st.status) !== 'running') return 'closed';
    const now = Date.parse(nowIso) || Date.now();
    const started = Date.parse(st.started_at) || 0, upd = Date.parse(st.updated_at) || started;
    if (started && now - started > LIMITS.resume_days * 864e5) return 'closed';
    if (continuing && S(continuing) === S(st.run_id)) return 'continue';
    if (now - upd >= LIMITS.stall_minutes * 60000) return 'resume';
    return 'busy';
  };
  const stateRow = (site_id, st, nowIso) => ({ key: stateKey(site_id), kind: 'ai', site_id: S(site_id), value: JSON.stringify(st), updated_at: nowIso });   // exact seo_cache columns

  // ---- 7. the panel's identity: a delta is only a delta between the same questions ---------------------------------------------
  const panelIds = (ids) => [...new Set((ids || []).map(S).filter(Boolean))].sort();
  const panelHash = (ids, engines) => { const s = panelIds(ids).join(',') + '#' + [...new Set(engines || [])].sort().join('+'); return (hash(s) >>> 0).toString(36) + '-' + panelIds(ids).length; };
  /** share of the earlier panel's questions still asked now (0-1), and whether that is the same panel (>= 80%) */
  const overlap = (now, before) => { const A = new Set(panelIds(now)), B = panelIds(before); if (!B.length || !A.size) return { share: null, same: null, common: 0 };
    const c = B.filter(x => A.has(x)).length; const share = c / Math.max(A.size, B.length); return { share: Math.round(1000 * share) / 1000, same: share >= 0.8, common: c }; };

  // ---- 8. the money: ONE formula (the app's app/shared/src/cost.ts estimateAiPanelCost mirrors it; both are held to the golden cases in
  // v5/data/ai_panel_cost_cases.json — harness S200 and app/shared cost.aipanel.test.ts) --------------------------------------------
  // DataForSEO price per question on each engine (LLM scraper / LLM Responses / SERP, measured 2026-10-02, priced 2026-10-08; the two API
  // engines of 2026-10-18 are ESTIMATES until their first live call — the settle takes each task's own `cost` either way).
  const PRICE = { chatgpt: 0.004, gemini: 0.004, perplexity: 0.006, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, copilot: 0.002, chatgpt_api: 0.012, gemini_api: 0.02 };
  const PRICE_BASIS = { chatgpt_api: 'estimate: DataForSEO $0.0002 a task + OpenAI tokens + web search (~$0.01); confirm on the first live run', gemini_api: 'estimate: DataForSEO $0.0002 a task + Gemini tokens + Google Search grounding; confirm on the first live run' };
  const ENGINES = Object.keys(PRICE);
  const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];   // copilot and the two API engines are opt-in
  const MONTHLY_ENGINES = ['claude'];
  const PULSE_ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'copilot'];
  const FIXED = { weekly_ai_min: 0.13, brief_ai: 0.03, analyst_job_ai: 0.02, analyst_per_job: 12, analyst_share: 0.35, analyst_cap_base: 24, analyst_cap_max: 60,
    full_dfs: 0.45, full_ai: 0.3, weeks_per_month: 4.33, pulse_days: 6 };
  const r4 = (x) => Math.round(x * 10000) / 10000; const r2 = (x) => Math.round(x * 100) / 100;
  const sumPrice = (list) => list.reduce((t, e) => t + (PRICE[e] || 0), 0);
  /** the Answer Analyst jobs one weekly run may start (it reads the answers that matter, 12 a job; more for a bigger panel, never past 60) */
  const analystCap = (panel) => Math.min(FIXED.analyst_cap_max, FIXED.analyst_cap_base + Math.floor(n0(panel) / 25));
  /** o: { panel, engines, pulse (bool), pulse_mode ('auto'|'sample'|'full'), pulse_per_week, cluster_size }. Every figure is in US dollars;
   *  `run` is what one execution chain of the weekly tracker spends (weekly / the month's full run), `pulse_day` one pulse morning,
   *  `month` the site's month (4.33 weekly runs + the full run's extra + 26 pulse mornings). */
  const cost = (o) => {
    const x = o || {};
    const panel = clamp(Math.round(n0(x.panel)) || LIMITS.default_new, LIMITS.min, LIMITS.max);
    const engines = [...new Set((x.engines && x.engines.length ? x.engines : DEFAULT_ENGINES).filter(e => PRICE[e] != null))];
    const asked = Math.max(1, panel - 1);                  // the brand question is asked on the month's full run only
    const wE = engines.filter(e => !MONTHLY_ENGINES.includes(e));
    const pE = PULSE_ENGINES.filter(e => engines.includes(e));
    const answers = asked * wE.length;
    const jobs = Math.min(analystCap(panel), Math.ceil(answers * FIXED.analyst_share / FIXED.analyst_per_job));
    const weekly = { dfs: r4(asked * sumPrice(wE)), ai: r4(Math.max(FIXED.weekly_ai_min, FIXED.brief_ai + jobs * FIXED.analyst_job_ai)) };
    weekly.usd = r4(weekly.dfs + weekly.ai);
    const extra = { dfs: r4((engines.includes('claude') ? panel * PRICE.claude : 0) + sumPrice(wE) + FIXED.full_dfs), ai: FIXED.full_ai };
    extra.usd = r4(extra.dfs + extra.ai);
    const full = { dfs: r4(weekly.dfs + extra.dfs), ai: r4(weekly.ai + extra.ai) }; full.usd = r4(full.dfs + full.ai);
    const on = x.pulse !== false && pE.length > 0;
    const pw = on ? pulsePerWeek({ asked, weekly_engines: wE.length, pulse_engines: pE.length, cluster_size: x.cluster_size, mode: x.pulse_mode, per_week: x.pulse_per_week }) : { per_week: 0, headline: halfWidth(answers), cluster: halfWidth(Math.min(asked, n0(x.cluster_size) || LIMITS.cluster_size_guess) * wE.length), capped: false, why: on ? '' : 'the daily pulse is off' };
    const qDay = on ? Math.min(asked, Math.ceil(asked * pw.per_week / FIXED.pulse_days)) : 0;
    const pulse_day = { dfs: r4(qDay * sumPrice(pE)), ai: 0 }; pulse_day.usd = pulse_day.dfs;
    const W = FIXED.weeks_per_month;
    const month = { weekly: r2(W * weekly.usd), full_extra: r2(extra.usd), pulse: r2(W * FIXED.pulse_days * pulse_day.usd) };
    month.total = r2(month.weekly + month.full_extra + month.pulse);
    return { panel, asked, engines, weekly_engines: wE, pulse_engines: on ? pE : [], per_week: pw.per_week, pulse_questions_day: qDay, pulse_why: pw.why, pulse_capped: !!pw.capped,
      requests: { weekly: answers, full: answers + (engines.includes('claude') ? panel : 0) + wE.length, pulse_day: qDay * (on ? pE.length : 0) },
      executions: Math.max(1, Math.ceil(answers / LIMITS.chunk_requests)), analyst_jobs: jobs,
      half_width: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, full_extra: extra, pulse_day, month,
      prices: engines.map(e => ({ engine: e, usd: PRICE[e], basis: PRICE_BASIS[e] || 'measured / priced' })) };
  };

  return { LIMITS, panelSize, normMarket, locationOf, listOf, marketsOf, personasOf, stageOf, stems, jaccard, sameAsk, dedupe, stratumOf, pulseDay, halfWidth,
    pulsePerWeek, pulseSample, reqKey, slice, stateKey, stateOf, stateVerdict, stateRow, panelIds, panelHash, overlap, hash,
    PRICE, PRICE_BASIS, ENGINES, DEFAULT_ENGINES, MONTHLY_ENGINES, PULSE_ENGINES, FIXED, analystCap, cost };
})();
const CONFIG = { max_requests_per_run: 900, max_cost_per_run_usd: 15, max_cost_per_pulse_usd: 4, headroom: 1.25,
  models: { perplexity: 'sonar', claude: 'claude-haiku-4-5', chatgpt_api: 'gpt-5.4-mini', gemini_api: 'gemini-3.5-flash' },
  cost: { ...AIP.PRICE, market: 0.115, index_sov: 0.11, index_you: 0.12 }, chat_gpt_location: 2840,
  order: ['chatgpt', 'gemini', 'perplexity', 'claude', 'ai_mode', 'copilot', 'ai_overview', 'chatgpt_api', 'gemini_api'] };
const API = 'https://api.dataforseo.com/v3/';
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let fresh = []; try { fresh = $('Prompt Rows').all().map(i => i.json).filter(r => !r.skip && r.prompt_id && r.status !== 'off' && r.status !== 'refused'); } catch (e) {}   // new questions (stored ones are in the plan already); a refused one is stored, never asked
const out = []; let spend = 0; const skipped = []; const chunks = {};
const pulse = plans.some(p => p.pulse_run);
// G6: the cap follows the panel — what this run's exact estimate says it costs, with headroom, never under the v4.9 caps and never over the ceiling
const estAll = plans.reduce((t, p) => t + (pulse ? Number((p.cost_model || {}).pulse_day ? p.cost_model.pulse_day.dfs : 0) : Number(p.est_dfs_usd) || 0), 0);
const cap = Math.min(AIP.LIMITS.max_run_usd, Math.max(pulse ? CONFIG.max_cost_per_pulse_usd : CONFIG.max_cost_per_run_usd, CONFIG.headroom * estAll));
const maxReq = pulse ? Math.max(CONFIG.max_requests_per_run, AIP.LIMITS.pulse_max_requests) : AIP.LIMITS.exec_requests + 40;   // + the database views of the last chunk
const add = (p, q, engine, endpoint, body) => {
  const c = CONFIG.cost[engine] || 0.01;
  if (out.length >= maxReq || spend + c > cap) { skipped.push(p.domain + ':' + engine); return; }
  spend += c; out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, run_kind: p.run_kind || 'weekly', prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword, engine, endpoint: API + endpoint, body, est_cost: c,
    market: q.market || p.own_market || '', persona: q.persona || '', cluster: q.cluster || q.topic || '', stage: q.stage || '' } });
};
// the countries Claude's web search accepts (DataForSEO docs, 2026-10); any other code is refused with 40501
const CLAUDE_GEO = new Set('AR AT AU BE BR CA CH CL CN DE DK ES FI FR GB HK ID IN IT JP KR MX MY NL NO NZ PH PL PT RU SA SE TR TW US ZA'.split(' '));
for (const p of plans) {
  const known = new Set(p.prompts.map(x => x.prompt_id));
  const qs = [...p.prompts, ...fresh.filter(r => r.site_id === p.site_id && !known.has(r.prompt_id)).map(r => ({ prompt_id: r.prompt_id, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source,
    persona: r.persona || '', market: r.market || '', cluster: r.cluster || '', stage: r.stage || '' }))].slice(0, p.prompts_max);
  const locOf = (q) => { const m = (p.markets_map || {})[q.market || p.own_market] || null; return m ? { location_code: m.location_code, language_code: m.language_code } : { location_code: p.location_code, language_code: p.language_code }; };
  const isoOf = (q) => { const m = (p.markets_map || {})[q.market || p.own_market] || null; return String((m && m.country_iso) || p.country_iso || '').toUpperCase(); };
  // every request this execution may owe for the site, in the run's one order
  const want = [];
  const seenKw = new Set();
  for (const q of qs) {
    if (q.kind === 'brand' && (p.pulse_run || !p.full_due)) continue;   // brand recognition hardly changes week to week: once a month
    const e = p.pulse_run ? (p.pulse_engines || []) : p.engines.filter(x => p.full_due || !(p.monthly_engines || []).includes(x));   // Claude once a month (v4.6/v4.9)
    const loc = locOf(q); const iso = isoOf(q); const geo = /^[A-Z]{2}$/.test(iso) ? { web_search_country_iso_code: iso } : {};
    for (const engine of CONFIG.order) {
      if (!e.includes(engine)) continue;
      if (engine === 'chatgpt') want.push([q, engine, 'ai_optimization/chat_gpt/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]]);
      if (engine === 'gemini') want.push([q, engine, 'ai_optimization/gemini/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]]);
      if (engine === 'perplexity') want.push([q, engine, 'ai_optimization/perplexity/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.perplexity, max_output_tokens: 1000, ...geo }]]);
      if (engine === 'claude') want.push([q, engine, 'ai_optimization/claude/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.claude, web_search: true, max_output_tokens: 1200, ...(CLAUDE_GEO.has(iso) ? geo : {}) }]]);   // Claude localises only to its listed countries (AE is not one: 40501 live 2026-10-08); elsewhere the questions name the country
      if (engine === 'ai_mode') want.push([q, engine, 'serp/google/ai_mode/live/advanced', [{ keyword: q.prompt, ...loc }]]);
      if (engine === 'copilot' && q.kind !== 'brand') want.push([q, engine, 'serp/bing/organic/live/advanced', [{ keyword: q.prompt.slice(0, 700), ...loc, depth: 10 }]]);   // v4.12: Copilot Search (Bing shows it for many questions, not all: no summary = no answer, like AI Overviews)
      // G6: the model APIs, with web search. NEEDS ONE LIVE CALL (AI_PANEL_SCALE_HANDOFF.md §7): `web_search` and `max_output_tokens` on these
      // two models and `web_search_country_iso_code` on chat_gpt — the sandbox refused max_output_tokens on o4-mini but does not validate every field
      if (engine === 'chatgpt_api') want.push([q, engine, 'ai_optimization/chat_gpt/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.chatgpt_api, web_search: true, max_output_tokens: 1200, ...geo }]]);
      if (engine === 'gemini_api') want.push([q, engine, 'ai_optimization/gemini/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.gemini_api, web_search: true, max_output_tokens: 1200 }]]);
      const kw = String(q.keyword || '').trim().toLowerCase();
      if (engine === 'ai_overview' && kw && q.kind !== 'brand' && !seenKw.has((q.market || '') + '|' + kw)) { seenKw.add((q.market || '') + '|' + kw); want.push([q, engine, 'serp/google/organic/live/advanced', [{ keyword: kw, ...loc, depth: 10, load_async_ai_overview: true }]]); }
    }
  }
  // G6: the weekly run is split across executions — this one asks the keys still owed, at most its chunk (the last chunk: all that is left)
  const c = p.chunk || null;
  const all = want.map(([q, engine]) => ({ prompt_id: q.prompt_id, engine }));
  const sl = p.pulse_run || !c ? { now: all, left: 0, done: 0, total: all.length, final: true } : AIP.slice(all, p.done_keys || [], c.final_expected ? all.length + 1 : Math.max(1, c.size));
  const nowKeys = new Set(sl.now.map(r => AIP.reqKey(r.prompt_id, r.engine)));
  const before = out.length;
  for (const [q, engine, endpoint, body] of want) if (nowKeys.has(AIP.reqKey(q.prompt_id, engine)) && (p.pulse_run || !c || c.size > 0 || c.final_expected)) add(p, q, engine, endpoint, body);
  chunks[p.site_id] = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, total: sl.total, done_before: sl.done, asked_now: out.length - before, left_after: Math.max(0, sl.total - sl.done - (out.length - before)),
    final: !c || !!c.final_expected, no: c ? c.no : 1 };
  if (p.pulse_run) continue;
  if (c && !c.final_expected) continue;   // the database views belong to the run's last execution
  const platforms = ['google', ...(p.location_code === CONFIG.chat_gpt_location && p.language_code === 'en' ? ['chat_gpt'] : [])];   // the database holds ChatGPT answers for US-English only
  const loc = { location_code: p.location_code, language_code: p.language_code };
  if (p.market_due && p.market_keyword) add(p, { prompt_id: 'market', prompt: p.market_keyword, kind: 'market', topic: p.market_keyword, keyword: p.market_keyword }, 'market', 'ai_optimization/llm_mentions/top_mentioned_domains/live', [{ target: [{ keyword: p.market_keyword }], ...loc, platform: 'google', limit: 15 }]);
  if (p.index_due) for (const platform of platforms) {
    const targets = [{ key: p.domain, target: [{ domain: p.domain }] }, ...p.competitors.filter(c0 => /\./.test(c0) && c0 !== p.domain).slice(0, 8).map(c0 => ({ key: c0, target: [{ domain: c0 }] }))];
    if (p.business_name && p.business_name.length >= 4 && targets.length < 10) targets.push({ key: 'name:' + p.business_name, target: [{ keyword: p.business_name.slice(0, 250), search_scope: ['answer'], match_type: 'word_match' }] });
    if (targets.length >= 2) add(p, { prompt_id: 'index', prompt: 'market-wide share', kind: 'index', topic: platform, keyword: platform }, 'index_sov', 'ai_optimization/llm_mentions/multi_target_metrics/live', [{ targets, ...loc, platform }]);
    add(p, { prompt_id: 'index', prompt: 'questions citing you', kind: 'index', topic: platform, keyword: platform }, 'index_you', 'ai_optimization/llm_mentions/search_mentions/live', [{ target: [{ domain: p.domain }], ...loc, platform, order_by: ['ai_search_volume,desc'], limit: 20 }]);
  }
}
if (!out.length) return [{ json: { skip: true, reason: plans.length ? (plans.some(p => p.chunk && !p.chunk.final_expected) ? 'nothing left to ask in this part of the run' : 'no questions to ask (no topics and no business name on file)') : 'nothing to do', skipped, chunks: Object.values(chunks) } }];
out[0].json.skipped_by_cap = skipped;
out[0].json.chunks = Object.values(chunks);   // G6: per site, what this execution asked of its run and what is left (read by AI Chunk Handoff / AI Metrics)
out[0].json.cost_cap_usd = +cap.toFixed(2);
return out;
