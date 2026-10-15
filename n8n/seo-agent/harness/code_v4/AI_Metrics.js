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
const posWeight = (rank) => rank === 1 ? 1 : rank === 2 ? 0.8 : rank === 3 ? 0.65 : rank > 3 && rank <= 5 ? 0.5 : rank > 5 ? 0.35 : 0.6;   // rank 0 = named, not in a list
const answerScore = (a) => !a.answered ? null : a.mentioned ? posWeight(Number(a.rank) || 0) * (a.cited ? 1 : 0.85) : (a.cited ? 0.4 : 0);
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
  const PERMANENT = /permission|forbidden|unauthor|invalid[_ ]grant|credential|not found|no access|invalid field|unknown field|unsupported|quota|resource_exhausted|insufficient funds|payment|balance/i;
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
    if (N(res.status_code) >= 40000) return verdict(said(res.status_message, N(res.status_code), 'the search data provider reported an error'), N(res.status_code));
    if (!Array.isArray(res.tasks) || !res.tasks.length) return verdict('no answer from the search data provider');
    const t = res.tasks[0] || {};
    const code = N(t.status_code);
    if (!code) return verdict('no answer from the search data provider');
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
  /** one sentence about those numbers, in the words the reports already use. */
  const note = (s, what) => {
    const st = s || {}; const thing = S(what) || 'request';
    const plural = (n) => n === 1 ? thing : thing + 's';
    if (!st.asked) return '';
    if (!st.failed && !st.retried) return '';
    if (!st.failed) return st.failed_first + ' of ' + st.asked + ' ' + plural(st.asked) + ' failed and ' + (st.retry_answered === 1 ? 'the retry answered' : 'all ' + st.retry_answered + ' answered when they were sent again') + '.';
    return st.failed + ' of ' + st.asked + ' ' + plural(st.asked) + ' could not be checked' + (st.retried ? ' (sent again once, ' + st.retry_answered + ' answered)' : ' (no answer)')
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
  return { dfs, google, check, failures, plan, merge, stats, one, note, evidence, comparable, likeForLike, errText, MAX_SAMPLE_DRIFT, TRANSIENT, PERMANENT };
})();
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let rows = []; try { rows = $('Apply Analysis').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
if (!rows.length) { try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {} }
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
const GOV = /\.gov(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$/i;
const kindOf = (d) => GOV.test(d) ? 'official' : GENERIC_SOCIAL.test(d) ? 'platform' : MEDIA.test(d) ? 'media' : DIRECTORY.test(d) ? 'directory' : AUTHORITY.test(d) ? 'authority' : 'site';
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const ENG = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', ai_overview: 'Google AI Overview', ai_mode: 'Google AI Mode', copilot: 'Copilot' };
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
  const PR = p.pulse_rows || [];
  const pulseN = PR.reduce((s, d) => s + d.samples, 0), pulseM = PR.reduce((s, d) => s + d.mentioned, 0), pulseC = PR.reduce((s, d) => s + d.cited, 0);
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
  const pulse_basis = PR.length ? { days: PR.length, answers: pulseN, engines: fullSet.map(e => ENG[e] || e), basis: 'measured',
    partial_days: partialDays.map(d => ({ date: d.date, answers: d.samples, engines: d.engines.map(e => ENG[e] || e), missing: d.missing })), partial_answers: partialAnswers,
    note: PR.length + ' daily pulse day(s) are counted in the figures below (' + pulseN + ' of the ' + (ans.length + pulseN) + ' answers)'
      + (partialDays.length ? ', and ' + partialDays.length + ' of them did not reach every engine (' + partialAnswers + ' answer(s) from '
        + partialDays.map(d => d.date + (d.missing.length ? ': no answer from ' + d.missing.join(', ') : ': ' + (d.engines.length || 'no') + ' engine(s) only')).join('; ') + ')' : '') + '.' } : null;
  // B8-5: *AI Requests* stops adding requests at 900 / $15 ($4 on the pulse) and records what it dropped in `skipped_by_cap` — which
  // nothing has ever read. A capped run asks fewer engines of fewer questions, every rate below is measured on what was left, and the
  // panel simply looked shorter. Named here, printed in the report (INVARIANTS rule 1).
  const capped = (() => { const s0 = ((reqs[0] || {}).skipped_by_cap || (reqs[0] || {}).skipped || []).filter(x => String(x).indexOf(p.domain + ':') === 0);
    if (!s0.length) return null; const byE = new Map(); for (const x of s0) { const e = String(x).split(':')[1] || ''; byE.set(e, (byE.get(e) || 0) + 1); }
    return { requests: s0.length, engines: [...byE.entries()].map(([e, k]) => ({ engine: ENG[e] || e, requests: k })), basis: 'not_available',
      note: s0.length + ' request(s) were not sent: this run reached its request or cost limit, so '
        + [...byE.entries()].map(([e, k]) => k + ' × ' + (ENG[e] || e)).join(', ') + ' were left unasked. Every rate below is measured on the answers that were asked for.' }; })();
  const mentioned = ans.filter(r => r.mentioned).length + pulseM, cited = ans.filter(r => r.cited).length + pulseC, samples = ans.length + pulseN;
  const ranks = ans.filter(r => r.rank > 0).map(r => Number(r.rank));
  const meta = new Map([...p.prompts, ...freshP.filter(r => r.site_id === p.site_id)].map(q => [q.prompt_id, q]));
  const volOf = new Map([...meta.values()].map(q => [q.prompt_id, Number(q.volume) || 0]));
  // competitors: configured ones always; plus businesses AI names in at least 2 answers (domains, or brand names without a known website)
  const counts = new Map(); const bump = (d, n) => counts.set(d, (counts.get(d) || 0) + n);
  for (const r of ans) for (const d of list(r.competitors)) bump(d, 1);
  for (const d of PR) for (const [k, n] of Object.entries(d.competitors || {})) bump(k, Number(n) || 0);
  { const merged = mergeBrands([...counts.entries()], p.aliases); counts.clear(); for (const [k, v] of merged) counts.set(k, v.reduce((x, y) => x + y, 0)); }   // "ClearTax" and cleartax.com are one business
  const comp = [...new Set([...p.configured_competitors, ...[...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([d]) => d)])].slice(0, 8)
    .map(d => ({ domain: d, mentions: counts.get(d) || 0, auto: !p.configured_competitors.includes(d), named_only: !/\./.test(d) }));
  const compTotal = comp.reduce((s, c) => s + c.mentions, 0);
  const share_of_voice = pct(mentioned, mentioned + compTotal);
  comp.forEach(c => { c.share = pct(c.mentions, mentioned + compTotal); });
  // per engine (this run + pulse samples)
  const engines = {};
  const carriedE = (p.carried && p.carried.engines) || {};
  for (const e of p.engines) { const er = R.filter(r => r.engine === e), ea = er.filter(r => r.answered); const eb = RB.filter(r => r.engine === e && r.answered);
    const pe = PR.reduce((t, d) => { const x = (d.engines || {})[e] || {}; return { n: t.n + (Number(x.answered) || 0), m: t.m + (Number(x.mentioned) || 0), c: t.c + (Number(x.cited) || 0) }; }, { n: 0, m: 0, c: 0 });
    if (!er.length && !pe.n && carriedE[e] && Number(carriedE[e].asked) > 0) { engines[e] = { ...carriedE[e], name: ENG[e] || e, carried: true, checked_at: carriedE[e].checked_at || p.carried.checked_at }; continue; }   // not asked this week: last full run
    const n = ea.length + pe.n, m = ea.filter(r => r.mentioned).length + pe.m, c = ea.filter(r => r.cited).length + pe.c;
    engines[e] = { name: ENG[e] || e, asked: er.length, answered: ea.length, samples: n, mentioned: m, cited: c, mention_rate: pct(m, n), citation_rate: pct(c, n), ci: wilson(m, n), errors: Rall.filter(r => r.engine === e && r.error).length,
      knows_brand: eb.length ? eb.some(r => r.mentioned) : null, pulse_samples: pe.n, sentiment: (() => { const s = ea.filter(r => r.sentiment); return s.length ? Math.round(100 * (s.filter(r => r.sentiment === 'positive').length - s.filter(r => r.sentiment === 'negative').length) / s.length) : null; })() }; }
  const aio = R.filter(r => r.engine === 'ai_overview');
  const aio_presence = pct(aio.filter(r => r.answered).length, aio.length), aio_citation_rate = pct(aio.filter(r => r.cited).length, aio.filter(r => r.answered).length);
  // sources AI cites (not you, not a competitor): where to get listed / featured
  const src = new Map();
  const citedOf = (r) => { try { const v = JSON.parse(r.cited_urls || '[]'); return Array.isArray(v) ? v.filter(x => x && x.u) : []; } catch (e) { return []; } };   // v4.12: the exact pages cited
  const hostOfU = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  for (const r of ansAll) for (const h of list(r.sources)) { if (h === p.domain || h.endsWith('.' + p.domain) || comp.some(c => c.domain === h)) continue; const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set(), urls: new Map() }; s.citations++; s.engines.add(ENG[r.engine] || r.engine); if (r.topic) s.topics.add(r.topic);
    for (const c of citedOf(r)) if (hostOfU(c.u) === h) { const x = s.urls.get(c.u) || { u: c.u, t: c.t || '', n: 0 }; x.n++; if (!x.t && c.t) x.t = c.t; s.urls.set(c.u, x); } src.set(h, s); }
  for (const d of PR) for (const [h, n] of Object.entries(d.sources || {})) { if (h === p.domain || h.endsWith('.' + p.domain) || comp.some(c => c.domain === h)) continue; const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set(), urls: new Map() }; s.citations += Number(n) || 0; s.engines.add('daily'); src.set(h, s); }
  const sources = [...src.values()].sort((a, b) => b.citations - a.citations).slice(0, 15).map(s => ({ domain: s.domain, citations: s.citations, engines: [...s.engines].filter(x => x !== 'daily'), topics: [...s.topics].slice(0, 3), kind: kindOf(s.domain), urls: [...s.urls.values()].sort((a, b) => b.n - a.n).slice(0, 3) }));
  const pages = new Map(); for (const r of ansAll) for (const u of String(r.our_urls || '').split(/\s+/).filter(Boolean)) { const x = pages.get(u) || { url: u, citations: 0, engines: new Set() }; x.citations++; x.engines.add(r.engine); pages.set(u, x); }
  const our_pages = [...pages.values()].sort((a, b) => b.citations - a.citations).slice(0, 10).map(x => ({ url: x.url, citations: x.citations, engines: [...x.engines] }));
  // per question: who wins this run, and how often the business was named over the week's samples (win rate)
  const byQ = new Map();
  for (const r of Rall) { const q = byQ.get(r.prompt_id) || { prompt: r.prompt, kind: r.kind, topic: r.topic, engines: {}, competitors: new Set(), sources: new Set(), fanout: new Set(), urls: new Map(), n: 0, m: 0 }; q.engines[r.engine] = !r.answered ? (r.error ? 'error' : 'none') : r.cited ? 'cited' : r.mentioned ? 'mentioned' : 'absent';
    if (r.answered) { q.n++; if (r.mentioned) q.m++; list(r.competitors).forEach(d => q.competitors.add(d)); list(r.sources).forEach(d => q.sources.add(d)); String(r.fanout || '').split(' | ').filter(Boolean).forEach(f => q.fanout.add(f));
      for (const c of citedOf(r)) { const x = q.urls.get(c.u) || { u: c.u, t: c.t || '', n: 0, engines: new Set() }; x.n++; x.engines.add(r.engine); if (!x.t && c.t) x.t = c.t; q.urls.set(c.u, x); } } byQ.set(r.prompt_id, q); }
  for (const d of PR) for (const [id, st] of Object.entries(d.prompts || {})) { const q = byQ.get(id); if (!q) continue; for (const v of Object.values(st || {})) { if (v === 'n' || v === 'e') continue; q.n++; if (v === 'm' || v === 'c') q.m++; } }
  for (const e of p.engines) if (MONTHLY.includes(e) && !Rall.some(r => r.engine === e)) for (const q0 of byQ.values()) if (!(e in q0.engines)) q0.engines[e] = 'monthly';   // asked on the month's full run
  const questions = [...byQ.entries()].map(([id, q]) => { const m0 = meta.get(id) || {}; return { prompt_id: id, prompt: q.prompt, kind: q.kind, topic: q.topic, stage: m0.stage || '', cluster: m0.cluster || q.topic || '', volume: m0.volume == null ? null : Number(m0.volume), engines: q.engines,
    won: Object.values(q.engines).some(v => v === 'cited' || v === 'mentioned'), win_rate: q.n ? pct(q.m, q.n) : 0, samples: q.n, competitors: [...q.competitors].slice(0, 6), sources: [...q.sources].filter(h => h !== p.domain).slice(0, 5), fanout: [...q.fanout].slice(0, 6),
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
  // demand: AI searches a month behind the panel, and the estimated share of them that name the business (volume x win rate; an estimate)
  const demand = questions.filter(q => q.kind !== 'brand' && q.volume != null);
  const demand_total = demand.reduce((s, q) => s + (Number(q.volume) || 0), 0), ai_impressions = Math.round(demand.reduce((s, q) => s + (Number(q.volume) || 0) * q.win_rate / 100, 0));
  const lost_demand = gaps.reduce((s, g) => s + (Number(g.volume) || 0), 0);
  // what AI searched to write its answers (fan-out queries): pages that answer these get read and cited
  const fan = new Map(); for (const r of ansAll) for (const f of String(r.fanout || '').split(' | ').filter(Boolean)) { const k = f.toLowerCase().trim(); const x = fan.get(k) || { query: f.trim(), count: 0, engines: new Set(), questions: new Set() }; x.count++; x.engines.add(ENG[r.engine] || r.engine); x.questions.add(r.prompt); fan.set(k, x); }
  const fanout = [...fan.values()].sort((a, b) => b.count - a.count).slice(0, 15).map(x => ({ query: x.query, count: x.count, engines: [...x.engines], questions: [...x.questions].slice(0, 2) }));
  // brand recognition (the brand question, monthly)
  const bAns = RB.filter(r => r.answered); let brand = { asked: RB.length, answered: bAns.length, known: bAns.filter(r => r.mentioned).length, engines: bAns.filter(r => r.mentioned).map(r => ENG[r.engine] || r.engine) };
  if (!RB.length && p.carried) { const kb = Object.entries(carriedE).filter(([, v]) => v && v.knows_brand != null); brand = { asked: 0, answered: kb.length, known: kb.filter(([, v]) => v.knows_brand).length, engines: kb.filter(([, v]) => v.knows_brand).map(([k]) => ENG[k] || k), carried: true, checked_at: p.carried.checked_at };
    for (const [k, v] of kb) if (engines[k] && !engines[k].carried) engines[k].knows_brand = v.knows_brand; }
  const brand_known = brand.answered ? brand.known * 2 >= brand.answered : null;   // this month's brand check (asked now or carried from the full run)
  // perception: sentiment of the answers that name the business, the words AI uses for it, wrong claims (Answer Analyst)
  const sRows = ansAll.filter(r => r.mentioned && r.sentiment);
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
  const visWeek = visibilityScore(ans, (a) => volOf.get(a.prompt_id) || 0);
  const visibility_score = samples ? Math.round(10 * (visWeek * ans.length + PR.reduce((s, d) => s + d.visibility_score * d.samples, 0)) / samples) / 10 : 0;
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
  const engSet = (obj) => Object.keys(obj || {}).filter(e => !MONTHLY.includes(e) && !(obj[e] || {}).carried).sort();
  const engNow = engSet(engines), engBefore = engSet(prev && prev.engines);
  const engText = (l) => l.map(e => ENG[e] || e).join(', ') || 'no engine';
  const panel = byQ.size, panel_before = prev ? Number(prev.prompts) || 0 : 0;
  const same_kind = prev ? RT.likeForLike(engNow.join('+'), engBefore.join('+'),
    { labels: { [engNow.join('+')]: engText(engNow), [engBefore.join('+')]: engText(engBefore) }, what: 'this week\'s figures and the stored ones' }) : null;
  const same_panel = prev ? RT.comparable(panel, panel_before, { unit: 'questions' }) : null;
  const like = prev ? (same_kind.comparable ? same_panel : same_kind) : null;
  const delta_not_compared = prev && !like.comparable
    ? 'Not compared with ' + String(prev.checked_at || '').slice(0, 10) + ': ' + like.why + '.' : '';
  // ---- B8-1 (2026-10-15, benchmark area 8, INVARIANTS rule 1): FOUR headline tiles printed an arrow and only ONE of them had been
  // tested. "Named in" carried its 95% range and a two-proportion z-test from v4.9; "Your pages cited", "Share of voice" and the
  // visibility score were subtractions printed in the same type, in the same row, from the same 33-54 answers — and the subject line
  // put the untested points in front of every reader before they opened the mail. Each one now goes through the same test and carries
  // its own verdict, in its own words. The share of voice is a proportion of a DIFFERENT denominator (yours out of yours plus the
  // competitors'), so it is tested on that denominator and not on the answer count, and the earlier run's competitor counts come from
  // the stored row itself rather than from reconstructing them out of a rounded percentage.
  const compTotalBefore = ((prev && prev.competitors) || []).reduce((s, c) => s + (Number(c.mentions) || 0), 0);
  const citedBefore = prev ? Math.round((Number(prev.citation_rate) || 0) * (prev.samples || 0) / 100) : 0;
  const score_band = scoreBand(ans, (a) => volOf.get(a.prompt_id) || 0);
  const tests = (prev && like.comparable) ? {
    mention_rate: changeOf(mentioned, samples, prev.mentioned_k, prev.samples),
    citation_rate: changeOf(cited, samples, citedBefore, prev.samples),
    share_of_voice: changeOf(mentioned, mentioned + compTotal, prev.mentioned_k, prev.mentioned_k + compTotalBefore),
    visibility_score: scoreChange(visibility_score, prev.visibility_score, score_band) } : null;
  const delta = (prev && like.comparable) ? { mention_rate: +(mention_rate - prev.mention_rate).toFixed(1), citation_rate: +(citation_rate - prev.citation_rate).toFixed(1), share_of_voice: +(share_of_voice - prev.share_of_voice).toFixed(1),
    visibility_score: prev.visibility_score == null ? null : +(visibility_score - prev.visibility_score).toFixed(1),
    // kept as the headline verdict the alerts and the subject read; `tests` holds the same answer for every other figure
    significant: prev.samples ? significant(mentioned, samples, prev.mentioned_k, prev.samples) : null, tests } : null;
  const alerts = [];
  if (delta && (delta.significant === true ? delta.mention_rate < 0 : (delta.significant === null && delta.mention_rate <= -15))) alerts.push({ level: 'high', text: 'AI mentions dropped ' + Math.abs(delta.mention_rate) + ' points to ' + mention_rate + '% of answers' + (delta.significant ? ' (a real change, not sampling noise: ' + samples + ' answers this week vs ' + prev.samples + ')' : '') + '.' });
  if (prev && prev.engines) for (const [e, v] of Object.entries(prev.engines)) if ((v.cited || 0) > 0 && engines[e] && engines[e].answered && !engines[e].cited) alerts.push({ level: 'medium', text: (ENG[e] || e) + ' no longer cites any of your pages (cited ' + v.cited + ' times last time).' });
  if (brand_known === false && !brand.carried) alerts.push({ level: 'medium', text: 'Only ' + brand.known + ' of ' + brand.answered + ' AI assistants recognise ' + (p.business_name || p.domain) + ' when asked about it directly.' });
  // D19: the failures are reported with their reason, and above 10% they are an alert of their own (every rate counts answered requests only)
  if (errors) alerts.push({ level: error_rate > 50 ? 'high' : error_rate >= 10 ? 'medium' : 'low',
    text: errors + ' of ' + Rall.length + ' AI requests failed' + (retry.asked ? ' (' + retry.answered + ' of ' + retry.asked + ' answered on the retry)' : '') + ': ' + error_list.map(e => e.engine + ' — ' + e.message).slice(0, 3).join('; ') + '. The rates below count the ' + ans.length + ' answers that came back.' });
  const prevComp = new Map((((prev && like.comparable) ? prev.competitors : null) || []).map(c => [c.domain, c]));   // B-L4: a competitor's share moves with the panel too
  // B8-1: "gained 10+ points" was a fixed rule over two noisy samples, raised beside a mention-rate change that had been z-tested.
  // The same test, on the same denominator as the share it is about.
  for (const c of comp) { const b0 = prevComp.get(c.domain); if (!b0) continue; const t = changeOf(c.mentions, mentioned + compTotal, Number(b0.mentions) || 0, prev.mentioned_k + compTotalBefore, { min_points: 10 });
    if (t.significant === true && t.delta > 0 && c.mentions >= 5) alerts.push({ level: 'medium', text: c.domain + ' gained ' + Math.round(t.delta) + ' points of AI share of voice (now ' + c.share + '%) — ' + t.why + '.' }); }
  for (const it of issues.filter(x => x.new).slice(0, 3)) alerts.push({ level: 'high', text: 'AI states something wrong about you (' + it.engines.join(', ') + '): ' + it.text });
  if (neg && (!prev || !like.comparable || prev.sentiment_score == null || sentiment_score < prev.sentiment_score - 20)) alerts.push({ level: 'medium', text: neg + ' AI answer(s) speak negatively about you (sentiment ' + sentiment_score + ').' });
  if (acc) for (const it of acc.issues.filter(x => x.level === 'critical' || x.level === 'high')) alerts.push({ level: 'high', text: it.text });
  if (traffic && traffic.connected && traffic.prev_sessions >= 30 && traffic.change_pct != null && traffic.change_pct <= -30) alerts.push({ level: 'medium', text: 'Visits from AI assistants fell ' + Math.abs(traffic.change_pct) + '% (' + traffic.sessions + ' in the last 28 days vs ' + traffic.prev_sessions + ').' });
  // actions, most valuable first (value = the demand behind a question, or how much a fix unblocks)
  const actions = [];
  if (acc) for (const it of acc.issues.filter(x => x.level === 'critical' || x.level === 'high').slice(0, 2)) actions.push({ priority: 1, type: 'access', action: it.fix, why: it.text });
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
  if (brand_known === false) actions.push({ priority: 2, type: 'entity', action: 'Make the brand recognisable to AI', why: 'Complete the business profile, add Organization schema with sameAs (LinkedIn, Google Business Profile), keep name / address / phone identical everywhere, publish an About page and get listed on the sources above.' });
  if (cited === 0 && samples >= MIN_RATE_SAMPLES) actions.push({ priority: 2, type: 'citable', action: 'Give AI something to cite', why: 'No answer cited your pages across ' + samples + ' answers. Pages with a direct 40-60 word answer, a dated fact table and clear headings (every page the agent writes has them) are the ones assistants quote.' });
  if (fanout.length && gaps.length) actions.push({ priority: 3, type: 'fanout', action: 'Answer what AI searches for: "' + fanout.slice(0, 3).map(f => f.query).join('", "') + '"', why: 'Before answering your buyers\' questions the assistants ran these searches; a page that ranks for them is the page they read and cite.' });
  // seo_ai_visibility row (exact columns), ai_source prospects (status kept), learned brand names (seo_cache)
  const J = (o) => JSON.stringify(o);
  const vis_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: p.checked_at, prompts: byQ.size, answers: samples, mention_rate, citation_rate, share_of_voice, avg_rank: ranks.length ? +(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : 0,
    aio_presence, aio_citation_rate, engines_json: J(engines), competitors_json: J(comp), sources_json: J(sources), pages_json: J(our_pages), gaps_json: J(gaps.map(g => ({ prompt_id: g.prompt_id, prompt: g.prompt, kind: g.kind, topic: g.topic, competitors: g.competitors, sources: g.sources, volume: g.volume, stage: g.stage, cluster: g.cluster, fanout: g.fanout, cited_urls: g.cited_urls, engines: g.engines }))), market_json: market ? J(market) : '',
    market_month: market && !market.carried && !market.error ? p.checked_at.slice(0, 7) : ((prev && prev.market_month) || ''), cost_usd: +(Rall.reduce((s, r) => s + (Number(r.cost) || 0), 0) + mine.filter(x => /^(market|index_)/.test(x.q.engine)).reduce((s, x) => s + (Number(task0(x.r).cost) || 0), 0) + dreq.reduce((s, q, i) => s + (q.site_id === p.site_id ? dCost(dres[i]) : 0), 0)).toFixed(4),
    alerts: alerts.map(a => a.level + ': ' + a.text).join(' | '),
    run_kind: p.run_kind || 'weekly', samples, visibility_score, mention_lo, mention_hi, sentiment_score, accuracy_issues: fact_check === 'checked' ? issues.length : null, ai_sessions: traffic && traffic.connected ? traffic.sessions || 0 : null, ai_conversions: traffic && traffic.connected ? traffic.key_events || 0 : null, ai_revenue: traffic && traffic.connected ? Math.round(100 * (traffic.revenue || 0)) / 100 : null,
    index_sov: index && index.sov != null ? index.sov : null, ai_impressions: ai_impressions || null, perception_json: J(perception), traffic_json: traffic ? J(traffic) : '', access_json: acc ? J({ checked_at: acc.checked_at, robots: acc.robots, llms_txt: acc.llms_txt, bots: acc.bots.map(b => ({ bot: b.bot, owner: b.owner, group: b.group, allowed: b.allowed_root, rule: b.rule, blocked_paths: b.blocked_paths })), fetch: acc.fetch, issues: acc.issues, ok: acc.ok }) : '',
    index_json: index ? J({ ...index, suggestions: sugg, fanout, demand: { total: demand_total, named: ai_impressions, lost: lost_demand } }) : J({ suggestions: sugg, fanout, demand: { total: demand_total, named: ai_impressions, lost: lost_demand } }), clusters_json: J(clusters) };
  const now = p.checked_at;
  const prospect_rows = sources.filter(s => !['platform', 'authority'].includes(s.kind) && s.citations >= 1).slice(0, 10).map(s => { const old = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === s.domain && x.type === 'ai_source') || {};
    const top = (s.urls || [])[0] || null;   // v4.12: the exact page AI cites on that site (the one to be named on)
    const kept = DRAFTS.carry(old);   // P34-1: a draft written before the D12 / D13 gates is withdrawn, not carried into the refreshed row
    return { site_id: p.site_id, domain: p.domain, prospect_domain: s.domain, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0,
      detail: 'Cited ' + s.citations + 'x in AI answers (' + (s.engines.join(', ') || 'daily checks') + ')' + (s.topics.length ? ' about ' + s.topics.join(', ') : '') + (top && top.t ? ' — most cited page: "' + top.t + '"' : ''), source_url: top ? top.u : (old.source_url || ''), target_url: old.target_url || '',
      status: old.status || 'new', first_seen: old.first_seen || now, last_seen: now, won_at: old.won_at || '', outreach_subject: kept.outreach_subject, outreach_body: kept.outreach_body, drafted_at: kept.drafted_at, note: (kept.superseded ? DRAFTS.reason : '') || old.note || ({ official: 'official source: ask to be listed', media: 'news site: pitch a story or expert comment', directory: 'directory / review site: get listed' }[s.kind] || ''),
      // v4.10 columns kept as stored (the Backlink Monitor scores, finds contacts and writes follow-ups for these rows)
      score: old.score === '' || old.score == null ? null : Number(old.score), origin: old.origin || 'ai_visibility', contact_email: old.contact_email || '', contact_url: old.contact_url || '', contacted_at: old.contacted_at || '',
      followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '' }; });
  // brand names AI uses for businesses, with their website (Answer Analyst): the parser finds them next time even without a link
  const aliases = { ...(p.aliases || {}) }; ajobs.forEach((j, i) => { if (j.site_id !== p.site_id) return; const o = aouts[i] && !aouts[i].error ? parseJ(aouts[i].output) : null; for (const a of ((o && o.answers) || [])) for (const b of ((a && a.brands) || [])) { const nm = String((b && b.name) || '').trim(), d = normD(b && b.domain); if (nm.length >= 3 && nm.length <= 60 && brandish(nm) && /\./.test(d) && d !== p.domain && !d.endsWith('.' + p.domain) && !p.brand_names.some(x => String(x).toLowerCase() === nm.toLowerCase())) aliases[nm] = d; } });   // D19: only a name that reads like a business name is learned
  const aliasKeys = Object.keys(aliases).slice(-200); const aliasesTrim = Object.fromEntries(aliasKeys.map(k => [k, aliases[k]]));
  const cache_rows = Object.keys(aliasesTrim).length !== Object.keys(p.aliases || {}).length || JSON.stringify(aliasesTrim) !== JSON.stringify(p.aliases || {}) ? [{ key: 'ai_brands:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J(aliasesTrim), updated_at: now }] : [];
  return { json: { ...p, metrics: { asked: RC.length, asked_all: R.length, requests: Rall.length, answered: ans.length, samples, pulse_samples: pulseN, pulse_days: PR.length, errors, error_rate, errors_list: error_list, retried: retry.asked, retry_answered: retry.answered, mentioned, cited, mention_rate, mention_ci: [mention_lo, mention_hi], citation_rate, share_of_voice, visibility_score, avg_rank: vis_row.avg_rank, aio_presence, aio_citation_rate, brand_known, brand, delta,
    // B-L4: when the two runs are not like for like the customer is TOLD, in the place the change would have been
    delta_not_compared, panel, panel_before, delta_basis: prev ? (like.comparable ? 'compared with ' + String(prev.checked_at || '').slice(0, 10) + ' (' + panel_before + ' questions on ' + engText(engBefore) + ')' : like.why) : 'first run (baseline)',
    // B8-1: the other three headline tiles now carry what "Named in" always had — their own 95% range and their own verdict on the
    // change. B8-3 / B8-5: what the week's sample is actually made of, and what was never asked.
    citation_ci: wilson(cited, samples), sov_ci: wilson(mentioned, mentioned + compTotal), sov_denominator: mentioned + compTotal,
    score_band, tests: delta ? delta.tests : null, enough_samples: samples >= MIN_RATE_SAMPLES, min_samples: MIN_RATE_SAMPLES,
    sample_note: samples >= MIN_RATE_SAMPLES ? '' : rateOf(mentioned, samples).why, pulse_basis, capped, undecided_questions: undecided.length,
      sentiment_score, accuracy_issues: fact_check === 'checked' ? issues.length : null, fact_check, index_sov: vis_row.index_sov, ai_impressions, demand_total, lost_demand },
    engines, competitors: comp, sources, our_pages, questions, gaps, undecided, clusters, fanout, perception, traffic, access: acc, index, suggestions: sugg, market, alerts, actions: actions.slice(0, 10), vis_row, prospect_rows, cache_rows, cost_usd: vis_row.cost_usd, form_url: FORM_URL, api_url: API_URL } };
});
