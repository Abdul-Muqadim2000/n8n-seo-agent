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
