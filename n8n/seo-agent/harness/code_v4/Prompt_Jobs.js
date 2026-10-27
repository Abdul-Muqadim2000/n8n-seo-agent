// Sites whose question panel is short get Prompt Writer jobs (Claude writes the buyer questions once; they are stored and reused weekly).
// v4.9: the writer also gets real questions to start from — what people ask AI about the topic (the AI-answer database, with monthly AI search
// volume) and the long / question-shaped searches the site already appears for (Search Console) — so the panel mirrors real demand.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): a panel of up to 500 questions is written in CELLS — market (country + language) x persona (buyer
// role) — each cell its own job of at most AIP.LIMITS.writer_batch questions, so every buyer role and every market gets its share and one
// answer always fits the writer's budget. The writer is also given the People-Also-Ask questions of the site's topics (Google's own
// question box, read from the results page) and what up to three competitors' homepages say they sell (topic ideas, never names). With no
// personas on file a panel over 50 questions is written for four generic buyer roles, so it is still segmented; the owner sets real ones.
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
    done_fresh_hours: 20,             // R-E1: a run that FINISHED this recently answers an on-demand / catch-up start with its stored week
                                      // (a retry of the same cycle job is answered so whatever the hour); nothing is asked or paid again
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
  /** the markets a site's panel covers: its own first, then the extra ones in its settings and the stored questions' own markets, at most
   *  MARKETS_MAX (E22, 2026-10-23: the comment said 6 while the code kept 8; the app caps the settings at 5, the stored questions can add
   *  more). A question whose market falls past the cap is asked in the site's own market and the request says so (`market_fallback`). */
  const MARKETS_MAX = 8;
  const marketsOf = (site) => {
    const own = normMarket(S(site.country_iso) + '-' + S(site.language_code || 'en')) || 'US-en';
    const extra = listOf(site.ai_markets).map(m => normMarket(m, 'en')).filter(Boolean);
    return [...new Set([own, ...extra])].slice(0, MARKETS_MAX);
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
  const stageOf = (s) => { const x = S(s).toLowerCase(); return ['awareness', 'consideration', 'decision', 'brand', 'shopping'].includes(x) ? x : ''; };

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

  // ---- 3b. a question's identity and its search phrase (F2, 2026-10-23: ENGINE_AUDIT.md E2 / E15 / E9) ---------------------------------
  // E2: the old normaliser kept only [a-z0-9], so every Arabic (any non-Latin) question became the empty string — one prompt id for all of
  // them, the first stored and every later one overwriting its wording. E15: that id was a 32-bit djb2 hash in one key space shared by every
  // site, upserted on `prompt_id` alone, so a collision moved one site's question to another (~25% odds at 50k questions).
  // Now: ONE normal form for every script (NFKC, lower case, Arabic harakat / tatweel dropped, anything that is not a letter, digit or mark
  // is a space), and a 64-bit id (two independent 32-bit mixes, cyrb53's mixing without the 53-bit cut) over `site_id | normal form`,
  // prefixed `q_` so a new id can never be read as an old `p_` one. Save Prompts and the Site Admin upsert on (site_id, prompt_id).
  // A stored question keeps the id it was stored with (its trend and its answer history hang on it): writers and the Site Admin match an
  // existing row by its id OR its normal form first, and only a question new to the site gets a new id.
  const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  const normQ = (t) => S(t).normalize('NFKC').toLowerCase().replace(AR_MARKS, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const hash64 = (t) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const s = String(t);
    for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36).padStart(7, '0') + (h1 >>> 0).toString(36).padStart(7, '0');
  };
  /** the stable id of a question on one site: 'q_' + 64 bits over the site and the question's normal form */
  const promptId = (site_id, prompt) => 'q_' + hash64(S(site_id) + '|' + normQ(prompt));
  /** a stored row that IS this question (same id, or same normal form) — so a reworded-identical question keeps its stored id */
  const findStored = (rows, site_id, prompt) => { const n = normQ(prompt); if (!n) return null;
    return (rows || []).find(r => r && S(r.site_id) === S(site_id) && (S(r.prompt_id) === promptId(site_id, prompt) || normQ(r.prompt) === n)) || null; };
  // E9: an owner's question got the first five words as its search phrase ("what should i check before"), and the AI Overview presence,
  // the AI search volume and the fit gate were all measured on that fragment. The phrase is now the question's content words in their own
  // order (question words, stop words and filler dropped, hyphenated words kept whole, at most 6) — or the owner's own keyword when given.
  // `keyword_source` says which: 'owner' (typed by the owner), 'writer' (the Prompt Writer's search phrase), 'template', 'derived' (built
  // here). A derived phrase is not a search anyone typed, so AI Requests does not ask Google's AI Overview for it.
  const KW_DROP = new Set(('a an and are as at be been before being best both by can could did do does doing each few for from get gets give has have '
    + 'help how i if in into is it its just know like list looking me more most much my need needs of on or our please really recommend '
    + 'recommended should so some tell than that the their them then there these they this those to top us very vs versus want was way ways '
    + 'we what whats what\'s when where which while who whom whose why will with without would you your yours check good great right near '
    + 'any also about after etc options option thing things kind kinds sort type types able actually currently today now there\'s '
    + 'ما ماذا هي هو هل في من على عن إلى الى كيف لماذا أي اي التي الذي مع أو او و هذا هذه ذلك تلك كم لدي لدى أفضل افضل يمكن يجب').split(/\s+/));
  const keywordOf = (prompt) => {
    const words = (S(prompt).normalize('NFKC').replace(AR_MARKS, '').match(/[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*/gu) || [])
      .map(t => ({ t, w: t.toLowerCase().replace(/’/g, '\'') }))
      .filter(({ t, w }) => (t === 'IT' || (!KW_DROP.has(w) && !KW_DROP.has(w.replace(/'s$/, '')))) && (w.length >= 2 || /^\d+$/.test(w) || /[^\x00-\x7f]/.test(w)))   // "IT" (information technology) is a word, "it" is not
      .map(({ w }) => w);
    const kw = [...new Set(words)].slice(0, 6).join(' ').slice(0, 120).trim();
    return kw || normQ(prompt).split(' ').slice(0, 6).join(' ').slice(0, 120);
  };
  const KEYWORD_SOURCES = ['owner', 'writer', 'template', 'derived'];

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
   *  is running right now), 'blocked' (F2: the run was STOPPED — its answers were not stored or it reached its money ceiling — and nothing
   *  of this site's weekly run is asked again until a human clears the row or the run is older than resume_days; a `failed_store` stop is
   *  checked again by every later start, see healStore), 'closed' (finished, or
   *  too old to resume) */
  const STOPPED = ['failed_store', 'stopped_ceiling', 'stopped'];
  const stateVerdict = (st, nowIso, continuing) => {
    if (!st || !st.run_id) return 'closed';
    const now = Date.parse(nowIso) || Date.now();
    const started = Date.parse(st.started_at) || 0, upd = Date.parse(st.updated_at) || started;
    if (started && now - started > LIMITS.resume_days * 864e5) return 'closed';
    if (STOPPED.includes(S(st.status))) return 'blocked';
    if (S(st.status) !== 'running') return 'closed';
    if (continuing && S(continuing) === S(st.run_id)) return 'continue';
    if (now - upd >= LIMITS.stall_minutes * 60000) return 'resume';
    return 'busy';
  };
  const stateRow = (site_id, st, nowIso) => ({ key: stateKey(site_id), kind: 'ai', site_id: S(site_id), value: JSON.stringify(st), updated_at: nowIso });   // exact seo_cache columns
  /** R-E1 (2026-10-23, REVIEW_ENGINE.md): is a stored `done` run THIS start's week? -> { why, cycle_key, finished_at } or null. A start of the same
   *  cycle job (the dispatcher's retry after the run's last part died past the moment its week was stored) is always answered with the stored
   *  week; any other start that is not a cycle job (on demand, a catch-up, a bare manual start) is answered so when the run finished less than
   *  done_fresh_hours ago. A cycle job of ANOTHER cycle (the next week) runs. `rerun` (the trigger's rerun_today) asks again on purpose. */
  const doneRun = (st, o) => { const x = o || {};
    if (!st || !st.run_id || S(st.status) !== 'done' || x.rerun) return null;
    const fin = Date.parse(st.finished_at || st.updated_at) || 0; const now = Date.parse(x.now) || Date.now();
    const ck = S(x.cycle && x.cycle.key), sk = S(st.cycle && st.cycle.key);
    if (ck) return ck === sk ? { why: 'same_cycle', cycle_key: ck, finished_at: S(st.finished_at || st.updated_at) } : null;
    if (fin && now - fin >= 0 && now - fin < LIMITS.done_fresh_hours * 3600e3) return { why: 'recent', cycle_key: sk, finished_at: S(st.finished_at || st.updated_at) };
    return null; };

  // ---- 6b. never pay twice (F2, 2026-10-23: ENGINE_AUDIT.md E1 / E11) ----------------------------------------------------------------
  // E1: a part whose answers were not stored left no trace of what it had PAID for, so every later part asked the same first chunk again,
  // until the run expired or the account ran dry (4 parts x 600 keys = 2,400 paid requests for 600 questions). Now the state row records
  // every key the run has sent (`asked_keys`, packed) and the chunk in flight (`pending`) BEFORE the requests leave (*AI Asking State* ->
  // *Save Asking State*, and nothing is paid unless that save is read back), and AI Requests never asks a recorded key again. A part whose
  // keys are recorded but whose answers are not stored is found by the next part: the first time (a crash: the 60-minute limit, a restart,
  // a pre-empted VM) the lost keys are counted as could-not-be-read and the next chunk is halved; the second time, or when the part itself
  // saw its save fail, the run STOPS (`failed_store`), with an ops alert and the reason, and nothing is asked again.
  // The run also carries a hard money ceiling (`ceiling_dfs_usd`, fixed at its start: 1.5 x its own estimate, at least $2, never above
  // max_run_usd): every part checks the run's spent + committed DataForSEO money against it, AI Requests stops adding requests at it, and a
  // run that reaches it with questions left STOPS (`stopped_ceiling`) with an ops alert.
  const ENG_CODE = { chatgpt: 'c', gemini: 'g', perplexity: 'p', claude: 'l', ai_overview: 'o', ai_mode: 'm', copilot: 'b', chatgpt_api: 'C', gemini_api: 'G' };
  const CODE_ENG = Object.fromEntries(Object.entries(ENG_CODE).map(([e, c]) => [c, e]));
  /** ['p1|chatgpt', 'p1|gemini', 'p2|claude'] -> { p1: 'cg', p2: 'l' } (an engine without a code is kept in parentheses) */
  const packKeys = (keys) => { const m = {};
    for (const k of (keys instanceof Set ? [...keys] : (keys || []))) { const s = S(k); const i = s.lastIndexOf('|'); if (i <= 0) continue;
      const pid = s.slice(0, i), e = s.slice(i + 1); const c = ENG_CODE[e] || ('(' + e + ')'); if (!(m[pid] || '').includes(c)) m[pid] = (m[pid] || '') + c; }
    return m; };
  const unpackKeys = (m) => { const out = new Set(); const o = parse(m, {}) || {};
    for (const pid of Object.keys(o)) for (const t of (S(o[pid]).match(/\(([^)]+)\)|./g) || [])) { const e = t[0] === '(' ? t.slice(1, -1) : CODE_ENG[t]; if (e) out.add(reqKey(pid, e)); }
    return out; };
  const CEILING = { factor: 1.5, min_usd: 2 };
  /** the run's hard DataForSEO ceiling, fixed when it starts */
  const runCeiling = (runCostDfs) => Math.round(100 * Math.min(LIMITS.max_run_usd, Math.max(CEILING.min_usd, CEILING.factor * n0(runCostDfs)))) / 100;
  /** what is left under the ceiling: the larger of what the run measured (settled per task) and what it committed before paying */
  const ceilingLeft = (st) => { if (!st || !(n0(st.ceiling_dfs_usd) > 0)) return null; return Math.max(0, n0(st.ceiling_dfs_usd) - Math.max(n0(st.spent_dfs_usd), n0(st.committed_dfs_usd))); };
  /** the request estimate of a set of keys at the engine prices */
  const keysUsd = (keys) => { let t = 0; for (const k of keys) { const e = S(k).slice(S(k).lastIndexOf('|') + 1); t += PRICE[e] || 0.01; } return Math.round(t * 10000) / 10000; };
  /** the identity of a run's state (what every writer of the state row carries), from a plan item */
  const baseState = (p) => { const c = p.cycle && p.cycle.key ? { key: p.cycle.key, date: p.cycle.date || '', job: p.cycle.job || 'ai_visibility', monthly: !!p.cycle.monthly, scheduled_for: p.cycle.scheduled_for || '', request_id: p.cycle.request_id || p.request_id || '', label: p.cycle.label || '' } : null;
    return { run_id: p.run_id, run_kind: p.run_kind, on_demand: !!p.on_demand, full_due: !!p.full_due, request_id: p.request_id || '', email: p.email || '', callback_url: p.callback_url || '', cycle: c,
      site_id: p.site_id, domain: p.domain, started_at: p.checked_at, ceiling_dfs_usd: n0(p.ceiling_dfs_usd) || null }; };

  // ---- 6b'. a store that only LOOKED failed heals itself (2026-10-27, production 2026-10-25: devaicon.com, run ai_20261025_devaicon-com) -----
  // The hand-off counted an answer as "not stored" when the row *Save AI Answers* returned carried a non-empty `error` - but `error` is a
  // COLUMN of seo_ai_answers: an answer the in-200 gate could not read is stored WITH its DataForSEO message ("Internal SE Server Error.").
  // Three such rows (stored, ids and all) were read as three failed saves and the run stopped `failed_store`, blocking the site for 6 days.
  // n8n 2.41's Data Table insert writes every row of a call in ONE transaction and returns each row with its `id`, or fails them all; so a
  // row is stored exactly when the table handed it back with an id (storedRow), never judged by its `error` column. Before a part declares
  // `failed_store` it reads the run's rows back and inserts the truly missing ones once more (storeCheck); a run already stopped
  // `failed_store` is checked again by every later start of the tracker and by the pulse's resume (healStore / storeHealDue): if every lost
  // answer is in the table the run simply continues; if some are truly missing it continues ONCE with them counted as could-not-be-read
  // (never asked again, never paid again); a second storage failure in the same run keeps it stopped for a person.
  const storedRow = (j) => !!(j && typeof j === 'object' && S(j.id) !== '' && S(j.prompt_id) && S(j.engine));
  /** what one part sent and what the table holds of it: { sent, stored, missing: [keys], recovered: n (found on the re-read or the retry) } */
  const storeCheck = (o) => { const x = o || {}; const mine = (r) => r && S(r.site_id) === S(x.site_id) && (!x.run_id || !S(r.run_id) || S(r.run_id) === S(x.run_id));
    const sent = new Set((x.sent || []).filter(mine).map(r => reqKey(r.prompt_id, r.engine)));
    const first = new Set((x.saved || []).filter(r => mine(r) && storedRow(r)).map(r => reqKey(r.prompt_id, r.engine)));
    const later = new Set([...(x.reread || []), ...(x.retried || [])].filter(r => mine(r) && storedRow(r)).map(r => reqKey(r.prompt_id, r.engine)));
    const missing = [...sent].filter(k => !first.has(k) && !later.has(k));
    return { sent: sent.size, stored: sent.size - missing.length, missing, recovered: [...sent].filter(k => !first.has(k) && later.has(k)).length }; };
  /** a `failed_store` state checked against the run's stored rows: null (not such a state), { ok: true, state, found, missing, note } (the
   *  run continues), or { ok: false, found, missing, why } (it stays stopped) */
  const healStore = (st, rows, nowIso) => {
    if (!st || !st.run_id || S(st.status) !== 'failed_store') return null;
    const stored = new Set((rows || []).filter(r => r && S(r.run_id) === S(st.run_id) && r.prompt_id && r.engine).map(r => reqKey(r.prompt_id, r.engine)));
    const explicit = Object.keys(parse(st.lost_keys, {}) || {}).length > 0;
    if (!explicit && !st.asked_keys) return { ok: false, found: 0, missing: n0(st.lost), why: 'the stopped run recorded neither the answers it lost nor the requests it sent, so the table cannot be checked for them' };
    const lostK = explicit ? unpackKeys(st.lost_keys) : new Set([...unpackKeys(st.asked_keys)].filter(k => !stored.has(k)));
    const missing = [...lostK].filter(k => !stored.has(k));
    const found = explicit ? lostK.size - missing.length : Math.max(0, n0(st.lost) - missing.length);
    const heals = n0(st.store_heals);
    if (missing.length && heals >= 1) return { ok: false, found, missing: missing.length, why: 'this run already continued once after answers it paid for were not stored, and ' + missing.length + ' answer(s) are missing again: a second storage failure in one run keeps it stopped' };
    const when = S(st.updated_at).slice(0, 16).replace('T', ' ');
    const note = missing.length
      ? 'Run ' + st.run_id + ' was stopped' + (when ? ' at ' + when + ' UTC' : '') + ' because answers it had paid for were not stored. Read again, ' + found + ' of them are stored and ' + missing.length + ' are still missing: those ' + missing.length + ' were paid for once, are never asked again and count as could not be read; the run continued with the answers it has.'
      : 'Run ' + st.run_id + ' was stopped' + (when ? ' at ' + when + ' UTC' : '') + ' because ' + (found || n0(st.lost)) + ' answer(s) looked unstored. Read again, every one of them is in the table (the save had reported them as failed), so the run continued from its stored answers. Nothing was asked or paid for again.';
    const state = { ...st, status: 'running', stop_reason: '', lost: explicit ? Math.max(0, n0(st.lost) - found) : missing.length, lost_keys: null, pending: null,
      store_heals: heals + (missing.length ? 1 : 0), store_heal: { at: S(nowIso), found, missing: missing.length, stopped_at: S(st.updated_at), reason: S(st.stop_reason).slice(0, 300) }, store_heal_note: note };
    return { ok: true, state, found, missing: missing.length, note }; };
  /** the pulse's resume: a `failed_store` run (inside resume_days) whose answers can be checked is started again so the tracker checks them */
  const storeHealDue = (st, nowIso) => { if (!st || !st.run_id || S(st.status) !== 'failed_store') return false;
    const now = Date.parse(nowIso) || Date.now(), started = Date.parse(st.started_at) || 0;
    if (started && now - started > LIMITS.resume_days * 864e5) return false;
    return !!(Object.keys(parse(st.lost_keys, {}) || {}).length || st.asked_keys); };

  // ---- 6c. a part sized by TIME, not only by count (F2, 2026-10-23: ENGINE_AUDIT.md E11) ----------------------------------------------
  // A 600-request part at ~40-60 s per batch of 10 (Run AI Requests: batch 10, 200 ms apart) is 40-60 minutes BEFORE the retries and the
  // Answer Analyst, against an execution limit of 60: a part that runs out of time loses everything it paid for. A part now gets a time
  // budget (40 of the 60 minutes, less a fixed allowance for loads and writes, the retry pause and the analyst's jobs), and the requests
  // that fit it at the slow-case seconds of each engine (a batch of 10 waits for its slowest answer) — or at the seconds per request the
  // run's earlier parts MEASURED (wall time of the part, analyst taken out), with 20% headroom. Never more than chunk_requests.
  const TIME = { exec_limit_s: 3600, budget_s: 2400, fixed_s: 300, batch: 10, interval_s: 0.2, retry_wait_s: 20, retry_share: 0.15, headroom: 1.2, min_requests: 40,
    analyst_job_s: 30,
    // R-E5 (2026-10-23, REVIEW_ENGINE.md): one Sentiment Reader call (20 passages, ~6k tokens in, up to 4k out) at its slow case, and the tail a run's
    // last part still runs after the reader (the metrics, the saves, the brief, the report, the PDF; the options keep their own extra_s)
    sentiment_call_s: 30, sentiment_tail_s: 420,
    req_s: { chatgpt: 60, gemini: 60, perplexity: 30, claude: 45, ai_mode: 45, ai_overview: 25, copilot: 20, chatgpt_api: 45, gemini_api: 45 } };
  /** seconds one request costs a part, on these engines: the modelled figure, or the measured one when a part of the run measured it */
  const secPerRequest = (engines, measured) => {
    const es = (engines || []).filter(e => TIME.req_s[e]); const avg = es.length ? es.reduce((t, e) => t + TIME.req_s[e], 0) / es.length : 45;
    const model = (avg / TIME.batch + TIME.interval_s) * (1 + TIME.retry_share);
    return n0(measured) > 0 ? Math.max(0.5, n0(measured) * TIME.headroom) : model; };
  /** how many requests one part may ask: { size, sec_per_request, budget_s, basis } */
  const chunkPlan = (o) => {
    const x = o || {}; const spr = secPerRequest(x.engines, x.measured_s); const aj = Math.max(0, n0(x.analyst_jobs));
    // W2-E3 (2026-10-23): `extra_s` = the seconds the run's last part keeps for the fan-out check, the persona test and the demand lookups
    // (AIX.extraSeconds); 0 when none of them is on, so every part keeps its size
    const budget = Math.max(0, n0(x.budget_s) || (TIME.budget_s - TIME.fixed_s - TIME.retry_wait_s - aj * TIME.analyst_job_s - Math.max(0, n0(x.extra_s))));
    let size = Math.min(LIMITS.chunk_requests, Math.max(TIME.min_requests, Math.floor(budget / spr)));
    if (x.halve) size = Math.max(TIME.min_requests, Math.floor(size / 2));
    return { size, sec_per_request: Math.round(spr * 100) / 100, budget_s: Math.round(budget), analyst_jobs: aj, halved: !!x.halve,
      basis: (n0(x.measured_s) > 0 ? 'measured ' + (Math.round(n0(x.measured_s) * 100) / 100) + ' s a request in this run\'s earlier parts (+20%)' : 'modelled ' + (Math.round(spr * 100) / 100) + ' s a request (slow-case engine time / batch of ' + TIME.batch + ', +15% retries)')
        + ', ' + Math.round(budget) + ' s for requests in a part (40 of the 60 minutes, less loads, the retry pause and ' + aj + ' analyst job(s)' + (n0(x.extra_s) > 0 ? ', and ' + Math.round(n0(x.extra_s)) + ' s kept for the fan-out check / persona test / demand lookups' : '') + ')' + (x.halve ? '; halved after a part that did not finish' : '') }; };

  // ---- 6d. one fit-gate context for the weekly run and the pulse (F2, 2026-10-23: ENGINE_AUDIT.md E18) ------------------------------------
  // The weekly plan protected the ladder heads + the site's services, the pulse the questions' own topics with no services, so one question
  // could be refused on one path and asked on the other. Both now build the gate's input here, from the same rows.
  const servicesOfRow = (row) => { const r = row || {}; if (!(S(r.canonical_host) || S(r.model_updated_at))) return [];
    const arr = (v) => { const x = parse(v, null); return Array.isArray(x) ? x : listOf(v); };
    return [...new Set([...arr(r.declared_services), ...arr(r.services_json)].map(s => S(s).slice(0, 80)).filter(Boolean))].slice(0, 30); };
  const fitInput = (o) => { const x = o || {};
    return { own_domain: S(x.domain), competitors: [...new Set((x.competitors || []).map(S).filter(Boolean))].slice(0, 8), brands: x.aliases || {},
      heads: [...new Set((x.ladders || []).map(l => S(l.head_keyword)).filter(Boolean))], services: (x.services || []).slice(0, 30), keywords: x.keywords || [] }; };

  // ---- 7. the panel's identity: a delta is only a delta between the same questions ---------------------------------------------
  const panelIds = (ids) => [...new Set((ids || []).map(S).filter(Boolean))].sort();
  const panelHash = (ids, engines) => { const s = panelIds(ids).join(',') + '#' + [...new Set(engines || [])].sort().join('+'); return (hash(s) >>> 0).toString(36) + '-' + panelIds(ids).length; };
  /** share of the earlier panel's questions still asked now (0-1), and whether that is the same panel (>= 80%) */
  const overlap = (now, before) => { const A = new Set(panelIds(now)), B = panelIds(before); if (!B.length || !A.size) return { share: null, same: null, common: 0 };
    const c = B.filter(x => A.has(x)).length; const share = c / Math.max(A.size, B.length); return { share: Math.round(1000 * share) / 1000, same: share >= 0.8, common: c }; };

  // ---- 8. the money: ONE formula (the app's app/shared/src/cost.ts estimateAiPanelCost mirrors it; both are held to the golden cases in
  // v5/data/ai_panel_cost_cases.json — harness S211 and app/shared cost.aipanel.test.ts) --------------------------------------------
  // DataForSEO price per question on each engine (LLM scraper / LLM Responses / SERP, measured 2026-10-02, priced 2026-10-08; the two API
  // engines of 2026-10-18 are ESTIMATES until their first live call — the settle takes each task's own `cost` either way).
  const PRICE = { chatgpt: 0.004, gemini: 0.004, perplexity: 0.006, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, copilot: 0.002, chatgpt_api: 0.012, gemini_api: 0.02 };
  const PRICE_BASIS = { chatgpt_api: 'estimate: DataForSEO $0.0002 a task + OpenAI tokens + web search (~$0.01); confirm on the first live run', gemini_api: 'estimate: DataForSEO $0.0002 a task + Gemini tokens + Google Search grounding; confirm on the first live run' };
  const ENGINES = Object.keys(PRICE);
  const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];   // copilot and the two API engines are opt-in
  const MONTHLY_ENGINES = ['claude'];
  const PULSE_ENGINES = ['chatgpt', 'gemini', 'ai_mode', 'copilot'];
  const FIXED = { weekly_ai_min: 0.13, brief_ai: 0.03, analyst_job_ai: 0.02, analyst_per_job: 12, analyst_share: 0.35, analyst_cap_base: 24, analyst_cap_max: 60,
    full_dfs: 0.45, full_ai: 0.3, weeks_per_month: 4.33, pulse_days: 6,
    // W2-E2's Sentiment Reader (Claude Haiku, merged 2026-10-23): every answer of the run that names the business, 20 a call, at most 40 calls a
    // run, about $0.02 a call (R-E9, 2026-10-23: was $0.012; a call reads ~20 x (question + passage) + the prompt = ~6k tokens at Haiku 4.5's $1/M
    // = $0.006, and answers 2-3k tokens (capped at 4,000) at $5/M = $0.010-0.020, so $0.016-0.026; _cost_cal.js holds the same Haiku prices).
    // The worst case a run can spend is calls_max x tries (the agent node's retryOnFail: 2) x sentiment_call_worst (6k in + 4k out = $0.026). Named answers = the weekly run's answers x sentiment_named_rate. ASSUMPTION: 50% named, conservative on purpose (a
    // new site is named in far fewer), so the quote is an upper bound; the full run's few extra answers (the monthly engine, the brand question) are
    // inside that margin and are not priced on their own (a quote never moves by a call or two with the engine set).
    sentiment_named_rate: 0.5, sentiment_per_call: 20, sentiment_calls_max: 40, sentiment_call_ai: 0.02, sentiment_call_worst: 0.026, sentiment_tries: 2 };
  /** the Sentiment Reader's calls and Claude money for a run of `answers` answers */
  const sentimentOf = (answers) => { const named = Math.ceil(Math.max(0, n0(answers)) * FIXED.sentiment_named_rate);
    const calls = Math.min(FIXED.sentiment_calls_max, Math.ceil(named / FIXED.sentiment_per_call)); return { named, calls, ai: Math.round(calls * FIXED.sentiment_call_ai * 10000) / 10000 }; };
  // ---- W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §4): the owner's engine and coverage options -------------------------
  // Every one is OFF by default, so a site that sets none of them costs exactly what it cost before (the golden cases of `cases` hold that).
  //  * ai_claude_weekly   Claude every weekly run instead of the month's full run only
  //  * ai_pulse_engines   which engines the daily pulse asks ('' = the default four, each when the site has it on); Perplexity and the Google AI
  //                       Overview may be added (the AI Overview is asked only for a real search phrase, so its figure here is an upper bound)
  //  * ai_persona_context each buyer role sent to the ChatGPT API as the asker's context on a sub-panel of PERSONA.questions questions (the same
  //                       questions for every role), plus the same questions once with no role (one control shared by every role), every weekly
  //                       run: the persona effect, labelled "API answers"
  //  * ai_fanout_check    the N most frequent searches the engines ran before answering, each checked on Google's top 10 every weekly run
  //                       (a results page read earlier the same day is reused for nothing, so the figure is an upper bound)
  //  * ai_demand_market   (W2-E3 addition to the contract) the monthly market trend from the AI-answer database: your mentions month by month,
  //                       the mentions won and lost, and the brands AI names most for your main topic (3 LLM Mentions tasks on the full run)
  // The extra prices live apart from PRICE (PRICE is the per-engine table the app's AI_ENGINE_COST is held to).
  const XPRICE = { fanout_serp: 0.002, persona: 0.012, demand_task: 0.11 };   // serp/google/organic depth 10 (live); the ChatGPT API answer (= PRICE.chatgpt_api, an estimate until its first live call); one LLM Mentions task ($0.10 + ~10 rows x $0.001)
  const PERSONA = { questions: 12, max_roles: 6 };   // 12 questions a role = MIN_RATE_SAMPLES, so a role's rate is never "too few answers" by construction
  const FANOUT_MAX = 200;
  const DEMAND_TASKS = 3;
  const PULSE_ALLOWED = ['chatgpt', 'gemini', 'ai_mode', 'copilot', 'perplexity', 'ai_overview'];
  /** the engines the daily pulse asks: the owner's choice (only engines the site has on, in a fixed order) or, with none, the default four */
  const pulseEnginesOf = (engines, chosen) => {
    const en = (engines && engines.length ? engines : DEFAULT_ENGINES).map(e => S(e).toLowerCase());
    const pick = listOf(chosen).map(e => e.toLowerCase().replace(/[\s-]+/g, '_')).filter(e => PULSE_ALLOWED.includes(e) && en.includes(e));
    return pick.length ? PULSE_ALLOWED.filter(e => pick.includes(e)) : PULSE_ENGINES.filter(e => en.includes(e));
  };
  /** the engines asked only on the month's full run */
  const monthlyOf = (claudeWeekly) => (claudeWeekly ? [] : MONTHLY_ENGINES.slice());
  const r4 = (x) => Math.round(x * 10000) / 10000; const r2 = (x) => Math.round(x * 100) / 100;
  const sumPrice = (list) => list.reduce((t, e) => t + (PRICE[e] || 0), 0);
  /** what the options add to one run: the persona test and the fan-out check every weekly run, the demand trend on the full run */
  const optionsOf = (x, asked) => {
    const nRoles = Array.isArray(x.personas) || typeof x.personas === 'string' ? listOf(x.personas).length : Math.round(n0(x.personas));   // a count, or the roles themselves
    const roles = x.persona_context ? Math.min(PERSONA.max_roles, Math.max(0, nRoles)) : 0;
    const pq = roles ? Math.min(PERSONA.questions, asked) : 0;
    const pReq = roles ? (roles + 1) * pq : 0;   // every role, plus one control arm shared by all of them
    const fq = clamp(Math.round(n0(x.fanout_check)), 0, FANOUT_MAX);
    const dm = !!x.demand_market;
    return { claude_weekly: !!x.claude_weekly, pulse_engines: null,
      persona: { on: !!x.persona_context, roles, questions: pq, requests_run: pReq, dfs_run: r4(pReq * XPRICE.persona) },
      fanout: { queries: fq, requests_run: fq, dfs_run: r4(fq * XPRICE.fanout_serp) },
      demand_market: { on: dm, tasks: dm ? DEMAND_TASKS : 0, dfs_full: dm ? r4(DEMAND_TASKS * XPRICE.demand_task) : 0 } };
  };
  /** the seconds the run's last part keeps for the options (batches of 10, the slowest request of each kind; none = 0) */
  const extraSeconds = (o) => { const x = o || {}; const p = n0(x.persona_requests), f = n0(x.fanout_requests), d = n0(x.demand_requests);
    return Math.ceil(p / 10) * (TIME.req_s.chatgpt_api || 45) + Math.ceil(f / 10) * 10 + Math.ceil(d / 10) * 30 + (p + f + d ? TIME.retry_wait_s : 0); };
  /** the Answer Analyst jobs one weekly run may start (it reads the answers that matter, 12 a job; more for a bigger panel, never past 60) */
  const analystCap = (panel) => Math.min(FIXED.analyst_cap_max, FIXED.analyst_cap_base + Math.floor(n0(panel) / 25));
  /** o: { panel, engines, pulse (bool), pulse_mode ('auto'|'sample'|'full'), pulse_per_week, cluster_size, and the W2-E3 options claude_weekly,
   *  pulse_engines, persona_context + personas (the number of buyer roles), fanout_check, demand_market; AI-FOCUS: pulse_questions, the questions the
   *  pulse asks when its scope is the focus }. Every figure is in US dollars;
   *  `run` is what one execution chain of the weekly tracker spends (weekly / the month's full run), `pulse_day` one pulse morning,
   *  `month` the site's month (4.33 weekly runs + the full run's extra + 26 pulse mornings); `options` what each option adds. */
  const cost = (o) => {
    const x = o || {};
    const panel = clamp(Math.round(n0(x.panel)) || LIMITS.default_new, LIMITS.min, LIMITS.max);
    const engines = [...new Set((x.engines && x.engines.length ? x.engines : DEFAULT_ENGINES).filter(e => PRICE[e] != null))];
    const asked = Math.max(1, panel - 1);                  // the brand question is asked on the month's full run only
    const MONTHLY = monthlyOf(x.claude_weekly);            // W2-E3: Claude weekly when the owner asks for it
    const wE = engines.filter(e => !MONTHLY.includes(e));
    const pE = pulseEnginesOf(engines, x.pulse_engines);   // W2-E3: the owner's pulse engines ('' = the default four)
    const answers = asked * wE.length;
    const jobs = Math.min(analystCap(panel), Math.ceil(answers * FIXED.analyst_share / FIXED.analyst_per_job));
    const opt = optionsOf(x, asked); opt.pulse_engines = pE.slice();
    const sw = sentimentOf(answers);   // W2-E2's Sentiment Reader, priced on the weekly run's answers (every run asks them)
    const weekly = { dfs: r4(asked * sumPrice(wE) + opt.persona.dfs_run + opt.fanout.dfs_run), ai: r4(Math.max(FIXED.weekly_ai_min, FIXED.brief_ai + jobs * FIXED.analyst_job_ai) + sw.ai) };
    weekly.usd = r4(weekly.dfs + weekly.ai);
    const extra = { dfs: r4(MONTHLY.filter(e => engines.includes(e)).reduce((t, e) => t + panel * PRICE[e], 0) + sumPrice(wE) + FIXED.full_dfs + opt.demand_market.dfs_full), ai: FIXED.full_ai };
    extra.usd = r4(extra.dfs + extra.ai);
    const full = { dfs: r4(weekly.dfs + extra.dfs), ai: r4(weekly.ai + extra.ai) }; full.usd = r4(full.dfs + full.ai);
    const on = x.pulse !== false && pE.length > 0;
    const pw = on ? pulsePerWeek({ asked, weekly_engines: wE.length, pulse_engines: pE.length, cluster_size: x.cluster_size, mode: x.pulse_mode, per_week: x.pulse_per_week }) : { per_week: 0, headline: halfWidth(answers), cluster: halfWidth(Math.min(asked, n0(x.cluster_size) || LIMITS.cluster_size_guess) * wE.length), capped: false, why: on ? '' : 'the daily pulse is off' };
    // AI-FOCUS (2026-10-27): with the pulse scope 'focus' the pulse asks only `pulse_questions` of the panel (the questions of the topics the client
    // works on); null / absent = the whole panel, exactly as before (every golden case without it is unchanged)
    const pq = x.pulse_questions == null || x.pulse_questions === '' || !Number.isFinite(Number(x.pulse_questions)) ? asked : clamp(Math.round(n0(x.pulse_questions)), 0, asked);
    const qDay = on ? Math.min(pq, Math.ceil(pq * pw.per_week / FIXED.pulse_days)) : 0;
    const pulse_day = { dfs: r4(qDay * sumPrice(pE)), ai: 0 }; pulse_day.usd = pulse_day.dfs;
    const W = FIXED.weeks_per_month;
    const month = { weekly: r2(W * weekly.usd), full_extra: r2(extra.usd), pulse: r2(W * FIXED.pulse_days * pulse_day.usd) };
    month.total = r2(month.weekly + month.full_extra + month.pulse);
    return { panel, asked, engines, weekly_engines: wE, pulse_engines: on ? pE : [], per_week: pw.per_week, pulse_questions_day: qDay, pulse_why: pw.why, pulse_capped: !!pw.capped,
      requests: { weekly: answers, full: answers + MONTHLY.filter(e => engines.includes(e)).length * panel + wE.length, pulse_day: qDay * (on ? pE.length : 0) },
      executions: Math.max(1, Math.ceil(answers / LIMITS.chunk_requests)), analyst_jobs: jobs,
      half_width: { headline: pw.headline, cluster: pw.cluster }, run: { weekly, full }, full_extra: extra, pulse_day, month,
      prices: engines.map(e => ({ engine: e, usd: PRICE[e], basis: PRICE_BASIS[e] || 'measured / priced' })),
      // W2-E3: what each option adds (all zero / off by default), and the requests the run's last part makes for them
      sentiment: { named_rate: FIXED.sentiment_named_rate, ...sw },
      options: { ...opt, requests_extra: { weekly: opt.persona.requests_run + opt.fanout.requests_run, full: opt.persona.requests_run + opt.fanout.requests_run + opt.demand_market.tasks } } };
  };

  return { LIMITS, panelSize, normMarket, locationOf, listOf, marketsOf, personasOf, stageOf, stems, jaccard, sameAsk, dedupe, stratumOf, pulseDay, halfWidth,
    pulsePerWeek, pulseSample, reqKey, slice, stateKey, stateOf, stateVerdict, stateRow, doneRun, panelIds, panelHash, overlap, hash,
    MARKETS_MAX, normQ, hash64, promptId, findStored, keywordOf, KEYWORD_SOURCES, STOPPED, ENG_CODE, packKeys, unpackKeys, CEILING, runCeiling, ceilingLeft, keysUsd, baseState,
    storedRow, storeCheck, healStore, storeHealDue,
    TIME, secPerRequest, chunkPlan, servicesOfRow, fitInput,
    PRICE, PRICE_BASIS, ENGINES, DEFAULT_ENGINES, MONTHLY_ENGINES, PULSE_ENGINES, FIXED, analystCap, cost, sentimentOf,
    XPRICE, PERSONA, FANOUT_MAX, DEMAND_TASKS, PULSE_ALLOWED, pulseEnginesOf, monthlyOf, optionsOf, extraSeconds };
})();
// ---- AI-FOCUS (2026-10-27, docs/ai-panel-focus-2026-10-27/RESEARCH_AND_DESIGN.md §4-§5): the AI question panel follows the client's focus ----
// devaicon.com (Pakistan) typed "open edx provider" once at onboarding and then worked only on a keyword ladder about AI automation; its 10-question
// panel, written on the setup day before the ladder existed, kept asking about Open edX in the UAE every week and every pulse morning, because a full
// panel was never revisited, nothing retired a question when the focus moved, the declared services were never a topic and stored questions kept their
// stale market. This kit is the one deterministic rule (no Claude, no network; inlined by build_monitors.py into AI Plan, Prompt Jobs, Prompt Rows,
// Pulse Plan and AI Metrics, and written for the app as app/shared/src/ai-focus.generated.js):
//   focusOf    the client's focus topics, weighted: active ladders (3), recently written / published pages (2), declared services (1, the stable core),
//              tracked keywords (1, or a 'watch' of at most one kept question when nothing has touched them for 28 days), always in the website's
//              own market (other markets' place words are taken out of a topic phrase; the market itself is decided elsewhere, M4 / M2);
//   quotas     how many questions each topic gets inside the panel size the client pays for (brand 1, a core of at least 30% with the brand, at least
//              2 a topic so each is a readable segment, at most (N-1)/2 topics; the topics that do not fit are listed with the size that would fit them);
//   reconcile  what the weekly run does with the stored panel: keep, write (per topic), retire (history kept: status `retired`, never deleted), and
//              what it must ASK the owner instead of doing (the owner's own and pinned questions, questions of another market, a bigger panel).
//              Additions land the week a ladder starts (the page needs a "before"); retirements wait for the month's full run and 28 days out of
//              focus, except on a panel that has no trend yet (provisional: fewer than 4 measured weeks) and the questions of a deleted ladder;
//   matched    the change computed only on the questions asked in both weeks (a panel that moved still has a trend), per-topic overlap.
// Sandbox rules (n8n 2.x Code node, memory note 2026-10-25): no URL constructor, no structured clone, no property definitions or prototype changes.
const AIF = (() => {
  const CFG = { core_share: 0.3, min_per_topic: 2, watch_max: 1, watch_total: 2, grace_days: 28, paused_days: 56, page_days: 180, watch_days: 28, merge: 0.5,
    provisional_weeks: 4, new_days: 8, seen_refresh_days: 6, core_topics_max: 2 };
  const W = { ladder: 3, page: 2, service: 1, keyword: 1, watch: 0.5, maintain: 1, paused: 1 };
  const S = (v) => String(v == null ? '' : v).trim();
  const low = (v) => S(v).toLowerCase().replace(/\s+/g, ' ');
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const t = (iso) => { const x = Date.parse(S(iso)); return Number.isFinite(x) ? x : 0; };
  const daysBetween = (a, b) => (t(b) && t(a) ? (t(b) - t(a)) / 864e5 : 0);
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(S).filter(Boolean);
  const arr = (v) => { if (Array.isArray(v)) return v; const s = S(v); if (!s) return []; if (s[0] === '[') { try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch (e) { return []; } } return listOf(s); };
  const pin = (p) => p && (p.pinned === true || S(p.pinned) === 'true');
  const ownerQ = (p) => p && (S(p.source) === 'custom' || pin(p));
  // the fit gate's place helpers when the node inlines it (every engine node that calls AIF does; the app's generated module imports them)
  const G = {
    places: typeof fitPlaces === 'function' ? fitPlaces : null,
    drop: typeof fitDropPlaces === 'function' ? fitDropPlaces : null,
    market: typeof fitMarket === 'function' ? fitMarket : null,
    evidence: typeof fitEvidence === 'function' ? fitEvidence : null };

  // ---- 1. words: a topic's content words (places, question words and seller words out), five-letter stems --------------------------------
  const GENERIC = new Set(('a an and are as at be best by can do does for from get has have how i if in into is me my of on or our should the their them '
    + 'there these this to top us we what when where which who why will with you your vs versus near cheap cheapest cost costs price prices pricing quote '
    + 'solution solutions service services company companies provider providers firm firms agency agencies partner partners vendor vendors list guide '
    + 'options option about need needs want looking help good great right local online').split(' '));
  const placeFree = (s) => { const x = low(s); if (!x) return ''; if (!G.places || !G.drop) return x; const ps = G.places(x).map(p => p.word); return ps.length ? (G.drop(x, ps) || x) : x; };
  const stem = (w) => (w.length >= 5 ? w.slice(0, 5) : w);
  const words = (s) => [...new Set(placeFree(s).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(w => w && !GENERIC.has(w) && (w.length >= 2 || /\d/.test(w))).map(stem))];
  const jac = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  /** two phrases are one topic: content-word Jaccard >= 0.5 after places and seller words are taken out ("ai automation solutions gcc" = "ai automation") */
  const sameTopic = (a, b) => jac(words(a), words(b)) >= CFG.merge;
  /** how well a question's words carry one of a topic's phrases: the share of the phrase's words it carries (all of a two-word phrase, 2 of 3 …) */
  const carries = (qw, phrase) => { const T = words(phrase); if (!T.length) return 0; const Q = new Set(qw); const hit = T.filter(x => Q.has(x)).length;
    const need = T.length <= 2 ? T.length : Math.ceil(T.length * 2 / 3); return hit >= need ? hit / T.length : 0; };
  /** the topic phrase in the website's market: other markets' place words taken out ("ai automation solutions gcc" for Pakistan -> "ai automation solutions") */
  const inMarket = (phrase, iso) => { const x = low(phrase); if (!iso || !G.market) return x; const m = G.market(x, iso); return m.ok ? x : (low(m.without) || x); };

  // ---- 2. the focus model ------------------------------------------------------------------------------------------------------------------
  const LIVE_LADDER = ['active', 'queued', 'writing', 'climbing', 'stuck', ''];
  /** o: { ladders (seo_ladders rows, already through the read-path gate), settings (seo_ladder_settings rows), content_log, keywords (tracked),
   *  services (DECLARED only), gsc ([{query, impressions}] of the last 28 days), iso (the website's own country), now, out(keyword) -> null | reason }
   *  -> { topics: [{ id, label, state, weight, source, refs, terms, since, chosen_by, why }], out: [{ label, reason }], iso } */
  const focusOf = (o) => {
    const x = o || {}; const now = S(x.now) || new Date().toISOString(); const iso = S(x.iso).toUpperCase();
    const topics = []; const out = [];
    const add = (tp) => { const same = topics.find(z => z.state !== 'out' && sameTopic(z.label, tp.label));
      if (same && (tp.source === 'page' || tp.source === 'keyword' || same.source === tp.source && tp.source !== 'ladder')) {   // a page or a tracked keyword of a topic already there joins it
        same.terms = [...new Set([...same.terms, ...tp.terms])]; same.refs = [...new Set([...same.refs, ...tp.refs])]; if (tp.source === 'page') same.pages = (same.pages || 0) + 1; return same; }
      if (same && tp.source === 'ladder' && same.source === 'ladder') { same.terms = [...new Set([...same.terms, ...tp.terms])]; same.refs = [...new Set([...same.refs, ...tp.refs])];
        const rank = { active: 4, maintain: 3, paused: 2 }; if ((rank[tp.state] || 0) > (rank[same.state] || 0)) { same.state = tp.state; same.weight = tp.weight; } return same; }
      topics.push(tp); return tp; };
    // ladders: one topic per head term (rows of one ladder grouped), state from seo_ladder_settings
    const setOf = new Map((x.settings || []).filter(r => r && S(r.ladder_id) && S(r.ladder_id) !== '_site').map(r => [S(r.ladder_id), r]));
    const byL = new Map(); for (const r of (x.ladders || [])) { if (!r || !S(r.head_keyword)) continue; const id = S(r.ladder_id) || 'head:' + low(r.head_keyword); const g = byL.get(id) || { id, head: low(r.head_keyword), rows: [] }; g.rows.push(r); byL.set(id, g); }
    for (const g of byL.values()) {
      const st0 = setOf.get(g.id) || {}; const st = low(st0.status);
      if (st === 'archived') continue;   // archived = the client left it: its questions leave focus
      const state = st === 'paused' ? 'paused' : st === 'won' ? 'maintain' : 'active';
      const label = inMarket(g.head, iso);
      const since = S(st0.updated_at) || S(st0.created_at) || S((g.rows[0] || {}).start_date) || '';
      const started = S(st0.created_at) || S((g.rows.slice().sort((a, b) => S(a.start_date).localeCompare(S(b.start_date)))[0] || {}).start_date);
      add({ id: 'ladder:' + g.id, label, state, weight: W[state === 'active' ? 'ladder' : state], source: 'ladder', refs: [g.id], chosen_by: S(st0.chosen_by || (g.rows[0] || {}).chosen_by) || 'client_typed',
        terms: [...new Set([label, ...g.rows.filter(r => Number(r.rung) !== 4).map(r => inMarket(r.keyword, iso)).filter(Boolean)])].slice(0, 12), since, started_at: started, priority: n0(st0.priority) || 99,
        why: state === 'active' ? 'your keyword ladder "' + label + '"' : state === 'paused' ? 'your paused keyword ladder "' + label + '"' : 'your won keyword ladder "' + label + '" (kept as a watch on the position)' });
    }
    // pages written or published in the last 180 days whose keyword is not a ladder head (a ladder page is already its ladder's topic)
    for (const r of (x.content_log || [])) { if (!r || !S(r.keyword)) continue; const stt = low(r.status); if (!['written', 'published'].includes(stt)) continue;
      const when = S(r.published_at) || S(r.started_at); if (when && daysBetween(when, now) > CFG.page_days) continue;
      const label = inMarket(r.keyword, iso);
      add({ id: 'page:' + label, label, state: 'active', weight: W.page, source: 'page', refs: [S(r.published_url) || label], terms: [label], since: when, started_at: when, priority: 50, chosen_by: 'client_typed',
        why: 'your page "' + label + '"' }); }
    // declared services: the stable core (top 2 by Search Console impressions of matching searches, else the declared order)
    const gsc = (x.gsc || []).filter(q => q && S(q.query) && n0(q.impressions) > 0);
    const svc = [...new Set((x.services || []).map(low).filter(Boolean))];
    const impOf = (label) => gsc.filter(q => carries(words(q.query), label) > 0).reduce((s, q) => s + n0(q.impressions), 0);
    const svcRank = svc.map((l, i) => ({ l, i, imp: impOf(l) })).sort((a, b) => b.imp - a.imp || a.i - b.i);
    for (const s of svcRank) { if (topics.some(z => sameTopic(z.label, s.l))) continue;
      add({ id: 'service:' + s.l, label: s.l, state: 'core', weight: W.service, source: 'service', refs: [], terms: [s.l], since: '', started_at: '', priority: 80 + s.i, chosen_by: 'client_typed', impressions: s.imp,
        why: 'a service you listed ("' + s.l + '")' }); }
    // tracked keywords: with a ladder or a page they are that topic; with Search Console impressions they are a topic; else a watch
    const activeOther = () => topics.some(z => z.state === 'active');
    for (const k0 of [...new Set((x.keywords || []).map(low).filter(Boolean))]) {
      const why = typeof x.out === 'function' ? x.out(k0) : null;
      if (why) { out.push({ label: k0, reason: S(why), source: 'keyword' }); continue; }
      const label = inMarket(k0, iso);
      const home = topics.find(z => z.state !== 'core' && sameTopic(z.label, label));
      if (home) { home.terms = [...new Set([...home.terms, label])]; continue; }
      const imp = gsc.filter(q => carries(words(q.query), label) > 0).reduce((s, q) => s + n0(q.impressions), 0);
      const ev = G.evidence && svc.length ? G.evidence(label, svc, { services: svc }) : null;
      if (ev && ev.verdict === 'out') { out.push({ label, reason: 'not part of the services you listed (' + S(ev.detail).slice(0, 160) + ')', source: 'keyword' }); continue; }
      if (imp > 0 || !activeOther()) add({ id: 'keyword:' + label, label, state: 'active', weight: W.keyword, source: 'keyword', refs: [], terms: [label], since: '', started_at: '', priority: 60, chosen_by: 'client_typed', impressions: imp,
        why: imp > 0 ? 'a keyword you track, with ' + imp + ' Search Console impressions' : 'a keyword you track' });
      else add({ id: 'keyword:' + label, label, state: 'watch', weight: W.watch, source: 'keyword', refs: [], terms: [label], since: '', started_at: '', priority: 90, chosen_by: 'client_typed',
        why: 'a keyword you track with no keyword ladder, no page and no Search Console impressions in 28 days: kept as a weekly watch' });
    }
    // a tracked keyword that became a watch BEFORE a later ladder appeared stays a watch; one added while nothing else was active is re-judged
    if (activeOther()) for (const z of topics) if (z.source === 'keyword' && z.state === 'active' && !(n0(z.impressions) > 0) && topics.some(y => y !== z && y.state === 'active' && y.source !== 'keyword')) {
      z.state = 'watch'; z.weight = W.watch; z.why = 'a keyword you track with no keyword ladder, no page and no Search Console impressions in 28 days: kept as a weekly watch'; }
    return { topics, out, iso };
  };

  // ---- 3. which topic a stored question measures --------------------------------------------------------------------------------------------
  const qWords = (p) => words([S(p.keyword), S(p.cluster), S(p.topic), S(p.focus_topic)].filter(Boolean).join(' ') || S(p.prompt));
  /** the topic a question belongs to (best match over the topic's phrases), or null */
  const topicOf = (p, topics) => { const qw = qWords(p); let best = null, score = 0;
    for (const z of (topics || [])) { const sc = Math.max(0, ...z.terms.map(ph => carries(qw, ph))); const tie = sc === score && best && (z.weight || 0) > (best.weight || 0);
      if (sc > score || tie) { best = z; score = sc; } }
    if (!best) { const fs = S(p.focus_source); const id = fs.indexOf('ladder:') === 0 ? 'ladder:' + fs.slice(7) : ''; if (id) best = (topics || []).find(z => z.id === id) || null; }
    return best; };

  // ---- 4. quotas ------------------------------------------------------------------------------------------------------------------------------
  /** N = the panel size (brand included). have: Map(topic id -> questions it keeps now). owner: the owner's own / pinned questions that match no topic.
   *  -> { quota: Map(id -> n), measured: [ids], not_measured: [{ id, label, need }], core_n, raise_to } */
  const quotas = (N, topics, have, ownerFree) => {
    const H = have || new Map(); const hv = (id) => n0(H.get(id));
    let slots = Math.max(0, Math.round(n0(N)) - 1 - n0(ownerFree));
    const quota = new Map(); const measured = []; const not_measured = [];
    const T = (st) => (topics || []).filter(z => z.state === st);
    // watch: keep at most one existing question each (never written new), at most two watches
    let wl = CFG.watch_total; for (const z of T('watch')) { const k = Math.min(CFG.watch_max, hv(z.id), wl, slots); quota.set(z.id, k); wl -= k; slots -= k; }
    // paused: keep what it has (weekly only, nothing new); won: 2 kept as a watch on the position
    for (const z of T('paused')) { const k = Math.min(hv(z.id), slots); quota.set(z.id, k); slots -= k; if (k) measured.push(z.id); }
    for (const z of T('maintain')) { const k = Math.min(CFG.min_per_topic, hv(z.id), slots); quota.set(z.id, k); slots -= k; if (k) measured.push(z.id); }
    const cap = Math.max(1, Math.floor((Math.round(n0(N)) - 1) / 2) - measured.length);
    const act = T('active').slice().sort((a, b) => hv(b.id) - hv(a.id) || (a.priority || 99) - (b.priority || 99) || S(b.started_at).localeCompare(S(a.started_at)));
    const core = T('core');
    // the stable core: at least 30% of the panel with the brand question (2 when the panel is 8 or more), in at most two service topics;
    // with nothing active (the setup day) the services are the whole panel
    let coreN = core.length ? (act.length ? Math.max(Math.ceil(CFG.core_share * n0(N)) - 1, n0(N) >= 8 ? 2 : 1) : slots) : 0;
    coreN = Math.min(coreN, slots);
    const nCore = core.length && coreN ? Math.max(1, Math.min(core.length, act.length ? CFG.core_topics_max : cap, Math.floor(coreN / CFG.min_per_topic) || 1)) : 0;
    const coreTopics = core.slice(0, nCore);
    if (coreTopics.length) { const base = Math.floor(coreN / coreTopics.length); let rem = coreN - base * coreTopics.length;
      for (const z of coreTopics) { quota.set(z.id, base + (rem > 0 ? 1 : 0)); rem--; measured.push(z.id); } slots -= coreN; }
    for (const z of core) if (!quota.has(z.id)) quota.set(z.id, 0);
    // the active topics that fit: each at least 2, at most `room` topics, and only as many as the slots left after the core allow
    const room = Math.max(0, cap - nCore);
    const fit = act.slice(0, Math.max(0, Math.min(room, Math.floor(Math.max(0, slots) / CFG.min_per_topic))));
    // the rest by weight, largest remainder, at least 2 each
    if (fit.length) { const left = slots; const wsum = fit.reduce((s, z) => s + (z.weight || 1), 0);
      const raw = fit.map(z => ({ z, q: Math.max(CFG.min_per_topic, left * (z.weight || 1) / wsum) }));
      let got = raw.map(r => ({ z: r.z, n: Math.max(CFG.min_per_topic, Math.floor(r.q)), f: r.q - Math.floor(r.q) }));
      let over = got.reduce((s, r) => s + r.n, 0) - left;
      while (over > 0) { const r = got.filter(g => g.n > CFG.min_per_topic).sort((a, b) => a.f - b.f || (a.z.weight || 1) - (b.z.weight || 1))[0]; if (!r) break; r.n--; over--; }
      let under = left - got.reduce((s, r) => s + r.n, 0);
      for (const r of got.slice().sort((a, b) => b.f - a.f || (b.z.weight || 1) - (a.z.weight || 1))) { if (under <= 0) break; r.n++; under--; }
      while (under > 0) { got[0].n++; under--; }
      for (const r of got) { quota.set(r.z.id, r.n); measured.push(r.z.id); slots -= r.n; } }
    for (const z of act) if (!quota.has(z.id)) { quota.set(z.id, 0); not_measured.push({ id: z.id, label: z.label, need: CFG.min_per_topic }); }
    const raise_to = not_measured.length ? Math.round(n0(N)) + CFG.min_per_topic * not_measured.length : 0;
    return { quota, measured, not_measured, core_n: coreN, raise_to };
  };

  // ---- 5. reconcile: keep, write, retire, ask -------------------------------------------------------------------------------------------------
  /** o: { stored (the site's seo_ai_prompts rows, every status), focus (focusOf), N (panel size), now, full (the month's full run),
   *  weeks (measured weekly rows on file), own_market ('PK-en'), markets (the markets the owner set), ladder_ids (the ladders that still exist) }
   *  -> { keep, retire: [{ prompt_id, reason, topic }], write: [{ topic_id, label, state, source, count, terms, reason }], updates: [{ prompt_id, focus_topic,
   *  focus_source, focus_state, focus_seen_at }], owner_off_focus, market_drift, not_measured, raise_to, provisional, events, summary } */
  const reconcile = (o) => {
    const x = o || {}; const now = S(x.now) || new Date().toISOString(); const N = Math.round(n0(x.N)) || 10;
    const topics = ((x.focus || {}).topics || []);
    const provisional = n0(x.weeks) < CFG.provisional_weeks;
    const own = S(x.own_market); const okMarkets = new Set([own, ...(x.markets || []).map(S)].filter(Boolean).map(m => m.toUpperCase()));
    const mkOk = (p) => { const m = S(p.market).toUpperCase(); return !m || okMarkets.has(m) || (own && m.split('-')[0] === own.toUpperCase().split('-')[0] && !m.split('-')[1]); };
    const ladderIds = new Set((x.ladder_ids || []).map(S));
    const live = (x.stored || []).filter(p => p && S(p.prompt) && !['off', 'refused', 'retired', 'proposed'].includes(low(p.status || 'active')));
    const brand = live.filter(p => S(p.kind) === 'brand');
    const qs = live.filter(p => S(p.kind) !== 'brand');
    const retire = [], updates = [], owner_off_focus = [], market_drift = [];
    const of = new Map(); const have = new Map(); let ownerFree = 0; const keptAuto = new Map();
    // focus_seen_at: while a question is in focus, when it was last seen in focus (refreshed weekly); once it is out, when it was first found out
    // of focus (a question stored before this rule starts its 28 days the first time it is judged, so a release retires nothing by itself)
    const stamp = (p, z) => { const fresh = z && z.state !== 'out'; const seen = fresh ? (daysBetween(S(p.focus_seen_at), now) >= CFG.seen_refresh_days || !S(p.focus_seen_at) ? now : S(p.focus_seen_at)) : (S(p.focus_state) === 'out' && S(p.focus_seen_at) ? S(p.focus_seen_at) : now);
      const u = { prompt_id: S(p.prompt_id), focus_topic: z ? z.label : '', focus_source: z ? (z.source === 'ladder' ? 'ladder:' + (z.refs[0] || '') : z.source) : S(p.focus_source), focus_state: z ? z.state : 'out', focus_seen_at: seen };
      if (u.focus_topic !== S(p.focus_topic) || u.focus_source !== S(p.focus_source) || u.focus_state !== S(p.focus_state) || u.focus_seen_at !== S(p.focus_seen_at)) updates.push(u); };
    // the whole automatic panel written for another market (the website's country changed, devaicon.com: UAE questions on a Pakistan website) on a
    // panel with no trend yet is replaced at once; a panel that also asks in the website's own market keeps its other markets for the owner to judge
    const autoQ = qs.filter(p => !ownerQ(p)); const allElsewhere = autoQ.length > 0 && autoQ.every(p => !mkOk(p));
    for (const p of qs) {
      const z = topicOf(p, topics); of.set(S(p.prompt_id), z);
      if (ownerQ(p)) { if (z && z.state !== 'out') have.set(z.id, n0(have.get(z.id)) + 1); else { ownerFree++; if (topics.length) owner_off_focus.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), why: 'it asks about something none of your keyword ladders, pages or services cover' }); }
        stamp(p, z); continue; }
      // an automatic question
      const fs = S(p.focus_source); const lid = fs.indexOf('ladder:') === 0 ? fs.slice(7) : '';
      const deleted = !!(lid && !ladderIds.has(lid) && (!z || z.source !== 'ladder' || z.refs.indexOf(lid) < 0));
      const wrongMarket = !mkOk(p);
      const outDays = S(p.focus_state) === 'out' && S(p.focus_seen_at) ? daysBetween(S(p.focus_seen_at), now) : 0;   // out of focus since it was first found so
      const offFocus = !z || deleted;
      if (wrongMarket) {
        if (provisional && allElsewhere) { retire.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), reason: 'asked in ' + S(p.market) + ', not in your market (' + own + ')', topic: z ? z.label : '' }); continue; }
        market_drift.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), market: S(p.market) });
      }
      if (offFocus) {
        const why = deleted ? 'its keyword ladder was deleted' : 'it is about something you no longer work on (no keyword ladder, page, service or tracked keyword covers it)';
        if ((x.full && (deleted || outDays >= CFG.grace_days))) { retire.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), reason: why, topic: S(p.focus_topic) }); continue; }
        stamp(p, null); continue; }
      if (z.state === 'paused' && x.full && daysBetween(z.since, now) >= CFG.paused_days) { retire.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), reason: 'its keyword ladder has been paused for more than ' + CFG.paused_days + ' days', topic: z.label }); continue; }
      if (!wrongMarket) { have.set(z.id, n0(have.get(z.id)) + 1); const l = keptAuto.get(z.id) || []; l.push(p); keptAuto.set(z.id, l); }
      stamp(p, z);
    }
    const Q = quotas(N, topics, have, ownerFree);
    // over-quota questions: a watch keeps one, a won ladder two (extras retire on the full run, or now while the panel has no trend)
    const freeNow = () => N - Math.max(1, brand.length) - qs.length + retire.length;   // the brand question's place is kept (written with the first job when missing)
    for (const z of topics) { const l = (keptAuto.get(z.id) || []).slice().sort((a, b) => S(a.created_at).localeCompare(S(b.created_at)));
      const q = n0(Q.quota.get(z.id)); const ownN = n0(have.get(z.id)) - l.length;
      if ((z.state === 'watch' || z.state === 'maintain') && l.length + ownN > q && (provisional || x.full))
        for (const p of l.slice(Math.max(0, q - ownN))) { retire.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), reason: z.state === 'watch' ? 'a keyword you only watch keeps one question' : 'a won keyword ladder keeps two questions', topic: z.label });
          have.set(z.id, n0(have.get(z.id)) - 1); } }
    // what each measured topic still needs; a topic the client chose that has NO question yet (a new ladder) takes room from over-quota topics at once
    const write = []; let free = Math.max(0, freeNow());
    const need = (z) => Math.max(0, n0(Q.quota.get(z.id)) - n0(have.get(z.id)));
    const order = topics.filter(z => Q.measured.includes(z.id) && ['active', 'core', 'maintain'].includes(z.state)).sort((a, b) => (n0(have.get(a.id)) - n0(have.get(b.id))) || (b.weight || 1) - (a.weight || 1));
    for (const z of order) {
      let k = need(z); if (!k) continue;
      // a NEW ladder (started in the last 8 days: the week it starts, under its 2 questions) may take room from over-quota questions at once: its page needs a
      // "before"; an older topic waits for free room (the month's retirements), so a settled panel never churns
      const fresh = z.state === 'active' && z.source !== 'service' && !!z.started_at && daysBetween(z.started_at, now) <= CFG.new_days && n0(have.get(z.id)) < CFG.min_per_topic;
      const isNew = fresh || !n0(have.get(z.id));
      let take = Math.min(k, free); free -= take;
      if (take < k && fresh) {   // swap: over-quota automatic questions of other topics make room (largest surplus first, newest question first)
        let short = Math.min(k, CFG.min_per_topic) - take;
        while (short > 0) { const donor = topics.filter(y => y !== z && n0(have.get(y.id)) > n0(Q.quota.get(y.id)) && (keptAuto.get(y.id) || []).some(p => !retire.some(r => r.prompt_id === S(p.prompt_id))))
            .sort((a, b) => (n0(have.get(b.id)) - n0(Q.quota.get(b.id))) - (n0(have.get(a.id)) - n0(Q.quota.get(a.id))))[0];
          if (!donor) break; const p = (keptAuto.get(donor.id) || []).filter(q => !retire.some(r => r.prompt_id === S(q.prompt_id))).sort((a, b) => S(b.created_at).localeCompare(S(a.created_at)))[0];
          retire.push({ prompt_id: S(p.prompt_id), prompt: S(p.prompt), reason: 'made room for "' + z.label + '" inside your panel size', topic: donor.label, swap: true });
          have.set(donor.id, n0(have.get(donor.id)) - 1); take++; short--; } }
      if (take > 0) { write.push({ topic_id: z.id, label: z.label, state: z.state, source: z.source === 'ladder' ? 'ladder:' + (z.refs[0] || '') : z.source, count: take, terms: z.terms.slice(0, 8),
        chosen_by: z.chosen_by || '', reason: isNew ? 'new: ' + z.why : 'below its share: ' + z.why, fresh }); have.set(z.id, n0(have.get(z.id)) + take); }
    }
    // room the quotas did not use (a topic over its share keeps its questions): the panel the client pays for is filled, by weight
    const fillers = order.filter(z => z.state === 'active' || z.state === 'core');
    for (let i = 0; free > 0 && fillers.length && i < 10000; i++) { const z = fillers[i % fillers.length]; let w = write.find(y => y.topic_id === z.id);
      if (!w) { w = { topic_id: z.id, label: z.label, state: z.state, source: z.source === 'ladder' ? 'ladder:' + (z.refs[0] || '') : z.source, count: 0, terms: z.terms.slice(0, 8), chosen_by: z.chosen_by || '', reason: 'free room in your panel: ' + z.why, fresh: false }; write.push(w); }
      w.count++; free--; have.set(z.id, n0(have.get(z.id)) + 1); }
    // as before the focus rule: a settled panel is topped up only when 2 or more questions are missing (not every week for one)
    if (!retire.length && !write.some(w => w.fresh) && write.reduce((t, w) => t + w.count, 0) < 2) write.length = 0;
    const kept = qs.filter(p => !retire.some(r => r.prompt_id === S(p.prompt_id)));
    const events = [];
    const byTopic = (list) => { const m = new Map(); for (const r of list) { const k = S(r.topic || r.label) || 'other'; m.set(k, n0(m.get(k)) + n0(r.count || 1)); } return [...m.entries()].map(([topic, n]) => ({ topic, n })); };
    const added = byTopic(write.map(w => ({ topic: w.label, count: w.count }))), gone = byTopic(retire);
    if (added.length || gone.length) events.push({ at: now, added, retired: gone, reason: provisional ? 'your AI questions now follow your keywords (the panel had no trend yet)' : x.full ? 'the month\'s review of your AI questions' : 'a new keyword ladder was added to your AI questions' });
    const summary = (() => { const a = write.reduce((s, w) => s + w.count, 0); const parts = [];
      if (a) parts.push(a + ' question' + (a === 1 ? '' : 's') + ' added for ' + [...new Set(write.map(w => '"' + w.label + '"'))].join(', '));
      if (retire.length) parts.push(retire.length + ' retired (' + [...new Set(retire.map(r => r.reason))].slice(0, 2).join('; ') + '; their history is kept)');
      return parts.length ? 'Your AI questions now follow your keywords: ' + parts.join(', ') + '. Trends restart for the topics that changed.' : ''; })();
    return { keep: kept.map(p => S(p.prompt_id)), retire, write, updates, owner_off_focus, market_drift, not_measured: Q.not_measured, raise_to: Q.raise_to, quota: [...Q.quota.entries()].map(([id, n]) => ({ id, n, have: n0(have.get(id)) })),
      provisional, events, summary, topic_of: [...of.entries()].map(([id, z]) => ({ prompt_id: id, topic: z ? z.label : '', state: z ? z.state : 'out' })) };
  };

  // ---- 6. the pulse asks the focus ------------------------------------------------------------------------------------------------------------
  /** pulse scope: 'focus' asks the questions of active topics and the pinned ones (a row the weekly run has not stamped yet is asked);
   *  'all' (the default of a site that existed before this release) asks the whole panel as before */
  const scopeOf = (v) => (low(v) === 'focus' ? 'focus' : 'all');
  const pulseKeeps = (p, scope) => scopeOf(scope) !== 'focus' || pin(p) || !S(p.focus_state) || S(p.focus_state) === 'active';

  // ---- 7. a trend that survives a moving panel ------------------------------------------------------------------------------------------------
  /** the change on the questions asked in both weeks: units [{prompt_id, engine, named}] now and before (weekly answers only, same engines) */
  const matched = (nowU, prevU, o) => { const opt = o || {}; const minQ = n0(opt.min_questions) || 6, minN = n0(opt.min_answers) || 12;
    const A = (nowU || []).filter(u => u && u.answered !== false && !u.pulse), B = (prevU || []).filter(u => u && u.answered !== false && !u.pulse);
    const eng = new Set(B.map(u => S(u.engine))); const qa = new Set(A.map(u => S(u.prompt_id))); const common = new Set([...new Set(B.map(u => S(u.prompt_id)))].filter(id => qa.has(id)));
    const a = A.filter(u => common.has(S(u.prompt_id)) && eng.has(S(u.engine))), b = B.filter(u => common.has(S(u.prompt_id)) && new Set(A.map(z => S(z.engine))).has(S(u.engine)));
    const k1 = a.filter(u => u.named).length, n1 = a.length, k0 = b.filter(u => u.named).length, n0_ = b.length;
    const ok = common.size >= minQ && n1 >= minN && n0_ >= minN;
    const r1 = n1 ? Math.round(1000 * k1 / n1) / 10 : null, r0 = n0_ ? Math.round(1000 * k0 / n0_) / 10 : null;
    let z = null; if (ok) { const p = (k1 + k0) / (n1 + n0_); const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n0_)); z = se > 0 ? Math.round(100 * ((k1 / n1) - (k0 / n0_)) / se) / 100 : 0; }
    return { available: ok, questions: common.size, n: n1, k: k1, n_before: n0_, k_before: k0, rate: r1, rate_before: r0, delta: ok ? Math.round(10 * (r1 - r0)) / 10 : null, z, significant: ok ? Math.abs(z) >= 1.96 : null,
      label: ok ? 'on the ' + common.size + ' questions asked both weeks (' + n1 + ' answers now, ' + n0_ + ' before)' : (common.size < minQ ? 'fewer than ' + minQ + ' questions were asked both weeks (' + common.size + ')' : 'too few answers on the questions asked both weeks (' + n1 + ' now, ' + n0_ + ' before; ' + minN + ' needed on each side)') }; };
  /** a topic's own overlap between two weeks (its question ids): its segment is compared when 80% of its earlier questions are still asked */
  const topicOverlap = (nowIds, prevIds) => { const A = new Set((nowIds || []).map(S)), B = [...new Set((prevIds || []).map(S))]; if (!B.length || !A.size) return { share: null, same: null, common: 0 };
    const c = B.filter(id => A.has(id)).length; const share = c / Math.max(A.size, B.length); return { share: Math.round(1000 * share) / 1000, same: share >= 0.8, common: c }; };

  // ---- 8. the writer's place rule: the cities a question may name ------------------------------------------------------------------------------
  const CITIES = { AE: ['Dubai', 'Abu Dhabi', 'Sharjah'], SA: ['Riyadh', 'Jeddah', 'Dammam'], PK: ['Karachi', 'Lahore', 'Islamabad'], IN: ['Mumbai', 'Delhi', 'Bengaluru'], GB: ['London', 'Manchester', 'Birmingham'],
    US: ['New York', 'Los Angeles', 'Chicago'], CA: ['Toronto', 'Vancouver', 'Montreal'], AU: ['Sydney', 'Melbourne', 'Brisbane'], NZ: ['Auckland', 'Wellington', 'Christchurch'], IE: ['Dublin', 'Cork', 'Galway'],
    SG: ['Singapore'], ZA: ['Johannesburg', 'Cape Town', 'Durban'], DE: ['Berlin', 'Munich', 'Hamburg'], AT: ['Vienna', 'Graz', 'Salzburg'], FR: ['Paris', 'Lyon', 'Marseille'], ES: ['Madrid', 'Barcelona', 'Valencia'],
    IT: ['Milan', 'Rome', 'Turin'], NL: ['Amsterdam', 'Rotterdam', 'Utrecht'], BR: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia'], MX: ['Mexico City', 'Guadalajara', 'Monterrey'] };
  const citiesOf = (iso) => (CITIES[S(iso).toUpperCase()] || []).slice();
  /** a written question that names a place outside its market: the place words, or [] (the M7 rule, applied to what the writer wrote) */
  const placesOutside = (text, iso) => { if (!G.market || !S(iso)) return []; const m = G.market(text, iso); return m.ok ? [] : m.outside; };

  return { CFG, W, words, stem, sameTopic, carries, inMarket, focusOf, topicOf, quotas, reconcile, scopeOf, pulseKeeps, matched, topicOverlap, citiesOf, placesOutside, ownerQ };
})();
// ---- W2-E1 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §1 §2, fixes/W2-E1.md): the answer-level data every engine call
// already returns and the tracker used to throw away. Inlined (AAD) into Parse AI Answers (weekly and pulse), Analyst Jobs, Apply Analysis,
// AI Metrics, AI Report and Prompt Jobs by build_monitors.py (placeholder AI_ANSWER_DATA).
//   per answer (seo_ai_answers): the full answer text (capped at 12,000 characters, the analyst re-reads it in a run's last part when the part
//     that paid for it died before its analysis), every source cited in order (cited_json), the pages the engine READ but did not cite
//     (retrieved_json: the ChatGPT interface's search_results minus its sources), the searches it ran (fanout_json), product cards
//     (products_json: ChatGPT chat_gpt_products, AI Mode / AI Overview ai_overview_shopping), ads (ads_json: ChatGPT chat_gpt_ad, AI Mode
//     ai_overview_paid), local-business cards (local_json: ChatGPT chat_gpt_local_businesses) and the model the response reports.
//     An empty list '[]' is "the engine can show these and showed none"; '' is "this engine does not report them" (or an older row).
//   per run (seo_ai_visibility): urls_json (your pages read / cited, the page cited instead), sources_json (rule-based source types, first /
//     last seen, half-life from stored history), shopping_json (trigger rate with n; "no shopping results", never 0%), ads_local_json.
// No URL constructor in the n8n sandbox: hosts are read with a regex.
const AAD = (() => {
  const TEXT_CAP = 12000, LIST_CAP = 40, FANOUT_CAP = 20;
  const S = (v) => v == null ? '' : String(v);
  const tb = (v) => v === true || S(v) === 'true';
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\d?\./, '') : ''; };
  const normH = (h) => S(h).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\d?\./, '').replace(/[\/?#:].*$/, '');
  const TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+)$/i;
  const clean = (u) => { const s = S(u).trim(); const m = s.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i); if (!m) return s.replace(/#.*$/, '');
    const q = (m[4] || '').replace(/^\?/, '').split('&').filter(kv => kv && !TRACK.test(kv.split('=')[0])).join('&');
    return m[1].toLowerCase() + '://' + m[2].toLowerCase().replace(/^www\./, '').replace(/:(?:80|443)$/, '') + (m[3] || '/') + (q ? '?' + q : ''); };
  const SL2 = /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|go|or|ne|gob|gouv)\.[a-z]{2}$/;
  const regD = (h) => { const x = normH(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return p.join('.'); return SL2.test(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const J = (v, d) => { if (v && typeof v === 'object') return v; if (v == null || v === '') return d; try { const x = JSON.parse(String(v)); return x == null ? d : x; } catch (e) { return d; } };
  const pctOf = (a, b) => b ? Math.round(1000 * a / b) / 10 : null;
  const wilson = (k, n) => { if (!n) return null; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, Math.round(1000 * (c - h)) / 10), Math.min(100, Math.round(1000 * (c + h)) / 10)]; };
  const num = (v) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  // the answer's full text: whitespace normalised (runs of spaces / tabs to one, 3+ line breaks to 2: the list structure the analyst and
  // the app read stays), capped at TEXT_CAP characters
  const textOf = (t) => { const s = S(t).replace(/\r\n?/g, '\n').replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return { text: s.slice(0, TEXT_CAP), cut: s.length > TEXT_CAP, len: s.length }; };

  // ---- which engines report what (an engine that cannot show a thing stores '', never '[]') ----
  const SHOWS = { products: new Set(['chatgpt', 'ai_mode', 'ai_overview']), ads: new Set(['chatgpt', 'ai_mode', 'ai_overview']), local: new Set(['chatgpt']), retrieved: new Set(['chatgpt']) };
  const isScraper = (engine, res) => engine === 'chatgpt' || (engine === 'gemini' && !!res && (res.markdown != null || (res.items || []).some(x => /^gemini_/.test(S(x && x.type)))));

  /** One answer's data (WAVE2_CONTRACTS §1). ctx: { engine, res (the task result), answered, text, cites [{url, host, title}], fanout [..],
   *  isOurs(host), ownNames [lower-case brand names], entities (AIE.read(...).entities), sameEntity, kindOfDomain } */
  const answerFields = (ctx) => {
    const c = ctx || {}; const e = S(c.engine); const res = c.res || null;
    const empty = { answer_text: '', cited_json: '', retrieved_json: '', fanout_json: '', products_json: '', ads_json: '', local_json: '', model: '', detail_json: '' };
    if (!c.answered || !res) return { ...empty, model: res ? S(res.model || res.model_name).slice(0, 80) : '' };
    const isOurs = typeof c.isOurs === 'function' ? c.isOurs : () => false;
    const own = (c.ownNames || []).map(x => S(x).toLowerCase()).filter(x => x.length >= 3);
    const ents = Array.isArray(c.entities) ? c.entities : [];
    const same = typeof c.sameEntity === 'function' ? c.sameEntity : (a, b) => regD(a) === regD(b);
    const entityOf = (host) => { const h = normH(host); if (!h) return { id: '', role: '' }; if (isOurs(h)) return { id: regD(h), role: 'self' };
      const r = regD(h); const x = ents.find(en => en && en.id && /\./.test(S(en.id)) && same(en.id, r)); return x ? { id: S(x.id), role: S(x.role) || 'source' } : { id: r, role: 'source' }; };
    const ownName = (s) => { const t = S(s).toLowerCase(); return !!t && own.some(n => t === n || (n.length >= 5 && t.indexOf(n) >= 0)); };
    const T = textOf(c.text);
    // every source cited, in order (1-based), one entry per page
    const seen = new Set(); const cited = [];
    for (const x of (c.cites || [])) { const url = x && x.url ? clean(x.url).slice(0, 300) : ''; const host = normH((x && x.host) || hostOf(url)); if (!host && !url) continue;
      const k = url || ('host:' + host); if (seen.has(k)) continue; seen.add(k); const en = entityOf(host);
      cited.push({ url, host, entity_id: en.id, role: en.role, position: cited.length + 1 }); if (cited.length >= LIST_CAP) break; }
    const citedUrls = new Set(cited.map(x => x.url).filter(Boolean));
    // pages the engine read but did not cite: the ChatGPT interface returns everything it retrieved (search_results) beside what it cited
    let retrieved = null;
    if (SHOWS.retrieved.has(e) && isScraper(e, res)) { retrieved = []; const rs = new Set();
      for (const x of (Array.isArray(res.search_results) ? res.search_results : [])) { const url = x && x.url ? clean(x.url).slice(0, 300) : ''; if (!url || citedUrls.has(url) || rs.has(url)) continue; rs.add(url);
        const host = normH(hostOf(url) || (x && x.domain)); retrieved.push({ url, host, entity_id: entityOf(host).id }); if (retrieved.length >= LIST_CAP) break; } }
    const fanout = Array.isArray(c.fanout) ? [...new Set(c.fanout.map(q => S(q).replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean))].slice(0, FANOUT_CAP) : [];
    const items = Array.isArray(res.items) ? res.items : [];
    const ao = items.find(x => x && x.type === 'ai_overview') || null;
    const sub = ao && Array.isArray(ao.items) ? ao.items : [];
    // product cards: ChatGPT's carousel (chat_gpt_products) and Google's shopping block inside the AI answer (ai_overview_shopping)
    let products = null;
    if (SHOWS.products.has(e) && (e === 'chatgpt' ? isScraper(e, res) : !!ao)) { products = [];
      const groups = e === 'chatgpt' ? [...items.filter(x => x && x.type === 'chat_gpt_products'), ...(Array.isArray(res.chat_gpt_products) ? [{ items: res.chat_gpt_products }] : [])] : sub.filter(x => x && x.type === 'ai_overview_shopping');
      for (const g of groups) for (const p of (Array.isArray(g.items) ? g.items : [])) { if (!p) continue;
        const url = p.url ? clean(p.url).slice(0, 300) : ''; const host = normH(p.domain || hostOf(url));
        const merchant = S(e === 'chatgpt' ? (p.merchants || p.merchant || p.seller || host) : (p.seller || p.marketplace || host)).replace(/\s+/g, ' ').trim().slice(0, 80);
        const pr = p.price && typeof p.price === 'object' ? p.price : null;
        const price = pr ? num(pr.current != null ? pr.current : pr.max_value) : num(p.price);
        const currency = S(pr ? pr.currency : p.currency).slice(0, 8);
        const en = entityOf(host);
        products.push({ title: S(p.title).replace(/\s+/g, ' ').trim().slice(0, 160), merchant, price, currency, url, position: products.length + 1, entity_id: en.id, own: (!!host && isOurs(host)) || ownName(merchant) });
        if (products.length >= LIST_CAP) break; } }
    // ads: ChatGPT's ad unit (is_rendered: false = in the response but not shown) and the paid block inside Google's AI answer
    let ads = null;
    if (SHOWS.ads.has(e) && (e === 'chatgpt' ? isScraper(e, res) : !!ao)) { ads = [];
      if (e === 'chatgpt') for (const a of items.filter(x => x && x.type === 'chat_gpt_ad')) { const adv = a.advertiser || {}; const url = clean(a.url || adv.url || '').slice(0, 300); const host = normH(a.domain || hostOf(url) || hostOf(adv.url));
        ads.push({ advertiser: S(adv.name || a.title || host).slice(0, 80), url, host, rendered: a.is_rendered !== false }); }
      else for (const g of sub.filter(x => x && x.type === 'ai_overview_paid')) for (const a of (Array.isArray(g.items) ? g.items : [])) { if (!a) continue; const url = clean(a.url || '').slice(0, 300); const host = normH(a.domain || hostOf(url));
        ads.push({ advertiser: S(a.website_name || a.title || host).slice(0, 80), url, host, rendered: true }); }
      ads = ads.slice(0, 12); }
    // local-business cards (ChatGPT)
    let local = null;
    if (SHOWS.local.has(e) && isScraper(e, res)) { local = [];
      for (const g of items.filter(x => x && x.type === 'chat_gpt_local_businesses')) for (const b of (Array.isArray(g.items) ? g.items : [])) { if (!b) continue; const url = clean(b.url || '').slice(0, 300); const host = normH(b.domain || hostOf(url));
        local.push({ name: S(b.title || b.name).replace(/\s+/g, ' ').trim().slice(0, 100), url, host, position: local.length + 1, own: (!!host && isOurs(host)) || ownName(b.title || b.name) }); }
      local = local.slice(0, 20); }
    const detail = { v: 1, answer_len: T.len }; if (T.cut) detail.answer_cut = true;
    return { answer_text: T.text, cited_json: JSON.stringify(cited), retrieved_json: retrieved ? JSON.stringify(retrieved) : '',
      fanout_json: (res.fan_out_queries !== undefined || fanout.length) ? JSON.stringify(fanout) : '',
      products_json: products ? JSON.stringify(products) : '', ads_json: ads ? JSON.stringify(ads) : '', local_json: local ? JSON.stringify(local) : '',
      model: S(res.model || res.model_name).slice(0, 80), detail_json: JSON.stringify(detail) };
  };

  // ---- the analyst's mark (detail_json.analysed) and a stored row read back (Load AI Run Answers: strings for booleans and numbers) ----
  const analysed = (r) => !!J(r && r.detail_json, {}).analysed;
  const markAnalysed = (detailJson) => { const d = J(detailJson, {}); d.v = d.v || 1; d.analysed = true; return JSON.stringify(d); };
  const fromStored = (r) => ({ ...r, answered: tb(r.answered), mentioned: tb(r.mentioned), cited: tb(r.cited), named: r.named === '' || r.named == null ? r.named : tb(r.named),
    rank: Number(r.rank) || 0, position: num(r.position), cost: Number(r.cost) || 0, _text: S(r.answer_text), _stored: true });

  // ---- source types (rule-based; MARKET_RND §3.1 gap 11). Typed on the FULL host (community.x.com is a forum), keyed by registrable domain ----
  const T_GOV = /\.gov(\.[a-z]{2,3})?$|(^|\.)gov\.[a-z]{2}$|(^|\.)(gouv|gob|go|gv|govt|gc)\.[a-z]{2}$|\.mil(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|(^|\.)europa\.eu$|(^|\.)(canada\.ca|admin\.ch|bund\.de|service-public\.fr|nhs\.uk|usa\.gov)$|(^|\.)(difc|adgm|dmcc|dafz|dafza|jafza|rakez|dso|ifza|shams|kezad|dwtc|dubaided|saifzone|dubaichamber|abudhabichamber)\.(com|ae|org)$|(^|\.)[a-z]{3,}fz\.(ae|com)$|freezone/i;
  const T_REF = /(^|\.)(wikipedia|wikimedia|wikidata|wiktionary|britannica|investopedia|merriam-webster|dictionary|thefreedictionary|collinsdictionary|arxiv|researchgate|jstor|sciencedirect|springer|semanticscholar|ssrn|w3|iso|ieee|ietf|openstax|khanacademy|plato\.stanford)\.[a-z.]+$|(^|\.)scholar\.google\.[a-z.]+$|(^|\.)developer\.mozilla\.org$|\.edu(\.[a-z]{2})?$|(^|\.)ac\.[a-z]{2}$/i;
  const T_UGC = /(^|\.)(reddit|redd|youtube|youtu|quora|stackoverflow|stackexchange|superuser|serverfault|askubuntu|medium|substack|linkedin|facebook|fb|twitter|x|instagram|tiktok|pinterest|github|gitlab|discord|telegram|tumblr|blogspot|wordpress|hashnode|dev|vimeo|twitch|threads|bsky|mastodon|steamcommunity|xda-developers|spiceworks|tripadvisor-forum)\.(com|be|co|me|io|net|to|org|app|social|it)$|(^|\.)(community|communities|forum|forums|discuss|discussion|discussions|answers|boards|groups|talk)\.[a-z0-9-]+\.[a-z.]+$|(^|[.-])forums?([.-]|$)/i;
  const T_DIR = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|softwaresuggest|sourceforge|saashub|alternativeto|producthunt|glassdoor|zoominfo|owler|tripadvisor|bbb|angi|angieslist|houzz|thumbtack|hidubai|dnb|kompass|europages|justdial|sulekha|trustradius|gartnerpeerinsights|peerspot|appsumo|bayt|indeed|yellowpages|yell|hotfrog|cylex|foursquare|manta|chamberofcommerce|expertise|upcity|bark|fiverr|upwork)\.[a-z.]+$|yellow-?pages|directory|listings?\b|(^|\.)aspl?ist|uaeasp|einvoicinglist/i;
  const T_EDIT = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|thenational|zawya|arabianbusiness|gulfbusiness|tradearabia|wam|emirates247|khaleej|alkhaleej|albayan|argaam|arabnews|saudigazette|reuters|bloomberg|forbes|cnbc|bbc|cnn|nytimes|washingtonpost|wsj|ft|economist|techcrunch|theverge|wired|engadget|venturebeat|zdnet|cnet|techradar|pcmag|computerworld|computerweekly|itpro|cio|infoworld|theregister|entrepreneur|inc|fortune|fastcompany|businessinsider|marketwatch|axios|apnews|aljazeera|theguardian|guardian|telegraph|independent|timesofindia|hindustantimes|economictimes|livemint|dawn|nerdwallet|hbr|mckinsey|gartner|forrester|statista|idc|frost|marketsandmarkets|mordorintelligence|grandviewresearch|searchenginejournal|searchengineland|thedrum|adweek|campaignme|pcworld|tomsguide|tomshardware|lifewire|makeuseof|howtogeek|digitaltrends|mashable|gizmodo|vox|politico|npr|abc|cbsnews|nbcnews|foxnews|usatoday|time|newsweek)\.[a-z.]+$/i;
  const T_EDIT_WORD = /(^|[.-])(news|times|post|herald|tribune|gazette|journal|magazine|mag|daily|weekly|chronicle|telegraph|observer|express|courier|insider|today|wire|press|media|reporter)([.-]|$)|news\.|magazine/i;
  const SOURCE_TYPES = ['own', 'rival', 'ugc', 'reference', 'editorial', 'government', 'directory', 'other'];
  /** ctx: { own: domain, isOurs(host)?, isRival(host)? } -> one of SOURCE_TYPES */
  const sourceType = (host, ctx) => { const h = normH(host); const c = ctx || {}; if (!h) return 'other';
    const own = normH(c.own); if ((typeof c.isOurs === 'function' && c.isOurs(h)) || (own && (h === own || h.endsWith('.' + own)))) return 'own';
    if (typeof c.isRival === 'function' && c.isRival(h)) return 'rival';
    if (T_GOV.test(h)) return 'government';
    if (T_REF.test(h)) return 'reference';
    if (T_UGC.test(h)) return 'ugc';
    if (T_DIR.test(h)) return 'directory';
    if (T_EDIT.test(h) || T_EDIT_WORD.test(h)) return 'editorial';
    return 'other'; };
  const TYPE_WORDS = { own: 'your site', rival: 'businesses AI names instead of you', ugc: 'forums, video and social posts', reference: 'reference sites (encyclopedias, academic)', editorial: 'news, magazines and analysts',
    government: 'government and official bodies', directory: 'directories and review sites', other: 'other company and product sites' };

  // ---- one run's answers -> the visibility row's four JSON columns (WAVE2_CONTRACTS §2) ----
  /** a: { rows (the run's answered rows, stored or in memory), domain, isOurs(host), isRival(host), rivalIds (Set of entity ids), history (earlier
   *  seo_ai_visibility rows of the site, any order), checked_at, ENG (engine names) } */
  const aggregate = (a) => {
    const A = a || {}; const rows = (A.rows || []).filter(r => r && tb(r.answered) && !r.error);
    const isOurs = typeof A.isOurs === 'function' ? A.isOurs : (h) => { const o = normH(A.domain); const x = normH(h); return !!x && (x === o || x.endsWith('.' + o)); };
    const rivalIds = A.rivalIds instanceof Set ? A.rivalIds : new Set(A.rivalIds || []);
    const isRivalH = (h, idHint, role) => role === 'competitor' || (typeof A.isRival === 'function' && A.isRival(h)) || rivalIds.has(regD(h)) || (!!idHint && rivalIds.has(S(idHint)));
    const citedOf = (r) => { const v = J(r.cited_json, null); if (Array.isArray(v)) return v.filter(x => x && (x.url || x.host));
      // an older row (before W2-E1): its own pages (our_urls) and the third-party pages it cited (cited_urls), order unknown
      const o = S(r.our_urls).split(/\s+/).filter(Boolean).map(u => ({ url: clean(u), host: hostOf(u), role: 'self' }));
      const t = J(r.cited_urls, []); return [...o, ...(Array.isArray(t) ? t : []).filter(x => x && x.u).map(x => ({ url: clean(x.u), host: hostOf(x.u) }))]; };
    const retrOf = (r) => { const v = J(r.retrieved_json, null); return Array.isArray(v) ? v.filter(x => x && x.url) : null; };
    // -- urls_json: your pages AI read and cited; the page AI cited instead
    const ownU = new Map(); const rivU = new Map(); const reportsRetrieval = rows.filter(r => retrOf(r) !== null).length;
    const bump = (m, k, o) => { const x = m.get(k) || { ...o, n: 0 }; x.n++; m.set(k, x); return x; };
    for (const r of rows) {
      const cited = citedOf(r); const retr = retrOf(r) || [];
      const citedOwn = new Set(cited.filter(x => x.url && isOurs(x.host || hostOf(x.url))).map(x => clean(x.url)));
      const readOwn = new Set(retr.filter(x => isOurs(x.host || hostOf(x.url))).map(x => clean(x.url)));
      const rivalsCited = cited.filter(x => x.url && !isOurs(x.host || hostOf(x.url)) && isRivalH(x.host || hostOf(x.url), x.entity_id, x.role));
      const othersCited = cited.filter(x => x.url && !isOurs(x.host || hostOf(x.url)));
      for (const x of rivalsCited) { const y = rivU.get(clean(x.url)) || { url: clean(x.url), host: normH(x.host || hostOf(x.url)), entity_id: S(x.entity_id) || regD(x.host || hostOf(x.url)), cited_n: 0 }; y.cited_n++; rivU.set(y.url, y); }
      for (const u of new Set([...citedOwn, ...readOwn])) {
        const o = ownU.get(u) || { url: u, cited_n: 0, retrieved_n: 0, engines: new Set(), questions: new Set(), instead: new Map(), competing: new Map(), read_not_cited_n: 0 };
        o.retrieved_n++; o.engines.add(S(r.engine)); if (r.prompt_id) o.questions.add(S(r.prompt_id));
        if (citedOwn.has(u)) o.cited_n++;
        else { o.read_not_cited_n++; for (const x of rivalsCited) bump(o.instead, clean(x.url), { url: clean(x.url), host: normH(x.host || hostOf(x.url)) });
          for (const x of othersCited) bump(o.competing, clean(x.url), { url: clean(x.url), host: normH(x.host || hostOf(x.url)) }); }
        ownU.set(u, o); } }
    const topN = (m, k) => [...m.values()].sort((x, y) => y.n - x.n || S(x.url).localeCompare(S(y.url))).slice(0, k).map(x => ({ url: x.url, host: x.host, n: x.n }));
    const ownRows = [...ownU.values()].sort((x, y) => y.cited_n - x.cited_n || y.retrieved_n - x.retrieved_n || x.url.localeCompare(y.url));
    const urls = { answers_n: rows.length, retrieval_answers_n: reportsRetrieval,
      own: ownRows.slice(0, 25).map(o => ({ url: o.url, cited_n: o.cited_n, retrieved_n: o.retrieved_n, cited_rate: pctOf(o.cited_n, o.retrieved_n), rate_n: o.retrieved_n, answers_n: rows.length,
        engines: [...o.engines].sort(), questions: [...o.questions].slice(0, 20), rival_cited_instead: topN(o.instead, 3) })),
      rivals: [...rivU.values()].sort((x, y) => y.cited_n - x.cited_n || x.url.localeCompare(y.url)).slice(0, 20),
      retrieved_not_cited: ownRows.filter(o => o.read_not_cited_n > 0).sort((x, y) => y.read_not_cited_n - x.read_not_cited_n || x.url.localeCompare(y.url)).slice(0, 15)
        .map(o => ({ url: o.url, retrieved_n: o.retrieved_n, cited_n: o.cited_n, read_not_cited_n: o.read_not_cited_n, top_competing: topN(o.competing, 3) })),
      note: reportsRetrieval ? '' : 'no engine of this run reports the pages it read (only the ChatGPT interface does), so "read but not cited" is not measured' };
    // -- sources_json: where AI gets its answers, by type; first / last seen and half-life from the stored history
    const dom = new Map(); let pairs = 0; let citingAnswers = 0;
    for (const r of rows) { const hs = new Map(); for (const x of citedOf(r)) { const h = normH(x.host || hostOf(x.url)); if (!h) continue; const k = regD(h); if (!hs.has(k)) hs.set(k, { h, x }); }
      if (hs.size) citingAnswers++;
      for (const [k, { h, x }] of hs) { const d = dom.get(k) || { host: k, type: '', cited_n: 0, engines: new Set() }; d.cited_n++; d.engines.add(S(r.engine)); if (!d.type) d.type = isOurs(h) ? 'own' : isRivalH(h, x.entity_id, x.role) ? 'rival' : sourceType(h, { own: A.domain, isOurs }); dom.set(k, d); pairs++; } }
    const today = S(A.checked_at || new Date().toISOString()).slice(0, 10);
    const hist = (A.history || []).map(v => ({ at: S(v && v.checked_at).slice(0, 10), s: J(v && v.sources_json, null) })).filter(v => v.at && v.at < today && v.s && !Array.isArray(v.s) && Array.isArray(v.s.domains))
      .sort((x, y) => x.at.localeCompare(y.at));
    const last = hist.length ? hist[hist.length - 1].s : null;
    const prevD = new Map(((last && last.domains) || []).map(d => [S(d.host), d]));
    const shareAt = (s, host) => { const d = (s.domains || []).find(x => S(x.host) === host); const n = Number(s.n) || 0; return d && n ? 100 * (Number(d.cited_n) || 0) / n : 0; };
    const daysBetween = (a0, b0) => Math.round((Date.parse(b0 + 'T00:00:00Z') - Date.parse(a0 + 'T00:00:00Z')) / 864e5);
    const decayOf = (host, firstSeen, nowShare) => {
      const pts = [...hist.filter(v => v.at >= firstSeen).map(v => ({ at: v.at, y: shareAt(v.s, host) })), { at: today, y: nowShare }];
      if (pts.length < 3 || daysBetween(pts[0].at, today) < 14) return { half_life_days: null, decay: 'too little history', weeks: pts.length };
      let pk = 0; pts.forEach((p, i) => { if (p.y > pts[pk].y) pk = i; });
      if (!(pts[pk].y > 0)) return { half_life_days: null, decay: 'not cited', weeks: pts.length };
      for (let i = pk + 1; i < pts.length; i++) if (pts[i].y <= pts[pk].y / 2) { const a = pts[i - 1], b = pts[i]; const f = (a.y - pts[pk].y / 2) / Math.max(1e-9, a.y - b.y);
        return { half_life_days: Math.max(1, Math.round(daysBetween(pts[pk].at, a.at) + f * daysBetween(a.at, b.at))), decay: 'halved', weeks: pts.length }; }
      return { half_life_days: null, decay: pk === pts.length - 1 ? 'at its peak now' : 'holding', weeks: pts.length }; };
    const out = [];
    for (const d of dom.values()) { const p0 = prevD.get(d.host); const first = p0 && p0.first_seen ? S(p0.first_seen).slice(0, 10) : today; const share = pctOf(d.cited_n, pairs);
      out.push({ host: d.host, type: d.type, cited_n: d.cited_n, share, engines: [...d.engines].sort(), first_seen: first < today ? first : today, last_seen: today, ...decayOf(d.host, first < today ? first : today, share || 0) }); }
    // a domain cited before and not this run keeps its dates for 120 days, so its first-seen date and its decay stay readable
    for (const [h, p0] of prevD) { if (dom.has(h) || !p0.last_seen || daysBetween(S(p0.last_seen).slice(0, 10), today) > 120) continue; const first = S(p0.first_seen || p0.last_seen).slice(0, 10);
      out.push({ host: h, type: S(p0.type) || sourceType(h, { own: A.domain, isOurs }), cited_n: 0, share: 0, engines: [], first_seen: first, last_seen: S(p0.last_seen).slice(0, 10), ...decayOf(h, first, 0) }); }
    out.sort((x, y) => y.cited_n - x.cited_n || S(y.last_seen).localeCompare(S(x.last_seen)) || x.host.localeCompare(y.host));
    const types = {}; for (const t of SOURCE_TYPES) { const k = out.filter(d => d.type === t).reduce((s, d) => s + d.cited_n, 0); types[t] = { n: k, share: pairs ? pctOf(k, pairs) : null }; }
    const sources = { v: 2, n: pairs, answers_n: rows.length, citing_answers_n: citingAnswers, types, domains: out.slice(0, 80), history_runs: hist.length, method: 'rule-based type by host (own, rival, ugc, reference, editorial, government, directory, other); share = a domain\'s citations out of every (answer, domain) citation; half-life = days from the domain\'s peak share to half of it, from 3 or more stored runs over 14 days or more' };
    // -- shopping_json: how often an answer shows product cards, whose, and where you are
    const shopRows = rows.filter(r => Array.isArray(J(r.products_json, null)));
    const byE = {}; let trig = 0, prodN = 0, ownAns = 0; const ownPos = []; const merch = new Map(); const prods = new Map();
    for (const r of shopRows) { const ps = J(r.products_json, []); const e = S(r.engine); const b = byE[e] || (byE[e] = { name: (A.ENG || {})[e] || e, answers_n: 0, trigger_n: 0, products_n: 0 }); b.answers_n++;
      if (!ps.length) continue; trig++; b.trigger_n++; b.products_n += ps.length; prodN += ps.length;
      const mine = ps.filter(p => p && p.own); if (mine.length) { ownAns++; ownPos.push(Math.min(...mine.map(p => Number(p.position) || 99))); }
      for (const p of ps) { const m0 = S(p.merchant || p.entity_id || 'unknown').trim() || 'unknown'; const k = m0.toLowerCase(); const x = merch.get(k) || { merchant: m0, n: 0 }; x.n++; merch.set(k, x);
        const tk = S(p.title).toLowerCase(); if (tk) { const y = prods.get(tk) || { title: S(p.title), merchant: m0, n: 0, pos: 0, own: !!p.own }; y.n++; y.pos += Number(p.position) || 0; prods.set(tk, y); } } }
    for (const b of Object.values(byE)) b.trigger_rate = b.trigger_n ? pctOf(b.trigger_n, b.answers_n) : null;
    const shopping = trig ? { status: 'measured', answers_n: shopRows.length, trigger_n: trig, trigger_rate: pctOf(trig, shopRows.length), trigger_ci: wilson(trig, shopRows.length), products_n: prodN,
        own_presence_rate: pctOf(ownAns, trig), own_presence_n: trig, own_answers_n: ownAns, own_avg_position: ownPos.length ? Math.round(10 * ownPos.reduce((s, x) => s + x, 0) / ownPos.length) / 10 : null,
        merchants: [...merch.values()].sort((x, y) => y.n - x.n).slice(0, 10).map(x => ({ merchant: x.merchant, n: x.n, share: pctOf(x.n, prodN) })),
        products: [...prods.values()].sort((x, y) => y.n - x.n).slice(0, 10).map(x => ({ title: x.title, merchant: x.merchant, n: x.n, avg_position: Math.round(10 * x.pos / x.n) / 10, own: x.own })), by_engine: byE }
      : { status: 'no shopping results', answers_n: shopRows.length, trigger_n: 0, trigger_rate: null, products_n: 0, own_presence_rate: null, own_avg_position: null, merchants: [], by_engine: byE,
        note: shopRows.length ? 'no answer showed product cards (' + shopRows.length + ' answers on engines that can show them)' : 'no engine of this run can show product cards' };
    // -- ads_local_json: who advertises inside the answers to your questions; local-business cards and whether you are in them
    const adRows = rows.filter(r => Array.isArray(J(r.ads_json, null))); const adv = new Map(); let adSeen = 0, adShown = 0;
    for (const r of adRows) { const as = J(r.ads_json, []); if (!as.length) continue; adSeen++; if (as.some(x => x && x.rendered !== false)) adShown++;
      for (const x of as) { if (!x) continue; const k = S(x.host || x.advertiser).toLowerCase(); const y = adv.get(k) || { name: S(x.advertiser || x.host), host: S(x.host), n: 0, own: isOurs(x.host) }; y.n++; adv.set(k, y); } }
    const locRows = rows.filter(r => Array.isArray(J(r.local_json, null))); const loc = new Map(); let locSeen = 0, locOwn = 0;
    for (const r of locRows) { const ls = J(r.local_json, []); if (!ls.length) continue; locSeen++; if (ls.some(x => x && x.own)) locOwn++;
      for (const x of ls) { if (!x || x.own) continue; const k = S(x.name || x.host).toLowerCase(); const y = loc.get(k) || { name: S(x.name || x.host), host: S(x.host), n: 0 }; y.n++; loc.set(k, y); } }
    const ads_local = { ads: { seen_n: adSeen, rendered_n: adShown, answers_n: adRows.length, rate: adSeen ? pctOf(adSeen, adRows.length) : null, advertisers: [...adv.values()].sort((x, y) => y.n - x.n).slice(0, 10) },
      local: { seen_n: locSeen, own_n: locOwn, answers_n: locRows.length, rate: locSeen ? pctOf(locSeen, locRows.length) : null, own_rate: locSeen ? pctOf(locOwn, locSeen) : null, rivals: [...loc.values()].sort((x, y) => y.n - x.n).slice(0, 10) } };
    return { urls, sources, shopping, ads_local };
  };

  // ---- the panel: a "shopping" stage only for a site whose services or pages show it sells products ----
  const SHOP_TYPE = /\b(e-?commerce|online (shop|store)|retail(er)?|shop|store|marketplace|brand|d2c|dtc|direct[- ]to[- ]consumer|manufacturer|wholesale|boutique)\b/i;
  const SHOP_WORD = /\b(buy|shop|store|products?|collections?|catalogue|catalog|add to cart|free shipping|delivery)\b/i;
  const SHOP_PATH = /\/(products?|shop|store|collections?|catalog(ue)?|item|items|p|dp|buy|cart)\/[^\/?#]+/i;
  const sellsProducts = (p, pages) => { const P = p || {}; const svc = [...(P.services || []), ...(P.topics || [])].map(S);
    const urls = (pages || []).map(x => S(x && (x.url || x))).filter(Boolean); const productPages = urls.filter(u => SHOP_PATH.test(u)).length;
    const byType = SHOP_TYPE.test(S(P.business_type)); const bySvc = svc.filter(s => SHOP_WORD.test(s)).length;
    const sells = productPages >= 3 || (byType && (productPages >= 1 || bySvc >= 1)) || bySvc >= 2;
    return { sells, why: sells ? [productPages ? productPages + ' product page(s) on the site' : '', byType ? 'business type "' + S(P.business_type) + '"' : '', bySvc ? bySvc + ' service(s) about products' : ''].filter(Boolean).join(', ') : '' }; };

  // ---- the report: four short sections, each only when it has something to say; n beside every rate ----
  const reportHtml = (D, k) => {
    if (!D) return ''; const h3 = k.h3, p_ = k.p_, table = k.table, esc = k.esc, n = k.n, link = k.link || ((u) => esc(u)); let html = '';
    const U = D.urls || {}; const SRC = D.sources || {}; const SH = D.shopping || {}; const AL = D.ads_local || {};
    if ((U.retrieved_not_cited || []).length) html += h3('Pages AI reads but does not cite') + p_('ChatGPT shows the pages it read before answering. These pages of yours were read in '
      + n(U.retrieval_answers_n) + ' answer(s) that could show it, but another page was cited. The page cited instead is the one to beat: match what it answers, how directly it answers it, and its date.')
      + table(['Your page', 'Read in', 'Cited in', 'Cited instead'], U.retrieved_not_cited.slice(0, 10).map(x => [link(x.url), n(x.retrieved_n) + ' answer' + (x.retrieved_n === 1 ? '' : 's'), n(x.cited_n),
        (x.top_competing || []).map(c => link(c.url, S(c.url).replace(/^https?:\/\//, '').slice(0, 90)) + ' (' + n(c.n) + ')').join('<br>') || '—']));
    if ((SRC.n || 0) > 0) { const T = SRC.types || {}; const rowsT = SOURCE_TYPES.filter(t => T[t] && T[t].n > 0).sort((a, b) => T[b].n - T[a].n);
      html += h3('Where AI gets its answers') + p_('Every site the answers cited, grouped by kind: ' + n(SRC.n) + ' citations in ' + n(SRC.citing_answers_n) + ' of ' + n(SRC.answers_n) + ' answers.')
        + table(['Kind of source', 'Citations', 'Share'], rowsT.map(t => [esc(TYPE_WORDS[t] || t), n(T[t].n), T[t].share + '% of ' + n(SRC.n)]))
        + table(['Site', 'Kind', 'Cited in', 'First seen', 'How long it stays cited'], (SRC.domains || []).filter(d => d.cited_n > 0).slice(0, 12).map(d => [esc(d.host), esc(d.type), n(d.cited_n) + ' answer' + (d.cited_n === 1 ? '' : 's'), esc(d.first_seen || '—'),
          d.half_life_days != null ? 'its share halved in ' + n(d.half_life_days) + ' days' : esc(d.decay === 'too little history' ? 'too little history (' + d.weeks + ' run' + (d.weeks === 1 ? '' : 's') + ')' : d.decay || '—')])); }
    if (SH.status === 'measured' && SH.trigger_n > 0) html += h3('AI shopping results') + p_('Product cards appeared in ' + n(SH.trigger_n) + ' of ' + n(SH.answers_n) + ' answers that can show them (' + SH.trigger_rate + '%'
      + (SH.trigger_ci ? ', 95% range ' + SH.trigger_ci[0] + '–' + SH.trigger_ci[1] + '%' : '') + '), ' + n(SH.products_n) + ' cards in all. Your products were in ' + n(SH.own_answers_n) + ' of those ' + n(SH.trigger_n) + ' answers'
      + (SH.own_avg_position != null ? ', at card ' + SH.own_avg_position + ' on average' : '') + '.')
      + table(['Seller', 'Cards', 'Share of cards'], (SH.merchants || []).map(x => [esc(x.merchant), n(x.n), x.share + '% of ' + n(SH.products_n)]));
    const AD = AL.ads || {}, LO = AL.local || {};
    if (AD.seen_n > 0) html += h3('Ads inside AI answers') + p_('An ad was part of ' + n(AD.seen_n) + ' of ' + n(AD.answers_n) + ' answers that can carry one (' + n(AD.rendered_n) + ' shown to the reader).')
      + table(['Advertiser', 'Answers'], (AD.advertisers || []).map(x => [esc(x.name) + (x.own ? ' (you)' : ''), n(x.n)]));
    if (LO.seen_n > 0) html += h3('Local business cards in AI answers') + p_('ChatGPT showed local business cards in ' + n(LO.seen_n) + ' of ' + n(LO.answers_n) + ' answers; you were among them in ' + n(LO.own_n) + ' of those ' + n(LO.seen_n) + '.')
      + ((LO.rivals || []).length ? table(['Business shown', 'Answers'], LO.rivals.map(x => [esc(x.name), n(x.n)])) : '');
    return html; };

  return { TEXT_CAP, SOURCE_TYPES, TYPE_WORDS, hostOf, normH, regD, clean, textOf, answerFields, analysed, markAnalysed, fromStored, sourceType, aggregate, sellsProducts, reportHtml, tb };
})();
// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----
const COUNTRIES = {
  'United States':        { code: 2840, iso: 'US', lang: 'en', language: 'English', spelling: 'American English',   currency: 'USD' },
  'United Kingdom':       { code: 2826, iso: 'GB', lang: 'en', language: 'English', spelling: 'British English',    currency: 'GBP' },
  'Canada':               { code: 2124, iso: 'CA', lang: 'en', language: 'English', spelling: 'Canadian English',   currency: 'CAD' },
  'Australia':            { code: 2036, iso: 'AU', lang: 'en', language: 'English', spelling: 'Australian English', currency: 'AUD' },
  'New Zealand':          { code: 2554, iso: 'NZ', lang: 'en', language: 'English', spelling: 'British English',    currency: 'NZD' },
  'Ireland':              { code: 2372, iso: 'IE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'EUR' },
  'Pakistan':             { code: 2586, iso: 'PK', lang: 'en', language: 'English', spelling: 'British English',    currency: 'PKR' },
  'India':                { code: 2356, iso: 'IN', lang: 'en', language: 'English', spelling: 'British English',    currency: 'INR' },
  'United Arab Emirates': { code: 2784, iso: 'AE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'AED' },
  'Saudi Arabia':         { code: 2682, iso: 'SA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SAR' },
  'Singapore':            { code: 2702, iso: 'SG', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SGD' },
  'South Africa':         { code: 2710, iso: 'ZA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'ZAR' },
  'Germany':              { code: 2276, iso: 'DE', lang: 'de', language: 'German',  spelling: 'German',             currency: 'EUR' },
  'France':               { code: 2250, iso: 'FR', lang: 'fr', language: 'French',  spelling: 'French',             currency: 'EUR' },
  'Spain':                { code: 2724, iso: 'ES', lang: 'es', language: 'Spanish', spelling: 'European Spanish',   currency: 'EUR' },
  'Italy':                { code: 2380, iso: 'IT', lang: 'it', language: 'Italian', spelling: 'Italian',            currency: 'EUR' },
  'Netherlands':          { code: 2528, iso: 'NL', lang: 'nl', language: 'Dutch',   spelling: 'Dutch',              currency: 'EUR' },
  'Brazil':               { code: 2076, iso: 'BR', lang: 'pt', language: 'Portuguese', spelling: 'Brazilian Portuguese', currency: 'BRL' },
  'Mexico':               { code: 2484, iso: 'MX', lang: 'es', language: 'Spanish', spelling: 'Mexican Spanish',    currency: 'MXN' }
};
const plans = $('AI Plan').all().map(i => i.json).filter(p => p.need_prompts && !p.nothing_to_do);
if (!plans.length) return [{ json: { skip: true } }];
let reads = [], texts = []; try { reads = $('Site Text Jobs').all().map(i => i.json).filter(j => !j.skip); texts = $('Read Site (AI)').all().map(i => String((i.json || {}).site_text || '')); } catch (e) {}
const textOf = (id) => { const k = reads.findIndex(r => r.site_id === id && r.kind !== 'competitor'); return k >= 0 ? (texts[k] || '').replace(/\n{3,}/g, '\n\n').slice(0, 3500) : ''; };
// what a competitor's homepage says it sells: its headings and menu lines (short lines), never its name — topic ideas for the writer
const offersOf = (id) => reads.map((r, k) => ({ r, t: texts[k] || '' })).filter(x => x.r.site_id === id && x.r.kind === 'competitor' && x.t)
  .map(x => [...new Set(x.t.split('\n').map(l => l.replace(/^[#*\-\s]+/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()).filter(l => l.length >= 6 && l.length <= 70 && !/[@©]|cookie|privacy|login|sign in|contact us|copyright/i.test(l)))].slice(0, 25).join(' · ')).filter(Boolean).slice(0, 3);
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery Answers').all().map(i => i.json || {}); } catch (e) {}
const discovered = (siteId) => { const out = [];
  dreq.forEach((q, i) => { if (q.site_id !== siteId || q.kind !== 'discover') return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
    for (const it of (((t.result || [])[0] || {}).items || [])) { const qq = String(it.question || '').replace(/\s+/g, ' ').trim(); if (qq.split(' ').length < 3 || qq.length > 220) continue;
      out.push({ question: qq, volume: Number(it.ai_search_volume) || 0, platform: q.platform, brands: (it.brand_entities || []).map(b => b.title).filter(Boolean).slice(0, 4) }); } });
  const seen = new Set(); return out.sort((a, b) => b.volume - a.volume).filter(x => { const k = x.question.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30); };
// G6: People-Also-Ask — the questions Google itself lists on the results page of each topic (serp/google/organic, $0.002 a page)
const paaOf = (siteId, market) => { const out = [];
  dreq.forEach((q, i) => { if (q.site_id !== siteId || q.kind !== 'paa' || (market && q.market && q.market !== market)) return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
    for (const it of (((t.result || [])[0] || {}).items || [])) { if (!it || it.type !== 'people_also_ask') continue;
      for (const el of (it.items || [])) { const qq = String((el && (el.title || el.question)) || '').replace(/\s+/g, ' ').trim(); if (qq.length >= 12 && qq.length <= 200) out.push(qq + ' (' + q.topic + ')'); } } });
  return [...new Set(out)].slice(0, 30); };
const LANG = { en: 'English', ar: 'Arabic', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', nl: 'Dutch', pt: 'Portuguese', tr: 'Turkish', hi: 'Hindi', ur: 'Urdu', ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ru: 'Russian', pl: 'Polish', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', id: 'Indonesian', ms: 'Malay', th: 'Thai', vi: 'Vietnamese', he: 'Hebrew', fa: 'Persian' };
const COUNTRY = (cc) => { try { const c = Object.entries(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(([, v]) => String(v.iso || '').toUpperCase() === cc); return c ? c[0] : cc; } catch (e) { return cc; } };
const DEFAULT_PERSONAS = ['business owner', 'finance lead', 'IT lead', 'operations lead'];
// W2-E1 (2026-10-23, MARKET_RND §3.1 gap 1): a site whose services or pages show it sells products gets a "shopping" stage in its panel (the
// questions a shopper types, where AI shows product cards); every other site's panel is written exactly as before
let pagesAll = []; try { pagesAll = $('Load Pages (AI)').all().map(i => i.json).filter(r => r && r.site_id && r.url); } catch (e) {}
const out = [];
for (const p of plans) {
  const shop = AAD.sellsProducts(p, pagesAll.filter(r => r.site_id === p.site_id));
  // AI-FOCUS (2026-10-27, docs/ai-panel-focus-2026-10-27 §5 step 4): with the focus model on, every job carries the TOPICS it writes for and how many
  // each (the reconcile's quotas, handed out over the market x buyer-role cells below), the topics' phrases as sub-topics, and the place rule: only
  // places in the cell's country. The writer can no longer spread one onboarding keyword over the whole panel, or name Dubai for a Pakistan website.
  const fw = (p.focus && Array.isArray(p.focus.write)) ? p.focus.write.filter(w => w && Number(w.count) > 0).map(w => ({ ...w, left: Number(w.count) })) : [];
  const takeTopics = (n) => { const got = []; let k = n;
    for (const w of fw) { if (k <= 0) break; if (w.left <= 0) continue; const t = Math.min(w.left, k); w.left -= t; k -= t; got.push({ label: w.label, count: t, source: w.source || '', state: w.state || '', terms: (w.terms || []).slice(0, 6) }); }
    return got; };
  const placeRule = (cc) => { const nm = COUNTRY(cc) || ''; const cities = AIF.citiesOf(cc); return nm ? 'Name only places in ' + nm + (cities.length ? ' (its cities, for example ' + cities.join(', ') + ')' : '') + ', and only where a buyer would name a place; never another country or region.' : ''; };
  const markets = fw.length && Array.isArray(p.focus.write_markets) && p.focus.write_markets.length ? p.focus.write_markets.filter(m => (p.markets || []).includes(m) || m === p.own_market) : (p.markets && p.markets.length ? p.markets : [p.own_market || 'US-en']);   // AI-FOCUS: written in the website's markets only
  const personas = (p.personas && p.personas.length) ? p.personas : (Number(p.prompts_max) > 50 ? DEFAULT_PERSONAS : ['']);
  const cells = []; for (const m of markets) for (const pe of personas) cells.push({ market: m, persona: pe });
  // what each cell already has, and its fair share of the panel: the cells furthest below their share get the new questions first
  const have = (c) => p.prompts.filter(q => q.kind !== 'brand' && (q.market || p.own_market) === c.market && String(q.persona || '').toLowerCase() === c.persona.toLowerCase()).length;
  const share = Math.ceil(Math.max(1, Number(p.prompts_max) - 1) / cells.length);
  let left = Number(p.prompts_needed) || 0;
  const plan = cells.map(c => ({ ...c, have: have(c), want: 0 })).sort((a, b) => a.have - b.have);
  while (left > 0) { let moved = false; for (const c of plan) { if (left <= 0) break; if (c.have + c.want < share || plan.every(x => x.have + x.want >= share)) { c.want++; left--; moved = true; } } if (!moved) break; }
  const clusters = [...new Set([...(p.topics || []), ...p.prompts.map(q => String(q.cluster || '').toLowerCase()).filter(x => x && x !== 'brand')])].slice(0, 16);
  const competitor_offers = offersOf(p.site_id);
  let first = true;
  for (const c of plan.filter(x => x.want > 0)) {
    const [cc, lang] = String(c.market || '').split('-');
    for (let n = c.want; n > 0 && out.length < AIP.LIMITS.writer_jobs_per_run; n -= AIP.LIMITS.writer_batch) {
      const count = Math.min(AIP.LIMITS.writer_batch, n);
      const brandHere = first && !p.prompts.some(x => x.kind === 'brand');
      const ft = fw.length ? takeTopics(count - (brandHere ? 1 : 0)) : [];   // AI-FOCUS: the topics this job writes for (the brand question counts in the first job)
      if (fw.length && !ft.length && !brandHere) continue;
      out.push({ json: { site_id: p.site_id, domain: p.domain, business_name: p.business_name || p.domain, business_type: p.business_type || '', country: COUNTRY(cc) || p.country || '', city: (c.market === p.own_market ? p.city : '') || '',
        market: c.market, language: LANG[lang] || lang || 'English', persona: c.persona, clusters: ft.length ? ft.map(x => x.label) : clusters,
        topics: ft.length ? [...new Set(ft.flatMap(x => [x.label, ...x.terms]))].slice(0, 8) : p.topics,
        ...(fw.length ? { focus_topics: ft, focus_topic: ft.length === 1 ? ft[0].label : '', place_rule: placeRule(cc), propose: !!(p.focus && p.focus.propose_only) } : {}),
        count: fw.length ? ft.reduce((t, x) => t + x.count, 0) + (brandHere ? 1 : 0) : count, existing: p.prompts.filter(q => (q.market || p.own_market) === c.market).map(x => x.prompt).slice(0, 80), has_brand_prompt: !first || p.prompts.some(x => x.kind === 'brand'), site_text: first ? textOf(p.site_id) : textOf(p.site_id).slice(0, 1500),
        market_questions: discovered(p.site_id).map(x => x.question + ' (' + x.volume + '/mo' + (x.brands.length ? '; AI names ' + x.brands.join(', ') : '') + ')'),
        search_questions: (p.gsc_questions || []).map(x => x.query + ' (' + x.impressions + ' impressions)'),
        paa_questions: paaOf(p.site_id, c.market), competitor_offers, ...(shop.sells ? { shopping: true, shopping_why: shop.why } : {}) } });   // W2-E1
      first = false;
    }
  }
}
return out.length ? out : [{ json: { skip: true } }];
