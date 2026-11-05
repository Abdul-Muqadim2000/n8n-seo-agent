// AL1-AL14 + AL-STAT (AIR package P2, 2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md 6.3, fixes/P2.md): ARL, the decision and learning kit
// (v5/code/_ai_rank_learn.js). Synthetic data only (.example hosts); P1's diagnosis is represented by fixtures that emit ARD's frozen shapes.
//   AL-STAT the formulas against known values: R1 6's MDE table, Fisher exact p-values and the binomial tail against exact rational arithmetic
//           (BigInt), the first-appearance k, Beta quantiles against the binomial identity and a numeric integral
//   AL1  the lever library, the refused list, the zero-weight items, the cost constants file shared with the app
//   AL2  score = a hand computation to 4 decimals (an own page; an eligibility step with its look-ahead)
//   AL3  choose: every constraint of DESIGN 2.E
//   AL4  stage to lever: a list-dominated cold-start site, a cited-not-named question, a won question
//   AL5  pre-registration before any sink, never rewritten
//   AL6  verify: live + indexed -> happened (live_at); a 403 directory -> unknown; not happened -> never learned
//   AL7  DiD = AVX.impact; the placebo flags a pre-trend; synthetic panels: an injected lift is found, zero lift gives <= 5% false "likely helped"
//   AL8  Fisher: 7 of 7 first appearances on 16 treated / 8 control -> p 0.033, through outcome()
//   AL9  learning: background subtraction, the per-site cap, the leave-one-out site posterior and its 90% interval, idempotent and incremental
//   AL10 Brier calibration per lever
//   AL11 the memo: seven parts in order, every figure with a basis, the copy rule, no claim of cause
//   AL12 compareOld: overlap, gains, causes, the refused tactics in the old plan
//   AL13 determinism, input order, sandbox rules, speed
//   AL14 the archetypes end to end with P1's real ARD (skipped with a note while ARD is the W0 skeleton)
// Regenerate the cost file only for a deliberate change of AIR's cost constants: AIR_COST_WRITE=1 node harness/scenarios_air_learn.js
const fs = require('fs'); const path = require('path');
const V5 = path.join(__dirname, '..', 'v5', 'code'); const rdf = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
const COST_FILE = path.join(__dirname, 'ai_rank_cost_cases.json');
const loadKits = () => { const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
  return new Function('URL', 'structuredClone', 'Object', rdf('_ai_measure.js') + '\n' + rdf('_ai_rank_flags.js') + '\n' + rdf('_ai_rank_diag.js') + '\n' + rdf('_ai_rank_learn.js') + '\nreturn { AVX, AIRF, ARD, ARL };')(undefined, undefined, SOBJ); };
const costCases = (ARL) => ({ generated: 'harness/scenarios_air_learn.js from ARL (v5/code/_ai_rank_learn.js); AIR_COST_WRITE=1 regenerates', rule_version: 'air-1', constants: ARL.COST,
  levers: ARL.LEVERS.map(l => ({ id: l.id, usd: l.usd, effort_min: l.effort_min, executor: l.executor, cost_usd_at_H: ARL.costOf(l, ARL.COST.H) })),
  monthly_usd: { shadow: 0, on_free: 0, reserve: +(ARL.COST.page_usd * ARL.COST.reserve_pages_month).toFixed(2), fanout_20: [+(20 * 4.33 * ARL.COST.fanout_read_usd * 0.5).toFixed(2), +(20 * 4.33 * ARL.COST.fanout_read_usd).toFixed(2)],
    mentions: [+(ARL.COST.mentions_task_usd[0] * ARL.COST.mentions_tasks_month).toFixed(2), +(ARL.COST.mentions_task_usd[1] * ARL.COST.mentions_tasks_month).toFixed(2)] },
  credits_per_usd: ARL.COST.credits_per_usd, note: 'credits shown to clients = 60 x USD (3x markup at $0.05 a credit); provider costs per DESIGN.md section 5' });

module.exports = async (ctx) => {
  const { H, guard, reset, begin } = ctx;
  await guard('air learn P2', async () => {
    reset(); const SN = 'AL (AIR P2 2026-11-06, DESIGN.md 6.3): ARL - levers, score, choose, prereg, verify, lift tests, learning, memo';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const J = (x) => String(JSON.stringify(x)); const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
    const { AVX, AIRF, ARD, ARL } = loadKits(); const ST = ARL.STATS;
    const DAY = 864e5; const NOW = Date.parse('2026-11-02T10:00:00.000Z'); const iso = (ms) => new Date(ms).toISOString();

    // ================= AL-STAT: the formulas against known values =================
    // exact rational arithmetic, independent of the kit's log-gamma
    const bC = (n, k) => { if (k < 0 || k > n) return 0n; let r = 1n; for (let i = 0; i < k; i++) r = r * BigInt(n - i) / BigInt(i + 1); return r; };
    const ratio = (num, den) => Number(num * 1000000000000n / den) / 1e12;
    const fisherExact = (kt, nt, kc, nc) => { const N = nt + nc, K = kt + kc; let num = 0n; for (let x = kt; x <= Math.min(K, nt); x++) num += bC(K, x) * bC(N - K, nt - x); return ratio(num, bC(N, nt)); };
    const binomExact = (x, n, pn, pd) => { let num = 0n; for (let i = x; i <= n; i++) num += bC(n, i) * BigInt(pn) ** BigInt(i) * BigInt(pd - pn) ** BigInt(n - i); return ratio(num, BigInt(pd) ** BigInt(n)); };
    // R1 6: m = 28, 80% power, 5% two-sided; [p, Q per arm, rho .3 pre/post, rho .3 DiD, rho .6 pre/post, rho .6 DiD]
    const R1 = [[0.02, 40, 5.0, 7.1, 6.9, 9.7], [0.02, 100, 3.2, 4.5, 4.3, 6.1], [0.10, 40, 10.7, 15.2, 14.7, 20.8], [0.10, 100, 6.8, 9.6, 9.3, 13.2], [0.10, 200, 4.8, 6.8, 6.6, 9.3], [0.30, 100, 10.4, 14.6, 14.2, 20.1]];
    const r1bad = []; for (const [p, Q, a, b, c, d] of R1) { const m3 = ST.mde({ q_t: Q, q_c: Q, m: 28, p, rho: 0.3 }), m6 = ST.mde({ q_t: Q, q_c: Q, m: 28, p, rho: 0.6 });
      for (const [got, want] of [[m3.prepost, a], [m3.did, b], [m6.prepost, c], [m6.did, d]]) if (!near(got, want, 0.1)) r1bad.push([p, Q, got, want]); }
    check('AL-STAT the MDE reproduces every cell of R1 6\'s table within 0.1 point (24 cells; n_eff = Q m / (1 + (m - 1) rho), z 2.80)', !r1bad.length, J(r1bad));
    const m0 = ST.mde({ q_t: 16, q_c: 8, m: 28, p: 0, rho: 0.3 });
    check('AL-STAT a zero baseline is planned at 2% (p_used 0.02) and the basis says so', m0.p_used === 0.02 && /planned at 2%/.test(m0.basis) && ST.mde({ q_t: 40, q_c: 40, m: 28, p: 0, rho: 0.3 }).prepost === ST.mde({ q_t: 40, q_c: 40, m: 28, p: 0.02, rho: 0.3 }).prepost, J(m0));
    const fk1 = ST.firstK(16, 8), fk2 = ST.firstK(20, 10);
    check('AL-STAT first-appearance k: 16 treated / 8 control -> 7 (p 0.033); 20 / 10 -> 7 (p 0.038: DESIGN A7 says 6 / 0.046, but C(20,6)/C(30,6) = 0.065 > 0.05)',
      fk1.k === 7 && near(fk1.p, ratio(bC(16, 7), bC(24, 7)), 1e-9) && near(fk1.p, 0.0331, 1e-4) && fk2.k === 7 && near(fk2.p, 0.0381, 1e-4) && ratio(bC(20, 6), bC(30, 6)) > 0.05 && m0.first_appearance_k === 7, J({ fk1, fk2 }));
    if (ARD.mde({ q_t: 16, q_c: 8, m: 28, p: 0.02, rho: 0.3 }).unavailable) console.log('   note AL-STAT: ARD.mde is the W0 skeleton; the cross-check of P1\'s MDE against R1 6 runs once P1 lands');
    else { const pm = ARD.mde({ q_t: 40, q_c: 40, m: 28, p: 0.02, rho: 0.3 }); check('AL-STAT P1\'s ARD.mde agrees with ARL\'s on R1 6 row 1 (5.0 / 7.1)', near(pm.prepost, 5.0, 0.1) && near(pm.did, 7.1, 0.1), J(pm)); }
    const FT = [[7, 16, 0, 8], [3, 4, 1, 4], [5, 10, 1, 10], [0, 6, 0, 6], [4, 12, 4, 12], [9, 20, 2, 10], [1, 3, 0, 9], [12, 20, 3, 10]];
    const fbad = FT.filter(([a, b, c, d]) => !near(ST.fisher(a, b, c, d), fisherExact(a, b, c, d), 1e-9)).map(r => [r, ST.fisher(...r), fisherExact(...r)]);
    check('AL-STAT one-sided Fisher exact p = exact rational hypergeometric tail on 8 tables (incl. the tea-tasting 3/4 vs 1/4 = 17/70)', !fbad.length && near(ST.fisher(3, 4, 1, 4), 17 / 70, 1e-12), J(fbad));
    const BT = [[8, 10, 1, 2], [3, 20, 1, 10], [0, 5, 1, 3], [6, 6, 1, 2], [4, 30, 1, 12], [11, 25, 2, 5]];
    const bbad = BT.filter(([x, n, a, b]) => !near(ST.binomUpper(x, n, a / b), binomExact(x, n, a, b), 1e-9)).map(r => [r, ST.binomUpper(r[0], r[1], r[2] / r[3]), binomExact(...r)]);
    check('AL-STAT the binomial upper tail = exact rational arithmetic on 6 cases (Bin(10, 1/2) >= 8 = 56/1024)', !bbad.length && near(ST.binomUpper(8, 10, 0.5), 56 / 1024, 1e-12), J(bbad));
    // Beta quantiles: integer (a, b) through I_x(a, b) = P(Bin(a + b - 1, x) >= a); non-integer through a numeric integral (x = u^(1/a), Simpson)
    const binTail = (a, b, x) => { const n = a + b - 1; let s = 0, c = 1; for (let i = 0; i <= n; i++) { if (i >= a) s += c * Math.pow(x, i) * Math.pow(1 - x, n - i); c = c * (n - i) / (i + 1); } return s; };
    const qbad = []; for (const [a, b] of [[2, 8], [1, 1], [5, 5], [9, 1], [3, 17], [14, 23]]) for (const q of [0.05, 0.5, 0.95]) { const x = ST.betaInv(q, a, b); if (!near(binTail(a, b, x), q, 1e-7)) qbad.push([a, b, q, x, binTail(a, b, x)]); }
    const simpson = (f, lo, hi, n) => { const h = (hi - lo) / n; let s = f(lo) + f(hi); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(lo + i * h); return s * h / 3; };
    const cdfNum = (a, b, x) => { if (a < 1) { const f = (u) => Math.pow(Math.max(0, 1 - Math.pow(u, 1 / a)), b - 1); return simpson(f, 0, Math.pow(x, a), 20000) / simpson(f, 0, 1, 20000); }
      const g = (t) => Math.pow(t, a - 1) * Math.pow(Math.max(0, 1 - t), b - 1); return simpson(g, 0, x, 20000) / simpson(g, 0, 1, 40000); };   // x = u^(1/a) only where the density is infinite at 0
    for (const [a, b] of [[1.2, 4.8], [0.09, 2.91], [0.48, 7.52], [7.3077, 14.6923]]) for (const q of [0.05, 0.95]) { const x = ST.betaInv(q, a, b); if (!near(cdfNum(a, b, x), q, 2e-5)) qbad.push([a, b, q, x, cdfNum(a, b, x)]); }
    check('AL-STAT Beta quantiles: 18 integer cases against the binomial identity (1e-7) and 8 non-integer ones (incl. the L13 prior 0.09 / 2.91) against a numeric integral', !qbad.length, J(qbad));

    // ================= AL1: the library =================
    const LV = new Map(ARL.LEVERS.map(l => [l.id, l]));
    const libBad = ARL.LEVERS.filter(l => !(l.label && l.from.length && AIRF.STAGES.includes(l.to) && l.sink && l.executor && l.evidence.length && (l.prior ? l.prior.mean > 0 && l.prior.mean < 1 && l.prior.n0 > 0 : !!l.gate)
      && (l.id === 'L17' || l.from.every(s => l.next[s] && AIRF.STAGES.indexOf(l.next[s]) >= AIRF.STAGES.indexOf(s) && AIRF.STAGES.indexOf(l.next[s]) <= AIRF.STAGES.indexOf(l.to))))).map(l => l.id);
    check('AL1 every lever has a prior (or its gate), stages with one next step per from stage within [from, to], a sink, an executor and evidence', !libBad.length && ARL.LEVERS.length === 17, J(libBad));
    check('AL1 the six refused tactics (weight 0, with their reasons) and the zero-weight hygiene items; a zero-weight or refused candidate is never chosen',
      ARL.REFUSED.length === 6 && ARL.REFUSED.every(r => r.weight === 0 && r.why && r.match) && J(ARL.ZERO_WEIGHT) === J(['schema', 'llms_txt'])
      && (() => { const r = ARL.choose([{ action_id: 'x1', site_id: 's', lever: 'schema', cells: [], scored: { gain: 9, score: 9 } }, { action_id: 'x2', site_id: 's', lever: 'L08', refused: 'a list written by a competitor', cells: [], scored: { gain: 9, score: 9 } }], { mode: 'on' });
        return !r.chosen.length && r.refused.length === 1 && /competitor/.test(r.refused[0].why); })(), '');
    check('AL1 L03 / L04 act only on the engines whose index they fix; L09 effort 60 minutes; an unlisted engine takes "*" when the lever has one, else 1',
      ARL.multOf(LV.get('L03'), 'ai_mode') === 0 && ARL.multOf(LV.get('L03'), 'copilot') === 1 && ARL.multOf(LV.get('L04'), 'copilot') === 0 && ARL.multOf(LV.get('L04'), 'gemini') === 1 && LV.get('L09').effort_min === 60 && ARL.multOf(LV.get('L08'), 'gemini') === 1, '');
    const cc = costCases(ARL);
    if (process.env.AIR_COST_WRITE === '1') { fs.writeFileSync(COST_FILE, JSON.stringify(cc, null, 1) + '\n'); console.log('   wrote ' + COST_FILE); }
    const ccStored = fs.existsSync(COST_FILE) ? JSON.parse(fs.readFileSync(COST_FILE, 'utf8')) : null;
    check('AL1 harness/ai_rank_cost_cases.json (shared with the app, P6) equals the kit\'s constants: H $25, overhead $0.50, 60 credits a USD, reserve $1.60 a month, every lever\'s cost',
      ccStored && J(ccStored) === J(cc) && cc.constants.H === 25 && cc.monthly_usd.reserve === 1.6 && cc.levers.find(l => l.id === 'L05').cost_usd_at_H === 9.6333, J({ stored: ccStored && ccStored.monthly_usd, now: cc.monthly_usd }));

    // ================= fixtures in ARD's shapes =================
    const cell = (stage, sub, x) => Object.assign({ stage, sub: sub || '', basis: stage === 'S2' ? 'proxy_rank' : 'direct', n: 8, named: 0, cited: 0, retrieved: 0, our_rank: null, evidence: [] }, x || {});
    const dg = (pid, intent, engines, x) => Object.assign({ prompt_id: pid, intent, engines, best_stage: 'S1', parametric_share: {}, no_search: [], list_dominated: false, nobody_named: false, first_named_at: '', last_named_at: '', last_cited_at: '' }, x || {});
    const ALL7 = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot'];
    // the cold-start site: 12 recommendation questions built from lists; ChatGPT / Perplexity / Claude cannot find it; not in Bing; Google holds only 4 of the mapped pages
    const coldSite = { site_id: 'site_cold-example', domain: 'cold.example', prompts: [] };
    const coldDiag = [], coldVals = new Map(), coldFeas = new Map();
    const vols = [260, 140, 90, 40, 70, 30, 120, 60, 200, 50, 80, 35];
    for (let i = 0; i < 12; i++) { const q = 'c' + (i + 1); const g = i < 4 ? cell('S1') : cell('S0', 'not_indexed');
      coldDiag.push(dg(q, 'recommendation', { chatgpt: cell('S1'), perplexity: cell('S1'), claude: cell('S1', '', { basis: 'unknown_index' }), copilot: cell('S0', 'not_indexed'), ai_overview: g, ai_mode: g, gemini: g }, { list_dominated: true }));
      coldSite.prompts.push({ prompt_id: q, keyword: 'custom software ' + q, market: 'AE-en', stage: i % 3 ? 'consideration' : 'decision', volume: vols[i] });
      coldVals.set(q, ARL.value({ prompt: coldSite.prompts[i], intent: 'recommendation' })); coldFeas.set(q, ARL.feasibility({ prompt: coldSite.prompts[i], market: { cc: 'AE' }, diag: { rivals_median: 2 }, reach: 0.15 })); }
    const CQ = coldDiag.map(d => d.prompt_id);
    const coldSources = [
      { url: 'https://top-firms.example/best-software-companies-uae', url_key: 'top-firms.example/best-software-companies-uae', host: 'top-firms.example', page_type: 'listicle', author_kind: 'editorial', names_client: false, rivals_named: ['rival-one.example'], questions: CQ, engines: ['chatgpt', 'perplexity', 'ai_mode', 'ai_overview'], cites_28d: 40, influence: 9, placeability: 0.15, placeability_why: 'editorial list, contact found', contact_email: 'editor@top-firms.example', contact_url: '', from: 'answers', last_seen: iso(NOW - DAY) },
      { url: 'https://clutch.co/ae/developers/dubai', url_key: 'clutch.co/ae/developers/dubai', host: 'clutch.co', page_type: 'directory', author_kind: 'platform', names_client: false, rivals_named: [], questions: CQ.slice(0, 10), engines: ['perplexity', 'chatgpt', 'ai_overview', 'gemini'], cites_28d: 30, influence: 7, placeability: 0.8, placeability_why: 'self-serve profile', contact_email: '', contact_url: '', from: 'answers', last_seen: iso(NOW - DAY) },
      { url: 'https://rival-one.example/blog/top-software-companies-dubai', url_key: 'rival-one.example/blog/top-software-companies-dubai', host: 'rival-one.example', page_type: 'listicle', author_kind: 'rival', names_client: false, rivals_named: ['rival-one.example'], questions: CQ.slice(0, 6), engines: ['chatgpt', 'perplexity'], cites_28d: 12, influence: 3, placeability: 0.02, placeability_why: 'a competitor\'s own list', contact_email: '', contact_url: '', from: 'answers', last_seen: iso(NOW - DAY) },
      { url: 'https://paywalled-news.example/business/uae-software', url_key: 'paywalled-news.example/business/uae-software', host: 'paywalled-news.example', page_type: 'news', author_kind: 'editorial', names_client: null, rivals_named: [], questions: CQ.slice(0, 3), engines: ['chatgpt'], cites_28d: 3, influence: 1, placeability: 0.05, placeability_why: '403', contact_email: '', contact_url: '', from: 'answers', last_seen: iso(NOW - DAY) }];
    const coldArms = CQ.map((q, i) => ({ prompt_id: q, arm: i % 3 === 2 ? 'control' : 'treated', stratum: 'recommendation|zero|software', assigned_at: iso(NOW - 30 * DAY) }));
    const scoreAll = (cands, vals, feas, priors) => cands.map(c => Object.assign({}, c, { scored: ARL.score(c, { priors: priors || [], values: vals, feas, H: 25 }) }));

    // ================= AL2: score by hand =================
    { const c = { action_id: 'h1', site_id: 's', lever: 'L05', factor: 1, cells: [{ prompt_id: 'q1', engine: 'chatgpt', stage: 'S1' }, { prompt_id: 'q1', engine: 'ai_mode', stage: 'S1' }, { prompt_id: 'q1', engine: 'claude', stage: 'S1' }, { prompt_id: 'q1', engine: 'perplexity', stage: 'S3' }] };
      const vals = new Map([['q1', { V: 2.0 }]]), feas = new Map([['q1', { F: 0.6, reach_w: 0.5, basis: 'reach percentile 0.5' }]]);
      const s = ARL.score(c, { priors: [], values: vals, feas, H: 25 });
      // w V F p (U(S2) - U(S1)): chatgpt .30 x 2 x .6 x .20 x .12; ai_mode .15 x 2 x .6 x (.2 x 1.2) x .12; claude .08 x 2 x .6 x (.2 x .6) x .12; perplexity S3 is not a from stage (0)
      const gain = 0.30 * 2 * 0.6 * 0.20 * 0.12 + 0.15 * 2 * 0.6 * 0.24 * 0.12 + 0.08 * 2 * 0.6 * 0.12 * 0.12; const cost = 0.80 + 20 / 60 * 25 + 0.5; const sc = gain / cost / (1 + 45 / 60);
      // L03 on copilot S0 not_indexed: p .85; du = U(S1) - U(S0) + look-ahead from S1 = max(L05 .2 x .8 x .12, L11 .05 x 1 x .12, L12 .05 x 1 x .12) = .0192
      const c3 = { action_id: 'h2', site_id: 's', lever: 'L03', factor: 1, cells: [{ prompt_id: 'q1', engine: 'copilot', stage: 'S0', sub: 'not_indexed' }, { prompt_id: 'q1', engine: 'ai_mode', stage: 'S0', sub: 'not_indexed' }] };
      const s3 = ARL.score(c3, { priors: [], values: vals, feas, H: 25 }); const g3 = 0.10 * 2 * 0.6 * 0.85 * (0.03 + 0.2 * 0.8 * 0.12); const sc3 = g3 / (20 / 60 * 25 + 0.5) / (1 + 10 / 60);
      check('AL2 score = the hand computation to 4 decimals: an own page (gain, cost, score; a cell outside the lever\'s stages adds 0) and the Bing step (look-ahead from S1; ai_mode is not its index)',
        near(s.gain, gain, 5e-5) && near(s.cost, cost, 5e-5) && near(s.score * 1e4, sc * 1e4, 5e-5) && s.p_by_cell.length === 3 && near(s3.gain, g3, 5e-5) && near(s3.score * 1e4, sc3 * 1e4, 5e-5) && s3.p_by_cell.length === 1,
        J({ s: [s.gain, s.cost, s.score], hand: [gain, cost, sc], s3: [s3.gain, s3.score], h3: [g3, sc3] }));
      const lo = ARL.score(c, { priors: [], values: vals, feas: new Map([['q1', { F: 0.6, reach_w: 0.1, basis: 'reach percentile 0.1' }]]), H: 25 });
      check('AL2 an own page\'s chance scales with the site\'s reach (reach 0.1 -> x 0.2 of the median site\'s gain); unknown reach keeps the prior', near(lo.gain, gain * 0.2, 5e-5)
        && near(ARL.score(c, { priors: [], values: vals, feas: new Map([['q1', { F: 0.6, reach_w: 0.5, basis: 'reach not stored: 0.5' }]]) }).gain, gain, 5e-5), J([lo.gain, gain * 0.2])); }

    // ================= AL3: choose under every constraint =================
    { const mk = (id, lever, q, gain, score, x) => Object.assign({ action_id: id, site_id: 's', lever, ref: q ? { prompt_id: q } : { url: 'https://l.example/' + id }, questions: q ? [q] : ['q9'], engines: ['chatgpt'], cells: [{ prompt_id: q || 'q9', engine: 'chatgpt', stage: 'S1' }], scored: { gain, cost: 1, score, days: 30, p_by_cell: [{ p: 0.2, gain }] } }, x || {});
      const cs = [mk('o1', 'L05', 'q1', 0.5, 0.9), mk('o2', 'L05', 'q2', 0.4, 0.8), mk('o3', 'L06', 'q1', 0.45, 0.85),
        ...[1, 2, 3, 4, 5, 6, 7].map(i => mk('p' + i, 'L08', null, 0.3, 0.5 - i / 100)),
        ...[1, 2, 3, 4, 5].map(i => mk('h' + i, 'L09', null, 0.2, 0.3 - i / 100)),
        mk('ctl', 'L07', 'q3', 0.9, 2), mk('tiny', 'L12', null, 0.01, 5), mk('s0', 'L08', null, 0.9, 3, { cells: [{ prompt_id: 'q1', engine: 'copilot', stage: 'S0' }] }), mk('elig', 'L01', null, 0.005, 0.001), mk('open1', 'L08', null, 0.9, 4)];
      const arms = [{ prompt_id: 'q1', arm: 'treated' }, { prompt_id: 'q2', arm: 'treated' }, { prompt_id: 'q3', arm: 'control' }];
      const open = [{ action_id: 'open1', lever: 'L08', status: 'queued', ref: '{}' }, ...[1, 2, 3, 4, 5, 6].map(i => ({ action_id: 'oh' + i, lever: 'L11', status: 'in_progress', ref: '{}' })), { action_id: 'sh', lever: 'L09', status: 'shadow', ref: '{}' }];
      const r = ARL.choose(cs, { arms, mode: 'on', open_actions: open }); const ids = r.chosen.map(a => a.action_id); const why = (id) => (r.deferred.find(d => d.action.action_id === id) || {}).why || '';
      check('AL3 one own page a week and one per question (o1 chosen; o3 same question, o2 no slot left)', ids.includes('o1') && !ids.includes('o2') && !ids.includes('o3') && /one own page per question/.test(why('o3')) && /no content slot/.test(why('o2')), J({ ids, d: r.deferred.map(d => [d.action.action_id, d.why]) }));
      check('AL3 at most 5 placement pitches a week (an open one does not count, it is "already open")', ids.filter(i => /^p/.test(i)).length === 5 && /already open/.test(why('open1')) && /pitches this week/.test(why('p6')), J(ids));
      check('AL3 new steps for a person: 3 a week, at most 8 open (6 open -> 2 more); shadow rows never hold a slot', ids.filter(i => /^h/.test(i)).length === 2 && /8 steps open/.test(why('h3')), J(ids));
      check('AL3 no question-specific lever on a control question (refused, with the reason); a cell the engine cannot read takes only eligibility steps', !ids.includes('ctl') && r.refused.some(x => /control/.test(x.why)) && !ids.includes('s0') && r.refused.some(x => /cannot read/.test(x.why)), J(r.refused));
      check('AL3 the minimum gain 0.02 (an eligibility step is exempt: it is a gate); mode off chooses nothing', !ids.includes('tiny') && /below the minimum/.test(why('tiny')) && ids.includes('elig') && J(ARL.choose(cs, { arms, mode: 'off' })) === J({ chosen: [], deferred: [], refused: [] }), J(ids));
      check('AL3 every chosen action carries the frozen action shape (id, site, lever, executor, scope, ref, questions, engines, target stage, expected, prereg, sink, sink_ref "")',
        r.chosen.every(a => ['action_id', 'site_id', 'lever', 'executor', 'scope', 'ref', 'questions', 'engines', 'target_stage', 'expected', 'prereg', 'sink', 'sink_ref'].every(k => k in a) && a.sink_ref === '' && ['p', 'gain', 'cost', 'score', 'days'].every(k => k in a.expected)), J(r.chosen[0])); }

    // ================= AL4: stage to lever =================
    const coldC = ARL.candidates({ site: coldSite, diag: coldDiag, sources: coldSources, arms: coldArms, stored_actions: [], settings: {}, now: NOW });
    const coldS = scoreAll(coldC, coldVals, coldFeas);
    const coldR = ARL.choose(coldS, { arms: coldArms, mode: 'shadow', open_actions: [] });
    const best = (lv) => Math.max(0, ...coldS.filter(c => c.lever === lv && !c.refused).map(c => c.scored.score));
    const top5 = coldR.chosen.slice().sort((a, b) => b.expected.score - a.expected.score).slice(0, 5).map(a => a.lever);
    check('AL4 cold start, answers built from lists: placement (L08), the directory profile (L09) and the Bing step (L03) each score above any own page (L05 / L06) and are all chosen',
      ['L08', 'L09', 'L03'].every(l => best(l) > Math.max(best('L05'), best('L06'))) && ['L08', 'L09', 'L03'].every(l => top5.includes(l)) && !top5.includes('L06'), J({ best: ['L03', 'L04', 'L05', 'L06', 'L08', 'L09', 'L11', 'L12'].map(l => [l, +best(l).toExponential(3)]), top5 }));
    check('AL4 the competitor\'s own list is learned from, never pitched (refused: owner decision 8); the 403 news page proposes nothing; control questions get no own page',
      coldR.refused.some(x => /written by a competitor/.test(x.why)) && !coldR.chosen.some(a => /rival-one/.test(a.page_url)) && !coldC.some(c => /paywalled/.test(c.page_url))
      && !coldR.chosen.some(a => ['L05', 'L06', 'L07', 'L15'].includes(a.lever) && coldArms.find(x => x.prompt_id === a.questions[0]).arm === 'control'), J(coldR.refused));
    // the retrievable site: a cited-not-named question, a won informational question, a question found but not cited
    const rs = { site_id: 'site_ret-example', domain: 'ret.example', prompts: [{ prompt_id: 'r1', keyword: 'erp partner riyadh', stage: 'decision', volume: 300, market: 'SA-en' }, { prompt_id: 'r2', keyword: 'erp implementation cost', stage: 'awareness', volume: 880, market: 'SA-en' }, { prompt_id: 'r3', keyword: 'odoo partner riyadh', stage: 'decision', volume: 110, market: 'SA-en' }],
      pages: [{ url: 'https://ret.example/guides/erp-implementation-cost', questions: 'r2', status: 200, words_raw: 900 }] };
    const rd_ = [dg('r1', 'recommendation', { chatgpt: cell('S3', '', { cited: 3 }), ai_mode: cell('S3', '', { cited: 2 }), perplexity: cell('S3', '', { cited: 2 }), ai_overview: cell('S1'), gemini: cell('S1'), claude: cell('S1'), copilot: cell('S1') }),
      dg('r2', 'informational', { ai_overview: cell('S5', '', { cited: 5 }), ai_mode: cell('S5', '', { cited: 4 }), gemini: cell('S5', '', { cited: 3 }), chatgpt: cell('S1'), perplexity: cell('S2', '', { retrieved: 1 }), claude: cell('S1'), copilot: cell('S1') }, { nobody_named: true }),
      dg('r3', 'recommendation', { chatgpt: cell('S2', '', { retrieved: 2 }), ai_mode: cell('S2', '', { our_rank: { query: 'odoo partner riyadh', pos: 7, index: 'google', read_at: iso(NOW - 3 * DAY) } }), ai_overview: cell('S1'), gemini: cell('S1'), perplexity: cell('S1'), claude: cell('S1'), copilot: cell('S1') })];
    const rv = new Map(rs.prompts.map(p => [p.prompt_id, ARL.value({ prompt: p, intent: p.prompt_id === 'r2' ? 'informational' : 'recommendation' })])), rf = new Map(rs.prompts.map(p => [p.prompt_id, ARL.feasibility({ prompt: p, market: { cc: 'SA' }, diag: { rivals_median: 2 }, reach: 0.5 })]));
    const rArms = [{ prompt_id: 'r1', arm: 'treated', stratum: 'a' }, { prompt_id: 'r2', arm: 'treated', stratum: 'b' }, { prompt_id: 'r3', arm: 'treated', stratum: 'a' }];
    const rC = scoreAll(ARL.candidates({ site: rs, diag: rd_, sources: [], arms: rArms, stored_actions: [], settings: {}, now: NOW }), rv, rf);
    const rR = ARL.choose(rC, { arms: rArms, mode: 'on', open_actions: [] });
    const forQ = (q) => rC.filter(c => c.questions.includes(q) && c.scope !== 'site').sort((a, b) => b.scored.score - a.scored.score);
    check('AL4 a cited-not-named question ranks "fix the passage" (L07) first among its own actions; the won informational question\'s cited page is protected (L16, chosen, on the right URL)',
      forQ('r1')[0].lever === 'L07' && rR.chosen.some(a => a.lever === 'L16' && a.page_url === 'https://ret.example/guides/erp-implementation-cost' && a.questions.includes('r2')), J({ r1: forQ('r1').map(c => [c.lever, c.scored.score]), chosen: rR.chosen.map(a => [a.lever, a.page_url]) }));
    check('AL4 a question already found (S2) gets a refresh of its page (L06), never a second new page (L05)', rC.some(c => c.lever === 'L06' && c.questions[0] === 'r3') && !rC.some(c => c.lever === 'L05' && c.questions[0] === 'r3'), J(rC.filter(c => c.questions[0] === 'r3').map(c => c.lever)));
    { const ns = [dg('n1', 'recommendation', { chatgpt: cell('S1'), claude: cell('S1'), perplexity: cell('S1') }, { no_search: ['chatgpt', 'claude'] })];
      const nc = ARL.candidates({ site: { site_id: 's', domain: 'n.example' }, diag: ns, sources: [], arms: [], now: NOW });
      check('AL4 an engine answering from memory (no_search) is reached only by long-run levers (earned mention, LinkedIn)', nc.filter(c => c.lever === 'L05').every(c => c.engines.join() === 'perplexity') && nc.some(c => c.lever === 'L11' && c.engines.includes('chatgpt')), J(nc.map(c => [c.lever, c.engines]))); }

    // ================= AL5: pre-registration =================
    const preR = ARL.choose(coldS, { arms: coldArms, mode: 'shadow', open_actions: [], now: NOW, units60: [] });
    const own = preR.chosen.find(a => a.lever === 'L08') || preR.chosen[0];
    check('AL5 every chosen action is pre-registered before it is returned and before any sink is written (sink_ref ""): metric, questions, engines, window >= 28 days, start rule, projection, registration time',
      preR.chosen.length > 0 && preR.chosen.every(a => a.prereg && a.prereg.registered_at === iso(NOW) && a.sink_ref === '' && a.prereg.window_days >= 28 && ['live_at', 'happened_at'].includes(a.prereg.t0_rule) && J(a.prereg.questions) === J(a.questions) && a.prereg.projected.p === a.expected.p), J(own && own.prereg));
    check('AL5 controls: only control-arm questions the action does not touch (a page action\'s exposed questions are excluded); a site-wide step has none and says so',
      preR.chosen.filter(a => a.scope !== 'site').every(a => a.prereg.controls.every(q => coldArms.find(x => x.prompt_id === q).arm === 'control' && !a.questions.includes(q))) && preR.chosen.filter(a => a.scope === 'site').every(a => !a.prereg.controls.length && /no control possible/.test(a.prereg.control_note)), '');
    { const a5 = { action_id: 'air_s_L05_x', site_id: 's', lever: 'L05', questions: ['q1'], engines: ['chatgpt'], intent: 'recommendation', expected: { p: 0.2, gain: 0.1 } };
      const p1 = ARL.prereg(a5, { arms: [{ prompt_id: 'q2', arm: 'control' }], now: NOW }); const stored = { prereg_json: JSON.stringify(p1) };
      const p2 = ARL.prereg(Object.assign({}, a5, { expected: { p: 0.9, gain: 5 } }), { arms: [], now: NOW + 7 * DAY });
      check('AL5 a later run never rewrites the registration (the stored one wins); an own page starts its clock at live_at, window max(28, 45 days)', J(ARL.keepPrereg(stored, p2)) === J(p1) && J(ARL.keepPrereg({}, p2)) === J(p2) && p1.t0_rule === 'live_at' && p1.window_days === 45 && p1.metric === 'named_rate', J(p1)); }

    // ================= AL6: verify =================
    { const reg = NOW - 60 * DAY; const pre = (lever, x) => Object.assign({ action_id: 'v_' + lever, site_id: 's', lever, status: 'queued', prereg: { registered_at: iso(reg), window_days: 45, t0_rule: 'live_at' }, engines: ['chatgpt', 'ai_mode'] }, x || {});
      const a = pre('L05', { keyword: 'erp implementation cost' }); const U = 'https://ret.example/guides/erp-cost-2026';
      const cl = [{ source: 'ai_answer', keyword: 'ERP implementation cost', status: 'published', published_url: U, published_at: iso(NOW - 20 * DAY), started_at: iso(NOW - 25 * DAY) }];
      const pg = [{ url: U, status: 200, words_raw: 950, checked_at: iso(NOW - 18 * DAY) }]; const idx = { google: new Map([['ret.example/guides/erp-cost-2026', 'indexed']]), bing: { in_account: true, crawled: new Map() } };
      const v1 = ARL.verify(a, { contentLog: cl, pages: pg, index: idx, now: NOW });
      const v2 = ARL.verify(a, { contentLog: cl, pages: [], index: idx, now: NOW });
      const v3 = ARL.verify(a, { contentLog: cl, pages: [{ url: U, status: 200, words_raw: 40, checked_at: iso(NOW - 18 * DAY) }], index: idx, now: NOW });
      const v4 = ARL.verify(pre('L09', { ref: { listing_id: 'clutch' }, page_url: 'https://clutch.co/ae/developers/dubai' }), { listings: [{ listing_id: 'clutch', status: 'missing' }], sources: [{ url: 'https://clutch.co/ae/developers/dubai', names_client: null }], now: NOW });
      const v5 = ARL.verify(pre('L08', { ref: { url: 'https://top-firms.example/best' } }), { sources: [{ url: 'https://top-firms.example/best', names_client: true, checked_at: iso(NOW - 2 * DAY) }], now: NOW });
      const v6 = ARL.verify(pre('L01', { engines: ['chatgpt', 'perplexity'] }), { robots: { blocked_engines: ['claude'], read_at: iso(NOW - DAY) }, now: NOW });
      const v7 = ARL.verify(pre('L05', { status: 'shadow' }), { contentLog: cl, pages: pg, index: idx, now: NOW });
      const v8 = ARL.verify(pre('L05', { keyword: 'never written', prereg: { registered_at: iso(NOW - 80 * DAY), window_days: 45, t0_rule: 'live_at' } }), { contentLog: cl, pages: pg, index: idx, now: NOW });
      check('AL6 a page counts only when published, live on our fetch (HTTP 200), indexed and readable in raw HTML; live_at = the later of publication and our fetch',
        v1.happened === true && v1.live_at === iso(NOW - 18 * DAY) && v2.happened === false && v3.happened === false && /raw HTML/.test(v3.evidence[0]), J({ v1, v2, v3 }));
      check('AL6 a directory behind a 403 is unknown (null), never "not there"; a list that now names the business is done; robots open -> done; a shadow action never happens; past window + 14 days -> expired',
        v4.happened === null && v5.happened === true && v6.happened === true && v7.happened === false && v8.happened === false && v8.expired === true, J({ v4, v5, v6, v7, v8 }));
      const notH = Object.assign(pre('L05'), { status: 'expired', prereg: { registered_at: iso(NOW - 80 * DAY), window_days: 45, t0_rule: 'live_at', questions: ['q1'], controls: ['q2'], engines: ['chatgpt'] } });
      const oc = ARL.outcome(notH, { units60: [], diagNow: [], diagAtT0: [], now: NOW });
      check('AL6 an action that did not happen is reported as such and never enters learning', oc.verdict === 'not_happened' && !ARL.learnable({ action: notH, outcome: oc }) && ARL.learn({ priors: [], outcomes: [{ action: notH, outcome: oc }], now: NOW }).length === 0, J(oc)); }

    // ================= AL7: DiD, placebo, synthetic panels =================
    const R = (seed) => AVX.rng('al7|' + seed);
    // a panel: questions with their own base rate; answers spread over the days; treated questions gain `lift` after t0; `trend` moves every question
    const panel = ({ seed, qt = 16, qc = 8, lift = 0, trend = 0, pretrend = 0, perDay = 1, days = 56, t0 = NOW - 28 * DAY, zero = false }) => { const r = R(seed); const units = []; const T = [], C = [];
      for (let i = 0; i < qt + qc; i++) { const q = 'q' + i; (i < qt ? T : C).push(q); const base = zero ? 0 : 0.10 + 0.40 * r();
        for (let d = 0; d < days; d++) for (let k = 0; k < perDay; k++) { const at = t0 - 28 * DAY + d * DAY + (k + 0.5) * DAY / (perDay + 1); const post = at > t0; const e = ['chatgpt', 'perplexity', 'ai_mode'][(d + k) % 3];
          let p = base + trend * (post ? 1 : 0) + (i < qt ? (post ? lift : 0) + pretrend * (at - (t0 - 28 * DAY)) / (56 * DAY) : 0); p = Math.min(0.98, Math.max(0, p));
          units.push({ prompt_id: q, engine: e, named: r() < p, cited: false, at: iso(at) }); } }
      return { units, T, C, t0 }; };
    const actOf = (p, x) => Object.assign({ action_id: 'air_s_L07_' + p.T.length, site_id: 's', lever: 'L07', status: 'verified', happened_at: iso(p.t0),
      prereg: { registered_at: iso(p.t0 - DAY), metric: 'named_rate', questions: p.T, controls: p.C, engines: ['chatgpt', 'perplexity', 'ai_mode'], window_days: 28, t0_rule: 'happened_at', projected: { p: 0.3, gain: 0.1 } } }, x || {});
    { const p = panel({ seed: 'eq', lift: 0.15 }); const a = actOf(p);
      const mine = ARL.didOf(p.units, { questions: p.T, controls: p.C, engines: a.prereg.engines, metric: 'named_rate', t0: p.t0, now: NOW, post_days: 28, seed: a.action_id, B: 2000, id: a.action_id, lever: 'L07' });
      const direct = AVX.impact(p.units.filter(u => Date.parse(u.at) !== p.t0).map(u => ({ prompt_id: u.prompt_id, engine: u.engine, named: u.named, at: u.at })), [{ action_id: a.action_id, kind: 'L07', at: iso(p.t0), questions: p.T, label: 'Cited but not named: fix the passage' }], { now: iso(NOW), window_days: 28, seed: a.action_id, B: 2000, meta: new Map() })[0];
      check('AL7 the DiD is AVX.impact on the same input (28-day window: same effect, same 95% range, same controls)', mine.effect === direct.did.effect && mine.lo === direct.did.lo && mine.hi === direct.did.hi && J(mine.controls_used) === J(direct.control_questions), J({ mine: [mine.effect, mine.lo, mine.hi], direct: direct.did }));
      const p45 = panel({ seed: 'eq45', lift: 0.15, days: 73 }); const m45 = ARL.didOf(p45.units, { questions: p45.T, controls: p45.C, engines: [], metric: 'named_rate', t0: p45.t0, now: p45.t0 + 45 * DAY, post_days: 45, seed: 'x', B: 500, id: 'x', lever: 'L05' });
      const raw = (qs, a0, a1) => { let k = 0, n = 0; for (const u of p45.units) { const t = Date.parse(u.at); if (qs.includes(u.prompt_id) && t > a0 && t <= a1) { n++; if (u.named) k++; } } return 100 * k / n; };
      const hand = (raw(p45.T, p45.t0, p45.t0 + 45 * DAY) - raw(p45.T, p45.t0 - 28 * DAY - 1, p45.t0 - 1)) - (raw(m45.controls_used, p45.t0, p45.t0 + 45 * DAY) - raw(m45.controls_used, p45.t0 - 28 * DAY - 1, p45.t0 - 1));
      check('AL7 a 45-day window: the post answers are scaled into AVX\'s equal windows and the DiD equals the hand difference of rates (28 days before, 45 after)', near(m45.effect, Math.round(10 * hand) / 10, 0.11) && m45.post_days === 45, J({ m45: m45.effect, hand })); }
    { const p = panel({ seed: 'pretrend', pretrend: 0.5, days: 84, t0: NOW - 28 * DAY }); p.units = p.units.map(u => Object.assign(u, { at: iso(Date.parse(u.at) - 28 * DAY) })); const a = actOf(p);
      // 84 days of answers: 56 before t0, 28 after; treated questions climb steadily over the whole period, controls flat
      const oc = ARL.outcome(a, { units60: p.units, diagNow: [], diagAtT0: [], arms: [], now: NOW, B: 1000 });
      check('AL7 the placebo in time flags questions that were already moving: the DiD alone would say "likely helped", the verdict is "can\'t tell"', oc.did && oc.did.lo > 0 && oc.placebo && oc.placebo.effect >= 0.5 * oc.did.effect && oc.verdict === 'cant_tell' && /already moving/.test(oc.why), J({ did: oc.did && [oc.did.effect, oc.did.lo, oc.did.hi], placebo: oc.placebo && [oc.placebo.effect, oc.placebo.p], v: oc.verdict })); }
    { let hit = 0; const NS = 30; for (let s = 0; s < NS; s++) { const p = panel({ seed: 'lift' + s, lift: 0.25 }); const oc = ARL.outcome(actOf(p), { units60: p.units, diagNow: [], diagAtT0: [], arms: [], now: NOW, B: 500 }); if (oc.verdict === 'likely_helped') hit++; }
      check('AL7 an injected lift of +25 points on 16 treated vs 8 control questions (24 answers each per 4 weeks) is found ("likely helped") in >= 90% of 30 seeded panels (' + hit + ' of 30)', hit >= 27, hit + ' of ' + NS); }
    { const fpr = (opts, NS) => { let fp = 0; for (let s = 0; s < NS; s++) { const p = panel(Object.assign({ seed: 'null' + J(opts) + s }, opts)); const oc = ARL.outcome(actOf(p), { units60: p.units, diagNow: [], diagAtT0: [], arms: [], now: NOW, B: 500 }); if (oc.verdict === 'likely_helped') fp++; } return fp / NS; };
      const f0 = fpr({}, 200), f1 = fpr({ trend: 0.10 }, 120), f2 = fpr({ qt: 8, qc: 4 }, 120);
      check('AL7 zero lift: false "likely helped" <= 5% of seeded panels (16 / 8 questions: ' + (100 * f0).toFixed(1) + '% of 200; with a +10 point trend on every question: ' + (100 * f1).toFixed(1) + '% of 120; 8 / 4 questions: ' + (100 * f2).toFixed(1) + '% of 120)', f0 <= 0.05 && f1 <= 0.05 && f2 <= 0.05, J({ f0, f1, f2 })); }

    // ================= AL8: Fisher through outcome() =================
    { const p = panel({ seed: 'fa', zero: true }); const app = new Set(p.T.slice(0, 7));
      for (const u of p.units) if (app.has(u.prompt_id) && Date.parse(u.at) > p.t0 && Date.parse(u.at) < p.t0 + 5 * DAY) u.named = true;
      const oc = ARL.outcome(actOf(p), { units60: p.units, diagNow: [], diagAtT0: [], arms: [], now: NOW, B: 300 }); const fa = oc.first_appearance;
      check('AL8 zero baseline: 7 of 16 worked-on questions appear for the first time, 0 of 8 held back -> one-sided Fisher p 0.033 (3 decimals), "likely helped" on the exact test; the answer-level binomial check is printed',
        fa.t.k === 7 && fa.t.n === 16 && fa.c.k === 0 && fa.c.n === 8 && fa.p_fisher.toFixed(3) === '0.033' && oc.primary === 'fisher' && oc.verdict === 'likely_helped' && fa.p_binom != null && fa.p_binom < 0.01, J({ fa, v: oc.verdict }));
      const p6 = panel({ seed: 'fa6', zero: true }); const a6 = new Set(p6.T.slice(0, 6)); for (const u of p6.units) if (a6.has(u.prompt_id) && Date.parse(u.at) > p6.t0 && Date.parse(u.at) < p6.t0 + 5 * DAY) u.named = true;
      const o6 = ARL.outcome(actOf(p6), { units60: p6.units, diagNow: [], diagAtT0: [], arms: [], now: NOW, B: 300 });
      { let fp = 0, fisherUsed = 0; const NS = 200; for (let s = 0; s < NS; s++) { const pz = panel({ seed: 'fanull' + s, zero: true, trend: 0.01 }); const oz = ARL.outcome(actOf(pz), { units60: pz.units, diagNow: [], diagAtT0: [], arms: [], now: NOW, B: 200 });
          if (oz.primary === 'fisher') fisherUsed++; if (oz.verdict === 'likely_helped') fp++; }
        check('AL8 zero baseline, no lift (every question, worked on or not, has the same 1% chance an answer names the business after t0): false "likely helped" <= 5% of 200 panels (' + (100 * fp / NS).toFixed(1) + '%, the exact test used in ' + fisherUsed + ')', fp / NS <= 0.05 && fisherUsed >= 150, J({ fp, fisherUsed })); }
      check('AL8 6 of 16 is not enough (p ' + o6.first_appearance.p_fisher + ' >= 0.05): "can\'t tell", with the count needed in the reason', o6.verdict === 'cant_tell' && o6.first_appearance.p_fisher >= 0.05 && /0\.05 needed/.test(o6.why), J(o6.first_appearance)); }

    // ================= AL9: learning =================
    { const mkO = (site, n, k, b, x) => ({ action: Object.assign({ action_id: 'air_' + site + '_L05_' + n + k, site_id: site, lever: 'L05', status: 'verified', learned_at: '' }, (x || {}).a || {}),
        outcome: Object.assign({ due: true, verdict: 'cant_tell', stage_moves: { k, n, b, by: [{ stage: 'S1', group: 'google', n, k, b, b_basis: 'control cells, same stage and engine group' }], cells: [] } }, (x || {}).o || {}) });
      const oA = mkO('site_a', 12, 6, 0.25), oB = mkO('site_b', 30, 20, 0);
      const rows = ARL.learn({ priors: [], outcomes: [oA, oB], now: NOW }); const g = rows.find(r => r.scope === 'global'), sa = rows.find(r => r.scope === 'site_a'), sb = rows.find(r => r.scope === 'site_b');
      // a0 = .2 x 6 = 1.2, b0 = 4.8; A: k_adj = 6 - 12 x .25 = 3, f = 9; B: k_adj 20 -> capped 10, f 10. Global 1.2 + 3 + 10 = 14.2 / 4.8 + 9 + 10 = 23.8
      // site A (leave-one-out): pool without A = 11.2 / 14.8, kappa 10 -> 4.3077 / 5.6923; + its own 3 / 9 -> 7.3077 / 14.6923
      check('AL9 background subtraction (k - n b), the per-site cap of 10 in the pool, and the hand case: global 14.2 / 23.8; site A 7.3077 / 14.6923 (pool without A, kappa 10, plus its own outcomes)',
        g && near(g.alpha, 14.2, 1e-6) && near(g.beta, 23.8, 1e-6) && g.prior_id === 'L05:S1:google:global' && g.n_outcomes === 2 && sa && near(sa.alpha, 7.3077, 1e-4) && near(sa.beta, 14.6923, 1e-4) && near(sa.prior_alpha, 4.3077, 1e-4)
        && sb && near(sb.alpha - sb.prior_alpha, 20, 1e-9) && near(sb.beta - sb.prior_beta, 10, 1e-9), J(rows));
      const pa = ARL.priorOf({ lever: 'L05', stage: 'S1', group: 'google', priors: rows, site_id: 'site_a' }), pg = ARL.priorOf({ lever: 'L05', stage: 'S1', group: 'google', priors: rows }), pe = ARL.priorOf({ lever: 'L05', stage: 'S1', group: 'google', priors: [] });
      check('AL9 priorOf: the site posterior (mean 0.3322, its 90% Beta interval exact), the pooled prior, the evidence prior (1.2 / 4.8) when nothing is learned',
        pa.source === 'site' && near(pa.mean, 7.3077 / 22, 1e-4) && near(cdfNum(7.3077, 14.6923, pa.lo90), 0.05, 1e-4) && near(cdfNum(7.3077, 14.6923, pa.hi90), 0.95, 1e-4) && pg.source === 'pooled' && near(pg.mean, 14.2 / 38, 1e-6)
        && pe.source === 'evidence' && pe.a === 1.2 && pe.b === 4.8, J({ pa, pg, pe }));
      const inc = ARL.learn({ priors: ARL.learn({ priors: [], outcomes: [oA], now: NOW }), outcomes: [oB], now: NOW });
      check('AL9 incremental = at once (the site rows keep their raw totals), and an outcome already learned is never counted twice', J(inc.find(r => r.scope === 'global')) === J(g) && ARL.learn({ priors: rows, outcomes: [mkO('site_a', 12, 6, 0.25, { a: { learned_at: iso(NOW) } })], now: NOW }).length === 0, J(inc.find(r => r.scope === 'global')));
      const skip = ARL.learn({ priors: [], outcomes: [mkO('s', 5, 5, 0, { o: { due: false } }), mkO('s', 5, 5, 0, { a: { status: 'done' } }), mkO('s', 5, 5, 0, { a: { lever: 'L11' } }), mkO('s', 5, 5, 0, { o: { stage_moves: { k: 5, n: 5, b: 0, by: [{ stage: 'S1', group: 'google', n: 5, k: 5, b: 0, b_basis: 'none' }] } } })], now: NOW });
      check('AL9 priors move only on due, happened actions with a control background: not due / not verified / site-wide (no control possible) / no background -> nothing learned', skip.length === 0, J(skip));
      const many = ARL.learn({ priors: [], outcomes: [mkO('big', 400, 400, 0)], now: NOW }).find(r => r.scope === 'global');
      check('AL9 one site cannot teach the whole system: 400 of 400 on one site moves the global prior by at most 10 successes', near(many.alpha, 1.2 + 10, 1e-9) && near(many.beta, 4.8, 1e-9), J(many)); }

    // ================= AL10: Brier =================
    { const it = (lever, p, ys) => ({ action: { lever, prereg: { projected: { p } } }, outcome: { due: true, stage_moves: { cells: ys.map(y => ({ reached: !!y })) } } });
      const b = ARL.brier([it('L05', 0.2, [1, 0, 0, 0]), it('L05', 0.2, [0, 0]), it('L08', 0.06, [0, 0, 0]), { action: { lever: 'L09', prereg: { projected: { p: 0.1 } } }, outcome: { due: false, stage_moves: { cells: [{ reached: true }] } } }]);
      check('AL10 Brier per lever: L05 (0.64 + 5 x 0.04) / 6 = 0.14, observed 1 of 6; L08 0.0036; a window not ended is not scored', near(b.by_lever.L05.brier, 0.14, 1e-9) && near(b.by_lever.L05.observed, 1 / 6, 1e-4) && near(b.by_lever.L08.brier, 0.0036, 1e-9) && !b.by_lever.L09, J(b)); }

    // ================= AL11: the memo =================
    const memoIn = () => { const prev = [dg('q1', 'recommendation', { chatgpt: cell('S1'), perplexity: cell('S1') }), dg('q2', 'recommendation', { chatgpt: cell('S1'), perplexity: cell('S1') }), dg('q3', 'informational', { chatgpt: cell('S2'), perplexity: cell('S5') })];
      const now_ = [dg('q1', 'recommendation', { chatgpt: cell('S4', 'weak'), perplexity: cell('S1') }), dg('q2', 'recommendation', { chatgpt: cell('S2'), perplexity: cell('S1') }), dg('q3', 'informational', { chatgpt: cell('S2'), perplexity: cell('S5') })];
      const act = { action_id: 'air_s_L08_aa', lever: 'L08', status: 'verified', questions: '["q1"]', engines: '["chatgpt"]', created_at: iso(NOW - 40 * DAY), prereg: { registered_at: iso(NOW - 40 * DAY), projected: { p: 0.06 } } };
      const oc = { due: true, verdict: 'likely_helped', stage_moves: { k: 1, n: 2, b: 0, by: [{ stage: 'S1', group: 'chatgpt', n: 2, k: 1, b: 0 }], cells: [] }, did: { effect: 12.5, lo: 2.1, hi: 22.4 } };
      return { site: { site_id: 'site_m-example' }, diagNow: now_, diagPrev: prev, chosen: preR.chosen.slice(0, 3), open: [act, { action_id: 'air_s_L09_bb', lever: 'L09', status: 'queued', questions: '[]', engines: '[]', created_at: iso(NOW - 9 * DAY) }],
        outcomes: [{ action: act, outcome: oc }], mde: ST.mde({ q_t: 16, q_c: 8, m: 24, p: 0.02, rho: 0.3 }), blockers: [{ what: 'connect a mailbox', owner: 'client', since: iso(NOW - 20 * DAY), blocks: '0 placement pitches can be sent until a mailbox is connected' }],
        cost: { usd: 3.2, minutes: 120, H: 25 }, old: ARL.compareOld({ chosen: preR.chosen, old: { targets: [{ prompt_id: 'c1', kind: 'answer', keyword: 'custom software c1' }], earned: [{ url: coldSources[0].url }], actions: [] } }), mode: 'shadow' }; };
    { const me = ARL.memo(memoIn()); const txt = J(me); const plain = me.parts.map(p => p.lines.map(l => l.text).join(' | ')).join(' || '); const figs = me.parts.flatMap(p => p.lines.flatMap(l => l.figures));
      check('AL11 the memo has the seven parts of 2.H in order, each with lines; blockers listed with owner and date', J(me.parts.map(p => p.key)) === J(ARL.MEMO_PARTS) && me.parts.every(p => p.lines.length) && me.blockers.length === 1 && me.blockers[0].owner === 'client', J(me.parts.map(p => [p.key, p.lines.length])));
      check('AL11 every figure carries a basis; the copy rule (no em dash, curly quote or ellipsis character); no claim of cause', figs.length >= 15 && figs.every(f => f.basis && f.basis !== 'not stated') && !/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/.test(txt) && !/\bcaus(ed|es)\b|\bproves?\b|\bguarantee/i.test(txt.replace(/not proof of cause/g, '')), J({ n: figs.length, nobasis: figs.filter(f => !f.basis || f.basis === 'not stated'), cause: (txt.match(/.{60}\b(caus(ed|es)|proves?|guarantee).{20}/gi) || []) }));
      check('AL11 the content: a stage move with its "from" and "to", the verified action it followed, the MDE and the first-appearance k, the verdict in plain words, cost per won question "not yet"',
        /Question q1 on ChatGPT: up from "not found" to "named, weak or wrong"/.test(plain) && /after "Placement on an editorial list the answers cite", which our check found done/.test(plain) && /about 7 of them must name you for the first time/.test(plain)
        && /Verdict: likely helped/.test(plain) && /Not yet: no question has been won/.test(plain) && /share \d/.test(plain), J([/Question q1 on ChatGPT: up from "not found" to "named, weak or wrong"/.test(plain), /after "Placement on an editorial list the answers cite", which our check found done/.test(plain), /about 7 of them must name you for the first time/.test(plain), /Verdict: likely helped/.test(plain), /Not yet: no question has been won/.test(plain), /share \d/.test(plain)]) + ' ' + me.parts.map(p => p.lines.map(l => l.text).join(' | ')).join(' || ')); }

    // ================= AL12: compareOld =================
    { const ch = [{ lever: 'L05', ref: { prompt_id: 'q1' }, executor: 'approve', expected: { gain: 0.05 } }, { lever: 'L08', ref: { url: 'https://list.example/top' }, executor: 'approve', expected: { gain: 0.08 } }, { lever: 'L03', ref: {}, executor: 'human', expected: { gain: 0.02 } }];
      const old = { targets: [{ prompt_id: 'q1', kind: 'answer', keyword: 'erp q1' }, { prompt_id: 'q2', kind: 'answer', keyword: 'best erp partners riyadh', page_type: 'listicle' }], earned: [{ url: 'https://list.example/top/' }, { url: 'https://other.example/a' }], actions: [{ type: 'ai', action: 'Add llms.txt' }],
        scored: [{ lever: 'L05', ref: { prompt_id: 'q2' }, scored: { gain: 0.03 } }, { lever: 'L08', ref: { url: 'https://other.example/a' }, scored: { gain: 0.01 } }] };
      const co = ARL.compareOld({ chosen: ch, old });
      check('AL12 overlap = shared refs / all refs (2 of 6), both plans\' gains in AIR\'s model (old: 0.05 + 0.03 + 0.08 + 0.01 = 0.17), the R4 causes, a self-ranked list in the old plan refused with its reason',
        co.overlap === +(2 / 6).toFixed(4) && co.overlap_n === 2 && near(co.gain_air, 0.15, 1e-9) && near(co.gain_old, 0.17, 1e-9) && J(co.causes.air) === J([1, 2, 5, 6]) && J(co.causes.old) === J([1, 2]) && co.refused_old.some(r => r.id === 'R01') && /not independent/.test(co.note), J(co)); }

    // ================= AL13: determinism, order, sandbox, speed =================
    { const run1 = () => { const c = ARL.candidates({ site: coldSite, diag: coldDiag, sources: coldSources, arms: coldArms, stored_actions: [], settings: {}, now: NOW }); const s = scoreAll(c, coldVals, coldFeas); const r = ARL.choose(s, { arms: coldArms, mode: 'shadow', open_actions: [], now: NOW, units60: [] }); return { c, r, m: ARL.memo(Object.assign(memoIn(), { chosen: r.chosen })) }; };
      const a = run1(), b = run1(); const sh = ARL.choose(scoreAll(ARL.candidates({ site: coldSite, diag: coldDiag.slice().reverse(), sources: coldSources.slice().reverse(), arms: coldArms.slice().reverse(), now: NOW }), coldVals, coldFeas), { arms: coldArms, mode: 'shadow', open_actions: [], now: NOW, units60: [] });
      check('AL13 same input, same output (candidates, choice, pre-registrations, memo byte-identical); the order of the inputs does not change the choice', J(a) === J(b) && J(sh.chosen.map(x => x.action_id)) === J(a.r.chosen.map(x => x.action_id)), '');
      const src = rdf('_ai_rank_learn.js');
      check('AL13 sandbox: no URL constructor, no Object.defineProperty / setPrototypeOf, no structuredClone, no build placeholder, ASCII only', !/new URL\(|defineProperty|setPrototypeOf|structuredClone|\/\*__/.test(src) && !/[^\x00-\x7f]/.test(src), '');
      const big = [], bigS = [], bigV = new Map(), bigF = new Map(); for (let i = 0; i < 30; i++) { const q = 'b' + i; big.push(dg(q, i % 4 ? 'recommendation' : 'informational', Object.fromEntries(['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot', 'chatgpt_api'].map((e, j) => [e, cell(['S0', 'S1', 'S2', 'S3', 'S4', 'S5'][(i + j) % 6], (i + j) % 6 === 0 ? ['blocked', 'js_only', 'not_indexed'][i % 3] : '')]))));
        bigV.set(q, { V: 1 + (i % 5) / 4 }); bigF.set(q, { F: 0.5 }); }
      for (let k = 0; k < 200; k++) bigS.push({ url: 'https://s' + k + '.example/p', page_type: ['listicle', 'directory', 'review', 'registry', 'community', 'video', 'news'][k % 7], author_kind: k % 11 ? 'editorial' : 'rival', names_client: false, questions: ['b' + (k % 30), 'b' + ((k * 7) % 30)], engines: ['chatgpt', 'perplexity', 'ai_mode'], placeability: [0.15, 0.8, 0.8, 0.5, 0.3, 0.1, 0.05][k % 7] });
      const t0 = Date.now(); const bc = ARL.candidates({ site: { site_id: 's', domain: 'big.example' }, diag: big, sources: bigS, arms: big.map((d, i) => ({ prompt_id: d.prompt_id, arm: i % 3 === 2 ? 'control' : 'treated' })), now: NOW });
      const br = ARL.choose(scoreAll(bc, bigV, bigF), { mode: 'on', arms: [], open_actions: [], now: NOW, units60: [] }); const ms = Date.now() - t0;
      check('AL13 speed: 30 questions x 8 engines x 200 cited pages -> candidates, scores and the choice in under 500 ms (' + ms + ' ms, ' + bc.length + ' candidates)', ms < 500 && bc.length > 50 && br.chosen.length > 0, ms); }

    // ================= AL14: the archetypes with P1's real kit =================
    { const FX = require('./fixtures_air'); const f = FX.make({ seed: 'al14' }); const T = f.tables;
      const probe = ARD.diagnose({ site: {}, prompt: { prompt_id: 'p' }, answers8: [], units60: [], evidence: '', access: {}, pages: [], index: { google: new Map(), bing: { in_account: null, crawled: new Map() }, brave: null, cc_captures: null }, serp: new Map(), now: NOW, cfg: {} });
      if (probe.unavailable) console.log('   note AL14: ARD is still the W0 skeleton (diagnose returns unavailable); the archetype run with P1\'s real kit starts when P1 merges (DESIGN 6.3 AL14)');
      else {
        const res = {}; for (const A of f.sites) { const sid = A.site_id; const host = A.domain; const answers = T.seo_ai_answers.filter(a => a.site_id === sid && Date.parse(a.checked_at) > NOW - 8 * DAY);
          const vis = T.seo_ai_visibility.filter(r => r.site_id === sid); const daily = T.seo_ai_daily.filter(r => r.site_id === sid);
          const units60 = AVX.history({ rule: f.AIV_RULE, from: iso(NOW - 60 * DAY), to: iso(NOW + 1), vis_rows: vis, daily_rows: daily }).units;
          const prompts = T.seo_ai_prompts.filter(p => p.site_id === sid && p.kind !== 'brand');
          const idxG = new Map(T.seo_index_pages.filter(r => r.site_id === sid).map(r => [AIRF.urlKey(r.url), r.state]));
          const index = { google: idxG, bing: { in_account: f.bing.sites.some(s => s.indexOf(host) >= 0), crawled: new Map(Object.entries(f.bing.crawled).filter(([u]) => u.indexOf(host) >= 0).map(([u, t]) => [AIRF.urlKey(u), t])) }, brave: null, cc_captures: null };
          const serp = new Map(T.seo_cache.filter(c => /^serp:/.test(c.key)).map(c => { const v = JSON.parse(c.value); return [String(v.keyword).toLowerCase(), { results: v.items.map(i => ({ url: i.url, pos: i.rank_group })), read_at: v.at, location_code: v.location_code }]; }));
          const access = { robots: {}, blocked_engines: [], read_at: iso(NOW) }; const pages = T.seo_ai_pages.filter(r => r.site_id === sid);
          const rivals = T.seo_sites.find(s => s.site_id === sid).competitors.split(', ');
          const diag = prompts.map(p => ARD.diagnose({ site: T.seo_sites.find(s => s.site_id === sid), prompt: p, answers8: answers.filter(a => a.prompt_id === p.prompt_id), units60: units60.filter(u => u.prompt_id === p.prompt_id), evidence: '', access, pages, index, serp, brandKnown: {}, ourHosts: [host], rivals, engines: AIRF.ENGINES, now: NOW, cfg: {} }));
          const sources = ARD.sources({ answers8: answers, storedSources: [], mentionsPages: [], fetched: Object.entries(f.pages).map(([url, pg]) => ({ url, status: pg.status, html: pg.html })), prompts, values: {}, rivals, ourHosts: [host], now: NOW });
          const mk = ARD.market({ site: T.seo_sites.find(s => s.site_id === sid), ladders: T.seo_ladders.filter(l => l.domain === host), tracked: [], monitors: T.seo_monitors.find(m => m.site_id === sid), profile: T.seo_profiles.find(p => p.site_id === sid), gscCountries: [] });
          const arms = ARD.assignArms({ core: prompts.map(p => ({ prompt_id: p.prompt_id, core_since: iso(NOW) })), stored: [], seed: 'al14', now: NOW });
          const vals = new Map(prompts.map(p => [p.prompt_id, ARL.value({ prompt: p, intent: (diag.find(d => d.prompt_id === p.prompt_id) || {}).intent })]));
          const feas = new Map(prompts.map(p => [p.prompt_id, ARL.feasibility({ prompt: p, market: mk, diag: { rivals_median: ARL.rivalsMedian(answers.filter(a => a.prompt_id === p.prompt_id)) }, reach: null })]));
          const c = ARL.candidates({ site: { site_id: sid, domain: host, prompts, pages }, diag, sources, arms, stored_actions: [], settings: {}, now: NOW });
          const r = ARL.choose(scoreAll(c, vals, feas), { arms, mode: 'shadow', open_actions: [], now: NOW, units60 });
          res[host] = { top5: r.chosen.slice().sort((x, y) => y.expected.score - x.expected.score).slice(0, 5), chosen: r.chosen,
            core: ARD.corePanel({ site: T.seo_sites.find(s => s.site_id === sid), prompts: T.seo_ai_prompts.filter(p => p.site_id === sid), units60, stored: [], market: mk, demand: {}, now: NOW, cfg: {} }) }; }
        const nv = res['nova-ai.example'], ac = res['acme-erp.example'];
        check('AL14 cold-start archetype (P1\'s real diagnosis): the top 5 includes a list or directory placement and the Bing step, and no rewrite of the homepage',
          nv.top5.some(a => ['L08', 'L09'].includes(a.lever)) && nv.top5.some(a => a.lever === 'L03') && !nv.top5.some(a => a.lever === 'L06' && /^https:\/\/nova-ai\.example\/?$/.test(a.page_url)), J(nv.top5.map(a => [a.lever, a.page_url])));
        check('AL14 retrievable archetype: its cited informational page is protected, an own-page action for informational searches, the winning question kept (extend)',
          ac.chosen.some(a => a.lever === 'L16' && /erp-implementation-cost/.test(a.page_url)) && ac.chosen.some(a => ['L05', 'L06'].includes(a.lever) && a.intent === 'informational') && ac.core.extend.some(x => x.prompt_id === 'aq1'), J({ chosen: ac.chosen.map(a => [a.lever, a.intent, a.page_url]), extend: ac.core.extend })); } }
  });
};
if (require.main === module) { const results = []; const H = { results };
  module.exports({ H, guard: async (n, fn) => { try { await fn(); } catch (e) { console.log('ABORT ' + n + ': ' + (e.stack || e)); results.push({ ok: false }); } }, reset: () => {}, begin: (s) => console.log('\n' + s) })
    .then(() => { const f = results.filter(r => !r.ok).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); }); }
