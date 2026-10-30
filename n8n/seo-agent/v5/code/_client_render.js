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
