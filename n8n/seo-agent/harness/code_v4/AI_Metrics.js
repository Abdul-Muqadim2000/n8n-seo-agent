// Per site (v4.9): how often AI answers name / cite the business over the past 7 days (this run's answers + the daily AI Pulse samples) with a 95%
// interval, the position-weighted visibility score (questions weighted by their monthly AI search volume), share of voice against the competitors
// (brands named without a website count too), the per-engine picture, per buyer stage and topic cluster, the sources AI trusts (PR and listing
// targets), your pages it cites, the questions where competitors win (with the demand they carry), what AI searched to write its answers (fan-out),
// how AI speaks of the business and what it gets wrong, the visits / key events / revenue AI assistants send (GA4), whether AI crawlers may read the
// site, the market-wide index (the AI-answer database: your share against the competitors across every answer, not only the panel), the monthly
// market view, changes that are statistically real, alerts and value-ranked actions. Also the seo_ai_visibility row, 'ai_source' link prospects
// and the learned brand names (seo_cache).
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

// ---- AI entities (F1a, 2026-10-23; docs/ai-visibility-2026-10-23/ENGINE_AUDIT.md E3 E4 E5 E8 E10 E16, PROD_STATE.md section 5) ----
// WHO an AI answer names, as ONE entity per business, and in which ROLE. Inlined by build_monitors.py (the AI_ENTITIES placeholder) into
// Parse AI Answers (weekly and pulse), Apply Analysis, Analyst Jobs, AI Cache Rows, Prompt Rows, AI Plan and Pulse Plan.
//  * one entity per business: its id is the registrable domain of its main site. Subdomains fold in (europe.thomsonreuters.com), so do the
//    country / brand variants of one label (cleartax.com + cleartax.in, edicom.com + edicomgroup.com), the names AI uses for it (learned
//    aliases, every spelling of one name), and a former name or an owner written in the answer ("Thomson Reuters (formerly Pagero)").
//    PROD_STATE.md found one business counted 2-3 times, which put the client 4th where it was 2nd.
//  * a role per entity in THAT answer: self (the client), competitor (configured by the owner, or offered by the answer as an option),
//    platform (named as what something integrates with, is built on, or partners with - or a platform the client itself works with),
//    source (cited, or a publisher / directory / review site / government body / association / research firm) or other. Only self and
//    competitor count in the share of voice and in the client's position (E3: a cited directory was a "rival").
//  * short names are matched, not dropped (E4: SAP, Zoho, Xero, Sage): word-bounded, and case-sensitive under 5 letters (an acronym in
//    capitals, a name with its capital) so "asap", "Sapient" and "sage advice" never match.
//  * a domain label that is a common or category word is not a brand name (E5: payroll.ae -> "payroll"); the business name and the
//    owner's brand names are. A word inside a cited domain is never located with indexOf (E8: "small business" is not business.com), and a
//    framework (ASP.NET) is not a business.
// No URL constructor (the n8n Code sandbox has none): hosts are parsed with regexes.
const AIE = (() => {
  const L = (s) => String(s == null ? '' : s).normalize('NFKC');
  const low = (s) => L(s).toLowerCase();
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\d?\./, '') : ''; };
  const normD = (x) => low(x).trim().replace(/^https?:\/\//, '').replace(/^www\d?\./, '').replace(/[\/?#:].*$/, '').replace(/\.+$/, '');
  const SL2 = /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil|or|ne|go|gob|gouv|biz|info)\.[a-z]{2}$/;
  const regD = (h) => { const x = normD(h); if (!x || x.indexOf('.') < 0) return x; const p = x.split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    const sl = p.slice(-2).join('.'); return SL2.test(sl) ? p.slice(-3).join('.') : sl; };
  const isDom = (x) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(x || '').trim());
  const labelOf = (d) => regD(d).split('.')[0].replace(/[^a-z0-9]/g, '');
  // words that say what a business does, where, or nothing at all: a label made only of them is a description, not a name (E5, E8)
  const GEN = new Set(('ai software softwares service services erp crm hrms hcm pos tax taxes vat invoice invoices invoicing einvoice einvoicing accounting accountant accountants payroll payrolls '
    + 'finance financial cloud digital online web data tech technology technologies solution solutions system systems business businesses company companies group global international gulf arab '
    + 'arabia emirates national consulting consultant consultants consultancy partner partners network news blog guide guides info best top free app apps shop store market media academy institute '
    + 'university school bank pay pro plus hub one first smart easy get go home house world city daily times post review reviews compare comparison list directory jobs careers firm firms wiki '
    + 'expert experts specialist specialists advisor advisors advisory agency agencies design marketing seo legal law clinic health care property travel logistics trading auto insurance printing events '
    + 'cleaning security training courses implementation integration migration support hosting it hr audit bookkeeping now link links line zone point center centre source labs studio works '
    + 'small medium large enterprise enterprises office offices team people work job salary salaries portal portals check status register registration login account accounts book books '
    + 'summary overview conclusion introduction step steps benefits pros cons cost costs price prices pricing features feature requirements requirement timeline deadline deadlines '
    + 'recommendation recommendations note notes tips tip example examples option options faq faqs answer answers question questions key core scope model format provider providers vendor vendors '
    + 'website websites contact about home details detail notable market players player leading leader leaders other others more why how what when where which who '
    + 'uae dubai abu dhabi sharjah ajman saudi ksa riyadh jeddah qatar doha oman bahrain kuwait egypt india uk usa us middle east mena gcc europe '
    + 'january february march april may june july august september october november december official accredited approved certified local regional '
    + 'e invoice invoicing electronic peppol standard standards compliance compliant ready readiness new top10 ranking rankings lists listing listings yellow pages').split(/\s+/).filter(Boolean));
  const STOPW = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'or', 'vs', 'is', 'are', 'my', 'your', 'our']);
  const splits = (w) => { const n = w.length; const ok = new Array(n + 1).fill(false); ok[0] = true;
    for (let i = 1; i <= n; i++) for (let j = Math.max(0, i - 20); j < i; j++) if (ok[j] && i - j >= 2 && GEN.has(w.slice(j, i))) { ok[i] = true; break; }
    return ok[n]; };
  /** a word (or a domain label) that describes rather than names: in the list, its plural, or made only of such words */
  const commonWord = (w) => { const x = low(w).replace(/[^a-z0-9]/g, ''); if (!x || x.length < 3) return true; return GEN.has(x) || GEN.has(x.replace(/s$/, '')) || splits(x); };
  const CORP = /(group|global|holding|holdings|hq|corp|inc|llc|ltd|intl|international|online|official|software|solutions|systems|technologies|tech|consulting|erp|mea|me|uae|ae|ksa)$/;
  const core = (d) => { const l = labelOf(d); const c = l.length > 6 ? l.replace(CORP, '') : l; return c.length >= 4 ? c : l; };
  const coreOk = (c) => c && c.length >= 4 && !commonWord(c);
  const nn = (s) => low(s).replace(/[^\p{L}\p{N}&]+/gu, '');   // one key per spelling: "EDICOM" = "Edicom", "Tech &" = "Tech&"

  // ---- what kind of site or name a thing is ----
  const GOV = /\.gov(\.[a-z]{2,3})?$|(^|\.)(gouv|gob|go|gv)\.[a-z]{2}$|\.mil(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|(^|\.)(difc|adgm|dmcc|dafz|dafza|jafza|rakez|dso|ifza|shams|kezad|dwtc|dubaichamber|abudhabichamber|dubaided|government|europa|saifzone|ajmanfreezone|fujairahfreezone|hamriyahfz)\.(com|ae|org|eu)$|(^|\.)[a-z]{3,}fz\.(ae|com)$|freezone/i;
  const MEDIA = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|thenational|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|arabnews|timesofindia|dawn|business|nerdwallet|investopedia|techradar|pcmag|zdnet|cio|computerweekly|itpro|tradearabia|wam|emirates247|khaleej|alkhaleej|albayan|argaam|saudigazette|medium|substack|wikipedia|wikimedia|britannica)\.[a-z.]+$/i;
  const DIRECTORY = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|softwaresuggest|sourceforge|saashub|alternativeto|producthunt|glassdoor|indeed|hidubai|connect|zoominfo|owler)\.[a-z.]+$|yellowpages|directory|review|compare|listing|ranking|top10|aspl?ist|uaeasp|einvoicinglist/i;
  const RESEARCH = /(^|\.)(gartner|forrester|statista|idc|mckinsey|bcg|bain|frost|marketsandmarkets|mordorintelligence|grandviewresearch)\.[a-z.]+$/i;
  const SOCIAL = /(^|\.)(youtube|youtu|linkedin|facebook|instagram|x|twitter|tiktok|reddit|quora|github|pinterest|t)\.(com|be|co|me)$|(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask|chatgpt|openai|perplexity|anthropic|claude|gemini|gstatic|goo)\.[a-z.]+$|vertexaisearch|peppol\.(org|eu)$/i;
  const NAME_SRC = /\b(ministry|authority|federal|government|municipality|chamber|association|council|institute|foundation|commission|department|free ?zone|yellow ?pages|directory|gazette|news|times|journal|magazine|wikipedia|openpeppol|gartner|forrester|statista)\b/i;
  const NAME_OTHER = /^(google|bing|linkedin|youtube|facebook|instagram|twitter|reddit|quora|chatgpt|openai|perplexity|gemini|claude|anthropic|peppol|whatsapp|wikipedia)$/i;
  const kindOfDomain = (d) => { const x = normD(d); return !x ? '' : GOV.test(x) ? 'gov' : SOCIAL.test(x) ? 'other' : MEDIA.test(x) ? 'media' : RESEARCH.test(x) ? 'research' : DIRECTORY.test(x) ? 'directory' : 'site'; };
  const SOURCE_KINDS = new Set(['gov', 'media', 'research', 'directory']);

  // ---- the platforms buyers connect to: named as an integration target, or worked with by the client, they are never rivals ----
  const P_B = '(?<![\\p{L}\\p{N}])', P_E = '(?![\\p{L}\\p{N}])';
  const PLATFORMS = [
    ['microsoft.com', 'Microsoft', P_B + '(?:microsoft(?:\\s+dynamics(?:\\s+365)?)?|dynamics\\s*365|ms\\s+dynamics|d365|business\\s+central|navision|azure|power\\s*bi|power\\s+(?:apps|automate|platform)|office\\s+365|microsoft\\s+365|sharepoint)' + P_E, 'giu'],
    ['sap.com', 'SAP', P_B + '(?:SAP(?:\\s+Business\\s+One|\\s+S\\/4\\s?HANA|\\s+B1)?|S\\/4\\s?HANA|SuccessFactors)' + P_E, 'gu'],
    ['oracle.com', 'Oracle', P_B + '(?:Oracle|ORACLE)(?!\\s+NetSuite)(?:\\s+(?:Fusion|Cloud|ERP|E-Business\\s+Suite))?' + P_E, 'gu'],
    ['netsuite.com', 'NetSuite', P_B + '(?:oracle\\s+)?netsuite' + P_E, 'giu'],
    ['zoho.com', 'Zoho', P_B + '(?:Zoho|ZOHO)(?:\\s+(?:Books|Payroll|CRM|People|One|Invoice|Inventory|Expense))?' + P_E, 'gu'],
    ['odoo.com', 'Odoo', P_B + '(?:Odoo|ODOO)' + P_E, 'gu'],
    ['sage.com', 'Sage', P_B + '(?:Sage|SAGE)(?:\\s+(?:X3|300|50|100|200|Intacct|Accounting|Business\\s+Cloud))?' + P_E, 'gu'],
    ['xero.com', 'Xero', P_B + '(?:Xero|XERO)' + P_E, 'gu'],
    ['intuit.com', 'QuickBooks', P_B + '(?:quickbooks(?:\\s+online)?|intuit)' + P_E, 'giu'],
    ['tallysolutions.com', 'Tally', P_B + '(?:TallyPrime|Tally(?:\\s+ERP\\s*9)?|TALLY)' + P_E, 'gu'],
    ['salesforce.com', 'Salesforce', P_B + 'salesforce' + P_E, 'giu'], ['hubspot.com', 'HubSpot', P_B + 'hubspot' + P_E, 'giu'],
    ['shopify.com', 'Shopify', P_B + 'shopify' + P_E, 'giu'], ['amazon.com', 'AWS', P_B + '(?:AWS|Amazon\\s+Web\\s+Services)' + P_E, 'gu'],
    ['servicenow.com', 'ServiceNow', P_B + 'servicenow' + P_E, 'giu'], ['workday.com', 'Workday', P_B + 'Workday' + P_E, 'gu'],
    ['epicor.com', 'Epicor', P_B + 'epicor' + P_E, 'giu'], ['acumatica.com', 'Acumatica', P_B + 'acumatica' + P_E, 'giu'], ['infor.com', 'Infor', P_B + 'Infor' + P_E, 'gu']];
  const PLAT_DOMS = new Set(PLATFORMS.map(p => p[0]));

  // ---- how a name is found in a text ----
  const B = '(?<![\\p{L}\\p{M}\\p{N}])', E = '(?![\\p{L}\\p{M}\\p{N}])';
  const AR = /[؀-ۿ]/;
  const tokRe = (n) => (n.match(/[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu) || []).map(esc).join('[\\s\\-]*');
  /** a name -> a global regex: a domain literally; an Arabic name with its one-letter prefixes (و ب ل ف ك, ال); a short name (4 letters or
   *  fewer) case-sensitive - as written, or in capitals; a longer one case-insensitive. A name ending in a symbol ("Tech&") may be written
   *  with a space ("Tech &") but not followed by another capitalised word ("Tech & Co Ltd" is another company). */
  const nameRe = (name, o) => {
    const n = L(name).replace(/\s+/g, ' ').trim(); if (n.length < 2) return null;
    if (isDom(n)) return new RegExp('(?<![\\p{L}\\p{N}@.\\-])(?:www\\.)?' + esc(n.toLowerCase()) + '(?![\\p{L}\\p{N}\\-]|\\.[\\p{L}\\p{N}])', 'giu');
    if (AR.test(n)) return new RegExp(B + '(?:ال|[وبلفك])?' + tokRe(n) + E, 'gu');
    const tail = /[^\p{L}\p{M}\p{N}]$/u.test(n) ? '(?![\\p{L}\\p{M}\\p{N}]|\\s+[\\p{Lu}\\p{N}])' : E;
    const alnum = n.replace(/[^\p{L}\p{N}]/gu, '').length;
    if (alnum > 4 && !(o && o.strict)) return new RegExp(B + tokRe(n) + tail, 'giu');
    const forms = new Set();
    if (n === n.toLowerCase()) { if (alnum <= 3) forms.add(n.toUpperCase()); else { forms.add(n[0].toUpperCase() + n.slice(1)); forms.add(n.toUpperCase()); } }
    else { forms.add(n); forms.add(n.toUpperCase()); }
    return new RegExp(B + '(?:' + [...forms].map(tokRe).join('|') + ')' + tail, 'gu');
  };
  /** a name an answer gives a business: a short phrase of capitalised words, not a heading, a category or a field label */
  const DENY = /^(pint-?ae|peppol|uae|ksa|fta|vat|erp|crm|asps?|b2b|b2g|b2c|xml|api|apis|pdf|aed|usd|sar|mof|faq|ceo|cfo|it|ai|ml|saas|sme|smes|ubl|edi|ctc|wps|kyc|gdpr|iso)$/i;
  const nameLike = (name) => {
    const n = L(name).replace(/\s+/g, ' ').trim();
    if (n.length < 2 || n.length > 48 || /[:;,|\\?!]|\.{2}/.test(n) || /(^|\s)(and|or|for|with|in|on|of|the|a|an|to|at|by|vs|versus|&|from|your|our|how|what|why|when)(\s|$)/i.test(n)) return false;
    const w = n.split(' '); if (w.length > 5) return false;
    if (w.every(x => DENY.test(x.replace(/[^\p{L}\p{N}-]/gu, '')) || commonWord(x) || /^\d+$/.test(x))) return false;
    return w.every(x => /^[\p{Lu}\p{N}]/u.test(x) || /^[\p{Ll}]+\p{Lu}/u.test(x) || AR.test(x));
  };
  const DOMAIN_RE = /(?<![\p{L}\p{N}@-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|ai|co|ae|sa|qa|om|kw|bh|eg|uk|de|fr|es|it|nl|in|pk|sg|au|ca|nz|za|br|mx|us|biz|info|tech|app|cloud|global|digital|solutions|consulting|agency|me|network|one|online|site|store|group|eu))(?![\p{L}\p{N}-])/giu;
  const TECH_TERM = /^(asp|ado|vb|dot|c|f|j)\.net$|^(socket|chart|node|vue|next|react|express)\.(io|js)$/i;
  /** the text a reader sees: link targets and footnote markers dropped (they are citations, not names), anchors kept */
  const visible = (text) => String(text || '')
    .replace(/\[\[\d+\]\]\([^)]*\)/g, ' ').replace(/\[\d+\]\((?:https?:)?\/\/[^)]*\)/g, ' ')
    .replace(/\]\((?:https?:)?\/\/[^)\s]*\)/g, ']').replace(/[?&](utm_[a-z]+|srsltid)=[^\s)&\]]*/gi, '').replace(/\[\d+\]/g, ' ');

  // ---- the client's own names (E5) ----
  /** the brand names to look for: the domain, the business name, the owner's brand names, and the domain label only when it is a NAME (5+
   *  letters, not a common or category word: "techand" yes, "payroll" no) */
  const brandNames = (o) => {
    const dom = normD(o && o.domain); const label = dom.split('.')[0] || '';
    const lab = label.replace(/-/g, '');
    const names = [dom, (o && o.business_name) || '', ...((o && o.brand_names) || [])];
    if (lab.length >= 5 && !commonWord(lab)) names.push(label);
    return [...new Set(names.map(x => L(x).replace(/\s+/g, ' ').trim()).filter(x => x.length >= 3))];
  };
  /** names a plan may still carry from before the rule: the bare label of a common-word domain is dropped (payroll.ae -> "payroll") */
  const ownNames = (plan) => { const dom = normD(plan.domain); const label = dom.split('.')[0];
    return [...new Set([dom, ...(plan.brand_names || [])].map(x => L(x).trim()).filter(x => x.length >= 3 && !(low(x) === label && commonWord(label) && low(plan.business_name || '') !== label)))]; };

  /** what a site row says it sells (seo_sites: declared_services, services_json) - the pulse has no site model of its own */
  const servicesOf = (row) => { const r = row || {}; const out = []; const add = (v) => { if (Array.isArray(v)) v.forEach(add); else if (v) String(v).split(/\n|;|\|/).forEach(x => { const t = x.trim(); if (t) out.push(t.slice(0, 80)); }); };
    add(r.services); add(r.declared_services); try { add(JSON.parse(r.services_json || '[]')); } catch (e) {} return [...new Set(out)].slice(0, 30); };
  // ---- the client's platforms: what its services, topics and facts name ----
  const clientText = (plan) => [plan.business_type, ...(plan.services || []), ...(plan.topics || []), plan.business_facts, plan.accreditation].filter(Boolean).map(String).join(' \n ');
  const clientPlatforms = (plan) => { const t = clientText(plan); return PLATFORMS.filter(([, , src, fl]) => new RegExp(src, fl.replace('g', '')).test(t)).map(p => p[0]); };

  // ---- the book of a site: entities learned in earlier runs (seo_cache ai_entities:<site_id>) ----
  const bookOf = (rows, siteId) => { for (const r of (rows || [])) { const j = r && r.json ? r.json : r; if (j && j.key === 'ai_entities:' + siteId) { try { const v = typeof j.value === 'string' ? JSON.parse(j.value) : j.value; return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } } } return {}; };

  // ---- the directory of a site: every known business, one group per business ----
  const DIRS = new Map();
  const dir = (plan, book) => {
    const key = plan.site_id + '|' + plan.domain + '|' + (plan.run_id || '');
    if (DIRS.has(key)) return DIRS.get(key);
    const P = new Map(); const add = (k) => { if (!P.has(k)) P.set(k, k); };
    const find = (k) => { add(k); let r = k; while (P.get(r) !== r) r = P.get(r); let x = k; while (P.get(x) !== r) { const nx = P.get(x); P.set(x, r); x = nx; } return r; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) P.set(ra, rb); };
    const display = new Map();   // name key -> how it is written
    const aliasCount = new Map();   // domain -> how many names point to it
    const own = regD(plan.domain); const owned = new Set([own, ...((plan.owned_domains || []).map(regD))].filter(Boolean));
    const configured = [...new Set((Array.isArray(plan.configured_competitors) ? plan.configured_competitors : (plan.competitors || [])).map(regD).filter(x => x && !owned.has(x)))];
    const soft = [...new Set((plan.competitors || []).map(regD).filter(x => x && !owned.has(x)))];
    const selfNames = ownNames(plan);
    const selfKeys = new Set(selfNames.map(nn));
    const doms = new Set([...configured, ...soft]);
    const explicit = new Set();
    const nameKey = (n) => 'n:' + nn(n);
    const putName = (n) => { const k = nameKey(n); if (!display.has(k)) display.set(k, L(n).trim()); return k; };
    for (const [n, d] of Object.entries(plan.aliases || {})) { if (!n || selfKeys.has(nn(n))) continue; const k = putName(n); if (d && isDom(normD(d))) { const r = regD(d); if (owned.has(r)) continue; doms.add(r); uni(k, 'd:' + r); explicit.add(k); aliasCount.set(r, (aliasCount.get(r) || 0) + 1); } else add(k); }
    const roleOfBook = new Map();
    for (const [id, e] of Object.entries(book || {})) { if (!e || typeof e !== 'object') continue; const ds = (e.d || []).map(regD).filter(x => x && !owned.has(x)); const anchor = ds.length ? 'd:' + ds[0] : nameKey(id);
      if (!ds.length && !isDom(id)) putName(id); if (isDom(id)) { const r = regD(id); if (!owned.has(r)) { doms.add(r); uni(anchor, 'd:' + r); } }
      for (const d of ds) { doms.add(d); uni(anchor, 'd:' + d); } for (const n of (e.n || [])) { if (!n || selfKeys.has(nn(n))) continue; const k = putName(n); uni(k, anchor); explicit.add(k); }
      if (e.r) roleOfBook.set(anchor, String(e.r)); }
    for (const d of PLAT_DOMS) add('d:' + d);
    for (const d of doms) add('d:' + d);
    // one business on several domains: the same distinctive core label (edicom.com / edicomgroup.com, cleartax.com / cleartax.in)
    const byCore = new Map(); for (const d of [...doms, ...PLAT_DOMS]) { const c = core(d); if (!coreOk(c)) continue; if (byCore.has(c)) uni('d:' + d, 'd:' + byCore.get(c)); else byCore.set(c, d); }
    // a name with no explicit website joins the domain its spelling names (ClearTax -> cleartax.com, Azentio Software -> azentio.com)
    const nameToDom = (n, list) => { const c = nn(n).replace(/&/g, ''); const first = (low(n).split(/[^\p{L}\p{N}]+/u).filter(Boolean)[0]) || '';
      return list.find(d => { const l = labelOf(d), co = core(d); if (commonWord(l) && commonWord(co)) return false;
        return l === c || co === c || (first.length >= 5 && (first === l || first === co)) || (l.length >= 6 && c.startsWith(l)) || (coreOk(co) && co.length >= 5 && c.startsWith(co)); }) || null; };
    for (const k of display.keys()) if (!explicit.has(k)) { const d = nameToDom(display.get(k), [...doms]); if (d) uni(k, 'd:' + d); }
    // the id of a group: the owner's competitor, else the domain most names point to, else a .com, the shortest, the first alphabetically
    const groups = new Map(); for (const k of P.keys()) { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); }
    const idOfRoot = new Map(), membersOf = new Map();
    const pickId = (keys) => { const ds = keys.filter(k => k.startsWith('d:')).map(k => k.slice(2)); if (!ds.length) { const nk = keys.find(k => k.startsWith('n:')); return nk ? display.get(nk) : keys[0]; }
      const conf = ds.find(d => configured.includes(d)); if (conf) return conf;
      return ds.slice().sort((a, b) => (aliasCount.get(b) || 0) - (aliasCount.get(a) || 0) || (/\.com$/.test(b) ? 1 : 0) - (/\.com$/.test(a) ? 1 : 0) || a.length - b.length || a.localeCompare(b))[0]; };
    for (const [r, keys] of groups) { idOfRoot.set(r, pickId(keys)); membersOf.set(r, keys); }
    const scans = [];   // [{ re, root }] - every known business, found by its names and domains
    const roots = new Set();
    for (const [r, keys] of groups) {
      const id = idOfRoot.get(r); const ds = keys.filter(k => k.startsWith('d:')).map(k => k.slice(2));
      const conf = ds.some(d => configured.includes(d)); const softC = ds.some(d => soft.includes(d));
      const names = new Set();
      for (const k of keys) if (k.startsWith('n:')) names.add(display.get(k));
      for (const d of ds) { names.add(d); if (conf || softC) { const l = labelOf(d), co = core(d);
        for (const x of [l, co]) if (x.length >= 3 && !commonWord(x) && (conf || x.length >= 5)) names.add(x); } }
      for (const n of names) { if (!n || selfKeys.has(nn(n))) continue; if (!isDom(n) && !/\./.test(n) && !conf && !nameLike(n) && !AR.test(n) && !keys.some(k => k === nameKey(n) && explicit.has(k))) continue;
        const re = nameRe(n, { strict: !isDom(n) && n === n.toLowerCase() && n.replace(/[^a-z0-9]/g, '').length <= 4 }); if (re) scans.push({ re, root: r }); }
      roots.add(r); void id;
    }
    for (const [d, , src, fl] of PLATFORMS) scans.push({ re: new RegExp(src, fl), root: find('d:' + d) });
    const selfScans = selfNames.map(n => nameRe(n)).filter(Boolean);
    const cp = new Set(clientPlatforms(plan).map(d => find('d:' + d)));
    const ct = clientText(plan);
    const out = { plan, own, owned, configured, soft, find, idOfRoot, membersOf, display, nameKey, nameToDom, doms, scans, selfScans, selfNames, selfKeys, clientRoots: cp, clientText: ct, roleOfBook, explicit,
      confRoots: new Set(configured.map(d => find('d:' + d))) };
    DIRS.set(key, out);
    return out;
  };

  // ---- the context of one mention ----
  // a sentence ends at . ! ? ; or a line break - not at the dot of "e.g." / "i.e." / "etc." / "Inc." (masked, same length, before the search)
  const maskAbbr = (t) => t.replace(/\b(e\.g|i\.e|etc|vs|approx|inc|ltd|co|no|st)\./gi, (m) => m.replace(/\./g, '_'));
  const sentenceBefore = (vis, at, max) => { const s0 = vis.slice(Math.max(0, at - (max || 140)), at); const s = maskAbbr(s0); let cut = -1; for (const m of s.matchAll(/[.!?;\n]/g)) cut = m.index; return cut >= 0 ? s0.slice(cut + 1) : s0; };
  const sentenceAfter = (vis, end, max) => { const s0 = vis.slice(end, end + (max || 90)); const m = maskAbbr(s0).match(/[.!?;\n]/); return m ? s0.slice(0, m.index) : s0; };
  const REL = /(?:integrat\w*|connect\w*|connectivity|compatib\w*|interoperab\w*|built\s+(?:on|for|with)|runs?\s+on|running\s+on|on\s+top\s+of|plugs?\s+(?:in|into)|plug-?ins?\s+for|add-?ons?\s+for|sync\w*|interfac\w*|works?\s+with|(?:existing|current|legacy)\s+(?:\*\*)?(?:erp|accounting|billing|finance|software|systems?|infrastructure|stack|platforms?|tools?)|(?:erp|accounting|billing|crm)\s+(?:systems?|software|platforms?|tools?)(?:\*\*)?\s*(?:\(|such\s+as|like|e\.g\.|including)|speciali[sz]\w*\s+in|certified\s+(?:in|for|on)|partners?\s+(?:of|for)|resellers?\s+of|implement(?:s|ing|ed|ation\s+of)?|deploy\w*|customi[sz]\w*|migrat\w*\s+(?:to|from)|licen[cs]\w*\s+(?:of|for))/gi;
  const GAP_OK = new Set(['and', 'or', 'e.g', 'eg', 'such', 'as', 'like', 'including', 'the', 'a', 'an', 'your', 'existing', 'current', 'legacy', 'erp', 'software', 'system', 'systems', 'platform', 'platforms',
    'infrastructure', 'accounting', 'billing', 'crm', 'tools', 'stack', 'with', 'etc', 'mainly', 'especially', 'other', 'into', 'to', 'for', 'in', 'on', 'of', 'i.e', 'ie', 'for example', 'example', 'custom', 'cloud', 'finance']);
  const platformBefore = (vis, at) => { const s = sentenceBefore(vis, at, 160); let last = null; for (const m of s.matchAll(REL)) last = m; if (!last) return false;
    const gap = s.slice(last.index + last[0].length); if (gap.length > 90) return false;
    const words = gap.replace(/[*()"'’:,]/g, ' ').split(/\s+/).filter(Boolean);
    return words.every(w => /^[\p{Lu}\p{N}]/u.test(w) || /&$/.test(w) || GAP_OK.has(w.toLowerCase().replace(/\.$/, ''))); };
  const PLAT_AFTER = /^\s*(?:\*\*)?\s*(?:[\p{Lu}\p{N}][\p{L}\p{N}]*\s+){0,3}?(?:(?:gold|silver|certified|solutions?|implementation|authori[sz]ed|official|premier)\s+)*(?:partners?|integrators?|resellers?|implementers?|consultan(?:t|ts|cy|cies)|specialists?|add-?ons?|plug-?ins?|connectors?|integrations?|modules?)(?![\p{L}])/u;
  const platformAfter = (vis, end) => PLAT_AFTER.test(sentenceAfter(vis, end, 60));
  const SRC_BEFORE = /(?:according\s+to|cited\s+by|reported\s+by|sources?:|data\s+from|listed\s+(?:on|in|by)|published\s+(?:by|on|in)|as\s+(?:reported|noted|listed)\s+(?:by|on|in)|via)\s*(?:the\s+)?$/i;
  const SRC_AFTER = /^\s*(?:reports?|reported|notes?|noted|says|said|lists?|listed|ranks?|ranked|publishes?|published|estimates?|found|explains?|writes?)\b/i;

  // ---- one answer -> its entities ----
  const LINE_NAME = [/^\s*#{1,4}\s*(?:\d+[.)]\s*)?(?:\*\*)?([^*\n]+?)(?:\*\*)?\s*$/, /^\s*(?:[-*•]|\d+[.)])\s+(?:\*\*|__)([^*\n]+?)(?:\*\*|__)/, /^\s*(?:\*\*|__)([^*\n]+?)(?:\*\*|__)/,
    /^\s*\|\s*(?:\*\*)?([^|*\n]+?)(?:\*\*)?\s*\|/, /^\s*\d+[.)]\s+([^\n]+?)\s*(?:\s[-–—]\s|$)/];
  const OWN_PHRASE = /(?:formerly(?:\s+known\s+as)?|previously(?:\s+known\s+as)?|now\s+part\s+of|now\s+owned\s+by|acquired\s+by|a\s+subsidiary\s+of|part\s+of)\s+|\(\s*an?\s+(?=[^()]{2,40}?\s+company\s*\))/gi;
  const read = (ans, D) => {
    const plan = D.plan; const text = String(ans.text || ''); const vis = visible(text); const cites = ans.cites || [];
    const isOurs = (h) => { const r = regD(h); return !!r && D.owned.has(r); };
    // local groups for the domains this answer brings
    const local = new Map(); const localRoot = (d) => { const r = regD(d); if (!r) return null; if (D.owned.has(r)) return 'self';
      const known = 'd:' + r; if (D.idOfRoot.has(D.find(known)) && D.membersOf.get(D.find(known)).includes(known)) return D.find(known);
      const c = core(r); if (coreOk(c)) { for (const d of D.doms) if (core(d) === c) return D.find('d:' + d); for (const p of PLAT_DOMS) if (core(p) === c) return D.find('d:' + p); }
      const lk = coreOk(c) ? 'c:' + c : 'd:' + r; if (!local.has(lk)) local.set(lk, { root: 'L:' + lk, doms: new Set() }); local.get(lk).doms.add(r); return 'L:' + lk; };
    const M = [];   // mentions { s, e, root, name }
    const scanRe = (re, root, name) => { re.lastIndex = 0; for (const m of vis.matchAll(re)) { const dm = isDom(m[0]); M.push({ s: m.index, e: m.index + m[0].length, root, name: name || (dm ? normD(m[0]) : m[0]), dom: dm }); } };
    for (const re of D.selfScans) scanRe(re, 'self');
    for (const x of D.scans) scanRe(x.re, x.root);
    // business domains written in the text (an anchor, a bare address); a framework is not one
    DOMAIN_RE.lastIndex = 0;
    for (const m of vis.matchAll(DOMAIN_RE)) { const d = normD(m[1]); if (TECH_TERM.test(d) || !/\.[a-z]{2,}$/.test(d)) continue; const r = localRoot(d); if (r) M.push({ s: m.index, e: m.index + m[0].length, root: r, name: d, dom: true }); }
    // names the engine itself lists (ChatGPT / Gemini brand entities), and the leading names of list items and table rows
    const nameRoot = (n) => { const k = D.nameKey(n); if (D.selfKeys.has(nn(n))) return 'self'; if (D.display.has(k)) return D.find(k);
      const d = D.nameToDom(n, [...D.doms, ...PLAT_DOMS, ...[...local.values()].flatMap(x => [...x.doms])]); if (d) return localRoot(d); return 'N:' + nn(n); };
    const listNames = [];
    { let off = 0; for (const line of vis.split('\n')) {
      if (!/^\s*\|?\s*:?-{2,}/.test(line)) for (const re of LINE_NAME) { const m = line.match(re); if (!m) continue; let raw = m[1];
        if (/:\s*$/.test(raw) || (re !== LINE_NAME[4] && re !== LINE_NAME[3] && /:/.test(raw))) break;
        raw = raw.split(/\s[-–—]\s|:|,|\s\|/)[0].replace(/[*_]+/g, '').trim();
        const par = raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/); let name = par ? par[1].trim() : raw; const alt = par && !/^(formerly|previously|now|a |an |part|owned|acquired)/i.test(par[2]) ? par[2].trim() : '';
        if (!nameLike(name)) { if (alt && nameLike(alt)) name = alt; else break; }
        const at = off + Math.max(0, line.indexOf(name)); listNames.push({ name, alt: alt && nameLike(alt) ? alt : '', at, lineEnd: off + line.length }); break; }
      off += line.length + 1; } }
    for (const x of listNames) { let root = nameRoot(x.name); if (root.startsWith('N:') && x.alt) { const r2 = nameRoot(x.alt); if (!r2.startsWith('N:')) root = r2; }
      // the website on the item's line or the lines under it, until the next item
      const next = listNames.find(y => y.at > x.at); const span = vis.slice(x.at, next ? next.at : Math.min(vis.length, x.at + 320));
      DOMAIN_RE.lastIndex = 0; const dm = [...span.matchAll(DOMAIN_RE)].map(m => normD(m[1])).find(d => !TECH_TERM.test(d));
      x.root = root; x.dom = dm || '';
      M.push({ s: x.at, e: x.at + x.name.length, root, name: x.name, list: true }); }
    for (const n of (ans.entities || [])) { const name = L(n).trim(); if (!name) continue; const root = nameRoot(name); if (root.startsWith('N:') && !nameLike(name)) continue;
      const re = nameRe(name); let hit = false; if (re) { re.lastIndex = 0; for (const m of vis.matchAll(re)) { M.push({ s: m.index, e: m.index + m[0].length, root, name }); hit = true; } }
      if (!hit) M.push({ s: 1e8 + M.length, e: 1e8 + M.length, root, name, engine_list: true }); }
    // a name inside a longer name of ANOTHER business is not a mention ("Oracle" in "Oracle NetSuite")
    M.sort((a, b) => (b.e - b.s) - (a.e - a.s) || a.s - b.s);
    const kept = []; for (const m of M) { if (kept.some(k => k.root !== m.root && m.s < k.e && k.s < m.e && m.s < 1e8)) continue; kept.push(m); }
    // one business: union-find over the roots of this answer
    const U = new Map(); const uf = (k) => { if (!U.has(k)) U.set(k, k); let r = k; while (U.get(r) !== r) r = U.get(r); return r; };
    const join = (a, b) => { if (a === 'self' || b === 'self') return; const ra = uf(a), rb = uf(b); if (ra !== rb) U.set(ra, rb); };
    for (const x of listNames) if (x.dom && x.root !== 'self') { const r = localRoot(x.dom); const known = (k) => !String(k).startsWith('N:') && !String(k).startsWith('L:');
      if (r && r !== 'self' && !(known(r) && known(x.root) && r !== x.root)) join(x.root, r); }
    OWN_PHRASE.lastIndex = 0;
    for (const m of vis.matchAll(OWN_PHRASE)) { const a = m.index, z = m.index + m[0].length;
      const left = kept.filter(k => k.e <= a && a - k.e <= 12 && k.s < 1e8).sort((p, q) => q.e - p.e)[0]; const right = kept.filter(k => k.s >= z && k.s - z <= 8).sort((p, q) => p.s - q.s)[0];
      if (left && right && left.root !== right.root) join(left.root, right.root); }
    // entities
    const ents = new Map();
    const ent = (root) => { const r = root === 'self' ? 'self' : uf(root); if (!ents.has(r)) ents.set(r, { r, roots: new Set(), mentions: [], cited: false, cites: [] }); const e = ents.get(r); e.roots.add(root); return e; };
    for (const m of kept) ent(m.root).mentions.push(m);
    const ourUrls = [];
    for (const c of cites) { const h = c.host || hostOf(c.url); if (!h) continue; if (isOurs(h)) { const e = ent('self'); e.cited = true; if (c.url) ourUrls.push(c.url); continue; }
      const r = localRoot(h); if (!r) continue; const e = ent(r); e.cited = true; e.cites.push(c); }
    // what is known about each entity: its id, domains, names, kind
    const domsOf = (e) => { const out = new Set(); for (const root of e.roots) { if (String(root).startsWith('L:')) { for (const v of local.values()) if (v.root === root) v.doms.forEach(d => out.add(d)); }
      else if (D.membersOf.has(root)) D.membersOf.get(root).filter(k => k.startsWith('d:')).forEach(k => out.add(k.slice(2))); } for (const m of e.mentions) if (m.dom) out.add(regD(m.name)); for (const c of e.cites) out.add(regD(c.host || hostOf(c.url))); return [...out].filter(Boolean); };
    const idOf = (e, ds) => { for (const root of e.roots) if (D.idOfRoot.has(root) && /\./.test(D.idOfRoot.get(root))) return D.idOfRoot.get(root);
      if (ds.length) return ds.slice().sort((a, b) => (D.configured.includes(b) ? 1 : 0) - (D.configured.includes(a) ? 1 : 0) || (/\.com$/.test(b) ? 1 : 0) - (/\.com$/.test(a) ? 1 : 0) || a.length - b.length || a.localeCompare(b))[0];
      for (const root of e.roots) if (D.idOfRoot.has(root)) return D.idOfRoot.get(root);
      const n = e.mentions.find(m => !m.dom); return n ? L(n.name).replace(/\s+/g, ' ').trim() : ''; };
    const list = [];
    for (const e of ents.values()) {
      const named = e.mentions.filter(m => m.s < 1e8 || m.engine_list);
      const at = named.length ? Math.min(...named.map(m => m.s)) : Infinity;
      if (e.r === 'self') { list.push({ id: normD(plan.domain), name: (plan.business_name || D.selfNames.find(x => !isDom(x)) || plan.domain), role: 'self', at, cited: e.cited, named: named.length > 0, domains: [D.own] }); continue; }
      const ds = domsOf(e); const id = idOf(e, ds); if (!id) continue;
      const name = (named.find(m => !m.dom && m.s < 1e8) || named.find(m => !m.dom) || {}).name || (ds[0] || id);
      const rootsF = [...e.roots].map(r => String(r));
      const isConf = rootsF.some(r => D.confRoots.has(r)) || ds.some(d => D.configured.includes(d));
      const isClientPlat = rootsF.some(r => D.clientRoots.has(r)) || (named.some(m => !m.dom && m.name.length >= 5 && D.clientText && nameRe(m.name) && nameRe(m.name).test(D.clientText)));
      const kinds = new Set(ds.map(kindOfDomain)); const names = named.map(m => m.name);
      const srcKind = [...kinds].some(k => SOURCE_KINDS.has(k)) && !ds.some(d => kindOfDomain(d) === 'site' && named.some(m => m.dom && regD(m.name) === d)) || names.some(n => NAME_SRC.test(n));
      const otherKind = (kinds.has('other') && !kinds.has('site')) || names.some(n => NAME_OTHER.test(L(n).trim()));
      let role;
      if (isConf) role = 'competitor';
      else if (!named.length) role = isClientPlat ? 'platform' : 'source';
      else if (srcKind) role = 'source';
      else if (otherKind) role = 'other';
      else if (isClientPlat) role = 'platform';
      else if (named.filter(m => m.s < 1e8).length && named.filter(m => m.s < 1e8).every(m => platformBefore(vis, m.s) || platformAfter(vis, m.e))) role = 'platform';
      else if (named.filter(m => m.s < 1e8).length && named.filter(m => m.s < 1e8).every(m => SRC_BEFORE.test(vis.slice(Math.max(0, m.s - 40), m.s)) || SRC_AFTER.test(vis.slice(m.e, m.e + 30)))) role = 'source';
      else if (ds.length || nameLike(name) || AR.test(name) || rootsF.some(r => D.explicit.has(r))) role = 'competitor';
      else role = 'other';
      list.push({ id, name: L(name).replace(/\s+/g, ' ').trim().slice(0, 60), role, at, cited: e.cited, named: named.length > 0, domains: ds });
    }
    // two entities with one id (a learned alias and a local domain met separately) are one
    const byId = new Map(); for (const x of list) { const k = low(x.id); const y = byId.get(k); if (!y) { byId.set(k, x); continue; }
      y.at = Math.min(y.at, x.at); y.cited = y.cited || x.cited; y.named = y.named || x.named; y.domains = [...new Set([...y.domains, ...x.domains])];
      const rank = { self: 5, competitor: 4, platform: 3, source: 2, other: 1 }; if (rank[x.role] > rank[y.role]) y.role = x.role; }
    const all = [...byId.values()].sort((a, b) => a.at - b.at);
    let pos = 0; for (const x of all) x.position = (x.role === 'self' || x.role === 'competitor') && x.named && x.at < Infinity ? ++pos : null;
    const self = all.find(x => x.role === 'self') || null;
    const named = !!(self && self.named);
    return { vis, named, cited: !!(self && self.cited), position: named ? self.position : null, ourAt: named ? self.at : -1, ourUrls,
      entities: all.map(x => ({ id: x.id, name: x.name, role: x.role, position: x.position, cited: !!x.cited, at: x.at, domains: x.domains })) };
  };

  /** the stored / in-memory form of a row's entities (F1b and the app read this) */
  const compact = (ents) => (ents || []).slice(0, 16).map(x => ({ id: String(x.id).slice(0, 80), name: String(x.name || '').slice(0, 60), role: x.role, position: x.position == null ? null : Number(x.position), cited: !!x.cited }));
  const entitiesOf = (row) => { if (row && Array.isArray(row.entities)) return row.entities; try { const v = JSON.parse((row && row.entities_json) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  /** two ids name one business (subdomain, country / brand variant) */
  const sameEntity = (a, b) => { if (!a || !b) return false; if (low(a) === low(b)) return true; if (!isDom(a) || !isDom(b)) return false; const ra = regD(a), rb = regD(b); if (ra === rb) return true; const ca = core(ra); return coreOk(ca) && ca === core(rb); };

  // ---- E10: a question that names another vendor ----
  /** the first company a question names that is not the client's own (its brand, or a platform its services name): { name, why } or null */
  const vendorIn = (text, o) => {
    const t = L(text); const plan = { site_id: (o && o.site_id) || 'q', domain: (o && o.domain) || '', business_name: (o && o.business_name) || '', brand_names: (o && o.brand_names) || [],
      competitors: (o && o.competitors) || [], configured_competitors: (o && o.configured_competitors) || (o && o.competitors) || [], aliases: (o && o.aliases) || {}, services: (o && o.services) || [], topics: (o && o.topics) || [], business_facts: (o && o.business_facts) || '' };
    const D = dir(plan, (o && o.book) || {});
    const hits = [];
    for (const x of D.scans) { x.re.lastIndex = 0; const m = x.re.exec(t); if (!m) continue; if (D.clientRoots.has(x.root) && !D.confRoots.has(x.root)) continue;
      const role = D.roleOfBook.get(x.root); if (role && role !== 'competitor' && !D.confRoots.has(x.root)) continue;
      hits.push({ at: m.index, name: m[0], why: D.confRoots.has(x.root) ? 'a competitor you track' : PLAT_DOMS.has(D.idOfRoot.get(x.root)) ? 'another vendor\'s product' : 'a business AI names for this topic' }); }
    for (const n of ((o && o.vendors) || [])) { if (!n || D.selfKeys.has(nn(n)) || nn(n).length < 3) continue; const re = nameRe(n); if (!re) continue; re.lastIndex = 0; const m = re.exec(t); if (m && !(D.clientText && nameRe(n).test(D.clientText))) hits.push({ at: m.index, name: m[0], why: 'a company AI names for this topic' }); }
    hits.sort((a, b) => a.at - b.at); return hits[0] || null;
  };

  // ---- E16: one wrong claim, one key, whatever the wording ----
  const CLAIM_STOP = new Set([...STOPW, 'based', 'located', 'headquartered', 'company', 'firm', 'business', 'provider', 'it', 'its', 'they', 'their', 'this', 'that', 'which', 'who', 'has', 'have', 'was', 'were', 'be', 'been', 'as', 'also', 'only', 'offers', 'offer', 'provides', 'provide']);
  const stems = (s) => new Set(low(s).replace(/[’']/g, '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !CLAIM_STOP.has(w)).map(w => w.length > 4 ? w.replace(/(ings|ing|ies|ers|er|ed|es|s)$/, '') : w));
  const jac = (a, b) => { if (!a.size && !b.size) return 1; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
  const splitIssue = (t) => { const s = String(t || ''); const i = s.indexOf(' → '); return i >= 0 ? [s.slice(0, i), s.slice(i + 3).replace(/^[\p{L} ]{2,30}:\s*/u, '')] : [s, '']; };   // the fact side without its fact-sheet label ("City: Dubai" = "Dubai")
  /** the same wrong claim: it contradicts the same fact (the correct side) and says it in overlapping words (Jaccard >= 0.5 on stems) */
  const sameClaim = (a, b) => { const [ca, fa] = splitIssue(a), [cb, fb] = splitIssue(b); const F1 = stems(fa), F2 = stems(fb);
    if ((F1.size || F2.size) && jac(F1, F2) < 0.6) return false; return jac(stems(ca), stems(cb)) >= 0.5; };
  const claimKey = (t) => { const [c, f] = splitIssue(t); return [...stems(f)].sort().join(' ') + '|' + [...stems(c)].sort().join(' '); };

  return { servicesOf, L, low, normD, regD, hostOf, labelOf, core, commonWord, nameLike, nameRe, visible, kindOfDomain, brandNames, ownNames, clientPlatforms, bookOf, dir, read, compact, entitiesOf, sameEntity, vendorIn, sameClaim, claimKey, PLATFORMS };
})();
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
// ---- which stored outreach draft may still be offered (P34-1, live 2026-10-12; inlined by build_monitors.py) ----
// AI Growth's report said "8 outreach draft(s) written" and printed a pitch to tax.gov.ae opening "I work at techand.ai" — a draft
// written on 2026-10-02, before the D12 / D13 gates (no government portals, no competitors, no bare homepages, the business name from
// the site model, a quote from their own page). Nothing had written it this week: the counter read the stored prospect row.
// Every writer now stamps `drafted_at` on the row it drafts for. A stored draft with no stamp, or one from before the gates, is
// **superseded**: the row is cleared, the draft is never counted as this week's work and never offered to the owner. The same is true
// when a site hands drafting over to the Link Builder (one writer). The web app applies the identical rule to the rows already in the
// table (`app/shared/src/outreach.ts`: DRAFT_GATES_AT / prospectDraft).
const DRAFTS = (() => {
  const GATES_AT = '2026-10-12';   // the day the D12 / D13 gates were deployed; a draft written before them is not offered again
  const S = (v) => String(v == null ? '' : v).trim();
  const reason = 'the draft written for them earlier was withdrawn: it was written before the current outreach rules (no government portals, no competitors, no bare homepages, the business name from the site model)';
  const handedOver = 'the Link Builder writes to them (one writer): approve the pitch on the Link building page';
  // a draft that was sent is part of the record (and the follow-ups quote it): it is never withdrawn, whenever it was written
  const sent = (row) => { const r = row || {}; return !!S(r.contacted_at) || ['contacted', 'won'].includes(S(r.status).toLowerCase()); };
  const superseded = (row) => { const r = row || {}; if (!S(r.outreach_body) || sent(r)) return false; const at = S(r.drafted_at).slice(0, 10); return !at || at < GATES_AT; };
  // what this run keeps of a stored row's draft: the draft while it is still valid, else nothing (and `superseded` says why the note changes)
  const carry = (row, o) => { const r = row || {}; const x = o || {}; const had = !!S(r.outreach_body);
    if (x.handover && !sent(r)) return { outreach_subject: '', outreach_body: '', drafted_at: '', superseded: had, reason: handedOver };
    if (superseded(r)) return { outreach_subject: '', outreach_body: '', drafted_at: '', superseded: true, reason };
    return { outreach_subject: S(r.outreach_subject), outreach_body: S(r.outreach_body), drafted_at: S(r.drafted_at), superseded: false, reason: '' }; };
  // a draft this run wrote: stamped, so the next run knows it is current
  const fresh = (d, at) => ({ outreach_subject: S((d || {}).subject).slice(0, 200), outreach_body: S((d || {}).body).slice(0, 3000), drafted_at: S(at), superseded: false, reason: '' });
  return { GATES_AT, superseded, sent, carry, fresh, reason, handedOver };
})();
// ---- the in-200 retry gate, for every provider that answers "failed" with HTTP 200 (R18 / R19, 2026-10-14, FIX_PLAN §3.12) ----
// n8n's `retryOnFail` only fires when a node FAILS. DataForSEO answers a dead task with HTTP 200 and `status_code` 40101
// ("Internal SE Server Error."), Google's URL Inspection answers HTTP 200 with an `error` object ("Internal error
// encountered."): both look like success to n8n, so the run spent the money, got nothing, and carried on.
//   Until 2026-10-14 the only gate of this kind was `AI_Retry_Requests.js` (the AI paths) and the 50000-only IF of build
// section 25, which is why execution 549 billed `SERP Top 10` and `Facts SERP` for two 40101 answers, never re-sent them, and
// planned, scored ("winnable 68") and wrote a page on a results page nobody had seen; and why the technical audit of execution
// 550 lost 31 of 45 URL inspections and reported the 14 that answered as an improvement.
//   This kit is that one rule. Two halves, and the second matters more:
//     1. `RT.dfs` / `RT.google` classify an answer; `RT.retryable` says whether sending it again can help (a transient error
//        can, a permission error or an exhausted quota cannot); `RT.plan` builds the second attempt and `RT.merge` puts its
//        answers in the failed ones' place.
//     2. `RT.stats` / `RT.evidence` / `RT.note` carry what was actually seen — asked, answered, failed, retried — into the
//        report, so evidence that is missing is marked `unavailable` and nothing downstream may score on it. `RT.comparable`
//        is the same idea for two runs: counts measured on samples of different sizes are not compared.
const RT = (() => {
  const S = (x) => String(x == null ? '' : x);
  const N = (x) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };
  // an answer that can be different next time: the provider's own servers, a timeout, a rate limit. Never a wrong request.
  const TRANSIENT = /internal (?:se )?server error|internal error|server error|timeout|timed out|temporar|try again|unavailable|service unavailable|backend|deadline exceeded|connection|socket|econn|eai_again|rate limit|too many requests|\b(?:429|500|502|503|504)\b/i;
  const PERMANENT = /permission|forbidden|unauthor|invalid[_ ]grant|credential|not found|no search results|no access|invalid field|unknown field|unsupported|quota|resource_exhausted|insufficient funds|payment|balance/i;
  // R68 (2026-10-16, re-rating B-10): 40102 "No Search Results." is DataForSEO's FINAL answer that the search has no results — the Google
  // Business Profile lookup for "Tech& Dubai" in execs 595 / 641 — not a failure. It was neither TRANSIENT nor PERMANENT, so it counted as
  // retryable: *Fetch GBP (Retry)* re-sent it and paid $0.0054 for the same 40102 every audit. It is a valid empty answer now: never
  // re-sent, never counted as a failure (Entity_Check already reads it as "no listing"), and marked `empty` so a reader can tell.
  const NO_RESULTS = 40102;
  const errText = (e) => {
    if (!e) return '';
    if (typeof e === 'string') return e.slice(0, 200);
    const ctx = (e.context && e.context.data) || {};
    const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null;
    return S((inner && inner.message) || (ctx.error_description ? S(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200);
  };
  const verdict = (why, code) => {
    const ok = !why;
    const perm = !ok && PERMANENT.test(why) && !TRANSIENT.test(why);
    return { ok, why: why || '', code: code || 0, retryable: !ok && !perm, permanent: perm };
  };
  // the reason a report prints is the provider's OWN message ("Internal SE Server Error.", "Invalid Field: target."), never our
  // paraphrase of it: it is what the owner would see in the provider's console, and it is what `retryable` is decided on.
  const said = (msg, code, dflt) => S(msg).trim() ? S(msg).trim().slice(0, 160) : (code ? dflt + ' (error ' + code + ')' : dflt);
  /** one DataForSEO answer (the whole envelope of a live endpoint). The same four cases AI_Retry_Requests.js has used since D19. */
  const dfs = (r) => {
    const res = r || {};
    if (res.error) return verdict(errText(res.error) || 'the request failed');
    if (N(res.status_code) === NO_RESULTS) return { ...verdict('', NO_RESULTS), empty: true, permanent: true, said: S(res.status_message) || 'No Search Results.' };
    if (N(res.status_code) >= 40000) return verdict(said(res.status_message, N(res.status_code), 'the search data provider reported an error'), N(res.status_code));
    if (!Array.isArray(res.tasks) || !res.tasks.length) return verdict('no answer from the search data provider');
    const t = res.tasks[0] || {};
    const code = N(t.status_code);
    if (!code) return verdict('no answer from the search data provider');
    if (code === NO_RESULTS || (code >= 40000 && /no search results/i.test(S(t.status_message))))
      return { ...verdict('', code), empty: true, permanent: true, said: S(t.status_message) || 'No Search Results.' };
    if (code >= 40000) return verdict(said(t.status_message, code, 'the search data provider reported an error'), code);
    if (code === 20000 && !((t.result || [])[0])) return verdict('the search data provider returned no result', code);
    return verdict('', code);
  };
  /** one Google API answer (URL Inspection, Search Analytics): an `error` object, or the field the caller expected missing. */
  const google = (r, expect) => {
    const res = r || {};
    if (res.error) return verdict(errText(res.error));
    const want = S(expect);
    if (want && !res[want]) return verdict('no ' + want + ' in the answer');
    return verdict('');
  };
  const check = (r, o) => { const opt = o || {}; return opt.api === 'google' ? google(r, opt.expect) : dfs(r); };
  /** [answers] -> [{ i, why, retryable }] for the ones that failed (same order as the requests). */
  const failures = (answers, o) => (answers || []).map((r, i) => ({ i, v: check(r, o) })).filter(x => !x.v.ok).map(x => ({ i: x.i, why: x.v.why, code: x.v.code, retryable: x.v.retryable, permanent: x.v.permanent }));
  /** the second attempt: the failed requests, once, newest rule first — never more than `max`, never a permanent failure. */
  const plan = (requests, answers, o) => {
    const opt = o || {};
    const max = opt.max == null ? 60 : opt.max;
    const fails = failures(answers, opt).filter(f => !opt.only || opt.only(requests[f.i], f));
    const retryable = fails.filter(f => f.retryable);
    const out = retryable.slice(0, max).map(f => ({ ...(requests[f.i] || {}), retry_of: f.i, retry_reason: f.why, is_retry: true }));
    return { items: out, failed: fails.length, retryable: retryable.length, skipped: Math.max(0, retryable.length - out.length),
      permanent: fails.filter(f => f.permanent).map(f => f.why).slice(0, 3), reasons: fails.map(f => f.why).slice(0, 5) };
  };
  /** the first answers with each retry's answer in the failed one's place (the retry's own failure keeps the first reason). */
  const merge = (answers, retryItems, retryAnswers, o) => {
    const out = (answers || []).slice();
    (retryItems || []).forEach((q, k) => {
      const i = Number(q && q.retry_of);
      const a = (retryAnswers || [])[k];
      if (!Number.isFinite(i) || a === undefined) return;
      if (check(a, o).ok) out[i] = a;
    });
    return out;
  };
  /** what was actually seen, in numbers a report can print. */
  const stats = (answers, o, retryItems, retryAnswers) => {
    const opt = o || {};
    const first = failures(answers, opt);
    const merged = merge(answers, retryItems, retryAnswers, opt);
    const after = failures(merged, opt);
    const asked = (answers || []).length;
    const retried = (retryItems || []).length;
    return { asked, answered: asked - after.length, failed: after.length, failed_first: first.length, retried,
      retry_answered: Math.max(0, first.length - after.length), reasons: [...new Set(after.map(f => f.why))].slice(0, 3), answers: merged };
  };
  /** the same, for a path that makes ONE call and has one retry node (the SERP / facts / keyword-data gates). */
  const one = (first, retry, o) => stats([first], o, retry == null ? [] : [{ retry_of: 0 }], retry == null ? [] : [retry]);
  /** F-SERP (2026-10-20): ONE call sent up to N times in a row (the head keyword's results page: first, retry, lighter last try).
   *  `attempts` is [first, second, third ...] in the order they were sent, `null` for an attempt that never ran. The answer is the
   *  first attempt that answered (later attempts only run when the earlier ones failed); when none did, the FIRST failure's reason is
   *  kept, as `one` keeps it. `attempts` / `answered_on` say how many were sent and which one answered (1-based, 0 = none). */
  const chain = (attempts, o) => {
    const made = (attempts || []).map((a, k) => ({ a, k })).filter(x => x.a != null);
    if (!made.length) return { asked: 1, answered: 0, failed: 1, failed_first: 1, retried: 0, retry_answered: 0, reasons: ['no answer'], answers: [{}], attempts: 0, answered_on: 0, reasons_by_attempt: [] };
    const verdicts = made.map(x => ({ k: x.k, a: x.a, v: check(x.a, o) }));
    const hit = verdicts.find(x => x.v.ok);
    const firstV = verdicts[0];
    return { asked: 1, answered: hit ? 1 : 0, failed: hit ? 0 : 1, failed_first: firstV.v.ok ? 0 : 1, retried: made.length - 1,
      retry_answered: hit && hit !== firstV ? 1 : 0, reasons: hit ? [] : [firstV.v.why || 'no answer'], answers: [hit ? hit.a : firstV.a],
      attempts: made.length, answered_on: hit ? hit.k + 1 : 0, reasons_by_attempt: verdicts.map(x => x.v.ok ? '' : x.v.why),
      retryable: hit ? false : verdicts[verdicts.length - 1].v.retryable };
  };
  /** one sentence about those numbers, in the words the reports already use. */
  const note = (s, what) => {
    const st = s || {}; const thing = S(what) || 'request';
    const plural = (n) => n === 1 ? thing : thing + 's';
    if (!st.asked) return '';
    if (!st.failed && !st.retried) return '';
    if (!st.failed) return st.failed_first + ' of ' + st.asked + ' ' + plural(st.asked) + ' failed and ' + (st.retry_answered === 1 ? 'the retry answered' : 'all ' + st.retry_answered + ' answered when they were sent again') + '.';
    const again = (st.attempts > 2 && st.asked === 1) ? 'sent ' + st.attempts + ' times' : 'sent again once';   // F-SERP: one call sent three times is not "sent again once"
    return st.failed + ' of ' + st.asked + ' ' + plural(st.asked) + ' could not be checked' + (st.retried ? ' (' + again + ', ' + st.retry_answered + ' answered)' : ' (no answer)')
      + (st.reasons.length ? ': ' + st.reasons.join('; ') : '') + '. Only the ' + st.answered + ' that answered are counted below.';
  };
  /** the evidence block a score may be refused on: `unavailable` means nobody saw it, twice. */
  const evidence = (what, s, extra) => {
    const st = s || {};
    const unavailable = !st.asked || st.answered === 0;
    return { what: S(what), asked: st.asked || 0, checked: st.answered || 0, failed: st.failed || 0, retried: st.retried || 0,
      retry_answered: st.retry_answered || 0, unavailable, partial: !unavailable && (st.failed || 0) > 0,
      error: (st.reasons || [])[0] || '', note: note(st, (extra && extra.unit) || 'request'), ...(extra || {}) };
  };
  /** two counts measured on samples of different sizes are not a change (R19): say the sample moved instead of printing a delta.
   *  `unit` names what the sample is made of ("pages" by default, "questions" for the AI panel, "sources" for a link snapshot). */
  const MAX_SAMPLE_DRIFT = 0.2;
  const comparable = (now, before, o) => {
    const opt = o || {};
    const tol = opt.tolerance == null ? MAX_SAMPLE_DRIFT : opt.tolerance;
    const unit = S(opt.unit);                     // named only where the caller said what the sample is made of
    const a = Number(now), b = Number(before);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return { comparable: false, why: 'how many ' + (unit || 'pages') + ' each number was measured on was not recorded', drift: null };
    const drift = Math.abs(a - b) / Math.max(a, b);
    if (drift > tol) return { comparable: false, drift: Math.round(drift * 100) / 100,
      why: 'the two counts were measured on different samples (' + b + (unit ? ' ' + unit : '') + ' then, ' + a + ' now), so they are not compared' };
    return { comparable: true, drift: Math.round(drift * 100) / 100, why: '' };
  };
  /** the other half of like for like (R20, B-L4 / B-L5, 2026-10-15): two figures produced by runs of a DIFFERENT KIND are not a
   *  change either. R20 was a health score chained across a technical audit and a full report; the same shape reaches the AI
   *  panel (a weekly check asks fewer engines than the monthly full one) and the link ledger (a free_only snapshot is built from
   *  a different set of sources than a paid one). `labels` turns the stored key into the words a customer reads. The guard is a
   *  CALL, never an inlined kit: lineage_lint.py looks for the prefixed call, which this file never writes, so a node cannot
   *  look guarded without using it. Keep it that way: build section 73 fails if this kit ever spells one of those calls out. */
  const likeForLike = (now, before, o) => {
    const opt = o || {}, lab = opt.labels || {};
    const a = S(now).trim().toLowerCase(), b = S(before).trim().toLowerCase();
    const what = S(opt.what) || 'these two figures';
    const name = (k) => S(lab[k]) || k;
    if (!a || !b) return { comparable: false, why: 'what kind of run produced ' + (b ? 'this figure' : 'the earlier figure') + ' was not recorded, so ' + what + ' are not compared', kind: a, kind_before: b };
    if (a !== b) return { comparable: false, kind: a, kind_before: b,
      why: 'the earlier figure came from ' + name(b) + ' and this one from ' + name(a) + ', which do not measure the same thing, so ' + what + ' are not compared' };
    return { comparable: true, why: '', kind: a, kind_before: b };
  };
  return { dfs, google, check, failures, plan, merge, stats, one, chain, note, evidence, comparable, likeForLike, errText, MAX_SAMPLE_DRIFT, TRANSIENT, PERMANENT, NO_RESULTS };
})();
// ---- C-2 / C-8 (re-rating 2026-10-17): one answer to "is this site a rival?", for every path that labels a site a PR target or a prospect ----
// The 2026-10-17 run told the customer to "ask the editor of flick.network to add Tech& to this list" (AI Growth) ten minutes after the AI
// visibility run listed flick.network among "businesses AI recommends instead of you", while the Link Builder refused the same site as a
// competitor; AI visibility labelled erp-dubai.ae ("ERPNext Implementation Partner in UAE & Dubai") and penieltech.com ("Odoo
// Implementation in Umm Al Quwain") "site (PR target)" and wrote them as prospects; the Link Builder qualified erp-dubai.ae, penieltech.com,
// halsimplify.com (HAL ERP) and pactsoft.ae (named by the AI answers as "PACT REVENU") as `needs_contact`. Four paths, four rival sets.
// This kit is the shared part, inlined by itself into AI Metrics and through the outreach kit (OK) everywhere else:
//  * RV.set(...)        - one rival set: the declared competitors, the businesses AI names (the Answer Analyst's `ai_brands:` aliases, the
//                         stored `rival_sources_json` / `competitors_json`), and the sites that outrank you (stored SERP competitors).
//                         `business` rivals (declared, named by AI, or selling what you sell) are never a pitch, not even their own
//                         "best X" list - a competitor ranks itself first and does not add you; a SERP-only rival (a publisher that
//                         outranks you) keeps the old rule: its list page is still fair to pitch.
//  * RV.providerOf(...) - a site that sells your CATEGORY whatever product names it uses: its page title, URL or its own about / contact
//                         text says "<category word> <provider word>" ("ERPNext Implementation Partner", "Odoo Implementation", "ERP
//                         Software", "IT Company"). The services list of a site names products (Azure, Dynamics 365 Finance …), which is
//                         why the service-overlap rule never matched an ERP or e-invoicing implementer that names other products.
//                         A roundup ("Top 10 …", "Best …") and a directory of providers (plural: "Service Providers", "Partners") is
//                         not a provider claim.
const RV = (() => {
  const S = (v) => String(v == null ? '' : v);
  const norm = (h) => S(h).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
  const reg = (h) => { const x = norm(h); const p = x.split('.').filter(Boolean); if (p.length <= 2) return x;
    const sl = p.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil)\.[a-z]{2}$/.test(sl) ? p.slice(-3).join('.') : sl; };
  // the categories a business can sell, each a family of words that name it (products of the category count: Odoo is an ERP)
  const FAMILIES = {
    erp: { label: 'ERP', words: ['erp', 'erpnext', 'odoo', 'netsuite', 'business central', 'dynamics 365', 'dynamics', 'sap business one', 'sap', 'acumatica', 'sage x3', 'tally', 'zoho books', 'oracle fusion', 'epicor', 'infor'] },
    einvoicing: { label: 'e-invoicing', words: ['e-invoicing', 'einvoicing', 'e invoicing', 'e-invoice', 'einvoice', 'peppol', 'asp'] },
    crm: { label: 'CRM', words: ['crm', 'salesforce', 'hubspot'] },
    it: { label: 'IT services', words: ['it'] },
    ai: { label: 'AI', words: ['ai', 'artificial intelligence', 'machine learning', 'copilot', 'generative ai'] },
    cloud: { label: 'cloud', words: ['azure', 'cloud', 'aws', 'cloud migration'] },
  };
  // singular provider words only: "Service Providers", "Partners", "Companies" are a directory OF providers, not a provider
  const PROV = '(software|system|systems|solution|solutions|platform|provider|partner|implementation|implementer|consulting|consultancy|consultant|services|service|reseller|integrator|company|agency|firm|expert)';
  // for the broad categories (AI, cloud, IT) only the words of a business that SELLS the work: "AI platform" or "cloud software" is too
  // often a news headline; "AI consulting", "Cloud Services", "IT Company" is a provider
  const PROV_SELL = '(consulting|consultancy|consultant|company|agency|partner|implementation|implementer|services|service|reseller|integrator|firm|expert)';
  const BROAD = new Set(['ai', 'cloud', 'it']);
  const NOT_AFTER = '(?![\\s-]+(?:providers|partners|companies|vendors|consultants|firms|agencies|experts|list|lists|directory|rules?|requirements?|deadlines?|guide))';
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+');
  const ROUNDUP = /\b(best|top\s*\d+|top ten|alternatives?|round-?up|shortlist|directory|listing|list of|compar(?:e|ed|ison)|vs)\b/i;   // 'Top ERP System' is a vendor's SEO title, not a list (R89)
  const res = {};
  const reOf = (fam, w) => { const k = fam + ':' + w; if (res[k]) return res[k];
    // "IT" is only the category in capitals ("IT Company", "IT Services"), never the pronoun
    const P = BROAD.has(fam) ? PROV_SELL : PROV;
    return (res[k] = fam === 'it' ? new RegExp('\\bIT[\\s-]+' + P + '(?:[\\s-]+' + P + ')?\\b' + NOT_AFTER, 'gi')
      : new RegExp('\\b' + esc(w) + '\\b(?:[\\s-]+[A-Za-z0-9&.]+){0,' + (BROAD.has(fam) ? 0 : 1) + '}?[\\s-]+' + P + '(?:[\\s-]+' + P + ')?\\b' + NOT_AFTER, 'gi')); };
  // the categories THIS site sells: a family is active when one of its words is in the site's own topics or services
  const families = (o) => { const t = ' ' + [...(o.topics || []), ...(o.services || []), ...(o.terms || [])].map(S).join(' | ').toLowerCase() + ' ';
    return Object.keys(FAMILIES).filter(f => f === 'it' ? /\bit (consult|servic|solution|support|compan|managed)/.test(t) || /\bmanaged it\b/.test(t)
      : FAMILIES[f].words.some(w => new RegExp('(^|[^a-z0-9])' + esc(w) + '([^a-z0-9]|$)').test(t))); };
  // a CLAIM in a title is the category phrase standing for what the page sells: at the end, before a separator, a place or a year
  // ("ERPNext Implementation Partner in UAE", "Elate ERP | ERP Software in Dubai") - not a topic phrase inside a sentence ("ERP software for
  // distributors in the UAE: what to ask" is an article). The address and the site's own pages are read without that condition.
  const TAIL = /^\s*(?:$|[|\-\u2013\u2014:,(&]|(?:in|across|for (?:businesses|companies|smes|enterprises))\b|(?:uae|dubai|saudi|ksa|qatar|oman|bahrain|kuwait)\b|\d{4}\b)/i;
  const claims = (text, fams, strict) => { const out = []; const src = S(text);
    for (const f of fams) for (const w of FAMILIES[f].words) { const re = reOf(f, w); re.lastIndex = 0;
      const m = [...src.matchAll(re)].find(x => (f !== 'it' || src.slice(x.index, x.index + 2) === 'IT') && (!strict || TAIL.test(src.slice(x.index + x[0].length))));
      if (m) { out.push({ family: f, label: FAMILIES[f].label, phrase: m[0].replace(/\s+/g, ' ').trim().slice(0, 80) }); break; } }
    return out; };
  const slugWords = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[\/_?.&=#-]+/g, ' ').trim();
  const NOT_RIVAL_HOST = (d) => NOT_RIVAL.test(reg(d)) || NOT_RIVAL.test(norm(d));
  // ---- C-8 leftover (F-L, 2026-10-18): the STOREFRONT of the page itself. halsimplify.com (HAL ERP) and tradeshift.com (an e-invoicing
  // network) were qualified from an article and a buyer's guide whose titles and addresses claim nothing - but the same page's own menu sells
  // the category ("Conversational ERP", "E-invoicing (VAT CARE)", "HAL vs Odoo / SAP B1 / Microsoft Dynamics"; "Compliance for e-Invoicing
  // Software") and the page asks the reader to "Request a demo". Both halves are required: a menu that names the category (a provider phrase,
  // or two different words of a specific category: ERP / e-invoicing / CRM products - never the broad AI / cloud / IT words a news menu
  // carries) AND a sales call to action (demo, trial, pricing, quote, sales). A ministry, a publisher, a guide site or a directory has the
  // first at most; a roundup page is not judged here at all (the caller exempts lists, and a "Best …" title is skipped below).
  const STRONG_CTA = /\b(?:request|book|get|schedule)(?:\s+a|\s+your)?\s+demo\b|\bfree\s+trial\b|\bstart\s+(?:for\s+)?free\b|\bpricing\b|\bget\s+a\s+quote\b|\b(?:contact|talk\s+to)\s+sales\b/i;
  const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  const textOf = (h) => S(h).replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<svg\b[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, k) => k[0] === '#' ? ' ' : (ENT[k.toLowerCase()] || ' ')).replace(/\s+/g, ' ').trim();
  const menuOf = (html) => (S(html).match(/<(nav|header)\b[\s\S]*?<\/\1>/gi) || []).slice(0, 6).map(textOf).join(' | ').slice(0, 12000);
  const storefront = (c, fams) => {
    const html = S(c.page_html); if (html.length < 200) return '';
    const menu = menuOf(html); if (menu.length < 20) return '';
    // "pricing" counts only as a menu link: an article body says "pricing" whenever it discusses cost; a demo / trial / quote / sales button
    // counts anywhere on the page
    const cta = (menu.match(STRONG_CTA) || textOf(html).replace(/\bpricing\b/gi, ' ').match(STRONG_CTA) || [])[0]; if (!cta) return '';
    const said = claims(menu, fams, false);
    let what = said.length ? said[0].label + ' ("' + said[0].phrase + '")' : '';
    if (!what) {
      const hits = []; for (const f of fams.filter(x => !BROAD.has(x))) for (const w of FAMILIES[f].words) {
        const k = w.toLowerCase().replace(/[\s-]+/g, '');   // "e-invoicing", "e invoicing" and "einvoicing" are one word
        if (new RegExp('(^|[^a-z0-9])' + esc(w) + '([^a-z0-9]|$)', 'i').test(menu) && !hits.some(h => h.k === k)) hits.push({ f, w, k }); }
      if (hits.length >= 2) what = [...new Set(hits.map(h => FAMILIES[h.f].label))].join(' / ') + ' (its menu names ' + hits.slice(0, 4).map(h => '"' + h.w + '"').join(', ') + ')';
    }
    return what ? 'its own site menu sells ' + what + ' and the page asks visitors to "' + cta.replace(/\s+/g, ' ').trim() + '"' : '';
  };
  // o: { title, url, site_text, page_html, topics, services, domain } -> '' or the reason it is a competing provider of your category
  const providerOf = (o) => {
    const c = o || {}, fams = families(c); if (!fams.length) return '';
    if (c.domain && NOT_RIVAL_HOST(c.domain)) return '';   // a platform, an official body, a news site, a directory or a consultancy is never a provider of your category
    const title = S(c.title);
    // a question ("Which e-invoicing provider are you using?" on a forum) asks about providers; it does not claim to be one
    const question = /\?\s*$/.test(title) || /^(which|what|who|how|where|why|is|are|do|does|can|should|best)\b/i.test(title);
    if (title && !ROUNDUP.test(title) && !question) { const t = claims(title, fams, true); if (t.length) return 'its page title says it sells ' + t[0].label + ' ("' + title.slice(0, 90) + '")'; }
    if (!ROUNDUP.test(title) && !question) { const sf = storefront(c, fams); if (sf) return sf; }   // C-8 leftover: the page's own menu + a sales call to action
    const slug = slugWords(c.url); if (slug && !ROUNDUP.test(slug)) { const t = claims(slug, fams); if (t.length) return 'its page address says it sells ' + t[0].label + ' (' + S(c.url).replace(/^https?:\/\/(www\.)?/i, '').slice(0, 90) + ')'; }
    const site = S(c.site_text).slice(0, 60000); if (site.length < 200) return '';
    // its own about / contact pages: two different phrases presenting it as a provider of your category
    const seen = new Map();
    for (const f of fams) for (const w of FAMILIES[f].words) { const re = new RegExp(reOf(f, w).source, 'gi');
      for (const m of site.matchAll(re)) { if (f === 'it' && site.slice(m.index, m.index + 2) !== 'IT') continue; const ph = m[0].replace(/\s+/g, ' ').trim().toLowerCase(); if (!seen.has(ph)) seen.set(ph, FAMILIES[f].label); if (seen.size >= 6) break; } }
    if (seen.size < 2) return '';
    const ph = [...seen.keys()].slice(0, 2);
    return 'its own site presents it as a provider of ' + [...new Set(seen.values())].slice(0, 2).join(' / ') + ' ("' + ph.join('", "') + '")';
  };
  // the one rival set. Each input is a list of domains or {domain, why}; `kind` says whether it is a business rival or a SERP-only one.
  const set = (o) => {
    const c = o || {}, own = reg(c.own), m = new Map();
    const add = (d, kind, why) => { const x = reg(d && typeof d === 'object' ? (d.domain || d.host) : d); if (!x || !/\./.test(x) || x === own) return;
      const old = m.get(x); if (old && old.kind === 'business') return; m.set(x, { domain: x, kind, why: S(why || (d && d.why)) }); };
    for (const d of (c.declared || [])) add(d, 'business', 'a competitor you declared');
    for (const d of (c.ai || [])) add(d, 'business', 'a business AI recommends instead of you');
    for (const d of (c.serp || [])) add(d, 'serp', 'a site that outranks you for one of your own keywords');
    const of = (h) => m.get(reg(h)) || null;
    return { of, has: (h) => !!of(h), business: (h) => { const e = of(h); return !!e && e.kind === 'business'; }, size: m.size, entries: () => [...m.values()] };
  };
  // the businesses AI recommends instead of the site, as the AI Visibility Tracker last stored them: its latest seo_ai_visibility row
  // (rival_sources_json: the cited rivals, vendors and every named business; competitors_json: the share-of-voice rows) and the Answer
  // Analyst's learned names (seo_cache `ai_brands:<site>`). Official bodies, platforms, news sites, directories and consultancies are never
  // "rivals" (they keep their own kind); neither is the site itself.
  const NOT_RIVAL = /\.gov(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$|(^|\.)(youtube|linkedin|facebook|instagram|x|twitter|tiktok|reddit|quora|wikipedia|medium|github|google|bing|apple|amazon)\.[a-z.]+$|(^|\.)(gulfnews|khaleejtimes|thenationalnews|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|thenational|arabnews)\.[a-z.]+$|(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp)\.[a-z.]+$|(^|\.)(deloitte|pwc|kpmg|ey|gartner|forrester|mckinsey|accenture|statista|bcg|bain|idc)\.[a-z.]+$/i;
  const parseJ = (v, d) => { if (v && typeof v === 'object') return v; try { return JSON.parse(S(v) || ''); } catch (e) { return d; } };
  const aiRivals = (o) => {
    const c = o || {}, sid = S(c.site_id), own = reg(c.own), out = new Map();
    const add = (d, why) => { const x = reg(d); if (!x || !/\./.test(x) || x === own || NOT_RIVAL.test(x) || out.has(x)) return; out.set(x, { domain: x, why }); };
    const rows = (c.vis_rows || []).filter(r => r && S(r.site_id) === sid && S(r.checked_at)).sort((a, b) => S(b.checked_at).localeCompare(S(a.checked_at)));
    const v = rows[0];
    if (v) {
      for (const r of (parseJ(v.rival_sources_json, []) || [])) add(r && (r.domain || r), r && r.kind === 'vendor' ? 'sells what you sell: ' + S(r.why) : 'a business AI recommends instead of you');
      for (const r of (parseJ(v.competitors_json, []) || [])) add(r && r.domain, 'a business AI recommends instead of you (' + (Number(r && r.mentions) || 0) + ' answers)');
    }
    const cache = (c.cache_rows || []).find(r => r && S(r.key) === 'ai_brands:' + sid);
    const names = cache ? parseJ(cache.value, {}) : {};
    for (const [nm, d] of Object.entries(names || {})) add(d, 'a business AI recommends instead of you (named "' + S(nm).slice(0, 40) + '")');
    return [...out.values()];
  };
  // C-10: a national news publisher of the market is in the market whatever its domain ending (gulfnews.com is a UAE paper; the link gap
  // refused it as "neither its name, its page nor its country ties it to dynamics 365 partner uae")
  const MARKET_MEDIA = { AE: /(^|\.)(gulfnews|khaleejtimes|thenationalnews|thenational|zawya|arabianbusiness|gulfbusiness|emirates247|wam|albayan|alkhaleej|emaratalyoum|timeoutdubai|whatson|constructionweekonline|itp|tahawultech|gulfmagazine|edgemiddleeast)\.[a-z.]+$/i,
    SA: /(^|\.)(arabnews|saudigazette|argaam|okaz|aleqt|spa)\.[a-z.]+$/i, QA: /(^|\.)(gulf-times|thepeninsulaqatar|qna|alraya)\.[a-z.]+$/i,
    GB: /(^|\.)(bbc|theguardian|telegraph|thetimes|ft|independent|cityam)\.[a-z.]+$/i, IN: /(^|\.)(timesofindia|economictimes|livemint|thehindu|business-standard|moneycontrol)\.[a-z.]+$/i };
  const marketMedia = (d, iso) => { const re = MARKET_MEDIA[S(iso).toUpperCase()]; return !!re && re.test(norm(d)); };
  return { set, providerOf, storefront, menuOf, families, reg, aiRivals, marketMedia, ROUNDUP, FAMILIES, NOT_RIVAL };
})();
// RV-1 (2026-10-21, pre-launch run on techand.ai): the brief said "build on your existing D365 F&O pages" and the report listed them as "your
// cited pages" while they answer 404. The page inventory says what each address answered (seo_pages.http_status, the Site Tracker): a cited
// page that no longer answers is flagged, kept out of the brief's pages to build on, and turned into the one redirect action (_gone.js).
// ---- RV-1 (2026-10-21, pre-launch run on techand.ai): PAGES THAT ARE GONE, ONE MESSAGE EVERYWHERE (inlined where a node asks for the GONE kit marker) ----
// The site was rebuilt: Search Console still showed ~34 old addresses (2-3k of 5.7k impressions) that answer 404 (the bare host 308s to
// www, which 404s) and nothing redirects them. The audit filed some as "redirect somewhere else" (Low), the weekly site report told the
// owner to make one of them "the single page" for a search, the AI visibility brief said "build on your existing D365 pages" and AI
// Growth sent them to Bing. The first thing the owner has to hear is one sentence: these addresses are gone, redirect each to this page.
// This kit holds that sentence, the suggested target of each redirect and the redirect files, so every report says the same thing:
//   GONE.isGone(status)            404 / 410 after following redirects (a bot wall, a timeout or a 5xx is NOT gone: not known)
//   GONE.plan(dead, live, home)    [{ from_url, from, to, to_url, status, impressions, clicks, match }] most impressions first
//   GONE.finding(plan, o)          the audit finding (one title, one fix) with the full list in `redirects`
//   GONE.action(plan)              the weekly / AI report action (priority 1)
//   GONE.files(plan, today)        { csv, nginx, htaccess } for the fix pack
//   GONE.keyOf(u) / GONE.drop(list, set, pick)   host-agnostic address key, and "leave the gone addresses out of this list"
// Customer text: plain words, no dashes used as punctuation, no ellipsis.
const GONE = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const isGone = (st) => { const n = n0(st); return n === 404 || n === 410; };
  const keyOf = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/(.)\/+$/, '$1') || '/';
  const fmt = (v) => n0(v).toLocaleString('en-GB');
  // words that say nothing about which page an old address was about (places, filler, the generic page words of every site)
  const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'our', 'what', 'how', 'why', 'who', 'are', 'you', 'its', 'into', 'about', 'uae', 'dubai', 'abu', 'dhabi',
    'sharjah', 'emirates', 'united', 'arab', 'html', 'htm', 'php', 'aspx', 'page', 'pages', 'index', 'www', 'com', 'new', 'best', 'top', 'guide', 'complete', 'every', 'must']);
  const stem = (t) => t.length >= 5 ? t.replace(/(ations?|ings?|ants?|ers?)$/, '').replace(/s$/, '').replace(/e$/, '') : t;   // services = service, operations = operation
  const words = (s) => [...new Set(S(s).toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)).map(stem))];
  // the closest live page: the one sharing the most specific words with the old address (a word most live pages carry counts for little);
  // without one, the section page the old address sat under when that page is live, else the home page, and the match says which it was
  const plan = (dead, live, home) => {
    const deadKeys = new Set((Array.isArray(dead) ? dead : []).map(d => keyOf(d.url || d.from_url)));
    const L = (Array.isArray(live) ? live : []).map(p => ({ url: S(p.url), path: pathOf(p.url), title: S(p.title || p.h1), status: p.status != null ? p.status : p.http_status }))
      .filter(p => p.url && !isGone(p.status) && !deadKeys.has(keyOf(p.url)));
    const homeUrl = S(home) || (L.find(p => p.path === '/') || {}).url || '/';
    const docs = L.filter(p => p.path !== '/').map(p => ({ p, w: new Set([...words(p.path.replace(/[\/_-]+/g, ' ')), ...words(p.title)]) }));
    const df = new Map(); for (const d of docs) for (const w of d.w) df.set(w, (df.get(w) || 0) + 1);
    const idf = (w) => Math.log(1 + (docs.length + 1) / (1 + (df.get(w) || 0)));
    const seen = new Set(); const out = [];
    for (const d0 of (Array.isArray(dead) ? dead : [])) {
      const url = S(d0.url || d0.from_url); const k = keyOf(url); if (!url || seen.has(k)) continue; seen.add(k);
      const path = pathOf(url); const want = words(path.replace(/[\/_-]+/g, ' '));
      let best = null;
      for (const d of docs) { const shared = want.filter(w => d.w.has(w)); if (!shared.length) continue;
        const score = shared.reduce((s, w) => s + idf(w), 0);
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && d.p.path.length < best.p.path.length)) best = { p: d.p, score, shared }; }
      const strong = best && (best.shared.length >= 2 || best.score >= 1.2);
      const parent = path.split('/').filter(Boolean).slice(0, -1).join('/');
      const section = parent ? L.find(p => p.path === '/' + parent) : null;
      const to = strong ? best.p : section || null;
      out.push({ from_url: url, from: path, to_url: to ? to.url : homeUrl, to: to ? to.path : '/', status: n0(d0.status || d0.http_status), impressions: n0(d0.impressions), clicks: n0(d0.clicks),
        match: strong ? 'same topic (shares "' + best.shared.slice(0, 3).join('", "') + '")' : section ? 'its section page' : 'home page (no live page matches it by name: use a better page if you have one)' });
    }
    return out.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.from.localeCompare(b.from));
  };
  const totals = (pl) => (pl || []).reduce((t, r) => ({ impressions: t.impressions + n0(r.impressions), clicks: t.clicks + n0(r.clicks) }), { impressions: 0, clicks: 0 });
  const line = (r) => r.from + (r.impressions ? ' (' + fmt(r.impressions) + ' impressions)' : '') + ' to ' + r.to;
  const TITLE = 'Pages Google still shows no longer answer: redirect them';
  const TITLE_UNSEEN = 'Known URLs outside the crawl no longer answer';
  const FIX = 'Add a permanent (301) redirect from each old address to the page suggested for it (redirects.csv in the fix pack lists every one, with nginx and Apache versions; use a better page where you have one), then take the old addresses out of the sitemap and the internal links.';
  // the audit finding: one title and one fix wherever a gone page is found; `o.note` is the sample the reading came from
  const finding = (pl, o) => {
    const x = o || {}; const t = totals(pl); const seen = (pl || []).filter(r => r.impressions > 0 || r.clicks > 0);
    const codes = [...new Set((pl || []).map(r => r.status).filter(Boolean))].map(c => 'HTTP ' + c).join(' / ') || 'HTTP 404';
    return { category: 'Crawlability & Indexing', severity: seen.length ? 'High' : 'Medium', title: seen.length ? TITLE : TITLE_UNSEEN,
      evidence: (pl || []).length + ' address(es) answer ' + codes + (x.via_redirect ? ' (' + x.via_redirect + ' of them only after a redirect to the main host)' : '') + ': '
        + (pl || []).slice(0, 5).map(r => r.from + ': HTTP ' + (r.status || 404) + (r.impressions ? ', ' + fmt(r.impressions) + ' impressions' : '')).join('; ')
        + ((pl || []).length > 5 ? '; and ' + ((pl || []).length - 5) + ' more' : '') + (x.note ? '. ' + x.note : '')
        + (seen.length ? '; ' + seen.length + ' of them still earn impressions in Search Console (' + fmt(t.impressions) + ' impressions and ' + fmt(t.clicks) + ' clicks in the last 28 days)' : ''),
      why: seen.length ? 'Google still shows these addresses in search, and every visitor who clicks them, and every link that points at them, lands on an error page. Until they redirect, the visibility they earned is lost, and Google drops them one by one.'
        : 'These addresses are in your sitemap or were known before, but they return an error. Visitors and crawlers that follow them hit a dead end, and the link value pointing at them is lost.',
      fix: FIX, sample_urls: (pl || []).slice(0, 5).map(r => r.from_url), affected_urls: (pl || []).slice(0, 200).map(r => r.from_url), affected_count: (pl || []).length || null,
      scope: 'page', scoring: true, source: x.source || 'gone', figure: '', redirects: (pl || []).slice(0, 200) };
  };
  const action = (pl) => { const t = totals(pl); if (!(pl || []).length) return null;
    return { priority: 1, type: 'redirect_gone', keyword: '', url: (pl[0] || {}).from_url || '',
      action: 'Redirect the ' + pl.length + ' old address(es) that now answer 404 (301 to the closest live page): ' + pl.slice(0, 4).map(line).join('; ') + (pl.length > 4 ? '; and ' + (pl.length - 4) + ' more' : '') + '.',
      why: 'Google still shows them (' + fmt(t.impressions) + ' impressions and ' + fmt(t.clicks) + ' clicks in the last 28 days), and every visit and every link to them ends on an error page. Do not work on these pages: they no longer exist.',
      redirects: pl.slice(0, 60) }; };
  const q = (v) => '"' + S(v).replace(/"/g, '""') + '"';
  const files = (pl, today) => { const L = (pl || []).filter(r => r.from && r.to && r.from !== r.to); if (!L.length) return null; const d = S(today) || new Date().toISOString().slice(0, 10);
    return { count: L.length,
      csv: 'from,to,http_status_now,impressions_28d,match\n' + L.map(r => [r.from, r.to, r.status || 404, r.impressions, r.match].map(q).join(',')).join('\n') + '\n',
      nginx: '# 301 redirects for addresses that no longer answer, found by the SEO audit on ' + d + '\n' + L.map(r => 'location = ' + r.from + ' { return 301 ' + r.to + '; }').join('\n') + '\n',
      htaccess: '# 301 redirects for addresses that no longer answer, found by the SEO audit on ' + d + '\n' + L.map(r => 'Redirect 301 ' + r.from + ' ' + r.to).join('\n') + '\n' }; };
  // leave the gone addresses out of a list (pick reads the address from an entry); returns { kept, dropped }
  const drop = (list, set, pick) => { const kept = [], dropped = []; const get = pick || ((x) => (x && typeof x === 'object') ? (x.url || x.page || x.u) : x);
    for (const x of (Array.isArray(list) ? list : [])) (set && set.has(keyOf(get(x))) ? dropped : kept).push(x); return { kept, dropped }; };
  return { isGone, keyOf, pathOf, plan, finding, action, files, drop, totals, TITLE, TITLE_UNSEEN, FIX };
})();
const pageInv = (() => { try { return $('Load Pages (AI)').all().map(i => i.json).filter(r => r && r.site_id && r.url && !r.error); } catch (e) { return []; } })();
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): a weekly run split across executions is measured ONCE, in its last execution, over every answer
// of the run — this execution's and the ones earlier executions stored (seo_ai_answers, same run_id). A site whose run continues in another
// execution is not measured here (AI Chunk Handoff states its money); with no site finishing here the node says so and the report path ends.
const allPlans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const plans = allPlans.filter(p => !p.chunk || p.chunk.final_expected);
if (!plans.length) return [{ json: { skip: true, nothing_final: true, reason: 'every site of this execution continues its run in another execution; the week is measured in the last one' } }];
let rows = []; try { rows = $('Apply Analysis').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
if (!rows.length) { try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {} }
{ const seen = new Set(rows.map(r => r.site_id + '|' + r.run_id + '|' + r.prompt_id + '|' + r.engine)); const tb = (v) => v === true || String(v) === 'true';
  let stored = []; try { stored = $('Load AI Run Answers').all().map(i => i.json).filter(r => r && r.run_id && r.engine && r.prompt_id); } catch (e) {}
  for (const r of stored) { const p0 = plans.find(p => p.site_id === r.site_id && p.run_id === r.run_id && p.chunk && p.chunk.going); if (!p0) continue;
    const k = r.site_id + '|' + r.run_id + '|' + r.prompt_id + '|' + r.engine; if (seen.has(k)) continue; seen.add(k);
    rows.push({ ...r, answered: tb(r.answered), mentioned: tb(r.mentioned), cited: tb(r.cited), rank: Number(r.rank) || 0, cost: Number(r.cost) || 0, _stored: true }); } }
let reqs = [], resps = []; try { reqs = $('AI Requests').all().map(i => i.json); resps = $('Run AI Requests').all().map(i => i.json || {}); } catch (e) {}
try { const mg = $('Merge AI Answers').all().map(i => i.json || {}); if (mg.length === resps.length) resps = mg; } catch (e) {}   // D19: with the retry gate the merged answers replace the first, failed ones (same order)
let prospects = []; try { prospects = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
let treq = [], tres = []; try { treq = $('Traffic Requests').all().map(i => i.json).filter(q => !q.skip); tres = $('GA4 AI Report').all().map(i => i.json || {}); } catch (e) {}
let access = []; try { access = $('AI Access').all().map(i => i.json).filter(a => a && a.site_id); } catch (e) {}
let ajobs = [], aouts = []; try { ajobs = $('Analyst Jobs').all().map(i => i.json).filter(j => !j.skip); aouts = $('Answer Analyst').all().map(i => i.json || {}); } catch (e) {}
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery Answers').all().map(i => i.json || {}); } catch (e) {}
let freshP = []; try { freshP = $('Prompt Rows').all().map(i => i.json).filter(r => !r.skip && r.prompt_id); } catch (e) {}   // questions written or updated this run (stage, cluster, volume)
const GENERIC_SOCIAL = /(^|\.)(youtube\.com|linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|quora\.com|wikipedia\.org|medium\.com)$/i;
const MEDIA = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|thenational|arabnews|timesofindia|dawn)\.[a-z.]+$/i;
const DIRECTORY = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|[a-z-]*yellowpages[a-z-]*|[a-z-]*directory[a-z-]*)\.[a-z.]+$/i;
const AUTHORITY = /(^|\.)(deloitte|pwc|kpmg|ey|gartner|forrester|mckinsey|accenture|statista|bcg|bain|idc)\.[a-z.]+$/i;
const GOV = /\.gov(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$|(^|\.)(difc|adgm|dmcc|dafz|jafza|rakez|dso|dubaichamber|abudhabichamber)\.(com|ae|org)$/i;   // RV-14: the UAE free-zone authorities are official bodies, not rivals
// RV-14 (2026-10-21): a search engine is where AI looked, never a place to "get featured on" (the report said "Get featured on google.com")
const ENGINE = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|ask)\.[a-z.]+$/i;
const kindOf = (d) => ENGINE.test(d) ? 'engine' : GOV.test(d) ? 'official' : GENERIC_SOCIAL.test(d) ? 'platform' : MEDIA.test(d) ? 'media' : DIRECTORY.test(d) ? 'directory' : AUTHORITY.test(d) ? 'authority' : 'site';
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const ENG = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', ai_overview: 'Google AI Overview', ai_mode: 'Google AI Mode', copilot: 'Copilot', chatgpt_api: 'ChatGPT API', gemini_api: 'Gemini API' };   // G6: + the model APIs (opt-in)
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const list = (s) => String(s || '').split(/,\s*/).filter(Boolean);
const task0 = (r) => ((r || {}).tasks || [])[0] || {};
// B-A10 (2026-10-15, INVARIANTS rule 3 + R28): a discovery answer's own money across BOTH attempts. The in-200 gate puts it on
// the item, because the merged item is the retry's and a first attempt that was billed and then replaced would vanish from the bill.
const dCost = (r) => { const v = Number((r || {}).__dfs_cost_usd); return Number.isFinite(v) ? v : (Number(task0(r).cost) || 0); };
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || e.message || e.status || JSON.stringify(e)).slice(0, 200); };
const assistantOf = (src) => { const s = String(src || '').toLowerCase(); return /chatgpt|openai/.test(s) ? 'ChatGPT' : /perplexity/.test(s) ? 'Perplexity' : /gemini|bard/.test(s) ? 'Gemini' : /copilot|edgeservices\.bing/.test(s) ? 'Copilot' : /claude|anthropic/.test(s) ? 'Claude' : /deepseek/.test(s) ? 'DeepSeek' : /grok/.test(s) ? 'Grok' : /meta\.ai/.test(s) ? 'Meta AI' : /mistral/.test(s) ? 'Mistral' : (s || 'Other AI'); };
const weekOf = (d) => { const t = new Date(d + 'T00:00:00Z'); const wd = (t.getUTCDay() + 6) % 7; return new Date(t.getTime() - wd * 864e5).toISOString().slice(0, 10); };
return plans.map(p => {
  const Rall = rows.filter(r => r.site_id === p.site_id);
  // the brand question ("what is <brand>?") only measures recognition: rates, share of voice and competitors use the buyer questions
  const RB = Rall.filter(r => r.kind === 'brand'), R = Rall.filter(r => r.kind !== 'brand');
  // headline figures use the weekly engines (Claude, monthly, appears per engine) plus the AI Pulse samples of the past days on the fast engines
  const MONTHLY = p.monthly_engines || [];
  const RC = R.filter(r => !MONTHLY.includes(r.engine));
  const ans = RC.filter(r => r.answered); const ansAll = Rall.filter(r => r.answered);
  // D19 (2026-10-11): every rate below counts answered requests only — 7 of 42 requests of exec 362 / 363 failed (DataForSEO
  // "Internal SE Server Error" inside an HTTP 200 x5, ChatGPT "no response" x2) and the report said nothing about them. The
  // failures are now named per engine with their message (the retry gate has already re-sent each of them once).
  const errorRows = Rall.filter(r => r.error);
  const errors = errorRows.length;
  const errMap = new Map();
  for (const r of errorRows) { const k = r.engine + '|' + String(r.error).slice(0, 80); const x = errMap.get(k) || { engine: ENG[r.engine] || r.engine, message: String(r.error).slice(0, 160), count: 0 }; x.count++; errMap.set(k, x); }
  const error_list = [...errMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const retry = (() => { try { const m = $('Merge AI Answers').first().json || {}; return { asked: Number(m.retry_asked) || 0, answered: Number(m.retry_answered) || 0 }; } catch (e) { return { asked: 0, answered: 0 }; } })();
  const error_rate = pct(errors, Rall.length);
  // F1b (2026-10-23, E6 / E7 / E14): a pulse morning joins the week only when it was counted under THIS rule and carries its per-answer
  // record (detail_json: named, cited, place, the competitors named). Every figure below - the headline, each engine, each segment, each
  // competitor - is then computed from ONE list of answers (`U`), so the headline share of voice is exactly what its segments add up to.
  // A morning counted under an earlier rule is left out and named (pulse_basis); AI Plan has already bounded the mornings to this run's window.
  const PRall = p.pulse_rows || [];
  const PR = PRall.filter(d => String(d.rule_version || '') === AVM.RULE_VERSION && d.detail && Array.isArray(d.detail.a));
  const pulseOld = PRall.filter(d => !PR.includes(d));
  const pulseN = PR.reduce((s, d) => s + d.detail.a.length, 0);
  // ---- B8-3 (2026-10-15, benchmark area 8, INVARIANTS rule 1): the week's headline pools the daily pulse answers straight into
  // `samples` and `mentioned`, and a pulse morning on which one engine returned nothing contributes a DIFFERENT mix of engines.
  // The engines do not agree with each other — exec 526 (2026-10-13) measured ChatGPT and Google AI Mode at different citation
  // rates on the same panel — so a broken morning quietly reweights the week, and nothing said how many of the counted answers
  // came from one. The days are still pooled (throwing them away loses real answers); what changes is that the report can say so.
  const pulseSets = PR.map(d => ({ date: d.date, samples: Number(d.samples) || 0,
    engines: Object.entries(d.engines || {}).filter(([, v]) => (Number((v || {}).answered) || 0) > 0).map(([e]) => e).sort(),
    missing: Object.entries(d.engines || {}).filter(([, v]) => (Number((v || {}).asked) || 0) > 0 && !(Number((v || {}).answered) || 0)).map(([e]) => ENG[e] || e) }));
  const fullSet = pulseSets.reduce((best, d) => d.engines.length > best.length ? d.engines : best, []);
  const partialDays = pulseSets.filter(d => d.engines.join('+') !== fullSet.join('+'));
  const partialAnswers = partialDays.reduce((s, d) => s + d.samples, 0);
  // A5 / R95 (2026-10-16): `seo_ai_daily` holds a scheduled AND an on-demand reading for one date, so PR counts READINGS. The days
  // are the distinct dates; the note says both when they differ.
  const pulseDates = [...new Set(PR.map(d => String(d.date || '').slice(0, 10)).filter(Boolean))];
  const pulseDays = pulseDates.length || PR.length;
  const pulse_left_out = pulseOld.length ? { readings: pulseOld.length, answers: pulseOld.reduce((s, d) => s + (Number(d.samples) || 0), 0), dates: [...new Set(pulseOld.map(d => String(d.date || '').slice(0, 10)))].sort(),
    note: pulseOld.length + ' daily pulse reading(s) were counted under an earlier measurement rule (or without their per-answer record) and are left out of this week\'s figures.' } : null;
  const pulse_basis = PR.length ? { days: pulseDays, readings: PR.length, answers: pulseN, engines: fullSet.map(e => ENG[e] || e), basis: 'measured', left_out: pulse_left_out,
    partial_days: partialDays.map(d => ({ date: d.date, answers: d.samples, engines: d.engines.map(e => ENG[e] || e), missing: d.missing })), partial_answers: partialAnswers,
    note: (PR.length === pulseDays ? pulseDays + ' daily pulse day(s) are' : PR.length + ' daily pulse readings on ' + pulseDays + ' day(s) are') + ' counted in the figures below (' + pulseN + ' of the ' + (ans.length + pulseN) + ' answers)'
      + (partialDays.length ? ', and ' + partialDays.length + ' of them did not reach every engine (' + partialAnswers + ' answer(s) from '
        + partialDays.map(d => d.date + (d.missing.length ? ': no answer from ' + d.missing.join(', ') : ': ' + (d.engines.length || 'no') + ' engine(s) only')).join('; ') + ')' : '') + '.' + (pulse_left_out ? ' ' + pulse_left_out.note : '') }
    : pulse_left_out ? { days: 0, readings: 0, answers: 0, engines: [], basis: 'not_available', left_out: pulse_left_out, partial_days: [], partial_answers: 0, note: pulse_left_out.note } : null;
  // B8-5: *AI Requests* stops adding requests at 900 / $15 ($4 on the pulse) and records what it dropped in `skipped_by_cap` — which
  // nothing has ever read. A capped run asks fewer engines of fewer questions, every rate below is measured on what was left, and the
  // panel simply looked shorter. Named here, printed in the report (INVARIANTS rule 1).
  const capped = (() => { const s0 = ((reqs[0] || {}).skipped_by_cap || (reqs[0] || {}).skipped || []).filter(x => String(x).indexOf(p.domain + ':') === 0);
    if (!s0.length) return null; const byE = new Map(); for (const x of s0) { const e = String(x).split(':')[1] || ''; byE.set(e, (byE.get(e) || 0) + 1); }
    return { requests: s0.length, engines: [...byE.entries()].map(([e, k]) => ({ engine: ENG[e] || e, requests: k })), basis: 'not_available',
      note: s0.length + ' request(s) were not sent: this run reached its request or cost limit, so '
        + [...byE.entries()].map(([e, k]) => k + ' × ' + (ENG[e] || e)).join(', ') + ' were left unasked. Every rate below is measured on the answers that were asked for.' }; })();
  const meta = new Map([...p.prompts, ...freshP.filter(r => r.site_id === p.site_id)].map(q => [q.prompt_id, q]));
  const volOf = new Map([...meta.values()].map(q => [q.prompt_id, Number(q.volume) || 0]));
  // RV-14 (2026-10-21): a site whose cited pages are ranking lists ("Best AI Consultants for Small Businesses in Dubai (2026)", abcmoney.co.uk)
  // publishes lists of providers, it is not one: it is never counted as a business AI recommends instead of you
  const LIST_TITLE = /^\s*(the\s+)?(\d+\s+)?(best|top)\b|\btop\s+\d+\b|\b\d+\s+best\b|\branking/i;
  const listSites = (() => { const by = new Map(); const hostU = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
    for (const r of ansAll) { let cu = []; try { cu = JSON.parse(r.cited_urls || '[]'); } catch (e) {} for (const c of (Array.isArray(cu) ? cu : [])) { const h = hostU(c && c.u); if (!h || !c.t) continue;
      const x = by.get(h) || { list: 0, other: 0 }; if (LIST_TITLE.test(String(c.t))) x.list++; else x.other++; by.set(h, x); } }
    return new Set([...by.entries()].filter(([, x]) => x.list > 0 && x.other === 0).map(([h]) => h)); })();
  const notList = (d) => !listSites.has(String(d || '').toLowerCase().replace(/^www\./, '')) || (p.configured_competitors || []).includes(d);
  // ---- F1b (2026-10-23): the week's answers, ONE unit each: this run's answers (every engine; the headline leaves the monthly ones out) and
  // the pooled pulse answers, each with the business's reading (named / cited / place) and the competitors it named, one key per business
  // ("ClearTax" and cleartax.com are one). The headline, every engine, every segment and every competitor are measured from these units.
  const pulseRaw = []; for (const d of PR) { const D = d.detail; const ents = Array.isArray(D.ents) ? D.ents : [];
    for (const a of D.a) { if (!Array.isArray(a)) continue; const q0 = meta.get(String(a[0])); if (q0 && q0.kind === 'brand') continue;
      pulseRaw.push({ prompt_id: String(a[0]), engine: String(a[1]), date: d.date, run_id: d.run_id || '', pulse: true, answered: true, named: !!a[2], cited: !!a[3], position: Number(a[4]) > 0 ? Number(a[4]) : null,
        rivals: Array.isArray(a[5]) ? a[5].map(x => ({ id: String(ents[(x || [])[0]] || ''), position: Number((x || [])[1]) > 0 ? Number(x[1]) : null, cited: !!(x || [])[2] })).filter(x => x.id && notList(x.id)) : null }); } }
  const weekRaw = R.filter(r => AVM.tb(r.answered)).map(r => ({ prompt_id: r.prompt_id, engine: r.engine, topic: r.topic, pulse: false, answered: true, named: AVM.named(r), cited: AVM.tb(r.cited), position: AVM.position(r), rivals: AVM.rivals(r, { keep: notList }) }));
  const rivDoms = [...new Set([...(p.configured_competitors || []), ...[...weekRaw, ...pulseRaw].flatMap(u => (u.rivals || []).map(x => x.id))].filter(k => /\./.test(String(k))).map(k => String(k).toLowerCase()))];
  // F1b + F1a (2026-10-23): two ids met in separate answers that are one business (cleartax.com / cleartax.in, a subdomain) are counted
  // as one; the configured competitors are the keys they fold into first
  const reps = [...new Set((p.configured_competitors || []).map(x => String(x).toLowerCase()))]; const repOf = new Map();
  const oneKey = (k) => { if (repOf.has(k)) return repOf.get(k); const r = reps.find(x => x === k || AIE.sameEntity(x, k)) || k; if (r === k && !reps.includes(k)) reps.push(k); repOf.set(k, r); return r; };
  const canon = (u) => { if (!u.rivals) return u; const m0 = new Map();
    for (const x of u.rivals) { const k0 = brandKey(x.id, rivDoms, p.aliases); const k = k0 ? oneKey(k0) : k0; if (!k) continue; const y = m0.get(k); if (!y) m0.set(k, { id: k, position: x.position, cited: x.cited }); else { if (x.position && (!y.position || x.position < y.position)) y.position = x.position; y.cited = y.cited || x.cited; } }
    return { ...u, rivals: [...m0.values()] }; };
  const unitsAll = [...weekRaw, ...pulseRaw].map(canon);
  const U = unitsAll.filter(u => u.pulse || !MONTHLY.includes(u.engine));   // the headline's answers: buyer questions on the weekly engines + the pulse
  const H = AVM.agg(U);
  const mentioned = H.named, cited = H.cited, samples = H.n;
  // competitors: configured ones always; plus businesses AI names in at least 2 answers (domains, or brand names without a known website)
  const counts = new Map(); for (const u of U) for (const x of (u.rivals || [])) counts.set(x.id, (counts.get(x.id) || 0) + 1);
  const comp = [...new Set([...p.configured_competitors, ...[...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([d]) => d)])].slice(0, 8)
    .map(d => ({ domain: d, mentions: counts.get(d) || 0, auto: !p.configured_competitors.includes(d), named_only: !/\./.test(d) }));
  // ---- R83 (2026-10-16, re-rating defect C-7): the businesses AI recommends INSTEAD of you are never a place to "get featured".
  // `comp` above is the 8-row display table ("Who AI recommends instead"); exec 623 kept cleartax … sap there, and wafeq.com — named
  // as an alternative in 10 answers, outside the cut — came out as "Get featured on wafeq.com" and as an `ai_source` link prospect,
  // with edicomgroup.com, aiverix.ae, comarch.com, pagero.com, flick.network and velmontcrest.ae. The EXCLUSION set is not the display
  // set: every configured competitor, every business named in two or more answers (this run and the pulse), and every business the
  // Answer Analyst has learned a website for (the `ai_brands:` aliases, this run's included) — compared by registrable domain, so
  // europe.thomsonreuters.com is Thomson Reuters. Only a plain business site can be a rival: an official body, a platform, a news
  // site, a directory or a research firm keeps its own kind (mof.gov.ae stays "official").
  const regD = (h) => { const x = normD(h); const parts = x.split('.').filter(Boolean); if (parts.length <= 2) return x;
    const sl = parts.slice(-2).join('.'); return /^(co|com|org|net|gov|ac|edu|ltd|plc|sch|nic|mil)\.[a-z]{2}$/.test(sl) ? parts.slice(-3).join('.') : sl; };
  const learned = {}; ajobs.forEach((j, i) => { if (j.site_id !== p.site_id) return; const o = aouts[i] && !aouts[i].error ? parseJ(aouts[i].output) : null; for (const a of ((o && o.answers) || [])) for (const b of ((a && a.brands) || [])) { if (/^(platform|source)$/i.test(String((b && b.role) || '').trim())) continue; const nm = String((b && b.name) || '').trim(), d = normD(b && b.domain); if (nm.length >= 3 && nm.length <= 60 && brandish(nm) && /\./.test(d) && d !== p.domain && !d.endsWith('.' + p.domain) && !p.brand_names.some(x => String(x).toLowerCase() === nm.toLowerCase())) learned[nm] = d; } });   // D19: only a name that reads like a business name is learned
  const ownReg = regD(p.domain); const rivalSet = new Set();
  const addRival = (d) => { const x = regD(d); if (x && /\./.test(x) && x !== ownReg && kindOf(x) === 'site') rivalSet.add(x); };
  for (const d of (p.configured_competitors || [])) addRival(d);
  for (const [d, n] of counts.entries()) if (n >= 2) addRival(d);
  for (const d of [...Object.values(p.aliases || {}), ...Object.values(learned)]) addRival(d);
  const isRival = (h) => rivalSet.has(regD(h));
  // E6 / E19 (F1b): ONE share of voice - your mentions out of yours plus EVERY competitor named, over the answers whose competitors were
  // recorded - for the headline, each engine, each segment and each competitor; its range is taken over answers, not mentions
  const compTotal = H.sov_mentions - H.sov_self;
  const share_of_voice = H.sov == null ? 0 : H.sov;
  comp.forEach(c => { const s0 = AVM.rivalAgg(U, c.domain); c.share = s0.sov == null ? 0 : s0.sov; c.named_rate = s0.named_rate; c.cited_rate = s0.cited_rate; c.avg_position = s0.avg_position; c.position_answers = s0.position_n;
    c.sov = s0.sov; c.sov_answers = s0.sov_n; c.answers = s0.n; Object.defineProperty(c, '_st', { value: s0, enumerable: false }); });
  // per engine (this run + pulse samples)
  const engines = {};
  const carriedE = (p.carried && p.carried.engines) || {};
  for (const e of p.engines) { const er = R.filter(r => r.engine === e), ea = er.filter(r => AVM.tb(r.answered)); const eb = RB.filter(r => r.engine === e && AVM.tb(r.answered));
    const eu = unitsAll.filter(u => u.engine === e); const pn = eu.filter(u => u.pulse).length;
    if (!er.length && !pn && carriedE[e] && Number(carriedE[e].asked) > 0) { engines[e] = { ...carriedE[e], name: ENG[e] || e, carried: true, checked_at: carriedE[e].checked_at || p.carried.checked_at }; continue; }   // not asked this week: last full run
    const g = AVM.agg(eu); const n = g.n, m = g.named, c = g.cited;   // F1b: `mentioned` counts NAMED answers (rule_version)
    engines[e] = { name: ENG[e] || e, asked: er.length, answered: ea.length, samples: n, mentioned: m, cited: c, mention_rate: pct(m, n), citation_rate: pct(c, n), ci: wilson(m, n), errors: Rall.filter(r => r.engine === e && r.error).length,
      knows_brand: eb.length ? eb.some(r => AVM.named(r)) : null, pulse_samples: pn, sentiment: (() => { const s = ea.filter(r => r.sentiment); return s.length ? Math.round(100 * (s.filter(r => r.sentiment === 'positive').length - s.filter(r => r.sentiment === 'negative').length) / s.length) : null; })(),
      // F1b: the place in the answers on this engine, with its sample ("too few answers" under the floor: no figure)
      named_rate: g.named_rate, avg_position: g.position_enough ? g.avg_position : null, position_answers: g.position_n, first_rate: g.enough ? g.first_rate : null, pos_visibility: g.enough ? g.pos_visibility : null,
      sov: g.sov, sov_answers: g.sov_n, enough: g.enough }; }
  // F1b: the competitor table per engine - the same figures over that engine's answers
  for (const c of comp) { c.engines = {}; for (const e of Object.keys(engines)) { if (engines[e].carried) continue; const eu = unitsAll.filter(u => u.engine === e); if (!eu.length) continue; const s0 = AVM.rivalAgg(eu, c.domain);
    c.engines[e] = { answers: s0.n, named_rate: s0.named_rate, cited_rate: s0.cited_rate, avg_position: s0.avg_position, position_answers: s0.position_n, sov: s0.sov, sov_answers: s0.sov_n }; } }
  const aio = R.filter(r => r.engine === 'ai_overview');
  // R84 (2026-10-16): a request that FAILED did not show whether Google shows an AI Overview, so it is not in the presence denominator
  // (exec 623: 5 shown, 1 with none, 1 failed = 5 of 6, 83.3%, not 5 of 7). The failure is still named in the failure line.
  const aioRead = aio.filter(r => !r.error);
  const aio_basis = { requests: aio.length, read: aioRead.length, shown: aio.filter(r => r.answered).length, failed: aio.length - aioRead.length };
  const aio_presence = pct(aio_basis.shown, aioRead.length), aio_citation_rate = pct(aio.filter(r => r.cited).length, aio.filter(r => r.answered).length);
  // sources AI cites (not you, not a competitor): where to get listed / featured
  const src = new Map();
  const citedOf = (r) => { try { const v = JSON.parse(r.cited_urls || '[]'); return Array.isArray(v) ? v.filter(x => x && x.u) : []; } catch (e) { return []; } };   // v4.12: the exact pages cited
  const hostOfU = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const rivalSrc = new Map(); const asRival = (h, n) => { const k = regD(h); rivalSrc.set(k, (rivalSrc.get(k) || 0) + n); };   // R83: cited, but a business AI names instead of you
  for (const r of ansAll) for (const h of list(r.sources)) { if (h === p.domain || h.endsWith('.' + p.domain)) continue; if (comp.some(c => c.domain === h) || isRival(h)) { asRival(h, 1); continue; } const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set(), urls: new Map() }; s.citations++; s.engines.add(ENG[r.engine] || r.engine); if (r.topic) s.topics.add(r.topic);
    for (const c of citedOf(r)) if (hostOfU(c.u) === h) { const x = s.urls.get(c.u) || { u: c.u, t: c.t || '', n: 0 }; x.n++; if (!x.t && c.t) x.t = c.t; s.urls.set(c.u, x); } src.set(h, s); }
  for (const d of PR) for (const [h, n] of Object.entries(d.sources || {})) { if (h === p.domain || h.endsWith('.' + p.domain)) continue; if (comp.some(c => c.domain === h) || isRival(h)) { asRival(h, Number(n) || 0); continue; } const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set(), urls: new Map() }; s.citations += Number(n) || 0; s.engines.add('daily'); src.set(h, s); }
  // C-2 (re-rating 2026-10-17): a cited site that SELLS your category is a rival too, whatever AI said about it - erp-dubai.ae ("ERPNext
  // Implementation Partner in UAE & Dubai") and penieltech.com (/blog/odoo-implementation-umm-al-quwain) were labelled "site (PR target)" and
  // written as ai_source prospects. Judged by the one rule the Link Builder and AI Growth use (RV.providerOf): its cited page's title or address.
  const vendorWhy = new Map();
  for (const s of [...src.values()]) { if (kindOf(s.domain) !== 'site') continue; let why = '';
    for (const x of s.urls.values()) { why = RV.providerOf({ domain: s.domain, title: x.t, url: x.u, topics: p.topics || [], services: p.services || [] }); if (why) break; }
    if (why) { vendorWhy.set(regD(s.domain), why); asRival(s.domain, s.citations); src.delete(s.domain); } }
  const rival_sources = [...rivalSrc.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, citations]) => vendorWhy.has(domain) ? { domain, citations, kind: 'vendor', why: vendorWhy.get(domain) } : { domain, citations, kind: 'rival' });
  // what is STORED is the whole set (rival_sources_json): the cited rivals above, every other vendor, and every business AI named (aliases, two or
  // more answers, configured), so AI Growth, the Backlink Monitor and the Link Builder read the same rivals this run saw - not its top ten
  const rival_store = [...rival_sources, ...[...vendorWhy.entries()].filter(([d]) => !rival_sources.some(r => r.domain === d)).map(([domain, why]) => ({ domain, citations: rivalSrc.get(domain) || 0, kind: 'vendor', why })),
    ...[...rivalSet].filter(d => !rival_sources.some(r => r.domain === d) && !vendorWhy.has(d)).map(domain => ({ domain, citations: 0, kind: 'named' }))].slice(0, 120);
  const sources = [...src.values()].sort((a, b) => b.citations - a.citations).slice(0, 15).map(s => ({ domain: s.domain, citations: s.citations, engines: [...s.engines].filter(x => x !== 'daily'), topics: [...s.topics].slice(0, 3), kind: kindOf(s.domain), urls: [...s.urls.values()].sort((a, b) => b.n - a.n).slice(0, 3) }));
  const pages = new Map(); for (const r of ansAll) for (const u of String(r.our_urls || '').split(/\s+/).filter(Boolean)) { const x = pages.get(u) || { url: u, citations: 0, engines: new Set() }; x.citations++; x.engines.add(r.engine); pages.set(u, x); }
  const invMine = pageInv.filter(r => r.site_id === p.site_id);
  const goneKeys = new Set(invMine.filter(r => GONE.isGone(r.http_status)).map(r => GONE.keyOf(r.url)));
  const statusOf = new Map(invMine.filter(r => Number(r.http_status) > 0).map(r => [GONE.keyOf(r.url), Number(r.http_status)]));
  const our_pages = [...pages.values()].sort((a, b) => b.citations - a.citations).slice(0, 10).map(x => ({ url: x.url, citations: x.citations, engines: [...x.engines],
    ...(goneKeys.has(GONE.keyOf(x.url)) ? { gone: true, http_status: statusOf.get(GONE.keyOf(x.url)) || 404 } : {}) }));
  // RV-1: the cited addresses that no longer answer, and the page each should redirect to (the live pages of the inventory are the candidates)
  const goneCited = [...pages.values()].filter(x => goneKeys.has(GONE.keyOf(x.url)));
  const gone_cited = GONE.plan(goneCited.map(x => ({ url: x.url, status: statusOf.get(GONE.keyOf(x.url)) || 404, impressions: Number((invMine.find(r => GONE.keyOf(r.url) === GONE.keyOf(x.url)) || {}).impressions) || 0 })),
    invMine.filter(r => !GONE.isGone(r.http_status) && (r.source === 'sitemap' || (Number(r.http_status) >= 200 && Number(r.http_status) < 300))), (invMine.find(r => GONE.pathOf(r.url) === '/') || {}).url || '')
    .map(r => ({ ...r, citations: (goneCited.find(x => GONE.keyOf(x.url) === GONE.keyOf(r.from_url)) || {}).citations || 0 }));
  // per question: who wins this run, and how often the business was named over the week's samples (win rate)
  const byQ = new Map();
  for (const r of Rall) { const q = byQ.get(r.prompt_id) || { prompt: r.prompt, kind: r.kind, topic: r.topic, engines: {}, competitors: new Set(), sources: new Set(), fanout: new Set(), urls: new Map(), n: 0, m: 0 }; const nm = AVM.named(r); q.engines[r.engine] = !AVM.tb(r.answered) ? (r.error ? 'error' : 'none') : AVM.tb(r.cited) ? 'cited' : nm ? 'mentioned' : 'absent';
    if (AVM.tb(r.answered)) { q.n++; if (nm) { q.m++; q.named_run = true; } list(r.competitors).filter(notList).forEach(d => q.competitors.add(d)); list(r.sources).forEach(d => q.sources.add(d)); String(r.fanout || '').split(' | ').filter(Boolean).forEach(f => q.fanout.add(f));
      for (const c of citedOf(r)) { const x = q.urls.get(c.u) || { u: c.u, t: c.t || '', n: 0, engines: new Set() }; x.n++; x.engines.add(r.engine); if (!x.t && c.t) x.t = c.t; q.urls.set(c.u, x); } } byQ.set(r.prompt_id, q); }
  for (const u of unitsAll) { if (!u.pulse) continue; const q = byQ.get(u.prompt_id); if (!q) continue; q.n++; if (u.named) q.m++; }   // F1b: the pulse answers by their own reading (named, not "named or cited")
  for (const e of p.engines) if (MONTHLY.includes(e) && !Rall.some(r => r.engine === e)) for (const q0 of byQ.values()) if (!(e in q0.engines)) q0.engines[e] = 'monthly';   // asked on the month's full run
  const questions = [...byQ.entries()].map(([id, q]) => { const m0 = meta.get(id) || {}; return { prompt_id: id, prompt: q.prompt, kind: q.kind, topic: q.topic, stage: m0.stage || '', cluster: m0.cluster || q.topic || '', volume: m0.volume == null ? null : Number(m0.volume), engines: q.engines,
    won: !!q.named_run, win_rate: q.n ? pct(q.m, q.n) : 0, samples: q.n, competitors: [...q.competitors].slice(0, 6), sources: [...q.sources].filter(h => h !== p.domain).slice(0, 5), fanout: [...q.fanout].slice(0, 6),
    // B8-4 (2026-10-15, benchmark area 8, INVARIANTS rule 1): a per-question rate off one or two answers is not a rate. With an
    // 8-question panel on the weekly engines a question can carry a single answer, and "0%" read exactly like a question the
    // business reliably loses — which is what then picked the top actions and the ready-to-send API bodies below.
    win: rateOf(q.m, q.n, { min: MIN_Q_SAMPLES }), decided: q.n >= MIN_Q_SAMPLES,
    cited_urls: [...q.urls.values()].sort((a, b) => b.n - a.n).slice(0, 6).map(x => ({ u: x.u, t: x.t, n: x.n, engines: [...x.engines] })) }; });
  // B8-4: a gap is a question we have enough answers to say we lose. The rest are named as undecided, with what they would need.
  const lostQ = questions.filter(q => !q.won && q.kind !== 'brand' && q.competitors.length).sort((a, b) => (Number(b.volume) || 0) - (Number(a.volume) || 0));
  const gaps = lostQ.filter(q => q.decided).slice(0, 8);
  const undecided = lostQ.filter(q => !q.decided).slice(0, 8).map(q => ({ prompt_id: q.prompt_id, prompt: q.prompt, samples: q.samples, volume: q.volume, competitors: q.competitors, why: q.win.why }));
  // buyer stages and topic clusters: where the business is visible and where it is not
  const group = (key) => { const g = new Map(); for (const q of questions.filter(x => x.kind !== 'brand')) { const k = String(q[key] || 'other').toLowerCase(); const x = g.get(k) || { key: k, questions: 0, volume: 0, n: 0, m: 0, rivals: new Map() }; x.questions++; x.volume += Number(q.volume) || 0; x.n += q.samples; x.m += Math.round(q.win_rate * q.samples / 100); q.competitors.forEach(c => x.rivals.set(c, (x.rivals.get(c) || 0) + 1)); g.set(k, x); }
    return [...g.values()].map(x => ({ key: x.key, questions: x.questions, volume: x.volume, samples: x.n, mention_rate: pct(x.m, x.n), leader: [...x.rivals.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d)[0] || '' })).sort((a, b) => b.volume - a.volume || b.questions - a.questions); };
  const clusters = { stages: group('stage'), clusters: group('cluster').slice(0, 12) };
  // ---- G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): rates per engine x topic cluster x buyer role x market x funnel stage ------------
  // Every segment counts this run's answers on the weekly engines (the headline's base: no brand question, no monthly engine) plus the
  // daily pulse's answers of its questions, with its 95% Wilson range, and says "too few answers" under MIN_RATE_SAMPLES. Share of voice
  // per segment is yours out of yours plus the businesses AI named instead, in the same answers (the weekly answers: the pulse stores
  // site-level competitor counts only). A segment's change is tested only against a comparable earlier panel, and the whole family of
  // segment tests is corrected together with Benjamini-Hochberg (_ai_stats.js bh: why not Holm is written there).
  const SEG_DIMS = { engine: (q, e) => e, cluster: (q) => String(q.cluster || q.topic || 'other').toLowerCase(), persona: (q) => String(q.persona || '').trim() || 'any buyer',
    market: (q) => q.market || p.own_market || '', stage: (q) => q.stage || 'other' };
  const SEG_CROSS = [['cluster', 'persona'], ['engine', 'cluster'], ['market', 'cluster']];
  // E6 (F1b, 2026-10-23): a segment is measured from the SAME units as the headline (this run's answers on the weekly engines and the pooled
  // pulse answers, each with its own competitors), so every segment's share of voice uses the headline's definition and, for any one
  // dimension, the segments add back to the headline exactly (sov_self and sov_mentions are stored so a reader can check it). The pulse used
  // to add its mentions to a segment's numerator and nothing to its denominator: 76.5% per segment against 44.8% headline on the same data.
  const segAcc = new Map();
  const segBump = (dim, key, u) => { const id = dim + '|' + key; const s = segAcc.get(id) || { dim, key, units: [], q: new Set() }; s.units.push(u); s.q.add(u.prompt_id); segAcc.set(id, s); };
  const segKeys = (q, e) => { const v = {}; for (const [d, f] of Object.entries(SEG_DIMS)) v[d] = f(q, e);
    return [...Object.keys(SEG_DIMS).map(d => [d, v[d]]), ...SEG_CROSS.map(([a, b]) => [a + ' x ' + b, v[a] + ' · ' + v[b]])]; };
  for (const u of U) { const m0 = meta.get(u.prompt_id) || {}; const q = { ...m0, topic: u.topic || m0.topic || '' };
    for (const [d, key] of segKeys(q, u.engine)) segBump(d, key, u); }
  const SOV_BASIS = 'your mentions out of yours plus every competitor named, in the same answers as the headline (this run on the weekly engines + the pooled pulse answers)';
  const segRows = [...segAcc.values()].map(s => { const g = AVM.agg(s.units); const r0 = rateOf(g.named, g.n);
    const lc = new Map(); for (const u of s.units) for (const x of (u.rivals || [])) lc.set(x.id, (lc.get(x.id) || 0) + 1);
    const leader = [...lc.entries()].sort((a, b) => b[1] - a[1])[0];
    return { dim: s.dim, key: s.key, questions: s.q.size, n: g.n, k: g.named, cited: g.cited, pulse_n: s.units.filter(u => u.pulse).length, rate: r0.rate, ci: r0.ci, enough: r0.enough, why: r0.why,
      sov: g.sov, sov_answers: g.sov_n, sov_self: g.sov_self, sov_mentions: g.sov_mentions, sov_basis: SOV_BASIS, leader: leader ? leader[0] : '',
      // the place in the answers, with "too few answers" (null) under the floor: the mean place needs 12 placed answers, the rates 12 answers
      avg_position: g.position_enough ? g.avg_position : null, position_answers: g.position_n, first_rate: g.enough ? g.first_rate : null, pos_visibility: g.enough ? g.pos_visibility : null }; });
  // demand: AI searches a month behind the panel, and the estimated share of them that name the business (volume x win rate; an estimate)
  const demand = questions.filter(q => q.kind !== 'brand' && q.volume != null);
  const demand_total = demand.reduce((s, q) => s + (Number(q.volume) || 0), 0), ai_impressions = Math.round(demand.reduce((s, q) => s + (Number(q.volume) || 0) * q.win_rate / 100, 0));
  const lost_demand = gaps.reduce((s, g) => s + (Number(g.volume) || 0), 0);
  // what AI searched to write its answers (fan-out queries): pages that answer these get read and cited
  const fan = new Map(); for (const r of ansAll) for (const f of String(r.fanout || '').split(' | ').filter(Boolean)) { const k = f.toLowerCase().trim(); const x = fan.get(k) || { query: f.trim(), count: 0, engines: new Set(), questions: new Set() }; x.count++; x.engines.add(ENG[r.engine] || r.engine); x.questions.add(r.prompt); fan.set(k, x); }
  const fanout = [...fan.values()].sort((a, b) => b.count - a.count).slice(0, 15).map(x => ({ query: x.query, count: x.count, engines: [...x.engines], questions: [...x.questions].slice(0, 2) }));
  // brand recognition (the brand question, monthly)
  const bAns = RB.filter(r => r.answered); let brand = { asked: RB.length, answered: bAns.length, known: bAns.filter(r => AVM.named(r)).length, engines: bAns.filter(r => AVM.named(r)).map(r => ENG[r.engine] || r.engine) };
  if (!RB.length && p.carried) { const kb = Object.entries(carriedE).filter(([, v]) => v && v.knows_brand != null); brand = { asked: 0, answered: kb.length, known: kb.filter(([, v]) => v.knows_brand).length, engines: kb.filter(([, v]) => v.knows_brand).map(([k]) => ENG[k] || k), carried: true, checked_at: p.carried.checked_at };
    for (const [k, v] of kb) if (engines[k] && !engines[k].carried) engines[k].knows_brand = v.knows_brand; }
  // ---- B8-10 (2026-10-17, wave 3, benchmark area 8): recognition was a 2-of-5 MAJORITY RULE over at most six engines, one answer each,
  // with no interval - and it raised "Only N of M AI assistants recognise ..." as a medium alert. It is now what it is: a count with
  // its denominator and the same 95% Wilson range every other rate carries, and no verdict. `brand_known` stays in the payload as
  // null (no verdict drawn), so nothing downstream reads a majority it was never entitled to.
  brand.ci = brand.answered ? wilson(brand.known, brand.answered) : null;
  brand.basis = brand.answered ? (brand.carried ? 'carried' : 'measured') : 'not_available';
  brand.note = !brand.answered ? 'The brand question was not answered this month, so recognition was not measured.'
    : brand.known + ' of ' + brand.answered + ' AI assistant' + (brand.answered === 1 ? '' : 's') + ' asked directly about ' + (p.business_name || p.domain) + ' named it (95% range ' + brand.ci[0] + '–' + brand.ci[1] + '%'
      + (brand.carried ? ', from the month\'s full run of ' + String(brand.checked_at || '').slice(0, 10) : '') + ').'
      + (brand.answered < MIN_RATE_SAMPLES ? ' One answer per assistant is too few to call this a rate, so no verdict is drawn from it.' : '');
  const brand_known = null;   // B8-10: no verdict (it was a majority of the assistants asked)
  // perception: sentiment of the answers that name the business, the words AI uses for it, wrong claims (Answer Analyst)
  const sRows = ansAll.filter(r => AVM.named(r) && r.sentiment);   // F1b: the answers that NAME you
  const pos = sRows.filter(r => r.sentiment === 'positive').length, neg = sRows.filter(r => r.sentiment === 'negative').length;
  const sentiment_score = sRows.length ? Math.round(100 * (pos - neg) / sRows.length) : null;
  const descriptors = new Map(); ajobs.forEach((j, i) => { if (j.site_id !== p.site_id) return; const o = aouts[i] && !aouts[i].error ? parseJ(aouts[i].output) : null; for (const d of ((o && o.descriptors) || [])) { const k = String(d || '').trim().toLowerCase(); if (k && k.length <= 60) descriptors.set(k, (descriptors.get(k) || 0) + 1); } });
  const issueMap = new Map(); for (const r of ansAll.filter(r => r.issues)) for (const it of String(r.issues).split(' | ').filter(Boolean)) { const k = it.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); const x = issueMap.get(k) || { text: it, engines: new Set(), questions: new Set() }; x.engines.add(ENG[r.engine] || r.engine); x.questions.add(r.prompt); issueMap.set(k, x); }
  const prevIssues = new Set((((p.previous || {}).perception || {}).issues || []).map(x => String(x.text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)));
  const issues = [...issueMap.entries()].map(([k, x]) => ({ text: x.text, engines: [...x.engines], questions: [...x.questions].slice(0, 2), new: !prevIssues.has(k) })).slice(0, 10);
  // G10 (2026-10-11): what AI gets wrong is only ever "none" when there was a fact sheet to check against. With fewer than two
  // checkable facts on file (Analyst Jobs sets fact_check off) the result is "not checked" — the owner has to fill the business
  // profile first — and the same when no answer reached the analyst at all.
  const myJobs = ajobs.filter(j => j.site_id === p.site_id);
  const analysed = ajobs.some((j, k) => j.site_id === p.site_id && aouts[k] && !aouts[k].error);
  const fact_check = !myJobs.length || !analysed ? 'not_checked' : myJobs.every(j => j.facts_ok === false) ? 'no_facts' : 'checked';
  const perception = { analysed: sRows.length, positive: pos, neutral: sRows.length - pos - neg, negative: neg, score: sentiment_score, descriptors: [...descriptors.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 10),
    negatives: sRows.filter(r => r.sentiment === 'negative').slice(0, 4).map(r => ({ engine: ENG[r.engine] || r.engine, prompt: r.prompt, excerpt: r.excerpt })), issues,
    fact_check, fact_check_note: fact_check === 'checked' ? '' : fact_check === 'no_facts' ? 'What AI says about you was not checked: nothing on file can judge what the answers claim — fill the business profile (city, address, phone, price range) and the next run checks every answer against it. Your country and the services read off your website are context, not facts to check a claim against.' : 'What AI says about you was not checked this run (no answer reached the analyst).' };
  // AI referral traffic (GA4): what the answers are worth
  let traffic = null; const tq = treq.map((q, i) => ({ q, r: tres[i] || {} })).filter(x => x.q.site_id === p.site_id);
  if (tq.length) { const errs = []; const R_ = {};
    for (const { q, r } of tq) { const e = gErr(r); if (e) { errs.push(q.kind + ': ' + e); continue; } const dims = (r.dimensionHeaders || []).map(h => h.name), mets = (r.metricHeaders || []).map(h => h.name);
      R_[q.kind] = (r.rows || []).map(row => { const o = {}; dims.forEach((d, j) => o[d] = ((row.dimensionValues || [])[j] || {}).value); mets.forEach((m, j) => o[m] = Number(((row.metricValues || [])[j] || {}).value) || 0); return o; }); }
    const sum = (rs) => rs.reduce((t, x) => ({ sessions: t.sessions + (x.sessions || 0), engaged: t.engaged + (x.engagedSessions || 0), key_events: t.key_events + (x.keyEvents || 0), revenue: t.revenue + (x.totalRevenue || 0), users: t.users + (x.totalUsers || 0) }), { sessions: 0, engaged: 0, key_events: 0, revenue: 0, users: 0 });
    const src0 = R_.ai_sources || [], ch = R_.channels || [];
    const curS = src0.filter(x => x.dateRange !== 'previous'), prevS = src0.filter(x => x.dateRange === 'previous');
    const byA = new Map(); for (const x of curS) { const a = assistantOf(x.sessionSource); const t = byA.get(a) || []; t.push(x); byA.set(a, t); }
    const prevByA = new Map(); for (const x of prevS) { const a = assistantOf(x.sessionSource); prevByA.set(a, (prevByA.get(a) || 0) + (x.sessions || 0)); }
    const cur = sum(curS), prev = sum(prevS);
    const chCur = ch.filter(x => x.dateRange !== 'previous'), all = sum(chCur), org = sum(chCur.filter(x => x.sessionDefaultChannelGroup === 'Organic Search'));
    const weekly = new Map(); for (const x of (R_.ai_daily || [])) { const d = String(x.date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue; const w = weekOf(d); const t = weekly.get(w) || { week: w, sessions: 0, key_events: 0, revenue: 0 }; t.sessions += x.sessions || 0; t.key_events += x.keyEvents || 0; t.revenue += x.totalRevenue || 0; weekly.set(w, t); }
    const cpaths = new Set(our_pages.map(x => String(x.url).replace(/^https?:\/\/[^\/]+/i, '').replace(/\/$/, '') || '/'));
    traffic = { period: tq[0].q.period, connected: !errs.length || !!src0.length || !!ch.length, error: errs.join('; ') || null, ...cur, prev_sessions: prev.sessions, prev_key_events: prev.key_events, prev_revenue: prev.revenue,
      change_pct: prev.sessions ? Math.round(100 * (cur.sessions - prev.sessions) / prev.sessions) : null, share_of_sessions: all.sessions ? Math.round(1000 * cur.sessions / all.sessions) / 10 : 0,
      conv_rate: cur.sessions ? Math.round(1000 * cur.key_events / cur.sessions) / 10 : 0, organic_conv_rate: org.sessions ? Math.round(1000 * org.key_events / org.sessions) / 10 : 0, organic_sessions: org.sessions, total_sessions: all.sessions,
      assistants: [...byA.entries()].map(([name, rs]) => ({ name, ...sum(rs), prev_sessions: prevByA.get(name) || 0 })).sort((a, b) => b.sessions - a.sessions),
      landing: (R_.ai_landing || []).map(x => ({ page: x.landingPage || '/', sessions: x.sessions || 0, key_events: x.keyEvents || 0, revenue: x.totalRevenue || 0, cited_by_ai: cpaths.has(String(x.landingPage || '/').replace(/\?.*$/, '').replace(/\/$/, '') || '/') })).slice(0, 15),
      weekly: [...weekly.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-12) }; }
  else if (!p.ga4_property_id) traffic = { connected: false, error: 'GA4 is not connected for this site (connect it through "Track my site"; the Site Tracker detects the property)' };
  // AI crawler access
  const acc = access.find(a => a.site_id === p.site_id) || null;
  // the AI-answer database: market view (who AI cites for the main topic), market-wide index (your share against the competitors), questions citing you
  const mine = reqs.map((q, i) => ({ q, r: resps[i] })).filter(x => x.q.site_id === p.site_id);
  let market = null; const mk = mine.find(x => x.q.engine === 'market');
  if (mk) { const t = task0(mk.r); const res = (t.result || [])[0] || null;
    const items = (res && res.items) || []; const tot = res && res.total ? (Array.isArray(res.total.platform) ? (res.total.platform[0] || {}) : res.total) : ((res && res.aggregated_metrics && res.aggregated_metrics.total) || {});
    const val = (x, k) => ((x.location || [])[0] || {})[k] || (x.total || {})[k] || x[k] || 0;
    const ls = items.map(x => ({ domain: normD(x.domain || x.key), mentions: val(x, 'mentions'), ai_search_volume: val(x, 'ai_search_volume') })).filter(x => x.domain);
    market = { keyword: p.market_keyword, checked_at: p.checked_at.slice(0, 10), total_mentions: tot.mentions || null, ai_search_volume: tot.ai_search_volume || null, top: ls.slice(0, 12), you: ls.findIndex(x => x.domain === p.domain || x.domain.endsWith('.' + p.domain)) + 1 || null, error: t.status_code && t.status_code !== 20000 ? t.status_message : null }; }
  else if (p.previous && p.previous.market) market = { ...p.previous.market, carried: true };
  let index = null;
  const ix = mine.filter(x => /^index_/.test(x.q.engine));
  if (ix.length) { index = { checked_at: p.checked_at.slice(0, 10), platforms: [], brands: [], questions: [], answers_citing_you: 0, errors: [] }; const brandMap = new Map();
    for (const { q, r } of ix) { const t = task0(r); if (t.status_code !== 20000) { index.errors.push(q.engine + ' ' + q.topic + ': ' + (t.status_message || 'no response')); continue; } const res = (t.result || [])[0] || {};
      // R14 (2026-10-13): `you` comes from a DOMAIN match only — a name-only row ("name:Tech&") is never this website, whatever the index matched it against
      if (q.engine === 'index_sov') { index.platforms.push(q.topic); for (const it of (res.items || [])) { const key = String(it.key || ''); const tot = it.total || ((it.platform || [])[0]) || {}; const b = brandMap.get(key) || { key, domain: key.startsWith('name:') ? '' : key, name: key.startsWith('name:') ? key.slice(5) : '', you: !key.startsWith('name:') && (key === p.domain || normD(key) === p.domain || normD(key).endsWith('.' + p.domain)), mentions: 0, ai_search_volume: 0 };
        b.mentions += Number(tot.mentions) || 0; b.ai_search_volume += Number(tot.ai_search_volume) || 0; brandMap.set(key, b); } }
      else { index.answers_citing_you += Number(res.total_count) || 0; for (const it of (res.items || []).slice(0, 20)) index.questions.push({ question: String(it.question || '').slice(0, 200), volume: Number(it.ai_search_volume) || 0, platform: it.platform || q.topic, model: it.model_name || '', sources: (it.sources || []).map(s => normD(s.domain)).filter(Boolean).slice(0, 5) }); } }
    const doms = [...brandMap.values()].filter(b => b.domain); const totM = doms.reduce((s, b) => s + b.mentions, 0), totV = doms.reduce((s, b) => s + b.ai_search_volume, 0);
    // R14: a row the index matched by name alone is judged before it is shown — a name shorter than the brand-token bar, or one claiming
    // orders of magnitude more answers than this run measured and than any website in the same table, is dropped with its reason; a
    // distinctive one is kept, labelled "not matched to your website" and left out of the share arithmetic (it never had a share).
    const peerMax = doms.reduce((m, b) => Math.max(m, b.mentions), 0);
    const nameDropped = [];
    const kept = [...brandMap.values()].filter(b => {
      if (b.domain) return true;
      const v = indexNameRow(b.name, b.mentions, { peer_max: peerMax, measured_mentions: mentioned });
      if (!v.ok) { nameDropped.push({ name: b.name, mentions: b.mentions, ai_search_volume: b.ai_search_volume, why: v.why }); return false; }
      b.name_only = true; b.name_note = v.why; return true;
    });
    index.brands = kept.map(b => ({ ...b, share: b.domain ? pct(b.mentions, totM) : null, volume_share: b.domain ? pct(b.ai_search_volume, totV) : null })).sort((a, b) => b.mentions - a.mentions);
    index.name_rows_dropped = nameDropped.sort((a, b) => b.mentions - a.mentions).slice(0, 5);
    const youI = index.brands.find(b => b.you) || null; index.sov = youI ? youI.share : null; index.impressions = youI ? youI.ai_search_volume : 0;
    index.name_mentions = (index.brands.find(b => b.name_only && normD(b.name) === normD(p.business_name)) || {}).mentions || 0;
    index.questions = index.questions.sort((a, b) => b.volume - a.volume).slice(0, 15); }
  else if (p.previous && p.previous.index) index = { ...p.previous.index, carried: true };
  // questions people ask AI about the topics that the panel does not track yet (discovery), and the searches AI ran (fan-out)
  const tracked = new Set(p.prompts.map(q => String(q.prompt).toLowerCase()));
  const suggestions = []; dreq.forEach((q, i) => { if (q.site_id !== p.site_id || q.kind !== 'discover') return; const t = task0(dres[i]); if (t.status_code !== 20000) return; for (const it of (((t.result || [])[0] || {}).items || [])) { const qq = String(it.question || '').trim(); if (qq.split(/\s+/).length < 3 || tracked.has(qq.toLowerCase())) continue; suggestions.push({ question: qq, volume: Number(it.ai_search_volume) || 0, platform: q.platform, you_cited: (it.sources || []).some(s => normD(s.domain) === p.domain || normD(s.domain).endsWith('.' + p.domain)) }); } });
  const sugg = [...new Map(suggestions.sort((a, b) => b.volume - a.volume).map(s => [s.question.toLowerCase(), s])).values()].slice(0, 12);
  // changes vs last week that are statistically real, alerts
  const prev = p.previous; const mention_rate = pct(mentioned, samples), citation_rate = pct(cited, samples);
  const [mention_lo, mention_hi] = wilson(mentioned, samples);
  // F1b: the score over the same units as every rate (the pulse answers scored one by one, by their own place), E7's weights
  const visibility_score = samples ? visibilityScore(U, (a) => volOf.get(a.prompt_id) || 0) : 0;
  // ---- B-L4 (2026-10-15, INVARIANTS rule 1, lineage_lint.py "like_for_like"): a delta compares like with like, or it is not a
  // delta. R19's shape on a different figure: the question panel is settable from 3 to 50, so a site that went from 8 questions
  // to 20 read as a collapse in share of voice and visibility when nothing about its visibility had moved; and a weekly check
  // asks fewer engines than the monthly full one, so the engine mix moves the same figures. Both are checked through the one
  // shared guard (RT, v5/code/_dfs_retry.js): the KIND of run first, because it explains more, then the panel the figures were
  // measured on, at R19's 20% drift. When they do not match there is no delta at all and `delta_not_compared` says why — the
  // report prints the reason where the arrows would have been, and every alert that reads a delta stays silent.
  // The KIND here is the set of engines the headline rates were counted over. It is NOT the run kind: a monthly full run asks
  // more engines than a weekly one, but `RC` above already leaves the monthly engines out of every rate for exactly that reason,
  // so weekly and full ARE comparable. What is not comparable is a changed engine list — switch Perplexity off and the rates move
  // on their own. A stored row says which engines it asked: the ones it did not are marked `carried`.
  // C-9 (re-rating 2026-10-17, exec 776): an engine that was ASKED but answered nothing counted in the set all the same — run 722's
  // Gemini had answered 0 of 7 (8 errors), so "compared with 2026-10-16 (… Gemini …)" set 54 answers on five engines against 28 on
  // four. An engine is in the set only when it was READ: it answered (samples, else answered, > 0), or some of its requests came back
  // without an error — the Google AI Overview "answers" only when Google shows one, and a week with none shown is a reading, not a
  // failure. An engine whose every request failed is out. A stored row of an older shape that records none of these fields keeps the
  // engine (unknown is not "none").
  const answeredOn = (v) => { const x = v || {}; if (x.samples == null && x.answered == null) return true;
    if ((Number(x.samples != null ? x.samples : x.answered) || 0) > 0) return true;
    const asked = Number(x.asked) || 0; return asked > 0 && (Number(x.errors) || 0) < asked; };
  const engSet = (obj) => Object.keys(obj || {}).filter(e => !MONTHLY.includes(e) && !(obj[e] || {}).carried && answeredOn(obj[e])).sort();
  const engNow = engSet(engines), engBefore = engSet(prev && prev.engines);
  const engText = (l) => l.map(e => ENG[e] || e).join(', ') || 'no engine';
  const panel = byQ.size, panel_before = prev ? Number(prev.prompts) || 0 : 0;
  const same_kind = prev ? RT.likeForLike(engNow.join('+'), engBefore.join('+'),
    { labels: { [engNow.join('+')]: engText(engNow), [engBefore.join('+')]: engText(engBefore) }, what: 'this week\'s figures and the stored ones' }) : null;
  const same_panel = prev ? RT.comparable(panel, panel_before, { unit: 'questions' }) : null;
  // G6 (2026-10-18): the same NUMBER of questions is not the same panel. With 500 questions the owner imports, edits and re-words them, and
  // the writer tops the panel up: a week whose questions are mostly new is a different measurement, whatever its size. The stored row now
  // keeps the ids it asked (panel_json); under 80% of them in common there is no delta at all, and the report says why.
  const nowIds = AIP.panelIds([...byQ.entries()].filter(([, q]) => q.kind !== 'brand').map(([id]) => id));
  const prevIds = prev && prev.panel && Array.isArray(prev.panel.ids) ? prev.panel.ids : null;
  const same_ids = prevIds ? AIP.overlap(nowIds, prevIds) : null;
  // F1b (2026-10-23): a row counted under another measurement rule is never compared - the deploy of a new rule is not a change in
  // visibility. It is checked first: it explains more than an engine or a panel change.
  const same_rule = prev ? (String(prev.rule_version || '') === AVM.RULE_VERSION ? { comparable: true, why: '' }
    : { comparable: false, why: 'measurement rule changed: this week starts a new baseline (from ' + AVM.RULE_VERSION.replace(/^aivis-/, '') + ' "named in" counts the answers that name you, not the ones that only cite a page, and share of voice counts every competitor named)' }) : null;
  const like = prev ? (!same_rule.comparable ? same_rule : !same_kind.comparable ? same_kind
    : (same_ids && same_ids.same === false) ? { comparable: false, why: 'only ' + Math.round(100 * same_ids.share) + '% of the questions asked now were asked then (' + same_ids.common + ' in common): a different panel, not a different result' }
    : same_panel) : null;
  const delta_not_compared = prev && !like.comparable
    ? 'Not compared with ' + String(prev.checked_at || '').slice(0, 10) + ': ' + like.why + '.' : '';
  // G6: the segment changes and the panel record need `like` (same engines, same questions) — they are computed here, after it
  // changes, per segment: only against a comparable panel (same engines, same questions), only with enough answers on both sides
  const prevSeg = new Map(((prev && prev.segments && prev.segments.rows) || []).map(s => [s.dim + '|' + s.key, s]));
  const segTests = []; const segChange = {};
  if (prev && like.comparable) for (const s of segRows) { const b = prevSeg.get(s.dim + '|' + s.key); if (!b || !(Number(b.n) > 0)) continue;
    const qb = Number(b.questions) || 0; if (qb && Math.abs(s.questions - qb) / Math.max(s.questions, qb) > 0.2) { segChange[s.dim + '|' + s.key] = { tested: false, why: 'its questions changed (' + qb + ' then, ' + s.questions + ' now)' }; continue; }
    if (s.n < MIN_RATE_SAMPLES || Number(b.n) < MIN_RATE_SAMPLES) { segChange[s.dim + '|' + s.key] = { tested: false, why: 'too few answers to test a change (' + s.n + ' now, ' + b.n + ' before; ' + MIN_RATE_SAMPLES + ' needed on each side)' }; continue; }
    const t = changeOf(s.k, s.n, Number(b.k) || 0, Number(b.n)); segChange[s.dim + '|' + s.key] = { tested: true, delta: t.delta, z: t.z, n_before: Number(b.n), k_before: Number(b.k) || 0 };
    segTests.push({ id: s.dim + '|' + s.key, label: s.dim + ' ' + s.key, z: t.z }); }
  const seg_family = bh(segTests, 0.1);
  for (const s of segRows) { const c = segChange[s.dim + '|' + s.key]; if (!c) continue; const f = seg_family.by[s.dim + '|' + s.key];
    s.change = c.tested ? { delta: c.delta, z: c.z, n_before: c.n_before, p: f ? f.p : null, significant: !!(f && f.discovery), why: f ? f.why : '' } : { delta: null, significant: null, why: c.why }; }
  const segOrder = ['engine', 'cluster', 'persona', 'market', 'stage', 'cluster x persona', 'engine x cluster', 'market x cluster'];
  const segments = { rows: segOrder.flatMap(d => segRows.filter(s => s.dim === d).sort((a, b) => b.n - a.n).slice(0, d.indexOf(' x ') > 0 ? 60 : 40)),
    family: { method: seg_family.method, q: seg_family.q, tests: seg_family.tests, rejected: seg_family.rejected, note: seg_family.note },
    moves: segRows.filter(s => s.change && s.change.significant).sort((a, b) => Math.abs(b.change.delta) - Math.abs(a.change.delta)).slice(0, 12).map(s => ({ dim: s.dim, key: s.key, rate: s.rate, delta: s.change.delta, n: s.n, why: s.change.why })),
    too_few: segRows.filter(s => !s.enough && segOrder.slice(0, 5).includes(s.dim)).length,
    min_answers: MIN_RATE_SAMPLES, basis: 'measured', counted: 'the headline\'s answers: this run on the weekly engines + the pooled daily pulse answers (no brand question, no monthly engine); share of voice ' + SOV_BASIS.replace(/^your/, 'is your') };
  // the precision this panel buys, measured on this run and modelled for the panel as it is set
  const medCl = (() => { const xs = segRows.filter(s => s.dim === 'cluster').map(s => s.n).sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : 0; })();
  const panel_cost = AIP.cost({ panel: Number(p.prompts_max) || nowIds.length + 1, engines: p.engines, pulse: p.pulse !== false, pulse_mode: p.pulse_mode, pulse_per_week: p.pulse_per_week });
  const panel_info = { ids: nowIds, size: nowIds.length, setting: Number(p.prompts_max) || null, engines: [...new Set(Rall.map(r => r.engine))].sort(), hash: AIP.panelHash(nowIds, [...new Set(Rall.map(r => r.engine))]),
    composition: Object.fromEntries(['cluster', 'persona', 'market', 'stage'].map(d => [d, Object.fromEntries(segRows.filter(s => s.dim === d).map(s => [s.key, s.questions]))])),
    overlap_with_previous: same_ids, half_width: { measured: { headline: samples ? Math.round(10 * (wilson(mentioned, samples)[1] - wilson(mentioned, samples)[0]) / 2) / 10 : null, headline_answers: samples, median_cluster: medCl ? AIP.halfWidth(medCl) : null, median_cluster_answers: medCl },
      achievable: { headline: panel_cost.half_width.headline, cluster: panel_cost.half_width.cluster, per_week: panel_cost.per_week, note: 'at the widest (a rate near 50%), with the panel and the daily pulse as they are set' } },
    pulse_per_week: panel_cost.per_week, executions: panel_cost.executions };
  // ---- B8-1 (2026-10-15, benchmark area 8, INVARIANTS rule 1): FOUR headline tiles printed an arrow and only ONE of them had been
  // tested. "Named in" carried its 95% range and a two-proportion z-test from v4.9; "Your pages cited", "Share of voice" and the
  // visibility score were subtractions printed in the same type, in the same row, from the same 33-54 answers — and the subject line
  // put the untested points in front of every reader before they opened the mail. Each one now goes through the same test and carries
  // its own verdict, in its own words. The share of voice is a proportion of a DIFFERENT denominator (yours out of yours plus the
  // competitors'), so it is tested on that denominator and not on the answer count, and the earlier run's competitor counts come from
  // the stored row itself rather than from reconstructing them out of a rounded percentage.
  const compTotalBefore = ((prev && prev.competitors) || []).reduce((s, c) => s + (Number(c.mentions) || 0), 0);
  const citedBefore = prev ? Math.round((Number(prev.citation_rate) || 0) * (prev.samples || 0) / 100) : 0;
  const score_band = scoreBand(U, (a) => volOf.get(a.prompt_id) || 0);
  // F1b (E19): the stored counts of the previous run (metrics_json) when it has them; share of voice, the score and the place are tested
  // on their standard errors over ANSWERS - one answer naming four rivals is one observation, not four
  const PS = (prev && prev.stats && prev.stats.rule_version === AVM.RULE_VERSION) ? prev.stats : null;
  const kPrev = PS && PS.named ? Number(PS.named.k) || 0 : (prev ? prev.mentioned_k : 0), nPrev = PS && PS.named ? Number(PS.named.n) || 0 : (prev ? prev.samples : 0);
  const cPrev = PS && PS.cited ? Number(PS.cited.k) || 0 : citedBefore;
  const halfSe = (h) => h == null ? null : Number(h) / 1.96;
  const tests = (prev && like.comparable) ? {
    mention_rate: changeOf(mentioned, samples, kPrev, nPrev),
    citation_rate: changeOf(cited, samples, cPrev, nPrev),
    share_of_voice: PS && PS.sov ? { ...AVM.seChange(H.sov, H.sov_se, H.sov_n, PS.sov.rate, PS.sov.se, PS.sov.n), basis: 'measured', samples: H.sov_n, samples_before: Number(PS.sov.n) || 0 }
      : { delta: null, z: null, p: null, significant: null, basis: 'not_available', why: 'the earlier run did not record its share of voice per answer' },
    visibility_score: PS && PS.score && PS.score.half != null && score_band.half != null ? (() => { const t = AVM.seChange(visibility_score, halfSe(score_band.half), score_band.n, PS.score.score, halfSe(PS.score.half), Number(PS.score.n) || 0, { min: 0 });
      return { ...t, basis: 'modelled', half: score_band.half, half_before: PS.score.half, why: t.why + '; judged against both runs\' own 95% bands (+/-' + score_band.half + ' points now, +/-' + PS.score.half + ' before)' }; })()
      : scoreChange(visibility_score, prev.visibility_score, score_band),
    avg_position: PS && PS.position ? { ...AVM.seChange(H.avg_position, H.position_n ? (Number(H.position_sd) || 0) / Math.sqrt(H.position_n) : null, H.position_n, PS.position.mean, PS.position.n ? (Number(PS.position.sd) || 0) / Math.sqrt(PS.position.n) : null, Number(PS.position.n) || 0, { min: 0 }), basis: 'measured' }
      : { delta: null, z: null, p: null, significant: null, basis: 'not_available', why: 'the earlier run did not record the place in its answers' } } : null;
  const delta = (prev && like.comparable) ? { mention_rate: +(mention_rate - prev.mention_rate).toFixed(1), citation_rate: +(citation_rate - prev.citation_rate).toFixed(1), share_of_voice: +(share_of_voice - prev.share_of_voice).toFixed(1),
    visibility_score: prev.visibility_score == null ? null : +(visibility_score - prev.visibility_score).toFixed(1),
    // kept as the headline verdict the alerts and the subject read; `tests` holds the same answer for every other figure
    significant: prev.samples ? significant(mentioned, samples, prev.mentioned_k, prev.samples) : null, tests } : null;
  // ---- R84 (2026-10-16, re-rating defect C-8): say exactly what the headline counts. Exec 623 printed "8 buyer questions × 6 AI
  // engines · 74 answers" while the 74 were 7 buyer questions on the 5 weekly engines (33 this run + 41 from the pulse) — the 8th
  // question is the brand question (recognition only) and Claude, asked monthly, is shown per engine and kept out of the headline on
  // purpose (the week-on-week comparison depends on the weekly engine set). The words change, not the denominator.
  const buyerQ = new Set(R.map(r => r.prompt_id)).size, brandQ = new Set(RB.map(r => r.prompt_id)).size;
  const headEng = [...new Set([...RC.map(r => r.engine), ...PR.flatMap(d => Object.entries(d.engines || {}).filter(([, v]) => (Number((v || {}).answered) || 0) > 0).map(([e]) => e))])];
  const monthlyOut = MONTHLY.filter(e => R.some(r => r.engine === e)).map(e => ({ engine: ENG[e] || e, answers: R.filter(r => r.engine === e && r.answered).length }));
  const came_back = Rall.filter(r => !r.error).length;
  const headline = { buyer_questions: buyerQ, brand_questions: brandQ, engines: headEng.map(e => ENG[e] || e), engine_count: headEng.length, run_answers: ans.length, pulse_answers: pulseN, samples,
    monthly_left_out: monthlyOut, brand_answers: RB.filter(r => r.answered).length, requests: Rall.length, came_back,
    text: samples + ' answers to the ' + buyerQ + ' buyer question' + (buyerQ === 1 ? '' : 's') + ' on the ' + headEng.length + ' weekly engine' + (headEng.length === 1 ? '' : 's')
      + (pulseN ? ' (' + ans.length + ' this run + ' + pulseN + ' from the daily pulse)' : '')
      + (monthlyOut.some(x => x.answers) ? '; ' + monthlyOut.filter(x => x.answers).map(x => x.engine + '\'s ' + x.answers + ' answer' + (x.answers === 1 ? '' : 's')).join(' and ') + ' (asked monthly) are shown per engine and not in the headline' : '')
      + (brandQ ? '; the brand question measures recognition only' : '') };
  // ---- R85 (2026-10-16, re-rating defect C-9): the AI search-volume lookup failed twice in exec 623 (HTTP 500 around task 50000
  // "Internal Error.", 50 s each) and the report said "0 questions with a volume" as if it had been read. A lookup that failed is
  // "not read", and the stored volumes (0 here, read on an earlier run) are named as stored, not as this month's.
  const innerMsg = (r) => { const t = task0(r); if (t.status_message && t.status_code !== 20000) return String(t.status_message); const er = (r || {}).error; const e = er ? String(typeof er === 'string' ? er : (er.message || JSON.stringify(er))) : (gErr(r) || '');
    const msgs = [...String(e).matchAll(/status_message[\\"]*:\s*[\\"]*([^\\"]+)/g)].map(m => m[1]).filter(x => !/^ok\.?$/i.test(x)); return msgs.length ? msgs[msgs.length - 1] : (e ? e.slice(0, 120) : 'no answer'); };
  const volQ = dreq.map((q, i) => ({ q, r: dres[i] })).filter(x => x.q.site_id === p.site_id && x.q.kind === 'volume');
  const volBad = volQ.filter(x => task0(x.r).status_code !== 20000);
  const volRetried = volBad.some(x => Number(((x.r || {}).__dfs || {}).retried) > 0);
  const volStored = [...meta.values()].filter(q => q.kind !== 'brand');
  const volume_lookup = { asked: volQ.length > 0, read: volQ.length ? !volBad.length : null, keywords: volQ.reduce((n, x) => n + (((x.q.body || [])[0] || {}).keywords || []).length, 0),
    error: volBad.length ? innerMsg(volBad[0].r) : '', retried: volRetried, stored_measured: volStored.filter(q => q.volume != null && q.volume !== '').length,
    stored_positive: volStored.filter(q => Number(q.volume) > 0).length, questions: volStored.length,
    note: volBad.length ? 'AI search volume could not be read this run (DataForSEO failed' + (volRetried ? ' twice' : '') + ': ' + innerMsg(volBad[0].r) + ')'
      + ', so the volumes shown are the ones stored from an earlier run, not this month\'s.' : '' };
  // ---- B8-8 (2026-10-17, wave 3, benchmark area 8): "X no longer cites any of your pages" fired on `cited > 0` then `cited === 0`
  // whatever that engine's own sample was - 2 citations in 6 Gemini answers, then none in 10, is not evidence Gemini stopped citing
  // anyone. Every engine that cited the site last time is now judged by the same `changeOf` on ITS OWN answers (this run + the pulse
  // mornings), and under MIN_ENGINE_SAMPLES on either side it is "too few answers from this engine to tell", in those words.
  // A changed question panel moves every engine's rate on its own (B-L4), so the per-engine comparison needs the same panel.
  const engine_changes = {};
  if (prev && prev.engines) for (const [e, v] of Object.entries(prev.engines)) { const x = engines[e];
    if (!x || x.carried || !v || v.carried || !((Number(v.cited) || 0) > 0)) continue;
    const nB = Number(v.samples != null ? v.samples : v.answered) || 0, nN = Number(x.samples != null ? x.samples : x.answered) || 0;
    const fell = nN ? (x.cited || 0) / nN < (Number(v.cited) || 0) / (nB || 1) : true;
    // E13 (F1b): the same QUESTIONS and engines under the same rule (`like`), not only a panel of the same size
    if (!(like && like.comparable)) { engine_changes[e] = { name: ENG[e] || e, tested: false, fell, samples: nN, samples_before: nB, k: x.cited || 0, k_before: Number(v.cited) || 0, why: 'not compared: ' + (like ? like.why : 'no earlier run') }; continue; }
    engine_changes[e] = { name: ENG[e] || e, fell, ...engineChange(x.cited || 0, nN, Number(v.cited) || 0, nB) }; }
  // ---- B8-9 (2026-10-17, wave 3, benchmark area 8): the alerts below that rest on a test share ONE sample, so they are one family and
  // are corrected together (Holm, 5% family-wise). A test joins the family when its alert could fire on it - the change points the way
  // the alert reads - and each alert that fires states the adjusted threshold it cleared.
  const prevComp = new Map((((prev && like.comparable) ? prev.competitors : null) || []).map(c => [c.domain, c]));   // B-L4: a competitor's share moves with the panel too
  const family = [];
  if (tests && tests.mention_rate && tests.mention_rate.z != null && tests.mention_rate.delta < 0) family.push({ id: 'mention_rate', label: 'AI mentions', z: tests.mention_rate.z });
  for (const [e, c] of Object.entries(engine_changes)) if (c.tested && c.z != null && c.delta < 0) family.push({ id: 'engine:' + e, label: c.name + ' citations', z: c.z });
  // B8-1: "gained 10+ points" was a fixed rule over two noisy samples, raised beside a mention-rate change that had been z-tested.
  // The same test, on the same denominator as the share it is about.
  const compTests = [];
  // E19 (F1b): a competitor's share of voice is tested on its standard error over answers, against the stored figure of the previous run
  for (const c of comp) { const b0 = prevComp.get(c.domain); const sb = PS && PS.competitors ? PS.competitors[c.domain] : null; if (!b0 || !sb) continue;
    const t = AVM.seChange(c.sov, c._st.sov_se, c._st.sov_n, sb.sov, sb.sov_se, Number(sb.sov_n) || 0, { min: 10 });
    if (t.z != null && t.delta > 0 && c.mentions >= 5) { compTests.push({ c, t }); family.push({ id: 'comp:' + c.domain, label: c.domain + ' share of voice', z: t.z }); } }
  const multiple_tests = holm(family, 0.05);
  const passes = (id) => !!(multiple_tests.by[id] && multiple_tests.by[id].reject);
  const alerts = [];
  if (delta) { const mT = tests.mention_rate;
    if (mT && mT.z != null ? (passes('mention_rate') && mT.delta < 0 && Math.abs(mT.delta) >= (mT.min_points || 5)) : delta.mention_rate <= -15)
      alerts.push({ level: 'high', text: 'AI mentions dropped ' + Math.abs(delta.mention_rate) + ' points to ' + mention_rate + '% of answers'
        + (mT && mT.z != null ? ' (a real change, not sampling noise: ' + samples + ' answers this week vs ' + prev.samples + '; ' + holmWords(multiple_tests, 'mention_rate') + ')' : ' (not tested: the earlier run recorded no sample size)') + '.' }); }
  for (const [e, c] of Object.entries(engine_changes)) if (c.tested && passes('engine:' + e) && c.delta < 0 && Math.abs(c.delta) >= (c.min_points || 5))
    alerts.push({ level: 'medium', text: c.name + (c.k === 0 ? ' no longer cites any of your pages: ' : ' cites your pages less: ') + c.k + ' of ' + c.samples + ' answers this week vs ' + c.k_before + ' of ' + c.samples_before + ' before (a real drop on this engine\'s own answers; ' + holmWords(multiple_tests, 'engine:' + e) + ').' });
  // D19: the failures are reported with their reason, and above 10% they are an alert of their own (every rate counts answered requests only)
  if (errors) alerts.push({ level: error_rate > 50 ? 'high' : error_rate >= 10 ? 'medium' : 'low',
    text: errors + ' of ' + Rall.length + ' AI requests failed' + (retry.asked ? ' (' + retry.answered + ' of ' + retry.asked + ' answered on the retry)' : '') + ': ' + error_list.map(e => e.engine + ' — ' + e.message).slice(0, 3).join('; ') + '. ' + came_back + ' of ' + Rall.length + ' came back; the rates below count ' + headline.text + '.' });
  if (volume_lookup.note) alerts.push({ level: 'low', text: volume_lookup.note });
  for (const { c, t } of compTests) if (passes('comp:' + c.domain) && t.significant === true)
    alerts.push({ level: 'medium', text: c.domain + ' gained ' + Math.round(t.delta) + ' points of AI share of voice (now ' + c.share + '%) — ' + t.why + '; ' + holmWords(multiple_tests, 'comp:' + c.domain) + '.' });
  for (const it of issues.filter(x => x.new).slice(0, 3)) alerts.push({ level: 'high', text: 'AI states something wrong about you (' + it.engines.join(', ') + '): ' + it.text });
  if (neg && (!prev || !like.comparable || prev.sentiment_score == null || sentiment_score < prev.sentiment_score - 20)) alerts.push({ level: 'medium', text: neg + ' AI answer(s) speak negatively about you (sentiment ' + sentiment_score + ').' });
  if (acc) for (const it of acc.issues.filter(x => x.level === 'critical' || x.level === 'high')) alerts.push({ level: 'high', text: it.text });
  if (traffic && traffic.connected && traffic.prev_sessions >= 30 && traffic.change_pct != null && traffic.change_pct <= -30) alerts.push({ level: 'medium', text: 'Visits from AI assistants fell ' + Math.abs(traffic.change_pct) + '% (' + traffic.sessions + ' in the last 28 days vs ' + traffic.prev_sessions + ').' });
  // actions, most valuable first (value = the demand behind a question, or how much a fix unblocks)
  const actions = [];
  if (acc) for (const it of acc.issues.filter(x => x.level === 'critical' || x.level === 'high').slice(0, 2)) actions.push({ priority: 1, type: 'access', action: it.fix, why: it.text });
  { const ga = GONE.action(gone_cited); if (ga) actions.push({ ...ga, why: 'AI answers cite ' + gone_cited.length + ' of your old addresses that now answer ' + [...new Set(gone_cited.map(r => r.status || 404))].join(' / ') + ' (' + gone_cited.reduce((t, r) => t + (r.citations || 0), 0) + ' citations), so every reader who follows them lands on an error page. Do not build on these pages: they no longer exist.' }); }
  for (const it of issues.slice(0, 2)) actions.push({ priority: 1, type: 'accuracy', action: 'Correct what AI says: ' + it.text.split(' → ')[0].slice(0, 120), why: (it.engines.join(', ') + ' state this; the fact on file is "' + (it.text.split(' → ')[1] || 'different') + '". State the right fact plainly on the About and service pages, in the Organization schema and on the profiles AI reads (Google Business Profile, LinkedIn, directories).').slice(0, 400) });
  for (const g of gaps.slice(0, 3)) actions.push({ priority: 1, type: 'content', action: 'Win the answer to "' + g.prompt + '"', why: 'AI recommends ' + g.competitors.slice(0, 3).join(', ') + ' here and not you' + (g.volume ? ' (' + g.volume.toLocaleString('en-GB') + ' AI searches a month)' : '') + (g.sources.length ? '; it relies on ' + g.sources.slice(0, 3).join(', ') : '') + (g.fanout.length ? '; to answer it searched "' + g.fanout[0] + '"' : '') + '.', keyword: g.topic || g.prompt,
    api_body: { mode: 'keyword', keyword: (g.topic || g.prompt).toLowerCase().slice(0, 80), country: p.country, domain: p.domain, page_type: g.kind === 'compare' ? 'Comparison Page' : 'Guide', receive: ['Keyword Report', 'Page Content'],
      ai_target: { question: g.prompt, kind: 'answer', target_id: 'ait_' + p.site_id.replace(/^site_/, '') + '_' + g.prompt_id, fanout: g.fanout || [], sources: (g.cited_urls || []).slice(0, 6).map(c => ({ u: c.u, t: c.t || '' })), competitors: (g.competitors || []).slice(0, 8) } } });   // v4.12: the page is written to be the one AI cites
  const VERB = { site: 'Get featured on ', media: 'Pitch an expert comment to ', directory: 'Get listed (with reviews) on ' };
  for (const s of sources.filter(s => VERB[s.kind] && s.citations >= 2).slice(0, 4)) actions.push({ priority: 2, type: s.kind === 'site' ? 'pr' : s.kind, action: VERB[s.kind] + s.domain, why: 'AI answers cite it ' + s.citations + ' times (' + (s.engines.join(', ') || 'daily checks') + ')' + (s.topics.length ? ' for ' + s.topics.join(', ') : '') + (s.kind === 'site' ? '. A guest article, a comparison mention or a quote there feeds the answers directly.' : s.kind === 'media' ? '. Assistants quote news coverage: offer data, a deadline explainer or a client story.' : '. Assistants lean on these lists when they recommend providers.') });
  const plat = sources.filter(s => s.kind === 'platform').slice(0, 2);
  if (plat.length) actions.push({ priority: 3, type: 'platform', action: 'Publish where AI looks: ' + plat.map(s => s.domain).join(', '), why: 'AI answers cite these platforms ' + plat.reduce((n, s) => n + s.citations, 0) + ' times for your topics (e.g. a short explainer video, a LinkedIn article, an answer in a relevant thread).' });
  const off = sources.filter(s => s.kind === 'official').slice(0, 2);
  if (off.length) actions.push({ priority: 3, type: 'official', action: 'Be listed on ' + off.map(s => s.domain).join(', '), why: 'Official sources AI trusts for this topic; registry listings (e.g. accredited-provider lists) are cited directly.' });
  if (brand.answered && brand.known < brand.answered) actions.push({ priority: 2, type: 'entity', action: 'Make the brand recognisable to AI', why: (brand.answered - brand.known) + ' of ' + brand.answered + ' AI assistants asked directly did not name you' + (brand.carried ? ' (the month\'s full run)' : '') + '. Complete the business profile, add Organization schema with sameAs (LinkedIn, Google Business Profile), keep name / address / phone identical everywhere, publish an About page and get listed on the sources above.' });
  if (cited === 0 && samples >= MIN_RATE_SAMPLES) actions.push({ priority: 2, type: 'citable', action: 'Give AI something to cite', why: 'No answer cited your pages across ' + samples + ' answers. Pages with a direct 40-60 word answer, a dated fact table and clear headings (every page the agent writes has them) are the ones assistants quote.' });
  if (fanout.length && gaps.length) actions.push({ priority: 3, type: 'fanout', action: 'Answer what AI searches for: "' + fanout.slice(0, 3).map(f => f.query).join('", "') + '"', why: 'Before answering your buyers\' questions the assistants ran these searches; a page that ranks for them is the page they read and cite.' });
  // seo_ai_visibility row (exact columns), ai_source prospects (status kept), learned brand names (seo_cache)
  const J = (o) => JSON.stringify(o);
  // G6: what THIS execution spent on DataForSEO (the ledger settles each execution's own money) — the earlier executions of a split run
  // settled theirs; the row and the report carry the whole run
  const exec_cost = +(Rall.filter(r => !r._stored).reduce((s, r) => s + (Number(r.cost) || 0), 0) + mine.filter(x => /^(market|index_)/.test(x.q.engine)).reduce((s, x) => s + (Number(task0(x.r).cost) || 0), 0) + dreq.reduce((s, q, i) => s + (q.site_id === p.site_id ? dCost(dres[i]) : 0), 0)).toFixed(4);
  const run_split = p.chunk ? { executions: (p.chunk.executions || []).length + 1, chunk: p.chunk.no, requests: Rall.length, stored_before: Rall.filter(r => r._stored).length, resumed: !!p.chunk.resumed,
    note: (p.chunk.executions || []).length ? 'This run was asked over ' + ((p.chunk.executions || []).length + 1) + ' executions (' + Rall.filter(r => r._stored).length + ' of its ' + Rall.length + ' answers were stored by the earlier ones' + (p.chunk.resumed ? '; it was resumed after a pause' : '') + '); every figure below counts all of them once.' : '' } : null;
  // ---- F1b (2026-10-23): the window the week was counted over (E14: (the previous row's checked_at, this run's start]; A8: stated in the row),
  // the competitor table's changes, the stored counts the next run compares against (metrics_json) and the comparison every reader shares
  // (compare_json, APP_AUDIT A1: the app draws no arrow of its own). Rates are percentages 0-100 as everywhere in this row.
  const rwin = (() => { const pw = p.pulse_window || null; const from = pw && pw.from ? String(pw.from) : (prev && prev.checked_at ? String(prev.checked_at) : String(([...pulseDates].sort()[0] || p.checked_at)));
    const to = pw && pw.to ? String(pw.to) : String(p.checked_at); const d = (Date.parse(to) - Date.parse(from)) / 864e5; return { from, to, days: Number.isFinite(d) ? Math.round(10 * Math.max(0, d)) / 10 : null }; })();
  const rate_period = (() => { const to = String(p.checked_at || '').slice(0, 10); const from = prev && rwin.from ? String(rwin.from).slice(0, 10) : ([...pulseDates].sort()[0] || '');
    if (!PR.length) return 'this run on ' + to + ' (no daily pulse reading' + (from ? ' since ' + from : '') + ')';
    return 'this run on ' + to + ' + ' + pulseDays + ' daily pulse day' + (pulseDays === 1 ? '' : 's') + (from ? ' since ' + from : ''); })();
  const cmpOk = !!(prev && like && like.comparable);
  const numOr = (v) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  for (const c of comp) { const b0 = prevComp.get(c.domain); if (!cmpOk || !b0) { c.delta = null; continue; } const sb = PS && PS.competitors ? PS.competitors[c.domain] : null;
    const dd = (a, b) => numOr(a) == null || numOr(b) == null ? null : Math.round(10 * (Number(a) - Number(b))) / 10;
    const t = sb ? AVM.seChange(c.sov, c._st.sov_se, c._st.sov_n, sb.sov, sb.sov_se, Number(sb.sov_n) || 0) : null;
    c.delta = { named_rate: dd(c.named_rate, b0.named_rate), sov: dd(c.sov, b0.sov != null ? b0.sov : b0.share), avg_position: dd(c.avg_position, b0.avg_position), cited_rate: dd(c.cited_rate, b0.cited_rate),
      sov_significant: t ? t.significant : null, sov_p: t ? t.p : null, why: t ? t.why : 'the earlier run did not record this competitor per answer' };
    for (const [e, x] of Object.entries(c.engines || {})) { const y = ((b0.engines || {})[e]) || null; x.delta = y ? { named_rate: dd(x.named_rate, y.named_rate), sov: dd(x.sov, y.sov), avg_position: dd(x.avg_position, y.avg_position), cited_rate: dd(x.cited_rate, y.cited_rate) } : null; } }
  const stats = { v: 1, rule_version: AVM.RULE_VERSION, named: { k: H.named, n: H.n }, cited: { k: H.cited, n: H.n },
    sov: { rate: H.sov, se: H.sov_se, n: H.sov_n, self: H.sov_self, mentions: H.sov_mentions },
    position: { mean: H.avg_position, sd: H.position_sd, n: H.position_n, first: H.first, first_rate: H.first_rate, pos_visibility: H.pos_visibility, pos_visibility_se: H.pos_visibility_se },
    score: { score: visibility_score, half: score_band.half, n: score_band.n, n_eff: score_band.n_eff },
    competitors: Object.fromEntries(comp.map(c => [c.domain, { named: c._st.named, n: c._st.n, sov: c._st.sov, sov_se: c._st.sov_se, sov_n: c._st.sov_n, avg_position: c._st.avg_position, position_n: c._st.position_n, position_sd: c._st.position_sd, cited_rate: c._st.cited_rate }])),
    window: rwin, pulse_runs: [...new Set(PR.map(d => d.run_id).filter(Boolean))], pulse_left_out: pulseOld.length };
  const cmpM = (now, before, nNow, nBefore, t) => { const enough = nNow >= AVM.MIN && nBefore >= AVM.MIN; const n0 = numOr(now), b0 = numOr(before);
    return { now: n0, prev: b0, delta: cmpOk && n0 != null && b0 != null ? Math.round(10 * (n0 - b0)) / 10 : null, n_now: Math.round(nNow || 0), n_prev: Math.round(nBefore || 0),
      significant: cmpOk && t && enough && t.significant != null ? !!t.significant : null, p: cmpOk && t && enough ? (t.p != null ? t.p : (t.z != null ? Math.round(1e6 * pTwo(t.z)) / 1e6 : null)) : null }; };
  const T0 = tests || {};
  const compare = { rule_version: AVM.RULE_VERSION, comparable: cmpOk, reason: !prev ? 'first run: this week is the baseline' : cmpOk ? null : String(like.why || 'not comparable'),
    previous_run_id: prev ? (prev.run_id || null) : null, previous_at: prev ? (prev.checked_at || null) : null,
    panel_overlap: same_ids && same_ids.share != null ? same_ids.share : null, engines_same: prev ? !!same_kind.comparable : null, window: rwin,
    metrics: {
      named_rate: cmpM(H.named_rate, PS && PS.named && PS.named.n ? Math.round(1000 * PS.named.k / PS.named.n) / 10 : (prev ? (prev.named_rate != null ? prev.named_rate : prev.mention_rate) : null), H.n, prev ? nPrev : 0, T0.mention_rate),
      cited_rate: cmpM(H.cited_rate, prev ? prev.citation_rate : null, H.n, prev ? nPrev : 0, T0.citation_rate),
      share_of_voice: cmpM(H.sov, PS && PS.sov ? PS.sov.rate : (prev ? prev.share_of_voice : null), H.sov_n, PS && PS.sov ? Number(PS.sov.n) || 0 : 0, T0.share_of_voice),
      visibility_score: cmpM(samples ? visibility_score : null, prev ? prev.visibility_score : null, score_band.n || 0, PS && PS.score ? Number(PS.score.n) || 0 : (prev ? prev.samples || 0 : 0), T0.visibility_score),
      avg_position: cmpM(H.avg_position, PS && PS.position ? PS.position.mean : (prev ? prev.avg_position : null), H.position_n, PS && PS.position ? Number(PS.position.n) || 0 : 0, T0.avg_position) } };
  const vis_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: p.checked_at, prompts: byQ.size, answers: samples, mention_rate, citation_rate, share_of_voice, avg_rank: H.avg_position || 0,
    aio_presence, aio_citation_rate, engines_json: J(engines), competitors_json: J(comp), sources_json: J(sources), pages_json: J(our_pages), gaps_json: J(gaps.map(g => ({ prompt_id: g.prompt_id, prompt: g.prompt, kind: g.kind, topic: g.topic, competitors: g.competitors, sources: g.sources, volume: g.volume, stage: g.stage, cluster: g.cluster, fanout: g.fanout, cited_urls: g.cited_urls, engines: g.engines }))), market_json: market ? J(market) : '',
    market_month: market && !market.carried && !market.error ? p.checked_at.slice(0, 7) : ((prev && prev.market_month) || ''), cost_usd: +(exec_cost + ((p.chunk && p.chunk.going && p.spent_before) ? Number(p.spent_before.dfs) || 0 : 0)).toFixed(4),   // G6: the whole run, every execution of it
    alerts: alerts.map(a => a.level + ': ' + a.text).join(' | '),
    run_kind: p.run_kind || 'weekly', samples, visibility_score, mention_lo, mention_hi, sentiment_score, accuracy_issues: fact_check === 'checked' ? issues.length : null, ai_sessions: traffic && traffic.connected ? traffic.sessions || 0 : null, ai_conversions: traffic && traffic.connected ? traffic.key_events || 0 : null, ai_revenue: traffic && traffic.connected ? Math.round(100 * (traffic.revenue || 0)) / 100 : null,
    index_sov: index && index.sov != null ? index.sov : null, ai_impressions: ai_impressions || null, perception_json: J(perception), traffic_json: traffic ? J(traffic) : '', access_json: acc ? J({ checked_at: acc.checked_at, robots: acc.robots, llms_txt: acc.llms_txt, bots: acc.bots.map(b => ({ bot: b.bot, owner: b.owner, group: b.group, allowed: b.allowed_root, rule: b.rule, blocked_paths: b.blocked_paths })), fetch: acc.fetch, issues: acc.issues, ok: acc.ok }) : '',
    index_json: index ? J({ ...index, suggestions: sugg, fanout, demand: { total: demand_total, named: ai_impressions, lost: lost_demand } }) : J({ suggestions: sugg, fanout, demand: { total: demand_total, named: ai_impressions, lost: lost_demand } }), clusters_json: J(clusters),
    rival_sources_json: J(rival_store),   // wave 3 (W3-F): AI Growth reads the rival businesses AI cites from the latest row
    // G6: the segments and the panel (filled in below) and how many executions the run took
    // compact, so a year of weekly rows stays small: one array per segment (the columns are named once); the report and the callback carry the full rows
    segments_json: J({ v: 1, rule_version: AVM.RULE_VERSION, cols: ['dim', 'key', 'questions', 'n', 'k', 'cited', 'sov', 'leader', 'pulse_n', 'delta', 'significant', 'sov_answers', 'sov_self', 'sov_mentions', 'avg_position', 'position_answers', 'first_rate', 'pos_visibility'],
      rows: segments.rows.map(s => [s.dim, s.key, s.questions, s.n, s.k, s.cited, s.sov, s.leader, s.pulse_n, s.change ? s.change.delta : null, s.change ? s.change.significant : null, s.sov_answers, s.sov_self, s.sov_mentions, s.avg_position, s.position_answers, s.first_rate, s.pos_visibility]),
      family: segments.family, moves: segments.moves, min_answers: segments.min_answers }),
    panel_json: J(panel_info), chunks: run_split ? run_split.executions : 1,
    // F1b (2026-10-23): the rule these figures were counted under, "named in" by its own name, the place in the answers, the window and
    // the comparison every reader shares (compare_json), and the counts the next run is compared against (metrics_json)
    rule_version: AVM.RULE_VERSION, named_rate: H.named_rate == null ? 0 : H.named_rate, avg_position: H.avg_position, first_rate: H.first_rate, pos_visibility: H.pos_visibility,
    rate_period, compare_json: J(compare), metrics_json: J(stats) };   // wave 3 (W3-F): AI Growth reads the rival businesses AI cites from the latest row
  const now = p.checked_at;
  const prospect_rows = sources.filter(s => !['platform', 'authority', 'engine'].includes(s.kind) && s.citations >= 1).slice(0, 10).map(s => { const old = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === s.domain && x.type === 'ai_source') || {};
    const top = (s.urls || [])[0] || null;   // v4.12: the exact page AI cites on that site (the one to be named on)
    const kept = DRAFTS.carry(old);   // P34-1: a draft written before the D12 / D13 gates is withdrawn, not carried into the refreshed row
    return { site_id: p.site_id, domain: p.domain, prospect_domain: s.domain, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0,
      detail: 'Cited ' + s.citations + 'x in AI answers (' + (s.engines.join(', ') || 'daily checks') + ')' + (s.topics.length ? ' about ' + s.topics.join(', ') : '') + (top && top.t ? ' — most cited page: "' + top.t + '"' : ''), source_url: top ? top.u : (old.source_url || ''), target_url: old.target_url || '',
      status: old.status || 'new', first_seen: old.first_seen || now, last_seen: now, won_at: old.won_at || '', outreach_subject: kept.outreach_subject, outreach_body: kept.outreach_body, drafted_at: kept.drafted_at, note: (kept.superseded ? DRAFTS.reason : '') || old.note || ({ official: 'official source: ask to be listed', media: 'news site: pitch a story or expert comment', directory: 'directory / review site: get listed' }[s.kind] || ''),
      // v4.10 columns kept as stored (the Backlink Monitor scores, finds contacts and writes follow-ups for these rows)
      score: old.score === '' || old.score == null ? null : Number(old.score), origin: old.origin || 'ai_visibility', contact_email: old.contact_email || '', contact_url: old.contact_url || '', contacted_at: old.contacted_at || '',
      followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '' }; });
  // brand names AI uses for businesses, with their website (Answer Analyst): the parser finds them next time even without a link
  // C-9: the period the headline rates were counted over, as counted — this run plus the pulse readings *AI Plan* took since the last
  // stored run (`since = previous.checked_at`), not a fixed "7 days" (exec 776 counted ONE pulse day and printed "the 7 days to …").
  const aliases = { ...(p.aliases || {}), ...learned };   // R83: the same names the rival set above was built from (D19: only a name that reads like a business name is learned)
  const aliasKeys = Object.keys(aliases).slice(-200); const aliasesTrim = Object.fromEntries(aliasKeys.map(k => [k, aliases[k]]));
  const cache_rows = Object.keys(aliasesTrim).length !== Object.keys(p.aliases || {}).length || JSON.stringify(aliasesTrim) !== JSON.stringify(p.aliases || {}) ? [{ key: 'ai_brands:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J(aliasesTrim), updated_at: now }] : [];
  // G6: the run is measured — its state row says so, so no later start resumes it
  if (p.chunk) { const sb = p.spent_before || {}; cache_rows.push(AIP.stateRow(p.site_id, { run_id: p.run_id, run_kind: p.run_kind, site_id: p.site_id, domain: p.domain, started_at: p.checked_at, updated_at: new Date().toISOString(),
    chunk: p.chunk.no, status: 'done', asked: Rall.length, total: Rall.length, spent_dfs_usd: vis_row.cost_usd, spent_ai_usd: Number(sb.ai) || 0, executions: [...(p.chunk.executions || []), String($execution.id)].slice(-60) }, new Date().toISOString())); }
  return { json: { ...p, metrics: { asked: RC.length, asked_all: R.length, requests: Rall.length, answered: ans.length, samples, pulse_samples: pulseN, pulse_days: pulseDays, pulse_readings: PR.length, came_back, headline, aio_basis, volume_lookup, errors, error_rate, errors_list: error_list, retried: retry.asked, retry_answered: retry.answered, mentioned, cited, mention_rate, mention_ci: [mention_lo, mention_hi], citation_rate, share_of_voice, visibility_score, avg_rank: vis_row.avg_rank, aio_presence, aio_citation_rate, brand_known, brand, delta,
    // B-L4: when the two runs are not like for like the customer is TOLD, in the place the change would have been
    delta_not_compared, panel, panel_before, delta_basis: prev ? (like.comparable ? 'compared with ' + String(prev.checked_at || '').slice(0, 10) + ' (' + panel_before + ' questions on ' + engText(engBefore) + ')' : like.why) : 'first run (baseline)',
    // B8-1: the other three headline tiles now carry what "Named in" always had — their own 95% range and their own verdict on the
    // change. B8-3 / B8-5: what the week's sample is actually made of, and what was never asked.
    // E19 (F1b): the share-of-voice range is taken over ANSWERS (its standard error), not as if every mention were an independent trial
    citation_ci: wilson(cited, samples), sov_ci: H.sov == null ? [0, 0] : [Math.max(0, Math.round(10 * (H.sov - 1.96 * (H.sov_se || 0))) / 10), Math.min(100, Math.round(10 * (H.sov + 1.96 * (H.sov_se || 0))) / 10)], sov_denominator: mentioned + compTotal, sov_answers: H.sov_n,
    // F1b: "named in" by its own name, the place in the answers (with "too few answers" as null under the floor), the rule and the comparison
    rule_version: AVM.RULE_VERSION, named_rate: H.named_rate, named_ci: H.named_ci, first_rate: H.enough ? H.first_rate : null, avg_position: H.position_enough ? H.avg_position : null, position_answers: H.position_n,
    pos_visibility: H.enough ? H.pos_visibility : null, position_enough: H.position_enough, compare, rate_window: rwin,
    score_band, tests: delta ? delta.tests : null, enough_samples: samples >= MIN_RATE_SAMPLES, min_samples: MIN_RATE_SAMPLES,
    sample_note: samples >= MIN_RATE_SAMPLES ? '' : rateOf(mentioned, samples).why, pulse_basis, rate_period, capped, undecided_questions: undecided.length,
    // B8-8 / B8-9: each engine's own change test (or why it was not tested), and the one correction the tested alerts were judged by
    engine_changes, min_engine_samples: MIN_ENGINE_SAMPLES, multiple_tests: { method: multiple_tests.method, alpha: multiple_tests.alpha, tests: multiple_tests.tests, threshold_p: multiple_tests.threshold_p, threshold_z: multiple_tests.threshold_z, rejected: multiple_tests.rejected, results: multiple_tests.results, note: multiple_tests.note },
      sentiment_score, accuracy_issues: fact_check === 'checked' ? issues.length : null, fact_check, index_sov: vis_row.index_sov, ai_impressions, demand_total, lost_demand },
    engines, competitors: comp, sources, rival_sources, our_pages, gone_cited, questions, gaps, undecided, clusters, fanout, perception, traffic, access: acc, index, suggestions: sugg, market, alerts, actions: actions.slice(0, 10), vis_row, prospect_rows, cache_rows, cost_usd: exec_cost, run_cost_usd: vis_row.cost_usd, run_split, segments, panel: { ...panel_info, ids: undefined }, form_url: FORM_URL, api_url: API_URL } };
});
