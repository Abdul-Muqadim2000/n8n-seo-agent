// The seo_ai_visibility rows (one per site per run; exact columns).
// W2-E3 (2026-10-23, docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2): plus the free columns of this wave, written with the row so a part
// that dies in the paid options never leaves them out: the owner's uploaded AI reports for the period (imports_json), the n8n execution ids
// of the run's parts (exec_ids), the run's notes (notes_json: lost / unanalysed answers, questions asked outside their market) and demand as a
// range from the proxies already held (demand_json; the monthly market trend is carried from the last row that read it, with its date, and
// AI Extras replaces it when this run reads it). The fan-out gap and the persona effect are added by AI Extras.
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
   *  of this site's weekly run is asked again until a human clears the row or the run is older than resume_days), 'closed' (finished, or
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
   *  pulse_engines, persona_context + personas (the number of buyer roles), fanout_check, demand_market }. Every figure is in US dollars;
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
    const qDay = on ? Math.min(asked, Math.ceil(asked * pw.per_week / FIXED.pulse_days)) : 0;
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
    TIME, secPerRequest, chunkPlan, servicesOfRow, fitInput,
    PRICE, PRICE_BASIS, ENGINES, DEFAULT_ENGINES, MONTHLY_ENGINES, PULSE_ENGINES, FIXED, analystCap, cost, sentimentOf,
    XPRICE, PERSONA, FANOUT_MAX, DEMAND_TASKS, PULSE_ALLOWED, pulseEnginesOf, monthlyOf, optionsOf, extraSeconds };
})();
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
  /** 95% Wilson interval of k / n (0-1) */
  const wilson = (k, n) => { if (!n) return [0, 1]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]; };
  /** 95% interval of the difference k1/n1 - k2/n2 in points (Newcombe's hybrid score method: the two Wilson intervals combined) */
  const diffCi = (k1, n1, k2, n2) => { if (!n1 || !n2) return [null, null]; const p1 = k1 / n1, p2 = k2 / n2, [l1, u1] = wilson(k1, n1), [l2, u2] = wilson(k2, n2), d = p1 - p2;
    return [r1(100 * (d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2))), r1(100 * (d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)))]; };
  // a role's effect is real when the 95% interval of the difference excludes 0 (the z of the two-proportion test is reported beside it)
  const verdictOf = (w, c) => { const [lo, hi] = diffCi(w.k, w.n, c.k, c.n); if (w.n < MIN || c.n < MIN) return { verdict: 'too few answers', z: null, delta: w.n && c.n ? r1(100 * (w.k / w.n - c.k / c.n)) : null, lo, hi, significant: false };
    const z = twoProp(w.k, w.n, c.k, c.n); const delta = r1(100 * (w.k / w.n - c.k / c.n)); const significant = lo > 0 || hi < 0;
    return { z, delta, lo, hi, significant, verdict: significant ? (delta > 0 ? 'named more often with this role' : 'named less often with this role') : 'no measurable difference' }; };
  // R-E3 (2026-10-23, docs/ai-visibility-2026-10-23/REVIEW_ENGINE.md): the two arms are the SAME questions, with and without the role, and the
  // 28-day pool is the same questions again each week: answers are paired by question and clustered by question, never independent samples.
  // The old test (Newcombe over two independent proportions, weeks pooled as more answers) called 3 questions out of 12 "real" after four
  // weeks of the same 3 questions (z 2.46) where a paired test on those questions gives p 0.25. Now: per question, d = named with the role -
  // named without it (this run: 1, 0 or -1; pooled: the mean over the runs that asked that question on both arms); the verdict is an exact
  // sign test on the questions whose d is not 0 (McNemar's exact test for one run), the 95% range a bootstrap of the mean d over QUESTIONS.
  const MINQ = 6;   // paired questions under which a role's effect is "too few questions" (5 discordant questions all one way is p 0.06)
  /** exact two-sided sign test: b questions up, c down -> p */
  const signP = (b, c) => { const n = b + c; if (!n) return 1; const k = Math.min(b, c); let comb = 1, s = 0; for (let i = 0; i <= k; i++) { if (i > 0) comb = comb * (n - i + 1) / i; s += comb; } return Math.min(1, 2 * s / Math.pow(2, n)); };
  const rngOf = (seed) => { let a = AIP.hash(S(seed)) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /** 95% percentile bootstrap of the mean of per-question differences (points), resampling QUESTIONS; seeded, so a run is reproducible */
  const bootMean = (ds, seed, B) => { const n = ds.length; if (n < 2) return [null, null]; const R = rngOf(seed); const NB = B || 2000; const vals = new Array(NB);
    for (let b = 0; b < NB; b++) { let s = 0; for (let i = 0; i < n; i++) s += ds[Math.floor(R() * n)]; vals[b] = s / n; }
    vals.sort((a, b) => a - b); return [r1(100 * vals[Math.floor(0.025 * NB)]), r1(100 * vals[Math.min(NB - 1, Math.ceil(0.975 * NB) - 1)])]; };
  /** the paired verdict over per-question differences (each in [-1, 1]) */
  const pairedOf = (ds, seed) => { const n = ds.length; const up = ds.filter(d => d > 0).length, down = ds.filter(d => d < 0).length; const delta = n ? r1(100 * ds.reduce((t, d) => t + d, 0) / n) : null;
    if (n < MINQ) return { questions: n, up, down, p: null, delta, lo: null, hi: null, significant: false, z: null, verdict: 'too few questions' };
    const p = signP(up, down); const [lo, hi] = bootMean(ds, seed); const significant = p < 0.05 && lo != null && (lo > 0 || hi < 0);
    return { questions: n, up, down, p: Math.round(10000 * p) / 10000, delta, lo, hi, significant, z: null, verdict: significant ? (delta > 0 ? 'named more often with this role' : 'named less often with this role') : 'no measurable difference' }; };
  /** -> the persona block. `pairs` = [{ q: request item, r: response }]; `read` = (text, cites) -> { named, cited } (AIE over the site's names) */
  const personaEffect = (o) => { const x = o || {}; const pairs = x.pairs || []; if (!pairs.length) return null;
    const cnt = () => ({ n: 0, k: 0, c: 0, failed: 0 }); const control = cnt(); const by = new Map();
    const byQ = {};   // { prompt_id: { c: 0 | 1 (control named), r: { role: 0 | 1 } } } - kept in notes_json.persona so later weeks pair by question
    for (const { q, r } of pairs) { const a = llmText(r); const box = q.arm === 'without' ? control : (by.get(q.role) || by.set(q.role, cnt()).get(q.role));
      if (!a.answered) { box.failed++; continue; } const v = x.read(a.text, a.cites); box.n++; if (v.named) box.k++; if (v.cited) box.c++;
      const e = byQ[S(q.prompt_id)] || (byQ[S(q.prompt_id)] = { c: null, r: {} }); if (q.arm === 'without') e.c = v.named ? 1 : 0; else e.r[S(q.role)] = v.named ? 1 : 0; }
    // the stored runs of the last 28 days that kept their per-question answers (notes_json.persona.by_q); a run stored without them cannot be paired
    const prevAll = (x.previous || []).filter(p => p && p.persona && daysBetween(p.checked_at, x.now) <= 28 && daysBetween(p.checked_at, x.now) > 0);
    const prev = prevAll.filter(p => p.persona.by_q && typeof p.persona.by_q === 'object'); const unpaired = prevAll.length - prev.length;
    const seed0 = S(x.seed || x.now);
    const roles = [...by.entries()].map(([role, w]) => {
      const dNow = Object.values(byQ).filter(e => e.c != null && e.r[role] != null).map(e => e.r[role] - e.c);
      const v = pairedOf(dNow, seed0 + '|' + role);
      // pooled: per question, the mean difference over every run (this one included) that asked it on both arms
      const acc = new Map(); const add = (bq) => { for (const [pid, e] of Object.entries(bq || {})) { if (!e || e.c == null || e.r == null || e.r[role] == null) continue; const a = acc.get(pid) || { s: 0, m: 0 }; a.s += n0(e.r[role]) - n0(e.c); a.m++; acc.set(pid, a); } };
      add(byQ); const pairsIn = () => [...acc.values()].reduce((t, a) => t + a.m, 0); let runs = 1; for (const p of prev) { const before = pairsIn(); add(p.persona.by_q); if (pairsIn() > before) runs++; }
      const dPool = [...acc.values()].map(a => a.s / a.m); const pv = pairedOf(dPool, seed0 + '|' + role + '|pooled');
      const pool = prev.reduce((t, p) => { const pr = (p.persona.roles || []).find(rr => S(rr.role) === S(role)); const pc = p.persona.control || {};
        if (!pr) return t; return { n: t.n + n0(pr.n), k: t.k + n0(pr.k), cn: t.cn + n0(pc.n), ck: t.ck + n0(pc.k) }; }, { n: w.n, k: w.k, cn: control.n, ck: control.k });
      return { role, n: w.n, k: w.k, c: w.c, failed: w.failed, rate: pct(w.k, w.n), control_rate: pct(control.k, control.n), delta: v.delta, lo: v.lo, hi: v.hi, significant: v.significant, z: null, p: v.p, questions: v.questions, up: v.up, down: v.down, verdict: v.verdict,
        pooled: { runs, n: pool.n, k: pool.k, control_n: pool.cn, control_k: pool.ck, rate: pct(pool.k, pool.n), control_rate: pct(pool.ck, pool.cn), questions: pv.questions, up: pv.up, down: pv.down, p: pv.p, delta: pv.delta, lo: pv.lo, hi: pv.hi, significant: pv.significant, z: null, verdict: pv.verdict } }; });
    return { label: 'API answers', engine: 'chatgpt_api', model: PERSONA_MODEL, questions: [...new Set(pairs.map(p => p.q.prompt_id))].length, control: { n: control.n, k: control.k, c: control.c, failed: control.failed, rate: pct(control.k, control.n) }, roles, by_q: byQ,
      unpaired_runs: unpaired,
      method: 'the same questions asked of the ChatGPT API (web search on) with the buyer role sent as the asker\'s context, and once without it. Each question is compared with itself: the answers are paired by question, and the weeks of the last 28 days are pooled per question (the same questions again are not more evidence). The change in the "named" rate is the mean per-question difference with a 95% range from resampling the questions; it is real when an exact sign test on the questions that moved gives p under 0.05 and the range excludes 0. Under ' + MINQ + ' paired questions: "too few questions"'
        + (unpaired ? '; ' + unpaired + ' earlier run(s) stored without per-question answers are not pooled' : '') + '. API answers are not what the chatgpt.com interface shows and are kept out of every headline figure',
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
  /** R-E1 (2026-10-23, REVIEW_ENGINE.md): one key per paid option request of a run, recorded in the run's state row BEFORE it is paid
   *  (`extras: { run_id, keys }`), so an attempt of the same run that starts the options again never buys one twice (F2's asked_keys rule) */
  const extraKey = (r) => { const x = r || {}; return x.kind === 'fanout' ? 'f|' + S(x.key) : x.kind === 'persona' ? 'p|' + (S(x.role) || '-') + '|' + S(x.prompt_id) : x.kind === 'demand' ? 'd|' + S(x.what) : 'x|' + S(x.kind) + '|' + S(x.key); };
  /** the option keys this run already recorded: the state row's `extras` when it belongs to the run */
  const extrasRecorded = (st, run_id) => new Set(st && st.extras && S(st.extras.run_id) === S(run_id) && Array.isArray(st.extras.keys) ? st.extras.keys.map(S) : []);
  const execIds = (plan, execId) => [...new Set([...(((plan.chunk || {}).executions) || []), S(execId)].map(S).filter(Boolean))].join(',');
  const notes = (plan, extra) => { const c = plan.chunk || {}; const e = extra || {};
    return { lost_note: S(c.lost_note), unanalysed_note: S(c.unanalysed_note), market_fallback_n: (plan.prompts || []).filter(q => q && q.market_fallback).length,
      ...(e.persona ? { persona: e.persona } : {}), ...(e.fanout_note ? { fanout_note: e.fanout_note } : {}), ...(e.ceiling_note ? { ceiling_note: e.ceiling_note } : {}) }; };
  /** each question's asked state (seo_ai_prompts: last_asked_run, last_asked_at, asked_n_28d, refused_at_run); only rows that change */
  const promptState = (o) => { const x = o || {}, plan = x.plan || {}; const now = x.now || new Date().toISOString(); const runAt = S(plan.checked_at || now);
    const asked = new Set((x.run_rows || []).filter(r => r && S(r.site_id) === S(plan.site_id) && S(r.run_id) === S(plan.run_id) && r.prompt_id).map(r => S(r.prompt_id)));
    // R-E12 (2026-10-23, REVIEW_ENGINE.md): the questions the Prompt Writer stored in THIS run (`written`, the Prompt Rows of this execution) get their
    // state too - an asked one its run, a refused one the run whose gate refused it - instead of waiting a week for Load AI Prompts to carry them
    const written = (x.written || []).filter(r => r && S(r.site_id) === S(plan.site_id) && r.prompt_id);
    const refused = new Set([...(plan.set_aside || []).filter(s => s && s.dropped && s.prompt_id).map(s => S(s.prompt_id)), ...written.filter(r => S(r.status) === 'refused').map(r => S(r.prompt_id))]);
    const storedAll = (x.stored || []).slice(); for (const w of written) if (!storedAll.some(r => r && S(r.site_id) === S(w.site_id) && S(r.prompt_id) === S(w.prompt_id))) storedAll.push({ site_id: w.site_id, prompt_id: w.prompt_id });
    const weekly = (x.vis_rows || []).filter(v => v && S(v.site_id) === S(plan.site_id) && S(v.run_id) !== S(plan.run_id) && daysBetween(v.checked_at, now) <= 28).map(v => new Set(((parse(v.panel_json, {}) || {}).ids || []).map(S)));
    const pulse = (x.daily_rows || []).filter(d => d && S(d.site_id) === S(plan.site_id) && daysBetween(d.checked_at || d.date, now) <= 28).map(d => new Set(Object.keys(parse(d.prompts_json, {}) || {})));
    const out = [];
    for (const r of storedAll) { if (!r || S(r.site_id) !== S(plan.site_id) || !r.prompt_id) continue; const id = S(r.prompt_id);
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
        + table(['Buyer role', 'Named with the role', 'Change (95% range)', 'This run', 'Last 28 days'], P.roles.map(r => [esc(r.role), (r.rate == null ? '-' : r.rate + '%') + ' of ' + n(r.n), r.delta == null ? '-' : (r.delta > 0 ? '+' : '') + r.delta + ' pts' + (r.lo != null ? ' (' + r.lo + ' to ' + r.hi + ')' : ''), esc(r.verdict),
          esc(r.pooled.verdict) + ' (' + n(r.pooled.questions == null ? 0 : r.pooled.questions) + ' questions paired over ' + r.pooled.runs + ' run' + (r.pooled.runs === 1 ? '' : 's') + (r.pooled.p != null ? ', sign test p ' + r.pooled.p : '') + ')'])); }
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
    const N = x.notes || {}; const nl = [N.lost_note, N.unanalysed_note, N.market_fallback_n ? N.market_fallback_n + ' question(s) were asked in your own market because their market is past the limit of ' + AIP.MARKETS_MAX + ' markets a panel covers' : '', N.ceiling_note, N.fanout_note, N.resend_note, N.extras_note].filter(Boolean);
    if (nl.length) h += p_(nl.map(esc).join(' '), true);
    return h; };
  /** -> persona_effect_json (WAVE2 contract addition from W2-A): one entry per role, the 28-day pooled figures (this run included; a first run
   *  is this run alone): [{ role, with: { rate, n }, without: { rate, n }, delta, lo, hi, significant }], rates and the interval in points 0-100 */
  const personaEffectRows = (P) => (P && (P.roles || []).length ? P.roles.map(r => ({ role: r.role, with: { rate: r.pooled.rate, n: r.pooled.n }, without: { rate: r.pooled.control_rate, n: r.pooled.control_n },
    delta: r.pooled.delta, lo: r.pooled.lo, hi: r.pooled.hi, significant: !!r.pooled.significant })) : null);
  const callbackFields = (x) => (x ? { fanout_gap: x.fanout_gap || null, persona_effect: x.persona || null, demand: x.demand || null, imports: x.imports || null, exec_ids: x.exec_ids || '', run_notes: x.notes || null } : {});

  return { optionsOf, fanoutOf, normQuery, citedRow, fanoutTop, serpBody, fanoutRequests, targetPage, gscOf, fanoutGap, personaMessage, personaQuestions, personaRequests, llmText, twoProp, verdictOf, signP, pairedOf, bootMean, MINQ, personaEffect,
    platformOf, demandRequests, marketOf, mentionItems, demand, imports, extraKey, extrasRecorded, execIds, notes, promptState, reportHtml, callbackFields, personaEffectRows, diffCi, wilson, PERSONA_MODEL, US_NOTE, MIN };
})();
const __rows2 = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const __plans = __rows2('AI Plan').filter(p => !p.nothing_to_do);
const __imports = __rows2('Load AI Imports'), __queries = __rows2('Load Query History'), __stored = __rows2('Load AI Prompts'), __fresh = __rows2('Prompt Rows').filter(r => !r.skip && r.prompt_id), __vis = __rows2('Load AI Visibility');
// the AI-answer database's question items this execution read (discovery on the run's first part, "questions citing you" on its last)
const __pairs = (reqN, resN) => { let q = [], r = []; try { q = $(reqN).all().map(i => i.json || {}); r = $(resN).all().map(i => i.json || {}); } catch (e) { return []; } return q.map((x, i) => ({ q: x, r: r[i] })); };
const __disc = __pairs('Discovery Requests', 'Run Discovery Answers').filter(x => x.q.kind === 'discover');
const __idx = (() => { const ps = __pairs('AI Requests', 'Run AI Requests'); let mg = []; try { mg = $('Merge AI Answers').all().map(i => i.json || {}); } catch (e) {} if (mg.length === ps.length) ps.forEach((x, i) => { x.r = mg[i]; }); return ps.filter(x => x.q.engine === 'index_you'); })();
return $('AI Metrics').all().map(i => { const v = i.json.vis_row; const p = __plans.find(x => x.site_id === v.site_id) || null; if (!p) return { json: v };
  const now = String(v.checked_at || new Date().toISOString());
  const carried = (() => { for (const r of __vis.filter(x => x.site_id === v.site_id && x.run_id !== v.run_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))) {
    try { const d = JSON.parse(r.demand_json || 'null'); if (d && d.market) return d.market; } catch (e) {} } return null; })();
  const imports = AIX.imports(__imports, p, new Date().toISOString());
  const demand = AIX.demand({ plan: p, stored: __stored, fresh: __fresh, queries: __queries, imports: __imports, mentions: AIX.mentionItems([...__disc.filter(x => x.q.site_id === v.site_id), ...__idx.filter(x => x.q.site_id === v.site_id)], now), market: carried, market_carried: !!carried, now });
  return { json: { ...v, imports_json: imports ? JSON.stringify(imports) : '', exec_ids: AIX.execIds(p, $execution.id), notes_json: JSON.stringify(AIX.notes(p)),
    demand_json: (demand.questions.length || demand.market) ? JSON.stringify(demand) : '' } }; });
