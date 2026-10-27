// Site admin: delete | pause | resume | cadence (pages_per_week 0-3) | unpublish (keyword) | monitors (AI visibility / backlinks / monthly audit settings)
// | facts (business_facts, the client's own facts about the business, stored on seo_sites; P1 2026-10-20)
// | market (country: name or ISO-2 of the main workflow's COUNTRIES; MKT 2026-10-27, AUDIT M2): the market every weekly job measures the website
//   in (seo_sites country / location_code / language_code). Rank history and past rows stay as they are: the next checks start a new baseline.
// | prospect (prospect_domain + status contacted / replied / won / rejected / ignored / new, note, contact_email; replied: v4.13) | ai_prompts (add custom questions, switch some off) — by site_id or domain.
// The table-ensure nodes before this one output table objects, so the request is read from the trigger (live finding 2026-10-02).
// ---- W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): measurement a statistician would sign (inlined by build_monitors.py) ----
// The answers to ONE question are correlated: the same question asked of five engines on seven mornings tends to name the same businesses,
// so 35 such answers are not 35 independent trials. Every interval below treats the QUESTION as the sampling unit (the cluster):
//   prop()   a rate: Wilson's interval on the effective sample size n / deff, the design effect deff = (cluster-robust variance over questions)
//            / (binomial variance), floored at 1, with Korn & Graubard's degrees-of-freedom correction (n* = n_eff x (z / t_{questions-1})^2)
//            so a panel of 8 questions is not read as if its between-question variance were known. A rate of 0% or 100% has no variance to
//            measure: its design effect is BORROWED from the other rates of the same answers (the competitors' named rates; `basis`
//            says so), and with nothing to borrow from it assumes the answers to one question all agree (rho = 1, the widest honest range).
//   ratio()  a share or a mean (share of voice, mean normalised position, net sentiment): the linearised ratio estimator over QUESTION
//            totals, its standard error times t_{questions-1}.
//   boot()   a seeded (deterministic) bootstrap over questions, optionally two-level (questions, then the answers within each question)
//            - used where a closed form does not exist (difference in differences, harness/simulation comparisons).
// The choice of prop() for the headline was made by the harness simulation (W2E2-SIM: coverage of the 95% interval on clustered data with a
// known rate) and its speed at 500 questions x 9 engines (W2E2-SPEED); both are printed by the harness and written in W2-E2.md.
const AVX = (() => {
  const Z = 1.959963985;
  const r1 = (x) => Math.round(10 * x) / 10;
  const r3 = (x) => Math.round(1000 * x) / 1000;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const has = (v) => v !== undefined && v !== null && v !== '';
  const parse = (v, d) => { if (v && typeof v === 'object') return v; if (!has(v)) return d; try { const x = JSON.parse(String(v)); return x == null ? d : x; } catch (e) { return d; } };
  /** FNV-1a: a seed from a string (the site and run), so the same run always gives the same bootstrap */
  const hash = (s) => { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  /** mulberry32: a small, fast, seeded uniform generator in [0, 1) */
  const rng = (seed) => { let a = (typeof seed === 'number' ? seed : hash(seed)) >>> 0; if (!a) a = 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // Student's t, 97.5% quantile: exact table to 30 degrees of freedom, the Cornish-Fisher expansion above (error < 0.001)
  const TT = [null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  const t975 = (df) => { const v = Math.floor(Number(df)); if (!(v >= 1)) return null; if (v <= 30) return TT[v]; const z = Z, z3 = z * z * z, z5 = z3 * z * z, z7 = z5 * z * z, z9 = z7 * z * z;
    return z + (z3 + z) / (4 * v) + (5 * z5 + 16 * z3 + 3 * z) / (96 * v * v) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * v * v * v) + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * v * v * v * v); };
  /** Wilson's interval for a proportion p on a (possibly non-integer, effective) sample size n, in percent */
  const wilsonN = (p, n, z) => { const zz = z || Z; if (!(n > 0)) return [null, null]; const d = 1 + zz * zz / n, c = p + zz * zz / (2 * n), m = zz * Math.sqrt(Math.max(0, p * (1 - p)) / n + zz * zz / (4 * n * n));
    return [Math.max(0, r1(100 * (c - m) / d)), Math.min(100, r1(100 * (c + m) / d))]; };
  const NONE = (why) => ({ rate: null, lo: null, hi: null, k: 0, n_answers: 0, n_questions: 0, deff: null, rho: null, df: null, n_eff: null, basis: 'not_available', why: why || 'no answer' });
  /** a rate over answers clustered by question. pick(u) -> true / false / null (null: not counted). o.q: the cluster key (default prompt_id);
   *  o.rho: a borrowed intra-question correlation for a rate with no variance of its own. */
  const prop = (units, pick, o) => { const opt = o || {}; const qOf = opt.q || ((u) => u.prompt_id);
    const G = new Map(); let K = 0, M = 0;
    for (const u of (units || [])) { const y = pick(u); if (y == null) continue; const key = String(qOf(u)); const g = G.get(key) || [0, 0]; if (y) { g[0]++; K++; } g[1]++; M++; G.set(key, g); }
    if (!M) return NONE('no answer');
    const C = G.size, p = K / M; let S2 = 0, Mw = 0; for (const [k, m] of G.values()) { S2 += (k - p * m) * (k - p * m); Mw += m * m; }
    const mbar = Mw / M;                                   // the answers-weighted mean answers per question (the design effect's m)
    const vSrs = p * (1 - p) / M, vClu = C > 1 ? (C / (C - 1)) * S2 / (M * M) : null;
    const deffRaw = vClu != null && vSrs > 0 ? vClu / vSrs : null;
    let deff, rho = null, basis = 'measured';
    if (deffRaw != null) { deff = Math.max(1, deffRaw); rho = mbar > 1 ? clamp((deffRaw - 1) / (mbar - 1), 0, 1) : 0; }
    else { const rb = opt.rho != null && isFinite(opt.rho) ? clamp(Number(opt.rho), 0, 1) : 1; deff = 1 + Math.max(0, mbar - 1) * rb; rho = rb; basis = opt.rho != null ? 'borrowed' : 'assumed'; }
    const df = Math.max(1, C - 1), t = t975(df), nEff = M / deff, nStar = Math.min(M, nEff * (Z / t) * (Z / t));
    const ci = wilsonN(p, nStar);
    return { rate: r1(100 * p), lo: ci[0], hi: ci[1], k: K, n_answers: M, n_questions: C, deff: r3(deff), rho: rho == null ? null : r3(rho), df, n_eff: r1(nStar), basis,
      why: basis === 'measured' ? '' : basis === 'borrowed' ? 'no variation of its own (' + K + ' of ' + M + '): its design effect is borrowed from the other rates of the same answers'
        : 'no variation of its own (' + K + ' of ' + M + ') and nothing to borrow from: the range assumes the answers to one question all agree' }; };
  /** a share or a mean over answers clustered by question: yx(u) -> [y, x] or null. Ratio estimator R = sum y / sum x over question totals.
   *  o.scale: 100 for a share in percent; o.lo0 / o.hi0: the bounds the ratio cannot cross. */
  const ratio = (units, yx, o) => { const opt = o || {}; const qOf = opt.q || ((u) => u.prompt_id); const sc = opt.scale == null ? 1 : opt.scale;
    const G = new Map(); let Y = 0, X = 0, n = 0;
    for (const u of (units || [])) { const v = yx(u); if (!v || !(v[1] > 0)) continue; const key = String(qOf(u)); const g = G.get(key) || [0, 0]; g[0] += v[0]; g[1] += v[1]; G.set(key, g); Y += v[0]; X += v[1]; n++; }
    if (!X) return { value: null, lo: null, hi: null, n: 0, n_questions: 0, df: null, se: null, basis: 'not_available' };
    const C = G.size, R = Y / X; let S2 = 0; for (const [y, x] of G.values()) S2 += (y - R * x) * (y - R * x);
    const df = Math.max(1, C - 1), t = t975(df);
    const se = C > 1 ? Math.sqrt((C / (C - 1)) * S2) / X : null;
    const lo0 = opt.lo0 == null ? -Infinity : opt.lo0, hi0 = opt.hi0 == null ? Infinity : opt.hi0;
    if (se == null || se === 0) return { value: Math.round(1000 * sc * R) / 1000, lo: null, hi: null, n, n_questions: C, df, se: se == null ? null : 0, basis: 'not_available',
      why: C < 2 ? 'one question only: there is no between-question variation to measure a range from' : 'every question gives the same figure, so no range can be measured' };
    return { value: Math.round(1000 * sc * R) / 1000, lo: Math.round(1000 * sc * Math.max(lo0, R - t * se)) / 1000, hi: Math.round(1000 * sc * Math.min(hi0, R + t * se)) / 1000, n, n_questions: C, df, se: Math.round(1e5 * sc * se) / 1e5, basis: 'measured' }; };
  /** a seeded bootstrap. groups: [[unit, ...], ...] (one array per question). stat(sample) -> number | null over a list of groups.
   *  o.B (default 1000), o.seed, o.two (also resample the answers within each question). Percentile interval. */
  const boot = (groups, stat, o) => { const opt = o || {}; const B = opt.B || 1000; const R = rng(opt.seed == null ? 1 : opt.seed); const G = (groups || []).filter(g => g && g.length); const C = G.length;
    if (!C) return { lo: null, hi: null, B: 0, ok: 0 };
    const vals = []; for (let b = 0; b < B; b++) { const s = new Array(C);
      for (let i = 0; i < C; i++) { const g = G[Math.floor(R() * C)]; if (opt.two) { const m = g.length, h = new Array(m); for (let j = 0; j < m; j++) h[j] = g[Math.floor(R() * m)]; s[i] = h; } else s[i] = g; }
      const v = stat(s); if (v != null && isFinite(v)) vals.push(v); }
    vals.sort((a, b) => a - b); const q = (f) => vals.length ? vals[Math.min(vals.length - 1, Math.max(0, Math.floor(f * vals.length)))] : null;
    return { lo: q(0.025), hi: q(0.975), B, ok: vals.length }; };
  /** a binomial draw (two-level bootstrap within a question without building arrays) */
  const binom = (R, m, p) => { let k = 0; for (let j = 0; j < m; j++) if (R() < p) k++; return k; };

  // ---- 1. ci_json: the headline intervals, clustered by question ------------------------------------------------------------------------
  /** U: the headline's answers ({ prompt_id, engine, named, cited, position, rivals }). rivalIds: the competitors whose named rates lend
   *  their design effect to a rate with no variance. Returns ci_json and the time it took. */
  const ci = (U, o) => { const opt = o || {}; const t0 = Date.now(); const units = (U || []).filter(u => u && u.answered !== false);
    // rho to lend: the median measured rho of the competitors' named rates (the same answers, the same clustering)
    const rhos = []; for (const id of (opt.rivalIds || []).slice(0, 12)) { const r0 = prop(units, (u) => !!(u.rivals || []).find(x => x.id === id), {}); if (r0.basis === 'measured' && r0.rho != null) rhos.push(r0.rho); }
    const cit = prop(units, (u) => !!u.cited); if (cit.basis === 'measured' && cit.rho != null) rhos.push(cit.rho);
    const nm0 = prop(units, (u) => !!u.named); if (nm0.basis === 'measured' && nm0.rho != null) rhos.push(nm0.rho);
    rhos.sort((a, b) => a - b); const lend = rhos.length ? rhos[Math.floor(rhos.length / 2)] : null;
    const P = (pick) => { const r0 = prop(units, pick, {}); return r0.basis === 'measured' ? r0 : prop(units, pick, { rho: lend }); };
    const out = { named_rate: P((u) => !!u.named), cited_rate: P((u) => !!u.cited) };
    out.first_rate = P((u) => !!u.named && u.position === 1);
    const sv = ratio(units.filter(u => u.rivals), (u) => [u.named ? 1 : 0, (u.named ? 1 : 0) + u.rivals.length], { scale: 100, lo0: 0, hi0: 1 });
    out.share_of_voice = { rate: sv.value == null ? null : r1(sv.value), lo: sv.lo == null ? null : r1(sv.lo), hi: sv.hi == null ? null : r1(sv.hi), n_answers: sv.n, n_questions: sv.n_questions, df: sv.df, basis: sv.basis, why: sv.why || '' };
    const pw = (pos) => pos === 1 ? 1 : pos === 2 ? 0.8 : pos === 3 ? 0.65 : pos > 3 && pos <= 5 ? 0.5 : pos > 5 ? 0.35 : 0.6;
    const pv = ratio(units, (u) => [u.named ? 100 * pw(u.position || 0) : 0, 1], { lo0: 0, hi0: 100 });
    out.pos_visibility = { rate: pv.value == null ? null : r1(pv.value), lo: pv.lo == null ? null : r1(pv.lo), hi: pv.hi == null ? null : r1(pv.hi), n_answers: pv.n, n_questions: pv.n_questions, df: pv.df, basis: pv.basis, why: pv.why || '' };
    const ap = ratio(units.filter(u => u.named && u.position), (u) => [u.position, 1], { lo0: 1 });
    out.avg_position = { rate: ap.value == null ? null : r1(ap.value), lo: ap.lo == null ? null : r1(ap.lo), hi: ap.hi == null ? null : r1(ap.hi), n_answers: ap.n, n_questions: ap.n_questions, df: ap.df, basis: ap.basis, why: ap.why || '' };
    // the plain Wilson the report used to print, kept beside each rate so the difference is visible (it treats every answer as independent)
    for (const k of ['named_rate', 'cited_rate', 'first_rate']) { const x = out[k]; if (x && x.n_answers) { const w = wilsonN(x.k / x.n_answers, x.n_answers); x.wilson_naive = w; } }
    const byEngine = {}; for (const e of [...new Set(units.map(u => u.engine))].sort()) { const eu = units.filter(u => u.engine === e); const r0 = prop(eu, (u) => !!u.named); const r1_ = r0.basis === 'measured' ? r0 : prop(eu, (u) => !!u.named, { rho: lend });
      const c0 = prop(eu, (u) => !!u.cited); byEngine[e] = { named_rate: { lo: r1_.lo, hi: r1_.hi, n_answers: r1_.n_answers, n_questions: r1_.n_questions, deff: r1_.deff, basis: r1_.basis }, cited_rate: { lo: c0.basis === 'measured' ? c0.lo : prop(eu, (u) => !!u.cited, { rho: lend }).lo, hi: c0.basis === 'measured' ? c0.hi : prop(eu, (u) => !!u.cited, { rho: lend }).hi, n_answers: c0.n_answers, n_questions: c0.n_questions } }; }
    const nq = new Set(units.map(u => String(u.prompt_id))).size;
    return { method: 'design-effect', level: 95, headline: out, by_engine: byEngine, rho_lent: lend, questions: nq, answers: units.length, ms: Date.now() - t0,
      note: 'Ranges treat the question as the sampling unit: answers to one question (across engines and mornings) repeat each other, so they count as fewer independent answers (the design effect). '
        + (out.named_rate.deff != null ? '"Named in" rests on ' + units.length + ' answers to ' + nq + ' questions, worth about ' + out.named_rate.n_eff + ' independent answers (design effect ' + out.named_rate.deff + ').' : '') }; };

  // ---- 2. the 28-day window: units of earlier weekly runs (units_json) and of the daily pulse (detail_json) --------------------------------
  /** the compact per-answer record a weekly row stores (units_json): questions and engines indexed once */
  const packUnits = (units, at, rule) => { const qs = [], es = [], ents = []; const ix = (arr, v) => { let i = arr.indexOf(v); if (i < 0) { arr.push(v); i = arr.length - 1; } return i; };
    const a = (units || []).map(u => [ix(qs, String(u.prompt_id)), ix(es, String(u.engine)), u.named ? 1 : 0, u.cited ? 1 : 0, u.position || null, u.rivals ? u.rivals.map(x => [ix(ents, String(x.id)), x.position || null, x.cited ? 1 : 0]) : null]);
    return { v: 1, rule_version: rule, at, q: qs, e: es, ents, a }; };
  const unpackUnits = (raw) => { const x = parse(raw, null); if (!x || !Array.isArray(x.a)) return null; const q = x.q || [], e = x.e || [], ents = x.ents || [];
    return { rule_version: String(x.rule_version || ''), at: String(x.at || ''), units: x.a.filter(Array.isArray).map(a => ({ prompt_id: String(q[a[0]]), engine: String(e[a[1]]), named: !!a[2], cited: !!a[3], position: Number(a[4]) > 0 ? Number(a[4]) : null,
      rivals: Array.isArray(a[5]) ? a[5].map(r => ({ id: String(ents[(r || [])[0]] || ''), position: Number((r || [])[1]) > 0 ? Number(r[1]) : null, cited: !!(r || [])[2] })).filter(r => r.id) : null, answered: true })) }; };
  /** a pulse morning's per-answer record (Pulse Metrics' detail_json) as units */
  const pulseUnits = (detail) => { const D = parse(detail, null); if (!D || !Array.isArray(D.a)) return []; const ents = Array.isArray(D.ents) ? D.ents : [];
    return D.a.filter(Array.isArray).map(a => ({ prompt_id: String(a[0]), engine: String(a[1]), named: !!a[2], cited: !!a[3], position: Number(a[4]) > 0 ? Number(a[4]) : null, pulse: true, answered: true,
      rivals: Array.isArray(a[5]) ? a[5].map(x => ({ id: String(ents[(x || [])[0]] || ''), position: Number((x || [])[1]) > 0 ? Number(x[1]) : null, cited: !!(x || [])[2] })).filter(x => x.id) : null })); };
  /** every dated answer of the site under the current rule in (from, to]: this run's weekly units, earlier weekly rows' units_json, the pulse
   *  mornings' detail_json. Each pulse morning counts once (by its row), the weekly answers once (by their run). */
  const history = (o) => { const opt = o || {}; const rule = opt.rule; const from = Date.parse(opt.from), to = Date.parse(opt.to); const inW = (t) => { const x = Date.parse(t); return isFinite(x) && x > from && x <= to; };
    const out = []; const runs = [], left = { weekly_rows: 0, pulse_rows: 0 }; let pulseDays = new Set();
    for (const u of (opt.now_units || [])) out.push({ ...u, at: opt.now_at });
    if (opt.now_units && opt.now_units.length) runs.push({ run_id: opt.now_run || '', at: opt.now_at });
    for (const r of (opt.vis_rows || [])) { if (!r || r.run_id === opt.now_run || !inW(r.checked_at)) continue; const x = unpackUnits(r.units_json); if (!x || x.rule_version !== rule) { left.weekly_rows++; continue; }
      runs.push({ run_id: String(r.run_id || ''), at: String(r.checked_at) }); for (const u of x.units) out.push({ ...u, at: String(r.checked_at) }); }
    const seen = new Set(); for (const d of (opt.daily_rows || [])) { if (!d || !inW(d.checked_at)) continue; const key = String(d.run_id || '') + '|' + String(d.date || '') + '|' + String(d.checked_at); if (seen.has(key)) continue; seen.add(key);
      if (String(d.rule_version || '') !== rule) { left.pulse_rows++; continue; } const us = pulseUnits(d.detail_json || d.detail); if (!us.length) { left.pulse_rows++; continue; }
      pulseDays.add(String(d.date || String(d.checked_at).slice(0, 10))); for (const u of us) out.push({ ...u, at: String(d.checked_at) }); }
    return { units: out, runs, pulse_days: pulseDays.size, left_out: left, from: new Date(from).toISOString(), to: new Date(to).toISOString(), days: Math.round(10 * (to - from) / 864e5) / 10 }; };

  // ---- 3. share of voice over a fixed, declared set + "others" (both denominators; mean normalised position) -----------------------------
  /** U: the headline's answers (rivals canonicalised). set: the declared entity ids (canonical). selfId: the business's own id. */
  const sov = (U, o) => { const opt = o || {}; const set = [...new Set((opt.set || []).filter(Boolean))]; const selfId = opt.selfId || 'you'; const units = (U || []).filter(u => u && u.answered !== false);
    const rec = units.filter(u => Array.isArray(u.rivals));          // the answers whose businesses were recorded (an older row may not say)
    const names = (u) => (u.named ? 1 : 0) + u.rivals.length;
    const branded = rec.filter(u => names(u) > 0);
    const mentionsOf = (id) => id === selfId ? (u) => (u.named ? 1 : 0) : (u) => (u.rivals.some(x => x.id === id) ? 1 : 0);
    const totalM = branded.reduce((s, u) => s + names(u), 0);
    const share = (f) => { const r = ratio(branded, (u) => [f(u), names(u)], { scale: 100, lo0: 0, hi0: 1 }); return { share: r.value == null ? null : r1(r.value), lo: r.lo == null ? null : r1(r.lo), hi: r.hi == null ? null : r1(r.hi), basis: r.basis }; };
    const by_entity = [{ id: selfId, name: opt.selfName || selfId, self: true, n: branded.reduce((s, u) => s + (u.named ? 1 : 0), 0), ...share(mentionsOf(selfId)) }];
    for (const id of set) { if (id === selfId) continue; by_entity.push({ id, name: (opt.names || {})[id] || id, n: branded.reduce((s, u) => s + mentionsOf(id)(u), 0), ...share(mentionsOf(id)) }); }
    const othersOf = (u) => u.rivals.filter(x => !set.includes(x.id)).length;
    const others = share(othersOf); const othersN = branded.reduce((s, u) => s + othersOf(u), 0);
    const otherIds = new Map(); for (const u of branded) for (const x of u.rivals) if (!set.includes(x.id)) otherIds.set(x.id, (otherIds.get(x.id) || 0) + 1);
    const nob = prop(branded, (u) => !!u.named); const nall = prop(units, (u) => !!u.named);
    const np = ratio(rec.filter(u => u.named && u.position), (u) => { const nn = names(u); const pos = Math.min(u.position, nn); return [nn > 1 ? 1 - (pos - 1) / (nn - 1) : 1, 1]; }, { lo0: 0, hi0: 1 });
    return { set, set_source: opt.setSource || 'configured', others_share: others.share, others_lo: others.lo, others_hi: others.hi, others_n: othersN, others_top: [...otherIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, n })),
      by_entity, mentions: totalM,
      denominators: { all_answers: units.length, answers_recorded: rec.length, answers_naming_any_brand: branded.length },
      named_rate_all: { rate: nall.rate, lo: nall.lo, hi: nall.hi, n: nall.n_answers },
      named_of_branded_rate: nob.rate, named_of_branded: { rate: nob.rate, lo: nob.lo, hi: nob.hi, n: nob.n_answers },
      mean_norm_position: { value: np.value == null ? null : Math.round(100 * np.value) / 100, lo: np.lo == null ? null : Math.round(100 * np.lo) / 100, hi: np.hi == null ? null : Math.round(100 * np.hi) / 100, n: np.n, n_questions: np.n_questions, basis: np.basis, why: np.why || '' },
      note: (set.length ? 'Share of voice over a fixed set you declared (' + set.length + ' competitor' + (set.length === 1 ? '' : 's') + ') plus "others" (every other business AI named), so a new rival cannot silently shrink your share.'
        : 'No competitor set is declared: every business AI named counts in "others". Declare competitors to follow them one by one.')
        + ' ' + branded.length + ' of ' + units.length + ' answers named at least one business.' }; };

  // ---- 5. did an action work: difference in differences, treated vs matched control questions ------------------------------------------
  /** hist: dated units (history()); actions: [{ action_id, kind, at, questions: [prompt ids], label }]; meta: prompt id -> { cluster, stage }.
   *  Returns impact_json. Two-level bootstrap over questions (stratified by arm), seeded by the action id. */
  const impact = (hist, actions, o) => { const opt = o || {}; const W = (opt.window_days || 28) * 864e5; const now = Date.parse(opt.now || new Date().toISOString()); const meta = opt.meta || new Map(); const MINA = opt.min_answers || 12;
    const allTreated = new Map(); for (const a of (actions || [])) for (const q of (a.questions || [])) { const s = allTreated.get(String(q)) || []; s.push(Date.parse(a.at)); allTreated.set(String(q), s); }
    const out = [];
    for (const a of (actions || []).slice(0, opt.max || 12)) { const t0 = Date.parse(a.at); if (!isFinite(t0)) continue;
      const post_to = Math.min(now, t0 + W), days_after = Math.round(10 * (post_to - t0) / 864e5) / 10;
      const pre = (u) => { const x = Date.parse(u.at); return x >= t0 - W && x < t0; }, post = (u) => { const x = Date.parse(u.at); return x > t0 && x <= post_to; };
      const byQ = new Map(); for (const u of hist) { const ph = pre(u) ? 0 : post(u) ? 1 : -1; if (ph < 0) continue; const q = String(u.prompt_id); const g = byQ.get(q) || [0, 0, 0, 0]; g[ph * 2] += u.named ? 1 : 0; g[ph * 2 + 1]++; byQ.set(q, g); }
      const T = (a.questions || []).map(String).filter(q => { const g = byQ.get(q); return g && g[1] && g[3]; });
      // controls: never treated by any action within the windows; same topic cluster first, then the same buyer stage, then any; closest
      // "before" rate; up to 3 per treated question (at least 3)
      const busy = (q) => (allTreated.get(q) || []).some(t => Math.abs(t - t0) < 2 * W);
      const pool = [...byQ.entries()].filter(([q, g]) => !busy(q) && g[1] && g[3]);
      const mt = (q) => meta.get(q) || {}; const tClusters = new Set(T.map(q => String(mt(q).cluster || ''))), tStages = new Set(T.map(q => String(mt(q).stage || '')));
      const tRate = T.reduce((s, q) => s + byQ.get(q)[0], 0) / Math.max(1, T.reduce((s, q) => s + byQ.get(q)[1], 0));
      const rank = ([q, g]) => [tClusters.has(String(mt(q).cluster || '')) ? 0 : tStages.has(String(mt(q).stage || '')) ? 1 : 2, Math.abs(g[0] / g[1] - tRate), q];
      const Cq = pool.map(e => [e[0], rank(e)]).sort((x, y) => x[1][0] - y[1][0] || x[1][1] - y[1][1] || (x[1][2] < y[1][2] ? -1 : 1)).slice(0, Math.max(3, 3 * T.length)).map(x => x[0]);
      const sumArm = (qs) => qs.reduce((s, q) => { const g = byQ.get(q); return [s[0] + g[0], s[1] + g[1], s[2] + g[2], s[3] + g[3]]; }, [0, 0, 0, 0]);
      const ta = sumArm(T), ca = sumArm(Cq);
      const rate = (k, n) => n ? r1(100 * k / n) : null;
      const row = { action_id: String(a.action_id), kind: a.kind, label: a.label || '', at: new Date(t0).toISOString(), target_questions: T, control_questions: Cq,
        before: { rate: rate(ta[0], ta[1]), n: ta[1] }, after: { rate: rate(ta[2], ta[3]), n: ta[3] }, control_before: { rate: rate(ca[0], ca[1]), n: ca[1] }, control_after: { rate: rate(ca[2], ca[3]), n: ca[3] },
        did: { effect: null, lo: null, hi: null, B: 0 }, verdict: "can't tell", why: '', window_days: opt.window_days || 28, days_after, metric: 'named_rate' };
      if (!T.length) { row.why = 'none of its questions has answers both in the 28 days before and after it'; out.push(row); continue; }
      if (!Cq.length) { row.why = 'no untreated question with answers on both sides to compare against'; out.push(row); continue; }
      if (days_after < 7) { row.why = 'too soon: ' + days_after + ' day(s) after it, a week is needed before anything can be read'; out.push(row); continue; }
      const eff = 100 * ((ta[2] / ta[3] - ta[0] / ta[1]) - (ca[2] / ca[3] - ca[0] / ca[1]));
      row.did.effect = r1(eff);
      if (Math.min(ta[1], ta[3], ca[1], ca[3]) < MINA) { row.why = 'too few answers to tell (' + ta[1] + ' / ' + ta[3] + ' treated, ' + ca[1] + ' / ' + ca[3] + ' control, before / after; ' + MINA + ' needed in each)'; out.push(row); continue; }
      // two-level bootstrap: questions with replacement within each arm, then each question's answers (binomial on its own rate) per period
      const R = rng(hash(String(opt.seed || '') + '|' + a.action_id)); const B = opt.B || 2000; const vals = [];
      const arm = (qs) => { let k0 = 0, n0 = 0, k1 = 0, n1 = 0; for (let i = 0; i < qs.length; i++) { const g = byQ.get(qs[Math.floor(R() * qs.length)]); k0 += binom(R, g[1], g[0] / g[1]); n0 += g[1]; k1 += binom(R, g[3], g[2] / g[3]); n1 += g[3]; } return k1 / n1 - k0 / n0; };
      for (let b = 0; b < B; b++) vals.push(100 * (arm(T) - arm(Cq)));
      vals.sort((x, y) => x - y); const lo = r1(vals[Math.floor(0.025 * B)]), hi = r1(vals[Math.min(B - 1, Math.floor(0.975 * B))]);
      row.did = { effect: r1(eff), lo, hi, B };
      row.verdict = lo > 0 ? 'likely helped' : hi < 0 ? 'likely hurt' : "can't tell";
      row.why = row.verdict === "can't tell" ? 'the change on its questions (' + (eff >= 0 ? '+' : '') + r1(eff) + ' points against the control questions) is inside the 95% range ' + lo + ' to ' + hi
        : 'its questions moved ' + (eff >= 0 ? '+' : '') + r1(eff) + ' points more than ' + Cq.length + ' matched control question' + (Cq.length === 1 ? '' : 's') + ' (95% range ' + lo + ' to ' + hi + '); a correlation over 28 days, not proof of cause';
      out.push(row); }
    return out; };

  // ---- 6. owner alert rules (seo_monitors.ai_alert_rules_json) --------------------------------------------------------------------------
  const METRICS = ['named_rate', 'cited_rate', 'share_of_voice', 'visibility_score', 'avg_position', 'competitor_share'];
  const SCOPES = ['engine', 'cluster', 'persona', 'market', 'competitor'];
  /** validate and normalise the owner's rules (Site Admin `monitors`); throws with the reason on the first bad rule */
  const validateRules = (raw) => { const v = Array.isArray(raw) ? raw : parse(raw, null); if (!Array.isArray(v)) throw new Error('ai_alert_rules_json must be a list of rules');
    if (v.length > 25) throw new Error('ai_alert_rules_json: at most 25 rules');
    const ids = new Set(); return v.map((r, i) => { if (!r || typeof r !== 'object') throw new Error('rule ' + (i + 1) + ' is not an object');
      const id = String(r.id || '').trim().slice(0, 60) || 'rule_' + (i + 1); if (ids.has(id)) throw new Error('rule id "' + id + '" is used twice'); ids.add(id);
      const metric = String(r.metric || '').trim(); if (!METRICS.includes(metric)) throw new Error('rule "' + id + '": metric must be one of ' + METRICS.join(', '));
      const sc = r.scope && typeof r.scope === 'object' ? r.scope : {}; const scope = {}; for (const k of Object.keys(sc)) { if (!SCOPES.includes(k)) throw new Error('rule "' + id + '": scope may only name ' + SCOPES.join(', ')); const x = String(sc[k] == null ? '' : sc[k]).trim().slice(0, 120); if (x) scope[k] = k === 'competitor' ? x.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '') : (k === 'cluster' ? x.toLowerCase() : x); }
      if (metric === 'competitor_share' && !scope.competitor) throw new Error('rule "' + id + '": competitor_share needs scope.competitor');
      if (Object.keys(scope).filter(k => k !== 'competitor').length > 1) throw new Error('rule "' + id + '": one segment at a time (engine, cluster, persona or market)');
      const direction = String(r.direction || 'any').toLowerCase(); if (!['drop', 'rise', 'any'].includes(direction)) throw new Error('rule "' + id + '": direction must be drop, rise or any');
      const th = Number(r.threshold_points); if (!(th > 0 && th <= 100)) throw new Error('rule "' + id + '": threshold_points must be a number of points above 0 (at most 100)');
      return { id, metric, scope, direction, threshold_points: r1(th), enabled: !(r.enabled === false || String(r.enabled) === 'false') }; }); };
  /** evaluate the rules on this run. ctx: { comparable, why, compare (compare_json.metrics), segRows (now: { dim, key, n, k, cited }), segPrev (Map dim|key -> { n, k, cited }),
   *  comps ([{ domain, delta: { sov, sov_p }, sov }]), engines / engPrev for an engine scope }. Holm across the rules that have a test. */
  const evalRules = (rules, ctx) => { const c = ctx || {}; const res = [];
    const mk = (r, o) => ({ rule_id: r.id, fired: false, metric: r.metric, scope: r.scope, direction: r.direction, threshold_points: r.threshold_points, delta: null, test: null, reason: '', ...(o || {}) });
    const tests = [];
    for (const r of (rules || [])) {
      if (!r.enabled) { res.push(mk(r, { reason: 'switched off' })); continue; }
      if (!c.comparable) { res.push(mk(r, { reason: 'not evaluated: this run is not comparable with the last one (' + (c.why || 'no earlier run') + ')' })); continue; }
      const segDim = ['engine', 'cluster', 'persona', 'market'].find(k => r.scope[k]);
      let d = null, z = null, why = '';
      if (r.metric === 'competitor_share') { const cp = (c.comps || []).find(x => String(x.domain).toLowerCase() === r.scope.competitor);
        if (!cp) why = r.scope.competitor + ' is not among the competitors measured this run'; else if (!cp.delta || cp.delta.sov == null) why = 'no earlier share for ' + r.scope.competitor;
        else { d = cp.delta.sov; z = cp.delta.sov_z != null ? cp.delta.sov_z : null; if (z == null) why = cp.delta.why || 'its share was not tested'; } }
      else if (segDim) { const key = String(r.scope[segDim]).toLowerCase(); const now = (c.segRows || []).find(s => s.dim === segDim && String(s.key).toLowerCase() === key); const prev = c.segPrev ? c.segPrev.get(segDim + '|' + key) : null;
        if (!['named_rate', 'cited_rate'].includes(r.metric)) why = 'only "named in" and "cited" are tested per ' + segDim + ' (the other figures carry no per-segment test)';
        else if (!now || !prev) why = 'no ' + segDim + ' "' + r.scope[segDim] + '" in both runs';
        else { const kN = r.metric === 'named_rate' ? now.k : now.cited, kB = r.metric === 'named_rate' ? prev.k : prev.cited;
          if (kN == null || kB == null || !(now.n >= 12) || !(prev.n >= 12)) why = 'too few answers in that ' + segDim + ' to test (' + (now.n || 0) + ' now, ' + (prev.n || 0) + ' before; 12 needed on each side)';
          else { const p1 = kN / now.n, p2 = kB / prev.n, pp = (kN + kB) / (now.n + prev.n), se = Math.sqrt(pp * (1 - pp) * (1 / now.n + 1 / prev.n)); d = r1(100 * (p1 - p2)); z = se ? (p1 - p2) / se / Math.sqrt(Math.max(1, Number(c.deff) || 1)) : null; if (z == null) why = 'no variation to test'; } } }
      else { const m0 = (c.compare || {})[r.metric]; if (!m0 || m0.delta == null) why = 'no comparable earlier figure'; else { d = m0.delta; if (m0.p == null) why = 'the change was not tested (too few answers)'; else z = (m0.delta >= 0 ? 1 : -1) * zOfP(m0.p); } }
      const row = mk(r, { delta: d, reason: why });
      if (z != null) tests.push({ id: r.id, z, row });
      res.push(row); }
    // Holm across the owner's tested rules: a rule set by the owner is one more family of alerts on the same sample
    const T = tests.map(t => ({ ...t, p: 2 * (1 - nCdf(Math.abs(t.z))) })).sort((a, b) => a.p - b.p); const m = T.length; let open = true;
    T.forEach((t, i) => { const thr = 0.05 / (m - i); const pass = open && t.p <= thr; if (!pass) open = false; const r = t.row; const dirOk = r.direction === 'any' || (r.direction === 'drop' ? (r.metric === 'avg_position' ? r.delta > 0 : r.delta < 0) : (r.metric === 'avg_position' ? r.delta < 0 : r.delta > 0));
      const big = Math.abs(r.delta) >= r.threshold_points;
      r.test = { z: Math.round(100 * t.z) / 100, p: Math.round(1e6 * t.p) / 1e6, threshold_p: Math.round(1e6 * thr) / 1e6, method: 'holm', tested_rules: m, passed: pass };
      r.fired = pass && dirOk && big;
      r.reason = r.fired ? 'fired: ' + (r.delta > 0 ? '+' : '') + r.delta + ' points (threshold ' + r.threshold_points + '), a real change (p ' + r.test.p + ' within the Holm-adjusted ' + r.test.threshold_p + ' across ' + m + ' tested rule' + (m === 1 ? '' : 's') + ')'
        : !pass ? 'within noise: ' + (r.delta > 0 ? '+' : '') + r.delta + ' points, p ' + r.test.p + ' above the Holm-adjusted ' + r.test.threshold_p
        : !dirOk ? 'a real change, but in the other direction (' + (r.delta > 0 ? '+' : '') + r.delta + ' points)' : 'a real change of ' + (r.delta > 0 ? '+' : '') + r.delta + ' points, under the rule\'s ' + r.threshold_points + ' points'; });
    return res; };
  const nCdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2); const q = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x >= 0 ? 1 - q : q; };
  const zOfP = (p) => { let lo = 0, hi = 12; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (2 * (1 - nCdf(mid)) > p) lo = mid; else hi = mid; } return (lo + hi) / 2; };

  // ---- 7. the repeat pilot: within- vs between-question variance per engine -> repeats per engine ---------------------------------------
  /** units: answers of the pilot ({ prompt_id (the base question), engine, named }). For each engine: a one-way ANOVA over questions.
   *  sigma2_between (the questions differ) and sigma2_within (one question asked again). Repeats per question for a target half-width h on a
   *  panel of Q questions: m = sigma2_w / (Q * (h / z)^2 - sigma2_b) (more repeats cannot help past the between-question floor). */
  const pilot = (units, o) => { const opt = o || {}; const Q = Number(opt.panel) || 50; const h = (Number(opt.half_width) || 5) / 100; const out = {};
    for (const e of [...new Set((units || []).map(u => u.engine))].sort()) { const G = new Map(); for (const u of units.filter(x => x.engine === e)) { const g = G.get(u.prompt_id) || []; g.push(u.named ? 1 : 0); G.set(u.prompt_id, g); }
      const gs = [...G.values()].filter(g => g.length >= 2); const k = gs.length; const N = gs.reduce((s, g) => s + g.length, 0);
      if (k < 3) { out[e] = { questions: k, answers: N, repeats: null, why: 'fewer than 3 questions answered twice or more' }; continue; }
      const grand = gs.reduce((s, g) => s + g.reduce((a, b) => a + b, 0), 0) / N; const n0 = (N - gs.reduce((s, g) => s + g.length * g.length, 0) / N) / (k - 1);
      const msb = gs.reduce((s, g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return s + g.length * (m - grand) * (m - grand); }, 0) / (k - 1);
      const msw = gs.reduce((s, g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return s + g.reduce((a, b) => a + (b - m) * (b - m), 0); }, 0) / Math.max(1, N - k);
      const sb = Math.max(0, (msb - msw) / n0), sw = msw; const icc = sb + sw > 0 ? sb / (sb + sw) : null;
      const room = Q * Math.pow(h / Z, 2) - sb; const m = room <= 0 ? null : sw === 0 ? 1 : Math.max(1, Math.ceil(sw / room));   // the between-question floor first: past it no number of asks helps
      out[e] = { questions: k, answers: N, rate: r1(100 * grand), sigma2_between: Math.round(1e5 * sb) / 1e5, sigma2_within: Math.round(1e5 * sw) / 1e5, icc: icc == null ? null : r3(icc), repeats: m,
        why: m == null ? 'the questions differ so much that no number of repeats reaches +/-' + r1(100 * h) + ' points on ' + Q + ' questions: ask more questions instead' : m === 1 ? 'one answer per question a week is enough for +/-' + r1(100 * h) + ' points on ' + Q + ' questions' : m + ' answers per question a week reach +/-' + r1(100 * h) + ' points on ' + Q + ' questions' }; }
    return out; };

  // ---- the run: what AI Metrics hands over once its own figures exist (one call per site; AI_Metrics.js hook marked W2-E2) ------------------
  /** c: { p, rule, U (the headline's answers), CI (ci()), segRows, segKeys(q, engine), meta (Map prompt id -> question), compare (compare_json.metrics),
   *  comparable, why, comps (the competitor table), canon(id) -> the run's key for a business, read(nodeName) -> rows } */
  const run = (c) => { const t0 = Date.now(); const p = c.p || {}; const rd = c.read || (() => []); const DAY = 864e5; const nowT = Date.parse(p.checked_at) || Date.now(); const isoT = (t) => new Date(t).toISOString();
    const mine = (r) => r && String(r.site_id || '') === String(p.site_id);
    const mon = rd('Load Monitors').find(mine) || {};
    // 3. share of voice over the declared set (ai_sov_set, else the configured competitors) + others
    const setDeclared = has(mon.ai_sov_set); const setRaw = setDeclared ? String(mon.ai_sov_set).split(/[\n,;]+/) : (p.configured_competitors || []);
    const set = [...new Set(setRaw.map(x => String(x).trim()).filter(Boolean).map(x => (c.canon ? c.canon(x) : x)).filter(Boolean))].slice(0, 20);
    const sovJ = sov(c.U, { set, selfId: p.domain, selfName: p.business_name || p.domain, setSource: setDeclared ? 'declared (ai_sov_set)' : 'your configured competitors' });
    // 2. the 28-day window for segment rates (earlier weekly rows' units_json + the pulse mornings' detail_json + this run's weekly answers)
    const visRows = rd('Load AI Visibility').filter(mine), daily = rd('Load AI Daily').filter(mine);
    const weeklyNow = (c.U || []).filter(u => !u.pulse);
    const H28 = history({ rule: c.rule, from: isoT(nowT - 28 * DAY), to: isoT(nowT + 1), now_units: weeklyNow, now_run: p.run_id, now_at: p.checked_at, vis_rows: visRows, daily_rows: daily });
    const acc = new Map(); for (const u of H28.units) { const m0 = (c.meta && c.meta.get(u.prompt_id)) || {}; for (const [d, key] of c.segKeys({ ...m0, topic: m0.topic || '' }, u.engine)) { const id = d + '|' + key; const a = acc.get(id) || []; a.push(u); acc.set(id, a); } }
    const lend = c.CI ? c.CI.rho_lent : null;
    for (const s of (c.segRows || [])) { const us = acc.get(s.dim + '|' + s.key) || []; const r0 = prop(us, (u) => !!u.named, { rho: lend });
      s.w28 = { rate: r0.rate, lo: r0.lo, hi: r0.hi, n: r0.n_answers, k: r0.k, questions: r0.n_questions, deff: r0.deff, basis: r0.basis, enough: r0.n_answers >= 12 }; }
    const window28 = { from: H28.from, to: isoT(nowT), days: 28, weekly_runs: H28.runs.length, pulse_days: H28.pulse_days, answers: H28.units.length, left_out: H28.left_out,
      note: 'Segment rates count the last 28 days (' + H28.runs.length + ' weekly run' + (H28.runs.length === 1 ? '' : 's') + ' and ' + H28.pulse_days + ' pulse morning' + (H28.pulse_days === 1 ? '' : 's') + ', ' + H28.units.length + ' answers); the headline counts this run\'s window. A segment\'s change is still tested run against run, on answers that do not overlap.'
        + (H28.left_out.weekly_rows || H28.left_out.pulse_rows ? ' ' + (H28.left_out.weekly_rows + H28.left_out.pulse_rows) + ' earlier reading(s) were left out (another measurement rule, or no per-answer record).' : '') };
    // 5. did an action work: the AI targets written / won and the pages published in the last 31 days (its 28 days before must be inside what is loaded)
    const H60 = history({ rule: c.rule, from: isoT(nowT - 60 * DAY), to: isoT(nowT + 1), now_units: weeklyNow, now_run: p.run_id, now_at: p.checked_at, vis_rows: visRows, daily_rows: daily });
    const qOfKw = (kw) => { const k = String(kw || '').toLowerCase().trim(); if (k.split(/\s+/).length < 2) return []; return [...(c.meta || new Map()).values()].filter(q => q.kind !== 'brand' && (String(q.keyword || '').toLowerCase().trim() === k || String(q.prompt || '').toLowerCase().includes(k))).map(q => String(q.prompt_id)); };
    const inRange = (at) => { const x = Date.parse(at); return isFinite(x) && x >= nowT - 31 * DAY && x <= nowT; };
    const acts = [];
    for (const t of rd('Load AI Targets (AI)').filter(mine)) { const at = t.written_at || (String(t.status) === 'won' ? t.won_at : ''); if (!['written', 'won', 'published'].includes(String(t.status || '')) || !inRange(at) || !t.prompt_id) continue;
      acts.push({ action_id: String(t.target_id || 'ait_' + t.prompt_id), kind: 'ai_target' + (t.kind ? ':' + t.kind : ''), at, questions: [String(t.prompt_id)], label: String(t.question || t.keyword || '').slice(0, 160) }); }
    for (const l of rd('Load Content Log (AI)').filter(mine)) { if (String(l.status || '') !== 'published' || !inRange(l.published_at)) continue; const qs = qOfKw(l.keyword); if (!qs.length) continue;
      acts.push({ action_id: 'page:' + String(l.published_url || l.keyword), kind: 'page', at: l.published_at, questions: qs, label: String(l.keyword || '') }); }
    const imp = impact(H60.units, acts, { now: isoT(nowT), meta: c.meta, seed: p.site_id + '|' + p.run_id });
    // 6. the owner's alert rules
    let rules = [], rulesErr = '';
    if (has(mon.ai_alert_rules_json)) { try { rules = validateRules(mon.ai_alert_rules_json); } catch (e) { rulesErr = String(e.message || e); } }
    const prevRaw = visRows.find(r => p.previous && String(r.run_id) === String(p.previous.run_id)) || null;
    const segPrev = new Map(); const ps = prevRaw ? parse(prevRaw.segments_json, null) : null;
    if (ps && Array.isArray(ps.rows)) { const cols = ps.cols || ['dim', 'key', 'questions', 'n', 'k', 'cited']; const ix = (k) => cols.indexOf(k);
      for (const r of ps.rows) { const g = (k) => Array.isArray(r) ? r[ix(k)] : r[k]; segPrev.set(String(g('dim')) + '|' + String(g('key')).toLowerCase(), { n: Number(g('n')) || 0, k: Number(g('k')) || 0, cited: ix('cited') >= 0 || !Array.isArray(r) ? Number(g('cited')) : null }); } }
    const comps = (c.comps || []).map(x => ({ domain: x.domain, sov: x.sov, delta: x.delta ? { sov: x.delta.sov, sov_z: x.delta.sov_p != null && x.delta.sov != null ? (x.delta.sov >= 0 ? 1 : -1) * zOfP(x.delta.sov_p) : null, why: x.delta.why } : null }));
    const evaluated = rulesErr ? [] : evalRules(rules, { comparable: c.comparable, why: c.why, compare: c.compare, segRows: (c.segRows || []).map(s => ({ dim: s.dim, key: String(s.key).toLowerCase(), n: s.n, k: s.k, cited: s.cited })), segPrev, comps, deff: c.CI && c.CI.headline.named_rate ? c.CI.headline.named_rate.deff : 1 });
    if (rulesErr) evaluated.push({ rule_id: '', fired: false, metric: '', scope: {}, delta: null, test: null, reason: 'the stored rules could not be read: ' + rulesErr });
    return { sov: sovJ, window28, impact: imp, actions_considered: acts.length, alert_rules: evaluated, units_json: JSON.stringify(packUnits(weeklyNow, p.checked_at, c.rule)), ms: Date.now() - t0 }; };

  return { Z, t975, wilsonN, prop, ratio, boot, binom, rng, hash, ci, packUnits, unpackUnits, pulseUnits, history, sov, impact, validateRules, evalRules, METRICS, SCOPES, pilot, zOfP, nCdf, parse, run };
})();
// ---- countries: copied from the main workflow's Normalize Input by build_site_tracker.py (MKT 2026-10-27: Site Admin `market`) ----
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
let t = {}; try { t = (($('Admin Run').first() || {}).json) || {}; } catch (e) { t = ($input.first() || {}).json || {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
const action = String(t.action || '').toLowerCase();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = normD(t.domain) || String(t.site_id || '').replace(/^site_/, '').replace(/-/g, '.');
const site_id = String(t.site_id || '').trim() || (normD(t.domain) ? 'site_' + normD(t.domain).replace(/[^a-z0-9]+/g, '-') : '');
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts', 'content_groups', 'facts', 'market'].includes(action)) throw new Error('action must be delete, pause, resume, cadence, unpublish, monitors, prospect, ai_prompts, content_groups, facts or market');
// MKT (2026-10-27): the website's market, read from the same COUNTRIES table Normalize Input uses (never a code the caller sends)
const countryRaw = String(t.country == null ? '' : t.country).trim();
const marketName = countryRaw ? (Object.keys(COUNTRIES).find(n => n.toLowerCase() === countryRaw.toLowerCase()) || Object.keys(COUNTRIES).find(n => String(COUNTRIES[n].iso).toUpperCase() === countryRaw.toUpperCase()) || '') : '';
if (action === 'market' && !marketName) throw new Error('country (one of ' + Object.keys(COUNTRIES).join(', ') + ', or its ISO-2 code) is required for action market');
const market = marketName ? { country: marketName, location_code: Number(COUNTRIES[marketName].code), language_code: String(COUNTRIES[marketName].lang || 'en'), country_iso: String(COUNTRIES[marketName].iso) } : { country: '', location_code: 0, language_code: '', country_iso: '' };
// P1 (2026-10-20): the business facts the client saved in the app, so the Content Cadence and the readiness rule (v5/code/_readiness.js) read them
if (action === 'facts' && t.business_facts == null) throw new Error('business_facts (text; an empty text clears them) is required for action facts');
const business_facts = String(t.business_facts == null ? '' : t.business_facts).trim().slice(0, 2000);
if (!site_id) throw new Error('site_id or domain is required');
const pages = Math.min(3, Math.max(0, Number(t.pages_per_week == null ? t.blogs_per_week : t.pages_per_week) || 0));
if (action === 'cadence' && t.pages_per_week == null && t.blogs_per_week == null) throw new Error('pages_per_week (0-3) is required for action cadence');
const keyword = String(t.keyword || '').trim().toLowerCase().replace(/\s+/g, ' ');
if (action === 'unpublish' && !keyword) throw new Error('keyword is required for action unpublish');
const prospect_domain = normD(t.prospect_domain);
const pstatus = String(t.status || '').toLowerCase();
if (action === 'prospect' && !prospect_domain) throw new Error('prospect_domain is required for action prospect');
if (action === 'prospect' && pstatus && !['new', 'contacted', 'replied', 'won', 'rejected', 'ignored'].includes(pstatus)) throw new Error('status must be new, contacted, replied, won, rejected or ignored');
// G6 (2026-10-18): the owner manages the whole panel — add (text, or { prompt, persona, cluster, stage, market, pinned }: up to 500 at once, a
// CSV import from the app), edit (persona / cluster / stage / market of a stored question; NEW WORDING is a new question and the old one is
// switched off, so a trend never compares two different questions), remove (switch off), enable (switch back on), pin / unpin
const S6 = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const asQ = (x) => (x && typeof x === 'object') ? { prompt: S6(x.prompt, 300), persona: S6(x.persona, 40), cluster: S6(x.cluster, 60).toLowerCase(), stage: S6(x.stage, 20).toLowerCase(), market: S6(x.market, 8), pinned: x.pinned === true || String(x.pinned) === 'true', keyword: S6(x.keyword, 120) } : { prompt: S6(x, 300), persona: '', cluster: '', stage: '', market: '', pinned: false, keyword: '' };   // F2 (E9): the owner's own search phrase, when given
const add_prompts = (Array.isArray(t.add) ? t.add : (Array.isArray(t.prompts) ? t.prompts : [])).map(asQ).filter(x => x.prompt.length >= 10).slice(0, 500);
const off_prompts = (Array.isArray(t.remove) ? t.remove : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const on_prompts = (Array.isArray(t.enable) ? t.enable : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const pin_prompts = (Array.isArray(t.pin) ? t.pin : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const unpin_prompts = (Array.isArray(t.unpin) ? t.unpin : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
// AI-FOCUS (2026-10-27): accept (a question the engine proposed starts being asked) and retire (the owner retires a question: kept with its history, never asked)
const accept_prompts = (Array.isArray(t.accept) ? t.accept : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const retire_prompts = (Array.isArray(t.retire) ? t.retire : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const edit_prompts = (Array.isArray(t.edit) ? t.edit : []).filter(x => x && typeof x === 'object' && String(x.prompt_id || '').trim()).map(x => ({ prompt_id: String(x.prompt_id).trim(), ...asQ(x), prompt: S6(x.prompt, 300), pinned: x.pinned === undefined ? undefined : (x.pinned === true || String(x.pinned) === 'true') })).slice(0, 500);
if (action === 'ai_prompts' && !add_prompts.length && !off_prompts.length && !on_prompts.length && !pin_prompts.length && !unpin_prompts.length && !edit_prompts.length && !accept_prompts.length && !retire_prompts.length) throw new Error('add (questions to track), edit, remove, enable, pin, unpin, accept or retire (prompt ids or texts) is required for action ai_prompts');
// B7-5 (W3-D): content_groups = [{ name, pattern }] -- a regular expression per group over the page path (case-insensitive); [] clears them
const rawGroups = Array.isArray(t.content_groups) ? t.content_groups : (Array.isArray(t.groups) ? t.groups : null);
if (action === 'content_groups' && !rawGroups) throw new Error('content_groups (a list of { name, pattern }; an empty list clears the groups) is required for action content_groups');
const content_groups = (rawGroups || []).map(g => ({ name: String(g && g.name || '').trim().slice(0, 60), pattern: String(g && g.pattern || '').trim().slice(0, 200) })).filter(g => g.name && g.pattern).slice(0, 12);
if (action === 'content_groups') for (const g of content_groups) { if (/(\+|\*|\})\)?[+*{]/.test(g.pattern)) throw new Error('content group "' + g.name + '": nested repetition in the pattern is refused'); try { new RegExp(g.pattern, 'i'); } catch (e) { throw new Error('content group "' + g.name + '": not a valid regular expression'); } }
const content_groups_json = JSON.stringify(content_groups);
const monitors = (t.monitors && typeof t.monitors === 'object') ? t.monitors : (action === 'monitors' ? t : {});
// W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the owner's AI alert rules - [{ id, metric, scope, direction, threshold_points, enabled }] -
// checked by the engine's own rule (a bad rule is refused with its reason, nothing is stored); [] or '' clears them. The share-of-voice set: competitor ids.
{ const raw = monitors.ai_alert_rules_json !== undefined ? monitors.ai_alert_rules_json : monitors.ai_alert_rules;
  if (raw !== undefined && raw !== null) { delete monitors.ai_alert_rules; monitors.ai_alert_rules_json = (raw === '' || (Array.isArray(raw) && !raw.length)) ? '' : JSON.stringify(AVX.validateRules(typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (e) { throw new Error('ai_alert_rules_json is not valid JSON'); } })() : raw)); }
  if (monitors.ai_sov_set !== undefined && monitors.ai_sov_set !== null) monitors.ai_sov_set = (Array.isArray(monitors.ai_sov_set) ? monitors.ai_sov_set : String(monitors.ai_sov_set).split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean)
    .map(x => /\./.test(x) ? normD(x) : x.slice(0, 60)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 20).join(', '); }
return [{ json: { action, site_id, domain: normD(t.domain) || '', status: action === 'pause' ? 'paused' : 'active', pages_per_week: pages, cadence_status: pages > 0 ? 'active' : 'off', keyword, prospect_domain, prospect_type: String(t.type || '').toLowerCase(), prospect_status: pstatus, contact_email: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(t.contact_email || '').trim()) ? String(t.contact_email).trim().toLowerCase() : '', note: t.note == null ? null : String(t.note).slice(0, 500), add_prompts, off_prompts, on_prompts, pin_prompts, unpin_prompts, edit_prompts, accept_prompts, retire_prompts, monitors, content_groups_json, business_facts, market_country: market.country, market_location_code: market.location_code, market_language_code: market.language_code, market_iso: market.country_iso, updated_at: new Date().toISOString(), request_id: String(t.request_id || '') } }];
