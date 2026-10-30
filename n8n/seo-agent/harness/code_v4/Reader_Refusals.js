// W07-A (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item"): the page reader refused reads in this run. Fed by every
// reader fallback node of the workflow (one item per read); with no refusal it answers `skip` and nothing below runs. Otherwise it names the
// reader and its error ONCE: the alert's identity (OA.keyOf: workflow, node, the stable "HTTP 402 InsufficientBalanceError" part) is the same
// for every step of the run and every run of the next 30 minutes, so the first step that meets the refusal alerts and the others only count
// on the row (OA.DEDUPE_MINUTES). The details (which step, how many reads, what the fallback recovered) ride in `detail`.
// ---- the ops alert and its channels (D25b, 2026-10-12, system review FIX_PLAN.md) ----
// The Error Handler had a single channel: *Email Ops*. On 2026-10-10 and again on 2026-10-12 it failed with a connection error (the Console
// Alerts watcher triggers the handler), so a failed run told nobody. Now every alert is **recorded first** in the Data Table
// seo_ops_alerts - the record of last resort, which survives both channels being down - and then sent to two independent channels: a webhook
// (SEO_ALERT_WEBHOOK_URL: Slack, Teams or anything that takes a POST; no SMTP involved) and the e-mail. Repeats of the same failure within
// OA.DEDUPE_MINUTES are recorded (count + 1) but not re-sent, so one broken credential cannot flood either channel. An unset channel is
// simply skipped, and neither channel can fail the run.
const OA = (() => {
  const DEDUPE_MINUTES = 30;
  // B-A7 (2026-10-15): the moment a first attempt may be re-tried if nothing records a delivery. It must equal AR.RETRY_MINUTES — the
  // sweep (v5/code/_alert_retry.js) is what acts on it — and build section 64 fails if the two ever drift apart.
  const RETRY_MINUTES = 30;
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the identity of a failure: the workflow, the node and the message with numbers, ids and quoted values removed, so "timeout after 30012ms"
  // and "timeout after 31004ms" at the same node are one alert
  // R79 (2026-10-16, re-rating C-3): the slice used to keep a trailing space when the 160th character was one, so row 4 was stored under a
  // 207-character key ending in a space while every reader trimmed it to 206 — the retry's update matched no row and the alert was re-sent to
  // Slack on every run of every monitor (14 posts on 2026-10-15). The key is trimmed after the slice: ONE normal form, built here only.
  const keyOf = (a) => [S(a.workflow) || 'unknown workflow', S(a.node) || 'unknown node',
    S(a.message).toLowerCase().replace(/\d[\d.,:]*/g, '#').replace(/["'`][^"'`]*["'`]/g, '"x"').replace(/\s+/g, ' ').slice(0, 160).trim()].join(' | ');
  // R79: a stored row is matched on the normal form (trimmed), but it is WRITTEN BACK under the key it is stored with, byte for byte — rows
  // written before the trim (row 4) keep their trailing space, and a Data Table update / upsert filters on exact equality. Normalise on
  // read, write back the identity: no migration of the stored keys is needed, and no second row is ever created beside an old one.
  const storedKey = (r) => String(r == null || r.alert_key == null ? '' : r.alert_key);
  const severityOf = (a) => /credential|unauthor|forbidden|payment|credit|quota|balance/i.test(S(a.message)) ? 'critical' : 'high';
  // B-A7: a row is "carried" when `delivered` NAMES the channel that took it ('webhook', 'email', 'webhook,email'). Everything else -
  // pending, failed, not_sent, deduped - means the same thing to a human: nobody has it. The same rule as AR.carried.
  const carried = (r) => S(r && r.delivered).toLowerCase().split(',').map(x => x.trim()).some(x => x === 'webhook' || x === 'email');
  // R29 (2026-10-14, FIX_PLAN §3.12, secret handling): SEO_ALERT_WEBHOOK_URL is a bearer URL, so the build bakes a PLACEHOLDER and
  // apply_env.py substitutes the real value into the JSON it imports — the public repository never carries the secret. A node still
  // holding the placeholder (an un-applied build, and every harness run) has no webhook configured: it is not a URL, and posting to it
  // would be a request to nowhere. Anything that still looks like __A_PLACEHOLDER__ therefore reads as unset.
  const cfgUrl = (v) => { const s = S(v); return !s || /^__[A-Z0-9_]+__$/.test(s) ? '' : s; };

  const plan = (alert, rows, cfg) => {
    const a = alert || {}, c = cfg || {};
    const now = new Date();
    const nowIso = now.toISOString();
    const fresh = keyOf(a);
    const prior = (rows || []).filter(r => r && S(r.alert_key) === fresh)
      .sort((x, y) => S(y.last_seen_at).localeCompare(S(x.last_seen_at)))[0] || null;
    const alert_key = prior ? storedKey(prior) : fresh;   // R79: the row that exists, under the key it is stored with
    const sinceMin = prior && S(prior.last_seen_at) ? (now - new Date(S(prior.last_seen_at))) / 60000 : Infinity;
    const repeat = !!prior && Number.isFinite(sinceMin) && sinceMin < DEDUPE_MINUTES;
    const count = prior ? n0(prior.count) + 1 : 1;
    const webhook_url = cfgUrl(c.webhook_url);   // R29: an un-substituted placeholder is not a channel
    const email_to = S(c.email_to);
    const channels = [webhook_url ? 'webhook' : '', email_to ? 'email' : '', 'data_table'].filter(Boolean);
    const notify = !repeat;
    const plain = [S(a.workflow) + ' failed at "' + S(a.node) + '"', 'Execution ' + (S(a.execution_id) || '?') + (S(a.mode) ? ' (' + S(a.mode) + ')' : ''),
      S(a.execution_url), S(a.message)].filter(Boolean).join('\n');
    const row = {
      alert_key, workflow: S(a.workflow).slice(0, 200), node: S(a.node).slice(0, 200), message: S(a.message).slice(0, 800),
      execution_id: S(a.execution_id), execution_url: S(a.execution_url), mode: S(a.mode), severity: severityOf(a),
      first_seen_at: prior && S(prior.first_seen_at) ? S(prior.first_seen_at) : nowIso, last_seen_at: nowIso, count,
      channels: channels.join(','),
      // B-A7 (2026-10-15): a repeat used to write `deduped` over whatever the row said, including over the channels that had CARRIED the
      // alert — so a delivered alert looked undelivered and an undelivered one looked handled. A repeat of an alert something carried
      // keeps that state; only an alert nobody has is marked deduped.
      delivered: notify ? 'pending' : (prior && carried(prior) ? S(prior.delivered) : 'deduped'),
      notes: (repeat ? 'repeat within ' + DEDUPE_MINUTES + ' minutes (' + Math.round(sinceMin) + ' min after the last one), recorded but not re-sent' : count > 1 ? 'seen ' + count + ' times, last alert more than ' + DEDUPE_MINUTES + ' minutes ago' : 'first time').slice(0, 500),
      // B-A7: the retry state. `attempts` is 0 here on purpose — this row is written BEFORE anything is sent, and an attempt exists when it
      // is made, not when it is planned (INVARIANTS rule 4). *Alert Delivery* writes the real count and the log a moment later; if the
      // execution dies before it does, `next_attempt_at` has already booked the row for the next sweep, so the failure is not stranded.
      attempts: n0(prior && prior.attempts),
      last_attempt_at: S(prior && prior.last_attempt_at),
      next_attempt_at: notify ? new Date(now.getTime() + RETRY_MINUTES * 60000).toISOString() : S(prior && prior.next_attempt_at),
      attempt_log: S(prior && prior.attempt_log)
    };
    // the webhook payload: `text` works for Slack and Teams, `content` for Discord, and `alert` carries the structured fields for anything else
    const body = {
      text: S(a.subject) + '\n' + plain, content: S(a.subject) + '\n' + plain, summary: S(a.subject),
      alert: { key: alert_key, workflow: row.workflow, node: row.node, message: row.message, execution_id: row.execution_id,
        execution_url: row.execution_url, mode: row.mode, severity: row.severity, seen_count: count, at: nowIso, source: 'seo-agent-error-handler' }
    };
    return { row, notify, repeat, channels, webhook_url, email_to, webhook_body: body, plain, alert_key, severity: row.severity, DEDUPE_MINUTES };
  };

  return { plan, keyOf, storedKey, severityOf, cfgUrl, carried, DEDUPE_MINUTES, RETRY_MINUTES };
})();
// ---- the page reader's fallback (W07-A, 2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item") ----
// Every page this engine reads goes through one reader (Jina Reader, credential SEOcredJinaReade). On 2026-10-30 its account ran out of
// balance: between about 10:13 and 12:56 UTC every read answered HTTP 402 "please recharge". Nothing noticed. The HTTP nodes are
// `continueRegularOutput`, so each refusal became an error item that the next node read as "this page could not be read": a page run was
// held on its search score alone and told the client "/ms-365-erp-uae has no title, main heading or Search Console search on file" about a
// page nobody had looked at (K1, WAVE06 section 9), and no ops alert was raised.
// This kit is what each reader node is followed by now (*<reader>*, the Code node that took the reader's name; the HTTP node is
// *<reader> (reader)*):
//   * `refusal(item)`: did the READER refuse (401 / 402 / 429, or 403 with the reader's own key / balance / rate words), as opposed to the
//     page itself failing? A page that is down, blocked or slow is not a refusal and is left exactly as it was.
//   * `recover(helpers, ctx)`: for the refused reads only, (1) the same reader WITHOUT the key (it answered 200 in the 2026-10-30 probe; its
//     limit is about 20 reads a minute, so the calls are spaced and capped), then (2) for a text read, a direct fetch of the page turned into
//     the reader's own line format by the HTML-to-text path the client-render reading already uses (CRK.linesOf). A render read (the page
//     after its scripts ran) is never replaced by the plain HTML: that would make "what only exists after JavaScript" read as "nothing".
//     A read nothing could recover stays unread, with the reason, and is marked `reader_fallback.via: 'none'`.
//   * Items the reader answered are returned as the very same objects: with a funded key nothing here changes a byte.
// Every touched item carries `reader_fallback` ({ via, refused, path, node, why }), which is what *Reader Refusals* (the ops alert, one per
// run) and the content run's decisions (`pagesUnread`: no hold, verdict, existing-page match or grade on pages nobody read) look at.
const RD = (() => {
  const CFG = { keyless_gap_ms: 3200, keyless_max: 12, direct_max: 25, budget_ms: 120000, keyless_timeout_ms: 40000, direct_timeout_ms: 20000,
    min_text_chars: 200, max_html_chars: 4000000 };
  const READER = 'https://r.jina.ai/';
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const S = (v) => String(v == null ? '' : v);
  const T = (v) => S(v).trim();
  const CODES = [401, 402, 403, 429];
  // the reader's own words for a key, balance or rate problem (its error names, and its messages)
  const NAME_RE = /InsufficientBalance|AuthenticationRequired|AuthenticationFailed|InvalidApiKey|InvalidToken|Unauthori[sz]ed|RateLimit|TooManyRequests|Quota|Budget|PaymentRequired/i;
  const TEXT_RE = /\bbalance\b|recharge|quota|rate.?limit|too many requests|api.?key|unauthori[sz]ed|payment required|insufficient|credentials/i;
  const clean = (s) => T(S(s).replace(/\(uid:[^)]*\)/gi, '').replace(/\s+/g, ' '));
  const parseBody = (b) => {
    if (b && typeof b === 'object' && !Array.isArray(b)) return b;
    const t = T(b);
    if (!t.startsWith('{') || t.length > 20000) return null;
    try { const o = JSON.parse(t); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  };
  const fromBody = (status, body) => {
    const o = parseBody(body);
    const name = o ? T(o.name) : '';
    const message = clean(o ? (o.readableMessage || o.message || '') : S(body).slice(0, 300)).replace(/^[A-Za-z]+Error:\s*/, '');
    const code = Number(status) || (o ? Number(o.code) || 0 : 0);
    return { status: code, name, message: message.slice(0, 240) };
  };
  const isRefusal = (r) => !!r && CODES.includes(r.status) && (r.status !== 403 || NAME_RE.test(r.name) || TEXT_RE.test(r.message) || /^(?:insufficient|account|api key)/i.test(r.message));
  // the reader's body in an output field: a JSON error object of its own (code + name / readableMessage), never a page's text
  const errorBody = (v) => { const o = parseBody(v); if (!o) return null; const code = Number(o.code); if (!CODES.includes(code) || !(o.name || o.readableMessage)) return null; return fromBody(code, o); };
  // what the HTTP node handed on: an error item (`continueRegularOutput`), a full response (`fullResponse` + `neverError`), or a body kept
  // in its output field (`neverError` alone answers the reader's error JSON as if it were the page)
  const refusal = (item, prop) => {
    const j = (item && item.json && typeof item.json === 'object') ? item.json : (item || {});
    if (!j || typeof j !== 'object') return null;
    if (j.error) {
      const e = typeof j.error === 'object' ? j.error : { message: S(j.error) };
      const msg = S(e.message);
      const m = msg.match(/^\s*(\d{3})\s*-\s*([\s\S]*)$/);
      const status = Number(e.httpCode || e.statusCode || e.status || (m && m[1])) || 0;
      const body = m ? m[2] : (e.description || msg);
      let r = fromBody(status, body);
      if (!r.name && !r.message) r = { status, name: T(e.name), message: clean(msg).slice(0, 240) };
      return isRefusal(r) ? r : null;
    }
    const sc = Number(j.statusCode);
    if (Number.isFinite(sc) && sc > 0 && ('body' in j || 'data' in j)) { if (sc < 400) return null; const r = fromBody(sc, j.body != null ? j.body : j.data); return isRefusal(r) ? r : null; }
    for (const k of [prop, 'data', 'page_text', 'site_text', 'body'].filter(Boolean)) { if (j[k] == null) continue; const r = errorBody(j[k]); if (r) return r; }
    return null;
  };
  const describe = (r) => !r ? '' : ('HTTP ' + r.status + (r.name ? ' ' + r.name : '') + (r.message ? ': ' + r.message.replace(/[.\s]+$/, '') : '')).slice(0, 220);
  const brief = (r) => r ? { status: r.status, name: r.name, message: r.message.slice(0, 160) } : null;

  // the page's own HTML in the reader's line format (CRK.linesOf: header, menu, footer, aside, forms and cookie banners removed, headings as
  // "#" lines), with the reader's three head lines; `links` adds the site's own links first (a homepage read keeps its menu for the nav pages)
  const toReaderText = (html, url, opts) => {
    const o = opts || {};
    const h = S(html).slice(0, CFG.max_html_chars);
    const title = typeof LK !== 'undefined' ? LK.text(((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')).slice(0, 300) : '';
    const lines = typeof CRK !== 'undefined' ? CRK.linesOf(h) : [];
    const menu = (o.links && typeof CRK !== 'undefined') ? CRK.links(h, url, o.domain || (typeof LK !== 'undefined' ? LK.hostOf(url) : '')).slice(0, 40).map(l => '[' + T(l.title || l.path).replace(/[\[\]]/g, '') + '](' + l.url + ')') : [];
    return 'Title: ' + title + '\n\nURL Source: ' + url + '\n\nMarkdown Content:\n' + [...menu, ...lines].join('\n\n');
  };
  const plainLen = (t) => S(t).replace(/^(Title|URL Source|Markdown Content):.*$/gm, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim().length;
  const bodyText = (b) => b == null ? '' : (typeof b === 'string' ? b : (typeof Buffer !== 'undefined' && Buffer.isBuffer(b) ? b.toString('utf8') : JSON.stringify(b)));
  const msgOf = (e) => clean((e && (e.message || e.description)) || e).slice(0, 160);

  // ctx: { reqs: the request items (json, aligned with res by position), res: the reader's output (json), mode: 'text' | 'html',
  //        full: the reader answers a full response (statusCode / body), prop: its output field, headers: the reader's own headers,
  //        target(q, i): the page's address, links / domain(q): keep the site's own links (a homepage read), path / node: names for the
  //        report, sleep(ms) and now(): injectable (the harness), cfg: overrides of CFG }
  const recover = async (helpers, ctx) => {
    const c = ctx || {};
    const C = { ...CFG, ...(c.cfg || {}) };
    const res = Array.isArray(c.res) ? c.res : [];
    const reqs = Array.isArray(c.reqs) ? c.reqs : [];
    const prop = T(c.prop);
    const refused = [];
    res.forEach((j, i) => { const r = refusal(j, prop); if (r) refused.push([i, r]); });
    if (!refused.length) return { items: res, report: null };
    const now = typeof c.now === 'function' ? c.now : () => Date.now();
    const sleep = typeof c.sleep === 'function' ? c.sleep : (ms) => new Promise(ok => setTimeout(ok, ms));
    const H = helpers || {};
    const http = typeof H.httpRequest === 'function' ? (o) => H.httpRequest(o) : null;
    const out = res.slice();
    const report = { reader: 'Jina Reader', path: T(c.path), node: T(c.node), asked: res.length, refused: refused.length, first: brief(refused[0][1]),
      recovered_keyless: 0, recovered_direct: 0, unread: [], keyless_refused: null, keyless_tried: 0, direct_tried: 0, out_of_time: 0 };
    const t0 = now();
    let keylessOk = !!http, lastKeyless = 0;
    for (const [i, r] of refused) {
      const q = reqs[i] || {};
      let url = '';
      try { url = T(typeof c.target === 'function' ? c.target(q, i) : (q.url || '')); } catch (e) { url = ''; }
      if (/^https?:\/\/r\.jina\.ai\//i.test(url)) url = url.replace(/^https?:\/\/r\.jina\.ai\//i, '');
      const why = [];
      let got = null;
      const over = () => now() - t0 > C.budget_ms;
      if (!url) why.push('the request carried no page address');
      else if (!http) why.push('no fallback reader is available here');
      if (url && http && keylessOk && report.keyless_tried < C.keyless_max && !over()) {
        const wait = lastKeyless ? C.keyless_gap_ms - (now() - lastKeyless) : 0;
        if (wait > 0) await sleep(wait);
        report.keyless_tried++; lastKeyless = now();
        try {
          const x = await http({ method: 'GET', url: READER + url, headers: { ...(c.headers || {}) }, timeout: C.keyless_timeout_ms, returnFullResponse: true, ignoreHttpStatusErrors: true, json: false });
          const st = Number(x && x.statusCode) || 0; const body = bodyText(x && x.body);
          if (st >= 200 && st < 300 && T(body) && !errorBody(body)) got = { via: 'reader_keyless', body };
          else { const rr = fromBody(st, body); if (isRefusal(rr)) { keylessOk = false; report.keyless_refused = brief(rr); }
            why.push('the reader without the key answered ' + (st ? 'HTTP ' + st : 'nothing') + (rr.name ? ' ' + rr.name : '')); }
        } catch (e) { why.push('the reader without the key failed: ' + msgOf(e)); }
      } else if (url && http && !keylessOk) why.push('the reader without the key refused too (' + describe(report.keyless_refused) + ')');
      else if (url && http && report.keyless_tried >= C.keyless_max) why.push('the reader without the key was already used ' + C.keyless_max + ' times in this step (its rate limit)');
      if (!got && url && http && c.mode !== 'html' && report.direct_tried < C.direct_max && !over()) {
        report.direct_tried++;
        try {
          const x = await http({ method: 'GET', url, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, timeout: C.direct_timeout_ms, returnFullResponse: true, ignoreHttpStatusErrors: true, json: false });
          const st = Number(x && x.statusCode) || 0; const html = bodyText(x && x.body);
          const blocked = typeof LK !== 'undefined' ? LK.challenge(st, html) : /just a moment|access denied|captcha/i.test(html.slice(0, 3000));
          if (st >= 200 && st < 300 && /<html|<body|<head|<p[\s>]|<div[\s>]/i.test(html) && !blocked) {
            const text = toReaderText(html, url, { links: !!c.links, domain: typeof c.domain === 'function' ? T(c.domain(q)) : '' });
            if (plainLen(text) >= C.min_text_chars) got = { via: 'direct', text, html };
            else why.push('a direct fetch of the page found almost no text (' + plainLen(text) + ' characters)');
          } else why.push('a direct fetch of the page answered ' + (st ? 'HTTP ' + st : 'nothing') + (blocked ? ' (a bot check)' : ''));
        } catch (e) { why.push('a direct fetch of the page failed: ' + msgOf(e)); }
      } else if (!got && c.mode === 'html') why.push('a render (the page after its scripts ran) has no plain-HTML stand-in');
      if (!got && over()) { report.out_of_time++; why.push('the fallback ran out of time for this step'); }
      const mark = { via: got ? got.via : 'none', refused: brief(r), path: report.path, node: report.node };
      if (got && got.via === 'reader_keyless') report.recovered_keyless++;
      if (got && got.via === 'direct') report.recovered_direct++;
      if (got) {
        const body = got.via === 'direct' ? got.text : got.body;
        out[i] = c.mode === 'html' ? (c.full ? { statusCode: 200, body, headers: {}, reader_fallback: mark } : { [prop || 'data']: body, reader_fallback: mark })
          : { [prop || 'data']: body, reader_fallback: mark };
      } else {
        const text = 'the page reader refused (' + describe(r) + ') and the fallback could not read the page' + (why.length ? ': ' + why.join('; ') : '');
        out[i] = { error: { message: text.slice(0, 600), reader_refused: true, status: r.status }, reader_fallback: { ...mark, why: why.join('; ').slice(0, 400) } };
        report.unread.push({ index: i, url, why: why.join('; ').slice(0, 300) });
      }
    }
    return { items: out, report };
  };

  // ---- what a run's own reads say (the content run's decisions read this) ----
  const marks = (items) => (items || []).map(j => (j && j.json && typeof j.json === 'object' ? j.json : j) || {}).map(j => j.reader_fallback || null).filter(Boolean);
  const refusedIn = (items) => marks(items).filter(m => m.refused);
  const unreadIn = (items) => marks(items).filter(m => m.refused && m.via === 'none');
  // the first refusal seen in a list of node outputs (for the reason the client reads)
  const firstRefusal = (lists) => { for (const l of lists || []) { const m = refusedIn(l)[0]; if (m) return m.refused; } return null; };
  const reasonText = (r) => 'the page reader we use refused to read pages' + (r ? ' (' + describe(r) + ')' : '') + ', and reading them another way failed too';
  // the same, in words a client reads (no vendor, no error code: those are in the run's record and the ops alert)
  const clientReason = (r) => {
    const st = r ? Number(r.status) : 0;
    return (st === 402 ? 'the service we use to read web pages stopped answering us because of an account problem on our side'
      : st === 401 || st === 403 ? 'the service we use to read web pages refused our access, a problem on our side'
      : st === 429 ? 'the service we use to read web pages asked us to slow down'
      : 'the service we use to read web pages did not answer') + ', and reading the pages another way did not work either';
  };
  // a path that reads several hosts' pages through the reader wants one address form (the reader node of a homepage read asks for the bare
  // host, `https://<domain>`, and so does its fallback; redirects are followed by both)
  const homeOf = (host) => { const h = T(host); return /^https?:\/\//i.test(h) ? h : (h ? 'https://' + h.replace(/^\/+/, '') : ''); };

  return { CFG, refusal, recover, describe, brief, toReaderText, plainLen, marks, refusedIn, unreadIn, firstRefusal, reasonText, clientReason, homeOf, isRefusal, fromBody, errorBody };
})();
const S = (v) => String(v == null ? '' : v).trim();
const items = $input.all().map(i => (i && i.json) || {});
const marks = RD.refusedIn(items);
if (!marks.length) return [{ json: { skip: true, reason: 'the page reader answered every read of this step' } }];
const first = marks[0].refused || {};
const keyless = marks.filter(m => m.via === 'reader_keyless').length;
const direct = marks.filter(m => m.via === 'direct').length;
const unread = marks.filter(m => m.via === 'none').length;
const head = 'The page reader refused reads: HTTP ' + (first.status || '?') + (first.name ? ' ' + first.name : '');
const what = first.status === 402 ? 'the reader account is out of balance: recharge it, or put a funded key in SEO_JINA_API_KEY (credential SEOcredJinaReade)'
  : first.status === 401 || first.status === 403 ? 'the reader key was refused: check SEO_JINA_API_KEY (credential SEOcredJinaReade)'
  : 'the reader is limiting this key: check its plan and how many runs read pages at once';
const detail = 'Step "' + S(marks[0].path || marks[0].node) + '": ' + marks.length + ' of ' + items.length + ' read(s) refused'
  + (first.message ? ' ("' + S(first.message).slice(0, 140) + '")' : '') + '; the fallback read ' + keyless + ' through the reader without the key and '
  + direct + ' directly, ' + unread + ' could not be read. What to do: ' + what + '.';
const alert = { workflow: 'SEO Agent \u2014 Backlink Monitor', node: 'Page reader (Jina Reader)', message: head,
  subject: '[critical] ' + head + ' (' + 'SEO Agent \u2014 Backlink Monitor' + ')', execution_id: S($execution.id), execution_url: '', mode: 'reader' };
return [{ json: { alert, alert_key: OA.keyOf(alert), detail, refused: marks.length, unread, keyless, direct, step: S(marks[0].path || marks[0].node) } }];
