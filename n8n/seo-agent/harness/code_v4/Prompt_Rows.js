// Prompt rows for seo_ai_prompts (upsert by prompt_id; exact table columns): the Prompt Writer's new questions (Claude), or template questions when
// the writer failed or did not run, plus the stored questions whose monthly AI search volume was looked up this run (v4.9). The wording of a stored
// question never changes, so the trend always compares the same questions.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): a site's new questions come from SEVERAL writer jobs (one per market x buyer role, at most 40 a
// job), each question carries its persona and market, and before any is stored:
//  * it is deduplicated BY MEANING against the stored panel and against the other new ones (AIP.dedupe: content-word stems, Jaccard >= 0.6,
//    within one market and buyer role) — a 500-question panel must not ask one thing ten times;
//  * it goes through the fit gate (FITR, _fit_gate.js — the same rule the read path runs): its search phrase AND its wording must not name
//    the website itself, another company, a government service or a portal task. A refused question is STORED with status `refused` and the
//    gate's sentence in `fit_note` — never asked, never scored, and shown in the app's panel manager with the reason (INVARIANTS rule 1:
//    a list shorter because a gate ran says so).
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
// ---- fit gate (2026-10-11, FIX_PLAN D4 / D8): ONE rule for keywords that no page of this website should target. Inlined by the build
// (the FIT_GATE placeholder) into Analyze Keywords (full report: keyword gap, easy wins, opportunities), Rank Keywords (discovery), Ladder Pool /
// Ladder Plan (ladder rungs and the main keyword), Relevance Chunks (the brands the AI screen is told about) and Brief Context (the hub
// page's cluster list); a copy goes to harness/code_v4/_fit_gate.js as a shim (S34). fitGate(keyword, ctx) -> { ok: true } or
// { ok: false, reason, detail } with reason one of:
//   'own brand'    — the keyword names the website itself (its domain label, 4+ letters);
//   'navigational' — DataForSEO Labs says the intent is navigational (ctx.intent);
//   'government'   — the keyword is a public body or an identity document and nothing else (FTA, EmaraTax, MoHRE, GDRFA, ICP, RTA, DEWA,
//                    ZATCA, GOSI, "ministry …", "… authority", Emirates ID, UAE Pass, visa / labour card status …), or a body with a portal /
//                    status word ("fta portal", "emirates id status"), or, with its results page in hand (ctx.serp), 3+ of the top 5 results
//                    are on government hosts (.gov / .gov.xx / .gouv.xx / u.ae …);
//   'portal'       — a login / portal / password / status check / renewal / verification / application task: people want the owner's own site;
//   'off topic'    — with topics on file (ctx.topics, R13): under a quarter of the keyword's own words have anything to do with what the
//                    site sells ("character ai", "mofa attestation dubai", "mh enterprises uae");
//   'too broad'    — with topics on file: nothing but generic or place words is left of it ("ai", "google ai", "microsoft ai");
//   'other brand'  — one of its words is the label of a declared competitor (cleartax.com ↔ "cleartax"), of a domain on the results page
//                    (facts.ae ↔ "facts"), or a brand name AI uses for another company (seo_cache ai_brands: name -> domain); with the
//                    keyword's own results page in hand also when one domain whose label is in the keyword holds 3+ of the top 5.
// Bounds, so that legitimate keywords survive:
//   * a public body with a topic word is a topic, not a destination: "zatca e invoicing", "fta vat registration", "mohre wps" are kept — only
//     the body alone (plus country words) or with a portal / status word is refused;
//   * a portal word with a content / buying word is kept ("best erp software with mobile login", "emaratax registration guide"); a plain
//     category noun is not enough ("erp software login" is still a login);
//   * a results-page or AI-named brand with a partner-type word ("sap implementation dubai", "microsoft dynamics 365 partner uae") or a
//     comparison word ("facts erp vs odoo") is kept; a declared competitor is kept only when compared ("cleartax vs zoho"); a results-page
//     label (often a dictionary word) counts only where a product name sits — first, or right before a category word ("facts erp", not
//     "erp facts and figures guide");
//   * a domain label shorter than 4 letters, a word of the keyword being researched (ctx.protect: head term / seeds / services) or a generic
//     word (erp, software, tax …) never counts as a brand; "www", "m", "app" prefixes are dropped before the label is taken.
// Relevance to the website's services is NOT judged here. ctx.relevance (FIX_PLAN G19) is the hook: a function (keyword) -> { ok, reason,
// detail } called last, so the first version of G19 plugs in without touching the callers.
const FIT_CFG = { min_label: 4, serp_top: 5, serp_hold: 3 };
const FIT_STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'my', 'your', 'our', 'is', 'are', 'what', 'how', 'me']);
const FIT_GEO = new Set(['uae', 'u.a.e', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'fujairah', 'ras', 'al', 'khaimah', 'umm', 'quwain', 'emirates', 'gcc', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'muscat', 'bahrain', 'kuwait', 'egypt', 'india', 'pakistan', 'uk', 'usa', 'us', 'online', 'portal']);
// R13 (2026-10-13): 'ai' joined this list — it is a category word, not a topic. With it in, "ai" (165,000/mo) and "google ai" are left with
// nothing of their own ("too broad") while "character ai", "humanize ai", "meta ai" and "blackbox ai" are judged on the word that is really
// theirs; a keyword that names a service of the site ("ai automation uae") still matches on that service's own words.
const FIT_GENERIC = new Set(['ai', 'software', 'softwares', 'services', 'service', 'erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'tax', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll', 'finance', 'financial', 'cloud', 'digital', 'online', 'web', 'data', 'tech', 'technology', 'technologies', 'solutions', 'solution', 'systems', 'system', 'business', 'company', 'group', 'global', 'international', 'gulf', 'arab', 'arabia', 'emirates', 'national', 'consulting', 'consultants', 'consultancy', 'partners', 'partner', 'network', 'news', 'blog', 'guide', 'guides', 'info', 'best', 'top', 'free', 'app', 'apps', 'shop', 'store', 'market', 'media', 'academy', 'institute', 'university', 'school', 'bank', 'pay', 'pro', 'plus', 'hub', 'one', 'first', 'smart', 'easy', 'get', 'go', 'ae', 'com', 'net', 'org', 'home', 'house', 'world', 'city', 'daily', 'times', 'post', 'review', 'reviews', 'compare', 'comparison', 'list', 'directory', 'jobs', 'careers', 'businesses', 'companies', 'firms', 'wiki', 'wikipedia', 'youtube', 'linkedin', 'facebook', 'instagram', 'twitter', 'reddit', 'quora', 'medium', 'google', 'microsoft', 'amazon', 'apple']);
const FIT_GOV_WORDS = /\b(ministry|ministries|authority|authorities|federal|government|govt|municipality|municipal|embassy|consulate|police|courts?|customs|immigration|department of|public prosecution|parliament|chamber of commerce|free zone authority)\b/;
const FIT_GOV_NAMES = /\b(fta|emaratax|emara ?tax|tax authority|mohre|mohap|mofa|moec|gdrfa|icp|ica|rta|dewa|sewa|fewa|addc|aadc|dha|doh|ded|tdra|adjd|ejari|dubai land department|dld|dubai economy|dubai courts|zatca|gazt|gosi|qiwa|absher|muqeem|mudad|hrsd|misa|nafath|tawtheeq|uae pass|smart pass|amer cent(er|re)|tasheel|tawjeeh|emirates id|emirates identity|national id|i ?d card|identity card|labou?r card|work permit status|visa status|visa check|passport status|establishment card|golden visa status|trn verification|trn check|trn lookup|tax registration number check)\b/;
const FIT_PORTAL = /\b(log ?in|logins|sign ?in|sign ?up|password|passwords|portal|portals|e ?services?|customer care|customer service number|helpline|toll ?free|contact number|phone number|status|status check|check status|status enquiry|application status|track(ing)? (status|application|order)|renewal|renew|verification|verify|apply online|online application|download (the )?app|app download|complaint|complaints|fine check|traffic fines?|balance check|otp)\b/;
// content / buying words that turn a portal or government query into a topic ("best erp software with mobile login", "emaratax registration guide");
// plain category nouns (software, system, services …) do not — "erp software login" is still a login
const FIT_CONTENT = /\b(best|top|vs|versus|compar(e|ison)|review|reviews|alternatives?|how to|guide|guides|checklist|requirements?|pricing|price|prices|cost|costs|quote|quotes|hire|consultan(t|ts|cy|cies)|consulting|partner|partners|provider|providers|vendor|vendors|agency|agencies|accredited|approved|certified|compliant|compliance|implementation|integration|integrations|training|course|courses|template|templates|examples?|explained|meaning|benefits|registration|register|filing|return|returns|refund|refunds|deadline|deadlines|penalt(y|ies)|rules?|regulations?|free trial|demo|tutorial|steps|process|procedure)\b/;
const FIT_PARTNER = /\b(partner|partners|partnership|reseller|resellers|implementation|implement|implementer|implementers|consultan(t|ts|cy|cies)|consulting|integration|integrations|integrate|migration|migrate|support|training|developer|developers|development|customi[sz]ation|customi[sz]e|add-?ons?|plugins?|specialist|specialists|expert|experts|agency|agencies|services?)\b/;
// R60: the words of a public body's own service to a person (with FIT_GOV_NAMES only): nothing a business sells is left once they are taken out
const FIT_GOV_SERVICE = /^(attestation|attestations|attest|attested|legali[sz]ation|legali[sz]e|apostille|notari[sz]ation|passport|passports|visa|visas|residency|iqama|renewal|renew|renewing|fines?|penalty|appointment|appointments|booking|stamp|stamping|medical|fitness|typing|cancellation|cancel|replacement|lost|reprint|fees?|charges?|timings?|working|hours|office|offices|centre|center|centres|centers|near|location|locations|track|tracking|apply|application|form|forms|download|print|copy|expiry|expired|validity|valid|enquiry|inquiry|document|documents|certificate|certificates|degree|degrees|diploma|marriage|birth|educational|personal)$/;
// B-3 (2026-10-17, re-rating 2026-10-17, exec 767): the same refusal WITHOUT a body's name. "mofa attestation dubai" was refused but "uae document
// attestation" and "mofa document attestation" were offered as keyword-gap targets under a High finding: attesting, legalising or notarising a
// person's document is a public service whatever words surround it. A keyword whose own words are such a service word plus document / service
// words is refused as 'government'; "attestation software" or "document attestation management system" keep a product word and stay.
const FIT_DOC_SERVICE = /^(attestation|attestations|attest|attested|attesting|apostille|legali[sz]ation|legali[sz]e|notari[sz]ation|notari[sz]e|notary)$/;
// B-3: a person looking for work is not a buyer ("finance jobs in uae", "finance manager jobs in uae" were offered as easy wins). A job word with no
// product word ("recruitment software", "hr jobs portal system") is refused as 'job search'.
const FIT_JOBS = /\b(jobs?|careers?|vacanc(y|ies)|salary|salaries|internships?|walk ?in interviews?|job openings?|cv|resume)\b/;
const FIT_PRODUCT = /\b(software|system|systems|platform|platforms|tool|tools|app|apps|module|modules|solution|solutions|crm|erp|hrms|hcm|ats|portal software)\b/;
// B-3: words common enough in English that, lifted out of a longer service NAME, they say nothing about the topic: "intelligent" out of
// "Intelligent Document Processing" let "intelligent software solutions" (another company's name) through; "management" out of "Supply Chain
// Management" let "top facilities management companies uae" through; "commerce" out of "Dynamics 365 Commerce" let "commercial companies law
// uae" through. Such a word counts as on topic only when the keyword carries the whole name, or at least two of its words (fitTopic).
const FIT_COMMON = new Set(['management', 'manager', 'document', 'documents', 'processing', 'process', 'processes', 'intelligent', 'intelligence', 'central', 'operations', 'operation', 'operational',
  'project', 'projects', 'field', 'customer', 'customers', 'client', 'clients', 'sales', 'human', 'resources', 'resource', 'commerce', 'commercial', 'supply', 'chain', 'identity', 'model', 'models',
  'predictive', 'virtual', 'desktop', 'studio', 'builder', 'factory', 'pipeline', 'pipelines', 'modernization', 'modernisation', 'enterprise', 'enterprises', 'advanced', 'modern', 'integrated',
  'unified', 'professional', 'premium', 'standard', 'basic', 'core', 'general', 'public', 'private', 'social', 'mobile', 'facility', 'facilities', 'experience', 'insights', 'transformation',
  'innovation', 'value', 'impact', 'productivity', 'efficiency', 'assets', 'asset', 'people', 'team', 'teams', 'growth', 'performance']);
const FIT_COMPARE = /\b(vs|versus|compare|comparison|alternatives?|instead of|better than|difference between|against)\b/;
// F-KW (2026-10-20, finding 8): letters and digits of EVERY script, not a-z only. An Arabic keyword ("برنامج محاسبة في الإمارات") was
// no tokens at all, so a ladder the client chose in Arabic was set aside as `empty` and every Arabic item key was ''. NFKC folds
// full-width and compatibility forms, toLowerCase (never the locale form) folds case; marks (\p{M}) stay inside their word.
const FIT_SPLIT = /[^\p{L}\p{M}\p{N}.]+/u, FIT_SPLIT_WORDS = /[^\p{L}\p{M}\p{N}]+/u;
const fitLow = (s) => String(s || '').normalize('NFKC').toLowerCase();
const fitTokens = (s) => fitLow(s).replace(/[’']/g, '').split(FIT_SPLIT).map(t => t.replace(/^\.+|\.+$/g, '')).filter(t => t.length > 1 && !FIT_STOP.has(t));
const fitHost = (d) => String(d || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^(www|m|app|en|ar)\./, '');
const fitGovHost = (d) => { const h = fitHost(d); return /(^|\.)gov(\.[a-z]{2,3})?$/.test(h) || /(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$/.test(h) || /(^|\.)mil(\.[a-z]{2})?$/.test(h) || /(^|\.)(u\.ae|government\.ae|dubai\.ae|abudhabi\.ae|sharjah\.ae|ajman\.ae|rak\.ae|tax\.gov\.ae|europa\.eu)$/.test(h); };
// the brand label(s) of a domain: "facts.ae" -> ["facts"], "northwind-erp.com" -> ["northwind"] (generic / short parts dropped), "e-invoicing.ae" -> []
const fitLabels = (domain, protect) => { const h = fitHost(domain); if (!h) return []; const first = h.split('.')[0]; const parts = [...new Set([first, ...first.split(/[-_]/)])];
  return parts.map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= FIT_CFG.min_label && !FIT_GENERIC.has(p) && !FIT_GEO.has(p) && !(protect || []).includes(p)); };
// F-KW (2026-10-20, finding 5): a label is the website's own BRAND only when it is distinctive. A label that splits entirely into category,
// generic or place words, or into the words of the keyword or of what the client protected (its ladder heads, its services), describes what
// the site sells ("erp-software.ae", "crmexperts.ae", "accountingsoftware.ae", "interiordesign-dubai.com"); it is not a name, and a keyword
// built from those words is the client's own subject. "techand" does not split ("tech" + the stop word "and" is not allowed), so "techand crm"
// stays the site's own brand. The label itself is never part of its own vocabulary, so "crmexperts reviews" (one word) is still the brand.
const FIT_CATEGORY = new Set(['expert', 'experts', 'specialist', 'specialists', 'consultant', 'advisor', 'advisors', 'advisory', 'agency', 'agencies', 'design', 'designs', 'designer', 'designers',
  'interior', 'interiors', 'outsourcing', 'marketing', 'seo', 'legal', 'law', 'lawyer', 'lawyers', 'clinic', 'clinics', 'dental', 'medical', 'health', 'care', 'realty', 'property', 'properties', 'homes',
  'travel', 'tours', 'logistics', 'cargo', 'shipping', 'trading', 'auto', 'autos', 'cars', 'motors', 'insurance', 'printing', 'events', 'cleaning', 'maintenance', 'security', 'training', 'courses',
  'implementation', 'integration', 'migration', 'support', 'hosting', 'it', 'hr', 'audit', 'auditing', 'bookkeeping', 'consult', 'advice', 'pros', 'works', 'labs', 'studio', 'studios',
  'center', 'centre', 'source', 'point', 'zone', 'link', 'links', 'line', 'now', 'hq', 'co', 'inc', 'llc', 'ltd', 'fz', 'fzco', 'fze', 'dmcc']);
const fitWordBreak = (label, vocab) => { const n = label.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
  for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 30); j < i; j++) if (ok[j] && vocab.has(label.slice(j, i))) { ok[i] = true; break; }
  return ok[n]; };
const fitOwnLabels = (domain, toks, protect) => fitLabels(domain, []).filter(l => {
  const words = [...FIT_GENERIC, ...FIT_GEO, ...FIT_CATEGORY, ...(toks || []), ...(protect || [])].map(w => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(w => w.length >= 2 && w !== l && !FIT_STOP.has(w));
  const vocab = new Set(); for (const w of words) { vocab.add(w); vocab.add(w + 's'); if (w.length > 3 && w.endsWith('s')) vocab.add(w.slice(0, -1)); }
  vocab.delete(l);
  return !fitWordBreak(l, vocab); });
// the learned "name -> domain" map from seo_cache rows (key ai_brands:<site_id>), any shape of row list
const fitLearnedBrands = (rows) => { const out = {}; for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (!j || typeof j !== 'object' || !/^ai_brands:/.test(String(j.key || ''))) continue; let v = j.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && typeof v === 'object') for (const [name, d] of Object.entries(v)) if (name && d) out[String(name)] = String(d); } return out; };
// the organic domains of a DataForSEO SERP answer, in rank order (for ctx.serp)
const fitSerpDomains = (res) => { try { return ((((res || {}).tasks || [])[0] || {}).result || [])[0].items.filter(x => x && x.type === 'organic').sort((a, b) => (a.rank_group || 99) - (b.rank_group || 99)).map(x => fitHost(x.domain || String(x.url || '').replace(/^https?:\/\//, '').split('/')[0])).filter(Boolean); } catch (e) { return []; } };
// ---- R13 (2026-10-13, re-rating §3.11): TOPIC DISTANCE, the same 25% bar the outreach gate uses (OK.OFF_TOPIC in _outreach_kit.js) ----
// The full report's §4a offered "ai" (165,000/mo), "character ai" (110,000), "google ai", "humanize ai", "meta ai", "blackbox ai",
// "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id status with passport
// number", under a High finding telling the owner to build pages for them: the gate only ever refused classes somebody had listed
// (navigational, a declared competitor, a results-page label), so a brand or a subject nobody listed walked straight through. fitTopic()
// measures what share of a keyword's OWN distinctive words the site's topics carry. Place names and generic category words are neutral —
// they count for neither side, so "best erp software dubai" is judged on "erp" — and a keyword left with nothing but generic or place
// words ("ai", "google ai", "microsoft ai") is too broad for any page of this site to win.
const FIT_TOPIC_BAR = 0.25;
// B-3: category words too wide to stand for what a site sells on their own: "dubai business tax" and "uae businesses" were judged "a category you
// sell (business) in your market" because the site's services name "Dynamics 365 Business Central". They never count for a head term.
const FIT_WIDE = new Set(['business', 'businesses', 'company', 'companies', 'firms', 'finance', 'financial', 'tax', 'data', 'digital', 'online', 'web', 'technology', 'technologies', 'tech',
  'solutions', 'solution', 'services', 'service', 'systems', 'system', 'global', 'group', 'national', 'international', 'best', 'top', 'free', 'news', 'jobs', 'careers', 'smart', 'consulting',
  'consultants', 'consultancy', 'partners', 'partner', 'network', 'info', 'guide', 'guides', 'blog', 'list', 'directory', 'review', 'reviews', 'compare', 'comparison', 'pro', 'plus', 'one', 'first',
  'get', 'go', 'easy', 'home', 'world', 'city', 'market', 'media', 'shop', 'store', 'gulf', 'arab', 'arabia', 'emirates', 'google', 'microsoft', 'amazon', 'apple']);
const fitStem = (w) => w.length > 5 ? w.replace(/(ingly|ings|ing|ments|ment|ations|ation|ions|ion|ies|ers|er|ed|es|s|e)$/, '') : w;   // the outreach kit's stem: invoice / invoices / invoicing -> invoic
const fitTopicWords = (topics) => new Set((Array.isArray(topics) ? topics.filter(Boolean).join(' ') : String(topics || '')).normalize('NFKC').toLowerCase()
  .split(FIT_SPLIT_WORDS).filter(t => t.length > 2 && !FIT_STOP.has(t) && !FIT_GEO.has(t)).map(fitStem));
// B-3: the topics as PHRASES (one service name, one configured keyword, one description), so a common word can be judged against the name
// it came from. `dist` = the phrase's own distinctive words (stemmed); prose (more than 6 of them) never vouches for a common word.
const fitTopicPhrases = (topics) => (Array.isArray(topics) ? topics.filter(Boolean).map(String) : [String(topics || '')])
  .map(t => { const w = fitLow(t).split(FIT_SPLIT_WORDS).filter(x => x.length > 2 && !FIT_STOP.has(x) && !FIT_GEO.has(x) && !/^\d+$/.test(x));
    return { dist: [...new Set(w.filter(x => !FIT_GENERIC.has(x)).map(fitStem))], words: [...new Set(w.map(fitStem))] }; })
  .filter(p => p.dist.length).map(p => ({ ...p, prose: p.dist.length > 6 }));
function fitTopic(keyword, topics, ctx) {
  const o = ctx || {};
  const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
  const label = String(o.topic_label || 'what this website sells');
  const T = fitTopicWords(topics);
  const PH = fitTopicPhrases(topics);
  // With little on file the measure would refuse good keywords, so under topic_min_words (12) distinctive words it judges nothing: a site
  // whose services and description are a single line gets no topic refusals at all ("no evidence, no refusal").
  if (T.size < (typeof o.topic_min_words === 'number' ? o.topic_min_words : 12)) return { ok: true, reason: '', detail: T.size ? 'too few topic words on file (' + T.size + ') to judge topic distance' : 'no topics on file, so topic distance was not judged', share: null };
  const toks = fitTokens(keyword);
  const own = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !/^\d+$/.test(t));   // F-KW: a year or a number ("2026") is neutral, like a place
  const known = [...T];
  const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
  const matches = (t) => { const s = fitStem(t); return T.has(s) || known.some(x => stemHit(s, x)); };
  // B-3: a common word (FIT_COMMON) is on topic only through a service NAME the keyword carries whole, or two words of (prose never vouches)
  // ("business central partner uae" carries two words of "Dynamics 365 Business Central"; "intelligent software solutions" one of "Intelligent Document Processing")
  const ownStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t) && !FIT_GENERIC.has(t) && !/^\d+$/.test(t)).map(fitStem);
  const allStems = toks.filter(t => t.length > 2 && !FIT_GEO.has(t)).map(fitStem);
  const viaName = (t) => { const s = fitStem(t); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x))
    && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
  const matchOwn = (t) => FIT_COMMON.has(t) ? viaName(t) : matches(t);
  // a keyword made only of category and place words is a head term: it is on topic when at least two of those categories are the site's own
  // ("erp software uae", "best erp software dubai"), and too broad when only one is and there is no market in it either ("ai", "google ai")
  if (!own.length) {
    const cats = toks.filter(t => FIT_GENERIC.has(t) && !FIT_WIDE.has(t)).filter(matches);   // B-3: a wide word never stands for a category
    const hasPlace = toks.some(t => FIT_GEO.has(t));
    if (cats.length >= 2 || (cats.length >= 1 && hasPlace)) return { ok: true, reason: '', detail: 'a category you sell (' + cats.join(', ') + ')' + (hasPlace ? ' in your market' : ''), share: 1 };
    return { ok: false, reason: 'too broad', detail: 'only category or place words, so it says nothing about ' + label + ' ("' + String(keyword || '').trim() + '")', share: cats.length ? 0.5 : 0 };
  }
  const hits = own.filter(matchOwn);
  const share = Math.round(100 * hits.length / own.length) / 100;
  if (share < bar) return { ok: false, reason: 'off topic', detail: Math.round(share * 100) + '% of its own words match ' + label + ' (' + Math.round(bar * 100) + '% is the bar): '
    + own.filter(t => hits.indexOf(t) < 0).slice(0, 4).join(', ') + '. Add it to your services if you do sell it.', share };
  return { ok: true, reason: '', detail: Math.round(share * 100) + '% of its own words match ' + label, share };
}
// ---- F-KW (2026-10-20, findings 1 and 2): POSITIVE topic evidence, for the decisions that write on their own ----
// fitTopic answers "may we refuse it?" and, with fewer than 12 topic words on file, refuses nothing ("no evidence, no refusal"). That is the
// right rule for a refusal and the wrong one for writing a page on our own: a site that lists two services passed every keyword. fitEvidence
// answers "is there evidence it is the client's subject?": `in` = at least the topic bar of the keyword's own words is in the topics given (any
// number of topic words); `out` = with 12+ topic words on file the keyword misses the bar (a refusal); `unknown` = too little on file to say,
// which a caller must treat as NOT in topic (a suggestion at most) and say so in plain words.
// F-REH (2026-10-20, real-credit rehearsal): a DECLARED service's product-category word is positive evidence. "crm service provider uae" for a
// client who listed "CRM implementation" came back "not enough information": `crm` is a category word (FIT_GENERIC), which the share rule
// treats as neutral, so the keyword was judged on "provider" alone. When the client named the category in a service (ctx.services = the
// services they DECLARED, never the crawl's guesses), that word counts as one of the keyword's own words AND as a hit, at any number of topic
// words on file. Only product categories qualify: `ai`, `software`, `cloud` and the wide words never do ("character ai" stays off topic for an
// "AI consulting" site); a FIT_COMMON word ("sales", "central") still needs the whole service name, as in fitTopic.
const FIT_SERVICE_CATS = new Set(['erp', 'crm', 'hrms', 'hcm', 'wms', 'pos', 'vat', 'invoice', 'invoices', 'invoicing', 'einvoicing', 'accounting', 'accountants', 'payroll']);
const fitServiceAnchors = (keyword, services) => {
  const svc = new Set((Array.isArray(services) ? services : [services]).filter(Boolean).flatMap(x => fitTokens(String(x))).filter(t => FIT_SERVICE_CATS.has(t)).map(fitStem));
  if (!svc.size) return [];
  return [...new Set(fitTokens(keyword).filter(t => FIT_SERVICE_CATS.has(t) && svc.has(fitStem(t))))];
};
function fitEvidence(keyword, topics, ctx) {
  const o = ctx || {};
  const T = fitTopicWords(topics);
  const anchors = fitServiceAnchors(keyword, o.services || []);
  const t = T.size ? fitTopic(keyword, topics, { ...o, topic_min_words: 1 }) : { ok: false, share: null, detail: '' };
  if (t.ok && t.share != null) return { verdict: 'in', share: t.share, words: T.size, detail: t.detail, basis: 'topics' };
  if (anchors.length) {
    // the share again, with the declared category word counted as the keyword's own and as matched
    const toks = fitTokens(keyword);
    const own = toks.filter(x => x.length > 2 && !FIT_GEO.has(x) && !FIT_GENERIC.has(x) && !/^\d+$/.test(x));
    const PH = fitTopicPhrases(topics), known = [...T];
    const stemHit = (s, x) => x === s || (x.length >= 5 && s.length >= 5 && (s.indexOf(x) === 0 || x.indexOf(s) === 0));
    const ownStems = own.map(fitStem), allStems = toks.filter(x => x.length > 2 && !FIT_GEO.has(x)).map(fitStem);
    const viaName = (w) => { const s = fitStem(w); return PH.some(ph => !ph.prose && ph.dist.some(x => stemHit(s, x)) && (ph.dist.every(x => ownStems.some(k => stemHit(k, x))) || ph.words.filter(x => allStems.some(k => stemHit(k, x))).length >= 2)); };
    const hit = (w) => FIT_COMMON.has(w) ? viaName(w) : (T.has(fitStem(w)) || known.some(x => stemHit(fitStem(w), x)));
    const hits = own.filter(hit).length + anchors.length, all = own.length + anchors.length;
    const share = Math.round(100 * hits / all) / 100;
    const bar = typeof o.topic_bar === 'number' ? o.topic_bar : FIT_TOPIC_BAR;
    if (share >= bar) return { verdict: 'in', share, words: T.size, basis: 'declared service', anchors,
      detail: '"' + anchors.join('", "') + '" is one of the services you listed' + (own.length ? ' (' + Math.round(share * 100) + '% of its own words match)' : '') };
  }
  if (!T.size) return { verdict: 'unknown', share: null, words: 0, detail: 'nothing is on file yet about what this website sells or which keywords you chose' };
  if (T.size >= 12) return { verdict: 'out', share: t.share == null ? null : t.share, words: T.size, detail: t.detail };
  return { verdict: 'unknown', share: t.share == null ? null : t.share, words: T.size, detail: 'too little is on file about what this website sells to tell whether this keyword is part of it' };
}
// ctx: { intent, own_domain, competitors: [domains, declared], serp_domains: [domains on the results page / auto-detected rivals], brands: { name: domain } (learned),
//       serp: [this keyword's own top domains, in rank order] (optional), protect: [words of the head term / seeds / services], relevance: fn (G19 hook) }
function fitGate(keyword, ctx) {
  ctx = ctx || {};
  const kw = String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const toks = fitTokens(kw); const squashed = toks.join('');
  if (!toks.length) return { ok: false, reason: 'empty', detail: 'no keyword' };
  const protect = [...new Set((ctx.protect || []).flatMap(p => fitTokens(p)))];
  const has = (re) => re.test(' ' + kw + ' ');
  const contentWord = has(FIT_CONTENT), partnerWord = has(FIT_PARTNER), compareWord = has(FIT_COMPARE), portalWord = has(FIT_PORTAL);
  // 1. the website itself
  // F-KW (2026-10-20, finding 5): only a DISTINCTIVE label is a brand. On an exact-match domain the label is made of the very words the client
  //    sells ("erp-software.ae" -> "erpsoftware"), and "erp software uae" was refused as the site's own brand (fitOwnLabels above).
  for (const l of fitOwnLabels(ctx.own_domain, toks, protect)) if (toks.includes(l) || squashed.includes(l)) return { ok: false, reason: 'own brand', detail: 'names the website itself (' + l + ')' };
  // 2. the search data says navigational
  if (String(ctx.intent || '').toLowerCase() === 'navigational') return { ok: false, reason: 'navigational', detail: 'the search data classifies it as navigational (people look for one particular website)' };
  // 3. a public body or an identity document: "ministry of finance", "federal tax authority" (no content / buying word), "fta", "emaratax uae",
  //    "emirates id status" (the body alone, or with a portal / status word); "zatca e invoicing" and "fta vat registration" are topics and stay
  const govWord = (' ' + kw + ' ').match(FIT_GOV_WORDS);
  if (govWord && !contentWord) return { ok: false, reason: 'government', detail: 'a public body, not a topic (' + String(govWord[1] || govWord[0]).trim() + ')' };
  const govName = (' ' + kw + ' ').match(FIT_GOV_NAMES);
  if (govName) {
    const body = String(govName[1] || govName[0]).trim();
    const rest = toks.filter(t => !fitTokens(body).includes(t) && !FIT_GEO.has(t) && !/^(check|checking|card|number|no|online|status)$/.test(t));
    if (!rest.length || (portalWord && !contentWord)) return { ok: false, reason: 'government', detail: 'a public body or an identity document, not a topic (' + body + ')' };
    // R60 (2026-10-16, re-rating 2026-10-15): "mofa attestation dubai" and "how to check emirates id status with passport number" walked
    // through because one more word ("attestation", "passport") or a content word ("how to") made them look like a topic. A word that only
    // names what the public body does FOR A PERSON (attest a document, issue a passport or visa, renew a card, collect a fine, book an
    // appointment) adds no topic: the searcher still wants the body's own service, whatever "how to" is in front of it. "fta vat registration"
    // and "zatca e invoicing" keep a business topic word of their own, so they stay.
    if (rest.every(t => FIT_GOV_SERVICE.test(t))) return { ok: false, reason: 'government', detail: 'a service a public body provides to a person, not a topic for this website (' + body + ': ' + rest.join(' ') + ')' };
  }
  const serp = (ctx.serp || []).map(fitHost).filter(Boolean).slice(0, FIT_CFG.serp_top);
  if (serp.length >= FIT_CFG.serp_hold && serp.filter(fitGovHost).length >= FIT_CFG.serp_hold) return { ok: false, reason: 'government', detail: 'the results page belongs to government sites (' + [...new Set(serp.filter(fitGovHost))].slice(0, 3).join(', ') + ')' };
  // B-3 (2026-10-17): what the site's own topics say it sells (empty when none are on file), for the two rules below
  const topicT = (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) ? fitTopicWords(ctx.topics) : null;
  const sells = (re) => !!topicT && [...topicT].some(w => re.test(w));
  // 3b. a document service a public body provides to a person, without the body's name ("uae document attestation"): refused unless the
  //     site's own topics say it sells that service (an attestation agency keeps it)
  const docSvc = toks.filter(t => FIT_DOC_SERVICE.test(t));
  if (docSvc.length && !sells(/^(attest|apostill|legali|notar)/)) {
    const restD = toks.filter(t => !FIT_GEO.has(t) && !FIT_DOC_SERVICE.test(t) && !FIT_GOV_SERVICE.test(t) && !FIT_GOV_NAMES.test(' ' + t + ' ')
      && !/^(online|services?|centre|center|centres|centers|near|price|prices|cost|costs|company|companies|agency|agencies|best|top|cheap|fast|same|day|requirements?|procedure|process|steps)$/.test(t));
    if (!restD.length) return { ok: false, reason: 'government', detail: 'a document service public bodies (a ministry, an embassy, a notary) provide to a person (' + docSvc.join(' ') + '), not a topic for this website' };
  }
  // 4. a login / portal / status task
  if (portalWord && !contentWord) return { ok: false, reason: 'portal', detail: 'a login, portal, status or application task: people want the owner\'s own site' };
  // 4b. a person looking for work (B-3): no product word in it, and the site's topics are not recruitment
  if (has(FIT_JOBS) && !has(FIT_PRODUCT) && !sells(/^(recruit|staff|hiring|job|career|headhunt|talent)/)) return { ok: false, reason: 'job search', detail: 'people looking for work, not buyers of what this website sells' };
  // 5. another company's brand. A declared competitor's label counts anywhere in the keyword; a results-page label (often a dictionary word:
  //    facts.ae) only where a product name sits — first, or right before a category word ("facts erp", "best facts erp"; not "erp facts and figures")
  const rescue = partnerWord || compareWord;
  const leads = (l) => { const i = toks.indexOf(l); return i === 0 || (i > 0 && i + 1 < toks.length && (FIT_GENERIC.has(toks[i + 1]) || protect.includes(toks[i + 1]))); };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) if ((toks.includes(l) || squashed.includes(l)) && !compareWord) return { ok: false, reason: 'other brand', detail: 'names a competitor: ' + l + ' (' + fitHost(d) + ')' };
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) if (toks.includes(l) && leads(l) && !rescue) return { ok: false, reason: 'other brand', detail: 'names another company on the results page: ' + l + ' (' + fitHost(d) + ')' };
  for (const [name, d] of Object.entries(ctx.brands || {})) {
    const nt = fitTokens(name).filter(t => !FIT_GENERIC.has(t) && !protect.includes(t));
    if (!nt.length || rescue) continue;
    const phrase = nt.join(' ');
    if ((' ' + toks.join(' ') + ' ').includes(' ' + phrase + ' ') || fitLabels(d, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: 'a brand AI names for another company: ' + name + ' (' + fitHost(d) + ')' };
  }
  if (serp.length >= FIT_CFG.serp_hold) {
    const count = {}; for (const h of serp) count[h] = (count[h] || 0) + 1;
    for (const [h, n] of Object.entries(count)) if (n >= FIT_CFG.serp_hold && fitLabels(h, protect).some(l => toks.includes(l))) return { ok: false, reason: 'other brand', detail: h + ' holds ' + n + ' of the top ' + serp.length + ' results: a brand query' };
  }
  // 6. relevance to the website's services: the caller's own hook (G19) first, else the topic bar when the caller gave topics (R13)
  if (typeof ctx.relevance === 'function') { const r = ctx.relevance(kw); if (r && r.ok === false) return { ok: false, reason: r.reason || 'off topic', detail: r.detail || '' }; }
  else if (ctx.topics && (Array.isArray(ctx.topics) ? ctx.topics.length : String(ctx.topics).trim())) {
    const t = fitTopic(kw, ctx.topics, ctx); if (!t.ok) return { ok: false, reason: t.reason, detail: t.detail };
  }
  return { ok: true };
}
// one line for reports and prompts: "facts (facts.ae), cleartax (cleartax.com), Zoho Books (zoho.com)"
const fitBrandList = (ctx, protect) => { const out = []; const seen = new Set(); const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const d of (ctx.competitors || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const d of (ctx.serp_domains || [])) for (const l of fitLabels(d, protect)) add(l + ' (' + fitHost(d) + ')');
  for (const [n, d] of Object.entries(ctx.brands || {})) add(n + ' (' + fitHost(d) + ')');
  return out.slice(0, 40).join(', '); };
// ---- R16 (2026-10-13, system review FIX_PLAN §3.11): the same gate, run over a row somebody stored BEFORE the gate existed ----
// The gate stops a new keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of lad_mv40b6s9h5a8 still held
// "facts erp" (facts.ae, a competing UAE ERP vendor) as a planned page, so the Rank Tracker's report of 2026-10-12 listed it and the
// Content Cadence would have written it. `fitStored` is `fitGate` plus the one rule a stored row needs: a rung whose page is already
// written or published is never dropped — that page is live work, it keeps being tracked, and it is flagged instead of hidden.
// Returns { ok, live, flagged, reason, detail, note }: ok false = leave it out of what is written and reported; `note` is the sentence
// a report or the repair script prints, so the reason always travels with the decision.
const fitStoredLive = (row) => { const r = row || {}; const st = String(r.status || '').toLowerCase();
  return st === 'writing' || st === 'written' || st === 'not_ready' || st === 'published' || r.page_exists === true || r.page_exists === 'true' || !!String(r.published_url || '').trim(); };
const fitStored = (row, ctx) => {
  const r = row || {}; const kw = String(r.keyword || '').trim();
  const live = fitStoredLive(r) || (ctx || {}).written === true;
  if (!kw) return { ok: false, live, flagged: false, reason: 'empty', detail: 'the row has no keyword', note: 'a stored row with no keyword' };
  const g = fitGate(kw, ctx || {});
  if (g.ok) return { ok: true, live, flagged: false, reason: '', detail: '', note: '' };
  const why = '"' + kw + '" is not a search this website should target: ' + g.detail + ' (' + g.reason + ')';
  // F-KW (2026-10-20, finding 10): plain sentences, and no claim about WHEN the row was planned: a row written after the gate existed (its
  // results page changed, a competitor was declared later) is set aside by the same rule, and "planned before this rule existed" was false for it
  if (live) return { ok: true, live: true, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. Its page is already written, so it stays tracked; decide whether to keep it.' };
  return { ok: false, live: false, flagged: true, reason: g.reason, detail: g.detail,
    note: why + '. It is set aside, so no page is written for it.' };
};
// ---- B-G1 / B-G2 / B-G3 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the READ path, written once ----
// R16 put `fitStored` on two read paths — the Rank Tracker and the Content Cadence — and wrote the loop around it twice. Three more
// readers of the same stored rungs were written afterwards without it, and every one of them ACTS on what it reads: *AI Plan* (the AI
// Visibility Tracker and the AI Pulse) turns a stored rung into a question asked of ChatGPT and then scores the site against the answer;
// *Growth Plan* turns it into a "question to win" and then into a page the Content Cadence writes; *Site Plan* buys it a live rank check
// every week and prints it in the weekly report. Three copies of one loop are three chances to drift, and the drift IS this defect — so
// the loop lives here, once, and every reader calls it. FITR.rungs() never throws a refusal away: `set_aside` carries the row, the reason
// and the sentence to print, because a list that is shorter because a gate ran has to say so (INVARIANTS rule 1).
const FITR = {
  // The context a stored row is judged in. Deliberately the shape R16's two callers build by hand: the site's own domain, the
  // competitors it declared, the brand names AI uses for other companies, and — PROTECTED, so the ladder's own subject can never look
  // like somebody's brand — the ladder head terms, the site's services and its own tracked keywords. Topics are optional: with none on
  // file the topic bar judges nothing (fitTopic's own "no evidence, no refusal" rule).
  ctx(o) {
    o = o || {};
    const own = fitHost(o.own_domain || o.domain || '');
    const protect = [...new Set([...(o.heads || []), ...(o.services || []), ...(o.keywords || []), ...(o.protect || [])]
      .map(x => String(x || '').trim()).filter(Boolean))];
    return { own_domain: own, brands: o.brands || {}, intent: o.intent || '',
      competitors: [...new Set((o.competitors || []).map(fitHost).filter(d => d && d !== own))],
      serp_domains: (o.serp_domains || []).map(fitHost).filter(Boolean), protect,
      topics: o.topics && (Array.isArray(o.topics) ? o.topics.length : String(o.topics).trim()) ? o.topics : null,
      topic_label: o.topic_label || 'what this website sells' };
  },
  // Every stored row, gated once. Returns { keep, set_aside, dropped, flagged, refused_keywords }:
  //   keep      — what the caller may act on (a row whose page is already written stays: that page is live work);
  //   set_aside — one record per refusal, with `reason`, `detail`, `note` (the sentence to print), `written` and `dropped`.
  // opts: { keyword: row -> the keyword (default row.keyword), live: row -> true when the row must be kept and only flagged,
  //         serpFor: (keyword, row) -> [domains in rank order] for the results-page rules, where: a label naming this read path }.
  rungs(rows, ctx, opts) {
    const o = opts || {}; const C = ctx || {};
    const kwOf = typeof o.keyword === 'function' ? o.keyword : ((r) => (r || {}).keyword);
    const liveOf = typeof o.live === 'function' ? o.live : null;
    const serpFor = typeof o.serpFor === 'function' ? o.serpFor : null;
    const keep = []; const set_aside = [];
    for (const r0 of (rows || [])) {
      const r = (r0 && typeof r0 === 'object') ? r0 : {};
      const kw = String(kwOf(r0) || '').trim();
      if (!kw) { keep.push(r0); continue; }   // a row with no keyword is not this gate's business (the caller's own emptiness rules apply)
      const serp = serpFor ? (serpFor(kw, r0) || []).map(fitHost).filter(Boolean) : [];
      let c = C;
      if (serp.length) c = { ...c, serp, serp_domains: [...new Set([...(C.serp_domains || []), ...serp])] };
      if (liveOf && liveOf(r0)) c = { ...c, written: true };
      const g = fitStored({ ...r, keyword: kw }, c);
      if (g.ok) keep.push(r0);
      if (!g.flagged) continue;
      set_aside.push({ keyword: kw, reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok,
        where: String(o.where || ''), ladder_id: r.ladder_id || '', head_keyword: r.head_keyword || '', rung: Number(r.rung) || 0,
        page_no: Number(r.page_no) || 0, status: r.status || '', target_url: r.target_url || '', prompt_id: r.prompt_id || '' });
    }
    return { keep, set_aside, dropped: set_aside.filter(x => x.dropped), flagged: set_aside.filter(x => !x.dropped),
      refused_keywords: set_aside.filter(x => x.dropped).map(x => x.keyword) };
  },
  // The sentence a human reads. INVARIANTS rule 1: a list that is shorter because a gate ran says so, with the reason, every time.
  // `what` finishes "so they are not …" ("asked of the AI engines", "tracked", "written as a page").
  line(set_aside, what) {
    const a = (set_aside || []).filter(x => x && x.dropped);
    if (!a.length) return '';
    return a.length + ' stored keyword' + (a.length === 1 ? ' was' : 's were') + ' set aside, so ' + (a.length === 1 ? 'it is' : 'they are')
      + ' not ' + String(what || 'used') + ': ' + a.slice(0, 6).map(x => '"' + x.keyword + '" (' + (x.detail || x.reason) + ')').join('; ')
      + (a.length > 6 ? ' (and ' + (a.length - 6) + ' more)' : '')
      + '. A page that is already written is kept and only flagged.';
  }
};
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let jobs = []; try { jobs = $('Prompt Jobs').all().map(i => i.json).filter(j => !j.skip); } catch (e) {}
let outs = []; try { outs = $('Prompt Writer').all().map(i => i.json); } catch (e) {}
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery Answers').all().map(i => i.json || {}); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const now = new Date().toISOString(); const rows = [];
const KINDS = ['recommend', 'choose', 'cost', 'compare', 'problem', 'brand'], STAGES = ['awareness', 'consideration', 'decision', 'brand'], ORIGINS = ['market', 'search', 'writer', 'paa', 'competitor'];
const STAGE_OF = { recommend: 'decision', cost: 'decision', choose: 'consideration', compare: 'consideration', problem: 'awareness', brand: 'brand', custom: 'consideration' };
// monthly AI search volume per search phrase (AI Keyword Data), per site
const volumes = new Map();
dreq.forEach((q, i) => { if (q.kind !== 'volume') return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
  const m = volumes.get(q.site_id) || new Map(); for (const it of (((t.result || [])[0] || {}).items || [])) if (it && it.keyword) m.set(String(it.keyword).toLowerCase().trim(), Number(it.ai_search_volume) || 0); volumes.set(q.site_id, m); });
const COLS = (r) => ({ prompt_id: r.prompt_id, site_id: r.site_id, domain: r.domain, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source, status: r.status || 'active', created_at: r.created_at,
  stage: r.stage || '', cluster: r.cluster || '', volume: r.volume == null || Number.isNaN(r.volume) ? null : Number(r.volume), origin: r.origin || '', updated_at: now,
  persona: String(r.persona || '').slice(0, 40), market: String(r.market || ''), pinned: r.pinned === true, fit_note: String(r.fit_note || '').slice(0, 400) });
let dupes = 0;
for (const p of plans) {
  const vol = volumes.get(p.site_id) || new Map();
  // stored questions: new volume (and a stage / cluster for questions written before v4.9)
  for (const q of p.prompts) { const k = String(q.keyword || '').toLowerCase().trim(); const v = vol.has(k) ? vol.get(k) : null;
    if (v === null && q.stage && q.cluster) continue;
    if (v === null && q.kind === 'brand' && q.stage) continue;
    rows.push(COLS({ ...q, site_id: p.site_id, domain: p.domain, status: 'active', volume: v !== null ? v : q.volume, stage: q.stage || STAGE_OF[q.kind] || 'consideration', cluster: q.cluster || q.topic || '' })); }
  if (!p.need_prompts) continue;
  // every job of this site (G6: several — one per market x buyer role), each with its writer's answer
  const mine = jobs.map((j, i) => ({ j, o: outs[i] })).filter(x => x.j.site_id === p.site_id);
  let qs = [];
  for (const { j, o } of mine) {
    const got = o && !o.error ? parse(o.output) : null;
    for (const q of (got && Array.isArray(got.prompts) ? got.prompts : [])) {
      if (!q || !q.prompt || String(q.prompt).length < 12) continue;
      const kind = KINDS.includes(String(q.kind).toLowerCase()) ? String(q.kind).toLowerCase() : 'recommend';
      qs.push({ prompt: String(q.prompt).trim().slice(0, 300), kind, topic: String(q.cluster || q.topic || '').slice(0, 120), keyword: String(q.keyword || q.cluster || q.topic || '').toLowerCase().slice(0, 120), source: 'auto',
        stage: STAGES.includes(String(q.stage).toLowerCase()) ? String(q.stage).toLowerCase() : STAGE_OF[kind], cluster: String(q.cluster || q.topic || '').toLowerCase().slice(0, 60),
        origin: ORIGINS.includes(String(q.origin).toLowerCase()) ? String(q.origin).toLowerCase() : 'writer', persona: String(j.persona || q.persona || '').trim().slice(0, 40), market: j.market || p.own_market || '' });
    }
  }
  if (!qs.length) {   // template fallback: the same buyer journey, less natural wording
    const where = p.country ? ' in ' + (p.city || p.country) : '';
    for (const t of (p.topics.length ? p.topics : [p.domain.split('.')[0]]).slice(0, 4)) qs.push({ prompt: 'Which companies offer ' + t + where + '? Recommend the best options with their websites.', kind: 'recommend', topic: t, keyword: t, source: 'template', stage: 'decision', cluster: t, origin: 'template', market: p.own_market || '' }, { prompt: 'How do I choose a provider for ' + t + where + ', and what should it cost?', kind: 'choose', topic: t, keyword: t + ' cost', source: 'template', stage: 'consideration', cluster: t, origin: 'template', market: p.own_market || '' });
    if (!p.prompts.some(x => x.kind === 'brand')) qs.unshift({ prompt: 'What is ' + (p.business_name || p.domain) + ' (' + p.domain + ') and what does it offer?', kind: 'brand', topic: 'brand', keyword: p.business_name || p.domain.split('.')[0], source: 'template', stage: 'brand', cluster: 'brand', origin: 'template', market: p.own_market || '' });
  }
  // G6: the same question in other words is one question — against the stored panel and against the other new ones
  const brandQ = qs.filter(q => q.kind === 'brand'); const buyerQ = qs.filter(q => q.kind !== 'brand');
  const dd = AIP.dedupe(buyerQ, p.prompts.filter(q => q.kind !== 'brand').map(q => ({ prompt: q.prompt, persona: q.persona, market: q.market || p.own_market })));
  // G6: the fit gate, on the search phrase AND on the wording (the brand question is about the site itself and is never judged here)
  const ctx = FITR.ctx(p.fit_input || { own_domain: p.domain, competitors: p.competitors || [], brands: p.aliases || {} });
  const judge = (q) => { const a = fitGate(q.keyword || '', ctx); if (!a.ok) return a; const b = fitGate(q.prompt, { ...ctx, topics: null }); return b.ok ? { ok: true } : b; };
  const have = new Set(p.prompts.map(x => norm(x.prompt))); let added = 0;
  for (const q of [...brandQ, ...dd.keep]) { if (added >= p.prompts_needed) break; if (have.has(norm(q.prompt))) continue; have.add(norm(q.prompt));
    const v = q.kind === 'brand' ? { ok: true } : judge(q);
    const base = { prompt_id: 'p_' + hash(p.site_id + '|' + norm(q.prompt)), site_id: p.site_id, domain: p.domain, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword || q.topic, source: q.source, created_at: now,
      stage: q.stage, cluster: q.cluster, volume: vol.has(String(q.keyword || '').toLowerCase().trim()) ? vol.get(String(q.keyword || '').toLowerCase().trim()) : null, origin: q.origin, persona: q.persona || '', market: q.market || p.own_market || '', fresh: true };
    if (!v.ok) { rows.push(COLS({ ...base, status: 'refused', fit_note: '"' + q.prompt + '" was not added: ' + (v.detail || v.reason) + ' (' + v.reason + ')' })); continue; }
    added++;
    rows.push(COLS({ ...base, status: 'active' })); }
  // a question dropped as a repeat is not stored (it IS on the panel, in its first wording); the report counts them
  dupes += dd.dup.length;
}
// exact table columns only: the Save Prompts node maps every field it is given. AI Metrics reads the refused rows (status, fit_note) back.
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, duplicates_dropped: dupes } }];
