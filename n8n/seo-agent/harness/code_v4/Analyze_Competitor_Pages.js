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
  /** two counts measured on samples of different sizes are not a change (R19): say the sample moved instead of printing a delta. */
  const MAX_SAMPLE_DRIFT = 0.2;
  const comparable = (now, before, o) => {
    const opt = o || {};
    const tol = opt.tolerance == null ? MAX_SAMPLE_DRIFT : opt.tolerance;
    const a = Number(now), b = Number(before);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return { comparable: false, why: 'how many pages each number was measured on was not recorded', drift: null };
    const drift = Math.abs(a - b) / Math.max(a, b);
    if (drift > tol) return { comparable: false, drift: Math.round(drift * 100) / 100,
      why: 'the two counts were measured on different samples (' + b + ' then, ' + a + ' now), so they are not compared' };
    return { comparable: true, drift: Math.round(drift * 100) / 100, why: '' };
  };
  return { dfs, google, check, failures, plan, merge, stats, one, note, evidence, comparable, errText, MAX_SAMPLE_DRIFT, TRANSIENT, PERMANENT };
})();
// ---- results-page observations (2026-10-11, FIX_PLAN D26): an AI Overview (and every other SERP feature) is what ONE Google query showed at
// ONE moment — live, the ladder plan said "no AI Overview" and the page run minutes later "cites 11 domains". Inlined by the build
// (the SERP_OBS placeholder) into Analyze Competitor Pages (the digest the verdict reads), Build Keyword Strategy (stored vs live checks) and Build
// Ladder Report; the keyword report's row is patched by build_v4.py. Every text says WHEN it was seen ("seen in the check at 15:58 UTC on
// 2026-10-11") or "seen in N of M checks", and that AI Overviews vary between searches — never "there is no AI Overview".
// the time of a DataForSEO SERP answer (result datetime "2026-10-11 15:58:12 +00:00", else the task time, else now) as ISO
const serpSeenAt = (res) => {
  try {
    const t0 = ((res || {}).tasks || [])[0] || {}; const r0 = (t0.result || [])[0] || {};
    const raw = String(r0.datetime || t0.time || r0.check_url_time || '');
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(?:Z|([+-]\d{2}):?(\d{2}))?/);
    if (m) { const d = new Date(m[1] + 'T' + m[2] + ':' + (m[3] || '00') + (m[4] ? m[4] + ':' + m[5] : 'Z')); if (!isNaN(d.getTime())) return d.toISOString(); }
  } catch (e) {}
  return new Date().toISOString();
};
// "15:58 UTC on 2026-10-11"
const obsClock = (iso) => { const d = iso ? new Date(iso) : null; if (!d || isNaN(d.getTime())) return 'an unknown time'; const z = d.toISOString(); return z.slice(11, 16) + ' UTC on ' + z.slice(0, 10); };
// obs: [{ seen: true | false | null, at: iso, source }] -> { count, seen, text }; null = that check could not read the results page (not counted)
const aioObserved = (obs) => {
  const known = (obs || []).filter(o => o && o.seen != null);
  if (!known.length) return { count: 0, seen: 0, text: 'unknown — the results page could not be read' };
  const seen = known.filter(o => o.seen);
  const one = (o) => (o.seen ? 'seen' : 'not seen') + ' in the check at ' + obsClock(o.at) + (o.source ? ' (' + o.source + ')' : '');
  if (known.length === 1) return { count: 1, seen: seen.length, text: one(known[0]) + ' — AI Overviews vary between searches, so this is one observation, not a fixed feature of the query' };
  return { count: known.length, seen: seen.length, text: 'seen in ' + seen.length + ' of ' + known.length + ' checks (' + known.map(one).join('; ') + ') — AI Overviews vary between searches' };
};
// Turns the raw competitor pages into (1) a per-competitor digest for the analyst, (2) a TERM MODEL — the words and
// phrases most top pages share (what the topic is "made of"), (3) the questions competitors answer, (4) the statistics
// they cite, plus the SERP features from the same search. Longer excerpts than v3 (9,000 chars kept per page).
// 2026-10-11 (FIX_PLAN D26): the AI Overview is reported as an observation with its time ("seen in the check at 15:58 UTC on …; AI Overviews
// vary between searches"), never as a fact about the query (serp_features.ai_overview.seen_at, serp_features.checked_at).
let input;
try { input = $('Collect Client Pages').first().json; } catch (e) { input = $('Collect Site URLs').first().json; }
const meta = $('Pick Top 6').all();
const pages = $('Read Competitor Pages').all().map(i => ({ json: i.json || {} }));
// pages that were blocked on the first read and recovered through the browser-engine retry replace the blocked ones
let retried_pages = 0;
try {
  const retried = $('Retry Blocked Pages').all();
  const items = $('Blocked Page Items').all().map(i => i.json);
  retried.forEach((r, k) => {
    const idx = items[k] ? items[k].index : null; const rj = r.json || {}; const raw = String(rj.page_text || rj.data || '');
    if (idx == null || rj.error || raw.split(/\s+/).length < 120 || /captcha|cloudflare ray id|access denied|just a moment|verify you are human/i.test(raw.slice(0, 1500))) return;
    pages[idx] = { json: { ...rj, retried: true } }; retried_pages++;
  });
} catch (e) {}

const competitors = [];
const failed = [];
const stripMd = (s) => String(s || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[\s*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+/g, '').replace(/[*_`]+/g, '').replace(/[ \t]+/g, ' ').trim();
const junk = /cookie|consent|privacy|opt[- ]?out|personal (data|information)|gdpr|advertising|storage related|targeted|all rights reserved|copyright|©|trademark|terms (&|and) conditions|opens in a new (tab|window)|follow us|sign in|sign up|log in|register for free|create an account|password|download the app|lost network connectivity|javascript|browser settings|newsletter|subscribe|view all|happy to accept|save my preferences|^description |^duration /i;

pages.forEach((p, i) => {
  const j = p.json || {};
  const info = meta[i]?.json || {};
  const raw = String(j.page_text || j.data || j.body || '');
  if (info.no_competitors && !info.url) return;   // Pick Top 6's "nothing to read" placeholder is not a failed page
  if (j.error || !raw || !info.url) { failed.push({ url: info.url, reason: j.error ? (j.error.message || JSON.stringify(j.error)).slice(0, 150) : 'Empty response' }); return; }
  const lines = raw.replace(/^(Title|URL Source|Markdown Content|Published Time):.*$/gm, '').split('\n');
  const headings = [...new Set(lines.filter(l => /^#{1,3}\s/.test(l.trim())).map(l => { const level = l.trim().match(/^#+/)[0].length; return 'H' + level + ': ' + stripMd(l.replace(/^#+\s*/, '')); }).filter(h => h.length > 5 && !junk.test(h)))].slice(0, 30);
  const seenLines = new Set();
  const body = lines.map(l => l.trim()).filter(l => {
    const isHeading = /^#{1,6}\s/.test(l);
    const clean = stripMd(l.replace(/^[*\-•]\s*/, '').replace(/^#+\s*/, ''));
    if (!clean || junk.test(clean)) return false;
    if (!isHeading && clean.split(/\s+/).length < 6) return false;
    const key = clean.toLowerCase(); if (seenLines.has(key)) return false; seenLines.add(key); return true;
  }).map(l => /^#{1,6}\s/.test(l) ? '\n## ' + stripMd(l.replace(/^#+\s*/, '')) : stripMd(l.replace(/^[*\-•]\s*/, ''))).join('\n')
    .replace(/(\n## [^\n]+)(?=\n## |\s*$)/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const blocked = /captcha|cloudflare ray id|access denied|just a moment/i.test(raw.slice(0, 800));
  const words = body.split(/\s+/).filter(Boolean).length;
  if (blocked || words < 80) { failed.push({ url: info.url, reason: blocked ? 'Blocked by CAPTCHA / bot protection' : `Too little text (${words} words)` }); return; }
  const has_author = /\b(by|author|written by|reviewed by)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(raw.slice(0, 3000)) || /Published Time:/.test(raw);
  const has_date = /\b(20[12]\d)\b/.test(raw.slice(0, 2500));
  competitors.push({ rank: info.rank, url: info.url, domain: info.domain, title: info.title, snippet: info.snippet, word_count: words, headings,
    has_author, has_date, lists: (body.match(/^\s*(\d+\.|[-*•])\s/gm) || []).length, tables: (raw.match(/^\|.*\|$/gm) || []).length,
    content: body.slice(0, 4500), content_full: body.slice(0, 9000) });
});
competitors.splice(6);
const avg = competitors.length ? Math.round(competitors.reduce((s, c) => s + c.word_count, 0) / competitors.length) : 1500;

// ---------- term model (1-3 word phrases shared by at least half of the competitors) ----------
const STOP = new Set('a an the and or but if then else when while of for to in on at by with from as is are was were be been being it its this that these those they them their there here you your we our us i me my he she his her which who whom whose what where why how all any each few more most other some such no nor not only own same so than too very can will just do does did done have has had having would could should may might must shall into over under again further about above below between through during before after out off up down also because until while both per via etc'.split(' '));
// generic business words are useless as single terms (they still count inside multi-word phrases)
const GENERIC = new Set('business businesses company companies help helps helping solution solutions need needs needed project projects team teams time times way ways work works working use used using make makes making get gets getting provide provides providing ensure ensures right best better good great new different important service services year years day days people thing things lot part parts number including based also well like one two three first second many much more most every able high low large small long key main specific several various within across throughout during ahead forward often always free full end top type types level levels example examples case cases result results option options area areas point points plan plans today experience experienced expert experts professional professionals partner partners client clients customer customers organization organizations organisation organisations industry industries process processes system systems software contact learn read'.split(' '));
const tokens = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(w => w && w.length > 2 && !/^\d+$/.test(w)).slice(0, 3500);
const grams = (toks) => { const g = new Map(); const add = (s) => g.set(s, (g.get(s) || 0) + 1);
  for (let i = 0; i < toks.length; i++) { const a = toks[i]; if (!STOP.has(a)) add(a);
    if (i + 1 < toks.length) { const b = toks[i + 1]; if (!STOP.has(a) && !STOP.has(b)) add(a + ' ' + b);
      if (i + 2 < toks.length) { const c = toks[i + 2]; if (!STOP.has(a) && !STOP.has(c)) add(a + ' ' + b + ' ' + c); } } }
  return g; };
const docs = competitors.map(c => grams(tokens(c.content_full)));
const df = new Map(), tf = new Map();
docs.forEach(g => { for (const [k, v] of g) { df.set(k, (df.get(k) || 0) + 1); tf.set(k, (tf.get(k) || 0) + v); } });
const minDocs = Math.max(2, Math.ceil(docs.length / 2));
const kwToks = new Set(tokens(input.keyword));
const ranked = [...df.entries()].filter(([k, n]) => n >= minDocs)
  .map(([k, n]) => ({ term: k, docs: n, avg_count: +(tf.get(k) / n).toFixed(1), words: k.split(' ').length }))
  .filter(t => !t.term.split(' ').every(w => kwToks.has(w)) && !/^(\w+) \1$/.test(t.term) && !(t.words === 1 && GENERIC.has(t.term)))
  .sort((a, b) => b.words - a.words || b.docs - a.docs || b.avg_count - a.avg_count);   // longer phrases first
// keep a phrase only if no longer phrase already kept contains it with the same reach (avoids data / cloud data / cloud data support)
const term_model = [];
for (const t of ranked) {
  if (term_model.some(k => k.docs >= t.docs && (' ' + k.term + ' ').includes(' ' + t.term + ' '))) continue;
  term_model.push(t);
}
term_model.sort((a, b) => b.docs - a.docs || b.avg_count - a.avg_count);
const uni = term_model.filter(t => t.words === 1).slice(0, 12), multi = term_model.filter(t => t.words > 1).slice(0, 28);
term_model.splice(0, term_model.length, ...multi.sort((a, b) => b.docs - a.docs || b.avg_count - a.avg_count), ...uni.sort((a, b) => b.docs - a.docs || b.avg_count - a.avg_count));   // phrases first, then single words

// ---------- questions competitors answer, statistics they cite ----------
const competitor_questions = [...new Set(competitors.flatMap(c => c.headings.map(h => h.replace(/^H\d: /, '')).filter(h => /\?$/.test(h) || /^(how|what|why|when|which|where|who|can|do|does|is|are|should)\b/i.test(h))))].slice(0, 15);
const stats_seen = [];
for (const c of competitors) {
  const sents = c.content_full.split(/(?<=[.!?])\s+/);
  for (const s of sents) {
    if (stats_seen.length >= 15) break;
    if (/\d/.test(s) && /(%|percent|\$|€|£|aed|sar|pkr|inr|million|billion|thousand|\bhours?\b|\bdays?\b|\bweeks?\b|\bmonths?\b|\byears?\b)/i.test(s) && s.length > 40 && s.length < 260) stats_seen.push({ domain: c.domain, text: s.trim() });
  }
}

// ---------- SERP features (from the same SERP call) ----------
// 2026-10-09: the answer of the retry when the first call failed; a failed call (DataForSEO 50000 "Internal Server Error." with
// HTTP 200, or an HTTP error) is "unavailable", never "no featured snippet / no AI Overview" (the verdict used to claim that).
let serpItems = []; let seCount = null; let serpError = ''; let seenAt = new Date().toISOString();
// R18 (2026-10-14): the first answer and the retry's, judged by the one shared rule (RT, v5/code/_dfs_retry.js). A task error inside
// an HTTP 200 is a failure, whatever its number — the 50000-only test of section 25 let 40101 through twice in execution 549.
let serpStats = { asked: 1, answered: 0, failed: 1, failed_first: 1, retried: 0, retry_answered: 0, reasons: ['no answer'], answers: [{}] };
try {
  const first0 = (() => { try { return $('SERP Top 10').first().json; } catch (e) { return null; } })();
  const retry0 = (() => { try { return $('SERP Top 10 (Retry)').first().json; } catch (e) { return null; } })();
  serpStats = RT.one(first0, retry0);
  const sj = serpStats.answers[0] || {}; const t0 = (Array.isArray(sj.tasks) ? sj.tasks[0] : null) || {};
  if (serpStats.failed) serpError = String(serpStats.reasons[0] || 'no answer').slice(0, 160);
  const res = (t0.result || [])[0] || {}; serpItems = res.items || []; seCount = res.se_results_count ?? null; seenAt = serpSeenAt(sj);
} catch (e) { serpItems = []; serpError = 'no answer'; }
const serp_evidence = RT.evidence('the live Google results for this keyword', serpStats, { unit: 'search' });
const norm = (d) => String(d || '').toLowerCase().replace(/^www\./, '');
const paa = [], related = [], forum = []; let featured = null, aio = null; const featureTypes = new Set();
for (const it of serpItems) {
  featureTypes.add(it.type);
  if (it.type === 'people_also_ask') (it.items || []).forEach(q => { const t = q.title || q.question || ''; if (t && !paa.includes(t)) paa.push(t); });
  else if (it.type === 'related_searches') (it.items || []).forEach(q => { const t = typeof q === 'string' ? q : (q.title || q.keyword || ''); if (t && !related.includes(t)) related.push(t); });
  else if (it.type === 'discussions_and_forums') (it.items || []).forEach(q => { const t = q.title || ''; if (t) forum.push({ title: t, source: norm(q.domain || q.source || ''), url: q.url || '' }); });
  else if (it.type === 'featured_snippet' && !featured) featured = { domain: norm(it.domain), title: it.title || '', text: String(it.description || it.text || '').slice(0, 400), url: it.url || '' };
  else if (it.type === 'ai_overview' && !aio) {
    const texts = []; (it.items || []).forEach(x => { if (x.text) texts.push(x.text); if (x.title) texts.push(x.title); });
    const refs = []; (it.references || []).forEach(r => refs.push(norm(r.domain || String(r.url || '').replace(/^https?:\/\//, '').split('/')[0])));
    (it.items || []).forEach(x => (x.references || []).forEach(r => refs.push(norm(r.domain || String(r.url || '').replace(/^https?:\/\//, '').split('/')[0]))));
    aio = { present: true, text: texts.join(' ').slice(0, 800), cited_domains: [...new Set(refs.filter(Boolean))].slice(0, 12), seen_at: seenAt };
  }
}
const serp_features = { se_results_count: seCount, checked_at: seenAt, people_also_ask: paa.slice(0, 12), related_searches: related.slice(0, 10), forum_threads: forum.slice(0, 6),
  featured_snippet: featured, ai_overview: aio || { present: false, text: '', cited_domains: [], seen_at: seenAt }, features_present: [...featureTypes].filter(t => t !== 'organic'),
  video_results: featureTypes.has('video'), shopping_results: featureTypes.has('shopping') || featureTypes.has('popular_products'), local_pack: featureTypes.has('local_pack') || featureTypes.has('map') };
if (serpError) Object.assign(serp_features, { unavailable: true, error: serpError, ai_overview: { present: null, text: '', cited_domains: [], seen_at: null } });
Object.assign(serp_features, { attempts: 1 + (serpStats.retried || 0), retried: !!serpStats.retried });
const aioText = aioObserved([{ seen: serp_features.ai_overview.present, at: seenAt, source: 'live Google results' }]).text;

const digest = competitors.map(c => `\n=== COMPETITOR #${c.rank}: ${c.domain} ===\nURL: ${c.url}\nTitle: ${c.title}\nMeta Description: ${c.snippet}\nUseful Word Count: ${c.word_count} · Named author: ${c.has_author ? 'yes' : 'no'} · Dated: ${c.has_date ? 'yes' : 'no'} · Lists: ${c.lists} · Tables: ${c.tables}\nHeadings:\n${c.headings.join('\n')}\n\nContent Excerpt:\n${c.content}\n`).join('\n');
const serpDigest = serpError ? 'LIVE GOOGLE RESULTS: unavailable for this run (the search data provider failed' + (serpStats.retried ? ', twice: the search was sent again once and failed again' : '') + ': ' + serpError + '). There is no information about the pages in the top 10, a featured snippet, People Also Ask or an AI Overview for this query: do not state or assume whether any of them appear, and say that the results page could not be checked.' : [
  featured ? `FEATURED SNIPPET (held by ${featured.domain}): "${featured.text}"` : 'FEATURED SNIPPET: none',
  'AI OVERVIEW: ' + aioText + (serp_features.ai_overview.present ? `. In that check it cited ${serp_features.ai_overview.cited_domains.join(', ') || 'unknown sources'}. Summary: ${serp_features.ai_overview.text.slice(0, 500)}` : '') + ' Do not write "there is no AI Overview" or "an AI Overview takes the clicks" as a fact: say what was seen and when.',
  paa.length ? 'PEOPLE ALSO ASK:\n- ' + paa.slice(0, 12).join('\n- ') : 'PEOPLE ALSO ASK: none',
  related.length ? 'RELATED SEARCHES: ' + related.slice(0, 10).join(' | ') : '',
  forum.length ? 'FORUM THREADS ON PAGE 1: ' + forum.map(f => f.title + ' (' + f.source + ')').join(' | ') : '',
  'OTHER SERP FEATURES: ' + (serp_features.features_present.join(', ') || 'none')
].filter(Boolean).join('\n');
const termDigest = term_model.slice(0, 30).map(t => `${t.term} (${t.docs}/${competitors.length} pages, ~${t.avg_count}x)`).join('; ');

return [{ json: { ...input, competitors, competitors_read: competitors.length, retried_pages, avg_competitor_words: avg, failed_pages: failed, serp_evidence,
  competitor_digest: digest, serp_features, serp_digest: serpDigest, term_model, term_digest: termDigest, competitor_questions, stats_seen } }];
