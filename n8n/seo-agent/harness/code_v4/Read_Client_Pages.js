// W07-A (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item"): the reads of *Read Client Pages (reader)* that the page reader REFUSED
// (its key, its balance, its rate: HTTP 401 / 402 / 429, or 403 in its own words) are read again another way, and everything else is handed on
// exactly as the reader answered it. This node took the reader node's name, so every node that reads `$('Read Client Pages')` reads these items, in the
// same order and the same shape. With a funded key no item is refused and nothing changes (the same objects are returned).
//   * a refused read: the same reader without the key (capped and spaced: its free limit is about 20 reads a minute), then, for a text read,
//     a direct fetch of the page in the reader's line format (the client-render path's HTML-to-text, CRK.linesOf);
//   * a read nothing recovered stays an error item, with the reason and `reader_fallback.via: 'none'`, so no later step mistakes a refused read
//     for "the page has no title" or "the competitor wrote nothing";
//   * *Reader Refusals* reads these items and raises ONE ops alert per run for the refusal (seo_ops_alerts, then the alert webhook).
// What was read here: the client's own pages (mode text).
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
const H = this.helpers;
const res = $input.all().map(i => (i && i.json) || {});
let reqs = [];
try { reqs = $('Client Page Requests').all().map(i => (i && i.json) || {}); } catch (e) { reqs = []; }
const r = await RD.recover(H, { reqs, res, mode: 'text', full: false, prop: 'page_text', headers: {"X-Remove-Selector": "header, nav, footer, aside, form, [class*=\"cookie\"], [id*=\"cookie\"], [class*=\"consent\"], [id*=\"consent\"], [id*=\"onetrust\"], [class*=\"newsletter\"], [class*=\"menu\"]", "X-Retain-Images": "none"}, links: false,
  target: (q) => q.url, domain: (q) => '', path: 'the client\'s own pages', node: 'Read Client Pages',
  sleep: (H && typeof H.sleep === 'function') ? H.sleep : undefined });   // n8n has no helpers.sleep: the kit waits with setTimeout there
return r.items.map((j, i) => ({ json: j, pairedItem: { item: i } }));
