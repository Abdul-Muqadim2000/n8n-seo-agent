// One row per question x engine for seo_ai_answers: did the answer mention the brand, cite one of your pages, at which rank among the businesses
// it names, which competitors / businesses appeared, which sources it cited, the brands it named in order (ChatGPT's brand list, learned brand
// names, domains) and the searches the engine ran to write it (fan-out queries: the content AI looks for). The database views (market, index) are
// read by AI Metrics, not stored here. Engines: chatgpt / gemini (LLM scraper: the real chat interfaces), perplexity / claude (LLM Responses;
// Gemini through LLM Responses before v4.9), ai_overview / ai_mode (SERP), copilot (v4.12: the Copilot Search summary in Bing's results). Shared by the AI
// Visibility Tracker and the AI Pulse. v4.12: `cited_urls` keeps the exact third-party pages each answer cited (with their titles) — the earned-media targets.
// Rows carry `_text` (the answer, for the Answer Analyst); the nodes that save them keep only the table columns.
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
const reqs = $('AI Requests').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
if (!reqs.length || reqs[0].skip) return [{ json: { skip: true } }];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let cacheRows = []; try { cacheRows = $('Load Cache (AI)').all().map(i => i.json); } catch (e) {}   // F1a: the entities learned in earlier runs (ai_entities:<site>)
const now = new Date().toISOString();
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n sandbox
const cleanUrl = cleanCiteUrl;   // D19: one page one URL (host without www., no fragment, no tracking parameters) -- _ai_stats.js
const DB_ENGINES = /^(market|index_)/;
const rows = [];
reqs.forEach((q, i) => {
  if (DB_ENGINES.test(q.engine)) return;
  const plan = plans.find(p => p.site_id === q.site_id) || { site_id: q.site_id, brand_names: [q.domain], competitors: [], configured_competitors: [], domain: q.domain, aliases: {} };
  const r = resps[i] || {}; const task = (r.tasks || [])[0] || {}; const res = (task.result || [])[0] || null;
  let text = '', cites = [], answered = false, error = '', fanout = [], entities = [];
  if (r.error || !task.status_code) error = String((r.error && (r.error.message || r.error)) || 'no response').slice(0, 200);
  else if (task.status_code !== 20000) error = String(task.status_message || task.status_code).slice(0, 200);
  else if (res) {
    fanout = (res.fan_out_queries || []).map(String).filter(Boolean);
    if (q.engine === 'chatgpt' || (q.engine === 'gemini' && (res.markdown != null || (res.items || []).some(x => /^gemini_/.test(String(x && x.type)))))) {   // LLM scraper: the real chat interface
      text = String(res.markdown || (res.items || []).map(x => x.markdown || x.text || '').join('\n'));
      cites = [...(res.sources || []), ...(res.items || []).flatMap(x => x.sources || [])].map(s => ({ url: s.url, title: s.title || '', host: hostOf(s.url) || String(s.domain || '').replace(/^www\./, '') }));
      entities = [...(res.brand_entities || []), ...(res.items || []).flatMap(x => x.brand_entities || [])].map(b => String((b && (b.title || b.markdown)) || '').trim()).filter(Boolean);
      answered = !!text;
    } else if (q.engine === 'ai_overview' || q.engine === 'ai_mode' || q.engine === 'copilot') {   // Copilot Search: the ai_overview item of Bing's results
      const ao = (res.items || []).find(x => x && x.type === 'ai_overview');
      if (ao) { text = String(ao.markdown || (ao.items || []).map(x => x.markdown || x.text || '').join('\n'));
        const refs = [...(ao.references || []), ...(ao.items || []).flatMap(x => x.references || [])];
        cites = refs.map(x => ({ url: x.url, title: x.title || x.source || '', host: hostOf(x.url) || String(x.domain || '').replace(/^www\./, '') })); answered = !!(text || cites.length); }
    } else {   // llm_responses: sections with text + annotations (Gemini annotations point to a Google redirect; their title is the source domain)
      const secs = (res.items || []).flatMap(it => it.sections || []);
      text = secs.map(s => s.text || '').join('');
      cites = secs.flatMap(s => s.annotations || []).map(a => { const direct = a.direct_url || ''; let h = hostOf(direct || a.url); if (/vertexaisearch\.cloud\.google\.com/.test(h) && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(a.title || '').trim())) h = String(a.title).trim().toLowerCase().replace(/^www\./, ''); return { url: direct || (/vertexaisearch/.test(String(a.url)) ? '' : a.url), title: /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(a.title || '').trim()) ? '' : String(a.title || ''), host: h }; });
      answered = !!text;
    }
  }
  // F1a (2026-10-23, ENGINE_AUDIT E3 E4 E5 E8, PROD_STATE.md section 5): who the answer names is read by the entity kit (_ai_entities.js):
  // one entity per business (subdomains, country / brand variants, learned names and "formerly X" fold in), a role per entity (self,
  // competitor, platform, source, other), and the client's place among the businesses the answer offers. Only competitors are listed as
  // competitors: a cited directory, a government body or the client's own platform no longer is (E3), a short configured name is found
  // (E4), a common-word domain label is not the client (E5), and "small business" is not business.com (E8).
  const isOurs = (h) => !!h && (h === plan.domain || h.endsWith('.' + plan.domain));
  const D = AIE.dir({ ...plan, brand_names: AIE.ownNames(plan) }, AIE.bookOf(cacheRows, plan.site_id));
  const X = AIE.read({ text, cites, entities }, D);
  const ourAt = X.ourAt;
  const ourUrls = [...new Set([...cites.filter(c => isOurs(c.host) && c.url).map(c => cleanUrl(c.url))])];
  const cited = X.cited;
  const named = X.named;
  const mentioned = named || cited;
  const ents = X.entities;
  const compE = ents.filter(e => e.role === 'competitor').sort((a, b) => (a.position == null ? 1e9 + a.at : a.position) - (b.position == null ? 1e9 + b.at : b.position));
  const rank = named ? X.position : 0;   // position among the businesses the answer offers; 0 = not named (a citation alone is not a recommendation)
  const sources = [...new Set(cites.map(c => c.host).filter(Boolean))];
  // the exact third-party pages cited (not yours, not search engines): where to be named so the next answer names you
  const seenU = new Set(); const cited_urls = cites.filter(c => c.url && c.host && !isOurs(c.host) && !/(^|\.)(google|bing|vertexaisearch\.cloud\.google)\.com$/.test(c.host)).map(c => ({ u: cleanUrl(c.url).slice(0, 300), t: citeTitle(c.title) })).filter(c => !seenU.has(c.u) && seenU.add(c.u)).slice(0, 8);
  const at = ourAt >= 0 ? ourAt : 0;
  const short = q.run_kind === 'pulse';
  const vis = X.vis;
  const excerpt = vis ? vis.slice(Math.max(0, at - 160), at + (short ? 200 : 340)).replace(/\s+/g, ' ').trim() : '';
  const brands = ents.filter(e => (e.role === 'self' || e.role === 'competitor' || e.role === 'platform') && e.at < Infinity).sort((a, b) => a.at - b.at).map(e => e.name);
  const entitiesC = AIE.compact(ents);
  // W2-E1 (2026-10-23, WAVE2_CONTRACTS.md §1): the answer's own data, kept instead of thrown away - the full text, every source cited in order,
  // the pages read but not cited, the searches run, product / ad / local cards and the model (_ai_answer_data.js; '' = the engine reports none)
  const W2 = AAD.answerFields({ engine: q.engine, res, answered, text, cites, fanout, isOurs, ownNames: AIE.ownNames(plan), entities: X.entities, sameEntity: AIE.sameEntity });
  rows.push({ site_id: q.site_id, domain: q.domain, run_id: q.run_id, checked_at: now, prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered, mentioned: answered && mentioned, cited: answered && cited, rank: answered ? (rank || 0) : 0, our_urls: ourUrls.join(' '), competitors: compE.map(e => e.id).slice(0, 12).join(', '),
    sources: sources.slice(0, 15).join(', '), excerpt: excerpt.slice(0, short ? 360 : 520), cost: Number(task.cost) || 0, error,
    run_kind: q.run_kind || 'weekly', sentiment: '', brands: brands.slice(0, 12).join(', '), issues: '', fanout: fanout.slice(0, 6).join(' | ').slice(0, 600), cited_urls: cited_urls.length ? JSON.stringify(cited_urls) : '',
    // F1a: the answer-row contract (agreed with F1b): named = the brand is named in the text; position = 1-based place among self + competitors
    // in order of first mention (null when not named); entities = every business with its role; mentioned stays named OR cited
    named: answered && named, position: answered && named ? X.position : null, entities_json: answered && entitiesC.length ? JSON.stringify(entitiesC) : '',
    ...W2,   // W2-E1
    entities: answered ? entitiesC : [],
    _text: answered ? text.replace(/\s+/g, ' ').slice(0, 2400) : '' });
});
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
