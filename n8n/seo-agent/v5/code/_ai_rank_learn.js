// ---- ARL: the AI-ranking decision and learning kit (inlined by build_monitors.py through its marker, after AIRF and ARD) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md 2.D-2.H, interface frozen in CONTRACTS.md 3.3). OWNER: package P2 (fixes/P2.md).
//   D  the lever library (17 levers: Beta prior, engine multipliers, one step per from stage in `next`), the refused tactics, the zero-weight items
//   E  value, feasibility, the prior of a cell, candidates, score, greedy choice under the weekly caps, pre-registration
//   G  verify (our own check that the action happened, timed from live_at for pages), outcome (stage moves net of the control background,
//      difference in differences through AVX.impact, a placebo in time, Fisher's exact first-appearance test), pooled Beta-binomial learning
//   H  the weekly memo (seven parts, every figure with its basis) and the comparison with the old logic
// Pure: no $(...), no network, no clock (`now` comes in, ms or ISO). n8n sandbox: no URL constructor, no property-descriptor or prototype setters,
// no structured cloning. Needs AIRF in scope. Uses AVX (v5/code/_ai_measure.js) for the difference in differences when the node inlines it
// (`/*` + `__AI_MEASURE__*/` before this kit); without AVX the DiD says so and nothing else changes.
// Wording rule: nothing here claims a cause. Verdicts are "likely helped", "can't tell", "no effect seen", "did not happen", "not due yet".
//
// Inputs beyond the frozen signatures (all optional; documented in fixes/P2.md for P4):
//   candidates: site = { site_id, domain, hosts: [host], prompts: [seo_ai_prompts rows], pages: [seo_ai_pages rows] };
//               settings = { pitch_rival_urls: [url] } (owner opt-in per page; rival lists are learn-only by default)
//   feasibility: diag.rivals_median (median competitors named per answered answer; ARL.rivalsMedian(answers) computes it)
//   choose: { now, units60 } pre-registers every chosen action before it is returned (no sink is written before that)
//   outcome: { B } bootstrap draws (default 2000), { verified } the verify result when the action row is not marked verified
const ARL = (() => {
  const VERSION = 'air-1';
  const RULE = AIRF.RULE_VERSION;
  const DAY = 864e5;
  const S = (v) => (v == null ? '' : String(v)).trim();
  const N = (v, d) => { const x = Number(v); return v !== null && v !== '' && isFinite(x) ? x : d; };
  const rd = (x, k) => { const f = Math.pow(10, k == null ? 6 : k); return Math.round(x * f) / f; };
  const pct1 = (x) => Math.round(1000 * x) / 10;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const msOf = (t) => (typeof t === 'number' ? t : Date.parse(S(t)));
  const isoOf = (t) => { const x = msOf(t); return isFinite(x) ? new Date(x).toISOString() : ''; };
  const parse = (v, d) => { if (v && typeof v === 'object') return v; const s = S(v); if (!s) return d; try { const x = JSON.parse(s); return x == null ? d : x; } catch (e) { return d; } };
  const mget = (m, k) => (m == null ? undefined : typeof m.get === 'function' ? m.get(k) : m[k]);
  const arr = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? parse(v, S(v) ? S(v).split(/\s*,\s*/) : []) : []);
  const uniq = (xs) => [...new Set(xs)];
  const lvl = (s) => { const i = AIRF.STAGES.indexOf(S(s)); return i; };
  const avx = () => { try { return typeof AVX !== 'undefined' && AVX && typeof AVX.impact === 'function' ? AVX : null; } catch (e) { return null; } };
  const hostOf = (u) => S(u).toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[\/?#:].*$/, '').replace(/^www\./, '');

  // ================================================================ statistics (exact where it matters; checked by harness AL-STAT)
  const LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  /** log Gamma (Lanczos, g = 7): relative error below 1e-13 for z > 0 */
  const lgamma = (z) => { if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
    const x0 = z - 1; let x = LZ[0]; for (let i = 1; i < 9; i++) x += LZ[i] / (x0 + i); const t = x0 + 7.5; return 0.5 * Math.log(2 * Math.PI) + (x0 + 0.5) * Math.log(t) - t + Math.log(x); };
  const logC = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1));
  /** the continued fraction of the incomplete beta function (modified Lentz) */
  const betacf = (a, b, x) => { const FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break; }
    return h; };
  /** the regularised incomplete beta I_x(a, b) = P(Beta(a, b) <= x) */
  const ibeta = (x, a, b) => { if (!(a > 0 && b > 0)) return NaN; if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; };
  /** the q quantile of Beta(a, b), by bisection on ibeta (monotone; 80 halvings = machine precision) */
  const betaInv = (q, a, b) => { if (!(a > 0 && b > 0)) return null; if (q <= 0) return 0; if (q >= 1) return 1; let lo = 0, hi = 1;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (ibeta(mid, a, b) < q) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  /** standard normal CDF (erfc by its Chebyshev fit, |error| < 1.2e-7) and quantile (Acklam, |relative error| < 1.2e-9) */
  const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r; };
  const normCdf = (z) => 0.5 * erfc(-z / Math.SQRT2);
  const normInv = (p) => { if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); };
  /** P(X >= k) for X hypergeometric: n draws from N items of which K are "successes" */
  const hyperUpper = (k, Nn, K, n) => { if (!(Nn > 0) || n < 0 || K < 0 || n > Nn || K > Nn) return null; const lo = Math.max(0, n - (Nn - K)), hi = Math.min(K, n); if (k <= lo) return 1; if (k > hi) return 0;
    const den = logC(Nn, n); let p = 0; for (let x = k; x <= hi; x++) p += Math.exp(logC(K, x) + logC(Nn - K, n - x) - den); return Math.min(1, p); };
  /** one-sided Fisher exact test on question counts: kt of nt treated questions appeared, kc of nc control questions. P(treated >= kt | margins) */
  const fisher = (kt, nt, kc, nc) => (nt > 0 && nc > 0 ? hyperUpper(kt, nt + nc, kt + kc, nt) : null);
  /** P(X >= x) for X ~ Bin(n, p) */
  const binomUpper = (x, n, p) => { if (!(n >= 0) || !(p >= 0 && p <= 1)) return null; if (x <= 0) return 1; if (x > n) return 0; if (p === 0) return 0; if (p === 1) return 1;
    let s = 0; for (let i = x; i <= n; i++) s += Math.exp(logC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p)); return Math.min(1, s); };
  /** the smallest number k of first appearances that, all on treated questions, gives a one-sided Fisher p below alpha: C(qt, k) / C(qt + qc, k) */
  const firstK = (qt, qc, alpha) => { const a = alpha == null ? 0.05 : alpha; for (let k = 1; k <= qt; k++) { const p = Math.exp(logC(qt, k) - logC(qt + qc, k)); if (p < a) return { k, p }; } return { k: null, p: null }; };
  /** DESIGN A7 / R1 6: minimum detectable effect in POINTS of the rate. n_eff(Q) = Q m / (1 + (m - 1) rho); z = z(1 - alpha/2) + z(power) (2.80 at 0.05 / 0.8);
   *  pre/post z sqrt(2 p(1-p) / n_eff(Qt)), DiD z sqrt(2 p(1-p) (1/n_eff(Qt) + 1/n_eff(Qc))), a zero baseline planned at 2% */
  const mde = ({ q_t, q_c, m, p, rho, alpha, power } = {}) => { const a = alpha == null ? 0.05 : alpha, pw = power == null ? 0.8 : power; const qt = N(q_t, 0), qc = N(q_c, 0), mm = N(m, 0), r = clamp(N(rho, 0.3), 0, 1);
    const pu = Math.max(N(p, 0), 0.02); const z = normInv(1 - a / 2) + normInv(pw); const ne = (Q) => (Q > 0 && mm > 0 ? Q * mm / (1 + (mm - 1) * r) : 0);
    const nt = ne(qt), nc = ne(qc); const v = 2 * pu * (1 - pu); const fk = firstK(qt, qc, a);
    return { prepost: nt > 0 ? rd(100 * z * Math.sqrt(v / nt), 2) : null, did: nt > 0 && nc > 0 ? rd(100 * z * Math.sqrt(v * (1 / nt + 1 / nc)), 2) : null, n_eff_t: rd(nt, 2), n_eff_c: rd(nc, 2), p_used: pu,
      first_appearance_k: fk.k, first_appearance_p: fk.p == null ? null : rd(fk.p, 4), z: rd(z, 4),
      basis: qt + ' treated and ' + qc + ' control questions, ' + mm + ' answers each per 4 weeks, intra-question correlation ' + r + ', 80% power, 5% two-sided' + (N(p, 0) < 0.02 ? ', baseline planned at 2%' : '') }; };
  const STATS = { lgamma, logC, ibeta, betaInv, normCdf, normInv, hyperUpper, fisher, binomUpper, firstK, mde };

  // ================================================================ D. the lever library
  // lever: { id, label, from: [stage], to: stage (the highest it reaches), next: { from: to } (one step per from stage), sub: [S0 sub-label] (empty = any),
  //   mult: { engine: number } (an engine not listed takes the '*' value when the lever has one, else 1), prior: { mean, n0 } (null = never proposed until its
  //   gate holds), days: [min, typ, max] (null = not applicable), usd, effort_min, executor: auto | approve | human, scope: question | page | site,
  //   sink: ai_target | prospect | listing | growth_action | site_task | protect | existing, sink_wave2: the wave-2 sink when it moves, evidence: [keys]
  // P2 corrections to the W0 figures (fixes/P2.md 2): L03 and L04 act only on the engines whose index they fix ('*': 0); L09 effort 90 -> 60 minutes
  // (R1: "low for the profile"); L13 / L14 are proposed only for questions whose cited pages are community threads / videos.
  const G3 = { ai_mode: 1, ai_overview: 1, gemini: 1 };
  const LEVERS = [
    { id: 'L01', label: 'Unblock AI bots in robots.txt', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['blocked'], mult: { '*': 1 }, prior: { mean: 0.90, n0: 10 }, days: [1, 2, 7], usd: 0, effort_min: 15, executor: 'human', scope: 'site', sink: 'existing', sink_wave2: 'existing', evidence: ['E11', 'E8'] },
    { id: 'L02', label: 'Content in raw HTML (server render)', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['js_only'], mult: { chatgpt: 1, perplexity: 1, claude: 1, ai_mode: 0.3, ai_overview: 0.3, gemini: 0.3 }, prior: { mean: 0.70, n0: 6 }, days: [7, 14, 45], usd: 0, effort_min: 240, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E23'] },
    { id: 'L03', label: 'Add the site to Bing Webmaster and submit', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['not_indexed'], mult: { '*': 0, copilot: 1, chatgpt: 0.2, chatgpt_api: 0.2 }, prior: { mean: 0.85, n0: 8 }, days: [2, 10, 30], usd: 0, effort_min: 20, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E13', 'R4'] },
    { id: 'L04', label: 'Get the page indexed in Google', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['not_indexed'], mult: Object.assign({ '*': 0 }, G3), prior: { mean: 0.50, n0: 6 }, days: [7, 21, 60], usd: 0, effort_min: 30, executor: 'human', scope: 'page', sink: 'existing', sink_wave2: 'existing', evidence: ['E8'] },
    { id: 'L05', label: 'Own answer page for the searches the engines run', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 1, chatgpt_api: 1, perplexity: 1, copilot: 0.8, claude: 0.6 }, prior: { mean: 0.20, n0: 6 }, days: [14, 45, 90], usd: 0.80, effort_min: 20, executor: 'approve', scope: 'question', sink: 'ai_target', sink_wave2: 'ai_target', evidence: ['E20', 'E19', 'E24', 'E9'] },
    { id: 'L06', label: 'Refresh the ranking page for the searches the engines run', from: ['S1', 'S2'], to: 'S3', next: { S1: 'S2', S2: 'S3' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 1, chatgpt_api: 1, perplexity: 1, copilot: 0.8, claude: 0.6 }, prior: { mean: 0.25, n0: 6 }, days: [7, 30, 60], usd: 0.80, effort_min: 20, executor: 'approve', scope: 'question', sink: 'ai_target', sink_wave2: 'ai_target', evidence: ['E20', 'OT2'] },
    { id: 'L07', label: 'Cited but not named: fix the passage', from: ['S3'], to: 'S4', next: { S3: 'S4' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.35, n0: 5 }, days: [7, 21, 45], usd: 0, effort_min: 20, executor: 'approve', scope: 'question', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['GG1', 'E20'] },
    { id: 'L08', label: 'Placement on an editorial list the answers cite', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S4', S2: 'S4' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, perplexity: 1.2, chatgpt: 1, chatgpt_api: 1, claude: 0.8 }, prior: { mean: 0.06, n0: 8 }, days: [14, 30, 90], usd: 0.02, effort_min: 30, executor: 'approve', scope: 'page', sink: 'prospect', sink_wave2: 'prospect', evidence: ['E26', 'E25', 'E7', 'E20'] },
    { id: 'L09', label: 'Directory profile on a directory the answers cite', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S2', S2: 'S4' }, sub: [], mult: { perplexity: 1.5, ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 0.8, chatgpt_api: 0.8 }, prior: { mean: 0.08, n0: 5 }, days: [14, 45, 90], usd: 0, effort_min: 60, executor: 'human', scope: 'page', sink: 'listing', sink_wave2: 'listing', evidence: ['EX6', 'EX8', 'E31', 'R4'] },
    { id: 'L10', label: 'Registry or partner listing (eligible only)', from: ['S1'], to: 'S4', next: { S1: 'S4' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.15, n0: 4 }, days: [30, 60, 120], usd: 0, effort_min: 120, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['R4'] },
    { id: 'L11', label: 'Earned mention (press, partner, customer case)', from: ['S1', 'S2', 'S3', 'S4'], to: 'S4', next: { S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' }, sub: [], mult: { chatgpt: 1.2, chatgpt_api: 1.2, claude: 1.2 }, prior: { mean: 0.05, n0: 4 }, days: [30, 60, 180], usd: 0, effort_min: 240, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E18', 'E5', 'E6', 'E21'] },
    { id: 'L12', label: 'LinkedIn article by a named person', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S2', S2: 'S4' }, sub: [], mult: { chatgpt: 1.2, chatgpt_api: 1.2, ai_mode: 1.2 }, prior: { mean: 0.05, n0: 4 }, days: [7, 21, 45], usd: 0, effort_min: 90, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E29'] },
    { id: 'L13', label: 'Disclosed community answer', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { perplexity: 1.5, ai_overview: 1, chatgpt: 0.5, chatgpt_api: 0.5 }, prior: { mean: 0.03, n0: 3 }, days: [3, 14, 45], usd: 0, effort_min: 45, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E32', 'E6', 'E15'] },
    { id: 'L14', label: 'Video for the question', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { ai_overview: 1.3, perplexity: 1.2 }, prior: { mean: 0.03, n0: 3 }, days: [14, 45, 90], usd: 0, effort_min: 300, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E9'] },
    { id: 'L15', label: 'Correction (own page or ask the source)', from: ['S4'], to: 'S5', next: { S4: 'S5' }, sub: ['wrong'], mult: { '*': 1 }, prior: { mean: 0.30, n0: 4 }, days: [14, 30, 60], usd: 0.02, effort_min: 20, executor: 'approve', scope: 'question', sink: 'existing', sink_wave2: 'existing', evidence: ['PE1'] },
    { id: 'L16', label: 'Protect a cited page; refresh it when citations decay', from: ['S5'], to: 'S5', next: { S5: 'S5' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.50, n0: 4 }, days: null, usd: 0, effort_min: 0, executor: 'auto', scope: 'page', sink: 'protect', sink_wave2: 'protect', evidence: ['E33'] },
    { id: 'L17', label: 'Wikidata / Wikipedia entity', from: ['S1', 'S2', 'S3', 'S4'], to: 'S4', next: {}, sub: [], mult: { '*': 0, chatgpt: 1, chatgpt_api: 1, claude: 1 }, prior: null, gate: 'three independent earned mentions on file (notability, E36)', days: null, usd: 0, effort_min: 0, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E36', 'E35'] }
  ];
  const LV = new Map(LEVERS.map(l => [l.id, l]));
  // the refused tactics: never chosen whatever their score (weight 0); `match` finds them in the old logic's plan (compareOld) so the reason is printed
  const REFUSED = [
    { id: 'R01', label: 'Self-ranked "best X" list', why: 'the self-promoter is left out of the answers 69% to 83% of the time', evidence: ['E26'], weight: 0, match: '\\b(best|top \\d+|top ten|leading)\\b.*\\b(companies|providers|agencies|partners|firms|vendors)\\b' },
    { id: 'R02', label: 'AI-only or agent-only page version without parity', why: 'near cloaking', evidence: ['AD1'], weight: 0, match: '\\b(ai[- ]only|for (ai|llm|bots?) only|agent[- ]only)\\b' },
    { id: 'R03', label: 'Paid placement without disclosure', why: 'link spam by Google\'s own rules', evidence: ['R2'], weight: 0, match: '\\b(paid placement|sponsored (post|placement)|buy (a )?(link|placement))\\b' },
    { id: 'R04', label: 'Prompt-injection text on a page', why: 'manipulates the engines; engines treat it as an attack', evidence: ['E13'], weight: 0, match: '\\b(prompt injection|hidden (text|instructions) for (ai|llm))\\b' },
    { id: 'R05', label: 'Fake reviews', why: 'deceptive and against every platform\'s rules', evidence: ['R2'], weight: 0, match: '\\b(fake|seeded|incentivi[sz]ed) reviews?\\b' },
    { id: 'R06', label: 'Astroturfed community posts', why: 'undisclosed promotion; removed and penalised by the communities', evidence: ['E41'], weight: 0, match: '\\b(astroturf|sock ?puppet|undisclosed (post|answer))' }
  ];
  const ZERO_WEIGHT = ['schema', 'llms_txt'];
  const U = { S0: 0, S1: 0.03, S2: 0.15, S3: 0.25, S4: 0.45, S5: 0.8 };
  const VERDICTS = ['likely_helped', 'cant_tell', 'no_effect', 'not_happened', 'not_due'];
  const VERDICT_WORDS = { likely_helped: 'likely helped', cant_tell: 'can\'t tell', no_effect: 'no effect seen', not_happened: 'did not happen', not_due: 'not due yet' };
  const ELIG = ['L01', 'L02', 'L03', 'L04'];
  const OWN_PAGE = ['L05', 'L06'];
  const SITE_WIDE = ['L11', 'L12', 'L13', 'L14', 'L17'];
  const HUMAN_NEW = ['L02', 'L03', 'L07', 'L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L17'];   // DESIGN 2.E "new human steps" (L01 / L04 ride existing site tasks)
  const LONG_RUN = ['L11', 'L12', 'L17'];   // the only levers that can reach a question an engine answers from memory (no_search)
  const ENGINE_W = { chatgpt: 0.30, ai_overview: 0.15, ai_mode: 0.15, gemini: 0.10, perplexity: 0.12, copilot: 0.10, claude: 0.08, chatgpt_api: 0 };
  const CAPS = { own_pages: 1, pitches: 5, human_new: 3, human_open_max: 8, protect: 10, min_gain: 0.02 };
  const OPEN = ['proposed', 'queued', 'in_progress', 'done'];
  const ENGINE_NAMES = { chatgpt: 'ChatGPT', gemini: 'Gemini', ai_mode: 'Google AI Mode', ai_overview: 'Google AI Overviews', perplexity: 'Perplexity', claude: 'Claude', copilot: 'Copilot', chatgpt_api: 'ChatGPT (API)' };
  const STAGE_WORDS = { S0: 'cannot be read', S1: 'not found', S2: 'found, not cited', S3: 'cited, not named', S4: 'named, weak or wrong', S5: 'won', unmeasured: 'not measured' };
  // AIR's cost constants, shared with the app through harness/ai_rank_cost_cases.json (AL1 regenerates and compares; P6 reads it)
  const COST = { H: 25, overhead_usd: 0.5, credits_per_usd: 60, page_usd: 0.80, reserve_pages_month: 2, fanout_read_usd: 0.002, mentions_task_usd: [0.10, 0.20], mentions_tasks_month: 2 };
  const multOf = (lever, engine) => { const m = (lever && lever.mult) || {}; return engine in m ? N(m[engine], 1) : '*' in m ? N(m['*'], 1) : 1; };
  const costOf = (lever, H) => rd(N(lever.usd, 0) + N(lever.effort_min, 0) / 60 * (H == null ? COST.H : H) + COST.overhead_usd, 4);

  // ================================================================ E. value, feasibility, priors
  const INTENT_W = { recommendation: 1.0, informational: 0.6, unknown: 0.8, brand: 0 };
  const BUYER_W = { decision: 1.0, consideration: 0.8, awareness: 0.6 };
  /** V(q) = demand_w * intent_w * stage_w; demand_w = 1 + log10(1 + vol) / 2 (A5: AI search volume, else Search Console impressions x 12 / 28, else 0) */
  const value = ({ prompt, demand, intent, stage } = {}) => { const p = prompt || {}; let vol = 0, src = '';
    const d = demand; if (typeof d === 'number' && isFinite(d)) { vol = d; src = 'demand given'; }
    else if (d && typeof d === 'object') { if (N(d.vol, null) != null) { vol = N(d.vol, 0); src = S(d.basis) || 'demand given'; } else if (N(d.ai_volume, 0) > 0) { vol = N(d.ai_volume, 0); src = 'AI search volume'; } else if (N(d.gsc_impressions_28d, 0) > 0) { vol = N(d.gsc_impressions_28d, 0) * 12 / 28; src = 'Search Console impressions x 12 / 28'; } }
    if (!src && N(p.volume, 0) > 0) { vol = N(p.volume, 0); src = 'AI search volume'; }
    vol = Math.max(0, vol); const demand_w = 1 + Math.log10(1 + vol) / 2;
    const it = S(intent) || 'unknown'; const intent_w = it in INTENT_W ? INTENT_W[it] : 0.8;
    const bs = S(stage || p.stage).toLowerCase(); const stage_w = bs in BUYER_W ? BUYER_W[bs] : 0.8;
    return { V: rd(demand_w * intent_w * stage_w), demand_w: rd(demand_w), intent_w, stage_w, vol: rd(vol, 2),
      basis: (src ? src + ' ' + Math.round(vol) + ' a month' : 'no demand data') + '; intent ' + it + (it in INTENT_W ? '' : ' (not known: 0.8)') + '; buyer stage ' + (bs || 'not known') + (bs in BUYER_W ? '' : ' (0.8)') }; };
  /** F(q) = clamp(0.05, 1, market_w * (0.5 comp_w + 0.5 reach_w)); comp_w = 1 / (1 + median rivals named per answer / 3) */
  const feasibility = ({ prompt, market, diag, reach } = {}) => { const p = prompt || {}; const mk = market || {}; const why = [];
    const qcc = S(p.market).split('-')[0].toUpperCase(); const scc = S(mk.cc).toUpperCase();
    const market_w = !qcc || !scc ? 1 : qcc === scc ? 1 : 0.2; why.push(!qcc || !scc ? 'market not known: 1' : qcc === scc ? 'the site market' : 'another market (' + qcc + ' vs ' + scc + '): 0.2');
    const rm = N(diag && (diag.rivals_median != null ? diag.rivals_median : diag.rivals_per_answer), null);
    const comp_w = rm == null ? 0.5 : 1 / (1 + Math.max(0, rm) / 3); why.push(rm == null ? 'rivals per answer not known: 0.5' : 'median ' + rm + ' rivals named per answer');
    let rw = N(reach && typeof reach === 'object' ? (reach.pct != null ? reach.pct : reach.percentile) : reach, null); if (rw != null && rw > 1) rw = rw / 100;
    const reach_w = rw == null ? 0.5 : clamp(rw, 0, 1); why.push(rw == null ? 'reach not stored: 0.5' : 'reach percentile ' + rd(reach_w, 2));
    return { F: rd(clamp(market_w * (0.5 * comp_w + 0.5 * reach_w), 0.05, 1)), market_w, comp_w: rd(comp_w), reach_w: rd(reach_w), basis: why.join('; ') }; };
  /** the median number of competitors named per answered answer (feasibility's comp_w input), from seo_ai_answers rows */
  const rivalsMedian = (answers) => { const xs = []; for (const a of (answers || [])) { if (!a || a.answered === false || !AIRF.usable(a.engine)) continue; const ents = arr(a.entities_json);
    xs.push(ents.length ? ents.filter(e => e && S(e.role) === 'competitor').length : arr(a.competitors).filter(Boolean).length); }
    if (!xs.length) return null; xs.sort((x, y) => x - y); const m = xs.length; return m % 2 ? xs[(m - 1) / 2] : (xs[m / 2 - 1] + xs[m / 2]) / 2; };
  const evidencePrior = (lever) => { const L = LV.get(S(lever)); const pr = L && L.prior; return pr ? { a: pr.mean * pr.n0, b: (1 - pr.mean) * pr.n0 } : null; };
  const rowsOf = (priors) => (Array.isArray(priors) ? priors : []);
  /** the Beta prior of a lever at a stage for an engine group: evidence (DESIGN 2.D), pooled across sites (the global row), or the site's own posterior
   *  (the global pool without this site's capped share, shrunk to at most 10 pseudo-outcomes, plus this site's raw outcomes: G4, leave-one-out) */
  const priorOf = ({ lever, stage, group, priors, site_id } = {}) => { const ev = evidencePrior(lever);
    const out = (a, b, n, source) => ({ a: rd(a), b: rd(b), mean: a + b > 0 ? rd(a / (a + b)) : 0, lo90: a > 0 && b > 0 ? rd(betaInv(0.05, a, b)) : 0, hi90: a > 0 && b > 0 ? rd(betaInv(0.95, a, b)) : 0, n, source });
    if (!ev) return out(0, 0, 0, 'evidence');
    const rows = rowsOf(priors); const gid = AIRF.priorId(lever, stage, group, 'global'); const g = rows.find(r => r && S(r.prior_id) === gid);
    let ga = ev.a, gb = ev.b, gn = 0; if (g && N(g.alpha, 0) > 0 && N(g.beta, 0) > 0) { ga = N(g.alpha, ev.a); gb = N(g.beta, ev.b); gn = N(g.n_outcomes, 0); }
    const sid = S(site_id); const s = sid ? rows.find(r => r && S(r.prior_id) === AIRF.priorId(lever, stage, group, sid)) : null;
    if (s) { const ks = Math.max(0, N(s.alpha, 0) - N(s.prior_alpha, 0)), fs = Math.max(0, N(s.beta, 0) - N(s.prior_beta, 0));
      const la = Math.max(1e-6, ga - Math.min(10, ks)), lb = Math.max(1e-6, gb - Math.min(10, fs)); const kap = Math.min(la + lb, 10);
      return out(kap * la / (la + lb) + ks, kap * lb / (la + lb) + fs, N(s.n_outcomes, 0), 'site'); }
    return out(ga, gb, gn, gn > 0 ? 'pooled' : 'evidence'); };

  // ================================================================ E. candidates
  const cellsOf = (d) => Object.entries((d && d.engines) || {}).filter(([e, c]) => AIRF.usable(e) && c && typeof c === 'object').map(([e, c]) => ({ engine: e, stage: S(c.stage), sub: S(c.sub), c }));
  const applies = (L, cell, d) => { if (!L.from.includes(cell.stage)) return false; if (L.sub.length && !L.sub.includes(cell.sub)) return false; if (multOf(L, cell.engine) <= 0) return false;
    if ((d.no_search || []).includes(cell.engine) && !LONG_RUN.includes(L.id) && !ELIG.includes(L.id)) return false; return true; };
  const isOurs = (u, hosts) => { const h = hostOf(u); return !!h && hosts.some(x => h === x || h.endsWith('.' + x)); };
  const DIR_IDS = [['clutch.co', 'clutch'], ['goodfirms.co', 'goodfirms'], ['themanifest.com', 'themanifest'], ['sortlist.', 'sortlist'], ['designrush.com', 'designrush'], ['upcity.com', 'upcity'], ['g2.com', 'g2'], ['capterra.', 'capterra'], ['trustradius.com', 'trustradius'], ['trustpilot.', 'trustpilot'], ['appsource.microsoft.com', 'ms_appsource'], ['partner.microsoft.com', 'ms_partner']];
  const listingIdOf = (url) => { const h = hostOf(url); const hit = DIR_IDS.find(([k]) => h === k || h.endsWith('.' + k) || (k.endsWith('.') && h.indexOf(k) === 0)); return hit ? hit[1] : ''; };
  /** every action AIR could take this week, one per lever and ref (page, question, listing or the site), with the cells it touches. A candidate
   *  that policy forbids carries `refused` (the reason) and is never chosen: a question-specific lever on a control question, a rival's list. */
  const candidates = ({ site, diag, sources, arms, stored_actions, settings, now } = {}) => {
    const st = site || {}; const sid = S(st.site_id); if (!sid) return [];
    const D = (Array.isArray(diag) ? diag : []).filter(d => d && !d.unavailable && S(d.prompt_id) && d.engines && S(d.intent) !== 'brand');
    const byQ = new Map(D.map(d => [S(d.prompt_id), d]));
    const armOf = new Map((arms || []).map(a => [S(a && a.prompt_id), S(a && a.arm)]));
    const P = new Map((st.prompts || []).map(p => [S(p.prompt_id), p]));
    const hosts = uniq([S(st.domain), ...(st.hosts || []).map(S)].map(hostOf).filter(Boolean));
    const home = hosts.length ? 'https://' + hosts[0] + '/' : '';
    const optIn = new Set((((settings || {}).pitch_rival_urls) || []).map(u => AIRF.urlKey(u)).filter(Boolean));
    const pageOf = (d) => { const q = S(d.prompt_id); if (S(d.page_url)) return S(d.page_url);
      for (const { c } of cellsOf(d)) for (const ev of (c.evidence || [])) { const u = S(ev && (ev.url || ev.page)); if (u && isOurs(u, hosts)) return u; }
      const pg = (st.pages || []).find(r => r && arr(r.questions).map(S).includes(q) && isOurs(r.url, hosts)); return pg ? S(pg.url) : ''; };
    const hasPage = (d) => !!pageOf(d) || cellsOf(d).some(({ stage, c }) => lvl(stage) >= 2 || N(c.retrieved, 0) > 0 || N(c.cited, 0) > 0 || c.our_rank);
    const intentOf = (qs) => { const its = uniq(qs.map(q => S((byQ.get(q) || {}).intent))); return its.length === 1 && its[0] === 'informational' ? 'informational' : its.length === 1 && its[0] === 'recommendation' ? 'recommendation' : 'mixed'; };
    const out = []; const seen = new Set();
    const add = (L, ref, cells, extra) => { if (!cells.length) return; const id = AIRF.actionId(sid, L.id, ref); if (seen.has(id)) return; seen.add(id);
      cells.sort((x, y) => (x.prompt_id < y.prompt_id ? -1 : x.prompt_id > y.prompt_id ? 1 : x.engine < y.engine ? -1 : x.engine > y.engine ? 1 : 0));
      const qs = uniq(cells.map(c => c.prompt_id)); const p0 = P.get(qs[0]) || {};
      out.push(Object.assign({ action_id: id, site_id: sid, lever: L.id, label: L.label, executor: L.executor, scope: L.scope, ref, questions: qs, engines: uniq(cells.map(c => c.engine)).sort(), target_stage: L.to,
        sink: L.sink, sink_ref: '', cells: cells.map(c => ({ prompt_id: c.prompt_id, engine: c.engine, stage: c.stage, sub: c.sub })), intent: intentOf(qs), factor: 1,
        keyword: L.scope === 'question' ? S(p0.keyword) : '', page_url: '', exposure: L.scope === 'page', why: '' }, extra || {})); };
    const cellsFor = (L, qs, engines) => { const cs = []; for (const q of qs) { const d = byQ.get(q); if (!d) continue; for (const cell of cellsOf(d)) { if (engines && !engines.includes(cell.engine)) continue; if (applies(L, cell, d)) cs.push({ prompt_id: q, engine: cell.engine, stage: cell.stage, sub: cell.sub }); } } return cs; };
    const allQ = [...byQ.keys()].sort();
    // S0: eligibility only (content cannot help a page the engine cannot read)
    add(LV.get('L01'), {}, cellsFor(LV.get('L01'), allQ), { why: 'robots.txt blocks the AI search bots of these engines' });
    add(LV.get('L03'), {}, cellsFor(LV.get('L03'), allQ), { why: 'the site is not in the Bing index the engine searches' });
    for (const id of ['L02', 'L04']) { const L = LV.get(id); const byPage = new Map();
      for (const q of allQ) { const cs = cellsFor(L, [q]); if (!cs.length) continue; const u = pageOf(byQ.get(q)) || home; const k = AIRF.urlKey(u) || 'site'; const g = byPage.get(k) || { url: u, cells: [] }; g.cells.push(...cs); byPage.set(k, g); }
      for (const [, g] of [...byPage.entries()].sort()) add(L, g.url ? { url: g.url } : {}, g.cells, { page_url: g.url, why: id === 'L02' ? 'the page shows little text before JavaScript runs' : 'the page the question maps to is not in Google\'s index' }); }
    // question-specific levers: own page (new or refresh, never both), cited-not-named, correction. Never on a control question.
    for (const q of allQ) { const d = byQ.get(q); const control = armOf.get(q) === 'control';
      const own = hasPage(d) ? LV.get('L06') : LV.get('L05'); const listy = !!d.list_dominated;
      for (const L of [own, LV.get('L07'), LV.get('L15')]) { const cs = cellsFor(L, [q]); if (!cs.length) continue;
        const extra = { page_url: L.id === 'L05' ? '' : pageOf(d), factor: OWN_PAGE.includes(L.id) && listy ? 0.5 : 1,
          why: L.id === 'L05' ? 'no page of the site is found for the searches the engines run' + (listy ? '; the answers are built from lists, so write an honest comparison or cost guide, never a self-ranked list (own-page chance halved)' : '')
            : L.id === 'L06' ? 'a page of the site is found but not cited' + (listy ? '; the answers are built from lists (own-page chance halved)' : '') : L.id === 'L07' ? 'the answers cite the site but do not name it' : 'an answer states something wrong about the business' };
        if (control) extra.refused = 'held out as a control question: no question-specific action while it is in the control group (1 in 3, 12 weeks)';
        add(L, { prompt_id: q }, cs, extra); } }
    // protect what wins (L16): the client's page cited for a won question, one action per page with every won cell it carries
    { const L = LV.get('L16'); const byPage = new Map(); for (const q of allQ) { const cs = cellsFor(L, [q]); if (!cs.length) continue; const u = pageOf(byQ.get(q)); const k = u ? AIRF.urlKey(u) : 'p:' + q;
        const g = byPage.get(k) || { url: u, q, cells: [] }; g.cells.push(...cs); byPage.set(k, g); }
      for (const [, g] of [...byPage.entries()].sort()) add(L, g.url ? { url: g.url } : { prompt_id: g.q }, g.cells, { page_url: g.url, exposure: true, why: 'AI answers cite this page for a question the business wins; a rewrite for another keyword could lose it' }); }
    // pages the answers are built from: lists (L08), directories and review sites (L09), registries (L10); community threads (L13) and videos (L14)
    const comm = [], vid = [];
    const srcs = (Array.isArray(sources) ? sources : []).filter(s => s && S(s.url) && !isOurs(s.url, hosts)).slice().sort((a, b) => (AIRF.urlKey(a.url) < AIRF.urlKey(b.url) ? -1 : 1));
    for (const s of srcs) { const pt = S(s.page_type), ak = S(s.author_kind); const qs = arr(s.questions).map(S).filter(q => byQ.has(q)); const es = arr(s.engines).map(S).filter(AIRF.usable); if (!qs.length) continue;
      if (s.names_client === true) continue;   // already on it: nothing to place (L16 protects what wins)
      const pl = N(s.placeability, 0); const ref = { url: S(s.url) };
      if (pt === 'listicle') { const L = LV.get('L08'); const cs = cellsFor(L, qs, es.length ? es : null);
        const extra = { page_url: S(s.url), factor: rd(clamp(pl / 0.15, 0, 1), 4), why: 'a list the answers cite for ' + qs.length + ' question(s) does not name the business' + (S(s.contact_email || s.contact_url) ? '' : '; no contact found yet') };
        if (ak === 'rival' && !optIn.has(AIRF.urlKey(s.url))) extra.refused = 'a list written by a competitor: learn from it (format, who wins, its searches), never pitch it (owner decision 8)';
        else if (!(pl > 0)) extra.refused = 'placeability 0' + (S(s.placeability_why) ? ': ' + S(s.placeability_why) : '');
        add(L, ref, cs, extra); }
      else if (pt === 'directory' || pt === 'review') { const L = LV.get('L09'); const cs = cellsFor(L, qs, es.length ? es : null); const lid = listingIdOf(s.url);
        const extra = { page_url: S(s.url), factor: rd(clamp(pl / 0.8, 0, 1), 4), why: 'a ' + pt + ' page the answers cite for ' + qs.length + ' question(s) does not list the business' };
        if (!(pl > 0)) extra.refused = 'placeability 0' + (S(s.placeability_why) ? ': ' + S(s.placeability_why) : '');
        add(L, lid ? { listing_id: lid } : ref, cs, extra); }
      else if (pt === 'registry') { const L = LV.get('L10'); const cs = cellsFor(L, qs, es.length ? es : null);
        const extra = { page_url: S(s.url), factor: rd(clamp(pl / 0.5, 0, 1), 4), why: 'an official list of providers the answers cite' };
        if (!(pl > 0)) extra.refused = 'not eligible for this list' + (S(s.placeability_why) ? ': ' + S(s.placeability_why) : '');
        add(L, ref, cs, extra); }
      else if (pt === 'community') comm.push(...qs); else if (pt === 'video') vid.push(...qs); }
    add(LV.get('L13'), {}, cellsFor(LV.get('L13'), uniq(comm).sort()), { why: 'the answers cite community threads for these questions; answer them openly as the business' });
    add(LV.get('L14'), {}, cellsFor(LV.get('L14'), uniq(vid).sort()), { why: 'the answers cite videos for these questions' });
    // site-wide, long-run levers
    add(LV.get('L11'), {}, cellsFor(LV.get('L11'), allQ), { why: 'independent mentions are the strongest correlate of being named, and the only route into answers given from memory' });
    add(LV.get('L12'), {}, cellsFor(LV.get('L12'), allQ), { why: 'B2B answers cite LinkedIn articles by named people' });
    const earned = (stored_actions || []).filter(a => a && S(a.lever) === 'L11' && S(a.status) === 'verified').length;
    if (earned >= 3) add(LV.get('L17'), {}, cellsFor(Object.assign({}, LV.get('L17'), { next: { S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' } }), allQ), { why: earned + ' earned mentions verified: the notability gate holds' });
    return out; };

  // ================================================================ E. score and choose
  const asNum = (m, k, field, d) => { const v = mget(m, k); return v == null ? d : typeof v === 'object' ? N(v[field], d) : N(v, d); };
  /** one-step look-ahead for eligibility (S0 -> S1): U(S1) - U(S0) is only 0.03, but S0 is a gate (R1: "without it the effect is 0 on that engine");
   *  the value of reaching S1 includes the best next step from S1 among the levers always open to a site: an own page (L05), an earned mention (L11),
   *  a LinkedIn article (L12). Levers that need a cited page (lists, directories, registries) are left out: they may not exist (fixes/P2.md 2) */
  const CONT = ['L05', 'L11', 'L12'];
  const contAt = (stage, engine, group, priors, site_id) => { let best = 0; for (const L of LEVERS) { if (!CONT.includes(L.id) || !L.from.includes(stage)) continue;
    const t = L.next[stage]; if (!t) continue; const p = Math.min(0.95, priorOf({ lever: L.id, stage, group, priors, site_id }).mean * multOf(L, engine)); best = Math.max(best, p * (U[t] - U[stage])); } return best; };
  /** gain(a) = sum over cells w_e V F p (U(next) - U(s)); cost = usd + effort / 60 * H + 0.5; score = gain / cost / (1 + days_typ / 60). Protect (L16): the loss
   *  avoided, U(S5) - U(S2). p = prior mean x engine multiplier x the candidate's factor (placeability, list-dominated own page), at most 0.95 */
  const score = (candidate, { priors, values, feas, weights, H } = {}) => { const c = candidate || {}; const L = LV.get(S(c.lever));
    if (!L) return { gain: 0, cost: 0, score: 0, p_by_cell: [], days: 0, why: 'unknown lever' };
    const W = Object.assign({}, ENGINE_W, weights || {}); const hh = H == null ? COST.H : N(H, COST.H); const costRaw = N(L.usd, 0) + N(L.effort_min, 0) / 60 * hh + COST.overhead_usd; const cost = costOf(L, hh); const days = L.days ? L.days[1] : 0;
    const fac = N(c.factor, 1); let gain = 0; const pc = []; const memo = new Map();
    for (const cell of (c.cells || [])) { const s = S(cell.stage); const e = S(cell.engine); const grp = AIRF.GROUP_OF[e]; if (!grp || !(s in U)) continue;
      const t = L.id === 'L16' ? 'S5' : L.next[s] || (L.id === 'L17' ? ({ S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' })[s] : ''); if (!t) continue;
      const key = s + '|' + grp; if (!memo.has(key)) memo.set(key, priorOf({ lever: L.id, stage: s, group: grp, priors, site_id: c.site_id }));
      const pr = memo.get(key); const mean = L.prior ? pr.mean : (L.id === 'L17' ? 0.05 : 0);
      const p = Math.min(0.95, mean * multOf(L, e) * fac);
      let du = L.id === 'L16' ? U.S5 - U.S2 : U[t] - U[s]; if (ELIG.includes(L.id)) du += contAt(t, e, grp, priors, c.site_id);
      if (!(du > 0) || !(p > 0)) continue;
      const w = N(W[e], 0), V = asNum(values, cell.prompt_id, 'V', 1), F = asNum(feas, cell.prompt_id, 'F', 0.5);
      const rk = OWN_PAGE.includes(L.id) ? rankChance(feas, cell.prompt_id) : 1;
      const g = w * V * F * p * rk * du; gain += g; pc.push({ prompt_id: cell.prompt_id, engine: e, stage: s, to: t, p: rd(p * rk, 4), gain: rd(g) }); }
    const sc = costRaw > 0 ? gain / costRaw / (1 + days / 60) : 0;
    return { gain: rd(gain, 8), cost, score: rd(sc, 12), p_by_cell: pc, days, why: L.label + ': ' + pc.length + ' cell(s), expected gain ' + rd(gain, 4) + ' over $' + rd(cost, 2) + ' (client time at $' + hh + ' an hour), typical ' + days + ' days' }; };
  /** an own page helps only if it ranks for the searches the engines run (R1 lever 2, E24): its chance scales with the site's reach against the keyword,
   *  reach_w / 0.5 within [0.2, 1.5] (the median site keeps the prior). Unknown reach: 1. Other levers do not depend on the client's own ranking. */
  const rankChance = (feas, q) => { const f = mget(feas, q); const r = f && typeof f === 'object' && !/reach not stored/.test(S(f.basis)) ? N(f.reach_w, null) : null; return r == null ? 1 : clamp(r / 0.5, 0.2, 1.5); };
  const meanP = (pc) => { const xs = (pc || []).filter(x => x.gain > 0); return xs.length ? rd(xs.reduce((s, x) => s + x.p, 0) / xs.length, 4) : 0; };
  /** greedy by score under the weekly caps (DESIGN 2.E). `scored`: candidates each with `.scored` = score(...) (or the score fields merged in).
   *  `open_actions`: stored action rows; rows with status 'shadow' never hold a slot (a shadow plan is made fresh each week). With `now` (and
   *  `units60`) every chosen action is pre-registered before it is returned. */
  const choose = (scored, { capacities, arms, mode, open_actions, now, units60 } = {}) => { const md = S(mode) || 'off'; const res = { chosen: [], deferred: [], refused: [] };
    if (md === 'off' || !AIRF.MODES.includes(md)) return res;
    const cap = Object.assign({}, CAPS, capacities || {}); const armOf = new Map((arms || []).map(a => [S(a && a.prompt_id), S(a && a.arm)]));
    const openRows = (open_actions || []).filter(a => a && OPEN.includes(S(a.status)));
    const openIds = new Set(openRows.map(a => S(a.action_id)));
    const openHuman = openRows.filter(a => HUMAN_NEW.includes(S(a.lever)) && S(a.status) !== 'done').length;
    const ownQ = new Set(openRows.filter(a => OWN_PAGE.includes(S(a.lever))).map(a => S((parse(a.ref, {}) || {}).prompt_id)).filter(Boolean));
    const refusedSeen = new Set(); const refuse = (what, why) => { const k = what + '|' + why; if (!refusedSeen.has(k)) { refusedSeen.add(k); res.refused.push({ what, why }); } };
    const items = (scored || []).filter(Boolean).map(x => ({ c: x, s: x.scored || x }));
    const ok = [];
    for (const it of items) { const c = it.c; const L = LV.get(S(c.lever)); if (!L) continue;
      const what = L.label + (c.page_url ? ' (' + c.page_url + ')' : c.ref && c.ref.prompt_id ? ' (question ' + c.ref.prompt_id + ')' : '');
      if (ZERO_WEIGHT.includes(S(c.lever))) { refuse(what, 'weight 0: kept as hygiene in the audit fix pack, never an AI-ranking action'); continue; }
      if (c.refused) { refuse(c.ref && c.ref.prompt_id ? 'question-specific actions on question ' + c.ref.prompt_id : what, S(c.refused)); continue; }
      if (L.scope === 'question' && (c.questions || []).some(q => armOf.get(S(q)) === 'control')) { refuse('question-specific actions on question ' + c.questions.join(', '), 'held out as a control question'); continue; }
      if (!ELIG.includes(L.id) && (c.cells || []).some(x => S(x.stage) === 'S0')) { refuse(what, 'a cell the engine cannot read: only eligibility steps apply'); continue; }
      ok.push(it); }
    ok.sort((x, y) => N(y.s.score, 0) - N(x.s.score, 0) || (S(x.c.action_id) < S(y.c.action_id) ? -1 : 1));
    let own = 0, pitches = 0, human = 0, protect = 0; const ownNow = new Set();
    const defer = (c, why) => res.deferred.push({ action: c, why });
    for (const { c, s } of ok) { const L = LV.get(c.lever);
      if (N(s.gain, 0) < cap.min_gain && !(ELIG.includes(L.id) && N(s.gain, 0) > 0)) { defer(c, 'expected gain ' + rd(N(s.gain, 0), 4) + ' is below the minimum ' + cap.min_gain); continue; }   // eligibility is a gate: never dropped for size
      if (openIds.has(S(c.action_id))) { defer(c, 'already open'); continue; }
      if (OWN_PAGE.includes(L.id)) { const q = S(c.questions[0]); if (ownQ.has(q) || ownNow.has(q)) { defer(c, 'one own page per question: one is already planned'); continue; } if (own >= cap.own_pages) { defer(c, 'no content slot left this week (' + cap.own_pages + ')'); continue; } }
      if (L.id === 'L08' && pitches >= cap.pitches) { defer(c, 'placement pitches this week: ' + cap.pitches + ' already'); continue; }
      if (HUMAN_NEW.includes(L.id)) { if (human >= cap.human_new) { defer(c, 'new steps for a person this week: ' + cap.human_new + ' already'); continue; } if (openHuman + human >= cap.human_open_max) { defer(c, 'already ' + cap.human_open_max + ' steps open for a person'); continue; } }
      if (L.id === 'L16' && protect >= cap.protect) { defer(c, 'protected pages: ' + cap.protect + ' already'); continue; }
      if (OWN_PAGE.includes(L.id)) { own++; ownNow.add(S(c.questions[0])); } if (L.id === 'L08') pitches++; if (HUMAN_NEW.includes(L.id)) human++; if (L.id === 'L16') protect++;
      const a = { action_id: c.action_id, site_id: c.site_id, lever: L.id, executor: L.executor, scope: L.scope, ref: c.ref || {}, questions: (c.questions || []).slice(), engines: (c.engines || []).slice(), target_stage: L.to,
        expected: { p: meanP(s.p_by_cell), gain: rd(N(s.gain, 0)), cost: N(s.cost, 0), score: N(s.score, 0), days: N(s.days, 0) }, prereg: null, sink: L.sink, sink_ref: '',
        label: L.label, intent: c.intent || 'mixed', keyword: S(c.keyword), page_url: S(c.page_url), why: S(c.why) };
      if (now != null) a.prereg = prereg(a, { arms, units60, now });
      res.chosen.push(a); }
    return res; };

  // ================================================================ E. pre-registration
  const metricOf = (action) => { const L = LV.get(S(action.lever)) || {}; if (ELIG.includes(L.id) || SITE_WIDE.includes(L.id)) return 'stage'; if (L.id === 'L16') return 'cited_rate'; return S(action.intent) === 'informational' ? 'cited_rate' : 'named_rate'; };
  /** written once, before anything is executed, never edited: questions, engines, controls (the control arm, minus every question the action touches),
   *  the metric, the window (the lever's typical days, at least 28), when the clock starts, and the projection. */
  const prereg = (action, { arms, units60, now } = {}) => { const a = action || {}; const L = LV.get(S(a.lever)); const nowMs = msOf(now);
    const qs = (a.questions || []).map(S); const touched = new Set(qs);
    const site = L && SITE_WIDE.includes(L.id); const elig = L && ELIG.includes(L.id) && L.scope === 'site';
    const strat = new Map((arms || []).map(x => [S(x && x.prompt_id), S(x && x.stratum)])); const myStrata = new Set(qs.map(q => strat.get(q)).filter(Boolean));
    const controls = site || elig ? [] : (arms || []).filter(x => x && S(x.arm) === 'control' && !touched.has(S(x.prompt_id))).map(x => S(x.prompt_id))
      .sort((x, y) => (myStrata.has(strat.get(x)) ? 0 : 1) - (myStrata.has(strat.get(y)) ? 0 : 1) || (x < y ? -1 : 1));
    const window_days = L && L.days ? Math.max(28, L.days[1]) : 28; const metric = metricOf(a);
    const ex = a.expected || {}; const pr = { metric, questions: qs, engines: (a.engines || []).map(S), controls, window_days, t0_rule: L && (OWN_PAGE.includes(L.id) || L.id === 'L16') ? 'live_at' : 'happened_at',
      projected: { p: N(ex.p, 0), gain: N(ex.gain, 0) }, registered_at: isFinite(nowMs) ? new Date(nowMs).toISOString() : '', lever: S(a.lever), rule_version: RULE,
      control_note: site || elig ? 'no control possible: it touches every question; judged on whether it happened and on the leading indicators' : controls.length ? '' : 'no control question available' };
    if (isFinite(nowMs) && Array.isArray(units60) && units60.length) { const from = nowMs - 28 * DAY; const ys = metric === 'cited_rate' ? 'cited' : 'named'; const cs = new Set(controls); const es = new Set(pr.engines);
      const b = { t: { k: 0, n: 0 }, c: { k: 0, n: 0 } }; for (const u of units60) { if (!u || !AIRF.usable(u.engine) || (es.size && !es.has(u.engine))) continue; const t = msOf(u.at); if (!(t > from && t <= nowMs)) continue;
        const q = S(u.prompt_id); const g = touched.has(q) ? b.t : cs.has(q) ? b.c : null; if (!g) continue; g.n++; if (u[ys]) g.k++; } pr.baseline = Object.assign(b, { days: 28, metric: ys }); }
    return pr; };
  /** the stored registration wins: a later run never rewrites it (prereg_json is written once) */
  const keepPrereg = (storedRow, fresh) => { const st = parse(storedRow && (storedRow.prereg_json != null ? storedRow.prereg_json : storedRow.prereg), null); return st && S(st.registered_at) ? st : fresh; };

  // ================================================================ G1. did it happen (our own check)
  const kwNorm = (s) => S(s).toLowerCase().replace(/[^a-z0-9\u00c0-\uffff]+/g, ' ').trim();
  const CHATGPT_TYPE = ['chatgpt', 'chatgpt_api', 'perplexity', 'claude', 'copilot'];
  const verify = (action, { contentLog, pages, index, listings, outreach, sources, robots, bing, now } = {}) => { const a = action || {}; const L = LV.get(S(a.lever)); const nowMs = msOf(now);
    const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const reg = msOf(pr.registered_at || a.created_at); const win = N(pr.window_days, L && L.days ? Math.max(28, L.days[1]) : 28);
    const res = (happened, at, evidence, extra) => Object.assign({ happened, at: at ? isoOf(at) : '', evidence }, extra || {});
    const expired = isFinite(reg) && isFinite(nowMs) && nowMs > reg + (win + 14) * DAY;
    const notYet = (why) => res(false, '', [why], { expired, why: expired ? 'not verified within the window + 14 days' : why });
    if (!L) return res(null, '', ['unknown lever']);
    if (S(a.status) === 'shadow' || S(a.mode) === 'shadow') return res(false, '', ['shadow: nothing is executed'], { expired: false });
    const url = S((a.ref || parse(a.ref, {}) || {}).url) || S(a.page_url); const key = AIRF.urlKey(url);
    const after = (t) => !isFinite(reg) || msOf(t) >= reg - DAY;
    const srcRow = (k) => (sources || []).find(s => s && AIRF.urlKey(s.url) === k);
    const pageRow = (k) => (pages || []).find(p => p && AIRF.urlKey(p.url) === k);
    const gIdx = (k) => S(mget(index && index.google, k)); const bCrawl = (k) => S(mget(((index && index.bing) || bing || {}).crawled, k));
    if (L.id === 'L01') { const bl = ((robots || {}).blocked_engines || []).map(S); const at = (robots || {}).read_at;
      if (!robots || !at || !after(at)) return notYet('robots.txt not read since the step was asked');
      const still = (a.engines || []).filter(e => bl.includes(S(e))); return still.length ? notYet('robots.txt still blocks ' + still.join(', ')) : res(true, at, ['robots.txt read ' + isoOf(at).slice(0, 10) + ' allows the AI search bots']); }
    if (L.id === 'L02') { const p = pageRow(key); if (!p || !after(p.checked_at)) return notYet('the page has not been read since the step was asked');
      return N(p.status, 0) === 200 && N(p.words_raw, 0) >= 150 ? res(true, p.checked_at, [N(p.words_raw, 0) + ' words in the raw HTML (read ' + S(p.checked_at).slice(0, 10) + ')']) : notYet('still ' + N(p.words_raw, 0) + ' words before JavaScript runs'); }
    if (L.id === 'L03') { const b = (index && index.bing) || bing || {}; if (b.in_account !== true) return notYet('the site is not in the Bing Webmaster account yet');
      const crawled = [...(b.crawled && typeof b.crawled.entries === 'function' ? b.crawled.entries() : Object.entries(b.crawled || {}))].filter(([, t]) => after(t)).sort((x, y) => (x[1] < y[1] ? -1 : 1));
      return crawled.length ? res(true, crawled[0][1], ['in the Bing account; ' + crawled[0][0] + ' crawled ' + S(crawled[0][1]).slice(0, 10)]) : notYet('in the Bing account, no page crawled since'); }
    if (L.id === 'L04') { const st = gIdx(key); return st === 'indexed' ? res(true, nowMs, ['Google index state of ' + key + ': indexed']) : notYet('Google index state: ' + (st || 'not read')); }
    if (OWN_PAGE.includes(L.id)) { const kw = kwNorm(a.keyword); const rows = (contentLog || []).filter(r => r && S(r.status) === 'published' && S(r.published_url) && (['ai_answer', 'ai_refresh'].includes(S(r.source)) || L.id === 'L06')
        && ((kw && kwNorm(r.keyword) === kw) || (url && AIRF.urlKey(r.published_url) === key)) && after(r.published_at || r.started_at)).sort((x, y) => (S(x.published_at) < S(y.published_at) ? -1 : 1));
      if (!rows.length) return notYet('no published page for this question yet');
      const r = rows[0]; const k = AIRF.urlKey(r.published_url); const p = pageRow(k); const pub = msOf(r.published_at);
      if (!p || N(p.status, 0) !== 200 || (isFinite(pub) && msOf(p.checked_at) < pub)) return notYet('published ' + S(r.published_at).slice(0, 10) + '; our fetch has not seen it live (HTTP 200) yet');
      const gi = gIdx(k) === 'indexed', bi = !!bCrawl(k); const es = (a.engines || []).map(S); const needG = es.some(e => AIRF.GROUP_OF[e] === 'google'), needB = es.includes('copilot');
      if (!(gi || bi) || (needG && !needB && !gi) || (needB && !needG && !bi)) return notYet('live, not yet in the index the engines search');
      if (es.some(e => CHATGPT_TYPE.includes(e)) && N(p.words_raw, 0) < 150) return notYet('live and indexed, but the raw HTML holds ' + N(p.words_raw, 0) + ' words (the AI fetchers run no JavaScript)');
      const live = Math.max(isFinite(pub) ? pub : 0, msOf(p.checked_at) || 0); return res(true, live, ['published ' + S(r.published_at).slice(0, 10) + ', HTTP 200, ' + (gi ? 'indexed in Google' : 'crawled by Bing') + ', ' + N(p.words_raw, 0) + ' raw words'], { live_at: isoOf(live), url: S(r.published_url) }); }
    if (L.id === 'L08' || L.id === 'L07') { const s = srcRow(key); if (!s) return notYet('the page has not been read since the step was asked');
      const t = s.checked_at || s.last_seen; if (s.names_client == null) return res(null, '', ['the page could not be read (blocked): cannot confirm'], { expired });
      if (s.names_client === true && after(t)) return res(true, t, ['our fetch of ' + key + ' on ' + S(t).slice(0, 10) + ' finds the business named']);
      const sent = (outreach || []).find(o => o && AIRF.urlKey(o.page_url) === key && /sent|replied/.test(S(o.status)));
      return notYet('the page does not name the business yet' + (sent ? ' (pitch ' + S(sent.status) + ')' : '')); }
    if (L.id === 'L09' || L.id === 'L10') { const lid = S((a.ref || {}).listing_id); const li = (listings || []).find(r => r && ((lid && S(r.listing_id) === lid) || (key && AIRF.urlKey(r.profile_url) === key)));
      if (li && /^(linked|listed)$/.test(S(li.status)) && after(li.checked_at)) return res(true, li.checked_at, ['listing ' + (lid || key) + ' is ' + S(li.status) + (S(li.profile_url) ? ' at ' + S(li.profile_url) : '')]);
      const s = key ? srcRow(key) : null; if (s && s.names_client === true && after(s.checked_at || s.last_seen)) return res(true, s.checked_at || s.last_seen, ['our fetch finds the business on ' + key]);
      if ((s && s.names_client == null) || (li && /unknown|blocked/.test(S(li.status)))) return res(null, '', ['the platform blocks our check: unconfirmed'], { expired });
      return notYet('no listing found yet'); }
    if (L.id === 'L16') return S(a.sink_ref) ? res(true, reg, ['the page is protected (' + S(a.sink_ref) + ')']) : notYet('not protected yet');
    // L11-L15, L17: the client gives the URL, our fetch must find the business named on it
    const cu = S(a.client_url); if (!cu) return notYet('waiting for the link from the client');
    const s = srcRow(AIRF.urlKey(cu)) || pageRow(AIRF.urlKey(cu)); if (!s) return notYet('the link has not been read yet');
    if (s.names_client == null && !('words_raw' in s)) return res(null, '', ['the page could not be read: cannot confirm'], { expired });
    return s.names_client === true || N(s.status, 0) === 200 && L.id === 'L15' ? res(true, s.checked_at || s.last_seen, ['our fetch of ' + AIRF.urlKey(cu) + ' finds the business named']) : notYet('the page does not name the business'); };

  // ================================================================ G2-G3. did it move the stage, and the lift tests
  const diagMap = (x) => { const m = new Map(); if (x && typeof x.get === 'function') { for (const [k, v] of x.entries()) m.set(S(k), v); return m; } for (const d of (Array.isArray(x) ? x : [])) if (d && S(d.prompt_id)) m.set(S(d.prompt_id), d); return m; };
  const stageAt = (m, q, e) => { const d = m.get(q); const c = d && d.engines && d.engines[e]; return c ? { stage: S(c.stage), sub: S(c.sub), c } : null; };
  /** DiD through AVX.impact on the action's engines, its questions and its pre-registered controls only. Pre-period: the 28 days before t0; post: the
   *  window after t0. AVX compares equal windows, so the post answers' times are scaled into 28 days (the estimator uses counts per question and
   *  period only, so the result is the same DiD); with a 28-day window this is exactly AVX.impact. p: two-sided, from the bootstrap range. */
  const didOf = (units, o) => { const A = avx(); const base = { effect: null, lo: null, hi: null, p: null, B: 0, metric: o.metric, controls_used: [], treated_used: [], why: '' };
    if (!A) return Object.assign(base, { why: 'the measurement kit is not in this node' });
    const t0 = msOf(o.t0), end = Math.min(msOf(o.now), t0 + o.post_days * DAY); if (!isFinite(t0) || !(end > t0)) return Object.assign(base, { why: 'no time after the start' });
    const preD = o.pre_days || 28, W = preD * DAY, sc = W / Math.max(DAY, o.post_days * DAY);
    const qs = new Set(o.questions), cs = new Set(o.controls), es = new Set(o.engines || []); const hist = []; let earliest = Infinity;
    for (const u of (units || [])) { if (!u || !AIRF.usable(u.engine) || (es.size && !es.has(u.engine))) continue; const q = S(u.prompt_id); if (!qs.has(q) && !cs.has(q)) continue; const t = msOf(u.at); if (!isFinite(t)) continue;
      earliest = Math.min(earliest, t); let at; if (t >= t0 - W && t < t0) at = t; else if (t > t0 && t <= end) at = t0 + (t - t0) * sc; else continue;
      hist.push({ prompt_id: q, engine: u.engine, named: o.metric === 'cited_rate' ? !!u.cited : !!u.named, at: new Date(at).toISOString() }); }
    const meta = new Map(); for (const [q, s] of (o.strata || new Map())) meta.set(q, { cluster: s });
    const row = A.impact(hist, [{ action_id: o.id, kind: o.lever, at: new Date(t0).toISOString(), questions: [...qs], label: o.label || '' }], { now: new Date(t0 + (end - t0) * sc).toISOString(), window_days: preD, seed: o.seed, B: o.B, meta })[0] || {};
    const d = row.did || {}; const se = d.lo != null && d.hi != null ? (d.hi - d.lo) / (2 * 1.959963985) : null;
    const p = d.effect != null && se != null && se > 0 ? rd(2 * (1 - normCdf(Math.abs(d.effect) / se)), 4) : d.effect != null && se === 0 ? (d.effect === 0 ? 1 : 0) : null;
    return Object.assign(base, { effect: d.effect == null ? null : d.effect, lo: d.lo == null ? null : d.lo, hi: d.hi == null ? null : d.hi, p, B: d.B || 0, controls_used: row.control_questions || [], treated_used: row.target_questions || [],
      before: row.before, after: row.after, control_before: row.control_before, control_after: row.control_after, pre_days: preD, post_days: rd((end - t0) / DAY, 1), history_from: isFinite(earliest) ? new Date(earliest).toISOString() : '',
      why: S(row.why).replace(/28 days before and after/g, preD + ' days before and the window after') }); };
  const firstAppear = (units, o) => { const t0 = msOf(o.t0), end = Math.min(msOf(o.now), t0 + o.post_days * DAY), from = t0 - 28 * DAY; const ys = o.metric === 'cited_rate' ? 'cited' : 'named';
    const es = new Set(o.engines || []); const g = new Map();
    for (const u of (units || [])) { if (!u || !AIRF.usable(u.engine) || (es.size && !es.has(u.engine))) continue; const q = S(u.prompt_id); const t = msOf(u.at); if (!isFinite(t)) continue;
      const x = g.get(q) || { pre: 0, preY: 0, post: 0, postY: 0 }; if (t >= from && t < t0) { x.pre++; if (u[ys]) x.preY++; } else if (t > t0 && t <= end) { x.post++; if (u[ys]) x.postY++; } g.set(q, x); }
    const arm = (qs) => { const r = { k: 0, n: 0, x: 0, m: 0, zero_all: true, any: false }; for (const q of qs) { const x = g.get(q); if (!x || !x.pre || !x.post) continue; r.any = true; if (x.preY) { r.zero_all = false; continue; } r.n++; r.m += x.post; r.x += x.postY; if (x.postY) r.k++; } return r; };
    const T = arm(o.questions), C = arm(o.controls);
    const p_fisher = T.n && C.n ? rd(fisher(T.k, T.n, C.k, C.n), 6) : null; const tot = T.x + C.x;
    const p_binom = T.m + C.m > 0 ? rd(tot ? binomUpper(T.x, tot, T.m / (T.m + C.m)) : 1, 6) : null;
    return { t: { k: T.k, n: T.n }, c: { k: C.k, n: C.n }, p_fisher, p_binom, answers: { t: { x: T.x, n: T.m }, c: { x: C.x, n: C.m } }, treated_zero_baseline: T.any && T.zero_all }; };
  const shareOf = (m, qs, es, f) => { let k = 0, n = 0; for (const q of qs) for (const e of es) { const x = stageAt(m, q, e); if (!x || x.stage === 'unmeasured' || !x.stage) continue; n++; if (f(x)) k++; } return n ? { k, n, share: rd(k / n, 4) } : { k: 0, n: 0, share: null }; };
  /** at the end of the pre-registered window: stage moves of the treated cells net of the control background b (same starting stage, same engine
   *  group); DiD on the metric with a placebo in time; Fisher's exact first-appearance test when every treated question started at zero; the
   *  leading indicators. The verdict never says "caused". */
  const outcome = (action, { units60, diagNow, diagAtT0, arms, now, B, verified } = {}) => { const a = action || {}; const L = LV.get(S(a.lever)); const nowMs = msOf(now);
    const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const vf = verified || parse(a.verify_json, {}) || {};
    const empty = (verdict, why, extra) => Object.assign({ due: false, stage_moves: { k: 0, n: 0, b: 0 }, did: null, placebo: null, first_appearance: { t: { k: 0, n: 0 }, c: { k: 0, n: 0 }, p_fisher: null, p_binom: null }, leading: {}, verdict, why }, extra || {});
    if (!L || !pr.registered_at) return empty('not_due', 'no pre-registration');
    const happened = S(a.status) === 'verified' || vf.happened === true;
    const t0 = msOf(pr.t0_rule === 'live_at' ? (a.live_at || vf.live_at) : (a.happened_at || vf.at)); const win = N(pr.window_days, 28);
    if (!happened) { const expired = S(a.status) === 'expired' || S(a.status) === 'not_happened' || vf.expired === true || (isFinite(nowMs) && nowMs > msOf(pr.registered_at) + (win + 14) * DAY);
      return expired ? empty('not_happened', 'our check never found that it happened, so it says nothing about what works', { due: true }) : empty('not_due', 'not verified yet: the clock starts when our check finds it happened'); }
    if (!isFinite(t0)) return empty('not_due', 'verified, but the start date (' + pr.t0_rule + ') is not recorded');
    const due = isFinite(nowMs) && nowMs >= t0 + win * DAY;
    const qs = (pr.questions || []).map(S), cs = (pr.controls || []).map(S), es = (pr.engines || []).map(S).filter(AIRF.usable);
    const mN = diagMap(diagNow), m0 = diagMap(diagAtT0);
    // stage moves
    const cells = [], byK = new Map(), ctrl = new Map();
    const targetOf = (s) => (L.id === 'L16' ? 'S5' : L.next[s] || (L.id === 'L17' ? ({ S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' })[s] : ''));
    const counts = (s, sub) => L.from.includes(s) && (!L.sub.length || L.sub.includes(sub)) && (targetOf(s) !== s || L.id === 'L16');
    for (const q of qs) for (const e of es) { const x0 = stageAt(m0, q, e), x1 = stageAt(mN, q, e); if (!x0 || !x1 || !counts(x0.stage, x0.sub) || multOf(L, e) <= 0) continue;
      const t = targetOf(x0.stage); const reached = L.id === 'L16' ? x1.stage === 'S5' : lvl(x1.stage) >= lvl(t); const grp = AIRF.GROUP_OF[e];
      cells.push({ prompt_id: q, engine: e, group: grp, from: x0.stage, target: t, now: x1.stage, reached }); const k = x0.stage + '|' + grp; const g = byK.get(k) || { stage: x0.stage, group: grp, n: 0, k: 0 }; g.n++; if (reached) g.k++; byK.set(k, g); }
    for (const q of cs) for (const e of es) { const x0 = stageAt(m0, q, e), x1 = stageAt(mN, q, e); if (!x0 || !x1 || !counts(x0.stage, x0.sub) || multOf(L, e) <= 0) continue; const t = targetOf(x0.stage); const ok = L.id === 'L16' ? x1.stage === 'S5' : lvl(x1.stage) >= lvl(t);
      for (const k of [x0.stage + '|' + AIRF.GROUP_OF[e], x0.stage + '|*']) { const g = ctrl.get(k) || { n: 0, k: 0 }; g.n++; if (ok) g.k++; ctrl.set(k, g); } }
    const noControl = SITE_WIDE.includes(L.id) || (ELIG.includes(L.id) && L.scope === 'site');
    const by = [...byK.values()].sort((x, y) => (x.stage + x.group < y.stage + y.group ? -1 : 1)).map(g => { const c1 = ctrl.get(g.stage + '|' + g.group), c2 = ctrl.get(g.stage + '|*');
      const src = c1 && c1.n ? c1 : c2 && c2.n ? c2 : null; const b = src ? src.k / src.n : 0;
      const b_basis = src ? (src === c1 ? 'control cells, same stage and engine group' : 'control cells, same stage, any engine group') + ' (' + src.k + ' of ' + src.n + ')' : ELIG.includes(L.id) ? 'eligibility: no background expected' : 'none';
      return { stage: g.stage, group: g.group, n: g.n, k: g.k, b: rd(b, 4), b_basis, k_adj: rd(Math.max(0, g.k - g.n * b), 4) }; });
    const sk = by.reduce((s, x) => s + x.k, 0), sn = by.reduce((s, x) => s + x.n, 0), sb = sn ? by.reduce((s, x) => s + x.b * x.n, 0) / sn : 0;
    const stage_moves = { k: sk, n: sn, b: rd(sb, 4), k_adj: rd(by.reduce((s, x) => s + x.k_adj, 0), 4), by, cells };
    // the lift tests
    const metric = pr.metric === 'stage' ? 'named_rate' : S(pr.metric) || 'named_rate';
    const strata = new Map((arms || []).map(x => [S(x && x.prompt_id), S(x && x.stratum)]));
    const common = { questions: qs, controls: cs, engines: es, metric, now: nowMs, post_days: win, seed: S(a.action_id), B: B || 2000, id: S(a.action_id), lever: L.id, label: L.label, strata };
    let did = null, placebo = null, fa = { t: { k: 0, n: 0 }, c: { k: 0, n: 0 }, p_fisher: null, p_binom: null };
    if (!noControl && cs.length) { did = didOf(units60, Object.assign({}, common, { t0 }));
      placebo = didOf(units60, Object.assign({}, common, { t0: t0 - win * DAY, now: t0 - 1, seed: S(a.action_id) + '|placebo' }));
      if (placebo.effect == null) placebo.why = placebo.why || 'not enough history before the start';
      fa = firstAppear(units60, Object.assign({}, common, { t0 })); }
    // leading indicators (LI1 retrievable, LI2 indexed, LI3 on-source, LI4 cited rate): treated vs control, at t0 and now
    const li = (f) => { const T0 = shareOf(m0, qs, es, f), T1 = shareOf(mN, qs, es, f), C0 = shareOf(m0, cs, es, f), C1 = shareOf(mN, cs, es, f);
      const dd = T0.share != null && T1.share != null && C0.share != null && C1.share != null ? rd(100 * ((T1.share - T0.share) - (C1.share - C0.share)), 1) : null;
      return { t: { at_t0: T0, now: T1 }, c: { at_t0: C0, now: C1 }, did_points: dd, basis: 'share of question x engine cells, two readings, no range' }; };
    const leading = { LI1: li((x) => lvl(x.stage) >= 2 || N(x.c.retrieved, 0) > 0), LI2: li((x) => !(x.stage === 'S0' && x.sub === 'not_indexed')),
      LI3: li((x) => x.c.on_source === true), LI4: did && metric === 'cited_rate' ? did : !noControl && cs.length ? didOf(units60, Object.assign({}, common, { t0, metric: 'cited_rate', seed: S(a.action_id) + '|cited' })) : null };
    if (!mN.size || ![...mN.values()].some(d => d && d.engines && Object.values(d.engines).some(c => c && 'on_source' in c))) leading.LI3 = { basis: 'not read: the diagnosis does not carry on-source yet' };
    // verdict
    let verdict = 'cant_tell', why = '', primary = 'none';
    if (!due) { verdict = 'not_due'; why = 'the window ends ' + new Date(t0 + win * DAY).toISOString().slice(0, 10); }
    else if (noControl) { primary = 'stage';
      if (ELIG.includes(L.id) && sn) { const r = sk / sn; verdict = r >= 0.5 ? 'likely_helped' : sk === 0 ? 'no_effect' : 'cant_tell'; why = sk + ' of ' + sn + ' cells the step was for can now be read (' + pct1(r) + '%); no control possible, it touches every question'; }
      else { verdict = 'cant_tell'; why = 'no control possible: it touches every question, so only whether it happened and the leading indicators are reported (' + sk + ' of ' + sn + ' cells moved)'; } }
    else if (!cs.length) { why = 'no control question was registered, so no lift can be read'; }
    else { const fisherFirst = fa.p_fisher != null && fa.t.n > 0 && fa.c.n > 0 && (fa.treated_zero_baseline === true);
      if (fisherFirst) { primary = 'fisher';
        if (fa.p_fisher < 0.05) { verdict = 'likely_helped'; why = fa.t.k + ' of ' + fa.t.n + ' worked-on questions named the business for the first time against ' + fa.c.k + ' of ' + fa.c.n + ' held-back questions (one-sided Fisher p ' + fa.p_fisher + ')'; }
        else { verdict = 'cant_tell'; why = 'first appearances: ' + fa.t.k + ' of ' + fa.t.n + ' worked-on vs ' + fa.c.k + ' of ' + fa.c.n + ' held-back questions (Fisher p ' + fa.p_fisher + ', 0.05 needed)'; } }
      else if (did && did.lo != null) { primary = 'did';
        if (did.lo > 0) { verdict = 'likely_helped'; why = 'its questions moved ' + did.effect + ' points more than the held-back questions (95% range ' + did.lo + ' to ' + did.hi + '); a correlation with controls, not proof of cause'; }
        else if (did.hi <= 0) { verdict = 'no_effect'; why = 'its questions did not move more than the held-back questions (95% range ' + did.lo + ' to ' + did.hi + ' points)'; }
        else { verdict = 'cant_tell'; why = 'the change against the held-back questions (' + did.effect + ' points) is inside the 95% range ' + did.lo + ' to ' + did.hi; } }
      else { why = 'the lift cannot be read: ' + ((did && did.why) || 'no answers'); }
      if (verdict === 'likely_helped' && placebo && placebo.effect != null && did && did.effect != null && did.effect > 0 && placebo.effect >= 0.5 * did.effect && placebo.p != null && placebo.p < 0.2) {
        verdict = 'cant_tell'; why = 'can\'t tell: the questions were already moving before the action (placebo ' + placebo.effect + ' points, p ' + placebo.p + ', against ' + did.effect + ' after)'; } }
    return { due, t0: new Date(t0).toISOString(), window_days: win, metric: pr.metric, primary, stage_moves, did, placebo, first_appearance: fa, leading, verdict, verdict_words: VERDICT_WORDS[verdict], why }; };

  // ================================================================ G4. learning
  const learnable = (item) => { const a = (item && item.action) || item || {}; const oc = (item && item.outcome) || parse(a.outcome_json, null); const vf = parse(a.verify_json, {}) || {};
    const happened = (item && item.happened === true) || S(a.status) === 'verified' || vf.happened === true;
    return !!(oc && oc.due === true && happened && oc.verdict !== 'not_happened' && !S(a.learned_at) && LV.has(S(a.lever)) && LV.get(S(a.lever)).prior && !SITE_WIDE.includes(S(a.lever)) && oc.stage_moves && Array.isArray(oc.stage_moves.by)); };
  /** DESIGN G4, pooled Beta-binomial with the control background subtracted: k_adj = max(0, k - n b). Global: a = a0 + sum over sites min(10, k_site),
   *  b = b0 + sum over sites min(10, n_site - k_site) (one site can never teach the whole system). Site: the global pool WITHOUT this site's capped share,
   *  shrunk to kappa = min(a + b, 10) pseudo-outcomes, plus the site's own k and n - k. Rows: the global row and the site row of every key touched.
   *  A site row stores its raw totals as alpha - prior_alpha and beta - prior_beta, so the next run (and priorOf) can rebuild the pool exactly. */
  const learn = ({ priors, outcomes, now } = {}) => { const rows = rowsOf(priors); const t = isoOf(now); const delta = new Map(); const done = new Set();
    for (const it of (outcomes || [])) { if (!learnable(it)) continue; const a = (it && it.action) || it; const id = S(a.action_id); if (id && done.has(id)) continue; if (id) done.add(id); const oc = (it && it.outcome) || parse(a.outcome_json, {});
      const sid = S(a.site_id); if (!sid) continue; const L = S(a.lever);
      for (const g of oc.stage_moves.by) { if (!(N(g.n, 0) > 0) || !AIRF.STAGES.includes(S(g.stage)) || !AIRF.GROUPS.includes(S(g.group))) continue; if (S(g.b_basis) === 'none' && !ELIG.includes(L)) continue;
        const n = N(g.n, 0), kadj = clamp(N(g.k, 0) - n * clamp(N(g.b, 0), 0, 1), 0, n); const key = L + '|' + S(g.stage) + '|' + S(g.group);
        const m = delta.get(key) || new Map(); const d = m.get(sid) || { k: 0, f: 0, n: 0 }; d.k += kadj; d.f += n - kadj; d.n++; m.set(sid, d); delta.set(key, m); } }
    const out = [];
    for (const [key, m] of [...delta.entries()].sort()) { const [L, st, gr] = key.split('|'); const ev = evidencePrior(L);
      const gid = AIRF.priorId(L, st, gr, 'global'); const g = rows.find(r => r && S(r.prior_id) === gid);
      const a0 = g && N(g.prior_alpha, 0) > 0 ? N(g.prior_alpha, ev.a) : ev.a, b0 = g && N(g.prior_beta, 0) > 0 ? N(g.prior_beta, ev.b) : ev.b;
      const sites = new Map();   // every site's raw totals: stored site rows, plus this call's outcomes
      for (const r of rows) { if (!r || S(r.lever) !== L || S(r.stage) !== st || S(r.engine_group) !== gr || S(r.scope) === 'global' || !S(r.scope)) continue;
        sites.set(S(r.scope), { k: Math.max(0, N(r.alpha, 0) - N(r.prior_alpha, 0)), f: Math.max(0, N(r.beta, 0) - N(r.prior_beta, 0)), n: N(r.n_outcomes, 0) }); }
      for (const [sid, d] of m) { const s = sites.get(sid) || { k: 0, f: 0, n: 0 }; sites.set(sid, { k: s.k + d.k, f: s.f + d.f, n: s.n + d.n }); }
      let A = a0, Bt = b0, nn = 0; for (const s of sites.values()) { A += Math.min(10, s.k); Bt += Math.min(10, s.f); nn += s.n; }
      const base = { lever: L, stage: st, engine_group: gr, updated_at: t, rule_version: RULE };
      out.push(Object.assign({ prior_id: gid, scope: 'global', alpha: rd(A), beta: rd(Bt), n_outcomes: nn, prior_alpha: rd(a0), prior_beta: rd(b0), source: 'pooled' }, base));
      for (const sid of [...m.keys()].sort()) { const s = sites.get(sid); const la = Math.max(1e-6, A - Math.min(10, s.k)), lb = Math.max(1e-6, Bt - Math.min(10, s.f)); const kap = Math.min(la + lb, 10);
        const pa = kap * la / (la + lb), pb = kap * lb / (la + lb);
        out.push(Object.assign({ prior_id: AIRF.priorId(L, st, gr, sid), scope: sid, alpha: rd(pa + s.k), beta: rd(pb + s.f), n_outcomes: s.n, prior_alpha: rd(pa), prior_beta: rd(pb), source: 'site' }, base)); } }
    return out; };
  /** calibration per lever: the Brier score of the projected p against each treated cell's result (reached its target or not), and the observed rate */
  const brier = (items) => { const by = {}; for (const it of (items || [])) { const a = (it && it.action) || it || {}; const oc = (it && it.outcome) || parse(a.outcome_json, null); if (!oc || !oc.due || !oc.stage_moves) continue;
      const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const p = N((pr.projected || {}).p, N((a.expected || parse(a.expected_json, {}) || {}).p, null)); if (p == null) continue;
      const L = S(a.lever); const x = by[L] || (by[L] = { sq: 0, n_cells: 0, n_actions: 0, sum_p: 0, reached: 0 }); x.n_actions++;
      for (const c of (oc.stage_moves.cells || [])) { const y = c.reached ? 1 : 0; x.sq += (p - y) * (p - y); x.n_cells++; x.sum_p += p; x.reached += y; } }
    const out = {}; for (const L of Object.keys(by).sort()) { const x = by[L]; if (!x.n_cells) continue; out[L] = { brier: rd(x.sq / x.n_cells, 4), n_cells: x.n_cells, n_actions: x.n_actions, mean_p: rd(x.sum_p / x.n_cells, 4), observed: rd(x.reached / x.n_cells, 4) }; }
    return { by_lever: out, basis: 'projected p of each action against each treated cell reaching its target; raw outcomes, before the control background' }; };

  // ================================================================ H. the memo and the old-logic comparison
  const MEMO_PARTS = ['what_changed', 'why', 'detectable', 'actions', 'projected_vs_real', 'cost_per_win', 'shadow_vs_old'];
  const MEMO_TITLES = { what_changed: 'What changed', why: 'Why', detectable: 'What we can detect', actions: 'What we did and what is waiting',
    projected_vs_real: 'Projected and real', cost_per_win: 'Cost per won question', shadow_vs_old: 'This plan and the current one' };
  const clean = (s) => S(s).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, '\'').replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...');
  const line = (text, figures) => ({ text: clean(text), figures: (figures || []).map(f => ({ name: S(f.name), value: f.value == null ? null : f.value, basis: clean(f.basis) || 'not stated' })) });
  const eName = (e) => ENGINE_NAMES[e] || e;
  const memo = ({ site, diagNow, diagPrev, chosen, open, outcomes, mde: md, blockers, cost, old, mode } = {}) => { const st = site || {}; const mode_ = S(mode) || 'off';
    const parts = {}; for (const k of MEMO_PARTS) parts[k] = [];
    const mN = diagMap(diagNow), mP = diagMap(diagPrev); const core = [...mN.keys()].filter(q => !mP.size || mP.has(q)).sort();
    // 1. what changed (core questions in both readings only)
    const engines = uniq(core.flatMap(q => Object.keys((mN.get(q) || {}).engines || {}))).filter(AIRF.usable).sort();
    const moved = [];
    if (!mN.size) parts.what_changed.push(line('No diagnosis this week.', []));
    else if (!mP.size) parts.what_changed.push(line('This is the first reading: there is no week before to compare with.', [{ name: 'questions', value: mN.size, basis: 'core questions diagnosed this week' }]));
    else { for (const e of engines) { const cnt = (m) => { const c = {}; for (const q of core) { const x = stageAt(m, q, e); if (x) c[x.stage] = (c[x.stage] || 0) + 1; } return c; }; const a = cnt(mN), b = cnt(mP);
        const won = a.S5 || 0, wonB = b.S5 || 0, found = AIRF.STAGES.filter(s => lvl(s) >= 2).reduce((s, x) => s + (a[x] || 0), 0), foundB = AIRF.STAGES.filter(s => lvl(s) >= 2).reduce((s, x) => s + (b[x] || 0), 0);
        parts.what_changed.push(line(eName(e) + ': found on ' + found + ' of ' + core.length + ' questions (last week ' + foundB + '), won on ' + won + ' (last week ' + wonB + ').',
          [{ name: 'found', value: found, basis: 'stage S2 or higher, core questions in both weeks' }, { name: 'found_last_week', value: foundB, basis: 'same, last week' }, { name: 'won', value: won, basis: 'stage S5, core questions in both weeks' }, { name: 'won_last_week', value: wonB, basis: 'same, last week' }])); }
      for (const q of core) for (const e of engines) { const x1 = stageAt(mN, q, e), x0 = stageAt(mP, q, e); if (!x1 || !x0 || x1.stage === x0.stage || x1.stage === 'unmeasured' || x0.stage === 'unmeasured') continue; moved.push({ q, e, from: x0.stage, to: x1.stage, up: lvl(x1.stage) > lvl(x0.stage) }); }
      if (!moved.length) parts.what_changed.push(line('No question changed stage this week.', [{ name: 'moved', value: 0, basis: 'question x engine cells, core questions in both weeks' }]));
      for (const x of moved.slice(0, 20)) parts.what_changed.push(line('Question ' + x.q + ' on ' + eName(x.e) + ': ' + (x.up ? 'up' : 'down') + ' from "' + STAGE_WORDS[x.from] + '" to "' + STAGE_WORDS[x.to] + '".', [{ name: 'from', value: x.from, basis: 'stage last week' }, { name: 'to', value: x.to, basis: 'stage this week' }])); }
    // 2. why: an action only when our check found it happened; otherwise background or nothing of ours
    const acts = [...(open || []), ...(chosen || [])].map(a => Object.assign({}, a, { questions: arr(a.questions).map(S), engines: arr(a.engines).map(S) }));
    const ctrlMoved = moved.filter(x => x.up && !acts.some(a => a.questions.includes(x.q)));
    for (const x of moved.filter(m => m.up)) { const a = acts.find(z => S(z.status) === 'verified' && z.questions.includes(x.q) && (!z.engines.length || z.engines.includes(x.e)));
      const bg = ctrlMoved.some(y => y !== x && y.e === x.e && y.from === x.from);
      parts.why.push(line('Question ' + x.q + ' on ' + eName(x.e) + ': ' + (a ? 'after "' + (LV.get(S(a.lever)) || {}).label + '", which our check found done' + (bg ? '; questions we did not work on moved the same way, so it may be background' : '') : bg ? 'background: questions we did not work on moved the same way' : 'no action of ours touched it') + '.',
        [{ name: 'attributed_to', value: a ? S(a.action_id) : null, basis: a ? 'verified action on this question and engine' : 'no verified action' }])); }
    if (!parts.why.length) parts.why.push(line('Nothing moved up, so there is nothing to explain.', []));
    // 3. what we can detect
    const mdv = md && !md.unavailable && md.prepost != null ? md : md && md.q_t != null ? mde(md) : null;
    if (mdv) { parts.detectable.push(line('With the questions we work on and the ones held back, a change of about ' + mdv.did + ' points in the rate can be shown against the held-back questions (' + mdv.prepost + ' points before and after on the worked-on questions alone).',
        [{ name: 'mde_did_points', value: mdv.did, basis: mdv.basis || 'minimum detectable effect, 80% power, 5% two-sided' }, { name: 'mde_prepost_points', value: mdv.prepost, basis: mdv.basis || 'minimum detectable effect' }]));
      if (mdv.first_appearance_k != null) parts.detectable.push(line('To show that our actions worked on questions where you were never named, about ' + mdv.first_appearance_k + ' of them must name you for the first time, all among the questions we worked on.',
        [{ name: 'first_appearance_k', value: mdv.first_appearance_k, basis: 'one-sided Fisher exact test below 0.05, all first appearances on worked-on questions' }])); }
    else parts.detectable.push(line('The size of change this panel can show is not computed this week.', [{ name: 'mde', value: null, basis: 'no panel arms yet' }]));
    // 4. actions and blockers
    for (const a of (chosen || [])) parts.actions.push(line('New: ' + (LV.get(S(a.lever)) || {}).label + ' (' + ({ auto: 'we do it', approve: 'needs your approval', human: 'a person must do it' })[S(a.executor)] + (a.page_url ? ', ' + a.page_url : '') + ').',
      [{ name: 'expected_gain', value: N((a.expected || {}).gain, 0), basis: 'AIR\'s own model, not independent' }, { name: 'p', value: N((a.expected || {}).p, 0), basis: 'prior mean x engine multiplier' }]));
    for (const a of (open || []).filter(x => OPEN.includes(S(x.status)))) parts.actions.push(line('Open since ' + S(a.created_at).slice(0, 10) + ': ' + (LV.get(S(a.lever)) || {}).label + ' (' + S(a.status).replace('_', ' ') + ').', [{ name: 'status', value: S(a.status), basis: 'action row' }]));
    const bl = (blockers || []).map(b => ({ what: clean(b.what), owner: S(b.owner) || 'client', since: S(b.since).slice(0, 10), blocks: clean(b.blocks) }));
    for (const b of bl) parts.actions.push(line('Waiting on ' + (b.owner === 'us' ? 'us' : 'you') + (b.since ? ' since ' + b.since : '') + ': ' + b.what + (b.blocks ? '. It blocks: ' + b.blocks : '') + '.', [{ name: 'owner', value: b.owner, basis: 'blocker list' }]));
    if (!parts.actions.length) parts.actions.push(line('No new action this week and nothing open.', []));
    // 5. projected vs real
    const ocs = (outcomes || []).map(it => ({ a: (it && it.action) || it || {}, o: (it && it.outcome) || parse(((it && it.action) || it || {}).outcome_json, null) })).filter(x => x.o && x.o.due);
    for (const { a, o } of ocs) { const pr = parse(a.prereg_json != null ? a.prereg_json : a.prereg, {}) || {}; const sm = o.stage_moves || {};
      parts.projected_vs_real.push(line((LV.get(S(a.lever)) || {}).label + ': we projected a ' + pct1(N((pr.projected || {}).p, 0)) + '% chance per cell; ' + N(sm.k, 0) + ' of ' + N(sm.n, 0) + ' cells moved (background ' + pct1(N(sm.b, 0)) + '%)' + (o.did && o.did.effect != null ? '; against the held-back questions ' + o.did.effect + ' points' + (o.did.lo != null ? ' (95% range ' + o.did.lo + ' to ' + o.did.hi + ')' : '') : '') + '. Verdict: ' + (VERDICT_WORDS[o.verdict] || o.verdict) + '.',
        [{ name: 'projected_p', value: N((pr.projected || {}).p, 0), basis: 'pre-registered ' + S(pr.registered_at).slice(0, 10) }, { name: 'moved', value: N(sm.k, 0), basis: 'treated cells that reached the target stage' }, { name: 'cells', value: N(sm.n, 0), basis: 'treated cells at a starting stage the lever acts on' },
          { name: 'background', value: N(sm.b, 0), basis: 'share of control cells that moved the same way' }, { name: 'did_points', value: o.did ? o.did.effect : null, basis: o.did && o.did.lo != null ? 'difference in differences, two-level bootstrap' : 'not computed' }])); }
    if (!parts.projected_vs_real.length) parts.projected_vs_real.push(line('No action has reached the end of its window yet.', []));
    // 6. cost per won question (12 weeks)
    const c = cost || {}; const H = N(c.H, COST.H); const spend = N(c.usd, 0) + N(c.minutes, 0) / 60 * H;
    let wins = 0; for (const { o } of ocs) for (const g of ((o.stage_moves || {}).by || [])) { const cl = ((o.stage_moves || {}).cells || []).filter(x => x.from === g.stage && x.group === g.group && x.now === 'S5' && (!mP.size || (stageAt(mP, x.prompt_id, x.engine) || {}).stage === 'S5')).length; wins += Math.max(0, cl - N(g.n, 0) * N(g.b, 0)); }
    if (c.wins != null) wins = N(c.wins, 0);
    parts.cost_per_win.push(wins > 0 ? line('About $' + rd(spend / wins, 2) + ' per question and engine won (' + rd(wins, 1) + ' won net of the background, $' + rd(spend, 2) + ' spent including your time at $' + H + ' an hour).',
      [{ name: 'cost_per_win_usd', value: rd(spend / wins, 2), basis: '12 weeks of AIR spend / cells won and held 2 weeks after a verified action, net of control background' }, { name: 'wins', value: rd(wins, 2), basis: 'net of control background' }, { name: 'spend_usd', value: rd(spend, 2), basis: 'provider cost + client minutes x hour value' }])
      : line('Not yet: no question has been won after a verified action ($' + rd(spend, 2) + ' spent so far).', [{ name: 'wins', value: 0, basis: 'cells won and held after a verified action' }, { name: 'spend_usd', value: rd(spend, 2), basis: 'provider cost + client minutes x hour value' }]));
    // 7. this plan and the current one
    if (mode_ === 'shadow' && old && !old.unavailable) { parts.shadow_vs_old.push(line('The two plans share ' + pct1(N(old.overlap, 0)) + '% of their targets. AIR\'s model expects ' + rd(N(old.gain_air, 0), 3) + ' from its plan and ' + rd(N(old.gain_old, 0), 3) + ' from the current one (AIR\'s own model, not independent).',
        [{ name: 'overlap', value: N(old.overlap, 0), basis: 'shared targets / all targets of both plans' }, { name: 'gain_air', value: N(old.gain_air, 0), basis: 'AIR\'s own model, not independent' }, { name: 'gain_old', value: N(old.gain_old, 0), basis: 'AIR\'s own model, not independent' }]));
      parts.shadow_vs_old.push(line('Problems addressed (of the six found on the two clients): AIR ' + ((old.causes || {}).air || []).join(', ') + '; current plan ' + (((old.causes || {}).old || []).join(', ') || 'none') + '.', [{ name: 'problems_addressed', value: ((old.causes || {}).air || []).length, basis: 'R4 problem list: 1 footprint, 2 cited sources, 3 panel, 5 execution, 6 blockers' }])); }
    else parts.shadow_vs_old.push(line(mode_ === 'on' ? 'AIR drives the plan on this site.' : 'No comparison this week.', []));
    return { v: 1, rule_version: RULE, site_id: S(st.site_id), mode: mode_, parts: MEMO_PARTS.map(k => ({ key: k, title: MEMO_TITLES[k], lines: parts[k] })), blockers: bl }; };
  const CAUSE_OF = { L01: 1, L02: 1, L03: 1, L04: 1, L05: 1, L06: 1, L08: 2, L09: 2, L10: 2, L13: 2, L14: 2, L11: 2, L12: 2 };
  /** AIR's plan beside the old logic's: overlap (Jaccard of the refs), both plans' gain in AIR's own model (old items found among `old.scored`, AIR's
   *  scored candidates; an item AIR's model cannot see counts 0), the R4 causes each addresses, and the refused tactics the old plan contains */
  const compareOld = ({ chosen, old } = {}) => { const o = old || {};
    const refA = (a) => { const r = parse(a.ref, {}) || {}; return OWN_PAGE.includes(S(a.lever)) && r.prompt_id ? 'p:' + S(r.prompt_id) : AIRF.refKey(r) + (r.prompt_id || r.url || r.listing_id ? '' : ':' + S(a.lever)); };
    const air = new Map((chosen || []).map(a => [refA(a), a]));
    const oldRefs = new Map(); for (const t of (o.targets || [])) if (t && S(t.prompt_id)) oldRefs.set('p:' + S(t.prompt_id), { kind: 'target', item: t });
    for (const e of (o.earned || [])) { const u = S(e && (e.url || e.page_url || e.source_url)); if (u) oldRefs.set('u:' + AIRF.urlKey(u), { kind: 'earned', item: e }); }
    for (const x of (o.actions || [])) if (x && S(x.action)) oldRefs.set('a:' + AIRF.hash(S(x.type) + '|' + S(x.action)).toString(16), { kind: 'action', item: x });
    const inter = [...air.keys()].filter(k => oldRefs.has(k)); const union = new Set([...air.keys(), ...oldRefs.keys()]);
    const scored = [...(chosen || []).map(a => Object.assign({}, a, { scored: { gain: N((a.expected || {}).gain, 0) } })), ...(o.scored || []).filter(Boolean)]; const gainOf = (k) => { const c = scored.find(x => refA(x) === k || (k.indexOf('p:') === 0 && OWN_PAGE.includes(S(x.lever)) && S((x.ref || {}).prompt_id) === k.slice(2))); return c ? N((c.scored || c).gain, 0) : 0; };
    const gain_air = (chosen || []).reduce((s, a) => s + N((a.expected || {}).gain, 0), 0); let gain_old = 0; for (const k of oldRefs.keys()) gain_old += gainOf(k);
    const ca = uniq((chosen || []).map(a => CAUSE_OF[S(a.lever)]).filter(Boolean)); if ((chosen || []).length) ca.push(5); if ((chosen || []).some(a => S(a.executor) === 'human')) ca.push(6); if (o.panel && N(o.panel.core_n, 0) > 0) ca.push(3);
    const co = []; if ((o.targets || []).length) co.push(1); if ((o.earned || []).length) co.push(2); if ((o.actions || []).some(x => /bing|indexnow|robots|crawler|setup|mailbox/i.test(S(x && (x.type + ' ' + x.action))))) co.push(6);
    const refused_old = []; for (const t of [...(o.targets || []), ...(o.actions || [])]) { const txt = S(t && (t.question || '') + ' ' + (t.keyword || '') + ' ' + (t.page_type || '') + ' ' + (t.action || ''));
      for (const R of REFUSED) if (R.id !== 'R01' ? new RegExp(R.match, 'i').test(txt) : (/listicle|best .* list/i.test(S(t && t.page_type)) || (/^(best|top)\b/i.test(S(t && t.keyword)) && /list/i.test(S(t && t.page_type))))) refused_old.push({ what: txt.trim().slice(0, 120), id: R.id, why: R.why }); }
    return { overlap: union.size ? rd(inter.length / union.size, 4) : 0, overlap_n: inter.length, gain_air: rd(gain_air), gain_old: rd(gain_old), causes: { air: uniq(ca).sort(), old: uniq(co).sort() }, refused_old,
      note: 'Gains are AIR\'s own model, not independent. Overlap: shared targets over all targets of both plans.' }; };

  return { VERSION, LEVERS, REFUSED, ZERO_WEIGHT, U, VERDICTS, VERDICT_WORDS, MEMO_PARTS, MEMO_TITLES, ENGINE_W, CAPS, COST, HUMAN_NEW, ELIG, SITE_WIDE, STATS,
    value, feasibility, rivalsMedian, priorOf, candidates, score, choose, prereg, keepPrereg, verify, outcome, learnable, learn, brier, memo, compareOld, costOf, multOf, didOf };
})();
