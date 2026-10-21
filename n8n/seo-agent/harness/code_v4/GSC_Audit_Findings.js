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
// ---- the daily key-page watch and Google's view of those pages (G11 + G25, 2026-10-13; system review FIX_PLAN.md) ----
// G11: a monthly audit cannot see a page that went noindex on the 3rd. Every day the key pages are fetched raw and cheaply (one plain GET
// each, no JavaScript, no paid API) and compared with what we stored: HTTP status, a redirect that appeared, `noindex`, the canonical, the
// title - plus a hash of robots.txt per site. A change that matters raises an alert the same day; an unchanged page raises none.
// G11's second half: when somebody presses "I fixed this" in the app on an audit finding, that one finding is re-checked on these pages
// within a day instead of waiting for the next monthly audit (PW.recheck).
// G25: Search Console's URL Inspection API says what *Google* thinks of a page - indexed or not, which canonical it chose, when it last
// crawled it, mobile usability and rich results. Its quota is 2,000 queries a day and 600 a minute per property, so the pages rotate
// (never inspected first, then the oldest inspection) and whatever the budget does not reach is reported as "not checked", never as fine.
const PW = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the n8n Code sandbox has no URL constructor (live finding 2026-10-02), so hosts and paths are read with regexes
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/#.*$/, ''); return p || '/'; };
  // host-agnostic identity of a URL: crawls, sitemaps and canonicals disagree about www and the trailing slash
  const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '') || S(u).toLowerCase();
  const same = (a, b) => !!a && !!b && ukey(a) === ukey(b);
  // the shared entity decoder, inlined (v5/code/_entities.js; build section 122 asserts the two stay identical): named, decimal and hex, one pass
  const entDecode = /*__ENT_BEGIN__*/(() => {
  const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
  return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
    if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
    const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
  });
})()/*__ENT_END__*/;
  const strip = (s) => entDecode(S(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

  // ---- a small, stable fingerprint (FNV-1a, 32 bit): no crypto module is available in the sandbox ----
  const hash = (text) => {
    const t = S(text); let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  };

  // ---- what one raw fetch tells us about a page ----
  // `res` is an n8n HTTP Request answer with fullResponse + responseFormat text (so the body is under `data`, not `body`) and redirects NOT
  // followed: a key page that starts redirecting is itself a change worth knowing about.
  const signals = (res) => {
    const r = res || {};
    const status = n0(r.statusCode ?? r.status);
    const headers = r.headers || {};
    const hdr = (name) => { const k = Object.keys(headers).find(x => x.toLowerCase() === name); return k ? S(Array.isArray(headers[k]) ? headers[k].join(', ') : headers[k]) : ''; };
    const body = S(r.body ?? r.data);
    const failed = !status && (r.error || !body);
    if (failed) return { ok: false, error: S((r.error && (r.error.message || r.error.description)) || r.error || 'no answer').slice(0, 200), status: 0 };
    const xrobots = hdr('x-robots-tag');
    const head = body.slice(0, 200000);
    const metas = head.match(/<meta\b[^>]*>/gi) || [];
    const metaOf = (name) => {
      for (const m of metas) {
        if (!new RegExp('\\b(?:name|property)\\s*=\\s*["\']?' + name + '["\']?', 'i').test(m)) continue;
        const c = m.match(/\bcontent\s*=\s*"([^"]*)"/i) || m.match(/\bcontent\s*=\s*'([^']*)'/i) || m.match(/\bcontent\s*=\s*([^\s>]+)/i);
        if (c) return S(c[1]);
      }
      return '';
    };
    const robotsMeta = metaOf('robots') || metaOf('googlebot');
    const noindex = /\bnone\b|\bnoindex\b/i.test(robotsMeta) || /\bnone\b|\bnoindex\b/i.test(xrobots);
    const titles = (head.match(/<title[^>]*>[\s\S]*?<\/title>/gi) || []).map(t => strip(t.replace(/<\/?title[^>]*>/gi, '')));
    const canonRe = /<link\b[^>]*\brel\s*=\s*["']?canonical["']?[^>]*>/gi;
    const canons = (head.match(canonRe) || []).map(l => { const h = l.match(/\bhref\s*=\s*"([^"]*)"/i) || l.match(/\bhref\s*=\s*'([^']*)'/i); return h ? S(h[1]) : ''; }).filter(Boolean);
    const h1s = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map(x => strip(x).slice(0, 200)).filter(Boolean);
    return {
      ok: true, status,
      location: status >= 300 && status < 400 ? S(hdr('location')).slice(0, 500) : '',
      noindex, noindex_source: noindex ? (/\bnone\b|\bnoindex\b/i.test(robotsMeta) ? 'meta robots' : 'X-Robots-Tag header') : '',
      robots_meta: robotsMeta.slice(0, 120), canonical: (canons[0] || '').slice(0, 500), canonicals: canons.length,
      title: (titles[0] || '').slice(0, 300), titles: titles.length, description: metaOf('description').slice(0, 400),
      h1: (h1s[0] || ''), h1s: h1s.length, bytes: body.length, error: '',
    };
  };

  // ---- robots.txt: the fingerprint (seo_cache) plus the rules that decide whether a key page is crawlable ----
  const robotsRead = (res) => {
    const r = res || {}; const status = n0(r.statusCode ?? r.status); const text = S(r.body ?? r.data);
    if (!status) return { ok: false, status: 0, error: S((r.error && (r.error.message || r.error.description)) || r.error || 'no answer').slice(0, 200), hash: '', rules: [] };
    const clean = text.replace(/\r/g, '').split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean).join('\n');
    const rules = []; let groups = [];
    for (const line of clean.split('\n')) {
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
      const field = m[1].toLowerCase(), value = S(m[2]);
      if (field === 'user-agent') { if (rules.length && rules[rules.length - 1].touched) { groups = []; } groups.push(value.toLowerCase()); rules.push({ agents: groups.slice(), touched: false }); continue; }
      if (field !== 'disallow' && field !== 'allow') continue;
      if (!rules.length) { groups = ['*']; rules.push({ agents: ['*'], touched: false }); }
      const g = rules[rules.length - 1]; g.touched = true; g.agents = groups.slice();
      (g.lines = g.lines || []).push({ allow: field === 'allow', path: value });
    }
    // which groups apply to Googlebot (its own group wins over `*`, as Google's parser does)
    const forGoogle = rules.filter(g => g.agents.some(a => a === 'googlebot'));
    const applies = (forGoogle.length ? forGoogle : rules.filter(g => g.agents.includes('*'))).flatMap(g => g.lines || []);
    const blocks = (url) => {
      if (status === 404 || status >= 500 || !applies.length) return null;   // no file, or nothing that applies: nothing is blocked by it
      const p = pathOf(url);
      let best = null;
      for (const l of applies) {
        if (!l.path) continue;                                              // `Disallow:` with no path allows everything
        const pat = l.path.replace(/\*+/g, '*');
        const rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
        if (!rx.test(p)) continue;
        if (!best || l.path.length > best.path.length) best = l;
      }
      return best ? !best.allow : false;
    };
    return { ok: true, status, hash: hash(clean), length: clean.length, rules: applies, blocks, error: '' };
  };

  // ---- what changed since the stored reading, and how loudly to say it ----
  // `prev` is the stored seo_page_watch row (or null for a page nobody has watched yet), `now` the signals of this run.
  const CODES = {
    page_gone: { severity: 'critical', label: 'page gone' },
    page_error: { severity: 'critical', label: 'server error' },
    noindex_added: { severity: 'critical', label: 'noindex added' },
    robots_blocked: { severity: 'critical', label: 'blocked by robots.txt' },
    page_redirects: { severity: 'high', label: 'page now redirects' },
    canonical_moved: { severity: 'high', label: 'canonical moved' },
    canonical_removed: { severity: 'high', label: 'canonical removed' },
    robots_changed: { severity: 'high', label: 'robots.txt changed' },
    title_changed: { severity: 'medium', label: 'title changed' },
    page_back: { severity: 'info', label: 'page answers again' },
    noindex_removed: { severity: 'info', label: 'noindex gone' },
  };
  const compare = (prev, now, o) => {
    const opts = o || {}; const out = [];
    const add = (code, text, from, to) => out.push({ code, severity: CODES[code].severity, label: CODES[code].label, text, from: S(from), to: S(to) });
    if (!now || now.ok === false) return out;                                 // a failed fetch is "not checked", never a change
    const first = !prev || !S(prev.checked_at);
    const was = prev || {};
    const wasStatus = n0(was.status), nowStatus = n0(now.status);
    const url = S(opts.url);
    if (!first) {
      if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 500) add('page_error', 'The page answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 400) add('page_gone', 'The page is gone: it answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 400 && nowStatus >= 200 && nowStatus < 300) add('page_back', 'The page answers ' + nowStatus + ' again (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      if (nowStatus >= 300 && nowStatus < 400 && !(wasStatus >= 300 && wasStatus < 400)) add('page_redirects', 'The page now redirects (' + nowStatus + ' to ' + (S(now.location) || 'an address it does not name') + ')', wasStatus, nowStatus + ' ' + S(now.location));
      if (now.noindex && !was.noindex) add('noindex_added', 'The page tells search engines not to index it (' + S(now.noindex_source) + ': "' + S(now.robots_meta || 'noindex') + '")', '', S(now.noindex_source));
      if (!now.noindex && was.noindex) add('noindex_removed', 'The page no longer tells search engines to leave it out', S(was.noindex_source), '');
      // the title and the canonical are only compared between two readings of a page that was answering: the title of yesterday's 404
      // ("Not found") is not a baseline, so a page that comes back is "answers again", never "the title changed".
      const wasOk = wasStatus >= 200 && wasStatus < 300;
      if (wasOk && nowStatus >= 200 && nowStatus < 300) {
        if (S(was.canonical) && !S(now.canonical)) add('canonical_removed', 'The canonical tag is gone (it pointed at ' + S(was.canonical) + ')', S(was.canonical), '');
        else if (S(now.canonical) && S(was.canonical) && !same(now.canonical, was.canonical)) add('canonical_moved', 'The canonical now points at ' + S(now.canonical) + ' (it pointed at ' + S(was.canonical) + ')', S(was.canonical), S(now.canonical));
        if (S(was.title) && S(now.title) && S(was.title) !== S(now.title)) add('title_changed', 'The title changed to "' + S(now.title) + '" (it was "' + S(was.title) + '")', S(was.title), S(now.title));
      }
    }
    // a page we are seeing for the first time is a baseline, never a change — that includes one robots.txt already blocked before we looked
    if (!first && opts.robots_blocked === true && opts.robots_blocked_before !== true) add('robots_blocked', 'robots.txt now stops Google crawling ' + (url || 'this page'), '', 'disallowed');
    return out;
  };
  // the site's robots.txt as a change of its own (one per site, compared with the stored seo_cache fingerprint)
  const robotsChange = (prevHash, robots) => {
    if (!robots || robots.ok === false) return null;
    const before = S(prevHash);
    if (!before || before === S(robots.hash)) return null;
    return { code: 'robots_changed', severity: CODES.robots_changed.severity, label: CODES.robots_changed.label,
      text: 'robots.txt changed (' + robots.status + ', ' + n0(robots.length) + ' characters of rules). Read it before the next crawl: one wrong Disallow line can take the whole site out of Google.',
      from: before, to: S(robots.hash) };
  };
  const state = (changes, now) => (!now || now.ok === false) ? 'not_checked' : ((changes || []).some(c => c.severity !== 'info') ? 'changed' : 'ok');
  const worst = (changes) => { const order = ['critical', 'high', 'medium', 'info']; return (changes || []).map(c => c.severity).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || ''; };

  // ---- "I fixed this": one audit finding, re-checked on the key pages we just fetched ----
  // Only what a raw fetch of the key pages can honestly answer is answered. Anything else (a crawl of the whole site, Search Console,
  // speed data) says so and waits for the audit - it never comes back "fixed" on a guess.
  const RULES = [
    { rule: 'broken_pages', re: /broken pages|do not return 200|not return 200|4xx|5xx/i, label: 'a key page that does not answer 200',
      test: (p) => n0(p.status) >= 400 },
    { rule: 'redirecting_pages', re: /internal urls that redirect|meta refresh/i, label: 'a key page that redirects',
      test: (p) => n0(p.status) >= 300 && n0(p.status) < 400 },
    { rule: 'noindex', re: /noindex|not indexable/i, label: 'a key page that asks not to be indexed', test: (p) => !!p.noindex },
    { rule: 'robots_blocked', re: /blocked by robots\.txt/i, label: 'a key page robots.txt blocks', test: (p) => p.robots_blocked === true },
    { rule: 'missing_title', re: /missing title tag/i, label: 'a key page with no title', test: (p) => n0(p.status) < 300 && !S(p.title) },
    { rule: 'multiple_titles', re: /more than one title tag/i, label: 'a key page with more than one title tag', test: (p) => n0(p.titles) > 1 },
    { rule: 'title_short', re: /title shorter than/i, label: 'a key page title under 30 characters', test: (p) => n0(p.status) < 300 && S(p.title) && S(p.title).length < 30 },
    { rule: 'title_long', re: /title longer than/i, label: 'a key page title over 60 characters', test: (p) => S(p.title).length > 60 },
    { rule: 'missing_description', re: /missing meta description/i, label: 'a key page with no meta description', test: (p) => n0(p.status) < 300 && !S(p.description) },
    { rule: 'description_short', re: /meta description shorter than/i, label: 'a key page description under 70 characters', test: (p) => n0(p.status) < 300 && S(p.description) && S(p.description).length < 70 },
    { rule: 'description_long', re: /meta description longer than/i, label: 'a key page description over 160 characters', test: (p) => S(p.description).length > 160 },
    { rule: 'missing_h1', re: /missing h1/i, label: 'a key page with no H1', test: (p) => n0(p.status) < 300 && !S(p.h1) },
    { rule: 'multiple_h1', re: /more than one h1/i, label: 'a key page with more than one H1', test: (p) => n0(p.h1s) > 1 },
    { rule: 'missing_canonical', re: /missing canonical tag/i, label: 'a key page with no canonical tag', test: (p) => n0(p.status) < 300 && !S(p.canonical) },
    { rule: 'canonical_other', re: /canonical points to a different page/i, label: 'a key page whose canonical points elsewhere',
      test: (p) => n0(p.status) < 300 && S(p.canonical) && !same(p.canonical, p.url) },
    { rule: 'http_pages', re: /served over http\b|link to http urls/i, label: 'a key page on http', test: (p) => /^http:\/\//i.test(S(p.url)) },
  ];
  const recheckRule = (finding) => {
    const text = S((finding || {}).title) || S((finding || {}).finding_key).split('|').slice(1).join('|');
    if (!text) return null;
    return RULES.find(r => r.re.test(text)) || null;
  };
  /** finding + the pages this run read -> { state: 'fixed' | 'still_open' | 'not_checked', note, checked, hits } */
  const recheck = (finding, pages) => {
    const list = (pages || []).filter(p => p && p.ok !== false && S(p.url) && S(p.kind) !== 'robots');
    const r = recheckRule(finding);
    const title = S((finding || {}).title) || S((finding || {}).finding_key);
    if (!r) return { state: 'not_checked', rule: '', checked: list.length, hits: [],
      note: 'The daily key-page watch cannot judge "' + title + '" on its own (it needs the full crawl, Search Console or speed data). The next audit decides it.' };
    if (!list.length) return { state: 'not_checked', rule: r.rule, checked: 0, hits: [],
      note: 'No key page could be read in this check, so nothing was judged. It is tried again with the next daily watch.' };
    const hits = list.filter(p => { try { return !!r.test(p); } catch (e) { return false; } }).map(p => S(p.url));
    return hits.length
      ? { state: 'still_open', rule: r.rule, checked: list.length, hits: hits.slice(0, 10),
          note: 'Still open on ' + hits.length + ' of the ' + list.length + ' key pages checked (' + r.label + '): ' + hits.slice(0, 3).join(', ') + (hits.length > 3 ? ' …' : '') + '.' }
      : { state: 'fixed', rule: r.rule, checked: list.length, hits: [],
          note: 'Fixed on the ' + list.length + ' key pages checked (no ' + r.label + ' left). The next full audit checks the rest of the site.' };
  };

  // ---- B5-8 (2026-10-15, benchmark area 5): what we already know changed, and what that orders ----
  // Ahrefs' Always-On Audit picks the next URL to re-crawl partly from IndexNow pings (ahrefs.com/blog/always-on-audit). We OPERATE
  // IndexNow for the customer (v4.12) and we write their pages ourselves, so we hold the same signal and used it for nothing: the
  // queues were ordered "oldest reading first", which puts the page we changed on Monday behind a page nobody has touched in a year.
  // Three free signals, all already stored:
  //   * seo_ai_pages.submitted_at / submitted_via  - the IndexNow and Bing submissions AI Growth makes every week
  //   * seo_content_log.published_at / started_at  - the published-page log (what the Content Cadence wrote, and when it went live)
  //   * seo_ai_targets.written_at                  - the AI answer / refresh pages
  // INVARIANTS rule 1 lives in the return value: a table that could NOT be read is `not_read` with its reason, which is not the same
  // answer as "nothing changed this week", and every consumer prints whichever of the two it got.
  const FRESH_DAYS = 7;
  const CHANGE_LABEL = { indexnow: 'submitted to IndexNow', bing: 'submitted to Bing', published: 'published', written: 'written' };
  const changedPages = (sources, o) => {
    const opts = o || {};
    const days = Math.max(1, n0(opts.days) || FRESH_DAYS);
    const nowMs = Date.parse(S(opts.now)) || Date.now();
    const cutoff = nowMs - days * 864e5;
    const map = new Map(); const sources_read = []; const not_read = [];
    for (const src of (sources || [])) {
      const name = S(src && src.name) || 'a stored table';
      if (!src || src.read === false) { not_read.push({ source: name, reason: S(src && src.reason) || 'the table could not be read in this run' }); continue; }
      let used = 0;
      for (const r of (src.rows || [])) {
        const url = S(src.url ? src.url(r) : r.url);
        const ts = Date.parse(S(src.at ? src.at(r) : r.updated_at));
        if (!/^https?:\/\//i.test(url) || !Number.isFinite(ts) || ts < cutoff || ts > nowMs + 864e5) continue;
        const kind = S(src.kind ? src.kind(r) : src.default_kind) || 'written';
        const k = ukey(url); const prev = map.get(k);
        if (!prev || ts > prev.ts) map.set(k, { url, ts, at: new Date(ts).toISOString().slice(0, 10), kind, label: CHANGE_LABEL[kind] || kind, source: name });
        used += 1;
      }
      sources_read.push({ source: name, rows: (src.rows || []).length, within_window: used });
    }
    const read = sources_read.length > 0;
    const count = map.size;
    const basis = !read
      ? 'not available: none of the recent-change signals could be read in this run (' + (not_read.map(x => x.source + ' - ' + x.reason).join('; ') || 'no source was offered') + ')'
      : count
        ? 'measured: ' + count + ' page(s) we submitted or wrote in the last ' + days + ' days, from ' + sources_read.map(x => x.source).join(' + ')
          + (not_read.length ? ' (' + not_read.map(x => x.source + ' could not be read: ' + x.reason).join('; ') + ')' : '')
        : 'measured: no page was submitted or written in the last ' + days + ' days by the signals we hold (' + sources_read.map(x => x.source).join(' + ') + ')'
          + (not_read.length ? '; ' + not_read.map(x => x.source + ' could not be read: ' + x.reason).join('; ') : '');
    return { map, read, count, window_days: days, as_of: new Date(nowMs).toISOString().slice(0, 10), sources_read, not_read, basis,
      pages: [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, 25).map(p => ({ url: p.url, at: p.at, kind: p.kind, label: p.label, source: p.source })) };
  };
  /** The freshness of one URL against a changedPages() result, or null when nothing is known about it. */
  const changeOf = (changed, url) => (changed && changed.map && changed.map.get(ukey(url))) || null;
  /**
   * B5-8: puts the pages we know changed at the front of a queue and leaves the rest in the order they arrived.
   * `then` is the queue's own comparator, so the existing order survives underneath. Returns the sentence a report prints:
   * a signal that could not be read NEVER reads as "nothing changed".
   */
  const freshFirst = (list, changed, o) => {
    const opts = o || {};
    const then = typeof opts.then === 'function' ? opts.then : () => 0;
    const ts = (p) => { const c = changeOf(changed, p && p.url); return c ? c.ts : 0; };
    const ordered = (list || []).slice().sort((a, b) => (ts(b) - ts(a)) || then(a, b));
    const first = ordered.filter(p => ts(p) > 0);
    const days = (changed && changed.window_days) || FRESH_DAYS;
    const order = S(opts.order) || 'oldest reading first';
    const note = !changed ? ''
      : !changed.read ? 'The pages we know changed could not be read in this run, so the order is the usual one: ' + order + '.'
        : first.length ? first.length + ' page(s) we submitted or wrote in the last ' + days + ' days are checked first ('
            + first.slice(0, 3).map(p => { const c = changeOf(changed, p.url); return pathOf(p.url) + ' ' + c.label + ' ' + c.at; }).join(', ')
            + (first.length > 3 ? ', ...' : '') + '), because a page that has just changed is the page most likely to have changed again.'
          : 'No page was submitted or written in the last ' + days + ' days, so the order is the usual one: ' + order + '.';
    return { ordered, first, note, changed_known: !!(changed && changed.read), changed_count: first.length };
  };
  // ---- G25: URL Inspection within the quota ----
  const QUOTA_PER_DAY = 2000;        // Search Console URL Inspection API, per property (developers.google.com/webmaster-tools/limits)
  const QUOTA_PER_MINUTE = 600;      // the same page, per property
  const PER_RUN = 150;               // what one weekly Site Tracker run spends per property: 7.5% of the day's quota
  const PER_AUDIT = 100;             // what one audit spends (it also runs on demand, several times a day on a bad day)
  /**
   * Chooses which pages to inspect now: never inspected first, then the oldest inspection, importance breaking ties. Everything the
   * budget does not reach comes back under `skipped` so the report can say "not checked" instead of implying the page is fine.
   * pages: [{ url, weight, inspect_at }]; cap: how many this run may spend.
   */
  const inspectBudget = (pages, cap, o) => {
    const opts = o || {};
    const limit = Math.max(0, Math.min(n0(cap) || PER_RUN, QUOTA_PER_DAY - n0(opts.used)));
    const seen = new Set(); const list = [];
    for (const p of (pages || [])) { const k = ukey(p.url); if (!S(p.url) || seen.has(k)) continue; seen.add(k); list.push(p); }
    const ts = (p) => { const t = Date.parse(S(p.inspect_at)); return Number.isFinite(t) ? t : 0; };   // 0 = never inspected, so it goes first
    // B5-8 (2026-10-15): a page we submitted to IndexNow or wrote this week goes in front of the rotation - it is the one most likely
    // to have changed since Google last looked. Without that signal (or when it could not be read) the order is exactly what it was.
    const fresh = freshFirst(list, opts.changed || null,
      { then: (a, b) => ts(a) - ts(b) || n0(b.weight) - n0(a.weight) || S(a.url).localeCompare(S(b.url)), order: 'oldest inspection first' });
    const ordered = fresh.ordered;
    const take = ordered.slice(0, limit), skipped = ordered.slice(limit);
    return { take, skipped, limit, quota: QUOTA_PER_DAY, changed_first: fresh.changed_count, changed_known: fresh.changed_known, order_note: fresh.note,
      note: 'URL Inspection is capped at ' + QUOTA_PER_DAY + ' pages a day per Search Console property (Google\'s quota); this run asked about '
        + take.length + ' of ' + ordered.length + ' key pages, oldest inspection first'
        + (skipped.length ? ', so ' + skipped.length + ' are reported as "not checked" until the next run.' : '.')
        + (fresh.note ? ' ' + fresh.note : '') };
  };
  /** One URL Inspection answer -> what Google thinks. A permission or quota error is an error, never "not indexed". */
  const inspection = (res) => {
    const r = res || {};
    const ir = (r.inspectionResult || {});
    const idx = ir.indexStatusResult || null;
    const mob = ir.mobileUsabilityResult || null;
    const rich = ir.richResultsResult || null;
    const gErr = () => { const e = r.error; if (!e) return ''; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return S((inner && inner.message) || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };
    const err = r.error ? gErr() : (idx ? '' : 'no inspection result');
    const quota = /quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(err);
    const denied = /permission|forbidden|403|unauthor|invalid_grant/i.test(err);
    if (err) return { ok: false, error: err, error_kind: quota ? 'quota' : denied ? 'access' : 'error', indexed: null, verdict: '', coverage: '',
      robots: '', last_crawl: '', google_canonical: '', user_canonical: '', canonical_ok: null, canonical_host_only: false, mobile_usable: null, mobile_issues: [], mobile_verdict: '', mobile_note: '', rich_results: [], rich_verdict: '',
      not_checked: quota ? 'Google\'s daily URL Inspection quota for this property is used up: not checked today.' : denied ? 'Search Console access is missing for this property: not checked.' : 'The inspection failed: not checked (' + err + ').' };
    // R10 (2026-10-13, re-rating §3.11): Google retired the Mobile Usability report and the API now answers `VERDICT_UNSPECIFIED` with no
    // issue list for every page (45 of 45 live on 2026-10-13). That is NOT CHECKED. The live run read it as "not mobile-friendly" and raised
    // a High finding on 45 of 47 pages with empty evidence, ranked second of 60. Only a FAIL that names at least one issue is a real problem;
    // every other answer (unspecified, neutral, missing, a FAIL with nothing behind it) is unknown, with the reason said out loud.
    const mobVerdict = S(mob && mob.verdict).toUpperCase();
    const mobIssues = mob && Array.isArray(mob.issues) ? mob.issues.map(i => S(i.message) || S(i.issueType)).filter(Boolean).slice(0, 5) : [];
    const mobUsable = mobVerdict === 'PASS' ? true : (mobVerdict === 'FAIL' && mobIssues.length) ? false : null;
    const mobNote = mobUsable !== null ? ''
      : (mobVerdict === 'FAIL' ? 'Search Console reports a mobile problem without naming an issue, so mobile usability was not checked.'
        : mobVerdict === 'NEUTRAL' ? 'Search Console gave no mobile verdict for this page, so mobile usability was not checked.'
          : 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.');
    return {
      ok: true, error: '', error_kind: '', verdict: S(idx.verdict), indexed: S(idx.verdict) === 'PASS', coverage: S(idx.coverageState),
      indexing_state: S(idx.indexingState), robots: S(idx.robotsTxtState), last_crawl: S(idx.lastCrawlTime),
      google_canonical: S(idx.googleCanonical), user_canonical: S(idx.userCanonical),
      // R59 (2026-10-16): Google choosing the SAME page on the OTHER host (https://techand.ai/x for our https://www.techand.ai/x) is a
      // canonical Google did not take — `same` is host-agnostic on purpose (crawls and sitemaps disagree about www), so it called this "same
      // as ours" and the daily watch could never see the split. The host is compared here, and a host-only difference is named.
      canonical_ok: (!S(idx.googleCanonical) || !S(idx.userCanonical)) ? null : (same(idx.googleCanonical, idx.userCanonical) && hostOf(idx.googleCanonical) === hostOf(idx.userCanonical)),
      canonical_host_only: !!S(idx.googleCanonical) && !!S(idx.userCanonical) && same(idx.googleCanonical, idx.userCanonical) && hostOf(idx.googleCanonical) !== hostOf(idx.userCanonical),
      mobile_usable: mobUsable, mobile_issues: mobIssues, mobile_verdict: mobVerdict, mobile_note: mobNote,
      rich_verdict: rich ? S(rich.verdict) : '',
      rich_results: rich && rich.detectedItems ? rich.detectedItems.map(d => S(d.richResultType)).filter(Boolean) : [],
      not_checked: '',
    };
  };
  /** The index picture over a set of inspections, with what was not checked said out loud (G25). */
  const coverage = (inspections, o) => {
    const opts = o || {};
    const list = (inspections || []).filter(Boolean);
    const ok = list.filter(i => i.ok !== false && !i.error);
    const by = {}; for (const i of ok) { const k = S(i.coverage) || S(i.verdict) || 'unknown'; by[k] = (by[k] || 0) + 1; }
    const failed = list.filter(i => i.ok === false || i.error);
    const indexed = ok.filter(i => i.indexed === true).length;
    const notIndexed = ok.filter(i => i.indexed === false);
    const canonMismatch = ok.filter(i => i.canonical_ok === false);
    const mobileBad = ok.filter(i => i.mobile_usable === false);
    const richTypes = [...new Set(ok.flatMap(i => i.rich_results || []))];
    const notChecked = n0(opts.not_checked) + failed.length;
    // R10: mobile usability is reported on its own terms — how many pages Google really answered about, and the reason when it answered about none
    const mobileChecked = ok.filter(i => i.mobile_usable !== null).length;
    const mobileNote = (ok.length && !mobileChecked)
      ? (S((ok.find(i => S(i.mobile_note)) || {}).mobile_note) || 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.')
      : '';
    return { checked: ok.length, indexed, not_indexed: notIndexed.length, by_state: by, failed: failed.length, not_checked: notChecked,
      not_checked_reason: notChecked ? (S(opts.not_checked_reason) || (failed[0] && failed[0].not_checked) || 'not checked in this run') : '',
      canonical_mismatch: canonMismatch.length, mobile_bad: mobileBad.length, mobile_checked: mobileChecked,
      mobile_not_checked: ok.length - mobileChecked, mobile_note: mobileNote,
      rich_results: richTypes, quota: QUOTA_PER_DAY, quota_note: S(opts.quota_note),
      // never "fine": a page nobody inspected is counted apart from the ones Google answered about
      text: ok.length
        ? indexed + ' of ' + ok.length + ' key pages are indexed' + (notIndexed.length ? ', ' + notIndexed.length + ' are not' : '')
          + (notChecked ? ', ' + notChecked + ' were not checked' : '') + ' (Search Console URL Inspection; quota ' + QUOTA_PER_DAY + ' pages a day per property)'
        : 'No page could be inspected in Search Console' + (notChecked ? ' (' + notChecked + ' not checked: ' + (S(opts.not_checked_reason) || (failed[0] && failed[0].not_checked) || 'no access') + ')' : '') };
  };

  return { signals, robotsRead, compare, robotsChange, state, worst, recheck, recheckRule, inspectBudget, inspection, coverage, hash,
    changedPages, changeOf, freshFirst,
    CODES, RULES, QUOTA_PER_DAY, QUOTA_PER_MINUTE, PER_RUN, PER_AUDIT, FRESH_DAYS,
    helpers: { hostOf, bare, pathOf, ukey, same, strip, S, n0 } };
})();
// ---- shared Search Console query rules (2026-10-12, FIX_PLAN G9 + D24 / P1-3): inlined by the build (the GSC_QUERIES placeholder) into
// Parse GSC (the Site Tracker) and GSC Audit Findings (the audit), so the weekly report and the audit judge a query the same way.
//   * GQ.isScraper(q)  — a query typed by an SEO tool or a scraper, not by a customer (search operators, capital booleans, quoted groups).
//   * GQ.brandTest(..) — brand vs non-brand, from seo_monitors.brand_names / the site model's names, with the domain label as the fallback;
//                        whole tokens only, never a substring (R89, below).
//   * GQ.anonymised(..)— what Search Console withholds: the totals minus the sum of the query rows ("anonymised for privacy").
// D24 (2026-10-11) found scraper queries among techand.ai's top queries; P1-3 (2026-10-12) added the leading minus ("-site:csc.gov.ae") and
// the lower-case booleans Search Console reports. Prose alone never counts: "erp software and accounting for distributors" has no quotes,
// no brackets and no capitals, so it stays a customer query.
const GQ = (() => {
  const OPERATOR = /(^|\s)[-+]?(site|inurl|intitle|intext|inanchor|allintitle|allinurl|allintext|filetype|ext|related|cache|link|before|after|daterange):\S/i;
  const BOOL_CAPS = /(^|[\s")])(AND|OR|\|)([\s("]|$)/;
  const BOOL_ANY = /(^|[\s")])(and|or|\|)([\s("]|$)/i;
  const GROUPED = /"[^"]+"|\([^)]+\)/;   // a quoted phrase or a bracketed group
  const isScraper = (q) => { const s = String(q || ''); return OPERATOR.test(s) || BOOL_CAPS.test(s) || (GROUPED.test(s) && BOOL_ANY.test(s)); };
  const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // every brand form worth matching: the monitor / model names, the business name and the domain's label ('techand' matches 'tech and', 'techand ai')
  const brandKeys = (domain, names) => {
    const keys = [];
    const push = (x) => { const k = squash(x); if (k.length >= 4 && !keys.includes(k)) keys.push(k); };
    push(String(domain || '').split('.')[0]);
    for (const n of (names || [])) { const s = String(n || '').trim(); if (!s) continue; push(/\./.test(s) ? s.split('.')[0] : s); }
    return keys;
  };
  // ---- R89 (2026-10-16, re-rating defect C-13): the brand test squashed the query ("technology and analytics" -> "technologyandanalytics")
  // and looked for a key INSIDE it, and "Tech&" squashed to the key "tech" — so "technology & data", "tech and software" and
  // "techandkey com" were all counted as searches for the business (exec 634: "brand = techand, tech"). The outreach kit solved the same
  // problem for "Tech&" on 2026-10-12 (MIN_NAME_RUN); this is that rule for search queries:
  //   * a key is matched as WHOLE tokens of the query: one token equal to it ("techand"), or consecutive tokens that join to it with no
  //     filler word between them ("northwind erp" -> "northwinderp") — never a substring, so "techandkey" is another word; a join
  //     ACROSS a filler word ("tech and" -> "techand") is the name spoken, and counts only as the whole query ("tech and ai" yes,
  //     "tech and software" no);
  //   * a name whose letters are shorter than MIN_NAME_RUN once its punctuation is gone ("Tech&") is never a key on its own: it counts
  //     only written or spoken as itself ("tech&", "tech and"), and only as the whole query (with the site's own domain ending at most),
  //     because "tech and software" is a description, not a search for the business.
  const MIN_NAME_RUN = 5;
  const FILLER = new Set(['and', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'a', 'an', 'or', 'by', 'with', 'vs', 'near', 'me', 'from']);
  const qTokens = (q) => String(q || '').toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean);
  // A-26: optimal string alignment distance (a swap of two neighbouring letters is one edit: "techadn" = "techand" misspelt once)
  const FUZZY_MIN = 6;
  const editDistance = (a, b) => { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
    return d[m][n]; };
  const brandTest = (domain, names) => {
    const keys = brandKeys(domain, names);
    const tld = String(domain || '').toLowerCase().split('.').slice(1).filter(Boolean);
    const long = keys.filter(k => k.length >= MIN_NAME_RUN || !/[^a-z0-9\s.]/i.test(String((names || []).find(n => squash(n) === k) || '')));
    // the short punctuated names ("Tech&"): their own written / spoken forms, matched as the whole query
    const spoken = [];
    for (const n of (names || [])) { const s = String(n || '').trim(); if (!s || /\./.test(s)) continue; const k = squash(s);
      if (k.length >= MIN_NAME_RUN || !/[^a-z0-9\s]/i.test(s)) continue; const toks = qTokens(s); if (toks.length && !spoken.some(x => x.join(' ') === toks.join(' '))) spoken.push(toks); }
    const longKeys = long;
    const is = (q) => {
      const t = qTokens(q); if (!t.length) return false;
      const onlyDomain = (rest) => rest.every(x => tld.includes(x) || x === 'com' || x === 'www');
      for (const k of longKeys) {
        if (k.length < 4) continue;
        for (let i = 0; i < t.length; i++) { let j = i, acc = '', filler = false;
          while (j < t.length && acc.length < k.length) { if (j > i && FILLER.has(t[j])) filler = true; acc += t[j]; j++;
            // a join across a filler word ("tech and" -> "techand") is the name SPOKEN, so it counts only as the whole query
            if (acc === k && (!filler || (i === 0 && onlyDomain(t.slice(j))))) return true; } } }
      for (const sp of spoken) { const rest = t.slice(0, sp.length).join(' ') === sp.join(' ') ? t.slice(sp.length) : null;
        // RV-15 (2026-10-21): the name followed only by its own words ("tech and tech", typed for "Tech&") is still the name, not a search for
        // something else; it was reported as two of the site's pages competing for one search
        if (rest && rest.every(x => tld.includes(x) || x === 'com' || x === 'www' || sp.includes(x))) return true; }
      // A-26 (2026-10-17, exec 764): "techandf cc" — the brand typed with one slip — was taken as a customer search, used as a discovery
      // seed and reported as a page mismatch ("aim that page at it"). A token (or two adjacent tokens with no filler word between them)
      // within one edit of a brand key of 6+ letters (two edits from 10 letters), starting with the same two letters, is the brand misspelt.
      for (const k of longKeys) {
        if (k.length < FUZZY_MIN) continue;
        const lim = k.length >= 10 ? 2 : 1;
        for (let i = 0; i < t.length; i++) {
          const cands = [t[i]]; if (i + 1 < t.length && !FILLER.has(t[i + 1]) && !FILLER.has(t[i])) cands.push(t[i] + t[i + 1]);
          for (const w of cands) if (w.length >= 5 && w !== k && w.slice(0, 2) === k.slice(0, 2) && Math.abs(w.length - k.length) <= lim && editDistance(w, k) <= lim) return true;
        }
      }
      return false; };
    const shown = [...longKeys, ...spoken.map(t => t.join(' '))];
    return { keys: shown, is: shown.length ? is : () => false };
  };
  // Search Console never names the queries of rare searches: the dimensionless/date totals hold them, the query rows do not
  const anonymised = (totals, rows) => {
    const t = totals || {}; const sum = (rows || []).reduce((a, r) => ({ clicks: a.clicks + (Number(r.clicks) || 0), impressions: a.impressions + (Number(r.impressions) || 0) }), { clicks: 0, impressions: 0 });
    const ti = Number(t.impressions) || 0, tc = Number(t.clicks) || 0;
    const im = Math.max(0, ti - sum.impressions), cl = Math.max(0, tc - sum.clicks);
    return { clicks: cl, impressions: im, clicks_pct: tc ? Math.round(cl / tc * 1000) / 10 : 0, impressions_pct: ti ? Math.round(im / ti * 1000) / 10 : 0,
      named_clicks: sum.clicks, named_impressions: sum.impressions, note: 'Search Console withholds the queries of rare searches; these clicks and impressions are real but belong to queries it does not name.' };
  };
  // ---- C-6 (re-rating 2026-10-17): a search for ANOTHER website is not a quick win ----
  // "techandkey com" (411 impressions; techandkey.com is "TechAndKey - Latest Tech News") was correctly not a brand search (R89) and was then
  // recommended as a striking-distance quick win, a low-CTR "rewrite titles" item and a cannibalisation pair. A navigational search for a
  // site that is not this one - one name followed by a domain ending ("techandkey com"), or a written domain ("techandkey.com") - is set
  // aside like a scraper query: counted in the totals, never in a list of things to do. Returns that site, or ''.
  const NAV_TLD = new Set(['com', 'net', 'org', 'io', 'co', 'ae', 'ai', 'app', 'info', 'biz', 'me', 'dev', 'tech', 'online', 'store', 'site', 'xyz', 'us', 'uk', 'sa', 'in']);
  const otherSite = (q, domain, keys) => {
    const s = String(q || '').toLowerCase().trim(); let name = '', tld = '';
    const m = s.match(/(?:^|\s|www\.)([a-z0-9-]{3,})\.(com|net|org|io|co|ae|ai|app|info|biz|me|dev|tech|online|store|site|xyz)(?:\.[a-z]{2})?(?:\/\S*)?(?:\s|$)/);
    if (m) { name = m[1].replace(/-/g, ''); tld = m[2]; }
    else { const t = qTokens(s).filter(x => x !== 'www'); if (t.length !== 2 || !NAV_TLD.has(t[1])) return ''; name = t[0]; tld = t[1]; }
    if (name.length < 3) return '';
    const own = String(domain || '').toLowerCase().split('.')[0].replace(/[^a-z0-9]/g, '');
    if (name === own || (keys || []).some(k => squash(k) === name)) return '';
    return name + '.' + tld;
  };
  return { isScraper, brandKeys, brandTest, anonymised, editDistance, otherSite };
})();
// Turns the Search Console answers (sitemaps, search performance, URL inspections) and the sitemap-vs-crawl comparison into audit findings,
// a "search_console" block and a "site_structure" block for the report; then hands the audit item on to Build Site Issues.
const plan = $('GSC Audit Plan').first().json; const base = plan.base || {};
const grab = (name) => { try { return $(name).all().map(i => i.json); } catch (e) { return []; } };
const first = (name) => { try { return ($(name).first() || {}).json || null; } catch (e) { return null; } };
const gErr = (r) => { if (!r) return 'no response'; const e = r.error; if (!e) return null; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return String((inner && inner.message) || (ctx.error_description ? String(ctx.error || 'error') + ': ' + ctx.error_description : '') || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };
const same = (a, b) => String(a || '').replace(/\/$/, '').toLowerCase() === String(b || '').replace(/\/$/, '').toLowerCase();
const path = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
// ---- R59 / R61 / R65 / R117 (2026-10-16, build section 90): the host Google shows, the rankings it measured, the pages a link reaches ----
const __hostOf90 = (u) => (String(u || '').trim().toLowerCase().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/) || [])[1] || '';
// the site's own address: the host its homepage canonical tag names, else the stored canonical host, else where the redirect leads, else the crawl's first page
const __canonHost90 = (() => {
  const b = (base && typeof base === 'object') ? base : {}; const hp = (((b.probe || {}).measurements || {}).hosts) || {};
  for (const c of [hp.canonical_tag_host, b.canonical_host, hp.consolidated ? __hostOf90(hp.apex_location) : '', __hostOf90(((plan.pages || [])[0] || {}).url)]) {
    const h = String(c || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, ''); if (h) return h; }
  return String(plan.domain || '').toLowerCase(); })();
// ONE definition of "Google chose another canonical", used by both counts: Google's choice against the page's own canonical (else the URL),
// host-sensitively — and a difference of host alone is named, because that is the www / non-www split and not a duplicate page
const canonOk90 = (i) => (!i || !i.google_canonical) ? null : same(i.google_canonical, i.user_canonical || i.url);
const hostOnly90 = (i) => !!i && !!i.google_canonical && key(i.google_canonical) === key(i.user_canonical || i.url) && __hostOf90(i.google_canonical) !== __hostOf90(i.user_canonical || i.url);
let host_split90 = null, servedAlt90 = [], canonAll90 = [], rowsByKey90 = new Map();
const elsewhere90 = (i) => (rowsByKey90.get(key(i.url)) || []).filter(r => __hostOf90(r.page) !== __hostOf90(i.url) && r.impressions > 0);
const findings = [], works = []; const CAT = 'Crawlability & Indexing';
const F = (severity, title, why, fix, evidence, urls, count, pct) => (severity !== 'Info' && !/[A-Za-z0-9]/.test(String(evidence == null ? '' : evidence)))
  ? null   // R10 (2026-10-13): a finding with nothing behind it is not a finding — live, "Pages Google reports as not mobile-friendly" was raised with the evidence "/:  | /whatwedo/ai-automation: " on 45 of 47 pages
  : findings.push({ category: CAT, severity, title, why, fix, evidence: evidence || '', affected_count: count == null ? null : count, affected_pct: pct == null ? 100 : pct, sample_urls: (urls || []).slice(0, 5), scope: urls && urls.length ? 'pages' : 'site' });
// ---- sitemap file(s) read from the site ----
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };   // the HTTP node puts text responses under `data` (live finding 2026-10-02)
const key = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');   // host-agnostic URL key: crawls report www while sitemaps/canonicals may not
const sm = first('Fetch Sitemap (Audit)') || {}; const smStatus = Number(sm.statusCode) || (sm.error ? 0 : 200); const smBody = bodyOf(sm);
const locsOf = (b) => (String(b || '').match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim());
let sitemapUrls = []; const isIndex = /<sitemapindex/i.test(smBody); let childCount = 0;
if (smStatus === 200 && !isIndex) sitemapUrls = locsOf(smBody);
if (smStatus === 200 && isIndex) { childCount = locsOf(smBody).length; for (const c of grab('Fetch Sitemap Children (Audit)')) if (c && !c.error) sitemapUrls.push(...locsOf(bodyOf(c))); }
// B5-5 (2026-10-15, benchmark area 5): the address every known URL is actually published at, kept beside its host-agnostic key
// so the pages the crawl never reached can be fetched exactly as they are, instead of being rebuilt from a key.
const knownMeta = new Map();
for (const u of sitemapUrls) { const k = key(u); if (k && !knownMeta.has(k)) knownMeta.set(k, { url: String(u).trim(), source: 'sitemap', impressions: 0, clicks: 0 }); }
sitemapUrls = [...new Set(sitemapUrls.map(key))].slice(0, 5000);
const sitemapKnown = smStatus === 200 && sitemapUrls.length > 0;
// ---- site structure from the crawl ----
const pages = plan.pages || []; const crawled = new Set(pages.map(p => key(p.url)));
// R117 (2026-10-16): the crawler starts from the sitemap as well as the homepage, so a page no link reaches gets click depth 0 — exec 595
// counted six orphan pages as "within 3 clicks" and printed "Shallow site structure: 100%" beside a High "Orphan pages" finding
const __home90 = (u) => /^https?:\/\/[^\/]+\/?$/.test(String(u || '').trim());
const unlinked90 = (p) => p.depth != null && (p.orphan === true || (Number(p.depth) === 0 && !__home90(p.url)));
const depthBuckets = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0, unlinked: 0 }; for (const p of pages) { if (p.depth == null) continue; if (unlinked90(p)) { depthBuckets.unlinked += 1; continue; } depthBuckets[p.depth >= 4 ? '4+' : p.depth] += 1; }
const withDepth = pages.filter(p => p.depth != null).length; const within3 = pages.filter(p => p.depth != null && !unlinked90(p) && p.depth <= 3).length;
const sections = {}; for (const p of pages) { const seg = path(p.url).split('/').filter(Boolean)[0] || '(home)'; sections[seg] = (sections[seg] || 0) + 1; }
const topSections = Object.entries(sections).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ section: '/' + (name === '(home)' ? '' : name + '/'), pages: count }));
const indexablePages = pages.filter(p => p.indexable);
const notInSitemap = sitemapKnown ? indexablePages.filter(p => !sitemapUrls.includes(key(p.url))) : [];
const crawlComplete = plan.crawl_finished && plan.pages_crawled < plan.crawl_limit;
const sitemapOnly = (sitemapKnown && crawlComplete) ? sitemapUrls.filter(u => !crawled.has(u)).map(u => 'https://' + u) : [];
const sitemapBroken = sitemapKnown ? pages.filter(p => sitemapUrls.includes(key(p.url)) && (p.status !== 200)) : [];
if (withDepth) { if (within3 / withDepth >= 0.9) works.push('Shallow site structure: ' + Math.round(within3 / withDepth * 100) + '% of crawled pages are within 3 clicks of the homepage'); }
if (sitemapKnown && indexablePages.length && notInSitemap.length / indexablePages.length >= 0.2) F('Medium', 'Indexable pages missing from the XML sitemap', 'Google still finds them through links, but a complete sitemap is the fastest way to get new and updated pages crawled.', 'Regenerate the sitemap to include every indexable page (most CMS SEO plugins do this automatically) and resubmit it.', notInSitemap.length + ' of ' + indexablePages.length + ' crawled indexable pages are not listed in sitemap.xml', notInSitemap.map(p => p.url), notInSitemap.length, Math.round(notInSitemap.length / indexablePages.length * 100));
if (sitemapOnly.length) F('Medium', 'Sitemap URLs that no internal link reaches', 'These pages exist only in the sitemap: Google may crawl them, but without internal links they rarely rank and visitors cannot find them.', 'Link to them from relevant pages (navigation, hub pages, related articles) or remove them from the sitemap if they should not rank.', sitemapOnly.length + ' sitemap URLs were not reached by a complete crawl of ' + plan.pages_crawled + ' pages', sitemapOnly, sitemapOnly.length, sitemapUrls.length ? Math.round(sitemapOnly.length / sitemapUrls.length * 100) : 100);
if (sitemapBroken.length) F('Medium', 'Sitemap lists pages that do not return 200', 'Redirected or broken URLs in the sitemap waste crawl budget and make Google trust the sitemap less.', 'Remove redirected and broken URLs from the sitemap; list only final, 200-status URLs.', sitemapBroken.map(p => p.status).join(', ') + ' status codes found for sitemap URLs', sitemapBroken.map(p => p.url), sitemapBroken.length, Math.round(sitemapBroken.length / sitemapUrls.length * 100));
if (smStatus !== 200) F('Low', 'sitemap.xml could not be read at the standard location', 'Google looks for /sitemap.xml and the robots.txt reference; a missing or non-standard sitemap slows discovery.', 'Serve the sitemap at /sitemap.xml (or reference its real location in robots.txt).', 'HTTP ' + smStatus + ' for ' + plan.sitemap_url, [], null, 100);
else if (!sitemapUrls.length) F('Low', 'The XML sitemap contains no URLs', 'An empty sitemap gives Google nothing to crawl.', 'Regenerate the sitemap with the site\'s indexable pages.', plan.sitemap_url + (isIndex ? ' is an index of ' + childCount + ' sitemaps that could not be read' : ' is empty'), [], null, 100);
else works.push('XML sitemap lists ' + sitemapUrls.length + ' URLs' + (isIndex ? ' (index of ' + childCount + ' sitemaps' + (childCount > 3 ? ', first 3 read' : '') + ')' : ''));
// ---- Search Console ----
const reqs = grab('GSC Audit Requests');
// R19 (2026-10-14, FIX_PLAN §3.12): the answers of the second attempt take the failed ones' place before anything is counted
// (31 of 45 inspections failed live in execution 550 and were never re-sent; the diff then called the 14 that answered an improvement).
const retryQ = grab('Inspect Retry Plan').filter(q => q && !q.skip);
const retryR = grab('GSC Audit Query (Retry)');
const expectOf = (q) => (q && q.kind === 'inspect') ? 'inspectionResult' : '';
const res = grab('GSC Audit Query').slice();
let inspect_retried = 0, inspect_retry_answered = 0;
retryQ.forEach((q, k) => {
  const i = Number(q.retry_of); const a = retryR[k]; if (!Number.isFinite(i) || a === undefined) return;
  const isInspect = (reqs[i] || {}).kind === 'inspect'; if (isInspect) inspect_retried++;
  if (RT.google(a, expectOf(reqs[i])).ok) { res[i] = a; if (isInspect) inspect_retry_answered++; }
});
const plan1 = reqs[0] || {};
const connected = !!plan1.connected; const scErr = plan1.connected ? null : (plan1.error || 'not connected');
let search_console = { connected, property: plan1.property || '', permission: plan1.permission || '', error: scErr, sitemaps: [], totals: null, top_pages: [], top_queries: [], inspections: [], coverage: {}, not_indexed: [], canonical_mismatch: [], not_in_sitemap_but_shown: [], rich_results: [] };
let gscPageKeys = [];   // G24: the pages Google reports impressions for — part of the "known URLs" the crawl is measured against
if (!connected) {
  F('Info', 'Search Console not connected: sitemap status, index coverage and search performance could not be checked', 'Only Search Console tells you which pages Google has indexed, which it rejected and why, and which queries bring impressions.', 'Add the service account e-mail (see the tracking set-up) as a Full user of the property in Search Console → Settings → Users and permissions, then re-run the audit.', scErr, [], null, 100);
  findings[findings.length - 1].scoring = false;   // a note about missing data, never a deduction
} else {
  const rowsOf = (r) => (r && Array.isArray(r.rows)) ? r.rows : [];
  const smr = first('GSC Sitemaps (Audit)') || {}; const smErr = gErr(smr);
  const sitemaps = Array.isArray(smr.sitemap) ? smr.sitemap.map(s => ({ path: s.path, submitted: s.lastSubmitted || '', downloaded: s.lastDownloaded || '', pending: !!s.isPending, index: !!s.isSitemapsIndex, warnings: Number(s.warnings) || 0, errors: Number(s.errors) || 0, urls: (s.contents || []).reduce((n, c) => n + (Number(c.submitted) || 0), 0) })) : [];
  search_console.sitemaps = sitemaps; search_console.sitemaps_error = smErr;
  if (!smErr && !sitemaps.length) F('High', 'No XML sitemap submitted to Search Console', 'Google discovers and re-crawls pages faster when the sitemap is submitted; without it, new pages depend on links alone and you get no sitemap error reports.', 'Submit ' + plan.sitemap_url + ' in Search Console → Sitemaps.', 'Search Console lists no sitemap for ' + plan1.property, [], null, 100);
  for (const s of sitemaps) {
    if (s.errors) F('High', 'Submitted sitemap has errors', 'Google could not process part of the sitemap, so some pages are not being discovered through it.', 'Open Search Console → Sitemaps → ' + s.path + ', fix the listed errors, resubmit.', s.errors + ' error(s), ' + s.warnings + ' warning(s) on ' + s.path, [s.path], null, 100);
    else if (s.warnings) F('Medium', 'Submitted sitemap has warnings', 'Warnings usually mean URLs with redirects, noindex or other inconsistencies.', 'Open Search Console → Sitemaps → ' + s.path + ' and clean the listed URLs.', s.warnings + ' warning(s) on ' + s.path, [s.path], null, 100);
    const dl = s.downloaded ? (Date.now() - new Date(s.downloaded).getTime()) / 864e5 : null;
    if (dl != null && dl > 30) F('Medium', 'Google has not read the sitemap for over a month', 'A sitemap Google stops reading usually failed or moved; updates to your pages reach Google late.', 'Resubmit the sitemap in Search Console and check it still returns 200 with valid XML.', s.path + ' last downloaded ' + s.downloaded.slice(0, 10), [s.path], null, 100);
    if (s.pending) F('Low', 'Sitemap submission still pending in Search Console', 'Google has not processed the sitemap yet.', 'Check again in a few days; if it stays pending, resubmit.', s.path, [s.path], null, 100);
  }
  if (sitemaps.length && !sitemaps.some(s => s.errors)) works.push('Sitemap submitted to Search Console (' + sitemaps.reduce((n, s) => n + s.urls, 0) + ' URLs, last read ' + ((sitemaps.find(s => s.downloaded) || {}).downloaded || 'n/a').slice(0, 10) + ')');
  const byKind = {}; reqs.forEach((q, i) => { byKind[q.kind] = byKind[q.kind] || []; byKind[q.kind].push({ q, r: res[i] }); });
  const tot = rowsOf(((byKind.totals || [])[0] || {}).r)[0]; search_console.totals = tot ? { clicks: Number(tot.clicks) || 0, impressions: Number(tot.impressions) || 0, ctr: Number(tot.ctr) || 0, position: +(Number(tot.position) || 0).toFixed(1), period: plan.range } : null;
  const pagesRows = rowsOf(((byKind.pages || [])[0] || {}).r).map(x => ({ page: x.keys[0], clicks: Number(x.clicks) || 0, impressions: Number(x.impressions) || 0, ctr: Number(x.ctr) || 0, position: +(Number(x.position) || 0).toFixed(1) }));
  const allQueryRows = rowsOf(((byKind.queries || [])[0] || {}).r).map(x => ({ query: x.keys[0], clicks: Number(x.clicks) || 0, impressions: Number(x.impressions) || 0, ctr: Number(x.ctr) || 0, position: +(Number(x.position) || 0).toFixed(1) }));
  // D24 (2026-10-11) / P1-3 (2026-10-12): queries with search operators (site:, inurl:, a leading "-site:", capital booleans, quoted groups)
  // come from SEO tools and scrapers, not from customers — counted apart as "scraper queries", never listed among the top queries.
  // G9 (2026-10-12): the rule itself now lives in v5/code/_gsc_queries.js (GQ.isScraper), shared with the Site Tracker's Parse GSC.
  const isScraper = GQ.isScraper;
  const scraperRows = allQueryRows.filter(q => isScraper(q.query)); const queryRows = allQueryRows.filter(q => !isScraper(q.query));
  search_console.top_pages = pagesRows.slice(0, 10);
  // R65 (2026-10-16): the impact of a finding is weighed on EVERY page Search Console measured ([path, clicks, impressions], the hosts
  // summed); top_pages stays the report's table of ten. Complete = fewer rows than the request asked for, so a page not listed had none.
  { const m90 = new Map(); for (const r of pagesRows) { const p = String(r.page || '').replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/(.)\/$/, '$1') || '/'; const o = m90.get(p) || [p, 0, 0]; o[1] += r.clicks; o[2] += r.impressions; m90.set(p, o); }
    const lim90 = Number(((((byKind.pages || [])[0] || {}).q || {}).body || {}).rowLimit) || 0;
    search_console.page_traffic = [...m90.values()].slice(0, 1000); search_console.page_traffic_complete = lim90 > 0 && pagesRows.length < lim90; }
  // R61 (2026-10-16): what Google's own data says about rankings, so no line of the report says "ranks for no keyword" beside it
  { const qlim90 = Number(((((byKind.queries || [])[0] || {}).q || {}).body || {}).rowLimit) || 0;
    // B-2 (2026-10-17): the brand test knows every brand form on file (the configured brand names, the business name), not the domain label only
    const __bn128 = (() => { const out = []; const bare = (x) => String(x || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, ''); const dom = bare(plan.domain || base.domain);
      try { const r = $('Load Site Row (Model)').first().json || {}; if (r.domain && bare(r.domain) === dom) out.push(...String(r.brand_names || '').split(/[,;\n]+/), r.business_name); } catch (e) {}
      try { const m = $('Restore Site Model').first().json.site_model || {}; if (!m.domain || bare(m.domain) === dom) out.push(...(Array.isArray(m.brand_names) ? m.brand_names : String(m.brand_names || '').split(/[,;\n]+/)), m.business_name); } catch (e) {}
      for (const b of (((base.ai_visibility || {}).brand_forms) || [])) out.push(b.form);
      return [...new Set(out.map(x => String(x || '').trim()).filter(Boolean))]; })();
    const bt90 = GQ.brandTest(plan.domain || base.domain, __bn128);
    const t10 = queryRows.filter(q => q.position > 0 && q.position <= 10), t30 = queryRows.filter(q => q.position > 0 && q.position <= 30);
    const INF90 = /^(how|what|why|when|where|who|which|is|are|can|does|do|should)\b|\b(how to|guide|tips|meaning|definition|examples?|explained|checklist|benefits|is changing|what is|vs)\b|\?/;
    const COM90 = /\b(best|top|services?|company|companies|partners?|consultants?|consulting|agency|agencies|providers?|vendors?|firms?|implementation|upgrade|migration|support|reviews?|compare|comparison|alternatives?)\b/;
    const TRX90 = /\b(price|prices|pricing|cost|costs|buy|hire|quote|demo|trial|book|contact|near me)\b/;
    const intentOf90 = (q) => INF90.test(q) ? 'informational' : TRX90.test(q) ? 'transactional' : COM90.test(q) ? 'commercial' : '';
    const byI = { informational: 0, commercial: 0, transactional: 0 }, exI = { informational: [], commercial: [], transactional: [] };
    for (const q of t30) { const it = bt90.is(q.query) ? '' : intentOf90(String(q.query || '').toLowerCase()); if (it) { byI[it] += 1; if (exI[it].length < 3) exI[it].push(q.query + ' #' + q.position); } }
    const sum = (l, f) => l.reduce((n, q) => n + (Number(q[f]) || 0), 0);
    search_console.rankings = { source: 'Search Console', period: plan.range || null, queries_read: queryRows.length, capped: qlim90 > 0 && allQueryRows.length >= qlim90,
      top10: t10.length, top10_brand: t10.filter(q => bt90.is(q.query)).length, top10_impressions: sum(t10, 'impressions'), top10_clicks: sum(t10, 'clicks'), top30: t30.length,
      by_intent_top30: byI, intent_examples: exI,
      brand_keys: bt90.keys, brand_queries: queryRows.filter(q => q.position > 0 && bt90.is(q.query)).sort((x, y) => (y.impressions - x.impressions) || (x.position - y.position)).slice(0, 10).map(q => ({ query: q.query, position: q.position, impressions: q.impressions, clicks: q.clicks })),
      examples: t10.slice().sort((x, y) => y.impressions - x.impressions).slice(0, 5).map(q => ({ query: q.query, position: q.position, impressions: q.impressions, clicks: q.clicks })),
      note: 'average position per query over the period; Search Console withholds the queries of rare searches, so this is a floor' }; } search_console.top_queries = queryRows.slice(0, 10); search_console.pages_with_impressions = pagesRows.length; search_console.queries_with_impressions = queryRows.length;
  gscPageKeys = [...new Set(pagesRows.map(p => key(p.page)).filter(Boolean))];
  // B5-5: Search Console's own address for the page, and what it earns — a page Google shows is read before a sitemap-only one
  for (const p of pagesRows) { const k = key(p.page); if (!k) continue; const prevM = knownMeta.get(k);
    knownMeta.set(k, { url: String(p.page || (prevM && prevM.url) || '').trim(), source: prevM ? 'sitemap + Search Console' : 'Search Console',
      impressions: Number(p.impressions) || 0, clicks: Number(p.clicks) || 0 }); }
  search_console.scraper_queries = { count: scraperRows.length, impressions: scraperRows.reduce((n, q) => n + q.impressions, 0), clicks: scraperRows.reduce((n, q) => n + q.clicks, 0), sample: scraperRows.slice(0, 3).map(q => q.query) };
  const errs = Object.values(byKind).flat().map(x => gErr(x.r)).filter(Boolean); if (errs.length) search_console.request_errors = [...new Set(errs)].slice(0, 3);
  if (search_console.totals) {
    const t = search_console.totals;
    works.push('Search Console (last 28 days): ' + t.clicks + ' clicks from ' + t.impressions + ' impressions, average position ' + t.position);
    if (t.impressions >= 500 && t.position <= 10 && t.ctr < 0.01) F('Medium', 'Very low click-through rate for a site ranking on page 1', 'Titles and descriptions are not winning the click even where you rank well.', 'Rewrite the titles and meta descriptions of the pages with the most impressions (lead with the outcome, add a number, match the query wording).', (t.ctr * 100).toFixed(2) + '% CTR at average position ' + t.position + ' over ' + t.impressions + ' impressions', [], null, 100);
    const noClick = pagesRows.filter(p => p.impressions >= 50 && p.clicks === 0);
    if (noClick.length) { F('Low', 'Pages shown in Google but never clicked', 'These pages earn impressions without clicks: the snippet does not match what searchers want, or they rank too low to be seen.', 'Check each page\'s main query, rewrite its title and description, and strengthen the page for that query.', noClick.length + ' page(s) with 50+ impressions and 0 clicks in 28 days', noClick.map(p => p.page), noClick.length, pagesRows.length ? Math.round(noClick.length / pagesRows.length * 100) : 100);
      // RV-3 (2026-10-21): the whole list travels, so the not-crawled check can take out the addresses that no longer answer (a dead page has no title to rewrite)
      const fNc = findings[findings.length - 1]; if (fNc && fNc.title === 'Pages shown in Google but never clicked') fNc.urls_all = noClick.map(p => p.page).slice(0, 300); }
    if (sitemapKnown) { const shownNotInSitemap = pagesRows.filter(p => !sitemapUrls.includes(key(p.page)) && p.impressions >= 20); search_console.not_in_sitemap_but_shown = shownNotInSitemap.map(p => p.page).slice(0, 10);
      if (shownNotInSitemap.length >= 3) { F('Low', 'Pages Google shows in search are missing from the sitemap', 'Google found these pages on its own; listing them in the sitemap keeps their updates flowing and confirms they are meant to rank.', 'Add them to the sitemap (or set the right canonical / noindex if they should not rank).', shownNotInSitemap.length + ' page(s) with impressions are not in sitemap.xml', shownNotInSitemap.map(p => p.page), shownNotInSitemap.length, 100);
        // RV-3: a page that answers 404 does not belong in a sitemap; the not-crawled check takes those out of this list (urls_all)
        const fSm = findings[findings.length - 1]; if (fSm && fSm.title === 'Pages Google shows in search are missing from the sitemap') fSm.urls_all = shownNotInSitemap.map(p => p.page).slice(0, 300); } }
  }
  // G25 (2026-10-13): one reading per inspected page — index state, the canonical Google chose, the last crawl, mobile usability and the
  // rich results — through the shared kit, which also classifies a permission error or an exhausted quota as "not checked" (never "not indexed").
  const insp = (byKind.inspect || []).map(x => { const o = PW.inspection(x.r || {});
    return { url: x.q.inspect_url, error: o.ok ? null : o.error, not_checked: o.not_checked || '', error_kind: o.error_kind || '', verdict: o.verdict, coverage: o.coverage,
      indexed: o.ok ? o.indexed : null, robots: o.robots, last_crawl: o.last_crawl, google_canonical: o.google_canonical, user_canonical: o.user_canonical,
      mobile_usable: o.mobile_usable, mobile_issues: o.mobile_issues, rich_verdict: o.rich_verdict, rich: o.rich_results }; });
  search_console.inspections = insp;
  // G25: the index picture, with the pages the quota did not reach counted apart and named (PW.coverage never says "fine" about a page nobody asked about)
  const _ib = plan.inspect_budget || null;
  search_console.index_coverage = { ...PW.coverage(insp.map(i => ({ ok: !i.error, error: i.error || '', indexed: i.indexed, verdict: i.verdict, coverage: i.coverage,
      canonical_ok: canonOk90(i), mobile_usable: i.mobile_usable, rich_results: i.rich, not_checked: i.not_checked || '' })),
      { not_checked: _ib ? _ib.skipped_total : 0, not_checked_reason: _ib && _ib.skipped_total ? 'the audit\'s share of Google\'s daily quota was used up; the weekly run inspects them, oldest first' : '', quota_note: _ib ? _ib.note : '' }),
    candidates: _ib ? _ib.candidates : insp.length, cap: _ib ? _ib.cap : null,
    pages: insp.filter(i => !i.error).slice(0, 100).map(i => ({ url: i.url, indexed: i.indexed, verdict: i.verdict, coverage: i.coverage, last_crawl: i.last_crawl,
      google_canonical: i.google_canonical, canonical_ok: canonOk90(i), canonical_host_only: hostOnly90(i), mobile_usable: i.mobile_usable, rich_results: i.rich })),
    not_checked_pages: [...insp.filter(i => i.error).map(i => ({ url: i.url, reason: i.not_checked || i.error })), ...((_ib && _ib.skipped) || []).map(u => ({ url: u, reason: 'not checked in this audit: the pages rotate through Google\'s daily quota, oldest first' }))].slice(0, 25) };
  const _f19 = findings.length;   // R19: every finding below is measured on the pages Google actually answered for
  const ok = insp.filter(i => !i.error); const coverage = {}; for (const i of ok) coverage[i.coverage || i.verdict || 'unknown'] = (coverage[i.coverage || i.verdict || 'unknown'] || 0) + 1; search_console.coverage = coverage;
  // R59 (2026-10-16): a page Google does not index under this host but SHOWS under the other one (www / bare) is not "not indexed":
  // Google chose its twin. Exec 595: all 16 "not indexed" www pages had impressions on https://techand.ai (1,374 in 28 days) and the
  // High "cannot rank at all ... request indexing" was ranked first. They are reported by the host-split finding, with their
  // impressions; only a page with no impressions under any host stays in the not-indexed finding. The list keeps every page.
  rowsByKey90 = new Map(); for (const r of pagesRows) { const k = key(r.page); if (!k) continue; const l = rowsByKey90.get(k) || []; l.push(r); rowsByKey90.set(k, l); }
  const notIdxAll90 = ok.filter(i => i.indexed === false);
  servedAlt90 = notIdxAll90.filter(i => elsewhere90(i).length);
  const notIdx = notIdxAll90.filter(i => !elsewhere90(i).length);
  search_console.not_indexed = notIdxAll90.map(i => { const o = elsewhere90(i); return o.length ? { url: i.url, reason: i.coverage, shown_as: o[0].page, shown_impressions: o.reduce((n, r) => n + r.impressions, 0), shown_clicks: o.reduce((n, r) => n + r.clicks, 0) } : { url: i.url, reason: i.coverage }; });
  const notIdxCov90 = {}; for (const i of notIdx) { const k = i.coverage || i.verdict || 'unknown'; notIdxCov90[k] = (notIdxCov90[k] || 0) + 1; }
  if (ok.length) {
    const share = Math.round(notIdx.length / ok.length * 100);
    if (notIdx.length && share >= 20) F('High', 'A large share of important pages is not indexed by Google', 'Pages that Google has not indexed cannot rank at all, whatever their content.', 'Open each URL in Search Console\'s URL inspection, fix the stated reason (crawled but not indexed usually means thin or duplicate content; discovered but not indexed means too few internal links), then request indexing.', notIdx.length + ' of ' + ok.length + ' sampled pages: ' + Object.entries(notIdxCov90).filter(([k]) => !/indexed/i.test(k) || /not indexed/i.test(k)).map(([k, v]) => v + ' × ' + k).join(', ') + ', with no impressions under any host' + (servedAlt90.length ? '; ' + servedAlt90.length + ' more are not indexed under this address but shown by Google under the other one (see the www and non-www finding)' : ''), notIdx.map(i => i.url), notIdx.length, share);
    else if (notIdx.length) F('Medium', 'Some sampled pages are not indexed by Google', 'These pages cannot rank until Google indexes them.', 'Check the reason in Search Console\'s URL inspection, strengthen internal links to them and request indexing.', (notIdx.map(i => i.coverage).filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join('; ') || (notIdx.length + ' of ' + ok.length + ' inspected pages are not in Google\'s index (Search Console gave no reason for them)')), notIdx.map(i => i.url), notIdx.length, share);
    else if (!servedAlt90.length) works.push('All ' + ok.length + ' sampled pages are indexed by Google');
    const robotsBlocked = ok.filter(i => /disallow|blocked/i.test(i.robots)); if (robotsBlocked.length) F('High', 'Important pages blocked by robots.txt', 'Google cannot crawl these pages, so it cannot rank them on their content.', 'Remove the Disallow rule that matches them in robots.txt.', robotsBlocked.map(i => i.robots).join(', '), robotsBlocked.map(i => i.url), robotsBlocked.length, Math.round(robotsBlocked.length / ok.length * 100));
    // R59: index_coverage.canonical_mismatch read 3 and search_console.canonical_mismatch 0 for the same pages (one counted every page
    // host-sensitively, the other indexed pages only). One definition now; a different HOST of the same page goes to the host-split finding.
    canonAll90 = ok.filter(i => canonOk90(i) === false);
    search_console.canonical_mismatch = canonAll90.map(i => ({ url: i.url, google_canonical: i.google_canonical, user_canonical: i.user_canonical || '', indexed: i.indexed, host_only: hostOnly90(i) }));
    const canon = canonAll90.filter(i => !hostOnly90(i));
    if (canon.length) F('Medium', 'Google chose a different canonical URL than the page itself', 'Google treats these pages as duplicates of another URL, so they do not rank on their own.', 'Make each page clearly distinct, set its canonical tag to itself, and link to that version consistently.', canon.map(i => path(i.url) + ' → ' + i.google_canonical).join('; ').slice(0, 300), canon.map(i => i.url), canon.length, Math.round(canon.length / ok.length * 100));
    const notSubmitted = ok.filter(i => /not submitted in sitemap/i.test(i.coverage)); if (notSubmitted.length >= 3) F('Low', 'Indexed pages that are not in the submitted sitemap', 'Google indexed them anyway, but the sitemap is incomplete.', 'Regenerate the sitemap to include every indexable page.', notSubmitted.length + ' sampled pages are "indexed, not submitted in sitemap"', notSubmitted.map(i => i.url), notSubmitted.length, Math.round(notSubmitted.length / ok.length * 100));
    const stale = ok.filter(i => i.indexed && i.last_crawl && (Date.now() - new Date(i.last_crawl).getTime()) / 864e5 > 60); if (stale.length && stale.length / ok.length >= 0.5) F('Low', 'Google crawls important pages rarely', 'Pages Google visits only every few months pick up changes late; it usually means few internal links and little fresh content.', 'Update and interlink key pages regularly; keep the sitemap lastmod dates honest.', stale.length + ' of ' + ok.length + ' sampled pages last crawled over 60 days ago', stale.map(i => i.url), stale.length, Math.round(stale.length / ok.length * 100));
    const rich = [...new Set(ok.flatMap(i => i.rich))]; search_console.rich_results = rich; if (rich.length) works.push('Google detects rich results on sampled pages: ' + rich.join(', '));
    const errCount = insp.length - ok.length; if (errCount) search_console.inspection_errors = errCount;
    // G25 + R10 (2026-10-13, re-rating §3.11): mobile-first indexing has been complete since 2024-07-05, so a page Google really calls
    // not mobile-usable is a ranking problem — but Google RETIRED the Mobile Usability report and the API now answers
    // VERDICT_UNSPECIFIED with no issue list for every page (45 of 45 live). That is NOT CHECKED, never "not mobile-friendly": the
    // finding needs a FAIL that names at least one issue (PW.inspection decides) and an evidence string with something in it.
    const mobBad = ok.filter(i => i.mobile_usable === false && (i.mobile_issues || []).length);
    const mobEvidence = mobBad.slice(0, 3).map(i => path(i.url) + ': ' + (i.mobile_issues || []).slice(0, 2).join('; ')).join(' | ').slice(0, 300);
    const mobChecked = ok.filter(i => i.mobile_usable !== null).length;
    search_console.mobile_usability = { checked: mobChecked, not_checked: ok.length - mobChecked, with_issues: mobBad.length,
      note: mobChecked ? '' : String(((ok.find(i => i.mobile_note) || {}).mobile_note) || 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.') };
    if (mobBad.length && mobEvidence) F('High', 'Pages Google reports as not mobile-friendly', 'Google indexes the mobile version of every page: what its phone crawler cannot use properly cannot rank well.', 'Fix the issues Search Console lists for these URLs (viewport, text size, tap targets, content wider than the screen), then re-inspect them.', mobEvidence, mobBad.map(i => i.url), mobBad.length, Math.round(mobBad.length / ok.length * 100));
    else if (mobChecked && ok.some(i => i.mobile_usable === true)) works.push('Google reports the ' + mobChecked + ' page(s) it still answers about as mobile-friendly');
  }
  // ---- R59 (2026-10-16): www and non-www as GOOGLE shows them — the redirect and the homepage tag are what the site says, not what Google does ----
  {
    const ch = __canonHost90; const alt = !ch ? '' : (/^www\./.test(ch) ? ch.slice(4) : 'www.' + ch); const bareH = /^www\./.test(ch) ? alt : ch;
    const fmt90 = (v) => (Number(v) || 0).toLocaleString('en-GB');
    const hostRows = {}; for (const r of pagesRows) { const h = __hostOf90(r.page); if (!h) continue; const o = hostRows[h] || (hostRows[h] = { host: h, pages: 0, clicks: 0, impressions: 0 }); o.pages += 1; o.clicks += r.clicks; o.impressions += r.impressions; }
    const C = hostRows[ch] || { host: ch, pages: 0, clicks: 0, impressions: 0 }; const A = hostRows[alt] || { host: alt, pages: 0, clicks: 0, impressions: 0 };
    const allImpr = Object.values(hostRows).reduce((n, o) => n + o.impressions, 0); const altShare = allImpr ? A.impressions / allImpr : 0;
    const googleAlt = canonAll90.filter(i => hostOnly90(i) && __hostOf90(i.google_canonical) === alt);
    const altMaps = (sitemaps || []).filter(s => __hostOf90(s.path) === alt);
    const split = !!alt && ((A.pages >= 2 && altShare >= 0.2) || googleAlt.length > 0);
    const shownImpr = servedAlt90.reduce((n, i) => n + elsewhere90(i).reduce((m, r) => m + r.impressions, 0), 0);
    const shownClicks = servedAlt90.reduce((n, i) => n + elsewhere90(i).reduce((m, r) => m + r.clicks, 0), 0);
    host_split90 = { found: split, canonical_host: ch, other_host: alt, hosts: [C, A].map(o => ({ ...o, impressions_pct: allImpr ? Math.round(o.impressions / allImpr * 100) : 0 })),
      google_chose_other: googleAlt.map(i => ({ url: i.url, google_canonical: i.google_canonical })), submitted_sitemaps_other_host: altMaps.map(s => s.path),
      not_indexed_shown_elsewhere: servedAlt90.length, shown_elsewhere_impressions: shownImpr, shown_elsewhere_clicks: shownClicks };
    search_console.host_split = host_split90;
    if (split) {
      const hp = (((base.probe || {}).measurements || {}).hosts) || {};
      const server = (Number(hp.apex_status) >= 300 && Number(hp.apex_status) < 400 && __hostOf90(hp.apex_location) === ch && ch !== bareH)
        ? 'your server redirects (' + hp.apex_status + ') https://' + bareH + ' to https://' + ch + (String(hp.canonical_tag_host || '').toLowerCase() === ch ? ' and the homepage canonical tag names https://' + ch : '')
        : (Number(hp.www_status) >= 300 && Number(hp.www_status) < 400 && __hostOf90(hp.www_location) === ch && ch === bareH) ? 'your server redirects (' + hp.www_status + ') https://' + alt + ' to https://' + ch : '';
      const ev = ['Search Console page rows (28 days): https://' + A.host + ' ' + A.pages + ' page(s), ' + fmt90(A.clicks) + ' clicks, ' + fmt90(A.impressions) + ' impressions (' + Math.round(altShare * 100) + '% of page impressions); https://' + C.host + ' ' + C.pages + ' page(s), ' + fmt90(C.clicks) + ' clicks, ' + fmt90(C.impressions) + ' impressions',
        googleAlt.length ? 'Google chose https://' + alt + ' as the canonical of ' + googleAlt.length + ' inspected page(s) whose own canonical names https://' + ch + ' (' + googleAlt.slice(0, 3).map(i => path(i.url)).join(', ') + ')' : '',
        altMaps.length ? 'the sitemap submitted to Search Console is ' + altMaps.map(s => s.path).join(', ') : '',
        servedAlt90.length ? servedAlt90.length + ' key page(s) not indexed under https://' + ch + ' are shown under https://' + alt + ' (' + fmt90(shownImpr) + ' impressions, ' + fmt90(shownClicks) + ' clicks)' : '',
        server].filter(Boolean).join('; ');
      const urls90 = [...new Set([...servedAlt90.map(i => i.url), ...googleAlt.map(i => i.url)])];
      host_split90.evidence = ev;
      // the redirect probe already reported the two hosts as not consolidated: Google's view is the same problem, so no second finding is
      // raised — its numbers travel in search_console.host_split and the report's Search Console section prints them beside that finding
      const probeFlag90 = (((base.probe || {}).findings) || []).some(f => /www and non-www versions are not consolidated|redirect chain or loop between apex and www/i.test(String((f || {}).title || '')));
      if (probeFlag90) host_split90.folded_into_probe = true;
      else F('High', 'www and non-www are split in Google: ' + (altShare >= 0.5 ? 'most pages are' : 'part of the site is') + ' shown under https://' + alt + ', not https://' + ch,
        'Your site names https://' + ch + ' as its address, but Google shows and ranks pages under https://' + alt + '. The pages under https://' + ch + ' then read as "not indexed" while their twins collect the impressions, and links and ranking signals are split between two addresses until one of them wins.',
        'Make every signal name https://' + ch + ': submit https://' + ch + '/sitemap.xml in Search Console' + (altMaps.length ? ' and remove ' + altMaps.map(s => s.path).join(', ') : '') + ', list only https://' + ch + ' URLs in it, change internal links that still point at https://' + alt + ', keep the redirects, then watch the page rows move to https://' + ch + ' in Search Console over the next weeks. Requesting indexing page by page does not help: Google already knows these pages under the other address. If https://' + alt + ' is the address you want, change the redirect and the canonical tags instead.',
        ev, urls90, urls90.length || A.pages, (ok.length && urls90.length) ? Math.round(urls90.length / ok.length * 100) : Math.round(altShare * 100));
      const f90 = findings[findings.length - 1]; if (f90 && /are split in Google/.test(String(f90.title || ''))) { f90.affected_urls = urls90.slice(0, 200); f90.host_split = true; f90.affected_unit = 'pages Google shows under the other address'; }
      const nc90 = findings.find(f => f && f.title === 'Pages shown in Google but never clicked');
      if (nc90) { const n = pagesRows.filter(p => p.impressions >= 50 && p.clicks === 0 && __hostOf90(p.page) === alt).length; if (n) nc90.evidence = String(nc90.evidence || '') + '; ' + n + ' of them are listed under https://' + alt + ', the other address (see the www and non-www finding)'; }
    }
  }
  // ---- R19: how many pages each of those numbers was measured on, said out loud and carried into the stored row and the diff ----
  const inspection_stats = { asked: insp.length, checked: ok.length, failed: insp.length - ok.length,
    failed_first: (insp.length - ok.length) + inspect_retry_answered, retried: inspect_retried, retry_answered: inspect_retry_answered,
    reasons: [...new Set(insp.filter(i => i.error).map(i => String(i.not_checked || i.error)))].slice(0, 3) };
  inspection_stats.note = RT.note({ ...inspection_stats, answered: inspection_stats.checked }, 'page');   // the kit counts "answered", the audit calls it "checked"
  search_console.inspection_stats = inspection_stats;
  for (let _i = _f19; _i < findings.length; _i++) {
    const f = findings[_i]; f.checked = ok.length; f.checked_of = insp.length;
    f.evidence = String(f.evidence || '') + ' (measured on the ' + ok.length + ' of ' + insp.length + ' page(s) Google answered for'
      + (inspection_stats.failed ? '; ' + inspection_stats.failed + ' could not be checked' + (inspect_retried ? ' even after being asked again' : '') : '') + ')';
  }
  if (insp.length && inspection_stats.failed) {
    F('Info', 'Google could not answer for part of the key pages', 'Everything this report says about indexing was measured on the pages Search Console answered for: the rest are unknown, not fine.',
      'Nothing to fix on the site: run the audit again later, or open those URLs in Search Console\'s URL inspection yourself.',
      inspection_stats.note || (inspection_stats.failed + ' of ' + insp.length + ' URL inspections failed'),
      insp.filter(i => i.error).map(i => i.url), inspection_stats.failed, Math.round(inspection_stats.failed / insp.length * 100));
    findings[findings.length - 1].scoring = false;   // a note about missing data, never a deduction
  }
}
// ---- G24 (2026-10-12, FIX_PLAN): crawl coverage — the audit judged a site on the pages it happened to crawl without ever saying how much of
// the site that was. Known URLs = the sitemap (all child sitemaps read) UNION the pages Search Console reports impressions for, compared
// host-agnostically with what the crawl reached. Under 90% the audit says so, because every finding's share is then a share of a sample.
const knownUrls = [...new Set([...sitemapUrls, ...gscPageKeys])];
const knownCrawled = knownUrls.filter(u => crawled.has(u));
const notCrawled = knownUrls.filter(u => !crawled.has(u));
const coveragePct = knownUrls.length ? Math.round(knownCrawled.length / knownUrls.length * 100) : null;
const crawl_coverage = { known_urls: knownUrls.length, crawled_known: knownCrawled.length, coverage_pct: coveragePct, not_crawled: notCrawled.length,
  sources: { sitemap: sitemapUrls.length, search_console_pages: gscPageKeys.length }, crawled_pages: pages.length, crawl_limit: plan.crawl_limit || null, crawl_complete: crawlComplete,
  sample_not_crawled: notCrawled.slice(0, 10).map(u => (knownMeta.get(u) || {}).url || ('https://' + u)),
  // B5-5: the list *Not Crawled Targets* reads up to its own cap from — with the address as published and what Google says it earns
  not_crawled_list: notCrawled.map(u => knownMeta.get(u) || { url: 'https://' + u, source: 'sitemap', impressions: 0, clicks: 0 })
    .filter(m => /^https?:\/\//i.test(String(m.url || ''))).sort((a, b) => (b.impressions - a.impressions) || (b.clicks - a.clicks)).slice(0, 60),
  text: knownUrls.length ? 'Crawled ' + knownCrawled.length + ' of ' + knownUrls.length + ' known URLs (' + coveragePct + '%; sitemap ' + sitemapUrls.length + (gscPageKeys.length ? ' + ' + gscPageKeys.length + ' pages with Search Console impressions' : '') + ')' : 'No sitemap and no Search Console pages: the crawl is the only list of URLs, so coverage cannot be measured' };
// RV-5 (2026-10-21): a crawl that FINISHED under its limit did not stop early: the known URLs it missed are not linked from the site (on
// techand.ai all 26 were old addresses that answer 404). It is not called a crawl limit, and the fix is not "raise the limit".
if (knownUrls.length >= 10 && coveragePct != null && coveragePct < 90) F('Medium', 'The crawl covered only part of the site', 'Every share and count below is a share of the pages that were crawled, not of the whole site; pages nobody crawled can hide the worst problems.',
  crawlComplete ? 'Nothing to raise: the crawl finished. Link to the missed pages that should rank and redirect the ones that no longer answer (each one is read in this audit, see the findings about the URLs outside the crawl).'
    : 'Raise the crawl limit for this site (or fix what blocks the crawler: robots.txt rules, bot protection, pages reachable only through scripts), then audit again.',
  crawl_coverage.text + '; ' + notCrawled.length + ' known URLs were not reached' + (plan.crawl_limit ? (crawlComplete ? ', although the crawl finished under its limit of ' + plan.crawl_limit + ' pages: no internal link leads to them' : ' (crawl limit ' + plan.crawl_limit + ' pages, the crawl did not finish)') : ''), crawl_coverage.sample_not_crawled, notCrawled.length, 100 - coveragePct);
else if (knownUrls.length >= 10 && coveragePct != null) works.push(crawl_coverage.text);
const site_structure = { crawl_coverage, crawled_pages: pages.length, indexable_pages: indexablePages.length, depth_buckets: depthBuckets, within_3_clicks_pct: withDepth ? Math.round(within3 / withDepth * 100) : null, sections: topSections, sitemap: { url: plan.sitemap_url, status: smStatus, urls: sitemapUrls.length, is_index: isIndex, children: childCount }, indexable_not_in_sitemap: notInSitemap.length, sitemap_only: sitemapOnly.length, sitemap_broken: sitemapBroken.length, crawl_complete: crawlComplete };
// ---- R61 (2026-10-16): the ranking statements built before Search Console was read (Competitor Analysis, Analyze Keywords) said
// "does not rank in Google's top 10 for any keyword" from DataForSEO's database alone while Google's own data, read here, showed 15
// queries in the top 10. They now name both sources; the competitor comparison stays provider against provider.
const __rk90 = search_console.rankings || null;
const __n90 = (v) => (Number(v) || 0).toLocaleString('en-GB');
const __per90 = (__rk90 && __rk90.period && __rk90.period.start) ? __rk90.period.start + ' to ' + __rk90.period.end : 'the last 28 days';
const __gsc90 = __rk90 ? 'Search Console (measured, ' + __per90 + '): ' + __rk90.top10 + ' quer' + (__rk90.top10 === 1 ? 'y' : 'ies') + ' at an average position in Google\'s top 10 (' + __n90(__rk90.top10_impressions) + ' impressions, ' + __n90(__rk90.top10_clicks) + ' clicks'
  + (__rk90.top10_brand ? '; ' + __rk90.top10_brand + ' of them for your own name' : '') + ')' + ((__rk90.examples || []).length ? ', e.g. ' + __rk90.examples.slice(0, 3).map(q => '"' + q.query + '" #' + q.position).join(', ') : '') : '';
const __med143 = ((base.competitor_benchmark || {}).medians) || null;
const __ex90 = (base.extra_findings || []).map(f => {
  if (!__rk90 || !f || f.category !== 'Authority') return f;
  const t = String(f.title || '');
  // RV-6 (2026-10-21): Google's own data shows top-10 rankings and the competitors' median is tiny or unknown: there is nothing to be far behind
  if (/does not rank in Google.s top 10 for any keyword/i.test(t) && __rk90.top10 > 0 && __med143 && !(Number(__med143.top10) >= 10)) return null;
  // RV-6: the site's measured clicks over 28 days already beat a tenth of the competitors' estimated monthly visits: the estimate is contradicted
  if (/^Organic traffic is under 10% of competitors$/.test(t) && search_console.totals && __med143 && Number(__med143.est_monthly_traffic) > 0
    && Number(search_console.totals.clicks) >= Number(__med143.est_monthly_traffic) * 0.1) return null;
  if (/does not rank in Google.s top 10 for any keyword/i.test(t) && __rk90.top10 > 0) return { ...f, title: 'Far fewer top-10 rankings than competitors',
    evidence: String(f.evidence || '').replace(/^Top-10 rankings in /, 'DataForSEO\'s ranking database, top-10 rankings in ') + '; ' + __gsc90,
    why: 'Google shows the site in its top 10 for very few searches' + (__rk90.top10_brand * 2 >= __rk90.top10 ? ', most of them for its own name,' : '') + ' while the competitors hold a median of ' + __n90((__med143 || {}).top10) + ' in the same database: a buyer who searches for what you sell finds them first.',
    reconciled: 'search_console' };
  const mi = t.match(/^No rankings for (informational|commercial|transactional) searches$/);
  if (mi && ((__rk90.by_intent_top30 || {})[mi[1]] || 0) > 0) { const n = __rk90.by_intent_top30[mi[1]];
    return { ...f, severity: 'Low', title: 'Few rankings for ' + mi[1] + ' searches',
      evidence: String(f.evidence || '').replace(/^You rank for 0 /, 'DataForSEO\'s database holds 0 ') + '; Search Console shows ' + n + ' ' + mi[1] + ' quer' + (n === 1 ? 'y' : 'ies') + ' in the top 30 (' + __per90 + ', e.g. ' + ((__rk90.intent_examples || {})[mi[1]] || []).map(q => '"' + q + '"').join(', ') + ')',
      why: 'Competitors are found for many more of these searches than you are; the provider\'s database does not see the few you already rank for.', reconciled: 'search_console' }; }
  if (/^Organic traffic is under 10% of competitors$/.test(t) && search_console.totals) return { ...f,
    evidence: String(f.evidence || '').replace(/^Estimated monthly organic visits:/, 'Estimated monthly organic visits (DataForSEO\'s estimate, the same for every site compared):') + '; Search Console measured ' + __n90(search_console.totals.clicks) + ' clicks and ' + __n90(search_console.totals.impressions) + ' impressions for your site in ' + __per90,
    reconciled: 'search_console' };
  return f;
});
const __exk143 = __ex90.filter(Boolean); __ex90.length = 0; __ex90.push(...__exk143);
const __works90 = (__rk90 && __rk90.top10) ? ['Google\'s own data (Search Console, ' + __per90 + '): ' + __rk90.top10 + ' quer' + (__rk90.top10 === 1 ? 'y' : 'ies') + ' in the top 10' + (__rk90.top10_brand ? ' (' + __rk90.top10_brand + ' for your own name)' : '')] : [];
// R59: "One canonical host … the canonical tags agree" is what the server says; with Google showing the other host it is not what works
const __probe90 = (base.probe && host_split90 && host_split90.found) ? { ...base.probe, what_works: (base.probe.what_works || []).filter(w => !/^One canonical host|^www redirects to the main domain/.test(String(w))),
  measurements: { ...(base.probe.measurements || {}), hosts: { ...(((base.probe.measurements || {}).hosts) || {}), google_split: true, google_other_host: host_split90.other_host } } } : base.probe;
// ---- B-2 / B-4 (2026-10-17, re-rating 2026-10-17, exec 767): the brand and the index, judged from Google's own data where this run has it ----
// The brand finding came from one results page ("tech&") beside Search Console's "techand" #4.5 and "tech & ai" #2.7 in the same report, and
// flipped between "fixed" and "new" from report to report; the index finding put a High on a site: estimate (8) while the URL Inspection of
// all 45 key pages, in the same run, said 30 are indexed and explained the other 15. Measured data decides; a results page stays a reading.
const __bq128 = (__rk90 && Array.isArray(__rk90.brand_queries)) ? __rk90.brand_queries.filter(q => (Number(q.impressions) || 0) > 0) : [];
const __ic128 = search_console.index_coverage || null;
const __works128 = []; let __avNote128 = null;
const __ex128 = __ex90.map(f => {
  if (!f) return f;
  const t = String(f.title || '');
  if (t === 'Site does not rank at the top for its own brand name' && __bq128.length) {
    const main = __bq128[0]; const pos = Number(main.position) || 0;
    const list = __bq128.slice(0, 4).map(q => '"' + q.query + '" #' + q.position + ' (' + __n90(q.impressions) + ' impressions, ' + __n90(q.clicks) + ' clicks)').join(', ');
    if (pos > 0 && pos <= 3) { __works128.push('Google\'s own data (Search Console, ' + __per90 + '): the searches for your own name find you at the top — ' + list); return null; }
    return { ...f, severity: pos > 10 ? 'High' : 'Medium', one_reading: false, reconciled: 'search_console',
      evidence: 'Search Console (measured, ' + __per90 + '), the searches for your own name: ' + list + '. The results pages read in this run: ' + String(f.evidence || '').replace(/^Results pages read once in this run: /, '').replace(/ One read of a results page is one reading;.*$/, ''),
      why: 'The search people use most for your name finds you at #' + main.position + ' on average' + (pos > 10 ? ', below the first page' : '') + ': people who already know you have to scroll past other results to reach you.' };
  }
  if (/^Far fewer pages indexed than crawled$|^Many more URLs indexed than the crawl found/.test(t) && __ic128 && Number(__ic128.checked) >= 10) {
    __avNote128 = 'The site: estimate is not used: URL Inspection read ' + __ic128.checked + ' key pages in this run (' + __ic128.indexed + ' indexed, ' + __ic128.not_indexed + ' not, explained in Crawlability & Indexing).';
    return null;
  }
  return f;
}).filter(Boolean);
const __av128 = base.ai_visibility ? { ai_visibility: { ...base.ai_visibility, brand_search_console: __bq128.slice(0, 5), ...(__avNote128 ? { index_estimate_note: __avNote128, index_inspection: { checked: __ic128.checked, indexed: __ic128.indexed, not_indexed: __ic128.not_indexed } } : {}) } } : {};
return [{ json: { ...base, ...__av128, ...(base.probe ? { probe: __probe90 } : {}), extra_findings: [...__ex128, ...findings], extra_works: [...(base.extra_works || []), ...works, ...__works90, ...__works128], search_console, site_structure } }];
