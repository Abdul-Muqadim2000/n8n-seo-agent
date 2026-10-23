// W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the Sentiment Reader's jobs - EVERY answer of this run that names the business
// (no 24-job cap for this step), 20 passages to a Claude Haiku call. Runs in the run's last execution only (where AI Metrics measures the week):
// this execution's answers (Parse AI Answers, with their full text) and the ones earlier executions of a split run stored (Load AI Run Answers).
// At most 40 calls a run (800 answers, ~4 minutes): the answers past that are not read and the report says how many.
// ---- shared by the AI Visibility Tracker and the AI Pulse (inlined by the build; v4.9): sampling statistics and the visibility score ----
// AI answers vary from one ask to the next, so a rate is reported with its 95% interval (Wilson) and a change only counts when it is
// statistically real (two-proportion z-test) — a single unlucky sample must not raise an alert.
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 0]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, Math.round(1000 * (c - m) / d) / 10), Math.min(100, Math.round(1000 * (c + m) / d) / 10)]; };
const zTest = (k1, n1, k2, n2) => { if (!n1 || !n2) return 0; const p = (k1 + k2) / (n1 + n2); const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)); return se ? (k1 / n1 - k2 / n2) / se : 0; };
const significant = (k1, n1, k2, n2, minPts = 5) => Math.abs(zTest(k1, n1, k2, n2)) >= 1.96 && Math.abs(100 * (k1 / n1 - k2 / n2)) >= minPts;
// one answer's worth (0-1): named first and linked = 1; lower in the list counts less; a citation without the name still helps a little
const posWeight = (rank) => rank === 1 ? 1 : rank === 2 ? 0.8 : rank === 3 ? 0.65 : rank > 3 && rank <= 5 ? 0.5 : rank > 5 ? 0.35 : 0.6;   // rank 0 = named, position not known
// E7 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/F1b.md): the score reads NAMED, not "named or cited". An answer that only cites a page
// used to be scored as named at an unknown position (0.6) and the documented 0.4 for a citation alone was unreachable.
const answerScore = (a) => { const x = a || {}; if (!(x.answered === true || String(x.answered) === 'true')) return null; const cited = x.cited === true || String(x.cited) === 'true';
  return AVM.named(x) ? posWeight(AVM.position(x) || 0) * (cited ? 1 : 0.85) : (cited ? 0.4 : 0); };
// ---- F1b (2026-10-23, docs/ai-visibility-2026-10-23/ENGINE_AUDIT.md E6 E7 E13 E14 E19 + the position metric): ONE reading of an answer and
// ONE definition of every figure, used by the weekly headline, every engine, every segment, every competitor and the daily pulse alike.
//   named        the answer names the business in its text (a citation alone is not a recommendation)
//   cited        the answer links one of the business's pages
//   position     1-based place of the business among the businesses the answer names (the business itself and its competitors only)
//   share of voice  answers' mentions of you / (yours + every competitor's), over the answers whose competitors were recorded; its standard
//                error is taken over ANSWERS (the unit that was sampled), never over mentions (E19)
//   position-weighted visibility  the mean over answers of the position weight (named 1st = 1, 2nd = .8, 3rd = .65, 4-5th = .5, lower = .35,
//                named with no known place = .6, not named = 0), x100
// RULE_VERSION is stored on every row these figures are written to. A row measured under another rule is never compared with this one.
const AVM = (() => {
  const RULE_VERSION = 'aivis-2026-10-23';
  const MIN = 12;   // the answer floor every rate already uses (MIN_RATE_SAMPLES)
  const tb = (v) => v === true || String(v) === 'true';
  const has = (v) => v !== undefined && v !== null && v !== '';
  const r1 = (x) => Math.round(10 * x) / 10;
  const arr = (v) => { if (Array.isArray(v)) return v; if (!has(v)) return null; try { const x = JSON.parse(String(v)); return Array.isArray(x) ? x : null; } catch (e) { return null; } };
  /** named: the row's own `named` (F1a, 2026-10-23); an older row: mentioned and either placed in the list or not cited (mentioned was named OR cited) */
  const named = (a) => !a ? false : has(a.named) ? tb(a.named) : (tb(a.mentioned) && (Number(a.rank) > 0 || !tb(a.cited)));
  /** the business's place among the named businesses, or null (not named, or the place was not read) */
  const position = (a) => { if (!named(a)) return null; const v = has(a.position) ? Number(a.position) : Number(a.rank); return v > 0 ? Math.round(v) : null; };
  /** the competitors an answer named: [{ id, position, cited }], or null when the row recorded none (then the answer is left out of share of
   *  voice on BOTH sides). New rows: `entities` with role 'competitor'. Older rows: the `competitors` list in order. */
  const rivals = (a, o) => { const opt = o || {}; const key = opt.key || ((x) => x); const keep = opt.keep || (() => true);
    const out = new Map(); const add = (id, pos, cited) => { const k = key(String(id || '').trim()); if (!k || !keep(k)) return; const x = out.get(k);
      if (!x) out.set(k, { id: k, position: pos > 0 ? pos : null, cited: !!cited }); else { if (pos > 0 && (!x.position || pos < x.position)) x.position = pos; x.cited = x.cited || !!cited; } };
    const ents = arr(a && a.entities) || arr(a && a.entities_json);   // F1a's rows: `entities` in memory, `entities_json` once stored
    if (ents) { for (const e of ents) if (e && String(e.role) === 'competitor') add(e.id || e.name, Number(e.position), tb(e.cited)); return [...out.values()]; }
    if (!a || a.competitors === undefined || a.competitors === null) return null;
    const self = position(a); const srcs = String(a.sources || '').split(/,\s*/).filter(Boolean).map(s => s.toLowerCase());
    String(a.competitors || '').split(/,\s*/).filter(Boolean).forEach((c, i) => { const pos = i + 1 + (self && self <= i + 1 ? 1 : 0); const lc = c.toLowerCase();
      add(c, pos, /\./.test(lc) && srcs.some(h => h === lc || h.endsWith('.' + lc))); });
    return [...out.values()]; };
  /** a ratio over answers (share of voice): pairs [y, x] per answer (y = mentions counted in the numerator, x = all mentions). The standard
   *  error is the linearised one over the answers that named anybody (Cochran's ratio estimator), in percentage points. */
  const ratio = (pairs) => { const P = (pairs || []).filter(q => q && q[1] > 0); const n = P.length; const Y = P.reduce((s, q) => s + q[0], 0), X = P.reduce((s, q) => s + q[1], 0);
    if (!n || !X) return { rate: null, se: null, n, y: Y, x: X };
    const R = Y / X, xbar = X / n; const s2 = n > 1 ? P.reduce((s, q) => s + Math.pow(q[0] - R * q[1], 2), 0) / (n - 1) : 0;
    return { rate: r1(100 * R), se: Math.round(1000 * 100 * Math.sqrt(s2 / n) / xbar) / 1000, n, y: Y, x: X }; };
  /** a mean with its standard error (positions, position weights) */
  const mean = (xs) => { const v = (xs || []).filter(x => Number.isFinite(x)); const n = v.length; if (!n) return { mean: null, sd: null, se: null, n: 0 };
    const m = v.reduce((s, x) => s + x, 0) / n; const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (n - 1)) : 0;
    return { mean: Math.round(100 * m) / 100, sd: Math.round(1000 * sd) / 1000, se: Math.round(1000 * sd / Math.sqrt(n)) / 1000, n }; };
  /** one group of answers (the headline, an engine, a segment) measured the same way: units are { named, cited, position, rivals } */
  const agg = (units) => { const U = units || []; const n = U.length; let k = 0, c = 0, f = 0; const pos = [], pv = [], pairs = [];
    for (const u of U) { if (u.named) { k++; if (u.position) { pos.push(u.position); if (u.position === 1) f++; } } if (u.cited) c++;
      pv.push(u.named ? 100 * posWeight(u.position || 0) : 0);
      if (u.rivals) pairs.push([u.named ? 1 : 0, (u.named ? 1 : 0) + u.rivals.length]); }
    const P = mean(pos), V = mean(pv), S = ratio(pairs);
    return { n, named: k, cited: c, first: f, named_rate: n ? r1(100 * k / n) : null, cited_rate: n ? r1(100 * c / n) : null, first_rate: n ? r1(100 * f / n) : null,
      named_ci: wilson(k, n), cited_ci: wilson(c, n), enough: n >= MIN,
      avg_position: P.mean == null ? null : r1(P.mean), position_n: P.n, position_sd: P.sd, position_enough: P.n >= MIN,
      pos_visibility: V.mean == null ? null : r1(V.mean), pos_visibility_se: V.se,
      sov: S.rate, sov_se: S.se, sov_n: S.n, sov_self: S.y, sov_mentions: S.x, sov_answers: pairs.length }; };
  /** competitor j over the same answers: its mentions / everybody's, named rate, cited rate, place */
  const rivalAgg = (units, id) => { const U = units || []; const n = U.length; let k = 0, c = 0; const pos = [], pairs = [];
    for (const u of U) { const r = (u.rivals || []).find(x => x.id === id); if (r) { k++; if (r.cited) c++; if (r.position) pos.push(r.position); }
      if (u.rivals) pairs.push([r ? 1 : 0, (u.named ? 1 : 0) + u.rivals.length]); }
    const P = mean(pos), S = ratio(pairs);
    return { n, named: k, named_rate: n ? r1(100 * k / n) : null, cited: c, cited_rate: n ? r1(100 * c / n) : null, avg_position: P.mean == null ? null : r1(P.mean), position_n: P.n, position_sd: P.sd,
      sov: S.rate, sov_se: S.se, sov_n: S.n, enough: n >= MIN }; };
  const pOf = (z) => (z == null || !isFinite(z)) ? null : Math.round(1e6 * Math.max(0, Math.min(1, 2 * (1 - normCdf(Math.abs(z)))))) / 1e6;
  /** the change in a ratio or a mean between two independent runs: z = difference / sqrt(se1^2 + se2^2); significant at |z| >= 1.96 and the
   *  minimum size; under MIN units on either side it is not tested */
  const seChange = (now, se1, n1, before, se2, n2, o) => { const opt = o || {}; const minD = opt.min == null ? 5 : opt.min; const floor = opt.floor == null ? MIN : opt.floor;
    if (now == null || before == null) return { delta: null, z: null, p: null, significant: null, why: 'there is no earlier figure to compare' };
    const d = r1(now - before);
    if (!(n1 >= floor) || !(n2 >= floor)) return { delta: d, z: null, p: null, significant: null, why: 'too few answers to test it (' + (n1 || 0) + ' now, ' + (n2 || 0) + ' before; ' + floor + ' needed on each side)' };
    const se = Math.sqrt(Math.pow(Number(se1) || 0, 2) + Math.pow(Number(se2) || 0, 2));
    if (!se) return { delta: d, z: null, p: null, significant: d === 0 ? false : null, why: d === 0 ? 'no change' : 'neither sample varies, so the change cannot be tested' };
    const z = Math.round(100 * (now - before) / se) / 100; const sig = Math.abs(z) >= 1.96 && Math.abs(d) >= minD;
    return { delta: d, z, p: pOf(z), significant: sig, why: (sig ? 'beyond sampling noise' : 'within sampling noise') + ' (z ' + z + ', ' + n1 + ' answers now and ' + n2 + ' before)' }; };
  return { RULE_VERSION, MIN, tb, has, arr, named, position, rivals, ratio, mean, agg, rivalAgg, seChange, pOf };
})();
// questions people ask more often weigh more, but no single question dominates (log scale; unknown volume = weight 1)
const volWeight = (v) => 1 + Math.log10(1 + Math.max(0, Number(v) || 0)) / 2;
const visibilityScore = (answers, volumeOf) => { let s = 0, w = 0; for (const a of answers) { const x = answerScore(a); if (x === null) continue; const wt = volWeight(volumeOf ? volumeOf(a) : 0); s += x * wt; w += wt; } return w ? Math.round(1000 * s / w) / 10 : 0; };
// ---- D19 (2026-10-11 system review): what counts as a brand, and one page one URL ----
// A brand must be a business, not a heading or a category: ChatGPT's own brand list gave the heading "Tax technology and e-invoicing
// software" and it was counted as a competitor (exec 362 / 363). A name without a website counts only when it reads like one: at most
// 4 words, every word starting with a capital or a digit (or an inner capital: eBay), no joining word (and / or / for / in / vs: a
// phrase, not a name), no sentence punctuation, and not a plain category ("Software Solutions"). A name that maps to a domain (an
// alias learned by the Answer Analyst, a configured competitor, a link in the answer) always counts, whatever its shape.
const BRAND_CATEGORY = /^(software|solutions?|services?|providers?|vendors?|tools?|platforms?|systems?|companies|company|consultants?|consultancies|agencies|agency|partners?|suppliers?|products?|apps?|options?|alternatives?|experts?|specialists?|firms?|list|guide|guides|comparison|reviews?|pricing|features?|top|best)$/i;
const BRAND_JOIN = /(^|\s)(and|or|for|with|in|on|of|the|a|an|to|at|by|vs|versus|&)(\s|$)/i;
const brandish = (name) => {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 40 || /[:;,|/\\?!]|\.{2}/.test(n) || BRAND_JOIN.test(n)) return false;
  const w = n.split(' '); if (w.length > 4) return false;
  const letters = (x) => x.replace(/[^A-Za-z]/g, '');
  if (w.every(x => BRAND_CATEGORY.test(letters(x)))) return false;
  return w.every(x => /^[A-Z0-9]/.test(x) || /^[a-z]+[A-Z]/.test(x));
};
// one page, one URL: the host without "www.", no fragment (ChatGPT links carry "#:~:text=" highlights) and no tracking parameters
// (every ChatGPT link carries utm_source=chatgpt.com), so the bare host and the www host of the same page are counted once. The scheme
// and the real query are kept: this is the page we may ask to be named on, not only a key.
const CITE_TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+)$/i;
const cleanCiteUrl = (u) => {
  const s = String(u || '').trim();
  const m = s.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!m) return s.replace(/#.*$/, '');
  const host = m[2].toLowerCase().replace(/^www\./, '').replace(/:(?:80|443)$/, '');
  const q = (m[4] || '').replace(/^\?/, '').split('&').filter(kv => kv && !CITE_TRACK.test(kv.split('=')[0])).join('&');
  return m[1].toLowerCase() + '://' + host + (m[3] || '/') + (q ? '?' + q : '');
};
// a source chip sometimes shows only a fragment of the title ("E", "Best e" live on 2026-10-11, G22): too short to be a title, so it is
// dropped and the page's own <title> is read later (AI Growth fetches the cited pages). A real title is never cut here.
const citeTitle = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length >= 8 ? s.slice(0, 160) : ''; };
// one business, one key: a brand name the engines write ("Azentio Software", "ClearTax") joins the website it belongs to — a learned name
// (Answer Analyst) or a name matching the domain's label (cleartax.com, azentio.com, edicomgroup.com); other names stay names
const labelOf = (d) => String(d).toLowerCase().replace(/^www\./, '').split('.')[0].replace(/-/g, '');
const brandKey = (name, domains, aliases) => { const n = String(name || '').trim(); if (!n || /\./.test(n)) return n.toLowerCase();
  const al = aliases ? Object.entries(aliases).find(([k]) => k.toLowerCase() === n.toLowerCase()) : null; if (al && /\./.test(al[1])) return al[1];
  const compact = n.toLowerCase().replace(/[^a-z0-9]+/g, ''); const first = (n.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0]) || '';
  const hit = (domains || []).find(d => { const l = labelOf(d); return (l.length >= 4 && l === compact) || (first.length >= 5 && l === first) || (first.length >= 6 && l.startsWith(first)) || (l.length >= 6 && compact.startsWith(l)); });
  return hit || n; };
// ---- R14 (2026-10-13, re-rating §3.11): a market-index row matched by NAME is not evidence about this website ----
// The market-wide table printed `"Tech&" by name (you) | 19,579 answers | 16,421,600 AI searches` as its first row, directly under the
// headline "Market-wide share 0% — 0 AI answers cite you", while the run's own 54 samples named the business 0 times and the next row was
// microsoft.com with 1,897: the index had matched the 4-letter name inside the whole "tech" family — P34-2's collapse again. The owner's own
// row must come from a DOMAIN match. A name-only row is dropped (never "you", never in the share arithmetic) when the name is shorter than
// the brand-token bar P34-2 set (NAME_MIN_TOKEN = 5 alphanumeric characters) or when it claims orders of magnitude more answers than this
// run measured and than any domain in the same table; a distinctive name that is in reach of the measurement is kept and labelled.
const NAME_MIN_TOKEN = 5;        // the same whole-brand-token bar as OK.namesUs (P34-2)
const NAME_PEER_RATIO = 10;      // "orders of magnitude": more than 10x the biggest domain row while our own samples never named us
const indexNameRow = (name, mentions, o) => {
  const opts = o || {};
  const token = String(name || '').replace(/[^A-Za-z0-9]+/g, '');
  const m = Math.max(0, Number(mentions) || 0);
  const peak = Math.max(0, Number(opts.peer_max) || 0);
  const measured = Math.max(0, Number(opts.measured_mentions) || 0);
  if (!token) return { ok: false, why: 'the index row carries no name to match on' };
  if (token.length < NAME_MIN_TOKEN) return { ok: false, why: '"' + String(name).trim() + '" is too short a name (' + token.length + ' characters) to match on its own: the index counts it inside other companies\' names' };
  if (!measured && peak && m > peak * NAME_PEER_RATIO) return { ok: false, why: '"' + String(name).trim() + '" by name claims ' + m + ' answers against ' + peak + ' for the biggest website in the same table, while this run\'s own samples named the business ' + measured + ' times' };
  return { ok: true, why: 'not matched to your website: the index counted this name, so the row has no share of yours in it' };
};
const mergeBrands = (entries, aliases) => { const doms = entries.map(([k]) => k).filter(k => /\./.test(k)); const out = new Map();   // [[key, value]] -> Map with names folded into domains (min for positions, sum for counts via the caller)
  for (const [k, v] of entries) { const key = brandKey(k, doms, aliases); out.set(key, out.has(key) ? [...out.get(key), v] : [v]); } return out; };
// ---- B8-1 ... B8-4 (2026-10-15, benchmark programme area 8 - docs/system-review-2026-10-14/BENCH_AREA8_ai_visibility.md) ----
// Every headline figure in this area is a proportion of a small, deliberately noisy sample: the same question asked twice returns a
// different brand list (SparkToro measured the same list coming back under 1% of the time). The mention rate has carried its 95% range
// and a two-proportion z-test since v4.9 - the citation rate, the share of voice, the visibility score and the per-question win rate
// did not, and were printed as bare arrows beside it. One shape for all of them: a change is tested, or it says it was not tested.
// INVARIANTS rule 1 - measured, modelled or not available, and it says which.
const MIN_RATE_SAMPLES = 12;        // under this a rate is a straw poll: it is shown with its range and no verdict is drawn from it
const MIN_Q_SAMPLES = 4;            // a per-question win rate: 1 of 1 is not "named in 100% of answers"
/** a rate with the sample it was measured on: the figure, its 95% Wilson range, and whether there were enough answers to mean anything */
const rateOf = (k, n, o) => {
  const opt = o || {}; const min = opt.min == null ? MIN_RATE_SAMPLES : opt.min;
  const kk = Math.max(0, Number(k) || 0), nn = Math.max(0, Number(n) || 0);
  const unit = String(opt.unit || 'answer');
  return { rate: nn ? Math.round(1000 * kk / nn) / 10 : null, k: kk, n: nn, ci: wilson(kk, nn), min,
    basis: nn ? 'measured' : 'not_available', enough: nn >= min,
    why: !nn ? 'no ' + unit + ' came back, so there is no rate' : nn >= min ? ''
      : 'measured on ' + nn + ' ' + unit + (nn === 1 ? '' : 's') + ' only - a rate needs ' + min + ' before it says anything' };
};
/** the one test every proportion change goes through: significant, not significant, or not testable - each with the words for why */
const changeOf = (k1, n1, k2, n2, o) => {
  const opt = o || {}; const minPts = opt.min_points == null ? 5 : opt.min_points; const z0 = opt.z == null ? 1.96 : opt.z;
  const a = Math.max(0, Number(n1) || 0), b = Math.max(0, Number(n2) || 0);
  if (!a || !b) return { delta: null, significant: null, z: null, basis: 'not_available', samples: a, samples_before: b,
    why: 'nothing to compare: ' + (!a && !b ? 'neither reading has a sample' : !a ? 'this reading has no answers' : 'the earlier reading recorded no sample size') };
  const d = Math.round(1000 * (k1 / a - k2 / b)) / 10;
  const z = Math.round(100 * zTest(k1, a, k2, b)) / 100;
  const sig = Math.abs(z) >= z0 && Math.abs(d) >= minPts;
  return { delta: d, significant: sig, z, basis: 'measured', samples: a, samples_before: b, min_points: minPts,
    why: sig ? 'beyond sampling noise (z ' + z + ' over ' + a + ' answers now and ' + b + ' before)'
      : 'within sampling noise (z ' + z + '; a change counts at |z| ' + z0 + ' and ' + minPts + ' points - ' + a + ' answers now, ' + b + ' before)' };
};
/** The visibility score is a WEIGHTED MEAN of per-answer scores, not a proportion, so Wilson does not apply to it. Its uncertainty is
 *  the standard error of that weighted mean over Kish's effective sample size, reported as a 95% band on the same 0-100 scale. A change
 *  is only called one when it clears this run's own band - we do not store the earlier run's, and inventing one would be the defect. */
const scoreBand = (answers, volumeOf) => {
  const xs = [], ws = [];
  for (const a of (answers || [])) { const x = answerScore(a); if (x === null) continue; xs.push(x); ws.push(volWeight(volumeOf ? volumeOf(a) : 0)); }
  const n = xs.length; const W = ws.reduce((s, w) => s + w, 0);
  if (!n || !W) return { score: null, lo: null, hi: null, half: null, n: 0, n_eff: 0, basis: 'not_available', why: 'no answer could be scored' };
  const mean = xs.reduce((s, x, i) => s + x * ws[i], 0) / W;
  const W2 = ws.reduce((s, w) => s + w * w, 0);
  const n_eff = W2 ? (W * W) / W2 : n;                                     // Kish: how many equally weighted answers this sample is worth
  const varW = n > 1 ? (xs.reduce((s, x, i) => s + ws[i] * (x - mean) * (x - mean), 0) / W) * (n / (n - 1)) : 0;
  const se = n_eff > 0 ? Math.sqrt(varW / n_eff) : 0;
  const half = Math.round(1000 * 1.96 * se) / 10;                          // on the 0-100 scale the score is printed on
  const s100 = Math.round(1000 * mean) / 10;
  return { score: s100, half, lo: Math.max(0, Math.round(10 * (s100 - half)) / 10), hi: Math.min(100, Math.round(10 * (s100 + half)) / 10),
    n, n_eff: Math.round(10 * n_eff) / 10, basis: 'modelled',
    why: 'position and demand weighted over ' + n + ' scored answer' + (n === 1 ? '' : 's') + ' (worth ' + (Math.round(10 * n_eff) / 10) + ' equally weighted ones)' };
};
/** a change in the score, judged against the band above - never against a band we did not measure */
const scoreChange = (now, before, band) => {
  if (now == null || before == null) return { delta: null, significant: null, basis: 'not_available', why: 'there is no earlier score to compare' };
  const d = Math.round(10 * (now - before)) / 10;
  const half = band && band.half != null ? band.half : null;
  if (half == null) return { delta: d, significant: null, basis: 'modelled', why: 'how wide this run\'s score could be was not measured, so the change is not called one' };
  const sig = Math.abs(d) > half;
  return { delta: d, significant: sig, basis: 'modelled', half,
    why: sig ? 'larger than this run\'s own 95% band (+/-' + half + ' points)' : 'inside this run\'s own 95% band (+/-' + half + ' points), so it is not a change we can call' };
};
/** B8-2 / B8-3: two readings of a NOISY PANEL are the same measurement only when the same questions were asked of the same engines.
 *  B-L4 put this guard on the weekly tracker the same day and left the daily pulse pooling seven days of baseline with no check at
 *  all - so adding twelve questions, or switching an engine on, moved the pooled rate and fired a 99% "a real drop, not sampling
 *  noise". The engine set has to match exactly (a different engine is a different measurement); the panel may drift by a fifth, the
 *  same tolerance R19 set for a sample. Returns the days that may be pooled and, for each one left out, the reason in words. */
const PANEL_DRIFT = 0.2;            // the same tolerance R19 set for a sample that moved under a comparison
const sameBasis = (day, now) => {
  const a = [...new Set(day.engines || [])].sort(), b = [...new Set(now.engines || [])].sort();
  if (!a.length) return { ok: false, why: 'which engines answered that day was not recorded' };
  if (a.join('+') !== b.join('+')) return { ok: false, why: 'answered by ' + a.join(', ') + ', today by ' + (b.join(', ') || 'no engine') };
  const p = Math.max(0, Number(day.size) || 0), q = Math.max(0, Number(now.size) || 0);
  if (!p || !q) return { ok: false, why: 'how many answers that reading was measured on was not recorded' };
  const drift = Math.abs(p - q) / Math.max(p, q);
  if (drift > PANEL_DRIFT) return { ok: false, why: p + ' answers that day against ' + q + ' today — a different panel, not a different result' };
  return { ok: true, why: '' };
};
// ---- B8-8 / B8-9 / B8-10 (2026-10-17, wave 3, benchmark area 8 - docs/system-review-2026-10-14/BENCH_AREA8_ai_visibility.md) ----
// B8-9: one run raises several alerts off the SAME sample, each judged at 95% on its own - so a quiet week raises a false one far more
// often than 1 in 20. The tested alerts of one run are one family and are corrected together (Holm's step-down, which controls the
// family-wise error at alpha whatever the dependence between the tests). A test enters the family when its alert could fire on it -
// the change points the way the alert reads - and the threshold each one had to clear is kept and printed beside it.
const normCdf = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);   // Abramowitz-Stegun 26.2.17, error < 1e-7
  const q = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x >= 0 ? 1 - q : q; };
/** two-sided p of a z score; null when there was no test */
const pTwo = (z) => (z == null || !isFinite(Number(z))) ? null : Math.max(0, Math.min(1, 2 * (1 - normCdf(Math.abs(Number(z))))));
/** the |z| a two-sided test needs to reach p (bisection on pTwo) */
const zFor = (p) => { let lo = 0, hi = 12; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (pTwo(mid) > p) lo = mid; else hi = mid; } return Math.round(100 * hi) / 100; };
const fmtP = (p) => p == null ? '-' : p >= 0.001 ? String(Math.round(p * 10000) / 10000) : p.toExponential(1);
/** Holm's step-down over [{ id, z }]: sorted by p, the i-th (0-based) of m must clear alpha / (m - i), and the first that does not
 *  stops every one after it. Returns each test's p, the threshold it had to clear, whether it cleared it, and the words for both. */
const holm = (tests, alpha) => {
  const a = alpha == null ? 0.05 : alpha;
  const T = (tests || []).filter(t => t && t.z != null && isFinite(Number(t.z))).map(t => ({ id: t.id, label: t.label || t.id, z: Number(t.z), p: pTwo(t.z) }));
  const m = T.length; const order = T.slice().sort((x, y) => x.p - y.p);
  let open = true; const res = {};
  order.forEach((t, i) => { const thr = a / (m - i); const ok = open && t.p <= thr; if (!ok) open = false;
    res[t.id] = { id: t.id, label: t.label, z: t.z, p: Math.round(t.p * 1e6) / 1e6, rank: i + 1, threshold_p: Math.round(thr * 1e6) / 1e6, threshold_z: zFor(thr), reject: ok,
      why: (ok ? 'cleared' : 'did not clear') + ' the Holm-adjusted threshold (p ' + fmtP(t.p) + (ok ? ' ≤ ' : ' > ') + fmtP(thr) + ', step ' + (i + 1) + ' of ' + m + ' tested alerts this run)' }; });
  const strict = m ? a / m : null;
  const rejected = Object.values(res).filter(r => r.reject).length;
  return { method: 'holm', alpha: a, tests: m, threshold_p: strict == null ? null : Math.round(strict * 1e6) / 1e6, threshold_z: strict == null ? null : zFor(strict),
    rejected, results: order.map(t => res[t.id]), by: res,
    note: !m ? 'No alert this run rested on a statistical test, so no multiple-comparison correction was needed.'
      : 'Alerts that rest on a test are judged together, Holm-adjusted across the ' + m + ' tested alert' + (m === 1 ? '' : 's') + ' of this run at ' + Math.round(a * 100) + '% family-wise: the strongest needed p ≤ ' + fmtP(strict) + ' (|z| ≥ ' + zFor(strict) + ')' + (m > 1 ? ', each next one a little less' : '') + '; ' + rejected + ' cleared it.' };
};
/** the words an alert carries for the threshold it cleared */
const holmWords = (h, id) => { const r = h && h.by ? h.by[id] : null; return r ? 'p ' + fmtP(r.p) + ', under the Holm-adjusted threshold p ≤ ' + fmtP(r.threshold_p) + ' across the ' + h.tests + ' tested alert' + (h.tests === 1 ? '' : 's') + ' of this run' : ''; };
// ---- G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the SEGMENT family — Benjamini-Hochberg, not Holm ----
// A 500-question panel is read per engine x topic cluster x buyer role x market x funnel stage: dozens to hundreds of rate changes a
// week. Holm controls the chance of even ONE false call across the family; over 200 tests its first step needs p <= 0.00025 (|z| >= 3.66),
// so a segment moving 15 points on 150 answers would never be called — the correction would make every real move invisible. For the
// segment table we control the FALSE DISCOVERY RATE instead (Benjamini-Hochberg, q = 0.10: of the segment moves called, about 1 in 10
// at most is noise), which is the accepted rule for screening many comparisons. The headline ALERTS keep Holm: they are few (<= ~10)
// and each one interrupts the owner, so for them even one false call is too many.
/** Benjamini-Hochberg over [{ id, z }]: sorted by p, the largest rank i (1-based) with p_(i) <= q * i / m and every test up to it is a
 *  discovery. Returns each test's p, its rank, the threshold of its rank, whether it is a discovery, and the words. */
const bh = (tests, q) => {
  const Q = q == null ? 0.1 : q;
  const T = (tests || []).filter(t => t && t.z != null && isFinite(Number(t.z))).map(t => ({ id: t.id, label: t.label || t.id, z: Number(t.z), p: pTwo(t.z) }));
  const m = T.length; const order = T.slice().sort((x, y) => x.p - y.p);
  let cut = 0; order.forEach((t, i) => { if (t.p <= Q * (i + 1) / m) cut = i + 1; });
  const by = {}; order.forEach((t, i) => { const thr = Q * (i + 1) / m; const ok = i < cut;
    by[t.id] = { id: t.id, label: t.label, z: t.z, p: Math.round(t.p * 1e6) / 1e6, rank: i + 1, threshold_p: Math.round(thr * 1e6) / 1e6, discovery: ok,
      why: (ok ? 'a real move' : 'within noise') + ' at a ' + Math.round(Q * 100) + '% false discovery rate (p ' + fmtP(t.p) + (ok ? ' within' : ', not within') + ' the Benjamini-Hochberg cut of ' + m + ' segment test' + (m === 1 ? '' : 's') + ')' }; });
  const rejected = Object.values(by).filter(r => r.discovery).length;
  return { method: 'benjamini-hochberg', q: Q, tests: m, rejected, by,
    note: !m ? 'No segment had enough answers on both sides to test a change.'
      : m + ' segment change' + (m === 1 ? ' was' : 's were') + ' tested together, at a ' + Math.round(Q * 100) + '% false discovery rate (Benjamini-Hochberg: of the moves called real, about 1 in ' + Math.round(1 / Q) + ' at most may be noise); '
        + rejected + ' cleared it. The headline alerts are judged separately, Holm-adjusted, because each one interrupts you.' };
};
// B8-8: a per-engine change is tested on that engine's own answers, and below this many on EITHER side it is not tested at all
const MIN_ENGINE_SAMPLES = MIN_RATE_SAMPLES;
const engineChange = (kNow, nNow, kBefore, nBefore, o) => {
  const a = Math.max(0, Number(nNow) || 0), b = Math.max(0, Number(nBefore) || 0); const floor = (o && o.min) || MIN_ENGINE_SAMPLES;
  if (a < floor || b < floor) return { tested: false, delta: null, z: null, samples: a, samples_before: b, k: kNow, k_before: kBefore, basis: a && b ? 'measured' : 'not_available',
    why: 'too few answers from this engine to tell (' + a + ' now, ' + b + ' before; a change needs ' + floor + ' on each side)' };
  const t = changeOf(kNow, a, kBefore, b, o); return { tested: true, ...t, k: kNow, k_before: kBefore };
};

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
// ---- W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): how AI answers speak of the business, aspect by aspect (inlined by build_monitors.py) ----
// Every answer that NAMES the business is read (no 24-job cap for this step): its polarity about the business (positive / neutral / negative),
// the aspects it judges (price, support, integration, trust, quality, ease, features, other) each with its own polarity, the objection a buyer
// would take from it, and how it speaks of each competitor it names. The reader is Claude Haiku (*Sentiment Reader*); the RULE READER below
// is its fallback when the model does not answer, and a second opinion whose agreement with the model is printed every run.
// Net sentiment = (positive - negative) / answers read, in points (-100..100), with a 95% range over QUESTIONS (AVX.ratio); withheld below 12.
// The rule reader and the model-output parser are scored on harness/accuracy/ai_sentiment.json (hold-out written before the rules; Cohen's
// kappa printed; the harness fails below 0.7). The model itself cannot be run offline: accuracy/eval_sentiment_model.js scores it with a key.
const SENT = (() => {
  const ASPECTS = ['price', 'support', 'integration', 'trust', 'quality', 'ease', 'features', 'other'];
  const POL = ['positive', 'neutral', 'negative'];
  const MIN = 12;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe = (n) => { const s = String(n || '').trim(); if (!s) return null; return new RegExp('(^|[^\\p{L}\\p{N}])' + esc(s).replace(/\s+/g, '\\s+') + '(?=$|[^\\p{L}\\p{N}])', 'iu'); };
  // cue words (lower case; phrases first). Each is [pattern, weight]; a negation in the 3 words before flips it.
  const POS = ['highly rated', 'top-rated', 'top rated', 'well-regarded', 'well regarded', 'well-known', 'well known', 'stands out', 'standout', 'award-winning', 'cost-effective', 'cost effective', 'good value', 'great value', 'value for money',
    'user-friendly', 'user friendly', 'easy to use', 'easy to set up', 'simple to use', 'straightforward', 'no hidden fees', 'hands-on', 'on time', 'track record', 'gold partner', 'trusted', 'reliable', 'robust', 'strong', 'excellent', 'outstanding',
    'great', 'good', 'best', 'leading', 'leader', 'top', 'popular', 'recommended', 'recommend', 'ideal', 'praised', 'praise', 'affordable', 'cheapest', 'cheap', 'competitive', 'transparent', 'easy', 'easiest', 'intuitive', 'seamless', 'seamlessly',
    'comprehensive', 'powerful', 'fast', 'quick', 'responsive', 'accredited', 'certified', 'certification', 'approved', 'compliant', 'secure', 'reputable', 'renowned', 'prominent', 'proven', 'preferred', 'solid', 'flexible', 'scalable',
    'innovative', 'experienced', 'expert', 'expertise', 'efficient', 'accurate', 'safest', 'safe', 'favourite', 'favorite', 'loved', 'love', 'clean', 'natively', 'native', 'mature', 'established', 'specialist', 'advanced', 'rich', 'wide range', 'extensive', 'positive reviews', 'notable',
    // round 2 (after the first hold-out, 2026-10-23): what real and written answers praise with
    'painless', 'smooth', 'hassle-free', 'in an afternoon', 'fair value', 'fair', 'worth it', 'worth', 'highlight', 'highlights', '24/7', 'connects directly', 'stayed up', 'stayed online', 'dependable', 'unlimited', 'widely used', 'pragmatic', 'commercially minded', 'appear on', 'listed by', 'listed on'];
  const NEG = ['steep learning curve', 'learning curve', 'hidden fees', 'mixed reviews', 'negative reviews', 'not suitable', 'not yet', 'english only', 'only in english', 'higher than', 'more expensive', 'adds up', 'go unresolved', 'charges extra', 'extra for',
    'expensive', 'pricey', 'costly', 'overpriced', 'steep', 'limited', 'limiting', 'limits', 'lacks', 'lack', 'lacking', 'missing', 'complaints', 'complain', 'complained', 'slow', 'slower', 'poor', 'weak', 'difficult', 'hard', 'complex',
    'complicated', 'clunky', 'outdated', 'dated', 'buggy', 'bugs', 'crashes', 'crash', 'issues', 'problems', 'problem', 'downtime', 'outages', 'outage', 'unreliable', 'inaccurate', 'errors', 'drawback', 'drawbacks', 'downside', 'downsides', 'concerns', 'concern',
    'criticised', 'criticized', 'criticism', 'delays', 'delayed', 'frustrating', 'frustrated', 'cumbersome', 'restrictive', 'unexpected charges', 'unresolved', 'breach', 'penalty', 'fined', 'lawsuit', 'risk', 'risky', 'young company', 'few', 'fewer', 'longer', 'unclear', 'confusing', 'beware', 'be aware', 'caution', 'cancel', 'churn',
    // round 2: implicit criticism
    'waited', 'nobody', 'over budget', 'slipped', 'break', 'breaks', 'broke', 'manual', 'add up', 'thin', 'requires paid', 'patchy', 'junior', 'relies on', 'csv uploads', 'can take', 'take days', 'hours or more', 'struggled', 'struggles', 'no phone support', 'no live support', 'no native', 'no arabic', 'no api', 'no mobile app', 'are mixed', 'is mixed'];
  const NEGATE = /\b(not|no|never|isn't|isnt|aren't|doesn't|doesnt|don't|didn't|without|hardly|nor|cannot|can't|lacks?)\b/i;
  const ASP = { price: /\b(price[ds]?|pricing|cost(s|ly)?|expensive|cheap(est)?|afford\w*|fees?|value|subscription|plans?|charges?|charged|billing|budget|pricey|overpriced|per (invoice|user|month))\b/i,
    support: /\b(support|customer service|service team|onboarding|help ?desk|respon(sive|se|d)|account manager|training|after go-live|documentation|tickets?)\b/i,
    integration: /\b(integrat\w*|connect\w*|apis?|plug\w*|sync\w*|erp|sap|oracle|netsuite|dynamics|carrier|bank integrations?)\b/i,
    trust: /\b(accredit\w*|certif\w*|approved|complian\w*|trust\w*|reputa\w*|secur\w*|iso ?\d*|gdpr|fta|zatca|licen[cs]ed|track record|partner|case studies|young company|audited|regulat\w*|safest)\b/i,
    quality: /\b(accura\w*|inaccura\w*|quality|reliab\w*|unreliable|errors?|bugs?|buggy|crash\w*|uptime|outages?|downtime|performance|on time|delays?|delivering)\b/i,
    ease: /\b(easy|easiest|ease|intuitive|user[- ]friendly|simple|straightforward|learning curve|complex|complicated|clunky|set ?up|usab\w*|navigate|interface|learn)\b/i,
    features: /\b(features?|functional\w*|capabilit\w*|modules?|reporting|reports?|automation|tools?|comprehensive|suite|templates?|consolidation|validation|english only|arabic|multi-entity|workflows?|app)\b/i };
  const hits = (clause, list, orig) => { const lc = ' ' + clause.toLowerCase() + ' '; const ctx = orig ? ' ' + String(orig).toLowerCase() + ' ' : lc; let s = 0; const found = [];
    let masked = lc; for (const w of list) { const re = new RegExp('(^|[^a-z])' + esc(w) + '(?=$|[^a-z])', 'g'); let m; while ((m = re.exec(masked))) { const at = m.index + m[1].length; const before = ctx.slice(Math.max(0, at - 30), at).trim().split(/\s+/).slice(-3).join(' ');
        const after = ctx.slice(at + w.length, at + w.length + 30).trim().split(/\s+/).slice(0, 3).join(' ');
        const neg = (NEGATE.test(before) && !/^no /.test(w)) !== /\b(rare|rarely|minimal|resolved)\b/.test(after);
        const others = /\b(other (platforms|vendors|providers|tools|firms|companies|apps|systems)|competitors?|rivals?|most vendors)\b/.test(ctx.slice(Math.max(0, at - 40), at).trim().split(/\s+/).slice(-4).join(' '));
        found.push({ w, neg, others }); if (!others) s += neg ? -1 : 1; masked = masked.slice(0, at) + ' '.repeat(w.length) + masked.slice(at + w.length); re.lastIndex = at + w.length; } }
    return { s, found, masked }; };
  /** the clauses that speak of the business: its sentences (and the ones after it that start with "It / Its / They / The company"), split at
   *  ";", "but", "however", "although", "while", "whereas"; a clause naming only another business is left out */
  const SUFFIX = /[\s,]+(llp|ltd\.?|limited|llc|inc\.?|fze|fzco|fz-llc|plc|co\.?|corp\.?|gmbh|pvt\.?( ltd\.?)?|private limited|group|holding|holdings)$/i;
  const nameAny = (n) => { const v = [String(n || '').trim()]; let x = v[0]; for (let i = 0; i < 2; i++) { const y = x.replace(SUFFIX, '').trim(); if (y && y !== x) { v.push(y); x = y; } }
    const res = v.filter(Boolean).map(nameRe).filter(Boolean); return res.length ? { test: (s) => res.some(r => r.test(s)) } : null; };
  const FOLLOW = /^(it|its|it's|they|their|these|both|all (two|three|four|five|six|seven|eight|of them)|the (company|firm|platform|provider|tool|software|team|vendor|service))\b/i;
  const HEDGE = /^(whether|check|ensure|look for|consider|verify|make sure|ask)\b/i;
  const clausesOf = (text, business, rivals) => { const t = String(text || '').replace(/\*\*|__|`/g, '').replace(/[ \t]+/g, ' ').trim(); const bre = nameAny(business); const rres = (rivals || []).map(nameRe).filter(Boolean);
    const sents = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])|\s*\n+\s*|\s(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);
    const mine = []; let follow = false, item = false; const ITEM = /^(#{1,6}\s|\d+[.)]\s|[-*•]\s|\|)/;
    for (const s of sents) { const hasB = bre ? bre.test(s) : false; const hasR = rres.some(r => r.test(s));
      if (hasB) { mine.push(s); follow = true; item = ITEM.test(s) || (s.split(/\s+/).length <= 8 && !/[.!?]$/.test(s)); }   // a heading or a list item: the lines under it are its own
      else if (item && !ITEM.test(s)) mine.push(s); else if (follow && FOLLOW.test(s) && !hasR) mine.push(s); else if (follow && !s.replace(/[|\-\s]/g, '')) continue; else { follow = false; item = false; } }
    const src = mine.length ? mine : sents;   // the name not found (a spelling of its own): the whole text is read
    const out = [];
    for (const s of src) { const parts = s.split(/;|\s(?=(?:but|however|although|though|while|whereas)\b)|,\s*(?=(?:but|however|although|though|while|whereas)\b)/i).map(x => x.trim()).filter(Boolean);
      const anyB = parts.some(p => bre && bre.test(p));
      for (const p of parts) { const hasB = bre ? bre.test(p) : false; const hasR = rres.some(r => r.test(p));
        if (anyB && !hasB && hasR) continue; if (HEDGE.test(p)) continue;                    // "Wafeq is the safest choice; Riyada is also listed": the Wafeq clause is not about Riyada
        out.push({ text: p, contrast: /^(but|however)\b/i.test(p) ? 'after' : /^(although|though|while|whereas)\b/i.test(p) ? 'concessive' : '' }); } }
    return out; };
  /** the rule reader: one snippet about one business -> { polarity, aspects: [{ aspect, polarity }], objection, score } */
  const rules = (text, business, rivals) => { const cl = clausesOf(text, business, rivals); let total = 0; const asp = new Map(); let objection = '';
    // a clause before "but" / "however" is outweighed by the one after it; an "although" clause is outweighed by the rest of its sentence
    const hasAfter = cl.some(c => c.contrast === 'after');
    for (const c of cl) { const lc = c.text.toLowerCase(); const ng = hits(lc, NEG), ps = hits(ng.masked.slice(1, -1), POS, lc);
      const raw = ps.s - ng.s; const pol = raw > 0 ? 'positive' : raw < 0 ? 'negative' : 'neutral';
      const w = c.contrast === 'after' ? 1.5 : c.contrast === 'concessive' ? 0.6 : (hasAfter ? 0.9 : 1);
      total += Math.sign(raw) * w * Math.min(2, Math.abs(raw));
      let found = false; for (const a of ASPECTS) { if (a === 'other' || !ASP[a].test(c.text)) continue; found = true; const old = asp.get(a); if (!old || old === 'neutral') asp.set(a, pol); }
      if (!found && pol !== 'neutral') { if (!asp.has('other')) asp.set('other', pol); }
      if (pol === 'negative' && !objection) objection = c.text.replace(/^(but|however|although|though|while|whereas|yet)\s+/i, '').replace(/[.;,]+$/, '').slice(0, 100); }
    const polarity = total > 0.25 ? 'positive' : total < -0.25 ? 'negative' : 'neutral';
    return { polarity, aspects: [...asp.entries()].map(([aspect, p]) => ({ aspect, polarity: p })), objection: polarity === 'negative' || objection ? objection : '', score: Math.round(100 * total) / 100, clauses: cl.length }; };
  /** the text the reader gets for one answer: the sentences that name the business (and the ones that continue them), at most 900 characters */
  const snippet = (text, business, rivals) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); const bre = nameRe(business); if (!bre) return t.slice(0, 900);
    const sents = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(*])|\s(?=\d+\.\s)/); const keep = []; let follow = false;
    for (const s of sents) { if (bre.test(s)) { keep.push(s); follow = true; } else if (follow && /^(it|its|it's|they|their|the (company|firm|platform|provider|tool|software|team|vendor))\b/i.test(s)) keep.push(s); else follow = false; }
    return (keep.length ? keep.join(' ') : t).slice(0, 900); };
  /** Cohen's kappa over pairs [label_a, label_b] */
  const kappa = (pairs) => { const P = (pairs || []).filter(p => p && p[0] != null && p[1] != null); const n = P.length; if (!n) return null; const cls = [...new Set(P.flat())];
    const po = P.filter(p => p[0] === p[1]).length / n; let pe = 0; for (const c of cls) pe += (P.filter(p => p[0] === c).length / n) * (P.filter(p => p[1] === c).length / n);
    return pe >= 1 ? 1 : Math.round(1000 * (po - pe) / (1 - pe)) / 1000; };
  /** the model's answer for one job -> one label per answer (by its number `n`), every value checked against the label lists */
  const parseModel = (out, job) => { let o = out; if (typeof o === 'string') { const s = o.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { o = JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { o = JSON.parse(s.slice(a, b + 1)); } catch (e2) { o = null; } } }
    const res = new Map(); for (const x of ((o && o.answers) || [])) { const n = Number(x && x.n); const it = (job.items || []).find(i => i.n === n); if (!it) continue;
      const pol = POL.includes(String(x.polarity || '').toLowerCase()) ? String(x.polarity).toLowerCase() : null; if (!pol) continue;
      const aspects = (Array.isArray(x.aspects) ? x.aspects : []).map(a => ({ aspect: String((a && a.aspect) || '').toLowerCase(), polarity: String((a && a.polarity) || '').toLowerCase() })).filter(a => ASPECTS.includes(a.aspect) && POL.includes(a.polarity));
      const rv = (Array.isArray(x.rivals) ? x.rivals : []).map(r => ({ name: String((r && r.name) || '').trim(), polarity: String((r && r.polarity) || '').toLowerCase() })).filter(r => r.name && POL.includes(r.polarity));
      res.set(it.key, { polarity: pol, aspects, objection: String(x.objection || '').trim().slice(0, 140), rivals: rv }); }
    return res; };
  // The rule reader on the labelled set (harness W2E2-SENT recomputes these and fails when they differ): built on the T cases, it read the first
  // blind hold-out (H) at kappa 0.587 and, improved on H, the second blind hold-out (K, 80 cases, read once) at 0.548 - below the 0.7 bar. So the
  // rules never make a published figure: only the model's labels count, the rules are a second opinion. The model's own kappa needs a key
  // (accuracy/eval_sentiment_model.js) and is not measured yet: `model: null` until it is, and the report says "not yet validated".
  const KAPPA = { rules_blind_holdout: 0.548, rules_blind_n: 80, rules_all: 0.827, rules_all_n: 256, parser: 1, model: null, gate: 0.7,
    note: 'Polarity agreement with a hand-labelled set (Cohen\'s kappa). The rule reader is below the 0.7 bar on blind cases, so it never makes the figure; the model\'s agreement is not measured yet.' };
  const tb = (v) => v === true || String(v) === 'true';
  /** this run's answers that NAME the business, with the text the reader gets: the sentences about it (answer_text when stored, else the excerpt) */
  const namedAnswers = (rows, o) => { const opt = o || {}; const biz = opt.business || ''; const out = []; const seen = new Set();
    for (const r of (rows || [])) { if (!r || !tb(r.answered) || r.kind === 'brand' || r.error) continue; if (!(opt.named ? opt.named(r) : tb(r.named))) continue;
      const key = String(r.run_id || '') + '|' + String(r.prompt_id) + '|' + String(r.engine); if (seen.has(key)) continue; seen.add(key);
      let ents = []; try { ents = Array.isArray(r.entities) ? r.entities : JSON.parse(r.entities_json || '[]'); } catch (e) { ents = []; }
      const rivals = (Array.isArray(ents) ? ents : []).filter(e => e && String(e.role) === 'competitor').map(e => ({ id: String(e.id || e.name || ''), name: String(e.name || e.id || '') })).filter(e => e.name).slice(0, 8);
      const text = String(r._text || r.answer_text || r.excerpt || '');   // the parser's full text in memory, else W2-E1's stored answer_text, else the excerpt
      if (!text.trim()) continue;
      out.push({ key, prompt_id: String(r.prompt_id), engine: String(r.engine), prompt: r.prompt || '', snippet: snippet(text, biz, rivals.map(x => x.name)), rival_names: rivals.map(x => x.name), rivals }); }
    return out; };
  /** the jobs for the Sentiment Reader: every named answer, 20 to a job, at most `max_jobs` jobs (the rest are not read, and the report says how many) */
  const jobsOf = (answers, o) => { const opt = o || {}; const per = opt.per || 20, maxJ = opt.max_jobs == null ? 40 : opt.max_jobs; const A = answers || [];
    const jobs = []; for (let i = 0; i < A.length && jobs.length < maxJ; i += per) jobs.push(A.slice(i, i + per).map((a, j) => ({ n: j + 1, key: a.key, engine: a.engine, question: String(a.prompt || '').slice(0, 200), text: a.snippet, rivals: (a.rival_names || []).slice(0, 8) })));
    const sent = jobs.reduce((s, j) => s + j.length, 0); return { jobs, sent, not_sent: Math.max(0, A.length - sent) }; };
  /** sentiment_json. answers: namedAnswers(); model: Map key -> the model's label (parseModel over every job). Only the model's labels are counted. */
  const aggregate = (answers, model, o) => { const opt = o || {}; const A = answers || []; const M = model || new Map();
    const L = A.map(a => { const m = M.get(a.key); const r0 = rules(a.snippet, opt.business || '', a.rival_names || []); return m ? { ...a, ...m, by: 'model', rules_polarity: r0.polarity, rivals: (m.rivals || []).map(x => ({ ...x, id: ((a.rivals || []).find(y => y.name.toLowerCase() === x.name.toLowerCase()) || {}).id || x.name })) } : { ...a, by: 'none', rules_polarity: r0.polarity }; });
    const R = L.filter(l => l.by === 'model'); const n = R.length; const unread = L.length - n;
    const sc = (p) => p === 'positive' ? 1 : p === 'negative' ? -1 : 0;
    const base = { n, named_answers: L.length, unread, positive: R.filter(l => l.polarity === 'positive').length, neutral: R.filter(l => l.polarity === 'neutral').length, negative: R.filter(l => l.polarity === 'negative').length, min: MIN,
      method: 'Claude Haiku reads every answer that names you (20 to a call); a rule reader gives a second opinion and never makes the figure', kappa: { ...KAPPA }, validated: KAPPA.model != null && KAPPA.model >= KAPPA.gate,
      model_vs_rules: R.length ? { n: R.length, agreement: Math.round(1000 * R.filter(l => l.rules_polarity === l.polarity).length / R.length) / 10, kappa: kappa(R.map(l => [l.polarity, l.rules_polarity])) } : null,
      unread_note: unread ? unread + ' of the ' + L.length + ' answers that name you were not read by the model (' + (opt.unread_why || 'it did not answer for them') + '); they are not counted.' : '' };
    if (n < MIN) return { ...base, net: null, net_lo: null, net_hi: null, withheld: true, by_aspect: [], by_rival: [], objections: [], note: L.length ? 'Sentiment is withheld: ' + n + ' answer' + (n === 1 ? ' was' : 's were') + ' read, and a figure needs ' + MIN + '.' : 'No answer named you, so there is no sentiment to read.' };
    const r = AVX.ratio(R, (l) => [sc(l.polarity), 1], { scale: 100, lo0: -1, hi0: 1 });
    const aspects = ASPECTS.map(a => { const xs = R.map(l => (l.aspects || []).find(x => x.aspect === a)).filter(Boolean); const pos = xs.filter(x => x.polarity === 'positive').length, neg = xs.filter(x => x.polarity === 'negative').length;
      return { aspect: a, pos, neg, neu: xs.length - pos - neg, n: xs.length, net: xs.length >= MIN ? Math.round(100 * (pos - neg) / xs.length) : null }; }).filter(x => x.n);
    const rv = new Map(); for (const l of R) for (const x of (l.rivals || [])) { const k = String(x.id || x.name).toLowerCase(); const s0 = rv.get(k) || { id: x.id || x.name, pos: 0, neg: 0, n: 0 }; s0.n++; if (x.polarity === 'positive') s0.pos++; if (x.polarity === 'negative') s0.neg++; rv.set(k, s0); }
    const objMap = new Map(); for (const l of R) { const t = String(l.objection || '').trim(); if (!t) continue; const k = t.toLowerCase().replace(/[^a-z0-9 ]+/g, '').slice(0, 60); const s0 = objMap.get(k) || { text: t, n: 0, engines: new Set() }; s0.n++; s0.engines.add(l.engine); objMap.set(k, s0); }
    return { ...base, withheld: false, net: r.value == null ? null : Math.round(r.value), net_lo: r.lo == null ? null : Math.round(r.lo), net_hi: r.hi == null ? null : Math.round(r.hi), n_questions: r.n_questions,
      by_aspect: aspects.sort((a, b) => b.n - a.n), by_rival: [...rv.values()].sort((a, b) => b.n - a.n).slice(0, 10).map(s0 => ({ id: s0.id, n: s0.n, net: s0.n >= MIN ? Math.round(100 * (s0.pos - s0.neg) / s0.n) : null })),
      objections: [...objMap.values()].sort((a, b) => b.n - a.n).slice(0, 8).map(s0 => ({ text: s0.text, n: s0.n, engines: [...s0.engines] })),
      note: 'Net sentiment ' + (r.value >= 0 ? '+' : '') + Math.round(r.value) + ' (positive minus negative, per 100 answers that name you; 95% range ' + (r.lo == null ? 'not measurable' : Math.round(r.lo) + ' to ' + Math.round(r.hi)) + ', ' + n + ' answers to ' + r.n_questions + ' questions). Compare it only within one market and language.'
        + (KAPPA.model == null ? ' The model\'s labels are not yet validated against a hand-labelled set.' : '') }; };
  return { ASPECTS, POL, MIN, KAPPA, rules, snippet, clausesOf, kappa, parseModel, namedAnswers, jobsOf, aggregate, nameRe };
})();
const CONFIG = { per_job: 20, max_jobs: 40 };
const rd = (n) => { try { return $(n).all().map(i => i.json).filter(Boolean); } catch (e) { return []; } };
const plans = rd('AI Plan').filter(p => !p.nothing_to_do && !p.stop && (!p.chunk || p.chunk.final_expected));
const out = [];
for (const p of plans) {
  const mine = (r) => r && r.site_id === p.site_id && (!r.run_id || r.run_id === p.run_id);
  const rows = [...rd('Parse AI Answers').filter(r => !r.skip && r.engine).filter(mine), ...rd('Load AI Run Answers').filter(mine)];
  const named = SENT.namedAnswers(rows, { business: p.business_name || p.domain, named: AVM.named });
  const J = SENT.jobsOf(named, { per: CONFIG.per_job, max_jobs: CONFIG.max_jobs });
  J.jobs.forEach((items, k) => out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, job: k + 1, jobs: J.jobs.length, not_sent: J.not_sent, business: p.business_name || p.domain, keys: items.map(i => i.key),
    items: items.map(i => ({ n: i.n, key: i.key, engine: i.engine })),
    items_text: items.map(i => 'PASSAGE ' + i.n + ' [' + i.engine + '] rivals: ' + (i.rivals.join(', ') || 'none') + '\nQ: ' + i.question + '\n' + i.text).join('\n\n') } }));
}
return out.length ? out : [{ json: { skip: true } }];
