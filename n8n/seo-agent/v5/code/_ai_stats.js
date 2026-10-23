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
