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
// ---- link kit (v4.10, inlined by build_monitors.py): reads a fetched page the way a link checker does — the links to a site with their rel,
// anchor and placement, page facts (noindex, canonical, outbound links, language) and contact e-mails. Regex only: the n8n sandbox has no URL
// constructor and no DOM. Hosts are compared without "www." (crawls report www. URLs while canonicals often use the bare host).
const LK = (() => {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
  const ent = (() => {
    const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
    return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
      if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
      const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
    });
  })();   // R62: named + decimal + hex, one pass (the same body as v5/code/_entities.js)
  const text = (s) => ent(String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const attr = (attrs, name) => { const m = String(attrs || '').match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? ent(m[1] ?? m[2] ?? m[3] ?? '') : null; };
  const hostOf = (u) => { const m = String(u || '').trim().match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : ''; };
  // RV-8 (2026-10-21): suffixes that are sold one level down like a TLD ("ggmap.us.com" is a site of its own; "us.com" is nobody). Without them
  // the disavow file held `domain:us.com`, which would disavow every *.us.com site. The country second levels (co.uk, com.au, co.ae ...)
  // are the rule below; these are the private ones a link profile meets.
  const MULTI = new Set(['us.com', 'uk.com', 'eu.com', 'de.com', 'br.com', 'cn.com', 'gb.com', 'gr.com', 'hu.com', 'jpn.com', 'kr.com', 'no.com', 'qc.com', 'ru.com', 'sa.com', 'se.com', 'uy.com', 'za.com', 'ae.org', 'us.org', 'gb.net', 'uk.net', 'se.net', 'jp.net', 'in.net', 'eu.org']);
  const regDomain = (h) => { const p = String(h || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    if (MULTI.has(p.slice(-2).join('.'))) return p.slice(-3).join('.');
    const sld = /^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/; return (sld.test(p[p.length - 2]) && p[p.length - 1].length === 2) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  // a public (or privately sold) suffix on its own: never a site, never a line in a disavow file
  const isSuffix = (d) => { const p = String(d || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean); if (p.length < 2) return true;
    return p.length === 2 && (MULTI.has(p.join('.')) || (/^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/.test(p[0]) && p[1].length === 2)); };
  // the ledger key of a linking host: its registrable domain, except on hosting platforms where every subdomain is a different site
  const PLATFORM = /\.(blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|medium\.com|substack\.com|github\.io|gitlab\.io|wixsite\.com|weebly\.com|webflow\.io|squarespace\.com|netlify\.app|vercel\.app|pages\.dev|herokuapp\.com|web\.app|firebaseapp\.com|blogger\.com|livejournal\.com|over-blog\.com|jimdosite\.com|site123\.me|webnode\.[a-z]+|strikingly\.com|carrd\.co|notion\.site|super\.site|hashnode\.dev|dev\.to|translate\.goog)$/;
  const refKey = (h) => { const x = String(h || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); return PLATFORM.test(x) ? x : regDomain(x); };
  const sameSite = (host, domain) => { const h = String(host || '').toLowerCase().replace(/^www\./, ''), d = String(domain || '').toLowerCase().replace(/^www\./, ''); return !!h && !!d && (h === d || h.endsWith('.' + d)); };
  // D23 (2026-10-11 system review): one list of tracking parameters, for comparing URLs (normUrl) and for the URLs we store and show
  // (cleanUrl). `srsltid` (Google Shopping) and `utm_source=chatgpt.com` were kept in stored links before, so the same page counted
  // twice and outreach quoted a tagged URL.
  const TRACK = /^(utm_[a-z_]*|srsltid|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|ref|ref_src|referrer|_hsenc|_hsmi|hsa_[a-z]+|spm|at_[a-z_]+|mkt_tok)$/i;
  const dropTrack = (q) => String(q || '').replace(/^\?/, '').split('&').filter(kv => kv && !TRACK.test(kv.split('=')[0])).join('&');
  const normUrl = (u) => { const s = String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '');
    const i = s.indexOf('?'); const q = i < 0 ? '' : dropTrack(s.slice(i)); const base = (i < 0 ? s : s.slice(0, i)).replace(/\/+$/, '');
    return base + (q ? '?' + q : ''); };
  // the URL as we keep it (scheme and host as they are, the real query kept): for from_url, source_url and anything a person opens
  const cleanUrl = (u) => { const s = String(u || '').trim().replace(/#.*$/, ''); const i = s.indexOf('?');
    if (i < 0) return s; const q = dropTrack(s.slice(i)); return s.slice(0, i) + (q ? '?' + q : ''); };
  const decodeAll = (s) => { let x = String(s || ''); for (let i = 0; i < 3; i++) { try { const y = decodeURIComponent(x); if (y === x) break; x = y; } catch (e) { break; } } return x; };
  // where on the page an index sits: the innermost structural element decides (an "aside" inside "main" is a sidebar, a "header" inside "article" is nav)
  // the innermost structural element decides: an "aside" inside "main" is a sidebar, a "header" inside "article" is nav
  // whole class / id / role tokens, not substrings: page builders put "widget" or "header" in every wrapper (Elementor's "elementor-widget-container")
  function placeOf(stack) {
    const is = (toks, re) => toks.some(t => re.test(t));
    for (let i = stack.length - 1; i >= 0; i--) {
      const { tag } = stack[i]; const toks = stack[i].cls.split(/[\s"'=]+/).filter(t => t && !/^(class|id|role|itemprop)$/.test(t));
      if (is(toks, /^(comments?|comment-[a-z-]+|[a-z-]+-comments?|commentlist|disqus[a-z_-]*|reply|respond)$/)) return 'comment';
      if (tag === 'footer' || is(toks, /^(footer|site-footer|[a-z]+-footer|footer-[a-z-]+|colophon|site-info|copyright|contentinfo)$/)) return 'footer';
      if (tag === 'aside' || is(toks, /sidebar|^(widget|widget-area|widget_[a-z_-]+|secondary|blogroll|related|related-posts|yarpp[a-z-]*|jp-relatedposts|partner-logos|sponsors?|complementary)$/)) return 'sidebar';
      if (tag === 'nav' || tag === 'header' || is(toks, /^(nav|navbar|navigation|menu|[a-z]+-menu|menu-[a-z-]+|[a-z]+-nav|nav-[a-z-]+|breadcrumbs?|masthead|topbar|banner|site-header|header|[a-z]+-header)$/)) return 'nav';
      if (tag === 'article' || tag === 'main' || is(toks, /^(article|entry|entry-content|post|post-content|[a-z]+-content|content|story|prose|main|articlebody|blog-post|single-post|hentry)$/)) return 'content';
    }
    return 'body';
  }
  // one walk over the tags up to `upto` (or the whole page): calls onA(index, stack) at every <a>; scripts / styles skipped
  function walkTags(html, upto, onA) {
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g; const stack = []; let m; let low = null;
    while ((m = re.exec(html)) && m.index < upto) {
      const close = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
      if (!close && (tag === 'script' || tag === 'style' || tag === 'template')) { if (low === null) low = html.toLowerCase(); const end = low.indexOf('</' + tag, re.lastIndex); if (end < 0 || end > upto) break; re.lastIndex = end; continue; }
      if (!close && tag === 'a' && onA) onA(m.index, stack);
      if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue;
      if (close) { let at = -1; for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) { at = i; break; } if (at >= 0) stack.length = at; }
      else stack.push({ tag, cls: ((attrs.match(/\b(?:class|id|role|itemprop)\s*=\s*["'][^"']*["']/gi) || []).join(' ')).toLowerCase() });
    }
    return stack;
  }
  // where on the page an index sits (one link: verify)
  function placementAt(html, idx) { return placeOf(walkTags(html, idx, null)); }
  // where every link of a page sits, in one walk (many links: the Link Builder's dead-link check; v4.13 — placementAt per link re-walked the
  // page each time: 11 minutes on real list pages, live 2026-10-11)
  function anchorPlacements(html) { const out = new Map(); walkTags(String(html || ''), Infinity, (i, stack) => out.set(i, placeOf(stack))); return out; }
  // every <a> on the page that points to the site (directly, or through a redirect / tracking URL that carries it)
  function linksTo(html, domain) {
    const out = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi; let m;
    while ((m = re.exec(html))) {
      const href = attr(m[1], 'href'); if (!href) continue;
      const h = hostOf(href); let indirect = false; let to = href;
      if (!sameSite(h, domain)) { const dec = decodeAll(href); const i = dec.toLowerCase().search(new RegExp('https?:\\/\\/(?:[a-z0-9-]+\\.)*' + String(domain).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\/?#:&]|$)', 'i'));
        if (i < 0 || h === '') continue; indirect = true; to = dec.slice(i).split(/[&\s"'<>]/)[0]; }
      const rel = String(attr(m[1], 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
      const img = (m[2].match(/<img\b[^>]*>/i) || [])[0]; const anchor = text(m[2]).slice(0, 160) || (img ? '[image] ' + String(attr(img, 'alt') || '').slice(0, 120) : '');
      out.push({ href: to, rel, anchor, image: !!img && !text(m[2]), indirect, index: m.index });
    }
    return out;
  }
  function pageFacts(html, headers, url) {
    const H = {}; for (const [k, v] of Object.entries(headers || {})) H[String(k).toLowerCase()] = String(v);
    const robots = [...String(html).matchAll(/<meta\b[^>]*>/gi)].map(x => x[0]).filter(t => /name\s*=\s*["']?(robots|googlebot)\b/i.test(t)).map(t => String(attr(t, 'content') || '').toLowerCase()).join(',') + ',' + String(H['x-robots-tag'] || '').toLowerCase();
    const canonTag = [...String(html).matchAll(/<link\b[^>]*>/gi)].map(x => x[0]).find(t => /rel\s*=\s*["']?canonical\b/i.test(t)); const canonical = canonTag ? attr(canonTag, 'href') || '' : '';
    const own = hostOf(url); const hosts = new Set(); let anchors = 0;
    for (const a of String(html).matchAll(/<a\b([^>]*)>/gi)) { anchors++; const h = hostOf(attr(a[1], 'href')); if (h && !sameSite(h, regDomain(own))) hosts.add(regDomain(h)); }
    const body = text((String(html).match(/<body\b[\s\S]*$/i) || [html])[0]);
    return { title: text((String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 160), lang: String(attr((String(html).match(/<html\b[^>]*>/i) || [''])[0], 'lang') || '').slice(0, 10),
      noindex: /noindex|\bnone\b/.test(robots), nofollow_page: /nofollow|\bnone\b/.test(robots), canonical, canonical_elsewhere: !!canonical && /^(https?:)?\/\//i.test(canonical) && normUrl(canonical) !== normUrl(url),
      outbound_domains: hosts.size, anchors, words: body ? body.split(' ').length : 0,
      js_shell: anchors < 3 && body.split(' ').length < 80 && /<script\b/i.test(html) && (/<(div|main|body)\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt|svelte|main-app)\b/i.test(html) || /enable javascript|requires javascript|javascript is (disabled|required)/i.test(body)) };   // a client-rendered app, not just a short page
  }
  const contextAt = (html, idx, len = 170) => text(String(html).slice(Math.max(0, idx - 1500), idx + 1500).replace(/^[^<]*>/, '')).slice(0, 2 * len + 40);
  const challenge = (status, html) => { const s = Number(status) || 0; const h = String(html || '').slice(0, 60000);
    return /cf-browser-verification|challenge-platform|cf_chl_|Just a moment\.\.\.|Attention Required! \| Cloudflare|Enable JavaScript and cookies to continue|_Incapsula_Resource|Request unsuccessful\. Incapsula|px-captcha|perimeterx|datadome|captcha-delivery|Access Denied<\/title>|Pardon Our Interruption/i.test(h) || ((s === 403 || s === 429 || s === 503) && h.length < 30000); };
  // e-mail addresses an outreach could go to (mailto first, then text), without image names, tracking and platform addresses
  function emailsIn(html, domain) {
    const BAD = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(sentry|wixpress|example|domain|email|yoursite|sentry-next)\.|^(no-?reply|donotreply|privacy|abuse|postmaster|webmaster|dpo|legal|gdpr|unsubscribe)@|@2x|u00/i;
    const found = new Map(); const add = (e, w) => { const x = ent(String(e || '')).toLowerCase().replace(/^mailto:/, '').split('?')[0].trim(); if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(x) || BAD.test(x)) return; found.set(x, Math.max(found.get(x) || 0, w + (sameSite(x.split('@')[1], domain) ? 2 : 0) + (/^(editor|editorial|news|press|media|pr|content|hello|info|contact|partnerships?|marketing)@/.test(x) ? 1 : 0))); };
    for (const m of String(html).matchAll(/href\s*=\s*["']mailto:([^"'>\s]+)/gi)) add(m[1], 3);
    for (const m of text(html).matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) add(m[0], 1);
    for (const m of String(html).matchAll(/"email"\s*:\s*"([^"]+)"/gi)) add(m[1], 2);
    return [...found.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 3);
  }
  // one fetched page against the site: was the link found, how, and where
  function verify(page, domain, opts = {}) {
    const status = Number(page.statusCode || page.status || 0); const html = String(page.body ?? page.data ?? '');
    const err = page.error ? String(page.error.message || page.error.description || page.error).slice(0, 160) : '';
    if (err && !html) { const gone = /ENOTFOUND|getaddrinfo ENOTFOUND|NXDOMAIN|certificate has expired|ERR_TLS_CERT_ALTNAME|ECONNREFUSED/i.test(err); return { verify: gone ? 'gone' : 'error', status, error: err }; }
    if (status === 404 || status === 410) return { verify: 'gone', status };
    if (challenge(status, html)) return { verify: 'blocked', status };
    if (status >= 500 || (status && status >= 400)) return { verify: 'error', status };
    const facts = pageFacts(html, page.headers, opts.url || '');
    const links = linksTo(html, domain);
    if (!links.length) return { verify: facts.js_shell ? 'js' : 'missing', status, ...facts };
    const best = links.map(l => ({ ...l, placement: placementAt(html, l.index), follow: !l.rel.some(r => r === 'nofollow' || r === 'sponsored' || r === 'ugc') && !l.indirect && !facts.nofollow_page }))
      .sort((a, b) => (b.follow - a.follow) || ((b.placement === 'content') - (a.placement === 'content')))[0];
    const relKind = best.rel.includes('sponsored') ? 'sponsored' : best.rel.includes('ugc') ? 'ugc' : (best.rel.includes('nofollow') || facts.nofollow_page) ? 'nofollow' : best.indirect ? 'redirect' : 'follow';
    return { verify: 'found', status, ...facts, to_url: best.href, anchor: best.anchor, rel: relKind, placement: best.placement, image: best.image, links_on_page: links.length, context: contextAt(html, best.index) };
  }
  // a page that names the brand: with or without a link to the site (unlinked mentions are the warmest outreach)
  function mention(page, domain, brandRes) {
    const v = verify(page, domain); const html = String(page.body ?? page.data ?? '');
    if (v.verify === 'found') return { ...v, named: true };
    if (v.verify !== 'missing') return { ...v, named: false };
    const t = text(html); let at = -1; for (const re of brandRes) { const i = t.search(re); if (i >= 0 && (at < 0 || i < at)) at = i; }
    return { ...v, named: at >= 0, context: at >= 0 ? t.slice(Math.max(0, at - 160), at + 200) : '' };
  }
  // what kind of site a referrer is: GA4 referrals include e-mail, chat, search and payment hosts that are not links on the web
  const KIND = [
    ['search', /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|qwant|brave|startpage|naver|seznam|search\.yahoo|aol|ask)\.[a-z.]+$/],
    ['ai', /(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|claude\.ai|deepseek\.com|grok\.com|meta\.ai|you\.com|poe\.com|phind\.com|mistral\.ai|kagi\.com)$/],
    ['mail', /(^|\.)(mail\.google|outlook\.(live|office|office365)|mail\.yahoo|webmail|zimbra|roundcube|teams\.(microsoft|live)|teams\.public\.onecdn\.static\.microsoft|statics\.teams\.cdn\.office\.net|slack|discord|web\.whatsapp|web\.telegram|zoom\.us|mail\.)/],
    ['tool', /(^|\.)(stripe|paypal|checkout|accounts\.google|login\.microsoftonline|okta|auth0|hubspot|salesforce|zendesk|intercom|calendly|docs\.google|drive\.google|sharepoint|notion\.so|trello|asana|atlassian|github\.dev|localhost|127\.0\.0\.1|translate\.goog|googleusercontent|ampproject|webcache)\b/],
    ['social', /(^|\.)(linkedin|lnkd|facebook|fb|instagram|twitter|x|t|tiktok|youtube|youtu|pinterest|reddit|quora|threads|snapchat|tumblr|medium|vk|weibo|wechat|telegram|t\.co)\.[a-z.]+$|^(t\.co|lnkd\.in|youtu\.be|fb\.me)$/],
  ];
  // infrastructure: CDNs, storage, link shorteners and whole hosting platforms (the Common Crawl graph reports "blogspot.com" or
  // "amazonaws.com" as one domain) — they appear in link graphs but nobody there can be asked for a link (live finding 2026-10-08)
  const INFRA = /(^|\.)(amazonaws\.com|cloudfront\.net|akamai(hd|edge|ized)?\.net|edgesuite\.net|azureedge\.net|azurewebsites\.net|windows\.net|googleusercontent\.com|googleapis\.com|gstatic\.com|ggpht\.com|appspot\.com|app\.link|bit\.ly|t\.co|goo\.gl|ow\.ly|lnkd\.in|tinyurl\.com|rebrand\.ly|blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|squarespace\.com|github\.io|gitlab\.io|herokuapp\.com|netlify\.app|vercel\.app|pages\.dev|web\.app|firebaseapp\.com|doubleclick\.net|addthis\.com|sharethis\.com|cdninstagram\.com|fbcdn\.net|jsdelivr\.net|cloudflare\.com|wp\.com|gravatar\.com|archive\.org|translate\.goog)$/i;
  const isInfra = (d) => INFRA.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  // auto-generated pages that name every domain (WHOIS, "site worth", site statistics, similar-site lists): not mentions, not prospects
  // (live finding 2026-10-08: whois.com came back as an "unlinked mention" of techand.ai)
  const SCRAPER = /(^|[.-])(whois|who\.is|worth|siteprice|sitestats?|site-?info|hypestat|similarsites?|sitelike|sitesimilar|websiteoutlook|statshow|domaintools|robtex|builtwith|urlscan|siteindices|dnslytics|ipaddress|host\.io|domainbigdata|webstatsdomain|siteliner|rank2traffic|websiteinformer|informer|valuation|traffic-?estimate|seo-?analy[sz]er|seositecheckup|sitechecker|webrank|domainstats)/i;
  const isScraper = (d) => SCRAPER.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  // G18-1 (2026-10-12, the accuracy set): a SEARCH-RESULTS page of someone else's site. Its content is whatever was typed into a search box,
  // it is noindex or canonicalised away on most sites, and Google passes nothing from it — yet robuta.com/?q=business+impact came back as
  // techand.ai's best link (SEO value 57, above OpenPeppol's members list at 35) because only whois / stats / valuation hosts counted as
  // scrapers. The shapes: a path segment "search" / "suche" / "recherche" / "busca" (/search, /en/search/), a search script
  // (/search.php, /results.aspx), or a query that carries the search term (?q= / ?s= / ?query= / ?search= / ?keyword= / ?term= / ?k=).
  // Query keys only, never a value, and only on a whole key, so ?qid=, ?src= and ?ref= are not searches. The caller decides what to do with
  // it (Parse Backlinks labels such a page "scraper" when nothing ties the host to our topics, so LK.values' cap of 5 applies).
  const SEARCH_PATH = /(^|\/)(search|searchresults|suche|recherche|busca|buscar|zoeken)(\/|\.(php|html?|aspx?|jsp)$|$)/i;   // "results" alone is left out on purpose: /results/ is a real page on plenty of sites
  const SEARCH_Q = /^(q|s|k|kw|query|search|searchterm|search_term|searchword|keyword|keywords|term|suche|wd)$/i;
  const isSearchPage = (u) => { const s = String(u || '').trim(); if (!s) return false;
    const noHost = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/?#]*/i, ''); const i = noHost.indexOf('?');
    const path = (i < 0 ? noHost : noHost.slice(0, i)).replace(/#.*$/, '');
    if (SEARCH_PATH.test(path)) return true;
    if (i < 0) return false;
    return noHost.slice(i + 1).replace(/#.*$/, '').split('&').some(kv => kv.includes('=') && SEARCH_Q.test(kv.split('=')[0]) && kv.split('=').slice(1).join('=').length > 0); };
  // press-release wires: a competitor's link there is a paid release (usually nofollow), not a site to pitch (live finding 2026-10-08:
  // prnewswire.co.uk and kyodonewsprwire.jp ranked among techand.ai's top gap prospects once Ahrefs DR was on)
  const WIRE = /(^|\.)(prnewswire|businesswire|globenewswire|einpresswire|einnews|accesswire|newswire|prweb|prlog|openpr|newsfilecorp|issuewire|presswire|kyodonewsprwire|marketwired|newsdirect|pressat|24-7pressrelease|prunderground|send2press|realwire|pressebox|presseportal|newsvoir|prfire|cision)\.[a-z.]+$/i;
  const isWire = (d) => WIRE.test(String(d || '').toLowerCase().replace(/^www\./, ''));
  const domainKind = (d, site) => { const x = String(d || '').toLowerCase().replace(/^www\./, ''); if (!x) return 'unknown'; if (site && sameSite(x, site)) return 'self'; for (const [k, re] of KIND) if (re.test(x)) return k; return 'web'; };
  // A link's value on three scales, 0-100 each (a link can matter for one and not the others):
  // - seo: what it passes in search. Weighted signals (authority 30, relevance 20, traffic of the linking page 15, placement 10, editorial
  //   integrity 10, cleanliness 10, anchor 5) times hard gates — a lost link, a noindex page or a canonical pointing elsewhere passes (almost)
  //   nothing; rel nofollow / ugc / sponsored are hints (partial weight). Missing inputs count as average.
  // - referral: the visits it sends (GA4 referral sessions a year; key events add).
  // - brand: earned media and sources AI assistants cite (editorial / press / resource / listing, AI-cited domains, authority).
  // authority: DataForSEO rank 0-1000 (or a Tranco position); relevance 0-1 (Link Analyst 0-3 / 3, else topic words); link_type from the analyst.
  function values(l) {
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const auth = Math.max(l.authority > 0 ? clamp((Number(l.authority) - 40) / 520) : 0, l.tranco > 0 ? clamp(1 - Math.log10(Number(l.tranco)) / 6.2) * 0.9 : 0);
    const authKnown = l.authority > 0 || l.tranco > 0;
    const rel = l.relevance == null || l.relevance === '' ? 0.5 : clamp(Number(l.relevance));
    const visits = Number(l.visits) || 0, kw = Number(l.page_keywords) || 0;
    const traffic = kw > 0 ? clamp(Math.log10(1 + kw) / 2.5) : visits > 0 ? 0.5 : 0.2;
    const place = { content: 1, body: 0.65, sidebar: 0.4, nav: 0.3, footer: 0.2, comment: 0.1 }[l.placement || 'body'] ?? 0.6;
    const editorial = (l.original === false ? 0.4 : 1) * (Number(l.sitewide) >= 20 ? 0.5 : 1) * (['guest_post', 'sponsored'].includes(l.link_type) ? 0.4 : 1);
    const clean = clamp(1 - (Number(l.spam) || 0) / 100) * (Number(l.outbound) > 150 ? 0.5 : Number(l.outbound) > 60 ? 0.8 : 1);
    const anchor = l.anchor_kind === 'money' && rel < 0.5 ? 0.2 : 1;
    let seo = 100 * (0.3 * (authKnown ? auth : 0.15) + 0.2 * rel + 0.15 * traffic + 0.1 * place + 0.1 * editorial + 0.1 * clean + 0.05 * anchor);
    const gate = (l.status === 'lost' ? 0 : 1)   // a link missed once (at risk) keeps its value until a second miss confirms the loss
      * (l.noindex ? 0.1 : 1) * (l.canonical_elsewhere ? 0.3 : 1)
      * (l.kind === 'social' ? 0.3 : ({ follow: 1, redirect: 0.8, ugc: 0.3, nofollow: 0.3, sponsored: 0.15 }[l.rel] ?? 0.8));   // social profile links are nofollow; a rel nobody checked yet counts 0.8
    seo *= gate;
    const cap = { scraper: 5, spam: 0, directory: 40, profile: 35, comment: 15, forum: 50 }[l.link_type || ''];
    if (cap != null) seo = Math.min(seo, cap);
    const keyEvents = Number(l.key_events) || 0;
    const referral = visits > 0 ? Math.min(100, 22 * Math.log10(1 + visits) + (keyEvents > 0 ? 15 + 10 * Math.log10(1 + keyEvents) : 0)) : 0;
    const earned = { editorial: 1, press: 1, resource: 0.8, listing: 0.85, partner: 0.6, forum: 0.45, profile: 0.35, directory: 0.3 }[l.link_type || ''] ?? (l.kind === 'social' ? 0.3 : l.placement === 'content' ? 0.5 : 0.25);
    const brand = l.link_type === 'spam' || l.link_type === 'scraper' ? 0 : Math.min(100, 100 * (0.55 * earned + 0.25 * (authKnown ? auth : 0.15) + (l.ai_cited ? 0.25 : 0)));
    return { seo: Math.round(seo), referral: Math.round(referral), brand: Math.round(brand) };
  }
  const quality = (l) => values(l).seo;
  // anchor kinds (a money-keyword anchor from an off-topic page is a flag; branded / URL / generic anchors are natural)
  const anchorKind = (anchor, domain, brands = []) => { const a = String(anchor || '').toLowerCase().trim(); if (!a || /^\[image\]/.test(a)) return 'image_or_empty';
    const label = String(domain || '').toLowerCase().replace(/^www\./, '').split('.')[0];
    if (a.includes(String(domain).toLowerCase()) || /^(https?:\/\/|www\.)/.test(a)) return 'url';
    if ((label.length >= 4 && a.replace(/[^a-z0-9]/g, '').includes(label)) || brands.some(b => b && a.includes(String(b).toLowerCase()))) return 'brand';
    if (/^(click here|here|this|read more|more|website|link|source|visit( site| website)?|learn more|this article|this post|view|official site|homepage)$/.test(a)) return 'generic';
    return 'money'; };
  // ---- footprint gate (D3, 2026-10-11) ----
  // Link farms sell the same page on many domains: one PBN network linked techand.ai from 16 domains with one path (/all/2835/13.html) and
  // one anchor ("High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service …"), some on casino hosts; the index flagged 4 and
  // the other 12 ranked above peppol.org as "best links" (live 2026-10-11). A cluster is: the same page path or the same keyword anchor on 3+
  // referring sites, an anchor or page title that advertises link selling or gambling, a gambling host, or a page path shared with such a
  // page. Members get link_type "spam" (SEO and brand value 0), stay out of best links, alerts and impact tracking and go on the disavow
  // candidates (review-only). Bounds: a path with one plain segment (/partners, /links) or made of generic words (/en/partners) never
  // clusters, nor do brand / URL / generic anchors or anchors under 4 words (every partner page and every brand mention would); an anchor
  // that is one of the site's own page titles is a citation, not a footprint. One list of link-selling words for every consumer (SPAM_RE).
  const SPAM_RE = /\b(?:pbn|private blog network|buy (?:cheap |quality |high[- ]quality )?(?:backlinks?|links?)|backlinks? (?:service|package|for sale|provider)|dofollow (?:backlinks?|links?)|high[- ]quality (?:backlinks?|links?)|link ?farms?|guest post services?|link building services?|da ?\d{1,2}\W{0,3}pa ?\d{1,2}|casinos?|betting|slots?|gambling|poker|jackpot|sportsbook|bookmakers?|porn|xxx|viagra|cialis|payday loans?|escorts?|essay writing)\b/i;
  const GAMBLING = /casino|poker|gambl|jackpot|sportsbook|bookmaker|roulette|blackjack|baccarat|betwinner|1xbet|mostbet|melbet|parimatch|bet365|betway|unibet|bwin|slotgacor/i;   // unambiguous substrings only ("alphabet" is not a bet)
  const isGambling = (d) => { const x = String(d || '').toLowerCase().replace(/^www\./, ''); return GAMBLING.test(x) || x.split(/[.-]/).some(t => /^(bets?|betting|slots?|lotto|lottery|toto|togel|judi|gacor)$/.test(t)); };
  const GENERIC = /^(en|de|fr|es|it|ar|nl|pt|ru|zh|ja|blog|news|partners?|links?|resources?|clients?|about|about-us|directory|members?|sponsors?|vendors?|tools?|category|tag|page|pages|home|contact|sitemap|index|posts?|articles?|press|media|portfolio|services?|products?|solutions?|team|company)$/;
  const footPath = (u) => { const p = String(u || '').replace(/^https?:\/\/[^\/?#]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase().replace(/\/index\.(html?|php)$/, ''); const seg = p.split('/').filter(Boolean);
    if (!seg.length || seg.every(x => GENERIC.test(x)) || (seg.length === 1 && !/\d/.test(p))) return ''; return p; };
  // rows: anything with ref_domain (or from_url), from_url, anchor and page_title / title. Returns Map ref_domain → reason.
  function footprints(rows, opts = {}) {
    const out = new Map(); const set = (d, why) => { if (d && !out.has(d)) out.set(d, why); };
    const titles = (opts.titles || []).map(t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(t => t.length >= 8);
    const items = []; const byPath = new Map(), byAnchor = new Map();
    for (const r of rows || []) { if (!r) continue; const d = String(r.ref_domain || refKey(hostOf(r.from_url)) || '').toLowerCase(); if (!d) continue;
      const path = footPath(r.from_url); const a = String(r.anchor || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const ak = a && a.split(' ').length >= 4 && anchorKind(a, opts.domain || '', opts.brands || []) === 'money' && !titles.some(t => t.includes(a) || a.includes(t)) ? a : '';
      items.push({ d, path, ak, r });
      if (path) { if (!byPath.has(path)) byPath.set(path, new Set()); byPath.get(path).add(d); }
      if (ak) { if (!byAnchor.has(ak)) byAnchor.set(ak, new Set()); byAnchor.get(ak).add(d); } }
    for (const [p, ds] of byPath) if (ds.size >= 3) for (const d of ds) set(d, 'the same page path on ' + ds.size + ' sites (' + p.slice(0, 60) + ')');
    for (const [a, ds] of byAnchor) if (ds.size >= 3) for (const d of ds) set(d, 'the same keyword anchor on ' + ds.size + ' sites ("' + a.slice(0, 60) + '")');
    for (const x of items) { const txt = String(x.r.anchor || '') + ' | ' + String(x.r.page_title || x.r.title || '');
      if (SPAM_RE.test(txt)) set(x.d, 'the anchor or page title sells links or gambling ("' + String(x.r.anchor || x.r.page_title || x.r.title || '').replace(/\s+/g, ' ').slice(0, 60) + '")');
      else if (isGambling(x.d)) set(x.d, 'a gambling site'); }
    for (const [p, ds] of byPath) if (ds.size >= 2 && [...ds].some(d => out.has(d))) for (const d of ds) set(d, 'shares its page path with a link-farm page (' + p.slice(0, 60) + ')');
    return out;
  }
  return { text, attr, hostOf, regDomain, isSuffix, refKey, sameSite, isInfra, isScraper, isSearchPage, isWire, normUrl, cleanUrl, placementAt, anchorPlacements, linksTo, pageFacts, contextAt, challenge, emailsIn, verify, mention, domainKind, quality, values, anchorKind, SPAM_RE, isGambling, footPath, footprints };
})();
// ---- client render kit (FU-R1, page-quality programme 2026-10-29; inlined by build_v4.py section 170 after the link kit) ----
// The page run reads the client's own pages through the text reader (Read Client Pages) and one plain GET (Read Client Page HTML). On a
// client-rendered site (a React / Vue / Angular app) both come back empty: the reader answered "Markdown Content:" and nothing else, the GET
// is a script shell. The BEFORE run read 0 of the site's own pages on both own-site runs (K7 / K8), so the brief had no services, no proof
// and no internal links from the real site. This kit decides which of the run's own pages need the renderer the audit already uses (Jina
// Reader with `X-Engine: browser`, `X-Return-Format: html`: the page after its scripts ran, as Render Key Pages reads it), turns a rendered
// page into the reader's line format (headings as "#" lines, list items, paragraphs), and finds the site's own links on the rendered
// homepage (the menu a sitemap would have listed). Regex only (the n8n sandbox has no URL constructor and no DOM); it needs LK (the link kit).
// A server-rendered page never reaches it: render() is asked only when the reader's text was too short AND the HTML was a script shell.
const CRK = (() => {
  // bounded: at most 3 renders a run (the pages the reader could not read, then up to 2 pages linked from the rendered homepage)
  const CONFIG = { max_pages: 3, more_pages: 2, min_text_chars: 200, shell_words: 80, links_kept: 25 };
  const S = (x) => String(x == null ? '' : x);
  // the reader's text, cleaned the way Collect Client Pages cleans it (its 200-character rule decides whether a page was read)
  const readerText = (j) => S(j && (j.page_text != null ? j.page_text : j.data))
    .replace(/^(Title|URL Source|Markdown Content|Published Time):.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]+/g, '').replace(/^#+\s*/gm, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const htmlOf = (j) => { const x = j || {}; if (x.error && !x.page_html && !x.body && !x.data) return ''; return S(x.page_html != null ? x.page_html : (x.html != null ? x.html : (x.body != null ? x.body : x.data))); };
  const statusOf = (j) => Number((j || {}).statusCode || (j || {}).status || 0) || 0;
  const bodyWords = (h) => { const b = (S(h).match(/<body\b[\s\S]*$/i) || [S(h)])[0]; const t = LK.text(b); return t ? t.split(' ').length : 0; };
  // a script shell: the link kit's own rule (an app root, almost no text, scripts), or an almost empty body that loads a script bundle
  const isShell = (h, url) => { const x = S(h); if (!x) return false;
    if (LK.challenge(0, x)) return false;
    let f = {}; try { f = LK.pageFacts(x, {}, url || '') || {}; } catch (e) { f = {}; }
    return !!f.js_shell || (bodyWords(x) < CONFIG.shell_words && /<script\b[^>]*\bsrc\s*=/i.test(x)); };
  const hostKey = (u) => LK.hostOf(u);
  const sameHost = (u, domain) => { const h = hostKey(u), d = S(domain).toLowerCase().replace(/^www\./, ''); return !!h && !!d && h === d; };
  // does this page of the run need the renderer? Only when the reader got too little text and the plain GET says why: a script shell
  const need = (readerItem, htmlItem, url, domain) => {
    if (!sameHost(url, domain)) return { render: false, why: 'not the website\'s own host' };
    const txt = readerText(readerItem || {});
    if (txt.length >= CONFIG.min_text_chars) return { render: false, why: 'read by the text reader' };
    const h = htmlOf(htmlItem);
    if (!h) return { render: false, why: 'the page could not be fetched' };
    if (LK.challenge(statusOf(htmlItem), h)) return { render: false, why: 'the website answered with a bot check' };
    if (!isShell(h, url)) return { render: false, why: 'the page has text in its HTML but the reader could not read it' };
    return { render: true, why: 'the page is written by JavaScript (its HTML is a script shell with ' + bodyWords(h) + ' words)' };
  };
  // the rendered page, usable? (a bot check, an HTTP error or a still-empty page is "not read", with the reason)
  const rendered = (res) => {
    const r = res || {}; const h = htmlOf(r); const st = statusOf(r);
    if (r.error && !h) return { ok: false, why: 'the render failed: ' + S(r.error.message || r.error.description || r.error).slice(0, 120) };
    if (!h) return { ok: false, why: 'the render returned nothing' };
    if (LK.challenge(st, h)) return { ok: false, why: 'the render hit a bot check' + (st ? ' (HTTP ' + st + ')' : '') };
    if (st >= 400) return { ok: false, why: 'the render answered HTTP ' + st };
    const lines = linesOf(h); const text = lines.join('\n');
    const plain = text.replace(/^#+\s*/gm, '').replace(/^- /gm, '');
    if (plain.length < CONFIG.min_text_chars) return { ok: false, why: 'the rendered page still has almost no text (' + plain.length + ' characters)' };
    return { ok: true, html: h, raw: text };
  };
  // the rendered HTML in the reader's line format: the page's own content (header, menu, footer, aside, forms and cookie banners removed,
  // as Read Client Pages removes them), headings as "#" lines so the headings and dates are measured the same way
  const DROP = /<(script|style|noscript|svg|template|iframe|header|nav|footer|aside|form)\b[\s\S]*?<\/\1\s*>/gi;
  const BANNER = /<(div|section)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:cookie|consent|onetrust|newsletter)[^"']*["'][^>]*>[\s\S]*?<\/\1\s*>/gi;
  function linesOf(html) {
    let b = (S(html).match(/<body\b[\s\S]*$/i) || [S(html)])[0];
    for (let i = 0; i < 3; i++) b = b.replace(DROP, ' ');
    b = b.replace(BANNER, ' ');
    b = b.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (m, n, t) => '\n' + '#'.repeat(Number(n)) + ' ' + LK.text(t) + '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ').replace(/<(td|th)\b[^>]*>/gi, ' | ')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|section|article|li|tr|table|ul|ol|dl|dt|dd|blockquote|figcaption|main)\s*>/gi, '\n');
    const out = [];
    for (const raw of b.split('\n')) { const t = LK.text(raw); if (!t || t === '-' || t === '|') continue; if (out[out.length - 1] === t) continue; out.push(t); }
    return out;
  }
  // the site's own links on a rendered page, with their link text (no images, files, sign-in, legal or anchor-only links)
  const SKIP_PATH = /^\/(?:login|log-in|signin|sign-in|signup|sign-up|register|logout|account|cart|checkout|privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|cookies?|cookie-policy|legal|imprint|impressum|sitemap|search|wp-admin|wp-login\.php|feed|rss)(?:\/|$)/i;
  const FILE = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|docx?|xlsx?|pptx?|mp4|mp3|webm|css|js|json|xml|txt)$/i;
  function links(html, pageUrl, domain) {
    const origin = (S(pageUrl).match(/^https?:\/\/[^\/?#]+/i) || [''])[0];
    const out = []; const seen = new Set();
    for (const m of S(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
      let href = S(LK.attr(m[1], 'href')).trim(); if (!href || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
      if (/^\/\//.test(href)) href = 'https:' + href;
      if (/^\//.test(href)) href = origin + href;
      else if (!/^https?:\/\//i.test(href)) continue;   // relative paths without a leading slash are rare on an app and ambiguous: left out
      if (!sameHost(href, domain)) continue;
      const path = (href.replace(/^https?:\/\/[^\/?#]+/i, '').replace(/[?#].*$/, '') || '/').replace(/\/{2,}/g, '/');
      if (path === '/' || SKIP_PATH.test(path) || FILE.test(path)) continue;
      const url = origin + path; const key = url.toLowerCase().replace(/\/+$/, '');
      if (seen.has(key)) continue; seen.add(key);
      const title = LK.text(m[2]).slice(0, 120) || S(LK.attr(m[1], 'aria-label') || LK.attr(m[1], 'title')).slice(0, 120);
      out.push({ url, path, title });
      if (out.length >= 60) break;
    }
    return out;
  }
  // words of a search that say what it is about (the topic match for the page to read next)
  const STOP = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'best', 'by', 'can', 'do', 'for', 'from', 'get', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'our', 'the', 'to', 'top', 'vs', 'what', 'when', 'which', 'who', 'why', 'with', 'you', 'your']);
  const words = (s) => S(s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter(w => w && w.length >= 2 && !STOP.has(w))
    .map(w => (w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) ? w.slice(0, -1) : w);
  const topicScore = (kw, link) => { const k = [...new Set(words(kw))]; if (!k.length) return 0; const have = new Set(words(link.path.replace(/[\/_-]+/g, ' ') + ' ' + link.title));
    return k.filter(w => have.has(w)).length / k.length; };
  // the hub that lists what the business does; the page run's own list (Client Page Requests) plus the names product sites use
  const HUB = /^\/(?:what-?we-?do|services|our-services|solutions|capabilities|how-we-work|our-approach|approach|offerings|platform|features|products?)\/?$/i;
  // the next pages to read after the rendered homepage: the services hub, then the page closest to the search (at least half its words)
  function pickMore(homeLinks, keyword, alreadyRead, room) {
    const read = new Set((alreadyRead || []).map(u => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')));
    const key = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    const pool = (homeLinks || []).filter(l => !read.has(key(l.url)));
    const out = [];
    const hub = pool.filter(l => HUB.test(l.path)).sort((a, b) => a.path.length - b.path.length)[0];
    if (hub) out.push({ url: hub.url, kind: 'services', title: hub.title, why: 'the page that lists what the business does, linked from the homepage' });
    const scored = pool.filter(l => !hub || key(l.url) !== key(hub.url)).map(l => ({ l, s: topicScore(keyword, l) })).filter(x => x.s >= 0.5)
      .sort((a, b) => b.s - a.s || a.l.path.length - b.l.path.length);
    if (scored.length) out.push({ url: scored[0].l.url, kind: 'related', title: scored[0].l.title, topic_match: Math.round(scored[0].s * 100) / 100, why: 'the page of the website closest to the search, linked from the homepage' });
    return out.slice(0, Math.max(0, room));
  }
  return { CONFIG, readerText, htmlOf, isShell, need, rendered, linesOf, links, pickMore, topicScore, sameHost };
})();
// ---- the one site model (G19, 2026-10-12; see SITE_MODEL_SPEC.md; the builders inline this file where a node asks for the SITE_MODEL kit) ----
// Every workflow reads the same facts about a site through SM: the canonical host, the business name / logo / NAP (seo_profiles ->
// the homepage Organization / LocalBusiness schema -> Google Business Profile -> the fields the web app sent), the services and nav
// pages, the page inventory (seo_pages), the business facts, the call to action, the brand names, the competitors and the
// accreditation status. SM.from() builds the model, SM.toRow() writes it back to the seo_sites columns.
const SM = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const normHost = (v) => S(v).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '');
  const bare = (v) => normHost(v).replace(/^www\./, '');
  const hostOf = (u) => normHost((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '');   // the n8n Code sandbox has no URL constructor
  const siteIdFor = (d) => 'site_' + bare(d).replace(/[^a-z0-9]+/g, '-');
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;|]+/)).map(x => S(x)).filter(Boolean);
  const uniq = (a) => [...new Set(a)];
  const jparse = (v, dflt) => { if (v && typeof v === 'object') return v; try { const o = JSON.parse(S(v) || 'null'); return o == null ? dflt : o; } catch (e) { return dflt; } };
  const STOP = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'your', 'our', 'my']);
  const tokensOf = (s) => S(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  // one-letter parts ("e" of "e invoicing") and stop words never decide a page match: with them "e invoicing uae penalties" would
  // score 3 of 4 against /uae-e-invoicing-fta-rules/ and claim the FTA page (the S26 false-match pair).
  const termsOf = (s) => uniq(tokensOf(s).filter(t => t.length > 1 && !STOP.has(t)));
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, ''); return p || '/'; };
  const strip = (s) => S(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---- the homepage HTML: canonical host, Organization / LocalBusiness schema, nav pages ----
  const ldNodes = (html) => {
    const out = []; const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    const push = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(push); return; } out.push(o); if (Array.isArray(o['@graph'])) o['@graph'].forEach(push); };
    while ((m = re.exec(S(html)))) push(jparse(m[1], null));
    return out;
  };
  const ORG_TYPE = /(organization|corporation|localbusiness|professionalservice|store|ngo|educationalorganization|governmentorganization|onlinebusiness|softwarecompany|company|consultant|accountingservice)/i;
  const typesOf = (o) => [].concat((o && o['@type']) || []).map(t => S(t).toLowerCase());
  const orgFromHtml = (html) => {
    const nodes = ldNodes(html).filter(o => typesOf(o).some(t => ORG_TYPE.test(t)));
    const node = nodes.find(o => typesOf(o).some(t => /localbusiness|professionalservice|store/.test(t))) || nodes[0];
    if (!node) return null;
    const logo = typeof node.logo === 'string' ? node.logo : ((node.logo || {}).url || '');
    return { name: S(node.name), type: typesOf(node).join('/'), telephone: S(node.telephone), email: S(node.email), logo: S(logo),
      sameAs: listOf(node.sameAs), address: (node.address && typeof node.address === 'object') ? node.address : null };
  };
  const navFromHtml = (html, host) => {
    const h = S(html); const zones = [];
    for (const re of [/<nav\b[\s\S]*?<\/nav>/gi, /<header\b[\s\S]*?<\/header>/gi]) { const f = h.match(re); if (f) zones.push(...f); }
    const out = []; const seen = new Set();
    for (const zone of zones) {
      for (const a of (zone.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [])) {
        const href = S((a.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1]);
        if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
        const abs = /^https?:\/\//i.test(href) ? href : (href.charAt(0) === '/' ? 'https://' + host + href : '');
        if (!abs || bare(hostOf(abs)) !== bare(host)) continue;
        const p = pathOf(abs); if (p === '/' || seen.has(p)) continue;
        seen.add(p); out.push({ url: abs, title: strip(a).slice(0, 80), path: p });
        if (out.length >= 12) return out;
      }
    }
    return out;
  };

  // ---- precedence: seo_profiles -> homepage schema -> Google Business Profile -> what the app sent ----
  const pick = (sources, read) => { for (const s of sources) { const v = S(read(s.value) || ''); if (v) return { value: v, source: s.name }; } return { value: '', source: '' }; };

  const from = (siteRow, extras) => {
    const row = (siteRow && typeof siteRow === 'object') ? siteRow : {};
    const x = (extras && typeof extras === 'object') ? extras : {};
    const req = x.request || {};
    const prof = x.profile || {};
    const gbp = x.gbp || {};
    const html = S(x.html || (x.home || {}).html);
    const domain = bare(row.domain || x.domain || req.domain || (x.home || {}).url || '');
    const site_id = S(row.site_id) || S(x.site_id) || (domain ? siteIdFor(domain) : '');
    const org = x.homepage_org || (html ? orgFromHtml(html) : null) || null;

    // canonical host: this run's probe, else the homepage's own canonical tag, else where the homepage request landed, else the stored
    // value, else the bare domain. A canonical tag on another domain is ignored.
    const canonTag = (S(html).match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
    const canonHost = hostOf((canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '');
    const landed = hostOf(x.final_url || (x.home || {}).url || '');
    const fromProbe = normHost(x.canonical_host || (x.probe || {}).canonical_host || '');
    // the site's own live URLs (ladder pages, published pages, sitemap) are evidence too: the host most of them use
    const voted = (() => { const c = {}; for (const u of (x.seen_hosts || [])) { const h = normHost(u.indexOf('/') >= 0 ? hostOf(u) || u : u); if (h && bare(h) === domain) c[h] = (c[h] || 0) + 1; }
      return Object.keys(c).sort((a, b) => c[b] - c[a] || a.length - b.length)[0] || ''; })();
    const candidates = [[fromProbe, 'probe'], [bare(canonHost) === domain ? canonHost : '', 'canonical tag'], [bare(landed) === domain ? landed : '', 'redirect'], [voted, 'live urls'], [normHost(row.canonical_host), 'stored'], [domain, 'domain']];
    const hit = candidates.find(c => c[0]) || [domain, 'domain'];
    const canonical_host = hit[0], host_source = hit[1];

    const SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: org || {} }, { name: 'gbp', value: gbp }, { name: 'app', value: req }, { name: 'stored', value: { business_name: row.business_name, logo_url: row.logo_url } }];
    const nameHit = pick(SRC, (s) => s.business_name || s.name || s.title);
    const logoHit = pick(SRC, (s) => s.logo_url || s.logo || s.photo_url);
    const addr = (org && org.address && typeof org.address === 'object') ? org.address : {};
    const NAP_SRC = [{ name: 'profile', value: prof }, { name: 'homepage_schema', value: { street_address: addr.streetAddress, city: addr.addressLocality, region: addr.addressRegion, postal_code: addr.postalCode, country_code: addr.addressCountry, phone: (org || {}).telephone, public_email: (org || {}).email } },
      { name: 'gbp', value: { street_address: gbp.address, city: gbp.city, phone: gbp.phone } }, { name: 'app', value: req }];
    const street = pick(NAP_SRC, (s) => s.street_address), phone = pick(NAP_SRC, (s) => s.phone);
    const nap = { business_name: nameHit.value, street_address: street.value, city: pick(NAP_SRC, (s) => s.city).value, region: pick(NAP_SRC, (s) => s.region).value,
      postal_code: pick(NAP_SRC, (s) => s.postal_code).value, country_code: pick(NAP_SRC, (s) => s.country_code || s.country).value,
      phone: phone.value, public_email: pick(NAP_SRC, (s) => s.public_email || s.email).value, price_range: S(prof.price_range), source: street.source || phone.source || '' };
    const stored = jparse(row.nap_json, null);
    if (stored && !nap.street_address && !nap.phone) { Object.assign(nap, stored); nap.source = S(stored.source) || 'stored'; }

    // P2-2 (2026-10-12): the Site Describer answers with `products_or_services` — reading only `services` left services_json empty on every
    // site, so the brief's facts said `services: []` although the describer had found nine.
    const desc0 = x.description || {};
    // keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.2 / §14.1): what the client SAID they sell ("What do you sell?" on Track my site,
    // seo_sites.declared_services) comes first and is never dropped by what a crawl read; it is kept apart as well, so SM.toRow writes it back
    // unchanged and the weekly Site Tracker can never overwrite it
    const declListOf = (v) => { if (Array.isArray(v)) return v; const j = jparse(v, null); return Array.isArray(j) ? j : listOf(v); };
    const declared_services = uniq([...declListOf(x.declared_services), ...declListOf(row.declared_services)].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const services = uniq([...declared_services, ...listOf(x.services), ...listOf(desc0.products_or_services), ...listOf(desc0.services), ...listOf(desc0.main_services), ...(jparse(row.services_json, []) || [])].map(s => S(s).slice(0, 80))).filter(Boolean).slice(0, 30);
    const navStored = jparse(row.nav_pages_json, []) || [];
    const navFresh = x.nav_pages || (html && canonical_host ? navFromHtml(html, canonical_host) : []);
    const nav_pages = (navFresh.length ? navFresh : navStored).map(p => ({ url: S(p.url), title: S(p.title), path: S(p.path) || pathOf(p.url) })).filter(p => p.url).slice(0, 12);

    const pages = (Array.isArray(x.pages) ? x.pages : []).map(p => ({ url: S(p.url), title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod),
      queries: Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) })).filter(p => p.url);

    const business_facts = S(req.business_facts || x.business_facts || row.business_facts).slice(0, 2000);
    const cta = S(req.cta || x.cta || row.cta).slice(0, 200);
    const mon = x.monitors || {};
    const brand_names = uniq([...listOf(mon.brand_names), ...listOf(x.brand_names), ...listOf(row.brand_names), nameHit.value].filter(Boolean));
    const competitors = uniq([...listOf(mon.competitors), ...listOf(x.competitors), ...listOf(row.competitors)].map(bare).filter(d => d && d !== domain)).slice(0, 8);
    const accreditation = S(x.accreditation || row.accreditation);
    const updated_at = S(x.updated_at) || S(row.model_updated_at) || new Date().toISOString();

    return { site_id, domain, canonical_host, host_source, home_url: 'https://' + canonical_host + '/',
      business_name: nameHit.value, name_source: nameHit.source, logo_url: logoHit.value, logo_source: logoHit.source,
      nap, services, declared_services, nav_pages, pages, business_facts, cta, brand_names, competitors, accreditation,
      model_updated_at: updated_at, sources: { profile: !!prof.site_id || !!prof.business_name, homepage_schema: !!org, gbp: !!(gbp.name || gbp.phone), app: !!(req.business_facts || req.cta || req.business_name), html: !!html } };
  };

  // every URL the agent emits for a site goes through here: https, the canonical host, no double slash
  const siteUrl = (model, path) => {
    const p = S(path);
    if (/^https?:\/\//i.test(p)) return p;
    const host = normHost((model || {}).canonical_host || (model || {}).domain || '');
    const tail = p ? ('/' + p).replace(/\/{2,}/g, '/') : '/';
    return 'https://' + host + tail;
  };
  const apiTarget = (model) => bare((model || {}).domain || (model || {}).canonical_host || '');   // DataForSEO and the other APIs keep the bare domain
  const name = (model) => S((model || {}).business_name) || bare((model || {}).domain || '');
  const nap = (model) => ((model || {}).nap && typeof model.nap === 'object') ? model.nap : { business_name: '', street_address: '', city: '', region: '', postal_code: '', country_code: '', phone: '', public_email: '', price_range: '', source: '' };
  const services = (model) => Array.isArray((model || {}).services) ? model.services : [];
  const pages = (model) => Array.isArray((model || {}).pages) ? model.pages : [];
  const facts = (model) => {
    const t = S((model || {}).business_facts) + ' ' + S(((model || {}).nap || {}).price_range);
    return { business_facts: S((model || {}).business_facts), cta: S((model || {}).cta), accreditation: S((model || {}).accreditation),
      pricing: /(aed|usd|\$|€|£|price|pricing|cost|fee|per month|per user|from \d)/i.test(t),
      timeline: /(\d+\s*(day|week|month|year)|timeline|go.?live|turnaround|within \d)/i.test(t) };
  };
  // a page of the inventory answers a keyword when it already gets impressions for it, or when at least 75% of the keyword's
  // meaningful words are in its slug or title (D11; keep it even while the inventory is empty).
  const MATCH_MIN = 0.75;
  // R35 (2026-10-16, re-rating 2026-10-15): the words were compared literally, so "d365 finance dubai" did not match a page titled
  // "Dynamics 365 Finance & Operations UAE" and the report told the owner that page "does not target" the search. Three rules, applied
  // to BOTH sides before anything is compared: the product's own short names are written out (d365 = dynamics 365, f&o = finance and
  // operations), a word is compared on a light stem (invoice / invoices / invoicing), and an emirate in the SEARCH is covered by a page
  // about the UAE ("emirate ⊂ uae" — never the other way round: a Dubai page does not answer every UAE search).
  const SYN = [[/\bd\s?365\b/g, 'dynamics 365'], [/\bdynamics365\b/g, 'dynamics 365'], [/\bf\s?&\s?o\b|\bfno\b/g, 'finance operations'], [/\bunited arab emirates\b/g, 'uae'],
    [/\babu dhabi\b/g, 'abudhabi'], [/\bras al khaimah\b/g, 'rasalkhaimah'], [/\bumm al quwain\b/g, 'ummalquwain'], [/\bal ain\b/g, 'alain']];
  const EMIRATES = new Set(['dubai', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rasalkhaimah', 'rak', 'ummalquwain', 'alain']);
  const norm = (s) => { let t = S(s).toLowerCase().replace(/&amp;/g, '&'); for (const [re, to] of SYN) t = t.replace(re, to); return t; };
  const stem = (t) => t.length >= 5 ? t.replace(/(ings?|ed|es|(?<!s)s)$/, '').replace(/e$/, '') : t;   // business = businesses, invoice = invoicing
  const matchTerms = (s) => uniq(termsOf(norm(s)).map(stem));
  // a keyword term is covered by a page's terms: the same stem, or an emirate in the search against a page about the UAE
  const covers = (set, t) => set.includes(t) || (EMIRATES.has(t) && (set.includes('uae') || set.includes('emirat')));
  const shareIn = (want, set) => want.length ? want.filter(t => covers(set, t)).length / want.length : 0;
  // R56: a listing page (the blog / insights index, a category, a tag) gets impressions for every article it lists; when a dedicated
  // page matches the same search by its own slug or title, the dedicated page is the one that answers it
  const LISTING = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;
  const isListing = (u) => { const p = pathOf(u).replace(/[?#].*$/, ''); return LISTING.test(p); };
  const untitled = (model) => pages(model).filter(p => !S(p.title) && !S(p.h1));
  // RV-1 (2026-10-21): a page whose address answered 404 / 410 when it was last read (redirects followed: the bare host 308s to www, which
  // 404s) is GONE. It is still in the inventory (Google keeps showing it), but no advice may point at it: matchPage never returns it as
  // "the page that answers this search", and the readers list it as a redirect to make (v5/code/_gone.js). Unknown (0) is not gone.
  const isGone = (p) => { const n = Number((p || {}).http_status) || 0; return n === 404 || n === 410; };
  const gonePages = (model) => pages(model).filter(isGone);
  // ---- K8 (2026-10-21, KW-MATCH): the page that is ABOUT the search, not only the page that repeats its words ----
  // The 75% word rule missed techand.ai's live "AI & Automation | What We Do | Tech&" (/whatwedo/ai-automation) for "ai consulting dubai"
  // (1 of 3 words) and the ladder planned a new top page beside it; it also let "it consulting services dubai" claim an AI consulting page
  // on "consulting services dubai" alone. Now: brand, place and generic service words ("consulting", "services", "company", "dubai") never
  // decide a match; what is left (the search's core words) must be on the page, weighted by how rare each word is on this site (IDF: a word
  // on every page proves nothing); the page's title / H1, address and Search Console searches are the evidence, in that order; a page whose
  // own words belong to another service of the client is never the answer; an article is not the answer to a buying search; a gone page
  // answers nothing. Every hit carries `confidence` (0-1), `confidence_label` and `evidence` in plain words; a weaker one is `may_overlap`
  // (pageMatch), which callers report as "may overlap" and never as the page.
  const GENERIC = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'consultancies', 'service', 'services', 'company', 'companies', 'agency', 'agencies',
    'firm', 'firms', 'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'professional', 'professionals',
    'team', 'teams', 'best', 'top', 'near', 'me', 'leading', 'trusted', 'certified', 'official', 'online', 'local', 'affordable', 'cheap', 'home', 'page', 'website', 'site']);
  const COMMERCIAL = new Set(['consulting', 'consultant', 'consultants', 'consultancy', 'service', 'services', 'company', 'companies', 'agency', 'agencies', 'firm', 'firms',
    'provider', 'providers', 'solution', 'solutions', 'expert', 'experts', 'specialist', 'specialists', 'partner', 'partners', 'hire', 'price', 'pricing', 'cost', 'quote']);
  const PLACES = new Set(['uae', 'gcc', 'mena', 'emirates', 'emirate', 'middle', 'east', 'saudi', 'arabia', 'ksa', 'riyadh', 'jeddah', 'dammam', 'qatar', 'doha', 'oman', 'muscat',
    'bahrain', 'manama', 'kuwait', 'egypt', 'cairo', 'uk', 'london', 'usa', 'india', 'pakistan', 'karachi', 'lahore', 'singapore', 'europe', 'gulf', 'dxb', 'difc', 'dafza']);
  // the kind of service a search or a page is about: "crm consulting" is not answered by a "CRM implementation" page (the words left are the same)
  const KIND = { consulting: 'consulting', consultant: 'consulting', consultants: 'consulting', consultancy: 'consulting', advisory: 'consulting', implementation: 'implementation', implement: 'implementation',
    migration: 'migration', integration: 'integration', support: 'support', training: 'training', course: 'training', courses: 'training', pricing: 'pricing', price: 'pricing', cost: 'pricing',
    audit: 'audit', development: 'development', licensing: 'licensing', license: 'licensing', licence: 'licensing', jobs: 'jobs', careers: 'jobs', career: 'jobs', hosting: 'hosting', outsourcing: 'outsourcing' };
  const kindsOf = (s) => uniq(tokensOf(norm(s)).map(t => KIND[t]).filter(Boolean));
  const ARTICLE = /\/(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|guides?)\/[^/]+/i;
  const svcList = (model) => (model && Array.isArray(model.declared_services) && model.declared_services.length) ? model.declared_services : services(model);
  // the client's own name ("Tech&", "techand"): never a topic word, unless the word also names one of its services ("ERP Partners" sells ERP)
  const brandWords = (model) => { const m = model || {}; const label = bare(m.domain || m.canonical_host || '').split('.')[0].replace(/[^a-z0-9]/g, '');
    const svc = new Set(svcList(m).flatMap(sv => tokensOf(norm(sv))));
    return new Set([...(m.brand_names || []), m.business_name].flatMap(b => tokensOf(norm(b))).concat(label ? [label] : []).filter(t => t.length > 2 && !svc.has(t))); };
  // the words that say WHAT a text is about: no stop / filler / generic / place / brand word, light stem, synonyms written out
  const coreTerms = (s, brands) => uniq(tokensOf(norm(s)).filter(t => t.length > 1 && !STOP.has(t) && !FILLER.has(t) && !GENERIC.has(t) && !PLACES.has(t) && !EMIRATES.has(t) && !(brands && brands.has(t))).map(stem));
  const slugText = (u) => pathOf(u).replace(/[?#].*$/, '').replace(/\.[a-z]{2,5}$/i, '').replace(/[\/_-]+/g, ' ');
  const fieldsOf = (p, brands) => ({ title: coreTerms(S(p.title) + ' ' + S(p.h1), brands), own: coreTerms(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url), brands),
    slug: coreTerms(slugText(p.url), brands), desc: coreTerms(S(p.description), brands),
    queries: (p.queries || []).filter(q => (Number((q || {}).impressions) || 0) > 0).map(q => coreTerms(S((q || {}).query || (q || {}).keyword), brands)) });
  // the client's services a set of core words belongs to (declared first): a service is hit when at least half its own core words are there
  const serviceHits = (model, terms, brands) => { const set = new Set(terms); const out = [];
    for (const sv of svcList(model)) { const st = coreTerms(sv, brands); if (!st.length) continue; const have = st.filter(t => set.has(t)).length; if (have >= Math.max(1, Math.ceil(st.length / 2))) out.push(S(sv)); }
    return out; };
  const MATCH_CONF = { page: 0.75, overlap: 0.4, article_cap: 0.6, high: 0.85 };
  const confLabel = (c) => c >= MATCH_CONF.high ? 'high' : c >= MATCH_CONF.page ? 'medium' : 'low';
  const topicMatch = (model, keyword, inv, opts) => {
    const o = opts || {}; const brands = brandWords(model); const core = coreTerms(keyword, brands); if (!core.length) return { best: null, overlap: null, core };
    const commercial = tokensOf(norm(keyword)).some(t => COMMERCIAL.has(t)); const kKinds = kindsOf(keyword);
    const docs = inv.map(p => ({ p, f: fieldsOf(p, brands) }));
    const N = docs.length || 1; const df = (t) => docs.filter(d => covers(d.f.own, t)).length;
    const w = new Map(core.map(t => [t, Math.log((N + 1) / (df(t) + 1)) + 1]));   // IDF: a word on every page of the site weighs least
    const W = core.reduce((a, t) => a + w.get(t), 0);
    const kSvc = serviceHits(model, core, brands);
    const kSvcTerms = new Set(kSvc.flatMap(sv => coreTerms(sv, brands)));
    const ignored = uniq(tokensOf(norm(keyword)).filter(t => GENERIC.has(t) || PLACES.has(t) || EMIRATES.has(t) || brands.has(t)));
    let best = null, overlap = null;
    const better = (a, b) => !b || a.confidence > b.confidence + 1e-9 || (Math.abs(a.confidence - b.confidence) < 1e-9 && (a.search_queries_about > b.search_queries_about || (o.isPref && o.isPref(a.url) && !o.isPref(b.url))));
    for (const { p, f } of docs) {
      if (o.skip && o.skip(p)) continue;
      const qAbout = f.queries.filter(q => core.every(t => covers(q, t)));   // its Search Console searches that carry every core word of this one
      const field = (t) => covers(f.title, t) ? 1 : covers(f.slug, t) ? 0.9 : qAbout.length >= 2 ? 1 : f.queries.filter(q => covers(q, t)).length >= 2 ? 0.85 : qAbout.length === 1 ? 0.7 : covers(f.desc, t) ? 0.6 : 0;
      const cov = core.reduce((a, t) => a + w.get(t) * field(t), 0) / W;
      if (cov <= 0) continue;
      const pSvc = serviceHits(model, f.own, brands);
      if (kSvc.length && pSvc.length && !pSvc.some(sv => kSvc.includes(sv))) continue;   // another service of the client: never the answer, not even "may overlap"
      // focus: how much of the page's own title is this search (or the client service it belongs to); a page about five things is a weaker answer
      const own = f.title.length ? f.title : f.slug;
      const focus = own.length ? own.filter(t => core.includes(t) || kSvcTerms.has(t)).length / own.length : 0;
      let conf = cov * (0.8 + 0.2 * focus);
      const article = ARTICLE.test(pathOf(p.url)) || isListing(p.url);
      if (commercial && article) conf = Math.min(conf, MATCH_CONF.article_cap);   // an article about the subject is not the page that sells it
      const pKinds = kindsOf(S(p.title) + ' ' + S(p.h1) + ' ' + slugText(p.url)); const kindClash = kKinds.length && pKinds.length && !pKinds.some(k => kKinds.includes(k));
      if (kindClash) conf = Math.min(conf, MATCH_CONF.article_cap);   // "crm consulting" vs a "CRM implementation" page: another kind of service
      const untitled = !S(p.title) && !S(p.h1);
      if (untitled && qAbout.length < 2) conf = Math.min(conf, MATCH_CONF.article_cap);   // an address alone is not enough to call it the page (R34: titles not read yet)
      conf = Math.round(conf * 100) / 100;
      const inTitle = core.filter(t => covers(f.title, t)), inSlug = core.filter(t => !covers(f.title, t) && covers(f.slug, t));
      const ev = [];
      if (inTitle.length) ev.push('its title' + (S(p.title) ? ' "' + S(p.title).replace(/&amp;/g, '&') + '"' : '') + ' is about ' + inTitle.map(t => '"' + t + '"').join(' and '));
      if (inSlug.length) ev.push('its address ' + pathOf(p.url) + ' carries ' + inSlug.map(t => '"' + t + '"').join(' and '));
      if (qAbout.length) ev.push(qAbout.length + ' of its Search Console searches ' + (qAbout.length === 1 ? 'is' : 'are') + ' about it');
      const shared = pSvc.find(sv => kSvc.includes(sv));
      if (shared) ev.push('both are about your service "' + shared + '"');
      if (commercial && article) ev.push('it is an article, not the page that sells this service');
      if (kindClash) ev.push('it is about ' + pKinds.join(' / ') + ', the search asks for ' + kKinds.join(' / '));
      if (untitled && qAbout.length < 2) ev.push('its title was not read yet');
      if (!ev.length) ev.push('some of its words are about this search');
      const hit = { url: p.url, title: p.title, source: p.source, matched_by: inTitle.length ? 'title' : inSlug.length ? 'slug' : qAbout.length ? 'query' : 'topic', score: conf, impressions: 0,
        confidence: conf, confidence_label: confLabel(conf), search_queries_about: qAbout.length, article, pass: 'topic',
        evidence: ev.join(', ') + (ignored.length ? ' (' + ignored.map(t => '"' + t + '"').join(', ') + ' left out as too general)' : '') };
      if (conf + 1e-9 >= MATCH_CONF.page) { if (better(hit, best)) best = hit; }
      else if (conf + 1e-9 >= MATCH_CONF.overlap && better(hit, overlap)) overlap = hit;
    }
    return { best, overlap, core };
  };
  // { match, may_overlap }: `match` is the page that answers the search (or null), `may_overlap` a weaker candidate to mention, never to act on
  const pageMatch = (model, keyword, prefer) => {   // `prefer`: a URL that wins a tie (the page Search Console itself credits for the search)
    const prefKey = prefer ? bare(hostOf(prefer)) + pathOf(prefer).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase() : "";
    const isPref = (u) => !!prefKey && (bare(hostOf(u)) + pathOf(u).replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase()) === prefKey;
    const want = matchTerms(keyword); if (!want.length) return { match: null, may_overlap: null };
    const key = tokensOf(keyword).join(' ');
    const inv = pages(model).filter(p => !isGone(p));   // RV-1: a gone page answers nothing
    const brands = brandWords(model); const core = coreTerms(keyword, brands);
    const kSvc = core.length ? serviceHits(model, core, brands) : [];
    const otherService = (p) => { if (!kSvc.length) return false; const ps = serviceHits(model, fieldsOf(p, brands).own, brands); return ps.length > 0 && !ps.some(sv => kSvc.includes(sv)); };
    const byQuery = [];
    for (const p of inv) {
      const q = (p.queries || []).find(x => tokensOf(x.query || x.keyword || x).join(' ') === key && (Number((x || {}).impressions) || 0) > 0);
      if (q) byQuery.push({ url: p.url, title: p.title, source: p.source, matched_by: 'query', score: 1, impressions: Number(q.impressions) || 0,
        confidence: 1, confidence_label: 'high', pass: 'query', evidence: 'Google already shows it for this exact search (' + (Number(q.impressions) || 0) + ' impressions in Search Console)' });
    }
    byQuery.sort((a, b) => Number(isListing(a.url)) - Number(isListing(b.url)) || b.impressions - a.impressions);
    const qHit = byQuery[0] || null;
    const listingOf = (lst, best) => ({ url: lst.url, impressions: lst.impressions,
      note: 'Google currently shows ' + pathOf(lst.url) + ' (a listing page) for this search; the page that is about it is ' + pathOf(best.url) });
    if (qHit && !isListing(qHit.url)) { const lst = byQuery.find(x => isListing(x.url)); return { match: lst ? { ...qHit, listing: listingOf(lst, qHit) } : qHit, may_overlap: null }; }
    let best = null;
    for (const p of inv) {
      if (qHit && isListing(p.url)) continue;   // R56: looking for the dedicated page behind a listing's impressions
      const slug = matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''));
      const title = matchTerms(S(p.title) + ' ' + S(p.h1));
      const inSlug = shareIn(want, slug);
      const inTitle = shareIn(want, title);
      const score = Math.max(inSlug, inTitle);
      if (score + 1e-9 < MATCH_MIN) continue;
      // K8: the 75% may be made of generic and place words only when the search's core words are on the page too ("it consulting services
      // dubai" is not an AI consulting page), and never on a page of another service of the client
      if (core.length && !core.every(t => covers(slug, t) || covers(title, t))) continue;
      if (otherService(p)) continue;
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && isPref(p.url) && !isPref(best.url))) { const sc = Math.round(score * 100) / 100;
        best = { url: p.url, title: p.title, source: p.source, matched_by: inSlug >= inTitle ? 'slug' : 'title', score: sc, impressions: 0, confidence: sc, confidence_label: confLabel(sc), pass: 'words',
          evidence: (inSlug >= inTitle ? 'its address ' + pathOf(p.url) : 'its title "' + S(p.title).replace(/&amp;/g, '&') + '"') + ' carries ' + Math.round(score * 100) + '% of the words of the search' }; }
    }
    let overlap = null;
    if (!best) { const t = topicMatch(model, keyword, inv, { skip: (p) => !!qHit && isListing(p.url), isPref }); best = t.best; overlap = t.overlap; }
    if (qHit && best) return { match: { ...best, listing: listingOf(qHit, best) }, may_overlap: null };
    const match = qHit || best;
    return { match, may_overlap: match || !overlap ? null : { ...overlap, note: 'may overlap: ' + pathOf(overlap.url) + ' touches this search (' + overlap.evidence + '), but not closely enough to call it the page for it' } };
  };
  const matchPage = (model, keyword, prefer) => pageMatch(model, keyword, prefer).match;
  // A-22 (2026-10-17): how well ONE page of the inventory targets a search by its own words (slug or title / H1, the matchPage rule), so a
  // caller that already knows the page Google ranks can ask whether another page targets the search more closely - never to replace it
  const pageScore = (page, keyword) => { const p = page || {}; const want = matchTerms(keyword); if (!want.length || !S(p.url)) return null;
    return Math.round(Math.max(shareIn(want, matchTerms(pathOf(p.url).replace(/\.[a-z]{2,5}$/i, ''))), shareIn(want, matchTerms(S(p.title) + ' ' + S(p.h1)))) * 100) / 100; };
  // R35: how much of a search a page's OWN title / H1 holds (null when the page's title was never read) - the only evidence that may call
  // a page "about something else"
  // the words of a spoken / long-tail search that say nothing about the subject ("which ... can help ... in the uae")
  const FILLER = new Set(['which', 'what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'help', 'helps', 'best', 'top', 'near', 'me', 'is', 'are', 'do', 'does', 'should', 'will', 'would', 'get', 'need', 'i', 'we', 'you']);
  const titleShare = (page, keyword) => { const p = page || {}; if (!S(p.title) && !S(p.h1)) return null;
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem)); if (!want.length) return null; const set = matchTerms(S(p.title) + ' ' + S(p.h1));
    return { share: Math.round(shareIn(want, set) * 100) / 100, have: want.filter(t => covers(set, t)).length, of: want.length, missing: want.filter(t => !covers(set, t)) }; };
  // ---- W05-B (2026-10-30, page-quality BEFORE_AFTER K4): is this page really THE page for the search, before a run rewrites its address? ----
  // The content run took /dynamics-365-project-operations-uae (title not on file, matched by its address only: "dynamics", "365", "uae") as the
  // page to improve for "dynamics 365 partner dubai", wrote the partner page onto that address, and the hold waved it through as a refresh.
  // An address is not evidence of what a page is about. A page is confirmed only by its OWN words: its title or main heading (from the
  // inventory or read in this run, `more.texts`), or a Search Console search it earns impressions for, where that text (1) carries every core
  // word of the search, (2) carries 75% of all its words, and (3) is ABOUT the search: its rarest word on this site is one of the search's own,
  // or the words it adds (not the brand, a place, the kind of service or the form of the page) weigh under a third of the whole. "Dynamics 365
  // Project Operations Implementation UAE" adds "project" and "operations" (rare) to "dynamics 365" (on every page): about something else.
  // Returns { ok, by, text, evidence, why }; never throws; with nothing to read, ok is false (the caller writes a new page and says so).
  const confirmPage = (model, page, keyword, more) => {
    const p = page || {}; const o = more || {};
    const m = model || {}; const brands = brandWords(m);
    const core = coreTerms(keyword, brands);
    const want = uniq(termsOf(norm(keyword)).filter(t => !FILLER.has(t)).map(stem));
    const shortUrl = pathOf(p.url);
    if (!core.length || !want.length) return { ok: false, by: '', text: '', evidence: '', why: 'the search has no word that says what it is about, so no page can be confirmed as its page' };
    // the kind of service ("implementation", "support") and the form of the page ("guide", "checklist", a year) say how a page answers, not what about
    const FORM = ['guide', 'guides', 'buyer', 'buyers', 'complete', 'ultimate', 'definitive', 'explained', 'explain', 'overview', 'introduction', 'intro', 'checklist', 'faq', 'faqs',
      'tip', 'tips', 'everything', 'know', 'need', 'basic', 'basics', 'beginner', 'beginners', 'step', 'steps', 'updated', 'latest'];
    const kindStems = new Set([...Object.keys(KIND), ...FORM].map(stem));
    const inv = pages(m); const N = inv.length || 1;
    const docs = inv.map(x => fieldsOf(x, brands).own);
    const wOf = (t) => { const df = docs.filter(d => covers(d, t)).length; return Math.log((N + 1) / (df + 1)) + 1; };
    const cands = [];
    const add = (text, by) => { const t = S(text).replace(/&amp;/g, '&'); if (t) cands.push({ text: t, by }); };
    add(p.title, 'its title'); add(p.h1, 'its main heading');
    for (const t of (Array.isArray(o.texts) ? o.texts : [])) if (t && S(t.text)) add(t.text, S(t.by) || 'its title as read now');
    for (const q of (Array.isArray(p.queries) ? p.queries : queriesOf(p))) if ((Number((q || {}).impressions) || 0) > 0) add((q || {}).query || (q || {}).keyword, 'a search it earns impressions for in Search Console');
    if (!cands.length) return { ok: false, by: '', text: '', evidence: '', why: shortUrl + ' has no title, main heading or Search Console search on file, and an address alone does not say what a page is about' };
    let best = null;
    for (const c of cands) {
      const tt = coreTerms(c.text, brands); if (!tt.length) continue;
      const allCore = core.every(t => covers(tt, t));
      const share = shareIn(want, matchTerms(c.text));
      const extra = uniq(tt.filter(t => !core.includes(t) && !kindStems.has(t) && !/^(?:19|20)\d\d$/.test(t)));
      const own = core.filter(t => covers(tt, t)).reduce((a, t) => a + wOf(t), 0);
      const add2 = extra.reduce((a, t) => a + wOf(t), 0);
      const focus = own + add2 > 0 ? own / (own + add2) : 0;
      // about the search: its rarest word is one of the search's own (an article title that only describes more, "the cost of non-compliance:
      // UAE e-invoicing penalties and mitigation costs", keeps it), or what it adds weighs under a third ("d365 operations uae", 0.58 on
      // client A's site, adds the rarer "operations" to "dynamics 365": not the page for "dynamics 365 partner dubai")
      const ws = tt.filter(t => !kindStems.has(t) && !/^(?:19|20)\d\d$/.test(t)).map(t => [t, wOf(t)]);
      const maxW = ws.reduce((mx, x) => Math.max(mx, x[1]), 0);
      const rarestOwn = ws.some(([t, w]) => core.includes(t) && w + 1e-9 >= maxW);
      const ok = allCore && share + 1e-9 >= MATCH_MIN && (rarestOwn || focus > 0.67 + 1e-9);
      const said = uniq(tokensOf(norm(c.text)).filter(w => extra.includes(stem(w))));   // the page's own words, not their stems, for the reason
      const r = { ok, by: c.by, text: c.text, focus: Math.round(focus * 100) / 100, share: Math.round(share * 100) / 100, extra: said.length ? said : extra };
      if (!best || (r.ok && !best.ok)) best = r;   // the first text read (the title before the searches) explains a refusal
      if (ok) break;
    }
    if (!best) return { ok: false, by: '', text: '', evidence: '', why: 'the title and searches of ' + shortUrl + ' say nothing about this search' };
    if (best.ok) return { ok: true, by: best.by, text: best.text, evidence: best.by + ' "' + best.text + '" is about this search', why: '' };
    return { ok: false, by: best.by, text: best.text, evidence: '',
      why: best.by + ' "' + best.text + '" is about ' + (best.extra.length ? best.extra.map(t => '"' + t + '"').join(' and ') : 'something else') + ', not this search, so ' + shortUrl + ' is not the page for it' };
  };
  // R34: the pages whose title was never read, so a caller can say what it judged on the address alone instead of reading nothing silently
  const titleGap = (model) => { const all = pages(model); const u = untitled(model);
    return { pages: all.length, untitled: u.length, urls: u.slice(0, 12).map(p => p.url),
      note: u.length ? u.length + ' of the ' + all.length + ' pages of the site have no title on file yet (the weekly site check reads them a batch at a time), so they were judged by their address only' : '' }; };
  // R55: a URL of the site as the site serves it (canonical host); another site's URL is returned as it is
  const canonUrl = (model, u) => { const h = hostOf(u); if (!h || bare(h) !== bare((model || {}).domain || (model || {}).canonical_host || '')) return S(u); return siteUrl(model, pathOf(u)); };
  // D11: a stored seo_pages row carries its queries as the JSON string `queries_json`, so both shapes are accepted here
  const queriesOf = (p) => Array.isArray(p.queries) ? p.queries : (jparse(p.queries_json, []) || []);
  const withPages = (model, more) => ({ ...model, pages: (() => { const seen = new Set(); const out = [];
    for (const p of [...pages(model), ...(Array.isArray(more) ? more : [])]) { const u = S(p.url); if (!u) continue; const k = pathOf(u).replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) { const old = out.find(o => pathOf(o.url).replace(/\/$/, '').toLowerCase() === k); if (old) { old.title = old.title || S(p.title); old.h1 = old.h1 || S(p.h1); old.lastmod = old.lastmod || S(p.lastmod); const q = queriesOf(p); if (q.length) old.queries = q;
        // RV-1: the newest reading of the address wins (a page that came back after a redirect was added is live again)
        if ((Number(p.http_status) || 0) && S(p.status_at) >= S(old.status_at)) { old.http_status = Number(p.http_status) || 0; old.status_at = S(p.status_at); } } continue; }
      seen.add(k); out.push({ url: u, title: S(p.title), h1: S(p.h1), source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries: queriesOf(p), http_status: Number(p.http_status) || 0, status_at: S(p.status_at) }); }
    return out; })() });
  // the model exactly as it was stored (seo_sites row or a seo_cache value), with its own timestamp -- never "now", so isFresh() is honest
  const stored = (row) => { const r = (row && typeof row === 'object') ? row : {}; return (S(r.canonical_host) || S(r.model_updated_at)) ? from(r, {}) : null; };
  const FRESH_DAYS = 7;
  const ageDays = (model) => { const t = Date.parse(S((model || {}).model_updated_at)); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
  const isFresh = (model, days) => !!(model && S(model.canonical_host) && ageDays(model) < (Number(days) > 0 ? Number(days) : FRESH_DAYS));
  // exactly the seo_sites columns the model owns (plus the two keys), ready to merge into a site row or a cache value
  const COLUMNS = ['site_id', 'domain', 'canonical_host', 'business_name', 'logo_url', 'nap_json', 'services_json', 'nav_pages_json', 'business_facts', 'cta', 'brand_names', 'competitors', 'accreditation', 'model_updated_at', 'declared_services'];
  const toRow = (model) => { const m = model || {};
    return { site_id: S(m.site_id), domain: S(m.domain), canonical_host: S(m.canonical_host), business_name: S(m.business_name), logo_url: S(m.logo_url),
      nap_json: JSON.stringify(nap(m)), services_json: JSON.stringify(services(m)), nav_pages_json: JSON.stringify((m.nav_pages || []).map(p => ({ url: p.url, title: p.title }))),
      business_facts: S(m.business_facts).slice(0, 2000), cta: S(m.cta).slice(0, 200), brand_names: (m.brand_names || []).join(', ').slice(0, 500),
      competitors: (m.competitors || []).join(', ').slice(0, 500), accreditation: S(m.accreditation).slice(0, 200), model_updated_at: S(m.model_updated_at),
      declared_services: JSON.stringify(Array.isArray(m.declared_services) ? m.declared_services : []) };
  };
  // B4-1 / B4-2 (2026-10-15, benchmark area 4): the measurement columns belong to the row, so the kit emits them — a Data Table
  // node auto-maps every field it is given, and a row that is short of a column is as wrong as one that carries a stray field.
  // The model itself measures nothing: these are the defaults the Site Tracker's own judgement is written over
  // (v5/code/Page_Inventory_Site.js), and `''` for decay_state means "never measured", never "steady".
  const num0 = (v) => (Number(v) || 0);
  const pageRows = (model) => pages(model).map(p => ({ site_id: S((model || {}).site_id), url: S(p.url), title: S(p.title).slice(0, 300), h1: S(p.h1).slice(0, 300),
    source: S(p.source) || 'sitemap', lastmod: S(p.lastmod), queries_json: JSON.stringify(p.queries || []), updated_at: S((model || {}).model_updated_at) || new Date().toISOString(),
    clicks: num0(p.clicks), impressions: num0(p.impressions), position: num0(p.position), prev_clicks: num0(p.prev_clicks), yoy_clicks: num0(p.yoy_clicks),
    decay_state: S(p.decay_state), decay_pct: num0(p.decay_pct), decay_lost: num0(p.decay_lost), decay_kind: S(p.decay_kind),
    decay_basis: S(p.decay_basis).slice(0, 900), measured_at: S(p.measured_at),
    http_status: num0(p.http_status), status_at: S(p.status_at) }));   // RV-1: what the address answered when it was last read (0 = not read)
  // ---- C-7 (re-rating 2026-10-17): ONE page state per keyword, read by the Rank Tracker AND the Site Tracker (and so by the cadence) ----
  // In one morning the Rank Tracker said of "ai consulting" "…/ai-copilot-advisory-uae already answers this search - refresh that page"
  // while the Site Tracker said "fix the four drafts that failed the quality check and run them again", and of "it consulting dubai"
  // "write the main page" while the Site Tracker and the cadence said "written today, failed QA, fix it". The order of evidence is one:
  // a LIVE page of the site that answers the search wins (refresh it; a draft written for the search is retired, never a second page);
  // then a written draft (publish it); then a draft that failed its quality check (fix it and run it again); then a run that wrote nothing.
  // in: { keyword, covered_url, written, not_ready, reasons (array or '; ' text), started } -> { state, text } (text: the parenthesis a list uses)
  const pageStep = (o) => {
    const c = o || {}, kw = S(c.keyword), why = (Array.isArray(c.reasons) ? c.reasons : S(c.reasons).split(/;\s+/)).map(S).filter(Boolean).slice(0, 2).join('; ').slice(0, 220);
    if (S(c.covered_url)) return { state: 'covered', text: S(c.covered_url) + ' already answers this search — refresh that page, do not publish a second one'
      + (c.not_ready || c.written ? '; the draft written for "' + kw + '" is not needed (use its text to refresh that page)' : '') };
    if (c.written) return { state: 'written', text: 'already written — publish it' };
    if (c.not_ready) return { state: 'not_ready', text: 'written, but the draft did not pass the quality check' + (why ? ' (' + why + ')' : '') + ' — fix it and run it again; do not publish it as it is' };
    if (c.started) return { state: 'started', text: 'a page run was started for it but no page was written — it is written again' };
    return { state: 'planned', text: '' };
  };
  return { from, stored, siteUrl, apiTarget, name, nap, services, pages, facts, matchPage, pageMatch, MATCH_CONF, withPages, toRow, pageRows, COLUMNS, isFresh, ageDays, FRESH_DAYS, MATCH_MIN,
    titleShare, titleGap, canonUrl, isListing, pageScore, pageStep, isGone, gonePages, confirmPage,
    helpers: { bare, normHost, hostOf, siteIdFor, termsOf, pathOf, orgFromHtml, navFromHtml, matchTerms, coreTerms } };
})();
// Cleans the client's pages and extracts cheap trust signals (phone, email, years, certifications, counts).
// R38 (2026-10-16): the verdict told a customer their page "has no mandate dates, no tables, no author or date" about a page that has all
// three — three cuts (9,000 characters here, 3,500 in the analyzer's prompt, 5,000 in the copywriter's) and a reader (Jina, with the header /
// aside selectors removed) that flattens tables into plain lines and drops the byline. So this node now (1) keeps the whole existing page
// (CONFIG.existing_chars), (2) measures the page's FACTS on the whole of it — dates in the body text, headings, and, from the page's own HTML
// (the node *Read Client Page HTML* in front of this one), tables, byline, publication date, schema types, call to action — and (3) hands
// every later node that digest, so an absence is asserted only for what was actually read (and the verdict's post-check, `_page_claims.js`,
// refuses any claim the digest contradicts).
const CONFIG = { existing_chars: 24000, other_chars: 6000, headings: 30, dates: 8, table_rows: 6, tables_shown: 3, min_html_words: 120 };
const ctx = $('Collect Site URLs').first().json;
const reqs = $('Client Page Requests').all().map(i => i.json);
// the Jina answers: read from their own node when the HTML read sits between (as wired); a direct feed keeps working (harness, older wiring)
// FU-R1 (2026-10-29): the render chain (Client Render Plan -> Render Client Pages -> Client Render More -> Render More Client Pages) sits
// between Read Client Page HTML and this node; when it ran, the HTML answers are read from their own node, not from this node's input
let RPLAN = null; try { RPLAN = $('Client Render Plan').all().map(i => i.json || {}); } catch (e) { RPLAN = null; }
let jina = null, htmlRes = [];
try { jina = $('Read Client Pages').all().map(i => i.json);
  htmlRes = RPLAN ? (() => { try { return $('Read Client Page HTML').all().map(i => i.json); } catch (e) { return []; } })() : $input.all().map(i => i.json); } catch (e) { jina = null; }
const res = jina || $input.all().map(i => i.json);
// FU-R1: what the renderer read. A client-rendered site (a JavaScript app) answers the text reader with an empty page and the plain GET with a
// script shell: those pages are read again after their scripts ran (Jina Reader, browser engine, the HTML Render Key Pages reads in the audit),
// plus up to two pages the rendered homepage links to. Each rendered page is labelled `read_via: 'rendered'`, and `client_render` says what
// was rendered, what was not and why. With no render (every server-rendered site) nothing here changes the output.
const RENDER = (() => {
  const out = { byIndex: {}, more: [], tried: [], home: null, more_plan: null };
  if (!RPLAN || typeof CRK === 'undefined') return out;
  const planned = RPLAN.filter(p => p && !p.skip && p.stage === 1);
  if (!planned.length) return out;
  let r1 = []; try { r1 = $('Render Client Pages').all().map(i => i.json || {}); } catch (e) { r1 = []; }
  planned.forEach((p, k) => { const v = CRK.rendered(r1[k]); out.byIndex[p.index] = v;
    out.tried.push({ url: p.url, kind: p.kind, stage: 1, rendered: !!v.ok, why: v.ok ? p.why : v.why });
    if (v.ok && p.kind === 'home' && !out.home) out.home = { url: p.url, html: v.html }; });
  let mp = []; try { mp = $('Client Render More').all().map(i => i.json || {}); } catch (e) { mp = []; }
  let r2 = []; try { r2 = $('Render More Client Pages').all().map(i => i.json || {}); } catch (e) { r2 = []; }
  const mpl = mp.filter(m => m && !m.skip);
  if (!mpl.length && mp[0] && mp[0].more_plan) out.more_plan = mp[0].more_plan;
  mpl.forEach((m, k) => { const v = CRK.rendered(r2[k]);
    out.tried.push({ url: m.url, kind: m.kind, stage: 2, rendered: !!v.ok, why: v.ok ? m.why : v.why, ...(m.topic_match != null ? { topic_match: m.topic_match } : {}) });
    if (v.ok) out.more.push({ url: m.url, kind: m.kind || 'related', raw: v.raw }); });
  return out;
})();
const strip = (s) => String(s || '')
  .replace(/^(Title|URL Source|Markdown Content|Published Time):.*$/gm, '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>]+/g, '').replace(/^#+\s*/gm, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// ---- the page's facts, measured on the WHOLE page (R38) ----
const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_RES = [
  new RegExp('\\b\\d{1,2}(?:st|nd|rd|th)?\\s+' + MONTHS + '\\.?,?\\s+(?:19|20)\\d{2}\\b', 'g'),
  new RegExp('\\b' + MONTHS + '\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+(?:19|20)\\d{2}\\b', 'g'),
  new RegExp('\\b' + MONTHS + '\\.?\\s+(?:19|20)\\d{2}\\b', 'g'),
  /\b20\d{2}-\d{2}-\d{2}\b/g
];
const datesIn = (text) => {
  const out = [];
  for (const re of DATE_RES) for (const m of String(text || '').match(re) || []) { const d = m.replace(/\s+/g, ' ').trim(); if (!out.some(x => x.toLowerCase().indexOf(d.toLowerCase()) >= 0)) out.push(d); }
  return out.slice(0, CONFIG.dates);
};
const textOfHtml = (h) => String(h || '').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;|&rsquo;/gi, "'").replace(/&quot;/gi, '"').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const jsonLd = (html) => {
  const out = [];
  for (const m of String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1].trim()); const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { out.push(x); if (x['@graph']) walk(x['@graph']); } }; walk(j); } catch (e) {}
  }
  return out;
};
const nameOf = (a) => Array.isArray(a) ? nameOf(a[0]) : (a && typeof a === 'object' ? String(a.name || '') : String(a || ''));
const tableRows = (t) => {
  const rows = [];
  for (const r of String(t).match(/<tr[\s>][\s\S]*?<\/tr>/gi) || []) {
    const cells = (r.match(/<t[hd][\s>][\s\S]*?<\/t[hd]>/gi) || []).map(c => textOfHtml(c)).filter(Boolean);
    if (cells.length) rows.push(cells.join(' | '));
  }
  return rows;
};
// what the page's own HTML says; `reliable` = the server sent the page's real text (a JavaScript shell says nothing about its tables or byline)
const htmlFacts = (html) => {
  const h = String(html || '');
  if (h.length < 1500 || /just a moment|access denied|captcha|attention required/i.test(h.slice(0, 1500).replace(/<[^>]+>/g, ' '))) return { read: false, reliable: false };
  const words = textOfHtml(h).split(/\s+/).filter(Boolean).length;
  const ld = jsonLd(h);
  const ldTypes = [...new Set(ld.map(x => [].concat(x['@type'] || [])).reduce((a, b) => a.concat(b), []).map(String))].slice(0, 8);
  const article = ld.find(x => [].concat(x['@type'] || []).some(t => /article|blogposting|newsarticle/i.test(String(t)))) || {};
  const tables = h.match(/<table[\s>][\s\S]*?<\/table>/gi) || [];
  const meta = (re) => ((h.match(re) || [])[1] || '').trim();
  let author = nameOf(article.author) || meta(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) || meta(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
  if (!author) { const m = h.match(/<(?:a|span|p|div|address|strong|li)[^>]*(?:class|rel)=["'][^"']*(?:author|byline|by-line)[^"']*["'][^>]*>([\s\S]{1,300}?)<\/(?:a|span|p|div|address|strong|li)>/i); if (m) author = textOfHtml(m[1]); }
  author = textOfHtml(author).replace(/^\s*(?:by|written by|author)[:\s]+/i, '').trim();   // entities decoded (a byline read "Tech&amp;" live, 2026-10-16)
  if (author.length > 80 || /^(?:admin|administrator)$/i.test(author)) author = '';   // a platform's default login is not a byline
  const published = String(article.datePublished || meta(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) || meta(/<time[^>]+datetime=["']([^"']+)["']/i) || '').slice(0, 10);
  const modified = String(article.dateModified || meta(/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i) || '').slice(0, 10);
  // a call to action in the page's own content: not the site header / navigation / footer (those say "Contact" on every page)
  const body = h.replace(/<(header|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  const cta = /href=["'](?:mailto:|tel:)/i.test(body) || [...body.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)].some(m => /\b(contact|get in touch|book a|book your|schedule a|request a|talk to|speak (?:to|with)|get a quote|free consultation|get started|enquir|inquir|demo)\b/i.test(textOfHtml(m[1])));
  return { read: true, reliable: words >= CONFIG.min_html_words, words, title: meta(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, ' ').slice(0, 160),
    tables: tables.length, tables_text: tables.slice(0, CONFIG.tables_shown).map(t => tableRows(t).slice(0, CONFIG.table_rows)),
    author, published, modified, cta, schema_types: ldTypes };
};
const headingsOf = (raw) => [...new Set(String(raw || '').split('\n').filter(l => /^#{1,4}\s/.test(l.trim())).map(l => l.replace(/^#+\s*/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim()).filter(h => h.length >= 3))].slice(0, CONFIG.headings);

const digestOf = (req, raw, text, html, given) => {
  const hf = htmlFacts(html);
  const dates = datesIn(text);
  const structure = hf.read && hf.reliable;
  const d = { url: req.url, words: text.split(/\s+/).filter(Boolean).length, chars_total: text.length, chars_given: given, cut: given < text.length,
    headings: headingsOf(raw), dates, html_read: !!hf.read, structure_reliable: structure,
    html_title: hf.title || '', tables: structure ? hf.tables : null, tables_text: structure ? hf.tables_text : [],
    author: structure ? hf.author : '', published: structure ? hf.published : '', modified: structure ? hf.modified : '',
    cta: structure ? !!hf.cta : (/\b(contact us|get in touch|book a|request a|talk to|get a quote|free consultation)\b/i.test(text) ? true : null), schema_types: structure ? hf.schema_types : [] };
  // the same facts in words, for the prompts (the analyzer and the verdict read this block; an absence is only claimed from what it says)
  const L = [];
  L.push('PAGE FACTS, measured on the WHOLE page (' + d.words + ' words; the text shown to you carries ' + Math.min(given, d.chars_total) + ' of ' + d.chars_total + ' characters' + (d.cut ? ' - it is CUT: say nothing is missing from the part you cannot see' : '') + '):');
  L.push('- Dates written in the body text: ' + (dates.length ? dates.join('; ') : 'none found'));
  if (structure) {
    L.push('- Tables on the page: ' + d.tables + (d.tables ? ' (their rows follow in the text below)' : ''));
    L.push('- Author / byline: ' + (d.author || 'none found in the page\'s HTML'));
    L.push('- Publication / update date: ' + ([d.published && 'published ' + d.published, d.modified && 'updated ' + d.modified].filter(Boolean).join(', ') || 'none found in the page\'s HTML'));
    L.push('- Call to action in the page content: ' + (d.cta ? 'yes' : 'none found'));
    if (d.schema_types.length) L.push('- Structured data: ' + d.schema_types.join(', '));
  } else {
    L.push('- Tables, author, publication date, call to action: NOT CHECKED (the page\'s HTML could not be read in full, and the text reader drops tables and bylines). Never say the page lacks them.');
  }
  if (d.headings.length) L.push('- Headings: ' + d.headings.slice(0, 20).join(' | '));
  d.facts_text = L.join('\n');
  d.tables_block = (structure && d.tables_text.length) ? 'TABLES ON THE PAGE (from its HTML; the text reader flattened them):\n' + d.tables_text.map((t, i) => 'Table ' + (i + 1) + ':\n' + t.join('\n')).join('\n') : '';
  return d;
};

let existingDigest = null;
let existingReaderTitle = null;
const pages = reqs.map((r, i) => {
  const j = res[i] || {};
  let rawText = String(j.page_text || j.data || '');
  let text = strip(rawText);
  // FU-R1: the reader could not read it and the renderer could: the rendered page stands in (its text, and its HTML for the page's facts)
  const rr = RENDER.byIndex[i]; const viaRender = !!(rr && rr.ok && (j.error || text.length < 200));
  if (viaRender) { rawText = rr.raw; text = strip(rawText); }
  if (!viaRender && (j.error || text.length < 200 || /just a moment|access denied|captcha/i.test(text.slice(0, 400)))) return null;
  const cap = r.kind === 'existing' ? CONFIG.existing_chars : CONFIG.other_chars;
  const h = htmlRes[i] || {};
  if (r.kind === 'existing' && !existingReaderTitle) existingReaderTitle = { url: r.url, title: ((String(j.page_text || j.data || '').match(/^Title:[ \t]*(.+)$/m) || [])[1] || '').trim() };   // W05-B: the reader's own title line
  if (r.kind === 'existing' && !existingDigest) existingDigest = digestOf(r, rawText, text, viaRender ? rr.html : (h.error ? '' : (h.page_html != null ? h.page_html : (h.data != null ? h.data : h.body))), Math.min(cap, text.length));
  return { url: r.url, kind: r.kind, words: text.split(/\s+/).length, text: text.slice(0, cap), ...(viaRender ? { read_via: 'rendered' } : {}) };
}).filter(Boolean);
// FU-R1: the pages the rendered homepage links to (the services page, the page closest to the search), read rendered too
for (const m of RENDER.more) { const text = strip(m.raw); if (text.length < 200) continue;
  pages.push({ url: m.url, kind: m.kind, words: text.split(/\s+/).length, text: text.slice(0, CONFIG.other_chars), read_via: 'rendered' }); }
// FU-R1: a client-rendered site has no sitemap the run could read, so its own pages were unknown as link targets; the rendered homepage's
// menu is that list (only when the sitemap gave nothing, so a site with a sitemap keeps exactly the candidates it had)
const renderedLinks = (RENDER.home && !(ctx.site_urls || []).length) ? CRK.links(RENDER.home.html, RENDER.home.url, ctx.domain).slice(0, CRK.CONFIG.links_kept) : [];
const linkCands = (() => { if (!renderedLinks.length) return null; const base = ctx.internal_link_candidates || [];
  const have = new Set(base.map(c => String((c && c.url) || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')));
  return base.concat(renderedLinks.filter(l => !have.has(l.url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')))
    .map(l => ({ url: l.url, path: l.path, ...(l.title ? { title: l.title } : {}), source: 'rendered homepage' }))); })();
const clientRender = RENDER.tried.length ? { rendered: RENDER.tried.filter(t => t.rendered).length, tried: RENDER.tried.length, cap: CRK.CONFIG.max_pages,
  pages: RENDER.tried, links_found: renderedLinks.length, ...(RENDER.more_plan ? { more: RENDER.more_plan } : {}),
  method: 'read after the page\'s scripts ran (the reader\'s browser engine), because the plain reading of the page was an empty script shell' } : null;
const existing = pages.find(p => p.kind === 'existing');
// P2-5 (2026-10-12, Phase 2 live check §3): a page of the inventory that already answers this keyword (Client Page Requests -> SM.matchPage)
// becomes this run's existing page, whether or not the fetch of it succeeded. The verdict, the brief, the schema and the report then improve
// THAT URL — run 444 recommended a second page for "uae e invoicing penalties" although the site's own page had been live since August.
const matchedReq = reqs.find(r => r && r.kind === 'existing' && r.existing_page && r.existing_page.url) || null;
const inventoryPage = (!(ctx.existing_page && ctx.existing_page.url) && matchedReq) ? matchedReq.existing_page : null;
// H2 (2026-10-27, exec 2575): the ladder planned a new page, so a page the sitemap matched is not this run's page to rewrite
const ignoredReq = reqs.find(r => r && r.ignored_existing && r.ignored_existing.url) || null;
// W07-B (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md section 10, K1): after "Write it anyway" the new page reused the kept page's
// title tag word for word, because nothing knew what that title was. The kept page's own title tag and main heading, from its HTML read in
// this very run (else the reader's first heading for the H1), else from the page inventory; empty when neither has them, and the later
// checks then say "not checked". Only for a page the client chose to keep (a ladder's planned page keeps its own rule).
const ignoredIdentity = (() => {
  const ig = ignoredReq && ignoredReq.ignored_existing; if (!ig || ig.planned_url) return null;
  const key = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const i = reqs.findIndex(r => r && key(r.url) === key(ig.url));
  let title = '', h1 = '', from = '';
  if (i >= 0) {
    const rr = RENDER.byIndex[i]; const h = htmlRes[i] || {}; const j = res[i] || {};
    const html = String((rr && rr.ok) ? rr.html : (h.error ? '' : (h.page_html != null ? h.page_html : (h.data != null ? h.data : (h.body || '')))));
    const tidyT = (t) => textOfHtml(t).replace(/\s+([:;,.!?])/g, '$1').slice(0, 200);   // inline tags flattened: "<span>Businesses</span>:" reads "Businesses:"
    if (html.length >= 200) { title = tidyT((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
      h1 = tidyT((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ''); }
    if (!h1 && !j.error) h1 = String(headingsOf(String(j.page_text || j.data || ''))[0] || '').slice(0, 200);
    if (title || h1) from = 'read in this run';
  }
  if (!title && !h1 && typeof SM !== 'undefined') {
    let model = (ctx.site_model && typeof ctx.site_model === 'object') ? ctx.site_model : null;
    if (!model) { try { model = ($('Site Model').first().json || {}).site_model || null; } catch (e) { model = null; } }
    const inv = model ? SM.pages(model).find(p => key(p.url) === key(ig.url)) : null;
    if (inv) { title = String(inv.title || '').slice(0, 200); h1 = String(inv.h1 || '').slice(0, 200); if (title || h1) from = 'the page inventory'; }
  }
  return { title_tag: title, h1, identity_from: from };
})();
const ignoredOut = ignoredReq ? { ...ignoredReq.ignored_existing, ...(ignoredIdentity || {}) } : null;
const all =pages.map(p => p.text).join('\n');
const uniq = (a) => [...new Set((a || []).map(s => s.trim()))];
const client_signals = {
  phone_shown: /\+?\d[\d\s().-]{7,}\d/.test(all),
  email_shown: /[\w.+-]+@[\w-]+\.[\w.]+/.test(all),
  years_claims: uniq(all.match(/\b\d{1,2}\+?\s*years?\b[^.\n]{0,40}/gi)).slice(0, 3),
  credentials: uniq(all.match(/\b(ISO\s?\d{4,5}|certified|accredited|licensed|award(?:ed|-winning)?|official partner|gold partner|silver partner)\b[^.\n]{0,60}/gi)).slice(0, 5),
  numbers: uniq(all.match(/\b\d[\d,.]*\+?\s?(clients?|customers?|projects?|users?|countries|offices|employees|staff|locations|installations?|reviews?)\b/gi)).slice(0, 6),
  locations: uniq(all.match(/\b(Dubai|Abu Dhabi|Sharjah|Riyadh|Jeddah|London|Manchester|New York|Toronto|Sydney|Singapore|Karachi|Lahore|Islamabad|Mumbai|Delhi|Bangalore|Berlin|Paris|Madrid|Amsterdam)\b/g)).slice(0, 5)
};
// ---- W05-B (2026-10-30, page-quality BEFORE_AFTER K4): the page this run would rewrite is confirmed by its OWN words first ----
// K4 ("dynamics 365 partner dubai") took /dynamics-365-project-operations-uae as the page to improve: matched by its address alone (its title
// not on file), so the partner page was written onto the Project Operations page's address and called Ready. A page the inventory or the
// sitemap matched (never one the client or the pipeline named) must be confirmed by its title or main heading (on file, or read in this very
// run) or a Search Console search it earns impressions for (SM.confirmPage). When it is not, this run writes a NEW page at its own address,
// reads the other page as a related page only, and says so (`existing_page_unconfirmed`, shown in the report and the brief).
const EXCONF = (() => {
  const cand = inventoryPage || ((ctx.existing_page && ctx.existing_page.url) ? ctx.existing_page : null);
  if (!cand || ignoredReq || String(cand.source || '') === 'provided' || String(ctx.existing_page_url || '').trim()) return null;
  if (typeof SM === 'undefined') return null;
  const key = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (String(ctx.ladder_target_url || '').trim() && key(ctx.ladder_target_url) === key(cand.url)) return null;   // the keyword ladder planned this very address for the keyword
  let model = (ctx.site_model && typeof ctx.site_model === 'object') ? ctx.site_model : null;
  if (!model) { try { model = ($('Site Model').first().json || {}).site_model || null; } catch (e) { model = null; } }
  const inv = model ? SM.pages(model).find(p => key(p.url) === key(cand.url)) : null;
  const page = { url: cand.url, title: (inv && inv.title) || cand.title || '', h1: (inv && inv.h1) || '', queries: (inv && inv.queries) || [] };
  const readNow = existingDigest && key(existingDigest.url) === key(cand.url) ? existingDigest : null;
  const rdTitle = existingReaderTitle && key(existingReaderTitle.url) === key(cand.url) ? existingReaderTitle.title : '';
  const htmlTitle = readNow ? String(readNow.html_title || '').replace(/&amp;/g, '&') : '';
  const texts = [{ text: htmlTitle || rdTitle, by: 'its title' }, { text: readNow ? (readNow.headings || [])[0] || '' : '', by: 'its main heading' }].filter(t => t.text);
  const c = SM.confirmPage(model || { pages: [] }, page, ctx.keyword, { texts });
  const title = page.title || (htmlTitle || rdTitle).replace(/\s*[|]\s*[^|]{1,40}$/, '').trim();
  // W07-A (2026-10-31, WAVE06 section 9, the 402 run): what is on file did not confirm the page AND the page reader refused to read it (its
  // fallback failed too). "Has no title, main heading or Search Console search on file" is then not a finding about the page: nobody read
  // it. The check says the page could not be read, and the run decides nothing on it (Parse Verdict's `pages_unread`).
  const unreadMark = !c.ok ? reqs.map((r0, k) => ({ r0, j: res[k] || {} })).find(x => x.r0 && key(x.r0.url) === key(cand.url) && x.j.reader_fallback && x.j.reader_fallback.via === 'none') : null;
  if (unreadMark) return { ok: false, unread: true, cand, title, why: 'it could not be read: ' + (typeof RD !== 'undefined' ? RD.clientReason(unreadMark.j.reader_fallback.refused) : 'the service we use to read web pages did not answer') };
  return { ok: c.ok, cand, title, by: c.by, evidence: c.evidence, why: c.why };
})();
const unreadExisting = EXCONF && EXCONF.unread ? { url: EXCONF.cand.url, title: EXCONF.title, source: EXCONF.cand.source || '', why: EXCONF.why,
  note: 'The page your website already has for this search (' + EXCONF.cand.url + ') could not be read, so nothing was decided about it.' } : null;
const unconfirmed = EXCONF && !EXCONF.ok && !EXCONF.unread ? { url: EXCONF.cand.url, title: EXCONF.title, matched_by: EXCONF.cand.matched_by || (EXCONF.cand.source === 'sitemap' ? 'address' : ''), source: EXCONF.cand.source || '',
  why: EXCONF.why, note: 'Written as a new page at its own address: ' + EXCONF.why + '.' } : null;
if (unconfirmed) for (const p of pages) if (p.kind === 'existing') p.kind = 'related';
const confirmedPage = EXCONF && EXCONF.ok ? { ...EXCONF.cand, ...(EXCONF.title && !EXCONF.cand.title ? { title: EXCONF.title } : {}), confirmed_by: EXCONF.evidence } : null;
return [{ json: { ...ctx, ...(inventoryPage ? { existing_page: inventoryPage, existing_page_url: ctx.existing_page_url || inventoryPage.url } : {}),
  ...(ignoredReq ? { existing_page: null, existing_page_ignored: ignoredOut } : {}),
  ...(confirmedPage ? { existing_page: confirmedPage } : {}),
  ...(unconfirmed ? { existing_page: null, existing_page_url: String(ctx.existing_page_url || ''), existing_page_unconfirmed: unconfirmed } : {}),
  ...(unreadExisting ? { existing_page: null, existing_page_url: String(ctx.existing_page_url || ''), existing_page_unread: unreadExisting } : {}),   // W07-A
  client_pages: pages, client_pages_read: pages.length, existing_page_text: (existing && !unconfirmed) ? existing.text : '', existing_page_tables: (existingDigest && !unconfirmed) ? existingDigest.tables_block : '', existing_page_digest: unconfirmed ? null : existingDigest,
  existing_page_facts_text: (existingDigest && !unconfirmed) ? existingDigest.facts_text : '', client_signals,
  ...(linkCands ? { internal_link_candidates: linkCands } : {}), ...(clientRender ? { client_render: clientRender } : {}) } }];
